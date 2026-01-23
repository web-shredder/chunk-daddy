/**
 * Coverage Tab Types
 * Types for tracking query optimization status in the Coverage workflow
 */

export type QueryStatus = 'optimized' | 'in_progress' | 'ready' | 'gap';

// Google Patent variant types + PRIMARY for user-entered queries
export type QueryIntentType = 
  | 'PRIMARY'
  | 'EQUIVALENT'
  | 'FOLLOW_UP'
  | 'GENERALIZATION'
  | 'CANONICALIZATION'
  | 'ENTAILMENT'
  | 'SPECIFICATION'
  | 'CLARIFICATION'
  | 'GAP';

// Optimization step tracking
export type OptimizationStep = 
  | 'idle' 
  | 'analyzing' 
  | 'analysis_ready' 
  | 'optimizing' 
  | 'optimization_ready' 
  | 'scoring' 
  | 'approved';

export interface QueryScores {
  passageScore: number;
  semanticSimilarity: number;
  lexicalScore: number;
  rerankScore?: number;
  citationScore?: number;
  entityOverlap?: number;
}

export interface AssignedChunk {
  index: number;
  heading: string;
  preview: string;
  headingPath?: string[];
}

export interface QueryOptimizationState {
  step: OptimizationStep;
  error?: string;
  
  // Generated content
  generatedAnalysis?: string;
  generatedContent?: string;
  
  // User edits (tracks if user modified the generated content)
  userEditedAnalysis?: string;
  userEditedContent?: string;
  
  // Rescoring results
  lastScoredContent?: string;
  lastScoredResults?: QueryScores;
}

export interface QueryWorkItem {
  id: string;
  query: string;
  intentType: QueryIntentType;
  status: QueryStatus;
  
  // For assigned queries
  assignedChunk?: AssignedChunk;
  
  // Scores
  originalScores?: QueryScores;
  currentScores?: QueryScores;
  
  // Optimization state
  isApproved: boolean;
  analysisPrompt?: string;
  optimizedText?: string;
  approvedText?: string;
  
  // Gap-specific fields
  isGap?: boolean;
  suggestedPlacement?: string;      // Where in the document to add new content
  suggestedHeading?: string;        // Recommended heading for new section
  estimatedWordCount?: number;      // Recommended length
}

export interface CoverageState {
  queries: QueryWorkItem[];
  activeQueryId: string | null;
  optimizationStates: Record<string, QueryOptimizationState>;
}
