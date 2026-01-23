import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { styles, COLORS, getImpactColor, getPriorityColor, getCoverageColor, getVariantTypeAbbr, getRouteAbbr } from './palantirStyles';
import type { QueryIntelligenceReportData } from '@/lib/gather-report-data';

interface QueryIntelligenceReportProps {
  data: QueryIntelligenceReportData;
}

// Helper component for horizontal bar
function HorizontalBar({ value, max, color }: { value: number; max: number; color: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={[styles.barTrack]}>
      <View style={{ 
        height: '100%', 
        width: `${Math.min(percentage, 100)}%`, 
        backgroundColor: color,
        borderRadius: 2,
      }} />
    </View>
  );
}

// Helper component for tag/chip
function Tag({ text, color }: { text: string; color?: string }) {
  return (
    <View style={[styles.tag, color ? { borderColor: color, borderWidth: 1 } : {}]}>
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

// Cover Page
function CoverPage({ data }: { data: QueryIntelligenceReportData }) {
  return (
    <Page size="A4" style={styles.coverPage}>
      {/* Logo placeholder */}
      <View style={styles.coverLogo}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: COLORS.accentCyan }}>
          CHUNK DADDY
        </Text>
      </View>
      
      <View style={styles.coverDivider} />
      
      <Text style={styles.coverTitle}>QUERY INTELLIGENCE REPORT</Text>
      
      <View style={styles.coverDivider} />
      
      {/* Detected Topic */}
      {data.detectedTopic && (
        <View style={styles.coverTopicBox}>
          <Text style={[styles.labelText, { marginBottom: 8 }]}>DETECTED TOPIC</Text>
          <Text style={[styles.bodyText, { fontSize: 11, color: COLORS.textPrimary }]}>
            {data.detectedTopic.description}
          </Text>
          
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 16 }}>
            <View>
              <Text style={styles.labelText}>Classification</Text>
              <Text style={[styles.dataText, { textTransform: 'uppercase' }]}>
                {data.detectedTopic.classification}
              </Text>
            </View>
            <View>
              <Text style={styles.labelText}>Intent</Text>
              <Text style={[styles.dataText, { textTransform: 'uppercase' }]}>
                {data.detectedTopic.intent}
              </Text>
            </View>
            <View>
              <Text style={styles.labelText}>Confidence</Text>
              <Text style={styles.dataText}>{data.detectedTopic.confidence}%</Text>
            </View>
          </View>
          
          <View style={{ marginTop: 12 }}>
            <Text style={styles.labelText}>Reader Goal</Text>
            <Text style={styles.bodyText}>{data.detectedTopic.readerGoal}</Text>
          </View>
        </View>
      )}
      
      {/* Meta info */}
      <View style={styles.coverMeta}>
        <View style={styles.coverMetaItem}>
          <Text style={styles.labelText}>Generated</Text>
          <Text style={styles.dataText}>
            {data.generatedAt.toLocaleDateString()} {data.generatedAt.toLocaleTimeString()}
          </Text>
        </View>
        <View style={styles.coverMetaItem}>
          <Text style={styles.labelText}>Queries Analyzed</Text>
          <Text style={styles.dataText}>{data.summary.totalQueries}</Text>
        </View>
      </View>
      
      {/* Footer */}
      <View style={{ position: 'absolute', bottom: 40 }}>
        <Text style={[styles.footerText, { textAlign: 'center' }]}>
          CHUNK DADDY v{data.version} | AI Search Optimization
        </Text>
      </View>
    </Page>
  );
}

// Page 2: Primary Query & Executive Metrics
function MetricsPage({ data }: { data: QueryIntelligenceReportData }) {
  const maxVariantCount = Math.max(...Object.values(data.variantTypeDistribution), 1);
  const totalQueries = data.summary.totalQueries || 1;
  
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>PRIMARY QUERY ANALYSIS</Text>
        <Text style={styles.pageNumber}>Page 2</Text>
      </View>
      
      {/* Primary Query Card */}
      {data.primaryQuery && (
        <View style={styles.cardHighlight}>
          <Text style={styles.labelText}>PRIMARY QUERY</Text>
          <Text style={{ fontSize: 14, color: COLORS.textPrimary, marginVertical: 8 }}>
            "{data.primaryQuery.text}"
          </Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ 
              backgroundColor: COLORS.accentCyan, 
              paddingVertical: 2, 
              paddingHorizontal: 8, 
              borderRadius: 2 
            }}>
              <Text style={{ fontSize: 8, color: COLORS.bgPrimary, fontWeight: 'bold', textTransform: 'uppercase' }}>
                {data.primaryQuery.intentType}
              </Text>
            </View>
            <Text style={[styles.labelText, { marginLeft: 8 }]}>Intent Classification</Text>
          </View>
          
          <Text style={styles.bodyText}>{data.primaryQuery.explanation}</Text>
        </View>
      )}
      
      {/* Executive Metrics */}
      <Text style={styles.sectionTitle}>EXECUTIVE METRICS</Text>
      <View style={styles.sectionDivider} />
      
      <View style={styles.metricGrid}>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{data.summary.totalQueries}</Text>
          <Text style={styles.metricLabel}>QUERIES{'\n'}ANALYZED</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{data.summary.avgScore}</Text>
          <Text style={styles.metricLabel}>AVG SCORE{'\n'}PASSAGE</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{data.summary.entitiesExtracted}</Text>
          <Text style={styles.metricLabel}>ENTITIES{'\n'}EXTRACTED</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{data.summary.gapsCount}</Text>
          <Text style={styles.metricLabel}>GAPS{'\n'}FOUND</Text>
        </View>
      </View>
      
      {/* Variant Type Distribution */}
      <Text style={styles.sectionTitle}>VARIANT TYPE DISTRIBUTION</Text>
      <View style={styles.card}>
        {Object.entries(data.variantTypeDistribution).map(([type, count]) => (
          <View key={type} style={styles.barContainer}>
            <Text style={styles.barLabel}>{type.replace(/_/g, ' ')}</Text>
            <HorizontalBar value={count} max={maxVariantCount} color={COLORS.accentCyan} />
            <Text style={styles.barValue}>{count}</Text>
          </View>
        ))}
      </View>
      
      {/* Query Intent Analysis */}
      <Text style={styles.sectionTitle}>QUERY INTENT ANALYSIS</Text>
      <View style={styles.card}>
        <View style={styles.barContainer}>
          <Text style={styles.barLabel}>HIGH RELEVANCE (70+)</Text>
          <HorizontalBar value={data.relevanceDistribution.high} max={totalQueries} color={COLORS.accentGreen} />
          <Text style={styles.barValue}>{data.relevanceDistribution.high} ({Math.round(data.relevanceDistribution.high / totalQueries * 100)}%)</Text>
        </View>
        <View style={styles.barContainer}>
          <Text style={styles.barLabel}>MEDIUM RELEVANCE</Text>
          <HorizontalBar value={data.relevanceDistribution.medium} max={totalQueries} color={COLORS.accentYellow} />
          <Text style={styles.barValue}>{data.relevanceDistribution.medium} ({Math.round(data.relevanceDistribution.medium / totalQueries * 100)}%)</Text>
        </View>
        <View style={styles.barContainer}>
          <Text style={styles.barLabel}>LOW RELEVANCE (&lt;40)</Text>
          <HorizontalBar value={data.relevanceDistribution.low} max={totalQueries} color={COLORS.accentRed} />
          <Text style={styles.barValue}>{data.relevanceDistribution.low} ({Math.round(data.relevanceDistribution.low / totalQueries * 100)}%)</Text>
        </View>
      </View>
      
      {/* Route Prediction */}
      <Text style={styles.sectionTitle}>ROUTE PREDICTION</Text>
      <View style={styles.card}>
        <View style={styles.barContainer}>
          <Text style={styles.barLabel}>WEB SEARCH</Text>
          <HorizontalBar value={data.routeDistribution.web_search} max={totalQueries} color={COLORS.accentBlue} />
          <Text style={styles.barValue}>{data.routeDistribution.web_search} ({Math.round(data.routeDistribution.web_search / totalQueries * 100)}%)</Text>
        </View>
        <View style={styles.barContainer}>
          <Text style={styles.barLabel}>AI MEMORY</Text>
          <HorizontalBar value={data.routeDistribution.parametric} max={totalQueries} color={COLORS.accentPurple} />
          <Text style={styles.barValue}>{data.routeDistribution.parametric} ({Math.round(data.routeDistribution.parametric / totalQueries * 100)}%)</Text>
        </View>
        <View style={styles.barContainer}>
          <Text style={styles.barLabel}>HYBRID</Text>
          <HorizontalBar value={data.routeDistribution.hybrid} max={totalQueries} color={COLORS.accentCyan} />
          <Text style={styles.barValue}>{data.routeDistribution.hybrid} ({Math.round(data.routeDistribution.hybrid / totalQueries * 100)}%)</Text>
        </View>
      </View>
    </Page>
  );
}

// Page 3: Extracted Entities
function EntitiesPage({ data }: { data: QueryIntelligenceReportData }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>EXTRACTED ENTITIES</Text>
        <Text style={styles.pageNumber}>Page 3</Text>
      </View>
      
      <Text style={styles.bodyText}>
        {data.summary.entitiesExtracted} entities extracted from content
      </Text>
      
      {/* Primary Entities */}
      {data.extractedEntities.primary.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>PRIMARY ENTITIES</Text>
          <View style={styles.sectionDivider} />
          <View style={styles.card}>
            {data.extractedEntities.primary.map((entity, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={styles.bodyText}>{entity.name}</Text>
                <Text style={[styles.monoText, { color: COLORS.textMuted }]}>x{entity.frequency}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      
      {/* Concepts & Technologies */}
      {data.extractedEntities.conceptsAndTechnologies.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>CONCEPTS & TECHNOLOGIES</Text>
          <View style={styles.sectionDivider} />
          <View style={styles.card}>
            {data.extractedEntities.conceptsAndTechnologies.slice(0, 10).map((entity, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={styles.bodyText}>{entity.name}</Text>
                <Text style={[styles.monoText, { color: COLORS.textMuted }]}>x{entity.frequency}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      
      {/* Companies & Products */}
      {data.extractedEntities.companiesAndProducts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>COMPANIES & PRODUCTS</Text>
          <View style={styles.sectionDivider} />
          <View style={styles.card}>
            <View style={styles.tagRow}>
              {data.extractedEntities.companiesAndProducts.map((entity, i) => (
                <Tag key={i} text={entity.name} />
              ))}
            </View>
          </View>
        </>
      )}
      
      {/* Most Shared Across Queries */}
      {data.extractedEntities.mostSharedAcrossQueries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>MOST SHARED ACROSS QUERIES</Text>
          <View style={styles.sectionDivider} />
          <View style={styles.card}>
            {data.extractedEntities.mostSharedAcrossQueries.map((entity, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={styles.bodyText}>{entity.name}</Text>
                <Text style={[styles.monoText, { color: COLORS.accentCyan }]}>{entity.queryCount} queries</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Page>
  );
}

// Page 4: Intent Preservation Entities
function IntentPreservationPage({ data }: { data: QueryIntelligenceReportData }) {
  const { intentPreservationEntities } = data;
  
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>INTENT PRESERVATION ENTITIES</Text>
        <Text style={styles.pageNumber}>Page 4</Text>
      </View>
      
      <Text style={styles.bodyText}>
        Google Patent methodology for maintaining query intent
      </Text>
      
      {/* Primary - Must Preserve */}
      {intentPreservationEntities.primary.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>PRIMARY (Must Preserve)</Text>
          <View style={styles.sectionDivider} />
          <View style={styles.card}>
            <View style={styles.tagRow}>
              {intentPreservationEntities.primary.map((entity, i) => (
                <Tag key={i} text={entity} color={COLORS.accentGreen} />
              ))}
            </View>
          </View>
        </>
      )}
      
      {/* Branded */}
      {intentPreservationEntities.branded.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>BRANDED</Text>
          <View style={styles.sectionDivider} />
          <View style={styles.card}>
            <View style={styles.tagRow}>
              {intentPreservationEntities.branded.map((entity, i) => (
                <Tag key={i} text={entity} color={COLORS.accentBlue} />
              ))}
            </View>
          </View>
        </>
      )}
      
      {/* Temporal */}
      {intentPreservationEntities.temporal.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>TEMPORAL (Affects Routing)</Text>
          <View style={styles.sectionDivider} />
          <View style={styles.card}>
            <View style={styles.tagRow}>
              {intentPreservationEntities.temporal.map((entity, i) => (
                <Tag key={i} text={entity} color={COLORS.accentPurple} />
              ))}
            </View>
          </View>
        </>
      )}
      
      {/* Secondary */}
      {intentPreservationEntities.secondary.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>SECONDARY</Text>
          <View style={styles.sectionDivider} />
          <View style={styles.card}>
            <View style={styles.tagRow}>
              {intentPreservationEntities.secondary.slice(0, 24).map((entity, i) => (
                <Tag key={i} text={entity} />
              ))}
              {intentPreservationEntities.secondary.length > 24 && (
                <Tag text={`+${intentPreservationEntities.secondary.length - 24} more`} />
              )}
            </View>
          </View>
        </>
      )}
    </Page>
  );
}

// Page 5: SEO Keywords
function SEOKeywordsPage({ data }: { data: QueryIntelligenceReportData }) {
  const { seoKeywords } = data;
  const totalKeywords = 
    seoKeywords.coreTopics.length + 
    seoKeywords.supportingConcepts.length + 
    seoKeywords.brandTerms.length + 
    seoKeywords.temporalKeywords.length +
    seoKeywords.suggestedCombinations.length;
  
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>PROBABLE SEED KEYWORDS FOR SEO</Text>
        <Text style={styles.pageNumber}>Page 5</Text>
      </View>
      
      <Text style={styles.bodyText}>{totalKeywords} keywords identified</Text>
      
      {/* Core Topics */}
      {seoKeywords.coreTopics.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>CORE TOPICS ({seoKeywords.coreTopics.length} terms)</Text>
          <View style={styles.sectionDivider} />
          <View style={styles.card}>
            <View style={styles.tagRow}>
              {seoKeywords.coreTopics.map((kw, i) => (
                <Tag key={i} text={kw} color={COLORS.accentGreen} />
              ))}
            </View>
          </View>
        </>
      )}
      
      {/* Supporting Concepts */}
      {seoKeywords.supportingConcepts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>SUPPORTING CONCEPTS ({seoKeywords.supportingConcepts.length} terms)</Text>
          <View style={styles.sectionDivider} />
          <View style={styles.card}>
            <View style={styles.tagRow}>
              {seoKeywords.supportingConcepts.slice(0, 24).map((kw, i) => (
                <Tag key={i} text={kw} />
              ))}
            </View>
          </View>
        </>
      )}
      
      {/* Brand Terms */}
      {seoKeywords.brandTerms.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>BRAND TERMS ({seoKeywords.brandTerms.length} terms)</Text>
          <View style={styles.sectionDivider} />
          <View style={styles.card}>
            <View style={styles.tagRow}>
              {seoKeywords.brandTerms.map((kw, i) => (
                <Tag key={i} text={kw} color={COLORS.accentBlue} />
              ))}
            </View>
          </View>
        </>
      )}
      
      {/* Temporal Keywords */}
      {seoKeywords.temporalKeywords.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>TEMPORAL KEYWORDS ({seoKeywords.temporalKeywords.length} terms)</Text>
          <View style={styles.sectionDivider} />
          <View style={styles.card}>
            <View style={styles.tagRow}>
              {seoKeywords.temporalKeywords.map((kw, i) => (
                <Tag key={i} text={kw} color={COLORS.accentPurple} />
              ))}
            </View>
          </View>
        </>
      )}
      
      {/* Suggested Combinations */}
      {seoKeywords.suggestedCombinations.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>SUGGESTED KEYWORD COMBINATIONS ({seoKeywords.suggestedCombinations.length} terms)</Text>
          <View style={styles.sectionDivider} />
          <View style={styles.card}>
            {seoKeywords.suggestedCombinations.map((kw, i) => (
              <Text key={i} style={[styles.bodyText, { paddingVertical: 2 }]}>{kw}</Text>
            ))}
          </View>
        </>
      )}
    </Page>
  );
}

// Page 6: Query Analysis Matrix
function QueryMatrixPage({ data }: { data: QueryIntelligenceReportData }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>QUERY ANALYSIS MATRIX</Text>
        <Text style={styles.pageNumber}>Page 6</Text>
      </View>
      
      <Text style={styles.bodyText}>{data.queries.length} queries analyzed</Text>
      
      {/* Query Table */}
      <View style={[styles.table, { marginTop: 12 }]}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCellHeader, { width: 20 }]}>#</Text>
          <Text style={[styles.tableCellHeader, { flex: 1 }]}>Query</Text>
          <Text style={[styles.tableCellHeader, { width: 35 }]}>Type</Text>
          <Text style={[styles.tableCellHeader, { width: 35 }]}>Route</Text>
          <Text style={[styles.tableCellHeader, { width: 35 }]}>Score</Text>
          <Text style={[styles.tableCellHeader, { width: 35 }]}>Ent%</Text>
        </View>
        
        {data.queries.slice(0, 15).map((q, i) => (
          <View key={i} style={i === data.queries.length - 1 || i === 14 ? styles.tableRowLast : styles.tableRow}>
            <Text style={[styles.tableCell, { width: 20 }]}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tableCell, { color: COLORS.textPrimary }]}>
                {q.query.length > 35 ? `${q.query.slice(0, 35)}...` : q.query}
              </Text>
              <Text style={[styles.tableCell, { fontSize: 7, color: getCoverageColor(q.coverageStatus) }]}>
                Coverage: {q.coverageStatus.toUpperCase()}
                {q.intentDrift && ` | Drift: ${q.intentDrift.score}/100`}
              </Text>
            </View>
            <Text style={[styles.tableCell, styles.monoText, { width: 35 }]}>{getVariantTypeAbbr(q.variantType)}</Text>
            <Text style={[styles.tableCell, styles.monoText, { width: 35 }]}>{getRouteAbbr(q.routePrediction)}</Text>
            <Text style={[styles.tableCell, styles.monoText, { width: 35 }]}>{q.passageScore}</Text>
            <Text style={[styles.tableCell, styles.monoText, { width: 35 }]}>{q.entityOverlap}%</Text>
          </View>
        ))}
      </View>
      
      {data.queries.length > 15 && (
        <Text style={[styles.bodyText, { marginTop: 8, fontStyle: 'italic' }]}>
          + {data.queries.length - 15} more queries (see full export)
        </Text>
      )}
      
      {/* Legend */}
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.labelText}>LEGEND</Text>
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.bodyText, { fontSize: 7 }]}>
            Types: FLW=Follow-up, ENT=Entailment, CLR=Clarification, GEN=Generalization, SPC=Specification, EQV=Equivalent
          </Text>
          <Text style={[styles.bodyText, { fontSize: 7, marginTop: 4 }]}>
            Routes: WEB=Web Search, MEM=AI Memory, HYB=Hybrid
          </Text>
          <Text style={[styles.bodyText, { fontSize: 7, marginTop: 4 }]}>
            Scores: 70+ Excellent | 50-69 Good | 30-49 Weak | &lt;30 Poor
          </Text>
        </View>
      </View>
      
      {data.intentDriftFiltered > 0 && (
        <View style={[styles.card, { marginTop: 8, borderColor: COLORS.accentYellow }]}>
          <Text style={[styles.bodyText, { color: COLORS.accentYellow }]}>
            INTENT DRIFT DETECTED: {data.intentDriftFiltered} queries filtered from results
          </Text>
        </View>
      )}
    </Page>
  );
}

// Page 7: Critical Coverage Gaps
function GapsPage({ data }: { data: QueryIntelligenceReportData }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>CRITICAL COVERAGE GAPS</Text>
        <Text style={styles.pageNumber}>Page 7</Text>
      </View>
      
      <Text style={styles.bodyText}>
        {data.gaps.length} gaps identified. These HIGH intent queries have weak or no coverage. Addressing them will significantly improve competitiveness.
      </Text>
      
      {data.gaps.slice(0, 8).map((gap, i) => (
        <View key={i} style={styles.gapCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={[styles.labelText, { color: COLORS.textPrimary }]}>GAP {i + 1}</Text>
            <View style={{ 
              backgroundColor: getPriorityColor(gap.priority), 
              paddingVertical: 2, 
              paddingHorizontal: 8, 
              borderRadius: 2 
            }}>
              <Text style={{ fontSize: 7, color: COLORS.bgPrimary, fontWeight: 'bold', textTransform: 'uppercase' }}>
                {gap.priority}
              </Text>
            </View>
          </View>
          <View style={styles.sectionDivider} />
          <Text style={[styles.bodyText, { color: COLORS.textPrimary, marginVertical: 4 }]}>
            "{gap.query}"
          </Text>
          <Text style={[styles.bodyText, { fontSize: 8 }]}>
            Current score: {gap.currentScore} | Entity overlap: {gap.entityOverlap}%
          </Text>
          {gap.note && (
            <Text style={[styles.bodyText, { fontSize: 8, fontStyle: 'italic', marginTop: 4 }]}>
              Note: {gap.note}
            </Text>
          )}
        </View>
      ))}
      
      {data.gaps.length > 8 && (
        <Text style={[styles.bodyText, { fontStyle: 'italic' }]}>
          + {data.gaps.length - 8} more gaps (see full export)
        </Text>
      )}
    </Page>
  );
}

// Page 8: Priority Action Plan
function ActionsPage({ data }: { data: QueryIntelligenceReportData }) {
  if (data.priorityActions.length === 0) {
    return null;
  }
  
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>PRIORITY ACTION PLAN</Text>
        <Text style={styles.pageNumber}>Page 8</Text>
      </View>
      
      <Text style={styles.bodyText}>Ranked by impact & effort</Text>
      
      {data.priorityActions.slice(0, 4).map((action, i) => (
        <View key={i} style={styles.actionCard}>
          <View style={styles.actionHeader}>
            <Text style={[styles.labelText, { color: COLORS.textPrimary }]}>ACTION {i + 1}</Text>
            <View style={{ 
              backgroundColor: getImpactColor(action.impact), 
              paddingVertical: 2, 
              paddingHorizontal: 8, 
              borderRadius: 2 
            }}>
              <Text style={{ fontSize: 7, color: COLORS.bgPrimary, fontWeight: 'bold', textTransform: 'uppercase' }}>
                {action.impact} IMPACT
              </Text>
            </View>
          </View>
          <View style={styles.sectionDivider} />
          
          <Text style={[styles.bodyText, { color: COLORS.textPrimary, marginVertical: 8 }]}>
            {action.action}
          </Text>
          
          <Text style={[styles.labelText, { marginBottom: 4 }]}>
            Effort: {action.effort.toUpperCase()}
          </Text>
          
          {action.addressesQueries.length > 0 && (
            <>
              <Text style={[styles.labelText, { marginTop: 8, marginBottom: 4 }]}>Addresses queries:</Text>
              {action.addressesQueries.slice(0, 4).map((q, j) => (
                <Text key={j} style={[styles.bodyText, { fontSize: 8 }]}>- {q}</Text>
              ))}
            </>
          )}
        </View>
      ))}
    </Page>
  );
}

// Page 9: Methodology
function MethodologyPage({ data }: { data: QueryIntelligenceReportData }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>METHODOLOGY</Text>
        <Text style={styles.pageNumber}>Page 9</Text>
      </View>
      
      <Text style={styles.sectionTitle}>SCORING METHODOLOGY</Text>
      <View style={styles.sectionDivider} />
      <View style={styles.card}>
        <Text style={[styles.monoText, { marginBottom: 8 }]}>
          Passage Score = (Semantic Similarity × 0.7) + (Lexical × 0.3)
        </Text>
        <Text style={styles.bodyText}>
          - Semantic Similarity: Cosine distance between query and chunk embeddings (OpenAI text-embedding-3-large)
        </Text>
        <Text style={styles.bodyText}>
          - Lexical Score: BM25-style term frequency analysis
        </Text>
        <Text style={styles.bodyText}>
          - Entity Overlap: Percentage of query entities found in chunk
        </Text>
      </View>
      
      <Text style={styles.sectionTitle}>INTENT PRESERVATION</Text>
      <View style={styles.sectionDivider} />
      <View style={styles.card}>
        <Text style={[styles.bodyText, { marginBottom: 8 }]}>
          Based on Google Patent US 11,663,201 B2 methodology:
        </Text>
        <Text style={styles.monoText}>
          Intent Drift Score = (Category × 50) + (Stage × 30) + (Type × 20)
        </Text>
        <Text style={[styles.bodyText, { marginTop: 8 }]}>Thresholds:</Text>
        <Text style={styles.bodyText}>- 0-20: No significant drift (same intent)</Text>
        <Text style={styles.bodyText}>- 21-40: Slight drift (borderline)</Text>
        <Text style={styles.bodyText}>- 41-100: Clear drift (different user need)</Text>
      </View>
      
      <Text style={styles.sectionTitle}>ROUTE PREDICTION</Text>
      <View style={styles.sectionDivider} />
      <View style={styles.card}>
        <Text style={styles.bodyText}>Predicts whether AI systems will use:</Text>
        <Text style={styles.bodyText}>- WEB SEARCH: External retrieval (your content can compete)</Text>
        <Text style={styles.bodyText}>- AI MEMORY: Parametric knowledge (content invisible)</Text>
        <Text style={styles.bodyText}>- HYBRID: Both sources (partial opportunity)</Text>
        <Text style={[styles.bodyText, { marginTop: 8 }]}>
          Signals analyzed: temporal markers, verification needs, entity specificity, factual vs conceptual nature
        </Text>
      </View>
      
      <View style={styles.sectionDivider} />
      
      <Text style={styles.sectionTitle}>TOOLS & DATA SOURCES</Text>
      <View style={styles.card}>
        <Text style={styles.bodyText}>- Embeddings: OpenAI text-embedding-3-large (3072 dimensions)</Text>
        <Text style={styles.bodyText}>- Analysis: ChunkDaddy v{data.version} RAG Pipeline Analyzer</Text>
        <Text style={styles.bodyText}>- Methodology: Google Patent Query Fanout System</Text>
      </View>
      
      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Report generated by ChunkDaddy v{data.version}</Text>
        <Text style={styles.footerText}>© {new Date().getFullYear()} Chunk Daddy</Text>
      </View>
    </Page>
  );
}

// Main Document Component
export function QueryIntelligenceReport({ data }: QueryIntelligenceReportProps) {
  return (
    <Document>
      <CoverPage data={data} />
      <MetricsPage data={data} />
      <EntitiesPage data={data} />
      <IntentPreservationPage data={data} />
      <SEOKeywordsPage data={data} />
      <QueryMatrixPage data={data} />
      {data.gaps.length > 0 && <GapsPage data={data} />}
      {data.priorityActions.length > 0 && <ActionsPage data={data} />}
      <MethodologyPage data={data} />
    </Document>
  );
}

export default QueryIntelligenceReport;
