import { getSandboxFeatureFlags, type SandboxFeatureFlags } from '../features/flags';
import { createPrefixedId } from '../utils/uniqueId';
import runnerTemplate from './runner.html?raw';
import {
  createSandboxMessage,
  DEFAULT_MAX_MESSAGE_BYTES,
  SANDBOX_CONTROL_RUN_ID,
  SANDBOX_PROTOCOL_VERSION,
  validateSandboxMessage,
  type RunRequest,
  type RunnerToHostMessage,
} from './protocol';
import type { RunnerBootConfig } from './runner';
import type { SandboxRunResult, SandboxSession, TranscriptEvent, TranscriptState } from './service';

const runnerScriptUrl = new URL('./runner.ts', import.meta.url).toString();
const runnerScriptOrigin = new URL(runnerScriptUrl).origin;

export class SandboxBootstrapError extends Error {
  readonly canFallback = true;
}

export interface IframeSandboxSessionOptions {
  document?: Document;
  window?: Window;
  flags?: SandboxFeatureFlags;
  preferredAdapter?: 'mock' | 'webcontainer';
  maxMessageBytes?: number;
  destroyOnCompletion?: boolean;
  idFactory?: (prefix: string) => string;
}

function createTranscriptState(sessionId: string, runId: string, adapter: string): TranscriptState {
  return {
    sessionId,
    runId,
    adapter,
    startedAt: Date.now(),
    endedAt: Date.now(),
    events: [],
  };
}

function buildRunnerCsp(flags: SandboxFeatureFlags, parentFrameOrigin: string): string {
  const scriptSrc = [`'unsafe-inline'`, runnerScriptOrigin].join(' ');
  const connectSrc = flags.allowSameOriginForWebContainer
    ? "'none' https://*.stackblitz.com https://*.stackblitz.io https://*.webcontainer.io wss://*.stackblitz.com wss://*.stackblitz.io wss://*.webcontainer.io"
    : "'none'";
  return [
    "default-src 'none'",
    `script-src ${scriptSrc}`,
    "style-src 'unsafe-inline'",
    `connect-src ${connectSrc}`,
    "img-src 'none'",
    "worker-src blob:",
    "base-uri 'none'",
    "form-action 'none'",
    `frame-ancestors ${parentFrameOrigin}`,
  ].join('; ');
}

function buildRunnerDocument(config: RunnerBootConfig, flags: SandboxFeatureFlags): string {
  const bootstrap = flags.allowSameOriginForWebContainer
    ? 'import(window.__SANDBOX_RUNNER_SCRIPT__);'
    : buildInlineMockRunnerBootstrap();
  return runnerTemplate
    .replace('__SANDBOX_CSP__', buildRunnerCsp(flags, window.location.origin))
    .replace('__SANDBOX_RUNNER_CONFIG_JSON__', JSON.stringify(config))
    .replace('__SANDBOX_RUNNER_BOOTSTRAP__', bootstrap)
    .replace('__SANDBOX_RUNNER_SCRIPT_URL__', runnerScriptUrl);
}

function buildInlineMockRunnerBootstrap(): string {
  return `
    const cfg = window.__SANDBOX_RUNNER_CONFIG__;
    const protocolVersion = ${JSON.stringify(SANDBOX_PROTOCOL_VERSION)};
    let activeRun = null;

    const post = (type, runId, payload) => {
      window.parent.postMessage({
        protocolVersion,
        sessionId: cfg.sessionId,
        runId,
        timestamp: Date.now(),
        type,
        payload,
      }, cfg.parentOrigin === 'null' ? '*' : cfg.parentOrigin);
    };

    const runControlId = ${JSON.stringify(SANDBOX_CONTROL_RUN_ID)};
    post('runner_ready', runControlId, {
      adapter: 'mock',
      supportsAbort: true,
      networkPolicy: 'deny',
    });

    const buildArtifacts = (request) => (request.capturePaths ?? []).map((path) => ({
      path,
      content: (request.files ?? []).find((file) => file.path === path)?.content ?? 'generated:' + path,
      encoding: 'utf-8',
    }));

    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || data.protocolVersion !== protocolVersion || data.sessionId !== cfg.sessionId) {
        return;
      }

      if (data.type === 'run_abort' && activeRun && data.runId === activeRun.runId) {
        post('run_done', activeRun.runId, {
          exitCode: 130,
          status: 'aborted',
          reason: data.payload?.reason ?? 'Run aborted by host.',
        });
        activeRun = null;
        return;
      }

      if (data.type !== 'run_request') {
        return;
      }

      if (activeRun) {
        post('run_error', data.runId, {
          code: 'run_already_active',
          message: 'Runner already has an active run.',
          fatal: true,
          phase: 'dispatch',
        });
        return;
      }

      const request = data.payload?.request;
      if (!request?.command?.command) {
        post('run_error', data.runId, {
          code: 'invalid_request',
          message: 'Run request is missing a command.',
          fatal: true,
          phase: 'dispatch',
        });
        return;
      }

      activeRun = { runId: data.runId };
      post('run_ack', data.runId, { acceptedAt: Date.now() });

      queueMicrotask(() => {
        if (!activeRun || activeRun.runId !== data.runId) {
          return;
        }

        const commandName = request.command.command;
        const args = request.command.args ?? [];
        const commandText = [commandName, ...args].join(' ').trim();
        const logChunk = 'mock adapter executing ' + commandName;
        const stdoutChunk = 'executed ' + commandText;

        post('run_log', data.runId, { level: 'info', chunk: logChunk, bytes: logChunk.length });
        post('run_stdout', data.runId, { chunk: stdoutChunk, bytes: stdoutChunk.length });

        if (commandName.includes('test')) {
          post('run_test_result', data.runId, {
            suite: 'mock-suite',
            name: 'mock test',
            status: 'passed',
            durationMs: 4,
            details: 'mock adapter deterministic test result',
          });
        }

        if (commandName.includes('fail')) {
          const stderrChunk = 'mock adapter simulated failure';
          post('run_stderr', data.runId, { chunk: stderrChunk, bytes: stderrChunk.length });
          post('run_metrics', data.runId, {
            wallClockMs: 5,
            stdoutBytes: stdoutChunk.length,
            stderrBytes: stderrChunk.length,
            logBytes: logChunk.length,
            eventCount: commandName.includes('test') ? 4 : 3,
            artifactBytes: 0,
          });
          post('run_done', data.runId, {
            exitCode: 1,
            status: 'failed',
            reason: 'Mock adapter failure',
          });
          activeRun = null;
          return;
        }

        const artifacts = buildArtifacts(request);
        const artifactBytes = artifacts.reduce((total, artifact) => total + artifact.content.length, 0);
        post('run_metrics', data.runId, {
          wallClockMs: 5,
          stdoutBytes: stdoutChunk.length,
          stderrBytes: 0,
          logBytes: logChunk.length,
          eventCount: commandName.includes('test') ? 4 : 3,
          artifactBytes,
        });
        post('run_done', data.runId, {
          exitCode: 0,
          status: 'succeeded',
          artifacts,
        });
        activeRun = null;
      });
    });
  `;
}

function createHiddenIframe(documentRef: Document, html: string, allowSameOrigin: boolean): HTMLIFrameElement {
  const iframe = documentRef.createElement('iframe');
  iframe.hidden = true;
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('tabindex', '-1');
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.position = 'absolute';
  iframe.style.pointerEvents = 'none';
  iframe.style.opacity = '0';
  iframe.style.overflow = 'hidden';
  iframe.setAttribute('sandbox', allowSameOrigin ? 'allow-scripts allow-same-origin' : 'allow-scripts');
  iframe.srcdoc = html;
  documentRef.body.appendChild(iframe);
  return iframe;
}

export class IframeSandboxSession implements SandboxSession {
  readonly sessionId: string;

  private readonly document: Document;
  private readonly window: Window;
  private readonly flags: SandboxFeatureFlags;
  private readonly preferredAdapter: 'mock' | 'webcontainer';
  private readonly maxMessageBytes: number;
  private readonly destroyOnCompletion: boolean;
  private readonly idFactory: (prefix: string) => string;
  private iframe: HTMLIFrameElement | null = null;
  private readyAdapter = 'unavailable';
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;
  private disposed = false;
  private activeRun:
    | {
        runId: string;
        transcript: TranscriptState;
        resolve: (result: SandboxRunResult) => void;
        reject: (error: Error) => void;
      }
    | null = null;

  constructor(options: IframeSandboxSessionOptions = {}) {
    this.document = options.document ?? document;
    this.window = options.window ?? window;
    this.flags = options.flags ?? getSandboxFeatureFlags();
    this.preferredAdapter = options.preferredAdapter ?? (this.flags.allowSameOriginForWebContainer ? 'webcontainer' : 'mock');
    this.maxMessageBytes = options.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES;
    this.destroyOnCompletion = options.destroyOnCompletion ?? true;
    this.idFactory = options.idFactory ?? createPrefixedId;
    this.sessionId = this.idFactory('sandbox-session');
  }

  private getExpectedOrigin(): string {
    return this.flags.allowSameOriginForWebContainer ? this.window.location.origin : 'null';
  }

  private handleMessage = (event: MessageEvent<unknown>) => {
    if (!this.iframe || event.source !== this.iframe.contentWindow) {
      return;
    }

    if (this.getExpectedOrigin() !== 'null' && event.origin !== this.getExpectedOrigin()) {
      return;
    }

    const expectedRunId = this.activeRun?.runId ?? SANDBOX_CONTROL_RUN_ID;
    const validation = validateSandboxMessage(event.data, {
      direction: 'runner-to-host',
      expectedSessionId: this.sessionId,
      expectedRunId,
      maxBytes: this.maxMessageBytes,
    });
    if (!validation.ok) {
      return;
    }

    const message = validation.value as RunnerToHostMessage;
    if (message.type === 'runner_ready') {
      this.readyAdapter = message.payload.adapter;
      this.readyResolve?.();
      this.readyResolve = null;
      this.readyReject = null;
      return;
    }

    if (!this.activeRun) {
      return;
    }

    const transcript = this.activeRun.transcript;
    switch (message.type) {
      case 'run_log':
        transcript.events.push({ type: 'log', payload: message.payload, timestamp: message.timestamp });
        return;
      case 'run_stdout':
        transcript.events.push({ type: 'stdout', payload: message.payload, timestamp: message.timestamp });
        return;
      case 'run_stderr':
        transcript.events.push({ type: 'stderr', payload: message.payload, timestamp: message.timestamp });
        return;
      case 'run_test_result':
        transcript.events.push({ type: 'test_result', payload: message.payload, timestamp: message.timestamp });
        return;
      case 'run_metrics':
        transcript.events.push({ type: 'metrics', payload: message.payload, timestamp: message.timestamp });
        return;
      case 'run_error':
        transcript.events.push({ type: 'error', payload: message.payload, timestamp: message.timestamp });
        return;
      case 'run_done': {
        transcript.endedAt = message.timestamp;
        const metrics = transcript.events.findLast((entry): entry is Extract<TranscriptEvent, { type: 'metrics' }> => entry.type === 'metrics')?.payload;
        const result: SandboxRunResult = {
          sessionId: this.sessionId,
          runId: this.activeRun.runId,
          adapter: this.readyAdapter,
          status: message.payload.status,
          exitCode: message.payload.exitCode,
          reason: message.payload.reason,
          artifacts: message.payload.artifacts ?? [],
          persistedArtifactPaths: [],
          metrics,
          transcript,
          usedLegacyFallback: false,
        };
        const resolver = this.activeRun.resolve;
        this.activeRun = null;
        resolver(result);
        if (this.destroyOnCompletion) {
          void this.dispose();
        }
        return;
      }
      default:
        return;
    }
  };

  private async ensureReady(): Promise<void> {
    if (this.disposed) {
      throw new Error('Sandbox session already disposed.');
    }
    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.window.addEventListener('message', this.handleMessage);
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
      const config: RunnerBootConfig = {
        sessionId: this.sessionId,
        parentOrigin: this.getExpectedOrigin(),
        preferredAdapter: this.preferredAdapter,
        maxMessageBytes: this.maxMessageBytes,
        webContainerAllowed: this.flags.allowSameOriginForWebContainer,
      };
      this.iframe = createHiddenIframe(this.document, buildRunnerDocument(config, this.flags), this.flags.allowSameOriginForWebContainer);
      this.window.setTimeout(() => {
        if (this.readyResolve) {
          const error = new SandboxBootstrapError('Sandbox runner did not signal readiness.');
          this.readyReject?.(error);
          this.readyResolve = null;
          this.readyReject = null;
        }
      }, 2000);
    });
    return this.readyPromise;
  }

  async run(request: RunRequest): Promise<SandboxRunResult> {
    await this.ensureReady();
    if (this.readyAdapter === 'unavailable') {
      throw new SandboxBootstrapError('Sandbox runner is unavailable with the current browser security settings.');
    }
    if (this.activeRun) {
      throw new Error('Sandbox session already has an active run.');
    }
    const runId = this.idFactory('sandbox-run');
    const transcript = createTranscriptState(this.sessionId, runId, this.readyAdapter);
    return new Promise<SandboxRunResult>((resolve, reject) => {
      this.activeRun = { runId, transcript, resolve, reject };
      this.iframe?.contentWindow?.postMessage(
        createSandboxMessage('run_request', { sessionId: this.sessionId, runId }, { request }),
        '*',
      );
    });
  }

  async abort(reason?: string): Promise<void> {
    if (!this.activeRun || !this.iframe?.contentWindow) {
      return;
    }
    this.iframe.contentWindow.postMessage(
      createSandboxMessage('run_abort', { sessionId: this.sessionId, runId: this.activeRun.runId }, { reason }),
      '*',
    );
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.readyReject?.(new Error('Sandbox session disposed.'));
    this.readyResolve = null;
    this.readyReject = null;
    this.readyPromise = null;
    this.activeRun?.reject(new Error('Sandbox session disposed.'));
    this.activeRun = null;
    this.window.removeEventListener('message', this.handleMessage);
    this.iframe?.remove();
    this.iframe = null;
  }
}
