# Cost-Aware Routing

Cost-aware routing is a deterministic model-tier policy for Agent Harness routing experiments. It classifies prompts from local text features, applies escalation and confidence fallbacks, and returns the model/provider decision without network calls or side effects.

Use it when a caller needs a small, explainable default policy before handing a request to a model provider:

```ts
import { routePrompt } from 'cost-aware-routing';

const decision = routePrompt('Debug API latency and design a retry strategy.');

console.log(decision.modelId);
console.log(decision.reasons);
```

## Core API

- `routePrompt(prompt, config)` returns the selected tier, model/provider IDs, reasons, score, confidence, and extracted features.
- `classifyPrompt(prompt, config)` returns the tiering decision without attaching model/provider IDs.
- `extractPromptFeatures(prompt, escalationKeywords)` exposes the deterministic feature extractor for tests and experiments.
- `normalizeRoutingConfig(config)` clamps thresholds and fills default model/provider settings.
- `computeScoreFromFeatures(features)` exposes the scoring function for policy experiments.

## Package boundary

Import cost-aware routing through the stable package root:

```ts
import { routePrompt } from 'cost-aware-routing';
```

Files under `cost-aware-routing/src/*` are implementation details. Do not deep-import them from consumers; add explicit root exports in `src/index.ts` when a new API needs to be public.

## Validation

Run:

```powershell
npm.cmd --workspace cost-aware-routing run test:coverage
```

The package enforces 100% statement, branch, function, and line coverage.
