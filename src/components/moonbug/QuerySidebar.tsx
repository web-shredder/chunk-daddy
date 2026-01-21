import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  X,
  Play,
  Loader2,
  Trash2,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuerySidebarProps {
  queries: string[];
  onRemoveQuery: (query: string) => void;
  onClearAll: () => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  canAnalyze: boolean;
}

export function QuerySidebar({
  queries,
  onRemoveQuery,
  onClearAll,
  onAnalyze,
  isAnalyzing,
  canAnalyze,
}: QuerySidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const filteredQueries = queries.filter(q =>
    q.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Collapsed state - floating badge on mobile, compact sidebar on desktop
  if (isCollapsed) {
    return (
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 md:relative md:translate-y-0 md:top-auto">
        <button
          onClick={() => setIsCollapsed(false)}
          className={cn(
            "flex items-center gap-2 p-2 md:p-3 rounded-l-lg md:rounded-lg",
            "bg-primary text-primary-foreground shadow-lg md:shadow-none",
            "hover:bg-primary/90 transition-all",
            "md:flex-col md:w-12 md:border md:border-border/50 md:bg-muted/20 md:text-foreground md:h-full"
          )}
        >
          <ChevronLeft className="h-4 w-4 md:mb-1" />
          <div className="flex items-center gap-1.5 md:flex-col md:gap-1">
            <ListChecks className="h-4 w-4" />
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs px-1.5 font-bold",
                "md:bg-background md:text-foreground",
                queries.length > 0 && "bg-primary-foreground/20 text-primary-foreground md:bg-primary/20 md:text-primary"
              )}
            >
              {queries.length}
            </Badge>
          </div>
          <span className="text-xs font-medium md:hidden">Queries</span>
        </button>
        
        {/* Mobile floating analyze button */}
        <Button
          size="icon"
          onClick={onAnalyze}
          disabled={!canAnalyze || isAnalyzing}
          className="fixed right-0 top-[calc(50%+40px)] -translate-y-1/2 z-40 rounded-l-lg rounded-r-none h-10 w-10 shadow-lg md:hidden"
        >
          {isAnalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-64 border-l border-border/50 bg-muted/20 flex flex-col h-full",
      "fixed right-0 top-0 bottom-0 z-50 shadow-xl md:relative md:shadow-none md:z-auto"
    )}>
      {/* Header */}
      <div className="p-3 border-b border-border/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Queries</span>
          <Badge variant="secondary" className="text-xs">
            {queries.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(true)}
          className="h-7 w-7"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Search filter */}
      {queries.length > 5 && (
        <div className="p-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter queries..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>
      )}

      {/* Query list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredQueries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              {queries.length === 0 ? (
                <>
                  <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No queries added yet</p>
                  <p className="mt-1">Use AI suggestions or add manually</p>
                </>
              ) : (
                <p>No queries match "{searchFilter}"</p>
              )}
            </div>
          ) : (
            filteredQueries.map((query, i) => (
              <div
                key={`${query}-${i}`}
                className="flex items-start gap-2 p-2 rounded-md bg-background/50 border border-border/30 group hover:border-border/60 transition-colors"
              >
                <span className="text-xs text-muted-foreground font-mono w-4 shrink-0 pt-0.5">
                  {queries.indexOf(query) + 1}
                </span>
                <span className="flex-1 text-xs leading-relaxed break-words min-w-0">
                  {query}
                </span>
                <button
                  onClick={() => onRemoveQuery(query)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 hover:bg-destructive/10 rounded"
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-3 border-t border-border/50 space-y-2">
        <Button
          onClick={onAnalyze}
          disabled={!canAnalyze || isAnalyzing}
          className="w-full"
          size="sm"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Analyzing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Analysis ({queries.length})
            </>
          )}
        </Button>
        {queries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="w-full text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Clear All
          </Button>
        )}
      </div>
    </div>
  );
}
