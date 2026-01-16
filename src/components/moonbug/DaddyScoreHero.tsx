import { Zap, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  getDaddyScoreTier,
  getDaddyScoreInterpretation,
  getDaddyScoreRecommendation,
  getDaddyScoreTierBgClass,
  getDaddyScoreBorderClass,
  getDaddyScoreTierColorClass,
  formatImprovement,
  calculateImprovement,
  type DaddyScoreTier,
} from '@/lib/similarity';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface DaddyScoreHeroProps {
  score: number;
  previousScore?: number;
  cosineScore?: number;
  chamferScore?: number;
}

export function DaddyScoreHero({ score, previousScore, cosineScore, chamferScore }: DaddyScoreHeroProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const tier = getDaddyScoreTier(score);
  const interpretation = getDaddyScoreInterpretation(score);
  const recommendation = getDaddyScoreRecommendation(score);
  
  // Calculate improvement if previous score provided
  const improvement = previousScore !== undefined 
    ? calculateImprovement(previousScore, score)
    : null;

  const getTierGradientClass = (tier: DaddyScoreTier) => {
    const gradients: Record<DaddyScoreTier, string> = {
      excellent: 'from-background to-green-500/5',
      good: 'from-background to-green-400/5',
      moderate: 'from-background to-yellow-500/5',
      weak: 'from-background to-orange-500/5',
      poor: 'from-background to-red-500/5'
    };
    return gradients[tier];
  };

  return (
    <div className={cn(
      "p-6 border-2 rounded-lg mb-6 transition-colors bg-gradient-to-br",
      getDaddyScoreBorderClass(tier),
      getTierGradientClass(tier)
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className={cn("h-4 w-4", getDaddyScoreTierColorClass(tier))} />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Daddy Score
          </span>
        </div>
        
        {improvement !== null && (
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded bg-muted/50 text-xs font-semibold font-mono",
            improvement > 0 && "text-green-500",
            improvement < 0 && "text-red-500",
            improvement === 0 && "text-muted-foreground"
          )}>
            {improvement > 0 && <TrendingUp className="h-3 w-3" />}
            {improvement < 0 && <TrendingDown className="h-3 w-3" />}
            {improvement === 0 && <Minus className="h-3 w-3" />}
            {formatImprovement(improvement)}
          </div>
        )}
      </div>
      
      {/* Score Display */}
      <div className="flex items-baseline gap-1 mb-3">
        <span className={cn(
          "text-6xl font-bold font-mono tracking-tight",
          getDaddyScoreTierColorClass(tier)
        )}>
          {score}
        </span>
        <span className="text-2xl font-semibold text-muted-foreground font-mono">
          /100
        </span>
      </div>
      
      {/* Tier Badge */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
        <span className={cn(
          "px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wide",
          getDaddyScoreTierBgClass(tier)
        )}>
          {tier}
        </span>
        <span className="text-xs text-muted-foreground">
          Retrieval Probability
        </span>
      </div>
      
      {/* Interpretation */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {interpretation}
        </p>
      </div>
      
      {/* Recommendation */}
      <div className="p-3 bg-muted/30 rounded-md mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Recommendation
        </p>
        <p className="text-xs text-foreground leading-relaxed">
          {recommendation}
        </p>
      </div>
      
      {/* Breakdown */}
      <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className={cn(
              "h-3 w-3 transition-transform",
              breakdownOpen && "rotate-90"
            )} />
            How is this calculated?
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-4 mt-4 border-t border-border space-y-3">
            <p className="text-xs text-muted-foreground">
              Daddy Score combines two key metrics to predict retrieval probability:
            </p>
            
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
              <dt className="text-xs font-semibold text-foreground">Cosine Similarity (70%)</dt>
              <dd className="text-xs text-muted-foreground">
                Primary semantic relevance to query
                {cosineScore !== undefined && (
                  <span className="ml-2 font-mono text-foreground">
                    {cosineScore.toFixed(4)}
                  </span>
                )}
              </dd>
              
              <dt className="text-xs font-semibold text-foreground">Chamfer Similarity (30%)</dt>
              <dd className="text-xs text-muted-foreground">
                Multi-aspect coverage across query dimensions
                {chamferScore !== undefined && (
                  <span className="ml-2 font-mono text-foreground">
                    {chamferScore.toFixed(4)}
                  </span>
                )}
              </dd>
            </dl>
            
            <p className="text-[11px] text-muted-foreground italic p-2 bg-muted/20 border-l-2 border-border rounded">
              Higher scores increase probability of retrieval, but don't guarantee 
              citation. Source authority, recency, and synthesis quality also matter.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface MiniDaddyScoreProps {
  score: number;
  className?: string;
}

export function MiniDaddyScore({ score, className }: MiniDaddyScoreProps) {
  const tier = getDaddyScoreTier(score);
  
  return (
    <span className={cn(
      "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono",
      getDaddyScoreTierBgClass(tier),
      className
    )}>
      {score}
    </span>
  );
}
