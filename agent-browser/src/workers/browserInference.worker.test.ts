import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const pipelineMock = vi.fn();
const postMessageSpy = vi.fn();
const textStreamerMock = vi.fn(function MockTextStreamer(
  this: { kind: string; opts: unknown },
  _tokenizer: unknown,
  opts: unknown,
) {
  this.kind = 'streamer';
  this.opts = opts;
});
const transformerEnv = { useBrowserCache: true, backends: { onnx: { wasm: { proxy: false, numThreads: 4 } } } };

vi.stubGlobal('postMessage', postMessageSpy);

async function getHandleMessage() {
  const mod = await import('./browserInference.worker');
  return mod.handleMessage;
}

let handleMessage: Awaited<ReturnType<typeof getHandleMessage>>;

/**
 * Each test resets modules so the worker's internal pipeline cache is cleared and
 * the pipeline mock is rewired through the fresh module graph.
 */
beforeEach(async () => {
  pipelineMock.mockReset();
  postMessageSpy.mockReset();
  textStreamerMock.mockClear();
  vi.stubGlobal('navigator', {});
  vi.resetModules();
  transformerEnv.useBrowserCache = true;
  transformerEnv.backends.onnx.wasm.proxy = false;
  transformerEnv.backends.onnx.wasm.numThreads = 4;
  vi.doMock('@huggingface/transformers', () => ({
    pipeline: (...args: unknown[]) => pipelineMock(...args),
    TextStreamer: textStreamerMock,
    env: transformerEnv,
  }));
  handleMessage = await getHandleMessage();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Create a mock text-generation pipe with a stubbed tokenizer. */
function makePipeWithTokenizer() {
  const pipe = vi.fn();
  (pipe as unknown as Record<string, unknown>).tokenizer = { decode: vi.fn() };
  pipelineMock.mockResolvedValue(pipe);
  return pipe;
}

/** All messages posted during the current test. */
function postedMessages() {
  return postMessageSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
}

describe('browserInference.worker handleMessage (reference_impl action protocol)', () => {
  it('loads gpt-2: calls pipeline and posts done with {loaded:true} — matching reference_impl', async () => {
    pipelineMock.mockResolvedValue(vi.fn());

    await handleMessage({ action: 'load', id: 'req-1', task: 'text-generation', modelId: 'openai-community/gpt2' });

    expect(pipelineMock).toHaveBeenCalledWith(
      'text-generation',
      'openai-community/gpt2',
      expect.objectContaining({ progress_callback: expect.any(Function) }),
    );
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'done', id: 'req-1', result: { loaded: true } }),
    );
    expect(postedMessages().every((m) => m.type !== 'error')).toBe(true);
  });

  it('loads without forcing a backend device or dtype so Transformers.js can auto-select', async () => {
    pipelineMock.mockResolvedValue(vi.fn());

    await handleMessage({ action: 'load', id: 'req-2', task: 'text-generation', modelId: 'openai-community/gpt2' });

    expect(pipelineMock).toHaveBeenCalledTimes(1);
    const loadOptions = pipelineMock.mock.calls[0][2] as Record<string, unknown>;
    expect(loadOptions).not.toHaveProperty('device');
    expect(loadOptions).not.toHaveProperty('dtype');
    expect(loadOptions).toHaveProperty('progress_callback');
  });

  it('loads Qwen text-generation with q4 dtype to keep browser memory bounded', async () => {
    pipelineMock.mockResolvedValue(vi.fn());
    Object.defineProperty(globalThis.navigator, 'gpu', { configurable: true, value: {} });

    await handleMessage({ action: 'load', id: 'req-qwen', task: 'text-generation', modelId: 'onnx-community/Qwen3-0.6B-ONNX' });

    expect(pipelineMock).toHaveBeenCalledTimes(1);
    const loadOptions = pipelineMock.mock.calls[0][2] as Record<string, unknown>;
    expect(loadOptions).toMatchObject({
      device: 'webgpu',
      dtype: 'q4',
      progress_callback: expect.any(Function),
      session_options: {
        enableCpuMemArena: false,
        enableMemPattern: false,
        graphOptimizationLevel: 'disabled',
        extra: { session: { use_ort_model_bytes_directly: '0' } },
      },
    });
    expect(transformerEnv.backends.onnx.wasm).toMatchObject({ proxy: true, numThreads: 1 });
    expect(transformerEnv.useBrowserCache).toBe(true);
  });

  it('posts error:{error} (not msg) when pipeline loading fails — matching reference_impl', async () => {
    pipelineMock.mockRejectedValue(new Error('ONNX file not found'));

    await expect(
      handleMessage({ action: 'load', id: 'req-3', task: 'text-generation', modelId: 'openai-community/gpt2' }),
    ).resolves.not.toThrow();

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

    const loadPromise = handleMessage({ action: 'load', id: 'req-5', task: 'text-generation', modelId: 'openai-community/gpt2' });

    expect(postedMessages().filter((m) => m.type === 'status').length).toBeGreaterThan(0);
    expect(postedMessages().find((m) => m.type === 'done')).toBeUndefined();

    resolveLoad({ tokenizer: {} });
    await loadPromise;

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'done', id: 'req-5', result: { loaded: true } }),
    );
  });

  it('caches the loaded pipeline so a second load request skips the pipeline() call', async () => {
    pipelineMock.mockResolvedValue(vi.fn());

    await handleMessage({ action: 'load', id: 'req-6a', task: 'text-generation', modelId: 'org/cached-model' });
    await handleMessage({ action: 'load', id: 'req-6b', task: 'text-generation', modelId: 'org/cached-model' });

    expect(pipelineMock).toHaveBeenCalledTimes(1);
  });

  it('generate text-generation: sends thinking+generating phases, uses TextStreamer, done with {text}', async () => {
    const mockPipe = makePipeWithTokenizer();
    mockPipe.mockResolvedValue([{ generated_text: 'hello world' }]);

    await handleMessage({
      action: 'generate',
      id: 'gen-1',
      task: 'text-generation',
      modelId: 'openai-community/gpt2',
      prompt: [{ role: 'user', content: 'hello' }],
      options: { max_new_tokens: 50 },
    });

    const phases = postedMessages().filter((m) => m.type === 'phase').map((m) => m.phase);
    expect(phases).toContain('thinking');
    expect(phases).toContain('generating');
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'done', id: 'gen-1', result: { text: 'hello world' } }),
    );
  });

  it('compacts oversized text-generation prompts before calling the pipeline', async () => {
    const mockPipe = makePipeWithTokenizer();
    mockPipe.mockResolvedValue([{ generated_text: 'trimmed' }]);

    await handleMessage({
      action: 'generate',
      id: 'gen-big',
      task: 'text-generation',
      modelId: 'openai-community/gpt2',
      prompt: [
        { role: 'system', content: `rules:${'s'.repeat(8_000)}` },
        { role: 'user', content: `older:${'u'.repeat(7_000)}` },
        { role: 'assistant', content: `prior:${'a'.repeat(7_000)}` },
        { role: 'user', content: `latest:${'z'.repeat(3_000)}` },
      ],
      options: {},
    });

    const promptArg = mockPipe.mock.calls[0][0] as Array<{ role: string; content: string }>;
    const totalChars = promptArg.reduce((sum, m) => sum + m.content.length, 0);
    expect(totalChars).toBeLessThanOrEqual(12_000);
    expect(promptArg.at(-1)?.content).toContain('latest:');
  });

  it('maps ORT integer overflow failures to a clearer local-model error', async () => {
    const mockPipe = makePipeWithTokenizer();
    mockPipe.mockRejectedValue(new Error('failed to call OrtRun(). ERROR_CODE: 1, ERROR_MESSAGE: Integer overflow'));

    await handleMessage({
      action: 'generate',
      id: 'gen-overflow',
      task: 'text-generation',
      modelId: 'openai-community/gpt2',
      prompt: [{ role: 'user', content: 'hello' }],
      options: {},
    });

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        id: 'gen-overflow',
        error: expect.stringContaining('Local model input exceeded the browser inference limits'),
      }),
    );
  });

  it('generate text-classification: sends token with formatted label+score, done with {text}', async () => {
    const mockPipe = vi.fn().mockResolvedValue([{ label: 'POSITIVE', score: 0.95 }]);
    pipelineMock.mockResolvedValue(mockPipe);

    await handleMessage({
      action: 'generate',
      id: 'gen-2',
      task: 'text-classification',
      modelId: 'distilbert/model',
      prompt: 'great movie',
      options: {},
    });

    const tokenMsg = postedMessages().find((m) => m.type === 'token');
    expect(tokenMsg?.token).toBe('POSITIVE (95%)');
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'done', id: 'gen-2', result: { text: 'POSITIVE (95%)' } }),
    );
  });

  it('forwards enable_thinking, top_k, and min_p options into the text-generation pipe call', async () => {
    const mockPipe = makePipeWithTokenizer();
    mockPipe.mockResolvedValue([{ generated_text: 'ok' }]);

    await handleMessage({
      action: 'generate',
      id: 'gen-thinking',
      task: 'text-generation',
      modelId: 'onnx-community/Qwen3-0.6B-ONNX',
      prompt: [{ role: 'user', content: 'hi' }],
      options: { enable_thinking: false, top_k: 20, min_p: 0 },
    });

    const runOptions = mockPipe.mock.calls[0][1] as Record<string, unknown>;
    expect(runOptions).toMatchObject({
      top_k: 20,
      min_p: 0,
      tokenizer_encode_kwargs: { enable_thinking: false },
    });
    // Belt-and-braces: must NOT pass enable_thinking at the top level —
    // Transformers.js silently ignores it there.
    expect(runOptions).not.toHaveProperty('enable_thinking');
  });
});
