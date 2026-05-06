import type { BootOptions, FileSystemTree, WebContainerProcess } from '@webcontainer/api';
import {
  AgentSandbox,
  type SandboxComputeCapability,
  type SandboxExecuteResponse,
  type SandboxFileDownloadResponse,
  type SandboxFileSystemCapability,
  type SandboxFileUploadResponse,
  type SandboxIsolationCapability,
} from './types';
import { SandboxClosedError, SandboxExecutionError, SandboxPathError, SandboxTimeoutError } from './errors';
import { normalizeSandboxPath } from './vfs';
import { DEFAULT_ALLOW_NETWORK, DEFAULT_MAX_OUTPUT_BYTES, DEFAULT_TIMEOUT_MS } from './BrowserSandboxProvider';

interface WebContainerFileSystem {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<unknown>;
  readFile(path: string, encoding?: null): Promise<Uint8Array>;
  writeFile(path: string, data: string | Uint8Array, options?: unknown): Promise<void>;
  rm(path: string, options?: { force?: boolean; recursive?: boolean }): Promise<void>;
  readdir(path: string, options?: unknown): Promise<string[]>;
}

interface WebContainerLike {
  mount(tree: FileSystemTree): Promise<void>;
  spawn(command: string, args?: string[], options?: { cwd?: string; env?: Record<string, string>; output?: boolean }): Promise<WebContainerProcess>;
  fs: WebContainerFileSystem;
  teardown(): void;
}

type WebContainerBoot = (options?: BootOptions) => Promise<WebContainerLike>;

export interface WebContainerBrowserSandboxOptions {
  id?: string;
  boot?: WebContainerBoot;
  defaultTimeoutMs?: number;
  maxOutputBytes?: number;
  allowNetwork?: boolean;
  allowedCommands?: string[];
}

const DEFAULT_ALLOWED_COMMANDS = ['node', 'npm', 'npx', 'pnpm', 'yarn', 'tsc', 'vitest'];
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
let nextWebContainerSandboxId = 1;

/* c8 ignore start */
async function bootDefaultWebContainer(options?: BootOptions): Promise<WebContainerLike> {
  const module = await import('@webcontainer/api');
  return module.WebContainer.boot(options);
}
/* c8 ignore stop */

function createWebContainerSandboxId(): string {
  const id = nextWebContainerSandboxId;
  nextWebContainerSandboxId += 1;
  return `webcontainer-sandbox-${id}`;
}

function toContainerPath(path: string): string {
  const normalized = normalizeSandboxPath(path);
  if (normalized === '/') {
    return '.';
  }
  return normalized.slice(1);
}

function parentPath(path: string): string {
  const normalized = normalizeSandboxPath(path);
  const parent = normalized.slice(0, normalized.lastIndexOf('/'));
  return parent ? parent.slice(1) : '.';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function decodeBase64(content: string): Uint8Array {
  const decoded = atob(content);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function hasShellMetacharacter(command: string): boolean {
  return /[;&|<>`$]/.test(command) || command.includes('\n') || command.includes('\r');
}

function tokenizeCommand(command: string): string[] {
  if (hasShellMetacharacter(command)) {
    throw new SandboxExecutionError('Unsupported shell syntax in sandbox command.');
  }

  const tokens: string[] = [];
  let token = '';
  let quote: '"' | "'" | null = null;
  for (const character of command.trim()) {
    if (quote) {
      if (character === quote) {
        quote = null;
      } else {
        token += character;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (token) {
        tokens.push(token);
        token = '';
      }
      continue;
    }
    token += character;
  }
  if (quote) {
    throw new SandboxExecutionError('Unterminated quote in sandbox command.');
  }
  if (token) {
    tokens.push(token);
  }
  return tokens;
}

function createResponse(startedAt: number, output: string, exitCode: number | null, maxOutputBytes: number): SandboxExecuteResponse {
  const encoded = textEncoder.encode(output);
  if (encoded.byteLength <= maxOutputBytes) {
    return {
      output,
      exitCode,
      truncated: false,
      durationMs: Date.now() - startedAt,
    };
  }
  return {
    output: textDecoder.decode(encoded.slice(0, maxOutputBytes)),
    exitCode,
    truncated: true,
    durationMs: Date.now() - startedAt,
  };
}

async function consumeStream(stream: ReadableStream<string> | undefined, append: (chunk: string) => void): Promise<void> {
  if (!stream) {
    return;
  }
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      if (value) {
        append(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export class WebContainerBrowserSandboxProvider extends AgentSandbox {
  readonly isolation: SandboxIsolationCapability = {
    kind: 'remote',
    boundary: 'webcontainer',
  };

  readonly fileSystem: SandboxFileSystemCapability = {
    kind: 'virtual',
    scoped: true,
  };

  readonly compute: SandboxComputeCapability;

  private readonly boot: WebContainerBoot;
  private readonly defaultTimeoutMs: number;
  private readonly maxOutputBytes: number;
  private readonly allowedCommands: Set<string>;
  private instance: WebContainerLike | null = null;
  private closed = false;
  private readonly knownFiles = new Set<string>();

  constructor(options: WebContainerBrowserSandboxOptions = {}) {
    super(options.id ?? createWebContainerSandboxId());
    this.boot = options.boot ?? bootDefaultWebContainer;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    this.allowedCommands = new Set(options.allowedCommands ?? DEFAULT_ALLOWED_COMMANDS);
    this.compute = {
      kind: 'native',
      runtime: 'webcontainer-node',
      networkDefault: options.allowNetwork ?? DEFAULT_ALLOW_NETWORK ? 'allow' : 'deny',
    };
  }

  async execute(command: string, options: { timeoutMs?: number } = {}): Promise<SandboxExecuteResponse> {
    this.assertOpen();
    const startedAt = Date.now();
    let tokens: string[];
    try {
      tokens = tokenizeCommand(command);
    } catch (error) {
      return createResponse(startedAt, getErrorMessage(error), 127, this.maxOutputBytes);
    }
    const [operation, ...args] = tokens;
    if (!operation) {
      return createResponse(startedAt, 'Missing sandbox command.', 127, this.maxOutputBytes);
    }

    switch (operation) {
      case 'ls':
        return this.executeList(startedAt, args[0]);
      case 'cat':
        return this.executeCat(startedAt, args[0]);
      case 'write':
        return this.executeWrite(startedAt, args[0], args[1]);
      case 'rm':
        return this.executeRemove(startedAt, args[0]);
      default:
        return this.executeProcess(startedAt, operation, args, options.timeoutMs ?? this.defaultTimeoutMs);
    }
  }

  async uploadFiles(files: Array<[path: string, content: Uint8Array]>): Promise<SandboxFileUploadResponse[]> {
    this.assertOpen();
    const instance = await this.ensureInstance();
    const responses: SandboxFileUploadResponse[] = [];
    for (const [path, content] of files) {
      try {
        const normalizedPath = normalizeSandboxPath(path);
        if (normalizedPath === '/') {
          throw new SandboxPathError('Sandbox file paths must include a file name.');
        }
        await instance.fs.mkdir(parentPath(normalizedPath), { recursive: true });
        await instance.fs.writeFile(toContainerPath(normalizedPath), new Uint8Array(content));
        this.knownFiles.add(normalizedPath);
        responses.push({ path: normalizedPath, error: null });
      } catch (error) {
        responses.push({ path, error: getErrorMessage(error) });
      }
    }
    return responses;
  }

  async downloadFiles(paths: string[]): Promise<SandboxFileDownloadResponse[]> {
    this.assertOpen();
    const instance = await this.ensureInstance();
    const responses: SandboxFileDownloadResponse[] = [];
    for (const path of paths) {
      try {
        const normalizedPath = normalizeSandboxPath(path);
        const content = await instance.fs.readFile(toContainerPath(normalizedPath));
        responses.push({ path: normalizedPath, content: new Uint8Array(content), error: null });
      } catch (error) {
        responses.push({ path, content: null, error: getErrorMessage(error) });
      }
    }
    return responses;
  }

  async reset(): Promise<void> {
    this.assertOpen();
    this.teardownInstance();
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.teardownInstance();
  }

  private async executeList(startedAt: number, path = '/'): Promise<SandboxExecuteResponse> {
    const normalizedPath = normalizeSandboxPath(path);
    const files = [...this.knownFiles].filter((file) => normalizedPath === '/' || file === normalizedPath || file.startsWith(`${normalizedPath}/`)).sort();
    if (files.length === 0 && normalizedPath !== '/') {
      return createResponse(startedAt, `File not found: ${normalizedPath}`, 1, this.maxOutputBytes);
    }
    return createResponse(startedAt, files.join('\n'), 0, this.maxOutputBytes);
  }

  private async executeCat(startedAt: number, path: string | undefined): Promise<SandboxExecuteResponse> {
    if (!path) {
      return createResponse(startedAt, 'cat requires a path.', 1, this.maxOutputBytes);
    }
    const [download] = await this.downloadFiles([path]);
    if (!download.content) {
      return createResponse(startedAt, download.error!, 1, this.maxOutputBytes);
    }
    return createResponse(startedAt, textDecoder.decode(download.content), 0, this.maxOutputBytes);
  }

  private async executeWrite(startedAt: number, path: string | undefined, base64Content: string | undefined): Promise<SandboxExecuteResponse> {
    if (!path || !base64Content) {
      return createResponse(startedAt, 'write requires a path and base64 content.', 1, this.maxOutputBytes);
    }
    const [upload] = await this.uploadFiles([[path, decodeBase64(base64Content)]]);
    return createResponse(startedAt, upload.error ?? upload.path, upload.error ? 1 : 0, this.maxOutputBytes);
  }

  private async executeRemove(startedAt: number, path: string | undefined): Promise<SandboxExecuteResponse> {
    if (!path) {
      return createResponse(startedAt, 'rm requires a path.', 1, this.maxOutputBytes);
    }
    try {
      const normalizedPath = normalizeSandboxPath(path);
      const instance = await this.ensureInstance();
      await instance.fs.rm(toContainerPath(normalizedPath), { force: false, recursive: false });
      this.knownFiles.delete(normalizedPath);
      return createResponse(startedAt, normalizedPath, 0, this.maxOutputBytes);
    } catch (error) {
      return createResponse(startedAt, getErrorMessage(error), 1, this.maxOutputBytes);
    }
  }

  private async executeProcess(startedAt: number, command: string, args: string[], timeoutMs: number): Promise<SandboxExecuteResponse> {
    if (!this.allowedCommands.has(command)) {
      return createResponse(startedAt, `Unknown command: ${command}`, 127, this.maxOutputBytes);
    }

    const instance = await this.ensureInstance();
    let process: WebContainerProcess | null = null;
    let output = '';
    let truncated = false;
    const append = (chunk: string) => {
      if (truncated) {
        return;
      }
      const combined = `${output}${chunk}`;
      const encoded = textEncoder.encode(combined);
      if (encoded.byteLength <= this.maxOutputBytes) {
        output = combined;
        return;
      }
      output = textDecoder.decode(encoded.slice(0, this.maxOutputBytes));
      truncated = true;
      process?.kill();
    };

    const runPromise = (async () => {
      process = await instance.spawn(command, args, { cwd: '/', env: {}, output: true });
      const extendedProcess = process as WebContainerProcess & {
        stdout?: ReadableStream<string>;
        stderr?: ReadableStream<string>;
      };
      const stdoutPromise = consumeStream(extendedProcess.stdout ?? process.output, append);
      const stderrPromise = consumeStream(extendedProcess.stderr, append);
      const exitCode = await process.exit;
      await Promise.all([stdoutPromise, stderrPromise]);
      const response = createResponse(startedAt, output, truncated ? 1 : exitCode, this.maxOutputBytes);
      return truncated ? { ...response, truncated: true } : response;
    })();

    let rejectTimeout!: (error: Error) => void;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      rejectTimeout = reject;
    });
    const timeoutHandle = setTimeout(() => {
      process?.kill();
      this.teardownInstance();
      rejectTimeout(new SandboxTimeoutError(`Sandbox command timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    try {
      return await Promise.race([runPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle);
      void runPromise.catch(() => undefined);
    }
  }

  private async ensureInstance(): Promise<WebContainerLike> {
    this.assertOpen();
    if (!this.instance) {
      this.instance = await this.boot({
        coep: 'require-corp',
        workdirName: 'agent-sandbox',
        forwardPreviewErrors: 'exceptions-only',
      });
      await this.instance.mount({});
    }
    return this.instance;
  }

  private teardownInstance(): void {
    this.instance?.teardown();
    this.instance = null;
    this.knownFiles.clear();
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new SandboxClosedError();
    }
  }
}
