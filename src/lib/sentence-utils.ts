// Sentence and clause segmentation utilities for sentence-level Chamfer scoring

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
  if (!text || text.trim().length === 0) return [];
  
  let segments: string[] = [];
  let usedStrategy = 'none';
  
  // Strategy 1: Try standard sentence boundaries first
  const sentenceRegex = /[^.!?]*[.!?]+(?:\s|$)/g;
  const matches = text.match(sentenceRegex);
  
  console.log('🔬 [SENTENCE-SPLIT] Strategy 1 (regex):', {
    inputLength: text.length,
    inputPreview: text.substring(0, 100).replace(/\n/g, '\\n') + '...',
    matchesFound: matches?.length || 0,
  });
  
  if (matches && matches.length > 1) {
    segments = matches.map(m => m.trim()).filter(m => m.length > 0);
    usedStrategy = 'sentence-regex';
  }
  
  // Strategy 2: If that fails or returns too few, split on markdown patterns
  if (segments.length <= 1) {
    // Split on: double newlines, bullet points, numbered lists, or lines starting with capital letters
    const markdownSplitRegex = /\n\n+|\n(?=[-*•]\s)|\n(?=\d+\.\s)/g;
    const markdownSegments = text.split(markdownSplitRegex).filter(s => s.trim().length > 0);
    
    console.log('🔬 [SENTENCE-SPLIT] Strategy 2 (markdown):', {
      previousSegments: segments.length,
      markdownSegments: markdownSegments.length,
    });
    
    if (markdownSegments.length > 1) {
      segments = markdownSegments.map(s => s.trim());
      usedStrategy = 'markdown-split';
    }
  }
  
  // Strategy 3: If still only 1 segment and it's long, split on any newline
  if (segments.length <= 1 && text.length > 200) {
    const lines = text.split(/\n+/).filter(s => s.trim().length > 10);
    
    console.log('🔬 [SENTENCE-SPLIT] Strategy 3 (newline):', {
      previousSegments: segments.length,
      lineCount: lines.length,
    });
    
    if (lines.length > 1) {
      segments = lines.map(s => s.trim());
      usedStrategy = 'newline-split';
    }
  }
  
  // Fallback: treat whole text as one sentence
  if (segments.length === 0) {
    const wordCount = text.trim().split(/\s+/).length;
    console.log('🔬 [SENTENCE-SPLIT] Fallback: single sentence', { wordCount });
    return [{
      text: text.trim(),
      index: 0,
      charStart: 0,
      charEnd: text.length,
      wordCount,
    }];
  }
  
  // Build sentence objects with metadata
  let charPos = 0;
  const result = segments
    .map((segment, index) => {
      const trimmed = segment.trim();
      // Clean up markdown artifacts
      const cleaned = trimmed
        .replace(/^[-*•]\s*/, '') // Remove bullet points
        .replace(/^\d+\.\s*/, '') // Remove numbered list markers
        .replace(/^#+\s*/, '') // Remove heading markers
        .trim();
      
      const start = text.indexOf(segment, charPos);
      const end = start + segment.length;
      charPos = end;
      
      const wordCount = cleaned.split(/\s+/).filter(w => w.length > 0).length;
      
      return {
        text: cleaned,
        index,
        charStart: start >= 0 ? start : 0,
        charEnd: end,
        wordCount,
      };
    })
    .filter(s => s.wordCount >= 2); // Lower threshold from 3 to 2
  
  console.log('🔬 [SENTENCE-SPLIT] Result:', {
    strategy: usedStrategy,
    sentencesFound: result.length,
    avgWordsPerSentence: result.length > 0 
      ? Math.round(result.reduce((sum, s) => sum + s.wordCount, 0) / result.length)
      : 0,
    firstSentence: result[0]?.text.substring(0, 60) + '...',
  });
  
  return result;
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
