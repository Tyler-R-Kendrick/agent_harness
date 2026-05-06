import { BrowserSandboxProvider, WebContainerBrowserSandboxProvider, type SkillSandbox } from '@agent-harness/agent-sandbox';
import { getSandboxFeatureFlags, type SandboxFeatureFlags } from '../features/flags';
import { SandboxBootstrapError, type IframeSandboxSessionOptions } from './iframe-session';
import { persistArtifactsToVirtualFileSystem, type WritableVirtualFileSystem } from './persist';
import type { ExecutionArtifact, RunMetricsMessage, RunRequest, RunTerminalStatus, RunTestResultMessage } from './protocol';

export type TranscriptEvent =
  | { type: 'log'; payload: { level: string; chunk: string; bytes: number }; timestamp: number }
  | { type: 'stdout'; payload: { chunk: string; bytes: number }; timestamp: number }
  | { type: 'stderr'; payload: { chunk: string; bytes: number }; timestamp: number }
  | { type: 'test_result'; payload: RunTestResultMessage['payload']; timestamp: number }
  | { type: 'metrics'; payload: RunMetricsMessage['payload']; timestamp: number }
  | { type: 'error'; payload: { code: string; message: string; fatal: boolean; phase?: string; details?: string }; timestamp: number };

export interface TranscriptState {
  sessionId: string;
  runId: string;
  adapter: string;
  startedAt: number;
  endedAt: number;
  events: TranscriptEvent[];
}

export interface SandboxRunResult {
  sessionId: string;
  runId: string;
  adapter: string;
  status: RunTerminalStatus;
  exitCode: number;
  reason?: string;
  artifacts: ExecutionArtifact[];
  persistedArtifactPaths: string[];
  metrics?: RunMetricsMessage['payload'];
  transcript: TranscriptState;
  usedLegacyFallback: boolean;
}

export interface SandboxSession {
  readonly sessionId: string;
  run(request: RunRequest): Promise<SandboxRunResult>;
  abort(reason?: string): Promise<void>;
  dispose(): Promise<void>;
}

export interface SandboxedExecutionService {
  createSession(): Promise<SandboxSession>;
}

export interface LegacyExecutionSession {
  run(request: RunRequest): Promise<SandboxRunResult>;
  abort?(reason?: string): Promise<void>;
  dispose?(): Promise<void>;
}

export interface SandboxedExecutionServiceOptions {
  flags?: SandboxFeatureFlags;
  createAgentSandbox?: (runtime: AgentSandboxRuntime) => SkillSandbox;
  createIframeSession?: (options: IframeSandboxSessionOptions) => SandboxSession;
  createLegacySession?: () => Promise<LegacyExecutionSession> | LegacyExecutionSession;
  persistenceTarget?: WritableVirtualFileSystem;
}

type AgentSandboxRuntime = 'quickjs' | 'webcontainer';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function commandToSandboxCommand(command: RunRequest['command']): string {
  return [command.command, ...(command.args ?? [])].join(' ').trim();
}

function createTranscript(sessionId: string, runId: string, adapter: string): TranscriptState {
  const timestamp = Date.now();
  return {
    sessionId,
    runId,
    adapter,
    startedAt: timestamp,
    endedAt: timestamp,
    events: [],
  };
}

function createAgentSandboxRunId(): string {
  return `agent-sandbox-run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function requestNeedsWebContainer(request: RunRequest): boolean {
  const command = request.command.command.trim();
  if (['npm', 'npx', 'pnpm', 'yarn', 'tsc', 'vitest'].includes(command)) {
    return true;
  }
  if ([command, ...(request.command.args ?? [])].some((token) => /\.(ts|tsx|mts|cts)$/.test(token))) {
    return true;
  }
  return request.files.some((file) => {
    const path = file.path.toLowerCase();
    return path.endsWith('.ts')
      || path.endsWith('.tsx')
      || path.endsWith('.mts')
      || path.endsWith('.cts')
      || path.endsWith('package.json')
      || path.endsWith('tsconfig.json');
  });
}

class LegacySandboxSession implements SandboxSession {
  readonly sessionId = 'legacy-session';

  constructor(private readonly inner: LegacyExecutionSession) {}

  async run(request: RunRequest): Promise<SandboxRunResult> {
    const result = await this.inner.run(request);
    return { ...result, usedLegacyFallback: true };
  }

  async abort(reason?: string): Promise<void> {
    await this.inner.abort?.(reason);
  }

  async dispose(): Promise<void> {
    await this.inner.dispose?.();
  }
}

class PersistentSandboxSession implements SandboxSession {
  readonly sessionId: string;

  constructor(
    private readonly inner: SandboxSession,
    private readonly persistenceTarget?: WritableVirtualFileSystem,
  ) {
    this.sessionId = inner.sessionId;
  }

  async run(request: RunRequest): Promise<SandboxRunResult> {
    const result = await this.inner.run(request);
    if (this.persistenceTarget && request.persist && request.persist.mode === 'just-bash' && result.status === 'succeeded' && result.artifacts.length > 0) {
      result.persistedArtifactPaths = await persistArtifactsToVirtualFileSystem(this.persistenceTarget, result.artifacts, request.persist);
    }
    return result;
  }

  async abort(reason?: string): Promise<void> {
    await this.inner.abort(reason);
  }

  async dispose(): Promise<void> {
    await this.inner.dispose();
  }
}

class AgentSandboxSession implements SandboxSession {
  readonly sessionId: string;
  private readonly sandboxes = new Map<AgentSandboxRuntime, SkillSandbox>();

  constructor(
    private readonly options: {
      createSandbox: (runtime: AgentSandboxRuntime) => SkillSandbox;
      webContainerAvailable: boolean;
    },
  ) {
    this.sessionId = createAgentSandboxRunId().replace('agent-sandbox-run', 'agent-sandbox-session');
  }

  async run(request: RunRequest): Promise<SandboxRunResult> {
    const sandbox = this.getSandbox(this.selectRuntime(request));
    const runId = createAgentSandboxRunId();
    const transcript = createTranscript(this.sessionId, runId, 'agent-sandbox');
    const uploaded = await sandbox.uploadFiles(
      request.files.map((file) => [file.path, textEncoder.encode(file.content)] as [string, Uint8Array]),
    );
    const failedUpload = uploaded.find((file) => file.error);
    if (failedUpload) {
      transcript.endedAt = Date.now();
      transcript.events.push({
        type: 'error',
        payload: {
          code: 'upload_failed',
          message: failedUpload.error ?? 'Sandbox file upload failed.',
          fatal: true,
          phase: 'upload',
        },
        timestamp: transcript.endedAt,
      });
      return {
        sessionId: this.sessionId,
        runId,
        adapter: 'agent-sandbox',
        status: 'failed',
        exitCode: 1,
        reason: failedUpload.error ?? 'Sandbox file upload failed.',
        artifacts: [],
        persistedArtifactPaths: [],
        transcript,
        usedLegacyFallback: false,
      };
    }

    const execution = await sandbox.execute(commandToSandboxCommand(request.command), { timeoutMs: request.timeoutMs });
    const completedAt = Date.now();
    transcript.endedAt = completedAt;
    if (execution.output) {
      transcript.events.push({
        type: execution.exitCode === 0 ? 'stdout' : 'stderr',
        payload: { chunk: execution.output, bytes: textEncoder.encode(execution.output).byteLength },
        timestamp: completedAt,
      });
    }

    const downloads = request.capturePaths?.length ? await sandbox.downloadFiles(request.capturePaths) : [];
    const artifacts: ExecutionArtifact[] = downloads
      .filter((file): file is typeof file & { content: Uint8Array } => Boolean(file.content) && !file.error)
      .map((file) => ({
        path: file.path,
        content: textDecoder.decode(file.content),
        encoding: 'utf-8',
      }));
    const artifactBytes = artifacts.reduce((total, artifact) => total + textEncoder.encode(artifact.content).byteLength, 0);
    transcript.events.push({
      type: 'metrics',
      payload: {
        wallClockMs: execution.durationMs,
        stdoutBytes: execution.exitCode === 0 ? textEncoder.encode(execution.output).byteLength : 0,
        stderrBytes: execution.exitCode === 0 ? 0 : textEncoder.encode(execution.output).byteLength,
        logBytes: 0,
        eventCount: execution.output ? 1 : 0,
        artifactBytes,
      },
      timestamp: completedAt,
    });

    const exitCode = execution.exitCode ?? 1;
    const status: RunTerminalStatus = exitCode === 0 ? 'succeeded' : 'failed';
    return {
      sessionId: this.sessionId,
      runId,
      adapter: 'agent-sandbox',
      status,
      exitCode,
      reason: status === 'failed' ? execution.output || 'Sandbox command failed.' : undefined,
      artifacts: status === 'succeeded' ? artifacts : [],
      persistedArtifactPaths: [],
      metrics: {
        wallClockMs: execution.durationMs,
        stdoutBytes: execution.exitCode === 0 ? textEncoder.encode(execution.output).byteLength : 0,
        stderrBytes: execution.exitCode === 0 ? 0 : textEncoder.encode(execution.output).byteLength,
        logBytes: 0,
        eventCount: transcript.events.length,
        artifactBytes,
      },
      transcript,
      usedLegacyFallback: false,
    };
  }

  async abort(): Promise<void> {
    await this.closeSandboxes();
  }

  async dispose(): Promise<void> {
    await this.closeSandboxes();
  }

  private selectRuntime(request: RunRequest): AgentSandboxRuntime {
    if (this.options.webContainerAvailable && requestNeedsWebContainer(request)) {
      return 'webcontainer';
    }
    return 'quickjs';
  }

  private getSandbox(runtime: AgentSandboxRuntime): SkillSandbox {
    const existing = this.sandboxes.get(runtime);
    if (existing) {
      return existing;
    }
    const sandbox = this.options.createSandbox(runtime);
    this.sandboxes.set(runtime, sandbox);
    return sandbox;
  }

  private async closeSandboxes(): Promise<void> {
    const sandboxes = [...this.sandboxes.values()];
    this.sandboxes.clear();
    await Promise.all(sandboxes.map((sandbox) => sandbox.close()));
  }
}

export function createSandboxExecutionService(options: SandboxedExecutionServiceOptions = {}): SandboxedExecutionService {
  const flags = options.flags ?? getSandboxFeatureFlags();
  const createSecureSession = (): SandboxSession => {
    if (options.createIframeSession) {
      return options.createIframeSession({ flags });
    }
    return new AgentSandboxSession({
      webContainerAvailable: !flags.disableWebContainerAdapter && flags.allowSameOriginForWebContainer,
      createSandbox(runtime) {
        if (options.createAgentSandbox) {
          return options.createAgentSandbox(runtime);
        }
        return runtime === 'webcontainer'
          ? new WebContainerBrowserSandboxProvider()
          : new BrowserSandboxProvider();
      },
    });
  };

  return {
    async createSession(): Promise<SandboxSession> {
      if (!flags.secureBrowserSandboxExec) {
        if (!options.createLegacySession) {
          throw new Error('Secure sandbox execution is disabled and no legacy execution path is configured.');
        }
        return new LegacySandboxSession(await options.createLegacySession());
      }

      const sandboxSession = createSecureSession();
      const wrapped = new PersistentSandboxSession(sandboxSession, options.persistenceTarget);
      if (!options.createLegacySession) {
        return wrapped;
      }

      return {
        sessionId: wrapped.sessionId,
        async run(request: RunRequest): Promise<SandboxRunResult> {
          try {
            return await wrapped.run(request);
          } catch (error) {
            if (!(error instanceof SandboxBootstrapError)) {
              throw error;
            }
            const legacySession = await options.createLegacySession?.();
            if (!legacySession) {
              throw error;
            }
            return new LegacySandboxSession(legacySession).run(request);
          }
        },
        abort(reason?: string) {
          return wrapped.abort(reason);
        },
        dispose() {
          return wrapped.dispose();
        },
      };
    },
  };
}
