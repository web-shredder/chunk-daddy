export interface ScoreSubComponent {
  weight: number;
  formula: string;
  example: string;
}

export interface ScoreDefinition {
  name: string;
  shortDescription: string;
  fullDescription: string;
  calculation: string;
  subComponents?: Record<string, ScoreSubComponent>;
  range: string;
  goodThreshold: number;
  example: {
    query: string;
    content: string;
    score: number;
    breakdown: string;
  };
  tips: string[];
}

export const SCORE_DEFINITIONS: Record<string, ScoreDefinition> = {
  passageScore: {
    name: 'Passage Score',
    shortDescription: 'Overall likelihood of being retrieved and cited by AI search',
    fullDescription: 'A composite score predicting how likely this content is to be retrieved by RAG systems, ranked highly by rerankers, and ultimately cited in AI-generated responses. This is the primary optimization metric.',
    calculation: '(retrievalScore × 0.40) + (rerankScore × 0.35) + (citationScore × 0.25)',
    range: '0-100',
    goodThreshold: 70,
    example: {
      query: 'Why is Python slow',
      content: 'Python is slow primarily because it\'s an interpreted language with dynamic typing. The interpreter executes code line-by-line rather than compiling to machine code, adding overhead. Dynamic typing means type checking happens at runtime, not compile time.',
      score: 78.5,
      breakdown: 'Retrieval: 82 × 0.40 = 32.8\nRerank: 76 × 0.35 = 26.6\nCitation: 78 × 0.25 = 19.5\nTotal: 78.9'
    },
    tips: [
      'Aim for 70+ for strong retrieval probability',
      'Scores below 45 indicate fundamental content gaps',
      'Focus on the lowest sub-score first (retrieval, rerank, or citation)',
      'All three components must be strong—one high score can\'t compensate for two low scores'
    ]
  },

  retrievalScore: {
    name: 'Retrieval Score',
    shortDescription: 'Hybrid score for initial retrieval from vector database',
    fullDescription: 'Combines semantic similarity (embedding-based) with lexical matching (keyword-based) to predict retrieval probability. Most production RAG systems use hybrid retrieval because semantic alone misses important keyword signals and lexical alone misses conceptual matches.',
    calculation: '(semanticScore × 0.70) + (lexicalScore × 0.30)',
    subComponents: {
      semantic: {
        weight: 0.70,
        formula: 'cosine_similarity(query_embedding, content_embedding) × 100',
        example: 'Query: "Python performance issues" → Content discusses interpreter overhead, GIL, dynamic typing → Cosine similarity: 0.84 → Score: 84'
      },
      lexical: {
        weight: 0.30,
        formula: 'BM25(query_terms, content, k1=1.5, b=0.75) normalized to 0-100',
        example: 'Query: "Python performance issues" → Content contains "Python" 3x, "performance" 2x → BM25: 3.2 → Normalized: 68'
      }
    },
    range: '0-100',
    goodThreshold: 75,
    example: {
      query: 'Python performance issues',
      content: 'Python performance suffers from several architectural choices. The Global Interpreter Lock (GIL) prevents true multi-threading. Dynamic typing adds runtime overhead.',
      score: 80.8,
      breakdown: 'Semantic: 84 × 0.70 = 58.8\nLexical: 73 × 0.30 = 21.9\nTotal: 80.7'
    },
    tips: [
      'Semantic drives overall score (70%) - ensure conceptual alignment',
      'Include exact query terms for lexical signal (30%)',
      'Front-load relevant terms in first 100 words',
      'Use query synonyms to improve semantic without keyword stuffing'
    ]
  },

  semantic: {
    name: 'Semantic Similarity',
    shortDescription: 'How closely the content meaning matches the query meaning',
    fullDescription: 'Measures the cosine similarity between the query embedding and content embedding in vector space. High semantic similarity means the content discusses the same concepts as the query, even without exact keyword matches.',
    calculation: 'cosine_similarity(query_embedding, content_embedding) × 100\n\nwhere cosine_similarity = (A · B) / (||A|| × ||B||)',
    range: '0-100',
    goodThreshold: 75,
    example: {
      query: 'Why is Python slow',
      content: 'The performance limitations stem from the interpreter architecture and dynamic typing system, which prioritize flexibility over speed.',
      score: 82,
      breakdown: 'Query embedding: [0.23, -0.45, 0.67, ...] (768 dims)\nContent embedding: [0.21, -0.42, 0.71, ...]\nCosine similarity: 0.82 → Score: 82'
    },
    tips: [
      'Address the query topic directly in first 100 words',
      'Use conceptual synonyms (e.g., "performance limitations" for "slow")',
      'Include related concepts from the query\'s semantic field',
      'Avoid tangential content that dilutes semantic focus'
    ]
  },

  lexical: {
    name: 'Lexical Score',
    shortDescription: 'Keyword and phrase overlap between query and content',
    fullDescription: 'Measures direct term overlap using BM25 scoring algorithm. Captures exact keyword matches, phrase matches, and term frequency while accounting for document length and term saturation.',
    calculation: 'BM25 = Σ IDF(qi) × (f(qi,D) × (k1+1)) / (f(qi,D) + k1 × (1-b + b×|D|/avgdl))\n\nk1=1.5, b=0.75\nNormalized to 0-100',
    range: '0-100',
    goodThreshold: 60,
    example: {
      query: 'Python performance issues',
      content: 'Python performance issues stem from the interpreter. Python executes bytecode, not machine code.',
      score: 73,
      breakdown: '"Python" 3x (high freq, high IDF)\n"performance" 2x (medium freq)\n"issues" 1x (IDF boost)\nBM25: 3.2 → Normalized: 73'
    },
    tips: [
      'Include exact query phrases naturally (not stuffed)',
      'Repeat key terms 2-3 times across the content',
      'Place query terms in first and last sentences',
      'Use multi-word query phrases verbatim where possible'
    ]
  },

  rerankScore: {
    name: 'Rerank Score',
    shortDescription: 'Cross-encoder relevance score after initial retrieval',
    fullDescription: 'Simulates how a cross-encoder reranker scores content after initial retrieval. Rerankers run deeper relevance analysis to filter "good enough" matches and promote truly relevant content.',
    calculation: '(entityProminence × 0.35) + (directAnswer × 0.30) + (structuralClarity × 0.20) + (queryRestatement × 0.15)',
    subComponents: {
      entityProminence: {
        weight: 0.35,
        formula: '(first_sentence_density × 0.50) + (first_100_words_density × 0.30) + (heading_presence × 0.20)',
        example: 'Query entities: ["Python", "slow"]\nFirst sentence: "Python is slow because..." → density: 40%\nScore: 85'
      },
      directAnswer: {
        weight: 0.30,
        formula: '(query_verb_match × 0.40) + (answer_position × 0.35) + (completeness × 0.25)',
        example: 'Query: "Why is Python slow?"\n"because" answers "why" in first 30 words\nScore: 95'
      },
      structuralClarity: {
        weight: 0.20,
        formula: '(sentence_clarity × 0.40) + (paragraph_structure × 0.35) + (heading_hierarchy × 0.25)',
        example: 'Avg 18 words/sentence, 4 sentences/paragraph, proper H2→H3\nScore: 100'
      },
      queryRestatement: {
        weight: 0.15,
        formula: 'query_present (100 if found) + position_bonus (50 if first sentence)',
        example: '"Python is slow primarily because..." restates query in first sentence\nScore: 100'
      }
    },
    range: '0-100',
    goodThreshold: 65,
    example: {
      query: 'Why is Python slow',
      content: 'Python is slow primarily because it\'s an interpreted language. The interpreter adds overhead by executing line-by-line.',
      score: 76,
      breakdown: 'Entity Prominence: 85 × 0.35 = 29.75\nDirect Answer: 95 × 0.30 = 28.5\nStructural Clarity: 90 × 0.20 = 18.0\nQuery Restatement: 100 × 0.15 = 15.0\nTotal: 91.25'
    },
    tips: [
      'Put query entities in the first sentence',
      'Directly answer the query verb (why/how/what) immediately',
      'Restate the query explicitly in first 50 words',
      'Use clear sentence structure (15-25 words per sentence)'
    ]
  },

  citationScore: {
    name: 'Citation Score',
    shortDescription: 'Likelihood of being quoted/cited in the AI response',
    fullDescription: 'Predicts whether the LLM will actually cite this content in its response. Being retrieved isn\'t enough—content must be "quotable" with clear, authoritative statements the AI can extract.',
    calculation: '(quotability × 0.40) + (specificity × 0.30) + (authoritySignals × 0.20) + (sentenceStructure × 0.10)',
    subComponents: {
      quotability: {
        weight: 0.40,
        formula: '(standalone_sentences × 0.50) + (factual_statements × 0.30) + (no_hedging × 0.20)',
        example: 'Each sentence works alone, all factual, zero hedge words\nScore: 100'
      },
      specificity: {
        weight: 0.30,
        formula: '(numbers_present × 0.40) + (examples_present × 0.35) + (precise_terms × 0.25)',
        example: 'Contains "50% reduction", concrete example, technical terms\nScore: 100'
      },
      authoritySignals: {
        weight: 0.20,
        formula: '(citations_present × 0.40) + (technical_accuracy × 0.35) + (confident_tone × 0.25)',
        example: 'References official docs, correct details, no uncertainty\nScore: 100'
      },
      sentenceStructure: {
        weight: 0.10,
        formula: '15-25 words = 100, 10-14 or 26-30 = 75, other = 50',
        example: 'Avg 18 words per sentence with clear structure\nScore: 80'
      }
    },
    range: '0-100',
    goodThreshold: 60,
    example: {
      query: 'Why is Python slow',
      content: 'Python is slow primarily because it\'s interpreted. The interpreter adds 10-15% overhead. A simple loop runs 50x slower than C.',
      score: 78,
      breakdown: 'Quotability: 85 × 0.40 = 34.0\nSpecificity: 90 × 0.30 = 27.0\nAuthority: 70 × 0.20 = 14.0\nSentence Structure: 80 × 0.10 = 8.0\nTotal: 83.0'
    },
    tips: [
      'Include specific facts, numbers, or examples',
      'Write standalone sentences that can be quoted out of context',
      'Avoid hedge words (might, could, possibly, somewhat)',
      'Use confident, authoritative tone',
      'Keep sentences 15-25 words for optimal quotability'
    ]
  },

  entityOverlap: {
    name: 'Entity Overlap',
    shortDescription: 'Percentage of query entities found in the content',
    fullDescription: 'Measures what percentage of key entities (nouns, proper nouns, technical terms) from the query appear in the content. High entity overlap is the strongest signal for intent alignment.',
    calculation: '(matched_entities / total_query_entities) × 100\n\nEntity extraction uses NER + POS tagging + technical term detection',
    range: '0-100%',
    goodThreshold: 70,
    example: {
      query: 'Why is Python slow compared to C++',
      content: 'Python\'s performance limitations stem from being interpreted. Unlike C++, Python uses dynamic typing.',
      score: 75,
      breakdown: 'Query entities: ["Python", "slow", "C++"]\nMatched: ["Python", "C++", "performance" (≈slow)]\nScore: 3/3 = 100% (with semantic matching: 75%)'
    },
    tips: [
      'Identify key nouns and technical terms in the query',
      'Ensure each entity appears at least once',
      'Place important entities in first 100 words',
      'Use entities in headings for structural clarity'
    ]
  }
};

export type ScoreKey = keyof typeof SCORE_DEFINITIONS;
