// Similarity calculation utilities for Chunk Daddy

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (1 = identical direction)
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
 * Calculate cosine distance between two vectors (1 - cosine similarity)
 * Used as the distance metric within Chamfer distance
 */
export function cosineDistance(vecA: number[], vecB: number[]): number {
  const similarity = cosineSimilarity(vecA, vecB);
  return 1 - similarity;
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

/**
 * Calculate Chamfer distance between two SETS of embedding vectors.
 * Used for document-level coverage analysis.
 *
 * Measures bidirectional coverage:
 * - For each vector in setA (chunks), find nearest vector in setB (queries)
 * - For each vector in setB (queries), find nearest vector in setA (chunks)
 * - Average both directions
 *
 * @param setA - Array of vectors (e.g., all chunk embeddings)
 * @param setB - Array of vectors (e.g., all query embeddings)
 * @returns Chamfer distance (lower = more similar, ranges 0-4)
 */
export function chamferDistance(setA: number[][], setB: number[][]): number {
  if (setA.length === 0 || setB.length === 0) {
    throw new Error("Both sets must contain at least one vector");
  }

  // Validate all vectors have same dimensionality
  const dim = setA[0].length;
  if (!setA.every((v) => v.length === dim) || !setB.every((v) => v.length === dim)) {
    throw new Error("All vectors must have the same dimensionality");
  }

  // Direction 1: For each chunk vector, find nearest query vector
  const distA = setA.map((vecA) => {
    const distances = setB.map((vecB) => cosineDistance(vecA, vecB));
    return Math.min(...distances);
  });

  // Direction 2: For each query vector, find nearest chunk vector
  const distB = setB.map((vecB) => {
    const distances = setA.map((vecA) => cosineDistance(vecA, vecB));
    return Math.min(...distances);
  });

  // Average both directions
  const avgDistA = distA.reduce((sum, d) => sum + d, 0) / distA.length;
  const avgDistB = distB.reduce((sum, d) => sum + d, 0) / distB.length;

  return avgDistA + avgDistB;
}

/**
 * Convert Chamfer distance to similarity score (0-1 range)
 * Higher = more similar
 *
 * @param setA - Array of vectors (all chunk embeddings)
 * @param setB - Array of vectors (all query embeddings)
 * @returns Similarity score between 0 and 1
 */
export function chamferSimilarity(setA: number[][], setB: number[][]): number {
  if (setA.length === 0 || setB.length === 0) {
    return 0;
  }
  
  const distance = chamferDistance(setA, setB);
  // Cosine distance ranges 0-2, so chamfer can range 0-4
  // Convert to similarity: lower distance = higher similarity
  const similarity = Math.max(0, 1 - distance / 4);
  
  console.log('📊 [CHAMFER] Document-level calculation:', {
    chunkVectors: setA.length,
    queryVectors: setB.length,
    chamferSimilarity: similarity.toFixed(4),
  });
  
  return similarity;
}

export interface SimilarityScores {
  cosine: number;
  euclidean: number;
  manhattan: number;
  dotProduct: number;
  chamfer: number;
  passageScore: number;
}

/**
 * Calculate all similarity metrics between two vectors.
 * Used for general scoring. Chamfer is set to the provided document-level value
 * or defaults to the cosine value if not provided.
 */
export function calculateAllMetrics(vecA: number[], vecB: number[], documentChamfer?: number): SimilarityScores {
  const cosine = cosineSimilarity(vecA, vecB);
  const chamfer = documentChamfer ?? cosine; // Use document chamfer or fallback to cosine
  
  return {
    cosine,
    euclidean: euclideanDistance(vecA, vecB),
    manhattan: manhattanDistance(vecA, vecB),
    dotProduct: dotProduct(vecA, vecB),
    chamfer,
    passageScore: calculatePassageScore(cosine, chamfer),
  };
}

/**
 * Calculate Passage Score - composite retrieval probability metric
 * 
 * Combines cosine similarity (70%) and chamfer similarity (30%) to predict
 * how likely a passage is to be retrieved by RAG systems.
 * 
 * Path 5 Architecture:
 * - Cosine (70%): Chunk-level relevance - how well THIS chunk matches the query
 * - Chamfer (30%): Document-level coverage - how well the ENTIRE document covers all queries
 * 
 * Score interpretation:
 * - 90-100: Excellent retrieval probability (top 5 results)
 * - 75-89: Good retrieval probability (top 10 results)
 * - 60-74: Moderate retrieval probability (competitive)
 * - 40-59: Weak retrieval probability (depends on competition)
 * - 0-39: Poor retrieval probability (likely filtered out)
 * 
 * @param cosine - Chunk-level cosine similarity score (0-1)
 * @param chamfer - Document-level chamfer similarity score (0-1)
 * @returns Passage Score (0-100)
 */
export function calculatePassageScore(cosine: number, chamfer: number): number {
  // Normalize both to 0-1 range (they already are, but being explicit)
  const normalizedCosine = Math.max(0, Math.min(1, cosine));
  const normalizedChamfer = Math.max(0, Math.min(1, chamfer));
  
  // Weight: 70% cosine (chunk retrieval), 30% chamfer (document coverage)
  const weighted = (normalizedCosine * 0.7) + (normalizedChamfer * 0.3);
  
  // Scale to 0-100
  return Math.round(weighted * 100);
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
 * Get tier color classes for Passage Score display - using muted colors
 */
export function getPassageScoreTierColorClass(tier: PassageScoreTier): string {
  const colors: Record<PassageScoreTier, string> = {
    excellent: 'text-emerald-500',
    good: 'text-emerald-400',
    moderate: 'text-amber-500',
    weak: 'text-orange-500',
    poor: 'text-rose-400'
  };
  return colors[tier];
}

// Alias for backward compatibility
export const getDaddyScoreTierColorClass = getPassageScoreTierColorClass;

export function getPassageScoreTierBgClass(tier: PassageScoreTier): string {
  const colors: Record<PassageScoreTier, string> = {
    excellent: 'bg-emerald-500/15 text-emerald-500',
    good: 'bg-emerald-400/15 text-emerald-400',
    moderate: 'bg-amber-500/15 text-amber-500',
    weak: 'bg-orange-500/15 text-orange-500',
    poor: 'bg-rose-400/15 text-rose-400'
  };
  return colors[tier];
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
