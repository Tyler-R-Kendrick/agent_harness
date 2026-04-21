import type { HFModel } from '../types';

const HUGGING_FACE_MODELS_API = 'https://huggingface.co/api/models';

export function inferBrowserModelContextWindow(modelId: string, task: string): number | undefined {
  const normalizedId = modelId.toLowerCase();

  if (normalizedId.includes('qwen3-0.6b-onnx')) {
    return 2_048;
  }

  if (task === 'text-generation' || task === 'text2text-generation') {
    return 4_096;
  }

  return undefined;
}

export function inferBrowserModelMaxOutputTokens(task: string): number | undefined {
  if (task === 'text-generation' || task === 'text2text-generation' || task === 'summarization' || task === 'translation') {
    return 512;
  }

  return 128;
}

export async function searchBrowserModels(search: string, task: string, limit = 25, signal?: AbortSignal): Promise<HFModel[]> {
  const url = new URL(HUGGING_FACE_MODELS_API);
  url.searchParams.set('library', 'transformers.js');
  // Filter for onnx tag — models need ONNX weights for in-browser inference
  url.searchParams.set('tags', 'onnx');
  url.searchParams.set('limit', String(Math.max(1, limit)));
  url.searchParams.set('sort', 'downloads');
  url.searchParams.set('direction', '-1');
  if (task) url.searchParams.set('pipeline_tag', task);
  if (search.trim()) url.searchParams.set('search', search.trim());

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Model registry error: ${response.status}`);
  }
  const data = (await response.json()) as Record<string, unknown>[];
  return data.map((m) => {
    const id = typeof m.id === 'string' ? m.id : typeof m.modelId === 'string' ? m.modelId : '';
    const author = id.includes('/') ? id.split('/')[0] : 'unknown';
    const name = id.includes('/') ? id.split('/').slice(-1)[0] : id;
    const pipelineTag = typeof m.pipeline_tag === 'string' ? m.pipeline_tag : 'unknown';
    const safetensors = m.safetensors as Record<string, unknown> | undefined;
    const totalBytes = typeof safetensors?.total === 'number' ? safetensors.total : 0;
    return {
      id,
      name,
      author,
      task: pipelineTag,
      downloads: typeof m.downloads === 'number' ? m.downloads : 0,
      likes: typeof m.likes === 'number' ? m.likes : 0,
      tags: Array.isArray(m.tags) ? m.tags.map(String).slice(0, 8) : [],
      sizeMB: totalBytes ? Math.round(totalBytes / 1e6) : 0,
      contextWindow: inferBrowserModelContextWindow(id, pipelineTag),
      maxOutputTokens: inferBrowserModelMaxOutputTokens(pipelineTag),
      status: 'available',
    } satisfies HFModel;
  });
}
