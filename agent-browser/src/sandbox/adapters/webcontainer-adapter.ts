import type { FileSystemTree, WebContainerProcess } from '@webcontainer/api';
import type { ExecutionArtifact, RunRequest } from '../protocol';
import { resolveRunLimits } from '../protocol';
import type { AdapterExecutionContext, AdapterExecutionResult, ExecutionAdapter } from './base';

interface WebContainerLike {
  mount(tree: FileSystemTree): Promise<void>;
  spawn(command: string, args?: string[], options?: { cwd?: string; env?: Record<string, string | number | boolean>; output?: boolean }): Promise<WebContainerProcess>;
  fs: {
    readFile(path: string, encoding: 'utf-8' | 'utf8'): Promise<string>;
  };
  teardown(): void;
}

type WebContainerBoot = (options?: { coep?: 'require-corp' | 'credentialless' | 'none'; workdirName?: string; forwardPreviewErrors?: boolean | 'exceptions-only' }) => Promise<WebContainerLike>;

async function bootWebContainer(options?: Parameters<WebContainerBoot>[0]): Promise<WebContainerLike> {
  const module = await import('@webcontainer/api');
  return module.WebContainer.boot(options);
}

function normalizeRelativePath(path: string): string {
  return path.replace(/^\/+/, '');
}

function setTreeFile(tree: FileSystemTree, path: string, content: string): void {
  const parts = normalizeRelativePath(path).split('/').filter(Boolean);
  if (parts.length === 0) {
    return;
  }

  let cursor = tree;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const isLeaf = index === parts.length - 1;
    if (isLeaf) {
      cursor[part] = { file: { contents: content } };
      return;
    }

    const existing = cursor[part];
    if (!existing || !('directory' in existing)) {
      cursor[part] = { directory: {} };
    }
    cursor = (cursor[part] as { directory: FileSystemTree }).directory;
  }
}

function buildFileTree(request: RunRequest): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const file of request.files) {
    setTreeFile(tree, file.path, file.content);
  }
  return tree;
}

async function readArtifacts(instance: WebContainerLike, request: RunRequest): Promise<ExecutionArtifact[]> {
  const artifacts: ExecutionArtifact[] = [];
  for (const path of request.capturePaths ?? []) {
    try {
      const content = await instance.fs.readFile(normalizeRelativePath(path), 'utf-8');
      artifacts.push({ path, content, encoding: 'utf-8' });
    } catch {
      // Missing artifacts are ignored; the transcript still reflects the run outcome.
    }
  }
  return artifacts;
}

async function consumeReadableStream(
  stream: ReadableStream<string> | undefined,
  onChunk: (chunk: string) => void,
): Promise<number> {
  if (!stream) {
    return 0;
  }

  const reader = stream.getReader();
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      totalBytes += value.length;
      onChunk(value);
    }
  } finally {
    reader.releaseLock();
  }
  return totalBytes;
}

export class WebContainerExecutionAdapter implements ExecutionAdapter {
  readonly kind = 'webcontainer' as const;
  readonly supportsAbort = true;

  private instance: WebContainerLike | null = null;
  private readonly boot: WebContainerBoot;

  constructor(options: { boot?: WebContainerBoot } = {}) {
    this.boot = options.boot ?? bootWebContainer;
  }

  canHandle(request: RunRequest): boolean {
    return Boolean(request.command.command.trim());
  }

  async execute(request: RunRequest, context: AdapterExecutionContext): Promise<AdapterExecutionResult> {
    const limits = resolveRunLimits(request.limits);
    if (this.instance) {
      this.instance.teardown();
      this.instance = null;
    }

    this.instance = await this.boot({
      coep: 'require-corp',
      workdirName: 'sandbox',
      forwardPreviewErrors: 'exceptions-only',
    });

    await this.instance.mount(buildFileTree(request));

    const spawned = await this.instance.spawn(
      request.command.command,
      request.command.args ?? [],
      {
        cwd: normalizeRelativePath(request.command.cwd ?? '.'),
        env: request.metadata,
        output: true,
      },
    );

    let stdoutBytes = 0;
    let stderrBytes = 0;
    let limitExceeded: 'stdout' | 'stderr' | null = null;
    const extendedProcess = spawned as WebContainerProcess & {
      stdout?: ReadableStream<string>;
      stderr?: ReadableStream<string>;
    };

    const abortHandler = () => {
      spawned.kill();
    };
    context.signal.addEventListener('abort', abortHandler, { once: true });

    const stdoutPromise = consumeReadableStream(extendedProcess.stdout ?? spawned.output, (chunk) => {
      stdoutBytes += chunk.length;
      context.emit({ type: 'stdout', chunk, bytes: chunk.length });
      if (stdoutBytes > limits.maxStdoutBytes) {
        limitExceeded = 'stdout';
        spawned.kill();
      }
    });
    const stderrPromise = consumeReadableStream(extendedProcess.stderr, (chunk) => {
      stderrBytes += chunk.length;
      context.emit({ type: 'stderr', chunk, bytes: chunk.length });
      if (stderrBytes > limits.maxStderrBytes) {
        limitExceeded = 'stderr';
        spawned.kill();
      }
    });

    const exitCode = await spawned.exit;
    await Promise.all([stdoutPromise, stderrPromise]);
    context.signal.removeEventListener('abort', abortHandler);

    if (context.signal.aborted) {
      return {
        exitCode: 130,
        status: 'aborted',
        reason: 'Run aborted by host or policy.',
        metrics: {
          wallClockMs: 0,
          stdoutBytes,
          stderrBytes,
          logBytes: 0,
          eventCount: 0,
          artifactBytes: 0,
        },
      };
    }

    if (limitExceeded) {
      return {
        exitCode: 1,
        status: 'limit_exceeded',
        reason: `${limitExceeded} output limit exceeded.`,
        metrics: {
          wallClockMs: 0,
          stdoutBytes,
          stderrBytes,
          logBytes: 0,
          eventCount: 0,
          artifactBytes: 0,
        },
      };
    }

    const artifacts = exitCode === 0 ? await readArtifacts(this.instance, request) : [];
    return {
      exitCode,
      status: exitCode === 0 ? 'succeeded' : 'failed',
      artifacts,
      metrics: {
        wallClockMs: 0,
        stdoutBytes,
        stderrBytes,
        logBytes: 0,
        eventCount: 0,
        artifactBytes: artifacts.reduce((total, artifact) => total + artifact.content.length, 0),
      },
    };
  }

  async dispose(): Promise<void> {
    if (!this.instance) {
      return;
    }
    this.instance.teardown();
    this.instance = null;
  }
}
