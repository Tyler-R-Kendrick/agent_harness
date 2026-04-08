import { describe, expect, it } from 'vitest';
import {
  buildWorkspacePromptContext,
  createWorkspaceFileTemplate,
  detectWorkspaceFileKind,
  discoverWorkspaceCapabilities,
  removeWorkspaceFile,
  upsertWorkspaceFile,
  validateWorkspaceFile,
} from './workspaceFiles';
import type { WorkspaceFile } from '../types';

describe('workspaceFiles', () => {
  it('creates standard templates for AGENTS, skills, hooks, and plugins', () => {
    const agents = createWorkspaceFileTemplate('agents');
    const skill = createWorkspaceFileTemplate('skill', 'Review PR');
    const hook = createWorkspaceFileTemplate('hook', 'pre-task');
    const plugin = createWorkspaceFileTemplate('plugin', 'review-tools');

    expect(agents.path).toBe('AGENTS.md');
    expect(skill.path).toBe('.agents/skill/review-pr/SKILL.md');
    expect(hook.path).toBe('.agents/hooks/pre-task.sh');
    expect(plugin.path).toBe('.agents/plugins/review-tools/plugin.yaml');
  });

  it('discovers AGENTS instructions, skills, hooks, and plugins from workspace files', () => {
    const files: WorkspaceFile[] = [
      { path: 'AGENTS.md', content: '# Rules\nAlways lint before shipping.', updatedAt: '2026-04-08T00:00:00.000Z' },
      {
        path: '.agents/skill/review-pr/SKILL.md',
        content: '---\nname: review-pr\ndescription: Review pull requests before requesting approval.\n---\n\n# Review PR',
        updatedAt: '2026-04-08T00:00:00.000Z',
      },
      { path: '.agents/hooks/pre-task.sh', content: '#!/usr/bin/env bash\necho pre-task', updatedAt: '2026-04-08T00:00:00.000Z' },
      { path: '.agents/plugins/review-tools/plugin.yaml', content: 'name: review-tools', updatedAt: '2026-04-08T00:00:00.000Z' },
    ];

    const capabilities = discoverWorkspaceCapabilities(files);
    const promptContext = buildWorkspacePromptContext(files);

    expect(capabilities.agents).toHaveLength(1);
    expect(capabilities.skills).toEqual([
      expect.objectContaining({
        name: 'review-pr',
        description: 'Review pull requests before requesting approval.',
      }),
    ]);
    expect(capabilities.hooks).toEqual([
      expect.objectContaining({ name: 'pre-task.sh' }),
    ]);
    expect(capabilities.plugins).toEqual([
      expect.objectContaining({ directory: 'review-tools', manifestName: 'plugin.yaml' }),
    ]);
    expect(promptContext).toContain('Always lint before shipping.');
    expect(promptContext).toContain('review-pr (.agents/skill/review-pr/SKILL.md)');
    expect(promptContext).toContain('review-tools (.agents/plugins/review-tools/plugin.yaml)');
    expect(promptContext).toContain('pre-task.sh (.agents/hooks/pre-task.sh)');
  });

  it('validates file paths and supports both .agents/skill and .agents/skills roots', () => {
    expect(detectWorkspaceFileKind('.agents/skill/review-pr/SKILL.md')).toBe('skill');
    expect(detectWorkspaceFileKind('.agents/skills/review-pr/SKILL.md')).toBe('skill');
    expect(validateWorkspaceFile({ path: '.agents/skills/review-pr/SKILL.md', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toBeNull();
    expect(validateWorkspaceFile({ path: '.agents/skill/Review PR/SKILL.md', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toContain('kebab-case');
    expect(validateWorkspaceFile({ path: 'README.md', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toContain('Unsupported');
  });

  it('upserts and removes workspace files by path', () => {
    const first = createWorkspaceFileTemplate('agents');
    const second = { ...first, content: '# Updated', updatedAt: '2026-04-08T01:00:00.000Z' };

    const upserted = upsertWorkspaceFile([], first);
    const replaced = upsertWorkspaceFile(upserted, second);

    expect(replaced).toEqual([second]);
    expect(removeWorkspaceFile(replaced, second.path)).toEqual([]);
  });
});
