import { useMemo } from 'react';
import { cn, stripLeadingHeadingCascade } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { FileText, Hash, Zap, ChevronRight } from 'lucide-react';

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

// Strip markdown formatting
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

export function ChunkCard({ chunk, isSelected, onClick }: ChunkCardProps) {
  const tier = getScoreTier(chunk.score);
  
  // Build breadcrumb from headingPath (show last 2-3 levels max)
  const breadcrumb = useMemo(() => {
    if (chunk.headingPath && chunk.headingPath.length > 0) {
      const cleaned = chunk.headingPath.map(h => stripMarkdown(h));
      
      if (cleaned.length <= 3) {
        return cleaned;
      }
      
      // First + ellipsis + last 2 for long paths
      return [cleaned[0], '…', ...cleaned.slice(-2)];
    }
    return [];
  }, [chunk.headingPath]);
  
  // Get first few words of chunk body as differentiator title
  const chunkTitle = useMemo(() => {
    const body = stripLeadingHeadingCascade(chunk.text);
    const cleaned = stripMarkdown(body);
    const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
    return words.length > 60 ? words.slice(0, 60) + '…' : words + '…';
  }, [chunk.text]);
  
  // Body preview (more content after title)
  const bodyPreview = useMemo(() => {
    const body = stripLeadingHeadingCascade(chunk.text);
    const cleaned = stripMarkdown(body);
    // Skip first 8 words (used in title) and get next portion
    const words = cleaned.split(/\s+/).filter(Boolean);
    const remaining = words.slice(8, 28).join(' ');
    return remaining.length > 0 ? remaining + '…' : '';
  }, [chunk.text]);

  const assignedQueryClean = chunk.assignedQuery ? stripMarkdown(chunk.assignedQuery) : undefined;
  
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
      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5 overflow-hidden">
          {breadcrumb.map((crumb, idx) => (
            <span key={idx} className="flex items-center gap-1 shrink-0">
              {idx > 0 && <ChevronRight className="h-2.5 w-2.5 opacity-50" />}
              <span className={cn(
                "truncate",
                idx === breadcrumb.length - 1 ? "max-w-[150px]" : "max-w-[100px]"
              )} title={crumb}>
                {crumb}
              </span>
            </span>
          ))}
        </div>
      )}
      
      {/* Header Row: Chunk Title + Score */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        {/* Left: Chunk preview as title */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground line-clamp-1" title={chunkTitle}>
            {chunkTitle}
          </h4>
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
      {assignedQueryClean && (
        <div className="mb-1.5">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-accent/10 text-accent max-w-full">
            <Zap className="h-2.5 w-2.5 mr-1 shrink-0" />
            <span className="truncate">
              {assignedQueryClean.length > 50 
                ? assignedQueryClean.slice(0, 50) + '…' 
                : assignedQueryClean}
            </span>
          </Badge>
        </div>
      )}
      
      {/* Body Preview */}
      {bodyPreview && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
          {bodyPreview}
        </p>
      )}
      
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
