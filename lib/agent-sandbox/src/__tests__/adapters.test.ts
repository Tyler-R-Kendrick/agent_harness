import { describe, expect, it, vi } from 'vitest';
import { DeepAgentsBrowserSandboxAdapter } from '../adapters';
import type { SkillSandbox } from '../types';

describe('DeepAgentsBrowserSandboxAdapter', () => {
  it('delegates the structurally compatible sandbox methods', async () => {
    const sandbox: SkillSandbox = {
      id: 'adapter-test',
      execute: vi.fn().mockResolvedValue({ output: 'ok', exitCode: 0, truncated: false, durationMs: 1 }),
      uploadFiles: vi.fn().mockResolvedValue([{ path: '/a.js', error: null }]),
      downloadFiles: vi.fn().mockResolvedValue([{ path: '/a.js', content: new Uint8Array(), error: null }]),
      reset: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const adapter = new DeepAgentsBrowserSandboxAdapter(sandbox);

    await expect(adapter.execute('ls')).resolves.toMatchObject({ output: 'ok' });
    await expect(adapter.uploadFiles([['/a.js', new Uint8Array()]])).resolves.toEqual([{ path: '/a.js', error: null }]);
    await expect(adapter.downloadFiles(['/a.js'])).resolves.toEqual([{ path: '/a.js', content: new Uint8Array(), error: null }]);
  });
});
