# ADR: Model Pool and Routing — Router-over-Pool Endpoint

## Status
Proposed (extends `agent-browser/docs/adr/2026-05-14-routing-extension-contract.md`)

## Decision
Grow the existing routing stack toward a Sakana-Fugu-style
router-over-model-pool: one logical endpoint fronting a swappable pool of
local and cloud models, selecting per request (or assembling ensembles) by
learned/benchmarked policy. Ornith 1.0 joins as a second local tier via the
ollama-compatible `ext/local-model-connector`, beside the in-browser
transformers.js/ONNX tier.

## Contract
- The routing extension contract from the 2026-05-14 ADR is unchanged and
  governs rollout (`routing.*` configuration surface, telemetry payload,
  shadow → enforce → core-default).
- Pool membership: configured models from `modelProviders.ts`
  (`defineModelProviderCatalog`, `createConfiguredModel`) across providers
  (`ext/` provider plugins, local-model-connector, browser ONNX worker).
- Selection inputs: existing complexity/security/compliance thresholds plus
  benchmark-derived scores (`benchmarkModelRouting.ts`) and cost curves
  (`lib/cost-aware-routing`); decisions and cost deltas emit through
  `routingObservability.ts` per the existing telemetry payload.
- Ensembles: multi-model answer/vote flows reuse the existing voter
  machinery (`toolUseVoters.ts`, workflow voters) rather than a new
  ensemble engine.
- Local tiers: in-browser ONNX (transformers.js worker,
  `localLanguageModel.ts` ReAct fallback) for offline/private inference;
  Ornith via ollama for scaffold-generation-capable local coding
  (`ext/local-model-connector` presets). Server-side speculative-decoding
  acceleration (DSpark/DeepSpec, SSD) applies to the ollama/agent-daemon
  tier only — see the master doc's techniques radar.

## Rollout phases
1. **Phase 0 (shadow):** pool router scores every request, records
   would-have-routed decisions; manual selection still wins.
2. **Phase 1 (opt-in enforce):** `routing.mode=enforce` routes across the
   pool including local tiers; per-workspace opt-in.
3. **Phase 2 (core-default):** the pool endpoint is the default model
   surface; direct model selection remains available as an override.

## Migration notes
- No change to provider plugins; the pool composes what the catalog already
  declares.
- Router policy text (thresholds, escalation keywords) is an optimizable
  artifact under the self-improvement loop's eval gate.
