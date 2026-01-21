import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { getTierFromScore } from '@/lib/tier-colors';
import type { FullOptimizationResult, ContentBrief } from '@/lib/optimizer-types';

interface ReportExportsProps {
  content: string;
  optimizedContent: string;
  optimizationResult: FullOptimizationResult;
  keywords: string[];
  projectName?: string;
}

export function ReportExports({
  content,
  optimizedContent,
  optimizationResult,
  keywords,
  projectName,
}: ReportExportsProps) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}`);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const generateScoresCSV = () => {
    const headers = ['Chunk', 'Heading', 'Original Score', 'Optimized Score', 'Change', 'Tier Before', 'Tier After'];
    const rows = optimizationResult.optimizedChunks?.map((chunk, index) => {
      // Calculate average scores across queries for this chunk
      const origScores = optimizationResult.originalFullScores?.[index] || {};
      const optScores = optimizationResult.optimizedFullScores?.[index] || {};
      
      let totalOrig = 0;
      let totalOpt = 0;
      let count = 0;
      
      Object.keys(optScores).forEach(query => {
        if (origScores[query]) {
          totalOrig += origScores[query].passageScore;
          totalOpt += optScores[query].passageScore;
          count++;
        }
      });
      
      const avgOrig = count > 0 ? Math.round(totalOrig / count) : 0;
      const avgOpt = count > 0 ? Math.round(totalOpt / count) : 0;
      
      return [
        index + 1,
        `"${chunk.heading || `Chunk ${index + 1}`}"`,
        avgOrig,
        avgOpt,
        avgOpt - avgOrig,
        getTierFromScore(avgOrig),
        getTierFromScore(avgOpt),
      ].join(',');
    }) || [];
    
    return [headers.join(','), ...rows].join('\n');
  };

  const generateActionItemsMarkdown = () => {
    const lines: string[] = ['# Action Items\n'];
    const briefs = optimizationResult.contentBriefs || [];
    
    if (briefs.length > 0) {
      lines.push('## Content Gaps to Address\n');
      briefs.forEach(brief => {
        lines.push(`- [ ] **${brief.suggestedHeading}**`);
        lines.push(`  Target query: "${brief.targetQuery}"`);
        lines.push(`  Word count: ${brief.targetWordCount.min}-${brief.targetWordCount.max}\n`);
      });
    }
    
    lines.push('\n## Chunks to Review\n');
    optimizationResult.optimizedChunks?.forEach((chunk, index) => {
      const optScores = optimizationResult.optimizedFullScores?.[index] || {};
      let totalScore = 0;
      let count = 0;
      Object.values(optScores).forEach(score => {
        totalScore += score.passageScore;
        count++;
      });
      const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
      
      if (avgScore < 60) {
        lines.push(`- [ ] Chunk ${index + 1} (${chunk.heading || 'No heading'}) - Score: ${avgScore} (${getTierFromScore(avgScore)})`);
      }
    });
    
    return lines.join('\n');
  };

  const generateQueriesCSV = () => {
    const headers = ['Query', 'Best Chunk', 'Best Score', 'Status'];
    const rows = keywords.map((query) => {
      // Find best chunk for this query
      let bestChunk = -1;
      let bestScore = 0;
      
      optimizationResult.optimizedChunks?.forEach((_, index) => {
        const scores = optimizationResult.optimizedFullScores?.[index] || {};
        if (scores[query] && scores[query].passageScore > bestScore) {
          bestScore = Math.round(scores[query].passageScore);
          bestChunk = index + 1;
        }
      });
      
      const status = bestScore >= 60 ? 'covered' : bestScore >= 40 ? 'weak' : 'gap';
      
      return [
        `"${query}"`,
        bestChunk > 0 ? bestChunk : 'N/A',
        bestScore,
        status
      ].join(',');
    });
    
    return [headers.join(','), ...rows].join('\n');
  };

  const generateAllBriefsMarkdown = () => {
    const briefs = optimizationResult.contentBriefs || [];
    if (briefs.length === 0) return '';
    
    return briefs.map(brief => `# ${brief.suggestedHeading}

**Target Query:** ${brief.targetQuery}  
**Placement:** ${brief.placementDescription}  
**Target Length:** ${brief.targetWordCount.min}-${brief.targetWordCount.max} words

## Key Points
${brief.keyPoints.map(p => `- ${p}`).join('\n')}

## Draft Opening
${brief.draftOpening}

## Gap Analysis
${brief.gapAnalysis}
`).join('\n\n---\n\n');
  };

  const hasBriefs = (optimizationResult.contentBriefs?.length || 0) > 0;
  const dateStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Content */}
      <Card className="bg-surface border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ExportRow
            title="Optimized Content"
            description="Full document with all accepted changes"
            onCopy={() => copyToClipboard(optimizedContent, 'optimized content')}
            onDownload={() => downloadFile(optimizedContent, `optimized-content-${dateStr}.md`, 'text/markdown')}
          />
          <ExportRow
            title="Original Content"
            description="Content before optimization"
            onCopy={() => copyToClipboard(content, 'original content')}
            onDownload={() => downloadFile(content, `original-content-${dateStr}.md`, 'text/markdown')}
          />
        </CardContent>
      </Card>

      {/* Reports */}
      <Card className="bg-surface border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ExportRow
            title="Full Report (JSON)"
            description="Complete optimization data for API/automation"
            onDownload={() => downloadFile(
              JSON.stringify({
                exportedAt: new Date().toISOString(),
                projectName: projectName || 'Untitled',
                optimizedChunks: optimizationResult.optimizedChunks,
                originalFullScores: optimizationResult.originalFullScores,
                optimizedFullScores: optimizationResult.optimizedFullScores,
                contentBriefs: optimizationResult.contentBriefs,
                explanations: optimizationResult.explanations,
              }, null, 2),
              `optimization-report-${dateStr}.json`,
              'application/json'
            )}
          />
          <ExportRow
            title="Chunk Scores (CSV)"
            description="Before/after scores for all chunks"
            onDownload={() => downloadFile(generateScoresCSV(), `chunk-scores-${dateStr}.csv`, 'text/csv')}
          />
          <ExportRow
            title="Action Items (Markdown)"
            description="Checklist for Notion, Linear, or Asana"
            onDownload={() => downloadFile(generateActionItemsMarkdown(), `action-items-${dateStr}.md`, 'text/markdown')}
          />
        </CardContent>
      </Card>

      {/* Content Briefs */}
      {hasBriefs && (
        <Card className="bg-surface border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Content Briefs ({optimizationResult.contentBriefs?.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ExportRow
              title="All Briefs (Markdown)"
              description={`${optimizationResult.contentBriefs?.length} content briefs for new sections`}
              onDownload={() => downloadFile(generateAllBriefsMarkdown(), `content-briefs-${dateStr}.md`, 'text/markdown')}
            />
            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground">Individual briefs:</p>
              {optimizationResult.contentBriefs?.map((brief: ContentBrief, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-[hsl(var(--accent-muted))] rounded-md"
                >
                  <span className="text-sm text-foreground">{brief.suggestedHeading}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(
                      `# ${brief.suggestedHeading}\n\n${brief.draftOpening}\n\n## Key Points\n${brief.keyPoints.map(p => `- ${p}`).join('\n')}`,
                      brief.suggestedHeading
                    )}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Query Data */}
      <Card className="bg-surface border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Query Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ExportRow
            title="Query Coverage (CSV)"
            description="All queries with assignments and scores"
            onDownload={() => downloadFile(generateQueriesCSV(), `query-coverage-${dateStr}.csv`, 'text/csv')}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ExportRow({
  title,
  description,
  onCopy,
  onDownload,
}: {
  title: string;
  description: string;
  onCopy?: () => void;
  onDownload?: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-elevated hover:bg-muted/50 border border-border rounded-md transition-colors">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {onCopy && (
          <Button variant="outline" size="sm" onClick={onCopy}>
            <Copy className="h-4 w-4" />
          </Button>
        )}
        {onDownload && (
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
