import type { IVoter } from 'logact';
import type { ChatMessage, HFModel } from '../../types';
import type { ToolDescriptor } from '../../tools';
import { buildAgentSystemPrompt, buildToolInstructionsTemplate } from '../../services/agentPromptTemplates';
import {
  buildAgentSwarmPlan,
  buildAgentSwarmPromptContext,
  DEFAULT_AGENT_SWARM_SETTINGS,
  type AgentSwarmPlan,
} from '../../services/agentSwarms';
import { streamCodiChat } from '../Codi';
import { streamGhcpChat } from '../Ghcp';
import { streamCursorAgentChat } from '../Cursor';
import type { AgentStreamCallbacks, ModelBackedAgentProvider } from '../types';

export const AGENT_SWARM_AGENT_ID = 'swarm';
export const AGENT_SWARM_LABEL = 'Swarm';

export function isAgentSwarmTaskText(text: string): boolean {
  return /\b(agent\s*swarm|swarm|squad|multi-agent|multi agent|parallel agents?|agent personas?|reviewer personas?|run\s+\d+\s+agents?|horde)\b/i.test(text)
    || /\b(research|build|produce|generate|implement|ship|complete)\b.*\b(parallel|perspectives?|personas?|agents?|squad|swarm)\b/i.test(text);
}

export function buildAgentSwarmOperatingInstructions(): string {
  return [
    '# Swarm',
    '',
    '## Purpose',
    '- Orchestrate configurable agent personas inside development loops and asset output workflows.',
    '- Blend xAI-style multi-agent decomposition, Kimi-style 16-agent swarm breadth, and Copilot Squad-style team roles.',
    '- Turn broad tasks into bounded specialist jobs with review, synthesis, and verification gates.',
    '',
    '## Workflow',
    '1. Select the active swarm template and mode from the Agent Swarm Plan.',
    '2. Assign each planned agent a role, concrete responsibility, expected output, and handoff contract.',
    '3. Run broad exploration in parallel when the task benefits from many independent perspectives.',
    '4. Collapse findings through lead, reviewer, and integration personas before implementation claims.',
    '5. Preserve artifact paths, tests, screenshots, and acceptance criteria as swarm evidence.',
    '',
    '## Constraints',
    '- Do not claim parallel execution occurred unless the runtime actually ran delegated work or produced artifacts.',
    '- Keep each persona output independently useful and verifiable.',
    '- Prefer small, reviewable task slices over vague agent brainstorming.',
    '',
    '## Deliverables',
    '- Swarm roster with selected roles and responsibilities.',
    '- Per-agent job list with inputs, outputs, and dependencies.',
    '- Final synthesis, verification evidence, and open risks.',
  ].join('\n');
}

export function buildAgentSwarmSystemPrompt({
  workspaceName,
  modelId,
  plan,
}: {
  workspaceName?: string;
  modelId?: string;
  plan?: AgentSwarmPlan;
}): string {
  return [
    buildAgentSystemPrompt({
      workspaceName,
      goal: 'Coordinate configurable agent personas and swarms for task completion and asset production workflows.',
      scenario: 'general-chat',
      constraints: [
        'Use the Agent Swarm Plan as the authoritative roster and operating mode.',
        'Map each persona to concrete work, evidence, and review responsibilities.',
        'Separate actual delegated execution from planning-only swarm decomposition.',
      ],
      agentKind: AGENT_SWARM_AGENT_ID,
      modelId,
    }),
    '## Swarm Operating Instructions',
    buildAgentSwarmOperatingInstructions(),
    plan ? buildAgentSwarmPromptContext(plan) : '',
  ].filter(Boolean).join('\n\n');
}

export function buildAgentSwarmToolInstructions({
  workspaceName,
  workspacePromptContext,
  descriptors,
  selectedToolIds,
  selectedGroups,
  plan,
}: {
  workspaceName: string;
  workspacePromptContext: string;
  descriptors: readonly Pick<ToolDescriptor, 'id' | 'label' | 'description'>[];
  selectedToolIds?: readonly string[];
  selectedGroups?: readonly string[];
  plan?: AgentSwarmPlan;
}): string {
  return [
    buildAgentSwarmSystemPrompt({ workspaceName, plan }),
    buildToolInstructionsTemplate({
      workspaceName,
      workspacePromptContext,
      descriptors,
      selectedToolIds,
      selectedGroups,
    }),
  ].join('\n\n');
}

export async function streamAgentSwarmChat(
  {
    runtimeProvider,
    model,
    modelId,
    sessionId,
    messages,
    workspaceName,
    workspacePromptContext,
    latestUserInput,
    voters = [],
  }: {
    runtimeProvider: ModelBackedAgentProvider;
    model?: HFModel;
    modelId?: string;
    sessionId?: string;
    messages: ChatMessage[];
    workspaceName: string;
    workspacePromptContext: string;
    latestUserInput: string;
    voters?: IVoter[];
  },
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const plan = buildAgentSwarmPlan({ settings: DEFAULT_AGENT_SWARM_SETTINGS, request: latestUserInput });
  const swarmContext = buildAgentSwarmPromptContext(plan);
  const enrichedWorkspacePromptContext = [workspacePromptContext, swarmContext].filter(Boolean).join('\n\n');
  const systemPrompt = buildAgentSwarmSystemPrompt({
    workspaceName,
    modelId: runtimeProvider === 'codi' ? model?.id : modelId,
    plan,
  });

  if (runtimeProvider === 'ghcp') {
    if (!modelId || !sessionId) {
      throw new Error('Swarm GHCP chat requires a modelId and sessionId.');
    }
    await streamGhcpChat({
      modelId,
      sessionId,
      workspaceName,
      workspacePromptContext: enrichedWorkspacePromptContext,
      messages,
      latestUserInput,
      voters,
      systemPrompt,
    }, callbacks, signal);
    return;
  }

  if (runtimeProvider === 'cursor') {
    if (!modelId || !sessionId) {
      throw new Error('Swarm Cursor chat requires a modelId and sessionId.');
    }
    await streamCursorAgentChat({
      modelId,
      sessionId,
      workspaceName,
      workspacePromptContext: enrichedWorkspacePromptContext,
      messages,
      latestUserInput,
      voters,
      systemPrompt,
    }, callbacks, signal);
    return;
  }

  if (!model) {
    throw new Error('Swarm Codi chat requires a local model.');
  }

  await streamCodiChat({
    model,
    messages,
    workspaceName,
    workspacePromptContext: enrichedWorkspacePromptContext,
    latestUserInput,
    voters,
    systemPrompt,
  }, callbacks, signal);
}
