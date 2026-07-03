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

## harness-core now routes `lark` through the grammar/decode hooks

harness-core previously compiled and decoded `lark` constraints inline, bypassing the
constrained-decoding hook points, so these pipes could register but never fire. harness-core
now consults the grammar hook (`CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT`) and the decode hook
(`CONSTRAINED_DECODING_DECODE_HOOK_POINT`) **first** for `lark` decodings, exactly as it
already did for `toon`, and falls back to the current inline compilation/decoding when no
pipe resolves. That fall-back means existing plain-`lark` consumers are byte-for-byte
unchanged. As a result, `createIntentDslGrammarPlugin()` now actually fires when an intent
decoding (`kind: 'lark'` **plus** the `intentDomain` discriminator this package owns) is
passed to `createGuidanceTsInferenceClient`.

The remaining app-side steps to light this up end-to-end are:

- thread a `ConstrainedDecoding` option onto the Codi inference call,
- register `createIntentDslGrammarPlugin()` into the live `HookRegistry`,
- add `intent.mode` config, and
- wire `llguidance-wasm` for the browser tier.
