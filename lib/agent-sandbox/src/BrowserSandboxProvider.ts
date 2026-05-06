import {
  AgentSandbox,
  type BrowserSandboxOptions,
  type SandboxComputeCapability,
  type SandboxExecuteResponse,
  type SandboxFileDownloadResponse,
  type SandboxFileSystemCapability,
  type SandboxFileUploadResponse,
  type SandboxIsolationCapability,
  type SandboxWorkerPort,
  type SandboxWorkerRequest,
  type SandboxWorkerResponse,
} from './types';
import { SandboxClosedError, SandboxExecutionError, SandboxTimeoutError } from './errors';
import { DEFAULT_MAX_FILE_BYTES, DEFAULT_MAX_TOTAL_BYTES } from './vfs';

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 1_000_000;
export const DEFAULT_ALLOW_NETWORK = false;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

interface SandboxWorkerPayloadMap {
  execute: { command: string; timeoutMs: number };
  uploadFiles: { files: Array<[string, Uint8Array]> };
  downloadFiles: { paths: string[] };
  reset: undefined;
}

let nextSandboxId = 1;

function createSandboxId(): string {
  const id = nextSandboxId;
  nextSandboxId += 1;
  return `browser-sandbox-${id}`;
}

function createDefaultWorker(workerUrl?: URL): SandboxWorkerPort {
  if (workerUrl) {
    return new Worker(workerUrl, { type: 'module' }) as SandboxWorkerPort;
  }
  return new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' }) as SandboxWorkerPort;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function truncateOutput(response: SandboxExecuteResponse, maxOutputBytes: number): SandboxExecuteResponse {
  const encoded = textEncoder.encode(response.output);
  if (encoded.byteLength <= maxOutputBytes) {
    return response;
  }
  return {
    ...response,
    output: textDecoder.decode(encoded.slice(0, maxOutputBytes)),
    truncated: true,
  };
}

export class BrowserSandboxProvider extends AgentSandbox {
  readonly isolation: SandboxIsolationCapability = {
    kind: 'worker',
    boundary: 'dedicated-module-worker',
  };

  readonly fileSystem: SandboxFileSystemCapability = {
    kind: 'virtual',
    scoped: true,
  };

  readonly compute: SandboxComputeCapability = {
    kind: 'wasm-js',
    runtime: 'quickjs',
    networkDefault: 'deny',
  };

  private readonly worker: SandboxWorkerPort;
  private readonly defaultTimeoutMs: number;
  private readonly maxOutputBytes: number;
  private readonly pending = new Map<number, PendingRequest>();
  private nextRequestId = 1;
  private closed = false;

  constructor(options: BrowserSandboxOptions = {}) {
    super(options.id ?? createSandboxId());
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    const workerOptions = {
      maxOutputBytes: this.maxOutputBytes,
      maxFileBytes: options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
      maxTotalBytes: options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES,
      allowNetwork: options.allowNetwork ?? DEFAULT_ALLOW_NETWORK,
      network: options.network,
    };
    this.worker = options.workerFactory?.() ?? createDefaultWorker(options.workerUrl);
    this.worker.addEventListener('message', this.handleWorkerMessage);
    this.worker.addEventListener('error', this.handleWorkerError);
    this.worker.postMessage({ id: 0, op: 'configure', payload: workerOptions });
  }

  async execute(command: string, options: { timeoutMs?: number } = {}): Promise<SandboxExecuteResponse> {
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const response = await this.request<SandboxExecuteResponse>('execute', { command, timeoutMs }, timeoutMs);
    return truncateOutput(response, this.maxOutputBytes);
  }

  uploadFiles(files: Array<[path: string, content: Uint8Array]>): Promise<SandboxFileUploadResponse[]> {
    return this.request<SandboxFileUploadResponse[]>('uploadFiles', { files }, this.defaultTimeoutMs);
  }

  downloadFiles(paths: string[]): Promise<SandboxFileDownloadResponse[]> {
    return this.request<SandboxFileDownloadResponse[]>('downloadFiles', { paths }, this.defaultTimeoutMs);
  }

  reset(): Promise<void> {
    return this.request<void>('reset', undefined, this.defaultTimeoutMs);
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.worker.removeEventListener('message', this.handleWorkerMessage);
    this.worker.removeEventListener('error', this.handleWorkerError);
    this.worker.terminate();
    this.rejectAll(new SandboxClosedError());
  }

  private request<T, TOperation extends SandboxWorkerRequest['op'] = SandboxWorkerRequest['op']>(
    op: TOperation,
    payload: SandboxWorkerPayloadMap[TOperation],
    timeoutMs: number,
  ): Promise<T> {
    if (this.closed) {
      return Promise.reject(new SandboxClosedError());
    }

    const id = this.nextRequestId;
    this.nextRequestId += 1;

    return new Promise<T>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        const error = new SandboxTimeoutError(`Sandbox request ${id} timed out after ${timeoutMs}ms.`);
        this.closed = true;
        this.worker.removeEventListener('message', this.handleWorkerMessage);
        this.worker.removeEventListener('error', this.handleWorkerError);
        this.worker.terminate();
        this.rejectAll(error);
      }, timeoutMs);

      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeoutHandle,
      });

      const message = payload === undefined ? { id, op } : { id, op, payload };
      this.worker.postMessage(message as SandboxWorkerRequest);
    });
  }

  private handleWorkerMessage = (event: MessageEvent<SandboxWorkerResponse>): void => {
    const response = event.data;
    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutHandle);
    this.pending.delete(response.id);
    if (response.ok) {
      pending.resolve(response.result);
      return;
    }
    pending.reject(new SandboxExecutionError(response.error));
  };

  private handleWorkerError = (event: ErrorEvent): void => {
    const message = event.message || 'Sandbox worker failed.';
    this.closed = true;
    this.worker.removeEventListener('message', this.handleWorkerMessage);
    this.worker.removeEventListener('error', this.handleWorkerError);
    this.worker.terminate();
    this.rejectAll(new SandboxExecutionError(message));
  };

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeoutHandle);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
