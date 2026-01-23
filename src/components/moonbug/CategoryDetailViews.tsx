import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  XCircle,
  FileText,
  Trash2,
  ArrowRight,
  Eye,
  Sparkles,
  Target,
} from 'lucide-react';
import { CategorizedVariant } from '@/lib/query-categorization';
import { cn } from '@/lib/utils';

// ============================================================================
// SHARED VARIANT CARD
// ============================================================================

interface VariantCardProps {
  variant: CategorizedVariant;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onAction?: (action: string) => void;
  showChunkInfo?: boolean;
  showGapInfo?: boolean;
  showDriftInfo?: boolean;
}

function VariantCard({
  variant,
  selected,
  onSelect,
  onAction,
  showChunkInfo,
  showGapInfo,
  showDriftInfo,
}: VariantCardProps) {
  return (
    <div className="border border-border/50 rounded-lg p-3 hover:border-border transition-colors bg-card">
      <div className="flex items-start gap-3">
        {onSelect && (
          <Checkbox
            checked={selected}
            onCheckedChange={onSelect}
            className="mt-1"
          />
        )}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Query row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs shrink-0">
              {variant.variantType}
            </Badge>
            <span className="text-sm font-medium break-words">
              "{variant.query}"
            </span>
          </div>
          
          {/* Scores row */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>
              Similarity: <span className="font-medium text-foreground">{(variant.contentSimilarity * 100).toFixed(0)}%</span>
            </span>
            <span>
              Passage: <span className="font-medium text-foreground">{variant.passageScore.toFixed(0)}</span>
            </span>
            {variant.intentAnalysis.driftScore > 0 && (
              <span className={cn(
                variant.intentAnalysis.driftScore > 40 ? 'text-orange-600 dark:text-orange-400' : ''
              )}>
                Drift: <span className="font-medium">{variant.intentAnalysis.driftScore}</span>
              </span>
            )}
          </div>
          
          {/* Chunk info for Category A */}
          {showChunkInfo && variant.actionable.assignedChunk && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <Target className="h-3 w-3" />
              <span>
                Assigned to: <span className="font-medium">{variant.actionable.assignedChunk.heading}</span>
                {' '}(Score: {variant.actionable.assignedChunk.currentScore.toFixed(0)})
              </span>
            </div>
          )}
          
          {/* Gap info for Category B */}
          {showGapInfo && variant.actionable.gapDetails && (
            <div className="text-xs space-y-1 text-amber-600 dark:text-amber-400">
              {variant.actionable.gapDetails.missingConcepts.length > 0 && (
                <p>
                  <span className="text-muted-foreground">Missing:</span>{' '}
                  {variant.actionable.gapDetails.missingConcepts.join(', ')}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Recommended:</span>{' '}
                {variant.actionable.gapDetails.estimatedLength}
              </p>
            </div>
          )}
          
          {/* Drift info for Category C */}
          {showDriftInfo && variant.actionable.driftDetails && (
            <div className="text-xs space-y-1 text-orange-600 dark:text-orange-400">
              <p>{variant.actionable.driftDetails.explanation}</p>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{variant.actionable.driftDetails.primaryIntent}</span>
                <ArrowRight className="h-3 w-3" />
                <span>{variant.actionable.driftDetails.variantIntent}</span>
              </div>
            </div>
          )}
          
          {/* Category reasoning */}
          <p className="text-xs text-muted-foreground italic">
            {variant.categoryReasoning}
          </p>
        </div>
      </div>
      
      {/* Actions */}
      {onAction && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-border/50 flex-wrap">
          {variant.category === 'OPTIMIZATION_OPPORTUNITY' && (
            <>
              <Button size="sm" variant="default" onClick={() => onAction('assign')}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Assign
              </Button>
              <Button size="sm" variant="outline" onClick={() => onAction('view')}>
                <Eye className="h-3.5 w-3.5 mr-1" />
                View Chunk
              </Button>
            </>
          )}
          {variant.category === 'CONTENT_GAP' && (
            <>
              <Button size="sm" variant="default" onClick={() => onAction('brief')}>
                <FileText className="h-3.5 w-3.5 mr-1" />
                Generate Brief
              </Button>
              <Button size="sm" variant="outline" onClick={() => onAction('force')}>
                Force Assign
              </Button>
            </>
          )}
          {variant.category === 'INTENT_DRIFT' && (
            <>
              <Button size="sm" variant="outline" onClick={() => onAction('keep')}>
                Keep for Reference
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onAction('delete')}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            </>
          )}
          {variant.category === 'OUT_OF_SCOPE' && (
            <Button size="sm" variant="destructive" onClick={() => onAction('delete')}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CATEGORY A: OPTIMIZATION OPPORTUNITIES
// ============================================================================

interface OptimizationOpportunitiesViewProps {
  variants: CategorizedVariant[];
  onAssignAll: () => void;
  onAssign: (variant: CategorizedVariant) => void;
  onViewChunk: (chunkIndex: number) => void;
}

export function OptimizationOpportunitiesView({
  variants,
  onAssignAll,
  onAssign,
  onViewChunk,
}: OptimizationOpportunitiesViewProps) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  
  const toggleSelect = (query: string, isSelected: boolean) => {
    const next = new Set(selected);
    if (isSelected) next.add(query);
    else next.delete(query);
    setSelected(next);
  };
  
  return (
    <Card className="border-green-200 dark:border-green-800/50 bg-green-50/30 dark:bg-green-950/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              Optimization Opportunities ({variants.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              These variants matched existing chunks. Assign them to optimize.
            </p>
          </div>
          <Button size="sm" onClick={onAssignAll} disabled={variants.length === 0}>
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Assign All to Chunks
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {variants.map(variant => (
          <VariantCard
            key={variant.query}
            variant={variant}
            selected={selected.has(variant.query)}
            onSelect={(sel) => toggleSelect(variant.query, sel)}
            showChunkInfo
            onAction={(action) => {
              if (action === 'assign') onAssign(variant);
              if (action === 'view' && variant.actionable.assignedChunk) {
                onViewChunk(variant.actionable.assignedChunk.index);
              }
            }}
          />
        ))}
        {variants.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No optimization opportunities found. Try generating more variants or adjusting content.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CATEGORY B: CONTENT GAPS
// ============================================================================

interface ContentGapsViewProps {
  variants: CategorizedVariant[];
  onGenerateBrief: (variant: CategorizedVariant) => void;
  onGenerateAllBriefs: () => void;
  onForceAssign: (variant: CategorizedVariant) => void;
}

export function ContentGapsView({
  variants,
  onGenerateBrief,
  onGenerateAllBriefs,
  onForceAssign,
}: ContentGapsViewProps) {
  return (
    <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Content Gaps ({variants.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Related topics your content doesn't adequately cover. Consider creating new sections.
            </p>
          </div>
          <Button size="sm" onClick={onGenerateAllBriefs} disabled={variants.length === 0}>
            <FileText className="h-3.5 w-3.5 mr-1" />
            Generate All Briefs
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {variants.map(variant => (
          <VariantCard
            key={variant.query}
            variant={variant}
            showGapInfo
            onAction={(action) => {
              if (action === 'brief') onGenerateBrief(variant);
              if (action === 'force') onForceAssign(variant);
            }}
          />
        ))}
        {variants.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No content gaps detected. Your content has good coverage!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CATEGORY C: INTENT DRIFT
// ============================================================================

interface IntentDriftViewProps {
  variants: CategorizedVariant[];
  onDelete: (variant: CategorizedVariant) => void;
  onKeep: (variant: CategorizedVariant) => void;
  onDeleteAll: () => void;
}

export function IntentDriftView({
  variants,
  onDelete,
  onKeep,
  onDeleteAll,
}: IntentDriftViewProps) {
  return (
    <Card className="border-orange-200 dark:border-orange-800/50 bg-orange-50/30 dark:bg-orange-950/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <RefreshCw className="h-5 w-5" />
              Intent Drift ({variants.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              These serve different user needs. Optimizing for them won't help rankings.
            </p>
          </div>
          <Button size="sm" variant="destructive" onClick={onDeleteAll} disabled={variants.length === 0}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete All Drift
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {variants.map(variant => (
          <VariantCard
            key={variant.query}
            variant={variant}
            showDriftInfo
            onAction={(action) => {
              if (action === 'delete') onDelete(variant);
              if (action === 'keep') onKeep(variant);
            }}
          />
        ))}
        {variants.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No intent drift detected. All variants align with primary query intent.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CATEGORY D: OUT OF SCOPE
// ============================================================================

interface OutOfScopeViewProps {
  variants: CategorizedVariant[];
  onDelete: (variant: CategorizedVariant) => void;
  onDeleteAll: () => void;
}

export function OutOfScopeView({
  variants,
  onDelete,
  onDeleteAll,
}: OutOfScopeViewProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-900/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <XCircle className="h-5 w-5" />
              Out of Scope ({variants.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Too tangential to your content's topic. Recommend deleting.
            </p>
          </div>
          <Button size="sm" variant="destructive" onClick={onDeleteAll} disabled={variants.length === 0}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete All
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {variants.map(variant => (
          <VariantCard
            key={variant.query}
            variant={variant}
            onAction={(action) => {
              if (action === 'delete') onDelete(variant);
            }}
          />
        ))}
        {variants.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No out-of-scope variants. All generated queries relate to your content.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// COMBINED CATEGORY VIEW
// ============================================================================

interface CategoryDetailViewProps {
  activeCategory: 'optimization' | 'gaps' | 'drift' | 'outOfScope';
  variants: CategorizedVariant[];
  onAssign: (variant: CategorizedVariant) => void;
  onAssignAll: () => void;
  onViewChunk: (chunkIndex: number) => void;
  onGenerateBrief: (variant: CategorizedVariant) => void;
  onGenerateAllBriefs: () => void;
  onForceAssign: (variant: CategorizedVariant) => void;
  onDelete: (variant: CategorizedVariant) => void;
  onDeleteAll: () => void;
  onKeep: (variant: CategorizedVariant) => void;
}

export function CategoryDetailView({
  activeCategory,
  variants,
  onAssign,
  onAssignAll,
  onViewChunk,
  onGenerateBrief,
  onGenerateAllBriefs,
  onForceAssign,
  onDelete,
  onDeleteAll,
  onKeep,
}: CategoryDetailViewProps) {
  switch (activeCategory) {
    case 'optimization':
      return (
        <OptimizationOpportunitiesView
          variants={variants}
          onAssignAll={onAssignAll}
          onAssign={onAssign}
          onViewChunk={onViewChunk}
        />
      );
    case 'gaps':
      return (
        <ContentGapsView
          variants={variants}
          onGenerateBrief={onGenerateBrief}
          onGenerateAllBriefs={onGenerateAllBriefs}
          onForceAssign={onForceAssign}
        />
      );
    case 'drift':
      return (
        <IntentDriftView
          variants={variants}
          onDelete={onDelete}
          onKeep={onKeep}
          onDeleteAll={onDeleteAll}
        />
      );
    case 'outOfScope':
      return (
        <OutOfScopeView
          variants={variants}
          onDelete={onDelete}
          onDeleteAll={onDeleteAll}
        />
      );
    default:
      return null;
  }
}
