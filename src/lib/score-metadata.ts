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
    explanation: 'Composite retrieval probability metric. Combines cosine (70%) and chamfer (30%) similarity to predict how likely this passage is to be retrieved by RAG systems.',
    hasQuality: true
  },
  // Keep old key for backward compatibility
  daddyScore: {
    label: 'Passage Score',
    range: '0 to 100',
    direction: 'higher',
    explanation: 'Composite retrieval probability metric. Combines cosine (70%) and chamfer (30%) similarity to predict how likely this passage is to be retrieved by RAG systems.',
    hasQuality: true
  },
  cosine: {
    label: 'Cosine Similarity',
    range: '-1 to 1',
    direction: 'higher',
    explanation: 'Measures angle between vectors. 1 = identical direction, 0 = unrelated, -1 = opposite meaning. Standard metric for semantic similarity.',
    hasQuality: true
  },
  chamfer: {
    label: 'Chamfer Similarity',
    range: '0 to 1',
    direction: 'higher',
    explanation: "Multi-aspect coverage score. When sentence-level analysis is enabled, measures bidirectional coverage between chunk sentences and query clauses. Used in Google's MUVERA system.",
    hasQuality: true
  },
  sentenceChamfer: {
    label: 'Sentence Chamfer',
    range: '0 to 1',
    direction: 'higher',
    explanation: 'True multi-aspect coverage at sentence level. Measures how well individual chunk sentences match query intent aspects. More accurate than single-vector Chamfer.',
    hasQuality: true
  },
  forwardCoverage: {
    label: 'Query Coverage',
    range: '0 to 1',
    direction: 'higher',
    explanation: 'How well the chunk covers ALL aspects of the query. Low scores mean query aspects are missing from the chunk.',
    hasQuality: true
  },
  backwardCoverage: {
    label: 'Chunk Focus',
    range: '0 to 1',
    direction: 'higher',
    explanation: 'How focused the chunk is on query-relevant content vs noise/tangents. Low scores mean the chunk contains irrelevant material.',
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
  
  if (metricKey === 'chamfer' || metricKey === 'sentenceChamfer') {
    if (value >= 0.85) return 'excellent';
    if (value >= 0.7) return 'good';
    if (value >= 0.5) return 'moderate';
    if (value >= 0.3) return 'weak';
    return 'poor';
  }

  if (metricKey === 'forwardCoverage') {
    // Query coverage thresholds
    if (value >= 0.85) return 'excellent';
    if (value >= 0.75) return 'good';
    if (value >= 0.6) return 'moderate';
    if (value >= 0.45) return 'weak';
    return 'poor';
  }

  if (metricKey === 'backwardCoverage') {
    // Chunk focus thresholds (slightly lower since chunks can have some context)
    if (value >= 0.8) return 'excellent';
    if (value >= 0.65) return 'good';
    if (value >= 0.5) return 'moderate';
    if (value >= 0.35) return 'weak';
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
