import { Zap, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  getPassageScoreTier,
  getPassageScoreInterpretation,
  getPassageScoreRecommendation,
  getPassageScoreTierBgClass,
  getPassageScoreTierColorClass,
  formatImprovement,
  calculateImprovement,
  type PassageScoreTier,
} from '@/lib/similarity';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface PassageScoreHeroProps {
  score: number;
  previousScore?: number;
  cosineScore?: number;
  chamferScore?: number;
}

export function PassageScoreHero({ score, previousScore, cosineScore, chamferScore }: PassageScoreHeroProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const tier = getPassageScoreTier(score);
  const interpretation = getPassageScoreInterpretation(score);
  const recommendation = getPassageScoreRecommendation(score);
  
  // Calculate improvement if previous score provided
  const improvement = previousScore !== undefined 
    ? calculateImprovement(previousScore, score)
    : null;

  return (
    <div className="p-4 border border-border rounded-lg mb-6 transition-colors bg-surface">
      {/* Compact Header Row */}
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className={cn("h-4 w-4", getPassageScoreTierColorClass(tier))} />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Passage Score
            </span>
          </div>
          
          {/* Score Display - Inline */}
          <div className="flex items-baseline gap-1">
            <span className={cn(
              "text-3xl font-bold font-mono tracking-tight",
              getPassageScoreTierColorClass(tier)
            )}>
              {score}
            </span>
            <span className="text-sm font-medium text-muted-foreground font-mono">
              /100
            </span>
          </div>
          
          {/* Tier Badge */}
          <span className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
            getPassageScoreTierBgClass(tier)
          )}>
            {tier}
          </span>
        </div>
        
        {improvement !== null && (
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50 text-xs font-semibold font-mono",
            improvement > 0 && "text-primary",
            improvement < 0 && "text-muted-foreground",
            improvement === 0 && "text-muted-foreground"
          )}>
            {improvement > 0 && <TrendingUp className="h-3 w-3" />}
            {improvement < 0 && <TrendingDown className="h-3 w-3" />}
            {improvement === 0 && <Minus className="h-3 w-3" />}
            {formatImprovement(improvement)}
          </div>
        )}
      </div>
      
      {/* Interpretation - Compact */}
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
        {interpretation}
      </p>
      
      {/* Breakdown - Collapsed by default, includes recommendation */}
      <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className={cn(
              "h-3 w-3 transition-transform",
              breakdownOpen && "rotate-90"
            )} />
            Details & Recommendations
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-3 mt-3 border-t border-border space-y-3">
            {/* Recommendation */}
            <div className="p-2 bg-muted/30 rounded-md">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Recommendation
              </p>
              <p className="text-xs text-foreground leading-relaxed">
                {recommendation}
              </p>
            </div>
            
            {/* Score Breakdown */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Passage Score combines two metrics to predict retrieval probability:
              </p>
              
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                <dt className="text-xs font-medium text-foreground">Cosine (70%)</dt>
                <dd className="text-xs text-muted-foreground">
                  Semantic relevance
                  {cosineScore !== undefined && (
                    <span className="ml-2 font-mono text-foreground">
                      {cosineScore.toFixed(4)}
                    </span>
                  )}
                </dd>
                
                <dt className="text-xs font-medium text-foreground">Chamfer (30%)</dt>
                <dd className="text-xs text-muted-foreground">
                  Multi-aspect coverage
                  {chamferScore !== undefined && (
                    <span className="ml-2 font-mono text-foreground">
                      {chamferScore.toFixed(4)}
                    </span>
                  )}
                </dd>
              </dl>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface MiniPassageScoreProps {
  score: number;
  className?: string;
}

export function MiniPassageScore({ score, className }: MiniPassageScoreProps) {
  const tier = getPassageScoreTier(score);
  
  return (
    <span className={cn(
      "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono",
      getPassageScoreTierBgClass(tier),
      className
    )}>
      {score}
    </span>
  );
}

// Keep old names as aliases for backward compatibility
export const DaddyScoreHero = PassageScoreHero;
export const MiniDaddyScore = MiniPassageScore;
