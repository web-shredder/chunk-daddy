import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  FileText, 
  Wrench, 
  AlertTriangle, 
  Package, 
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Loader2,
  Clock,
  Sparkles,
  FileCheck,
  BarChart3,
  ClipboardList,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArchitectureTask } from '@/lib/optimizer-types';

interface ChunkAssignment {
  chunkIndex: number;
  chunkHeading: string;
  chunkPreview: string;
  assignedQuery: string | null;
  currentScore: number;
}

interface OptimizationPlanPanelProps {
  chunkAssignments: ChunkAssignment[];
  selectedArchitectureTasks: ArchitectureTask[];
  unassignedQueries: string[];
  applyArchitecture: boolean;
  generateBriefs: boolean;
  onToggleArchitecture: (enabled: boolean) => void;
  onToggleBriefs: (enabled: boolean) => void;
  onArchitectureTaskToggle?: (taskId: string) => void;
  onQueryReassign?: (chunkIndex: number, newQuery: string | null) => void;
  allQueries: string[];
  isOptimizing: boolean;
  optimizationStep: string;
  optimizationProgress: number;
  onOptimize: () => void;
}

export function OptimizationPlanPanel({
  chunkAssignments,
  selectedArchitectureTasks,
  unassignedQueries,
  applyArchitecture,
  generateBriefs,
  onToggleArchitecture,
  onToggleBriefs,
  onArchitectureTaskToggle,
  onQueryReassign,
  allQueries,
  isOptimizing,
  optimizationStep,
  optimizationProgress,
  onOptimize,
}: OptimizationPlanPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    chunks: false,
    architecture: false,
    briefs: false,
    outputs: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const chunksToOptimize = chunkAssignments.filter(c => c.assignedQuery);
  const lowScoringChunks = chunksToOptimize.filter(c => c.currentScore < 60);
  const architectureTasksSelected = selectedArchitectureTasks.filter(t => t.isSelected);
  
  const totalActions = 
    chunksToOptimize.length + 
    (applyArchitecture ? architectureTasksSelected.length : 0) + 
    (generateBriefs ? unassignedQueries.length : 0);

  const canOptimize = chunksToOptimize.length > 0;

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5 text-accent" />
            Optimization Plan
          </CardTitle>
          <Badge variant="secondary">{totalActions} actions</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* ============ SECTION 1: CHUNK OPTIMIZATION ============ */}
        <Collapsible open={expandedSections.chunks} onOpenChange={() => toggleSection('chunks')}>
          <CollapsibleTrigger className="w-full">
            <div className="p-3 rounded-lg border border-border bg-background/50 hover:bg-background/80 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {expandedSections.chunks ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Sparkles className="h-4 w-4 text-accent" />
                  <div className="text-left">
                    <p className="font-medium text-sm">Chunk Optimization</p>
                    <p className="text-xs text-muted-foreground">
                      {chunksToOptimize.length} chunks assigned to queries
                      {lowScoringChunks.length > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 ml-1">
                          ({lowScoringChunks.length} below 60)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono">
                  {chunksToOptimize.length}
                </Badge>
              </div>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="mt-2 p-3 rounded-lg border border-border/50 bg-muted/30 space-y-2 max-h-[300px] overflow-y-auto">
              {chunkAssignments.map((chunk) => (
                <div 
                  key={chunk.chunkIndex} 
                  className={cn(
                    "p-3 rounded-md border bg-background",
                    chunk.assignedQuery ? "border-border" : "border-dashed border-muted-foreground/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        Chunk {chunk.chunkIndex + 1}: {chunk.chunkHeading || 'Untitled'}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {chunk.chunkPreview}
                      </p>
                    </div>
                    {chunk.assignedQuery && (
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "shrink-0 font-mono text-xs",
                          chunk.currentScore < 60 && "border-destructive/50 text-destructive"
                        )}
                      >
                        {chunk.currentScore}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">Query:</span>
                    <select
                      value={chunk.assignedQuery || ''}
                      onChange={(e) => onQueryReassign?.(chunk.chunkIndex, e.target.value || null)}
                      className="flex-1 text-xs border rounded px-2 py-1.5 bg-background min-w-0"
                    >
                      <option value="">— No query assigned —</option>
                      {allQueries.map((query, idx) => (
                        <option key={idx} value={query}>
                          {query.length > 60 ? query.slice(0, 60) + '...' : query}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              
              {chunksToOptimize.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No chunks have assigned queries. Go to Results tab to assign queries.
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ============ SECTION 2: ARCHITECTURE TASKS ============ */}
        {selectedArchitectureTasks.length > 0 && (
          <Collapsible open={expandedSections.architecture} onOpenChange={() => toggleSection('architecture')}>
            <CollapsibleTrigger className="w-full">
              <div className="p-3 rounded-lg border border-border bg-background/50 hover:bg-background/80 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedSections.architecture ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">Architecture Tasks</p>
                        <div 
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={applyArchitecture}
                            onCheckedChange={(checked) => onToggleArchitecture(checked === true)}
                          />
                          <span className="text-xs text-muted-foreground">Apply</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {architectureTasksSelected.length} of {selectedArchitectureTasks.length} tasks selected
                      </p>
                    </div>
                  </div>
                  <Badge variant={applyArchitecture ? "outline" : "secondary"} className="font-mono">
                    {applyArchitecture ? architectureTasksSelected.length : 'Off'}
                  </Badge>
                </div>
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="mt-2 p-3 rounded-lg border border-border/50 bg-muted/30 space-y-2 max-h-[250px] overflow-y-auto">
                {selectedArchitectureTasks.map((task) => (
                  <div 
                    key={task.id} 
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-md border bg-background",
                      !applyArchitecture && "opacity-50"
                    )}
                  >
                    <Checkbox
                      checked={task.isSelected}
                      onCheckedChange={() => onArchitectureTaskToggle?.(task.id)}
                      disabled={!applyArchitecture}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge 
                          variant={task.priority === 'high' ? 'destructive' : 'secondary'}
                          className="text-[10px] px-1.5"
                        >
                          {task.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {task.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{task.description}</p>
                      {task.location?.position && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Location: {task.location.position}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ============ SECTION 3: CONTENT BRIEFS ============ */}
        {unassignedQueries.length > 0 && (
          <Collapsible open={expandedSections.briefs} onOpenChange={() => toggleSection('briefs')}>
            <CollapsibleTrigger className="w-full">
              <div className="p-3 rounded-lg border border-border bg-background/50 hover:bg-background/80 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedSections.briefs ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <FileText className="h-4 w-4 text-orange-500" />
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">Content Gaps</p>
                        <div 
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={generateBriefs}
                            onCheckedChange={(checked) => onToggleBriefs(checked === true)}
                          />
                          <span className="text-xs text-muted-foreground">Generate Briefs</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {unassignedQueries.length} queries with no matching content
                      </p>
                    </div>
                  </div>
                  <Badge variant={generateBriefs ? "outline" : "secondary"} className="font-mono">
                    {generateBriefs ? unassignedQueries.length : 'Off'}
                  </Badge>
                </div>
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="mt-2 p-3 rounded-lg border border-border/50 bg-muted/30 space-y-2 max-h-[200px] overflow-y-auto">
                {unassignedQueries.map((query, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "p-3 rounded-md border bg-background",
                      !generateBriefs && "opacity-50"
                    )}
                  >
                    <p className="text-sm font-medium">"{query}"</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Will generate: Section outline, recommended word count, key concepts
                    </p>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ============ SECTION 4: WHAT YOU'LL GET ============ */}
        <Collapsible open={expandedSections.outputs} onOpenChange={() => toggleSection('outputs')}>
          <CollapsibleTrigger className="w-full">
            <div className="p-3 rounded-lg border border-border bg-background/50 hover:bg-background/80 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {expandedSections.outputs ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Package className="h-4 w-4 text-accent" />
                  <div className="text-left">
                    <p className="font-medium text-sm">What You'll Get</p>
                    <p className="text-xs text-muted-foreground">
                      Expected outputs and deliverables
                    </p>
                  </div>
                </div>
                <CheckCircle2 className="h-4 w-4 text-accent" />
              </div>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="mt-2 p-3 rounded-lg border border-border/50 bg-muted/30">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 p-2 rounded bg-background">
                  <Package className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Optimized Content</p>
                    <p className="text-xs text-muted-foreground">
                      Full document with all changes applied, ready to copy to your CMS
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-2 rounded bg-background">
                  <FileCheck className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Before/After Comparisons</p>
                    <p className="text-xs text-muted-foreground">
                      Side-by-side diffs for each chunk with score changes and explanations
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-2 rounded bg-background">
                  <BarChart3 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Score Improvements</p>
                    <p className="text-xs text-muted-foreground">
                      Updated Passage Scores for all {chunksToOptimize.length} chunks with tier movements
                    </p>
                  </div>
                </div>
                
                {applyArchitecture && architectureTasksSelected.length > 0 && (
                  <div className="flex items-start gap-3 p-2 rounded bg-background">
                    <Wrench className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Structural Improvements</p>
                      <p className="text-xs text-muted-foreground">
                        {architectureTasksSelected.length} architecture fixes applied
                      </p>
                    </div>
                  </div>
                )}
                
                {generateBriefs && unassignedQueries.length > 0 && (
                  <div className="flex items-start gap-3 p-2 rounded bg-background">
                    <FileText className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Content Briefs</p>
                      <p className="text-xs text-muted-foreground">
                        {unassignedQueries.length} writing briefs with outlines, key concepts, and word counts
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start gap-3 p-2 rounded bg-background">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Full Report</p>
                    <p className="text-xs text-muted-foreground">
                      Changelog with metrics, action items, and export options
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ============ FOOTER WITH BUTTON ============ */}
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Estimated time: 30-60 seconds
            </span>
            <span>
              Total:{' '}
              <span className="font-medium text-foreground">
                {chunksToOptimize.length} optimizations
                {applyArchitecture && architectureTasksSelected.length > 0 && 
                  ` + ${architectureTasksSelected.length} fixes`}
                {generateBriefs && unassignedQueries.length > 0 && 
                  ` + ${unassignedQueries.length} briefs`}
              </span>
            </span>
          </div>
          
          <Button 
            onClick={onOptimize}
            disabled={!canOptimize || isOptimizing}
            className="w-full gap-2"
            size="lg"
          >
            {isOptimizing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {optimizationStep}... {optimizationProgress}%
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                Confirm & Optimize
              </>
            )}
          </Button>
          
          {!canOptimize && (
            <p className="text-xs text-center text-muted-foreground">
              Assign queries to chunks in the Results tab first
            </p>
          )}
        </div>
        
      </CardContent>
    </Card>
  );
}
