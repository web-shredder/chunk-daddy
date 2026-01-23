/**
 * useQueryOptimization Hook
 * Manages the optimization workflow for individual queries
 */

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { QueryWorkItem, QueryOptimizationState, QueryScores } from '@/types/coverage';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';

interface UseQueryOptimizationProps {
  queryItem: QueryWorkItem;
  chunk?: LayoutAwareChunk;
  existingHeadings?: string[];      // All headings from the document
  contentContext?: string;          // Brief summary of what the content covers
  initialState?: QueryOptimizationState;
  onStateChange: (state: QueryOptimizationState) => void;
}

const DEFAULT_STATE: QueryOptimizationState = {
  step: 'idle',
};

export function useQueryOptimization({ 
  queryItem, 
  chunk,
  existingHeadings = [],
  contentContext = '',
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

  /**
   * Generate a content brief for gap queries (no existing content)
   */
  const generateBrief = useCallback(async () => {
    updateState({ step: 'analyzing', error: undefined });

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/optimize-content-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          type: 'generate_gap_brief',
          query: queryItem.query,
          intentType: queryItem.intentType,
          existingHeadings,
          contentContext
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
      let brief = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            
            try {
              const event = JSON.parse(jsonStr);
              
              if (event.type === 'error') {
                throw new Error(event.message);
              }
              
              if (event.type === 'brief_complete' && event.brief) {
                brief = event.brief;
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      if (!brief) {
        throw new Error('No brief returned from API');
      }

      updateState({
        step: 'analysis_ready',
        generatedAnalysis: brief,
        userEditedAnalysis: brief,
      });
      
      toast.success('Content brief generated successfully');
    } catch (error) {
      console.error('Brief generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate brief';
      updateState({
        step: 'idle',
        error: errorMessage
      });
      toast.error(errorMessage);
    }
  }, [queryItem, existingHeadings, contentContext, updateState]);

  const setUserAnalysis = useCallback((text: string) => {
    updateState({ userEditedAnalysis: text });
  }, [updateState]);

  const runOptimization = useCallback(async () => {
    if (!chunk || !state.userEditedAnalysis?.trim()) {
      toast.error('Please generate and review analysis first');
      return;
    }
    
    updateState({ step: 'optimizing', error: undefined });

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/optimize-content-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          type: 'optimize_single_chunk',
          query: queryItem.query,
          intentType: queryItem.intentType,
          originalChunkText: chunk.text,
          headingPath: chunk.headingPath || [],
          analysisPrompt: state.userEditedAnalysis,
          originalScores: queryItem.originalScores
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
      let optimizedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            
            try {
              const event = JSON.parse(jsonStr);
              
              if (event.type === 'error') {
                throw new Error(event.message);
              }
              
              if (event.type === 'optimization_complete' && event.optimizedContent) {
                optimizedContent = event.optimizedContent;
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      if (!optimizedContent) {
        throw new Error('No optimized content returned from API');
      }

      updateState({
        step: 'optimization_ready',
        generatedContent: optimizedContent,
        userEditedContent: optimizedContent,
      });
      
      toast.success('Content optimized successfully');
    } catch (error) {
      console.error('Optimization error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to optimize content';
      updateState({
        step: 'analysis_ready',
        error: errorMessage
      });
      toast.error(errorMessage);
    }
  }, [queryItem, chunk, state.userEditedAnalysis, updateState]);

  /**
   * Generate new content for gap queries based on the brief
   */
  const generateGapContent = useCallback(async () => {
    if (!state.userEditedAnalysis?.trim()) {
      toast.error('Please generate and review the content brief first');
      return;
    }
    
    updateState({ step: 'optimizing', error: undefined });

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/optimize-content-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          type: 'generate_gap_content',
          query: queryItem.query,
          intentType: queryItem.intentType,
          brief: state.userEditedAnalysis,
          existingHeadings,
          contentContext
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
      let generatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            
            try {
              const event = JSON.parse(jsonStr);
              
              if (event.type === 'error') {
                throw new Error(event.message);
              }
              
              if (event.type === 'content_complete' && event.content) {
                generatedContent = event.content;
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      if (!generatedContent) {
        throw new Error('No content returned from API');
      }

      updateState({
        step: 'optimization_ready',
        generatedContent,
        userEditedContent: generatedContent,
      });
      
      toast.success('New content generated successfully');
    } catch (error) {
      console.error('Gap content generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate content';
      updateState({
        step: 'analysis_ready',
        error: errorMessage
      });
      toast.error(errorMessage);
    }
  }, [queryItem, state.userEditedAnalysis, existingHeadings, contentContext, updateState]);

  const setUserContent = useCallback((text: string) => {
    updateState({ userEditedContent: text });
  }, [updateState]);

  const rescoreContent = useCallback(async () => {
    if (!state.userEditedContent?.trim()) {
      toast.error('No content to score');
      return;
    }
    
    updateState({ step: 'scoring', error: undefined });

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/optimize-content-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          type: 'score_content',
          query: queryItem.query,
          content: state.userEditedContent,
          headingPath: chunk?.headingPath || []
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
      let scores: QueryScores | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            
            try {
              const event = JSON.parse(jsonStr);
              
              if (event.type === 'error') {
                throw new Error(event.message);
              }
              
              if (event.type === 'scoring_complete' && event.scores) {
                scores = event.scores;
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      if (!scores) {
        throw new Error('No scores returned from API');
      }

      updateState({
        step: 'optimization_ready',
        lastScoredContent: state.userEditedContent,
        lastScoredResults: scores
      });
      
      toast.success('Content scored successfully');
    } catch (error) {
      console.error('Scoring error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to score content';
      updateState({
        step: 'optimization_ready',
        error: errorMessage
      });
      toast.error(errorMessage);
    }
  }, [queryItem, chunk, state.userEditedContent, updateState]);

  const approveOptimization = useCallback(() => {
    updateState({ step: 'approved' });
    
    // Return the approved data to parent
    return {
      approvedText: state.userEditedContent,
      finalScores: state.lastScoredResults
    };
  }, [state.userEditedContent, state.lastScoredResults, updateState]);

  const resetState = useCallback(() => {
    setState(DEFAULT_STATE);
    onStateChange(DEFAULT_STATE);
  }, [onStateChange]);

  return {
    state,
    generateAnalysis,
    generateBrief,
    setUserAnalysis,
    runOptimization,
    generateGapContent,
    setUserContent,
    rescoreContent,
    approveOptimization,
    resetState,
    updateState,
  };
}
