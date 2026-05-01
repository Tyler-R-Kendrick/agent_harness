import { LogActAgent, QuorumPolicy } from 'logact';
import { resolveAgentBus } from './agentBus.js';
import { runActorWorkflow } from './actorWorkflow.js';
import { resolveLogActInput } from './memory.js';
import { wrapCompletionCheckerWithCallbacks } from './chat-agents/completionChecker.js';
import { wrapVoterWithCallbacks } from './chat-agents/voter.js';
import type { CoreAgentLoopCallbacks, LogActAgentLoopOptions } from './logactLoopTypes.js';

export { wrapCompletionCheckerWithCallbacks } from './chat-agents/completionChecker.js';
export { wrapVoterWithCallbacks } from './chat-agents/voter.js';
export type {
  CoreAgentLoopCallbacks,
  CoreIterationStep,
  CoreStepStatus,
  CoreVoterStep,
  LogActAgentLoopOptions,
} from './logactLoopTypes.js';

export async function runLogActAgentLoop(
  {
    inferenceClient,
    messages,
    voters = [],
    input,
    bus,
    maxTurns = 1,
    maxIterations,
    quorumPolicy = voters.length > 0 ? QuorumPolicy.BooleanAnd : QuorumPolicy.OnByDefault,
    completionChecker,
    executor,
  }: LogActAgentLoopOptions,
  callbacks: CoreAgentLoopCallbacks,
): Promise<void> {
  const agentBus = resolveAgentBus(bus);

  await runActorWorkflow({
    actorId: 'logact-loop',
    input: resolveLogActInput({ messages, input }),
    bus: agentBus,
    run: async ({ input: resolvedInput }) => {
      const agent = new LogActAgent({
        bus: agentBus,
        inferenceClient,
        voters: voters.map((voter) => wrapVoterWithCallbacks(voter, callbacks)),
        ...(executor ? { executor } : {}),
        completionChecker: completionChecker
          ? wrapCompletionCheckerWithCallbacks(completionChecker, callbacks)
          : undefined,
        maxTurns: maxIterations ?? maxTurns,
        quorumPolicy,
      });

      await agent.send(resolvedInput);

      try {
        await agent.run();
      } catch {
        // Provider adapters are responsible for forwarding user-visible errors.
      }
    },
  });
}
