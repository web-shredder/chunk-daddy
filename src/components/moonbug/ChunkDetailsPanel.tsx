import { useState, useMemo } from 'react';
import { 
  ChevronRight, ChevronDown, ChevronUp, Copy, Edit, 
  AlertCircle, AlertTriangle, Info, CheckCircle2, 
  Zap, Calculator, Target, FileText, Lightbulb, 
  TrendingUp, Star, Loader2, Search, Activity, Quote
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn, stripLeadingHeadingCascade } from '@/lib/utils';
import { calculatePassageScore } from '@/lib/similarity';
import { getTierFromScore, getTierLabel, TIER_COLORS, SCORE_CHANGE_COLORS, getScoreChangeColor, DIAGNOSTIC_COLORS, METRIC_COLORS } from '@/lib/tier-colors';
import { toast } from 'sonner';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';
import type { ChunkScore } from '@/hooks/useAnalysis';
import type { DiagnosticScores, FailureMode, ChunkDiagnosis } from '@/lib/diagnostic-scoring';

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
  diagnosticScores?: DiagnosticScores; // NEW: Full diagnostic scoring data
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
                <div className={cn("text-[10px] font-mono", SCORE_CHANGE_COLORS.positive)}>
                  +{(cosineContribution * 100).toFixed(1)} pts
                </div>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all", METRIC_COLORS.cosine)}
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
                <div className={cn("text-[10px] font-mono", SCORE_CHANGE_COLORS.positive)}>
                  +{(chamferContribution * 100).toFixed(1)} pts
                </div>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all", METRIC_COLORS.chamfer)}
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

// ============ DIAGNOSTIC SECTION (NEW - USES diagnostic-scoring.ts) ============
const FAILURE_MODE_BADGES: Record<FailureMode, { label: string; icon: typeof AlertCircle; color: string }> = {
  'topic_mismatch': { label: 'Topic Mismatch', icon: AlertCircle, color: DIAGNOSTIC_COLORS.error },
  'missing_specifics': { label: 'Needs Specifics', icon: Info, color: DIAGNOSTIC_COLORS.warning },
  'buried_answer': { label: 'Buried Answer', icon: AlertTriangle, color: DIAGNOSTIC_COLORS.warning },
  'vocabulary_gap': { label: 'Missing Terms', icon: Search, color: DIAGNOSTIC_COLORS.info },
  'no_direct_answer': { label: 'No Direct Answer', icon: AlertCircle, color: DIAGNOSTIC_COLORS.error },
  'structure_problem': { label: 'Structure Issue', icon: Info, color: DIAGNOSTIC_COLORS.warning },
  'already_optimized': { label: 'Well Optimized', icon: CheckCircle2, color: DIAGNOSTIC_COLORS.success },
};

function ScoreRow({ label, score, detail }: { label: string; score: number; detail?: string }) {
  const tier = getTierFromScore(score);
  const colors = TIER_COLORS[tier];
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-muted-foreground/70 text-[10px]">{detail}</span>}
        <span className={cn("font-mono font-medium", colors.text)}>{score}</span>
      </div>
    </div>
  );
}

function DiagnosticSection({ 
  chunk, 
  passageScore,
  assignedQuery,
  diagnosticScores
}: { 
  chunk: LayoutAwareChunk; 
  passageScore: number;
  assignedQuery?: string;
  diagnosticScores?: DiagnosticScores;
}) {
  const [lexicalExpanded, setLexicalExpanded] = useState(false);
  const [rerankExpanded, setRerankExpanded] = useState(false);
  const [citationExpanded, setCitationExpanded] = useState(false);
  
  // Fallback to old diagnosis if no diagnostic scores
  const legacyDiagnosis = useMemo(() => {
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
          message: 'Very short content (< 200 chars) — may lack sufficient detail' 
        });
      }
    }
    
    return issues;
  }, [chunk, passageScore, assignedQuery]);
  
  // If we have diagnostic scores, show the new UI
  if (diagnosticScores) {
    const { diagnosis, lexical, rerank, citation, hybridRetrieval } = diagnosticScores;
    const failureConfig = FAILURE_MODE_BADGES[diagnosis.primaryFailureMode];
    const FailureIcon = failureConfig.icon;
    
    return (
      <div className="p-4 border-t border-border space-y-4 min-w-0">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Diagnostic Analysis
        </h4>
        
        {/* Diagnosis Summary */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
          <div className="flex items-start gap-2">
            <FailureIcon className={cn("h-4 w-4 shrink-0 mt-0.5", failureConfig.color)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-sm font-medium", failureConfig.color)}>
                  {failureConfig.label}
                </span>
                {diagnosis.fixPriority !== 'none' && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                    +{diagnosis.expectedImprovement} pts expected
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 break-words">
                {diagnosis.recommendedFix}
              </p>
            </div>
          </div>
          
          {/* Missing Facets */}
          {diagnosis.missingFacets.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <span className="text-[10px] text-muted-foreground">Missing concepts: </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {diagnosis.missingFacets.slice(0, 6).map((facet, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/30">
                    {facet}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Present Strengths */}
          {diagnosis.presentStrengths.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <span className="text-[10px] text-muted-foreground">Strengths: </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {diagnosis.presentStrengths.map((strength, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-[hsl(var(--tier-good-bg))] text-[hsl(var(--tier-good))] border-[hsl(var(--tier-good)/0.3)]">
                    {strength}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Multi-Stage Scores Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-muted/30 border border-border text-center">
            <div className="text-[10px] text-muted-foreground mb-1">Retrieval</div>
            <div className={cn("text-lg font-bold font-mono", getTierFromScore(hybridRetrieval) === 'poor' ? TIER_COLORS.poor.text : getTierFromScore(hybridRetrieval) === 'weak' ? TIER_COLORS.weak.text : TIER_COLORS.moderate.text)}>
              {hybridRetrieval}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-muted/30 border border-border text-center">
            <div className="text-[10px] text-muted-foreground mb-1">Rerank</div>
            <div className={cn("text-lg font-bold font-mono", getTierFromScore(rerank.score) === 'poor' ? TIER_COLORS.poor.text : getTierFromScore(rerank.score) === 'weak' ? TIER_COLORS.weak.text : TIER_COLORS.moderate.text)}>
              {rerank.score}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-muted/30 border border-border text-center">
            <div className="text-[10px] text-muted-foreground mb-1">Citation</div>
            <div className={cn("text-lg font-bold font-mono", getTierFromScore(citation.score) === 'poor' ? TIER_COLORS.poor.text : getTierFromScore(citation.score) === 'weak' ? TIER_COLORS.weak.text : TIER_COLORS.moderate.text)}>
              {citation.score}
            </div>
          </div>
        </div>
        
        {/* Lexical Analysis (Collapsible) */}
        <Collapsible open={lexicalExpanded} onOpenChange={setLexicalExpanded}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
            <span className="flex items-center gap-2 text-xs font-medium">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              Lexical Analysis
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono">{lexical.score}</span>
              {lexicalExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            <div className="text-xs space-y-1 p-2 bg-muted/20 rounded">
              <div>
                <span className="text-muted-foreground">Query terms: </span>
                {lexical.queryTerms.map(term => (
                  <span 
                    key={term} 
                    className={cn(
                      "mx-0.5 px-1 py-0.5 rounded text-[10px]",
                      lexical.matchedTerms.some(m => m.term === term) 
                        ? "bg-[hsl(var(--tier-good-bg))] text-[hsl(var(--tier-good))]" 
                        : "bg-[hsl(var(--tier-poor-bg))] text-[hsl(var(--tier-poor))]"
                    )}
                  >
                    {term}
                  </span>
                ))}
              </div>
              {lexical.missingTerms.length > 0 && (
                <div className="text-[hsl(var(--destructive))]">
                  Missing: {lexical.missingTerms.join(', ')}
                </div>
              )}
              {lexical.exactPhraseMatch && (
                <div className={DIAGNOSTIC_COLORS.success}>✓ Exact query phrase found</div>
              )}
              {lexical.titleBoost > 0 && (
                <div className="text-muted-foreground">
                  Heading boost: +{lexical.titleBoost} pts
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
        
        {/* Rerank Factors (Collapsible) */}
        <Collapsible open={rerankExpanded} onOpenChange={setRerankExpanded}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
            <span className="flex items-center gap-2 text-xs font-medium">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              Rerank Factors
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono">{rerank.score}</span>
              {rerankExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            <div className="p-2 bg-muted/20 rounded space-y-1.5">
              <ScoreRow label="Entity Prominence" score={rerank.entityProminence.score} />
              <ScoreRow label="Direct Answer" score={rerank.directAnswer.score} detail={rerank.directAnswer.answerType} />
              <ScoreRow label="Query Restatement" score={rerank.queryRestatement.score} detail={rerank.queryRestatement.restatementType} />
              <ScoreRow label="Structural Clarity" score={rerank.structuralClarity.score} />
              
              {rerank.entityProminence.missingEntities.length > 0 && (
                <div className="pt-1.5 border-t border-border/50 text-xs">
                  <span className="text-muted-foreground">Missing entities: </span>
                  <span className="text-[hsl(var(--destructive))]">
                    {rerank.entityProminence.missingEntities.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
        
        {/* Citation Potential (Collapsible) */}
        <Collapsible open={citationExpanded} onOpenChange={setCitationExpanded}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
            <span className="flex items-center gap-2 text-xs font-medium">
              <Quote className="h-3.5 w-3.5 text-muted-foreground" />
              Citation Potential
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono">{citation.score}</span>
              {citationExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            <div className="p-2 bg-muted/20 rounded space-y-1.5">
              <ScoreRow label="Specificity" score={citation.specificity.score} />
              <ScoreRow label="Quotability" score={citation.quotability.score} />
              
              {citation.specificity.numbers.length > 0 && (
                <div className="text-xs pt-1.5 border-t border-border/50">
                  <span className="text-muted-foreground">Numbers found: </span>
                  <span>{citation.specificity.numbers.slice(0, 4).join(', ')}</span>
                </div>
              )}
              
              <div className="flex items-center gap-4 text-xs pt-1">
                {citation.quotability.quotableSentences.length > 0 && (
                  <span className={DIAGNOSTIC_COLORS.success}>
                    {citation.quotability.quotableSentences.length} quotable
                  </span>
                )}
                {citation.quotability.vagueStatements.length > 0 && (
                  <span className={DIAGNOSTIC_COLORS.warning}>
                    {citation.quotability.vagueStatements.length} vague
                  </span>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }
  
  // Fallback to legacy diagnosis display
  return (
    <div className="p-4 border-t border-border space-y-3 min-w-0">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Target className="h-4 w-4 text-muted-foreground" />
        Diagnostic Analysis
      </h4>
      
      {legacyDiagnosis.length > 0 ? (
        <div className="space-y-2">
          {legacyDiagnosis.map((issue, i) => (
            <div 
              key={i}
              className="p-3 rounded-lg border border-border flex items-start gap-3 text-sm min-w-0"
            >
              {issue.type === 'error' && <AlertCircle className={cn("h-4 w-4 shrink-0 mt-0.5", DIAGNOSTIC_COLORS.error)} />}
              {issue.type === 'warning' && <AlertTriangle className={cn("h-4 w-4 shrink-0 mt-0.5", DIAGNOSTIC_COLORS.warning)} />}
              {issue.type === 'info' && <Info className={cn("h-4 w-4 shrink-0 mt-0.5", DIAGNOSTIC_COLORS.info)} />}
              <span className="text-foreground break-words">{issue.message}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn("flex items-center gap-2 text-sm", DIAGNOSTIC_COLORS.success)}>
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
                  <span className={cn("flex items-center gap-1", SCORE_CHANGE_COLORS.positive)}>
                    <TrendingUp className="h-3 w-3" />
                    Better match
                  </span>
                )}
                {!isCurrent && scoreDelta !== 0 && (
                  <span className={cn(
                    "font-mono font-medium",
                    getScoreChangeColor(scoreDelta)
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
          <Lightbulb className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", DIAGNOSTIC_COLORS.warning)} />
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
  diagnosticScores,
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
          diagnosticScores={diagnosticScores}
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
