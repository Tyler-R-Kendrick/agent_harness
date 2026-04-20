import { describe, expect, it } from 'vitest';

import { createAgentScaffold, normalizeAgentName } from './scaffold-agent';

describe('normalizeAgentName', () => {
  it('normalizes role names to lowercase kebab-case', () => {
    expect(normalizeAgentName('Docs Reviewer')).toBe('docs-reviewer');
  });
});

describe('createAgentScaffold', () => {
  it('builds the canonical output path and reserve path', () => {
    expect(createAgentScaffold('Docs Reviewer')).toMatchObject({
      agentName: 'docs-reviewer',
      outputPath: '.agents/docs-reviewer/AGENTS.md',
      reservedEvalsPath: '.agents/docs-reviewer/.evals/',
    });
  });

  it('generates a scaffold with the expected headings', () => {
    expect(createAgentScaffold('Release Manager').content).toContain('## Purpose');
    expect(createAgentScaffold('Release Manager').content).toContain('## Deliverables');
  });
});