import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlguidanceSession, initLlguidanceWasm } from '../index.js';
import { loadTokenizer } from '../tokenizer.js';

const tokenizerJson = JSON.stringify({
  model: {
    vocab: {
      '{"answer":"': 0,
      yes: 1,
      no: 2,
      '"}': 3,
      red: 4,
      green: 5,
      blue: 6,
      x: 7,
      a: 8,
      b: 9,
      ' ': 10
    }
  },
  added_tokens: [{ id: 11, content: '<eos>' }],
  eos_token: '<eos>'
});

describe('LlguidanceSession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires initialization and preserves tokenizer ids from local tokenizer json', async () => {
    expect(() => new LlguidanceSession(tokenizerJson)).toThrow(/initLlguidanceWasm/i);

    await initLlguidanceWasm();
    await initLlguidanceWasm();

    const session = new LlguidanceSession(tokenizerJson, { eosTokenIds: [11], bosTokenId: 0, unkTokenId: 7 });

    expect(session.vocabSize()).toBe(12);
    expect(session.tokenText(11)).toBe('<eos>');
    expect(() => new LlguidanceSession('{bad json')).toThrow(/tokenizer json/i);
  });

  it('drives a json schema matcher with allowed-token masks, commits, and fast-forward tokens', async () => {
    await initLlguidanceWasm();
    const session = new LlguidanceSession(tokenizerJson, { eosTokenIds: [11] });
    const matcher = session.createMatcher({
      kind: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          answer: { enum: ['yes', 'no'] }
        },
        required: ['answer'],
        additionalProperties: false
      }
    });

    expect([...session.computeMask(matcher)]).toEqual([0]);
    expect(session.commitToken(matcher, 0)).toEqual({
      stopped: false,
      stopReason: null,
      ffTokens: [],
      temperature: undefined
    });
    expect([...session.computeMask(matcher)]).toEqual([1, 2]);

    const commit = session.commitToken(matcher, 1);

    expect(commit).toEqual({ stopped: false, stopReason: null, ffTokens: [3], temperature: undefined });
    expect([...session.computeFfTokens(matcher)]).toEqual([3]);
    expect(session.commitTokens(matcher, new Uint32Array(commit.ffTokens ?? []))).toEqual({
      stopped: true,
      stopReason: 'matched',
      ffTokens: [],
      temperature: undefined
    });
    expect(session.isStopped(matcher)).toBe(true);
    expect(session.stopReason(matcher)).toBe('matched');
    expect([...session.computeMask(matcher)]).toEqual([]);
  });

  it('keeps matcher handles isolated and supports reset and free', async () => {
    await initLlguidanceWasm();
    const session = new LlguidanceSession(tokenizerJson);
    const regexMatcher = session.createMatcher({ kind: 'regex', regex: '^(red|green)$' });
    const larkMatcher = session.createMatcher({ kind: 'lark', grammar: 'start: "blue"' });

    expect(regexMatcher).not.toBe(larkMatcher);
    expect([...session.computeMask(regexMatcher)]).toEqual([4, 5]);
    expect([...session.computeMask(larkMatcher)]).toEqual([6, 9]);

    session.commitToken(regexMatcher, 4);
    expect(session.isStopped(regexMatcher)).toBe(true);

    session.resetMatcher(regexMatcher);
    expect(session.isStopped(regexMatcher)).toBe(false);
    expect([...session.computeMask(regexMatcher)]).toEqual([4, 5]);

    session.freeMatcher(larkMatcher);
    expect(() => session.computeMask(larkMatcher)).toThrow(/unknown matcher id/i);
  });

  it('accepts serialized guidance-style literal choices and rejects invalid commits', async () => {
    await initLlguidanceWasm();
    const session = new LlguidanceSession(tokenizerJson);
    const matcher = session.createMatcher({
      kind: 'serialized',
      grammar: {
        grammars: [{ name: 'select', string_literals: ['red', 'green'] }]
      }
    });

    expect([...session.computeMask(matcher)]).toEqual([4, 5]);
    expect(() => session.commitToken(matcher, 6)).toThrow(/not allowed/i);
    expect(() => session.createMatcher({ kind: 'serialized', grammar: { grammars: [] } })).toThrow(/no finite candidates/i);
    expect(() => session.createMatcher({ kind: 'regex', regex: '[' })).toThrow(/unsupported regex/i);
  });

  it('derives finite candidates from every supported grammar fallback', async () => {
    await initLlguidanceWasm();
    const session = new LlguidanceSession(tokenizerJson);

    const constMatcher = session.createMatcher({ kind: 'json_schema', schema: { const: 'blue' } });
    const explicitMatcher = session.createMatcher({ kind: 'serialized', grammar: { candidates: ['red', 123, 'green'] } });
    const larkGrammarMatcher = session.createMatcher({ kind: 'serialized', grammar: { lark_grammar: 'start: "blue"' } });
    const jsonSchemaMatcher = session.createMatcher({
      kind: 'serialized',
      grammar: {
        json_schema: {
          type: 'object',
          properties: { answer: { const: 'no' } }
        }
      }
    });
    const recursiveMatcher = session.createMatcher({
      kind: 'serialized',
      grammar: {
        nested: ['red', { choice: 'green' }, 7, '']
      }
    });

    expect([...session.computeMask(constMatcher)]).toEqual([6, 9]);
    expect([...session.computeMask(explicitMatcher)]).toEqual([4, 5]);
    expect([...session.computeMask(larkGrammarMatcher)]).toEqual([6, 9]);
    expect([...session.computeMask(jsonSchemaMatcher)]).toEqual([0]);
    expect([...session.computeMask(recursiveMatcher)]).toEqual([4, 5]);
  });

  it('rejects grammar and tokenizer inputs that cannot produce matchers', async () => {
    await initLlguidanceWasm();

    expect(() => new LlguidanceSession('null')).toThrow(/root value must be an object/i);
    expect(() => new LlguidanceSession(JSON.stringify({ model: { vocab: { bad: -1 } } }))).toThrow(/no model\.vocab/i);

    const onlyAddedToken = new LlguidanceSession(JSON.stringify({
      added_tokens: [
        { id: 4, content: '<eos>' },
        { id: 'bad', content: 'ignored' },
        { id: 5, content: 42 }
      ],
      eos_token: { content: '<eos>' }
    }));
    const missingStringEos = new LlguidanceSession(JSON.stringify({
      model: { vocab: { red: 0 } },
      eos_token: '<missing>'
    }));
    const missingObjectEos = new LlguidanceSession(JSON.stringify({
      model: { vocab: { red: 0 } },
      eos_token: { content: '<missing>' }
    }));

    expect(onlyAddedToken.vocabSize()).toBe(5);
    expect(onlyAddedToken.tokenText(4)).toBe('<eos>');
    expect(missingStringEos.vocabSize()).toBe(1);
    expect(missingObjectEos.vocabSize()).toBe(1);
    expect(() => onlyAddedToken.createMatcher({ kind: 'json_schema', schema: { type: 'object', properties: { a: { const: 'x' }, b: { const: 'y' } } } })).toThrow(/no finite candidates/i);
    expect(() => onlyAddedToken.createMatcher({ kind: 'json_schema', schema: { type: 'object' } })).toThrow(/no finite candidates/i);
    expect(() => onlyAddedToken.createMatcher({ kind: 'json_schema', schema: null })).toThrow(/no finite candidates/i);
    expect(() => onlyAddedToken.createMatcher({ kind: 'serialized', grammar: 42 })).toThrow(/no finite candidates/i);
    expect(() => onlyAddedToken.createMatcher({ kind: 'regex', regex: '|' })).toThrow(/no finite candidates/i);

    vi.spyOn(JSON, 'parse').mockImplementation(() => {
      throw 'plain parse failure';
    });
    expect(() => loadTokenizer('{}')).toThrow(/plain parse failure/i);
  });

  it('ignores commits after a matcher has already stopped and reports unknown token ids defensively', async () => {
    await initLlguidanceWasm();
    const session = new LlguidanceSession(tokenizerJson);
    const matcher = session.createMatcher({ kind: 'regex', regex: 'red' });

    expect(session.commitToken(matcher, 4)).toEqual({
      stopped: true,
      stopReason: 'matched',
      ffTokens: [],
      temperature: undefined
    });
    expect(session.commitToken(matcher, 4)).toEqual({
      stopped: true,
      stopReason: 'matched',
      ffTokens: [],
      temperature: undefined
    });

    const defensiveMatcher = session.createMatcher({ kind: 'regex', regex: 'red' });
    (session as unknown as { allowedTokenIds(matcher: unknown): number[] }).allowedTokenIds = () => [99];
    expect(() => session.commitToken(defensiveMatcher, 99)).toThrow(/unknown token id/i);
  });

  it('keeps multi-token commits open until a full candidate is matched', async () => {
    await initLlguidanceWasm();
    const session = new LlguidanceSession(tokenizerJson);
    const matcher = session.createMatcher({ kind: 'regex', regex: 'redgreen' });

    expect(session.commitTokens(matcher, new Uint32Array([4]))).toEqual({
      stopped: false,
      stopReason: null,
      ffTokens: [5],
      temperature: undefined
    });
  });

  it('skips fast-forward tokens when the remaining suffix is not tokenized', async () => {
    await initLlguidanceWasm();
    const session = new LlguidanceSession(tokenizerJson);
    const matcher = session.createMatcher({ kind: 'regex', regex: 'ay' });

    expect(session.commitToken(matcher, 8)).toEqual({
      stopped: false,
      stopReason: null,
      ffTokens: [],
      temperature: undefined
    });
  });
});
