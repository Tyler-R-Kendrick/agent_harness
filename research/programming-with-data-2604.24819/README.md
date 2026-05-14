# Programming with Data (arXiv:2604.24819)

- Paper: **Programming with Data: Test-Driven Data Engineering for Self-Improving LLMs from Raw Corpora**
- Link: https://huggingface.co/papers/2604.24819
- Published: 2026-04-27 (per Hugging Face paper page)

## What this paper proposes

The paper reframes domain adaptation as a software-style lifecycle where:

1. Training data acts like source code.
2. Model training acts like compilation.
3. Benchmarks act like unit tests.
4. Failure-driven data repair acts like debugging.

The central claim is that if structured knowledge is shared between training data construction and evaluation, then failures can be traced to specific data defects and corrected with targeted patches instead of indiscriminate dataset growth.

## Extracted capability to implement

### Capability name

**Test-Driven Data Patch Loop (TDDP Loop)**

### Capability definition

A typed pipeline that:

- maps failed benchmark items to structured concepts/reasoning edges,
- localizes candidate data defects,
- proposes data patches,
- validates patch safety/quality gates,
- emits a versioned patch plan for retraining or synthetic data refresh.

### Why it matters in our stack

- Gives agent-browser-compatible teams a deterministic way to connect eval failures to data actions.
- Creates auditable repair artifacts before costly training/retraining steps.
- Enables progressive adoption: start with heuristic localization, later swap in model-assisted patch synthesis.

## Minimal algorithm sketch

1. Ingest benchmark failures with concept/reasoning tags.
2. Aggregate failures into defect clusters.
3. Generate candidate data patches per cluster.
4. Run patch validators (coverage delta, contradiction checks, policy filters).
5. Rank and emit accepted patch plan.
6. Re-run eval slice and compare pass-rate deltas.

## Deliverables in this folder

- `reference-architecture.md` — architecture to integrate the TDDP Loop into our TypeScript-first agent stack.
- `experiments/experiment-01-tddp-loop.md` — experiment specification and acceptance gates.
- `experiments/experiment-01-tddp-loop.ts` — TypeScript scaffold of localization, patching, and validation flow.
