import { describe, expect, it } from 'vitest';
import { buildLeanTheoremFile, sanitizeLeanIdentifier } from '../lean/theoremBuilder';
import type { FormalClaim } from '../schemas';

const claim: FormalClaim = {
  claim_id: 'step-2',
  source_step_id: 'step-2',
  claim_text: 'For every natural number n, n + 0 = n.',
  formalization_target: 'lean',
  formal_expression: 'forall n : Nat, n + 0 = n',
  proof: 'by\n  intro n\n  simp',
};

describe('Lean theorem builder', () => {
  it('sanitizes arbitrary claim IDs into Lean identifiers', () => {
    expect(sanitizeLeanIdentifier('step-2 weird/id')).toBe('step_2_weird_id');
    expect(sanitizeLeanIdentifier('123')).toBe('claim_123');
    expect(sanitizeLeanIdentifier('!!!')).toBe('claim');
  });

  it('builds a theorem with an explicit proof', () => {
    expect(buildLeanTheoremFile(claim)).toBe(
      [
        'set_option autoImplicit false',
        '',
        'theorem claim_step_2 : forall n : Nat, n + 0 = n := by',
        '  intro n',
        '  simp',
      ].join('\n'),
    );
  });

  it('uses fallback proof candidates when no proof is supplied', () => {
    expect(buildLeanTheoremFile({ ...claim, proof: undefined })).toContain(
      ['by', ' first', ' | rfl', ' | simp', ' | trivial'].join('\n'),
    );
  });

  it('renders caller-controlled imports and assumptions', () => {
    const theorem = buildLeanTheoremFile(claim, {
      imports: ['Init'],
      assumptions: ['h0 : x > 5'],
      theoremPrefix: 'checked',
    });

    expect(theorem).toContain('import Init\n\nset_option autoImplicit false');
    expect(theorem).toContain('theorem checked_step_2 (h0 : x > 5) : forall n : Nat, n + 0 = n := by');
  });

  it('rejects missing Lean expressions and ignores model-provided imports', () => {
    expect(() =>
      buildLeanTheoremFile({ ...claim, formalization_target: 'none' }),
    ).toThrow('Claim is not targeted at Lean.');
    expect(() =>
      buildLeanTheoremFile({ ...claim, formal_expression: undefined }),
    ).toThrow('No Lean formal expression provided.');
    expect(buildLeanTheoremFile(claim)).not.toContain('import Mathlib');
  });
});
