import { describe, expect, it, vi, beforeEach } from 'vitest';

const textStreamerSpy = vi.fn();

vi.mock('@huggingface/transformers', () => ({
  TextStreamer: textStreamerSpy,
}));

describe('browser inference runtime helpers', () => {
  beforeEach(() => {
    textStreamerSpy.mockReset();
    textStreamerSpy.mockImplementation((_tokenizer, options) => ({ kind: 'streamer', options }));
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
});
