import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserSandboxProvider } from '../BrowserSandboxProvider';
import { SandboxClosedError, SandboxExecutionError, SandboxTimeoutError } from '../errors';
import type { SandboxWorkerMessage, SandboxWorkerResponse } from '../types';
import { SandboxWorkerRuntime } from '../workerRuntime';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytes(content: string): Uint8Array {
  return encoder.encode(content);
}

function text(content: Uint8Array | null): string | null {
  return content ? decoder.decode(content) : null;
}

type MessageListener = (event: MessageEvent<SandboxWorkerResponse>) => void;
type ErrorListener = (event: ErrorEvent) => void;

class RuntimeWorker {
  terminated = false;
  readonly runtime = new SandboxWorkerRuntime();
  private readonly messageListeners = new Set<MessageListener>();
  private readonly errorListeners = new Set<ErrorListener>();

  addEventListener(type: 'message' | 'error', listener: MessageListener | ErrorListener): void {
    if (type === 'message') {
      this.messageListeners.add(listener as MessageListener);
      return;
    }
    this.errorListeners.add(listener as ErrorListener);
  }

  removeEventListener(type: 'message' | 'error', listener: MessageListener | ErrorListener): void {
    if (type === 'message') {
      this.messageListeners.delete(listener as MessageListener);
      return;
    }
    this.errorListeners.delete(listener as ErrorListener);
  }

  postMessage(message: SandboxWorkerMessage): void {
    if (this.terminated) {
      return;
    }
    void this.handle(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  private emit(response: SandboxWorkerResponse): void {
    for (const listener of this.messageListeners) {
      listener({ data: response } as MessageEvent<SandboxWorkerResponse>);
    }
  }

  private async handle(message: SandboxWorkerMessage): Promise<void> {
    try {
      const result = await this.runtime.handleRequest(message);
      this.emit({ id: message.id, ok: true, result });
    } catch (error) {
      this.emit({
        id: message.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

class RejectingWorker extends RuntimeWorker {
  override postMessage(message: SandboxWorkerMessage): void {
    this['emit']({ id: message.id, ok: false, error: 'worker says no' });
  }
}

class ErroringWorker extends RuntimeWorker {
  override postMessage(message: SandboxWorkerMessage): void {
    if (message.op === 'configure') {
      super.postMessage(message);
      return;
    }
    for (const listener of this['errorListeners']) {
      listener({ message: 'worker exploded' } as ErrorEvent);
    }
  }
}

class EmptyMessageErroringWorker extends RuntimeWorker {
  override postMessage(message: SandboxWorkerMessage): void {
    if (message.op === 'configure') {
      super.postMessage(message);
      return;
    }
    for (const listener of this['errorListeners']) {
      listener({ message: '' } as ErrorEvent);
    }
  }
}

class NoisyWorker extends RuntimeWorker {
  override postMessage(message: SandboxWorkerMessage): void {
    this['emit']({ id: 9999, ok: true, result: null });
    super.postMessage(message);
  }
}

class LargeOutputWorker extends RuntimeWorker {
  override postMessage(message: SandboxWorkerMessage): void {
    if (message.op === 'configure') {
      super.postMessage(message);
      return;
    }
    if (message.op === 'execute') {
      this['emit']({
        id: message.id,
        ok: true,
        result: {
          output: '123456789012345678901234567890',
          exitCode: 0,
          truncated: false,
          durationMs: 1,
        },
      });
      return;
    }
    super.postMessage(message);
  }
}

class HangingWorker {
  terminated = false;

  addEventListener(): void {}
  removeEventListener(): void {}
  postMessage(): void {}

  terminate(): void {
    this.terminated = true;
  }
}

function createSandbox(worker = new RuntimeWorker(), options: ConstructorParameters<typeof BrowserSandboxProvider>[0] = {}): BrowserSandboxProvider {
  return new BrowserSandboxProvider({
    id: 'sandbox-test',
    workerFactory: () => worker,
    ...options,
  });
}

describe('BrowserSandboxProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is an agent sandbox subclass with worker, virtual filesystem, and wasm compute capabilities', () => {
    const sandbox = createSandbox();

    expect(sandbox.id).toBe('sandbox-test');
    expect(sandbox.kind).toBe('agent');
    expect(sandbox.isolation.kind).toBe('worker');
    expect(sandbox.fileSystem.kind).toBe('virtual');
    expect(sandbox.compute.kind).toBe('wasm-js');
  });

  it('creates module workers and configures sandbox options before user requests', async () => {
    let createdUrl: URL | null = null;
    let createdOptions: WorkerOptions | null = null;
    class CapturingWorker extends RuntimeWorker {
      constructor(url: URL, options: WorkerOptions) {
        super();
        createdUrl = url;
        createdOptions = options;
      }
    }
    vi.stubGlobal('Worker', CapturingWorker);

    const sandbox = new BrowserSandboxProvider({
      workerUrl: new URL('https://example.test/custom-worker.js?existing=1'),
      defaultTimeoutMs: 123,
      maxOutputBytes: 456,
      maxFileBytes: 4,
      maxTotalBytes: 1000,
      allowNetwork: true,
    });

    expect(createdOptions).toEqual({ type: 'module' });
    expect(createdUrl?.searchParams.get('existing')).toBe('1');
    await expect(sandbox.execute('write /too-large.txt MTIzNDU2Nzg5MDE=')).resolves.toMatchObject({
      exitCode: 1,
      output: expect.stringContaining('exceeds the 4 byte'),
    });
    expect(sandbox.id).toMatch(/^browser-sandbox-/);
    await sandbox.close();
    await expect(sandbox.close()).resolves.toBeUndefined();
  });

  it('uses the statically bundled sandbox worker URL when no worker URL is provided', async () => {
    let createdUrl: URL | null = null;
    let createdOptions: WorkerOptions | null = null;
    class CapturingWorker extends RuntimeWorker {
      constructor(url: URL, options: WorkerOptions) {
        super();
        createdUrl = url;
        createdOptions = options;
      }
    }
    vi.stubGlobal('Worker', CapturingWorker);

    const sandbox = new BrowserSandboxProvider({ defaultTimeoutMs: 321 });

    expect(createdUrl?.pathname).toContain('sandbox.worker');
    expect(createdOptions).toEqual({ type: 'module' });
    await sandbox.close();
  });

  it('uploads and downloads generated skill files through worker RPC', async () => {
    const sandbox = createSandbox();

    await expect(sandbox.uploadFiles([
      ['/skills/hello/src/index.js', bytes('console.log("hello")')],
    ])).resolves.toEqual([{ path: '/skills/hello/src/index.js', error: null }]);

    const [download] = await sandbox.downloadFiles(['/skills/hello/src/index.js']);

    expect(download.path).toBe('/skills/hello/src/index.js');
    expect(download.error).toBeNull();
    expect(text(download.content)).toBe('console.log("hello")');
  });

  it('returns per-file upload errors for traversal attempts', async () => {
    const sandbox = createSandbox();

    await expect(sandbox.uploadFiles([['../escape.js', bytes('bad')]])).resolves.toEqual([
      { path: '../escape.js', error: expect.stringContaining('Parent traversal') },
    ]);
  });

  it('runs only the supported command set against the virtual filesystem', async () => {
    const sandbox = createSandbox();
    await sandbox.uploadFiles([
      ['/skills/hello/src/index.js', bytes('console.log("hello from sandbox")')],
    ]);

    await expect(sandbox.execute('ls /skills/hello')).resolves.toMatchObject({
      output: expect.stringContaining('/skills/hello/src/index.js'),
      exitCode: 0,
      truncated: false,
    });
    await expect(sandbox.execute('cat /skills/hello/src/index.js')).resolves.toMatchObject({
      output: 'console.log("hello from sandbox")',
      exitCode: 0,
    });
    await expect(sandbox.execute('wat /skills/hello/src/index.js')).resolves.toMatchObject({
      exitCode: 127,
    });
    await expect(sandbox.execute('cat /missing.js')).resolves.toMatchObject({
      exitCode: 1,
    });
  });

  it('executes JavaScript files in QuickJS and captures console output', async () => {
    const sandbox = createSandbox();
    await sandbox.uploadFiles([
      ['/skills/hello/src/index.js', bytes([
        'console.log("hello from sandbox", 42);',
        'console.warn("careful");',
        'console.error("boom");',
        'console.log(typeof window, typeof document, typeof localStorage, typeof fetch);',
      ].join('\n'))],
    ]);

    const result = await sandbox.execute('node /skills/hello/src/index.js');

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('hello from sandbox 42');
    expect(result.output).toContain('[warn] careful');
    expect(result.output).toContain('[error] boom');
    expect(result.output).toContain('undefined undefined undefined undefined');
  });

  it('truncates oversized output in provider responses', async () => {
    const sandbox = createSandbox(new LargeOutputWorker(), { maxOutputBytes: 24 });

    const result = await sandbox.execute('node /skills/noisy/src/index.js');

    expect(result.truncated).toBe(true);
    expect(encoder.encode(result.output).byteLength).toBeLessThanOrEqual(24);
  });

  it('rejects timed-out execution, terminates the worker, and prevents reuse', async () => {
    const worker = new HangingWorker();
    const sandbox = createSandbox(worker as unknown as RuntimeWorker, { defaultTimeoutMs: 5 });

    await expect(sandbox.execute('node /skills/stuck/src/index.js')).rejects.toBeInstanceOf(SandboxTimeoutError);
    expect(worker.terminated).toBe(true);
    await expect(sandbox.execute('ls')).rejects.toBeInstanceOf(SandboxClosedError);
  });

  it('close terminates the worker and rejects future calls', async () => {
    const worker = new RuntimeWorker();
    const sandbox = createSandbox(worker);

    await sandbox.close();

    expect(worker.terminated).toBe(true);
    await expect(sandbox.execute('ls')).rejects.toBeInstanceOf(SandboxClosedError);
    await expect(sandbox.uploadFiles([])).rejects.toBeInstanceOf(SandboxClosedError);
    await expect(sandbox.downloadFiles([])).rejects.toBeInstanceOf(SandboxClosedError);
    await expect(sandbox.reset()).rejects.toBeInstanceOf(SandboxClosedError);
  });

  it('surfaces worker response errors as execution errors', async () => {
    const sandbox = createSandbox(new RejectingWorker());

    await expect(sandbox.execute('ls')).rejects.toBeInstanceOf(SandboxExecutionError);
    await expect(sandbox.execute('ls')).rejects.toThrow('worker says no');
  });

  it('ignores responses for unknown request ids', async () => {
    const sandbox = createSandbox(new NoisyWorker());

    await expect(sandbox.execute('ls')).resolves.toMatchObject({ exitCode: 0, output: '' });
    await expect(sandbox.reset()).resolves.toBeUndefined();
  });

  it('terminates and rejects all pending work when the worker emits an error', async () => {
    const worker = new ErroringWorker();
    const sandbox = createSandbox(worker);

    await expect(sandbox.execute('ls')).rejects.toThrow('worker exploded');
    expect(worker.terminated).toBe(true);
    await expect(sandbox.execute('ls')).rejects.toBeInstanceOf(SandboxClosedError);
  });

  it('uses a fallback message for worker errors without a message', async () => {
    const sandbox = createSandbox(new EmptyMessageErroringWorker());

    await expect(sandbox.execute('ls')).rejects.toThrow('Sandbox worker failed.');
  });
});
