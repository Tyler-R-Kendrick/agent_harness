# Experiment 01 — SkillOpt-style Skill Document Optimizer Scaffold

## Hypothesis

A bounded-edit, validation-gated optimization loop over a typed SKILL.md document improves held-out fixture score monotonically, and a rejected-edit memory measurably reduces re-proposal of known-bad edits.

## Setup

- Implementation: `experiment-01-skill-doc-optimizer.ts`
- Environment: deterministic mock validator scoring documents against a fixed fixture task set, seeded LCG PRNG (seed 26052390).
- Budget: 14 optimization iterations; section cap 240 chars, document cap 1,600 chars.
- Baseline: seed document score with no edits applied.

## Procedure

1. Load the seed skill document (typed section list) and score it as `bestDoc`.
2. Each iteration, propose one bounded edit (replace or append a single section), skipping proposals present in the rejected-edit memory.
3. Apply the edit to `bestDoc` and score the candidate on the fixture task set.
4. Accept only on strict score improvement; otherwise record the rejection with its score delta.
5. After the budget, emit the best document (`best_skill.md` rendering) plus the full optimization log.

## Acceptance criteria

- Scaffold compiles clean with:
  `cd /home/user/agent_harness && npx tsc --noEmit --target es2015 --skipLibCheck --moduleResolution nodenext --module nodenext research/skillopt-2605.23904/experiments/experiment-01-skill-doc-optimizer.ts`
- Demo run is deterministic and shows both accepted and rejected edits.
- Best score never decreases across iterations (acceptance gate is strict).
- At least one proposal is skipped via the rejected-edit memory.
- Emitted best document stays within the section and document length caps.

## Artifacts

- Optimization log (proposal key, candidate score, accept/reject, memory skips per step).
- Rejected-edit memory with score deltas.
- Final `best_skill.md` rendering of the optimized document.
