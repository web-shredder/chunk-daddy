import { useState, useMemo } from 'react';
import { 
  ChevronRight, ChevronDown, ChevronUp, Copy, Edit, 
  AlertCircle, AlertTriangle, Info, CheckCircle2, 
  Zap, Calculator, Target, FileText, Lightbulb
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, stripLeadingHeadingCascade } from '@/lib/utils';
import { calculatePassageScore, getPassageScoreTier } from '@/lib/similarity';
import { toast } from 'sonner';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';
import type { ChunkScore } from '@/hooks/useAnalysis';

interface ChunkDetailsPanelProps {
  chunk: LayoutAwareChunk;
  chunkIndex: number;
  chunkScore?: ChunkScore;
  totalChunks: number;
  allQueries: string[];
  assignedQuery?: string;
  onEditContent?: () => void;
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

function getScoreTier(score: number) {
  if (score >= 90) return { label: 'Excellent', color: 'bg-green-500', textColor: 'text-green-600', bgLight: 'bg-green-50 dark:bg-green-950/30' };
  if (score >= 75) return { label: 'Good', color: 'bg-blue-500', textColor: 'text-blue-600', bgLight: 'bg-blue-50 dark:bg-blue-950/30' };
  if (score >= 60) return { label: 'Moderate', color: 'bg-yellow-500', textColor: 'text-yellow-600', bgLight: 'bg-yellow-50 dark:bg-yellow-950/30' };
  if (score >= 40) return { label: 'Weak', color: 'bg-orange-500', textColor: 'text-orange-600', bgLight: 'bg-orange-50 dark:bg-orange-950/30' };
  return { label: 'Poor', color: 'bg-red-500', textColor: 'text-red-600', bgLight: 'bg-red-50 dark:bg-red-950/30' };
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
  const tier = getScoreTier(score);
  
  return (
    <div className="p-4 space-y-4">
      {/* Large score display */}
      <div className="flex items-start gap-4">
        <div className="text-center">
          <div className={cn("text-5xl font-bold font-mono", tier.textColor)}>
            {score}
          </div>
          <div className={cn("text-sm font-medium", tier.textColor)}>
            {tier.label}
          </div>
        </div>
        
        {/* Visual score indicator */}
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn("h-full transition-all duration-500", tier.color)}
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
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Optimized for:</span>
          <Badge variant="secondary" className="bg-accent/10 text-accent">
            <Zap className="h-3 w-3 mr-1" />
            {stripMarkdown(assignedQuery)}
          </Badge>
        </div>
      )}
    </div>
  );
}

// ============ TECHNICAL SCORE SECTION ============
function TechnicalScoreSection({ 
  chunkScore,
  passageScore 
}: { 
  chunkScore: ChunkScore;
  passageScore: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEducation, setShowEducation] = useState(false);
  
  // Calculate averages across all queries
  const avgCosine = chunkScore.keywordScores.reduce((sum, ks) => sum + ks.scores.cosine, 0) / chunkScore.keywordScores.length;
  const avgChamfer = chunkScore.keywordScores.reduce((sum, ks) => sum + ks.scores.chamfer, 0) / chunkScore.keywordScores.length;
  
  const cosineContribution = avgCosine * 0.7;
  const chamferContribution = avgChamfer * 0.3;
  
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
        <div className="px-4 pb-4 space-y-4">
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
                  {avgCosine.toFixed(3)}
                </div>
                <div className="text-[10px] text-green-600 font-mono">
                  +{(cosineContribution * 100).toFixed(1)} pts
                </div>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${avgCosine * 100}%` }}
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
                  {avgChamfer.toFixed(3)}
                </div>
                <div className="text-[10px] text-green-600 font-mono">
                  +{(chamferContribution * 100).toFixed(1)} pts
                </div>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 transition-all"
                style={{ width: `${avgChamfer * 100}%` }}
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
              <div>({avgCosine.toFixed(3)} × 0.7) + ({avgChamfer.toFixed(3)} × 0.3)</div>
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
    <div className="p-4 border-t border-border space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Target className="h-4 w-4 text-muted-foreground" />
        Diagnostic Analysis
      </h4>
      
      {diagnosis.length > 0 ? (
        <div className="space-y-2">
          {diagnosis.map((issue, i) => (
            <div 
              key={i}
              className="p-3 rounded-lg border border-border flex items-start gap-3 text-sm"
            >
              {issue.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
              {issue.type === 'warning' && <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />}
              {issue.type === 'info' && <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />}
              <span className="text-foreground">{issue.message}</span>
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
    <div className="p-4 border-t border-border space-y-3">
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

// ============ CONTENT SECTION ============
function ContentSection({ chunk }: { chunk: LayoutAwareChunk }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const bodyText = chunk.textWithoutCascade || stripLeadingHeadingCascade(chunk.text);
  const isLong = bodyText.length > 500;
  
  return (
    <div className="p-4 border-t border-border space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        Full Content
      </h4>
      
      <pre className={cn(
        "bg-muted/30 border border-border rounded-lg p-3 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words overflow-auto",
        !isExpanded && isLong && "max-h-[200px]"
      )}>
        {bodyText}
      </pre>
      
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
}: ChunkDetailsPanelProps) {
  
  // Calculate passage score
  const passageScore = useMemo(() => {
    if (!chunkScore) return 0;
    const avgCosine = chunkScore.keywordScores.reduce((sum, ks) => sum + ks.scores.cosine, 0) / chunkScore.keywordScores.length;
    const avgChamfer = chunkScore.keywordScores.reduce((sum, ks) => sum + ks.scores.chamfer, 0) / chunkScore.keywordScores.length;
    return calculatePassageScore(avgCosine, avgChamfer);
  }, [chunkScore]);
  
  return (
    <div className="flex flex-col h-full">
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
      <ScrollArea className="flex-1">
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
          />
        )}
        
        {/* Section 3: Diagnostic Analysis */}
        <DiagnosticSection 
          chunk={chunk}
          passageScore={passageScore}
          assignedQuery={assignedQuery}
        />
        
        {/* Section 4: Quick Actions */}
        <ActionsSection 
          chunk={chunk}
          onEditContent={onEditContent}
        />
        
        {/* Section 5: Full Content */}
        <ContentSection chunk={chunk} />
      </ScrollArea>
    </div>
  );
}
