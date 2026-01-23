import { useState, useEffect, useMemo } from 'react';
import { GooFilterDefs } from './GooFilterDefs';
import { SlimeBlobGroup } from './SlimeBlob';
import { SlimeTendril } from './SlimeConnection';
import { SlimeProgress } from './SlimeProgress';
import { cn } from '@/lib/utils';

interface EmbeddingAnalysisLoaderProps {
  isLoading: boolean;
  progress?: number;
  chunksCount?: number;
  queriesCount?: number;
}

/**
 * Embedding Analysis Loader
 * 
 * Two slime masses (chunks and queries) on opposite sides.
 * Tendrils reach across, probing for connections.
 * When similarity is found, tendrils merge and thicken.
 */
export function EmbeddingAnalysisLoader({
  isLoading,
  progress = 0,
  chunksCount = 5,
  queriesCount = 3,
}: EmbeddingAnalysisLoaderProps) {
  const [tick, setTick] = useState(0);
  const [tendrils, setTendrils] = useState<Array<{
    id: number;
    chunkIndex: number;
    queryIndex: number;
    strength: number;
    isProbing: boolean;
  }>>([]);

  // Animation tick
  useEffect(() => {
    if (!isLoading) return;
    
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 300);
    
    return () => clearInterval(interval);
  }, [isLoading]);

  // Spawn and manage tendrils
  useEffect(() => {
    if (!isLoading) return;
    
    // Add new probing tendril
    if (tendrils.length < Math.min(chunksCount, queriesCount) * 2) {
      const chunkIndex = Math.floor(Math.random() * Math.min(chunksCount, 5));
      const queryIndex = Math.floor(Math.random() * Math.min(queriesCount, 4));
      
      const existingTendril = tendrils.find(
        t => t.chunkIndex === chunkIndex && t.queryIndex === queryIndex
      );
      
      if (!existingTendril) {
        setTendrils(prev => [...prev, {
          id: tick,
          chunkIndex,
          queryIndex,
          strength: 0.3,
          isProbing: true,
        }]);
        
        // Transition probing to stable after a moment
        setTimeout(() => {
          setTendrils(prev => prev.map(t => 
            t.id === tick 
              ? { ...t, isProbing: false, strength: 0.4 + Math.random() * 0.5 }
              : t
          ));
        }, 800);
      }
    }
  }, [tick, isLoading, tendrils, chunksCount, queriesCount]);

  // Reset on stop
  useEffect(() => {
    if (!isLoading) {
      setTendrils([]);
      setTick(0);
    }
  }, [isLoading]);

  // Calculate blob positions
  const leftX = 25;
  const rightX = 175;
  const centerY = 50;
  
  const chunkBlobs = useMemo(() => {
    const count = Math.min(chunksCount, 5);
    return Array.from({ length: count }).map((_, i) => ({
      cx: leftX + (i % 2) * 12,
      cy: centerY - 15 + (i * 12),
      r: 10 - (i % 3),
      variant: 'primary' as const,
      delay: i * 50,
    }));
  }, [chunksCount]);

  const queryBlobs = useMemo(() => {
    const count = Math.min(queriesCount, 4);
    return Array.from({ length: count }).map((_, i) => ({
      cx: rightX - (i % 2) * 10,
      cy: centerY - 10 + (i * 15),
      r: 9 - (i % 2),
      variant: 'accent' as const,
      delay: i * 50,
    }));
  }, [queriesCount]);

  if (!isLoading) return null;

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4">
      <GooFilterDefs />
      
      <svg 
        viewBox="0 0 200 100" 
        className="w-full max-w-[320px] h-auto"
        style={{ minHeight: 120 }}
      >
        {/* Labels */}
        <text x="25" y="12" className="fill-muted-foreground text-[8px]" textAnchor="middle">
          CHUNKS
        </text>
        <text x="175" y="12" className="fill-muted-foreground text-[8px]" textAnchor="middle">
          QUERIES
        </text>
        
        {/* Probing tendrils */}
        {tendrils.map((tendril, i) => {
          const startBlob = chunkBlobs[tendril.chunkIndex] || chunkBlobs[0];
          const endBlob = queryBlobs[tendril.queryIndex] || queryBlobs[0];
          
          return (
            <SlimeTendril
              key={tendril.id}
              startX={startBlob.cx + 10}
              startY={startBlob.cy}
              endX={endBlob.cx - 10}
              endY={endBlob.cy}
              baseThickness={5}
              isProbing={tendril.isProbing}
              strength={tendril.strength}
              delay={i * 100}
            />
          );
        })}
        
        {/* Chunk blobs (left side) */}
        <SlimeBlobGroup blobs={chunkBlobs} filter="goo" />
        
        {/* Query blobs (right side) */}
        <SlimeBlobGroup blobs={queryBlobs} filter="goo" />
      </svg>
      
      {/* Progress bar */}
      <div className="w-full max-w-[280px] mt-4">
        <SlimeProgress
          value={progress}
          label="Computing similarity matrix..."
          showDrips
        />
      </div>
      
      {/* Connection count */}
      <p className="text-xs text-muted-foreground mt-2">
        {tendrils.filter(t => !t.isProbing).length} of {Math.min(chunksCount, 5) * Math.min(queriesCount, 4)} comparisons
      </p>
    </div>
  );
}
