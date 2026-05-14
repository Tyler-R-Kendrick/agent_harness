import { describe, expect, it, vi } from 'vitest';
import { createHarnessExtensionContext } from 'harness-core';

import {
  createAgentSkillRegistry,
  createAgentSkillsPlugin,
  detectAgentSkillFile,
  discoverAgentSkills,
  executeCompositeSkill,
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

  it('executes composite skills through the shared registry with scope, budget, and telemetry', async () => {
    const skills = discoverAgentSkills([
      { path: '.agents/skills/collect-sources/SKILL.md', content: '---\nname: collect-sources\ndescription: Collect.\n---' },
      { path: '.agents/skills/summarize-evidence/SKILL.md', content: '---\nname: summarize-evidence\ndescription: Summarize.\n---' },
    ]);
    const registry = createAgentSkillRegistry(skills);
    const scopes = new Map();
    const client = {
      executeSkill: vi.fn(async ({ skill, input }) => `${skill.name}:${input}`),
    };

    const scope = await executeCompositeSkill({
      name: 'research-report',
      steps: [
        { stageName: 'collect', skillName: 'collect-sources', input: 'topic' },
        { stageName: 'summarize', skillName: 'summarize-evidence', input: 'notes' },
      ],
    }, {
      skill: skills[0],
      input: 'ignored',
      args: { parentTaskId: 'task-1', stepBudget: 2 },
    }, registry, client, scopes);

    expect(scope.outputByStage).toEqual({
      collect: 'collect-sources:topic',
      summarize: 'summarize-evidence:notes',
    });
    expect(scope.parentTaskId).toBe('task-1');
    expect(scope.stepsUsed).toBe(2);
    expect(scope.telemetry).toEqual([
      expect.objectContaining({ stageName: 'research-report', stageType: 'parent', depth: 0, success: true }),
      expect.objectContaining({ stageName: 'collect', stageType: 'child', depth: 1, success: true, childSkillName: 'collect-sources' }),
      expect.objectContaining({ stageName: 'summarize', stageType: 'child', depth: 2, success: true, childSkillName: 'summarize-evidence' }),
    ]);

    await expect(executeCompositeSkill({
      name: 'research-report',
      steps: [{ stageName: 'collect', skillName: 'collect-sources', input: 'topic' }],
    }, {
      skill: skills[0],
      input: 'ignored',
      args: { parentTaskId: 'task-2', stepBudget: 0 },
    }, registry, client, new Map())).resolves.toBeDefined();

    await expect(executeCompositeSkill({
      name: 'research-report',
      steps: [
        { stageName: 'collect', skillName: 'collect-sources', input: 'topic' },
        { stageName: 'summarize', skillName: 'summarize-evidence', input: 'notes' },
      ],
    }, {
      skill: skills[0],
      input: 'ignored',
      args: { parentTaskId: 'task-3', stepBudget: 1 },
    }, registry, client, new Map())).rejects.toThrow(/Step budget exceeded/i);

    await expect(executeCompositeSkill({
      name: 'research-report',
      steps: [{ stageName: 'missing', skillName: 'missing-skill', input: 'x' }],
    }, {
      skill: skills[0],
      input: 'ignored',
      args: { parentTaskId: 'task-4', stepBudget: 2 },
    }, registry, client, new Map())).rejects.toThrow(/Unknown child skill/i);

    const defaultScope = await executeCompositeSkill({
      name: 'research-report',
      steps: [{ stageName: 'collect', skillName: 'collect-sources', input: 'topic' }],
    }, {
      skill: skills[0],
      input: 'ignored',
      args: {},
    }, registry, client, new Map());
    expect(defaultScope.parentTaskId).toBe('task:unknown');

  });
});
