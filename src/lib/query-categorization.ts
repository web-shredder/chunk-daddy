// ============================================================================
// QUERY CATEGORIZATION SYSTEM
// 4-Bucket categorization per Query Fanout System spec
// Category A: Optimization Opportunities (assignable to chunks)
// Category B: Content Gaps (related but low scores)
// Category C: Intent Drift (different user need)
// Category D: Out of Scope (too tangential)
// ============================================================================

// ============================================================================
// DEBUG LOGGING
// ============================================================================

const DEBUG = true; // Set to false in production

function debugLog(label: string, data: unknown) {
  if (DEBUG) {
    console.log(`[Categorization] ${label}:`, data);
  }
}

// ============================================================================
// CATEGORY TYPES
// ============================================================================

export type VariantCategory = 
  | 'OPTIMIZATION_OPPORTUNITY'
  | 'CONTENT_GAP'
  | 'INTENT_DRIFT'
  | 'OUT_OF_SCOPE';

export interface CategorizedVariant {
  // Original variant data
  query: string;
  variantType: string;
  
  // Scoring
  contentSimilarity: number;      // 0-1, semantic similarity to content
  bestChunkSimilarity: number;    // 0-1, similarity to best chunk
  bestChunkIndex: number | null;
  passageScore: number;           // 0-100
  
  // Intent analysis
  intentAnalysis: {
    category: string;
    stage: string;
    queryType: string;
    driftScore: number;           // 0-100
    driftLevel: 'none' | 'slight' | 'moderate' | 'high';
    driftReasoning: string | null;
  };
  
  // Entity analysis
  entityAnalysis: {
    variantEntities: string[];
    sharedEntities: string[];
    overlapPercent: number;       // 0-100
    missingEntities: string[];
  };
  
  // Categorization result
  category: VariantCategory;
  categoryReasoning: string;
  
  // Actionability
  actionable: {
    primaryAction: ActionType;
    assignedChunk?: {
      index: number;
      heading: string;
      currentScore: number;
    };
    gapDetails?: {
      missingConcepts: string[];
      recommendedSection: string;
      estimatedLength: string;
    };
    driftDetails?: {
      explanation: string;
      primaryIntent: string;
      variantIntent: string;
    };
  };
}

export type ActionType = 
  | 'ASSIGN_TO_CHUNK'
  | 'GENERATE_CONTENT_BRIEF'
  | 'FORCE_ASSIGN'
  | 'REPORT_DRIFT'
  | 'DELETE'
  | 'IGNORE';

export interface CategoryBreakdown {
  optimizationOpportunities: CategorizedVariant[];
  contentGaps: CategorizedVariant[];
  intentDrift: CategorizedVariant[];
  outOfScope: CategorizedVariant[];
}

export interface CategorizationSummary {
  total: number;
  byCategory: {
    optimization: number;
    gaps: number;
    drift: number;
    outOfScope: number;
  };
  averageScores: {
    contentSimilarity: number;
    passageScore: number;
    driftScore: number;
  };
}

// ============================================================================
// CATEGORIZATION THRESHOLDS
// ============================================================================

export const CATEGORIZATION_THRESHOLDS = {
  // Intent drift threshold (above this = Category C)
  DRIFT_THRESHOLD: 40,
  
  // Content similarity threshold (below this = Category D)
  SIMILARITY_THRESHOLD: 0.40,
  
  // Passage score threshold (below this = Category B, above = Category A)
  PASSAGE_SCORE_THRESHOLD: 40,
};

// ============================================================================
// CATEGORY METADATA (for UI display)
// ============================================================================

export const CATEGORY_META: Record<VariantCategory, {
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  OPTIMIZATION_OPPORTUNITY: {
    label: 'Optimization Opportunity',
    shortLabel: 'Optimize',
    description: 'Can be assigned to existing chunks for optimization',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  CONTENT_GAP: {
    label: 'Content Gap',
    shortLabel: 'Gap',
    description: 'Related to topic but no chunk covers it well',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  INTENT_DRIFT: {
    label: 'Intent Drift',
    shortLabel: 'Drift',
    description: 'Serves a different user need than primary query',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  OUT_OF_SCOPE: {
    label: 'Out of Scope',
    shortLabel: 'Skip',
    description: 'Too tangential to the content topic',
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-900/30',
    borderColor: 'border-slate-200 dark:border-slate-700',
  },
};

// ============================================================================
// CATEGORIZATION LOGIC
// ============================================================================

export function categorizeVariant(
  variant: {
    query: string;
    variantType: string;
    contentSimilarity: number;
    bestChunkSimilarity: number;
    bestChunkIndex: number | null;
    passageScore: number;
    intentAnalysis: CategorizedVariant['intentAnalysis'];
    entityAnalysis: CategorizedVariant['entityAnalysis'];
  },
  chunks: Array<{ heading: string }>
): CategorizedVariant {
  const { DRIFT_THRESHOLD, SIMILARITY_THRESHOLD, PASSAGE_SCORE_THRESHOLD } = CATEGORIZATION_THRESHOLDS;
  
  // Debug: Log input variant
  debugLog('Input variant', {
    query: variant.query,
    contentSimilarity: variant.contentSimilarity,
    passageScore: variant.passageScore,
    driftScore: variant.intentAnalysis.driftScore,
    bestChunkIndex: variant.bestChunkIndex,
  });
  
  let category: VariantCategory;
  let categoryReasoning: string;
  let actionable: CategorizedVariant['actionable'];
  
  // Decision tree from spec (order matters!)
  // 1. Check for Intent Drift first (Category C)
  if (variant.intentAnalysis.driftScore > DRIFT_THRESHOLD) {
    category = 'INTENT_DRIFT';
    categoryReasoning = `Drift score ${variant.intentAnalysis.driftScore} exceeds threshold (${DRIFT_THRESHOLD}). ${variant.intentAnalysis.driftReasoning || 'Different user intent detected.'}`;
    actionable = {
      primaryAction: 'REPORT_DRIFT',
      driftDetails: {
        explanation: variant.intentAnalysis.driftReasoning || 'This query serves a different user need than the primary query.',
        primaryIntent: `${variant.intentAnalysis.stage} stage`,
        variantIntent: `Different stage detected`,
      }
    };
  }
  // 2. Check for Out of Scope (Category D)
  else if (variant.contentSimilarity < SIMILARITY_THRESHOLD) {
    category = 'OUT_OF_SCOPE';
    categoryReasoning = `Content similarity ${(variant.contentSimilarity * 100).toFixed(0)}% is below threshold (${SIMILARITY_THRESHOLD * 100}%). Query is too tangential to content topic.`;
    actionable = {
      primaryAction: 'DELETE',
    };
  } 
  // 3. Check for Optimization Opportunity (Category A)
  else if (variant.passageScore >= PASSAGE_SCORE_THRESHOLD && variant.bestChunkIndex !== null) {
    category = 'OPTIMIZATION_OPPORTUNITY';
    categoryReasoning = `Passage score ${variant.passageScore.toFixed(0)} meets threshold (${PASSAGE_SCORE_THRESHOLD}). Chunk ${variant.bestChunkIndex + 1} can answer this query.`;
    actionable = {
      primaryAction: 'ASSIGN_TO_CHUNK',
      assignedChunk: {
        index: variant.bestChunkIndex,
        heading: chunks[variant.bestChunkIndex]?.heading || `Chunk ${variant.bestChunkIndex + 1}`,
        currentScore: variant.passageScore,
      }
    };
  } 
  // 4. Everything else is a Content Gap (Category B)
  else {
    category = 'CONTENT_GAP';
    categoryReasoning = `Related to content (similarity ${(variant.contentSimilarity * 100).toFixed(0)}%) but no chunk scores above threshold (best: ${variant.passageScore.toFixed(0)}). This is a coverage gap.`;
    actionable = {
      primaryAction: 'GENERATE_CONTENT_BRIEF',
      gapDetails: {
        missingConcepts: variant.entityAnalysis.missingEntities,
        recommendedSection: `New section addressing: ${variant.query}`,
        estimatedLength: '400-600 words',
      }
    };
  }
  
  // Debug: Log categorization result
  debugLog('Categorization result', {
    query: variant.query,
    category,
    reasoning: categoryReasoning,
    action: actionable.primaryAction,
  });
  
  return {
    ...variant,
    category,
    categoryReasoning,
    actionable,
  };
}

export function categorizeAllVariants(
  variants: Array<Parameters<typeof categorizeVariant>[0]>,
  chunks: Array<{ heading: string }>
): { categorized: CategorizedVariant[]; breakdown: CategoryBreakdown; summary: CategorizationSummary } {
  // Debug: Log start of batch categorization
  debugLog('Starting categorization', {
    totalVariants: variants.length,
    totalChunks: chunks.length,
  });
  const categorized = variants.map(v => categorizeVariant(v, chunks));
  
  const breakdown: CategoryBreakdown = {
    optimizationOpportunities: categorized.filter(v => v.category === 'OPTIMIZATION_OPPORTUNITY'),
    contentGaps: categorized.filter(v => v.category === 'CONTENT_GAP'),
    intentDrift: categorized.filter(v => v.category === 'INTENT_DRIFT'),
    outOfScope: categorized.filter(v => v.category === 'OUT_OF_SCOPE'),
  };
  
  const total = categorized.length || 1; // Avoid division by zero
  
  const summary: CategorizationSummary = {
    total: categorized.length,
    byCategory: {
      optimization: breakdown.optimizationOpportunities.length,
      gaps: breakdown.contentGaps.length,
      drift: breakdown.intentDrift.length,
      outOfScope: breakdown.outOfScope.length,
    },
    averageScores: {
      contentSimilarity: categorized.reduce((sum, v) => sum + v.contentSimilarity, 0) / total,
      passageScore: categorized.reduce((sum, v) => sum + v.passageScore, 0) / total,
      driftScore: categorized.reduce((sum, v) => sum + v.intentAnalysis.driftScore, 0) / total,
    },
  };
  
  // Debug: Log completion summary
  debugLog('Categorization complete', {
    total: summary.total,
    byCategory: summary.byCategory,
    averageScores: summary.averageScores,
  });
  
  return { categorized, breakdown, summary };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the count of actionable items (Categories A + B)
 */
export function getActionableCount(breakdown: CategoryBreakdown): number {
  return breakdown.optimizationOpportunities.length + breakdown.contentGaps.length;
}

/**
 * Get the count of items that should be reviewed (Categories C)
 */
export function getReviewCount(breakdown: CategoryBreakdown): number {
  return breakdown.intentDrift.length;
}

/**
 * Get the count of items that can be safely ignored (Category D)
 */
export function getIgnorableCount(breakdown: CategoryBreakdown): number {
  return breakdown.outOfScope.length;
}

/**
 * Calculate a "health score" based on category distribution
 * Higher score = more optimization opportunities, fewer gaps/drift
 */
export function calculateCategorizationHealth(summary: CategorizationSummary): number {
  if (summary.total === 0) return 100;
  
  const optimizationRatio = summary.byCategory.optimization / summary.total;
  const gapRatio = summary.byCategory.gaps / summary.total;
  const driftRatio = summary.byCategory.drift / summary.total;
  
  // Weighted score: optimization is good, gaps are okay, drift is bad
  const score = (optimizationRatio * 100) + (gapRatio * 50) - (driftRatio * 30);
  
  return Math.max(0, Math.min(100, score));
}
