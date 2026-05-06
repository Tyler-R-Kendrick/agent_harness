import {
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_MAX_TOTAL_BYTES,
  InMemoryVirtualFileSystem,
  normalizeSandboxPath,
} from './vfs';
import { QuickJsJavaScriptExecutor, type JavaScriptExecutor } from './quickjsRuntime';
import type {
  BrowserSandboxOptions,
  SandboxExecuteResponse,
  SandboxFileDownloadResponse,
  SandboxFileUploadResponse,
  SandboxWorkerMessage,
} from './types';

export interface SandboxWorkerRuntimeOptions {
  maxFileBytes?: number;
  maxTotalBytes?: number;
  maxOutputBytes?: number;
  allowNetwork?: boolean;
  network?: BrowserSandboxOptions['network'];
  executor?: JavaScriptExecutor;
}

const DEFAULT_MAX_OUTPUT_BYTES = 1_000_000;

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function now(): number {
  return Date.now();
}

function createExecuteResponse(startedAt: number, output: string, exitCode: number | null, maxOutputBytes: number): SandboxExecuteResponse {
  const encoded = textEncoder.encode(output);
  if (encoded.byteLength <= maxOutputBytes) {
    return {
      output,
      exitCode,
      truncated: false,
      durationMs: now() - startedAt,
    };
  }

  return {
    output: textDecoder.decode(encoded.slice(0, maxOutputBytes)),
    exitCode,
    truncated: true,
    durationMs: now() - startedAt,
  };
}

function decodeBase64(content: string): Uint8Array {
  const decoded = atob(content);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function splitCommand(command: string): string[] {
  return command.trim().split(/\s+/g).filter(Boolean);
}

function getErrorMessage(error: unknown): string {
  /* c8 ignore next */
  return error instanceof Error ? error.message : String(error);
}

export class SandboxWorkerRuntime {
  private vfs: InMemoryVirtualFileSystem;
  private readonly executor: JavaScriptExecutor;
  private maxOutputBytes: number;
  private allowNetwork: boolean;
  private network: BrowserSandboxOptions['network'];

  constructor(options: SandboxWorkerRuntimeOptions = {}) {
    this.vfs = new InMemoryVirtualFileSystem({
      maxFileBytes: options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
      maxTotalBytes: options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES,
    });
    this.executor = options.executor ?? new QuickJsJavaScriptExecutor();
    this.maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    this.allowNetwork = options.allowNetwork ?? false;
    this.network = options.network;
  }

  async handleRequest(request: SandboxWorkerMessage): Promise<unknown> {
    switch (request.op) {
      case 'configure':
        this.configure(request.payload);
        return undefined;
      case 'execute':
        return this.execute(request.payload.command, request.payload.timeoutMs);
      case 'uploadFiles':
        return this.uploadFiles(request.payload.files);
      case 'downloadFiles':
        return this.downloadFiles(request.payload.paths);
      case 'reset':
        this.vfs.clear();
        return undefined;
      default:
        throw new Error(`Unsupported sandbox worker operation: ${(request as { op?: string }).op ?? 'unknown'}`);
    }
  }

  private configure(options: SandboxWorkerRuntimeOptions): void {
    this.vfs = new InMemoryVirtualFileSystem({
      maxFileBytes: options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
      maxTotalBytes: options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES,
    });
    this.maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    this.allowNetwork = options.allowNetwork ?? false;
    this.network = options.network;
  }

  uploadFiles(files: Array<[string, Uint8Array]>): SandboxFileUploadResponse[] {
    return files.map(([path, content]) => {
      try {
        return { path: this.vfs.writeFile(path, content), error: null };
      } catch (error) {
        return { path, error: getErrorMessage(error) };
      }
    });
  }

  downloadFiles(paths: string[]): SandboxFileDownloadResponse[] {
    return paths.map((path) => {
      try {
        const normalizedPath = normalizeSandboxPath(path);
        return { path: normalizedPath, content: this.vfs.readFile(normalizedPath), error: null };
      } catch (error) {
        return {
          path,
          content: null,
          error: getErrorMessage(error),
        };
      }
    });
  }

  async execute(command: string, timeoutMs: number): Promise<SandboxExecuteResponse> {
    const startedAt = now();
    const [operation, ...args] = splitCommand(command);

    if (!operation) {
      return createExecuteResponse(startedAt, 'Missing sandbox command.', 127, this.maxOutputBytes);
    }

    try {
      switch (operation) {
        case 'ls':
          return this.executeList(startedAt, args[0]);
        case 'cat':
          return this.executeCat(startedAt, args[0]);
        case 'write':
          return this.executeWrite(startedAt, args[0], args[1]);
        case 'rm':
          return this.executeRemove(startedAt, args[0]);
        case 'node':
        case 'run':
          return await this.executeJavaScript(startedAt, args[0], timeoutMs);
        default:
          return createExecuteResponse(startedAt, `Unknown command: ${operation}`, 127, this.maxOutputBytes);
      }
    } catch (error) {
      return createExecuteResponse(startedAt, getErrorMessage(error), 1, this.maxOutputBytes);
    }
  }

  private executeList(startedAt: number, path = '/'): SandboxExecuteResponse {
    const files = this.vfs.list(path);
    if (files.length === 0 && path !== '/') {
      return createExecuteResponse(startedAt, `File not found: ${normalizeSandboxPath(path)}`, 1, this.maxOutputBytes);
    }
    return createExecuteResponse(startedAt, files.join('\n'), 0, this.maxOutputBytes);
  }

  private executeCat(startedAt: number, path?: string): SandboxExecuteResponse {
    if (!path) {
      return createExecuteResponse(startedAt, 'cat requires a path.', 1, this.maxOutputBytes);
    }
    if (!this.vfs.hasFile(path)) {
      return createExecuteResponse(startedAt, `File not found: ${normalizeSandboxPath(path)}`, 1, this.maxOutputBytes);
    }
    return createExecuteResponse(startedAt, textDecoder.decode(this.vfs.readFile(path)), 0, this.maxOutputBytes);
  }

  private executeWrite(startedAt: number, path?: string, base64Content?: string): SandboxExecuteResponse {
    if (!path || !base64Content) {
      return createExecuteResponse(startedAt, 'write requires a path and base64 content.', 1, this.maxOutputBytes);
    }
    const normalizedPath = this.vfs.writeFile(path, decodeBase64(base64Content));
    return createExecuteResponse(startedAt, normalizedPath, 0, this.maxOutputBytes);
  }

  private executeRemove(startedAt: number, path?: string): SandboxExecuteResponse {
    if (!path) {
      return createExecuteResponse(startedAt, 'rm requires a path.', 1, this.maxOutputBytes);
    }
    if (!this.vfs.delete(path)) {
      return createExecuteResponse(startedAt, `File not found: ${normalizeSandboxPath(path)}`, 1, this.maxOutputBytes);
    }
    return createExecuteResponse(startedAt, normalizeSandboxPath(path), 0, this.maxOutputBytes);
  }

  private async executeJavaScript(startedAt: number, path: string | undefined, timeoutMs: number): Promise<SandboxExecuteResponse> {
    if (!path) {
      return createExecuteResponse(startedAt, 'node requires a JavaScript file path.', 1, this.maxOutputBytes);
    }
    if (!this.vfs.hasFile(path)) {
      return createExecuteResponse(startedAt, `File not found: ${normalizeSandboxPath(path)}`, 1, this.maxOutputBytes);
    }

    const normalizedPath = normalizeSandboxPath(path);
    const result = await this.executor.execute(textDecoder.decode(this.vfs.readFile(normalizedPath)), {
      filename: normalizedPath,
      timeoutMs,
      allowNetwork: this.allowNetwork,
      network: this.network,
    });
    return createExecuteResponse(startedAt, result.output, result.exitCode, this.maxOutputBytes);
  }
}
