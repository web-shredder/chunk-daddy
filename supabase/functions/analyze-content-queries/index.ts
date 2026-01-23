import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, existingQueries = [], topicOverride = null } = await req.json();

    if (!content || content.trim().length < 100) {
      return new Response(
        JSON.stringify({ error: 'Content must be at least 100 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting content analysis...');
    console.log('Content length:', content.length);
    console.log('Existing queries:', existingQueries.length);
    console.log('Topic override:', topicOverride);

    // Step 1: Extract content intelligence (detect what X is)
    console.log('Step 1: Extracting content intelligence...');
    const contentIntelligence = await extractContentIntelligence(content);
    console.log('Detected topic:', contentIntelligence.detectedTopicFocus?.primaryEntity);
    
    // Step 2: Determine topic focus (auto-detected or user override)
    const topicFocus = topicOverride 
      ? { ...contentIntelligence.detectedTopicFocus, primaryEntity: topicOverride }
      : contentIntelligence.detectedTopicFocus;
    
    // Step 3: Generate the PRIMARY query (what this content is fundamentally about)
    console.log('Step 2: Generating primary query...');
    const primaryQuery = await generatePrimaryQuery(content, contentIntelligence, topicFocus);
    console.log('Primary query:', primaryQuery.query);
    
    // Step 4: Generate query suggestions based on detected topic
    console.log('Step 3: Generating query suggestions...');
    const querySuggestionsResponse = await generateQuerySuggestions(
      content, 
      contentIntelligence, 
      topicFocus,
      primaryQuery,
      existingQueries
    );
    console.log('Generated suggestions:', querySuggestionsResponse.suggestions.length);
    console.log('Intent distribution: HIGH=%d, MEDIUM=%d, LOW=%d', 
      querySuggestionsResponse.summary.high_intent,
      querySuggestionsResponse.summary.medium_intent,
      querySuggestionsResponse.summary.low_intent
    );
    
    // Step 5: Detect coverage gaps
    console.log('Step 4: Detecting coverage gaps...');
    const coverageGaps = await detectCoverageGaps(
      content, 
      contentIntelligence, 
      topicFocus,
      querySuggestionsResponse.suggestions
    );
    console.log('Detected gaps:', coverageGaps.length);

    return new Response(
      JSON.stringify({
        success: true,
        // What the system detected
        detectedTopic: contentIntelligence.detectedTopicFocus,
        activeTopic: topicFocus,
        isOverridden: !!topicOverride,
        
        // The auto-generated primary query
        primaryQuery,
        
        // Full intelligence
        intelligence: contentIntelligence,
        suggestions: querySuggestionsResponse.suggestions,
        suggestionsSummary: querySuggestionsResponse.summary,
        gaps: coverageGaps,
        
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Query analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to analyze content';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================
// STEP 1: CONTENT INTELLIGENCE - DETECT WHAT "X" IS
// ============================================================

async function extractContentIntelligence(content: string): Promise<ContentIntelligence> {
  const systemPrompt = `You are an expert content analyst. Your job is to determine EXACTLY what this content is about - what is "X"?

CRITICAL TASK: Identify the PRIMARY TOPIC (X) that this content is trying to explain, compare, teach, or sell.

Think like a search engine: If someone found this page, what were they searching for?

DETECTION RULES:
1. Look at the H1/title first - it usually declares the topic
2. Look at what entities are EXPLAINED vs just MENTIONED
3. Look at what the content is trying to HELP the reader DO
4. Consider the content's PURPOSE: Is it teaching X? Comparing X to Y? Helping choose X? Solving X problem?

OUTPUT FORMAT (JSON):
{
  "detectedTopicFocus": {
    "primaryEntity": "The main thing (X) this content is about - be specific",
    "entityType": "product|service|concept|process|tool|company|industry|role",
    "contentPurpose": "explain|compare|guide|teach|sell|review|troubleshoot",
    "targetAction": "What the reader wants to DO (e.g., 'choose an RPO provider', 'learn Python basics', 'fix WordPress errors')",
    "confidence": 0.0-1.0,
    "alternativeInterpretations": [
      {
        "entity": "Alternative interpretation of X",
        "confidence": 0.0-1.0,
        "reason": "Why this could also be the focus"
      }
    ]
  },
  "contentType": "guide|comparison|how-to|listicle|reference|opinion|news|case-study|landing-page",
  "primaryAudience": {
    "role": "Who is this written for",
    "expertiseLevel": "beginner|intermediate|advanced|mixed",
    "intent": "What they're trying to accomplish"
  },
  "coreEntities": [
    {
      "name": "Entity name",
      "type": "product|company|concept|person|technology|process|competitor",
      "role": "primary|secondary|competitor|example",
      "isExplained": true,
      "mentionCount": 5,
      "sections": ["Which sections mention this"]
    }
  ],
  "topicHierarchy": {
    "broadCategory": "The general field (e.g., 'HR Technology', 'Web Development')",
    "specificNiche": "The specific area (e.g., 'Recruitment Process Outsourcing', 'React State Management')",
    "exactFocus": "The precise topic (e.g., 'How to choose an RPO provider', 'useState vs useReducer')"
  },
  "semanticClusters": [
    {
      "clusterName": "Group of related concepts",
      "concepts": ["concept1", "concept2", "concept3"],
      "coverageDepth": "surface|moderate|deep"
    }
  ],
  "contentStructure": {
    "hasDefinition": true,
    "hasProcess": false,
    "hasComparison": true,
    "hasEvaluation": false,
    "hasProblemSolution": false,
    "hasExamples": true,
    "hasCaseStudy": false,
    "hasStats": true,
    "hasFAQ": false,
    "hasCallToAction": true
  },
  "implicitKnowledge": [
    "Things the content assumes readers already know"
  ]
}`;

  const response = await callAI(systemPrompt, content.slice(0, 12000), 'json_object', 4096);
  const parsed = parseAIResponse(response, {
    detectedTopicFocus: {
      primaryEntity: 'Unknown topic',
      entityType: 'concept',
      contentPurpose: 'explain',
      targetAction: 'learn about the topic',
      confidence: 0.5,
    },
    contentType: 'guide',
    primaryAudience: { role: 'general reader', expertiseLevel: 'mixed', intent: 'learn' },
    coreEntities: [],
    topicHierarchy: { broadCategory: 'General', specificNiche: 'Unknown', exactFocus: 'Unknown' },
    semanticClusters: [],
    contentStructure: {},
    implicitKnowledge: [],
  });
  return parsed;
}

// ============================================================
// STEP 2: GENERATE PRIMARY QUERY
// ============================================================

async function generatePrimaryQuery(
  content: string,
  intelligence: ContentIntelligence,
  topicFocus: TopicFocus
): Promise<PrimaryQueryResult> {
  const systemPrompt = `You are a search behavior expert. Given content analysis, determine the ONE PRIMARY SEARCH QUERY this content should rank #1 for.

This is the "money query" - the exact search someone would type that this content PERFECTLY answers.

RULES:
1. Must be natural language (how real humans search)
2. Must be 5-15 words
3. Must reflect the content's PRIMARY purpose
4. Should be the most valuable/high-intent version

EXAMPLES:
- Content about RPO selection → "how to choose the right RPO provider for your company"
- Content comparing React hooks → "useState vs useReducer which should I use"
- Content about fixing 404 errors → "how to fix 404 page not found error wordpress"

OUTPUT FORMAT (JSON):
{
  "query": "The primary query (5-15 words, natural language)",
  "searchIntent": "informational|navigational|transactional|commercial",
  "confidence": 0.95,
  "reasoning": "Why this is THE primary query for this content",
  "variants": [
    {
      "query": "Alternative phrasing of same intent",
      "popularity": "likely search volume relative to primary"
    }
  ]
}`;

  const userPrompt = `DETECTED TOPIC FOCUS:
${JSON.stringify(topicFocus, null, 2)}

CONTENT STRUCTURE:
${JSON.stringify(intelligence.contentStructure, null, 2)}

TOPIC HIERARCHY:
${JSON.stringify(intelligence.topicHierarchy, null, 2)}

CONTENT PREVIEW:
${content.slice(0, 3000)}

Generate the PRIMARY query this content should rank for:`;

  const response = await callAI(systemPrompt, userPrompt, 'json_object', 2048);
  const parsed = parseAIResponse(response, {
    query: `What is ${topicFocus.primaryEntity}`,
    searchIntent: 'informational',
    confidence: 0.5,
    reasoning: 'Default fallback query',
    variants: [],
  });
  return parsed;
}

// ============================================================
// STEP 3: GENERATE FANOUT QUERIES
// ============================================================

async function generateQuerySuggestions(
  content: string,
  intelligence: ContentIntelligence,
  topicFocus: TopicFocus,
  primaryQuery: PrimaryQueryResult,
  existingQueries: string[]
): Promise<QuerySuggestionsResponse> {
  
  const systemPrompt = `You are an expert in search behavior, content retrieval, and query fan-out optimization.
Based on Google Patent US 11,615,106 and Apple's synthetic query generation research.

Given detected topic "${topicFocus.primaryEntity}" and primary query "${primaryQuery.query}", generate ALL the queries this content could/should rank for WITH INTENT PRESERVATION SCORING.

=== PHASE 1: ENTITY EXTRACTION ===

For the PRIMARY QUERY "${primaryQuery.query}":
1. Extract named entities (proper nouns, domain terms, key concepts, qualifiers)
   Example: "how to choose an RPO provider" → ["RPO", "provider", "choose"]

=== PHASE 2: QUERY GENERATION WITH VARIANT CLASSIFICATION ===

VARIANT TYPES (Google Classification):
- SYNONYM: Different phrasing of same query ("how to choose RPO" → "selecting RPO vendor")
- GRANULAR: Breaking into component parts ("RPO selection" → "RPO pricing", "RPO implementation")
- SPECIFICATION: Adding context ("RPO" → "RPO for startups", "RPO for tech companies")
- TEMPORAL: Adding time specificity ("best RPO" → "best RPO providers 2026")
- RELATED: Before/after questions ("how to choose RPO" → "questions to ask RPO vendor")

INTENT TYPES TO COVER FOR "${topicFocus.primaryEntity}":
1. DEFINITION - "What is ${topicFocus.primaryEntity}?"
2. PROCESS - "How to [do something with ${topicFocus.primaryEntity}]"
3. COMPARISON - "${topicFocus.primaryEntity} vs [alternative]"
4. EVALUATION - "Best ${topicFocus.primaryEntity} for [context]"
5. PROBLEM - "${topicFocus.primaryEntity} [problem/error/issue]"
6. SPECIFICATION - Narrow variants with context

=== PHASE 3: INTENT PRESERVATION SCORING ===

For EACH suggested query:
1. Extract named entities from this query
2. Calculate semantic_similarity (0-1):
   - 1.0 = identical/synonym
   - 0.8-0.9 = very similar concept, different wording
   - 0.6-0.7 = related but different aspect
   - 0.4-0.5 = tangentially related
   - <0.4 = intent drift
3. Calculate entity_overlap (0-1):
   - shared_entities / max(primary_entities, suggested_entities)
4. Calculate intent_score:
   - (semantic_similarity × 0.7) + (entity_overlap × 0.3)
5. Categorize intent_category:
   - HIGH if intent_score ≥ 0.7
   - MEDIUM if intent_score 0.5-0.7
   - LOW if intent_score < 0.5

=== PHASE 4: ROUTE PREDICTION ===

For EACH suggested query, predict:
- WEB_SEARCH: Query likely triggers web search
  - Signals: temporal markers ("2026", "latest", "current")
  - Specific entities (company names, products)
  - Verification needs ("price", "cost", "rating", "review")
  - Comparisons ("vs", "versus", "better than")
- PARAMETRIC: Query likely answered from AI's memory
  - Signals: general concepts ("what is", "explain")
  - Definitions ("define", "meaning")
  - Well-known facts
- HYBRID: Mix of both

Provide route_confidence (0-100) for the prediction.

=== PHASE 5: DRIFT DETECTION ===

If intent_category is LOW, explain drift_reason:
- WHY did this query drift from the original intent?
- What different user need does it address?
- Be specific and actionable.

=== MATCH STRENGTH ASSESSMENT ===
- STRONG MATCH: Content directly and thoroughly answers this
- PARTIAL MATCH: Content touches on this but incompletely
- WEAK MATCH: Content barely addresses this

=== OUTPUT FORMAT (JSON) ===
{
  "suggestions": [
    {
      "query": "Complete natural search query (8-20 words)",
      "intentType": "definition|process|comparison|evaluation|problem|specification",
      "matchStrength": "strong|partial|weak",
      "matchReason": "Specific explanation of why content does/doesn't answer this",
      "relevantSection": "Which heading/section addresses this (if any)",
      "confidence": 85,
      "searchVolumeTier": "high|medium|low|niche",
      "competitiveness": "Easy to rank|Moderate|Competitive",
      
      "variantType": "SYNONYM|GRANULAR|SPECIFICATION|TEMPORAL|RELATED",
      "semanticSimilarity": 0.85,
      "entityOverlap": 0.67,
      "intentScore": 0.80,
      "intentCategory": "HIGH|MEDIUM|LOW",
      "routePrediction": "WEB_SEARCH|PARAMETRIC|HYBRID",
      "routeConfidence": 85,
      "primaryQueryEntities": ["entity1", "entity2"],
      "suggestedQueryEntities": ["entity1", "entity3"],
      "sharedEntities": ["entity1"],
      "driftReason": null
    }
  ],
  "summary": {
    "total_generated": 25,
    "high_intent": 15,
    "medium_intent": 7,
    "low_intent": 3,
    "filtered_count": 3,
    "avg_intent_score": 0.72,
    "web_search_likely": 18,
    "parametric_likely": 5,
    "hybrid_likely": 2
  }
}

CRITICAL QUALITY RULES:
- Queries must be 8-20 words (complete natural sentences)
- Use actual search language (questions, "how to", "best", "vs")
- NO keyword-only phrases
- NO duplicate intent
- Skip queries already in existing list
- Include LOW intent queries but flag them for transparency

Generate 20-35 high-quality queries covering ALL intent types with full scoring.`;

  const semanticClustersText = intelligence.semanticClusters?.map(c => 
    `- ${c.clusterName}: ${c.concepts?.join(', ') || 'N/A'} (${c.coverageDepth})`
  ).join('\n') || 'N/A';

  const structureSignals = Object.entries(intelligence.contentStructure || {})
    .filter(([_, v]) => v)
    .map(([k]) => `✓ ${k}`)
    .join('\n') || 'N/A';

  const entitiesText = intelligence.coreEntities?.map(e => 
    `- ${e.name} (${e.role}, ${e.isExplained ? 'explained' : 'mentioned only'})`
  ).join('\n') || 'N/A';

  const userPrompt = `PRIMARY ENTITY (X): ${topicFocus.primaryEntity}
CONTENT PURPOSE: ${topicFocus.contentPurpose}
TARGET ACTION: ${topicFocus.targetAction}

PRIMARY QUERY: ${primaryQuery.query}

SEMANTIC CLUSTERS IN CONTENT:
${semanticClustersText}

CONTENT STRUCTURE SIGNALS:
${structureSignals}

ENTITIES MENTIONED:
${entitiesText}

EXISTING QUERIES TO SKIP:
${existingQueries.map(q => `- ${q}`).join('\n') || '(none)'}

CONTENT:
${content.slice(0, 6000)}

Generate query suggestions with full intent preservation scoring:`;

  const response = await callAI(systemPrompt, userPrompt, 'json_object', 12288);
  const parsed = parseAIResponse(response, { suggestions: [], summary: {} });
  
  // Ensure we have the right structure
  const suggestions = parsed.suggestions || parsed.items || [];
  const summary = parsed.summary || {
    total_generated: suggestions.length,
    high_intent: suggestions.filter((s: QuerySuggestion) => s.intentCategory === 'HIGH').length,
    medium_intent: suggestions.filter((s: QuerySuggestion) => s.intentCategory === 'MEDIUM').length,
    low_intent: suggestions.filter((s: QuerySuggestion) => s.intentCategory === 'LOW').length,
    filtered_count: suggestions.filter((s: QuerySuggestion) => s.intentCategory === 'LOW').length,
    avg_intent_score: suggestions.length > 0 
      ? suggestions.reduce((acc: number, s: QuerySuggestion) => acc + (s.intentScore || 0), 0) / suggestions.length 
      : 0,
    web_search_likely: suggestions.filter((s: QuerySuggestion) => s.routePrediction === 'WEB_SEARCH').length,
    parametric_likely: suggestions.filter((s: QuerySuggestion) => s.routePrediction === 'PARAMETRIC').length,
    hybrid_likely: suggestions.filter((s: QuerySuggestion) => s.routePrediction === 'HYBRID').length,
  };
  
  return { suggestions, summary };
}

// ============================================================
// STEP 4: DETECT COVERAGE GAPS
// ============================================================

async function detectCoverageGaps(
  content: string,
  intelligence: ContentIntelligence,
  topicFocus: TopicFocus,
  suggestions: QuerySuggestion[]
): Promise<CoverageGap[]> {
  
  // Analyze current coverage
  const intentCoverage = {
    definition: suggestions.filter(s => s.intentType === 'definition' && s.matchStrength === 'strong').length,
    process: suggestions.filter(s => s.intentType === 'process' && s.matchStrength === 'strong').length,
    comparison: suggestions.filter(s => s.intentType === 'comparison' && s.matchStrength === 'strong').length,
    evaluation: suggestions.filter(s => s.intentType === 'evaluation' && s.matchStrength === 'strong').length,
    problem: suggestions.filter(s => s.intentType === 'problem' && s.matchStrength === 'strong').length,
    specification: suggestions.filter(s => s.intentType === 'specification' && s.matchStrength === 'strong').length,
  };

  const systemPrompt = `You are a content strategist identifying GAPS in content coverage.

The content is about "${topicFocus.primaryEntity}" (${topicFocus.contentPurpose}).

Your job: Find queries that SHOULD be answered by content about ${topicFocus.primaryEntity} but AREN'T.

GAP DETECTION STRATEGIES:

1. MISSING INTENT TYPES
   - If content explains ${topicFocus.primaryEntity} but never compares it → comparison gap
   - If content teaches process but never troubleshoots → problem gap
   - If content is generic but audience needs specifics → specification gap

2. INCOMPLETE ENTITIES
   - Competitors mentioned but not compared
   - Tools referenced but not explained
   - Concepts used but not defined

3. SEARCHER JOURNEY GAPS
   - What would someone search BEFORE reading this?
   - What would someone search AFTER reading this?
   - What related decisions does this leave unanswered?

4. AUDIENCE SEGMENT GAPS
   - Is it only for one expertise level?
   - Does it ignore important industries/company sizes?
   - Does it assume knowledge it shouldn't?

5. OBJECTION/CONCERN GAPS
   - Common fears about ${topicFocus.primaryEntity} not addressed
   - Risks not discussed
   - Costs not covered

For each gap, generate the SPECIFIC QUERY that represents what's missing.

OUTPUT FORMAT (JSON):
{
  "gaps": [
    {
      "gapType": "missing_intent|incomplete_entity|journey_gap|audience_gap|objection_gap",
      "query": "The specific search query this gap represents (8-20 words)",
      "intentType": "definition|process|comparison|evaluation|problem|specification",
      "severity": "critical|important|nice-to-have",
      "reason": "Why this gap matters for ${topicFocus.primaryEntity} content",
      "evidence": "What in the content (or missing from it) reveals this gap",
      "suggestedFix": "How to address this gap (specific content recommendation)",
      "relatedEntities": ["Entities this gap relates to"],
      "estimatedEffort": "small|medium|large"
    }
  ]
}

Focus on HIGH-VALUE gaps - queries with real search volume that would significantly improve content comprehensiveness.`;

  const unexplainedEntities = intelligence.coreEntities
    ?.filter(e => !e.isExplained && e.role !== 'example')
    .map(e => `- ${e.name} (${e.type}, mentioned ${e.mentionCount}x)`)
    .join('\n') || '(none)';

  const weakMatches = suggestions
    .filter(s => s.matchStrength !== 'strong')
    .slice(0, 15)
    .map(s => `- "${s.query}" (${s.matchStrength}): ${s.matchReason}`)
    .join('\n') || '(none)';

  const implicitKnowledge = intelligence.implicitKnowledge?.map(k => `- ${k}`).join('\n') || '(none)';

  const userPrompt = `PRIMARY TOPIC: ${topicFocus.primaryEntity}
CONTENT PURPOSE: ${topicFocus.contentPurpose}
TARGET AUDIENCE: ${intelligence.primaryAudience?.role || 'Unknown'} (${intelligence.primaryAudience?.expertiseLevel || 'Unknown'})

CURRENT INTENT COVERAGE (strong matches only):
- Definition queries: ${intentCoverage.definition} ${intentCoverage.definition === 0 ? '⚠️ MISSING' : ''}
- Process queries: ${intentCoverage.process} ${intentCoverage.process === 0 ? '⚠️ MISSING' : ''}
- Comparison queries: ${intentCoverage.comparison} ${intentCoverage.comparison === 0 ? '⚠️ MISSING' : ''}
- Evaluation queries: ${intentCoverage.evaluation} ${intentCoverage.evaluation === 0 ? '⚠️ MISSING' : ''}
- Problem queries: ${intentCoverage.problem} ${intentCoverage.problem === 0 ? '⚠️ MISSING' : ''}
- Specification queries: ${intentCoverage.specification} ${intentCoverage.specification === 0 ? '⚠️ MISSING' : ''}

ENTITIES MENTIONED BUT NOT EXPLAINED:
${unexplainedEntities}

WEAK/PARTIAL MATCHES (potential gaps):
${weakMatches}

IMPLICIT KNOWLEDGE ASSUMPTIONS:
${implicitKnowledge}

Identify coverage gaps for "${topicFocus.primaryEntity}" content:`;

  const response = await callAI(systemPrompt, userPrompt, 'json_object', 6144);
  const parsed = parseAIResponse(response, { gaps: [] });
  
  return parsed.gaps || parsed.items || [];
}

// ============================================================
// TYPES
// ============================================================

interface TopicFocus {
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
}

interface ContentIntelligence {
  detectedTopicFocus: TopicFocus;
  contentType: string;
  primaryAudience: {
    role: string;
    expertiseLevel: string;
    intent: string;
  };
  coreEntities: Array<{
    name: string;
    type: string;
    role: string;
    isExplained: boolean;
    mentionCount: number;
    sections: string[];
  }>;
  topicHierarchy: {
    broadCategory: string;
    specificNiche: string;
    exactFocus: string;
  };
  semanticClusters: Array<{
    clusterName: string;
    concepts: string[];
    coverageDepth: string;
  }>;
  contentStructure: Record<string, boolean>;
  implicitKnowledge: string[];
}

interface PrimaryQueryResult {
  query: string;
  searchIntent: string;
  confidence: number;
  reasoning: string;
  variants: Array<{
    query: string;
    popularity: string;
  }>;
}

interface QuerySuggestion {
  // EXISTING FIELDS
  query: string;
  intentType: string;
  matchStrength: 'strong' | 'partial' | 'weak';
  matchReason: string;
  relevantSection: string | null;
  confidence: number;
  searchVolumeTier?: string;
  competitiveness?: string;
  
  // INTENT PRESERVATION SCORING (Google Patent US 11,615,106)
  variantType: 'SYNONYM' | 'GRANULAR' | 'SPECIFICATION' | 'TEMPORAL' | 'RELATED';
  semanticSimilarity: number;        // 0-1 (to primary query)
  entityOverlap: number;             // 0-1 (shared entities ratio)
  intentScore: number;               // (semantic × 0.7) + (entity × 0.3)
  intentCategory: 'HIGH' | 'MEDIUM' | 'LOW';
  
  // ROUTE PREDICTION (Apple research)
  routePrediction: 'WEB_SEARCH' | 'PARAMETRIC' | 'HYBRID';
  routeConfidence: number;           // 0-100
  
  // ENTITY ANALYSIS
  primaryQueryEntities: string[];
  suggestedQueryEntities: string[];
  sharedEntities: string[];
  
  // DRIFT DETECTION
  driftReason: string | null;        // If intentCategory is LOW
}

interface QuerySuggestionsResponse {
  suggestions: QuerySuggestion[];
  summary: {
    total_generated: number;
    high_intent: number;
    medium_intent: number;
    low_intent: number;
    filtered_count: number;
    avg_intent_score: number;
    web_search_likely: number;
    parametric_likely: number;
    hybrid_likely: number;
  };
}

interface CoverageGap {
  gapType: string;
  query: string;
  intentType: string;
  severity: 'critical' | 'important' | 'nice-to-have';
  reason: string;
  evidence: string;
  suggestedFix: string;
  relatedEntities: string[];
  estimatedEffort: string;
}

// ============================================================
// ROBUST JSON PARSING
// ============================================================

function parseAIResponse(response: string, defaultValue: any = null): any {
  // First, try direct parsing
  try {
    return JSON.parse(response);
  } catch (e) {
    console.log('Direct JSON parse failed, attempting recovery...');
  }

  // Try to extract JSON from markdown code blocks
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (e) {
      console.log('Code block JSON parse failed');
    }
  }

  // Try to find JSON object boundaries
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.log('JSON object extraction failed');
    }
  }

  // Attempt to fix common truncation issues
  let cleaned = response.trim();
  
  // Fix unterminated strings by finding the last complete property
  const lastCompleteComma = cleaned.lastIndexOf('",');
  const lastCompleteBrace = cleaned.lastIndexOf('"}');
  const lastCompletePosition = Math.max(lastCompleteComma, lastCompleteBrace);
  
  if (lastCompletePosition > 0) {
    // Truncate to last complete property and try to close the structure
    let truncated = cleaned.substring(0, lastCompletePosition + 2);
    
    // Count open braces and brackets to close them
    const openBraces = (truncated.match(/\{/g) || []).length;
    const closeBraces = (truncated.match(/\}/g) || []).length;
    const openBrackets = (truncated.match(/\[/g) || []).length;
    const closeBrackets = (truncated.match(/\]/g) || []).length;
    
    // Close any unclosed structures
    truncated += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
    truncated += '}'.repeat(Math.max(0, openBraces - closeBraces));
    
    try {
      const result = JSON.parse(truncated);
      console.log('JSON recovered after truncation fix');
      return result;
    } catch (e) {
      console.log('Truncation fix failed:', e);
    }
  }

  // Last resort: try to extract array content
  const arrayMatch = response.match(/\[[\s\S]*?\]/);
  if (arrayMatch) {
    try {
      return { items: JSON.parse(arrayMatch[0]) };
    } catch (e) {
      console.log('Array extraction failed');
    }
  }

  console.error('All JSON parsing attempts failed, returning default');
  return defaultValue;
}

// ============================================================
// AI HELPER - Uses OpenAI GPT-5.2
// ============================================================

async function callAI(
  systemPrompt: string,
  userContent: string,
  responseFormat: 'json_object' | 'text',
  maxTokens: number
): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_completion_tokens: maxTokens,
      temperature: 0.7,
      response_format: responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again in a moment.');
    }
    if (response.status === 402) {
      throw new Error('AI credits exhausted. Please add credits to continue.');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${errorData.error?.message || response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}
