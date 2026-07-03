import { describe, expect, it } from 'vitest';
import {
  CONSTRAINED_DECODING_DECODE_HOOK_POINT,
  CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT,
  constrainToLarkGrammar,
  constrainToToon,
  createHarnessExtensionContext,
  type ConstrainedDecoding,
  type ConstrainedOutputDecodeHookPayload,
  type ConstrainedOutputGrammarHookPayload,
  type HarnessHookEvent,
} from 'harness-core';
import type { ParseResult } from '../canonicalGrammar';
import {
  INTENT_DSL_DECODE_HOOK_ID,
  INTENT_DSL_GRAMMAR_HOOK_ID,
  INTENT_DSL_GRAMMAR_PLUGIN_ID,
  INTENT_DSL_SOURCE_PACKAGE,
  createIntentDslGrammarPlugin,
} from '../plugin';

/** Attach the package-owned discriminator so a `lark` decoding opts into the intent path. */
type IntentLarkDecoding = ReturnType<typeof constrainToLarkGrammar> & { intentDomain: string };
function intentLarkDecoding(domain: string): ConstrainedDecoding {
  const decoding: IntentLarkDecoding = {
    ...constrainToLarkGrammar('start: ignored'),
    intentDomain: domain,
  };
  return decoding;
}

function grammarEvent(
  decoding: ConstrainedDecoding,
): HarnessHookEvent<ConstrainedOutputGrammarHookPayload> {
  return {
    point: CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT,
    payload: { decoding },
    metadata: {},
  };
}

function decodeEvent(
  text: string,
  decoding: ConstrainedDecoding,
): HarnessHookEvent<ConstrainedOutputDecodeHookPayload> {
  return {
    point: CONSTRAINED_DECODING_DECODE_HOOK_POINT,
    payload: { text, decoding },
    metadata: {},
  };
}

describe('createIntentDslGrammarPlugin', () => {
  it('registers pipes at both constrained-decoding hook points', async () => {
    const context = createHarnessExtensionContext();
    await context.plugins.load(createIntentDslGrammarPlugin());

    expect(context.plugins.get(INTENT_DSL_GRAMMAR_PLUGIN_ID)?.id).toBe(INTENT_DSL_GRAMMAR_PLUGIN_ID);
    expect(context.hooks.get(INTENT_DSL_GRAMMAR_HOOK_ID)).toEqual(
      expect.objectContaining({
        id: INTENT_DSL_GRAMMAR_HOOK_ID,
        point: CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT,
      }),
    );
    expect(context.hooks.get(INTENT_DSL_DECODE_HOOK_ID)).toEqual(
      expect.objectContaining({
        id: INTENT_DSL_DECODE_HOOK_ID,
        point: CONSTRAINED_DECODING_DECODE_HOOK_POINT,
      }),
    );
  });

  it('stays inert for plain lark and toon decodings (Phase 0: no activation)', async () => {
    const context = createHarnessExtensionContext();
    await context.plugins.load(createIntentDslGrammarPlugin());

    const grammarHook = context.hooks.get<ConstrainedOutputGrammarHookPayload>(INTENT_DSL_GRAMMAR_HOOK_ID);
    const decodeHook = context.hooks.get<ConstrainedOutputDecodeHookPayload>(INTENT_DSL_DECODE_HOOK_ID);
    if (!grammarHook || !decodeHook) {
      throw new Error('expected both intent-dsl pipes to be registered');
    }

    expect(await grammarHook.run(grammarEvent(constrainToLarkGrammar('start: x')))).toBeUndefined();
    expect(await grammarHook.run(grammarEvent(constrainToToon()))).toBeUndefined();
    expect(await decodeHook.run(decodeEvent('use-dsl x ;', constrainToLarkGrammar('start: x')))).toBeUndefined();
    expect(await decodeHook.run(decodeEvent('status: ok', constrainToToon()))).toBeUndefined();

    // At the harness level, an un-opted-in lark decoding passes through untouched.
    const passthrough = await context.hooks.runPipes(CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT, {
      decoding: constrainToLarkGrammar('start: x'),
    });
    expect(passthrough.stopped).toBe(false);
    expect(passthrough.payload).toEqual({ decoding: constrainToLarkGrammar('start: x') });
  });

  it('fires only when the intent discriminator is present', async () => {
    const context = createHarnessExtensionContext();
    await context.plugins.load(createIntentDslGrammarPlugin());

    const grammarHook = context.hooks.get<ConstrainedOutputGrammarHookPayload>(INTENT_DSL_GRAMMAR_HOOK_ID);
    const decodeHook = context.hooks.get<ConstrainedOutputDecodeHookPayload>(INTENT_DSL_DECODE_HOOK_ID);
    if (!grammarHook || !decodeHook) {
      throw new Error('expected both intent-dsl pipes to be registered');
    }

    const grammarResult = await grammarHook.run(grammarEvent(intentLarkDecoding('intent')));
    expect(grammarResult?.stop).toBe(true);
    expect(grammarResult?.output).toEqual({ sourcePackage: INTENT_DSL_SOURCE_PACKAGE, domain: 'intent' });
    const producedGrammar = grammarResult?.payload?.grammar as ConstrainedDecoding | undefined;
    expect(producedGrammar).toEqual(
      expect.objectContaining({ kind: 'lark', grammar: expect.stringContaining('start: statement+') }),
    );

    const decodeResult = await decodeHook.run(
      decodeEvent(
        'use-dsl intent-v1 ; emit plan "open workspace" ; verify plan ;',
        intentLarkDecoding('intent'),
      ),
    );
    expect(decodeResult?.stop).toBe(true);
    expect(decodeResult?.output).toEqual({ sourcePackage: INTENT_DSL_SOURCE_PACKAGE, domain: 'intent' });
    const decoded = decodeResult?.payload?.decoded as ParseResult | undefined;
    expect(decoded?.ok).toBe(true);
  });
});
