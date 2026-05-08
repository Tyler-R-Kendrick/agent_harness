import { BrowserLeanChecker } from './checkers/leanChecker';
import { determineVerificationStatus } from './gate';
import type { LocalValidationModel } from './modules';
import { applyUpdatedClaims, regionImproved, spliceRepairedSteps } from './repair';
import type { AgentResult, FormalClaim, ReasoningStep, ReasoningTrace, TaskInput } from './schemas';
import {
  collectCheckerFeedback,
  findFailingRegions,
  hasUnresolvedCriticalFailures,
  updateSummaryState,
} from './summary';

export interface RunAgentBrowserOptions {
  llm: LocalValidationModel;
  leanChecker: BrowserLeanChecker;
  maxRepairAttemptsPerRegion?: number;
}

function isAcceptedStep(step: ReasoningStep): boolean {
  return step.status === 'accepted' || step.status === 'repaired';
}

async function critiqueAll(trace: ReasoningTrace, llm: LocalValidationModel): Promise<ReasoningTrace> {
  const acceptedSteps = trace.steps.filter(isAcceptedStep);
  const steps = [];
  for (const step of trace.steps) {
    steps.push({
      ...step,
      critique_labels: await llm.critiqueStep(step, acceptedSteps, trace.assumptions),
    });
  }
  const global = await llm.critiqueTrace({ ...trace, steps });
  return {
    ...trace,
    steps,
    summary_state: {
      ...trace.summary_state,
      open_obligations: [...trace.summary_state.open_obligations, ...global.open_obligations],
    },
  };
}

async function formalizeAll(trace: ReasoningTrace, llm: LocalValidationModel, task: TaskInput): Promise<ReasoningTrace> {
  const claims: FormalClaim[] = [];
  for (const step of trace.steps) {
    if (step.formalizable) {
      claims.push(await llm.formalizeClaim(step, task.goal));
    }
  }
  return { ...trace, formal_claims: claims };
}

async function runChecks(
  trace: ReasoningTrace,
  leanChecker: BrowserLeanChecker,
): Promise<{ trace: ReasoningTrace; artifacts: Record<string, unknown>[] }> {
  const artifacts: Record<string, unknown>[] = [];
  const claims = new Map(trace.formal_claims.map((claim) => [claim.source_step_id, claim]));
  const steps = [];
  const formalClaims = [];

  for (const step of trace.steps) {
    const claim = claims.get(step.step_id);
    if (!claim || claim.formalization_target !== 'lean') {
      const status = step.critique_labels.some((label) => label.severity === 'high') ? 'failed' as const : 'accepted' as const;
      steps.push({ ...step, status });
      if (claim) {
        formalClaims.push({ ...claim, status: 'not_applicable' as const });
      }
      continue;
    }

    const check = await leanChecker.check(claim, trace.assumptions);
    artifacts.push({ claim_id: claim.claim_id, status: check.status, message: check.message, artifact_ref: check.artifact_ref });
    const status = check.status === 'failed' || step.critique_labels.some((label) => label.severity === 'high')
      ? 'failed' as const
      : 'accepted' as const;
    steps.push({ ...step, checker_results: [check], status });
    formalClaims.push({
      ...claim,
      status: check.status === 'passed' ? 'passed' as const : check.status === 'failed' ? 'failed' as const : 'pending' as const,
      artifact_ref: check.artifact_ref,
    });
  }

  const nextTrace = { ...trace, steps, formal_claims: formalClaims };
  return { trace: { ...nextTrace, summary_state: updateSummaryState(nextTrace) }, artifacts };
}

export async function runAgentBrowser(task: TaskInput, options: RunAgentBrowserOptions): Promise<AgentResult> {
  const maxRepairAttempts = options.maxRepairAttemptsPerRegion ?? 3;
  let trace = await options.llm.generateTrace(task);
  trace = await critiqueAll(trace, options.llm);
  trace = await formalizeAll(trace, options.llm, task);
  let checked = await runChecks(trace, options.leanChecker);
  trace = checked.trace;

  const checkerArtifacts = [...checked.artifacts];
  const repairHistory: Record<string, unknown>[] = [];
  const repairAttempts = new Map<string, number>();
  let hadRepair = false;

  for (let iteration = 0; iteration < task.max_iterations; iteration++) {
    const failingRegions = findFailingRegions(trace);
    if (failingRegions.length === 0) {
      break;
    }

    let repairedAny = false;
    for (const region of failingRegions) {
      const attempts = repairAttempts.get(region.step_id) ?? 0;
      if (attempts >= maxRepairAttempts) {
        continue;
      }
      repairAttempts.set(region.step_id, attempts + 1);

      const repair = await options.llm.repairRegion({
        failed_steps: [region],
        accepted_steps: trace.steps.filter(isAcceptedStep),
        assumptions: trace.assumptions,
        checker_feedback: collectCheckerFeedback(region),
        summary_state: trace.summary_state,
        local_objective: `Repair step ${region.step_id}: ${region.text}`,
      });

      let candidate = spliceRepairedSteps(trace, [region], repair.repaired_steps);
      candidate = applyUpdatedClaims(candidate, repair.updated_formal_claims);
      candidate = await critiqueAll(candidate, options.llm);
      candidate = await formalizeAll(candidate, options.llm, task);
      const candidateChecked = await runChecks(candidate, options.leanChecker);
      checkerArtifacts.push(...candidateChecked.artifacts);

      if (regionImproved(trace, candidateChecked.trace, region)) {
        trace = candidateChecked.trace;
        repairedAny = true;
        hadRepair = true;
        repairHistory.push({ iteration, step_id: region.step_id, attempt: attempts + 1 });
      }
    }

    trace = { ...trace, summary_state: updateSummaryState(trace) };
    if (!repairedAny) {
      trace = await options.llm.aggregateAttempts([trace], trace.summary_state);
      trace = await critiqueAll(trace, options.llm);
      trace = await formalizeAll(trace, options.llm, task);
      checked = await runChecks(trace, options.leanChecker);
      trace = checked.trace;
      checkerArtifacts.push(...checked.artifacts);
    }
    if (hasUnresolvedCriticalFailures(trace)) {
      continue;
    }
  }

  const fallbackStatus = determineVerificationStatus(trace, { hadRepair });
  const gate = await options.llm.gateAnswer(trace, trace.summary_state);
  const verification_status = fallbackStatus === 'hard_verified' || fallbackStatus === 'corrected'
    ? fallbackStatus
    : gate.verification_status === 'hard_verified'
      ? fallbackStatus
      : fallbackStatus;

  return {
    task_id: task.task_id,
    final_answer: gate.final_answer || null,
    verification_status,
    accepted_steps: trace.steps.filter(isAcceptedStep),
    failed_steps: trace.steps.filter((step) => step.status === 'failed'),
    checker_artifacts: checkerArtifacts,
    repair_history: repairHistory,
    summary_state: trace.summary_state,
  };
}
