# Reference Architecture: Cost-Aware Routing for Agent Browser

## Goal

Embed a deterministic, observable, and provider-agnostic model router in the agent-browser runtime so low-complexity turns default to low-cost models while preserving quality for complex turns.

## Components

1. **RouteFeatureExtractor**
   - Inputs: request text, system prompt, tool plan metadata, session history signals.
   - Output: typed `RouteFeatures` object.

2. **ComplexityClassifier**
   - Deterministic weighted score from features.
   - Optional pluggable embedding classifier adapter for parity with NadirClaw-style local classification.

3. **RoutingPolicyEngine**
   - Maps score + guardrails to `cheap | balanced | premium` tiers.
   - Supports hard overrides (`forcePremium`, `forceLocal`, compliance tags).

4. **ProviderResolver**
   - Resolves tier to provider/model chain (e.g., Gemini Flash-Lite -> Gemini Flash -> Gemini Pro).
   - Handles fallback escalation and timeout budget partitioning.

5. **CostLedger + TelemetrySink**
   - Logs route decision, token estimates, actual cost, fallback reasons.
   - Supports dashboarding and regression assertions.

## Data flow

1. Agent turn arrives in chat-agent runtime.
2. Feature extractor computes complexity features.
3. Policy engine assigns tier and provider chain.
4. Request executed via provider resolver.
5. Fallback occurs if model fails SLA/error constraints.
6. Decision + spend metrics emitted to telemetry.

## Safety and validation gates

- Force premium tier for:
  - Multi-step planning intent with tool recursion.
  - Explicit high-risk output classes (policy/security-sensitive instructions).
  - Repeated prior failures in same session.
- Reject invalid policy config at startup (missing tier, empty fallback chain, negative threshold bounds).
- Emit route-decision audit object for every call.

## Rollout policy

1. **Shadow mode:** compute route decision while still using baseline model.
2. **Soft launch:** enable routing for low-risk chat-agent cohorts.
3. **Ramp:** gradually increase traffic under guardrail SLOs.
4. **Steady-state:** continuous threshold tuning from telemetry.

## Success metrics

- 30-60% reduction in blended token cost per turn.
- <5% relative quality regression on acceptance task suite.
- P95 routing overhead <15 ms.
- Fallback rate remains below configured SLO (e.g., 3%).
