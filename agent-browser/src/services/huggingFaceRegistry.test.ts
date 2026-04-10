import { describe, expect, it, vi, beforeEach } from 'vitest';
import { searchBrowserModels, pickBestDtype, ONNX_DTYPE_PREFERENCE } from './huggingFaceRegistry';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

function makeEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'org/model',
    pipeline_tag: 'text-generation',
    downloads: 100,
    likes: 10,
    tags: ['transformers.js'],
    siblings: [{ rfilename: 'onnx/model_q4.onnx' }],
    ...overrides,
  };
}

describe('pickBestDtype', () => {
  it('returns q4 when model_q4.onnx exists', () => {
    expect(pickBestDtype(['onnx/model_q4.onnx', 'onnx/model_fp32.onnx'])).toBe('q4');
  });

  it('prefers higher-priority dtypes', () => {
    expect(pickBestDtype(['onnx/model_fp32.onnx', 'onnx/model_q4f16.onnx'])).toBe('q4f16');
  });

  it('falls back through the preference list', () => {
    expect(pickBestDtype(['onnx/model_fp32.onnx'])).toBe('fp32');
  });

  it('returns null when no ONNX model files are present', () => {
    expect(pickBestDtype(['tokenizer.json', 'config.json'])).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(pickBestDtype([])).toBeNull();
  });

  it('covers all preference entries', () => {
    for (const dtype of ONNX_DTYPE_PREFERENCE) {
      expect(pickBestDtype([`onnx/model_${dtype}.onnx`])).toBe(dtype);
    }
  });
});

describe('searchBrowserModels', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('requests the HF API with library=transformers.js and full=true', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [makeEntry()],
    });

    await searchBrowserModels('', 'text-generation');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('library')).toBe('transformers.js');
    expect(url.searchParams.get('full')).toBe('true');
  });

  it('passes pipeline_tag when task is provided', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [makeEntry()] });

    await searchBrowserModels('', 'text-classification');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('pipeline_tag')).toBe('text-classification');
  });

  it('passes search param when search string is non-empty', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [makeEntry()] });

    await searchBrowserModels('qwen', 'text-generation');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('search')).toBe('qwen');
  });

  it('filters out models that have no ONNX model siblings', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        makeEntry({ id: 'org/good', siblings: [{ rfilename: 'onnx/model_q4.onnx' }] }),
        makeEntry({ id: 'org/bad', siblings: [{ rfilename: 'tokenizer.json' }] }),
        makeEntry({ id: 'org/no-siblings', siblings: undefined }), // siblings field absent from API response
      ],
    });

    const results = await searchBrowserModels('', 'text-generation');

    expect(results.map((m) => m.id)).toEqual(['org/good']);
  });

  it('includes models that only have fp32 ONNX files', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [makeEntry({ siblings: [{ rfilename: 'onnx/model_fp32.onnx' }] })],
    });

    const results = await searchBrowserModels('', 'text-generation');

    expect(results).toHaveLength(1);
    expect(results[0].dtype).toBe('fp32');
  });

  it('stores the best available dtype on the model', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        makeEntry({
          id: 'org/multi',
          siblings: [
            { rfilename: 'onnx/model_fp32.onnx' },
            { rfilename: 'onnx/model_q4.onnx' },
            { rfilename: 'onnx/model_q4f16.onnx' },
          ],
        }),
      ],
    });

    const results = await searchBrowserModels('', 'text-generation');

    expect(results[0].dtype).toBe('q4');
  });

  it('maps model fields correctly', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        makeEntry({
          id: 'author/model-name',
          pipeline_tag: 'summarization',
          downloads: 999,
          likes: 42,
          siblings: [{ rfilename: 'onnx/model_q4.onnx' }],
        }),
      ],
    });

    const [model] = await searchBrowserModels('', 'summarization');

    expect(model.id).toBe('author/model-name');
    expect(model.author).toBe('author');
    expect(model.name).toBe('model-name');
    expect(model.task).toBe('summarization');
    expect(model.downloads).toBe(999);
    expect(model.likes).toBe(42);
  });

  it('respects the AbortSignal', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });

    const controller = new AbortController();
    await searchBrowserModels('', 'text-generation', 12, controller.signal);

    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ signal: controller.signal }));
  });

  it('throws a descriptive error on non-ok responses', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    await expect(searchBrowserModels('', 'text-generation')).rejects.toThrow('503');
  });
});
