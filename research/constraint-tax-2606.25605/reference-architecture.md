# Reference Architecture — Emission-Point Constraint Gating

## Objective

Apply grammar constraints only at DSL-emission points and leave reasoning and tool selection unconstrained, so the runtime pays the constraint tax exactly where structure is required and nowhere else.

## Components

1. **EventClassifier**
   - Types each generation event with a task kind (planning, tool-selection, dsl-emission) and output kind.
2. **PolicyTable**
   - Decision table mapping (task kind × output kind) to a `DecodingMode`; free is the default.
3. **GatingStateMachine**
   - Steps over events, opening/closing constrained spans on mode transitions.
4. **ConstraintArmer**
   - Arms `CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT` in `harness-core/src/constrainedDecoding.ts` only while a span is open.
5. **GrammarSource**
   - Supplies the span's grammar via `agent-browser/src/services/constraintCompiler.ts`, using the canonical grammar from `research/anka-2512.23214` and the minified vocabulary from `research/token-sugar-2512.08266`.
6. **TraceRecorder**
   - Append-only trace of mode per step for replay and audit.
7. **InvariantChecker**
   - Asserts constraints were active only inside emission spans.

## Data flow

1. The runtime produces a stream of typed generation events.
2. Classifier labels each event; PolicyTable returns the required mode.
3. State machine compares required mode to current mode and transitions if needed.
4. On `free -> constrained`, Armer registers the compiled grammar with the hook; on `constrained -> free`, it disarms.
5. Recorder logs `(step, label, mode)` for every event.
6. Checker replays the trace and reports span boundaries plus the invariant verdict.

## Validation and safety gates

- The policy table is total by construction: unlisted combinations resolve to `free`, never to `constrained`.
- Only `dsl-emission` events may map to `constrained`; the checker fails any trace violating this.
- Spans must be well-formed (every open has a close); dangling spans fail the run.
- Constrained spans must produce output that parses under the armed grammar before the span result is accepted.

## Rollout policy

- Start in shadow mode: compute gating decisions and traces while decoding stays fully free.
- Graduate to gated mode for DSL-emission blocks on low-risk tasks once shadow traces show zero invariant violations.
- Compare tool-call success against a globally-constrained baseline before making gating the default.

## Metrics

- Constrained fraction of generated steps (the paid tax).
- Tool-call success rate: gated versus globally constrained versus fully free.
- Invariant violation count (must be zero).
- DSL parse rate inside constrained spans.
- Span churn (transitions per 100 steps).
