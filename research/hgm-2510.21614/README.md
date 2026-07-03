---
type: research-packet
---

# HGM (arXiv:2510.21614)

- Paper: **Huxley-Gödel Machine: Human-Level Coding Agent Development by an Approximation of the Optimal Self-Improving Machine**
- Authors: Wang, Piękos et al. (Schmidhuber group, KAUST / metauto-ai)
- Links: https://arxiv.org/abs/2510.21614, https://huggingface.co/papers/2510.21614
- Published: 2025-10 (arXiv)

## What this paper proposes

HGM studies self-modifying coding agents that grow a tree of harness variants, where each node edits its own code and each edit spawns a child. It identifies the **Metaproductivity-Performance Mismatch**: the variant with the best benchmark score is often NOT the best ancestor to expand next. HGM therefore:

1. Scores each variant by **Clade-Metaproductivity (CMP)** — the aggregate performance of its descendants, not its own score.
2. Selects which lineage to self-modify next by CMP.
3. Matches human-engineered agents on SWE-bench Lite while using fewer CPU-hours than prior self-improvement searches.

### Related work

- **Darwin Gödel Machine (arXiv:2505.22954)** — direct predecessor: empirically-validated self-code-rewriting with an archive of variants; expansion favors high-scoring archive members, which is exactly the selection rule HGM shows is mismatched.
- **SICA, "A Self-Improving Coding Agent" (arXiv:2504.15228)** — collapses the meta-agent and target agent into one self-editing agent; establishes the single-lineage self-edit loop that HGM generalizes into a clade-scored tree.

## Extracted capability to implement

### Capability name

**Clade-Gated Self-Modification (CGSM)**

### Capability definition

A lineage tree over harness variants where CMP is computed from descendant eval outcomes, expansion selects the parent by CMP, and promotion of any variant to "active harness" is eval-gated through an explicit promotion state machine (candidate → benchmarked → promoted/rejected).

### Why it matters in our stack

- Gives `agent-browser/src/services/harnessEvolution.ts` a principled parent-selection rule instead of greedy best-score expansion.
- The promotion gate attaches directly to the `agent-browser/evals/symphony-self-improvement` suite as the benchmark step.
- Refines the archive-based search in the planned sibling packet `research/adas-2408.08435` and complements `research/continual-harness-2605.09998`.

## Minimal algorithm sketch

1. Initialize lineage tree with the current production harness as root.
2. Benchmark each variant on a fixed eval slice; record own score and eval count.
3. Compute CMP per node as the eval-weighted aggregate of its clade (self + descendants).
4. Select expansion parent = argmax CMP; spawn a self-modified child.
5. Run the child through the promotion state machine: candidate → benchmarked → promoted only if it beats the incumbent by a margin, else rejected.
6. Repeat under a fixed compute budget; report best-own-score vs best-CMP divergence.

## Deliverables in this folder

- `reference-architecture.md` — architecture for clade-gated self-modification in agent-browser style runtimes.
- `experiments/experiment-01-clade-metaproductivity.md` — experiment design and acceptance criteria.
- `experiments/experiment-01-clade-metaproductivity.ts` — TypeScript implementation scaffold.
