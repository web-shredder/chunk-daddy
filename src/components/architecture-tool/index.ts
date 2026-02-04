// Architecture Analysis Tool - Standalone components for content structure analysis
// 
// This tool analyzes document architecture to identify structural issues that
// impact RAG retrieval. It's separate from the main Chunk Daddy scoring pipeline.
//
// See README.md for full documentation.

export { ArchitectureReport } from './ArchitectureReport';
export { ArchitectureTasksPanel } from './ArchitectureTasksPanel';

// Re-export types for convenience
export type {
  ArchitectureAnalysis,
  ArchitectureIssue,
  ArchitectureIssueType,
  ArchitectureTask,
  ArchitectureTaskType,
} from '@/lib/optimizer-types';
