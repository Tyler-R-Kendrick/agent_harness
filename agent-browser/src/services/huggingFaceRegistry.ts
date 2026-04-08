import type { HFModel } from '../types';

const HUGGING_FACE_MODELS_API = 'https://huggingface.co/api/models';

function hasOnnxTag(tags: string[] | undefined): boolean {
  return (tags ?? []).some((tag) => tag.toLowerCase().includes('onnx'));
}

function isBrowserRunnable(entry: Record<string, unknown>, task?: string): boolean {
  const tags = Array.isArray(entry.tags) ? entry.tags.map(String) : [];
  const pipelineTag = typeof entry.pipeline_tag === 'string' ? entry.pipeline_tag : '';
  const modelId = typeof entry.id === 'string' ? entry.id : typeof entry.modelId === 'string' ? entry.modelId : '';
  return Boolean(modelId) && hasOnnxTag(tags) && (!task || pipelineTag === task || tags.includes(task));
}

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

export async function searchBrowserModels(search: string, task: string, limit = 12): Promise<HFModel[]> {
  const url = new URL(HUGGING_FACE_MODELS_API);
  if (search.trim()) url.searchParams.set('search', search.trim());
  url.searchParams.set('limit', String(limit * 3));
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Hugging Face registry error: ${response.status}`);
  }
  const payload = (await response.json()) as Record<string, unknown>[];
  return payload.filter((entry) => isBrowserRunnable(entry, task)).slice(0, limit).map(toModel);
}
