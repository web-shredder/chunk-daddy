/**
 * Retrieval Score Calculation
 * Formula: (semantic × 0.70) + (lexical × 0.30)
 * 
 * As documented in scoreDefinitions.ts
 */

/**
 * Calculate the hybrid retrieval score combining semantic and lexical signals
 * @param semanticSimilarity - Cosine similarity score (0-1 or 0-100 scale)
 * @param lexicalScore - BM25-style lexical score (0-100 scale)
 * @returns Hybrid retrieval score (0-100)
 */
export function calculateRetrievalScore(
  semanticSimilarity: number,
  lexicalScore: number
): number {
  // Normalize semantic to 0-100 if needed
  const semanticNormalized = semanticSimilarity > 1 
    ? semanticSimilarity 
    : semanticSimilarity * 100;
  
  return (semanticNormalized * 0.70) + (lexicalScore * 0.30);
}

/**
 * Calculate BM25-style lexical score
 * Simplified version that measures term overlap with position weighting
 * @param content - The content to score
 * @param query - The query to match against
 * @returns Lexical score (0-100)
 */
export function calculateLexicalScore(content: string, query: string): number {
  const stopWords = new Set([
    'what', 'how', 'why', 'when', 'where', 'who', 'which',
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did',
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'into', 'through', 'during',
    'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'our'
  ]);

  const queryTerms = query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2 && !stopWords.has(t));

  if (queryTerms.length === 0) return 50; // Default for empty query

  const contentLower = content.toLowerCase();
  const first100Chars = contentLower.slice(0, 100);
  const first50Chars = contentLower.slice(0, 50);

  let matchedTerms = 0;
  let positionBonus = 0;
  let frequencyBonus = 0;

  queryTerms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = content.match(regex);
    
    if (matches && matches.length > 0) {
      matchedTerms++;
      
      // Frequency bonus (diminishing returns after 2-3 occurrences)
      frequencyBonus += Math.min(0.15, matches.length * 0.05);
      
      // Position bonus: terms in first 100 chars get extra weight
      if (first100Chars.includes(term)) {
        positionBonus += 0.1;
        // Extra bonus for first 50 chars
        if (first50Chars.includes(term)) {
          positionBonus += 0.1;
        }
      }
    }
  });

  const termCoverage = matchedTerms / queryTerms.length;
  const rawScore = termCoverage + positionBonus + frequencyBonus;
  
  return Math.min(100, rawScore * 100);
}
