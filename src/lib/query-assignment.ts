// Query-to-Chunk Assignment System
// Determines which chunk should be optimized for each query based on scores

export interface QueryAssignment {
  query: string;
  assignedChunkIndex: number;
  score: number;
  isPrimary: boolean;
}

export interface ChunkAssignment {
  chunkIndex: number;
  chunkHeading?: string;
  chunkPreview: string;
  assignedQueries: QueryAssignment[];
  averageScore: number;
}

export interface QueryAssignmentMap {
  assignments: QueryAssignment[];
  chunkAssignments: ChunkAssignment[];
  unassignedQueries: string[];
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
 * @returns QueryAssignmentMap with all assignments
 */
export function computeQueryAssignments(
  chunkScores: ChunkScoreData[],
  queries: string[],
  minScoreThreshold: number = 0.3
): QueryAssignmentMap {
  const assignments: QueryAssignment[] = [];
  const unassignedQueries: string[] = [];

  // For each query, find the chunk with the highest score
  queries.forEach((query, queryIndex) => {
    let bestChunkIndex = -1;
    let bestScore = 0;

    chunkScores.forEach((chunk, chunkIdx) => {
      const score = chunk.scores[query] || 0;
      if (score > bestScore) {
        bestScore = score;
        bestChunkIndex = chunkIdx;
      }
    });

    if (bestChunkIndex >= 0 && bestScore >= minScoreThreshold) {
      assignments.push({
        query,
        assignedChunkIndex: bestChunkIndex,
        score: bestScore,
        isPrimary: queryIndex === 0,
      });
    } else {
      unassignedQueries.push(query);
    }
  });

  // Group assignments by chunk
  const chunkAssignments = createChunkAssignments(chunkScores, assignments);

  return {
    assignments,
    chunkAssignments,
    unassignedQueries,
  };
}

/**
 * Groups query assignments by chunk for the optimization view
 */
function createChunkAssignments(
  chunkScores: ChunkScoreData[],
  assignments: QueryAssignment[]
): ChunkAssignment[] {
  const chunkMap = new Map<number, QueryAssignment[]>();

  // Group assignments by chunk
  assignments.forEach(assignment => {
    const existing = chunkMap.get(assignment.assignedChunkIndex) || [];
    existing.push(assignment);
    chunkMap.set(assignment.assignedChunkIndex, existing);
  });

  // Create ChunkAssignment objects only for chunks that have assigned queries
  const result: ChunkAssignment[] = [];

  chunkMap.forEach((queries, chunkIndex) => {
    const chunk = chunkScores[chunkIndex];
    if (!chunk) return;

    const avgScore = queries.reduce((sum, q) => sum + q.score, 0) / queries.length;
    
    result.push({
      chunkIndex,
      chunkHeading: chunk.heading,
      chunkPreview: chunk.text.slice(0, 150) + (chunk.text.length > 150 ? '...' : ''),
      assignedQueries: queries.sort((a, b) => {
        // Primary query first, then by score
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return b.score - a.score;
      }),
      averageScore: avgScore,
    });
  });

  // Sort by chunk index
  return result.sort((a, b) => a.chunkIndex - b.chunkIndex);
}

/**
 * Manually reassign a query to a different chunk
 */
export function reassignQuery(
  assignmentMap: QueryAssignmentMap,
  query: string,
  newChunkIndex: number,
  chunkScores: ChunkScoreData[]
): QueryAssignmentMap {
  const newAssignments = assignmentMap.assignments.map(a => {
    if (a.query === query) {
      const newScore = chunkScores[newChunkIndex]?.scores[query] || 0;
      return { ...a, assignedChunkIndex: newChunkIndex, score: newScore };
    }
    return a;
  });

  // Handle unassigned queries being assigned
  if (!assignmentMap.assignments.find(a => a.query === query)) {
    const newScore = chunkScores[newChunkIndex]?.scores[query] || 0;
    const isPrimary = chunkScores[0]?.scores && Object.keys(chunkScores[0].scores)[0] === query;
    newAssignments.push({
      query,
      assignedChunkIndex: newChunkIndex,
      score: newScore,
      isPrimary,
    });
  }

  const newUnassigned = assignmentMap.unassignedQueries.filter(q => q !== query);

  return {
    assignments: newAssignments,
    chunkAssignments: createChunkAssignments(chunkScores, newAssignments),
    unassignedQueries: newUnassigned,
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
