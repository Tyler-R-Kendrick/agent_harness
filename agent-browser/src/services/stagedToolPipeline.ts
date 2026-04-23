import type { LanguageModel, ToolSet } from 'ai';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import type { ICompletionChecker, IVoter } from 'logact';
import type { LanguageModelV3GenerateResult, LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { runToolAgent, type AgentRunCallbacks, type AgentRunResult } from './agentRunner';
import type { AgentStreamCallbacks } from '../chat-agents/types';
import { buildAgentSystemPrompt, resolveAgentScenario } from './agentPromptTemplates';
import { createPromptBudget, fitTextToTokenBudget } from './promptBudget';
import type { ModelCapabilities } from './agentProvider';
import { selectToolDescriptorsByIds, type ToolDescriptor } from '../tools';
import type { BusEntryStep } from '../types';
import {
  TOOL_AGENT_ID,
  TOOL_AGENT_LABEL,
  runToolAgentExecutor,
  runToolPlanningAgent,
  type GeneratedToolSource,
  type ToolAgentEvent,
  type ToolAgentRuntime,
} from '../tool-agents/tool-agent';

const CHAT_OUTPUT_TOKENS = 512;

type StageName = 'router' | 'group-select' | 'tool-select' | 'executor' | 'chat';

export interface StageMeta {
  subStageId?: string;
  parentStageId?: string;
  label?: string;
  agentId?: string;
  agentLabel?: string;
  modelId?: string;
  modelProvider?: string;
  branchId?: string;
  parentBranchId?: string;
}

export type StagedToolPipelineOptions = {
  model: LanguageModel;
  tools: ToolSet;
  toolDescriptors: ToolDescriptor[];
  instructions: string;
  messages: ModelMessage[];
  workspaceName?: string;
  capabilities: Pick<ModelCapabilities, 'contextWindow' | 'maxOutputTokens'>;
  signal?: AbortSignal;
  maxSteps?: number;
  maxGroups?: number;
  maxTools?: number;
  completionChecker?: ICompletionChecker;
  maxIterations?: number;
  voters?: IVoter[];
  onGeneratedTool?: (file: GeneratedToolSource) => Promise<void> | void;
};

export type StagedToolPipelineCallbacks = AgentRunCallbacks
  & Pick<AgentStreamCallbacks,
    'onVoterStep'
    | 'onVoterStepUpdate'
    | 'onVoterStepEnd'
    | 'onIterationStep'
    | 'onIterationStepUpdate'
    | 'onIterationStepEnd'
  >
  & {
    onBusEntry?: (entry: BusEntryStep) => void;
    onModelTurnStart?: (turnId: string, stepIndex: number) => void;
    onModelTurnEnd?: (
      turnId: string,
      text: string,
      parsedToolCall: { toolName: string; args: Record<string, unknown> } | null,
    ) => void;
    onStageStart?: (stage: StageName, detail: string, meta?: StageMeta) => void;
    onStageToken?: (stage: StageName, delta: string, meta?: StageMeta) => void;
    onStageComplete?: (stage: StageName, text: string, meta?: StageMeta) => void;
    onStageError?: (stage: StageName, error: Error, meta?: StageMeta) => void;
    onToolAgentEvent?: (event: ToolAgentEvent) => void;
  };

type StreamableModel = {
  doGenerate?: (options: unknown) => Promise<LanguageModelV3GenerateResult>;
  doStream?: (options: unknown) => Promise<{ stream: ReadableStream<LanguageModelV3StreamPart> }>;
};

function modelMeta(model: LanguageModel): StageMeta {
  const candidate = model as { provider?: string; modelId?: string; id?: string };
  return {
    agentId: TOOL_AGENT_ID,
    agentLabel: TOOL_AGENT_LABEL,
    modelProvider: candidate.provider ?? 'unknown',
    modelId: candidate.modelId ?? candidate.id ?? candidate.provider ?? 'unknown',
  };
}

function messageContentToText(content: ModelMessage['content']): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return JSON.stringify(content);
  return content
    .map((part) => (part.type === 'text' ? part.text : `[${part.type}]`))
    .join('\n');
}

function formatMessages(messages: ModelMessage[]): string {
  return messages
    .slice(-6)
    .map((message) => `[${message.role}]\n${messageContentToText(message.content)}`)
    .join('\n\n');
}

function extractTextFromGenerateResult(result: LanguageModelV3GenerateResult): string {
  return result.content
    .filter((part): part is Extract<(typeof result.content)[number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

async function runDirectChat(
  options: StagedToolPipelineOptions,
  callbacks: StagedToolPipelineCallbacks,
): Promise<AgentRunResult> {
  const transcript = formatMessages(options.messages);
  const budget = createPromptBudget({
    contextWindow: options.capabilities.contextWindow,
    maxOutputTokens: CHAT_OUTPUT_TOKENS,
  });
  const system = [
    buildAgentSystemPrompt({
      workspaceName: options.workspaceName,
      goal: 'Answer the request directly without tools.',
      scenario: resolveAgentScenario(transcript),
    }),
    '## Workspace Context',
    fitTextToTokenBudget(options.instructions, budget.maxInputTokens),
  ].join('\n\n');
  const prompt = [
    { role: 'system', content: system },
    { role: 'user', content: [{ type: 'text', text: fitTextToTokenBudget(transcript, budget.maxInputTokens) }] },
  ];
  callbacks.onStageStart?.('chat', 'Answering directly without tools.', modelMeta(options.model));
  try {
    const streamable = options.model as unknown as StreamableModel;
    let text = '';
    if (typeof streamable.doStream === 'function') {
      const result = await streamable.doStream({ abortSignal: options.signal, prompt, tools: [] });
      const reader = result.stream.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value.type === 'text-delta') {
          text += value.delta;
          callbacks.onStageToken?.('chat', value.delta, modelMeta(options.model));
        }
        if (value.type === 'error') {
          throw value.error instanceof Error ? value.error : new Error(String(value.error));
        }
      }
    } else if (typeof streamable.doGenerate === 'function') {
      text = extractTextFromGenerateResult(await streamable.doGenerate({ abortSignal: options.signal, prompt, tools: [] }));
      callbacks.onStageToken?.('chat', text, modelMeta(options.model));
    } else {
      const result = await runToolAgent({
        model: options.model,
        tools: {},
        instructions: system,
        messages: options.messages,
        signal: options.signal,
        maxSteps: 1,
      }, callbacks);
      text = result.text;
    }
    callbacks.onStageComplete?.('chat', text, modelMeta(options.model));
    callbacks.onToken?.(text);
    callbacks.onDone?.(text);
    return { text, steps: 1 };
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    callbacks.onStageError?.('chat', wrapped, modelMeta(options.model));
    throw wrapped;
  }
}

function emitToolAgentStages(
  callbacks: StagedToolPipelineCallbacks,
  stage: StageName,
  detail: string,
  meta: StageMeta,
): void {
  callbacks.onStageStart?.(stage, detail, meta);
  callbacks.onStageToken?.(stage, detail, meta);
  callbacks.onStageComplete?.(stage, detail, meta);
}

function eventToSubStage(event: ToolAgentEvent, model: LanguageModel): StageMeta {
  return {
    ...modelMeta(model),
    subStageId: event.branchId,
    parentStageId: event.parentBranchId ?? 'tool-agent',
    label: event.branchId === 'codemode' ? 'CodeMode' : event.branchId,
    branchId: event.branchId,
    parentBranchId: event.parentBranchId,
  };
}

export async function runStagedToolPipeline(
  options: StagedToolPipelineOptions,
  callbacks: StagedToolPipelineCallbacks,
): Promise<AgentRunResult> {
  if (options.toolDescriptors.length === 0 || Object.keys(options.tools).length === 0) {
    return runDirectChat(options, callbacks);
  }

  const meta = modelMeta(options.model);
  emitToolAgentStages(callbacks, 'router', 'Routing request through Tool Agent.', meta);

  const runtime: ToolAgentRuntime = {
    tools: options.tools,
    descriptors: options.toolDescriptors,
    workspace: {
      writeToolSource: options.onGeneratedTool,
    },
  };

  const planningCallbacks: StagedToolPipelineCallbacks = {
    ...callbacks,
    onToolAgentEvent: (event) => {
      callbacks.onToolAgentEvent?.(event);
      const subStageMeta = eventToSubStage(event, options.model);
      if (event.branchId === 'tool-agent') {
        return;
      }
      callbacks.onStageStart?.('tool-select', event.summary, subStageMeta);
      callbacks.onStageToken?.('tool-select', event.summary, subStageMeta);
      callbacks.onStageComplete?.('tool-select', event.summary, subStageMeta);
    },
  };

  const planned = await runToolPlanningAgent({
    model: options.model,
    messages: options.messages,
    instructions: options.instructions,
    workspaceName: options.workspaceName,
    capabilities: options.capabilities,
    signal: options.signal,
    maxSteps: options.maxSteps,
    runtime,
  }, planningCallbacks);

  emitToolAgentStages(callbacks, 'group-select', `Selected ${planned.selectedDescriptors.length} tool candidate${planned.selectedDescriptors.length === 1 ? '' : 's'}.`, meta);
  emitToolAgentStages(callbacks, 'tool-select', JSON.stringify(planned.plan, null, 2), meta);

  callbacks.onStageStart?.('executor', 'Executing Tool Agent plan.', meta);
  try {
    const result = await runToolAgentExecutor({
      ...options,
      runtime,
    }, planned.plan, planned.selectedDescriptors, planned.tools, planningCallbacks);
    callbacks.onStageComplete?.('executor', result.text, meta);
    return result;
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    callbacks.onStageError?.('executor', wrapped, meta);
    throw wrapped;
  }
}

export function selectStageDescriptors(
  toolDescriptors: ToolDescriptor[],
  toolIds: string[],
): ToolDescriptor[] {
  return selectToolDescriptorsByIds(toolDescriptors, toolIds);
}
