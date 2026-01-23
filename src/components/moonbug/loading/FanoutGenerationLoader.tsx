import { useState, useEffect, useMemo } from 'react';
import { GooFilterDefs } from './GooFilterDefs';
import { SlimeBlobGroup } from './SlimeBlob';
import { SlimeConnection } from './SlimeConnection';
import { cn } from '@/lib/utils';

interface FanoutGenerationLoaderProps {
  isLoading: boolean;
  primaryQuery?: string;
  currentDepth?: number;
  totalGenerated?: number;
}

/**
 * Fanout Generation Loader
 * 
 * The slime IS the tree. Primary query is a blob at top.
 * Child queries bud off and stretch downward, creating a dripping tree structure.
 */
export function FanoutGenerationLoader({
  isLoading,
  primaryQuery = 'Query',
  currentDepth = 1,
  totalGenerated = 0,
}: FanoutGenerationLoaderProps) {
  const [tick, setTick] = useState(0);
  const [treeNodes, setTreeNodes] = useState<Array<{
    id: number;
    level: number;
    x: number;
    y: number;
    parentX: number;
    parentY: number;
    size: number;
    state: 'forming' | 'stable' | 'dripping';
  }>>([]);

  // Animation tick
  useEffect(() => {
    if (!isLoading) return;
    
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 400);
    
    return () => clearInterval(interval);
  }, [isLoading]);

  // Grow tree based on tick
  useEffect(() => {
    if (!isLoading) return;
    
    if (treeNodes.length < 12) {
      const level = Math.min(Math.floor(treeNodes.length / 4) + 1, 3);
      const positionInLevel = treeNodes.filter(n => n.level === level).length;
      const nodesInLevel = level === 1 ? 4 : level === 2 ? 5 : 3;
      
      if (positionInLevel < nodesInLevel) {
        const spreadWidth = 160;
        const levelY = 25 + level * 35;
        const startX = 100 - (spreadWidth / 2) + (spreadWidth / (nodesInLevel + 1)) * (positionInLevel + 1);
        
        // Find parent node
        const parentLevel = level - 1;
        const parentNodes = treeNodes.filter(n => n.level === parentLevel);
        const parentNode = parentNodes[Math.floor(positionInLevel * parentNodes.length / nodesInLevel)] || { x: 100, y: 20 };
        
        setTreeNodes(prev => [...prev, {
          id: tick,
          level,
          x: startX + (Math.random() - 0.5) * 10,
          y: levelY + (Math.random() - 0.5) * 5,
          parentX: parentNode.x || 100,
          parentY: parentNode.y || 20,
          size: 10 - level * 1.5,
          state: 'forming',
        }]);
        
        // Transition to stable after a moment
        setTimeout(() => {
          setTreeNodes(prev => prev.map(n => 
            n.id === tick ? { ...n, state: 'stable' } : n
          ));
        }, 600);
      }
    }
  }, [tick, isLoading, treeNodes.length]);

  // Reset on stop
  useEffect(() => {
    if (!isLoading) {
      setTreeNodes([]);
      setTick(0);
    }
  }, [isLoading]);

  // Build blob data
  const blobData = useMemo(() => {
    return [
      // Root blob (primary query)
      { cx: 100, cy: 20, r: 14, variant: 'primary' as const, delay: 0 },
      // Tree nodes
      ...treeNodes.map((node, i) => ({
        cx: node.x,
        cy: node.y,
        r: node.size,
        variant: node.level === 1 ? 'primary' as const : 'accent' as const,
        delay: i * 80,
        opacity: node.state === 'forming' ? 0.6 : 1,
      })),
    ];
  }, [treeNodes]);

  // Level progress indicators
  const levelProgress = [
    treeNodes.filter(n => n.level === 1).length,
    treeNodes.filter(n => n.level === 2).length,
    treeNodes.filter(n => n.level === 3).length,
  ];

  if (!isLoading) return null;

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4">
      <GooFilterDefs />
      
      <svg 
        viewBox="0 0 200 140" 
        className="w-full max-w-[300px] h-auto"
        style={{ minHeight: 150 }}
      >
        {/* Connections from parents to children */}
        {treeNodes.map((node, i) => (
          <SlimeConnection
            key={node.id}
            x1={node.parentX}
            y1={node.parentY}
            x2={node.x}
            y2={node.y}
            thickness={4 - node.level * 0.8}
            state={node.state === 'forming' ? 'forming' : 'stable'}
            delay={i * 100}
            opacity={0.8}
          />
        ))}
        
        {/* All blobs with goo filter */}
        <SlimeBlobGroup blobs={blobData} filter="goo" />
        
        {/* Occasional drip animation */}
        {treeNodes.length > 5 && (
          <circle
            cx={treeNodes[4]?.x || 100}
            cy={140}
            r={3}
            className="fill-[hsl(var(--accent)/0.5)] animate-slime-drip"
          />
        )}
      </svg>
      
      {/* Level indicators */}
      <div className="flex items-center gap-3 mt-4">
        {[1, 2, 3].map(level => (
          <div key={level} className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">L{level}:</span>
            <div className="flex gap-0.5">
              {Array.from({ length: level === 1 ? 4 : level === 2 ? 5 : 3 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    i < levelProgress[level - 1] 
                      ? "bg-[hsl(var(--accent))]" 
                      : "bg-muted"
                  )}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground mt-2">
        Generating depth {currentDepth} variants...
      </p>
    </div>
  );
}
