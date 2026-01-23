/**
 * QueryWorkingPanel Component
 * Slide-over panel for optimizing individual queries
 */

import { useState, useCallback } from 'react';
import { 
  ArrowLeft, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  RefreshCw,
  FileText,
  ArrowRight,
  AlertCircle,
  FileEdit,
  BarChart3
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getTierFromScore, TIER_COLORS, getTierLabel } from '@/lib/tier-colors';
import { useQueryOptimization } from '@/hooks/useQueryOptimization';
import type { QueryWorkItem, QueryIntentType, QueryOptimizationState } from '@/types/coverage';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';

interface QueryWorkingPanelProps {
  isOpen: boolean;
  queryItem?: QueryWorkItem;
  chunk?: LayoutAwareChunk;
  initialOptState?: QueryOptimizationState;
  onClose: () => void;
  onUpdate: (updates: Partial<QueryWorkItem>) => void;
  onApprove: (approvedText: string) => void;
  onOptimizationStateChange: (queryId: string, state: QueryOptimizationState) => void;
}

// Intent type color mapping using design system
const INTENT_TYPE_STYLES: Record<QueryIntentType, string> = {
  PRIMARY: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  EQUIVALENT: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  FOLLOW_UP: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800',
  GENERALIZATION: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
  CANONICALIZATION: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800',
  ENTAILMENT: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
  SPECIFICATION: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  CLARIFICATION: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  GAP: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
};

function ScoreBox({ label, value }: { label: string; value: number }) {
  const tier = getTierFromScore(value);
  const tierColors = TIER_COLORS[tier];
  const tierLabel = getTierLabel(value);
  
  return (
    <div className="text-center p-3 bg-muted rounded-lg">
      <div className={cn('text-2xl font-bold', tierColors.text)}>
        {Math.round(value)}
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
        {label}
      </div>
      <div className={cn('text-xs font-medium mt-0.5', tierColors.text)}>
        {tierLabel}
      </div>
    </div>
  );
}

function ScoreCompare({ label, before, after }: { label: string; before: number; after: number }) {
  const diff = after - before;
  const isImproved = diff > 0;
  const isDeclined = diff < 0;
  
  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className="flex items-center justify-center gap-1">
        <span className="text-muted-foreground">{Math.round(before)}</span>
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
        <span className="font-medium">{Math.round(after)}</span>
      </div>
      <div className={cn(
        'text-xs font-medium',
        isImproved ? 'text-success' : isDeclined ? 'text-destructive' : 'text-muted-foreground'
      )}>
        {diff > 0 ? `+${Math.round(diff)}` : diff < 0 ? Math.round(diff) : '—'}
      </div>
    </div>
  );
}

export function QueryWorkingPanel({
  isOpen,
  queryItem,
  chunk,
  initialOptState,
  onClose,
  onUpdate,
  onApprove,
  onOptimizationStateChange,
}: QueryWorkingPanelProps) {
  const [isScoresExpanded, setIsScoresExpanded] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  
  // Use the optimization hook
  const { 
    state: optState, 
    generateAnalysis, 
    setUserAnalysis, 
    runOptimization, 
    setUserContent 
  } = useQueryOptimization({
    queryItem: queryItem!,
    chunk,
    initialState: initialOptState,
    onStateChange: (newState) => {
      if (queryItem) {
        onOptimizationStateChange(queryItem.id, newState);
      }
    },
  });

  // Stub for re-scoring (will be implemented in next prompt)
  const handleRescore = useCallback(async () => {
    console.log('Rescoring content...');
    // Will be implemented in next prompt
  }, []);

  if (!queryItem) {
    return null;
  }

  const intentStyle = INTENT_TYPE_STYLES[queryItem.intentType] || INTENT_TYPE_STYLES.PRIMARY;
  const chunkWordCount = chunk?.text.split(/\s+/).length ?? 0;
  const chunkTokenCount = chunk ? Math.ceil(chunk.text.length / 4) : 0;
  const chunkHeading = chunk?.headingPath?.slice(-1)[0] || 'Untitled Section';
  const chunkHeadingPath = chunk?.headingPath ?? [];
  
  const isAnalyzing = optState.step === 'analyzing';
  const isOptimizing = optState.step === 'optimizing';
  const hasAnalysis = !!optState.generatedAnalysis;
  const hasOptimizedContent = !!optState.generatedContent;
  const isStep1Complete = optState.step === 'analysis_ready' || 
                          optState.step === 'optimizing' || 
                          optState.step === 'optimization_ready' ||
                          optState.step === 'scoring' ||
                          optState.step === 'approved';
  const isStep2Complete = optState.step === 'optimization_ready' ||
                          optState.step === 'scoring' ||
                          optState.step === 'approved';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        {/* Sticky Header */}
        <SheetHeader className="sticky top-0 bg-background z-10 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onClose} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
          <SheetTitle className="text-xl mt-4 break-words">
            "{queryItem.query}"
          </SheetTitle>
          <SheetDescription className="sr-only">
            Working panel for optimizing query coverage
          </SheetDescription>
          <div className="mt-2">
            <Badge variant="outline" className={cn('text-xs', intentStyle)}>
              {queryItem.intentType.replace(/_/g, ' ')}
            </Badge>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Query Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Query Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Intent Type</span>
                <Badge variant="secondary" className="text-xs">
                  {queryItem.intentType.replace(/_/g, ' ')}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="capitalize font-medium">
                  {queryItem.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Route Prediction</span>
                <span>Web Search</span>
              </div>
            </CardContent>
          </Card>

          {/* Assigned Chunk Section (for non-gap queries) */}
          {queryItem.status !== 'gap' && chunk && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Assigned Chunk</CardTitle>
                  <Button variant="ghost" size="sm" disabled>
                    Change
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium mb-2">
                  Chunk {(queryItem.assignedChunk?.index ?? 0) + 1}: {chunkHeading}
                </div>
                {chunkHeadingPath.length > 1 && (
                  <div className="text-xs text-muted-foreground mb-2 break-words">
                    {chunkHeadingPath.join(' > ')}
                  </div>
                )}
                <div className="text-sm text-muted-foreground bg-muted p-3 rounded max-h-32 overflow-y-auto break-words">
                  {chunk.text.slice(0, 500)}{chunk.text.length > 500 && '...'}
                </div>
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                  <span>Words: {chunkWordCount}</span>
                  <span>Tokens: ~{chunkTokenCount}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gap Notice (for gap queries) */}
          {queryItem.status === 'gap' && (
            <Card className="border-warning/50 bg-warning/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Content Gap
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No existing content matches this query well enough. You'll need to create new content to fill this gap.
                </p>
                {queryItem.originalScores && (
                  <div className="mt-3 text-sm">
                    <span className="text-muted-foreground">Best partial match score: </span>
                    <span className="font-medium">{Math.round(queryItem.originalScores.passageScore)}</span>
                    <span className="text-muted-foreground"> (below threshold of 45)</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Scoring Analysis Section */}
          {queryItem.originalScores && (
            <Card>
              <Collapsible open={isScoresExpanded} onOpenChange={setIsScoresExpanded}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Scoring Analysis</CardTitle>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        {isScoresExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3">
                    <ScoreBox 
                      label="Passage" 
                      value={queryItem.originalScores.passageScore} 
                    />
                    <ScoreBox 
                      label="Semantic" 
                      value={(queryItem.originalScores.semanticSimilarity ?? 0) * 100} 
                    />
                    <ScoreBox 
                      label="Lexical" 
                      value={(queryItem.originalScores.lexicalScore ?? 0) * 100} 
                    />
                    <ScoreBox 
                      label="Citation" 
                      value={(queryItem.originalScores.citationScore ?? 0) * 100} 
                    />
                  </div>
                  
                  <CollapsibleContent className="mt-4 pt-4 border-t space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Semantic Similarity</span>
                      <span>{(queryItem.originalScores.semanticSimilarity ?? 0).toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lexical Score</span>
                      <span>{(queryItem.originalScores.lexicalScore ?? 0).toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rerank Score</span>
                      <span>{(queryItem.originalScores.rerankScore ?? 0).toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Citation Score</span>
                      <span>{(queryItem.originalScores.citationScore ?? 0).toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entity Overlap</span>
                      <span>{Math.round((queryItem.originalScores.entityOverlap ?? 0) * 100)}%</span>
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Collapsible>
            </Card>
          )}

          {/* Step 1: Analysis Prompt */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Step 1: Analysis Prompt
                  {isStep1Complete && (
                    <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                      Complete
                    </Badge>
                  )}
                </span>
                <Button 
                  size="sm" 
                  onClick={generateAnalysis}
                  disabled={isAnalyzing || queryItem.status === 'gap'}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : hasAnalysis ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Regenerate
                    </>
                  ) : (
                    'Generate Analysis'
                  )}
                </Button>
              </CardTitle>
              <CardDescription>
                What should this chunk become to best answer the query?
              </CardDescription>
            </CardHeader>
            <CardContent>
              {optState.error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{optState.error}</AlertDescription>
                </Alert>
              )}
              
              {isAnalyzing ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
                  <p className="text-sm">Generating analysis...</p>
                </div>
              ) : hasAnalysis ? (
                <div className="space-y-3">
                  <Textarea 
                    className="min-h-[200px] font-mono text-sm"
                    value={optState.userEditedAnalysis ?? ''}
                    onChange={(e) => setUserAnalysis(e.target.value)}
                    placeholder="Edit the analysis as needed..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Edit this analysis to add your own context, data, or specific requirements before optimization.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">
                    {queryItem.status === 'gap' 
                      ? 'Analysis not available for content gaps'
                      : 'Click "Generate Analysis" to get optimization recommendations'}
                  </p>
                </div>
              )}
            </CardContent>
            
            {/* Proceed button - only show when analysis is ready */}
            {isStep1Complete && optState.userEditedAnalysis?.trim() && (
              <CardFooter className="border-t pt-4">
                <Button 
                  className="ml-auto"
                  onClick={runOptimization}
                  disabled={!optState.userEditedAnalysis?.trim() || isOptimizing}
                >
                  {isOptimizing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Optimizing...
                    </>
                  ) : hasOptimizedContent ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Re-optimize
                    </>
                  ) : (
                    <>
                      Run Optimization
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* Step 2: Optimized Content */}
          <Card className={cn(
            (optState.step === 'idle' || optState.step === 'analyzing' || optState.step === 'analysis_ready') && !hasOptimizedContent 
              && 'opacity-50 pointer-events-none'
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  Step 2: Optimized Content
                  {isStep2Complete && (
                    <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                      Complete
                    </Badge>
                  )}
                </CardTitle>
                {isStep2Complete && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleRescore}
                    disabled={optState.step === 'scoring'}
                  >
                    {optState.step === 'scoring' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Scoring...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Re-score
                      </>
                    )}
                  </Button>
                )}
              </div>
              <CardDescription>
                {isOptimizing 
                  ? 'Generating optimized content...'
                  : isStep2Complete
                  ? 'Review and edit the optimized content below'
                  : 'Complete Step 1 first'}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {isOptimizing ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  <span className="ml-3 text-muted-foreground">Generating optimized content...</span>
                </div>
              ) : hasOptimizedContent ? (
                <div className="space-y-4">
                  {/* Original vs Optimized comparison toggle */}
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      variant={showOriginal ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowOriginal(true)}
                    >
                      Original
                    </Button>
                    <Button
                      variant={!showOriginal ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowOriginal(false)}
                    >
                      Optimized
                    </Button>
                  </div>

                  {showOriginal ? (
                    <div className="p-4 bg-muted rounded-lg text-sm">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Original Content</p>
                      <div className="whitespace-pre-wrap">{chunk?.text}</div>
                    </div>
                  ) : (
                    <Textarea 
                      className="min-h-[250px] text-sm"
                      value={optState.userEditedContent || ''}
                      onChange={(e) => setUserContent(e.target.value)}
                      placeholder="Optimized content will appear here..."
                    />
                  )}

                  {/* Word count comparison */}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Original: {chunk?.text.split(/\s+/).length || 0} words</span>
                    <span>Optimized: {optState.userEditedContent?.split(/\s+/).length || 0} words</span>
                    <span>
                      {(() => {
                        const origLen = chunk?.text.split(/\s+/).length || 1;
                        const newLen = optState.userEditedContent?.split(/\s+/).length || 0;
                        const diff = Math.round(((newLen - origLen) / origLen) * 100);
                        return diff >= 0 ? `+${diff}%` : `${diff}%`;
                      })()}
                    </span>
                  </div>

                  {/* Show rescored results if available */}
                  {optState.lastScoredResults && (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-3">Updated Scores</p>
                      <div className="grid grid-cols-4 gap-3">
                        <ScoreCompare 
                          label="Passage" 
                          before={queryItem.originalScores?.passageScore ?? 0}
                          after={optState.lastScoredResults.passageScore}
                        />
                        <ScoreCompare 
                          label="Semantic" 
                          before={(queryItem.originalScores?.semanticSimilarity ?? 0) * 100}
                          after={optState.lastScoredResults.semanticSimilarity * 100}
                        />
                        <ScoreCompare 
                          label="Lexical" 
                          before={(queryItem.originalScores?.lexicalScore ?? 0) * 100}
                          after={optState.lastScoredResults.lexicalScore * 100}
                        />
                        <ScoreCompare 
                          label="Entity" 
                          before={(queryItem.originalScores?.entityOverlap ?? 0) * 100}
                          after={optState.lastScoredResults.entityOverlap * 100}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileEdit className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Complete analysis in Step 1, then run optimization</p>
                </div>
              )}
            </CardContent>
            
            {isStep2Complete && (
              <CardFooter className="border-t pt-4 flex justify-between">
                <p className="text-xs text-muted-foreground">
                  Edit the content as needed, then proceed to review
                </p>
                <Button disabled={!optState.userEditedContent?.trim()}>
                  Continue to Review
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* Step 3: Review & Approve */}
          <Card className={cn(!isStep2Complete && 'opacity-50')}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Step 3: Review & Approve
                {isStep2Complete && (
                  <Badge variant="outline" className="text-xs">Ready</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isStep2Complete 
                  ? 'Review changes and approve to apply to your content'
                  : 'Waiting for Step 2...'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Review the optimized content and approve or reject the changes.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" disabled={!isStep2Complete} className="flex-1">
                  Reject
                </Button>
                <Button disabled={!isStep2Complete} className="flex-1">
                  Approve Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default QueryWorkingPanel;
