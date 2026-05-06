import type { Artifact, Diagnostic, SerializedError } from './artifact';
import type { CapabilityMatcher, CapabilityRequirement, CapabilitySet } from './capability';
import { eventTypeId, type EventTypeId, type JobIntentId, type RuntimeTypeId, type WorkerTypeId } from './ids';
import type { PolicyRequest, PolicyEngine } from './policy';
import type { Provider, ProviderContext, ProviderRef, ProviderRegistry } from './provider';
import type { SandboxBroker } from './sandbox';

export interface WorkerRef {
  id: string;
  type: WorkerTypeId;
}

export interface RuntimeDescriptor {
  type: RuntimeTypeId;
  provider?: ProviderRef;
  displayName?: string;
  capabilities: CapabilitySet;
  labels?: Record<string, string>;
  annotations?: Record<string, unknown>;
}

export interface WorkerDescriptor {
  ref: WorkerRef;
  provider: ProviderRef;
  displayName?: string;
  version?: string;
  runtime: RuntimeDescriptor;
  capabilities: CapabilitySet;
  labels?: Record<string, string>;
  annotations?: Record<string, unknown>;
}

export interface WorkerJob {
  id: string;
  intent: JobIntentId;
  input: unknown;
  requirements?: {
    worker?: CapabilityRequirement[];
    sandbox?: CapabilityRequirement[];
  };
  policy?: PolicyRequest;
  labels?: Record<string, string>;
  annotations?: Record<string, unknown>;
}

export interface WorkerEvent {
  id: string;
  runId: string;
  timestamp: string;
  type: EventTypeId;
  payload?: unknown;
  labels?: Record<string, string>;
}

export interface WorkerRun {
  readonly id: string;
  readonly worker: WorkerRef;
  events(): AsyncIterable<WorkerEvent>;
  cancel(reason?: string): Promise<void>;
  result(): Promise<WorkerResult>;
}

export interface WorkerResult {
  runId: string;
  worker: WorkerRef;
  status: 'succeeded' | 'failed' | 'cancelled' | 'timed-out';
  output?: string;
  artifacts?: Artifact[];
  diagnostics?: Diagnostic[];
  metrics?: Record<string, number>;
  error?: SerializedError;
}

export interface StopOptions {
  reason?: string;
  timeoutMs?: number;
}

export interface SubmitJobOptions {
  signal?: AbortSignal;
  labels?: Record<string, string>;
  annotations?: Record<string, unknown>;
}

export interface Worker {
  readonly ref: WorkerRef;
  readonly provider: ProviderRef;
  describe(): Promise<WorkerDescriptor>;
  start?(signal?: AbortSignal): Promise<void>;
  stop?(options?: StopOptions): Promise<void>;
  submit(job: WorkerJob, options?: SubmitJobOptions): Promise<WorkerRun>;
}

export interface WorkerQuery {
  type?: WorkerTypeId;
  requiredCapabilities?: CapabilityRequirement[];
  labels?: Record<string, string>;
}

export interface CreateWorkerRequest {
  type?: WorkerTypeId;
  requiredCapabilities?: CapabilityRequirement[];
  labels?: Record<string, string>;
  annotations?: Record<string, unknown>;
}

export interface WorkerProvider extends Provider {
  listWorkers?(query?: WorkerQuery): Promise<WorkerDescriptor[]>;
  createWorker?(request: CreateWorkerRequest, context: ProviderContext): Promise<Worker>;
  connectWorker?(ref: WorkerRef, context: ProviderContext): Promise<Worker>;
}

export interface WorkerResolver {
  resolve(request: CreateWorkerRequest, candidates: WorkerProvider[], context: ProviderContext): Promise<WorkerProvider>;
}

export interface WorkerBroker {
  createWorker(request: CreateWorkerRequest): Promise<Worker>;
  connectWorker(ref: WorkerRef): Promise<Worker>;
}

export const EventWorkerStarted = eventTypeId('worker.started');
export const EventJobAccepted = eventTypeId('job.accepted');
export const EventSandboxCreated = eventTypeId('sandbox.created');
export const EventSandboxStdout = eventTypeId('sandbox.stdout');
export const EventSandboxStderr = eventTypeId('sandbox.stderr');
export const EventArtifactCreated = eventTypeId('artifact.created');
export const EventDiagnosticCreated = eventTypeId('diagnostic.created');
export const EventJobCompleted = eventTypeId('job.completed');
export const EventJobFailed = eventTypeId('job.failed');

export class DefaultWorkerResolver implements WorkerResolver {
  constructor(private readonly capabilityMatcher: CapabilityMatcher) {}

  async resolve(request: CreateWorkerRequest, candidates: WorkerProvider[], context: ProviderContext): Promise<WorkerProvider> {
    const matches: Array<{ provider: WorkerProvider; score: number }> = [];
    const diagnostics: string[] = [];

    for (const provider of candidates) {
      if (!provider.createWorker) {
        diagnostics.push(`${provider.ref.id}: createWorker is not supported.`);
        continue;
      }
      const descriptors = await getWorkerDescriptors(provider, request);
      if (descriptors.length === 0) {
        diagnostics.push(`${provider.ref.id}: no worker descriptors available.`);
        continue;
      }
      const descriptorMatches = descriptors.map((descriptor) => scoreWorkerDescriptor(descriptor, request, this.capabilityMatcher));
      const best = descriptorMatches.sort((left, right) => right.score - left.score)[0];
      if (best.ok) {
        matches.push({ provider, score: best.score });
      } else {
        diagnostics.push(`${provider.ref.id}: ${best.reason}.`);
      }
    }

    const selected = matches.sort((left, right) => right.score - left.score)[0];
    if (selected) {
      return selected.provider;
    }

    context.logger?.debug?.('Worker provider resolution failed.', { diagnostics });
    throw new Error(`No worker provider matched request. ${diagnostics.join(' ')}`.trim());
  }
}

export interface DefaultWorkerBrokerOptions {
  registry: ProviderRegistry;
  resolver: WorkerResolver;
  sandboxBroker: SandboxBroker;
  policyEngine: PolicyEngine;
  context?: Partial<ProviderContext>;
}

export class DefaultWorkerBroker implements WorkerBroker {
  private readonly registry: ProviderRegistry;
  private readonly resolver: WorkerResolver;
  private readonly sandboxBroker: SandboxBroker;
  private readonly policyEngine: PolicyEngine;
  private readonly context: Partial<ProviderContext>;

  constructor(options: DefaultWorkerBrokerOptions) {
    this.registry = options.registry;
    this.resolver = options.resolver;
    this.sandboxBroker = options.sandboxBroker;
    this.policyEngine = options.policyEngine;
    this.context = options.context ?? {};
  }

  async createWorker(request: CreateWorkerRequest): Promise<Worker> {
    const context = this.createContext();
    const provider = await this.resolver.resolve(request, this.registry.getWorkerProviders(), context);
    return provider.createWorker!(request, context);
  }

  async connectWorker(ref: WorkerRef): Promise<Worker> {
    const context = this.createContext();
    for (const provider of this.registry.getWorkerProviders()) {
      if (!provider.connectWorker) {
        continue;
      }
      const descriptors = await getWorkerDescriptors(provider, { type: ref.type });
      if (descriptors.some((descriptor) => descriptor.ref.id === ref.id || descriptor.ref.type === ref.type)) {
        return provider.connectWorker(ref, context);
      }
    }
    throw new Error(`No worker provider can connect to worker ${ref.id}.`);
  }

  private createContext(): ProviderContext {
    return {
      ...this.context,
      registry: this.registry,
      sandboxBroker: this.sandboxBroker,
      policyEngine: this.policyEngine,
    };
  }
}

async function getWorkerDescriptors(provider: WorkerProvider, request: CreateWorkerRequest): Promise<WorkerDescriptor[]> {
  if (provider.listWorkers) {
    return provider.listWorkers({
      type: request.type,
      requiredCapabilities: request.requiredCapabilities,
      labels: request.labels,
    });
  }
  const descriptor = await provider.describe();
  return descriptor.capabilities
    ? [{
      ref: { id: `${provider.ref.id}:worker`, type: request.type ?? ('' as WorkerTypeId) },
      provider: provider.ref,
      runtime: {
        type: '' as RuntimeTypeId,
        capabilities: descriptor.capabilities,
      },
      capabilities: descriptor.capabilities,
      displayName: descriptor.displayName,
      labels: descriptor.labels,
      annotations: descriptor.annotations,
    }]
    : [];
}

function scoreWorkerDescriptor(
  descriptor: WorkerDescriptor,
  request: CreateWorkerRequest,
  capabilityMatcher: CapabilityMatcher,
): { ok: boolean; score: number; reason?: string } {
  if (request.type && descriptor.ref.type !== request.type) {
    return { ok: false, score: 0, reason: `worker type ${descriptor.ref.type} did not match ${request.type}` };
  }
  const requirements = request.requiredCapabilities ?? [];
  const match = capabilityMatcher.satisfies(descriptor.capabilities, requirements);
  if (!match.ok) {
    return {
      ok: false,
      score: 0,
      reason: [
        ...match.missing.map((requirement) => `missing ${requirement.id}`),
        ...match.failed.map((failure) => failure.reason),
      ].join('; '),
    };
  }
  const requiredScore = requirements.filter((requirement) => descriptor.capabilities.has(requirement.id)).length * 10;
  return {
    ok: true,
    score: requiredScore + descriptor.capabilities.list().length,
  };
}
