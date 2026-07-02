# Experiment 01 — Procedural Memory Lifecycle Scaffold

## Hypothesis

A deterministic memory-entry state machine (candidate → active → deprecated) with explicit promotion/deprecation thresholds keeps retrieval pointed at proven procedures and cleanly retires them after an environment change, without any nondeterministic pruning heuristics.

## Setup

- Implementation: `experiment-01-procedural-memory-lifecycle.ts`
- Environment: scripted sequence of task outcomes for one task family (successes, then an environment change causing failures, then recovery).
- Thresholds: promote after 2 successes, deprecate after 2 consecutive failures or 20 ticks of staleness.
- Baseline: append-only store with no lifecycle (stale entry keeps winning retrieval).

## Procedure

1. Define `MemoryEntry` (id, taskFamily, procedure summary, successCount/failureCount, state) and the lifecycle transition function.
2. Implement the retrieval scorer: task-family match plus success ratio, deprecated entries excluded.
3. Run the deterministic simulation: build an entry from the first success, reinforce it to `active`, flip the environment, and observe deprecation after repeated failures.
4. Distill a fresh candidate from the post-change successful trajectory and confirm retrieval switches to it.
5. Print the final memory-store report and assert every expected transition.
6. Validate with:
   (from the repo root) `npx tsc --noEmit --target es2015 --skipLibCheck --moduleResolution nodenext --module nodenext research/memp-2508.06433/experiments/experiment-01-procedural-memory-lifecycle.ts`

## Acceptance criteria

- Scaffold compiles clean under the command above and runs deterministically (no `Math.random()` / `Date.now()`).
- Entry follows candidate → active → deprecated exactly once, at the scripted ticks.
- Deprecated entry is never returned by retrieval after deprecation.
- Replacement candidate wins retrieval for subsequent tasks; all assertions pass.

## Artifacts

- Scripted outcome sequence.
- Lifecycle transition log (tick, entry, from-state, to-state).
- Final memory-store report.
