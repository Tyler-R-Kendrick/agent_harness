# AAFLOW (arXiv:2605.02162)

- Paper: **AAFLOW: Scalable Patterns for Agentic AI Workflows**
- Link: https://arxiv.org/abs/2605.02162
- Submitted: 2026-05-04 (arXiv v1)

## What this paper proposes

AAFLOW proposes a distributed runtime for agentic AI pipelines that treats workflow stages as operators in a communication-efficient execution graph. The key technical ideas are:

1. **Operator abstraction** for agent workflow stages (preprocess, embed, retrieve, reason).
2. **Zero-copy Arrow/Cylon data plane** to avoid repeated serialization boundaries between stages.
3. **Resource-deterministic scheduling + async batching** to reduce coordination overhead while keeping throughput stable.

The paper reports pipeline acceleration driven primarily by dataflow efficiency, not by faster LLM token generation.

## Extracted capability to implement

### Capability name

**Deterministic Operator Pipeline Orchestrator (DOPO)**

### Capability definition

A typed execution runtime that models agent workflow steps as composable operators over immutable records, executes them with deterministic scheduling semantics, and supports asynchronous micro-batching without changing final logical output ordering.

### Why it matters

- Agent-browser style systems compose many non-LLM stages where serialization and orchestration overhead dominates latency.
- Deterministic scheduling improves reproducibility for evals/debugging.
- Operator boundaries give us better observability and rollout control than ad hoc callback chains.

## Minimal algorithm sketch

1. Build a DAG of typed operators with explicit input/output contracts.
2. Partition incoming events into bounded micro-batches.
3. Execute ready operators under a deterministic tie-break (priority, then topological index).
4. Pass immutable batch views to downstream operators (zero-copy simulation in TS via readonly slices/views).
5. Emit ordered results and telemetry (stage latency, queue wait, batch size).

## Deliverables in this folder

- `reference-architecture.md` — system-level integration plan for DOPO in this stack.
- `experiments/experiment-01-deterministic-orchestrator.md` — first experiment spec.
- `experiments/experiment-01-dopo-scaffold.ts` — TypeScript scaffold implementing deterministic operator orchestration.
