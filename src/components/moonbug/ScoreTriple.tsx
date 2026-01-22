import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, AlertTriangle, Search, Sparkles, Quote } from 'lucide-react';
import { getTierFromScore, TIER_COLORS } from '@/lib/tier-colors';

export interface ScoreTripleProps {
  retrieval: number;  // hybrid score (semantic + lexical)
  rerank: number;     // entity prominence, direct answer, structure
  citation: number;   // attributability, evidence, format
  showLabels?: boolean;
  showIcons?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  flaggedReason?: string | null;
  className?: string;
}

/**
 * Display all three RAG pipeline scores in a compact format.
 * Uses tier-based coloring for each score.
 */
export function ScoreTriple({ 
  retrieval, 
  rerank, 
  citation, 
  showLabels = true,
  showIcons = false,
  size = 'sm',
  showTooltip = false,
  flaggedReason,
  className,
}: ScoreTripleProps) {
  
  const sizeClasses = {
    xs: 'text-[9px] px-1 py-0 h-4',
    sm: 'text-[10px] px-1.5 py-0 h-5',
    md: 'text-xs px-2 py-0.5 h-6',
    lg: 'text-sm px-3 py-1 h-7',
  };

  const iconSizes = {
    xs: 'h-2 w-2',
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-3.5 w-3.5',
  };

  const ScoreItem = ({ 
    score, 
    label, 
    Icon 
  }: { 
    score: number; 
    label: string; 
    Icon?: typeof Search;
  }) => {
    const tier = getTierFromScore(score);
    const colors = TIER_COLORS[tier];
    
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "font-mono gap-0.5 shrink-0",
          sizeClasses[size],
          colors.badge
        )}
      >
        {showIcons && Icon && (
          <Icon className={cn(iconSizes[size], "mr-0.5")} />
        )}
        {showLabels && (
          <span className="opacity-70 mr-0.5">{label}:</span>
        )}
        {Math.round(score)}
      </Badge>
    );
  };

  const content = (
    <div className={cn("flex items-center gap-1.5", className)}>
      <ScoreItem score={retrieval} label="R" Icon={Search} />
      <ScoreItem score={rerank} label="RR" Icon={Sparkles} />
      <ScoreItem score={citation} label="C" Icon={Quote} />
      
      {flaggedReason && (
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertTriangle className={cn(
              "text-[hsl(var(--warning))] shrink-0",
              iconSizes[size]
            )} />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {flaggedReason === 'high_retrieval_low_rerank' && (
              <span>Retrieves well but may get buried in reranking</span>
            )}
            {flaggedReason === 'high_rerank_low_retrieval' && (
              <span>Would rank well but may not be retrieved</span>
            )}
            {flaggedReason === 'both_scores_low' && (
              <span>Needs significant improvement in all areas</span>
            )}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  if (!showTooltip) {
    return <TooltipProvider>{content}</TooltipProvider>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            {content}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1.5 text-xs">
            <div className="flex items-start gap-2">
              <Search className="h-3 w-3 mt-0.5 shrink-0" />
              <div>
                <strong>R (Retrieval):</strong> Will this chunk be fetched? (semantic + lexical matching)
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
              <div>
                <strong>RR (Rerank):</strong> Where will it rank in context? (entity prominence, direct answer)
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Quote className="h-3 w-3 mt-0.5 shrink-0" />
              <div>
                <strong>C (Citation):</strong> Will the LLM cite it? (attributability, evidence strength)
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Legend/info button explaining the three scores.
 */
export function ScoreTripleLegend({ className }: { className?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className={cn("p-1 rounded hover:bg-muted/50 transition-colors", className)}>
            <Info className="h-4 w-4 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1.5 text-xs">
            <div>
              <strong>R (Retrieval):</strong> Will this chunk be fetched? Based on semantic similarity + lexical term matching.
            </div>
            <div>
              <strong>RR (Rerank):</strong> Where will it rank? Based on entity prominence, direct answer detection, and structure.
            </div>
            <div>
              <strong>C (Citation):</strong> Will the LLM cite it? Based on attributability, evidence strength, and quotability.
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
