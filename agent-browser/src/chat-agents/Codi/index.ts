import { browserInferenceEngine } from '../../services/browserInference';
import { formatBrowserInferenceResult } from '../../services/browserInferenceRuntime';
import { toAiSdkMessages } from '../../services/chatComposition';
import type { ChatMessage, HFModel } from '../../types';
import { createReasoningStepSplitter } from '../reasoningSplitter';
import type { AgentStreamCallbacks } from '../types';

export const CODI_LABEL = 'Codi';
const MAX_CONTEXT_MESSAGES = 7;

export function hasCodiModels(installedModels: HFModel[]): boolean {
  return installedModels.length > 0;
}

export function resolveCodiModelId(installedModels: HFModel[], selectedModelId: string): string {
  return installedModels.some((model) => model.id === selectedModelId)
    ? selectedModelId
    : (installedModels[0]?.id || '');
}

export function buildCodiPrompt({
  workspaceName,
  workspacePromptContext,
  messages,
}: {
  workspaceName: string;
  workspacePromptContext: string;
  messages: ChatMessage[];
}): Array<{ role: string; content: string }> {
  const aiMessages = toAiSdkMessages(messages);

  return [
    { role: 'system', content: 'You are Codi, the local workspace knowledge agent for an agent-first browser. Be concise and clear.' },
    { role: 'system', content: `Active workspace: ${workspaceName}` },
    { role: 'system', content: workspacePromptContext },
    ...aiMessages.slice(-MAX_CONTEXT_MESSAGES).map((message) => ({
      role: message.role,
      content: message.parts.map((part) => ('text' in part ? String(part.text) : '')).join(''),
    })),
  ];
}

export async function streamCodiChat(
  {
    model,
    messages,
    workspaceName,
    workspacePromptContext,
  }: {
    model: HFModel;
    messages: ChatMessage[];
    workspaceName: string;
    workspacePromptContext: string;
  },
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let tokenBuffer = '';
  let inReasoning = false;
  const reasoningSplitter = createReasoningStepSplitter({
    markers: false,
    onStepStart: callbacks.onReasoningStep,
    onStepUpdate: callbacks.onReasoningStepUpdate,
    onStepEnd: callbacks.onReasoningStepEnd,
  });

  await browserInferenceEngine.generate(
    {
      task: model.task,
      modelId: model.id,
      prompt: buildCodiPrompt({ workspaceName, workspacePromptContext, messages }),
    },
    {
      onPhase: callbacks.onPhase,
      onToken: (token) => {
        if (!inReasoning && token.includes('<think>')) {
          inReasoning = true;
          const reasoningDelta = token.split('<think>')[1] ?? '';
          if (reasoningDelta) {
            reasoningSplitter.push(reasoningDelta);
            callbacks.onReasoning?.(reasoningDelta);
          }
          return;
        }

        if (inReasoning && token.includes('</think>')) {
          const [before, after = ''] = token.split('</think>');
          if (before) {
            reasoningSplitter.push(before);
            callbacks.onReasoning?.(before);
          }
          reasoningSplitter.finish();
          tokenBuffer += after;
          inReasoning = false;
          if (after) {
            callbacks.onToken?.(after);
          }
          return;
        }

        if (inReasoning) {
          reasoningSplitter.push(token);
          callbacks.onReasoning?.(token);
          return;
        }

        tokenBuffer += token;
        callbacks.onToken?.(token);
      },
      onDone: (result) => {
        reasoningSplitter.finish();
        const finalContent = (tokenBuffer.trim() || formatBrowserInferenceResult(result)).trim();
        callbacks.onDone?.(finalContent);
      },
      onError: (error) => callbacks.onError?.(error),
    },
    signal,
  );
}