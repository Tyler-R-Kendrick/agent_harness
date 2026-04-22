import type { ICompletionChecker, IInferenceClient, IVoter } from 'logact';
import { browserInferenceEngine } from '../../services/browserInference';
import { formatBrowserInferenceResult, trimTextForLocalInference } from '../../services/browserInferenceRuntime';
import { toAiSdkMessages } from '../../services/chatComposition';
import { buildAgentSystemPrompt, resolveAgentScenario } from '../../services/agentPromptTemplates';
import { createHeuristicCompletionChecker, isExecutionTask } from 'ralph-loop';
import type { ChatMessage, HFModel } from '../../types';
import { runAgentLoop } from '../agent-loop';
import { createDeferredAgentCallbacks } from '../deferredCallbacks';
import { createReasoningStepSplitter } from '../reasoningSplitter';
import type { AgentStreamCallbacks } from '../types';

export const CODI_LABEL = 'Codi';
const MAX_CONTEXT_MESSAGES = 7;
const MAX_CODI_WORKSPACE_CONTEXT_CHARS = 4_000;
const MAX_CODI_MESSAGE_CHARS = 2_000;

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
  loopMessages,
}: {
  workspaceName: string;
  workspacePromptContext: string;
  messages: ChatMessage[];
  loopMessages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}): Array<{ role: string; content: string }> {
  const aiMessages = loopMessages
    ? loopMessages.map((message, index) => ({
      id: `loop-${index}`,
      role: message.role,
      parts: [{ type: 'text', text: message.content }],
    }))
    : toAiSdkMessages(messages);
  const latestText = loopMessages?.at(-1)?.content
    || messages.at(-1)?.streamedContent
    || messages.at(-1)?.content
    || workspacePromptContext;
  const scenario = resolveAgentScenario(latestText);

  return [
    {
      role: 'system',
      content: buildAgentSystemPrompt({
        workspaceName,
        goal: 'Help the user in the active workspace with concise, grounded collaboration.',
        scenario,
      }),
    },
    { role: 'system', content: `Active workspace: ${workspaceName}` },
    { role: 'system', content: trimTextForLocalInference(workspacePromptContext, MAX_CODI_WORKSPACE_CONTEXT_CHARS) },
    ...aiMessages.slice(-MAX_CONTEXT_MESSAGES).map((message) => ({
      role: message.role,
      content: trimTextForLocalInference(
        message.parts.map((part) => ('text' in part ? String(part.text) : '')).join(''),
        MAX_CODI_MESSAGE_CHARS,
      ),
    })),
  ];
}

function createCodiInferenceClient(
  model: HFModel,
  workspaceName: string,
  workspacePromptContext: string,
  messages: ChatMessage[],
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): IInferenceClient {
  return {
    async infer(busMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) {
      const prompt = buildCodiPrompt({ workspaceName, workspacePromptContext, messages, loopMessages: busMessages });
      let tokenBuffer = '';
      let inReasoning = false;
      const reasoningSplitter = createReasoningStepSplitter({
        markers: false,
        onStepStart: callbacks.onReasoningStep,
        onStepUpdate: callbacks.onReasoningStepUpdate,
        onStepEnd: callbacks.onReasoningStepEnd,
      });

      return new Promise<string>((resolve, reject) => {
        browserInferenceEngine.generate(
          {
            task: model.task,
            modelId: model.id,
            prompt,
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
              resolve(finalContent);
            },
            onError: (error) => {
              callbacks.onError?.(error);
              reject(error);
            },
          },
          signal,
        );
      });
    },
  };
}

export { wrapVoterWithCallbacks } from '../agent-loop';

export async function streamCodiChat(
  {
    model,
    messages,
    workspaceName,
    workspacePromptContext,
    voters = [],
    completionChecker,
    maxIterations = 5,
  }: {
    model: HFModel;
    messages: ChatMessage[];
    workspaceName: string;
    workspacePromptContext: string;
    /** Optional logact voters treated as external agents. Each voter's
     *  decision is surfaced via the onVoterStep* callbacks. */
    voters?: IVoter[];
    completionChecker?: ICompletionChecker;
    maxIterations?: number;
  },
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const latestInput = messages.at(-1)?.streamedContent || messages.at(-1)?.content || '';
  const effectiveCompletionChecker = completionChecker
    ?? (isExecutionTask(latestInput) ? createHeuristicCompletionChecker(latestInput) : undefined);
  const deferred = effectiveCompletionChecker ? createDeferredAgentCallbacks(callbacks) : null;
  const inferenceClient = createCodiInferenceClient(
    model,
    workspaceName,
    workspacePromptContext,
    messages,
    deferred?.callbacks ?? callbacks,
    signal,
  );

  await runAgentLoop({
    inferenceClient,
    messages,
    voters,
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