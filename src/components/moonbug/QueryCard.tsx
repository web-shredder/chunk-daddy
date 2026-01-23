/**
 * QueryCard Component
 * Displays a query with its optimization status, intent type, and assigned chunk info
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Loader2,
  ChevronRight,
  Clock,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Search,
  FileEdit,
  Lightbulb,
  HelpCircle,
  Target,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTierColors, getTierFromScore } from '@/lib/tier-colors';
import type { QueryWorkItem, QueryIntentType, QueryStatus } from '@/types/coverage';

interface QueryCardProps {
  query: QueryWorkItem;
  onClick: () => void;
}

// Intent type styling with Lucide icons
const INTENT_TYPE_CONFIG: Record<QueryIntentType, {
  icon: LucideIcon;
  bg: string;
  text: string;
  border: string;
  label: string;
}> = {
  PRIMARY: {
    icon: Target,
    bg: 'bg-violet-500/10',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-500/30',
    label: 'Primary',
  },
  EQUIVALENT: {
    icon: RefreshCw,
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30',
    label: 'Equivalent',
  },
  FOLLOW_UP: {
    icon: ArrowRight,
    bg: 'bg-teal-500/10',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-500/30',
    label: 'Follow-up',
  },
  SPECIFICATION: {
    icon: Search,
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    label: 'Specification',
  },
  GENERALIZATION: {
    icon: Layers,
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-500/30',
    label: 'Generalization',
  },
  ENTAILMENT: {
    icon: Lightbulb,
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    label: 'Entailment',
  },
  CANONICALIZATION: {
    icon: FileEdit,
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-500/30',
    label: 'Canonical',
  },
  CLARIFICATION: {
    icon: HelpCircle,
    bg: 'bg-pink-500/10',
    text: 'text-pink-600 dark:text-pink-400',
    border: 'border-pink-500/30',
    label: 'Clarification',
  },
  GAP: {
    icon: AlertTriangle,
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/30',
    label: 'Gap',
  },
};

// Status configuration
const STATUS_CONFIG: Record<QueryStatus, {
  icon: LucideIcon;
  iconClass: string;
  cardClass: string;
}> = {
  optimized: {
    icon: CheckCircle2,
    iconClass: 'text-success',
    cardClass: 'border-success/30 hover:border-success/50',
  },
  in_progress: {
    icon: Loader2,
    iconClass: 'text-primary animate-spin',
    cardClass: 'border-primary/30 hover:border-primary/50',
  },
  ready: {
    icon: ChevronRight,
    iconClass: 'text-muted-foreground group-hover:text-foreground transition-colors',
    cardClass: 'border-warning/30 hover:border-warning/50',
  },
  gap: {
    icon: AlertTriangle,
    iconClass: 'text-destructive',
    cardClass: 'border-destructive/30 hover:border-destructive/50',
  },
};

export function QueryCard({ query, onClick }: QueryCardProps) {
  const intentConfig = INTENT_TYPE_CONFIG[query.intentType] || INTENT_TYPE_CONFIG.PRIMARY;
  const statusConfig = STATUS_CONFIG[query.status];
  const StatusIcon = statusConfig.icon;
  const IntentIcon = intentConfig.icon;
  
  // Calculate score display
  const originalScore = query.originalScores?.passageScore;
  const currentScore = query.currentScores?.passageScore;
  const scoreDiff = currentScore && originalScore ? currentScore - originalScore : undefined;
  
  // Get tier colors for score display
  const scoreColors = originalScore ? getTierColors(originalScore) : null;
  
  return (
    <Card 
      className={cn(
        'group cursor-pointer transition-all duration-200',
        'hover:bg-muted/30 hover:shadow-sm',
        'border',
        statusConfig.cardClass
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Query info */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Query text */}
            <p className="text-sm font-medium text-foreground leading-snug">
              {query.query}
            </p>
            
            {/* Intent type badge + chunk info */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Intent type badge */}
              <Badge 
                variant="outline" 
                className={cn(
                  'text-xs gap-1 shrink-0',
                  intentConfig.bg,
                  intentConfig.text,
                  intentConfig.border
                )}
              >
                <IntentIcon className="h-3 w-3" />
                {intentConfig.label}
              </Badge>
              
              {/* Assigned chunk info */}
              {query.assignedChunk && (
                <span className="text-xs text-muted-foreground truncate">
                  Chunk {query.assignedChunk.index + 1}: {query.assignedChunk.heading}
                </span>
              )}
              
              {/* Gap indicator */}
              {query.status === 'gap' && (
                <span className="text-xs text-destructive">
                  No matching chunk
                </span>
              )}
            </div>
            
            {/* Chunk preview for ready/optimized queries */}
            {query.assignedChunk && query.status !== 'gap' && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {query.assignedChunk.preview}
              </p>
            )}
          </div>
          
          {/* Right: Score + status */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Score display */}
            {originalScore !== undefined && (
              <div className="text-right">
                {query.status === 'optimized' && currentScore !== undefined ? (
                  // Optimized: show before → after with diff
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {Math.round(originalScore)}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className={cn(
                      'text-sm font-medium tabular-nums',
                      currentScore > originalScore ? 'text-success' : currentScore < originalScore ? 'text-destructive' : scoreColors?.text
                    )}>
                      {Math.round(currentScore)}
                    </span>
                    {scoreDiff !== undefined && scoreDiff !== 0 && (
                      <span className={cn(
                        'text-xs tabular-nums',
                        scoreDiff > 0 ? 'text-success' : 'text-destructive'
                      )}>
                        ({scoreDiff > 0 ? '+' : ''}{Math.round(scoreDiff)})
                      </span>
                    )}
                  </div>
                ) : (
                  // Ready/in-progress: show current score
                  <Badge 
                    variant="secondary" 
                    className={cn('text-xs tabular-nums', scoreColors?.badge)}
                  >
                    {Math.round(originalScore)}
                  </Badge>
                )}
              </div>
            )}
            
            {/* Status icon */}
            <StatusIcon className={cn('h-5 w-5 shrink-0', statusConfig.iconClass)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default QueryCard;
