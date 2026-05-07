import { describe, expect, it } from 'vitest';
import {
  CapExecJavaScript,
  CapFsVirtual,
  DefaultCapabilityMatcher,
  DefaultCapabilitySet,
  DefaultPolicyEngine,
  DefaultProviderRegistry,
  DefaultSandboxBroker,
  DefaultSandboxResolver,
  DefaultWorkerBroker,
  DefaultWorkerResolver,
  DeepAgentsSandboxAdapter,
  EventJobAccepted,
  InMemoryArtifactStore,
  SandboxProviderMarker,
  SurfaceSandboxProvider,
  SurfaceWorkerProvider,
  WorkerProviderMarker,
  capabilityId,
  eventTypeId,
  jobIntentId,
  providerId,
  runtimeTypeId,
  sandboxTypeId,
  workerTypeId,
  type CreateSandboxRequest,
  type CreateWorkerRequest,
  type EffectivePolicy,
  type Provider,
  type ProviderContext,
  type ProviderDescriptor,
  type ProviderRef,
  type Sandbox,
  type SandboxDescriptor,
  type SandboxLease,
  type SandboxProvider,
  type SandboxRef,
  type SandboxExecuteRequest,
  type SandboxExecuteResult,
  type Worker,
  type WorkerDescriptor,
  type WorkerEvent,
  type WorkerJob,
  type WorkerProvider,
  type WorkerRef,
  type WorkerResult,
  type WorkerRun,
} from '../index';

const providerRef = (value: string): ProviderRef => ({ id: providerId(value) });

class DescribedProvider implements Provider {
  readonly ref: ProviderRef;
  constructor(id: string) {
    this.ref = providerRef(id);
  }

  async describe(): Promise<ProviderDescriptor> {
    return {
      ref: this.ref,
      provides: [{ id: 'surface.test' }],
    };
  }
}

class FakeSandbox implements Sandbox {
  readonly ref: SandboxRef;
  readonly provider: ProviderRef;
  closed = false;

  constructor(id: string, provider: ProviderRef, type = sandboxTypeId(`com.example.${id}`)) {
    this.ref = { id, type };
    this.provider = provider;
  }

  async describe(): Promise<SandboxDescriptor> {
    return {
      ref: this.ref,
      provider: this.provider,
      capabilities: new DefaultCapabilitySet([{ id: CapExecJavaScript }]),
    };
  }

  async execute(request: SandboxExecuteRequest): Promise<SandboxExecuteResult> {
    return {
      output: request.command,
      exitCode: 0,
      truncated: false,
      durationMs: 1,
    };
  }

  async uploadFiles(request: { files: Array<{ path: string }> }): Promise<{ files: Array<{ path: string; error: null }> }> {
    return { files: request.files.map((file) => ({ path: file.path, error: null })) };
  }

  async downloadFiles(request: { paths: string[] }): Promise<{ files: Array<{ path: string; content: null; error: string }> }> {
    return { files: request.paths.map((path) => ({ path, content: null, error: 'not implemented' })) };
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

class FakeSandboxProvider implements SandboxProvider {
  readonly [SandboxProviderMarker] = true;
  readonly ref: ProviderRef;
  readonly descriptors: SandboxDescriptor[];
  createdWith: Array<CreateSandboxRequest & { effectivePolicy?: EffectivePolicy }> = [];

  constructor(id: string, capabilities = new DefaultCapabilitySet([{ id: CapExecJavaScript }])) {
    this.ref = providerRef(id);
    this.descriptors = [
      {
        ref: { id: `${id}-sandbox`, type: sandboxTypeId(`com.example.sandbox.${id}`) },
        provider: this.ref,
        capabilities,
      },
    ];
  }

  async describe(): Promise<ProviderDescriptor> {
    return {
      ref: this.ref,
      provides: [{ id: SurfaceSandboxProvider }],
      capabilities: this.descriptors[0]!.capabilities,
    };
  }

  async listSandboxes(): Promise<SandboxDescriptor[]> {
    return this.descriptors;
  }

  async createSandbox(request: CreateSandboxRequest): Promise<Sandbox> {
    this.createdWith.push(request);
    return new FakeSandbox(`${this.ref.id}-instance`, this.ref);
  }

  async connectSandbox(ref: SandboxRef): Promise<Sandbox> {
    return new FakeSandbox(ref.id, this.ref, ref.type);
  }
}

class MultiSandboxProvider extends FakeSandboxProvider {
  constructor() {
    super('com.example.multi-sandbox', new DefaultCapabilitySet([]));
  }

  override async listSandboxes(): Promise<SandboxDescriptor[]> {
    return [
      {
        ref: { id: 'multi-sandbox-weak', type: sandboxTypeId('com.example.sandbox.multi-weak') },
        provider: this.ref,
        capabilities: new DefaultCapabilitySet([]),
      },
      {
        ref: { id: 'multi-sandbox-strong', type: sandboxTypeId('com.example.sandbox.multi-strong') },
        provider: this.ref,
        capabilities: new DefaultCapabilitySet([{ id: capabilityId('cap.multi-sandbox') }]),
      },
    ];
  }
}

class DescribeOnlySandboxProvider implements SandboxProvider {
  readonly [SandboxProviderMarker] = true;
  readonly ref = providerRef('com.example.describe-only-sandbox-provider');

  async describe(): Promise<ProviderDescriptor> {
    return {
      ref: this.ref,
      provides: [{ id: SurfaceSandboxProvider }],
      displayName: 'Describe-only sandbox provider',
      capabilities: new DefaultCapabilitySet([{ id: CapFsVirtual }]),
      labels: { source: 'describe' },
      annotations: { untrusted: true },
    };
  }

  async createSandbox(): Promise<Sandbox> {
    return new FakeSandbox('describe-only-sandbox', this.ref);
  }
}

class EmptySandboxProvider implements SandboxProvider {
  readonly [SandboxProviderMarker] = true;
  readonly ref = providerRef('com.example.empty-sandbox-provider');

  async describe(): Promise<ProviderDescriptor> {
    return {
      ref: this.ref,
      provides: [{ id: SurfaceSandboxProvider }],
    };
  }

  async createSandbox(): Promise<Sandbox> {
    return new FakeSandbox('empty-sandbox', this.ref);
  }
}

class FakeWorkerRun implements WorkerRun {
  readonly id = 'run-1';
  readonly worker: WorkerRef;

  constructor(worker: WorkerRef) {
    this.worker = worker;
  }

  async *events(): AsyncIterable<WorkerEvent> {
    yield {
      id: 'event-1',
      runId: this.id,
      timestamp: new Date(0).toISOString(),
      type: eventTypeId('com.example.worker.event'),
    };
  }

  async cancel(): Promise<void> {}

  async result(): Promise<WorkerResult> {
    return {
      runId: this.id,
      worker: this.worker,
      status: 'succeeded',
    };
  }
}

class FakeWorker implements Worker {
  readonly ref: WorkerRef;
  readonly provider: ProviderRef;

  constructor(type: string, provider: ProviderRef) {
    this.ref = { id: `${provider.id}-worker`, type: workerTypeId(type) };
    this.provider = provider;
  }

  async describe(): Promise<WorkerDescriptor> {
    return {
      ref: this.ref,
      provider: this.provider,
      runtime: {
        type: runtimeTypeId('com.example.runtime.fake'),
        capabilities: new DefaultCapabilitySet([{ id: capabilityId('cap.worker.fake') }]),
      },
      capabilities: new DefaultCapabilitySet([{ id: capabilityId('cap.worker.fake') }]),
    };
  }

  async submit(_job: WorkerJob): Promise<WorkerRun> {
    return new FakeWorkerRun(this.ref);
  }
}

class FakeWorkerProvider implements WorkerProvider {
  readonly [WorkerProviderMarker] = true;
  readonly ref: ProviderRef;
  readonly descriptor: WorkerDescriptor;
  createdWith: CreateWorkerRequest[] = [];

  constructor(id: string, type: string, capabilities = new DefaultCapabilitySet([{ id: capabilityId('cap.worker.fake') }])) {
    this.ref = providerRef(id);
    this.descriptor = {
      ref: { id: `${id}-worker`, type: workerTypeId(type) },
      provider: this.ref,
      runtime: {
        type: runtimeTypeId(`com.example.runtime.${id}`),
        capabilities,
      },
      capabilities,
    };
  }

  async describe(): Promise<ProviderDescriptor> {
    return {
      ref: this.ref,
      provides: [{ id: SurfaceWorkerProvider }],
      capabilities: this.descriptor.capabilities,
    };
  }

  async listWorkers(): Promise<WorkerDescriptor[]> {
    return [this.descriptor];
  }

  async createWorker(request: CreateWorkerRequest): Promise<Worker> {
    this.createdWith.push(request);
    return new FakeWorker(this.descriptor.ref.type, this.ref);
  }

  async connectWorker(ref: WorkerRef): Promise<Worker> {
    return new FakeWorker(ref.type, this.ref);
  }
}

class MultiWorkerProvider extends FakeWorkerProvider {
  constructor() {
    super('com.example.multi-worker', 'com.example.worker.multi', new DefaultCapabilitySet([]));
  }

  override async listWorkers(): Promise<WorkerDescriptor[]> {
    return [
      {
        ref: { id: 'multi-worker-weak', type: workerTypeId('com.example.worker.multi-weak') },
        provider: this.ref,
        runtime: {
          type: runtimeTypeId('com.example.runtime.multi-weak'),
          capabilities: new DefaultCapabilitySet([]),
        },
        capabilities: new DefaultCapabilitySet([]),
      },
      {
        ref: { id: 'multi-worker-strong', type: workerTypeId('com.example.worker.multi-strong') },
        provider: this.ref,
        runtime: {
          type: runtimeTypeId('com.example.runtime.multi-strong'),
          capabilities: new DefaultCapabilitySet([{ id: capabilityId('cap.multi-worker') }]),
        },
        capabilities: new DefaultCapabilitySet([{ id: capabilityId('cap.multi-worker') }]),
      },
    ];
  }
}

class DescribeOnlyWorkerProvider implements WorkerProvider {
  readonly [WorkerProviderMarker] = true;
  readonly ref = providerRef('com.example.describe-only-worker-provider');

  async describe(): Promise<ProviderDescriptor> {
    return {
      ref: this.ref,
      provides: [{ id: SurfaceWorkerProvider }],
      displayName: 'Describe-only worker provider',
      capabilities: new DefaultCapabilitySet([{ id: capabilityId('cap.describe-only-worker') }]),
      labels: { source: 'describe' },
      annotations: { untrusted: true },
    };
  }

  async createWorker(): Promise<Worker> {
    return new FakeWorker('com.example.worker.describe-only', this.ref);
  }
}

class ListedOnlyWorkerProvider implements WorkerProvider {
  readonly [WorkerProviderMarker] = true;
  readonly ref = providerRef('com.example.listed-only-worker-provider');

  async describe(): Promise<ProviderDescriptor> {
    return {
      ref: this.ref,
      provides: [{ id: SurfaceWorkerProvider }],
    };
  }

  async listWorkers(): Promise<WorkerDescriptor[]> {
    return [
      {
        ref: { id: 'listed-worker', type: workerTypeId('com.example.worker.listed') },
        provider: this.ref,
        runtime: {
          type: runtimeTypeId('com.example.runtime.listed'),
          capabilities: new DefaultCapabilitySet([{ id: capabilityId('cap.listed-worker') }]),
        },
        capabilities: new DefaultCapabilitySet([{ id: capabilityId('cap.listed-worker') }]),
      },
    ];
  }
}

class EmptyWorkerProvider implements WorkerProvider {
  readonly [WorkerProviderMarker] = true;
  readonly ref = providerRef('com.example.empty-worker-provider');

  async describe(): Promise<ProviderDescriptor> {
    return {
      ref: this.ref,
      provides: [{ id: SurfaceWorkerProvider }],
    };
  }

  async createWorker(): Promise<Worker> {
    return new FakeWorker('com.example.worker.empty', this.ref);
  }
}

describe('opaque ids', () => {
  it('validates non-empty ids and passes unknown provider-owned ids through as strings', () => {
    expect(providerId('com.acme.provider')).toBe('com.acme.provider');
    expect(workerTypeId('com.acme.worker.future')).toBe('com.acme.worker.future');
    expect(runtimeTypeId('com.acme.runtime.future')).toBe('com.acme.runtime.future');
    expect(sandboxTypeId('com.acme.sandbox.future')).toBe('com.acme.sandbox.future');
    expect(capabilityId('cap.acme.future')).toBe('cap.acme.future');
    expect(eventTypeId('com.acme.event.future')).toBe('com.acme.event.future');
    expect(jobIntentId('com.acme.intent.future')).toBe('com.acme.intent.future');
    expect(() => providerId('')).toThrow('non-empty');
    expect(() => capabilityId('   ')).toThrow('non-empty');
  });
});

describe('provider registry', () => {
  it('registers, lists, describes, gets, and unregisters providers', async () => {
    const registry = new DefaultProviderRegistry();
    const provider = new DescribedProvider('com.example.provider');

    registry.register(provider);

    expect(registry.get(provider.ref.id)).toBe(provider);
    expect(registry.list()).toEqual([provider]);
    await expect(registry.listDescriptors()).resolves.toEqual([
      { ref: provider.ref, provides: [{ id: 'surface.test' }] },
    ]);

    registry.unregister(provider.ref.id);
    expect(registry.get(provider.ref.id)).toBeUndefined();
    expect(registry.list()).toEqual([]);
  });

  it('structurally identifies worker and sandbox providers without hardcoded ids', () => {
    const registry = new DefaultProviderRegistry();
    const workerProvider = new FakeWorkerProvider('com.example.worker-provider', 'com.example.worker');
    const sandboxProvider = new FakeSandboxProvider('com.example.sandbox-provider');

    registry.register(workerProvider);
    registry.register(sandboxProvider);
    registry.register(new DescribedProvider('com.example.other'));

    expect(registry.getWorkerProviders()).toEqual([workerProvider]);
    expect(registry.getSandboxProviders()).toEqual([sandboxProvider]);
  });
});

describe('capability matcher', () => {
  it('matches required capabilities, optional capabilities, and equality constraints', () => {
    const matcher = new DefaultCapabilityMatcher();
    const capabilities = new DefaultCapabilitySet([
      { id: CapExecJavaScript, attributes: { engine: 'quickjs', version: 1 } },
      { id: CapFsVirtual },
    ]);

    expect(matcher.satisfies(capabilities, [{ id: CapExecJavaScript }])).toMatchObject({ ok: true });
    expect(matcher.satisfies(capabilities, [{ id: capabilityId('cap.missing') }])).toMatchObject({
      ok: false,
      missing: [{ id: capabilityId('cap.missing') }],
    });
    expect(matcher.satisfies(capabilities, [{ id: capabilityId('cap.missing'), optional: true }])).toMatchObject({
      ok: true,
      missing: [],
    });
    expect(
      matcher.satisfies(capabilities, [{ id: CapExecJavaScript, constraints: { engine: 'quickjs', version: 1 } }]),
    ).toMatchObject({ ok: true });
    expect(
      matcher.satisfies(capabilities, [{ id: CapExecJavaScript, constraints: { engine: 'v8' } }]),
    ).toMatchObject({
      ok: false,
      failed: [{ requirement: { id: CapExecJavaScript, constraints: { engine: 'v8' } }, reason: expect.any(String) }],
    });
    expect(
      matcher.satisfies(capabilities, [{ id: CapFsVirtual, constraints: { mode: 'memory' } }]),
    ).toMatchObject({
      ok: false,
      failed: [{ reason: expect.stringContaining('got undefined') }],
    });
  });
});

describe('policy engine', () => {
  it('denies elevated authority by default and applies secure filesystem defaults', async () => {
    const engine = new DefaultPolicyEngine();

    await expect(engine.evaluate({ requestedPolicy: { network: { mode: 'direct' } } })).resolves.toMatchObject({
      allowed: false,
      reasons: [expect.stringContaining('direct network')],
    });

    await expect(engine.evaluate({ requestedPolicy: {} })).resolves.toMatchObject({
      allowed: true,
      effectivePolicy: {
        network: { mode: 'none', allowedHosts: [] },
        filesystem: {
          mode: 'virtual',
          readRoots: [],
          writeRoots: [],
          maxFileBytes: 5 * 1024 * 1024,
          maxTotalBytes: 50 * 1024 * 1024,
        },
        execution: { timeoutMs: 30_000, maxOutputBytes: 1_000_000 },
        secrets: { mode: 'none', allowedSecretRefs: [] },
        preview: { enabled: false, mode: 'none' },
      },
    });
  });

  it('allows elevated authority only when explicitly configured', async () => {
    const denied = await new DefaultPolicyEngine().evaluate({
      requestedPolicy: {
        filesystem: { mode: 'workspace-scoped' },
        secrets: { mode: 'brokered' },
        preview: { enabled: true },
      },
    });

    expect(denied).toMatchObject({
      allowed: false,
      reasons: [
        expect.stringContaining('workspace filesystem'),
        expect.stringContaining('brokered secrets'),
        expect.stringContaining('preview access'),
      ],
    });

    const allowed = await new DefaultPolicyEngine({
      allowedNetworkModes: ['none', 'allowlist', 'direct'],
      allowWorkspaceFilesystem: true,
      allowBrokeredSecrets: true,
      allowPreview: true,
      defaults: {
        network: { mode: 'allowlist', allowedHosts: ['example.test'] },
        filesystem: { readRoots: ['/workspace'], writeRoots: ['/workspace/out'] },
        execution: { maxMemoryBytes: 1024 },
        secrets: { allowedSecretRefs: ['secret/demo'] },
        preview: { mode: 'iframe' },
      },
    }).evaluate({
      requestedPolicy: {
        network: { mode: 'direct' },
        filesystem: { mode: 'workspace-scoped' },
        secrets: { mode: 'brokered' },
        preview: { enabled: true },
        extensions: { provider: 'ok' },
      },
    });

    expect(allowed).toMatchObject({
      allowed: true,
      effectivePolicy: {
        network: { mode: 'direct', allowedHosts: ['example.test'] },
        filesystem: { mode: 'workspace-scoped', readRoots: ['/workspace'], writeRoots: ['/workspace/out'] },
        execution: { maxMemoryBytes: 1024 },
        secrets: { mode: 'brokered', allowedSecretRefs: ['secret/demo'] },
        preview: { enabled: true, mode: 'iframe' },
        extensions: { provider: 'ok' },
      },
    });
  });

  it('isolates policy arrays from caller and result mutation', async () => {
    const defaultAllowedHosts = ['default.test'];
    const defaultReadRoots = ['/workspace'];
    const defaultWriteRoots = ['/workspace/out'];
    const defaultSecretRefs = ['secret/default'];
    const engine = new DefaultPolicyEngine({
      allowedNetworkModes: ['none', 'allowlist'],
      allowBrokeredSecrets: true,
      defaults: {
        network: { mode: 'allowlist', allowedHosts: defaultAllowedHosts },
        filesystem: { readRoots: defaultReadRoots, writeRoots: defaultWriteRoots },
        secrets: { mode: 'brokered', allowedSecretRefs: defaultSecretRefs },
      },
    });

    defaultAllowedHosts.push('mutated-default.test');
    defaultReadRoots.push('/mutated-default-read');
    defaultWriteRoots.push('/mutated-default-write');
    defaultSecretRefs.push('secret/mutated-default');

    const defaultDecision = await engine.evaluate({ requestedPolicy: {} });

    expect(defaultDecision.effectivePolicy?.network.allowedHosts).toEqual(['default.test']);
    expect(defaultDecision.effectivePolicy?.filesystem.readRoots).toEqual(['/workspace']);
    expect(defaultDecision.effectivePolicy?.filesystem.writeRoots).toEqual(['/workspace/out']);
    expect(defaultDecision.effectivePolicy?.secrets.allowedSecretRefs).toEqual(['secret/default']);

    const requestAllowedHosts = ['request.test'];
    const requestReadRoots = ['/request-read'];
    const requestWriteRoots = ['/request-write'];
    const requestSecretRefs = ['secret/request'];
    const requestedDecision = await engine.evaluate({
      requestedPolicy: {
        network: { allowedHosts: requestAllowedHosts },
        filesystem: { readRoots: requestReadRoots, writeRoots: requestWriteRoots },
        secrets: { allowedSecretRefs: requestSecretRefs },
      },
    });

    requestAllowedHosts.push('mutated-request.test');
    requestReadRoots.push('/mutated-request-read');
    requestWriteRoots.push('/mutated-request-write');
    requestSecretRefs.push('secret/mutated-request');

    expect(requestedDecision.effectivePolicy?.network.allowedHosts).toEqual(['request.test']);
    expect(requestedDecision.effectivePolicy?.filesystem.readRoots).toEqual(['/request-read']);
    expect(requestedDecision.effectivePolicy?.filesystem.writeRoots).toEqual(['/request-write']);
    expect(requestedDecision.effectivePolicy?.secrets.allowedSecretRefs).toEqual(['secret/request']);

    requestedDecision.effectivePolicy!.network.allowedHosts.push('mutated-result.test');
    requestedDecision.effectivePolicy!.filesystem.readRoots.push('/mutated-result-read');
    requestedDecision.effectivePolicy!.filesystem.writeRoots.push('/mutated-result-write');
    requestedDecision.effectivePolicy!.secrets.allowedSecretRefs.push('secret/mutated-result');

    const laterDecision = await engine.evaluate({ requestedPolicy: {} });

    expect(laterDecision.effectivePolicy?.network.allowedHosts).toEqual(['default.test']);
    expect(laterDecision.effectivePolicy?.filesystem.readRoots).toEqual(['/workspace']);
    expect(laterDecision.effectivePolicy?.filesystem.writeRoots).toEqual(['/workspace/out']);
    expect(laterDecision.effectivePolicy?.secrets.allowedSecretRefs).toEqual(['secret/default']);
  });
});

describe('worker and sandbox resolution', () => {
  it('selects workers by opaque type and capability without concrete type switches', async () => {
    const matcher = new DefaultCapabilityMatcher();
    const resolver = new DefaultWorkerResolver(matcher);
    const weak = new FakeWorkerProvider('com.example.weak-provider', 'com.example.worker.weak', new DefaultCapabilitySet([]));
    const strong = new FakeWorkerProvider(
      'com.example.strong-provider',
      'com.example.worker.future',
      new DefaultCapabilitySet([{ id: capabilityId('cap.future') }, { id: capabilityId('cap.extra') }]),
    );
    const context = { registry: new DefaultProviderRegistry() } as ProviderContext;

    await expect(
      resolver.resolve(
        { requiredCapabilities: [{ id: capabilityId('cap.future') }] },
        [weak, strong],
        context,
      ),
    ).resolves.toBe(strong);
    await expect(
      resolver.resolve({ type: workerTypeId('com.example.worker.future') }, [weak, strong], context),
    ).resolves.toBe(strong);
    const stronger = new FakeWorkerProvider(
      'com.example.stronger-provider',
      'com.example.worker.stronger',
      new DefaultCapabilitySet([
        { id: capabilityId('cap.future') },
        { id: capabilityId('cap.extra') },
        { id: capabilityId('cap.extra.two') },
      ]),
    );
    await expect(
      resolver.resolve({ requiredCapabilities: [{ id: capabilityId('cap.future') }] }, [strong, stronger], context),
    ).resolves.toBe(stronger);
    await expect(
      resolver.resolve({ requiredCapabilities: [{ id: capabilityId('cap.multi-worker') }] }, [new MultiWorkerProvider()], context),
    ).resolves.toBeInstanceOf(MultiWorkerProvider);
    await expect(
      resolver.resolve({ requiredCapabilities: [{ id: capabilityId('cap.none') }] }, [weak, strong], context),
    ).rejects.toThrow('No worker provider matched');
    await expect(
      resolver.resolve(
        { requiredCapabilities: [{ id: capabilityId('cap.future'), constraints: { engine: 'missing' } }] },
        [strong],
        context,
      ),
    ).rejects.toThrow('expected missing');

    await expect(
      resolver.resolve(
        { requiredCapabilities: [{ id: capabilityId('cap.describe-only-worker') }] },
        [new DescribeOnlyWorkerProvider()],
        context,
      ),
    ).resolves.toBeInstanceOf(DescribeOnlyWorkerProvider);
    await expect(
      resolver.resolve(
        { requiredCapabilities: [{ id: capabilityId('cap.listed-worker') }] },
        [new ListedOnlyWorkerProvider()],
        { ...context, logger: { debug: () => undefined } },
      ),
    ).rejects.toThrow('createWorker is not supported');
    await expect(
      resolver.resolve(
        { requiredCapabilities: [{ id: capabilityId('cap.empty-worker') }] },
        [new EmptyWorkerProvider()],
        context,
      ),
    ).rejects.toThrow('no worker descriptors available');
  });

  it('selects sandboxes by opaque type and capability without concrete type switches', async () => {
    const matcher = new DefaultCapabilityMatcher();
    const resolver = new DefaultSandboxResolver(matcher);
    const weak = new FakeSandboxProvider('com.example.weak-sandbox', new DefaultCapabilitySet([]));
    const strong = new FakeSandboxProvider(
      'com.example.strong-sandbox',
      new DefaultCapabilitySet([{ id: CapExecJavaScript }, { id: CapFsVirtual }]),
    );
    const context = { registry: new DefaultProviderRegistry() } as ProviderContext;

    await expect(
      resolver.resolve({ requiredCapabilities: [{ id: CapFsVirtual }] }, [weak, strong], context),
    ).resolves.toBe(strong);
    await expect(
      resolver.resolve({ type: strong.descriptors[0]!.ref.type }, [weak, strong], context),
    ).resolves.toBe(strong);
    const stronger = new FakeSandboxProvider(
      'com.example.stronger-sandbox',
      new DefaultCapabilitySet([{ id: CapExecJavaScript }, { id: CapFsVirtual }, { id: capabilityId('cap.extra') }]),
    );
    await expect(
      resolver.resolve({ requiredCapabilities: [{ id: CapFsVirtual }] }, [strong, stronger], context),
    ).resolves.toBe(stronger);
    await expect(
      resolver.resolve({ requiredCapabilities: [{ id: capabilityId('cap.multi-sandbox') }] }, [new MultiSandboxProvider()], context),
    ).resolves.toBeInstanceOf(MultiSandboxProvider);
    await expect(
      resolver.resolve({ requiredCapabilities: [{ id: capabilityId('cap.none') }] }, [weak, strong], context),
    ).rejects.toThrow('No sandbox provider matched');
    await expect(
      resolver.resolve(
        { requiredCapabilities: [{ id: CapFsVirtual, constraints: { engine: 'missing' } }] },
        [strong],
        context,
      ),
    ).rejects.toThrow('expected missing');

    await expect(
      resolver.resolve({ requiredCapabilities: [{ id: CapFsVirtual }] }, [new DescribeOnlySandboxProvider()], context),
    ).resolves.toBeInstanceOf(DescribeOnlySandboxProvider);
    await expect(
      resolver.resolve({ requiredCapabilities: [{ id: CapFsVirtual }] }, [new EmptySandboxProvider()], {
        ...context,
        logger: { debug: () => undefined },
      }),
    ).rejects.toThrow('no sandbox descriptors available');
  });
});

describe('brokers', () => {
  it('denies sandbox creation when policy denies the request', async () => {
    const registry = new DefaultProviderRegistry();
    registry.register(new FakeSandboxProvider('com.example.sandbox-provider'));
    const broker = new DefaultSandboxBroker({
      registry,
      resolver: new DefaultSandboxResolver(new DefaultCapabilityMatcher()),
      policyEngine: new DefaultPolicyEngine(),
    });

    await expect(
      broker.createSandbox({ policy: { network: { mode: 'direct' } } }),
    ).rejects.toThrow('Sandbox creation denied');
  });

  it('creates sandbox leases with effective policy and release cleanup when policy allows', async () => {
    const registry = new DefaultProviderRegistry();
    const provider = new FakeSandboxProvider('com.example.sandbox-provider');
    registry.register(provider);
    const broker = new DefaultSandboxBroker({
      registry,
      resolver: new DefaultSandboxResolver(new DefaultCapabilityMatcher()),
      policyEngine: new DefaultPolicyEngine(),
    });

    const lease = await broker.createSandbox({ requiredCapabilities: [{ id: CapExecJavaScript }] });

    expect(lease.policy.network.mode).toBe('none');
    expect(provider.createdWith[0]?.effectivePolicy?.filesystem.mode).toBe('virtual');
    await lease.release();
    expect((lease.sandbox as FakeSandbox).closed).toBe(true);
  });

  it('connects sandbox leases through providers that advertise matching descriptors', async () => {
    const registry = new DefaultProviderRegistry();
    const provider = new FakeSandboxProvider('com.example.sandbox-provider');
    registry.register(new DescribeOnlySandboxProvider());
    registry.register(provider);
    const broker = new DefaultSandboxBroker({
      registry,
      resolver: new DefaultSandboxResolver(new DefaultCapabilityMatcher()),
      policyEngine: new DefaultPolicyEngine(),
    });
    const ref = provider.descriptors[0]!.ref;

    const lease = await broker.connectSandbox(ref);

    expect(lease.sandbox.ref).toEqual(ref);
    await lease.release();
    expect((lease.sandbox as FakeSandbox).closed).toBe(true);
    await expect(broker.connectSandbox({ id: 'same-type', type: ref.type })).resolves.toMatchObject({
      sandbox: { ref: { id: 'same-type', type: ref.type } },
    });
    await expect(broker.connectSandbox({ id: 'missing', type: sandboxTypeId('com.example.missing') })).rejects.toThrow(
      'No sandbox provider can connect',
    );
    await expect(
      new DefaultSandboxBroker({
        registry: new DefaultProviderRegistry(),
        resolver: new DefaultSandboxResolver(new DefaultCapabilityMatcher()),
        policyEngine: new DefaultPolicyEngine(),
        context: { logger: { debug: () => undefined } },
      }).connectSandbox(ref),
    ).rejects.toThrow('No sandbox provider can connect');

    await expect(
      new DefaultSandboxBroker({
        registry,
        resolver: new DefaultSandboxResolver(new DefaultCapabilityMatcher()),
        policyEngine: {
          async evaluate() {
            return { allowed: false, reasons: ['no connect'] };
          },
        },
      }).connectSandbox(ref),
    ).rejects.toThrow('Sandbox connection denied');
  });

  it('creates workers through dynamically registered providers and passes broker context', async () => {
    const registry = new DefaultProviderRegistry();
    const provider = new FakeWorkerProvider('com.example.worker-provider', 'com.example.worker.future');
    const sandboxBroker: Pick<SandboxLease, 'release'> & { createSandbox: () => Promise<never>; connectSandbox: () => Promise<never> } = {
      async createSandbox() {
        throw new Error('not used');
      },
      async connectSandbox() {
        throw new Error('not used');
      },
      async release() {},
    };
    registry.register(provider);
    const broker = new DefaultWorkerBroker({
      registry,
      resolver: new DefaultWorkerResolver(new DefaultCapabilityMatcher()),
      sandboxBroker,
      policyEngine: new DefaultPolicyEngine(),
    });

    const worker = await broker.createWorker({ requiredCapabilities: [{ id: capabilityId('cap.worker.fake') }] });

    expect(worker.ref.type).toBe(workerTypeId('com.example.worker.future'));
    expect(provider.createdWith).toEqual([{ requiredCapabilities: [{ id: capabilityId('cap.worker.fake') }] }]);
  });

  it('connects workers through providers that advertise matching descriptors', async () => {
    const registry = new DefaultProviderRegistry();
    const provider = new FakeWorkerProvider('com.example.worker-provider', 'com.example.worker.future');
    registry.register(new ListedOnlyWorkerProvider());
    registry.register(provider);
    const broker = new DefaultWorkerBroker({
      registry,
      resolver: new DefaultWorkerResolver(new DefaultCapabilityMatcher()),
      sandboxBroker: null as never,
      policyEngine: new DefaultPolicyEngine(),
    });
    const ref = provider.descriptor.ref;

    await expect(broker.connectWorker(ref)).resolves.toMatchObject({
      ref: { id: `${provider.ref.id}-worker`, type: ref.type },
    });
    await expect(broker.connectWorker({ id: 'same-type', type: ref.type })).resolves.toMatchObject({
      ref: { type: ref.type },
    });
    await expect(broker.connectWorker({ id: 'missing', type: workerTypeId('com.example.worker.missing') })).rejects.toThrow(
      'No worker provider can connect',
    );
    await expect(
      new DefaultWorkerBroker({
        registry: new DefaultProviderRegistry(),
        resolver: new DefaultWorkerResolver(new DefaultCapabilityMatcher()),
        sandboxBroker: null as never,
        policyEngine: new DefaultPolicyEngine(),
      }).connectWorker(ref),
    ).rejects.toThrow('No worker provider can connect');
  });
});

describe('open artifacts and events', () => {
  it('stores artifacts with open artifact types', async () => {
    const store = new InMemoryArtifactStore();
    await store.put({ id: 'artifact-1', type: 'com.example.future-artifact', name: 'Future' });
    const content = new Uint8Array([1, 2, 3]);
    await store.put({ id: 'artifact-2', type: 'com.example.bytes', content, metadata: { a: 1 } });
    content[0] = 9;

    await expect(store.get('artifact-1')).resolves.toMatchObject({
      id: 'artifact-1',
      type: 'com.example.future-artifact',
    });
    const bytesArtifact = await store.get('artifact-2');
    expect(bytesArtifact?.content?.[0]).toBe(1);
    bytesArtifact!.content![1] = 9;
    await expect(store.get('artifact-2')).resolves.toMatchObject({ content: new Uint8Array([1, 2, 3]) });
    await expect(store.list()).resolves.toHaveLength(2);
    await store.delete('artifact-1');
    await expect(store.get('artifact-1')).resolves.toBeUndefined();
  });

  it('passes unknown provider-owned event types through core without rejection', async () => {
    const event: WorkerEvent = {
      id: 'event-1',
      runId: 'run-1',
      timestamp: new Date(0).toISOString(),
      type: eventTypeId('com.example.worker.unknown-event'),
      payload: { ok: true },
    };

    expect(event.type).toBe('com.example.worker.unknown-event');
    expect(EventJobAccepted).toBe('job.accepted');
  });

  it('adapts generic sandboxes to a Deep Agents shaped surface without framework coupling', async () => {
    const sandbox = new FakeSandbox('adapter-sandbox', providerRef('com.example.sandbox-provider'));
    const adapter = new DeepAgentsSandboxAdapter(sandbox);

    await expect(adapter.execute('ls')).resolves.toMatchObject({ output: 'ls' });
    await expect(adapter.uploadFiles([['/a.txt', new Uint8Array([1])]])).resolves.toEqual({
      files: [{ path: '/a.txt', error: null }],
    });
    await expect(adapter.downloadFiles(['/a.txt'])).resolves.toEqual({
      files: [{ path: '/a.txt', content: null, error: 'not implemented' }],
    });
    const executeOnly = {
      ...sandbox,
      uploadFiles: undefined,
      downloadFiles: undefined,
    } as Sandbox;
    const limitedAdapter = new DeepAgentsSandboxAdapter(executeOnly);
    await expect(limitedAdapter.uploadFiles([])).rejects.toThrow('file upload');
    await expect(limitedAdapter.downloadFiles([])).rejects.toThrow('file download');
  });
});
