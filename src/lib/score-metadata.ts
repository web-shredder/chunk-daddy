// Score metadata and quality utilities for Chunk Daddy

export interface ScoreMetadata {
  label: string;
  range: string;
  direction: 'higher' | 'lower';
  explanation: string;
  hasQuality: boolean;
}

export const SCORE_METADATA: Record<string, ScoreMetadata> = {
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
    explanation: "Multi-aspect coverage score. Measures how well all query aspects are addressed by content aspects. Used in Google's MUVERA system.",
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

export type ScoreQuality = 'excellent' | 'good' | 'fair' | 'weak' | 'poor';

export function getScoreQuality(metricKey: string, value: number): ScoreQuality | null {
  // Only calculate quality for metrics with absolute scales
  if (metricKey === 'cosine') {
    if (value >= 0.9) return 'excellent';
    if (value >= 0.7) return 'good';
    if (value >= 0.5) return 'fair';
    if (value >= 0.3) return 'weak';
    return 'poor';
  }
  
  if (metricKey === 'chamfer') {
    if (value >= 0.85) return 'excellent';
    if (value >= 0.7) return 'good';
    if (value >= 0.5) return 'fair';
    if (value >= 0.3) return 'weak';
    return 'poor';
  }
  
  // Distance metrics and dot product have no absolute quality scale
  return null;
}

export function getQualityColorClass(quality: ScoreQuality): string {
  switch (quality) {
    case 'excellent':
      return 'bg-green-500/15 text-green-500';
    case 'good':
      return 'bg-green-500/10 text-green-400';
    case 'fair':
      return 'bg-yellow-500/15 text-yellow-500';
    case 'weak':
      return 'bg-orange-500/15 text-orange-400';
    case 'poor':
      return 'bg-red-500/15 text-red-500';
  }
}
