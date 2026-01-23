import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  Wrench,
  FileBarChart,
  ChevronDown,
  ExternalLink,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Copy,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getTierFromScore, TIER_COLORS } from '@/lib/tier-colors';
import type { FullOptimizationResult, ContentBrief, ArchitectureTask, VerificationSummary, UnchangedChunkInfo } from '@/lib/optimizer-types';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';
import type { AnalysisResult } from '@/hooks/useAnalysis';
import { ReportSummary, ReportExports } from './report';

// ============ Types ============

interface StreamedChunkWithScores {
  originalChunkIndex: number;
  query?: string;
  original_text: string;
  optimized_text: string;
  heading?: string;
  changes_applied?: Array<{ type: string; description: string }>;
  unaddressable?: string[];
  thinking?: string;
  beforeScores?: {
    semantic: number;
    lexical: number;
    citation: number;
    composite: number;
  };
  afterScores?: {
    semantic: number;
    lexical: number;
    citation: number;
    composite: number;
  };
  deltas?: {
    semantic: number;
    lexical: number;
    citation: number;
    composite: number;
  };
  improved?: boolean;
  verified?: boolean;
}

interface ArchitectureApplicationContext {
  tasksApplied: ArchitectureTask[];
  originalChunkCount: number;
  structureChanged: boolean;
}

interface ReportTabProps {
  // Legacy props (still used for fallback)
  hasOptimizationResult: boolean;
  optimizationResult: FullOptimizationResult | null;
  optimizedContent: string;
  originalContent: string;
  keywords: string[];
  layoutChunks?: LayoutAwareChunk[];
  onApplyContent: (content: string) => void;
  onGoToOptimize: () => void;
  onReanalyze: () => void;
  onSaveProject?: () => void;
  projectName?: string;
  onNavigateToOutputs?: (chunkIndex?: number) => void;
  analysisResult?: AnalysisResult | null;
  
  // New verified data props
  streamedChunks?: StreamedChunkWithScores[];
  unchangedChunksContext?: UnchangedChunkInfo[];
  verificationSummary?: VerificationSummary | null;
  architectureContext?: ArchitectureApplicationContext | null;
  unassignedQueries?: string[];
  contentBriefs?: ContentBrief[];
  onExportReport?: (format: 'markdown' | 'csv' | 'json') => void;
}

export function ProgressTab({
  hasOptimizationResult,
  optimizationResult,
  optimizedContent,
  originalContent,
  keywords,
  layoutChunks,
  onApplyContent,
  onGoToOptimize,
  onReanalyze,
  onSaveProject,
  projectName,
  onNavigateToOutputs,
  analysisResult,
  streamedChunks = [],
  unchangedChunksContext = [],
  verificationSummary,
  architectureContext,
  unassignedQueries = [],
  contentBriefs = [],
  onExportReport,
}: ReportTabProps) {
  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Derive data from either verified results or legacy optimizationResult
  const derivedData = useMemo(() => {
    // Use verification data if available
    if (verificationSummary && streamedChunks.length > 0) {
      const declinedChunks = streamedChunks.filter(c => c.deltas && c.deltas.composite < 0);
      const improvedChunks = streamedChunks.filter(c => c.improved);
      const allUnaddressable = streamedChunks.flatMap(c => 
        (c.unaddressable || []).map(issue => ({ 
          chunkIndex: c.originalChunkIndex, 
          heading: c.heading,
          issue 
        }))
      );
      
      return {
        hasVerifiedData: true,
        declinedChunks,
        improvedChunks,
        unchangedCount: unchangedChunksContext.length,
        allUnaddressable,
        totalQueries: keywords.length,
        wellCovered: verificationSummary.queryCoverage.wellCovered,
        partiallyCovered: verificationSummary.queryCoverage.partiallyCovered,
        gaps: verificationSummary.queryCoverage.gaps,
        gapQueries: verificationSummary.queryCoverage.gapQueries || unassignedQueries,
      };
    }
    
    // Fallback to legacy data
    return {
      hasVerifiedData: false,
      declinedChunks: [],
      improvedChunks: [],
      unchangedCount: 0,
      allUnaddressable: [],
      totalQueries: keywords.length,
      wellCovered: 0,
      partiallyCovered: 0,
      gaps: keywords.length,
      gapQueries: [],
    };
  }, [verificationSummary, streamedChunks, unchangedChunksContext, keywords, unassignedQueries]);

  // Use briefs from props or from optimizationResult
  const displayBriefs = contentBriefs.length > 0 ? contentBriefs : (optimizationResult?.contentBriefs || []);

  // Empty state
  if (!hasOptimizationResult || !optimizationResult) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <FileBarChart className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-medium text-foreground">No optimization results yet</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Run optimization from the Optimization tab to generate a report.
          </p>
          <Button onClick={onGoToOptimize} variant="outline">
            Go to Optimization →
          </Button>
        </div>
      </div>
    );
  }

  const handleNavigateToChunk = (chunkIndex: number) => {
    if (onNavigateToOutputs) {
      onNavigateToOutputs(chunkIndex);
    }
  };

  const handleExport = (format: 'markdown' | 'csv' | 'json') => {
    if (onExportReport) {
      onExportReport(format);
    } else {
      toast.info('Export not available');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="min-h-12 md:h-14 px-4 md:px-6 py-2 md:py-0 border-b border-border flex items-center justify-between gap-2 bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-accent" />
            Final Report
          </h3>
          <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">
            {new Date(optimizationResult.timestamp).toLocaleDateString()}
          </Badge>
          {derivedData.hasVerifiedData && (
            <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Verified
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onSaveProject && (
            <Button size="sm" onClick={onSaveProject}>
              Save Project
            </Button>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="h-full flex flex-col">
          <div className="px-4 md:px-6 pt-4 border-b border-border">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="overview" className="text-xs md:text-sm">
                Overview
              </TabsTrigger>
              <TabsTrigger value="chunks" className="text-xs md:text-sm relative">
                Chunks
                {derivedData.declinedChunks.length > 0 && (
                  <Badge className="ml-2 h-5 min-w-5 px-1.5 text-[10px] bg-[hsl(var(--destructive))] text-white border-0">
                    {derivedData.declinedChunks.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="coverage" className="text-xs md:text-sm">
                Query Coverage
              </TabsTrigger>
              <TabsTrigger value="exports" className="text-xs md:text-sm">
                Exports
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 md:p-6 max-w-5xl space-y-6">
              {/* ============ OVERVIEW TAB ============ */}
              <TabsContent value="overview" className="mt-0 space-y-6">
                {/* Architecture Impact */}
                {architectureContext && architectureContext.tasksApplied.length > 0 && (
                  <ArchitectureImpactCard architectureContext={architectureContext} />
                )}

                {/* Verified Summary */}
                {verificationSummary && (
                  <VerifiedSummaryCard 
                    summary={verificationSummary} 
                    streamedChunks={streamedChunks}
                  />
                )}

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <QuickStatCard
                    label="Chunks Improved"
                    value={derivedData.improvedChunks.length}
                    total={streamedChunks.length || optimizationResult.optimizedChunks?.length || 0}
                    icon={<TrendingUp className="h-4 w-4 text-green-600" />}
                  />
                  <QuickStatCard
                    label="Chunks Declined"
                    value={derivedData.declinedChunks.length}
                    total={streamedChunks.length || optimizationResult.optimizedChunks?.length || 0}
                    icon={<TrendingDown className="h-4 w-4 text-red-600" />}
                    isWarning={derivedData.declinedChunks.length > 0}
                  />
                  <QuickStatCard
                    label="Queries Covered"
                    value={derivedData.wellCovered + derivedData.partiallyCovered}
                    total={derivedData.totalQueries}
                    icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
                  />
                  <QuickStatCard
                    label="Content Gaps"
                    value={displayBriefs.length}
                    icon={<AlertTriangle className="h-4 w-4 text-warning" />}
                    isWarning={displayBriefs.length > 0}
                  />
                </div>

                {/* Declined Chunks Alert */}
                {derivedData.declinedChunks.length > 0 && (
                  <DeclinedChunksAlert 
                    chunks={derivedData.declinedChunks}
                    layoutChunks={layoutChunks}
                    onNavigate={handleNavigateToChunk}
                  />
                )}

                {/* Unaddressable Issues */}
                {derivedData.allUnaddressable.length > 0 && (
                  <UnaddressableIssuesCard 
                    issues={derivedData.allUnaddressable}
                    onNavigate={handleNavigateToChunk}
                  />
                )}

                {/* Legacy Summary for non-verified data */}
                {!derivedData.hasVerifiedData && (
                  <ReportSummary 
                    optimizationResult={optimizationResult} 
                    analysisResult={analysisResult}
                    onNavigateToChunk={handleNavigateToChunk}
                  />
                )}
              </TabsContent>

              {/* ============ CHUNKS TAB ============ */}
              <TabsContent value="chunks" className="mt-0 space-y-6">
                {/* Optimized Chunks Table */}
                <OptimizedChunksTable
                  chunks={streamedChunks}
                  layoutChunks={layoutChunks}
                  onNavigate={handleNavigateToChunk}
                />

                {/* Unchanged Chunks Context */}
                {unchangedChunksContext.length > 0 && (
                  <UnchangedChunksCard
                    chunks={unchangedChunksContext}
                    onNavigate={handleNavigateToChunk}
                  />
                )}
              </TabsContent>

              {/* ============ QUERY COVERAGE TAB ============ */}
              <TabsContent value="coverage" className="mt-0 space-y-6">
                {/* Coverage Summary */}
                <QueryCoverageSummary
                  wellCovered={derivedData.wellCovered}
                  partiallyCovered={derivedData.partiallyCovered}
                  gaps={derivedData.gaps}
                  total={derivedData.totalQueries}
                  gapQueries={derivedData.gapQueries}
                />

                {/* Content Briefs */}
                {displayBriefs.length > 0 && (
                  <ContentBriefsCard
                    briefs={displayBriefs}
                    onNavigate={handleNavigateToChunk}
                  />
                )}
              </TabsContent>

              {/* ============ EXPORTS TAB ============ */}
              <TabsContent value="exports" className="mt-0">
                <ReportExports
                  content={originalContent}
                  optimizedContent={optimizedContent}
                  optimizationResult={optimizationResult}
                  keywords={keywords}
                  projectName={projectName}
                />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </div>

      {/* Sticky Footer */}
      <div className="border-t border-border bg-surface px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
        <p className="text-xs text-muted-foreground">
          Report generated {new Date(optimizationResult.timestamp).toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('markdown')}>
            <Download className="h-4 w-4 mr-2" />
            Markdown
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
            <Download className="h-4 w-4 mr-2" />
            JSON
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ Sub-Components ============

function ArchitectureImpactCard({ architectureContext }: { 
  architectureContext: ArchitectureApplicationContext;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Card className="border-l-4 border-l-primary bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Structural Changes Applied
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <p className="text-sm text-muted-foreground mb-3">
            {architectureContext.tasksApplied.length} structural improvements 
            applied before optimization.
          </p>
          
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="mb-2">
              {isOpen ? 'Hide Details' : 'Show Details'}
              <ChevronDown className={cn('h-4 w-4 ml-1 transition-transform', isOpen && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="space-y-2 mt-2">
              {architectureContext.tasksApplied.map((task, i) => (
                <div key={task.id || i} className="flex items-start gap-2 p-2 bg-surface rounded border">
                  <Badge variant="outline" className="text-xs shrink-0">
                    {task.type.replace(/_/g, ' ')}
                  </Badge>
                  <p className="text-xs text-muted-foreground">{task.description}</p>
                </div>
              ))}
            </div>
          </CollapsibleContent>
          
          {architectureContext.structureChanged && (
            <Alert className="mt-3 bg-muted/50">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Document was re-chunked after structural changes. 
                Chunk count changed from {architectureContext.originalChunkCount}. 
                All scores reflect the new structure.
              </AlertDescription>
            </Alert>
          )}
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function VerifiedSummaryCard({ summary, streamedChunks }: { 
  summary: VerificationSummary;
  streamedChunks: StreamedChunkWithScores[];
}) {
  const improvement = summary.avgCompositeAfter - summary.avgCompositeBefore;
  const improvementPct = summary.avgCompositeBefore > 0 
    ? ((improvement / summary.avgCompositeBefore) * 100).toFixed(1)
    : '0';
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-primary/10 to-transparent">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          Verified Optimization Results
        </CardTitle>
        <CardDescription className="text-xs">
          Scores verified by re-embedding optimized content against target queries
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <VerifiedMetricCard
            label="Composite Score"
            before={summary.avgCompositeBefore}
            after={summary.avgCompositeAfter}
          />
          <OutcomeCard
            improved={summary.chunksImproved}
            declined={summary.chunksDeclined}
            total={summary.optimizedCount}
          />
          <div className="col-span-2 md:col-span-2">
            <div className="text-xs text-muted-foreground mb-1">Query Coverage</div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                {summary.queryCoverage.wellCovered} well covered
              </Badge>
              <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                {summary.queryCoverage.partiallyCovered} partial
              </Badge>
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                {summary.queryCoverage.gaps} gaps
              </Badge>
            </div>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground mt-4 border-t pt-3">
          {summary.optimizedCount} of {summary.totalChunks} chunks optimized
          {summary.unchangedCount > 0 && <> • {summary.unchangedCount} unchanged</>}
        </p>
      </CardContent>
    </Card>
  );
}

function VerifiedMetricCard({ label, before, after }: { 
  label: string; 
  before: number; 
  after: number;
}) {
  const delta = after - before;
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  
  return (
    <div className="p-3 bg-muted/30 rounded-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-lg text-muted-foreground">{Math.round(before)}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <span className={cn(
          "text-lg font-semibold",
          isPositive && "text-green-600",
          isNegative && "text-red-600",
          !isPositive && !isNegative && "text-foreground"
        )}>
          {Math.round(after)}
        </span>
      </div>
      <p className={cn(
        "text-xs mt-1",
        isPositive && "text-green-600",
        isNegative && "text-red-600",
        !isPositive && !isNegative && "text-muted-foreground"
      )}>
        {delta > 0 ? '+' : ''}{delta.toFixed(1)} pts (verified)
      </p>
    </div>
  );
}

function OutcomeCard({ improved, declined, total }: {
  improved: number;
  declined: number;
  total: number;
}) {
  const unchanged = total - improved - declined;
  
  return (
    <div className="p-3 bg-muted/30 rounded-lg">
      <p className="text-xs text-muted-foreground mb-2">Outcomes</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-green-600" /> Improved
          </span>
          <span className="font-medium text-green-600">{improved}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1">
            <Minus className="h-3 w-3 text-muted-foreground" /> Unchanged
          </span>
          <span className="font-medium text-muted-foreground">{unchanged}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-red-600" /> Declined
          </span>
          <span className="font-medium text-red-600">{declined}</span>
        </div>
      </div>
    </div>
  );
}

function QuickStatCard({ label, value, total, icon, isWarning }: {
  label: string;
  value: number;
  total?: number;
  icon: React.ReactNode;
  isWarning?: boolean;
}) {
  return (
    <Card className={cn(isWarning && value > 0 && "border-warning/50")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          {icon}
          {total !== undefined && (
            <span className="text-xs text-muted-foreground">{value}/{total}</span>
          )}
        </div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function DeclinedChunksAlert({ chunks, layoutChunks, onNavigate }: {
  chunks: StreamedChunkWithScores[];
  layoutChunks?: LayoutAwareChunk[];
  onNavigate: (index: number) => void;
}) {
  return (
    <Card className="border-l-4 border-l-destructive bg-destructive/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Chunks That Didn't Improve ({chunks.length})
        </CardTitle>
        <CardDescription className="text-xs">
          These need manual attention - optimization made scores worse
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {chunks.map((chunk, i) => {
            const layoutChunk = layoutChunks?.[chunk.originalChunkIndex];
            const heading = chunk.heading || layoutChunk?.headingPath?.slice(-1)[0] || `Chunk ${chunk.originalChunkIndex + 1}`;
            
            return (
              <div key={i} className="p-3 bg-surface rounded border border-destructive/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{heading}</span>
                  <ScoreChange 
                    before={chunk.beforeScores?.composite} 
                    after={chunk.afterScores?.composite} 
                  />
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Query: "{chunk.query}"
                </p>
                {chunk.unaddressable && chunk.unaddressable.length > 0 && (
                  <ul className="text-xs text-muted-foreground list-disc pl-4 mb-2">
                    {chunk.unaddressable.map((issue, j) => (
                      <li key={j}>{issue}</li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onNavigate(chunk.originalChunkIndex)}>
                    View Before/After
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive">
                    Flag for Manual Edit
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function UnaddressableIssuesCard({ issues, onNavigate }: {
  issues: Array<{ chunkIndex: number; heading?: string; issue: string }>;
  onNavigate: (index: number) => void;
}) {
  return (
    <Card className="border-l-4 border-l-warning">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Unaddressable Issues ({issues.length})
        </CardTitle>
        <CardDescription className="text-xs">
          Issues the AI couldn't fix automatically - require manual editing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {issues.map((item, i) => (
            <div 
              key={i} 
              className="flex items-start justify-between gap-3 p-2 bg-warning/5 rounded border border-warning/20 cursor-pointer hover:bg-warning/10"
              onClick={() => onNavigate(item.chunkIndex)}
            >
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-xs shrink-0">
                  Chunk {item.chunkIndex + 1}
                </Badge>
                <span className="text-xs text-muted-foreground">{item.issue}</span>
              </div>
              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function OptimizedChunksTable({ chunks, layoutChunks, onNavigate }: {
  chunks: StreamedChunkWithScores[];
  layoutChunks?: LayoutAwareChunk[];
  onNavigate: (index: number) => void;
}) {
  if (chunks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No optimized chunks to display</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Optimized Chunks ({chunks.length}) - Verified Scores
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Chunk</TableHead>
              <TableHead>Query</TableHead>
              <TableHead className="w-24">Semantic</TableHead>
              <TableHead className="w-24">Lexical</TableHead>
              <TableHead className="w-24">Composite</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chunks.map((chunk, i) => (
              <TableRow key={i} className={cn(
                chunk.deltas && chunk.deltas.composite < 0 && "bg-destructive/5"
              )}>
                <TableCell className="font-medium">
                  #{chunk.originalChunkIndex + 1}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-48 truncate">
                  {chunk.query || 'N/A'}
                </TableCell>
                <TableCell>
                  <ScoreChange 
                    before={chunk.beforeScores?.semantic} 
                    after={chunk.afterScores?.semantic} 
                  />
                </TableCell>
                <TableCell>
                  <ScoreChange 
                    before={chunk.beforeScores?.lexical} 
                    after={chunk.afterScores?.lexical} 
                  />
                </TableCell>
                <TableCell>
                  <ScoreChange 
                    before={chunk.beforeScores?.composite} 
                    after={chunk.afterScores?.composite} 
                  />
                </TableCell>
                <TableCell>
                  <StatusBadge improved={chunk.improved} delta={chunk.deltas?.composite} />
                </TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => onNavigate(chunk.originalChunkIndex)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UnchangedChunksCard({ chunks, onNavigate }: {
  chunks: UnchangedChunkInfo[];
  onNavigate: (index: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const reasonLabels: Record<string, string> = {
    no_assignment: 'No query match',
    user_excluded: 'Excluded by user',
    already_optimal: 'Already optimal',
  };
  
  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-sm font-medium">
                Unchanged Chunks ({chunks.length})
              </CardTitle>
              <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
            </div>
          </CollapsibleTrigger>
          <CardDescription className="text-xs">
            These chunks weren't optimized. Showing their current scores for context.
          </CardDescription>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chunk</TableHead>
                  <TableHead>Reason Not Optimized</TableHead>
                  <TableHead>Current Score</TableHead>
                  <TableHead>Best Matching Query</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chunks.map((chunk, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      #{chunk.chunkIndex + 1}: {chunk.heading || 'Untitled'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {reasonLabels[chunk.reason] || chunk.reason}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ScoreBadge score={chunk.currentScores.composite} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-48">
                      {chunk.bestMatchingQuery}
                      <span className="ml-1 text-muted-foreground/60">
                        ({Math.round(chunk.bestMatchScore)})
                      </span>
                    </TableCell>
                    <TableCell>
                      {chunk.currentScores.composite < 60 && (
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                          Include in next run
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function QueryCoverageSummary({ wellCovered, partiallyCovered, gaps, total, gapQueries }: {
  wellCovered: number;
  partiallyCovered: number;
  gaps: number;
  total: number;
  gapQueries: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Query Coverage</CardTitle>
        <CardDescription className="text-xs">
          How well your content covers target queries after optimization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <CoverageBox
            label="Well Covered"
            description="Score ≥ 70"
            count={wellCovered}
            total={total}
            color="green"
          />
          <CoverageBox
            label="Partially Covered"
            description="Score 40-69"
            count={partiallyCovered}
            total={total}
            color="yellow"
          />
          <CoverageBox
            label="Gaps"
            description="Score < 40 or unassigned"
            count={gaps}
            total={total}
            color="red"
          />
        </div>
        
        {gapQueries.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Queries needing new content:
            </p>
            <div className="space-y-1">
              {gapQueries.map((q, i) => (
                <p key={i} className="text-sm">• {q}</p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CoverageBox({ label, description, count, total, color }: {
  label: string;
  description: string;
  count: number;
  total: number;
  color: 'green' | 'yellow' | 'red';
}) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
  };
  
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  
  return (
    <div className={cn('p-4 rounded-lg border text-center', colorClasses[color])}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs opacity-75">{description}</p>
      <p className="text-xs mt-1 opacity-60">{pct}% of queries</p>
    </div>
  );
}

function ContentBriefsCard({ briefs, onNavigate }: {
  briefs: ContentBrief[];
  onNavigate: (index: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileBarChart className="h-4 w-4" />
          Content Briefs ({briefs.length})
        </CardTitle>
        <CardDescription className="text-xs">
          New content needed to cover unassigned queries
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {briefs.map((brief, i) => (
            <ContentBriefRow key={i} brief={brief} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ContentBriefRow({ brief }: { brief: ContentBrief }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const copyBrief = () => {
    const text = `# ${brief.suggestedHeading}

**Target Query:** ${brief.targetQuery}  
**Placement:** ${brief.placementDescription}  
**Target Length:** ${brief.targetWordCount.min}-${brief.targetWordCount.max} words

## Key Points
${brief.keyPoints.map(p => `- ${p}`).join('\n')}

## Draft Opening
${brief.draftOpening}

## Gap Analysis
${brief.gapAnalysis}`;
    
    navigator.clipboard.writeText(text);
    toast.success('Brief copied to clipboard');
  };
  
  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50">
            <div>
              <p className="text-sm font-medium">{brief.suggestedHeading}</p>
              <p className="text-xs text-muted-foreground">
                {brief.targetWordCount.min}-{brief.targetWordCount.max} words • {brief.keyPoints.length} key points
              </p>
            </div>
            <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-3 border-t bg-muted/30 space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Target Query:</p>
              <p className="text-sm">{brief.targetQuery}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Placement:</p>
              <p className="text-sm">{brief.placementDescription}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Key Points:</p>
              <ul className="text-sm list-disc pl-4">
                {brief.keyPoints.map((point, j) => (
                  <li key={j}>{point}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Draft Opening:</p>
              <p className="text-sm italic bg-surface p-2 rounded">{brief.draftOpening}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={copyBrief}>
                <Copy className="h-4 w-4 mr-1" /> Copy Brief
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ============ Utility Components ============

function ScoreChange({ before, after }: { before?: number; after?: number }) {
  if (before === undefined || after === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  
  const delta = after - before;
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  
  return (
    <span className="text-xs whitespace-nowrap">
      <span className="text-muted-foreground">{Math.round(before)}</span>
      <span className="text-muted-foreground mx-1">→</span>
      <span className={cn(
        "font-medium",
        isPositive && "text-green-600",
        isNegative && "text-red-600"
      )}>
        {Math.round(after)}
      </span>
      <span className={cn(
        "ml-1",
        isPositive && "text-green-600",
        isNegative && "text-red-600",
        !isPositive && !isNegative && "text-muted-foreground"
      )}>
        ({delta > 0 ? '+' : ''}{Math.round(delta)})
      </span>
    </span>
  );
}

function StatusBadge({ improved, delta }: { improved?: boolean; delta?: number }) {
  if (delta === undefined) return null;
  
  if (improved) {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
        <TrendingUp className="h-3 w-3 mr-1" /> Improved
      </Badge>
    );
  }
  if (delta < 0) {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">
        <TrendingDown className="h-3 w-3 mr-1" /> Declined
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      <Minus className="h-3 w-3 mr-1" /> No change
    </Badge>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tier = getTierFromScore(score);
  const tierColors = TIER_COLORS[tier];
  
  return (
    <Badge className={cn("text-xs border", tierColors.badge)}>
      {Math.round(score)}
    </Badge>
  );
}
