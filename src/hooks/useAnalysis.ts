import { useState, useCallback } from 'react';
import { generateEmbeddings, type EmbeddingResult } from '@/lib/embeddings';
import { calculateAllMetrics, calculateImprovement, type SimilarityScores } from '@/lib/similarity';
import { chunkContent, type Chunk, type ChunkingStrategy } from '@/lib/chunking';
import type { LayoutAwareChunk, ChunkerOptions } from '@/lib/layout-chunker';

export interface KeywordScore {
  keyword: string;
  scores: SimilarityScores;
}

export interface ChunkScore {
  chunkId: string;
  chunkIndex: number;
  text: string;
  wordCount: number;
  charCount: number;
  keywordScores: KeywordScore[];
}

export interface OriginalScore {
  text: string;
  keywordScores: KeywordScore[];
}

export interface ImprovementResult {
  chunkId: string;
  keyword: string;
  cosineImprovement: number;
  euclideanImprovement: number;
  chamferImprovement: number;
}

export interface AnalysisResult {
  originalScores: OriginalScore | null;
  chunkScores: ChunkScore[];
  noCascadeScores: ChunkScore[] | null;
  optimizedScores: ChunkScore[] | null;
  improvements: ImprovementResult[] | null;
  timestamp: Date;
}

export interface UseAnalysisOptions {
  content: string;
  optimizedContent?: string;
  keywords: string[];
  strategy: ChunkingStrategy | 'layout-aware';
  fixedChunkSize?: number;
  layoutChunks?: LayoutAwareChunk[];
  chunkerOptions?: ChunkerOptions;
}

export function useAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState(0);

  const analyze = useCallback(async (options: UseAnalysisOptions) => {
    const { content, optimizedContent, keywords, strategy, fixedChunkSize, layoutChunks, chunkerOptions } = options;

    if (!content.trim()) {
      setError('Please enter content to analyze');
      return;
    }

    if (keywords.length === 0 || keywords.every(k => !k.trim())) {
      setError('Please add at least one keyword');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setProgress(0);

    try {
      // Get chunks - either layout-aware or traditional
      let chunkTexts: string[];
      let chunkData: { id: string; wordCount: number; charCount: number }[];
      let noCascadeTexts: string[] | null = null;

      if (strategy === 'layout-aware' && layoutChunks) {
        chunkTexts = layoutChunks.map(c => c.text);
        chunkData = layoutChunks.map(c => ({
          id: c.id,
          wordCount: c.metadata.wordCount,
          charCount: c.metadata.charCount,
        }));
        // Also get texts without cascade for comparison
        if (chunkerOptions?.cascadeHeadings) {
          noCascadeTexts = layoutChunks.map(c => c.textWithoutCascade);
        }
      } else {
        const chunks = chunkContent(content, strategy as ChunkingStrategy, fixedChunkSize);
        chunkTexts = chunks.map(c => c.text);
        chunkData = chunks.map(c => ({
          id: c.id,
          wordCount: c.wordCount,
          charCount: c.charCount,
        }));
      }
      
      // Get optimized chunks if provided
      const optimizedChunks = optimizedContent 
        ? chunkContent(optimizedContent, strategy === 'layout-aware' ? 'paragraph' : strategy as ChunkingStrategy, fixedChunkSize)
        : null;

      setProgress(10);

      // Prepare all texts for embedding
      const validKeywords = keywords.filter(k => k.trim());
      const textsToEmbed: string[] = [
        content, // Original full content
        ...chunkTexts,
        ...validKeywords,
      ];

      // Add no-cascade texts if we have them
      if (noCascadeTexts) {
        textsToEmbed.push(...noCascadeTexts);
      }

      if (optimizedChunks) {
        textsToEmbed.push(...optimizedChunks.map(c => c.text));
      }

      setProgress(20);

      // Generate all embeddings in one batch via edge function
      const embeddings = await generateEmbeddings(textsToEmbed);

      setProgress(60);

      // Extract embeddings by type
      let embeddingIndex = 0;
      const originalEmbedding = embeddings[embeddingIndex++].embedding;
      
      const chunkEmbeddings: EmbeddingResult[] = chunkTexts.map(() => 
        embeddings[embeddingIndex++]
      );
      
      const keywordEmbeddings: EmbeddingResult[] = validKeywords.map(() => 
        embeddings[embeddingIndex++]
      );
      
      const noCascadeEmbeddings: EmbeddingResult[] | null = noCascadeTexts
        ? noCascadeTexts.map(() => embeddings[embeddingIndex++])
        : null;
      
      const optimizedEmbeddings: EmbeddingResult[] | null = optimizedChunks
        ? optimizedChunks.map(() => embeddings[embeddingIndex++])
        : null;

      setProgress(70);

      // Calculate original scores
      const originalScores: OriginalScore = {
        text: content,
        keywordScores: keywordEmbeddings.map((kwEmbed, i) => ({
          keyword: validKeywords[i],
          scores: calculateAllMetrics(originalEmbedding, kwEmbed.embedding),
        })),
      };

      setProgress(80);

      // Calculate chunk scores
      const chunkScores: ChunkScore[] = chunkTexts.map((text, chunkIdx) => ({
        chunkId: chunkData[chunkIdx].id,
        chunkIndex: chunkIdx,
        text,
        wordCount: chunkData[chunkIdx].wordCount,
        charCount: chunkData[chunkIdx].charCount,
        keywordScores: keywordEmbeddings.map((kwEmbed, i) => ({
          keyword: validKeywords[i],
          scores: calculateAllMetrics(chunkEmbeddings[chunkIdx].embedding, kwEmbed.embedding),
        })),
      }));

      // Calculate no-cascade scores for comparison
      let noCascadeScores: ChunkScore[] | null = null;
      if (noCascadeTexts && noCascadeEmbeddings) {
        noCascadeScores = noCascadeTexts.map((text, chunkIdx) => ({
          chunkId: chunkData[chunkIdx].id,
          chunkIndex: chunkIdx,
          text,
          wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
          charCount: text.length,
          keywordScores: keywordEmbeddings.map((kwEmbed, i) => ({
            keyword: validKeywords[i],
            scores: calculateAllMetrics(noCascadeEmbeddings[chunkIdx].embedding, kwEmbed.embedding),
          })),
        }));
      }

      // Calculate optimized scores if provided
      let optimizedScores: ChunkScore[] | null = null;
      if (optimizedChunks && optimizedEmbeddings) {
        optimizedScores = optimizedChunks.map((chunk, chunkIdx) => ({
          chunkId: chunk.id,
          chunkIndex: chunk.index,
          text: chunk.text,
          wordCount: chunk.wordCount,
          charCount: chunk.charCount,
          keywordScores: keywordEmbeddings.map((kwEmbed, i) => ({
            keyword: validKeywords[i],
            scores: calculateAllMetrics(optimizedEmbeddings[chunkIdx].embedding, kwEmbed.embedding),
          })),
        }));
      }

      setProgress(90);

      // Calculate improvements (chunk vs original)
      const improvements: ImprovementResult[] = [];
      for (const chunkScore of chunkScores) {
        for (const kwScore of chunkScore.keywordScores) {
          const originalKwScore = originalScores.keywordScores.find(
            oks => oks.keyword === kwScore.keyword
          );
          if (originalKwScore) {
            improvements.push({
              chunkId: chunkScore.chunkId,
              keyword: kwScore.keyword,
              cosineImprovement: calculateImprovement(
                originalKwScore.scores.cosine,
                kwScore.scores.cosine
              ),
              euclideanImprovement: calculateImprovement(
                originalKwScore.scores.euclidean,
                kwScore.scores.euclidean
              ),
              chamferImprovement: calculateImprovement(
                originalKwScore.scores.chamfer,
                kwScore.scores.chamfer
              ),
            });
          }
        }
      }

      setProgress(100);

      const analysisResult: AnalysisResult = {
        originalScores,
        chunkScores,
        noCascadeScores,
        optimizedScores,
        improvements,
        timestamp: new Date(),
      };

      setResult(analysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress(0);
  }, []);

  return {
    analyze,
    reset,
    isAnalyzing,
    error,
    result,
    progress,
  };
}
