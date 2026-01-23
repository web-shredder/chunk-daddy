import { useState, useEffect } from 'react';
import { 
  Brain, 
  Cpu, 
  Layers, 
  Target, 
  FileSearch, 
  CheckCircle2, 
  Loader2,
  Zap,
  BarChart3,
  Network
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Types matching SSE events from edge function
export interface AnalysisStep {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'complete';
}

export interface EmbeddingInfo {
  totalTexts: number;
  breakdown: {
    originalContent: number;
    chunks: number;
    queries: number;
  };
  model: string;
  dimensions: number;
}

export interface EmbeddingBatch {
  batch: number;
  totalBatches: number;
  textsProcessed: number;
  totalTexts: number;
}

export interface DocumentChamferResult {
  score: number;
  scorePercent: string;
  interpretation: string;
  chunkCount: number;
  queryCount: number;
}

export interface ChunkScoredEvent {
  chunkIndex: number;
  chunkId: string;
  heading: string;
  bestQuery: string;
  bestScore: string;
  progress: string;
}

export interface CoverageSummary {
  covered: number;
  weak: number;
  gaps: number;
  totalQueries: number;
}

export interface DiagnosticProgress {
  pairsProcessed: number;
  totalPairs: number;
  progress: string;
}

export interface AnalysisSummary {
  totalChunks: number;
  totalQueries: number;
  documentChamfer: number;
  documentChamferPercent: string;
  coverage: CoverageSummary;
  avgPassageScore: string;
}

interface AnalysisStreamingPanelProps {
  isAnalyzing: boolean;
  steps: AnalysisStep[];
  currentStep: number;
  embeddingInfo: EmbeddingInfo | null;
  embeddingProgress: EmbeddingBatch | null;
  documentChamfer: DocumentChamferResult | null;
  scoredChunks: ChunkScoredEvent[];
  coverageSummary: CoverageSummary | null;
  diagnosticProgress: DiagnosticProgress | null;
  summary: AnalysisSummary | null;
  error: string | null;
}

const stepIcons = {
  1: Brain,
  2: Network,
  3: Layers,
  4: Target,
  5: FileSearch,
};

export function AnalysisStreamingPanel({
  isAnalyzing,
  steps,
  currentStep,
  embeddingInfo,
  embeddingProgress,
  documentChamfer,
  scoredChunks,
  coverageSummary,
  diagnosticProgress,
  summary,
  error,
}: AnalysisStreamingPanelProps) {
  const [animatedMetrics, setAnimatedMetrics] = useState({
    embeddings: 0,
    chamfer: 0,
    chunksScored: 0,
  });

  // Animate metrics
  useEffect(() => {
    if (embeddingProgress) {
      setAnimatedMetrics(prev => ({ ...prev, embeddings: embeddingProgress.textsProcessed }));
    }
    if (documentChamfer) {
      setAnimatedMetrics(prev => ({ ...prev, chamfer: parseFloat(documentChamfer.scorePercent) }));
    }
    if (scoredChunks.length > 0) {
      setAnimatedMetrics(prev => ({ ...prev, chunksScored: scoredChunks.length }));
    }
  }, [embeddingProgress, documentChamfer, scoredChunks]);

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6">
        <div className="flex items-center gap-3 text-destructive">
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Analysis Failed</h3>
            <p className="text-sm text-destructive/80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (summary) {
    return (
      <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-6 space-y-6">
        {/* Success Header */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Analysis Complete</h3>
            <p className="text-sm text-muted-foreground">
              {summary.totalChunks} chunks × {summary.totalQueries} queries analyzed
            </p>
          </div>
        </div>

        {/* Final Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-background/50 rounded-lg p-4 text-center border border-border/50">
            <div className="text-3xl font-bold text-primary">{summary.documentChamferPercent}%</div>
            <div className="text-xs text-muted-foreground mt-1">Document Chamfer</div>
          </div>
          <div className="bg-background/50 rounded-lg p-4 text-center border border-border/50">
            <div className="text-3xl font-bold text-accent">{summary.avgPassageScore}</div>
            <div className="text-xs text-muted-foreground mt-1">Avg Passage Score</div>
          </div>
          <div className="bg-background/50 rounded-lg p-4 text-center border border-border/50">
            <div className="text-3xl font-bold">
              <span className="text-green-500">{summary.coverage.covered}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-amber-500">{summary.coverage.weak}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-red-500">{summary.coverage.gaps}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Covered/Weak/Gaps</div>
          </div>
        </div>

        {/* Intelligence Callout */}
        <div className="bg-muted/30 rounded-lg p-4 text-xs text-muted-foreground space-y-1">
          <div className="font-medium text-foreground flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            What was calculated
          </div>
          <ul className="space-y-0.5 ml-5 list-disc">
            <li>{summary.totalChunks + summary.totalQueries + 1} texts → 3072-dim vectors (text-embedding-3-large)</li>
            <li>Document Chamfer: multi-aspect coverage across all chunk×query pairs</li>
            <li>Passage Score = 70% chunk cosine + 30% doc chamfer per pair</li>
            <li>Full diagnostic scoring: retrieval, rerank, citation simulation</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-background via-muted/10 to-background overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/50 bg-muted/20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Brain className="h-5 w-5 text-primary" />
            {isAnalyzing && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
            )}
          </div>
          <span className="font-semibold">Analysis Engine</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {isAnalyzing ? 'Processing...' : 'Ready'}
        </Badge>
      </div>

      <div className="p-4 space-y-4">
        {/* Step Progress */}
        <div className="space-y-2">
          {steps.map((step) => {
            const Icon = stepIcons[step.id as keyof typeof stepIcons] || Layers;
            const isActive = step.status === 'running';
            const isComplete = step.status === 'complete';
            
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg transition-all",
                  isActive && "bg-primary/10 border border-primary/30",
                  isComplete && "bg-muted/30",
                  !isActive && !isComplete && "opacity-50"
                )}
              >
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                  isActive && "bg-primary/20",
                  isComplete && "bg-green-500/20",
                  !isActive && !isComplete && "bg-muted/50"
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-sm font-medium",
                      isActive && "text-primary",
                      isComplete && "text-foreground"
                    )}>
                      Step {step.id}: {step.name}
                    </span>
                    
                    {/* Step-specific progress */}
                    {step.id === 1 && isActive && embeddingProgress && (
                      <span className="text-xs text-muted-foreground">
                        Batch {embeddingProgress.batch}/{embeddingProgress.totalBatches}
                      </span>
                    )}
                    {step.id === 3 && isActive && scoredChunks.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {scoredChunks.length} chunks
                      </span>
                    )}
                    {step.id === 5 && isActive && diagnosticProgress && (
                      <span className="text-xs text-muted-foreground">
                        {diagnosticProgress.progress}%
                      </span>
                    )}
                  </div>
                  
                  {/* Sub-progress bars */}
                  {step.id === 1 && isActive && embeddingProgress && (
                    <Progress 
                      value={(embeddingProgress.textsProcessed / embeddingProgress.totalTexts) * 100} 
                      className="h-1 mt-1.5" 
                    />
                  )}
                  {step.id === 5 && isActive && diagnosticProgress && (
                    <Progress 
                      value={parseFloat(diagnosticProgress.progress)} 
                      className="h-1 mt-1.5" 
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Metrics */}
        {isAnalyzing && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/30 rounded-lg p-3 text-center border border-border/30">
              <div className="text-xl font-bold tabular-nums">
                {animatedMetrics.embeddings}
              </div>
              <div className="text-[10px] text-muted-foreground">Embeddings</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center border border-border/30">
              <div className="text-xl font-bold tabular-nums">
                {animatedMetrics.chamfer > 0 ? `${animatedMetrics.chamfer.toFixed(1)}%` : '—'}
              </div>
              <div className="text-[10px] text-muted-foreground">Doc Chamfer</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center border border-border/30">
              <div className="text-xl font-bold tabular-nums">
                {animatedMetrics.chunksScored}
              </div>
              <div className="text-[10px] text-muted-foreground">Chunks Scored</div>
            </div>
          </div>
        )}

        {/* Live Chunk Feed */}
        {isAnalyzing && scoredChunks.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Live chunk scores</span>
            </div>
            <ScrollArea className="h-24 rounded-md border border-border/30 bg-muted/10">
              <div className="p-2 space-y-1">
                {scoredChunks.slice(-6).map((chunk, i) => (
                  <div 
                    key={chunk.chunkId}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded bg-background/50 animate-in fade-in slide-in-from-bottom-1 duration-300"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground shrink-0">#{chunk.chunkIndex + 1}</span>
                      <span className="truncate">{chunk.heading}</span>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "shrink-0 text-[10px]",
                        parseFloat(chunk.bestScore) >= 70 && "bg-green-500/10 text-green-600 border-green-500/30",
                        parseFloat(chunk.bestScore) >= 50 && parseFloat(chunk.bestScore) < 70 && "bg-amber-500/10 text-amber-600 border-amber-500/30",
                        parseFloat(chunk.bestScore) < 50 && "bg-red-500/10 text-red-600 border-red-500/30"
                      )}
                    >
                      {chunk.bestScore}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Model Info */}
        {embeddingInfo && (
          <div className="text-[10px] text-muted-foreground bg-muted/20 rounded-md p-2 flex items-center gap-2">
            <Cpu className="h-3 w-3" />
            <span>
              {embeddingInfo.model} • {embeddingInfo.dimensions}-dim vectors • 
              {embeddingInfo.breakdown.chunks} chunks + {embeddingInfo.breakdown.queries} queries
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
