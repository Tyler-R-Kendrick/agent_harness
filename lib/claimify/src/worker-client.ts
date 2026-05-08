import { ClaimifyWorkerError } from './errors';
import type {
  ClaimExtractionInput,
  ClaimExtractionResult,
  ClaimExtractor,
  ClaimifyWorkerResponse,
  PreloadOptions,
  PreloadResult,
} from './types';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  progressCallback?: (event: unknown) => void;
};

export function createClaimifyWorkerExtractor(worker: Worker): ClaimExtractor {
  let nextRequestId = 0;
  const pending = new Map<string, PendingRequest>();

  const onMessage = (event: MessageEvent<ClaimifyWorkerResponse>) => {
    const message = event.data;
    const request = pending.get(message.requestId);
    if (!request) {
      return;
    }
    if (message.type === 'progress') {
      request.progressCallback?.(message.event);
      return;
    }
    pending.delete(message.requestId);
    if (message.type === 'error') {
      request.reject(new ClaimifyWorkerError(message.error.message));
      return;
    }
    request.resolve(message.result);
  };

  const onError = (event: ErrorEvent) => {
    const error = new ClaimifyWorkerError(event.message || event.error?.message || 'Worker failed');
    rejectAll(error);
  };

  worker.addEventListener('message', onMessage);
  worker.addEventListener('error', onError);

  const send = <T>(message: Record<string, unknown>, progressCallback?: (event: unknown) => void): Promise<T> => {
    const requestId = `claimify-${nextRequestId++}`;
    const promise = new Promise<T>((resolve, reject) => {
      pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject, progressCallback });
    });
    worker.postMessage({ ...message, requestId });
    return promise;
  };

  const rejectAll = (error: Error) => {
    for (const request of pending.values()) {
      request.reject(error);
    }
    pending.clear();
  };

  return {
    preload(options: PreloadOptions = {}) {
      const { progressCallback, ...serializableOptions } = options;
      return send<PreloadResult>({ type: 'preload', options: serializableOptions }, progressCallback);
    },
    isReadyOffline() {
      return send<boolean>({ type: 'offline-ready' });
    },
    extract(input: ClaimExtractionInput) {
      return send<ClaimExtractionResult>({ type: 'extract', input });
    },
    async dispose() {
      try {
        await send<void>({ type: 'dispose' });
      } finally {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        rejectAll(new ClaimifyWorkerError('Worker disposed'));
        worker.terminate();
      }
    },
  };
}
