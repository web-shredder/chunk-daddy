// Layout-Aware Chunker for Chunk Daddy
// Implements Google-style RAG chunking with cascading headings

export interface HeadingInfo {
  level: number;
  text: string;
}

export interface DocumentElement {
  type: 'heading' | 'paragraph';
  level?: number;
  content: string;
  headings: HeadingInfo[];
  lineStart: number;
  lineEnd: number;
}

export interface LayoutAwareChunk {
  id: string;
  text: string;
  textWithoutCascade: string;
  headingPath: string[];
  sourceLines: [number, number];
  metadata: {
    type: 'paragraph' | 'heading';
    hasCascade: boolean;
    headingLevels: number[];
    wordCount: number;
    charCount: number;
    tokenEstimate: number;
  };
}

export interface ChunkerOptions {
  maxChunkSize: number; // in tokens (1 token ≈ 4 chars)
  chunkOverlap: number; // in tokens
  cascadeHeadings: boolean;
}

const DEFAULT_OPTIONS: ChunkerOptions = {
  maxChunkSize: 512,
  chunkOverlap: 50,
  cascadeHeadings: true,
};

/**
 * Estimate token count from text (rough: 1 token ≈ 4 characters)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get word count
 */
export function getWordCount(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Parse markdown into structured elements
 */
export function parseMarkdown(content: string): DocumentElement[] {
  const lines = content.split('\n');
  const elements: DocumentElement[] = [];
  const headingStack: HeadingInfo[] = [];
  
  let currentParagraph: string[] = [];
  let paragraphStartLine = 0;
  
  const flushParagraph = (endLine: number) => {
    const text = currentParagraph.join('\n').trim();
    if (text) {
      elements.push({
        type: 'paragraph',
        content: text,
        headings: [...headingStack],
        lineStart: paragraphStartLine,
        lineEnd: endLine,
      });
    }
    currentParagraph = [];
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headingMatch) {
      // Flush any pending paragraph before processing heading
      flushParagraph(i - 1);
      
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      
      // Pop headings of same or higher level
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      
      // Push new heading
      headingStack.push({ level, text });
      
      // Add heading as its own element
      elements.push({
        type: 'heading',
        level,
        content: text,
        headings: [...headingStack],
        lineStart: i,
        lineEnd: i,
      });
    } else if (line.trim() === '') {
      // Empty line - flush paragraph
      flushParagraph(i - 1);
      paragraphStartLine = i + 1;
    } else {
      // Regular content line
      if (currentParagraph.length === 0) {
        paragraphStartLine = i;
      }
      currentParagraph.push(line);
    }
  }
  
  // Flush remaining paragraph
  flushParagraph(lines.length - 1);
  
  return elements;
}

/**
 * Build cascaded heading text
 */
function buildCascadeText(headings: HeadingInfo[]): string {
  if (headings.length === 0) return '';
  
  return headings
    .map(h => '#'.repeat(h.level) + ' ' + h.text)
    .join('\n\n');
}

/**
 * Split long paragraph into sentences with overlap
 */
function splitLongParagraph(
  text: string,
  maxTokens: number,
  overlapTokens: number
): string[] {
  // Split into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  
  let currentSentences: string[] = [];
  let currentTokens = 0;
  // Headings don't count toward token limit - full maxTokens available for content
  const availableTokens = maxTokens;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    const sentenceTokens = estimateTokens(sentence);
    
    if (currentTokens + sentenceTokens > availableTokens && currentSentences.length > 0) {
      // Flush current chunk
      chunks.push(currentSentences.join(' '));
      
      // Calculate overlap - keep last N tokens worth of sentences
      const overlapSentences: string[] = [];
      let overlapTokenCount = 0;
      for (let j = currentSentences.length - 1; j >= 0; j--) {
        const s = currentSentences[j];
        const sTokens = estimateTokens(s);
        if (overlapTokenCount + sTokens <= overlapTokens) {
          overlapSentences.unshift(s);
          overlapTokenCount += sTokens;
        } else {
          break;
        }
      }
      
      currentSentences = overlapSentences;
      currentTokens = overlapTokenCount;
    }
    
    currentSentences.push(sentence);
    currentTokens += sentenceTokens;
  }
  
  // Add remaining sentences
  if (currentSentences.length > 0) {
    chunks.push(currentSentences.join(' '));
  }
  
  return chunks;
}

/**
 * Create layout-aware chunks from parsed document
 */
export function createLayoutAwareChunks(
  elements: DocumentElement[],
  options: Partial<ChunkerOptions> = {}
): LayoutAwareChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: LayoutAwareChunk[] = [];
  let chunkIndex = 0;
  
  for (const element of elements) {
    // Skip heading-only elements (they'll be included via cascade)
    if (element.type === 'heading') {
      continue;
    }
    
    const cascadeText = opts.cascadeHeadings ? buildCascadeText(element.headings) : '';
    const cascadeTokens = estimateTokens(cascadeText);
    const contentTokens = estimateTokens(element.content);
    const totalTokens = cascadeTokens + contentTokens + (cascadeText ? 4 : 0); // +4 for spacing
    
    const headingPath = element.headings.map(h => h.text);
    const headingLevels = element.headings.map(h => h.level);
    
    // Only paragraph content counts toward max size - headings are always included for context
    if (contentTokens <= opts.maxChunkSize) {
      // Single chunk
      const fullText = cascadeText 
        ? cascadeText + '\n\n' + element.content 
        : element.content;
      
      // DIAGNOSTIC: Check newline preservation
      console.log('🔴 [CHUNKER] Creating chunk:', {
        chunkIndex,
        contentHasNewlines: element.content.includes('\n'),
        contentNewlineCount: (element.content.match(/\n/g) || []).length,
        contentFirst60: element.content.substring(0, 60).replace(/\n/g, '↵'),
      });
      
      chunks.push({
        id: `chunk-${chunkIndex++}`,
        text: fullText,
        textWithoutCascade: element.content,
        headingPath,
        sourceLines: [element.lineStart, element.lineEnd],
        metadata: {
          type: 'paragraph',
          hasCascade: opts.cascadeHeadings && element.headings.length > 0,
          headingLevels,
          wordCount: getWordCount(fullText),
          charCount: fullText.length,
          tokenEstimate: estimateTokens(fullText),
        },
      });
    } else {
      // Split into multiple chunks with overlap
      const splitParagraphs = splitLongParagraph(
        element.content,
        opts.maxChunkSize,
        opts.chunkOverlap
      );
      
      for (const para of splitParagraphs) {
        const fullText = cascadeText 
          ? cascadeText + '\n\n' + para 
          : para;
        
        chunks.push({
          id: `chunk-${chunkIndex++}`,
          text: fullText,
          textWithoutCascade: para,
          headingPath,
          sourceLines: [element.lineStart, element.lineEnd],
          metadata: {
            type: 'paragraph',
            hasCascade: opts.cascadeHeadings && element.headings.length > 0,
            headingLevels,
            wordCount: getWordCount(fullText),
            charCount: fullText.length,
            tokenEstimate: estimateTokens(fullText),
          },
        });
      }
    }
  }
  
  return chunks;
}

/**
 * Get document statistics
 */
export function getDocumentStats(content: string): {
  charCount: number;
  wordCount: number;
  paragraphCount: number;
  headingCount: number;
  h1Count: number;
  h2Count: number;
  h3Count: number;
  h4Count: number;
  h5Count: number;
  h6Count: number;
} {
  const elements = parseMarkdown(content);
  
  const headings = elements.filter(e => e.type === 'heading');
  const paragraphs = elements.filter(e => e.type === 'paragraph');
  
  return {
    charCount: content.length,
    wordCount: getWordCount(content),
    paragraphCount: paragraphs.length,
    headingCount: headings.length,
    h1Count: headings.filter(h => h.level === 1).length,
    h2Count: headings.filter(h => h.level === 2).length,
    h3Count: headings.filter(h => h.level === 3).length,
    h4Count: headings.filter(h => h.level === 4).length,
    h5Count: headings.filter(h => h.level === 5).length,
    h6Count: headings.filter(h => h.level === 6).length,
  };
}

/**
 * Preview chunk count without creating full chunks
 */
export function previewChunkCount(
  content: string,
  options: Partial<ChunkerOptions> = {}
): number {
  const elements = parseMarkdown(content);
  const chunks = createLayoutAwareChunks(elements, options);
  return chunks.length;
}

/**
 * Sample markdown content for demo
 */
export const SAMPLE_MARKDOWN = `# Machine Learning Guide

## Introduction to ML

Machine learning algorithms process vast datasets to identify patterns and make predictions. These algorithms learn from data without explicit programming.

## Pattern Recognition

ML excels at pattern recognition tasks. It can identify complex relationships in data that humans might miss.

### Supervised Learning

Supervised learning uses labeled training data. The algorithm learns to map inputs to correct outputs.

### Unsupervised Learning

Unsupervised learning finds patterns in unlabeled data. Common techniques include clustering and dimensionality reduction.

## Data Privacy Concerns

Data privacy concerns arise when ML systems handle sensitive information without proper safeguards. Organizations must implement:

- Encryption for data at rest and in transit
- Access controls and audit logging
- Anonymization techniques for personal data
- Compliance with regulations like GDPR

## Future of ML

ML technology continues to evolve rapidly. New architectures and training methods emerge frequently.`;
