/**
 * SINGLE SOURCE OF TRUTH for score tier definitions
 * All components should import from here - do not define tier colors elsewhere
 */

export type ScoreTier = 'excellent' | 'good' | 'moderate' | 'weak' | 'poor';

export interface TierDefinition {
  name: ScoreTier;
  label: string;
  minScore: number;
  maxScore: number;
  description: string;
}

/**
 * Score tier definitions with thresholds
 * Excellent: 90-100, Good: 75-89, Moderate: 60-74, Weak: 40-59, Poor: 0-39
 */
export const TIER_DEFINITIONS: TierDefinition[] = [
  { name: 'excellent', label: 'Excellent', minScore: 90, maxScore: 100, description: 'Very high retrieval probability' },
  { name: 'good', label: 'Good', minScore: 75, maxScore: 89, description: 'Strong candidate for top results' },
  { name: 'moderate', label: 'Moderate', minScore: 60, maxScore: 74, description: 'Competitive, depends on other content' },
  { name: 'weak', label: 'Weak', minScore: 40, maxScore: 59, description: 'Low retrieval probability' },
  { name: 'poor', label: 'Poor', minScore: 0, maxScore: 39, description: 'Likely filtered out' },
];

/**
 * Get tier from numeric score
 */
export function getTierFromScore(score: number): ScoreTier {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'moderate';
  if (score >= 40) return 'weak';
  return 'poor';
}

/**
 * Get tier definition from score
 */
export function getTierDefinition(score: number): TierDefinition {
  const tier = getTierFromScore(score);
  return TIER_DEFINITIONS.find(t => t.name === tier)!;
}

/**
 * Tailwind classes for tier colors
 * Uses CSS custom properties defined in index.css
 */
export const TIER_COLORS: Record<ScoreTier, {
  text: string;
  bg: string;
  border: string;
  borderLeft: string;
  badge: string;
}> = {
  excellent: {
    text: 'text-[hsl(var(--tier-excellent))]',
    bg: 'bg-[hsl(var(--tier-excellent-bg))]',
    border: 'border-[hsl(var(--tier-excellent))]',
    borderLeft: 'border-l-[hsl(var(--tier-excellent))]',
    badge: 'bg-[hsl(var(--tier-excellent-bg))] text-[hsl(var(--tier-excellent))] border-[hsl(var(--tier-excellent)/0.3)]',
  },
  good: {
    text: 'text-[hsl(var(--tier-good))]',
    bg: 'bg-[hsl(var(--tier-good-bg))]',
    border: 'border-[hsl(var(--tier-good))]',
    borderLeft: 'border-l-[hsl(var(--tier-good))]',
    badge: 'bg-[hsl(var(--tier-good-bg))] text-[hsl(var(--tier-good))] border-[hsl(var(--tier-good)/0.3)]',
  },
  moderate: {
    text: 'text-[hsl(var(--tier-moderate))]',
    bg: 'bg-[hsl(var(--tier-moderate-bg))]',
    border: 'border-[hsl(var(--tier-moderate))]',
    borderLeft: 'border-l-[hsl(var(--tier-moderate))]',
    badge: 'bg-[hsl(var(--tier-moderate-bg))] text-[hsl(var(--tier-moderate))] border-[hsl(var(--tier-moderate)/0.3)]',
  },
  weak: {
    text: 'text-[hsl(var(--tier-weak))]',
    bg: 'bg-[hsl(var(--tier-weak-bg))]',
    border: 'border-[hsl(var(--tier-weak))]',
    borderLeft: 'border-l-[hsl(var(--tier-weak))]',
    badge: 'bg-[hsl(var(--tier-weak-bg))] text-[hsl(var(--tier-weak))] border-[hsl(var(--tier-weak)/0.3)]',
  },
  poor: {
    text: 'text-[hsl(var(--tier-poor))]',
    bg: 'bg-[hsl(var(--tier-poor-bg))]',
    border: 'border-[hsl(var(--tier-poor))]',
    borderLeft: 'border-l-[hsl(var(--tier-poor))]',
    badge: 'bg-[hsl(var(--tier-poor-bg))] text-[hsl(var(--tier-poor))] border-[hsl(var(--tier-poor)/0.3)]',
  },
};

/**
 * Get color classes for a score
 */
export function getTierColors(score: number) {
  const tier = getTierFromScore(score);
  return TIER_COLORS[tier];
}

/**
 * Get tier label for a score
 */
export function getTierLabel(score: number): string {
  return getTierDefinition(score).label;
}

/**
 * Score change indicator colors
 * For showing +/- changes in optimization results
 */
export const SCORE_CHANGE_COLORS = {
  positive: 'text-[hsl(var(--success))]',
  negative: 'text-[hsl(var(--destructive))]',
  neutral: 'text-muted-foreground',
};

export function getScoreChangeColor(change: number): string {
  if (change > 0) return SCORE_CHANGE_COLORS.positive;
  if (change < 0) return SCORE_CHANGE_COLORS.negative;
  return SCORE_CHANGE_COLORS.neutral;
}
