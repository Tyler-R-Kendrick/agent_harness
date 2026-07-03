# Experiment 01 — Reward-Slotted Trace to RL Transitions Scaffold

## Hypothesis

An OTel-style span log with explicit reward slots can be deterministically converted into well-ordered RL transitions (state / action / reward / next-state) via hierarchical credit assignment, without any change to the recording agent.

## Setup

- Implementation: `experiment-01-trace-to-transitions.ts`
- Fixture: one multi-turn episode span log (episode span, three model-call spans, one tool-call sub-span), fixed timestamps.
- Reward source: episode-level reward slot standing in for an AgentV eval verdict.
- Baseline: raw span log with no converter (traces usable for replay only, not training).

## Procedure

1. Define `TraceSpan` loosely modeled on OTel GenAI semconv attributes, including optional reward slots.
2. Build the fixture span log for the episode.
3. Run `toTransitions()`: sort model-call spans by start time, fold the tool-call span into the next observation, assign per-span rewards where present and the episode reward to the terminal transition.
4. Assert transition count, monotonic ordering, terminal `done` flag, and reward placement.
5. Print the transition table.
6. Validate with:
   (from the repo root) `npx tsc --noEmit --target es2015 --skipLibCheck --moduleResolution nodenext --module nodenext research/agent-lightning-2508.03680/experiments/experiment-01-trace-to-transitions.ts`

## Acceptance criteria

- Scaffold compiles clean under the command above and runs deterministically (no `Math.random()` / `Date.now()`).
- Exactly one transition per model-call span, ordered by span start time.
- Tool-call span output appears in the next transition's state, never as its own transition.
- Episode reward lands on the terminal transition; all assertions pass.

## Artifacts

- Fixture span log (one episode).
- Printed transition table (index, state, action, reward, done).
- Deterministic assertion results.
