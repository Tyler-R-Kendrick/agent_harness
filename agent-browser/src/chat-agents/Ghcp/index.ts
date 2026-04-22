import type { ICompletionChecker, IInferenceClient, IVoter } from 'logact';
import { streamCopilotChat, type CopilotModelSummary, type CopilotRuntimeState } from '../../services/copilotApi';
import { toChatSdkTranscript } from '../../services/chatComposition';
import { createHeuristicCompletionChecker, isExecutionTask } from 'ralph-loop';
import type { ChatMessage } from '../../types';
import { createDeferredAgentCallbacks } from '../deferredCallbacks';
import { runAgentLoop } from '../agent-loop';
import { createReasoningStepSplitter } from '../reasoningSplitter';
import type { AgentStreamCallbacks } from '../types';

export const GHCP_LABEL = 'GHCP';

export function hasGhcpAccess(state: CopilotRuntimeState): boolean {
  return state.available && state.authenticated && state.models.length > 0;
}

export function resolveGhcpModelId(models: CopilotModelSummary[], selectedModelId: string): string {
  return models.some((model) => model.id === selectedModelId)
    ? selectedModelId
    : (models[0]?.id || '');
}

export function buildGhcpPrompt({
  workspaceName,
  workspacePromptContext,
  messages,
  latestUserInput,
  loopMessages,
}: {
  workspaceName: string;
  workspacePromptContext: string;
  messages: ChatMessage[];
  latestUserInput: string;
  loopMessages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
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

  return [
    'You are GHCP, a GitHub Copilot-backed agent for an agent-first browser. Be concise and clear.',
    `Active workspace: ${workspaceName}`,
    workspacePromptContext,
    transcript ? `Conversation transcript:\n${transcript}` : null,
    `Latest user request:\n${latestUserInput.trim()}`,
  ].filter(Boolean).join('\n\n');
}

// Pattern matching ###STEP: or ###SEARCH: marker lines emitted by the model
const TOKEN_MARKER_PATTERN = /^###(STEP|SEARCH):\s*.+$/i;

/**
 * Strip reasoning marker lines from a finished content string so that
 * `###STEP:` / `###SEARCH:` tags injected by the model don't appear in the
 * visible chat bubble when a Copilot `final` event is received.
 */
function filterMarkerLines(content: string): string {
  return content
    .split('\n')
    .filter((line) => !TOKEN_MARKER_PATTERN.test(line.trim()))
    .join('\n')
    .trim();
}

function createGhcpInferenceClient(
  {
    modelId,
    sessionId,
    workspaceName,
    workspacePromptContext,
    messages,
    latestUserInput,
  }: {
    modelId: string;
    sessionId: string;
    workspaceName: string;
    workspacePromptContext: string;
    messages: ChatMessage[];
    latestUserInput: string;
  },
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): IInferenceClient {
  return {
    async infer(busMessages) {
      let sawNdjsonStep = false;
      let visibleTokenBuffer = '';
      const reasoningSplitter = createReasoningStepSplitter({
        markers: true,
        onStepStart: (step) => {
          callbacks.onReasoningStep?.(step);
        },
        onStepUpdate: (id, patch) => callbacks.onReasoningStepUpdate?.(id, patch),
        onStepEnd: (id) => callbacks.onReasoningStepEnd?.(id),
      });

      let tokenLineBuffer = '';

      const processTokenLine = (line: string, trailingNewline: boolean) => {
        if (TOKEN_MARKER_PATTERN.test(line.trim())) {
          reasoningSplitter.push(line + '\n');
        } else {
          const token = trailingNewline ? `${line}\n` : line;
          visibleTokenBuffer += token;
          callbacks.onToken?.(token);
        }
      };

      const filteredOnToken = (delta: string) => {
        const combined = tokenLineBuffer + delta;
        const parts = combined.split('\n');
        tokenLineBuffer = parts.pop() ?? '';
        for (const line of parts) {
          processTokenLine(line, true);
        }
      };

      let resolvedContent = '';

      try {
        await streamCopilotChat(
          {
            modelId,
            sessionId,
            prompt: buildGhcpPrompt({ workspaceName, workspacePromptContext, messages, latestUserInput, loopMessages: busMessages }),
          },
          {
            onToken: filteredOnToken,
            onReasoning: (delta) => {
              if (!sawNdjsonStep) reasoningSplitter.push(delta);
              callbacks.onReasoning?.(delta);
            },
            onReasoningStep: (step) => {
              sawNdjsonStep = true;
              callbacks.onReasoningStep?.(step);
            },
            onReasoningStepUpdate: (id, patch) => callbacks.onReasoningStepUpdate?.(id, patch),
            onReasoningStepEnd: (id) => callbacks.onReasoningStepEnd?.(id),
            onDone: (finalContent) => {
              if (tokenLineBuffer) {
                processTokenLine(tokenLineBuffer, false);
                tokenLineBuffer = '';
              }
              if (!sawNdjsonStep) reasoningSplitter.finish();
              const cleanedFinalContent = finalContent ? filterMarkerLines(finalContent) || undefined : undefined;
              resolvedContent = cleanedFinalContent ?? visibleTokenBuffer.trim();
              callbacks.onDone?.(resolvedContent || undefined);
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

export async function streamGhcpChat(
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
  },
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const effectiveCompletionChecker = completionChecker
    ?? (isExecutionTask(latestUserInput) ? createHeuristicCompletionChecker(latestUserInput) : undefined);
  const deferred = effectiveCompletionChecker ? createDeferredAgentCallbacks(callbacks) : null;
  const inferenceClient = createGhcpInferenceClient({
    modelId,
    sessionId,
    workspaceName,
    workspacePromptContext,
    messages,
    latestUserInput,
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