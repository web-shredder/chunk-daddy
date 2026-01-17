import type { AnalysisResult, ChunkScore } from '@/hooks/useAnalysis';
import { calculatePassageScore } from '@/lib/similarity';

export interface ContentGap {
  query: string;
  intentType: string | null;
  bestMatchChunk: {
    index: number;
    heading: string;
    score: number;
    preview: string;
  } | null;
  allScores: Array<{
    chunkIndex: number;
    heading: string;
    score: number;
  }>;
  diagnosis: string;
  recommendation: string;
}

export function analyzeContentGaps(
  unassignedQueries: string[],
  chunks: Array<{ 
    id: string; 
    text: string; 
    textWithoutCascade?: string;
    headingPath?: string[];
  }>,
  chunkScores: ChunkScore[],
  intentTypes?: Record<string, string>
): ContentGap[] {
  return unassignedQueries.map(query => {
    // Find scores for this query across all chunks
    const chunkScoresForQuery = chunks.map((chunk, idx) => {
      const chunkScore = chunkScores[idx];
      let passageScore = 0;
      
      if (chunkScore) {
        const keywordScore = chunkScore.keywordScores.find(
          ks => ks.keyword.toLowerCase() === query.toLowerCase()
        );
        if (keywordScore) {
          passageScore = calculatePassageScore(keywordScore.scores.cosine, keywordScore.scores.chamfer);
        }
      }
      
      return {
        chunkIndex: idx,
        heading: chunk.headingPath?.[chunk.headingPath.length - 1] || `Chunk ${idx + 1}`,
        score: passageScore,
        preview: (chunk.textWithoutCascade || chunk.text).slice(0, 150),
      };
    }).sort((a, b) => b.score - a.score);
    
    const bestMatch = chunkScoresForQuery[0];
    const intentType = intentTypes?.[query] || null;
    
    // Generate diagnosis based on best score
    let diagnosis: string;
    let recommendation: string;
    
    if (!bestMatch || bestMatch.score < 20) {
      diagnosis = 'No relevant content exists for this topic';
      recommendation = 'Create new section (400-600 words) dedicated to this query';
    } else if (bestMatch.score < 40) {
      diagnosis = 'Content exists but is tangentially related';
      recommendation = 'Either expand existing section or create new dedicated content';
    } else if (bestMatch.score < 60) {
      diagnosis = 'Content partially addresses this query but lacks depth';
      recommendation = 'Consider force-assigning to best match and optimizing heavily';
    } else {
      diagnosis = 'Content exists but scored just below assignment threshold';
      recommendation = 'Force-assign to best match chunk - minor optimization should suffice';
    }
    
    return {
      query,
      intentType,
      bestMatchChunk: bestMatch ? {
        index: bestMatch.chunkIndex,
        heading: bestMatch.heading,
        score: bestMatch.score,
        preview: bestMatch.preview,
      } : null,
      allScores: chunkScoresForQuery.slice(0, 5), // Top 5 matches
      diagnosis,
      recommendation,
    };
  });
}

export function exportGapsAsCSV(gaps: ContentGap[]): string {
  const headers = [
    'Query',
    'Intent Type',
    'Best Match Chunk',
    'Best Match Score',
    'Diagnosis',
    'Recommendation',
    'Best Match Preview'
  ];
  
  const rows = gaps.map(gap => [
    `"${gap.query.replace(/"/g, '""')}"`,
    gap.intentType || 'N/A',
    gap.bestMatchChunk ? `"Chunk ${gap.bestMatchChunk.index + 1}: ${gap.bestMatchChunk.heading.replace(/"/g, '""')}"` : 'None',
    gap.bestMatchChunk?.score?.toString() || '0',
    `"${gap.diagnosis.replace(/"/g, '""')}"`,
    `"${gap.recommendation.replace(/"/g, '""')}"`,
    gap.bestMatchChunk ? `"${gap.bestMatchChunk.preview.replace(/"/g, '""')}..."` : 'N/A',
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function exportGapsAsMarkdown(gaps: ContentGap[], primaryQuery?: string): string {
  const lines: string[] = [
    '# Content Gap Analysis',
    '',
    `**Primary Query:** ${primaryQuery || 'N/A'}`,
    `**Unassigned Queries:** ${gaps.length}`,
    `**Generated:** ${new Date().toLocaleDateString()}`,
    '',
    '---',
    '',
  ];
  
  // Summary section
  lines.push('## Summary');
  lines.push('');
  
  const critical = gaps.filter(g => !g.bestMatchChunk || g.bestMatchChunk.score < 30);
  const moderate = gaps.filter(g => g.bestMatchChunk && g.bestMatchChunk.score >= 30 && g.bestMatchChunk.score < 50);
  const minor = gaps.filter(g => g.bestMatchChunk && g.bestMatchChunk.score >= 50);
  
  lines.push(`- **Critical gaps (need new content):** ${critical.length}`);
  lines.push(`- **Moderate gaps (expand existing):** ${moderate.length}`);
  lines.push(`- **Minor gaps (optimize existing):** ${minor.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Detailed gaps
  lines.push('## Content Gaps Detail');
  lines.push('');
  
  gaps.forEach((gap, idx) => {
    const priority = !gap.bestMatchChunk || gap.bestMatchChunk.score < 30 
      ? '🔴 Critical' 
      : gap.bestMatchChunk.score < 50 
        ? '🟡 Moderate' 
        : '🟢 Minor';
    
    lines.push(`### ${idx + 1}. ${gap.query}`);
    lines.push('');
    lines.push(`**Priority:** ${priority}`);
    if (gap.intentType) {
      lines.push(`**Intent Type:** ${gap.intentType}`);
    }
    lines.push('');
    lines.push(`**Diagnosis:** ${gap.diagnosis}`);
    lines.push('');
    lines.push(`**Recommendation:** ${gap.recommendation}`);
    lines.push('');
    
    if (gap.bestMatchChunk) {
      lines.push('**Best Matching Chunk:**');
      lines.push(`- Chunk ${gap.bestMatchChunk.index + 1}: ${gap.bestMatchChunk.heading}`);
      lines.push(`- Score: ${gap.bestMatchChunk.score}/100`);
      lines.push(`- Preview: "${gap.bestMatchChunk.preview}..."`);
      lines.push('');
    }
    
    if (gap.allScores.length > 1) {
      lines.push('**Other Potential Matches:**');
      gap.allScores.slice(1, 4).forEach(match => {
        lines.push(`- Chunk ${match.chunkIndex + 1} (${match.heading}): Score ${match.score}`);
      });
      lines.push('');
    }
    
    lines.push('---');
    lines.push('');
  });
  
  // Action items checklist
  lines.push('## Action Items Checklist');
  lines.push('');
  
  gaps.forEach((gap) => {
    const action = !gap.bestMatchChunk || gap.bestMatchChunk.score < 30
      ? 'Create new content section'
      : gap.bestMatchChunk.score < 50
        ? 'Expand existing content'
        : 'Force-assign and optimize';
    
    lines.push(`- [ ] **${gap.query}** — ${action}`);
  });
  
  lines.push('');
  
  return lines.join('\n');
}

export function exportGapsAsJSON(gaps: ContentGap[], metadata?: Record<string, unknown>): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    metadata: metadata || {},
    totalGaps: gaps.length,
    gaps,
  }, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
