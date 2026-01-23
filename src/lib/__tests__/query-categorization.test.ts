import { describe, it, expect } from 'vitest';
import { 
  categorizeVariant, 
  categorizeAllVariants,
  CATEGORIZATION_THRESHOLDS,
} from '../query-categorization';

// Test fixtures
const mockChunks = [
  { heading: 'Introduction' },
  { heading: 'Implementation Timeline' },
  { heading: 'Evaluation Criteria' },
];

describe('Query Categorization', () => {
  describe('CATEGORIZATION_THRESHOLDS', () => {
    it('should have correct threshold values', () => {
      expect(CATEGORIZATION_THRESHOLDS.DRIFT_THRESHOLD).toBe(40);
      expect(CATEGORIZATION_THRESHOLDS.SIMILARITY_THRESHOLD).toBe(0.40);
      expect(CATEGORIZATION_THRESHOLDS.PASSAGE_SCORE_THRESHOLD).toBe(40);
    });
  });

  describe('categorizeVariant', () => {
    it('should categorize high-scoring variant as OPTIMIZATION_OPPORTUNITY', () => {
      const variant = {
        query: 'RPO implementation timeline',
        variantType: 'SPECIFICATION',
        contentSimilarity: 0.75,
        bestChunkSimilarity: 0.72,
        bestChunkIndex: 1,
        passageScore: 72,
        intentAnalysis: {
          category: 'commercial_investigation',
          stage: 'consideration',
          queryType: 'how_to',
          driftScore: 10,
          driftLevel: 'none' as const,
          driftReasoning: null,
        },
        entityAnalysis: {
          variantEntities: ['RPO', 'implementation', 'timeline'],
          sharedEntities: ['RPO', 'implementation'],
          overlapPercent: 67,
          missingEntities: ['timeline'],
        },
      };
      
      const result = categorizeVariant(variant, mockChunks);
      
      expect(result.category).toBe('OPTIMIZATION_OPPORTUNITY');
      expect(result.actionable.primaryAction).toBe('ASSIGN_TO_CHUNK');
      expect(result.actionable.assignedChunk?.index).toBe(1);
      expect(result.actionable.assignedChunk?.heading).toBe('Implementation Timeline');
    });
    
    it('should categorize low-scoring variant as CONTENT_GAP', () => {
      const variant = {
        query: 'RPO implementation risks',
        variantType: 'FOLLOW_UP',
        contentSimilarity: 0.52,
        bestChunkSimilarity: 0.35,
        bestChunkIndex: 1,
        passageScore: 35,
        intentAnalysis: {
          category: 'commercial_investigation',
          stage: 'consideration',
          queryType: 'how_to',
          driftScore: 15,
          driftLevel: 'none' as const,
          driftReasoning: null,
        },
        entityAnalysis: {
          variantEntities: ['RPO', 'implementation', 'risks'],
          sharedEntities: ['RPO'],
          overlapPercent: 33,
          missingEntities: ['implementation', 'risks'],
        },
      };
      
      const result = categorizeVariant(variant, mockChunks);
      
      expect(result.category).toBe('CONTENT_GAP');
      expect(result.actionable.primaryAction).toBe('GENERATE_CONTENT_BRIEF');
      expect(result.actionable.gapDetails).toBeDefined();
      expect(result.actionable.gapDetails?.missingConcepts).toContain('implementation');
    });
    
    it('should categorize high-drift variant as INTENT_DRIFT', () => {
      const variant = {
        query: 'what is recruitment process outsourcing',
        variantType: 'EQUIVALENT',
        contentSimilarity: 0.65,
        bestChunkSimilarity: 0.55,
        bestChunkIndex: 0,
        passageScore: 55,
        intentAnalysis: {
          category: 'informational',
          stage: 'awareness',
          queryType: 'definition',
          driftScore: 80,
          driftLevel: 'high' as const,
          driftReasoning: 'Primary is consideration stage, variant is awareness stage',
        },
        entityAnalysis: {
          variantEntities: ['recruitment', 'process', 'outsourcing'],
          sharedEntities: ['recruitment'],
          overlapPercent: 33,
          missingEntities: ['process', 'outsourcing'],
        },
      };
      
      const result = categorizeVariant(variant, mockChunks);
      
      expect(result.category).toBe('INTENT_DRIFT');
      expect(result.actionable.primaryAction).toBe('REPORT_DRIFT');
      expect(result.actionable.driftDetails).toBeDefined();
    });
    
    it('should categorize very low similarity as OUT_OF_SCOPE', () => {
      const variant = {
        query: 'best ATS software for small business',
        variantType: 'SPECIFICATION',
        contentSimilarity: 0.28,
        bestChunkSimilarity: 0.22,
        bestChunkIndex: null,
        passageScore: 22,
        intentAnalysis: {
          category: 'commercial_investigation',
          stage: 'consideration',
          queryType: 'selection_guide',
          driftScore: 20,
          driftLevel: 'none' as const,
          driftReasoning: null,
        },
        entityAnalysis: {
          variantEntities: ['ATS', 'software', 'small', 'business'],
          sharedEntities: [],
          overlapPercent: 0,
          missingEntities: ['ATS', 'software', 'small', 'business'],
        },
      };
      
      const result = categorizeVariant(variant, mockChunks);
      
      expect(result.category).toBe('OUT_OF_SCOPE');
      expect(result.actionable.primaryAction).toBe('DELETE');
    });

    it('should prioritize INTENT_DRIFT over OUT_OF_SCOPE when drift is high', () => {
      // Even with low similarity, high drift should categorize as INTENT_DRIFT
      const variant = {
        query: 'what is recruiting',
        variantType: 'CLARIFICATION',
        contentSimilarity: 0.30, // Below similarity threshold
        bestChunkSimilarity: 0.25,
        bestChunkIndex: null,
        passageScore: 25,
        intentAnalysis: {
          category: 'informational',
          stage: 'awareness',
          queryType: 'definition',
          driftScore: 85, // High drift
          driftLevel: 'high' as const,
          driftReasoning: 'Different intent detected',
        },
        entityAnalysis: {
          variantEntities: [],
          sharedEntities: [],
          overlapPercent: 0,
          missingEntities: [],
        },
      };
      
      const result = categorizeVariant(variant, mockChunks);
      
      // Intent drift check comes before similarity check
      expect(result.category).toBe('INTENT_DRIFT');
    });

    it('should categorize as CONTENT_GAP when similarity is good but passage score is low', () => {
      const variant = {
        query: 'RPO contract negotiation tips',
        variantType: 'FOLLOW_UP',
        contentSimilarity: 0.60, // Above similarity threshold
        bestChunkSimilarity: 0.30,
        bestChunkIndex: 0,
        passageScore: 30, // Below passage threshold
        intentAnalysis: {
          category: 'commercial_investigation',
          stage: 'consideration',
          queryType: 'how_to',
          driftScore: 10, // Low drift
          driftLevel: 'none' as const,
          driftReasoning: null,
        },
        entityAnalysis: {
          variantEntities: ['RPO', 'contract', 'negotiation'],
          sharedEntities: ['RPO'],
          overlapPercent: 33,
          missingEntities: ['contract', 'negotiation'],
        },
      };
      
      const result = categorizeVariant(variant, mockChunks);
      
      expect(result.category).toBe('CONTENT_GAP');
    });
  });
  
  describe('categorizeAllVariants', () => {
    it('should correctly distribute variants across categories', () => {
      const variants = [
        // Should be OPTIMIZATION_OPPORTUNITY
        {
          query: 'RPO provider selection criteria',
          variantType: 'EQUIVALENT',
          contentSimilarity: 0.82,
          bestChunkSimilarity: 0.78,
          bestChunkIndex: 2,
          passageScore: 78,
          intentAnalysis: { category: 'commercial_investigation', stage: 'consideration', queryType: 'selection_guide', driftScore: 0, driftLevel: 'none' as const, driftReasoning: null },
          entityAnalysis: { variantEntities: [], sharedEntities: [], overlapPercent: 80, missingEntities: [] },
        },
        // Should be CONTENT_GAP
        {
          query: 'RPO pricing models',
          variantType: 'FOLLOW_UP',
          contentSimilarity: 0.55,
          bestChunkSimilarity: 0.38,
          bestChunkIndex: 0,
          passageScore: 38,
          intentAnalysis: { category: 'commercial_investigation', stage: 'consideration', queryType: 'pricing', driftScore: 20, driftLevel: 'none' as const, driftReasoning: null },
          entityAnalysis: { variantEntities: [], sharedEntities: [], overlapPercent: 50, missingEntities: ['pricing'] },
        },
        // Should be INTENT_DRIFT
        {
          query: 'define RPO',
          variantType: 'CLARIFICATION',
          contentSimilarity: 0.60,
          bestChunkSimilarity: 0.45,
          bestChunkIndex: 0,
          passageScore: 45,
          intentAnalysis: { category: 'informational', stage: 'awareness', queryType: 'definition', driftScore: 75, driftLevel: 'high' as const, driftReasoning: 'Different intent stage' },
          entityAnalysis: { variantEntities: [], sharedEntities: [], overlapPercent: 30, missingEntities: [] },
        },
        // Should be OUT_OF_SCOPE
        {
          query: 'staffing agency vs temp agency',
          variantType: 'SPECIFICATION',
          contentSimilarity: 0.25,
          bestChunkSimilarity: 0.20,
          bestChunkIndex: null,
          passageScore: 20,
          intentAnalysis: { category: 'commercial_investigation', stage: 'consideration', queryType: 'comparison', driftScore: 30, driftLevel: 'slight' as const, driftReasoning: null },
          entityAnalysis: { variantEntities: [], sharedEntities: [], overlapPercent: 0, missingEntities: [] },
        },
      ];
      
      const { breakdown, summary } = categorizeAllVariants(variants, mockChunks);
      
      expect(summary.byCategory.optimization).toBe(1);
      expect(summary.byCategory.gaps).toBe(1);
      expect(summary.byCategory.drift).toBe(1);
      expect(summary.byCategory.outOfScope).toBe(1);
      expect(summary.total).toBe(4);
      
      expect(breakdown.optimizationOpportunities[0].query).toBe('RPO provider selection criteria');
      expect(breakdown.contentGaps[0].query).toBe('RPO pricing models');
      expect(breakdown.intentDrift[0].query).toBe('define RPO');
      expect(breakdown.outOfScope[0].query).toBe('staffing agency vs temp agency');
    });

    it('should calculate correct average scores', () => {
      const variants = [
        {
          query: 'test query 1',
          variantType: 'EQUIVALENT',
          contentSimilarity: 0.80,
          bestChunkSimilarity: 0.75,
          bestChunkIndex: 0,
          passageScore: 80,
          intentAnalysis: { category: 'commercial', stage: 'consideration', queryType: 'how_to', driftScore: 10, driftLevel: 'none' as const, driftReasoning: null },
          entityAnalysis: { variantEntities: [], sharedEntities: [], overlapPercent: 100, missingEntities: [] },
        },
        {
          query: 'test query 2',
          variantType: 'EQUIVALENT',
          contentSimilarity: 0.60,
          bestChunkSimilarity: 0.55,
          bestChunkIndex: 1,
          passageScore: 60,
          intentAnalysis: { category: 'commercial', stage: 'consideration', queryType: 'how_to', driftScore: 20, driftLevel: 'slight' as const, driftReasoning: null },
          entityAnalysis: { variantEntities: [], sharedEntities: [], overlapPercent: 80, missingEntities: [] },
        },
      ];
      
      const { summary } = categorizeAllVariants(variants, mockChunks);
      
      expect(summary.averageScores.contentSimilarity).toBe(0.70);
      expect(summary.averageScores.passageScore).toBe(70);
      expect(summary.averageScores.driftScore).toBe(15);
    });

    it('should handle empty variants array', () => {
      const { breakdown, summary } = categorizeAllVariants([], mockChunks);
      
      expect(summary.total).toBe(0);
      expect(summary.byCategory.optimization).toBe(0);
      expect(summary.byCategory.gaps).toBe(0);
      expect(summary.byCategory.drift).toBe(0);
      expect(summary.byCategory.outOfScope).toBe(0);
      expect(breakdown.optimizationOpportunities).toHaveLength(0);
    });
  });
});
