import type { ClaimStrictness } from './types';

export type ClaimValidationOptions = {
  strictness?: ClaimStrictness;
};

export type ClaimValidationResult = {
  acceptable: boolean;
  claim: string;
  reason?: string;
};

const UNRESOLVED_REFERENCES = ['it', 'this', 'that', 'these', 'those', 'they', 'them', 'he', 'she', 'his', 'her'];
const VAGUE_TRAILERS = ['and so on', 'etc.', 'etc'];

export function normalizeClaim(claim: string): string {
  return claim
    .trim()
    .replace(/\s+/gu, ' ')
    .replace(/\s+([,.;:!?])/gu, '$1');
}

export function isAcceptableClaim(claim: string, options: ClaimValidationOptions = {}): boolean {
  return validateClaim(claim, options).acceptable;
}

export function validateClaim(claim: string, options: ClaimValidationOptions = {}): ClaimValidationResult {
  const normalized = normalizeClaim(claim);
  const words = normalized.match(/\p{L}[\p{L}\p{N}'-]*/gu) ?? [];
  const minWords = options.strictness === 'recall' ? 3 : options.strictness === 'balanced' ? 4 : 5;

  if (normalized.length > 360) {
    return { acceptable: false, claim: normalized, reason: 'Claim is too long' };
  }
  if (!/\p{L}/u.test(normalized)) {
    return { acceptable: false, claim: normalized, reason: 'Claim is malformed' };
  }
  if (punctuationRatio(normalized) > 0.6) {
    return { acceptable: false, claim: normalized, reason: 'Claim is mostly punctuation' };
  }
  if (VAGUE_TRAILERS.some((trailer) => normalized.toLowerCase().endsWith(trailer))) {
    return { acceptable: false, claim: normalized, reason: 'Claim ends with a vague trailing phrase' };
  }

  const unresolved = firstUnresolvedReference(normalized);
  if (unresolved) {
    return { acceptable: false, claim: normalized, reason: `Contains unresolved reference: ${unresolved}` };
  }

  if (words.length < minWords) {
    return { acceptable: false, claim: normalized, reason: 'Claim is too short' };
  }

  return { acceptable: true, claim: normalized };
}

export function deduplicateClaims<T extends { claim: string }>(claims: T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const claim of claims) {
    const key = dedupeKey(claim.claim);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(claim);
  }
  return output;
}

function firstUnresolvedReference(claim: string): string | null {
  const withoutBracketedContext = claim.replace(/^\[[^\]]+\]\s*/u, '');
  const firstWord = withoutBracketedContext.match(/^\p{L}+/u)?.[0];
  if (!firstWord) {
    return null;
  }
  return UNRESOLVED_REFERENCES.includes(firstWord.toLowerCase()) ? firstWord : null;
}

function punctuationRatio(value: string): number {
  const nonWhitespace = value.replace(/\s/gu, '');
  if (!nonWhitespace) {
    return 1;
  }
  const punctuation = nonWhitespace.match(/[^\p{L}\p{N}]/gu)?.length ?? 0;
  return punctuation / nonWhitespace.length;
}

function dedupeKey(claim: string): string {
  return normalizeClaim(claim)
    .toLowerCase()
    .replace(/\$/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
