import type { ReasoningTrace, VerificationStatus } from './schemas';

export interface GateOptions {
  hadRepair?: boolean;
}

function hasHighCritique(trace: ReasoningTrace): boolean {
  return trace.steps.some((step) => step.critique_labels.some((label) => label.severity === 'high'));
}

function hasFailedCheck(trace: ReasoningTrace): boolean {
  return trace.steps.some((step) => step.checker_results.some((result) => result.status === 'failed'));
}

function hasUnknownRequiredLean(trace: ReasoningTrace): boolean {
  const leanClaims = trace.formal_claims.filter((claim) => claim.formalization_target === 'lean');
  return leanClaims.some((claim) => claim.status !== 'passed') ||
    trace.steps.some((step) =>
      step.formalizable && step.checker_results.some((result) => result.checker_type === 'lean' && result.status === 'unknown'),
    );
}

function hasRequiredLean(trace: ReasoningTrace): boolean {
  return trace.formal_claims.some((claim) => claim.formalization_target === 'lean');
}

export function determineVerificationStatus(trace: ReasoningTrace, options: GateOptions = {}): VerificationStatus {
  if (hasHighCritique(trace) || hasFailedCheck(trace)) {
    return 'rejected';
  }
  if (hasUnknownRequiredLean(trace)) {
    return 'unverified';
  }
  if (options.hadRepair) {
    return 'corrected';
  }
  if (hasRequiredLean(trace)) {
    return 'hard_verified';
  }
  return 'soft_verified';
}
