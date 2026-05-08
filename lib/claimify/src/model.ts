import { isPipelineCached } from './cache';
import { ClaimifyJsonError, ClaimifyModelError } from './errors';
import type { ClaimifyDevice, ClaimifyDevicePreference, PreloadOptions, PreloadResult, TextGenerationPipeline } from './types';

export const DEFAULT_MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
export const DEFAULT_DTYPE = 'q4';

type TransformersModule = {
  env?: Record<string, unknown>;
  pipeline: (task: string, modelId: string, options: Record<string, unknown>) => Promise<TextGenerationPipeline>;
  ModelRegistry?: unknown;
};

type TransformersImporter = (specifier: string) => Promise<TransformersModule>;

let transformersImporter: TransformersImporter = defaultTransformersImporter;

type NavigatorLike = {
  gpu?: unknown;
};

export function configureTransformersEnvironment(env: Record<string, unknown> | undefined): void {
  if (!env) {
    return;
  }
  env.useBrowserCache = true;
  env.useWasmCache = true;
}

export function resolveDevice(
  preference: ClaimifyDevicePreference = 'auto',
  navigatorLike: NavigatorLike = (globalThis.navigator as NavigatorLike | undefined) ?? {},
): ClaimifyDevice {
  if (preference === 'webgpu' || preference === 'wasm') {
    return preference;
  }
  return navigatorLike.gpu ? 'webgpu' : 'wasm';
}

export async function loadTextGenerationPipeline(options: PreloadOptions = {}): Promise<{
  generator: TextGenerationPipeline;
  preload: PreloadResult;
}> {
  const modelId = options.modelId ?? DEFAULT_MODEL_ID;
  const dtype = options.dtype ?? DEFAULT_DTYPE;
  const transformers = await importTransformers();
  configureTransformersEnvironment(transformers.env);
  const cached = await isPipelineCached(transformers.ModelRegistry, 'text-generation', modelId);
  const preferredDevice = resolveDevice(options.device ?? 'auto');

  try {
    const generator = await transformers.pipeline('text-generation', modelId, {
      device: preferredDevice,
      dtype,
      progress_callback: options.progressCallback,
    });
    return { generator, preload: { modelId, cached, device: preferredDevice, dtype } };
  } catch (error) {
    if (preferredDevice !== 'webgpu') {
      throw new ClaimifyModelError(error instanceof Error ? error.message : String(error));
    }
    const generator = await transformers.pipeline('text-generation', modelId, {
      device: 'wasm',
      dtype,
      progress_callback: options.progressCallback,
    });
    return { generator, preload: { modelId, cached, device: 'wasm', dtype } };
  }
}

export function setTransformersImporterForTest(importer?: TransformersImporter): void {
  transformersImporter = importer ?? defaultTransformersImporter;
}

export async function generateJson<T>(
  generator: TextGenerationPipeline,
  prompt: string,
  options: { maxNewTokens?: number } = {},
): Promise<T> {
  const output = await generator(prompt, {
    temperature: 0,
    do_sample: false,
    max_new_tokens: options.maxNewTokens ?? 512,
  });
  const text = readGeneratedText(output);
  const json = text.trim().startsWith('{') ? text.trim() : extractFirstJsonObject(text);
  if (!json) {
    throw new ClaimifyJsonError('Model output did not contain a JSON object');
  }

  try {
    return JSON.parse(json) as T;
  } catch (error) {
    throw new ClaimifyJsonError(String(error));
  }
}

export function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === '{') {
      depth += 1;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }
  return null;
}

function readGeneratedText(output: unknown): string {
  if (typeof output === 'string') {
    return output;
  }
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0] as { generated_text?: unknown };
    if (typeof first.generated_text === 'string') {
      return first.generated_text;
    }
  }
  throw new ClaimifyJsonError('Model output did not include generated_text');
}

async function importTransformers(): Promise<TransformersModule> {
  return transformersImporter('@huggingface/transformers');
}

function defaultTransformersImporter(specifier: string): Promise<TransformersModule> {
  return import(specifier) as Promise<TransformersModule>;
}
