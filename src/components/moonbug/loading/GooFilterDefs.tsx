/**
 * SVG Goo Filter Definitions
 * 
 * The goo filter creates liquid merge effects when blobs get close.
 * Apply filter="url(#goo)" to groups of circles/ellipses.
 */
export function GooFilterDefs() {
  return (
    <svg 
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      aria-hidden="true"
    >
      <defs>
        {/* Standard goo filter - merges shapes when close */}
        <filter id="goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
          <feColorMatrix 
            in="blur" 
            mode="matrix" 
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -10" 
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
        
        {/* Softer goo for smaller blobs */}
        <filter id="goo-soft">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix 
            in="blur" 
            mode="matrix" 
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" 
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
        
        {/* Subtle glow effect for accent blobs */}
        <filter id="slime-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
          <feFlood floodColor="hsl(72 100% 55%)" floodOpacity="0.3" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}
