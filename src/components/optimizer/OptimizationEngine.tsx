import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Copy, Download, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useOptimizer, type OptimizationStep } from '@/hooks/useOptimizer';
import { RecommendationCard } from './RecommendationCard';
import { DiffView } from './DiffView';
import { toast } from 'sonner';
import type { KeywordScore } from '@/hooks/useAnalysis';

interface OptimizationEngineProps {
  content: string;
  keywords: string[];
  currentScores?: KeywordScore[];
  onApplyOptimization: (optimizedContent: string) => void;
}

const stepLabels: Record<OptimizationStep, string> = {
  idle: 'Ready to optimize',
  analyzing: 'Analyzing content for optimization opportunities...',
  optimizing: 'Generating optimized rewrites...',
  scoring: 'Calculating similarity improvements...',
  explaining: 'Generating explanations...',
  complete: 'Optimization complete!',
  error: 'Optimization failed',
};

export function OptimizationEngine({
  content,
  keywords,
  currentScores,
  onApplyOptimization,
}: OptimizationEngineProps) {
  const { step, progress, error, result, optimize, reset } = useOptimizer();
  const [acceptedChanges, setAcceptedChanges] = useState<Set<string>>(new Set());
  const [showDiff, setShowDiff] = useState(true);
  const [showRecommendations, setShowRecommendations] = useState(true);

  const handleOptimize = async () => {
    try {
      // Convert current scores to a simple map
      const scoresMap = currentScores?.reduce((acc, ks) => {
        acc[ks.keyword] = ks.scores.cosine;
        return acc;
      }, {} as Record<string, number>);

      await optimize(content, keywords, scoresMap);
      setAcceptedChanges(new Set());
    } catch (err) {
      // Error is already handled in the hook
    }
  };

  const handleAcceptChange = (changeId: string) => {
    setAcceptedChanges(prev => new Set([...prev, changeId]));
  };

  const handleRejectChange = (changeId: string) => {
    setAcceptedChanges(prev => {
      const next = new Set(prev);
      next.delete(changeId);
      return next;
    });
  };

  const handleAcceptAll = () => {
    if (!result) return;
    const allIds = result.optimizedChunks.flatMap(chunk =>
      chunk.changes_applied.map(c => c.change_id)
    );
    setAcceptedChanges(new Set(allIds));
  };

  const handleRejectAll = () => {
    setAcceptedChanges(new Set());
  };

  const getOptimizedContent = (onlyAccepted: boolean = false) => {
    if (!result) return '';
    
    if (onlyAccepted) {
      // Compile content with only accepted changes
      return result.optimizedChunks
        .map(chunk => {
          const hasAcceptedChanges = chunk.changes_applied.some(c => acceptedChanges.has(c.change_id));
          if (!hasAcceptedChanges) {
            return chunk.original_text;
          }
          return (chunk.heading ? `## ${chunk.heading}\n\n` : '') + chunk.optimized_text;
        })
        .join('\n\n');
    }
    
    // Full optimized content
    return result.optimizedChunks
      .map(chunk => (chunk.heading ? `## ${chunk.heading}\n\n` : '') + chunk.optimized_text)
      .join('\n\n');
  };

  const handleApplyChanges = () => {
    const compiledContent = getOptimizedContent(true);
    onApplyOptimization(compiledContent);
    toast.success(`Applied ${acceptedChanges.size} optimizations to content`);
  };

  const handleCopyOptimized = () => {
    const text = getOptimizedContent(false);
    navigator.clipboard.writeText(text);
    toast.success('Copied optimized content to clipboard');
  };

  const handleExportMarkdown = () => {
    const text = getOptimizedContent(acceptedChanges.size > 0);
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optimized-content-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded optimized content as markdown');
  };

  const isProcessing = ['analyzing', 'optimizing', 'scoring', 'explaining'].includes(step);
  const totalChanges = result?.optimizedChunks.flatMap(c => c.changes_applied).length || 0;

  return (
    <div className="space-y-4">
      {/* Optimize Button / Status */}
      {step === 'idle' && (
        <Button
          onClick={handleOptimize}
          disabled={!content.trim() || keywords.length === 0}
          className="w-full h-12 text-base"
          variant="default"
        >
          <Sparkles className="h-5 w-5 mr-2" />
          Optimize for Retrieval
        </Button>
      )}

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{stepLabels[step]}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {result && step === 'complete' && (
        <div className="space-y-4">
          {/* Success Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">
                Found {totalChanges} optimization{totalChanges !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyOptimized}>
                <Copy className="h-4 w-4 mr-1.5" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportMarkdown}>
                <FileDown className="h-4 w-4 mr-1.5" />
                Export .md
              </Button>
              <Button variant="outline" size="sm" onClick={reset}>
                Reset
              </Button>
            </div>
          </div>

          {/* Diff View */}
          <Collapsible open={showDiff} onOpenChange={setShowDiff}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-2" size="sm">
                <span className="text-sm font-medium">Side-by-Side Comparison</span>
                {showDiff ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <DiffView
                originalContent={result.originalContent}
                optimizedChunks={result.optimizedChunks}
                acceptedChanges={acceptedChanges}
              />
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Recommendations */}
          <Collapsible open={showRecommendations} onOpenChange={setShowRecommendations}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-2" size="sm">
                <span className="text-sm font-medium">
                  Recommendations ({acceptedChanges.size}/{totalChanges} accepted)
                </span>
                {showRecommendations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              {/* Bulk Actions */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleAcceptAll}>
                  Accept All
                </Button>
                <Button variant="outline" size="sm" onClick={handleRejectAll}>
                  Reject All
                </Button>
              </div>

              {/* Recommendation Cards */}
              <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-1">
                {result.optimizedChunks.flatMap(chunk =>
                  chunk.changes_applied.map(change => {
                    const explanation = result.explanations.find(e => e.change_id === change.change_id);
                    return (
                      <RecommendationCard
                        key={change.change_id}
                        change={change}
                        explanation={explanation}
                        accepted={acceptedChanges.has(change.change_id)}
                        onAccept={() => handleAcceptChange(change.change_id)}
                        onReject={() => handleRejectChange(change.change_id)}
                      />
                    );
                  })
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Apply Button */}
          {acceptedChanges.size > 0 && (
            <Button onClick={handleApplyChanges} className="w-full" size="lg">
              <Download className="h-4 w-4 mr-2" />
              Apply {acceptedChanges.size} Change{acceptedChanges.size !== 1 ? 's' : ''} to Optimized Content
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
