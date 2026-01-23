import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  XCircle,
  Target
} from 'lucide-react';
import { 
  CategoryBreakdown, 
  CategorizationSummary,
  CATEGORY_META,
} from '@/lib/query-categorization';
import { cn } from '@/lib/utils';

interface QueryCategorizationSummaryProps {
  primaryQuery: string;
  breakdown: CategoryBreakdown;
  summary: CategorizationSummary;
  onCategoryClick: (category: 'optimization' | 'gaps' | 'drift' | 'outOfScope') => void;
  activeCategory?: string;
}

const CATEGORY_CONFIG = {
  optimization: {
    label: 'Optimization Opportunities',
    shortLabel: 'Optimize',
    icon: CheckCircle,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-300 dark:border-green-700',
    hoverBorder: 'hover:border-green-400 dark:hover:border-green-600',
    description: 'Ready to assign to chunks',
  },
  gaps: {
    label: 'Content Gaps',
    shortLabel: 'Gaps',
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-300 dark:border-amber-700',
    hoverBorder: 'hover:border-amber-400 dark:hover:border-amber-600',
    description: 'Missing coverage, needs content',
  },
  drift: {
    label: 'Intent Drift',
    shortLabel: 'Drift',
    icon: RefreshCw,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-300 dark:border-orange-700',
    hoverBorder: 'hover:border-orange-400 dark:hover:border-orange-600',
    description: 'Different user intent',
  },
  outOfScope: {
    label: 'Out of Scope',
    shortLabel: 'Skip',
    icon: XCircle,
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-900/30',
    borderColor: 'border-slate-300 dark:border-slate-600',
    hoverBorder: 'hover:border-slate-400 dark:hover:border-slate-500',
    description: 'Too tangential, recommend delete',
  },
} as const;

export function QueryCategorizationSummary({
  primaryQuery,
  breakdown,
  summary,
  onCategoryClick,
  activeCategory,
}: QueryCategorizationSummaryProps) {
  const categories = [
    { key: 'optimization' as const, count: summary.byCategory.optimization, items: breakdown.optimizationOpportunities },
    { key: 'gaps' as const, count: summary.byCategory.gaps, items: breakdown.contentGaps },
    { key: 'drift' as const, count: summary.byCategory.drift, items: breakdown.intentDrift },
    { key: 'outOfScope' as const, count: summary.byCategory.outOfScope, items: breakdown.outOfScope },
  ];

  // Calculate actionable percentage (optimization + gaps)
  const actionableCount = summary.byCategory.optimization + summary.byCategory.gaps;
  const actionablePercent = summary.total > 0 ? Math.round((actionableCount / summary.total) * 100) : 0;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Query Categorization</CardTitle>
          </div>
          <Badge variant="secondary" className="font-mono text-xs">
            {summary.total} variants
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground truncate mt-1">
          Primary: <span className="font-medium text-foreground">"{primaryQuery}"</span>
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 4-Bucket Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {categories.map(({ key, count }) => {
            const config = CATEGORY_CONFIG[key];
            const Icon = config.icon;
            const isActive = activeCategory === key;
            const percentage = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
            
            return (
              <button
                key={key}
                onClick={() => onCategoryClick(key)}
                className={cn(
                  "relative p-3 rounded-lg border-2 transition-all text-left group",
                  config.bgColor,
                  isActive ? config.borderColor : 'border-transparent',
                  config.hoverBorder,
                  "hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
              >
                {/* Count + Icon */}
                <div className="flex items-center justify-between mb-1">
                  <Icon className={cn("h-4 w-4", config.color)} />
                  <span className={cn("text-xl font-bold", config.color)}>
                    {count}
                  </span>
                </div>

                {/* Label */}
                <p className={cn("text-sm font-medium", config.color)}>
                  {config.shortLabel}
                </p>

                {/* Description */}
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                  {config.description}
                </p>

                {/* Percentage bar */}
                <div className="mt-2 h-1 bg-background/50 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      key === 'optimization' && 'bg-green-500',
                      key === 'gaps' && 'bg-amber-500',
                      key === 'drift' && 'bg-orange-500',
                      key === 'outOfScope' && 'bg-slate-400',
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {/* Active indicator */}
                {isActive && (
                  <div className={cn(
                    "absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-0 h-0",
                    "border-l-[6px] border-r-[6px] border-t-[6px]",
                    "border-l-transparent border-r-transparent",
                    key === 'optimization' && 'border-t-green-300 dark:border-t-green-700',
                    key === 'gaps' && 'border-t-amber-300 dark:border-t-amber-700',
                    key === 'drift' && 'border-t-orange-300 dark:border-t-orange-700',
                    key === 'outOfScope' && 'border-t-slate-300 dark:border-t-slate-600',
                  )} />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/50">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Avg Similarity</p>
            <p className="text-lg font-semibold tabular-nums">
              {(summary.averageScores.contentSimilarity * 100).toFixed(0)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Avg Passage Score</p>
            <p className="text-lg font-semibold tabular-nums">
              {summary.averageScores.passageScore.toFixed(0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Actionable</p>
            <p className="text-lg font-semibold tabular-nums text-green-600 dark:text-green-400">
              {actionablePercent}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default QueryCategorizationSummary;
