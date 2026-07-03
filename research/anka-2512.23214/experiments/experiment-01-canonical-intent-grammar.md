# Experiment 01 — Canonical Intent Grammar Scaffold

## Hypothesis

A single canonical definition of the intent-DSL can drive both a recursive-descent validator and an emitted Lark grammar, with the two agreeing on every fixture, eliminating validator/grammar drift by construction.

## Setup

- Implementation: `experiment-01-canonical-intent-grammar.ts`
- Statement kinds: `discover-harness`, `use-dsl`, `emit`, `verify`.
- Fixtures: 2 intent programs (1 valid, 1 invalid), fixed strings, no randomness.
- Validation command: (from the repo root) `npx tsc --noEmit --target es2015 --skipLibCheck --moduleResolution nodenext --module nodenext research/anka-2512.23214/experiments/experiment-01-canonical-intent-grammar.ts`

## Procedure

1. Tokenize each fixture into a typed token stream.
2. Parse with the recursive-descent parser into an `IntentProgram`.
3. Run semantic validation (dialect before `emit`, `verify` targets exist).
4. Emit the Lark grammar string via `toLarkGrammar()`.
5. Log parse verdicts, error lists, and grammar length deterministically.

## Acceptance criteria

- Scaffold compiles cleanly with the validation command above.
- The valid fixture parses to a typed AST; the invalid fixture yields explicit errors.
- `toLarkGrammar()` returns a non-empty grammar covering all four statement kinds.
- Demo output is identical across runs (no `Math.random()`/`Date.now()`).

## Artifacts

- Parse verdict log for both fixtures.
- Emitted Lark grammar string.
- Typed AST snapshot of the valid program.
