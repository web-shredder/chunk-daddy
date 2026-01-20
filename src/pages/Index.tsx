import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { TopBar, TabBar, ContentTab, AnalyzeTab, ResultsTab, ArchitectureTab, OptimizeTab, OutputsTab, ReportTab, type TabId } from "@/components/moonbug";
import { useApiKey } from "@/hooks/useApiKey";
import { useAnalysis, type AnalysisResult } from "@/hooks/useAnalysis";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { parseMarkdown, createLayoutAwareChunks, type LayoutAwareChunk, type ChunkerOptions, type DocumentElement } from "@/lib/layout-chunker";
import type { FullOptimizationResult, ArchitectureAnalysis, ArchitectureTask, FanoutIntentType, ContentBrief } from "@/lib/optimizer-types";
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
  // Track intent types for queries (from fanout)
  const [queryIntentTypes, setQueryIntentTypes] = useState<Record<string, FanoutIntentType>>({});
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
  const [architectureAnalysis, setArchitectureAnalysis] = useState<ArchitectureAnalysis | null>(null);
  const [architectureTasks, setArchitectureTasks] = useState<ArchitectureTask[]>([]);
  const [architectureLoading, setArchitectureLoading] = useState(false);
  
  // Optimization review state (lifted from OptimizeTab)
  const [optimizeViewState, setOptimizeViewState] = useState<'assignment' | 'optimizing' | 'review'>('assignment');
  const [acceptedChunks, setAcceptedChunks] = useState<Set<number>>(new Set());
  const [rejectedChunks, setRejectedChunks] = useState<Set<number>>(new Set());
  const [editedChunks, setEditedChunks] = useState<Map<number, string>>(new Map());
  
  // Streaming optimization state
  interface StreamedChunk {
    chunk_number: number;
    original_text: string;
    optimized_text: string;
    assignedQuery?: string;
    heading?: string;
    originalScore?: number;
    optimizedScore?: number;
    scoreChange?: number;
    explanation?: string;
  }
  
  const [isStreamingOptimization, setIsStreamingOptimization] = useState(false);
  const [streamingStep, setStreamingStep] = useState('');
  const [streamingProgress, setStreamingProgress] = useState(0);
  const [streamedArchitectureTasks, setStreamedArchitectureTasks] = useState<ArchitectureTask[]>([]);
  const [streamedChunks, setStreamedChunks] = useState<StreamedChunk[]>([]);
  const [streamedBriefs, setStreamedBriefs] = useState<ContentBrief[]>([]);
  
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
          // Restore review state - auto-accept all chunks if there's a result
          if (optResult.optimizedChunks) {
            setAcceptedChunks(new Set(optResult.optimizedChunks.map((_, i) => i)));
            setOptimizeViewState('review');
          }
        } else {
          setOptimizationResult(null);
          // Reset review state
          setOptimizeViewState('assignment');
          setAcceptedChunks(new Set());
          setRejectedChunks(new Set());
          setEditedChunks(new Map());
        }
        
        // Restore architecture analysis if it exists
        if (currentProject.architecture_analysis) {
          setArchitectureAnalysis(currentProject.architecture_analysis);
        } else {
          setArchitectureAnalysis(null);
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
          setArchitectureAnalysis(null);
        }
      }
      // When saving (same project ID), don't touch the local state
      // The save already captures current state, no need to restore it
    }
  }, [currentProject, setResultFromProject, reset, chunkerOptions]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    markUnsaved(newContent, keywords, chunkerOptions, result, optimizedContent, optimizationResult, architectureAnalysis);
  }, [keywords, chunkerOptions, result, optimizedContent, optimizationResult, architectureAnalysis, markUnsaved]);

  const handleKeywordsChange = useCallback((newKeywords: string[], intentTypes?: Record<string, FanoutIntentType>) => {
    setKeywords(newKeywords);
    // Merge new intent types with existing ones
    if (intentTypes) {
      setQueryIntentTypes(prev => ({ ...prev, ...intentTypes }));
    }
    markUnsaved(content, newKeywords, chunkerOptions, result, optimizedContent, optimizationResult, architectureAnalysis);
  }, [content, chunkerOptions, result, optimizedContent, optimizationResult, architectureAnalysis, markUnsaved]);

  const handleSettingsChange = useCallback((newOptions: ChunkerOptions) => {
    setChunkerOptions(newOptions);
    markUnsaved(content, keywords, newOptions, result, optimizedContent, optimizationResult, architectureAnalysis);
  }, [content, keywords, result, optimizedContent, optimizationResult, architectureAnalysis, markUnsaved]);

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
    setQueryIntentTypes({});
    setChunkerOptions({ maxChunkSize: 512, chunkOverlap: 50, cascadeHeadings: true });
    reset();
    setParsedElements([]);
    setLayoutChunks([]);
    setOptimizedContent("");
    setOptimizationResult(null);
    setArchitectureAnalysis(null);
    // Reset optimization review state
    setOptimizeViewState('assignment');
    setAcceptedChunks(new Set());
    setRejectedChunks(new Set());
    setEditedChunks(new Map());
    
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
      optimizationResult,
      architectureAnalysis
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
    markUnsaved(newOptimizedContent, keywords, chunkerOptions, result, newOptimizedContent, optimizationResult, architectureAnalysis);
    // Switch to content tab to show the new content
    setActiveTab('content');
  }, [keywords, chunkerOptions, result, optimizationResult, architectureAnalysis, markUnsaved]);
  
  const handleOptimizationComplete = useCallback((optResult: FullOptimizationResult, finalContent: string) => {
    setOptimizationResult(optResult);
    setOptimizedContent(finalContent);
    // Save to project with optimization data
    markUnsaved(content, keywords, chunkerOptions, result, finalContent, optResult, architectureAnalysis);
    // Navigate to report tab
    setActiveTab('report');
  }, [content, keywords, chunkerOptions, result, architectureAnalysis, markUnsaved]);

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
        hasOutputs={streamedChunks.length > 0 || streamedArchitectureTasks.length > 0 || streamedBriefs.length > 0}
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
          chunkerOptions={chunkerOptions}
          onOptionsChange={handleSettingsChange}
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
          queryIntentTypes={queryIntentTypes}
          contentModified={contentModified}
          onReanalyze={handleAnalyze}
          onGoToAnalyze={() => setActiveTab('analyze')}
          content={content}
          onApplyOptimization={handleApplyOptimization}
          elements={parsedElements}
          result={result}
          onNavigateToOptimize={() => setActiveTab('architecture')}
        />
      )}

      {activeTab === 'architecture' && (
        <ArchitectureTab
          hasResults={hasAnalysis}
          chunks={layoutChunks}
          chunkScores={result?.chunkScores || []}
          keywords={keywords}
          originalContent={content}
          onGoToResults={() => setActiveTab('results')}
          onNavigateToChunk={(idx) => {
            setActiveTab('results');
          }}
          onNavigateToOptimize={() => setActiveTab('optimize')}
          analysis={architectureAnalysis}
          onAnalysisUpdate={(newAnalysis) => {
            setArchitectureAnalysis(newAnalysis);
            if (newAnalysis) {
              markUnsaved(content, keywords, chunkerOptions, result, optimizedContent, optimizationResult, newAnalysis);
            }
          }}
          isAnalyzing={architectureLoading}
          onAnalyzingChange={setArchitectureLoading}
          architectureTasks={architectureTasks}
          onTasksChange={(tasks) => {
            setArchitectureTasks(tasks);
            markUnsaved(content, keywords, chunkerOptions, result, optimizedContent, optimizationResult, architectureAnalysis);
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
          onOptimizationComplete={handleOptimizationComplete}
          // Architecture tasks
          selectedArchitectureTasks={architectureTasks.filter(t => t.isSelected)}
          // Lifted state props
          viewState={optimizeViewState}
          onViewStateChange={setOptimizeViewState}
          optimizationResult={optimizationResult}
          onOptimizationResultChange={setOptimizationResult}
          optimizedContent={optimizedContent}
          onOptimizedContentChange={setOptimizedContent}
          acceptedChunks={acceptedChunks}
          onAcceptedChunksChange={setAcceptedChunks}
          rejectedChunks={rejectedChunks}
          onRejectedChunksChange={setRejectedChunks}
          editedChunks={editedChunks}
          onEditedChunksChange={setEditedChunks}
        />
      )}

      {activeTab === 'outputs' && (
        <OutputsTab
          isOptimizing={isStreamingOptimization}
          currentStep={streamingStep}
          progress={streamingProgress}
          appliedArchitectureTasks={streamedArchitectureTasks}
          optimizedChunks={streamedChunks}
          generatedBriefs={streamedBriefs}
          onApplyChanges={() => {
            // Apply optimized content
            if (streamedChunks.length > 0) {
              const optimizedText = streamedChunks.map(c => c.optimized_text).join('\n\n');
              handleApplyOptimization(optimizedText);
            }
          }}
          onCopyContent={() => {
            const text = streamedChunks.map(c => c.optimized_text).join('\n\n');
            navigator.clipboard.writeText(text);
          }}
          onExportReport={() => {
            // Export as JSON
            const report = {
              timestamp: new Date().toISOString(),
              architectureTasks: streamedArchitectureTasks,
              chunks: streamedChunks,
              briefs: streamedBriefs,
            };
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `optimization-report-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          onGoToOptimize={() => setActiveTab('optimize')}
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
