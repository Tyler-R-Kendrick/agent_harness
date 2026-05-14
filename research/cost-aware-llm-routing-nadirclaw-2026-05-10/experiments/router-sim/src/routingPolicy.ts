export type Tier = 'simple' | 'complex';

export interface RoutingConfig {
  cheapModel: string;
  premiumModel: string;
  complexityThreshold: number;
  minConfidence: number;
  escalationKeywords: string[];
}

export interface RoutingDecision {
  tier: Tier;
  score: number;
  confidence: number;
  model: string;
  reasons: string[];
}

const REASONING_CUES = ['analyze', 'design', 'architecture', 'debug', 'tradeoff', 'optimize'];
const TOOLING_CUES = ['tool', 'api', 'endpoint', 'playwright', 'pipeline', 'refactor'];

export function classifyPrompt(prompt: string): Omit<RoutingDecision, 'model'> {
  const normalized = prompt.toLowerCase();
  const reasons: string[] = [];

  let score = 0;
  const lengthScore = Math.min(normalized.length / 600, 0.35);
  score += lengthScore;
  if (lengthScore > 0.2) reasons.push('long_prompt');

  if (REASONING_CUES.some((cue) => normalized.includes(cue))) {
    score += 0.4;
    reasons.push('reasoning_intent');
  }

  if (TOOLING_CUES.some((cue) => normalized.includes(cue))) {
    score += 0.3;
    reasons.push('tooling_intent');
  }

  const bounded = Math.min(score, 1);
  const tier: Tier = bounded >= 0.55 ? 'complex' : 'simple';
  const confidence = Math.max(0.05, Math.abs(bounded - 0.55));

  if (reasons.length === 0) {
    reasons.push('lightweight_prompt');
  }

  return { tier, score: bounded, confidence, reasons };
}

export function routePrompt(prompt: string, config: RoutingConfig): RoutingDecision {
  const classified = classifyPrompt(prompt);
  const normalized = prompt.toLowerCase();

  if (config.escalationKeywords.some((word) => normalized.includes(word))) {
    return {
      ...classified,
      tier: 'complex',
      model: config.premiumModel,
      reasons: [...classified.reasons, 'escalation_keyword'],
    };
  }

  if (classified.confidence < config.minConfidence) {
    return {
      ...classified,
      model: config.premiumModel,
      reasons: [...classified.reasons, 'low_confidence_fallback'],
    };
  }

  const model = classified.score >= config.complexityThreshold ? config.premiumModel : config.cheapModel;
  return { ...classified, model };
}

export const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  cheapModel: 'gemini-3-flash',
  premiumModel: 'gemini-2.5-pro',
  complexityThreshold: 0.55,
  minConfidence: 0.25,
  escalationKeywords: ['security', 'compliance', 'incident', 'outage'],
};
