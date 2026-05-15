import type { ChatMessage, HFModel } from '../types';
import type { AgentStreamCallbacks, AgentProvider, ModelBackedAgentProvider } from './types';
import { streamAdversaryChat, ADVERSARY_LABEL } from './Adversary';
import { streamAgentSwarmChat, AGENT_SWARM_LABEL } from './Swarm';
import { streamCodiChat, CODI_LABEL } from './Codi';
import { streamCodexChat, CODEX_LABEL } from './Codex';
import { streamContextManagerChat, CONTEXT_MANAGER_LABEL } from './ContextManager';
import { streamCursorAgentChat, CURSOR_LABEL } from './Cursor';
import { streamDebuggerChat, DEBUGGER_LABEL } from './Debugger';
import { streamGhcpChat, GHCP_LABEL } from './Ghcp';
import { streamMediaChat, MEDIA_LABEL } from './Media';
import { streamPlannerChat, PLANNER_LABEL } from './Planner';
import { streamResearcherChat, RESEARCHER_LABEL } from './Researcher';
import { streamSecurityReviewChat, SECURITY_REVIEW_LABEL } from './Security';
import { streamSteeringChat, STEERING_LABEL } from './Steering';
import { streamTourGuideChat, TOUR_GUIDE_LABEL } from './TourGuide';

type StreamSkillInput = {
  runtimeProvider: ModelBackedAgentProvider;
  model?: HFModel;
  modelId?: string;
  sessionId?: string;
  workspaceName: string;
  workspacePromptContext: string;
  messages: ChatMessage[];
  latestUserInput: string;
};

export type SkillDefinition = {
  id: AgentProvider;
  label: string;
  execute: (input: StreamSkillInput, callbacks: AgentStreamCallbacks, signal?: AbortSignal) => Promise<void>;
};

const requireSessionConfig = (providerLabel: string, input: StreamSkillInput): { modelId: string; sessionId: string } => {
  if (!input.modelId || !input.sessionId) {
    throw new Error(`${providerLabel} chat requires a modelId and sessionId.`);
  }
  return { modelId: input.modelId, sessionId: input.sessionId };
};

export const CHAT_AGENT_SKILLS: Record<AgentProvider, SkillDefinition> = {
  ghcp: { id: 'ghcp', label: GHCP_LABEL, execute: async (i, c, s) => { const cfg = requireSessionConfig('GHCP', i); return streamGhcpChat({ ...i, ...cfg }, c, s); } },
  cursor: { id: 'cursor', label: CURSOR_LABEL, execute: async (i, c, s) => { const cfg = requireSessionConfig('Cursor', i); return streamCursorAgentChat({ ...i, ...cfg }, c, s); } },
  codex: { id: 'codex', label: CODEX_LABEL, execute: async (i, c, s) => { const cfg = requireSessionConfig('Codex', i); return streamCodexChat({ ...i, ...cfg }, c, s); } },
  researcher: { id: 'researcher', label: RESEARCHER_LABEL, execute: (i, c, s) => streamResearcherChat(i, c, s) },
  debugger: { id: 'debugger', label: DEBUGGER_LABEL, execute: (i, c, s) => streamDebuggerChat(i, c, s) },
  planner: { id: 'planner', label: PLANNER_LABEL, execute: (i, c, s) => streamPlannerChat(i, c, s) },
  'context-manager': { id: 'context-manager', label: CONTEXT_MANAGER_LABEL, execute: (i, c, s) => streamContextManagerChat(i, c, s) },
  security: { id: 'security', label: SECURITY_REVIEW_LABEL, execute: (i, c, s) => streamSecurityReviewChat(i, c, s) },
  steering: { id: 'steering', label: STEERING_LABEL, execute: (i, c, s) => streamSteeringChat(i, c, s) },
  adversary: { id: 'adversary', label: ADVERSARY_LABEL, execute: (i, c, s) => streamAdversaryChat(i, c, s) },
  media: { id: 'media', label: MEDIA_LABEL, execute: (i, c, s) => streamMediaChat(i, c, s) },
  swarm: { id: 'swarm', label: AGENT_SWARM_LABEL, execute: (i, c, s) => streamAgentSwarmChat(i, c, s) },
  'tour-guide': { id: 'tour-guide', label: TOUR_GUIDE_LABEL, execute: (i, c, s) => streamTourGuideChat(i, c, s) },
  codi: {
    id: 'codi',
    label: CODI_LABEL,
    execute: async (i, c, s) => {
      if (!i.model) throw new Error('Codi chat requires a local model.');
      return streamCodiChat({ ...i, model: i.model }, c, s);
    },
  },
};
