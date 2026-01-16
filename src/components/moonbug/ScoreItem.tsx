import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SCORE_METADATA, getScoreQuality, getQualityColorClass } from '@/lib/score-metadata';
import { formatScore } from '@/lib/similarity';

interface ScoreItemProps {
  metricKey: string;
  value: number;
}

export function ScoreItem({ metricKey, value }: ScoreItemProps) {
  const metadata = SCORE_METADATA[metricKey];
  
  if (!metadata) return null;
  
  const quality = metadata.hasQuality ? getScoreQuality(metricKey, value) : null;
  
  return (
    <div className="p-3 bg-background border border-border rounded-lg hover:border-muted-foreground/30 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-foreground">
            {metadata.label}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            ({metadata.range})
          </span>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors cursor-help">
                  <Info size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent 
                side="top" 
                className="max-w-[300px] text-[12px] leading-relaxed"
              >
                {metadata.explanation}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {quality && (
          <span className={cn(
            "px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide",
            getQualityColorClass(quality)
          )}>
            {quality}
          </span>
        )}
      </div>
      
      {/* Value */}
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn(
          "font-mono text-lg font-semibold",
          quality ? getQualityColorClass(quality).split(' ')[1] : "text-foreground"
        )}>
          {formatScore(value)}
        </span>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {metadata.direction === 'higher' ? '↑' : '↓'} {metadata.direction} is more similar
        </span>
      </div>
    </div>
  );
}

interface ScoreGridProps {
  scores: {
    cosine: number;
    chamfer: number;
    euclidean: number;
    manhattan: number;
    dotProduct: number;
    daddyScore?: number;
  };
  keyword: string;
}

export function ScoreGrid({ scores, keyword }: ScoreGridProps) {
  return (
    <div className="p-4 bg-surface border border-border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          "{keyword}"
        </span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
        <ScoreItem metricKey="cosine" value={scores.cosine} />
        <ScoreItem metricKey="chamfer" value={scores.chamfer} />
        <ScoreItem metricKey="euclidean" value={scores.euclidean} />
        <ScoreItem metricKey="manhattan" value={scores.manhattan} />
        <ScoreItem metricKey="dotProduct" value={scores.dotProduct} />
      </div>
    </div>
  );
}
