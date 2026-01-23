// CSV Export utility for Chunk Daddy results

import type { AnalysisResult } from '@/hooks/useAnalysis';
import type { ArchitectureAnalysis, ArchitectureTask } from '@/lib/optimizer-types';

/**
 * Escape CSV field value
 */
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ============================================================
// QUERY INTELLIGENCE EXPORT TYPES
// ============================================================

interface QueryIntelligenceExportData {
  detectedTopic: {
    primaryEntity: string;
    entityType: string;
    contentPurpose: string;
    targetAction: string;
    confidence: number;
    alternativeInterpretations?: Array<{
      entity: string;
      confidence: number;
      reason: string;
    }>;
  };
  primaryQuery: {
    query: string;
    searchIntent: string;
    confidence: number;
    reasoning: string;
    variants?: Array<{ query: string; popularity: string }>;
  } | null;
  intelligence: {
    contentType?: string;
    primaryAudience?: { role: string; expertiseLevel: string; intent: string };
    topicHierarchy?: { broadCategory: string; specificNiche: string; exactFocus: string };
    coreEntities?: Array<{ name: string; type: string; role: string; isExplained: boolean; mentionCount: number }>;
    semanticClusters?: Array<{ clusterName: string; concepts: string[]; coverageDepth: string }>;
    implicitKnowledge?: string[];
  } | null;
  suggestions: Array<{
    query: string;
    intentType?: string;
    matchStrength?: 'strong' | 'partial' | 'weak';
    matchReason?: string;
    relevantSection?: string | null;
    confidence?: number;
    variantType?: string;
    intentScore?: number;
    intentCategory?: string;
  }>;
  gaps: Array<{
    gapType: string;
    query: string;
    intentType: string;
    severity: 'critical' | 'important' | 'nice-to-have';
    reason: string;
    suggestedFix: string;
    relatedEntities: string[];
    estimatedEffort?: string;
  }>;
}

/**
 * Generate comprehensive CSV for Query Intelligence analysis
 */
export function generateQueryIntelligenceCSV(data: QueryIntelligenceExportData): string {
  const rows: string[][] = [];

  // =============== SECTION 1: TOPIC ANALYSIS ===============
  rows.push(['=== TOPIC ANALYSIS ===']);
  rows.push(['Primary Entity', escapeCSV(data.detectedTopic.primaryEntity)]);
  rows.push(['Entity Type', escapeCSV(data.detectedTopic.entityType)]);
  rows.push(['Content Purpose', escapeCSV(data.detectedTopic.contentPurpose)]);
  rows.push(['Target Action', escapeCSV(data.detectedTopic.targetAction)]);
  rows.push(['Detection Confidence', `${Math.round(data.detectedTopic.confidence * 100)}%`]);
  rows.push([]);

  // Alternative interpretations
  if (data.detectedTopic.alternativeInterpretations?.length) {
    rows.push(['Alternative Interpretations']);
    rows.push(['Entity', 'Confidence', 'Reason']);
    for (const alt of data.detectedTopic.alternativeInterpretations) {
      rows.push([
        escapeCSV(alt.entity),
        `${Math.round(alt.confidence * 100)}%`,
        escapeCSV(alt.reason),
      ]);
    }
    rows.push([]);
  }

  // =============== SECTION 2: PRIMARY QUERY ===============
  if (data.primaryQuery) {
    rows.push(['=== PRIMARY QUERY ===']);
    rows.push(['Query', escapeCSV(data.primaryQuery.query)]);
    rows.push(['Search Intent', escapeCSV(data.primaryQuery.searchIntent)]);
    rows.push(['Confidence', `${Math.round(data.primaryQuery.confidence * 100)}%`]);
    rows.push(['Reasoning', escapeCSV(data.primaryQuery.reasoning)]);
    
    if (data.primaryQuery.variants?.length) {
      rows.push([]);
      rows.push(['Query Variants']);
      rows.push(['Variant Query', 'Relative Popularity']);
      for (const v of data.primaryQuery.variants) {
        rows.push([escapeCSV(v.query), escapeCSV(v.popularity)]);
      }
    }
    rows.push([]);
  }

  // =============== SECTION 3: CONTENT INTELLIGENCE ===============
  if (data.intelligence) {
    rows.push(['=== CONTENT INTELLIGENCE ===']);
    if (data.intelligence.contentType) {
      rows.push(['Content Type', escapeCSV(data.intelligence.contentType)]);
    }
    rows.push([]);
    
    // Audience
    if (data.intelligence.primaryAudience) {
      rows.push(['Target Audience']);
      rows.push(['Role', escapeCSV(data.intelligence.primaryAudience.role)]);
      rows.push(['Expertise Level', escapeCSV(data.intelligence.primaryAudience.expertiseLevel)]);
      rows.push(['Intent', escapeCSV(data.intelligence.primaryAudience.intent)]);
      rows.push([]);
    }
    
    // Topic Hierarchy
    if (data.intelligence.topicHierarchy) {
      rows.push(['Topic Hierarchy']);
      rows.push(['Broad Category', escapeCSV(data.intelligence.topicHierarchy.broadCategory)]);
      rows.push(['Specific Niche', escapeCSV(data.intelligence.topicHierarchy.specificNiche)]);
      rows.push(['Exact Focus', escapeCSV(data.intelligence.topicHierarchy.exactFocus)]);
      rows.push([]);
    }
    
    // Core Entities
    if (data.intelligence.coreEntities?.length) {
      rows.push(['Core Entities']);
      rows.push(['Entity Name', 'Type', 'Role', 'Is Explained', 'Mention Count']);
      for (const entity of data.intelligence.coreEntities) {
        rows.push([
          escapeCSV(entity.name),
          escapeCSV(entity.type),
          escapeCSV(entity.role),
          entity.isExplained ? 'Yes' : 'No',
          String(entity.mentionCount),
        ]);
      }
      rows.push([]);
    }
    
    // Semantic Clusters
    if (data.intelligence.semanticClusters?.length) {
      rows.push(['Semantic Clusters']);
      rows.push(['Cluster Name', 'Concepts', 'Coverage Depth']);
      for (const cluster of data.intelligence.semanticClusters) {
        rows.push([
          escapeCSV(cluster.clusterName),
          escapeCSV(cluster.concepts.join('; ')),
          escapeCSV(cluster.coverageDepth),
        ]);
      }
      rows.push([]);
    }
    
    // Implicit Knowledge
    if (data.intelligence.implicitKnowledge?.length) {
      rows.push(['Implicit Knowledge Assumptions']);
      for (const knowledge of data.intelligence.implicitKnowledge) {
        rows.push([escapeCSV(knowledge)]);
      }
      rows.push([]);
    }
  }

  // =============== SECTION 4: QUERY SUGGESTIONS ===============
  rows.push(['=== QUERY SUGGESTIONS ===']);
  rows.push([
    'Query',
    'Intent Type',
    'Match Strength',
    'Match Reason',
    'Relevant Section',
    'Confidence',
  ]);
  for (const suggestion of data.suggestions) {
    rows.push([
      escapeCSV(suggestion.query),
      escapeCSV(suggestion.intentType),
      escapeCSV(suggestion.matchStrength),
      escapeCSV(suggestion.matchReason),
      escapeCSV(suggestion.relevantSection || 'N/A'),
      `${Math.round(suggestion.confidence * 100)}%`,
    ]);
  }
  rows.push([]);

  // =============== SECTION 5: COVERAGE GAPS ===============
  rows.push(['=== COVERAGE GAPS ===']);
  rows.push([
    'Query',
    'Gap Type',
    'Intent Type',
    'Severity',
    'Reason',
    'Suggested Fix',
    'Related Entities',
    'Estimated Effort',
  ]);
  for (const gap of data.gaps) {
    rows.push([
      escapeCSV(gap.query),
      escapeCSV(gap.gapType.replace(/_/g, ' ')),
      escapeCSV(gap.intentType),
      escapeCSV(gap.severity),
      escapeCSV(gap.reason),
      escapeCSV(gap.suggestedFix),
      escapeCSV(gap.relatedEntities.join('; ')),
      escapeCSV(gap.estimatedEffort || 'N/A'),
    ]);
  }
  rows.push([]);

  // =============== SECTION 6: SUMMARY STATISTICS ===============
  const strongCount = data.suggestions.filter(s => s.matchStrength === 'strong').length;
  const partialCount = data.suggestions.filter(s => s.matchStrength === 'partial').length;
  const weakCount = data.suggestions.filter(s => s.matchStrength === 'weak').length;
  const criticalGaps = data.gaps.filter(g => g.severity === 'critical').length;
  const importantGaps = data.gaps.filter(g => g.severity === 'important').length;
  
  // Intent distribution
  const intentCounts: Record<string, number> = {};
  data.suggestions.forEach(s => {
    intentCounts[s.intentType] = (intentCounts[s.intentType] || 0) + 1;
  });

  rows.push(['=== SUMMARY ===']);
  rows.push(['Total Suggestions', String(data.suggestions.length)]);
  rows.push(['Strong Matches', String(strongCount)]);
  rows.push(['Partial Matches', String(partialCount)]);
  rows.push(['Weak Matches', String(weakCount)]);
  rows.push(['Total Gaps', String(data.gaps.length)]);
  rows.push(['Critical Gaps', String(criticalGaps)]);
  rows.push(['Important Gaps', String(importantGaps)]);
  rows.push([]);
  rows.push(['Intent Distribution']);
  for (const [intent, count] of Object.entries(intentCounts).sort((a, b) => b[1] - a[1])) {
    rows.push([escapeCSV(intent), String(count), `${Math.round((count / data.suggestions.length) * 100)}%`]);
  }

  return rows.map(row => row.join(',')).join('\n');
}

/**
 * Download Query Intelligence analysis as CSV
 */
export function downloadQueryIntelligenceCSV(
  data: QueryIntelligenceExportData,
  topicName?: string
): void {
  const csv = generateQueryIntelligenceCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const safeName = (topicName || 'query-intelligence')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 50);
  const filename = `${safeName}-${new Date().toISOString().split('T')[0]}.csv`;

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
    // Handle location differently for content_gap vs other types
    let location: string;
    if (task.type === 'content_gap') {
      location = task.location?.position || 'N/A';
    } else {
      location = task.location?.chunkIndex !== undefined
        ? `Chunk ${task.location.chunkIndex + 1}${task.location.position ? ` (${task.location.position})` : ''}`
        : task.location?.position || 'N/A';
    }
    
    // Handle suggested fix - for content_gap, include the suggested heading
    let suggestedFix: string;
    if (task.type === 'content_gap' && task.details?.suggestedHeading) {
      suggestedFix = `## ${task.details.suggestedHeading}`;
    } else {
      suggestedFix = task.details?.after 
        || task.details?.suggestedHeading 
        || task.details?.before 
        || '';
    }
    
    rows.push([
      escapeCSV(task.type === 'content_gap' ? 'content gap' : task.type.replace(/_/g, ' ')),
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
  const structureCount = tasks.filter(t => t.type !== 'content_gap').length;
  const gapCount = tasks.filter(t => t.type === 'content_gap').length;
  
  rows.push([]); // Empty row
  rows.push(['SUMMARY']);
  rows.push(['Total Tasks', String(tasks.length)]);
  rows.push(['Selected', String(selectedCount)]);
  rows.push(['Ignored', String(tasks.length - selectedCount)]);
  rows.push(['Structural Issues', String(structureCount)]);
  rows.push(['Content Gaps', String(gapCount)]);
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
