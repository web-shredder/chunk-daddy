import { useMemo } from 'react';
import { cn, stripLeadingHeadingCascade } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { FileText, Hash, Zap, ChevronRight, AlertCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import { getTierFromScore, getTierLabel, TIER_COLORS } from '@/lib/tier-colors';
import { ScoreTriple } from './ScoreTriple';
import type { ChunkDiagnosis, FailureMode } from '@/lib/diagnostic-scoring';

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
    // New: three-score system
    retrievalScore?: number;
    rerankScore?: number;
    citationScore?: number;
    flaggedReason?: string | null;
  };
  isSelected: boolean;
  onClick: () => void;
  diagnosis?: ChunkDiagnosis;
  showTripleScore?: boolean; // Whether to show three scores or just passage score
}

function getScoreTierStyles(score: number) {
  const tier = getTierFromScore(score);
  const colors = TIER_COLORS[tier];
  return {
    label: getTierLabel(score),
    dotColor: `bg-[hsl(var(--tier-${tier}))]`,
    textColor: colors.text,
    borderColor: colors.borderLeft,
  };
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

// Diagnosis badge configuration
const DIAGNOSIS_BADGES: Record<FailureMode, { label: string; color: string; shortLabel: string }> = {
  'topic_mismatch': { label: 'Topic Mismatch', shortLabel: 'Topic', color: 'bg-[hsl(var(--tier-poor-bg))] text-[hsl(var(--tier-poor))] border-[hsl(var(--tier-poor)/0.3)]' },
  'missing_specifics': { label: 'Needs Specifics', shortLabel: 'Vague', color: 'bg-[hsl(var(--tier-moderate-bg))] text-[hsl(var(--tier-moderate))] border-[hsl(var(--tier-moderate)/0.3)]' },
  'buried_answer': { label: 'Buried Answer', shortLabel: 'Buried', color: 'bg-[hsl(var(--tier-weak-bg))] text-[hsl(var(--tier-weak))] border-[hsl(var(--tier-weak)/0.3)]' },
  'vocabulary_gap': { label: 'Missing Terms', shortLabel: 'Terms', color: 'bg-[hsl(var(--info-bg))] text-[hsl(var(--info))] border-[hsl(var(--info)/0.3)]' },
  'no_direct_answer': { label: 'No Direct Answer', shortLabel: 'Answer', color: 'bg-[hsl(var(--tier-poor-bg))] text-[hsl(var(--tier-poor))] border-[hsl(var(--tier-poor)/0.3)]' },
  'structure_problem': { label: 'Structure Issue', shortLabel: 'Structure', color: 'bg-[hsl(var(--tier-moderate-bg))] text-[hsl(var(--tier-moderate))] border-[hsl(var(--tier-moderate)/0.3)]' },
  'already_optimized': { label: 'Optimized ✓', shortLabel: 'Good', color: 'bg-[hsl(var(--tier-good-bg))] text-[hsl(var(--tier-good))] border-[hsl(var(--tier-good)/0.3)]' },
};

export function ChunkCard({ chunk, isSelected, onClick, diagnosis, showTripleScore = false }: ChunkCardProps) {
  const tierStyles = getScoreTierStyles(chunk.score);
  
  // Determine if we should show triple scores
  const hasTripleScores = showTripleScore && 
    chunk.retrievalScore !== undefined && 
    chunk.rerankScore !== undefined && 
    chunk.citationScore !== undefined;
  
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

  // Get diagnosis badge info
  const diagnosisBadge = diagnosis ? DIAGNOSIS_BADGES[diagnosis.primaryFailureMode] : null;

  const assignedQueryClean = chunk.assignedQuery ? stripMarkdown(chunk.assignedQuery) : undefined;
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border-l-4 transition-all",
        "bg-card hover:bg-muted/50 hover:shadow-sm",
        tierStyles.borderColor,
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
        
        {/* Right: Score display */}
        {hasTripleScores ? (
          <ScoreTriple
            retrieval={chunk.retrievalScore!}
            rerank={chunk.rerankScore!}
            citation={chunk.citationScore!}
            size="xs"
            showLabels={true}
            flaggedReason={chunk.flaggedReason}
          />
        ) : (
          <Badge 
            variant="outline" 
            className={cn(
              "shrink-0 font-mono text-[10px] px-1.5 py-0 h-5 gap-1",
              tierStyles.textColor
            )}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", tierStyles.dotColor)} />
            {chunk.score}
            <span className="hidden sm:inline text-[9px] opacity-70">
              {tierStyles.label}
            </span>
          </Badge>
        )}
      </div>
      
      {/* Assigned Query + Diagnosis */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {assignedQueryClean && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-accent/10 text-accent max-w-full">
            <Zap className="h-2.5 w-2.5 mr-1 shrink-0" />
            <span className="truncate">
              {assignedQueryClean.length > 50 
                ? assignedQueryClean.slice(0, 50) + '…' 
                : assignedQueryClean}
            </span>
          </Badge>
        )}
        
        {/* Diagnosis Badge */}
        {diagnosisBadge && diagnosis && diagnosis.fixPriority !== 'none' && (
          <Badge 
            variant="outline" 
            className={cn("text-[9px] px-1.5 py-0 h-4 shrink-0", diagnosisBadge.color)}
          >
            {diagnosis.fixPriority === 'critical' && <AlertCircle className="h-2 w-2 mr-0.5" />}
            {diagnosisBadge.shortLabel}
            {diagnosis.expectedImprovement > 0 && (
              <span className="ml-0.5 opacity-70">+{diagnosis.expectedImprovement}</span>
            )}
          </Badge>
        )}
        
        {/* Already Optimized Badge */}
        {diagnosisBadge && diagnosis?.fixPriority === 'none' && (
          <Badge 
            variant="outline" 
            className={cn("text-[9px] px-1.5 py-0 h-4 shrink-0", diagnosisBadge.color)}
          >
            <TrendingUp className="h-2 w-2 mr-0.5" />
            {diagnosisBadge.shortLabel}
          </Badge>
        )}
      </div>
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
