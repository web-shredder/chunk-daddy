import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  CheckCircle2, 
  FileText, 
  Wrench, 
  AlertTriangle, 
  Package, 
  ArrowRight,
  Clock,
  Sparkles,
  FileCheck,
  BarChart3,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArchitectureTask } from '@/lib/optimizer-types';

interface ChunkAssignment {
  chunkIndex: number;
  chunkHeading: string;
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
}

export function OptimizationPlanPanel({
  chunkAssignments,
  selectedArchitectureTasks,
  unassignedQueries,
  applyArchitecture,
  generateBriefs,
  onToggleArchitecture,
  onToggleBriefs,
}: OptimizationPlanPanelProps) {
  const chunksToOptimize = chunkAssignments.filter(c => c.assignedQuery);
  const lowScoringChunks = chunksToOptimize.filter(c => c.currentScore < 60);
  
  // Calculate totals
  const totalActions = 
    chunksToOptimize.length + 
    (applyArchitecture ? selectedArchitectureTasks.length : 0) +
    (generateBriefs ? unassignedQueries.length : 0);

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-5 w-5 text-accent" />
          Optimization Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ============ WHAT WE'LL DO ============ */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            What We'll Do
          </h4>
          
          <div className="space-y-4">
            {/* Chunk Optimization */}
            <div className="p-3 rounded-lg border border-border bg-background/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span className="font-medium text-sm">Optimize Chunks</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {chunksToOptimize.length} chunks
                </Badge>
              </div>
              
              {lowScoringChunks.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-2">
                  <AlertTriangle className="h-3 w-3" />
                  {lowScoringChunks.length} chunks scoring below 60 (priority targets)
                </div>
              )}
              
              <div className="space-y-1.5">
                {chunksToOptimize.slice(0, 4).map((chunk) => (
                  <div key={chunk.chunkIndex} className="flex items-center justify-between text-xs py-1 px-2 bg-muted/30 rounded">
                    <span className="text-muted-foreground truncate max-w-[180px]">
                      Chunk {chunk.chunkIndex + 1}: {chunk.chunkHeading || 'Untitled'}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px] px-1.5 h-4 font-mono",
                          chunk.currentScore < 60 && "border-destructive/50 text-destructive"
                        )}
                      >
                        {Math.round(chunk.currentScore)}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-muted-foreground truncate max-w-[120px]" title={chunk.assignedQuery || ''}>
                        "{chunk.assignedQuery?.slice(0, 20)}..."
                      </span>
                    </div>
                  </div>
                ))}
                {chunksToOptimize.length > 4 && (
                  <div className="text-xs text-muted-foreground pl-2">
                    +{chunksToOptimize.length - 4} more chunks
                  </div>
                )}
              </div>
            </div>

            {/* Architecture Tasks */}
            {selectedArchitectureTasks.length > 0 && (
              <div className="p-3 rounded-lg border border-border bg-background/50">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={applyArchitecture}
                      onCheckedChange={(checked) => onToggleArchitecture(checked === true)}
                    />
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Apply Architecture Tasks</span>
                  </label>
                  <Badge variant="secondary" className="text-xs">
                    {selectedArchitectureTasks.length} tasks
                  </Badge>
                </div>
                
                {applyArchitecture && (
                  <div className="space-y-1.5 mt-2">
                    {selectedArchitectureTasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="flex items-center gap-2 text-xs py-1 px-2 bg-muted/30 rounded">
                        <Badge 
                          variant={task.priority === 'high' ? 'destructive' : 'secondary'} 
                          className="text-[10px] px-1 h-4"
                        >
                          {task.priority}
                        </Badge>
                        <span className="text-muted-foreground truncate">{task.description.slice(0, 50)}...</span>
                      </div>
                    ))}
                    {selectedArchitectureTasks.length > 3 && (
                      <div className="text-xs text-muted-foreground pl-2">
                        +{selectedArchitectureTasks.length - 3} more tasks
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Content Briefs for Gaps */}
            {unassignedQueries.length > 0 && (
              <div className="p-3 rounded-lg border border-border bg-background/50">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={generateBriefs}
                      onCheckedChange={(checked) => onToggleBriefs(checked === true)}
                    />
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Generate Content Briefs</span>
                  </label>
                  <Badge variant="secondary" className="text-xs">
                    {unassignedQueries.length} gaps
                  </Badge>
                </div>
                
                {generateBriefs ? (
                  <div className="space-y-1 mt-2">
                    {unassignedQueries.slice(0, 3).map((query, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground py-1 px-2 bg-muted/30 rounded truncate">
                        • "{query}"
                      </div>
                    ))}
                    {unassignedQueries.length > 3 && (
                      <div className="text-xs text-muted-foreground pl-2">
                        +{unassignedQueries.length - 3} more queries
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mt-1">
                    <AlertTriangle className="h-3 w-3" />
                    These queries have no matching content. Enable to generate writing briefs.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ============ WHAT YOU'LL GET ============ */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            What You'll Get
          </h4>
          
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Always: Optimized content */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border">
              <Package className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Optimized Content</p>
                <p className="text-xs text-muted-foreground">
                  Full document with changes applied, ready to copy
                </p>
              </div>
            </div>
            
            {/* Always: Before/after comparisons */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border">
              <FileCheck className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Before/After Diffs</p>
                <p className="text-xs text-muted-foreground">
                  Side-by-side comparisons with change explanations
                </p>
              </div>
            </div>
            
            {/* Always: Score report */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border">
              <BarChart3 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Score Improvements</p>
                <p className="text-xs text-muted-foreground">
                  Updated Passage Scores for {chunksToOptimize.length} chunks
                </p>
              </div>
            </div>
            
            {/* Conditional: Architecture changes */}
            {applyArchitecture && selectedArchitectureTasks.length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-accent/30">
                <Wrench className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Structural Fixes</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedArchitectureTasks.length} architecture improvements applied
                  </p>
                </div>
              </div>
            )}
            
            {/* Conditional: Content briefs */}
            {generateBriefs && unassignedQueries.length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-accent/30">
                <FileText className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Content Briefs</p>
                  <p className="text-xs text-muted-foreground">
                    {unassignedQueries.length} writing briefs for content gaps
                  </p>
                </div>
              </div>
            )}
            
            {/* Always: Full report */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border">
              <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Optimization Report</p>
                <p className="text-xs text-muted-foreground">
                  Complete changelog with export options
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary footer */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Estimated time: 30-60 seconds
            </span>
            <span>
              Total actions:{' '}
              <span className="font-medium text-foreground">
                {chunksToOptimize.length} optimizations
                {applyArchitecture && selectedArchitectureTasks.length > 0 && 
                  ` + ${selectedArchitectureTasks.length} fixes`}
                {generateBriefs && unassignedQueries.length > 0 && 
                  ` + ${unassignedQueries.length} briefs`}
              </span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
