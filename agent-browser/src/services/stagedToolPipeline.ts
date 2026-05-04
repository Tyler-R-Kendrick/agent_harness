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
  createStaticToolPlan,
  runToolPlanningAgent,
  type GeneratedToolSource,
  type ToolAgentEvent,
  type ToolAgentRuntime,
  type ToolPlan,
} from '../tool-agents/tool-agent';
import { runConfiguredExecutorAgent } from './executorAgent';
import { runLogActActorWorkflow } from './logactActorWorkflow';
import type { CustomEvaluationAgent } from './evaluationAgentRegistry';
import { resolveConversationSearchContext } from './conversationSearchContext';
import { buildWorkspaceSelfReflectionAnswer, isSelfReflectionTaskText } from './selfReflection';
import type { AdversaryToolReviewSettings } from './adversaryToolReview';

const CHAT_OUTPUT_TOKENS = 512;

export interface OrchestratorTask {
  id: string;
  prompt: string;
  source: string;
  dependsOnPrevious: boolean;
  verificationCriteria: string[];
}

export interface OrchestratorTaskPlan {
  mode: 'single' | 'parallel' | 'sequential';
  tasks: OrchestratorTask[];
}

type StageName =
  | 'chat-agent'
  | 'planner'
  | 'router-agent'
  | 'router'
  | 'orchestrator'
  | 'tool-agent'
  | 'group-select'
  | 'tool-select'
  | 'logact'
  | 'executor'
  | 'chat';

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
  evaluationAgents?: CustomEvaluationAgent[];
  negativeRubricTechniques?: string[];
  adversaryToolReviewSettings?: AdversaryToolReviewSettings;
  onNegativeRubricTechnique?: (technique: string) => void;
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
    onAgentHandoff?: (fromAgentId: string, toAgentId: string, summary: string) => void;
    onToolAgentEvent?: (event: ToolAgentEvent) => void;
  };

type StreamableModel = {
  doGenerate?: (options: unknown) => Promise<LanguageModelV3GenerateResult>;
  doStream?: (options: unknown) => Promise<{ stream: ReadableStream<LanguageModelV3StreamPart> }>;
};

function agentMeta(model: LanguageModel, agentId: string, agentLabel: string): StageMeta {
  const candidate = model as { provider?: string; modelId?: string; id?: string };
  return {
    agentId,
    agentLabel,
    modelProvider: candidate.provider ?? 'unknown',
    modelId: candidate.modelId ?? candidate.id ?? candidate.provider ?? 'unknown',
  };
}

function modelMeta(model: LanguageModel): StageMeta {
  return agentMeta(model, TOOL_AGENT_ID, TOOL_AGENT_LABEL);
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

function buildVerificationCriteria(task: string): string[] {
  const criteria = [
    'Final answer must answer the current user request.',
    'Final answer must not expose internal AgentBus or process summaries.',
  ];
  const searchLike = /\b(best|top|worst|closest|most popular|recommend|recommendations?|reviews?|showtimes?|near me|nearby|around me|local|current|latest|search|find)\b/i.test(task);
  if (searchLike) {
    criteria.push(
      'Answer must contain actual named entities or direct task outputs supported by evidence.',
      'Each linked item must be a specific instance of the current requested subject, not a generic category, site section, navigation label, or content type.',
      'Entity links must be source-backed and entity-specific when links are available.',
      'Entities, facts, and output structure must match the current requested subject.',
      'Generic page/navigation labels are forbidden as final answers.',
    );
  }
  if (searchLike && /\b(near me|nearby|around me|close to me|in my area|local|near us|around us)\b/i.test(task)) {
    criteria.splice(4, 0, 'Nearby results must include per-entity geographic, address, distance, or proximity evidence for the resolved location.');
  }
  if (searchLike && /\b(best|top|worst|closest|popular|recommend|recommendations?)\b/i.test(task)) {
    criteria.push('Ranking claims must be grounded in source evidence appropriate to the requested ranking goal.');
  }
  return criteria;
}

export function planOrchestratorTasks(
  messages: ModelMessage[],
  workspaceName = 'Workspace',
): OrchestratorTaskPlan {
  const rawTask = messageContentToText(messages.at(-1)?.content ?? 'Use the available tools to help the user.')
    .replace(/\s+/g, ' ')
    .trim();
  const sequential = /\b(first|then|next|after|before|finally)\b/i.test(rawTask);
  const taskSources = splitTaskSource(rawTask, sequential);
  const mode: OrchestratorTaskPlan['mode'] = taskSources.length <= 1
    ? 'single'
    : sequential
      ? 'sequential'
      : 'parallel';
  return {
    mode,
    tasks: taskSources.map((source, index) => {
      const dependsOnPrevious = mode === 'sequential' && index > 0;
      const verificationCriteria = buildVerificationCriteria(source);
      return {
        id: `task-${index + 1}`,
        source,
        dependsOnPrevious,
        verificationCriteria,
        prompt: [
          `Orchestrator task ${index + 1} of ${taskSources.length} (${mode}).`,
          `Workspace: ${workspaceName}.`,
          `Original request: ${rawTask}`,
          `Enhanced task prompt: ${source}`,
          dependsOnPrevious ? 'Sequence dependency: use prior task results before starting this task.' : null,
          'Verification criteria:',
          ...verificationCriteria.map((criterion) => `- ${criterion}`),
          'Completion contract: write candidate design, votes, judge decision, execution result, and any recovery back to AgentBus.',
        ].filter(Boolean).join('\n'),
      };
    }),
  };
}

function splitTaskSource(rawTask: string, sequential: boolean): string[] {
  const withoutLeadingOrder = rawTask.replace(/^\s*(first|then|next|finally)\s+/i, '');
  const separator = sequential
    ? /\s*(?:,\s*)?\b(?:then|next|finally)\b\s*/i
    : /\s+\b(?:and|also)\b\s+/i;
  const pieces = withoutLeadingOrder
    .split(separator)
    .map((piece) => piece.replace(/^\s*(first|then|next|finally)\s+/i, '').trim())
    .map((piece) => piece.replace(/[.。]+$/u, '').trim())
    .filter(Boolean);
  return pieces.length > 0 ? pieces : [rawTask];
}

function messagesForOrchestratorTask(messages: ModelMessage[], task: OrchestratorTask): ModelMessage[] {
  const priorMessages = messages.slice(0, -1);
  return [...priorMessages, { role: 'user', content: task.prompt }];
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
  const rawLatestTask = messageContentToText(options.messages.at(-1)?.content ?? '');
  if (isSelfReflectionTaskText(rawLatestTask)) {
    const chatMeta = agentMeta(options.model, 'chat-agent', 'Chat Agent');
    const answer = buildWorkspaceSelfReflectionAnswer({
      task: rawLatestTask,
      workspaceName: options.workspaceName,
      workspacePromptContext: options.instructions,
      toolDescriptors: options.toolDescriptors,
    });
    callbacks.onStageStart?.('chat', 'Answering self-reflection from workspace inventory.', chatMeta);
    callbacks.onStageToken?.('chat', answer, chatMeta);
    callbacks.onStageComplete?.('chat', answer, chatMeta);
    callbacks.onToken?.(answer);
    callbacks.onDone?.(answer);
    return { text: answer, steps: 1 };
  }

  if (options.toolDescriptors.length === 0 || Object.keys(options.tools).length === 0) {
    return runDirectChat(options, callbacks);
  }

  const conversationResolution = resolveConversationSearchContext(options.messages);
  const pipelineMessages = conversationResolution.needsClarification
    ? options.messages
    : conversationResolution.messages;
  const chatMeta = agentMeta(options.model, 'chat-agent', 'Chat Agent');
  const orchestratorMeta = agentMeta(options.model, 'orchestrator', 'Orchestrator Agent');
  const executorMeta = agentMeta(options.model, 'executor', 'Executor Agent');
  const orchestrated = planOrchestratorTasks(pipelineMessages, options.workspaceName);

  emitToolAgentStages(callbacks, 'chat-agent', 'Receiving the user prompt and delegating planning.', chatMeta);
  callbacks.onAgentHandoff?.('chat-agent', 'orchestrator', 'Agent handoff: classify the prompt, decompose the task, and choose registered agents.');
  emitToolAgentStages(callbacks, 'orchestrator', [
    'Registered agents available for this task:',
    'chat-agent, orchestrator, dynamic LogAct actors, executor.',
    'Tool selection will be logged by the LogAct tool-agent driver.',
    `Execution mode: ${orchestrated.mode}.`,
    ...orchestrated.tasks.map((task) => `${task.id}: ${task.source}${task.dependsOnPrevious ? ' (after previous task)' : ''}`),
  ].join('\n'), orchestratorMeta);

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
      if (event.kind !== 'tool-call' && event.kind !== 'tool-result') {
        return;
      }
      const subStageMeta = eventToSubStage(event, options.model);
      if (event.branchId === 'tool-agent' || event.parentBranchId === 'tool-agent') {
        return;
      }
      const targetStage = event.parentBranchId === 'execute-plan' || event.parentBranchId === 'executor'
        ? 'executor'
        : 'tool-select';
      callbacks.onStageStart?.(targetStage, event.summary, subStageMeta);
      callbacks.onStageToken?.(targetStage, event.summary, subStageMeta);
      callbacks.onStageComplete?.(targetStage, event.summary, subStageMeta);
    },
  };

  callbacks.onAgentHandoff?.('orchestrator', 'logact', 'Agent handoff: submit the tool-aware workflow to the LogAct AgentBus.');
  callbacks.onStageToken?.('orchestrator', [
    `Execution mode: ${orchestrated.mode}.`,
    `State machine pending: ${orchestrated.tasks.map((task) => task.id).join(', ')}.`,
  ].join('\n'), orchestratorMeta);

  let executorStarted = false;
  const beginExecutor = () => {
    if (executorStarted) return;
    executorStarted = true;
    callbacks.onStageStart?.('executor', 'Executing committed LogAct plan.', executorMeta);
  };

  try {
    const runTask = (task: OrchestratorTask) => {
      const taskMessages = messagesForOrchestratorTask(pipelineMessages, task);
      const taskCallbacks = callbacksForOrchestratorTask(planningCallbacks, task, orchestrated.tasks.length > 1);
      const fallbackSelection = createFallbackToolSelection(runtime, task.source, options.maxTools);
      return runLogActActorWorkflow({
        messages: taskMessages,
        instructions: options.instructions,
        workspaceName: options.workspaceName,
        plan: fallbackSelection.plan,
        selectedDescriptors: fallbackSelection.selectedDescriptors,
        selectedTools: fallbackSelection.selectedTools,
        verificationCriteria: task.verificationCriteria,
        selectTools: async ({ messages }) => {
          const planned = await runToolPlanningAgent({
            model: options.model,
            messages,
            instructions: options.instructions,
            workspaceName: options.workspaceName,
            capabilities: options.capabilities,
            signal: options.signal,
            maxSteps: options.maxSteps,
            runtime,
          }, taskCallbacks);
          return {
            plan: planned.plan,
            selectedDescriptors: planned.selectedDescriptors,
            selectedTools: planned.tools,
          };
        },
        negativeRubricTechniques: options.negativeRubricTechniques,
        adversaryToolReviewSettings: options.adversaryToolReviewSettings,
        customTeacherInstructions: (options.evaluationAgents ?? [])
          .filter((agent) => agent.enabled && agent.kind === 'teacher')
          .map((agent) => agent.instructions),
        customJudgeRubricCriteria: (options.evaluationAgents ?? [])
          .filter((agent) => agent.enabled && agent.kind === 'judge')
          .flatMap((agent) => agent.rubricCriteria ?? [agent.instructions]),
        onNegativeRubricTechnique: options.onNegativeRubricTechnique,
        onExecutorStart: beginExecutor,
        execute: (context) => {
          beginExecutor();
          return runConfiguredExecutorAgent({
            ...options,
            messages: taskMessages,
            runtime,
          }, context.plan, context.selectedDescriptors, context.selectedTools, {
            ...taskCallbacks,
            onBusEntry: undefined,
            onDone: undefined,
          }, context);
        },
      }, taskCallbacks);
    };

    const taskResults: AgentRunResult[] = [];
    if (orchestrated.mode === 'sequential') {
      for (const task of orchestrated.tasks) {
        callbacks.onStageToken?.('orchestrator', `State machine running: ${task.id}.`, orchestratorMeta);
        const taskResult = await runTask(task);
        taskResults.push(taskResult);
        callbacks.onStageToken?.('orchestrator', `State machine completed: ${task.id}.`, orchestratorMeta);
        if (taskResult.failed || taskResult.blocked || taskResult.needsUserInput) break;
      }
    } else {
      taskResults.push(...await Promise.all(orchestrated.tasks.map((task) => runTask(task))));
      callbacks.onStageToken?.('orchestrator', `State machine completed: ${orchestrated.tasks.map((task) => task.id).join(', ')}.`, orchestratorMeta);
    }

    const result = combineTaskResults(taskResults);
    callbacks.onStageComplete?.('orchestrator', [
      `Execution mode: ${orchestrated.mode}.`,
      `State machine completed: ${orchestrated.tasks.map((task) => task.id).join(', ')}.`,
    ].join('\n'), orchestratorMeta);
    if (executorStarted) {
      callbacks.onStageComplete?.('executor', result.text, executorMeta);
    }
    callbacks.onDone?.(result.text);
    return result;
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    if (executorStarted) {
      callbacks.onStageError?.('executor', wrapped, executorMeta);
    } else {
      callbacks.onStageError?.('orchestrator', wrapped, orchestratorMeta);
    }
    throw wrapped;
  }
}

function createFallbackToolSelection(
  runtime: ToolAgentRuntime,
  goal: string,
  maxTools?: number,
): { plan: ToolPlan; selectedDescriptors: ToolDescriptor[]; selectedTools: ToolSet } {
  const plan = createStaticToolPlan(runtime, goal, maxTools);
  const selectedDescriptors = selectToolDescriptorsByIds(runtime.descriptors, plan.selectedToolIds);
  const selectedTools = Object.fromEntries(plan.selectedToolIds
    .filter((id) => runtime.tools[id])
    .map((id) => [id, runtime.tools[id]])) as ToolSet;
  return { plan, selectedDescriptors, selectedTools };
}

function callbacksForOrchestratorTask(
  callbacks: StagedToolPipelineCallbacks,
  task: OrchestratorTask,
  scope: boolean,
): StagedToolPipelineCallbacks {
  if (!scope) return callbacks;
  const scopeId = (id: string) => `${task.id}:${id}`;
  return {
    ...callbacks,
    onBusEntry: (entry) => callbacks.onBusEntry?.({
      ...entry,
      id: scopeId(entry.id),
      branchId: entry.branchId ? `${entry.branchId}:${task.id}` : entry.branchId,
    }),
    onVoterStep: (step) => callbacks.onVoterStep?.({
      ...step,
      id: scopeId(step.id),
      title: `${task.id} · ${step.title}`,
    }),
    onVoterStepUpdate: (id, patch) => callbacks.onVoterStepUpdate?.(scopeId(id), patch),
    onVoterStepEnd: (id) => callbacks.onVoterStepEnd?.(scopeId(id)),
    onAgentHandoff: (fromAgentId, toAgentId, summary) => (
      callbacks.onAgentHandoff?.(fromAgentId, toAgentId, `${task.id}: ${summary}`)
    ),
  };
}

function combineTaskResults(results: AgentRunResult[]): AgentRunResult {
  const blocked = results.find((result) => result.blocked || result.needsUserInput);
  const failed = results.find((result) => result.failed);
  const searchTurnContext = [...results].reverse().find((result) => result.searchTurnContext)?.searchTurnContext;
  return {
    text: results.map((result) => result.text).join('\n\n'),
    steps: results.reduce((sum, result) => sum + result.steps, 0),
    ...(searchTurnContext ? { searchTurnContext } : {}),
    ...(blocked ? {
      blocked: true,
      needsUserInput: true,
      elicitation: blocked.elicitation,
    } : {}),
    ...(failed ? {
      failed: true,
      error: results
        .filter((result) => result.failed)
        .map((result) => result.error ?? result.text)
        .join('\n'),
    } : {}),
  };
}

export function selectStageDescriptors(
  toolDescriptors: ToolDescriptor[],
  toolIds: string[],
): ToolDescriptor[] {
  return selectToolDescriptorsByIds(toolDescriptors, toolIds);
}
