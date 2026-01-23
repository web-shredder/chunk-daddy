import { useState, useEffect, useMemo } from 'react';
import { GooFilterDefs } from './GooFilterDefs';
import { SlimeBlobGroup } from './SlimeBlob';
import { SlimeConnection } from './SlimeConnection';
import { cn } from '@/lib/utils';

interface ContentAnalysisLoaderProps {
  isLoading: boolean;
  contentLength?: number;
}

const STATUS_MESSAGES = [
  'Reading structure...',
  'Identifying entities...',
  'Mapping relationships...',
  'Extracting concepts...',
];

/**
 * Content Analysis Loader
 * 
 * A large source blob (the content) with smaller concept blobs 
 * extracting/budding off from it.
 */
export function ContentAnalysisLoader({ 
  isLoading, 
  contentLength = 1000 
}: ContentAnalysisLoaderProps) {
  const [tick, setTick] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [conceptBlobs, setConceptBlobs] = useState<Array<{
    id: number;
    angle: number;
    distance: number;
    size: number;
    connected: boolean;
  }>>([]);

  // Animate tick for blob spawning
  useEffect(() => {
    if (!isLoading) return;
    
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 600);
    
    return () => clearInterval(interval);
  }, [isLoading]);

  // Rotate status messages
  useEffect(() => {
    if (!isLoading) return;
    
    const interval = setInterval(() => {
      setStatusIndex(i => (i + 1) % STATUS_MESSAGES.length);
    }, 2500);
    
    return () => clearInterval(interval);
  }, [isLoading]);

  // Spawn new concept blobs on tick
  useEffect(() => {
    if (!isLoading || tick === 0) return;
    
    if (conceptBlobs.length < 8) {
      const angle = (conceptBlobs.length * 45 + Math.random() * 20) * (Math.PI / 180);
      setConceptBlobs(prev => [...prev, {
        id: tick,
        angle,
        distance: 35 + Math.random() * 25,
        size: 8 + Math.random() * 6,
        connected: Math.random() > 0.3,
      }]);
    }
  }, [tick, isLoading]);

  // Reset on stop
  useEffect(() => {
    if (!isLoading) {
      setConceptBlobs([]);
      setTick(0);
    }
  }, [isLoading]);

  // Calculate blob positions
  const centerX = 100;
  const centerY = 60;
  const centerRadius = 25 + Math.min(contentLength / 5000, 15);

  const blobData = useMemo(() => {
    return [
      // Central content blob
      { cx: centerX, cy: centerY, r: centerRadius, variant: 'primary' as const, delay: 0 },
      // Concept blobs orbiting
      ...conceptBlobs.map((concept, i) => ({
        cx: centerX + Math.cos(concept.angle) * concept.distance,
        cy: centerY + Math.sin(concept.angle) * concept.distance,
        r: concept.size,
        variant: 'accent' as const,
        delay: i * 100,
        animationState: 'idle' as const,
      })),
    ];
  }, [conceptBlobs, centerRadius]);

  if (!isLoading) return null;

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <GooFilterDefs />
      
      <svg 
        viewBox="0 0 200 130" 
        className="w-full max-w-[280px] h-auto"
        style={{ minHeight: 140 }}
      >
        {/* Connections from center to concept blobs */}
        {conceptBlobs.filter(c => c.connected).map((concept, i) => {
          const targetX = centerX + Math.cos(concept.angle) * concept.distance;
          const targetY = centerY + Math.sin(concept.angle) * concept.distance;
          return (
            <SlimeConnection
              key={concept.id}
              x1={centerX}
              y1={centerY}
              x2={targetX}
              y2={targetY}
              thickness={3}
              state="stable"
              delay={i * 150}
              opacity={0.7}
            />
          );
        })}
        
        {/* All blobs with goo filter */}
        <SlimeBlobGroup blobs={blobData} filter="goo" />
      </svg>
      
      <p className="text-sm text-muted-foreground mt-4 animate-pulse">
        {STATUS_MESSAGES[statusIndex]}
      </p>
    </div>
  );
}
