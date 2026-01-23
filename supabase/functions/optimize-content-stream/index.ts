import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// ============================================================================
// RAG EDUCATION SYSTEM PROMPT
// ============================================================================

const RAG_EDUCATION_SYSTEM_PROMPT = `You are an expert content optimizer for RAG (Retrieval-Augmented Generation) search systems. You understand exactly how AI search works and optimize content to succeed at every pipeline stage.

## THE 7-STAGE RAG PIPELINE

Modern AI search (Google AI Overviews, Perplexity, ChatGPT) uses a multi-stage pipeline. Content can fail at ANY stage. Your optimizations must address ALL stages.

### Stage 0: ROUTE (Query Classification)
Before retrieval begins, AI systems classify queries to decide which knowledge sources to use:
- Parametric (LLM memory) → Your content is NEVER considered
- Web search → Your content CAN compete
- Hybrid → Both are used

**Signals that trigger web search:** Temporal markers ("2024", "latest", "current"), specific entities, factual claims needing verification, comparison queries.

**Your role:** Ensure content contains signals that trigger retrieval, not parametric responses.

### Stage 1-3: INDEX, CHUNK, EMBED
Content is crawled, split into passages (100-500 tokens), and converted to vectors.

**Key insight:** Chunk boundaries determine semantic coherence. If a chunk combines multiple topics, its embedding is diluted and matches nothing well.

**Your role:** Write content where each paragraph has ONE clear topic. Front-load the main point. Make topic sentences carry standalone meaning.

### Stage 4: RETRIEVE (First Cut)
Query is embedded. Top ~100 chunks are retrieved via hybrid search:
- Dense vectors (semantic similarity): 70% weight
- Sparse vectors (BM25/lexical matching): 30% weight

**What BM25 rewards:**
- Exact query terms in content (not synonyms)
- Terms in title/headings (1.5-2x boost)
- Terms early in content (position decay)
- Term frequency (diminishing returns after 2-3 occurrences)

**What dense vectors reward:**
- Semantic similarity (meaning, not just words)
- Coverage of query facets (all aspects addressed)
- Topical coherence (single clear topic per chunk)

**Your role:** Ensure exact query terms appear naturally, especially in headings and first sentences. But also ensure semantic coverage of the query's implicit needs.

### Stage 5: RERANK (Critical Gate)
Retrieved chunks are re-scored by cross-encoders that evaluate query-chunk pairs JOINTLY. This is where citation fate is sealed.

**What cross-encoders reward (in order of importance):**

1. **Direct Answer Presence** (30% of rerank signal)
   - Explicit response to the query in the first 1-2 sentences
   - "How long?" → Needs specific timeframe in sentence 1
   - "How much?" → Needs specific cost in sentence 1
   - "What is?" → Needs definition in sentence 1

2. **Entity Prominence** (25% of rerank signal)
   - Named entities from query appear prominently
   - "Prominent" = in heading, first sentence, or repeated 2-3x
   - Missing entities = severe rerank penalty

3. **Query Echo/Restatement** (20% of rerank signal)
   - Restating query before answering signals relevance
   - "RPO implementation typically takes..." echoes "how long does RPO implementation take"
   - Can be exact or paraphrased, but must be recognizable

4. **Structural Clarity** (15% of rerank signal)
   - Headers that match query intent
   - Lists/steps for process queries
   - Definitions for "what is" queries
   - Comparison tables for "vs" queries

5. **Self-containment** (10% of rerank signal)
   - Chunk makes sense without surrounding context
   - No unresolved pronouns ("this process", "it requires")
   - No forward/backward references to other sections

### Stage 6: GENERATE (Context Window)
Top 10-20 reranked chunks are passed to the LLM. But attention is NOT uniform.

**The "Lost in the Middle" Problem:**
- Positions 1-3: HIGH attention (70%+ of citations come from here)
- Positions 4-7: MODERATE attention
- Positions 8-15: LOW attention (often ignored entirely)
- Positions 16-20: MODERATE attention (recency effect)

**Your role:** Optimize for positions 1-3. If you can't reach top positions, optimize for quotability so even middle-position content gets cited for its unique value.

### Stage 7: CITE (Attribution)
LLM decides which retrieved chunks to actually cite. This is NOT random.

**What drives citation:**

1. **Specificity** (most important)
   - Concrete numbers: "$3,000-$8,000 per hire"
   - Specific timeframes: "60-90 days"
   - Named entities: "Workday, Greenhouse, Lever"
   - Dates: "Q4 2024", "January 15"
   
   Vague content is NEVER cited: "costs vary widely", "depends on many factors"

2. **Quotability**
   - Self-contained sentences that can be extracted
   - Complete claims that don't need context
   - Attributable statements (not opinions)

3. **Evidence/Source Signals**
   - "According to [source]"
   - "Research shows"
   - "Data from [study]"
   - These increase citation confidence

4. **Uniqueness**
   - Information not available in other retrieved chunks
   - Novel angles, specific examples, proprietary data

---

## YOUR OPTIMIZATION PRINCIPLES

### Principle 1: Front-Load, Don't Add
The best optimizations RESTRUCTURE to put key information earlier, not add new content. Moving the answer from sentence 5 to sentence 1 is more valuable than adding three new sentences.

### Principle 2: One Natural Mention is Enough
Keyword stuffing HURTS modern RAG. Embeddings detect repetition patterns. BM25 has diminishing returns after 2-3 occurrences. One natural mention in the right place (heading, first sentence) beats five mentions scattered throughout.

### Principle 3: Specificity Over Length
A 50-word paragraph with specific data outranks a 200-word paragraph with vague claims. Cut filler. Add data points. "The process varies" → "The process takes 60-90 days for mid-market companies, 90-120 days for enterprises."

### Principle 4: Preserve Accuracy
You're optimizing for RETRIEVAL, not truth. Never add claims that aren't supported by or inferable from the original content. If specific data doesn't exist, note it as "unaddressable" rather than fabricating.

### Principle 5: Preserve Voice
The content has a specific tone. Maintain it. A conversational blog post shouldn't become a technical manual. A formal whitepaper shouldn't become casual.

---

## OUTPUT FORMAT

Return valid JSON only:
{
  "thinking": "Your step-by-step reasoning about the diagnosis and what changes will address which pipeline stages",
  "optimized_text": "The optimized passage text (body only, no headings)",
  "changes": [
    {
      "type": "front_load|add_term|add_specificity|remove_vague|restructure|add_entity|echo_query|other",
      "description": "What was changed",
      "pipeline_stage": "retrieve|rerank|cite",
      "mechanism": "Why this helps at that stage (reference specific RAG mechanics)"
    }
  ],
  "preserved": ["Phrases/elements kept because they already work well"],
  "unaddressable": ["Issues that couldn't be fixed without fabricating information"],
  "confidence": 0.0-1.0
}`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function detectQueryType(query: string): string {
  if (/how\s+long|duration|time|take/i.test(query)) return 'TEMPORAL (expects timeframe)';
  if (/how\s+much|cost|price|fee/i.test(query)) return 'COST (expects pricing)';
  if (/what\s+is|what\s+are|define/i.test(query)) return 'DEFINITION (expects clear definition)';
  if (/why|reason/i.test(query)) return 'CAUSAL (expects reasons)';
  if (/how\s+to|steps|process/i.test(query)) return 'PROCESS (expects steps)';
  if (/best|top|recommend/i.test(query)) return 'RECOMMENDATION (expects criteria)';
  if (/vs|versus|compare|difference/i.test(query)) return 'COMPARISON (expects contrasts)';
  return 'INFORMATIONAL (expects clear information)';
}

function detectQueryTypeDetailed(query: string): string {
  const details: string[] = [];
  
  if (/how\s+long|duration|time|take/i.test(query)) {
    details.push('**Temporal Query** - Expects specific timeframe');
    details.push('- Good: "typically takes 60-90 days"');
    details.push('- Good: "ranges from 2-6 months depending on scope"');
    details.push('- Bad: "depends on various factors"');
    details.push('- Bad: "the timeline varies"');
  }
  if (/how\s+much|cost|price|fee/i.test(query)) {
    details.push('**Cost Query** - Expects specific pricing');
    details.push('- Good: "$3,000-$8,000 per hire"');
    details.push('- Good: "15-25% of first-year salary"');
    details.push('- Bad: "costs vary widely"');
    details.push('- Bad: "depends on your needs"');
  }
  if (/what\s+is|what\s+are|define/i.test(query)) {
    details.push('**Definition Query** - Expects clear definition in sentence 1');
    details.push('- Good: "RPO (Recruitment Process Outsourcing) is a form of business process outsourcing where..."');
    details.push('- Bad: "RPO involves various recruiting activities"');
  }
  if (/why|reason/i.test(query)) {
    details.push('**Causal Query** - Expects explicit enumerated reasons');
    details.push('- Good: "Companies choose RPO for three main reasons: 1) cost reduction of 20-30%, 2) faster time-to-hire, 3) access to specialized talent pools"');
    details.push('- Bad: "there are many reasons companies consider this option"');
  }
  if (/how\s+to|steps|process/i.test(query)) {
    details.push('**Process Query** - Expects actionable steps');
    details.push('- Good: "Step 1: Define requirements. Step 2: Evaluate vendors..."');
    details.push('- Good: "First, assess your hiring volume. Then, identify..."');
    details.push('- Bad: "the process involves several considerations"');
  }
  if (/best|top|recommend/i.test(query)) {
    details.push('**Recommendation Query** - Expects specific criteria');
    details.push('- Good: "Key selection criteria: 1) industry expertise, 2) technology stack, 3) pricing transparency"');
    details.push('- Bad: "it depends on your specific needs"');
  }
  if (/vs|versus|compare|difference/i.test(query)) {
    details.push('**Comparison Query** - Expects explicit contrasts');
    details.push('- Good: "RPO handles end-to-end recruiting; staffing agencies fill individual roles on-demand"');
    details.push('- Bad: "both have their advantages and disadvantages"');
  }
  
  return details.length > 0 ? details.join('\n') : '**Informational Query** - Provide clear, specific information';
}

function getExpectedStructure(query: string): string {
  if (/how\s+to|steps|process/i.test(query)) {
    return '- **Process query** → Numbered steps or clear sequence (First..., Then..., Finally...)';
  }
  if (/what\s+is|what\s+are|define/i.test(query)) {
    return '- **Definition query** → "X is..." pattern in first sentence';
  }
  if (/vs|versus|compare|difference/i.test(query)) {
    return '- **Comparison query** → Explicit contrast points, possibly parallel structure';
  }
  if (/best|top|recommend/i.test(query)) {
    return '- **Recommendation query** → Criteria list or ranked options';
  }
  if (/why|reason/i.test(query)) {
    return '- **Causal query** → Enumerated reasons (three main reasons: 1..., 2..., 3...)';
  }
  return '- **General query** → Clear topic sentence, supporting details, specific examples';
}

function extractExpectedAnswerFormat(query: string): string {
  if (/how\s+long/i.test(query)) return '[X] typically takes [timeframe]...';
  if (/how\s+much|cost/i.test(query)) return '[X] costs [price range]...';
  if (/what\s+is/i.test(query)) return '[X] is [definition]...';
  if (/why/i.test(query)) return '[People/Companies] [do X] because [reasons]...';
  if (/how\s+to/i.test(query)) return 'To [do X], [first step]...';
  return '[Answer to query]...';
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str;
}

// ============================================================================
// DIAGNOSTIC-DRIVEN USER PROMPT BUILDER
// ============================================================================

interface DiagnosisData {
  primaryFailureMode: string;
  semanticScore?: number;
  lexicalScore?: number;
  lexicalMissingTerms?: string[];
  hybridRetrievalScore?: number;
  rerankScore?: number;
  citationScore?: number;
  rerankIssues?: {
    answerPosition?: number;
    hasRelevantHeading?: boolean;
    hasList?: boolean;
    hasDefinition?: boolean;
    structuralClarityScore?: number;
    missingEntities?: string[];
  };
  citationIssues?: {
    specificitySignals?: number;
    numbers?: string[];
    names?: string[];
    vagueStatements?: string[];
    quotableSentences?: string[];
  };
  secondaryIssues?: Array<{ type: string; description: string }>;
  presentStrengths?: string[];
}

interface QueryAssignment {
  queries: string[];
  diagnosis?: DiagnosisData;
}

function buildDiagnosticUserPrompt(
  assignment: QueryAssignment,
  chunkText: string,
  headingPath: string[]
): string {
  const query = assignment.queries[0];
  const d = assignment.diagnosis;
  
  // If no diagnosis data, use simple prompt
  if (!d) {
    return `Optimize this chunk for the query: "${query}"

CHUNK:
${chunkText}

Return the optimized text that better answers this query.`;
  }
  
  let prompt = `## OPTIMIZATION TASK

**Query:** "${query}"
**Heading Context:** ${headingPath.join(' > ') || 'Root level'}

**Original Chunk:**
"""
${chunkText}
"""

---

## DIAGNOSTIC ANALYSIS

`;

  // Add failure mode with RAG explanation
  switch (d.primaryFailureMode) {
    case 'topic_mismatch':
      prompt += `### PRIMARY ISSUE: Topic Mismatch
**RAG Impact:** This chunk's embedding points in a different semantic direction than the query's embedding. Cosine similarity is low because the content is about a different subject.

**Pipeline Failure Point:** Stage 4 (Retrieve) - This chunk may not even make the top 100 retrieved.

**Evidence:**
- Semantic score: ${d.semanticScore ?? 'N/A'}/100 (needs 60+ to compete)
- Lexical overlap: ${d.lexicalScore ?? 'N/A'}/100
- Missing query terms: ${d.lexicalMissingTerms?.join(', ') || 'N/A'}

**Your Options:**
1. If ANY relevant content exists, restructure to make it dominant
2. If truly off-topic, make minimal changes and list in "unaddressable"
3. DO NOT force irrelevant content to match—this harms the chunk's usefulness for queries it DOES match

`;
      break;
      
    case 'vocabulary_gap':
      prompt += `### PRIMARY ISSUE: Vocabulary Gap
**RAG Impact:** Dense vector similarity is okay, but BM25 (lexical) matching is failing. The chunk discusses the right topic but uses different words than the query.

**Pipeline Failure Point:** Stage 4 (Retrieve) - Losing 30% of hybrid retrieval signal.

**Missing Terms (from query, not in chunk):**
${d.lexicalMissingTerms?.map(t => `- "${t}"`).join('\n') || '- None detected'}

**Current Lexical Score:** ${d.lexicalScore ?? 'N/A'}/100 (target: 60+)

**Optimization Strategy:**
For each missing term, find where it NATURALLY fits:
- Prefer first 100 characters (BM25 position boost)
- Prefer headings (1.5-2x BM25 boost)
- One mention is sufficient (diminishing returns after 2-3)

**Example:**
- Missing term: "implementation"
- Original: "The process involves several phases."
- Optimized: "The implementation process involves several phases."
- Mechanism: Term added in first sentence, natural fit, +15-20% lexical score expected.

`;
      break;
      
    case 'buried_answer':
      prompt += `### PRIMARY ISSUE: Buried Answer
**RAG Impact:** The direct answer exists but is buried deep in the text. Cross-encoders heavily weight information in the first 100-150 characters. Burying the answer causes severe rerank penalty.

**Pipeline Failure Point:** Stage 5 (Rerank) - Content retrieves but gets pushed down, landing in "lost in the middle" positions.

**Evidence:**
- Retrieval score: ${d.hybridRetrievalScore ?? 'N/A'}/100 (decent)
- Rerank score: ${d.rerankScore ?? 'N/A'}/100 (poor due to position)
- Answer detected late in passage

**Query Type Analysis:**
${detectQueryTypeDetailed(query)}

**Optimization Strategy:**
1. Identify the sentence(s) that DIRECTLY answer the query
2. Move to position 1 (first sentence of chunk)
3. Follow with context and qualifications
4. This is a RESTRUCTURE, not an addition

**Structure Template:**
[Direct answer: "${extractExpectedAnswerFormat(query)}"] → [Context] → [Details] → [Supporting info]

`;
      break;
      
    case 'no_direct_answer':
      prompt += `### PRIMARY ISSUE: No Direct Answer
**RAG Impact:** The query asks a question. Cross-encoders look for explicit answers in the first 150 characters. No answer = severe rerank penalty AND low citation probability.

**Pipeline Failure Points:** 
- Stage 5 (Rerank): Missing 30% of rerank signal (direct answer component)
- Stage 7 (Cite): LLMs don't cite chunks that don't answer questions

**Evidence:**
- Direct answer detected: NO
- Rerank score: ${d.rerankScore ?? 'N/A'}/100
- Query type: ${detectQueryType(query)}

**What This Query Needs:**
${detectQueryTypeDetailed(query)}

**Optimization Strategy:**
1. Determine what SPECIFIC answer format the query expects
2. Check if this information EXISTS in the chunk (explicitly or implicitly)
3. If yes: Extract and front-load it
4. If no: List in "unaddressable" - DO NOT fabricate

**Critical:** An answer must be EXPLICIT. "The process varies" does not answer "how long does X take?" even if variability is true. Either provide a range ("60-90 days") or acknowledge inability to answer.

`;
      break;
      
    case 'missing_specifics':
      prompt += `### PRIMARY ISSUE: Lacks Specificity  
**RAG Impact:** Content makes claims but provides no verifiable data. LLMs strongly prefer citing specific, attributable information over vague generalizations.

**Pipeline Failure Point:** Stage 7 (Cite) - Content may retrieve and rerank okay but never gets cited because nothing is quotable.

**Evidence:**
- Citation score: ${d.citationScore ?? 'N/A'}/100 (target: 60+)
- Specificity signals found: ${d.citationIssues?.specificitySignals ?? 0}
- Numbers in content: ${d.citationIssues?.numbers?.length ?? 0}
- Named entities: ${d.citationIssues?.names?.length ?? 0}

${d.citationIssues?.vagueStatements && d.citationIssues.vagueStatements.length > 0 ? `**Vague Statements Detected:**
${d.citationIssues.vagueStatements.slice(0, 4).map((s, i) => `${i + 1}. "${truncate(s, 80)}"`).join('\n')}
` : ''}

**Vague → Specific Transformations:**
| Vague | Specific | Why It Works |
|-------|----------|--------------|
| "significant cost savings" | "20-30% cost reduction" | Citable number |
| "the process takes time" | "typically 60-90 days" | Specific timeframe |
| "many companies" | "over 60% of mid-market companies" | Quantified claim |
| "various benefits" | "three key benefits: X, Y, Z" | Enumerated, specific |

**Optimization Strategy:**
1. Identify vague claims
2. Look for implicit specifics elsewhere in the chunk that can make them explicit
3. If no data exists, note in "unaddressable"
4. Prioritize making 2-3 sentences highly quotable over making everything slightly better

`;
      break;
      
    case 'structure_problem':
      prompt += `### PRIMARY ISSUE: Structural Clarity
**RAG Impact:** Cross-encoders reward clear structure: relevant headings, lists for processes, definitions for "what is" queries. Poor structure = rerank penalty.

**Pipeline Failure Point:** Stage 5 (Rerank) - Losing 15-20% of rerank signal from structure component.

**Evidence:**
- Structural clarity score: ${d.rerankIssues?.structuralClarityScore ?? 'N/A'}/100
- Has relevant heading: ${d.rerankIssues?.hasRelevantHeading ? 'Yes' : 'No'}
- Has list/steps: ${d.rerankIssues?.hasList ? 'Yes' : 'No'}
- Has definition pattern: ${d.rerankIssues?.hasDefinition ? 'Yes' : 'No'}

**Query Type → Expected Structure:**
${getExpectedStructure(query)}

**Optimization Strategy:**
1. If process query → Consider numbered steps
2. If definition query → Use "X is..." format in sentence 1
3. If comparison query → Explicit contrast points
4. Make first sentence a clear topic sentence
5. You're optimizing BODY text (no headings) but can suggest heading changes

`;
      break;
      
    case 'already_optimized':
      prompt += `### STATUS: Already Well-Optimized
**RAG Assessment:** This chunk scores 75+ across metrics. It's competitive at all pipeline stages.

**Evidence:**
- Hybrid retrieval: ${d.hybridRetrievalScore ?? 'N/A'}/100 ✓
- Rerank: ${d.rerankScore ?? 'N/A'}/100 ✓
- Citation: ${d.citationScore ?? 'N/A'}/100 ✓

**Your Task:**
1. Make MINIMAL changes only
2. Fix obvious awkwardness if any
3. DO NOT restructure what's working
4. It's acceptable to return near-identical text
5. Explain in "thinking" why major changes aren't needed

`;
      break;
      
    default:
      prompt += `### ISSUE: ${d.primaryFailureMode || 'Unknown'}
Apply general optimization principles to improve this chunk for the query.

`;
  }

  // Add secondary issues if present
  if (d.secondaryIssues && d.secondaryIssues.length > 0) {
    prompt += `### SECONDARY ISSUES (Address if possible without conflicting with primary fix)
${d.secondaryIssues.map(issue => `- ${issue.type}: ${issue.description}`).join('\n')}

`;
  }

  // Add preservation requirements
  if (d.presentStrengths && d.presentStrengths.length > 0) {
    prompt += `### PRESERVE THESE (Working well, don't break them)
${d.presentStrengths.map(s => `✓ ${s}`).join('\n')}

`;
  }

  // Add entity requirements
  if (d.rerankIssues?.missingEntities && d.rerankIssues.missingEntities.length > 0) {
    prompt += `### ENTITY PROMINENCE GAP
Query entities not prominent in chunk:
${d.rerankIssues.missingEntities.map(e => `- "${e}" (add in first 100 chars or heading if possible)`).join('\n')}

`;
  }

  // Add quotability requirements if citation score is low
  if (d.citationScore !== undefined && d.citationScore < 50) {
    prompt += `### QUOTABILITY IMPROVEMENT NEEDED
Current quotable sentences: ${d.citationIssues?.quotableSentences?.length || 0}
Target: At least 2 self-contained, citable sentences

A quotable sentence:
- Makes a complete claim independently
- Contains specific data (number, name, timeframe)
- Could be extracted and cited in isolation
- Example: "RPO implementation typically takes 60-90 days for mid-market companies."

`;
  }

  prompt += `---

## FINAL INSTRUCTIONS
1. Apply the recommended fix for the primary issue
2. Address secondary issues if they don't conflict
3. Preserve working elements
4. Return valid JSON only
5. Be honest in "unaddressable" about what you couldn't fix`;

  return prompt;
}

// ============================================================================
// SIMPLE OPTIMIZATION PROMPT (fallback when no diagnosis)
// ============================================================================

const SIMPLE_OPTIMIZATION_PROMPT = `You optimize content passages for RAG retrieval systems.

GOAL: Improve retrieval probability for the assigned query.

WHAT IMPROVES RETRIEVAL:
1. ANSWER THE QUERY - Ensure a clear answer exists in the first 1-2 sentences
2. ADD SPECIFIC FACTS - Numbers, names, examples, timeframes
3. MAKE IT SELF-CONTAINED - Passage makes sense alone
4. USE NATURAL DOMAIN VOCABULARY - Not forced keywords
5. COVER MULTIPLE FACETS - Address different aspects

WHAT HURTS RETRIEVAL:
1. KEYWORD STUFFING - Once is enough
2. FILLER CONTENT - "importantly", "it's worth noting"
3. VAGUE STATEMENTS - Be specific
4. GOING OFF-TOPIC - Stay focused

Return ONLY the optimized text, no explanations or preamble.`;

// ============================================================================
// MAIN SERVER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, ...params } = await req.json();
    
    console.log(`Processing ${type} streaming request`);

    // Create SSE response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    const sendEvent = async (data: unknown) => {
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      } catch (e) {
        console.error('Failed to send event:', e);
      }
    };

    // Process in background
    (async () => {
      try {
        switch (type) {
          case 'generate_analysis_prompt': {
            // Non-streaming analysis prompt generation
            const { query, intentType, chunkText, headingPath, scores } = params;
            
            const systemPrompt = `You are an expert content optimization analyst specializing in AI search retrieval (RAG systems). Your task is to analyze a content chunk and provide specific, actionable recommendations for optimizing it to better answer a target query.

You understand that AI search systems:
- Retrieve content based on semantic similarity and lexical overlap
- Use cross-encoder reranking to select the most relevant passages
- Prefer content that directly restates or addresses the query
- Value entity prominence and specific, concrete information
- Cite content that provides clear, quotable answers`;

            const userPrompt = `Analyze this chunk and provide optimization recommendations.

QUERY: "${query}"
INTENT TYPE: ${intentType}

HEADING CONTEXT:
${(headingPath || []).join(' > ') || 'Root level'}

CURRENT CHUNK:
"""
${chunkText}
"""

CURRENT SCORES:
- Passage Score: ${scores?.passageScore ?? 'N/A'}/100
- Semantic Similarity: ${(scores?.semanticSimilarity ?? 0).toFixed(2)}
- Lexical Score: ${(scores?.lexicalScore ?? 0).toFixed(2)}
- Entity Overlap: ${Math.round((scores?.entityOverlap ?? 0) * 100)}%
- Rerank Score: ${scores?.rerankScore ?? 'N/A'}/100
- Citation Score: ${scores?.citationScore ?? 'N/A'}/100

Provide a detailed optimization brief that includes:

1. **Opening Sentence Recommendation**: Write the exact opening sentence this chunk should have to directly address the query.

2. **Key Changes Needed**: List 3-5 specific changes to improve retrieval and ranking.

3. **Entities to Add/Emphasize**: List specific terms, phrases, or concepts that should be prominently included.

4. **Structure Improvements**: How should the content be reorganized for better scannability and direct answers?

5. **Missing Information**: What specific facts, examples, or data points would strengthen this content?

6. **Quotability Factor**: What 1-2 sentence "pull quote" should this chunk contain that an AI would want to cite?

Format as a clear, actionable brief that a writer could use to rewrite this chunk.`;

            console.log(`Generating analysis prompt for query: "${query.slice(0, 50)}..."`);

            const response = await fetch(AI_GATEWAY_URL, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-3-flash-preview',
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 1500,
                stream: false,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('AI gateway error:', response.status, errorText);
              
              if (response.status === 429) {
                await sendEvent({ type: 'error', message: 'Rate limit exceeded. Please try again in a moment.' });
              } else if (response.status === 402) {
                await sendEvent({ type: 'error', message: 'Usage limit reached. Please add credits to continue.' });
              } else {
                await sendEvent({ type: 'error', message: `AI service error: ${response.status}` });
              }
              break;
            }

            const data = await response.json();
            const analysis = data.choices?.[0]?.message?.content;

            if (!analysis) {
              await sendEvent({ type: 'error', message: 'No analysis generated' });
              break;
            }

            // Send as non-streaming response via SSE
            await sendEvent({
              type: 'analysis_complete',
              analysis,
            });
            
            console.log('Analysis prompt generated successfully');
            break;
          }

          case 'apply_architecture_stream': {
            const { content, tasks } = params;
            let currentContent = content;

            for (let i = 0; i < tasks.length; i++) {
              const task = tasks[i];
              
              await sendEvent({
                type: 'task_started',
                taskId: task.id,
                taskIndex: i,
                totalTasks: tasks.length,
              });

              const response = await fetch(AI_GATEWAY_URL, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'google/gemini-3-flash-preview',
                  messages: [
                    {
                      role: 'system',
                      content: `Apply this single structural change to the content. Return ONLY the modified content, no explanations.
                    
Task: [${task.type}] ${task.description}
Location: ${task.location?.position || 'as appropriate'}
${task.details?.suggestedHeading ? `Suggested heading: ${task.details.suggestedHeading}` : ''}
${task.details?.after ? `Change to: ${task.details.after}` : ''}

Important: Only apply THIS specific change. Do not make other modifications.`,
                    },
                    { role: 'user', content: currentContent },
                  ],
                  max_tokens: 16384,
                  stream: false,
                }),
              });

              if (response.ok) {
                const data = await response.json();
                const newContent = data.choices?.[0]?.message?.content;
                if (newContent) {
                  currentContent = newContent;
                }
              }

              await sendEvent({
                type: 'task_applied',
                taskId: task.id,
                taskIndex: i,
              });
            }

            await sendEvent({
              type: 'architecture_complete',
              finalContent: currentContent,
            });
            break;
          }

          case 'optimize_chunks_stream': {
            const { chunks, queryAssignments } = params;
            
            // ENFORCEMENT: Build set of assigned chunk indices and filter
            const assignedIndices = new Set(
              queryAssignments
                ?.filter((qa: { queries?: string[] }) => qa.queries?.[0]?.trim())
                ?.map((qa: { chunkIndex: number }) => qa.chunkIndex)
            );
            
            // Filter to only chunks with valid assignments
            const chunksToOptimize = queryAssignments
              .filter((qa: { chunkIndex: number; queries?: string[] }) => 
                assignedIndices.has(qa.chunkIndex) && chunks[qa.chunkIndex]
              )
              .map((qa: { chunkIndex: number; originalChunkIndex?: number; queries: string[]; headingPath?: string[]; diagnosis?: DiagnosisData }) => ({
                arrayIndex: qa.chunkIndex,
                originalIndex: qa.originalChunkIndex ?? qa.chunkIndex,
                text: chunks[qa.chunkIndex],
                query: qa.queries[0],
                headingPath: qa.headingPath || [],
                diagnosis: qa.diagnosis,
                fullAssignment: qa,
              }));
            
            console.log('RAG-Educated Optimization:', {
              receivedChunks: chunks?.length,
              receivedAssignments: queryAssignments?.length,
              filteredToOptimize: chunksToOptimize.length,
              hasDiagnostics: chunksToOptimize.some((c: { diagnosis?: DiagnosisData }) => !!c.diagnosis),
            });

            const totalToOptimize = chunksToOptimize.length;

            for (let i = 0; i < chunksToOptimize.length; i++) {
              const { arrayIndex, originalIndex, text: chunkText, query, headingPath, diagnosis, fullAssignment } = chunksToOptimize[i];
              
              // Determine if we should use RAG-educated prompts
              const useRagEducation = !!diagnosis;

              await sendEvent({
                type: 'chunk_started',
                index: i,
                total: totalToOptimize,
                chunkIndex: originalIndex,
                originalChunkIndex: originalIndex,
                chunkNumber: originalIndex + 1,
                query,
                progress: Math.round((i / totalToOptimize) * 100),
                failureMode: diagnosis?.primaryFailureMode || 'unknown',
              });

              let systemPrompt: string;
              let userPrompt: string;
              
              if (useRagEducation) {
                // Full RAG-educated optimization
                systemPrompt = RAG_EDUCATION_SYSTEM_PROMPT;
                userPrompt = buildDiagnosticUserPrompt(
                  fullAssignment as QueryAssignment,
                  chunkText,
                  headingPath
                );
                console.log(`Chunk ${originalIndex}: Using RAG-educated prompt for ${diagnosis?.primaryFailureMode}`);
              } else {
                // Simple fallback
                systemPrompt = SIMPLE_OPTIMIZATION_PROMPT;
                userPrompt = `Optimize this chunk for the query: "${query}"

CHUNK:
${chunkText}`;
                console.log(`Chunk ${originalIndex}: Using simple optimization (no diagnosis)`);
              }

              const response = await fetch(AI_GATEWAY_URL, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'google/gemini-3-flash-preview',
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                  ],
                  max_tokens: 4096,
                  stream: false,
                }),
              });

              let optimizedText = chunkText;
              let optimizationMetadata: Record<string, unknown> = {};
              
              if (response.ok) {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content;
                
                if (content) {
                  if (useRagEducation) {
                    // Try to parse JSON response from RAG-educated prompt
                    try {
                      const jsonMatch = content.match(/\{[\s\S]*\}/);
                      if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        optimizedText = parsed.optimized_text || content;
                        optimizationMetadata = {
                          thinking: parsed.thinking,
                          changes: parsed.changes,
                          preserved: parsed.preserved,
                          unaddressable: parsed.unaddressable,
                          confidence: parsed.confidence,
                        };
                      } else {
                        // No JSON found, use raw content
                        optimizedText = content;
                      }
                    } catch (parseError) {
                      console.warn(`Chunk ${originalIndex}: Failed to parse JSON, using raw content`);
                      optimizedText = content;
                    }
                  } else {
                    optimizedText = content;
                  }
                }
              } else {
                console.error(`AI optimization failed for chunk ${originalIndex}:`, response.status);
              }

              await sendEvent({
                type: 'chunk_optimized',
                index: i,
                total: totalToOptimize,
                chunkIndex: originalIndex,
                originalChunkIndex: originalIndex,
                chunkNumber: originalIndex + 1,
                originalText: chunkText,
                optimizedText: optimizedText,
                query: query,
                progress: Math.round(((i + 1) / totalToOptimize) * 100),
                failureMode: diagnosis?.primaryFailureMode || 'unknown',
                ...optimizationMetadata,
              });
            }

            await sendEvent({ 
              type: 'chunks_complete', 
              totalProcessed: totalToOptimize,
              expectedCount: totalToOptimize,
            });
            break;
          }

          case 'generate_briefs_stream': {
            const { queries, existingChunks } = params;
            const totalQueries = queries.length;

            for (let i = 0; i < queries.length; i++) {
              const query = queries[i];

              await sendEvent({
                type: 'brief_started',
                query,
                index: i,
                total: totalQueries,
              });

              const response = await fetch(AI_GATEWAY_URL, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'google/gemini-3-flash-preview',
                  messages: [
                    {
                      role: 'system',
                      content: `Generate a content brief for a query that has no matching content.

EXISTING SECTIONS:
${(existingChunks || []).map((c: { heading?: string }, i: number) => `${i + 1}. ${c.heading || 'Untitled'}`).join('\n')}

Return valid JSON with this structure:
{
  "suggestedHeading": "H2 heading text",
  "placementDescription": "After Section X" or "Before Section Y",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "targetWordCount": { "min": 300, "max": 500 },
  "draftOpening": "Opening sentence that could start the section",
  "gapAnalysis": "Brief explanation of why this content is needed"
}`,
                    },
                    {
                      role: 'user',
                      content: `Generate a content brief for this query: "${query}"`,
                    },
                  ],
                  max_tokens: 1024,
                }),
              });

              let brief = { 
                targetQuery: query, 
                suggestedHeading: '', 
                placementDescription: '', 
                keyPoints: [] as string[], 
                targetWordCount: { min: 300, max: 500 }, 
                draftOpening: '', 
                gapAnalysis: '' 
              };

              if (response.ok) {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content;
                if (content) {
                  try {
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                      const parsed = JSON.parse(jsonMatch[0]);
                      brief = { targetQuery: query, ...parsed };
                    }
                  } catch (e) {
                    console.warn('Failed to parse brief JSON:', e);
                  }
                }
              }

              await sendEvent({
                type: 'brief_generated',
                brief,
                index: i,
                total: totalQueries,
              });
            }

            await sendEvent({ type: 'briefs_complete' });
            break;
          }

          case 'verify_optimizations': {
            // ================================================================
            // VERIFICATION PIPELINE
            // Compares optimized chunks against originals with proper cascade
            // reconstruction for fair scoring comparison
            // ================================================================
            
            const { 
              optimizedChunks, 
              allChunks, 
              queries, 
              architectureApplied 
            } = params as {
              optimizedChunks: Array<{
                originalChunkIndex: number;
                optimized_text: string;
                query: string;
                changes?: string[];
                unaddressable?: string[];
              }>;
              allChunks: Array<{
                index: number;
                text: string;
                textWithoutCascade: string;
                headingPath: string[];
                wasOptimized: boolean;
                excludeReason?: 'no_assignment' | 'user_excluded' | 'already_optimal';
              }>;
              queries: string[];
              architectureApplied?: {
                tasksApplied: unknown[];
                originalChunkCount: number;
                structureChanged: boolean;
              };
            };

            await sendEvent({
              type: 'verification_started',
              totalOptimized: optimizedChunks.length,
              totalChunks: allChunks.length,
              totalQueries: queries.length,
            });

            // Helper: Extract cascade (heading portion) from chunk text
            const extractCascade = (textWithCascade: string, textWithoutCascade: string): string => {
              // The cascade is the part of text that's NOT in textWithoutCascade
              const cascadeEnd = textWithCascade.indexOf(textWithoutCascade);
              if (cascadeEnd > 0) {
                return textWithCascade.substring(0, cascadeEnd).trim();
              }
              // If exact match fails, try to find heading lines at start
              const lines = textWithCascade.split('\n');
              const headingLines: string[] = [];
              for (const line of lines) {
                if (line.startsWith('#') || line.startsWith('**') && line.endsWith('**')) {
                  headingLines.push(line);
                } else if (line.trim().length > 0) {
                  break;
                }
              }
              return headingLines.join('\n');
            };

            // Prepare all texts for batch embedding
            const textsToEmbed: string[] = [];
            const textMap = new Map<string, number>();

            // Add ALL queries
            queries.forEach((q, i) => {
              textMap.set(`query:${i}`, textsToEmbed.length);
              textsToEmbed.push(q);
            });

            // Add ALL original chunks (with cascade already included)
            allChunks.forEach((chunk) => {
              textMap.set(`original:${chunk.index}`, textsToEmbed.length);
              textsToEmbed.push(chunk.text);
            });

            // Add optimized chunks WITH cascade reconstructed
            const optimizedWithCascade: string[] = [];
            optimizedChunks.forEach((opt, i) => {
              const original = allChunks.find(c => c.index === opt.originalChunkIndex);
              if (original) {
                const cascade = extractCascade(original.text, original.textWithoutCascade);
                const reconstructed = cascade 
                  ? `${cascade}\n\n${opt.optimized_text}`
                  : opt.optimized_text;
                optimizedWithCascade.push(reconstructed);
                textMap.set(`optimized:${i}`, textsToEmbed.length);
                textsToEmbed.push(reconstructed);
              }
            });

            console.log(`Verification: Embedding ${textsToEmbed.length} texts (${queries.length} queries, ${allChunks.length} chunks, ${optimizedChunks.length} optimized)`);

            await sendEvent({
              type: 'verification_embedding',
              totalTexts: textsToEmbed.length,
              message: 'Generating embeddings for verification...',
            });

            // Call generate-embeddings edge function
            const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
            const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
            
            const embeddingResponse = await fetch(
              `${SUPABASE_URL}/functions/v1/generate-embeddings`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ texts: textsToEmbed }),
              }
            );

            if (!embeddingResponse.ok) {
              const errText = await embeddingResponse.text();
              console.error('Embedding generation failed:', errText);
              await sendEvent({
                type: 'error',
                message: `Failed to generate embeddings: ${errText}`,
              });
              break;
            }

            const embeddingData = await embeddingResponse.json();
            const embeddings: number[][] = embeddingData.embeddings.map(
              (e: { embedding: number[] }) => e.embedding
            );

            console.log(`Verification: Got ${embeddings.length} embeddings`);

            // Cosine similarity helper
            const cosineSimilarity = (a: number[], b: number[]): number => {
              let dotProduct = 0;
              let normA = 0;
              let normB = 0;
              for (let i = 0; i < a.length; i++) {
                dotProduct += a[i] * b[i];
                normA += a[i] * a[i];
                normB += b[i] * b[i];
              }
              return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
            };

            // Lexical scoring helper (simplified BM25-ish)
            const calculateLexicalScore = (text: string, query: string): number => {
              const queryTerms = query.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(t => t.length > 2);
              const textLower = text.toLowerCase();
              
              let matchedTerms = 0;
              let positionBonus = 0;
              
              queryTerms.forEach(term => {
                if (textLower.includes(term)) {
                  matchedTerms++;
                  // Position bonus: terms in first 100 chars get extra weight
                  const firstPos = textLower.indexOf(term);
                  if (firstPos < 100) positionBonus += 0.1;
                  if (firstPos < 50) positionBonus += 0.1;
                }
              });
              
              const coverage = queryTerms.length > 0 ? matchedTerms / queryTerms.length : 0;
              return Math.min(100, (coverage + positionBonus) * 100);
            };

            // Citation score helper (specificity signals)
            const calculateCitationScore = (text: string): number => {
              let score = 50; // Base score
              
              // Check for numbers
              const numbers = text.match(/\d+(\.\d+)?%?/g) || [];
              score += Math.min(20, numbers.length * 5);
              
              // Check for specific patterns
              if (/\$[\d,]+/.test(text)) score += 10; // Dollar amounts
              if (/\d+-\d+\s*(days?|weeks?|months?|years?)/.test(text)) score += 10; // Time ranges
              if (/[A-Z][a-z]+\s+[A-Z][a-z]+/.test(text)) score += 5; // Proper names
              
              // Penalize vague language
              const vaguePatterns = [
                /varies?\s+widely/i,
                /depends?\s+on/i,
                /many\s+factors?/i,
                /it'?s?\s+worth\s+noting/i,
                /importantly/i,
              ];
              vaguePatterns.forEach(p => {
                if (p.test(text)) score -= 5;
              });
              
              return Math.max(0, Math.min(100, score));
            };

            // Process OPTIMIZED chunks
            const verifiedOptimized: Array<{
              chunkIndex: number;
              query: string;
              heading: string;
              before: { semantic: number; lexical: number; citation: number; composite: number };
              after: { semantic: number; lexical: number; citation: number; composite: number };
              delta: { semantic: number; lexical: number; citation: number; composite: number };
              improved: boolean;
              changes: string[];
              unaddressable: string[];
            }> = [];

            for (let i = 0; i < optimizedChunks.length; i++) {
              const opt = optimizedChunks[i];
              const original = allChunks.find(c => c.index === opt.originalChunkIndex);
              
              if (!original) continue;

              const originalEmbIdx = textMap.get(`original:${opt.originalChunkIndex}`);
              const optimizedEmbIdx = textMap.get(`optimized:${i}`);
              const queryIdx = queries.indexOf(opt.query);
              const queryEmbIdx = textMap.get(`query:${queryIdx}`);

              if (originalEmbIdx === undefined || optimizedEmbIdx === undefined || queryEmbIdx === undefined) {
                console.warn(`Missing embedding index for chunk ${opt.originalChunkIndex}`);
                continue;
              }

              const originalEmb = embeddings[originalEmbIdx];
              const optimizedEmb = embeddings[optimizedEmbIdx];
              const queryEmb = embeddings[queryEmbIdx];
              const optimizedText = optimizedWithCascade[i];

              // Calculate before scores
              const beforeSemantic = cosineSimilarity(originalEmb, queryEmb) * 100;
              const beforeLexical = calculateLexicalScore(original.text, opt.query);
              const beforeCitation = calculateCitationScore(original.text);
              const beforeComposite = (beforeSemantic * 0.7) + (beforeLexical * 0.3);

              // Calculate after scores
              const afterSemantic = cosineSimilarity(optimizedEmb, queryEmb) * 100;
              const afterLexical = calculateLexicalScore(optimizedText, opt.query);
              const afterCitation = calculateCitationScore(optimizedText);
              const afterComposite = (afterSemantic * 0.7) + (afterLexical * 0.3);

              const result = {
                chunkIndex: opt.originalChunkIndex,
                query: opt.query,
                heading: original.headingPath[original.headingPath.length - 1] || 'Untitled',
                before: {
                  semantic: Math.round(beforeSemantic * 10) / 10,
                  lexical: Math.round(beforeLexical * 10) / 10,
                  citation: Math.round(beforeCitation * 10) / 10,
                  composite: Math.round(beforeComposite * 10) / 10,
                },
                after: {
                  semantic: Math.round(afterSemantic * 10) / 10,
                  lexical: Math.round(afterLexical * 10) / 10,
                  citation: Math.round(afterCitation * 10) / 10,
                  composite: Math.round(afterComposite * 10) / 10,
                },
                delta: {
                  semantic: Math.round((afterSemantic - beforeSemantic) * 10) / 10,
                  lexical: Math.round((afterLexical - beforeLexical) * 10) / 10,
                  citation: Math.round((afterCitation - beforeCitation) * 10) / 10,
                  composite: Math.round((afterComposite - beforeComposite) * 10) / 10,
                },
                improved: afterComposite > beforeComposite,
                changes: opt.changes || [],
                unaddressable: opt.unaddressable || [],
              };

              verifiedOptimized.push(result);

              // Stream each verified chunk
              await sendEvent({
                type: 'chunk_verified',
                index: i,
                total: optimizedChunks.length,
                result,
                progress: Math.round(((i + 1) / optimizedChunks.length) * 50), // First 50% of progress
              });
            }

            // Process UNCHANGED chunks - find their best matching query
            const unchangedChunks = allChunks.filter(c => !c.wasOptimized);
            const unchangedResults: Array<{
              chunkIndex: number;
              heading: string;
              reason: string;
              currentScores: { semantic: number; lexical: number; citation: number; composite: number };
              bestMatchingQuery: string;
              bestMatchScore: number;
            }> = [];

            for (let i = 0; i < unchangedChunks.length; i++) {
              const chunk = unchangedChunks[i];
              const chunkEmbIdx = textMap.get(`original:${chunk.index}`);
              
              if (chunkEmbIdx === undefined) continue;

              const chunkEmb = embeddings[chunkEmbIdx];
              
              // Find best matching query
              let bestQuery = '';
              let bestScore = 0;
              let bestQueryIdx = -1;

              queries.forEach((q, qi) => {
                const qEmbIdx = textMap.get(`query:${qi}`);
                if (qEmbIdx !== undefined) {
                  const score = cosineSimilarity(chunkEmb, embeddings[qEmbIdx]) * 100;
                  if (score > bestScore) {
                    bestScore = score;
                    bestQuery = q;
                    bestQueryIdx = qi;
                  }
                }
              });

              const lexical = calculateLexicalScore(chunk.text, bestQuery);
              const citation = calculateCitationScore(chunk.text);
              const composite = (bestScore * 0.7) + (lexical * 0.3);

              unchangedResults.push({
                chunkIndex: chunk.index,
                heading: chunk.headingPath[chunk.headingPath.length - 1] || 'Untitled',
                reason: chunk.excludeReason || 'no_assignment',
                currentScores: {
                  semantic: Math.round(bestScore * 10) / 10,
                  lexical: Math.round(lexical * 10) / 10,
                  citation: Math.round(citation * 10) / 10,
                  composite: Math.round(composite * 10) / 10,
                },
                bestMatchingQuery: bestQuery,
                bestMatchScore: Math.round(bestScore * 10) / 10,
              });
            }

            // Stream unchanged chunks
            await sendEvent({
              type: 'unchanged_chunks',
              chunks: unchangedResults,
              progress: 75,
            });

            // Compute document-level summary
            const allBeforeComposites = verifiedOptimized.map(v => v.before.composite);
            const allAfterComposites = [
              ...verifiedOptimized.map(v => v.after.composite),
              ...unchangedResults.map(u => u.currentScores.composite),
            ];

            const average = (arr: number[]) => arr.length > 0 
              ? arr.reduce((a, b) => a + b, 0) / arr.length 
              : 0;

            // Query coverage analysis - get best score for each query
            const queryBestScores = queries.map(q => {
              let best = 0;
              // Check optimized chunks
              verifiedOptimized.forEach(v => {
                if (v.query === q) {
                  best = Math.max(best, v.after.composite);
                }
              });
              // Check unchanged chunks
              unchangedResults.forEach(u => {
                if (u.bestMatchingQuery === q) {
                  best = Math.max(best, u.currentScores.composite);
                }
              });
              return { query: q, score: best };
            });

            const wellCovered = queryBestScores.filter(q => q.score >= 70).length;
            const partiallyCovered = queryBestScores.filter(q => q.score >= 40 && q.score < 70).length;
            const gaps = queryBestScores.filter(q => q.score < 40).length;

            const summary = {
              totalChunks: allChunks.length,
              optimizedCount: optimizedChunks.length,
              unchangedCount: unchangedResults.length,
              avgCompositeBefore: Math.round(average(allBeforeComposites) * 10) / 10,
              avgCompositeAfter: Math.round(average(allAfterComposites) * 10) / 10,
              avgImprovement: Math.round((average(allAfterComposites) - average(allBeforeComposites)) * 10) / 10,
              chunksImproved: verifiedOptimized.filter(v => v.improved).length,
              chunksDeclined: verifiedOptimized.filter(v => !v.improved).length,
              queryCoverage: {
                total: queries.length,
                wellCovered,
                partiallyCovered,
                gaps,
                gapQueries: queryBestScores.filter(q => q.score < 40).map(q => q.query),
              },
            };

            // Stream final verification result
            await sendEvent({
              type: 'verification_complete',
              summary,
              optimizedChunks: verifiedOptimized,
              unchangedChunks: unchangedResults,
              queryCoverage: queryBestScores,
              architectureApplied: architectureApplied || null,
              progress: 100,
            });

            console.log(`Verification complete: ${verifiedOptimized.length} optimized, ${unchangedResults.length} unchanged`);
            break;
          }

          default:
            await sendEvent({ type: 'error', message: `Unknown type: ${type}` });
        }
      } catch (error) {
        console.error('Streaming error:', error);
        await sendEvent({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Request error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
