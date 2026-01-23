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

  const startTime = Date.now();
  const TIMEOUT_THRESHOLD_MS = 50000; // 50 seconds - leave 10s buffer

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
    
    // Check elapsed time before Step 4 (expensive step)
    const elapsedAfterStep2 = Date.now() - startTime;
    console.log(`Elapsed after Step 2: ${elapsedAfterStep2}ms`);
    
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
    
    // Check if we have time for gap analysis
    const elapsedAfterStep3 = Date.now() - startTime;
    console.log(`Elapsed after Step 3: ${elapsedAfterStep3}ms`);
    
    let coverageGaps: CoverageGapsAnalysis;
    let isPartial = false;
    
    if (elapsedAfterStep3 < TIMEOUT_THRESHOLD_MS) {
      // Step 5: Detect coverage gaps (if we have time)
      console.log('Step 4: Detecting coverage gaps...');
      coverageGaps = await detectCoverageGaps(
        content, 
        contentIntelligence, 
        topicFocus,
        querySuggestionsResponse.suggestions
      );
      console.log('Detected gaps:', coverageGaps.critical_gaps?.length || 0, 'critical,', coverageGaps.legacy_gaps?.length || 0, 'legacy');
    } else {
      // Skip gap analysis to avoid timeout - return partial results
      console.log('Step 4: SKIPPED (timeout threshold reached, elapsed:', elapsedAfterStep3, 'ms)');
      isPartial = true;
      coverageGaps = buildMinimalGapAnalysis(querySuggestionsResponse.suggestions);
    }

    const totalElapsed = Date.now() - startTime;
    console.log(`Total elapsed: ${totalElapsed}ms, partial: ${isPartial}`);

    return new Response(
      JSON.stringify({
        success: true,
        partial: isPartial,
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
        elapsed_ms: totalElapsed,
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

  const response = await callAI(systemPrompt, userPrompt, 'json_object', 6144);
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
// STEP 4: DETECT COVERAGE GAPS WITH ITERATIVE DEEP RESEARCH
// Based on Perplexity's Deep Research methodology
// ============================================================

async function detectCoverageGaps(
  content: string,
  intelligence: ContentIntelligence,
  topicFocus: TopicFocus,
  suggestions: QuerySuggestion[]
): Promise<CoverageGapsAnalysis> {
  
  // Pre-compute intent coverage stats
  const intentCoverage = {
    definition: suggestions.filter(s => s.intentType === 'definition' && s.matchStrength === 'strong').length,
    process: suggestions.filter(s => s.intentType === 'process' && s.matchStrength === 'strong').length,
    comparison: suggestions.filter(s => s.intentType === 'comparison' && s.matchStrength === 'strong').length,
    evaluation: suggestions.filter(s => s.intentType === 'evaluation' && s.matchStrength === 'strong').length,
    problem: suggestions.filter(s => s.intentType === 'problem' && s.matchStrength === 'strong').length,
    specification: suggestions.filter(s => s.intentType === 'specification' && s.matchStrength === 'strong').length,
  };

  // Pre-compute coverage statistics for summary
  const coverageStats = {
    total: suggestions.length,
    strong: suggestions.filter(s => s.matchStrength === 'strong').length,
    partial: suggestions.filter(s => s.matchStrength === 'partial').length,
    weak: suggestions.filter(s => s.matchStrength === 'weak').length,
    none: suggestions.filter(s => !s.matchStrength).length,
  };

  // Identify HIGH/MEDIUM intent queries with gaps (focus for deep analysis)
  const criticalCandidates = suggestions.filter(s => 
    (s.intentCategory === 'HIGH' || s.intentCategory === 'MEDIUM') &&
    (s.matchStrength === 'weak' || s.matchStrength === 'partial' || !s.matchStrength)
  );

  // Identify WEB_SEARCH queries (higher competitive value)
  const webSearchGaps = criticalCandidates.filter(s => s.routePrediction === 'WEB_SEARCH');

  const systemPrompt = `You are a content strategist using Perplexity-style ITERATIVE DEEP RESEARCH methodology.

The content is about "${topicFocus.primaryEntity}" (${topicFocus.contentPurpose}).

You have received query suggestions with INTENT PRESERVATION SCORES from the previous analysis step.
Your job: Perform deep gap analysis focusing on HIGH-VALUE gaps and generate actionable follow-up queries.

=== TASK 1: CRITICAL GAP ANALYSIS ===

For each query where:
- intentCategory = HIGH or MEDIUM
- matchStrength = weak, partial, or none
- routePrediction = WEB_SEARCH (higher priority)

Analyze:

1. CURRENT COVERAGE STATUS:
   - "none": Content doesn't address this at all
   - "weak": Content mentions tangentially but lacks depth
   - "partial": Content addresses some aspects but missing key elements

2. MISSING ELEMENTS: What specific facts, sections, or details are needed?
   Be specific: "Missing: specific timeframe (e.g., '60-90 days'), phase breakdown, cost implications"

3. COMPETITIVE VALUE:
   - "critical": Competitors definitely cover this (you're at a disadvantage)
   - "high": Likely covered by competitors (important gap)
   - "medium": Some competitors cover this (nice to have)
   - "low": Niche topic, low competitive pressure

4. ESTIMATED EFFORT:
   - "quick_fix": Add 1-2 sentences or a bullet list (5-10 min)
   - "moderate": Add new paragraph or subsection (20-30 min)
   - "major_rewrite": Requires new section or significant restructuring (60+ min)

5. RECOMMENDATION: Specific, actionable instruction.
   Example: "Add subsection 'Implementation Timeline' with phase breakdown: Week 1-2 (kickoff), Week 3-6 (training). Include specific timeframes. 250-300 words."

=== TASK 2: FOLLOW-UP QUERY GENERATION (Perplexity Deep Research) ===

For each CRITICAL gap (HIGH intent + no/weak coverage + WEB_SEARCH):
Generate 2-3 follow-up queries that would help fill this gap.

FOLLOW-UP QUERY TYPES:
- CLARIFICATION: More specific version ("RPO costs" → "average RPO cost per hire 2026")
- SPECIFICATION: Adding context ("RPO implementation" → "RPO implementation timeline for startups")
- DECOMPOSITION: Breaking into sub-queries ("RPO pricing models" → "per-hire RPO pricing", "retained RPO pricing")
- ALTERNATIVE: Different angle ("RPO vendor selection" → "questions to ask RPO vendor before signing")

For each follow-up query, specify:
- Which gap it targets
- What content would answer it
- Priority (critical/high/medium/low)

=== TASK 3: COMPETITIVE GAP ANALYSIS ===

Identify gaps where competitors likely have an advantage:

COMMON COMPETITIVE GAPS:
- pricing: Specific price ranges, cost breakdowns, pricing model comparisons
- comparison: Direct competitor comparisons, feature matrices, pros/cons
- case_study: Real examples, customer stories, success metrics
- specific_detail: Numbers, dates, timeframes, technical specs
- process: Step-by-step guides, implementation checklists
- timeline: Duration estimates, milestone schedules

For each gap, explain:
- What competitors likely provide
- Why users search for this
- How difficult to close this gap
- Recommendation

=== TASK 4: PRIORITY ACTION LIST ===

Rank top 5-10 actions by:
- Impact (how many HIGH intent queries improved?)
- Effort (quick vs major work)
- Competitive urgency (are competitors winning here?)

For each action:
- Rank (1, 2, 3...)
- Clear action description
- Target queries it helps
- Impact and effort estimate
- Expected improvement: "Would improve 3 HIGH intent queries from weak to strong"

=== OUTPUT FORMAT (JSON) ===

{
  "critical_gaps": [
    {
      "query": "the specific query that reveals this gap",
      "intentScore": 0.78,
      "intentCategory": "HIGH",
      "routePrediction": "WEB_SEARCH",
      "currentCoverage": "weak",
      "missingElements": ["Specific element 1", "Specific element 2"],
      "competitiveValue": "critical",
      "estimatedEffort": "moderate",
      "recommendation": "Specific actionable recommendation"
    }
  ],
  "follow_up_queries": [
    {
      "query": "the follow-up query",
      "targetGap": "which critical gap this addresses",
      "queryType": "SPECIFICATION",
      "expectedCoverage": "What content would answer this",
      "priority": "high"
    }
  ],
  "competitive_gaps": [
    {
      "query": "the query revealing competitive gap",
      "gapType": "pricing",
      "competitorAdvantage": "What competitors likely provide",
      "difficulty": "moderate",
      "recommendation": "How to address this gap"
    }
  ],
  "priority_actions": [
    {
      "rank": 1,
      "action": "Clear action description",
      "targetQueries": ["query1", "query2"],
      "impact": "critical",
      "effort": "moderate",
      "expectedImprovement": "Would improve X queries from Y to Z coverage"
    }
  ],
  "legacy_gaps": [
    {
      "gapType": "missing_intent|incomplete_entity|journey_gap|audience_gap|objection_gap",
      "query": "The specific search query this gap represents",
      "intentType": "definition|process|comparison|evaluation|problem|specification",
      "severity": "critical|important|nice-to-have",
      "reason": "Why this gap matters",
      "evidence": "What reveals this gap",
      "suggestedFix": "How to address this gap",
      "relatedEntities": ["entity1", "entity2"],
      "estimatedEffort": "small|medium|large"
    }
  ]
}`;

  // Build context from suggestions
  const criticalCandidatesText = criticalCandidates.slice(0, 20).map(s => 
    `- "${s.query}" | Intent: ${s.intentCategory} (${s.intentScore?.toFixed(2) || 'N/A'}) | Route: ${s.routePrediction} | Coverage: ${s.matchStrength} | Reason: ${s.matchReason}`
  ).join('\n') || '(none)';

  const webSearchGapsText = webSearchGaps.slice(0, 10).map(s =>
    `- "${s.query}" | Score: ${s.intentScore?.toFixed(2) || 'N/A'} | Coverage: ${s.matchStrength}`
  ).join('\n') || '(none)';

  const unexplainedEntities = intelligence.coreEntities
    ?.filter(e => !e.isExplained && e.role !== 'example')
    .map(e => `- ${e.name} (${e.type}, mentioned ${e.mentionCount}x)`)
    .join('\n') || '(none)';

  const implicitKnowledge = intelligence.implicitKnowledge?.map(k => `- ${k}`).join('\n') || '(none)';

  const userPrompt = `PRIMARY TOPIC: ${topicFocus.primaryEntity}
CONTENT PURPOSE: ${topicFocus.contentPurpose}
TARGET AUDIENCE: ${intelligence.primaryAudience?.role || 'Unknown'} (${intelligence.primaryAudience?.expertiseLevel || 'Unknown'})

=== COVERAGE STATISTICS ===
Total suggestions: ${coverageStats.total}
- Strong coverage: ${coverageStats.strong}
- Partial coverage: ${coverageStats.partial}
- Weak coverage: ${coverageStats.weak}
- No coverage: ${coverageStats.none}

=== INTENT COVERAGE (strong matches only) ===
- Definition queries: ${intentCoverage.definition} ${intentCoverage.definition === 0 ? '⚠️ MISSING' : ''}
- Process queries: ${intentCoverage.process} ${intentCoverage.process === 0 ? '⚠️ MISSING' : ''}
- Comparison queries: ${intentCoverage.comparison} ${intentCoverage.comparison === 0 ? '⚠️ MISSING' : ''}
- Evaluation queries: ${intentCoverage.evaluation} ${intentCoverage.evaluation === 0 ? '⚠️ MISSING' : ''}
- Problem queries: ${intentCoverage.problem} ${intentCoverage.problem === 0 ? '⚠️ MISSING' : ''}
- Specification queries: ${intentCoverage.specification} ${intentCoverage.specification === 0 ? '⚠️ MISSING' : ''}

=== CRITICAL GAP CANDIDATES (HIGH/MEDIUM intent + weak/no coverage) ===
${criticalCandidatesText}

=== WEB SEARCH GAPS (highest competitive priority) ===
${webSearchGapsText}

=== ENTITIES MENTIONED BUT NOT EXPLAINED ===
${unexplainedEntities}

=== IMPLICIT KNOWLEDGE ASSUMPTIONS ===
${implicitKnowledge}

=== FULL SUGGESTIONS DATA FOR CONTEXT ===
${JSON.stringify(suggestions.slice(0, 30), null, 2)}

Perform iterative deep research gap analysis for "${topicFocus.primaryEntity}" content:`;

  const response = await callAI(systemPrompt, userPrompt, 'json_object', 10240);
  const parsed = parseAIResponse(response, { 
    critical_gaps: [], 
    follow_up_queries: [], 
    competitive_gaps: [],
    priority_actions: [],
    legacy_gaps: []
  });
  
  // Build the comprehensive analysis response
  const analysis: CoverageGapsAnalysis = {
    // Legacy fields for backward compatibility
    missing_queries: (parsed.legacy_gaps || [])
      .filter((g: LegacyGap) => g.severity === 'critical')
      .map((g: LegacyGap) => g.query),
    weak_queries: (parsed.legacy_gaps || [])
      .filter((g: LegacyGap) => g.severity === 'important')
      .map((g: LegacyGap) => g.query),
    opportunities: (parsed.legacy_gaps || [])
      .filter((g: LegacyGap) => g.severity === 'nice-to-have')
      .map((g: LegacyGap) => g.query),
    
    // New enhanced fields
    critical_gaps: parsed.critical_gaps || [],
    follow_up_queries: parsed.follow_up_queries || [],
    competitive_gaps: parsed.competitive_gaps || [],
    priority_actions: parsed.priority_actions || [],
    
    // Gap summary statistics
    gap_summary: {
      total_suggestions: coverageStats.total,
      strong_coverage: coverageStats.strong,
      partial_coverage: coverageStats.partial,
      weak_coverage: coverageStats.weak,
      no_coverage: coverageStats.none,
      critical_gaps: (parsed.critical_gaps || []).filter((g: CriticalGap) => g.intentCategory === 'HIGH').length,
      opportunity_gaps: (parsed.critical_gaps || []).filter((g: CriticalGap) => 
        g.intentCategory === 'HIGH' && g.currentCoverage === 'weak'
      ).length,
      low_priority_gaps: (parsed.critical_gaps || []).filter((g: CriticalGap) => 
        g.intentCategory === 'MEDIUM' || g.intentCategory === 'LOW'
      ).length,
    },
    
    // Include legacy gaps for full compatibility
    legacy_gaps: parsed.legacy_gaps || parsed.gaps || [],
  };
  
  return analysis;
}

// Helper function to build minimal gap analysis when skipping Step 4 for timeout
function buildMinimalGapAnalysis(suggestions: QuerySuggestion[]): CoverageGapsAnalysis {
  const coverageStats = {
    total: suggestions.length,
    strong: suggestions.filter(s => s.matchStrength === 'strong').length,
    partial: suggestions.filter(s => s.matchStrength === 'partial').length,
    weak: suggestions.filter(s => s.matchStrength === 'weak').length,
    none: suggestions.filter(s => !s.matchStrength).length,
  };

  // Build critical gaps from HIGH intent + weak coverage
  const criticalGapsFromSuggestions: CriticalGap[] = suggestions
    .filter(s => 
      s.intentCategory === 'HIGH' &&
      (s.matchStrength === 'weak' || !s.matchStrength) &&
      s.routePrediction === 'WEB_SEARCH'
    )
    .slice(0, 5)
    .map(s => ({
      query: s.query,
      intentScore: s.intentScore || 0.75,
      intentCategory: 'HIGH' as const,
      routePrediction: s.routePrediction || 'WEB_SEARCH',
      currentCoverage: (s.matchStrength || 'none') as 'none' | 'weak' | 'partial',
      missingElements: ['Full gap analysis skipped - run again for detailed recommendations'],
      competitiveValue: 'high' as const,
      estimatedEffort: 'moderate' as const,
      recommendation: `This HIGH intent query has ${s.matchStrength || 'no'} coverage. Consider adding content to address: "${s.query}"`,
    }));

  return {
    missing_queries: [],
    weak_queries: [],
    opportunities: [],
    critical_gaps: criticalGapsFromSuggestions,
    follow_up_queries: [],
    competitive_gaps: [],
    priority_actions: criticalGapsFromSuggestions.slice(0, 3).map((g, i) => ({
      rank: i + 1,
      action: `Address gap: "${g.query}"`,
      targetQueries: [g.query],
      impact: 'high' as const,
      effort: 'moderate' as const,
      expectedImprovement: 'Would improve coverage for HIGH intent query',
    })),
    gap_summary: {
      total_suggestions: coverageStats.total,
      strong_coverage: coverageStats.strong,
      partial_coverage: coverageStats.partial,
      weak_coverage: coverageStats.weak,
      no_coverage: coverageStats.none,
      critical_gaps: criticalGapsFromSuggestions.length,
      opportunity_gaps: 0,
      low_priority_gaps: 0,
    },
    legacy_gaps: [],
  };
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

// ============================================================
// COVERAGE GAP ANALYSIS TYPES (Perplexity Deep Research)
// ============================================================

interface CriticalGap {
  query: string;                          // The query we can't answer
  intentScore: number;                    // From Step 3
  intentCategory: 'HIGH' | 'MEDIUM' | 'LOW';
  routePrediction: 'WEB_SEARCH' | 'PARAMETRIC' | 'HYBRID';
  currentCoverage: 'none' | 'weak' | 'partial';
  missingElements: string[];              // Specific facts/sections needed
  competitiveValue: 'critical' | 'high' | 'medium' | 'low';
  estimatedEffort: 'quick_fix' | 'moderate' | 'major_rewrite';
  recommendation: string;                 // What to do about it
}

interface FollowUpQuery {
  query: string;                          // The follow-up query
  targetGap: string;                      // Which gap this addresses
  queryType: 'CLARIFICATION' | 'SPECIFICATION' | 'DECOMPOSITION' | 'ALTERNATIVE';
  expectedCoverage: string;               // What content would answer this
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface GapSummary {
  total_suggestions: number;              // From Step 3
  strong_coverage: number;                // matchStrength = strong
  partial_coverage: number;               // matchStrength = partial
  weak_coverage: number;                  // matchStrength = weak
  no_coverage: number;                    // matchStrength not present or none
  critical_gaps: number;                  // HIGH intent + no coverage
  opportunity_gaps: number;               // HIGH intent + weak coverage
  low_priority_gaps: number;              // MEDIUM/LOW intent + no coverage
}

interface CompetitiveGap {
  query: string;
  gapType: 'pricing' | 'comparison' | 'case_study' | 'specific_detail' | 'process' | 'timeline';
  competitorAdvantage: string;            // What competitors likely provide
  difficulty: 'easy' | 'moderate' | 'hard';
  recommendation: string;
}

interface PriorityAction {
  rank: number;                           // 1, 2, 3...
  action: string;                         // "Add pricing section"
  targetQueries: string[];                // Which queries this helps
  impact: 'critical' | 'high' | 'medium' | 'low';
  effort: 'quick' | 'moderate' | 'major';
  expectedImprovement: string;            // "Would improve 5 HIGH intent queries from weak to strong"
}

interface LegacyGap {
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

interface CoverageGapsAnalysis {
  // Legacy fields for backward compatibility
  missing_queries: string[];
  weak_queries: string[];
  opportunities: string[];
  
  // New enhanced fields (Perplexity Deep Research)
  critical_gaps: CriticalGap[];           // High-priority gaps requiring attention
  follow_up_queries: FollowUpQuery[];     // Generated queries targeting gaps
  gap_summary: GapSummary;                // Statistics about coverage
  competitive_gaps: CompetitiveGap[];     // What competitors likely cover
  priority_actions: PriorityAction[];     // Ranked list of what to fix first
  
  // Legacy gaps for full compatibility
  legacy_gaps: LegacyGap[];
}

// Legacy type alias for backward compatibility
type CoverageGap = LegacyGap;

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
