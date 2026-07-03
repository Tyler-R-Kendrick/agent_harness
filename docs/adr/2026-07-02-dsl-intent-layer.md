# ADR: Intent DSL Layer with .min.map Minification

## Status
Proposed

## Decision
Adopt a two-layer intent DSL as the primary output format for models and
coding agents: a canonical, unambiguous form designed for LLM reliability
(Anka, arXiv:2512.23214) plus a deterministic, reversible minifier emitting
`<name>.min` and `<name>.min.map` sidecars (Token Sugar, arXiv:2512.08266).
Constrained decoding (llguidance) enforces the DSL grammar at emission points
only. Full specification: `docs/architecture/dsl-intent-spec.md`.

## Contract
- Grammar registry keyed by domain: each domain DSL registers a canonical
  grammar (Lark) plus its `.min.map` vocabulary. Registration builds on
  `harness-core/src/constrainedDecoding.ts` (`constrainToLarkGrammar`) and
  `harness-core/src/grammars.ts`; the TOON grammar plugin
  (`toonGrammar.ts`) is the registration precedent.
- Constraint gating: grammar ON only inside DSL emission blocks, OFF for
  reasoning and tool selection (Constraint Tax, arXiv:2606.25605).
- Round-trip invariant: `expand(minify(x)) === canonicalize(x)`; minified
  and canonical forms are equivalent artifacts, and only deterministic
  tooling ever prettifies output.
- Proposed future package: `lib/intent-dsl` following `lib/<name>`
  conventions (ESM TS, vitest, 100% coverage).
- Research packets: `research/anka-2512.23214`,
  `research/token-sugar-2512.08266`, `research/constraint-tax-2606.25605`.

## Rollout phases
1. **Phase 0 (shadow):** grammars registered; agents may emit intent DSL but
   nothing consumes it; emissions logged for grammar-fit analysis.
2. **Phase 1 (opt-in enforce):** `intent.mode=enforce` turns on llguidance
   constraining at emission points for opted-in agents/tasks.
3. **Phase 2 (core-default):** intent DSL is the default output for harness
   generation and workflow definition tasks; raw-code output requires
   explicit opt-out.

## Migration notes
- Existing constrained-decoding consumers (TOON, Zod, JSON-schema paths) are
  unaffected; the intent layer is additive grammar registrations.
- `agent-browser/src/services/constraintCompiler.ts` is the app-side seam
  where emission-point gating attaches.
