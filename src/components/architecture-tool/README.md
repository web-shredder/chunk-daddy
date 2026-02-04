# Architecture Analysis Tool

Standalone content structure analysis tool extracted from Chunk Daddy's main pipeline.

## Purpose

Analyzes document architecture to identify structural issues that impact RAG retrieval:
- **Misplaced Content**: Content appearing in wrong sections based on topic
- **Redundancy**: Same information repeated across multiple chunks
- **Broken Atomicity**: Chunks that reference external context and can't stand alone
- **Topic Incoherence**: Single chunks covering multiple unrelated topics
- **Coverage Gaps**: Query clusters with no chunk scoring above threshold
- **Orphaned Mentions**: Topics mentioned briefly but never developed

## Components

### ArchitectureReport.tsx
Displays the results of architecture analysis in a summary card + issue cards grouped by type.
- Shows architecture score (0-100)
- Displays high/medium/low priority issue counts
- Groups issues by type with descriptions and recommendations
- Allows navigation to affected chunks

### ArchitectureTasksPanel.tsx
Interactive task list generated from architecture issues.
- Converts issues to actionable tasks (add heading, split paragraph, etc.)
- Supports bulk selection/deselection
- Filters by priority
- Separates structural issues from content gaps

### ArchitectureAnalyzer.tsx (Main Component)
Full standalone analyzer that combines content input + analysis + report.
- Paste content or import from external sources
- Add target queries for gap detection
- Run architecture analysis via edge function
- Export results as CSV

## Edge Function

The architecture analysis uses `optimize-content` edge function with `type: 'analyze_architecture'`.

Request body:
```typescript
{
  type: 'analyze_architecture',
  content: string,              // Original markdown
  chunks: string[],             // Chunk body texts (without cascades)
  queries: string[],            // Target queries
  chunkScores: Array<{scores: Record<string, number>}>,
  headings: string[],
  chunkMetadata: Array<{index, headingPath, preview}>
}
```

Response:
```typescript
{
  issues: ArchitectureIssue[],
  summary: {
    totalIssues: number,
    highPriority: number,
    mediumPriority: number,
    lowPriority: number,
    architectureScore: number,
    topRecommendation: string,
  },
  chunkTopicMap: Array<{
    chunkIndex: number,
    primaryTopic: string,
    secondaryTopics: string[],
    isAtomicContent: boolean,
  }>
}
```

## Types (from src/lib/optimizer-types.ts)

```typescript
type ArchitectureIssueType = 
  | 'MISPLACED_CONTENT'
  | 'REDUNDANCY'
  | 'BROKEN_ATOMICITY'
  | 'TOPIC_INCOHERENCE'
  | 'COVERAGE_GAP'
  | 'ORPHANED_MENTION';

type ArchitectureTaskType = 
  | 'add_heading'
  | 'split_paragraph'
  | 'replace_pronoun'
  | 'add_context'
  | 'reorder_sentences'
  | 'remove_redundancy'
  | 'move_content'
  | 'content_gap';

interface ArchitectureIssue {
  id: string;
  type: ArchitectureIssueType;
  severity: 'high' | 'medium' | 'low';
  chunkIndices: number[];
  description: string;
  recommendation: string;
  impact: string;
  relatedQueries?: string[];
}

interface ArchitectureTask {
  id: string;
  type: ArchitectureTaskType;
  issueId: string;
  description: string;
  location: {
    chunkIndex?: number;
    position?: string;
    afterChunkIndex?: number;
    beforeChunkIndex?: number;
  };
  priority: 'high' | 'medium' | 'low';
  expectedImpact: string;
  isSelected: boolean;
  details?: {
    before?: string;
    after?: string;
    suggestedHeading?: string;
    query?: string;
    bestMatchChunk?: number;
    bestMatchScore?: number;
  };
}

interface ArchitectureAnalysis {
  issues: ArchitectureIssue[];
  tasks?: ArchitectureTask[];
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
```

## Future Integration

This tool will eventually be available as a standalone page where users can:
1. Paste content or import from fanout queries
2. Get content design and planning insights
3. Export actionable improvement tasks

It's separate from the chunk scoring pipeline - this is about content planning, not retrieval optimization.
