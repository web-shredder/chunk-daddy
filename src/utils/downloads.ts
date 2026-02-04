/**
 * Download utilities for exporting project assets
 */
import { saveAs } from 'file-saver';
import type { CoverageState, QueryWorkItem } from '@/types/coverage';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';
import type { ChunkScore } from '@/hooks/useAnalysis';

export function downloadOriginalContent(content: string, format: 'markdown' | 'txt') {
  const extension = format === 'markdown' ? 'md' : 'txt';
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `original-content.${extension}`);
}

export function downloadOptimizedContent(
  coverageState: CoverageState,
  chunks: LayoutAwareChunk[],
  format: 'markdown' | 'txt' | 'html'
) {
  // Build optimized document by replacing chunks with approved content
  let optimizedDoc = '';
  
  // Group approved content by chunk
  const chunkOptimizations = new Map<number, string>();
  coverageState.queries.forEach(q => {
    if (q.isApproved && q.approvedText && q.assignedChunk?.index !== undefined) {
      chunkOptimizations.set(q.assignedChunk.index, q.approvedText);
    }
  });
  
  // Build document
  chunks.forEach((chunk, index) => {
    const heading = chunk.headingPath?.slice(-1)[0];
    if (heading) {
      optimizedDoc += `## ${heading}\n\n`;
    }
    
    const optimizedText = chunkOptimizations.get(index);
    optimizedDoc += (optimizedText || chunk.text) + '\n\n';
  });
  
  // Add new gap content at the end (or at suggested positions)
  const newSections = coverageState.queries.filter(
    q => q.isApproved && q.approvedText && q.isGap
  );
  
  if (newSections.length > 0) {
    optimizedDoc += '\n---\n\n## New Sections (Gap Content)\n\n';
    newSections.forEach(section => {
      optimizedDoc += section.approvedText + '\n\n';
    });
  }
  
  // Convert to requested format
  if (format === 'html') {
    const html = markdownToHtml(optimizedDoc);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    saveAs(blob, 'optimized-content.html');
  } else {
    const ext = format === 'markdown' ? 'md' : 'txt';
    const blob = new Blob([optimizedDoc], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `optimized-content.${ext}`);
  }
}

export function downloadQueryResearch(coverageState: CoverageState, format: 'csv' | 'json') {
  const data = coverageState.queries.map(q => ({
    query: q.query,
    intentType: q.intentType,
    status: q.status,
    isGap: q.isGap ?? false,
    assignedChunk: q.assignedChunk?.index ?? null,
    originalPassageScore: q.originalScores?.passageScore ?? null,
    originalSemantic: q.originalScores?.semanticSimilarity ?? null,
    originalLexical: q.originalScores?.lexicalScore ?? null,
    originalRerank: q.originalScores?.rerankScore ?? null,
    originalCitation: q.originalScores?.citationScore ?? null,
    originalEntityOverlap: q.originalScores?.entityOverlap ?? null,
    finalPassageScore: q.currentScores?.passageScore ?? null,
    finalSemantic: q.currentScores?.semanticSimilarity ?? null,
    finalLexical: q.currentScores?.lexicalScore ?? null,
    finalRerank: q.currentScores?.rerankScore ?? null,
    finalCitation: q.currentScores?.citationScore ?? null,
    finalEntityOverlap: q.currentScores?.entityOverlap ?? null,
    improvement: q.currentScores && q.originalScores 
      ? q.currentScores.passageScore - q.originalScores.passageScore 
      : null,
    isApproved: q.isApproved
  }));
  
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, 'query-research.json');
  } else {
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, 'query-research.csv');
  }
}

export function downloadContentBriefs(coverageState: CoverageState, format: 'markdown' | 'json') {
  const briefs = coverageState.queries
    .filter(q => (q.isGap || q.status === 'gap') && q.analysisPrompt)
    .map(q => ({
      query: q.query,
      brief: q.analysisPrompt,
      generatedContent: q.approvedText,
      suggestedPlacement: q.suggestedPlacement,
      suggestedHeadingLevel: q.suggestedHeading,
      finalScore: q.currentScores?.passageScore
    }));
  
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(briefs, null, 2)], { type: 'application/json' });
    saveAs(blob, 'content-briefs.json');
  } else {
    let md = '# Content Briefs\n\n';
    briefs.forEach((brief, i) => {
      md += `## ${i + 1}. ${brief.query}\n\n`;
      md += `**Suggested Placement:** ${brief.suggestedPlacement || 'End of document'}\n\n`;
      md += `### Brief\n\n${brief.brief}\n\n`;
      if (brief.generatedContent) {
        md += `### Generated Content\n\n${brief.generatedContent}\n\n`;
      }
      md += '---\n\n';
    });
    const blob = new Blob([md], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, 'content-briefs.md');
  }
}

export function downloadChunkAnalysis(
  chunks: LayoutAwareChunk[],
  scoredResults: ChunkScore[],
  format: 'csv' | 'json'
) {
  const data = chunks.map((chunk, index) => {
    const chunkScore = scoredResults.find(sr => sr.chunkIndex === index);
    
    // Find best scoring keyword for this chunk
    const bestKeywordScore = chunkScore?.keywordScores?.sort((a, b) => {
      const scoreA = a.scores?.passageScore ?? a.scores?.cosine ?? 0;
      const scoreB = b.scores?.passageScore ?? b.scores?.cosine ?? 0;
      return scoreB - scoreA;
    })[0];
    
    return {
      chunkIndex: index,
      heading: chunk.headingPath?.slice(-1)[0] || 'Untitled',
      headingCascade: chunk.headingPath?.join(' > ') || '',
      wordCount: chunk.text.split(/\s+/).length,
      tokenEstimate: Math.ceil(chunk.text.length / 4),
      bestMatchQuery: bestKeywordScore?.keyword || null,
      bestPassageScore: bestKeywordScore?.scores?.passageScore ?? null,
      bestCosineScore: bestKeywordScore?.scores?.cosine ?? null,
      previewText: chunk.text.slice(0, 200) + '...'
    };
  });
  
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, 'chunk-analysis.json');
  } else {
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, 'chunk-analysis.csv');
  }
}

export function downloadFullReport(
  projectName: string,
  originalContent: string,
  coverageState: CoverageState,
  chunks: LayoutAwareChunk[],
  scoredResults: ChunkScore[],
  format: 'markdown' | 'json'
) {
  const optimizedQueries = coverageState.queries.filter(q => q.status === 'optimized');
  const gapsFilled = coverageState.queries.filter(q => q.isGap === false && q.approvedText);
  
  const report = {
    meta: {
      projectName,
      generatedAt: new Date().toISOString(),
      version: '1.0.0'
    },
    summary: {
      totalQueries: coverageState.queries.length,
      optimized: optimizedQueries.length,
      gapsFilled: gapsFilled.length,
      totalChunks: chunks.length,
      avgOriginalScore: calculateAvgScore(coverageState.queries, 'original'),
      avgFinalScore: calculateAvgScore(coverageState.queries, 'current'),
    },
    queries: coverageState.queries.map(q => ({
      query: q.query,
      intentType: q.intentType,
      status: q.status,
      isGap: q.isGap,
      originalScores: q.originalScores,
      currentScores: q.currentScores,
      isApproved: q.isApproved,
      approvedText: q.approvedText
    })),
    chunks: chunks.map((c, i) => ({
      index: i,
      heading: c.headingPath?.slice(-1)[0],
      headingPath: c.headingPath,
      wordCount: c.text.split(/\s+/).length
    }))
  };
  
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    saveAs(blob, `${projectName || 'optimization'}-report.json`);
  } else {
    const md = generateMarkdownReport(report);
    const blob = new Blob([md], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${projectName || 'optimization'}-report.md`);
  }
}

function calculateAvgScore(queries: QueryWorkItem[], type: 'original' | 'current'): number {
  const scores = queries
    .map(q => type === 'original' ? q.originalScores?.passageScore : q.currentScores?.passageScore)
    .filter((s): s is number => s !== undefined && s !== null);
  
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function generateMarkdownReport(report: {
  meta: { projectName: string; generatedAt: string };
  summary: {
    totalQueries: number;
    optimized: number;
    gapsFilled: number;
    totalChunks: number;
    avgOriginalScore: number;
    avgFinalScore: number;
  };
  queries: Array<{
    query: string;
    status: string;
    isApproved: boolean;
  }>;
}): string {
  return `# Optimization Report: ${report.meta.projectName}

Generated: ${new Date(report.meta.generatedAt).toLocaleString()}

## Summary

| Metric | Value |
|--------|-------|
| Total Queries | ${report.summary.totalQueries} |
| Queries Optimized | ${report.summary.optimized} |
| Gaps Filled | ${report.summary.gapsFilled} |
| Total Chunks | ${report.summary.totalChunks} |
| Avg Original Score | ${report.summary.avgOriginalScore} |
| Avg Final Score | ${report.summary.avgFinalScore} |
| Improvement | +${report.summary.avgFinalScore - report.summary.avgOriginalScore} |

## Query Status

| Query | Status | Approved |
|-------|--------|----------|
${report.queries.map(q => `| ${q.query.slice(0, 50)}${q.query.length > 50 ? '...' : ''} | ${q.status} | ${q.isApproved ? 'Yes' : 'No'} |`).join('\n')}

---
*Report generated by Chunk Daddy*
`;
}

function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return String(val);
    }).join(',')
  );
  
  return [headers.join(','), ...rows].join('\n');
}

function markdownToHtml(md: string): string {
  // Basic markdown to HTML conversion
  let html = md
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Optimized Content</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h2 { margin-top: 2rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
  </style>
</head>
<body>
<p>${html}</p>
</body>
</html>`;
}
