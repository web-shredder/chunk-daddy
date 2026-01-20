// OpenAI Embeddings via Edge Function for Chunk Daddy
import { supabase } from '@/integrations/supabase/client';

export interface EmbeddingResult {
  text: string;
  embedding: number[];
}

/**
 * Generate embeddings for multiple texts via edge function
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  const { data, error } = await supabase.functions.invoke('generate-embeddings', {
    body: { texts },
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
export async function generateEmbedding(text: string): Promise<number[]> {
  const results = await generateEmbeddings([text]);
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
 */
export async function generateSentenceEmbeddingsBatch(
  chunkSentences: { chunkIndex: number; sentences: string[] }[],
  queryClauses: { queryIndex: number; clauses: string[] }[]
): Promise<{
  chunkEmbeddings: Map<number, number[][]>; // chunkIndex -> sentence embeddings
  queryEmbeddings: Map<number, number[][]>; // queryIndex -> clause embeddings
}> {
  // Collect all texts for single batch call
  const allTexts: string[] = [];
  const textMetadata: Array<{
    type: 'chunk' | 'query';
    sourceIndex: number;
    sentenceIndex: number;
  }> = [];
  
  chunkSentences.forEach(({ chunkIndex, sentences }) => {
    sentences.forEach((sentence, sentenceIndex) => {
      allTexts.push(sentence);
      textMetadata.push({
        type: 'chunk',
        sourceIndex: chunkIndex,
        sentenceIndex,
      });
    });
  });
  
  queryClauses.forEach(({ queryIndex, clauses }) => {
    clauses.forEach((clause, clauseIndex) => {
      allTexts.push(clause);
      textMetadata.push({
        type: 'query',
        sourceIndex: queryIndex,
        sentenceIndex: clauseIndex,
      });
    });
  });
  
  // If no texts to embed, return empty maps
  if (allTexts.length === 0) {
    return {
      chunkEmbeddings: new Map(),
      queryEmbeddings: new Map(),
    };
  }
  
  // Single batch API call
  const embeddings = await generateEmbeddings(allTexts);
  
  // Organize results by source
  const chunkEmbeddings = new Map<number, number[][]>();
  const queryEmbeddings = new Map<number, number[][]>();
  
  embeddings.forEach((emb, idx) => {
    const meta = textMetadata[idx];
    
    if (meta.type === 'chunk') {
      if (!chunkEmbeddings.has(meta.sourceIndex)) {
        chunkEmbeddings.set(meta.sourceIndex, []);
      }
      chunkEmbeddings.get(meta.sourceIndex)!.push(emb.embedding);
    } else {
      if (!queryEmbeddings.has(meta.sourceIndex)) {
        queryEmbeddings.set(meta.sourceIndex, []);
      }
      queryEmbeddings.get(meta.sourceIndex)!.push(emb.embedding);
    }
  });
  
  return { chunkEmbeddings, queryEmbeddings };
}
