# Reference Architecture — Memp-style Procedural Memory Lifecycle

## Objective

Manage procedural memories as first-class lifecycle objects (candidate → active → deprecated) over our existing memory stores, so agents reuse proven procedures, stop reusing stale ones, and the whole process stays deterministic and inspectable.

## Components

1. **TrajectoryDistiller**
   - Converts completed trajectories into procedure summaries at two granularities (step instructions and script abstractions), keyed by task family.
2. **MemoryStore**
   - Typed store of `MemoryEntry` records; in production this maps onto `agent-browser/src/services/persistentMemoryGraph.ts` or the stores from `research/delta-mem-2605.12357` / `research/hybrid-memory-agent-marktechpost-2026`.
3. **LifecycleEngine**
   - Pure transition function applying promotion, demotion, and deprecation rules with explicit thresholds.
4. **RetrievalScorer**
   - Scores entries by task-family match plus success ratio; deprecated entries are excluded from every query.
5. **OutcomeObserver**
   - `MemoryStrategy` registered in `MemoryRegistry` (`harness-core/src/memory.ts`) that feeds task outcomes back into the LifecycleEngine on `observe` operations.
6. **TransferExporter**
   - Serializes active entries so procedures distilled by a strong model can seed a weaker model's store.
7. **PolicyGate**
   - Validates entries (schema, summary length caps, no secrets) before they enter or change state in the store.

## Data flow

1. Agent completes a task; TrajectoryDistiller emits a candidate `MemoryEntry`.
2. PolicyGate validates; MemoryStore appends the entry in `candidate` state.
3. On the next task in the family, RetrievalScorer returns the best non-deprecated entry to condition execution.
4. OutcomeObserver records success/failure of the run that used the entry.
5. LifecycleEngine applies transitions: promote after repeated success, deprecate after repeated failure or staleness.
6. Deprecation triggers re-distillation from the newest successful trajectory (fresh candidate).
7. TransferExporter snapshots active entries for weaker-model reuse and offline audit.

## Validation and safety gates

- All lifecycle transitions are pure functions of (entry, outcome, tick) — identical outcome sequences always yield identical stores.
- Deprecated entries are never retrieved and never resurrected; recovery requires a fresh candidate from new evidence.
- Promotion requires a minimum success count; a single lucky run cannot mint an active procedure.
- PolicyGate rejects malformed or oversized summaries before they can influence retrieval.

## Rollout policy

- Start in observe-only mode: entries built and lifecycle tracked, but retrieval not injected into prompts.
- Graduate to retrieval mode for low-risk task families once lifecycle churn is stable.
- Enable strong-to-weak transfer only after exported entries pass eval parity checks on the target model.

## Metrics

- Success rate with vs. without retrieved procedure per task family.
- Promotion latency (tasks from candidate to active).
- Deprecation lag (tasks between environment change and deprecation).
- Stale-hit rate (retrievals of entries that then fail).
- Store size and churn (entries created / deprecated per 100 tasks).
