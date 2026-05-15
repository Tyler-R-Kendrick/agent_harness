export type PromptComplexityTier = 'simple' | 'complex';

export interface PromptComplexityContext {
  complexityThreshold?: number;
}

export interface PromptComplexityClassification {
  score: number;
  tier: PromptComplexityTier;
  confidence: number;
  reasons: string[];
}

export interface PromptComplexityPolicyConfig {
  complexityThreshold: number;
  minConfidence: number;
  escalationKeywords: string[];
}

export interface PromptModelCandidate {
  ref: string;
  tier: PromptComplexityTier;
}

export interface PromptComplexityRoutingDecision extends PromptComplexityClassification {
  selectedModelRef: string;
}

const REASONING_CUES = ['analyze', 'design', 'architecture', 'debug', 'tradeoff', 'optimize'] as const;
const TOOLING_CUES = ['tool', 'api', 'endpoint', 'playwright', 'pipeline', 'refactor'] as const;

export const DEFAULT_PROMPT_COMPLEXITY_POLICY_CONFIG: PromptComplexityPolicyConfig = {
  complexityThreshold: 0.55,
  minConfidence: 0.25,
  escalationKeywords: ['security', 'compliance', 'incident', 'outage'],
};

export function classifyPrompt(prompt: string, context?: PromptComplexityContext): PromptComplexityClassification {
  const normalized = prompt.toLowerCase();
  const reasons: string[] = [];

  let score = 0;
  const lengthScore = Math.min(normalized.length / 600, 0.35);
  score += lengthScore;
  if (lengthScore > 0.2) {
    reasons.push('long_prompt');
  }

  if (REASONING_CUES.some((cue) => normalized.includes(cue))) {
    score += 0.4;
    reasons.push('reasoning_intent');
  }

  if (TOOLING_CUES.some((cue) => normalized.includes(cue))) {
    score += 0.3;
    reasons.push('tooling_intent');
  }

  const bounded = Math.min(score, 1);
  const threshold = context?.complexityThreshold ?? DEFAULT_PROMPT_COMPLEXITY_POLICY_CONFIG.complexityThreshold;
  const tier: PromptComplexityTier = bounded >= threshold ? 'complex' : 'simple';
  const confidence = Math.max(0.05, Math.abs(bounded - threshold));

  if (reasons.length === 0) {
    reasons.push('lightweight_prompt');
  }

  return { score: bounded, tier, confidence, reasons };
}

export function routeByComplexity(
  prompt: string,
  policyConfig: PromptComplexityPolicyConfig,
  modelCandidates: PromptModelCandidate[],
): PromptComplexityRoutingDecision {
  const classified = classifyPrompt(prompt, { complexityThreshold: policyConfig.complexityThreshold });
  const normalized = prompt.toLowerCase();

  const premiumCandidate = modelCandidates.find((candidate) => candidate.tier === 'complex');
  const cheapCandidate = modelCandidates.find((candidate) => candidate.tier === 'simple');

  if (!premiumCandidate || !cheapCandidate) {
    throw new Error('modelCandidates must include both simple and complex tier candidates');
  }

  if (policyConfig.escalationKeywords.some((word) => normalized.includes(word.toLowerCase()))) {
    return {
      ...classified,
      tier: 'complex',
      selectedModelRef: premiumCandidate.ref,
      reasons: [...classified.reasons, 'escalation_keyword'],
    };
  }

  if (classified.confidence < policyConfig.minConfidence) {
    return {
      ...classified,
      selectedModelRef: premiumCandidate.ref,
      reasons: [...classified.reasons, 'low_confidence_fallback'],
    };
  }

  const selectedModelRef =
    classified.score >= policyConfig.complexityThreshold ? premiumCandidate.ref : cheapCandidate.ref;

  return {
    ...classified,
    selectedModelRef,
  };
}
