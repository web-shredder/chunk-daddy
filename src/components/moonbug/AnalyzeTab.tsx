import { useState } from 'react';
import { Plus, X, Play, Loader2, Microscope, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ChunkerOptions } from '@/lib/layout-chunker';

interface AnalyzeTabProps {
  hasChunks: boolean;
  keywords: string[];
  onKeywordsChange: (keywords: string[]) => void;
  chunkerOptions: ChunkerOptions;
  onOptionsChange: (options: ChunkerOptions) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  progress: number;
  onGoToContent: () => void;
}

export function AnalyzeTab({
  hasChunks,
  keywords,
  onKeywordsChange,
  chunkerOptions,
  onOptionsChange,
  onAnalyze,
  isAnalyzing,
  progress,
  onGoToContent,
}: AnalyzeTabProps) {
  const [newQuery, setNewQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const addQuery = () => {
    if (newQuery.trim() && !keywords.includes(newQuery.trim())) {
      onKeywordsChange([...keywords, newQuery.trim()]);
      setNewQuery('');
    }
  };

  const removeQuery = (index: number) => {
    onKeywordsChange(keywords.filter((_, i) => i !== index));
  };

  const handleGenerateFanout = async () => {
    if (!newQuery.trim()) {
      toast.error('Enter a query first');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('optimize-content', {
        body: {
          type: 'suggest_keywords',
          content: `Generate 4-6 semantic query variations for RAG testing based on: "${newQuery.trim()}"`,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message);
      }

      const suggestions = data.result?.keywords?.map((k: { keyword: string }) => k.keyword) || [];
      const newQueries = [newQuery.trim(), ...suggestions].filter(
        (q, i, arr) => arr.indexOf(q) === i && !keywords.includes(q)
      );
      
      onKeywordsChange([...keywords, ...newQueries]);
      setNewQuery('');
      toast.success(`Added ${newQueries.length} queries`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate variations');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!hasChunks) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="empty-state">
          <Microscope size={48} strokeWidth={1} />
          <h3>Chunk your content first</h3>
          <p>Go to the Content tab and click "Chunk It, Daddy"</p>
          <button className="btn-secondary" onClick={onGoToContent}>
            Go to Content
          </button>
        </div>
      </div>
    );
  }

  const canAnalyze = keywords.some(k => k.trim()) && !isAnalyzing;

  return (
    <div className="flex-1 overflow-auto p-6 bg-background">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
        {/* Left: Queries */}
        <div className="panel">
          <div className="panel-header">
            <h3>Queries</h3>
          </div>

          {/* Add Query Input */}
          <div className="flex gap-2">
            <Input
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addQuery();
                }
              }}
              placeholder="Enter search query..."
              className="flex-1 moonbug-input"
            />
            <button
              onClick={addQuery}
              disabled={!newQuery.trim()}
              className="btn-secondary"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={handleGenerateFanout}
              disabled={!newQuery.trim() || isGenerating}
              className="btn-secondary"
              title="Generate variations"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Query List */}
          <div className="flex-1 space-y-2 max-h-[300px] overflow-y-auto">
            {keywords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Add queries to test retrieval relevance
              </p>
            ) : (
              keywords.map((query, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 bg-background border border-border rounded-md"
                >
                  <span className="flex-1 text-sm truncate">{query}</span>
                  <button
                    onClick={() => removeQuery(i)}
                    className="icon-button h-6 w-6"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Analyze Button */}
          <button
            onClick={onAnalyze}
            disabled={!canAnalyze}
            className="btn-primary w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Analysis
              </>
            )}
          </button>

          {isAnalyzing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-1" />
              <p className="text-xs text-muted-foreground text-center">
                Generating embeddings and calculating similarity...
              </p>
            </div>
          )}
        </div>

        {/* Right: Settings */}
        <div className="panel">
          <div className="panel-header">
            <h3>Chunking Settings</h3>
          </div>

          <div className="space-y-6">
            {/* Max Chunk Size */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Max chunk size</Label>
                <span className="text-xs text-muted-foreground font-mono">
                  {chunkerOptions.maxChunkSize} tokens
                </span>
              </div>
              <Slider
                value={[chunkerOptions.maxChunkSize]}
                onValueChange={([value]) =>
                  onOptionsChange({ ...chunkerOptions, maxChunkSize: value })
                }
                min={128}
                max={1024}
                step={64}
                className="w-full"
              />
            </div>

            {/* Chunk Overlap */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Chunk overlap</Label>
                <span className="text-xs text-muted-foreground font-mono">
                  {chunkerOptions.chunkOverlap} tokens
                </span>
              </div>
              <Slider
                value={[chunkerOptions.chunkOverlap]}
                onValueChange={([value]) =>
                  onOptionsChange({ ...chunkerOptions, chunkOverlap: value })
                }
                min={0}
                max={128}
                step={8}
                className="w-full"
              />
            </div>

            {/* Heading Cascade */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Heading cascade</Label>
                  <p className="text-xs text-muted-foreground">
                    Prepend parent headings to each chunk
                  </p>
                </div>
                <Switch
                  checked={chunkerOptions.cascadeHeadings}
                  onCheckedChange={(checked) =>
                    onOptionsChange({ ...chunkerOptions, cascadeHeadings: checked })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
