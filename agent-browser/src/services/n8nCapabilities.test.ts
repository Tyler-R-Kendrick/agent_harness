import { describe, expect, it } from 'vitest';
import {
  buildN8nCapabilitySummary,
  buildServerlessWorkflowPreview,
  listN8nCapabilityAreas,
} from './n8nCapabilities';

describe('n8nCapabilities', () => {
  it('enumerates the researched n8n capability areas for offline Agent Browser parity', () => {
    const areas = listN8nCapabilityAreas();

    expect(areas.map((area) => area.id)).toEqual([
      'workflow-canvas',
      'node-library',
      'executions-debugging',
      'credentials-governance',
      'templates-environments',
      'ai-rag-evaluations',
    ]);
    expect(areas.every((area) => area.n8nFeatures.length > 0)).toBe(true);
    expect(areas.every((area) => area.offlinePwaPlan.length > 0)).toBe(true);
    expect(areas.every((area) => area.serverlessWorkflowMapping.length > 0)).toBe(true);
  });

  it('summarizes readiness without requiring network or backend state', () => {
    const summary = buildN8nCapabilitySummary();

    expect(summary.totalAreas).toBe(6);
    expect(summary.foundationAreas).toBeGreaterThanOrEqual(1);
    expect(summary.readyAreas).toBeGreaterThanOrEqual(1);
    expect(summary.serializationStandard).toBe('CNCF Serverless Workflow 1.0.3');
  });

  it('builds a CNCF Serverless Workflow starter preview with trigger, action, and review coverage', () => {
    const preview = buildServerlessWorkflowPreview();

    expect(preview.document.document).toMatchObject({
      dsl: '1.0.3',
      namespace: 'agent-browser.offline-automation',
      name: 'local-dev-workflow',
      version: '0.1.0',
    });
    expect(preview.coverage).toEqual(['trigger', 'action', 'error-review']);
    expect(JSON.stringify(preview.document.do)).toContain('manualTrigger');
    expect(JSON.stringify(preview.document.do)).toContain('runLocalAction');
    expect(JSON.stringify(preview.document.do)).toContain('queueReview');
  });
});
