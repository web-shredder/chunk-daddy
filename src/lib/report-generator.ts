import type { FullOptimizationResult, ValidatedChunk, ChangeExplanation, FurtherOptimizationSuggestion, TradeOffConsideration } from './optimizer-types';

interface ReportGeneratorInput {
  projectName?: string;
  originalContent: string;
  optimizedContent: string;
  optimizationResult: FullOptimizationResult;
  keywords: string[];
  stats: {
    originalWordCount: number;
    optimizedWordCount: number;
    wordCountDiff: number;
    chunksOptimized: number;
    totalChanges: number;
    queriesTargeted: number;
    overallOriginalAvg: number;
    overallOptimizedAvg: number;
    overallPercentChange: number;
    timestamp: number | Date;
  };
  chunkImprovements: Array<{
    chunk: ValidatedChunk;
    avgOriginal: number;
    avgOptimized: number;
    improvement: number;
    changeCount: number;
  }>;
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function formatSection(title: string): string {
  const line = '-'.repeat(80);
  return `\n${line}\n${title.toUpperCase().padStart(40 + title.length / 2).padEnd(80)}\n${line}\n`;
}

export function generateFormalTextReport(input: ReportGeneratorInput): string {
  const { projectName, originalContent, optimizedContent, optimizationResult, keywords, stats, chunkImprovements } = input;
  const lines: string[] = [];
  const divider = '='.repeat(80);

  // Header
  lines.push(divider);
  lines.push('CONTENT OPTIMIZATION REPORT'.padStart(53).padEnd(80));
  lines.push(divider);
  lines.push('');
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  if (projectName) {
    lines.push(`Project: ${projectName}`);
  }
  lines.push('');

  // Executive Summary
  lines.push(formatSection('Executive Summary'));
  lines.push('');
  lines.push('This report summarizes the automated content optimization performed to improve');
  lines.push('retrieval performance for AI search and RAG (Retrieval-Augmented Generation)');
  lines.push('systems.');
  lines.push('');
  lines.push('RESULTS AT A GLANCE:');
  lines.push(`  • Original Passage Score:  ${stats.overallOriginalAvg.toFixed(1)} (average)`);
  lines.push(`  • Optimized Passage Score: ${stats.overallOptimizedAvg.toFixed(1)} (average)`);
  lines.push(`  • Improvement:             ${stats.overallPercentChange >= 0 ? '+' : ''}${stats.overallPercentChange.toFixed(1)}%`);
  lines.push('');
  lines.push(`  • Content Length:          ${stats.originalWordCount} → ${stats.optimizedWordCount} words (${stats.wordCountDiff >= 0 ? '+' : ''}${stats.wordCountDiff} words)`);
  lines.push(`  • Chunks Optimized:        ${stats.chunksOptimized}`);
  lines.push(`  • Changes Applied:         ${stats.totalChanges} total`);
  lines.push(`  • Queries Targeted:        ${stats.queriesTargeted}`);
  lines.push('');

  // Scoring Methodology
  lines.push(formatSection('Scoring Methodology'));
  lines.push('');
  lines.push('Passage Score is a composite metric combining:');
  lines.push('  • Cosine Similarity (70%): Measures semantic alignment between content and');
  lines.push('    queries using embedding vectors.');
  lines.push('  • Chamfer Similarity (30%): Measures bidirectional coverage to ensure both');
  lines.push('    query terms appear in content and content terms align with query intent.');
  lines.push('');
  lines.push('Score Tiers:');
  lines.push('  • 80-100: Excellent - High retrieval confidence');
  lines.push('  • 65-79:  Good - Reliable retrieval');
  lines.push('  • 50-64:  Moderate - May require context or ranking boost');
  lines.push('  • 40-49:  Weak - Low retrieval likelihood');
  lines.push('  • 0-39:   Poor - Unlikely to be retrieved');
  lines.push('');

  // Queries Targeted
  lines.push(formatSection('Queries Targeted'));
  lines.push('');
  keywords.forEach((keyword, idx) => {
    lines.push(`  ${(idx + 1).toString().padStart(2)}. ${keyword}`);
  });
  lines.push('');

  // Chunk-by-Chunk Analysis
  lines.push(formatSection('Chunk-by-Chunk Analysis'));
  lines.push('');

  chunkImprovements.forEach((item, idx) => {
    lines.push(`CHUNK ${item.chunk.chunk_number}: ${item.chunk.heading || '(No heading)'}`);
    lines.push(`  Original Score:  ${item.avgOriginal.toFixed(1)}`);
    lines.push(`  Optimized Score: ${item.avgOptimized.toFixed(1)}`);
    lines.push(`  Improvement:     ${item.improvement >= 0 ? '+' : ''}${item.improvement.toFixed(1)}%`);
    lines.push('');
    
    if (item.chunk.changes_applied.length > 0) {
      lines.push('  Changes Applied:');
      item.chunk.changes_applied.forEach((change, changeIdx) => {
        const explanation = optimizationResult.explanations.find(
          e => e.change_id === change.change_id
        );
        lines.push(`    ${changeIdx + 1}. [${change.change_type.replace('_', ' ').toUpperCase()}] ${change.reason}`);
        if (explanation) {
          const wrappedImpact = wrapText(explanation.impact_summary, 65);
          wrappedImpact.forEach((line, i) => {
            lines.push(`       ${i === 0 ? '→ ' : '  '}${line}`);
          });
        }
      });
      lines.push('');
    }

    // Text excerpt
    const excerpt = item.chunk.optimized_text.slice(0, 200).replace(/\n/g, ' ');
    lines.push('  [Excerpt of optimized text...]');
    const wrappedExcerpt = wrapText(excerpt + (item.chunk.optimized_text.length > 200 ? '...' : ''), 70);
    wrappedExcerpt.forEach(line => {
      lines.push(`  ${line}`);
    });
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  // Further Recommendations
  const suggestions = optimizationResult.summary?.furtherSuggestions;
  if (suggestions && suggestions.length > 0) {
    lines.push(formatSection('Further Recommendations'));
    lines.push('');
    lines.push('The following additional optimizations are suggested for continued improvement:');
    lines.push('');
    suggestions.forEach((suggestion, idx) => {
      lines.push(`  ${idx + 1}. [${suggestion.expectedImpact.toUpperCase()} IMPACT]: ${suggestion.suggestion}`);
      const wrappedReasoning = wrapText(suggestion.reasoning, 65);
      wrappedReasoning.forEach((line, i) => {
        lines.push(`     ${i === 0 ? '' : ''}${line}`);
      });
      lines.push('');
    });
  }

  // Trade-off Considerations
  const tradeoffs = optimizationResult.summary?.tradeOffConsiderations;
  if (tradeoffs && tradeoffs.length > 0) {
    lines.push(formatSection('Trade-off Considerations'));
    lines.push('');
    tradeoffs.forEach((tradeoff, idx) => {
      lines.push(`  • [${tradeoff.category.toUpperCase()}] (${tradeoff.severity}): ${tradeoff.concern}`);
      lines.push('');
    });
  }

  // Optimized Content
  lines.push(formatSection('Optimized Content'));
  lines.push('');
  lines.push(optimizedContent);
  lines.push('');

  // Footer
  lines.push(divider);
  lines.push('END OF REPORT'.padStart(46).padEnd(80));
  lines.push(divider);

  return lines.join('\n');
}
