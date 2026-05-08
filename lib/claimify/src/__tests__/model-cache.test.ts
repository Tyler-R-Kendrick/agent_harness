import { describe, expect, it, vi } from 'vitest';
import { getPipelineFiles, isPipelineCached } from '../cache';
import {
  configureTransformersEnvironment,
  extractFirstJsonObject,
  generateJson,
  resolveDevice,
} from '../model';

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

  it('resolves auto device to webgpu only when available', () => {
    expect(resolveDevice('wasm')).toBe('wasm');
    expect(resolveDevice('webgpu')).toBe('webgpu');
    expect(resolveDevice('auto', { gpu: {} })).toBe('webgpu');
    expect(resolveDevice('auto', {})).toBe('wasm');
  });

  it('extracts the first top-level JSON object from generated text', () => {
    expect(extractFirstJsonObject('prefix {"a":{"b":1}} suffix')).toBe('{"a":{"b":1}}');
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

  it('throws typed JSON errors for malformed model output', async () => {
    const generator = vi.fn(async () => [{ generated_text: 'not json' }]);

    await expect(generateJson(generator, 'prompt')).rejects.toMatchObject({
      name: 'ClaimifyJsonError',
    });
  });
});
