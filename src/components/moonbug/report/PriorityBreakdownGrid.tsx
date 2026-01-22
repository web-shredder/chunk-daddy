import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AlertCircle, Zap, Circle, CheckCircle2 } from 'lucide-react';
import type { ChunkDiagnostics } from '@/hooks/useAnalysis';

interface PriorityBreakdownGridProps {
  diagnostics: ChunkDiagnostics[];
  className?: string;
}

interface PriorityConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  glowClass?: string;
}

const PRIORITY_CONFIG: Record<string, PriorityConfig> = {
  critical: {
    label: 'Critical',
    icon: AlertCircle,
    color: 'text-[hsl(var(--destructive))]',
    bgColor: 'bg-[hsl(var(--destructive))]/10',
    borderColor: 'border-[hsl(var(--destructive))]/30',
    glowClass: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
  },
  important: {
    label: 'Important',
    icon: Zap,
    color: 'text-[hsl(var(--warning))]',
    bgColor: 'bg-[hsl(var(--warning))]/10',
    borderColor: 'border-[hsl(var(--warning))]/30',
    glowClass: 'shadow-[0_0_15px_rgba(234,179,8,0.1)]',
  },
  minor: {
    label: 'Minor',
    icon: Circle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30',
    borderColor: 'border-border',
  },
  none: {
    label: 'Optimized',
    icon: CheckCircle2,
    color: 'text-[hsl(var(--success))]',
    bgColor: 'bg-[hsl(var(--success))]/10',
    borderColor: 'border-[hsl(var(--success))]/30',
    glowClass: 'shadow-[0_0_15px_rgba(34,197,94,0.1)]',
  },
};

export function PriorityBreakdownGrid({ diagnostics, className }: PriorityBreakdownGridProps) {
  const priorityCounts = useMemo(() => {
    const counts = { critical: 0, important: 0, minor: 0, none: 0 };
    
    diagnostics.forEach(d => {
      counts[d.scores.diagnosis.fixPriority]++;
    });
    
    const total = diagnostics.length;
    
    return {
      critical: { count: counts.critical, percentage: Math.round((counts.critical / total) * 100) },
      important: { count: counts.important, percentage: Math.round((counts.important / total) * 100) },
      minor: { count: counts.minor, percentage: Math.round((counts.minor / total) * 100) },
      none: { count: counts.none, percentage: Math.round((counts.none / total) * 100) },
      total,
    };
  }, [diagnostics]);

  if (!diagnostics || diagnostics.length === 0) {
    return null;
  }

  return (
    <Card className={cn("border-border/50 bg-surface", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
          Action Priority
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-3">
          {(['critical', 'important', 'minor', 'none'] as const).map((priority) => {
            const config = PRIORITY_CONFIG[priority];
            const data = priorityCounts[priority];
            const Icon = config.icon;
            
            return (
              <div
                key={priority}
                className={cn(
                  "relative rounded-xl p-4 border transition-all duration-200",
                  config.bgColor,
                  config.borderColor,
                  config.glowClass,
                  "hover:scale-[1.02] cursor-default"
                )}
              >
                {/* Priority indicator dot for critical */}
                {priority === 'critical' && data.count > 0 && (
                  <div className="absolute top-2 right-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--destructive))] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--destructive))]"></span>
                    </span>
                  </div>
                )}
                
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    config.bgColor
                  )}>
                    <Icon className={cn("w-5 h-5", config.color)} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <span className={cn("text-3xl font-bold tabular-nums block leading-none", config.color)}>
                      {data.count}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-1 block">
                      {config.label}
                    </span>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="mt-3 h-1 bg-muted/30 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out",
                      priority === 'critical' && "bg-[hsl(var(--destructive))]",
                      priority === 'important' && "bg-[hsl(var(--warning))]",
                      priority === 'minor' && "bg-muted-foreground/50",
                      priority === 'none' && "bg-[hsl(var(--success))]"
                    )}
                    style={{ width: `${data.percentage}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  {data.percentage}% of pairs
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
