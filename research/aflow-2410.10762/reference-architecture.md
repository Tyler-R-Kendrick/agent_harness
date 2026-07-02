# Reference Architecture — AFlow-style Typed Operator-Graph Search

## Objective

Let a meta-harness discover better workflow structures automatically by searching over the same typed operator graph our runtime executes, while keeping every candidate graph valid, replayable, and safely gated before rollout.

## Components

1. **OperatorVocabulary**
   - Small closed set of typed operators (Generate, Review, Revise, Ensemble, Test) with input/output contracts.
2. **WorkflowGraphModel**
   - Code-represented node/edge graph; the single artifact used for both execution and search.
3. **GraphEditProposer**
   - Produces one typed `GraphEdit` per expansion (add operator, swap kind, rewire edge); in production an LLM proposes edits, in experiments a deterministic sampler.
4. **GraphEvaluator**
   - Executes a candidate graph on a benchmark slice and returns a scalar score (quality minus cost penalty).
5. **SearchTree**
   - MCTS bookkeeping: visits, mean score, parent/child links, UCB selection.
6. **SearchLedger**
   - Append-only trace of every (edit, score) pair for replay and offline analysis.
7. **GraphSafetyGate**
   - Validates candidate graphs: acyclicity, operator budget, contract compatibility, tool-policy constraints.

## Data flow

1. Seed graph enters the SearchTree as the root.
2. UCB selection walks to a promising node.
3. GraphEditProposer emits one typed edit; the edited graph is checked by GraphSafetyGate.
4. GraphEvaluator scores the candidate; SearchLedger records the (edit, score) entry.
5. Score backpropagates through visits/means up to the root.
6. After the budget, the best graph is compiled to `lib/workgraph` commands / LogAct workflow definitions (`harness-core/src/workflow.ts`) for execution.

## Validation and safety gates

- Every candidate graph must pass acyclicity and operator-contract checks before evaluation.
- Operator count and edge count are hard-capped; oversized candidates are rejected, not truncated.
- Evaluation runs in a sandboxed benchmark slice; no discovered graph touches production tasks during search.
- The search never mutates the incumbent graph in place; promotion is an explicit, logged decision.

## Rollout policy

- Start in offline mode: search runs against recorded eval sets only.
- Graduate the single best graph to shadow execution beside the hand-designed workflow.
- Promote to active only after beating the incumbent on the metric gates below for two consecutive eval windows.

## Metrics

- Best-graph score versus hand-designed baseline.
- Cost-adjusted quality (score per token/tool budget).
- Search efficiency (iterations to surpass baseline).
- Gate rejection rate (invalid candidates per 100 expansions).
- Score variance across repeated seeded searches (determinism check).
