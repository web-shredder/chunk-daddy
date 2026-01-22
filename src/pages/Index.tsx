import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TopBar, DebugPanel, WorkflowStepper, ContentTab, AnalyzeTab, ResultsTab, ArchitectureTab, OptimizeTab, OutputsTab, ReportTab, type WorkflowStep } from "@/components/moonbug";
import { DebugProvider, useDebug } from "@/contexts/DebugContext";
import { useApiKey } from "@/hooks/useApiKey";
import { useAnalysis, type AnalysisResult } from "@/hooks/useAnalysis";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useStreamingDebug } from "@/hooks/useStreamingDebug";
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

  const [activeTab, setActiveTab] = useState<string>('content');
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
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
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
    originalChunkIndex: number; // 0-indexed position in layoutChunks
    original_text: string;
    optimized_text: string;
    assignedQuery?: string;
    heading?: string;
    originalScore?: number;
    optimizedScore?: number;
    scoreChange?: number;
    explanation?: string;
    thinking?: string;
    // Verification results (populated after verify_optimizations)
    beforeScores?: { semantic: number; lexical: number; citation: number; composite: number };
    afterScores?: { semantic: number; lexical: number; citation: number; composite: number };
    deltas?: { semantic: number; lexical: number; citation: number; composite: number };
    improved?: boolean;
    verified?: boolean;
    changes_applied?: Array<{ type: string; description: string }>;
    unaddressable?: string[];
  }
  
  // Verification result types
  interface UnchangedChunkResult {
    chunkIndex: number;
    heading: string;
    reason: 'no_assignment' | 'user_excluded' | 'already_optimal';
    currentScores: { semantic: number; lexical: number; citation: number; composite: number };
    bestMatchingQuery: string;
    bestMatchScore: number;
  }
  
  interface VerificationSummary {
    totalChunks: number;
    optimizedCount: number;
    unchangedCount: number;
    avgCompositeBefore: number;
    avgCompositeAfter: number;
    avgImprovement: number;
    chunksImproved: number;
    chunksDeclined: number;
    queryCoverage: {
      total: number;
      wellCovered: number;
      partiallyCovered: number;
      gaps: number;
      gapQueries: string[];
    };
  }
  
  interface ArchitectureApplicationContext {
    tasksApplied: ArchitectureTask[];
    originalChunkCount: number;
    structureChanged: boolean;
  }
  
  const [isStreamingOptimization, setIsStreamingOptimization] = useState(false);
  const [streamingStep, setStreamingStep] = useState('');
  const [streamingProgress, setStreamingProgress] = useState(0);
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const [streamedArchitectureTasks, setStreamedArchitectureTasks] = useState<ArchitectureTask[]>([]);
  const [streamedChunks, setStreamedChunks] = useState<StreamedChunk[]>([]);
  const [streamedBriefs, setStreamedBriefs] = useState<ContentBrief[]>([]);
  
  // Verification state
  const [unchangedChunksContext, setUnchangedChunksContext] = useState<UnchangedChunkResult[]>([]);
  const [verificationSummary, setVerificationSummary] = useState<VerificationSummary | null>(null);
  const [architectureContext, setArchitectureContext] = useState<ArchitectureApplicationContext | null>(null);
  const [originalLayoutChunkCount, setOriginalLayoutChunkCount] = useState<number>(0);
  
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
          const projectContent = currentProject.content || "";
          const elements = parseMarkdown(projectContent);
          const chunks = createLayoutAwareChunks(projectContent, settings);
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
    const chunks = createLayoutAwareChunks(content, chunkerOptions);
    setParsedElements(elements);
    setLayoutChunks(chunks);
    setActiveTab('analyze');
  };

  const handleAnalyze = () => {
    const elements = parseMarkdown(content);
    const chunks = createLayoutAwareChunks(content, chunkerOptions);
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

  // Streaming optimization handler - connects to optimize-content-stream SSE edge function
  // Debug logging is handled via the debugLogRef which gets set by StreamingDebugLogger component
  const debugLogRef = useRef<{
    logStreamingStart: (plan: { applyArchitecture: boolean; architectureTasksCount: number; generateBriefs: boolean; unassignedQueriesCount: number; chunkAssignmentsCount: number }) => void;
    logArchitectureEvent: (eventType: string, data: Record<string, unknown>) => void;
    logChunkEvent: (eventType: string, data: Record<string, unknown>) => void;
    logBriefEvent: (eventType: string, data: Record<string, unknown>) => void;
    logStreamingComplete: () => void;
    logStreamingError: (error: Error | string, context?: Record<string, unknown>) => void;
    logSSEParseError: (line: string, error: Error) => void;
  } | null>(null);

  const handleStreamingOptimization = useCallback(async (params: {
    applyArchitecture: boolean;
    architectureTasks: ArchitectureTask[];
    generateBriefs: boolean;
    unassignedQueries: string[];
    chunkAssignments: Array<{ chunkIndex: number; query: string }>;
  }) => {
    const { applyArchitecture, architectureTasks, generateBriefs, unassignedQueries, chunkAssignments } = params;
    const debug = debugLogRef.current;
    
    // Build set of expected chunk indices for validation (assignment-only enforcement)
    const expectedChunkIndices = new Set(chunkAssignments.map(ca => ca.chunkIndex));
    
    // Log streaming start
    debug?.logStreamingStart({
      applyArchitecture,
      architectureTasksCount: architectureTasks.filter(t => t.isSelected && t.type !== 'content_gap').length,
      generateBriefs,
      unassignedQueriesCount: unassignedQueries.length,
      chunkAssignmentsCount: chunkAssignments.length,
    });
    
    // Reset streaming state (including any previous error)
    setStreamedArchitectureTasks([]);
    setStreamedChunks([]);
    setStreamedBriefs([]);
    setStreamingProgress(0);
    setStreamingError(null);
    setIsStreamingOptimization(true);
    // Reset verification state
    setUnchangedChunksContext([]);
    setVerificationSummary(null);
    setArchitectureContext(null);
    
    // Auto-switch to outputs tab
    setActiveTab('outputs');
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    // Track accumulated results for final persistence
    const accumulatedArchitectureTasks: ArchitectureTask[] = [];
    const accumulatedChunks: StreamedChunk[] = [];
    const accumulatedBriefs: ContentBrief[] = [];
    let streamingFailed = false;
    let failureReason = '';
    
    // Track original chunk count BEFORE architecture changes
    setOriginalLayoutChunkCount(layoutChunks.length);
    
    try {
      let processedContent = content;
      
      // Step 1: Apply architecture tasks (if enabled)
      if (applyArchitecture && architectureTasks.length > 0) {
        setStreamingStep('Applying architecture fixes...');
        
        const selectedTasks = architectureTasks.filter(t => t.isSelected && t.type !== 'content_gap');
        
        if (selectedTasks.length > 0) {
          const response = await fetch(`${supabaseUrl}/functions/v1/optimize-content-stream`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'apply_architecture_stream',
              content: processedContent,
              tasks: selectedTasks,
            }),
          });

          // STRICT ERROR HANDLING: Check response status before reading stream
          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            debug?.logStreamingError(`HTTP ${response.status}`, { phase: 'architecture', body: errorText });
            streamingFailed = true;
            failureReason = `Architecture phase failed: HTTP ${response.status}`;
            throw new Error(failureReason);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (reader) {
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    
                    // Check for error events from edge function
                    if (data.type === 'error') {
                      debug?.logStreamingError(data.message, { phase: 'architecture' });
                      streamingFailed = true;
                      failureReason = `Architecture error: ${data.message}`;
                      throw new Error(failureReason);
                    }
                    
                    // Log all SSE events
                    debug?.logArchitectureEvent(data.type, data);
                    
                    if (data.type === 'task_started') {
                      setStreamingStep(`Applying fix ${data.taskIndex + 1}/${data.totalTasks}...`);
                      setStreamingProgress(Math.round((data.taskIndex / data.totalTasks) * 20));
                    } else if (data.type === 'task_applied') {
                      const appliedTask = selectedTasks.find(t => t.id === data.taskId);
                      if (appliedTask) {
                        accumulatedArchitectureTasks.push(appliedTask);
                        setStreamedArchitectureTasks(prev => [...prev, appliedTask]);
                      }
                    } else if (data.type === 'architecture_complete') {
                      processedContent = data.finalContent || processedContent;
                    }
                  } catch (e) {
                    if (streamingFailed) throw e; // Re-throw if we already set failure
                    debug?.logSSEParseError(line, e as Error);
                    console.error('Failed to parse SSE event:', e);
                  }
                }
              }
            }
          }
        }
      }
      
      // Step 2: Optimize chunks (ONLY assigned chunks)
      if (chunkAssignments.length > 0) {
        setStreamingStep('Optimizing chunks...');
        setStreamingProgress(20);
        
        // ENFORCEMENT: Only send assigned chunk texts, not all chunks
        // Build array with only the chunks that have assignments
        const assignedChunkData = chunkAssignments.map(ca => ({
          originalIndex: ca.chunkIndex,
          text: layoutChunks[ca.chunkIndex]?.text || '',
          query: ca.query,
        }));
        
        const response = await fetch(`${supabaseUrl}/functions/v1/optimize-content-stream`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'optimize_chunks_stream',
            // Send only assigned chunks with their original indices
            chunks: assignedChunkData.map(cd => cd.text),
            queryAssignments: assignedChunkData.map((cd, idx) => ({
              chunkIndex: idx, // Index within the filtered array
              originalChunkIndex: cd.originalIndex, // Original index in layoutChunks
              queries: [cd.query],
            })),
          }),
        });

        // STRICT ERROR HANDLING
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          debug?.logStreamingError(`HTTP ${response.status}`, { phase: 'chunks', body: errorText });
          streamingFailed = true;
          failureReason = `Chunk optimization failed: HTTP ${response.status}`;
          throw new Error(failureReason);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  // Check for error events
                  if (data.type === 'error') {
                    debug?.logStreamingError(data.message, { phase: 'chunks' });
                    streamingFailed = true;
                    failureReason = `Chunk error: ${data.message}`;
                    throw new Error(failureReason);
                  }
                  
                  // Log all SSE events
                  debug?.logChunkEvent(data.type, data);
                  
                  if (data.type === 'chunk_started') {
                    setStreamingStep(`Optimizing chunk ${data.chunkNumber} of ${data.total}...`);
                    setStreamingProgress(20 + Math.round((data.progress / 100) * 50));
                  } else if (data.type === 'chunk_optimized') {
                    // Use originalChunkIndex from the server (already filtered to assignments)
                    const originalChunkIndex = data.originalChunkIndex ?? data.chunkIndex;
                    
                    // ENFORCEMENT: Skip if this chunk wasn't in our expected set
                    if (!expectedChunkIndices.has(originalChunkIndex)) {
                      console.warn('Dropping unexpected chunk:', {
                        receivedIndex: originalChunkIndex,
                        expectedIndices: Array.from(expectedChunkIndices),
                        reason: 'Not in assignment plan',
                      });
                      debug?.logChunkEvent('chunk_skipped_unexpected', { 
                        chunkIndex: originalChunkIndex,
                        expected: Array.from(expectedChunkIndices),
                      });
                      continue;
                    }
                    
                    const newChunk: StreamedChunk = {
                      chunk_number: originalChunkIndex + 1, // 1-indexed for display
                      originalChunkIndex, // 0-indexed for mapping back to layoutChunks
                      original_text: data.originalText,
                      optimized_text: data.optimizedText,
                      assignedQuery: data.query,
                      heading: layoutChunks[originalChunkIndex]?.headingPath?.slice(-1)[0] || undefined,
                    };
                    accumulatedChunks.push(newChunk);
                    setStreamedChunks(prev => [...prev, newChunk]);
                    setStreamingProgress(20 + Math.round((data.progress / 100) * 50));
                    
                    debug?.logChunkEvent('chunk_accepted', {
                      chunkIndex: originalChunkIndex,
                      query: data.query?.slice(0, 50),
                      position: `${data.index + 1}/${data.total}`,
                    });
                  } else if (data.type === 'chunks_complete') {
                    debug?.logChunkEvent('chunks_complete', { 
                      expected: expectedChunkIndices.size,
                      received: accumulatedChunks.length,
                      serverProcessed: data.totalProcessed,
                    });
                  }
                } catch (e) {
                  if (streamingFailed) throw e;
                  debug?.logSSEParseError(line, e as Error);
                  console.error('Failed to parse SSE event:', e);
                }
              }
            }
          }
        }
      }
      
      // Step 3: Generate content briefs (if enabled)
      if (generateBriefs && unassignedQueries.length > 0) {
        setStreamingStep('Generating content briefs...');
        setStreamingProgress(70);
        
        const response = await fetch(`${supabaseUrl}/functions/v1/optimize-content-stream`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'generate_briefs_stream',
            queries: unassignedQueries,
            existingChunks: layoutChunks.map(c => ({
              heading: c.headingPath?.slice(-1)[0] || '',
              preview: c.text.slice(0, 200),
            })),
          }),
        });

        // STRICT ERROR HANDLING
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          debug?.logStreamingError(`HTTP ${response.status}`, { phase: 'briefs', body: errorText });
          streamingFailed = true;
          failureReason = `Brief generation failed: HTTP ${response.status}`;
          throw new Error(failureReason);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  // Check for error events
                  if (data.type === 'error') {
                    debug?.logStreamingError(data.message, { phase: 'briefs' });
                    streamingFailed = true;
                    failureReason = `Brief error: ${data.message}`;
                    throw new Error(failureReason);
                  }
                  
                  // Log all SSE events
                  debug?.logBriefEvent(data.type, data);
                  
                  if (data.type === 'brief_started') {
                    setStreamingStep(`Generating brief ${data.index + 1}/${data.total}...`);
                    setStreamingProgress(70 + Math.round(((data.index) / data.total) * 25));
                  } else if (data.type === 'brief_generated') {
                    accumulatedBriefs.push(data.brief);
                    setStreamedBriefs(prev => [...prev, data.brief]);
                    setStreamingProgress(70 + Math.round(((data.index + 1) / data.total) * 25));
                  } else if (data.type === 'briefs_complete') {
                    debug?.logBriefEvent('briefs_complete', {
                      expected: unassignedQueries.length,
                      received: accumulatedBriefs.length,
                    });
                  }
                } catch (e) {
                  if (streamingFailed) throw e;
                  debug?.logSSEParseError(line, e as Error);
                  console.error('Failed to parse SSE event:', e);
                }
              }
            }
          }
        }
      }
      
      // Step 4: Verify optimizations (compare before/after with proper cascade reconstruction)
      if (accumulatedChunks.length > 0) {
        setStreamingStep('Verifying improvements...');
        setStreamingProgress(95);
        
        // Helper to determine exclude reason for a chunk
        const getExcludeReason = (chunkIndex: number): 'no_assignment' | 'user_excluded' | 'already_optimal' | undefined => {
          const wasOptimized = accumulatedChunks.some(c => c.originalChunkIndex === chunkIndex);
          if (wasOptimized) return undefined;
          
          // Check if it had an assignment
          const hadAssignment = chunkAssignments.some(ca => ca.chunkIndex === chunkIndex);
          if (!hadAssignment) return 'no_assignment';
          
          // Could add more logic for user_excluded or already_optimal
          return 'no_assignment';
        };
        
        const verificationPayload = {
          type: 'verify_optimizations',
          optimizedChunks: accumulatedChunks.map(c => ({
            originalChunkIndex: c.originalChunkIndex,
            optimized_text: c.optimized_text,
            query: c.assignedQuery || '',
            changes: c.changes_applied || [],
            unaddressable: c.unaddressable || [],
          })),
          allChunks: layoutChunks.map((chunk, i) => ({
            index: i,
            text: chunk.text,
            textWithoutCascade: chunk.textWithoutCascade,
            headingPath: chunk.headingPath || [],
            wasOptimized: accumulatedChunks.some(c => c.originalChunkIndex === i),
            excludeReason: getExcludeReason(i),
          })),
          queries: keywords,
          architectureApplied: applyArchitecture && accumulatedArchitectureTasks.length > 0
            ? {
                tasksApplied: accumulatedArchitectureTasks,
                originalChunkCount: originalLayoutChunkCount || layoutChunks.length,
                structureChanged: true,
              }
            : undefined,
        };
        
        const verifyResponse = await fetch(`${supabaseUrl}/functions/v1/optimize-content-stream`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(verificationPayload),
        });
        
        if (verifyResponse.ok) {
          const verifyReader = verifyResponse.body?.getReader();
          const verifyDecoder = new TextDecoder();
          
          if (verifyReader) {
            let verifyBuffer = '';
            while (true) {
              const { done, value } = await verifyReader.read();
              if (done) break;
              
              verifyBuffer += verifyDecoder.decode(value, { stream: true });
              const lines = verifyBuffer.split('\n');
              verifyBuffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    
                    if (data.type === 'chunk_verified') {
                      // Update accumulated chunk with verified scores
                      const verifiedResult = data.result;
                      const chunkIdx = accumulatedChunks.findIndex(
                        c => c.originalChunkIndex === verifiedResult.chunkIndex
                      );
                      if (chunkIdx >= 0) {
                        accumulatedChunks[chunkIdx].beforeScores = verifiedResult.before;
                        accumulatedChunks[chunkIdx].afterScores = verifiedResult.after;
                        accumulatedChunks[chunkIdx].deltas = verifiedResult.delta;
                        accumulatedChunks[chunkIdx].improved = verifiedResult.improved;
                        accumulatedChunks[chunkIdx].verified = true;
                        // Convert string changes to object format
                        accumulatedChunks[chunkIdx].changes_applied = (verifiedResult.changes || []).map(
                          (change: string | { type?: string; description?: string }) => {
                            if (typeof change === 'string') {
                              return { type: 'optimization', description: change };
                            }
                            return { 
                              type: change.type || 'optimization', 
                              description: change.description || '' 
                            };
                          }
                        );
                        accumulatedChunks[chunkIdx].unaddressable = verifiedResult.unaddressable;
                        
                        // Update streamed chunks state for UI
                        setStreamedChunks([...accumulatedChunks]);
                      }
                      setStreamingProgress(95 + Math.round((data.index / data.total) * 3));
                    } else if (data.type === 'unchanged_chunks') {
                      setUnchangedChunksContext(data.chunks);
                    } else if (data.type === 'verification_complete') {
                      setVerificationSummary(data.summary);
                      if (data.architectureApplied) {
                        setArchitectureContext(data.architectureApplied);
                      }
                      console.log('Verification complete:', data.summary);
                    }
                  } catch (e) {
                    console.warn('Failed to parse verification event:', e);
                  }
                }
              }
            }
          }
        } else {
          console.warn('Verification request failed, continuing without verification scores');
        }
      }
      
      // ============== PERSIST STREAMED RESULTS ==============
      // Build a FullOptimizationResult from accumulated streaming data
      const streamedResult: FullOptimizationResult = {
        analysis: { topic_segments: [], optimization_opportunities: [] },
        optimizedChunks: accumulatedChunks.map((chunk) => ({
          chunk_number: chunk.chunk_number,
          originalChunkIndex: chunk.originalChunkIndex,
          heading: chunk.heading,
          original_text: chunk.original_text,
          optimized_text: chunk.optimized_text,
          // Convert string changes to ValidatedChange objects
          changes_applied: (chunk.changes_applied || []).map((change, idx) => ({
            change_id: `change_${chunk.originalChunkIndex}_${idx}`,
            change_type: 'add_context' as const,
            before: '',
            after: '',
            reason: typeof change === 'string' ? change : (change as { description?: string }).description || '',
            expected_improvement: '',
          })),
          query: chunk.assignedQuery,
          // Include verification data in persisted result  
          beforeScores: chunk.beforeScores,
          afterScores: chunk.afterScores,
          deltas: chunk.deltas,
          improved: chunk.improved,
          verified: chunk.verified,
          unaddressable: chunk.unaddressable,
        })),
        explanations: [],
        originalContent: content,
        timestamp: new Date(),
        contentBriefs: accumulatedBriefs,
        allOriginalChunks: layoutChunks.map((lc, idx) => ({
          index: idx,
          text: lc.text,
          textWithoutCascade: lc.textWithoutCascade,
          heading: lc.headingPath?.slice(-1)[0] || null,
          headingPath: lc.headingPath || [],
        })),
        appliedArchitectureTasks: applyArchitecture ? accumulatedArchitectureTasks : [],
        // Include verification summary
        verificationSummary: verificationSummary || undefined,
        unchangedChunks: unchangedChunksContext.length > 0 ? unchangedChunksContext : undefined,
      };
      
      // Build optimized content from streamed chunks using originalChunkIndex
      const optimizedChunkMap = new Map<number, string>();
      accumulatedChunks.forEach(chunk => {
        optimizedChunkMap.set(chunk.originalChunkIndex, chunk.optimized_text);
      });
      
      // Reconstruct full document - merge optimized chunks with unchanged originals
      const reconstructedContent = layoutChunks.map((lc, idx) => {
        const heading = lc.headingPath?.slice(-1)[0];
        const body = optimizedChunkMap.has(idx) 
          ? optimizedChunkMap.get(idx)!
          : lc.textWithoutCascade;
        return heading ? `## ${heading}\n\n${body}` : body;
      }).join('\n\n');
      
      console.log('Reconstructed document:', {
        totalChunks: layoutChunks.length,
        optimizedChunks: optimizedChunkMap.size,
        unchangedChunks: layoutChunks.length - optimizedChunkMap.size,
        finalLength: reconstructedContent.length,
        briefsGenerated: accumulatedBriefs.length,
        architectureTasksApplied: accumulatedArchitectureTasks.length,
        verificationComplete: !!verificationSummary,
      });
      
      // Save to state
      setOptimizationResult(streamedResult);
      setOptimizedContent(reconstructedContent);
      
      // Mark project as having changes
      markUnsaved(content, keywords, chunkerOptions, result, reconstructedContent, streamedResult, architectureAnalysis);
      
      // Log completion with mismatch detection
      debug?.logStreamingComplete();
      const mismatch = {
        architecture: {
          expected: applyArchitecture ? architectureTasks.filter(t => t.isSelected && t.type !== 'content_gap').length : 0,
          received: accumulatedArchitectureTasks.length,
        },
        chunks: {
          expected: chunkAssignments.length,
          received: accumulatedChunks.length,
        },
        briefs: {
          expected: generateBriefs ? unassignedQueries.length : 0,
          received: accumulatedBriefs.length,
        },
      };
      console.log('Streaming complete - mismatch check:', mismatch);
      
      // Complete
      setStreamingStep('Optimization complete!');
      setStreamingProgress(100);
      setIsStreamingOptimization(false);
      
      // Success feedback
      toast.success(`Optimization complete: ${accumulatedChunks.length} chunks optimized${accumulatedBriefs.length > 0 ? `, ${accumulatedBriefs.length} briefs generated` : ''}`);
      
    } catch (error) {
      const errorMessage = failureReason || (error instanceof Error ? error.message : 'Unknown error');
      
      console.error('Streaming optimization error:', {
        error,
        failureReason,
        step: streamingStep,
        progress: streamingProgress,
        accumulated: {
          architectureTasks: accumulatedArchitectureTasks.length,
          chunks: accumulatedChunks.length,
          briefs: accumulatedBriefs.length,
        },
      });
      
      debug?.logStreamingError(error as Error, { 
        step: streamingStep, 
        progress: streamingProgress,
        accumulated: {
          architectureTasks: accumulatedArchitectureTasks.length,
          chunks: accumulatedChunks.length,
          briefs: accumulatedBriefs.length,
        }
      });
      
      // Set error state for UI display
      setStreamingError(errorMessage);
      setStreamingStep('');
      setStreamingProgress(0);
      setIsStreamingOptimization(false);
      
      // Show toast notification
      toast.error(`Optimization failed: ${errorMessage}`);
      
      // Don't save partial results - stay on outputs tab showing error state
    }
  }, [content, layoutChunks, keywords, chunkerOptions, result, architectureAnalysis, markUnsaved]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const tokenCount = Math.ceil(wordCount * 1.3);
  const hasContent = content.trim().length > 0;
  const hasChunks = layoutChunks.length > 0;
  const hasAnalysis = !!result;
  const hasOptimizationResult = !!optimizationResult;
  const contentModified = hasAnalysis && content !== contentHashAtAnalysis;
  const hasOutputs = streamedChunks.length > 0 || streamedArchitectureTasks.length > 0 || streamedBriefs.length > 0;

  // Workflow steps definition
  const WORKFLOW_STEPS: WorkflowStep[] = [
    { id: 'content', label: 'Content' },
    { id: 'analyze', label: 'Queries', shortLabel: 'Queries' },
    { id: 'results', label: 'Chunk Analysis', shortLabel: 'Analysis' },
    { id: 'architecture', label: 'Structure', shortLabel: 'Structure' },
    { id: 'optimize', label: 'Optimization', shortLabel: 'Optimize' },
    { id: 'outputs', label: 'Outputs' },
    { id: 'report', label: 'Final Report', shortLabel: 'Report' },
  ];

  // Compute completed steps based on state
  const completedStepIds = (() => {
    const completed: string[] = [];
    if (hasContent) completed.push('content');
    if (keywords.length > 0) completed.push('analyze');
    if (hasAnalysis) completed.push('results');
    if (architectureAnalysis) completed.push('architecture');
    if (hasOptimizationResult) completed.push('optimize');
    if (hasOutputs) completed.push('outputs');
    return completed;
  })();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <DebugProvider currentTab={activeTab}>
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
      
      <WorkflowStepper
        steps={WORKFLOW_STEPS}
        currentStepId={activeTab}
        completedStepIds={completedStepIds}
        onStepClick={setActiveTab}
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
          sourceUrl={sourceUrl}
          onSourceUrlChange={setSourceUrl}
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
          content={content}
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
          // Streaming optimization
          onStreamingOptimize={handleStreamingOptimization}
          isStreamingOptimization={isStreamingOptimization}
          streamingStep={streamingStep}
          streamingProgress={streamingProgress}
        />
      )}

      {activeTab === 'outputs' && (
        <OutputsTab
          isOptimizing={isStreamingOptimization}
          currentStep={streamingStep}
          progress={streamingProgress}
          error={streamingError}
          appliedArchitectureTasks={streamedArchitectureTasks}
          optimizedChunks={streamedChunks}
          generatedBriefs={streamedBriefs}
          verificationSummary={verificationSummary}
          onApplyChanges={() => {
            // Apply optimized content using the reconstructed document
            if (optimizedContent) {
              handleApplyOptimization(optimizedContent);
            } else if (streamedChunks.length > 0) {
              const optimizedText = streamedChunks.map(c => c.optimized_text).join('\n\n');
              handleApplyOptimization(optimizedText);
            }
          }}
          onCopyContent={() => {
            const text = optimizedContent || streamedChunks.map(c => c.optimized_text).join('\n\n');
            navigator.clipboard.writeText(text);
          }}
          onExportReport={() => {
            // Export as JSON
            const report = {
              timestamp: new Date().toISOString(),
              architectureTasks: streamedArchitectureTasks,
              chunks: streamedChunks,
              briefs: streamedBriefs,
              verificationSummary,
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
          onGoToReport={() => setActiveTab('report')}
          onRetry={() => {
            setStreamingError(null);
            setActiveTab('optimize');
          }}
          onViewInDocument={(chunkIndex) => {
            // Navigate to the chunk in the content tab
            setActiveTab('content');
            // Could add scroll-to-chunk functionality here
          }}
        />
      )}

      {activeTab === 'report' && (
        <ReportTab
          hasOptimizationResult={hasOptimizationResult}
          optimizationResult={optimizationResult}
          optimizedContent={optimizedContent}
          originalContent={content}
          keywords={keywords}
          layoutChunks={layoutChunks}
          onApplyContent={handleApplyOptimization}
          onGoToOptimize={() => setActiveTab('optimization')}
          onReanalyze={handleAnalyze}
          onSaveProject={handleSave}
          projectName={localProjectName}
          onNavigateToOutputs={(chunkIndex) => {
            setActiveTab('outputs');
            // Could store chunkIndex for highlighting in outputs tab in the future
          }}
          analysisResult={result}
          // New verified data props
          streamedChunks={streamedChunks.map(c => ({
            originalChunkIndex: c.originalChunkIndex,
            query: c.assignedQuery,
            original_text: c.original_text,
            optimized_text: c.optimized_text,
            heading: c.heading,
            changes_applied: c.changes_applied,
            unaddressable: c.unaddressable,
            thinking: c.thinking,
            beforeScores: c.beforeScores,
            afterScores: c.afterScores,
            deltas: c.deltas,
            improved: c.improved,
            verified: c.verified,
          }))}
          unchangedChunksContext={unchangedChunksContext}
          verificationSummary={verificationSummary}
          architectureContext={architectureContext}
          unassignedQueries={optimizationResult?.verificationSummary?.queryCoverage?.gapQueries || []}
          contentBriefs={streamedBriefs}
          onExportReport={(format) => {
            const report = {
              timestamp: new Date().toISOString(),
              projectName: localProjectName,
              architectureTasks: streamedArchitectureTasks,
              chunks: streamedChunks,
              briefs: streamedBriefs,
              verificationSummary,
              unchangedChunks: unchangedChunksContext,
            };
            
            if (format === 'json') {
              const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `optimization-report-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            } else if (format === 'markdown') {
              // Generate markdown report
              const lines: string[] = [
                `# Optimization Report: ${localProjectName}`,
                `Generated: ${new Date().toLocaleString()}`,
                '',
                '## Summary',
                `- Chunks Optimized: ${streamedChunks.length}`,
                `- Chunks Improved: ${verificationSummary?.chunksImproved || 0}`,
                `- Chunks Declined: ${verificationSummary?.chunksDeclined || 0}`,
                `- Content Briefs: ${streamedBriefs.length}`,
                '',
              ];
              
              if (streamedArchitectureTasks.length > 0) {
                lines.push('## Architecture Changes');
                streamedArchitectureTasks.forEach(t => {
                  lines.push(`- **${t.type}**: ${t.description}`);
                });
                lines.push('');
              }
              
              if (streamedBriefs.length > 0) {
                lines.push('## Content Briefs');
                streamedBriefs.forEach(b => {
                  lines.push(`### ${b.suggestedHeading}`);
                  lines.push(`Query: ${b.targetQuery}`);
                  lines.push(`Word count: ${b.targetWordCount.min}-${b.targetWordCount.max}`);
                  lines.push('');
                });
              }
              
              const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `optimization-report-${new Date().toISOString().slice(0, 10)}.md`;
              a.click();
              URL.revokeObjectURL(url);
            }
          }}
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

      {/* Streaming Debug Logger - connects hook to ref */}
      <StreamingDebugLogger debugLogRef={debugLogRef} />

      {/* Debug Panel - Toggle with Ctrl+Shift+D */}
      <DebugPanel
        activeTab={activeTab}
        content={content}
        keywords={keywords}
        layoutChunks={layoutChunks}
        result={result}
        architectureAnalysis={architectureAnalysis}
        architectureTasks={architectureTasks}
        optimizationResult={optimizationResult}
        optimizedContent={optimizedContent}
        completedSteps={completedStepIds}
        streaming={{
          isStreaming: isStreamingOptimization,
          progress: streamingProgress,
          currentStep: streamingStep,
          architectureTasksStreamed: streamedArchitectureTasks.length,
          chunksStreamed: streamedChunks.length,
          briefsStreamed: streamedBriefs.length,
        }}
      />
      </div>
    </DebugProvider>
  );
};

// Helper component that connects the useStreamingDebug hook to the parent's ref
// This works because it's rendered inside the DebugProvider
function StreamingDebugLogger({ debugLogRef }: { 
  debugLogRef: React.MutableRefObject<{
    logStreamingStart: (plan: { applyArchitecture: boolean; architectureTasksCount: number; generateBriefs: boolean; unassignedQueriesCount: number; chunkAssignmentsCount: number }) => void;
    logArchitectureEvent: (eventType: string, data: Record<string, unknown>) => void;
    logChunkEvent: (eventType: string, data: Record<string, unknown>) => void;
    logBriefEvent: (eventType: string, data: Record<string, unknown>) => void;
    logStreamingComplete: () => void;
    logStreamingError: (error: Error | string, context?: Record<string, unknown>) => void;
    logSSEParseError: (line: string, error: Error) => void;
  } | null>;
}) {
  const streamingDebug = useStreamingDebug();
  
  // Connect the hook functions to the ref
  useEffect(() => {
    debugLogRef.current = streamingDebug;
  }, [debugLogRef, streamingDebug]);
  
  return null;
}

export default Index;
