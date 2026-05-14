export { extractPromptFeatures } from './featureExtractor.js';
export {
  DEFAULT_ROUTING_CONFIG,
  classifyPrompt,
  computeScoreFromFeatures,
  normalizeRoutingConfig,
} from './classifier.js';
export { routePrompt } from './policyEngine.js';

export type {
  PromptFeatures,
  RoutingConfig,
  RoutingDecision,
  RoutingTelemetryEvent,
  RoutingTier,
} from './types.js';
