/**
 * Rerank Score Calculation
 * Formula: (entityProminence × 0.35) + (directAnswer × 0.30) + 
 *          (structuralClarity × 0.20) + (queryRestatement × 0.15)
 */

/**
 * Calculate the composite rerank score
 */
export function calculateRerankScore(
  entityProminence: number,
  directAnswerScore: number,
  structuralClarity: number,
  queryRestatement: number
): number {
  return (
    (entityProminence * 0.35) +
    (directAnswerScore * 0.30) +
    (structuralClarity * 0.20) +
    (queryRestatement * 0.15)
  );
}

/**
 * Extract key entities from text (simplified NER)
 */
export function extractQueryEntities(query: string): string[] {
  const stopWords = new Set([
    'what', 'how', 'why', 'when', 'where', 'who', 'which',
    'is', 'are', 'the', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'at',
    'can', 'does', 'do', 'should', 'would', 'could'
  ]);
  
  return query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

/**
 * Calculate Entity Prominence
 * Formula: (firstSentenceDensity × 0.50) + (first100WordsDensity × 0.30) + (headingPresence × 0.20)
 */
export function calculateEntityProminence(
  content: string,
  queryEntities: string[],
  headings: string[] = []
): number {
  if (queryEntities.length === 0) return 70; // Default if no entities
  
  const sentences = content.split(/[.!?]+/).filter(s => s.trim());
  const firstSentence = sentences[0] || '';
  const first100Words = content.split(/\s+/).slice(0, 100).join(' ');
  
  const firstSentenceDensity = calculateEntityDensity(firstSentence, queryEntities);
  const first100Density = calculateEntityDensity(first100Words, queryEntities);
  
  // Check if entities appear in headings
  const headingPresence = headings.some(h => 
    queryEntities.some(e => h.toLowerCase().includes(e.toLowerCase()))
  ) ? 100 : 0;
  
  return (
    (firstSentenceDensity * 0.50) +
    (first100Density * 0.30) +
    (headingPresence * 0.20)
  );
}

function calculateEntityDensity(text: string, entities: string[]): number {
  if (!text.trim() || entities.length === 0) return 0;
  
  const textLower = text.toLowerCase();
  const matches = entities.filter(e => textLower.includes(e.toLowerCase())).length;
  const matchRatio = matches / entities.length;
  
  return Math.min(matchRatio * 100, 100);
}

/**
 * Calculate Direct Answer Score
 * Formula: (queryVerbMatch × 0.40) + (answerPosition × 0.35) + (completeness × 0.25)
 */
export function calculateDirectAnswerScore(query: string, content: string): number {
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // Query verb match - check if answer indicator present for query type
  const answerIndicators: Record<string, string[]> = {
    'why': ['because', 'due to', 'since', 'as a result', 'the reason'],
    'how': ['by', 'through', 'via', 'using', 'steps', 'process'],
    'what': ['is', 'are', 'refers to', 'means', 'defined as'],
    'when': ['in', 'on', 'during', 'after', 'before', 'at'],
    'where': ['in', 'at', 'located', 'found', 'within'],
    'who': ['is', 'are', 'was', 'were'],
    'which': ['the', 'include', 'are']
  };
  
  let queryVerbMatch = 50; // Default if no question word found
  const queryVerbs = ['why', 'how', 'what', 'when', 'where', 'who', 'which'];
  
  for (const verb of queryVerbs) {
    if (queryLower.includes(verb)) {
      const indicators = answerIndicators[verb] || [];
      const first100 = contentLower.split(/\s+/).slice(0, 100).join(' ');
      if (indicators.some(ind => first100.includes(ind))) {
        queryVerbMatch = 100;
        break;
      }
    }
  }
  
  // Answer position - check where query entities appear
  const queryEntities = extractQueryEntities(query);
  const first50Words = content.split(/\s+/).slice(0, 50).join(' ').toLowerCase();
  const first100Words = content.split(/\s+/).slice(0, 100).join(' ').toLowerCase();
  const first200Words = content.split(/\s+/).slice(0, 200).join(' ').toLowerCase();
  
  let answerPosition = 25;
  const matchCount = (text: string) => queryEntities.filter(e => text.includes(e)).length;
  
  if (matchCount(first50Words) >= queryEntities.length * 0.5) {
    answerPosition = 100;
  } else if (matchCount(first100Words) >= queryEntities.length * 0.5) {
    answerPosition = 75;
  } else if (matchCount(first200Words) >= queryEntities.length * 0.5) {
    answerPosition = 50;
  }
  
  // Completeness (simplified - check multiple aspects covered)
  const completeness = 75; // Would need more sophisticated analysis
  
  return (
    (queryVerbMatch * 0.40) +
    (answerPosition * 0.35) +
    (completeness * 0.25)
  );
}

/**
 * Calculate Structural Clarity
 * Formula: (sentenceClarity × 0.40) + (paragraphStructure × 0.35) + (headingHierarchy × 0.25)
 */
export function calculateStructuralClarity(content: string): number {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 5);
  
  // Sentence clarity (avg length check)
  let sentenceClarity = 50;
  if (sentences.length > 0) {
    const avgLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
    if (avgLength >= 15 && avgLength <= 25) sentenceClarity = 100;
    else if (avgLength >= 10 && avgLength <= 30) sentenceClarity = 75;
  }
  
  // Paragraph structure
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
  const paragraphStructure = paragraphs.length >= 2 ? 100 : 75;
  
  // Heading/list detection
  let headingHierarchy = 50;
  if (/^#+\s|^\*\*[^*]+\*\*$/m.test(content)) headingHierarchy = 75;
  if (/^\s*[-•*]\s|\d+\./m.test(content)) headingHierarchy = Math.min(100, headingHierarchy + 25);
  
  return (
    (sentenceClarity * 0.40) +
    (paragraphStructure * 0.35) +
    (headingHierarchy * 0.25)
  );
}

/**
 * Calculate Query Restatement Score
 * Formula: queryPresent (100 if found) + positionBonus (up to 50)
 */
export function calculateQueryRestatement(query: string, content: string): number {
  const queryWords = query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  if (queryWords.length === 0) return 50;
  
  const contentLower = content.toLowerCase();
  const firstSentence = content.split(/[.!?]/)[0]?.toLowerCase() || '';
  
  // Check if query (or paraphrase) is present
  const queryMatchThreshold = 0.6;
  const matchedWords = queryWords.filter(w => contentLower.includes(w)).length;
  const queryPresent = (matchedWords / queryWords.length) >= queryMatchThreshold ? 100 : 0;
  
  // Position bonus
  let positionBonus = 0;
  if (queryPresent) {
    const firstSentenceMatches = queryWords.filter(w => firstSentence.includes(w)).length;
    if ((firstSentenceMatches / queryWords.length) >= queryMatchThreshold) {
      positionBonus = 50;
    } else {
      const first100 = content.split(/\s+/).slice(0, 100).join(' ').toLowerCase();
      const first100Matches = queryWords.filter(w => first100.includes(w)).length;
      if ((first100Matches / queryWords.length) >= queryMatchThreshold) {
        positionBonus = 25;
      }
    }
  }
  
  return Math.min(queryPresent + positionBonus, 100);
}
