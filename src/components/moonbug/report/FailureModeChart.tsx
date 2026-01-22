import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { 
  CheckCircle, XCircle, AlertTriangle, EyeOff, 
  TextCursor, HelpCircle, Layout 
} from 'lucide-react';
import type { ChunkDiagnostics } from '@/hooks/useAnalysis';
import type { FailureMode } from '@/lib/diagnostic-scoring';

interface FailureModeChartProps {
  diagnostics: ChunkDiagnostics[];
  className?: string;
}

interface FailureModeConfig {
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  actionHint: string;
}

const FAILURE_MODE_CONFIG: Record<FailureMode, FailureModeConfig> = {
  already_optimized: {
    label: 'Already Optimized',
    shortLabel: 'Optimized',
    icon: CheckCircle,
    color: 'text-[hsl(var(--success))]',
    bgColor: 'bg-[hsl(var(--success))]',
    actionHint: 'No changes needed',
  },
  vocabulary_gap: {
    label: 'Missing Terms',
    shortLabel: 'Terms',
    icon: TextCursor,
    color: 'text-[hsl(var(--info))]',
    bgColor: 'bg-[hsl(var(--info))]',
    actionHint: 'Add query vocabulary',
  },
  no_direct_answer: {
    label: 'No Direct Answer',
    shortLabel: 'Answer',
    icon: HelpCircle,
    color: 'text-[hsl(var(--destructive))]',
    bgColor: 'bg-[hsl(var(--destructive))]',
    actionHint: 'Add explicit answers',
  },
  buried_answer: {
    label: 'Buried Answer',
    shortLabel: 'Buried',
    icon: EyeOff,
    color: 'text-[hsl(var(--warning))]',
    bgColor: 'bg-[hsl(var(--warning))]',
    actionHint: 'Move to first sentence',
  },
  missing_specifics: {
    label: 'Needs Specifics',
    shortLabel: 'Specifics',
    icon: AlertTriangle,
    color: 'text-[hsl(var(--tier-moderate))]',
    bgColor: 'bg-[hsl(var(--tier-moderate))]',
    actionHint: 'Add data, names, dates',
  },
  structure_problem: {
    label: 'Structure Issue',
    shortLabel: 'Structure',
    icon: Layout,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500',
    actionHint: 'Use lists or headings',
  },
  topic_mismatch: {
    label: 'Topic Mismatch',
    shortLabel: 'Mismatch',
    icon: XCircle,
    color: 'text-[hsl(var(--destructive))]',
    bgColor: 'bg-[hsl(var(--destructive))]',
    actionHint: 'Wrong content assignment',
  },
};

export function FailureModeChart({ diagnostics, className }: FailureModeChartProps) {
  const chartData = useMemo(() => {
    const counts: Record<FailureMode, number> = {
      already_optimized: 0,
      vocabulary_gap: 0,
      no_direct_answer: 0,
      buried_answer: 0,
      missing_specifics: 0,
      structure_problem: 0,
      topic_mismatch: 0,
    };
    
    diagnostics.forEach(d => {
      counts[d.scores.diagnosis.primaryFailureMode]++;
    });
    
    const total = diagnostics.length;
    
    // Sort by count descending, but keep already_optimized at top if it has highest count
    const sortedModes = Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([mode, count]) => ({
        mode: mode as FailureMode,
        count,
        percentage: Math.round((count / total) * 100),
        config: FAILURE_MODE_CONFIG[mode as FailureMode],
      }));
    
    const maxCount = sortedModes.length > 0 ? sortedModes[0].count : 1;
    
    return { sortedModes, total, maxCount };
  }, [diagnostics]);

  if (!diagnostics || diagnostics.length === 0) {
    return null;
  }

  return (
    <Card className={cn("border-border/50 bg-surface", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          Failure Mode Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {chartData.sortedModes.map(({ mode, count, percentage, config }, index) => {
            const Icon = config.icon;
            const barWidth = (count / chartData.maxCount) * 100;
            
            return (
              <div 
                key={mode}
                className={cn(
                  "group",
                  index === 0 && mode === 'already_optimized' && "pb-3 border-b border-border/50 mb-3"
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    "bg-muted/50 group-hover:bg-muted/70 transition-colors"
                  )}>
                    <Icon className={cn("w-4 h-4", config.color)} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {config.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {percentage}%
                        </span>
                        <span className="text-sm font-bold tabular-nums text-foreground w-6 text-right">
                          {count}
                        </span>
                      </div>
                    </div>
                    
                    {/* Bar */}
                    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-700 ease-out",
                          config.bgColor,
                          mode === 'already_optimized' && "opacity-70"
                        )}
                        style={{ 
                          width: `${barWidth}%`,
                          animationDelay: `${index * 100}ms`
                        }}
                      />
                    </div>
                    
                    {/* Action hint - show on hover or if not optimized */}
                    {mode !== 'already_optimized' && (
                      <p className="text-xs text-muted-foreground mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        {config.actionHint}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Footer summary */}
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <span>{chartData.total} total chunk-query pairs analyzed</span>
          {chartData.sortedModes.find(m => m.mode === 'already_optimized') && (
            <span className="text-[hsl(var(--success))]">
              {chartData.sortedModes.find(m => m.mode === 'already_optimized')?.percentage}% optimized
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
