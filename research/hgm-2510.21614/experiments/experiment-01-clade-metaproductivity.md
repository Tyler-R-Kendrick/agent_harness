# Experiment 01 — Clade-Metaproductivity Expansion Scaffold

## Hypothesis

Selecting the lineage to self-modify by Clade-Metaproductivity (CMP) diverges from greedy best-own-score selection on a deterministic variant tree, reproducing the paper's Metaproductivity-Performance Mismatch while keeping harness activation eval-gated.

## Setup

- Implementation: `experiment-01-clade-metaproductivity.ts`
- Environment: deterministic mock benchmark over latent variant quality, seeded LCG PRNG (seed 20251021).
- Budget: 12 expansion rounds, 4 evals per variant, promotion margin 0.02.
- Baseline: argmax-ownScore selection over the same tree.

## Procedure

1. Seed the lineage tree with root variant `V0` and benchmark it.
2. Each round, compute CMP for every node and expand the CMP-argmax parent with a mutated child.
3. Benchmark the child (latent quality + seeded noise).
4. Drive the child through the promotion state machine:
   - candidate → benchmarked → promoted only if it beats the active harness by the margin, else rejected.
5. After the budget, report best-by-ownScore vs best-by-CMP and the full promotion log.

## Acceptance criteria

- Scaffold compiles clean with:
  (from the repo root) `npx tsc --noEmit --target es2015 --skipLibCheck --moduleResolution nodenext --module nodenext research/hgm-2510.21614/experiments/experiment-01-clade-metaproductivity.ts`
- Demo run is deterministic and shows `selectionDiverges: true` (own-score argmax ≠ CMP argmax).
- No variant becomes the active harness without passing through the `benchmarked` state.
- Promotion log contains both promoted and rejected transitions.

## Artifacts

- Final expansion report (best-by-ownScore vs best-by-CMP, divergence flag).
- Active-harness id after eval-gated promotion.
- Promotion state timeline per variant.
