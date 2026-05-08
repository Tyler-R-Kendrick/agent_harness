import { describe, expect, it } from 'vitest';
import { LlguidanceLogitsMasker } from '../transformers.js';
import type { CommitResult } from '../types.js';

describe('LlguidanceLogitsMasker', () => {
  it('applies session masks and commits sampled plus fast-forward tokens', () => {
    const commits: number[][] = [];
    const session = {
      vocabSize: () => 4,
      computeMask: (matcherId: number) => {
        expect(matcherId).toBe(42);
        return new Uint32Array([2]);
      },
      computeFfTokens: () => new Uint32Array([3]),
      commitToken: (_matcherId: number, tokenId: number): CommitResult => {
        commits.push([tokenId]);
        return { stopped: false, stopReason: null, ffTokens: [3] };
      },
      commitTokens: (_matcherId: number, tokenIds: Uint32Array): CommitResult => {
        commits.push([...tokenIds]);
        return { stopped: true, stopReason: 'matched' };
      },
      isStopped: () => true
    };

    const masker = new LlguidanceLogitsMasker(session, 42);
    const logits = [1, 2, 3, 4];

    masker.apply(logits);
    masker.commit(2);

    expect(logits).toEqual([-Infinity, -Infinity, 3, -Infinity]);
    expect(commits).toEqual([[2], [3]]);
    expect(masker.stopped()).toBe(true);
  });

  it('uses an explicit vocabulary size and skips empty fast-forward tokens', () => {
    const commits: number[][] = [];
    const session = {
      vocabSize: () => 9,
      computeMask: () => new Uint32Array([1]),
      computeFfTokens: () => new Uint32Array([]),
      commitToken: (_matcherId: number, tokenId: number): CommitResult => {
        commits.push([tokenId]);
        return { stopped: false, ffTokens: [] };
      },
      commitTokens: (_matcherId: number, tokenIds: Uint32Array): CommitResult => {
        commits.push([...tokenIds]);
        return { stopped: false };
      },
      isStopped: () => false
    };

    const masker = new LlguidanceLogitsMasker(session, 7, 3);
    const logits = [0, 0, 0];

    masker.apply(logits);
    masker.commit(1);

    expect(logits).toEqual([-Infinity, 0, -Infinity]);
    expect(commits).toEqual([[1]]);
    expect(masker.stopped()).toBe(false);
  });
});
