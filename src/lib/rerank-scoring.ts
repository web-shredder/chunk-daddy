/**
 * Rerank Scoring Module
 * 
 * Simulates cross-encoder reranking behavior in the RAG pipeline.
 * This is DIFFERENT from retrieval scoring (semantic + lexical).
 * Rerank evaluates how well a chunk ANSWERS the query after retrieval.
 */

export interface RerankScoreResult {
  score: number;
  entityProminence: EntityScore;
  directAnswerScore: number;
  structuralClarity: StructuralScore;
  queryRestatement: RestatementScore;
}

export interface EntityScore {
  score: number;
  queryEntities: string[];
  foundEntities: EntityMatch[];
  missingEntities: string[];
}

export interface EntityMatch {
  entity: string;
  position: 'heading' | 'first_sentence' | 'body';
  prominence: 'high' | 'medium' | 'low';
}

export interface StructuralScore {
  score: number;
  hasRelevantHeading: boolean;
  hasListOrSteps: boolean;
  hasDefinition: boolean;
  hasExplicitAnswer: boolean;
}

export interface RestatementScore {
  score: number;
  queryRestated: boolean;
  restatementPosition: number | null;
  restatementType: 'exact' | 'paraphrase' | 'partial' | 'none';
}

// Common stopwords to filter out when comparing text
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'then', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this',
  'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'i',
  'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his',
  'her', 'its', 'our', 'their', 'me', 'him', 'us', 'them'
]);

// Common domain acronyms in business/tech contexts
const DOMAIN_ACRONYMS = new Set([
  'RPO', 'ATS', 'SaaS', 'API', 'ROI', 'KPI', 'B2B', 'B2C', 'GDPR',
  'CRM', 'ERP', 'HR', 'HCM', 'AI', 'ML', 'NLP', 'LLM', 'RAG',
  'SEO', 'PPC', 'CTR', 'CPM', 'CPC', 'CAC', 'LTV', 'MRR', 'ARR',
  'SLA', 'SOC', 'ISO', 'PCI', 'HIPAA', 'CCPA', 'SDK', 'REST',
  'JSON', 'SQL', 'NoSQL', 'ETL', 'BI', 'KYC', 'AML', 'PII',
  'SSO', 'MFA', 'RBAC', 'VPN', 'CDN', 'DNS', 'SSL', 'TLS',
  'MVP', 'POC', 'UAT', 'QA', 'CI', 'CD', 'DevOps', 'SRE'
]);

/**
 * Extract entities from a query that should be found in relevant chunks.
 * Entities include: proper nouns, numbers with units, quoted phrases, acronyms.
 */
export function extractQueryEntities(query: string): string[] {
  const entities: Set<string> = new Set();
  
  // Extract capitalized phrases (proper nouns) - 2+ words starting with capitals
  const properNounPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  let match;
  while ((match = properNounPattern.exec(query)) !== null) {
    entities.add(match[1].toLowerCase());
  }
  
  // Extract single capitalized words that aren't at sentence start
  const singleCapPattern = /(?:^|\.\s+)?([A-Z][a-z]{2,})\b/g;
  const queryLower = query.toLowerCase();
  while ((match = singleCapPattern.exec(query)) !== null) {
    // Only add if it's not at the very start of the query
    if (match.index > 0 || query[0] !== match[1][0]) {
      entities.add(match[1].toLowerCase());
    }
  }
  
  // Extract numbers with units
  const numberUnitPattern = /\b(\d+[-–]?\d*\s*(?:days?|weeks?|months?|years?|hours?|minutes?|\$|dollars?|%|percent|k|K|M|million|billion))\b/gi;
  while ((match = numberUnitPattern.exec(query)) !== null) {
    entities.add(match[1].toLowerCase().replace(/\s+/g, ' '));
  }
  
  // Extract quoted phrases
  const quotedPattern = /["']([^"']+)["']/g;
  while ((match = quotedPattern.exec(query)) !== null) {
    entities.add(match[1].toLowerCase());
  }
  
  // Extract domain acronyms
  const words = query.split(/\s+/);
  for (const word of words) {
    const cleanWord = word.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (DOMAIN_ACRONYMS.has(cleanWord)) {
      entities.add(cleanWord.toLowerCase());
    }
  }
  
  // Also check for all-caps words that might be acronyms (3+ letters)
  const acronymPattern = /\b([A-Z]{2,})\b/g;
  while ((match = acronymPattern.exec(query)) !== null) {
    if (match[1].length >= 2) {
      entities.add(match[1].toLowerCase());
    }
  }
  
  return Array.from(entities);
}

/**
 * Calculate how prominently query entities appear in the chunk.
 * Higher prominence = better chance of being selected by reranker.
 */
export function calculateEntityProminence(
  chunkText: string,
  headingPath: string[],
  queryEntities: string[]
): EntityScore {
  const foundEntities: EntityMatch[] = [];
  const missingEntities: string[] = [];
  
  const chunkLower = chunkText.toLowerCase();
  const headingText = headingPath.join(' ').toLowerCase();
  
  // Get first sentence (approx first 150 chars or until period)
  const firstSentenceEnd = Math.min(
    chunkText.indexOf('.') > 0 ? chunkText.indexOf('.') : 150,
    150
  );
  const firstSentence = chunkText.slice(0, firstSentenceEnd).toLowerCase();
  
  let rawScore = 0;
  
  for (const entity of queryEntities) {
    const entityLower = entity.toLowerCase();
    
    // Check heading first (highest prominence)
    if (headingText.includes(entityLower)) {
      foundEntities.push({
        entity,
        position: 'heading',
        prominence: 'high'
      });
      rawScore += 30;
    }
    // Check first sentence (medium prominence)
    else if (firstSentence.includes(entityLower)) {
      foundEntities.push({
        entity,
        position: 'first_sentence',
        prominence: 'medium'
      });
      rawScore += 20;
    }
    // Check body (low prominence)
    else if (chunkLower.includes(entityLower)) {
      foundEntities.push({
        entity,
        position: 'body',
        prominence: 'low'
      });
      rawScore += 10;
    }
    // Missing entity - penalty
    else {
      missingEntities.push(entity);
      rawScore -= 15;
    }
  }
  
  // Normalize to 0-100
  // If no entities, return 50 (neutral)
  if (queryEntities.length === 0) {
    return {
      score: 50,
      queryEntities,
      foundEntities,
      missingEntities
    };
  }
  
  // Max possible score: 30 * numEntities (all in headings)
  // Min possible score: -15 * numEntities (all missing)
  const maxScore = queryEntities.length * 30;
  const minScore = queryEntities.length * -15;
  const range = maxScore - minScore;
  
  const normalizedScore = Math.max(0, Math.min(100, 
    ((rawScore - minScore) / range) * 100
  ));
  
  return {
    score: Math.round(normalizedScore),
    queryEntities,
    foundEntities,
    missingEntities
  };
}

/**
 * Detect if the chunk contains a direct answer to the query.
 * Looks for definition patterns, explicit answers, and concrete values.
 */
export function detectDirectAnswer(chunkText: string, query: string): number {
  let score = 0;
  const textLower = chunkText.toLowerCase();
  
  // Definition patterns - chunk defines something
  const definitionPattern = /\b(?:is|are|refers?\s+to|means?|defined?\s+as|represents?|consists?\s+of)\b/i;
  if (definitionPattern.test(chunkText)) {
    score += 30;
  }
  
  // Explicit answer patterns - chunk directly answers
  const explicitAnswerPattern = /\b(?:the\s+answer|this\s+(?:takes?|costs?|requires?|includes?|provides?)|typically\s+(?:takes?|costs?|is|ranges?)|usually\s+(?:takes?|costs?|is)|generally\s+(?:takes?|costs?|is))\b/i;
  if (explicitAnswerPattern.test(chunkText)) {
    score += 40;
  }
  
  // Number + unit pattern - concrete quantitative answer
  const numberUnitPattern = /\b\d+[-–]?\d*\s*(?:days?|weeks?|months?|hours?|minutes?|dollars?|\$|%|percent|times?|steps?|phases?|stages?)\b/i;
  if (numberUnitPattern.test(chunkText)) {
    score += 30;
  }
  
  // Query-specific answer detection
  // If query asks "how long" and chunk has time references
  if (/how\s+long/i.test(query) && /\b\d+\s*(?:days?|weeks?|months?|hours?|years?)\b/i.test(chunkText)) {
    score += 20;
  }
  
  // If query asks "how much" or "cost" and chunk has money/percentage
  if (/(?:how\s+much|cost|price|fee)/i.test(query) && /\b(?:\$\s*\d+|\d+\s*(?:dollars?|%|percent))\b/i.test(chunkText)) {
    score += 20;
  }
  
  // If query asks "what is" and chunk has a clear definition structure
  if (/what\s+(?:is|are)/i.test(query) && /^[A-Z][^.]+\s+(?:is|are)\s+/m.test(chunkText)) {
    score += 20;
  }
  
  return Math.min(100, score);
}

/**
 * Calculate structural clarity - how well the chunk is organized to answer the query.
 */
export function calculateStructuralClarity(
  chunkText: string,
  headingPath: string[],
  query: string
): StructuralScore {
  let score = 0;
  
  // Extract meaningful query terms (non-stopwords)
  const queryTerms = query.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
    .map(w => w.replace(/[^a-z]/g, ''));
  
  // Check if any heading contains query terms
  const headingText = headingPath.join(' ').toLowerCase();
  const hasRelevantHeading = queryTerms.some(term => 
    term.length > 2 && headingText.includes(term)
  );
  if (hasRelevantHeading) {
    score += 25;
  }
  
  // Check for list or step patterns
  const listPatterns = [
    /^\s*[-•*]\s+/m,                    // Bullet points
    /^\s*\d+[.)]\s+/m,                  // Numbered lists
    /\b(?:step\s+\d+|first|second|third|finally)\b/i,  // Step language
    /^\s*(?:[-•*]|\d+[.)])\s+.+\n\s*(?:[-•*]|\d+[.)])\s+/m  // Multiple list items
  ];
  const hasListOrSteps = listPatterns.some(p => p.test(chunkText));
  if (hasListOrSteps) {
    score += 25;
  }
  
  // Check for definition patterns
  const definitionPatterns = [
    /\b\w+\s+(?:is|are)\s+(?:a|an|the)\s+\w+/i,  // "X is a Y"
    /\b\w+\s+means\s+/i,                          // "X means"
    /\b\w+\s+refers?\s+to\s+/i,                   // "X refers to"
    /\bdefined?\s+as\s+/i                         // "defined as"
  ];
  const hasDefinition = definitionPatterns.some(p => p.test(chunkText));
  if (hasDefinition) {
    score += 25;
  }
  
  // Check for explicit answer with specifics
  const explicitAnswerPatterns = [
    /\b(?:the|this)\s+(?:answer|solution|result|outcome)\s+is\b/i,
    /\b(?:you\s+(?:can|should|need\s+to|must))\b/i,
    /\b(?:typically|usually|generally)\s+(?:takes?|costs?|requires?)\s+\d+/i,
    /\b(?:includes?|provides?|offers?|contains?)\s*:/i
  ];
  const hasExplicitAnswer = explicitAnswerPatterns.some(p => p.test(chunkText));
  if (hasExplicitAnswer) {
    score += 25;
  }
  
  return {
    score: Math.min(100, score),
    hasRelevantHeading,
    hasListOrSteps,
    hasDefinition,
    hasExplicitAnswer
  };
}

/**
 * Detect if the query is restated in the chunk (indicates relevance).
 * Cross-encoders favor chunks that echo the query.
 */
export function detectQueryRestatement(
  chunkText: string,
  query: string
): RestatementScore {
  // Get first 2 sentences (or first 300 chars)
  const sentences = chunkText.split(/[.!?]+/).slice(0, 2);
  const firstTwoSentences = sentences.join('. ').slice(0, 300).toLowerCase();
  
  const queryLower = query.toLowerCase().trim();
  const queryClean = queryLower.replace(/[?!.,]/g, '').trim();
  
  // Check for exact match
  if (firstTwoSentences.includes(queryClean)) {
    const position = firstTwoSentences.indexOf(queryClean);
    return {
      score: 100,
      queryRestated: true,
      restatementPosition: position,
      restatementType: 'exact'
    };
  }
  
  // Extract non-stopwords from query and chunk start
  const queryWords = queryClean
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
  
  const chunkWords = firstTwoSentences
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
  
  if (queryWords.length === 0) {
    return {
      score: 0,
      queryRestated: false,
      restatementPosition: null,
      restatementType: 'none'
    };
  }
  
  // Calculate word overlap
  const chunkWordSet = new Set(chunkWords);
  const matchedWords = queryWords.filter(w => chunkWordSet.has(w));
  const overlapRatio = matchedWords.length / queryWords.length;
  
  // Find approximate position of first matched word
  let position: number | null = null;
  if (matchedWords.length > 0) {
    position = firstTwoSentences.indexOf(matchedWords[0]);
  }
  
  if (overlapRatio >= 0.6) {
    return {
      score: 75,
      queryRestated: true,
      restatementPosition: position,
      restatementType: 'paraphrase'
    };
  }
  
  if (overlapRatio >= 0.3) {
    return {
      score: 40,
      queryRestated: true,
      restatementPosition: position,
      restatementType: 'partial'
    };
  }
  
  return {
    score: 0,
    queryRestated: false,
    restatementPosition: null,
    restatementType: 'none'
  };
}

/**
 * Calculate the full rerank score for a chunk.
 * This simulates how a cross-encoder would reorder retrieved chunks.
 * 
 * Weights:
 * - Entity Prominence: 35% (are the right entities mentioned prominently?)
 * - Direct Answer: 30% (does the chunk directly answer the query?)
 * - Structural Clarity: 20% (is the chunk well-organized for the query?)
 * - Query Restatement: 15% (does the chunk echo/restate the query?)
 */
export function calculateRerankScore(
  chunkText: string,
  chunkWithoutCascade: string,
  queryText: string,
  headingPath: string[]
): RerankScoreResult {
  // Use the clean text (without cascade) for most analysis
  const textToAnalyze = chunkWithoutCascade || chunkText;
  
  // Extract entities from the query
  const queryEntities = extractQueryEntities(queryText);
  
  // Calculate all component scores
  const entityProminence = calculateEntityProminence(
    textToAnalyze,
    headingPath,
    queryEntities
  );
  
  const directAnswerScore = detectDirectAnswer(textToAnalyze, queryText);
  
  const structuralClarity = calculateStructuralClarity(
    textToAnalyze,
    headingPath,
    queryText
  );
  
  const queryRestatement = detectQueryRestatement(textToAnalyze, queryText);
  
  // Combine with weights
  const score = Math.round(
    (entityProminence.score * 0.35) +
    (directAnswerScore * 0.30) +
    (structuralClarity.score * 0.20) +
    (queryRestatement.score * 0.15)
  );
  
  return {
    score: Math.max(0, Math.min(100, score)),
    entityProminence,
    directAnswerScore,
    structuralClarity,
    queryRestatement
  };
}
