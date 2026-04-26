import type { LanguageModel, ToolSet } from 'ai';
import type { LanguageModelV3GenerateResult, LanguageModelV3StreamPart } from '@ai-sdk/provider';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import { runAgentLoop } from '../chat-agents/agent-loop';
import { buildDelegationWorkerPrompt } from './agentPromptTemplates';
import { fitTextToTokenBudget } from './promptBudget';
import type { ModelCapabilities } from './agentProvider';
import { createHeuristicCompletionChecker } from 'ralph-loop';
import { InMemoryAgentBus, PayloadType } from 'logact';
import type { AgentBusPayloadMeta, Entry, VotePayload } from 'logact';
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

export type ParallelDelegationStepId =
  | 'chat-agent'
  | 'planner'
  | 'router-agent'
  | 'coordinator'
  | 'breakdown-agent'
  | 'assignment-agent'
  | 'validation-agent'
  | 'orchestrator'
  | 'tool-agent';

export type ParallelDelegationCallbacks = {
  onStepStart?: (stepId: ParallelDelegationStepId, title: string, body: string) => void;
  onStepToken?: (stepId: ParallelDelegationStepId, delta: string) => void;
  onStepComplete?: (stepId: ParallelDelegationStepId, text: string) => void;
  onAgentHandoff?: (fromAgentId: string, toAgentId: string, summary: string) => void;
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
  outputs: Record<DelegationOutputStepId, string>;
  steps: number;
};

type DelegationOutputStepId = 'breakdown-agent' | 'assignment-agent' | 'validation-agent';

type ExecutedTaskResult = {
  task: PlannedTask;
  text: string;
  validationFeedback: string;
};

type DelegationLogActOutcome = {
  decision: 'commit' | 'abort';
  votes: DelegationVote[];
  busEntries: Entry[];
};

export const DELEGATION_SECTION_MARKERS: Record<SectionKey, string> = {
  problem: '===PROBLEM===',
  breakdown: '===BREAKDOWN===',
  assignment: '===ASSIGNMENT===',
  validation: '===VALIDATION===',
};

const SECTION_TO_STEP: Record<Exclude<SectionKey, 'problem'>, DelegationOutputStepId> = {
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
 * outputs that fail the strict sectioned-plan rubric, so we fall back to
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

type DelegationRubricScore = {
  criterion: string;
  approve: boolean;
  reason: string;
};

type DelegationRubricResult = {
  approve: boolean;
  thought: string;
  reason?: string;
  scores: DelegationRubricScore[];
};

const DELEGATION_ACTOR_META: Record<string, AgentBusPayloadMeta> = {
  'student-driver': {
    actorId: 'student-driver',
    actorRole: 'driver',
    parentActorId: 'logact',
    branchId: 'agent:student-driver',
    agentLabel: 'Student Driver',
    modelProvider: 'logact',
  },
  'teacher-voter': {
    actorId: 'teacher-voter',
    actorRole: 'voter',
    parentActorId: 'student-driver',
    branchId: 'agent:teacher-voter',
    agentLabel: 'Teacher Voter',
    modelProvider: 'logact',
  },
  'adversary-driver': {
    actorId: 'adversary-driver',
    actorRole: 'driver',
    parentActorId: 'judge-decider',
    branchId: 'agent:adversary-driver',
    agentLabel: 'Adversary Driver',
    modelProvider: 'logact',
  },
  'judge-decider': {
    actorId: 'judge-decider',
    actorRole: 'decider',
    parentActorId: 'logact',
    branchId: 'agent:judge-decider',
    agentLabel: 'Judge Decider',
    modelProvider: 'logact',
  },
  'executor-agent': {
    actorId: 'executor-agent',
    actorRole: 'executor',
    parentActorId: 'judge-decider',
    branchId: 'agent:executor-agent',
    agentLabel: 'Executor Agent',
    modelProvider: 'logact',
  },
};

const DELEGATION_RUBRIC_CRITERIA = [
  'breakdown contains at least two distinct parallel tracks',
  'assignment maps every emitted track to an explicit role and handoff',
  'validation contains checks or risks distinct from the work breakdown',
];

function validationIncludesDistinctChecks(sections: DelegationSections): boolean {
  if (!sections.validation.trim()) return false;
  const validation = sections.validation.toLowerCase();
  const breakdown = sections.breakdown.toLowerCase();
  if (breakdown && validation === breakdown) return false;
  return /(check|verify|risk|test|ensure|validate|confirm)/i.test(sections.validation);
}

function evaluateDelegationSections(sections: DelegationSections): DelegationRubricResult {
  const breakdownOk = bulletCount(sections.breakdown) >= 2;
  const assignmentOk = assignmentsCoverBreakdownTracks(sections.breakdown, sections.assignment);
  const validationOk = validationIncludesDistinctChecks(sections);
  const scores: DelegationRubricScore[] = [
    {
      criterion: DELEGATION_RUBRIC_CRITERIA[0],
      approve: breakdownOk,
      reason: breakdownOk
        ? 'Student proposed at least two parallel tracks.'
        : 'Student did not emit at least two distinct parallel tracks.',
    },
    {
      criterion: DELEGATION_RUBRIC_CRITERIA[1],
      approve: assignmentOk,
      reason: assignmentOk
        ? 'Each track has an explicit role or owner with a stated handoff.'
        : 'Student did not map each emitted track to an explicit role or owner with a stated handoff.',
    },
    {
      criterion: DELEGATION_RUBRIC_CRITERIA[2],
      approve: validationOk,
      reason: validationOk
        ? 'Validation includes verification language distinct from the work bullets.'
        : 'Student validation either restates the breakdown or omits explicit verification language.',
    },
  ];
  const failedScore = scores.find((score) => !score.approve);
  const thought = failedScore
    ? `Teacher rejected the student candidate: ${failedScore.reason}`
    : 'Teacher approved the student candidate after checking decomposition, ownership, and validation.';

  return {
    approve: !failedScore,
    thought,
    ...(failedScore ? { reason: failedScore.reason } : {}),
    scores,
  };
}

function buildStudentDelegationDesign(sections: DelegationSections): string {
  return [
    'Student delegation candidate',
    `Problem: ${sections.problem}`,
    `Breakdown:\n${sections.breakdown}`,
    `Assignments:\n${sections.assignment}`,
    `Validation:\n${sections.validation}`,
  ].join('\n\n');
}

function buildAdversaryDelegationDesign(evaluation: DelegationRubricResult): string {
  const failed = evaluation.scores.find((score) => !score.approve);
  return failed
    ? `Adversary attempt: exploit the rubric by claiming "${failed.criterion}" is satisfied without matching the concrete AgentBus evidence.`
    : 'Adversary attempt: game the rubric by over-weighting role labels and ignoring whether handoffs are actually executable.';
}

async function runDelegationLogActPipeline(
  sections: DelegationSections,
  callbacks: ParallelDelegationCallbacks,
  bus: InMemoryAgentBus,
  execute: (context: { votes: DelegationVote[]; busEntries: Entry[] }) => Promise<string>,
): Promise<DelegationLogActOutcome> {
  const intentId = `delegation-${Date.now().toString(36)}`;
  const intentAction = JSON.stringify(sections);
  const studentDesign = buildStudentDelegationDesign(sections);
  const evaluation = evaluateDelegationSections(sections);
  const votes: DelegationVote[] = [];

  callbacks.onAgentHandoff?.('logact', 'student-driver', 'Agent handoff: student driver drafts the delegation candidate.');
  await bus.append({
    type: PayloadType.InfIn,
    messages: [
      { role: 'system', content: 'Student driver: draft and self-check a parallel delegation design before submitting it.' },
      { role: 'user', content: sections.problem },
    ],
    meta: DELEGATION_ACTOR_META['student-driver'],
  });
  await bus.append({
    type: PayloadType.InfOut,
    text: studentDesign,
    meta: DELEGATION_ACTOR_META['student-driver'],
  });
  await bus.append({
    type: PayloadType.Intent,
    intentId,
    action: intentAction,
    meta: DELEGATION_ACTOR_META['student-driver'],
  });

  callbacks.onAgentHandoff?.('student-driver', 'teacher-voter', 'Agent handoff: teacher voter steers and evaluates the student candidate.');
  const teacherStepId = `voter-teacher-voter-${intentId}`;
  callbacks.onVoterStep?.({
    id: teacherStepId,
    kind: 'agent',
    title: 'teacher-voter',
    voterId: 'teacher-voter',
    startedAt: Date.now(),
    status: 'active',
  });
  const teacherVote: VotePayload = {
    type: PayloadType.Vote,
    intentId,
    voterId: 'teacher-voter',
    approve: evaluation.approve,
    ...(evaluation.reason !== undefined ? { reason: evaluation.reason } : {}),
    thought: evaluation.thought,
    meta: { ...DELEGATION_ACTOR_META['teacher-voter'], rubric: evaluation.scores },
  };
  votes.push({
    voterId: 'teacher-voter',
    approve: evaluation.approve,
    thought: evaluation.thought,
    ...(evaluation.reason !== undefined ? { reason: evaluation.reason } : {}),
  });
  await bus.append(teacherVote);
  callbacks.onVoterStepUpdate?.(teacherStepId, {
    status: 'done',
    approve: evaluation.approve,
    body: evaluation.approve ? 'Approved' : `Rejected${evaluation.reason ? `: ${evaluation.reason}` : ''}`,
    thought: evaluation.thought,
    endedAt: Date.now(),
  });
  callbacks.onVoterStepEnd?.(teacherStepId);

  await bus.append({
    type: PayloadType.Policy,
    target: 'delegation-judge-rubric',
    value: { criteria: DELEGATION_RUBRIC_CRITERIA, scores: evaluation.scores },
    meta: { ...DELEGATION_ACTOR_META['judge-decider'], rubric: evaluation.scores },
  });
  callbacks.onAgentHandoff?.('judge-decider', 'adversary-driver', 'Agent handoff: adversary driver probes the delegation rubric.');
  const adversaryIntentId = `${intentId}:adversary`;
  const adversaryDesign = buildAdversaryDelegationDesign(evaluation);
  await bus.append({
    type: PayloadType.InfIn,
    messages: [
      { role: 'system', content: 'Adversary driver: try to subvert the judge rubric before execution can be committed.' },
      { role: 'user', content: adversaryDesign },
    ],
    meta: DELEGATION_ACTOR_META['adversary-driver'],
  });
  await bus.append({
    type: PayloadType.InfOut,
    text: adversaryDesign,
    meta: DELEGATION_ACTOR_META['adversary-driver'],
  });
  await bus.append({
    type: PayloadType.Intent,
    intentId: adversaryIntentId,
    action: adversaryDesign,
    meta: DELEGATION_ACTOR_META['adversary-driver'],
  });

  if (!evaluation.approve) {
    await bus.append({
      type: PayloadType.Abort,
      intentId,
      reason: evaluation.reason ?? 'teacher-voter rejected the student delegation design',
      meta: DELEGATION_ACTOR_META['judge-decider'],
    });
    return {
      decision: 'abort',
      votes,
      busEntries: await bus.read(0, await bus.tail()),
    };
  }

  await bus.append({ type: PayloadType.Commit, intentId, meta: DELEGATION_ACTOR_META['judge-decider'] });
  callbacks.onAgentHandoff?.('judge-decider', 'executor-agent', 'Agent handoff: committed delegation plan is ready for executor action.');
  try {
    const resultText = await execute({ votes, busEntries: await bus.read(0, await bus.tail()) });
    await bus.append({
      type: PayloadType.Result,
      intentId,
      output: resultText,
      meta: DELEGATION_ACTOR_META['executor-agent'],
    });
    return {
      decision: 'commit',
      votes,
      busEntries: await bus.read(0, await bus.tail()),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await bus.append({
      type: PayloadType.Result,
      intentId,
      output: '',
      error: message,
      meta: DELEGATION_ACTOR_META['executor-agent'],
    });
    throw error;
  }
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
  outputs: Record<DelegationOutputStepId, string>;
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
  outputs: Record<DelegationOutputStepId, string>;
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
  outputs: Record<DelegationOutputStepId, string>;
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
  outputs: Record<DelegationOutputStepId, string>,
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

  return {
    problemBrief,
    coordinatorProblem: problemText,
    outputs: {
      'breakdown-agent': breakdownText,
      'assignment-agent': assignmentText,
      'validation-agent': validationText,
    },
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

  return {
    problemBrief: buildDelegationProblemBrief(prompt, workspaceName),
    coordinatorProblem,
    outputs: {
      'breakdown-agent': breakdownText,
      'assignment-agent': assignmentText,
      'validation-agent': validationText,
    },
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
    const hasExecutionRuntime = canExecuteDelegationTasks(options.execution);

    callbacks.onStepStart?.('chat-agent', 'Chat agent', 'Receiving the user prompt and delegating planning.');
    callbacks.onStepComplete?.('chat-agent', prompt);
    callbacks.onAgentHandoff?.('chat-agent', 'planner', 'Agent handoff: classify the prompt and decompose it into delegated work.');

    callbacks.onStepStart?.('planner', 'Planner', 'Classifying the prompt, decomposing the task, and preparing delegation.');

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

    const sections: DelegationSections = {
      problem: planResult.coordinatorProblem,
      breakdown: planResult.outputs['breakdown-agent'],
      assignment: planResult.outputs['assignment-agent'],
      validation: planResult.outputs['validation-agent'],
    };
    callbacks.onStepComplete?.('planner', [
      planResult.coordinatorProblem,
      planResult.outputs['breakdown-agent'],
      planResult.outputs['assignment-agent'],
      planResult.outputs['validation-agent'],
    ].join('\n\n'));
    callbacks.onAgentHandoff?.('planner', 'router-agent', 'Agent handoff: classify succinct tasks before orchestration.');

    callbacks.onStepStart?.('router-agent', 'Router agent', 'Classifying the delegation plan against the registered agent workflow.');
    callbacks.onStepComplete?.('router-agent', 'Routed the classified delegation plan to the orchestrator for actor selection.');
    callbacks.onAgentHandoff?.('router-agent', 'orchestrator', 'Agent handoff: pass routed tasks and delegation constraints to the orchestrator.');

    callbacks.onStepStart?.('orchestrator', 'Orchestrator', 'Reviewing registered agents and selecting the execution workflow.');
    const registeredAgents = [
      'chat-agent',
      'planner',
      'router-agent',
      'orchestrator',
      'tool-agent',
      'student-driver',
      'teacher-voter',
      'adversary-driver',
      'judge-decider',
      'executor-agent',
    ];
    callbacks.onStepComplete?.(
      'orchestrator',
      `Registered agents: ${registeredAgents.join(', ')}. ${hasExecutionRuntime ? 'Execution runtime is available.' : 'No executable tool runtime is active.'}`,
    );
    callbacks.onAgentHandoff?.('orchestrator', 'tool-agent', 'Agent handoff: assign active workspace tools to the selected agents.');

    callbacks.onStepStart?.('tool-agent', 'Tool agent', 'Inspecting active workspace tools and preparing execution assignments.');
    let initialPlan: TaskPlan | undefined;
    if (hasExecutionRuntime) {
      initialPlan = await buildExecutableTaskPlan(options, planResult.coordinatorProblem, compactBudget);
      callbacks.onStepComplete?.('tool-agent', renderPlanMarkdown(initialPlan));
    } else {
      callbacks.onStepComplete?.('tool-agent', 'No active execution tools were selected; submitting the delegation plan itself to LogAct.');
    }
    callbacks.onAgentHandoff?.('tool-agent', 'logact', 'Agent handoff: submit the prepared execution workflow to the LogAct AgentBus.');

    let executed: { plan: TaskPlan; results: ExecutedTaskResult[] } | undefined;
    const logactOutcome = await runDelegationLogActPipeline(
      sections,
      callbacks,
      bus,
      async ({ votes, busEntries }) => {
        if (!hasExecutionRuntime || !initialPlan) {
          return synthesizeDelegationReportWithProcess(
            planResult.problemBrief,
            planResult.outputs,
            votes,
            busEntries,
          );
        }

        executed = await executeTaskPlan({
          options,
          callbacks,
          plan: initialPlan,
          coordinatorProblem: planResult.coordinatorProblem,
          outputs: planResult.outputs,
        });

        return synthesizeDelegationExecutionReportWithProcess({
          problemBrief: planResult.problemBrief,
          outputs: planResult.outputs,
          plan: executed.plan,
          results: executed.results,
          votes,
          busEntries,
        });
      },
    );

    const text = executed && logactOutcome.decision === 'commit'
      ? synthesizeDelegationExecutionReportWithProcess({
        problemBrief: planResult.problemBrief,
        outputs: planResult.outputs,
        plan: executed.plan,
        results: executed.results,
        votes: logactOutcome.votes,
        busEntries: logactOutcome.busEntries,
      })
      : synthesizeDelegationReportWithProcess(
        planResult.problemBrief,
        planResult.outputs,
        logactOutcome.votes,
        logactOutcome.busEntries,
      );
    callbacks.onDone?.(text);
    return { text, steps: planResult.steps + (executed?.results.length ?? 0) };
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    callbacks.onError?.(normalized);
    throw normalized;
  }
}
