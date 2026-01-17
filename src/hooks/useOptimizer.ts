import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateEmbeddings } from '@/lib/embeddings';
import { calculateAllMetrics, calculateImprovement, calculatePassageScore, getPassageScoreTier, type SimilarityScores } from '@/lib/similarity';
import type {
  ContentAnalysis,
  OptimizationResult,
  ValidatedChunk,
  ChangeExplanation,
  FullOptimizationResult,
  OptimizationSummary,
  ChunkScoreSummary,
  QueryScoreDetail,
  ContentBrief,
} from '@/lib/optimizer-types';
import type { QueryAssignmentMap, ChunkAssignment } from '@/lib/query-assignment';

export type OptimizationStep = 'idle' | 'analyzing' | 'optimizing' | 'generating_briefs' | 'scoring' | 'explaining' | 'complete' | 'error';

export interface UseOptimizerState {
  step: OptimizationStep;
  progress: number;
  error: string | null;
  result: FullOptimizationResult | null;
}

export interface OptimizeOptions {
  content: string;
  queries: string[];
  currentScores?: Record<string, number>;
  queryAssignments?: QueryAssignmentMap;
  chunks?: string[];
  useFocusedOptimization?: boolean;
}

export function useOptimizer() {
  const [state, setState] = useState<UseOptimizerState>({
    step: 'idle',
    progress: 0,
    error: null,
    result: null,
  });

  const optimize = useCallback(async (options: OptimizeOptions) => {
    const { content, queries, currentScores, queryAssignments, chunks, useFocusedOptimization } = options;
    
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
      // Use focused optimization if query assignments are provided
      let optimization: OptimizationResult;
      
      if (useFocusedOptimization && queryAssignments && chunks && chunks.length > 0) {
        console.log('Step 2: Generating FOCUSED optimizations per chunk...');
        
        // Convert query assignments to the format expected by the edge function
        const assignmentData = queryAssignments.chunkAssignments
          .filter(ca => ca.assignedQuery)
          .map(ca => ({
            chunkIndex: ca.chunkIndex,
            queries: [ca.assignedQuery!.query],
          }));
        
        const { data: optimizeData, error: optimizeError } = await supabase.functions.invoke('optimize-content', {
          body: { 
            type: 'optimize_focused', 
            content, 
            queries, 
            currentScores, 
            analysis,
            queryAssignments: assignmentData,
            chunks,
          },
        });

        if (optimizeError || optimizeData?.error) {
          throw new Error(optimizeData?.error || optimizeError?.message || 'Focused optimization failed');
        }

        optimization = optimizeData.result;
        console.log('Focused optimization complete:', optimization.optimized_chunks.length, 'chunks generated');
      } else {
        console.log('Step 2: Generating standard optimizations...');
        const { data: optimizeData, error: optimizeError } = await supabase.functions.invoke('optimize-content', {
          body: { type: 'optimize', content, queries, currentScores, analysis },
        });

        if (optimizeError || optimizeData?.error) {
          throw new Error(optimizeData?.error || optimizeError?.message || 'Optimization failed');
        }

        optimization = optimizeData.result;
        console.log('Optimization complete:', optimization.optimized_chunks.length, 'chunks generated');
      }

      // Step 2.5: Generate content briefs for unhoused queries
      let contentBriefs: ContentBrief[] = [];
      
      if (queryAssignments && queryAssignments.unassignedQueries.length > 0) {
        setState(prev => ({ 
          ...prev, 
          step: 'generating_briefs', 
          progress: 40,
        }));
        
        console.log(`Step 2.5: Generating briefs for ${queryAssignments.unassignedQueries.length} unhoused queries...`);
        
        // Get chunk scores from the chunks for summaries
        const chunkSummaries = (chunks || []).map((c, i) => ({
          index: i,
          heading: null, // Will be enriched if available
          preview: c.slice(0, 200),
        }));

        const briefPromises = queryAssignments.unassignedQueries.map(async (query) => {
          try {
            const { data, error } = await supabase.functions.invoke('optimize-content', {
              body: {
                type: 'generateContentBrief',
                query,
                content,
                chunkSummaries,
              },
            });
            if (error) throw error;
            return data?.result as ContentBrief;
          } catch (err) {
            console.warn(`Brief generation failed for "${query}":`, err);
            return null;
          }
        });

        const briefResults = await Promise.all(briefPromises);
        contentBriefs = briefResults.filter((b): b is ContentBrief => b !== null);
        console.log(`Generated ${contentBriefs.length} content briefs`);
      }

      setState(prev => ({ ...prev, step: 'scoring', progress: 50 }));
      
      // Prepare texts for scoring - use body content ONLY for both (no headings)
      // This ensures fair comparison between original and optimized content
      const optimizedTexts = optimization.optimized_chunks.map(chunk => {
        // Remove any leading headings from optimized_text
        return chunk.optimized_text.replace(/^(#{1,6}\s+[^\n]+\n+)+/, '').trim();
      });
      
      const originalTexts = optimization.optimized_chunks.map(chunk => {
        // Remove any leading headings from original_text for consistent scoring
        return chunk.original_text.replace(/^(#{1,6}\s+[^\n]+\n+)+/, '').trim();
      });

      const allTexts = [...optimizedTexts, ...originalTexts, ...queries];

      // Filter out empty texts and track their original indices
      const textsWithIndices = allTexts.map((text, idx) => ({ text, idx }))
        .filter(item => item.text && item.text.trim().length > 0);
      const validTexts = textsWithIndices.map(item => item.text);

      // Generate embeddings only for valid texts
      const validEmbeddings = await generateEmbeddings(validTexts);

      // Create a map of original index -> embedding
      const embeddingMap = new Map<number, number[]>();
      textsWithIndices.forEach((item, i) => {
        embeddingMap.set(item.idx, validEmbeddings[i]?.embedding || []);
      });

      // Reconstruct embeddings with proper indices
      const chunkEmbeddings = optimizedTexts.map((_, idx) => ({
        embedding: embeddingMap.get(idx) || []
      }));
      const originalEmbeddings = originalTexts.map((_, idx) => ({
        embedding: embeddingMap.get(optimizedTexts.length + idx) || []
      }));
      const queryEmbeddings = queries.map((_, idx) => ({
        embedding: embeddingMap.get(optimizedTexts.length + originalTexts.length + idx) || []
      }));

      setState(prev => ({ ...prev, progress: 70 }));

      // Calculate scores and improvements + capture for summary
      const originalScoresMap: Record<number, Record<string, { cosine: number; chamfer: number; passageScore: number }>> = {};
      const optimizedScoresMap: Record<number, Record<string, { cosine: number; chamfer: number; passageScore: number }>> = {};
      
      const validatedChunks: ValidatedChunk[] = optimization.optimized_chunks.map((chunk, chunkIdx) => {
        const chunkScores: Record<string, number> = {};
        const originalScores: Record<string, number> = {};
        const chunkFullScores: Record<string, { cosine: number; chamfer: number; passageScore: number }> = {};
        const originalFullScores: Record<string, { cosine: number; chamfer: number; passageScore: number }> = {};

        queries.forEach((query, queryIdx) => {
          const chunkEmb = chunkEmbeddings[chunkIdx]?.embedding;
          const queryEmb = queryEmbeddings[queryIdx]?.embedding;
          const origEmb = originalEmbeddings[chunkIdx]?.embedding;

          // Skip if any embedding is missing or empty
          if (!chunkEmb?.length || !queryEmb?.length || !origEmb?.length) {
            console.warn(`Missing embedding for chunk ${chunkIdx} or query "${query}"`);
            chunkScores[query] = 0;
            originalScores[query] = 0;
            chunkFullScores[query] = { cosine: 0, chamfer: 0, passageScore: 0 };
            originalFullScores[query] = { cosine: 0, chamfer: 0, passageScore: 0 };
            return;
          }

          const optimizedMetrics = calculateAllMetrics(chunkEmb, queryEmb);
          const originalMetrics = calculateAllMetrics(origEmb, queryEmb);
          
          // For single vectors, chamfer = cosine (single-point sets)
          const optimizedChamfer = optimizedMetrics.cosine;
          const originalChamfer = originalMetrics.cosine;
          
          const optimizedPassageScore = calculatePassageScore(optimizedMetrics.cosine, optimizedChamfer);
          const originalPassageScore = calculatePassageScore(originalMetrics.cosine, originalChamfer);
          
          chunkScores[query] = optimizedMetrics.cosine;
          originalScores[query] = originalMetrics.cosine;
          
          chunkFullScores[query] = { 
            cosine: optimizedMetrics.cosine, 
            chamfer: optimizedChamfer, 
            passageScore: optimizedPassageScore 
          };
          originalFullScores[query] = { 
            cosine: originalMetrics.cosine, 
            chamfer: originalChamfer, 
            passageScore: originalPassageScore 
          };
        });

        // Store for summary generation (with full metrics)
        originalScoresMap[chunkIdx] = originalFullScores;
        optimizedScoresMap[chunkIdx] = chunkFullScores;

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

      setState(prev => ({ ...prev, step: 'explaining', progress: 80 }));

      // Prepare chunk score data for summary generation (with Passage Score)
      const chunkScoreData = validatedChunks.map((chunk, idx) => ({
        chunk_number: chunk.chunk_number,
        heading: chunk.heading,
        scores: queries.map(query => {
          const origScores = originalScoresMap[idx]?.[query] || { cosine: 0, chamfer: 0, passageScore: 0 };
          const optScores = optimizedScoresMap[idx]?.[query] || { cosine: 0, chamfer: 0, passageScore: 0 };
          
          return {
            query,
            // Legacy cosine values for backward compatibility
            original: origScores.cosine,
            optimized: optScores.cosine,
            percent_change: calculateImprovement(origScores.cosine, optScores.cosine),
            // Full Passage Score data for AI
            originalPassageScore: origScores.passageScore,
            optimizedPassageScore: optScores.passageScore,
            passageScoreChange: optScores.passageScore - origScores.passageScore,
            originalTier: getPassageScoreTier(origScores.passageScore),
            optimizedTier: getPassageScoreTier(optScores.passageScore),
            originalChamfer: origScores.chamfer,
            optimizedChamfer: optScores.chamfer,
          };
        }),
      }));

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

      setState(prev => ({ ...prev, progress: 90 }));

      // Step 5: Generate summary with RAG explanations
      console.log('Step 5: Generating optimization summary...');
      const { data: summaryData, error: summaryError } = await supabase.functions.invoke('optimize-content', {
        body: { 
          type: 'summarize', 
          content, 
          queries, 
          validatedChanges: validatedChunks,
          chunkScoreData,
        },
      });

      let summary: OptimizationSummary | undefined;
      
      if (summaryError || summaryData?.error) {
        console.warn('Summary generation failed, using fallback:', summaryData?.error || summaryError?.message);
        // Build fallback summary without AI explanations
        summary = buildFallbackSummary(chunkScoreData, queries, validatedChunks);
      } else {
        // Build summary from AI response
        const summaryResult = summaryData.result;
        summary = buildSummaryFromAI(chunkScoreData, queries, validatedChunks, summaryResult);
      }

      console.log('Summary complete');

      // Convert full scores back to cosine-only for backward compatibility
      const originalScoresCosineOnly: Record<number, Record<string, number>> = {};
      Object.entries(originalScoresMap).forEach(([chunkIdx, queryScores]) => {
        originalScoresCosineOnly[Number(chunkIdx)] = {};
        Object.entries(queryScores).forEach(([query, scores]) => {
          originalScoresCosineOnly[Number(chunkIdx)][query] = scores.cosine;
        });
      });

      const fullResult: FullOptimizationResult = {
        analysis,
        optimizedChunks: validatedChunks,
        explanations,
        originalContent: content,
        timestamp: new Date(),
        summary,
        originalScores: originalScoresCosineOnly,
        originalFullScores: originalScoresMap,
        optimizedFullScores: optimizedScoresMap,
        contentBriefs,
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

// Build summary from AI response
function buildSummaryFromAI(
  chunkScoreData: any[],
  queries: string[],
  validatedChunks: ValidatedChunk[],
  aiResult: any
): OptimizationSummary {
  const ragExplanations = aiResult.rag_explanations || [];
  
  // Build chunk scores with RAG explanations
  const chunkScores: ChunkScoreSummary[] = chunkScoreData.map((chunk, idx) => {
    const queryScores: QueryScoreDetail[] = chunk.scores.map((qs: any) => {
      const explanation = ragExplanations.find(
        (e: any) => e.chunk_number === chunk.chunk_number && e.query === qs.query
      );
      return {
        query: qs.query,
        originalCosine: qs.original,
        optimizedCosine: qs.optimized,
        percentChange: qs.percent_change,
        ragImpactExplanation: explanation?.explanation || getDefaultRagExplanation(qs.percent_change),
      };
    });

    const avgImprovement = queryScores.length > 0
      ? queryScores.reduce((sum, qs) => sum + qs.percentChange, 0) / queryScores.length
      : 0;

    return {
      chunkNumber: chunk.chunk_number,
      heading: chunk.heading,
      queryScores,
      overallImprovement: avgImprovement,
    };
  });

  // Calculate overall averages
  const allOriginal = chunkScoreData.flatMap(c => c.scores.map((s: any) => s.original));
  const allOptimized = chunkScoreData.flatMap(c => c.scores.map((s: any) => s.optimized));
  const overallOriginalAvg = allOriginal.length > 0 ? allOriginal.reduce((a, b) => a + b, 0) / allOriginal.length : 0;
  const overallOptimizedAvg = allOptimized.length > 0 ? allOptimized.reduce((a, b) => a + b, 0) / allOptimized.length : 0;
  const overallPercentChange = calculateImprovement(overallOriginalAvg, overallOptimizedAvg);

  return {
    chunkScores,
    overallOriginalAvg,
    overallOptimizedAvg,
    overallPercentChange,
    furtherSuggestions: (aiResult.further_suggestions || []).map((s: any) => ({
      suggestion: s.suggestion,
      expectedImpact: s.expected_impact,
      reasoning: s.reasoning,
    })),
    tradeOffConsiderations: (aiResult.trade_off_considerations || []).map((t: any) => ({
      category: t.category,
      concern: t.concern,
      severity: t.severity,
    })),
  };
}

// Build fallback summary without AI explanations
function buildFallbackSummary(
  chunkScoreData: any[],
  queries: string[],
  validatedChunks: ValidatedChunk[]
): OptimizationSummary {
  const chunkScores: ChunkScoreSummary[] = chunkScoreData.map((chunk) => {
    const queryScores: QueryScoreDetail[] = chunk.scores.map((qs: any) => ({
      query: qs.query,
      originalCosine: qs.original,
      optimizedCosine: qs.optimized,
      percentChange: qs.percent_change,
      ragImpactExplanation: getDefaultRagExplanation(qs.percent_change),
    }));

    const avgImprovement = queryScores.length > 0
      ? queryScores.reduce((sum, qs) => sum + qs.percentChange, 0) / queryScores.length
      : 0;

    return {
      chunkNumber: chunk.chunk_number,
      heading: chunk.heading,
      queryScores,
      overallImprovement: avgImprovement,
    };
  });

  const allOriginal = chunkScoreData.flatMap(c => c.scores.map((s: any) => s.original));
  const allOptimized = chunkScoreData.flatMap(c => c.scores.map((s: any) => s.optimized));
  const overallOriginalAvg = allOriginal.length > 0 ? allOriginal.reduce((a, b) => a + b, 0) / allOriginal.length : 0;
  const overallOptimizedAvg = allOptimized.length > 0 ? allOptimized.reduce((a, b) => a + b, 0) / allOptimized.length : 0;
  const overallPercentChange = calculateImprovement(overallOriginalAvg, overallOptimizedAvg);

  return {
    chunkScores,
    overallOriginalAvg,
    overallOptimizedAvg,
    overallPercentChange,
    furtherSuggestions: [],
    tradeOffConsiderations: [],
  };
}

// Generate default RAG explanation based on Passage Score change
function getDefaultRagExplanation(percentChange: number): string {
  if (percentChange > 10) {
    return 'Significant Passage Score improvement. This chunk now has stronger semantic match and better multi-aspect coverage, making it more likely to be retrieved.';
  } else if (percentChange > 0) {
    return 'Moderate Passage Score improvement. The optimized text better balances semantic relevance and query facet coverage.';
  } else if (percentChange < -10) {
    return 'Passage Score decreased significantly. Review the changes to ensure key terms and context weren\'t removed.';
  } else if (percentChange < 0) {
    return 'Slight Passage Score decrease. This may be acceptable if other queries improved or tier position is maintained.';
  }
  return 'Passage Score remained stable. The content was already well-optimized for this query.';
}
