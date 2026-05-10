export type DurableTaskStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type DurableOutboxStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface DurableTaskError {
  name: string;
  message: string;
  stack?: string;
}

export interface DurableTaskRecord<
  TInput = unknown,
  TOutput = unknown,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  type: string;
  status: DurableTaskStatus;
  input: TInput;
  output: TOutput | null;
  error: DurableTaskError | null;
  attemptCount: number;
  maxAttempts: number;
  createdAt: number;
  updatedAt: number;
  scheduledFor: number;
  startedAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
  lockedUntil: number | null;
  lockOwner: string | null;
  idempotencyKey: string | null;
  parentTaskId: string | null;
  metadata: TMetadata;
}

export interface DurableTaskSnapshot {
  tasks: DurableTaskRecord[];
  outbox: DurableOutboxOperation[];
}

export interface DurableTaskRunContext<TInput = unknown, TMetadata extends Record<string, unknown> = Record<string, unknown>> {
  task: DurableTaskRecord<TInput, unknown, TMetadata>;
  input: TInput;
  signal?: AbortSignal;
}

export interface DurableTaskDefinition<TInput = unknown, TOutput = unknown> {
  type: string;
  maxAttempts?: number;
  run: (context: DurableTaskRunContext<TInput>) => Promise<TOutput> | TOutput;
}

export interface EnqueueDurableTaskOptions<TMetadata extends Record<string, unknown> = Record<string, unknown>> {
  id?: string;
  idempotencyKey?: string;
  parentTaskId?: string;
  maxAttempts?: number;
  scheduledFor?: number;
  metadata?: TMetadata;
}

export interface DurableTaskListFilter {
  type?: string;
  status?: DurableTaskStatus | DurableTaskStatus[];
  parentTaskId?: string | null;
}

export type DurableTaskUpdater = (
  task: DurableTaskRecord,
) => DurableTaskRecord | Partial<DurableTaskRecord>;

export interface DurableOutboxOperation {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  idempotencyKey: string | null;
  status: DurableOutboxStatus;
  attemptCount: number;
  maxAttempts: number;
  createdAt: number;
  updatedAt: number;
  scheduledFor: number;
  startedAt: number | null;
  completedAt: number | null;
  error: DurableTaskError | null;
}

export interface EnqueueOutboxOperationInput {
  id?: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  idempotencyKey?: string;
  maxAttempts?: number;
  scheduledFor?: number;
}

export type DurableOutboxUpdater = (
  operation: DurableOutboxOperation,
) => DurableOutboxOperation | Partial<DurableOutboxOperation>;

export interface DurableTaskStore {
  putTask(task: DurableTaskRecord): Promise<DurableTaskRecord>;
  getTask(id: string): Promise<DurableTaskRecord | null>;
  updateTask(id: string, updater: DurableTaskUpdater): Promise<DurableTaskRecord | null>;
  listTasks(filter?: DurableTaskListFilter): Promise<DurableTaskRecord[]>;
  listRunnableTasks(now: number, limit?: number): Promise<DurableTaskRecord[]>;
  findTaskByIdempotencyKey(idempotencyKey: string): Promise<DurableTaskRecord | null>;
  snapshot(): Promise<DurableTaskSnapshot>;
  enqueueOutboxOperation(input: EnqueueOutboxOperationInput, now: number): Promise<DurableOutboxOperation>;
  getOutboxOperation(id: string): Promise<DurableOutboxOperation | null>;
  updateOutboxOperation(id: string, updater: DurableOutboxUpdater): Promise<DurableOutboxOperation | null>;
  listDueOutboxOperations(now: number, limit?: number): Promise<DurableOutboxOperation[]>;
}

export interface DurableTaskRuntimeOptions {
  store: DurableTaskStore;
  lockOwner: string;
  now?: () => number;
  lockDurationMs?: number;
  retryDelayMs?: (attemptCount: number, task: DurableTaskRecord) => number;
}

export interface DurableTaskRuntime {
  defineTask<TInput = unknown, TOutput = unknown>(definition: DurableTaskDefinition<TInput, TOutput>): void;
  enqueue<TInput = unknown, TMetadata extends Record<string, unknown> = Record<string, unknown>>(
    type: string,
    input: TInput,
    options?: EnqueueDurableTaskOptions<TMetadata>,
  ): Promise<DurableTaskRecord<TInput>>;
  getTask(id: string): Promise<DurableTaskRecord | null>;
  listTasks(filter?: DurableTaskListFilter): Promise<DurableTaskRecord[]>;
  updateTask(id: string, updater: (task: DurableTaskRecord) => Partial<DurableTaskRecord>): Promise<DurableTaskRecord>;
  cancel(id: string, cancelledBy?: string): Promise<DurableTaskRecord>;
  retry(id: string): Promise<DurableTaskRecord>;
  resumeExpiredLocks(): Promise<DurableTaskRecord[]>;
  tick(limit?: number): Promise<DurableTaskRecord[]>;
  snapshot(): Promise<DurableTaskSnapshot>;
  observe(listener: DurableTaskSnapshotListener): () => void;
}

export type DurableTaskSnapshotListener = (snapshot: DurableTaskSnapshot) => void;

export interface ServiceWorkerOutboxBridge {
  flush(limit?: number): Promise<DurableOutboxOperation[]>;
}

export interface ServiceWorkerOutboxBridgeOptions {
  store: DurableTaskStore;
  fetch: (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
  now?: () => number;
  retryDelayMs?: (attemptCount: number, operation: DurableOutboxOperation) => number;
}

export interface WorkboxBackgroundSyncRegistration {
  enabled: boolean;
  queue: unknown;
}

export interface WorkboxBackgroundSyncOptions {
  workbox?: {
    backgroundSync?: {
      Queue: new (queueName: string) => unknown;
    };
  };
  queueName: string;
}
