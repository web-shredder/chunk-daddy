// Score metadata and quality utilities for Chunk Daddy

import { getTierFromScore, TIER_COLORS, type ScoreTier } from './tier-colors';

export interface ScoreMetadata {
  label: string;
  range: string;
  direction: 'higher' | 'lower';
  explanation: string;
  hasQuality: boolean;
}

export const SCORE_METADATA: Record<string, ScoreMetadata> = {
  passageScore: {
    label: 'Passage Score',
    range: '0 to 100',
    direction: 'higher',
    explanation: 'Retrieval probability metric based on cosine similarity between chunk and query embeddings. Uses Gemini embeddings with task-type differentiation (RETRIEVAL_QUERY vs RETRIEVAL_DOCUMENT).',
    hasQuality: true
  },
  // Keep old key for backward compatibility
  daddyScore: {
    label: 'Passage Score',
    range: '0 to 100',
    direction: 'higher',
    explanation: 'Retrieval probability metric based on cosine similarity between chunk and query embeddings.',
    hasQuality: true
  },
  cosine: {
    label: 'Cosine Similarity',
    range: '-1 to 1',
    direction: 'higher',
    explanation: 'Measures angle between vectors. 1 = identical direction, 0 = unrelated, -1 = opposite meaning. The primary metric for semantic similarity.',
    hasQuality: true
  },
  euclidean: {
    label: 'Euclidean Distance',
    range: '0 to ∞',
    direction: 'lower',
    explanation: 'Straight-line distance in embedding space. No absolute scale - compare across chunks to find nearest neighbors. 0 = identical vectors.',
    hasQuality: false
  },
  manhattan: {
    label: 'Manhattan Distance',
    range: '0 to ∞',
    direction: 'lower',
    explanation: 'Sum of dimensional differences (taxicab distance). No absolute scale - compare across chunks to find nearest neighbors. 0 = identical vectors.',
    hasQuality: false
  },
  dotProduct: {
    label: 'Dot Product',
    range: 'varies',
    direction: 'higher',
    explanation: 'Measures both magnitude and direction alignment. No fixed range - compare across chunks. Higher values indicate stronger alignment.',
    hasQuality: false
  }
};

// Use ScoreTier from tier-colors for consistency (renamed from 'fair' to 'moderate')
export type ScoreQuality = ScoreTier;

export function getScoreQuality(metricKey: string, value: number): ScoreQuality | null {
  // Only calculate quality for metrics with absolute scales
  if (metricKey === 'cosine') {
    if (value >= 0.9) return 'excellent';
    if (value >= 0.7) return 'good';
    if (value >= 0.5) return 'moderate';
    if (value >= 0.3) return 'weak';
    return 'poor';
  }

  if (metricKey === 'passageScore' || metricKey === 'daddyScore') {
    // Use the centralized tier system
    return getTierFromScore(value);
  }
  
  // Distance metrics and dot product have no absolute quality scale
  return null;
}

export function getQualityColorClass(quality: ScoreQuality): string {
  // Use centralized tier colors
  return TIER_COLORS[quality].badge;
}
