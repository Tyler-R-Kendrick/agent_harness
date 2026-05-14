import { describe, expect, it } from 'vitest';
import { classifyPrompt, DEFAULT_ROUTING_CONFIG, routePrompt } from '../routingPolicy';

describe('classifyPrompt', () => {
  it('classifies lightweight prompt as simple', () => {
    const result = classifyPrompt('What is 2+2?');
    expect(result.tier).toBe('simple');
    expect(result.reasons).toContain('lightweight_prompt');
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('classifies reasoning+tooling prompt as complex', () => {
    const result = classifyPrompt('Design API architecture and debug this endpoint pipeline');
    expect(result.tier).toBe('complex');
    expect(result.reasons).toContain('reasoning_intent');
    expect(result.reasons).toContain('tooling_intent');
  });
});

describe('routePrompt', () => {
  it('routes simple prompts to cheap model', () => {
    const result = routePrompt('Summarize this one sentence.', DEFAULT_ROUTING_CONFIG);
    expect(result.model).toBe(DEFAULT_ROUTING_CONFIG.cheapModel);
  });

  it('routes complex prompts to premium model', () => {
    const result = routePrompt('Design and optimize a resilient API architecture with tradeoff analysis', DEFAULT_ROUTING_CONFIG);
    expect(result.model).toBe(DEFAULT_ROUTING_CONFIG.premiumModel);
  });

  it('forces premium on escalation keyword', () => {
    const result = routePrompt('Quick note about security checklist.', DEFAULT_ROUTING_CONFIG);
    expect(result.model).toBe(DEFAULT_ROUTING_CONFIG.premiumModel);
    expect(result.reasons).toContain('escalation_keyword');
  });

  it('forces premium on low confidence', () => {
    const result = routePrompt('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', DEFAULT_ROUTING_CONFIG);
    expect(result.model).toBe(DEFAULT_ROUTING_CONFIG.premiumModel);
    expect(result.reasons).toContain('low_confidence_fallback');
  });
});
