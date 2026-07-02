# Experiment 01 — GEPA-style Pareto Text Evolution Scaffold

## Hypothesis

Reflection-targeted text mutations plus Pareto-frontier selection over per-instance score vectors improve aggregate score faster than single-scalar best-of selection, while retaining instance specialists on the frontier.

## Setup

- Implementation: `experiment-01-pareto-text-evolution.ts`
- Eval set: 4 deterministic mock instances (required terms + length budget per instance).
- Mutations: rule-based string edits standing in for LLM reflection (append missing term, add verification rule, compress).
- Budget: 24 generations; randomness from a seeded LCG PRNG only (no `Math.random()`/`Date.now()`).

## Procedure

1. Seed the frontier with a short base prompt scored on all 4 instances.
2. Each generation: sample a frontier parent, find its weakest instance, apply one reflection-style mutation.
3. Evaluate the child on all instances to build its score vector.
4. Insert into the frontier if non-dominated; prune dominated members.
5. Record frontier size per generation; select the final candidate by best mean score.
6. Re-run with the same seed and confirm identical frontier and selection.

## Acceptance criteria

- Scaffold typechecks clean with:
  `cd /home/user/agent_harness && npx tsc --noEmit --target es2015 --skipLibCheck --moduleResolution nodenext --module nodenext research/gepa-2507.19457/experiments/experiment-01-pareto-text-evolution.ts`
- Dominance and frontier updates are explicit, typed functions.
- Final selected candidate's mean score strictly exceeds the seed candidate's.
- Identical seed reproduces the frontier-growth series exactly.

## Artifacts

- Frontier-size series per generation.
- Final frontier (candidate ids + score vectors).
- Selected candidate text and lineage from `runDemo()`.
