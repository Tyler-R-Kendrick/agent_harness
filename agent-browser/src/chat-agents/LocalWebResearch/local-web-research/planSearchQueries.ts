const FILLER_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'about',
  'for',
  'in',
  'me',
  'of',
  'on',
  'or',
  'please',
  'the',
  'to',
  'what',
  'whats',
  'with',
]);

const RECENCY_WORDS = new Set(['latest', 'recent', 'current', 'today']);

export function planSearchQueries(question: string, now = new Date()): string[] {
  const original = question.trim().replace(/\s+/g, ' ');
  if (!original) return [];
  const queries: string[] = [original];
  if (/\b(?:latest|recent|current|today|this week|2026)\b/i.test(original)) {
    queries.push(`${original} ${now.getUTCFullYear()}`);
  }
  const keywordDense = original
    .split(/\s+/)
    .filter((word) => {
      const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalized && !FILLER_WORDS.has(normalized) && !RECENCY_WORDS.has(normalized);
    })
    .join(' ');
  if (keywordDense && keywordDense !== original) queries.push(keywordDense);
  return queries.filter((query, index, all) => all.indexOf(query) === index).slice(0, 3);
}
