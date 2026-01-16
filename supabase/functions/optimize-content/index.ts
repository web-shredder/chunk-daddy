import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptimizationRequest {
  type: 'analyze' | 'optimize' | 'explain';
  content: string;
  queries: string[];
  currentScores?: Record<string, number>;
  analysis?: any;
  validatedChanges?: any;
}

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

    const { type, content, queries, currentScores, analysis, validatedChanges }: OptimizationRequest = await req.json();

    console.log(`Processing ${type} request for content length: ${content?.length}, queries: ${queries?.length}`);

    let systemPrompt = '';
    let userPrompt = '';
    let tools: any[] = [];
    let toolChoice: any = undefined;

    if (type === 'analyze') {
      systemPrompt = `You are a content optimization expert for RAG retrieval systems.

Analyze content to identify optimization opportunities:
1. Topic boundaries where splits would improve focus
2. Pronouns/references that create cross-chunk dependencies  
3. Missing context that would improve self-containment
4. Heading opportunities that would boost semantic matching
5. Entity references that should be more explicit

Consider current similarity scores to prioritize high-impact changes.`;

      userPrompt = `Analyze this content for retrieval optimization:

Content:
"""
${content}
"""

Target Queries:
${queries.map((q, i) => `${i + 1}. "${q}"`).join('\n')}

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
      systemPrompt = `You rewrite content to improve RAG retrieval while maintaining:
- Natural, readable prose
- Original meaning and facts
- Professional tone
- Minimal repetition

Apply optimizations based on analysis. Each chunk should:
1. Focus on one main topic
2. Be self-contained (no external dependencies)
3. Front-load key entities
4. Include relevant semantic signals

Show specific changes and explain retrieval impact.`;

      userPrompt = `Original Content:
"""
${content}
"""

Analysis:
${JSON.stringify(analysis, null, 2)}

${currentScores ? `Current Scores:\n${JSON.stringify(currentScores, null, 2)}` : ''}

Target Queries: ${queries.join(', ')}

Rewrite the content applying the identified optimizations. For each change:
1. Show exact before/after text
2. Explain why it improves retrieval
3. Predict score impact

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
      systemPrompt = `You explain content optimization changes clearly and concisely.

For each change:
1. What specifically changed (concrete)
2. Why it improves retrieval (semantic reason)
3. Actual quantitative impact (scores)
4. Any trade-offs

Keep explanations to 2-3 sentences. Use specific numbers.`;

      userPrompt = `Generate user-facing explanations for these validated changes:

${JSON.stringify(validatedChanges, null, 2)}

Queries: ${queries.join(', ')}

Make explanations clear for content creators who may not know RAG internals.`;

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
          { role: 'user', content: userPrompt }
        ],
        tools,
        tool_choice: toolChoice,
        max_completion_tokens: 4096,
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

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('No tool call in response');
      return new Response(
        JSON.stringify({ error: 'AI did not return structured output' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);
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
