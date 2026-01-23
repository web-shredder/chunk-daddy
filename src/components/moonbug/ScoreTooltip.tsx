import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { SCORE_DEFINITIONS, ScoreKey } from '@/constants/scoreDefinitions';

interface ScoreTooltipProps {
  scoreKey: ScoreKey;
  children: React.ReactNode;
  showIcon?: boolean;
}

export function ScoreTooltip({ scoreKey, children, showIcon = true }: ScoreTooltipProps) {
  const definition = SCORE_DEFINITIONS[scoreKey];
  
  if (!definition) return <>{children}</>;
  
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help">
            {children}
            {showIcon && (
              <HelpCircle className="w-3 h-3 text-muted-foreground opacity-60 hover:opacity-100 transition-opacity" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-xs p-3"
          sideOffset={8}
        >
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-sm">{definition.name}</p>
              <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground shrink-0">
                Target: {definition.goodThreshold}+
              </span>
            </div>
            
            <p className="text-xs text-muted-foreground leading-relaxed">
              {definition.shortDescription}
            </p>
            
            <div className="pt-1 border-t">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                Formula
              </p>
              <code className="text-[10px] font-mono text-foreground/80 block break-words">
                {definition.calculation.split('\n')[0]}
              </code>
            </div>
            
            <div className="flex justify-between text-[10px] text-muted-foreground pt-1 border-t">
              <span>Range: {definition.range}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
