import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

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

    const sendEvent = async (data: any) => {
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

              // Apply each task individually
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
            const totalAssignments = queryAssignments.length;
            
            // Log what we received for debugging
            console.log('Chunks to optimize:', {
              totalChunks: chunks?.length,
              assignmentsCount: queryAssignments?.length,
              assignments: queryAssignments?.map((qa: { chunkIndex: number; originalChunkIndex?: number; queries: string[] }) => ({
                idx: qa.chunkIndex,
                origIdx: qa.originalChunkIndex,
                q: qa.queries?.[0]?.slice(0, 30),
              })),
            });

            for (let i = 0; i < queryAssignments.length; i++) {
              const assignment = queryAssignments[i];
              // Use chunkIndex to access the chunks array (may be filtered)
              const arrayIndex = assignment.chunkIndex;
              // Use originalChunkIndex for reporting back to client (if provided)
              const reportIndex = assignment.originalChunkIndex ?? assignment.chunkIndex;
              const chunkText = chunks[arrayIndex];
              const query = assignment.queries[0];
              
              if (!chunkText) {
                console.warn(`Missing chunk at index ${arrayIndex}, skipping`);
                continue;
              }

              await sendEvent({
                type: 'chunk_started',
                chunkIndex: reportIndex,
                chunkNumber: reportIndex + 1,
                query,
                progress: Math.round((i / totalAssignments) * 100),
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
                      content: `You optimize content passages for RAG retrieval systems.

GOAL: Improve retrieval probability for the assigned query.

WHAT IMPROVES RETRIEVAL:
1. ANSWER THE QUERY - Ensure a clear answer exists
2. ADD SPECIFIC FACTS - Numbers, names, examples, timeframes
3. MAKE IT SELF-CONTAINED - Passage makes sense alone
4. USE NATURAL DOMAIN VOCABULARY - Not forced keywords
5. COVER MULTIPLE FACETS - Address different aspects

WHAT HURTS RETRIEVAL:
1. KEYWORD STUFFING - Once is enough
2. FILLER CONTENT - "importantly", "it's worth noting"
3. VAGUE STATEMENTS - Be specific
4. GOING OFF-TOPIC - Stay focused

Return ONLY the optimized text, no explanations or preamble.`,
                    },
                    {
                      role: 'user',
                      content: `Optimize this chunk for the query: "${query}"

CHUNK:
${chunkText}`,
                    },
                  ],
                  max_tokens: 2048,
                  stream: false,
                }),
              });

              let optimizedText = chunkText;
              if (response.ok) {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content;
                if (content) {
                  optimizedText = content;
                }
              } else {
                console.error(`AI optimization failed for chunk ${reportIndex}:`, response.status);
              }

              await sendEvent({
                type: 'chunk_optimized',
                chunkNumber: reportIndex + 1,
                chunkIndex: reportIndex,
                originalText: chunkText,
                optimizedText: optimizedText,
                query: query,
                progress: Math.round(((i + 1) / totalAssignments) * 100),
              });
            }

            await sendEvent({ type: 'chunks_complete', totalProcessed: totalAssignments });
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
${(existingChunks || []).map((c: any, i: number) => `${i + 1}. ${c.heading || 'Untitled'}`).join('\n')}

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

              let brief = { targetQuery: query, suggestedHeading: '', placementDescription: '', keyPoints: [], targetWordCount: { min: 300, max: 500 }, draftOpening: '', gapAnalysis: '' };

              if (response.ok) {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content;
                if (content) {
                  try {
                    // Try to extract JSON from the response
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
