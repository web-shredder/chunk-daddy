// Layout-Aware Chunker for Chunk Daddy
// Section-based model: headings are metadata (free), body content accumulates until token limit or next heading

export interface HeadingInfo {
  level: number;
  text: string;
}

// Legacy type for backward compatibility
export interface DocumentElement {
  type: 'heading' | 'paragraph';
  level?: number;
  content: string;
  headings: HeadingInfo[];
  lineStart: number;
  lineEnd: number;
}

export interface BodyElement {
  type: 'paragraph' | 'list' | 'table' | 'blockquote' | 'code';
  content: string;
  tokens: number;
  lineStart: number;
  lineEnd: number;
}

export interface Section {
  headings: HeadingInfo[];      // Cascade stack at this point
  bodyElements: BodyElement[];  // All content elements in this section
  bodyTokens: number;           // Total tokens in body (excludes cascade)
  lineStart: number;
  lineEnd: number;
}

export interface LayoutAwareChunk {
  id: string;
  text: string;                 // Full text with cascade (for embedding/scoring)
  textWithoutCascade: string;   // Body only (for display)
  headingPath: string[];
  sourceLines: [number, number];
  metadata: {
    type: 'section' | 'paragraph' | 'heading'; // Support legacy type values
    hasCascade: boolean;
    headingLevels: number[];
    wordCount: number;
    charCount: number;
    tokenEstimate: number;      // Body tokens only
    cascadeTokens?: number;     // Cascade tokens (tracked separately, optional for legacy)
  };
}

export interface ChunkerOptions {
  maxChunkSize: number;    // Max body tokens (excludes cascade) - default 512
  chunkOverlap: number;    // Overlap tokens when splitting - default 50
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
 * Build cascaded heading text
 */
function buildCascadeText(headings: HeadingInfo[]): string {
  if (headings.length === 0) return '';
  
  return headings
    .map(h => '#'.repeat(h.level) + ' ' + h.text)
    .join('\n\n');
}

/**
 * Parse a fenced code block (``` or ~~~)
 */
function parseCodeBlock(lines: string[], startIndex: number): BodyElement {
  const fenceMatch = lines[startIndex].match(/^(```|~~~)/);
  const fence = fenceMatch?.[1] || '```';
  const codeLines: string[] = [lines[startIndex]];
  let i = startIndex + 1;
  
  while (i < lines.length) {
    codeLines.push(lines[i]);
    if (lines[i].startsWith(fence)) break;
    i++;
  }
  
  const content = codeLines.join('\n');
  return {
    type: 'code',
    content,
    tokens: estimateTokens(content),
    lineStart: startIndex,
    lineEnd: i,
  };
}

/**
 * Parse a table (lines starting with |)
 */
function parseTable(lines: string[], startIndex: number): BodyElement {
  const tableLines: string[] = [];
  let i = startIndex;
  
  while (i < lines.length && lines[i].match(/^\|/)) {
    tableLines.push(lines[i]);
    i++;
  }
  
  const content = tableLines.join('\n');
  return {
    type: 'table',
    content,
    tokens: estimateTokens(content),
    lineStart: startIndex,
    lineEnd: i - 1,
  };
}

/**
 * Parse a blockquote (lines starting with >)
 */
function parseBlockquote(lines: string[], startIndex: number): BodyElement {
  const quoteLines: string[] = [];
  let i = startIndex;
  
  while (i < lines.length) {
    const line = lines[i];
    if (line.match(/^>\s?/)) {
      quoteLines.push(line);
      i++;
    } else if (line.trim() === '' && i + 1 < lines.length && lines[i + 1].match(/^>/)) {
      // Empty line followed by more blockquote
      quoteLines.push(line);
      i++;
    } else {
      break;
    }
  }
  
  const content = quoteLines.join('\n');
  return {
    type: 'blockquote',
    content,
    tokens: estimateTokens(content),
    lineStart: startIndex,
    lineEnd: i - 1,
  };
}

/**
 * Parse a list (unordered or ordered)
 */
function parseList(lines: string[], startIndex: number): BodyElement {
  const listLines: string[] = [];
  let i = startIndex;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Continue if: list item or indented continuation
    const isListItem = line.match(/^[-*+]\s+/) || line.match(/^\d+\.\s+/);
    const isIndented = line.match(/^\s+\S/);
    const isEmpty = line.trim() === '';
    
    if (isListItem || isIndented) {
      listLines.push(line);
      i++;
    } else if (isEmpty) {
      // Check if list continues after empty line
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.match(/^[-*+]\s+/) || nextLine.match(/^\d+\.\s+/) || nextLine.match(/^\s+\S/)) {
          listLines.push(line); // Keep the empty line
          i++;
          continue;
        }
      }
      break;
    } else {
      break;
    }
  }
  
  const content = listLines.join('\n');
  return {
    type: 'list',
    content,
    tokens: estimateTokens(content),
    lineStart: startIndex,
    lineEnd: i - 1,
  };
}

/**
 * Parse a paragraph (default text content)
 */
function parseParagraph(lines: string[], startIndex: number): BodyElement {
  const paraLines: string[] = [];
  let i = startIndex;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // End paragraph at: empty line, heading, list, table, code, blockquote
    if (!line.trim() || 
        line.match(/^#{1,6}\s/) ||
        line.match(/^[-*+]\s+/) ||
        line.match(/^\d+\.\s+/) ||
        line.match(/^\|/) ||
        line.match(/^```|^~~~/) ||
        line.match(/^>\s?/)) {
      break;
    }
    
    paraLines.push(line);
    i++;
  }
  
  const content = paraLines.join('\n');
  return {
    type: 'paragraph',
    content,
    tokens: estimateTokens(content),
    lineStart: startIndex,
    lineEnd: i - 1,
  };
}

/**
 * Parse a body element from lines
 */
function parseBodyElement(lines: string[], startIndex: number): BodyElement | null {
  const line = lines[startIndex];
  
  // Skip empty lines
  if (!line || !line.trim()) return null;
  
  // 1. Fenced code block (``` or ~~~)
  if (line.match(/^```|^~~~/)) {
    return parseCodeBlock(lines, startIndex);
  }
  
  // 2. Table (starts with |)
  if (line.match(/^\|/)) {
    return parseTable(lines, startIndex);
  }
  
  // 3. Blockquote (starts with >)
  if (line.match(/^>\s?/)) {
    return parseBlockquote(lines, startIndex);
  }
  
  // 4. List (unordered: -, *, + or ordered: 1., 2., etc.)
  if (line.match(/^[-*+]\s+/) || line.match(/^\d+\.\s+/)) {
    return parseList(lines, startIndex);
  }
  
  // 5. Paragraph (default)
  return parseParagraph(lines, startIndex);
}

/**
 * Parse markdown into sections
 * A section is all body content under a heading until the next heading
 */
export function parseIntoSections(markdown: string): Section[] {
  const lines = markdown.split('\n');
  const sections: Section[] = [];
  const headingStack: HeadingInfo[] = [];
  
  let currentSection: Section | null = null;
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check for heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      // Finalize previous section
      if (currentSection && currentSection.bodyElements.length > 0) {
        sections.push(currentSection);
      }
      
      // Update heading stack (pop to appropriate level, then push)
      const level = headingMatch[1].length;
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, text: headingMatch[2].trim() });
      
      // Start new section
      currentSection = {
        headings: [...headingStack],
        bodyElements: [],
        bodyTokens: 0,
        lineStart: i,
        lineEnd: i,
      };
      
      i++;
      continue;
    }
    
    // Skip empty lines at start or between elements
    if (!line.trim()) {
      i++;
      continue;
    }
    
    // Initialize section if none exists (content before first heading)
    if (!currentSection) {
      currentSection = {
        headings: [],
        bodyElements: [],
        bodyTokens: 0,
        lineStart: i,
        lineEnd: i,
      };
    }
    
    // Parse body element
    const element = parseBodyElement(lines, i);
    if (element) {
      currentSection.bodyElements.push(element);
      currentSection.bodyTokens += element.tokens;
      currentSection.lineEnd = element.lineEnd;
      i = element.lineEnd + 1;
    } else {
      i++;
    }
  }
  
  // Finalize last section
  if (currentSection && currentSection.bodyElements.length > 0) {
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * Split text into segments for chunking (preserves lists/tables as units)
 */
function splitIntoSegments(text: string): string[] {
  // Split on double newlines (preserves lists, tables as units)
  const blocks = text.split(/\n\n+/);
  const segments: string[] = [];
  
  for (const block of blocks) {
    if (!block.trim()) continue;
    
    const blockTokens = estimateTokens(block);
    
    if (blockTokens <= 100) {
      // Small block, keep as-is
      segments.push(block);
    } else if (block.match(/^[-*+]|^\d+\.|^\|/m)) {
      // List or table - keep as single unit
      segments.push(block);
    } else {
      // Large paragraph - split by sentences
      const sentences = block.match(/[^.!?]+[.!?]+/g) || [block];
      segments.push(...sentences.map(s => s.trim()).filter(s => s));
    }
  }
  
  return segments;
}

/**
 * Split a section's body content with overlap when it exceeds max tokens
 */
function splitSectionWithOverlap(
  section: Section,
  maxTokens: number,
  overlapTokens: number
): Array<{ content: string; tokens: number }> {
  const results: Array<{ content: string; tokens: number }> = [];
  
  // Flatten all body content into a single string for splitting
  const fullBody = section.bodyElements.map(e => e.content).join('\n\n');
  
  // Split by sentences/natural breaks for cleaner chunks
  const segments = splitIntoSegments(fullBody);
  
  let currentSegments: string[] = [];
  let currentTokens = 0;
  let overlapBuffer: string[] = []; // Holds last ~50 tokens worth for overlap
  
  for (const segment of segments) {
    const segmentTokens = estimateTokens(segment);
    
    if (currentTokens + segmentTokens > maxTokens && currentSegments.length > 0) {
      // Flush current chunk
      results.push({
        content: currentSegments.join('\n\n'),
        tokens: currentTokens,
      });
      
      // Start new chunk with overlap from previous
      currentSegments = [...overlapBuffer];
      currentTokens = overlapBuffer.reduce((sum, s) => sum + estimateTokens(s), 0);
    }
    
    currentSegments.push(segment);
    currentTokens += segmentTokens;
    
    // Update overlap buffer (keep last ~50 tokens worth)
    overlapBuffer.push(segment);
    while (overlapBuffer.length > 1 && 
           overlapBuffer.reduce((sum, s) => sum + estimateTokens(s), 0) > overlapTokens) {
      overlapBuffer.shift();
    }
  }
  
  // Flush remaining
  if (currentSegments.length > 0) {
    results.push({
      content: currentSegments.join('\n\n'),
      tokens: currentTokens,
    });
  }
  
  return results;
}

/**
 * Create a single chunk from section data
 */
function createChunk(
  index: number,
  cascade: string,
  bodyContent: string,
  section: Section,
  bodyTokens?: number
): LayoutAwareChunk {
  const fullText = cascade ? `${cascade}\n\n${bodyContent}` : bodyContent;
  const actualBodyTokens = bodyTokens ?? estimateTokens(bodyContent);
  const cascadeTokens = estimateTokens(cascade);
  
  return {
    id: `chunk-${index}`,
    text: fullText,
    textWithoutCascade: bodyContent,
    headingPath: section.headings.map(h => h.text),
    sourceLines: [section.lineStart, section.lineEnd],
    metadata: {
      type: 'section',
      hasCascade: !!cascade,
      headingLevels: section.headings.map(h => h.level),
      wordCount: getWordCount(bodyContent),
      charCount: bodyContent.length,
      tokenEstimate: actualBodyTokens,
      cascadeTokens,
    },
  };
}

/**
 * Create layout-aware chunks from sections
 */
export function createChunksFromSections(
  sections: Section[],
  options: Partial<ChunkerOptions> = {}
): LayoutAwareChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: LayoutAwareChunk[] = [];
  
  for (const section of sections) {
    const cascade = opts.cascadeHeadings 
      ? buildCascadeText(section.headings) 
      : '';
    
    if (section.bodyTokens <= opts.maxChunkSize) {
      // Section fits in one chunk
      const bodyContent = section.bodyElements.map(e => e.content).join('\n\n');
      chunks.push(createChunk(chunks.length, cascade, bodyContent, section, section.bodyTokens));
    } else {
      // Section needs splitting with overlap
      const sectionChunks = splitSectionWithOverlap(
        section, 
        opts.maxChunkSize, 
        opts.chunkOverlap
      );
      
      for (const chunkData of sectionChunks) {
        chunks.push(createChunk(chunks.length, cascade, chunkData.content, section, chunkData.tokens));
      }
    }
  }
  
  return chunks;
}

/**
 * Main entry point: create layout-aware chunks from markdown
 */
export function createLayoutAwareChunks(
  content: string,
  options: Partial<ChunkerOptions> = {}
): LayoutAwareChunk[] {
  const sections = parseIntoSections(content);
  return createChunksFromSections(sections, options);
}

/**
 * Legacy compatibility: parse markdown into elements (for backward compatibility)
 */
export function parseMarkdown(content: string): Array<{
  type: 'heading' | 'paragraph';
  level?: number;
  content: string;
  headings: HeadingInfo[];
  lineStart: number;
  lineEnd: number;
}> {
  const sections = parseIntoSections(content);
  const elements: Array<{
    type: 'heading' | 'paragraph';
    level?: number;
    content: string;
    headings: HeadingInfo[];
    lineStart: number;
    lineEnd: number;
  }> = [];
  
  for (const section of sections) {
    // Add heading element if section has headings
    if (section.headings.length > 0) {
      const lastHeading = section.headings[section.headings.length - 1];
      elements.push({
        type: 'heading',
        level: lastHeading.level,
        content: lastHeading.text,
        headings: section.headings,
        lineStart: section.lineStart,
        lineEnd: section.lineStart,
      });
    }
    
    // Add body as paragraph elements
    for (const bodyElement of section.bodyElements) {
      elements.push({
        type: 'paragraph',
        content: bodyElement.content,
        headings: section.headings,
        lineStart: bodyElement.lineStart,
        lineEnd: bodyElement.lineEnd,
      });
    }
  }
  
  return elements;
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
  const sections = parseIntoSections(content);
  
  let headingCount = 0;
  let h1Count = 0, h2Count = 0, h3Count = 0, h4Count = 0, h5Count = 0, h6Count = 0;
  let paragraphCount = 0;
  
  for (const section of sections) {
    // Count the section's own heading (last in cascade)
    if (section.headings.length > 0) {
      const lastHeading = section.headings[section.headings.length - 1];
      headingCount++;
      switch (lastHeading.level) {
        case 1: h1Count++; break;
        case 2: h2Count++; break;
        case 3: h3Count++; break;
        case 4: h4Count++; break;
        case 5: h5Count++; break;
        case 6: h6Count++; break;
      }
    }
    
    // Count body elements as paragraphs
    paragraphCount += section.bodyElements.length;
  }
  
  return {
    charCount: content.length,
    wordCount: getWordCount(content),
    paragraphCount,
    headingCount,
    h1Count,
    h2Count,
    h3Count,
    h4Count,
    h5Count,
    h6Count,
  };
}

/**
 * Preview chunk count without creating full chunks
 */
export function previewChunkCount(
  content: string,
  options: Partial<ChunkerOptions> = {}
): number {
  const chunks = createLayoutAwareChunks(content, options);
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
