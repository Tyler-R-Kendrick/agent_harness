import {
  runLogActAgentLoop,
  wrapCompletionCheckerWithCallbacks,
  wrapVoterWithCallbacks,
  type LogActAgentLoopOptions,
} from 'harness-core';
import type { AgentStreamCallbacks } from './types';

export type AgentLoopOptions = LogActAgentLoopOptions;

type AgentLoopCallbacks = Pick<AgentStreamCallbacks,
  'onVoterStep'
  | 'onVoterStepUpdate'
  | 'onVoterStepEnd'
  | 'onIterationStep'
  | 'onIterationStepUpdate'
  | 'onIterationStepEnd'
>;

export { wrapCompletionCheckerWithCallbacks, wrapVoterWithCallbacks };

export async function runAgentLoop(
  options: AgentLoopOptions,
  callbacks: AgentLoopCallbacks,
): Promise<void> {
  await runLogActAgentLoop(options, callbacks);
}
