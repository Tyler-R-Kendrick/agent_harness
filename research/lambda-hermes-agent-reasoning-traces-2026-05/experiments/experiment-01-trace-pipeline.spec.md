# Experiment 01: Trace parsing, analytics, visualization projection, and SFT export

## Hypothesis

A strict typed parser + analyzer can transform raw reasoning traces into reliable analytics and supervised fine-tuning examples with deterministic output.

## Setup

- Implementation file: `experiment-01-trace-pipeline.ts`
- Runtime: Node.js + TypeScript type-check (`npx tsc --noEmit`)
- Input: synthetic raw trace fixture embedded in the implementation scaffold.

## Procedure

1. Parse raw conversation traces into normalized events.
2. Compute aggregate analytics over parsed traces.
3. Project per-conversation visualization series.
4. Build fine-tuning examples from successful traces.
5. Run schema-like invariants in code (non-empty prompts/responses, deterministic event ordering).

## Acceptance criteria

- Parser returns stable event ordering and valid event kinds.
- Analytics include tool usage and reasoning depth metrics.
- Visualization projections map one point per parsed event.
- SFT builder emits only eligible examples.
- TypeScript check passes without errors.

## Artifacts

- `experiment-01-trace-pipeline.ts`
- terminal output of `npx tsc --noEmit ...`
