import type { ModelMessage } from '@ai-sdk/provider-utils';
import type { ToolSet } from 'ai';
import { PayloadType } from 'logact';
import type { AgentBusPayloadMeta, IAgentBus } from 'logact';
import type { AgentRunResult } from './agentRunner';
import { createObservedBus } from './observedAgentBus';
import { isGenericNonEntityLabel, taskFromMessages } from './executionRequirements';
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
  validationCriteria?: string[];
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
  verificationCriteria?: string[];
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

export interface VerificationFailure {
  criterion: string;
  reason: string;
  evidence?: string;
}

export interface VerificationResult {
  passed: boolean;
  failures: VerificationFailure[];
  criteria: string[];
}

interface StructuredCandidateReport {
  candidates: Array<{
    name: string;
    validationStatus?: string;
    subjectMatch?: boolean;
    locationEvidence?: string[];
    entityLink?: string;
    sourceEvidence?: string[];
  }>;
  rejected: Array<{
    name: string;
    validationStatus?: string;
    validationFailures?: string[];
  }>;
}

const ADVERSARY_TECHNIQUE = 'negative-rubric-technique: keyword-stuffing without task grounding';
const STUDENT_SELF_REFLECTION_ROUNDS = 2;
const TEACHER_STUDENT_REVIEW_ROUNDS = 2;
const POST_PROCESSOR_REFLECTION_ROUNDS = 3;
const FORBIDDEN_ANSWER_LABEL_PATTERN = /^(?:movies?|trailers?|teasers?|videos?|clips?|showtimes?|tickets?|reviews?|menus?|directions?|hours?|locations?|search|find|home|main content|skip to main content|skip navigation|privacy|terms|sign in|log in|subscribe|load more|see all|view all|read more|learn more|page link)$/i;
const FORBIDDEN_ANSWER_LABEL_WORD_PATTERN = /\b(?:trailer|teaser|showtimes?|tickets?|skip to main content|main content)\b/i;

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
  'post-processor': {
    actorId: 'post-processor',
    actorRole: 'post-processor',
    parentActorId: 'execution-complete',
    branchId: 'agent:post-processor',
    agentLabel: 'Post Processor',
    modelProvider: 'logact',
  },
  'verification-agent': {
    actorId: 'verification-agent',
    actorRole: 'verifier',
    parentActorId: 'post-processor',
    branchId: 'agent:verification-agent',
    agentLabel: 'Verification Agent',
    modelProvider: 'logact',
  },
  'validation-agent': {
    actorId: 'validation-agent',
    actorRole: 'verifier',
    parentActorId: 'logact',
    branchId: 'agent:validation-agent',
    agentLabel: 'Validation Agent',
    modelProvider: 'logact',
  },
  'response-ready': {
    actorId: 'response-ready',
    actorRole: 'operation',
    parentActorId: 'verification-agent',
    branchId: 'agent:logact',
    agentLabel: 'Response Ready',
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
  'verification-recovery': {
    actorId: 'verification-recovery',
    actorRole: 'policy',
    parentActorId: 'verification-agent',
    branchId: 'agent:logact',
    agentLabel: 'Verification Recovery',
    modelProvider: 'logact',
  },
  'workflow-complete': {
    actorId: 'workflow-complete',
    actorRole: 'operation',
    parentActorId: 'response-ready',
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
  const validationCriteria = buildValidationCriteria(options.verificationCriteria ?? []);
  await appendValidationContract(bus, validationCriteria);

  const maxExecutionAttempts = Math.max(1, Math.floor(options.maxExecutionAttempts ?? 3));
  let nextPassIndex = 1;
  let lastExecutionError: string | undefined;
  let lastExecutionText: string | undefined;
  let lastExecutionSteps = 0;
  let lastFailureKind: 'executor' | 'verification' = 'executor';

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
      validationCriteria,
      executionAttempt,
      executePlanIntentId,
    });
    lastExecutionSteps = result.steps;
    lastExecutionError = result.error;
    lastExecutionText = result.text;
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
      const finalResult = await runPostProcessor(
        bus,
        task,
        result,
        capturedBusEntries,
        executePlanIntentId,
        selected.passIndex,
        validationCriteria,
      );
      const verification = await runVerificationAgent(
        bus,
        task,
        finalResult,
        capturedBusEntries,
        executePlanIntentId,
        selected.passIndex,
        options.verificationCriteria ?? [],
      );
      if (!verification.passed) {
        lastFailureKind = 'verification';
        lastExecutionSteps = finalResult.steps;
        lastExecutionError = verification.failures.map((failure) => failure.reason).join('; ') || 'verification failed';
        await bus.append({
          type: PayloadType.Completion,
          intentId: executePlanIntentId,
          done: false,
          score: 'invalid',
          feedback: `Verification failed attempt ${executionAttempt}: ${lastExecutionError}`,
          meta: actorMeta('verification-agent', selected.passIndex),
        });
        if (executionAttempt < maxExecutionAttempts) {
          await bus.append({
            type: PayloadType.Policy,
            target: 'verification-recovery',
            value: {
              type: 'verification-recovery',
              executionAttempt,
              maxExecutionAttempts,
              failedIntentId: executePlanIntentId,
              failures: verification.failures,
              reason: 'Verification failed; rerunning solution design with verifier failures in AgentBus context.',
            },
            meta: actorMeta('verification-recovery', selected.passIndex),
          });
        }
        continue;
      }
      await bus.append({
        type: PayloadType.Completion,
        intentId: executePlanIntentId,
        done: true,
        score: 'high',
        feedback: 'Post-processor rendered the AgentBus result into the final user-facing response.',
        meta: actorMeta('response-ready', selected.passIndex),
      });
      await bus.append({
        type: PayloadType.Completion,
        intentId: executePlanIntentId,
        done: true,
        score: 'high',
        feedback: 'LogAct completed and merged back to the main thread.',
        meta: actorMeta('workflow-complete', selected.passIndex),
      });
      return finalResult;
    }

    await bus.append({
      type: PayloadType.Completion,
      intentId: executePlanIntentId,
      done: false,
      score: 'invalid',
      feedback: `Executor failed attempt ${executionAttempt}: ${result.error ?? result.text}`,
      meta: actorMeta('execution-failed', selected.passIndex),
    });
    lastFailureKind = 'executor';

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
    } else if (isInsufficientEvidenceAnswer(result.text)) {
      const finalResult = await runPostProcessor(
        bus,
        task,
        result,
        capturedBusEntries,
        executePlanIntentId,
        selected.passIndex,
        validationCriteria,
      );
      const verification = await runVerificationAgent(
        bus,
        task,
        finalResult,
        capturedBusEntries,
        executePlanIntentId,
        selected.passIndex,
        options.verificationCriteria ?? [],
      );
      if (verification.passed) {
        await bus.append({
          type: PayloadType.Completion,
          intentId: executePlanIntentId,
          done: true,
          score: 'high',
          feedback: 'Verifier accepted an honest insufficient-evidence response with no fabricated entities.',
          meta: actorMeta('response-ready', selected.passIndex),
        });
        await bus.append({
          type: PayloadType.Completion,
          intentId: executePlanIntentId,
          done: true,
          score: 'high',
          feedback: 'LogAct completed with a verified insufficient-evidence response.',
          meta: actorMeta('workflow-complete', selected.passIndex),
        });
        return { ...finalResult, failed: undefined, error: undefined };
      }
    }
  }

  const attemptLabel = maxExecutionAttempts === 1 ? 'attempt' : 'attempts';
  const text = lastFailureKind === 'verification'
    ? `LogAct verification failed after ${maxExecutionAttempts} ${attemptLabel}: ${lastExecutionError ?? 'could not verify the final answer'}.`
    : lastExecutionText && !/^Executor failed:/i.test(lastExecutionText)
      ? lastExecutionText
      : `Execution aborted after ${maxExecutionAttempts} executor ${attemptLabel}: ${lastExecutionError ?? 'execution failed'}.`;
  await bus.append({
    type: PayloadType.Abort,
    intentId: lastFailureKind === 'verification' ? 'logact-verification-max-attempts' : 'logact-executor-max-attempts',
    reason: text,
    meta: actorMeta('workflow-aborted', nextPassIndex - 1, {
      parentActorId: lastFailureKind === 'verification' ? 'verification-recovery' : 'execution-failed',
      branchId: 'main',
    }),
  });
  return { text, steps: lastExecutionSteps, failed: true, error: lastExecutionError ?? text };
}

function isInsufficientEvidenceAnswer(text: string): boolean {
  return /could not find enough validated|insufficient evidence|did not contain source-backed entity names|no validated/i.test(text);
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

async function runPostProcessor(
  bus: IAgentBus,
  task: string,
  executorResult: AgentRunResult,
  busEntries: BusEntryStep[],
  executePlanIntentId: string,
  passIndex: number,
  validationCriteria: string[],
): Promise<AgentRunResult> {
  const renderMode = chooseRenderMode(executorResult.text);
  const responsePreferences = {
    prefersCitations: prefersCitationsFromBus(busEntries),
  };
  await bus.append({
    type: PayloadType.InfIn,
    messages: [
      {
        role: 'system',
        content: [
          `Post-processing agent pass ${passIndex}: inspect the entire AgentBus and render the final answer.`,
          'Choose the best response surface available for the output: A2UI, AGUI, MCP-Apps, markdown, enriched text, or regular text.',
          `Selected render mode: ${renderMode}.`,
          responsePreferences.prefersCitations ? 'User memory preference: render with concise citations.' : 'User memory preference: no citation preference detected.',
          `Self-reflect exactly ${POST_PROCESSOR_REFLECTION_ROUNDS} times before publishing the response.`,
        ].join('\n'),
      },
      {
        role: 'system',
        content: `AgentBus context:\n${summarizeBusContext(busEntries) || '(no AgentBus entries captured yet)'}`,
      },
      {
        role: 'user',
        content: [
          `Original user request: ${task}`,
          '',
          'Executor output:',
          executorResult.text,
        ].join('\n'),
      },
    ],
    meta: actorMeta('post-processor', passIndex),
  });

  let draft = executorResult.text;
  for (let round = 1; round <= POST_PROCESSOR_REFLECTION_ROUNDS; round += 1) {
    draft = improveRenderedAnswer(draft, task, round, responsePreferences);
    await bus.append({
      type: PayloadType.InfOut,
      text: [
        `Post-processor self-reflection round ${round}: ${postProcessorReflectionSummary(round)}`,
        '',
        draft,
      ].join('\n'),
      meta: actorMeta('post-processor', passIndex),
    });
    await appendValidationResult(bus, {
      intentId: `validate-post-processor-round-${round}-${executePlanIntentId}`,
      loop: 'post-processing-output-validation',
      scope: 'post-processor',
      target: `post-processor self-reflection round ${round}`,
      output: draft,
      criteria: validationCriteria,
      passIndex,
      parentActorId: 'post-processor',
    });
  }

  const resultIntentId = `post-process-${executePlanIntentId}`;
  await bus.append({
    type: PayloadType.Result,
    intentId: resultIntentId,
    output: draft,
    meta: actorMeta('post-processor', passIndex),
  });
  await appendValidationResult(bus, {
    intentId: `validate-post-processor-final-${executePlanIntentId}`,
    loop: 'post-processing-output-validation',
    scope: 'post-processor',
    target: 'post-processor final output',
    output: draft,
    criteria: validationCriteria,
    passIndex,
    parentActorId: 'post-processor',
  });

  return {
    ...executorResult,
    text: draft,
  };
}

function buildValidationCriteria(verificationCriteria: string[]): string[] {
  return [
    'recursive-tool-call-validation: validation-agent must validate every executor tool result before that result is used to drive a follow-up tool call or final answer.',
    'recursive-tool-call-validation: each validation pass must check tool success/error status, structured output shape, subject alignment, and whether follow-up queries are grounded in validated evidence.',
    'post-processing-output-validation: validation-agent must validate every post-processor draft and final user-facing output before response-ready can be written.',
    'post-processing-output-validation: each post-processing validation pass must check original-question alignment, absence of internal AgentBus/process narration, entity/link validity, and user preference formatting.',
    'entity-instance-validation: validation-agent must reject linked labels that are generic categories, site sections, navigation labels, or content types instead of specific instances of the requested subject.',
    'nearby-entity-validation: for nearby tasks, validation-agent must require per-entity location, address, distance, or proximity evidence before response-ready.',
    ...verificationCriteria,
  ];
}

async function appendValidationContract(bus: IAgentBus, criteria: string[]): Promise<void> {
  await bus.append({
    type: PayloadType.Policy,
    target: 'validation-contract',
    value: {
      type: 'validation-contract',
      actorId: 'validation-agent',
      requiredLoops: [
        {
          id: 'recursive-tool-call-validation',
          appliesTo: 'every executor tool call result',
          requiredBefore: 'using the result for follow-up tool calls, candidate selection, or answer composition',
        },
        {
          id: 'post-processing-output-validation',
          appliesTo: 'every post-processor draft and final user-facing output',
          requiredBefore: 'response-ready',
        },
      ],
      criteria,
    },
    meta: actorMeta('validation-agent', undefined, {
      parentActorId: 'user',
      branchId: 'agent:logact',
    }),
  });
}

async function appendValidationResult(
  bus: IAgentBus,
  {
    intentId,
    loop,
    scope,
    target,
    output,
    criteria,
    passIndex,
    parentActorId,
  }: {
    intentId: string;
    loop: 'post-processing-output-validation';
    scope: 'post-processor';
    target: string;
    output: string;
    criteria: string[];
    passIndex: number;
    parentActorId: string;
  },
): Promise<void> {
  await bus.append({
    type: PayloadType.Result,
    intentId,
    output: JSON.stringify({
      type: 'validation-result',
      loop,
      scope,
      target,
      passed: !/AgentBus Result Write-back/i.test(output),
      criteria,
      outputPreview: output.length > 400 ? `${output.slice(0, 397)}...` : output,
    }),
    meta: actorMeta('validation-agent', passIndex, {
      parentActorId,
      branchId: 'agent:validation-agent',
    }),
  });
}

async function runVerificationAgent(
  bus: IAgentBus,
  task: string,
  finalResult: AgentRunResult,
  busEntries: BusEntryStep[],
  executePlanIntentId: string,
  passIndex: number,
  verificationCriteria: string[],
): Promise<VerificationResult> {
  const criteria = verificationCriteria.length > 0
    ? verificationCriteria
    : ['Final response should be coherent and answer the current user request.'];
  await bus.append({
    type: PayloadType.InfIn,
    messages: [{
      role: 'system',
      content: [
        'Verify the post-processed response before it can be published.',
        `Original task: ${task}`,
        `Criteria: ${criteria.join(' | ')}`,
      ].join('\n'),
    }],
    meta: actorMeta('verification-agent', passIndex),
  });
  const result = evaluateFinalAnswerVerification(task, finalResult.text, criteria, busEntries);
  await bus.append({
    type: PayloadType.Result,
    intentId: `verification-${executePlanIntentId}`,
    output: JSON.stringify(result),
    ...(result.passed ? {} : { error: result.failures.map((failure) => failure.reason).join('; ') }),
    meta: actorMeta('verification-agent', passIndex),
  });
  return result;
}

function evaluateFinalAnswerVerification(
  task: string,
  answer: string,
  criteria: string[],
  busEntries: BusEntryStep[],
): VerificationResult {
  const failures: VerificationFailure[] = [];
  const links = extractMarkdownLinks(answer);
  const subjectText = inferSubjectText(task);
  const entitySeekingTask = taskNeedsEntityResults(task);
  const criterionText = criteria.join('\n').toLocaleLowerCase();
  const requiresEntities = entitySeekingTask || /actual named entities|named entities|entity/i.test(criterionText);
  const requiresEntityLinks = entitySeekingTask || /entity-specific|links/i.test(criterionText);
  const requiresSubject = entitySeekingTask || /specific instance|requested subject|current requested subject|subject/i.test(criterionText);
  const requiresLocation = taskNeedsLocationEvidence(task) || /geographic|proximity|nearby|resolved location/i.test(criterionText);
  const candidateReport = latestStructuredCandidateReport(busEntries);
  const requiresStructuredCandidates = entitySeekingTask
    || Boolean(candidateReport)
    || /accepted structured candidate|structured search candidate/i.test(criterionText);
  const acceptedStructuredCandidates = candidateReport?.candidates.filter((candidate) => (
    candidate.validationStatus === 'accepted'
    && candidate.subjectMatch === true
    && typeof candidate.entityLink === 'string'
    && isSafeExternalUrl(candidate.entityLink)
    && Array.isArray(candidate.sourceEvidence)
    && candidate.sourceEvidence.length > 0
    && (!requiresLocation || (Array.isArray(candidate.locationEvidence) && candidate.locationEvidence.length > 0))
  )) ?? [];
  const honestInsufficientEvidence = isInsufficientEvidenceAnswer(answer)
    && acceptedStructuredCandidates.length === 0
    && links.length === 0;

  const invalidLabels = links
    .map((link) => link.label)
    .filter((label) => isForbiddenAnswerLabel(label, subjectText));
  for (const label of invalidLabels) {
    failures.push({
      criterion: 'Each listed item must be a specific instance of the requested subject.',
      reason: `Rejected generic or non-entity label "${label}".`,
      evidence: label,
    });
  }

  if (requiresStructuredCandidates && acceptedStructuredCandidates.length === 0 && !honestInsufficientEvidence) {
    const rejectedNames = candidateReport?.rejected.map((candidate) => candidate.name).filter(Boolean).join(', ');
    failures.push({
      criterion: 'Entity-seeking answers require accepted structured candidates.',
      reason: `The AgentBus did not contain an accepted structured candidate for this answer${rejectedNames ? `; rejected candidates: ${rejectedNames}` : ''}.`,
      evidence: rejectedNames,
    });
  }

  if (requiresStructuredCandidates && acceptedStructuredCandidates.length > 0) {
    const acceptedByName = new Map(acceptedStructuredCandidates.map((candidate) => [normalizeComparable(candidate.name), candidate]));
    for (const link of links) {
      const accepted = acceptedByName.get(normalizeComparable(link.label));
      if (!accepted) {
        failures.push({
          criterion: 'Final answer links must come from accepted structured candidates.',
          reason: `The linked label "${link.label}" was not an accepted structured candidate.`,
          evidence: link.label,
        });
        continue;
      }
      if (accepted.entityLink && normalizeUrlForCompare(accepted.entityLink) !== normalizeUrlForCompare(link.url)) {
        failures.push({
          criterion: 'Links must resolve to entity-specific pages.',
          reason: `The link for "${link.label}" does not match the validated entity link.`,
          evidence: link.url,
        });
      }
    }
  }

  const validEntityLinks = requiresStructuredCandidates
    ? links.filter((link) => acceptedStructuredCandidates.some((candidate) => normalizeComparable(candidate.name) === normalizeComparable(link.label)))
    : links.filter((link) => (
    !isForbiddenAnswerLabel(link.label, subjectText)
    && isSafeExternalUrl(link.url)
    && isEntityLikeLabel(link.label, subjectText)
    && answerLinkHasSubjectEvidence(task, answer, link, busEntries)
    ));
  if (requiresEntities && validEntityLinks.length === 0 && !honestInsufficientEvidence) {
    failures.push({
      criterion: 'Answer must contain actual named entities.',
      reason: 'The final answer did not contain any validated entity-like linked names.',
    });
  }

  if (requiresEntityLinks) {
    for (const link of links) {
      if (!isSafeExternalUrl(link.url)) {
        failures.push({
          criterion: 'Links must resolve to entity-specific pages.',
          reason: `Rejected unsafe or invalid link for "${link.label}".`,
          evidence: link.url,
        });
      }
    }
  }

  if (requiresSubject) {
    for (const link of links) {
      if (
        !isForbiddenAnswerLabel(link.label, subjectText)
        && isSafeExternalUrl(link.url)
        && !answerLinkHasSubjectEvidence(task, answer, link, busEntries)
      ) {
        failures.push({
          criterion: 'Entities, facts, and output structure must match the current requested subject.',
          reason: `The label "${link.label}" is not supported as a requested-subject entity by the available evidence.`,
          evidence: link.label,
        });
      }
    }
  }

  if (requiresSubject && !answerMatchesCurrentSubject(task, answer, busEntries)) {
    failures.push({
      criterion: 'Entities, facts, and output structure must match the current requested subject.',
      reason: 'The final answer does not preserve the current requested subject.',
    });
  }

  if (requiresLocation && !answerHasLocationEvidence(task, answer, busEntries) && !honestInsufficientEvidence) {
    failures.push({
      criterion: 'Nearby results must include geographic or proximity evidence for the resolved location.',
      reason: 'The final answer lacks geographic or proximity evidence for the resolved location.',
    });
  }
  if (requiresLocation) {
    for (const link of validEntityLinks) {
      if (!answerLinkHasLocationEvidence(task, answer, link, busEntries)) {
        failures.push({
          criterion: 'Nearby results must include geographic or proximity evidence for the resolved location.',
          reason: `The entity "${link.label}" lacks per-entity location or proximity evidence.`,
          evidence: link.label,
        });
      }
    }
  }

  if (/AgentBus Result Write-back|candidate design|judge decision|voter:teacher/i.test(answer)) {
    failures.push({
      criterion: 'Final answer must be user-facing rather than process-facing.',
      reason: 'The final answer still contains internal AgentBus/process details.',
    });
  }

  return {
    passed: failures.length === 0,
    failures,
    criteria,
  };
}

function taskNeedsEntityResults(task: string): boolean {
  return /\b(?:best|top|worst|closest|most\s+popular|recommend(?:ed|ations?)?|list|find|search|near\s+me|nearby|around\s+me|local)\b/i.test(task)
    && /\b(?:restaurants?|theat(?:er|re)s?|cinemas?|bars?|pubs?|cafes?|coffee\s+shops?|parks?|shops?|stores?|places?|venues?|hotels?|museums?|schools?|doctors?|dentists?|gyms?|salons?)\b/i.test(task);
}

function taskNeedsLocationEvidence(task: string): boolean {
  return /\b(?:near\s+me|nearby|around\s+me|close\s+to\s+me|in\s+my\s+area|local|near|around|in)\b/i.test(task);
}

function extractMarkdownLinks(answer: string): Array<{ label: string; url: string }> {
  return [...answer.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)]
    .map((match) => ({ label: match[1].trim(), url: match[2].trim() }))
    .filter((link) => link.label && link.url);
}

function latestStructuredCandidateReport(busEntries: BusEntryStep[]): StructuredCandidateReport | undefined {
  for (const entry of [...busEntries].reverse()) {
    if (
      entry.actorId !== 'search-analyzer'
      || entry.payloadType !== String(PayloadType.Result)
      || !/validated-candidates/i.test(entry.summary)
    ) {
      continue;
    }
    const parsed = parseJsonDetail(entry.detail);
    if (!isRecord(parsed) || parsed.type !== 'validated-search-candidates') continue;
    const candidates = Array.isArray(parsed.candidates)
      ? parsed.candidates.flatMap((candidate) => {
        if (!isRecord(candidate) || typeof candidate.name !== 'string') return [];
        return [{
          name: candidate.name,
          validationStatus: typeof candidate.validationStatus === 'string' ? candidate.validationStatus : undefined,
          subjectMatch: candidate.subjectMatch === true,
          locationEvidence: Array.isArray(candidate.locationEvidence)
            ? candidate.locationEvidence.filter((item): item is string => typeof item === 'string')
            : [],
          entityLink: typeof candidate.entityLink === 'string' ? candidate.entityLink : undefined,
          sourceEvidence: Array.isArray(candidate.sourceEvidence)
            ? candidate.sourceEvidence.filter((item): item is string => typeof item === 'string')
            : [],
        }];
      })
      : [];
    const rejected = Array.isArray(parsed.rejected)
      ? parsed.rejected.flatMap((candidate) => {
        if (!isRecord(candidate) || typeof candidate.name !== 'string') return [];
        return [{
          name: candidate.name,
          validationStatus: typeof candidate.validationStatus === 'string' ? candidate.validationStatus : undefined,
          validationFailures: Array.isArray(candidate.validationFailures)
            ? candidate.validationFailures.filter((item): item is string => typeof item === 'string')
            : [],
        }];
      })
      : [];
    return { candidates, rejected };
  }
  return undefined;
}

function parseJsonDetail(detail: string): unknown {
  const jsonStart = detail.indexOf('{');
  if (jsonStart < 0) return undefined;
  try {
    return JSON.parse(detail.slice(jsonStart));
  } catch {
    return undefined;
  }
}

function normalizeComparable(value: string): string {
  return value.replace(/^['"]|['"]$/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function normalizeUrlForCompare(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/$/g, '');
  } catch {
    return value.trim().replace(/\/$/g, '');
  }
}

function isForbiddenAnswerLabel(label: string, subject?: string): boolean {
  const normalized = label.replace(/^['"]|['"]$/g, '').trim();
  return FORBIDDEN_ANSWER_LABEL_PATTERN.test(normalized)
    || FORBIDDEN_ANSWER_LABEL_WORD_PATTERN.test(normalized)
    || isGenericNonEntityLabel(normalized, subject);
}

function isEntityLikeLabel(label: string, subject?: string): boolean {
  const normalized = label.replace(/^['"]|['"]$/g, '').trim();
  if (isForbiddenAnswerLabel(normalized, subject)) return false;
  return /[A-Z0-9&]/.test(normalized) && normalized.length >= 2;
}

function isSafeExternalUrl(url: string): boolean {
  if (!url || /^#|^javascript:|^mailto:/i.test(url)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function answerMatchesCurrentSubject(task: string, answer: string, busEntries: BusEntryStep[]): boolean {
  const subjectText = inferSubjectText(task);
  if (!subjectText) return true;
  const subjectTokens = tokenSet(subjectText);
  const answerTokens = tokenSet(answer);
  if (overlapScore(answerTokens, subjectTokens) > 0) return true;
  const busText = busEntries.map((entry) => entry.detail).join('\n');
  return overlapScore(tokenSet(busText), subjectTokens) > 0;
}

function answerLinkHasSubjectEvidence(
  task: string,
  answer: string,
  link: { label: string; url: string },
  busEntries: BusEntryStep[],
): boolean {
  const subjectText = inferSubjectText(task);
  if (!subjectText) return true;
  const subjectTokens = tokenSet(subjectText);
  const labelContext = [
    answerLineForLabel(answer, link.label),
    ...busEntries
      .map((entry) => entry.detail)
      .filter((detail) => detail.toLocaleLowerCase().includes(link.label.toLocaleLowerCase())),
  ].join('\n');
  return overlapScore(tokenSet(labelContext), subjectTokens) > 0;
}

function answerHasLocationEvidence(task: string, answer: string, busEntries: BusEntryStep[]): boolean {
  const location = task.match(/\b(?:near|in|around)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*(?:,\s*[A-Z]{2})?)\b/)?.[1];
  if (!location) return /\bnear\b|\blocal\b|\bnearby\b|\bin\b/i.test(answer);
  const locationTokens = tokenSet(location);
  if (overlapScore(tokenSet(answer), locationTokens) > 0) return true;
  const busText = busEntries.map((entry) => entry.detail).join('\n');
  return overlapScore(tokenSet(busText), locationTokens) > 0;
}

function answerLinkHasLocationEvidence(
  task: string,
  answer: string,
  link: { label: string; url: string },
  busEntries: BusEntryStep[],
): boolean {
  const location = extractLocationHint(task, answer, busEntries);
  const line = answerLineForLabel(answer, link.label);
  const labelEvidence = [
    line,
    ...busEntries
      .map((entry) => entry.detail)
      .filter((detail) => detail.toLocaleLowerCase().includes(link.label.toLocaleLowerCase())),
  ].join('\n');
  if (location) {
    const locationTokens = tokenSet(location);
    if (overlapScore(tokenSet(labelEvidence), locationTokens) > 0) return true;
  }
  return /\bnear\b|\blocal\b|\bnearby\b|\bin\b|\bat\b|\bwithin\b|\bmiles?\b|\bminutes?\b/i.test(line);
}

function answerLineForLabel(answer: string, label: string): string {
  const lowerLabel = label.toLocaleLowerCase();
  return answer
    .split(/\n+/)
    .find((line) => line.toLocaleLowerCase().includes(lowerLabel)) ?? '';
}

function extractLocationHint(task: string, answer: string, busEntries: BusEntryStep[]): string | undefined {
  const taskLocation = task.match(/\b(?:near|in|around)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*(?:,\s*[A-Z]{2})?)\b/)?.[1];
  if (taskLocation) return taskLocation;
  const combined = [answer, ...busEntries.map((entry) => entry.detail)].join('\n');
  return combined.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*,\s*[A-Z]{2})\b/)?.[1];
}

function inferSubjectText(task: string): string {
  const normalized = task
    .replace(/^Orchestrator task.+$/gim, '')
    .replace(/^Workspace:.+$/gim, '')
    .replace(/^Original request:.+$/gim, '')
    .replace(/^Enhanced task prompt:\s*/gim, '')
    .replace(/^Verification criteria:.+$/gim, '')
    .replace(/^-.+$/gim, '')
    .replace(/\b(what(?:'re| are| is)|show|list|find|search|give me|recommend|the|best|top|worst|closest|most popular|near me|nearby|around me|close to me|in my area|local|please)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized;
}

function tokenSet(value: string): Set<string> {
  return new Set(value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9' ]/g, ' ')
    .split(/\s+/)
    .map((token) => (token.endsWith('s') && token.length > 4 ? token.slice(0, -1) : token))
    .filter((token) => token.length > 2 && !['the', 'and', 'for', 'near', 'with', 'what', 'are'].includes(token)));
}

function overlapScore(left: Set<string>, right: Set<string>): number {
  let score = 0;
  for (const token of left) {
    if (right.has(token)) score += 1;
  }
  return score;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function chooseRenderMode(text: string): 'markdown' | 'enriched-text' | 'text' {
  if (/\[[^\]]+\]\([^)]+\)/.test(text) || /^\s*\d+\.\s+/m.test(text)) return 'markdown';
  if (/https?:\/\//i.test(text)) return 'enriched-text';
  return 'text';
}

function postProcessorReflectionSummary(round: number): string {
  switch (round) {
    case 1:
      return 'remove internal process language and keep only user-facing substance.';
    case 2:
      return 'check that the response answers the original question instead of narrating AgentBus mechanics.';
    default:
      return 'verify linked labels are descriptive entity names and the final answer is concise.';
  }
}

function improveRenderedAnswer(
  text: string,
  task: string,
  round: number,
  preferences: { prefersCitations: boolean } = { prefersCitations: false },
): string {
  const withoutProcessSummary = stripInternalProcessSummary(text).trim();
  if (round === 1) return withoutProcessSummary;
  if (round === 2) return ensureTaskAlignedAnswer(withoutProcessSummary, task);
  const normalized = normalizeMarkdownLinkLabels(ensureTaskAlignedAnswer(withoutProcessSummary, task));
  return preferences.prefersCitations ? appendSourcesSection(normalized) : normalized;
}

function prefersCitationsFromBus(entries: BusEntryStep[]): boolean {
  return entries.some((entry) => (
    /preference\.response\.citations|prefers citations|citation preference/i.test(`${entry.summary}\n${entry.detail}`)
  ));
}

function appendSourcesSection(text: string): string {
  if (/^sources:/im.test(text)) return text.trim();
  const links = [...text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)]
    .map((match) => ({ label: match[1].trim(), url: match[2].trim() }))
    .filter((link, index, all) => (
      link.label
      && link.url
      && all.findIndex((candidate) => candidate.label === link.label && candidate.url === link.url) === index
    ))
    .slice(0, 6);
  if (links.length === 0) return text.trim();
  return [
    text.trim(),
    '',
    `Sources: ${links.map((link) => `[${link.label}](${link.url})`).join(', ')}`,
  ].join('\n');
}

function stripInternalProcessSummary(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return normalized;
  const lines = normalized.split('\n');
  const firstUserFacingLine = lines.findIndex((line) => {
    const trimmed = line.trim();
    return /^here\b/i.test(trimmed)
      || /^\d+\.\s+\[/.test(trimmed)
      || /^[-*]\s+\[/.test(trimmed)
      || /^[-*]\s+/.test(trimmed);
  });
  if (/AgentBus Result Write-back/i.test(normalized) && firstUserFacingLine > 0) {
    return lines.slice(firstUserFacingLine).join('\n').trim();
  }
  return lines
    .filter((line) => !/AgentBus Result Write-back/i.test(line))
    .join('\n')
    .trim();
}

function ensureTaskAlignedAnswer(text: string, task: string): string {
  if (!text.trim()) return text;
  const taskSubject = task
    .replace(/[’]/g, "'")
    .replace(/\bwhat're\b/ig, 'what are')
    .replace(/\bwhat's\b/ig, 'what is')
    .replace(/\b(?:what|which|where)\s+(?:are|is|were|was)\b/ig, ' ')
    .replace(/\b(?:the|a|an|best|top|near me|nearby|around me|close to me|in my area)\b/ig, ' ')
    .replace(/\?+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
  if (!taskSubject || text.toLocaleLowerCase().includes(taskSubject.split(' ')[0] ?? taskSubject)) {
    return text.trim();
  }
  return text.trim();
}

function normalizeMarkdownLinkLabels(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, rawLabel: string, url: string) => {
    const label = rawLabel
      .replace(/^\s*(?:popular|top|recommended|notable|current|local|nearby)?\s*(?:choices|picks|options|favorites|recommendations?|results|places|venues)?\s*(?:around|near|in)\s+[^,.;:]+?\s+(?:include|includes|including|are)\s+/i, '')
      .replace(/^\s*(?:include|includes|including)\s+/i, '')
      .trim();
    return `[${label || rawLabel}](${url})`;
  });
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
