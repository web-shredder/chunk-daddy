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
}

// Types for query fanout tree
export type FanoutIntentType = 'primary' | 'follow_up' | 'specification' | 'comparison' | 'process' | 'decision' | 'problem';

export interface FanoutNode {
  id: string;
  query: string;
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
