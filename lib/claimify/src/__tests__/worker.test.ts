import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleClaimifyWorkerMessage } from '../worker';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('worker message handler', () => {
  it('posts sanitized results and errors', async () => {
    const posts: unknown[] = [];
    const extractor = {
      preload: vi.fn(async (options) => {
        options.progressCallback({ loaded: 1 });
        return { modelId: 'm', cached: true, device: 'wasm' as const, dtype: 'q4' };
      }),
      isReadyOffline: vi.fn(async () => true),
      extract: vi.fn(async () => ({
        claims: [],
        dropped: [],
        diagnostics: {
          sentenceCount: 0,
          selectedCount: 0,
          droppedCount: 0,
          droppedByStage: { selection: 0, disambiguation: 0, decomposition: 0, validation: 0 },
          claimCount: 0,
          modelId: null,
          device: null,
          dtype: null,
          elapsedMs: 0,
        },
      })),
      dispose: vi.fn(),
    };

    await handleClaimifyWorkerMessage(
      { type: 'preload', requestId: '1', options: {} },
      extractor,
      (message) => posts.push(message),
    );
    await handleClaimifyWorkerMessage(
      { type: 'extract', requestId: '2', input: { question: 'Q', answer: 'A.' } },
      extractor,
      (message) => posts.push(message),
    );
    await handleClaimifyWorkerMessage(
      { type: 'dispose', requestId: '3' },
      extractor,
      (message) => posts.push(message),
    );
    await handleClaimifyWorkerMessage(
      { type: 'offline-ready', requestId: '4' },
      extractor,
      (message) => posts.push(message),
    );
    await handleClaimifyWorkerMessage(
      { type: 'unknown', requestId: '5' } as never,
      extractor,
      (message) => posts.push(message),
    );

    expect(posts).toEqual([
      { type: 'progress', requestId: '1', event: { loaded: 1 } },
      { type: 'result', requestId: '1', result: { modelId: 'm', cached: true, device: 'wasm', dtype: 'q4' } },
      {
        type: 'result',
        requestId: '2',
        result: {
          claims: [],
          dropped: [],
          diagnostics: {
            sentenceCount: 0,
            selectedCount: 0,
            droppedCount: 0,
            droppedByStage: { selection: 0, disambiguation: 0, decomposition: 0, validation: 0 },
            claimCount: 0,
            modelId: null,
            device: null,
            dtype: null,
            elapsedMs: 0,
          },
        },
      },
      { type: 'result', requestId: '3', result: undefined },
      { type: 'result', requestId: '4', result: true },
      { type: 'error', requestId: '5', error: { name: 'ClaimifyError', message: 'Unknown worker request type: unknown' } },
    ]);
  });

  it('registers the module worker message listener when loaded in a worker global', async () => {
    vi.resetModules();
    const posts: unknown[] = [];
    const addEventListener = vi.fn();
    vi.stubGlobal('postMessage', (message: unknown) => posts.push(message));
    vi.stubGlobal('addEventListener', addEventListener);

    await import('../worker?bootstrap');
    const listener = addEventListener.mock.calls[0]?.[1] as (event: MessageEvent) => void;
    listener(new MessageEvent('message', { data: { type: 'offline-ready', requestId: 'ready' } }));

    await vi.waitFor(() => {
      expect(posts).toContainEqual({ type: 'result', requestId: 'ready', result: false });
    });
  });

  it('does not register the module worker listener without postMessage', async () => {
    vi.resetModules();
    const addEventListener = vi.fn();
    vi.stubGlobal('postMessage', undefined);
    vi.stubGlobal('addEventListener', addEventListener);

    await import('../worker?no-post-message');

    expect(addEventListener).not.toHaveBeenCalled();
  });
});
