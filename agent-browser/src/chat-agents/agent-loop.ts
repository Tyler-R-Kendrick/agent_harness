import { InMemoryAgentBus, LogActAgent, QuorumPolicy } from 'logact';
import type {
  IAgentBus,
  ICompletionChecker,
  IExecutor,
  IInferenceClient,
  IVoter,
  IntentPayload,
  VotePayload,
} from 'logact';
import type { IterationStep, VoterStep } from '../types';
import type { AgentStreamCallbacks } from './types';

export type AgentLoopOptions = {
  inferenceClient: IInferenceClient;
  messages: Array<{ content: string }>;
  voters?: IVoter[];
  input?: string;
  bus?: IAgentBus;
  maxTurns?: number;
  maxIterations?: number;
  quorumPolicy?: QuorumPolicy;
  completionChecker?: ICompletionChecker;
  executor?: IExecutor;
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
        ...(result.thought !== undefined ? { thought: result.thought } : {}),
        endedAt: Date.now(),
      });
      callbacks.onVoterStepEnd?.(stepId);
      return result;
    },
  };
}

export function wrapCompletionCheckerWithCallbacks(
  checker: ICompletionChecker,
  callbacks: Pick<AgentStreamCallbacks, 'onIterationStep' | 'onIterationStepUpdate' | 'onIterationStepEnd'>,
): ICompletionChecker {
  let iterationIndex = 0;

  return {
    async check(context) {
      iterationIndex += 1;
      const stepId = `iteration-${iterationIndex}`;
      const step: IterationStep = {
        id: stepId,
        kind: 'iteration',
        title: `Iteration ${iterationIndex}`,
        startedAt: Date.now(),
        status: 'active',
      };
      callbacks.onIterationStep?.(step);

      try {
        const result = await checker.check(context);
        callbacks.onIterationStepUpdate?.(stepId, {
          status: 'done',
          body: result.feedback,
          score: result.score,
          done: result.done,
          endedAt: Date.now(),
        });
        callbacks.onIterationStepEnd?.(stepId);
        return result;
      } catch (error) {
        callbacks.onIterationStepUpdate?.(stepId, {
          status: 'done',
          body: `Error: ${error instanceof Error ? error.message : String(error)}`,
          done: false,
          endedAt: Date.now(),
        });
        callbacks.onIterationStepEnd?.(stepId);
        throw error;
      }
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
    maxIterations,
    quorumPolicy = voters.length > 0 ? QuorumPolicy.BooleanAnd : QuorumPolicy.OnByDefault,
    completionChecker,
    executor,
  }: AgentLoopOptions,
  callbacks: Pick<AgentStreamCallbacks,
    'onVoterStep'
    | 'onVoterStepUpdate'
    | 'onVoterStepEnd'
    | 'onIterationStep'
    | 'onIterationStepUpdate'
    | 'onIterationStepEnd'
  >,
): Promise<void> {
  const agent = new LogActAgent({
    bus,
    inferenceClient,
    voters: voters.map((voter) => wrapVoterWithCallbacks(voter, callbacks)),
    ...(executor ? { executor } : {}),
    completionChecker: completionChecker
      ? wrapCompletionCheckerWithCallbacks(completionChecker, callbacks)
      : undefined,
    maxTurns: maxIterations ?? maxTurns,
    quorumPolicy,
  });

  await agent.send(input ?? messages.at(-1)?.content ?? '');

  try {
    await agent.run();
  } catch {
    // Provider adapters are responsible for forwarding user-visible errors.
  }
}
