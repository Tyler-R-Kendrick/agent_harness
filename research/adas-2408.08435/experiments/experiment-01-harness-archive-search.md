# Experiment 01 — ADAS-style Harness Archive Search Scaffold

## Hypothesis

An append-only, content-addressed archive with score+novelty-weighted parent sampling discovers a higher-scoring harness genome than the seed, while dedupe and lineage pointers keep the whole search replayable.

## Setup

- Implementation: `experiment-01-harness-archive-search.ts`
- Evaluator: deterministic mock scoring definitions on feature tokens (quality) and length (cost).
- Mutations: fixed snippet list applied to sampled parents; children always get new ids, never in-place edits.
- Budget: 30 iterations; randomness from a seeded LCG PRNG only (no `Math.random()`/`Date.now()`).

## Procedure

1. Insert the seed harness definition (content-hashed id, `parentId: null`).
2. Each iteration: sample a parent by combined score + novelty weight.
3. Mutate the parent definition into a child; hash it; skip insert if the id already exists (dedupe).
4. Evaluate new children and insert them with their parentId.
5. After the budget, emit the best genome and its lineage report.
6. Re-run with the same seed and confirm identical archive contents.

## Acceptance criteria

- Scaffold typechecks clean with:
  (from the repo root) `npx tsc --noEmit --target es2015 --skipLibCheck --moduleResolution nodenext --module nodenext research/adas-2408.08435/experiments/experiment-01-harness-archive-search.ts`
- Archive insert is append-only and dedupes on content hash.
- Best genome's combined score strictly exceeds the seed genome's.
- Lineage report walks from best genome back to the seed via parentId.

## Artifacts

- Archive contents (id, parentId, scores, novelty at insert time).
- Dedupe count and archive-size series.
- Lineage report of the best genome from `runDemo()`.
