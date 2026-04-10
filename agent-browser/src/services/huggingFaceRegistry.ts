import type { HFModel, OnnxDtype } from '../types';

const HUGGING_FACE_MODELS_API = 'https://huggingface.co/api/models';

/**
 * Ordered list of ONNX quantization dtypes from most preferred (smallest/fastest in browser)
 * to least preferred. Each maps to a file named `onnx/model_<dtype>.onnx`.
 */
export const ONNX_DTYPE_PREFERENCE: readonly OnnxDtype[] = ['q4', 'q4f16', 'int8', 'uint8', 'fp16', 'q8', 'bnb4', 'fp32'];

/**
 * Given a list of file paths in a model repo (siblings' rfilename values),
 * returns the best available ONNX dtype or null if no loadable ONNX model files exist.
 */
export function pickBestDtype(filenames: string[]): OnnxDtype | null {
  for (const dtype of ONNX_DTYPE_PREFERENCE) {
    if (filenames.some((f) => f === `onnx/model_${dtype}.onnx`)) {
      return dtype;
    }
  }
  return null;
}

function toModel(entry: Record<string, unknown>, dtype: OnnxDtype): HFModel {
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
    dtype,
  };
}

function getSiblingFilenames(entry: Record<string, unknown>): string[] {
  if (!Array.isArray(entry.siblings)) return [];
  return entry.siblings
    .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
    .map((s) => (typeof s['rfilename'] === 'string' ? s['rfilename'] : ''))
    .filter(Boolean);
}

export async function searchBrowserModels(search: string, task: string, limit = 12, signal?: AbortSignal): Promise<HFModel[]> {
  const url = new URL(HUGGING_FACE_MODELS_API);
  // full=true returns siblings (file listing) so we can verify ONNX files actually exist.
  url.searchParams.set('library', 'transformers.js');
  url.searchParams.set('full', 'true');
  if (task) url.searchParams.set('pipeline_tag', task);
  if (search.trim()) url.searchParams.set('search', search.trim());
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Model registry error: ${response.status}`);
  }
  const payload = (await response.json()) as Record<string, unknown>[];
  const results: HFModel[] = [];
  for (const entry of payload) {
    const id = typeof entry.id === 'string' ? entry.id : typeof entry.modelId === 'string' ? entry.modelId : '';
    if (!id) continue;
    const filenames = getSiblingFilenames(entry);
    const dtype = pickBestDtype(filenames);
    if (!dtype) continue; // model has no loadable ONNX file — skip it
    results.push(toModel(entry, dtype));
  }
  return results;
}

