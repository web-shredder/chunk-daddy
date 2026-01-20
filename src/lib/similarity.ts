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
 * Calculate Chamfer distance between two SETS of embedding vectors
 * Used for multi-aspect embeddings (like Google's MUVERA)
 *
 * Measures bidirectional coverage:
 * - For each vector in setA, find nearest vector in setB
 * - For each vector in setB, find nearest vector in setA
 * - Average both directions
 *
 * @param setA - Array of vectors (e.g., chunk aspect embeddings)
 * @param setB - Array of vectors (e.g., query aspect embeddings)
 * @returns Chamfer distance (lower = more similar, ranges 0-4)
 *
 * Example:
 * const chunkAspects = [[0.1, 0.2, ...], [0.3, 0.4, ...]]
 * const queryAspects = [[0.5, 0.6, ...]]
 * const distance = chamferDistance(chunkAspects, queryAspects)
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
 *
 * @param setA - Array of vectors
 * @param setB - Array of vectors
 * @returns Similarity score between 0 and 1
 */
export function chamferSimilarity(setA: number[][], setB: number[][]): number {
  // DIAGNOSTIC: Log input shapes
  console.log('🔬 [CHAMFER] Input shapes:', setA.length, 'vectors for chunk,', setB.length, 'vectors for query');
  
  const distance = chamferDistance(setA, setB);
  // Cosine distance ranges 0-2, so chamfer can range 0-4
  // Convert to similarity: lower distance = higher similarity
  const similarity = Math.max(0, 1 - distance / 4);
  
  // DIAGNOSTIC: Log if this is a singleton set (degenerates to cosine)
  if (setA.length === 1 && setB.length === 1) {
    const cosine = cosineSimilarity(setA[0], setB[0]);
    console.log('⚠️ [CHAMFER] SINGLETON SETS - Chamfer degenerates to cosine!', {
      chamfer: similarity.toFixed(4),
      cosine: cosine.toFixed(4),
      delta: Math.abs(similarity - cosine).toFixed(6),
    });
  }
  
  return similarity;
}

export interface SimilarityScores {
  cosine: number;
  euclidean: number;
  manhattan: number;
  dotProduct: number;
  chamfer: number;
  passageScore: number;
  // Sentence-level Chamfer metrics (optional, populated when sentence analysis is enabled)
  sentenceChamfer?: number;
  forwardCoverage?: number;
  backwardCoverage?: number;
  sentenceCount?: { chunk: number; query: number };
  sentenceMatches?: SentenceMatch[];
}

export interface SentenceMatch {
  querySentence: string;
  bestMatchChunkSentence: string;
  similarity: number;
}

export interface SentenceChamferResult {
  chamferSimilarity: number;
  chamferDistance: number;
  forwardCoverage: number;  // Query → Chunk: Does chunk cover all query aspects?
  backwardCoverage: number; // Chunk → Query: Is chunk focused on query-relevant content?
  sentenceMatches: SentenceMatch[];
}

/**
 * Calculate sentence-level Chamfer with directional coverage metrics.
 * 
 * @param chunkSentenceEmbeddings - Array of embeddings for chunk sentences
 * @param querySentenceEmbeddings - Array of embeddings for query clauses
 * @param chunkSentences - Original sentence texts (for diagnostics)
 * @param querySentences - Original query clause texts (for diagnostics)
 */
export function calculateSentenceChamfer(
  chunkSentenceEmbeddings: number[][],
  querySentenceEmbeddings: number[][],
  chunkSentences?: string[],
  querySentences?: string[]
): SentenceChamferResult {
  // Handle edge cases
  if (chunkSentenceEmbeddings.length === 0 || querySentenceEmbeddings.length === 0) {
    return {
      chamferSimilarity: 0,
      chamferDistance: 4, // Max distance
      forwardCoverage: 0,
      backwardCoverage: 0,
      sentenceMatches: [],
    };
  }
  
  // Use existing Chamfer functions for overall score
  const distance = chamferDistance(chunkSentenceEmbeddings, querySentenceEmbeddings);
  const similarity = chamferSimilarity(chunkSentenceEmbeddings, querySentenceEmbeddings);
  
  // Calculate directional coverage
  // Forward: For each query sentence, find best match in chunk
  const forwardDistances = querySentenceEmbeddings.map(qVec => {
    const distances = chunkSentenceEmbeddings.map(cVec => cosineDistance(qVec, cVec));
    return Math.min(...distances);
  });
  
  // Backward: For each chunk sentence, find best match in query
  const backwardDistances = chunkSentenceEmbeddings.map(cVec => {
    const distances = querySentenceEmbeddings.map(qVec => cosineDistance(cVec, qVec));
    return Math.min(...distances);
  });
  
  // Convert distances to coverage scores (0-1)
  // Cosine distance ranges 0-2, so divide by 2 to normalize
  const forwardCoverage = 1 - (
    forwardDistances.reduce((sum, d) => sum + d, 0) / forwardDistances.length / 2
  );
  const backwardCoverage = 1 - (
    backwardDistances.reduce((sum, d) => sum + d, 0) / backwardDistances.length / 2
  );
  
  // Build sentence matches for diagnostics (optional)
  let sentenceMatches: SentenceMatch[] = [];
  if (querySentences && chunkSentences && querySentences.length > 0 && chunkSentences.length > 0) {
    sentenceMatches = querySentenceEmbeddings.map((qVec, qi) => {
      const similarities = chunkSentenceEmbeddings.map(cVec => cosineSimilarity(qVec, cVec));
      const bestIdx = similarities.indexOf(Math.max(...similarities));
      return {
        querySentence: querySentences[qi] || '',
        bestMatchChunkSentence: chunkSentences[bestIdx] || '',
        similarity: similarities[bestIdx] || 0,
      };
    });
  }
  
  return {
    chamferSimilarity: similarity,
    chamferDistance: distance,
    forwardCoverage,
    backwardCoverage,
    sentenceMatches,
  };
}

/**
 * Calculate all similarity metrics between two vectors.
 * Note: Chamfer distance requires multi-aspect embeddings (number[][]),
 * so it returns degenerate single-vector Chamfer here. 
 * Use calculateSentenceChamfer() for true multi-aspect scoring.
 */
export function calculateAllMetrics(vecA: number[], vecB: number[]): SimilarityScores {
  // DIAGNOSTIC: Log that we're using single-vector mode (degenerate Chamfer)
  console.log('📊 [calculateAllMetrics] Using SINGLE VECTOR mode (Chamfer will equal Cosine)');
  
  const cosine = cosineSimilarity(vecA, vecB);
  const chamfer = chamferSimilarity([vecA], [vecB]);
  
  // DIAGNOSTIC: Compare scores
  console.log('📊 [calculateAllMetrics] Scores comparison:', {
    cosine: cosine.toFixed(4),
    chamfer: chamfer.toFixed(4),
    delta: Math.abs(cosine - chamfer).toFixed(6),
    passageScore: calculatePassageScore(cosine, chamfer),
  });
  
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
 * Calculate metrics with sentence-level Chamfer
 */
export function calculateAllMetricsWithSentenceChamfer(
  vecA: number[],
  vecB: number[],
  sentenceChamferResult: SentenceChamferResult,
  chunkSentenceCount: number,
  querySentenceCount: number
): SimilarityScores {
  const cosine = cosineSimilarity(vecA, vecB);
  
  // DIAGNOSTIC: Log sentence-level Chamfer mode
  console.log('🎯 [calculateAllMetricsWithSentenceChamfer] Using SENTENCE-LEVEL Chamfer!', {
    chunkSentences: chunkSentenceCount,
    queryClauses: querySentenceCount,
    cosine: cosine.toFixed(4),
    sentenceChamfer: sentenceChamferResult.chamferSimilarity.toFixed(4),
    delta: Math.abs(cosine - sentenceChamferResult.chamferSimilarity).toFixed(6),
    forwardCoverage: sentenceChamferResult.forwardCoverage.toFixed(4),
    backwardCoverage: sentenceChamferResult.backwardCoverage.toFixed(4),
  });
  
  // DIAGNOSTIC: Log if Chamfer differs meaningfully from Cosine
  const delta = Math.abs(cosine - sentenceChamferResult.chamferSimilarity);
  if (delta > 0.01) {
    console.log('✅ [CHAMFER MEANINGFUL] Delta > 0.01:', delta.toFixed(4));
  } else {
    console.log('⚠️ [CHAMFER ~= COSINE] Delta <= 0.01:', delta.toFixed(4));
  }
  
  return {
    cosine,
    euclidean: euclideanDistance(vecA, vecB),
    manhattan: manhattanDistance(vecA, vecB),
    dotProduct: dotProduct(vecA, vecB),
    chamfer: sentenceChamferResult.chamferSimilarity, // Now uses sentence-level
    passageScore: calculatePassageScore(cosine, sentenceChamferResult.chamferSimilarity),
    sentenceChamfer: sentenceChamferResult.chamferSimilarity,
    forwardCoverage: sentenceChamferResult.forwardCoverage,
    backwardCoverage: sentenceChamferResult.backwardCoverage,
    sentenceCount: { chunk: chunkSentenceCount, query: querySentenceCount },
    sentenceMatches: sentenceChamferResult.sentenceMatches,
  };
}

/**
 * Calculate Passage Score - composite retrieval probability metric
 * 
 * Combines cosine similarity (70%) and chamfer similarity (30%) to predict
 * how likely a passage is to be retrieved by RAG systems.
 * 
 * Score interpretation:
 * - 90-100: Excellent retrieval probability (top 5 results)
 * - 75-89: Good retrieval probability (top 10 results)
 * - 60-74: Moderate retrieval probability (competitive)
 * - 40-59: Weak retrieval probability (depends on competition)
 * - 0-39: Poor retrieval probability (likely filtered out)
 * 
 * @param cosine - Cosine similarity score (0-1)
 * @param chamfer - Chamfer similarity score (0-1)
 * @returns Passage Score (0-100)
 */
export function calculatePassageScore(cosine: number, chamfer: number): number {
  // Normalize both to 0-1 range (they already are, but being explicit)
  const normalizedCosine = Math.max(0, Math.min(1, cosine));
  const normalizedChamfer = Math.max(0, Math.min(1, chamfer));
  
  // Weight: 70% cosine (primary semantic relevance), 30% chamfer (multi-aspect coverage)
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
