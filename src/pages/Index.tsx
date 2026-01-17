import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { TopBar, TabBar, ContentTab, AnalyzeTab, ResultsTab, ArchitectureTab, OptimizeTab, ReportTab, type TabId } from "@/components/moonbug";
import { useApiKey } from "@/hooks/useApiKey";
import { useAnalysis, type AnalysisResult } from "@/hooks/useAnalysis";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { parseMarkdown, createLayoutAwareChunks, type LayoutAwareChunk, type ChunkerOptions, type DocumentElement } from "@/lib/layout-chunker";
import type { FullOptimizationResult } from "@/lib/optimizer-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const Index = () => {
  const navigate = useNavigate();
  const { isValid } = useApiKey();
  const { analyze, reset, setResultFromProject, isAnalyzing, result, progress } = useAnalysis();
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
    renameProject,
    deleteProject,
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
  const [optimizedContent, setOptimizedContent] = useState<string>("");
  const [optimizationResult, setOptimizationResult] = useState<FullOptimizationResult | null>(null);
  
  // Local project name
  const [localProjectName, setLocalProjectName] = useState<string>('Untitled Project');
  
  // New project dialog state
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [pendingProjectName, setPendingProjectName] = useState('');
  
  // Track if we should auto-navigate to results after analysis
  const shouldNavigateToResults = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Auto-navigate to results when analysis completes
  useEffect(() => {
    if (result && !isAnalyzing && shouldNavigateToResults.current) {
      setActiveTab('results');
      shouldNavigateToResults.current = false;
    }
  }, [result, isAnalyzing]);

  // Track project ID to detect actual project changes vs. saves
  const lastProjectIdRef = useRef<string | null>(null);
  
  // Sync localProjectName when project loads or changes
  useEffect(() => {
    setLocalProjectName(currentProject?.project_name || 'Untitled Project');
  }, [currentProject?.id, currentProject?.project_name]);
  
  useEffect(() => {
    if (currentProject) {
      // Only reset state if we're loading a DIFFERENT project
      // (not just saving the current one)
      const isNewProject = lastProjectIdRef.current !== currentProject.id;
      lastProjectIdRef.current = currentProject.id;
      
      if (isNewProject) {
        // Loading a different project - restore all state
        setContent(currentProject.content || "");
        setKeywords(currentProject.queries || []);
        if (currentProject.settings) {
          setChunkerOptions(currentProject.settings);
        }
        
        // Restore optimization state if it exists
        if (currentProject.optimized_content) {
          setOptimizedContent(currentProject.optimized_content);
        } else {
          setOptimizedContent("");
        }
        if (currentProject.optimization_result) {
          // Restore timestamp as Date object
          const optResult = {
            ...currentProject.optimization_result,
            timestamp: new Date(currentProject.optimization_result.timestamp)
          };
          setOptimizationResult(optResult);
        } else {
          setOptimizationResult(null);
        }
        
        // Restore analysis results if they exist
        if (currentProject.results) {
          // Re-parse and re-chunk to get layout chunks
          const settings = currentProject.settings || chunkerOptions;
          const elements = parseMarkdown(currentProject.content || "");
          const chunks = createLayoutAwareChunks(elements, settings);
          setParsedElements(elements);
          setLayoutChunks(chunks);
          setContentHashAtAnalysis(currentProject.content || "");
          
          // Restore the result
          setResultFromProject(currentProject.results);
        } else {
          // Clear results if project doesn't have them
          reset();
          setParsedElements([]);
          setLayoutChunks([]);
        }
      }
      // When saving (same project ID), don't touch the local state
      // The save already captures current state, no need to restore it
    }
  }, [currentProject, setResultFromProject, reset, chunkerOptions]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    markUnsaved(newContent, keywords, chunkerOptions, result, optimizedContent, optimizationResult);
  }, [keywords, chunkerOptions, result, optimizedContent, optimizationResult, markUnsaved]);

  const handleKeywordsChange = useCallback((newKeywords: string[]) => {
    setKeywords(newKeywords);
    markUnsaved(content, newKeywords, chunkerOptions, result, optimizedContent, optimizationResult);
  }, [content, chunkerOptions, result, optimizedContent, optimizationResult, markUnsaved]);

  const handleSettingsChange = useCallback((newOptions: ChunkerOptions) => {
    setChunkerOptions(newOptions);
    markUnsaved(content, keywords, newOptions, result, optimizedContent, optimizationResult);
  }, [content, keywords, result, optimizedContent, optimizationResult, markUnsaved]);

  const handleLoadProject = async (projectId: string) => {
    await loadProject(projectId);
    // Results will be restored in the useEffect when currentProject changes
  };

  const handleNewProject = () => {
    setPendingProjectName('');
    setShowNewProjectDialog(true);
  };
  
  const confirmNewProject = () => {
    if (!pendingProjectName.trim()) return;
    
    newProject();
    setContent("");
    setKeywords([]);
    setChunkerOptions({ maxChunkSize: 512, chunkOverlap: 50, cascadeHeadings: true });
    reset();
    setParsedElements([]);
    setLayoutChunks([]);
    setOptimizedContent("");
    setOptimizationResult(null);
    setLocalProjectName(pendingProjectName.trim());
    setActiveTab('content');
    setShowNewProjectDialog(false);
  };

  const handleSave = async () => {
    await saveProject(
      localProjectName,
      content,
      keywords,
      chunkerOptions,
      result,
      currentProject?.id,
      optimizedContent,
      optimizationResult
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
    
    // Set flag to auto-navigate when analysis completes
    shouldNavigateToResults.current = true;
    
    analyze({
      content,
      keywords,
      strategy: 'layout-aware',
      layoutChunks: chunks,
      chunkerOptions,
    });
  };

  const handleRenameProject = (projectId: string, newName: string) => {
    renameProject(projectId, newName);
    // Also update local name if renaming current project
    if (projectId === currentProject?.id) {
      setLocalProjectName(newName);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId);
    // Reset to new project state after deletion
    handleNewProject();
  };

  const handleApplyOptimization = useCallback((newOptimizedContent: string) => {
    setOptimizedContent(newOptimizedContent);
    setContent(newOptimizedContent);
    markUnsaved(newOptimizedContent, keywords, chunkerOptions, result, newOptimizedContent, optimizationResult);
    // Switch to content tab to show the new content
    setActiveTab('content');
  }, [keywords, chunkerOptions, result, optimizationResult, markUnsaved]);
  
  const handleOptimizationComplete = useCallback((optResult: FullOptimizationResult, finalContent: string) => {
    setOptimizationResult(optResult);
    setOptimizedContent(finalContent);
    // Save to project with optimization data
    markUnsaved(content, keywords, chunkerOptions, result, finalContent, optResult);
    // Navigate to report tab
    setActiveTab('report');
  }, [content, keywords, chunkerOptions, result, markUnsaved]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const tokenCount = Math.ceil(wordCount * 1.3);
  const hasContent = content.trim().length > 0;
  const hasChunks = layoutChunks.length > 0;
  const hasAnalysis = !!result;
  const hasOptimizationResult = !!optimizationResult;
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
        projectName={localProjectName}
        projects={projects}
        currentProjectId={currentProject?.id}
        isLoading={projectsLoading}
        userEmail={user?.email}
        onSelectProject={handleLoadProject}
        onNewProject={handleNewProject}
        onSignOut={signOut}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
      />
      
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasContent={hasContent}
        hasAnalysis={hasAnalysis}
        hasOptimizationResult={hasOptimizationResult}
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
          content={content}
          onApplyOptimization={handleApplyOptimization}
          elements={parsedElements}
          result={result}
          onNavigateToOptimize={() => setActiveTab('optimize')}
        />
      )}

      {activeTab === 'architecture' && (
        <ArchitectureTab
          hasResults={hasAnalysis}
          chunks={layoutChunks}
          chunkScores={result?.chunkScores || []}
          keywords={keywords}
          onGoToResults={() => setActiveTab('results')}
          onNavigateToChunk={(idx) => {
            setActiveTab('results');
            // The ResultsTab will handle selecting the chunk
          }}
        />
      )}

      {activeTab === 'optimize' && (
        <OptimizeTab
          hasResults={hasAnalysis}
          content={content}
          keywords={keywords}
          currentScores={result?.chunkScores}
          onApplyOptimization={handleApplyOptimization}
          onGoToAnalyze={() => setActiveTab('analyze')}
          onReanalyze={handleAnalyze}
          onSaveProject={handleSave}
          onOptimizationComplete={handleOptimizationComplete}
        />
      )}

      {activeTab === 'report' && (
        <ReportTab
          hasOptimizationResult={hasOptimizationResult}
          optimizationResult={optimizationResult}
          optimizedContent={optimizedContent}
          originalContent={content}
          keywords={keywords}
          onApplyContent={handleApplyOptimization}
          onGoToOptimize={() => setActiveTab('optimize')}
          onReanalyze={handleAnalyze}
          onSaveProject={handleSave}
        />
      )}

      {/* New Project Dialog */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Give your project a name to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={pendingProjectName}
              onChange={(e) => setPendingProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pendingProjectName.trim()) {
                  confirmNewProject();
                }
              }}
              placeholder="e.g., RPO Content Analysis"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewProjectDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmNewProject} 
              disabled={!pendingProjectName.trim()}
            >
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
