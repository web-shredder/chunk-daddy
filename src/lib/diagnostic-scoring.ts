// ============================================================
// DIAGNOSTIC SCORING SYSTEM
// Multi-stage analysis: Retrieval -> Rerank -> Citation
// Pure client-side computation on existing embedding data
// ============================================================

// ============================================================
// TYPES
// ============================================================

export interface DiagnosticScores {
  // Retrieval Stage
  semantic: number;           // Existing passage score (0-100)
  lexical: LexicalScore;      // NEW: BM25-style term matching
  hybridRetrieval: number;    // NEW: Blended score (0-100)
  
  // Rerank Stage  
  rerank: RerankScore;        // NEW: Simulated rerank factors
  
  // Citation Stage
  citation: CitationScore;    // NEW: Citation probability factors
  
  // Diagnosis (for optimization)
  diagnosis: ChunkDiagnosis;  // NEW: Why it's failing + how to fix
}

export interface LexicalScore {
  score: number;              // 0-100
  queryTerms: string[];       // Terms extracted from query (minus stopwords)
  matchedTerms: TermMatch[];  // Which terms found, where
  missingTerms: string[];     // Query terms not in chunk
  exactPhraseMatch: boolean;  // Full query appears as phrase
  titleBoost: number;         // Bonus for heading matches (0-20)
}

export interface TermMatch {
  term: string;
  count: number;
  positions: TermPosition[];
}

export interface TermPosition {
  charIndex: number;
  location: 'heading' | 'first_sentence' | 'first_100_chars' | 'body';
}

export interface RerankScore {
  score: number;                    // 0-100
  entityProminence: EntityProminenceScore;
  directAnswer: DirectAnswerScore;
  queryRestatement: QueryRestatementScore;
  structuralClarity: StructuralClarityScore;
}

export interface EntityProminenceScore {
  score: number;              // 0-100
  queryEntities: string[];    // Entities extracted from query
  foundEntities: EntityMatch[];
  missingEntities: string[];
}

export interface EntityMatch {
  entity: string;
  position: 'heading' | 'first_sentence' | 'body';
  prominence: 'high' | 'medium' | 'low';
}

export interface DirectAnswerScore {
  score: number;              // 0-100
  hasDirectAnswer: boolean;
  answerPosition: number | null;  // Char position of answer, if found
  answerType: 'explicit' | 'implicit' | 'none';
  confidence: number;
}

export interface QueryRestatementScore {
  score: number;              // 0-100
  restated: boolean;
  restatementType: 'exact' | 'paraphrase' | 'partial' | 'none';
  position: number | null;
}

export interface StructuralClarityScore {
  score: number;              // 0-100
  hasRelevantHeading: boolean;
  hasList: boolean;
  hasDefinition: boolean;
  hasNumberedSteps: boolean;
}

export interface CitationScore {
  score: number;              // 0-100
  specificity: SpecificityScore;
  quotability: QuotabilityScore;
}

export interface SpecificityScore {
  score: number;              // 0-100
  numbers: string[];          // Specific numbers found
  names: string[];            // Proper nouns found
  dates: string[];            // Dates/timeframes found
  totalSignals: number;
}

export interface QuotabilityScore {
  score: number;              // 0-100
  quotableSentences: string[];  // Self-contained, citable sentences
  vagueStatements: string[];    // Weak, uncitable sentences
}

export interface ChunkDiagnosis {
  primaryFailureMode: FailureMode;
  confidence: number;         // 0-100
  missingFacets: string[];    // What the query needs that chunk lacks
  presentStrengths: string[]; // What chunk does well (preserve these)
  recommendedFix: string;     // One-sentence guidance
  fixPriority: 'critical' | 'important' | 'minor' | 'none';
  expectedImprovement: number; // Estimated score gain (0-30)
}

export type FailureMode = 
  | 'topic_mismatch'      // Chunk is about wrong topic entirely
  | 'missing_specifics'   // Right topic but vague
  | 'buried_answer'       // Answer exists but not prominent
  | 'vocabulary_gap'      // Missing domain terms
  | 'no_direct_answer'    // Doesn't actually answer the query
  | 'structure_problem'   // Content is there but poorly organized
  | 'already_optimized';  // Score is good, leave alone

// ============================================================
// STOPWORDS
// ============================================================

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
  'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'between', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
  'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am',
  'it', 'its', 'itself', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours',
  'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'they',
  'them', 'their', 'theirs'
]);

// ============================================================
// LEXICAL SCORING
// ============================================================

export function calculateLexicalScore(
  chunkText: string,
  chunkWithoutCascade: string,
  query: string,
  headingPath: string[]
): LexicalScore {
  // Tokenize query into meaningful terms
  const queryTerms = tokenizeQuery(query);
  const headingText = headingPath.join(' ').toLowerCase();
  
  // Find where each term appears
  const matchedTerms: TermMatch[] = [];
  const missingTerms: string[] = [];
  
  for (const term of queryTerms) {
    const termLower = term.toLowerCase();
    const positions = findTermPositions(chunkText, chunkWithoutCascade, termLower, headingPath);
    
    if (positions.length > 0) {
      matchedTerms.push({
        term,
        count: positions.length,
        positions
      });
    } else {
      missingTerms.push(term);
    }
  }
  
  // Check for exact phrase match
  const chunkLower = chunkText.toLowerCase();
  const queryPhraseLower = query.toLowerCase().replace(/[?.,!]/g, '').trim();
  const exactPhraseMatch = chunkLower.includes(queryPhraseLower);
  
  // Calculate title/heading boost
  let titleBoost = 0;
  for (const term of queryTerms) {
    if (headingText.includes(term.toLowerCase())) {
      titleBoost += 5; // 5 points per term in heading, max 20
    }
  }
  titleBoost = Math.min(titleBoost, 20);
  
  // Calculate base score
  const termCoverage = queryTerms.length > 0 
    ? (matchedTerms.length / queryTerms.length) * 60  // Up to 60 points for term coverage
    : 0;
  
  // Position bonus: terms in first 100 chars get extra weight
  let positionBonus = 0;
  for (const match of matchedTerms) {
    if (match.positions.some(p => p.location === 'first_sentence' || p.location === 'first_100_chars')) {
      positionBonus += 5;
    }
  }
  positionBonus = Math.min(positionBonus, 15);
  
  // Phrase match bonus
  const phraseBonus = exactPhraseMatch ? 10 : 0;
  
  const score = Math.min(100, Math.round(
    termCoverage + titleBoost + positionBonus + phraseBonus
  ));
  
  return {
    score,
    queryTerms,
    matchedTerms,
    missingTerms,
    exactPhraseMatch,
    titleBoost
  };
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[?.,!'"]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOPWORDS.has(word));
}

function findTermPositions(
  fullText: string,
  bodyText: string,
  term: string,
  headingPath: string[]
): TermPosition[] {
  const positions: TermPosition[] = [];
  const bodyTextLower = bodyText.toLowerCase();
  const headingText = headingPath.join(' ').toLowerCase();
  
  // Check heading
  if (headingText.includes(term)) {
    positions.push({ charIndex: 0, location: 'heading' });
  }
  
  // Find all occurrences in body
  let index = 0;
  while ((index = bodyTextLower.indexOf(term, index)) !== -1) {
    let location: TermPosition['location'] = 'body';
    
    // Check if in first sentence (rough: first period or first 150 chars)
    const firstPeriod = bodyTextLower.indexOf('.');
    const firstSentenceEnd = firstPeriod > 0 ? firstPeriod : 150;
    
    if (index < firstSentenceEnd) {
      location = 'first_sentence';
    } else if (index < 100) {
      location = 'first_100_chars';
    }
    
    positions.push({ charIndex: index, location });
    index += term.length;
  }
  
  return positions;
}

// ============================================================
// RERANK SCORING
// ============================================================

export function calculateRerankScore(
  chunkText: string,
  chunkWithoutCascade: string,
  query: string,
  headingPath: string[]
): RerankScore {
  const entityProminence = calculateEntityProminence(chunkText, chunkWithoutCascade, query, headingPath);
  const directAnswer = calculateDirectAnswer(chunkWithoutCascade, query);
  const queryRestatement = calculateQueryRestatement(chunkWithoutCascade, query);
  const structuralClarity = calculateStructuralClarity(chunkText, headingPath, query);
  
  // Weighted combination: Entity 35%, DirectAnswer 30%, Restatement 15%, Structure 20%
  const score = Math.round(
    (entityProminence.score * 0.35) +
    (directAnswer.score * 0.30) +
    (queryRestatement.score * 0.15) +
    (structuralClarity.score * 0.20)
  );
  
  return {
    score,
    entityProminence,
    directAnswer,
    queryRestatement,
    structuralClarity
  };
}

function calculateEntityProminence(
  chunkText: string,
  chunkWithoutCascade: string,
  query: string,
  headingPath: string[]
): EntityProminenceScore {
  const queryEntities = extractEntities(query);
  const foundEntities: EntityMatch[] = [];
  const missingEntities: string[] = [];
  
  const headingText = headingPath.join(' ');
  const firstSentence = chunkWithoutCascade.split(/[.!?]/)[0] || '';
  
  for (const entity of queryEntities) {
    const entityLower = entity.toLowerCase();
    
    if (headingText.toLowerCase().includes(entityLower)) {
      foundEntities.push({ entity, position: 'heading', prominence: 'high' });
    } else if (firstSentence.toLowerCase().includes(entityLower)) {
      foundEntities.push({ entity, position: 'first_sentence', prominence: 'high' });
    } else if (chunkWithoutCascade.toLowerCase().includes(entityLower)) {
      foundEntities.push({ entity, position: 'body', prominence: 'medium' });
    } else {
      missingEntities.push(entity);
    }
  }
  
  // Score based on coverage and prominence
  if (queryEntities.length === 0) {
    return { score: 70, queryEntities, foundEntities, missingEntities }; // No entities to match
  }
  
  let score = 0;
  for (const found of foundEntities) {
    if (found.prominence === 'high') score += 100 / queryEntities.length;
    else if (found.prominence === 'medium') score += 60 / queryEntities.length;
  }
  
  return {
    score: Math.round(Math.min(100, score)),
    queryEntities,
    foundEntities,
    missingEntities
  };
}

function extractEntities(text: string): string[] {
  const entities: string[] = [];
  
  // Capitalized phrases (proper nouns) - but not at sentence start
  const properNouns = text.match(/(?<!^)(?<![.!?]\s)[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
  entities.push(...properNouns);
  
  // Acronyms
  const acronyms = text.match(/\b[A-Z]{2,}\b/g) || [];
  entities.push(...acronyms);
  
  // Numbers with context
  const numbersWithContext = text.match(/\d+[-–]?\d*\s*(?:days?|weeks?|months?|years?|hours?|\$|dollars?|%|percent|k|K|million|billion)/gi) || [];
  entities.push(...numbersWithContext);
  
  return [...new Set(entities)];
}

function calculateDirectAnswer(chunkText: string, query: string): DirectAnswerScore {
  const chunkLower = chunkText.toLowerCase();
  
  // Detect question type
  const isHowLong = /how\s+long|duration|time|take/i.test(query);
  const isHowMuch = /how\s+much|cost|price|fee/i.test(query);
  const isWhat = /what\s+is|what\s+are|define|meaning/i.test(query);
  const isWhy = /why|reason|because/i.test(query);
  const isHow = /how\s+to|how\s+do|steps|process/i.test(query);
  
  let hasDirectAnswer = false;
  let answerType: 'explicit' | 'implicit' | 'none' = 'none';
  let confidence = 0;
  let answerPosition: number | null = null;
  
  // Check for direct answer patterns based on question type
  if (isHowLong) {
    // Look for timeframes
    const timeMatch = chunkLower.match(/(\d+[-–]?\d*\s*(?:days?|weeks?|months?|years?|hours?))/i);
    if (timeMatch) {
      hasDirectAnswer = true;
      answerType = 'explicit';
      confidence = 85;
      answerPosition = chunkLower.indexOf(timeMatch[0]);
    }
  }
  
  if (isHowMuch) {
    // Look for prices/costs
    const priceMatch = chunkLower.match(/(\$\d+[\d,]*|\d+[\d,]*\s*(?:dollars?|percent|%))/i);
    if (priceMatch) {
      hasDirectAnswer = true;
      answerType = 'explicit';
      confidence = 85;
      answerPosition = chunkLower.indexOf(priceMatch[0]);
    }
  }
  
  if (isWhat) {
    // Look for definitions
    const defMatch = chunkLower.match(/(is\s+defined\s+as|refers\s+to|is\s+a|means)/i);
    if (defMatch) {
      hasDirectAnswer = true;
      answerType = 'explicit';
      confidence = 80;
      answerPosition = chunkLower.indexOf(defMatch[0]);
    }
  }
  
  if (isHow && !isHowLong && !isHowMuch) {
    // Look for process indicators
    const processMatch = chunkLower.match(/(step\s*\d|first,|second,|then,|finally,|start\s+by|begin\s+with)/i);
    if (processMatch) {
      hasDirectAnswer = true;
      answerType = 'explicit';
      confidence = 75;
      answerPosition = chunkLower.indexOf(processMatch[0]);
    }
  }
  
  // Fallback: check for explicit answer language
  if (!hasDirectAnswer) {
    const explicitMatch = chunkLower.match(/(typically|usually|generally|the answer is|this takes|it costs|you should)/i);
    if (explicitMatch) {
      hasDirectAnswer = true;
      answerType = 'implicit';
      confidence = 60;
      answerPosition = chunkLower.indexOf(explicitMatch[0]);
    }
  }
  
  // Score based on presence and position
  let score = 0;
  if (hasDirectAnswer) {
    score = confidence;
    // Bonus if answer is early in chunk
    if (answerPosition !== null && answerPosition < 150) {
      score = Math.min(100, score + 15);
    }
  }
  
  return { score, hasDirectAnswer, answerPosition, answerType, confidence };
}

function calculateQueryRestatement(chunkText: string, query: string): QueryRestatementScore {
  const chunkLower = chunkText.toLowerCase();
  const queryLower = query.toLowerCase().replace(/[?.,!]/g, '').trim();
  
  // Check for exact restatement
  if (chunkLower.includes(queryLower)) {
    const position = chunkLower.indexOf(queryLower);
    return {
      score: position < 100 ? 100 : 80,
      restated: true,
      restatementType: 'exact',
      position
    };
  }
  
  // Check for partial restatement (most query words present in sequence)
  const queryWords = queryLower.split(/\s+/).filter(w => !STOPWORDS.has(w));
  const foundInOrder = queryWords.filter((word, i) => {
    const pos = chunkLower.indexOf(word);
    if (pos === -1) return false;
    if (i === 0) return true;
    const prevWord = queryWords[i - 1];
    const prevPos = chunkLower.indexOf(prevWord);
    return pos > prevPos;
  });
  
  if (foundInOrder.length >= queryWords.length * 0.7) {
    return {
      score: 60,
      restated: true,
      restatementType: 'paraphrase',
      position: chunkLower.indexOf(foundInOrder[0])
    };
  }
  
  if (foundInOrder.length >= queryWords.length * 0.4) {
    return {
      score: 30,
      restated: true,
      restatementType: 'partial',
      position: null
    };
  }
  
  return {
    score: 0,
    restated: false,
    restatementType: 'none',
    position: null
  };
}

function calculateStructuralClarity(
  chunkText: string,
  headingPath: string[],
  query: string
): StructuralClarityScore {
  const queryTerms = tokenizeQuery(query);
  
  // Check if heading is relevant to query
  const headingText = headingPath.join(' ').toLowerCase();
  const hasRelevantHeading = queryTerms.some(term => 
    headingText.includes(term.toLowerCase())
  );
  
  // Check for structural elements
  const hasList = /^[\s]*[-*•]\s/m.test(chunkText) || /^\s*\d+[.)]\s/m.test(chunkText);
  const hasNumberedSteps = /step\s*\d|^\s*\d+[.)]/im.test(chunkText);
  const hasDefinition = /\b(is defined as|refers to|is a type of|means)\b/i.test(chunkText);
  
  let score = 40; // Base score
  if (hasRelevantHeading) score += 25;
  if (hasList) score += 15;
  if (hasNumberedSteps) score += 10;
  if (hasDefinition) score += 10;
  
  return {
    score: Math.min(100, score),
    hasRelevantHeading,
    hasList,
    hasDefinition,
    hasNumberedSteps
  };
}

// ============================================================
// CITATION SCORING
// ============================================================

export function calculateCitationScore(
  chunkText: string,
  chunkWithoutCascade: string
): CitationScore {
  const specificity = calculateSpecificity(chunkWithoutCascade);
  const quotability = calculateQuotability(chunkWithoutCascade);
  
  // Weighted: Specificity 60%, Quotability 40%
  const score = Math.round(
    (specificity.score * 0.60) +
    (quotability.score * 0.40)
  );
  
  return { score, specificity, quotability };
}

function calculateSpecificity(text: string): SpecificityScore {
  // Find specific numbers
  const numbers = text.match(/\d+(?:\.\d+)?%|\$\d+[\d,]*|\d+[-–]\d+|\d+\s*(?:percent|million|billion|thousand|days?|weeks?|months?|years?|hours?)/gi) || [];
  
  // Find proper nouns (names)
  const names = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) || [];
  
  // Find dates
  const dates = text.match(/\b(19|20)\d{2}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+/gi) || [];
  
  const totalSignals = numbers.length + names.length + dates.length;
  
  // Score: more signals = higher score, with diminishing returns
  const score = Math.min(100, totalSignals * 15);
  
  return {
    score,
    numbers: [...new Set(numbers)],
    names: [...new Set(names)],
    dates: [...new Set(dates)],
    totalSignals
  };
}

function calculateQuotability(text: string): QuotabilityScore {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const quotableSentences: string[] = [];
  const vagueStatements: string[] = [];
  
  const vaguePatterns = [
    /\b(many|some|most|few|various|several)\s+(people|companies|organizations|experts)/i,
    /\b(often|sometimes|frequently|occasionally)\b/i,
    /\b(can\s+help|may\s+improve|might\s+be)/i,
    /\b(it is (important|essential|crucial|key))/i,
    /\b(there are (many|some|various) (benefits|advantages|reasons))/i,
  ];
  
  const specificPatterns = [
    /\d+(?:\.\d+)?%|\$\d+/,  // Has numbers
    /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/,  // Has proper nouns
    /\b(is|are|was|were)\s+\w+ed\b/,  // Passive declarative
    /\b(takes?|costs?|requires?|includes?)\s+/i,  // Action verbs
  ];
  
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length < 20) continue;
    
    const isVague = vaguePatterns.some(p => p.test(trimmed));
    const isSpecific = specificPatterns.some(p => p.test(trimmed));
    
    if (isVague && !isSpecific) {
      vagueStatements.push(trimmed);
    } else if (isSpecific) {
      quotableSentences.push(trimmed);
    }
  }
  
  // Score based on ratio of quotable to total meaningful sentences
  const meaningfulSentences = sentences.filter(s => s.trim().length > 20).length;
  const quotableRatio = meaningfulSentences > 0 
    ? quotableSentences.length / meaningfulSentences 
    : 0;
  const vagueRatio = meaningfulSentences > 0
    ? vagueStatements.length / meaningfulSentences
    : 0;
  
  const score = Math.round(Math.max(0, Math.min(100, 
    (quotableRatio * 80) + 20 - (vagueRatio * 30)
  )));
  
  return { score, quotableSentences, vagueStatements };
}

// ============================================================
// DIAGNOSIS
// ============================================================

export function generateDiagnosis(
  semanticScore: number,
  lexical: LexicalScore,
  rerank: RerankScore,
  citation: CitationScore,
  query: string
): ChunkDiagnosis {
  // Determine primary failure mode
  let primaryFailureMode: FailureMode;
  let confidence: number;
  let recommendedFix: string;
  let fixPriority: ChunkDiagnosis['fixPriority'];
  let expectedImprovement: number;
  
  const hybridRetrieval = Math.round((semanticScore * 0.7) + (lexical.score * 0.3));
  
  // Already good - don't touch
  if (hybridRetrieval >= 75 && rerank.score >= 70) {
    return {
      primaryFailureMode: 'already_optimized',
      confidence: 90,
      missingFacets: [],
      presentStrengths: ['Good semantic match', 'Strong rerank signals'],
      recommendedFix: 'Content is well-optimized. Minor polish only if needed.',
      fixPriority: 'none',
      expectedImprovement: 0
    };
  }
  
  // Topic mismatch - semantic is low AND lexical is low
  if (semanticScore < 50 && lexical.score < 40) {
    primaryFailureMode = 'topic_mismatch';
    confidence = 85;
    recommendedFix = `Content discusses different topic. Either reassign to better chunk or add content about: ${lexical.missingTerms.slice(0, 3).join(', ')}.`;
    fixPriority = 'critical';
    expectedImprovement = 5; // Can't fix topic mismatch with optimization alone
  }
  // Vocabulary gap - semantic is okay but lexical is low
  else if (semanticScore >= 50 && lexical.score < 40) {
    primaryFailureMode = 'vocabulary_gap';
    confidence = 80;
    recommendedFix = `Add missing query terms naturally: ${lexical.missingTerms.slice(0, 4).join(', ')}.`;
    fixPriority = 'important';
    expectedImprovement = 15;
  }
  // Buried answer - has content but rerank is low due to position
  else if (hybridRetrieval >= 60 && rerank.directAnswer.hasDirectAnswer && rerank.directAnswer.answerPosition && rerank.directAnswer.answerPosition > 150) {
    primaryFailureMode = 'buried_answer';
    confidence = 85;
    recommendedFix = 'Move the direct answer to the first sentence. Front-load the key information.';
    fixPriority = 'important';
    expectedImprovement = 20;
  }
  // No direct answer
  else if (!rerank.directAnswer.hasDirectAnswer) {
    primaryFailureMode = 'no_direct_answer';
    confidence = 75;
    recommendedFix = `Add explicit answer to the query. Include specific ${detectQueryType(query)}.`;
    fixPriority = 'critical';
    expectedImprovement = 25;
  }
  // Missing specifics - citation score is low
  else if (citation.specificity.score < 40) {
    primaryFailureMode = 'missing_specifics';
    confidence = 70;
    recommendedFix = 'Add specific data: numbers, timeframes, names, examples.';
    fixPriority = 'important';
    expectedImprovement = 15;
  }
  // Structure problem
  else if (rerank.structuralClarity.score < 50) {
    primaryFailureMode = 'structure_problem';
    confidence = 65;
    recommendedFix = 'Improve structure: add relevant heading, use list format, or add definition.';
    fixPriority = 'minor';
    expectedImprovement = 10;
  }
  // Fallback
  else {
    primaryFailureMode = 'missing_specifics';
    confidence = 50;
    recommendedFix = 'Strengthen content with more specific claims and evidence.';
    fixPriority = 'minor';
    expectedImprovement = 10;
  }
  
  // Determine missing facets from query
  const queryFacets = decomposeQueryFacets(query);
  const missingFacets = queryFacets.filter(facet => 
    !lexical.matchedTerms.some(m => m.term.toLowerCase().includes(facet.toLowerCase()))
  );
  
  // Determine present strengths
  const presentStrengths: string[] = [];
  if (semanticScore >= 60) presentStrengths.push('Good semantic relevance');
  if (lexical.exactPhraseMatch) presentStrengths.push('Contains query phrase');
  if (lexical.titleBoost > 10) presentStrengths.push('Query terms in heading');
  if (rerank.directAnswer.hasDirectAnswer) presentStrengths.push('Has direct answer');
  if (citation.specificity.totalSignals >= 3) presentStrengths.push('Contains specific data');
  if (citation.quotability.quotableSentences.length >= 2) presentStrengths.push('Has quotable sentences');
  
  return {
    primaryFailureMode,
    confidence,
    missingFacets,
    presentStrengths,
    recommendedFix,
    fixPriority,
    expectedImprovement
  };
}

function detectQueryType(query: string): string {
  if (/how\s+long|duration|time|take/i.test(query)) return 'timeframes (days, weeks, phases)';
  if (/how\s+much|cost|price|fee/i.test(query)) return 'pricing data ($X, ranges)';
  if (/what\s+is|what\s+are|define/i.test(query)) return 'clear definition';
  if (/why|reason/i.test(query)) return 'explicit reasons/causes';
  if (/how\s+to|steps|process/i.test(query)) return 'step-by-step process';
  if (/best|top|recommend/i.test(query)) return 'specific recommendations with criteria';
  if (/vs|versus|compare|difference/i.test(query)) return 'explicit comparison points';
  return 'concrete facts and examples';
}

function decomposeQueryFacets(query: string): string[] {
  const facets: string[] = [];
  
  // Extract key nouns/concepts (simple heuristic)
  const words = tokenizeQuery(query);
  facets.push(...words);
  
  // Add implied facets based on question type
  if (/how\s+long/i.test(query)) {
    facets.push('duration', 'timeline', 'phases');
  }
  if (/how\s+much|cost/i.test(query)) {
    facets.push('price', 'cost', 'budget', 'fees');
  }
  if (/why/i.test(query)) {
    facets.push('reasons', 'benefits', 'causes');
  }
  if (/how\s+to/i.test(query)) {
    facets.push('steps', 'process', 'method');
  }
  
  return [...new Set(facets)];
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================

export function calculateAllDiagnostics(
  chunkText: string,
  chunkWithoutCascade: string,
  headingPath: string[],
  query: string,
  semanticScore: number  // The existing passage score
): DiagnosticScores {
  const lexical = calculateLexicalScore(chunkText, chunkWithoutCascade, query, headingPath);
  const hybridRetrieval = Math.round((semanticScore * 0.7) + (lexical.score * 0.3));
  const rerank = calculateRerankScore(chunkText, chunkWithoutCascade, query, headingPath);
  const citation = calculateCitationScore(chunkText, chunkWithoutCascade);
  const diagnosis = generateDiagnosis(semanticScore, lexical, rerank, citation, query);
  
  return {
    semantic: semanticScore,
    lexical,
    hybridRetrieval,
    rerank,
    citation,
    diagnosis
  };
}
