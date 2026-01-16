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

export interface FullOptimizationResult {
  analysis: ContentAnalysis;
  optimizedChunks: ValidatedChunk[];
  explanations: ChangeExplanation[];
  originalContent: string;
  timestamp: Date;
}
