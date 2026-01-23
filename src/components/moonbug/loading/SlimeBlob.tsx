import { cn } from '@/lib/utils';

interface SlimeBlobProps {
  cx: number;
  cy: number;
  r: number;
  /** Delay for staggered animations */
  delay?: number;
  /** Whether to show pulsing animation */
  pulse?: boolean;
  /** Whether to show wobble animation */
  wobble?: boolean;
  /** Whether to show highlight/shine */
  highlight?: boolean;
  /** Color variant */
  variant?: 'primary' | 'muted' | 'accent';
  /** Opacity override */
  opacity?: number;
  /** Additional class names */
  className?: string;
  /** Animation state */
  animationState?: 'idle' | 'forming' | 'falling' | 'merging';
}

/**
 * A single animated slime blob with organic wobble
 */
export function SlimeBlob({
  cx,
  cy,
  r,
  delay = 0,
  pulse = false,
  wobble = true,
  highlight = false,
  variant = 'primary',
  opacity = 1,
  className,
  animationState = 'idle',
}: SlimeBlobProps) {
  const variantColors = {
    primary: 'fill-[hsl(var(--accent))]',
    muted: 'fill-[hsl(var(--muted-foreground)/0.3)]',
    accent: 'fill-[hsl(var(--tier-excellent))]',
  };

  const baseColor = variantColors[variant];
  
  // Calculate wobble offset for organic movement
  const wobbleClass = wobble ? 'animate-slime-wobble' : '';
  const pulseClass = pulse ? 'animate-slime-pulse' : '';
  const formingClass = animationState === 'forming' ? 'animate-slime-form' : '';
  const fallingClass = animationState === 'falling' ? 'animate-slime-fall' : '';

  return (
    <g style={{ animationDelay: `${delay}ms` }}>
      {/* Main blob */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={r * 1.05}
        ry={r * 0.95}
        className={cn(
          baseColor,
          wobbleClass,
          pulseClass,
          formingClass,
          fallingClass,
          className
        )}
        style={{ 
          opacity,
          animationDelay: `${delay}ms`,
          transformOrigin: `${cx}px ${cy}px`,
        }}
      />
      
      {/* Highlight spot for 3D effect */}
      {highlight && (
        <ellipse
          cx={cx - r * 0.3}
          cy={cy - r * 0.3}
          rx={r * 0.25}
          ry={r * 0.15}
          className="fill-white/20"
          style={{ animationDelay: `${delay}ms` }}
        />
      )}
    </g>
  );
}

/**
 * A group of blobs that merge together via goo filter
 */
interface SlimeBlobGroupProps {
  blobs: Array<{
    cx: number;
    cy: number;
    r: number;
    delay?: number;
    variant?: 'primary' | 'muted' | 'accent';
    opacity?: number;
    animationState?: 'idle' | 'forming' | 'falling' | 'merging';
  }>;
  filter?: 'goo' | 'goo-soft' | 'none';
  className?: string;
}

export function SlimeBlobGroup({ blobs, filter = 'goo', className }: SlimeBlobGroupProps) {
  return (
    <g 
      filter={filter !== 'none' ? `url(#${filter})` : undefined}
      className={className}
    >
      {blobs.map((blob, i) => (
        <SlimeBlob
          key={i}
          cx={blob.cx}
          cy={blob.cy}
          r={blob.r}
          delay={blob.delay || i * 100}
          variant={blob.variant}
          opacity={blob.opacity}
          animationState={blob.animationState}
          wobble
          highlight={blob.r > 15}
        />
      ))}
    </g>
  );
}
