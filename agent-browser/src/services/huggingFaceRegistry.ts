import type { HFModel } from '../types';

const HUGGING_FACE_MODELS_API = 'https://huggingface.co/api/models';

function toModel(entry: Record<string, unknown>): HFModel {
  const id = typeof entry.id === 'string' ? entry.id : String(entry.modelId ?? '');
  const tags = Array.isArray(entry.tags) ? entry.tags.map(String) : [];
  const author = id.includes('/') ? id.split('/')[0] : 'unknown';
  const name = id.includes('/') ? id.split('/').slice(-1)[0] : id;
  return {
    id,
    name,
    author,
    task: typeof entry.pipeline_tag === 'string' ? entry.pipeline_tag : 'text-generation',
    downloads: typeof entry.downloads === 'number' ? entry.downloads : 0,
    likes: typeof entry.likes === 'number' ? entry.likes : 0,
    tags,
    sizeMB: null,
    status: 'available',
  };
}

export async function searchBrowserModels(search: string, task: string, limit = 12, signal?: AbortSignal): Promise<HFModel[]> {
  const url = new URL(HUGGING_FACE_MODELS_API);
  // Filter to Transformers.js-compatible ONNX models that run in the browser.
  url.searchParams.set('library', 'transformers.js');
  if (task) url.searchParams.set('pipeline_tag', task);
  if (search.trim()) url.searchParams.set('search', search.trim());
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Model registry error: ${response.status}`);
  }
  const payload = (await response.json()) as Record<string, unknown>[];
  return payload.filter((entry) => {
    const id = typeof entry.id === 'string' ? entry.id : typeof entry.modelId === 'string' ? entry.modelId : '';
    return Boolean(id);
  }).map(toModel);
}
