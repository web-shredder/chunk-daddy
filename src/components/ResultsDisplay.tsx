import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, TrendingUp, TrendingDown, Minus, ChevronDown, FileJson, FileText, Table } from 'lucide-react';
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

function downloadJSON(result: AnalysisResult, filename: string) {
  const exportData = {
    exportedAt: new Date().toISOString(),
    summary: {
      totalChunks: result.chunkScores.length,
      keywords: result.originalScores?.keywordScores.map(ks => ks.keyword) || [],
      averageScores: result.originalScores?.keywordScores.reduce((acc, ks) => {
        acc[ks.keyword] = {
          cosine: ks.scores.cosine,
          euclidean: ks.scores.euclidean,
          chamfer: ks.scores.chamfer,
        };
        return acc;
      }, {} as Record<string, any>) || {},
    },
    originalContent: result.originalScores ? {
      text: result.originalScores.text,
      scores: result.originalScores.keywordScores,
    } : null,
    chunks: result.chunkScores.map(chunk => ({
      id: chunk.chunkId,
      index: chunk.chunkIndex,
      text: chunk.text,
      wordCount: chunk.wordCount,
      charCount: chunk.charCount,
      scores: chunk.keywordScores.map(ks => ({
        keyword: ks.keyword,
        ...ks.scores,
      })),
    })),
    optimizedChunks: result.optimizedScores?.map(chunk => ({
      id: chunk.chunkId,
      index: chunk.chunkIndex,
      text: chunk.text,
      scores: chunk.keywordScores.map(ks => ({
        keyword: ks.keyword,
        ...ks.scores,
      })),
    })) || [],
    improvements: result.improvements || [],
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadMarkdown(result: AnalysisResult, filename: string) {
  const lines: string[] = [];
  
  lines.push('# Chunk Daddy Analysis Report');
  lines.push(`\nGenerated: ${result.timestamp.toLocaleString()}\n`);
  
  // Summary
  lines.push('## Summary\n');
  lines.push(`- **Total Chunks:** ${result.chunkScores.length}`);
  lines.push(`- **Keywords Analyzed:** ${result.originalScores?.keywordScores.map(ks => ks.keyword).join(', ') || 'None'}`);
  
  // Original Content Scores
  if (result.originalScores) {
    lines.push('\n## Original Content Scores\n');
    lines.push('| Keyword | Cosine | Euclidean | Chamfer | Dot Product |');
    lines.push('|---------|--------|-----------|---------|-------------|');
    for (const ks of result.originalScores.keywordScores) {
      lines.push(`| ${ks.keyword} | ${ks.scores.cosine.toFixed(4)} | ${ks.scores.euclidean.toFixed(4)} | ${ks.scores.chamfer.toFixed(4)} | ${ks.scores.dotProduct.toFixed(4)} |`);
    }
  }
  
  // Chunk Scores
  lines.push('\n## Chunk Scores\n');
  for (const chunk of result.chunkScores) {
    lines.push(`### Chunk ${chunk.chunkIndex + 1}`);
    lines.push(`\n**Words:** ${chunk.wordCount} | **Characters:** ${chunk.charCount}\n`);
    lines.push('```');
    lines.push(chunk.text.slice(0, 200) + (chunk.text.length > 200 ? '...' : ''));
    lines.push('```\n');
    
    lines.push('| Keyword | Cosine | Euclidean | Chamfer | Improvement |');
    lines.push('|---------|--------|-----------|---------|-------------|');
    for (const ks of chunk.keywordScores) {
      const improvement = result.improvements?.find(
        i => i.chunkId === chunk.chunkId && i.keyword === ks.keyword
      );
      const improvementStr = improvement ? `${improvement.cosineImprovement >= 0 ? '+' : ''}${improvement.cosineImprovement.toFixed(2)}%` : '-';
      lines.push(`| ${ks.keyword} | ${ks.scores.cosine.toFixed(4)} | ${ks.scores.euclidean.toFixed(4)} | ${ks.scores.chamfer.toFixed(4)} | ${improvementStr} |`);
    }
    lines.push('');
  }
  
  // Optimized Scores
  if (result.optimizedScores && result.optimizedScores.length > 0) {
    lines.push('\n## Optimized Chunk Scores\n');
    for (const chunk of result.optimizedScores) {
      lines.push(`### Optimized Chunk ${chunk.chunkIndex + 1}`);
      lines.push('| Keyword | Cosine | Euclidean | Chamfer |');
      lines.push('|---------|--------|-----------|---------|');
      for (const ks of chunk.keywordScores) {
        lines.push(`| ${ks.keyword} | ${ks.scores.cosine.toFixed(4)} | ${ks.scores.euclidean.toFixed(4)} | ${ks.scores.chamfer.toFixed(4)} |`);
      }
      lines.push('');
    }
  }
  
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
  const timestamp = new Date().toISOString().slice(0, 10);
  
  const handleExportCSV = () => {
    downloadCSV(result, `chunk-daddy-results-${timestamp}.csv`);
  };
  
  const handleExportJSON = () => {
    downloadJSON(result, `chunk-daddy-results-${timestamp}.json`);
  };
  
  const handleExportMarkdown = () => {
    downloadMarkdown(result, `chunk-daddy-report-${timestamp}.md`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Analysis Results</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={handleExportCSV}>
              <Table className="h-4 w-4 mr-2" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportJSON}>
              <FileJson className="h-4 w-4 mr-2" />
              Export as JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportMarkdown}>
              <FileText className="h-4 w-4 mr-2" />
              Export as Markdown
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
        <ScrollArea className="h-[500px]">
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
