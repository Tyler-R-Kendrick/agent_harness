import type { LanguageModel, ToolSet } from 'ai';
import type { LanguageModelV3GenerateResult, LanguageModelV3StreamPart } from '@ai-sdk/provider';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import { runAgentLoop } from '../chat-agents/agent-loop';
import { buildDelegationWorkerPrompt } from './agentPromptTemplates';
import { fitTextToTokenBudget } from './promptBudget';
import type { ModelCapabilities } from './agentProvider';
import { createHeuristicCompletionChecker } from 'ralph-loop';
import { ClassicVoter, InMemoryAgentBus, PayloadType } from 'logact';
import type { Entry, IVoter } from 'logact';
import type { BusEntryStep, VoterStep } from '../types';
import { createObservedBus, summarisePayload } from './observedAgentBus';
import { runStagedToolPipeline, type StagedToolPipelineCallbacks } from './stagedToolPipeline';
import { PLAN_FILE_PATH, renderPlanMarkdown, updateTaskStatus } from './planFile';
import { buildTaskPlanPrompt, parseTaskPlan, type PlannedTask, type PlannerToolDescriptor, type TaskPlan, type TaskStatus } from './taskPlanner';
import { evaluateTaskValidations } from './taskValidation';
import { selectToolDescriptorsByIds, selectToolsByIds, type ToolDescriptor } from '../tools';

type StreamableModel = {
  doGenerate?: (options: unknown) => Promise<LanguageModelV3GenerateResult>;
  doStream?: (options: unknown) => Promise<{ stream: ReadableStream<LanguageModelV3StreamPart> }>;
};

export type ParallelDelegationStepId = 'coordinator' | 'breakdown-agent' | 'assignment-agent' | 'validation-agent';

export type ParallelDelegationCallbacks = {
  onStepStart?: (stepId: ParallelDelegationStepId, title: string, body: string) => void;
  onStepToken?: (stepId: ParallelDelegationStepId, delta: string) => void;
  onStepComplete?: (stepId: ParallelDelegationStepId, text: string) => void;
  /** Voter ensemble lifecycle, mirrors stagedToolPipeline. */
  onVoterStep?: (step: VoterStep) => void;
  onVoterStepUpdate?: (id: string, patch: Partial<VoterStep>) => void;
  onVoterStepEnd?: (id: string) => void;
  /** Fired for every entry appended to the underlying AgentBus. */
  onBusEntry?: (entry: BusEntryStep) => void;
  onToolCall?: StagedToolPipelineCallbacks['onToolCall'];
  onToolResult?: StagedToolPipelineCallbacks['onToolResult'];
  onIterationStep?: StagedToolPipelineCallbacks['onIterationStep'];
  onIterationStepUpdate?: StagedToolPipelineCallbacks['onIterationStepUpdate'];
  onIterationStepEnd?: StagedToolPipelineCallbacks['onIterationStepEnd'];
  /**
   * Per-task staged-pipeline planning surface. Forwarded so each subagent's
   * `router` / `group-select` / `tool-select` (incl. per-group sub-stages)
   * appear in the unified ProcessLog graph instead of only AgentBus rows.
   */
  onStageStart?: StagedToolPipelineCallbacks['onStageStart'];
  onStageToken?: StagedToolPipelineCallbacks['onStageToken'];
  onStageComplete?: StagedToolPipelineCallbacks['onStageComplete'];
  onStageError?: StagedToolPipelineCallbacks['onStageError'];
  onPlanUpdate?: (markdown: string, plan: TaskPlan) => void;
  onTaskStatus?: (task: PlannedTask, status: TaskStatus, notes?: string) => void;
  onDone?: (text: string) => void;
  onError?: (error: Error) => void;
};

export type ParallelDelegationExecutionOptions = {
  tools: ToolSet;
  toolDescriptors: ToolDescriptor[];
  instructions: string;
  messages: ModelMessage[];
  voters?: IVoter[];
  maxIterations?: number;
  maxTaskConcurrency?: number;
  writePlanFile?: (path: string, content: string) => Promise<unknown> | unknown;
  listWorkspacePaths?: () => Promise<string[]> | string[];
  runShellCommand?: (command: string) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
};

export type ParallelDelegationWorkflowOptions = {
  model: LanguageModel;
  prompt: string;
  workspaceName: string;
  capabilities: Pick<ModelCapabilities, 'provider' | 'contextWindow' | 'maxOutputTokens'>;
  signal?: AbortSignal;
  execution?: ParallelDelegationExecutionOptions;
};

const OPEN_THINK_TAG = '<think>';
const CLOSE_THINK_TAG = '</think>';

type SectionKey = 'problem' | 'breakdown' | 'assignment' | 'validation';

type DelegationPlanResult = {
  problemBrief: string;
  coordinatorProblem: string;
  outputs: Record<Exclude<ParallelDelegationStepId, 'coordinator'>, string>;
  votes: DelegationVote[];
  busEntries: Entry[];
  steps: number;
};

type ExecutedTaskResult = {
  task: PlannedTask;
  text: string;
  validationFeedback: string;
};

export const DELEGATION_SECTION_MARKERS: Record<SectionKey, string> = {
  problem: '===PROBLEM===',
  breakdown: '===BREAKDOWN===',
  assignment: '===ASSIGNMENT===',
  validation: '===VALIDATION===',
};

const SECTION_TO_STEP: Record<Exclude<SectionKey, 'problem'>, Exclude<ParallelDelegationStepId, 'coordinator'>> = {
  breakdown: 'breakdown-agent',
  assignment: 'assignment-agent',
  validation: 'validation-agent',
};

const SECTION_STEP_META: Record<Exclude<SectionKey, 'problem'>, { title: string; body: string }> = {
  breakdown: {
    title: 'Breakdown subagent',
    body: 'Breaking the problem into the smallest parallel tracks.',
  },
  assignment: {
    title: 'Assignment subagent',
    body: 'Assigning each track to a focused subagent role.',
  },
  validation: {
    title: 'Validation subagent',
    body: 'Defining success checks and coordination risks.',
  },
};

function emitSectionStepStart(
  callbacks: ParallelDelegationCallbacks,
  startedSections: Set<Exclude<SectionKey, 'problem'>>,
  section: Exclude<SectionKey, 'problem'>,
): void {
  if (startedSections.has(section)) return;
  startedSections.add(section);
  const meta = SECTION_STEP_META[section];
  callbacks.onStepStart?.(SECTION_TO_STEP[section], meta.title, meta.body);
}

export type SectionRouter = {
  push: (delta: string) => void;
  finish: () => Record<SectionKey, string>;
};

function stripThinkBlocks(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
}

function createThinkBlockSanitizer() {
  let buffer = '';
  let inThink = false;

  return {
    push(chunk: string): string {
      if (!chunk) return '';

      buffer += chunk;
      let output = '';

      while (buffer.length > 0) {
        if (inThink) {
          const closeIndex = buffer.indexOf(CLOSE_THINK_TAG);
          if (closeIndex === -1) {
            buffer = buffer.slice(-CLOSE_THINK_TAG.length);
            return output;
          }

          buffer = buffer.slice(closeIndex + CLOSE_THINK_TAG.length);
          inThink = false;
          continue;
        }

        const openIndex = buffer.indexOf(OPEN_THINK_TAG);
        if (openIndex === -1) {
          const safeLength = Math.max(0, buffer.length - OPEN_THINK_TAG.length);
          if (safeLength === 0) {
            return output;
          }

          output += buffer.slice(0, safeLength);
          buffer = buffer.slice(safeLength);
          return output;
        }

        if (openIndex > 0) {
          output += buffer.slice(0, openIndex);
        }

        buffer = buffer.slice(openIndex + OPEN_THINK_TAG.length);
        inThink = true;
      }

      return output;
    },
    finish(): string {
      if (inThink) {
        buffer = '';
        inThink = false;
        return '';
      }

      const tail = stripThinkBlocks(buffer);
      buffer = '';
      return tail;
    },
  };
}

function estimatePromptBudget(capabilities: Pick<ModelCapabilities, 'contextWindow'>): number {
  return Math.max(96, Math.floor(capabilities.contextWindow * 0.45));
}

function extractTextFromGenerateResult(result: LanguageModelV3GenerateResult): string {
  return result.content
    .filter((part): part is Extract<(typeof result.content)[number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

async function runCompactTextTask(
  model: LanguageModel,
  system: string,
  user: string,
  signal: AbortSignal | undefined,
  generationOptions: { maxOutputTokens?: number; temperature?: number; topP?: number } = {},
  onToken?: (delta: string) => void,
): Promise<string> {
  const typedModel = model as unknown as StreamableModel;
  const sanitizer = createThinkBlockSanitizer();
  const prompt = [
    { role: 'system', content: system },
    { role: 'user', content: [{ type: 'text', text: user }] },
  ];

  if (typeof typedModel.doStream === 'function') {
    const result = await typedModel.doStream({
      abortSignal: signal,
      prompt,
      tools: [],
      ...generationOptions,
    });
    const reader = result.stream.getReader();
    let text = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.type === 'text-delta') {
        const cleanedDelta = sanitizer.push(value.delta);
        if (cleanedDelta) {
          text += cleanedDelta;
          onToken?.(cleanedDelta);
        }
      }
      if (value.type === 'error') {
        throw value.error instanceof Error ? value.error : new Error(String(value.error));
      }
    }

    const tail = sanitizer.finish();
    if (tail) {
      text += tail;
      onToken?.(tail);
    }

    return text.trim();
  }

  if (typeof typedModel.doGenerate === 'function') {
    const result = await typedModel.doGenerate({
      abortSignal: signal,
      prompt,
      tools: [],
      ...generationOptions,
    });
    const text = stripThinkBlocks(extractTextFromGenerateResult(result)).trim();
    if (text) {
      onToken?.(text);
    }
    return text;
  }

  throw new Error('Model does not support compact delegation tasks.');
}

async function runCompactAgentTask(
  model: LanguageModel,
  system: string,
  user: string,
  signal: AbortSignal | undefined,
  generationOptions: { maxOutputTokens?: number; temperature?: number; topP?: number } = {},
  onToken?: (delta: string) => void,
): Promise<string> {
  let resolvedText = '';
  let failure: Error | null = null;
  let bufferedText = '';
  const completionChecker = createHeuristicCompletionChecker(user);

  await runAgentLoop({
    inferenceClient: {
      async infer() {
        try {
          bufferedText = '';
          resolvedText = await runCompactTextTask(model, system, user, signal, generationOptions, (delta) => {
            bufferedText += delta;
          });
          return resolvedText;
        } catch (error) {
          failure = error instanceof Error ? error : new Error(String(error));
          throw failure;
        }
      },
    },
    messages: [{ content: user }],
    input: user,
    completionChecker: {
      async check(context) {
        const result = await completionChecker.check(context);
        if (result.done && bufferedText) {
          onToken?.(bufferedText);
        }
        bufferedText = '';
        return result;
      },
    },
    maxIterations: 5,
  }, {});

  if (failure) {
    throw failure;
  }

  return resolvedText.trim();
}

export function isParallelDelegationPrompt(prompt: string): boolean {
  const lowered = prompt.toLowerCase();
  const hasParallelCue = /(parallel|paralleliz|concurrent)/.test(lowered);
  const hasDelegationCue = /(delegate|delegation|subagents?|sub-agents?|specialist agents?|worker agents?)/.test(lowered);
  const hasDecompositionCue = /(multi-step|multiple steps|break .* into|split .* work|decompose|independent tasks?)/.test(lowered);

  return (hasParallelCue && hasDelegationCue) || (hasDelegationCue && hasDecompositionCue);
}

/**
 * Gates the parallel delegation pipeline so it only runs when the active
 * model can realistically drive the multi-stage flow. Local models (e.g.
 * Qwen3-0.6B-ONNX) repeatedly stall the per-stage watchdogs and produce
 * outputs that fail the strict sectioned-plan voters, so we fall back to
 * the simpler staged tool pipeline + chat path for them.
 */
export function shouldRunParallelDelegation(
  prompt: string,
  capabilities: Pick<ModelCapabilities, 'provider' | 'contextWindow' | 'maxOutputTokens'>,
): boolean {
  if (!isParallelDelegationPrompt(prompt)) return false;
  return capabilities.provider !== 'local';
}

// ───── AgentBus surfacing helpers ─────────────────────────────────────────
// `createObservedBus` lives in `observedAgentBus.ts` so the staged tool
// pipeline + local ReAct executor can share the same instrumentation.


// ───── Voter ensemble for the delegation plan ─────────────────────────────

type DelegationSections = {
  problem: string;
  breakdown: string;
  assignment: string;
  validation: string;
};

type DelegationVote = {
  voterId: string;
  approve: boolean;
  thought?: string;
  reason?: string;
};

export type DelegationAssignmentContract = {
  role: string;
  owns: string;
  handoff: string;
};

const ASSIGNMENT_CONTRACT_LINE = /^(?:[-*]|\d+[.)])\s*Role\s*:\s*(.+?)\s*\|\s*Owns\s*:\s*(.+?)\s*\|\s*Handoff\s*:\s*(.+)$/i;

function bulletCount(text: string): number {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*\d]/.test(line))
    .length;
}

function parseDelegationBreakdownTracks(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(?:[-*]|\d+[.)])\s+/.test(line))
    .map((line) => line.replace(/^(?:[-*]|\d+[.)])\s+/, '').trim())
    .filter(Boolean);
}

function normalizeDelegationTrackText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function assignmentsCoverBreakdownTracks(
  breakdown: string,
  assignment: string,
): boolean {
  const tracks = parseDelegationBreakdownTracks(breakdown);
  const contracts = parseDelegationAssignmentContracts(assignment);

  if (!tracks.length || contracts.length < tracks.length) return false;

  const remainingContracts = [...contracts];
  return tracks.every((track) => {
    const normalizedTrack = normalizeDelegationTrackText(track);
    const matchingIndex = remainingContracts.findIndex((contract) => (
      normalizeDelegationTrackText(contract.owns).startsWith(normalizedTrack)
    ));

    if (matchingIndex === -1) return false;
    remainingContracts.splice(matchingIndex, 1);
    return true;
  });
}

export function parseDelegationAssignmentContracts(text: string): DelegationAssignmentContract[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .flatMap((line) => {
      const match = line.match(ASSIGNMENT_CONTRACT_LINE);
      if (!match) return [];

      const [, role, owns, handoff] = match;
      const normalized = {
        role: role.trim(),
        owns: owns.trim(),
        handoff: handoff.trim(),
      };

      return normalized.role && normalized.owns && normalized.handoff
        ? [normalized]
        : [];
    });
}

function buildDelegationVoters() {
  return [
    new ClassicVoter(
      'breakdown-distinct-tracks',
      (action) => {
        try {
          const sections = JSON.parse(action) as DelegationSections;
          return bulletCount(sections.breakdown) >= 2;
        } catch {
          return false;
        }
      },
      'breakdown subagent did not emit at least two distinct parallel tracks',
      (_action, approve) => approve
        ? 'Confirmed the breakdown subagent emitted at least two distinct parallel tracks.'
        : 'The breakdown subagent did not emit at least two distinct parallel tracks; the plan cannot be parallelized.',
    ),
    new ClassicVoter(
      'assignment-has-roles',
      (action) => {
        try {
          const sections = JSON.parse(action) as DelegationSections;
          return assignmentsCoverBreakdownTracks(sections.breakdown, sections.assignment);
        } catch {
          return false;
        }
      },
      'assignment subagent did not map each emitted track to an explicit role or owner',
      (_action, approve) => approve
        ? 'Each track has an explicit role or owner with a stated handoff.'
        : 'The assignment subagent did not map each emitted track to an explicit role or owner with a stated handoff.',
    ),
    new ClassicVoter(
      'validation-not-restatement',
      (action) => {
        try {
          const sections = JSON.parse(action) as DelegationSections;
          if (!sections.validation.trim()) return false;
          const validation = sections.validation.toLowerCase();
          const breakdown = sections.breakdown.toLowerCase();
          if (breakdown && validation === breakdown) return false;
          return /(check|verify|risk|test|ensure|validate|confirm)/i.test(sections.validation);
        } catch {
          return false;
        }
      },
      'validation subagent did not emit distinct verification checks or risks',
      (_action, approve) => approve
        ? 'Validation includes verification language distinct from the work bullets.'
        : 'Validation either restates the breakdown or omits explicit verification language.',
    ),
  ];
}

async function runDelegationVoters(
  sections: DelegationSections,
  callbacks: ParallelDelegationCallbacks,
  bus: InMemoryAgentBus,
): Promise<DelegationVote[]> {
  const voters = buildDelegationVoters();
  const intentId = `delegation-${Date.now().toString(36)}`;
  const intentAction = JSON.stringify(sections);
  const votes: DelegationVote[] = [];
  await bus.append({ type: PayloadType.Intent, intentId, action: 'evaluate parallel-delegation plan' });
  await Promise.all(voters.map(async (voter) => {
    const stepId = `voter-${voter.id}-${intentId}`;
    callbacks.onVoterStep?.({
      id: stepId,
      kind: 'agent',
      title: voter.id,
      voterId: voter.id,
      startedAt: Date.now(),
      status: 'active',
    });
    try {
      const vote = await voter.vote({ type: PayloadType.Intent, intentId, action: intentAction }, bus);
      votes.push({
        voterId: vote.voterId,
        approve: vote.approve,
        ...(vote.thought !== undefined ? { thought: vote.thought } : {}),
        ...(vote.reason !== undefined ? { reason: vote.reason } : {}),
      });
      await bus.append(vote);
      callbacks.onVoterStepUpdate?.(stepId, {
        status: 'done',
        approve: vote.approve,
        body: vote.approve ? 'Approved' : `Rejected${vote.reason ? `: ${vote.reason}` : ''}`,
        ...(vote.thought !== undefined ? { thought: vote.thought } : {}),
        endedAt: Date.now(),
      });
      callbacks.onVoterStepEnd?.(stepId);
    } catch (error) {
      callbacks.onVoterStepUpdate?.(stepId, {
        status: 'done',
        approve: false,
        body: `Error: ${error instanceof Error ? error.message : String(error)}`,
        endedAt: Date.now(),
      });
      votes.push({
        voterId: voter.id,
        approve: false,
        reason: error instanceof Error ? error.message : String(error),
      });
      callbacks.onVoterStepEnd?.(stepId);
    }
  }));
  await bus.append({ type: PayloadType.Commit, intentId });
  return votes;
}



export function buildDelegationProblemBrief(prompt: string, workspaceName: string): string {
  const compactPrompt = prompt.replace(/\s+/g, ' ').trim();
  return [
    `Active workspace: ${workspaceName}`,
    'Coordinator brief: choose one concrete multi-step problem that can be parallelized and delegated across specialist subagents.',
    `User request: ${compactPrompt}`,
    'Keep the work focused, compact, and executable without broad workspace scans.',
  ].join('\n');
}

function canExecuteDelegationTasks(
  execution: ParallelDelegationExecutionOptions | undefined,
): execution is ParallelDelegationExecutionOptions {
  return Boolean(execution && execution.toolDescriptors.length > 0 && Object.keys(execution.tools).length > 0);
}

function buildTaskPlannerSystemPrompt(workspaceName: string): string {
  return [
    `Workspace: ${workspaceName}`,
    'You are the task planner for a delegated execution workflow.',
    'delegation-worker:task-planner',
    'Return only valid JSON for an executable task plan.',
    'Do not include markdown fences, commentary, or prose outside the JSON object.',
  ].join('\n\n');
}

function summarizeTaskValidation(task: PlannedTask): string {
  return task.validations.map((validation) => {
    if (validation.kind === 'response-contains') {
      return `response contains ${validation.substrings.join(', ')}`;
    }
    if (validation.kind === 'workspace-file-exists') {
      return `workspace file exists ${validation.path}`;
    }
    return `shell command ${validation.command}`;
  }).join('; ');
}

function truncateTaskNote(text: string, maxLength = 160): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return 'No note recorded.';
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

async function persistPlanSnapshot(
  execution: ParallelDelegationExecutionOptions,
  callbacks: ParallelDelegationCallbacks,
  plan: TaskPlan,
): Promise<void> {
  const markdown = renderPlanMarkdown(plan);
  await execution.writePlanFile?.(PLAN_FILE_PATH, markdown);
  callbacks.onPlanUpdate?.(markdown, plan);
}

function buildExecutionLayers(tasks: PlannedTask[]): PlannedTask[][] {
  const remaining = new Map(tasks.map((task) => [task.id, task]));
  const completed = new Set<string>();
  const layers: PlannedTask[][] = [];

  while (remaining.size > 0) {
    const ready = [...remaining.values()].filter((task) => task.dependsOn.every((dependencyId) => completed.has(dependencyId)));
    if (ready.length === 0) {
      throw new Error(`Task plan has cyclical or unresolved dependencies: ${[...remaining.keys()].join(', ')}`);
    }

    layers.push(ready);
    ready.forEach((task) => {
      completed.add(task.id);
      remaining.delete(task.id);
    });
  }

  return layers;
}

function buildTaskExecutionPrompt(args: {
  plan: TaskPlan;
  task: PlannedTask;
  coordinatorProblem: string;
  outputs: Record<Exclude<ParallelDelegationStepId, 'coordinator'>, string>;
}): string {
  const { plan, task, coordinatorProblem, outputs } = args;
  return [
    `Plan goal: ${plan.goal}`,
    `Delegated problem: ${coordinatorProblem}`,
    `Task id: ${task.id}`,
    `Task title: ${task.title}`,
    `Task description: ${task.description}`,
    task.toolRationale ? `Tool rationale: ${task.toolRationale}` : '',
    `Dependencies already complete: ${task.dependsOn.length ? task.dependsOn.join(', ') : 'none'}`,
    `Delegation breakdown:\n${outputs['breakdown-agent']}`,
    `Assignment guidance:\n${outputs['assignment-agent']}`,
    `Validation guidance:\n${outputs['validation-agent']}`,
    `Required validations: ${summarizeTaskValidation(task)}`,
    'Complete the task now. Do not return a plan. Use the selected tools and satisfy the validations before stopping.',
  ].filter(Boolean).join('\n\n');
}

async function buildExecutableTaskPlan(
  options: ParallelDelegationWorkflowOptions,
  coordinatorProblem: string,
  compactBudget: number,
): Promise<TaskPlan> {
  const execution = options.execution;
  if (!execution) {
    throw new Error('Execution runtime is not available.');
  }

  const toolCatalog: PlannerToolDescriptor[] = execution.toolDescriptors.map((descriptor) => ({
    id: descriptor.id,
    label: descriptor.label,
    description: descriptor.description,
  }));
  const plannerText = await runCompactAgentTask(
    options.model,
    fitTextToTokenBudget(buildTaskPlannerSystemPrompt(options.workspaceName), Math.max(64, Math.floor(compactBudget * 0.3))),
    fitTextToTokenBudget(buildTaskPlanPrompt({
      workspaceName: options.workspaceName,
      userPrompt: options.prompt,
      coordinatorProblem,
      toolCatalog,
    }), Math.max(160, Math.floor(compactBudget * 0.7))),
    options.signal,
    { maxOutputTokens: 192, temperature: 0.1, topP: 1 },
  );
  const plan = parseTaskPlan(plannerText, toolCatalog.map((tool) => tool.id));
  if (!plan) {
    throw new Error('Failed to parse executable task plan from coordinator output.');
  }
  return plan;
}

function formatTaskPlanSection(plan: TaskPlan): string[] {
  if (!plan.tasks.length) {
    return ['- No executable tasks were generated.'];
  }

  return plan.tasks.flatMap((task, index) => ([
    `${index + 1}. ${task.title} [${task.status}]`,
    `   Tools: ${task.toolIds.join(', ')}`,
    `   Validation: ${summarizeTaskValidation(task)}`,
  ]));
}

function formatTaskResults(results: ExecutedTaskResult[]): string[] {
  if (!results.length) {
    return ['- No task execution results were captured.'];
  }

  return results.flatMap((result, index) => ([
    `${index + 1}. ${result.task.title} [${result.task.status}]`,
    `   Result: ${truncateTaskNote(result.text)}`,
    `   Validation: ${truncateTaskNote(result.validationFeedback)}`,
  ]));
}

function synthesizeDelegationExecutionReportWithProcess(args: {
  problemBrief: string;
  outputs: Record<Exclude<ParallelDelegationStepId, 'coordinator'>, string>;
  plan: TaskPlan;
  results: ExecutedTaskResult[];
  votes: DelegationVote[];
  busEntries: Entry[];
}): string {
  const { problemBrief, outputs, plan, results, votes, busEntries } = args;
  return [
    'Parallel delegation plan',
    '',
    problemBrief,
    '',
    'Subagent breakdown',
    outputs['breakdown-agent'],
    '',
    'Subagent assignments',
    outputs['assignment-agent'],
    '',
    'Validation and risk checks',
    outputs['validation-agent'],
    '',
    'Executable task plan',
    ...formatTaskPlanSection(plan),
    '',
    'Workspace plan file',
    `- ${PLAN_FILE_PATH}`,
    '',
    'Task execution results',
    ...formatTaskResults(results),
    '',
    'Reviewer votes',
    ...formatVoteSection(votes),
    '',
    'Process log (AgentBus)',
    ...formatBusLogSection(busEntries),
  ].join('\n');
}

async function executeTaskPlan(args: {
  options: ParallelDelegationWorkflowOptions;
  callbacks: ParallelDelegationCallbacks;
  plan: TaskPlan;
  coordinatorProblem: string;
  outputs: Record<Exclude<ParallelDelegationStepId, 'coordinator'>, string>;
}): Promise<{ plan: TaskPlan; results: ExecutedTaskResult[] }> {
  const { options, callbacks, coordinatorProblem, outputs } = args;
  const execution = options.execution;
  if (!execution) {
    return { plan: args.plan, results: [] };
  }

  const listWorkspacePaths = execution.listWorkspacePaths ?? (() => []);
  const runShellCommand = execution.runShellCommand
    ?? (async (command: string) => ({ exitCode: 127, stdout: '', stderr: `Shell runtime unavailable for: ${command}` }));
  let currentPlan = args.plan;
  const results: ExecutedTaskResult[] = [];
  await persistPlanSnapshot(execution, callbacks, currentPlan);

  const layers = buildExecutionLayers(currentPlan.tasks);
  const maxTaskConcurrency = Math.max(1, execution.maxTaskConcurrency ?? Number.POSITIVE_INFINITY);

  for (const layer of layers) {
    for (let index = 0; index < layer.length; index += maxTaskConcurrency) {
      const batch = layer.slice(index, index + maxTaskConcurrency);
      const batchResults = await Promise.all(batch.map(async (task) => {
        currentPlan = updateTaskStatus(currentPlan, task.id, 'running');
        const runningTask = currentPlan.tasks.find((candidate) => candidate.id === task.id) ?? { ...task, status: 'running' as const };
        callbacks.onTaskStatus?.(runningTask, 'running');
        await persistPlanSnapshot(execution, callbacks, currentPlan);

        try {
          const taskResult = await runStagedToolPipeline({
            model: options.model,
            tools: selectToolsByIds(execution.tools, task.toolIds),
            toolDescriptors: selectToolDescriptorsByIds(execution.toolDescriptors, task.toolIds),
            instructions: execution.instructions,
            messages: [
              ...execution.messages,
              { role: 'user', content: buildTaskExecutionPrompt({ plan: currentPlan, task, coordinatorProblem, outputs }) },
            ],
            workspaceName: options.workspaceName,
            capabilities: options.capabilities,
            signal: options.signal,
            voters: execution.voters,
            maxIterations: execution.maxIterations,
            completionChecker: {
              async check(context) {
                const validation = await evaluateTaskValidations(task.validations, {
                  responseText: context.lastResult.output,
                  listWorkspacePaths,
                  runShellCommand,
                });
                return {
                  type: PayloadType.Completion,
                  intentId: context.lastResult.intentId,
                  done: validation.done,
                  feedback: validation.feedback,
                  score: validation.done ? 'high' : 'med',
                };
              },
            },
          }, {
            onToolCall: callbacks.onToolCall,
            onToolResult: callbacks.onToolResult,
            onVoterStep: callbacks.onVoterStep,
            onVoterStepUpdate: callbacks.onVoterStepUpdate,
            onVoterStepEnd: callbacks.onVoterStepEnd,
            onIterationStep: callbacks.onIterationStep,
            onIterationStepUpdate: callbacks.onIterationStepUpdate,
            onIterationStepEnd: callbacks.onIterationStepEnd,
            onStageStart: callbacks.onStageStart,
            onStageToken: callbacks.onStageToken,
            onStageComplete: callbacks.onStageComplete,
            onStageError: callbacks.onStageError,
          });

          const finalValidation = await evaluateTaskValidations(task.validations, {
            responseText: taskResult.text,
            listWorkspacePaths,
            runShellCommand,
          });
          if (!finalValidation.done) {
            currentPlan = updateTaskStatus(currentPlan, task.id, 'failed', finalValidation.feedback);
            const failedTask = currentPlan.tasks.find((candidate) => candidate.id === task.id) ?? { ...task, status: 'failed' as const, notes: finalValidation.feedback };
            callbacks.onTaskStatus?.(failedTask, 'failed', finalValidation.feedback);
            await persistPlanSnapshot(execution, callbacks, currentPlan);
            throw new Error(finalValidation.feedback);
          }

          const successNote = truncateTaskNote(taskResult.text);
          currentPlan = updateTaskStatus(currentPlan, task.id, 'done', successNote);
          const completedTask = currentPlan.tasks.find((candidate) => candidate.id === task.id) ?? { ...task, status: 'done' as const, notes: successNote };
          callbacks.onTaskStatus?.(completedTask, 'done', successNote);
          await persistPlanSnapshot(execution, callbacks, currentPlan);
          return {
            task: completedTask,
            text: taskResult.text,
            validationFeedback: finalValidation.feedback,
          } satisfies ExecutedTaskResult;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const existingTask = currentPlan.tasks.find((candidate) => candidate.id === task.id);
          if (!existingTask || existingTask.status !== 'failed' || existingTask.notes !== message) {
            currentPlan = updateTaskStatus(currentPlan, task.id, 'failed', message);
            const failedTask = currentPlan.tasks.find((candidate) => candidate.id === task.id) ?? { ...task, status: 'failed' as const, notes: message };
            callbacks.onTaskStatus?.(failedTask, 'failed', message);
            await persistPlanSnapshot(execution, callbacks, currentPlan);
          }
          throw error;
        }
      }));

      results.push(...batchResults);
    }
  }

  return { plan: currentPlan, results };
}

function truncateReportLine(text: string, maxLength = 140): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return 'no detail captured';
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

function formatVoteSection(votes: DelegationVote[]): string[] {
  if (!votes.length) {
    return ['- No reviewer votes were captured.'];
  }

  return votes.map((vote) => {
    const status = vote.approve ? '✅' : '❌';
    const rationale = vote.thought ?? vote.reason ?? (vote.approve ? 'approved' : 'rejected');
    return `- ${status} ${vote.voterId} — ${truncateReportLine(rationale)}`;
  });
}

function formatBusLogSection(entries: Entry[]): string[] {
  if (!entries.length) {
    return ['1. No AgentBus entries were captured.'];
  }

  return entries.map((entry, index) => {
    const { summary, detail } = summarisePayload(entry.payload);
    return `${index + 1}. ${summary} — ${truncateReportLine(detail)}`;
  });
}

function synthesizeDelegationReportWithProcess(
  problemBrief: string,
  outputs: Record<Exclude<ParallelDelegationStepId, 'coordinator'>, string>,
  votes: DelegationVote[],
  busEntries: Entry[],
): string {
  return [
    'Parallel delegation plan',
    '',
    problemBrief,
    '',
    'Subagent breakdown',
    outputs['breakdown-agent'],
    '',
    'Subagent assignments',
    outputs['assignment-agent'],
    '',
    'Validation and risk checks',
    outputs['validation-agent'],
    '',
    'Reviewer votes',
    ...formatVoteSection(votes),
    '',
    'Process log (AgentBus)',
    ...formatBusLogSection(busEntries),
  ].join('\n');
}

function extractJsonObject(text: string): string | null {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  const directObject = normalized.match(/\{[\s\S]*\}/);
  return directObject?.[0] ?? null;
}

function parseDelegationProblem(text: string, fallbackPrompt: string): string {
  const cleaned = stripThinkBlocks(text);
  const jsonObject = extractJsonObject(cleaned);

  if (jsonObject) {
    try {
      const parsed = JSON.parse(jsonObject) as { problem?: unknown };
      if (typeof parsed.problem === 'string' && parsed.problem.trim()) {
        return parsed.problem.trim();
      }
    } catch {
      // Fall through to text heuristics.
    }
  }

  const firstMeaningfulLine = cleaned
    .split('\n')
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*]\s*/, '').replace(/^problem:\s*/i, '').trim())
    .find(Boolean);

  return firstMeaningfulLine ?? fallbackPrompt;
}

export function buildSectionedDelegationPrompt(workspaceName: string): string {
  return [
    'delegation-worker:sectioned-plan',
    buildDelegationWorkerPrompt({ workspaceName, worker: 'coordinator' }),
    'You will act as the coordinator and emit distinct hand-offs for three specialist subagents in a single pass.',
    'Emit exactly these four sections, in this order, each marker on its own line, with no surrounding prose:',
    DELEGATION_SECTION_MARKERS.problem,
    '<one concrete sentence stating the delegated problem>',
    DELEGATION_SECTION_MARKERS.breakdown,
    '<2-3 bullet points; each bullet is a distinct parallel work track with no overlap>',
    DELEGATION_SECTION_MARKERS.assignment,
    '<2-3 bullet points mapping each track to a specialist role and explicit handoff, in the form "Role: <specialist role> | Owns: <track and scope> | Handoff: <next role or deliverable>">',
    DELEGATION_SECTION_MARKERS.validation,
    '<2-3 bullet points listing concrete risks and validation checks that are not restatements of the breakdown or assignment>',
    'Rules:',
    '- Each section must contain content specific to its purpose.',
    '- Do not repeat the same bullets across sections.',
    '- Every assignment bullet must use the exact Role | Owns | Handoff field order.',
    '- Each Owns field must begin with the exact breakdown track text it covers.',
    '- Validation describes how to verify success, not what the work is.',
    '- No preamble, no markdown fences, and no think tags.',
  ].join('\n');
}

function buildSectionedDelegationTask({
  userPrompt,
  coordinatorProblem,
}: {
  userPrompt: string;
  coordinatorProblem: string;
}): string {
  return [
    `Original user request: ${userPrompt}`,
    `Chosen delegation problem: ${coordinatorProblem}`,
    'Use the chosen delegation problem exactly as given.',
    'Emit the required sections now.',
  ].join('\n\n');
}

export function createDelegationSectionRouter(onSectionDelta: (section: SectionKey, delta: string) => void): SectionRouter {
  const buffers: Record<SectionKey, string> = {
    problem: '',
    breakdown: '',
    assignment: '',
    validation: '',
  };
  const markerEntries = Object.entries(DELEGATION_SECTION_MARKERS) as Array<[SectionKey, string]>;
  const longestMarker = Math.max(...markerEntries.map(([, marker]) => marker.length));
  let currentSection: SectionKey | null = null;
  let pending = '';

  const flushCurrent = (text: string) => {
    if (!text || !currentSection) return;
    buffers[currentSection] += text;
    onSectionDelta(currentSection, text);
  };

  return {
    push(delta: string) {
      if (!delta) return;
      pending += delta;

      while (pending.length > 0) {
        let markerIndex = -1;
        let markerSection: SectionKey | null = null;
        let markerLength = 0;

        for (const [section, marker] of markerEntries) {
          const index = pending.indexOf(marker);
          if (index !== -1 && (markerIndex === -1 || index < markerIndex)) {
            markerIndex = index;
            markerSection = section;
            markerLength = marker.length;
          }
        }

        if (markerIndex === -1) {
          const holdback = Math.min(pending.length, longestMarker);
          const safeLength = currentSection ? pending.length - holdback : 0;
          if (safeLength > 0) {
            flushCurrent(pending.slice(0, safeLength));
            pending = pending.slice(safeLength);
          }
          return;
        }

        if (markerIndex > 0) {
          flushCurrent(pending.slice(0, markerIndex));
        }

        let cursor = markerIndex + markerLength;
        while (cursor < pending.length && /[\r\n\t ]/.test(pending[cursor] ?? '')) {
          cursor += 1;
        }
        pending = pending.slice(cursor);
        currentSection = markerSection;
      }
    },
    finish() {
      if (pending) {
        flushCurrent(pending);
        pending = '';
      }
      return buffers;
    },
  };
}

async function runSectionedLocalDelegation(
  options: ParallelDelegationWorkflowOptions,
  callbacks: ParallelDelegationCallbacks,
  problemBrief: string,
  compactBudget: number,
  bus: InMemoryAgentBus,
): Promise<DelegationPlanResult> {
  const { model, signal, workspaceName, prompt } = options;
  const startedSections = new Set<Exclude<SectionKey, 'problem'>>();

  await bus.append({ type: PayloadType.Mail, from: 'user', content: prompt });

  callbacks.onStepStart?.('coordinator', 'Coordinator brief', problemBrief);

  const router = createDelegationSectionRouter((section, delta) => {
    if (section === 'problem') {
      callbacks.onStepToken?.('coordinator', delta);
      return;
    }

    emitSectionStepStart(callbacks, startedSections, section);
    callbacks.onStepToken?.(SECTION_TO_STEP[section], delta);
  });

  const systemPrompt = fitTextToTokenBudget(buildSectionedDelegationPrompt(workspaceName), Math.max(96, Math.floor(compactBudget * 0.5)));
  await bus.append({
    type: PayloadType.InfIn,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: problemBrief },
    ],
  });

  const fullText = await runCompactAgentTask(
    model,
    systemPrompt,
    problemBrief,
    signal,
    { maxOutputTokens: 96, temperature: 0.1, topP: 1 },
    (delta) => router.push(delta),
  );

  await bus.append({ type: PayloadType.InfOut, text: fullText });

  const sections = router.finish();
  const problemText = sections.problem.trim() || problemBrief;
  const breakdownText = sections.breakdown.trim() || 'Awaiting breakdown subagent output — model returned no parallel tracks for this prompt.';
  const assignmentText = sections.assignment.trim() || 'Awaiting assignment subagent output — model did not name role handoffs for this prompt.';
  const validationText = sections.validation.trim() || 'Awaiting validation subagent output — model did not emit verification checks or risks for this prompt.';

  emitSectionStepStart(callbacks, startedSections, 'breakdown');
  emitSectionStepStart(callbacks, startedSections, 'assignment');
  emitSectionStepStart(callbacks, startedSections, 'validation');

  callbacks.onStepComplete?.('coordinator', problemText);
  callbacks.onStepComplete?.('breakdown-agent', breakdownText);
  callbacks.onStepComplete?.('assignment-agent', assignmentText);
  callbacks.onStepComplete?.('validation-agent', validationText);

  const votes = await runDelegationVoters(
    { problem: problemText, breakdown: breakdownText, assignment: assignmentText, validation: validationText },
    callbacks,
    bus,
  );
  const busEntries = await bus.read(0, await bus.tail());

  return {
    problemBrief,
    coordinatorProblem: problemText,
    outputs: {
      'breakdown-agent': breakdownText,
      'assignment-agent': assignmentText,
      'validation-agent': validationText,
    },
    votes,
    busEntries,
    steps: 4,
  };
}

async function runSectionedRemoteDelegation(
  options: ParallelDelegationWorkflowOptions,
  callbacks: ParallelDelegationCallbacks,
  coordinatorProblem: string,
  compactBudget: number,
  bus: InMemoryAgentBus,
): Promise<DelegationPlanResult> {
  const { model, signal, workspaceName, prompt } = options;
  const startedSections = new Set<Exclude<SectionKey, 'problem'>>();

  const router = createDelegationSectionRouter((section, delta) => {
    if (section === 'problem') {
      return;
    }

    emitSectionStepStart(callbacks, startedSections, section);
    callbacks.onStepToken?.(SECTION_TO_STEP[section], delta);
  });

  const systemPrompt = fitTextToTokenBudget(buildSectionedDelegationPrompt(workspaceName), Math.max(96, Math.floor(compactBudget * 0.5)));
  const userPrompt = buildSectionedDelegationTask({ userPrompt: prompt, coordinatorProblem });
  await bus.append({
    type: PayloadType.InfIn,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const fullText = await runCompactAgentTask(
    model,
    systemPrompt,
    userPrompt,
    signal,
    { maxOutputTokens: 96, temperature: 0.1, topP: 1 },
    (delta) => router.push(delta),
  );

  await bus.append({ type: PayloadType.InfOut, text: fullText });

  const sections = router.finish();
  const breakdownText = sections.breakdown.trim() || 'Awaiting breakdown subagent output — model returned no parallel tracks for this prompt.';
  const assignmentText = sections.assignment.trim() || 'Awaiting assignment subagent output — model did not name role handoffs for this prompt.';
  const validationText = sections.validation.trim() || 'Awaiting validation subagent output — model did not emit verification checks or risks for this prompt.';

  emitSectionStepStart(callbacks, startedSections, 'breakdown');
  emitSectionStepStart(callbacks, startedSections, 'assignment');
  emitSectionStepStart(callbacks, startedSections, 'validation');

  callbacks.onStepComplete?.('breakdown-agent', breakdownText);
  callbacks.onStepComplete?.('assignment-agent', assignmentText);
  callbacks.onStepComplete?.('validation-agent', validationText);

  const votes = await runDelegationVoters(
    { problem: coordinatorProblem, breakdown: breakdownText, assignment: assignmentText, validation: validationText },
    callbacks,
    bus,
  );
  const busEntries = await bus.read(0, await bus.tail());

  return {
    problemBrief: buildDelegationProblemBrief(prompt, workspaceName),
    coordinatorProblem,
    outputs: {
      'breakdown-agent': breakdownText,
      'assignment-agent': assignmentText,
      'validation-agent': validationText,
    },
    votes,
    busEntries,
    steps: 4,
  };
}

export async function runParallelDelegationWorkflow(
  options: ParallelDelegationWorkflowOptions,
  callbacks: ParallelDelegationCallbacks = {},
): Promise<{ text: string; steps: number }> {
  const { model, prompt, workspaceName, capabilities, signal } = options;

  try {
    const compactBudget = estimatePromptBudget(capabilities);
    const problemBrief = fitTextToTokenBudget(buildDelegationProblemBrief(prompt, workspaceName), compactBudget);
    const bus = createObservedBus(callbacks.onBusEntry);

    let planResult: DelegationPlanResult;

    if (capabilities.provider === 'local' || (model as { provider?: string }).provider === 'local') {
      planResult = await runSectionedLocalDelegation(options, callbacks, problemBrief, compactBudget, bus);
    } else {
      await bus.append({ type: PayloadType.Mail, from: 'user', content: prompt });

      callbacks.onStepStart?.('coordinator', 'Coordinator brief', problemBrief);
      const coordinatorText = await runCompactAgentTask(
        model,
        fitTextToTokenBudget([
          buildDelegationWorkerPrompt({ workspaceName, worker: 'coordinator' }),
          'Return only the one-sentence delegated problem the subagents should solve.',
          'Do not include bullets, markdown fences, or extra explanation.',
        ].join('\n\n'), Math.max(48, Math.floor(compactBudget * 0.3))),
        problemBrief,
        signal,
        { maxOutputTokens: 64, temperature: 0.1, topP: 1 },
        (delta) => callbacks.onStepToken?.('coordinator', delta),
      );
      const coordinatorProblem = parseDelegationProblem(coordinatorText, problemBrief);
      callbacks.onStepComplete?.('coordinator', coordinatorProblem);
      await bus.append({ type: PayloadType.InfOut, text: coordinatorProblem });

      planResult = await runSectionedRemoteDelegation(options, callbacks, coordinatorProblem, compactBudget, bus);
    }

    if (!canExecuteDelegationTasks(options.execution)) {
      const text = synthesizeDelegationReportWithProcess(
        planResult.problemBrief,
        planResult.outputs,
        planResult.votes,
        planResult.busEntries,
      );
      await bus.append({ type: PayloadType.Result, intentId: 'delegation', output: text });
      callbacks.onDone?.(text);
      return { text, steps: planResult.steps };
    }

    const initialPlan = await buildExecutableTaskPlan(options, planResult.coordinatorProblem, compactBudget);
    const { plan, results } = await executeTaskPlan({
      options,
      callbacks,
      plan: initialPlan,
      coordinatorProblem: planResult.coordinatorProblem,
      outputs: planResult.outputs,
    });
    const text = synthesizeDelegationExecutionReportWithProcess({
      problemBrief: planResult.problemBrief,
      outputs: planResult.outputs,
      plan,
      results,
      votes: planResult.votes,
      busEntries: planResult.busEntries,
    });
    await bus.append({ type: PayloadType.Result, intentId: 'delegation', output: text });
    callbacks.onDone?.(text);
    return { text, steps: planResult.steps + results.length };
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    callbacks.onError?.(normalized);
    throw normalized;
  }
}
