import { parseIntoSections, createChunksFromSections, type ChunkerOptions } from './layout-chunker';

export interface ChunkBoundary {
  lineEnd: number;
  chunkIndex: number;
  tokenCount: number;
  cascadeTokens: number;
  reason: 'heading' | 'token-limit';
  headingPath: string[];
}

export interface ChunkPreviewData {
  boundaries: ChunkBoundary[];
  totalChunks: number;
  headingSplits: number;
  tokenSplits: number;
}

/**
 * Compute chunk boundaries from markdown content
 * Returns boundary positions and metadata for visual preview
 */
export function computeChunkBoundaries(
  content: string,
  options: Partial<ChunkerOptions> = {}
): ChunkPreviewData {
  if (!content.trim()) {
    return {
      boundaries: [],
      totalChunks: 0,
      headingSplits: 0,
      tokenSplits: 0,
    };
  }

  const sections = parseIntoSections(content);
  const chunks = createChunksFromSections(sections, options);

  let headingSplits = 0;
  let tokenSplits = 0;

  const boundaries: ChunkBoundary[] = chunks.map((chunk, index) => {
    // Determine split reason based on chunk metadata
    const isHeadingSplit = chunk.headingPath.length > 0 && 
      (index === 0 || chunks[index - 1]?.headingPath.join('/') !== chunk.headingPath.join('/'));
    
    const reason: 'heading' | 'token-limit' = isHeadingSplit ? 'heading' : 'token-limit';
    
    if (reason === 'heading') {
      headingSplits++;
    } else {
      tokenSplits++;
    }

    return {
      lineEnd: chunk.sourceLines[1],
      chunkIndex: index,
      tokenCount: chunk.metadata.tokenEstimate,
      cascadeTokens: chunk.metadata.cascadeTokens || 0,
      reason,
      headingPath: chunk.headingPath,
    };
  });

  return {
    boundaries,
    totalChunks: chunks.length,
    headingSplits,
    tokenSplits,
  };
}

/**
 * Group consecutive lines by their chunk assignment
 * Returns line ranges for each chunk for margin coloring
 */
export function getChunkLineRanges(
  content: string,
  options: Partial<ChunkerOptions> = {}
): Array<{ chunkIndex: number; lineStart: number; lineEnd: number; tokenCount: number }> {
  if (!content.trim()) {
    return [];
  }

  const sections = parseIntoSections(content);
  const chunks = createChunksFromSections(sections, options);

  return chunks.map((chunk, index) => ({
    chunkIndex: index,
    lineStart: chunk.sourceLines[0],
    lineEnd: chunk.sourceLines[1],
    tokenCount: chunk.metadata.tokenEstimate,
  }));
}
