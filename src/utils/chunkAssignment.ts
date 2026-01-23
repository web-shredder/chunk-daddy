/**
 * Chunk Assignment Utilities
 * Implements greedy best-match algorithm for 1:1 query-chunk assignment
 */

import type { ChunkScore } from '@/hooks/useAnalysis';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';

interface ChunkAssignment {
  queryIndex: number;
  chunkIndex: number;
  score: number;
}

/**
 * Assigns queries to chunks using a greedy best-match algorithm
 * that ensures each chunk is only assigned to ONE query (the best match).
 * 
 * Algorithm:
 * 1. Build a matrix of all query-chunk scores
 * 2. Sort all possible assignments by score (descending)
 * 3. Greedily assign best matches, marking chunks as "taken"
 * 4. Queries without a good match (< threshold) become gaps
 */
export function assignQueriesToChunks(
  queries: { query: string }[],
  chunkScores: ChunkScore[],
  chunks: LayoutAwareChunk[],
  scoreThreshold: number = 45
): Map<number, number | null> {
  // Map: queryIndex -> chunkIndex (null = gap)
  const assignments = new Map<number, number | null>();
  const assignedChunks = new Set<number>();
  
  // Build all possible assignments with scores
  const allAssignments: ChunkAssignment[] = [];
  
  queries.forEach((queryItem, queryIndex) => {
    const queryText = queryItem.query.toLowerCase().trim();
    
    // Find all chunks that have scores for this query
    chunkScores.forEach((cs, chunkIdx) => {
      const keywordScore = cs.keywordScores.find(
        k => k.keyword.toLowerCase().trim() === queryText
      );
      
      if (keywordScore) {
        const passageScore = keywordScore.scores.passageScore ?? (keywordScore.scores.cosine * 100);
        
        if (passageScore >= scoreThreshold) {
          allAssignments.push({
            queryIndex,
            chunkIndex: chunkIdx,
            score: passageScore
          });
        }
      }
    });
  });
  
  // Sort by score descending (best matches first)
  allAssignments.sort((a, b) => b.score - a.score);
  
  // Greedy assignment
  const assignedQueries = new Set<number>();
  
  for (const assignment of allAssignments) {
    // Skip if query already assigned or chunk already taken
    if (assignedQueries.has(assignment.queryIndex)) continue;
    if (assignedChunks.has(assignment.chunkIndex)) continue;
    
    // Make assignment
    assignments.set(assignment.queryIndex, assignment.chunkIndex);
    assignedQueries.add(assignment.queryIndex);
    assignedChunks.add(assignment.chunkIndex);
  }
  
  // Mark unassigned queries as gaps
  queries.forEach((_, queryIndex) => {
    if (!assignments.has(queryIndex)) {
      assignments.set(queryIndex, null);
    }
  });
  
  return assignments;
}

/**
 * Get the best matching score for a query-chunk pair
 */
export function getBestScoreForQuery(
  queryText: string,
  chunkIndex: number | null,
  chunkScores: ChunkScore[]
): { 
  passageScore: number; 
  semanticSimilarity: number;
  lexicalScore: number;
  rerankScore?: number;
  citationScore?: number;
  entityOverlap?: number;
} | undefined {
  if (chunkIndex === null) {
    // For gaps, find the best partial match across all chunks
    let bestScore = 0;
    let bestResult: ReturnType<typeof getBestScoreForQuery> = undefined;
    
    chunkScores.forEach((cs) => {
      const keywordScore = cs.keywordScores.find(
        k => k.keyword.toLowerCase().trim() === queryText.toLowerCase().trim()
      );
      
      if (keywordScore) {
        const passageScore = keywordScore.scores.passageScore ?? (keywordScore.scores.cosine * 100);
        if (passageScore > bestScore) {
          bestScore = passageScore;
          bestResult = {
            passageScore,
            semanticSimilarity: keywordScore.scores.cosine * 100,
            lexicalScore: 0,
            rerankScore: undefined,
            citationScore: undefined,
            entityOverlap: undefined,
          };
        }
      }
    });
    
    return bestResult;
  }
  
  const cs = chunkScores[chunkIndex];
  if (!cs) return undefined;
  
  const keywordScore = cs.keywordScores.find(
    k => k.keyword.toLowerCase().trim() === queryText.toLowerCase().trim()
  );
  
  if (!keywordScore) return undefined;
  
  return {
    passageScore: keywordScore.scores.passageScore ?? (keywordScore.scores.cosine * 100),
    semanticSimilarity: keywordScore.scores.cosine * 100,
    lexicalScore: 0,
    rerankScore: undefined,
    citationScore: undefined,
    entityOverlap: undefined,
  };
}

/**
 * Analyze heading structure for gap placement suggestion
 */
export function analyzeHeadingStructure(
  headings: string[],
  query: string
): {
  suggestedAfter: string;
  suggestedAfterIndex: number;
  suggestedLevel: string;
  reasoning: string;
} {
  const queryWords = query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  // Find most semantically related heading
  let bestMatch = { index: -1, score: 0, heading: '' };
  
  headings.forEach((heading, index) => {
    const headingLower = heading.toLowerCase();
    const matchScore = queryWords.filter(w => headingLower.includes(w)).length;
    if (matchScore > bestMatch.score) {
      bestMatch = { index, score: matchScore, heading };
    }
  });
  
  // Determine placement
  if (bestMatch.index >= 0) {
    return {
      suggestedAfter: bestMatch.heading,
      suggestedAfterIndex: bestMatch.index,
      suggestedLevel: 'H2',
      reasoning: `The query "${query}" is most closely related to the section "${bestMatch.heading}". Placing the new content after this section maintains logical flow.`
    };
  }
  
  // Default to end of document
  const lastHeading = headings[headings.length - 1] || 'Introduction';
  return {
    suggestedAfter: lastHeading,
    suggestedAfterIndex: headings.length - 1,
    suggestedLevel: 'H2',
    reasoning: `No closely related section found. Suggesting placement at the end of the document as a new major section.`
  };
}
