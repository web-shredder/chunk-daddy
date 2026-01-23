/**
 * CoverageTab Component
 * Displays queries organized by optimization status with interactive cards
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  Loader2, 
  Clock, 
  AlertTriangle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QueryCard } from './QueryCard';
import { QueryWorkingPanel } from './QueryWorkingPanel';
import { transformToWorkItems, getCoverageSummary } from '@/utils/coverageHelpers';
import type { LayoutAwareChunk, DocumentElement } from '@/lib/layout-chunker';
import type { ChunkScore, AnalysisResult } from '@/hooks/useAnalysis';
import type { FanoutIntentType } from '@/lib/optimizer-types';
import type { QueryWorkItem, CoverageState } from '@/types/coverage';

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
  // NEW: Lifted state for persistence
  coverageState: CoverageState | null;
  onCoverageStateChange: (state: CoverageState) => void;
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
  onNavigateToDownloads,
  coverageState: externalCoverageState,
  onCoverageStateChange
}: CoverageTabProps) {
  
  // Coverage state management - use external state if provided, otherwise initialize locally
  const [localCoverageState, setLocalCoverageState] = useState<CoverageState>({
    queries: [],
    activeQueryId: null,
    optimizationStates: {},
  });
  
  // Use external state if provided, otherwise use local
  const coverageState = externalCoverageState || localCoverageState;
  
  // Wrapper to update both local and external state
  const setCoverageState = useCallback((updater: CoverageState | ((prev: CoverageState) => CoverageState)) => {
    const newState = typeof updater === 'function' ? updater(coverageState) : updater;
    setLocalCoverageState(newState);
    onCoverageStateChange(newState);
  }, [coverageState, onCoverageStateChange]);
  
  // Track if work items have been initialized
  const [workItemsInitialized, setWorkItemsInitialized] = useState(false);
  
  // Transform queries to work items when data is available (only on first load)
  const baseWorkItems = useMemo((): QueryWorkItem[] => {
    if (!hasResults || keywords.length === 0) {
      return keywords.map(query => ({
        id: crypto.randomUUID(),
        query,
        intentType: 'PRIMARY' as const,
        status: 'gap' as const,
        isApproved: false,
      }));
    }
    
    // Convert keywords to query input format
    const queryInputs = keywords.map(query => ({
      query,
      intentType: queryIntentTypes[query],
    }));
    
    return transformToWorkItems(queryInputs, chunkScores, chunks, queryIntentTypes);
  }, [hasResults, keywords, chunkScores, chunks, queryIntentTypes]);
  
  // Merge base work items with coverage state (preserves status updates from persistence)
  const workItems = useMemo((): QueryWorkItem[] => {
    // If we have persisted coverage state with queries, use them
    if (coverageState.queries.length > 0) {
      // Merge: preserve user edits/approvals from saved state, but update chunk assignments from fresh analysis
      return coverageState.queries.map(savedQuery => {
        const freshQuery = baseWorkItems.find(bwi => bwi.query === savedQuery.query);
        if (freshQuery) {
          // Merge: keep saved status, approvals, and optimization states; update chunk assignments
          return {
            ...freshQuery,
            id: savedQuery.id, // Keep the same ID for optimization state lookup
            status: savedQuery.status,
            isApproved: savedQuery.isApproved,
            approvedText: savedQuery.approvedText,
            optimizedText: savedQuery.optimizedText,
            currentScores: savedQuery.currentScores || freshQuery.currentScores,
            originalScores: savedQuery.originalScores || freshQuery.originalScores,
          };
        }
        return savedQuery;
      });
    }
    
    // Otherwise use fresh work items
    return baseWorkItems;
  }, [baseWorkItems, coverageState.queries]);
  
  // Initialize coverage state when base work items change (only if no persisted state)
  useEffect(() => {
    if (baseWorkItems.length > 0 && coverageState.queries.length === 0) {
      setCoverageState(prev => ({
        ...prev,
        queries: baseWorkItems,
      }));
      setWorkItemsInitialized(true);
    } else if (coverageState.queries.length > 0) {
      // Already have persisted state
      setWorkItemsInitialized(true);
    }
  }, [baseWorkItems.length, coverageState.queries.length]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Group queries by status - uses the managed workItems
  const groupedQueries = useMemo(() => {
    const optimized = workItems.filter(q => q.status === 'optimized');
    const inProgress = workItems.filter(q => q.status === 'in_progress');
    const ready = workItems.filter(q => q.status === 'ready');
    const gaps = workItems.filter(q => q.status === 'gap');
    
    return { optimized, inProgress, ready, gaps };
  }, [workItems]);
  
  // Summary stats
  const summary = useMemo(() => getCoverageSummary(workItems), [workItems]);
  
  // Handle query card click
  const handleQueryClick = useCallback((queryId: string) => {
    console.log('Opening working panel for query:', queryId);
    setCoverageState(prev => ({ ...prev, activeQueryId: queryId }));
  }, []);
  
  // Close working panel
  const handleClosePanel = useCallback(() => {
    setCoverageState(prev => ({ ...prev, activeQueryId: null }));
  }, []);
  
  // Handle optimization state changes
  const handleOptimizationStateChange = useCallback((queryId: string, optState: import('@/types/coverage').QueryOptimizationState) => {
    setCoverageState(prev => ({
      ...prev,
      optimizationStates: {
        ...prev.optimizationStates,
        [queryId]: optState
      }
    }));
  }, []);
  
  // Handle status changes (in_progress, optimized, etc.)
  const handleStatusChange = useCallback((queryId: string, newStatus: import('@/types/coverage').QueryStatus) => {
    console.log('Status change:', queryId, '->', newStatus);
    setCoverageState(prev => ({
      ...prev,
      queries: prev.queries.map(q => 
        q.id === queryId ? { ...q, status: newStatus } : q
      )
    }));
  }, []);
  
  // Handle query updates (scores, approved text, etc.)
  const handleQueryUpdate = useCallback((queryId: string, updates: Partial<QueryWorkItem>) => {
    console.log('Query update:', queryId, updates);
    setCoverageState(prev => ({
      ...prev,
      queries: prev.queries.map(q => 
        q.id === queryId ? { ...q, ...updates } : q
      )
    }));
  }, []);
  
  // Get active query and its assigned chunk
  const activeQuery = useMemo(() => {
    if (!coverageState.activeQueryId) return undefined;
    return workItems.find(q => q.id === coverageState.activeQueryId);
  }, [coverageState.activeQueryId, workItems]);
  
  const activeChunk = useMemo(() => {
    if (!activeQuery?.assignedChunk) return undefined;
    return chunks[activeQuery.assignedChunk.index];
  }, [activeQuery, chunks]);
  
  // Derive content summary from chunks
  const contentSummary = useMemo(() => {
    if (!chunks.length) return '';
    const headings = chunks
      .map(c => c.headingPath?.slice(-1)[0])
      .filter(Boolean)
      .slice(0, 10);
    return `Document covers: ${headings.join(', ')}`;
  }, [chunks]);
  
  // Get initial optimization state for active query
  const activeOptState = activeQuery 
    ? coverageState.optimizationStates[activeQuery.id] 
    : undefined;
  
  // Empty state
  if (!hasResults) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
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
            {summary.total} queries
          </Badge>
          {summary.optimized > 0 && (
            <Badge variant="secondary" className="text-xs text-success">
              {summary.optimized} optimized
            </Badge>
          )}
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
            <AlertTriangle className="h-4 w-4" />
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
                {groupedQueries.optimized.length}/{summary.total}
              </Badge>
            </h3>
            {groupedQueries.optimized.length > 0 ? (
              <div className="space-y-3">
                {groupedQueries.optimized.map(query => (
                  <QueryCard 
                    key={query.id}
                    query={query}
                    onClick={() => handleQueryClick(query.id)}
                  />
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
              <Loader2 className="h-5 w-5 text-primary" />
              <span className="text-primary">IN PROGRESS</span>
              <Badge variant="secondary" className="ml-2">
                {groupedQueries.inProgress.length}/{summary.total}
              </Badge>
            </h3>
            {groupedQueries.inProgress.length > 0 ? (
              <div className="space-y-3">
                {groupedQueries.inProgress.map(query => (
                  <QueryCard 
                    key={query.id}
                    query={query}
                    onClick={() => handleQueryClick(query.id)}
                  />
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
                {groupedQueries.ready.length}/{summary.total}
              </Badge>
            </h3>
            {groupedQueries.ready.length > 0 ? (
              <div className="space-y-3">
                {groupedQueries.ready.map(query => (
                  <QueryCard 
                    key={query.id}
                    query={query}
                    onClick={() => handleQueryClick(query.id)}
                  />
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
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="text-destructive">CONTENT GAPS</span>
              <Badge variant="secondary" className="ml-2">
                {groupedQueries.gaps.length}/{summary.total}
              </Badge>
            </h3>
            {groupedQueries.gaps.length > 0 ? (
              <div className="space-y-3">
                {groupedQueries.gaps.map(query => (
                  <QueryCard 
                    key={query.id}
                    query={query}
                    onClick={() => handleQueryClick(query.id)}
                  />
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
      
      {/* Query Working Panel */}
      <QueryWorkingPanel
        isOpen={!!activeQuery}
        queryItem={activeQuery}
        chunk={activeChunk}
        chunks={chunks}
        contentSummary={contentSummary}
        initialOptState={activeOptState}
        onClose={handleClosePanel}
        onUpdate={(updates) => handleQueryUpdate(activeQuery?.id || '', updates)}
        onStatusChange={(status) => handleStatusChange(activeQuery?.id || '', status)}
        onApprove={(text) => {
          console.log('Approve text:', text);
        }}
        onOptimizationStateChange={handleOptimizationStateChange}
      />
    </div>
  );
}

export default CoverageTab;
