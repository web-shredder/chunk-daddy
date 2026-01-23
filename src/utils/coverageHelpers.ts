/**
 * Coverage Tab Helpers
 * Utilities for transforming analysis data into coverage work items
 */

import type { QueryWorkItem, QueryStatus, QueryIntentType, QueryScores, AssignedChunk } from '@/types/coverage';
import type { ChunkScore } from '@/hooks/useAnalysis';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';
import { assignQueriesToChunks, getBestScoreForQuery, analyzeHeadingStructure } from './chunkAssignment';

// Threshold for considering a query to have a good match
const GOOD_MATCH_THRESHOLD = 45;

interface QueryInput {
  query: string;
  intentType?: string;
  variantType?: string;
}

/**
 * Transform queries and scoring results into QueryWorkItems for the Coverage tab
 * Uses 1:1 chunk assignment - each chunk can only be assigned to one query
 */
export function transformToWorkItems(
  queries: QueryInput[],
  chunkScores: ChunkScore[],
  chunks: LayoutAwareChunk[],
  queryIntentTypes?: Record<string, string>
): QueryWorkItem[] {
  // Get 1:1 assignments using greedy algorithm
  const queryItems = queries.map(q => ({ query: typeof q === 'string' ? q : q.query }));
  const assignments = assignQueriesToChunks(queryItems, chunkScores, chunks, GOOD_MATCH_THRESHOLD);
  
  // Derive all headings for gap placement analysis
  const allHeadings = chunks
    .map(c => c.headingPath?.[c.headingPath.length - 1])
    .filter((h): h is string => !!h);
  
  return queries.map((queryInput, index): QueryWorkItem => {
    const queryText = typeof queryInput === 'string' ? queryInput : queryInput.query;
    const intentType = getIntentType(queryInput, queryIntentTypes?.[queryText]);
    
    const assignedChunkIndex = assignments.get(index);
    const isGap = assignedChunkIndex === null || assignedChunkIndex === undefined;
    
    // Get scores for this assignment
    const scores = getBestScoreForQuery(queryText, assignedChunkIndex ?? null, chunkScores);
    
    // Build assigned chunk info if we have a match
    let assignedChunk: AssignedChunk | undefined;
    if (!isGap && assignedChunkIndex !== undefined && chunks[assignedChunkIndex]) {
      const chunk = chunks[assignedChunkIndex];
      assignedChunk = {
        index: assignedChunkIndex,
        heading: chunk.headingPath?.[chunk.headingPath.length - 1] || `Chunk ${assignedChunkIndex + 1}`,
        preview: truncateText(chunk.text, 100),
        headingPath: chunk.headingPath,
      };
    }
    
    // For gaps, analyze placement suggestion
    let suggestedPlacement: string | undefined;
    let suggestedHeading: string | undefined;
    if (isGap && allHeadings.length > 0) {
      const placement = analyzeHeadingStructure(allHeadings, queryText);
      suggestedPlacement = placement.suggestedAfter;
      suggestedHeading = placement.suggestedLevel;
    }
    
    return {
      id: crypto.randomUUID(),
      query: queryText,
      intentType,
      status: isGap ? 'gap' : 'ready',
      isGap,
      assignedChunk,
      originalScores: scores ? {
        passageScore: scores.passageScore,
        semanticSimilarity: scores.semanticSimilarity / 100, // Normalize back to 0-1
        lexicalScore: scores.lexicalScore,
        rerankScore: scores.rerankScore,
        citationScore: scores.citationScore,
        entityOverlap: scores.entityOverlap,
      } : undefined,
      isApproved: false,
      suggestedPlacement,
      suggestedHeading,
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

/**
 * Extract key concepts/terms from a query for gap analysis
 * Removes stop words and returns unique meaningful terms
 */
export function extractMissingConcepts(query: string): string[] {
  const stopWords = new Set([
    'what', 'how', 'why', 'when', 'where', 'who', 'which',
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did',
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'into', 'through', 'during',
    'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'our',
    'this', 'that', 'these', 'those', 'there', 'here',
    'about', 'over', 'under', 'between', 'before', 'after',
    'more', 'most', 'less', 'least', 'very', 'just', 'only',
    'some', 'any', 'all', 'each', 'every', 'both', 'few', 'many',
    'much', 'such', 'other', 'another', 'same', 'different'
  ]);
  
  const words = query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  // Return unique terms
  return [...new Set(words)];
}

/**
 * Extract heading from generated markdown content
 */
export function extractHeadingFromContent(content: string): string | undefined {
  // Look for markdown heading (## or #)
  const match = content.match(/^##?\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}
