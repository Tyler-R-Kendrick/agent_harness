import { describe, expect, it, vi } from 'vitest';
import type { LanguageModel } from 'ai';
import type { OpenAICompatibleProviderOptions } from 'harness-core';

// Mock the gateway module before importing agentProvider
vi.mock('@ai-sdk/gateway', () => {
  const mockGatewayModel = (id: string) => ({
    specificationVersion: 'v3' as const,
    provider: 'gateway',
    modelId: id,
    doGenerate: vi.fn(),
    doStream: vi.fn(),
  });
  return {
    gateway: Object.assign(vi.fn((id: string) => mockGatewayModel(id)), {
      languageModel: vi.fn((id: string) => mockGatewayModel(id)),
    }),
  };
});

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn((options) => ({
    chatModel: vi.fn((modelId: string) => ({
      specificationVersion: 'v3' as const,
      provider: options.name,
      modelId,
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn(),
      options,
    })),
  })),
}));

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  resolveLanguageModel,
  createAutoProvider,
  getModelCapabilities,
  type AgentModelConfig,
} from './agentProvider';
import { defineModelProviderCatalog } from 'harness-core';

type FakeCustomLanguageModel = LanguageModel & {
  options: OpenAICompatibleProviderOptions;
};

// ── resolveLanguageModel ──────────────────────────────────────────────────────

describe('resolveLanguageModel', () => {
  it('returns a LanguageModelV3 for gateway config', () => {
    const config: AgentModelConfig = { kind: 'gateway', modelId: 'anthropic/claude-sonnet-4.6' };
    const model = resolveLanguageModel(config);
    expect(model).toBeDefined();
    expect((model as any).provider).toBe('gateway');
    expect((model as any).modelId).toBe('anthropic/claude-sonnet-4.6');
  });

  it('returns a CopilotLanguageModel for copilot config', () => {
    const config: AgentModelConfig = { kind: 'copilot', modelId: 'gpt-4.1', sessionId: 'chat-session-1' };
    const model = resolveLanguageModel(config) as any;
    expect(model).toBeDefined();
    expect(model.provider).toBe('copilot');
    expect(model.modelId).toBe('gpt-4.1');
    expect(model.sessionId).toBe('chat-session-1');
    expect(model.specificationVersion).toBe('v3');
  });

  it('returns a CursorLanguageModel for cursor config', () => {
    const config: AgentModelConfig = { kind: 'cursor', modelId: 'composer-2', sessionId: 'chat-session-1' };
    const model = resolveLanguageModel(config) as any;
    expect(model).toBeDefined();
    expect(model.provider).toBe('cursor');
    expect(model.modelId).toBe('composer-2');
    expect(model.sessionId).toBe('chat-session-1');
    expect(model.specificationVersion).toBe('v3');
  });

  it('returns a LocalLanguageModel for local config', () => {
    const config: AgentModelConfig = {
      kind: 'local',
      modelId: 'onnx-community/Qwen3-0.6B-ONNX',
      task: 'text-generation',
    };
    const model = resolveLanguageModel(config) as any;
    expect(model).toBeDefined();
    expect(model.provider).toBe('local');
    expect(model.modelId).toBe('onnx-community/Qwen3-0.6B-ONNX');
    expect(model.specificationVersion).toBe('v3');
  });

  it('returns an injected OpenAI-compatible LanguageModel for config-backed custom providers', () => {
    const catalog = defineModelProviderCatalog({
      providers: [
        {
          id: 'openrouter',
          kind: 'openai-compatible',
          baseURL: 'https://openrouter.ai/api/v1/',
          apiKeyEnvVar: 'OPENROUTER_API_KEY',
          headers: { 'HTTP-Referer': 'https://harness.local' },
          models: ['deepseek/deepseek-chat'],
        },
      ],
    });
    const factory = vi.fn((options: OpenAICompatibleProviderOptions) => ({
      chatModel: vi.fn((modelId: string) => ({
        specificationVersion: 'v3' as const,
        provider: options.name,
        modelId,
        supportedUrls: {},
        doGenerate: vi.fn(),
        doStream: vi.fn(),
        options,
      } as unknown as FakeCustomLanguageModel)),
    }));
    const config = {
      kind: 'custom',
      catalog,
      modelRef: 'openrouter:deepseek/deepseek-chat',
      secrets: { OPENROUTER_API_KEY: 'or-key' },
    } as AgentModelConfig;

    const model = resolveLanguageModel(config, { createOpenAICompatibleProvider: factory }) as FakeCustomLanguageModel;

    expect(model).toMatchObject({
      specificationVersion: 'v3',
      provider: 'openrouter',
      modelId: 'deepseek/deepseek-chat',
      options: {
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'or-key',
        headers: { 'HTTP-Referer': 'https://harness.local' },
      },
    });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('uses the default OpenAI-compatible factory for custom providers', () => {
    const catalog = defineModelProviderCatalog({
      providers: [
        {
          id: 'lmstudio',
          kind: 'openai-compatible',
          baseURL: 'http://127.0.0.1:1234/v1',
          models: ['qwen3'],
        },
      ],
    });

    const model = resolveLanguageModel({
      kind: 'custom',
      catalog,
      modelRef: 'lmstudio:qwen3',
    } as AgentModelConfig) as FakeCustomLanguageModel;

    expect(createOpenAICompatible).toHaveBeenCalledWith({
      name: 'lmstudio',
      baseURL: 'http://127.0.0.1:1234/v1',
    });
    expect(model).toMatchObject({
      provider: 'lmstudio',
      modelId: 'qwen3',
    });
  });
});

// ── createAutoProvider ────────────────────────────────────────────────────────

const authenticatedCopilotState = {
  available: true,
  authenticated: true,
  models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true }],
  signInCommand: 'copilot login',
  signInDocsUrl: 'https://docs.github.com',
};

const unauthenticatedCopilotState = {
  available: true,
  authenticated: false,
  models: [],
  signInCommand: 'copilot login',
  signInDocsUrl: 'https://docs.github.com',
};

const installedHfModel = {
  id: 'onnx-community/Qwen3-0.6B-ONNX',
  name: 'Qwen3-0.6B',
  author: 'onnx-community',
  task: 'text-generation',
  downloads: 5000,
  likes: 30,
  tags: [],
  sizeMB: 512,
  status: 'installed' as const,
};

describe('createAutoProvider', () => {
  it('picks copilot when authenticated and no gateway key', () => {
    const config = createAutoProvider({
      copilotState: authenticatedCopilotState,
      installedModels: [],
    });
    expect(config.kind).toBe('copilot');
    expect((config as any).modelId).toBe('gpt-4.1');
  });

  it('picks local when a HF model is installed', () => {
    const config = createAutoProvider({
      copilotState: unauthenticatedCopilotState,
      installedModels: [installedHfModel],
    });
    expect(config.kind).toBe('local');
    expect((config as any).modelId).toBe('onnx-community/Qwen3-0.6B-ONNX');
  });

  it('picks gateway when gatewayModelId is provided', () => {
    const config = createAutoProvider({
      copilotState: unauthenticatedCopilotState,
      installedModels: [],
      gatewayModelId: 'anthropic/claude-sonnet-4.6',
    });
    expect(config.kind).toBe('gateway');
    expect((config as any).modelId).toBe('anthropic/claude-sonnet-4.6');
  });

  it('picks a configured custom provider before local and copilot fallbacks', () => {
    const customProviderCatalog = defineModelProviderCatalog({
      providers: [{ id: 'lmstudio', kind: 'openai-compatible', baseURL: 'http://127.0.0.1:1234/v1', models: ['qwen3'] }],
    });

    const config = createAutoProvider({
      copilotState: authenticatedCopilotState,
      installedModels: [installedHfModel],
      customProviderCatalog,
      customModelRef: 'lmstudio:qwen3',
      customSecrets: { LMSTUDIO_API_KEY: 'optional' },
    });

    expect(config.kind).toBe('custom');
    expect((config as any).catalog).toBe(customProviderCatalog);
    expect((config as any).modelRef).toBe('lmstudio:qwen3');
    expect((config as any).secrets).toEqual({ LMSTUDIO_API_KEY: 'optional' });
  });

  it('gateway takes precedence over copilot when both available', () => {
    const config = createAutoProvider({
      copilotState: authenticatedCopilotState,
      installedModels: [],
      gatewayModelId: 'openai/gpt-4.1',
    });
    expect(config.kind).toBe('gateway');
  });

  it('local takes precedence over copilot when both available', () => {
    const config = createAutoProvider({
      copilotState: authenticatedCopilotState,
      installedModels: [installedHfModel],
    });
    expect(config.kind).toBe('local');
  });

  it('throws when no provider is available', () => {
    expect(() =>
      createAutoProvider({
        copilotState: unauthenticatedCopilotState,
        installedModels: [],
      }),
    ).toThrow(/no.*provider/i);
  });
});

describe('getModelCapabilities', () => {
  it('returns gateway defaults', () => {
    expect(getModelCapabilities({ kind: 'gateway', modelId: 'openai/gpt-4.1' })).toEqual({
      provider: 'gateway',
      contextWindow: 8192,
      maxOutputTokens: 1024,
      supportsNativeToolCalls: true,
    });
  });

  it('uses copilot model metadata when available', () => {
    expect(getModelCapabilities(
      { kind: 'copilot', modelId: 'gpt-4.1' },
      { copilotModels: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true, contextWindow: 32768, maxOutputTokens: 2048 }] },
    )).toEqual({
      provider: 'copilot',
      contextWindow: 32768,
      maxOutputTokens: 2048,
      supportsNativeToolCalls: false,
    });
  });

  it('uses cursor model metadata when available', () => {
    expect(getModelCapabilities(
      { kind: 'cursor', modelId: 'composer-2' },
      { cursorModels: [{ id: 'composer-2', name: 'Composer 2', contextWindow: 128000, maxOutputTokens: 8192 }] },
    )).toEqual({
      provider: 'cursor',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsNativeToolCalls: false,
    });
  });

  it('uses local model metadata when available and falls back otherwise', () => {
    expect(getModelCapabilities(
      { kind: 'local', modelId: installedHfModel.id, task: installedHfModel.task },
      { installedModels: [{ ...installedHfModel, contextWindow: 4096, maxOutputTokens: 768 }] },
    )).toEqual({
      provider: 'local',
      contextWindow: 4096,
      maxOutputTokens: 768,
      supportsNativeToolCalls: false,
    });

    expect(getModelCapabilities({ kind: 'local', modelId: 'missing', task: 'text-generation' })).toEqual({
      provider: 'local',
      contextWindow: 2048,
      maxOutputTokens: 512,
      supportsNativeToolCalls: false,
    });
  });

  it('uses configured custom provider model metadata', () => {
    const catalog = defineModelProviderCatalog({
      providers: [
        {
          id: 'openrouter',
          kind: 'openai-compatible',
          baseURL: 'https://openrouter.ai/api/v1',
          models: [{
            id: 'deepseek/deepseek-chat',
            contextWindow: 64_000,
            maxOutputTokens: 8_000,
            supportsNativeToolCalls: true,
          }],
        },
      ],
    });

    expect(getModelCapabilities({
      kind: 'custom',
      catalog,
      modelRef: 'openrouter:deepseek/deepseek-chat',
    } as AgentModelConfig)).toEqual({
      provider: 'openrouter',
      contextWindow: 64000,
      maxOutputTokens: 8000,
      supportsNativeToolCalls: true,
    });
  });
});
