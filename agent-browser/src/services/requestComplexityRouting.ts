export type RequestTier = 'simple' | 'complex';

export interface PromptComplexityContext {
  sessionPinnedModel?: string;
}

export interface ClassifiedPrompt {
  tier: RequestTier;
  score: number;
  confidence: number;
  reasons: string[];
}

export interface ComplexityRoutingPolicy {
  cheapModel: string;
  premiumModel: string;
  complexityThreshold: number;
  minConfidence: number;
  escalationKeywords: string[];
  enableSessionPinning?: boolean;
}

export interface ComplexityRoutingDecision extends ClassifiedPrompt {
  model: string;
}

export interface RoutingStrategy<RequestContext = string, Settings = ComplexityRoutingPolicy, Candidate = string, Decision = ComplexityRoutingDecision> {
  classify(requestContext: RequestContext): ClassifiedPrompt;
  recommend(candidates: Candidate[], settings: Settings): Decision;
  finalize(decision: Decision, safeguards: { requireEscalation: boolean; requireConfidenceFallback: boolean }): Decision;
}
const REASONING_CUES = ['analyze', 'design', 'architecture', 'debug', 'tradeoff', 'optimize'] as const;
const TOOLING_CUES = ['tool', 'api', 'endpoint', 'playwright', 'pipeline', 'refactor'] as const;
const DEFAULT_ESCALATION_CUES = ['security', 'compliance', 'incident', 'outage'] as const;

export const DEFAULT_COMPLEXITY_ROUTING_POLICY: ComplexityRoutingPolicy = {
  cheapModel: 'gemini-3-flash',
  premiumModel: 'gemini-2.5-pro',
  complexityThreshold: 0.55,
  minConfidence: 0.25,
  escalationKeywords: ['security', 'compliance', 'incident', 'outage'],
  enableSessionPinning: false,
};

export const DEFAULT_ROUTING_STRATEGY: RoutingStrategy<string, ComplexityRoutingPolicy, string, ComplexityRoutingDecision> = {
  classify: (requestContext) => classifyPrompt(requestContext),
  recommend: (candidates, settings) => {
    const classified = candidates[0] ? classifyPrompt(candidates[0]) : classifyPrompt('');
    return routeByComplexity(classified, settings);
  },
  finalize: (decision, safeguards) => {
    const nextReasons = [...decision.reasons];
    if (safeguards.requireEscalation && decision.tier === 'complex' && !nextReasons.includes('escalation_keyword')) {
      nextReasons.push('safeguard:escalation-invariant');
    }
    if (safeguards.requireConfidenceFallback && decision.confidence < DEFAULT_COMPLEXITY_ROUTING_POLICY.minConfidence && !nextReasons.includes('low_confidence_fallback')) {
      nextReasons.push('safeguard:confidence-fallback-invariant');
    }
    return { ...decision, reasons: nextReasons };
  },
};
export function classifyPrompt(prompt: string, _context?: PromptComplexityContext): ClassifiedPrompt {
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

  for (const cue of DEFAULT_ESCALATION_CUES) {
    if (normalized.includes(cue)) {
      reasons.push(`escalation:${cue}`);
    }
  }

  const bounded = Math.min(score, 1);
  const tier: RequestTier = bounded >= 0.55 ? 'complex' : 'simple';
  const confidence = Math.max(0.05, Math.abs(bounded - 0.55));

  if (reasons.length === 0) {
    reasons.push('lightweight_prompt');
  }

  return { tier, score: bounded, confidence, reasons };
}

export function routeByComplexity(
  classified: ClassifiedPrompt,
  policy: ComplexityRoutingPolicy,
  context?: PromptComplexityContext,
): ComplexityRoutingDecision {
  if (policy.enableSessionPinning && context?.sessionPinnedModel) {
    return {
      ...classified,
      model: context.sessionPinnedModel,
      reasons: [...classified.reasons, 'session_pinned_model'],
    };
  }

  const hasEscalationKeyword = policy.escalationKeywords.some((word) =>
    classified.reasons.includes(`escalation:${word.toLowerCase()}`),
  );

  if (hasEscalationKeyword) {
    return {
      ...classified,
      tier: 'complex',
      model: policy.premiumModel,
      reasons: [...classified.reasons, 'escalation_keyword'],
    };
  }

  if (classified.confidence < policy.minConfidence) {
    return {
      ...classified,
      model: policy.premiumModel,
      reasons: [...classified.reasons, 'low_confidence_fallback'],
    };
  }

  const model = classified.score >= policy.complexityThreshold ? policy.premiumModel : policy.cheapModel;
  return { ...classified, model };
}
