import { InMemoryAgentBus, LogActAgent, QuorumPolicy } from 'logact';
import type {
  CompletionScore,
  IAgentBus,
  ICompletionChecker,
  IExecutor,
  IInferenceClient,
  IVoter,
  IntentPayload,
  VotePayload,
} from 'logact';

export type CoreStepStatus = 'active' | 'done';

export interface CoreVoterStep {
  id: string;
  kind: 'agent';
  title: string;
  voterId: string;
  body?: string;
  approve?: boolean;
  thought?: string;
  startedAt: number;
  endedAt?: number;
  status: CoreStepStatus;
}

export interface CoreIterationStep {
  id: string;
  kind: 'iteration';
  title: string;
  body?: string;
  score?: CompletionScore;
  done?: boolean;
  startedAt: number;
  endedAt?: number;
  status: CoreStepStatus;
}

export interface CoreAgentLoopCallbacks {
  onVoterStep?: (step: CoreVoterStep) => void;
  onVoterStepUpdate?: (id: string, patch: Partial<CoreVoterStep>) => void;
  onVoterStepEnd?: (id: string) => void;
  onIterationStep?: (step: CoreIterationStep) => void;
  onIterationStepUpdate?: (id: string, patch: Partial<CoreIterationStep>) => void;
  onIterationStepEnd?: (id: string) => void;
}

export interface LogActAgentLoopOptions {
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
}

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

export function wrapCompletionCheckerWithCallbacks(
  checker: ICompletionChecker,
  callbacks: Pick<CoreAgentLoopCallbacks, 'onIterationStep' | 'onIterationStepUpdate' | 'onIterationStepEnd'>,
): ICompletionChecker {
  let iterationIndex = 0;

  return {
    async check(context) {
      iterationIndex += 1;
      const stepId = `iteration-${iterationIndex}`;
      const step: CoreIterationStep = {
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

export async function runLogActAgentLoop(
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
  }: LogActAgentLoopOptions,
  callbacks: CoreAgentLoopCallbacks,
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
