import { describe, expect, it } from 'vitest';
import { determineVerificationStatus } from '../gate';
import type { ReasoningTrace } from '../schemas';

function trace(overrides: Partial<ReasoningTrace> = {}): ReasoningTrace {
  return {
    task_id: 'task',
    goal: 'Validate n + 0 = n.',
    assumptions: [],
    steps: [
      {
        step_id: 'step-1',
        text: 'forall n : Nat, n + 0 = n',
        depends_on: [],
        evidence_refs: [],
        formalizable: true,
        critique_labels: [],
        checker_results: [{ checker_type: 'lean', status: 'passed', message: 'ok' }],
        status: 'accepted',
      },
    ],
    formal_claims: [
      {
        claim_id: 'claim-step-1',
        source_step_id: 'step-1',
        claim_text: 'forall n : Nat, n + 0 = n',
        formalization_target: 'lean',
        formal_expression: 'forall n : Nat, n + 0 = n',
        status: 'passed',
      },
    ],
    summary_state: {
      accepted_facts: [],
      open_obligations: [],
      failed_regions: [],
      best_partial_solutions: [],
      abandoned_paths: [],
    },
    ...overrides,
  };
}

describe('deterministic verification gate', () => {
  it('hard-verifies passed Lean claims without high critiques', () => {
    expect(determineVerificationStatus(trace())).toBe('hard_verified');
  });

  it('marks repaired traces as corrected when failures are resolved', () => {
    const repaired = trace({
      steps: [{ ...trace().steps[0], status: 'repaired' }],
      summary_state: { ...trace().summary_state, best_partial_solutions: ['repaired step'] },
    });

    expect(determineVerificationStatus(repaired, { hadRepair: true })).toBe('corrected');
  });

  it('does not hard-verify unknown Lean results', () => {
    const unknown = trace({
      steps: [{ ...trace().steps[0], checker_results: [{ checker_type: 'lean', status: 'unknown', message: 'missing assets' }] }],
      formal_claims: [{ ...trace().formal_claims[0], status: 'pending' }],
    });

    expect(determineVerificationStatus(unknown)).toBe('unverified');
  });

  it('rejects high-severity critiques and failed Lean checks', () => {
    const highCritique = trace({
      steps: [
        {
          ...trace().steps[0],
          critique_labels: [{ label: 'contradiction', severity: 'high', rationale: 'invalid' }],
        },
      ],
    });
    const failedLean = trace({
      steps: [{ ...trace().steps[0], checker_results: [{ checker_type: 'lean', status: 'failed', message: 'error' }] }],
    });

    expect(determineVerificationStatus(highCritique)).toBe('rejected');
    expect(determineVerificationStatus(failedLean)).toBe('rejected');
  });

  it('soft-verifies non-formal traces without high critiques', () => {
    const nonFormal = trace({
      steps: [{ ...trace().steps[0], formalizable: false, checker_results: [] }],
      formal_claims: [],
    });

    expect(determineVerificationStatus(nonFormal)).toBe('soft_verified');
  });
});
