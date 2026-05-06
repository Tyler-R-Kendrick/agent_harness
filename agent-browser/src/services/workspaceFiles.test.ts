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
  it('creates standard templates for generic tools, hooks, plugins, and memory', () => {
    const tool = createWorkspaceFileTemplate('tool', 'Review PR');
    const hook = createWorkspaceFileTemplate('hook', 'pre-task');
    const plugin = createWorkspaceFileTemplate('plugin', 'review-tools');
    const memory = createWorkspaceFileTemplate('memory', 'project');
    const settings = createWorkspaceFileTemplate('settings', 'project');

    expect(tool.path).toBe('.agents/tools/review-pr/tool.json');
    expect(hook.path).toBe('.agents/hooks/pre-task.sh');
    expect(plugin.path).toBe('.agents/plugins/review-tools/agent-harness.plugin.json');
    expect(memory.path).toBe('.memory/project.memory.md');
    expect(settings.path).toBe('settings.json');
    expect(settings.content).toBe('{\n}\n');
  });

  it('creates default workspace memory files, settings files, and the default Symphony plugin manifest', () => {
    const files = createDefaultWorkspaceFiles('2026-04-20T00:00:00.000Z');

    expect(files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '.memory/MEMORY.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.memory/user.memory.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.memory/project.memory.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.memory/workspace.memory.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: '.memory/session.memory.md', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: 'user/settings.json', content: '{\n}\n', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({ path: 'settings.json', content: '{\n}\n', updatedAt: '2026-04-20T00:00:00.000Z' }),
      expect.objectContaining({
        path: '.agents/plugins/symphony/agent-harness.plugin.json',
        content: expect.stringContaining('"id": "agent-harness.ext.symphony"'),
        updatedAt: '2026-04-20T00:00:00.000Z',
      }),
    ]));
  });

  it('discovers generic hooks and plugins without built-in AGENTS or agent-skill coupling', () => {
    const files: WorkspaceFile[] = [
      { path: 'AGENTS.md', content: '# Rules\nAlways lint before shipping.', updatedAt: '2026-04-08T00:00:00.000Z' },
      { path: 'docs/AGENTS.md', content: '# Docs agent\nFocus on docs.', updatedAt: '2026-04-08T00:00:00.000Z' },
      {
        path: '.agents/skills/review-pr/SKILL.md',
        content: '---\nname: review-pr\ndescription: Review pull requests before requesting approval.\n---\n\n# Review PR',
        updatedAt: '2026-04-08T00:00:00.000Z',
      },
      { path: '.agents/hooks/pre-task.sh', content: '#!/usr/bin/env bash\necho pre-task', updatedAt: '2026-04-08T00:00:00.000Z' },
      { path: '.agents/plugins/review-tools/agent-harness.plugin.json', content: 'name: review-tools', updatedAt: '2026-04-08T00:00:00.000Z' },
      { path: '.memory/project.memory.md', content: '# Project Memory\n\n- Use Vitest for workspace service tests', updatedAt: '2026-04-08T00:00:00.000Z' },
      { path: 'user/settings.json', content: '{ "editor.tabSize": 2 }', updatedAt: '2026-04-08T00:00:00.000Z' },
      { path: 'settings.json', content: '{ "editor.tabSize": 4 }', updatedAt: '2026-04-08T00:00:00.000Z' },
    ];

    const capabilities = discoverWorkspaceCapabilities(files);
    const promptContext = buildWorkspacePromptContext(files);

    expect(capabilities.agents).toHaveLength(0);
    expect(capabilities.skills).toHaveLength(0);
    expect(capabilities.hooks).toEqual([
      expect.objectContaining({ name: 'pre-task.sh' }),
    ]);
    expect(capabilities.plugins).toEqual([
      expect.objectContaining({ directory: 'review-tools', manifestName: 'agent-harness.plugin.json' }),
    ]);
    expect(capabilities.memory).toEqual([
      expect.objectContaining({ path: '.memory/project.memory.md' }),
    ]);
    expect(capabilities.settings).toEqual([
      expect.objectContaining({ path: 'user/settings.json' }),
      expect.objectContaining({ path: 'settings.json' }),
    ]);
    expect(promptContext).not.toContain('Always lint before shipping.');
    expect(promptContext).not.toContain('Focus on docs.');
    expect(promptContext).not.toContain('review-pr (.agents/skills/review-pr/SKILL.md)');
    expect(promptContext).toContain('review-tools (.agents/plugins/review-tools/agent-harness.plugin.json)');
    expect(promptContext).toContain('pre-task.sh (.agents/hooks/pre-task.sh)');
    expect(promptContext).toContain('[project] Use Vitest for workspace service tests');
    expect(promptContext).toContain('Settings files loaded with VS Code-style precedence');
    expect(promptContext).toContain('"editor.tabSize": 4');
    expect(promptContext).not.toContain('Active AGENTS.md:');
    expect(promptContext).not.toContain('docs/AGENTS.md');
    expect(promptContext).not.toContain('AGENTS.md files:');
  });

  it('validates only generic workspace capability paths by default', () => {
    expect(detectWorkspaceFileKind('.agents/skill/review-pr/SKILL.md')).toBeNull();
    expect(detectWorkspaceFileKind('.agents/skills/review-pr/SKILL.md')).toBeNull();
    expect(detectWorkspaceFileKind('AGENTS.md')).toBeNull();
    expect(detectWorkspaceFileKind('.agents/hooks/pre-task.sh')).toBe('hook');
    expect(detectWorkspaceFileKind('.agents/plugins/review-tools/agent-harness.plugin.json')).toBe('plugin');
    expect(detectWorkspaceFileKind('.memory/workspace.memory.md')).toBe('memory');
    expect(detectWorkspaceFileKind('user/settings.json')).toBe('settings');
    expect(detectWorkspaceFileKind('settings.json')).toBe('settings');
    expect(validateWorkspaceFile({ path: 'AGENTS.md', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toContain('Unsupported');
    expect(validateWorkspaceFile({ path: '.agents/skills/review-pr/SKILL.md', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toContain('Unsupported');
    expect(validateWorkspaceFile({ path: '.agents/hooks/pre-task.sh', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toBeNull();
    expect(validateWorkspaceFile({ path: '.agents/plugins/review-tools/agent-harness.plugin.json', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toBeNull();
    expect(validateWorkspaceFile({ path: '.memory/workspace.memory.md', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toBeNull();
    expect(validateWorkspaceFile({ path: 'settings.json', content: '{}', updatedAt: '2026-04-08T00:00:00.000Z' })).toBeNull();
    expect(validateWorkspaceFile({ path: 'user/settings.json', content: '[]', updatedAt: '2026-04-08T00:00:00.000Z' })).toContain('top-level JSON object');
    expect(validateWorkspaceFile({ path: '.agents/skill/Review PR/SKILL.md', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toContain('Unsupported');
    expect(validateWorkspaceFile({ path: '.agents/hooks/../plugins/x/plugin.yaml', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toContain('.agents/hooks/<name>.<ext>');
    expect(validateWorkspaceFile({ path: '.agents/plugins/../manifest.json', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toContain('Plugin directories');
    expect(validateWorkspaceFile({ path: '.memory/notes.md', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toContain('Unsupported memory file path');
    expect(validateWorkspaceFile({ path: 'README.md', content: '', updatedAt: '2026-04-08T00:00:00.000Z' })).toContain('Unsupported');
  });

  it('does not create bundled agent skills for new workspaces', () => {
    const files = createDefaultWorkspaceFiles('2026-04-20T00:00:00.000Z');

    expect(files).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ path: expect.stringContaining('.agents/skills/') }),
    ]));
    expect(files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '.agents/plugins/symphony/agent-harness.plugin.json' }),
    ]));
    expect(files).toHaveLength(8);
  });

  it('loads only generic defaults when storage is empty', () => {
    window.localStorage.removeItem(WORKSPACE_FILES_STORAGE_KEY);

    const loaded = loadWorkspaceFiles(['ws-research']);

    expect(loaded['ws-research']).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '.memory/MEMORY.md' }),
      expect.objectContaining({ path: 'user/settings.json' }),
      expect.objectContaining({ path: 'settings.json' }),
      expect.objectContaining({ path: '.agents/plugins/symphony/agent-harness.plugin.json' }),
    ]));
    expect(loaded['ws-research']).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ path: expect.stringContaining('.agents/skills/') }),
    ]));
    expect(loaded['ws-research']).toHaveLength(8);
  });

  it('preserves stored optional plugin-owned files without adding bundled skills', () => {
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
      expect.objectContaining({ path: '.agents/skills/create-agent/SKILL.md', content: '---\nname: create-agent\ndescription: Custom override.\n---\n\n# Custom' }),
      expect.objectContaining({ path: '.memory/MEMORY.md', content: '# Custom Memory\n\n- Keep this user fact' }),
      expect.objectContaining({ path: '.memory/user.memory.md' }),
      expect.objectContaining({ path: '.memory/session.memory.md' }),
      expect.objectContaining({ path: 'user/settings.json' }),
      expect.objectContaining({ path: 'settings.json' }),
      expect.objectContaining({ path: '.agents/plugins/symphony/agent-harness.plugin.json' }),
    ]));
    expect(loaded['ws-research']).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '.agents/skills/agent-browser/SKILL.md' }),
    ]));
    expect(loaded['ws-research']).toHaveLength(10);
  });

  it('upserts and removes workspace files by path', () => {
    const first = createWorkspaceFileTemplate('plugin', 'review-tools');
    const second = { ...first, content: '# Updated', updatedAt: '2026-04-08T01:00:00.000Z' };

    const upserted = upsertWorkspaceFile([], first);
    const replaced = upsertWorkspaceFile(upserted, second);

    expect(replaced).toEqual([second]);
    expect(removeWorkspaceFile(replaced, second.path)).toEqual([]);
  });
});
