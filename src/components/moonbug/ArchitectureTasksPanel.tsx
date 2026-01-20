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
};

const taskTypeLabels: Record<ArchitectureTaskType, string> = {
  add_heading: 'Add Heading',
  split_paragraph: 'Split Paragraph',
  replace_pronoun: 'Replace Pronoun',
  add_context: 'Add Context',
  reorder_sentences: 'Reorder Sentences',
  remove_redundancy: 'Remove Redundancy',
  move_content: 'Move Content',
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

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter(t => t.priority === filter);
  }, [tasks, filter]);

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

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {totalCount} structural improvements found
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

      {/* Task List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-4">
          {filteredTasks.map(task => {
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
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export default ArchitectureTasksPanel;
