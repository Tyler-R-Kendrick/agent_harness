import { MockExecutionAdapter } from './adapters/mock-adapter';
import type { AdapterExecutionContext, AdapterExecutionResult, ExecutionAdapter } from './adapters/base';
import {
  createSandboxMessage,
  DEFAULT_MAX_MESSAGE_BYTES,
  resolveRunLimits,
  SANDBOX_CONTROL_RUN_ID,
  validateSandboxMessage,
  type HostToRunnerMessage,
  type RunTerminalStatus,
  type RunnerReadyMessage,
  type RunnerToHostMessage,
  type SandboxMessage,
} from './protocol';

export interface RunnerBootConfig {
  sessionId: string;
  parentOrigin: string;
  preferredAdapter: 'mock' | 'webcontainer';
  maxMessageBytes?: number;
  webContainerAllowed: boolean;
}

export interface RunnerHostTarget {
  postMessage(message: RunnerToHostMessage, targetOrigin: string): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
}

export interface RunnerController {
  start(): void;
  stop(): Promise<void>;
}

const WEBCONTAINER_RUNTIME_ENABLED = import.meta.env.VITE_ALLOW_SANDBOX_SAME_ORIGIN === 'true';

async function disposeAdapter(adapter: ExecutionAdapter): Promise<void> {
  if (adapter.dispose) {
    await adapter.dispose();
  }
}

function toByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

async function createAdapter(preferredAdapter: RunnerBootConfig['preferredAdapter'], webContainerAllowed: boolean): Promise<ExecutionAdapter> {
  if (preferredAdapter === 'mock') {
    return new MockExecutionAdapter();
  }
  if (webContainerAllowed && WEBCONTAINER_RUNTIME_ENABLED) {
    const { WebContainerExecutionAdapter } = await import('./adapters/webcontainer-adapter');
    return new WebContainerExecutionAdapter();
  }
  return {
    kind: 'unavailable',
    supportsAbort: false,
    canHandle: () => false,
    async execute(): Promise<AdapterExecutionResult> {
      return {
        exitCode: 1,
        status: 'failed',
        reason: 'WebContainer execution is not enabled for this sandbox.',
      };
    },
  };
}

export function createSandboxRunnerController(
  config: RunnerBootConfig,
  host: RunnerHostTarget,
): RunnerController {
  const maxMessageBytes = config.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES;
  let adapterPromise: Promise<ExecutionAdapter> | null = null;
  let activeRun: { runId: string; controller: AbortController; startedAt: number } | null = null;
  let stopped = false;

  function getAdapter(): Promise<ExecutionAdapter> {
    if (!adapterPromise) {
      adapterPromise = createAdapter(config.preferredAdapter, config.webContainerAllowed);
    }
    return adapterPromise;
  }

  function post(message: RunnerToHostMessage): void {
    host.postMessage(message, config.parentOrigin);
  }

  function emitReady(adapter: ExecutionAdapter): void {
    const ready: RunnerReadyMessage = createSandboxMessage(
      'runner_ready',
      { sessionId: config.sessionId, runId: SANDBOX_CONTROL_RUN_ID },
      {
        adapter: adapter.kind,
        supportsAbort: adapter.supportsAbort,
        networkPolicy: 'deny',
      },
    );
    post(ready);
  }

  async function handleRunRequest(message: HostToRunnerMessage & { type: 'run_request' }): Promise<void> {
    const adapter = await getAdapter();
    if (activeRun) {
      post(createSandboxMessage('run_error', { sessionId: config.sessionId, runId: message.runId }, {
        code: 'run_already_active',
        message: 'Runner already has an active run.',
        fatal: true,
        phase: 'dispatch',
      }));
      return;
    }

    if (!adapter.canHandle(message.payload.request)) {
      post(createSandboxMessage('run_error', { sessionId: config.sessionId, runId: message.runId }, {
        code: 'unsupported_request',
        message: 'The selected execution adapter cannot handle this request.',
        fatal: true,
        phase: 'dispatch',
      }));
      return;
    }

    const request = message.payload.request;
    const limits = resolveRunLimits(request.limits);
    const controller = new AbortController();
    activeRun = { runId: message.runId, controller, startedAt: Date.now() };
    let logBytes = 0;
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let eventCount = 0;
    let testCount = 0;
    let limitReason: string | undefined;

    const timeoutHandle = window.setTimeout(() => {
      limitReason = 'Run exceeded the configured wall-clock timeout.';
      controller.abort(limitReason);
    }, request.timeoutMs ?? limits.maxRuntimeMs);

    const emitEvent = (event: Parameters<AdapterExecutionContext['emit']>[0]) => {
      eventCount += 1;
      if (eventCount > limits.maxEventCount && !controller.signal.aborted) {
        limitReason = 'Run exceeded the configured event budget.';
        controller.abort(limitReason);
        return;
      }

      if (event.type === 'log') {
        logBytes += event.bytes;
        if (logBytes > limits.maxLogBytes && !controller.signal.aborted) {
          limitReason = 'Run exceeded the configured log byte budget.';
          controller.abort(limitReason);
          return;
        }
        post(createSandboxMessage('run_log', { sessionId: config.sessionId, runId: message.runId }, event));
        return;
      }

      if (event.type === 'stdout') {
        stdoutBytes += event.bytes;
        post(createSandboxMessage('run_stdout', { sessionId: config.sessionId, runId: message.runId }, event));
        return;
      }

      if (event.type === 'stderr') {
        stderrBytes += event.bytes;
        post(createSandboxMessage('run_stderr', { sessionId: config.sessionId, runId: message.runId }, event));
        return;
      }

      testCount += 1;
      post(createSandboxMessage('run_test_result', { sessionId: config.sessionId, runId: message.runId }, event.payload));
    };

    post(createSandboxMessage('run_ack', { sessionId: config.sessionId, runId: message.runId }, { acceptedAt: Date.now() }));

    try {
      const result = await adapter.execute(request, { signal: controller.signal, emit: emitEvent });
      const endedAt = Date.now();
      const artifactBytes = (result.artifacts ?? []).reduce((total, artifact) => total + toByteLength(artifact.content), 0);
      post(createSandboxMessage('run_metrics', { sessionId: config.sessionId, runId: message.runId }, {
        wallClockMs: endedAt - activeRun.startedAt,
        stdoutBytes: result.metrics?.stdoutBytes ?? stdoutBytes,
        stderrBytes: result.metrics?.stderrBytes ?? stderrBytes,
        logBytes: result.metrics?.logBytes ?? logBytes,
        eventCount: result.metrics?.eventCount ?? (eventCount + testCount),
        artifactBytes: result.metrics?.artifactBytes ?? artifactBytes,
      }));

      const status: RunTerminalStatus = controller.signal.aborted
        ? (limitReason?.includes('timeout') ? 'timed_out' : limitReason ? 'limit_exceeded' : 'aborted')
        : result.status;
      post(createSandboxMessage('run_done', { sessionId: config.sessionId, runId: message.runId }, {
        exitCode: controller.signal.aborted ? (status === 'aborted' ? 130 : 1) : result.exitCode,
        status,
        reason: limitReason ?? result.reason,
        artifacts: status === 'succeeded' ? result.artifacts : [],
      }));
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      const status: RunTerminalStatus = controller.signal.aborted ? 'aborted' : 'failed';
      post(createSandboxMessage('run_error', { sessionId: config.sessionId, runId: message.runId }, {
        code: 'execution_failed',
        message: messageText,
        fatal: true,
        phase: 'execute',
      }));
      post(createSandboxMessage('run_done', { sessionId: config.sessionId, runId: message.runId }, {
        exitCode: 1,
        status,
        reason: limitReason ?? messageText,
      }));
    } finally {
      window.clearTimeout(timeoutHandle);
      activeRun = null;
    }
  }

  async function handleMessage(event: MessageEvent<unknown>): Promise<void> {
    if (stopped) {
      return;
    }

    const validation = validateSandboxMessage(event.data, {
      direction: 'host-to-runner',
      expectedSessionId: config.sessionId,
      maxBytes: maxMessageBytes,
    });
    if (!validation.ok) {
      return;
    }

    const message = validation.value as SandboxMessage;
    if (message.type === 'run_abort') {
      if (activeRun && activeRun.runId === message.runId) {
        activeRun.controller.abort(message.payload.reason ?? 'Run aborted by host.');
      }
      return;
    }

    if (message.type !== 'run_request') {
      return;
    }

    await handleRunRequest(message);
  }

  return {
    start() {
      host.addEventListener('message', handleMessage);
      void getAdapter().then((adapter) => {
        if (!stopped) {
          emitReady(adapter);
        }
      });
    },
    async stop() {
      stopped = true;
      host.removeEventListener('message', handleMessage);
      if (activeRun) {
        activeRun.controller.abort('Runner stopped.');
        activeRun = null;
      }
      if (adapterPromise) {
        await disposeAdapter(await adapterPromise);
      }
    },
  };
}

declare global {
  interface Window {
    __SANDBOX_RUNNER_CONFIG__?: RunnerBootConfig;
  }
}

const bootConfig = window.__SANDBOX_RUNNER_CONFIG__;
if (bootConfig && window.parent && window.parent !== window) {
  const controller = createSandboxRunnerController(bootConfig, {
    postMessage(message, targetOrigin) {
      window.parent.postMessage(message, targetOrigin === 'null' ? '*' : targetOrigin);
    },
    addEventListener(type, listener) {
      window.addEventListener(type, listener as EventListener);
    },
    removeEventListener(type, listener) {
      window.removeEventListener(type, listener as EventListener);
    },
  });
  controller.start();
}
