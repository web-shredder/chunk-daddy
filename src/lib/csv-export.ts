// CSV Export utility for Chunk Daddy results

import type { AnalysisResult } from '@/hooks/useAnalysis';

/**
 * Escape CSV field value
 */
function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate CSV content from analysis results
 */
export function generateCSV(result: AnalysisResult): string {
  const rows: string[][] = [];
  
  // Header
  rows.push([
    'Type',
    'Chunk/Paragraph',
    'Keyword',
    'Cosine Similarity',
    'Euclidean Distance',
    'Manhattan Distance',
    'Dot Product',
    'Chamfer Similarity',
    'Improvement vs Original (%)',
  ]);
  
  // Original content scores
  if (result.originalScores) {
    for (const keywordResult of result.originalScores.keywordScores) {
      rows.push([
        'Original (Full)',
        escapeCSV(result.originalScores.text.substring(0, 50) + '...'),
        escapeCSV(keywordResult.keyword),
        keywordResult.scores.cosine.toFixed(4),
        keywordResult.scores.euclidean.toFixed(4),
        keywordResult.scores.manhattan.toFixed(4),
        keywordResult.scores.dotProduct.toFixed(4),
        keywordResult.scores.chamfer.toFixed(4),
        '-',
      ]);
    }
  }
  
  // Chunk scores
  for (const chunkResult of result.chunkScores) {
    for (const keywordResult of chunkResult.keywordScores) {
      const improvement = result.improvements?.find(
        imp => imp.chunkId === chunkResult.chunkId && imp.keyword === keywordResult.keyword
      );
      
      rows.push([
        `Chunk ${chunkResult.chunkIndex + 1}`,
        escapeCSV(chunkResult.text.substring(0, 50) + '...'),
        escapeCSV(keywordResult.keyword),
        keywordResult.scores.cosine.toFixed(4),
        keywordResult.scores.euclidean.toFixed(4),
        keywordResult.scores.manhattan.toFixed(4),
        keywordResult.scores.dotProduct.toFixed(4),
        keywordResult.scores.chamfer.toFixed(4),
        improvement ? improvement.cosineImprovement.toFixed(2) : '-',
      ]);
    }
  }
  
  // Optimized content scores (if present)
  if (result.optimizedScores) {
    for (const chunkResult of result.optimizedScores) {
      for (const keywordResult of chunkResult.keywordScores) {
        rows.push([
          `Optimized ${chunkResult.chunkIndex + 1}`,
          escapeCSV(chunkResult.text.substring(0, 50) + '...'),
          escapeCSV(keywordResult.keyword),
          keywordResult.scores.cosine.toFixed(4),
          keywordResult.scores.euclidean.toFixed(4),
          keywordResult.scores.manhattan.toFixed(4),
          keywordResult.scores.dotProduct.toFixed(4),
          keywordResult.scores.chamfer.toFixed(4),
          '-',
        ]);
      }
    }
  }
  
  return rows.map(row => row.join(',')).join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(result: AnalysisResult, filename: string = 'chunk-daddy-results.csv'): void {
  const csv = generateCSV(result);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
