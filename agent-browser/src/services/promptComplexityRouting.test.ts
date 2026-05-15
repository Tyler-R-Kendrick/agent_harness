import { describe, expect, it } from 'vitest';

import {
  classifyPrompt,
  DEFAULT_PROMPT_COMPLEXITY_POLICY_CONFIG,
  routeByComplexity,
  type PromptModelCandidate,
} from './promptComplexityRouting';

const MODEL_CANDIDATES: PromptModelCandidate[] = [
  { ref: 'cheap-model', tier: 'simple' },
  { ref: 'premium-model', tier: 'complex' },
];

describe('promptComplexityRouting', () => {
  it('classifies lightweight prompts as simple', () => {
    const result = classifyPrompt('What is 2+2?');

    expect(result.tier).toBe('simple');
    expect(result.reasons).toContain('lightweight_prompt');
    expect(result.score).toBeLessThan(DEFAULT_PROMPT_COMPLEXITY_POLICY_CONFIG.complexityThreshold);
  });


  it('supports custom complexity thresholds during classification', () => {
    const result = classifyPrompt('analyze', { complexityThreshold: 0.35 });

    expect(result.tier).toBe('complex');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('classifies complex prompts with reasoning and tooling cues', () => {
    const result = classifyPrompt('Design API architecture and debug this endpoint pipeline');

    expect(result.tier).toBe('complex');
    expect(result.reasons).toContain('reasoning_intent');
    expect(result.reasons).toContain('tooling_intent');
  });

  it('routes escalation keywords to premium model', () => {
    const result = routeByComplexity(
      'Need a security review for this change',
      DEFAULT_PROMPT_COMPLEXITY_POLICY_CONFIG,
      MODEL_CANDIDATES,
    );

    expect(result.selectedModelRef).toBe('premium-model');
    expect(result.tier).toBe('complex');
    expect(result.reasons).toContain('escalation_keyword');
  });

  it('uses low-confidence premium fallback', () => {
    const result = routeByComplexity(
      'analyze',
      { ...DEFAULT_PROMPT_COMPLEXITY_POLICY_CONFIG, minConfidence: 0.2 },
      MODEL_CANDIDATES,
    );

    expect(result.selectedModelRef).toBe('premium-model');
    expect(result.reasons).toContain('low_confidence_fallback');
  });

  it('throws when candidates do not contain both tiers', () => {
    expect(() =>
      routeByComplexity('hello', DEFAULT_PROMPT_COMPLEXITY_POLICY_CONFIG, [{ ref: 'only', tier: 'simple' }]),
    ).toThrow('modelCandidates must include both simple and complex tier candidates');
  });
});
