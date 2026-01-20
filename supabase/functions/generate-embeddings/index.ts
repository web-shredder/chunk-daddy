import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const MODEL = 'text-embedding-3-large';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { texts } = await req.json();

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

    console.log(`Generating embeddings for ${validTexts.length} texts using ${MODEL}`);

    // Batch texts to stay under token limits (~8k tokens per batch, ~20 chars per token estimate)
    const MAX_CHARS_PER_BATCH = 150000; // ~7500 tokens worth, leaving buffer
    const batches: string[][] = [];
    let currentBatch: string[] = [];
    let currentBatchChars = 0;

    for (const text of validTexts) {
      const textChars = text.length;
      if (currentBatchChars + textChars > MAX_CHARS_PER_BATCH && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [text];
        currentBatchChars = textChars;
      } else {
        currentBatch.push(text);
        currentBatchChars += textChars;
      }
    }
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    console.log(`Split into ${batches.length} batches`);

    const allEmbeddings: { text: string; embedding: number[] }[] = [];

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      console.log(`Processing batch ${batchIdx + 1}/${batches.length} with ${batch.length} texts`);

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: batch,
          model: MODEL,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OpenAI API error:', response.status, errorData);
        return new Response(
          JSON.stringify({ 
            error: errorData.error?.message || `OpenAI API request failed with status ${response.status}` 
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const sortedData = data.data.sort((a: any, b: any) => a.index - b.index);
      
      sortedData.forEach((item: any, index: number) => {
        allEmbeddings.push({
          text: batch[index],
          embedding: item.embedding,
        });
      });
    }

    const embeddings = allEmbeddings;

    console.log(`Successfully generated ${embeddings.length} embeddings`);

    return new Response(
      JSON.stringify({ embeddings }),
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
