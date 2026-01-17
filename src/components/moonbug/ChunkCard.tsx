import { cn, stripLeadingHeadingCascade } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { FileText, Hash, Zap } from 'lucide-react';

interface ChunkCardProps {
  chunk: {
    id: string;
    index: number;
    heading?: string;
    headingPath: string[];
    score: number;
    text: string;
    tokenEstimate?: number;
    assignedQuery?: string;
  };
  isSelected: boolean;
  onClick: () => void;
}

function getScoreTier(score: number) {
  if (score >= 90) return { label: 'Excellent', bgColor: 'bg-green-500', textColor: 'text-green-600', borderColor: 'border-l-green-500' };
  if (score >= 75) return { label: 'Good', bgColor: 'bg-blue-500', textColor: 'text-blue-600', borderColor: 'border-l-blue-500' };
  if (score >= 60) return { label: 'Moderate', bgColor: 'bg-yellow-500', textColor: 'text-yellow-600', borderColor: 'border-l-yellow-500' };
  if (score >= 40) return { label: 'Weak', bgColor: 'bg-orange-500', textColor: 'text-orange-600', borderColor: 'border-l-orange-500' };
  return { label: 'Poor', bgColor: 'bg-red-500', textColor: 'text-red-600', borderColor: 'border-l-red-500' };
}

export function ChunkCard({ chunk, isSelected, onClick }: ChunkCardProps) {
  const tier = getScoreTier(chunk.score);
  const headingDisplay = chunk.headingPath.length > 0 
    ? chunk.headingPath[chunk.headingPath.length - 1] 
    : `Chunk ${chunk.index + 1}`;
  const fullPath = chunk.headingPath.join(' › ');
  const bodyPreview = stripLeadingHeadingCascade(chunk.text).slice(0, 120);
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border-l-4 transition-all",
        "bg-card hover:bg-muted/50 hover:shadow-sm",
        tier.borderColor,
        isSelected && "ring-2 ring-accent bg-accent/5"
      )}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        {/* Left: Heading */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground truncate" title={fullPath || headingDisplay}>
            {headingDisplay}
          </h4>
          {chunk.headingPath.length > 1 && (
            <p className="text-[10px] text-muted-foreground truncate" title={fullPath}>
              {chunk.headingPath.slice(0, -1).join(' › ')}
            </p>
          )}
        </div>
        
        {/* Right: Score badge */}
        <Badge 
          variant="outline" 
          className={cn(
            "shrink-0 font-mono text-[10px] px-1.5 py-0 h-5 gap-1",
            tier.textColor
          )}
        >
          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", tier.bgColor)} />
          {chunk.score}
          <span className="hidden sm:inline text-[9px] opacity-70">
            {tier.label}
          </span>
        </Badge>
      </div>
      
      {/* Assigned Query */}
      {chunk.assignedQuery && (
        <div className="mb-1.5">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-accent/10 text-accent">
            <Zap className="h-2.5 w-2.5 mr-1" />
            {chunk.assignedQuery.length > 40 
              ? chunk.assignedQuery.slice(0, 40) + '...' 
              : chunk.assignedQuery}
          </Badge>
        </div>
      )}
      
      {/* Body Preview */}
      <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
        {bodyPreview}{bodyPreview.length >= 120 ? '...' : ''}
      </p>
      
      {/* Footer: Metadata */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
        <span className="flex items-center gap-0.5">
          <Hash className="h-2.5 w-2.5" />
          {chunk.index + 1}
        </span>
        {chunk.tokenEstimate && (
          <>
            <span>•</span>
            <span className="flex items-center gap-0.5">
              <FileText className="h-2.5 w-2.5" />
              ~{chunk.tokenEstimate} tokens
            </span>
          </>
        )}
        {isSelected && (
          <>
            <span>•</span>
            <span className="text-accent font-medium">Selected</span>
          </>
        )}
      </div>
    </button>
  );
}
