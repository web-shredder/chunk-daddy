/**
 * Citation Scoring Module
 * 
 * Comprehensive analysis to predict whether an LLM will cite a chunk.
 * Citation depends on:
 * 1. Attributability - Are claims specific enough to cite?
 * 2. Evidence Strength - Does it contain verifiable data?
 * 3. Citation Format - Is it structured for easy quoting?
 */

import { splitIntoSentences, type Sentence } from './sentence-utils';

// ============ Exported Types ============

export interface CitationScoreResult {
  score: number;
  attributability: AttributabilityScore;
  evidenceStrength: EvidenceScore;
  citationFormat: FormatScore;
}

export interface AttributabilityScore {
  score: number;
  specificClaims: SpecificClaim[];
  vagueClaims: string[];
  quotableSentences: string[];
}

export interface SpecificClaim {
  sentence: string;
  type: 'statistic' | 'date' | 'name' | 'definition' | 'process' | 'comparison';
  attributable: boolean;
  reason: string;
}

export interface EvidenceScore {
  score: number;
  hasNumbers: boolean;
  hasNames: boolean;
  hasDates: boolean;
  hasSourceReference: boolean;
  evidenceTypes: string[];
}

export interface FormatScore {
  score: number;
  quotableSentences: string[];
  hasExplicitStatement: boolean;
  isStandalone: boolean;
}

// ============ Patterns ============

const STATISTIC_PATTERN = /\d+(?:\.\d+)?%|\$\d+[\d,]*|\d+\s*(?:percent|dollars|million|billion|thousand|k|M)/i;
const DATE_PATTERN = /\b(19|20)\d{2}\b|\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?/i;
const NAMED_ENTITY_PATTERN = /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g;
const DEFINITION_PATTERN = /\b(?:is defined as|refers to|means|is called|is a type of|is an?|are)\b/i;
const PROCESS_PATTERN = /\b(?:first|second|third|then|next|finally|step \d|phase \d|stage \d)\b/i;
const COMPARISON_PATTERN = /\b(?:compared to|versus|vs\.?|more than|less than|better than|worse than|higher than|lower than|greater than|fewer than|unlike|whereas)\b/i;

const VAGUE_PATTERNS = [
  /\b(many|some|most|few|various|several)\s+(people|companies|organizations|experts|users|customers|businesses|teams)\b/i,
  /\b(often|sometimes|frequently|occasionally|typically|usually|generally|commonly|regularly)\b/i,
  /\bit is (said|believed|thought|known|important|essential|crucial|vital|key|necessary)\b/i,
  /\bthere are (many|some|various|numerous) (benefits|advantages|reasons|factors|ways|options|methods)\b/i,
  /\b(can|may|might|could) (help|improve|enhance|boost|increase|reduce|minimize|optimize)\b/i,
  /\b(significant|substantial|considerable|notable|meaningful) (impact|effect|improvement|benefit|difference|change)\b/i,
  /\b(in general|for the most part|by and large|more or less|to some extent)\b/i,
  /\b(things|stuff|aspects|elements|components) (like|such as)\b/i,
  /\b(it'?s?\s+worth\s+noting|importantly|interestingly|notably)\b/i,
];

const SOURCE_REFERENCE_PATTERNS = [
  /\baccording to\b/i,
  /\bresearch (shows?|suggests?|indicates?|demonstrates?)\b/i,
  /\bstud(y|ies) (by|from|shows?|found)\b/i,
  /\breport(s|ed)? (by|from|that)\b/i,
  /\b(data|statistics|findings) (from|show|indicate)\b/i,
  /\[\d+\]|\[citation\]|\(source\)/i,
  /\bsurve(y|yed)\s+\d+/i,
];

// ============ Core Functions ============

/**
 * Split text into sentences for analysis.
 */
function getSentences(text: string): string[] {
  const sentences = splitIntoSentences(text);
  return sentences.map(s => s.text.trim()).filter(s => s.length > 10);
}

/**
 * Find specific, attributable claims in the text.
 */
export function findSpecificClaims(text: string): SpecificClaim[] {
  const sentences = getSentences(text);
  const claims: SpecificClaim[] = [];
  
  for (const sentence of sentences) {
    // Check for statistics
    if (STATISTIC_PATTERN.test(sentence)) {
      const match = sentence.match(STATISTIC_PATTERN);
      claims.push({
        sentence,
        type: 'statistic',
        attributable: true,
        reason: `Contains specific statistic: ${match?.[0] || 'numeric data'}`,
      });
      continue; // Only count one type per sentence
    }
    
    // Check for dates
    if (DATE_PATTERN.test(sentence)) {
      const match = sentence.match(DATE_PATTERN);
      claims.push({
        sentence,
        type: 'date',
        attributable: true,
        reason: `Contains specific date: ${match?.[0] || 'date reference'}`,
      });
      continue;
    }
    
    // Check for named entities (consecutive capitalized words)
    const nameMatches = sentence.match(NAMED_ENTITY_PATTERN);
    if (nameMatches && nameMatches.length > 0) {
      claims.push({
        sentence,
        type: 'name',
        attributable: true,
        reason: `Contains named entity: ${nameMatches[0]}`,
      });
      continue;
    }
    
    // Check for definitions
    if (DEFINITION_PATTERN.test(sentence)) {
      claims.push({
        sentence,
        type: 'definition',
        attributable: true,
        reason: 'Contains definition structure',
      });
      continue;
    }
    
    // Check for process/steps
    if (PROCESS_PATTERN.test(sentence)) {
      claims.push({
        sentence,
        type: 'process',
        attributable: true,
        reason: 'Describes a step or process',
      });
      continue;
    }
    
    // Check for comparisons
    if (COMPARISON_PATTERN.test(sentence)) {
      claims.push({
        sentence,
        type: 'comparison',
        attributable: true,
        reason: 'Contains explicit comparison',
      });
      continue;
    }
  }
  
  return claims;
}

/**
 * Find vague, non-citable claims in the text.
 */
export function findVagueClaims(text: string): string[] {
  const sentences = getSentences(text);
  const vagueClaims: string[] = [];
  const specificSentences = new Set(findSpecificClaims(text).map(c => c.sentence));
  
  for (const sentence of sentences) {
    // Skip if this sentence has specific claims
    if (specificSentences.has(sentence)) continue;
    
    // Check if sentence matches vague patterns
    const isVague = VAGUE_PATTERNS.some(pattern => pattern.test(sentence));
    if (isVague) {
      vagueClaims.push(sentence);
    }
  }
  
  return vagueClaims;
}

/**
 * Find sentences that are suitable for direct quotation.
 * Quotable sentences are:
 * - Declarative (not questions)
 * - Standalone (don't start with context-dependent words)
 * - Appropriate length (5-30 words)
 * - Contain specific claims OR concrete statements
 */
export function findQuotableSentences(
  text: string,
  specificClaims: SpecificClaim[]
): string[] {
  const sentences = getSentences(text);
  const specificSentenceSet = new Set(specificClaims.map(c => c.sentence));
  const quotable: string[] = [];
  
  // Words that make a sentence context-dependent
  const contextDependentStarters = /^(this|it|they|these|those|however|therefore|thus|hence|moreover|furthermore|additionally|also|but|and|so|yet|still|meanwhile|consequently|as a result)/i;
  
  for (const sentence of sentences) {
    // Skip questions
    if (sentence.endsWith('?')) continue;
    
    // Skip too short or too long
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount < 5 || wordCount > 30) continue;
    
    // Skip context-dependent sentences
    if (contextDependentStarters.test(sentence.trim())) continue;
    
    // Must be either a specific claim OR contain at least one noun and verb
    const isSpecific = specificSentenceSet.has(sentence);
    const hasNounAndVerb = /\b(the|a|an|\w+s?)\b.*\b(is|are|was|were|has|have|had|does|do|did|can|will|would|should|must|takes?|costs?|requires?|provides?|includes?|shows?|means?)\b/i.test(sentence);
    
    if (isSpecific || hasNounAndVerb) {
      quotable.push(sentence);
    }
  }
  
  return quotable;
}

/**
 * Calculate attributability score based on specific vs vague claims.
 */
export function calculateAttributabilityScore(
  specificClaims: SpecificClaim[],
  vagueClaims: string[],
  totalSentences: number
): number {
  if (totalSentences === 0) return 50; // Neutral for empty text
  
  // Base score from ratio of specific claims
  let score = (specificClaims.length / totalSentences) * 100;
  
  // Penalty for vague claims
  score -= (vagueClaims.length / totalSentences) * 30;
  
  // Bonuses for high-value claim types
  const hasStatistic = specificClaims.some(c => c.type === 'statistic');
  const hasDefinition = specificClaims.some(c => c.type === 'definition');
  const hasComparison = specificClaims.some(c => c.type === 'comparison');
  
  if (hasStatistic) score += 10;
  if (hasDefinition) score += 5;
  if (hasComparison) score += 5;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate evidence strength based on verifiable data presence.
 */
export function calculateEvidenceScore(text: string): EvidenceScore {
  let score = 0;
  const evidenceTypes: string[] = [];
  
  // Check for numbers (any numeric data)
  const hasNumbers = /\d+(?:\.\d+)?/.test(text);
  if (hasNumbers) {
    score += 25;
    evidenceTypes.push('numeric_data');
  }
  
  // Check for proper nouns / named entities
  const hasNames = NAMED_ENTITY_PATTERN.test(text);
  if (hasNames) {
    score += 25;
    evidenceTypes.push('named_entities');
  }
  
  // Check for dates
  const hasDates = DATE_PATTERN.test(text);
  if (hasDates) {
    score += 25;
    evidenceTypes.push('dates');
  }
  
  // Check for source references
  const hasSourceReference = SOURCE_REFERENCE_PATTERNS.some(p => p.test(text));
  if (hasSourceReference) {
    score += 25;
    evidenceTypes.push('source_reference');
  }
  
  return {
    score: Math.min(100, score),
    hasNumbers,
    hasNames,
    hasDates,
    hasSourceReference,
    evidenceTypes,
  };
}

/**
 * Calculate format score based on quotability and structure.
 */
export function calculateFormatScore(
  quotableSentences: string[],
  text: string
): FormatScore {
  let score = 0;
  
  // Quotable sentences score (up to 40 points)
  // Scale: 1 sentence = 10pts, 2 = 20pts, 3 = 30pts, 4+ = 40pts
  const quotablePoints = Math.min(40, quotableSentences.length * 10);
  score += quotablePoints;
  
  // Check for explicit statements (declarative with specific subjects)
  const explicitPatterns = [
    /^[A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*\s+(?:is|are|was|were|has|have|provides?|includes?|requires?|takes?|costs?)\b/,
    /^The\s+\w+\s+(?:is|are|was|were)\b/,
    /^[A-Z][A-Z]+\s+(?:is|are|stands for)\b/i,
  ];
  const hasExplicitStatement = explicitPatterns.some(p => p.test(text));
  if (hasExplicitStatement) {
    score += 30;
  }
  
  // Check if first sentence is standalone (no backward-referring pronouns)
  const firstSentence = getSentences(text)[0] || '';
  const backwardRefPattern = /^(this|it|they|these|those|he|she|such|the\s+above|the\s+following)\b/i;
  const isStandalone = firstSentence.length > 0 && !backwardRefPattern.test(firstSentence);
  if (isStandalone) {
    score += 30;
  }
  
  return {
    score: Math.min(100, score),
    quotableSentences,
    hasExplicitStatement,
    isStandalone,
  };
}

/**
 * Calculate the complete citation score for a chunk.
 * 
 * Weights:
 * - Attributability: 40% (Are claims specific enough to cite?)
 * - Evidence Strength: 35% (Does it contain verifiable data?)
 * - Citation Format: 25% (Is it structured for easy quoting?)
 * 
 * @param chunkText - Full chunk text (with cascade if present)
 * @param chunkWithoutCascade - Clean chunk text without cascade prefix
 * @param queryText - The target query (for context, currently unused but future-proofed)
 */
export function calculateCitationScore(
  chunkText: string,
  chunkWithoutCascade: string,
  queryText?: string
): CitationScoreResult {
  // Use the clean text for analysis
  const textToAnalyze = chunkWithoutCascade || chunkText;
  const sentences = getSentences(textToAnalyze);
  const totalSentences = sentences.length;
  
  // Find claims
  const specificClaims = findSpecificClaims(textToAnalyze);
  const vagueClaims = findVagueClaims(textToAnalyze);
  const quotableSentences = findQuotableSentences(textToAnalyze, specificClaims);
  
  // Calculate sub-scores
  const attributabilityScore = calculateAttributabilityScore(
    specificClaims,
    vagueClaims,
    totalSentences
  );
  
  const attributability: AttributabilityScore = {
    score: attributabilityScore,
    specificClaims,
    vagueClaims,
    quotableSentences,
  };
  
  const evidenceStrength = calculateEvidenceScore(textToAnalyze);
  const citationFormat = calculateFormatScore(quotableSentences, textToAnalyze);
  
  // Combine with weights: 40% attributability, 35% evidence, 25% format
  const score = Math.round(
    (attributability.score * 0.40) +
    (evidenceStrength.score * 0.35) +
    (citationFormat.score * 0.25)
  );
  
  return {
    score: Math.max(0, Math.min(100, score)),
    attributability,
    evidenceStrength,
    citationFormat,
  };
}

// ============ Utility Exports ============

export {
  STATISTIC_PATTERN,
  DATE_PATTERN,
  NAMED_ENTITY_PATTERN,
  VAGUE_PATTERNS,
  SOURCE_REFERENCE_PATTERNS,
};
