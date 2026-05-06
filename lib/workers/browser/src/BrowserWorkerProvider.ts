import {
  CapFsVirtual,
  DefaultCapabilitySet,
  EventJobAccepted,
  EventJobCompleted,
  EventJobFailed,
  EventSandboxCreated,
  EventSandboxStdout,
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
  type SandboxLease,
  type Worker,
  type WorkerDescriptor,
  type WorkerEvent,
  type WorkerJob,
  type WorkerProvider,
  type WorkerRef,
  type WorkerResult,
  type WorkerRun,
  type SubmitJobOptions,
} from '@agent-harness/worker';

export const BrowserWorkerProviderId = providerId('com.example.worker-provider.browser');
export const BrowserWorkerType = workerTypeId('com.example.worker.browser');
export const BrowserRuntimeType = runtimeTypeId('com.example.runtime.browser');
export const CapWorkerJobSkillCreate = capabilityId('cap.worker.job.skill.create');
export const CapWorkerSandboxOrchestration = capabilityId('cap.worker.sandbox-orchestration');

export interface BrowserWorkerProviderOptions {
  providerId?: ProviderRef['id'];
  displayName?: string;
  capabilities?: CapabilitySet;
}

interface SkillCreateInput {
  prompt?: string;
  seedFiles?: Array<{ path: string; content: string | Uint8Array }>;
  commands?: string[];
}

const textEncoder = new TextEncoder();

const DEFAULT_CAPABILITIES = new DefaultCapabilitySet([
  { id: CapWorkerJobSkillCreate },
  { id: CapWorkerSandboxOrchestration },
  { id: CapFsVirtual },
]);

let nextWorkerId = 1;
let nextRunId = 1;

function createWorkerId(): string {
  const id = nextWorkerId;
  nextWorkerId += 1;
  return `browser-worker-${id}`;
}

function createRunId(): string {
  const id = nextRunId;
  nextRunId += 1;
  return `browser-worker-run-${id}`;
}

function cloneCapabilities(capabilities: CapabilitySet): DefaultCapabilitySet {
  return new DefaultCapabilitySet(capabilities.list());
}

function timestamp(context: ProviderContext): string {
  return (context.clock?.now() ?? new Date()).toISOString();
}

function serializeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: 'Error', message: String(error) };
}

function parseInput(input: unknown): SkillCreateInput {
  if (!input || typeof input !== 'object') {
    return {};
  }
  const candidate = input as SkillCreateInput;
  return {
    prompt: typeof candidate.prompt === 'string' ? candidate.prompt : undefined,
    seedFiles: Array.isArray(candidate.seedFiles) ? candidate.seedFiles : [],
    commands: Array.isArray(candidate.commands) ? candidate.commands.filter((command) => typeof command === 'string') : [],
  };
}

function encodeContent(content: string | Uint8Array): Uint8Array {
  return typeof content === 'string' ? textEncoder.encode(content) : new Uint8Array(content);
}

export class BrowserWorkerProvider implements WorkerProvider {
  readonly [WorkerProviderMarker] = true;
  readonly ref: ProviderRef;
  private readonly displayName: string;
  private readonly capabilities: CapabilitySet;

  constructor(options: BrowserWorkerProviderOptions = {}) {
    this.ref = { id: options.providerId ?? BrowserWorkerProviderId };
    this.displayName = options.displayName ?? 'Browser Worker Provider';
    this.capabilities = options.capabilities ?? DEFAULT_CAPABILITIES;
  }

  async describe(): Promise<ProviderDescriptor> {
    return {
      ref: this.ref,
      displayName: this.displayName,
      provides: [{ id: SurfaceWorkerProvider }],
      capabilities: cloneCapabilities(this.capabilities),
    };
  }

  async listWorkers(): Promise<WorkerDescriptor[]> {
    return [this.createDescriptor(`${this.ref.id}:template`)];
  }

  async createWorker(_request: CreateWorkerRequest, context: ProviderContext): Promise<Worker> {
    return new BrowserWorker({
      ref: { id: createWorkerId(), type: BrowserWorkerType },
      provider: this.ref,
      capabilities: this.capabilities,
      context,
    });
  }

  private createDescriptor(id: string): WorkerDescriptor {
    return {
      ref: { id, type: BrowserWorkerType },
      provider: this.ref,
      displayName: 'Browser Worker',
      runtime: {
        type: BrowserRuntimeType,
        provider: this.ref,
        displayName: 'Browser Orchestrator Runtime',
        capabilities: cloneCapabilities(this.capabilities),
      },
      capabilities: cloneCapabilities(this.capabilities),
      labels: {
        host: 'browser',
      },
    };
  }
}

interface BrowserWorkerOptions {
  ref: WorkerRef;
  provider: ProviderRef;
  capabilities: CapabilitySet;
  context: ProviderContext;
}

export class BrowserWorker implements Worker {
  readonly ref: WorkerRef;
  readonly provider: ProviderRef;
  private readonly capabilities: CapabilitySet;
  private readonly context: ProviderContext;

  constructor(options: BrowserWorkerOptions) {
    this.ref = options.ref;
    this.provider = options.provider;
    this.capabilities = options.capabilities;
    this.context = options.context;
  }

  async describe(): Promise<WorkerDescriptor> {
    return {
      ref: this.ref,
      provider: this.provider,
      displayName: 'Browser Worker',
      runtime: {
        type: BrowserRuntimeType,
        provider: this.provider,
        displayName: 'Browser Orchestrator Runtime',
        capabilities: cloneCapabilities(this.capabilities),
      },
      capabilities: cloneCapabilities(this.capabilities),
    };
  }

  async submit(job: WorkerJob, _options: SubmitJobOptions = {}): Promise<WorkerRun> {
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
    const result = await this.executeJob(job, runId, emit);
    return new CompletedWorkerRun(runId, this.ref, events, result);
  }

  private async executeJob(
    job: WorkerJob,
    runId: string,
    emit: (type: WorkerEvent['type'], payload?: unknown) => void,
  ): Promise<WorkerResult> {
    let lease: SandboxLease | null = null;
    const diagnostics: Diagnostic[] = [];
    const outputs: string[] = [];

    try {
      lease = await this.context.sandboxBroker.createSandbox({
        requiredCapabilities: job.requirements?.sandbox,
        policy: job.policy,
      });
      emit(EventSandboxCreated, { sandbox: lease.sandbox.ref });

      const input = parseInput(job.input);
      if (input.seedFiles?.length) {
        if (!lease.sandbox.uploadFiles) {
          throw new Error('Selected sandbox does not support seed file upload.');
        }
        await lease.sandbox.uploadFiles({
          files: input.seedFiles.map((file) => ({ path: file.path, content: encodeContent(file.content) })),
        });
      }

      for (const command of input.commands ?? []) {
        const commandResult = await lease.sandbox.execute({ command });
        if (commandResult.output) {
          outputs.push(commandResult.output);
          emit(EventSandboxStdout, { command, output: commandResult.output, exitCode: commandResult.exitCode });
        }
        if (commandResult.exitCode !== 0) {
          diagnostics.push({
            severity: 'error',
            message: `Sandbox command failed with exit code ${String(commandResult.exitCode)}: ${command}`,
          });
          emit(EventJobFailed, { jobId: job.id, command, exitCode: commandResult.exitCode });
          return {
            runId,
            worker: this.ref,
            status: 'failed',
            output: outputs.join('\n'),
            diagnostics,
          };
        }
      }

      emit(EventJobCompleted, { jobId: job.id });
      return {
        runId,
        worker: this.ref,
        status: 'succeeded',
        output: outputs.join('\n'),
      };
    } catch (error) {
      const serialized = serializeError(error);
      diagnostics.push({ severity: 'error', message: serialized.message });
      emit(EventJobFailed, { jobId: job.id, error: serialized });
      return {
        runId,
        worker: this.ref,
        status: 'failed',
        output: outputs.join('\n'),
        diagnostics,
        error: serialized,
      };
    } finally {
      await lease?.release();
    }
  }
}

class CompletedWorkerRun implements WorkerRun {
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

  async cancel(_reason?: string): Promise<void> {
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
