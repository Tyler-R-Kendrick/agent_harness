import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSandboxMessage } from './protocol';
import { createSandboxRunnerController } from './runner';

describe('sandbox runner controller', () => {
  let listener: ((event: MessageEvent<unknown>) => void) | null = null;
  const posted: unknown[] = [];

  beforeEach(() => {
    posted.length = 0;
    listener = null;
  });

  function createHost() {
    return {
      postMessage(message: unknown) {
        posted.push(message);
      },
      addEventListener(_type: 'message', nextListener: (event: MessageEvent<unknown>) => void) {
        listener = nextListener;
      },
      removeEventListener() {
        listener = null;
      },
    };
  }

  it('emits runner_ready and handles a successful mock run', async () => {
    const controller = createSandboxRunnerController({
      sessionId: 'session-1',
      parentOrigin: 'null',
      preferredAdapter: 'mock',
      webContainerAllowed: false,
    }, createHost());
    controller.start();

    await Promise.resolve();

    expect((posted[0] as { type: string }).type).toBe('runner_ready');
    await listener?.(new MessageEvent('message', {
      data: createSandboxMessage('run_request', { sessionId: 'session-1', runId: 'run-1' }, {
        request: {
          files: [{ path: 'index.js', content: 'console.log("hi")' }],
          command: { command: 'node', args: ['index.js'] },
          capturePaths: ['dist/index.js'],
        },
      }),
    }));

    await Promise.resolve();
    expect(posted.some((message) => (message as { type: string }).type === 'run_ack')).toBe(true);
    expect(posted.some((message) => (message as { type: string }).type === 'run_done')).toBe(true);
    await controller.stop();
  });

  it('refuses a second active run', async () => {
    vi.useFakeTimers();
    const controller = createSandboxRunnerController({
      sessionId: 'session-2',
      parentOrigin: 'null',
      preferredAdapter: 'mock',
      webContainerAllowed: false,
    }, createHost());
    controller.start();

    listener?.(new MessageEvent('message', {
      data: createSandboxMessage('run_request', { sessionId: 'session-2', runId: 'run-1' }, {
        request: {
          files: [{ path: 'index.js', content: 'console.log("hi")' }],
          command: { command: 'node', args: ['index.js'] },
        },
      }),
    }));
    listener?.(new MessageEvent('message', {
      data: createSandboxMessage('run_request', { sessionId: 'session-2', runId: 'run-2' }, {
        request: {
          files: [{ path: 'index.js', content: 'console.log("hi")' }],
          command: { command: 'node', args: ['index.js'] },
        },
      }),
    }));

    await Promise.resolve();
    expect(posted.some((message) => (message as { type: string }).type === 'run_error')).toBe(true);
    await controller.stop();
  });
});
