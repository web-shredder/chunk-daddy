/**
 * Gathers data from the Query Intelligence Dashboard for PDF export
 */

export interface QueryIntelligenceReportData {
  // Cover page
  detectedTopic: {
    description: string;
    classification: string;
    intent: string;
    confidence: number;
    readerGoal: string;
  } | null;
  
  // Primary query
  primaryQuery: {
    text: string;
    intentType: string;
    explanation: string;
  } | null;
  
  // Metrics
  summary: {
    totalQueries: number;
    avgScore: number;
    entitiesExtracted: number;
    gapsCount: number;
  };
  
  // Distributions
  variantTypeDistribution: Record<string, number>;
  relevanceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  routeDistribution: {
    web_search: number;
    parametric: number;
    hybrid: number;
  };
  
  // Entities - from content analysis
  extractedEntities: {
    primary: Array<{ name: string; frequency: number }>;
    conceptsAndTechnologies: Array<{ name: string; frequency: number }>;
    companiesAndProducts: Array<{ name: string; frequency?: number }>;
    mostSharedAcrossQueries: Array<{ name: string; queryCount: number }>;
  };
  
  // Intent preservation entities - from categorization
  intentPreservationEntities: {
    primary: string[];
    branded: string[];
    temporal: string[];
    secondary: string[];
  };
  
  // SEO Keywords
  seoKeywords: {
    coreTopics: string[];
    supportingConcepts: string[];
    brandTerms: string[];
    temporalKeywords: string[];
    suggestedCombinations: string[];
  };
  
  // Queries analyzed
  queries: Array<{
    query: string;
    variantType: string;
    routePrediction: 'web_search' | 'parametric' | 'hybrid';
    passageScore: number;
    entityOverlap: number;
    coverageStatus: 'strong' | 'partial' | 'weak' | 'none';
    intentDrift?: {
      score: number;
      explanation: string;
    };
  }>;
  
  // Filtered due to intent drift
  intentDriftFiltered: number;
  
  // Coverage gaps
  gaps: Array<{
    query: string;
    priority: 'high' | 'moderate' | 'low';
    currentScore: number;
    entityOverlap: number;
    note?: string;
  }>;
  
  // Priority action recommendations
  priorityActions: Array<{
    action: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'low' | 'moderate' | 'high';
    addressesQueries: string[];
  }>;
  
  // Meta
  generatedAt: Date;
  version: string;
}

interface IntelligenceState {
  detectedTopic?: {
    primaryEntity: string;
    entityType: string;
    contentPurpose: string;
    targetAction: string;
    confidence: number;
  } | null;
  primaryQuery?: {
    query: string;
    searchIntent: string;
    confidence: number;
    reasoning: string;
  } | null;
  intelligence?: {
    priorityActions?: Array<{
      action: string;
      impact: string;
      effort: string;
      addressesQueries?: string[];
    }>;
  } | null;
  suggestions?: Array<{
    query: string;
    variantType?: string;
    routePrediction?: string;
    intentPreservation?: number;
    entityOverlap?: number;
    intentDrift?: number;
    intentDriftExplanation?: string;
    matchStrength?: string;
  }>;
  intentSummary?: {
    totalVariants?: number;
    avgIntentPreservation?: number;
    variantTypeDistribution?: Record<string, number>;
    routeDistribution?: Record<string, number>;
  } | null;
  gaps?: {
    critical?: Array<{
      query: string;
      score?: number;
      entityOverlap?: number;
    }>;
  };
  entities?: {
    primary: string[];
    secondary: string[];
    temporal: string[];
    branded: string[];
  } | null;
}

/**
 * Transforms dashboard state into structured report data
 */
export function gatherReportData(
  intelligence: IntelligenceState,
  existingQueries: string[] = []
): QueryIntelligenceReportData {
  const { detectedTopic, primaryQuery, intelligence: intel, suggestions, intentSummary, gaps, entities } = intelligence;
  
  // Build variant type distribution
  const variantTypeDistribution: Record<string, number> = {};
  suggestions?.forEach(s => {
    const type = s.variantType || 'UNKNOWN';
    variantTypeDistribution[type] = (variantTypeDistribution[type] || 0) + 1;
  });
  
  // Calculate relevance distribution
  const scores = suggestions?.map(s => s.intentPreservation || 0) || [];
  const relevanceDistribution = {
    high: scores.filter(s => s >= 70).length,
    medium: scores.filter(s => s >= 40 && s < 70).length,
    low: scores.filter(s => s < 40).length,
  };
  
  // Route distribution
  const routeDistribution = {
    web_search: 0,
    parametric: 0,
    hybrid: 0,
  };
  suggestions?.forEach(s => {
    const route = (s.routePrediction || 'web_search').toLowerCase();
    if (route === 'web_search' || route === 'web') {
      routeDistribution.web_search++;
    } else if (route === 'parametric' || route === 'ai_memory') {
      routeDistribution.parametric++;
    } else if (route === 'hybrid') {
      routeDistribution.hybrid++;
    }
  });
  
  // Count intent drift filtered
  const intentDriftFiltered = suggestions?.filter(s => (s.intentDrift || 0) > 40).length || 0;
  
  // Build queries array with coverage status
  const queries = suggestions?.map(s => {
    const score = s.intentPreservation || 0;
    let coverageStatus: 'strong' | 'partial' | 'weak' | 'none' = 'none';
    if (score >= 70) coverageStatus = 'strong';
    else if (score >= 50) coverageStatus = 'partial';
    else if (score >= 30) coverageStatus = 'weak';
    
    return {
      query: s.query,
      variantType: s.variantType || 'UNKNOWN',
      routePrediction: (s.routePrediction?.toLowerCase() || 'web_search') as 'web_search' | 'parametric' | 'hybrid',
      passageScore: Math.round(score),
      entityOverlap: Math.round((s.entityOverlap || 0) * 100),
      coverageStatus,
      intentDrift: s.intentDrift && s.intentDrift > 20 ? {
        score: s.intentDrift,
        explanation: s.intentDriftExplanation || '',
      } : undefined,
    };
  }) || [];
  
  // Build gaps from critical gaps
  const gapsList = gaps?.critical?.map(g => ({
    query: g.query,
    priority: 'moderate' as const,
    currentScore: g.score || 0,
    entityOverlap: Math.round((g.entityOverlap || 0) * 100),
  })) || [];
  
  // Extract entities data
  const extractedEntities = {
    primary: entities?.primary.map(e => ({ name: e, frequency: 1 })) || [],
    conceptsAndTechnologies: entities?.secondary.map(e => ({ name: e, frequency: 1 })) || [],
    companiesAndProducts: entities?.branded.map(e => ({ name: e })) || [],
    mostSharedAcrossQueries: [] as Array<{ name: string; queryCount: number }>,
  };
  
  // SEO keywords from entities
  const seoKeywords = {
    coreTopics: entities?.primary || [],
    supportingConcepts: entities?.secondary || [],
    brandTerms: entities?.branded || [],
    temporalKeywords: entities?.temporal || [],
    suggestedCombinations: generateKeywordCombinations(entities?.primary || []),
  };
  
  // Calculate summary
  const avgScore = scores.length > 0 
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;
  
  const entitiesCount = (entities?.primary.length || 0) + 
                        (entities?.secondary.length || 0) + 
                        (entities?.branded.length || 0);
  
  return {
    detectedTopic: detectedTopic ? {
      description: detectedTopic.primaryEntity || 'Unknown Topic',
      classification: detectedTopic.entityType || 'unknown',
      intent: detectedTopic.contentPurpose || 'inform',
      confidence: Math.round((detectedTopic.confidence || 0) * 100),
      readerGoal: detectedTopic.targetAction || 'Learn more about the topic',
    } : null,
    
    primaryQuery: primaryQuery ? {
      text: primaryQuery.query,
      intentType: primaryQuery.searchIntent || 'informational',
      explanation: primaryQuery.reasoning || '',
    } : null,
    
    summary: {
      totalQueries: suggestions?.length || 0,
      avgScore,
      entitiesExtracted: entitiesCount,
      gapsCount: gapsList.length,
    },
    
    variantTypeDistribution,
    relevanceDistribution,
    routeDistribution,
    
    extractedEntities,
    
    intentPreservationEntities: {
      primary: entities?.primary || [],
      branded: entities?.branded || [],
      temporal: entities?.temporal || [],
      secondary: entities?.secondary || [],
    },
    
    seoKeywords,
    
    queries,
    intentDriftFiltered,
    gaps: gapsList,
    
    priorityActions: intel?.priorityActions?.map(a => ({
      action: a.action,
      impact: (a.impact?.toLowerCase() || 'medium') as 'high' | 'medium' | 'low',
      effort: (a.effort?.toLowerCase() || 'moderate') as 'low' | 'moderate' | 'high',
      addressesQueries: a.addressesQueries || [],
    })) || [],
    
    generatedAt: new Date(),
    version: '1.3',
  };
}

/**
 * Generate keyword combinations from primary entities
 */
function generateKeywordCombinations(primary: string[]): string[] {
  if (primary.length === 0) return [];
  
  const mainKeyword = primary[0];
  const prefixes = ['best', 'top', 'how to', 'what is'];
  const suffixes = ['vs', 'pricing', 'cost', 'review'];
  
  const combinations: string[] = [];
  
  prefixes.forEach(prefix => {
    combinations.push(`${prefix} ${mainKeyword}`);
  });
  
  if (primary.length > 1) {
    combinations.push(`${mainKeyword} vs ${primary[1]}`);
  }
  
  suffixes.slice(1).forEach(suffix => {
    combinations.push(`${suffix} ${mainKeyword}`);
  });
  
  return combinations.slice(0, 8);
}
