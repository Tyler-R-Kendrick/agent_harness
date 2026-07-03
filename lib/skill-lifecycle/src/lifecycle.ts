import type { LifecycleThresholds, SkillLifecycleEntry, SkillLifecycleState } from './types';

/**
 * Default lifecycle thresholds, matching the Memp scaffold's calibration.
 */
export const DEFAULT_LIFECYCLE_THRESHOLDS: LifecycleThresholds = {
  promoteAfterSuccesses: 2,
  deprecateAfterFailures: 2,
  staleAfterTicks: 20,
};

/**
 * Pure lifecycle transition for a single skill/procedure entry.
 *
 * Mirrors the Memp scaffold's corrected `applyOutcome` logic:
 * - `candidate -> active` once accumulated successes reach
 *   {@link LifecycleThresholds.promoteAfterSuccesses}.
 * - `-> deprecated` when accumulated failures reach
 *   {@link LifecycleThresholds.deprecateAfterFailures}, OR when the entry is
 *   stale (unused for more than {@link LifecycleThresholds.staleAfterTicks}).
 *
 * Both deprecation paths are guarded by "not a same-tick success": a success on
 * the current tick refreshes `lastUsedTick` and can never deprecate the entry.
 *
 * The function is pure — it returns a new entry and never mutates its input.
 */
export function transitionSkillLifecycle(
  entry: SkillLifecycleEntry,
  outcome: { readonly success: boolean; readonly tick: number },
  thresholds: LifecycleThresholds,
): SkillLifecycleEntry {
  const { success, tick } = outcome;
  const successCount = entry.successCount + (success ? 1 : 0);
  const failureCount = entry.failureCount + (success ? 0 : 1);

  let state: SkillLifecycleState = entry.state;
  if (!success && failureCount >= thresholds.deprecateAfterFailures) {
    state = 'deprecated';
  } else if (!success && tick - entry.lastUsedTick > thresholds.staleAfterTicks) {
    state = 'deprecated';
  } else if (success && entry.state === 'candidate' && successCount >= thresholds.promoteAfterSuccesses) {
    state = 'active';
  }

  return {
    ...entry,
    successCount,
    failureCount,
    state,
    lastUsedTick: tick,
  };
}

/**
 * Retrieval score for a lifecycle entry against a queried task family.
 *
 * Deprecated entries and task-family mismatches score `0` (excluded from
 * retrieval). Otherwise the score is the task-family match (always `1` here)
 * multiplied by the entry's success ratio, where an entry with no observed
 * attempts defaults to `0.5`.
 */
export function scoreSkillRetrieval(entry: SkillLifecycleEntry, taskFamily: string): number {
  if (entry.state === 'deprecated' || entry.taskFamily !== taskFamily) {
    return 0;
  }
  const attempts = entry.successCount + entry.failureCount;
  const successRatio = attempts === 0 ? 0.5 : entry.successCount / attempts;
  return successRatio;
}
