import type { ExecutionArtifact, RunRequest } from '../protocol';
import type { AdapterExecutionContext, AdapterExecutionResult, ExecutionAdapter } from './base';

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function createMockArtifacts(request: RunRequest): ExecutionArtifact[] {
  const fileMap = new Map(request.files.map((file) => [file.path, file.content]));
  return (request.capturePaths ?? []).map((path) => ({
    path,
    content: fileMap.get(path) ?? `generated:${path}`,
    encoding: 'utf-8',
  }));
}

export class MockExecutionAdapter implements ExecutionAdapter {
  readonly kind = 'mock' as const;
  readonly supportsAbort = true;

  canHandle(): boolean {
    return true;
  }

  async execute(request: RunRequest, context: AdapterExecutionContext): Promise<AdapterExecutionResult> {
    if (context.signal.aborted) {
      return { exitCode: 130, status: 'aborted', reason: 'Run aborted before execution started.' };
    }

    context.emit({
      type: 'log',
      level: 'info',
      chunk: `mock adapter executing ${request.command.command}`,
      bytes: `mock adapter executing ${request.command.command}`.length,
    });

    await delay(5);

    if (context.signal.aborted) {
      return { exitCode: 130, status: 'aborted', reason: 'Run aborted.' };
    }

    const stdoutChunk = `executed ${request.command.command}${request.command.args?.length ? ` ${request.command.args.join(' ')}` : ''}`;
    context.emit({ type: 'stdout', chunk: stdoutChunk, bytes: stdoutChunk.length });

    if (request.command.command.includes('test')) {
      context.emit({
        type: 'test_result',
        payload: {
          suite: 'mock-suite',
          name: 'mock test',
          status: 'passed',
          durationMs: 4,
          details: 'mock adapter deterministic test result',
        },
      });
    }

    if (request.command.command.includes('fail')) {
      const stderrChunk = 'mock adapter simulated failure';
      context.emit({ type: 'stderr', chunk: stderrChunk, bytes: stderrChunk.length });
      return {
        exitCode: 1,
        status: 'failed',
        reason: 'Mock adapter failure',
        metrics: {
          wallClockMs: 5,
          stdoutBytes: stdoutChunk.length,
          stderrBytes: stderrChunk.length,
          logBytes: `mock adapter executing ${request.command.command}`.length,
          eventCount: request.command.command.includes('test') ? 3 : 2,
          artifactBytes: 0,
        },
      };
    }

    const artifacts = createMockArtifacts(request);
    return {
      exitCode: 0,
      status: 'succeeded',
      artifacts,
      metrics: {
        wallClockMs: 5,
        stdoutBytes: stdoutChunk.length,
        stderrBytes: 0,
        logBytes: `mock adapter executing ${request.command.command}`.length,
        eventCount: request.command.command.includes('test') ? 3 : 2,
        artifactBytes: artifacts.reduce((total, artifact) => total + artifact.content.length, 0),
      },
    };
  }
}
