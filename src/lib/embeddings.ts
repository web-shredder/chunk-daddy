// Gemini Embeddings via Edge Function for Chunk Daddy
import { supabase } from '@/integrations/supabase/client';

export type TaskType = 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY';

export interface EmbeddingResult {
  text: string;
  embedding: number[];
}

/**
 * Generate embeddings for multiple texts via edge function
 * 
 * @param texts - Array of text strings to embed
 * @param taskType - The task type for embeddings:
 *   - RETRIEVAL_DOCUMENT: For content/chunks that will be retrieved
 *   - RETRIEVAL_QUERY: For queries that will search against documents
 *   - SEMANTIC_SIMILARITY: For general similarity comparisons
 */
export async function generateEmbeddings(
  texts: string[],
  taskType: TaskType = 'RETRIEVAL_DOCUMENT'
): Promise<EmbeddingResult[]> {
  const { data, error } = await supabase.functions.invoke('generate-embeddings', {
    body: { texts, taskType },
  });

  if (error) {
    throw new Error(error.message || 'Failed to generate embeddings');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data.embeddings;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
  text: string,
  taskType: TaskType = 'RETRIEVAL_DOCUMENT'
): Promise<number[]> {
  const results = await generateEmbeddings([text], taskType);
  return results[0].embedding;
}

/**
 * Check if the embedding service is available
 */
export async function checkApiStatus(): Promise<{ valid: boolean; error?: string }> {
  try {
    await generateEmbedding('test');
    return { valid: true };
  } catch (err) {
    return { 
      valid: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}

export interface SentenceEmbeddingResult {
  text: string;
  embedding: number[];
  sourceType: 'chunk' | 'query';
  sourceIndex: number;
  sentenceIndex: number;
}

/**
 * Generate embeddings for all sentences across chunks and queries in a single batch.
 * Returns maps for easy lookup by source index.
 * 
 * Uses appropriate task types:
 * - Chunks use RETRIEVAL_DOCUMENT
 * - Queries use RETRIEVAL_QUERY
 */
export async function generateSentenceEmbeddingsBatch(
  chunkSentences: { chunkIndex: number; sentences: string[] }[],
  queryClauses: { queryIndex: number; clauses: string[] }[]
): Promise<{
  chunkEmbeddings: Map<number, number[][]>; // chunkIndex -> sentence embeddings
  queryEmbeddings: Map<number, number[][]>; // queryIndex -> clause embeddings
}> {
  // If no texts to embed, return empty maps
  if (chunkSentences.length === 0 && queryClauses.length === 0) {
    return {
      chunkEmbeddings: new Map(),
      queryEmbeddings: new Map(),
    };
  }

  // Collect chunk texts
  const chunkTexts: string[] = [];
  const chunkMetadata: Array<{ sourceIndex: number; sentenceIndex: number }> = [];
  
  chunkSentences.forEach(({ chunkIndex, sentences }) => {
    sentences.forEach((sentence, sentenceIndex) => {
      chunkTexts.push(sentence);
      chunkMetadata.push({ sourceIndex: chunkIndex, sentenceIndex });
    });
  });
  
  // Collect query texts
  const queryTexts: string[] = [];
  const queryMetadata: Array<{ sourceIndex: number; sentenceIndex: number }> = [];
  
  queryClauses.forEach(({ queryIndex, clauses }) => {
    clauses.forEach((clause, clauseIndex) => {
      queryTexts.push(clause);
      queryMetadata.push({ sourceIndex: queryIndex, sentenceIndex: clauseIndex });
    });
  });
  
  // Make separate API calls for chunks and queries with appropriate task types
  const [chunkEmbeddingsResult, queryEmbeddingsResult] = await Promise.all([
    chunkTexts.length > 0 ? generateEmbeddings(chunkTexts, 'RETRIEVAL_DOCUMENT') : Promise.resolve([]),
    queryTexts.length > 0 ? generateEmbeddings(queryTexts, 'RETRIEVAL_QUERY') : Promise.resolve([]),
  ]);
  
  // Organize chunk results by source
  const chunkEmbeddings = new Map<number, number[][]>();
  chunkEmbeddingsResult.forEach((emb, idx) => {
    const meta = chunkMetadata[idx];
    if (!chunkEmbeddings.has(meta.sourceIndex)) {
      chunkEmbeddings.set(meta.sourceIndex, []);
    }
    chunkEmbeddings.get(meta.sourceIndex)!.push(emb.embedding);
  });
  
  // Organize query results by source
  const queryEmbeddings = new Map<number, number[][]>();
  queryEmbeddingsResult.forEach((emb, idx) => {
    const meta = queryMetadata[idx];
    if (!queryEmbeddings.has(meta.sourceIndex)) {
      queryEmbeddings.set(meta.sourceIndex, []);
    }
    queryEmbeddings.get(meta.sourceIndex)!.push(emb.embedding);
  });
  
  return { chunkEmbeddings, queryEmbeddings };
}
