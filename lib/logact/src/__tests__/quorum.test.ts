import { describe, it, expect } from 'vitest';
import { evaluateQuorum } from '../quorum.js';
import { QuorumPolicy } from '../types.js';
import type { VotePayload } from '../types.js';
import { PayloadType } from '../types.js';

function makeVote(voterId: string, approve: boolean): VotePayload {
  return {
    type: PayloadType.Vote,
    intentId: 'i1',
    voterId,
    approve,
  };
}

describe('evaluateQuorum – OnByDefault', () => {
  it('commits immediately with no voters', () => {
    expect(evaluateQuorum([], 0, QuorumPolicy.OnByDefault)).toBe('commit');
  });

  it('commits immediately even when votes present', () => {
    expect(evaluateQuorum([makeVote('v1', false)], 1, QuorumPolicy.OnByDefault)).toBe('commit');
  });
});

describe('evaluateQuorum – FirstVoter', () => {
  it('returns pending when no votes', () => {
    expect(evaluateQuorum([], 1, QuorumPolicy.FirstVoter)).toBe('pending');
  });

  it('commits on first approval', () => {
    expect(evaluateQuorum([makeVote('v1', true)], 1, QuorumPolicy.FirstVoter)).toBe('commit');
  });

  it('aborts on first rejection', () => {
    expect(evaluateQuorum([makeVote('v1', false)], 1, QuorumPolicy.FirstVoter)).toBe('abort');
  });
});

describe('evaluateQuorum – BooleanAnd', () => {
  it('returns pending with 0 votes out of 2 required', () => {
    expect(evaluateQuorum([], 2, QuorumPolicy.BooleanAnd)).toBe('pending');
  });

  it('aborts immediately on any rejection', () => {
    expect(evaluateQuorum([makeVote('v1', false)], 2, QuorumPolicy.BooleanAnd)).toBe('abort');
  });

  it('returns pending when not all votes are in', () => {
    expect(evaluateQuorum([makeVote('v1', true)], 2, QuorumPolicy.BooleanAnd)).toBe('pending');
  });

  it('commits when all voters approve', () => {
    const votes = [makeVote('v1', true), makeVote('v2', true)];
    expect(evaluateQuorum(votes, 2, QuorumPolicy.BooleanAnd)).toBe('commit');
  });
});

describe('evaluateQuorum – BooleanOr', () => {
  it('returns pending with 0 votes out of 2', () => {
    expect(evaluateQuorum([], 2, QuorumPolicy.BooleanOr)).toBe('pending');
  });

  it('commits on any approval', () => {
    expect(evaluateQuorum([makeVote('v1', true)], 2, QuorumPolicy.BooleanOr)).toBe('commit');
  });

  it('returns pending when some reject but not all', () => {
    expect(evaluateQuorum([makeVote('v1', false)], 2, QuorumPolicy.BooleanOr)).toBe('pending');
  });

  it('aborts when all voters reject', () => {
    const votes = [makeVote('v1', false), makeVote('v2', false)];
    expect(evaluateQuorum(votes, 2, QuorumPolicy.BooleanOr)).toBe('abort');
  });
});
