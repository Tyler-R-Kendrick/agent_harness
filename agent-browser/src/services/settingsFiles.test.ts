import { describe, expect, it } from 'vitest';
import {
  buildSettingsPromptContext,
  createDefaultSessionWorkspaceFiles,
  createDefaultWorkspaceSettingsFiles,
  DEFAULT_SETTINGS_JSON,
  detectWorkspaceSettingsScope,
  PROJECT_SETTINGS_PATH,
  resolveSettingsFiles,
  serializeSettingsJson,
  SESSION_WORKSPACE_SETTINGS_PATH,
  USER_SETTINGS_PATH,
  validateWorkspaceSettingsFile,
} from './settingsFiles';

describe('settingsFiles', () => {
  it('creates VS Code-style settings.json files for user, project, and session scopes', () => {
    const updatedAt = '2026-05-06T12:00:00.000Z';

    expect(createDefaultWorkspaceSettingsFiles(updatedAt)).toEqual([
      { path: USER_SETTINGS_PATH, content: DEFAULT_SETTINGS_JSON, updatedAt },
      { path: PROJECT_SETTINGS_PATH, content: DEFAULT_SETTINGS_JSON, updatedAt },
    ]);
    expect(createDefaultSessionWorkspaceFiles('/workspace')).toEqual({
      [SESSION_WORKSPACE_SETTINGS_PATH]: DEFAULT_SETTINGS_JSON,
    });
    expect(detectWorkspaceSettingsScope(USER_SETTINGS_PATH)).toBe('global');
    expect(detectWorkspaceSettingsScope(PROJECT_SETTINGS_PATH)).toBe('project');
    expect(detectWorkspaceSettingsScope('/workspace/settings.json')).toBeNull();
  });

  it('resolves settings with global, project, then session precedence and exposes prompt context', () => {
    const resolved = resolveSettingsFiles([
      {
        scope: 'global',
        path: USER_SETTINGS_PATH,
        content: serializeSettingsJson({
          'agentBrowser.tools.enabled': false,
          'editor.tabSize': 2,
        }),
      },
      {
        scope: 'project',
        path: PROJECT_SETTINGS_PATH,
        content: serializeSettingsJson({
          'editor.tabSize': 4,
          'workbench.colorTheme': 'Agent Dark',
        }),
      },
      {
        scope: 'session',
        sessionId: 'session-1',
        label: 'Planning',
        path: SESSION_WORKSPACE_SETTINGS_PATH,
        content: serializeSettingsJson({
          'agentBrowser.model': 'qwen3',
        }),
      },
    ]);

    expect(resolved.errors).toEqual([]);
    expect(resolved.effective).toEqual({
      'agentBrowser.model': 'qwen3',
      'agentBrowser.tools.enabled': false,
      'editor.tabSize': 4,
      'workbench.colorTheme': 'Agent Dark',
    });
    expect(resolved.scopes.map((scope) => scope.label)).toEqual([
      'global(user)',
      'project(default workspace)',
      '<session> Planning',
    ]);

    const promptContext = buildSettingsPromptContext(resolved.scopes);

    expect(promptContext).toContain('Settings files loaded with VS Code-style precedence');
    expect(promptContext).toContain('[global(user)] user/settings.json');
    expect(promptContext).toContain('[project(default workspace)] settings.json');
    expect(promptContext).toContain('[<session> Planning] /workspace/settings.json');
    expect(promptContext).toContain('"editor.tabSize": 4');
    expect(promptContext).toContain('"agentBrowser.model": "qwen3"');
  });

  it('validates settings files as JSON objects and reports parse errors without merging them', () => {
    expect(validateWorkspaceSettingsFile({
      path: USER_SETTINGS_PATH,
      content: '{"editor.tabSize": 2}',
      updatedAt: '2026-05-06T12:00:00.000Z',
    })).toBeNull();
    expect(validateWorkspaceSettingsFile({
      path: PROJECT_SETTINGS_PATH,
      content: '[]',
      updatedAt: '2026-05-06T12:00:00.000Z',
    })).toContain('top-level JSON object');
    expect(validateWorkspaceSettingsFile({
      path: 'settings.default.json',
      content: '{}',
      updatedAt: '2026-05-06T12:00:00.000Z',
    })).toContain('Unsupported settings file path');

    const resolved = resolveSettingsFiles([
      {
        scope: 'global',
        path: USER_SETTINGS_PATH,
        content: '{"editor.tabSize": 2}',
      },
      {
        scope: 'project',
        path: PROJECT_SETTINGS_PATH,
        content: '{bad',
      },
      {
        scope: 'session',
        path: SESSION_WORKSPACE_SETTINGS_PATH,
        content: '{"editor.tabSize": 8}',
      },
    ]);

    expect(resolved.effective).toEqual({ 'editor.tabSize': 8 });
    expect(resolved.errors).toEqual([
      expect.objectContaining({
        scope: 'project',
        path: PROJECT_SETTINGS_PATH,
        error: expect.stringContaining('Invalid JSON'),
      }),
    ]);
  });
});
