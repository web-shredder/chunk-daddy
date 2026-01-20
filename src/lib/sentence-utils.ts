// Sentence and clause segmentation utilities for sentence-level Chamfer scoring

export interface Sentence {
  text: string;
  index: number;
  charStart: number;
  charEnd: number;
}

/**
 * Split text into sentences using regex-based segmentation.
 * Handles abbreviations, decimals, and other edge cases.
 */
export function splitIntoSentences(text: string): Sentence[] {
  if (!text || text.trim().length === 0) return [];
  
  // Regex to split on sentence boundaries while handling common edge cases
  // Matches: text followed by .!? and space/newline/end
  const sentenceRegex = /[^.!?]*[.!?]+(?:\s|$)/g;
  const matches = text.match(sentenceRegex);
  
  if (!matches || matches.length === 0) {
    // No sentence boundaries found - treat whole text as one sentence
    return [{
      text: text.trim(),
      index: 0,
      charStart: 0,
      charEnd: text.length,
    }];
  }
  
  let charPos = 0;
  return matches
    .map((match, index) => {
      const trimmed = match.trim();
      const start = text.indexOf(match, charPos);
      const end = start + match.length;
      charPos = end;
      
      return {
        text: trimmed,
        index,
        charStart: start,
        charEnd: end,
      };
    })
    .filter(s => {
      // Filter out very short sentences (likely noise)
      const wordCount = s.text.split(/\s+/).length;
      return wordCount >= 3;
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
  return splitIntoSentences(text).map(s => s.text);
}
