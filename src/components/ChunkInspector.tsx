import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowRight,
  FileText,
  Hash,
  Info,
} from 'lucide-react';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';
import type { ChunkScore } from '@/hooks/useAnalysis';
import { formatScore, formatImprovement, getScoreColorClass, getImprovementColorClass } from '@/lib/similarity';
import { cn } from '@/lib/utils';

interface ChunkInspectorProps {
  chunk: LayoutAwareChunk;
  score?: ChunkScore;
  scoreWithoutCascade?: ChunkScore;
  keywords: string[];
}

export function ChunkInspector({
  chunk,
  score,
  scoreWithoutCascade,
  keywords,
}: ChunkInspectorProps) {
  const hasHeadingContext = chunk.headingPath.length > 0;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">
            Chunk {chunk.id.replace('chunk-', '')}
            {hasHeadingContext && ': '}
            {hasHeadingContext && (
              <span className="font-normal text-muted-foreground">
                {chunk.headingPath.join(' > ')}
              </span>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Heading Context */}
        {hasHeadingContext && chunk.metadata.hasCascade && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              Heading Context (Cascaded)
            </div>
            <div className="bg-muted/50 rounded-lg p-3 font-mono text-xs space-y-1">
              {chunk.headingPath.map((heading, idx) => (
                <div key={idx} className="text-muted-foreground">
                  {'#'.repeat(chunk.metadata.headingLevels[idx] || idx + 1)} {heading}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Actual Content */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Content
          </div>
          <ScrollArea className="max-h-[200px]">
            <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
              {chunk.textWithoutCascade}
            </div>
          </ScrollArea>
        </div>
        
        <Separator />
        
        {/* Metadata */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            Metadata
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between p-2 bg-muted/30 rounded">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize">{chunk.metadata.type}</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/30 rounded">
              <span className="text-muted-foreground">Source Lines</span>
              <span className="font-medium">{chunk.sourceLines[0]}-{chunk.sourceLines[1]}</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/30 rounded">
              <span className="text-muted-foreground">Token Count</span>
              <span className="font-medium">~{chunk.metadata.tokenEstimate}</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/30 rounded">
              <span className="text-muted-foreground">Has Cascade</span>
              <span className="font-medium">{chunk.metadata.hasCascade ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/30 rounded">
              <span className="text-muted-foreground">Heading Levels</span>
              <span className="font-medium">
                {chunk.metadata.headingLevels.length > 0 
                  ? chunk.metadata.headingLevels.map(l => `H${l}`).join(', ')
                  : 'None'}
              </span>
            </div>
            <div className="flex justify-between p-2 bg-muted/30 rounded">
              <span className="text-muted-foreground">Word Count</span>
              <span className="font-medium">{chunk.metadata.wordCount}</span>
            </div>
          </div>
        </div>
        
        {/* Scores */}
        {score && keywords.length > 0 && (
          <>
            <Separator />
            
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">
                Similarity Scores
              </div>
              
              {score.keywordScores.map((ks) => {
                const noCascadeScore = scoreWithoutCascade?.keywordScores.find(
                  ncs => ncs.keyword === ks.keyword
                );
                const improvement = noCascadeScore
                  ? ((ks.scores.cosine - noCascadeScore.scores.cosine) / noCascadeScore.scores.cosine) * 100
                  : null;
                
                return (
                  <div key={ks.keyword} className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {ks.keyword}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="text-muted-foreground">With Cascade</div>
                        <div className={cn("font-mono font-medium text-base", getScoreColorClass(ks.scores.cosine))}>
                          {formatScore(ks.scores.cosine)}
                        </div>
                      </div>
                      
                      {noCascadeScore && (
                        <div className="space-y-1">
                          <div className="text-muted-foreground">Without Cascade</div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-base">
                              {formatScore(noCascadeScore.scores.cosine)}
                            </span>
                            {improvement !== null && (
                              <span className={cn(
                                "text-xs font-mono",
                                getImprovementColorClass(improvement)
                              )}>
                                ({improvement >= 0 ? '+' : ''}{improvement.toFixed(1)}%)
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                      <div className="space-y-0.5">
                        <div className="text-muted-foreground">Chamfer</div>
                        <div className="font-mono">{formatScore(ks.scores.chamfer)}</div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-muted-foreground">Euclidean</div>
                        <div className="font-mono">{formatScore(ks.scores.euclidean, 2)}</div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-muted-foreground">Dot Product</div>
                        <div className="font-mono">{formatScore(ks.scores.dotProduct, 2)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
