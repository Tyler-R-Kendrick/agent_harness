import { ModelRegistry } from '@huggingface/transformers';
import type { HFModel, OnnxDtype } from '../types';

const HUGGING_FACE_MODELS_API = 'https://huggingface.co/api/models';

/**
 * Ordered list of ONNX quantization dtypes from most preferred (smallest/fastest in browser)
 * to least preferred.
 */
export const ONNX_DTYPE_PREFERENCE: readonly OnnxDtype[] = ['q4', 'q4f16', 'int8', 'uint8', 'fp16', 'q8', 'bnb4', 'fp32'];

const ONNX_DTYPE_SUFFIX: Record<OnnxDtype, string> = {
  q4: '_q4',
  q4f16: '_q4f16',
  int8: '_int8',
  uint8: '_uint8',
  fp16: '_fp16',
  q8: '_quantized',
  bnb4: '_bnb4',
  fp32: '',
};

function matchesOnnxFileForDtype(filename: string, dtype: OnnxDtype): boolean {
  const suffix = ONNX_DTYPE_SUFFIX[dtype];
  const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^onnx\\/[A-Za-z0-9_-]+${escapedSuffix}\\.onnx$`).test(filename);
}

/**
 * Given a list of file paths in a model repo (siblings' rfilename values),
 * returns the best available ONNX dtype or null if no loadable ONNX model files exist.
 */
export function pickBestDtype(filenames: string[]): OnnxDtype | null {
  for (const dtype of ONNX_DTYPE_PREFERENCE) {
    if (filenames.some((f) => matchesOnnxFileForDtype(f, dtype))) {
      return dtype;
    }
  }
  return null;
}

function pickPreferredAvailableDtype(dtypes: string[]): OnnxDtype | null {
  for (const dtype of ONNX_DTYPE_PREFERENCE) {
    if (dtypes.includes(dtype)) {
      return dtype;
    }
  }
  return null;
}

function getSiblingFilenames(entry: Record<string, unknown>): string[] {
  if (!Array.isArray(entry.siblings)) return [];
  return entry.siblings.flatMap((sibling) => {
    if (!sibling || typeof sibling !== 'object') return [];
    const filename = (sibling as { rfilename?: unknown }).rfilename;
    return typeof filename === 'string' ? [filename] : [];
  });
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

export async function searchBrowserModels(search: string, task: string, limit = 12, signal?: AbortSignal): Promise<HFModel[]> {
  const url = new URL(HUGGING_FACE_MODELS_API);
  // Match reference_impl query shape while still asking for siblings so we can verify files.
  url.searchParams.set('library', 'transformers.js');
  url.searchParams.set('tags', 'onnx');
  url.searchParams.set('sort', 'downloads');
  url.searchParams.set('direction', '-1');
  url.searchParams.set('full', 'true');
  if (task) url.searchParams.set('pipeline_tag', task);
  if (search.trim()) url.searchParams.set('search', search.trim());
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Model registry error: ${response.status}`);
  }
  const payload = (await response.json()) as Record<string, unknown>[];
  const results = await Promise.all(payload.map(async (entry) => {
    const id = typeof entry.id === 'string' ? entry.id : typeof entry.modelId === 'string' ? entry.modelId : '';
    if (!id) return null;

    try {
      const availableDtypes = await ModelRegistry.get_available_dtypes(id);
      const dtype = pickPreferredAvailableDtype(availableDtypes);
      if (!dtype) return null;
      return toModel(entry, dtype);
    } catch (error) {
      const fallbackDtype = pickBestDtype(getSiblingFilenames(entry));
      if (fallbackDtype) {
        console.warn(`Falling back to ONNX sibling inspection for ${id}`, error);
        return toModel(entry, fallbackDtype);
      }
      console.error(`Failed to resolve browser dtypes for ${id}`, error);
      return null;
    }
  }));
  return results.filter((result): result is HFModel => result !== null);
}
