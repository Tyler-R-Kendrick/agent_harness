import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlguidanceSession } from '../index.js';
import { installLlguidanceWorker } from '../worker.js';
import { LlguidanceWorkerClient } from '../worker-client.js';

const tokenizerJson = JSON.stringify({ model: { vocab: { red: 0, green: 1 } } });

class FakeWorkerScope {
  messages: unknown[] = [];
  listener?: (event: { data: unknown }) => void;

  addEventListener(type: string, listener: (event: { data: unknown }) => void): void {
    expect(type).toBe('message');
    this.listener = listener;
  }

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  send(message: unknown): void {
    this.listener?.({ data: message });
  }
}

class FakeClientWorker {
  sent: unknown[] = [];
  listeners: Array<(event: { data: unknown }) => void> = [];

  postMessage(message: unknown): void {
    this.sent.push(message);
  }

  addEventListener(type: string, listener: (event: { data: unknown }) => void): void {
    expect(type).toBe('message');
    this.listeners.push(listener);
  }

  emit(message: unknown): void {
    for (const listener of this.listeners) {
      listener({ data: message });
    }
  }
}

describe('worker protocol', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles session lifecycle messages and errors', async () => {
    const scope = new FakeWorkerScope();
    await installLlguidanceWorker(scope);

    scope.send({ id: 1, op: 'computeMask', matcherId: 1 });
    scope.send({ id: 2, op: 'init', tokenizerJson });
    scope.send({ id: 3, op: 'createMatcher', input: { kind: 'regex', regex: 'red|green' } });
    scope.send({ id: 4, op: 'computeMask', matcherId: 1 });
    scope.send({ id: 5, op: 'commitToken', matcherId: 1, tokenId: 0 });
    scope.send({ id: 6, op: 'freeMatcher', matcherId: 1 });
    scope.send({ id: 7, op: 'unknown' });

    expect(scope.messages).toEqual([
      { id: 1, ok: false, error: 'Worker session has not been initialized.' },
      { id: 2, ok: true, result: { vocabSize: 2 } },
      { id: 3, ok: true, result: { matcherId: 1 } },
      { id: 4, ok: true, result: { tokenIds: [0, 1] } },
      { id: 5, ok: true, result: { stopped: true, stopReason: 'matched', ffTokens: [], temperature: undefined } },
      { id: 6, ok: true, result: { freed: true } },
      { id: 7, ok: false, error: 'Unknown llguidance worker op: unknown' }
    ]);
  });

  it('wraps worker requests in promises', async () => {
    const worker = new FakeClientWorker();
    const client = new LlguidanceWorkerClient(worker);

    const init = client.init(tokenizerJson);
    expect(worker.sent).toEqual([{ id: 1, op: 'init', tokenizerJson, options: undefined }]);
    worker.emit({ id: 1, ok: true, result: { vocabSize: 2 } });
    await expect(init).resolves.toEqual({ vocabSize: 2 });

    const matcher = client.createMatcher({ kind: 'regex', regex: 'red' });
    worker.emit({ id: 2, ok: true, result: { matcherId: 1 } });
    await expect(matcher).resolves.toEqual({ matcherId: 1 });

    const rejected = client.computeMask(1);
    worker.emit({ id: 3, ok: false, error: 'boom' });
    worker.emit({ id: 999, ok: true, result: null });
    await expect(rejected).rejects.toThrow('boom');

    const commit = client.commitToken(1, 0);
    worker.emit({ id: 4, ok: true, result: { stopped: true } });
    await expect(commit).resolves.toEqual({ stopped: true });

    const free = client.freeMatcher(1);
    worker.emit({ id: 5, ok: true, result: { freed: true } });
    await expect(free).resolves.toEqual({ freed: true });
  });

  it('stringifies non-error worker failures', async () => {
    const scope = new FakeWorkerScope();
    await installLlguidanceWorker(scope);
    scope.send({ id: 1, op: 'init', tokenizerJson });

    vi.spyOn(LlguidanceSession.prototype, 'createMatcher').mockImplementation(() => {
      throw 'string failure';
    });

    scope.send({ id: 2, op: 'createMatcher', input: { kind: 'regex', regex: 'red' } });

    expect(scope.messages.at(-1)).toEqual({ id: 2, ok: false, error: 'string failure' });
  });
});
