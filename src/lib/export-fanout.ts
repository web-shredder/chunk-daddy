export interface FanoutExportQuery {
  id: string;
  query: string;
  level: number;
  parentId: string | null;
  parentQuery?: string;
  aspectAnswered?: string;
  intentType?: string;
  isSelected: boolean;
  // After analysis
  score?: number;
  assignedChunkIndex?: number | null;
  assignedChunkHeading?: string;
}

export function exportFanoutAsCSV(
  queries: FanoutExportQuery[],
  primaryQuery: string
): string {
  const headers = [
    'Level',
    'Query',
    'Aspect/Intent',
    'Parent Query',
    'Selected',
    'Score',
    'Assigned Chunk',
  ];
  
  const rows = queries.map(q => [
    `L${q.level}`,
    `"${q.query.replace(/"/g, '""')}"`,
    q.aspectAnswered || q.intentType || '',
    q.parentQuery ? `"${q.parentQuery.replace(/"/g, '""')}"` : '(root)',
    q.isSelected ? 'Yes' : 'No',
    q.score !== undefined ? q.score.toString() : '',
    q.assignedChunkIndex !== null && q.assignedChunkIndex !== undefined
      ? `Chunk ${q.assignedChunkIndex + 1}${q.assignedChunkHeading ? ` (${q.assignedChunkHeading})` : ''}`
      : 'Unassigned',
  ]);
  
  return [
    `# Primary Query: "${primaryQuery}"`,
    `# Exported: ${new Date().toLocaleString()}`,
    `# Total Queries: ${queries.length}`,
    '',
    headers.join(','),
    ...rows.map(r => r.join(',')),
  ].join('\n');
}

export function exportFanoutAsMarkdown(
  queries: FanoutExportQuery[],
  primaryQuery: string
): string {
  const lines: string[] = [
    '# Query Fanout Export',
    '',
    `**Primary Query:** ${primaryQuery}`,
    `**Total Queries:** ${queries.length}`,
    `**Selected:** ${queries.filter(q => q.isSelected).length}`,
    `**Exported:** ${new Date().toLocaleString()}`,
    '',
    '---',
    '',
  ];
  
  // Group by level
  const maxLevel = Math.max(...queries.map(q => q.level));
  
  for (let level = 0; level <= maxLevel; level++) {
    const levelQueries = queries.filter(q => q.level === level);
    if (levelQueries.length === 0) continue;
    
    lines.push(`## Level ${level}${level === 0 ? ' (Primary)' : ''}`);
    lines.push('');
    
    levelQueries.forEach(q => {
      const checkbox = q.isSelected ? '[x]' : '[ ]';
      const scoreStr = q.score !== undefined ? ` (Score: ${q.score})` : '';
      const aspectStr = q.aspectAnswered ? ` — *${q.aspectAnswered}*` : '';
      
      lines.push(`- ${checkbox} ${q.query}${aspectStr}${scoreStr}`);
      
      if (q.assignedChunkIndex !== null && q.assignedChunkIndex !== undefined) {
        lines.push(`  - → Assigned to Chunk ${q.assignedChunkIndex + 1}${q.assignedChunkHeading ? ` (${q.assignedChunkHeading})` : ''}`);
      }
    });
    
    lines.push('');
  }
  
  // Tree structure section
  lines.push('---');
  lines.push('');
  lines.push('## Tree Structure');
  lines.push('');
  lines.push('```');
  
  const printTree = (parentId: string | null, indent: string) => {
    const children = queries.filter(q => q.parentId === parentId);
    children.forEach((q, idx) => {
      const isLast = idx === children.length - 1;
      const prefix = indent + (isLast ? '└── ' : '├── ');
      const selected = q.isSelected ? '✓' : '○';
      lines.push(`${prefix}[${selected}] L${q.level}: ${q.query.slice(0, 60)}${q.query.length > 60 ? '...' : ''}`);
      printTree(q.id, indent + (isLast ? '    ' : '│   '));
    });
  };
  
  // Start with root (level 0)
  const root = queries.find(q => q.level === 0);
  if (root) {
    lines.push(`[✓] L0: ${root.query}`);
    printTree(root.id, '');
  }
  
  lines.push('```');
  lines.push('');
  
  return lines.join('\n');
}

export function exportFanoutAsJSON(
  queries: FanoutExportQuery[],
  primaryQuery: string
): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    primaryQuery,
    totalQueries: queries.length,
    selectedQueries: queries.filter(q => q.isSelected).length,
    maxDepth: Math.max(...queries.map(q => q.level)),
    queries: queries.map(q => ({
      id: q.id,
      query: q.query,
      level: q.level,
      parentId: q.parentId,
      aspectAnswered: q.aspectAnswered,
      intentType: q.intentType,
      isSelected: q.isSelected,
      score: q.score,
      assignedChunkIndex: q.assignedChunkIndex,
    })),
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
