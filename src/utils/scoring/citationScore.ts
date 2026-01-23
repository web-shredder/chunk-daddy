/**
 * Citation Score Calculation
 * Formula: (quotability × 0.40) + (specificity × 0.30) + 
 *          (authoritySignals × 0.20) + (sentenceStructure × 0.10)
 */

/**
 * Calculate the composite citation score
 */
export function calculateCitationScore(content: string, query: string): number {
  const quotability = calculateQuotability(content);
  const specificity = calculateSpecificity(content);
  const authoritySignals = calculateAuthoritySignals(content);
  const sentenceStructure = calculateSentenceStructure(content);
  
  return (
    (quotability * 0.40) +
    (specificity * 0.30) +
    (authoritySignals * 0.20) +
    (sentenceStructure * 0.10)
  );
}

/**
 * Calculate Quotability Score
 * Formula: (standaloneSentences × 0.50) + (factualStatements × 0.30) + (noHedging × 0.20)
 */
export function calculateQuotability(content: string): number {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Standalone sentences (simplified check - sentences that make sense alone)
  const standaloneScore = 80; // Most well-written content scores okay here
  
  // Factual statements (look for definitive language)
  const factualIndicators = ['is', 'are', 'was', 'were', 'has', 'have', 'can', 'will'];
  const factualSentences = sentences.filter(s => 
    factualIndicators.some(ind => s.toLowerCase().includes(` ${ind} `))
  ).length;
  const factualScore = sentences.length > 0 
    ? Math.min((factualSentences / sentences.length) * 100, 100)
    : 50;
  
  // Hedge words penalty
  const hedgeWords = ['might', 'could', 'possibly', 'perhaps', 'maybe', 'somewhat', 'fairly', 'relatively'];
  const hedgeCount = hedgeWords.reduce((count, word) => 
    count + (content.toLowerCase().split(word).length - 1), 0
  );
  const noHedgingScore = Math.max(100 - (hedgeCount * 15), 0);
  
  return (
    (standaloneScore * 0.50) +
    (factualScore * 0.30) +
    (noHedgingScore * 0.20)
  );
}

/**
 * Calculate Specificity Score
 * Formula: (numbersPresent × 0.40) + (examplesPresent × 0.35) + (preciseTerms × 0.25)
 */
export function calculateSpecificity(content: string): number {
  // Numbers present
  const hasNumbers = /\d+%?/.test(content);
  const numbersScore = hasNumbers ? 100 : 50;
  
  // Examples present
  const exampleIndicators = ['for example', 'for instance', 'such as', 'e.g.', 'including', 'like'];
  const hasExamples = exampleIndicators.some(ind => content.toLowerCase().includes(ind));
  const examplesScore = hasExamples ? 100 : 40;
  
  // Precise terms (longer words tend to be more precise/technical)
  const words = content.split(/\s+/);
  const preciseWords = words.filter(w => w.length > 8).length;
  const preciseTermsScore = words.length > 0 
    ? Math.min((preciseWords / words.length) * 500, 100)
    : 50;
  
  return (
    (numbersScore * 0.40) +
    (examplesScore * 0.35) +
    (preciseTermsScore * 0.25)
  );
}

/**
 * Calculate Authority Signals Score
 * Formula: (citationsPresent × 0.40) + (technicalAccuracy × 0.35) + (confidentTone × 0.25)
 */
export function calculateAuthoritySignals(content: string): number {
  // Citations/source references
  const citationIndicators = ['according to', 'research shows', 'studies', 'data from', 'source:', 'documentation', 'official'];
  const hasCitations = citationIndicators.some(ind => content.toLowerCase().includes(ind));
  const citationsScore = hasCitations ? 100 : 30;
  
  // Technical accuracy (simplified - assume 75 baseline)
  const technicalAccuracy = 75;
  
  // Confident tone (no uncertainty phrases)
  const uncertaintyPhrases = ['i think', 'i believe', 'probably', 'likely', 'seems like', 'appears to', 'in my opinion'];
  const uncertaintyCount = uncertaintyPhrases.reduce((count, phrase) =>
    count + (content.toLowerCase().split(phrase).length - 1), 0
  );
  const confidentToneScore = Math.max(100 - (uncertaintyCount * 20), 0);
  
  return (
    (citationsScore * 0.40) +
    (technicalAccuracy * 0.35) +
    (confidentToneScore * 0.25)
  );
}

/**
 * Calculate Sentence Structure Score
 * Optimal: 15-25 words = 100, 10-14 or 26-30 = 75, other = 50
 */
export function calculateSentenceStructure(content: string): number {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 5);
  
  if (sentences.length === 0) return 50;
  
  const scores = sentences.map(s => {
    const wordCount = s.trim().split(/\s+/).length;
    if (wordCount >= 15 && wordCount <= 25) return 100;
    if ((wordCount >= 10 && wordCount <= 14) || (wordCount >= 26 && wordCount <= 30)) return 75;
    if ((wordCount >= 8 && wordCount <= 9) || (wordCount >= 31 && wordCount <= 40)) return 50;
    return 25;
  });
  
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
