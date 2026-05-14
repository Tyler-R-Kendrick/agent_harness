# ADR: Routing Extension Contract for Cost-Aware Model Selection

## Status
Accepted (initial shadow rollout)

## Decision
Introduce a routing extension contract that can operate as a pluggable extension now and be promoted to a native core runtime component later.

## Contract
Configuration surface (global / project / session):
- `routing.enabled`
- `routing.policyId`
- `routing.cheapModel`
- `routing.premiumModel`
- `routing.thresholds` (complexity/security/compliance)
- `routing.escalationKeywords`
- `routing.mode` (`shadow` default, `enforce` behind flag)

Telemetry payload (process/log surfaces):
- selected provider/model
- score/confidence
- reason vector
- estimated cost delta USD / %

## Rollout phases
1. **Phase 0 (shadow, record-only):** router emits telemetry but never overrides model choice.
2. **Phase 1 (opt-in enforce):** routing decisions can switch model when `routing.mode=enforce` and `routing.enabled=true`.
3. **Phase 2 (core-default):** native core component enabled by default; extension remains policy hook surface.

## Migration notes
- Existing sessions keep manual model selection behavior until `routing.enabled` is set.
- Tooling writes scoped routing config via session tools and records decisions via telemetry tools.
