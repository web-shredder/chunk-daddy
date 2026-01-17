import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Check, 
  X, 
  Edit3, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Copy,
  Download,
  Star,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { ValidatedChunk, ChangeExplanation, FullScoreMetrics } from '@/lib/optimizer-types';
import { QueryAssignmentMap, formatScorePercent, getScoreColorClass } from '@/lib/query-assignment';
import { getPassageScoreTier, getPassageScoreTierColorClass } from '@/lib/similarity';
import { toast } from 'sonner';
import { cn, stripLeadingHeadingCascade } from '@/lib/utils';

interface ChunkReviewPanelProps {
  chunks: ValidatedChunk[];
  explanations: ChangeExplanation[];
  originalContent: string;
  queryAssignments: QueryAssignmentMap;
  onAccept: (chunkIndex: number) => void;
  onReject: (chunkIndex: number) => void;
  onEdit: (chunkIndex: number, newText: string) => void;
  onApplyAll: () => void;
  onExport: () => void;
  acceptedChunks: Set<number>;
  rejectedChunks: Set<number>;
  editedChunks: Map<number, string>;
  originalFullScores?: Record<number, Record<string, FullScoreMetrics>>;
  optimizedFullScores?: Record<number, Record<string, FullScoreMetrics>>;
}

export function ChunkReviewPanel({
  chunks,
  explanations,
  originalContent,
  queryAssignments,
  onAccept,
  onReject,
  onEdit,
  onApplyAll,
  onExport,
  acceptedChunks,
  rejectedChunks,
  editedChunks,
  originalFullScores,
  optimizedFullScores,
}: ChunkReviewPanelProps) {
  const [selectedChunkIndex, setSelectedChunkIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const selectedChunk = chunks[selectedChunkIndex];
  const chunkAssignment = queryAssignments.chunkAssignments.find(
    ca => ca.chunkIndex === selectedChunkIndex
  );

  const isAccepted = acceptedChunks.has(selectedChunkIndex);
  const isRejected = rejectedChunks.has(selectedChunkIndex);
  const hasEdit = editedChunks.has(selectedChunkIndex);

  const chunkStatus = useMemo(() => {
    if (isRejected) return 'rejected';
    if (hasEdit) return 'edited';
    if (isAccepted) return 'accepted';
    return 'pending';
  }, [isAccepted, isRejected, hasEdit]);

  const handleStartEdit = () => {
    const currentText = editedChunks.get(selectedChunkIndex) || selectedChunk?.optimized_text || '';
    setEditText(currentText);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onEdit(selectedChunkIndex, editText);
    setIsEditing(false);
    toast.success('Chunk edited');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText('');
  };

  const handleCopyChunk = () => {
    const text = hasEdit 
      ? editedChunks.get(selectedChunkIndex) 
      : isRejected 
        ? selectedChunk?.original_text 
        : selectedChunk?.optimized_text;
    navigator.clipboard.writeText(text || '');
    toast.success('Copied to clipboard');
  };

  const navigateChunk = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && selectedChunkIndex > 0) {
      setSelectedChunkIndex(selectedChunkIndex - 1);
    } else if (direction === 'next' && selectedChunkIndex < chunks.length - 1) {
      setSelectedChunkIndex(selectedChunkIndex + 1);
    }
    setIsEditing(false);
  };

  // Calculate improvement for this chunk
  const chunkImprovement = useMemo(() => {
    if (!selectedChunk?.scores) return null;
    
    const scores = Object.values(selectedChunk.scores);
    if (scores.length === 0) return null;
    
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    return avgScore;
  }, [selectedChunk]);

  // Stats summary
  const stats = useMemo(() => {
    const pending = chunks.length - acceptedChunks.size - rejectedChunks.size;
    return { 
      accepted: acceptedChunks.size, 
      rejected: rejectedChunks.size,
      edited: editedChunks.size,
      pending 
    };
  }, [chunks.length, acceptedChunks.size, rejectedChunks.size, editedChunks.size]);

  if (!selectedChunk) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No chunks to review.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with stats and actions */}
      <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Review Optimized Chunks</h3>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              {stats.accepted} accepted
            </Badge>
            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
              {stats.rejected} rejected
            </Badge>
            {stats.edited > 0 && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                {stats.edited} edited
              </Badge>
            )}
            <Badge variant="outline" className="bg-muted text-muted-foreground">
              {stats.pending} pending
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button 
            size="sm" 
            onClick={onApplyAll}
            disabled={stats.pending > 0}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            Apply Changes
          </Button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Chunk list sidebar */}
        <div className="w-48 shrink-0">
          <ScrollArea className="h-full">
            <div className="space-y-1 pr-2">
              {chunks.map((chunk, idx) => {
                const isSelected = idx === selectedChunkIndex;
                const status = rejectedChunks.has(idx) 
                  ? 'rejected' 
                  : editedChunks.has(idx) 
                    ? 'edited' 
                    : acceptedChunks.has(idx) 
                      ? 'accepted' 
                      : 'pending';
                
                const assignment = queryAssignments.chunkAssignments.find(ca => ca.chunkIndex === idx);
                const hasPrimary = assignment?.assignedQuery?.isPrimary;

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedChunkIndex(idx);
                      setIsEditing(false);
                    }}
                    className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                      isSelected 
                        ? 'bg-primary/10 border border-primary/30' 
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium flex items-center gap-1">
                        {hasPrimary && <Star className="h-3 w-3 text-yellow-500" />}
                        Chunk {idx + 1}
                      </span>
                      <StatusIndicator status={status} />
                    </div>
                    {assignment?.assignedQuery && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {assignment.assignedQuery.query}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chunk header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateChunk('prev')}
                  disabled={selectedChunkIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium">
                  Chunk {selectedChunkIndex + 1} of {chunks.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateChunk('next')}
                  disabled={selectedChunkIndex === chunks.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              {selectedChunk.heading && (
                <span className="text-muted-foreground">— {selectedChunk.heading}</span>
              )}
            </div>

            {/* Chunk actions */}
            <div className="flex items-center gap-2">
              <Button
                variant={chunkStatus === 'accepted' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onAccept(selectedChunkIndex)}
                className="gap-1"
              >
                <Check className="h-4 w-4" />
                Accept
              </Button>
              <Button
                variant={chunkStatus === 'rejected' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => onReject(selectedChunkIndex)}
                className="gap-1"
              >
                <X className="h-4 w-4" />
                Reject
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartEdit}
                className="gap-1"
              >
                <Edit3 className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyChunk}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Query Scores Panel */}
          {chunkAssignment?.assignedQuery && (
            <ScoresPanel
              chunkIndex={selectedChunkIndex}
              assignedQuery={chunkAssignment.assignedQuery}
              originalFullScores={originalFullScores}
              optimizedFullScores={optimizedFullScores}
            />
          )}

          {/* Content area */}
          <Tabs defaultValue="comparison" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mb-3">
              <TabsTrigger value="comparison">Before / After</TabsTrigger>
              <TabsTrigger value="changes">Changes ({selectedChunk.changes_applied.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="comparison" className="flex-1 min-h-0 mt-0">
              {isEditing ? (
                <div className="h-full flex flex-col gap-3">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="flex-1 resize-none font-mono text-sm"
                    placeholder="Edit the optimized content..."
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveEdit}>
                      Save Edit
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 h-full">
                  <Card className="flex flex-col">
                    <CardHeader className="py-2 px-3 border-b">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Original
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 flex-1 overflow-auto">
                      <ScrollArea className="h-full">
                        <p className="text-sm whitespace-pre-wrap">{stripLeadingHeadingCascade(selectedChunk.original_text)}</p>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card className={`flex flex-col ${
                    chunkStatus === 'rejected' ? 'opacity-50' : ''
                  }`}>
                    <CardHeader className="py-2 px-3 border-b flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {hasEdit ? 'Edited' : 'Optimized'}
                        {chunkStatus !== 'pending' && (
                          <StatusIndicator status={chunkStatus} />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 flex-1 overflow-auto">
                      <ScrollArea className="h-full">
                        <p className="text-sm whitespace-pre-wrap">
                          {hasEdit 
                            ? editedChunks.get(selectedChunkIndex) 
                            : selectedChunk.optimized_text}
                        </p>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="changes" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="space-y-3 pr-4">
                  {selectedChunk.changes_applied.map((change, idx) => {
                    const explanation = explanations.find(e => e.change_id === change.change_id);
                    
                    return (
                      <Card key={change.change_id} className="bg-muted/30">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <Badge variant="outline" className="text-xs mb-2">
                                {change.change_type.replace('_', ' ')}
                              </Badge>
                              <h4 className="font-medium text-sm">
                                {explanation?.title || `Change ${idx + 1}`}
                              </h4>
                            </div>
                            {change.actual_scores && (
                              <ImprovementBadge pct={change.actual_scores.improvement_pct} />
                            )}
                          </div>
                          
                          <p className="text-sm text-muted-foreground">
                            {explanation?.explanation || change.reason}
                          </p>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-2 bg-red-500/10 rounded border border-red-500/20">
                              <div className="text-red-400 mb-1">Before</div>
                              <div className="text-foreground line-clamp-3">{change.before}</div>
                            </div>
                            <div className="p-2 bg-green-500/10 rounded border border-green-500/20">
                              <div className="text-green-400 mb-1">After</div>
                              <div className="text-foreground line-clamp-3">{change.after}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {selectedChunk.changes_applied.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No changes were made to this chunk.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function StatusIndicator({ status }: { status: 'pending' | 'accepted' | 'rejected' | 'edited' }) {
  switch (status) {
    case 'accepted':
      return <Check className="h-4 w-4 text-green-500" />;
    case 'rejected':
      return <X className="h-4 w-4 text-red-500" />;
    case 'edited':
      return <Edit3 className="h-4 w-4 text-blue-500" />;
    default:
      return <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />;
  }
}

function ImprovementBadge({ pct }: { pct: number }) {
  if (pct > 0) {
    return (
      <Badge className="bg-green-500/20 text-green-500 border-green-500/30 gap-1">
        <ArrowUp className="h-3 w-3" />
        +{pct.toFixed(1)}%
      </Badge>
    );
  } else if (pct < 0) {
    return (
      <Badge className="bg-red-500/20 text-red-500 border-red-500/30 gap-1">
        <ArrowDown className="h-3 w-3" />
        {pct.toFixed(1)}%
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Minus className="h-3 w-3" />
      0%
    </Badge>
  );
}

// ScoresPanel component for showing before/after metrics
interface ScoresPanelProps {
  chunkIndex: number;
  assignedQuery: { query: string; score: number; isPrimary: boolean };
  originalFullScores?: Record<number, Record<string, FullScoreMetrics>>;
  optimizedFullScores?: Record<number, Record<string, FullScoreMetrics>>;
}

function ScoresPanel({
  chunkIndex,
  assignedQuery,
  originalFullScores,
  optimizedFullScores,
}: ScoresPanelProps) {
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);

  if (!originalFullScores || !optimizedFullScores) {
    // Fallback to simple display if full scores not available
    return (
      <div className="mb-4 p-3 bg-muted/30 rounded-lg">
        <div className="text-xs text-muted-foreground mb-2">Optimized for:</div>
        <div className="flex flex-wrap gap-2">
          <Badge 
            variant="secondary"
            className={cn(assignedQuery.isPrimary && 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30')}
          >
            {assignedQuery.isPrimary && <Star className="h-3 w-3 mr-1" />}
            {assignedQuery.query}
            <span className={cn('ml-2', getScoreColorClass(assignedQuery.score))}>
              {formatScorePercent(assignedQuery.score)}
            </span>
          </Badge>
        </div>
      </div>
    );
  }

  const chunkOriginal = originalFullScores[chunkIndex] || {};
  const chunkOptimized = optimizedFullScores[chunkIndex] || {};

  const qa = assignedQuery;
  const original = chunkOriginal[qa.query] || { cosine: 0, chamfer: 0, passageScore: 0 };
  const optimized = chunkOptimized[qa.query] || { cosine: 0, chamfer: 0, passageScore: 0 };
  
  const passageChange = optimized.passageScore - original.passageScore;
  const passageChangePct = original.passageScore > 0 
    ? ((optimized.passageScore - original.passageScore) / original.passageScore) * 100 
    : 0;
  
  const isExpanded = expandedQuery === qa.query;
  const originalTier = getPassageScoreTier(original.passageScore);
  const optimizedTier = getPassageScoreTier(optimized.passageScore);

  return (
    <div className="mb-4 p-4 bg-muted/30 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Query Scores</span>
        <span className="text-xs text-muted-foreground">Before → After</span>
      </div>
      
      <div className="space-y-2">
        <Collapsible
          open={isExpanded}
          onOpenChange={(open) => setExpandedQuery(open ? qa.query : null)}
        >
          <div className={cn(
            'rounded-md border transition-colors',
            qa.isPrimary ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border/50 bg-background/50'
          )}>
            {/* Main row - always visible */}
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-2.5 hover:bg-muted/30 rounded-md transition-colors">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {qa.isPrimary && <Star className="h-3 w-3 text-yellow-500 shrink-0" />}
                  <span className="text-sm font-medium truncate">{qa.query}</span>
                  <ChevronDown className={cn(
                    'h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0',
                    isExpanded && 'rotate-180'
                  )} />
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                  {/* Passage Score - hero metric */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{Math.round(original.passageScore)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className={cn('font-semibold', getPassageScoreTierColorClass(optimizedTier))}>
                      {Math.round(optimized.passageScore)}
                    </span>
                  </div>
                  
                  {/* Change indicator */}
                  <div className={cn(
                    'flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded',
                    passageChange > 0 && 'text-green-500 bg-green-500/10',
                    passageChange < 0 && 'text-red-500 bg-red-500/10',
                    passageChange === 0 && 'text-muted-foreground'
                  )}>
                    {passageChange > 0 && <ArrowUp className="h-3 w-3" />}
                    {passageChange < 0 && <ArrowDown className="h-3 w-3" />}
                    {passageChange === 0 && <Minus className="h-3 w-3" />}
                    <span>{passageChange > 0 ? '+' : ''}{passageChange.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>
            
            {/* Expanded details */}
            <CollapsibleContent>
              <div className="px-2.5 pb-2.5 pt-0 border-t border-border/30">
                <div className="grid grid-cols-3 gap-3 pt-2.5 text-xs">
                  {/* Passage Score detail */}
                  <div className="space-y-1">
                    <div className="text-muted-foreground font-medium">Passage Score</div>
                    <ScoreRow
                      before={original.passageScore}
                      after={optimized.passageScore}
                      format="integer"
                    />
                  </div>
                  
                  {/* Cosine detail */}
                  <div className="space-y-1">
                    <div className="text-muted-foreground font-medium">Cosine</div>
                    <ScoreRow
                      before={original.cosine}
                      after={optimized.cosine}
                      format="decimal"
                    />
                  </div>
                  
                  {/* Chamfer detail */}
                  <div className="space-y-1">
                    <div className="text-muted-foreground font-medium">Chamfer</div>
                    <ScoreRow
                      before={original.chamfer}
                      after={optimized.chamfer}
                      format="decimal"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </div>
    </div>
  );
}

// Helper for individual score rows in expanded view
function ScoreRow({ 
  before, 
  after, 
  format 
}: { 
  before: number; 
  after: number; 
  format: 'decimal' | 'integer' | 'percent';
}) {
  const change = after - before;
  const changePct = before > 0 ? ((after - before) / before) * 100 : 0;
  const improved = change > 0;
  const declined = change < 0;

  const formatValue = (val: number) => {
    if (format === 'integer') return Math.round(val).toString();
    if (format === 'percent') return `${(val * 100).toFixed(1)}%`;
    return val.toFixed(3);
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{formatValue(before)}</span>
      <span className="text-muted-foreground/50">→</span>
      <span className="font-medium">{formatValue(after)}</span>
      <span className={cn(
        'text-[10px]',
        improved && 'text-green-500',
        declined && 'text-red-500',
        !improved && !declined && 'text-muted-foreground'
      )}>
        {improved ? '+' : ''}{changePct.toFixed(1)}%
      </span>
    </div>
  );
}
