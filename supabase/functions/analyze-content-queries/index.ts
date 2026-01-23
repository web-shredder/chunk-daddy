import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// ============================================================
// GOOGLE PATENT US 11,663,201 B2 - 7 ACTUAL VARIANT TYPES
// (8th is LANGUAGE_TRANSLATION - skipped unless multilingual)
// ============================================================
type GoogleVariantType = 
  | 'EQUIVALENT'        // Alternative ways to ask the same question
  | 'FOLLOW_UP'         // Logical next questions in user journey
  | 'GENERALIZATION'    // Broader versions of the query
  | 'CANONICALIZATION'  // Standardized/normalized forms (expand acronyms)
  | 'ENTAILMENT'        // Queries logically implied by the original
  | 'SPECIFICATION'     // Narrower, more detailed versions
  | 'CLARIFICATION';    // Disambiguation queries

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const TIMEOUT_THRESHOLD_MS = 85000; // 85 seconds

  try {
    const { content, existingQueries = [], topicOverride = null } = await req.json();

    if (!content || content.trim().length < 100) {
      return new Response(
        JSON.stringify({ error: 'Content must be at least 100 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('=== QUERY INTELLIGENCE START ===');
    console.log('Content length:', content.length);
    console.log('Existing queries:', existingQueries.length);
    console.log('Topic override:', topicOverride);

    // STEP 1: Extract PRIMARY entities (foundation for drift detection)
    console.log('Step 1: Extracting entities...');
    const entities = await extractEntities(content);
    console.log('Primary entities:', entities.primary.join(', '));
    console.log('Temporal entities:', entities.temporal.join(', '));

    // STEP 2: Extract content intelligence 
    console.log('Step 2: Extracting content intelligence...');
    const intelligence = await extractContentIntelligence(content, entities);
    const topicFocus = topicOverride 
      ? { ...intelligence.detectedTopicFocus, primaryEntity: topicOverride }
      : intelligence.detectedTopicFocus;
    console.log('Detected topic:', topicFocus.primaryEntity);
    
    // STEP 3: Generate the PRIMARY query
    console.log('Step 3: Generating primary query...');
    const primaryQuery = await generatePrimaryQuery(content, intelligence, topicFocus, entities);
    console.log('Primary query:', primaryQuery.query);
    
    const elapsedAfterStep3 = Date.now() - startTime;
    console.log(`Elapsed after Step 3: ${elapsedAfterStep3}ms`);
    
    // STEP 4: Generate variants using Google's 7 types
    console.log('Step 4: Generating query variants (Google Patent)...');
    const variantsResult = await generateQueryVariants(
      content, 
      intelligence, 
      topicFocus,
      primaryQuery,
      entities,
      existingQueries
    );
    
    // STEP 5: Calculate intent scores & filter drift (iPullRank methodology)
    console.log('Step 5: Scoring & filtering drift...');
    const { kept, filtered, suggestionsByType } = processVariantsWithScoring(
      variantsResult.variants,
      entities
    );
    
    console.log(`Generated: ${variantsResult.variants.length}, Kept: ${kept.length}, Filtered: ${filtered.length}`);
    
    // STEP 6: Add route predictions
    console.log('Step 6: Adding route predictions...');
    const suggestionsWithRoutes = kept.map(v => ({
      ...v,
      routePrediction: predictQueryRoute(v.query, entities)
    }));

    // Calculate summary
    const summary = buildSummary(suggestionsWithRoutes, filtered);
    console.log('Intent distribution: HIGH=%d, MEDIUM=%d, LOW(filtered)=%d', 
      summary.high_intent, summary.medium_intent, filtered.length);

    // STEP 7: Gap analysis (if time permits)
    const elapsedAfterStep6 = Date.now() - startTime;
    console.log(`Elapsed after Step 6: ${elapsedAfterStep6}ms`);
    
    let coverageGaps: CoverageGapsAnalysis;
    let isPartial = false;
    
    if (elapsedAfterStep6 < TIMEOUT_THRESHOLD_MS) {
      console.log('Step 7: Detecting coverage gaps...');
      coverageGaps = await detectCoverageGaps(
        content, intelligence, topicFocus, suggestionsWithRoutes, entities
      );
    } else {
      console.log('Step 7: SKIPPED (timeout threshold)');
      isPartial = true;
      coverageGaps = buildMinimalGapAnalysis(suggestionsWithRoutes);
    }

    const totalElapsed = Date.now() - startTime;
    console.log(`=== COMPLETE: ${totalElapsed}ms, partial: ${isPartial} ===`);

    return new Response(
      JSON.stringify({
        success: true,
        partial: isPartial,
        
        // Entities (foundation of everything)
        entities,
        
        // Topic detection
        detectedTopic: intelligence.detectedTopicFocus,
        activeTopic: topicFocus,
        isOverridden: !!topicOverride,
        
        // Primary query with route prediction
        primaryQuery: {
          ...primaryQuery,
          routePrediction: predictQueryRoute(primaryQuery.query, entities)
        },
        
        // Full intelligence
        intelligence,
        
        // Grouped by Google's variant types (for UI)
        suggestionsByType,
        
        // Flat list of kept queries (HIGH + MEDIUM only)
        suggestions: suggestionsWithRoutes,
        suggestionsSummary: summary,
        
        // What was filtered (transparency)
        filtered,
        
        // Gap analysis
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
// STEP 1: ENTITY EXTRACTION (iPullRank Foundation)
// Primary entities MUST be preserved in HIGH intent variants
// ============================================================

interface ExtractedEntities {
  primary: string[];      // MUST appear in HIGH intent variants
  secondary: string[];    // Supporting concepts
  temporal: string[];     // Time markers - affect routing
  branded: string[];      // Proper nouns, products, companies
}

async function extractEntities(content: string): Promise<ExtractedEntities> {
  const systemPrompt = `You extract search entities for intent preservation scoring. You must respond with valid JSON.

CRITICAL: PRIMARY entities are the foundation for detecting "intent drift" - queries that lose primary entities serve DIFFERENT user intents.

Extract into these categories:

PRIMARY ENTITIES:
- Core subjects that define what this content is fundamentally about
- These MUST appear in high-intent search queries
- Examples: Main product/service names, core concepts, key technologies

SECONDARY ENTITIES:
- Supporting concepts that add specificity
- Nice to have but not required for intent preservation

TEMPORAL ENTITIES:
- Time markers: years ("2024"), relative time ("current", "latest", "new")
- Version numbers, release dates
- These affect whether queries trigger web search

BRANDED ENTITIES:
- Company names, product names, proper nouns
- Trademarks, frameworks, tools

Return ONLY valid JSON:
{
  "primary": ["entity1", "entity2"],
  "secondary": ["entity1", "entity2"],
  "temporal": ["2024", "current"],
  "branded": ["CompanyName", "ProductName"]
}`;

  const response = await callAI(systemPrompt, content.slice(0, 4000), 'json_object', 1024);
  const parsed = parseAIResponse(response, {
    primary: [],
    secondary: [],
    temporal: [],
    branded: []
  });
  
  return {
    primary: parsed.primary || [],
    secondary: parsed.secondary || [],
    temporal: parsed.temporal || [],
    branded: parsed.branded || []
  };
}

// ============================================================
// STEP 2: CONTENT INTELLIGENCE
// ============================================================

async function extractContentIntelligence(
  content: string, 
  entities: ExtractedEntities
): Promise<ContentIntelligence> {
  const systemPrompt = `You analyze content to determine its primary topic and purpose. You must respond with valid JSON.

TASK: Identify EXACTLY what this content is about - what is "X"?

OUTPUT FORMAT (JSON):
{
  "detectedTopicFocus": {
    "primaryEntity": "The main thing (X) this content is about",
    "entityType": "product|service|concept|process|tool|company|industry",
    "contentPurpose": "explain|compare|guide|teach|sell|review|troubleshoot",
    "targetAction": "What the reader wants to DO",
    "confidence": 0.0-1.0
  },
  "contentType": "guide|comparison|how-to|listicle|reference|landing-page",
  "primaryAudience": {
    "role": "Who is this written for",
    "expertiseLevel": "beginner|intermediate|advanced|mixed",
    "intent": "What they're trying to accomplish"
  },
  "coreEntities": [
    {
      "name": "Entity name",
      "type": "product|company|concept|technology|process",
      "role": "primary|secondary|competitor|example",
      "isExplained": true,
      "mentionCount": 5
    }
  ],
  "topicHierarchy": {
    "broadCategory": "General field",
    "specificNiche": "Specific area",
    "exactFocus": "Precise topic"
  },
  "contentStructure": {
    "hasDefinition": true,
    "hasProcess": false,
    "hasComparison": true,
    "hasPricing": false,
    "hasExamples": true,
    "hasFAQ": false
  }
}`;

  const response = await callAI(systemPrompt, content.slice(0, 8000), 'json_object', 2048);
  return parseAIResponse(response, {
    detectedTopicFocus: {
      primaryEntity: entities.primary[0] || 'Unknown topic',
      entityType: 'concept',
      contentPurpose: 'explain',
      targetAction: 'learn about the topic',
      confidence: 0.5,
    },
    contentType: 'guide',
    primaryAudience: { role: 'general reader', expertiseLevel: 'mixed', intent: 'learn' },
    coreEntities: [],
    topicHierarchy: { broadCategory: 'General', specificNiche: 'Unknown', exactFocus: 'Unknown' },
    contentStructure: {},
  });
}

// ============================================================
// STEP 3: GENERATE PRIMARY QUERY
// ============================================================

async function generatePrimaryQuery(
  content: string,
  intelligence: ContentIntelligence,
  topicFocus: TopicFocus,
  entities: ExtractedEntities
): Promise<PrimaryQueryResult> {
  const systemPrompt = `Generate the ONE PRIMARY SEARCH QUERY this content should rank #1 for. You must respond with valid JSON.

This is the "money query" - the search someone would type that this content PERFECTLY answers.

RULES:
1. Must be natural language (how real humans search)
2. Must be 5-15 words
3. Must contain ALL primary entities: ${entities.primary.join(', ')}
4. Should be the most valuable/high-intent version

OUTPUT FORMAT (JSON):
{
  "query": "The primary query (5-15 words)",
  "searchIntent": "informational|navigational|transactional|commercial",
  "confidence": 0.95,
  "reasoning": "Why this is THE primary query"
}`;

  const userPrompt = `TOPIC: ${topicFocus.primaryEntity}
PURPOSE: ${topicFocus.contentPurpose}
PRIMARY ENTITIES (MUST include): ${entities.primary.join(', ')}

CONTENT:
${content.slice(0, 2000)}`;

  const response = await callAI(systemPrompt, userPrompt, 'json_object', 512);
  return parseAIResponse(response, {
    query: `What is ${topicFocus.primaryEntity}`,
    searchIntent: 'informational',
    confidence: 0.5,
    reasoning: 'Default fallback query',
  });
}

// ============================================================
// STEP 4: GENERATE VARIANTS (Google Patent US 11,663,201 B2)
// ============================================================

async function generateQueryVariants(
  content: string,
  intelligence: ContentIntelligence,
  topicFocus: TopicFocus,
  primaryQuery: PrimaryQueryResult,
  entities: ExtractedEntities,
  existingQueries: string[]
): Promise<{ variants: QueryVariant[] }> {
  
  const systemPrompt = `You generate search query variants following Google's Query Fan-Out methodology (Patent US 11,663,201 B2). You must respond with valid JSON.

PRIMARY QUERY: "${primaryQuery.query}"
PRIMARY ENTITIES (MUST preserve in high-intent variants): ${entities.primary.join(', ')}

=== GOOGLE'S 7 VARIANT TYPES ===

1. EQUIVALENT (Generate 3)
   Alternative phrasings that ask the SAME question.
   CRITICAL: entityOverlap MUST be 1.0 (all primary entities present)

2. FOLLOW_UP (Generate 3)
   Logical NEXT questions in user journey.
   entityOverlap SHOULD be ≥ 0.7

3. GENERALIZATION (Generate 2)
   BROADER versions zooming out from specific query.
   entityOverlap CAN be ≥ 0.5

4. CANONICALIZATION (Generate 2)
   Standardized forms - expand acronyms, formal terminology.
   entityOverlap MUST be 1.0

5. ENTAILMENT (Generate 3)
   Queries logically IMPLIED by the original.
   entityOverlap SHOULD be ≥ 0.7

6. SPECIFICATION (Generate 3)
   NARROWER versions with qualifiers (industry, size, use case).
   entityOverlap MUST be ≥ 1.0 (keep all, add more)

7. CLARIFICATION (Generate 2)
   Disambiguation queries presenting alternatives.
   entityOverlap varies

=== INTENT DEGRADATION WARNING (iPullRank Research) ===

A variant has "drifted" if it serves a DIFFERENT user intent.
Example:
- Original: "best electric cars" (PURCHASE intent)
- Drifted: "electric car maintenance costs" (OWNERSHIP intent)

Variants losing primary entities = INTENT DRIFT = useless for ranking.

=== OUTPUT FORMAT (JSON) ===

For EACH query provide a JSON object with:
{
  "query": "Full search query (8-20 words)",
  "variantType": "EQUIVALENT|FOLLOW_UP|GENERALIZATION|CANONICALIZATION|ENTAILMENT|SPECIFICATION|CLARIFICATION",
  "sharedEntities": ["entities from primary that appear here"],
  "entityOverlap": 0.0-1.0,
  "semanticEstimate": 0.0-1.0,
  "userJourneyPosition": "early|middle|late"
}

Return ONLY valid JSON:
{
  "variants": [...]
}`;

  const userPrompt = `TOPIC: ${topicFocus.primaryEntity}
PURPOSE: ${topicFocus.contentPurpose}
AUDIENCE: ${intelligence.primaryAudience?.role || 'general'} (${intelligence.primaryAudience?.expertiseLevel || 'mixed'})

EXISTING (skip these): ${existingQueries.slice(0, 10).join(', ') || 'none'}

CONTENT:
${content.slice(0, 3000)}

Generate 18 query variants following Google's 7 types:`;

  const response = await callAI(systemPrompt, userPrompt, 'json_object', 3000);
  const parsed = parseAIResponse(response, { variants: [] });
  
  let variants = parsed.variants || parsed.suggestions || [];
  
  // FALLBACK: If AI failed, generate from entities
  if (variants.length === 0 && entities.primary.length > 0) {
    console.log('Variant generation failed, using entity fallback');
    variants = generateFallbackVariants(entities, topicFocus.primaryEntity);
  }
  
  return { variants };
}

function generateFallbackVariants(entities: ExtractedEntities, topic: string): QueryVariant[] {
  const variants: QueryVariant[] = [];
  const primary = entities.primary[0] || topic;
  
  // EQUIVALENT
  variants.push({
    query: `what is ${primary}`,
    variantType: 'EQUIVALENT',
    sharedEntities: [primary],
    entityOverlap: 1.0,
    semanticEstimate: 0.9,
    userJourneyPosition: 'early',
    isFallback: true
  });
  
  // SPECIFICATION variants
  entities.secondary.slice(0, 3).forEach(sec => {
    variants.push({
      query: `${primary} for ${sec}`,
      variantType: 'SPECIFICATION',
      sharedEntities: [primary],
      entityOverlap: 1.0,
      semanticEstimate: 0.75,
      userJourneyPosition: 'middle',
      isFallback: true
    });
  });
  
  // FOLLOW_UP
  variants.push({
    query: `how much does ${primary} cost`,
    variantType: 'FOLLOW_UP',
    sharedEntities: [primary],
    entityOverlap: 1.0,
    semanticEstimate: 0.7,
    userJourneyPosition: 'late',
    isFallback: true
  });
  
  variants.push({
    query: `${primary} pros and cons`,
    variantType: 'FOLLOW_UP',
    sharedEntities: [primary],
    entityOverlap: 1.0,
    semanticEstimate: 0.75,
    userJourneyPosition: 'middle',
    isFallback: true
  });
  
  // GENERALIZATION
  variants.push({
    query: `${primary} overview and guide`,
    variantType: 'GENERALIZATION',
    sharedEntities: [primary],
    entityOverlap: 1.0,
    semanticEstimate: 0.8,
    userJourneyPosition: 'early',
    isFallback: true
  });
  
  return variants;
}

// ============================================================
// STEP 5: INTENT SCORE CALCULATION & DRIFT FILTERING
// Formula: intentScore = (semantic × 0.7) + (entityOverlap × 0.3)
// ============================================================

interface ProcessedResult {
  kept: QueryVariant[];
  filtered: FilteredVariant[];
  suggestionsByType: Record<GoogleVariantType, QueryVariant[]>;
}

function processVariantsWithScoring(
  variants: QueryVariant[],
  entities: ExtractedEntities
): ProcessedResult {
  const kept: QueryVariant[] = [];
  const filtered: FilteredVariant[] = [];
  const suggestionsByType: Record<GoogleVariantType, QueryVariant[]> = {
    EQUIVALENT: [],
    FOLLOW_UP: [],
    GENERALIZATION: [],
    CANONICALIZATION: [],
    ENTAILMENT: [],
    SPECIFICATION: [],
    CLARIFICATION: []
  };

  for (const variant of variants) {
    // Calculate actual entity overlap (verify AI's claim)
    const actualOverlap = calculateActualEntityOverlap(
      variant.query,
      variant.sharedEntities || [],
      entities.primary
    );
    
    // Use more conservative of AI's estimate vs actual
    const entityOverlap = Math.min(variant.entityOverlap || 0, actualOverlap);
    const semanticSimilarity = variant.semanticEstimate || 0.5;
    
    // Base formula from Google Patent (Dan Petrovic analysis)
    let intentScore = (semanticSimilarity * 0.7) + (entityOverlap * 0.3);
    
    // Apply variant-type-specific adjustments (iPullRank methodology)
    const variantType = variant.variantType as GoogleVariantType;
    intentScore = applyVariantTypeAdjustments(intentScore, variantType, entityOverlap, semanticSimilarity);
    
    // Classify
    const intentCategory = classifyIntent(intentScore);
    
    // Detect drift
    const driftReason = detectDrift(variant, entities.primary, entityOverlap, semanticSimilarity);
    
    // Update variant with calculated values
    const scoredVariant: QueryVariant = {
      ...variant,
      entityOverlap,
      intentScore,
      intentCategory,
      driftReason
    };
    
    if (intentCategory === 'LOW' || driftReason) {
      filtered.push({
        query: variant.query,
        variantType: variantType,
        intentScore,
        driftReason: driftReason || `Intent score ${(intentScore * 100).toFixed(0)}% below threshold`
      });
    } else {
      kept.push(scoredVariant);
      if (suggestionsByType[variantType]) {
        suggestionsByType[variantType].push(scoredVariant);
      }
    }
  }

  return { kept, filtered, suggestionsByType };
}

function calculateActualEntityOverlap(
  query: string,
  sharedEntities: string[],
  primaryEntities: string[]
): number {
  if (!primaryEntities || primaryEntities.length === 0) return 1.0;
  
  const queryLower = query.toLowerCase();
  let matchedCount = 0;
  
  for (const entity of primaryEntities) {
    const entityLower = entity.toLowerCase();
    // Check if entity appears in query (exact or partial match)
    if (queryLower.includes(entityLower) || 
        sharedEntities.some(se => 
          se.toLowerCase().includes(entityLower) || 
          entityLower.includes(se.toLowerCase())
        )) {
      matchedCount++;
    }
  }
  
  return matchedCount / primaryEntities.length;
}

function applyVariantTypeAdjustments(
  intentScore: number,
  variantType: GoogleVariantType,
  entityOverlap: number,
  semanticSimilarity: number
): number {
  switch (variantType) {
    case 'EQUIVALENT':
    case 'CANONICALIZATION':
      // These MUST have high entity overlap - penalize heavily if they don't
      if (entityOverlap < 0.9) {
        intentScore *= 0.7; // Major penalty - this is drift
      }
      break;
      
    case 'FOLLOW_UP':
    case 'ENTAILMENT':
      // These naturally diverge slightly - no penalty
      break;
      
    case 'GENERALIZATION':
      // Expected to be broader - boost if semantic stays high
      if (semanticSimilarity > 0.6 && entityOverlap >= 0.5) {
        intentScore += 0.05;
      }
      break;
      
    case 'SPECIFICATION':
      // Should ADD entities while keeping ALL originals
      if (entityOverlap >= 1.0) {
        intentScore += 0.1; // Bonus
      } else if (entityOverlap < 0.9) {
        intentScore *= 0.8; // Penalty
      }
      break;
      
    case 'CLARIFICATION':
      // High value even with lower entity overlap IF semantic is high
      if (semanticSimilarity >= 0.7) {
        intentScore = Math.max(intentScore, 0.6);
      }
      break;
  }
  
  return Math.min(1.0, Math.max(0, intentScore));
}

function classifyIntent(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 0.7) return 'HIGH';
  if (score >= 0.5) return 'MEDIUM';
  return 'LOW';
}

function detectDrift(
  variant: QueryVariant,
  primaryEntities: string[],
  entityOverlap: number,
  semanticSimilarity: number
): string | null {
  // Only flag LOW intent
  const intentScore = (semanticSimilarity * 0.7) + (entityOverlap * 0.3);
  if (intentScore >= 0.5) return null;
  
  if (entityOverlap < 0.3) {
    const queryLower = variant.query.toLowerCase();
    const missing = primaryEntities.filter(e => 
      !queryLower.includes(e.toLowerCase())
    );
    return `Entity loss: Lost "${missing.join('", "')}" - serves different intent`;
  }
  
  if (semanticSimilarity < 0.4) {
    return `Semantic drift: Low similarity (${(semanticSimilarity * 100).toFixed(0)}%) - tangential topic`;
  }
  
  const variantType = variant.variantType as GoogleVariantType;
  if ((variantType === 'EQUIVALENT' || variantType === 'CANONICALIZATION') && entityOverlap < 0.9) {
    return `Invalid ${variantType}: Should preserve all entities but only kept ${(entityOverlap * 100).toFixed(0)}%`;
  }
  
  return null;
}

// ============================================================
// STEP 6: ROUTE PREDICTION (Web Search vs Parametric)
// ============================================================

interface RouteInfo {
  route: 'WEB_SEARCH' | 'PARAMETRIC' | 'HYBRID';
  confidence: number;
  signals: RouteSignal[];
}

interface RouteSignal {
  type: 'temporal' | 'verification' | 'comparison' | 'transactional' | 'conceptual' | 'factual';
  detected: string;
  pushesTo: 'WEB_SEARCH' | 'PARAMETRIC';
}

function predictQueryRoute(query: string, entities: ExtractedEntities): RouteInfo {
  const signals: RouteSignal[] = [];
  const queryLower = query.toLowerCase();
  
  // TEMPORAL → WEB_SEARCH
  if (/\b(202[4-9]|2030)\b/i.test(query)) {
    signals.push({ type: 'temporal', detected: 'specific year', pushesTo: 'WEB_SEARCH' });
  }
  if (/\b(current|latest|recent|now|today|new)\b/i.test(query)) {
    signals.push({ type: 'temporal', detected: 'temporal marker', pushesTo: 'WEB_SEARCH' });
  }
  
  // Check if topic has temporal entities but query lacks them
  if (entities.temporal.length > 0) {
    const hasTemporal = entities.temporal.some(t => queryLower.includes(t.toLowerCase()));
    if (!hasTemporal) {
      signals.push({ type: 'temporal', detected: 'topic is temporal but query lacks markers', pushesTo: 'WEB_SEARCH' });
    }
  }
  
  // VERIFICATION → WEB_SEARCH
  if (/\b(is it true|does .+ still|has .+ changed|is .+ still)\b/i.test(query)) {
    signals.push({ type: 'verification', detected: 'verification question', pushesTo: 'WEB_SEARCH' });
  }
  
  // COMPARISON → WEB_SEARCH
  if (/\b(vs\.?|versus|compared to|better than|difference between)\b/i.test(query)) {
    signals.push({ type: 'comparison', detected: 'comparison query', pushesTo: 'WEB_SEARCH' });
  }
  
  // TRANSACTIONAL → WEB_SEARCH
  if (/\b(price|pricing|cost|how much|buy|purchase|rate|fee)\b/i.test(query)) {
    signals.push({ type: 'transactional', detected: 'pricing/purchase intent', pushesTo: 'WEB_SEARCH' });
  }
  
  // BRANDED → WEB_SEARCH
  if (entities.branded.some(b => queryLower.includes(b.toLowerCase()))) {
    signals.push({ type: 'factual', detected: 'branded entity', pushesTo: 'WEB_SEARCH' });
  }
  
  // CONCEPTUAL → PARAMETRIC (only if no web signals)
  if (/^(what is|what are|explain|define|how does .+ work)\b/i.test(query)) {
    if (signals.filter(s => s.pushesTo === 'WEB_SEARCH').length === 0) {
      signals.push({ type: 'conceptual', detected: 'definition/explanation', pushesTo: 'PARAMETRIC' });
    }
  }
  
  // Calculate route
  const webSignals = signals.filter(s => s.pushesTo === 'WEB_SEARCH').length;
  const paramSignals = signals.filter(s => s.pushesTo === 'PARAMETRIC').length;
  
  let route: 'WEB_SEARCH' | 'PARAMETRIC' | 'HYBRID';
  let confidence: number;
  
  if (webSignals > 0 && paramSignals === 0) {
    route = 'WEB_SEARCH';
    confidence = Math.min(95, 60 + webSignals * 12);
  } else if (paramSignals > 0 && webSignals === 0) {
    route = 'PARAMETRIC';
    confidence = Math.min(85, 50 + paramSignals * 15);
  } else if (webSignals === 0 && paramSignals === 0) {
    route = 'HYBRID';
    confidence = 50;
  } else {
    route = 'HYBRID';
    confidence = 60 + Math.abs(webSignals - paramSignals) * 5;
  }
  
  return { route, confidence, signals };
}

// ============================================================
// SUMMARY BUILDER
// ============================================================

function buildSummary(suggestions: QueryVariant[], filtered: FilteredVariant[]): QuerySuggestionsSummary {
  const byType: Record<string, number> = {};
  suggestions.forEach(s => {
    byType[s.variantType] = (byType[s.variantType] || 0) + 1;
  });
  
  const avgScore = suggestions.length > 0
    ? suggestions.reduce((acc, s) => acc + (s.intentScore || 0), 0) / suggestions.length
    : 0;
  
  const entityPreservationRate = suggestions.length > 0
    ? suggestions.reduce((acc, s) => acc + (s.entityOverlap || 0), 0) / suggestions.length
    : 0;

  return {
    total_generated: suggestions.length + filtered.length,
    by_type: byType,
    high_intent: suggestions.filter(s => s.intentCategory === 'HIGH').length,
    medium_intent: suggestions.filter(s => s.intentCategory === 'MEDIUM').length,
    filtered_drift: filtered.length,
    avg_intent_score: avgScore,
    entity_preservation_rate: entityPreservationRate,
    web_search_likely: suggestions.filter(s => s.routePrediction?.route === 'WEB_SEARCH').length,
    parametric_likely: suggestions.filter(s => s.routePrediction?.route === 'PARAMETRIC').length,
    hybrid_likely: suggestions.filter(s => s.routePrediction?.route === 'HYBRID').length,
  };
}

// ============================================================
// STEP 7: GAP ANALYSIS
// ============================================================

async function detectCoverageGaps(
  content: string,
  intelligence: ContentIntelligence,
  topicFocus: TopicFocus,
  suggestions: QueryVariant[],
  entities: ExtractedEntities
): Promise<CoverageGapsAnalysis> {
  
  const systemPrompt = `You identify content gaps for "${topicFocus.primaryEntity}". You must respond with valid JSON.

Analyze which HIGH/MEDIUM intent queries have weak coverage and recommend fixes.

OUTPUT FORMAT (JSON):
{
  "critical_gaps": [
    {
      "query": "the query revealing gap",
      "intentCategory": "HIGH",
      "currentCoverage": "weak|none|partial",
      "missingElements": ["specific element 1", "element 2"],
      "recommendation": "Specific actionable fix"
    }
  ],
  "priority_actions": [
    {
      "rank": 1,
      "action": "Clear action",
      "targetQueries": ["query1"],
      "impact": "high",
      "effort": "moderate"
    }
  ],
  "follow_up_queries": [
    {
      "query": "follow-up query",
      "targetGap": "which gap this addresses",
      "priority": "high"
    }
  ]
}`;

  const weakQueries = suggestions
    .filter(s => s.intentCategory === 'HIGH' || s.intentCategory === 'MEDIUM')
    .slice(0, 15)
    .map(s => `- "${s.query}" | Intent: ${s.intentCategory} | Score: ${(s.intentScore || 0).toFixed(2)}`)
    .join('\n');

  const userPrompt = `TOPIC: ${topicFocus.primaryEntity}
PRIMARY ENTITIES: ${entities.primary.join(', ')}

HIGH/MEDIUM INTENT QUERIES:
${weakQueries}

CONTENT PREVIEW:
${content.slice(0, 2000)}

Identify gaps and recommend fixes:`;

  const response = await callAI(systemPrompt, userPrompt, 'json_object', 2048);
  const parsed = parseAIResponse(response, {
    critical_gaps: [],
    priority_actions: [],
    follow_up_queries: []
  });
  
  return {
    missing_queries: [],
    weak_queries: [],
    opportunities: [],
    critical_gaps: parsed.critical_gaps || [],
    follow_up_queries: parsed.follow_up_queries || [],
    competitive_gaps: [],
    priority_actions: parsed.priority_actions || [],
    gap_summary: {
      total_suggestions: suggestions.length,
      strong_coverage: 0,
      partial_coverage: 0,
      weak_coverage: 0,
      no_coverage: 0,
      critical_gaps: (parsed.critical_gaps || []).length,
      opportunity_gaps: 0,
      low_priority_gaps: 0,
    },
    legacy_gaps: [],
  };
}

function buildMinimalGapAnalysis(suggestions: QueryVariant[]): CoverageGapsAnalysis {
  return {
    missing_queries: [],
    weak_queries: [],
    opportunities: [],
    critical_gaps: [],
    follow_up_queries: [],
    competitive_gaps: [],
    priority_actions: [],
    gap_summary: {
      total_suggestions: suggestions.length,
      strong_coverage: 0,
      partial_coverage: 0,
      weak_coverage: 0,
      no_coverage: 0,
      critical_gaps: 0,
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
  }>;
  topicHierarchy: {
    broadCategory: string;
    specificNiche: string;
    exactFocus: string;
  };
  contentStructure: Record<string, boolean>;
}

interface PrimaryQueryResult {
  query: string;
  searchIntent: string;
  confidence: number;
  reasoning: string;
}

interface QueryVariant {
  query: string;
  variantType: GoogleVariantType | string;
  sharedEntities: string[];
  entityOverlap: number;
  semanticEstimate: number;
  userJourneyPosition: 'early' | 'middle' | 'late';
  
  // Calculated server-side
  intentScore?: number;
  intentCategory?: 'HIGH' | 'MEDIUM' | 'LOW';
  driftReason?: string | null;
  routePrediction?: RouteInfo;
  isFallback?: boolean;
}

interface FilteredVariant {
  query: string;
  variantType: GoogleVariantType | string;
  intentScore: number;
  driftReason: string;
}

interface QuerySuggestionsSummary {
  total_generated: number;
  by_type: Record<string, number>;
  high_intent: number;
  medium_intent: number;
  filtered_drift: number;
  avg_intent_score: number;
  entity_preservation_rate: number;
  web_search_likely: number;
  parametric_likely: number;
  hybrid_likely: number;
}

interface CriticalGap {
  query: string;
  intentCategory: string;
  currentCoverage: string;
  missingElements: string[];
  recommendation: string;
}

interface FollowUpQuery {
  query: string;
  targetGap: string;
  priority: string;
}

interface GapSummary {
  total_suggestions: number;
  strong_coverage: number;
  partial_coverage: number;
  weak_coverage: number;
  no_coverage: number;
  critical_gaps: number;
  opportunity_gaps: number;
  low_priority_gaps: number;
}

interface PriorityAction {
  rank: number;
  action: string;
  targetQueries: string[];
  impact: string;
  effort: string;
}

interface CoverageGapsAnalysis {
  missing_queries: string[];
  weak_queries: string[];
  opportunities: string[];
  critical_gaps: CriticalGap[];
  follow_up_queries: FollowUpQuery[];
  gap_summary: GapSummary;
  competitive_gaps: any[];
  priority_actions: PriorityAction[];
  legacy_gaps: any[];
}

// ============================================================
// ROBUST JSON PARSING
// ============================================================

function parseAIResponse(response: string, defaultValue: any = null): any {
  try {
    return JSON.parse(response);
  } catch (e) {
    console.log('Direct JSON parse failed, attempting recovery...');
  }

  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (e) {}
  }

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {}
  }

  // Fix truncation
  let cleaned = response.trim();
  const lastComplete = Math.max(cleaned.lastIndexOf('",'), cleaned.lastIndexOf('"}'));
  
  if (lastComplete > 0) {
    let truncated = cleaned.substring(0, lastComplete + 2);
    const openBraces = (truncated.match(/\{/g) || []).length;
    const closeBraces = (truncated.match(/\}/g) || []).length;
    const openBrackets = (truncated.match(/\[/g) || []).length;
    const closeBrackets = (truncated.match(/\]/g) || []).length;
    
    truncated += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
    truncated += '}'.repeat(Math.max(0, openBraces - closeBraces));
    
    try {
      return JSON.parse(truncated);
    } catch (e) {}
  }

  console.error('All JSON parsing attempts failed, returning default');
  return defaultValue;
}

// ============================================================
// AI HELPER
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
      throw new Error('Rate limit exceeded. Please try again.');
    }
    if (response.status === 402) {
      throw new Error('AI credits exhausted.');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${errorData.error?.message || response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}
