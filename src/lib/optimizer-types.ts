// Types for the V2 Auto-Optimizer

export interface TopicSegment {
  start_pos: number;
  end_pos: number;
  topic: string;
  related_queries: string[];
}

export interface OptimizationOpportunity {
  type: 'split_paragraph' | 'add_heading' | 'replace_pronoun' | 'add_context' | 'reorder_sentences';
  position: number;
  priority: 'high' | 'medium' | 'low';
  affected_queries?: string[];
  expected_impact?: string;
  reasoning: string;
}

export interface ContentAnalysis {
  topic_segments: TopicSegment[];
  optimization_opportunities: OptimizationOpportunity[];
}

export interface Change {
  change_id: string;
  change_type: 'split_paragraph' | 'add_heading' | 'replace_pronoun' | 'add_context' | 'reorder_sentences';
  before: string;
  after: string;
  reason: string;
  expected_improvement: string;
}

export interface OptimizedChunk {
  chunk_number: number;
  heading?: string;
  original_text: string;
  optimized_text: string;
  changes_applied: Change[];
}

export interface OptimizationResult {
  optimized_chunks: OptimizedChunk[];
}

export interface ValidatedChange extends Change {
  actual_scores?: {
    new_score: number;
    improvement_pct: number;
  };
}

export interface ValidatedChunk extends Omit<OptimizedChunk, 'changes_applied'> {
  changes_applied: ValidatedChange[];
  scores?: Record<string, number>;
  // For streaming optimization - track original position and assigned query
  originalChunkIndex?: number;
  query?: string;
  // Verification results (populated after verify_optimizations)
  beforeScores?: { semantic: number; lexical: number; citation: number; composite: number };
  afterScores?: { semantic: number; lexical: number; citation: number; composite: number };
  deltas?: { semantic: number; lexical: number; citation: number; composite: number };
  improved?: boolean;
  verified?: boolean;
  unaddressable?: string[];
}

export interface ChangeExplanation {
  change_id: string;
  title: string;
  explanation: string;
  impact_summary: string;
  trade_offs?: string;
}

export interface ExplanationsResult {
  explanations: ChangeExplanation[];
}

// Enhanced summary types for detailed analysis reporting
export interface QueryScoreDetail {
  query: string;
  originalCosine: number;
  optimizedCosine: number;
  percentChange: number;
  ragImpactExplanation: string;
}

export interface ChunkScoreSummary {
  chunkNumber: number;
  heading?: string;
  queryScores: QueryScoreDetail[];
  overallImprovement: number;
}

export interface FurtherOptimizationSuggestion {
  suggestion: string;
  expectedImpact: 'high' | 'medium' | 'low' | 'unlikely';
  reasoning: string;
}

export interface TradeOffConsideration {
  category: 'brand' | 'ux' | 'readability' | 'seo' | 'other';
  concern: string;
  severity: 'minor' | 'moderate' | 'significant';
}

export interface OptimizationSummary {
  chunkScores: ChunkScoreSummary[];
  overallOriginalAvg: number;
  overallOptimizedAvg: number;
  overallPercentChange: number;
  furtherSuggestions: FurtherOptimizationSuggestion[];
  tradeOffConsiderations: TradeOffConsideration[];
}

// Full score metrics for a query
export interface FullScoreMetrics {
  cosine: number;
  chamfer: number;
  passageScore: number;
}

// Content brief for queries without viable chunk matches
export interface ContentBrief {
  targetQuery: string;
  suggestedHeading: string;
  headingLevel: 'h2' | 'h3' | 'h4';
  placementDescription: string;
  placementAfterChunkIndex: number | null;
  keyPoints: string[];
  targetWordCount: { min: number; max: number };
  draftOpening: string;
  gapAnalysis: string;
}

// Original chunk metadata for full document reconstruction
export interface OriginalChunkInfo {
  index: number;
  text: string;
  textWithoutCascade: string;
  heading: string | null;
  headingPath: string[];
}

// Verification result types
export interface VerificationScores {
  semantic: number;
  lexical: number;
  citation: number;
  composite: number;
}

export interface UnchangedChunkInfo {
  chunkIndex: number;
  heading: string;
  reason: 'no_assignment' | 'user_excluded' | 'already_optimal';
  currentScores: VerificationScores;
  bestMatchingQuery: string;
  bestMatchScore: number;
}

export interface VerificationSummary {
  totalChunks: number;
  optimizedCount: number;
  unchangedCount: number;
  avgCompositeBefore: number;
  avgCompositeAfter: number;
  avgImprovement: number;
  chunksImproved: number;
  chunksDeclined: number;
  queryCoverage: {
    total: number;
    wellCovered: number;
    partiallyCovered: number;
    gaps: number;
    gapQueries: string[];
  };
}

export interface FullOptimizationResult {
  analysis: ContentAnalysis;
  optimizedChunks: ValidatedChunk[];
  explanations: ChangeExplanation[];
  originalContent: string;
  timestamp: Date;
  summary?: OptimizationSummary;
  originalScores?: Record<number, Record<string, number>>;
  // Full metrics for before/after display
  originalFullScores?: Record<number, Record<string, FullScoreMetrics>>;
  optimizedFullScores?: Record<number, Record<string, FullScoreMetrics>>;
  // Content briefs for unassigned queries
  contentBriefs: ContentBrief[];
  // All original chunks for full document reconstruction
  allOriginalChunks: OriginalChunkInfo[];
  // Applied architecture tasks from streaming optimization
  appliedArchitectureTasks?: ArchitectureTask[];
  // Verification results
  verificationSummary?: VerificationSummary;
  unchangedChunks?: UnchangedChunkInfo[];
}

// Architecture analysis types
export type ArchitectureIssueType = 
  | 'MISPLACED_CONTENT'
  | 'REDUNDANCY'
  | 'BROKEN_ATOMICITY'
  | 'TOPIC_INCOHERENCE'
  | 'COVERAGE_GAP'
  | 'ORPHANED_MENTION';

export type ArchitectureTaskType = 
  | 'add_heading'
  | 'split_paragraph'
  | 'replace_pronoun'
  | 'add_context'
  | 'reorder_sentences'
  | 'remove_redundancy'
  | 'move_content'
  | 'content_gap';

export interface ArchitectureTask {
  id: string;
  type: ArchitectureTaskType;
  issueId: string;  // Links back to the ArchitectureIssue
  description: string;
  location: {
    chunkIndex?: number;
    position?: string;  // e.g., "after paragraph 3"
    afterChunkIndex?: number;    // For content_gap: insert after this chunk
    beforeChunkIndex?: number;   // For content_gap: insert before this chunk
  };
  priority: 'high' | 'medium' | 'low';
  expectedImpact: string;
  isSelected: boolean;
  details?: {
    before?: string;
    after?: string;
    suggestedHeading?: string;
    query?: string;              // For content_gap: the unaddressed query
    bestMatchChunk?: number;     // For content_gap: closest existing chunk
    bestMatchScore?: number;     // For content_gap: score of closest match
  };
}

export interface ArchitectureIssue {
  id: string;
  type: ArchitectureIssueType;
  severity: 'high' | 'medium' | 'low';
  chunkIndices: number[];
  description: string;
  recommendation: string;
  impact: string;
  relatedQueries?: string[];
}

export interface ArchitectureAnalysis {
  issues: ArchitectureIssue[];
  tasks?: ArchitectureTask[];  // Generated from issues
  summary: {
    totalIssues: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
    architectureScore: number;
    topRecommendation: string;
  };
  chunkTopicMap: Array<{
    chunkIndex: number;
    primaryTopic: string;
    secondaryTopics: string[];
    isAtomicContent: boolean;
  }>;
}

// Types for query fanout tree
export type FanoutIntentType = 'primary' | 'follow_up' | 'specification' | 'comparison' | 'process' | 'decision' | 'problem' | 'aspect';

export interface FanoutNode {
  id: string;
  query: string;
  aspectLabel?: string;  // e.g., "fees", "monopoly", "safety" - what aspect this explores
  intentType: FanoutIntentType;
  level: number;
  parentId: string | null;
  children: FanoutNode[];
  isSelected: boolean;
  isDuplicate?: boolean;
  score?: number;
  assignedChunkIndex?: number;
}

export interface FanoutTree {
  root: FanoutNode;
  totalNodes: number;
  selectedNodes: number;
  maxDepth: number;
}

export interface FanoutGenerationOptions {
  maxDepth: number;
  branchFactor: number;
  deduplicate: boolean;
  similarityThreshold: number;
}
