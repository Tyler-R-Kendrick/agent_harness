import { LlguidanceSession, initLlguidanceWasm } from './session.js';
import type { LlguidanceWorkerRequest, LlguidanceWorkerResponse } from './types.js';

export interface LlguidanceWorkerScope {
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  postMessage(message: unknown): void;
}

export async function installLlguidanceWorker(scope: LlguidanceWorkerScope): Promise<void> {
  let session: LlguidanceSession | undefined;

  scope.addEventListener('message', ({ data }) => {
    const request = data as LlguidanceWorkerRequest;
    try {
      if (request.op === 'init') {
        void initLlguidanceWasm();
        session = new LlguidanceSession(request.tokenizerJson, request.options);
        post(scope, { id: request.id, ok: true, result: { vocabSize: session.vocabSize() } });
        return;
      }

      if (!session) {
        throw new Error('Worker session has not been initialized.');
      }

      if (request.op === 'createMatcher') {
        post(scope, { id: request.id, ok: true, result: { matcherId: session.createMatcher(request.input) } });
        return;
      }

      if (request.op === 'computeMask') {
        post(scope, { id: request.id, ok: true, result: { tokenIds: [...session.computeMask(request.matcherId)] } });
        return;
      }

      if (request.op === 'commitToken') {
        post(scope, { id: request.id, ok: true, result: session.commitToken(request.matcherId, request.tokenId) });
        return;
      }

      if (request.op === 'freeMatcher') {
        session.freeMatcher(request.matcherId);
        post(scope, { id: request.id, ok: true, result: { freed: true } });
        return;
      }

      throw new Error(`Unknown llguidance worker op: ${(request as { op?: unknown }).op}`);
    } catch (error) {
      post(scope, { id: Number(request.id), ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
}

function post(scope: LlguidanceWorkerScope, message: LlguidanceWorkerResponse): void {
  scope.postMessage(message);
}
