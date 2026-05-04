import type { ICompletionChecker, IInferenceClient, IVoter } from 'logact';
import { createHeuristicCompletionChecker, isExecutionTask } from 'ralph-loop';
import { streamCodexRuntimeChat, type CodexModelSummary, type CodexRuntimeState } from '../../services/codexApi';
import { toChatSdkTranscript } from '../../services/chatComposition';
import { buildAgentSystemPrompt, resolveAgentScenario } from '../../services/agentPromptTemplates';
import type { ChatMessage } from '../../types';
import { runAgentLoop } from '../agent-loop';
import { createDeferredAgentCallbacks } from '../deferredCallbacks';
import type { AgentStreamCallbacks } from '../types';

export const CODEX_LABEL = 'Codex';

export function hasCodexAccess(state: CodexRuntimeState): boolean {
  return state.available && state.authenticated && state.models.length > 0;
}

export function resolveCodexModelId(models: CodexModelSummary[], selectedModelId: string): string {
  return models.some((model) => model.id === selectedModelId)
    ? selectedModelId
    : (models[0]?.id || '');
}

export function buildCodexPrompt({
  workspaceName,
  workspacePromptContext,
  messages,
  latestUserInput,
  loopMessages,
  systemPrompt,
  modelId,
}: {
  workspaceName: string;
  workspacePromptContext: string;
  messages: ChatMessage[];
  latestUserInput: string;
  loopMessages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  systemPrompt?: string;
  modelId?: string;
}): string {
  const transcript = loopMessages
    ? loopMessages
      .filter((message) => message.content.trim())
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n\n')
    : toChatSdkTranscript(messages)
      .filter((message) => message.text.trim())
      .map((message) => `${message.role}: ${message.text}`)
      .join('\n\n');
  const scenario = resolveAgentScenario(loopMessages?.at(-1)?.content || latestUserInput || transcript);

  return [
    systemPrompt ?? buildAgentSystemPrompt({
      workspaceName,
      goal: 'Help the user in the active workspace with concise, grounded collaboration.',
      scenario,
      constraints: ['Use the transcript and latest user request to stay grounded in the current workspace context.'],
      modelId,
    }),
    '## Workspace Context',
    workspacePromptContext,
    transcript ? `Conversation transcript:\n${transcript}` : null,
    `Latest user request:\n${latestUserInput.trim()}`,
  ].filter(Boolean).join('\n\n');
}

function createCodexInferenceClient(
  {
    modelId,
    sessionId,
    workspaceName,
    workspacePromptContext,
    messages,
    latestUserInput,
    systemPrompt,
  }: {
    modelId: string;
    sessionId: string;
    workspaceName: string;
    workspacePromptContext: string;
    messages: ChatMessage[];
    latestUserInput: string;
    systemPrompt?: string;
  },
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): IInferenceClient {
  return {
    async infer(loopMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) {
      let resolvedContent = '';

      try {
        await streamCodexRuntimeChat(
          {
            modelId,
            sessionId,
            prompt: buildCodexPrompt({ workspaceName, workspacePromptContext, messages, latestUserInput, loopMessages, systemPrompt, modelId }),
          },
          {
            onToken: callbacks.onToken,
            onReasoning: callbacks.onReasoning,
            onReasoningStep: callbacks.onReasoningStep,
            onReasoningStepUpdate: callbacks.onReasoningStepUpdate,
            onReasoningStepEnd: callbacks.onReasoningStepEnd,
            onDone: (finalContent) => {
              resolvedContent = finalContent ?? '';
              callbacks.onDone?.(finalContent);
            },
          },
          signal,
        );
      } catch (error) {
        const resolvedError = error instanceof Error ? error : new Error(String(error));
        callbacks.onError?.(resolvedError);
        throw resolvedError;
      }

      return resolvedContent;
    },
  };
}

export async function streamCodexChat(
  {
    modelId,
    sessionId,
    workspaceName,
    workspacePromptContext,
    messages,
    latestUserInput,
    voters = [],
    completionChecker,
    maxIterations = 5,
    systemPrompt,
  }: {
    modelId: string;
    sessionId: string;
    workspaceName: string;
    workspacePromptContext: string;
    messages: ChatMessage[];
    latestUserInput: string;
    voters?: IVoter[];
    completionChecker?: ICompletionChecker;
    maxIterations?: number;
    systemPrompt?: string;
  },
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const effectiveCompletionChecker = completionChecker
    ?? (isExecutionTask(latestUserInput) ? createHeuristicCompletionChecker(latestUserInput) : undefined);
  const deferred = effectiveCompletionChecker ? createDeferredAgentCallbacks(callbacks) : null;
  const inferenceClient = createCodexInferenceClient({
    modelId,
    sessionId,
    workspaceName,
    workspacePromptContext,
    messages,
    latestUserInput,
    systemPrompt,
  }, deferred?.callbacks ?? callbacks, signal);

  await runAgentLoop({
    inferenceClient,
    messages,
    voters,
    input: latestUserInput,
    completionChecker: effectiveCompletionChecker
      ? {
        async check(context) {
          const result = await effectiveCompletionChecker.check(context);
          if (result.done) {
            deferred?.commit(context.lastResult.output);
          } else {
            deferred?.discard();
          }
          return result;
        },
      }
      : undefined,
    maxIterations: effectiveCompletionChecker ? maxIterations : undefined,
  }, callbacks);
}
