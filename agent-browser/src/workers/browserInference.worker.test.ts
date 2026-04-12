import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const pipelineMock = vi.fn();
const postMessageSpy = vi.fn();

vi.stubGlobal('postMessage', postMessageSpy);

/**
 * Each test resets modules so the worker's internal pipeline cache is cleared and
 * the pipeline mock is re-wired through the fresh module graph.
 */
beforeEach(() => {
  pipelineMock.mockReset();
  postMessageSpy.mockReset();
  vi.resetModules();
  vi.doMock('@huggingface/transformers', () => ({
    pipeline: (...args: unknown[]) => pipelineMock(...args),
    TextStreamer: vi.fn(),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function getHandleMessage() {
  const mod = await import('./browserInference.worker');
  return mod.handleMessage;
}

describe('browserInference.worker handleMessage', () => {
  it('loads gpt-2 without error: calls pipeline and posts status ready', async () => {
    pipelineMock.mockResolvedValue(vi.fn());

    const handleMessage = await getHandleMessage();

    await handleMessage({ type: 'load', id: 'req-1', task: 'text-generation', modelId: 'openai-community/gpt2', dtype: 'q8' });

    expect(pipelineMock).toHaveBeenCalledWith(
      'text-generation',
      'openai-community/gpt2',
      expect.objectContaining({ dtype: 'q8' }),
    );

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'status', id: 'req-1', msg: 'ready' }),
    );

    const messages: { type: string }[] = postMessageSpy.mock.calls.map((c) => c[0]);
    expect(messages.every((m) => m.type !== 'error')).toBe(true);
  });

  it('loads gpt-2 without forcing a backend device so Transformers.js can auto-select', async () => {
    pipelineMock.mockResolvedValue(vi.fn());

    const handleMessage = await getHandleMessage();

    await handleMessage({ type: 'load', id: 'req-2', task: 'text-generation', modelId: 'openai-community/gpt2', dtype: 'q8' });

    expect(pipelineMock).toHaveBeenCalledTimes(1);
    const loadOptions = pipelineMock.mock.calls[0][2] as Record<string, unknown>;
    expect(loadOptions).not.toHaveProperty('device');
  });

  it('posts an error when pipeline loading fails and does not throw', async () => {
    pipelineMock.mockRejectedValue(new Error('ONNX file not found'));

    const handleMessage = await getHandleMessage();

    await expect(
      handleMessage({ type: 'load', id: 'req-3', task: 'text-generation', modelId: 'openai-community/gpt2', dtype: 'q8' }),
    ).resolves.not.toThrow();

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', id: 'req-3', msg: 'ONNX file not found' }),
    );
  });

  it('posts an error immediately for an unsupported task without calling pipeline', async () => {
    const handleMessage = await getHandleMessage();

    await handleMessage({ type: 'load', id: 'req-4', task: 'unsupported-task', modelId: 'gpt2' });

    expect(pipelineMock).not.toHaveBeenCalled();
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', id: 'req-4' }),
    );
  });

  it('forwards progress phase messages during model download without resolving early', async () => {
    let resolveLoad!: (value: unknown) => void;
    pipelineMock.mockImplementation(
      (_task: string, _model: string, options: Record<string, unknown>) =>
        new Promise((resolve) => {
          const cb = options.progress_callback as (p: Record<string, unknown>) => void;
          cb({ status: 'download', file: 'onnx/decoder_model.onnx' });
          cb({ status: 'progress', file: 'onnx/decoder_model.onnx', progress: 50 });
          resolveLoad = resolve;
        }),
    );

    const handleMessage = await getHandleMessage();

    const loadPromise = handleMessage({
      type: 'load',
      id: 'req-5',
      task: 'text-generation',
      modelId: 'openai-community/gpt2',
      dtype: 'q8',
    });

    // The initial phase message + at least one progress-derived phase should have been posted
    const phaseMessages = postMessageSpy.mock.calls.map((c) => c[0]).filter((m: { type: string }) => m.type === 'phase');
    expect(phaseMessages.length).toBeGreaterThan(0);

    // No 'status' should have been posted yet because pipeline hasn't resolved
    const statusBeforeResolve = postMessageSpy.mock.calls
      .map((c) => c[0])
      .find((m: { type: string }) => m.type === 'status');
    expect(statusBeforeResolve).toBeUndefined();

    resolveLoad({});
    await loadPromise;

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'status', id: 'req-5', msg: 'ready' }),
    );
  });

  it('caches the loaded pipeline so a second load request skips the pipeline() call', async () => {
    pipelineMock.mockResolvedValue(vi.fn());

    const handleMessage = await getHandleMessage();

    await handleMessage({ type: 'load', id: 'req-6a', task: 'text-generation', modelId: 'org/cached-model', dtype: 'q8' });
    await handleMessage({ type: 'load', id: 'req-6b', task: 'text-generation', modelId: 'org/cached-model', dtype: 'q8' });

    expect(pipelineMock).toHaveBeenCalledTimes(1);
  });
});
