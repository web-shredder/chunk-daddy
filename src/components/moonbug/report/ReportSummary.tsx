import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getTierFromScore, TIER_COLORS, TIER_DEFINITIONS, type ScoreTier, type TierDefinition } from '@/lib/tier-colors';
import { cn } from '@/lib/utils';
import type { FullOptimizationResult, ContentBrief } from '@/lib/optimizer-types';

interface ReportSummaryProps {
  optimizationResult: FullOptimizationResult;
}

export function ReportSummary({ optimizationResult }: ReportSummaryProps) {
  const metrics = useMemo(() => {
    const chunks = optimizationResult.optimizedChunks || [];
    const originalScores = optimizationResult.originalFullScores || {};
    const optimizedScores = optimizationResult.optimizedFullScores || {};
    
    let totalOriginal = 0;
    let totalOptimized = 0;
    let improved = 0;
    let declined = 0;
    let scoreCount = 0;
    
    const tierCountsBefore: Record<ScoreTier, number> = { excellent: 0, good: 0, moderate: 0, weak: 0, poor: 0 };
    const tierCountsAfter: Record<ScoreTier, number> = { excellent: 0, good: 0, moderate: 0, weak: 0, poor: 0 };
    
    chunks.forEach((_, index) => {
      // Calculate average passage score across all queries for this chunk
      const origScoresForChunk = originalScores[index] || {};
      const optScoresForChunk = optimizedScores[index] || {};
      
      let chunkOrigTotal = 0;
      let chunkOptTotal = 0;
      let queryCount = 0;
      
      Object.keys(optScoresForChunk).forEach(query => {
        const origScore = origScoresForChunk[query]?.passageScore ?? 0;
        const optScore = optScoresForChunk[query]?.passageScore ?? 0;
        chunkOrigTotal += origScore;
        chunkOptTotal += optScore;
        queryCount++;
      });
      
      if (queryCount > 0) {
        const avgOrig = chunkOrigTotal / queryCount;
        const avgOpt = chunkOptTotal / queryCount;
        
        totalOriginal += avgOrig;
        totalOptimized += avgOpt;
        scoreCount++;
        
        if (avgOpt > avgOrig + 1) improved++;
        if (avgOpt < avgOrig - 1) declined++;
        
        tierCountsBefore[getTierFromScore(avgOrig)]++;
        tierCountsAfter[getTierFromScore(avgOpt)]++;
      }
    });
    
    const avgBefore = scoreCount > 0 ? Math.round(totalOriginal / scoreCount) : 0;
    const avgAfter = scoreCount > 0 ? Math.round(totalOptimized / scoreCount) : 0;
    const briefsCount = optimizationResult.contentBriefs?.length || 0;
    
    return {
      avgBefore,
      avgAfter,
      change: avgAfter - avgBefore,
      improved,
      declined,
      total: chunks.length,
      tierCountsBefore,
      tierCountsAfter,
      briefsCount,
      contentBriefs: optimizationResult.contentBriefs || [],
    };
  }, [optimizationResult]);

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Average Score"
          value={`${metrics.avgBefore} → ${metrics.avgAfter}`}
          subValue={`${metrics.change >= 0 ? '+' : ''}${metrics.change} pts`}
          changeType={metrics.change >= 0 ? 'positive' : 'negative'}
        />
        <MetricCard
          label="Chunks Improved"
          value={String(metrics.improved)}
          subValue={`of ${metrics.total} chunks`}
          changeType="positive"
        />
        <MetricCard
          label="Chunks Declined"
          value={String(metrics.declined)}
          subValue={metrics.declined > 0 ? 'Needs review' : 'None'}
          changeType={metrics.declined > 0 ? 'negative' : 'positive'}
        />
        <MetricCard
          label="Briefs Generated"
          value={String(metrics.briefsCount)}
          subValue={metrics.briefsCount > 0 ? 'New content needed' : 'Full coverage'}
          changeType="neutral"
        />
      </div>

      {/* Tier Distribution */}
      <Card className="bg-surface border-border">
        <CardContent className="pt-6">
          <h4 className="text-sm font-medium text-foreground mb-4">Score Distribution by Tier</h4>
          <div className="space-y-3">
            {TIER_DEFINITIONS.map((tier) => {
              const before = metrics.tierCountsBefore[tier.name];
              const after = metrics.tierCountsAfter[tier.name];
              const change = after - before;
              // For good tiers (excellent/good), increase is good; for bad tiers (weak/poor), decrease is good
              const isGoodChange = 
                (tier.name === 'excellent' || tier.name === 'good') ? change > 0 :
                (tier.name === 'weak' || tier.name === 'poor') ? change < 0 : false;
              
              return (
                <TierRow
                  key={tier.name}
                  tier={tier}
                  before={before}
                  after={after}
                  change={change}
                  total={metrics.total}
                  isGoodChange={isGoodChange}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-4 px-2">
            <span>BEFORE</span>
            <span>AFTER</span>
          </div>
        </CardContent>
      </Card>

      {/* Content Briefs Section */}
      {metrics.briefsCount > 0 && (
        <Card className="bg-[hsl(var(--accent-muted))] border-primary/20">
          <CardContent className="pt-6">
            <h4 className="text-sm font-medium text-foreground mb-2">Content Briefs Generated</h4>
            <p className="text-xs text-muted-foreground mb-4">
              {metrics.briefsCount} queries had no matching content. Briefs were generated:
            </p>
            <div className="space-y-2">
              {metrics.contentBriefs.map((brief: ContentBrief, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-surface/50 rounded-md"
                >
                  <span className="text-sm text-foreground">"{brief.targetQuery}"</span>
                  <span className="text-xs text-muted-foreground">
                    ~{brief.targetWordCount.min}-{brief.targetWordCount.max} words
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ 
  label, 
  value, 
  subValue, 
  changeType 
}: { 
  label: string; 
  value: string; 
  subValue: string; 
  changeType: 'positive' | 'negative' | 'neutral';
}) {
  return (
    <Card className="bg-surface border-border">
      <CardContent className="pt-4 pb-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p
          className={cn(
            'text-xs mt-1',
            changeType === 'positive' && 'text-[hsl(var(--success))]',
            changeType === 'negative' && 'text-[hsl(var(--destructive))]',
            changeType === 'neutral' && 'text-muted-foreground'
          )}
        >
          {subValue}
        </p>
      </CardContent>
    </Card>
  );
}

function TierRow({
  tier,
  before,
  after,
  change,
  total,
  isGoodChange,
}: {
  tier: TierDefinition;
  before: number;
  after: number;
  change: number;
  total: number;
  isGoodChange: boolean;
}) {
  const maxWidth = 100; // percentage
  const beforeWidth = total > 0 ? (before / total) * maxWidth : 0;
  const afterWidth = total > 0 ? (after / total) * maxWidth : 0;
  const colors = TIER_COLORS[tier.name];
  
  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Label */}
      <div className="w-28 shrink-0">
        <span className={colors.text}>{tier.label}</span>
        <span className="text-muted-foreground ml-1">({tier.minScore}-{tier.maxScore})</span>
      </div>
      
      {/* Before bar */}
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden">
          <div
            className={cn('h-full rounded', colors.bg)}
            style={{ width: `${beforeWidth}%` }}
          />
        </div>
        <span className="w-4 text-right text-muted-foreground">{before}</span>
      </div>
      
      <span className="text-muted-foreground">→</span>
      
      {/* After bar */}
      <div className="flex-1 flex items-center gap-2">
        <span className="w-4 text-muted-foreground">{after}</span>
        <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden">
          <div
            className={cn('h-full rounded', colors.bg)}
            style={{ width: `${afterWidth}%` }}
          />
        </div>
      </div>
      
      {/* Change indicator */}
      <span
        className={cn(
          'w-8 text-right font-medium',
          change === 0 && 'text-muted-foreground',
          change !== 0 && isGoodChange && 'text-[hsl(var(--success))]',
          change !== 0 && !isGoodChange && 'text-[hsl(var(--destructive))]'
        )}
      >
        {change > 0 ? `+${change}` : change}
      </span>
    </div>
  );
}
