import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  Loader2, 
  Clock, 
  AlertCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LayoutAwareChunk, DocumentElement } from '@/lib/layout-chunker';
import type { ChunkScore, AnalysisResult } from '@/hooks/useAnalysis';
import type { FanoutIntentType } from '@/lib/optimizer-types';

interface CoverageTabProps {
  hasResults: boolean;
  chunks: LayoutAwareChunk[];
  chunkScores: ChunkScore[];
  keywords: string[];
  queryIntentTypes?: Record<string, FanoutIntentType>;
  contentModified: boolean;
  onReanalyze: () => void;
  onGoToAnalyze: () => void;
  content: string;
  onApplyOptimization: (optimizedContent: string) => void;
  elements: DocumentElement[];
  result?: AnalysisResult;
  onNavigateToDownloads?: () => void;
}

// Query status types for the new UX
type QueryStatus = 'optimized' | 'in_progress' | 'ready' | 'gap';

interface QueryWithStatus {
  query: string;
  status: QueryStatus;
  intentType?: FanoutIntentType;
  assignedChunkIndex?: number;
  score?: number;
}

export function CoverageTab({
  hasResults,
  chunks,
  chunkScores,
  keywords,
  queryIntentTypes = {},
  contentModified,
  onReanalyze,
  onGoToAnalyze,
  content,
  onApplyOptimization,
  elements,
  result,
  onNavigateToDownloads
}: CoverageTabProps) {
  
  // Compute query statuses based on chunk scores
  const queriesWithStatus = useMemo((): QueryWithStatus[] => {
    if (!hasResults || keywords.length === 0) {
      return keywords.map(q => ({
        query: q,
        status: 'gap' as QueryStatus,
        intentType: queryIntentTypes[q],
      }));
    }
    
    // For now, all queries with analysis results are "ready to optimize"
    // TODO: In future prompts, this will be updated to track actual optimization status
    return keywords.map(query => {
      // Find best chunk for this query
      let bestScore = 0;
      let bestChunkIndex: number | undefined;
      
      chunkScores.forEach((cs, idx) => {
        const ks = cs.keywordScores.find(
          k => k.keyword.toLowerCase() === query.toLowerCase()
        );
        if (ks) {
          const score = ks.scores.cosine * 100;
          if (score > bestScore) {
            bestScore = score;
            bestChunkIndex = idx;
          }
        }
      });
      
      // Determine status based on score
      const hasAssignment = bestScore >= 30; // Threshold for having a matching chunk
      
      return {
        query,
        status: hasAssignment ? 'ready' as QueryStatus : 'gap' as QueryStatus,
        intentType: queryIntentTypes[query],
        assignedChunkIndex: bestChunkIndex,
        score: bestScore,
      };
    });
  }, [hasResults, keywords, chunkScores, queryIntentTypes]);
  
  // Group queries by status
  const optimizedQueries = queriesWithStatus.filter(q => q.status === 'optimized');
  const inProgressQueries = queriesWithStatus.filter(q => q.status === 'in_progress');
  const readyQueries = queriesWithStatus.filter(q => q.status === 'ready');
  const gapQueries = queriesWithStatus.filter(q => q.status === 'gap');
  
  const totalQueries = keywords.length;
  
  // Empty state
  if (!hasResults) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-medium text-foreground">No analysis results yet</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Run analysis from the Queries tab to see coverage information.
          </p>
          <Button onClick={onGoToAnalyze} variant="outline">
            Go to Queries <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="min-h-12 md:h-14 px-4 md:px-6 py-2 md:py-0 border-b border-border flex items-center justify-between gap-2 bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg md:text-xl font-semibold text-foreground">Coverage</h2>
          <Badge variant="outline" className="text-xs">
            {totalQueries} queries
          </Badge>
        </div>
        <Button disabled className="gap-2">
          <Sparkles className="h-4 w-4" />
          Optimize All
        </Button>
      </div>

      {/* Content modified warning */}
      {contentModified && (
        <div className="px-4 md:px-6 py-2 bg-warning/10 border-b border-warning/30">
          <p className="text-sm text-warning flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Content has been modified since last analysis.
            <Button variant="link" size="sm" className="p-0 h-auto text-warning" onClick={onReanalyze}>
              Re-analyze
            </Button>
          </p>
        </div>
      )}

      {/* Main content */}
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-8 max-w-4xl mx-auto">
          
          {/* OPTIMIZED Section */}
          <section>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="text-success">OPTIMIZED</span>
              <Badge variant="secondary" className="ml-2">
                {optimizedQueries.length}/{totalQueries}
              </Badge>
            </h3>
            {optimizedQueries.length > 0 ? (
              <div className="space-y-2">
                {optimizedQueries.map(q => (
                  <QueryCard key={q.query} query={q} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                No queries optimized yet
              </p>
            )}
          </section>

          {/* IN PROGRESS Section */}
          <section>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
              <span className="text-primary">IN PROGRESS</span>
              <Badge variant="secondary" className="ml-2">
                {inProgressQueries.length}/{totalQueries}
              </Badge>
            </h3>
            {inProgressQueries.length > 0 ? (
              <div className="space-y-2">
                {inProgressQueries.map(q => (
                  <QueryCard key={q.query} query={q} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                No queries in progress
              </p>
            )}
          </section>

          {/* READY TO OPTIMIZE Section */}
          <section>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              <span className="text-warning">READY TO OPTIMIZE</span>
              <Badge variant="secondary" className="ml-2">
                {readyQueries.length}/{totalQueries}
              </Badge>
            </h3>
            {readyQueries.length > 0 ? (
              <div className="space-y-2">
                {readyQueries.map(q => (
                  <QueryCard key={q.query} query={q} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                No queries ready to optimize
              </p>
            )}
          </section>

          {/* CONTENT GAPS Section */}
          <section>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-destructive">CONTENT GAPS</span>
              <Badge variant="secondary" className="ml-2">
                {gapQueries.length}/{totalQueries}
              </Badge>
            </h3>
            {gapQueries.length > 0 ? (
              <div className="space-y-2">
                {gapQueries.map(q => (
                  <QueryCard key={q.query} query={q} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                No content gaps - all queries have matching content
              </p>
            )}
          </section>

        </div>
      </ScrollArea>
    </div>
  );
}

// Query Card component for displaying individual queries
function QueryCard({ query }: { query: QueryWithStatus }) {
  const statusConfig = {
    optimized: {
      icon: CheckCircle2,
      bgClass: 'bg-success/10 border-success/30',
      iconClass: 'text-success',
    },
    in_progress: {
      icon: Loader2,
      bgClass: 'bg-primary/10 border-primary/30',
      iconClass: 'text-primary animate-spin',
    },
    ready: {
      icon: Clock,
      bgClass: 'bg-warning/10 border-warning/30',
      iconClass: 'text-warning',
    },
    gap: {
      icon: AlertCircle,
      bgClass: 'bg-destructive/10 border-destructive/30',
      iconClass: 'text-destructive',
    },
  };
  
  const config = statusConfig[query.status];
  const Icon = config.icon;
  
  return (
    <Card className={cn('border transition-colors hover:bg-muted/30', config.bgClass)}>
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Icon className={cn('h-4 w-4 shrink-0', config.iconClass)} />
          <span className="text-sm font-medium truncate">{query.query}</span>
          {query.intentType && (
            <Badge variant="outline" className="text-xs shrink-0">
              {query.intentType}
            </Badge>
          )}
        </div>
        {query.score !== undefined && query.status === 'ready' && (
          <Badge variant="secondary" className="text-xs tabular-nums">
            {Math.round(query.score)}%
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

export default CoverageTab;
