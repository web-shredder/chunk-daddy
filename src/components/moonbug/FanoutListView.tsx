import { useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Trash2, 
  Search,
  ListTree,
  Star,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExportFanoutDialog } from './ExportFanoutDialog';
import { getTierColors } from '@/lib/tier-colors';
import type { FanoutExportQuery } from '@/lib/export-fanout';

interface FanoutQuery {
  id: string;
  query: string;
  intentType?: string;
  aspectAnswered?: string;
  level: number;
  parentId: string | null;
  isSelected: boolean;
  score?: number;
  assignedChunkIndex?: number | null;
}

interface FanoutListViewProps {
  queries: FanoutQuery[];
  primaryQuery: string;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  onDeleteQuery: (id: string) => void;
  showTreeView?: () => void;
  chunks?: Array<{ id: string; heading?: string }>;
  hasAnalysisResults?: boolean;
}

export function FanoutListView({
  queries,
  primaryQuery,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onDeleteSelected,
  onDeleteQuery,
  showTreeView,
  chunks,
  hasAnalysisResults = false,
}: FanoutListViewProps) {
  const [filter, setFilter] = useState<'all' | 'selected' | 'unselected'>('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Get unique levels
  const levels = useMemo(() => {
    const lvls = new Set(queries.map(q => q.level));
    return Array.from(lvls).sort((a, b) => a - b);
  }, [queries]);
  
  // Filter queries
  const filteredQueries = useMemo(() => {
    let result = [...queries];
    
    if (filter === 'selected') {
      result = result.filter(q => q.isSelected);
    } else if (filter === 'unselected') {
      result = result.filter(q => !q.isSelected);
    }
    
    if (levelFilter !== 'all') {
      result = result.filter(q => q.level === parseInt(levelFilter, 10));
    }
    
    if (searchQuery.trim()) {
      const search = searchQuery.toLowerCase();
      result = result.filter(q => q.query.toLowerCase().includes(search));
    }
    
    // Sort by level, then alphabetically
    result.sort((a, b) => a.level - b.level || a.query.localeCompare(b.query));
    
    return result;
  }, [queries, filter, levelFilter, searchQuery]);
  
  const selectedCount = queries.filter(q => q.isSelected).length;
  const totalCount = queries.length;
  
  const getScoreColor = (score: number | undefined) => {
    if (score === undefined) return '';
    return getTierColors(score).badge;
  };
  
  return (
    <div className="flex flex-col gap-3 w-full overflow-hidden">
      {/* Primary query header */}
      <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
        <Star className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-medium text-muted-foreground shrink-0">Primary:</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm font-medium truncate block max-w-full">{primaryQuery}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[400px]">
              <p className="text-sm">{primaryQuery}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter queries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        
        <Select value={filter} onValueChange={(v: 'all' | 'selected' | 'unselected') => setFilter(v)}>
          <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({totalCount})</SelectItem>
            <SelectItem value="selected">Selected ({selectedCount})</SelectItem>
            <SelectItem value="unselected">Unselected ({totalCount - selectedCount})</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="h-8 w-auto min-w-[80px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {levels.map(level => (
              <SelectItem key={level} value={String(level)}>L{level}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <ExportFanoutDialog
          queries={queries.map(q => ({
            ...q,
            parentQuery: queries.find(p => p.id === q.parentId)?.query,
            assignedChunkHeading: chunks?.[q.assignedChunkIndex ?? -1]?.heading,
          } as FanoutExportQuery))}
          primaryQuery={primaryQuery}
        />
        
        {showTreeView && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={showTreeView}>
            <ListTree className="h-3.5 w-3.5" />
            Tree
          </Button>
        )}
      </div>
      
      {/* Bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={selectedCount === totalCount ? onDeselectAll : onSelectAll}
          >
            {selectedCount === totalCount ? 'Deselect All' : 'Select All'}
          </Button>
          <span className="text-xs text-muted-foreground">
            {selectedCount}/{totalCount} selected
          </span>
        </div>
        
        {selectedCount > 0 && selectedCount < totalCount && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDeleteSelected}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete Selected
          </Button>
        )}
      </div>
      
      {/* Query list - FIXED OVERFLOW */}
      <div className="overflow-x-hidden overflow-y-auto max-h-[350px] border border-border rounded-lg">
        {filteredQueries.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No queries match filters
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredQueries.map((query) => (
              <div
                key={query.id}
                className={cn(
                  "flex items-center gap-2 p-2 hover:bg-muted/30 transition-colors group",
                  query.isSelected && "bg-primary/5"
                )}
              >
                <Checkbox
                  checked={query.isSelected}
                  onCheckedChange={() => onToggleSelect(query.id)}
                  disabled={query.level === 0}
                  className="shrink-0"
                />
                
                <div className="flex-1 min-w-0 overflow-hidden">
                  {/* Query text - TRUNCATE with tooltip */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-sm truncate max-w-full cursor-default">
                          {query.query}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[400px]">
                        <p className="text-sm">{query.query}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      L{query.level}
                    </Badge>
                    
                    {query.aspectAnswered && (
                      <Badge variant="secondary" className="text-[10px] shrink-0 max-w-[150px] truncate">
                        {query.aspectAnswered}
                      </Badge>
                    )}
                    
                    {hasAnalysisResults && query.score !== undefined && (
                      <Badge className={cn("text-[10px] shrink-0", getScoreColor(query.score))}>
                        {query.score}
                      </Badge>
                    )}
                    
                    {hasAnalysisResults && query.assignedChunkIndex !== null && query.assignedChunkIndex !== undefined && (
                      <Badge variant="outline" className="text-[10px] shrink-0 flex items-center gap-0.5">
                        <ArrowRight className="h-2.5 w-2.5" />
                        Chunk {query.assignedChunkIndex + 1}
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Delete button - only on hover, not for primary */}
                {query.level !== 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeleteQuery(query.id)}
                    className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FanoutListView;
