import { useState } from 'react';
import { Plus, X, Play, Loader2, Microscope, Sparkles, Check, Network, ChevronRight, ChevronDown, List, ListTree } from 'lucide-react';
import { DismissableTip } from '@/components/DismissableTip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDebug } from '@/contexts/DebugContext';
import type { ChunkerOptions } from '@/lib/layout-chunker';
import type { FanoutNode, FanoutTree, FanoutIntentType } from '@/lib/optimizer-types';
import { cn } from '@/lib/utils';
import { FanoutListView } from './FanoutListView';
import { ExportFanoutDialog } from './ExportFanoutDialog';
import { QueryAutoSuggest } from './QueryAutoSuggest';
import { QuerySidebar } from './QuerySidebar';
import { AnalysisStreamingPanel } from './AnalysisStreamingPanel';
import type { AnalysisStep, EmbeddingInfo, EmbeddingBatch, DocumentChamferResult, ChunkScoredEvent, CoverageSummary, DiagnosticProgress, AnalysisSummary } from './AnalysisStreamingPanel';

// Fanout tree node types for recursive display
interface ExpandedQuery {
  keyword: string;
  isOriginal: boolean;
  selected: boolean;
  intentType?: FanoutIntentType;
  aspectLabel?: string;
  level?: number;
}
const intentColors: Record<FanoutIntentType, string> = {
  primary: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  follow_up: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  specification: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  comparison: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  process: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  decision: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  problem: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  aspect: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
};
const intentLabels: Record<FanoutIntentType, string> = {
  primary: 'Primary',
  follow_up: 'Follow-up',
  specification: 'Specific',
  comparison: 'Compare',
  process: 'How-to',
  decision: 'Decision',
  problem: 'Problem',
  aspect: 'Aspect',
};
// Query Intelligence state type (persisted in Index.tsx)
export interface QueryIntelligenceState {
  detectedTopic: { primaryEntity: string; entityType: string; contentPurpose: string; targetAction: string; confidence: number } | null;
  primaryQuery: { query: string; searchIntent: string; confidence: number; reasoning: string } | null;
  intelligence: any | null;
  suggestions: any[];
  intentSummary: any | null;
  gaps: any;
  entities: { primary: string[]; secondary: string[]; temporal: string[]; branded: string[] } | null;
  filtered: any[];
}

interface AnalyzeTabProps {
  hasChunks: boolean;
  keywords: string[];
  onKeywordsChange: (keywords: string[]) => void;
  chunkerOptions: ChunkerOptions;
  onOptionsChange: (options: ChunkerOptions) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  progress: number;
  onGoToContent: () => void;
  content?: string;
  // Query Intelligence persistence
  queryIntelligence?: QueryIntelligenceState | null;
  onQueryIntelligenceChange?: (state: QueryIntelligenceState | null) => void;
  // Streaming analysis state
  streamingState?: {
    steps: AnalysisStep[];
    currentStep: number;
    embeddingInfo: EmbeddingInfo | null;
    embeddingProgress: EmbeddingBatch | null;
    documentChamfer: DocumentChamferResult | null;
    scoredChunks: ChunkScoredEvent[];
    coverageSummary: CoverageSummary | null;
    diagnosticProgress: DiagnosticProgress | null;
    summary: AnalysisSummary | null;
    error: string | null;
  };
}
export function AnalyzeTab({
  hasChunks,
  keywords,
  onKeywordsChange,
  chunkerOptions,
  onOptionsChange,
  onAnalyze,
  isAnalyzing,
  progress,
  onGoToContent,
  content = '',
  queryIntelligence,
  onQueryIntelligenceChange,
  streamingState,
}: AnalyzeTabProps) {
  const [newQuery, setNewQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedQueries, setExpandedQueries] = useState<ExpandedQuery[]>([]);
  const [fanoutOpen, setFanoutOpen] = useState(true);

  // Fanout tree state
  const [fanoutTree, setFanoutTree] = useState<FanoutTree | null>(null);
  const [fanoutDepth, setFanoutDepth] = useState(3);
  const [fanoutBranch, setFanoutBranch] = useState(3);
  const [fanoutMode, setFanoutMode] = useState<'simple' | 'tree'>('simple');
  const [fanoutViewMode, setFanoutViewMode] = useState<'tree' | 'list'>('tree');
  const addQuery = () => {
    if (newQuery.trim() && !keywords.includes(newQuery.trim())) {
      onKeywordsChange([...keywords, newQuery.trim()]);
      setNewQuery('');
    }
  };
  const removeQuery = (index: number) => {
    onKeywordsChange(keywords.filter((_, i) => i !== index));
  };

  // Flatten tree nodes to array for selection
  const flattenTree = (node: FanoutNode): FanoutNode[] => {
    return [node, ...node.children.flatMap(flattenTree)];
  };

  // Count selected nodes in tree
  const countSelected = (node: FanoutNode): number => {
    return (node.isSelected ? 1 : 0) + node.children.reduce((sum, child) => sum + countSelected(child), 0);
  };

  // Toggle node selection in tree
  const toggleNodeSelection = (nodeId: string, selected: boolean) => {
    if (!fanoutTree) return;
    const updateNode = (node: FanoutNode): FanoutNode => {
      if (node.id === nodeId) {
        return {
          ...node,
          isSelected: selected
        };
      }
      return {
        ...node,
        children: node.children.map(updateNode)
      };
    };
    const newRoot = updateNode(fanoutTree.root);
    setFanoutTree({
      ...fanoutTree,
      root: newRoot,
      selectedNodes: countSelected(newRoot)
    });
  };

  // Select/deselect all tree nodes
  const setAllSelected = (selected: boolean) => {
    if (!fanoutTree) return;
    const updateNode = (node: FanoutNode): FanoutNode => ({
      ...node,
      isSelected: selected,
      children: node.children.map(updateNode)
    });
    const newRoot = updateNode(fanoutTree.root);
    setFanoutTree({
      ...fanoutTree,
      root: newRoot,
      selectedNodes: selected ? fanoutTree.totalNodes : 0
    });
  };
  const handleGenerateFanout = async () => {
    if (!newQuery.trim()) {
      toast.error('Enter a query first');
      return;
    }
    setIsGenerating(true);
    setExpandedQueries([]);
    setFanoutTree(null);
    try {
      if (fanoutMode === 'tree') {
        // Use the new recursive fanout tree generator
        const {
          data,
          error
        } = await supabase.functions.invoke('optimize-content', {
          body: {
            type: 'generate_fanout_tree',
            primaryQuery: newQuery.trim(),
            maxDepth: fanoutDepth,
            branchFactor: fanoutBranch
          }
        });
        if (error || data?.error) {
          throw new Error(data?.error || error?.message);
        }
        if (data?.tree) {
          setFanoutTree(data.tree as FanoutTree);
          toast.success(`Generated ${data.tree.totalNodes} queries in recursive tree (depth ${fanoutDepth})`);
        }
      } else {
        // Simple fanout (5-7 queries)
        const {
          data,
          error
        } = await supabase.functions.invoke('optimize-content', {
          body: {
            type: 'generate_fanout',
            primaryQuery: newQuery.trim()
          }
        });
        if (error || data?.error) {
          throw new Error(data?.error || error?.message);
        }
        const suggestions = data.suggestions || [];

        // Create expanded queries: primary + generated
        const expanded: ExpandedQuery[] = [{
          keyword: newQuery.trim(),
          isOriginal: true,
          selected: true,
          intentType: 'primary',
          level: 0
        }, ...suggestions.map((s: {
          query: string;
          intent?: string;
          aspect?: string;
        }, idx: number) => ({
          keyword: s.query || s,
          isOriginal: false,
          selected: true,
          intentType: (s.intent as FanoutIntentType) || 'aspect',
          aspectLabel: s.aspect,
          level: 1
        }))];
        setExpandedQueries(expanded);
        toast.success(`Generated ${suggestions.length} related queries`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate fanout queries');
    } finally {
      setIsGenerating(false);
    }
  };

  // Apply selected queries from tree
  const applyTreeQueries = () => {
    if (!fanoutTree) return;
    const selectedQueries = flattenTree(fanoutTree.root).filter(node => node.isSelected).map(node => node.query).filter(q => !keywords.includes(q));
    onKeywordsChange([...keywords, ...selectedQueries]);
    setFanoutTree(null);
    setNewQuery('');
    toast.success(`Added ${selectedQueries.length} queries`);
  };
  const toggleExpandedQuery = (keyword: string) => {
    setExpandedQueries(prev => prev.map(q => q.keyword === keyword ? {
      ...q,
      selected: !q.selected
    } : q));
  };
  const applyExpandedQueries = () => {
    const selected = expandedQueries.filter(q => q.selected).map(q => q.keyword).filter(k => !keywords.includes(k));
    onKeywordsChange([...keywords, ...selected]);
    setExpandedQueries([]);
    setNewQuery('');
    toast.success(`Added ${selected.length} queries`);
  };
  const clearExpandedQueries = () => {
    setExpandedQueries([]);
  };
  const selectAllQueries = () => {
    setExpandedQueries(prev => prev.map(q => ({
      ...q,
      selected: true
    })));
  };
  const deselectAllQueries = () => {
    setExpandedQueries(prev => prev.map(q => ({
      ...q,
      selected: false
    })));
  };
  if (!hasChunks) {
    return <div className="flex-1 flex items-center justify-center p-4">
        <div className="empty-state">
          <Microscope size={48} strokeWidth={1} />
          <h3>Chunk your content first</h3>
          <p>Go to the Content tab and click "Chunk It, Daddy"</p>
          <button className="btn-secondary" onClick={onGoToContent}>
            Go to Content
          </button>
        </div>
      </div>;
  }
  const canAnalyze = keywords.some(k => k.trim()) && !isAnalyzing;
  const selectedCount = expandedQueries.filter(q => q.selected).length;
  
  return (
    <div className="flex-1 overflow-hidden bg-background">
      <div className="flex h-full">
        {/* Main Content Area */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* AI Query Intelligence - PRIMARY */}
            <div className="panel">
              <QueryAutoSuggest 
                content={content}
                existingQueries={keywords}
                onAddQueries={(queries) => onKeywordsChange([...keywords, ...queries])}
                onSetPrimaryQuery={(query) => {
                  if (!keywords.includes(query)) {
                    onKeywordsChange([query, ...keywords.filter(k => k !== query)]);
                  }
                }}
                initialState={queryIntelligence}
                onStateChange={onQueryIntelligenceChange}
              />
            </div>

            {/* Divider */}
            <div className="relative">
              <Separator />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground">
                  or add queries manually
                </span>
              </div>
            </div>

            {/* Manual Queries - Accordion */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="manual-input" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 bg-muted/30 hover:bg-muted/50 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">Manual Query Input</span>
                    {(expandedQueries.length > 0 || fanoutTree) && (
                      <Badge variant="secondary" className="text-xs">
                        {fanoutTree ? `${fanoutTree.totalNodes} in tree` : `${expandedQueries.length} expanded`}
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pt-4 pb-4 space-y-4">
                  {/* Fanout Mode Toggle */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setFanoutMode('simple')} 
                      className={cn(
                        "flex-1 py-1.5 px-3 rounded-md text-xs transition-colors",
                        fanoutMode === 'simple' 
                          ? "bg-accent/20 text-accent" 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      Simple (5-7)
                    </button>
                    <button 
                      onClick={() => setFanoutMode('tree')} 
                      className={cn(
                        "flex-1 py-1.5 px-3 rounded-md text-xs transition-colors flex items-center justify-center gap-1.5",
                        fanoutMode === 'tree' 
                          ? "bg-accent/20 text-accent" 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Network className="h-3.5 w-3.5" />
                      Recursive Tree
                    </button>
                  </div>

                  {/* Tree Mode Controls */}
                  {fanoutMode === 'tree' && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Depth</Label>
                        <Select value={String(fanoutDepth)} onValueChange={v => setFanoutDepth(Number(v))}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2">2 levels</SelectItem>
                            <SelectItem value="3">3 levels</SelectItem>
                            <SelectItem value="4">4 levels</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Branch</Label>
                        <Select value={String(fanoutBranch)} onValueChange={v => setFanoutBranch(Number(v))}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2">Queries & Fanout</SelectItem>
                            <SelectItem value="3">3 children</SelectItem>
                            <SelectItem value="4">4 children</SelectItem>
                            <SelectItem value="5">5 children</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 text-[10px] text-muted-foreground text-center">
                        Est. ~{1 + 6 + 6 * fanoutBranch + (fanoutDepth > 2 ? 6 * fanoutBranch * fanoutBranch : 0)} nodes
                      </div>
                    </div>
                  )}

                  {/* Add Query Input */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input 
                      value={newQuery} 
                      onChange={e => setNewQuery(e.target.value)} 
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addQuery();
                        }
                      }} 
                      placeholder="Enter search query..." 
                      className="flex-1 moonbug-input" 
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={addQuery} 
                        disabled={!newQuery.trim()} 
                        className="btn-secondary flex-1 sm:flex-none"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={handleGenerateFanout} 
                        disabled={!newQuery.trim() || isGenerating} 
                        className="btn-secondary gap-1.5 flex-1 sm:flex-none" 
                        title="Generate related query variations"
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : fanoutMode === 'tree' ? (
                          <Network className="h-4 w-4" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        <span className="text-xs">Run Fanout</span>
                      </button>
                    </div>
                  </div>

                  {/* Fanout Tree View (new recursive) */}
                  {fanoutTree && (
                    <div className="border border-accent/30 rounded-lg bg-accent/5 overflow-hidden">
                      <div className="flex items-center justify-between p-3 border-b border-accent/20">
                        <div className="flex items-center gap-2">
                          <Network className="h-4 w-4 text-accent" />
                          <span className="text-sm font-medium">Query Fanout</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {fanoutTree.selectedNodes} / {fanoutTree.totalNodes}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* View Mode Toggle */}
                          <div className="flex items-center border border-border rounded-md overflow-hidden">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn("h-7 px-2 rounded-none", fanoutViewMode === 'tree' && "bg-muted")}
                              onClick={() => setFanoutViewMode('tree')}
                            >
                              <ListTree className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn("h-7 px-2 rounded-none", fanoutViewMode === 'list' && "bg-muted")}
                              onClick={() => setFanoutViewMode('list')}
                            >
                              <List className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {/* Export Dialog */}
                          <ExportFanoutDialog
                            queries={flattenTree(fanoutTree.root).map(node => ({
                              id: node.id,
                              query: node.query,
                              intentType: node.intentType,
                              aspectLabel: node.aspectLabel,
                              level: node.level,
                              parentId: node.parentId,
                              isSelected: node.isSelected,
                            }))}
                            primaryQuery={fanoutTree.root.query}
                          />
                          {/* Select All/None */}
                          <div className="flex items-center gap-1">
                            <button onClick={() => setAllSelected(true)} className="text-xs text-primary hover:underline">
                              All
                            </button>
                            <span className="text-muted-foreground text-xs">|</span>
                            <button onClick={() => setAllSelected(false)} className="text-xs text-muted-foreground hover:text-foreground">
                              None
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {fanoutViewMode === 'tree' ? (
                        <ScrollArea className="h-[300px]">
                          <div className="p-2">
                            <FanoutNodeDisplay node={fanoutTree.root} onToggle={toggleNodeSelection} />
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="p-3">
                          <FanoutListView
                            queries={flattenTree(fanoutTree.root).map(node => ({
                              id: node.id,
                              query: node.query,
                              intentType: node.intentType,
                              aspectAnswered: node.aspectLabel,
                              level: node.level,
                              parentId: node.parentId,
                              isSelected: node.isSelected,
                            }))}
                            primaryQuery={fanoutTree.root.query}
                            onToggleSelect={(id) => toggleNodeSelection(id, !flattenTree(fanoutTree.root).find(n => n.id === id)?.isSelected)}
                            onSelectAll={() => setAllSelected(true)}
                            onDeselectAll={() => setAllSelected(false)}
                            onDeleteSelected={() => {/* Not implemented for tree mode */}}
                            onDeleteQuery={() => {/* Not implemented for tree mode */}}
                            showTreeView={() => setFanoutViewMode('tree')}
                          />
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 p-3 border-t border-accent/20">
                        <button onClick={applyTreeQueries} className="btn-primary flex-1 h-8 text-sm">
                          <Check className="h-3.5 w-3.5 mr-1.5" />
                          Apply {fanoutTree.selectedNodes} Selected
                        </button>
                        <button onClick={() => setFanoutTree(null)} className="btn-secondary h-8">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Simple Fanout Expanded Queries */}
                  {expandedQueries.length > 0 && !fanoutTree && (
                    <Collapsible open={fanoutOpen} onOpenChange={setFanoutOpen}>
                      <div className="border border-accent/30 rounded-lg p-3 bg-accent/5 space-y-3">
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center justify-between w-full text-sm font-medium text-foreground">
                            <span>Related Queries ({selectedCount} of {expandedQueries.length} selected)</span>
                            <Sparkles className="h-4 w-4 text-accent" />
                          </button>
                        </CollapsibleTrigger>

                        <CollapsibleContent className="space-y-3">
                          {/* Select/Deselect All */}
                          <div className="flex items-center gap-2 text-xs">
                            <button onClick={selectAllQueries} className="text-primary hover:underline">
                              Select All
                            </button>
                            <span className="text-muted-foreground">|</span>
                            <button onClick={deselectAllQueries} className="text-muted-foreground hover:text-foreground">
                              Deselect All
                            </button>
                          </div>

                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {expandedQueries.map(query => (
                              <label 
                                key={query.keyword} 
                                className="flex items-start gap-2 cursor-pointer p-2 rounded-md hover:bg-background/50"
                              >
                                <Checkbox 
                                  checked={query.selected} 
                                  onCheckedChange={() => toggleExpandedQuery(query.keyword)} 
                                  className="mt-0.5" 
                                />
                                {/* Show aspect label if available, otherwise show intent type */}
                                {query.aspectLabel ? (
                                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded-full">
                                    {query.aspectLabel}
                                  </span>
                                ) : query.intentType && (
                                  <Badge variant="outline" className={cn("shrink-0 text-[10px] px-1.5", intentColors[query.intentType])}>
                                    {intentLabels[query.intentType]}
                                  </Badge>
                                )}
                                <span className="text-sm flex-1">{query.keyword}</span>
                                {query.isOriginal && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                    primary
                                  </Badge>
                                )}
                              </label>
                            ))}
                          </div>

                          <div className="flex items-center gap-2">
                            <button onClick={applyExpandedQueries} className="btn-primary flex-1 h-8 text-sm">
                              <Check className="h-3.5 w-3.5 mr-1.5" />
                              Apply {selectedCount} Selected
                            </button>
                            <button onClick={clearExpandedQueries} className="btn-secondary h-8">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Analysis Progress - Streaming Panel or Simple Progress */}
            {(isAnalyzing || streamingState?.summary || (streamingState?.scoredChunks?.length ?? 0) > 0) && streamingState && (
              <AnalysisStreamingPanel
                isAnalyzing={isAnalyzing}
                steps={streamingState.steps}
                currentStep={streamingState.currentStep}
                embeddingInfo={streamingState.embeddingInfo}
                embeddingProgress={streamingState.embeddingProgress}
                documentChamfer={streamingState.documentChamfer}
                scoredChunks={streamingState.scoredChunks}
                coverageSummary={streamingState.coverageSummary}
                diagnosticProgress={streamingState.diagnosticProgress}
                summary={streamingState.summary}
                error={streamingState.error}
              />
            )}
            
            {isAnalyzing && !streamingState && (
              <div className="space-y-2">
                <Progress value={progress} className="h-1" />
                <p className="text-xs text-muted-foreground text-center">
                  Generating embeddings and calculating similarity...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Query Sidebar */}
        <QuerySidebar
          queries={keywords}
          onRemoveQuery={(query) => onKeywordsChange(keywords.filter(k => k !== query))}
          onClearAll={() => onKeywordsChange([])}
          onAnalyze={onAnalyze}
          isAnalyzing={isAnalyzing}
          canAnalyze={canAnalyze}
        />
      </div>
    </div>
  );
}

// Recursive fanout node display component
function FanoutNodeDisplay({
  node,
  onToggle
}: {
  node: FanoutNode;
  onToggle: (nodeId: string, selected: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  return <div className="relative">
      <div className={cn("flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-background/50 transition-colors", node.isSelected && "bg-primary/5")} style={{
      marginLeft: `${node.level * 16}px`
    }}>
        {hasChildren ? <button onClick={() => setExpanded(!expanded)} className="p-0.5 hover:bg-muted rounded shrink-0">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </button> : <div className="w-4" />}
        
        <Checkbox checked={node.isSelected} onCheckedChange={checked => onToggle(node.id, !!checked)} className="shrink-0" />
        
        {/* Show aspect label if available, otherwise show intent type */}
        {node.aspectLabel ? (
          <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-full">
            {node.aspectLabel}
          </span>
        ) : (
          <Badge variant="outline" className={cn("shrink-0 text-[10px] px-1.5", intentColors[node.intentType])}>
            {intentLabels[node.intentType]}
          </Badge>
        )}
        
        <span className="text-xs flex-1 truncate" title={node.query}>
          {node.query}
        </span>
        
        <Badge variant="outline" className="shrink-0 text-[9px] text-muted-foreground">
          L{node.level}
        </Badge>
      </div>

      {expanded && hasChildren && <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 border-l border-border/50" style={{
        marginLeft: `${(node.level + 1) * 16 + 6}px`
      }} />
          {node.children.map(child => <FanoutNodeDisplay key={child.id} node={child} onToggle={onToggle} />)}
        </div>}
    </div>;
}