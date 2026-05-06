import { describe, expect, it, vi } from 'vitest';
import {
  getModelContextRegistry,
  invokeModelContextTool,
  ModelContext,
  ModelContextClient,
} from '@agent-harness/webmcp';

import { registerSettingsTools } from '../workspaceTools';
import type { WorkspaceMcpSettingsFile } from '../workspaceTools';

describe('registerSettingsTools', () => {
  it('reads effective settings and writes user, project, and session settings files', async () => {
    const modelContext = new ModelContext();
    let settingsFiles: WorkspaceMcpSettingsFile[] = [
      {
        scope: 'global',
        label: 'global(user)',
        path: 'user/settings.json',
        content: '{ "editor.tabSize": 2, "agentBrowser.tools.enabled": false }',
      },
      {
        scope: 'project',
        label: 'project(default workspace)',
        path: 'settings.json',
        content: '{ "editor.tabSize": 4 }',
      },
      {
        scope: 'session',
        label: '<session> Planning',
        sessionId: 'session-1',
        path: '/workspace/settings.json',
        content: '{ "agentBrowser.model": "qwen3" }',
      },
    ];
    const getSettingsFiles = vi.fn(async () => settingsFiles);
    const onWriteSettingsFile = vi.fn(async (input: WorkspaceMcpSettingsFile) => {
      settingsFiles = [
        ...settingsFiles.filter((file) => file.scope !== input.scope || file.sessionId !== input.sessionId),
        input,
      ];
      return { ...input, updatedAt: '2026-05-06T12:00:00.000Z' };
    });

    registerSettingsTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      getSettingsFiles,
      onWriteSettingsFile,
    });

    expect(getModelContextRegistry(modelContext).list().map(({ name }) => name).sort()).toEqual([
      'list_settings_scopes',
      'read_settings',
      'update_setting',
      'write_settings',
    ]);

    await expect(invokeModelContextTool(
      modelContext,
      'list_settings_scopes',
      { includeValues: true },
      new ModelContextClient(),
    )).resolves.toEqual([
      {
        scope: 'global',
        label: 'global(user)',
        path: 'user/settings.json',
        values: {
          'agentBrowser.tools.enabled': false,
          'editor.tabSize': 2,
        },
      },
      {
        scope: 'project',
        label: 'project(default workspace)',
        path: 'settings.json',
        values: {
          'editor.tabSize': 4,
        },
      },
      {
        scope: 'session',
        label: '<session> Planning',
        sessionId: 'session-1',
        path: '/workspace/settings.json',
        values: {
          'agentBrowser.model': 'qwen3',
        },
      },
    ]);

    await expect(invokeModelContextTool(
      modelContext,
      'read_settings',
      { scope: 'effective' },
      new ModelContextClient(),
    )).resolves.toEqual({
      scope: 'effective',
      values: {
        'agentBrowser.model': 'qwen3',
        'agentBrowser.tools.enabled': false,
        'editor.tabSize': 4,
      },
      errors: [],
      sources: [
        { scope: 'global', label: 'global(user)', path: 'user/settings.json' },
        { scope: 'project', label: 'project(default workspace)', path: 'settings.json' },
        { scope: 'session', label: '<session> Planning', path: '/workspace/settings.json', sessionId: 'session-1' },
      ],
    });

    await expect(invokeModelContextTool(
      modelContext,
      'update_setting',
      {
        scope: 'session',
        sessionId: 'session-1',
        key: 'agentBrowser.tools.enabled',
        value: true,
      },
      new ModelContextClient(),
    )).resolves.toEqual(expect.objectContaining({
      scope: 'session',
      sessionId: 'session-1',
      path: '/workspace/settings.json',
      values: {
        'agentBrowser.model': 'qwen3',
        'agentBrowser.tools.enabled': true,
      },
    }));
    expect(onWriteSettingsFile).toHaveBeenLastCalledWith({
      scope: 'session',
      label: '<session> Planning',
      sessionId: 'session-1',
      path: '/workspace/settings.json',
      content: '{\n  "agentBrowser.model": "qwen3",\n  "agentBrowser.tools.enabled": true\n}\n',
    });

    await expect(invokeModelContextTool(
      modelContext,
      'write_settings',
      {
        scope: 'project',
        values: {
          'editor.tabSize': 8,
        },
      },
      new ModelContextClient(),
    )).resolves.toEqual(expect.objectContaining({
      scope: 'project',
      path: 'settings.json',
      values: {
        'editor.tabSize': 8,
      },
    }));
  });

  it('reports invalid settings and rejects unsupported write requests', async () => {
    const modelContext = new ModelContext();

    registerSettingsTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [
        {
          path: 'settings.json',
          content: '{bad',
          updatedAt: '2026-05-06T12:00:00.000Z',
        },
      ],
      sessionFsEntries: [
        {
          sessionId: 'session-bad',
          path: '/workspace/settings.json',
          kind: 'file',
          content: '[]',
        },
      ],
    });

    await expect(invokeModelContextTool(
      modelContext,
      'read_settings',
      { scope: 'effective' },
      new ModelContextClient(),
    )).resolves.toEqual({
      scope: 'effective',
      values: {},
      errors: [
        expect.objectContaining({
          scope: 'project',
          path: 'settings.json',
          error: expect.stringContaining('Invalid JSON'),
        }),
        expect.objectContaining({
          scope: 'session',
          path: '/workspace/settings.json',
          sessionId: 'session-bad',
          error: expect.stringContaining('top-level JSON object'),
        }),
      ],
      sources: [
        { scope: 'project', label: 'project(default workspace)', path: 'settings.json' },
        { scope: 'session', label: '<session> session-bad', path: '/workspace/settings.json', sessionId: 'session-bad' },
      ],
    });

    await expect(invokeModelContextTool(
      modelContext,
      'read_settings',
      { scope: 'session' },
      new ModelContextClient(),
    )).rejects.toThrow('top-level JSON object');

    const emptyModelContext = new ModelContext();
    registerSettingsTools(emptyModelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
    });
    await expect(invokeModelContextTool(
      emptyModelContext,
      'read_settings',
      { scope: 'session' },
      new ModelContextClient(),
    )).rejects.toThrow('sessionId');
    await expect(invokeModelContextTool(
      modelContext,
      'update_setting',
      { scope: 'project', key: 123, value: true },
      new ModelContextClient(),
    )).rejects.toThrow('key');
    await expect(invokeModelContextTool(
      modelContext,
      'write_settings',
      { scope: 'project', content: '{}' },
      new ModelContextClient(),
    )).rejects.toThrow('Writing settings files is not supported');
  });

  it('discovers settings from workspace and session filesystem entries', async () => {
    const modelContext = new ModelContext();

    registerSettingsTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [
        {
          path: 'user/settings.json',
          content: '{ "editor.tabSize": 2 }',
          updatedAt: '2026-05-06T12:00:00.000Z',
        },
        {
          path: 'settings.json',
          content: '{ "editor.tabSize": 4 }',
          updatedAt: '2026-05-06T12:05:00.000Z',
        },
        {
          path: 'notes.md',
          content: 'ignored',
          updatedAt: '2026-05-06T12:10:00.000Z',
        },
      ],
      sessionFsEntries: [
        {
          sessionId: 'session-2',
          path: 'workspace/settings.json',
          kind: 'file',
          content: '{ "agentBrowser.model": "qwen3" }',
        },
      ],
    });

    await expect(invokeModelContextTool(
      modelContext,
      'list_settings_scopes',
      {},
      new ModelContextClient(),
    )).resolves.toEqual([
      { scope: 'global', label: 'global(user)', path: 'user/settings.json' },
      { scope: 'project', label: 'project(default workspace)', path: 'settings.json' },
      { scope: 'session', label: '<session> session-2', sessionId: 'session-2', path: '/workspace/settings.json' },
    ]);

    await expect(invokeModelContextTool(
      modelContext,
      'read_settings',
      {},
      new ModelContextClient(),
    )).resolves.toEqual(expect.objectContaining({
      scope: 'effective',
      values: {
        'agentBrowser.model': 'qwen3',
        'editor.tabSize': 4,
      },
    }));

    await expect(invokeModelContextTool(
      modelContext,
      'read_settings',
      { scope: 'project', includeContent: true },
      new ModelContextClient(),
    )).resolves.toEqual({
      scope: 'project',
      label: 'project(default workspace)',
      path: 'settings.json',
      values: { 'editor.tabSize': 4 },
      content: '{ "editor.tabSize": 4 }',
    });

    await expect(invokeModelContextTool(
      modelContext,
      'read_settings',
      { scope: 'session' },
      new ModelContextClient(),
    )).resolves.toEqual({
      scope: 'session',
      label: '<session> session-2',
      sessionId: 'session-2',
      path: '/workspace/settings.json',
      values: { 'agentBrowser.model': 'qwen3' },
    });

    await expect(invokeModelContextTool(
      modelContext,
      'read_settings',
      { scope: 'bad-scope' },
      new ModelContextClient(),
    )).rejects.toThrow('Settings scope');
  });

  it('creates missing settings files and validates write payloads', async () => {
    const modelContext = new ModelContext();
    const onWriteSettingsFile = vi.fn(async () => undefined);

    registerSettingsTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      getSettingsFiles: () => [],
      onWriteSettingsFile,
    });

    await expect(invokeModelContextTool(
      modelContext,
      'write_settings',
      { scope: 'global', content: '{ "editor.tabSize": 3 }' },
      new ModelContextClient(),
    )).resolves.toEqual({
      scope: 'global',
      label: 'global(user)',
      path: 'user/settings.json',
      content: '{\n  "editor.tabSize": 3\n}\n',
      values: { 'editor.tabSize': 3 },
    });

    await expect(invokeModelContextTool(
      modelContext,
      'write_settings',
      {
        scope: 'session',
        sessionId: 'new-session',
        values: { 'agentBrowser.model': 'qwen3' },
      },
      new ModelContextClient(),
    )).resolves.toEqual({
      scope: 'session',
      label: '<session> new-session',
      sessionId: 'new-session',
      path: '/workspace/settings.json',
      content: '{\n  "agentBrowser.model": "qwen3"\n}\n',
      values: { 'agentBrowser.model': 'qwen3' },
    });

    await expect(invokeModelContextTool(
      modelContext,
      'update_setting',
      { scope: 'project', key: 'editor.tabSize', value: 5 },
      new ModelContextClient(),
    )).resolves.toEqual({
      scope: 'project',
      label: 'project(default workspace)',
      path: 'settings.json',
      content: '{\n  "editor.tabSize": 5\n}\n',
      values: { 'editor.tabSize': 5 },
    });

    await expect(invokeModelContextTool(
      modelContext,
      'write_settings',
      { scope: 'project' },
      new ModelContextClient(),
    )).rejects.toThrow('content or values');
    await expect(invokeModelContextTool(
      modelContext,
      'write_settings',
      { scope: 'project', content: '[]' },
      new ModelContextClient(),
    )).rejects.toThrow('top-level JSON object');
  });

  it('normalizes unlabeled session settings and sorts sessions within the same scope', async () => {
    const modelContext = new ModelContext();

    registerSettingsTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      getSettingsFiles: () => [
        {
          scope: 'session',
          label: 'Beta',
          sessionId: 'session-b',
          path: '/workspace/settings.json',
          content: '{}',
        },
        {
          scope: 'session',
          path: '/workspace/settings.json',
          content: '{}',
        },
        {
          scope: 'session',
          label: 'Alpha',
          sessionId: 'session-a',
          path: '/workspace/settings.json',
          content: '{}',
        },
      ],
    });

    await expect(invokeModelContextTool(
      modelContext,
      'list_settings_scopes',
      {},
      new ModelContextClient(),
    )).resolves.toEqual([
      { scope: 'session', label: '<session>', path: '/workspace/settings.json' },
      { scope: 'session', label: '<session> Alpha', sessionId: 'session-a', path: '/workspace/settings.json' },
      { scope: 'session', label: '<session> Beta', sessionId: 'session-b', path: '/workspace/settings.json' },
    ]);
  });
});
