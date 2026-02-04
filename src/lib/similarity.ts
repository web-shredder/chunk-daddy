// Similarity calculation utilities for Chunk Daddy
// Simplified to use cosine similarity only (Gemini migration)

import { 
  getTierFromScore, 
  getTierDefinition, 
  getTierColors,
  getTierLabel,
  TIER_COLORS, 
  type ScoreTier 
} from './tier-colors';

// Re-export tier utilities for backward compatibility
export { getTierFromScore, getTierDefinition, getTierColors, getTierLabel, TIER_COLORS };
export type { ScoreTier };

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (1 = identical direction)
 * 
 * This is the PRIMARY scoring metric for RAG retrieval prediction.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  const dotProd = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProd / (magnitudeA * magnitudeB);
}

/**
 * Calculate Euclidean distance (L2) between two vectors
 * Lower = more similar
 */
export function euclideanDistance(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  return Math.sqrt(vecA.reduce((sum, a, i) => sum + Math.pow(a - vecB[i], 2), 0));
}

/**
 * Calculate Manhattan distance (L1) between two vectors
 * Lower = more similar
 */
export function manhattanDistance(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  return vecA.reduce((sum, a, i) => sum + Math.abs(a - vecB[i]), 0);
}

/**
 * Calculate dot product between two vectors
 */
export function dotProduct(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  return vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
}

export interface SimilarityScores {
  cosine: number;
  euclidean: number;
  manhattan: number;
  dotProduct: number;
  passageScore: number;
}

/**
 * Calculate all similarity metrics between two vectors.
 */
export function calculateAllMetrics(vecA: number[], vecB: number[]): SimilarityScores {
  const cosine = cosineSimilarity(vecA, vecB);
  
  return {
    cosine,
    euclidean: euclideanDistance(vecA, vecB),
    manhattan: manhattanDistance(vecA, vecB),
    dotProduct: dotProduct(vecA, vecB),
    passageScore: calculatePassageScore(cosine),
  };
}

/**
 * Calculate Passage Score - RAG retrieval probability metric
 * 
 * Simple formula: cosine similarity × 100
 * 
 * Uses Gemini's task-type differentiated embeddings (RETRIEVAL_QUERY vs RETRIEVAL_DOCUMENT)
 * which naturally handles query-document asymmetry without needing separate distance metrics.
 * 
 * Score interpretation:
 * - 90-100: Excellent retrieval probability (top 5 results)
 * - 75-89: Good retrieval probability (top 10 results)
 * - 60-74: Moderate retrieval probability (competitive)
 * - 40-59: Weak retrieval probability (depends on competition)
 * - 0-39: Poor retrieval probability (likely filtered out)
 * 
 * @param cosine - Cosine similarity score (0-1)
 * @returns Passage Score (0-100)
 */
export function calculatePassageScore(cosine: number): number {
  const normalized = Math.max(0, Math.min(1, cosine));
  return Math.round(normalized * 100);
}

// Keep old name as alias for backward compatibility
export const calculateDaddyScore = calculatePassageScore;

/**
 * Get Passage Score quality tier
 */
export type PassageScoreTier = 'excellent' | 'good' | 'moderate' | 'weak' | 'poor';

export function getPassageScoreTier(score: number): PassageScoreTier {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'moderate';
  if (score >= 40) return 'weak';
  return 'poor';
}

// Alias for backward compatibility
export const getDaddyScoreTier = getPassageScoreTier;

/**
 * Get interpretation text for Passage Score
 */
export function getPassageScoreInterpretation(score: number): string {
  const tier = getPassageScoreTier(score);
  
  const interpretations: Record<PassageScoreTier, string> = {
    excellent: 'High retrieval probability. Very likely to make top 5 results in RAG systems.',
    good: 'Good retrieval probability. Strong candidate for top 10 results.',
    moderate: 'Moderate retrieval probability. Competitive but depends on other content.',
    weak: 'Weak retrieval probability. May be retrieved if competition is low.',
    poor: 'Poor retrieval probability. Likely filtered out during initial retrieval.'
  };
  
  return interpretations[tier];
}

// Alias for backward compatibility  
export const getDaddyScoreInterpretation = getPassageScoreInterpretation;

/**
 * Get action recommendation based on Passage Score
 */
export function getPassageScoreRecommendation(score: number): string {
  const tier = getPassageScoreTier(score);
  
  const recommendations: Record<PassageScoreTier, string> = {
    excellent: 'Content is well-optimized. Monitor for changes and maintain quality.',
    good: 'Content performs well. Consider minor improvements to reach excellent tier.',
    moderate: 'Optimize passage boundaries, add context, or improve semantic relevance.',
    weak: 'Significant restructuring needed. Review heading hierarchy and passage atomicity.',
    poor: 'Major optimization required. Content may not be relevant to query or poorly structured.'
  };
  
  return recommendations[tier];
}

// Alias for backward compatibility
export const getDaddyScoreRecommendation = getPassageScoreRecommendation;

/**
 * Get tier color classes for Passage Score display
 * Now uses centralized tier-colors system
 */
export function getPassageScoreTierColorClass(tier: PassageScoreTier): string {
  return TIER_COLORS[tier].text;
}

// Alias for backward compatibility
export const getDaddyScoreTierColorClass = getPassageScoreTierColorClass;

export function getPassageScoreTierBgClass(tier: PassageScoreTier): string {
  return TIER_COLORS[tier].badge;
}

// Alias for backward compatibility
export const getDaddyScoreTierBgClass = getPassageScoreTierBgClass;

export function getPassageScoreBorderClass(_tier: PassageScoreTier): string {
  // Always return neutral border for design system compliance
  return 'border-border';
}

// Alias for backward compatibility
export const getDaddyScoreBorderClass = getPassageScoreBorderClass;

/**
 * Calculate improvement percentage between two scores
 */
export function calculateImprovement(originalScore: number, newScore: number): number {
  if (originalScore === 0) return newScore > 0 ? 100 : 0;
  return ((newScore - originalScore) / Math.abs(originalScore)) * 100;
}

/**
 * Format score for display
 */
export function formatScore(score: number, decimals: number = 4): string {
  return score.toFixed(decimals);
}

/**
 * Format improvement percentage for display
 */
export function formatImprovement(improvement: number): string {
  const sign = improvement >= 0 ? "+" : "";
  return `${sign}${improvement.toFixed(2)}%`;
}

/**
 * Get color class based on score quality (for cosine similarity)
 */
export function getScoreColorClass(score: number): string {
  if (score >= 0.7) return "text-green-600";
  if (score >= 0.5) return "text-yellow-600";
  if (score >= 0.3) return "text-orange-600";
  return "text-red-600";
}

/**
 * Get color class based on improvement percentage
 */
export function getImprovementColorClass(improvement: number): string {
  if (improvement > 0) return "text-green-600";
  if (improvement < 0) return "text-red-600";
  return "text-muted-foreground";
}

// ============================================================
// BACKWARD COMPATIBILITY - Deprecated functions
// These are kept for backward compatibility but do nothing
// ============================================================

/**
 * @deprecated Chamfer distance is no longer used. Returns cosine similarity.
 */
export function chamferSimilarity(setA: number[][], setB: number[][]): number {
  // With Gemini's task-type embeddings, we don't need Chamfer distance
  // For backward compatibility, if single vectors are passed, use cosine
  if (setA.length === 1 && setB.length === 1) {
    return cosineSimilarity(setA[0], setB[0]);
  }
  // For multiple vectors, average cosine between all pairs
  if (setA.length === 0 || setB.length === 0) return 0;
  
  let totalSimilarity = 0;
  let count = 0;
  for (const vecA of setA) {
    for (const vecB of setB) {
      totalSimilarity += cosineSimilarity(vecA, vecB);
      count++;
    }
  }
  return count > 0 ? totalSimilarity / count : 0;
}

/**
 * @deprecated Chamfer distance is no longer used.
 */
export function chamferDistance(setA: number[][], setB: number[][]): number {
  return 1 - chamferSimilarity(setA, setB);
}

/**
 * @deprecated Cosine distance is no longer used directly.
 */
export function cosineDistance(vecA: number[], vecB: number[]): number {
  return 1 - cosineSimilarity(vecA, vecB);
}
