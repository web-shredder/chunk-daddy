import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle2, 
  FileText, 
  Wrench, 
  ChevronDown,
  ChevronRight,
  Loader2,
  Copy,
  Download,
  ArrowRight,
  Sparkles,
  Package,
  AlertCircle,
  RefreshCw,
  Clock,
  AlertTriangle,
  Flag,
  Eye,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
  FileDown,
  BarChart3,
  FileJson,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  ArchitectureTask,
  ContentBrief,
  VerificationSummary,
} from '@/lib/optimizer-types';
import type { CoverageState } from '@/types/coverage';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';
import type { ChunkScore } from '@/hooks/useAnalysis';
import { DownloadCard } from './DownloadCard';
import {
  downloadOriginalContent,
  downloadOptimizedContent,
  downloadQueryResearch,
  downloadContentBriefs,
  downloadChunkAnalysis,
  downloadFullReport,
} from '@/utils/downloads';
import { toast } from 'sonner';

// Extended StreamedChunk with verification data
interface StreamedChunkWithScores {
  chunk_number: number;
  originalChunkIndex: number;
  original_text: string;
  optimized_text: string;
  assignedQuery?: string;
  heading?: string;
  originalScore?: number;
  optimizedScore?: number;
  scoreChange?: number;
  explanation?: string;
  // Verification data
  beforeScores?: { semantic: number; lexical: number; citation: number; composite: number };
  afterScores?: { semantic: number; lexical: number; citation: number; composite: number };
  deltas?: { semantic: number; lexical: number; citation: number; composite: number };
  improved?: boolean;
  verified?: boolean;
  changes_applied?: Array<{ type: string; description: string }>;
  unaddressable?: string[];
  thinking?: string;
}

interface OutputsTabProps {
  // Streaming state
  isOptimizing: boolean;
  currentStep: string;
  progress: number;
  error?: string | null;
  
  // Incremental results (populated as they stream in)
  appliedArchitectureTasks: ArchitectureTask[];
  optimizedChunks: StreamedChunkWithScores[];
  generatedBriefs: ContentBrief[];
  
  // Verification summary
  verificationSummary?: VerificationSummary | null;
  
  // Skipped chunks count (already optimal)
  skippedOptimalCount?: number;
  
  // NEW: Data for exports
  originalContent?: string;
  coverageState?: CoverageState | null;
  chunks?: LayoutAwareChunk[];
  chunkScores?: ChunkScore[];
  projectName?: string;
  
  // Actions
  onApplyChanges: () => void;
  onCopyContent: () => void;
  onExportReport: () => void;
  onGoToOptimize: () => void;
  onGoToReport?: () => void;
  onRetry?: () => void;
  onViewInDocument?: (chunkIndex: number) => void;
}

// Score column component for the verification grid
function ScoreColumn({ 
  label, 
  before, 
  after 
}: { 
  label: string; 
  before: number; 
  after: number;
}) {
  const delta = Math.round((after - before) * 10) / 10;
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  
  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground mb-1 font-medium">{label}</div>
      <div className="flex items-center justify-center gap-1.5">
        <span className="text-muted-foreground tabular-nums">{Math.round(before)}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
        <span className={cn(
          "font-semibold tabular-nums",
          isPositive && "text-green-600 dark:text-green-400",
          isNegative && "text-red-600 dark:text-red-400"
        )}>
          {Math.round(after)}
        </span>
      </div>
      <div className={cn(
        "text-xs tabular-nums font-medium mt-0.5",
        isPositive && "text-green-600 dark:text-green-400",
        isNegative && "text-red-600 dark:text-red-400",
        !isPositive && !isNegative && "text-muted-foreground"
      )}>
        {delta > 0 ? '+' : ''}{delta}
      </div>
    </div>
  );
}

// Individual optimized chunk card with tabs
function OptimizedChunkCard({ 
  chunk, 
  onCopy,
  onViewInDocument,
}: { 
  chunk: StreamedChunkWithScores;
  onCopy: (text: string) => void;
  onViewInDocument?: (chunkIndex: number) => void;
}) {
  const [viewMode, setViewMode] = useState<'diff' | 'before' | 'after' | 'reasoning'>('diff');
  
  const isVerified = chunk.verified === true;
  const isImproved = chunk.improved === true;
  const hasDeclined = chunk.deltas?.composite !== undefined && chunk.deltas.composite < 0;
  const hasChanges = chunk.changes_applied && chunk.changes_applied.length > 0;
  const hasUnaddressable = chunk.unaddressable && chunk.unaddressable.length > 0;
  
  // Simple diff highlighting
  const renderDiff = () => {
    const before = chunk.original_text || '';
    const after = chunk.optimized_text || '';
    
    if (before === after) {
      return <p className="text-muted-foreground italic text-sm">No changes made</p>;
    }
    
    return (
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Minus className="h-3 w-3 text-red-500" /> Before
          </p>
          <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 text-sm whitespace-pre-wrap break-words border border-red-200/50 dark:border-red-800/30 max-h-48 overflow-y-auto">
            {before}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-green-500" /> After
          </p>
          <div className="p-3 rounded-lg bg-green-50/50 dark:bg-green-950/20 text-sm whitespace-pre-wrap break-words border border-green-200/50 dark:border-green-800/30 max-h-48 overflow-y-auto">
            {after}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <Card className={cn(
      "transition-all",
      isImproved && "border-green-300/50 dark:border-green-700/50",
      hasDeclined && "border-red-300/50 dark:border-red-700/50"
    )}>
      {/* Header */}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm shrink-0">
              Chunk {chunk.originalChunkIndex + 1}
            </span>
            {chunk.heading && (
              <span className="text-muted-foreground text-sm truncate">
                — {chunk.heading}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isVerified ? (
              <Badge variant="outline" className="text-green-600 border-green-300 dark:border-green-700 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
              </Badge>
            ) : (
              <Badge variant="outline" className="text-yellow-600 border-yellow-300 dark:border-yellow-700 text-xs">
                <Clock className="h-3 w-3 mr-1" /> Pending
              </Badge>
            )}
            {isImproved && (
              <Badge variant="default" className="bg-green-600 text-xs">
                <TrendingUp className="h-3 w-3 mr-1" /> Improved
              </Badge>
            )}
            {hasDeclined && (
              <Badge variant="destructive" className="text-xs">
                <TrendingDown className="h-3 w-3 mr-1" /> Declined
              </Badge>
            )}
          </div>
        </div>
        {chunk.assignedQuery && (
          <p className="text-xs text-muted-foreground mt-1">
            Optimized for: <span className="font-medium">"{chunk.assignedQuery}"</span>
          </p>
        )}
      </CardHeader>
      
      {/* Score Comparison Grid (only if verified) */}
      {isVerified && chunk.beforeScores && chunk.afterScores && (
        <div className="px-6 py-3 bg-muted/30 border-y">
          <div className="grid grid-cols-4 gap-4">
            <ScoreColumn 
              label="Semantic" 
              before={chunk.beforeScores.semantic} 
              after={chunk.afterScores.semantic}
            />
            <ScoreColumn 
              label="Lexical" 
              before={chunk.beforeScores.lexical} 
              after={chunk.afterScores.lexical}
            />
            <ScoreColumn 
              label="Citation" 
              before={chunk.beforeScores.citation} 
              after={chunk.afterScores.citation}
            />
            <ScoreColumn 
              label="Composite" 
              before={chunk.beforeScores.composite} 
              after={chunk.afterScores.composite}
            />
          </div>
        </div>
      )}
      
      <CardContent className="pt-4">
        {/* View Mode Tabs */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
          <TabsList className="mb-3 h-8">
            <TabsTrigger value="diff" className="text-xs h-7">
              <Eye className="h-3 w-3 mr-1" /> Diff
            </TabsTrigger>
            <TabsTrigger value="before" className="text-xs h-7">Before</TabsTrigger>
            <TabsTrigger value="after" className="text-xs h-7">After</TabsTrigger>
            <TabsTrigger value="reasoning" className="text-xs h-7">
              <Lightbulb className="h-3 w-3 mr-1" /> Reasoning
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="diff" className="mt-0">
            {renderDiff()}
          </TabsContent>
          
          <TabsContent value="before" className="mt-0">
            <div className="p-3 bg-red-50/50 dark:bg-red-950/20 rounded-lg text-sm whitespace-pre-wrap break-words border border-red-200/30 dark:border-red-800/30 max-h-64 overflow-y-auto">
              {chunk.original_text}
            </div>
          </TabsContent>
          
          <TabsContent value="after" className="mt-0">
            <div className="p-3 bg-green-50/50 dark:bg-green-950/20 rounded-lg text-sm whitespace-pre-wrap break-words border border-green-200/30 dark:border-green-800/30 max-h-64 overflow-y-auto">
              {chunk.optimized_text}
            </div>
          </TabsContent>
          
          <TabsContent value="reasoning" className="mt-0">
            {chunk.thinking ? (
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg text-sm border border-blue-200/30 dark:border-blue-800/30">
                <p className="font-medium mb-2 text-blue-700 dark:text-blue-300">AI's reasoning:</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{chunk.thinking}</p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic p-3">
                No reasoning captured for this optimization.
              </p>
            )}
          </TabsContent>
        </Tabs>
        
        {/* Changes Applied */}
        {hasChanges && (
          <div className="mt-4">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Changes Made:</p>
            <div className="flex flex-wrap gap-1.5">
              {chunk.changes_applied!.map((change, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal">
                  <span className="font-medium capitalize">{change.type.replace(/_/g, ' ')}</span>
                  {change.description && `: ${change.description.slice(0, 40)}${change.description.length > 40 ? '…' : ''}`}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Unaddressable Issues */}
        {hasUnaddressable && (
          <div className="mt-4 p-3 bg-yellow-50/50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200/50 dark:border-yellow-800/30">
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Couldn't auto-fix:
            </p>
            <ul className="text-sm text-yellow-600 dark:text-yellow-400 list-disc pl-5 space-y-0.5">
              {chunk.unaddressable!.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      
      {/* Footer Actions */}
      <CardFooter className="border-t pt-3 flex justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => onCopy(chunk.optimized_text)}
          >
            <Copy className="h-3 w-3 mr-1" /> Copy
          </Button>
          {onViewInDocument && (
            <Button 
              variant="outline" 
              size="sm"
              className="h-7 text-xs"
              onClick={() => onViewInDocument(chunk.originalChunkIndex)}
            >
              <Eye className="h-3 w-3 mr-1" /> View in Doc
            </Button>
          )}
        </div>
        {hasDeclined && (
          <Button variant="outline" size="sm" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50">
            <Flag className="h-3 w-3 mr-1" /> Flag for Manual Edit
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// Content brief card
function ContentBriefCard({ brief }: { brief: ContentBrief }) {
  const copyBrief = () => {
    const briefText = 
      `## ${brief.suggestedHeading}\n\n` +
      `Query: ${brief.targetQuery}\n\n` +
      `Key points:\n${brief.keyPoints?.map(p => `- ${p}`).join('\n') || ''}\n\n` +
      `Draft opening: ${brief.draftOpening || ''}\n\n` +
      `Target word count: ${brief.targetWordCount?.min || 300}-${brief.targetWordCount?.max || 500}`;
    navigator.clipboard.writeText(briefText);
    toast.success('Brief copied to clipboard');
  };
  
  return (
    <div className="p-4 rounded-lg border border-orange-200/50 bg-orange-50/30 dark:bg-orange-950/20 dark:border-orange-800/30">
      <div className="flex items-start justify-between mb-2">
        <p className="font-medium">{brief.suggestedHeading}</p>
        <Badge variant="outline" className="text-xs shrink-0">
          ~{brief.targetWordCount?.min || 300}-{brief.targetWordCount?.max || 500} words
        </Badge>
      </div>
      
      <p className="text-xs text-muted-foreground mb-2">
        For query: <span className="font-medium">"{brief.targetQuery}"</span>
      </p>
      
      <p className="text-xs text-muted-foreground mb-3">
        Placement: {brief.placementDescription}
      </p>
      
      {brief.keyPoints && brief.keyPoints.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium mb-1">Key points:</p>
          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
            {brief.keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {brief.draftOpening && (
        <div className="mb-3">
          <p className="text-xs font-medium mb-1">Draft opening:</p>
          <p className="text-xs text-muted-foreground italic">"{brief.draftOpening}"</p>
        </div>
      )}

      <Button size="sm" variant="outline" className="text-xs h-7" onClick={copyBrief}>
        <Copy className="h-3 w-3 mr-1" /> Copy Brief
      </Button>
    </div>
  );
}

export function DownloadsTab({
  isOptimizing,
  currentStep,
  progress,
  error,
  appliedArchitectureTasks,
  optimizedChunks,
  generatedBriefs,
  verificationSummary,
  skippedOptimalCount = 0,
  originalContent = '',
  coverageState,
  chunks = [],
  chunkScores = [],
  projectName = 'Untitled',
  onApplyChanges,
  onCopyContent,
  onExportReport,
  onGoToOptimize,
  onGoToReport,
  onRetry,
  onViewInDocument,
}: OutputsTabProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    architecture: true,
    chunks: true,
    briefs: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const hasAnyOutput = appliedArchitectureTasks.length > 0 || 
                       optimizedChunks.length > 0 || 
                       generatedBriefs.length > 0;

  const isComplete = !isOptimizing && hasAnyOutput;
  
  // Calculate summary stats from verification or fallback
  const stats = useMemo(() => {
    if (verificationSummary) {
      return {
        chunksImproved: verificationSummary.chunksImproved,
        chunksDeclined: verificationSummary.chunksDeclined,
        avgBefore: verificationSummary.avgCompositeBefore,
        avgAfter: verificationSummary.avgCompositeAfter,
        avgImprovement: verificationSummary.avgImprovement,
      };
    }
    // Fallback calculation
    const improved = optimizedChunks.filter(c => c.improved === true).length;
    const declined = optimizedChunks.filter(c => c.deltas?.composite !== undefined && c.deltas.composite < 0).length;
    return {
      chunksImproved: improved,
      chunksDeclined: declined,
      avgBefore: 0,
      avgAfter: 0,
      avgImprovement: 0,
    };
  }, [verificationSummary, optimizedChunks]);
  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };
  
  // Progress phase description
  const getProgressDescription = () => {
    if (progress < 20) return 'Applying structural fixes...';
    if (progress < 70) return `Optimizing chunks (${optimizedChunks.length} complete)...`;
    if (progress < 95) return 'Verifying improvements...';
    return 'Complete!';
  };

  return (
    <div className="flex-1 overflow-auto">
      <ScrollArea className="h-full">
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 pb-24">
          
          {/* ============ PROGRESS HEADER ============ */}
          {isOptimizing && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  {currentStep || 'Processing...'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={progress} className="h-2 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {getProgressDescription()}
                </p>
              </CardContent>
            </Card>
          )}

          {/* ============ ERROR STATE ============ */}
          {error && !isOptimizing && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="py-8 text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
                <p className="text-lg font-medium mb-2 text-destructive">Optimization Failed</p>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  {error}
                </p>
                <div className="flex gap-2 justify-center">
                  {onRetry && (
                    <Button variant="default" onClick={onRetry}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  )}
                  <Button variant="outline" onClick={onGoToOptimize}>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Back to Optimize
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ============ NO OUTPUT YET ============ */}
          {!hasAnyOutput && !isOptimizing && !error && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium mb-2">No outputs yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Go to the Optimize tab and run optimization to see results here.
                </p>
                <Button variant="outline" onClick={onGoToOptimize}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Go to Optimize
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ============ VERIFICATION SUMMARY ============ */}
          {isComplete && verificationSummary && (
            <Card className="glass border-primary/20">
              <CardContent className="py-4">
                {/* Skipped optimal chunks notice */}
                {skippedOptimalCount > 0 && (
                  <div className="text-sm text-muted-foreground mb-4 pb-3 border-b border-border/50 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[hsl(var(--tier-good))]" />
                    {skippedOptimalCount} chunk{skippedOptimalCount > 1 ? 's' : ''} skipped (already optimal)
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary tabular-nums">
                      {verificationSummary.optimizedCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Chunks Optimized</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600 tabular-nums">
                      {verificationSummary.chunksImproved}
                    </p>
                    <p className="text-xs text-muted-foreground">Improved</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600 tabular-nums">
                      {verificationSummary.chunksDeclined}
                    </p>
                    <p className="text-xs text-muted-foreground">Declined</p>
                  </div>
                  <div>
                    <p className={cn(
                      "text-2xl font-bold tabular-nums",
                      verificationSummary.avgImprovement > 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {verificationSummary.avgImprovement > 0 ? '+' : ''}{verificationSummary.avgImprovement.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg. Improvement</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ============ ARCHITECTURE OUTPUTS ============ */}
          {appliedArchitectureTasks.length > 0 && (
            <Collapsible open={expandedSections.architecture} onOpenChange={() => toggleSection('architecture')}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        {expandedSections.architecture ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        Structural Changes
                      </CardTitle>
                      <Badge variant="secondary">
                        {appliedArchitectureTasks.length} applied
                      </Badge>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-2">
                    {appliedArchitectureTasks.map((task, idx) => (
                      <div key={task.id || idx} className="p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <Badge variant="outline" className="text-xs">
                            {task.type.replace(/_/g, ' ')}
                          </Badge>
                          <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                            {task.priority}
                          </Badge>
                        </div>
                        <p className="text-sm">{task.description}</p>
                        {task.location?.position && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Location: {task.location.position}
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* ============ OPTIMIZED CHUNKS ============ */}
          {optimizedChunks.length > 0 && (
            <Collapsible open={expandedSections.chunks} onOpenChange={() => toggleSection('chunks')}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        {expandedSections.chunks ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <Sparkles className="h-4 w-4 text-primary" />
                        Optimized Chunks
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {stats.avgBefore > 0 && (
                          <Badge variant="outline" className="font-mono text-xs">
                            {Math.round(stats.avgBefore)} → {Math.round(stats.avgAfter)}
                          </Badge>
                        )}
                        <Badge variant="secondary">
                          {optimizedChunks.length} chunks
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {optimizedChunks.map((chunk, idx) => (
                      <OptimizedChunkCard 
                        key={idx}
                        chunk={chunk}
                        onCopy={handleCopy}
                        onViewInDocument={onViewInDocument}
                      />
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* ============ CONTENT BRIEFS ============ */}
          {generatedBriefs.length > 0 && (
            <Collapsible open={expandedSections.briefs} onOpenChange={() => toggleSection('briefs')}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        {expandedSections.briefs ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <FileText className="h-4 w-4 text-orange-500" />
                        Content Briefs for Gaps
                      </CardTitle>
                      <Badge variant="secondary">
                        {generatedBriefs.length} briefs
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground text-left mt-1">
                      New content needed to cover unassigned queries
                    </p>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {generatedBriefs.map((brief, idx) => (
                      <ContentBriefCard key={idx} brief={brief} />
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* ============ EXPORT DOWNLOADS ============ */}
          <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileDown className="h-5 w-5 text-primary" />
                Export Downloads
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Download your optimization work in various formats
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary Stats */}
              {coverageState && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {coverageState.queries.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Queries</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success tabular-nums">
                      {coverageState.queries.filter(q => q.status === 'optimized').length}
                    </p>
                    <p className="text-xs text-muted-foreground">Optimized</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary tabular-nums">
                      {coverageState.queries.filter(q => q.isGap === false && q.approvedText).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Gaps Filled</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {chunks.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Chunks</p>
                  </div>
                </div>
              )}
              
              {/* Download Cards Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Original Content */}
                <DownloadCard
                  title="Original Content"
                  description="Your original document before optimization"
                  icon={<FileText className="h-5 w-5" />}
                  formats={['markdown', 'txt']}
                  onDownload={(format) => downloadOriginalContent(originalContent, format as 'markdown' | 'txt')}
                  disabled={!originalContent}
                />
                
                {/* Optimized Content */}
                <DownloadCard
                  title="Optimized Content"
                  description="Document with all approved optimizations applied"
                  icon={<Sparkles className="h-5 w-5" />}
                  formats={['markdown', 'txt', 'html']}
                  onDownload={(format) => {
                    if (coverageState) {
                      downloadOptimizedContent(coverageState, chunks, format as 'markdown' | 'txt' | 'html');
                    }
                  }}
                  disabled={!coverageState || coverageState.queries.filter(q => q.status === 'optimized').length === 0}
                  badge={coverageState ? `${coverageState.queries.filter(q => q.status === 'optimized').length} optimized` : undefined}
                />
                
                {/* Query Research */}
                <DownloadCard
                  title="Query Research"
                  description="All query scores, status, and improvements"
                  icon={<BarChart3 className="h-5 w-5" />}
                  formats={['csv', 'json']}
                  onDownload={(format) => {
                    if (coverageState) {
                      downloadQueryResearch(coverageState, format as 'csv' | 'json');
                    }
                  }}
                  disabled={!coverageState || coverageState.queries.length === 0}
                />
                
                {/* Content Briefs */}
                <DownloadCard
                  title="Content Briefs"
                  description="AI-generated briefs for gap content"
                  icon={<FileCode className="h-5 w-5" />}
                  formats={['markdown', 'json']}
                  onDownload={(format) => {
                    if (coverageState) {
                      downloadContentBriefs(coverageState, format as 'markdown' | 'json');
                    }
                  }}
                  disabled={!coverageState || coverageState.queries.filter(q => (q.isGap || q.status === 'gap') && q.analysisPrompt).length === 0}
                  badge={coverageState ? `${coverageState.queries.filter(q => (q.isGap || q.status === 'gap') && q.analysisPrompt).length} briefs` : undefined}
                />
                
                {/* Chunk Analysis */}
                <DownloadCard
                  title="Chunk Analysis"
                  description="Detailed chunk breakdown with scores"
                  icon={<FileSpreadsheet className="h-5 w-5" />}
                  formats={['csv', 'json']}
                  onDownload={(format) => downloadChunkAnalysis(chunks, chunkScores, format as 'csv' | 'json')}
                  disabled={chunks.length === 0}
                />
                
                {/* Full Report */}
                <DownloadCard
                  title="Optimization Report"
                  description="Comprehensive summary of all optimization work"
                  icon={<FileJson className="h-5 w-5" />}
                  formats={['markdown', 'json']}
                  onDownload={(format) => {
                    if (coverageState) {
                      downloadFullReport(projectName, originalContent, coverageState, chunks, chunkScores, format as 'markdown' | 'json');
                    }
                  }}
                  disabled={!coverageState || coverageState.queries.filter(q => q.status === 'optimized').length === 0}
                  featured
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
      
      {/* ============ STICKY FOOTER ============ */}
      {isComplete && (
        <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{optimizedChunks.length}</span> chunks optimized
              {verificationSummary && (
                <span className="ml-2">
                  • <span className="text-green-600">{stats.chunksImproved} improved</span>
                  {stats.chunksDeclined > 0 && (
                    <span className="text-red-600">, {stats.chunksDeclined} declined</span>
                  )}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onExportReport}>
                <Download className="h-4 w-4 mr-2" /> Export All
              </Button>
              <Button variant="outline" size="sm" onClick={onCopyContent}>
                <Copy className="h-4 w-4 mr-2" /> Copy Content
              </Button>
              <Button size="sm" onClick={onApplyChanges}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Apply to Content
              </Button>
              {onGoToReport && (
                <Button variant="secondary" size="sm" onClick={onGoToReport}>
                  View Report <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
