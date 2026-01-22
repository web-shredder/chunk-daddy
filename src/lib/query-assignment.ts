// Query-to-Chunk Assignment System
// Determines which chunk should be optimized for each query based on scores

import type { FanoutIntentType } from './optimizer-types';

// ============ Exclusion Reason Types ============

export type ExcludeReason = 'no_assignment' | 'already_optimal' | 'below_threshold' | null;

/**
 * Determine why a chunk should be excluded from optimization.
 * Returns null if the chunk should be included.
 */
export function getExcludeReason(
  chunkIndex: number,
  assignment: QueryAssignment | null,
  preOptimizationScore: number,
  forceOptimizeSet: Set<number>
): ExcludeReason {
  // No query assigned to this chunk
  if (!assignment) {
    return 'no_assignment';
  }
  
  // User explicitly wants to optimize this chunk
  if (forceOptimizeSet.has(chunkIndex)) {
    return null;
  }
  
  // Already in Good tier or above - skip optimization
  if (preOptimizationScore >= 75) {
    return 'already_optimal';
  }
  
  // Score too low to be worth optimizing (optional threshold)
  if (preOptimizationScore < 20) {
    return 'below_threshold';
  }
  
  return null; // Include in optimization
}

/**
 * Get human-readable label for exclusion reason
 */
export function getExcludeReasonLabel(reason: ExcludeReason): string {
  switch (reason) {
    case 'no_assignment': return 'No query assigned';
    case 'already_optimal': return 'Already optimal';
    case 'below_threshold': return 'Score too low';
    default: return '';
  }
}

// ============ Core Types ============

export interface QueryAssignment {
  query: string;
  assignedChunkIndex: number;
  score: number;
  isPrimary: boolean;
  intentType?: FanoutIntentType;
}

export interface ChunkAssignment {
  chunkIndex: number;
  chunkHeading?: string;
  chunkPreview: string;
  assignedQuery: QueryAssignment | null;
}

export interface QueryAssignmentMap {
  assignments: QueryAssignment[];
  chunkAssignments: ChunkAssignment[];
  unassignedQueries: string[];
  // Maps query string to its intent type for gap export
  intentTypes: Record<string, FanoutIntentType>;
}

export interface ChunkScoreData {
  chunkIndex: number;
  heading?: string;
  text: string;
  scores: Record<string, number>; // query -> passageScore
}

/**
 * Computes the optimal query-to-chunk assignment based on Passage Scores.
 * Each query is assigned to the chunk where it scores highest.
 * 
 * @param chunkScores - Array of chunks with their scores per query
 * @param queries - Array of query strings (first is primary)
 * @param minScoreThreshold - Minimum score to consider a valid assignment (default 0.3)
 * @param intentTypes - Optional map of query -> intentType from fanout
 * @returns QueryAssignmentMap with all assignments
 */
export function computeQueryAssignments(
  chunkScores: ChunkScoreData[],
  queries: string[],
  minScoreThreshold: number = 0.3,
  intentTypes: Record<string, FanoutIntentType> = {}
): QueryAssignmentMap {
  // Build all valid (query, chunk, score) candidates
  const candidates: Array<{
    query: string;
    chunkIndex: number;
    score: number;
    queryIndex: number;
  }> = [];

  queries.forEach((query, queryIndex) => {
    chunkScores.forEach((chunk, chunkIndex) => {
      const score = chunk.scores[query] || 0;
      if (score >= minScoreThreshold) {
        candidates.push({ query, chunkIndex, score, queryIndex });
      }
    });
  });

  // Sort by score descending - highest scores get first pick
  candidates.sort((a, b) => b.score - a.score);

  const assignedChunks = new Set<number>();
  const assignedQueries = new Set<string>();
  const assignments: QueryAssignment[] = [];

  // Greedy assignment: best scores win, each chunk/query used only once
  for (const candidate of candidates) {
    if (assignedChunks.has(candidate.chunkIndex)) continue;
    if (assignedQueries.has(candidate.query)) continue;

    assignments.push({
      query: candidate.query,
      assignedChunkIndex: candidate.chunkIndex,
      score: candidate.score,
      isPrimary: candidate.queryIndex === 0,
      intentType: intentTypes[candidate.query],
    });

    assignedChunks.add(candidate.chunkIndex);
    assignedQueries.add(candidate.query);
  }

  // Unhoused queries = not assigned to any chunk
  const unassignedQueries = queries.filter(q => !assignedQueries.has(q));

  // Build chunk assignments with single query each
  const chunkAssignments: ChunkAssignment[] = chunkScores.map((chunk, index) => {
    const assignment = assignments.find(a => a.assignedChunkIndex === index);
    return {
      chunkIndex: index,
      chunkHeading: chunk.heading,
      chunkPreview: chunk.text.slice(0, 150) + '...',
      assignedQuery: assignment || null,
    };
  });

  return { assignments, chunkAssignments, unassignedQueries, intentTypes };
}

/**
 * Manually reassign a query to a different chunk.
 * Returns the updated map and any evicted query name.
 */
export function reassignQuery(
  currentMap: QueryAssignmentMap,
  query: string,
  newChunkIndex: number,
  chunkScores: ChunkScoreData[]
): { updatedMap: QueryAssignmentMap; evictedQuery: string | null } {
  // Find if target chunk is already occupied
  const targetChunk = currentMap.chunkAssignments.find(
    ca => ca.chunkIndex === newChunkIndex
  );
  const evictedQuery = targetChunk?.assignedQuery?.query || null;

  // Remove query from current assignment
  let updatedAssignments = currentMap.assignments.filter(a => a.query !== query);
  
  // If evicting, remove that assignment too
  if (evictedQuery) {
    updatedAssignments = updatedAssignments.filter(a => a.query !== evictedQuery);
  }

  // Add new assignment
  const score = chunkScores[newChunkIndex]?.scores[query] || 0;
  updatedAssignments.push({
    query,
    assignedChunkIndex: newChunkIndex,
    score,
    isPrimary: false,
  });

  // Rebuild chunk assignments
  const chunkAssignments: ChunkAssignment[] = chunkScores.map((chunk, index) => {
    const assignment = updatedAssignments.find(a => a.assignedChunkIndex === index);
    return {
      chunkIndex: index,
      chunkHeading: chunk.heading,
      chunkPreview: chunk.text.slice(0, 150) + '...',
      assignedQuery: assignment || null,
    };
  });

  // Update unassigned queries
  const assignedQuerySet = new Set(updatedAssignments.map(a => a.query));
  const allQueries = [...new Set([
    ...currentMap.assignments.map(a => a.query),
    ...currentMap.unassignedQueries,
    query
  ])];
  const unassignedQueries = allQueries.filter(q => !assignedQuerySet.has(q));

  return {
    updatedMap: { 
      assignments: updatedAssignments, 
      chunkAssignments, 
      unassignedQueries,
      intentTypes: currentMap.intentTypes, // Preserve intent types
    },
    evictedQuery,
  };
}

/**
 * Convert analysis results to ChunkScoreData format
 */
export function analysisResultToChunkScores(
  analysisResult: {
    chunkScores?: Array<{
      chunk: { text: string; heading?: string };
      keywords: Array<{ keyword: string; passageScore?: number }>;
    }>;
  }
): ChunkScoreData[] {
  if (!analysisResult.chunkScores) return [];

  return analysisResult.chunkScores.map((chunk, index) => {
    const scores: Record<string, number> = {};
    chunk.keywords.forEach(kw => {
      scores[kw.keyword] = kw.passageScore || 0;
    });

    return {
      chunkIndex: index,
      heading: chunk.chunk.heading,
      text: chunk.chunk.text,
      scores,
    };
  });
}

/**
 * Get the primary query (first query, usually the main topic)
 */
export function getPrimaryQuery(queries: string[]): string | undefined {
  return queries[0];
}

/**
 * Get color class for a score value
 */
export function getScoreColorClass(score: number): string {
  if (score >= 0.7) return 'text-green-500';
  if (score >= 0.5) return 'text-yellow-500';
  if (score >= 0.3) return 'text-orange-500';
  return 'text-red-500';
}

/**
 * Format score as percentage
 */
export function formatScorePercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}
