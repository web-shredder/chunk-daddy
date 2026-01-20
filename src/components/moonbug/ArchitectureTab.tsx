import { useCallback, useEffect } from 'react';
import { Layers, Loader2, Download, ArrowRight, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ArchitectureReport } from '@/components/analysis/ArchitectureReport';
import { ArchitectureTasksPanel } from './ArchitectureTasksPanel';
import { calculatePassageScore } from '@/lib/similarity';
import { downloadArchitectureCSV, downloadArchitectureTasksCSV } from '@/lib/csv-export';
import type { ArchitectureAnalysis, ArchitectureTask, ArchitectureTaskType } from '@/lib/optimizer-types';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';

interface ChunkScore {
  chunkId: string;
  text: string;
  keywordScores: Array<{
    keyword: string;
    scores: {
      cosine: number;
      euclidean: number;
      manhattan: number;
      dotProduct: number;
      chamfer: number;
    };
  }>;
}

interface ArchitectureTabProps {
  hasResults: boolean;
  chunks: LayoutAwareChunk[];
  chunkScores: ChunkScore[];
  keywords: string[];
  originalContent: string; // Raw markdown before chunking
  onGoToResults: () => void;
  onNavigateToChunk?: (chunkIndex: number) => void;
  onNavigateToOptimize?: () => void;
  // Lifted state props
  analysis: ArchitectureAnalysis | null;
  onAnalysisUpdate: (analysis: ArchitectureAnalysis | null) => void;
  isAnalyzing: boolean;
  onAnalyzingChange: (loading: boolean) => void;
  // Architecture tasks state
  architectureTasks: ArchitectureTask[];
  onTasksChange: (tasks: ArchitectureTask[]) => void;
}

// Generate tasks from architecture issues
function generateTasksFromIssues(analysis: ArchitectureAnalysis): ArchitectureTask[] {
  const tasks: ArchitectureTask[] = [];
  
  analysis.issues.forEach((issue, issueIdx) => {
    // Map issue types to task types
    const taskMappings: Record<string, { type: ArchitectureTaskType; description: string }[]> = {
      MISPLACED_CONTENT: [
        { type: 'move_content', description: `Move content to appropriate section` },
      ],
      REDUNDANCY: [
        { type: 'remove_redundancy', description: `Remove or consolidate redundant content` },
      ],
      BROKEN_ATOMICITY: [
        { type: 'replace_pronoun', description: `Replace pronouns with explicit references` },
        { type: 'add_context', description: `Add context to make chunk self-contained` },
      ],
      TOPIC_INCOHERENCE: [
        { type: 'split_paragraph', description: `Split content into focused sections` },
        { type: 'add_heading', description: `Add heading to separate topics` },
      ],
      COVERAGE_GAP: [
        { type: 'add_context', description: `Add content to address coverage gap` },
      ],
      ORPHANED_MENTION: [
        { type: 'add_context', description: `Expand orphaned mention into full section` },
      ],
    };
    
    const mappings = taskMappings[issue.type] || [];
    
    mappings.forEach((mapping, taskIdx) => {
      const task: ArchitectureTask = {
        id: `task-${issueIdx}-${taskIdx}`,
        type: mapping.type,
        issueId: issue.id,
        description: `${mapping.description}: ${issue.description}`,
        location: {
          chunkIndex: issue.chunkIndices[0],
          position: issue.chunkIndices.length > 1 
            ? `Affects chunks ${issue.chunkIndices.map(i => i + 1).join(', ')}`
            : undefined,
        },
        priority: issue.severity,
        expectedImpact: issue.impact,
        isSelected: issue.severity === 'high', // Auto-select high priority
        details: {
          suggestedHeading: mapping.type === 'add_heading' 
            ? issue.recommendation.match(/heading[:\s]*["']?([^"'\n]+)["']?/i)?.[1] 
            : undefined,
        },
      };
      tasks.push(task);
    });
  });
  
  return tasks;
}

export function ArchitectureTab({
  hasResults,
  chunks,
  chunkScores,
  keywords,
  originalContent,
  onGoToResults,
  onNavigateToChunk,
  onNavigateToOptimize,
  analysis: architectureAnalysis,
  onAnalysisUpdate: setArchitectureAnalysis,
  isAnalyzing,
  onAnalyzingChange: setIsAnalyzing,
  architectureTasks,
  onTasksChange,
}: ArchitectureTabProps) {

  // Generate tasks when analysis completes
  useEffect(() => {
    if (architectureAnalysis && architectureAnalysis.issues.length > 0 && architectureTasks.length === 0) {
      const generatedTasks = generateTasksFromIssues(architectureAnalysis);
      onTasksChange(generatedTasks);
    }
  }, [architectureAnalysis, architectureTasks.length, onTasksChange]);

  const handleAnalyzeArchitecture = async () => {
    setIsAnalyzing(true);
    try {
      // Build chunk scores in the format the API expects
      const formattedChunkScores = chunkScores.map((cs) => {
        const scores: Record<string, number> = {};
        cs.keywordScores.forEach(ks => {
          const passageScore = calculatePassageScore(ks.scores.cosine, ks.scores.chamfer);
          scores[ks.keyword] = passageScore / 100;
        });
        return { scores };
      });

      // Build chunk info including heading path for location context
      const chunkInfo = chunks.map((c, idx) => ({
        text: c.text || String(c),
        headingPath: c.headingPath || [],
        heading: c.headingPath?.[c.headingPath.length - 1] || '',
        textWithoutCascade: c.textWithoutCascade || c.text,
      }));

      const { data, error } = await supabase.functions.invoke('optimize-content', {
        body: {
          type: 'analyze_architecture',
          content: originalContent, // Pass ORIGINAL markdown, not chunk-derived content
          chunks: chunkInfo.map(c => c.textWithoutCascade), // Body-only for chunk context
          queries: keywords,
          chunkScores: formattedChunkScores,
          headings: chunkInfo.map(c => c.heading),
          // Include heading paths for location context
          chunkMetadata: chunkInfo.map((c, idx) => ({
            index: idx,
            headingPath: c.headingPath,
            preview: c.textWithoutCascade.slice(0, 200),
          })),
        },
      });
      
      if (error) throw error;
      if (data?.result) {
        setArchitectureAnalysis(data.result);
        // Generate tasks from the new analysis
        const generatedTasks = generateTasksFromIssues(data.result);
        onTasksChange(generatedTasks);
        toast.success(`Architecture analysis complete: ${data.result.issues?.length || 0} issues found`);
      }
    } catch (err) {
      console.error('Architecture analysis failed:', err);
      toast.error('Failed to analyze architecture');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTaskToggle = useCallback((taskId: string) => {
    onTasksChange(architectureTasks.map(task => 
      task.id === taskId ? { ...task, isSelected: !task.isSelected } : task
    ));
  }, [architectureTasks, onTasksChange]);

  const handleSelectAll = useCallback(() => {
    onTasksChange(architectureTasks.map(task => ({ ...task, isSelected: true })));
  }, [architectureTasks, onTasksChange]);

  const handleDeselectAll = useCallback(() => {
    onTasksChange(architectureTasks.map(task => ({ ...task, isSelected: false })));
  }, [architectureTasks, onTasksChange]);

  const handleSelectByPriority = useCallback((priority: 'high' | 'medium' | 'low') => {
    onTasksChange(architectureTasks.map(task => ({ 
      ...task, 
      isSelected: task.priority === priority 
    })));
  }, [architectureTasks, onTasksChange]);

  const selectedTaskCount = architectureTasks.filter(t => t.isSelected).length;

  if (!hasResults) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="empty-state">
          <Layers size={48} strokeWidth={1} />
          <h3>Run Analysis First</h3>
          <p>Architecture analysis requires chunk analysis results</p>
          <button className="btn-secondary" onClick={onGoToResults}>
            Go to Results
          </button>
        </div>
      </div>
    );
  }

  if (!architectureAnalysis) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="empty-state max-w-md">
          <Layers size={48} strokeWidth={1} />
          <h3>Architecture Analysis</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Identifies structural issues across your document: misplaced content, redundancy, broken atomicity, and coverage gaps.
          </p>
          <p className="text-muted-foreground text-xs mb-6">
            This analysis examines where each chunk sits in the document and whether it's in the right place for the queries it targets.
          </p>
          <button 
            onClick={handleAnalyzeArchitecture}
            disabled={isAnalyzing}
            className="btn-primary flex items-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing Structure...
              </>
            ) : (
              <>
                <Layers className="h-4 w-4" />
                Run Architecture Analysis
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Architecture Report</span>
          {architectureAnalysis.summary.totalIssues > 0 && (
            <span className="text-xs text-muted-foreground">
              {architectureAnalysis.summary.totalIssues} issues found
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => downloadArchitectureTasksCSV(architectureTasks)}
            disabled={architectureTasks.length === 0}
            className="btn-secondary text-xs flex items-center gap-1.5"
            title="Export tasks with selection status"
          >
            <Download className="h-3 w-3" />
            Export Tasks ({architectureTasks.filter(t => t.isSelected).length} selected)
          </button>
          <button 
            onClick={handleAnalyzeArchitecture}
            disabled={isAnalyzing}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            {isAnalyzing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Layers className="h-3 w-3" />
            )}
            Re-analyze
          </button>
        </div>
      </div>

      {/* Content - Two Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Architecture Report */}
        <div className="flex-1 border-r border-border overflow-hidden">
          <ScrollArea className="h-full">
            <ArchitectureReport 
              analysis={architectureAnalysis}
              onNavigateToChunk={(idx) => {
                if (onNavigateToChunk) {
                  onNavigateToChunk(idx);
                }
              }}
            />
          </ScrollArea>
        </div>

        {/* Right: Tasks Panel */}
        <div className="w-[400px] flex flex-col overflow-hidden bg-background">
          <div className="h-12 px-4 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Action Tasks</span>
            </div>
            {selectedTaskCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedTaskCount} selected
              </Badge>
            )}
          </div>
          
          <div className="flex-1 overflow-hidden p-4">
            <ArchitectureTasksPanel
              tasks={architectureTasks}
              onTaskToggle={handleTaskToggle}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onSelectByPriority={handleSelectByPriority}
              onNavigateToChunk={onNavigateToChunk}
            />
          </div>

          {/* Continue to Optimize CTA */}
          {architectureTasks.length > 0 && (
            <div className="border-t border-border p-4 bg-muted/30 shrink-0">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">
                    {selectedTaskCount} of {architectureTasks.length} tasks selected
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Selected tasks will be applied during optimization
                  </p>
                </div>
                <Button 
                  onClick={onNavigateToOptimize}
                  className="w-full gap-2"
                >
                  Continue to Optimize
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
