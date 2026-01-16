import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Zap, Check, Loader2, Sparkles, Layers, GitCompare, LogIn, LogOut } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { KeywordInput } from "@/components/KeywordInput";
import { ChunkingSettings } from "@/components/ChunkingSettings";
import { DocumentStructureView } from "@/components/DocumentStructureView";
import { ChunkInspector } from "@/components/ChunkInspector";
import { CascadeComparisonView } from "@/components/CascadeComparisonView";
import { ResultsDisplay } from "@/components/ResultsDisplay";
import { OptimizationEngine } from "@/components/optimizer";
import { useApiKey } from "@/hooks/useApiKey";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useAuth } from "@/hooks/useAuth";
import { parseMarkdown, createLayoutAwareChunks, type LayoutAwareChunk, type ChunkerOptions, type DocumentElement } from "@/lib/layout-chunker";
import chunkDaddyMascot from "@/assets/chunk-daddy.png";

const Index = () => {
  const navigate = useNavigate();
  const { isValidating, isValid, error: apiKeyError, recheckStatus } = useApiKey();
  const { analyze, reset, isAnalyzing, error: analysisError, result, progress } = useAnalysis();
  const { user, loading: authLoading, signOut } = useAuth();

  const [content, setContent] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [chunkerOptions, setChunkerOptions] = useState<ChunkerOptions>({
    maxChunkSize: 512,
    chunkOverlap: 50,
    cascadeHeadings: true,
  });
  
  // Store parsed elements and chunks for display
  const [parsedElements, setParsedElements] = useState<DocumentElement[]>([]);
  const [layoutChunks, setLayoutChunks] = useState<LayoutAwareChunk[]>([]);
  const [selectedChunk, setSelectedChunk] = useState<LayoutAwareChunk | null>(null);

  const handleAnalyze = () => {
    // Parse and chunk content
    const elements = parseMarkdown(content);
    const chunks = createLayoutAwareChunks(elements, chunkerOptions);
    
    setParsedElements(elements);
    setLayoutChunks(chunks);
    setSelectedChunk(null);
    
    // Use layout-aware chunks for analysis
    analyze({
      content,
      keywords,
      strategy: 'layout-aware',
      layoutChunks: chunks,
      chunkerOptions,
    });
  };

  const canAnalyze = isValid && content.trim() && keywords.some((k) => k.trim());

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={chunkDaddyMascot} alt="Chunk Daddy" className="w-10 h-10 rounded-lg object-contain" />
              <div>
                <h1 className="text-xl font-bold">Chunk Daddy</h1>
                <p className="text-xs text-muted-foreground">Layout-Aware Content Chunking for RAG Systems</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {user.email}
                </span>
              )}
              {isValidating ? (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-medium flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking API...
                </span>
              ) : isValid ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  API Ready
                </span>
              ) : (
                <Button variant="outline" size="sm" onClick={recheckStatus}>
                  Retry API Check
                </Button>
              )}
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : user ? (
                <Button variant="outline" size="sm" onClick={() => signOut()}>
                  <LogOut className="h-4 w-4 mr-1" />
                  Logout
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
                  <LogIn className="h-4 w-4 mr-1" />
                  Login
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-7xl mx-auto px-4 py-6">
        {apiKeyError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {apiKeyError} — Please ensure OPENAI_API_KEY is configured in your Cloud secrets.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Panel - Markdown Editor */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">1</span>
                  <CardTitle className="text-base">Content Input</CardTitle>
                </div>
                <CardDescription>
                  Paste or write your markdown. Use headings (# ## ###) for structure.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MarkdownEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Start typing or paste your content here..."
                  minHeight="300px"
                  maxHeight="500px"
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Configuration & Analyze */}
          <div className="space-y-6">
            {/* Keywords */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">2</span>
                  <CardTitle className="text-base">Target Keywords</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  Add keywords to test retrieval relevance against your content.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <KeywordInput keywords={keywords} onChange={setKeywords} content={content} />
              </CardContent>
            </Card>
            
            {/* Chunking Settings */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">3</span>
                  <CardTitle className="text-base">Chunking Settings</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  Configure how your content gets split into chunks.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChunkingSettings
                  content={content}
                  options={chunkerOptions}
                  onChange={setChunkerOptions}
                  hideCard
                />
              </CardContent>
            </Card>

            {/* Analyze Button */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6 pb-6">
                <Button
                  onClick={handleAnalyze}
                  disabled={!canAnalyze || isAnalyzing}
                  className="w-full h-12 text-base font-medium"
                  size="lg"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      chunk it, daddy
                    </>
                  )}
                </Button>
                
                {isAnalyzing && (
                  <div className="space-y-2 mt-4">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">
                      Generating embeddings and calculating similarity...
                    </p>
                  </div>
                )}

                {analysisError && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{analysisError}</AlertDescription>
                  </Alert>
                )}
                
                {!canAnalyze && !isAnalyzing && (
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    {!content.trim() 
                      ? "Add content to get started" 
                      : !keywords.some(k => k.trim()) 
                        ? "Add at least one keyword" 
                        : !isValid 
                          ? "Waiting for API..." 
                          : "Ready to analyze"}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Results Section - Full Width */}
        {result && (
          <div className="mt-8 space-y-6">
            <Separator />
            
            <Tabs defaultValue="results" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="results">
                  Scores
                </TabsTrigger>
                <TabsTrigger value="optimize" className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Auto-Optimize
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="results">
                <Card>
                  <CardContent className="pt-6">
                    <ResultsDisplay result={result} />
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="optimize">
                <Card>
                  <CardContent className="pt-6">
                    <OptimizationEngine
                      content={content}
                      keywords={keywords.filter(k => k.trim())}
                      currentScores={result.originalScores?.keywordScores}
                      onApplyOptimization={(optimized) => {
                        setContent(optimized);
                      }}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            
            {/* Structure & Cascade Section */}
            <Tabs defaultValue="structure" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="structure" className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Structure
                </TabsTrigger>
                <TabsTrigger value="comparison" className="flex items-center gap-1.5">
                  <GitCompare className="h-3.5 w-3.5" />
                  Cascade Impact
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="structure">
                <div className="space-y-6">
                  <DocumentStructureView
                    elements={parsedElements}
                    chunks={layoutChunks}
                    chunkScores={result.chunkScores}
                    keywords={keywords.filter(k => k.trim())}
                    onSelectChunk={(chunk, score) => setSelectedChunk(chunk)}
                    selectedChunkId={selectedChunk?.id}
                  />
                  
                  {selectedChunk && (
                    <ChunkInspector
                      chunk={selectedChunk}
                      score={result.chunkScores.find(cs => cs.chunkId === selectedChunk.id)}
                      keywords={keywords.filter(k => k.trim())}
                    />
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="comparison">
                <CascadeComparisonView
                  chunks={layoutChunks}
                  scoresWithCascade={result.chunkScores}
                  scoresWithoutCascade={result.noCascadeScores || []}
                  keywords={keywords.filter(k => k.trim())}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <p className="text-xs text-muted-foreground text-center">
            Chunk Daddy uses OpenAI text-embedding-3-large for embeddings. Layout-aware chunking with cascading headings improves RAG retrieval accuracy.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;