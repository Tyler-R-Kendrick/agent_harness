import type { ModelMessage } from '@ai-sdk/provider-utils';
import type { ToolSet } from 'ai';
import { PayloadType } from 'logact';
import type { AgentBusPayloadMeta, IAgentBus } from 'logact';
import type { AgentRunResult } from './agentRunner';
import { createObservedBus } from './observedAgentBus';
import { taskFromMessages } from './executorAgent';
import type { BusEntryStep, VoterStep } from '../types';
import type { ToolDescriptor } from '../tools';
import type { ToolPlan } from '../tool-agents/tool-agent';

export interface LogActToolPolicy {
  allowedToolIds: string[];
  assignments: Record<string, string[]>;
}

export interface LogActActorExecuteContext {
  action: string;
  toolPolicy: LogActToolPolicy;
  plan: ToolPlan;
  selectedDescriptors: ToolDescriptor[];
  selectedTools: ToolSet;
  bus: IAgentBus;
  busEntries: BusEntryStep[];
  executionAttempt?: number;
  executePlanIntentId?: string;
}

export interface LogActToolSelection {
  plan: ToolPlan;
  selectedDescriptors: ToolDescriptor[];
  selectedTools: ToolSet;
}

export interface RunLogActActorWorkflowOptions {
  messages: ModelMessage[];
  instructions: string;
  workspaceName?: string;
  plan: ToolPlan;
  selectedDescriptors: ToolDescriptor[];
  selectedTools: ToolSet;
  negativeRubricTechniques?: string[];
  customTeacherInstructions?: string[];
  customJudgeRubricCriteria?: string[];
  onNegativeRubricTechnique?: (technique: string) => void;
  maxPasses?: number;
  maxExecutionAttempts?: number;
  onExecutorStart?: (summary: string) => void;
  selectTools?: (context: {
    task: string;
    messages: ModelMessage[];
    passIndex: number;
    priorBusContext?: string;
  }) => Promise<LogActToolSelection>;
  execute: (context: LogActActorExecuteContext) => Promise<AgentRunResult>;
}

export interface LogActActorWorkflowCallbacks {
  onBusEntry?: (entry: BusEntryStep) => void;
  onVoterStep?: (step: VoterStep) => void;
  onVoterStepUpdate?: (id: string, patch: Partial<VoterStep>) => void;
  onVoterStepEnd?: (id: string) => void;
  onAgentHandoff?: (fromAgentId: string, toAgentId: string, summary: string) => void;
}

type Candidate = {
  source: 'student' | 'adversary';
  intentId: string;
  action: string;
  score: number;
  passIndex: number;
};

type ActiveToolSelection = LogActToolSelection & {
  toolPolicy: LogActToolPolicy;
};

type JudgeDecision =
  | { winner: 'student'; selected: Candidate }
  | { winner: 'adversary'; selected: Candidate; technique: string };

const ADVERSARY_TECHNIQUE = 'negative-rubric-technique: keyword-stuffing without task grounding';
const STUDENT_SELF_REFLECTION_ROUNDS = 2;
const TEACHER_STUDENT_REVIEW_ROUNDS = 2;

const ACTOR_META: Record<string, AgentBusPayloadMeta> = {
  logact: {
    actorId: 'logact',
    actorRole: 'pipeline',
    branchId: 'agent:logact',
    agentLabel: 'LogAct Pipeline',
    modelProvider: 'logact',
  },
  'tool-agent': {
    actorId: 'tool-agent',
    actorRole: 'driver',
    parentActorId: 'logact',
    branchId: 'agent:tool-agent',
    agentLabel: 'Tool Agent',
    modelProvider: 'logact',
  },
  'student-driver': {
    actorId: 'student-driver',
    actorRole: 'driver',
    parentActorId: 'logact',
    branchId: 'agent:student-driver',
    agentLabel: 'Student Driver',
    modelProvider: 'logact',
  },
  'voter:teacher': {
    actorId: 'voter:teacher',
    actorRole: 'voter',
    parentActorId: 'judge-decider',
    branchId: 'agent:judge-decider',
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
  executor: {
    actorId: 'executor',
    actorRole: 'executor',
    parentActorId: 'logact',
    branchId: 'agent:executor',
    agentLabel: 'Executor Agent',
    modelProvider: 'logact',
  },
  'execute-plan': {
    actorId: 'execute-plan',
    actorRole: 'executor',
    parentActorId: 'executor',
    branchId: 'agent:executor',
    agentLabel: 'Execute Plan',
    modelProvider: 'logact',
  },
  'tools-selected': {
    actorId: 'tools-selected',
    actorRole: 'operation',
    parentActorId: 'tool-agent',
    branchId: 'agent:logact',
    agentLabel: 'Tools Selected',
    modelProvider: 'logact',
  },
  'judge-approved': {
    actorId: 'judge-approved',
    actorRole: 'operation',
    parentActorId: 'judge-decider',
    branchId: 'agent:logact',
    agentLabel: 'Judge Approved',
    modelProvider: 'logact',
  },
  'execution-complete': {
    actorId: 'execution-complete',
    actorRole: 'operation',
    parentActorId: 'executor',
    branchId: 'agent:logact',
    agentLabel: 'Execution Complete',
    modelProvider: 'logact',
  },
  'execution-failed': {
    actorId: 'execution-failed',
    actorRole: 'operation',
    parentActorId: 'executor',
    branchId: 'agent:logact',
    agentLabel: 'Execution Failed',
    modelProvider: 'logact',
  },
  'execution-paused': {
    actorId: 'execution-paused',
    actorRole: 'operation',
    parentActorId: 'executor',
    branchId: 'agent:logact',
    agentLabel: 'Execution Paused',
    modelProvider: 'logact',
  },
  'execution-recovery': {
    actorId: 'execution-recovery',
    actorRole: 'operation',
    parentActorId: 'execution-failed',
    branchId: 'agent:logact',
    agentLabel: 'Execution Recovery',
    modelProvider: 'logact',
  },
  'workflow-complete': {
    actorId: 'workflow-complete',
    actorRole: 'operation',
    parentActorId: 'execution-complete',
    branchId: 'main',
    agentLabel: 'Workflow Complete',
    modelProvider: 'logact',
  },
  'workflow-aborted': {
    actorId: 'workflow-aborted',
    actorRole: 'operation',
    parentActorId: 'execution-recovery',
    branchId: 'main',
    agentLabel: 'Workflow Aborted',
    modelProvider: 'logact',
  },
  user: {
    actorId: 'user',
    actorRole: 'user',
    branchId: 'main',
    agentLabel: 'User',
  },
};

function actorMeta(
  actorId: string,
  passIndex?: number,
  overrides: Partial<AgentBusPayloadMeta> = {},
): AgentBusPayloadMeta {
  return {
    ...ACTOR_META[actorId],
    ...(passIndex !== undefined ? { passIndex } : {}),
    ...overrides,
  };
}

export async function runLogActActorWorkflow(
  options: RunLogActActorWorkflowOptions,
  callbacks: LogActActorWorkflowCallbacks = {},
): Promise<AgentRunResult> {
  const capturedBusEntries: BusEntryStep[] = [];
  const bus = createObservedBus((entry) => {
    capturedBusEntries.push(entry);
    callbacks.onBusEntry?.(entry);
  });
  const task = taskFromMessages(options.messages) || options.plan.goal;
  const negativeTechniques = [...(options.negativeRubricTechniques ?? [])];
  const maxPasses = Math.max(1, Math.floor(options.maxPasses ?? 3));

  await bus.append({
    type: PayloadType.Mail,
    from: 'user',
    content: task,
    meta: ACTOR_META.user,
  });

  const maxExecutionAttempts = Math.max(1, Math.floor(options.maxExecutionAttempts ?? 3));
  let nextPassIndex = 1;
  let lastExecutionError: string | undefined;
  let lastExecutionSteps = 0;

  for (let executionAttempt = 1; executionAttempt <= maxExecutionAttempts; executionAttempt += 1) {
    let selected: Candidate | undefined;
    let selectedTools: ActiveToolSelection | undefined;
    for (let attemptPass = 1; attemptPass <= maxPasses; attemptPass += 1) {
      const passIndex = nextPassIndex;
      nextPassIndex += 1;
      const priorBusContext = passIndex === 1 ? undefined : summarizeBusContext(capturedBusEntries);
      callbacks.onAgentHandoff?.(
        'logact',
        'tool-agent',
        `Agent handoff: tool-agent records tool selection and actor tool policy for LogAct pass ${passIndex}.`,
      );
      const activeTools = await runToolAgentDriver(bus, task, options, passIndex, priorBusContext);
      callbacks.onAgentHandoff?.(
        'logact',
        'student-driver',
        `Agent handoff: student driver drafts a solution candidate for LogAct pass ${passIndex}.`,
      );
      const studentDraft = await runStudentDriver(bus, task, options, activeTools.toolPolicy, passIndex, priorBusContext);
      const studentCandidate = await runTeacherStudentLoop(
        bus,
        studentDraft,
        callbacks,
        options.customTeacherInstructions ?? [],
        passIndex,
      );

      const judgeRubric = buildJudgeRubric(negativeTechniques, options.customJudgeRubricCriteria ?? []);
      await bus.append({
        type: PayloadType.Policy,
        target: 'judge-rubric',
        value: { type: 'judge-rubric', criteria: judgeRubric, passIndex },
        meta: actorMeta('judge-decider', passIndex, { rubric: judgeRubric }),
      });
      callbacks.onAgentHandoff?.(
        'judge-decider',
        'adversary-driver',
        `Agent handoff: adversary driver probes the rubric for LogAct pass ${passIndex}.`,
      );
      const adversaryCandidate = await runAdversaryDriver(
        bus,
        task,
        passIndex,
        priorBusContext,
        negativeTechniques,
      );
      const decision = await runJudgeDecider(
        bus,
        studentCandidate,
        adversaryCandidate,
        negativeTechniques,
        judgeRubric,
        passIndex,
        options.onNegativeRubricTechnique,
      );
      if (decision.winner === 'student') {
        selected = decision.selected;
        selectedTools = activeTools;
        break;
      }
    }

    if (!selected || !selectedTools) {
      const passLabel = maxPasses === 1 ? 'pass' : 'passes';
      const text = `LogAct aborted before execution because the adversary continued to win after ${maxPasses} ${passLabel}.`;
      await bus.append({
        type: PayloadType.Abort,
        intentId: 'logact-max-passes',
        reason: text,
        meta: actorMeta('workflow-aborted', nextPassIndex - 1, {
          parentActorId: 'judge-decider',
          branchId: 'main',
        }),
      });
      return { text, steps: 0, failed: true, error: text };
    }

    await bus.append({
      type: PayloadType.Completion,
      intentId: selected.intentId,
      done: true,
      score: 'high',
      feedback: 'Judge committed the student design; returning the decision to LogAct.',
      meta: actorMeta('judge-approved', selected.passIndex),
    });
    callbacks.onAgentHandoff?.('logact', 'executor', 'Agent handoff: committed design becomes an executable actor.');
    options.onExecutorStart?.('Executing committed LogAct plan.');
    const executePlanIntentId = `execute-plan-${selected.intentId}`;
    await bus.append({
      type: PayloadType.Intent,
      intentId: executePlanIntentId,
      action: selected.action,
      meta: actorMeta('execute-plan', selected.passIndex, { toolPolicy: selectedTools.toolPolicy }),
    });

    const result = await runExecutorAttempt(options, {
      action: selected.action,
      toolPolicy: selectedTools.toolPolicy,
      plan: selectedTools.plan,
      selectedDescriptors: selectedTools.selectedDescriptors,
      selectedTools: selectedTools.selectedTools,
      bus,
      busEntries: capturedBusEntries,
      executionAttempt,
      executePlanIntentId,
    });
    lastExecutionSteps = result.steps;
    lastExecutionError = result.error;
    await bus.append({
      type: PayloadType.Result,
      intentId: executePlanIntentId,
      output: result.text,
      ...(result.failed ? { error: result.error ?? result.text } : {}),
      meta: actorMeta('executor', selected.passIndex, {
        parentActorId: 'execute-plan',
        branchId: 'agent:executor',
        toolPolicy: selectedTools.toolPolicy,
      }),
    });

    if (result.blocked || result.needsUserInput) {
      await bus.append({
        type: PayloadType.Completion,
        intentId: executePlanIntentId,
        done: false,
        score: 'low',
        feedback: 'Executor paused with needs_user_input; waiting for the user before continuing.',
        meta: actorMeta('execution-paused', selected.passIndex),
      });
      return result;
    }

    if (!result.failed) {
      await bus.append({
        type: PayloadType.Completion,
        intentId: executePlanIntentId,
        done: true,
        score: 'high',
        feedback: 'Executor returned the action result to LogAct.',
        meta: actorMeta('execution-complete', selected.passIndex),
      });
      await bus.append({
        type: PayloadType.Completion,
        intentId: executePlanIntentId,
        done: true,
        score: 'high',
        feedback: 'LogAct completed and merged back to the main thread.',
        meta: actorMeta('workflow-complete', selected.passIndex),
      });
      return result;
    }

    await bus.append({
      type: PayloadType.Completion,
      intentId: executePlanIntentId,
      done: false,
      score: 'invalid',
      feedback: `Executor failed attempt ${executionAttempt}: ${result.error ?? result.text}`,
      meta: actorMeta('execution-failed', selected.passIndex),
    });

    if (executionAttempt < maxExecutionAttempts) {
      await bus.append({
        type: PayloadType.Policy,
        target: 'execution-recovery',
        value: {
          type: 'execution-recovery',
          executionAttempt,
          maxExecutionAttempts,
          failedIntentId: executePlanIntentId,
          error: result.error ?? result.text,
          reason: 'Executor failure returned to LogAct; rerunning solution design with AgentBus failure context.',
        },
        meta: actorMeta('execution-recovery', selected.passIndex),
      });
    }
  }

  const attemptLabel = maxExecutionAttempts === 1 ? 'attempt' : 'attempts';
  const text = `LogAct aborted after ${maxExecutionAttempts} executor ${attemptLabel}: ${lastExecutionError ?? 'execution failed'}.`;
  await bus.append({
    type: PayloadType.Abort,
    intentId: 'logact-executor-max-attempts',
    reason: text,
    meta: actorMeta('workflow-aborted', nextPassIndex - 1, {
      parentActorId: 'execution-failed',
      branchId: 'main',
    }),
  });
  return { text, steps: lastExecutionSteps, failed: true, error: lastExecutionError ?? text };
}

async function runExecutorAttempt(
  options: RunLogActActorWorkflowOptions,
  context: LogActActorExecuteContext,
): Promise<AgentRunResult> {
  try {
    const result = await options.execute(context);
    if (result.failed) {
      return {
        ...result,
        error: result.error ?? result.text,
      };
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      text: `Executor failed: ${message}`,
      steps: 0,
      failed: true,
      error: message,
    };
  }
}

async function runToolAgentDriver(
  bus: IAgentBus,
  task: string,
  options: RunLogActActorWorkflowOptions,
  passIndex: number,
  priorBusContext?: string,
): Promise<ActiveToolSelection> {
  const messages = [
    {
      role: 'system' as const,
      content: `Tool-agent driver pass ${passIndex}: select active workspace tools and assign them to LogAct actors without executing them.`,
    },
    ...(priorBusContext ? [{
      role: 'system' as const,
      content: `Previous AgentBus context:\n${priorBusContext}`,
    }] : []),
    { role: 'user' as const, content: task },
  ];
  await bus.append({ type: PayloadType.InfIn, messages, meta: actorMeta('tool-agent', passIndex) });
  const selection = await selectToolsForPass(options, task, passIndex, priorBusContext);
  const toolPolicy = buildToolPolicy(selection.plan, selection.selectedDescriptors);
  const selectedGroups = Array.from(new Set(selection.selectedDescriptors.map((descriptor) => (
    descriptor.groupLabel ?? descriptor.group
  ))));
  const selectedToolIds = selection.selectedDescriptors.map((descriptor) => descriptor.id);
  const toolSelection = [
    `Tool group selection pass ${passIndex}: ${selectedGroups.join(', ') || '(none)'}.`,
    `Tool selection pass ${passIndex}: ${selectedToolIds.join(', ') || '(none)'}.`,
    `Executor tool allowance: ${toolPolicy.allowedToolIds.join(', ') || '(none)'}.`,
    `Actor tool assignments: ${JSON.stringify(toolPolicy.assignments)}.`,
    priorBusContext ? 'Previous AgentBus context reviewed before confirming tool assignments.' : null,
  ].filter(Boolean).join('\n');
  await bus.append({ type: PayloadType.InfOut, text: toolSelection, meta: actorMeta('tool-agent', passIndex) });
  const intentId = `tool-policy-p${passIndex}`;
  await bus.append({
    type: PayloadType.Intent,
    intentId,
    action: toolSelection,
    meta: actorMeta('tool-agent', passIndex, { toolPolicy }),
  });
  await bus.append({
    type: PayloadType.Policy,
    target: 'tool-policy',
    value: {
      type: 'tool-assignment',
      allowedToolIds: toolPolicy.allowedToolIds,
      assignments: toolPolicy.assignments,
      passIndex,
    },
    meta: actorMeta('tool-agent', passIndex, { toolPolicy }),
  });
  await bus.append({
    type: PayloadType.Completion,
    intentId,
    done: true,
    score: 'high',
    feedback: 'Tool-agent recorded tool selection and returned the policy to LogAct.',
    meta: actorMeta('tools-selected', passIndex),
  });
  return {
    ...selection,
    toolPolicy,
  };
}

async function selectToolsForPass(
  options: RunLogActActorWorkflowOptions,
  task: string,
  passIndex: number,
  priorBusContext?: string,
): Promise<LogActToolSelection> {
  if (options.selectTools) {
    return options.selectTools({
      task,
      messages: options.messages,
      passIndex,
      priorBusContext,
    });
  }
  return {
    plan: options.plan,
    selectedDescriptors: options.selectedDescriptors,
    selectedTools: options.selectedTools,
  };
}

function summarizeBusContext(entries: BusEntryStep[]): string {
  return entries
    .slice(-12)
    .map((entry) => {
      const actor = entry.actorId ?? entry.actor ?? 'agent-bus';
      const detail = entry.detail.length > 240 ? `${entry.detail.slice(0, 237)}...` : entry.detail;
      return `${entry.position + 1}. ${actor} ${entry.summary}: ${detail}`;
    })
    .join('\n');
}

function buildToolPolicy(plan: ToolPlan, selectedDescriptors: ToolDescriptor[]): LogActToolPolicy {
  const allowedToolIds = plan.actorToolAssignments?.executor
    ?? plan.actorToolAssignments?.['executor-agent']
    ?? plan.selectedToolIds
    ?? selectedDescriptors.map((descriptor) => descriptor.id);
  const assignments: Record<string, string[]> = plan.actorToolAssignments
    ? { ...plan.actorToolAssignments }
    : {
      'tool-agent': [],
      'student-driver': [],
      'voter:teacher': [],
      'adversary-driver': [],
      'judge-decider': [],
      executor: allowedToolIds,
    };
  if (!assignments['tool-agent']) {
    assignments['tool-agent'] = [];
  }
  if (!assignments['voter:teacher'] && plan.actorToolAssignments?.['teacher-voter']) {
    assignments['voter:teacher'] = plan.actorToolAssignments['teacher-voter'];
  }
  if (!assignments.executor && plan.actorToolAssignments?.['executor-agent']) {
    assignments.executor = plan.actorToolAssignments['executor-agent'];
  }
  return {
    allowedToolIds,
    assignments,
  };
}

function buildJudgeRubric(negativeTechniques: string[], customRubricCriteria: string[]): string[] {
  return [
    'grounded in user task',
    'uses only tool-policy assignments',
    'teacher approved',
    ...customRubricCriteria,
    ...negativeTechniques.map((technique) => `negative: ${technique}`),
  ];
}

async function runStudentDriver(
  bus: IAgentBus,
  task: string,
  options: RunLogActActorWorkflowOptions,
  toolPolicy: LogActToolPolicy,
  passIndex: number,
  priorBusContext?: string,
): Promise<Candidate> {
  const messages = [
    { role: 'system' as const, content: `Student driver pass ${passIndex}: produce a concise solution design before execution.` },
    ...(priorBusContext ? [{
      role: 'system' as const,
      content: `Previous AgentBus context:\n${priorBusContext}`,
    }] : []),
    { role: 'user' as const, content: task },
  ];
  await bus.append({ type: PayloadType.InfIn, messages, meta: actorMeta('student-driver', passIndex) });
  const action = [
    `Student solution pass ${passIndex} for: ${task}`,
    `Use executor tools: ${toolPolicy.allowedToolIds.join(', ') || '(none)'}.`,
    `Workspace: ${options.workspaceName ?? 'Workspace'}.`,
    options.instructions ? `Instructions: ${options.instructions}` : null,
    priorBusContext ? 'Previous AgentBus context reviewed before revising the candidate.' : null,
  ].filter(Boolean).join('\n');
  for (let round = 1; round <= STUDENT_SELF_REFLECTION_ROUNDS; round += 1) {
    await bus.append({
      type: PayloadType.InfOut,
      text: [
        `Student self-reflection round ${round}: predict the teacher response before submitting a candidate.`,
        round === 1
          ? 'Likely teacher concern: the plan must stay grounded in the AgentBus tool policy and avoid premature execution.'
          : 'Revision: make the executor instruction explicit, bounded, and recoverable from AgentBus results.',
      ].join('\n'),
      meta: actorMeta('student-driver', passIndex),
    });
  }
  await bus.append({ type: PayloadType.InfOut, text: action, meta: actorMeta('student-driver', passIndex) });
  const intentId = `student-p${passIndex}-${Date.now().toString(36)}`;
  await bus.append({ type: PayloadType.Intent, intentId, action, meta: actorMeta('student-driver', passIndex) });
  return { source: 'student', intentId, action, score: passIndex > 1 ? 100 : 80, passIndex };
}

async function runTeacherStudentLoop(
  bus: IAgentBus,
  candidate: Candidate,
  callbacks: LogActActorWorkflowCallbacks,
  customInstructions: string[],
  passIndex: number,
): Promise<Candidate> {
  let current = candidate;
  for (let round = 1; round <= TEACHER_STUDENT_REVIEW_ROUNDS; round += 1) {
    const approve = round === TEACHER_STUDENT_REVIEW_ROUNDS;
    const stepId = `teacher-p${passIndex}-${current.intentId}-r${round}`;
    callbacks.onAgentHandoff?.(
      'student-driver',
      'voter:teacher',
      `Agent handoff: teacher reviews student candidate in advice loop round ${round}.`,
    );
    callbacks.onVoterStep?.({
      id: stepId,
      kind: 'agent',
      title: 'Teacher Voter',
      voterId: 'voter:teacher',
      startedAt: Date.now(),
      status: 'active',
    });
    const thought = [
      approve
        ? 'Teacher approved the revised student candidate for judge scoring.'
        : 'Teacher advice round 1: tighten the plan around the committed AgentBus instruction, bounded executor attempt, and failure recovery.',
      customInstructions.length ? `Custom teacher steering: ${customInstructions.join(' ')}` : null,
    ].filter(Boolean).join('\n');
    await bus.append({
      type: PayloadType.Vote,
      intentId: current.intentId,
      voterId: 'voter:teacher',
      approve,
      thought,
      meta: actorMeta('voter:teacher', passIndex),
    });
    callbacks.onVoterStepUpdate?.(stepId, {
      approve,
      body: approve
        ? 'Approved student candidate for judge scoring.'
        : 'Returned advice for student revision.',
      thought,
      status: 'done',
      endedAt: Date.now(),
    });
    callbacks.onVoterStepEnd?.(stepId);

    if (!approve) {
      callbacks.onAgentHandoff?.(
        'voter:teacher',
        'student-driver',
        'Agent handoff: student revises the candidate using teacher advice before resubmitting.',
      );
      const revisedAction = [
        current.action,
        `Teacher/student revision round ${round}: apply teacher advice before final approval.`,
        'Executor must consume the committed execute-plan once, write Result success or failure to AgentBus, and return failures to LogAct.',
      ].join('\n');
      await bus.append({
        type: PayloadType.InfOut,
        text: revisedAction,
        meta: actorMeta('student-driver', passIndex, { parentActorId: 'voter:teacher' }),
      });
      const revisedIntentId = `student-p${passIndex}-revision-${round}-${Date.now().toString(36)}`;
      await bus.append({
        type: PayloadType.Intent,
        intentId: revisedIntentId,
        action: revisedAction,
        meta: actorMeta('student-driver', passIndex, { parentActorId: 'voter:teacher' }),
      });
      current = {
        ...current,
        intentId: revisedIntentId,
        action: revisedAction,
        score: Math.max(current.score, passIndex > 1 ? 100 : 85),
      };
    }
  }
  return current;
}

async function runAdversaryDriver(
  bus: IAgentBus,
  task: string,
  passIndex: number,
  priorBusContext: string | undefined,
  negativeTechniques: string[],
): Promise<Candidate> {
  const techniqueBlocked = negativeTechniques.includes(ADVERSARY_TECHNIQUE);
  const messages = [
    { role: 'system' as const, content: `Adversary driver pass ${passIndex}: try to game the judge rubric without satisfying the task.` },
    ...(priorBusContext ? [{
      role: 'system' as const,
      content: `Previous AgentBus context:\n${priorBusContext}`,
    }] : []),
    { role: 'user' as const, content: task },
  ];
  await bus.append({ type: PayloadType.InfIn, messages, meta: actorMeta('adversary-driver', passIndex) });
  const action = [
    `Adversary candidate pass ${passIndex}: maximize rubric score by keyword-stuffing evaluator terms.`,
    'Subversion technique: keyword-stuffing without task grounding.',
    techniqueBlocked ? 'Rubric hardening detected: this subversion should be penalized.' : null,
    priorBusContext ? 'Previous AgentBus context used to refine the subversion attempt.' : null,
  ].filter(Boolean).join('\n');
  await bus.append({ type: PayloadType.InfOut, text: action, meta: actorMeta('adversary-driver', passIndex) });
  const intentId = `adversary-p${passIndex}-${Date.now().toString(36)}`;
  await bus.append({ type: PayloadType.Intent, intentId, action, meta: actorMeta('adversary-driver', passIndex) });
  return { source: 'adversary', intentId, action, score: techniqueBlocked ? 60 : 95, passIndex };
}

async function runJudgeDecider(
  bus: IAgentBus,
  student: Candidate,
  adversary: Candidate,
  negativeTechniques: string[],
  rubric: string[],
  passIndex: number,
  onNegativeRubricTechnique?: (technique: string) => void,
): Promise<JudgeDecision> {
  const adversaryWins = adversary.score > student.score;
  if (adversaryWins) {
    if (!negativeTechniques.includes(ADVERSARY_TECHNIQUE)) {
      negativeTechniques.push(ADVERSARY_TECHNIQUE);
      onNegativeRubricTechnique?.(ADVERSARY_TECHNIQUE);
    }
    await bus.append({
      type: PayloadType.Policy,
      target: 'judge-rubric',
      value: {
        type: 'negative-rubric-technique',
        technique: ADVERSARY_TECHNIQUE,
        passIndex,
        reason: 'Judge selected the adversary; hardening rubric and rerunning the full LogAct actor flow.',
      },
      meta: actorMeta('judge-decider', passIndex, { rubric: { criteria: rubric, negativeTechniques } }),
    });
    await bus.append({
      type: PayloadType.Policy,
      target: 'judge-rerun',
      value: {
        type: 'judge-rerun',
        rejectedCandidate: adversary.intentId,
        studentCandidate: student.intentId,
        passIndex,
      },
      meta: actorMeta('judge-decider', passIndex, { rubric: { criteria: rubric, negativeTechniques } }),
    });
    return { winner: 'adversary', selected: adversary, technique: ADVERSARY_TECHNIQUE };
  }

  await bus.append({
    type: PayloadType.Commit,
    intentId: student.intentId,
    meta: actorMeta('judge-decider', passIndex),
  });
  return { winner: 'student', selected: student };
}
