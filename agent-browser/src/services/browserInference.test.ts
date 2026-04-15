import { beforeEach, describe, expect, it, vi } from 'vitest';

type WorkerMessage = Record<string, unknown>;

const workers: MockWorker[] = [];

class MockWorker {
  onmessage: ((event: MessageEvent<Record<string, unknown>>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn();

  constructor() {
    workers.push(this);
  }
}

beforeEach(() => {
  workers.length = 0;
  vi.resetModules();
  vi.doMock('../workers/browserInference.worker?worker', () => ({
    default: MockWorker,
  }));
});

async function importEngine() {
  const mod = await import('./browserInference');
  return mod.browserInferenceEngine;
}

function emit(worker: MockWorker, data: WorkerMessage) {
  worker.onmessage?.({ data } as unknown as MessageEvent<Record<string, unknown>>);
}

describe('browserInferenceEngine', () => {
  it('aborts a pending generate request, ignores late worker messages, and recreates the worker for the next request', async () => {
    const engine = await importEngine();
    const controller = new AbortController();
    const onToken = vi.fn();

    const firstPromise = engine.generate(
      { task: 'text-generation', modelId: 'model-1', prompt: 'hello' },
      { onToken },
      controller.signal,
    );

    expect(workers).toHaveLength(1);
    const firstWorker = workers[0];
    const firstMessage = firstWorker.postMessage.mock.calls[0][0] as WorkerMessage;

    controller.abort();

    await expect(firstPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(firstWorker.terminate).toHaveBeenCalledTimes(1);

    emit(firstWorker, { type: 'token', id: firstMessage.id, token: 'late token' });
    expect(onToken).not.toHaveBeenCalled();

    const onDone = vi.fn();
    const secondPromise = engine.generate(
      { task: 'text-generation', modelId: 'model-1', prompt: 'retry' },
      { onDone },
    );

    expect(workers).toHaveLength(2);
    const secondWorker = workers[1];
    const secondMessage = secondWorker.postMessage.mock.calls[0][0] as WorkerMessage;
    emit(secondWorker, { type: 'done', id: secondMessage.id, result: { text: 'ok' } });

    await expect(secondPromise).resolves.toBeUndefined();
    expect(onDone).toHaveBeenCalledWith({ text: 'ok' });
  });
});