import { describe, expect, it, vi, beforeEach } from 'vitest';
import { searchBrowserModels } from './huggingFaceRegistry';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function makeEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'org/model',
    pipeline_tag: 'text-generation',
    downloads: 100,
    likes: 10,
    tags: ['transformers.js', 'onnx'],
    ...overrides,
  };
}

describe('searchBrowserModels', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('requests the HF API with reference_impl filters', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [makeEntry()] });

    await searchBrowserModels('', 'text-generation');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('library')).toBe('transformers.js');
    expect(url.searchParams.get('tags')).toBe('onnx');
    expect(url.searchParams.get('sort')).toBe('downloads');
    expect(url.searchParams.get('direction')).toBe('-1');
    expect(url.searchParams.get('limit')).toBe('25');
  });

  it('passes pipeline_tag when task is provided', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [makeEntry()] });

    await searchBrowserModels('', 'text-classification');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('pipeline_tag')).toBe('text-classification');
  });

  it('omits pipeline_tag when no task is given', async () => {
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

  it('maps model fields correctly from the API response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        makeEntry({
          id: 'author/model-name',
          pipeline_tag: 'summarization',
          downloads: 999,
          likes: 42,
          tags: ['transformers.js', 'onnx'],
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
    expect(model.status).toBe('available');
  });

  it('returns sizeMB from safetensors.total if available', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [makeEntry({ safetensors: { total: 500_000_000 } })],
    });

    const [model] = await searchBrowserModels('', '');

    expect(model.sizeMB).toBe(500);
  });

  it('returns sizeMB of 0 when safetensors is absent', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [makeEntry()] });

    const [model] = await searchBrowserModels('', '');

    expect(model.sizeMB).toBe(0);
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

  it('returns all results from the API without filtering', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        makeEntry({ id: 'org/one' }),
        makeEntry({ id: 'org/two' }),
        makeEntry({ id: 'org/three' }),
      ],
    });

    const results = await searchBrowserModels('', '', 10);

    // No filtering happens — all entries from the HF API are returned
    expect(results).toHaveLength(3);
  });

  it('does not call ModelRegistry or make extra network requests per model', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [makeEntry({ id: 'org/a' }), makeEntry({ id: 'org/b' })],
    });

    await searchBrowserModels('', 'text-generation');

    // Only one fetch call — no per-model dtype probing
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
