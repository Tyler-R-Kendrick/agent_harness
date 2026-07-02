# Anka (arXiv:2512.23214)

- Paper: **Anka: A Programming Language Designed for LLM Reliability**
- Links: https://arxiv.org/abs/2512.23214 / https://huggingface.co/papers/2512.23214
- Published: 2025-12 (per arXiv listing)

## What this paper proposes

Anka argues that when an LLM is the primary author of code, the language should be designed for the *model*, not the human. Instead of terse syntax optimized for typing speed, Anka uses:

1. Explicit naming and verbose, unambiguous keywords.
2. Canonical forms — exactly one way to express each construct.
3. A grammar deliberately shaped to minimize LLM generation errors.

The paper reports that reliability gains come from removing ambiguity, not from adding tokens: when there is only one valid spelling of an intent, the model's next-token distribution collapses onto it.

## Extracted capability to implement

### Capability name

**Canonical Intent Grammar (CIG)**

### Capability definition

A canonical, unambiguous intent-DSL with a single validator that also *emits* a Lark grammar string suitable for llguidance-constrained decoding, so one definition drives both offline validation and online constrained emission.

### Why it matters in our stack

- The repo already has grammar-constrained decoding: `harness-core/src/constrainedDecoding.ts` (`constrainToLarkGrammar`), `harness-core/src/grammars.ts`, `harness-core/src/toonGrammar.ts`, and the `lib/llguidance-wasm` runtime.
- `agent-browser/src/services/constraintCompiler.ts` compiles constraints per emission; CIG gives it a canonical source of truth instead of hand-maintained grammars.
- Feeds the planned `docs/architecture/dsl-intent-spec.md` and the intent-DSL ADR with a concrete, testable grammar definition.

## Minimal algorithm sketch

1. Define a small intent-AST (`discover-harness`, `use-dsl`, `emit`, `verify`).
2. Tokenize source into a tiny token stream (words, strings, terminators).
3. Parse with a recursive-descent parser; every construct has one canonical spelling.
4. Validate semantic rules (dialect declared before emission, verify targets exist).
5. Emit a Lark grammar string from the same statement definitions via `toLarkGrammar()`.
6. Hand the grammar to the constrained-decoding hook so emission and validation cannot drift.
7. Log parse/validation results for fixture programs deterministically.

## Deliverables in this folder

- `reference-architecture.md` — architecture for integrating CIG in agent-browser style runtimes.
- `experiments/experiment-01-canonical-intent-grammar.md` — experiment design and acceptance criteria.
- `experiments/experiment-01-canonical-intent-grammar.ts` — TypeScript implementation scaffold.
