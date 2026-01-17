import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Sparkles, X, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ExpandedQuery {
  keyword: string;
  isOriginal: boolean;
  selected: boolean;
}

interface QueryFanOutProps {
  primaryQuery: string;
  onQueriesGenerated: (queries: string[]) => void;
}

export function QueryFanOut({ primaryQuery, onQueriesGenerated }: QueryFanOutProps) {
  const [isExpanding, setIsExpanding] = useState(false);
  const [expandedQueries, setExpandedQueries] = useState<ExpandedQuery[]>([]);
  const [isOpen, setIsOpen] = useState(true);

  const handleExpand = async () => {
    if (!primaryQuery.trim()) {
      toast.error('Enter a primary query first');
      return;
    }

    setIsExpanding(true);
    setExpandedQueries([]);

    try {
      const { data, error } = await supabase.functions.invoke('optimize-content', {
        body: {
          type: 'generate_fanout',
          primaryQuery: primaryQuery.trim(),
          contentContext: '',
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to expand query');
      }

      const suggestions = data.suggestions || [];
      const expanded: ExpandedQuery[] = [
        { keyword: primaryQuery, isOriginal: true, selected: true },
        ...suggestions
          .filter((s: any) => s.query && s.query.toLowerCase() !== primaryQuery.trim().toLowerCase())
          .slice(0, 6)
          .map((s: any) => ({
            keyword: typeof s === 'string' ? s : s.query,
            isOriginal: false,
            selected: true,
          })),
      ];

      setExpandedQueries(expanded);
      toast.success(`Generated ${expanded.length - 1} intent-based queries`);
    } catch (err) {
      console.error('Query expansion error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to expand query');
    } finally {
      setIsExpanding(false);
    }
  };

  const toggleQuery = (keyword: string) => {
    setExpandedQueries(prev =>
      prev.map(q =>
        q.keyword === keyword ? { ...q, selected: !q.selected } : q
      )
    );
  };

  const handleApply = () => {
    const selectedQueries = expandedQueries
      .filter(q => q.selected)
      .map(q => q.keyword);
    onQueriesGenerated(selectedQueries);
    setExpandedQueries([]);
  };

  const handleClear = () => {
    setExpandedQueries([]);
  };

  if (expandedQueries.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleExpand}
        disabled={isExpanding || !primaryQuery.trim()}
        className="gap-1.5"
      >
        {isExpanding ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Expand to Related Queries
      </Button>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full text-sm font-medium">
            <span>Related Queries ({expandedQueries.filter(q => q.selected).length} selected)</span>
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3">
          <div className="space-y-2">
            {expandedQueries.map((query) => (
              <label
                key={query.keyword}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Checkbox
                  checked={query.selected}
                  onCheckedChange={() => toggleQuery(query.keyword)}
                />
                <span className="text-sm">{query.keyword}</span>
                {query.isOriginal && (
                  <Badge variant="secondary" className="text-xs">
                    primary
                  </Badge>
                )}
              </label>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleApply} className="flex-1">
              Apply Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
