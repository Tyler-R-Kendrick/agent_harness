import type { SearchResult } from './types';

export function rankSemanticSearchResults({
  question,
  results,
}: {
  question: string;
  results: SearchResult[];
}): SearchResult[] {
  const questionTokens = tokenSet(question);
  return results
    .map((result, index) => {
      const resultTokens = tokenSet([
        result.title,
        result.description ?? '',
        ...(result.facts ?? []).flatMap((fact) => [fact.label, fact.value]),
      ].join(' '));
      const overlap = [...questionTokens].filter((token) => resultTokens.has(token)).length;
      const relevance = questionTokens.size === 0 ? 0 : overlap / questionTokens.size;
      const factBoost = Math.min(0.2, (result.facts?.length ?? 0) * 0.03);
      const score = clamp01(0.45 + relevance * 0.45 + factBoost - index * 0.01);
      return { ...result, score };
    })
    .sort((left, right) => right.score - left.score);
}

function tokenSet(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}
