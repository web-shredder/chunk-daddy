import { useState, useMemo } from 'react';
import {
  FileBarChart,
  Copy,
  FileText,
  FileJson,
  Play,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Clock,
  Layers,
  Target,
  Sparkles,
  Check,
  RotateCcw,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { formatScore, getScoreColorClass, formatImprovement, getImprovementColorClass, calculatePassageScore } from '@/lib/similarity';
import type { FullOptimizationResult, ValidatedChunk, ChangeExplanation, FurtherOptimizationSuggestion, TradeOffConsideration } from '@/lib/optimizer-types';

interface ReportTabProps {
  hasOptimizationResult: boolean;
  optimizationResult: FullOptimizationResult | null;
  optimizedContent: string;
  originalContent: string;
  keywords: string[];
  onApplyContent: (content: string) => void;
  onGoToOptimize: () => void;
  onReanalyze: () => void;
  onSaveProject?: () => void;
}

export function ReportTab({
  hasOptimizationResult,
  optimizationResult,
  optimizedContent,
  originalContent,
  keywords,
  onApplyContent,
  onGoToOptimize,
  onReanalyze,
  onSaveProject,
}: ReportTabProps) {
  const [editableContent, setEditableContent] = useState(optimizedContent);
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set([0]));
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showTradeOffs, setShowTradeOffs] = useState(true);
  const [showContent, setShowContent] = useState(false);

  // Sync editable content when optimizedContent changes
  useMemo(() => {
    setEditableContent(optimizedContent);
  }, [optimizedContent]);

  if (!hasOptimizationResult || !optimizationResult) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="empty-state">
          <FileBarChart size={48} strokeWidth={1} />
          <h3>No optimization report yet</h3>
          <p>Run the optimizer to generate a comprehensive report</p>
          <button className="btn-secondary" onClick={onGoToOptimize}>
            Go to Optimize
          </button>
        </div>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(editableContent);
    toast.success('Content copied to clipboard');
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([editableContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `optimized-content-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Exported as Markdown');
  };

  const handleExportReport = () => {
    const report = {
      exportedAt: new Date().toISOString(),
      originalContent: optimizationResult.originalContent,
      optimizedContent: editableContent,
      analysis: optimizationResult.analysis,
      chunks: optimizationResult.optimizedChunks.map(chunk => ({
        chunkNumber: chunk.chunk_number,
        heading: chunk.heading,
        originalText: chunk.original_text,
        optimizedText: chunk.optimized_text,
        changes: chunk.changes_applied,
        scores: chunk.scores,
      })),
      explanations: optimizationResult.explanations,
      summary: optimizationResult.summary,
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
    toast.success('Exported full report as JSON');
  };

  const handleApplyEdits = () => {
    onApplyContent(editableContent);
    toast.success('Content updated');
  };

  const toggleChunk = (idx: number) => {
    setExpandedChunks(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // Calculate stats
  const stats = useMemo(() => {
    const chunks = optimizationResult.optimizedChunks;
    const summary = optimizationResult.summary;

    const originalWordCount = originalContent.trim().split(/\s+/).length;
    const optimizedWordCount = optimizedContent.trim().split(/\s+/).length;
    const wordCountDiff = optimizedWordCount - originalWordCount;

    return {
      chunksOptimized: chunks.length,
      totalChanges: chunks.reduce((sum, c) => sum + c.changes_applied.length, 0),
      queriesTargeted: keywords.length,
      originalWordCount,
      optimizedWordCount,
      wordCountDiff,
      overallOriginalAvg: summary?.overallOriginalAvg ?? 0,
      overallOptimizedAvg: summary?.overallOptimizedAvg ?? 0,
      overallPercentChange: summary?.overallPercentChange ?? 0,
      timestamp: optimizationResult.timestamp,
    };
  }, [optimizationResult, originalContent, optimizedContent, keywords]);

  // Calculate per-chunk improvements
  const chunkImprovements = useMemo(() => {
    return optimizationResult.optimizedChunks.map((chunk, idx) => {
      const originalScores = optimizationResult.originalFullScores?.[idx] || {};
      const optimizedScores = optimizationResult.optimizedFullScores?.[idx] || {};
      
      let totalOriginal = 0;
      let totalOptimized = 0;
      let count = 0;

      Object.keys(optimizedScores).forEach(query => {
        if (originalScores[query] && optimizedScores[query]) {
          totalOriginal += originalScores[query].passageScore;
          totalOptimized += optimizedScores[query].passageScore;
          count++;
        }
      });

      const avgOriginal = count > 0 ? totalOriginal / count : 0;
      const avgOptimized = count > 0 ? totalOptimized / count : 0;
      const improvement = avgOriginal > 0 ? ((avgOptimized - avgOriginal) / avgOriginal) * 100 : 0;

      return {
        chunk,
        avgOriginal,
        avgOptimized,
        improvement,
        changeCount: chunk.changes_applied.length,
      };
    });
  }, [optimizationResult]);

  const ImprovementIcon = ({ value }: { value: number }) => {
    if (value > 1) return <TrendingUp className="h-4 w-4 text-success" />;
    if (value < -1) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const severityColors: Record<string, string> = {
    minor: 'text-muted-foreground',
    moderate: 'text-warning',
    significant: 'text-destructive',
  };

  const impactColors: Record<string, string> = {
    high: 'text-success',
    medium: 'text-primary',
    low: 'text-muted-foreground',
    unlikely: 'text-muted-foreground/50',
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-accent" />
            Optimization Report
          </h3>
          <Badge variant="outline" className="text-xs">
            {new Date(stats.timestamp).toLocaleDateString()} {new Date(stats.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-1.5" />
            Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExportMarkdown}>
            <FileText className="h-4 w-4 mr-1.5" />
            Export MD
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExportReport}>
            <FileJson className="h-4 w-4 mr-1.5" />
            Full Report
          </Button>
          <Button variant="outline" size="sm" onClick={onReanalyze}>
            <Play className="h-4 w-4 mr-1.5" />
            Re-analyze
          </Button>
          {onSaveProject && (
            <Button size="sm" onClick={onSaveProject}>
              Save Project
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-5xl mx-auto space-y-8">
          {/* Journey Overview */}
          <section className="panel">
            <div className="panel-header">
              <h4 className="text-label flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Optimization Journey
              </h4>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-muted/30 rounded-lg text-center min-w-[100px]">
                  <div className="text-lg font-bold text-foreground">{stats.originalWordCount}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Original Words</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="p-3 bg-muted/30 rounded-lg text-center min-w-[100px]">
                  <div className="text-lg font-bold text-foreground">{stats.chunksOptimized}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Chunks</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="p-3 bg-muted/30 rounded-lg text-center min-w-[100px]">
                  <div className="text-lg font-bold text-foreground">{stats.queriesTargeted}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Queries</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg text-center min-w-[100px]">
                  <div className="text-lg font-bold text-accent">{stats.optimizedWordCount}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Optimized Words</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {stats.wordCountDiff > 0 ? '+' : ''}{stats.wordCountDiff} words
              </div>
            </div>
          </section>

          {/* Score Improvement Hero */}
          <section className="panel">
            <div className="panel-header">
              <h4 className="text-label flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Score Improvement
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Original */}
              <div className="p-4 bg-muted/20 rounded-lg text-center">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Original</div>
                <div className={cn(
                  "text-3xl font-bold",
                  getScoreColorClass(stats.overallOriginalAvg / 100)
                )}>
                  {stats.overallOriginalAvg.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Avg Passage Score</div>
              </div>

              {/* Arrow with improvement */}
              <div className="flex flex-col items-center justify-center">
                <div className={cn(
                  "text-2xl font-bold flex items-center gap-2",
                  getImprovementColorClass(stats.overallPercentChange)
                )}>
                  <ImprovementIcon value={stats.overallPercentChange} />
                  {formatImprovement(stats.overallPercentChange)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Improvement</div>
              </div>

              {/* Optimized */}
              <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg text-center">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Optimized</div>
                <div className={cn(
                  "text-3xl font-bold",
                  getScoreColorClass(stats.overallOptimizedAvg / 100)
                )}>
                  {stats.overallOptimizedAvg.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Avg Passage Score</div>
              </div>
            </div>

            {/* Quick stats row */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{stats.chunksOptimized}</div>
                <div className="text-xs text-muted-foreground">Chunks Optimized</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{stats.totalChanges}</div>
                <div className="text-xs text-muted-foreground">Changes Applied</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{optimizationResult.explanations.length}</div>
                <div className="text-xs text-muted-foreground">Explanations</div>
              </div>
            </div>
          </section>

          {/* Chunk-by-Chunk Breakdown */}
          <section className="panel">
            <div className="panel-header">
              <h4 className="text-label flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Chunk-by-Chunk Breakdown
              </h4>
            </div>
            <div className="space-y-2">
              {chunkImprovements.map((item, idx) => (
                <Collapsible
                  key={idx}
                  open={expandedChunks.has(idx)}
                  onOpenChange={() => toggleChunk(idx)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/30 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        {expandedChunks.has(idx) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Badge variant="outline">Chunk {item.chunk.chunk_number}</Badge>
                        {item.chunk.heading && (
                          <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {item.chunk.heading}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-mono">
                          <span className="text-muted-foreground">{item.avgOriginal.toFixed(0)}</span>
                          <span className="text-muted-foreground mx-2">→</span>
                          <span className={getScoreColorClass(item.avgOptimized / 100)}>
                            {item.avgOptimized.toFixed(0)}
                          </span>
                        </div>
                        <div className={cn(
                          "flex items-center gap-1 text-sm font-medium min-w-[80px] justify-end",
                          getImprovementColorClass(item.improvement)
                        )}>
                          <ImprovementIcon value={item.improvement} />
                          {formatImprovement(item.improvement)}
                        </div>
                        <Badge variant="secondary" className="min-w-[60px] justify-center">
                          {item.changeCount} change{item.changeCount !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 ml-7 p-4 bg-background border border-border rounded-lg space-y-4">
                      {/* Changes applied */}
                      <div className="space-y-2">
                        <h5 className="text-xs uppercase tracking-wider text-muted-foreground">Changes Applied</h5>
                        {item.chunk.changes_applied.map((change, changeIdx) => {
                          const explanation = optimizationResult.explanations.find(
                            e => e.change_id === change.change_id
                          );
                          return (
                            <div key={changeIdx} className="p-3 bg-surface border border-border/50 rounded text-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-[10px]">
                                  {change.change_type.replace('_', ' ')}
                                </Badge>
                                {change.actual_scores && (
                                  <span className={cn(
                                    "text-xs font-mono",
                                    getImprovementColorClass(change.actual_scores.improvement_pct)
                                  )}>
                                    {formatImprovement(change.actual_scores.improvement_pct)}
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground">{change.reason}</p>
                              {explanation && (
                                <div className="mt-2 pt-2 border-t border-border/50">
                                  <p className="text-primary text-xs">{explanation.impact_summary}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Text preview */}
                      <div className="space-y-2">
                        <h5 className="text-xs uppercase tracking-wider text-muted-foreground">Optimized Text Preview</h5>
                        <div className="p-3 bg-muted/10 rounded text-sm text-muted-foreground line-clamp-4">
                          {item.chunk.optimized_text.slice(0, 300)}
                          {item.chunk.optimized_text.length > 300 && '...'}
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </section>

          {/* Further Suggestions */}
          {optimizationResult.summary?.furtherSuggestions && optimizationResult.summary.furtherSuggestions.length > 0 && (
            <Collapsible open={showSuggestions} onOpenChange={setShowSuggestions}>
              <section className="panel">
                <CollapsibleTrigger className="w-full">
                  <div className="panel-header flex items-center justify-between">
                    <h4 className="text-label flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Further Optimization Suggestions
                      <Badge variant="secondary" className="ml-2">
                        {optimizationResult.summary.furtherSuggestions.length}
                      </Badge>
                    </h4>
                    {showSuggestions ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3 mt-4">
                    {optimizationResult.summary.furtherSuggestions.map((suggestion, idx) => (
                      <div key={idx} className="p-4 bg-muted/20 rounded-lg space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm text-foreground">{suggestion.suggestion}</p>
                          <Badge variant="outline" className={cn("shrink-0", impactColors[suggestion.expectedImpact])}>
                            {suggestion.expectedImpact} impact
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{suggestion.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </section>
            </Collapsible>
          )}

          {/* Trade-off Considerations */}
          {optimizationResult.summary?.tradeOffConsiderations && optimizationResult.summary.tradeOffConsiderations.length > 0 && (
            <Collapsible open={showTradeOffs} onOpenChange={setShowTradeOffs}>
              <section className="panel">
                <CollapsibleTrigger className="w-full">
                  <div className="panel-header flex items-center justify-between">
                    <h4 className="text-label flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Trade-off Considerations
                      <Badge variant="secondary" className="ml-2">
                        {optimizationResult.summary.tradeOffConsiderations.length}
                      </Badge>
                    </h4>
                    {showTradeOffs ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3 mt-4">
                    {optimizationResult.summary.tradeOffConsiderations.map((tradeoff, idx) => (
                      <div key={idx} className="p-4 bg-muted/20 rounded-lg">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <Badge variant="outline" className="uppercase text-[10px]">
                              {tradeoff.category}
                            </Badge>
                            <p className="text-sm text-foreground">{tradeoff.concern}</p>
                          </div>
                          <Badge variant="outline" className={cn("shrink-0", severityColors[tradeoff.severity])}>
                            {tradeoff.severity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </section>
            </Collapsible>
          )}

          {/* Optimized Content */}
          <Collapsible open={showContent} onOpenChange={setShowContent}>
            <section className="panel">
              <CollapsibleTrigger className="w-full">
                <div className="panel-header flex items-center justify-between">
                  <h4 className="text-label flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Optimized Content
                  </h4>
                  {showContent ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-4 border border-border rounded-lg overflow-hidden">
                  <div className="h-[400px]">
                    <MarkdownEditor
                      value={editableContent}
                      onChange={setEditableContent}
                      placeholder="Optimized content..."
                    />
                  </div>
                  {editableContent !== optimizedContent && (
                    <div className="p-4 border-t border-border bg-surface flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">You have unsaved edits</span>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditableContent(optimizedContent)}>
                          <RotateCcw className="h-4 w-4 mr-1.5" />
                          Reset
                        </Button>
                        <Button size="sm" onClick={handleApplyEdits}>
                          <Check className="h-4 w-4 mr-1.5" />
                          Apply Edits
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </section>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
