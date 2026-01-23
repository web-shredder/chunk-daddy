import { useState, useEffect, useMemo } from 'react';
import { GooFilterDefs } from './GooFilterDefs';
import { SlimeBlobGroup } from './SlimeBlob';
import { cn } from '@/lib/utils';

interface DeduplicationLoaderProps {
  isLoading: boolean;
  totalQueries?: number;
  mergedCount?: number;
}

/**
 * Deduplication Loader
 * 
 * Multiple separate blobs slowly merge into fewer, larger blobs.
 * The goo filter makes this look like droplets of mercury combining.
 */
export function DeduplicationLoader({
  isLoading,
  totalQueries = 10,
  mergedCount = 0,
}: DeduplicationLoaderProps) {
  const [tick, setTick] = useState(0);
  const [blobPositions, setBlobPositions] = useState<Array<{
    id: number;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    size: number;
    merged: boolean;
    mergeTarget: number | null;
  }>>([]);

  // Initialize blobs
  useEffect(() => {
    if (!isLoading) {
      setBlobPositions([]);
      return;
    }
    
    const count = Math.min(totalQueries, 12);
    const blobs = Array.from({ length: count }).map((_, i) => {
      const row = Math.floor(i / 6);
      const col = i % 6;
      return {
        id: i,
        x: 25 + col * 28 + (row % 2) * 14,
        y: 20 + row * 25,
        targetX: 25 + col * 28 + (row % 2) * 14,
        targetY: 20 + row * 25,
        size: 8 + Math.random() * 3,
        merged: false,
        mergeTarget: null,
      };
    });
    
    setBlobPositions(blobs);
  }, [isLoading, totalQueries]);

  // Animation tick
  useEffect(() => {
    if (!isLoading) return;
    
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 500);
    
    return () => clearInterval(interval);
  }, [isLoading]);

  // Merge blobs over time
  useEffect(() => {
    if (!isLoading || tick === 0) return;
    
    const unmergedBlobs = blobPositions.filter(b => !b.merged);
    if (unmergedBlobs.length <= 4) return;
    
    // Pick two random unmerged blobs to merge
    const shuffled = [...unmergedBlobs].sort(() => Math.random() - 0.5);
    const [blob1, blob2] = shuffled.slice(0, 2);
    
    if (blob1 && blob2) {
      setBlobPositions(prev => prev.map(b => {
        if (b.id === blob2.id) {
          // This blob moves toward blob1 and merges
          return {
            ...b,
            targetX: blob1.x,
            targetY: blob1.y,
            mergeTarget: blob1.id,
          };
        }
        if (b.id === blob1.id) {
          // This blob grows slightly
          return { ...b, size: b.size + 1.5 };
        }
        return b;
      }));
      
      // Mark as merged after animation
      setTimeout(() => {
        setBlobPositions(prev => prev.map(b => 
          b.id === blob2.id ? { ...b, merged: true } : b
        ));
      }, 400);
    }
  }, [tick, isLoading]);

  // Calculate current blob data for rendering
  const visibleBlobs = useMemo(() => {
    return blobPositions
      .filter(b => !b.merged)
      .map(b => ({
        cx: b.mergeTarget !== null 
          ? b.targetX + (b.x - b.targetX) * 0.3 // Animate toward target
          : b.x,
        cy: b.mergeTarget !== null 
          ? b.targetY + (b.y - b.targetY) * 0.3
          : b.y,
        r: b.size,
        variant: 'primary' as const,
        delay: b.id * 30,
      }));
  }, [blobPositions]);

  const currentMerged = blobPositions.filter(b => b.merged).length;

  if (!isLoading) return null;

  return (
    <div className="flex flex-col items-center justify-center py-4 px-4">
      <GooFilterDefs />
      
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
        <span>Before: {totalQueries}</span>
        <span className="text-foreground">→</span>
        <span>After: {Math.max(4, totalQueries - currentMerged - mergedCount)}</span>
      </div>
      
      <svg 
        viewBox="0 0 200 70" 
        className="w-full max-w-[260px] h-auto"
        style={{ minHeight: 80 }}
      >
        {/* Blobs with goo filter - they merge visually when close */}
        <SlimeBlobGroup blobs={visibleBlobs} filter="goo" />
      </svg>
      
      <p className="text-xs text-muted-foreground mt-2">
        {currentMerged + mergedCount > 0 
          ? `${currentMerged + mergedCount} duplicates merged`
          : 'Finding duplicates...'
        }
      </p>
    </div>
  );
}
