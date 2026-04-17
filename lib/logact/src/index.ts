// Public surface for the logact library (arXiv 2604.07988)

export { InMemoryAgentBus } from './agentBus.js';
export { LogActAgent } from './agent.js';
export { ClassicVoter, AllowlistVoter, LLMPassiveVoter } from './voters.js';
export { evaluateQuorum } from './quorum.js';
export {
  buildExecutionSummary,
  getResults,
  getAbortedIntents,
} from './introspection.js';

export {
  PayloadType,
  QuorumPolicy,
} from './types.js';

export type {
  Entry,
  Payload,
  InfInPayload,
  InfOutPayload,
  IntentPayload,
  VotePayload,
  CommitPayload,
  AbortPayload,
  ResultPayload,
  MailPayload,
  PolicyPayload,
  IAgentBus,
  IVoter,
  IExecutor,
  IInferenceClient,
  LogActAgentOptions,
  ComponentTier,
} from './types.js';
