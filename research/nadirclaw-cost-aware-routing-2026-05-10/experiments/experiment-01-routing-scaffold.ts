export type Tier = 'cheap' | 'balanced' | 'premium';

export interface PromptSample {
  text: string;
  expectedTier: Tier;
  tokens: number;
}

export interface RouteFeatures {
  lengthScore: number;
  codeSignal: boolean;
  toolSignal: boolean;
  reasoningSignal: boolean;
}

export interface RouteDecision {
  tier: Tier;
  score: number;
  forcedPremium: boolean;
}

export interface CostModel {
  cheapPerMTok: number;
  balancedPerMTok: number;
  premiumPerMTok: number;
}

const DEFAULT_COST_MODEL: CostModel = {
  cheapPerMTok: 0.1,
  balancedPerMTok: 0.35,
  premiumPerMTok: 1.25,
};

export function extractFeatures(text: string): RouteFeatures {
  const lower = text.toLowerCase();
  const lengthScore = Math.min(1, text.length / 500);
  const codeSignal = /\b(function|class|typescript|bug|refactor|stack trace|compile)\b/.test(lower);
  const toolSignal = /\b(tool|browser|search|file|workspace|terminal|command)\b/.test(lower);
  const reasoningSignal = /\b(plan|multi-step|prove|analyze|tradeoff|architecture)\b/.test(lower);

  return { lengthScore, codeSignal, toolSignal, reasoningSignal };
}

export function classifyComplexity(features: RouteFeatures): number {
  const base = features.lengthScore * 0.45;
  const code = features.codeSignal ? 0.2 : 0;
  const tool = features.toolSignal ? 0.2 : 0;
  const reasoning = features.reasoningSignal ? 0.25 : 0;
  return Math.min(1, base + code + tool + reasoning);
}

export function routePrompt(text: string): RouteDecision {
  const features = extractFeatures(text);
  const score = classifyComplexity(features);
  const forcedPremium = features.reasoningSignal && features.toolSignal;

  if (forcedPremium || score >= 0.7) {
    return { tier: 'premium', score, forcedPremium };
  }

  if (score >= 0.38) {
    return { tier: 'balanced', score, forcedPremium };
  }

  return { tier: 'cheap', score, forcedPremium };
}

export function estimateCost(tier: Tier, tokens: number, model: CostModel = DEFAULT_COST_MODEL): number {
  const perM = tier === 'cheap' ? model.cheapPerMTok : tier === 'balanced' ? model.balancedPerMTok : model.premiumPerMTok;
  return (tokens / 1_000_000) * perM;
}

export function runSimulation(samples: PromptSample[]): { baseline: number; routed: number; premiumMisses: number } {
  let baseline = 0;
  let routed = 0;
  let premiumMisses = 0;

  for (const sample of samples) {
    baseline += estimateCost('premium', sample.tokens);

    const decision = routePrompt(sample.text);
    routed += estimateCost(decision.tier, sample.tokens);

    if (sample.expectedTier === 'premium' && decision.tier !== 'premium') {
      premiumMisses += 1;
    }
  }

  return { baseline, routed, premiumMisses };
}

export function demoSimulation(): { baselineCost: number; routedCost: number; savingsPct: number; premiumMisses: number } {
  const corpus: PromptSample[] = [
    { text: 'Summarize this paragraph in two bullets.', expectedTier: 'cheap', tokens: 800 },
    { text: 'Search workspace files and propose a 3-step refactor plan with tradeoff analysis.', expectedTier: 'premium', tokens: 3200 },
    { text: 'Fix this TypeScript compile error in one function.', expectedTier: 'balanced', tokens: 1800 },
    { text: 'Design architecture for multi-step agent tool execution and validate failure modes.', expectedTier: 'premium', tokens: 3500 },
  ];

  const result = runSimulation(corpus);
  const savingsPct = ((result.baseline - result.routed) / result.baseline) * 100;

  return {
    baselineCost: result.baseline,
    routedCost: result.routed,
    savingsPct,
    premiumMisses: result.premiumMisses,
  };
}
