import { cn } from '@/lib/utils';
import { GooFilterDefs } from './GooFilterDefs';

interface SlimeProgressProps {
  /** Progress value 0-100 */
  value: number;
  /** Height of the progress bar */
  height?: number;
  /** Show drips from edges */
  showDrips?: boolean;
  /** Label to show */
  label?: string;
  /** Additional class names */
  className?: string;
}

/**
 * A progress bar rendered as filling slime
 * Features liquid fill animation and wobbling top surface
 */
export function SlimeProgress({
  value,
  height = 12,
  showDrips = true,
  label,
  className,
}: SlimeProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const width = 200; // SVG viewport width
  const fillWidth = (width * clampedValue) / 100;
  
  // Generate wave points for top surface
  const wavePoints = [];
  const numPoints = 10;
  for (let i = 0; i <= numPoints; i++) {
    const x = (fillWidth * i) / numPoints;
    const waveOffset = Math.sin(i * 0.8 + Date.now() / 500) * 1.5;
    wavePoints.push(`${x},${2 + waveOffset}`);
  }
  
  // Build the fill path (liquid shape)
  const fillPath = `
    M 0,${height}
    L 0,4
    ${wavePoints.map((p, i) => (i === 0 ? `L ${p}` : `L ${p}`)).join(' ')}
    L ${fillWidth},${height}
    Z
  `;

  return (
    <div className={cn('relative', className)}>
      <GooFilterDefs />
      
      <svg
        viewBox={`0 0 ${width} ${height + 8}`}
        className="w-full"
        style={{ height: height + 8 }}
      >
        {/* Background track */}
        <rect
          x="0"
          y="2"
          width={width}
          height={height}
          rx={height / 2}
          className="fill-muted/50"
        />
        
        {/* Slime fill with goo filter */}
        <g filter="url(#goo-soft)">
          <path
            d={fillPath}
            className="fill-[hsl(var(--accent))] animate-slime-fill"
          />
          
          {/* Drips from edges */}
          {showDrips && clampedValue > 20 && (
            <>
              <circle
                cx={fillWidth * 0.3}
                cy={height + 4}
                r={2}
                className="fill-[hsl(var(--accent))] animate-slime-drip"
                style={{ animationDelay: '0ms' }}
              />
              {clampedValue > 50 && (
                <circle
                  cx={fillWidth * 0.6}
                  cy={height + 5}
                  r={1.5}
                  className="fill-[hsl(var(--accent))] animate-slime-drip"
                  style={{ animationDelay: '300ms' }}
                />
              )}
            </>
          )}
        </g>
        
        {/* Highlight on top */}
        <ellipse
          cx={fillWidth * 0.4}
          cy={5}
          rx={fillWidth * 0.2}
          ry={1.5}
          className="fill-white/15"
        />
      </svg>
      
      {/* Label */}
      {label && (
        <div className="flex items-center justify-between mt-1.5 text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium text-foreground">{Math.round(clampedValue)}%</span>
        </div>
      )}
    </div>
  );
}
