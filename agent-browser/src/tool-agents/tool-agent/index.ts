import { tool, type LanguageModel, type ToolSet } from 'ai';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import { ClassicVoter } from 'logact';
import type { ICompletionChecker, IVoter } from 'logact';
import { createHeuristicCompletionChecker, isExecutionTask } from 'ralph-loop';
import { z } from 'zod';
import { buildDefaultToolInstructions, selectToolDescriptorsByIds, type ToolDescriptor } from '../../tools';
import { runToolAgent, type AgentRunCallbacks, type AgentRunResult } from '../../services/agentRunner';
import { runLocalToolCallExecutor } from '../../services/localToolCallExecutor';
import { runAgentLoop } from '../../chat-agents/agent-loop';
import { WEB_SEARCH_AGENT_ID, selectWebSearchAgentTools } from '../../chat-agents/WebSearch';
import { LOCAL_WEB_RESEARCH_AGENT_ID, selectLocalWebResearchAgentTools } from '../../chat-agents/LocalWebResearch';
import { RDF_WEB_SEARCH_AGENT_ID, selectRdfWebSearchAgentTools } from '../../chat-agents/SemanticSearch';
import { createObservedBus } from '../../services/observedAgentBus';
import { createCodeModeExecutor, type CodeModeExecutor } from './codeMode';

export const TOOL_AGENT_ID = 'tool-agent';
export const TOOL_AGENT_LABEL = 'Tool Agent';
export const GENERATED_TOOL_ROOT = '/workspace/.agent-browser/tools';

export type ToolPlanStep = {
  id: string;
  kind: 'call-tool';
  toolId: string;
  inputTemplate?: unknown;
  saveAs?: string;
  continueOnError?: boolean;
} | {
  id: string;
  kind: 'call-tool-plan';
  plan: ToolPlan;
  saveAs?: string;
  continueOnError?: boolean;
};

export interface ToolPlan {
  version: 1;
  goal: string;
  selectedToolIds: string[];
  steps: ToolPlanStep[];
  createdToolFiles: string[];
  actorToolAssignments?: Record<string, string[]>;
}

export interface GeneratedToolSource {
  id: string;
  label: string;
  description: string;
  path: string;
  source: string;
}

export interface ToolAgentWorkspaceIO {
  writeToolSource?: (file: GeneratedToolSource) => Promise<void> | void;
}

export interface ToolAgentRuntime {
  tools: ToolSet;
  descriptors: ToolDescriptor[];
  generatedTools?: ToolSet;
  generatedDescriptors?: ToolDescriptor[];
  workspace?: ToolAgentWorkspaceIO;
  codeMode?: CodeModeExecutor;
}

export interface ToolAgentEvent {
  kind: 'plan' | 'codemode' | 'tool-created' | 'tool-call' | 'tool-result';
  summary: string;
  branchId: string;
  parentBranchId?: string;
  payload?: unknown;
}

export interface RunToolPlanningAgentOptions {
  model: LanguageModel;
  messages: ModelMessage[];
  instructions: string;
  workspaceName?: string;
  capabilities?: { contextWindow: number; maxOutputTokens: number };
  signal?: AbortSignal;
  maxSteps?: number;
  voters?: IVoter[];
  completionChecker?: ICompletionChecker;
  maxIterations?: number;
  runtime: ToolAgentRuntime;
}

export type ToolPlanningCallbacks = AgentRunCallbacks & {
  onToolAgentEvent?: (event: ToolAgentEvent) => void;
  onBusEntry?: (entry: import('../../types').BusEntryStep) => void;
  onVoterStep?: import('../../types').VoterStep extends infer T ? (step: T) => void : never;
  onVoterStepUpdate?: (id: string, patch: Partial<import('../../types').VoterStep>) => void;
  onVoterStepEnd?: (id: string) => void;
  onIterationStep?: import('../../types').IterationStep extends infer T ? (step: T) => void : never;
  onIterationStepUpdate?: (id: string, patch: Partial<import('../../types').IterationStep>) => void;
  onIterationStepEnd?: (id: string) => void;
  onModelTurnStart?: (turnId: string, stepIndex: number) => void;
  onModelTurnEnd?: (
    turnId: string,
    text: string,
    parsedToolCall: { toolName: string; args: Record<string, unknown> } | null,
  ) => void;
};

type StepOutputMap = Record<string, { output?: unknown; error?: string }>;

const LOCATION_CONTEXT_TOOL_ORDER = [
  'webmcp:recall_user_context',
  'webmcp:read_browser_location',
  'webmcp:search_web',
  'webmcp:local_web_research',
  'webmcp:semantic_search',
  'webmcp:read_web_page',
  'cli',
  'webmcp:elicit_user_input',
] as const;

function messageContentToText(content: ModelMessage['content']): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return JSON.stringify(content);
  return content
    .map((part) => (part.type === 'text' ? part.text : `[${part.type}]`))
    .join('\n');
}

function getGoal(messages: readonly ModelMessage[]): string {
  const latest = [...messages].reverse().find((message) => message.role === 'user');
  return latest ? messageContentToText(latest.content) : 'Use the available tools to help the user.';
}

function normalizeGeneratedId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'generated-tool';
}

function allDescriptors(runtime: ToolAgentRuntime): ToolDescriptor[] {
  return [...runtime.descriptors, ...(runtime.generatedDescriptors ?? [])];
}

function allTools(runtime: ToolAgentRuntime): ToolSet {
  return { ...runtime.tools, ...(runtime.generatedTools ?? {}) } as ToolSet;
}

function scoreDescriptor(descriptor: ToolDescriptor, query: string): number {
  const q = query.toLowerCase();
  const terms = q.split(/[^a-z0-9]+/).filter((term) => term.length > 2);
  const haystacks = [
    [descriptor.id, 6],
    [descriptor.label, 5],
    [descriptor.description, 3],
    [descriptor.group, 2],
    [descriptor.subGroup ?? '', 2],
  ] as const;
  return haystacks.reduce((score, [value, weight]) => {
    const lowered = value.toLowerCase();
    const exact = lowered.includes(q) ? weight * 2 : 0;
    const termScore = terms.reduce((sum, term) => sum + (lowered.includes(term) ? weight : 0), 0);
    return score + exact + termScore;
  }, 0);
}

export function listTools(runtime: ToolAgentRuntime): ToolDescriptor[] {
  return allDescriptors(runtime);
}

export function findTool(runtime: ToolAgentRuntime, query: string, limit = 5): ToolDescriptor[] {
  const trimmed = query.trim();
  if (!trimmed) return listTools(runtime).slice(0, limit);
  return listTools(runtime)
    .map((descriptor, index) => ({ descriptor, index, score: scoreDescriptor(descriptor, trimmed) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map((candidate) => candidate.descriptor);
}

export function createStaticToolPlan(runtime: ToolAgentRuntime, goal: string, maxTools = 4): ToolPlan {
  const ranked = findTool(runtime, goal, maxTools);
  const availableTools = listTools(runtime);
  const webSearchToolIds = isWebSearchGoal(goal)
    ? selectWebSearchAgentTools(availableTools, goal)
    : [];
  const localWebResearchToolIds = isWebSearchGoal(goal)
    ? selectLocalWebResearchAgentTools(availableTools, goal)
    : [];
  const rdfWebSearchToolIds = isWebSearchGoal(goal)
    ? selectRdfWebSearchAgentTools(availableTools, goal)
    : [];
  const orderedLocationTools = isLocationDependentGoal(goal)
    ? LOCATION_CONTEXT_TOOL_ORDER
      .map((toolId) => availableTools.find((descriptor) => descriptor.id === toolId))
      .filter((descriptor): descriptor is ToolDescriptor => Boolean(descriptor))
    : [];
  const selected = [
    ...orderedLocationTools,
    ...(ranked.length ? ranked : availableTools).filter((descriptor) => (
      !orderedLocationTools.some((locationTool) => locationTool.id === descriptor.id)
    )),
  ].slice(0, Math.max(1, maxTools, orderedLocationTools.length));
  const selectedToolIds = selected.map((descriptor) => descriptor.id);
  return {
    version: 1,
    goal,
    selectedToolIds,
    steps: [],
    createdToolFiles: [],
    actorToolAssignments: {
      'tool-agent': [],
      'student-driver': [],
      'voter:teacher': [],
      'adversary-driver': [],
      'judge-decider': [],
      [WEB_SEARCH_AGENT_ID]: selectedToolIds.filter((toolId) => webSearchToolIds.includes(toolId)),
      [LOCAL_WEB_RESEARCH_AGENT_ID]: selectedToolIds.filter((toolId) => localWebResearchToolIds.includes(toolId)),
      [RDF_WEB_SEARCH_AGENT_ID]: selectedToolIds.filter((toolId) => rdfWebSearchToolIds.includes(toolId)),
      executor: selectedToolIds,
    },
  };
}

function isLocationDependentGoal(goal: string): boolean {
  return /\b(near me|nearby|restaurants?|theat(?:er|re)s?|bars?|cafes?|parks?|location|city|neighbou?rhood)\b/i.test(goal);
}

function isWebSearchGoal(goal: string): boolean {
  return isLocationDependentGoal(goal)
    || /\b(current|latest|recent|today|web|search|source|sources|cite|citations?|best|top|recommended|reviews?)\b/i.test(goal);
}

function createExecutionWorkflowVoters(selectedDescriptors: ToolDescriptor[]): IVoter[] {
  const selectedToolIds = selectedDescriptors.map((descriptor) => descriptor.id);
  const hasSelectedTools = selectedToolIds.length > 0;
  return [
    new ClassicVoter(
      'planner-decomposition',
      (action) => /succinct tasks/i.test(action) && /classification/i.test(action),
      'Planner did not classify and decompose the request before execution.',
      (_action, approve) => approve
        ? 'Planner classified the prompt and decomposed it into succinct execution tasks.'
        : 'Planner output is missing classification or task decomposition.',
    ),
    new ClassicVoter(
      'orchestrator-agent-selection',
      (action) => /registered agents/i.test(action) && /executor/i.test(action),
      'Orchestrator did not select registered agents for the task.',
      (_action, approve) => approve
        ? 'Orchestrator selected from registered agents before execution.'
        : 'Orchestrator output is missing registered-agent selection.',
    ),
    new ClassicVoter(
      'tool-agent-assignment',
      (action) => hasSelectedTools && selectedToolIds.every((toolId) => action.includes(toolId)),
      'Tool agent did not assign the active workspace tools needed for execution.',
      (_action, approve) => approve
        ? `Tool agent assigned active workspace tools: ${selectedToolIds.join(', ')}.`
        : 'Tool assignment did not reference every selected active workspace tool.',
    ),
  ];
}

function buildExecutionWorkflowIntent(
  plan: ToolPlan,
  selectedDescriptors: ToolDescriptor[],
  feedback: string | null,
): string {
  const selectedToolIds = selectedDescriptors.map((descriptor) => descriptor.id);
  return [
    'Execution workflow ready for LogAct.',
    'Classification: tool-enabled workspace task.',
    `Succinct tasks: ${plan.goal}`,
    `Registered agents: chat-agent, planner, router-agent, orchestrator, tool-agent, ${WEB_SEARCH_AGENT_ID}, ${LOCAL_WEB_RESEARCH_AGENT_ID}, ${RDF_WEB_SEARCH_AGENT_ID}, voter agents, executor.`,
    `Tool assignments: ${selectedToolIds.length ? selectedToolIds.join(', ') : '(none)'}.`,
    feedback ? `Completion feedback: ${feedback}` : null,
  ].filter(Boolean).join('\n');
}

function validateToolPlan(plan: ToolPlan): ToolPlan {
  if (plan.version !== 1) throw new TypeError('Unsupported ToolPlan version.');
  if (!Array.isArray(plan.steps)) throw new TypeError('ToolPlan steps must be an array.');
  if (!Array.isArray(plan.selectedToolIds)) throw new TypeError('ToolPlan selectedToolIds must be an array.');
  if (!Array.isArray(plan.createdToolFiles)) throw new TypeError('ToolPlan createdToolFiles must be an array.');
  return plan;
}

function resolveTemplate(value: unknown, outputs: StepOutputMap): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{\{steps\.([a-zA-Z0-9_-]+)\.output\}\}/g, (_, stepId: string) => {
      const output = outputs[stepId]?.output;
      return typeof output === 'string' ? output : JSON.stringify(output ?? null);
    });
  }
  if (Array.isArray(value)) return value.map((item) => resolveTemplate(item, outputs));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveTemplate(entry, outputs)]));
  }
  return value;
}

export async function callTool(runtime: ToolAgentRuntime, toolId: string, input: unknown): Promise<unknown> {
  const candidate = allTools(runtime)[toolId] as { execute?: (args: unknown) => unknown | Promise<unknown> } | undefined;
  if (!candidate || typeof candidate.execute !== 'function') {
    throw new TypeError(`Tool "${toolId}" is not available.`);
  }
  return candidate.execute(input ?? {});
}

export async function callToolPlan(
  runtime: ToolAgentRuntime,
  plan: ToolPlan,
  callbacks: ToolPlanningCallbacks = {},
  parentOutputs: StepOutputMap = {},
  parentBranchId = 'tool-agent',
): Promise<StepOutputMap> {
  const validated = validateToolPlan(plan);
  const outputs: StepOutputMap = {};
  for (const step of validated.steps) {
    const scopedOutputs = { ...parentOutputs, ...outputs };
      callbacks.onToolAgentEvent?.({
        kind: 'tool-call',
        summary: step.kind === 'call-tool' ? `Calling ${step.toolId}` : 'Calling nested tool plan',
        branchId: step.kind === 'call-tool' ? `tool:${step.toolId}` : `tool-plan:${step.id}`,
        parentBranchId,
        payload: step,
      });
    try {
      const output = step.kind === 'call-tool'
        ? await callTool(runtime, step.toolId, resolveTemplate(step.inputTemplate ?? {}, scopedOutputs))
        : await callToolPlan(runtime, step.plan, callbacks, scopedOutputs, parentBranchId);
      outputs[step.saveAs ?? step.id] = { output };
      callbacks.onToolAgentEvent?.({
        kind: 'tool-result',
        summary: step.kind === 'call-tool' ? `${step.toolId} complete` : 'Nested tool plan complete',
        branchId: step.kind === 'call-tool' ? `tool:${step.toolId}` : `tool-plan:${step.id}`,
        parentBranchId,
        payload: output,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outputs[step.saveAs ?? step.id] = { error: message };
      callbacks.onToolResult?.(step.kind, step, message, true, step.id);
      if (!step.continueOnError) throw error;
    }
  }
  return outputs;
}

export async function makeTool(
  runtime: ToolAgentRuntime,
  input: { id: string; description: string; label?: string },
  callbacks: ToolPlanningCallbacks = {},
): Promise<GeneratedToolSource> {
  const id = normalizeGeneratedId(input.id);
  const label = input.label ?? id;
  const path = `${GENERATED_TOOL_ROOT}/${id}.tool.ts`;
  const source = [
    `export const id = ${JSON.stringify(id)};`,
    `export const label = ${JSON.stringify(label)};`,
    `export const description = ${JSON.stringify(input.description)};`,
    'export async function execute(input: unknown) {',
    '  return { input, generated: true };',
    '}',
    '',
  ].join('\n');
  const generated = { id, label, description: input.description, path, source };
  const codeMode = runtime.codeMode ?? createCodeModeExecutor();
  const result = await codeMode.executeCode({
    code: `async () => (${JSON.stringify(generated)})`,
    bindings: [{ namespace: 'codemode', tools: {} as ToolSet }],
  });
  callbacks.onToolAgentEvent?.({
    kind: 'codemode',
    summary: result.error ? `CodeMode failed for ${id}` : `CodeMode generated ${id}`,
    branchId: 'codemode',
    parentBranchId: 'tool-agent',
    payload: result,
  });
  if (result.error) throw new TypeError(result.error);
  await runtime.workspace?.writeToolSource?.(generated);
  callbacks.onToolAgentEvent?.({
    kind: 'tool-created',
    summary: `Created ${path}`,
    branchId: `make-tool:${id}`,
    parentBranchId: 'codemode',
    payload: generated,
  });
  return generated;
}

export function createToolAgentTools(runtime: ToolAgentRuntime, callbacks: ToolPlanningCallbacks = {}): ToolSet {
  void callbacks;
  return {
    'list-tools': tool({
      description: 'List the tools available to the Tool Agent.',
      inputSchema: z.object({}),
      execute: async () => listTools(runtime),
    }),
    'find-tool': tool({
      description: 'Find tools by id, label, group, or description.',
      inputSchema: z.object({
        query: z.string(),
        limit: z.number().int().positive().optional(),
      }),
      execute: async ({ query, limit }) => findTool(runtime, query, limit),
    }),
    'plan-tools': tool({
      description: 'Create a static serialized tool execution plan.',
      inputSchema: z.object({
        goal: z.string(),
        maxTools: z.number().int().positive().optional(),
      }),
      execute: async ({ goal, maxTools }) => createStaticToolPlan(runtime, goal, maxTools),
    }),
  } as ToolSet;
}

export async function runToolPlanningAgent(
  options: RunToolPlanningAgentOptions,
  callbacks: ToolPlanningCallbacks,
): Promise<{ plan: ToolPlan; selectedDescriptors: ToolDescriptor[]; tools: ToolSet }> {
  const runtime = options.runtime;
  const goal = getGoal(options.messages);
  callbacks.onToolAgentEvent?.({
    kind: 'plan',
    summary: 'Tool Agent planning tool use',
    branchId: 'tool-agent',
    payload: { goal },
  });
  const plan = createStaticToolPlan(runtime, goal);
  const selectedDescriptors = selectToolDescriptorsByIds(allDescriptors(runtime), plan.selectedToolIds);
  return {
    plan,
    selectedDescriptors,
    tools: Object.fromEntries(plan.selectedToolIds
      .filter((id) => allTools(runtime)[id])
      .map((id) => [id, allTools(runtime)[id]])) as ToolSet,
  };
}

export async function runToolAgentExecutor(
  options: RunToolPlanningAgentOptions,
  plan: ToolPlan,
  selectedDescriptors: ToolDescriptor[],
  selectedTools: ToolSet,
  callbacks: ToolPlanningCallbacks,
): Promise<AgentRunResult> {
  if (plan.steps.length > 0) {
    const outputs = await callToolPlan(options.runtime, plan, callbacks);
    const text = JSON.stringify(outputs, null, 2);
    callbacks.onToken?.(text);
    callbacks.onDone?.(text);
    return { text, steps: plan.steps.length };
  }

  const modelProvider = (options.model as { provider?: string }).provider;
  const instructions = buildDefaultToolInstructions({
    workspaceName: options.workspaceName ?? 'Workspace',
    workspacePromptContext: options.instructions,
    descriptors: selectedDescriptors,
    selectedToolIds: selectedDescriptors.map((descriptor) => descriptor.id),
  });
  const task = options.messages.at(-1) ? messageContentToText(options.messages.at(-1)!.content) : '';
  const voters = [...createExecutionWorkflowVoters(selectedDescriptors), ...(options.voters ?? [])];
  const completionChecker = options.completionChecker
    ?? (isExecutionTask(task) ? createHeuristicCompletionChecker(task) : undefined);
  const maxIterations = options.maxIterations ?? 5;

  if (modelProvider === 'local') {
    return runLocalToolCallExecutor({
      model: options.model,
      tools: selectedTools,
      toolDescriptors: selectedDescriptors,
      instructions,
      messages: options.messages,
      signal: options.signal,
      maxSteps: Math.min(options.maxSteps ?? 20, 6),
      voters,
      completionChecker,
      maxIterations,
    }, callbacks);
  }

  const runOnce = (messages: ModelMessage[]) => runToolAgent({
    model: options.model,
    tools: selectedTools,
    instructions,
    messages,
    signal: options.signal,
    maxSteps: options.maxSteps,
  }, { ...callbacks, onToken: undefined, onDone: undefined });

  let captured: AgentRunResult = { text: '', steps: 0 };
  let failure: Error | null = null;
  let pendingFeedback: string | null = null;
  const observedBus = createObservedBus(callbacks.onBusEntry);

  await runAgentLoop({
    bus: observedBus,
    inferenceClient: {
      async infer(messages) {
        pendingFeedback = [...messages].reverse()
          .find((message) => message.role === 'user' && /you have not done the work yet|try again|feedback/i.test(message.content))
          ?.content
          ?? null;
        return buildExecutionWorkflowIntent(plan, selectedDescriptors, pendingFeedback);
      },
    },
    executor: {
      tier: 'llm-active',
      async execute() {
        try {
          const executorMessages = pendingFeedback
            ? [...options.messages, { role: 'system' as const, content: pendingFeedback }]
            : options.messages;
          captured = await runOnce(executorMessages);
          return captured.text;
        } catch (error) {
          failure = error instanceof Error ? error : new Error(String(error));
          throw failure;
        }
      },
    },
    messages: options.messages.map((message) => ({ content: messageContentToText(message.content) })),
    voters,
    completionChecker: completionChecker
      ? {
        async check(context) {
          const result = await completionChecker.check(context);
          return result;
        },
      }
      : undefined,
    maxIterations: completionChecker ? maxIterations : 1,
  }, callbacks);

  if (failure) throw failure;
  callbacks.onToken?.(captured.text);
  callbacks.onDone?.(captured.text);
  return captured;
}
