import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight, AlertCircle, Zap, Circle, TrendingUp } from 'lucide-react';
import type { ChunkDiagnostics } from '@/hooks/useAnalysis';
import type { FailureMode } from '@/lib/diagnostic-scoring';

interface TopIssuesPanelProps {
  diagnostics: ChunkDiagnostics[];
  onNavigateToChunk?: (chunkIndex: number) => void;
  className?: string;
}

const FAILURE_MODE_LABELS: Record<FailureMode, string> = {
  topic_mismatch: 'Topic Mismatch',
  missing_specifics: 'Needs Specifics',
  buried_answer: 'Buried Answer',
  vocabulary_gap: 'Missing Terms',
  no_direct_answer: 'No Direct Answer',
  structure_problem: 'Structure Issue',
  already_optimized: 'Optimized',
};

export function TopIssuesPanel({ diagnostics, onNavigateToChunk, className }: TopIssuesPanelProps) {
  const topIssues = useMemo(() => {
    if (!diagnostics || diagnostics.length === 0) return [];
    
    // Filter out already optimized and sort by expected improvement
    return diagnostics
      .filter(d => d.scores.diagnosis.primaryFailureMode !== 'already_optimized')
      .sort((a, b) => b.scores.diagnosis.expectedImprovement - a.scores.diagnosis.expectedImprovement)
      .slice(0, 5)
      .map((d, rank) => ({
        rank: rank + 1,
        chunkIndex: d.chunkIndex,
        query: d.query,
        failureMode: d.scores.diagnosis.primaryFailureMode,
        recommendedFix: d.scores.diagnosis.recommendedFix,
        expectedImprovement: d.scores.diagnosis.expectedImprovement,
        fixPriority: d.scores.diagnosis.fixPriority,
      }));
  }, [diagnostics]);

  if (topIssues.length === 0) {
    return (
      <Card className={cn("border-border/50 bg-surface", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Top Issues to Address
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-[hsl(var(--success))]/10 flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-[hsl(var(--success))]" />
            </div>
            <p className="text-sm font-medium text-foreground">All chunks optimized!</p>
            <p className="text-xs text-muted-foreground mt-1">No critical issues remaining</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border/50 bg-surface", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Top Issues to Address
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {topIssues.map((issue) => {
            const PriorityIcon = 
              issue.fixPriority === 'critical' ? AlertCircle :
              issue.fixPriority === 'important' ? Zap : Circle;
            
            const priorityColor = 
              issue.fixPriority === 'critical' ? 'text-[hsl(var(--destructive))]' :
              issue.fixPriority === 'important' ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground';
            
            return (
              <button
                key={`${issue.chunkIndex}-${issue.query}`}
                onClick={() => onNavigateToChunk?.(issue.chunkIndex)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border border-border/50",
                  "bg-muted/20 hover:bg-muted/40 transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20",
                  "group"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Rank */}
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                    issue.fixPriority === 'critical' && "bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]",
                    issue.fixPriority === 'important' && "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
                    issue.fixPriority === 'minor' && "bg-muted text-muted-foreground"
                  )}>
                    {issue.rank}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <PriorityIcon className={cn("w-3.5 h-3.5 shrink-0", priorityColor)} />
                      <span className="text-sm font-medium text-foreground truncate">
                        Chunk {issue.chunkIndex + 1} × "{issue.query}"
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {FAILURE_MODE_LABELS[issue.failureMode]} · {issue.recommendedFix}
                    </p>
                  </div>
                  
                  {/* Expected improvement */}
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-[hsl(var(--success))] tabular-nums">
                      +{issue.expectedImprovement}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      pts possible
                    </span>
                  </div>
                  
                  {/* Arrow on hover */}
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-center" />
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Total improvement potential */}
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Total improvement potential from top 5
          </span>
          <span className="text-sm font-bold text-[hsl(var(--success))] tabular-nums">
            +{topIssues.reduce((sum, i) => sum + i.expectedImprovement, 0)} pts
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
