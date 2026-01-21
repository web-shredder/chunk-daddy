import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

interface QuerySuggestion {
  query: string;
  intentType: string;
  matchStrength: 'strong' | 'partial' | 'weak';
  matchReason: string;
  relevantSection: string | null;
  confidence: number;
}

interface CoverageGap {
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

interface QueryAutoSuggestProps {
  content: string;
  existingQueries: string[];
  onAddQueries: (queries: string[]) => void;
  onSetPrimaryQuery?: (query: string) => void;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function QueryAutoSuggest({ 
  content, 
  existingQueries, 
  onAddQueries,
  onSetPrimaryQuery,
}: QueryAutoSuggestProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  
  // Topic detection state
  const [detectedTopic, setDetectedTopic] = useState<TopicFocus | null>(null);
  const [topicOverride, setTopicOverride] = useState<string | null>(null);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideInput, setOverrideInput] = useState('');
  
  // Primary query state
  const [primaryQuery, setPrimaryQuery] = useState<PrimaryQueryResult | null>(null);
  
  // Results state
  const [intelligence, setIntelligence] = useState<ContentIntelligence | null>(null);
  const [suggestions, setSuggestions] = useState<QuerySuggestion[]>([]);
  const [gaps, setGaps] = useState<CoverageGap[]>([]);
  
  // Selection state
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [selectedGaps, setSelectedGaps] = useState<Set<string>>(new Set());
  const [includePrimaryQuery, setIncludePrimaryQuery] = useState(true);
  
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
    setProgressStage('Reading content...');

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 20) {
            setProgressStage('Detecting primary topic...');
            return prev + 4;
          } else if (prev < 40) {
            setProgressStage('Analyzing content structure...');
            return prev + 3;
          } else if (prev < 60) {
            setProgressStage('Generating primary query...');
            return prev + 3;
          } else if (prev < 80) {
            setProgressStage('Finding query opportunities...');
            return prev + 2;
          } else if (prev < 95) {
            setProgressStage('Detecting coverage gaps...');
            return prev + 1;
          }
          return prev;
        });
      }, 400);

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
      setDetectedTopic(data.intelligence.detectedTopicFocus);
      if (overrideTopic) {
        setTopicOverride(overrideTopic);
      }
      
      // Set primary query
      setPrimaryQuery(data.primaryQuery);
      
      // Set results
      setIntelligence(data.intelligence);
      setSuggestions(data.suggestions || []);
      setGaps(data.gaps || []);

      // Pre-select strong matches
      const strongMatches = (data.suggestions || [])
        .filter((s: QuerySuggestion) => s.matchStrength === 'strong')
        .slice(0, 5)
        .map((s: QuerySuggestion) => s.query);
      const criticalGaps = (data.gaps || [])
        .filter((g: CoverageGap) => g.severity === 'critical')
        .map((g: CoverageGap) => g.query);
      
      setSelectedSuggestions(new Set(strongMatches));
      setSelectedGaps(new Set(criticalGaps));
      setIncludePrimaryQuery(true);

      toast.success('Analysis complete', {
        description: `Detected topic: "${data.detectedTopic?.primaryEntity || 'Unknown'}"`,
      });

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

  // Group gaps by severity
  const criticalGaps = gaps.filter(g => g.severity === 'critical');
  const importantGaps = gaps.filter(g => g.severity === 'important');
  const niceToHaveGaps = gaps.filter(g => g.severity === 'nice-to-have');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-sm">AI Query Intelligence</h4>
          </div>
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

      {/* Suggestions & Gaps Tabs */}
      {(suggestions.length > 0 || gaps.length > 0) && !isAnalyzing && (
        <>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between">
              <TabsList className="grid grid-cols-2 w-[280px]">
                <TabsTrigger value="suggestions" className="text-xs">
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                  Queries ({suggestions.length})
                </TabsTrigger>
                <TabsTrigger value="gaps" className="text-xs">
                  <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                  Gaps ({gaps.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="suggestions" className="mt-3">
              <ScrollArea className="h-[350px] pr-3">
                <div className="space-y-3">
                  {/* Strong Matches */}
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

                  {/* Partial Matches */}
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

                  {/* Weak Matches */}
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
                    gaps={criticalGaps}
                    selectedGaps={selectedGaps}
                    existingQueries={existingQueries}
                    onToggle={toggleGap}
                    severity="critical"
                  />

                  <GapGroup
                    title="Important Gaps"
                    description="Recommended improvements"
                    gaps={importantGaps}
                    selectedGaps={selectedGaps}
                    existingQueries={existingQueries}
                    onToggle={toggleGap}
                    severity="important"
                  />

                  <GapGroup
                    title="Nice to Have"
                    description="Optional enhancements"
                    gaps={niceToHaveGaps}
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
  suggestions: QuerySuggestion[];
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
  gaps: CoverageGap[];
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
