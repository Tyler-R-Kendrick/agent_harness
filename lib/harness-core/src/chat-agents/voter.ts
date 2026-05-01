import type { IAgentBus, IntentPayload, IVoter, VotePayload } from 'logact';
import type { CoreAgentLoopCallbacks, CoreVoterStep } from '../logactLoopTypes.js';

export function wrapVoterWithCallbacks(
  voter: IVoter,
  callbacks: Pick<CoreAgentLoopCallbacks, 'onVoterStep' | 'onVoterStepUpdate' | 'onVoterStepEnd'>,
): IVoter {
  return {
    id: voter.id,
    tier: voter.tier,
    async vote(intent: IntentPayload, bus: IAgentBus): Promise<VotePayload> {
      const stepId = `voter-${voter.id}-${intent.intentId}`;
      const step: CoreVoterStep = {
        id: stepId,
        kind: 'agent',
        title: voter.id,
        voterId: voter.id,
        startedAt: Date.now(),
        status: 'active',
      };
      callbacks.onVoterStep?.(step);

      try {
        const result = await voter.vote(intent, bus);
        callbacks.onVoterStepUpdate?.(stepId, {
          status: 'done',
          approve: result.approve,
          body: result.approve
            ? 'Approved'
            : `Rejected${result.reason ? `: ${result.reason}` : ''}`,
          ...(result.thought !== undefined ? { thought: result.thought } : {}),
          endedAt: Date.now(),
        });
        callbacks.onVoterStepEnd?.(stepId);
        return result;
      } catch (error) {
        callbacks.onVoterStepUpdate?.(stepId, {
          status: 'done',
          approve: false,
          body: `Error: ${error instanceof Error ? error.message : String(error)}`,
          endedAt: Date.now(),
        });
        callbacks.onVoterStepEnd?.(stepId);
        throw error;
      }
    },
  };
}
