# Intent DSL Specification

Status: Proposed (companion to `docs/adr/2026-07-02-dsl-intent-layer.md`)
Date: 2026-07-02

Models and coding agents should emit minimal intent patterns through DSLs;
deterministic compilers translate intent into domain-specific implementations
in a framework of choice, and deterministic linters make output pretty. This
document specifies the DSL architecture: the canonical layer, the minified
layer with its `.min.map` sidecar, the grammar registry, and the
emission-point constraining rule.

## Design principles

1. **Design for the model, compress deterministically.** Anka
   (arXiv:2512.23214) shows LLM generation reliability comes from canonical,
   unambiguous forms — one way to say each thing, explicit naming. Token
   Sugar (arXiv:2512.08266) shows deterministic reversible shorthand cuts
   token cost without losing information. These compose as two layers, not
   one compromise language.
2. **The DSL is also the search space.** AFlow (arXiv:2410.10762) makes
   workflow generation tractable by constraining it to a small typed operator
   vocabulary; the same intent documents the executor consumes are the
   representation the meta-harness searches and the self-improvement loop
   mutates.
3. **Constrain emission, not reasoning.** Constraint Tax (arXiv:2606.25605)
   shows blanket structured-output constraints suppress tool-calling and
   reasoning in open-weight models. Grammars turn on exactly inside DSL
   emission blocks and off everywhere else.

## Layer 1 — canonical form

- Deterministic grammar (Lark) with canonical formatting: fixed keyword
  vocabulary, explicit block delimiters, no optional syntax variants.
- Every domain DSL defines: its statement kinds (typed operators), its value
  types, and its verification hooks (which AgentV suite or contract checks
  an emitted document).
- `canonicalize(x)` is idempotent and defined for every valid document; the
  canonical form is the stored, diffed, and reviewed representation.

## Layer 2 — minified form and `.min.map`

For any DSL document `intent.<dsl>`:

- `intent.<dsl>.min` — the minified document: keywords and named values
  replaced by short tokens from the map; whitespace normalized.
- `intent.<dsl>.min.map` — the sidecar:
  - `version` — map format version;
  - `grammar` — id + version of the source grammar in the registry;
  - `tokens` — the named-value table: `{ short: canonical }` for keywords,
    identifiers, and enum values;
  - `positions` — optional positional mapping (minified offset → canonical
    line/column) for diagnostics, in the spirit of JS source maps.
- Invariant: `expand(minify(x)) === canonicalize(x)` — machine-checked in
  `research/token-sugar-2512.08266/experiments/`.
- Constrained decoding uses the **minified vocabulary** as the grammar's
  terminal set, so generation spends the minimum tokens; debug tooling
  expands via the map. Pretty output is the job of deterministic linters,
  never the model.

## Grammar registry

- Keyed by domain (`workflow`, `harness-descriptor`, `sandbox-policy`,
  `ui-widget`, …); each entry: canonical Lark grammar, `.min.map`
  vocabulary, verification hook, and version.
- Implementation seam: `harness-core/src/constrainedDecoding.ts`
  (`constrainToLarkGrammar`, grammar/decode hook points) with
  `lib/llguidance-wasm` as the enforcement engine;
  `harness-core/src/toonGrammar.ts` (`createToonGrammarPlugin`) is the
  precedent for registering a grammar as a plugin.
  App-side: `agent-browser/src/services/constraintCompiler.ts`.
- Vercel json-render's Zod-cataloged component/action JSON is the reference
  for the `ui-widget` domain: the catalog is the grammar; the canvas renders
  the emitted document.

## The three-step task flow

Every task begins with discovery, not generation:

1. **Discover a harness.** Query the harness archive
   (`docs/adr/2026-07-02-self-improvement-loop.md`) for a purpose-built
   sub-harness matching the task family; if none fits, emit a
   `harness-descriptor` intent document to generate one.
2. **Select a DSL.** Query the grammar registry for the work domain; if none
   fits, emit intent to define one (a grammar definition is itself a DSL
   document, making the system self-hosting).
3. **Constrain output.** Execute with llguidance enforcing the selected
   grammar at emission points, in the minified vocabulary.

## Execution semantics

Intent documents compile onto the existing runtime rather than a new engine:
workflow intents become LogAct workflow definitions
(`harness-core/src/workflow.ts`) and `lib/workgraph` commands; actor
behavior binds through actor commands / events / GraphQL read models
(`docs/architecture/nanoservice-hosting-model.md`), so developers implement
handlers in their language and framework of choice while agents author only
intent.

## Verification

- Per-document: grammar validation + the domain's verification hook.
- Per-grammar: round-trip property (`expand ∘ minify = canonicalize`) and
  fixture corpus in the domain's research packet or lib tests.
- Per-loop: Constraint Tax guard — evals compare tool-calling quality with
  constraints on vs. off to catch over-constraining regressions
  (`research/constraint-tax-2606.25605`).
