import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Sparkles, Loader2, Wand2, RotateCcw, Plus, Network } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FanoutTreeView } from '@/components/query-input/FanoutTree';
import type { FanoutTree, FanoutNode } from '@/lib/optimizer-types';

interface GeneratedQuery {
  query: string;
  type: 'primary' | 'followup' | 'specification' | 'comparison' | 'howto' | 'decision' | 'problem' | 'custom';
  selected: boolean;
}

interface KeywordInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  maxKeywords?: number;
  content?: string;
}

export function KeywordInput({
  keywords,
  onChange,
  maxKeywords = 50,
  content = '',
}: KeywordInputProps) {
  const [primaryQuery, setPrimaryQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQueries, setGeneratedQueries] = useState<GeneratedQuery[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [customQuery, setCustomQuery] = useState('');
  const [fanoutMode, setFanoutMode] = useState<'simple' | 'tree'>('simple');
  const [fanoutTree, setFanoutTree] = useState<FanoutTree | null>(null);

  const handleGenerateFanout = async () => {
    if (!primaryQuery.trim()) {
      toast.error('Enter a primary query first');
      return;
    }

    setIsGenerating(true);
    setGeneratedQueries([]);

    try {
      const { data, error } = await supabase.functions.invoke('optimize-content', {
        body: {
          type: 'generate_fanout',
          primaryQuery: primaryQuery.trim(),
          contentContext: content?.slice(0, 1000) || '',
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to generate queries');
      }

      const suggestions = data.suggestions || [];
      
      // Map intent types to our internal types
      const intentTypeMap: Record<string, GeneratedQuery['type']> = {
        'follow-up': 'followup',
        'followup': 'followup',
        'specification': 'specification',
        'comparison': 'comparison',
        'process': 'howto',
        'how-to': 'howto',
        'howto': 'howto',
        'decision': 'decision',
        'problem': 'problem',
      };

      const generated: GeneratedQuery[] = [
        { query: primaryQuery.trim(), type: 'primary', selected: true },
        ...suggestions
          .filter((s: any) => s.query && s.query.toLowerCase() !== primaryQuery.trim().toLowerCase())
          .map((s: any) => ({
            query: typeof s === 'string' ? s : s.query,
            type: intentTypeMap[s.intentType?.toLowerCase()] || 'followup',
            selected: true,
          })),
      ];

      setGeneratedQueries(generated);
      setHasGenerated(true);
      toast.success(`Generated ${generated.length - 1} intent-based queries`);
    } catch (err) {
      console.error('Query fanout error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate queries');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleQuery = (query: string) => {
    setGeneratedQueries(prev =>
      prev.map(q =>
        q.query === query ? { ...q, selected: !q.selected } : q
      )
    );
  };

  const handleAddCustomQuery = () => {
    const trimmed = customQuery.trim();
    if (!trimmed) {
      toast.error('Enter a query first');
      return;
    }

    // Check for duplicates
    if (generatedQueries.some(q => q.query.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('This query already exists');
      return;
    }

    setGeneratedQueries(prev => [
      ...prev,
      { query: trimmed, type: 'custom', selected: true }
    ]);
    setCustomQuery('');
    toast.success('Query added');
  };

  const handleRemoveQuery = (query: string) => {
    setGeneratedQueries(prev => prev.filter(q => q.query !== query));
  };

  const handleApplyQueries = () => {
    const selected = generatedQueries
      .filter(q => q.selected)
      .map(q => q.query);
    
    if (selected.length === 0) {
      toast.error('Select at least one query');
      return;
    }

    onChange(selected.slice(0, maxKeywords));
    toast.success(`Applied ${Math.min(selected.length, maxKeywords)} queries`);
  };

  const handleReset = () => {
    setPrimaryQuery('');
    setGeneratedQueries([]);
    setHasGenerated(false);
    setCustomQuery('');
    setFanoutTree(null);
    setFanoutMode('simple');
    onChange([]);
  };

  const handleRemoveKeyword = (keyword: string) => {
    onChange(keywords.filter(k => k !== keyword));
  };

  const selectAll = () => {
    setGeneratedQueries(prev => prev.map(q => ({ ...q, selected: true })));
  };

  const selectNone = () => {
    setGeneratedQueries(prev => prev.map(q => ({ ...q, selected: false })));
  };
  
  // Tree depth and branch controls
  const [treeDepth, setTreeDepth] = useState(3);
  const [treeBranch, setTreeBranch] = useState(3);
  
  // Tree fanout generation
  const handleGenerateFanoutTree = async () => {
    if (!primaryQuery.trim()) {
      toast.error('Enter a primary query first');
      return;
    }

    setIsGenerating(true);
    setFanoutTree(null);

    try {
      // Generate tree with user-selected depth and branch
      const { data: treeData, error: treeError } = await supabase.functions.invoke('optimize-content', {
        body: {
          type: 'generate_fanout_tree',
          primaryQuery: primaryQuery.trim(),
          contentContext: content?.slice(0, 1000) || '',
          maxDepth: treeDepth,
          branchFactor: treeBranch,
        },
      });

      if (treeError || treeData?.error) {
        throw new Error(treeData?.error || treeError?.message || 'Failed to generate tree');
      }

      // Flatten tree to get all queries for deduplication
      const flattenTree = (node: FanoutNode): FanoutNode[] => {
        return [node, ...node.children.flatMap(flattenTree)];
      };
      
      const allNodes = flattenTree(treeData.tree.root);
      const allQueries = allNodes.map((n: FanoutNode) => n.query);

      // Deduplicate
      const { data: dedupData, error: dedupError } = await supabase.functions.invoke('optimize-content', {
        body: {
          type: 'deduplicate_fanout',
          queries: allQueries,
          similarityThreshold: 0.85,
        },
      });

      // Mark duplicates in the tree
      if (dedupData?.uniqueIndices) {
        const uniqueSet = new Set(dedupData.uniqueIndices as number[]);
        const markDuplicates = (node: FanoutNode, queryList: string[]) => {
          const idx = queryList.indexOf(node.query);
          if (idx !== -1 && !uniqueSet.has(idx)) {
            node.isDuplicate = true;
            node.isSelected = false;
          }
          node.children.forEach(child => markDuplicates(child, queryList));
        };
        markDuplicates(treeData.tree.root, allQueries);
        
        // Recalculate selected count
        const countSelected = (node: FanoutNode): number => {
          const selfCount = node.isSelected ? 1 : 0;
          return selfCount + node.children.reduce((sum, child) => sum + countSelected(child), 0);
        };
        treeData.tree.selectedNodes = countSelected(treeData.tree.root);
      }

      setFanoutTree(treeData.tree);
      setHasGenerated(true);
      toast.success(`Generated ${treeData.tree.totalNodes} queries (${dedupData?.removedCount || 0} duplicates marked)`);
    } catch (err) {
      console.error('Tree generation error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate tree');
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Handle tree node selection change
  const handleTreeSelectionChange = useCallback((nodeId: string, selected: boolean) => {
    if (!fanoutTree) return;
    
    const updateNode = (node: FanoutNode): FanoutNode => {
      if (node.id === nodeId) {
        return { ...node, isSelected: selected };
      }
      return {
        ...node,
        children: node.children.map(updateNode),
      };
    };
    
    const newRoot = updateNode(fanoutTree.root);
    
    // Recalculate selected count
    const countSelected = (node: FanoutNode): number => {
      const selfCount = node.isSelected && !node.isDuplicate ? 1 : 0;
      return selfCount + node.children.reduce((sum, child) => sum + countSelected(child), 0);
    };
    
    setFanoutTree({
      ...fanoutTree,
      root: newRoot,
      selectedNodes: countSelected(newRoot),
    });
  }, [fanoutTree]);
  
  const handleTreeSelectAll = useCallback(() => {
    if (!fanoutTree) return;
    
    const selectAllNodes = (node: FanoutNode): FanoutNode => ({
      ...node,
      isSelected: !node.isDuplicate,
      children: node.children.map(selectAllNodes),
    });
    
    const newRoot = selectAllNodes(fanoutTree.root);
    const countSelected = (node: FanoutNode): number => {
      const selfCount = node.isSelected ? 1 : 0;
      return selfCount + node.children.reduce((sum, child) => sum + countSelected(child), 0);
    };
    
    setFanoutTree({
      ...fanoutTree,
      root: newRoot,
      selectedNodes: countSelected(newRoot),
    });
  }, [fanoutTree]);
  
  const handleTreeDeselectAll = useCallback(() => {
    if (!fanoutTree) return;
    
    const deselectAllNodes = (node: FanoutNode): FanoutNode => ({
      ...node,
      isSelected: false,
      children: node.children.map(deselectAllNodes),
    });
    
    setFanoutTree({
      ...fanoutTree,
      root: deselectAllNodes(fanoutTree.root),
      selectedNodes: 0,
    });
  }, [fanoutTree]);
  
  const handleApplyTreeQueries = () => {
    if (!fanoutTree) return;
    
    const getSelectedQueries = (node: FanoutNode): string[] => {
      const queries: string[] = [];
      if (node.isSelected && !node.isDuplicate) queries.push(node.query);
      node.children.forEach(child => queries.push(...getSelectedQueries(child)));
      return queries;
    };
    
    const selected = getSelectedQueries(fanoutTree.root);
    
    if (selected.length === 0) {
      toast.error('Select at least one query');
      return;
    }

    onChange(selected.slice(0, maxKeywords));
    toast.success(`Applied ${Math.min(selected.length, maxKeywords)} queries from tree`);
  };

  const typeLabels: Record<GeneratedQuery['type'], { label: string; color: string }> = {
    primary: { label: 'Primary', color: 'bg-primary text-primary-foreground' },
    followup: { label: 'Follow-up', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    specification: { label: 'Specific', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    comparison: { label: 'Compare', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
    howto: { label: 'How-to', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    decision: { label: 'Decision', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    problem: { label: 'Problem', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    custom: { label: 'Custom', color: 'bg-muted text-muted-foreground' },
  };

  // If keywords are already set (loaded from project), show them with option to regenerate
  if (keywords.length > 0 && !hasGenerated) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <Badge
              key={keyword}
              variant="secondary"
              className="px-3 py-1.5 text-sm"
            >
              {keyword}
              <button
                type="button"
                onClick={() => handleRemoveKeyword(keyword)}
                className="ml-2 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="gap-1.5"
        >
          <RotateCcw className="h-4 w-4" />
          Start Fresh with New Query
        </Button>
        
        <p className="text-xs text-muted-foreground">
          {keywords.length} queries selected for analysis
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step 1: Enter Primary Query */}
      {!hasGenerated && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={primaryQuery}
              onChange={(e) => setPrimaryQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && primaryQuery.trim()) {
                  e.preventDefault();
                  if (fanoutMode === 'tree') {
                    handleGenerateFanoutTree();
                  } else {
                    handleGenerateFanout();
                  }
                }
              }}
              placeholder="Enter your primary search query..."
              className="flex-1"
            />
          </div>
          
          {/* Mode Toggle */}
          <div className="flex items-center justify-between">
            <Tabs value={fanoutMode} onValueChange={(v) => setFanoutMode(v as 'simple' | 'tree')}>
              <TabsList className="h-8">
                <TabsTrigger value="simple" className="text-xs px-3 h-6">
                  Simple (5-7)
                </TabsTrigger>
                <TabsTrigger value="tree" className="text-xs px-3 h-6 gap-1">
                  <Network className="h-3 w-3" />
                  Recursive Tree
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Button
              onClick={fanoutMode === 'tree' ? handleGenerateFanoutTree : handleGenerateFanout}
              disabled={isGenerating || !primaryQuery.trim()}
              className="gap-1.5"
              size="sm"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {fanoutMode === 'tree' ? 'Generate Tree' : 'Generate Variations'}
            </Button>
          </div>
          
          {/* Tree mode controls */}
          {fanoutMode === 'tree' && (
            <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Depth:</label>
                <select 
                  value={treeDepth} 
                  onChange={(e) => setTreeDepth(Number(e.target.value))}
                  className="h-7 px-2 text-xs bg-background border rounded"
                >
                  <option value={2}>2 levels</option>
                  <option value={3}>3 levels</option>
                  <option value={4}>4 levels</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Branch:</label>
                <select 
                  value={treeBranch} 
                  onChange={(e) => setTreeBranch(Number(e.target.value))}
                  className="h-7 px-2 text-xs bg-background border rounded"
                >
                  <option value={2}>2 per node</option>
                  <option value={3}>3 per node</option>
                  <option value={4}>4 per node</option>
                  <option value={5}>5 per node</option>
                </select>
              </div>
              <span className="text-xs text-muted-foreground ml-auto">
                ~{1 + 6 + 6 * (treeDepth > 1 ? treeBranch : 0) + (treeDepth > 2 ? 6 * treeBranch * treeBranch : 0)} queries
              </span>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            {fanoutMode === 'tree' 
              ? `Generate a ${treeDepth}-level recursive tree of intent-diverse queries`
              : 'Generate 5-7 semantic variations to test retrieval'
            }
          </p>
        </div>
      )}

      {/* Loading State */}
      {isGenerating && (
        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium">
              {fanoutMode === 'tree' ? 'Generating fanout tree...' : 'Generating query variations...'}
            </p>
            <p className="text-xs text-muted-foreground">
              {fanoutMode === 'tree' 
                ? `Building 2-level tree for "${primaryQuery}"`
                : `Creating semantic fanouts for "${primaryQuery}"`
              }
            </p>
          </div>
        </div>
      )}

      {/* Tree View - when tree mode */}
      {hasGenerated && fanoutTree && fanoutMode === 'tree' && (
        <div className="space-y-4">
          <FanoutTreeView
            tree={fanoutTree}
            onSelectionChange={handleTreeSelectionChange}
            onSelectAll={handleTreeSelectAll}
            onDeselectAll={handleTreeDeselectAll}
          />
          
          <div className="flex gap-2">
            <Button onClick={handleApplyTreeQueries} className="flex-1 gap-1.5">
              <Sparkles className="h-4 w-4" />
              Use Selected Queries ({fanoutTree.selectedNodes})
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Simple View - when simple mode */}
      {hasGenerated && generatedQueries.length > 0 && fanoutMode === 'simple' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Query Variations</h4>
              <p className="text-xs text-muted-foreground">
                Select which queries to use for analysis ({generatedQueries.filter(q => q.selected).length} selected)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
                All
              </Button>
              <Button variant="ghost" size="sm" onClick={selectNone} className="h-7 text-xs">
                None
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {generatedQueries.map((gq) => (
              <label
                key={gq.query}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  gq.selected 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <Checkbox
                  checked={gq.selected}
                  onCheckedChange={() => toggleQuery(gq.query)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{gq.query}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${typeLabels[gq.type].color}`}>
                  {typeLabels[gq.type].label}
                </span>
                {gq.type === 'custom' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveQuery(gq.query);
                    }}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
            ))}
          </div>

          {/* Add Custom Query */}
          <div className="flex gap-2 pt-2 border-t">
            <Input
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customQuery.trim()) {
                  e.preventDefault();
                  handleAddCustomQuery();
                }
              }}
              placeholder="Add your own query..."
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleAddCustomQuery}
              disabled={!customQuery.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleApplyQueries} className="flex-1 gap-1.5">
              <Sparkles className="h-4 w-4" />
              Use Selected Queries ({generatedQueries.filter(q => q.selected).length})
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
