import { useState, useCallback, useRef } from 'react';
import type { LayoutAwareChunk, ChunkerOptions } from '@/lib/layout-chunker';
import type {
  AnalysisStep,
  EmbeddingInfo,
  EmbeddingBatch,
  DocumentChamferResult,
  ChunkScoredEvent,
  CoverageSummary,
  DiagnosticProgress,
  AnalysisSummary,
} from '@/components/moonbug/AnalysisStreamingPanel';

export interface StreamingAnalysisState {
  isAnalyzing: boolean;
  steps: AnalysisStep[];
  currentStep: number;
  embeddingInfo: EmbeddingInfo | null;
  embeddingProgress: EmbeddingBatch | null;
  documentChamfer: DocumentChamferResult | null;
  scoredChunks: ChunkScoredEvent[];
  coverageSummary: CoverageSummary | null;
  diagnosticProgress: DiagnosticProgress | null;
  summary: AnalysisSummary | null;
  error: string | null;
}

export interface StreamingAnalysisResult {
  chunkScores: Array<{
    chunkIndex: number;
    chunkId: string;
    heading: string;
    scores: Array<{
      query: string;
      cosine: number;
      passageScore: number;
    }>;
    bestQuery: string;
    bestScore: number;
  }>;
  coverageMap: Array<{
    query: string;
    bestChunkIndex: number;
    bestChunkHeading: string;
    score: number;
    status: 'covered' | 'weak' | 'gap';
  }>;
  diagnostics: Array<{
    chunkIndex: number;
    query: string;
    semantic: number;
    lexical: { score: number; termCoverage: number; exactPhraseMatch: boolean };
    rerank: { score: number; entityProminence: number; directAnswer: number };
    citation: { score: number; specificity: number; quotability: number };
    composite: number;
  }>;
  summary: AnalysisSummary;
  documentChamfer: number;
}

const initialSteps: AnalysisStep[] = [
  { id: 1, name: "Embedding Generation", status: "pending" },
  { id: 2, name: "Document Chamfer", status: "pending" },
  { id: 3, name: "Chunk Scoring", status: "pending" },
  { id: 4, name: "Coverage Mapping", status: "pending" },
  { id: 5, name: "Diagnostic Scoring", status: "pending" },
];

export function useStreamingAnalysis() {
  const [state, setState] = useState<StreamingAnalysisState>({
    isAnalyzing: false,
    steps: initialSteps,
    currentStep: 0,
    embeddingInfo: null,
    embeddingProgress: null,
    documentChamfer: null,
    scoredChunks: [],
    coverageSummary: null,
    diagnosticProgress: null,
    summary: null,
    error: null,
  });

  const resultRef = useRef<StreamingAnalysisResult | null>(null);

  const analyzeStreaming = useCallback(async (
    content: string,
    chunks: LayoutAwareChunk[],
    queries: string[],
  ): Promise<StreamingAnalysisResult | null> => {
    // Reset state
    setState({
      isAnalyzing: true,
      steps: initialSteps.map(s => ({ ...s, status: 'pending' })),
      currentStep: 0,
      embeddingInfo: null,
      embeddingProgress: null,
      documentChamfer: null,
      scoredChunks: [],
      coverageSummary: null,
      diagnosticProgress: null,
      summary: null,
      error: null,
    });
    resultRef.current = null;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    console.log('[Streaming] Starting analysis...', { chunksCount: chunks.length, queriesCount: queries.length });
    console.log('[Streaming] Supabase URL:', supabaseUrl);

    try {
      // Prepare chunk data for the edge function
      const chunkInputs = chunks.map((c, i) => ({
        id: c.id,
        index: i,
        text: c.text,
        textWithoutCascade: c.textWithoutCascade,
        headingPath: c.headingPath,
        wordCount: c.metadata.wordCount,
        charCount: c.metadata.charCount,
      }));

      const fetchUrl = `${supabaseUrl}/functions/v1/analyze-chunks-stream`;
      console.log('[Streaming] Fetching:', fetchUrl);

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          chunks: chunkInputs,
          queries: queries.filter(q => q.trim()),
          originalContent: content,
        }),
      });

      console.log('[Streaming] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Analysis failed: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim();
            continue;
          }
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Handle different event types
              if (data.steps) {
                // started event
                setState(prev => ({ ...prev, steps: data.steps }));
              } else if (data.totalTexts && data.breakdown) {
                // embedding_info
                setState(prev => ({ ...prev, embeddingInfo: data }));
              } else if (data.batch !== undefined && data.textsProcessed !== undefined) {
                // embedding_batch
                setState(prev => ({ ...prev, embeddingProgress: data }));
              } else if (data.step && data.name) {
                // step_started or step_complete
                const stepId = data.step;
                const isComplete = data.totalEmbeddings !== undefined || 
                                  data.chunksScored !== undefined || 
                                  data.pairsScored !== undefined ||
                                  (data.step === 2 && !data.score) ||
                                  (data.step === 4 && !data.summary);
                
                if (!isComplete) {
                  // step_started
                  setState(prev => ({
                    ...prev,
                    currentStep: stepId,
                    steps: prev.steps.map(s => ({
                      ...s,
                      status: s.id === stepId ? 'running' : s.id < stepId ? 'complete' : 'pending',
                    })),
                  }));
                } else {
                  // step_complete
                  setState(prev => ({
                    ...prev,
                    steps: prev.steps.map(s => ({
                      ...s,
                      status: s.id <= stepId ? 'complete' : s.status,
                    })),
                  }));
                }
              } else if (data.score !== undefined && data.interpretation !== undefined) {
                // document_chamfer
                setState(prev => ({ ...prev, documentChamfer: data }));
              } else if (data.chunkIndex !== undefined && data.bestQuery !== undefined) {
                // chunk_scored
                setState(prev => ({
                  ...prev,
                  scoredChunks: [...prev.scoredChunks, data],
                }));
              } else if (data.summary && data.map) {
                // coverage_calculated
                setState(prev => ({ ...prev, coverageSummary: data.summary }));
              } else if (data.pairsProcessed !== undefined && data.totalPairs !== undefined) {
                // diagnostic_progress
                setState(prev => ({ ...prev, diagnosticProgress: data }));
              } else if (data.success && data.summary) {
                // complete
                setState(prev => ({
                  ...prev,
                  summary: data.summary,
                  isAnalyzing: false,
                  steps: prev.steps.map(s => ({ ...s, status: 'complete' })),
                }));
                
                resultRef.current = {
                  chunkScores: data.chunkScores,
                  coverageMap: data.coverageMap,
                  diagnostics: data.diagnostics,
                  summary: data.summary,
                  documentChamfer: data.summary.documentChamfer,
                };
              } else if (data.message) {
                // error
                setState(prev => ({
                  ...prev,
                  error: data.message,
                  isAnalyzing: false,
                }));
              }
            } catch (parseError) {
              console.warn('SSE parse error:', parseError, line);
            }
          }
        }
      }

      return resultRef.current;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isAnalyzing: false,
      }));
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isAnalyzing: false,
      steps: initialSteps,
      currentStep: 0,
      embeddingInfo: null,
      embeddingProgress: null,
      documentChamfer: null,
      scoredChunks: [],
      coverageSummary: null,
      diagnosticProgress: null,
      summary: null,
      error: null,
    });
    resultRef.current = null;
  }, []);

  return {
    ...state,
    analyzeStreaming,
    reset,
    result: resultRef.current,
  };
}
