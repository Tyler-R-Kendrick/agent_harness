/**
 * services/agentProvider.ts
 *
 * Unified LanguageModel factory for all supported inference backends:
 *   - "gateway"  – AI SDK gateway (Anthropic Claude, OpenAI/Codex, Google Gemini, etc.)
 *   - "copilot"  – GitHub Copilot via /api/copilot/chat proxy
 *   - "local"    – In-browser HuggingFace ONNX via browserInferenceEngine
 *
 * MCP & A2A are tool/transport protocols, not inference providers. They are
 * handled at the tool-registration level in agentRunner.ts.
 */

import { gateway } from '@ai-sdk/gateway';
import type { GatewayModelId } from '@ai-sdk/gateway';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import {
  createConfiguredModel,
  getModelProviderCapabilities as getConfiguredModelProviderCapabilities,
  resolveModelProvider,
  type ModelProviderCatalog,
  type ModelProviderRef,
  type OpenAICompatibleModelProviderFactory,
  type OpenAICompatibleProviderOptions,
} from 'harness-core';
import type { CopilotModelSummary, CopilotRuntimeState } from './copilotApi';
import type { CursorModelSummary } from './cursorApi';
import type { HFModel } from '../types';
import { CopilotLanguageModel } from './copilotLanguageModel';
import { CursorLanguageModel } from './cursorLanguageModel';
import { LocalLanguageModel } from './localLanguageModel';

// ── Config discriminated union ────────────────────────────────────────────────

export type GatewayModelConfig = {
  kind: 'gateway';
  /** Any model ID supported by the AI gateway, e.g. 'anthropic/claude-sonnet-4.6' */
  modelId: GatewayModelId | string;
};

export type CopilotModelConfig = {
  kind: 'copilot';
  /** GitHub Copilot model ID, e.g. 'gpt-4.1' */
  modelId: string;
  /** Stable app chat-session identifier used to reuse one Copilot session. */
  sessionId?: string;
};

export type CursorModelConfig = {
  kind: 'cursor';
  modelId: string;
  sessionId?: string;
};

export type LocalModelConfig = {
  kind: 'local';
  /** HuggingFace ONNX model ID */
  modelId: string;
  task?: string;
};

export type CustomProviderModelConfig = {
  kind: 'custom';
  /** Runtime/provider catalog parsed by harness-core from config JSON. */
  catalog: ModelProviderCatalog;
  /** Optional provider:model ref. Falls back to the catalog active/default model. */
  modelRef?: string | ModelProviderRef;
  /** Secret values used by env placeholders such as ${env:OPENROUTER_API_KEY}. */
  secrets?: Record<string, string>;
};

export type AgentModelConfig = GatewayModelConfig | CopilotModelConfig | CursorModelConfig | LocalModelConfig | CustomProviderModelConfig;

export type ModelCapabilities = {
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsNativeToolCalls: boolean;
};

export type ResolveLanguageModelOptions = {
  createOpenAICompatibleProvider?: OpenAICompatibleModelProviderFactory<LanguageModel>;
};

const DEFAULT_GATEWAY_CONTEXT_WINDOW = 8_192;
const DEFAULT_COPILOT_CONTEXT_WINDOW = 8_192;
const DEFAULT_CURSOR_CONTEXT_WINDOW = 8_192;
const DEFAULT_LOCAL_CONTEXT_WINDOW = 2_048;
const DEFAULT_GATEWAY_MAX_OUTPUT_TOKENS = 1_024;
const DEFAULT_COPILOT_MAX_OUTPUT_TOKENS = 1_024;
const DEFAULT_CURSOR_MAX_OUTPUT_TOKENS = 1_024;
const DEFAULT_LOCAL_MAX_OUTPUT_TOKENS = 512;

function pickPositiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function getModelCapabilities(
  config: AgentModelConfig,
  options: {
    installedModels?: HFModel[];
    copilotModels?: CopilotModelSummary[];
    cursorModels?: CursorModelSummary[];
  } = {},
): ModelCapabilities {
  switch (config.kind) {
    case 'gateway':
      return {
        provider: 'gateway',
        contextWindow: DEFAULT_GATEWAY_CONTEXT_WINDOW,
        maxOutputTokens: DEFAULT_GATEWAY_MAX_OUTPUT_TOKENS,
        supportsNativeToolCalls: true,
      };

    case 'copilot': {
      const model = options.copilotModels?.find((candidate) => candidate.id === config.modelId);
      return {
        provider: 'copilot',
        contextWindow: pickPositiveNumber(model?.contextWindow, DEFAULT_COPILOT_CONTEXT_WINDOW),
        maxOutputTokens: pickPositiveNumber(model?.maxOutputTokens, DEFAULT_COPILOT_MAX_OUTPUT_TOKENS),
        supportsNativeToolCalls: false,
      };
    }

    case 'cursor': {
      const model = options.cursorModels?.find((candidate) => candidate.id === config.modelId);
      return {
        provider: 'cursor',
        contextWindow: pickPositiveNumber(model?.contextWindow, DEFAULT_CURSOR_CONTEXT_WINDOW),
        maxOutputTokens: pickPositiveNumber(model?.maxOutputTokens, DEFAULT_CURSOR_MAX_OUTPUT_TOKENS),
        supportsNativeToolCalls: false,
      };
    }

    case 'local': {
      const model = options.installedModels?.find((candidate) => candidate.id === config.modelId);
      return {
        provider: 'local',
        contextWindow: pickPositiveNumber(model?.contextWindow, DEFAULT_LOCAL_CONTEXT_WINDOW),
        maxOutputTokens: pickPositiveNumber(model?.maxOutputTokens, DEFAULT_LOCAL_MAX_OUTPUT_TOKENS),
        supportsNativeToolCalls: false,
      };
    }

    case 'custom': {
      return getConfiguredModelProviderCapabilities(
        resolveModelProvider(config.catalog, config.modelRef),
      );
    }
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns an AI SDK `LanguageModel` from any supported provider configuration.
 *
 * - gateway: uses @ai-sdk/gateway — supports native tool calling for all major cloud models
 * - copilot: custom LanguageModelV3 wrapping /api/copilot/chat (tool calling via ReAct prompting)
 * - local:   custom LanguageModelV3 wrapping the in-browser HF worker (tool calling via ReAct prompting)
 * - custom:  harness-core config catalog backed by an OpenAI-compatible provider factory
 */
export function resolveLanguageModel(
  config: AgentModelConfig,
  options: ResolveLanguageModelOptions = {},
): LanguageModel {
  switch (config.kind) {
    case 'gateway':
      return gateway(config.modelId as GatewayModelId);

    case 'copilot':
      return new CopilotLanguageModel(config.modelId, config.sessionId ?? 'copilot-session:fallback') as unknown as LanguageModel;

    case 'cursor':
      return new CursorLanguageModel(config.modelId, config.sessionId ?? 'cursor-session:fallback') as unknown as LanguageModel;

    case 'local':
      return new LocalLanguageModel(config.modelId, config.task ?? 'text-generation') as unknown as LanguageModel;

    case 'custom':
      return createConfiguredModel(
        config.catalog,
        config.modelRef,
        {
          openAICompatible: options.createOpenAICompatibleProvider ?? createDefaultOpenAICompatibleProvider,
        },
        {
          getSecret: (name) => config.secrets?.[name],
        },
      );
  }
}

function createDefaultOpenAICompatibleProvider(options: OpenAICompatibleProviderOptions) {
  const provider = createOpenAICompatible(options);
  return {
    chatModel: (modelId: string) => provider.chatModel(modelId) as unknown as LanguageModel,
  };
}

// ── Auto-selection ────────────────────────────────────────────────────────────


export type ModelRoutingSettings = {
  preferredProviders?: Array<'gateway' | 'custom' | 'cursor' | 'local' | 'copilot'>;
  preferredLocalModelId?: string;
  preferredCopilotModelId?: string;
  preferredCursorModelId?: string;
  gatewayModelId?: GatewayModelId | string;
  customProviderCatalog?: ModelProviderCatalog;
  customModelRef?: string | ModelProviderRef;
  customSecrets?: Record<string, string>;
};

export type RouteAgentModelConfigInput = {
  latestUserTurn: string;
  providerTaskMetadata?: {
    sessionId?: string;
    preferredTask?: string;
  };
  installedModels: HFModel[];
  copilotState: Pick<CopilotRuntimeState, 'available' | 'authenticated' | 'models'>;
  cursorModels?: CursorModelSummary[];
  routingSettings?: ModelRoutingSettings;
};

export function routeAgentModelConfig(input: RouteAgentModelConfigInput): AgentModelConfig {
  const { latestUserTurn, providerTaskMetadata, installedModels, copilotState, cursorModels = [], routingSettings } = input;
  void latestUserTurn;

  const preferredProviders = routingSettings?.preferredProviders ?? ['gateway', 'custom', 'cursor', 'local', 'copilot'];

  for (const provider of preferredProviders) {
    if (provider === 'gateway' && routingSettings?.gatewayModelId) {
      return { kind: 'gateway', modelId: routingSettings.gatewayModelId };
    }

    if (provider === 'custom' && routingSettings?.customProviderCatalog) {
      return {
        kind: 'custom',
        catalog: routingSettings.customProviderCatalog,
        ...(routingSettings.customModelRef ? { modelRef: routingSettings.customModelRef } : {}),
        ...(routingSettings.customSecrets ? { secrets: routingSettings.customSecrets } : {}),
      };
    }

    if (provider === 'cursor' && cursorModels.length > 0) {
      const selectedCursorModel =
        routingSettings?.preferredCursorModelId && cursorModels.some((candidate) => candidate.id === routingSettings.preferredCursorModelId)
          ? routingSettings.preferredCursorModelId
          : cursorModels[0].id;
      return { kind: 'cursor', modelId: selectedCursorModel, sessionId: providerTaskMetadata?.sessionId };
    }

    if (provider === 'local') {
      const localCandidates = installedModels.filter((candidate) => candidate.status === 'installed');
      if (localCandidates.length > 0) {
        const selectedLocalModel =
          routingSettings?.preferredLocalModelId && localCandidates.some((candidate) => candidate.id === routingSettings.preferredLocalModelId)
            ? localCandidates.find((candidate) => candidate.id === routingSettings.preferredLocalModelId)!
            : localCandidates[0];
        return {
          kind: 'local',
          modelId: selectedLocalModel.id,
          task: providerTaskMetadata?.preferredTask ?? selectedLocalModel.task,
        };
      }
    }

    if (provider === 'copilot' && copilotState.available && copilotState.authenticated && copilotState.models.length > 0) {
      const selectedCopilotModel =
        routingSettings?.preferredCopilotModelId && copilotState.models.some((candidate) => candidate.id === routingSettings.preferredCopilotModelId)
          ? routingSettings.preferredCopilotModelId
          : copilotState.models[0].id;
      return { kind: 'copilot', modelId: selectedCopilotModel, sessionId: providerTaskMetadata?.sessionId };
    }
  }

  throw new Error('No inference provider is available. Provide a gatewayModelId, install a local model, connect Cursor/Copilot, or configure a custom provider.');
}

export type AutoProviderOptions = {
  copilotState: Pick<CopilotRuntimeState, 'available' | 'authenticated' | 'models'>;
  installedModels: HFModel[];
  /** When provided, always use the gateway with this model ID. */
  gatewayModelId?: GatewayModelId | string;
  /** Config-backed custom providers supplied without changing app code. */
  customProviderCatalog?: ModelProviderCatalog;
  customModelRef?: string | ModelProviderRef;
  customSecrets?: Record<string, string>;
  /** Preferred copilot model. Falls back to first available. */
  preferredCopilotModelId?: string;
};

/**
 * Picks the best available provider config for the current environment.
 *
 * Priority order:
 *  1. gateway (explicit cloud model key — supports native tool calling)
 *  2. custom  (config-backed OpenAI-compatible provider)
 *  3. local   (installed HF ONNX model — privacy-first, offline)
 *  4. copilot (authenticated GHCP — fallback cloud)
 *
 * Throws if no provider is available.
 */
export function createAutoProvider(options: AutoProviderOptions): AgentModelConfig {
  return routeAgentModelConfig({
    latestUserTurn: '',
    providerTaskMetadata: {},
    installedModels: options.installedModels,
    copilotState: options.copilotState,
    routingSettings: {
      gatewayModelId: options.gatewayModelId,
      customProviderCatalog: options.customProviderCatalog,
      customModelRef: options.customModelRef,
      customSecrets: options.customSecrets,
      preferredCopilotModelId: options.preferredCopilotModelId,
      preferredProviders: ['gateway', 'custom', 'local', 'copilot'],
    },
  });
}
