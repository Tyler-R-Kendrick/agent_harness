# Experiment 01 — Self-Play + Cross-Time Replay Scaffold

## Objective

Demonstrate a deterministic TypeScript scaffold for Ctx2Skill-style skill co-evolution and replay-based snapshot selection.

## Hypothesis

Selecting a replay-balanced snapshot outperforms naively taking the last iteration when adversarial pressure over-specializes late skills.

## Setup

- Context: synthetic document with embedded procedural/rule knowledge.
- Iterations: `N=5`.
- Tasks per iteration: `M=5`.
- Judge: deterministic rubric pass simulator.

## Procedure

1. Run scaffold self-play for all iterations.
2. Record per-iteration solved/failed partitions.
3. Curate probes (hard/easy) each round.
4. Replay all reasoner snapshots on probe bank.
5. Compare selected snapshot vs last snapshot score.

## Acceptance criteria

- Replay selector returns a valid snapshot index.
- Probe sets are non-empty when solved/failed outcomes exist.
- Selected snapshot score is >= last snapshot score.

## Artifacts

- Iteration logs with partitions.
- Skill history by side.
- Replay score table per snapshot.
