# Memp (arXiv:2508.06433)

- Paper: **Memp: Exploring Agent Procedural Memory** — Zhejiang University / Alibaba
- Link: https://arxiv.org/abs/2508.06433
- Published: 2025-08 (arXiv, August 2025)

## What this paper proposes

Memp gives agents a learnable, lifelong procedural memory instead of one frozen in the model or hand-written in prompts. Past trajectories are distilled into two granularities:

1. Fine-grained step-by-step instructions for concrete task executions.
2. Higher-level script abstractions that generalize across a task family.

Crucially, Memp treats memory as a lifecycle, with explicit build, retrieve, and update regimens — including deprecation of stale memories when the environment changes. The paper shows procedural memory built by a strong model transfers to weaker models, lifting their success rate on TravelPlanner and ALFWorld.

Lineage: Voyager (2305.16291, ever-growing skill library) → Agent Workflow Memory (2409.07429, workflows induced from trajectories) → Memp, which adds the full lifecycle with deprecation rather than append-only accumulation.

## Extracted capability to implement

### Capability name

**Procedural Memory Lifecycle (PML)**

### Capability definition

A memory-entry state machine (candidate → active → deprecated) with deterministic promotion on repeated success, demotion/deprecation on failure or staleness, and retrieval scoring that excludes deprecated entries.

### Why it matters in our stack

- Our existing memory packets — `research/ctx2skill-2604.27660`, `research/delta-mem-2605.12357`, and `research/hybrid-memory-agent-marktechpost-2026` — define memory *stores*; Memp is the lifecycle *policy* that sits over any of them.
- `harness-core/src/memory.ts` (`MemoryRegistry` / `MemoryStrategy`) is the natural attach point: the lifecycle runs as a strategy on `observe`/`compact` operations.
- `agent-browser/src/services/persistentMemoryGraph.ts` gains a principled eviction rule instead of unbounded growth.
- Strong-to-weak transfer means procedures distilled from expensive frontier-model runs can guide cheaper local models.

## Minimal algorithm sketch

1. On task completion, distill the trajectory into a procedure summary keyed by task family (build).
2. New entries start as `candidate`.
3. Retrieval scores entries by task-family match and success ratio; deprecated entries are excluded.
4. On success with a retrieved entry, increment its success count; promote candidate → active at a fixed threshold.
5. On failure, increment failure count; demote/deprecate when consecutive failures or staleness cross thresholds.
6. Report the memory store state so lifecycle churn is inspectable and replayable.

## Deliverables in this folder

- `reference-architecture.md` — architecture for lifecycle-managed procedural memory in agent-browser style runtimes.
- `experiments/experiment-01-procedural-memory-lifecycle.md` — experiment design and acceptance criteria.
- `experiments/experiment-01-procedural-memory-lifecycle.ts` — TypeScript implementation scaffold.
