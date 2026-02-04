import React, { useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronRight, 
  ListChecks,
  Heading,
  Split,
  Replace,
  PlusCircle,
  ArrowUpDown,
  Trash2,
  ArrowRightLeft,
  Eye,
  AlertCircle,
  Wrench,
  FileQuestion,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArchitectureTask, ArchitectureTaskType } from '@/lib/optimizer-types';

interface ArchitectureTasksPanelProps {
  tasks: ArchitectureTask[];
  onTaskToggle: (taskId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSelectByPriority: (priority: 'high' | 'medium' | 'low') => void;
  onNavigateToChunk?: (chunkIndex: number) => void;
}

const taskTypeIcons: Record<ArchitectureTaskType, React.ReactNode> = {
  add_heading: <Heading className="h-3.5 w-3.5" />,
  split_paragraph: <Split className="h-3.5 w-3.5" />,
  replace_pronoun: <Replace className="h-3.5 w-3.5" />,
  add_context: <PlusCircle className="h-3.5 w-3.5" />,
  reorder_sentences: <ArrowUpDown className="h-3.5 w-3.5" />,
  remove_redundancy: <Trash2 className="h-3.5 w-3.5" />,
  move_content: <ArrowRightLeft className="h-3.5 w-3.5" />,
  content_gap: <FileQuestion className="h-3.5 w-3.5" />,
};

const taskTypeLabels: Record<ArchitectureTaskType, string> = {
  add_heading: 'Add Heading',
  split_paragraph: 'Split Paragraph',
  replace_pronoun: 'Replace Pronoun',
  add_context: 'Add Context',
  reorder_sentences: 'Reorder Sentences',
  remove_redundancy: 'Remove Redundancy',
  move_content: 'Move Content',
  content_gap: 'Content Gap',
};

const priorityColors: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  medium: 'bg-warning/10 text-warning border-warning/30',
  low: 'bg-muted text-muted-foreground border-muted',
};

export function ArchitectureTasksPanel({
  tasks,
  onTaskToggle,
  onSelectAll,
  onDeselectAll,
  onSelectByPriority,
  onNavigateToChunk,
}: ArchitectureTasksPanelProps) {
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const selectedCount = useMemo(() => tasks.filter(t => t.isSelected).length, [tasks]);
  const totalCount = tasks.length;
  
  const tasksByPriority = useMemo(() => ({
    high: tasks.filter(t => t.priority === 'high').length,
    medium: tasks.filter(t => t.priority === 'medium').length,
    low: tasks.filter(t => t.priority === 'low').length,
  }), [tasks]);

  // Separate structure tasks from content gaps
  const structureTasks = useMemo(() => 
    tasks.filter(t => t.type !== 'content_gap'), 
    [tasks]
  );
  const gapTasks = useMemo(() => 
    tasks.filter(t => t.type === 'content_gap'), 
    [tasks]
  );

  const filteredStructureTasks = useMemo(() => {
    if (filter === 'all') return structureTasks;
    return structureTasks.filter(t => t.priority === filter);
  }, [structureTasks, filter]);

  const filteredGapTasks = useMemo(() => {
    if (filter === 'all') return gapTasks;
    return gapTasks.filter(t => t.priority === filter);
  }, [gapTasks, filter]);

  const toggleExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No structural tasks identified.
      </div>
    );
  }

  // Render a standard task card
  const renderStructureTaskCard = (task: ArchitectureTask) => {
    const isExpanded = expandedTasks.has(task.id);
    const hasDetails = task.details?.before || task.details?.after || task.details?.suggestedHeading;
    
    return (
      <div
        key={task.id}
        className={cn(
          "border rounded-lg transition-colors",
          task.isSelected ? "border-primary/30 bg-primary/5" : "border-border"
        )}
      >
        <div className="flex items-start gap-3 p-3">
          <Checkbox
            checked={task.isSelected}
            onCheckedChange={() => onTaskToggle(task.id)}
            className="mt-0.5"
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant="outline" 
                className={cn("text-[10px] px-1.5", priorityColors[task.priority])}
              >
                {task.priority.toUpperCase()}
              </Badge>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {taskTypeIcons[task.type]}
                <span className="text-xs font-medium">{taskTypeLabels[task.type]}</span>
              </div>
            </div>
            
            <p className="text-sm mt-2">{task.description}</p>
            
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
              {task.location.chunkIndex !== undefined && (
                <Badge 
                  variant="secondary" 
                  className="text-[10px] cursor-pointer hover:bg-accent/20"
                  onClick={() => onNavigateToChunk?.(task.location.chunkIndex!)}
                >
                  Chunk {task.location.chunkIndex + 1}
                </Badge>
              )}
              {task.location.position && (
                <span>{task.location.position}</span>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              <span className="font-medium">Impact:</span> {task.expectedImpact}
            </p>
            
            {/* Expandable Details */}
            {hasDetails && (
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(task.id)}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-xs mt-2 gap-1"
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {task.details?.suggestedHeading && (
                    <div className="p-2 bg-muted/50 rounded text-xs">
                      <span className="font-medium text-muted-foreground">Suggested heading: </span>
                      <code className="bg-background px-1 py-0.5 rounded">{task.details.suggestedHeading}</code>
                    </div>
                  )}
                  {task.details?.before && (
                    <div className="p-2 bg-destructive/5 rounded text-xs border border-destructive/20">
                      <span className="font-medium text-destructive">Before: </span>
                      <span className="text-foreground/80">{task.details.before}</span>
                    </div>
                  )}
                  {task.details?.after && (
                    <div className="p-2 bg-green-500/5 rounded text-xs border border-green-500/20">
                      <span className="font-medium text-green-600">After: </span>
                      <span className="text-foreground/80">{task.details.after}</span>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render a content gap task card with distinct styling
  const renderGapTaskCard = (task: ArchitectureTask) => {
    return (
      <div
        key={task.id}
        className={cn(
          "border rounded-lg transition-colors",
          task.isSelected 
            ? "border-orange-400/50 bg-orange-50/50 dark:bg-orange-950/20" 
            : "border-orange-200/50 dark:border-orange-800/30"
        )}
      >
        <div className="flex items-start gap-3 p-3">
          <Checkbox
            checked={task.isSelected}
            onCheckedChange={() => onTaskToggle(task.id)}
            className="mt-0.5"
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant="outline" 
                className={cn("text-[10px] px-1.5", priorityColors[task.priority])}
              >
                {task.priority.toUpperCase()}
              </Badge>
              <Badge 
                variant="outline" 
                className="text-[10px] px-1.5 bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700"
              >
                Content Gap
              </Badge>
            </div>
            
            <p className="text-sm font-medium mt-2">
              Missing content for: "{task.details?.query}"
            </p>
            
            <div className="text-xs text-muted-foreground space-y-1 mt-2">
              <p>
                <span className="font-medium">Location:</span> {task.location.position}
              </p>
              {task.details?.suggestedHeading && (
                <p>
                  <span className="font-medium">Suggested heading:</span>{' '}
                  <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                    ## {task.details.suggestedHeading}
                  </code>
                </p>
              )}
              {task.details?.bestMatchChunk !== undefined && (
                <p>
                  <span className="font-medium">Best current match:</span>{' '}
                  <Badge 
                    variant="secondary" 
                    className="text-[10px] cursor-pointer hover:bg-accent/20"
                    onClick={() => onNavigateToChunk?.(task.details!.bestMatchChunk!)}
                  >
                    Chunk {task.details.bestMatchChunk + 1}
                  </Badge>
                  {' '}(score: {Math.round(task.details?.bestMatchScore || 0)} - below threshold)
                </p>
              )}
            </div>
            
            {task.isSelected && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Will generate content brief during optimization
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {totalCount} improvements found
          </span>
          <Badge variant="secondary" className="text-xs">
            {selectedCount} selected
          </Badge>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-xs"
          onClick={onSelectAll}
        >
          Select All
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-xs"
          onClick={onDeselectAll}
        >
          Deselect All
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-xs"
          onClick={() => onSelectByPriority('high')}
        >
          High Priority Only
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
        {(['all', 'high', 'medium', 'low'] as const).map((priority) => (
          <button
            key={priority}
            onClick={() => setFilter(priority)}
            className={cn(
              "flex-1 py-1.5 px-3 text-xs rounded-md transition-colors",
              filter === priority 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {priority === 'all' ? 'All' : priority.charAt(0).toUpperCase() + priority.slice(1)}
            {priority !== 'all' && (
              <span className="ml-1 text-[10px]">({tasksByPriority[priority]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Task List - Grouped by Type */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-6 pr-4">
          {/* Structural Issues Section */}
          {filteredStructureTasks.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2 text-sm">
                <Wrench className="w-4 h-4 text-muted-foreground" />
                Structural Issues ({filteredStructureTasks.length})
              </h4>
              <div className="space-y-2">
                {filteredStructureTasks.map(task => renderStructureTaskCard(task))}
              </div>
            </div>
          )}

          {/* Content Gaps Section */}
          {filteredGapTasks.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                Content Gaps ({filteredGapTasks.length})
                <span className="text-xs font-normal text-muted-foreground">
                  — Queries with no matching content
                </span>
              </h4>
              <div className="space-y-2">
                {filteredGapTasks.map(task => renderGapTaskCard(task))}
              </div>
            </div>
          )}

          {filteredStructureTasks.length === 0 && filteredGapTasks.length === 0 && (
            <p className="text-muted-foreground text-center py-8 text-sm">
              No tasks match the current filter.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default ArchitectureTasksPanel;
