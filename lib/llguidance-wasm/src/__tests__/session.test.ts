import { describe, expect, it } from 'vitest';
import { LlguidanceSession, initLlguidanceWasm } from '../index.js';

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
});
