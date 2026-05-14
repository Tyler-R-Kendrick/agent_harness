import { classifyPrompt, normalizeRoutingConfig } from './classifier.js';
import type { RoutingConfig, RoutingDecision } from './types.js';

export function routePrompt(prompt: string, config: Partial<RoutingConfig> = {}): RoutingDecision {
  const resolvedConfig = normalizeRoutingConfig(config);
  const classified = classifyPrompt(prompt, resolvedConfig);

  if (classified.features.hasEscalationCue) {
    return {
      ...classified,
      tier: 'complex',
      modelId: resolvedConfig.premiumModelId,
      provider: resolvedConfig.premiumProvider,
      reasons: [...classified.reasons, 'escalation_keyword'],
    };
  }

  if (classified.confidence < resolvedConfig.minConfidence) {
    return {
      ...classified,
      modelId: resolvedConfig.premiumModelId,
      provider: resolvedConfig.premiumProvider,
      reasons: [...classified.reasons, 'low_confidence_fallback'],
    };
  }

  if (classified.score >= resolvedConfig.complexityThreshold) {
    return {
      ...classified,
      modelId: resolvedConfig.premiumModelId,
      provider: resolvedConfig.premiumProvider,
    };
  }

  return {
    ...classified,
    modelId: resolvedConfig.cheapModelId,
    provider: resolvedConfig.cheapProvider,
  };
}
