import type { IVoter } from 'logact';
import type { ChatMessage, HFModel } from '../../types';
import type { ToolDescriptor } from '../../tools';
import { buildAgentSystemPrompt, buildToolInstructionsTemplate } from '../../services/agentPromptTemplates';
import { streamCodexChat } from '../Codex';
import { streamCodiChat } from '../Codi';
import { streamCursorAgentChat } from '../Cursor';
import { streamGhcpChat } from '../Ghcp';
import type { AgentStreamCallbacks, ModelBackedAgentProvider } from '../types';

export const ADVERSARY_LABEL = 'Adversary';

export function isAdversaryTaskText(text: string): boolean {
  return /\b(adversar(?:y|ial)|red[- ]?team|judge blind spot|fool(?:ing)? (?:the )?judge|attack candidate|counterexample candidate)\b/i.test(text);
}

export function buildAdversaryOperatingInstructions({ maxCandidates = 3 }: { maxCandidates?: number } = {}): string {
  const boundedMax = Math.min(5, Math.max(1, Math.round(maxCandidates)));
  return [
    '# Adversary',
    '',
    '## Purpose',
    '- Generate adversarial candidate outputs that test whether judges or voters can be fooled by plausible but flawed answers.',
    '',
    '## Goals',
    `- Produce a minimum of 1 candidate and a maximum of ${boundedMax} candidates.`,
    '- Run adversary and happy-path outputs in parallel conceptually: compare a grounded answer against adversarial alternatives before judging.',
    '- Use eval criteria, current AgentBus trajectory, voter feedback, and process history as first-class inputs.',
    '- Identify circular failures where the current context may repeat a bad assumption, stale tool result, or invalid prior vote.',
    '- Convert any adversary win into feedback for the next iteration so the happy path can rerun with the failure mode explicit.',
    '',
    '## Constraints',
    '- Do not reveal adversary identity to voters or judges when constructing candidate labels.',
    '- Do not recommend harmful real-world action. Keep attacks bounded to evaluation, reasoning, prompt, and workflow failure modes.',
    '- Do not fabricate eval results, AgentBus events, or voter decisions.',
    '- Keep each candidate concise, inspectable, and tied to a named judge blind spot.',
    '',
    '## Workflow',
    '1. Extract the user task, eval criteria, expected success signals, and current candidate answer shape.',
    '2. Read AgentBus/process trajectory for intents, votes, aborts, commits, results, completions, and prior feedback.',
    '3. Name circular failure risks such as repeated assumptions, stale evidence, contradictory votes, or context drift.',
    '4. Generate bounded adversary candidates with attack goal, judge blind spot, and feedback hook.',
    '5. Compare adversary candidates against the happy-path answer without exposing which candidate is adversarial to voters.',
    '6. If an adversary candidate wins, request rerun and write feedback that future iterations can consume.',
  ].join('\n');
}

export function buildAdversarySystemPrompt({
  workspaceName,
  modelId,
  maxCandidates,
}: {
  workspaceName?: string;
  modelId?: string;
  maxCandidates?: number;
}): string {
  const runtimeModel = modelId ? `## Runtime Model\nActive model: ${modelId}` : '';

  return [
    buildAgentSystemPrompt({
      workspaceName,
      goal: 'Generate bounded adversarial candidates for judge/voter evaluation and turn adversary wins into rerun feedback.',
      scenario: 'coding',
      constraints: [
        'Keep adversarial behavior bounded to evaluation of candidate outputs.',
        'Hide adversary identity from voters while preserving feedback in AgentBus/process records.',
      ],
      agentKind: 'adversary',
      modelId,
    }),
    runtimeModel,
    '## Adversary Operating Instructions',
    buildAdversaryOperatingInstructions({ maxCandidates }),
  ].filter(Boolean).join('\n\n');
}

export function buildAdversaryToolInstructions({
  workspaceName,
  workspacePromptContext,
  descriptors,
  selectedToolIds,
  selectedGroups,
  maxCandidates,
}: {
  workspaceName: string;
  workspacePromptContext: string;
  descriptors: readonly Pick<ToolDescriptor, 'id' | 'label' | 'description'>[];
  selectedToolIds?: readonly string[];
  selectedGroups?: readonly string[];
  maxCandidates?: number;
}): string {
  return [
    buildAdversarySystemPrompt({ workspaceName, maxCandidates }),
    buildToolInstructionsTemplate({
      workspaceName,
      workspacePromptContext,
      descriptors,
      selectedToolIds,
      selectedGroups,
    }),
  ].join('\n\n');
}

export async function streamAdversaryChat(
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
  const systemPrompt = buildAdversarySystemPrompt({
    workspaceName,
    modelId: runtimeProvider === 'codi' ? model?.id : modelId,
  });

  if (runtimeProvider === 'ghcp') {
    if (!modelId || !sessionId) {
      throw new Error('Adversary GHCP chat requires a modelId and sessionId.');
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
      throw new Error('Adversary Cursor chat requires a modelId and sessionId.');
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
      throw new Error('Adversary Codex chat requires a modelId and sessionId.');
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
    throw new Error('Adversary Codi chat requires a local model.');
  }

  await streamCodiChat({
    model,
    messages,
    workspaceName,
    workspacePromptContext,
    latestUserInput,
    voters,
    systemPrompt,
  }, callbacks, signal);
}
