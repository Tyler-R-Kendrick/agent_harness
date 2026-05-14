import { classifyPrompt, normalizeRoutingConfig, routePrompt } from '../index.js';

describe('cost-aware routing policy', () => {
  it('routes simple prompts to cheap model', () => {
    const decision = routePrompt('Summarize this note in one sentence.');

    expect(decision.tier).toBe('simple');
    expect(decision.modelId).toBe('gpt-4.1-mini');
    expect(decision.provider).toBe('openai');
    expect(decision.reasons).toContain('lightweight_prompt');
  });

  it('routes complex prompts to premium model', () => {
    const decision = routePrompt('Design architecture and analyze API tradeoff and refactor pipeline.');

    expect(decision.tier).toBe('complex');
    expect(decision.modelId).toBe('gpt-5');
    expect(decision.provider).toBe('openai');
    expect(decision.reasons).toContain('reasoning_intent');
    expect(decision.reasons).toContain('tooling_intent');
  });

  it('applies escalation override to premium model', () => {
    const decision = routePrompt('Please summarize this outage report.');

    expect(decision.modelId).toBe('gpt-5');
    expect(decision.reasons).toContain('escalation_keyword');
    expect(decision.features.hasEscalationCue).toBe(true);
  });

  it('applies low-confidence fallback to premium model', () => {
    const decision = routePrompt('Analyze quickly.', { minConfidence: 0.6 });

    expect(decision.modelId).toBe('gpt-5');
    expect(decision.reasons).toContain('low_confidence_fallback');
  });

  it('clamps config values and applies defaults', () => {
    const normalized = normalizeRoutingConfig({
      complexityThreshold: 7,
      minConfidence: -2,
      cheapModelId: 'cheap-x',
    });

    expect(normalized.complexityThreshold).toBe(1);
    expect(normalized.minConfidence).toBe(0);
    expect(normalized.cheapModelId).toBe('cheap-x');
    expect(normalized.premiumModelId).toBe('gpt-5');
    expect(normalized.escalationKeywords).toEqual(['security', 'compliance', 'incident', 'outage']);
  });

  it('is deterministic for same input and config', () => {
    const prompt = 'Debug API endpoint design for reliability.';
    const config = { minConfidence: 0.15, complexityThreshold: 0.55 };

    const first = routePrompt(prompt, config);
    const second = routePrompt(prompt, config);

    expect(second).toStrictEqual(first);
  });


  it('detects long prompt length cue', () => {
    const longPrompt = 'x'.repeat(400);
    const decision = routePrompt(longPrompt);

    expect(decision.features.estimatedLengthScore).toBeGreaterThan(0.2);
    expect(decision.reasons).toContain('long_prompt');
  });

  it('classifyPrompt exposes bounded score and minimum confidence floor', () => {
    const result = classifyPrompt('A');

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.confidence).toBeGreaterThanOrEqual(0.05);
  });
});
