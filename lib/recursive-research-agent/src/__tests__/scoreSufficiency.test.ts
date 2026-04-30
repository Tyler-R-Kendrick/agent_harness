import { describe, expect, it } from 'vitest';
import { scoreSufficiency } from '../decisions/scoreSufficiency';
import { makeEvidence, makeState, makeTask } from './helpers';

describe('scoreSufficiency', () => {
  it('increases with relevant evidence and unique source domains', () => {
    const sparse = makeState({ evidence: [makeEvidence({ quality: { relevance: 0.7, authority: 0.5, freshness: 0.5, informationGain: 0.5, overall: 0.6 } })] });
    const diverse = makeState({
      evidence: Array.from({ length: 6 }, (_, index) => makeEvidence({
        id: `e${index}`,
        url: `https://source${index}.example.com/path`,
        normalizedUrl: `https://source${index}.example.com/path`,
      })),
    });

    expect(scoreSufficiency(diverse).overall).toBeGreaterThan(scoreSufficiency(sparse).overall);
    expect(scoreSufficiency(diverse).sourceDiversity).toBe(1);
  });

  it('penalizes high-priority gaps, unresolved claims, and stale freshness-sensitive evidence', () => {
    const state = makeState({
      task: makeTask({ question: 'latest local search tools', successCriteria: ['current options'] }),
      evidence: [makeEvidence({ text: 'Old search tool comparison from 2019.', quality: { relevance: 0.9, authority: 0.8, freshness: 0.1, informationGain: 0.8, overall: 0.72 } })],
      claims: [{ id: 'claim-1', text: 'A claim', confidence: 0.4, supportingEvidenceIds: [], contradictingEvidenceIds: [], status: 'uncertain' }],
      gaps: [{ id: 'gap-1', description: 'Need current sources', priority: 0.9, suggestedQueries: ['latest local search tools 2026'], reason: 'freshness missing', status: 'open' }],
    });

    const score = scoreSufficiency(state);

    expect(score.freshnessCoverage).toBeLessThan(1);
    expect(score.contradictionResolution).toBeLessThan(1);
    expect(score.taskCompleteness).toBeLessThan(1);
  });
});
