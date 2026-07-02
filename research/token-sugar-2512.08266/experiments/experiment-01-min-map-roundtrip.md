# Experiment 01 — Min/Map Round-Trip Scaffold

## Hypothesis

A deterministic minifier with a `.min.map` sidecar (token table + positional mapping) achieves measurable token savings on intent-DSL documents while satisfying the exact invariant `expand(minify(x)) === canonicalize(x)` on every fixture.

## Setup

- Implementation: `experiment-01-min-map-roundtrip.ts`
- Fixtures: 3 intent programs written in the canonical form from `research/anka-2512.23214`.
- All inputs are fixed strings; short-form assignment is first-appearance order.
- Validation command: `cd /home/user/agent_harness && npx tsc --noEmit --target es2015 --skipLibCheck --moduleResolution nodenext --module nodenext research/token-sugar-2512.08266/experiments/experiment-01-min-map-roundtrip.ts`

## Procedure

1. Canonicalize each fixture into a whitespace-stable token sequence.
2. Run `minify()` to produce the `.min` stream and `.min.map` sidecar.
3. Run `expand()` from the pair and compare against the canonical form.
4. Account character and approximate token savings per fixture.
5. Log savings and invariant verdicts deterministically.

## Acceptance criteria

- Scaffold compiles cleanly with the validation command above.
- Round-trip invariant holds for all 3 fixtures.
- Sidecar carries version, token table, and positional entries covering every token.
- Demo output is identical across runs (no `Math.random()`/`Date.now()`).

## Artifacts

- `.min` streams and `.min.map` sidecars for the 3 fixtures.
- Per-fixture savings table (characters and approximate tokens).
- Round-trip verdict log.
