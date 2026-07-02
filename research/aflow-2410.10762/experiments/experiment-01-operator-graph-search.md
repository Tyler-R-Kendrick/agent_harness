# Experiment 01 — AFlow-style Operator-Graph Search Scaffold

## Hypothesis

An MCTS-lite loop over typed graph edits (add operator, swap kind, rewire edge) with a deterministic evaluator finds a higher-scoring workflow graph than the seed graph, and the whole search is replayable from its trace.

## Setup

- Implementation: `experiment-01-operator-graph-search.ts`
- Evaluator: deterministic mock scoring graph structure (review-after-generate, revise-after-review, ensemble fan-in, terminal test, size penalty).
- Budget: 40 search iterations, UCB exploration constant 1.4.
- Randomness: seeded LCG PRNG only; no `Math.random()` or `Date.now()`.

## Procedure

1. Seed the search tree with a single-Generate graph.
2. Each iteration: select a node by UCB, expand with one typed `GraphEdit`, score the edited graph with the mock evaluator, backpropagate.
3. Record every (iteration, edit, score) entry in the search trace.
4. Run the demo with a fixed seed and capture best graph + trace summary.
5. Re-run with the same seed and confirm identical output.

## Acceptance criteria

- Scaffold typechecks clean with:
  `cd /home/user/agent_harness && npx tsc --noEmit --target es2015 --skipLibCheck --moduleResolution nodenext --module nodenext research/aflow-2410.10762/experiments/experiment-01-operator-graph-search.ts`
- All graph edits are typed union members; no stringly-typed mutations.
- Best graph score strictly exceeds the seed graph score in the demo run.
- Identical seed produces an identical search trace.

## Artifacts

- Search trace (iteration, edit type, score, best-so-far series).
- Final best graph (operators + edges).
- Demo summary lines from `runDemo()`.
