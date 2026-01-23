import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Globe,
  Brain,
  Shuffle,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  AlertCircle,
  Zap,
  FileText,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTierFromScore, TIER_COLORS } from '@/lib/tier-colors';

// ============================================================
// TYPES
// ============================================================

export interface EnhancedQuerySuggestion {
  query: string;
  intentType: string;
  matchStrength: 'strong' | 'partial' | 'weak';
  matchReason: string;
  relevantSection: string | null;
  confidence: number;
  searchVolumeTier?: string;
  competitiveness?: string;
  
  // Intent preservation scoring (Google Patent)
  variantType?: 'SYNONYM' | 'GRANULAR' | 'SPECIFICATION' | 'TEMPORAL' | 'RELATED';
  semanticSimilarity?: number;
  entityOverlap?: number;
  intentScore?: number;
  intentCategory?: 'HIGH' | 'MEDIUM' | 'LOW';
  
  // Route prediction (Apple research)
  routePrediction?: 'WEB_SEARCH' | 'PARAMETRIC' | 'HYBRID';
  routeConfidence?: number;
  
  // Entity analysis
  primaryQueryEntities?: string[];
  suggestedQueryEntities?: string[];
  sharedEntities?: string[];
  
  // Drift detection
  driftReason?: string | null;
}

export interface CriticalGap {
  query: string;
  intentScore: number;
  intentCategory: 'HIGH' | 'MEDIUM' | 'LOW';
  routePrediction: 'WEB_SEARCH' | 'PARAMETRIC' | 'HYBRID';
  currentCoverage: 'none' | 'weak' | 'partial';
  missingElements: string[];
  competitiveValue: 'critical' | 'high' | 'medium' | 'low';
  estimatedEffort: 'quick_fix' | 'moderate' | 'major_rewrite';
  recommendation: string;
}

export interface FollowUpQuery {
  query: string;
  targetGap: string;
  queryType: 'CLARIFICATION' | 'SPECIFICATION' | 'DECOMPOSITION' | 'ALTERNATIVE';
  expectedCoverage: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface PriorityAction {
  rank: number;
  action: string;
  targetQueries: string[];
  impact: 'critical' | 'high' | 'medium' | 'low';
  effort: 'quick' | 'moderate' | 'major';
  expectedImprovement: string;
}

export interface CompetitiveGap {
  query: string;
  gapType: 'pricing' | 'comparison' | 'case_study' | 'specific_detail' | 'process' | 'timeline';
  competitorAdvantage: string;
  difficulty: 'easy' | 'moderate' | 'hard';
  recommendation: string;
}

export interface GapSummary {
  total_suggestions: number;
  strong_coverage: number;
  partial_coverage: number;
  weak_coverage: number;
  no_coverage: number;
  critical_gaps: number;
  opportunity_gaps: number;
  low_priority_gaps: number;
}

export interface IntentSummary {
  high_intent: number;
  medium_intent: number;
  low_intent: number;
  web_search_likely: number;
  parametric_likely: number;
  hybrid_likely: number;
  avg_intent_score: number;
}

interface QueryIntelligenceDashboardProps {
  suggestions: EnhancedQuerySuggestion[];
  intentSummary: IntentSummary | null;
  criticalGaps: CriticalGap[];
  followUpQueries: FollowUpQuery[];
  priorityActions: PriorityAction[];
  competitiveGaps: CompetitiveGap[];
  gapSummary: GapSummary | null;
  existingQueries: string[];
  onAddQueries: (queries: string[]) => void;
  onGenerateBrief?: (query: string) => void;
}

// ============================================================
// INTENT CATEGORY COLORS
// ============================================================

const INTENT_CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  HIGH: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
  },
  MEDIUM: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30',
  },
  LOW: {
    bg: 'bg-red-500/10',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-500/30',
  },
};

const ROUTE_ICONS: Record<string, { icon: typeof Globe; color: string; label: string }> = {
  WEB_SEARCH: { icon: Globe, color: 'text-emerald-500', label: 'Web Search' },
  PARAMETRIC: { icon: Brain, color: 'text-amber-500', label: 'AI Memory' },
  HYBRID: { icon: Shuffle, color: 'text-blue-500', label: 'Hybrid' },
};

const EFFORT_STYLES: Record<string, { color: string; label: string; icon: string }> = {
  quick_fix: { color: 'text-emerald-500', label: 'Quick Fix', icon: '⚡' },
  moderate: { color: 'text-amber-500', label: 'Moderate', icon: '🔧' },
  major_rewrite: { color: 'text-red-500', label: 'Major', icon: '🏗️' },
};

const VALUE_STYLES: Record<string, { color: string; bg: string }> = {
  critical: { color: 'text-red-600', bg: 'bg-red-500/10' },
  high: { color: 'text-orange-600', bg: 'bg-orange-500/10' },
  medium: { color: 'text-amber-600', bg: 'bg-amber-500/10' },
  low: { color: 'text-muted-foreground', bg: 'bg-muted/50' },
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export function QueryIntelligenceDashboard({
  suggestions,
  intentSummary,
  criticalGaps,
  followUpQueries,
  priorityActions,
  competitiveGaps,
  gapSummary,
  existingQueries,
  onAddQueries,
  onGenerateBrief,
}: QueryIntelligenceDashboardProps) {
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'web_search'>('all');
  const [selectedQueries, setSelectedQueries] = useState<Set<string>>(new Set());
  const [detailsQuery, setDetailsQuery] = useState<EnhancedQuerySuggestion | null>(null);
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(new Set());

  // Filter suggestions based on selected filter
  const filteredSuggestions = useMemo(() => {
    switch (filter) {
      case 'high':
        return suggestions.filter(s => s.intentCategory === 'HIGH');
      case 'medium':
        return suggestions.filter(s => s.intentCategory === 'MEDIUM');
      case 'low':
        return suggestions.filter(s => s.intentCategory === 'LOW');
      case 'web_search':
        return suggestions.filter(s => s.routePrediction === 'WEB_SEARCH');
      default:
        return suggestions;
    }
  }, [suggestions, filter]);

  // Count suggestions by category
  const counts = useMemo(() => ({
    all: suggestions.length,
    high: suggestions.filter(s => s.intentCategory === 'HIGH').length,
    medium: suggestions.filter(s => s.intentCategory === 'MEDIUM').length,
    low: suggestions.filter(s => s.intentCategory === 'LOW').length,
    web_search: suggestions.filter(s => s.routePrediction === 'WEB_SEARCH').length,
  }), [suggestions]);

  const toggleQuery = (query: string) => {
    const newSelected = new Set(selectedQueries);
    if (newSelected.has(query)) {
      newSelected.delete(query);
    } else {
      newSelected.add(query);
    }
    setSelectedQueries(newSelected);
  };

  const handleSelectAllHigh = () => {
    const highQueries = suggestions
      .filter(s => s.intentCategory === 'HIGH' && !existingQueries.includes(s.query))
      .map(s => s.query);
    setSelectedQueries(new Set(highQueries));
  };

  const handleAddSelected = () => {
    const newQueries = Array.from(selectedQueries)
      .filter(q => !existingQueries.includes(q));
    if (newQueries.length > 0) {
      onAddQueries(newQueries);
      setSelectedQueries(new Set());
    }
  };

  const handleAutoAddBest = () => {
    const bestQueries = suggestions
      .filter(s => 
        s.intentCategory === 'HIGH' && 
        s.routePrediction === 'WEB_SEARCH' &&
        s.matchStrength !== 'strong' &&
        !existingQueries.includes(s.query)
      )
      .map(s => s.query);
    
    if (bestQueries.length > 0) {
      onAddQueries(bestQueries);
    }
  };

  const toggleGapExpanded = (query: string) => {
    const newExpanded = new Set(expandedGaps);
    if (newExpanded.has(query)) {
      newExpanded.delete(query);
    } else {
      newExpanded.add(query);
    }
    setExpandedGaps(newExpanded);
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Intent Distribution Summary */}
      {intentSummary && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Query Intent Analysis</h3>
            <Badge variant="secondary" className="ml-auto text-xs">
              {suggestions.length} queries
            </Badge>
          </div>

          {/* Intent Category Bars */}
          <div className="space-y-2">
            <IntentBar
              label="HIGH Relevance"
              count={intentSummary.high_intent}
              total={suggestions.length}
              colorClass="bg-emerald-500"
              description="Strong intent match - prioritize these"
            />
            <IntentBar
              label="MEDIUM Relevance"
              count={intentSummary.medium_intent}
              total={suggestions.length}
              colorClass="bg-blue-500"
              description="Acceptable intent - review carefully"
            />
            <IntentBar
              label="LOW Relevance"
              count={intentSummary.low_intent}
              total={suggestions.length}
              colorClass="bg-red-500"
              description="Intent drift - likely not valuable"
            />
          </div>

          {/* Route Prediction Summary */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
            <RouteIndicator
              icon={Globe}
              label="Web Search"
              count={intentSummary.web_search_likely}
              colorClass="text-emerald-500"
            />
            <RouteIndicator
              icon={Brain}
              label="AI Memory"
              count={intentSummary.parametric_likely}
              colorClass="text-amber-500"
            />
            <RouteIndicator
              icon={Shuffle}
              label="Hybrid"
              count={intentSummary.hybrid_likely}
              colorClass="text-blue-500"
            />
            <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              Avg Score: <span className="font-medium text-foreground">{Math.round((intentSummary.avg_intent_score || 0) * 100)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Section 2: Query List with Filters */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30 overflow-x-auto">
          <FilterButton
            active={filter === 'all'}
            label={`All (${counts.all})`}
            onClick={() => setFilter('all')}
          />
          <FilterButton
            active={filter === 'high'}
            label={`HIGH (${counts.high})`}
            onClick={() => setFilter('high')}
            variant="success"
          />
          <FilterButton
            active={filter === 'medium'}
            label={`MEDIUM (${counts.medium})`}
            onClick={() => setFilter('medium')}
            variant="info"
          />
          <FilterButton
            active={filter === 'low'}
            label={`LOW (${counts.low})`}
            onClick={() => setFilter('low')}
            variant="warning"
          />
          <FilterButton
            active={filter === 'web_search'}
            label={`Web Search (${counts.web_search})`}
            onClick={() => setFilter('web_search')}
            icon={<Globe className="h-3 w-3" />}
          />
        </div>

        {/* Bulk Actions */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background/50">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={selectedQueries.size === counts.high && counts.high > 0}
              onCheckedChange={(checked) => checked ? handleSelectAllHigh() : setSelectedQueries(new Set())}
            />
            <span className="text-muted-foreground">Select All HIGH ({counts.high})</span>
          </label>

          {selectedQueries.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <Button size="sm" onClick={handleAddSelected}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add {selectedQueries.size} Selected
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedQueries(new Set())}>
                Clear
              </Button>
            </div>
          )}

          {selectedQueries.size === 0 && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={handleAutoAddBest}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Auto-Add Best
            </Button>
          )}
        </div>

        {/* Query Cards */}
        <ScrollArea className="h-[350px]">
          <div className="p-3 space-y-2">
            {filteredSuggestions.map((suggestion) => (
              <QueryCard
                key={suggestion.query}
                suggestion={suggestion}
                isSelected={selectedQueries.has(suggestion.query)}
                isExisting={existingQueries.includes(suggestion.query)}
                onToggle={() => toggleQuery(suggestion.query)}
                onViewDetails={() => setDetailsQuery(suggestion)}
                onAdd={() => onAddQueries([suggestion.query])}
              />
            ))}
            {filteredSuggestions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No queries match this filter
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Section 3: Critical Gaps Analysis */}
      {criticalGaps.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold text-sm">Critical Coverage Gaps</h3>
            <Badge variant="destructive" className="ml-auto">
              {criticalGaps.length} gaps
            </Badge>
          </div>
          
          <p className="text-xs text-muted-foreground">
            These HIGH intent queries have weak or no coverage. Addressing them will significantly improve competitiveness.
          </p>

          <div className="space-y-2">
            {criticalGaps.slice(0, 5).map((gap) => (
              <CriticalGapCard
                key={gap.query}
                gap={gap}
                followUps={followUpQueries.filter(f => f.targetGap === gap.query)}
                isExpanded={expandedGaps.has(gap.query)}
                onToggleExpand={() => toggleGapExpanded(gap.query)}
                onGenerateBrief={onGenerateBrief}
              />
            ))}
          </div>
        </div>
      )}

      {/* Section 4: Priority Action Plan */}
      {priorityActions.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-sm">Priority Action Plan</h3>
            <span className="text-xs text-muted-foreground ml-auto">
              Ranked by impact & effort
            </span>
          </div>

          <div className="space-y-2">
            {priorityActions.slice(0, 5).map((action) => (
              <PriorityActionCard
                key={action.rank}
                action={action}
                onApply={onGenerateBrief}
              />
            ))}
          </div>
        </div>
      )}

      {/* Query Details Modal */}
      <Dialog open={!!detailsQuery} onOpenChange={() => setDetailsQuery(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailsQuery && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">Query Analysis</DialogTitle>
              </DialogHeader>
              <QueryDetailsContent query={detailsQuery} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function IntentBar({ 
  label, 
  count, 
  total, 
  colorClass, 
  description 
}: { 
  label: string; 
  count: number; 
  total: number; 
  colorClass: string; 
  description: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground">{count} ({Math.round(percentage)}%)</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all", colorClass)}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-xs">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function RouteIndicator({ 
  icon: Icon, 
  label, 
  count, 
  colorClass 
}: { 
  icon: typeof Globe; 
  label: string; 
  count: number; 
  colorClass: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Icon className={cn("h-3.5 w-3.5", colorClass)} />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{count}</span>
    </div>
  );
}

function FilterButton({ 
  active, 
  label, 
  onClick, 
  variant,
  icon,
}: { 
  active: boolean; 
  label: string; 
  onClick: () => void; 
  variant?: 'success' | 'info' | 'warning';
  icon?: React.ReactNode;
}) {
  const variantStyles = {
    success: active ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30' : '',
    info: active ? 'bg-blue-500/20 text-blue-600 border-blue-500/30' : '',
    warning: active ? 'bg-red-500/20 text-red-600 border-red-500/30' : '',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-xs rounded-md border transition-colors whitespace-nowrap flex items-center gap-1.5",
        active 
          ? variant 
            ? variantStyles[variant] 
            : "bg-primary/10 text-primary border-primary/30"
          : "bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function QueryCard({
  suggestion,
  isSelected,
  isExisting,
  onToggle,
  onViewDetails,
  onAdd,
}: {
  suggestion: EnhancedQuerySuggestion;
  isSelected: boolean;
  isExisting: boolean;
  onToggle: () => void;
  onViewDetails: () => void;
  onAdd: () => void;
}) {
  const intentStyles = INTENT_CATEGORY_STYLES[suggestion.intentCategory || 'MEDIUM'];
  const routeInfo = ROUTE_ICONS[suggestion.routePrediction || 'WEB_SEARCH'];
  const RouteIcon = routeInfo.icon;
  const intentScore = suggestion.intentScore ? Math.round(suggestion.intentScore * 100) : null;

  return (
    <div 
      className={cn(
        "rounded-lg border p-3 transition-all",
        intentStyles.border,
        isSelected && "ring-2 ring-primary/30",
        isExisting && "opacity-50"
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          disabled={isExisting}
          className="mt-1"
        />

        <div className="flex-1 min-w-0 space-y-2">
          {/* Header badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("text-xs", intentStyles.bg, intentStyles.text, "border", intentStyles.border)}>
              {suggestion.intentCategory || 'MEDIUM'}
            </Badge>
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <RouteIcon className={cn("h-3 w-3", routeInfo.color)} />
              {routeInfo.label}
            </Badge>
            {intentScore !== null && (
              <Badge variant="secondary" className="text-xs">
                Score: {intentScore}
              </Badge>
            )}
            {suggestion.variantType && (
              <Badge variant="outline" className="text-xs">
                {suggestion.variantType}
              </Badge>
            )}
          </div>

          {/* Query text */}
          <p className="text-sm font-medium break-words">
            "{suggestion.query}"
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="capitalize">{suggestion.intentType}</span>
            <span>•</span>
            <span className={cn(
              suggestion.matchStrength === 'strong' && 'text-emerald-600',
              suggestion.matchStrength === 'partial' && 'text-amber-600',
              suggestion.matchStrength === 'weak' && 'text-red-600',
            )}>
              {suggestion.matchStrength || 'none'} coverage
            </span>
            {isExisting && (
              <>
                <span>•</span>
                <span className="text-muted-foreground">Already added</span>
              </>
            )}
          </div>

          {/* Drift warning */}
          {suggestion.driftReason && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="break-words">{suggestion.driftReason}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 shrink-0">
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 text-xs"
            onClick={onViewDetails}
          >
            Details
          </Button>
          {!isExisting && suggestion.intentCategory !== 'LOW' && (
            <Button 
              size="sm" 
              className="h-7 text-xs"
              onClick={onAdd}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CriticalGapCard({
  gap,
  followUps,
  isExpanded,
  onToggleExpand,
  onGenerateBrief,
}: {
  gap: CriticalGap;
  followUps: FollowUpQuery[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onGenerateBrief?: (query: string) => void;
}) {
  const effortInfo = EFFORT_STYLES[gap.estimatedEffort] || EFFORT_STYLES.moderate;
  const valueStyles = VALUE_STYLES[gap.competitiveValue] || VALUE_STYLES.medium;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-destructive/10 transition-colors">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <span className="flex-1 text-sm font-medium break-words min-w-0">
              "{gap.query}"
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className={cn("text-xs", valueStyles.bg, valueStyles.color)}>
                {gap.competitiveValue}
              </Badge>
              <Badge variant="outline" className={cn("text-xs", effortInfo.color)}>
                {effortInfo.icon} {effortInfo.label}
              </Badge>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3 border-t border-destructive/20 pt-3">
            <div>
              <span className="text-xs font-medium text-muted-foreground">Current Coverage:</span>
              <span className="ml-2 text-xs capitalize">{gap.currentCoverage}</span>
            </div>

            {gap.missingElements.length > 0 && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Missing Elements:</span>
                <ul className="mt-1 space-y-1">
                  {gap.missingElements.map((el, i) => (
                    <li key={i} className="text-xs text-foreground flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      {el}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <span className="text-xs font-medium text-muted-foreground">Recommendation:</span>
              <p className="mt-1 text-xs text-foreground">{gap.recommendation}</p>
            </div>

            {followUps.length > 0 && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Related Follow-up Queries:</span>
                <div className="mt-1 space-y-1">
                  {followUps.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px]">{f.queryType}</Badge>
                      <span className="flex-1 truncate">"{f.query}"</span>
                      {onGenerateBrief && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 text-xs px-2"
                          onClick={() => onGenerateBrief(f.query)}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Brief
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {onGenerateBrief && (
              <Button 
                size="sm" 
                className="w-full"
                onClick={() => onGenerateBrief(gap.query)}
              >
                <FileText className="h-4 w-4 mr-1.5" />
                Generate Content Brief
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function PriorityActionCard({
  action,
  onApply,
}: {
  action: PriorityAction;
  onApply?: (query: string) => void;
}) {
  const impactStyles = VALUE_STYLES[action.impact] || VALUE_STYLES.medium;
  const effortInfo = EFFORT_STYLES[action.effort] || EFFORT_STYLES.moderate;

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
          {action.rank}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm font-medium">{action.action}</p>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("text-xs", impactStyles.bg, impactStyles.color)}>
              {action.impact} impact
            </Badge>
            <Badge variant="outline" className={cn("text-xs", effortInfo.color)}>
              {effortInfo.icon} {effortInfo.label}
            </Badge>
          </div>

          {action.targetQueries.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {action.targetQueries.slice(0, 3).map((q, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal truncate max-w-[150px]">
                  {q}
                </Badge>
              ))}
              {action.targetQueries.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{action.targetQueries.length - 3} more
                </Badge>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">{action.expectedImprovement}</p>
        </div>

        {onApply && (
          <Button 
            size="sm" 
            variant="outline"
            className="shrink-0"
            onClick={() => onApply(action.action)}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Brief
          </Button>
        )}
      </div>
    </div>
  );
}

function QueryDetailsContent({ query }: { query: EnhancedQuerySuggestion }) {
  const routeInfo = ROUTE_ICONS[query.routePrediction || 'WEB_SEARCH'];
  const RouteIcon = routeInfo.icon;

  return (
    <div className="space-y-6 py-2">
      {/* Query */}
      <div className="p-3 rounded-lg bg-muted/50 border">
        <p className="font-medium text-center">"{query.query}"</p>
      </div>

      {/* Intent Preservation Scores */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Intent Preservation Scores
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <ScoreDisplay
            label="Semantic Similarity"
            value={query.semanticSimilarity}
            description="How semantically close to primary query"
          />
          <ScoreDisplay
            label="Entity Overlap"
            value={query.entityOverlap}
            description="Shared entities between queries"
          />
          <ScoreDisplay
            label="Intent Score"
            value={query.intentScore}
            description="Combined quality score"
            highlight
          />
        </div>
      </div>

      {/* Entity Analysis */}
      {(query.primaryQueryEntities?.length || query.suggestedQueryEntities?.length) && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Entity Analysis
          </h4>
          <div className="space-y-2 text-sm">
            {query.primaryQueryEntities && query.primaryQueryEntities.length > 0 && (
              <div>
                <span className="text-muted-foreground text-xs">Primary Query Entities:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {query.primaryQueryEntities.map((e, i) => (
                    <Badge key={i} variant="secondary">{e}</Badge>
                  ))}
                </div>
              </div>
            )}
            {query.suggestedQueryEntities && query.suggestedQueryEntities.length > 0 && (
              <div>
                <span className="text-muted-foreground text-xs">This Query Entities:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {query.suggestedQueryEntities.map((e, i) => (
                    <Badge key={i} variant="outline">{e}</Badge>
                  ))}
                </div>
              </div>
            )}
            {query.sharedEntities && query.sharedEntities.length > 0 && (
              <div>
                <span className="text-muted-foreground text-xs">Shared Entities:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {query.sharedEntities.map((e, i) => (
                    <Badge key={i} className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">{e}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Route Prediction */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <RouteIcon className={cn("h-4 w-4", routeInfo.color)} />
          Route Prediction
        </h4>
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-2">
            <RouteIcon className={cn("h-5 w-5", routeInfo.color)} />
            <span className="text-sm font-medium">{routeInfo.label}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Confidence: <span className="font-medium text-foreground">{query.routeConfidence || 0}%</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {query.routePrediction === 'WEB_SEARCH' && 'This query is likely to trigger web search results, making it valuable for SEO.'}
          {query.routePrediction === 'PARAMETRIC' && 'This query may be answered from AI memory, reducing web search visibility.'}
          {query.routePrediction === 'HYBRID' && 'This query may trigger a mix of AI and web search results.'}
        </p>
      </div>

      {/* Drift Detection */}
      {query.driftReason && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Intent Drift Detected
          </h4>
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <p className="text-sm">{query.driftReason}</p>
          </div>
        </div>
      )}

      {/* Coverage */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Content Coverage</h4>
        <div className="space-y-1">
          <Badge className={cn(
            "capitalize",
            query.matchStrength === 'strong' && 'bg-emerald-500/20 text-emerald-600',
            query.matchStrength === 'partial' && 'bg-amber-500/20 text-amber-600',
            query.matchStrength === 'weak' && 'bg-red-500/20 text-red-600',
          )}>
            {query.matchStrength || 'none'}
          </Badge>
          {query.matchReason && (
            <p className="text-sm text-muted-foreground">{query.matchReason}</p>
          )}
          {query.relevantSection && (
            <p className="text-sm">
              <span className="text-muted-foreground">Relevant Section:</span> {query.relevantSection}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreDisplay({
  label,
  value,
  description,
  highlight,
}: {
  label: string;
  value?: number;
  description: string;
  highlight?: boolean;
}) {
  const displayValue = value !== undefined ? Math.round(value * 100) : 'N/A';
  const tier = typeof displayValue === 'number' ? getTierFromScore(displayValue) : 'moderate';
  const tierColors = TIER_COLORS[tier];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "p-3 rounded-lg border text-center",
            highlight ? "bg-primary/10 border-primary/30" : "bg-muted/30"
          )}>
            <p className={cn(
              "text-2xl font-bold",
              highlight ? "text-primary" : tierColors.text
            )}>
              {displayValue}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
