import { describe, expect, it } from 'vitest';

import { createAgentSkillScaffold, normalizeSkillName } from './scaffold-agent-skill';

describe('normalizeSkillName', () => {
  it('normalizes skill names to lowercase kebab-case', () => {
    expect(normalizeSkillName('Release Notes')).toBe('release-notes');
  });
});

describe('createAgentSkillScaffold', () => {
  it('uses the canonical .agents/skills path', () => {
    expect(createAgentSkillScaffold('Release Notes').outputPath).toBe('.agents/skills/release-notes/SKILL.md');
  });

  it('returns the optional directory hints', () => {
    expect(createAgentSkillScaffold('Release Notes').directories).toEqual(['references/', 'scripts/', 'assets/']);
  });
});