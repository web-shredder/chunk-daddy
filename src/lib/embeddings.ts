// OpenAI Embeddings API wrapper for Chunk Daddy

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const MODEL = 'text-embedding-3-large';

export interface EmbeddingResult {
  text: string;
  embedding: number[];
}

export interface EmbeddingError {
  message: string;
  code?: string;
}

/**
 * Generate embedding for a single text input
 */
export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      model: MODEL,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `API request failed with status ${response.status}`
    );
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in parallel
 */
export async function generateEmbeddings(
  texts: string[],
  apiKey: string
): Promise<EmbeddingResult[]> {
  // OpenAI supports batch embedding in a single request
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: texts,
      model: MODEL,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `API request failed with status ${response.status}`
    );
  }

  const data = await response.json();
  
  // Sort by index to maintain order
  const sortedData = data.data.sort((a: any, b: any) => a.index - b.index);
  
  return sortedData.map((item: any, index: number) => ({
    text: texts[index],
    embedding: item.embedding,
  }));
}

/**
 * Validate API key format (basic check)
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  return apiKey.startsWith('sk-') && apiKey.length > 20;
}

/**
 * Test API key by making a minimal embedding request
 */
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    await generateEmbedding('test', apiKey);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get stored API key from localStorage
 */
export function getStoredApiKey(): string | null {
  return localStorage.getItem('chunk_daddy_openai_key');
}

/**
 * Store API key in localStorage
 */
export function storeApiKey(apiKey: string): void {
  localStorage.setItem('chunk_daddy_openai_key', apiKey);
}

/**
 * Remove API key from localStorage
 */
export function removeStoredApiKey(): void {
  localStorage.removeItem('chunk_daddy_openai_key');
}
