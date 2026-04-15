import { getSandboxFeatureFlags, type SandboxFeatureFlags } from '../features/flags';
import { IframeSandboxSession, SandboxBootstrapError, type IframeSandboxSessionOptions } from './iframe-session';
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
  createIframeSession?: (options: IframeSandboxSessionOptions) => SandboxSession;
  createLegacySession?: () => Promise<LegacyExecutionSession> | LegacyExecutionSession;
  persistenceTarget?: WritableVirtualFileSystem;
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

export function createSandboxExecutionService(options: SandboxedExecutionServiceOptions = {}): SandboxedExecutionService {
  const flags = options.flags ?? getSandboxFeatureFlags();
  const createIframeSession = options.createIframeSession ?? ((sessionOptions) => new IframeSandboxSession(sessionOptions));

  return {
    async createSession(): Promise<SandboxSession> {
      if (!flags.secureBrowserSandboxExec || flags.disableWebContainerAdapter) {
        if (!options.createLegacySession) {
          throw new Error('Secure sandbox execution is disabled and no legacy execution path is configured.');
        }
        return new LegacySandboxSession(await options.createLegacySession());
      }

      const sandboxSession = createIframeSession({ flags });
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
