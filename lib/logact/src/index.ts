// Public surface for the logact library (arXiv 2604.07988)

export { GitAgentBus, InMemoryAgentBus } from './agentBus.js';
export { MockGitRepository } from './mockGit.js';
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
  AgentBusActorRole,
  AgentBusPayloadMeta,
  CompletionPayload,
  CompletionScore,
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
  ICompletionChecker,
  IInferenceClient,
  LogActAgentOptions,
  ComponentTier,
} from './types.js';
export type {
  MockGitBranch,
  MockGitCommit,
  MockGitCommitStatus,
  MockGitOperation,
  MockGitRepositoryOptions,
  MockPullRequest,
  MockPullRequestDecision,
  MockPullRequestReview,
  MockPullRequestState,
  MockPullRequestVote,
} from './mockGit.js';
export type { GitAgentBusOptions } from './agentBus.js';
