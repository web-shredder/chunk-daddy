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
  BarChart3,
  CheckCircle2,
  Plus
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getTierFromScore, TIER_COLORS, getTierLabel } from '@/lib/tier-colors';
import { useQueryOptimization } from '@/hooks/useQueryOptimization';
import { WorkingPanelEditor, MarkdownPreview } from '@/components/moonbug/WorkingPanelEditor';
import { ScoreTooltip } from '@/components/moonbug/ScoreTooltip';
import { ScoreInfoDialog } from '@/components/moonbug/ScoreInfoDialog';
import { SCORE_DEFINITIONS, ScoreKey } from '@/constants/scoreDefinitions';
import { extractMissingConcepts } from '@/utils/coverageHelpers';
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

function ScoreBox({ label, value, scoreKey }: { label: string; value: number; scoreKey: ScoreKey }) {
  const tier = getTierFromScore(value);
  const tierColors = TIER_COLORS[tier];
  const tierLabel = getTierLabel(value);
  const definition = SCORE_DEFINITIONS[scoreKey];
  
  return (
    <div className="relative text-center p-3 bg-muted rounded-lg group">
      <div className={cn('text-2xl font-bold', tierColors.text)}>
        {Math.round(value)}
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
        <ScoreTooltip scoreKey={scoreKey} showIcon={false}>
          {label}
        </ScoreTooltip>
      </div>
      <div className={cn('text-xs font-medium mt-0.5', tierColors.text)}>
        {tierLabel}
      </div>
      {/* Info button in corner */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <ScoreInfoDialog scoreKey={scoreKey} />
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

function ScoreRow({ 
  label, 
  value, 
  suffix = '',
  scoreKey 
}: { 
  label: string; 
  value: number; 
  suffix?: string;
  scoreKey: ScoreKey;
}) {
  return (
    <div className="flex justify-between text-sm items-center">
      <ScoreTooltip scoreKey={scoreKey}>
        <span className="text-muted-foreground">{label}</span>
      </ScoreTooltip>
      <span className="flex items-center gap-1.5">
        {Math.round(value)}{suffix}
        <ScoreInfoDialog scoreKey={scoreKey} />
      </span>
    </div>
  );
}

function ScoreRowCompare({ 
  label, 
  before, 
  after, 
  suffix = '',
  scoreKey
}: { 
  label: string; 
  before: number; 
  after: number; 
  suffix?: string;
  scoreKey: ScoreKey;
}) {
  const diff = after - before;
  const isImproved = diff > 0;
  const isDeclined = diff < 0;
  
  return (
    <div className="flex justify-between text-sm items-center">
      <ScoreTooltip scoreKey={scoreKey}>
        <span className="text-muted-foreground">{label}</span>
      </ScoreTooltip>
      <span className="flex items-center gap-2">
        <span className="font-medium">{Math.round(after)}{suffix}</span>
        <span className={cn(
          'text-xs',
          isImproved ? 'text-success' : isDeclined ? 'text-destructive' : 'text-muted-foreground'
        )}>
          {isImproved ? '+' : ''}{Math.round(diff)}{suffix}
        </span>
        <ScoreInfoDialog scoreKey={scoreKey} />
      </span>
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
    setUserContent,
    rescoreContent,
    approveOptimization
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

  // Handle approve button click
  const handleApprove = useCallback(() => {
    const result = approveOptimization();
    
    // Update the query item in parent state
    onUpdate({
      status: 'optimized',
      isApproved: true,
      approvedText: result.approvedText,
      currentScores: result.finalScores
    });
    
    // Call the onApprove callback
    if (result.approvedText) {
      onApprove(result.approvedText);
    }
    
    // Close panel after short delay to show success state
    setTimeout(() => {
      onClose();
    }, 1500);
  }, [approveOptimization, onUpdate, onApprove, onClose]);

  if (!queryItem) {
    return null;
  }

  const intentStyle = INTENT_TYPE_STYLES[queryItem.intentType] || INTENT_TYPE_STYLES.PRIMARY;
  const chunkWordCount = chunk?.text.split(/\s+/).length ?? 0;
  const chunkTokenCount = chunk ? Math.ceil(chunk.text.length / 4) : 0;
  const chunkHeading = chunk?.headingPath?.slice(-1)[0] || 'Untitled Section';
  const chunkHeadingPath = chunk?.headingPath ?? [];
  
  // Detect if this is a gap query
  const isGapQuery = queryItem.status === 'gap' || !chunk;
  const missingConcepts = isGapQuery ? extractMissingConcepts(queryItem.query) : [];
  
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
          {!isGapQuery && chunk && (
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

          {/* Content Gap Notice (for gap queries) */}
          {isGapQuery && (
            <Card className="border-warning/50 bg-warning/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  Content Gap Detected
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No existing content adequately addresses this query. You'll create a new section to fill this gap.
                </p>
                
                {/* Show best partial match if one exists */}
                {queryItem.originalScores && (
                  <div className="p-3 bg-background rounded border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Best Partial Match</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        Score: <span className="font-medium">{Math.round(queryItem.originalScores.passageScore)}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        (Threshold: 45)
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Missing concepts analysis */}
                {missingConcepts.length > 0 && (
                  <div className="p-3 bg-background rounded border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Key Concepts to Address</p>
                    <div className="flex flex-wrap gap-1">
                      {missingConcepts.map((concept, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {concept}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Suggested placement info if available */}
                {queryItem.suggestedPlacement && (
                  <div className="p-3 bg-background rounded border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Suggested Placement</p>
                    <p className="text-sm">{queryItem.suggestedPlacement}</p>
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
                      scoreKey="passageScore"
                    />
                    <ScoreBox 
                      label="Semantic" 
                      value={(queryItem.originalScores.semanticSimilarity ?? 0) * 100}
                      scoreKey="semantic"
                    />
                    <ScoreBox 
                      label="Lexical" 
                      value={(queryItem.originalScores.lexicalScore ?? 0) * 100}
                      scoreKey="lexical"
                    />
                    <ScoreBox 
                      label="Citation" 
                      value={(queryItem.originalScores.citationScore ?? 0) * 100}
                      scoreKey="citationScore"
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

          {/* Step 1: Analysis Prompt / Content Brief */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {isGapQuery ? 'Step 1: Content Brief' : 'Step 1: Analysis Prompt'}
                  {isStep1Complete && (
                    <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                      Complete
                    </Badge>
                  )}
                </span>
                <Button 
                  size="sm" 
                  onClick={generateAnalysis}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isGapQuery ? 'Generating Brief...' : 'Analyzing...'}
                    </>
                  ) : hasAnalysis ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Regenerate
                    </>
                  ) : (
                    <>
                      {isGapQuery && <Plus className="w-4 h-4 mr-2" />}
                      {isGapQuery ? 'Generate Brief' : 'Generate Analysis'}
                    </>
                  )}
                </Button>
              </CardTitle>
              <CardDescription>
                {isGapQuery 
                  ? 'Define what new content should be created to answer this query'
                  : 'What should this chunk become to best answer the query?'}
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
                  <p className="text-sm">{isGapQuery ? 'Generating content brief...' : 'Generating analysis...'}</p>
                </div>
              ) : hasAnalysis ? (
                <div className="space-y-3">
                  <WorkingPanelEditor
                    value={optState.userEditedAnalysis ?? ''}
                    onChange={setUserAnalysis}
                    placeholder={isGapQuery 
                      ? "Edit the content brief as needed..." 
                      : "Edit the analysis as needed..."}
                    minHeight="200px"
                    maxHeight="400px"
                  />
                  <p className="text-xs text-muted-foreground">
                    {isGapQuery 
                      ? 'Edit this brief to add your own context, data, or specific requirements before generating content.'
                      : 'Edit this analysis to add your own context, data, or specific requirements before optimization.'}
                  </p>
                </div>
              ) : (
                <div className="border rounded-md border-dashed bg-muted/20 p-8 min-h-[200px] flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">
                      {isGapQuery 
                        ? 'Click "Generate Brief" to get content recommendations'
                        : 'Click "Generate Analysis" to get optimization recommendations'}
                    </p>
                  </div>
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
                      {isGapQuery ? 'Generating...' : 'Optimizing...'}
                    </>
                  ) : hasOptimizedContent ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {isGapQuery ? 'Regenerate Content' : 'Re-optimize'}
                    </>
                  ) : (
                    <>
                      {isGapQuery ? 'Generate Content' : 'Run Optimization'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* Step 2: Optimized/New Content */}
          <Card className={cn(
            (optState.step === 'idle' || optState.step === 'analyzing' || optState.step === 'analysis_ready') && !hasOptimizedContent 
              && 'opacity-50 pointer-events-none'
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {isGapQuery ? 'Step 2: New Content' : 'Step 2: Optimized Content'}
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
                    onClick={rescoreContent}
                    disabled={optState.step === 'scoring' || !optState.userEditedContent?.trim()}
                  >
                    {optState.step === 'scoring' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Scoring...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        {optState.lastScoredResults ? 'Re-score' : 'Score Content'}
                      </>
                    )}
                  </Button>
                )}
              </div>
              <CardDescription>
                {isOptimizing 
                  ? (isGapQuery ? 'Generating new content...' : 'Generating optimized content...')
                  : isStep2Complete
                  ? (isGapQuery ? 'Review and edit the generated content below' : 'Review and edit the optimized content below')
                  : 'Complete Step 1 first'}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {isOptimizing ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  <span className="ml-3 text-muted-foreground">
                    {isGapQuery ? 'Generating new content...' : 'Generating optimized content...'}
                  </span>
                </div>
              ) : hasOptimizedContent ? (
                <div className="space-y-4">
                  {/* Original vs Optimized comparison toggle - only for non-gap queries */}
                  {!isGapQuery && (
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
                  )}

                  {!isGapQuery && showOriginal ? (
                    <MarkdownPreview
                      content={chunk?.text || ''}
                      label="Original Content"
                    />
                  ) : (
                    <WorkingPanelEditor
                      value={optState.userEditedContent || ''}
                      onChange={setUserContent}
                      placeholder={isGapQuery 
                        ? "New content will appear here..." 
                        : "Optimized content will appear here..."}
                      minHeight="250px"
                      maxHeight="500px"
                    />
                  )}

                  {/* Word count - different display for gaps */}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    {isGapQuery ? (
                      <>
                        <span>Word count: {optState.userEditedContent?.split(/\s+/).length || 0}</span>
                        <span>Recommended: 300-600 words</span>
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>

                  {/* Show rescored results if available */}
                  {optState.lastScoredResults && (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-3">
                        {isGapQuery ? 'Content Scores' : 'Updated Scores'}
                      </p>
                      {isGapQuery ? (
                        // For gaps, just show the new scores (no comparison)
                        <div className="grid grid-cols-4 gap-3">
                          <ScoreBox label="Passage" value={optState.lastScoredResults.passageScore} scoreKey="passageScore" />
                          <ScoreBox label="Semantic" value={optState.lastScoredResults.semanticSimilarity * 100} scoreKey="semantic" />
                          <ScoreBox label="Lexical" value={optState.lastScoredResults.lexicalScore * 100} scoreKey="lexical" />
                          <ScoreBox label="Entity" value={(optState.lastScoredResults.entityOverlap ?? 0) * 100} scoreKey="entityOverlap" />
                        </div>
                      ) : (
                        // For optimizations, show comparison
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
                            after={(optState.lastScoredResults.entityOverlap ?? 0) * 100}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileEdit className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">
                    {isGapQuery 
                      ? 'Complete the brief in Step 1, then generate content'
                      : 'Complete analysis in Step 1, then run optimization'}
                  </p>
                </div>
              )}
            </CardContent>
            
            {isStep2Complete && (
              <CardFooter className="border-t pt-4 flex justify-between">
                <p className="text-xs text-muted-foreground">
                  {isGapQuery 
                    ? 'Edit the content as needed, then proceed to review'
                    : 'Edit the content as needed, then proceed to review'}
                </p>
                <Button disabled={!optState.userEditedContent?.trim()}>
                  Continue to Review
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* Step 3: Review & Approve */}
          <Card className={cn(
            optState.step !== 'optimization_ready' && optState.step !== 'approved' && optState.step !== 'scoring'
              ? 'opacity-50 pointer-events-none' 
              : ''
          )}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                Step 3: Review & Approve
                {optState.step === 'approved' && (
                  <Badge className="bg-success text-success-foreground">Approved</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {optState.step === 'approved'
                  ? (isGapQuery ? 'This new content has been approved' : 'This optimization has been approved')
                  : optState.lastScoredResults
                  ? 'Review the scores and approve when ready'
                  : (isGapQuery ? 'Score your new content before approving' : 'Score your changes to see the improvement before approving')}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {optState.step === 'approved' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-success/10 border border-success/30 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0" />
                    <div>
                      <p className="font-medium text-success">
                        {isGapQuery ? 'New Content Approved' : 'Optimization Approved'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {isGapQuery 
                          ? 'This new section is ready for export in the Downloads tab.'
                          : 'This content is ready for export in the Downloads tab.'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Final score summary - different for gaps vs optimizations */}
                  {optState.lastScoredResults && (
                    isGapQuery ? (
                      // Gap: show single score card
                      <div className="p-4 bg-success/10 border border-success/30 rounded-lg">
                        <p className="text-xs text-success uppercase tracking-wide mb-1">Content Score</p>
                        <p className="text-3xl font-bold text-success">
                          {optState.lastScoredResults.passageScore}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          New content created to fill gap
                        </p>
                      </div>
                    ) : (
                      // Optimization: show before/after comparison
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Original Score</p>
                          <p className="text-3xl font-bold">{queryItem.originalScores?.passageScore ?? 0}</p>
                        </div>
                        <div className="p-4 bg-success/10 border border-success/30 rounded-lg">
                          <p className="text-xs text-success uppercase tracking-wide mb-1">Final Score</p>
                          <p className="text-3xl font-bold text-success">
                            {optState.lastScoredResults.passageScore}
                            <span className="text-lg ml-2">
                              (+{optState.lastScoredResults.passageScore - (queryItem.originalScores?.passageScore ?? 0)})
                            </span>
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : optState.lastScoredResults ? (
                <div className="space-y-4">
                  {isGapQuery ? (
                    // For gaps: show single column of scores
                    <div>
                      <p className="text-sm font-medium mb-3">Content Scores</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <ScoreRow label="Passage Score" value={optState.lastScoredResults.passageScore} scoreKey="passageScore" />
                          <ScoreRow label="Semantic" value={optState.lastScoredResults.semanticSimilarity * 100} scoreKey="semantic" />
                          <ScoreRow label="Lexical" value={optState.lastScoredResults.lexicalScore * 100} scoreKey="lexical" />
                        </div>
                        <div className="space-y-2">
                          <ScoreRow label="Rerank" value={optState.lastScoredResults.rerankScore ?? 0} scoreKey="rerankScore" />
                          <ScoreRow label="Citation" value={optState.lastScoredResults.citationScore ?? 0} scoreKey="citationScore" />
                          <ScoreRow label="Entity Overlap" value={(optState.lastScoredResults.entityOverlap ?? 0) * 100} suffix="%" scoreKey="entityOverlap" />
                        </div>
                      </div>
                      
                      {/* Score quality callout for gaps */}
                      <div className={cn(
                        'p-4 rounded-lg border mt-4',
                        optState.lastScoredResults.passageScore >= 70
                          ? 'bg-success/10 border-success/30'
                          : optState.lastScoredResults.passageScore >= 45
                          ? 'bg-warning/10 border-warning/30'
                          : 'bg-destructive/10 border-destructive/30'
                      )}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {optState.lastScoredResults.passageScore >= 70
                                ? 'Strong Content'
                                : optState.lastScoredResults.passageScore >= 45
                                ? 'Adequate Coverage'
                                : 'Needs Improvement'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {optState.lastScoredResults.passageScore >= 70
                                ? 'This content should rank well for this query'
                                : optState.lastScoredResults.passageScore >= 45
                                ? 'Consider improving to increase ranking potential'
                                : 'Edit and re-score to improve coverage'}
                            </p>
                          </div>
                          <div className={cn(
                            'text-3xl font-bold',
                            optState.lastScoredResults.passageScore >= 70
                              ? 'text-success'
                              : optState.lastScoredResults.passageScore >= 45
                              ? 'text-warning'
                              : 'text-destructive'
                          )}>
                            {optState.lastScoredResults.passageScore}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // For optimizations: show before/after comparison grid
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium mb-3">Before Optimization</p>
                          <div className="space-y-2">
                            <ScoreRow label="Passage Score" value={queryItem.originalScores?.passageScore ?? 0} scoreKey="passageScore" />
                            <ScoreRow label="Semantic" value={(queryItem.originalScores?.semanticSimilarity ?? 0) * 100} scoreKey="semantic" />
                            <ScoreRow label="Lexical" value={(queryItem.originalScores?.lexicalScore ?? 0) * 100} scoreKey="lexical" />
                            <ScoreRow label="Rerank" value={queryItem.originalScores?.rerankScore ?? 0} scoreKey="rerankScore" />
                            <ScoreRow label="Citation" value={queryItem.originalScores?.citationScore ?? 0} scoreKey="citationScore" />
                            <ScoreRow label="Entity Overlap" value={(queryItem.originalScores?.entityOverlap ?? 0) * 100} suffix="%" scoreKey="entityOverlap" />
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-3">After Optimization</p>
                          <div className="space-y-2">
                            <ScoreRowCompare 
                              label="Passage Score" 
                              before={queryItem.originalScores?.passageScore ?? 0}
                              after={optState.lastScoredResults.passageScore}
                              scoreKey="passageScore"
                            />
                            <ScoreRowCompare 
                              label="Semantic" 
                              before={(queryItem.originalScores?.semanticSimilarity ?? 0) * 100}
                              after={optState.lastScoredResults.semanticSimilarity * 100}
                              scoreKey="semantic"
                            />
                            <ScoreRowCompare 
                              label="Lexical" 
                              before={(queryItem.originalScores?.lexicalScore ?? 0) * 100}
                              after={optState.lastScoredResults.lexicalScore * 100}
                              scoreKey="lexical"
                            />
                            <ScoreRowCompare 
                              label="Rerank" 
                              before={queryItem.originalScores?.rerankScore ?? 0}
                              after={optState.lastScoredResults.rerankScore ?? 0}
                              scoreKey="rerankScore"
                            />
                            <ScoreRowCompare 
                              label="Citation" 
                              before={queryItem.originalScores?.citationScore ?? 0}
                              after={optState.lastScoredResults.citationScore ?? 0}
                              scoreKey="citationScore"
                            />
                            <ScoreRowCompare 
                              label="Entity Overlap" 
                              before={(queryItem.originalScores?.entityOverlap ?? 0) * 100}
                              after={(optState.lastScoredResults.entityOverlap ?? 0) * 100}
                              suffix="%"
                              scoreKey="entityOverlap"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Overall improvement callout - only for non-gap queries */}
                  {!isGapQuery && (
                    <>
                      <div className={cn(
                        'p-4 rounded-lg border',
                        optState.lastScoredResults.passageScore > (queryItem.originalScores?.passageScore ?? 0)
                          ? 'bg-success/10 border-success/30'
                          : 'bg-warning/10 border-warning/30'
                      )}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {optState.lastScoredResults.passageScore > (queryItem.originalScores?.passageScore ?? 0)
                                ? 'Score Improved'
                                : 'Score Needs Work'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {queryItem.originalScores?.passageScore ?? 0} → {optState.lastScoredResults.passageScore}
                            </p>
                          </div>
                          <div className={cn(
                            'text-3xl font-bold',
                            optState.lastScoredResults.passageScore > (queryItem.originalScores?.passageScore ?? 0)
                              ? 'text-success'
                              : 'text-warning'
                          )}>
                            {optState.lastScoredResults.passageScore - (queryItem.originalScores?.passageScore ?? 0) > 0 ? '+' : ''}
                            {optState.lastScoredResults.passageScore - (queryItem.originalScores?.passageScore ?? 0)}
                          </div>
                        </div>
                      </div>

                      {/* Warning if score declined */}
                      {optState.lastScoredResults.passageScore < (queryItem.originalScores?.passageScore ?? 0) && (
                        <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-warning">Score declined</p>
                            <p className="text-muted-foreground">
                              Consider editing the content in Step 2 and re-scoring, or regenerate with different analysis instructions.
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">
                    {isGapQuery 
                      ? 'Score your new content before approving'
                      : 'Score your optimized content to see the improvement'}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={rescoreContent}
                    disabled={!optState.userEditedContent?.trim()}
                  >
                    {isGapQuery ? 'Score Content' : 'Score Changes'}
                  </Button>
                </div>
              )}
            </CardContent>
            
            {optState.step === 'optimization_ready' && optState.lastScoredResults && (
              <CardFooter className="border-t pt-4 flex justify-between">
                <Button 
                  variant="outline"
                  onClick={() => setShowOriginal(false)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Edit Content
                </Button>
                <Button 
                  onClick={handleApprove}
                  className="bg-success hover:bg-success/90 text-success-foreground"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve & Close
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default QueryWorkingPanel;
