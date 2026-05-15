# Experiment 01 — Deterministic Proxy-Pointer Expansion

## Hypothesis

A text-first retrieval pipeline with structural pointer expansion can recover relevant multimodal evidence (figure/table references) without multimodal embeddings.

## Setup

- Runtime: TypeScript scaffold (`experiment-01-proxy-pointer.ts`).
- Corpus: synthetic structured document graph with paragraphs linked to figures/tables.
- Retrieval: deterministic keyword overlap score.
- Expansion: graph traversal with weighted edge priors.

## Procedure

1. Build a small in-memory corpus graph.
2. Run query retrieval over text nodes only.
3. Expand top-K text nodes to linked multimodal artifacts.
4. Rank/dedupe pointer bundles.
5. Verify that expected artifact IDs appear in top results.

## Acceptance criteria

- Query about chart trend returns the linked chart pointer in top-N.
- Query about table statistics returns linked table pointer in top-N.
- All returned pointers include `docId`, `nodeId`, `page`, and `assetUri`.

## Artifacts

- `experiment-01-proxy-pointer.ts` (implementation scaffold)
- `experiment-01-proxy-pointer.test.ts` (deterministic regression tests)
- terminal output from `npx vitest run research/proxy-pointer-rag-tds-2026/experiments/experiment-01-proxy-pointer.test.ts`
- terminal output from `npx tsc --noEmit --target es2015 --skipLibCheck --moduleResolution nodenext --module nodenext research/proxy-pointer-rag-tds-2026/experiments/experiment-01-proxy-pointer.ts`
