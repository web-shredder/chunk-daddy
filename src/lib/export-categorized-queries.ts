import { CategorizedVariant, CategoryBreakdown, CategorizationSummary, CATEGORY_META } from './query-categorization';

export interface ExportOptions {
  // Category filters
  includeOptimization: boolean;
  includeGaps: boolean;
  includeDrift: boolean;
  includeOutOfScope: boolean;
  // Column filters
  includeScores: boolean;
  includeIntentAnalysis: boolean;
  includeEntityAnalysis: boolean;
  includeActionInfo: boolean;
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeOptimization: true,
  includeGaps: true,
  includeDrift: true,
  includeOutOfScope: true,
  includeScores: true,
  includeIntentAnalysis: true,
  includeEntityAnalysis: true,
  includeActionInfo: true,
};

function getFilteredVariants(breakdown: CategoryBreakdown, options: ExportOptions): CategorizedVariant[] {
  const variants: CategorizedVariant[] = [];
  if (options.includeOptimization) variants.push(...breakdown.optimizationOpportunities);
  if (options.includeGaps) variants.push(...breakdown.contentGaps);
  if (options.includeDrift) variants.push(...breakdown.intentDrift);
  if (options.includeOutOfScope) variants.push(...breakdown.outOfScope);
  return variants;
}

export function exportCategorizedQueriesToCSV(
  breakdown: CategoryBreakdown,
  summary: CategorizationSummary,
  primaryQuery: string,
  options: ExportOptions = DEFAULT_OPTIONS
): string {
  // Build dynamic headers based on column filters
  const headers: string[] = ['Query', 'Category', 'Variant Type'];
  
  if (options.includeScores) {
    headers.push('Content Similarity', 'Passage Score', 'Best Chunk');
  }
  if (options.includeIntentAnalysis) {
    headers.push('Drift Score', 'Drift Level');
  }
  if (options.includeEntityAnalysis) {
    headers.push('Entity Overlap %', 'Missing Entities');
  }
  if (options.includeActionInfo) {
    headers.push('Primary Action', 'Category Reasoning');
  }
  
  const rows: string[][] = [];
  
  const addVariant = (v: CategorizedVariant, categoryLabel: string) => {
    const row: string[] = [
      `"${v.query.replace(/"/g, '""')}"`,
      categoryLabel,
      v.variantType,
    ];
    
    if (options.includeScores) {
      row.push(
        (v.contentSimilarity * 100).toFixed(1) + '%',
        v.passageScore.toFixed(1),
        v.bestChunkIndex !== null ? `Chunk ${v.bestChunkIndex + 1}` : 'N/A'
      );
    }
    if (options.includeIntentAnalysis) {
      row.push(
        v.intentAnalysis.driftScore.toFixed(0),
        v.intentAnalysis.driftLevel
      );
    }
    if (options.includeEntityAnalysis) {
      row.push(
        v.entityAnalysis.overlapPercent.toFixed(0) + '%',
        `"${v.entityAnalysis.missingEntities.join(', ')}"`
      );
    }
    if (options.includeActionInfo) {
      row.push(
        v.actionable.primaryAction,
        `"${v.categoryReasoning.replace(/"/g, '""')}"`
      );
    }
    
    rows.push(row);
  };
  
  if (options.includeOptimization) {
    breakdown.optimizationOpportunities.forEach(v => addVariant(v, 'Optimization Opportunity'));
  }
  if (options.includeGaps) {
    breakdown.contentGaps.forEach(v => addVariant(v, 'Content Gap'));
  }
  if (options.includeDrift) {
    breakdown.intentDrift.forEach(v => addVariant(v, 'Intent Drift'));
  }
  if (options.includeOutOfScope) {
    breakdown.outOfScope.forEach(v => addVariant(v, 'Out of Scope'));
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

export function exportCategorizedQueriesAsMarkdown(
  breakdown: CategoryBreakdown,
  summary: CategorizationSummary,
  primaryQuery: string,
  options: ExportOptions = DEFAULT_OPTIONS
): string {
  const lines: string[] = [];
  
  lines.push(`# Query Categorization Report`);
  lines.push('');
  lines.push(`**Primary Query:** ${primaryQuery}`);
  lines.push(`**Total Variants:** ${summary.total}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');
  
  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push('| Category | Count | Percentage |');
  lines.push('|----------|-------|------------|');
  lines.push(`| Optimization Opportunities | ${summary.byCategory.optimization} | ${((summary.byCategory.optimization / summary.total) * 100).toFixed(1)}% |`);
  lines.push(`| Content Gaps | ${summary.byCategory.gaps} | ${((summary.byCategory.gaps / summary.total) * 100).toFixed(1)}% |`);
  lines.push(`| Intent Drift | ${summary.byCategory.drift} | ${((summary.byCategory.drift / summary.total) * 100).toFixed(1)}% |`);
  lines.push(`| Out of Scope | ${summary.byCategory.outOfScope} | ${((summary.byCategory.outOfScope / summary.total) * 100).toFixed(1)}% |`);
  lines.push('');
  
  lines.push('### Average Scores');
  lines.push('');
  lines.push(`- **Content Similarity:** ${(summary.averageScores.contentSimilarity * 100).toFixed(1)}%`);
  lines.push(`- **Passage Score:** ${summary.averageScores.passageScore.toFixed(1)}`);
  lines.push(`- **Drift Score:** ${summary.averageScores.driftScore.toFixed(1)}`);
  lines.push('');
  
  const addCategorySection = (
    title: string,
    variants: CategorizedVariant[],
    emoji: string
  ) => {
    if (variants.length === 0) return;
    
    lines.push(`## ${emoji} ${title} (${variants.length})`);
    lines.push('');
    
    variants.forEach((v, idx) => {
      lines.push(`### ${idx + 1}. ${v.query}`);
      lines.push('');
      lines.push(`**Type:** ${v.variantType}`);
      
      if (options.includeScores) {
        lines.push(`**Scores:** Similarity ${(v.contentSimilarity * 100).toFixed(0)}% | Passage ${v.passageScore.toFixed(0)} | Best Chunk: ${v.bestChunkIndex !== null ? `#${v.bestChunkIndex + 1}` : 'N/A'}`);
      }
      if (options.includeIntentAnalysis) {
        lines.push(`**Intent:** Drift ${v.intentAnalysis.driftScore.toFixed(0)} (${v.intentAnalysis.driftLevel})`);
      }
      if (options.includeEntityAnalysis && v.entityAnalysis.missingEntities.length > 0) {
        lines.push(`**Missing Entities:** ${v.entityAnalysis.missingEntities.join(', ')}`);
      }
      if (options.includeActionInfo) {
        lines.push(`**Action:** ${v.actionable.primaryAction.replace(/_/g, ' ')}`);
        lines.push(`> ${v.categoryReasoning}`);
      }
      lines.push('');
    });
  };
  
  if (options.includeOptimization) {
    addCategorySection('Optimization Opportunities', breakdown.optimizationOpportunities, '✅');
  }
  if (options.includeGaps) {
    addCategorySection('Content Gaps', breakdown.contentGaps, '📝');
  }
  if (options.includeDrift) {
    addCategorySection('Intent Drift', breakdown.intentDrift, '⚠️');
  }
  if (options.includeOutOfScope) {
    addCategorySection('Out of Scope', breakdown.outOfScope, '🚫');
  }
  
  return lines.join('\n');
}

export function exportCategorizedQueriesAsJSON(
  breakdown: CategoryBreakdown,
  summary: CategorizationSummary,
  primaryQuery: string,
  options: ExportOptions = DEFAULT_OPTIONS
): string {
  const filteredBreakdown: Record<string, CategorizedVariant[]> = {};
  
  if (options.includeOptimization) {
    filteredBreakdown.optimizationOpportunities = breakdown.optimizationOpportunities;
  }
  if (options.includeGaps) {
    filteredBreakdown.contentGaps = breakdown.contentGaps;
  }
  if (options.includeDrift) {
    filteredBreakdown.intentDrift = breakdown.intentDrift;
  }
  if (options.includeOutOfScope) {
    filteredBreakdown.outOfScope = breakdown.outOfScope;
  }
  
  // Optionally strip columns from variants
  const stripColumns = (variants: CategorizedVariant[]): unknown[] => {
    return variants.map(v => {
      const stripped: Record<string, unknown> = {
        query: v.query,
        category: v.category,
        variantType: v.variantType,
      };
      
      if (options.includeScores) {
        stripped.contentSimilarity = v.contentSimilarity;
        stripped.passageScore = v.passageScore;
        stripped.bestChunkIndex = v.bestChunkIndex;
      }
      if (options.includeIntentAnalysis) {
        stripped.intentAnalysis = v.intentAnalysis;
      }
      if (options.includeEntityAnalysis) {
        stripped.entityAnalysis = v.entityAnalysis;
      }
      if (options.includeActionInfo) {
        stripped.actionable = v.actionable;
        stripped.categoryReasoning = v.categoryReasoning;
      }
      
      return stripped;
    });
  };
  
  const exportData = {
    metadata: {
      primaryQuery,
      exportedAt: new Date().toISOString(),
      options,
    },
    summary,
    breakdown: Object.fromEntries(
      Object.entries(filteredBreakdown).map(([key, variants]) => [
        key,
        stripColumns(variants),
      ])
    ),
  };
  
  return JSON.stringify(exportData, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadCategorizedQueriesCSV(
  breakdown: CategoryBreakdown,
  summary: CategorizationSummary,
  primaryQuery: string,
  filename: string = 'categorized-queries.csv'
): void {
  const csv = exportCategorizedQueriesToCSV(breakdown, summary, primaryQuery);
  downloadFile(csv, filename, 'text/csv');
}
