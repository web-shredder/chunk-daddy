import { cn } from '@/lib/utils';

interface SlimeConnectionProps {
  /** Start point */
  x1: number;
  y1: number;
  /** End point */
  x2: number;
  y2: number;
  /** Connection thickness (1-10) */
  thickness?: number;
  /** Animation state */
  state?: 'forming' | 'stable' | 'thinning' | 'snapping';
  /** Delay for staggered animations */
  delay?: number;
  /** Color variant */
  variant?: 'primary' | 'muted';
  /** Opacity */
  opacity?: number;
}

/**
 * A stretched slime connection between two points
 * Creates organic bezier curves with varying stroke width
 */
export function SlimeConnection({
  x1,
  y1,
  x2,
  y2,
  thickness = 4,
  state = 'stable',
  delay = 0,
  variant = 'primary',
  opacity = 1,
}: SlimeConnectionProps) {
  // Calculate midpoint and control points for bezier
  const dx = x2 - x1;
  const dy = y2 - y1;
  const midX = x1 + dx / 2;
  const midY = y1 + dy / 2;
  
  // Add some sag/droop to the connection
  const sagAmount = Math.abs(dx) * 0.15;
  const controlY = midY + sagAmount;
  
  // Build the bezier path
  const path = `M ${x1} ${y1} Q ${midX} ${controlY} ${x2} ${y2}`;
  
  // State-based thickness modifiers
  const thicknessMultiplier = {
    forming: 0.3,
    stable: 1,
    thinning: 0.4,
    snapping: 0.1,
  }[state];
  
  const strokeWidth = thickness * thicknessMultiplier;
  
  // State-based animations
  const stateClass = {
    forming: 'animate-slime-stretch',
    stable: '',
    thinning: 'animate-slime-thin',
    snapping: 'animate-slime-snap',
  }[state];
  
  const colorClass = variant === 'primary' 
    ? 'stroke-[hsl(var(--accent))]' 
    : 'stroke-[hsl(var(--muted-foreground)/0.4)]';

  return (
    <path
      d={path}
      fill="none"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      className={cn(colorClass, stateClass)}
      style={{
        opacity,
        animationDelay: `${delay}ms`,
      }}
    />
  );
}

/**
 * A dripping tendril from a source blob
 */
interface SlimeTendrilProps {
  /** Start point (source blob center) */
  startX: number;
  startY: number;
  /** End point (target) */
  endX: number;
  endY: number;
  /** Tendril thickness at base */
  baseThickness?: number;
  /** Whether this tendril is actively probing */
  isProbing?: boolean;
  /** Strength of connection (affects thickness) */
  strength?: number;
  /** Animation delay */
  delay?: number;
}

export function SlimeTendril({
  startX,
  startY,
  endX,
  endY,
  baseThickness = 6,
  isProbing = false,
  strength = 0.5,
  delay = 0,
}: SlimeTendrilProps) {
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Control points for organic curve
  const ctrl1X = startX + dx * 0.3;
  const ctrl1Y = startY + dy * 0.1 + (isProbing ? Math.sin(Date.now() / 200) * 5 : 0);
  const ctrl2X = startX + dx * 0.7;
  const ctrl2Y = endY - dy * 0.2;
  
  // Tapered path from thick to thin
  const path = `M ${startX} ${startY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${endX} ${endY}`;
  
  // Thickness tapers based on distance and strength
  const strokeWidth = baseThickness * strength * Math.max(0.2, 1 - distance / 300);

  return (
    <path
      d={path}
      fill="none"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      className={cn(
        'stroke-[hsl(var(--accent))]',
        isProbing && 'animate-slime-probe'
      )}
      style={{
        opacity: 0.6 + strength * 0.4,
        animationDelay: `${delay}ms`,
      }}
    />
  );
}
