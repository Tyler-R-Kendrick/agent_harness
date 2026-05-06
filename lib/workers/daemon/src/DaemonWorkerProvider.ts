import {
  DefaultCapabilitySet,
  EventJobAccepted,
  EventJobCompleted,
  EventJobFailed,
  SurfaceWorkerProvider,
  WorkerProviderMarker,
  capabilityId,
  providerId,
  runtimeTypeId,
  workerTypeId,
  type CapabilitySet,
  type CreateWorkerRequest,
  type Diagnostic,
  type ProviderContext,
  type ProviderDescriptor,
  type ProviderRef,
  type RuntimeTypeId,
  type Worker,
  type WorkerDescriptor,
  type WorkerEvent,
  type WorkerJob,
  type WorkerProvider,
  type WorkerRef,
  type WorkerResult,
  type WorkerRun,
  type WorkerTypeId,
} from '@agent-harness/worker';

export const DaemonWorkerProviderId = providerId('com.example.worker-provider.daemon');
export const DaemonWorkerType = workerTypeId('com.example.worker.daemon');
export const DaemonRuntimeType = runtimeTypeId('com.example.runtime.daemon');
export const CapDaemonRequest = capabilityId('cap.daemon.request');
export const CapDaemonLocalInference = capabilityId('cap.daemon.local-inference');

export interface DaemonTransport {
  request(action: string, payload: unknown, options?: { signal?: AbortSignal }): Promise<unknown>;
}

export interface DaemonWorkerProviderOptions {
  transport: DaemonTransport;
  providerId?: ProviderRef['id'];
  workerType?: WorkerTypeId;
  runtimeType?: RuntimeTypeId;
  displayName?: string;
  capabilities?: CapabilitySet;
}

const DEFAULT_CAPABILITIES = new DefaultCapabilitySet([
  { id: CapDaemonRequest },
  { id: CapDaemonLocalInference },
]);

let nextDaemonWorkerId = 1;
let nextDaemonRunId = 1;

function createWorkerId(): string {
  const id = nextDaemonWorkerId;
  nextDaemonWorkerId += 1;
  return `daemon-worker-${id}`;
}

function createRunId(): string {
  const id = nextDaemonRunId;
  nextDaemonRunId += 1;
  return `daemon-worker-run-${id}`;
}

function cloneCapabilities(capabilities: CapabilitySet): DefaultCapabilitySet {
  return new DefaultCapabilitySet(capabilities.list());
}

function timestamp(context: ProviderContext): string {
  return (context.clock?.now() ?? new Date()).toISOString();
}

function stringify(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function serializeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: 'Error', message: String(error) };
}

function parseDaemonRequest(input: unknown): { action: string; payload: unknown } {
  if (!input || typeof input !== 'object') {
    throw new Error('Daemon worker input must be an object with an action string.');
  }
  const candidate = input as { action?: unknown; payload?: unknown };
  if (typeof candidate.action !== 'string' || candidate.action.trim().length === 0) {
    throw new Error('Daemon worker input must include an action string.');
  }
  return {
    action: candidate.action,
    payload: candidate.payload,
  };
}

export class DaemonWorkerProvider implements WorkerProvider {
  readonly [WorkerProviderMarker] = true;
  readonly ref: ProviderRef;
  private readonly transport: DaemonTransport;
  private readonly workerType: WorkerTypeId;
  private readonly runtimeType: RuntimeTypeId;
  private readonly displayName: string;
  private readonly capabilities: CapabilitySet;

  constructor(options: DaemonWorkerProviderOptions) {
    this.ref = { id: options.providerId ?? DaemonWorkerProviderId };
    this.transport = options.transport;
    this.workerType = options.workerType ?? DaemonWorkerType;
    this.runtimeType = options.runtimeType ?? DaemonRuntimeType;
    this.displayName = options.displayName ?? 'Daemon Worker Provider';
    this.capabilities = options.capabilities ?? DEFAULT_CAPABILITIES;
  }

  async describe(): Promise<ProviderDescriptor> {
    return {
      ref: this.ref,
      displayName: this.displayName,
      provides: [{ id: SurfaceWorkerProvider }],
      capabilities: cloneCapabilities(this.capabilities),
      annotations: {
        daemon: 'Action transport adapter; does not expose arbitrary shell execution.',
      },
    };
  }

  async listWorkers(): Promise<WorkerDescriptor[]> {
    return [this.createDescriptor(`${this.ref.id}:template`)];
  }

  async createWorker(_request: CreateWorkerRequest, context: ProviderContext): Promise<Worker> {
    return new DaemonWorker({
      ref: { id: createWorkerId(), type: this.workerType },
      provider: this.ref,
      runtimeType: this.runtimeType,
      capabilities: this.capabilities,
      transport: this.transport,
      context,
    });
  }

  private createDescriptor(id: string): WorkerDescriptor {
    return {
      ref: { id, type: this.workerType },
      provider: this.ref,
      displayName: 'Daemon Worker',
      runtime: {
        type: this.runtimeType,
        provider: this.ref,
        displayName: 'Daemon Message Runtime',
        capabilities: cloneCapabilities(this.capabilities),
      },
      capabilities: cloneCapabilities(this.capabilities),
      labels: {
        host: 'daemon',
      },
    };
  }
}

interface DaemonWorkerOptions {
  ref: WorkerRef;
  provider: ProviderRef;
  runtimeType: RuntimeTypeId;
  capabilities: CapabilitySet;
  transport: DaemonTransport;
  context: ProviderContext;
}

export class DaemonWorker implements Worker {
  readonly ref: WorkerRef;
  readonly provider: ProviderRef;
  private readonly runtimeType: RuntimeTypeId;
  private readonly capabilities: CapabilitySet;
  private readonly transport: DaemonTransport;
  private readonly context: ProviderContext;

  constructor(options: DaemonWorkerOptions) {
    this.ref = options.ref;
    this.provider = options.provider;
    this.runtimeType = options.runtimeType;
    this.capabilities = options.capabilities;
    this.transport = options.transport;
    this.context = options.context;
  }

  async describe(): Promise<WorkerDescriptor> {
    return {
      ref: this.ref,
      provider: this.provider,
      displayName: 'Daemon Worker',
      runtime: {
        type: this.runtimeType,
        provider: this.provider,
        displayName: 'Daemon Message Runtime',
        capabilities: cloneCapabilities(this.capabilities),
      },
      capabilities: cloneCapabilities(this.capabilities),
    };
  }

  async submit(job: WorkerJob, options: { signal?: AbortSignal } = {}): Promise<WorkerRun> {
    const runId = createRunId();
    const events: WorkerEvent[] = [];
    const emit = (type: WorkerEvent['type'], payload?: unknown) => {
      events.push({
        id: `${runId}:event-${events.length + 1}`,
        runId,
        timestamp: timestamp(this.context),
        type,
        payload,
      });
    };

    emit(EventJobAccepted, { jobId: job.id, intent: job.intent });
    const result = await this.execute(job, runId, emit, options.signal);
    return new CompletedDaemonRun(runId, this.ref, events, result);
  }

  private async execute(
    job: WorkerJob,
    runId: string,
    emit: (type: WorkerEvent['type'], payload?: unknown) => void,
    signal?: AbortSignal,
  ): Promise<WorkerResult> {
    const diagnostics: Diagnostic[] = [];
    try {
      const request = parseDaemonRequest(job.input);
      const response = await this.transport.request(request.action, request.payload, { signal });
      emit(EventJobCompleted, { jobId: job.id, action: request.action });
      return {
        runId,
        worker: this.ref,
        status: 'succeeded',
        output: stringify(response),
      };
    } catch (error) {
      const serialized = serializeError(error);
      diagnostics.push({ severity: 'error', message: serialized.message });
      emit(EventJobFailed, { jobId: job.id, error: serialized });
      return {
        runId,
        worker: this.ref,
        status: 'failed',
        diagnostics,
        error: serialized,
      };
    }
  }
}

class CompletedDaemonRun implements WorkerRun {
  readonly id: string;
  readonly worker: WorkerRef;
  private readonly completedEvents: WorkerEvent[];
  private readonly completedResult: WorkerResult;
  private cancelled = false;

  constructor(id: string, worker: WorkerRef, events: WorkerEvent[], result: WorkerResult) {
    this.id = id;
    this.worker = worker;
    this.completedEvents = events;
    this.completedResult = result;
  }

  async *events(): AsyncIterable<WorkerEvent> {
    yield* this.completedEvents;
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
  }

  async result(): Promise<WorkerResult> {
    if (!this.cancelled) {
      return this.completedResult;
    }
    return {
      ...this.completedResult,
      status: 'cancelled',
    };
  }
}
