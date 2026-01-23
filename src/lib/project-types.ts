// Types for Chunk Daddy project persistence

import type { ChunkerOptions } from './layout-chunker';
import type { AnalysisResult } from '@/hooks/useAnalysis';
import type { FullOptimizationResult, ArchitectureAnalysis } from './optimizer-types';
import type { CoverageState } from '@/types/coverage';

export interface QueryIntelligenceState {
  detectedTopic: { 
    primaryEntity: string; 
    entityType: string; 
    contentPurpose: string; 
    targetAction: string; 
    confidence: number;
  } | null;
  primaryQuery: { 
    query: string; 
    searchIntent: string; 
    confidence: number; 
    reasoning: string;
  } | null;
  intelligence: any | null;
  suggestions: any[];
  intentSummary: any | null;
  gaps: any;
  entities: { 
    primary: string[]; 
    secondary: string[]; 
    temporal: string[]; 
    branded: string[];
  } | null;
  filtered: any[];
}

export interface ChunkDaddyProject {
  id: string;
  user_id: string;
  project_name: string;
  content: string;
  queries: string[];
  settings: ChunkerOptions;
  results: AnalysisResult | null;
  optimized_content: string | null;
  optimization_result: FullOptimizationResult | null;
  architecture_analysis: ArchitectureAnalysis | null;
  query_intelligence: QueryIntelligenceState | null;
  coverage_state: CoverageState | null;  // NEW: Coverage tab state persistence
  created_at: string;
  updated_at: string;
}

export interface ProjectSummary {
  id: string;
  project_name: string;
  queries: string[];
  updated_at: string;
  chunkCount?: number;
}
