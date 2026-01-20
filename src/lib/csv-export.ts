// CSV Export utility for Chunk Daddy results

import type { AnalysisResult } from '@/hooks/useAnalysis';
import type { ArchitectureAnalysis, ArchitectureTask } from '@/lib/optimizer-types';

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

/**
 * Generate CSV for architecture analysis
 */
export function generateArchitectureCSV(
  analysis: ArchitectureAnalysis,
  chunks: Array<{ text: string; headingPath?: string[] }>
): string {
  const rows: string[][] = [];
  
  // Header row
  rows.push([
    'Priority',
    'Issue Type',
    'Chunk Index',
    'Chunk Location (Heading Path)',
    'Issue Summary',
    'Full Description',
    'Recommendation',
    'Impact Analysis',
    'Related Queries',
    'Full Chunk Text',
  ]);
  
  // Issue rows
  for (const issue of analysis.issues) {
    for (const chunkIdx of issue.chunkIndices) {
      const chunk = chunks[chunkIdx];
      const headingPath = chunk?.headingPath?.join(' > ') || '';
      const chunkText = chunk?.text || '';
      
      rows.push([
        escapeCSV(issue.severity.toUpperCase()),
        escapeCSV(issue.type.replace(/_/g, ' ')),
        String(chunkIdx + 1),
        escapeCSV(headingPath),
        escapeCSV(issue.description.slice(0, 100)),
        escapeCSV(issue.description),
        escapeCSV(issue.recommendation),
        escapeCSV(issue.impact),
        escapeCSV(issue.relatedQueries?.join('; ') || ''),
        escapeCSV(chunkText),
      ]);
    }
    
    // If no chunks affected (e.g., coverage gap), still output the issue
    if (issue.chunkIndices.length === 0) {
      rows.push([
        escapeCSV(issue.severity.toUpperCase()),
        escapeCSV(issue.type.replace(/_/g, ' ')),
        'N/A',
        'N/A',
        escapeCSV(issue.description.slice(0, 100)),
        escapeCSV(issue.description),
        escapeCSV(issue.recommendation),
        escapeCSV(issue.impact),
        escapeCSV(issue.relatedQueries?.join('; ') || ''),
        '',
      ]);
    }
  }
  
  return rows.map(row => row.join(',')).join('\n');
}

/**
 * Download architecture analysis as CSV
 */
export function downloadArchitectureCSV(
  analysis: ArchitectureAnalysis,
  chunks: Array<{ text: string; headingPath?: string[] }>,
  filename: string = 'architecture-analysis.csv'
): void {
  const csv = generateArchitectureCSV(analysis, chunks);
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

/**
 * Generate CSV for architecture tasks (actionable items with selection status)
 */
export function generateArchitectureTasksCSV(tasks: ArchitectureTask[]): string {
  const rows: string[][] = [];
  
  // Header row
  rows.push([
    'Issue Type',
    'Priority',
    'Location',
    'Description',
    'Suggested Fix',
    'Expected Impact',
    'Status',
  ]);
  
  // Task rows - one row per task
  for (const task of tasks) {
    const location = task.location?.chunkIndex !== undefined
      ? `Chunk ${task.location.chunkIndex + 1}${task.location.position ? ` (${task.location.position})` : ''}`
      : task.location?.position || 'N/A';
    
    const suggestedFix = task.details?.after 
      || task.details?.suggestedHeading 
      || task.details?.before 
      || '';
    
    rows.push([
      escapeCSV(task.type.replace(/_/g, ' ')),
      escapeCSV(task.priority),
      escapeCSV(location),
      escapeCSV(task.description),
      escapeCSV(suggestedFix),
      escapeCSV(task.expectedImpact || ''),
      task.isSelected ? 'Selected' : 'Ignored',
    ]);
  }
  
  // Summary section
  const selectedCount = tasks.filter(t => t.isSelected).length;
  const highCount = tasks.filter(t => t.priority === 'high').length;
  const mediumCount = tasks.filter(t => t.priority === 'medium').length;
  const lowCount = tasks.filter(t => t.priority === 'low').length;
  
  rows.push([]); // Empty row
  rows.push(['SUMMARY']);
  rows.push(['Total Tasks', String(tasks.length)]);
  rows.push(['Selected', String(selectedCount)]);
  rows.push(['Ignored', String(tasks.length - selectedCount)]);
  rows.push(['High Priority', String(highCount)]);
  rows.push(['Medium Priority', String(mediumCount)]);
  rows.push(['Low Priority', String(lowCount)]);
  
  return rows.map(row => row.join(',')).join('\n');
}

/**
 * Download architecture tasks as CSV
 */
export function downloadArchitectureTasksCSV(
  tasks: ArchitectureTask[],
  filename?: string
): void {
  const csv = generateArchitectureTasksCSV(tasks);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `architecture-tasks-${new Date().toISOString().split('T')[0]}.csv`;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
