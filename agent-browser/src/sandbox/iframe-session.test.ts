import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IframeSandboxSession } from './iframe-session';
import { createSandboxMessage } from './protocol';

describe('iframe sandbox session', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a hidden sandboxed iframe only when run starts', async () => {
    const session = new IframeSandboxSession({
      flags: {
        secureBrowserSandboxExec: true,
        disableWebContainerAdapter: false,
        allowSameOriginForWebContainer: false,
      },
      preferredAdapter: 'mock',
      destroyOnCompletion: false,
      idFactory: (prefix) => prefix === 'sandbox-session' ? 'session-fixed' : 'run-fixed',
    });

    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    const runPromise = session.run({
      files: [{ path: 'index.js', content: 'console.log("hi")' }],
      command: { command: 'node', args: ['index.js'] },
    });
    const iframe = document.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.hidden).toBe(true);
    expect(iframe?.getAttribute('aria-hidden')).toBe('true');
    expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts');
    await session.dispose();
    await expect(runPromise).rejects.toThrow(/disposed/i);
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('ignores messages from unexpected sources', async () => {
    const session = new IframeSandboxSession({
      flags: {
        secureBrowserSandboxExec: true,
        disableWebContainerAdapter: false,
        allowSameOriginForWebContainer: false,
      },
      preferredAdapter: 'mock',
      destroyOnCompletion: false,
      idFactory: (prefix) => prefix === 'sandbox-session' ? 'session-fixed-2' : 'run-fixed-2',
    });

    const runPromise = session.run({
      files: [{ path: 'index.js', content: 'console.log("hi")' }],
      command: { command: 'node', args: ['index.js'] },
    });
    const iframe = document.querySelector('iframe');
    const fakeContentWindow = { postMessage: vi.fn(), close: vi.fn() } as unknown as Window;
    Object.defineProperty(iframe as HTMLIFrameElement, 'contentWindow', { configurable: true, value: fakeContentWindow });

    window.dispatchEvent(new MessageEvent('message', {
      data: createSandboxMessage('runner_ready', { sessionId: session.sessionId, runId: '__session__' }, {
        adapter: 'mock',
        supportsAbort: true,
        networkPolicy: 'deny',
      }),
      origin: 'null',
      source: window,
    }));

    await Promise.resolve();
    vi.advanceTimersByTime(2000);
    await expect(runPromise).rejects.toThrow(/did not signal readiness/i);
    await session.dispose();
  });
});
