# ADR: Observability — OTel GenAI Exporter and Reward-Slotted Traces

## Status
Proposed

## Decision
Extend the existing OTel instrumentation from API-only to exported traces
aligned with the OTel GenAI semantic conventions, and adopt an
Agent-Lightning-compatible trace schema with reward slots from day one
(arXiv:2508.03680), so the same traces feed live tracing, reflection loops,
trajectory retrieval, AgentV evals, and — later — RL training, without
refactoring.

## Contract
- `harness-core/src/telemetry.ts` (`withHarnessTelemetrySpan`,
  `HARNESS_OTEL_TRACER_NAME`) remains the single span-creation surface; an
  exporter becomes configurable (console/OTLP), default off in browser.
- Span attributes follow GenAI semconv; harness-specific attributes carry:
  session/agent/sub-harness ids, skill routing decisions
  (`skill.route` telemetry in `skillRouter.ts`), routing decisions (existing
  routing ADR telemetry payload), and an optional `reward` slot populated by
  AgentV graders, voters, or completion checkers.
- The LogAct log (`lib/logact`) and `agentBus` entries join spans under one
  trace/correlation id — one episode, one tree.
- A deterministic converter maps span trees to RL transitions
  (`research/agent-lightning-2508.03680`); instrumentation coverage expands
  from `agentRunner.ts` to the logact/symphony loops and
  `observedAgentBus.ts` / `routingObservability.ts`.
- AgentV remains the eval framework; evals are reward sources, not a
  separate telemetry system ("AgentEvals.io" substitution — see master doc).

## Rollout phases
1. **Phase 0 (shadow):** exporter added, reward slots emitted where graders
   already run; no consumer.
2. **Phase 1 (opt-in):** self-improvement loop and trajectory retrieval read
   the trace store; dashboards read GenAI semconv attributes.
3. **Phase 2 (core-default):** all agent loops instrumented; traces are the
   canonical episode record for replay, evals, and training.

## Migration notes
- OTel GenAI agent-span conventions are still marked experimental upstream;
  pin the semconv version and record it in span attributes.
- No PII/secret material in attributes: reuse `secrets.ts` sanitization
  (`wrapToolsForSecretResolution`) before attribute emission.
