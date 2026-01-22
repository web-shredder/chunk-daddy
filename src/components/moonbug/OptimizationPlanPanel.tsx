import { useState, useEffect } from 'react';
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
  TrendingUp,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArchitectureTask } from '@/lib/optimizer-types';
import type { ChunkDiagnosis, FailureMode } from '@/lib/diagnostic-scoring';
import { getExcludeReason, type ExcludeReason } from '@/lib/query-assignment';

// Diagnosis badge configuration
const DIAGNOSIS_BADGES: Record<FailureMode, { label: string; shortLabel: string; color: string }> = {
  'topic_mismatch': { label: 'Topic Mismatch', shortLabel: 'Topic', color: 'bg-[hsl(var(--tier-poor-bg))] text-[hsl(var(--tier-poor))] border-[hsl(var(--tier-poor)/0.3)]' },
  'missing_specifics': { label: 'Needs Specifics', shortLabel: 'Vague', color: 'bg-[hsl(var(--tier-moderate-bg))] text-[hsl(var(--tier-moderate))] border-[hsl(var(--tier-moderate)/0.3)]' },
  'buried_answer': { label: 'Buried Answer', shortLabel: 'Buried', color: 'bg-[hsl(var(--tier-weak-bg))] text-[hsl(var(--tier-weak))] border-[hsl(var(--tier-weak)/0.3)]' },
  'vocabulary_gap': { label: 'Missing Terms', shortLabel: 'Terms', color: 'bg-[hsl(var(--info-bg))] text-[hsl(var(--info))] border-[hsl(var(--info)/0.3)]' },
  'no_direct_answer': { label: 'No Direct Answer', shortLabel: 'Answer', color: 'bg-[hsl(var(--tier-poor-bg))] text-[hsl(var(--tier-poor))] border-[hsl(var(--tier-poor)/0.3)]' },
  'structure_problem': { label: 'Structure Issue', shortLabel: 'Structure', color: 'bg-[hsl(var(--tier-moderate-bg))] text-[hsl(var(--tier-moderate))] border-[hsl(var(--tier-moderate)/0.3)]' },
  'already_optimized': { label: 'Optimized ✓', shortLabel: 'Good', color: 'bg-[hsl(var(--tier-good-bg))] text-[hsl(var(--tier-good))] border-[hsl(var(--tier-good)/0.3)]' },
};

interface ChunkAssignment {
  chunkIndex: number;
  chunkHeading: string;
  chunkPreview: string;
  assignedQuery: string | null;
  currentScore: number;
  diagnosis?: ChunkDiagnosis; // Diagnosis for this chunk-query pair
  excludeReason?: ExcludeReason; // Why this chunk is excluded (if at all)
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
  // Force optimize tracking
  forceOptimizeChunks?: Set<number>;
  onForceOptimizeChange?: (chunks: Set<number>) => void;
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
  forceOptimizeChunks = new Set(),
  onForceOptimizeChange,
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

  // Calculate exclusion status for each chunk
  const chunksWithExclusion = chunkAssignments.map(c => {
    const excludeReason = getExcludeReason(
      c.chunkIndex,
      c.assignedQuery ? { query: c.assignedQuery, assignedChunkIndex: c.chunkIndex, score: c.currentScore, isPrimary: false } : null,
      c.currentScore,
      forceOptimizeChunks
    );
    return { ...c, excludeReason };
  });

  // Only count chunks that will actually be optimized (not excluded)
  const chunksToOptimize = chunksWithExclusion.filter(c => c.assignedQuery && !c.excludeReason);
  const alreadyOptimalChunks = chunksWithExclusion.filter(c => c.excludeReason === 'already_optimal');
  const lowScoringChunks = chunksToOptimize.filter(c => c.currentScore < 60);
  const architectureTasksSelected = selectedArchitectureTasks.filter(t => t.isSelected);
  
  const totalActions = 
    chunksToOptimize.length + 
    (applyArchitecture ? architectureTasksSelected.length : 0) + 
    (generateBriefs ? unassignedQueries.length : 0);

  const canOptimize = chunksToOptimize.length > 0;

  // Toggle force optimize for a chunk
  const handleForceOptimizeToggle = (chunkIndex: number, checked: boolean) => {
    if (!onForceOptimizeChange) return;
    const next = new Set(forceOptimizeChunks);
    if (checked) {
      next.add(chunkIndex);
    } else {
      next.delete(chunkIndex);
    }
    onForceOptimizeChange(next);
  };

  // Log optimization plan when component renders (for debugging)
  useEffect(() => {
    console.log('\n=== OPTIMIZATION PLAN PANEL ===');
    console.log('User sees this plan:');
    
    // Chunk Optimization section
    console.log('\n1. CHUNKS TO OPTIMIZE:');
    chunksToOptimize.forEach(ca => {
      console.log(`   Chunk ${ca.chunkIndex + 1}: "${ca.chunkHeading || 'Untitled'}"`);
      console.log(`   - Assigned query: "${ca.assignedQuery}"`);
      console.log(`   - Current score: ${ca.currentScore}`);
      console.log(`   - Preview: ${ca.chunkPreview?.slice(0, 80)}...`);
    });
    
    // Architecture section
    console.log('\n2. ARCHITECTURE TASKS:');
    console.log(`   Apply architecture: ${applyArchitecture}`);
    if (applyArchitecture && architectureTasksSelected.length > 0) {
      architectureTasksSelected.forEach(task => {
        console.log(`   - [${task.priority}] ${task.type}: ${task.description.slice(0, 60)}...`);
      });
    }
    
    // Content Gaps section
    console.log('\n3. CONTENT GAPS:');
    console.log(`   Generate briefs: ${generateBriefs}`);
    if (generateBriefs && unassignedQueries.length > 0) {
      unassignedQueries.forEach(q => {
        console.log(`   - "${q}" (unassigned)`);
      });
    }
    
    // Summary
    console.log('\n4. WHAT USER EXPECTS:');
    console.log(`   - Optimize ${chunksToOptimize.length} chunks`);
    console.log(`   - Apply ${applyArchitecture ? architectureTasksSelected.length : 0} architecture tasks`);
    console.log(`   - Generate ${generateBriefs ? unassignedQueries.length : 0} content briefs`);
    console.log(`   - Total actions: ${totalActions}`);
  }, [chunksToOptimize, applyArchitecture, generateBriefs, architectureTasksSelected, unassignedQueries, totalActions]);

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
                      {chunksToOptimize.length} chunks to optimize
                      {alreadyOptimalChunks.length > 0 && (
                        <span className="text-[hsl(var(--tier-good))] ml-1">
                          ({alreadyOptimalChunks.length} already optimal)
                        </span>
                      )}
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
              {chunksWithExclusion.map((chunk) => {
                const isAlreadyOptimal = chunk.excludeReason === 'already_optimal';
                const isForceIncluded = forceOptimizeChunks.has(chunk.chunkIndex);
                
                return (
                  <div 
                    key={chunk.chunkIndex} 
                    className={cn(
                      "p-3 rounded-md border bg-background transition-opacity",
                      chunk.assignedQuery ? "border-border" : "border-dashed border-muted-foreground/30",
                      isAlreadyOptimal && !isForceIncluded && "opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">
                            Chunk {chunk.chunkIndex + 1}: {chunk.chunkHeading || 'Untitled'}
                          </p>
                          
                          {/* Already Optimal Badge with Force Optimize */}
                          {isAlreadyOptimal && (
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[9px] px-1.5 py-0 h-4 shrink-0",
                                DIAGNOSIS_BADGES.already_optimized.color
                              )}
                            >
                              <TrendingUp className="h-2 w-2 mr-0.5" />
                              Already Good ({chunk.currentScore})
                            </Badge>
                          )}
                          
                          {/* Diagnosis Badge (for non-optimal chunks) */}
                          {!isAlreadyOptimal && chunk.diagnosis && chunk.diagnosis.fixPriority !== 'none' && (
                            <Badge 
                              variant="outline" 
                              className={cn("text-[9px] px-1.5 py-0 h-4 shrink-0", DIAGNOSIS_BADGES[chunk.diagnosis.primaryFailureMode]?.color)}
                            >
                              {chunk.diagnosis.fixPriority === 'critical' && <AlertCircle className="h-2 w-2 mr-0.5" />}
                              {DIAGNOSIS_BADGES[chunk.diagnosis.primaryFailureMode]?.shortLabel}
                              {chunk.diagnosis.expectedImprovement > 0 && (
                                <span className="ml-0.5 opacity-70">+{chunk.diagnosis.expectedImprovement}</span>
                              )}
                            </Badge>
                          )}
                          
                          {/* Force included badge */}
                          {isAlreadyOptimal && isForceIncluded && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                              <RotateCcw className="h-2 w-2 mr-0.5" />
                              Will optimize
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {chunk.chunkPreview}
                        </p>
                      </div>
                      {chunk.assignedQuery && (
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "font-mono text-xs",
                              chunk.currentScore >= 75 && "border-[hsl(var(--tier-good)/0.5)] text-[hsl(var(--tier-good))]",
                              chunk.currentScore < 60 && "border-destructive/50 text-destructive"
                            )}
                          >
                            {chunk.currentScore}
                          </Badge>
                          {!isAlreadyOptimal && chunk.diagnosis && chunk.diagnosis.expectedImprovement > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              → ~{Math.min(100, chunk.currentScore + chunk.diagnosis.expectedImprovement)}
                            </span>
                          )}
                        </div>
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
                    
                    {/* Force optimize checkbox for already optimal chunks */}
                    {isAlreadyOptimal && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <label className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                          <Checkbox
                            checked={isForceIncluded}
                            onCheckedChange={(checked) => handleForceOptimizeToggle(chunk.chunkIndex, checked === true)}
                            className="h-3.5 w-3.5"
                          />
                          <span>Optimize anyway</span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {chunksToOptimize.length === 0 && alreadyOptimalChunks.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No chunks have assigned queries. Go to Results tab to assign queries.
                </div>
              )}
              
              {chunksToOptimize.length === 0 && alreadyOptimalChunks.length > 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm border-t border-border/50 mt-2">
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-[hsl(var(--tier-good))]" />
                  All assigned chunks are already optimal!
                  <br />
                  <span className="text-xs">Check "Optimize anyway" to re-optimize specific chunks.</span>
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
