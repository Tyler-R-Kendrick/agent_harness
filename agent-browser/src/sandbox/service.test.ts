import { describe, expect, it, vi } from 'vitest';
import { SandboxBootstrapError } from './iframe-session';
import { createSandboxExecutionService } from './service';
import type { SandboxSession, SandboxRunResult } from './service';
import type { SkillSandbox } from '@agent-harness/agent-sandbox';

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

  it('uses the agent sandbox provider for secure execution by default', async () => {
    const uploadFiles = vi.fn<SkillSandbox['uploadFiles']>().mockResolvedValue([
      { path: '/index.js', error: null },
    ]);
    const execute = vi.fn<SkillSandbox['execute']>().mockResolvedValue({
      output: 'hello from sandbox',
      exitCode: 0,
      truncated: false,
      durationMs: 7,
    });
    const downloadFiles = vi.fn<SkillSandbox['downloadFiles']>().mockResolvedValue([
      { path: '/dist/index.js', content: new TextEncoder().encode('built'), error: null },
    ]);
    const close = vi.fn<SkillSandbox['close']>().mockResolvedValue(undefined);
    const sandbox: SkillSandbox = {
      id: 'agent-sandbox-test',
      execute,
      uploadFiles,
      downloadFiles,
      reset: vi.fn().mockResolvedValue(undefined),
      close,
    };
    const service = createSandboxExecutionService({
      flags: {
        secureBrowserSandboxExec: true,
        disableWebContainerAdapter: true,
        allowSameOriginForWebContainer: false,
      },
      createAgentSandbox: () => sandbox,
    });

    const session = await service.createSession();
    const result = await session.run({
      files: [{ path: 'index.js', content: 'console.log("hello")' }],
      command: { command: 'node', args: ['index.js'] },
      capturePaths: ['dist/index.js'],
    });

    expect(uploadFiles).toHaveBeenCalledWith([['index.js', expect.any(Uint8Array)]]);
    expect(execute).toHaveBeenCalledWith('node index.js', { timeoutMs: undefined });
    expect(downloadFiles).toHaveBeenCalledWith(['dist/index.js']);
    expect(result.adapter).toBe('agent-sandbox');
    expect(result.status).toBe('succeeded');
    expect(result.artifacts).toEqual([{ path: '/dist/index.js', content: 'built', encoding: 'utf-8' }]);
    await session.dispose();
    expect(close).toHaveBeenCalled();
  });

  it('routes TypeScript and full Node build requests to the WebContainer agent sandbox when enabled', async () => {
    const uploadFiles = vi.fn<SkillSandbox['uploadFiles']>().mockResolvedValue([
      { path: '/src/index.ts', error: null },
      { path: '/package.json', error: null },
    ]);
    const execute = vi.fn<SkillSandbox['execute']>().mockResolvedValue({
      output: 'ts build ok',
      exitCode: 0,
      truncated: false,
      durationMs: 12,
    });
    const downloadFiles = vi.fn<SkillSandbox['downloadFiles']>().mockResolvedValue([]);
    const close = vi.fn<SkillSandbox['close']>().mockResolvedValue(undefined);
    const sandbox: SkillSandbox = {
      id: 'webcontainer-sandbox-test',
      execute,
      uploadFiles,
      downloadFiles,
      reset: vi.fn().mockResolvedValue(undefined),
      close,
    };
    const createAgentSandbox = vi.fn((_runtime: 'quickjs' | 'webcontainer') => sandbox);
    const service = createSandboxExecutionService({
      flags: {
        secureBrowserSandboxExec: true,
        disableWebContainerAdapter: false,
        allowSameOriginForWebContainer: true,
      },
      createAgentSandbox,
    });

    const session = await service.createSession();
    const result = await session.run({
      files: [
        { path: 'src/index.ts', content: 'export const value: string = "ok";' },
        { path: 'package.json', content: '{"scripts":{"build":"tsc --noEmit"}}' },
      ],
      command: { command: 'npm', args: ['run', 'build'] },
    });

    expect(createAgentSandbox).toHaveBeenCalledWith('webcontainer');
    expect(execute).toHaveBeenCalledWith('npm run build', { timeoutMs: undefined });
    expect(result.status).toBe('succeeded');
    await session.dispose();
    expect(close).toHaveBeenCalled();
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
