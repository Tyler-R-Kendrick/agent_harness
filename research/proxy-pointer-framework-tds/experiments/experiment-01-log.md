# Experiment 01 — Pointer Graph Retrieval Scaffold

## Hypothesis

A proxy-pointer ranker that combines lexical similarity with structure signals (type priors + graph connectivity) will better prioritize enterprise-relevant regions than lexical-only ranking for structured docs.

## Setup

- Runtime: Node + TypeScript (`.ts` module scaffold).
- Input: synthetic invoice-like regions.
- Output: ranked evidence with score decomposition.

## Procedure

1. Build graph edges from parent-child, sibling order, and spatial proximity.
2. Score each region via:
   - lexical overlap
   - structural bias by region type
   - pointer connectivity
3. Sort and inspect top-1 prediction.

## Acceptance criteria

- Deterministic ranking output.
- Score explainability fields emitted.
- Smoke check passes for a known query (`invoice amount`).

## Outcome

- Scaffold implemented and smoke check runnable via direct execution.
- Top-1 region for sample query is stable and explainable.

## Next iterations

- Replace synthetic structure with parser output from real enterprise PDFs.
- Learn structural weights from labeled relevance sets.
- Add bounded multi-hop pointer walk for recall lift.
- Integrate as a retrieval tool surface for agent-browser agents.
