import { useState, useMemo } from 'react';
import { 
  ChevronRight, ChevronDown, ChevronUp, Copy, Edit, 
  AlertCircle, AlertTriangle, Info, CheckCircle2, 
  Zap, Calculator, Target, FileText, Lightbulb, 
  TrendingUp, Star, Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn, stripLeadingHeadingCascade } from '@/lib/utils';
import { calculatePassageScore } from '@/lib/similarity';
import { getTierFromScore, getTierLabel, TIER_COLORS } from '@/lib/tier-colors';
import { toast } from 'sonner';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';
import type { ChunkScore } from '@/hooks/useAnalysis';

interface PerQueryScore {
  passage: number;
  cosine: number;
  chamfer: number;
}

interface ChunkDetailsPanelProps {
  chunk: LayoutAwareChunk;
  chunkIndex: number;
  chunkScore?: ChunkScore;
  totalChunks: number;
  allQueries: string[];
  assignedQuery?: string;
  onEditContent?: () => void;
  onReassignQuery?: (newQuery: string) => void;
  perQueryScores?: Record<string, PerQueryScore>; // query -> detailed scores
}

// Strip markdown formatting
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function getScoreTierStyles(score: number) {
  const tier = getTierFromScore(score);
  const colors = TIER_COLORS[tier];
  return {
    label: getTierLabel(score),
    dotColor: `bg-[hsl(var(--tier-${tier}))]`,
    textColor: colors.text,
    bgLight: colors.bg,
    badge: colors.badge,
  };
}

function getTierDescription(score: number): string {
  if (score >= 90) return "Excellent retrieval probability — likely to appear in top 5 results";
  if (score >= 75) return "Good retrieval probability — competitive for top 10 results";
  if (score >= 60) return "Moderate retrieval probability — depends on competition";
  if (score >= 40) return "Weak retrieval probability — needs improvement";
  return "Poor retrieval probability — likely filtered out during retrieval";
}

// ============ SCORE OVERVIEW SECTION ============
function ScoreOverviewSection({ 
  score, 
  assignedQuery 
}: { 
  score: number; 
  assignedQuery?: string;
}) {
  const tier = getScoreTierStyles(score);
  
  return (
    <div className="p-4 space-y-4 min-w-0">
      {/* Large score display */}
      <div className="flex items-start gap-4">
        <div className="text-center shrink-0">
          <div className={cn("text-5xl font-bold font-mono", tier.textColor)}>
            {score}
          </div>
          <div className={cn("text-sm font-medium", tier.textColor)}>
            {tier.label}
          </div>
        </div>
        
        {/* Visual score indicator */}
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn("h-full transition-all duration-500", tier.dotColor)}
              style={{ width: `${score}%` }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Retrieval Probability
          </div>
        </div>
      </div>
      
      {/* Tier description */}
      <p className="text-sm text-muted-foreground">
        {getTierDescription(score)}
      </p>
      
      {/* Assigned query */}
      {assignedQuery && (
        <div className="flex flex-col gap-1 text-sm min-w-0">
          <span className="text-muted-foreground text-xs">Optimized for:</span>
          <div className="flex items-start gap-1.5 min-w-0">
            <Zap className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
            <span className="text-accent break-words">{stripMarkdown(assignedQuery)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ TECHNICAL SCORE SECTION ============
function TechnicalScoreSection({ 
  chunkScore,
  passageScore,
  assignedQuery
}: { 
  chunkScore: ChunkScore;
  passageScore: number;
  assignedQuery?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEducation, setShowEducation] = useState(false);
  
  // Find the assigned query's scores (case-insensitive), fallback to first keyword
  const assignedKeywordScore = chunkScore.keywordScores.find(
    ks => ks.keyword.toLowerCase() === assignedQuery?.toLowerCase()
  ) || chunkScore.keywordScores[0];
  
  const cosine = assignedKeywordScore.scores.cosine;
  const chamfer = assignedKeywordScore.scores.chamfer;
  
  const cosineContribution = cosine * 0.7;
  const chamferContribution = chamfer * 0.3;
  
  return (
    <div className="border-t border-border">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          Technical Score Breakdown
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 min-w-0">
          {/* Query indicator */}
          {assignedQuery && (
            <div className="text-[10px] text-muted-foreground break-words">
              Scores for: <span className="text-primary font-medium">{assignedQuery}</span>
            </div>
          )}
          
          {/* Formula */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Passage Score Formula:
            </div>
            <code className="text-xs font-mono text-foreground">
              (Cosine × 0.7) + (Chamfer × 0.3) × 100
            </code>
          </div>
          
          {/* Cosine Similarity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Cosine Similarity</div>
                <div className="text-[10px] text-muted-foreground">
                  Direct semantic relevance (70% weight)
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-semibold">
                  {cosine.toFixed(3)}
                </div>
                <div className="text-[10px] text-green-600 font-mono">
                  +{(cosineContribution * 100).toFixed(1)} pts
                </div>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${cosine * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Measures the angle between chunk and query vectors. Higher = better semantic match.
            </p>
          </div>
          
          {/* Chamfer Similarity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Chamfer Similarity</div>
                <div className="text-[10px] text-muted-foreground">
                  Multi-aspect coverage (30% weight)
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-semibold">
                  {chamfer.toFixed(3)}
                </div>
                <div className="text-[10px] text-green-600 font-mono">
                  +{(chamferContribution * 100).toFixed(1)} pts
                </div>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 transition-all"
                style={{ width: `${chamfer * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Measures bidirectional coverage between content and query aspects. Higher = better multi-facet addressing.
            </p>
          </div>
          
          {/* Final Calculation */}
          <div className="p-3 bg-muted/30 rounded-lg space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Final Score Calculation:
            </div>
            <div className="font-mono text-xs space-y-0.5">
              <div>({cosine.toFixed(3)} × 0.7) + ({chamfer.toFixed(3)} × 0.3)</div>
              <div>= {cosineContribution.toFixed(3)} + {chamferContribution.toFixed(3)}</div>
              <div>= {(cosineContribution + chamferContribution).toFixed(3)}</div>
              <div className="text-accent font-semibold">
                = {passageScore} / 100
              </div>
            </div>
          </div>
          
          {/* Per-Query Breakdown */}
          {chunkScore.keywordScores.length > 1 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Scores by Query:</div>
              <div className="space-y-1">
                {chunkScore.keywordScores.map((ks) => {
                  const queryPassageScore = calculatePassageScore(ks.scores.cosine, ks.scores.chamfer);
                  return (
                    <div 
                      key={ks.keyword}
                      className="p-2 bg-muted/30 rounded text-xs flex items-center justify-between gap-2"
                    >
                      <span className="truncate flex-1" title={ks.keyword}>
                        {stripMarkdown(ks.keyword)}
                      </span>
                      <span className="flex items-center gap-2 shrink-0 font-mono text-muted-foreground">
                        <span>C: {ks.scores.cosine.toFixed(2)}</span>
                        <span>Ch: {ks.scores.chamfer.toFixed(2)}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {queryPassageScore}
                        </Badge>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Educational Note */}
          <Collapsible open={showEducation} onOpenChange={setShowEducation}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Lightbulb className="h-3 w-3" />
              Why 70/30 weighting?
              {showEducation ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cosine (70%) handles direct relevance — the primary signal for retrieval. 
                Chamfer (30%) handles completeness — ensuring all query aspects are addressed. 
                A chunk might score high on cosine for one narrow aspect but miss other 
                important dimensions. Chamfer penalizes gaps in coverage.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}

// ============ DIAGNOSTIC SECTION ============
function DiagnosticSection({ 
  chunk, 
  passageScore,
  assignedQuery 
}: { 
  chunk: LayoutAwareChunk; 
  passageScore: number;
  assignedQuery?: string;
}) {
  const diagnosis = useMemo(() => {
    const issues: Array<{ type: 'error' | 'warning' | 'info'; message: string }> = [];
    
    if (passageScore < 60) {
      if (!assignedQuery) {
        issues.push({ 
          type: 'error', 
          message: 'No query assigned — chunk may be off-topic or unoptimizable' 
        });
      }
      
      const textLength = chunk.textWithoutCascade?.length || chunk.text.length;
      if (textLength < 200) {
        issues.push({ 
          type: 'warning', 
          message: 'Very short content (< 200 chars) — may lack sufficient detail for RAG systems' 
        });
      }
      
      if (!chunk.headingPath || chunk.headingPath.length === 0) {
        issues.push({ 
          type: 'warning', 
          message: 'No heading context — missing semantic structure signals' 
        });
      }
      
      // Pronoun analysis
      const bodyText = chunk.textWithoutCascade || stripLeadingHeadingCascade(chunk.text);
      const pronouns = (bodyText.match(/\b(this|that|it|they|these|those)\b/gi) || []);
      if (pronouns.length > 3) {
        issues.push({ 
          type: 'warning', 
          message: `High pronoun usage (${pronouns.length}) — reduces atomicity and self-containment` 
        });
      }
      
      // Query keyword coverage
      if (assignedQuery) {
        const queryWords = assignedQuery.toLowerCase().split(' ').filter(w => w.length > 3);
        const chunkLower = bodyText.toLowerCase();
        const missingWords = queryWords.filter(w => !chunkLower.includes(w));
        
        if (missingWords.length > 0) {
          issues.push({ 
            type: 'error', 
            message: `Query keywords not found: ${missingWords.slice(0, 3).join(', ')}${missingWords.length > 3 ? '...' : ''}` 
          });
        }
      }
      
      // Specificity check
      const hasNumbers = /\d+/.test(bodyText);
      const hasProperNouns = /[A-Z][a-z]+\s[A-Z][a-z]+/.test(bodyText);
      if (!hasNumbers && !hasProperNouns) {
        issues.push({ 
          type: 'info', 
          message: 'No specific data (numbers, names) — content may be too vague' 
        });
      }
    }
    
    return issues;
  }, [chunk, passageScore, assignedQuery]);
  
  return (
    <div className="p-4 border-t border-border space-y-3 min-w-0">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Target className="h-4 w-4 text-muted-foreground" />
        Diagnostic Analysis
      </h4>
      
      {diagnosis.length > 0 ? (
        <div className="space-y-2">
          {diagnosis.map((issue, i) => (
            <div 
              key={i}
              className="p-3 rounded-lg border border-border flex items-start gap-3 text-sm min-w-0"
            >
              {issue.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
              {issue.type === 'warning' && <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />}
              {issue.type === 'info' && <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />}
              <span className="text-foreground break-words">{issue.message}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          No obvious issues detected
        </div>
      )}
    </div>
  );
}

// ============ ACTIONS SECTION ============
function ActionsSection({ 
  chunk,
  onEditContent 
}: { 
  chunk: LayoutAwareChunk;
  onEditContent?: () => void;
}) {
  const handleCopy = () => {
    const bodyText = chunk.textWithoutCascade || stripLeadingHeadingCascade(chunk.text);
    navigator.clipboard.writeText(bodyText);
    toast.success('Content copied to clipboard');
  };
  
  return (
    <div className="p-4 border-t border-border space-y-3 min-w-0">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Zap className="h-4 w-4 text-muted-foreground" />
        Quick Actions
      </h4>
      
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={handleCopy}
        >
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          Copy
        </Button>
        {onEditContent && (
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={onEditContent}
          >
            <Edit className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
        )}
      </div>
    </div>
  );
}

// ============ RELATED QUERIES SECTION ============
function RelatedQueriesSection({ 
  currentScore,
  assignedQuery,
  allQueries,
  perQueryScores,
  onReassignQuery 
}: { 
  currentScore: number;
  assignedQuery?: string;
  allQueries: string[];
  perQueryScores?: Record<string, PerQueryScore>;
  onReassignQuery?: (query: string) => void;
}) {
  const [isReassigning, setIsReassigning] = useState<string | null>(null);
  
  // Calculate query similarities with deltas
  const querySimilarities = useMemo(() => {
    if (!perQueryScores || Object.keys(perQueryScores).length === 0) {
      return [];
    }
    
    return Object.entries(perQueryScores)
      .map(([query, scoreData]) => ({
        query,
        score: scoreData.passage,
        cosine: scoreData.cosine,
        chamfer: scoreData.chamfer,
        isCurrent: query.toLowerCase() === assignedQuery?.toLowerCase(),
        scoreDelta: scoreData.passage - currentScore,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [perQueryScores, assignedQuery, currentScore]);
  
  const handleReassign = async (query: string) => {
    if (!onReassignQuery) return;
    
    setIsReassigning(query);
    try {
      onReassignQuery(query);
      toast.success(`Reassigned to: "${query}"`);
    } finally {
      setIsReassigning(null);
    }
  };
  
  if (querySimilarities.length === 0) {
    return null;
  }
  
  const hasBetterMatch = querySimilarities.some(q => !q.isCurrent && q.scoreDelta > 10);
  
  return (
    <div className="p-4 border-t border-border space-y-3 min-w-0">
      <div>
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          Related Queries
        </h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          How this chunk scores against other queries. Click to reassign.
        </p>
      </div>
      
      <div className="space-y-2">
        {querySimilarities.map(({ query, score, cosine, chamfer, scoreDelta, isCurrent }) => (
          <button
            key={query}
            onClick={() => !isCurrent && handleReassign(query)}
            disabled={isCurrent || isReassigning === query || !onReassignQuery}
            className={cn(
              "w-full p-3 rounded-lg text-sm transition-all text-left",
              isCurrent 
                ? "bg-primary/10 border-2 border-primary cursor-default" 
                : "border border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer",
              isReassigning === query && "opacity-50 cursor-wait",
              !onReassignQuery && !isCurrent && "cursor-not-allowed opacity-60"
            )}
          >
            {/* Query text - full wrap, no truncation */}
            <div className="flex items-start gap-2 mb-2 min-w-0">
              {isCurrent && <Star className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />}
              {isReassigning === query && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 mt-0.5" />}
              <span className="text-foreground break-words min-w-0 flex-1">{stripMarkdown(query)}</span>
            </div>
            
            {/* Score row - stacked below */}
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <div className="flex items-center gap-2">
                {isCurrent && (
                  <span className="text-primary font-medium">Current</span>
                )}
                {!isCurrent && scoreDelta > 10 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <TrendingUp className="h-3 w-3" />
                    Better match
                  </span>
                )}
                {!isCurrent && scoreDelta !== 0 && (
                  <span className={cn(
                    "font-mono font-medium",
                    scoreDelta > 0 ? "text-green-600" : "text-red-500"
                  )}>
                    {scoreDelta > 0 ? "+" : ""}{scoreDelta}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                {/* Cosine/Chamfer breakdown */}
                <span className="font-mono text-muted-foreground">C: {cosine.toFixed(2)}</span>
                <span className="font-mono text-muted-foreground">Ch: {chamfer.toFixed(2)}</span>
                
                {/* Score badge */}
                <span className={cn(
                  "px-2 py-0.5 rounded font-mono font-medium",
                  getScoreTierStyles(score).badge
                )}>
                  {score}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
      
      {/* Helpful hint */}
      {hasBetterMatch && (
        <div className="flex items-start gap-2 p-2 rounded-lg border border-border text-xs text-muted-foreground">
          <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-yellow-500" />
          <span>
            One or more queries would significantly improve this chunk's score. Click to reassign.
          </span>
        </div>
      )}
    </div>
  );
}

// ============ CONTENT SECTION ============
function ContentSection({ chunk }: { chunk: LayoutAwareChunk }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const bodyText = chunk.textWithoutCascade || stripLeadingHeadingCascade(chunk.text);
  const isLong = bodyText.length > 500;
  
  return (
    <div className="p-4 border-t border-border space-y-3 min-w-0">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        Full Content
      </h4>
      
      <div className={cn(
        "bg-muted/30 border border-border rounded-lg p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words overflow-x-hidden",
        !isExpanded && isLong && "max-h-[200px] overflow-y-auto"
      )}>
        {bodyText}
      </div>
      
      {isLong && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full text-xs"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Show less' : 'Show full content'}
          {isExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
        </Button>
      )}
      
      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>~{chunk.metadata.tokenEstimate} tokens</span>
        <span>{chunk.metadata.wordCount} words</span>
        {chunk.metadata.hasCascade && <span>Has cascade</span>}
      </div>
    </div>
  );
}

// ============ MAIN COMPONENT ============
export function ChunkDetailsPanel({ 
  chunk, 
  chunkIndex,
  chunkScore,
  totalChunks,
  allQueries,
  assignedQuery,
  onEditContent,
  onReassignQuery,
  perQueryScores,
}: ChunkDetailsPanelProps) {
  
  // Calculate passage score for the ASSIGNED query (case-insensitive), not average
  const passageScore = useMemo(() => {
    if (!chunkScore) return 0;
    
    // Find assigned query's scores
    const assignedKeywordScore = chunkScore.keywordScores.find(
      ks => ks.keyword.toLowerCase() === assignedQuery?.toLowerCase()
    );
    
    if (assignedKeywordScore) {
      return calculatePassageScore(
        assignedKeywordScore.scores.cosine,
        assignedKeywordScore.scores.chamfer
      );
    }
    
    // Fallback to first keyword if no match
    const first = chunkScore.keywordScores[0];
    return calculatePassageScore(first.scores.cosine, first.scores.chamfer);
  }, [chunkScore, assignedQuery]);
  
  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-surface shrink-0">
        <div className="space-y-1">
          {/* Breadcrumb */}
          {chunk.headingPath && chunk.headingPath.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground overflow-hidden">
              {chunk.headingPath.map((crumb, idx) => (
                <span key={idx} className="flex items-center gap-1 shrink-0">
                  {idx > 0 && <ChevronRight className="h-2.5 w-2.5 opacity-50" />}
                  <span className="truncate max-w-[120px]" title={crumb}>
                    {stripMarkdown(crumb)}
                  </span>
                </span>
              ))}
            </div>
          )}
          
          <h3 className="text-lg font-semibold text-foreground">
            Chunk {chunkIndex + 1}
          </h3>
          <p className="text-xs text-muted-foreground">
            ~{chunk.metadata.tokenEstimate} tokens • Position {chunkIndex + 1} of {totalChunks}
          </p>
        </div>
      </div>
      
      {/* Scrollable Content */}
      <ScrollArea className="flex-1 min-w-0">
        <div className="min-w-0 overflow-hidden">
        {/* Section 1: Score Overview */}
        <ScoreOverviewSection 
          score={passageScore} 
          assignedQuery={assignedQuery}
        />
        
        {/* Section 2: Technical Score Details (Collapsible) */}
        {chunkScore && (
          <TechnicalScoreSection 
            chunkScore={chunkScore}
            passageScore={passageScore}
            assignedQuery={assignedQuery}
          />
        )}
        
        {/* Section 3: Related Queries (Actionable) */}
        <RelatedQueriesSection
          currentScore={passageScore}
          assignedQuery={assignedQuery}
          allQueries={allQueries}
          perQueryScores={perQueryScores}
          onReassignQuery={onReassignQuery}
        />
        
        {/* Section 4: Diagnostic Analysis */}
        <DiagnosticSection 
          chunk={chunk}
          passageScore={passageScore}
          assignedQuery={assignedQuery}
        />
        
        {/* Section 5: Quick Actions */}
        <ActionsSection 
          chunk={chunk}
          onEditContent={onEditContent}
        />
        
        {/* Section 6: Full Content */}
        <ContentSection chunk={chunk} />
        </div>
      </ScrollArea>
    </div>
  );
}
