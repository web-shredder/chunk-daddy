import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Lightbulb, AlertTriangle, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import type { OptimizationSummary as OptimizationSummaryType } from '@/lib/optimizer-types';
import { cn } from '@/lib/utils';

interface OptimizationSummaryProps {
  summary: OptimizationSummaryType;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatScore(value: number): string {
  return value.toFixed(4);
}

function getChangeIcon(percentChange: number) {
  if (percentChange > 1) return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (percentChange < -1) return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function getChangeColor(percentChange: number): string {
  if (percentChange > 5) return 'text-green-600';
  if (percentChange > 0) return 'text-green-500';
  if (percentChange < -5) return 'text-red-600';
  if (percentChange < 0) return 'text-red-500';
  return 'text-muted-foreground';
}

function getImpactBadgeVariant(impact: 'high' | 'medium' | 'low' | 'unlikely'): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (impact) {
    case 'high': return 'default';
    case 'medium': return 'secondary';
    case 'low': return 'outline';
    case 'unlikely': return 'destructive';
  }
}

function getSeverityColor(severity: 'minor' | 'moderate' | 'significant'): string {
  switch (severity) {
    case 'minor': return 'text-yellow-600';
    case 'moderate': return 'text-orange-500';
    case 'significant': return 'text-red-600';
  }
}

function getCategoryIcon(category: string) {
  return <AlertTriangle className="h-4 w-4" />;
}

export function OptimizationSummary({ summary }: OptimizationSummaryProps) {
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set([0]));
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showTradeOffs, setShowTradeOffs] = useState(true);

  const toggleChunk = (chunkNumber: number) => {
    setExpandedChunks(prev => {
      const next = new Set(prev);
      if (next.has(chunkNumber)) {
        next.delete(chunkNumber);
      } else {
        next.add(chunkNumber);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Overall Summary Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Overall Cosine Similarity Change
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-mono font-bold">{formatScore(summary.overallOriginalAvg)}</div>
              <div className="text-xs text-muted-foreground mt-1">Original (Avg)</div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold">{formatScore(summary.overallOptimizedAvg)}</div>
              <div className="text-xs text-muted-foreground mt-1">Optimized (Avg)</div>
            </div>
            <div>
              <div className={cn("text-2xl font-mono font-bold", getChangeColor(summary.overallPercentChange))}>
                {formatPercent(summary.overallPercentChange)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Change</div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            {summary.overallPercentChange > 0 
              ? `The optimized content has ${formatPercent(summary.overallPercentChange)} higher average cosine similarity with target queries, meaning it will rank closer in vector search results.`
              : summary.overallPercentChange < 0
              ? `The optimized content shows a ${formatPercent(Math.abs(summary.overallPercentChange))} decrease in cosine similarity. Review changes for potential issues.`
              : 'Cosine similarity remained stable after optimization.'}
          </p>
        </CardContent>
      </Card>

      {/* Per-Chunk Score Details */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          Score Comparison by Chunk
          <Badge variant="outline" className="font-normal">
            Original → Optimized
          </Badge>
        </h4>
        
        {summary.chunkScores.map((chunk) => (
          <Collapsible
            key={chunk.chunkNumber}
            open={expandedChunks.has(chunk.chunkNumber)}
            onOpenChange={() => toggleChunk(chunk.chunkNumber)}
          >
            <Card className="border-border/50">
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between px-4 py-3 h-auto hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      Chunk {chunk.chunkNumber + 1}
                      {chunk.heading && `: "${chunk.heading}"`}
                    </span>
                    <Badge 
                      variant={chunk.overallImprovement > 0 ? 'default' : chunk.overallImprovement < 0 ? 'destructive' : 'secondary'}
                      className="font-mono"
                    >
                      {formatPercent(chunk.overallImprovement)}
                    </Badge>
                  </div>
                  {expandedChunks.has(chunk.chunkNumber) 
                    ? <ChevronUp className="h-4 w-4" /> 
                    : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  {chunk.queryScores.map((qs, idx) => (
                    <div key={idx} className="border rounded-lg p-3 bg-muted/30">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-medium">Query: "{qs.query}"</span>
                        {getChangeIcon(qs.percentChange)}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                        <div>
                          <span className="text-muted-foreground">Original:</span>
                          <span className="font-mono ml-1">{formatScore(qs.originalCosine)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Optimized:</span>
                          <span className="font-mono ml-1">{formatScore(qs.optimizedCosine)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Change:</span>
                          <span className={cn("font-mono ml-1", getChangeColor(qs.percentChange))}>
                            {formatPercent(qs.percentChange)}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground bg-background/50 rounded p-2">
                        <strong className="text-foreground">Why this matters for RAG:</strong>{' '}
                        {qs.ragImpactExplanation}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>

      <Separator />

      {/* Further Optimization Suggestions */}
      {summary.furtherSuggestions.length > 0 && (
        <Collapsible open={showSuggestions} onOpenChange={setShowSuggestions}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between px-2">
              <span className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Further Optimization Suggestions
              </span>
              {showSuggestions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            {summary.furtherSuggestions.map((suggestion, idx) => (
              <Card key={idx} className="border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-medium text-sm">{suggestion.suggestion}</span>
                    <Badge variant={getImpactBadgeVariant(suggestion.expectedImpact)}>
                      {suggestion.expectedImpact === 'unlikely' ? 'Unlikely to Help' : `${suggestion.expectedImpact.toUpperCase()} Impact`}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
                </CardContent>
              </Card>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Trade-Off Considerations */}
      {summary.tradeOffConsiderations.length > 0 && (
        <Collapsible open={showTradeOffs} onOpenChange={setShowTradeOffs}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between px-2">
              <span className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Trade-Off Considerations
              </span>
              {showTradeOffs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            {summary.tradeOffConsiderations.map((tradeOff, idx) => (
              <Card key={idx} className="border-border/50">
                <CardContent className="p-3 flex items-start gap-3">
                  <div className={getSeverityColor(tradeOff.severity)}>
                    {getCategoryIcon(tradeOff.category)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="uppercase text-xs">
                        {tradeOff.category}
                      </Badge>
                      <span className={cn("text-xs", getSeverityColor(tradeOff.severity))}>
                        {tradeOff.severity} concern
                      </span>
                    </div>
                    <p className="text-sm">{tradeOff.concern}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
