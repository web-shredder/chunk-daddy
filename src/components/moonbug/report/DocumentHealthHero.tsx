import { useMemo, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getTierFromScore, TIER_COLORS, getTierDefinition } from '@/lib/tier-colors';
import type { ChunkDiagnostics } from '@/hooks/useAnalysis';

interface DocumentHealthHeroProps {
  diagnostics: ChunkDiagnostics[];
  className?: string;
}

// Smooth count-up animation hook
function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  
  useEffect(() => {
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    let step = 0;
    
    const timer = setInterval(() => {
      step++;
      // Ease-out curve
      const progress = 1 - Math.pow(1 - step / steps, 3);
      current = Math.round(target * progress);
      
      if (step >= steps) {
        setValue(target);
        clearInterval(timer);
      } else {
        setValue(current);
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [target, duration]);
  
  return value;
}

export function DocumentHealthHero({ diagnostics, className }: DocumentHealthHeroProps) {
  const metrics = useMemo(() => {
    if (!diagnostics || diagnostics.length === 0) {
      return { healthScore: 0, avgRetrieval: 0, avgRerank: 0, avgCitation: 0 };
    }
    
    let totalRetrieval = 0;
    let totalRerank = 0;
    let totalCitation = 0;
    
    diagnostics.forEach(d => {
      totalRetrieval += d.scores.hybridRetrieval;
      totalRerank += d.scores.rerank.score;
      totalCitation += d.scores.citation.score;
    });
    
    const count = diagnostics.length;
    const avgRetrieval = Math.round(totalRetrieval / count);
    const avgRerank = Math.round(totalRerank / count);
    const avgCitation = Math.round(totalCitation / count);
    
    // Weighted health score
    const healthScore = Math.round(
      (avgRetrieval * 0.4) + (avgRerank * 0.35) + (avgCitation * 0.25)
    );
    
    return { healthScore, avgRetrieval, avgRerank, avgCitation };
  }, [diagnostics]);

  const animatedScore = useCountUp(metrics.healthScore);
  const tier = getTierFromScore(metrics.healthScore);
  const tierDef = getTierDefinition(metrics.healthScore);
  const tierColors = TIER_COLORS[tier];

  // Health status messaging
  const getHealthStatus = (score: number) => {
    if (score >= 90) return { label: 'Excellent', subtitle: 'Highly optimized for search' };
    if (score >= 75) return { label: 'Healthy', subtitle: 'Competitive in search results' };
    if (score >= 60) return { label: 'Moderate', subtitle: 'Needs targeted optimization' };
    if (score >= 40) return { label: 'Needs Work', subtitle: 'Significant gaps to address' };
    return { label: 'Critical', subtitle: 'Major optimization required' };
  };

  const status = getHealthStatus(metrics.healthScore);

  // SVG radial gauge parameters
  const size = 180;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (metrics.healthScore / 100) * circumference;
  const offset = circumference - progress;

  // Gradient colors based on tier
  const getGradientColors = (tier: string) => {
    switch (tier) {
      case 'excellent': return ['#22c55e', '#10b981'];
      case 'good': return ['#4ade80', '#22c55e'];
      case 'moderate': return ['#eab308', '#f59e0b'];
      case 'weak': return ['#f97316', '#ef4444'];
      case 'poor': return ['#ef4444', '#dc2626'];
      default: return ['#6b7280', '#4b5563'];
    }
  };
  const gradientColors = getGradientColors(tier);

  return (
    <Card className={cn(
      "relative overflow-hidden border-border/50",
      "bg-gradient-to-br from-surface via-surface to-muted/20",
      className
    )}>
      {/* Subtle glow effect */}
      <div 
        className={cn(
          "absolute inset-0 opacity-[0.03]",
          tier === 'excellent' && "bg-gradient-to-br from-green-500 to-emerald-500",
          tier === 'good' && "bg-gradient-to-br from-green-400 to-green-500",
          tier === 'moderate' && "bg-gradient-to-br from-yellow-500 to-amber-500",
          tier === 'weak' && "bg-gradient-to-br from-orange-500 to-red-500",
          tier === 'poor' && "bg-gradient-to-br from-red-500 to-red-600",
        )}
      />
      
      <CardContent className="pt-6 pb-6 relative">
        <div className="flex flex-col lg:flex-row items-center gap-8">
          {/* Radial Gauge */}
          <div className="relative flex-shrink-0">
            <svg width={size} height={size} className="transform -rotate-90">
              <defs>
                <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={gradientColors[0]} />
                  <stop offset="100%" stopColor={gradientColors[1]} />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* Background ring */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={strokeWidth}
                className="opacity-30"
              />
              
              {/* Progress ring */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="url(#healthGradient)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                filter="url(#glow)"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span 
                className={cn(
                  "text-4xl font-bold tabular-nums tracking-tight",
                  tierColors.text
                )}
              >
                {animatedScore}
              </span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground mt-0.5">
                Score
              </span>
            </div>
          </div>

          {/* Health Info */}
          <div className="flex-1 text-center lg:text-left">
            <div className="mb-4">
              <h3 className="text-sm uppercase tracking-widest text-muted-foreground mb-1">
                Document Health
              </h3>
              <p className={cn("text-2xl font-semibold", tierColors.text)}>
                {status.label}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {status.subtitle}
              </p>
            </div>
            
            {/* Stage Score Breakdown - Mini Version */}
            <div className="grid grid-cols-3 gap-3">
              <StageScoreMini
                label="Retrieval"
                score={metrics.avgRetrieval}
              />
              <StageScoreMini
                label="Rerank"
                score={metrics.avgRerank}
              />
              <StageScoreMini
                label="Citation"
                score={metrics.avgCitation}
              />
            </div>
          </div>

          {/* Stats Summary */}
          <div className="flex-shrink-0 hidden xl:block">
            <div className="grid grid-cols-1 gap-2 text-right">
              <div className="px-4 py-2 rounded-lg bg-muted/30">
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {diagnostics.length}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  chunk-query pairs
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Tier: <span className={tierColors.text}>{tierDef.label}</span>
                <span className="ml-1 opacity-60">({tierDef.minScore}-{tierDef.maxScore})</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StageScoreMini({ label, score }: { label: string; score: number }) {
  const tier = getTierFromScore(score);
  const tierColors = TIER_COLORS[tier];
  const percentage = Math.min(100, Math.max(0, score));
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium tabular-nums", tierColors.text)}>{score}</span>
      </div>
      <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            tierColors.bg
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
