import { BrowserClaimExtractor } from './extractor';
import { ClaimifyError, serializeClaimifyError } from './errors';
import type { ClaimExtractor, ClaimifyWorkerRequest, ClaimifyWorkerResponse, PreloadOptions } from './types';

type PostMessage = (message: ClaimifyWorkerResponse) => void;

export async function handleClaimifyWorkerMessage(
  message: ClaimifyWorkerRequest,
  extractor: ClaimExtractor,
  postMessage: PostMessage,
): Promise<void> {
  try {
    if (message.type === 'preload') {
      const options: PreloadOptions = {
        ...message.options,
        progressCallback: (event) => postMessage({ type: 'progress', requestId: message.requestId, event }),
      };
      postMessage({ type: 'result', requestId: message.requestId, result: await extractor.preload(options) });
      return;
    }
    if (message.type === 'extract') {
      postMessage({ type: 'result', requestId: message.requestId, result: await extractor.extract(message.input) });
      return;
    }
    if (message.type === 'dispose') {
      postMessage({ type: 'result', requestId: message.requestId, result: await extractor.dispose() });
      return;
    }
    if (message.type === 'offline-ready') {
      postMessage({ type: 'result', requestId: message.requestId, result: await extractor.isReadyOffline() });
      return;
    }
    const unknownType = (message as { type: string }).type;
    throw new ClaimifyError(`Unknown worker request type: ${unknownType}`);
  } catch (error) {
    postMessage({ type: 'error', requestId: message.requestId, error: serializeClaimifyError(error) });
  }
}

const workerGlobal = globalThis as unknown as {
  addEventListener?: (type: 'message', listener: (event: MessageEvent<ClaimifyWorkerRequest>) => void) => void;
  postMessage?: PostMessage;
  WorkerGlobalScope?: unknown;
};

if (typeof workerGlobal.addEventListener === 'function' && typeof workerGlobal.postMessage === 'function') {
  const extractor = new BrowserClaimExtractor();
  workerGlobal.addEventListener('message', (event) => {
    void handleClaimifyWorkerMessage(event.data, extractor, workerGlobal.postMessage as PostMessage);
  });
}
