import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Search, Sparkles, Quote, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getTierFromScore, TIER_COLORS } from '@/lib/tier-colors';
import type { ChunkDiagnostics } from '@/hooks/useAnalysis';

interface StageScoreBreakdownProps {
  diagnostics: ChunkDiagnostics[];
  className?: string;
}

interface StageConfig {
  key: 'retrieval' | 'rerank' | 'citation';
  label: string;
  description: string;
  icon: React.ElementType;
}

const STAGES: StageConfig[] = [
  { 
    key: 'retrieval', 
    label: 'Retrieval', 
    description: 'Semantic + Lexical matching',
    icon: Search,
  },
  { 
    key: 'rerank', 
    label: 'Rerank', 
    description: 'Entity + Answer prominence',
    icon: Sparkles,
  },
  { 
    key: 'citation', 
    label: 'Citation', 
    description: 'Specificity + Quotability',
    icon: Quote,
  },
];

export function StageScoreBreakdown({ diagnostics, className }: StageScoreBreakdownProps) {
  const stageScores = useMemo(() => {
    if (!diagnostics || diagnostics.length === 0) {
      return { retrieval: 0, rerank: 0, citation: 0 };
    }
    
    let totalRetrieval = 0;
    let totalRerank = 0;
    let totalCitation = 0;
    
    diagnostics.forEach(d => {
      totalRetrieval += d.scores.hybridRetrieval;
      totalRerank += d.scores.rerank.score;
      totalCitation += d.scores.citation.score;
    });
    
    const count = diagnostics.length;
    
    return {
      retrieval: Math.round(totalRetrieval / count),
      rerank: Math.round(totalRerank / count),
      citation: Math.round(totalCitation / count),
    };
  }, [diagnostics]);

  // Find best and worst stages
  const insights = useMemo(() => {
    const scores = [
      { key: 'retrieval', score: stageScores.retrieval, label: 'Retrieval' },
      { key: 'rerank', score: stageScores.rerank, label: 'Rerank' },
      { key: 'citation', score: stageScores.citation, label: 'Citation' },
    ].sort((a, b) => b.score - a.score);
    
    const best = scores[0];
    const worst = scores[2];
    const diff = best.score - worst.score;
    
    return {
      best: best.key as 'retrieval' | 'rerank' | 'citation',
      worst: worst.key as 'retrieval' | 'rerank' | 'citation',
      dropOff: diff > 10 ? worst : null,
    };
  }, [stageScores]);

  if (!diagnostics || diagnostics.length === 0) {
    return null;
  }

  return (
    <Card className={cn("border-border/50 bg-surface", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
          Pipeline Stage Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {STAGES.map((stage) => {
            const score = stageScores[stage.key];
            const tier = getTierFromScore(score);
            const tierColors = TIER_COLORS[tier];
            const Icon = stage.icon;
            const isBest = insights.best === stage.key;
            const isDropOff = insights.dropOff?.key === stage.key;
            
            return (
              <div key={stage.key} className="group">
                <div className="flex items-center gap-3 mb-2">
                  {/* Icon */}
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    "bg-muted/50 group-hover:bg-muted/70 transition-colors"
                  )}>
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  
                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {stage.label}
                      </span>
                      {isBest && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[hsl(var(--success))] bg-[hsl(var(--success))]/10 px-1.5 py-0.5 rounded-full">
                          <TrendingUp className="w-3 h-3" />
                          Best
                        </span>
                      )}
                      {isDropOff && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10 px-1.5 py-0.5 rounded-full">
                          <TrendingDown className="w-3 h-3" />
                          Drop-off
                        </span>
                      )}
                      {!isBest && !isDropOff && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-full">
                          <Minus className="w-3 h-3" />
                          Stable
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {stage.description}
                    </span>
                  </div>
                  
                  {/* Score */}
                  <span className={cn(
                    "text-2xl font-bold tabular-nums",
                    tierColors.text
                  )}>
                    {score}
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden ml-11">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out",
                      tierColors.bg
                    )}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Insight message */}
        {insights.dropOff && (
          <div className="mt-4 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              <span className="text-[hsl(var(--warning))]">⚠</span>{' '}
              {insights.dropOff.label} stage is {stageScores[insights.best] - stageScores[insights.dropOff.key]} points below {STAGES.find(s => s.key === insights.best)?.label}. 
              Focus optimization here for biggest gains.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
