import { describe, expect, it, vi, beforeEach } from 'vitest';

const textStreamerSpy = vi.fn(function MockTextStreamer(
  this: { kind: string; options: unknown },
  _tokenizer: unknown,
  options: unknown,
) {
  this.kind = 'streamer';
  this.options = options;
});

vi.mock('@huggingface/transformers', () => ({
  TextStreamer: textStreamerSpy,
}));

describe('browser inference runtime helpers', () => {
  beforeEach(() => {
    textStreamerSpy.mockClear();
  });

  it('builds Transformers v4 text-generation options with a TextStreamer and return_full_text disabled', async () => {
    const { buildPipelineRunOptions } = await import('./browserInferenceRuntime');

    const tokenizer = { name: 'tokenizer' };
    const options = buildPipelineRunOptions('text-generation', { temperature: 0.3 }, tokenizer as never, vi.fn());

    expect(textStreamerSpy).toHaveBeenCalledWith(
      tokenizer,
      expect.objectContaining({
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: expect.any(Function),
      }),
    );
    expect(options).toEqual(
      expect.objectContaining({
        temperature: 0.3,
        return_full_text: false,
        streamer: expect.objectContaining({ kind: 'streamer' }),
      }),
    );
  });

  it('avoids text-generation-only streamer options for non-generative pipelines', async () => {
    const { buildPipelineRunOptions } = await import('./browserInferenceRuntime');

    const options = buildPipelineRunOptions('text-classification', { top_k: 2 }, null, vi.fn());

    expect(textStreamerSpy).not.toHaveBeenCalled();
    expect(options).toEqual({ top_k: 2 });
  });

  it('formats structured non-streaming pipeline results into readable text', async () => {
    const { formatBrowserInferenceResult } = await import('./browserInferenceRuntime');

    expect(formatBrowserInferenceResult([{ label: 'POSITIVE', score: 0.9123 }])).toBe('POSITIVE (91.2%)');
    expect(formatBrowserInferenceResult([{ summary_text: 'Short summary' }])).toBe('Short summary');
    expect(formatBrowserInferenceResult({ answer: 'The answer', score: 0.77 })).toBe('The answer');
  });

  it('buildPipelineLoadOptions does not include a device or dtype key — Transformers.js auto-selects both', async () => {
    const { buildPipelineLoadOptions } = await import('./browserInferenceRuntime');

    const opts = buildPipelineLoadOptions('text-generation', 'openai-community/gpt2');

    expect(opts).not.toHaveProperty('device');
    expect(opts).not.toHaveProperty('dtype');
    expect(opts).toHaveProperty('progress_callback');
  });

  it('buildPipelineLoadOptions pins Qwen3-0.6B-ONNX text-generation loads to q4', async () => {
    const { buildPipelineLoadOptions } = await import('./browserInferenceRuntime');

    const opts = buildPipelineLoadOptions('text-generation', 'onnx-community/Qwen3-0.6B-ONNX');

    expect(opts).toMatchObject({ dtype: 'q4' });
    expect(opts).not.toHaveProperty('device');
    expect(opts).toMatchObject({
      session_options: {
        enableCpuMemArena: false,
        enableMemPattern: false,
        graphOptimizationLevel: 'disabled',
        extra: {
          session: {
            use_ort_model_bytes_directly: '0',
          },
        },
      },
    });
  });

  it('buildPipelineLoadOptions accepts a progress callback and invokes it with formatted phase strings', async () => {
    const { buildPipelineLoadOptions } = await import('./browserInferenceRuntime');

    const phases: string[] = [];
    const opts = buildPipelineLoadOptions('text-generation', 'openai-community/gpt2', (phase) => phases.push(phase));
    const cb = (opts as { progress_callback: (p: Record<string, unknown>) => void }).progress_callback;

    cb({ status: 'progress', file: 'onnx/model.onnx', progress: 42 });

    expect(phases.length).toBeGreaterThan(0);
  });

  it('coalesces dense load progress updates into coarse buckets', async () => {
    const { buildPipelineLoadOptions } = await import('./browserInferenceRuntime');

    const phases: string[] = [];
    const opts = buildPipelineLoadOptions('text-generation', 'onnx-community/Qwen3-0.6B-ONNX', (phase) => phases.push(phase));
    const cb = (opts as { progress_callback: (p: Record<string, unknown>) => void }).progress_callback;

    cb({ status: 'progress', file: 'onnx/model_q4.onnx', progress: 1 });
    cb({ status: 'progress', file: 'onnx/model_q4.onnx', progress: 2 });
    cb({ status: 'progress', file: 'onnx/model_q4.onnx', progress: 4 });
    cb({ status: 'progress', file: 'onnx/model_q4.onnx', progress: 6 });

    expect(phases).toEqual([
      'onnx/model_q4.onnx · 0%',
      'onnx/model_q4.onnx · 5%',
    ]);
  });

  it('compacts oversized chat prompts while preserving system guidance and the latest turn', async () => {
    const { compactPromptForBrowserInference } = await import('./browserInferenceRuntime');

    const prompt = [
      { role: 'system', content: `rules:${'s'.repeat(6_000)}` },
      { role: 'user', content: `old:${'u'.repeat(5_000)}` },
      { role: 'assistant', content: `older:${'a'.repeat(4_000)}` },
      { role: 'user', content: `latest:${'z'.repeat(2_000)}` },
    ];

    const compacted = compactPromptForBrowserInference(prompt, 5_000) as Array<{ role: string; content: string }>;
    const totalChars = compacted.reduce((sum, message) => sum + message.content.length, 0);

    expect(totalChars).toBeLessThanOrEqual(5_000);
    expect(compacted[0]).toMatchObject({ role: 'system' });
    expect(compacted.at(-1)?.content).toContain('latest:');
    expect(compacted.some((message) => message.content.includes('\n...\n'))).toBe(true);
  });

  it('rewrites raw ORT overflow messages into actionable local-model guidance', async () => {
    const { normalizeBrowserInferenceErrorMessage } = await import('./browserInferenceRuntime');

    const message = normalizeBrowserInferenceErrorMessage(new Error('failed to call OrtRun(). ERROR_CODE: 1, ERROR_MESSAGE: Integer overflow'));

    expect(message).toContain('Local model input exceeded the browser inference limits');
  });

  it('shouldDisableThinking flags Qwen3 thinking models and leaves other models thinking-free by default', async () => {
    const { shouldDisableThinking } = await import('./browserInferenceRuntime');

    expect(shouldDisableThinking('onnx-community/Qwen3-0.6B-ONNX')).toBe(true);
    expect(shouldDisableThinking('Qwen/Qwen3-1.7B')).toBe(true);
    expect(shouldDisableThinking('openai-community/gpt2')).toBe(false);
    expect(shouldDisableThinking('HuggingFaceTB/SmolLM-135M')).toBe(false);
  });
});
