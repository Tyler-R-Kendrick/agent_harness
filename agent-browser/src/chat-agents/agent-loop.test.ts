import { describe, expect, it, vi } from 'vitest';
import { PayloadType, QuorumPolicy } from 'logact';
import type { IntentPayload } from 'logact';
import { runAgentLoop, wrapVoterWithCallbacks } from './agent-loop';

describe('agent-loop', () => {
  it('fires voter callbacks for approve, reject, and error cases', async () => {
    const approvingVoter = {
      id: 'approve',
      tier: 'classic' as const,
      vote: vi.fn().mockResolvedValue({ type: 'Vote', intentId: 'i1', voterId: 'approve', approve: true }),
    };
    const rejectingVoter = {
      id: 'reject',
      tier: 'classic' as const,
      vote: vi.fn().mockResolvedValue({ type: 'Vote', intentId: 'i2', voterId: 'reject', approve: false, reason: 'blocked' }),
    };
    const failingVoter = {
      id: 'fail',
      tier: 'classic' as const,
      vote: vi.fn().mockRejectedValue(new Error('timeout')),
    };

    const onVoterStep = vi.fn();
    const onVoterStepUpdate = vi.fn();
    const onVoterStepEnd = vi.fn();
    const fakeBus = {} as never;

    const approveIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i1', action: 'approve' };
    const rejectIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i2', action: 'reject' };
    const failIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i3', action: 'fail' };

    await wrapVoterWithCallbacks(approvingVoter, { onVoterStep, onVoterStepUpdate, onVoterStepEnd }).vote(approveIntent, fakeBus);
    await wrapVoterWithCallbacks(rejectingVoter, { onVoterStep, onVoterStepUpdate, onVoterStepEnd }).vote(rejectIntent, fakeBus);
    await expect(
      wrapVoterWithCallbacks(failingVoter, { onVoterStep, onVoterStepUpdate, onVoterStepEnd }).vote(failIntent, fakeBus),
    ).rejects.toThrow('timeout');

    expect(onVoterStep).toHaveBeenCalledTimes(3);
    expect(onVoterStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ approve: true, body: 'Approved' }));
    expect(onVoterStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ approve: false, body: 'Rejected: blocked' }));
    expect(onVoterStepUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ approve: false, body: 'Error: timeout' }));
    expect(onVoterStepEnd).toHaveBeenCalledTimes(3);
  });

  it('forwards the voter thought alongside the approve/reject outcome', async () => {
    const thinkingApprove = {
      id: 'thinker-approve',
      tier: 'classic' as const,
      vote: vi.fn().mockResolvedValue({
        type: 'Vote',
        intentId: 'i1',
        voterId: 'thinker-approve',
        approve: true,
        thought: 'Read-only request; posing no risk.',
      }),
    };
    const thinkingReject = {
      id: 'thinker-reject',
      tier: 'classic' as const,
      vote: vi.fn().mockResolvedValue({
        type: 'Vote',
        intentId: 'i2',
        voterId: 'thinker-reject',
        approve: false,
        reason: 'unsafe',
        thought: 'Would delete workspace files. Rejecting.',
      }),
    };

    const onVoterStepUpdate = vi.fn();
    const fakeBus = {} as never;
    const approveIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i1', action: 'read' };
    const rejectIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i2', action: 'rm' };

    await wrapVoterWithCallbacks(thinkingApprove, { onVoterStepUpdate }).vote(approveIntent, fakeBus);
    await wrapVoterWithCallbacks(thinkingReject, { onVoterStepUpdate }).vote(rejectIntent, fakeBus);

    expect(onVoterStepUpdate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ approve: true, body: 'Approved', thought: 'Read-only request; posing no risk.' }),
    );
    expect(onVoterStepUpdate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ approve: false, body: 'Rejected: unsafe', thought: 'Would delete workspace files. Rejecting.' }),
    );
  });

  it('runs a shared LogAct loop with the last message content by default', async () => {
    const infer = vi.fn().mockResolvedValue('done');

    await runAgentLoop({
      inferenceClient: { infer },
      messages: [{ content: 'first' }, { content: 'latest' }],
    }, {});

    expect(infer).toHaveBeenCalledOnce();
  });

  it('accepts explicit loop input and custom quorum policy', async () => {
    const infer = vi.fn().mockResolvedValue('done');

    await runAgentLoop({
      inferenceClient: { infer },
      messages: [{ content: 'ignored' }],
      input: 'explicit input',
      quorumPolicy: QuorumPolicy.OnByDefault,
    }, {});

    expect(infer).toHaveBeenCalledOnce();
  });

  it('runs multiple Ralph iterations and emits iteration step callbacks when a completion checker requests another turn', async () => {
    const infer = vi.fn()
      .mockResolvedValueOnce('first draft')
      .mockResolvedValueOnce('final answer');
    const checker = vi.fn()
      .mockResolvedValueOnce({
        type: PayloadType.Completion,
        intentId: 'ignored-1',
        done: false,
        score: 'med',
        feedback: 'Not complete yet. Finish the task.',
      })
      .mockResolvedValueOnce({
        type: PayloadType.Completion,
        intentId: 'ignored-2',
        done: true,
        score: 'high',
        feedback: 'Task complete.',
      });

    const onIterationStep = vi.fn();
    const onIterationStepUpdate = vi.fn();
    const onIterationStepEnd = vi.fn();

    await runAgentLoop({
      inferenceClient: { infer },
      messages: [{ content: 'Complete the task.' }],
      completionChecker: { check: checker },
      maxIterations: 5,
    }, {
      onIterationStep,
      onIterationStepUpdate,
      onIterationStepEnd,
    });

    expect(infer).toHaveBeenCalledTimes(2);
    expect(checker).toHaveBeenCalledTimes(2);
    expect(onIterationStep).toHaveBeenCalledTimes(2);
    expect(onIterationStepUpdate).toHaveBeenCalledWith(
      expect.stringContaining('iteration-1'),
      expect.objectContaining({ score: 'med', done: false, body: 'Not complete yet. Finish the task.' }),
    );
    expect(onIterationStepUpdate).toHaveBeenCalledWith(
      expect.stringContaining('iteration-2'),
      expect.objectContaining({ score: 'high', done: true, body: 'Task complete.' }),
    );
    expect(onIterationStepEnd).toHaveBeenCalledTimes(2);
  });
});