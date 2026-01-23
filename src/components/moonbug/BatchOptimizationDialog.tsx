/**
 * BatchOptimizationDialog Component
 * Dialog for selecting and running batch optimization on multiple queries
 */

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Zap,
  Square,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BatchOptimizationState } from '@/hooks/useBatchOptimization';
import type { QueryWorkItem } from '@/types/coverage';

interface BatchOptimizationDialogProps {
  queries: QueryWorkItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (selectedIds?: string[]) => void;
  batchState: BatchOptimizationState;
  onAbort: () => void;
}

export function BatchOptimizationDialog({
  queries,
  isOpen,
  onOpenChange,
  onStart,
  batchState,
  onAbort
}: BatchOptimizationDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const pendingQueries = queries.filter(q => q.status !== 'optimized');
  
  // Initialize with all pending selected
  useEffect(() => {
    if (isOpen && !batchState.isRunning) {
      setSelectedIds(new Set(pendingQueries.map(q => q.id)));
    }
  }, [isOpen, batchState.isRunning]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const toggleQuery = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const handleStart = () => {
    onStart(Array.from(selectedIds));
  };
  
  const progressPercent = batchState.totalCount > 0 
    ? (batchState.completedCount / batchState.totalCount) * 100 
    : 0;
  
  return (
    <Dialog open={isOpen} onOpenChange={batchState.isRunning ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {batchState.isRunning ? 'Optimization in Progress' : 'Optimize All Queries'}
          </DialogTitle>
          <DialogDescription>
            {batchState.isRunning 
              ? 'Running analysis and optimization for each query...'
              : 'Select which queries to optimize. You\'ll still need to approve each one individually.'}
          </DialogDescription>
        </DialogHeader>
        
        {batchState.isRunning ? (
          <div className="space-y-4 py-4">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Progress</span>
                <span className="text-muted-foreground">{batchState.completedCount} / {batchState.totalCount}</span>
              </div>
              <Progress value={progressPercent} />
            </div>
            
            {/* Current query */}
            {batchState.currentQuery && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Currently processing:</p>
                <p className="font-medium text-sm text-foreground truncate">"{batchState.currentQuery}"</p>
                <div className="flex items-center gap-2 mt-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground capitalize">
                    {batchState.currentStep}...
                  </span>
                </div>
              </div>
            )}
            
            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <span className="text-[hsl(var(--tier-excellent))] flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                {batchState.completedCount} completed
              </span>
              {batchState.errorCount > 0 && (
                <span className="text-[hsl(var(--tier-poor))] flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {batchState.errorCount} errors
                </span>
              )}
            </div>
            
            {/* Error list */}
            {batchState.errors.length > 0 && (
              <div className="p-3 bg-[hsl(var(--tier-poor))]/10 border border-[hsl(var(--tier-poor))]/30 rounded-lg">
                <p className="text-xs font-medium text-[hsl(var(--tier-poor))] mb-2">Errors:</p>
                <div className="space-y-1 text-xs text-muted-foreground max-h-24 overflow-y-auto">
                  {batchState.errors.map((err, i) => (
                    <p key={i} className="truncate">{err.error}</p>
                  ))}
                </div>
              </div>
            )}
            
            {/* Abort button */}
            <Button variant="outline" onClick={onAbort} className="w-full">
              <Square className="w-4 h-4 mr-2" />
              Stop Optimization
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Select all / none */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} of {pendingQueries.length} selected
              </span>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedIds(new Set(pendingQueries.map(q => q.id)))}
                >
                  Select All
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>
            
            {/* Query list */}
            <ScrollArea className="max-h-64">
              <div className="space-y-2 pr-4">
                {pendingQueries.map(query => (
                  <label 
                    key={query.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.has(query.id)}
                      onCheckedChange={() => toggleQuery(query.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">"{query.query}"</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">
                          {query.intentType}
                        </Badge>
                        {query.isGap && (
                          <Badge variant="secondary" className="text-xs">Gap</Badge>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
            
            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-[hsl(var(--tier-weak))]/10 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-[hsl(var(--tier-weak))] mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Batch optimization generates content but doesn't auto-approve. 
                Review and approve each query individually after completion.
              </p>
            </div>
          </div>
        )}
        
        {!batchState.isRunning && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleStart}
              disabled={selectedIds.size === 0}
            >
              <Zap className="w-4 h-4 mr-2" />
              Optimize {selectedIds.size} Queries
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
