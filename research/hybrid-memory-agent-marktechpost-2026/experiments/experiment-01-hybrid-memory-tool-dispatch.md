# Experiment 01 — Hybrid Memory + Tool Dispatch Scaffold

## Hypothesis

A hybrid rank-fusion memory + typed tool dispatch scaffold can produce more stable context recall than sparse-only retrieval while keeping execution deterministic.

## Setup

- Runtime: TypeScript module scaffold
- Memory entries: small synthetic corpus with lexical and semantic overlap
- Retrieval: sparse token overlap + deterministic dense similarity
- Fusion: Reciprocal Rank Fusion (RRF)

## Procedure

1. Seed memory with known facts and categories.
2. Query with multiple phrasings.
3. Compare top-k retrieval ordering from sparse-only vs hybrid.
4. Execute tool dispatch scenarios for valid and invalid tools.
5. Assert deterministic outputs across repeated runs.

## Acceptance criteria

- RRF results include expected target fact in top-k for semantic paraphrase query.
- Dispatcher resolves registered tools and rejects unknown tools.
- Runs are deterministic for fixed corpus/query.

## Artifacts

- `experiment-01-reference-architecture.ts`
