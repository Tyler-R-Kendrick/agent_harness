// Inert grammar-registration plugin for the intent DSL.
//
// Phase 0 rule: REGISTRATION != ACTIVATION; constraining stays OFF. This plugin
// registers pipes at the constrained-decoding grammar and decode hook points, exactly
// mirroring harness-core/src/toonGrammar.ts's createToonGrammarPlugin. It does NOT touch
// harness-core's ConstrainedDecoding union (kinds stay json_schema | lark | toon | zod).
// Instead the pipes are guarded on a discriminator this package owns: they fire ONLY when
// the decoding is `kind: 'lark'` AND carries an `intentDomain` field. Nothing in the
// harness constructs such a decoding in Phase 0, so both pipes always return `undefined`,
// leaving every existing constrained-decoding path (TOON, Zod, JSON-schema, plain Lark)
// completely unaffected. Turning constraining ON is a later phase (intent.mode=enforce).

import {
  CONSTRAINED_DECODING_DECODE_HOOK_POINT,
  CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT,
  constrainToLarkGrammar,
  type ConstrainedDecoding,
  type ConstrainedOutputDecodeHookPayload,
  type ConstrainedOutputGrammarHookPayload,
  type HarnessPlugin,
} from 'harness-core';
import { parseIntentProgram } from './canonicalGrammar';
import { getIntentGrammar } from './grammarRegistry';

export const INTENT_DSL_SOURCE_PACKAGE = '@agent-harness/intent-dsl';
export const INTENT_DSL_GRAMMAR_PLUGIN_ID = 'intent-dsl-grammar';
export const INTENT_DSL_GRAMMAR_HOOK_ID = 'intent-dsl-grammar:grammar';
export const INTENT_DSL_DECODE_HOOK_ID = 'intent-dsl-grammar:decode';

/**
 * Discriminator this package owns and appends to a `lark` decoding when an intent
 * emission is explicitly requested. It is intentionally NOT part of harness-core's
 * ConstrainedDecoding union, which keeps the pipes inert until a caller opts in.
 */
interface IntentDecodingDiscriminator {
  readonly intentDomain?: string;
}

/**
 * Returns the intent domain to constrain for, or `undefined` when this decoding is not an
 * opted-in intent emission (wrong kind, or no `intentDomain` discriminator). Returning
 * `undefined` is what keeps the plugin inert in Phase 0.
 */
function intentDomainOf(decoding: ConstrainedDecoding): string | undefined {
  if (decoding.kind !== 'lark') {
    return undefined;
  }
  return (decoding as IntentDecodingDiscriminator).intentDomain;
}

export function createIntentDslGrammarPlugin(): HarnessPlugin {
  return {
    id: INTENT_DSL_GRAMMAR_PLUGIN_ID,
    register({ hooks }) {
      hooks.registerPipe<ConstrainedOutputGrammarHookPayload>({
        id: INTENT_DSL_GRAMMAR_HOOK_ID,
        point: CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT,
        kind: 'deterministic',
        run: ({ payload }) => {
          const domain = intentDomainOf(payload.decoding);
          if (domain === undefined) {
            return undefined;
          }
          const entry = getIntentGrammar(domain);
          return {
            payload: {
              ...payload,
              grammar: constrainToLarkGrammar(entry.grammar, {
                maxTokens: payload.decoding.maxTokens,
              }),
            },
            stop: true,
            output: { sourcePackage: INTENT_DSL_SOURCE_PACKAGE, domain },
          };
        },
      });
      hooks.registerPipe<ConstrainedOutputDecodeHookPayload>({
        id: INTENT_DSL_DECODE_HOOK_ID,
        point: CONSTRAINED_DECODING_DECODE_HOOK_POINT,
        kind: 'deterministic',
        run: ({ payload }) => {
          const domain = intentDomainOf(payload.decoding);
          if (domain === undefined) {
            return undefined;
          }
          return {
            payload: {
              ...payload,
              decoded: parseIntentProgram(payload.text),
            },
            stop: true,
            output: { sourcePackage: INTENT_DSL_SOURCE_PACKAGE, domain },
          };
        },
      });
    },
  };
}
