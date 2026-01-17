import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Check, X, Zap, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { FanoutNode, FanoutTree, FanoutIntentType } from '@/lib/optimizer-types';

interface FanoutTreeViewProps {
  tree: FanoutTree;
  onSelectionChange: (nodeId: string, selected: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  chunkScores?: Record<string, number>;
}

const intentColors: Record<FanoutIntentType, string> = {
  primary: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  follow_up: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  specification: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  comparison: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  process: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  decision: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  problem: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const intentLabels: Record<FanoutIntentType, string> = {
  primary: 'Primary',
  follow_up: 'Follow-up',
  specification: 'Specific',
  comparison: 'Compare',
  process: 'How-to',
  decision: 'Decision',
  problem: 'Problem',
};

const FanoutNodeComponent: React.FC<{
  node: FanoutNode;
  onSelectionChange: (nodeId: string, selected: boolean) => void;
  chunkScores?: Record<string, number>;
}> = ({ node, onSelectionChange, chunkScores }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const score = chunkScores?.[node.query];
  
  return (
    <div className={cn("relative", node.isDuplicate && "opacity-50")}>
      <div 
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors",
          node.isSelected && !node.isDuplicate && "bg-primary/5"
        )}
        style={{ marginLeft: `${node.level * 20}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 hover:bg-muted rounded shrink-0"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}
        
        <Checkbox
          checked={node.isSelected}
          disabled={node.isDuplicate}
          onCheckedChange={(checked) => onSelectionChange(node.id, !!checked)}
          className="shrink-0"
        />
        
        <Badge 
          variant="outline" 
          className={cn("shrink-0 text-[10px] px-1.5", intentColors[node.intentType])}
        >
          {intentLabels[node.intentType]}
        </Badge>
        
        <span className={cn(
          "text-sm flex-1 truncate",
          node.isDuplicate && "line-through text-muted-foreground"
        )}>
          {node.query}
        </span>
        
        {node.isDuplicate && (
          <Badge variant="outline" className="shrink-0 text-[10px] bg-muted">
            Duplicate
          </Badge>
        )}
        
        {score !== undefined && (
          <Badge 
            variant={score > 0.65 ? 'default' : score > 0.5 ? 'secondary' : 'destructive'}
            className="shrink-0 text-[10px]"
          >
            {(score * 100).toFixed(0)}%
          </Badge>
        )}
      </div>

      {expanded && hasChildren && (
        <div className="relative">
          {/* Connecting line */}
          <div 
            className="absolute left-0 top-0 bottom-0 border-l border-border"
            style={{ marginLeft: `${(node.level + 1) * 20 + 8}px` }}
          />
          {node.children.map(child => (
            <FanoutNodeComponent
              key={child.id}
              node={child}
              onSelectionChange={onSelectionChange}
              chunkScores={chunkScores}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FanoutTreeView: React.FC<FanoutTreeViewProps> = ({
  tree,
  onSelectionChange,
  onSelectAll,
  onDeselectAll,
  chunkScores,
}) => {
  return (
    <div className="border border-border rounded-lg bg-background">
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Query Fanout Tree</span>
          <Badge variant="secondary" className="text-[10px]">
            {tree.selectedNodes} / {tree.totalNodes} selected
          </Badge>
        </div>
        
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs"
            onClick={onSelectAll}
          >
            <Check className="h-3 w-3 mr-1" />
            All
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs"
            onClick={onDeselectAll}
          >
            <X className="h-3 w-3 mr-1" />
            None
          </Button>
        </div>
      </div>
      
      <ScrollArea className="h-[350px]">
        <div className="p-2">
          <FanoutNodeComponent
            node={tree.root}
            onSelectionChange={onSelectionChange}
            chunkScores={chunkScores}
          />
        </div>
      </ScrollArea>
    </div>
  );
};

export default FanoutTreeView;
