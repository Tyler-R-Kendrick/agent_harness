# @agent-harness/intent-dsl

Canonical intent DSL for agent_harness: a two-layer output format designed for LLM
reliability. Implements Phase 0, Workstream C of the intent DSL migration
(`docs/adr/2026-07-02-dsl-intent-layer.md`, `docs/architecture/dsl-intent-spec.md`).

## Purpose

- **Layer 1 — canonical form** (Anka, arXiv:2512.23214): one unambiguous way to say each
  thing. `canonicalGrammar.ts` tokenizes and parses the canonical form and emits the Lark
  grammar the constrained decoder registers.
- **Layer 2 — `.min.map` minifier** (Token Sugar, arXiv:2512.08266): a deterministic,
  reversible shorthand that cuts token cost. Guarantees the round-trip invariant
  `expand(minify(x)) === canonicalize(x)`.
- **Grammar registry**: domain-keyed catalog pairing a canonical Lark grammar with its
  `.min.map` builders, mirroring `harness-core/src/grammars.ts`. Seeded with the default
  `intent` domain.
- **Registration plugin**: `createIntentDslGrammarPlugin()` registers grammar and decode
  pipes at the constrained-decoding hook points, mirroring
  `harness-core/src/toonGrammar.ts`.

## Public API

| Module | Exports |
| --- | --- |
| `canonicalGrammar` | `tokenize`, `parseIntentProgram`, `toLarkGrammar`, types `Token`, `TokenKind`, `IntentStatement`, `IntentProgram`, `ParseResult` |
| `minmap` | `minify`, `expand`, `canonicalize`, `verifyRoundTrip`, `approximateTokens`, `tokenize` (as `tokenizeMinMap`), types `MinMap`, `MinMapEntry`, `MinifiedDocument`, `SavingsReport` |
| `grammarRegistry` | `registerIntentGrammar`, `getIntentGrammar`, `listIntentGrammars`, `buildDefaultIntentGrammarDefinition`, `DEFAULT_INTENT_DOMAIN`, types `IntentGrammarDefinition`, `IntentGrammarEntry` |
| `plugin` | `createIntentDslGrammarPlugin`, `INTENT_DSL_GRAMMAR_PLUGIN_ID`, `INTENT_DSL_GRAMMAR_HOOK_ID`, `INTENT_DSL_DECODE_HOOK_ID`, `INTENT_DSL_SOURCE_PACKAGE` |

## Phase 0: registration only, constraining disabled

**Registration is not activation.** The plugin registers pipes but they stay inert. This
package does **not** modify harness-core's `ConstrainedDecoding` union (its kinds remain
`json_schema | lark | toon | zod`). The pipes fire only when a decoding is `kind: 'lark'`
**and** carries an `intentDomain` discriminator that this package owns. Nothing in the
harness constructs such a decoding in Phase 0, so the pipes always return `undefined` and
every existing constrained-decoding path is completely unaffected. Turning constraining ON
at emission points is a later phase (`intent.mode=enforce`).
