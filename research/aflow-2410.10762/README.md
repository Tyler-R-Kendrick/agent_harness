---
type: research-packet
---

# AFlow (arXiv:2410.10762)

> **Disambiguation:** this packet covers **AFlow** (arXiv:2410.10762, Oct 2024), which is a *different paper* from the existing packet `research/aaflow-2605.02162` (**AAFLOW: Scalable Patterns for Agentic AI Workflows**, arXiv:2605.02162). AAFLOW is a distributed *execution runtime* (operator dataflow, zero-copy batching); AFlow is a *search procedure* that automatically discovers workflow structure. Read `research/aaflow-2605.02162/README.md` first if you are unsure which packet you need.

- Paper: **AFlow: Automating Agentic Workflow Generation**
- Authors: Zhang et al. (DeepWisdom / MetaGPT team)
- Links: https://arxiv.org/abs/2410.10762, https://huggingface.co/papers/2410.10762
- Published: 2024-10 (arXiv v1); ICLR 2025 oral

## What this paper proposes

AFlow reframes agentic workflow design as a search problem over code-represented graphs of nodes and edges, explored with Monte Carlo Tree Search:

1. Workflows are represented as executable graphs built from a small vocabulary of reusable typed **Operators** (e.g., Ensemble, Review, Revise) that compress the search space.
2. MCTS explores the space of graph edits: selection, expansion (an LLM proposes a modification), simulation (execute + evaluate), and backpropagation of scores.
3. Discovered workflows beat hand-designed ones across QA, code, and math benchmarks, and let smaller models beat larger ones on cost-adjusted quality.

## Extracted capability to implement

### Capability name

**Typed Operator-Graph Search (TOGS)**

### Capability definition

A single typed operator-graph representation that serves as BOTH the execution plan and the search space: a meta-harness explores graph edits with an MCTS-style expand/simulate/backprop loop, scores each candidate graph with an evaluator, and returns the best-performing workflow plus a full search trace.

### Why it matters in our stack

- `lib/workgraph` (`WorkGraphCommand`) and `harness-core/src/workflow.ts` (LogAct workflow definitions) already give us typed execution primitives; the operator graph is the natural *search representation* over them.
- Feeds the planned intent-DSL ADR directly: the DSL doubles as the search space, so anything expressible in the DSL is discoverable by the meta-harness.
- Typed operators bound the edit space, keeping search tractable and every candidate executable by construction.

## Minimal algorithm sketch

1. Start from a seed graph (single Generate operator).
2. Select a tree node by UCB over mean score and visit counts.
3. Expand: apply one typed graph edit (add operator, swap kind, rewire edge).
4. Simulate: execute/evaluate the edited graph and record its score.
5. Backpropagate the score up the search tree.
6. Repeat for the iteration budget; return best graph + trace.

## Deliverables in this folder

- `reference-architecture.md` — architecture for integrating TOGS over our workflow primitives.
- `experiments/experiment-01-operator-graph-search.md` — experiment design and acceptance criteria.
- `experiments/experiment-01-operator-graph-search.ts` — TypeScript implementation scaffold.
