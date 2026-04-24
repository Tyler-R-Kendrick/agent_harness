import { describe, expect, it } from 'vitest';
import { createHeuristicCompletionChecker, isExecutionTask, looksLikePlanOnly } from '../heuristicCompletion.js';

describe('heuristicCompletion', () => {
  it('detects execution-oriented tasks', () => {
    expect(isExecutionTask()).toBe(false);
    expect(isExecutionTask('Implement the fix and run the tests.')).toBe(true);
    expect(isExecutionTask('Fix the regression and explain what changed.')).toBe(true);
    expect(isExecutionTask('Review the failure log and fix the bug.')).toBe(true);
    expect(isExecutionTask('Plan how to implement the fix.')).toBe(false);
    expect(isExecutionTask('Explain how to implement the fix.')).toBe(false);
    expect(isExecutionTask('Explain the current architecture.')).toBe(false);
  });

  it('flags plan-only output', () => {
    expect(looksLikePlanOnly('')).toBe(true);
    expect(looksLikePlanOnly('Plan:\n1. Inspect the file\n2. Update the code')).toBe(true);
    expect(looksLikePlanOnly('I will fix this next by updating the handler.')).toBe(true);
    expect(looksLikePlanOnly('Follow-up: run the remaining verification checks.')).toBe(true);
    expect(looksLikePlanOnly('Implemented the fix and verified the tests pass.')).toBe(false);
    expect(
      looksLikePlanOnly(
        'Implemented the fix and verified the tests pass.\n\nFollow-Up Recommendations\n- Monitor CI for recurrence.',
      ),
    ).toBe(false);
  });

  it('requests another iteration for execution tasks that only return a plan', async () => {
    const checker = createHeuristicCompletionChecker('Implement the fix and run the tests.');

    const result = await checker.check({
      task: 'Implement the fix and run the tests.',
      lastResult: { type: 'Result', intentId: 'i1', output: 'Plan:\n1. Update the file\n2. Run tests' },
      history: [],
    });

    expect(result.done).toBe(false);
    expect(result.score).toBe('med');
    expect(result.feedback).toContain('Do the work to completion');
  });

  it('accepts completed execution output', async () => {
    const checker = createHeuristicCompletionChecker('Implement the fix and run the tests.');

    const result = await checker.check({
      task: 'Implement the fix and run the tests.',
      lastResult: { type: 'Result', intentId: 'i1', output: 'Implemented the fix and verified the tests pass.' },
      history: [],
    });

    expect(result.done).toBe(true);
    expect(result.score).toBe('high');
  });

  it('accepts completed execution reports that include follow-up recommendations', async () => {
    const checker = createHeuristicCompletionChecker('Implement the fix and run the tests.');

    const result = await checker.check({
      task: 'Implement the fix and run the tests.',
      lastResult: {
        type: 'Result',
        intentId: 'i1',
        output: 'Implemented the fix and verified the tests pass.\n\nFollow-Up Recommendations\n- Monitor CI for recurrence.',
      },
      history: [],
    });

    expect(result.done).toBe(true);
    expect(result.score).toBe('high');
  });

  it('does not force iteration for planning-oriented tasks', async () => {
    const checker = createHeuristicCompletionChecker('Delegate the work to subagents in parallel.');

    const result = await checker.check({
      task: 'Delegate the work to subagents in parallel.',
      lastResult: { type: 'Result', intentId: 'i1', output: 'Parallel delegation plan\n\n- Agent A: inspect code\n- Agent B: review tests' },
      history: [],
    });

    expect(result.done).toBe(true);
  });
});
