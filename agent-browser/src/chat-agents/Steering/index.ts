import type { IVoter } from 'logact';
import type { ChatMessage, HFModel } from '../../types';
import type { ToolDescriptor } from '../../tools';
import { buildAgentSystemPrompt, buildToolInstructionsTemplate } from '../../services/agentPromptTemplates';
import { streamCodiChat } from '../Codi';
import { streamCodexChat } from '../Codex';
import { streamCursorAgentChat } from '../Cursor';
import { streamGhcpChat } from '../Ghcp';
import type { AgentStreamCallbacks, ModelBackedAgentProvider } from '../types';

export const STEERING_LABEL = 'Steering';

export function isSteeringTaskText(text: string): boolean {
  return /\b(steering|correction|correct your reasoning|remember this|remember that|add this to .*memory|capture this rule|user correction|project memory|workspace memory|tool memory)\b/i.test(text);
}

export function buildSteeringOperatingInstructions(): string {
  return [
    '# Steering',
    '',
    '## Purpose',
    '- Capture user corrections as durable steering memory for future reasoning, tool use, and agent behavior.',
    '- Maintain `.steering/STEERING.md` as the summary index for scoped derivative files.',
    '',
    '## Canonical Files',
    '- `.steering/STEERING.md` summarizes and references every derivative file.',
    '- `.steering/user.steering.md` stores user-level preferences and corrections.',
    '- `.steering/project.steering.md` stores product and feature-level corrections.',
    '- `.steering/workspace.steering.md` stores repository, worktree, and codebase corrections.',
    '- `.steering/session.steering.md` stores conversation and current-run corrections.',
    '- `.steering/agent.steering.md` stores agent behavior and delegation corrections.',
    '- `.steering/tool.steering.md` stores command, script, browser, MCP, and tool-use corrections.',
    '',
    '## Workflow',
    '1. Preserve exact correction text before summarizing it.',
    '2. Choose one target derivative file from the correction scope.',
    '3. Append or update only the target derivative file.',
    '4. Refresh `.steering/STEERING.md` as an index that references derivative files.',
    '5. Use available skills and hooks to enforce steering corrections in future runs.',
    '',
    '## Constraints',
    '- Preserve exact correction text; do not paraphrase away the user instruction.',
    '- Do not rewrite unrelated steering scopes while applying one correction.',
    '- Keep summaries concise and cite the derivative file path that owns each correction.',
  ].join('\n');
}

export function buildSteeringSystemPrompt({
  workspaceName,
  modelId,
}: {
  workspaceName?: string;
  modelId?: string;
}): string {
  return [
    buildAgentSystemPrompt({
      workspaceName,
      goal: 'Manage durable Harness Steering memory by capturing corrections, routing them to scoped .steering files, and enforcing them through skills and hooks.',
      scenario: 'coding',
      constraints: [
        'Treat user corrections as durable memory updates, not casual chat.',
        'Preserve exact correction text and update only the relevant scoped steering file.',
      ],
      agentKind: 'steering',
      modelId,
    }),
    '## Steering Operating Instructions',
    buildSteeringOperatingInstructions(),
  ].join('\n\n');
}

export function buildSteeringToolInstructions({
  workspaceName,
  workspacePromptContext,
  descriptors,
  selectedToolIds,
  selectedGroups,
}: {
  workspaceName: string;
  workspacePromptContext: string;
  descriptors: readonly Pick<ToolDescriptor, 'id' | 'label' | 'description'>[];
  selectedToolIds?: readonly string[];
  selectedGroups?: readonly string[];
}): string {
  return [
    buildSteeringSystemPrompt({ workspaceName }),
    buildToolInstructionsTemplate({
      workspaceName,
      workspacePromptContext,
      descriptors,
      selectedToolIds,
      selectedGroups,
    }),
  ].join('\n\n');
}

export async function streamSteeringChat(
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
  const systemPrompt = buildSteeringSystemPrompt({ workspaceName, modelId: runtimeProvider === 'codi' ? model?.id : modelId });

  if (runtimeProvider === 'ghcp') {
    if (!modelId || !sessionId) {
      throw new Error('Steering GHCP chat requires a modelId and sessionId.');
    }

    await streamGhcpChat({
      modelId,
      sessionId,
      workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput,
      voters,
      systemPrompt,
    }, callbacks, signal);
    return;
  }

  if (runtimeProvider === 'cursor') {
    if (!modelId || !sessionId) {
      throw new Error('Steering Cursor chat requires a modelId and sessionId.');
    }

    await streamCursorAgentChat({
      modelId,
      sessionId,
      workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput,
      voters,
      systemPrompt,
    }, callbacks, signal);
    return;
  }

  if (runtimeProvider === 'codex') {
    if (!modelId || !sessionId) {
      throw new Error('Steering Codex chat requires a modelId and sessionId.');
    }

    await streamCodexChat({
      modelId,
      sessionId,
      workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput,
      voters,
      systemPrompt,
    }, callbacks, signal);
    return;
  }

  if (!model) {
    throw new Error('Steering Codi chat requires a local model.');
  }

  await streamCodiChat({
    model,
    messages,
    workspaceName,
    workspacePromptContext,
    voters,
    systemPrompt,
  }, callbacks, signal);
}
