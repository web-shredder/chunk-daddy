import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Sparkles, Loader2, Wand2, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GeneratedQuery {
  query: string;
  type: 'primary' | 'synonym' | 'subtopic' | 'related' | 'alternative';
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
  maxKeywords = 15,
  content = '',
}: KeywordInputProps) {
  const [primaryQuery, setPrimaryQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQueries, setGeneratedQueries] = useState<GeneratedQuery[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerateFanout = async () => {
    if (!primaryQuery.trim()) {
      toast.error('Enter a primary query first');
      return;
    }

    setIsGenerating(true);
    setGeneratedQueries([]);

    try {
      const { data, error } = await supabase.functions.invoke('optimize-content', {
        body: {
          type: 'suggest_keywords',
          content: `You are generating semantic query fan-outs for RAG retrieval testing.

Primary query: "${primaryQuery.trim()}"

Generate 6-8 related search queries that a user might use to find the same content. These should represent different ways of searching for the same topic.

Include:
1. Direct synonyms or rephrased versions
2. More specific sub-topics within this area
3. Related concepts that would appear in the same content
4. Common alternative terminology (technical vs casual, abbreviations, etc.)
5. Question-form queries if applicable

IMPORTANT: 
- Queries can be any natural length (short phrases, questions, or descriptive searches)
- Focus on semantic diversity, not word count
- Each query should represent a distinct search intent or angle
- Think about how real users would actually search`,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to generate queries');
      }

      const suggestions = data.result.keywords || [];
      const typeMap: Record<number, GeneratedQuery['type']> = {
        0: 'synonym',
        1: 'synonym', 
        2: 'subtopic',
        3: 'subtopic',
        4: 'related',
        5: 'related',
        6: 'alternative',
        7: 'alternative',
      };

      const generated: GeneratedQuery[] = [
        { query: primaryQuery.trim(), type: 'primary', selected: true },
        ...suggestions.map((s: { keyword: string }, idx: number) => ({
          query: s.keyword,
          type: typeMap[idx] || 'related',
          selected: true,
        })),
      ];

      setGeneratedQueries(generated);
      setHasGenerated(true);
      toast.success(`Generated ${generated.length - 1} related queries`);
    } catch (err) {
      console.error('Query fanout error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate queries');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleQuery = (query: string) => {
    setGeneratedQueries(prev =>
      prev.map(q =>
        q.query === query ? { ...q, selected: !q.selected } : q
      )
    );
  };

  const handleApplyQueries = () => {
    const selected = generatedQueries
      .filter(q => q.selected)
      .map(q => q.query);
    
    if (selected.length === 0) {
      toast.error('Select at least one query');
      return;
    }

    onChange(selected.slice(0, maxKeywords));
    toast.success(`Applied ${Math.min(selected.length, maxKeywords)} queries`);
  };

  const handleReset = () => {
    setPrimaryQuery('');
    setGeneratedQueries([]);
    setHasGenerated(false);
    onChange([]);
  };

  const handleRemoveKeyword = (keyword: string) => {
    onChange(keywords.filter(k => k !== keyword));
  };

  const selectAll = () => {
    setGeneratedQueries(prev => prev.map(q => ({ ...q, selected: true })));
  };

  const selectNone = () => {
    setGeneratedQueries(prev => prev.map(q => ({ ...q, selected: false })));
  };

  const typeLabels: Record<GeneratedQuery['type'], { label: string; color: string }> = {
    primary: { label: 'Primary', color: 'bg-primary text-primary-foreground' },
    synonym: { label: 'Synonym', color: 'bg-blue-100 text-blue-700' },
    subtopic: { label: 'Subtopic', color: 'bg-green-100 text-green-700' },
    related: { label: 'Related', color: 'bg-purple-100 text-purple-700' },
    alternative: { label: 'Alt Term', color: 'bg-orange-100 text-orange-700' },
  };

  // If keywords are already set (loaded from project), show them with option to regenerate
  if (keywords.length > 0 && !hasGenerated) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <Badge
              key={keyword}
              variant="secondary"
              className="px-3 py-1.5 text-sm"
            >
              {keyword}
              <button
                type="button"
                onClick={() => handleRemoveKeyword(keyword)}
                className="ml-2 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="gap-1.5"
        >
          <RotateCcw className="h-4 w-4" />
          Start Fresh with New Query
        </Button>
        
        <p className="text-xs text-muted-foreground">
          {keywords.length} queries selected for analysis
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step 1: Enter Primary Query */}
      {!hasGenerated && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={primaryQuery}
              onChange={(e) => setPrimaryQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && primaryQuery.trim()) {
                  e.preventDefault();
                  handleGenerateFanout();
                }
              }}
              placeholder="Enter your primary search query..."
              className="flex-1"
            />
            <Button
              onClick={handleGenerateFanout}
              disabled={isGenerating || !primaryQuery.trim()}
              className="gap-1.5"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Generate Variations
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Enter the main query you want to optimize for. We'll generate semantic variations to test comprehensive retrieval.
          </p>
        </div>
      )}

      {/* Loading State */}
      {isGenerating && (
        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium">Generating query variations...</p>
            <p className="text-xs text-muted-foreground">Creating semantic fanouts for "{primaryQuery}"</p>
          </div>
        </div>
      )}

      {/* Step 2: Review & Select Generated Queries */}
      {hasGenerated && generatedQueries.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Query Variations</h4>
              <p className="text-xs text-muted-foreground">
                Select which queries to use for analysis ({generatedQueries.filter(q => q.selected).length} selected)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
                All
              </Button>
              <Button variant="ghost" size="sm" onClick={selectNone} className="h-7 text-xs">
                None
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {generatedQueries.map((gq) => (
              <label
                key={gq.query}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  gq.selected 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <Checkbox
                  checked={gq.selected}
                  onCheckedChange={() => toggleQuery(gq.query)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{gq.query}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${typeLabels[gq.type].color}`}>
                  {typeLabels[gq.type].label}
                </span>
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleApplyQueries} className="flex-1 gap-1.5">
              <Sparkles className="h-4 w-4" />
              Use Selected Queries ({generatedQueries.filter(q => q.selected).length})
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
