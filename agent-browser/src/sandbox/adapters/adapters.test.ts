import { describe, expect, it, vi } from 'vitest';
import { MockExecutionAdapter } from './mock-adapter';
import { WebContainerExecutionAdapter } from './webcontainer-adapter';
import type { RunRequest } from '../protocol';

function createRequest(command: string): RunRequest {
  return {
    files: [{ path: 'index.js', content: 'console.log("hi")' }],
    command: { command, args: ['index.js'], cwd: '/workspace' },
    capturePaths: ['dist/index.js'],
  };
}

describe('execution adapters', () => {
  it('mock adapter emits deterministic output and artifacts', async () => {
    const adapter = new MockExecutionAdapter();
    const emitted: string[] = [];
    const result = await adapter.execute(createRequest('node'), {
      signal: new AbortController().signal,
      emit(event) {
        emitted.push(event.type);
      },
    });

    expect(emitted).toContain('stdout');
    expect(result.status).toBe('succeeded');
    expect(result.artifacts).toEqual([{ path: 'dist/index.js', content: 'generated:dist/index.js', encoding: 'utf-8' }]);
  });

  it('webcontainer adapter mounts files, streams output, and captures artifacts', async () => {
    const mount = vi.fn().mockResolvedValue(undefined);
    const readFile = vi.fn().mockResolvedValue('built output');
    const kill = vi.fn();
    const boot = vi.fn().mockResolvedValue({
      mount,
      fs: { readFile },
      teardown: vi.fn(),
      spawn: vi.fn().mockResolvedValue({
        output: new ReadableStream<string>({
          start(controller) {
            controller.enqueue('hello from webcontainer');
            controller.close();
          },
        }),
        exit: Promise.resolve(0),
        kill,
      }),
    });
    const adapter = new WebContainerExecutionAdapter({ boot });
    const events: string[] = [];

    const result = await adapter.execute(createRequest('node'), {
      signal: new AbortController().signal,
      emit(event) {
        events.push(event.type);
      },
    });

    expect(boot).toHaveBeenCalled();
    expect(mount).toHaveBeenCalled();
    expect(readFile).toHaveBeenCalledWith('dist/index.js', 'utf-8');
    expect(events).toContain('stdout');
    expect(result.status).toBe('succeeded');
    expect(result.artifacts?.[0]?.content).toBe('built output');
    expect(kill).not.toHaveBeenCalled();
  });
});
