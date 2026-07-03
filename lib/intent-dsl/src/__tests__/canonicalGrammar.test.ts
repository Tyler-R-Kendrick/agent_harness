import { describe, expect, it } from 'vitest';
import {
  parseIntentProgram,
  toLarkGrammar,
  tokenize,
  type ParseResult,
} from '../canonicalGrammar';

const VALID_PROGRAM =
  'use-dsl intent-v1 ; discover-harness agent-browser ; emit plan "open workspace" ; verify plan ;';

function expectRejected(result: ParseResult): readonly string[] {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('expected the program to be rejected');
  }
  return result.errors;
}

describe('tokenize', () => {
  it('splits keywords, quoted strings and terminators', () => {
    expect(tokenize('emit plan "open workspace" ;')).toEqual([
      { kind: 'word', value: 'emit' },
      { kind: 'word', value: 'plan' },
      { kind: 'string', value: 'open workspace' },
      { kind: 'terminator', value: ';' },
    ]);
  });

  it('treats spaces, newlines and tabs as whitespace and reads a word at end of input', () => {
    expect(tokenize('a\n\tb')).toEqual([
      { kind: 'word', value: 'a' },
      { kind: 'word', value: 'b' },
    ]);
  });

  it('captures an unterminated quoted string up to end of input', () => {
    expect(tokenize('emit "unterminated')).toEqual([
      { kind: 'word', value: 'emit' },
      { kind: 'string', value: 'unterminated' },
    ]);
  });
});

describe('parseIntentProgram', () => {
  it('accepts a canonical program with all four statement kinds', () => {
    const result = parseIntentProgram(VALID_PROGRAM);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected the program to parse');
    }
    expect(result.program.statements).toEqual([
      { kind: 'use-dsl', dialect: 'intent-v1' },
      { kind: 'discover-harness', target: 'agent-browser' },
      { kind: 'emit', artifact: 'plan', payload: 'open workspace' },
      { kind: 'verify', artifact: 'plan' },
    ]);
  });

  it('rejects a leading non-keyword token', () => {
    expect(expectRejected(parseIntentProgram('"lonely" ;'))).toContain(
      'statement 1: expected a canonical keyword',
    );
  });

  it('rejects discover-harness without a target', () => {
    expect(expectRejected(parseIntentProgram('discover-harness ;'))).toContain(
      'statement 1: discover-harness requires a target word',
    );
  });

  it('rejects use-dsl without a dialect', () => {
    expect(expectRejected(parseIntentProgram('use-dsl ;'))).toContain(
      'statement 1: use-dsl requires a dialect word',
    );
  });

  it('rejects emit missing its quoted payload', () => {
    expect(expectRejected(parseIntentProgram('use-dsl intent-v1 ; emit plan ;'))).toContain(
      'statement 2: emit requires an artifact word and a quoted payload',
    );
  });

  it('rejects emit missing its artifact word', () => {
    expect(expectRejected(parseIntentProgram('use-dsl intent-v1 ; emit "payload-only" ;'))).toContain(
      'statement 2: emit requires an artifact word and a quoted payload',
    );
  });

  it('rejects verify without an artifact', () => {
    expect(expectRejected(parseIntentProgram('verify ;'))).toContain(
      'statement 1: verify requires an artifact word',
    );
  });

  it('rejects an unknown keyword with no synonyms', () => {
    expect(expectRejected(parseIntentProgram('frobnicate x ;'))).toContain(
      'statement 1: unknown keyword "frobnicate" (canonical form has no synonyms)',
    );
  });

  it('rejects a statement missing its terminator', () => {
    expect(expectRejected(parseIntentProgram('use-dsl intent-v1'))).toContain(
      'statement 1: missing ";" terminator',
    );
  });

  it('rejects emit before use-dsl and verify of an un-emitted artifact', () => {
    const errors = expectRejected(
      parseIntentProgram('verify plan ; emit plan "no dialect declared" ;'),
    );
    expect(errors).toEqual([
      'statement 1: verify targets "plan" which was never emitted',
      'statement 2: emit before use-dsl (dialect must be declared first)',
    ]);
  });
});

describe('toLarkGrammar', () => {
  it('emits a Lark grammar with the canonical rules and terminals', () => {
    const grammar = toLarkGrammar();
    const lines = grammar.split('\n');

    expect(lines[0]).toBe('start: statement+');
    expect(grammar).toContain('statement: discover_harness | use_dsl | emit | verify');
    expect(grammar).toContain('emit: "emit" WORD STRING ";"');
    expect(grammar).toContain('WORD: /[a-z][a-z0-9-]*/');
    expect(grammar).toContain('STRING: /"[^"]*"/');
    expect(grammar).toContain('%ignore /[ \\t\\n]+/');
  });
});
