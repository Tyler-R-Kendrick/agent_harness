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
import type { LanguageModel } from 'ai';
import type { CopilotRuntimeState } from './copilotApi';
import type { HFModel } from '../types';
import { CopilotLanguageModel } from './copilotLanguageModel';
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
};

export type LocalModelConfig = {
  kind: 'local';
  /** HuggingFace ONNX model ID */
  modelId: string;
  task?: string;
};

export type AgentModelConfig = GatewayModelConfig | CopilotModelConfig | LocalModelConfig;

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns an AI SDK `LanguageModel` from any supported provider configuration.
 *
 * - gateway: uses @ai-sdk/gateway — supports native tool calling for all major cloud models
 * - copilot: custom LanguageModelV3 wrapping /api/copilot/chat (tool calling via ReAct prompting)
 * - local:   custom LanguageModelV3 wrapping the in-browser HF worker (tool calling via ReAct prompting)
 */
export function resolveLanguageModel(config: AgentModelConfig): LanguageModel {
  switch (config.kind) {
    case 'gateway':
      return gateway(config.modelId as GatewayModelId);

    case 'copilot':
      return new CopilotLanguageModel(config.modelId) as unknown as LanguageModel;

    case 'local':
      return new LocalLanguageModel(config.modelId, config.task ?? 'text-generation') as unknown as LanguageModel;
  }
}

// ── Auto-selection ────────────────────────────────────────────────────────────

export type AutoProviderOptions = {
  copilotState: Pick<CopilotRuntimeState, 'available' | 'authenticated' | 'models'>;
  installedModels: HFModel[];
  /** When provided, always use the gateway with this model ID. */
  gatewayModelId?: GatewayModelId | string;
  /** Preferred copilot model. Falls back to first available. */
  preferredCopilotModelId?: string;
};

/**
 * Picks the best available provider config for the current environment.
 *
 * Priority order:
 *  1. gateway (explicit cloud model key — supports native tool calling)
 *  2. local   (installed HF ONNX model — privacy-first, offline)
 *  3. copilot (authenticated GHCP — fallback cloud)
 *
 * Throws if no provider is available.
 */
export function createAutoProvider(options: AutoProviderOptions): AgentModelConfig {
  const { copilotState, installedModels, gatewayModelId, preferredCopilotModelId } = options;

  if (gatewayModelId) {
    return { kind: 'gateway', modelId: gatewayModelId };
  }

  const installed = installedModels.filter((m) => m.status === 'installed');
  if (installed.length > 0) {
    const preferred = installed[0];
    return { kind: 'local', modelId: preferred.id, task: preferred.task };
  }

  if (copilotState.available && copilotState.authenticated && copilotState.models.length > 0) {
    const modelId =
      preferredCopilotModelId && copilotState.models.some((m) => m.id === preferredCopilotModelId)
        ? preferredCopilotModelId
        : copilotState.models[0].id;
    return { kind: 'copilot', modelId };
  }

  throw new Error('No inference provider is available. Provide a gatewayModelId, install a local model, or sign in to GitHub Copilot.');
}
