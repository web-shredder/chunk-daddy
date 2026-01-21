import { cn } from '@/lib/utils';
import { Scissors, Hash } from 'lucide-react';

interface ChunkBoundaryIndicatorProps {
  chunkIndex: number;
  tokenCount: number;
  cascadeTokens: number;
  reason: 'heading' | 'token-limit';
  headingPath?: string[];
  isLast?: boolean;
}

export function ChunkBoundaryIndicator({
  chunkIndex,
  tokenCount,
  cascadeTokens,
  reason,
  headingPath = [],
  isLast = false,
}: ChunkBoundaryIndicatorProps) {
  if (isLast) return null;

  return (
    <div className="chunk-boundary-indicator group" aria-hidden="true">
      {/* Gradient line */}
      <div className="chunk-boundary-line" />
      
      {/* Center pill */}
      <div className="chunk-boundary-pill">
        <div className="chunk-boundary-dot" />
        <span className="chunk-boundary-label">
          Chunk {chunkIndex + 1}
        </span>
        <span className="chunk-boundary-tokens">
          ~{tokenCount} tokens
        </span>
        {cascadeTokens > 0 && (
          <span className="chunk-boundary-cascade">
            +{cascadeTokens} cascade
          </span>
        )}
        {reason === 'token-limit' && (
          <span className="chunk-boundary-reason">
            <Scissors className="h-2.5 w-2.5" />
            split
          </span>
        )}
        {reason === 'heading' && headingPath.length > 0 && (
          <span className="chunk-boundary-reason heading">
            <Hash className="h-2.5 w-2.5" />
            section
          </span>
        )}
      </div>
    </div>
  );
}

interface ChunkMarginIndicatorProps {
  chunkIndex: number;
  isStart?: boolean;
  isEnd?: boolean;
}

export function ChunkMarginIndicator({
  chunkIndex,
  isStart = false,
  isEnd = false,
}: ChunkMarginIndicatorProps) {
  const colorIndex = chunkIndex % 4;
  
  return (
    <div
      className={cn(
        'chunk-margin-indicator',
        `chunk-margin-${colorIndex}`,
        isStart && 'chunk-margin-start',
        isEnd && 'chunk-margin-end'
      )}
      aria-hidden="true"
    />
  );
}
