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
    });

    persistRoutingDecisionRecord(record);
    const saved = loadRoutingDecisionRecords();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.taskClass).toBe('security');

    const exported = exportRoutingDecisionRecordsForEval(saved);
    expect(exported).toContain('routing-regression-record');
    expect(exported).toContain('benchmark-fixture');
  });
});
