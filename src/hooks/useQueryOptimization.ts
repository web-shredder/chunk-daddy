/**
 * useQueryOptimization Hook
 * Manages the optimization workflow for individual queries
 */

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { QueryWorkItem, QueryOptimizationState } from '@/types/coverage';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';

interface UseQueryOptimizationProps {
  queryItem: QueryWorkItem;
  chunk?: LayoutAwareChunk;
  initialState?: QueryOptimizationState;
  onStateChange: (state: QueryOptimizationState) => void;
}

const DEFAULT_STATE: QueryOptimizationState = {
  step: 'idle',
};

export function useQueryOptimization({ 
  queryItem, 
  chunk, 
  initialState,
  onStateChange 
}: UseQueryOptimizationProps) {
  const [state, setState] = useState<QueryOptimizationState>(initialState || DEFAULT_STATE);

  // Sync with initial state when it changes
  useEffect(() => {
    if (initialState) {
      setState(initialState);
    }
  }, [initialState]);

  const updateState = useCallback((updates: Partial<QueryOptimizationState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      onStateChange(newState);
      return newState;
    });
  }, [onStateChange]);

  const generateAnalysis = useCallback(async () => {
    if (!chunk) {
      toast.error('No chunk assigned to analyze');
      return;
    }
    
    updateState({ step: 'analyzing', error: undefined });

    try {
      // Use SSE for the edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/optimize-content-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          type: 'generate_analysis_prompt',
          query: queryItem.query,
          intentType: queryItem.intentType,
          chunkText: chunk.text,
          headingPath: chunk.headingPath || [],
          scores: queryItem.originalScores
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a moment.');
        }
        if (response.status === 402) {
          throw new Error('Usage limit reached. Please add credits to continue.');
        }
        throw new Error(`Request failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Parse SSE response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let analysis = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            
            try {
              const event = JSON.parse(jsonStr);
              
              if (event.type === 'error') {
                throw new Error(event.message);
              }
              
              if (event.type === 'analysis_complete' && event.analysis) {
                analysis = event.analysis;
              }
            } catch (e) {
              // Ignore parse errors for partial JSON
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      if (!analysis) {
        throw new Error('No analysis returned from API');
      }

      updateState({
        step: 'analysis_ready',
        generatedAnalysis: analysis,
        userEditedAnalysis: analysis,
      });
      
      toast.success('Analysis generated successfully');
    } catch (error) {
      console.error('Analysis generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate analysis';
      updateState({
        step: 'idle',
        error: errorMessage
      });
      toast.error(errorMessage);
    }
  }, [queryItem, chunk, updateState]);

  const setUserAnalysis = useCallback((text: string) => {
    updateState({ userEditedAnalysis: text });
  }, [updateState]);

  const resetState = useCallback(() => {
    setState(DEFAULT_STATE);
    onStateChange(DEFAULT_STATE);
  }, [onStateChange]);

  return {
    state,
    generateAnalysis,
    setUserAnalysis,
    resetState,
    updateState,
  };
}
