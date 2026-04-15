import type { RunMetricsMessage, RunTerminalStatus, RunTestResultMessage } from './protocol';
import type { SandboxRunResult, TranscriptEvent } from './service';

export interface RunSummaryInput {
  metadata: {
    sessionId: string;
    runId: string;
    adapter: string;
    startedAt: number;
    endedAt: number;
    status: RunTerminalStatus;
    exitCode: number;
    reason?: string;
  };
  counts: {
    stdoutChunks: number;
    stderrChunks: number;
    logChunks: number;
    testResults: number;
    artifactCount: number;
  };
  stdout: string[];
  stderr: string[];
  logs: Array<{ level: string; text: string }>;
  testResults: RunTestResultMessage['payload'][];
  metrics?: RunMetricsMessage['payload'];
  finalStatus: string;
  persistedArtifactPaths: string[];
}

function collectChunks(events: TranscriptEvent[], type: 'stdout' | 'stderr') {
  return events
    .filter((event): event is Extract<TranscriptEvent, { type: 'stdout' | 'stderr' }> => event.type === type)
    .map((event) => event.payload.chunk);
}

function collectLogs(events: TranscriptEvent[]) {
  return events
    .filter((event) => event.type === 'log')
    .map((event) => ({ level: event.payload.level, text: event.payload.chunk }));
}

function collectTestResults(events: TranscriptEvent[]) {
  return events
    .filter((event) => event.type === 'test_result')
    .map((event) => event.payload);
}

export function buildRunSummaryInput(result: SandboxRunResult): RunSummaryInput {
  const stdout = collectChunks(result.transcript.events, 'stdout');
  const stderr = collectChunks(result.transcript.events, 'stderr');
  const logs = collectLogs(result.transcript.events);
  const testResults = collectTestResults(result.transcript.events);

  return {
    metadata: {
      sessionId: result.sessionId,
      runId: result.runId,
      adapter: result.adapter,
      startedAt: result.transcript.startedAt,
      endedAt: result.transcript.endedAt,
      status: result.status,
      exitCode: result.exitCode,
      reason: result.reason,
    },
    counts: {
      stdoutChunks: stdout.length,
      stderrChunks: stderr.length,
      logChunks: logs.length,
      testResults: testResults.length,
      artifactCount: result.artifacts.length,
    },
    stdout,
    stderr,
    logs,
    testResults,
    metrics: result.metrics,
    finalStatus: `${result.status}:${result.exitCode}`,
    persistedArtifactPaths: [...result.persistedArtifactPaths],
  };
}
