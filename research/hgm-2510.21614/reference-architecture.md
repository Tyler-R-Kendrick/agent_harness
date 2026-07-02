# Reference Architecture — HGM-style Clade-Gated Self-Modification

## Objective

Integrate clade-metaproductivity-driven lineage selection into our TypeScript harness-evolution runtime while keeping every self-modification eval-gated, deterministic to replay, and reversible.

## Components

1. **LineageTree**
   - Typed store of `VariantNode` records (id, parentId, ownScore, evalCount) with parent/child indices.
2. **BenchmarkRunner**
   - Runs a fixed eval slice (e.g. `agent-browser/evals/symphony-self-improvement`) against a variant and records score + eval count.
3. **CmpAggregator**
   - Computes Clade-Metaproductivity per node: eval-weighted aggregate performance of the node's clade (self + all descendants).
4. **ExpansionSelector**
   - Picks the next parent to self-modify as argmax CMP, with a tie-break on eval count.
5. **VariantMutator**
   - Produces a self-modified child harness from the selected parent (mocked in experiments).
6. **PromotionStateMachine**
   - Drives candidate → benchmarked → promoted/rejected; only promoted variants become the active harness.
7. **EvolutionLedger**
   - Append-only log of expansions, benchmark results, and promotion transitions for replay.

## Data flow

1. LineageTree is seeded with the current production harness as root.
2. BenchmarkRunner scores the root; ledger records the baseline.
3. CmpAggregator recomputes CMP for all nodes after every benchmark result.
4. ExpansionSelector chooses the CMP-argmax parent; VariantMutator spawns a child in `candidate` state.
5. BenchmarkRunner evaluates the child; state advances to `benchmarked`.
6. PromotionStateMachine compares the child to the incumbent active harness and emits `promoted` or `rejected`.
7. Loop repeats until the expansion budget is exhausted; ledger is exported for analysis.

## Validation and safety gates

- No variant may become the active harness without passing through `benchmarked`; direct candidate → promoted transitions are rejected.
- Promotion requires a minimum eval count and a score margin over the incumbent; ties retain the incumbent.
- CMP-based expansion never bypasses the promotion gate — expanding a lineage and activating a harness are separate decisions.
- Malformed nodes (unknown parent, duplicate id) are rejected at tree insertion.

## Rollout policy

- Start in shadow mode: run the CMP selector alongside the existing best-own-score selector in `harnessEvolution.ts` and log divergence only.
- Graduate to active expansion selection once shadow logs confirm CMP picks non-degenerate lineages.
- Enable automatic promotion last, initially with a human review step on every `promoted` transition.

## Metrics

- Best promoted score vs compute budget (eval-hours).
- Mismatch rate: fraction of rounds where argmax ownScore differs from argmax CMP.
- Promotion acceptance rate and rejected-candidate count.
- Clade depth and branching factor of the winning lineage.
- Regret of best-own-score selection relative to CMP selection at budget exhaustion.
