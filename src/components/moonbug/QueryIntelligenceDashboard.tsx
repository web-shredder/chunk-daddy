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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Tags,
  List,
  LayoutGrid,
  Layers,
  Info,
  RefreshCw,
  ArrowRight,
  Search,
  FileEdit,
  Lightbulb,
  HelpCircle,
  Wrench,
  Building,
  Copy,
  Download,
  Sprout,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getTierFromScore, TIER_COLORS } from '@/lib/tier-colors';

// ============================================================
// TYPES
// ============================================================

export interface CoreEntity {
  name: string;
  type: string;
  role: 'primary' | 'secondary' | 'example' | string;
  isExplained: boolean;
  mentionCount: number;
  sections: string[];
}

export interface ContentIntelligence {
  coreEntities: CoreEntity[];
  topicHierarchy?: {
    broadCategory: string;
    specificNiche: string;
    exactFocus: string;
  };
  semanticClusters?: Array<{
    clusterName: string;
    concepts: string[];
    coverageDepth: string;
  }>;
}

// Google Patent US 11,663,201 B2 - 7 Actual Variant Types
export type GoogleVariantType = 
  | 'EQUIVALENT'
  | 'FOLLOW_UP'
  | 'GENERALIZATION'
  | 'CANONICALIZATION'
  | 'ENTAILMENT'
  | 'SPECIFICATION'
  | 'CLARIFICATION';

export interface EnhancedQuerySuggestion {
  query: string;
  intentType?: string;
  matchStrength?: 'strong' | 'partial' | 'weak';
  matchReason?: string;
  relevantSection?: string | null;
  confidence?: number;
  searchVolumeTier?: string;
  competitiveness?: string;
  
  // Google Patent variant types
  variantType?: GoogleVariantType | string;
  
  // Entity tracking
  sharedEntities?: string[];
  entityOverlap?: number;
  semanticSimilarity?: number;
  semanticEstimate?: number;
  
  // Calculated server-side
  intentScore?: number;
  intentCategory?: 'HIGH' | 'MEDIUM' | 'LOW';
  
  // Route prediction (can be object from API or legacy string)
  routePrediction?: {
    route: 'WEB_SEARCH' | 'PARAMETRIC' | 'HYBRID';
    confidence: number;
    signals: Array<{ type: string; detected: string; pushesTo: string }>;
  } | 'WEB_SEARCH' | 'PARAMETRIC' | 'HYBRID';
  routeConfidence?: number;
  
  // Entity analysis (keep for backward compat)
  primaryQueryEntities?: string[];
  suggestedQueryEntities?: string[];
  
  // User journey
  userJourneyPosition?: 'early' | 'middle' | 'late';
  
  // Drift detection
  driftReason?: string | null;
  
  // Fallback indicator
  isFallback?: boolean;
}

// Filtered variant (drifted queries)
export interface FilteredVariant {
  query: string;
  variantType: GoogleVariantType | string;
  intentScore: number;
  driftReason: string;
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

// Extracted entities from edge function
export interface ExtractedEntities {
  primary: string[];
  secondary: string[];
  temporal: string[];
  branded: string[];
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
  contentIntelligence?: ContentIntelligence | null;
  // NEW: Entities and filtered queries
  extractedEntities?: ExtractedEntities | null;
  filteredQueries?: FilteredVariant[];
  suggestionsByType?: Record<GoogleVariantType, EnhancedQuerySuggestion[]>;
}

// Entity type color mappings
const ENTITY_TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  primary: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
  },
  concept: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30',
  },
  technology: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-500/30',
  },
  process: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-500/30',
  },
  company: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
  },
  product: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500/30',
  },
  person: {
    bg: 'bg-pink-500/10',
    text: 'text-pink-600 dark:text-pink-400',
    border: 'border-pink-500/30',
  },
  default: {
    bg: 'bg-muted/50',
    text: 'text-muted-foreground',
    border: 'border-border',
  },
};

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

const EFFORT_STYLES: Record<string, { color: string; label: string; icon: LucideIcon }> = {
  quick_fix: { color: 'text-emerald-500', label: 'Quick Fix', icon: Zap },
  moderate: { color: 'text-amber-500', label: 'Moderate', icon: Wrench },
  major_rewrite: { color: 'text-red-500', label: 'Major', icon: Building },
};

const VALUE_STYLES: Record<string, { color: string; bg: string }> = {
  critical: { color: 'text-red-600', bg: 'bg-red-500/10' },
  high: { color: 'text-orange-600', bg: 'bg-orange-500/10' },
  medium: { color: 'text-amber-600', bg: 'bg-amber-500/10' },
  low: { color: 'text-muted-foreground', bg: 'bg-muted/50' },
};

// Google Patent Variant Type Styles - Using Lucide icons instead of emojis
const VARIANT_TYPE_STYLES: Record<string, { 
  bg: string; 
  text: string; 
  border: string; 
  icon: LucideIcon;
  label: string;
  description: string;
}> = {
  EQUIVALENT: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    icon: RefreshCw,
    label: 'Equivalent',
    description: 'Same question, different words (must preserve all entities)'
  },
  FOLLOW_UP: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30',
    icon: ArrowRight,
    label: 'Follow-up',
    description: 'Logical next questions in user journey'
  },
  GENERALIZATION: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-500/30',
    icon: Search,
    label: 'Generalization',
    description: 'Broader versions of the query'
  },
  CANONICALIZATION: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-500/30',
    icon: FileEdit,
    label: 'Canonical',
    description: 'Standardized forms (expand acronyms)'
  },
  ENTAILMENT: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-500/30',
    icon: Lightbulb,
    label: 'Entailment',
    description: 'Logically implied queries'
  },
  SPECIFICATION: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    icon: Target,
    label: 'Specification',
    description: 'Narrower versions with qualifiers'
  },
  CLARIFICATION: {
    bg: 'bg-pink-500/10',
    text: 'text-pink-600 dark:text-pink-400',
    border: 'border-pink-500/30',
    icon: HelpCircle,
    label: 'Clarification',
    description: 'Disambiguation queries'
  },
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
  contentIntelligence,
  extractedEntities,
  filteredQueries = [],
  suggestionsByType,
}: QueryIntelligenceDashboardProps) {
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'web_search' | 'by_type'>('all');
  const [selectedQueries, setSelectedQueries] = useState<Set<string>>(new Set());
  const [detailsQuery, setDetailsQuery] = useState<EnhancedQuerySuggestion | null>(null);
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(new Set());
  const [showFiltered, setShowFiltered] = useState(false);

  // Entity-related state
  const [entityFilter, setEntityFilter] = useState<string | null>(null);
  const [entityViewMode, setEntityViewMode] = useState<'chips' | 'table'>('chips');

  // NEW: Filter suggestions based on entity filter too
  const filteredSuggestions = useMemo(() => {
    let filtered = suggestions;
    
    // Intent/route filter
    switch (filter) {
      case 'high':
        filtered = filtered.filter(s => s.intentCategory === 'HIGH');
        break;
      case 'medium':
        filtered = filtered.filter(s => s.intentCategory === 'MEDIUM');
        break;
      case 'low':
        filtered = filtered.filter(s => s.intentCategory === 'LOW');
        break;
      case 'web_search':
        filtered = filtered.filter(s => s.routePrediction === 'WEB_SEARCH');
        break;
    }
    
    // Entity filter
    if (entityFilter) {
      const lowerFilter = entityFilter.toLowerCase();
      filtered = filtered.filter(s => 
        s.sharedEntities?.some(e => e.toLowerCase() === lowerFilter) ||
        s.primaryQueryEntities?.some(e => e.toLowerCase() === lowerFilter) ||
        s.suggestedQueryEntities?.some(e => e.toLowerCase() === lowerFilter)
      );
    }
    
    return filtered;
  }, [suggestions, filter, entityFilter]);

  // NEW: Compute entity overlap across all suggestions
  const entityOverlap = useMemo(() => {
    const counts: Record<string, number> = {};
    suggestions.forEach(s => {
      (s.sharedEntities || []).forEach(entity => {
        const key = entity.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [suggestions]);

  // Count suggestions by category
  const counts = useMemo(() => ({
    all: suggestions.length,
    high: suggestions.filter(s => s.intentCategory === 'HIGH').length,
    medium: suggestions.filter(s => s.intentCategory === 'MEDIUM').length,
    low: suggestions.filter(s => s.intentCategory === 'LOW').length,
    web_search: suggestions.filter(s => s.routePrediction === 'WEB_SEARCH').length,
  }), [suggestions]);

  // SEO Seed Keywords - generate combinations from entities
  const seoCombinations = useMemo(() => {
    if (!extractedEntities) return [];
    const combinations: string[] = [];
    const primaryEntity = extractedEntities.primary[0] || '';
    
    if (!primaryEntity) return combinations;
    
    // Common SEO modifiers
    const modifiers = [
      'best', 'top', 'how to', 'what is', 'vs', 
      'pricing', 'cost', 'review', 'alternatives', 'guide'
    ];
    
    // Generate combinations with modifiers
    modifiers.forEach(mod => {
      if (mod === 'what is' || mod === 'how to') {
        combinations.push(`${mod} ${primaryEntity}`);
      } else if (mod === 'vs') {
        // Skip vs if no secondary entities
        if (extractedEntities.secondary.length > 0) {
          combinations.push(`${primaryEntity} vs ${extractedEntities.secondary[0]}`);
        }
      } else {
        combinations.push(`${mod} ${primaryEntity}`);
      }
    });
    
    // Add temporal combinations if applicable
    if (extractedEntities.temporal.length > 0) {
      const year = extractedEntities.temporal.find(t => /\d{4}/.test(t));
      if (year) {
        combinations.push(`best ${primaryEntity} ${year}`);
      }
    }
    
    return combinations.slice(0, 8); // Limit to 8 suggestions
  }, [extractedEntities]);

  // Total keyword count for SEO section badge
  const allSeoKeywords = useMemo(() => {
    if (!extractedEntities) return [];
    return [
      ...extractedEntities.primary,
      ...extractedEntities.secondary,
      ...extractedEntities.branded,
      ...seoCombinations,
    ];
  }, [extractedEntities, seoCombinations]);

  // Copy keywords to clipboard
  const handleCopyKeywords = (keywords: string[], label: string) => {
    const text = keywords.join('\n');
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${keywords.length} keywords`, {
      description: `${label} copied to clipboard`,
    });
  };

  // Export SEO keywords to CSV
  const handleExportSEOKeywords = () => {
    if (!extractedEntities) return;
    
    const rows = [
      ['Keyword', 'Type', 'Priority'],
      ...extractedEntities.primary.map(k => [k, 'Core Topic', 'High']),
      ...extractedEntities.secondary.map(k => [k, 'Supporting Concept', 'Medium']),
      ...extractedEntities.branded.map(k => [k, 'Brand Term', 'High']),
      ...seoCombinations.map(k => [k, 'Suggested Combination', 'Medium']),
    ];
    
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'seo-seed-keywords.csv';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Keywords exported', {
      description: `${rows.length - 1} keywords saved to CSV`,
    });
  };

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

  // Show dashboard if we have ANY data worth showing - entities, intent summary, gaps, or suggestions
  const hasAnyData = 
    suggestions.length > 0 || 
    (contentIntelligence?.coreEntities && contentIntelligence.coreEntities.length > 0) ||
    intentSummary ||
    criticalGaps.length > 0;

  if (!hasAnyData) {
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

      {/* Section 1.5: Entity Extraction */}
      {contentIntelligence?.coreEntities && contentIntelligence.coreEntities.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Extracted Entities</h3>
            <Badge variant="secondary" className="ml-auto text-xs">
              {contentIntelligence.coreEntities.length} entities
            </Badge>
            
            {/* View mode toggle */}
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setEntityViewMode('chips')}
                className={cn(
                  "px-2 py-1 text-xs flex items-center gap-1 transition-colors",
                  entityViewMode === 'chips' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <LayoutGrid className="h-3 w-3" />
              </button>
              <button
                onClick={() => setEntityViewMode('table')}
                className={cn(
                  "px-2 py-1 text-xs flex items-center gap-1 transition-colors",
                  entityViewMode === 'table' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <List className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Entity filter indicator */}
          {entityFilter && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
              <span className="text-xs text-muted-foreground">Filtering queries by:</span>
              <Badge variant="secondary" className="text-xs">
                {entityFilter}
              </Badge>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-5 w-5 p-0 ml-auto"
                onClick={() => setEntityFilter(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {entityViewMode === 'chips' ? (
            <div className="space-y-3">
              {/* Primary entities */}
              <EntityChipGroup
                label="Primary Entities"
                entities={contentIntelligence.coreEntities.filter(e => e.role === 'primary')}
                typeKey="primary"
                activeFilter={entityFilter}
                onFilterClick={setEntityFilter}
              />
              
              {/* Concepts & Technologies */}
              <EntityChipGroup
                label="Concepts & Technologies"
                entities={contentIntelligence.coreEntities.filter(e => 
                  ['concept', 'technology', 'process'].includes(e.type.toLowerCase())
                )}
                typeKey="concept"
                activeFilter={entityFilter}
                onFilterClick={setEntityFilter}
              />
              
              {/* Companies & Products */}
              <EntityChipGroup
                label="Companies & Products"
                entities={contentIntelligence.coreEntities.filter(e => 
                  ['company', 'product', 'person'].includes(e.type.toLowerCase())
                )}
                typeKey="company"
                activeFilter={entityFilter}
                onFilterClick={setEntityFilter}
              />
            </div>
          ) : (
            <div className="border border-border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Entity</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs text-center">Mentions</TableHead>
                    <TableHead className="text-xs text-center">Explained</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contentIntelligence.coreEntities.map((entity) => {
                    const typeStyle = ENTITY_TYPE_STYLES[entity.type.toLowerCase()] || ENTITY_TYPE_STYLES.default;
                    return (
                      <TableRow 
                        key={entity.name}
                        className={cn(
                          "cursor-pointer hover:bg-muted/50",
                          entityFilter?.toLowerCase() === entity.name.toLowerCase() && "bg-primary/5"
                        )}
                        onClick={() => setEntityFilter(
                          entityFilter?.toLowerCase() === entity.name.toLowerCase() ? null : entity.name
                        )}
                      >
                        <TableCell className="text-xs font-medium">{entity.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px]", typeStyle.bg, typeStyle.text, typeStyle.border)}>
                            {entity.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs capitalize">{entity.role}</TableCell>
                        <TableCell className="text-xs text-center">{entity.mentionCount || 1}</TableCell>
                        <TableCell className="text-center">
                          {entity.isExplained ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Entity overlap across queries */}
          {entityOverlap.length > 0 && (
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Shuffle className="h-3.5 w-3.5" />
                <span>Most Shared Across Queries</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {entityOverlap.map(({ name, count }) => (
                  <Badge 
                    key={name}
                    variant="secondary" 
                    className={cn(
                      "text-xs cursor-pointer transition-colors",
                      entityFilter?.toLowerCase() === name.toLowerCase() 
                        ? "bg-primary/20 text-primary border-primary/30" 
                        : "hover:bg-muted"
                    )}
                    onClick={() => setEntityFilter(
                      entityFilter?.toLowerCase() === name.toLowerCase() ? null : name
                    )}
                  >
                    {name}
                    <span className="ml-1 opacity-70">({count})</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section 1.7: Extracted Entities from Edge Function */}
      {extractedEntities && (extractedEntities.primary.length > 0 || extractedEntities.temporal.length > 0 || extractedEntities.branded.length > 0) && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Intent Preservation Entities</h3>
            <span className="text-xs text-muted-foreground ml-auto">Google Patent methodology</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {extractedEntities.primary.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  PRIMARY (must preserve)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {extractedEntities.primary.map((entity) => (
                    <Badge key={entity} className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs">{entity}</Badge>
                  ))}
                </div>
              </div>
            )}
            {extractedEntities.branded.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  BRANDED
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {extractedEntities.branded.map((entity) => (
                    <Badge key={entity} variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs">{entity}</Badge>
                  ))}
                </div>
              </div>
            )}
            {extractedEntities.temporal.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  TEMPORAL (affects routing)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {extractedEntities.temporal.map((entity) => (
                    <Badge key={entity} variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs">{entity}</Badge>
                  ))}
                </div>
              </div>
            )}
            {extractedEntities.secondary.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                  SECONDARY
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {extractedEntities.secondary.slice(0, 8).map((entity) => (
                    <Badge key={entity} variant="secondary" className="text-xs">{entity}</Badge>
                  ))}
                  {extractedEntities.secondary.length > 8 && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">+{extractedEntities.secondary.length - 8} more</Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section: SEO Seed Keywords */}
      {extractedEntities && extractedEntities.primary.length > 0 && (
        <Collapsible defaultOpen={false}>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2">
                <Sprout className="h-5 w-5 text-emerald-500" />
                <h3 className="font-semibold text-sm">Probable Seed Keywords for SEO</h3>
                <Badge variant="secondary" className="text-xs">
                  {allSeoKeywords.length} keywords
                </Badge>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="p-4 pt-0 space-y-4">
                {/* Core Topics Section */}
                <SEOKeywordGroup 
                  label="Core Topics" 
                  keywords={extractedEntities.primary}
                  variant="primary"
                  onCopy={handleCopyKeywords}
                />
                
                {/* Secondary Concepts */}
                {extractedEntities.secondary.length > 0 && (
                  <SEOKeywordGroup 
                    label="Supporting Concepts" 
                    keywords={extractedEntities.secondary}
                    variant="secondary"
                    onCopy={handleCopyKeywords}
                  />
                )}
                
                {/* Branded Terms */}
                {extractedEntities.branded.length > 0 && (
                  <SEOKeywordGroup 
                    label="Brand Terms" 
                    keywords={extractedEntities.branded}
                    variant="branded"
                    onCopy={handleCopyKeywords}
                  />
                )}
                
                {/* Generated Combinations */}
                {seoCombinations.length > 0 && (
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Suggested Keyword Combinations
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={() => handleCopyKeywords(seoCombinations, 'Combinations')}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy All
                      </Button>
                    </div>
                    <div className="bg-muted/30 rounded-md p-3 font-mono text-xs space-y-1">
                      {seoCombinations.map((combo, i) => (
                        <div 
                          key={i} 
                          className="flex items-center justify-between group hover:bg-muted/50 px-2 py-1 rounded"
                        >
                          <span>{combo}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              navigator.clipboard.writeText(combo);
                              toast.success('Copied', { description: combo });
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Export All as CSV */}
                <div className="flex justify-end pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleExportSEOKeywords}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Export All Keywords (CSV)
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
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
            active={filter === 'by_type'}
            label="By Type"
            onClick={() => setFilter('by_type')}
            icon={<Layers className="h-3 w-3" />}
          />
          <div className="w-px h-4 bg-border mx-1" />
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
            label={`Web (${counts.web_search})`}
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

        {/* Query Cards - Grouped by Type OR Flat List */}
        <ScrollArea className="h-[400px]">
          <div className="p-3 space-y-3">
            {filter === 'by_type' && suggestionsByType ? (
              Object.entries(VARIANT_TYPE_STYLES).map(([type, style]) => {
                const typeQueries = suggestionsByType[type as GoogleVariantType] || [];
                if (typeQueries.length === 0) return null;
                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center gap-2 sticky top-0 bg-card py-1 z-10">
                      <style.icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{style.label}</span>
                      <Badge variant="secondary" className="text-xs">{typeQueries.length}</Badge>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs">{style.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="space-y-2 pl-7">
                      {typeQueries.map((suggestion) => (
                        <QueryCard
                          key={suggestion.query}
                          suggestion={suggestion}
                          isSelected={selectedQueries.has(suggestion.query)}
                          isExisting={existingQueries.includes(suggestion.query)}
                          onToggle={() => toggleQuery(suggestion.query)}
                          onViewDetails={() => setDetailsQuery(suggestion)}
                          onAdd={() => onAddQueries([suggestion.query])}
                          showVariantType={false}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <>
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
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Section 2.5: Filtered/Drifted Queries (Transparency) */}
      {filteredQueries.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 overflow-hidden">
          <button
            onClick={() => setShowFiltered(!showFiltered)}
            className="w-full flex items-center gap-2 p-3 text-left hover:bg-destructive/10 transition-colors"
          >
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium">Intent Drift Detected</span>
            <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">
              {filteredQueries.length} filtered
            </Badge>
            <span className="text-xs text-muted-foreground ml-auto">
              {showFiltered ? 'Hide' : 'Show'} removed queries
            </span>
            {showFiltered ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
          {showFiltered && (
            <div className="p-3 pt-0 space-y-3 border-t border-destructive/20">
              <p className="text-xs text-muted-foreground">
                These queries serve different user intents than your primary query. 
                <span className="italic ml-1">(Source: iPullRank intent degradation research)</span>
              </p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {filteredQueries.map((fq, i) => {
                  const typeStyle = VARIANT_TYPE_STYLES[fq.variantType as GoogleVariantType] || VARIANT_TYPE_STYLES.CLARIFICATION;
                  return (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-background/50">
                      <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={cn("text-xs flex items-center gap-1", typeStyle.bg, typeStyle.text, "border", typeStyle.border)}>
                            <typeStyle.icon className="h-3 w-3" />
                            {typeStyle.label}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">Score: {Math.round(fq.intentScore * 100)}</Badge>
                        </div>
                        <p className="text-sm break-words">"{fq.query}"</p>
                        <p className="text-xs text-destructive">{fq.driftReason}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

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

function EntityChipGroup({
  label,
  entities,
  typeKey,
  activeFilter,
  onFilterClick,
}: {
  label: string;
  entities: CoreEntity[];
  typeKey: string;
  activeFilter: string | null;
  onFilterClick: (name: string | null) => void;
}) {
  if (entities.length === 0) return null;
  
  const styles = ENTITY_TYPE_STYLES[typeKey] || ENTITY_TYPE_STYLES.default;
  
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {entities.map((entity) => {
          const isActive = activeFilter?.toLowerCase() === entity.name.toLowerCase();
          return (
            <TooltipProvider key={entity.name}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    className={cn(
                      "text-xs border cursor-pointer transition-all",
                      isActive 
                        ? "bg-primary/20 text-primary border-primary/40 ring-2 ring-primary/20" 
                        : cn(styles.bg, styles.text, styles.border, "hover:opacity-80")
                    )}
                    onClick={() => onFilterClick(isActive ? null : entity.name)}
                  >
                    {entity.name}
                    {entity.mentionCount > 1 && (
                      <span className="ml-1 opacity-70">×{entity.mentionCount}</span>
                    )}
                    {entity.isExplained && (
                      <Check className="h-3 w-3 ml-1" />
                    )}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="text-xs space-y-1">
                    <p><span className="font-medium">Type:</span> {entity.type}</p>
                    <p><span className="font-medium">Role:</span> {entity.role}</p>
                    <p><span className="font-medium">Explained in content:</span> {entity.isExplained ? 'Yes' : 'Just mentioned'}</p>
                    {entity.sections?.length > 0 && (
                      <p><span className="font-medium">Sections:</span> {entity.sections.slice(0, 3).join(', ')}{entity.sections.length > 3 ? '...' : ''}</p>
                    )}
                    <p className="pt-1 text-muted-foreground italic">Click to filter queries</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}

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
  showVariantType = true,
}: {
  suggestion: EnhancedQuerySuggestion;
  isSelected: boolean;
  isExisting: boolean;
  onToggle: () => void;
  onViewDetails: () => void;
  onAdd: () => void;
  showVariantType?: boolean;
}) {
  const intentStyles = INTENT_CATEGORY_STYLES[suggestion.intentCategory || 'MEDIUM'];
  // Handle routePrediction as object or string
  const routeKey = typeof suggestion.routePrediction === 'object' 
    ? suggestion.routePrediction?.route 
    : suggestion.routePrediction;
  const routeInfo = ROUTE_ICONS[routeKey || 'WEB_SEARCH'];
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
            {showVariantType && suggestion.variantType && (
              (() => {
                const typeStyle = VARIANT_TYPE_STYLES[suggestion.variantType as GoogleVariantType];
                return typeStyle ? (
                  <Badge className={cn("text-xs flex items-center gap-1", typeStyle.bg, typeStyle.text, "border", typeStyle.border)}>
                    <typeStyle.icon className="h-3 w-3" />
                    {typeStyle.label}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">{suggestion.variantType}</Badge>
                );
              })()
            )}
            {suggestion.entityOverlap !== undefined && (
              <Badge variant="secondary" className="text-xs">
                Entities: {Math.round(suggestion.entityOverlap * 100)}%
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
              <Badge variant="outline" className={cn("text-xs flex items-center gap-1", effortInfo.color)}>
                <effortInfo.icon className="h-3 w-3" />
                {effortInfo.label}
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
            <Badge variant="outline" className={cn("text-xs flex items-center gap-1", effortInfo.color)}>
              <effortInfo.icon className="h-3 w-3" />
              {effortInfo.label}
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
  // Handle routePrediction as object or string
  const routeKey = typeof query.routePrediction === 'object' 
    ? query.routePrediction?.route 
    : query.routePrediction;
  const routeInfo = ROUTE_ICONS[routeKey || 'WEB_SEARCH'];
  const RouteIcon = routeInfo.icon;
  const routeConfidence = typeof query.routePrediction === 'object' 
    ? query.routePrediction?.confidence 
    : query.routeConfidence;

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
            Confidence: <span className="font-medium text-foreground">{routeConfidence || 0}%</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {routeKey === 'WEB_SEARCH' && 'This query is likely to trigger web search results, making it valuable for SEO.'}
          {routeKey === 'PARAMETRIC' && 'This query may be answered from AI memory, reducing web search visibility.'}
          {routeKey === 'HYBRID' && 'This query may trigger a mix of AI and web search results.'}
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

// ============================================================
// SEO KEYWORD GROUP COMPONENT
// ============================================================

function SEOKeywordGroup({ 
  label, 
  keywords, 
  variant, 
  onCopy 
}: { 
  label: string; 
  keywords: string[]; 
  variant: 'primary' | 'secondary' | 'branded';
  onCopy: (keywords: string[], label: string) => void;
}) {
  const styles = {
    primary: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    secondary: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    branded: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 text-xs"
          onClick={() => onCopy(keywords, label)}
        >
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((kw) => (
          <Badge 
            key={kw} 
            variant="outline" 
            className={cn("text-xs cursor-pointer hover:opacity-80 transition-opacity", styles[variant])}
            onClick={() => {
              navigator.clipboard.writeText(kw);
              toast.success('Copied', { description: kw });
            }}
          >
            {kw}
          </Badge>
        ))}
      </div>
    </div>
  );
}
