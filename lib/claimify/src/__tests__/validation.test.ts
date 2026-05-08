import { describe, expect, it } from 'vitest';
import {
  deduplicateClaims,
  isAcceptableClaim,
  normalizeClaim,
  validateClaim,
} from '../validation';

describe('claim validation', () => {
  it('normalizes whitespace and punctuation', () => {
    expect(normalizeClaim('  Contoso  reported  $12 million , in 2025 . ')).toBe(
      'Contoso reported $12 million, in 2025.',
    );
  });

  it('accepts standalone factual claims and rejects malformed or ambiguous ones', () => {
    expect(isAcceptableClaim('Contoso reported $12 million in revenue in 2025.')).toBe(true);
    expect(validateClaim('It reported growth.', { strictness: 'strict' })).toMatchObject({
      acceptable: false,
      reason: 'Contains unresolved reference: It',
    });
    expect(validateClaim('Tiny.', { strictness: 'strict' })).toMatchObject({
      acceptable: false,
      reason: 'Claim is too short',
    });
    expect(validateClaim('Revenue rose etc.', { strictness: 'balanced' })).toMatchObject({
      acceptable: false,
      reason: 'Claim ends with a vague trailing phrase',
    });
    expect(validateClaim('!!!!!!!!!', { strictness: 'recall' })).toMatchObject({
      acceptable: false,
      reason: 'Claim is mostly punctuation',
    });
  });

  it('allows bracketed context to resolve deictic references', () => {
    expect(isAcceptableClaim('[Contoso] It reported $12 million in revenue in 2025.')).toBe(true);
  });

  it('deduplicates exact and near-exact duplicates after normalization', () => {
    const claims = deduplicateClaims([
      { claim: 'Contoso reported $12 million in revenue in 2025.' },
      { claim: 'contoso reported 12 million in revenue in 2025' },
      { claim: 'Fabrikam opened a lab in Paris in 2024.' },
    ]);

    expect(claims.map((claim) => claim.claim)).toEqual([
      'Contoso reported $12 million in revenue in 2025.',
      'Fabrikam opened a lab in Paris in 2024.',
    ]);
  });
});
