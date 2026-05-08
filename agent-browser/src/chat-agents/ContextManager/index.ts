import type { IVoter } from 'logact';
import type { ChatMessage, HFModel } from '../../types';
import { streamCodiChat } from '../Codi';
import { streamCodexChat } from '../Codex';
import { streamCursorAgentChat } from '../Cursor';
import { streamGhcpChat } from '../Ghcp';
import type { AgentStreamCallbacks, ModelBackedAgentProvider } from '../types';
import { buildContextManagerSystemPrompt } from './prompt';

export {
  CONTEXT_MANAGER_AGENT_ID,
  CONTEXT_MANAGER_CACHE_ROOT,
  CONTEXT_MANAGER_LABEL,
  buildContextManagerOperatingInstructions,
  buildContextManagerSystemPrompt,
  buildContextManagerToolInstructions,
  isContextManagerTaskText,
} from './prompt';

export async function streamContextManagerChat(
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
  const systemPrompt = buildContextManagerSystemPrompt({
    workspaceName,
    modelId: runtimeProvider === 'codi' ? model?.id : modelId,
  });

  if (runtimeProvider === 'ghcp') {
    if (!modelId || !sessionId) throw new Error('Context Manager GHCP chat requires a modelId and sessionId.');
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
    if (!modelId || !sessionId) throw new Error('Context Manager Cursor chat requires a modelId and sessionId.');
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
    if (!modelId || !sessionId) throw new Error('Context Manager Codex chat requires a modelId and sessionId.');
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

  if (!model) throw new Error('Context Manager Codi chat requires a local model.');
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
