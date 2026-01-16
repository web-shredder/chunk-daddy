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
export async function checkApiStatus(): Promise<boolean> {
  try {
    await generateEmbedding('test');
    return true;
  } catch {
    return false;
  }
}
