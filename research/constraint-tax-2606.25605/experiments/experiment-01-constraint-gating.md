# Experiment 01 — Emission-Point Constraint Gating Scaffold

## Hypothesis

A decoding-mode state machine driven by a (task kind × output kind) policy table keeps grammar constraints active only inside DSL-emission spans over a scripted generation sequence, with the invariant machine-checkable from the trace.

## Setup

- Implementation: `experiment-01-constraint-gating.ts`
- Scripted sequence: reason → select tool → emit DSL → reason → emit DSL (fixed events).
- Policy: only (`dsl-emission`, `dsl-block`) maps to `constrained`; everything else is `free`.
- Validation command: `cd /home/user/agent_harness && npx tsc --noEmit --target es2015 --skipLibCheck --moduleResolution nodenext --module nodenext research/constraint-tax-2606.25605/experiments/experiment-01-constraint-gating.ts`

## Procedure

1. Build the policy decision table and the scripted event sequence.
2. Step the state machine over each event, consulting the table for the required mode.
3. Record a trace entry `(step, label, mode)` and open/close spans on transitions.
4. Derive constrained spans from the trace.
5. Assert constraints were active only for `dsl-block` outputs; log the verdict.

## Acceptance criteria

- Scaffold compiles cleanly with the validation command above.
- Trace shows `free` for reasoning and tool selection, `constrained` for both DSL emissions.
- Derived spans are well-formed (every open has a matching close).
- Demo output is identical across runs (no `Math.random()`/`Date.now()`).

## Artifacts

- Per-step mode trace.
- Derived constrained-span list.
- Invariant verdict log.
