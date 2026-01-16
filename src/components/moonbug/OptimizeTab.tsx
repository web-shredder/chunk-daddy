import { useState } from 'react';
import { 
  Sparkles, 
  Copy, 
  Download, 
  FileText, 
  FileJson, 
  RotateCcw,
  Check,
  ArrowLeft,
  Play,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { OptimizationEngine } from '@/components/optimizer/OptimizationEngine';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { formatScore, getScoreColorClass, formatImprovement, getImprovementColorClass } from '@/lib/similarity';
import type { FullOptimizationResult, ValidatedChunk } from '@/lib/optimizer-types';
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
}

interface ReportViewProps {
  optimizedContent: string;
  result: FullOptimizationResult;
  originalContent: string;
  onEditContent: (content: string) => void;
  onBack: () => void;
  onReanalyze: () => void;
}

function ReportView({ 
  optimizedContent, 
  result, 
  originalContent,
  onEditContent,
  onBack,
  onReanalyze,
}: ReportViewProps) {
  const [activeReportTab, setActiveReportTab] = useState<'content' | 'analysis'>('content');
  const [editableContent, setEditableContent] = useState(optimizedContent);

  const handleCopy = () => {
    navigator.clipboard.writeText(editableContent);
    toast.success('Optimized content copied to clipboard');
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
      originalContent: result.originalContent,
      optimizedContent: editableContent,
      analysis: result.analysis,
      chunks: result.optimizedChunks.map(chunk => ({
        chunkNumber: chunk.chunk_number,
        heading: chunk.heading,
        originalText: chunk.original_text,
        optimizedText: chunk.optimized_text,
        changes: chunk.changes_applied,
        scores: chunk.scores,
      })),
      explanations: result.explanations,
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
    onEditContent(editableContent);
    toast.success('Content updated');
  };

  // Calculate aggregate improvements
  const calculateAggregateScores = () => {
    const chunks = result.optimizedChunks;
    if (!chunks.length) return null;

    let totalOriginal = 0;
    let totalNew = 0;
    let changesWithScores = 0;

    chunks.forEach(chunk => {
      chunk.changes_applied.forEach(change => {
        if (change.actual_scores) {
          totalNew += change.actual_scores.new_score;
          changesWithScores++;
        }
      });
    });

    // Calculate average scores from chunk scores if available
    const avgScores: Record<string, { avg: number; count: number }> = {};
    chunks.forEach(chunk => {
      if (chunk.scores) {
        Object.entries(chunk.scores).forEach(([key, value]) => {
          if (!avgScores[key]) {
            avgScores[key] = { avg: 0, count: 0 };
          }
          avgScores[key].avg += value;
          avgScores[key].count++;
        });
      }
    });

    return {
      chunksOptimized: chunks.length,
      totalChanges: chunks.reduce((sum, c) => sum + c.changes_applied.length, 0),
      avgScores: Object.fromEntries(
        Object.entries(avgScores).map(([key, val]) => [key, val.avg / val.count])
      ),
    };
  };

  const stats = calculateAggregateScores();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="icon-button" title="Back to optimizer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Optimization Report
          </h3>
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
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeReportTab} onValueChange={(v) => setActiveReportTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-4 border-b border-border">
          <TabsList className="bg-transparent">
            <TabsTrigger value="content" className="data-[state=active]:bg-accent/20">
              <FileText className="h-4 w-4 mr-1.5" />
              Optimized Content
            </TabsTrigger>
            <TabsTrigger value="analysis" className="data-[state=active]:bg-accent/20">
              <TrendingUp className="h-4 w-4 mr-1.5" />
              Analysis Summary
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="content" className="flex-1 m-0 overflow-hidden">
          <div className="h-full flex flex-col">
            <MarkdownEditor
              value={editableContent}
              onChange={setEditableContent}
              placeholder="Optimized content..."
            />
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
        </TabsContent>

        <TabsContent value="analysis" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-8">
              {/* Summary Stats */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-background border border-border rounded-lg">
                    <div className="text-2xl font-bold text-foreground">{stats.chunksOptimized}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Chunks Optimized</div>
                  </div>
                  <div className="p-4 bg-background border border-border rounded-lg">
                    <div className="text-2xl font-bold text-foreground">{stats.totalChanges}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Changes</div>
                  </div>
                  <div className="p-4 bg-background border border-border rounded-lg">
                    <div className="text-2xl font-bold text-foreground">{result.explanations.length}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Explanations</div>
                  </div>
                  <div className="p-4 bg-background border border-border rounded-lg">
                    <div className="text-2xl font-bold text-foreground">
                      {new Date(result.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Optimized At</div>
                  </div>
                </div>
              )}

              {/* Per-Chunk Results */}
              <div>
                <h4 className="text-label mb-4">Chunk-by-Chunk Results</h4>
                <div className="space-y-4">
                  {result.optimizedChunks.map((chunk, idx) => (
                    <div key={idx} className="p-4 bg-background border border-border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Chunk {chunk.chunk_number}</Badge>
                          {chunk.heading && (
                            <span className="text-sm text-muted-foreground">{chunk.heading}</span>
                          )}
                        </div>
                        <Badge variant="secondary">
                          {chunk.changes_applied.length} change{chunk.changes_applied.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>

                      {/* Scores for this chunk */}
                      {chunk.scores && Object.keys(chunk.scores).length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          {Object.entries(chunk.scores).map(([algorithm, score]) => (
                            <div key={algorithm} className="space-y-1">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                {algorithm}
                              </div>
                              <div className={cn(
                                "font-mono text-sm font-semibold",
                                algorithm === 'cosine' || algorithm === 'chamfer' 
                                  ? getScoreColorClass(score)
                                  : 'text-foreground'
                              )}>
                                {formatScore(score)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Changes */}
                      <div className="space-y-2">
                        {chunk.changes_applied.map((change, changeIdx) => (
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
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Explanations */}
              {result.explanations.length > 0 && (
                <div>
                  <h4 className="text-label mb-4">Change Explanations</h4>
                  <div className="space-y-3">
                    {result.explanations.map((exp, idx) => (
                      <div key={idx} className="p-4 bg-background border border-border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="font-medium text-foreground">{exp.title}</h5>
                          <Badge variant="outline" className="text-[10px]">{exp.change_id}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{exp.explanation}</p>
                        <p className="text-sm text-primary">{exp.impact_summary}</p>
                        {exp.trade_offs && (
                          <p className="text-xs text-warning">{exp.trade_offs}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
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
}: OptimizeTabProps) {
  const [optimizationResult, setOptimizationResult] = useState<FullOptimizationResult | null>(null);
  const [optimizedContent, setOptimizedContent] = useState<string>('');
  const [showReport, setShowReport] = useState(false);

  if (!hasResults) {
    return (
      <div className="flex-1 flex items-center justify-center">
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

  const handleOptimizationComplete = (result: FullOptimizationResult, finalContent: string) => {
    setOptimizationResult(result);
    setOptimizedContent(finalContent);
    setShowReport(true);
  };

  const handleApplyFromReport = (newContent: string) => {
    setOptimizedContent(newContent);
    onApplyOptimization(newContent);
  };

  const handleBackToOptimizer = () => {
    setShowReport(false);
  };

  if (showReport && optimizationResult) {
    return (
      <ReportView
        optimizedContent={optimizedContent}
        result={optimizationResult}
        originalContent={content}
        onEditContent={handleApplyFromReport}
        onBack={handleBackToOptimizer}
        onReanalyze={onReanalyze}
      />
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <ScrollArea className="h-full">
        <div className="p-6 max-w-5xl mx-auto">
          <div className="panel">
            <div className="panel-header">
              <h3 className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                Auto-Optimize Content
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                AI-powered content optimization to improve chunk relevance for your queries
              </p>
            </div>

            <OptimizationEngine
              content={content}
              keywords={keywords}
              currentScores={currentScores?.flatMap(cs => cs.keywordScores)}
              onApplyOptimization={(optimizedContent) => {
                // This is for backward compatibility - direct apply
                onApplyOptimization(optimizedContent);
              }}
              onOptimizationComplete={handleOptimizationComplete}
              onSaveProject={onSaveProject}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
