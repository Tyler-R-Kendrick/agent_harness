import { describe, expect, it, vi, beforeEach } from 'vitest';
import { searchBrowserModels, pickBestDtype, ONNX_DTYPE_PREFERENCE } from './huggingFaceRegistry';

const fetchMock = vi.fn();
const getAvailableDtypesMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);
vi.mock('@huggingface/transformers', () => ({
  ModelRegistry: {
    get_available_dtypes: (...args: unknown[]) => getAvailableDtypesMock(...args),
  },
}));

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
    expect(pickBestDtype(['onnx/model_q4.onnx', 'onnx/model.onnx'])).toBe('q4');
  });

  it('prefers higher-priority dtypes', () => {
    expect(pickBestDtype(['onnx/model.onnx', 'onnx/model_q4f16.onnx'])).toBe('q4f16');
  });

  it('falls back through the preference list', () => {
    expect(pickBestDtype(['onnx/model.onnx'])).toBe('fp32');
  });

  it('recognizes the q8 quantized filename used by Transformers.js', () => {
    expect(pickBestDtype(['onnx/model_quantized.onnx'])).toBe('q8');
  });

  it('returns null when no ONNX model files are present', () => {
    expect(pickBestDtype(['tokenizer.json', 'config.json'])).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(pickBestDtype([])).toBeNull();
  });

  it('covers all preference entries', () => {
    for (const dtype of ONNX_DTYPE_PREFERENCE) {
      const file = dtype === 'fp32'
        ? 'onnx/model.onnx'
        : dtype === 'q8'
          ? 'onnx/model_quantized.onnx'
          : `onnx/model_${dtype}.onnx`;
      expect(pickBestDtype([file])).toBe(dtype);
    }
  });
});

describe('searchBrowserModels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
    getAvailableDtypesMock.mockReset();
    getAvailableDtypesMock.mockResolvedValue(['q4']);
  });

  it('requests the HF API with reference_impl filters', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [makeEntry()],
    });

    await searchBrowserModels('', 'text-generation');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('library')).toBe('transformers.js');
    expect(url.searchParams.get('tags')).toBe('onnx');
    expect(url.searchParams.get('sort')).toBe('downloads');
    expect(url.searchParams.get('direction')).toBe('-1');
    expect(url.searchParams.get('full')).toBe('true');
    expect(url.searchParams.get('limit')).toBe('100');
  });

  it('passes pipeline_tag when task is provided', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [makeEntry()] });

    await searchBrowserModels('', 'text-classification');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('pipeline_tag')).toBe('text-classification');
  });

  it('omits pipeline_tag when no task filter is selected', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [makeEntry()] });

    await searchBrowserModels('', '');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('pipeline_tag')).toBeNull();
  });

  it('passes search param when search string is non-empty', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [makeEntry()] });

    await searchBrowserModels('qwen', 'text-generation');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('search')).toBe('qwen');
  });

  it('filters out models with no loadable browser dtypes', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        makeEntry({ id: 'org/good', siblings: [{ rfilename: 'onnx/model_q4.onnx' }] }),
        makeEntry({ id: 'org/bad', siblings: [{ rfilename: 'tokenizer.json' }] }),
      ],
    });
    getAvailableDtypesMock.mockImplementation(async (id: string) => {
      if (id === 'org/good') return ['q4'];
      return [];
    });

    const results = await searchBrowserModels('', 'text-generation');

    expect(results.map((m) => m.id)).toEqual(['org/good']);
  });

  it('falls back to sibling ONNX files when dtype probing returns no dtypes', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [makeEntry({ id: 'org/fallback', siblings: [{ rfilename: 'onnx/model_q4.onnx' }] })],
    });
    getAvailableDtypesMock.mockResolvedValue([]);

    const results = await searchBrowserModels('', 'text-generation');

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('org/fallback');
    expect(results[0].dtype).toBe('q4');
  });

  it('silently excludes gated or inaccessible models without logging errors', async () => {
    // Entry has no ONNX siblings → slow path → get_available_dtypes fails → silently excluded
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [makeEntry({ id: 'org/gated', siblings: [] })],
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getAvailableDtypesMock.mockRejectedValue(new Error('401 Unauthorized'));

    const results = await searchBrowserModels('', 'text-generation');

    expect(results).toHaveLength(0);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('includes models that only have fp32 ONNX files', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [makeEntry({ siblings: [{ rfilename: 'onnx/model.onnx' }] })],
    });
    getAvailableDtypesMock.mockResolvedValue(['fp32']);

    const results = await searchBrowserModels('', 'text-generation');

    expect(results).toHaveLength(1);
    expect(results[0].dtype).toBe('fp32');
  });

  it('includes models that only have q8 ONNX files', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [makeEntry({ siblings: [{ rfilename: 'onnx/model_quantized.onnx' }] })],
    });
    getAvailableDtypesMock.mockResolvedValue(['q8']);

    const results = await searchBrowserModels('', 'text-generation');

    expect(results).toHaveLength(1);
    expect(results[0].dtype).toBe('q8');
  });

  it('stores the most-preferred dtype from the model siblings', async () => {
    // Fast path picks the best dtype from siblings; ModelRegistry is not consulted.
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        makeEntry({
          id: 'org/multi',
          siblings: [
            { rfilename: 'onnx/model.onnx' },
            { rfilename: 'onnx/model_q4.onnx' },
            { rfilename: 'onnx/model_q4f16.onnx' },
          ],
        }),
      ],
    });

    const results = await searchBrowserModels('', 'text-generation');

    expect(results[0].dtype).toBe('q4'); // q4 ranks above q4f16 and fp32
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

  it('uses ONNX siblings directly without calling ModelRegistry for models with visible ONNX files', async () => {
    // Fast path: siblings already reveal the ONNX dtype — no extra network requests needed.
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        makeEntry({ id: 'author/one', siblings: [{ rfilename: 'onnx/model_q4.onnx' }] }),
        makeEntry({ id: 'author/two', siblings: [{ rfilename: 'onnx/model_quantized.onnx' }] }),
      ],
    });

    await searchBrowserModels('', 'text-generation');

    expect(getAvailableDtypesMock).not.toHaveBeenCalled();
  });

  it('probes ModelRegistry only for models that have no visible ONNX siblings', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [makeEntry({ id: 'author/probe-needed', siblings: [] })],
    });
    getAvailableDtypesMock.mockResolvedValue(['q4']);

    await searchBrowserModels('', 'text-generation');

    expect(getAvailableDtypesMock).toHaveBeenCalledOnce();
    expect(getAvailableDtypesMock).toHaveBeenCalledWith('author/probe-needed');
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

  it('returns only the requested number of validated models', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        makeEntry({ id: 'author/one' }),
        makeEntry({ id: 'author/two' }),
      ],
    });
    getAvailableDtypesMock.mockResolvedValue(['q4']);

    const results = await searchBrowserModels('', '', 1);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('author/one');
  });

  it('overfetches candidates to preserve requested result count after filtering', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });

    await searchBrowserModels('', '', 10);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('limit')).toBe('40');
  });
});
