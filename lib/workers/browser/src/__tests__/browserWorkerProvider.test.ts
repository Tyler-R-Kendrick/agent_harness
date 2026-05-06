import { describe, expect, it } from 'vitest';
import {
  CapExecJavaScript,
  CapFsVirtual,
  DefaultCapabilitySet,
  EventJobAccepted,
  EventJobCompleted,
  EventSandboxCreated,
  EventSandboxStdout,
  SurfaceWorkerProvider,
  jobIntentId,
  providerId,
  runtimeTypeId,
  workerTypeId,
  type EffectivePolicy,
  type ProviderContext,
  type Sandbox,
  type SandboxBroker,
  type SandboxDescriptor,
  type SandboxExecuteRequest,
  type SandboxExecuteResult,
  type SandboxLease,
  type SandboxRef,
  type SandboxUploadRequest,
  type SandboxUploadResult,
} from '@agent-harness/worker';
import {
  BrowserRuntimeType,
  BrowserWorkerProvider,
  BrowserWorkerProviderId,
  BrowserWorkerType,
} from '../index';

const decoder = new TextDecoder();

class RecordingSandbox implements Sandbox {
  readonly ref: SandboxRef = { id: 'sandbox-1', type: providerId('com.example.invalid') as never };
  readonly provider = { id: providerId('com.example.sandbox-provider') };
  uploaded: Array<{ path: string; content: string }> = [];
  executed: string[] = [];

  async describe(): Promise<SandboxDescriptor> {
    return {
      ref: this.ref,
      provider: this.provider,
      capabilities: new DefaultCapabilitySet([{ id: CapExecJavaScript }, { id: CapFsVirtual }]),
    };
  }

  async execute(request: SandboxExecuteRequest): Promise<SandboxExecuteResult> {
    this.executed.push(request.command);
    if (request.command === 'empty') {
      return {
        output: '',
        stdout: '',
        exitCode: 0,
        truncated: false,
        durationMs: 1,
      };
    }
    if (request.command === 'fail') {
      return {
        output: 'bad command',
        stderr: 'bad command',
        exitCode: 1,
        truncated: false,
        durationMs: 1,
      };
    }
    return {
      output: `ran:${request.command}`,
      stdout: `ran:${request.command}`,
      exitCode: 0,
      truncated: false,
      durationMs: 1,
    };
  }

  async uploadFiles(request: SandboxUploadRequest): Promise<SandboxUploadResult> {
    this.uploaded.push(
      ...request.files.map((file) => ({ path: file.path, content: decoder.decode(file.content) })),
    );
    return { files: request.files.map((file) => ({ path: file.path, error: null })) };
  }
}

class RecordingSandboxBroker implements SandboxBroker {
  readonly sandbox: Sandbox;
  requests: unknown[] = [];
  released = false;

  constructor(sandbox: Sandbox = new RecordingSandbox()) {
    this.sandbox = sandbox;
  }

  async createSandbox(request: unknown): Promise<SandboxLease> {
    this.requests.push(request);
    return {
      sandbox: this.sandbox,
      policy: {
        network: { mode: 'none', allowedHosts: [] },
        filesystem: { mode: 'virtual', readRoots: [], writeRoots: [], maxFileBytes: 1, maxTotalBytes: 1 },
        execution: { timeoutMs: 1, maxOutputBytes: 1 },
        secrets: { mode: 'none', allowedSecretRefs: [] },
        preview: { enabled: false, mode: 'none' },
      } satisfies EffectivePolicy,
      release: async () => {
        this.released = true;
      },
    };
  }

  async connectSandbox(): Promise<SandboxLease> {
    throw new Error('not used');
  }
}

class ThrowingSandboxBroker extends RecordingSandboxBroker {
  override async createSandbox(): Promise<SandboxLease> {
    throw 'broker exploded';
  }
}

function createContext(broker: SandboxBroker, useClock = true): ProviderContext {
  const context: ProviderContext = {
    registry: null as never,
    sandboxBroker: broker,
    policyEngine: null as never,
  };
  if (useClock) {
    context.clock = { now: () => new Date('2026-01-02T03:04:05.000Z') };
  }
  return context;
}

describe('BrowserWorkerProvider', () => {
  it('describes itself with provider-owned opaque ids and generic capabilities', async () => {
    const provider = new BrowserWorkerProvider({
      displayName: 'Custom Browser Provider',
      providerId: providerId('com.acme.browser-provider'),
    });

    await expect(provider.describe()).resolves.toMatchObject({
      ref: { id: providerId('com.acme.browser-provider') },
      displayName: 'Custom Browser Provider',
      provides: [{ id: SurfaceWorkerProvider }],
    });
    await expect(provider.listWorkers?.()).resolves.toMatchObject([
      {
        ref: { type: BrowserWorkerType },
        runtime: { type: BrowserRuntimeType },
      },
    ]);
    expect(BrowserWorkerProviderId).toBe('com.example.worker-provider.browser');
    expect(workerTypeId(BrowserWorkerType)).toBe(BrowserWorkerType);
    expect(runtimeTypeId(BrowserRuntimeType)).toBe(BrowserRuntimeType);
  });

  it('asks the sandbox broker for a lease, uploads seed files, emits lifecycle events, and releases the lease', async () => {
    const sandboxBroker = new RecordingSandboxBroker();
    const provider = new BrowserWorkerProvider();
    const worker = await provider.createWorker?.({}, createContext(sandboxBroker));
    await expect(worker!.describe()).resolves.toMatchObject({
      ref: { type: BrowserWorkerType },
      runtime: { type: BrowserRuntimeType },
    });

    const run = await worker!.submit({
      id: 'job-1',
      intent: jobIntentId('skill.create'),
      input: {
        prompt: 'Create a CSV skill',
        seedFiles: [{ path: '/skills/csv/input.txt', content: 'hello' }],
        commands: ['ls /skills', 'cat /skills/csv/input.txt'],
      },
      requirements: {
        sandbox: [{ id: CapExecJavaScript }, { id: CapFsVirtual }],
      },
      policy: {
        filesystem: { mode: 'virtual' },
      },
    });

    const events = [];
    for await (const event of run.events()) {
      events.push(event);
    }
    const result = await run.result();

    expect(sandboxBroker.requests).toEqual([
      {
        requiredCapabilities: [{ id: CapExecJavaScript }, { id: CapFsVirtual }],
        policy: { filesystem: { mode: 'virtual' } },
      },
    ]);
    expect(sandboxBroker.sandbox.uploaded).toEqual([{ path: '/skills/csv/input.txt', content: 'hello' }]);
    expect(sandboxBroker.sandbox.executed).toEqual(['ls /skills', 'cat /skills/csv/input.txt']);
    expect(events.map((event) => event.type)).toEqual([
      EventJobAccepted,
      EventSandboxCreated,
      EventSandboxStdout,
      EventSandboxStdout,
      EventJobCompleted,
    ]);
    expect(result).toMatchObject({
      status: 'succeeded',
      output: 'ran:ls /skills\nran:cat /skills/csv/input.txt',
    });
    expect(events[0]!.timestamp).toBe('2026-01-02T03:04:05.000Z');
    expect(sandboxBroker.released).toBe(true);
  });

  it('handles empty generic input and cancellation through the worker run surface', async () => {
    const sandboxBroker = new RecordingSandboxBroker();
    const worker = await new BrowserWorkerProvider().createWorker?.({}, createContext(sandboxBroker, false));

    const run = await worker!.submit({
      id: 'job-1',
      intent: jobIntentId('sandbox.execute'),
      input: { seedFiles: 'bad', commands: 'bad' },
    });
    await run.cancel('caller changed course');

    await expect(run.result()).resolves.toMatchObject({
      status: 'cancelled',
      output: '',
    });
    expect(sandboxBroker.sandbox.executed).toEqual([]);
    expect(sandboxBroker.released).toBe(true);

    const nullRun = await worker!.submit({
      id: 'job-2',
      intent: jobIntentId('sandbox.execute'),
      input: null,
    });
    await expect(nullRun.result()).resolves.toMatchObject({
      status: 'succeeded',
      output: '',
    });
  });

  it('fails jobs when sandbox upload is unavailable or broker errors are non-Error values', async () => {
    const noUploadSandbox = new RecordingSandbox();
    noUploadSandbox.uploadFiles = undefined;
    const worker = await new BrowserWorkerProvider().createWorker?.(
      {},
      createContext(new RecordingSandboxBroker(noUploadSandbox)),
    );

    const uploadRun = await worker!.submit({
      id: 'job-1',
      intent: jobIntentId('skill.create'),
      input: { seedFiles: [{ path: '/a.txt', content: 'a' }] },
    });
    await expect(uploadRun.result()).resolves.toMatchObject({
      status: 'failed',
      diagnostics: [{ message: expect.stringContaining('seed file upload') }],
    });

    const brokerFailureWorker = await new BrowserWorkerProvider().createWorker?.({}, createContext(new ThrowingSandboxBroker()));
    const brokerFailureRun = await brokerFailureWorker!.submit({
      id: 'job-2',
      intent: jobIntentId('skill.create'),
      input: {},
    });
    await expect(brokerFailureRun.result()).resolves.toMatchObject({
      status: 'failed',
      error: { name: 'Error', message: 'broker exploded' },
    });
  });

  it('fails jobs on non-zero sandbox commands while supporting Uint8Array seeds and command filtering', async () => {
    const sandboxBroker = new RecordingSandboxBroker();
    const worker = await new BrowserWorkerProvider().createWorker?.({}, createContext(sandboxBroker));

    const run = await worker!.submit({
      id: 'job-1',
      intent: jobIntentId('skill.create'),
      input: {
        prompt: 123,
        seedFiles: [{ path: '/bytes.bin', content: new Uint8Array([65, 66]) }],
        commands: ['empty', 123, 'fail'],
      },
    });

    await expect(run.result()).resolves.toMatchObject({
      status: 'failed',
      output: 'bad command',
      diagnostics: [{ message: expect.stringContaining('exit code 1') }],
    });
    expect(sandboxBroker.sandbox.uploaded).toEqual([{ path: '/bytes.bin', content: 'AB' }]);
    expect(sandboxBroker.sandbox.executed).toEqual(['empty', 'fail']);
  });
});
