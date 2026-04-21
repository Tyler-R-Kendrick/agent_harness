import { InMemoryAgentBus, LogActAgent, QuorumPolicy } from 'logact';
import type { IAgentBus, IInferenceClient, IVoter, IntentPayload, VotePayload } from 'logact';
import type { VoterStep } from '../types';
import type { AgentStreamCallbacks } from './types';

export type AgentLoopOptions = {
  inferenceClient: IInferenceClient;
  messages: Array<{ content: string }>;
  voters?: IVoter[];
  input?: string;
  bus?: IAgentBus;
  maxTurns?: number;
  quorumPolicy?: QuorumPolicy;
};

export function wrapVoterWithCallbacks(
  voter: IVoter,
  callbacks: Pick<AgentStreamCallbacks, 'onVoterStep' | 'onVoterStepUpdate' | 'onVoterStepEnd'>,
): IVoter {
  return {
    id: voter.id,
    tier: voter.tier,
    async vote(intent: IntentPayload, bus: IAgentBus): Promise<VotePayload> {
      const stepId = `voter-${voter.id}-${intent.intentId}`;
      const step: VoterStep = {
        id: stepId,
        kind: 'agent',
        title: voter.id,
        voterId: voter.id,
        startedAt: Date.now(),
        status: 'active',
      };
      callbacks.onVoterStep?.(step);

      let result: VotePayload;
      try {
        result = await voter.vote(intent, bus);
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

      callbacks.onVoterStepUpdate?.(stepId, {
        status: 'done',
        approve: result.approve,
        body: result.approve
          ? 'Approved'
          : `Rejected${result.reason ? `: ${result.reason}` : ''}`,
        endedAt: Date.now(),
      });
      callbacks.onVoterStepEnd?.(stepId);
      return result;
    },
  };
}

export async function runAgentLoop(
  {
    inferenceClient,
    messages,
    voters = [],
    input,
    bus = new InMemoryAgentBus(),
    maxTurns = 1,
    quorumPolicy = voters.length > 0 ? QuorumPolicy.BooleanAnd : QuorumPolicy.OnByDefault,
  }: AgentLoopOptions,
  callbacks: Pick<AgentStreamCallbacks, 'onVoterStep' | 'onVoterStepUpdate' | 'onVoterStepEnd'>,
): Promise<void> {
  const agent = new LogActAgent({
    bus,
    inferenceClient,
    voters: voters.map((voter) => wrapVoterWithCallbacks(voter, callbacks)),
    maxTurns,
    quorumPolicy,
  });

  await agent.send(input ?? messages.at(-1)?.content ?? '');

  try {
    await agent.run();
  } catch {
    // Provider adapters are responsible for forwarding user-visible errors.
  }
}