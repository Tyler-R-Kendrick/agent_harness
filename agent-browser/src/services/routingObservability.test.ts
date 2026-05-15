import { describe, expect, it } from 'vitest';
import {
  buildRoutingDecisionRecord,
  exportRoutingDecisionRecordsForEval,
  persistRoutingDecisionRecord,
  loadRoutingDecisionRecords,
} from './routingObservability';

describe('routingObservability', () => {
  it('persists and exports routing decision records', () => {
    window.localStorage.clear();
    const record = buildRoutingDecisionRecord({
      requestId: 'req-1',
      requestText: 'Security review this auth flow and permission policy for secrets.',
      selectedProvider: 'ghcp',
      selectedModel: 'gpt-5',
      benchmarkEvidenceSource: 'benchmark-fixture',
      routingDecision: { reasonCode: 'router-selected', confidence: 0.8, tier: 'premium', selectedBy: 'router' },
      skillRouteTrace: {
        selectedSkill: 'security-review',
        topAlternatives: [
          { skill: 'general-debug', score: 0.61, reasonCode: 'lower-security-coverage' },
          { skill: 'planner', score: 0.42, reasonCode: 'planning-focused' },
        ],
        reasonCodes: ['security-keyword-match', 'high-risk-domain'],
      },
    });

    persistRoutingDecisionRecord(record);
    const saved = loadRoutingDecisionRecords();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.taskClass).toBe('security');
    expect(saved[0]?.complexityReasons.length).toBeGreaterThan(0);
    expect(saved[0]?.candidateSetSummary).toBe('candidate-set-unavailable');
    expect(saved[0]?.routingMode).toBe('active');

    const exported = exportRoutingDecisionRecordsForEval(saved);
    expect(exported).toContain('routing-regression-record');
    expect(exported).toContain('benchmark-fixture');
    expect(exported).toContain('candidate_set_summary');
    expect(exported).toContain('routing_mode');
    expect(exported).toContain('security-review');
  });
});
