import { describe, expect, it } from 'vitest';
import {
  CapExecJavaScript,
  CapFsVirtual,
  CapIsolationWasm,
  CapPersistenceEphemeral,
  DefaultCapabilitySet,
  DefaultPolicyEngine,
  DefaultProviderRegistry,
  DefaultSandboxBroker,
  DefaultSandboxResolver,
  DefaultCapabilityMatcher,
  SurfaceSandboxProvider,
  type ProviderContext,
} from '@agent-harness/worker';
import {
  QuickJsWasmSandboxProvider,
  QuickJsWasmSandboxProviderId,
  QuickJsWasmSandboxType,
  QuickJsWasmSandbox,
} from '../index';
import type { SandboxWorkerMessage, SandboxWorkerResponse } from '../types';
import { SandboxWorkerRuntime } from '../workerRuntime';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytes(content: string): Uint8Array {
  return encoder.encode(content);
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

class HangingWorker extends RuntimeWorker {
  override postMessage(): void {}
}

function createContext(): ProviderContext {
  const registry = new DefaultProviderRegistry();
  const policyEngine = new DefaultPolicyEngine();
  const sandboxBroker = new DefaultSandboxBroker({
    registry,
    resolver: new DefaultSandboxResolver(new DefaultCapabilityMatcher()),
    policyEngine,
  });
  return {
    registry,
    sandboxBroker,
    policyEngine,
  };
}

describe('QuickJsWasmSandboxProvider', () => {
  it('describes provider-owned ids and open capabilities', async () => {
    const provider = new QuickJsWasmSandboxProvider({ workerFactory: () => new RuntimeWorker() });

    await expect(provider.describe()).resolves.toMatchObject({
      ref: { id: QuickJsWasmSandboxProviderId },
      provides: [{ id: SurfaceSandboxProvider }],
    });
    await expect(provider.listSandboxes?.()).resolves.toMatchObject([
      {
        ref: { type: QuickJsWasmSandboxType },
        capabilities: expect.any(DefaultCapabilitySet),
      },
    ]);
    const [descriptor] = await provider.listSandboxes!();
    expect(descriptor!.capabilities.has(CapExecJavaScript)).toBe(true);
    expect(descriptor!.capabilities.has(CapFsVirtual)).toBe(true);
    expect(descriptor!.capabilities.has(CapIsolationWasm)).toBe(true);
    expect(descriptor!.capabilities.has(CapPersistenceEphemeral)).toBe(true);
  });

  it('creates sandbox leases through the generic broker', async () => {
    const registry = new DefaultProviderRegistry();
    registry.register(new QuickJsWasmSandboxProvider({ workerFactory: () => new RuntimeWorker() }));
    const broker = new DefaultSandboxBroker({
      registry,
      resolver: new DefaultSandboxResolver(new DefaultCapabilityMatcher()),
      policyEngine: new DefaultPolicyEngine(),
    });

    const lease = await broker.createSandbox({
      requiredCapabilities: [{ id: CapExecJavaScript }, { id: CapFsVirtual }],
      policy: { filesystem: { mode: 'virtual' } },
    });

    await expect(lease.sandbox.describe()).resolves.toMatchObject({
      ref: { type: QuickJsWasmSandboxType },
      provider: { id: QuickJsWasmSandboxProviderId },
    });
    await expect(lease.sandbox.execute({ command: 'ls /' })).resolves.toMatchObject({ exitCode: 0 });
    await expect(lease.sandbox.reset?.()).resolves.toBeUndefined();
    await lease.release();
  });

  it('rejects path traversal, supports upload/download, ls/cat, and unknown command exit 127', async () => {
    const provider = new QuickJsWasmSandboxProvider({ workerFactory: () => new RuntimeWorker() });
    const sandbox = await provider.createSandbox({}, createContext());

    await expect(
      sandbox.uploadFiles?.({ files: [{ path: '../escape.js', content: bytes('bad') }] }),
    ).resolves.toEqual({ files: [{ path: '../escape.js', error: expect.stringContaining('Parent traversal') }] });
    await expect(
      sandbox.uploadFiles?.({ files: [{ path: '/skills/demo/index.js', content: bytes('console.log("hi")') }] }),
    ).resolves.toEqual({ files: [{ path: '/skills/demo/index.js', error: null }] });
    await expect(sandbox.downloadFiles?.({ paths: ['/skills/demo/index.js'] })).resolves.toMatchObject({
      files: [{ path: '/skills/demo/index.js', error: null }],
    });
    const downloaded = await sandbox.downloadFiles!({ paths: ['/skills/demo/index.js'] });
    expect(decoder.decode(downloaded.files[0]!.content!)).toBe('console.log("hi")');
    await expect(sandbox.execute({ command: 'ls /skills/demo' })).resolves.toMatchObject({
      output: expect.stringContaining('/skills/demo/index.js'),
      exitCode: 0,
    });
    await expect(sandbox.execute({ command: 'cat /skills/demo/index.js' })).resolves.toMatchObject({
      output: 'console.log("hi")',
      exitCode: 0,
    });
    await expect(sandbox.execute({ command: 'wat /skills/demo/index.js' })).resolves.toMatchObject({
      exitCode: 127,
    });
  });

  it('enforces output truncation through the provider adapter', async () => {
    const provider = new QuickJsWasmSandboxProvider({
      workerFactory: () => new RuntimeWorker(),
      maxOutputBytes: 8,
    });
    const sandbox = await provider.createSandbox({}, createContext());
    await sandbox.uploadFiles!({
      files: [{ path: '/skills/demo/index.js', content: bytes('console.log("123456789012345")') }],
    });

    await expect(sandbox.execute({ command: 'node /skills/demo/index.js' })).resolves.toMatchObject({
      output: expect.stringMatching(/^12345678/),
      truncated: true,
    });
  });

  it('returns a clear timeout result and terminates the worker when execution times out', async () => {
    const worker = new HangingWorker();
    const provider = new QuickJsWasmSandboxProvider({
      workerFactory: () => worker,
      defaultTimeoutMs: 5,
    });
    const sandbox = await provider.createSandbox({}, createContext());

    await expect(sandbox.execute({ command: 'node /skills/stuck.js' })).resolves.toMatchObject({
      exitCode: null,
      output: expect.stringContaining('timed out'),
    });
    expect(worker.terminated).toBe(true);
  });

  it('normalizes non-Error sandbox runtime failures into execute results', async () => {
    const sandbox = new QuickJsWasmSandbox({
      ref: { id: 'direct-sandbox', type: QuickJsWasmSandboxType },
      provider: { id: QuickJsWasmSandboxProviderId },
      capabilities: new DefaultCapabilitySet([{ id: CapExecJavaScript }]),
      sandbox: {
        async execute() {
          throw 'unsupported runtime';
        },
      } as never,
    });

    await expect(sandbox.execute({ command: 'node /x.js' })).resolves.toMatchObject({
      output: 'unsupported runtime',
      stderr: 'unsupported runtime',
      exitCode: null,
    });
  });
});
