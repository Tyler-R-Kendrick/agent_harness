import { describe, expect, it } from 'vitest';
import {
  buildWorkspacePromptContext,
  createDefaultWorkspaceFiles,
  createWorkspaceFileTemplate,
  detectWorkspaceFileKind,
  discoverWorkspaceCapabilities,
  loadWorkspaceFiles,
  removeWorkspaceFile,
  upsertWorkspaceFile,
  validateWorkspaceFile,
  WORKSPACE_FILES_STORAGE_KEY,
} from './workspaceFiles';
import type { WorkspaceFile } from '../types';

describe('workspaceFiles', () => {
  it('creates standard templates for AGENTS, skills, hooks, and plugins', () => {
    const agents = createWorkspaceFileTemplate('agents');
    const skill = createWorkspaceFileTemplate('skill', 'Review PR');
    const hook = createWorkspaceFileTemplate('hook', 'pre-task');
    const plugin = createWorkspaceFileTemplate('plugin', 'review-tools');

    expect(agents.path).toBe('AGENTS.md');
    expect(skill.path).toBe('.agents/skills/review-pr/SKILL.md');
    expect(hook.path).toBe('.agents/hooks/pre-task.sh');
    expect(plugin.path).toBe('.agents/plugins/review-tools/plugin.yaml');
  });

  it('creates default workspace memory files', () => {
    const files = createDefaultWorkspaceFiles('2026-04-20T00:00:00.000Z');

    expect(files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '.memory/MEMORY.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.memory/user.memory.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.memory/project.memory.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.memory/workspace.memory.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.memory/session.memory.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
    ]));
  });

  it('discovers AGENTS instructions, skills, hooks, and plugins from workspace files', () => {
    const files: WorkspaceFile[] = [
      { path: 'AGENTS.md', content: '# Rules\nAlways lint before shipping.', updatedAt: '2026-04-08T00:00:00.000Z' },
      { path: 'docs/AGENTS.md', content: '# Docs agent\nFocus on docs.', updatedAt: '2026-04-08T00:00:00.000Z' },
      {
        path: '.agents/skills/review-pr/SKILL.md',
        content: '---\nname: review-pr\ndescription: Review pull requests before requesting approval.\n---\n\n# Review PR',
        updatedAt: '2026-04-08T00:00:00.000Z',
      },
      { path: '.agents/hooks/pre-task.sh', content: '#!/usr/bin/env bash\necho pre-task', updatedAt: '2026-04-08T00:00:00.000Z' },
      { path: '.agents/plugins/review-tools/plugin.yaml', content: 'name: review-tools', updatedAt: '2026-04-08T00:00:00.000Z' },
      { path: '.memory/project.memory.md', content: '# Project Memory\n\n- Use Vitest for workspace service tests', updatedAt: '2026-04-08T00:00:00.000Z' },
    ];

    const capabilities = discoverWorkspaceCapabilities(files);
    const promptContext = buildWorkspacePromptContext(files);
    const focusedPromptContext = buildWorkspacePromptContext(files, 'docs/AGENTS.md');

    expect(capabilities.agents).toHaveLength(2);
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
    expect(capabilities.memory).toEqual([
      expect.objectContaining({ path: '.memory/project.memory.md' }),
    ]);
    expect(promptContext).toContain('Always lint before shipping.');
    expect(promptContext).toContain('Focus on docs.');
    expect(promptContext).toContain('review-pr (.agents/skills/review-pr/SKILL.md)');
    expect(promptContext).toContain('review-tools (.agents/plugins/review-tools/plugin.yaml)');
    expect(promptContext).toContain('pre-task.sh (.agents/hooks/pre-task.sh)');
    expect(promptContext).toContain('[project] Use Vitest for workspace service tests');
    expect(focusedPromptContext).toContain('Active AGENTS.md:');
    expect(focusedPromptContext).toContain('docs/AGENTS.md');
    expect(focusedPromptContext).toContain('Other AGENTS.md files:');
    expect(focusedPromptContext).toContain('AGENTS.md');
  });

  it('validates file paths and supports both .agents/skill and .agents/skills roots', () => {
    expect(detectWorkspaceFileKind('.agents/skill/review-pr/SKILL.md')).toBe('skill');
    expect(detectWorkspaceFileKind('.agents/skills/review-pr/SKILL.md')).toBe('skill');
    expect(detectWorkspaceFileKind('.agents/hooks/pre-task.sh')).toBe('hook');
    expect(detectWorkspaceFileKind('.agents/plugins/review-tools/plugin.yaml')).toBe('plugin');
    expect(detectWorkspaceFileKind('.memory/workspace.memory.md')).toBe('memory');
    expect(validateWorkspaceFile({ path: '.agents/skills/review-pr/SKILL.md', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toBeNull();
    expect(validateWorkspaceFile({ path: '.agents/hooks/pre-task.sh', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toBeNull();
    expect(validateWorkspaceFile({ path: '.agents/plugins/review-tools/plugin.yaml', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toBeNull();
    expect(validateWorkspaceFile({ path: '.memory/workspace.memory.md', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toBeNull();
    expect(validateWorkspaceFile({ path: '.agents/skill/Review PR/SKILL.md', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toContain('kebab-case');
    expect(validateWorkspaceFile({ path: '.agents/hooks/../plugins/x/plugin.yaml', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toContain('.agents/hooks/<name>.<ext>');
    expect(validateWorkspaceFile({ path: '.agents/plugins/../manifest.json', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toContain('Plugin directories');
    expect(validateWorkspaceFile({ path: '.memory/notes.md', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toContain('Unsupported memory file path');
    expect(validateWorkspaceFile({ path: 'README.md', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toContain('Unsupported');
  });

  it('creates the default bundled agent skills for each workspace', () => {
    expect(createDefaultWorkspaceFiles('2026-04-20T00:00:00.000Z')).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '.agents/skills/agent-browser/SKILL.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.agents/skills/agent-browser/references/tool-map.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.agents/skills/agent-browser/scripts/resolve-workflow.ts', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.agents/skills/create-agent/SKILL.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.agents/skills/create-agent/evals/evals.json', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.agents/skills/create-agent/scripts/scaffold-agent.ts', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.agents/skills/create-agent-skill/SKILL.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.agents/skills/create-agent-skill/scripts/scaffold-agent-skill.ts', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.agents/skills/create-agent-eval/SKILL.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.agents/skills/create-agent-eval/scripts/scaffold-agent-eval.ts', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.agents/skills/memory/SKILL.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
    ]));
    expect(createDefaultWorkspaceFiles('2026-04-20T00:00:00.000Z')).toHaveLength(30);
  });

  it('loads default bundled agent skills when storage is empty', () => {
    window.localStorage.removeItem(WORKSPACE_FILES_STORAGE_KEY);

    const loaded = loadWorkspaceFiles(['ws-research']);

    expect(loaded['ws-research']).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '.agents/skills/agent-browser/SKILL.md' }),
      expect.objectContaining({ path: '.agents/skills/agent-browser/evals/evals.json' }),
      expect.objectContaining({ path: '.agents/skills/create-agent/SKILL.md' }),
      expect.objectContaining({ path: '.agents/skills/create-agent/references/agent-template.md' }),
      expect.objectContaining({ path: '.agents/skills/create-agent-skill/SKILL.md' }),
      expect.objectContaining({ path: '.agents/skills/create-agent-skill/evals/evals.json' }),
      expect.objectContaining({ path: '.agents/skills/create-agent-eval/SKILL.md' }),
      expect.objectContaining({ path: '.agents/skills/create-agent-eval/references/eval-schema.md' }),
      expect.objectContaining({ path: '.agents/skills/memory/SKILL.md' }),
      expect.objectContaining({ path: '.memory/MEMORY.md' }),
    ]));
    expect(loaded['ws-research']).toHaveLength(30);
  });

  it('merges default bundled agent skills into stored workspace files without overwriting existing files', () => {
    window.localStorage.setItem(WORKSPACE_FILES_STORAGE_KEY, JSON.stringify({
      'ws-research': [
        { path: 'AGENTS.md', content: '# Workspace rules', updatedAt: '2026-04-18T00:00:00.000Z' },
        {
          path: '.agents/skills/create-agent/SKILL.md',
          content: '---\nname: create-agent\ndescription: Custom override.\n---\n\n# Custom',
          updatedAt: '2026-04-18T00:00:00.000Z',
        },
        { path: '.memory/MEMORY.md', content: '# Custom Memory\n\n- Keep this user fact', updatedAt: '2026-04-18T00:00:00.000Z' },
      ],
    }));

    const loaded = loadWorkspaceFiles(['ws-research']);

    expect(loaded['ws-research']).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'AGENTS.md' }),
      expect.objectContaining({ path: '.agents/skills/agent-browser/SKILL.md' }),
      expect.objectContaining({ path: '.agents/skills/create-agent/SKILL.md', content: '---\nname: create-agent\ndescription: Custom override.\n---\n\n# Custom' }),
      expect.objectContaining({ path: '.agents/skills/create-agent-skill/SKILL.md' }),
      expect.objectContaining({ path: '.agents/skills/create-agent-eval/SKILL.md' }),
      expect.objectContaining({ path: '.agents/skills/memory/SKILL.md' }),
      expect.objectContaining({ path: '.agents/skills/create-agent/scripts/scaffold-agent.ts' }),
      expect.objectContaining({ path: '.agents/skills/create-agent-eval/evals/evals.json' }),
      expect.objectContaining({ path: '.memory/MEMORY.md', content: '# Custom Memory\n\n- Keep this user fact' }),
      expect.objectContaining({ path: '.memory/user.memory.md' }),
      expect.objectContaining({ path: '.memory/session.memory.md' }),
    ]));
    expect(loaded['ws-research']).toHaveLength(31);
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
