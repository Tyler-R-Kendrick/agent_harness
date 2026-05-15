import { describe, expect, it } from 'vitest';

import {
  classifyPrompt,
  DEFAULT_ROUTING_STRATEGY,
  DEFAULT_COMPLEXITY_ROUTING_POLICY,
  routeByComplexity,
  type ClassifiedPrompt,
} from './requestComplexityRouting';

describe('requestComplexityRouting', () => {
  it('classifies lightweight prompts as simple', () => {
    const result = classifyPrompt('What is 2+2?');

    expect(result.tier).toBe('simple');
    expect(result.reasons).toContain('lightweight_prompt');
    expect(result.score).toBeLessThan(DEFAULT_COMPLEXITY_ROUTING_POLICY.complexityThreshold);
  });

  it('classifies complex prompts by reasoning and tooling cues', () => {
    const result = classifyPrompt('Design API architecture and debug this endpoint pipeline');

    expect(result.tier).toBe('complex');
    expect(result.reasons).toContain('reasoning_intent');
    expect(result.reasons).toContain('tooling_intent');
    expect(result.score).toBeGreaterThanOrEqual(DEFAULT_COMPLEXITY_ROUTING_POLICY.complexityThreshold);
  });

  it('routes escalations to premium model', () => {
    const classified = classifyPrompt('Need security review for this feature');

    const decision = routeByComplexity(classified, DEFAULT_COMPLEXITY_ROUTING_POLICY);

    expect(decision.model).toBe(DEFAULT_COMPLEXITY_ROUTING_POLICY.premiumModel);
    expect(decision.tier).toBe('complex');
    expect(decision.reasons).toContain('escalation_keyword');
  });

  it('routes low-confidence prompts to premium fallback', () => {
    const lowConfidence: ClassifiedPrompt = {
      tier: 'simple',
      score: 0.55,
      confidence: 0.1,
      reasons: ['boundary_case'],
    };

    const decision = routeByComplexity(lowConfidence, DEFAULT_COMPLEXITY_ROUTING_POLICY);

    expect(decision.model).toBe(DEFAULT_COMPLEXITY_ROUTING_POLICY.premiumModel);
    expect(decision.reasons).toContain('low_confidence_fallback');
  });

  it('uses boundary threshold for normal routing', () => {
    const atBoundary: ClassifiedPrompt = {
      tier: 'complex',
      score: DEFAULT_COMPLEXITY_ROUTING_POLICY.complexityThreshold,
      confidence: 0.8,
      reasons: ['reasoning_intent'],
    };

    const decision = routeByComplexity(atBoundary, DEFAULT_COMPLEXITY_ROUTING_POLICY);

    expect(decision.model).toBe(DEFAULT_COMPLEXITY_ROUTING_POLICY.premiumModel);
  });

  it('supports optional session pinning', () => {
    const simple: ClassifiedPrompt = {
      tier: 'simple',
      score: 0.1,
      confidence: 0.7,
      reasons: ['lightweight_prompt'],
    };

    const decision = routeByComplexity(
      simple,
      { ...DEFAULT_COMPLEXITY_ROUTING_POLICY, enableSessionPinning: true },
      { sessionPinnedModel: 'pinned-model' },
    );

    expect(decision.model).toBe('pinned-model');
    expect(decision.reasons).toContain('session_pinned_model');
  });

  it('uses default routing strategy classify/recommend/finalize contract', () => {
    const classified = DEFAULT_ROUTING_STRATEGY.classify('Design architecture with tooling and security review');
    const recommended = DEFAULT_ROUTING_STRATEGY.recommend(
      ['Design architecture with tooling and security review'],
      DEFAULT_COMPLEXITY_ROUTING_POLICY,
    );
    const finalized = DEFAULT_ROUTING_STRATEGY.finalize(recommended, {
      requireEscalation: true,
      requireConfidenceFallback: true,
    });

    expect(classified.tier).toBe('complex');
    expect(recommended.model).toBe(DEFAULT_COMPLEXITY_ROUTING_POLICY.premiumModel);
    expect(finalized.reasons).toEqual(expect.arrayContaining(recommended.reasons));
  });
});
