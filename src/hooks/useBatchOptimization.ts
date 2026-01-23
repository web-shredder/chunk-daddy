/**
 * Batch Optimization Hook
 * Handles running analysis and optimization for multiple queries sequentially
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { QueryWorkItem, QueryStatus, QueryOptimizationState, QueryScores } from '@/types/coverage';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';

export interface BatchOptimizationState {
  isRunning: boolean;
  currentIndex: number;
  totalCount: number;
  currentQuery: string | null;
  currentStep: 'analysis' | 'optimization' | 'scoring' | null;
  completedCount: number;
  errorCount: number;
  errors: { queryId: string; error: string }[];
}

interface UseBatchOptimizationProps {
  queries: QueryWorkItem[];
  chunks: LayoutAwareChunk[];
  onQueryStateChange: (queryId: string, state: QueryOptimizationState) => void;
  onQueryStatusChange: (queryId: string, status: QueryStatus) => void;
  onQueryUpdate: (queryId: string, updates: Partial<QueryWorkItem>) => void;
}

const initialState: BatchOptimizationState = {
  isRunning: false,
  currentIndex: 0,
  totalCount: 0,
  currentQuery: null,
  currentStep: null,
  completedCount: 0,
  errorCount: 0,
  errors: []
};

export function useBatchOptimization({
  queries,
  chunks,
  onQueryStateChange,
  onQueryStatusChange,
  onQueryUpdate
}: UseBatchOptimizationProps) {
  const [state, setState] = useState<BatchOptimizationState>(initialState);
  const abortRef = useRef(false);
  
  const runBatchOptimization = useCallback(async (selectedQueryIds?: string[]) => {
    // Get queries to process
    const queriesToProcess = queries.filter(q => 
      q.status !== 'optimized' && 
      (!selectedQueryIds || selectedQueryIds.includes(q.id))
    );
    
    if (queriesToProcess.length === 0) return;
    
    abortRef.current = false;
    setState({
      isRunning: true,
      currentIndex: 0,
      totalCount: queriesToProcess.length,
      currentQuery: null,
      currentStep: null,
      completedCount: 0,
      errorCount: 0,
      errors: []
    });
    
    for (let i = 0; i < queriesToProcess.length; i++) {
      if (abortRef.current) break;
      
      const query = queriesToProcess[i];
      const chunk = query.assignedChunk 
        ? chunks[query.assignedChunk.index] 
        : undefined;
      
      setState(prev => ({
        ...prev,
        currentIndex: i,
        currentQuery: query.query,
        currentStep: 'analysis'
      }));
      
      // Mark as in progress
      onQueryStatusChange(query.id, 'in_progress');
      
      try {
        // Step 1: Generate Analysis/Brief
        console.log(`[Batch] Generating analysis for query: "${query.query}"`);
        
        const analysisResponse = await supabase.functions.invoke('optimize-content-stream', {
          body: {
            type: query.isGap ? 'generate_gap_brief' : 'generate_analysis_prompt',
            query: query.query,
            intentType: query.intentType,
            chunkText: chunk?.text,
            headingCascade: chunk?.headingPath || [],
            scores: query.originalScores,
            existingHeadings: chunks.map(c => c.headingPath?.slice(-1)[0]).filter(Boolean)
          }
        });
        
        if (analysisResponse.error) throw new Error(analysisResponse.error.message || 'Analysis failed');
        
        const analysis = analysisResponse.data?.analysis || analysisResponse.data?.brief || '';
        
        onQueryStateChange(query.id, {
          step: 'analysis_ready',
          generatedAnalysis: analysis,
          userEditedAnalysis: analysis
        });
        
        if (abortRef.current) break;
        
        // Step 2: Generate Optimized Content
        setState(prev => ({ ...prev, currentStep: 'optimization' }));
        console.log(`[Batch] Generating optimized content for query: "${query.query}"`);
        
        const optimizeResponse = await supabase.functions.invoke('optimize-content-stream', {
          body: {
            type: query.isGap ? 'generate_gap_content' : 'optimize_single_chunk',
            query: query.query,
            intentType: query.intentType,
            originalChunkText: chunk?.text,
            headingCascade: chunk?.headingPath || [],
            analysisPrompt: analysis
          }
        });
        
        if (optimizeResponse.error) throw new Error(optimizeResponse.error.message || 'Optimization failed');
        
        const optimizedContent = optimizeResponse.data?.optimizedContent || optimizeResponse.data?.content || '';
        
        onQueryStateChange(query.id, {
          step: 'optimization_ready',
          generatedAnalysis: analysis,
          userEditedAnalysis: analysis,
          generatedContent: optimizedContent,
          userEditedContent: optimizedContent
        });
        
        if (abortRef.current) break;
        
        // Step 3: Score the optimized content
        setState(prev => ({ ...prev, currentStep: 'scoring' }));
        console.log(`[Batch] Scoring content for query: "${query.query}"`);
        
        const scoreResponse = await supabase.functions.invoke('optimize-content-stream', {
          body: {
            type: 'score_content',
            query: query.query,
            content: optimizedContent,
            headingCascade: chunk?.headingPath || []
          }
        });
        
        if (scoreResponse.error) throw new Error(scoreResponse.error.message || 'Scoring failed');
        
        const scores: QueryScores = scoreResponse.data?.scores || {
          passageScore: 0,
          semanticSimilarity: 0,
          lexicalScore: 0,
        };
        
        onQueryStateChange(query.id, {
          step: 'optimization_ready',
          generatedAnalysis: analysis,
          userEditedAnalysis: analysis,
          generatedContent: optimizedContent,
          userEditedContent: optimizedContent,
          lastScoredContent: optimizedContent,
          lastScoredResults: scores
        });
        
        // Update query with new scores (but don't approve)
        onQueryUpdate(query.id, {
          currentScores: scores,
          optimizedText: optimizedContent
        });
        
        setState(prev => ({
          ...prev,
          completedCount: prev.completedCount + 1
        }));
        
        console.log(`[Batch] Completed query: "${query.query}"`);
        
      } catch (error) {
        console.error(`[Batch] Error optimizing query ${query.id}:`, error);
        
        onQueryStateChange(query.id, {
          step: 'idle',
          error: error instanceof Error ? error.message : 'Optimization failed'
        });
        
        // Revert to ready status
        onQueryStatusChange(query.id, query.isGap ? 'gap' : 'ready');
        
        setState(prev => ({
          ...prev,
          errorCount: prev.errorCount + 1,
          errors: [...prev.errors, { 
            queryId: query.id, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          }]
        }));
      }
      
      // Small delay between queries to avoid rate limiting
      if (i < queriesToProcess.length - 1 && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setState(prev => ({
      ...prev,
      isRunning: false,
      currentQuery: null,
      currentStep: null
    }));
    
    console.log('[Batch] Batch optimization completed');
  }, [queries, chunks, onQueryStateChange, onQueryStatusChange, onQueryUpdate]);
  
  const abort = useCallback(() => {
    console.log('[Batch] Aborting batch optimization');
    abortRef.current = true;
  }, []);
  
  const reset = useCallback(() => {
    setState(initialState);
  }, []);
  
  return {
    state,
    runBatchOptimization,
    abort,
    reset
  };
}
