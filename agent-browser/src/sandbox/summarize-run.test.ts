import { describe, expect, it } from 'vitest';
import { buildRunSummaryInput } from './summarize-run';

describe('run summary shaping', () => {
  it('preserves event ordering and treats HTML-like output as plain text', () => {
    const summary = buildRunSummaryInput({
      sessionId: 'session-1',
      runId: 'run-1',
      adapter: 'mock',
      status: 'failed',
      exitCode: 1,
      reason: 'boom',
      artifacts: [],
      persistedArtifactPaths: [],
      metrics: undefined,
      transcript: {
        sessionId: 'session-1',
        runId: 'run-1',
        adapter: 'mock',
        startedAt: 1,
        endedAt: 2,
        events: [
          { type: 'stdout', payload: { chunk: '<script>alert(1)</script>', bytes: 25 }, timestamp: 1 },
          { type: 'stderr', payload: { chunk: 'plain stderr', bytes: 12 }, timestamp: 2 },
          { type: 'test_result', payload: { suite: 'suite', name: 'case', status: 'failed', details: 'assertion' }, timestamp: 3 },
        ],
      },
      usedLegacyFallback: false,
    });

    expect(summary.stdout).toEqual(['<script>alert(1)</script>']);
    expect(summary.stderr).toEqual(['plain stderr']);
    expect(summary.testResults[0]?.details).toBe('assertion');
    expect(summary.counts.stdoutChunks).toBe(1);
  });
});