import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { TopBar, TabBar, ContentTab, AnalyzeTab, ResultsTab, type TabId } from "@/components/moonbug";
import { useApiKey } from "@/hooks/useApiKey";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { parseMarkdown, createLayoutAwareChunks, type LayoutAwareChunk, type ChunkerOptions, type DocumentElement } from "@/lib/layout-chunker";

const Index = () => {
  const navigate = useNavigate();
  const { isValid } = useApiKey();
  const { analyze, reset, isAnalyzing, result, progress } = useAnalysis();
  const { user, loading: authLoading, signOut } = useAuth();
  
  const {
    currentProject,
    projects,
    isLoading: projectsLoading,
    isSaving,
    hasUnsavedChanges,
    lastSavedAt,
    saveProject,
    loadProject,
    newProject,
    markUnsaved,
  } = useProjects();

  const [activeTab, setActiveTab] = useState<TabId>('content');
  const [content, setContent] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [chunkerOptions, setChunkerOptions] = useState<ChunkerOptions>({
    maxChunkSize: 512,
    chunkOverlap: 50,
    cascadeHeadings: true,
  });
  
  const [parsedElements, setParsedElements] = useState<DocumentElement[]>([]);
  const [layoutChunks, setLayoutChunks] = useState<LayoutAwareChunk[]>([]);
  const [contentHashAtAnalysis, setContentHashAtAnalysis] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentProject) {
      setContent(currentProject.content || "");
      setKeywords(currentProject.queries || []);
      if (currentProject.settings) {
        setChunkerOptions(currentProject.settings);
      }
    }
  }, [currentProject]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    markUnsaved(newContent, keywords, chunkerOptions, result);
  }, [keywords, chunkerOptions, result, markUnsaved]);

  const handleKeywordsChange = useCallback((newKeywords: string[]) => {
    setKeywords(newKeywords);
    markUnsaved(content, newKeywords, chunkerOptions, result);
  }, [content, chunkerOptions, result, markUnsaved]);

  const handleSettingsChange = useCallback((newOptions: ChunkerOptions) => {
    setChunkerOptions(newOptions);
    markUnsaved(content, keywords, newOptions, result);
  }, [content, keywords, result, markUnsaved]);

  const handleLoadProject = async (projectId: string) => {
    const project = await loadProject(projectId);
    if (project) {
      reset();
      setParsedElements([]);
      setLayoutChunks([]);
      setActiveTab('content');
    }
  };

  const handleNewProject = () => {
    newProject();
    setContent("");
    setKeywords([]);
    setChunkerOptions({ maxChunkSize: 512, chunkOverlap: 50, cascadeHeadings: true });
    reset();
    setParsedElements([]);
    setLayoutChunks([]);
    setActiveTab('content');
  };

  const handleSave = async () => {
    await saveProject(
      currentProject?.project_name || 'Untitled Project',
      content,
      keywords,
      chunkerOptions,
      result,
      currentProject?.id
    );
  };

  const handleChunk = () => {
    const elements = parseMarkdown(content);
    const chunks = createLayoutAwareChunks(elements, chunkerOptions);
    setParsedElements(elements);
    setLayoutChunks(chunks);
    setActiveTab('analyze');
  };

  const handleAnalyze = () => {
    const elements = parseMarkdown(content);
    const chunks = createLayoutAwareChunks(elements, chunkerOptions);
    setParsedElements(elements);
    setLayoutChunks(chunks);
    setContentHashAtAnalysis(content);
    
    analyze({
      content,
      keywords,
      strategy: 'layout-aware',
      layoutChunks: chunks,
      chunkerOptions,
    });
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const tokenCount = Math.ceil(wordCount * 1.3);
  const hasContent = content.trim().length > 0;
  const hasChunks = layoutChunks.length > 0;
  const hasAnalysis = !!result;
  const contentModified = hasAnalysis && content !== contentHashAtAnalysis;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar
        projectName={currentProject?.project_name || 'Untitled Project'}
        projects={projects}
        currentProjectId={currentProject?.id}
        isLoading={projectsLoading}
        userEmail={user?.email}
        onSelectProject={handleLoadProject}
        onNewProject={handleNewProject}
        onSignOut={signOut}
      />
      
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasContent={hasContent}
        hasAnalysis={hasAnalysis}
        isAnalyzing={isAnalyzing}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        wordCount={wordCount}
        lastSaved={lastSavedAt}
        onSave={handleSave}
      />

      {activeTab === 'content' && (
        <ContentTab
          content={content}
          onChange={handleContentChange}
          onChunk={handleChunk}
          isChunking={false}
          wordCount={wordCount}
          tokenCount={tokenCount}
        />
      )}

      {activeTab === 'analyze' && (
        <AnalyzeTab
          hasChunks={hasChunks}
          keywords={keywords}
          onKeywordsChange={handleKeywordsChange}
          chunkerOptions={chunkerOptions}
          onOptionsChange={handleSettingsChange}
          onAnalyze={handleAnalyze}
          isAnalyzing={isAnalyzing}
          progress={progress}
          onGoToContent={() => setActiveTab('content')}
        />
      )}

      {activeTab === 'results' && (
        <ResultsTab
          hasResults={hasAnalysis}
          chunks={layoutChunks}
          chunkScores={result?.chunkScores || []}
          keywords={keywords}
          contentModified={contentModified}
          onReanalyze={handleAnalyze}
          onGoToAnalyze={() => setActiveTab('analyze')}
        />
      )}
    </div>
  );
};

export default Index;
