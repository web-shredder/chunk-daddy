import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowRight, TrendingUp, GitCompare } from 'lucide-react';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';
import type { ChunkScore } from '@/hooks/useAnalysis';
import { formatScore, getScoreColorClass, getImprovementColorClass } from '@/lib/similarity';
import { cn } from '@/lib/utils';

interface CascadeComparisonViewProps {
  chunks: LayoutAwareChunk[];
  scoresWithCascade: ChunkScore[];
  scoresWithoutCascade: ChunkScore[];
  keywords: string[];
}

interface ChunkComparisonProps {
  chunk: LayoutAwareChunk;
  scoreWithCascade?: ChunkScore;
  scoreWithoutCascade?: ChunkScore;
  keywords: string[];
}

function ChunkComparison({
  chunk,
  scoreWithCascade,
  scoreWithoutCascade,
  keywords,
}: ChunkComparisonProps) {
  if (!scoreWithCascade || !scoreWithoutCascade) return null;
  
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">
            Chunk {chunk.id.replace('chunk-', '')}
          </span>
          {chunk.headingPath.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {chunk.headingPath.join(' > ')}
            </span>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 divide-x divide-border">
        {/* Without Cascade */}
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">Without Cascade</Badge>
          </div>
          
          <ScrollArea className="max-h-[120px]">
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {chunk.textWithoutCascade.slice(0, 200)}
              {chunk.textWithoutCascade.length > 200 && '...'}
            </p>
          </ScrollArea>
          
          <div className="space-y-2 pt-2 border-t border-border">
            {scoreWithoutCascade.keywordScores.map((ks) => (
              <div key={ks.keyword} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{ks.keyword}</span>
                <span className={cn("font-mono font-medium", getScoreColorClass(ks.scores.cosine))}>
                  {formatScore(ks.scores.cosine)}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* With Cascade */}
        <div className="p-3 space-y-3 bg-primary/5">
          <div className="flex items-center gap-2">
            <Badge className="text-xs bg-primary/20 text-primary hover:bg-primary/30">
              With Cascade
            </Badge>
          </div>
          
          <ScrollArea className="max-h-[120px]">
            <div className="space-y-1">
              {chunk.headingPath.length > 0 && chunk.metadata.hasCascade && (
                <div className="text-xs font-mono text-primary/70 space-y-0.5">
                  {chunk.headingPath.map((h, i) => (
                    <div key={i}>{'#'.repeat(chunk.metadata.headingLevels[i] || i + 1)} {h}</div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground whitespace-pre-wrap pt-1">
                {chunk.textWithoutCascade.slice(0, 150)}
                {chunk.textWithoutCascade.length > 150 && '...'}
              </p>
            </div>
          </ScrollArea>
          
          <div className="space-y-2 pt-2 border-t border-border">
            {scoreWithCascade.keywordScores.map((ks) => {
              const noCascade = scoreWithoutCascade.keywordScores.find(
                ncs => ncs.keyword === ks.keyword
              );
              const improvement = noCascade
                ? ((ks.scores.cosine - noCascade.scores.cosine) / noCascade.scores.cosine) * 100
                : 0;
              
              return (
                <div key={ks.keyword} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{ks.keyword}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-mono font-medium", getScoreColorClass(ks.scores.cosine))}>
                      {formatScore(ks.scores.cosine)}
                    </span>
                    {improvement !== 0 && (
                      <span className={cn(
                        "text-[10px] font-mono",
                        getImprovementColorClass(improvement)
                      )}>
                        ({improvement >= 0 ? '+' : ''}{improvement.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStats({
  chunks,
  scoresWithCascade,
  scoresWithoutCascade,
  keywords,
}: CascadeComparisonViewProps) {
  // Calculate average improvement per keyword
  const improvements = keywords.map(keyword => {
    let totalImprovement = 0;
    let count = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const withCascade = scoresWithCascade[i]?.keywordScores.find(ks => ks.keyword === keyword);
      const withoutCascade = scoresWithoutCascade[i]?.keywordScores.find(ks => ks.keyword === keyword);
      
      if (withCascade && withoutCascade && withoutCascade.scores.cosine > 0) {
        const improvement = ((withCascade.scores.cosine - withoutCascade.scores.cosine) / withoutCascade.scores.cosine) * 100;
        totalImprovement += improvement;
        count++;
      }
    }
    
    return {
      keyword,
      avgImprovement: count > 0 ? totalImprovement / count : 0,
    };
  });
  
  const overallImprovement = improvements.reduce((sum, i) => sum + i.avgImprovement, 0) / improvements.length;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Cascade Impact Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Overall Improvement</span>
            <Badge 
              variant={overallImprovement > 0 ? 'default' : 'secondary'}
              className={cn(
                "text-sm font-mono",
                overallImprovement > 5 && "bg-green-600",
                overallImprovement > 0 && overallImprovement <= 5 && "bg-green-500",
                overallImprovement === 0 && "bg-muted text-muted-foreground",
                overallImprovement < 0 && "bg-red-500"
              )}
            >
              {overallImprovement >= 0 ? '+' : ''}{overallImprovement.toFixed(1)}%
            </Badge>
          </div>
          
          {improvements.map(({ keyword, avgImprovement }) => (
            <div key={keyword} className="flex items-center justify-between p-2 text-sm">
              <span className="text-muted-foreground">{keyword}</span>
              <span className={cn(
                "font-mono font-medium",
                getImprovementColorClass(avgImprovement)
              )}>
                {avgImprovement >= 0 ? '+' : ''}{avgImprovement.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CascadeComparisonView({
  chunks,
  scoresWithCascade,
  scoresWithoutCascade,
  keywords,
}: CascadeComparisonViewProps) {
  if (chunks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <GitCompare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No chunks to compare</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      <SummaryStats
        chunks={chunks}
        scoresWithCascade={scoresWithCascade}
        scoresWithoutCascade={scoresWithoutCascade}
        keywords={keywords}
      />
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            Chunk-by-Chunk Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-4">
              {chunks.map((chunk, idx) => (
                <ChunkComparison
                  key={chunk.id}
                  chunk={chunk}
                  scoreWithCascade={scoresWithCascade[idx]}
                  scoreWithoutCascade={scoresWithoutCascade[idx]}
                  keywords={keywords}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
