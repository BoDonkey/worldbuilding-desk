const SEARCH_STOP_WORDS = new Set([
  'are', 'before', 'can', 'did', 'does', 'for', 'from', 'had', 'has', 'have',
  'her', 'him', 'his', 'how', 'into', 'its', 'long', 'many', 'much', 'she',
  'the', 'their', 'them', 'they', 'this', 'was', 'were', 'what', 'when',
  'where', 'which', 'who', 'why', 'with', 'would'
]);

export function getLexicalSearchScore(query: string, content: string): number {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;
  const normalizedContent = normalizeSearchText(content);
  const terms = tokenizeSearchText(normalizedQuery);
  const contentTerms = tokenizeSearchText(normalizedContent);
  const contentTermSet = new Set(contentTerms);
  if (terms.length === 0) return 0;

  let score = containsTokenPhrase(contentTerms, terms) ? 4 : 0;
  for (const term of terms) {
    if (contentTermSet.has(term)) {
      score += 1;
    }
  }
  return score / terms.length;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenizeSearchText(value: string): string[] {
  return value
    .split(' ')
    .filter((term) => term.length >= 3 && !SEARCH_STOP_WORDS.has(term));
}

function containsTokenPhrase(contentTerms: string[], queryTerms: string[]): boolean {
  if (queryTerms.length === 0 || queryTerms.length > contentTerms.length) return false;
  for (let index = 0; index <= contentTerms.length - queryTerms.length; index += 1) {
    if (queryTerms.every((term, termIndex) => contentTerms[index + termIndex] === term)) {
      return true;
    }
  }
  return false;
}
