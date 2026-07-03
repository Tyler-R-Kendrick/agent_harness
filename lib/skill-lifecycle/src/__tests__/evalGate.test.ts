import { describe, expect, it } from 'vitest';
import {
  applySkillEdit,
  createSkillPromotionGate,
  isBoundedEdit,
  optimizeSkillDoc,
  proposeSkillEdit,
  SKILL_EDIT_CANDIDATE_BODIES,
} from '../evalGate';
import { SeededLcg } from '../rng';
import type { RejectedEdit, SkillDoc, SkillEditProposal } from '../types';

const DOC: SkillDoc = { sections: ['Trigger: review a diff.', 'Procedure: read and summarize.'] };

function proposal(overrides: Partial<SkillEditProposal> = {}): SkillEditProposal {
  return { key: 'k', kind: 'replace', sectionIndex: 0, body: 'a bounded body', ...overrides };
}

describe('proposeSkillEdit', () => {
  it('returns a fresh, bounded proposal with skipped=0 when memory is empty', () => {
    const rng = new SeededLcg(26052390);
    const { proposal: p, skipped } = proposeSkillEdit(DOC, rng, []);
    expect(skipped).toBe(0);
    expect(['replace', 'append']).toContain(p.kind);
    expect(SKILL_EDIT_CANDIDATE_BODIES).toContain(p.body);
    expect(p.key).toBe(`${p.kind}:${p.sectionIndex}:${p.body.slice(0, 24)}`);
  });

  it('samples both replace and append kinds across draws', () => {
    const rng = new SeededLcg(7);
    const kinds = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      kinds.add(proposeSkillEdit(DOC, rng, []).proposal.kind);
    }
    expect(kinds.has('replace')).toBe(true);
    expect(kinds.has('append')).toBe(true);
  });

  it('skips proposals already in rejected-edit memory (skipped counter)', () => {
    const firstKey = proposeSkillEdit(DOC, new SeededLcg(999), []).proposal.key;
    const rejected: RejectedEdit[] = [{ key: firstKey, reason: 'no-improvement' }];
    const { proposal: p, skipped } = proposeSkillEdit(DOC, new SeededLcg(999), rejected);
    expect(skipped).toBeGreaterThanOrEqual(1);
    expect(p.key).not.toBe(firstKey);
  });

  it('throws when every possible proposal is exhausted by rejected-edit memory', () => {
    const oneSection: SkillDoc = { sections: ['only section'] };
    // For a 1-section doc every sampled key is one of these 12: replace targets
    // index 0, append targets index 1, across all candidate bodies.
    const rejected: RejectedEdit[] = [];
    for (const body of SKILL_EDIT_CANDIDATE_BODIES) {
      rejected.push({ key: `replace:0:${body.slice(0, 24)}`, reason: 'x' });
      rejected.push({ key: `append:1:${body.slice(0, 24)}`, reason: 'x' });
    }
    expect(() => proposeSkillEdit(oneSection, new SeededLcg(3), rejected)).toThrow(
      /exhausted 1000 attempts/,
    );
  });
});

describe('applySkillEdit', () => {
  it('replaces the targeted section and leaves the others intact', () => {
    const doc: SkillDoc = { sections: ['a', 'b', 'c'] };
    const next = applySkillEdit(doc, proposal({ kind: 'replace', sectionIndex: 1, body: 'B' }));
    expect(next.sections).toEqual(['a', 'B', 'c']);
  });

  it('appends a new section', () => {
    const doc: SkillDoc = { sections: ['a'] };
    const next = applySkillEdit(doc, proposal({ kind: 'append', sectionIndex: 1, body: 'X' }));
    expect(next.sections).toEqual(['a', 'X']);
  });
});

describe('isBoundedEdit', () => {
  it('rejects an empty body', () => {
    expect(isBoundedEdit(DOC, proposal({ body: '' }), 240)).toBe(false);
  });

  it('rejects a body longer than maxSectionChars', () => {
    expect(isBoundedEdit(DOC, proposal({ body: 'x'.repeat(50) }), 10)).toBe(false);
  });

  it('rejects a replace with a negative section index', () => {
    expect(isBoundedEdit(DOC, proposal({ kind: 'replace', sectionIndex: -1 }), 240)).toBe(false);
  });

  it('rejects a replace targeting a section index beyond the document', () => {
    expect(isBoundedEdit(DOC, proposal({ kind: 'replace', sectionIndex: 99 }), 240)).toBe(false);
  });

  it('accepts a valid replace', () => {
    expect(isBoundedEdit(DOC, proposal({ kind: 'replace', sectionIndex: 1 }), 240)).toBe(true);
  });

  it('accepts an append regardless of section index bounds', () => {
    expect(isBoundedEdit(DOC, proposal({ kind: 'append', sectionIndex: 99 }), 240)).toBe(true);
  });
});

describe('optimizeSkillDoc', () => {
  it('accepts score-improving edits and records rejected ones in memory', () => {
    const seed: SkillDoc = { sections: ['seed section'] };
    // Score = section count: appends improve the score (accept), replaces keep
    // it flat (reject with a "no-improvement" memory entry).
    const validate = (doc: SkillDoc): number => doc.sections.length;
    const result = optimizeSkillDoc(seed, validate, { iterations: 12, seed: 26052390, maxSectionChars: 240 });

    expect(result.accepted).toBeGreaterThan(0);
    expect(result.log).toHaveLength(12);
    expect(result.log.some((row) => row.accepted)).toBe(true);
    expect(result.log.some((row) => !row.accepted)).toBe(true);
    expect(result.bestDoc.sections.length).toBe(seed.sections.length + result.accepted);
    expect(result.rejected.some((edit) => edit.reason === 'no-improvement')).toBe(true);
  });

  it('rejects out-of-bounds edits (validator never called on the candidate)', () => {
    const seed: SkillDoc = { sections: ['seed section'] };
    const validate = (doc: SkillDoc): number => doc.sections.length;
    // maxSectionChars=1 forces every candidate body out of bounds.
    const result = optimizeSkillDoc(seed, validate, { iterations: 4, seed: 5, maxSectionChars: 1 });

    expect(result.accepted).toBe(0);
    expect(result.bestDoc).toEqual(seed);
    expect(result.rejected).toHaveLength(4);
    expect(result.rejected.every((edit) => edit.reason === 'out-of-bounds')).toBe(true);
    expect(result.log.every((row) => !row.accepted)).toBe(true);
    // Out-of-bounds candidate score is the sentinel bestScore - 1.
    expect(result.log[0].candidateScore).toBe(seed.sections.length - 1);
  });
});

describe('createSkillPromotionGate', () => {
  it('allows promotion when the validator meets the threshold', () => {
    const gate = createSkillPromotionGate(() => 5, 3);
    expect(gate(DOC)).toEqual({ allowed: true });
  });

  it('denies promotion with a reason when the validator is below the threshold', () => {
    const gate = createSkillPromotionGate(() => 1, 3);
    const result = gate(DOC);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain('below promotion threshold');
    }
  });
});
