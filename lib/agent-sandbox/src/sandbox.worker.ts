import type { SandboxWorkerMessage, SandboxWorkerResponse } from './types';
import { SandboxWorkerRuntime, type SandboxWorkerRuntimeOptions } from './workerRuntime';

export interface SandboxWorkerTarget {
  postMessage(message: SandboxWorkerResponse): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<SandboxWorkerMessage>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<SandboxWorkerMessage>) => void): void;
}

export interface SandboxWorkerHandle {
  dispose(): void;
}

function parseNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getErrorMessage(error: unknown): string {
  /* c8 ignore next */
  return error instanceof Error ? error.message : String(error);
}

export function readWorkerRuntimeOptions(url = globalThis.location?.href): SandboxWorkerRuntimeOptions {
  if (!url) {
    return {};
  }
  const params = new URL(url).searchParams;
  return {
    maxFileBytes: parseNumber(params.get('maxFileBytes')),
    maxTotalBytes: parseNumber(params.get('maxTotalBytes')),
    maxOutputBytes: parseNumber(params.get('maxOutputBytes')),
    allowNetwork: params.get('allowNetwork') === 'true',
  };
}

export function createSandboxWorker(
  target: SandboxWorkerTarget,
  runtime = new SandboxWorkerRuntime(readWorkerRuntimeOptions()),
): SandboxWorkerHandle {
  const handleMessage = (event: MessageEvent<SandboxWorkerMessage>) => {
    const request = event.data;
    void runtime.handleRequest(request)
      .then((result) => {
        target.postMessage({ id: request.id, ok: true, result });
      })
      .catch((error) => {
        target.postMessage({
          id: request.id,
          ok: false,
          error: getErrorMessage(error),
        });
      });
  };

  target.addEventListener('message', handleMessage);

  return {
    dispose() {
      target.removeEventListener('message', handleMessage);
    },
  };
}

/* c8 ignore start */
if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  createSandboxWorker(self as unknown as SandboxWorkerTarget);
}
/* c8 ignore stop */
