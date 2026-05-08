import { describe, expect, it } from 'vitest';
import { runAgentBrowser } from '../agent';
import { BrowserLeanChecker } from '../checkers/leanChecker';
import { collectCheckerFeedback, findFailingRegions, updateSummaryState } from '../summary';
import { FakeLeanChecker } from '../testing/fakeLeanChecker';
import { StubValidationModel } from '../testing/stubValidationModel';
import type { TaskInput } from '../schemas';

const task: TaskInput = {
  task_id: 'nat-add-zero',
  goal: 'Validate that forall n : Nat, n + 0 = n.',
  context: {},
  constraints: [],
  evidence: [],
  require_formal_proof: true,
  require_symbolic_checking: false,
  max_iterations: 2,
  max_branches: 1,
};

describe('agent browser validation loop', () => {
  it('accepts a passing Lean trace and preserves checker artifacts', async () => {
    const result = await runAgentBrowser(task, {
      llm: new StubValidationModel(),
      leanChecker: new FakeLeanChecker('passed') as unknown as BrowserLeanChecker,
    });

    expect(result.verification_status).toBe('hard_verified');
    expect(result.accepted_steps).toHaveLength(1);
    expect(result.checker_artifacts[0]).toMatchObject({ status: 'passed' });
  });

  it('repairs a Lean failure and returns corrected', async () => {
    const result = await runAgentBrowser(
      { ...task, goal: 'Validate that forall n : Nat, n + 1 = n.' },
      {
        llm: new StubValidationModel(),
        leanChecker: new FakeLeanChecker(({ claim }) =>
          claim.formal_expression?.includes('n + 1 = n') ? 'failed' : 'passed',
        ) as unknown as BrowserLeanChecker,
      },
    );

    expect(result.verification_status).toBe('corrected');
    expect(result.repair_history).toEqual([{ iteration: 0, step_id: 'step-1', attempt: 1 }]);
    expect(result.accepted_steps[0].text).toContain('n + 0 = n');
  });

  it('does not mark unknown Lean results as hard verified', async () => {
    const result = await runAgentBrowser(task, {
      llm: new StubValidationModel(),
      leanChecker: new FakeLeanChecker('unknown') as unknown as BrowserLeanChecker,
    });

    expect(result.verification_status).toBe('unverified');
    expect(result.summary_state.open_obligations).toContain('Lean check unknown for step-1: fake unknown');
  });

  it('summarizes failures and checker feedback', () => {
    const failed = {
      ...new StubValidationModel().makeTrace({ ...task, goal: 'Validate that forall n : Nat, n + 1 = n.' }),
      steps: [
        {
          ...new StubValidationModel().makeTrace(task).steps[0],
          status: 'failed' as const,
          checker_results: [{ checker_type: 'lean' as const, status: 'failed' as const, message: 'bad theorem' }],
        },
      ],
    };

    expect(findFailingRegions(failed).map((step) => step.step_id)).toEqual(['step-1']);
    expect(collectCheckerFeedback(failed.steps[0])).toEqual([
      { checker_type: 'lean', status: 'failed', message: 'bad theorem' },
    ]);
    expect(updateSummaryState(failed).failed_regions).toEqual(['step-1']);
  });
});
