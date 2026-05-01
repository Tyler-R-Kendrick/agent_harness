import { describe, expect, it, vi } from 'vitest';
import {
  createConfiguredModel,
  defineModelProviderCatalog,
  getModelProviderCapabilities,
  getOpenAICompatibleProviderOptions,
  listConfiguredModels,
  parseModelProviderRef,
  resolveModelProvider,
  toModelProviderRef,
  type OpenAICompatibleProviderOptions,
} from '../modelProviders.js';

describe('custom model provider catalogs', () => {
  it('normalizes JSON-style OpenAI-compatible providers and creates models through an injected factory', () => {
    const catalog = defineModelProviderCatalog({
      activeModel: 'lmstudio:qwen/qwen3',
      providers: [
        {
          id: 'lmstudio',
          name: 'LM Studio',
          kind: 'openai-compatible',
          baseURL: 'http://127.0.0.1:1234/v1/',
          apiKeyEnvVar: 'LM_STUDIO_API_KEY',
          headers: {
            'X-Trace-Id': '${env:TRACE_ID}',
          },
          includeUsage: true,
          defaultModelId: 'qwen/qwen3',
          models: [
            'qwen/qwen3',
            {
              id: 'llama-3.1',
              name: 'Llama 3.1',
              contextWindow: 131_072,
              maxOutputTokens: 4_096,
              supportsNativeToolCalls: true,
            },
          ],
        },
      ],
    });

    expect(listConfiguredModels(catalog).map((entry) => entry.ref)).toEqual([
      'lmstudio:qwen/qwen3',
      'lmstudio:llama-3.1',
    ]);
    expect(resolveModelProvider(catalog).model.id).toBe('qwen/qwen3');
    expect(resolveModelProvider(catalog, { providerId: 'lmstudio', modelId: 'llama-3.1' }).model.name).toBe('Llama 3.1');
    expect(parseModelProviderRef('lmstudio:qwen/qwen3')).toEqual({ providerId: 'lmstudio', modelId: 'qwen/qwen3' });
    expect(toModelProviderRef('lmstudio', 'qwen/qwen3')).toBe('lmstudio:qwen/qwen3');

    const factory = vi.fn((options: OpenAICompatibleProviderOptions) => ({
      chatModel: vi.fn((modelId: string) => ({ modelId, options })),
    }));
    const model = createConfiguredModel(
      catalog,
      'lmstudio:llama-3.1',
      { openAICompatible: factory },
      {
        getSecret: (name) => ({
          LM_STUDIO_API_KEY: 'local-key',
          TRACE_ID: 'trace-123',
        }[name]),
      },
    );

    expect(model).toEqual({
      modelId: 'llama-3.1',
      options: {
        name: 'lmstudio',
        baseURL: 'http://127.0.0.1:1234/v1',
        apiKey: 'local-key',
        headers: { 'X-Trace-Id': 'trace-123' },
        includeUsage: true,
      },
    });
    expect(factory).toHaveBeenCalledWith({
      name: 'lmstudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKey: 'local-key',
      headers: { 'X-Trace-Id': 'trace-123' },
      includeUsage: true,
    });
  });

  it('keeps disabled providers and models out of normal resolution unless explicitly included', () => {
    const catalog = defineModelProviderCatalog({
      providers: [
        {
          id: 'enabled',
          kind: 'openai-compatible',
          baseURL: 'https://enabled.example/v1',
          defaultModelId: 'fast',
          models: [
            { id: 'fast', contextWindow: 12_000, maxOutputTokens: 900 },
            { id: 'hidden', enabled: false },
          ],
        },
        {
          id: 'off',
          kind: 'openai-compatible',
          enabled: false,
          baseURL: 'https://off.example/v1',
          models: ['off-model'],
        },
      ],
    });

    expect(listConfiguredModels(catalog).map((entry) => entry.ref)).toEqual(['enabled:fast']);
    expect(listConfiguredModels(catalog, { includeDisabled: true }).map((entry) => entry.ref)).toEqual([
      'enabled:fast',
      'enabled:hidden',
      'off:off-model',
    ]);
    expect(resolveModelProvider(catalog, 'enabled:fast').model.id).toBe('fast');
    expect(() => resolveModelProvider(catalog, 'enabled:hidden')).toThrow(/disabled/);
    expect(() => resolveModelProvider(catalog, 'off:off-model')).toThrow(/disabled/);
    expect(resolveModelProvider(catalog, 'enabled:hidden', { includeDisabled: true }).model.id).toBe('hidden');

    expect(getModelProviderCapabilities(resolveModelProvider(catalog, 'enabled:fast'))).toEqual({
      provider: 'enabled',
      contextWindow: 12_000,
      maxOutputTokens: 900,
      supportsNativeToolCalls: false,
    });
    expect(getModelProviderCapabilities(resolveModelProvider(catalog, 'enabled:hidden', { includeDisabled: true }))).toEqual({
      provider: 'enabled',
      contextWindow: 8_192,
      maxOutputTokens: 1_024,
      supportsNativeToolCalls: false,
    });
  });

  it('supports direct keys, literal headers, and provider defaults without a secret resolver', () => {
    const catalog = defineModelProviderCatalog({
      providers: [
        {
          id: 'openrouter',
          kind: 'openai-compatible',
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: 'direct-key',
          headers: { 'HTTP-Referer': 'https://harness.local' },
          models: [{ id: 'deepseek/deepseek-chat', supportsNativeToolCalls: true }],
        },
      ],
    });
    const resolved = resolveModelProvider(catalog);

    expect(resolved.ref).toBe('openrouter:deepseek/deepseek-chat');
    expect(getOpenAICompatibleProviderOptions(resolved.provider)).toEqual({
      name: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: 'direct-key',
      headers: { 'HTTP-Referer': 'https://harness.local' },
    });
    expect(getModelProviderCapabilities(resolved)).toEqual({
      provider: 'openrouter',
      contextWindow: 8_192,
      maxOutputTokens: 1_024,
      supportsNativeToolCalls: true,
    });

    const noSecretProvider = defineModelProviderCatalog({
      providers: [{ id: 'public', kind: 'openai-compatible', baseURL: 'https://public.example/v1', headers: {}, models: ['free'] }],
    }).providers[0];
    expect(getOpenAICompatibleProviderOptions(noSecretProvider)).toEqual({
      name: 'public',
      baseURL: 'https://public.example/v1',
    });
  });

  it('fails fast for malformed config, ambiguous refs, and missing provider secrets', () => {
    expect(() => defineModelProviderCatalog(null)).toThrow(/object/);
    expect(() => defineModelProviderCatalog({ providers: [] })).toThrow(/at least one/);
    expect(() => defineModelProviderCatalog({ providers: ['not-an-object'] })).toThrow(/entry must be an object/);
    expect(() => defineModelProviderCatalog({
      providers: [{ id: '', kind: 'openai-compatible', baseURL: 'https://example.test/v1', models: ['m'] }],
    })).toThrow(/id/);
    expect(() => defineModelProviderCatalog({
      providers: [
        { id: 'dupe', kind: 'openai-compatible', baseURL: 'https://a.test/v1', models: ['m'] },
        { id: 'dupe', kind: 'openai-compatible', baseURL: 'https://b.test/v1', models: ['m'] },
      ],
    })).toThrow(/Duplicate provider/);
    expect(() => defineModelProviderCatalog({
      providers: [{ id: 'bad-kind', kind: 'native', baseURL: 'https://example.test/v1', models: ['m'] }],
    })).toThrow(/Unsupported provider kind/);
    expect(() => defineModelProviderCatalog({
      providers: [{ id: 'missing-url', kind: 'openai-compatible', models: ['m'] }],
    })).toThrow(/baseURL/);
    expect(() => defineModelProviderCatalog({
      providers: [{ id: 'no-models', kind: 'openai-compatible', baseURL: 'https://example.test/v1', models: [] }],
    })).toThrow(/at least one model/);
    expect(() => defineModelProviderCatalog({
      providers: [{ id: 'bad-headers', kind: 'openai-compatible', baseURL: 'https://example.test/v1', headers: 'nope', models: ['m'] }],
    })).toThrow(/headers/);
    expect(() => defineModelProviderCatalog({
      providers: [{ id: 'bad-enabled', kind: 'openai-compatible', enabled: 'yes', baseURL: 'https://example.test/v1', models: ['m'] }],
    })).toThrow(/boolean/);
    expect(() => defineModelProviderCatalog({
      providers: [{ id: 'bad-model', kind: 'openai-compatible', baseURL: 'https://example.test/v1', models: [{ name: 'Missing id' }] }],
    })).toThrow(/model id/);
    expect(() => defineModelProviderCatalog({
      providers: [{ id: 'bad-model-entry', kind: 'openai-compatible', baseURL: 'https://example.test/v1', models: [3] }],
    })).toThrow(/model entry/);
    expect(() => defineModelProviderCatalog({
      providers: [{ id: 'bad-context', kind: 'openai-compatible', baseURL: 'https://example.test/v1', models: [{ id: 'm', contextWindow: 0 }] }],
    })).toThrow(/positive number/);
    expect(() => defineModelProviderCatalog({
      providers: [{ id: 'dupe-model', kind: 'openai-compatible', baseURL: 'https://example.test/v1', models: ['m', 'm'] }],
    })).toThrow(/Duplicate model/);
    expect(() => defineModelProviderCatalog({
      providers: [{ id: 'bad-default', kind: 'openai-compatible', baseURL: 'https://example.test/v1', defaultModelId: 'missing', models: ['m'] }],
    })).toThrow(/defaultModelId/);
    expect(() => defineModelProviderCatalog({
      activeModel: 'missing:m',
      providers: [{ id: 'only', kind: 'openai-compatible', baseURL: 'https://example.test/v1', models: ['m'] }],
    })).toThrow(/Unknown provider/);
    expect(() => parseModelProviderRef('missing-separator')).toThrow(/provider:model/);
    expect(() => resolveModelProvider({ providers: [] }, 123 as never)).toThrow(/selection/);

    const catalog = defineModelProviderCatalog({
      providers: [{ id: 'p', kind: 'openai-compatible', baseURL: 'https://example.test/v1', apiKeyEnvVar: 'API_KEY', headers: { Authorization: 'Bearer ${env:API_KEY}' }, models: ['m'] }],
    });

    expect(() => resolveModelProvider(catalog, 'unknown:m')).toThrow(/Unknown provider/);
    expect(() => resolveModelProvider(catalog, 'p:unknown')).toThrow(/Unknown model/);
    expect(() => getOpenAICompatibleProviderOptions(catalog.providers[0])).toThrow(/API_KEY/);

    const defaultCatalog = defineModelProviderCatalog({
      providers: [
        { id: 'off', kind: 'openai-compatible', enabled: false, baseURL: 'https://off.example/v1', models: ['m'] },
        { id: 'on', kind: 'openai-compatible', baseURL: 'https://on.example/v1', models: ['m'] },
      ],
    });
    expect(resolveModelProvider(defaultCatalog).provider.id).toBe('on');
    expect(resolveModelProvider(defaultCatalog, undefined, { includeDisabled: true }).provider.id).toBe('off');

    const noEnabledCatalog = defineModelProviderCatalog({
      providers: [{ id: 'off', kind: 'openai-compatible', enabled: false, baseURL: 'https://off.example/v1', models: ['m'] }],
    });
    expect(() => resolveModelProvider(noEnabledCatalog)).toThrow(/enabled models/);
  });
});
