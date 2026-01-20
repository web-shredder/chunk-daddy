import { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Copy, 
  FileJson, 
  ArrowLeft,
  Target,
  Loader2,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DismissableTip } from '@/components/DismissableTip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { QueryAssignmentPreview } from '@/components/optimizer/QueryAssignmentPreview';
import { ChunkReviewPanel } from '@/components/optimizer/ChunkReviewPanel';
import { OptimizationPlanPanel } from './OptimizationPlanPanel';
import { useOptimizer } from '@/hooks/useOptimizer';
import { calculatePassageScore } from '@/lib/similarity';
import { 
  computeQueryAssignments, 
  type QueryAssignmentMap,
  type ChunkScoreData,
} from '@/lib/query-assignment';
import type { FullOptimizationResult, ContentBrief, ArchitectureTask } from '@/lib/optimizer-types';
import type { ChunkScore } from '@/hooks/useAnalysis';
import { supabase } from '@/integrations/supabase/client';

type OptimizeViewState = 'assignment' | 'optimizing' | 'review';

interface OptimizeTabProps {
  hasResults: boolean;
  content: string;
  keywords: string[];
  currentScores?: ChunkScore[];
  onApplyOptimization: (optimizedContent: string) => void;
  onGoToAnalyze: () => void;
  onReanalyze: () => void;
  onSaveProject?: () => void;
  onOptimizationComplete?: (result: FullOptimizationResult, finalContent: string) => void;
  chunks?: string[];
  // Architecture tasks from Architecture tab
  selectedArchitectureTasks?: ArchitectureTask[];
  // Lifted state props
  viewState: OptimizeViewState;
  onViewStateChange: (state: OptimizeViewState) => void;
  optimizationResult: FullOptimizationResult | null;
  onOptimizationResultChange: (result: FullOptimizationResult | null) => void;
  optimizedContent: string;
  onOptimizedContentChange: (content: string) => void;
  acceptedChunks: Set<number>;
  onAcceptedChunksChange: (chunks: Set<number>) => void;
  rejectedChunks: Set<number>;
  onRejectedChunksChange: (chunks: Set<number>) => void;
  editedChunks: Map<number, string>;
  onEditedChunksChange: (chunks: Map<number, string>) => void;
}

export function OptimizeTab({
  hasResults,
  content,
  keywords,
  currentScores,
  onApplyOptimization,
  onGoToAnalyze,
  onReanalyze,
  onSaveProject,
  onOptimizationComplete,
  chunks: providedChunks,
  selectedArchitectureTasks = [],
  // Lifted state
  viewState,
  onViewStateChange: setViewState,
  optimizationResult,
  onOptimizationResultChange: setOptimizationResult,
  optimizedContent,
  onOptimizedContentChange: setOptimizedContent,
  acceptedChunks,
  onAcceptedChunksChange: setAcceptedChunks,
  rejectedChunks,
  onRejectedChunksChange: setRejectedChunks,
  editedChunks,
  onEditedChunksChange: setEditedChunks,
}: OptimizeTabProps) {
  // Content brief generation state (local - not critical to persist)
  const [generatedBriefs, setGeneratedBriefs] = useState<ContentBrief[]>([]);
  
  // Feature toggles for optimization plan
  const [applyArchitecture, setApplyArchitecture] = useState(true);
  const [generateBriefs, setGenerateBriefs] = useState(true);
  
  const { step, progress, error, result, optimize, reset } = useOptimizer();

  // Compute query assignments from current scores
  const { assignmentMap, chunkScores, chunkTexts } = useMemo(() => {
    if (!currentScores || currentScores.length === 0) {
      return { 
        assignmentMap: { assignments: [], chunkAssignments: [], unassignedQueries: [] } as QueryAssignmentMap,
        chunkScores: [] as ChunkScoreData[],
        chunkTexts: [] as string[],
      };
    }

    // Convert ChunkScore[] to ChunkScoreData[] format
    const scoreData: ChunkScoreData[] = currentScores.map((cs, idx) => {
      const scores: Record<string, number> = {};
      cs.keywordScores.forEach(ks => {
        // Use Passage Score for assignment decisions
        const passageScore = calculatePassageScore(ks.scores.cosine, ks.scores.chamfer);
        scores[ks.keyword] = passageScore / 100; // Normalize to 0-1
      });
      return {
        chunkIndex: idx,
        heading: undefined, // ChunkScore doesn't have heading
        text: cs.text || '',
        scores,
      };
    });

    const texts = scoreData.map(s => s.text);
    const map = computeQueryAssignments(scoreData, keywords, 0.3);

    return { assignmentMap: map, chunkScores: scoreData, chunkTexts: texts };
  }, [currentScores, keywords]);

  const [queryAssignments, setQueryAssignments] = useState<QueryAssignmentMap>(assignmentMap);
  
  // Update assignments when analysis results change
  useMemo(() => {
    if (assignmentMap.assignments.length > 0) {
      setQueryAssignments(assignmentMap);
    }
  }, [assignmentMap]);

  // Build chunk assignments for plan panel (must be before early return)
  const planChunkAssignments = useMemo(() => {
    return queryAssignments.chunkAssignments.map(ca => ({
      chunkIndex: ca.chunkIndex,
      chunkHeading: ca.chunkHeading || '',
      assignedQuery: ca.assignedQuery?.query || null,
      currentScore: ca.assignedQuery ? Math.round(ca.assignedQuery.score * 100) : 0,
    }));
  }, [queryAssignments.chunkAssignments]);

  // Architecture tasks summary display
  const hasArchitectureTasks = selectedArchitectureTasks.length > 0;

  if (!hasResults) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="empty-state">
          <Sparkles size={48} strokeWidth={1} />
          <h3>Run analysis first</h3>
          <p>Analyze your content to enable AI-powered optimization</p>
          <button className="btn-secondary" onClick={onGoToAnalyze}>
            Go to Analyze
          </button>
        </div>
      </div>
    );
  }

  const handleAssignmentChange = (newMap: QueryAssignmentMap) => {
    setQueryAssignments(newMap);
  };

  const handleGenerateBrief = async (query: string): Promise<ContentBrief | null> => {
    try {
      const chunkSummaries = chunkTexts.map((text, i) => ({
        index: i,
        heading: chunkScores[i]?.heading || null,
        preview: text.slice(0, 200),
      }));

      const { data, error } = await supabase.functions.invoke('optimize-content', {
        body: {
          type: 'generateContentBrief',
          query,
          content,
          chunkSummaries,
        },
      });

      if (error) throw error;
      const brief = data?.result as ContentBrief;

      if (brief) {
        setGeneratedBriefs(prev => [
          ...prev.filter(b => b.targetQuery !== query),
          brief
        ]);
      }
      
      return brief;
    } catch (err) {
      console.error(`Brief generation failed for "${query}":`, err);
      toast.error(`Failed to generate brief for "${query}"`);
      return null;
    }
  };

  const handleStartOptimization = async () => {
    setViewState('optimizing');
    
    try {
      const scoresMap = currentScores?.reduce((acc, cs) => {
        cs.keywordScores.forEach(ks => {
          acc[ks.keyword] = ks.scores.cosine;
        });
        return acc;
      }, {} as Record<string, number>);

      const result = await optimize({
        content,
        queries: keywords,
        currentScores: scoresMap,
        queryAssignments,
        chunks: chunkTexts,
        useFocusedOptimization: queryAssignments.chunkAssignments.length > 0,
      });

      if (result) {
        // Merge any manually generated briefs that weren't created during optimization
        if (generatedBriefs.length > 0) {
          const autoGeneratedQueries = new Set(result.contentBriefs?.map(b => b.targetQuery) || []);
          const manualBriefs = generatedBriefs.filter(b => !autoGeneratedQueries.has(b.targetQuery));
          if (manualBriefs.length > 0) {
            result.contentBriefs = [...(result.contentBriefs || []), ...manualBriefs];
          }
        }
        
        setOptimizationResult(result);
        
        // Helper to strip any heading lines the AI might have accidentally included
        const stripAccidentalHeadings = (text: string): string => {
          return text.replace(/^(#{1,6}\s+[^\n]+\n+)+/, '').trim();
        };
        
        // Helper to format a chunk for output
        const formatChunkForOutput = (heading: string | null, body: string): string => {
          if (heading) {
            return `## ${heading}\n\n${body}`;
          }
          return body;
        };
        
        // Build map of chunkIndex → optimized content (using chunk_number which is 1-indexed)
        const optimizedChunkMap = new Map<number, { heading: string | null; body: string }>();
        result.optimizedChunks.forEach(chunk => {
          // chunk_number is 1-indexed, convert to 0-indexed for matching with allOriginalChunks
          const chunkIndex = chunk.chunk_number - 1;
          const cleanBody = stripAccidentalHeadings(chunk.optimized_text || '');
          optimizedChunkMap.set(chunkIndex, {
            heading: chunk.heading || null,
            body: cleanBody,
          });
        });
        
        // Reconstruct FULL document by iterating through ALL original chunks
        const allChunks = result.allOriginalChunks || [];
        
        let fullContent: string;
        if (allChunks.length === 0) {
          // Fallback: if allOriginalChunks not available, show warning and use only optimized
          console.warn('allOriginalChunks not available - showing only optimized chunks');
          fullContent = result.optimizedChunks
            .map(chunk => formatChunkForOutput(chunk.heading || null, stripAccidentalHeadings(chunk.optimized_text || '')))
            .join('\n\n');
        } else {
          // Full reconstruction - iterate through ALL chunks
          const fullDocumentParts: string[] = [];
          
          for (const originalChunk of allChunks) {
            if (optimizedChunkMap.has(originalChunk.index)) {
              // This chunk was optimized - use the optimized version
              const optimized = optimizedChunkMap.get(originalChunk.index)!;
              fullDocumentParts.push(formatChunkForOutput(optimized.heading, optimized.body));
            } else {
              // This chunk was NOT optimized - keep original
              fullDocumentParts.push(formatChunkForOutput(
                originalChunk.heading,
                originalChunk.textWithoutCascade
              ));
            }
          }
          
          fullContent = fullDocumentParts.join('\n\n');
        }
        
        setOptimizedContent(fullContent);
        
        // Auto-accept all chunks initially
        setAcceptedChunks(new Set(result.optimizedChunks.map((_, i) => i)));
        setRejectedChunks(new Set());
        setEditedChunks(new Map());
        
        setViewState('review');
      }
    } catch (err) {
      setViewState('assignment');
    }
  };

  const handleAcceptChunk = (chunkIndex: number) => {
    const newRejected = new Set(rejectedChunks);
    newRejected.delete(chunkIndex);
    setRejectedChunks(newRejected);
    
    const newAccepted = new Set(acceptedChunks);
    newAccepted.add(chunkIndex);
    setAcceptedChunks(newAccepted);
  };

  const handleRejectChunk = (chunkIndex: number) => {
    const newAccepted = new Set(acceptedChunks);
    newAccepted.delete(chunkIndex);
    setAcceptedChunks(newAccepted);
    
    const newRejected = new Set(rejectedChunks);
    newRejected.add(chunkIndex);
    setRejectedChunks(newRejected);
  };

  const handleEditChunk = (chunkIndex: number, newText: string) => {
    const newEdited = new Map(editedChunks);
    newEdited.set(chunkIndex, newText);
    setEditedChunks(newEdited);
    // Mark as accepted when edited
    handleAcceptChunk(chunkIndex);
  };

  const handleApplyChanges = () => {
    if (!optimizationResult) return;

    // Helper to strip any heading lines
    const stripHeadings = (text: string): string => {
      return text.replace(/^(#{1,6}\s+[^\n]+\n+)+/, '').trim();
    };
    
    // Helper to format a chunk for output
    const formatChunk = (heading: string | null, body: string): string => {
      if (heading) {
        return `## ${heading}\n\n${body}`;
      }
      return body;
    };

    // Build map of which optimized chunks to use (by original chunk index)
    // rejectedChunks/acceptedChunks/editedChunks use the index within optimizedChunks array
    const optimizedChunkMap = new Map<number, { heading: string | null; body: string; rejected: boolean }>();
    optimizationResult.optimizedChunks.forEach((chunk, optimizedIdx) => {
      const originalIndex = chunk.chunk_number - 1; // Convert 1-indexed to 0-indexed
      
      if (rejectedChunks.has(optimizedIdx)) {
        // Rejected - will fall through to use original
        optimizedChunkMap.set(originalIndex, { heading: null, body: '', rejected: true });
      } else if (editedChunks.has(optimizedIdx)) {
        // Edited by user
        optimizedChunkMap.set(originalIndex, { 
          heading: chunk.heading || null, 
          body: stripHeadings(editedChunks.get(optimizedIdx)!),
          rejected: false 
        });
      } else {
        // Use optimized version
        optimizedChunkMap.set(originalIndex, { 
          heading: chunk.heading || null, 
          body: stripHeadings(chunk.optimized_text || ''),
          rejected: false 
        });
      }
    });

    // Reconstruct FULL document from all original chunks
    const allChunks = optimizationResult.allOriginalChunks || [];
    
    let finalContent: string;
    if (allChunks.length === 0) {
      // Fallback: only optimized chunks available
      const finalChunks = optimizationResult.optimizedChunks.map((chunk, idx) => {
        if (rejectedChunks.has(idx)) {
          return chunk.original_text;
        }
        if (editedChunks.has(idx)) {
          return editedChunks.get(idx)!;
        }
        return formatChunk(chunk.heading || null, stripHeadings(chunk.optimized_text || ''));
      });
      finalContent = finalChunks.join('\n\n');
    } else {
      // Full document reconstruction
      const fullDocumentParts: string[] = [];
      
      for (const originalChunk of allChunks) {
        const optimizedData = optimizedChunkMap.get(originalChunk.index);
        
        if (optimizedData && !optimizedData.rejected) {
          // Use optimized/edited version
          fullDocumentParts.push(formatChunk(optimizedData.heading, optimizedData.body));
        } else {
          // Use original (either not optimized, or rejected)
          fullDocumentParts.push(formatChunk(
            originalChunk.heading,
            originalChunk.textWithoutCascade
          ));
        }
      }
      
      finalContent = fullDocumentParts.join('\n\n');
    }

    onApplyOptimization(finalContent);
    
    // Call optimization complete callback to navigate to report
    if (onOptimizationComplete) {
      onOptimizationComplete(optimizationResult, finalContent);
    }
  };

  const handleExport = () => {
    if (!optimizationResult) return;

    const report = {
      exportedAt: new Date().toISOString(),
      queryAssignments: queryAssignments.chunkAssignments
        .filter(ca => ca.assignedQuery)
        .map(ca => ({
          chunkIndex: ca.chunkIndex,
          queries: [ca.assignedQuery!.query],
        })),
      originalContent: optimizationResult.originalContent,
      optimizedContent,
      chunks: optimizationResult.optimizedChunks.map((chunk, idx) => ({
        chunkNumber: chunk.chunk_number,
        heading: chunk.heading,
        status: rejectedChunks.has(idx) ? 'rejected' : editedChunks.has(idx) ? 'edited' : 'accepted',
        originalText: chunk.original_text,
        optimizedText: editedChunks.get(idx) || chunk.optimized_text,
        changes: chunk.changes_applied,
        scores: chunk.scores,
      })),
      explanations: optimizationResult.explanations,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `optimization-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Exported optimization report');
  };

  const handleReset = () => {
    reset();
    setOptimizationResult(null);
    setOptimizedContent('');
    setAcceptedChunks(new Set());
    setRejectedChunks(new Set());
    setEditedChunks(new Map());
    setGeneratedBriefs([]);
    setViewState('assignment');
  };

  const getStepLabel = () => {
    switch (step) {
      case 'analyzing': return 'Analyzing content structure...';
      case 'optimizing': return 'Generating focused optimizations...';
      case 'scoring': return 'Calculating Passage Scores...';
      case 'explaining': return 'Generating change explanations...';
      default: return 'Processing...';
    }
  };

  // Optimizing view
  if (viewState === 'optimizing') {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 md:p-8 space-y-6 text-center">
          <Loader2 className="h-10 w-10 md:h-12 md:w-12 animate-spin text-accent mx-auto" />
          <div>
            <h3 className="text-base md:text-lg font-semibold mb-2">{getStepLabel()}</h3>
            <p className="text-xs md:text-sm text-muted-foreground">
              Optimizing each chunk for its assigned queries
            </p>
          </div>
          <Progress value={progress} className="w-full" />
          {error && (
            <div className="text-xs md:text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
              <Button variant="ghost" size="sm" onClick={handleReset} className="ml-2">
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Review view
  if (viewState === 'review' && optimizationResult) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-12 md:h-14 px-4 md:px-6 border-b border-border flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={handleReset} className="icon-button" title="Back to assignments">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h3 className="text-xs md:text-sm font-medium text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="hidden sm:inline">Review Optimizations</span>
              <span className="sm:hidden">Review</span>
            </h3>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden p-4 md:p-6">
          <ChunkReviewPanel
            chunks={optimizationResult.optimizedChunks}
            explanations={optimizationResult.explanations}
            originalContent={optimizationResult.originalContent}
            queryAssignments={queryAssignments}
            onAccept={handleAcceptChunk}
            onReject={handleRejectChunk}
            onEdit={handleEditChunk}
            onApplyAll={handleApplyChanges}
            onExport={handleExport}
            acceptedChunks={acceptedChunks}
            rejectedChunks={rejectedChunks}
            editedChunks={editedChunks}
            originalFullScores={optimizationResult.originalFullScores}
            optimizedFullScores={optimizationResult.optimizedFullScores}
          />
        </div>
      </div>
    );
  }

  // Assignment view (default)
  return (
    <div className="flex-1 overflow-auto">
      <ScrollArea className="h-full">
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
          {/* Optimization Plan Panel */}
          {queryAssignments.assignments.length > 0 && (
            <OptimizationPlanPanel
              chunkAssignments={planChunkAssignments}
              selectedArchitectureTasks={selectedArchitectureTasks}
              unassignedQueries={queryAssignments.unassignedQueries}
              applyArchitecture={applyArchitecture}
              generateBriefs={generateBriefs}
              onToggleArchitecture={setApplyArchitecture}
              onToggleBriefs={setGenerateBriefs}
            />
          )}

          <div className="panel">
            <div className="panel-header">
              <h3 className="flex items-center gap-2 text-sm md:text-base">
                <Target className="h-4 w-4 md:h-5 md:w-5 text-accent" />
                Query-to-Chunk Assignment
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                Each query will optimize its best-matching chunk. Review assignments before running optimization.
              </p>
            </div>

            <DismissableTip tipId="optimize-assignment-intro">
              <strong>Focused Optimization:</strong> Instead of trying to stuff all keywords everywhere, 
              each chunk will only be optimized for its assigned queries. This creates natural, focused content 
              that scores higher on Passage Score.
            </DismissableTip>

            {queryAssignments.assignments.length === 0 ? (
              <div className="text-center py-8 md:py-12 text-muted-foreground">
                <Target className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm md:text-base">No query assignments could be computed.</p>
                <p className="text-xs md:text-sm mt-2">
                  This usually means the analysis hasn't been run yet or no queries were provided.
                </p>
                <Button variant="secondary" className="mt-4" onClick={onGoToAnalyze}>
                  Go to Analyze
                </Button>
              </div>
            ) : (
              <QueryAssignmentPreview
                assignmentMap={queryAssignments}
                chunkScores={chunkScores}
                onAssignmentChange={handleAssignmentChange}
                onConfirm={handleStartOptimization}
                isOptimizing={step !== 'idle' && step !== 'complete' && step !== 'error'}
                onGenerateBrief={handleGenerateBrief}
                generatedBriefs={generatedBriefs}
              />
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
