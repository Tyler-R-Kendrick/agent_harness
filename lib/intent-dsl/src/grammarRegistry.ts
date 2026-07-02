// Domain-keyed intent grammar registry, mirroring the CATALOG pattern of
// harness-core/src/grammars.ts. Each entry pairs a canonical Lark grammar (from
// toLarkGrammar) with its `.min.map` builders so a domain DSL can both constrain
// emission and round-trip its documents. Seeded with one default domain (`intent`).

import { toLarkGrammar } from './canonicalGrammar';
import {
  canonicalize,
  expand,
  minify,
  type MinifiedDocument,
} from './minmap';

export interface IntentGrammarDefinition {
  /** Canonical Lark grammar source for the domain (see toLarkGrammar). */
  readonly grammar: string;
  /** Builds the minified `<name>.min` document plus its `.min.map` sidecar. */
  readonly minify: (sourceName: string, source: string) => MinifiedDocument;
  /** Reverses a minified document back to its canonical form. */
  readonly expand: (document: MinifiedDocument) => string;
  /** Idempotently normalizes a document to its canonical form. */
  readonly canonicalize: (source: string) => string;
  /** Registry version of the grammar entry. */
  readonly version: number;
}

export interface IntentGrammarEntry extends IntentGrammarDefinition {
  readonly domain: string;
}

export const DEFAULT_INTENT_DOMAIN = 'intent';

const REGISTRY = new Map<string, IntentGrammarEntry>();

export function registerIntentGrammar(
  domain: string,
  definition: IntentGrammarDefinition,
): IntentGrammarEntry {
  const entry: IntentGrammarEntry = { domain, ...definition };
  REGISTRY.set(domain, entry);
  return entry;
}

export function getIntentGrammar(domain: string): IntentGrammarEntry {
  const entry = REGISTRY.get(domain);
  if (entry === undefined) {
    throw new Error(`Unknown intent grammar domain: ${domain}`);
  }
  return entry;
}

export function listIntentGrammars(): IntentGrammarEntry[] {
  return [...REGISTRY.values()];
}

export function buildDefaultIntentGrammarDefinition(): IntentGrammarDefinition {
  return {
    grammar: toLarkGrammar(),
    minify,
    expand,
    canonicalize,
    version: 1,
  };
}

registerIntentGrammar(DEFAULT_INTENT_DOMAIN, buildDefaultIntentGrammarDefinition());
