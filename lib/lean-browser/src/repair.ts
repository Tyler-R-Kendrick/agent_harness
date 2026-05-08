import type { FormalClaim, ReasoningStep, ReasoningTrace } from './schemas';

export function spliceRepairedSteps(
  trace: ReasoningTrace,
  failedSteps: ReasoningStep[],
  repairedSteps: ReasoningStep[],
): ReasoningTrace {
  const failedIds = new Set(failedSteps.map((step) => step.step_id));
  return {
    ...trace,
    steps: trace.steps.flatMap((step) => (failedIds.has(step.step_id) ? repairedSteps : [step])),
  };
}

export function applyUpdatedClaims(trace: ReasoningTrace, claims: FormalClaim[]): ReasoningTrace {
  if (claims.length === 0) {
    return trace;
  }
  const byId = new Map(claims.map((claim) => [claim.claim_id, claim]));
  const existing = trace.formal_claims.map((claim) => byId.get(claim.claim_id) ?? claim);
  const missing = claims.filter((claim) => !trace.formal_claims.some((existingClaim) => existingClaim.claim_id === claim.claim_id));
  return { ...trace, formal_claims: [...existing, ...missing] };
}

export function regionImproved(before: ReasoningTrace, after: ReasoningTrace, region: ReasoningStep): boolean {
  const previous = before.steps.find((step) => step.step_id === region.step_id);
  const next = after.steps.find((step) => step.step_id === region.step_id);
  return Boolean(previous && next && previous.text !== next.text && next.status !== 'failed');
}
