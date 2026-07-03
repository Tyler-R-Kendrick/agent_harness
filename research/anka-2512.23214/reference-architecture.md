# Reference Architecture — Anka-style Canonical Intent Grammar

## Objective

Provide one canonical, unambiguous definition of the intent-DSL that simultaneously drives offline validation and llguidance-constrained emission, so the grammar the model decodes under is provably the grammar the validator accepts.

## Components

1. **IntentTokenizer**
   - Converts raw intent source into a typed token stream (words, strings, terminators).
2. **CanonicalParser**
   - Recursive-descent parser; one production per statement kind, no alternative spellings.
3. **SemanticValidator**
   - Enforces cross-statement rules (dialect declared before `emit`, `verify` targets exist).
4. **LarkEmitter**
   - `toLarkGrammar()` renders the same statement definitions as a Lark grammar string.
5. **ConstraintBridge**
   - Feeds the emitted grammar to `constrainToLarkGrammar` in `harness-core/src/constrainedDecoding.ts` via the `CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT` hook.
6. **FixtureLedger**
   - Append-only record of parse/validation outcomes for regression fixtures.
7. **DriftGate**
   - Rejects releases where validator behavior and emitted grammar disagree on fixtures.

## Data flow

1. Author (or model) produces intent source text.
2. Tokenizer emits `Token[]`.
3. Parser produces `IntentProgram` or typed parse errors.
4. Validator applies semantic rules and returns an accept/reject verdict.
5. `LarkEmitter` renders the grammar string once per DSL version.
6. Bridge registers the grammar with the constrained-decoding hook, as `harness-core/src/toonGrammar.ts` does today.
7. Ledger stores fixture verdicts for the drift gate.

## Validation and safety gates

- Every statement kind must have exactly one canonical spelling; the parser rejects synonyms.
- Semantic rules run after parsing; a program is accepted only if both layers pass.
- The drift gate replays fixture programs against both the validator and the emitted grammar; any disagreement blocks rollout.
- Grammar strings are versioned; `agent-browser/src/services/constraintCompiler.ts` may only consume gated versions.

## Rollout policy

- Start in shadow mode: validate model emissions post-hoc without constraining decoding.
- Graduate to constrained mode for `emit` blocks once fixture parity holds.
- Adopt as the source for `docs/architecture/dsl-intent-spec.md` and the intent-DSL ADR only after a full release cycle without drift-gate failures.

## Metrics

- Fixture pass rate (validator and grammar must agree on 100%).
- First-try parse rate of model-emitted programs.
- Repair-loop iterations per accepted program.
- Grammar/validator drift incidents per release.
- Token overhead of canonical form versus rejected terse variants.
