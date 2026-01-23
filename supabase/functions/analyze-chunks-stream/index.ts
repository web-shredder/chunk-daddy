// Streaming Analysis Edge Function
// Performs embedding generation, scoring, and diagnostics with SSE progress updates

import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-large";
const MAX_CHARS_PER_BATCH = 150000;

interface ChunkInput {
  id: string;
  index: number;
  text: string;
  textWithoutCascade: string;
  headingPath: string[];
  wordCount: number;
  charCount: number;
}

interface AnalysisRequest {
  chunks: ChunkInput[];
  queries: string[];
  originalContent: string;
}

// =============== LEXICAL SCORING (mirrored from client) ===============

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'between', 'under', 'over', 'out', 'off',
  'up', 'down', 'about', 'against', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her',
  'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just',
  'don', 'now', 'also', 'if', 'then', 'because', 'while', 'although', 'whether', 'both',
  'either', 'neither', 'anyone', 'someone', 'everyone', 'nobody', 'nothing', 'everything'
]);

function tokenizeQuery(query: string): string[] {
  const words = query.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);
  return words.filter(word => !STOP_WORDS.has(word) && word.length > 2);
}

function calculateLexicalScore(
  chunkText: string,
  chunkWithoutCascade: string,
  query: string,
  headingPath: string[]
): {
  termCoverage: number;
  exactPhraseMatch: boolean;
  titleBoost: number;
  positionBonus: number;
  score: number;
} {
  const queryTerms = tokenizeQuery(query);
  if (queryTerms.length === 0) {
    return { termCoverage: 0, exactPhraseMatch: false, titleBoost: 0, positionBonus: 0, score: 0 };
  }

  const textLower = chunkText.toLowerCase();
  const bodyLower = chunkWithoutCascade.toLowerCase();
  const headingsLower = headingPath.map(h => h.toLowerCase()).join(' ');

  // Count term matches
  let matchedInBody = 0;
  let matchedInHeadings = 0;
  
  for (const term of queryTerms) {
    if (bodyLower.includes(term)) matchedInBody++;
    if (headingsLower.includes(term)) matchedInHeadings++;
  }

  const termCoverage = matchedInBody / queryTerms.length;

  // Check for exact phrase match
  const queryLower = query.toLowerCase();
  const exactPhraseMatch = textLower.includes(queryLower);

  // Title boost: terms in headings
  const titleBoost = matchedInHeadings / Math.max(queryTerms.length, 1);

  // Position bonus: terms in first 100 chars
  const first100 = bodyLower.slice(0, 100);
  const termsInFirst100 = queryTerms.filter(t => first100.includes(t)).length;
  const positionBonus = termsInFirst100 / queryTerms.length;

  // Final score: weighted combination
  let score = termCoverage * 0.4;
  if (exactPhraseMatch) score += 0.25;
  score += titleBoost * 0.2;
  score += positionBonus * 0.15;
  
  return {
    termCoverage,
    exactPhraseMatch,
    titleBoost,
    positionBonus,
    score: Math.min(score, 1),
  };
}

// =============== RERANK SCORING ===============

function calculateRerankScore(
  chunkText: string,
  chunkWithoutCascade: string,
  query: string,
  headingPath: string[]
): {
  entityProminence: number;
  directAnswer: number;
  structuralClarity: number;
  queryRestatement: number;
  score: number;
} {
  const textLower = chunkText.toLowerCase();
  const bodyLower = chunkWithoutCascade.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryTerms = tokenizeQuery(query);

  // Entity prominence: key terms in first sentence
  const firstSentence = bodyLower.split(/[.!?]/)[0] || '';
  const termsInFirstSentence = queryTerms.filter(t => firstSentence.includes(t)).length;
  const entityProminence = queryTerms.length > 0 ? termsInFirstSentence / queryTerms.length : 0;

  // Direct answer detection: declarative patterns
  const directAnswerPatterns = [
    /^(yes|no|it is|it was|they are|this is|the answer is)/i,
    /(is defined as|refers to|means that|consists of)/i,
    /^\d+[\s\w]*$/,  // Starts with number
  ];
  const hasDirectAnswer = directAnswerPatterns.some(p => p.test(firstSentence));
  const directAnswer = hasDirectAnswer ? 0.8 : 0.2;

  // Structural clarity: lists, headers, steps
  const hasList = /(?:^|\n)\s*[-•*]\s+/m.test(chunkText) || /(?:^|\n)\s*\d+[.)]\s+/m.test(chunkText);
  const hasStructure = hasList || headingPath.length > 0;
  const structuralClarity = hasStructure ? 0.7 : 0.3;

  // Query restatement: does chunk echo the query?
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);
  const restatedWords = queryWords.filter(w => textLower.includes(w)).length;
  const queryRestatement = queryWords.length > 0 ? restatedWords / queryWords.length : 0;

  // Weighted score
  const score = 
    entityProminence * 0.35 +
    directAnswer * 0.30 +
    structuralClarity * 0.20 +
    queryRestatement * 0.15;

  return {
    entityProminence,
    directAnswer,
    structuralClarity,
    queryRestatement,
    score: Math.min(score, 1),
  };
}

// =============== CITATION SCORING ===============

function calculateCitationScore(
  chunkText: string,
  chunkWithoutCascade: string
): {
  specificity: number;
  quotability: number;
  score: number;
} {
  const bodyText = chunkWithoutCascade;
  
  // Specificity: numbers, proper nouns, dates
  const hasNumbers = /\d+/.test(bodyText);
  const hasYear = /\b(19|20)\d{2}\b/.test(bodyText);
  const hasProperNouns = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/.test(bodyText);
  const specificity = (hasNumbers ? 0.3 : 0) + (hasYear ? 0.3 : 0) + (hasProperNouns ? 0.4 : 0);

  // Quotability: short declarative sentences
  const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const shortDeclarative = sentences.filter(s => {
    const words = s.trim().split(/\s+/).length;
    return words >= 5 && words <= 25;
  });
  const quotability = sentences.length > 0 ? shortDeclarative.length / sentences.length : 0;

  const score = specificity * 0.5 + quotability * 0.5;

  return {
    specificity,
    quotability,
    score: Math.min(score, 1),
  };
}

// =============== VECTOR MATH ===============

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function chamferSimilarity(setA: number[][], setB: number[][]): number {
  if (setA.length === 0 || setB.length === 0) return 0;
  
  // For each vector in A, find max similarity to any vector in B
  let sumAtoB = 0;
  for (const a of setA) {
    let maxSim = -Infinity;
    for (const b of setB) {
      const sim = cosineSimilarity(a, b);
      if (sim > maxSim) maxSim = sim;
    }
    sumAtoB += maxSim;
  }
  
  // For each vector in B, find max similarity to any vector in A
  let sumBtoA = 0;
  for (const b of setB) {
    let maxSim = -Infinity;
    for (const a of setA) {
      const sim = cosineSimilarity(a, b);
      if (sim > maxSim) maxSim = sim;
    }
    sumBtoA += maxSim;
  }
  
  // Symmetric average
  return (sumAtoB / setA.length + sumBtoA / setB.length) / 2;
}

function calculatePassageScore(cosine: number, chamfer: number): number {
  return (cosine * 0.7 + chamfer * 0.3) * 100;
}

// =============== EMBEDDING GENERATION ===============

async function generateEmbeddingsBatch(
  texts: string[],
  apiKey: string,
  onProgress: (batch: number, total: number, count: number) => void
): Promise<number[][]> {
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentChars = 0;

  for (const text of texts) {
    const textChars = text.length;
    if (currentChars + textChars > MAX_CHARS_PER_BATCH && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [text];
      currentChars = textChars;
    } else {
      currentBatch.push(text);
      currentChars += textChars;
    }
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  const allEmbeddings: { index: number; embedding: number[] }[] = [];
  let processedCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: batch,
        model: MODEL,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    for (const item of data.data) {
      allEmbeddings.push({
        index: processedCount + item.index,
        embedding: item.embedding,
      });
    }
    
    processedCount += batch.length;
    onProgress(i + 1, batches.length, processedCount);
  }

  // Sort by original index
  allEmbeddings.sort((a, b) => a.index - b.index);
  return allEmbeddings.map(e => e.embedding);
}

// =============== MAIN HANDLER ===============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chunks, queries, originalContent }: AnalysisRequest = await req.json();

    if (!chunks || chunks.length === 0) {
      return new Response(JSON.stringify({ error: "No chunks provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!queries || queries.length === 0) {
      return new Response(JSON.stringify({ error: "No queries provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAIKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // =============== STEP 1: STARTED ===============
          send("started", {
            totalChunks: chunks.length,
            totalQueries: queries.length,
            totalPairs: chunks.length * queries.length,
            steps: [
              { id: 1, name: "Embedding Generation", status: "pending" },
              { id: 2, name: "Document Chamfer", status: "pending" },
              { id: 3, name: "Chunk Scoring", status: "pending" },
              { id: 4, name: "Coverage Mapping", status: "pending" },
              { id: 5, name: "Diagnostic Scoring", status: "pending" },
            ],
          });

          // =============== STEP 2: EMBEDDING GENERATION ===============
          send("step_started", { step: 1, name: "Embedding Generation" });
          
          // Prepare all texts for embedding
          const textsToEmbed: string[] = [
            originalContent,
            ...chunks.map(c => c.text),
            ...queries,
          ];

          send("embedding_info", {
            totalTexts: textsToEmbed.length,
            breakdown: {
              originalContent: 1,
              chunks: chunks.length,
              queries: queries.length,
            },
            model: MODEL,
            dimensions: 3072,
          });

          const embeddings = await generateEmbeddingsBatch(
            textsToEmbed,
            openAIKey,
            (batch, total, processed) => {
              send("embedding_batch", {
                batch,
                totalBatches: total,
                textsProcessed: processed,
                totalTexts: textsToEmbed.length,
              });
            }
          );

          send("step_complete", { 
            step: 1, 
            name: "Embedding Generation",
            totalEmbeddings: embeddings.length,
            dimensions: 3072,
          });

          // Extract embeddings
          let idx = 0;
          const originalEmbedding = embeddings[idx++];
          const chunkEmbeddings = chunks.map(() => embeddings[idx++]);
          const queryEmbeddings = queries.map(() => embeddings[idx++]);

          // =============== STEP 3: DOCUMENT CHAMFER ===============
          send("step_started", { step: 2, name: "Document Chamfer" });
          
          const documentChamfer = chamferSimilarity(chunkEmbeddings, queryEmbeddings);
          
          send("document_chamfer", {
            score: documentChamfer,
            scorePercent: (documentChamfer * 100).toFixed(1),
            interpretation: documentChamfer >= 0.7 ? "excellent" : 
                          documentChamfer >= 0.5 ? "good" : 
                          documentChamfer >= 0.3 ? "moderate" : "weak",
            chunkCount: chunks.length,
            queryCount: queries.length,
          });
          
          send("step_complete", { step: 2, name: "Document Chamfer" });

          // =============== STEP 4: CHUNK SCORING ===============
          send("step_started", { step: 3, name: "Chunk Scoring" });
          
          const chunkScores: Array<{
            chunkIndex: number;
            chunkId: string;
            heading: string;
            scores: Array<{
              query: string;
              cosine: number;
              passageScore: number;
            }>;
            bestQuery: string;
            bestScore: number;
          }> = [];

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkEmbed = chunkEmbeddings[i];
            
            const queryScores = queries.map((query, qIdx) => {
              const cosine = cosineSimilarity(chunkEmbed, queryEmbeddings[qIdx]);
              const passageScore = calculatePassageScore(cosine, documentChamfer);
              return { query, cosine, passageScore };
            });

            // Find best matching query
            const best = queryScores.reduce((a, b) => a.passageScore > b.passageScore ? a : b);
            
            const chunkResult = {
              chunkIndex: i,
              chunkId: chunk.id,
              heading: chunk.headingPath[chunk.headingPath.length - 1] || `Chunk ${i + 1}`,
              scores: queryScores,
              bestQuery: best.query,
              bestScore: best.passageScore,
            };
            
            chunkScores.push(chunkResult);

            send("chunk_scored", {
              chunkIndex: i,
              chunkId: chunk.id,
              heading: chunkResult.heading,
              bestQuery: best.query,
              bestScore: best.passageScore.toFixed(1),
              progress: ((i + 1) / chunks.length * 100).toFixed(0),
            });
          }

          send("step_complete", { step: 3, name: "Chunk Scoring", chunksScored: chunks.length });

          // =============== STEP 5: COVERAGE MAPPING ===============
          send("step_started", { step: 4, name: "Coverage Mapping" });

          const coverageMap = queries.map((query, qIdx) => {
            let bestScore = 0;
            let bestChunkIndex = 0;
            
            chunkEmbeddings.forEach((chunkEmbed, cIdx) => {
              const score = cosineSimilarity(chunkEmbed, queryEmbeddings[qIdx]);
              if (score > bestScore) {
                bestScore = score;
                bestChunkIndex = cIdx;
              }
            });
            
            const scorePercent = bestScore * 100;
            const status = scorePercent >= 70 ? 'covered' : scorePercent >= 50 ? 'weak' : 'gap';
            
            return {
              query,
              bestChunkIndex,
              bestChunkHeading: chunks[bestChunkIndex]?.headingPath?.slice(-1)[0] || `Chunk ${bestChunkIndex + 1}`,
              score: scorePercent,
              status,
            };
          });

          const coverageSummary = {
            covered: coverageMap.filter(c => c.status === 'covered').length,
            weak: coverageMap.filter(c => c.status === 'weak').length,
            gaps: coverageMap.filter(c => c.status === 'gap').length,
            totalQueries: coverageMap.length,
          };

          send("coverage_calculated", {
            summary: coverageSummary,
            map: coverageMap,
          });

          send("step_complete", { step: 4, name: "Coverage Mapping" });

          // =============== STEP 6: DIAGNOSTIC SCORING ===============
          send("step_started", { step: 5, name: "Diagnostic Scoring" });

          const totalPairs = chunks.length * queries.length;
          const diagnostics: Array<{
            chunkIndex: number;
            query: string;
            semantic: number;
            lexical: { score: number; termCoverage: number; exactPhraseMatch: boolean };
            rerank: { score: number; entityProminence: number; directAnswer: number };
            citation: { score: number; specificity: number; quotability: number };
            composite: number;
          }> = [];

          let pairsProcessed = 0;
          for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
            const chunk = chunks[cIdx];
            
            for (let qIdx = 0; qIdx < queries.length; qIdx++) {
              const query = queries[qIdx];
              
              // Get semantic score from already calculated
              const semanticScore = chunkScores[cIdx].scores[qIdx].passageScore / 100;
              
              // Calculate lexical, rerank, citation
              const lexical = calculateLexicalScore(
                chunk.text,
                chunk.textWithoutCascade,
                query,
                chunk.headingPath
              );
              
              const rerank = calculateRerankScore(
                chunk.text,
                chunk.textWithoutCascade,
                query,
                chunk.headingPath
              );
              
              const citation = calculateCitationScore(
                chunk.text,
                chunk.textWithoutCascade
              );
              
              // Composite: weighted average
              const composite = (semanticScore * 0.4 + lexical.score * 0.2 + rerank.score * 0.25 + citation.score * 0.15);
              
              diagnostics.push({
                chunkIndex: cIdx,
                query,
                semantic: semanticScore,
                lexical: { score: lexical.score, termCoverage: lexical.termCoverage, exactPhraseMatch: lexical.exactPhraseMatch },
                rerank: { score: rerank.score, entityProminence: rerank.entityProminence, directAnswer: rerank.directAnswer },
                citation: { score: citation.score, specificity: citation.specificity, quotability: citation.quotability },
                composite,
              });
              
              pairsProcessed++;
              
              // Send progress every 10 pairs or at the end
              if (pairsProcessed % 10 === 0 || pairsProcessed === totalPairs) {
                send("diagnostic_progress", {
                  pairsProcessed,
                  totalPairs,
                  progress: ((pairsProcessed / totalPairs) * 100).toFixed(0),
                });
              }
            }
          }

          send("step_complete", { step: 5, name: "Diagnostic Scoring", pairsScored: diagnostics.length });

          // =============== COMPLETE ===============
          send("complete", {
            success: true,
            summary: {
              totalChunks: chunks.length,
              totalQueries: queries.length,
              documentChamfer,
              documentChamferPercent: (documentChamfer * 100).toFixed(1),
              coverage: coverageSummary,
              avgPassageScore: (chunkScores.reduce((sum, c) => sum + c.bestScore, 0) / chunks.length).toFixed(1),
            },
            chunkScores,
            coverageMap,
            diagnostics,
          });

          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Analysis failed";
          send("error", { message: errorMessage });
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Request failed";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
