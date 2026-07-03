// Public API barrel for @agent-harness/a2a. Excluded from coverage.

export { buildAgentCard, isA2AAgentCard } from './agentCard';
export type { BuildAgentCardInput } from './agentCard';
export { createA2ARouter } from './router';
export type { A2AComposeStep, A2ARouter } from './router';
export type {
  A2AAgentCard,
  A2AAgentHandler,
  A2ARegisteredAgent,
  A2ASkill,
  A2ATaskRequest,
  A2ATaskResult,
} from './types';
