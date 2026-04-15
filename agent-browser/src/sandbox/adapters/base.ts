import type {
  ExecutionArtifact,
  LogLevel,
  RunMetricsMessage,
  RunRequest,
  RunTerminalStatus,
  RunTestResultMessage,
} from '../protocol';

export type AdapterKind = 'mock' | 'webcontainer' | 'unavailable';

export type ExecutionAdapterEvent =
  | { type: 'log'; level: LogLevel; chunk: string; bytes: number }
  | { type: 'stdout'; chunk: string; bytes: number }
  | { type: 'stderr'; chunk: string; bytes: number }
  | { type: 'test_result'; payload: RunTestResultMessage['payload'] };

export interface AdapterExecutionContext {
  signal: AbortSignal;
  emit: (event: ExecutionAdapterEvent) => void;
}

export interface AdapterExecutionResult {
  exitCode: number;
  status: RunTerminalStatus;
  reason?: string;
  artifacts?: ExecutionArtifact[];
  metrics?: RunMetricsMessage['payload'];
}

export interface ExecutionAdapter {
  readonly kind: AdapterKind;
  readonly supportsAbort: boolean;
  canHandle(request: RunRequest): boolean;
  execute(request: RunRequest, context: AdapterExecutionContext): Promise<AdapterExecutionResult>;
  dispose?(): Promise<void>;
}
