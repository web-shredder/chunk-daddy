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
}

export interface CoverageState {
  queries: QueryWorkItem[];
  activeQueryId: string | null;
}
