import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sparkles,
  Check,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Target,
  Zap,
  Plus,
  Loader2,
  RefreshCw,
  Edit3,
  Brain,
  Search,
  Star,
  AlertCircle,
  BarChart3,
  Download,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { downloadQueryIntelligenceCSV } from '@/lib/csv-export';
import { 
  QueryIntelligenceDashboard,
  type EnhancedQuerySuggestion,
  type CriticalGap,
  type FollowUpQuery,
  type PriorityAction,
  type CompetitiveGap,
  type GapSummary,
  type IntentSummary,
} from './QueryIntelligenceDashboard';

// ============================================================
// INTENT COLORS FOR DISTRIBUTION CHART
// ============================================================

const INTENT_COLORS: Record<string, string> = {
  definition: 'hsl(142, 76%, 36%)',
  process: 'hsl(217, 91%, 60%)',
  comparison: 'hsl(24, 95%, 53%)',
  evaluation: 'hsl(330, 81%, 60%)',
  problem: 'hsl(0, 84%, 60%)',
  specification: 'hsl(262, 83%, 58%)',
};

const INTENT_LABELS: Record<string, string> = {
  definition: 'Definition',
  process: 'Process',
  comparison: 'Compare',
  evaluation: 'Evaluate',
  problem: 'Problem',
  specification: 'Specific',
};

// ============================================================
// TYPES
// ============================================================

interface TopicFocus {
  primaryEntity: string;
  entityType: string;
  contentPurpose: string;
  targetAction: string;
  confidence: number;
  alternativeInterpretations?: Array<{
    entity: string;
    confidence: number;
    reason: string;
  }>;
}

interface PrimaryQueryResult {
  query: string;
  searchIntent: string;
  confidence: number;
  reasoning: string;
  variants?: Array<{
    query: string;
    popularity: string;
  }>;
}

interface ContentIntelligence {
  detectedTopicFocus: TopicFocus;
  contentType: string;
  primaryAudience: {
    role: string;
    expertiseLevel: string;
    intent: string;
  };
  coreEntities: Array<{
    name: string;
    type: string;
    role: string;
    isExplained: boolean;
    mentionCount: number;
    sections: string[];
  }>;
  topicHierarchy: {
    broadCategory: string;
    specificNiche: string;
    exactFocus: string;
  };
  semanticClusters: Array<{
    clusterName: string;
    concepts: string[];
    coverageDepth: string;
  }>;
  contentStructure: Record<string, boolean>;
  implicitKnowledge: string[];
}

// Legacy gap type for backward compatibility
interface LegacyCoverageGap {
  gapType: string;
  query: string;
  intentType: string;
  severity: 'critical' | 'important' | 'nice-to-have';
  reason: string;
  evidence?: string;
  suggestedFix: string;
  relatedEntities: string[];
  estimatedEffort?: string;
}

// Query Intelligence state type (matches AnalyzeTab)
interface QueryIntelligenceState {
  detectedTopic: { primaryEntity: string; entityType: string; contentPurpose: string; targetAction: string; confidence: number } | null;
  primaryQuery: { query: string; searchIntent: string; confidence: number; reasoning: string } | null;
  intelligence: ContentIntelligence | null;
  suggestions: EnhancedQuerySuggestion[];
  intentSummary: IntentSummary | null;
  gaps: any;
  entities: { primary: string[]; secondary: string[]; temporal: string[]; branded: string[] } | null;
  filtered: any[];
}

interface QueryAutoSuggestProps {
  content: string;
  existingQueries: string[];
  onAddQueries: (queries: string[]) => void;
  onSetPrimaryQuery?: (query: string) => void;
  // Persistence support
  initialState?: QueryIntelligenceState | null;
  onStateChange?: (state: QueryIntelligenceState | null) => void;
}

// Type aliases are commented to use direct types throughout file for TypeScript compatibility
// type QuerySuggestion = EnhancedQuerySuggestion;
// type CoverageGap = LegacyCoverageGap;

// ============================================================
// INTENT DISTRIBUTION CHART COMPONENT
// ============================================================

function IntentDistributionChart({ suggestions }: { suggestions: EnhancedQuerySuggestion[] }) {
  const distribution = useMemo(() => {
    const counts: Record<string, number> = {};
    suggestions.forEach(s => {
      counts[s.intentType] = (counts[s.intentType] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [suggestions]);

  if (distribution.length === 0) return null;

  const total = suggestions.length;

  return (
    <TooltipProvider>
      <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Intent Distribution</span>
          <Badge variant="secondary" className="text-xs ml-auto">{total} queries</Badge>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-muted/50">
          {distribution.map(({ type, count }) => (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <div
                  className="h-full transition-all hover:opacity-80 cursor-pointer first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${(count / total) * 100}%`,
                    backgroundColor: INTENT_COLORS[type] || 'hsl(var(--muted-foreground))',
                  }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium">{INTENT_LABELS[type] || type}</p>
                <p className="text-muted-foreground">{count} queries ({Math.round((count / total) * 100)}%)</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {distribution.map(({ type, count }) => (
            <span key={type} className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: INTENT_COLORS[type] || 'hsl(var(--muted-foreground))' }}
              />
              {count} {INTENT_LABELS[type] || type}
            </span>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function QueryAutoSuggest({ 
  content, 
  existingQueries, 
  onAddQueries,
  onSetPrimaryQuery,
  initialState,
  onStateChange,
}: QueryAutoSuggestProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  
  // Topic detection state - initialize from saved state
  const [detectedTopic, setDetectedTopic] = useState<TopicFocus | null>(
    initialState?.detectedTopic || null
  );
  const [topicOverride, setTopicOverride] = useState<string | null>(null);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideInput, setOverrideInput] = useState('');
  
  // Primary query state - initialize from saved state
  const [primaryQuery, setPrimaryQuery] = useState<PrimaryQueryResult | null>(
    initialState?.primaryQuery || null
  );
  
  // Results state - initialize from saved state
  const [intelligence, setIntelligence] = useState<ContentIntelligence | null>(
    initialState?.intelligence || null
  );
  const [suggestions, setSuggestions] = useState<EnhancedQuerySuggestion[]>(
    initialState?.suggestions || []
  );
  const [legacyGaps, setLegacyGaps] = useState<LegacyCoverageGap[]>([]);
  
  // Entities from new API - initialize from saved state
  const [entities, setEntities] = useState<{ primary: string[]; secondary: string[]; temporal: string[]; branded: string[] } | null>(
    initialState?.entities || null
  );
  
  // Filtered queries (drifted) - initialize from saved state
  const [filteredQueries, setFilteredQueries] = useState<any[]>(
    initialState?.filtered || []
  );
  
  // Enhanced Query Intelligence state - initialize from saved state
  const [intentSummary, setIntentSummary] = useState<IntentSummary | null>(
    initialState?.intentSummary || null
  );
  const [criticalGaps, setCriticalGaps] = useState<CriticalGap[]>([]);
  const [followUpQueries, setFollowUpQueries] = useState<FollowUpQuery[]>([]);
  const [priorityActions, setPriorityActions] = useState<PriorityAction[]>([]);
  const [competitiveGaps, setCompetitiveGaps] = useState<CompetitiveGap[]>([]);
  const [gapSummary, setGapSummary] = useState<GapSummary | null>(null);
  
  // Selection state
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [selectedGaps, setSelectedGaps] = useState<Set<string>>(new Set());
  const [includePrimaryQuery, setIncludePrimaryQuery] = useState(true);
  
  // View mode: 'classic' (old tabs) or 'dashboard' (new intelligence dashboard)
  const [viewMode, setViewMode] = useState<'classic' | 'dashboard'>('dashboard');
  const [activeTab, setActiveTab] = useState('suggestions');

  const activeTopic = topicOverride || detectedTopic?.primaryEntity || null;

  const runAnalysis = async (overrideTopic?: string) => {
    if (!content || content.length < 100) {
      toast.error('Content too short', {
        description: 'Need at least 100 characters to analyze',
      });
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    setProgressStage('Starting analysis...');

    try {
      // Show step-based progress (not fake percentages)
      const steps = [
        { pct: 15, msg: 'Step 1/4: Detecting topic...' },
        { pct: 35, msg: 'Step 2/4: Generating primary query...' },
        { pct: 60, msg: 'Step 3/4: Finding query opportunities...' },
        { pct: 85, msg: 'Step 4/4: Analyzing coverage gaps...' },
      ];
      let stepIndex = 0;
      
      const progressInterval = setInterval(() => {
        if (stepIndex < steps.length) {
          setProgress(steps[stepIndex].pct);
          setProgressStage(steps[stepIndex].msg);
          stepIndex++;
        }
      }, 3500); // Each step takes ~3.5s with reduced tokens

      const { data, error } = await supabase.functions.invoke('analyze-content-queries', {
        body: { 
          content, 
          existingQueries,
          topicOverride: overrideTopic || topicOverride,
        },
      });

      clearInterval(progressInterval);

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setProgress(100);
      setProgressStage('Complete!');

      // Set detected topic
      const newDetectedTopic = data.intelligence?.detectedTopicFocus || data.detectedTopic;
      setDetectedTopic(newDetectedTopic);
      if (overrideTopic) {
        setTopicOverride(overrideTopic);
      }
      
      // Set primary query
      setPrimaryQuery(data.primaryQuery);
      
      // Set results
      setIntelligence(data.intelligence);
      setSuggestions(data.suggestions || []);
      
      // Set entities from new API
      setEntities(data.entities || null);
      
      // Set filtered (drifted) queries
      setFilteredQueries(data.filtered || []);
      
      // Handle enhanced gap analysis response (new format)
      const gapsData = data.gaps || {};
      setLegacyGaps(gapsData.legacy_gaps || []);
      setCriticalGaps(gapsData.critical_gaps || []);
      setFollowUpQueries(gapsData.follow_up_queries || []);
      setPriorityActions(gapsData.priority_actions || []);
      setCompetitiveGaps(gapsData.competitive_gaps || []);
      setGapSummary(gapsData.gap_summary || null);
      
      // Set intent summary from suggestions response
      setIntentSummary(data.suggestionsSummary || null);

      // Pre-select strong matches and HIGH intent queries
      const strongMatches = (data.suggestions || [])
        .filter((s: EnhancedQuerySuggestion) => s.matchStrength === 'strong' || s.intentCategory === 'HIGH')
        .slice(0, 5)
        .map((s: EnhancedQuerySuggestion) => s.query);
      const gapQueries = (gapsData.legacy_gaps || [])
        .filter((g: LegacyCoverageGap) => g.severity === 'critical')
        .map((g: LegacyCoverageGap) => g.query);
      
      setSelectedSuggestions(new Set(strongMatches));
      setSelectedGaps(new Set(gapQueries));
      setIncludePrimaryQuery(true);
      
      // PERSIST STATE TO PARENT (so it survives tab switches)
      if (onStateChange) {
        onStateChange({
          detectedTopic: newDetectedTopic,
          primaryQuery: data.primaryQuery,
          intelligence: data.intelligence,
          suggestions: data.suggestions || [],
          intentSummary: data.suggestionsSummary || null,
          gaps: gapsData,
          entities: data.entities || null,
          filtered: data.filtered || [],
        });
      }

      // Show partial analysis warning if applicable
      if (data.partial) {
        toast.warning('Partial analysis complete', {
          description: `Gap analysis skipped due to time limits. Topic: "${newDetectedTopic?.primaryEntity || 'Unknown'}"`,
        });
      } else {
        toast.success('Analysis complete', {
          description: `Detected topic: "${newDetectedTopic?.primaryEntity || 'Unknown'}"`,
        });
      }

    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Analysis failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOverrideTopic = () => {
    if (!overrideInput.trim()) return;
    setTopicOverride(overrideInput.trim());
    setShowOverrideDialog(false);
    runAnalysis(overrideInput.trim());
  };

  const clearOverride = () => {
    setTopicOverride(null);
    setOverrideInput('');
    if (detectedTopic) {
      runAnalysis();
    }
  };

  const handleAddSelected = () => {
    const queriesToAdd: string[] = [];
    
    // Add primary query if selected
    if (includePrimaryQuery && primaryQuery) {
      queriesToAdd.push(primaryQuery.query);
      onSetPrimaryQuery?.(primaryQuery.query);
    }
    
    // Add selected suggestions and gaps
    queriesToAdd.push(
      ...Array.from(selectedSuggestions),
      ...Array.from(selectedGaps),
    );
    
    // Filter out any that already exist
    const newQueries = queriesToAdd.filter(q => 
      !existingQueries.some(eq => eq.toLowerCase().trim() === q.toLowerCase().trim())
    );
    
    if (newQueries.length === 0) {
      toast.error('All selected queries already exist');
      return;
    }

    onAddQueries(newQueries);
    
    // Clear selections
    setSelectedSuggestions(new Set());
    setSelectedGaps(new Set());
    setIncludePrimaryQuery(false);
    
    toast.success(`Added ${newQueries.length} queries`);
  };

  const toggleSuggestion = (query: string) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(query)) {
      newSelected.delete(query);
    } else {
      newSelected.add(query);
    }
    setSelectedSuggestions(newSelected);
  };

  const toggleGap = (query: string) => {
    const newSelected = new Set(selectedGaps);
    if (newSelected.has(query)) {
      newSelected.delete(query);
    } else {
      newSelected.add(query);
    }
    setSelectedGaps(newSelected);
  };

  const totalSelected = selectedSuggestions.size + selectedGaps.size + (includePrimaryQuery && primaryQuery ? 1 : 0);

  // Group suggestions by match strength
  const strongSuggestions = suggestions.filter(s => s.matchStrength === 'strong');
  const partialSuggestions = suggestions.filter(s => s.matchStrength === 'partial');
  const weakSuggestions = suggestions.filter(s => s.matchStrength === 'weak');

  // Group legacy gaps by severity
  const legacyCriticalGaps = legacyGaps.filter(g => g.severity === 'critical');
  const legacyImportantGaps = legacyGaps.filter(g => g.severity === 'important');
  const legacyNiceToHaveGaps = legacyGaps.filter(g => g.severity === 'nice-to-have');
  
  // Check if we have enhanced intelligence data - show dashboard if we have ANY data
  // Relaxed check: show if we have intent summary, any suggestions, detected topic, OR entity extraction
  const hasEnhancedData = intentSummary || suggestions.length > 0 || detectedTopic || (intelligence?.coreEntities && intelligence.coreEntities.length > 0);
  
  // Check if we have entity data but suggestions failed (partial success state)
  const hasEntitiesButNoSuggestions = (intelligence?.coreEntities && intelligence.coreEntities.length > 0) && suggestions.length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-sm">Query Intelligence with AI</h4>
          </div>
          <div className="flex items-center gap-2">
            {detectedTopic && !isAnalyzing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  downloadQueryIntelligenceCSV({
                    detectedTopic,
                    primaryQuery,
                    intelligence,
                    suggestions,
                    gaps: legacyGaps,
                  }, detectedTopic.primaryEntity);
                  toast.success('CSV exported', {
                    description: `Saved query intelligence for "${detectedTopic.primaryEntity}"`,
                  });
                }}
              >
                <Download className="h-4 w-4 mr-1.5" />
                Export CSV
              </Button>
            )}
            <Button
              onClick={() => runAnalysis()} 
              disabled={isAnalyzing || !content}
              size="sm"
              variant={detectedTopic ? 'outline' : 'default'}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Analyzing...
                </>
              ) : detectedTopic ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Re-analyze
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Detect Topic & Suggest Queries
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Progress bar */}
        {isAnalyzing && (
          <div className="space-y-1.5">
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground text-center">{progressStage}</p>
          </div>
        )}
      </div>

      {/* Topic Detection Display */}
      {detectedTopic && !isAnalyzing && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">
                  {topicOverride ? 'Topic (Override)' : 'Detected Topic'}
                </span>
                {topicOverride && (
                  <button 
                    onClick={clearOverride}
                    className="text-xs text-destructive hover:underline flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    Clear override
                  </button>
                )}
              </div>

              <p className="font-semibold text-lg text-foreground">
                {activeTopic}
              </p>

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs">
                  {detectedTopic.entityType}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {detectedTopic.contentPurpose}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {Math.round(detectedTopic.confidence * 100)}% confident
                </Badge>
              </div>

              {detectedTopic.targetAction && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Reader goal:</span> {detectedTopic.targetAction}
                </p>
              )}
            </div>
            
            {/* Override button */}
            <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="shrink-0">
                  <Edit3 className="h-4 w-4 mr-1.5" />
                  Change Topic
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Override Detected Topic</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    The AI detected this content is about "{detectedTopic.primaryEntity}". 
                    If that's wrong, enter the correct topic below.
                  </p>
                  <Input
                    placeholder="Enter the correct topic..."
                    value={overrideInput}
                    onChange={(e) => setOverrideInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleOverrideTopic()}
                  />
                  {detectedTopic.alternativeInterpretations && detectedTopic.alternativeInterpretations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Or select an alternative:</p>
                      <div className="flex flex-wrap gap-2">
                        {detectedTopic.alternativeInterpretations.map((alt, i) => (
                          <Badge 
                            key={i}
                            variant="outline" 
                            className="cursor-pointer hover:bg-primary/10"
                            onClick={() => {
                              setOverrideInput(alt.entity);
                            }}
                          >
                            {alt.entity}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowOverrideDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleOverrideTopic} disabled={!overrideInput.trim()}>
                    Re-analyze with New Topic
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

      {/* Primary Query Display */}
      {primaryQuery && !isAnalyzing && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={includePrimaryQuery}
              onCheckedChange={(checked) => setIncludePrimaryQuery(!!checked)}
              className="mt-1"
            />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Primary Query</span>
                <Badge variant="outline" className="text-xs">
                  {primaryQuery.searchIntent}
                </Badge>
              </div>

              <p className="font-medium text-foreground">{primaryQuery.query}</p>

              <p className="text-xs text-muted-foreground">
                {primaryQuery.reasoning}
              </p>

              {primaryQuery.variants && primaryQuery.variants.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs text-muted-foreground mb-1">Variants:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {primaryQuery.variants.slice(0, 3).map((v, i) => (
                      <Badge key={i} variant="secondary" className="text-xs font-normal">
                        {v.query}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warning: Entities found but suggestions failed */}
      {hasEntitiesButNoSuggestions && detectedTopic && !isAnalyzing && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="font-medium text-sm">Query generation partially failed</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Topic detected: &quot;{detectedTopic.primaryEntity}&quot; with {intelligence?.coreEntities?.length || 0} entities extracted,
            but query suggestions failed to generate. The AI response may have timed out or returned invalid data.
          </p>
          {intelligence?.coreEntities && intelligence.coreEntities.length > 0 && (
            <div className="pt-2">
              <span className="text-xs text-muted-foreground">Extracted entities (still available):</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {intelligence.coreEntities.slice(0, 8).map(e => (
                  <Badge key={e.name} variant="secondary" className="text-xs">{e.name}</Badge>
                ))}
                {intelligence.coreEntities.length > 8 && (
                  <Badge variant="outline" className="text-xs">+{intelligence.coreEntities.length - 8} more</Badge>
                )}
              </div>
            </div>
          )}
          <Button
            onClick={() => runAnalysis()}
            size="sm"
            variant="outline"
            className="mt-2"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry Analysis
          </Button>
        </div>
      )}

      {/* Intent Distribution Chart */}
      {suggestions.length > 0 && !isAnalyzing && (
        <IntentDistributionChart suggestions={suggestions} />
      )}

      {/* View Mode Toggle + Results */}
      {(suggestions.length > 0 || legacyGaps.length > 0) && !isAnalyzing && (
        <>
          {/* View Toggle - only show when we have enhanced data */}
          {hasEnhancedData && (
            <div className="flex items-center gap-2 justify-end">
              <span className="text-xs text-muted-foreground">View:</span>
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode('dashboard')}
                  className={cn(
                    "px-3 py-1.5 text-xs transition-colors",
                    viewMode === 'dashboard' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  Intelligence Dashboard
                </button>
                <button
                  onClick={() => setViewMode('classic')}
                  className={cn(
                    "px-3 py-1.5 text-xs transition-colors border-l border-border",
                    viewMode === 'classic' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  Classic View
                </button>
              </div>
            </div>
          )}

          {/* NEW: Query Intelligence Dashboard when enhanced data available */}
          {hasEnhancedData && viewMode === 'dashboard' && (
            <QueryIntelligenceDashboard
              suggestions={suggestions}
              intentSummary={intentSummary}
              criticalGaps={criticalGaps}
              followUpQueries={followUpQueries}
              priorityActions={priorityActions}
              competitiveGaps={competitiveGaps}
              gapSummary={gapSummary}
              existingQueries={existingQueries}
              onAddQueries={onAddQueries}
              contentIntelligence={intelligence}
            />
          )}

          {/* Classic View (legacy tabs) - show when no enhanced data or user switches */}
          {(!hasEnhancedData || viewMode === 'classic') && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between">
                <TabsList className="grid grid-cols-2 w-[280px]">
                  <TabsTrigger value="suggestions" className="text-xs">
                    <Search className="h-3.5 w-3.5 mr-1.5" />
                    Queries ({suggestions.length})
                  </TabsTrigger>
                  <TabsTrigger value="gaps" className="text-xs">
                    <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                    Gaps ({legacyGaps.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="suggestions" className="mt-3">
                <ScrollArea className="h-[350px] pr-3">
                  <div className="space-y-3">
                    <SuggestionGroup
                      title="Strong Matches"
                      description="Content directly answers these"
                      icon={<Check className="h-4 w-4 text-green-500" />}
                      suggestions={strongSuggestions}
                      selectedQueries={selectedSuggestions}
                      existingQueries={existingQueries}
                      onToggle={toggleSuggestion}
                      color="green"
                    />
                    <SuggestionGroup
                      title="Partial Matches"
                      description="Content touches on these"
                      icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />}
                      suggestions={partialSuggestions}
                      selectedQueries={selectedSuggestions}
                      existingQueries={existingQueries}
                      onToggle={toggleSuggestion}
                      color="yellow"
                    />
                    <SuggestionGroup
                      title="Weak Matches"
                      description="Content barely addresses"
                      icon={<X className="h-4 w-4 text-red-500" />}
                      suggestions={weakSuggestions}
                      selectedQueries={selectedSuggestions}
                      existingQueries={existingQueries}
                      onToggle={toggleSuggestion}
                      color="red"
                      defaultCollapsed
                    />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="gaps" className="mt-3">
                <ScrollArea className="h-[350px] pr-3">
                  <div className="space-y-3">
                    <GapGroup
                      title="Critical Gaps"
                      description="High-value queries you should address"
                      gaps={legacyCriticalGaps}
                      selectedGaps={selectedGaps}
                      existingQueries={existingQueries}
                      onToggle={toggleGap}
                      severity="critical"
                    />
                    <GapGroup
                      title="Important Gaps"
                      description="Recommended improvements"
                      gaps={legacyImportantGaps}
                      selectedGaps={selectedGaps}
                      existingQueries={existingQueries}
                      onToggle={toggleGap}
                      severity="important"
                    />
                    <GapGroup
                      title="Nice to Have"
                      description="Optional enhancements"
                      gaps={legacyNiceToHaveGaps}
                      selectedGaps={selectedGaps}
                      existingQueries={existingQueries}
                      onToggle={toggleGap}
                      severity="nice-to-have"
                      defaultCollapsed
                    />
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-sm text-muted-foreground">
              {totalSelected} queries selected
              {includePrimaryQuery && primaryQuery && ' (including primary)'}
            </span>
            <Button onClick={handleAddSelected} disabled={totalSelected === 0}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Selected Queries
            </Button>
          </div>
        </>
      )}

      {/* Empty state */}
      {!isAnalyzing && !detectedTopic && (
        <div className="text-center py-8 text-muted-foreground">
          <Brain className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No analysis yet</p>
          <p className="text-sm mt-1">
            Click "Detect Topic & Suggest Queries" to automatically identify what your content is about and generate relevant queries
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

interface SuggestionGroupProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  suggestions: EnhancedQuerySuggestion[];
  selectedQueries: Set<string>;
  existingQueries: string[];
  onToggle: (query: string) => void;
  color: 'green' | 'yellow' | 'red';
  defaultCollapsed?: boolean;
}

function SuggestionGroup({
  title,
  description,
  icon,
  suggestions,
  selectedQueries,
  existingQueries,
  onToggle,
  color,
  defaultCollapsed = false,
}: SuggestionGroupProps) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);

  if (suggestions.length === 0) return null;

  const colorClasses = {
    green: 'border-green-500/20 bg-green-500/5',
    yellow: 'border-yellow-500/20 bg-yellow-500/5',
    red: 'border-red-500/20 bg-red-500/5',
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn('rounded-lg border p-3', colorClasses[color])}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-sm font-medium">{title}</span>
              <Badge variant="secondary" className="text-xs">
                {suggestions.length}
              </Badge>
            </div>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground mb-2">{description}</p>
          {suggestions.map((suggestion, i) => {
            const exists = existingQueries.some(
              eq => eq.toLowerCase().trim() === suggestion.query.toLowerCase().trim()
            );
            return (
              <label
                key={i}
                className={cn(
                  'flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors',
                  exists ? 'opacity-50 cursor-not-allowed' : 'hover:bg-background/50'
                )}
              >
                <Checkbox
                  checked={selectedQueries.has(suggestion.query)}
                  onCheckedChange={() => !exists && onToggle(suggestion.query)}
                  disabled={exists}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{suggestion.query}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {suggestion.matchReason}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {suggestion.intentType}
                </Badge>
              </label>
            );
          })}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface GapGroupProps {
  title: string;
  description: string;
  gaps: LegacyCoverageGap[];
  selectedGaps: Set<string>;
  existingQueries: string[];
  onToggle: (query: string) => void;
  severity: 'critical' | 'important' | 'nice-to-have';
  defaultCollapsed?: boolean;
}

function GapGroup({
  title,
  description,
  gaps,
  selectedGaps,
  existingQueries,
  onToggle,
  severity,
  defaultCollapsed = false,
}: GapGroupProps) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);

  if (gaps.length === 0) return null;

  const severityStyles = {
    critical: {
      border: 'border-red-500/30',
      bg: 'bg-red-500/5',
      icon: <AlertCircle className="h-4 w-4 text-red-500" />,
    },
    important: {
      border: 'border-orange-500/30',
      bg: 'bg-orange-500/5',
      icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
    },
    'nice-to-have': {
      border: 'border-blue-500/30',
      bg: 'bg-blue-500/5',
      icon: <Lightbulb className="h-4 w-4 text-blue-500" />,
    },
  };

  const styles = severityStyles[severity];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn('rounded-lg border p-3', styles.border, styles.bg)}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {styles.icon}
              <span className="text-sm font-medium">{title}</span>
              <Badge variant="secondary" className="text-xs">
                {gaps.length}
              </Badge>
            </div>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground mb-2">{description}</p>
          {gaps.map((gap, i) => {
            const exists = existingQueries.some(
              eq => eq.toLowerCase().trim() === gap.query.toLowerCase().trim()
            );
            return (
              <label
                key={i}
                className={cn(
                  'flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors',
                  exists ? 'opacity-50 cursor-not-allowed' : 'hover:bg-background/50'
                )}
              >
                <Checkbox
                  checked={selectedGaps.has(gap.query)}
                  onCheckedChange={() => !exists && onToggle(gap.query)}
                  disabled={exists}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{gap.query}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {gap.reason}
                  </p>
                  {gap.suggestedFix && (
                    <p className="text-xs text-primary/80 mt-1">
                      <Zap className="h-3 w-3 inline mr-1" />
                      {gap.suggestedFix}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="outline" className="text-xs">
                    {gap.intentType}
                  </Badge>
                  {gap.estimatedEffort && (
                    <span className="text-xs text-muted-foreground">
                      {gap.estimatedEffort} effort
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
