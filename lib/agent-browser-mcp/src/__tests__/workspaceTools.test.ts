import { describe, expect, it, vi } from 'vitest';
import {
  getModelContextPromptRegistry,
  getModelContextPromptTemplateRegistry,
  getModelContextResourceRegistry,
  ModelContext,
  ModelContextClient,
  invokeModelContextTool,
} from '../../../webmcp/src/index';

import { createWebMcpTool } from '../tool';
import {
  registerWorkspaceFileTools,
  registerWorkspaceTools,
  resolveWorkspaceFilePath,
  toWorkspaceFileUri,
} from '../workspaceTools';

describe('workspaceTools', () => {
  it('builds and resolves workspace file URIs', () => {
    expect(toWorkspaceFileUri('/notes/Quarter Plan.md')).toBe('files://workspace/notes/Quarter%20Plan.md');
    expect(resolveWorkspaceFilePath({ path: '/notes/Quarter Plan.md' })).toBe('notes/Quarter Plan.md');
    expect(resolveWorkspaceFilePath({ uri: 'files://workspace/notes/Quarter%20Plan.md' })).toBe('notes/Quarter Plan.md');
  });

  it('rejects invalid workspace file inputs', () => {
    expect(() => resolveWorkspaceFilePath({})).toThrow('must include a path or files://workspace URI');
    expect(() => resolveWorkspaceFilePath({ path: '   ' })).toThrow('must not be empty');
    expect(() => resolveWorkspaceFilePath({ uri: 'https://example.com/AGENTS.md' })).toThrow('files://workspace/ scheme');
    expect(() => resolveWorkspaceFilePath({ uri: 'files://other-host/AGENTS.md' })).toThrow('files://workspace/ scheme');
  });

  it('registers workspace file tools that a WebMCP client can invoke', async () => {
    const modelContext = new ModelContext();
    const workspaceFiles = [
      { path: 'AGENTS.md', content: '# Rules', updatedAt: '2026-04-18T00:00:00.000Z' },
      { path: 'notes/Plan.md', content: 'Ship it.', updatedAt: '2026-04-18T01:00:00.000Z' },
      { path: 'data/config.json', content: '{"ok":true}', updatedAt: '2026-04-18T02:00:00.000Z' },
      { path: 'plugins/review.yaml', content: 'name: review', updatedAt: '2026-04-18T03:00:00.000Z' },
      { path: 'scripts/setup.sh', content: 'echo setup', updatedAt: '2026-04-18T04:00:00.000Z' },
    ];
    const onOpenFile = vi.fn();

    registerWorkspaceFileTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles,
      onOpenFile,
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({ tool: 'list_tools' }, {} as never)).resolves.toEqual([
      expect.objectContaining({ name: 'list_files', readOnlyHint: true }),
      expect.objectContaining({ name: 'list_prompt_templates', readOnlyHint: true }),
      expect.objectContaining({ name: 'list_prompts', readOnlyHint: true }),
      expect.objectContaining({ name: 'list_resources', readOnlyHint: true }),
      expect.objectContaining({ name: 'list_tools', readOnlyHint: true }),
      expect.objectContaining({ name: 'open_file', readOnlyHint: false }),
      expect.objectContaining({ name: 'read_file', readOnlyHint: true }),
    ]);

    await expect(webmcpTool.execute?.({ tool: 'list_resources' }, {} as never)).resolves.toEqual([
      {
        uri: 'files://workspace/AGENTS.md',
        title: 'AGENTS.md',
        description: 'Workspace file AGENTS.md from Research.',
        mimeType: 'text/markdown',
      },
      {
        uri: 'files://workspace/data/config.json',
        title: 'config.json',
        description: 'Workspace file data/config.json from Research.',
        mimeType: 'application/json',
      },
      {
        uri: 'files://workspace/notes/Plan.md',
        title: 'Plan.md',
        description: 'Workspace file notes/Plan.md from Research.',
        mimeType: 'text/markdown',
      },
      {
        uri: 'files://workspace/plugins/review.yaml',
        title: 'review.yaml',
        description: 'Workspace file plugins/review.yaml from Research.',
        mimeType: 'application/yaml',
      },
      {
        uri: 'files://workspace/scripts/setup.sh',
        title: 'setup.sh',
        description: 'Workspace file scripts/setup.sh from Research.',
        mimeType: 'text/x-shellscript',
      },
    ]);

    await expect(webmcpTool.execute?.({ tool: 'list_prompts' }, {} as never)).resolves.toEqual([
      {
        name: 'workspace_overview',
        title: 'Workspace overview',
        description: 'Prompt for summarizing the Research workspace.',
        inputSchema: null,
      },
    ]);

    await expect(webmcpTool.execute?.({ tool: 'list_prompt_templates' }, {} as never)).resolves.toEqual([
      {
        name: 'workspace_file',
        title: 'Workspace file',
        description: 'Prompt template for opening a specific workspace file in Research.',
        inputSchema: '{"type":"object","properties":{"path":{"type":"string"},"uri":{"type":"string"}},"anyOf":[{"required":["path"]},{"required":["uri"]}],"additionalProperties":false}',
      },
    ]);

    await expect(webmcpTool.execute?.({ tool: 'list_files' }, {} as never)).resolves.toEqual([
      {
        path: 'AGENTS.md',
        uri: 'files://workspace/AGENTS.md',
        updatedAt: '2026-04-18T00:00:00.000Z',
      },
      {
        path: 'data/config.json',
        uri: 'files://workspace/data/config.json',
        updatedAt: '2026-04-18T02:00:00.000Z',
      },
      {
        path: 'notes/Plan.md',
        uri: 'files://workspace/notes/Plan.md',
        updatedAt: '2026-04-18T01:00:00.000Z',
      },
      {
        path: 'plugins/review.yaml',
        uri: 'files://workspace/plugins/review.yaml',
        updatedAt: '2026-04-18T03:00:00.000Z',
      },
      {
        path: 'scripts/setup.sh',
        uri: 'files://workspace/scripts/setup.sh',
        updatedAt: '2026-04-18T04:00:00.000Z',
      },
    ]);

    await expect(webmcpTool.execute?.({
      tool: 'open_file',
      args: { uri: 'files://workspace/AGENTS.md' },
    }, {} as never)).resolves.toEqual({
      workspaceName: 'Research',
      path: 'AGENTS.md',
      uri: 'files://workspace/AGENTS.md',
      updatedAt: '2026-04-18T00:00:00.000Z',
      content: '# Rules',
    });

    expect(onOpenFile).toHaveBeenCalledWith('AGENTS.md');

    await expect(invokeModelContextTool(
      modelContext,
      'read_file',
      { path: 'notes/Plan.md' },
      new ModelContextClient(),
    )).resolves.toEqual({
      workspaceName: 'Research',
      path: 'notes/Plan.md',
      uri: 'files://workspace/notes/Plan.md',
      updatedAt: '2026-04-18T01:00:00.000Z',
      content: 'Ship it.',
    });

    expect(onOpenFile).toHaveBeenCalledOnce();

    await expect(getModelContextResourceRegistry(modelContext).get('files://workspace/data/config.json')?.read(new ModelContextClient()))
      .resolves.toEqual({
        uri: 'files://workspace/data/config.json',
        mimeType: 'application/json',
        text: '{"ok":true}',
      });
    await expect(getModelContextResourceRegistry(modelContext).get('files://workspace/scripts/setup.sh')?.read(new ModelContextClient()))
      .resolves.toEqual({
        uri: 'files://workspace/scripts/setup.sh',
        mimeType: 'text/x-shellscript',
        text: 'echo setup',
      });
    await expect(getModelContextPromptRegistry(modelContext).get('workspace_overview')?.render({}, new ModelContextClient()))
      .resolves.toEqual({
        description: 'Workspace overview for Research.',
        messages: [
          { role: 'system', content: 'Active workspace: Research' },
          {
            role: 'user',
            content: 'Workspace files:\n- AGENTS.md\n- notes/Plan.md\n- data/config.json\n- plugins/review.yaml\n- scripts/setup.sh',
          },
        ],
      });
    await expect(getModelContextPromptTemplateRegistry(modelContext).get('workspace_file')?.render({ path: 'AGENTS.md' }, new ModelContextClient()))
      .resolves.toEqual({
        description: 'Workspace file prompt for AGENTS.md.',
        messages: [
          { role: 'system', content: 'Active workspace: Research' },
          { role: 'user', content: 'Open AGENTS.md.\n\n# Rules' },
        ],
      });
  });

  it('registers empty-workspace prompts and no-file resources', async () => {
    const modelContext = new ModelContext();

    registerWorkspaceFileTools(modelContext, {
      workspaceName: 'Build',
      workspaceFiles: [],
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({ tool: 'list_resources' }, {} as never)).resolves.toEqual([]);
    await expect(getModelContextPromptRegistry(modelContext).get('workspace_overview')?.render({}, new ModelContextClient()))
      .resolves.toEqual({
        description: 'Workspace overview for Build.',
        messages: [
          { role: 'system', content: 'Active workspace: Build' },
          { role: 'user', content: 'Workspace files: none' },
        ],
      });
  });

  it('detects yml and plain-text workspace resource mime types', async () => {
    const modelContext = new ModelContext();

    registerWorkspaceFileTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [
        { path: 'plugins/check.yml', content: 'name: check', updatedAt: '2026-04-18T05:00:00.000Z' },
        { path: 'docs/plain.txt', content: 'plain text', updatedAt: '2026-04-18T06:00:00.000Z' },
      ],
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({ tool: 'list_resources' }, {} as never)).resolves.toEqual([
      {
        uri: 'files://workspace/docs/plain.txt',
        title: 'plain.txt',
        description: 'Workspace file docs/plain.txt from Research.',
        mimeType: 'text/plain',
      },
      {
        uri: 'files://workspace/plugins/check.yml',
        title: 'check.yml',
        description: 'Workspace file plugins/check.yml from Research.',
        mimeType: 'application/yaml',
      },
    ]);
  });

  it('reports null input schemas for externally registered tools and prompt templates', async () => {
    const modelContext = new ModelContext();

    registerWorkspaceFileTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
    });
    modelContext.registerTool({
      name: 'ping',
      title: 'Ping',
      description: 'No-schema tool.',
      execute: async () => 'pong',
    });
    modelContext.registerPromptTemplate({
      name: 'adhoc',
      title: 'Adhoc',
      description: 'No-schema prompt template.',
      render: async () => ({
        description: 'Adhoc prompt.',
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await expect(webmcpTool.execute?.({ tool: 'list_tools' }, {} as never)).resolves.toContainEqual({
      name: 'ping',
      title: 'Ping',
      description: 'No-schema tool.',
      inputSchema: null,
      readOnlyHint: false,
    });
    await expect(webmcpTool.execute?.({ tool: 'list_prompt_templates' }, {} as never)).resolves.toContainEqual({
      name: 'adhoc',
      title: 'Adhoc',
      description: 'No-schema prompt template.',
      inputSchema: null,
    });
  });

  it('unregisters workspace file tools on abort and reports missing files', async () => {
    const modelContext = new ModelContext();
    const controller = new AbortController();

    registerWorkspaceFileTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [{ path: 'AGENTS.md', content: '# Rules', updatedAt: '2026-04-18T00:00:00.000Z' }],
      signal: controller.signal,
    });

    await expect(invokeModelContextTool(
      modelContext,
      'open_file',
      { path: 'missing.md' },
      new ModelContextClient(),
    )).rejects.toThrow('missing.md');

    controller.abort();

    await expect(invokeModelContextTool(
      modelContext,
      'list_tools',
      {},
      new ModelContextClient(),
    )).rejects.toThrow('not registered');
    expect(getModelContextResourceRegistry(modelContext).list()).toEqual([]);
    expect(getModelContextPromptRegistry(modelContext).list()).toEqual([]);
    expect(getModelContextPromptTemplateRegistry(modelContext).list()).toEqual([]);
  });

  it('registers browser, session, session filesystem, and worktree context tools', async () => {
    const modelContext = new ModelContext();
    const onCreateBrowserPage = vi.fn(async ({ url, title }: { url: string; title?: string }) => ({
      id: 'page-2',
      title: title ?? 'New page',
      url,
      isOpen: true,
      persisted: false,
      muted: false,
      memoryTier: 'hot' as const,
      memoryMB: 96,
    }));
    const onOpenBrowserPage = vi.fn();
    const onCloseBrowserPage = vi.fn();
    const onCreateSession = vi.fn(async ({ name }: { name?: string }) => ({
      id: 'session-2',
      name: name ?? 'Session 2',
      isOpen: true,
    }));
    const onOpenSession = vi.fn();
    const onCloseSession = vi.fn();
    const getSessionState = vi.fn((sessionId: string) => (sessionId === 'session-1'
      ? {
          id: 'session-1',
          name: 'Session 1',
          isOpen: true,
          mode: 'agent' as const,
          provider: 'codi',
          modelId: 'qwen3-0.6b',
          cwd: '/workspace',
          messages: [
            { role: 'system' as const, content: 'Active workspace: Research' },
            { role: 'user' as const, content: 'Summarize the plan.' },
          ],
        }
      : null));
    const onWriteSession = vi.fn(async ({
      sessionId,
      message,
      provider,
      modelId,
      mode,
      cwd,
    }: {
      sessionId: string;
      message?: string;
      provider?: string;
      modelId?: string;
      mode?: 'agent' | 'terminal';
      cwd?: string;
    }) => ({
      id: sessionId,
      name: 'Session 1',
      isOpen: true,
      mode: mode ?? 'agent',
      provider: provider ?? 'codi',
      modelId: modelId ?? 'qwen3-0.6b',
      cwd: cwd ?? '/workspace',
      messages: [
        { role: 'system' as const, content: 'Active workspace: Research' },
        { role: 'user' as const, content: message ?? 'Summarize the plan.' },
      ],
    }));
    const onCreateWorkspaceFile = vi.fn(async ({ path, content }: { path: string; content: string }) => ({
      path,
      content,
      updatedAt: '2026-04-19T00:00:00.000Z',
    }));
    const onWriteWorkspaceFile = vi.fn(async ({ path, content }: { path: string; content: string }) => ({
      path,
      content,
      updatedAt: '2026-04-19T01:00:00.000Z',
    }));
    const onDeleteWorkspaceFile = vi.fn(async ({ path }: { path: string }) => ({
      path,
      deleted: true,
    }));
    const onCreateSessionFsEntry = vi.fn(async (
      { sessionId, path, kind, content }: { sessionId: string; path: string; kind: 'file' | 'folder'; content?: string },
    ) => ({ sessionId, path, kind, content: content ?? null }));
    const onReadSessionFsFile = vi.fn(async ({ sessionId, path }: { sessionId: string; path: string }) => ({
      sessionId,
      path,
      kind: 'file' as const,
      content: 'terminal notes',
    }));
    const onWriteSessionFsFile = vi.fn(async ({ sessionId, path, content }: { sessionId: string; path: string; content: string }) => ({
      sessionId,
      path,
      kind: 'file' as const,
      content,
    }));
    const onDeleteSessionFsEntry = vi.fn(async ({ sessionId, path }: { sessionId: string; path: string }) => ({
      sessionId,
      path,
      deleted: true,
    }));
    const onRenameSessionFsEntry = vi.fn(async ({
      sessionId,
      path,
      newPath,
    }: {
      sessionId: string;
      path: string;
      newPath: string;
    }) => ({
      sessionId,
      path: newPath,
      previousPath: path,
    }));
    const onScaffoldSessionFsEntry = vi.fn(async ({
      sessionId,
      basePath,
      template,
    }: {
      sessionId: string;
      basePath: string;
      template: 'agents' | 'skill' | 'hook' | 'eval';
    }) => ({
      sessionId,
      path: `${basePath}/${template}.txt`,
      template,
    }));
    const getWorktreeContextActions = vi.fn(({ itemId, itemType }: { itemId: string; itemType: string }) => (
      itemType === 'browser-page'
        ? [{ id: 'bookmark', label: 'Bookmark', description: `Bookmark ${itemId}` }]
        : [{ id: 'properties', label: 'Properties', description: `Properties for ${itemType}` }]
    ));
    const onInvokeWorktreeContextAction = vi.fn(async ({
      itemId,
      itemType,
      actionId,
      args,
    }: {
      itemId: string;
      itemType: string;
      actionId: string;
      args: Record<string, unknown>;
    }) => ({
      itemId,
      itemType,
      actionId,
      args,
      ok: true,
    }));

    registerWorkspaceTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [{ path: 'AGENTS.md', content: '# Rules', updatedAt: '2026-04-18T00:00:00.000Z' }],
      browserPages: [{
        id: 'page-1',
        title: 'Docs',
        url: 'https://example.com/docs',
        isOpen: false,
        persisted: true,
        muted: false,
        memoryTier: 'hot',
        memoryMB: 96,
      }],
      sessions: [{ id: 'session-1', name: 'Session 1', isOpen: true }],
      getSessionState,
      sessionFsEntries: [
        { sessionId: 'session-1', path: '/workspace', kind: 'folder', isRoot: true },
        { sessionId: 'session-1', path: '/workspace/docs', kind: 'folder' },
        { sessionId: 'session-1', path: '/workspace/notes.md', kind: 'file' },
      ],
      worktreeItems: [
        { id: 'page-1', itemType: 'browser-page', label: 'Docs', url: 'https://example.com/docs' },
        { id: 'session-1', itemType: 'session', label: 'Session 1' },
        { id: 'AGENTS.md', itemType: 'workspace-file', label: 'AGENTS.md', path: 'AGENTS.md' },
        { id: 'vfs:session-1:/workspace', itemType: 'session-fs-entry', label: '/workspace', path: '/workspace', sessionId: 'session-1' },
      ],
      onCreateBrowserPage,
      onOpenBrowserPage,
      onCloseBrowserPage,
      onCreateSession,
      onOpenSession,
      onCloseSession,
      onWriteSession,
      onCreateWorkspaceFile,
      onWriteWorkspaceFile,
      onDeleteWorkspaceFile,
      onCreateSessionFsEntry,
      onReadSessionFsFile,
      onWriteSessionFsFile,
      onDeleteSessionFsEntry,
      onRenameSessionFsEntry,
      onScaffoldSessionFsEntry,
      getWorktreeContextActions,
      onInvokeWorktreeContextAction,
    });

    const webmcpTool = createWebMcpTool(modelContext);

    await expect(webmcpTool.execute?.({ tool: 'list_tools' }, {} as never)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'list_browser_pages', readOnlyHint: true }),
      expect.objectContaining({ name: 'create_browser_page', readOnlyHint: false }),
      expect.objectContaining({ name: 'list_sessions', readOnlyHint: true }),
      expect.objectContaining({ name: 'read_session', readOnlyHint: true }),
      expect.objectContaining({ name: 'write_session', readOnlyHint: false }),
      expect.objectContaining({ name: 'create_session', readOnlyHint: false }),
      expect.objectContaining({ name: 'create_file', readOnlyHint: false }),
      expect.objectContaining({ name: 'create_session_file', readOnlyHint: false }),
      expect.objectContaining({ name: 'list_worktree_context_actions', readOnlyHint: true }),
      expect.objectContaining({ name: 'invoke_worktree_context_action', readOnlyHint: false }),
    ]));

    await expect(webmcpTool.execute?.({ tool: 'list_browser_pages' }, {} as never)).resolves.toEqual([
      {
        id: 'page-1',
        title: 'Docs',
        url: 'https://example.com/docs',
        isOpen: false,
        persisted: true,
        muted: false,
        memoryTier: 'hot',
        memoryMB: 96,
      },
    ]);

    await expect(webmcpTool.execute?.({
      tool: 'create_browser_page',
      args: { url: 'https://example.com/new', title: 'New page' },
    }, {} as never)).resolves.toEqual({
      id: 'page-2',
      title: 'New page',
      url: 'https://example.com/new',
      isOpen: true,
      persisted: false,
      muted: false,
      memoryTier: 'hot',
      memoryMB: 96,
    });
    expect(onCreateBrowserPage).toHaveBeenCalledWith({ url: 'https://example.com/new', title: 'New page' });

    await expect(webmcpTool.execute?.({
      tool: 'open_browser_page',
      args: { pageId: 'page-1' },
    }, {} as never)).resolves.toEqual({ pageId: 'page-1', opened: true });
    expect(onOpenBrowserPage).toHaveBeenCalledWith('page-1');

    await expect(webmcpTool.execute?.({
      tool: 'close_browser_page',
      args: { pageId: 'page-1' },
    }, {} as never)).resolves.toEqual({ pageId: 'page-1', closed: true });
    expect(onCloseBrowserPage).toHaveBeenCalledWith('page-1');

    await expect(webmcpTool.execute?.({ tool: 'list_sessions' }, {} as never)).resolves.toEqual([
      { id: 'session-1', name: 'Session 1', isOpen: true },
    ]);

    await expect(webmcpTool.execute?.({
      tool: 'read_session',
      args: { sessionId: 'session-1' },
    }, {} as never)).resolves.toEqual({
      workspaceName: 'Research',
      id: 'session-1',
      name: 'Session 1',
      mode: 'agent',
      provider: 'codi',
      modelId: 'qwen3-0.6b',
      cwd: '/workspace',
      messages: [
        { role: 'system', content: 'Active workspace: Research' },
        { role: 'user', content: 'Summarize the plan.' },
      ],
    });

    await expect(webmcpTool.execute?.({
      tool: 'write_session',
      args: {
        sessionId: 'session-1',
        provider: 'ghcp',
        modelId: 'gpt-4.1',
        mode: 'terminal',
        cwd: '/workspace/app',
        message: 'Open the terminal and inspect the repo.',
      },
    }, {} as never)).resolves.toEqual({
      workspaceName: 'Research',
      id: 'session-1',
      name: 'Session 1',
      mode: 'terminal',
      provider: 'ghcp',
      modelId: 'gpt-4.1',
      cwd: '/workspace/app',
      messages: [
        { role: 'system', content: 'Active workspace: Research' },
        { role: 'user', content: 'Open the terminal and inspect the repo.' },
      ],
    });
    expect(onWriteSession).toHaveBeenCalledWith({
      sessionId: 'session-1',
      provider: 'ghcp',
      modelId: 'gpt-4.1',
      mode: 'terminal',
      cwd: '/workspace/app',
      message: 'Open the terminal and inspect the repo.',
    });

    await expect(webmcpTool.execute?.({
      tool: 'create_session',
      args: { name: 'Draft Session' },
    }, {} as never)).resolves.toEqual({ id: 'session-2', name: 'Draft Session', isOpen: true });
    expect(onCreateSession).toHaveBeenCalledWith({ name: 'Draft Session' });

    await expect(webmcpTool.execute?.({
      tool: 'open_session',
      args: { sessionId: 'session-1' },
    }, {} as never)).resolves.toEqual({ sessionId: 'session-1', opened: true });
    expect(onOpenSession).toHaveBeenCalledWith('session-1');

    await expect(webmcpTool.execute?.({
      tool: 'close_session',
      args: { sessionId: 'session-1' },
    }, {} as never)).resolves.toEqual({ sessionId: 'session-1', closed: true });
    expect(onCloseSession).toHaveBeenCalledWith('session-1');

    await expect(webmcpTool.execute?.({
      tool: 'create_file',
      args: { path: 'notes/brief.md', content: 'hello' },
    }, {} as never)).resolves.toEqual({
      workspaceName: 'Research',
      path: 'notes/brief.md',
      uri: 'files://workspace/notes/brief.md',
      updatedAt: '2026-04-19T00:00:00.000Z',
      content: 'hello',
    });
    expect(onCreateWorkspaceFile).toHaveBeenCalledWith({ path: 'notes/brief.md', content: 'hello' });

    await expect(webmcpTool.execute?.({
      tool: 'write_file',
      args: { path: 'AGENTS.md', content: '# Updated' },
    }, {} as never)).resolves.toEqual({
      workspaceName: 'Research',
      path: 'AGENTS.md',
      uri: 'files://workspace/AGENTS.md',
      updatedAt: '2026-04-19T01:00:00.000Z',
      content: '# Updated',
    });
    expect(onWriteWorkspaceFile).toHaveBeenCalledWith({ path: 'AGENTS.md', content: '# Updated' });

    await expect(webmcpTool.execute?.({
      tool: 'delete_file',
      args: { path: 'AGENTS.md' },
    }, {} as never)).resolves.toEqual({ path: 'AGENTS.md', deleted: true });
    expect(onDeleteWorkspaceFile).toHaveBeenCalledWith({ path: 'AGENTS.md' });

    await expect(webmcpTool.execute?.({ tool: 'list_session_filesystem' }, {} as never)).resolves.toEqual([
      { sessionId: 'session-1', path: '/workspace', kind: 'folder', isRoot: true },
      { sessionId: 'session-1', path: '/workspace/docs', kind: 'folder', isRoot: false },
      { sessionId: 'session-1', path: '/workspace/notes.md', kind: 'file', isRoot: false },
    ]);

    await expect(webmcpTool.execute?.({
      tool: 'read_session_folder',
      args: { sessionId: 'session-1', path: '/workspace' },
    }, {} as never)).resolves.toEqual({
      sessionId: 'session-1',
      path: '/workspace',
      kind: 'folder',
      entries: [
        { name: 'docs', path: '/workspace/docs', kind: 'folder' },
        { name: 'notes.md', path: '/workspace/notes.md', kind: 'file' },
      ],
    });

    await expect(webmcpTool.execute?.({
      tool: 'read_session_file',
      args: { sessionId: 'session-1', path: '/workspace/notes.md' },
    }, {} as never)).resolves.toEqual({
      sessionId: 'session-1',
      path: '/workspace/notes.md',
      kind: 'file',
      content: 'terminal notes',
    });
    expect(onReadSessionFsFile).toHaveBeenCalledWith({ sessionId: 'session-1', path: '/workspace/notes.md' });

    await expect(webmcpTool.execute?.({
      tool: 'create_session_file',
      args: { sessionId: 'session-1', path: '/workspace/todo.md', content: '- item' },
    }, {} as never)).resolves.toEqual({
      sessionId: 'session-1',
      path: '/workspace/todo.md',
      kind: 'file',
      content: '- item',
    });
    expect(onCreateSessionFsEntry).toHaveBeenCalledWith({
      sessionId: 'session-1',
      path: '/workspace/todo.md',
      kind: 'file',
      content: '- item',
    });

    await expect(webmcpTool.execute?.({
      tool: 'create_session_folder',
      args: { sessionId: 'session-1', path: '/workspace/tmp' },
    }, {} as never)).resolves.toEqual({
      sessionId: 'session-1',
      path: '/workspace/tmp',
      kind: 'folder',
      content: null,
    });
    expect(onCreateSessionFsEntry).toHaveBeenCalledWith({
      sessionId: 'session-1',
      path: '/workspace/tmp',
      kind: 'folder',
      content: undefined,
    });

    await expect(webmcpTool.execute?.({
      tool: 'write_session_file',
      args: { sessionId: 'session-1', path: '/workspace/notes.md', content: 'updated notes' },
    }, {} as never)).resolves.toEqual({
      sessionId: 'session-1',
      path: '/workspace/notes.md',
      kind: 'file',
      content: 'updated notes',
    });
    expect(onWriteSessionFsFile).toHaveBeenCalledWith({
      sessionId: 'session-1',
      path: '/workspace/notes.md',
      content: 'updated notes',
    });

    await expect(webmcpTool.execute?.({
      tool: 'rename_session_filesystem_entry',
      args: { sessionId: 'session-1', path: '/workspace/notes.md', newPath: '/workspace/renamed.md' },
    }, {} as never)).resolves.toEqual({
      sessionId: 'session-1',
      path: '/workspace/renamed.md',
      previousPath: '/workspace/notes.md',
    });
    expect(onRenameSessionFsEntry).toHaveBeenCalledWith({
      sessionId: 'session-1',
      path: '/workspace/notes.md',
      newPath: '/workspace/renamed.md',
    });

    await expect(webmcpTool.execute?.({
      tool: 'delete_session_filesystem_entry',
      args: { sessionId: 'session-1', path: '/workspace/notes.md' },
    }, {} as never)).resolves.toEqual({
      sessionId: 'session-1',
      path: '/workspace/notes.md',
      deleted: true,
    });
    expect(onDeleteSessionFsEntry).toHaveBeenCalledWith({ sessionId: 'session-1', path: '/workspace/notes.md' });

    await expect(webmcpTool.execute?.({
      tool: 'scaffold_session_filesystem_entry',
      args: { sessionId: 'session-1', basePath: '/workspace', template: 'agents' },
    }, {} as never)).resolves.toEqual({
      sessionId: 'session-1',
      path: '/workspace/agents.txt',
      template: 'agents',
    });
    expect(onScaffoldSessionFsEntry).toHaveBeenCalledWith({
      sessionId: 'session-1',
      basePath: '/workspace',
      template: 'agents',
    });

    await expect(webmcpTool.execute?.({ tool: 'list_worktree_items' }, {} as never)).resolves.toEqual([
      { id: 'AGENTS.md', itemType: 'workspace-file', label: 'AGENTS.md', path: 'AGENTS.md' },
      { id: 'page-1', itemType: 'browser-page', label: 'Docs', url: 'https://example.com/docs' },
      { id: 'session-1', itemType: 'session', label: 'Session 1' },
      { id: 'vfs:session-1:/workspace', itemType: 'session-fs-entry', label: '/workspace', path: '/workspace', sessionId: 'session-1' },
    ]);

    await expect(webmcpTool.execute?.({
      tool: 'list_worktree_context_actions',
      args: { itemId: 'page-1', itemType: 'browser-page' },
    }, {} as never)).resolves.toEqual([
      { id: 'bookmark', label: 'Bookmark', description: 'Bookmark page-1' },
    ]);
    expect(getWorktreeContextActions).toHaveBeenCalledWith({ itemId: 'page-1', itemType: 'browser-page' });

    await expect(webmcpTool.execute?.({
      tool: 'invoke_worktree_context_action',
      args: { itemId: 'page-1', itemType: 'browser-page', actionId: 'bookmark', args: { enabled: true } },
    }, {} as never)).resolves.toEqual({
      itemId: 'page-1',
      itemType: 'browser-page',
      actionId: 'bookmark',
      args: { enabled: true },
      ok: true,
    });
    expect(onInvokeWorktreeContextAction).toHaveBeenCalledWith({
      itemId: 'page-1',
      itemType: 'browser-page',
      actionId: 'bookmark',
      args: { enabled: true },
    });
  });
});