# Reference Architecture: Deterministic Operator Pipeline Orchestrator (DOPO)

## Goal

Bring AAFLOW-inspired workflow scaling ideas into our TypeScript agent stack with deterministic execution and low-overhead operator boundaries.

## Architecture overview

```text
┌─────────────────────────────────────────────────────────────┐
│ Ingress                                                     │
│ - user prompt / task / tool events                          │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│ Operator Graph Registry                                     │
│ - typed operator defs                                       │
│ - topo ordering + dependency map                            │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│ Deterministic Scheduler                                     │
│ - ready queue                                               │
│ - stable tie-break (priority -> topo index -> operator id)  │
│ - bounded async micro-batches                               │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│ Data Plane (TS zero-copy approximation)                     │
│ - readonly batch envelopes                                  │
│ - immutable record references                               │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│ Telemetry + Replay Log                                      │
│ - per-operator latency                                      │
│ - queue wait + batch size                                   │
│ - deterministic replay artifact                             │
└──────────────────────────────────────────────────────────────┘
```

## Integration points

- **agent-browser runtime loop**: replace ad hoc stage chains with operator graph execution.
- **eval harness**: replay exact operator traces for regression checks.
- **tooling surface**: map tool calls to operators with explicit contracts.

## Safety/validation gates

1. Contract validation: each operator input/output validated at runtime boundary.
2. Batch-size guardrails: configured max records + timeout flush.
3. Determinism assertion: same seed + same inputs must produce same output ordering/hash.
4. Backpressure mode: shed non-critical enrichment operators when queue pressure exceeds threshold.

## Rollout policy

- Phase 1: shadow execution in parallel with existing pipeline.
- Phase 2: canary on low-risk flows.
- Phase 3: full cutover + replay-based regression gate in CI.

## Metrics

- End-to-end p50/p95 latency
- Non-LLM orchestration time share
- Effective batch utilization
- Deterministic replay match rate
- Failure/rollback frequency
