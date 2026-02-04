import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Gemini Embedding API configuration
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TaskType = 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY';

interface EmbeddingRequest {
  texts: string[];
  taskType?: TaskType;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Gemini API key is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { texts, taskType = 'RETRIEVAL_DOCUMENT' }: EmbeddingRequest = await req.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      console.error('Invalid input: texts must be a non-empty array');
      return new Response(
        JSON.stringify({ error: 'texts must be a non-empty array of strings' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter out empty strings
    const validTexts = texts.filter((t: string) => t && t.trim().length > 0);
    if (validTexts.length === 0) {
      console.error('No valid texts provided');
      return new Response(
        JSON.stringify({ error: 'No valid texts provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating embeddings for ${validTexts.length} texts using Gemini (taskType: ${taskType})`);

    // Gemini batch endpoint allows up to 100 texts per request
    const BATCH_SIZE = 100;
    const allEmbeddings: { text: string; embedding: number[] }[] = [];

    for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
      const batch = validTexts.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(validTexts.length / BATCH_SIZE)} with ${batch.length} texts`);

      // Use batchEmbedContents for multiple texts
      const response = await fetch(`${GEMINI_API_URL}:batchEmbedContents?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: batch.map((text: string) => ({
            model: 'models/gemini-embedding-001',
            content: { parts: [{ text }] },
            taskType,
            outputDimensionality: 3072,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Gemini API error:', response.status, errorData);
        
        // Handle rate limiting
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Handle quota exceeded
        if (response.status === 402 || (errorData.error?.message && errorData.error.message.includes('quota'))) {
          return new Response(
            JSON.stringify({ error: 'API quota exceeded. Please check your Gemini API billing.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            error: errorData.error?.message || `Gemini API request failed with status ${response.status}` 
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      
      // Extract embeddings from response
      // Response format: { embeddings: [{ values: number[] }, ...] }
      if (!data.embeddings || !Array.isArray(data.embeddings)) {
        console.error('Unexpected response format:', data);
        return new Response(
          JSON.stringify({ error: 'Unexpected response format from Gemini API' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      data.embeddings.forEach((emb: { values: number[] }, index: number) => {
        allEmbeddings.push({
          text: batch[index],
          embedding: emb.values,
        });
      });
    }

    console.log(`Successfully generated ${allEmbeddings.length} embeddings (${allEmbeddings[0]?.embedding?.length || 0} dimensions)`);

    return new Response(
      JSON.stringify({ embeddings: allEmbeddings }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-embeddings function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
