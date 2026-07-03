import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIFECYCLE_THRESHOLDS,
  scoreSkillRetrieval,
  transitionSkillLifecycle,
} from '../lifecycle';
import type { LifecycleThresholds, SkillLifecycleEntry } from '../types';

const THRESHOLDS: LifecycleThresholds = {
  promoteAfterSuccesses: 2,
  deprecateAfterFailures: 2,
  staleAfterTicks: 20,
};

function entry(overrides: Partial<SkillLifecycleEntry> = {}): SkillLifecycleEntry {
  return {
    id: 'S1',
    taskFamily: 'export-report',
    procedure: 'open menu > export > pick CSV > confirm',
    successCount: 0,
    failureCount: 0,
    state: 'candidate',
    lastUsedTick: 0,
    ...overrides,
  };
}

describe('transitionSkillLifecycle', () => {
  it('exposes calibrated default thresholds', () => {
    expect(DEFAULT_LIFECYCLE_THRESHOLDS).toEqual({
      promoteAfterSuccesses: 2,
      deprecateAfterFailures: 2,
      staleAfterTicks: 20,
    });
  });

  it('promotes candidate -> active once enough successes accumulate', () => {
    const start = entry({ state: 'candidate', successCount: 1, lastUsedTick: 1 });
    const next = transitionSkillLifecycle(start, { success: true, tick: 2 }, THRESHOLDS);
    expect(next.state).toBe('active');
    expect(next.successCount).toBe(2);
    expect(next.lastUsedTick).toBe(2);
  });

  it('leaves a candidate as candidate when successes are still below threshold', () => {
    const start = entry({ state: 'candidate', successCount: 0, lastUsedTick: 1 });
    const next = transitionSkillLifecycle(start, { success: true, tick: 2 }, THRESHOLDS);
    expect(next.state).toBe('candidate');
    expect(next.successCount).toBe(1);
  });

  it('deprecates active -> deprecated once enough failures accumulate', () => {
    const start = entry({ state: 'active', failureCount: 1, lastUsedTick: 5 });
    const next = transitionSkillLifecycle(start, { success: false, tick: 6 }, THRESHOLDS);
    expect(next.state).toBe('deprecated');
    expect(next.failureCount).toBe(2);
  });

  it('deprecates active -> deprecated on staleness when the outcome is a failure', () => {
    const start = entry({ state: 'active', failureCount: 0, lastUsedTick: 0 });
    const staleThresholds: LifecycleThresholds = { ...THRESHOLDS, deprecateAfterFailures: 5 };
    const next = transitionSkillLifecycle(start, { success: false, tick: 25 }, staleThresholds);
    expect(next.state).toBe('deprecated');
    expect(next.failureCount).toBe(1);
  });

  it('does NOT deprecate on a same-tick success even when the entry would be stale', () => {
    const start = entry({ state: 'active', successCount: 5, failureCount: 0, lastUsedTick: 0 });
    const next = transitionSkillLifecycle(start, { success: true, tick: 100 }, THRESHOLDS);
    expect(next.state).toBe('active');
    expect(next.lastUsedTick).toBe(100);
  });

  it('leaves an active entry unchanged on a non-deprecating, non-stale failure', () => {
    const start = entry({ state: 'active', failureCount: 0, lastUsedTick: 20 });
    const gentleThresholds: LifecycleThresholds = { ...THRESHOLDS, deprecateAfterFailures: 5 };
    const next = transitionSkillLifecycle(start, { success: false, tick: 25 }, gentleThresholds);
    expect(next.state).toBe('active');
    expect(next.failureCount).toBe(1);
  });

  it('does not mutate the input entry', () => {
    const start = entry({ state: 'candidate', successCount: 1, lastUsedTick: 1 });
    const snapshot = { ...start };
    transitionSkillLifecycle(start, { success: true, tick: 2 }, THRESHOLDS);
    expect(start).toEqual(snapshot);
  });
});

describe('scoreSkillRetrieval', () => {
  it('scores 0 for a deprecated entry', () => {
    const deprecated = entry({ state: 'deprecated', successCount: 5 });
    expect(scoreSkillRetrieval(deprecated, 'export-report')).toBe(0);
  });

  it('scores 0 for a task-family mismatch', () => {
    const active = entry({ state: 'active', taskFamily: 'export-report', successCount: 3 });
    expect(scoreSkillRetrieval(active, 'ingest-report')).toBe(0);
  });

  it('scores the success ratio for a matching, non-deprecated entry', () => {
    const active = entry({ state: 'active', successCount: 3, failureCount: 1 });
    expect(scoreSkillRetrieval(active, 'export-report')).toBeCloseTo(0.75, 10);
  });

  it('scores a neutral 0.5 for a matching entry with no observed attempts', () => {
    const fresh = entry({ state: 'candidate', successCount: 0, failureCount: 0 });
    expect(scoreSkillRetrieval(fresh, 'export-report')).toBe(0.5);
  });
});
