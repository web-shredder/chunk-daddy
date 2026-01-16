import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateEmbeddings } from '@/lib/embeddings';
import { calculateAllMetrics, calculateImprovement, type SimilarityScores } from '@/lib/similarity';
import type {
  ContentAnalysis,
  OptimizationResult,
  ValidatedChunk,
  ChangeExplanation,
  FullOptimizationResult,
} from '@/lib/optimizer-types';

export type OptimizationStep = 'idle' | 'analyzing' | 'optimizing' | 'scoring' | 'explaining' | 'complete' | 'error';

export interface UseOptimizerState {
  step: OptimizationStep;
  progress: number;
  error: string | null;
  result: FullOptimizationResult | null;
}

export function useOptimizer() {
  const [state, setState] = useState<UseOptimizerState>({
    step: 'idle',
    progress: 0,
    error: null,
    result: null,
  });

  const optimize = useCallback(async (content: string, queries: string[], currentScores?: Record<string, number>) => {
    setState({ step: 'analyzing', progress: 10, error: null, result: null });

    try {
      // Step 1: Analyze content for optimization opportunities
      console.log('Step 1: Analyzing content...');
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('optimize-content', {
        body: { type: 'analyze', content, queries, currentScores },
      });

      if (analysisError || analysisData?.error) {
        throw new Error(analysisData?.error || analysisError?.message || 'Analysis failed');
      }

      const analysis: ContentAnalysis = analysisData.result;
      console.log('Analysis complete:', analysis.optimization_opportunities.length, 'opportunities found');

      setState(prev => ({ ...prev, step: 'optimizing', progress: 30 }));

      // Step 2: Generate optimized content
      console.log('Step 2: Generating optimizations...');
      const { data: optimizeData, error: optimizeError } = await supabase.functions.invoke('optimize-content', {
        body: { type: 'optimize', content, queries, currentScores, analysis },
      });

      if (optimizeError || optimizeData?.error) {
        throw new Error(optimizeData?.error || optimizeError?.message || 'Optimization failed');
      }

      const optimization: OptimizationResult = optimizeData.result;
      console.log('Optimization complete:', optimization.optimized_chunks.length, 'chunks generated');

      setState(prev => ({ ...prev, step: 'scoring', progress: 50 }));

      // Step 3: Score optimized chunks with embeddings
      console.log('Step 3: Scoring optimized content...');
      const chunkTexts = optimization.optimized_chunks.map(
        chunk => (chunk.heading ? chunk.heading + '\n\n' : '') + chunk.optimized_text
      );
      const originalTexts = optimization.optimized_chunks.map(chunk => chunk.original_text);

      const allTexts = [...chunkTexts, ...originalTexts, ...queries];
      const embeddings = await generateEmbeddings(allTexts);

      const chunkEmbeddings = embeddings.slice(0, chunkTexts.length);
      const originalEmbeddings = embeddings.slice(chunkTexts.length, chunkTexts.length + originalTexts.length);
      const queryEmbeddings = embeddings.slice(chunkTexts.length + originalTexts.length);

      setState(prev => ({ ...prev, progress: 70 }));

      // Calculate scores and improvements
      const validatedChunks: ValidatedChunk[] = optimization.optimized_chunks.map((chunk, chunkIdx) => {
        const chunkScores: Record<string, number> = {};
        const originalScores: Record<string, number> = {};

        queries.forEach((query, queryIdx) => {
          const optimizedMetrics = calculateAllMetrics(
            chunkEmbeddings[chunkIdx].embedding,
            queryEmbeddings[queryIdx].embedding
          );
          const originalMetrics = calculateAllMetrics(
            originalEmbeddings[chunkIdx].embedding,
            queryEmbeddings[queryIdx].embedding
          );
          chunkScores[query] = optimizedMetrics.cosine;
          originalScores[query] = originalMetrics.cosine;
        });

        // Calculate actual improvements for each change
        const validatedChanges = chunk.changes_applied.map(change => {
          // Find which query this change targets
          const targetQuery = queries.find(q => 
            change.expected_improvement.toLowerCase().includes(q.toLowerCase())
          ) || queries[0];
          
          const newScore = chunkScores[targetQuery] || 0;
          const oldScore = originalScores[targetQuery] || 0;
          
          return {
            ...change,
            actual_scores: {
              new_score: newScore,
              improvement_pct: calculateImprovement(oldScore, newScore),
            },
          };
        });

        return {
          ...chunk,
          changes_applied: validatedChanges,
          scores: chunkScores,
        };
      });

      setState(prev => ({ ...prev, step: 'explaining', progress: 85 }));

      // Step 4: Generate explanations
      console.log('Step 4: Generating explanations...');
      const { data: explainData, error: explainError } = await supabase.functions.invoke('optimize-content', {
        body: { type: 'explain', content, queries, validatedChanges: validatedChunks },
      });

      if (explainError || explainData?.error) {
        throw new Error(explainData?.error || explainError?.message || 'Explanation generation failed');
      }

      const explanations: ChangeExplanation[] = explainData.result.explanations;
      console.log('Explanations complete:', explanations.length, 'explanations generated');

      const fullResult: FullOptimizationResult = {
        analysis,
        optimizedChunks: validatedChunks,
        explanations,
        originalContent: content,
        timestamp: new Date(),
      };

      setState({
        step: 'complete',
        progress: 100,
        error: null,
        result: fullResult,
      });

      return fullResult;

    } catch (error) {
      console.error('Optimization error:', error);
      setState({
        step: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Optimization failed',
        result: null,
      });
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      progress: 0,
      error: null,
      result: null,
    });
  }, []);

  return {
    ...state,
    optimize,
    reset,
  };
}
