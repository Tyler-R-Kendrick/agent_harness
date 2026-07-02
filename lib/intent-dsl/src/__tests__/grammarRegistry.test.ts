import { describe, expect, it } from 'vitest';
import { toLarkGrammar } from '../canonicalGrammar';
import { canonicalize } from '../minmap';
import {
  DEFAULT_INTENT_DOMAIN,
  buildDefaultIntentGrammarDefinition,
  getIntentGrammar,
  listIntentGrammars,
  registerIntentGrammar,
} from '../grammarRegistry';

describe('grammar registry', () => {
  it('seeds the default intent domain from toLarkGrammar', () => {
    const entry = getIntentGrammar(DEFAULT_INTENT_DOMAIN);

    expect(entry.domain).toBe(DEFAULT_INTENT_DOMAIN);
    expect(entry.grammar).toBe(toLarkGrammar());
    expect(entry.version).toBe(1);
  });

  it('exposes working minmap builders on the entry', () => {
    const entry = getIntentGrammar(DEFAULT_INTENT_DOMAIN);
    const source = 'use-dsl intent-v1 ; emit plan "open workspace" ; verify plan ;';
    const document = entry.minify('plan', source);

    expect(entry.expand(document)).toBe(entry.canonicalize(source));
    expect(entry.canonicalize(source)).toBe(canonicalize(source));
  });

  it('throws for an unknown domain', () => {
    expect(() => getIntentGrammar('does-not-exist')).toThrow(
      /Unknown intent grammar domain: does-not-exist/,
    );
  });

  it('registers a new domain and lists it alongside the default', () => {
    const domain = 'registry-test-domain';
    const registered = registerIntentGrammar(domain, {
      grammar: 'start: "x"',
      minify: buildDefaultIntentGrammarDefinition().minify,
      expand: buildDefaultIntentGrammarDefinition().expand,
      canonicalize: buildDefaultIntentGrammarDefinition().canonicalize,
      version: 7,
    });

    expect(registered.domain).toBe(domain);
    expect(getIntentGrammar(domain).version).toBe(7);

    const domains = listIntentGrammars().map((entry) => entry.domain);
    expect(domains).toContain(DEFAULT_INTENT_DOMAIN);
    expect(domains).toContain(domain);
  });

  it('builds the default definition from the canonical grammar and minmap helpers', () => {
    const definition = buildDefaultIntentGrammarDefinition();

    expect(definition.grammar).toBe(toLarkGrammar());
    expect(definition.version).toBe(1);
    expect(typeof definition.minify).toBe('function');
    expect(typeof definition.expand).toBe('function');
    expect(typeof definition.canonicalize).toBe('function');
  });
});
