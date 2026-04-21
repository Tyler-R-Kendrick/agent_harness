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
});