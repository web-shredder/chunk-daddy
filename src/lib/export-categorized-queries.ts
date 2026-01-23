import { CategorizedVariant, CategoryBreakdown, CategorizationSummary } from './query-categorization';

interface ExportOptions {
  includeOptimization: boolean;
  includeGaps: boolean;
  includeDrift: boolean;
  includeOutOfScope: boolean;
}

export function exportCategorizedQueriesToCSV(
  breakdown: CategoryBreakdown,
  summary: CategorizationSummary,
  primaryQuery: string,
  options: ExportOptions = {
    includeOptimization: true,
    includeGaps: true,
    includeDrift: true,
    includeOutOfScope: true,
  }
): string {
  const headers = [
    'Query',
    'Category',
    'Variant Type',
    'Content Similarity',
    'Passage Score',
    'Best Chunk',
    'Drift Score',
    'Drift Level',
    'Entity Overlap %',
    'Missing Entities',
    'Primary Action',
    'Category Reasoning',
  ];
  
  const rows: string[][] = [];
  
  const addVariants = (variants: CategorizedVariant[], categoryLabel: string) => {
    variants.forEach(v => {
      rows.push([
        `"${v.query.replace(/"/g, '""')}"`,
        categoryLabel,
        v.variantType,
        (v.contentSimilarity * 100).toFixed(1) + '%',
        v.passageScore.toFixed(1),
        v.bestChunkIndex !== null ? `Chunk ${v.bestChunkIndex + 1}` : 'N/A',
        v.intentAnalysis.driftScore.toFixed(0),
        v.intentAnalysis.driftLevel,
        v.entityAnalysis.overlapPercent.toFixed(0) + '%',
        `"${v.entityAnalysis.missingEntities.join(', ')}"`,
        v.actionable.primaryAction,
        `"${v.categoryReasoning.replace(/"/g, '""')}"`,
      ]);
    });
  };
  
  if (options.includeOptimization) {
    addVariants(breakdown.optimizationOpportunities, 'Optimization Opportunity');
  }
  if (options.includeGaps) {
    addVariants(breakdown.contentGaps, 'Content Gap');
  }
  if (options.includeDrift) {
    addVariants(breakdown.intentDrift, 'Intent Drift');
  }
  if (options.includeOutOfScope) {
    addVariants(breakdown.outOfScope, 'Out of Scope');
  }
  
  // Add summary section
  const summaryRows = [
    [],
    ['SUMMARY'],
    ['Primary Query', `"${primaryQuery}"`],
    ['Total Variants', summary.total.toString()],
    ['Optimization Opportunities', summary.byCategory.optimization.toString()],
    ['Content Gaps', summary.byCategory.gaps.toString()],
    ['Intent Drift', summary.byCategory.drift.toString()],
    ['Out of Scope', summary.byCategory.outOfScope.toString()],
    [],
    ['AVERAGE SCORES'],
    ['Content Similarity', (summary.averageScores.contentSimilarity * 100).toFixed(1) + '%'],
    ['Passage Score', summary.averageScores.passageScore.toFixed(1)],
    ['Drift Score', summary.averageScores.driftScore.toFixed(1)],
  ];
  
  const csv = [
    headers.join(','),
    ...rows.map(r => r.join(',')),
    ...summaryRows.map(r => r.join(',')),
  ].join('\n');
  
  return csv;
}

export function downloadCategorizedQueriesCSV(
  breakdown: CategoryBreakdown,
  summary: CategorizationSummary,
  primaryQuery: string,
  filename: string = 'categorized-queries.csv'
) {
  const csv = exportCategorizedQueriesToCSV(breakdown, summary, primaryQuery);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
