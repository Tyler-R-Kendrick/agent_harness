import { describe, expect, it } from 'vitest';
import {
  createSandboxMessage,
  DEFAULT_MAX_MESSAGE_BYTES,
  resolveRunLimits,
  SANDBOX_CONTROL_RUN_ID,
  SANDBOX_PROTOCOL_VERSION,
  validateSandboxMessage,
} from './protocol';

describe('sandbox protocol', () => {
  const ids = { sessionId: 'session-1', runId: 'run-1' };

  it('accepts a valid run request message', () => {
    const message = createSandboxMessage('run_request', ids, {
      request: {
        title: 'hello-world',
        files: [{ path: 'index.js', content: 'console.log("hi")' }],
        command: { command: 'node', args: ['index.js'], cwd: '/workspace' },
        limits: { maxRuntimeMs: 1234 },
        metadata: { source: 'test' },
        capturePaths: ['dist/out.txt'],
        persist: { mode: 'just-bash', rootDir: '/workspace/build-output' },
      },
    }, 123);

    expect(validateSandboxMessage(message, { direction: 'host-to-runner' })).toEqual({
      ok: true,
      bytes: expect.any(Number),
      value: message,
    });
  });

  it('rejects unknown message types', () => {
    const message = {
      protocolVersion: SANDBOX_PROTOCOL_VERSION,
      sessionId: ids.sessionId,
      runId: ids.runId,
      timestamp: 1,
      type: 'run_whatever',
      payload: {},
    };

    const result = validateSandboxMessage(message);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/unknown/i);
    }
  });

  it('rejects invalid payloads', () => {
    const message = createSandboxMessage('run_stdout', ids, {
      chunk: 42,
      bytes: 'large',
    } as never);

    const result = validateSandboxMessage(message, { direction: 'runner-to-host' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/payload/i);
    }
  });

  it('rejects missing or mismatched protocol versions', () => {
    const message = {
      sessionId: ids.sessionId,
      runId: ids.runId,
      timestamp: 1,
      type: 'run_abort',
      payload: { reason: 'stop' },
    };

    const result = validateSandboxMessage(message);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/protocolVersion/i);
    }
  });

  it('rejects oversized payloads', () => {
    const chunk = 'x'.repeat(DEFAULT_MAX_MESSAGE_BYTES);
    const message = createSandboxMessage('run_stdout', ids, {
      chunk,
      bytes: chunk.length,
    });

    const result = validateSandboxMessage(message, { maxBytes: 64 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/byte limit/i);
    }
  });

  it('enforces expected session and run identifiers', () => {
    const message = createSandboxMessage('runner_ready', { sessionId: 'session-2', runId: SANDBOX_CONTROL_RUN_ID }, {
      adapter: 'mock',
      supportsAbort: true,
      networkPolicy: 'deny',
    });

    const result = validateSandboxMessage(message, {
      direction: 'runner-to-host',
      expectedSessionId: 'session-1',
      expectedRunId: SANDBOX_CONTROL_RUN_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/sessionId/i);
    }
  });

  it('merges partial run limits with safe defaults', () => {
    expect(resolveRunLimits({ maxRuntimeMs: 999 })).toEqual({
      maxRuntimeMs: 999,
      maxStdoutBytes: 32_768,
      maxStderrBytes: 32_768,
      maxLogBytes: 32_768,
      maxEventCount: 256,
      maxArtifactBytes: 65_536,
      maxWorkspaceBytes: 262_144,
    });
  });

  it('accepts terminal completion messages with captured artifacts', () => {
    const message = createSandboxMessage('run_done', ids, {
      exitCode: 0,
      status: 'succeeded',
      artifacts: [{ path: 'dist/index.js', content: 'console.log("ok")', encoding: 'utf-8' }],
    });

    expect(validateSandboxMessage(message, { direction: 'runner-to-host' })).toEqual({
      ok: true,
      bytes: expect.any(Number),
      value: message,
    });
  });
});