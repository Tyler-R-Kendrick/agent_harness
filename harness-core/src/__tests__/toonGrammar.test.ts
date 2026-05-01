import { describe, expect, it } from 'vitest';
import {
  TOON_GRAMMAR_SOURCE_PACKAGE,
  TOON_DECODE_HOOK_ID,
  TOON_GRAMMAR_HOOK_ID,
  TOON_GRAMMAR_PLUGIN_ID,
  CONSTRAINED_DECODING_DECODE_HOOK_POINT,
  CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT,
  buildToonGrammar,
  buildToonLarkGrammar,
  buildToonLlGuidanceGrammar,
  constrainToJsonSchema,
  constrainToToon,
  createHarnessExtensionContext,
  createToonGrammarPlugin,
  decodeConstrainedOutputWithHooks,
  resolveGuidanceTsGrammar,
} from '../index.js';

describe('TOON guidance grammar build', () => {
  it('registers TOON constrained decoding through a harness extension plugin', async () => {
    const context = createHarnessExtensionContext();

    expect(context.hooks.forPoint(CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT)).toEqual([]);
    await expect(resolveGuidanceTsGrammar(constrainToToon(), { hooks: context.hooks }))
      .rejects.toThrow(/No constrained decoding hook resolved toon/i);

    await context.plugins.load(createToonGrammarPlugin());

    expect(context.plugins.get(TOON_GRAMMAR_PLUGIN_ID)?.id).toBe(TOON_GRAMMAR_PLUGIN_ID);
    expect(context.hooks.get(TOON_GRAMMAR_HOOK_ID)).toEqual(expect.objectContaining({
      id: TOON_GRAMMAR_HOOK_ID,
      point: CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT,
    }));
    expect(context.hooks.get(TOON_DECODE_HOOK_ID)).toEqual(expect.objectContaining({
      id: TOON_DECODE_HOOK_ID,
      point: CONSTRAINED_DECODING_DECODE_HOOK_POINT,
    }));
    await expect(context.hooks.runPipes(CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT, {
      decoding: constrainToJsonSchema({ type: 'string' }),
    })).resolves.toEqual(expect.objectContaining({
      payload: {
        decoding: constrainToJsonSchema({ type: 'string' }),
      },
    }));
    await expect(context.hooks.runPipes(CONSTRAINED_DECODING_DECODE_HOOK_POINT, {
      text: '"ok"',
      decoding: constrainToJsonSchema({ type: 'string' }),
    })).resolves.toEqual(expect.objectContaining({
      payload: {
        text: '"ok"',
        decoding: constrainToJsonSchema({ type: 'string' }),
      },
    }));
    expect((await resolveGuidanceTsGrammar(constrainToToon({ maxTokens: 64 }), { hooks: context.hooks })).serialize())
      .toEqual(buildToonLlGuidanceGrammar(64));
    await expect(decodeConstrainedOutputWithHooks('status: ok\ncount: 2', constrainToToon(), { hooks: context.hooks }))
      .resolves.toEqual({ status: 'ok', count: 2 });
  });

  it('loads the TOON package surface and builds a reusable ll-guidance grammar representation', () => {
    const build = buildToonGrammar();

    expect(build.sourcePackage).toBe(TOON_GRAMMAR_SOURCE_PACKAGE);
    expect(build.delimiters).toEqual([',', '\t', '|']);
    expect(build.defaultDelimiter).toBe(',');
    expect(build.larkGrammar).toBe(buildToonLarkGrammar());
    expect(build.llGuidanceGrammar).toEqual(buildToonLlGuidanceGrammar());
    expect(build.llGuidanceGrammar).toEqual({
      grammars: [{ name: 'toon', lark_grammar: build.larkGrammar }],
    });
    expect(buildToonLlGuidanceGrammar(64)).toEqual({
      grammars: [{ name: 'toon', lark_grammar: build.larkGrammar }],
      max_tokens: 64,
    });
  });

  it('represents the full TOON concrete syntax instead of a permissive line wildcard', () => {
    const grammar = buildToonLarkGrammar();

    expect(grammar).toContain('array_header');
    expect(grammar).toContain('tabular_header');
    expect(grammar).toContain('field_list');
    expect(grammar).toContain('list_item');
    expect(grammar).toContain('object_field');
    expect(grammar).toContain('quoted_string');
    expect(grammar).toContain('primitive');
    expect(grammar).not.toContain('/.*/');
  });

  it('keeps package-generated TOON samples alongside the grammar build for regression coverage', () => {
    const build = buildToonGrammar();

    expect(build.samples).toHaveLength(3);
    expect(build.samples.every((sample) => sample.text.length > 0)).toBe(true);
    expect(build.samples.map((sample) => sample.decoded)).toEqual([
      { status: 'ok', count: 2 },
      { users: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }] },
      ['red', 'green', 'blue'],
    ]);
  });
});
