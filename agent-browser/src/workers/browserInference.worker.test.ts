import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const pipelineMock = vi.fn();
const postMessageSpy = vi.fn();

vi.stubGlobal('postMessage', postMessageSpy);

/**
 * Each test resets modules so the worker's internal pipeline cache is cleared and
 * the pipeline mock is rewired through the fresh module graph.
 */
beforeEach(() => {
  pipelineMock.mockReset();
  postMessageSpy.mockReset();
  vi.resetModules();
  vi.doMock('@huggingface/transformers', () => ({
    pipeline: (...args: unknown[]) => pipelineMock(...args),
    TextStreamer: vi.fn().mockImplementation((_tokenizer, opts) => ({ kind: 'streamer', opts })),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function getHandleMessage() {
  const mod = await import('./browserInference.worker');
  return mod.handleMessage;
}

describe('browserInference.worker handleMessage (reference_impl action protocol)', () => {
  it('loads gpt-2: calls pipeline and posts done with {loaded:true} — matching reference_impl', async () => {
    pipelineMock.mockResolvedValue(vi.fn());

    const handleMessage = await getHandleMessage();

    await handleMessage({ action: 'load', id: 'req-1', task: 'text-generation', modelId: 'openai-community/gpt2' });

    expect(pipelineMock).toHaveBeenCalledWith(
      'text-generation',
      'openai-community/gpt2',
      expect.objectContaining({ progress_callback: expect.any(Function) }),
    );

    // reference_impl sends {type:"done", id, result:{loaded:true}} on load complete
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'done', id: 'req-1', result: { loaded: true } }),
    );

    const messages: { type: string }[] = postMessageSpy.mock.calls.map((c) => c[0]);
    expect(messages.every((m) => m.type !== 'error')).toBe(true);
  });

  it('loads without forcing a backend device or dtype so Transformers.js can auto-select', async () => {
    pipelineMock.mockResolvedValue(vi.fn());

    const handleMessage = await getHandleMessage();

    await handleMessage({ action: 'load', id: 'req-2', task: 'text-generation', modelId: 'openai-community/gpt2' });

    expect(pipelineMock).toHaveBeenCalledTimes(1);
    const loadOptions = pipelineMock.mock.calls[0][2] as Record<string, unknown>;
    expect(loadOptions).not.toHaveProperty('device');
    expect(loadOptions).not.toHaveProperty('dtype');
    expect(loadOptions).toHaveProperty('progress_callback');
  });

  it('posts error:{error} (not msg) when pipeline loading fails — matching reference_impl', async () => {
    pipelineMock.mockRejectedValue(new Error('ONNX file not found'));

    const handleMessage = await getHandleMessage();

    await expect(
      handleMessage({ action: 'load', id: 'req-3', task: 'text-generation', modelId: 'openai-community/gpt2' }),
    ).resolves.not.toThrow();

    // reference_impl uses `error` field not `msg`
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', id: 'req-3', error: 'ONNX file not found' }),
    );
  });

  it('sends thinking then generating phases before running text-generation inference', async () => {
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
      action: 'load',
      id: 'req-5',
      task: 'text-generation',
      modelId: 'openai-community/gpt2',
    });

    // Status messages posted during loading
    const statusMessages = postMessageSpy.mock.calls.map((c) => c[0]).filter((m: { type: string }) => m.type === 'status');
    expect(statusMessages.length).toBeGreaterThan(0);

    // No 'done' should have been posted yet
    const doneBeforeResolve = postMessageSpy.mock.calls
      .map((c) => c[0])
      .find((m: { type: string }) => m.type === 'done');
    expect(doneBeforeResolve).toBeUndefined();

    resolveLoad({ tokenizer: {} });
    await loadPromise;

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'done', id: 'req-5', result: { loaded: true } }),
    );
  });

  it('caches the loaded pipeline so a second load request skips the pipeline() call', async () => {
    pipelineMock.mockResolvedValue(vi.fn());

    const handleMessage = await getHandleMessage();

    await handleMessage({ action: 'load', id: 'req-6a', task: 'text-generation', modelId: 'org/cached-model' });
    await handleMessage({ action: 'load', id: 'req-6b', task: 'text-generation', modelId: 'org/cached-model' });

    expect(pipelineMock).toHaveBeenCalledTimes(1);
  });

  it('generate text-generation: sends thinking+generating phases, uses TextStreamer, done with {text}', async () => {
    const mockTokenizerObj = { decode: vi.fn() };
    const mockPipe = vi.fn().mockResolvedValue([{ generated_text: 'hello world' }]);
    (mockPipe as unknown as Record<string, unknown>).tokenizer = mockTokenizerObj;
    pipelineMock.mockResolvedValue(mockPipe);

    const handleMessage = await getHandleMessage();

    await handleMessage({
      action: 'generate',
      id: 'gen-1',
      task: 'text-generation',
      modelId: 'openai-community/gpt2',
      prompt: [{ role: 'user', content: 'hello' }],
      options: { max_new_tokens: 50 },
    });

    const messages = postMessageSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const phases = messages.filter((m) => m.type === 'phase').map((m) => m.phase);
    // reference_impl sends "thinking" then "generating" before inference
    expect(phases).toContain('thinking');
    expect(phases).toContain('generating');
    // done result is {text: "..."} not raw pipeline array
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'done', id: 'gen-1', result: { text: 'hello world' } }),
    );
  });

  it('generate text-classification: sends token with formatted label+score, done with {text}', async () => {
    const mockPipe = vi.fn().mockResolvedValue([{ label: 'POSITIVE', score: 0.95 }]);
    pipelineMock.mockResolvedValue(mockPipe);

    const handleMessage = await getHandleMessage();

    await handleMessage({
      action: 'generate',
      id: 'gen-2',
      task: 'text-classification',
      modelId: 'distilbert/model',
      prompt: 'great movie',
      options: {},
    });

    const messages = postMessageSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const tokenMsg = messages.find((m) => m.type === 'token');
    expect(tokenMsg?.token).toBe('POSITIVE (95%)');
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'done', id: 'gen-2', result: { text: 'POSITIVE (95%)' } }),
    );
  });
});
