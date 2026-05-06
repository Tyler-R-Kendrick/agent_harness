import { describe, expect, it } from 'vitest';

import { createAgentEvalScaffold } from './scaffold-agent-eval';

describe('createAgentEvalScaffold', () => {
  it('builds the canonical eval path', () => {
    expect(createAgentEvalScaffold('Docs Reviewer', 'Smoke Test').outputPath).toBe('.agents/docs-reviewer/.evals/smoke-test.yaml');
  });

  it('generates starter YAML with stable case ids', () => {
    expect(createAgentEvalScaffold('Docs Reviewer', 'Smoke Test').content).toContain('case-001');
    expect(createAgentEvalScaffold('Docs Reviewer', 'Smoke Test').content).toContain('assertions:');
  });
});