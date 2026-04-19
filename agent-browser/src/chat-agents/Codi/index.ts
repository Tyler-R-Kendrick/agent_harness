import { InMemoryAgentBus, LogActAgent, QuorumPolicy } from 'logact';
import type { IInferenceClient, IVoter, IntentPayload, IAgentBus, VotePayload } from 'logact';
import { browserInferenceEngine } from '../../services/browserInference';
import { formatBrowserInferenceResult } from '../../services/browserInferenceRuntime';
import { toAiSdkMessages } from '../../services/chatComposition';
import type { ChatMessage, HFModel, VoterStep } from '../../types';
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

function createCodiInferenceClient(
  model: HFModel,
  workspaceName: string,
  workspacePromptContext: string,
  messages: ChatMessage[],
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): IInferenceClient {
  return {
    async infer(_busMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) {
      const prompt = buildCodiPrompt({ workspaceName, workspacePromptContext, messages });
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

/**
 * Wraps an IVoter so that each call to `vote()` fires the voter step
 * callbacks in `AgentStreamCallbacks`.  The wrapper is the "external agent"
 * surface that drives the voters activity panel.
 */
export function wrapVoterWithCallbacks(
  voter: IVoter,
  callbacks: Pick<AgentStreamCallbacks, 'onVoterStep' | 'onVoterStepUpdate' | 'onVoterStepEnd'>,
): IVoter {
  return {
    id: voter.id,
    tier: voter.tier,
    async vote(intent: IntentPayload, bus: IAgentBus): Promise<VotePayload> {
      const stepId = `voter-${voter.id}-${intent.intentId}`;
      const step: VoterStep = {
        id: stepId,
        kind: 'agent',
        title: voter.id,
        voterId: voter.id,
        startedAt: Date.now(),
        status: 'active',
      };
      callbacks.onVoterStep?.(step);

      let result: VotePayload;
      try {
        result = await voter.vote(intent, bus);
      } catch (err) {
        callbacks.onVoterStepUpdate?.(stepId, {
          status: 'done',
          approve: false,
          body: `Error: ${err instanceof Error ? err.message : String(err)}`,
          endedAt: Date.now(),
        });
        callbacks.onVoterStepEnd?.(stepId);
        throw err;
      }

      callbacks.onVoterStepUpdate?.(stepId, {
        status: 'done',
        approve: result.approve,
        body: result.approve
          ? 'Approved'
          : `Rejected${result.reason ? `: ${result.reason}` : ''}`,
        endedAt: Date.now(),
      });
      callbacks.onVoterStepEnd?.(stepId);
      return result;
    },
  };
}

export async function streamCodiChat(
  {
    model,
    messages,
    workspaceName,
    workspacePromptContext,
    voters = [],
  }: {
    model: HFModel;
    messages: ChatMessage[];
    workspaceName: string;
    workspacePromptContext: string;
    /** Optional logact voters treated as external agents. Each voter's
     *  decision is surfaced via the onVoterStep* callbacks. */
    voters?: IVoter[];
  },
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const bus = new InMemoryAgentBus();
  const inferenceClient = createCodiInferenceClient(
    model,
    workspaceName,
    workspacePromptContext,
    messages,
    callbacks,
    signal,
  );

  const wrappedVoters = voters.map((v) => wrapVoterWithCallbacks(v, callbacks));

  const agent = new LogActAgent({
    bus,
    inferenceClient,
    voters: wrappedVoters,
    maxTurns: 1,
    quorumPolicy: voters.length > 0 ? QuorumPolicy.BooleanAnd : QuorumPolicy.OnByDefault,
  });

  const lastMessage = messages.at(-1);
  await agent.send(lastMessage?.content ?? '');
  try {
    await agent.run();
  } catch {
    // Error already forwarded to callbacks.onError inside createCodiInferenceClient
  }
}