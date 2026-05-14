export type RoutingTier = 'simple' | 'complex';

export type PromptFeatures = {
  normalizedPrompt: string;
  estimatedLengthScore: number;
  hasReasoningCue: boolean;
  hasToolCue: boolean;
  hasEscalationCue: boolean;
  matchedReasoningCues: string[];
  matchedToolCues: string[];
  matchedEscalationCues: string[];
};

export type RoutingConfig = {
  cheapModelId: string;
  cheapProvider: string;
  premiumModelId: string;
  premiumProvider: string;
  complexityThreshold: number;
  minConfidence: number;
  escalationKeywords: string[];
};

export type RoutingDecision = {
  tier: RoutingTier;
  score: number;
  confidence: number;
  modelId: string;
  provider: string;
  reasons: string[];
  features: PromptFeatures;
};

export type RoutingTelemetryEvent = {
  event: 'route_decision';
  timestampMs: number;
  decision: RoutingDecision;
  config: RoutingConfig;
};
