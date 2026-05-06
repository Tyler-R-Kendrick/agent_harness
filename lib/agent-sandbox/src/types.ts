export interface SandboxExecuteResponse {
  output: string;
  exitCode: number | null;
  truncated: boolean;
  durationMs: number;
}

export interface SandboxFileUploadResponse {
  path: string;
  error: string | null;
}

export interface SandboxFileDownloadResponse {
  path: string;
  content: Uint8Array | null;
  error: string | null;
}

export interface SkillSandbox {
  readonly id: string;
  execute(command: string, options?: { timeoutMs?: number }): Promise<SandboxExecuteResponse>;
  uploadFiles(files: Array<[path: string, content: Uint8Array]>): Promise<SandboxFileUploadResponse[]>;
  downloadFiles(paths: string[]): Promise<SandboxFileDownloadResponse[]>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export interface SandboxIsolationCapability {
  kind: 'worker' | 'process' | 'iframe' | 'remote';
  boundary: string;
}

export interface SandboxFileSystemCapability {
  kind: 'virtual' | 'local' | 'remote';
  scoped: boolean;
}

export interface SandboxComputeCapability {
  kind: 'wasm-js' | 'native' | 'remote';
  runtime: string;
  networkDefault: 'deny' | 'allow';
}

export abstract class Sandbox {
  readonly id: string;
  abstract readonly isolation: SandboxIsolationCapability;
  abstract readonly fileSystem: SandboxFileSystemCapability;
  abstract readonly compute: SandboxComputeCapability;

  protected constructor(id: string) {
    this.id = id;
  }

  abstract reset(): Promise<void>;
  abstract close(): Promise<void>;
}

export abstract class AgentSandbox extends Sandbox implements SkillSandbox {
  readonly kind = 'agent' as const;

  abstract execute(command: string, options?: { timeoutMs?: number }): Promise<SandboxExecuteResponse>;
  abstract uploadFiles(files: Array<[path: string, content: Uint8Array]>): Promise<SandboxFileUploadResponse[]>;
  abstract downloadFiles(paths: string[]): Promise<SandboxFileDownloadResponse[]>;
}

export interface BrowserSandboxOptions {
  id?: string;
  workerUrl?: URL;
  defaultTimeoutMs?: number;
  maxOutputBytes?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  allowNetwork?: boolean;
  network?: {
    allowedOrigins?: string[];
    allowedMethods?: string[];
    allowLocalhostHttp?: boolean;
    maxRequestBytes?: number;
    maxResponseBytes?: number;
    timeoutMs?: number;
  };
  workerFactory?: () => SandboxWorkerPort;
}

export type SandboxWorkerRequest =
  | { id: number; op: 'execute'; payload: { command: string; timeoutMs: number } }
  | { id: number; op: 'uploadFiles'; payload: { files: Array<[string, Uint8Array]> } }
  | { id: number; op: 'downloadFiles'; payload: { paths: string[] } }
  | { id: number; op: 'reset'; payload?: undefined };

export type SandboxWorkerConfigureRequest = {
  id: 0;
  op: 'configure';
  payload: Pick<BrowserSandboxOptions, 'maxOutputBytes' | 'maxFileBytes' | 'maxTotalBytes' | 'allowNetwork' | 'network'>;
};

export type SandboxWorkerMessage = SandboxWorkerRequest | SandboxWorkerConfigureRequest;

export type SandboxWorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

export interface SandboxWorkerPort {
  postMessage(message: SandboxWorkerMessage): void;
  terminate(): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<SandboxWorkerResponse>) => void): void;
  addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<SandboxWorkerResponse>) => void): void;
  removeEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
}
