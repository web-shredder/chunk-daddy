import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptimizationRequest {
  type: 'analyze' | 'optimize' | 'explain' | 'suggest_keywords' | 'summarize';
  content: string;
  queries?: string[];
  currentScores?: Record<string, number>;
  analysis?: any;
  validatedChanges?: any;
  chunkScoreData?: any; // For summarize: original and optimized scores per chunk per query
}

// Dynamic token limits by operation type - prevents truncation while optimizing costs
const maxTokensByType: Record<OptimizationRequest['type'], number> = {
  'analyze': 8192,         // Structured analysis, moderate size
  'optimize': 32768,       // Full rewritten content - largest output
  'explain': 4096,         // Short explanations
  'suggest_keywords': 2048, // Just a keyword list
  'summarize': 8192        // RAG explanations, suggestions, trade-offs
};

// Passage Score context to educate AI about the scoring system
const PASSAGE_SCORE_CONTEXT = `
PASSAGE SCORE SYSTEM:
Passage Score (0-100) predicts RAG retrieval probability by combining two metrics:
- Cosine Similarity (70% weight): Direct semantic relevance between chunk and query
- Chamfer Similarity (30% weight): Multi-aspect coverage - how well the chunk addresses ALL facets of the query

FORMULA: Passage Score = (cosine × 0.7 + chamfer × 0.3) × 100

QUALITY TIERS:
- Excellent (90-100): High retrieval probability, likely top 5 results
- Good (75-89): Strong candidate for top 10 results  
- Moderate (60-74): Competitive but depends on other content
- Weak (40-59): May be retrieved if competition is low
- Poor (0-39): Likely filtered out during retrieval

WHY CHAMFER MATTERS:
Chamfer similarity measures bidirectional coverage:
- Does the chunk cover ALL aspects the user might be searching for?
- A chunk that only matches one keyword strongly (high cosine) but misses related concepts (low chamfer) scores lower
- Adding context, related terms, and self-contained explanations improves chamfer

OPTIMIZATION GOAL: Maximize Passage Score, not just cosine similarity.
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { type, content, queries, currentScores, analysis, validatedChanges, chunkScoreData }: OptimizationRequest = await req.json();

    console.log(`Processing ${type} request for content length: ${content?.length}, queries: ${queries?.length}`);

    let systemPrompt = '';
    let userPrompt = '';
    let tools: any[] = [];
    let toolChoice: any = undefined;

    if (type === 'analyze') {
      systemPrompt = `You are a content optimization expert for RAG retrieval systems.

${PASSAGE_SCORE_CONTEXT}

Analyze content to identify optimization opportunities that improve Passage Score:
1. Topic boundaries where splits would improve focus (helps cosine)
2. Missing context that would improve multi-aspect coverage (helps chamfer)
3. Pronouns/references that create cross-chunk dependencies (hurts both)
4. Heading opportunities that add semantic signals (helps cosine)
5. Missing related concepts that queries might include (helps chamfer)

Prioritize changes that improve BOTH cosine and chamfer simultaneously.`;

      userPrompt = `Analyze this content for Passage Score optimization:

Content:
"""
${content}
"""

Target Queries:
${queries?.map((q, i) => `${i + 1}. "${q}"`).join('\n') || 'None provided'}

${currentScores ? `Current Scores:\n${JSON.stringify(currentScores, null, 2)}` : ''}

Identify optimization opportunities and rank by expected impact.`;

      tools = [{
        type: "function",
        function: {
          name: "analyze_content",
          description: "Analyze content for retrieval optimization opportunities",
          parameters: {
            type: "object",
            properties: {
              topic_segments: {
                type: "array",
                description: "Identified topic boundaries",
                items: {
                  type: "object",
                  properties: {
                    start_pos: { type: "integer" },
                    end_pos: { type: "integer" },
                    topic: { type: "string" },
                    related_queries: { type: "array", items: { type: "string" } }
                  },
                  required: ["start_pos", "end_pos", "topic", "related_queries"]
                }
              },
              optimization_opportunities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["split_paragraph", "add_heading", "replace_pronoun", "add_context", "reorder_sentences"] },
                    position: { type: "integer" },
                    priority: { type: "string", enum: ["high", "medium", "low"] },
                    affected_queries: { type: "array", items: { type: "string" } },
                    expected_impact: { type: "string" },
                    reasoning: { type: "string" }
                  },
                  required: ["type", "position", "priority", "reasoning"]
                }
              }
            },
            required: ["topic_segments", "optimization_opportunities"]
          }
        }
      }];
      toolChoice = { type: "function", function: { name: "analyze_content" } };

    } else if (type === 'optimize') {
      systemPrompt = `You rewrite content to maximize Passage Score for RAG retrieval.

${PASSAGE_SCORE_CONTEXT}

OPTIMIZATION STRATEGIES:
For Cosine Similarity (semantic relevance):
- Front-load key entities and topic keywords
- Use exact query terminology where natural
- Add clear, descriptive headings

For Chamfer Similarity (multi-aspect coverage):
- Ensure chunks are self-contained (no external dependencies)
- Include related concepts and context
- Add explanatory phrases that cover query facets
- Avoid thin chunks that only match one keyword

CONSTRAINTS:
- Maintain natural, readable prose
- Preserve original meaning and facts
- Keep professional tone
- Minimize repetition

Show specific changes and predict Passage Score impact.`;

      userPrompt = `Original Content:
"""
${content}
"""

Analysis:
${JSON.stringify(analysis, null, 2)}

${currentScores ? `Current Passage Scores:\n${JSON.stringify(currentScores, null, 2)}` : ''}

Target Queries: ${queries?.join(', ') || 'None'}

Rewrite the content applying the identified optimizations. For each change:
1. Show exact before/after text
2. Explain impact on BOTH cosine (semantic match) and chamfer (multi-aspect coverage)
3. Predict Passage Score improvement

Maintain readability - don't make it robotic.`;

      tools = [{
        type: "function",
        function: {
          name: "generate_optimizations",
          description: "Generate optimized content with tracked changes",
          parameters: {
            type: "object",
            properties: {
              optimized_chunks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    chunk_number: { type: "integer" },
                    heading: { type: "string", description: "Suggested heading for this chunk" },
                    original_text: { type: "string" },
                    optimized_text: { type: "string" },
                    changes_applied: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          change_id: { type: "string" },
                          change_type: { type: "string", enum: ["split_paragraph", "add_heading", "replace_pronoun", "add_context", "reorder_sentences"] },
                          before: { type: "string" },
                          after: { type: "string" },
                          reason: { type: "string" },
                          expected_improvement: { type: "string" }
                        },
                        required: ["change_id", "change_type", "before", "after", "reason", "expected_improvement"]
                      }
                    }
                  },
                  required: ["chunk_number", "original_text", "optimized_text", "changes_applied"]
                }
              }
            },
            required: ["optimized_chunks"]
          }
        }
      }];
      toolChoice = { type: "function", function: { name: "generate_optimizations" } };

    } else if (type === 'explain') {
      systemPrompt = `You explain content optimization changes in terms of Passage Score impact.

${PASSAGE_SCORE_CONTEXT}

For each change:
1. What specifically changed (concrete before/after)
2. How it affects cosine similarity (semantic match)
3. How it affects chamfer similarity (multi-aspect coverage)
4. Net Passage Score impact with actual numbers

Keep explanations to 2-3 sentences. Use Passage Score tier names (Excellent, Good, Moderate, Weak, Poor) when relevant.`;

      userPrompt = `Generate user-facing explanations for these validated changes:

${JSON.stringify(validatedChanges, null, 2)}

Queries: ${queries?.join(', ') || 'None'}

Explain each change in terms of Passage Score improvement. Make explanations clear for content creators who may not know RAG internals.`;

      tools = [{
        type: "function",
        function: {
          name: "generate_explanations",
          description: "Generate user-friendly explanations for changes",
          parameters: {
            type: "object",
            properties: {
              explanations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    change_id: { type: "string" },
                    title: { type: "string" },
                    explanation: { type: "string" },
                    impact_summary: { type: "string" },
                    trade_offs: { type: "string" }
                  },
                  required: ["change_id", "title", "explanation", "impact_summary"]
                }
              }
            },
            required: ["explanations"]
          }
        }
      }];
      toolChoice = { type: "function", function: { name: "generate_explanations" } };

    } else if (type === 'suggest_keywords') {
      systemPrompt = `You are an SEO and content retrieval expert. Analyze content to identify the most valuable target SEO keywords that users would likely search for to find this content.

CRITICAL REQUIREMENT: Each keyword MUST be exactly 2-5 words long. No single-word keywords. No phrases longer than 5 words.

Focus on:
1. Primary topics and entities mentioned
2. User intent - what questions would lead someone to this content
3. Long-tail keywords with good specificity (2-5 words)
4. Keywords that would have high retrieval relevance
5. Mix of head terms and specific multi-word phrases

Prioritize keywords by search intent alignment and retrieval potential.`;

      userPrompt = `Analyze this content and suggest 5-7 target SEO keywords that would be most valuable for retrieval optimization:

Content:
"""
${content}
"""

Suggest keywords that:
- Are exactly 2-5 words long (REQUIRED - no single words, no phrases over 5 words)
- Represent the main topics users would search for
- Have high semantic alignment with the content
- Would be useful for embedding-based retrieval testing`;

      tools = [{
        type: "function",
        function: {
          name: "suggest_keywords",
          description: "Suggest SEO keywords for the content",
          parameters: {
            type: "object",
            properties: {
              keywords: {
                type: "array",
                description: "Suggested SEO keywords ranked by relevance",
                items: {
                  type: "object",
                  properties: {
                    keyword: { type: "string", description: "The suggested keyword or phrase" },
                    reason: { type: "string", description: "Why this keyword is valuable for retrieval" },
                    intent: { type: "string", enum: ["informational", "navigational", "transactional", "commercial"], description: "Search intent type" }
                  },
                  required: ["keyword", "reason", "intent"]
                }
              }
            },
            required: ["keywords"]
          }
        }
      }];
      toolChoice = { type: "function", function: { name: "suggest_keywords" } };
    
    } else if (type === 'summarize') {
      systemPrompt = `You are a RAG retrieval optimization expert. Analyze Passage Score changes and provide insights.

${PASSAGE_SCORE_CONTEXT}

For the optimization results:
1. RAG Impact Explanations: For each score change, explain why the Passage Score changed. Reference both cosine (semantic match) and chamfer (multi-aspect coverage) components.

2. Tier Movement: Note when chunks move between tiers (e.g., "Moderate → Good")

3. Further Optimization Suggestions: Suggest 2-4 actions that could further improve Passage Score. Be honest if improvements are unlikely.

4. Trade-Off Considerations: List 2-4 concerns about brand voice, UX, readability, SEO.

Use the actual Passage Score numbers provided, not just cosine.`;

      userPrompt = `Analyze these Passage Score changes from content optimization:

Score Data by Chunk (includes Passage Score, cosine, and chamfer):
${JSON.stringify(chunkScoreData, null, 2)}

Queries: ${queries?.join(', ') || 'None'}

Changes Applied:
${JSON.stringify(validatedChanges?.map((c: any) => ({ 
  chunk: c.chunk_number, 
  heading: c.heading,
  changes: c.changes_applied?.map((ch: any) => ch.change_type + ': ' + ch.reason)
})), null, 2)}

For each Passage Score change, explain the impact on RAG retrieval. Note tier transitions (e.g., Weak→Moderate). Then provide further suggestions and trade-off considerations.`;

      tools = [{
        type: "function",
        function: {
          name: "generate_summary",
          description: "Generate optimization summary with RAG explanations",
          parameters: {
            type: "object",
            properties: {
              rag_explanations: {
                type: "array",
                description: "RAG impact explanation for each chunk-query pair",
                items: {
                  type: "object",
                  properties: {
                    chunk_number: { type: "integer" },
                    query: { type: "string" },
                    explanation: { type: "string", description: "1-2 sentence explanation of why this score change matters for RAG retrieval" }
                  },
                  required: ["chunk_number", "query", "explanation"]
                }
              },
              further_suggestions: {
                type: "array",
                description: "Additional optimization suggestions",
                items: {
                  type: "object",
                  properties: {
                    suggestion: { type: "string" },
                    expected_impact: { type: "string", enum: ["high", "medium", "low", "unlikely"] },
                    reasoning: { type: "string" }
                  },
                  required: ["suggestion", "expected_impact", "reasoning"]
                }
              },
              trade_off_considerations: {
                type: "array",
                description: "Concerns to consider before applying changes",
                items: {
                  type: "object",
                  properties: {
                    category: { type: "string", enum: ["brand", "ux", "readability", "seo", "other"] },
                    concern: { type: "string" },
                    severity: { type: "string", enum: ["minor", "moderate", "significant"] }
                  },
                  required: ["category", "concern", "severity"]
                }
              }
            },
            required: ["rag_explanations", "further_suggestions", "trade_off_considerations"]
          }
        }
      }];
      toolChoice = { type: "function", function: { name: "generate_summary" } };
    }

    const responseTools = (tools ?? []).map((t: any) => {
      if (t?.type === 'function' && t.function) {
        return {
          type: 'function',
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        };
      }
      return t;
    });

    const requiredToolName = toolChoice?.type === 'function' ? toolChoice.function?.name : undefined;
    const responseToolChoice = requiredToolName
      ? {
          type: 'allowed_tools',
          mode: 'required',
          tools: [{ type: 'function', name: requiredToolName }],
        }
      : undefined;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        input: [
          { role: 'developer', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: responseTools,
        tool_choice: responseToolChoice,
        max_output_tokens: maxTokensByType[type] || 16384,
        reasoning: { effort: 'none' },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI optimization failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('AI response received');

    // Extract the tool call result from Responses API format
    const output = data.output;
    const toolCall = output?.find((item: any) => item.type === 'function_call');
    if (!toolCall) {
      console.error('No tool call in response', JSON.stringify(data, null, 2));
      return new Response(
        JSON.stringify({ error: 'AI did not return structured output' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse tool arguments with error handling for truncated JSON
    let result;
    try {
      result = JSON.parse(toolCall.arguments);
    } catch (parseError) {
      console.error('JSON parse error - arguments may be truncated:', parseError);
      console.error('Raw arguments (first 500 chars):', toolCall.arguments?.substring(0, 500));
      console.error('Raw arguments (last 500 chars):', toolCall.arguments?.substring(toolCall.arguments.length - 500));
      
      // Try to salvage partial data by attempting to fix common truncation issues
      let fixedJson = toolCall.arguments;
      
      // Try adding closing brackets if truncated
      const openBraces = (fixedJson.match(/\{/g) || []).length;
      const closeBraces = (fixedJson.match(/\}/g) || []).length;
      const openBrackets = (fixedJson.match(/\[/g) || []).length;
      const closeBrackets = (fixedJson.match(/\]/g) || []).length;
      
      // Add missing closing characters
      fixedJson += '}]}}'.repeat(Math.max(0, openBraces - closeBraces));
      fixedJson = fixedJson.replace(/}+$/, '}]}'.repeat(Math.max(0, openBrackets - closeBrackets)) + '}');
      
      try {
        result = JSON.parse(fixedJson);
        console.log('Successfully recovered partial JSON');
      } catch {
        return new Response(
          JSON.stringify({ 
            error: 'AI response was truncated. Please try again with shorter content or fewer queries.',
            details: 'The AI generated a response that exceeded output limits.'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log(`${type} completed successfully`);

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in optimize-content:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Optimization failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
