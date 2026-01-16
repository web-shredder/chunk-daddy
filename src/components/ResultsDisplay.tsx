import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { downloadCSV } from '@/lib/csv-export';
import {
  formatScore,
  formatImprovement,
  getScoreColorClass,
  getImprovementColorClass,
} from '@/lib/similarity';
import type { AnalysisResult, ChunkScore, KeywordScore } from '@/hooks/useAnalysis';

interface ResultsDisplayProps {
  result: AnalysisResult;
}

function ImprovementIndicator({ value }: { value: number }) {
  if (value > 1) {
    return <TrendingUp className="h-3 w-3 text-green-600" />;
  }
  if (value < -1) {
    return <TrendingDown className="h-3 w-3 text-red-600" />;
  }
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function ScoreRow({ label, keywordScores, improvements }: { 
  label: string; 
  keywordScores: KeywordScore[];
  improvements?: { keyword: string; cosineImprovement: number }[];
}) {
  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm">{label}</h4>
      <div className="grid gap-3">
        {keywordScores.map((ks) => {
          const improvement = improvements?.find(i => i.keyword === ks.keyword);
          
          return (
            <div key={ks.keyword} className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  {ks.keyword}
                </Badge>
                {improvement && (
                  <div className={`flex items-center gap-1 text-xs font-mono ${getImprovementColorClass(improvement.cosineImprovement)}`}>
                    <ImprovementIndicator value={improvement.cosineImprovement} />
                    {formatImprovement(improvement.cosineImprovement)}
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="text-muted-foreground">Cosine</div>
                  <div className={`font-mono font-medium ${getScoreColorClass(ks.scores.cosine)}`}>
                    {formatScore(ks.scores.cosine)}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-muted-foreground">Chamfer</div>
                  <div className="font-mono font-medium">
                    {formatScore(ks.scores.chamfer)}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-muted-foreground">Euclidean</div>
                  <div className="font-mono font-medium">
                    {formatScore(ks.scores.euclidean, 2)}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-muted-foreground">Manhattan</div>
                  <div className="font-mono font-medium">
                    {formatScore(ks.scores.manhattan, 2)}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-muted-foreground">Dot Product</div>
                  <div className="font-mono font-medium">
                    {formatScore(ks.scores.dotProduct, 2)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChunkResult({ chunk, improvements }: { 
  chunk: ChunkScore; 
  improvements?: { keyword: string; cosineImprovement: number }[];
}) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Chunk {chunk.chunkIndex + 1}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{chunk.wordCount} words</span>
            <span>•</span>
            <span>{chunk.charCount} chars</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
          {chunk.text}
        </p>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid gap-3">
          {chunk.keywordScores.map((ks) => {
            const improvement = improvements?.find(i => i.keyword === ks.keyword);
            
            return (
              <div key={ks.keyword} className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {ks.keyword}
                  </Badge>
                  {improvement && (
                    <div className={`flex items-center gap-1 text-xs font-mono ${getImprovementColorClass(improvement.cosineImprovement)}`}>
                      <ImprovementIndicator value={improvement.cosineImprovement} />
                      {formatImprovement(improvement.cosineImprovement)}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="space-y-0.5">
                    <div className="text-muted-foreground">Cosine</div>
                    <div className={`font-mono font-medium ${getScoreColorClass(ks.scores.cosine)}`}>
                      {formatScore(ks.scores.cosine)}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-muted-foreground">Chamfer</div>
                    <div className="font-mono font-medium">
                      {formatScore(ks.scores.chamfer)}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-muted-foreground">Euclidean</div>
                    <div className="font-mono font-medium">
                      {formatScore(ks.scores.euclidean, 2)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function ResultsDisplay({ result }: ResultsDisplayProps) {
  const handleExport = () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadCSV(result, `chunk-daddy-results-${timestamp}.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Analysis Results</h3>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>
      
      {/* Original Content Scores */}
      {result.originalScores && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Original Content (Full)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreRow
              label=""
              keywordScores={result.originalScores.keywordScores}
            />
          </CardContent>
        </Card>
      )}
      
      <Separator />
      
      {/* Chunk Scores */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">
          Chunks ({result.chunkScores.length})
        </h4>
        <ScrollArea className="max-h-[500px]">
          <div className="grid gap-4 pr-4">
            {result.chunkScores.map((chunk) => (
              <ChunkResult
                key={chunk.chunkId}
                chunk={chunk}
                improvements={result.improvements?.filter(i => i.chunkId === chunk.chunkId)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
      
      {/* Optimized Content Scores */}
      {result.optimizedScores && result.optimizedScores.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-600" />
              Optimized Chunks ({result.optimizedScores.length})
            </h4>
            <div className="grid gap-4">
              {result.optimizedScores.map((chunk) => (
                <ChunkResult
                  key={chunk.chunkId}
                  chunk={chunk}
                />
              ))}
            </div>
          </div>
        </>
      )}
      
      <p className="text-xs text-muted-foreground text-center">
        Analysis completed at {result.timestamp.toLocaleTimeString()}
      </p>
    </div>
  );
}
