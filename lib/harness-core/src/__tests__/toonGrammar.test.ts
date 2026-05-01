import { describe, expect, it } from 'vitest';
import {
  TOON_GRAMMAR_SOURCE_PACKAGE,
  buildToonGrammar,
  buildToonLarkGrammar,
  buildToonLlGuidanceGrammar,
} from '../index.js';

describe('TOON guidance grammar build', () => {
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
