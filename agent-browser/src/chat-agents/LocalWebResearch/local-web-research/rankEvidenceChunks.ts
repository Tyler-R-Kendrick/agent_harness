import type { EvidenceChunk } from './types';

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'for',
  'from',
  'in',
  'is',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

export function rankEvidenceChunks(args: {
  question: string;
  chunks: EvidenceChunk[];
  maxChunks: number;
  strategy?: 'baseline' | 'ppgr';
}): EvidenceChunk[] {
  const query = normalize(args.question);
  const terms = tokenize(args.question);
  const deduped = dedupeNearIdentical(args.chunks);
  return deduped
    .map((chunk) => {
      const title = normalize(chunk.title ?? '');
      const body = normalize(chunk.text);
      let score = chunk.score;
      for (const term of terms) {
        if (title.includes(term)) score += 2;
        score += countTerm(body, term);
      }
      if (query && body.includes(query)) score += 4;
      if (query && title.includes(query)) score += 3;
      score += searchRankBoost(chunk.sourceResultId);
      if ((args.strategy ?? 'baseline') === 'ppgr') {
        score += pointerProvenanceBoost(chunk, terms, query);
      }
      return { ...chunk, score: Number(score.toFixed(3)) };
    })
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, args.maxChunks);
}

function pointerProvenanceBoost(chunk: EvidenceChunk, terms: string[], query: string): number {
  const pointerDensity = Math.min(2, terms.reduce((sum, term) => {
    return sum + (chunk.text.toLowerCase().includes(term) ? 0.25 : 0);
  }, 0));
  const hasStablePointer = chunk.normalizedUrl.length > 0 && chunk.normalizedUrl.startsWith('http') ? 0.5 : 0;
  const exactPointer = query && chunk.text.toLowerCase().includes(query) ? 0.75 : 0;
  return pointerDensity + hasStablePointer + exactPointer;
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter((term) => term.length > 2 && !STOPWORDS.has(term))
    .filter((term, index, terms) => terms.indexOf(term) === index);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function countTerm(value: string, term: string): number {
  return value.split(term).length - 1;
}

function searchRankBoost(sourceResultId: string | undefined): number {
  const rank = sourceResultId?.match(/(\d+)$/)?.[1];
  if (!rank) return 0;
  return Math.max(0, 1 - (Number(rank) - 1) * 0.1);
}

function dedupeNearIdentical(chunks: EvidenceChunk[]): EvidenceChunk[] {
  const seen = new Set<string>();
  const kept: EvidenceChunk[] = [];
  for (const chunk of chunks) {
    const key = normalize(chunk.text).slice(0, 180);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(chunk);
  }
  return kept;
}
