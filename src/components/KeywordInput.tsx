import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Plus, Sparkles, Loader2, Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface KeywordSuggestion {
  keyword: string;
  reason: string;
  intent: string;
}

interface ExpandedQuery {
  keyword: string;
  isOriginal: boolean;
  selected: boolean;
}

interface KeywordInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  maxKeywords?: number;
  content?: string;
}

export function KeywordInput({
  keywords,
  onChange,
  maxKeywords = 10,
  content = '',
}: KeywordInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [isExpanding, setIsExpanding] = useState(false);
  const [expandedQueries, setExpandedQueries] = useState<ExpandedQuery[]>([]);
  const [expandOpen, setExpandOpen] = useState(true);

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !keywords.includes(trimmed) && keywords.length < maxKeywords) {
      onChange([...keywords, trimmed]);
      setInputValue('');
    }
  };

  const handleRemove = (keyword: string) => {
    onChange(keywords.filter(k => k !== keyword));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleSuggestKeywords = async () => {
    if (!content.trim()) {
      toast.error('Enter some content first to get keyword suggestions');
      return;
    }

    setIsSuggesting(true);
    setSuggestions([]);

    try {
      const { data, error } = await supabase.functions.invoke('optimize-content', {
        body: { type: 'suggest_keywords', content },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to suggest keywords');
      }

      // Filter to only keywords with 2-5 words
      const allKeywords: KeywordSuggestion[] = data.result.keywords;
      const validKeywords = allKeywords.filter(k => {
        const wordCount = k.keyword.trim().split(/\s+/).length;
        return wordCount >= 2 && wordCount <= 5;
      });
      
      setSuggestions(validKeywords);
      toast.success(`Found ${validKeywords.length} keyword suggestions`);
    } catch (err) {
      console.error('Keyword suggestion error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to suggest keywords');
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAddSuggestion = (keyword: string) => {
    if (!keywords.includes(keyword) && keywords.length < maxKeywords) {
      onChange([...keywords, keyword]);
      setSuggestions(suggestions.filter(s => s.keyword !== keyword));
    }
  };

  const handleAddAllSuggestions = () => {
    const available = maxKeywords - keywords.length;
    const toAdd = suggestions
      .slice(0, available)
      .map(s => s.keyword)
      .filter(k => !keywords.includes(k));
    onChange([...keywords, ...toAdd]);
    setSuggestions([]);
  };

  // Query fan-out: expand a keyword into related queries
  const handleExpandQuery = async (primaryQuery: string) => {
    if (!primaryQuery.trim()) {
      toast.error('Select a keyword to expand');
      return;
    }

    setIsExpanding(true);
    setExpandedQueries([]);

    try {
      const { data, error } = await supabase.functions.invoke('optimize-content', {
        body: {
          type: 'suggest_keywords',
          content: `Generate semantically related search queries for: "${primaryQuery}"
          
Context: This is for testing RAG retrieval. Generate 4 related queries:
1. Direct synonym or alternative phrasing
2. More specific sub-topic
3. Related concept
4. Common alternative term

Keep queries concise (2-4 words each).`,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to expand query');
      }

      const suggestions = data.result.keywords || [];
      const expanded: ExpandedQuery[] = [
        { keyword: primaryQuery, isOriginal: true, selected: true },
        ...suggestions.slice(0, 4).map((s: { keyword: string }) => ({
          keyword: s.keyword,
          isOriginal: false,
          selected: true,
        })),
      ];

      setExpandedQueries(expanded);
      toast.success(`Generated ${expanded.length - 1} related queries`);
    } catch (err) {
      console.error('Query expansion error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to expand query');
    } finally {
      setIsExpanding(false);
    }
  };

  const toggleExpandedQuery = (keyword: string) => {
    setExpandedQueries(prev =>
      prev.map(q =>
        q.keyword === keyword ? { ...q, selected: !q.selected } : q
      )
    );
  };

  const handleApplyExpanded = () => {
    const selectedQueries = expandedQueries
      .filter(q => q.selected)
      .map(q => q.keyword)
      .filter(k => !keywords.includes(k));
    
    const available = maxKeywords - keywords.length;
    const toAdd = selectedQueries.slice(0, available);
    
    if (toAdd.length > 0) {
      onChange([...keywords, ...toAdd]);
      toast.success(`Added ${toAdd.length} queries`);
    }
    setExpandedQueries([]);
  };

  const handleClearExpanded = () => {
    setExpandedQueries([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter target keyword..."
          className="flex-1"
          disabled={keywords.length >= maxKeywords}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleAdd}
          disabled={!inputValue.trim() || keywords.length >= maxKeywords}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleSuggestKeywords}
          disabled={isSuggesting || !content.trim()}
          className="gap-1.5"
        >
          {isSuggesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Suggest
        </Button>
      </div>
      
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <Badge
              key={keyword}
              variant="secondary"
              className="px-3 py-1 text-sm group"
            >
              {keyword}
              <button
                type="button"
                onClick={() => handleExpandQuery(keyword)}
                disabled={isExpanding}
                className="ml-1.5 opacity-50 hover:opacity-100 transition-opacity"
                title="Expand to related queries"
              >
                <Wand2 className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(keyword)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Expanded queries panel */}
      {expandedQueries.length > 0 && (
        <Collapsible open={expandOpen} onOpenChange={setExpandOpen}>
          <div className="border rounded-lg p-3 bg-primary/5 space-y-3">
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  Related Queries ({expandedQueries.filter(q => q.selected).length} selected)
                </span>
                {expandOpen ? (
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
                      onCheckedChange={() => toggleExpandedQuery(query.keyword)}
                    />
                    <span className="text-sm">{query.keyword}</span>
                    {query.isOriginal && (
                      <Badge variant="outline" className="text-xs">
                        primary
                      </Badge>
                    )}
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleApplyExpanded} className="flex-1">
                  Add Selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearExpanded}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {isExpanding && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating related queries...
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              AI Suggestions
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAddAllSuggestions}
              className="h-6 text-xs"
            >
              Add all
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.keyword}
                type="button"
                onClick={() => handleAddSuggestion(suggestion.keyword)}
                disabled={keywords.includes(suggestion.keyword) || keywords.length >= maxKeywords}
                className="group relative"
              >
                <Badge
                  variant="outline"
                  className="px-3 py-1 text-sm cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                >
                  <Plus className="h-3 w-3 mr-1 opacity-50 group-hover:opacity-100" />
                  {suggestion.keyword}
                </Badge>
                <span className="absolute -bottom-5 left-0 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {suggestion.intent}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        {keywords.length}/{maxKeywords} keywords • Press Enter to add • Click <Wand2 className="h-3 w-3 inline" /> to expand
      </p>
    </div>
  );
}
