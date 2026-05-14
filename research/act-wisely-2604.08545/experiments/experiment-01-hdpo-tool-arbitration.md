# Experiment 01 — HDPO-style Tool Arbitration Prototype

## Hypothesis

A decoupled arbitration policy (quality objective + efficiency objective) can reduce unnecessary tool usage by >=50% relative to an always-tool baseline while preserving answer quality within a small tolerance.

## Setup

- Runtime: TypeScript prototype (`hdpo-tool-arbitration.ts`).
- Synthetic tasks with labeled tool necessity.
- Baseline: always call tool.
- Candidate: thresholded arbitration with mandatory-tool domains.

## Procedure

1. Run baseline on full synthetic dataset and capture:
   - total tool calls,
   - unnecessary tool calls,
   - correctness score,
   - latency proxy.
2. Run arbitration policy on same dataset.
3. Compare deltas and validate acceptance criteria.

## Acceptance criteria

- Unnecessary tool calls reduced by >=50%.
- Correctness drop <=2 percentage points from baseline.
- Mandatory-tool tasks never abstained.

## Artifacts

- `hdpo-tool-arbitration.ts` output metrics table.
- Future extension: integrate same interface into agent-browser eval harness.
