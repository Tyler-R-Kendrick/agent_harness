import type { LocalValidationModel, RepairRegionInput } from './modules';
import type { ReasoningStep, ReasoningTrace, SummaryState, TaskInput } from './schemas';
import { stringifyForPrompt } from './json';

type RepairInput = Parameters<LocalValidationModel['repairRegion']>[0] | RepairRegionInput;

const rules = [
  'Return one JSON object only.',
  'Do not return markdown fences.',
  'Do not invent evidence references.',
  'Mark unverifiable claims with formalization_target "none".',
  'For Lean claims, return a proposition in formal_expression and an optional proof.',
].join('\n');

export function generateTracePrompt(task: TaskInput): string {
  return `${rules}\nGenerate a reasoning trace for:\n${stringifyForPrompt(task)}`;
}

export function critiqueStepPrompt(
  step: ReasoningStep,
  acceptedSteps: ReasoningStep[],
  assumptions: string[],
): string {
  return `${rules}\nCritique this reasoning step.\nStep:\n${stringifyForPrompt(step)}\nAccepted:\n${stringifyForPrompt(
    acceptedSteps,
  )}\nAssumptions:\n${stringifyForPrompt(assumptions)}`;
}

export function critiqueTracePrompt(trace: ReasoningTrace): string {
  return `${rules}\nCritique the full trace and return {"global_issues":[],"open_obligations":[]}.\n${stringifyForPrompt(trace)}`;
}

export function formalizeClaimPrompt(step: ReasoningStep, goal: string): string {
  return `${rules}\nFormalize this step for goal "${goal}". Return a FormalClaim JSON object.\n${stringifyForPrompt(step)}`;
}

export function repairRegionPrompt(input: RepairInput): string {
  return `${rules}\nRepair the failed region and return repaired_steps, updated_formal_claims, and local_justification.\n${stringifyForPrompt(
    input,
  )}`;
}

export function aggregateAttemptsPrompt(partialTraces: ReasoningTrace[], summaryState: SummaryState): string {
  return `${rules}\nAggregate partial traces into the best trace.\n${stringifyForPrompt({ partialTraces, summaryState })}`;
}

export function gateAnswerPrompt(trace: ReasoningTrace, summaryState: SummaryState): string {
  return `${rules}\nGate the final answer with final_answer, verification_status, and rationale.\n${stringifyForPrompt({
    trace,
    summaryState,
  })}`;
}
