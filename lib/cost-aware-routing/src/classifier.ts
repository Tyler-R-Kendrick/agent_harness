import { extractPromptFeatures } from './featureExtractor.js';
import type { PromptFeatures, RoutingConfig, RoutingDecision, RoutingTier } from './types.js';

export const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  cheapModelId: 'gpt-4.1-mini',
  cheapProvider: 'openai',
  premiumModelId: 'gpt-5',
  premiumProvider: 'openai',
  complexityThreshold: 0.55,
  minConfidence: 0.25,
  escalationKeywords: ['security', 'compliance', 'incident', 'outage'],
};

export function normalizeRoutingConfig(config: Partial<RoutingConfig> = {}): RoutingConfig {
  const complexityThreshold = Math.min(
    1,
    Math.max(0, config.complexityThreshold ?? DEFAULT_ROUTING_CONFIG.complexityThreshold),
  );
  const minConfidence = Math.min(1, Math.max(0, config.minConfidence ?? DEFAULT_ROUTING_CONFIG.minConfidence));

  return {
    cheapModelId: config.cheapModelId ?? DEFAULT_ROUTING_CONFIG.cheapModelId,
    cheapProvider: config.cheapProvider ?? DEFAULT_ROUTING_CONFIG.cheapProvider,
    premiumModelId: config.premiumModelId ?? DEFAULT_ROUTING_CONFIG.premiumModelId,
    premiumProvider: config.premiumProvider ?? DEFAULT_ROUTING_CONFIG.premiumProvider,
    complexityThreshold,
    minConfidence,
    escalationKeywords: config.escalationKeywords ?? DEFAULT_ROUTING_CONFIG.escalationKeywords,
  };
}

export function computeScoreFromFeatures(features: PromptFeatures): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  score += features.estimatedLengthScore;
  if (features.estimatedLengthScore > 0.2) {
    reasons.push('long_prompt');
  }

  if (features.hasReasoningCue) {
    score += 0.4;
    reasons.push('reasoning_intent');
  }

  if (features.hasToolCue) {
    score += 0.3;
    reasons.push('tooling_intent');
  }

  if (reasons.length === 0) {
    reasons.push('lightweight_prompt');
  }

  return { score: Math.min(score, 1), reasons };
}

export function classifyPrompt(prompt: string, config: Partial<RoutingConfig> = {}): Omit<RoutingDecision, 'modelId' | 'provider'> {
  const resolvedConfig = normalizeRoutingConfig(config);
  const features = extractPromptFeatures(prompt, resolvedConfig.escalationKeywords);
  const { score, reasons } = computeScoreFromFeatures(features);
  const tier: RoutingTier = score >= resolvedConfig.complexityThreshold ? 'complex' : 'simple';
  const confidence = Math.max(0.05, Math.abs(score - resolvedConfig.complexityThreshold));

  return {
    tier,
    score,
    confidence,
    reasons,
    features,
  };
}
