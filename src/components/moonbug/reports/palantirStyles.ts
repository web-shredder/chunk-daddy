import { StyleSheet, Font } from '@react-pdf/renderer';

// Register fonts - using system fonts that @react-pdf supports
// Note: For production, you'd want to host and register Inter + JetBrains Mono

// Palantir-inspired color palette
export const COLORS = {
  bgPrimary: '#0d1117',
  bgSecondary: '#161b22',
  bgTertiary: '#21262d',
  border: '#30363d',
  textPrimary: '#e6edf3',
  textSecondary: '#8b949e',
  textMuted: '#6e7681',
  accentCyan: '#00d4ff',
  accentGreen: '#3fb950',
  accentYellow: '#d29922',
  accentRed: '#f85149',
  accentPurple: '#a371f7',
  accentBlue: '#58a6ff',
} as const;

// Shared styles for PDF components
export const styles = StyleSheet.create({
  // Page layouts
  page: {
    backgroundColor: COLORS.bgPrimary,
    padding: 40,
    fontFamily: 'Helvetica',
    color: COLORS.textPrimary,
  },
  
  coverPage: {
    backgroundColor: COLORS.bgPrimary,
    padding: 60,
    fontFamily: 'Helvetica',
    color: COLORS.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Headers
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  
  pageTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.textPrimary,
  },
  
  pageNumber: {
    fontSize: 9,
    color: COLORS.textSecondary,
  },
  
  // Section headers
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.textPrimary,
    marginBottom: 8,
    marginTop: 16,
  },
  
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  
  // Cards/boxes
  card: {
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
  },
  
  cardHighlight: {
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.accentCyan,
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
  },
  
  // Text styles
  bodyText: {
    fontSize: 9,
    color: COLORS.textSecondary,
    lineHeight: 1.5,
  },
  
  monoText: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: COLORS.textPrimary,
  },
  
  labelText: {
    fontSize: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.textMuted,
  },
  
  dataText: {
    fontSize: 10,
    fontFamily: 'Courier',
    color: COLORS.textPrimary,
  },
  
  // Metric boxes
  metricGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
    gap: 8,
  },
  
  metricBox: {
    flex: 1,
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 10,
    alignItems: 'center',
  },
  
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Courier',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  
  metricLabel: {
    fontSize: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  
  // Bar charts
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  
  barLabel: {
    width: 100,
    fontSize: 8,
    color: COLORS.textSecondary,
  },
  
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.bgTertiary,
    borderRadius: 2,
    marginHorizontal: 8,
  },
  
  barValue: {
    width: 30,
    fontSize: 8,
    fontFamily: 'Courier',
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  
  // Tables
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgTertiary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  
  tableRowLast: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  
  tableCell: {
    fontSize: 8,
    color: COLORS.textSecondary,
  },
  
  tableCellHeader: {
    fontSize: 7,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.textMuted,
  },
  
  // Tags/badges
  tag: {
    backgroundColor: COLORS.bgTertiary,
    borderRadius: 2,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginRight: 4,
    marginBottom: 4,
  },
  
  tagText: {
    fontSize: 7,
    color: COLORS.textSecondary,
  },
  
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 4,
  },
  
  // Status indicators
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  
  // Gap cards
  gapCard: {
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accentYellow,
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
  },
  
  // Action cards
  actionCard: {
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
  },
  
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  impactBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 2,
    fontSize: 7,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  
  footerText: {
    fontSize: 7,
    color: COLORS.textMuted,
  },
  
  // Cover page specific
  coverLogo: {
    marginBottom: 40,
  },
  
  coverTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 40,
  },
  
  coverDivider: {
    width: 200,
    height: 2,
    backgroundColor: COLORS.accentCyan,
    marginVertical: 20,
  },
  
  coverTopicBox: {
    backgroundColor: COLORS.bgSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 16,
    width: '80%',
    marginBottom: 20,
  },
  
  coverMeta: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
  },
  
  coverMetaItem: {
    alignItems: 'center',
  },
});

// Helper to get color for impact level
export function getImpactColor(impact: 'high' | 'medium' | 'low'): string {
  switch (impact) {
    case 'high': return COLORS.accentRed;
    case 'medium': return COLORS.accentYellow;
    case 'low': return COLORS.accentGreen;
    default: return COLORS.textSecondary;
  }
}

// Helper to get color for priority level
export function getPriorityColor(priority: 'high' | 'moderate' | 'low'): string {
  switch (priority) {
    case 'high': return COLORS.accentRed;
    case 'moderate': return COLORS.accentYellow;
    case 'low': return COLORS.accentGreen;
    default: return COLORS.textSecondary;
  }
}

// Helper to get color for coverage status
export function getCoverageColor(status: 'strong' | 'partial' | 'weak' | 'none'): string {
  switch (status) {
    case 'strong': return COLORS.accentGreen;
    case 'partial': return COLORS.accentYellow;
    case 'weak': return COLORS.accentRed;
    case 'none': return COLORS.textMuted;
    default: return COLORS.textSecondary;
  }
}

// Helper to get variant type abbreviation
export function getVariantTypeAbbr(type: string): string {
  const abbrs: Record<string, string> = {
    'FOLLOW_UP': 'FLW',
    'ENTAILMENT': 'ENT',
    'CLARIFICATION': 'CLR',
    'GENERALIZATION': 'GEN',
    'SPECIFICATION': 'SPC',
    'EQUIVALENT': 'EQV',
    'CANONICALIZATION': 'CAN',
  };
  return abbrs[type] || type.slice(0, 3).toUpperCase();
}

// Helper to get route abbreviation
export function getRouteAbbr(route: string): string {
  const abbrs: Record<string, string> = {
    'web_search': 'WEB',
    'WEB_SEARCH': 'WEB',
    'parametric': 'MEM',
    'PARAMETRIC': 'MEM',
    'hybrid': 'HYB',
    'HYBRID': 'HYB',
  };
  return abbrs[route] || 'WEB';
}
