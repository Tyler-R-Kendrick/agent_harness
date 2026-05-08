import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPipelineFiles, isPipelineCached } from '../cache';
import {
  configureTransformersEnvironment,
  extractFirstJsonObject,
  generateJson,
  loadTextGenerationPipeline,
  resolveDevice,
  setTransformersImporterForTest,
} from '../model';

vi.mock('@huggingface/transformers', () => ({
  env: {},
  ModelRegistry: {
    is_pipeline_cached: vi.fn(async () => false),
  },
  pipeline: vi.fn(async () => vi.fn()),
}));

afterEach(() => {
  setTransformersImporterForTest();
});

describe('cache helpers', () => {
  it('guards optional model registry APIs', async () => {
    const registry = {
      get_pipeline_files: vi.fn(async () => ['model.onnx']),
      is_pipeline_cached: vi.fn(async () => true),
    };

    await expect(getPipelineFiles(registry, 'text-generation', 'model-id')).resolves.toEqual(['model.onnx']);
    await expect(isPipelineCached(registry, 'text-generation', 'model-id')).resolves.toBe(true);
    await expect(getPipelineFiles({}, 'text-generation', 'model-id')).resolves.toEqual([]);
    await expect(isPipelineCached({}, 'text-generation', 'model-id')).resolves.toBe(false);
  });
});

describe('model helpers', () => {
  it('configures cache flags when environment supports them', () => {
    const env = {};

    configureTransformersEnvironment(env);

    expect(env).toMatchObject({ useBrowserCache: true, useWasmCache: true });
  });

  it('ignores missing transformers environment', () => {
    expect(configureTransformersEnvironment(undefined)).toBeUndefined();
  });

  it('resolves auto device to webgpu only when available', () => {
    expect(resolveDevice('wasm')).toBe('wasm');
    expect(resolveDevice('webgpu')).toBe('webgpu');
    expect(resolveDevice()).toBe('wasm');
    vi.stubGlobal('navigator', undefined);
    expect(resolveDevice()).toBe('wasm');
    vi.unstubAllGlobals();
    expect(resolveDevice('auto', { gpu: {} })).toBe('webgpu');
    expect(resolveDevice('auto', {})).toBe('wasm');
  });

  it('extracts the first top-level JSON object from generated text', () => {
    expect(extractFirstJsonObject('prefix {"a":{"b":1}} suffix')).toBe('{"a":{"b":1}}');
    expect(extractFirstJsonObject('prefix {"a":"quoted \\" brace }"} suffix')).toBe('{"a":"quoted \\" brace }"}');
    expect(extractFirstJsonObject('prefix {"a":1')).toBeNull();
    expect(extractFirstJsonObject('no json')).toBeNull();
  });

  it('generates deterministic JSON and recovers embedded JSON', async () => {
    const generator = vi.fn(async () => [{ generated_text: 'Here: {"ok":true}' }]);

    await expect(generateJson<{ ok: boolean }>(generator, 'prompt', { maxNewTokens: 12 })).resolves.toEqual({
      ok: true,
    });
    expect(generator).toHaveBeenCalledWith('prompt', {
      do_sample: false,
      max_new_tokens: 12,
      temperature: 0,
    });
  });

  it('parses direct string JSON model output with default token limits', async () => {
    const generator = vi.fn(async () => '{"ok":true}');

    await expect(generateJson<{ ok: boolean }>(generator, 'prompt')).resolves.toEqual({ ok: true });
    expect(generator).toHaveBeenCalledWith('prompt', {
      do_sample: false,
      max_new_tokens: 512,
      temperature: 0,
    });
  });

  it('throws typed JSON errors for malformed model output', async () => {
    const generator = vi.fn(async () => [{ generated_text: 'not json' }]);

    await expect(generateJson(generator, 'prompt')).rejects.toMatchObject({
      name: 'ClaimifyJsonError',
    });
  });

  it('throws typed JSON errors when output shape is unsupported or JSON is invalid', async () => {
    await expect(generateJson(vi.fn(async () => []), 'prompt')).rejects.toMatchObject({
      name: 'ClaimifyJsonError',
      message: 'Model output did not include generated_text',
    });
    await expect(generateJson(vi.fn(async () => [{}]), 'prompt')).rejects.toMatchObject({
      name: 'ClaimifyJsonError',
      message: 'Model output did not include generated_text',
    });
    await expect(generateJson(vi.fn(async () => '{"ok":'), 'prompt')).rejects.toMatchObject({
      name: 'ClaimifyJsonError',
    });
  });

  it('loads transformers pipelines and falls back from webgpu to wasm', async () => {
    const generator = vi.fn();
    const pipeline = vi
      .fn()
      .mockRejectedValueOnce(new Error('webgpu failed'))
      .mockResolvedValueOnce(generator);
    const env = {};
    const registry = {
      is_pipeline_cached: vi.fn(async () => true),
    };
    setTransformersImporterForTest(async () => ({ env, pipeline, ModelRegistry: registry }));

    await expect(
      loadTextGenerationPipeline({
        device: 'webgpu',
        dtype: 'fp16',
        modelId: 'model',
        progressCallback: vi.fn(),
      }),
    ).resolves.toMatchObject({
      generator,
      preload: { modelId: 'model', cached: true, device: 'wasm', dtype: 'fp16' },
    });
    expect(env).toMatchObject({ useBrowserCache: true, useWasmCache: true });
    expect(pipeline).toHaveBeenNthCalledWith(1, 'text-generation', 'model', expect.objectContaining({ device: 'webgpu' }));
    expect(pipeline).toHaveBeenNthCalledWith(2, 'text-generation', 'model', expect.objectContaining({ device: 'wasm' }));

  });

  it('loads transformers pipelines with default options', async () => {
    const generator = vi.fn();
    const pipeline = vi.fn(async () => generator);
    setTransformersImporterForTest(async () => ({ pipeline }));

    await expect(loadTextGenerationPipeline()).resolves.toMatchObject({
      generator,
      preload: {
        modelId: 'onnx-community/Qwen2.5-0.5B-Instruct',
        cached: false,
        device: 'wasm',
        dtype: 'q4',
      },
    });

  });

  it('uses the default lazy transformers importer', async () => {
    await expect(loadTextGenerationPipeline({ modelId: 'mocked-model' })).resolves.toMatchObject({
      preload: {
        modelId: 'mocked-model',
        cached: false,
        device: 'wasm',
        dtype: 'q4',
      },
    });
  });

  it('wraps non-webgpu pipeline load failures', async () => {
    setTransformersImporterForTest(async () => ({
      pipeline: vi.fn(async () => {
        throw new Error('missing runtime');
      }),
    }));

    await expect(loadTextGenerationPipeline({ device: 'wasm' })).rejects.toMatchObject({
      name: 'ClaimifyModelError',
      message: 'missing runtime',
    });
  });

  it('wraps non-error pipeline load failures', async () => {
    setTransformersImporterForTest(async () => ({
      pipeline: vi.fn(async () => {
        throw 'missing runtime';
      }),
    }));

    await expect(loadTextGenerationPipeline({ device: 'wasm' })).rejects.toMatchObject({
      name: 'ClaimifyModelError',
      message: 'missing runtime',
    });
  });
});
