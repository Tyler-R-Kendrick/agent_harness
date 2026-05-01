import { describe, expect, it, vi } from 'vitest';
import { PayloadType, QuorumPolicy, type IntentPayload } from 'logact';
import {
  runLogActAgentLoop,
  wrapCompletionCheckerWithCallbacks,
  wrapVoterWithCallbacks,
} from '../logactLoop.js';

describe('logact loop callback wrappers', () => {
  it('emits voter callbacks for approve, reject, thought, and error outcomes', async () => {
    const callbacks = {
      onVoterStep: vi.fn(),
      onVoterStepUpdate: vi.fn(),
      onVoterStepEnd: vi.fn(),
    };
    const fakeBus = {} as never;
    const approveIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i1', action: 'approve' };
    const rejectIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i2', action: 'reject' };
    const failIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i3', action: 'fail' };

    await wrapVoterWithCallbacks({
      id: 'approve',
      tier: 'classic',
      vote: vi.fn().mockResolvedValue({ type: PayloadType.Vote, intentId: 'i1', voterId: 'approve', approve: true }),
    }, callbacks).vote(approveIntent, fakeBus);
    await wrapVoterWithCallbacks({
      id: 'reject',
      tier: 'classic',
      vote: vi.fn().mockResolvedValue({
        type: PayloadType.Vote,
        intentId: 'i2',
        voterId: 'reject',
        approve: false,
        reason: 'blocked',
        thought: 'Unsafe command.',
      }),
    }, callbacks).vote(rejectIntent, fakeBus);
    await expect(wrapVoterWithCallbacks({
      id: 'fail',
      tier: 'classic',
      vote: vi.fn().mockRejectedValue(new Error('timeout')),
    }, callbacks).vote(failIntent, fakeBus)).rejects.toThrow('timeout');

    expect(callbacks.onVoterStep).toHaveBeenCalledTimes(3);
    expect(callbacks.onVoterStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ approve: true, body: 'Approved' }));
    expect(callbacks.onVoterStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      approve: false,
      body: 'Rejected: blocked',
      thought: 'Unsafe command.',
    }));
    expect(callbacks.onVoterStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ approve: false, body: 'Error: timeout' }));
    expect(callbacks.onVoterStepEnd).toHaveBeenCalledTimes(3);
  });

  it('emits completion-checker callbacks for success and failure outcomes', async () => {
    const callbacks = {
      onIterationStep: vi.fn(),
      onIterationStepUpdate: vi.fn(),
      onIterationStepEnd: vi.fn(),
    };
    const successfulChecker = wrapCompletionCheckerWithCallbacks({
      check: vi.fn().mockResolvedValue({
        type: PayloadType.Completion,
        intentId: 'ignored',
        done: true,
        score: 'high',
        feedback: 'Complete.',
      }),
    }, callbacks);
    const failingChecker = wrapCompletionCheckerWithCallbacks({
      check: vi.fn().mockRejectedValue(new Error('judge failed')),
    }, callbacks);

    await expect(successfulChecker.check({ lastResult: {} as never, history: [] })).resolves.toEqual(expect.objectContaining({ done: true }));
    await expect(failingChecker.check({ lastResult: {} as never, history: [] })).rejects.toThrow('judge failed');

    expect(callbacks.onIterationStep).toHaveBeenCalledTimes(2);
    expect(callbacks.onIterationStepUpdate).toHaveBeenCalledWith(expect.stringContaining('iteration-1'), expect.objectContaining({
      score: 'high',
      done: true,
      body: 'Complete.',
    }));
    expect(callbacks.onIterationStepUpdate).toHaveBeenCalledWith(expect.stringContaining('iteration-1'), expect.objectContaining({
      done: false,
      body: 'Error: judge failed',
    }));
    expect(callbacks.onIterationStepEnd).toHaveBeenCalledTimes(2);
  });

  it('allows callback wrappers to run without subscribers and normalizes non-Error failures', async () => {
    const fakeBus = {} as never;
    const rejectIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i4', action: 'reject' };
    const failIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i5', action: 'fail' };

    await expect(wrapVoterWithCallbacks({
      id: 'reject-without-reason',
      tier: 'classic',
      vote: vi.fn().mockResolvedValue({
        type: PayloadType.Vote,
        intentId: 'i4',
        voterId: 'reject-without-reason',
        approve: false,
      }),
    }, {}).vote(rejectIntent, fakeBus)).resolves.toEqual(expect.objectContaining({ approve: false }));
    await expect(wrapVoterWithCallbacks({
      id: 'string-fail',
      tier: 'classic',
      vote: vi.fn().mockRejectedValue('offline'),
    }, {}).vote(failIntent, fakeBus)).rejects.toBe('offline');

    await expect(wrapCompletionCheckerWithCallbacks({
      check: vi.fn().mockResolvedValue({
        type: PayloadType.Completion,
        intentId: 'c3',
        done: false,
      }),
    }, {}).check({ lastResult: {} as never, history: [] })).resolves.toEqual(expect.objectContaining({ done: false }));
    await expect(wrapCompletionCheckerWithCallbacks({
      check: vi.fn().mockRejectedValue('judge offline'),
    }, {}).check({ lastResult: {} as never, history: [] })).rejects.toBe('judge offline');
  });

  it('reports no-reason rejections and string failures when subscribers are present', async () => {
    const callbacks = {
      onVoterStepUpdate: vi.fn(),
      onIterationStepUpdate: vi.fn(),
    };
    const fakeBus = {} as never;

    await wrapVoterWithCallbacks({
      id: 'reject-briefly',
      tier: 'classic',
      vote: vi.fn().mockResolvedValue({
        type: PayloadType.Vote,
        intentId: 'i6',
        voterId: 'reject-briefly',
        approve: false,
      }),
    }, callbacks).vote({ type: PayloadType.Intent, intentId: 'i6', action: 'reject' }, fakeBus);
    await expect(wrapVoterWithCallbacks({
      id: 'string-error',
      tier: 'classic',
      vote: vi.fn().mockRejectedValue('offline'),
    }, callbacks).vote({ type: PayloadType.Intent, intentId: 'i7', action: 'fail' }, fakeBus)).rejects.toBe('offline');

    await wrapCompletionCheckerWithCallbacks({
      check: vi.fn().mockResolvedValue({
        type: PayloadType.Completion,
        intentId: 'c4',
        done: false,
      }),
    }, callbacks).check({ lastResult: {} as never, history: [] });
    await expect(wrapCompletionCheckerWithCallbacks({
      check: vi.fn().mockRejectedValue('judge offline'),
    }, callbacks).check({ lastResult: {} as never, history: [] })).rejects.toBe('judge offline');

    expect(callbacks.onVoterStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: 'Rejected' }));
    expect(callbacks.onVoterStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: 'Error: offline' }));
    expect(callbacks.onIterationStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ done: false }));
    expect(callbacks.onIterationStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: 'Error: judge offline' }));
  });
});

describe('runLogActAgentLoop', () => {
  it('runs the shared LogAct loop with default input, voters, and completion callbacks', async () => {
    const infer = vi.fn()
      .mockResolvedValueOnce('first draft')
      .mockResolvedValueOnce('final answer');
    const voter = {
      id: 'allow',
      tier: 'classic' as const,
      vote: vi.fn().mockResolvedValue({ type: PayloadType.Vote, intentId: 'ignored', voterId: 'allow', approve: true }),
    };
    const checker = {
      check: vi.fn()
        .mockResolvedValueOnce({ type: PayloadType.Completion, intentId: 'c1', done: false, score: 'med', feedback: 'Try again.' })
        .mockResolvedValueOnce({ type: PayloadType.Completion, intentId: 'c2', done: true, score: 'high', feedback: 'Done.' }),
    };
    const callbacks = {
      onVoterStep: vi.fn(),
      onIterationStep: vi.fn(),
    };

    await runLogActAgentLoop({
      inferenceClient: { infer },
      messages: [{ content: 'older' }, { content: 'latest' }],
      voters: [voter],
      completionChecker: checker,
      maxIterations: 4,
    }, callbacks);

    expect(infer).toHaveBeenCalledTimes(2);
    expect(voter.vote).toHaveBeenCalledTimes(2);
    expect(checker.check).toHaveBeenCalledTimes(2);
    expect(callbacks.onVoterStep).toHaveBeenCalled();
    expect(callbacks.onIterationStep).toHaveBeenCalled();
  });

  it('accepts explicit input, custom quorum policy, executor, and swallowed provider failures', async () => {
    const infer = vi.fn()
      .mockResolvedValueOnce('custom action')
      .mockRejectedValueOnce(new Error('provider down'));
    const execute = vi.fn().mockResolvedValue('executed');

    await runLogActAgentLoop({
      inferenceClient: { infer },
      messages: [{ content: 'ignored' }],
      input: 'explicit',
      quorumPolicy: QuorumPolicy.OnByDefault,
      executor: { tier: 'llm-active', execute },
    }, {});
    await expect(runLogActAgentLoop({
      inferenceClient: { infer },
      messages: [],
      maxTurns: 1,
    }, {})).resolves.toBeUndefined();

    expect(execute).toHaveBeenCalledWith('custom action');
  });
});
