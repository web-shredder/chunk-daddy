// Chunking strategies for Chunk Daddy

export type ChunkingStrategy = 'paragraph' | 'semantic' | 'fixed';

export interface Chunk {
  id: string;
  text: string;
  index: number;
  charCount: number;
  wordCount: number;
}

/**
 * Split content into chunks based on paragraph breaks
 */
export function chunkByParagraph(content: string): Chunk[] {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  return paragraphs.map((text, index) => ({
    id: `chunk-${index}`,
    text,
    index,
    charCount: text.length,
    wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
  }));
}

/**
 * Split content into chunks based on sentence boundaries (semantic-ish)
 * Groups sentences that appear to be related
 */
export function chunkBySemantic(content: string): Chunk[] {
  // Split by sentences
  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  if (sentences.length === 0) {
    return [];
  }
  
  // Group sentences into chunks (2-3 sentences per chunk, or by topic shift)
  const chunks: Chunk[] = [];
  let currentChunk: string[] = [];
  let chunkIndex = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    currentChunk.push(sentences[i]);
    
    // Create a new chunk every 2-3 sentences or at paragraph breaks
    const shouldSplit = 
      currentChunk.length >= 2 && (
        currentChunk.length >= 3 ||
        sentences[i].endsWith('.') && i < sentences.length - 1
      );
    
    if (shouldSplit || i === sentences.length - 1) {
      const text = currentChunk.join(' ');
      chunks.push({
        id: `chunk-${chunkIndex}`,
        text,
        index: chunkIndex,
        charCount: text.length,
        wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
      });
      currentChunk = [];
      chunkIndex++;
    }
  }
  
  return chunks;
}

/**
 * Split content into fixed-size chunks
 */
export function chunkByFixed(content: string, maxChars: number = 500): Chunk[] {
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const chunks: Chunk[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;
  let chunkIndex = 0;
  
  for (const word of words) {
    const wordWithSpace = currentChunk.length > 0 ? ` ${word}` : word;
    
    if (currentLength + wordWithSpace.length > maxChars && currentChunk.length > 0) {
      const text = currentChunk.join(' ');
      chunks.push({
        id: `chunk-${chunkIndex}`,
        text,
        index: chunkIndex,
        charCount: text.length,
        wordCount: currentChunk.length,
      });
      currentChunk = [word];
      currentLength = word.length;
      chunkIndex++;
    } else {
      currentChunk.push(word);
      currentLength += wordWithSpace.length;
    }
  }
  
  // Add remaining content
  if (currentChunk.length > 0) {
    const text = currentChunk.join(' ');
    chunks.push({
      id: `chunk-${chunkIndex}`,
      text,
      index: chunkIndex,
      charCount: text.length,
      wordCount: currentChunk.length,
    });
  }
  
  return chunks;
}

/**
 * Chunk content based on selected strategy
 */
export function chunkContent(
  content: string,
  strategy: ChunkingStrategy,
  fixedSize?: number
): Chunk[] {
  switch (strategy) {
    case 'paragraph':
      return chunkByParagraph(content);
    case 'semantic':
      return chunkBySemantic(content);
    case 'fixed':
      return chunkByFixed(content, fixedSize);
    default:
      return chunkByParagraph(content);
  }
}

/**
 * Get total word count for content
 */
export function getWordCount(content: string): number {
  return content.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Get total character count for content
 */
export function getCharCount(content: string): number {
  return content.length;
}
