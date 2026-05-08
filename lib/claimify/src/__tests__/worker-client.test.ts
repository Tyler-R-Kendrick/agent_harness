import { describe, expect, it, vi } from 'vitest';
import { createClaimifyWorkerExtractor } from '../worker-client';

class FakeWorker extends EventTarget {
  messages: unknown[] = [];
  terminated = false;

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(data: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }

  fail(error: Error): void {
    this.dispatchEvent(new ErrorEvent('error', { error, message: error.message }));
  }
}

describe('worker client', () => {
  it('routes progress and results by request id', async () => {
    const worker = new FakeWorker();
    const progressCallback = vi.fn();
    const extractor = createClaimifyWorkerExtractor(worker as unknown as Worker);

    const preload = extractor.preload({ progressCallback });
    const request = worker.messages[0] as { requestId: string };
    worker.emit({ type: 'progress', requestId: request.requestId, event: { loaded: 1 } });
    worker.emit({
      type: 'result',
      requestId: request.requestId,
      result: { modelId: 'm', cached: true, device: 'wasm', dtype: 'q4' },
    });

    await expect(preload).resolves.toMatchObject({ modelId: 'm' });
    expect(progressCallback).toHaveBeenCalledWith({ loaded: 1 });
  });

  it('rejects request errors and supports dispose cleanup', async () => {
    const worker = new FakeWorker();
    const extractor = createClaimifyWorkerExtractor(worker as unknown as Worker);

    const extracting = extractor.extract({ question: 'Q', answer: 'A.' });
    const request = worker.messages[0] as { requestId: string };
    worker.emit({ type: 'error', requestId: request.requestId, error: { name: 'ClaimifyError', message: 'bad' } });

    await expect(extracting).rejects.toMatchObject({ name: 'ClaimifyWorkerError', message: 'bad' });
    await extractor.dispose();
    expect(worker.terminated).toBe(true);
  });

  it('rejects pending requests on worker error', async () => {
    const worker = new FakeWorker();
    const extractor = createClaimifyWorkerExtractor(worker as unknown as Worker);

    const ready = extractor.isReadyOffline();
    worker.fail(new Error('boom'));

    await expect(ready).rejects.toMatchObject({ name: 'ClaimifyWorkerError', message: 'boom' });
  });
});
