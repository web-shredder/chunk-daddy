import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Zap, Settings2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiKeyInput } from '@/components/ApiKeyInput';
import { ContentEditor } from '@/components/ContentEditor';
import { KeywordInput } from '@/components/KeywordInput';
import { ChunkingStrategySelect } from '@/components/ChunkingStrategySelect';
import { ResultsDisplay } from '@/components/ResultsDisplay';
import { useApiKey } from '@/hooks/useApiKey';
import { useAnalysis } from '@/hooks/useAnalysis';
import type { ChunkingStrategy } from '@/lib/chunking';

const Index = () => {
  const { apiKey, setApiKey, clearApiKey, isValidating, isValid, error: apiKeyError } = useApiKey();
  const { analyze, reset, isAnalyzing, error: analysisError, result, progress } = useAnalysis();
  
  const [content, setContent] = useState('');
  const [optimizedContent, setOptimizedContent] = useState('');
  const [showOptimized, setShowOptimized] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<ChunkingStrategy>('paragraph');
  const [fixedSize, setFixedSize] = useState(500);

  const handleAnalyze = () => {
    analyze({
      apiKey,
      content,
      optimizedContent: showOptimized ? optimizedContent : undefined,
      keywords,
      strategy,
      fixedChunkSize: fixedSize,
    });
  };

  const canAnalyze = isValid && content.trim() && keywords.some(k => k.trim());

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Chunk Daddy</h1>
                <p className="text-xs text-muted-foreground">
                  Passage Retrieval Optimization Tool
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isValid && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                  API Ready
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Panel - Content Editor */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Content Input</CardTitle>
                <CardDescription>
                  Enter your original content to analyze. Separate paragraphs with double line breaks.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ContentEditor
                  label="Original Content"
                  value={content}
                  onChange={setContent}
                  placeholder="Machine learning algorithms process vast datasets to identify patterns. Data privacy concerns arise when these systems handle sensitive information without proper safeguards.

Enter another paragraph here by adding a blank line above..."
                />
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="show-optimized"
                      checked={showOptimized}
                      onCheckedChange={setShowOptimized}
                    />
                    <Label htmlFor="show-optimized" className="text-sm cursor-pointer">
                      Compare with optimized version
                    </Label>
                  </div>
                </div>
                
                {showOptimized && (
                  <ContentEditor
                    label="Optimized Content"
                    value={optimizedContent}
                    onChange={setOptimizedContent}
                    placeholder="Enter your optimized/split version here to compare scores..."
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Configuration & Results */}
          <div className="space-y-6">
            {/* API Key */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ApiKeyInput
                  apiKey={apiKey}
                  onApiKeyChange={setApiKey}
                  isValidating={isValidating}
                  isValid={isValid}
                  error={apiKeyError}
                  onClear={clearApiKey}
                />
                
                <Separator />
                
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Target Keywords</Label>
                  <KeywordInput
                    keywords={keywords}
                    onChange={setKeywords}
                  />
                </div>
                
                <Separator />
                
                <ChunkingStrategySelect
                  strategy={strategy}
                  onChange={setStrategy}
                  fixedSize={fixedSize}
                  onFixedSizeChange={setFixedSize}
                />
              </CardContent>
            </Card>

            {/* Analyze Button */}
            <Button
              onClick={handleAnalyze}
              disabled={!canAnalyze || isAnalyzing}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              {isAnalyzing ? 'Analyzing...' : 'Rescore Content'}
            </Button>
            
            {isAnalyzing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Generating embeddings and calculating similarity...
                </p>
              </div>
            )}
            
            {analysisError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{analysisError}</AlertDescription>
              </Alert>
            )}

            {/* Results */}
            {result && (
              <Card>
                <CardContent className="pt-6">
                  <ResultsDisplay result={result} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <p className="text-xs text-muted-foreground text-center">
            Chunk Daddy uses OpenAI text-embedding-3-large for embedding generation.
            All calculations are performed locally in your browser.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
