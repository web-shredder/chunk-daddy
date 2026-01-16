import { Check, X, Scissors, Tag, Target, Link2, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ValidatedChange, ChangeExplanation } from '@/lib/optimizer-types';

interface RecommendationCardProps {
  change: ValidatedChange;
  explanation?: ChangeExplanation;
  accepted: boolean;
  onAccept: () => void;
  onReject: () => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  split_paragraph: <Scissors className="h-4 w-4" />,
  add_heading: <Tag className="h-4 w-4" />,
  replace_pronoun: <Target className="h-4 w-4" />,
  add_context: <Link2 className="h-4 w-4" />,
  reorder_sentences: <ArrowUpDown className="h-4 w-4" />,
};

const typeLabels: Record<string, string> = {
  split_paragraph: 'Split Paragraph',
  add_heading: 'Add Heading',
  replace_pronoun: 'Replace Pronoun',
  add_context: 'Add Context',
  reorder_sentences: 'Reorder Sentences',
};

const priorityStyles: Record<string, string> = {
  high: 'border-l-red-500 bg-red-500/5',
  medium: 'border-l-yellow-500 bg-yellow-500/5',
  low: 'border-l-muted-foreground bg-muted/30',
};

export function RecommendationCard({
  change,
  explanation,
  accepted,
  onAccept,
  onReject,
}: RecommendationCardProps) {
  const priority = change.actual_scores && change.actual_scores.improvement_pct > 10 
    ? 'high' 
    : change.actual_scores && change.actual_scores.improvement_pct > 5 
      ? 'medium' 
      : 'low';

  return (
    <div
      className={cn(
        'rounded-lg border border-l-4 p-4 space-y-3 transition-all',
        priorityStyles[priority],
        accepted && 'ring-2 ring-primary/50 bg-primary/5'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{typeIcons[change.change_type]}</span>
          <span className="font-medium text-sm">
            {explanation?.title || typeLabels[change.change_type]}
          </span>
        </div>
        {accepted && (
          <Badge variant="default" className="text-xs">
            <Check className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        )}
      </div>

      {/* Before/After */}
      <div className="grid gap-2 text-sm">
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Before:</span>
          <code className="block bg-red-500/10 text-red-700 dark:text-red-400 px-2 py-1.5 rounded text-xs line-through">
            {change.before}
          </code>
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">After:</span>
          <code className="block bg-green-500/10 text-green-700 dark:text-green-400 px-2 py-1.5 rounded text-xs">
            {change.after}
          </code>
        </div>
      </div>

      {/* Explanation */}
      {explanation && (
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">{explanation.explanation}</p>
          <p className="text-xs font-medium text-primary">{explanation.impact_summary}</p>
          {explanation.trade_offs && explanation.trade_offs !== 'None' && (
            <p className="text-xs text-muted-foreground italic">Trade-off: {explanation.trade_offs}</p>
          )}
        </div>
      )}

      {/* Actual Scores */}
      {change.actual_scores && (
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">New Score:</span>
            <span className="font-mono font-medium">{change.actual_scores.new_score.toFixed(4)}</span>
          </div>
          <div
            className={cn(
              'font-mono font-medium',
              change.actual_scores.improvement_pct > 0 ? 'text-green-600' : 'text-red-600'
            )}
          >
            {change.actual_scores.improvement_pct > 0 ? '+' : ''}
            {change.actual_scores.improvement_pct.toFixed(1)}%
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          variant={accepted ? 'secondary' : 'default'}
          onClick={onAccept}
          disabled={accepted}
          className="flex-1"
        >
          <Check className="h-3.5 w-3.5 mr-1.5" />
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onReject}
          disabled={!accepted}
          className="flex-1"
        >
          <X className="h-3.5 w-3.5 mr-1.5" />
          Reject
        </Button>
      </div>
    </div>
  );
}
