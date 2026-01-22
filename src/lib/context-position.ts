/**
 * Context Position Estimation Module
 * 
 * Estimates where a chunk will appear in the LLM's context window
 * based on both retrieval (will it be fetched?) and rerank (where will it land?) scores.
 * 
 * This is critical for the "Lost in the Middle" problem:
 * - Positions 1-5: HIGH attention (~70% of citations)
 * - Positions 5-10: MODERATE attention
 * - Positions 10-15: LOW attention (lost in the middle)
 * - Positions 15-20: MODERATE attention (recency effect)
 */

export type PositionCategory = 'lead' | 'supporting' | 'middle' | 'trailing';
export type AttentionLevel = 'high' | 'medium' | 'low';

export interface PositionStrategy {
  description: string;
  recommendations: string[];
}

export interface PositionAnalysis {
  query: string;
  chunkIndex: number;
  hybridScore: number;
  rerankScore: number;
  effectiveScore: number;
  estimatedPosition: number;
  positionCategory: PositionCategory;
  attentionLevel: AttentionLevel;
  retrievalRerankGap: number;
  flaggedReason: string | null;
  strategy: PositionStrategy;
}

/**
 * Position-specific strategies for content optimization.
 * Based on the "Lost in the Middle" research and LLM attention patterns.
 */
export const POSITION_STRATEGIES: Record<PositionCategory, PositionStrategy> = {
  lead: {
    description: 'Positions 1-5. High LLM attention.',
    recommendations: [
      'Provide comprehensive answer (LLM may cite primarily from you)',
      'Include nuanced details (you have attention budget)',
      'Add caveats and edge cases',
    ],
  },
  supporting: {
    description: 'Positions 5-10. Moderate attention.',
    recommendations: [
      'Focus on unique angle not covered by lead chunks',
      'Provide specific data points (numbers, dates, names)',
      'Be quotable—include one strong, citable sentence',
    ],
  },
  middle: {
    description: 'Positions 10-15. LOW attention (lost in middle problem).',
    recommendations: [
      'Unlikely to be cited unless highly unique',
      'Consider restructuring to improve rerank score',
      'Or accept supporting role for niche queries',
    ],
  },
  trailing: {
    description: 'Positions 15-20. Some attention (recency effect).',
    recommendations: [
      'Include strong closing statement',
      'Make final sentence highly quotable',
      'Add clear call-to-action or conclusion',
    ],
  },
};

/**
 * Flag reasons for chunks with problematic score patterns.
 */
export const FLAG_REASONS = {
  high_retrieval_low_rerank: 'Chunk retrieves well but gets buried in reranking. Fix: improve entity prominence, add direct answer upfront.',
  high_rerank_low_retrieval: 'Chunk would rank well but may not be retrieved. Fix: add semantic/lexical alignment with query terms.',
  both_scores_low: 'Chunk scores poorly on both retrieval and rerank. Consider major restructuring or query reassignment.',
} as const;

export type FlagReason = keyof typeof FLAG_REASONS;

/**
 * Estimate where a chunk will appear in the LLM's context window.
 * 
 * Uses the MINIMUM of retrieval and rerank scores because:
 * - A chunk might retrieve well but rerank poorly → gets buried
 * - A chunk might rerank well but not retrieve at all → never seen
 * 
 * @param hybridScore - Retrieval score (semantic + lexical blend, 0-100)
 * @param rerankScore - Rerank score (entity prominence, direct answer, etc., 0-100)
 * @param query - The target query
 * @param chunkIndex - Index of the chunk in the document
 * @returns Full position analysis with strategy recommendations
 */
export function estimateContextPosition(
  hybridScore: number,
  rerankScore: number,
  query: string,
  chunkIndex: number
): PositionAnalysis {
  // Use minimum score - a chain is only as strong as its weakest link
  const effectiveScore = Math.min(hybridScore, rerankScore);
  
  // Calculate position and category based on effective score
  let estimatedPosition: number;
  let positionCategory: PositionCategory;
  let attentionLevel: AttentionLevel;
  
  if (effectiveScore >= 85) {
    // Top tier: positions 1-5
    estimatedPosition = Math.ceil((100 - effectiveScore) / 3);
    estimatedPosition = Math.max(1, Math.min(5, estimatedPosition));
    positionCategory = 'lead';
    attentionLevel = 'high';
  } else if (effectiveScore >= 75) {
    // Second tier: positions 5-10
    estimatedPosition = 5 + Math.ceil((85 - effectiveScore) / 2);
    estimatedPosition = Math.max(5, Math.min(10, estimatedPosition));
    positionCategory = 'supporting';
    attentionLevel = 'medium';
  } else if (effectiveScore >= 60) {
    // Third tier: positions 10-15 (LOST IN THE MIDDLE)
    estimatedPosition = 10 + Math.ceil((75 - effectiveScore) / 3);
    estimatedPosition = Math.max(10, Math.min(15, estimatedPosition));
    positionCategory = 'middle';
    attentionLevel = 'low';
  } else {
    // Fourth tier: positions 15-20+
    estimatedPosition = 15 + Math.ceil((60 - effectiveScore) / 5);
    estimatedPosition = Math.max(15, estimatedPosition);
    positionCategory = 'trailing';
    attentionLevel = 'low';
  }
  
  // Detect gaps between retrieval and rerank scores
  const retrievalRerankGap = hybridScore - rerankScore;
  let flaggedReason: string | null = null;
  
  if (retrievalRerankGap > 15) {
    // Retrieves well but reranks poorly - will get buried
    flaggedReason = 'high_retrieval_low_rerank';
  } else if (retrievalRerankGap < -15) {
    // Reranks well but doesn't retrieve - might be missed entirely
    flaggedReason = 'high_rerank_low_retrieval';
  } else if (hybridScore < 40 && rerankScore < 40) {
    // Both scores are low - needs major work
    flaggedReason = 'both_scores_low';
  }
  
  return {
    query,
    chunkIndex,
    hybridScore,
    rerankScore,
    effectiveScore,
    estimatedPosition,
    positionCategory,
    attentionLevel,
    retrievalRerankGap,
    flaggedReason,
    strategy: POSITION_STRATEGIES[positionCategory],
  };
}

/**
 * Batch estimate positions for multiple chunks against a single query.
 * Useful for understanding how a document's chunks will be distributed.
 */
export function estimateChunkPositions(
  chunks: Array<{ hybridScore: number; rerankScore: number }>,
  query: string
): PositionAnalysis[] {
  return chunks.map((chunk, index) =>
    estimateContextPosition(chunk.hybridScore, chunk.rerankScore, query, index)
  );
}

/**
 * Get a summary of position distribution for a set of chunks.
 */
export interface PositionDistribution {
  lead: number;
  supporting: number;
  middle: number;
  trailing: number;
  flaggedCount: number;
  avgEffectiveScore: number;
}

export function getPositionDistribution(
  analyses: PositionAnalysis[]
): PositionDistribution {
  const distribution: PositionDistribution = {
    lead: 0,
    supporting: 0,
    middle: 0,
    trailing: 0,
    flaggedCount: 0,
    avgEffectiveScore: 0,
  };
  
  if (analyses.length === 0) return distribution;
  
  let totalScore = 0;
  
  for (const analysis of analyses) {
    distribution[analysis.positionCategory]++;
    if (analysis.flaggedReason) distribution.flaggedCount++;
    totalScore += analysis.effectiveScore;
  }
  
  distribution.avgEffectiveScore = Math.round(totalScore / analyses.length);
  
  return distribution;
}

/**
 * Get human-readable explanation for a flag reason.
 */
export function getFlagExplanation(flagReason: string | null): string | null {
  if (!flagReason) return null;
  return FLAG_REASONS[flagReason as FlagReason] || flagReason;
}
