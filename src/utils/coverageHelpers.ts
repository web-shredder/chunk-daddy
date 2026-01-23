/**
 * Coverage Tab Helpers
 * Utilities for transforming analysis data into coverage work items
 */

import type { QueryWorkItem, QueryStatus, QueryIntentType, QueryScores, AssignedChunk } from '@/types/coverage';
import type { ChunkScore } from '@/hooks/useAnalysis';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';

// Threshold for considering a query to have a good match
const GOOD_MATCH_THRESHOLD = 45;

interface QueryInput {
  query: string;
  intentType?: string;
  variantType?: string;
}

/**
 * Transform queries and scoring results into QueryWorkItems for the Coverage tab
 */
export function transformToWorkItems(
  queries: QueryInput[],
  chunkScores: ChunkScore[],
  chunks: LayoutAwareChunk[],
  queryIntentTypes?: Record<string, string>
): QueryWorkItem[] {
  return queries.map((queryInput): QueryWorkItem => {
    const queryText = typeof queryInput === 'string' ? queryInput : queryInput.query;
    const intentType = getIntentType(queryInput, queryIntentTypes?.[queryText]);
    
    // Find the best scoring chunk for this query
    let bestScore = 0;
    let bestChunkIndex: number | undefined;
    let bestScores: QueryScores | undefined;
    
    chunkScores.forEach((cs, idx) => {
      const keywordScore = cs.keywordScores.find(
        k => k.keyword.toLowerCase() === queryText.toLowerCase()
      );
      
      if (keywordScore) {
        const passageScore = keywordScore.scores.passageScore ?? (keywordScore.scores.cosine * 100);
        if (passageScore > bestScore) {
          bestScore = passageScore;
          bestChunkIndex = idx;
          bestScores = {
            passageScore,
            semanticSimilarity: keywordScore.scores.cosine * 100,
            lexicalScore: 0, // Not available in SimilarityScores
            rerankScore: undefined,
            citationScore: undefined,
            entityOverlap: undefined,
          };
        }
      }
    });
    
    const hasGoodMatch = bestScore >= GOOD_MATCH_THRESHOLD;
    const status: QueryStatus = hasGoodMatch ? 'ready' : 'gap';
    
    // Build assigned chunk info if we have a match
    let assignedChunk: AssignedChunk | undefined;
    if (hasGoodMatch && bestChunkIndex !== undefined && chunks[bestChunkIndex]) {
      const chunk = chunks[bestChunkIndex];
      assignedChunk = {
        index: bestChunkIndex,
        heading: chunk.headingPath?.[chunk.headingPath.length - 1] || `Chunk ${bestChunkIndex + 1}`,
        preview: truncateText(chunk.text, 100),
        headingPath: chunk.headingPath,
      };
    }
    
    return {
      id: crypto.randomUUID(),
      query: queryText,
      intentType,
      status,
      assignedChunk,
      originalScores: bestScores,
      isApproved: false,
    };
  });
}

/**
 * Determine the intent type for a query
 */
function getIntentType(
  queryInput: QueryInput | string,
  overrideType?: string
): QueryIntentType {
  if (overrideType) {
    return normalizeIntentType(overrideType);
  }
  
  if (typeof queryInput === 'string') {
    return 'PRIMARY';
  }
  
  const rawType = queryInput.variantType || queryInput.intentType;
  return normalizeIntentType(rawType);
}

/**
 * Normalize intent type strings to valid QueryIntentType
 */
function normalizeIntentType(type?: string): QueryIntentType {
  if (!type) return 'PRIMARY';
  
  const normalized = type.toUpperCase().replace(/[-\s]/g, '_');
  
  const validTypes: QueryIntentType[] = [
    'PRIMARY',
    'EQUIVALENT',
    'FOLLOW_UP',
    'GENERALIZATION',
    'CANONICALIZATION',
    'ENTAILMENT',
    'SPECIFICATION',
    'CLARIFICATION',
    'GAP',
  ];
  
  if (validTypes.includes(normalized as QueryIntentType)) {
    return normalized as QueryIntentType;
  }
  
  // Map some common variants
  if (normalized.includes('FOLLOW')) return 'FOLLOW_UP';
  if (normalized.includes('SPEC')) return 'SPECIFICATION';
  if (normalized.includes('GENERAL')) return 'GENERALIZATION';
  if (normalized.includes('EQUIV')) return 'EQUIVALENT';
  if (normalized.includes('ENTAIL')) return 'ENTAILMENT';
  if (normalized.includes('CANON')) return 'CANONICALIZATION';
  if (normalized.includes('CLARIF')) return 'CLARIFICATION';
  
  return 'PRIMARY';
}

/**
 * Truncate text to a maximum length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + '...';
}

/**
 * Update a query's status in the coverage state
 */
export function updateQueryStatus(
  queries: QueryWorkItem[],
  queryId: string,
  status: QueryStatus
): QueryWorkItem[] {
  return queries.map(q => 
    q.id === queryId ? { ...q, status } : q
  );
}

/**
 * Update a query's scores after optimization
 */
export function updateQueryScores(
  queries: QueryWorkItem[],
  queryId: string,
  currentScores: QueryScores
): QueryWorkItem[] {
  return queries.map(q => 
    q.id === queryId ? { ...q, currentScores } : q
  );
}

/**
 * Mark a query as approved
 */
export function approveQuery(
  queries: QueryWorkItem[],
  queryId: string,
  approvedText: string
): QueryWorkItem[] {
  return queries.map(q => 
    q.id === queryId 
      ? { ...q, isApproved: true, approvedText, status: 'optimized' as QueryStatus }
      : q
  );
}

/**
 * Get summary stats for the coverage state
 */
export function getCoverageSummary(queries: QueryWorkItem[]) {
  return {
    total: queries.length,
    optimized: queries.filter(q => q.status === 'optimized').length,
    inProgress: queries.filter(q => q.status === 'in_progress').length,
    ready: queries.filter(q => q.status === 'ready').length,
    gaps: queries.filter(q => q.status === 'gap').length,
  };
}
