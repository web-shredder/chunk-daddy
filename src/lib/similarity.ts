// Similarity calculation utilities for Chunk Daddy

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (1 = identical direction)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
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
 * Calculate cosine distance between two vectors (1 - cosine similarity)
 * Used as the distance metric within Chamfer distance
 */
export function cosineDistance(vecA: number[], vecB: number[]): number {
  const similarity = cosineSimilarity(vecA, vecB);
  return 1 - similarity;
}

/**
 * Calculate Chamfer distance between two SETS of embedding vectors
 * Used for multi-aspect embeddings (like Google's MUVERA)
 *
 * @param setA - Array of vectors (e.g., chunk aspect embeddings)
 * @param setB - Array of vectors (e.g., query aspect embeddings)
 * @returns Chamfer distance (lower = more similar)
 *
 * Example:
 * const chunkAspects = [[0.1, 0.2, ...], [0.3, 0.4, ...]] // 2 aspects
 * const queryAspects = [[0.5, 0.6, ...]] // 1 aspect
 * const distance = chamferDistance(chunkAspects, queryAspects)
 */
export function chamferDistance(setA: number[][], setB: number[][]): number {
  if (setA.length === 0 || setB.length === 0) {
    throw new Error("Both sets must contain at least one vector");
  }

  // Direction 1: For each vector in A, find nearest vector in B
  const distA = setA.map((vecA) => {
    const distances = setB.map((vecB) => cosineDistance(vecA, vecB));
    return Math.min(...distances);
  });

  // Direction 2: For each vector in B, find nearest vector in A
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
 */
export function chamferSimilarity(setA: number[][], setB: number[][]): number {
  const distance = chamferDistance(setA, setB);
  // Cosine distance ranges 0-2, so chamfer can range 0-4
  // Convert to similarity: lower distance = higher similarity
  return Math.max(0, 1 - distance / 4);
}

export interface SimilarityScores {
  cosine: number;
  euclidean: number;
  manhattan: number;
  dotProduct: number;
  chamfer: number;
}

/**
 * Calculate all similarity metrics between two vectors
 */
export function calculateAllMetrics(vecA: number[], vecB: number[]): SimilarityScores {
  return {
    cosine: cosineSimilarity(vecA, vecB),
    euclidean: euclideanDistance(vecA, vecB),
    manhattan: manhattanDistance(vecA, vecB),
    dotProduct: dotProduct(vecA, vecB),
    chamfer: chamferSimilarity(vecA, vecB),
  };
}

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
