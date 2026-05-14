# Synapse (Godot Asset 5150): Graph-Based State Machine

## Paper/Asset Intake

- **Title:** Synapse: Graph-Based State Machine
- **Canonical link:** https://godotengine.org/asset-library/asset/5150
- **Source repository:** https://github.com/gklompje/godot-synapse
- **Release metadata:** `0.1.0-alpha`, submitted **2026-05-11**

Synapse proposes an extensible, graph-first state machine where runtime control flow is modeled as explicit nodes and edges, while state behavior is composed from reusable units (composition-over-inheritance). It emphasizes nested sub-machines, blackboard-style shared context, and persistence.

## Extracted capability for Agent Harness

### Capability

A **typed graph-based orchestration loop** for agent execution where:

1. each node is a deterministic state handler,
2. edges are validated transitions with guard conditions,
3. shared runtime context lives in a blackboard,
4. subgraphs can be nested for reusable mini-loops (e.g., planning, tool-use, recovery), and
5. state snapshots are persisted and resumed.

### Why this matters

The harness core loop already has stateful behavior (plan → act → observe → recover). Making this first-class as a directed graph improves:

- **Auditability:** explicit transition history and reasons.
- **Reliability:** guard-checked transitions reduce accidental state drift.
- **Composability:** nested graphs model reusable agent skills.
- **Recovery:** persisted snapshots enable resume-after-failure.

## Algorithm sketch

1. Load `GraphDefinition` with node handlers and allowed transitions.
2. Start from `entryNodeId` with a blackboard snapshot.
3. Execute current node handler to produce `NodeResult`.
4. Evaluate outbound transitions in priority order.
5. Commit one transition event (or halt if none valid).
6. Persist updated blackboard and execution trace.
7. Recurse into subgraph nodes when requested.
8. Stop when terminal node reached, budget exhausted, or hard guard fails.

## Implementation status

- Reference architecture: `reference-architecture.md`
- Experiment spec + scaffold:
  - `experiments/experiment-01-graph-loop.md`
  - `experiments/experiment-01-graph-loop.ts`
