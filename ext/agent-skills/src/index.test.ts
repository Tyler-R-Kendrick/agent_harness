import { describe, expect, it, vi } from 'vitest';
import { createHarnessExtensionContext } from 'harness-core';

import {
  createAgentSkillsPlugin,
  detectAgentSkillFile,
  discoverAgentSkills,
  validateAgentSkillFile,
} from './index.js';

describe('agent-skills extension plugin', () => {
  it('discovers selected SKILL.md files and registers tools plus command execution', async () => {
    const context = createHarnessExtensionContext();
    const executeSkill = vi.fn(async ({ skill, input }) => ({
      skill: skill.name,
      input,
    }));

    await context.plugins.load(createAgentSkillsPlugin([
      {
        path: '.agents/skills/review-pr/SKILL.md',
        content: '---\nname: review-pr\ndescription: Review a pull request.\n---\n\n# Review\nUse tests.',
      },
    ], {
      client: { executeSkill },
    }));

    expect(detectAgentSkillFile('.agents/skill/review-pr/SKILL.md')).toBe(true);
    expect(detectAgentSkillFile('.agents/skills/review-pr/README.md')).toBe(false);
    expect(validateAgentSkillFile({ path: '.agents/skills/review-pr/SKILL.md', content: '' })).toBeNull();
    expect(validateAgentSkillFile({ path: '.agents/skills/Review PR/SKILL.md', content: '' })).toContain('kebab-case');
    expect(validateAgentSkillFile({ path: '.agents/skills/review-pr/nested/SKILL.md', content: '' })).toContain('<dir>/SKILL.md');
    expect(validateAgentSkillFile({ path: 'README.md', content: '' })).toContain('agent skill');
    expect(discoverAgentSkills([
      { path: '.agents/skills/missing-frontmatter/SKILL.md', content: '# Missing' },
    ])[0]).toEqual(expect.objectContaining({
      directory: 'missing-frontmatter',
      name: 'missing-frontmatter',
      description: 'Skill file is missing required frontmatter.',
    }));
    expect(discoverAgentSkills([
      { path: '.agents/skills/no-description/SKILL.md', content: '---\nname: no-description\n---\n\n# Missing' },
    ])[0]).toEqual(expect.objectContaining({
      name: 'no-description',
      description: 'Skill file is missing required frontmatter.',
    }));
    expect(context.tools.get('agent-skill:review-pr')).toEqual(expect.objectContaining({
      id: 'agent-skill:review-pr',
      description: 'Review a pull request.',
    }));
    await expect(context.tools.execute('agent-skill:review-pr', { input: 'src/index.ts' })).resolves.toEqual({
      skill: 'review-pr',
      input: 'src/index.ts',
    });
    await expect(context.tools.execute('agent-skill:review-pr', {})).resolves.toEqual({
      skill: 'review-pr',
      input: '',
    });
    await expect(context.tools.execute('agent-skill:review-pr', 'loose input')).resolves.toEqual({
      skill: 'review-pr',
      input: '',
    });
    await expect(context.commands.execute('/skill review-pr src/index.ts')).resolves.toEqual({
      matched: true,
      commandId: 'agent-skills',
      result: {
        skill: 'review-pr',
        input: 'src/index.ts',
      },
    });
    await expect(context.commands.execute('/skill review-pr')).resolves.toEqual({
      matched: true,
      commandId: 'agent-skills',
      result: {
        skill: 'review-pr',
        input: '',
      },
    });
    await expect(context.commands.execute('/skill missing')).rejects.toThrow(/Unknown agent skill/i);
    expect(executeSkill).toHaveBeenCalledWith(expect.objectContaining({
      skill: expect.objectContaining({ name: 'review-pr' }),
      input: 'src/index.ts',
    }));
  });
});
