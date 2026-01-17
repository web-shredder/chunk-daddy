import { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Copy, 
  FileJson, 
  ArrowLeft,
  Target,
  Loader2,
} from 'lucide-react';
import { DismissableTip } from '@/components/DismissableTip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { QueryAssignmentPreview } from '@/components/optimizer/QueryAssignmentPreview';
import { ChunkReviewPanel } from '@/components/optimizer/ChunkReviewPanel';
import { useOptimizer } from '@/hooks/useOptimizer';
import { calculatePassageScore } from '@/lib/similarity';
import { 
  computeQueryAssignments, 
  type QueryAssignmentMap,
  type ChunkScoreData,
} from '@/lib/query-assignment';
import type { FullOptimizationResult } from '@/lib/optimizer-types';
import type { ChunkScore } from '@/hooks/useAnalysis';

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
}

type OptimizeViewState = 'assignment' | 'optimizing' | 'review';

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
}: OptimizeTabProps) {
  const [viewState, setViewState] = useState<OptimizeViewState>('assignment');
  const [optimizationResult, setOptimizationResult] = useState<FullOptimizationResult | null>(null);
  const [optimizedContent, setOptimizedContent] = useState<string>('');
  
  // Review state
  const [acceptedChunks, setAcceptedChunks] = useState<Set<number>>(new Set());
  const [rejectedChunks, setRejectedChunks] = useState<Set<number>>(new Set());
  const [editedChunks, setEditedChunks] = useState<Map<number, string>>(new Map());
  
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
        setOptimizationResult(result);
        const fullContent = result.optimizedChunks
          .map(chunk => (chunk.heading ? `## ${chunk.heading}\n\n` : '') + chunk.optimized_text)
          .join('\n\n');
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
    setRejectedChunks(prev => {
      const next = new Set(prev);
      next.delete(chunkIndex);
      return next;
    });
    setAcceptedChunks(prev => {
      const next = new Set(prev);
      next.add(chunkIndex);
      return next;
    });
  };

  const handleRejectChunk = (chunkIndex: number) => {
    setAcceptedChunks(prev => {
      const next = new Set(prev);
      next.delete(chunkIndex);
      return next;
    });
    setRejectedChunks(prev => {
      const next = new Set(prev);
      next.add(chunkIndex);
      return next;
    });
  };

  const handleEditChunk = (chunkIndex: number, newText: string) => {
    setEditedChunks(prev => {
      const next = new Map(prev);
      next.set(chunkIndex, newText);
      return next;
    });
    // Mark as accepted when edited
    handleAcceptChunk(chunkIndex);
  };

  const handleApplyChanges = () => {
    if (!optimizationResult) return;

    // Build final content from accepted/edited chunks
    const finalChunks = optimizationResult.optimizedChunks.map((chunk, idx) => {
      if (rejectedChunks.has(idx)) {
        return chunk.original_text;
      }
      if (editedChunks.has(idx)) {
        return editedChunks.get(idx)!;
      }
      return (chunk.heading ? `## ${chunk.heading}\n\n` : '') + chunk.optimized_text;
    });

    const finalContent = finalChunks.join('\n\n');
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
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
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
              />
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
