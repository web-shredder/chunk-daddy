import { useState, useMemo } from 'react';
import {
  Search,
  LayoutGrid,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  PlusCircle,
  MapPin,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { CoverageState, QueryWorkItem } from '@/types/coverage';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';

// ============ Types ============

interface ProgressTabProps {
  coverageState: CoverageState;
  chunks: LayoutAwareChunk[];
  primaryQuery: string;
}

type ProgressView = 'queries' | 'chunks';

interface ProgressStats {
  totalQueries: number;
  optimizedCount: number;
  gapsTotal: number;
  gapsFilled: number;
  avgOriginalScore: number;
  avgCurrentScore: number;
  improvement: number;
  improvementPercent: number;
}

// ============ Main Component ============

export function ProgressTab({ coverageState, chunks, primaryQuery }: ProgressTabProps) {
  const [view, setView] = useState<ProgressView>('queries');
  
  // Calculate summary stats
  const stats = useMemo<ProgressStats>(() => {
    const queries = coverageState.queries;
    const optimized = queries.filter(q => q.status === 'optimized');
    const gaps = queries.filter(q => q.isGap);
    const gapsFilled = queries.filter(q => q.isGap && q.isApproved);
    
    const originalScores = queries
      .filter(q => q.originalScores)
      .map(q => q.originalScores!.passageScore);
    const currentScores = optimized
      .filter(q => q.currentScores)
      .map(q => q.currentScores!.passageScore);
    
    const avgOriginal = originalScores.length > 0
      ? Math.round(originalScores.reduce((a, b) => a + b, 0) / originalScores.length)
      : 0;
    const avgCurrent = currentScores.length > 0
      ? Math.round(currentScores.reduce((a, b) => a + b, 0) / currentScores.length)
      : avgOriginal;
    
    return {
      totalQueries: queries.length,
      optimizedCount: optimized.length,
      gapsTotal: gaps.length,
      gapsFilled: gapsFilled.length,
      avgOriginalScore: avgOriginal,
      avgCurrentScore: avgCurrent,
      improvement: avgCurrent - avgOriginal,
      improvementPercent: avgOriginal > 0 
        ? Math.round(((avgCurrent - avgOriginal) / avgOriginal) * 100) 
        : 0
    };
  }, [coverageState.queries]);
  
  // Empty state
  if (coverageState.queries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Search className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-medium text-foreground">No queries to track</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Start by analyzing your content in the Queries tab to generate work items.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="min-h-12 md:h-14 px-4 md:px-6 py-2 md:py-0 border-b border-border flex items-center justify-between gap-2 bg-surface shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Progress</h2>
          <p className="text-xs text-muted-foreground">
            Track your optimization journey
          </p>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant={view === 'queries' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('queries')}
            className="h-8"
          >
            <Search className="w-4 h-4 mr-2" />
            Queries
          </Button>
          <Button
            variant={view === 'chunks' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('chunks')}
            className="h-8"
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Chunks
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 max-w-5xl space-y-6">
          {/* Summary Stats */}
          <SummaryStats stats={stats} />
          
          {/* Score Distribution */}
          <ScoreDistribution 
            queries={coverageState.queries}
            showBefore={true}
            showAfter={stats.optimizedCount > 0}
          />
          
          {/* View Content */}
          {view === 'queries' ? (
            <QueryProgressView queries={coverageState.queries} />
          ) : (
            <ChunkProgressView 
              queries={coverageState.queries} 
              chunks={chunks}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============ SummaryStats Component ============

interface SummaryStatsProps {
  stats: ProgressStats;
}

function SummaryStats({ stats }: SummaryStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
      <div className="text-center">
        <div className="text-3xl font-bold text-foreground">{stats.totalQueries}</div>
        <div className="text-sm text-muted-foreground">Total Queries</div>
        <div className="text-xs text-muted-foreground mt-1">
          {stats.optimizedCount} optimized
        </div>
      </div>
      
      <div className="text-center">
        <div className="text-3xl font-bold">
          {stats.gapsTotal - stats.gapsFilled > 0 ? (
            <span className="text-[hsl(var(--tier-weak))]">{stats.gapsTotal - stats.gapsFilled}</span>
          ) : (
            <span className="text-[hsl(var(--tier-excellent))]">0</span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">Gaps Remaining</div>
        <div className="text-xs text-muted-foreground mt-1">
          {stats.gapsFilled} filled
        </div>
      </div>
      
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-xl text-muted-foreground">{stats.avgOriginalScore}</span>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-3xl font-bold text-[hsl(var(--tier-excellent))]">{stats.avgCurrentScore}</span>
        </div>
        <div className="text-sm text-muted-foreground">Avg Score</div>
      </div>
      
      <div className="text-center">
        <div className={cn(
          "text-3xl font-bold",
          stats.improvement >= 0 ? 'text-[hsl(var(--tier-excellent))]' : 'text-[hsl(var(--tier-poor))]'
        )}>
          {stats.improvement >= 0 ? '+' : ''}{stats.improvement}
        </div>
        <div className="text-sm text-muted-foreground">Improvement</div>
        <div className="text-xs text-muted-foreground mt-1">
          {stats.improvementPercent >= 0 ? '+' : ''}{stats.improvementPercent}%
        </div>
      </div>
    </div>
  );
}

// ============ ScoreDistribution Component ============

interface ScoreDistributionProps {
  queries: QueryWorkItem[];
  showBefore: boolean;
  showAfter: boolean;
}

function ScoreDistribution({ queries, showBefore, showAfter }: ScoreDistributionProps) {
  // Group scores into buckets
  const getBuckets = (scores: number[]) => {
    const buckets = {
      poor: 0,      // 0-39
      weak: 0,      // 40-54
      moderate: 0,  // 55-69
      good: 0,      // 70-84
      excellent: 0  // 85-100
    };
    
    scores.forEach(score => {
      if (score < 40) buckets.poor++;
      else if (score < 55) buckets.weak++;
      else if (score < 70) buckets.moderate++;
      else if (score < 85) buckets.good++;
      else buckets.excellent++;
    });
    
    return buckets;
  };
  
  const beforeScores = queries
    .filter(q => q.originalScores)
    .map(q => q.originalScores!.passageScore);
  const afterScores = queries
    .filter(q => q.currentScores)
    .map(q => q.currentScores!.passageScore);
  
  const beforeBuckets = getBuckets(beforeScores);
  const afterBuckets = afterScores.length > 0 ? getBuckets(afterScores) : null;
  
  const maxCount = Math.max(
    ...Object.values(beforeBuckets),
    ...(afterBuckets ? Object.values(afterBuckets) : [0])
  );
  
  const bucketLabels = [
    { key: 'poor', label: 'Poor', range: '0-39', colorVar: '--tier-poor' },
    { key: 'weak', label: 'Weak', range: '40-54', colorVar: '--tier-weak' },
    { key: 'moderate', label: 'Moderate', range: '55-69', colorVar: '--tier-moderate' },
    { key: 'good', label: 'Good', range: '70-84', colorVar: '--tier-good' },
    { key: 'excellent', label: 'Excellent', range: '85-100', colorVar: '--tier-excellent' }
  ];
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Score Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {bucketLabels.map(bucket => (
            <div key={bucket.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {bucket.label} ({bucket.range})
                </span>
                <span className="text-muted-foreground">
                  {showBefore && `Before: ${beforeBuckets[bucket.key as keyof typeof beforeBuckets]}`}
                  {showAfter && afterBuckets && ` → After: ${afterBuckets[bucket.key as keyof typeof afterBuckets]}`}
                </span>
              </div>
              <div className="flex gap-1 h-4">
                {showBefore && (
                  <div 
                    className="rounded transition-all opacity-40"
                    style={{ 
                      backgroundColor: `hsl(var(${bucket.colorVar}))`,
                      width: `${maxCount > 0 ? (beforeBuckets[bucket.key as keyof typeof beforeBuckets] / maxCount) * 100 : 0}%`,
                      minWidth: beforeBuckets[bucket.key as keyof typeof beforeBuckets] > 0 ? '8px' : '0'
                    }}
                  />
                )}
                {showAfter && afterBuckets && (
                  <div 
                    className="rounded transition-all"
                    style={{ 
                      backgroundColor: `hsl(var(${bucket.colorVar}))`,
                      width: `${maxCount > 0 ? (afterBuckets[bucket.key as keyof typeof afterBuckets] / maxCount) * 100 : 0}%`,
                      minWidth: afterBuckets[bucket.key as keyof typeof afterBuckets] > 0 ? '8px' : '0'
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        
        {showBefore && showAfter && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-muted-foreground rounded opacity-40" />
              <span className="text-muted-foreground">Before</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-muted-foreground rounded" />
              <span className="text-muted-foreground">After</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ QueryProgressView Component ============

interface QueryProgressViewProps {
  queries: QueryWorkItem[];
}

function QueryProgressView({ queries }: QueryProgressViewProps) {
  const sortedQueries = [...queries].sort((a, b) => {
    // Sort by status: optimized first, then in_progress, then ready, then gap
    const statusOrder: Record<string, number> = { optimized: 0, in_progress: 1, ready: 2, gap: 3 };
    return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
  });
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Query Progress ({queries.length} total)</h3>
      
      <div className="space-y-3">
        {sortedQueries.map(query => (
          <QueryProgressCard key={query.id} query={query} />
        ))}
      </div>
    </div>
  );
}

function QueryProgressCard({ query }: { query: QueryWorkItem }) {
  const hasImprovement = query.currentScores && query.originalScores;
  const improvement = hasImprovement
    ? query.currentScores!.passageScore - query.originalScores!.passageScore
    : 0;
  
  const getStatusIcon = () => {
    switch (query.status) {
      case 'optimized':
        return <CheckCircle2 className="h-4 w-4 text-[hsl(var(--tier-excellent))]" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-[hsl(var(--tier-moderate))]" />;
      case 'gap':
        return <AlertTriangle className="h-4 w-4 text-[hsl(var(--tier-weak))]" />;
      default:
        return <Zap className="h-4 w-4 text-muted-foreground" />;
    }
  };
  
  return (
    <Card className={cn(
      "transition-colors",
      query.status === 'optimized' && 'border-[hsl(var(--tier-excellent))]/30 bg-[hsl(var(--tier-excellent))]/5'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {getStatusIcon()}
              <Badge 
                variant={query.status === 'optimized' ? 'default' : 'secondary'}
                className={cn(
                  query.status === 'optimized' && 'bg-[hsl(var(--tier-excellent))]',
                  query.status === 'gap' && 'bg-[hsl(var(--tier-weak))]'
                )}
              >
                {query.status === 'optimized' ? 'Optimized' : 
                 query.status === 'gap' ? (query.isApproved ? 'Gap Filled' : 'Gap') :
                 query.status === 'in_progress' ? 'In Progress' : 'Ready'}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {query.intentType}
              </Badge>
            </div>
            
            <p className="font-medium text-foreground truncate">"{query.query}"</p>
            
            {query.assignedChunk && (
              <p className="text-sm text-muted-foreground mt-1">
                Chunk {query.assignedChunk.index + 1}: {query.assignedChunk.heading}
              </p>
            )}
          </div>
          
          {/* Score Display */}
          <div className="text-right shrink-0">
            {hasImprovement ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-muted-foreground">{query.originalScores!.passageScore}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xl font-bold text-[hsl(var(--tier-excellent))]">
                    {query.currentScores!.passageScore}
                  </span>
                </div>
                <div className={cn(
                  "text-sm font-medium",
                  improvement >= 0 ? 'text-[hsl(var(--tier-excellent))]' : 'text-[hsl(var(--tier-poor))]'
                )}>
                  {improvement >= 0 ? '+' : ''}{improvement} points
                </div>
              </div>
            ) : query.originalScores ? (
              <div>
                <div className="text-xl font-bold text-foreground">{query.originalScores.passageScore}</div>
                <div className="text-xs text-muted-foreground">Original</div>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">No score</div>
            )}
          </div>
        </div>
        
        {/* Detailed Score Breakdown (collapsed by default) */}
        {hasImprovement && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="mt-2 w-full">
                <ChevronDown className="w-4 h-4 mr-2" />
                View Details
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Before</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Semantic</span>
                      <span className="text-foreground">{((query.originalScores?.semanticSimilarity || 0) * 100).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lexical</span>
                      <span className="text-foreground">{((query.originalScores?.lexicalScore || 0) * 100).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rerank</span>
                      <span className="text-foreground">{query.originalScores?.rerankScore || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Citation</span>
                      <span className="text-foreground">{query.originalScores?.citationScore || 0}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">After</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Semantic</span>
                      <span className="text-[hsl(var(--tier-excellent))]">{((query.currentScores?.semanticSimilarity || 0) * 100).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lexical</span>
                      <span className="text-[hsl(var(--tier-excellent))]">{((query.currentScores?.lexicalScore || 0) * 100).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rerank</span>
                      <span className="text-[hsl(var(--tier-excellent))]">{query.currentScores?.rerankScore || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Citation</span>
                      <span className="text-[hsl(var(--tier-excellent))]">{query.currentScores?.citationScore || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

// ============ ChunkProgressView Component ============

interface ChunkProgressViewProps {
  queries: QueryWorkItem[];
  chunks: LayoutAwareChunk[];
}

interface ChunkStats {
  chunk: LayoutAwareChunk;
  index: number;
  assignedQueries: QueryWorkItem[];
  optimizedQueries: QueryWorkItem[];
  hasOptimization: boolean;
  approvedText?: string;
  scoreImprovement: number;
}

function ChunkProgressView({ queries, chunks }: ChunkProgressViewProps) {
  // Group queries by assigned chunk
  const chunkQueryMap = useMemo(() => {
    const map = new Map<number, QueryWorkItem[]>();
    
    queries.forEach(query => {
      if (query.assignedChunk) {
        const existing = map.get(query.assignedChunk.index) || [];
        map.set(query.assignedChunk.index, [...existing, query]);
      }
    });
    
    return map;
  }, [queries]);
  
  // Get new sections (gap content)
  const newSections = queries.filter(q => q.isGap && q.isApproved);
  
  // Calculate chunk stats
  const chunkStats = useMemo(() => chunks.map((chunk, index) => {
    const assignedQueries = chunkQueryMap.get(index) || [];
    const optimizedQueries = assignedQueries.filter(q => q.isApproved);
    const hasOptimization = optimizedQueries.length > 0;
    
    // Get the approved text (from the primary query for this chunk)
    const primaryQuery = optimizedQueries.find(q => q.intentType === 'PRIMARY') || optimizedQueries[0];
    
    // Calculate average improvement across all optimized queries
    const improvements = optimizedQueries
      .filter(q => q.currentScores && q.originalScores)
      .map(q => q.currentScores!.passageScore - q.originalScores!.passageScore);
    const avgImprovement = improvements.length > 0
      ? Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length)
      : 0;
    
    return {
      chunk,
      index,
      assignedQueries,
      optimizedQueries,
      hasOptimization,
      approvedText: primaryQuery?.approvedText,
      scoreImprovement: avgImprovement
    };
  }), [chunks, chunkQueryMap]);
  
  const optimizedChunks = chunkStats.filter(c => c.hasOptimization);
  const unchangedChunks = chunkStats.filter(c => !c.hasOptimization && c.assignedQueries.length > 0);
  const unassignedChunks = chunkStats.filter(c => c.assignedQueries.length === 0);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Chunk Progress ({chunks.length} original + {newSections.length} new)
        </h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--tier-excellent))]" />
            {optimizedChunks.length} optimized
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--tier-moderate))]" />
            {unchangedChunks.length} unchanged
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            {unassignedChunks.length} unassigned
          </span>
        </div>
      </div>
      
      {/* Optimized Chunks */}
      {optimizedChunks.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-[hsl(var(--tier-excellent))] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Optimized Chunks
          </h4>
          {optimizedChunks.map(stats => (
            <ChunkProgressCard key={stats.index} stats={stats} />
          ))}
        </div>
      )}
      
      {/* New Sections */}
      {newSections.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-primary flex items-center gap-2">
            <PlusCircle className="w-4 h-4" />
            New Sections (Gap Content)
          </h4>
          {newSections.map(query => (
            <NewSectionCard key={query.id} query={query} />
          ))}
        </div>
      )}
      
      {/* Unchanged Chunks */}
      {unchangedChunks.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-start">
              <ChevronRight className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium text-muted-foreground">
                Unchanged Chunks ({unchangedChunks.length})
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 mt-3">
              {unchangedChunks.map(stats => (
                <ChunkProgressCard key={stats.index} stats={stats} minimal />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      
      {/* Unassigned Chunks */}
      {unassignedChunks.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-start">
              <ChevronRight className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium text-muted-foreground">
                Unassigned Chunks ({unassignedChunks.length})
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 mt-3">
              {unassignedChunks.map(stats => (
                <Card key={stats.index} className="opacity-60">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          Chunk {stats.index + 1}: {stats.chunk.headingPath?.slice(-1)[0] || 'Untitled'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          No queries assigned to this chunk
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ============ ChunkProgressCard Component ============

function ChunkProgressCard({ stats, minimal = false }: { stats: ChunkStats; minimal?: boolean }) {
  const [showContent, setShowContent] = useState(false);
  
  return (
    <Card className={cn(
      "transition-colors",
      stats.hasOptimization && 'border-[hsl(var(--tier-excellent))]/30 bg-[hsl(var(--tier-excellent))]/5'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {stats.hasOptimization ? (
                <Badge className="bg-[hsl(var(--tier-excellent))]">Optimized</Badge>
              ) : (
                <Badge variant="secondary">Unchanged</Badge>
              )}
            </div>
            
            <p className="font-medium text-foreground">
              Chunk {stats.index + 1}: {stats.chunk.headingPath?.slice(-1)[0] || 'Untitled'}
            </p>
            
            {/* Heading cascade */}
            {stats.chunk.headingPath && stats.chunk.headingPath.length > 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                {stats.chunk.headingPath.slice(0, -1).join(' > ')}
              </p>
            )}
            
            {/* Queries served */}
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">
                Queries served: {stats.assignedQueries.length}
              </p>
              <div className="flex flex-wrap gap-1">
                {stats.assignedQueries.slice(0, 3).map(q => (
                  <Badge key={q.id} variant="outline" className="text-xs">
                    {q.query.slice(0, 25)}{q.query.length > 25 ? '...' : ''}
                  </Badge>
                ))}
                {stats.assignedQueries.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{stats.assignedQueries.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Score improvement */}
          {stats.hasOptimization && (
            <div className="text-right shrink-0">
              <div className={cn(
                "text-xl font-bold",
                stats.scoreImprovement >= 0 ? 'text-[hsl(var(--tier-excellent))]' : 'text-[hsl(var(--tier-poor))]'
              )}>
                {stats.scoreImprovement >= 0 ? '+' : ''}{stats.scoreImprovement}
              </div>
              <div className="text-xs text-muted-foreground">avg improvement</div>
            </div>
          )}
        </div>
        
        {/* Content toggle */}
        {!minimal && (
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowContent(!showContent)}
              className="w-full"
            >
              {showContent ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Hide Content
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  {stats.hasOptimization ? 'View Changes' : 'View Original'}
                </>
              )}
            </Button>
            
            {showContent && (
              <div className="mt-4 space-y-4">
                {stats.hasOptimization && stats.approvedText ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Original</p>
                      <div className="p-3 bg-muted rounded text-sm max-h-48 overflow-y-auto break-words">
                        {stats.chunk.text}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[hsl(var(--tier-excellent))] mb-2">Optimized</p>
                      <div className="p-3 bg-[hsl(var(--tier-excellent))]/10 rounded text-sm max-h-48 overflow-y-auto border border-[hsl(var(--tier-excellent))]/30 break-words">
                        {stats.approvedText}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-muted rounded text-sm max-h-48 overflow-y-auto break-words">
                    {stats.chunk.text}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ NewSectionCard Component ============

function NewSectionCard({ query }: { query: QueryWorkItem }) {
  const [showContent, setShowContent] = useState(false);
  
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-primary">New Section</Badge>
              <Badge variant="outline" className="text-xs">{query.intentType}</Badge>
            </div>
            
            <p className="font-medium text-foreground break-words">"{query.query}"</p>
            
            {query.suggestedPlacement && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                Placement: After "{query.suggestedPlacement}"
              </p>
            )}
          </div>
          
          {query.currentScores && (
            <div className="text-right shrink-0">
              <div className="text-xl font-bold text-primary">
                {query.currentScores.passageScore}
              </div>
              <div className="text-xs text-muted-foreground">score</div>
            </div>
          )}
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowContent(!showContent)}
            className="w-full"
          >
            {showContent ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" />
                Hide Content
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                View Generated Content
              </>
            )}
          </Button>
          
          {showContent && query.approvedText && (
            <div className="mt-4 p-3 bg-primary/10 rounded text-sm max-h-48 overflow-y-auto border border-primary/30 break-words">
              {query.approvedText}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
