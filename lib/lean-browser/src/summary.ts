import type { CheckerResult, ReasoningStep, ReasoningTrace, SummaryState } from './schemas';

export function findFailingRegions(trace: ReasoningTrace): ReasoningStep[] {
  return trace.steps.filter(
    (step) =>
      step.status === 'failed' ||
      step.critique_labels.some((label) => label.severity === 'high') ||
      step.checker_results.some((result) => result.status === 'failed'),
  );
}

export function collectCheckerFeedback(step: ReasoningStep): CheckerResult[] {
  return step.checker_results.filter((result) => result.status !== 'passed');
}

export function hasUnresolvedCriticalFailures(trace: ReasoningTrace): boolean {
  return findFailingRegions(trace).length > 0;
}

export function updateSummaryState(trace: ReasoningTrace): SummaryState {
  const accepted = trace.steps.filter((step) => step.status === 'accepted' || step.status === 'repaired');
  const failed = findFailingRegions(trace);
  const unknowns = trace.steps.flatMap((step) =>
    step.checker_results
      .filter((result) => result.status === 'unknown')
      .map((result) => `Lean check unknown for ${step.step_id}: ${result.message}`),
  );

  return {
    accepted_facts: accepted.map((step) => step.text),
    open_obligations: [
      ...unknowns,
      ...trace.formal_claims
        .filter((claim) => claim.formalization_target === 'none')
        .map((claim) => `Unformalized claim ${claim.claim_id}: ${claim.claim_text}`),
    ],
    failed_regions: failed.map((step) => step.step_id),
    best_partial_solutions: accepted.map((step) => step.text),
    abandoned_paths: trace.steps.filter((step) => step.status === 'discarded').map((step) => step.text),
  };
}
