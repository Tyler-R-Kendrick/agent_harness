import { describe, expect, it } from 'vitest';
import * as publicApi from 'ralph-loop';

describe('public API', () => {
  it('exposes the documented package entry point', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'PLAN_ONLY_PATTERN',
      'createHeuristicCompletionChecker',
      'isExecutionTask',
      'looksLikePlanOnly',
    ]);
  });
});
