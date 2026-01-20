// Sentence and clause segmentation utilities for sentence-level Chamfer scoring

// VERSION CHECK - If you see this in console, the latest code is running
const SENTENCE_UTILS_VERSION = 'v2-simplified-2024-01-20';
console.log('🔴 [SENTENCE-UTILS] Loaded version:', SENTENCE_UTILS_VERSION);

export interface Sentence {
  text: string;
  index: number;
  charStart: number;
  charEnd: number;
  wordCount: number;
}

/**
 * Split text into sentences using a multi-strategy approach.
 * Handles standard prose, markdown, and list-based content.
 */
export function splitIntoSentences(text: string): Sentence[] {
  // Show exactly what we're receiving, including hidden characters
  console.log('🔴 [SPLIT-INPUT] Raw text analysis:', {
    length: text?.length,
    newlineCount: (text?.match(/\n/g) || []).length,
    periodCount: (text?.match(/\./g) || []).length,
    first100: text?.substring(0, 100).replace(/\n/g, '↵'),
  });

  if (!text?.trim()) return [];
  
  // Simple approach: split on sentence endings (. ! ?) OR newlines
  // This handles both prose and markdown naturally
  const segments = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  // Filter out very short fragments (< 2 words) but keep reasonable ones
  const validSegments = segments.filter(s => {
    const wordCount = s.split(/\s+/).filter(w => w.length > 0).length;
    return wordCount >= 2;
  });
  
  console.log('🔬 [SENTENCE-SPLIT] Simple split:', {
    inputLength: text.length,
    rawSegments: segments.length,
    validSegments: validSegments.length,
    previews: validSegments.slice(0, 3).map(s => s.substring(0, 50))
  });
  
  // If splitting produced nothing useful, treat whole text as one unit
  if (validSegments.length === 0) {
    return [{
      text: text.trim(),
      index: 0,
      charStart: 0,
      charEnd: text.length,
      wordCount: text.split(/\s+/).length
    }];
  }
  
  let currentIndex = 0;
  return validSegments.map((segment, index) => {
    const startIndex = text.indexOf(segment, currentIndex);
    const endIndex = startIndex + segment.length;
    currentIndex = Math.max(currentIndex, endIndex);
    
    return {
      text: segment,
      index,
      charStart: startIndex >= 0 ? startIndex : 0,
      charEnd: endIndex,
      wordCount: segment.split(/\s+/).filter(w => w.length > 0).length
    };
  });
}

/**
 * Split a query into semantic clauses/aspects.
 * Queries often don't have sentence punctuation, so we split on
 * conjunctions, commas, and other clause boundaries.
 */
export function splitQueryIntoClauses(query: string): string[] {
  if (!query || query.trim().length === 0) return [];
  
  // First, try splitting on explicit clause markers
  const clauseMarkers = /[,;]|\s+and\s+|\s+or\s+|\s+but\s+|\s+while\s+|\s+when\s+|\s+if\s+/gi;
  
  const clauses = query
    .split(clauseMarkers)
    .map(c => c.trim())
    .filter(c => c.length > 0 && c.split(/\s+/).length >= 2); // Min 2 words
  
  // If no clauses found or only one, return the whole query
  if (clauses.length <= 1) {
    return [query.trim()];
  }
  
  return clauses;
}

/**
 * For longer queries, also try to identify distinct semantic aspects
 * by looking for question words and topic shifts.
 */
export function extractQueryAspects(query: string): string[] {
  const clauses = splitQueryIntoClauses(query);
  
  // If query has multiple question words, each might be a distinct aspect
  // But we already split by clauses, so just return those
  return clauses;
}

/**
 * Estimate the number of API calls needed for sentence-level analysis
 */
export function estimateSentenceEmbeddingCount(
  chunks: string[],
  queries: string[]
): { chunkSentences: number; queryClauses: number; total: number } {
  let chunkSentences = 0;
  let queryClauses = 0;
  
  chunks.forEach(chunk => {
    chunkSentences += splitIntoSentences(chunk).length;
  });
  
  queries.forEach(query => {
    queryClauses += splitQueryIntoClauses(query).length;
  });
  
  return {
    chunkSentences,
    queryClauses,
    total: chunkSentences + queryClauses,
  };
}

/**
 * Get sentence texts from text (convenience function)
 */
export function getSentenceTexts(text: string): string[] {
  console.log('🔍 [SENTENCE] getSentenceTexts called, length:', text?.length || 0);
  return splitIntoSentences(text).map(s => s.text);
}
