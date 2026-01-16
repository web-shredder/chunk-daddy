// Similarity calculation utilities for Chunk Daddy

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (1 = identical direction)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
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
    throw new Error('Vectors must have the same length');
  }
  
  return Math.sqrt(
    vecA.reduce((sum, a, i) => sum + Math.pow(a - vecB[i], 2), 0)
  );
}

/**
 * Calculate Manhattan distance (L1) between two vectors
 * Lower = more similar
 */
export function manhattanDistance(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  return vecA.reduce((sum, a, i) => sum + Math.abs(a - vecB[i]), 0);
}

/**
 * Calculate dot product between two vectors
 */
export function dotProduct(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  return vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
}

/**
 * Calculate Chamfer distance between two vectors
 * Treats vector dimensions as point sets
 * Lower distance = higher similarity
 */
export function chamferDistance(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  // Forward direction: for each point in A, find distance to nearest point in B
  const forward = vecA.reduce((sum, a, i) => {
    const dist = Math.abs(a - vecB[i]);
    return sum + dist;
  }, 0) / vecA.length;
  
  // Backward direction: for each point in B, find distance to nearest point in A
  const backward = vecB.reduce((sum, b, i) => {
    const dist = Math.abs(b - vecA[i]);
    return sum + dist;
  }, 0) / vecB.length;
  
  return (forward + backward) / 2;
}

/**
 * Convert Chamfer distance to similarity score (0-1 range)
 * Higher = more similar
 */
export function chamferSimilarity(vecA: number[], vecB: number[]): number {
  const distance = chamferDistance(vecA, vecB);
  // Convert distance to similarity using exponential decay
  return Math.exp(-distance);
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
  const sign = improvement >= 0 ? '+' : '';
  return `${sign}${improvement.toFixed(2)}%`;
}

/**
 * Get color class based on score quality (for cosine similarity)
 */
export function getScoreColorClass(score: number): string {
  if (score >= 0.7) return 'text-green-600';
  if (score >= 0.5) return 'text-yellow-600';
  if (score >= 0.3) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Get color class based on improvement percentage
 */
export function getImprovementColorClass(improvement: number): string {
  if (improvement > 0) return 'text-green-600';
  if (improvement < 0) return 'text-red-600';
  return 'text-muted-foreground';
}
