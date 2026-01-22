import { useState, useCallback } from 'react';
import { generateEmbeddings, type EmbeddingResult } from '@/lib/embeddings';
import { 
  cosineSimilarity,
  chamferSimilarity,
  euclideanDistance,
  manhattanDistance,
  dotProduct,
  calculatePassageScore,
  calculateImprovement, 
  type SimilarityScores,
} from '@/lib/similarity';
import { chunkContent, type ChunkingStrategy } from '@/lib/chunking';
import type { LayoutAwareChunk, ChunkerOptions } from '@/lib/layout-chunker';
import { 
  calculateAllDiagnostics, 
  type DiagnosticScores 
} from '@/lib/diagnostic-scoring';

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

// Coverage entry for each query showing which chunk best covers it
export interface CoverageEntry {
  query: string;
  bestChunkIndex: number;
  bestChunkHeading: string;
  score: number; // Cosine score as percentage (0-100)
  status: 'covered' | 'weak' | 'gap';
}

// NEW: Diagnostic scores for chunk-query pairs
export interface ChunkDiagnostics {
  chunkIndex: number;
  query: string;
  scores: DiagnosticScores;
}

export interface AnalysisResult {
  originalScores: OriginalScore | null;
  chunkScores: ChunkScore[];
  noCascadeScores: ChunkScore[] | null;
  optimizedScores: ChunkScore[] | null;
  improvements: ImprovementResult[] | null;
  timestamp: Date;
  // Document-level metrics (Path 5)
  documentChamfer?: number;
  coverageMap?: CoverageEntry[];
  coverageSummary?: {
    covered: number;
    weak: number;
    gaps: number;
    totalQueries: number;
  };
  // NEW: Diagnostic scores for all chunk-query pairs
  diagnostics: ChunkDiagnostics[];
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
    const { 
      content, 
      optimizedContent, 
      keywords, 
      strategy, 
      fixedChunkSize, 
      layoutChunks, 
      chunkerOptions,
    } = options;

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

      // Prepare all texts for embedding (whole documents)
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

      // Warn if too few queries for meaningful coverage analysis
      if (validKeywords.length < 3) {
        console.warn('⚠️ Document Chamfer works best with 3+ queries for meaningful coverage analysis');
      }

      console.log('📊 [PATH-5] Embedding breakdown:', {
        totalTexts: textsToEmbed.length,
        originalContent: 1,
        chunks: chunkTexts.length,
        keywords: validKeywords.length,
        noCascadeTexts: noCascadeTexts?.length || 0,
        optimizedChunks: optimizedChunks?.length || 0,
      });

      setProgress(15);

      // Generate all embeddings in one batch via edge function
      const embeddings = await generateEmbeddings(textsToEmbed);

      setProgress(40);

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

      setProgress(50);

      // ========== DOCUMENT-LEVEL CHAMFER (Path 5) ==========
      // Calculate Chamfer ONCE between all chunk vectors and all query vectors
      // This measures: "How well does the document cover all query aspects?"
      
      const allChunkVectors = chunkEmbeddings.map(e => e.embedding);
      const allQueryVectors = keywordEmbeddings.map(e => e.embedding);

      let documentChamfer = 0;
      if (allChunkVectors.length >= 1 && allQueryVectors.length >= 1) {
        documentChamfer = chamferSimilarity(allChunkVectors, allQueryVectors);
      }

      console.log('📊 [DOCUMENT-CHAMFER] Calculated:', {
        chunkCount: allChunkVectors.length,
        queryCount: allQueryVectors.length,
        chamferScore: documentChamfer.toFixed(4),
      });

      setProgress(55);

      // Calculate original scores (always uses whole-document vectors)
      const originalScores: OriginalScore = {
        text: content,
        keywordScores: keywordEmbeddings.map((kwEmbed, i) => {
          const cosine = cosineSimilarity(originalEmbedding, kwEmbed.embedding);
          return {
            keyword: validKeywords[i],
            scores: {
              cosine,
              chamfer: documentChamfer, // Document-level
              passageScore: calculatePassageScore(cosine, documentChamfer),
              euclidean: euclideanDistance(originalEmbedding, kwEmbed.embedding),
              manhattan: manhattanDistance(originalEmbedding, kwEmbed.embedding),
              dotProduct: dotProduct(originalEmbedding, kwEmbed.embedding),
            },
          };
        }),
      };

      setProgress(65);

      // ========== PER-CHUNK SCORING ==========
      // Each chunk gets: 70% chunk-level cosine + 30% document-level chamfer
      const chunkScores: ChunkScore[] = chunkTexts.map((text, chunkIdx) => ({
        chunkId: chunkData[chunkIdx].id,
        chunkIndex: chunkIdx,
        text,
        wordCount: chunkData[chunkIdx].wordCount,
        charCount: chunkData[chunkIdx].charCount,
        keywordScores: keywordEmbeddings.map((kwEmbed, queryIdx) => {
          const chunkVec = chunkEmbeddings[chunkIdx].embedding;
          const queryVec = kwEmbed.embedding;
          
          // Chunk-level cosine (retrieval probability for this chunk-query pair)
          const cosine = cosineSimilarity(chunkVec, queryVec);
          
          // Passage Score = 70% chunk cosine + 30% document chamfer
          const passageScore = calculatePassageScore(cosine, documentChamfer);
          
          return {
            keyword: validKeywords[queryIdx],
            scores: {
              cosine,
              chamfer: documentChamfer, // Same for all chunks (document-level)
              passageScore,
              euclidean: euclideanDistance(chunkVec, queryVec),
              manhattan: manhattanDistance(chunkVec, queryVec),
              dotProduct: dotProduct(chunkVec, queryVec),
            },
          };
        }),
      }));

      setProgress(75);

      // ========== COVERAGE MAP ==========
      // For each query, find which chunk best covers it
      const coverageMap: CoverageEntry[] = validKeywords.map((query, queryIdx) => {
        let bestScore = 0;
        let bestChunkIndex = 0;
        
        chunkEmbeddings.forEach((chunkEmbed, chunkIdx) => {
          const score = cosineSimilarity(chunkEmbed.embedding, keywordEmbeddings[queryIdx].embedding);
          if (score > bestScore) {
            bestScore = score;
            bestChunkIndex = chunkIdx;
          }
        });
        
        const scorePercent = bestScore * 100;
        
        return {
          query,
          bestChunkIndex,
          bestChunkHeading: layoutChunks?.[bestChunkIndex]?.headingPath?.slice(-1)[0] || `Chunk ${bestChunkIndex + 1}`,
          score: scorePercent,
          status: scorePercent >= 70 ? 'covered' : scorePercent >= 50 ? 'weak' : 'gap',
        };
      });

      const coverageSummary = {
        covered: coverageMap.filter(c => c.status === 'covered').length,
        weak: coverageMap.filter(c => c.status === 'weak').length,
        gaps: coverageMap.filter(c => c.status === 'gap').length,
        totalQueries: coverageMap.length,
      };

      console.log('📊 [COVERAGE] Summary:', coverageSummary);

      setProgress(80);

      // Calculate no-cascade scores for comparison
      let noCascadeScores: ChunkScore[] | null = null;
      if (noCascadeTexts && noCascadeEmbeddings) {
        noCascadeScores = noCascadeTexts.map((text, chunkIdx) => ({
          chunkId: chunkData[chunkIdx].id,
          chunkIndex: chunkIdx,
          text,
          wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
          charCount: text.length,
          keywordScores: keywordEmbeddings.map((kwEmbed, i) => {
            const cosine = cosineSimilarity(noCascadeEmbeddings[chunkIdx].embedding, kwEmbed.embedding);
            return {
              keyword: validKeywords[i],
              scores: {
                cosine,
                chamfer: documentChamfer,
                passageScore: calculatePassageScore(cosine, documentChamfer),
                euclidean: euclideanDistance(noCascadeEmbeddings[chunkIdx].embedding, kwEmbed.embedding),
                manhattan: manhattanDistance(noCascadeEmbeddings[chunkIdx].embedding, kwEmbed.embedding),
                dotProduct: dotProduct(noCascadeEmbeddings[chunkIdx].embedding, kwEmbed.embedding),
              },
            };
          }),
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
          keywordScores: keywordEmbeddings.map((kwEmbed, i) => {
            const cosine = cosineSimilarity(optimizedEmbeddings[chunkIdx].embedding, kwEmbed.embedding);
            return {
              keyword: validKeywords[i],
              scores: {
                cosine,
                chamfer: documentChamfer,
                passageScore: calculatePassageScore(cosine, documentChamfer),
                euclidean: euclideanDistance(optimizedEmbeddings[chunkIdx].embedding, kwEmbed.embedding),
                manhattan: manhattanDistance(optimizedEmbeddings[chunkIdx].embedding, kwEmbed.embedding),
                dotProduct: dotProduct(optimizedEmbeddings[chunkIdx].embedding, kwEmbed.embedding),
              },
            };
          }),
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

      setProgress(95);

      // ========== DIAGNOSTIC SCORING ==========
      // Calculate diagnostics for all chunk-query pairs
      const diagnostics: ChunkDiagnostics[] = [];

      for (let chunkIdx = 0; chunkIdx < chunkTexts.length; chunkIdx++) {
        const chunkScore = chunkScores[chunkIdx];
        
        // Get chunk metadata for diagnostics
        const chunkText = chunkTexts[chunkIdx];
        const chunkWithoutCascade = noCascadeTexts?.[chunkIdx] || chunkText;
        const headingPath = layoutChunks?.[chunkIdx]?.headingPath || [];
        
        for (const query of validKeywords) {
          // Find the semantic score for this chunk-query pair
          const keywordScore = chunkScore.keywordScores.find(
            ks => ks.keyword.toLowerCase() === query.toLowerCase()
          );
          const semanticScore = keywordScore 
            ? keywordScore.scores.passageScore 
            : 0;
          
          const scores = calculateAllDiagnostics(
            chunkText,
            chunkWithoutCascade,
            headingPath,
            query,
            semanticScore
          );
          
          diagnostics.push({
            chunkIndex: chunkIdx,
            query,
            scores
          });
        }
      }

      console.log('📊 [DIAGNOSTICS] Calculated:', {
        totalPairs: diagnostics.length,
        chunks: chunkTexts.length,
        queries: validKeywords.length,
        criticalIssues: diagnostics.filter(d => d.scores.diagnosis.fixPriority === 'critical').length,
        importantIssues: diagnostics.filter(d => d.scores.diagnosis.fixPriority === 'important').length,
      });

      setProgress(100);

      const analysisResult: AnalysisResult = {
        originalScores,
        chunkScores,
        noCascadeScores,
        optimizedScores,
        improvements,
        timestamp: new Date(),
        // Path 5: Document-level metrics
        documentChamfer,
        coverageMap,
        coverageSummary,
        // NEW: Diagnostic scores
        diagnostics,
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

  const setResultFromProject = useCallback((savedResult: AnalysisResult | null) => {
    if (savedResult) {
      // Restore the timestamp as a Date object if it was serialized
      const restoredResult = {
        ...savedResult,
        timestamp: savedResult.timestamp instanceof Date 
          ? savedResult.timestamp 
          : new Date(savedResult.timestamp),
      };
      setResult(restoredResult);
    }
  }, []);

  return {
    analyze,
    reset,
    setResultFromProject,
    isAnalyzing,
    error,
    result,
    progress,
  };
}
