import { describe, expect, it } from 'vitest';
import {
  buildCitationListGrammar,
  buildDeciderDecisionGrammar,
  buildMemoryToonRecordGrammar,
  buildRawMarkdownGrammar,
  buildVoterDecisionGrammar,
  constrainedDecodingForGuidanceProfile,
  getGuidanceProfile,
  getGuidanceProfiles,
} from '../grammars.js';
import { toGuidanceTsGrammar } from '../constrainedDecoding.js';

function nodes(grammar: { serialize: () => unknown }) {
  return (grammar.serialize() as { grammars: Array<{ nodes: unknown[] }> }).grammars[0].nodes;
}

describe('guidance-ts grammars', () => {
  it('exposes small real guidance-ts grammars for voter, decider, citations, markdown, and TOON memory', () => {
    expect(getGuidanceProfiles().map((profile) => profile.id)).toEqual([
      'voter-decision',
      'decider-decision',
      'citation-list',
      'raw-markdown',
      'memory-toon-record',
    ]);

    expect(nodes(buildVoterDecisionGrammar())).toEqual(expect.arrayContaining([
      expect.objectContaining({ Select: expect.any(Object) }),
      expect.objectContaining({ Gen: expect.any(Object) }),
    ]));
    expect(buildVoterDecisionGrammar().maxTokens).toBe(32);
    expect(buildDeciderDecisionGrammar().maxTokens).toBe(24);
    expect(nodes(buildCitationListGrammar())).toEqual(expect.arrayContaining([
      expect.objectContaining({ Select: expect.any(Object) }),
    ]));
    expect(nodes(buildRawMarkdownGrammar())).toEqual(expect.arrayContaining([
      expect.objectContaining({ Gen: expect.any(Object) }),
    ]));
    expect(nodes(buildMemoryToonRecordGrammar())).toEqual(expect.arrayContaining([
      expect.objectContaining({ String: expect.objectContaining({ literal: expect.stringContaining('tags[3]:') }) }),
    ]));
  });

  it('maps profile metadata to constrained decoding without a monolithic llguidance helper', () => {
    const voter = constrainedDecodingForGuidanceProfile('voter-decision');
    const memory = constrainedDecodingForGuidanceProfile('memory-toon-record');

    expect(voter).toEqual(expect.objectContaining({
      kind: 'json_schema',
      maxTokens: 32,
      schema: expect.objectContaining({
        properties: expect.objectContaining({ verdict: { enum: ['APPROVE', 'REJECT'] } }),
      }),
    }));
    expect(memory).toEqual(expect.objectContaining({ kind: 'toon', maxTokens: 96 }));
    expect(toGuidanceTsGrammar(voter).serialize()).toEqual(getGuidanceProfile('voter-decision').grammar.serialize());
    expect(() => getGuidanceProfile('unknown' as never)).toThrow('Unknown guidance profile: unknown');
  });
});
