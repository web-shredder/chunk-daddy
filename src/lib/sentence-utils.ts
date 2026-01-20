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
  
  // Detect if content is markdown-structured
  const isMarkdown = text.includes('**') || text.includes('- ') || /^\d+\./m.test(text) || text.includes('\n\n');
  
  // Strategy 0: Markdown-structure splitting (PRIMARY for markdown content)
  if (isMarkdown) {
    const structuralSegments = text
      // Split on numbered list items like "1. **" or "2. **"
      .split(/(?=\d+\.\s+\*\*)/)
      // Also split on bullet points with bold
      .flatMap(segment => segment.split(/(?=[-*•]\s+\*\*)/))
      // Also split on double newlines
      .flatMap(segment => segment.split(/\n\n+/))
      // Also split on single newlines followed by bullets or numbers
      .flatMap(segment => segment.split(/\n(?=[-*•]\s)/))
      .flatMap(segment => segment.split(/\n(?=\d+\.\s)/))
      .map(s => s.trim())
      .filter(s => s.length > 10);
    
    console.log('🔬 [SENTENCE-SPLIT] Strategy 0 (markdown-structure):', {
      inputLength: text.length,
      segments: structuralSegments.length,
      preview: structuralSegments.slice(0, 3).map(s => s.substring(0, 50) + '...'),
    });
    
    if (structuralSegments.length > 1) {
      segments = structuralSegments;
      usedStrategy = 'markdown-structure';
    }
  }
  
  // Strategy 1: Standard sentence boundaries (if markdown didn't work)
  if (segments.length <= 1) {
    // Pre-process: protect numbered list periods from being treated as sentence ends
    const protectedText = text.replace(/(\d+)\.\s+/g, '$1⏸ ');
    const sentenceRegex = /[^.!?]*[.!?]+(?:\s|$)/g;
    const matches = protectedText.match(sentenceRegex);
    
    console.log('🔬 [SENTENCE-SPLIT] Strategy 1 (regex):', {
      inputLength: text.length,
      matchesFound: matches?.length || 0,
    });
    
    if (matches && matches.length > 1) {
      // Restore protected characters
      segments = matches
        .map(m => m.replace(/(\d+)⏸/g, '$1.').trim())
        .filter(m => m.length > 0);
      usedStrategy = 'sentence-regex';
    }
  }
  
  // Strategy 2: Split on any newlines (for content without clear sentence markers)
  if (segments.length <= 1) {
    const lines = text.split(/\n+/).filter(s => s.trim().length > 10);
    
    console.log('🔬 [SENTENCE-SPLIT] Strategy 2 (newline):', {
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
  const beforeFilter = segments.map((segment, index) => {
    const trimmed = segment.trim();
    // Clean up markdown artifacts but preserve content
    const cleaned = trimmed
      .replace(/^[-*•]\s*/, '') // Remove leading bullet points
      .replace(/^\d+\.\s*/, '') // Remove leading numbered list markers
      .replace(/^#+\s*/, '') // Remove heading markers
      .trim();
    
    const start = text.indexOf(segment, charPos);
    const end = start + segment.length;
    charPos = Math.max(charPos, end);
    
    const wordCount = cleaned.split(/\s+/).filter(w => w.length > 0).length;
    
    return {
      text: cleaned,
      index,
      charStart: start >= 0 ? start : 0,
      charEnd: end,
      wordCount,
    };
  });
  
  // Log what we're about to filter
  console.log('🔬 [SENTENCE-SPLIT] Pre-filter:', beforeFilter.map(s => ({
    text: s.text.substring(0, 40),
    wordCount: s.wordCount,
  })));
  
  // Filter with relaxed criteria
  const result = beforeFilter.filter(s => s.wordCount >= 2 && s.text.length > 5);
  
  console.log('🔬 [SENTENCE-SPLIT] Final:', {
    strategy: usedStrategy,
    beforeFilter: beforeFilter.length,
    afterFilter: result.length,
    filtered: beforeFilter.length - result.length,
    sentences: result.map(s => s.text.substring(0, 40) + '...'),
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
