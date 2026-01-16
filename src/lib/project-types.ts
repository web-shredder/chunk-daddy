// Types for Chunk Daddy project persistence

import type { ChunkerOptions } from './layout-chunker';
import type { AnalysisResult } from '@/hooks/useAnalysis';
import type { FullOptimizationResult } from './optimizer-types';

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
