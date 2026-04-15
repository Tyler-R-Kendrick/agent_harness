import { describe, expect, it, vi } from 'vitest';
import { SandboxBootstrapError } from './iframe-session';
import { createSandboxExecutionService } from './service';
import type { SandboxSession, SandboxRunResult } from './service';

function createResult(overrides: Partial<SandboxRunResult> = {}): SandboxRunResult {
  return {
    sessionId: 'session-1',
    runId: 'run-1',
    adapter: 'mock',
    status: 'succeeded',
    exitCode: 0,
    artifacts: [{ path: 'dist/index.js', content: 'built', encoding: 'utf-8' }],
    persistedArtifactPaths: [],
    metrics: undefined,
    transcript: {
      sessionId: 'session-1',
      runId: 'run-1',
      adapter: 'mock',
      startedAt: 1,
      endedAt: 2,
      events: [],
    },
    usedLegacyFallback: false,
    ...overrides,
  };
}

describe('sandbox execution service', () => {
  it('uses the legacy path when the feature flag is off', async () => {
    const service = createSandboxExecutionService({
      flags: {
        secureBrowserSandboxExec: false,
        disableWebContainerAdapter: false,
        allowSameOriginForWebContainer: false,
      },
      createLegacySession: () => ({
        run: vi.fn().mockResolvedValue(createResult()),
      }),
    });

    const session = await service.createSession();
    const result = await session.run({ files: [], command: { command: 'node' } });
    expect(result.usedLegacyFallback).toBe(true);
  });

  it('falls back to the legacy path when sandbox bootstrap fails before execution starts', async () => {
    const createIframeSession = (): SandboxSession => ({
      sessionId: 'sandbox-session',
      run: vi.fn().mockRejectedValue(new SandboxBootstrapError('Sandbox runner is unavailable with the current browser security settings.')),
      abort: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn().mockResolvedValue(undefined),
    });
    const service = createSandboxExecutionService({
      flags: {
        secureBrowserSandboxExec: true,
        disableWebContainerAdapter: false,
        allowSameOriginForWebContainer: false,
      },
      createIframeSession,
      createLegacySession: () => ({
        run: vi.fn().mockResolvedValue(createResult({ adapter: 'legacy' })),
      }),
    });

    const session = await service.createSession();
    const result = await session.run({ files: [], command: { command: 'node' } });
    expect(result.adapter).toBe('legacy');
    expect(result.usedLegacyFallback).toBe(true);
  });

  it('persists successful artifacts into the provided virtual filesystem', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const mkdir = vi.fn().mockResolvedValue(undefined);
    const service = createSandboxExecutionService({
      flags: {
        secureBrowserSandboxExec: true,
        disableWebContainerAdapter: false,
        allowSameOriginForWebContainer: false,
      },
      createIframeSession: () => ({
        sessionId: 'sandbox-session',
        run: vi.fn().mockResolvedValue(createResult()),
        abort: vi.fn().mockResolvedValue(undefined),
        dispose: vi.fn().mockResolvedValue(undefined),
      }),
      persistenceTarget: { mkdir, writeFile },
    });

    const session = await service.createSession();
    const result = await session.run({
      files: [],
      command: { command: 'node' },
      persist: { mode: 'just-bash', rootDir: '/workspace/output' },
    });

    expect(mkdir).toHaveBeenCalledWith('/workspace/output/dist', { recursive: true });
    expect(writeFile).toHaveBeenCalledWith('/workspace/output/dist/index.js', 'built', 'utf-8');
    expect(result.persistedArtifactPaths).toEqual(['/workspace/output/dist/index.js']);
  });
});
