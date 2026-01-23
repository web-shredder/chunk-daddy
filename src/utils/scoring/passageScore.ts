/**
 * Passage Score Calculation
 * Master scoring function that combines all sub-scores
 * 
 * Formula: (retrievalScore × 0.40) + (rerankScore × 0.35) + (citationScore × 0.25)
 */

import { calculateRetrievalScore, calculateLexicalScore } from './retrievalScore';
import { 
  calculateRerankScore, 
  calculateEntityProminence, 
  calculateDirectAnswerScore, 
  calculateQueryRestatement,
  calculateStructuralClarity,
  extractQueryEntities 
} from './rerankScore';
import { calculateCitationScore } from './citationScore';

export interface PassageScoreResult {
  passageScore: number;
  retrievalScore: number;
  semanticSimilarity: number;
  lexicalScore: number;
  rerankScore: number;
  citationScore: number;
  entityOverlap: number;
  components: {
    entityProminence: number;
    directAnswerScore: number;
    structuralClarity: number;
    queryRestatement: number;
  };
}

/**
 * Calculate the full passage score with all components
 */
export function calculatePassageScore(
  query: string,
  content: string,
  semanticSimilarity: number,  // 0-1 from embedding comparison
  headings: string[] = []
): PassageScoreResult {
  
  // Extract query entities
  const queryEntities = extractQueryEntities(query);
  
  // Calculate lexical score
  const lexicalScore = calculateLexicalScore(content, query);
  
  // Calculate retrieval score (normalized semantic + lexical)
  const semanticNormalized = semanticSimilarity > 1 ? semanticSimilarity : semanticSimilarity * 100;
  const retrievalScore = calculateRetrievalScore(semanticNormalized, lexicalScore);
  
  // Calculate rerank components
  const entityProminence = calculateEntityProminence(content, queryEntities, headings);
  const directAnswerScore = calculateDirectAnswerScore(query, content);
  const structuralClarity = calculateStructuralClarity(content);
  const queryRestatement = calculateQueryRestatement(query, content);
  
  const rerankScore = calculateRerankScore(
    entityProminence,
    directAnswerScore,
    structuralClarity,
    queryRestatement
  );
  
  // Calculate citation score
  const citationScore = calculateCitationScore(content, query);
  
  // Calculate entity overlap
  const contentEntities = extractContentEntities(content);
  const entityOverlap = calculateEntityOverlap(queryEntities, contentEntities);
  
  // Final passage score
  const passageScore = (
    (retrievalScore * 0.40) +
    (rerankScore * 0.35) +
    (citationScore * 0.25)
  );
  
  return {
    passageScore: Math.round(passageScore),
    retrievalScore: Math.round(retrievalScore),
    semanticSimilarity: semanticNormalized,
    lexicalScore: Math.round(lexicalScore),
    rerankScore: Math.round(rerankScore),
    citationScore: Math.round(citationScore),
    entityOverlap: Math.round(entityOverlap),
    components: {
      entityProminence: Math.round(entityProminence),
      directAnswerScore: Math.round(directAnswerScore),
      structuralClarity: Math.round(structuralClarity),
      queryRestatement: Math.round(queryRestatement)
    }
  };
}

/**
 * Extract entities from content (simplified)
 */
function extractContentEntities(content: string): string[] {
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);
  return [...new Set(words)];
}

/**
 * Calculate entity overlap between query and content
 */
function calculateEntityOverlap(queryEntities: string[], contentEntities: string[]): number {
  if (queryEntities.length === 0) return 100;
  
  const matches = queryEntities.filter(qe => 
    contentEntities.some(ce => ce.includes(qe) || qe.includes(ce))
  ).length;
  
  return (matches / queryEntities.length) * 100;
}

// Re-export individual scoring functions for direct use
export { calculateRetrievalScore, calculateLexicalScore } from './retrievalScore';
export { 
  calculateRerankScore,
  calculateEntityProminence,
  calculateDirectAnswerScore,
  calculateStructuralClarity,
  calculateQueryRestatement,
  extractQueryEntities
} from './rerankScore';
export { 
  calculateCitationScore,
  calculateQuotability,
  calculateSpecificity,
  calculateAuthoritySignals,
  calculateSentenceStructure
} from './citationScore';
