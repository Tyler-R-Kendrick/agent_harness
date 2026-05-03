import { describe, expect, it, vi } from 'vitest';
import {
  getModelContextPromptRegistry,
  getModelContextPromptTemplateRegistry,
  getModelContextRegistry,
  getModelContextResourceRegistry,
  ModelContext,
  ModelContextClient,
  invokeModelContextTool,
} from '@agent-harness/webmcp';

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
    expect(toWorkspaceFileUri('//workspace/AGENTS.md')).toBe('files://workspace/AGENTS.md');
    expect(resolveWorkspaceFilePath({ path: '//workspace/AGENTS.md' })).toBe('AGENTS.md');
    expect(resolveWorkspaceFilePath({ path: '//docs/Quarter Plan.md' })).toBe('docs/Quarter Plan.md');
  });

  it('rejects invalid workspace file inputs', () => {
    expect(() => resolveWorkspaceFilePath({})).toThrow('must include a path or files://workspace URI');
    expect(() => resolveWorkspaceFilePath({ path: '   ' })).toThrow('must not be empty');
    expect(() => resolveWorkspaceFilePath({ uri: 'https://example.com/AGENTS.md' })).toThrow('files://workspace/ scheme');
    expect(() => resolveWorkspaceFilePath({ uri: 'files://other-host/AGENTS.md' })).toThrow('files://workspace/ scheme');
  });

  it('registers only workspace session summaries when no session state reader is available', () => {
    const modelContext = new ModelContext();

    registerWorkspaceTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      sessions: [
        {
          id: 'session-1',
          name: 'Session 1',
          isOpen: true,
        },
      ],
      sessionTools: [
        {
          id: 'cli',
          label: 'CLI',
          description: 'Run shell commands.',
          group: 'local',
          groupLabel: 'Local',
        },
      ],
      onWriteSession: vi.fn(),
    });

    const toolNames = getModelContextRegistry(modelContext).list().map(({ name }) => name);
    expect(toolNames).toContain('list_sessions');
    expect(toolNames).not.toContain('read_session');
    expect(toolNames).not.toContain('list_session_tools');
    expect(toolNames).not.toContain('submit_session_message');
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

    registerWorkspaceFileTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles,
    });

    const webmcpTool = createWebMcpTool(modelContext);
    expect(
      getModelContextRegistry(modelContext)
        .list()
        .map(({ name, readOnlyHint }) => ({ name, readOnlyHint }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    ).toEqual([
      { name: 'elicit_user_input', readOnlyHint: false },
      { name: 'list_filesystem_entries', readOnlyHint: true },
      { name: 'read_browser_location', readOnlyHint: true },
      { name: 'read_filesystem_properties', readOnlyHint: true },
      { name: 'read_web_page', readOnlyHint: true },
      { name: 'recall_user_context', readOnlyHint: true },
      { name: 'request_secret', readOnlyHint: false },
      { name: 'search_web', readOnlyHint: true },
    ]);
    expect(getModelContextRegistry(modelContext).has('list_tools')).toBe(false);
    expect(getModelContextRegistry(modelContext).has('list_resources')).toBe(false);
    expect(getModelContextRegistry(modelContext).has('list_prompts')).toBe(false);
    expect(getModelContextRegistry(modelContext).has('list_prompt_templates')).toBe(false);

    expect(
      getModelContextResourceRegistry(modelContext)
        .list()
        .map(({ uri, title, description, mimeType }) => ({ uri, title, description, mimeType }))
        .sort((left, right) => left.uri.localeCompare(right.uri)),
    ).toEqual([
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

    expect(
      getModelContextPromptRegistry(modelContext)
        .list()
        .map(({ name, title, description }) => ({ name, title, description })),
    ).toEqual([
      {
        name: 'workspace_overview',
        title: 'Workspace overview',
        description: 'Prompt for summarizing the Research workspace.',
      },
    ]);

    expect(
      getModelContextPromptTemplateRegistry(modelContext)
        .list()
        .map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema })),
    ).toEqual([
      {
        name: 'workspace_file',
        title: 'Workspace file',
        description: 'Prompt template for opening a specific workspace file in Research.',
        inputSchema: '{"type":"object","properties":{"path":{"type":"string"},"uri":{"type":"string"}},"anyOf":[{"required":["path"]},{"required":["uri"]}],"additionalProperties":false}',
      },
    ]);

    await expect(webmcpTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'workspace-file', kind: 'file' },
    }, {} as never)).resolves.toEqual([
      {
        targetType: 'workspace-file',
        kind: 'file',
        label: 'AGENTS.md',
        path: 'AGENTS.md',
        uri: 'files://workspace/AGENTS.md',
        updatedAt: '2026-04-18T00:00:00.000Z',
      },
      {
        targetType: 'workspace-file',
        kind: 'file',
        label: 'config.json',
        path: 'data/config.json',
        uri: 'files://workspace/data/config.json',
        updatedAt: '2026-04-18T02:00:00.000Z',
      },
      {
        targetType: 'workspace-file',
        kind: 'file',
        label: 'Plan.md',
        path: 'notes/Plan.md',
        uri: 'files://workspace/notes/Plan.md',
        updatedAt: '2026-04-18T01:00:00.000Z',
      },
      {
        targetType: 'workspace-file',
        kind: 'file',
        label: 'review.yaml',
        path: 'plugins/review.yaml',
        uri: 'files://workspace/plugins/review.yaml',
        updatedAt: '2026-04-18T03:00:00.000Z',
      },
      {
        targetType: 'workspace-file',
        kind: 'file',
        label: 'setup.sh',
        path: 'scripts/setup.sh',
        uri: 'files://workspace/scripts/setup.sh',
        updatedAt: '2026-04-18T04:00:00.000Z',
      },
    ]);

    await expect(webmcpTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'workspace-file', parentPath: '//notes' },
    }, {} as never)).resolves.toEqual([
      {
        targetType: 'workspace-file',
        kind: 'file',
        label: 'Plan.md',
        path: 'notes/Plan.md',
        uri: 'files://workspace/notes/Plan.md',
        updatedAt: '2026-04-18T01:00:00.000Z',
      },
    ]);

    await expect(invokeModelContextTool(
      modelContext,
      'read_filesystem_properties',
      { targetType: 'workspace-file', path: 'notes/Plan.md' },
      new ModelContextClient(),
    )).resolves.toEqual(expect.objectContaining({
      targetType: 'workspace-file',
      kind: 'file',
      label: 'Plan.md',
      path: 'notes/Plan.md',
      uri: 'files://workspace/notes/Plan.md',
      mimeType: 'text/markdown',
      updatedAt: '2026-04-18T01:00:00.000Z',
      sizeBytes: 8,
      preview: 'Ship it.',
    }));

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

    expect(getModelContextResourceRegistry(modelContext).list()).toEqual([]);
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

    expect(
      getModelContextResourceRegistry(modelContext)
        .list()
        .map(({ uri, title, description, mimeType }) => ({ uri, title, description, mimeType }))
        .sort((left, right) => left.uri.localeCompare(right.uri)),
    ).toEqual([
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

  it('stores empty input schemas for externally registered tools and prompt templates without schemas', () => {
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

    expect(getModelContextRegistry(modelContext).get('ping')).toEqual(expect.objectContaining({
      name: 'ping',
      title: 'Ping',
      description: 'No-schema tool.',
      inputSchema: '',
      readOnlyHint: false,
    }));
    expect(getModelContextRegistry(modelContext).get('ping')?.rawInputSchema).toBeUndefined();
    expect(getModelContextPromptTemplateRegistry(modelContext).get('adhoc')).toEqual(expect.objectContaining({
      name: 'adhoc',
      title: 'Adhoc',
      description: 'No-schema prompt template.',
      inputSchema: '',
    }));
    expect(getModelContextPromptTemplateRegistry(modelContext).get('adhoc')?.rawInputSchema).toBeUndefined();
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
      'read_filesystem_properties',
      { targetType: 'workspace-file', path: 'missing.md' },
      new ModelContextClient(),
    )).rejects.toThrow('missing.md');

    controller.abort();

    await expect(invokeModelContextTool(
      modelContext,
      'list_filesystem_entries',
      { targetType: 'workspace-file' },
      new ModelContextClient(),
    )).rejects.toThrow('not registered');
    expect(getModelContextRegistry(modelContext).list()).toEqual([]);
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
    const getBrowserPageHistory = vi.fn((pageId: string) => ({
      pageId,
      currentIndex: 1,
      entries: [
        { url: 'https://example.com/docs', title: 'Docs', timestamp: 1 },
        { url: 'https://example.com/docs/current', title: 'Docs current', timestamp: 2 },
      ],
    }));
    const onNavigateBrowserPage = vi.fn(async ({ pageId, url, title }: { pageId: string; url: string; title?: string }) => ({
      id: pageId,
      title: title ?? 'Navigated page',
      url,
      isOpen: true,
      persisted: true,
      muted: false,
      memoryTier: 'hot' as const,
      memoryMB: 96,
    }));
    const onNavigateBrowserPageHistory = vi.fn(async ({ pageId, direction }: { pageId: string; direction: 'back' | 'forward' }) => ({
      id: pageId,
      title: direction === 'back' ? 'Docs previous' : 'Docs next',
      url: direction === 'back' ? 'https://example.com/docs' : 'https://example.com/docs/current',
      isOpen: true,
      persisted: true,
      muted: false,
      memoryTier: 'hot' as const,
      memoryMB: 96,
    }));
    const onRefreshBrowserPage = vi.fn(async (pageId: string) => ({
      id: pageId,
      title: 'Docs current',
      url: 'https://example.com/docs/current',
      isOpen: true,
      persisted: true,
      muted: false,
      memoryTier: 'hot' as const,
      memoryMB: 96,
    }));
    const onCreateSession = vi.fn(async ({ name }: { name?: string }) => ({
      id: 'session-2',
      name: name ?? 'Session 2',
      isOpen: true,
    }));
    const sessionTools = [
      {
        id: 'cli',
        label: 'CLI',
        description: 'Run shell commands in the active session.',
        group: 'local',
        groupLabel: 'Local tools',
      },
      {
        id: 'webmcp:list_filesystem_entries',
        label: 'List filesystem entries',
        description: 'List or search files, folders, and drives.',
        group: 'files-worktree-mcp',
        groupLabel: 'Files Worktree MCP',
      },
    ];
    const getSessionState = vi.fn((sessionId: string) => (sessionId === 'session-1'
      ? {
          id: 'session-1',
          name: 'Session 1',
          isOpen: true,
          mode: 'agent' as const,
          provider: 'codi',
          modelId: 'qwen3-0.6b',
          agentId: null,
          toolIds: [],
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
      agentId,
      toolIds,
      mode,
    }: {
      sessionId: string;
      message?: string;
      provider?: string;
      modelId?: string;
      agentId?: string | null;
      toolIds?: readonly string[];
      mode?: 'agent' | 'terminal';
    }) => ({
      id: sessionId,
      name: 'Session 1',
      isOpen: true,
      mode: mode ?? 'agent',
      provider: provider ?? 'codi',
      modelId: modelId ?? 'qwen3-0.6b',
      agentId: agentId ?? null,
      toolIds: toolIds ?? [],
      cwd: '/workspace',
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
    const onMoveWorkspaceFile = vi.fn(async ({ targetPath }: { path: string; targetPath: string }) => ({
      path: targetPath,
      content: '# Workspace agent instructions',
      updatedAt: '2026-04-19T00:30:00.000Z',
    }));
    const onDuplicateWorkspaceFile = vi.fn(async ({ targetPath }: { path: string; targetPath: string }) => ({
      path: targetPath,
      content: '# Workspace agent instructions',
      updatedAt: '2026-04-19T00:45:00.000Z',
    }));
    const onSymlinkWorkspaceFile = vi.fn(async ({ path, targetPath }: { path: string; targetPath: string }) => ({
      path: targetPath,
      content: `-> ${path}`,
      updatedAt: '2026-04-19T00:50:00.000Z',
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
    const onMountSessionDrive = vi.fn(async (sessionId: string) => ({
      sessionId,
      label: 'Session 1',
      mounted: true,
    }));
    const onUnmountSessionDrive = vi.fn(async (sessionId: string) => ({
      sessionId,
      label: 'Session 1',
      mounted: false,
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
      template: 'hook';
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
    const getWorktreeRenderPaneState = vi.fn(({ itemId, itemType }: { itemId: string; itemType: string }) => ({
      itemId,
      itemType,
      isOpen: itemType === 'session',
      supported: itemType !== 'clipboard',
    }));
    const onToggleWorktreeRenderPane = vi.fn(async ({ itemId, itemType }: { itemId: string; itemType: string }) => ({
      itemId,
      itemType,
      isOpen: true,
      supported: itemType !== 'clipboard',
    }));
    const getWorktreeContextMenuState = vi.fn(({ itemId, itemType }: { itemId: string; itemType: string }) => ({
      itemId,
      itemType,
      isOpen: itemType === 'browser-page',
      supported: true,
    }));
    const onToggleWorktreeContextMenu = vi.fn(async ({ itemId, itemType }: { itemId: string; itemType: string }) => ({
      itemId,
      itemType,
      isOpen: false,
      supported: true,
    }));
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
    const workspaceOptions: any = {
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
      sessionDrives: [{ sessionId: 'session-1', label: '//session-1-fs', mounted: true }],
      sessionTools,
      getBrowserPageHistory,
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
      onNavigateBrowserPage,
      onNavigateBrowserPageHistory,
      onRefreshBrowserPage,
      onCreateSession,
      onWriteSession,
      onCreateWorkspaceFile,
      onMoveWorkspaceFile,
      onDuplicateWorkspaceFile,
      onSymlinkWorkspaceFile,
      onWriteWorkspaceFile,
      onDeleteWorkspaceFile,
      onMountSessionDrive,
      onUnmountSessionDrive,
      onCreateSessionFsEntry,
      onReadSessionFsFile,
      onWriteSessionFsFile,
      onDeleteSessionFsEntry,
      onRenameSessionFsEntry,
      getFilesystemHistory: vi.fn((input: { targetType: string; path?: string; sessionId?: string }) => ({
        targetType: input.targetType,
        ...(typeof input.path === 'string' ? { path: input.path } : {}),
        ...(typeof input.sessionId === 'string' ? { sessionId: input.sessionId } : {}),
        records: [
          { id: 'rev-2', label: 'Updated', timestamp: 2, isCurrent: true, canRollback: true },
          { id: 'rev-1', label: 'Imported', timestamp: 1, isCurrent: false, canRollback: true },
        ],
      })),
      onRollbackFilesystemHistory: vi.fn(async (input: { targetType: string; path?: string; sessionId?: string; recordId: string }) => ({
        targetType: input.targetType,
        ...(typeof input.path === 'string' ? { path: input.path } : {}),
        ...(typeof input.sessionId === 'string' ? { sessionId: input.sessionId } : {}),
        rolledBackToId: input.recordId,
        records: [
          { id: input.recordId, label: 'Imported', timestamp: 1, isCurrent: true, canRollback: true },
          { id: 'rev-2', label: 'Updated', timestamp: 2, isCurrent: false, canRollback: true },
        ],
      })),
      getFilesystemProperties: vi.fn((input: { targetType: string; sessionId?: string }) => (
        input.targetType === 'session-drive'
          ? {
              targetType: 'session-drive',
              kind: 'drive',
              sessionId: input.sessionId,
              label: 'Session 1',
              mounted: true,
              childCount: 3,
            }
          : undefined
      )),
      getWorktreeRenderPaneState,
      onToggleWorktreeRenderPane,
      getWorktreeContextMenuState,
      onToggleWorktreeContextMenu,
      getWorktreeContextActions,
      onInvokeWorktreeContextAction,
    };

    registerWorkspaceTools(modelContext, workspaceOptions);

    const webmcpTool = createWebMcpTool(modelContext);

    expect(
      getModelContextRegistry(modelContext)
        .list()
        .map(({ name, readOnlyHint }) => ({ name, readOnlyHint })),
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'list_browser_pages', readOnlyHint: true }),
      expect.objectContaining({ name: 'read_browser_page', readOnlyHint: true }),
      expect.objectContaining({ name: 'read_browser_page_history', readOnlyHint: true }),
      expect.objectContaining({ name: 'create_browser_page', readOnlyHint: false }),
      expect.objectContaining({ name: 'navigate_browser_page', readOnlyHint: false }),
      expect.objectContaining({ name: 'navigate_browser_page_history', readOnlyHint: false }),
      expect.objectContaining({ name: 'refresh_browser_page', readOnlyHint: false }),
      expect.objectContaining({ name: 'list_sessions', readOnlyHint: true }),
      expect.objectContaining({ name: 'read_session', readOnlyHint: true }),
      expect.objectContaining({ name: 'create_session', readOnlyHint: false }),
      expect.objectContaining({ name: 'submit_session_message', readOnlyHint: false }),
      expect.objectContaining({ name: 'change_session_model', readOnlyHint: false }),
      expect.objectContaining({ name: 'switch_session_mode', readOnlyHint: false }),
      expect.objectContaining({ name: 'change_session_tools', readOnlyHint: false }),
      expect.objectContaining({ name: 'list_session_tools', readOnlyHint: true }),
      expect.objectContaining({ name: 'list_filesystem_entries', readOnlyHint: true }),
      expect.objectContaining({ name: 'read_filesystem_properties', readOnlyHint: true }),
      expect.objectContaining({ name: 'read_filesystem_history', readOnlyHint: true }),
      expect.objectContaining({ name: 'change_filesystem_mount', readOnlyHint: false }),
      expect.objectContaining({ name: 'add_filesystem_entry', readOnlyHint: false }),
      expect.objectContaining({ name: 'update_filesystem_entry', readOnlyHint: false }),
      expect.objectContaining({ name: 'remove_filesystem_entry', readOnlyHint: false }),
      expect.objectContaining({ name: 'rollback_filesystem_history', readOnlyHint: false }),
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
      tool: 'list_browser_pages',
      args: { titleQuery: 'current' },
    }, {} as never)).resolves.toEqual([]);

    await expect(webmcpTool.execute?.({
      tool: 'read_browser_page_history',
      args: { pageId: 'page-1' },
    }, {} as never)).resolves.toEqual({
      pageId: 'page-1',
      currentIndex: 1,
      entries: [
        { url: 'https://example.com/docs', title: 'Docs', timestamp: 1 },
        { url: 'https://example.com/docs/current', title: 'Docs current', timestamp: 2 },
      ],
    });

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
      tool: 'navigate_browser_page',
      args: { pageId: 'page-1', url: 'https://example.com/navigate', title: 'Navigate Tab' },
    }, {} as never)).resolves.toEqual({
      id: 'page-1',
      title: 'Navigate Tab',
      url: 'https://example.com/navigate',
      isOpen: true,
      persisted: true,
      muted: false,
      memoryTier: 'hot',
      memoryMB: 96,
    });
    expect(onNavigateBrowserPage).toHaveBeenCalledWith({
      pageId: 'page-1',
      url: 'https://example.com/navigate',
      title: 'Navigate Tab',
    });

    await expect(webmcpTool.execute?.({
      tool: 'navigate_browser_page_history',
      args: { pageId: 'page-1', direction: 'back' },
    }, {} as never)).resolves.toEqual({
      id: 'page-1',
      title: 'Docs previous',
      url: 'https://example.com/docs',
      isOpen: true,
      persisted: true,
      muted: false,
      memoryTier: 'hot',
      memoryMB: 96,
    });
    expect(onNavigateBrowserPageHistory).toHaveBeenCalledWith({ pageId: 'page-1', direction: 'back' });

    await expect(webmcpTool.execute?.({
      tool: 'navigate_browser_page_history',
      args: { pageId: 'page-1', direction: 'forward' },
    }, {} as never)).resolves.toEqual({
      id: 'page-1',
      title: 'Docs next',
      url: 'https://example.com/docs/current',
      isOpen: true,
      persisted: true,
      muted: false,
      memoryTier: 'hot',
      memoryMB: 96,
    });
    expect(onNavigateBrowserPageHistory).toHaveBeenCalledWith({ pageId: 'page-1', direction: 'forward' });

    await expect(webmcpTool.execute?.({
      tool: 'refresh_browser_page',
      args: { pageId: 'page-1' },
    }, {} as never)).resolves.toEqual({
      id: 'page-1',
      title: 'Docs current',
      url: 'https://example.com/docs/current',
      isOpen: true,
      persisted: true,
      muted: false,
      memoryTier: 'hot',
      memoryMB: 96,
    });
    expect(onRefreshBrowserPage).toHaveBeenCalledWith('page-1');

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
      agentId: null,
      toolIds: [],
      cwd: '/workspace',
      messages: [
        { role: 'system', content: 'Active workspace: Research' },
        { role: 'user', content: 'Summarize the plan.' },
      ],
    });

    await expect(webmcpTool.execute?.({
      tool: 'list_session_tools',
      args: { sessionId: 'session-1', query: 'shell' },
    }, {} as never)).resolves.toEqual([
      {
        id: 'cli',
        label: 'CLI',
        description: 'Run shell commands in the active session.',
        group: 'local',
        groupLabel: 'Local tools',
        selected: false,
      },
    ]);

    await expect(webmcpTool.execute?.({
      tool: 'submit_session_message',
      args: {
        sessionId: 'session-1',
        message: 'Open the terminal and inspect the repo.',
      },
    }, {} as never)).resolves.toEqual({
      workspaceName: 'Research',
      id: 'session-1',
      name: 'Session 1',
      mode: 'agent',
      provider: 'codi',
      modelId: 'qwen3-0.6b',
      agentId: null,
      toolIds: [],
      cwd: '/workspace',
      messages: [
        { role: 'system', content: 'Active workspace: Research' },
        { role: 'user', content: 'Open the terminal and inspect the repo.' },
      ],
    });
    expect(onWriteSession).toHaveBeenNthCalledWith(1, {
      sessionId: 'session-1',
      message: 'Open the terminal and inspect the repo.',
    });

    await expect(webmcpTool.execute?.({
      tool: 'change_session_model',
      args: {
        sessionId: 'session-1',
      provider: 'ghcp',
      modelId: 'gpt-4.1',
      },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      provider: 'ghcp',
      modelId: 'gpt-4.1',
    }));
    expect(onWriteSession).toHaveBeenNthCalledWith(2, {
      sessionId: 'session-1',
      provider: 'ghcp',
      modelId: 'gpt-4.1',
    });

    await expect(webmcpTool.execute?.({
      tool: 'switch_session_mode',
      args: {
        sessionId: 'session-1',
        mode: 'terminal',
      },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      mode: 'terminal',
    }));
    expect(onWriteSession).toHaveBeenNthCalledWith(3, {
      sessionId: 'session-1',
      mode: 'terminal',
    });

    await expect(webmcpTool.execute?.({
      tool: 'change_session_tools',
      args: {
        sessionId: 'session-1',
        action: 'select',
        toolIds: ['cli'],
      },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      toolIds: ['cli'],
    }));
    expect(onWriteSession).toHaveBeenNthCalledWith(4, {
      sessionId: 'session-1',
      toolIds: ['cli'],
    });

    await expect(webmcpTool.execute?.({
      tool: 'create_session',
      args: { name: 'Draft Session' },
    }, {} as never)).resolves.toEqual({ id: 'session-2', name: 'Draft Session', isOpen: true });
    expect(onCreateSession).toHaveBeenCalledWith({ name: 'Draft Session' });

    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'create', targetType: 'workspace-file', kind: 'file', path: 'notes/brief.md', content: 'hello' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'create',
      targetType: 'workspace-file',
      kind: 'file',
      path: 'notes/brief.md',
      content: 'hello',
    }));
    expect(onCreateWorkspaceFile).toHaveBeenCalledWith({ path: 'notes/brief.md', content: 'hello' });

    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'duplicate', targetType: 'workspace-file', kind: 'file', path: 'notes/brief-copy.md', sourcePath: 'notes/brief.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'duplicate',
      targetType: 'workspace-file',
      kind: 'file',
      path: 'notes/brief-copy.md',
    }));
    expect(onDuplicateWorkspaceFile).toHaveBeenCalledWith({ path: 'notes/brief.md', targetPath: 'notes/brief-copy.md' });

    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'symlink', targetType: 'workspace-file', kind: 'file', path: 'notes/brief-link.md', sourcePath: 'notes/brief.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'symlink',
      targetType: 'workspace-file',
      kind: 'file',
      path: 'notes/brief-link.md',
    }));
    expect(onSymlinkWorkspaceFile).toHaveBeenCalledWith({ path: 'notes/brief.md', targetPath: 'notes/brief-link.md' });

    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'modify', targetType: 'workspace-file', path: 'AGENTS.md', content: '# Updated' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'modify',
      targetType: 'workspace-file',
      kind: 'file',
      path: 'AGENTS.md',
      content: '# Updated',
    }));
    expect(onWriteWorkspaceFile).toHaveBeenCalledWith({ path: 'AGENTS.md', content: '# Updated' });

    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'move', targetType: 'workspace-file', path: 'AGENTS.md', nextPath: 'archive/AGENTS.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'move',
      targetType: 'workspace-file',
      path: 'archive/AGENTS.md',
      previousPath: 'AGENTS.md',
    }));
    expect(onMoveWorkspaceFile).toHaveBeenCalledWith({ path: 'AGENTS.md', targetPath: 'archive/AGENTS.md' });

    await expect(webmcpTool.execute?.({
      tool: 'remove_filesystem_entry',
      args: { targetType: 'workspace-file', path: 'AGENTS.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'delete',
      targetType: 'workspace-file',
      path: 'AGENTS.md',
      deleted: true,
    }));
    expect(onDeleteWorkspaceFile).toHaveBeenCalledWith({ path: 'AGENTS.md' });

    await expect(webmcpTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'session-drive' },
    }, {} as never)).resolves.toEqual([
      { targetType: 'session-drive', kind: 'drive', sessionId: 'session-1', label: '//session-1-fs', mounted: true },
    ]);

    await expect(webmcpTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'session-fs-entry', parentPath: '//session-1-fs/workspace' },
    }, {} as never)).resolves.toEqual(expect.arrayContaining([
      { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/docs', kind: 'folder', label: 'docs', isRoot: false },
      { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/notes.md', kind: 'file', label: 'notes.md', isRoot: false },
    ]));

    await expect(webmcpTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'session-fs-entry', sessionId: 'session-1' },
    }, {} as never)).resolves.toEqual(expect.arrayContaining([
      { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace', kind: 'folder', label: 'workspace', isRoot: true },
      { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/docs', kind: 'folder', label: 'docs', isRoot: false },
      { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/notes.md', kind: 'file', label: 'notes.md', isRoot: false },
    ]));

    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'create', targetType: 'session-fs-entry', sessionId: 'session-1', kind: 'file', path: '/workspace/todo.md', content: '- item' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'create',
      targetType: 'session-fs-entry',
      sessionId: 'session-1',
      kind: 'file',
      path: '/workspace/todo.md',
      content: '- item',
    }));
    expect(onCreateSessionFsEntry).toHaveBeenCalledWith({
      sessionId: 'session-1',
      path: '/workspace/todo.md',
      kind: 'file',
      content: '- item',
    });

    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'create', targetType: 'session-fs-entry', sessionId: 'session-1', kind: 'folder', path: '/workspace/tmp' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'create',
      targetType: 'session-fs-entry',
      sessionId: 'session-1',
      path: '/workspace/tmp',
      kind: 'folder',
    }));
    expect(onCreateSessionFsEntry).toHaveBeenCalledWith({
      sessionId: 'session-1',
      path: '/workspace/tmp',
      kind: 'folder',
      content: undefined,
    });

    // workspace-file symlink into session-fs: auto-corrects filename from source basename
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: {
        action: 'symlink',
        targetType: 'session-fs-entry',
        sourceType: 'workspace-file',
        kind: 'file',
        sessionId: 'session-1',
        path: '/workspace/agents.md',   // intentionally wrong case
        sourcePath: 'AGENTS.md',
      },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'symlink',
      targetType: 'session-fs-entry',
      sessionId: 'session-1',
      path: '/workspace/AGENTS.md',    // corrected to source basename
      kind: 'file',
      content: 'workspace://AGENTS.md',
    }));
    expect(onCreateSessionFsEntry).toHaveBeenCalledWith({
      sessionId: 'session-1',
      path: '/workspace/AGENTS.md',
      kind: 'file',
      content: 'workspace://AGENTS.md',
    });

    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: {
        action: 'symlink',
        targetType: 'session-fs-entry',
        kind: 'file',
        path: '//session-1-fs/workspace',
        sourcePath: '//workspace/AGENTS.md',
      },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'symlink',
      targetType: 'session-fs-entry',
      sessionId: 'session-1',
      path: '/workspace/AGENTS.md',
      kind: 'file',
      content: 'workspace://AGENTS.md',
    }));
    expect(onCreateSessionFsEntry).toHaveBeenCalledWith({
      sessionId: 'session-1',
      path: '/workspace/AGENTS.md',
      kind: 'file',
      content: 'workspace://AGENTS.md',
    });

    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'modify', targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/notes.md', content: 'updated notes' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'modify',
      targetType: 'session-fs-entry',
      sessionId: 'session-1',
      path: '/workspace/notes.md',
      kind: 'file',
      content: 'updated notes',
    }));
    expect(onWriteSessionFsFile).toHaveBeenCalledWith({
      sessionId: 'session-1',
      path: '/workspace/notes.md',
      content: 'updated notes',
    });

    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: {
        action: 'rename',
        targetType: 'session-fs-entry',
        path: '//session-1-fs/workspace/notes.md',
        nextPath: '//session-1-fs/workspace/renamed.md',
      },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'rename',
      targetType: 'session-fs-entry',
      sessionId: 'session-1',
      path: '/workspace/renamed.md',
      previousPath: '/workspace/notes.md',
    }));
    expect(onRenameSessionFsEntry).toHaveBeenCalledWith({
      sessionId: 'session-1',
      path: '/workspace/notes.md',
      newPath: '/workspace/renamed.md',
    });

    await expect(webmcpTool.execute?.({
      tool: 'remove_filesystem_entry',
      args: { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/notes.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'delete',
      targetType: 'session-fs-entry',
      sessionId: 'session-1',
      path: '/workspace/notes.md',
      deleted: true,
    }));
    expect(onDeleteSessionFsEntry).toHaveBeenCalledWith({
      sessionId: 'session-1',
      path: '/workspace/notes.md',
    });

    await expect(webmcpTool.execute?.({
      tool: 'change_filesystem_mount',
      args: { action: 'unmount', sessionId: 'session-1' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'unmount',
      targetType: 'session-drive',
      sessionId: 'session-1',
      mounted: false,
    }));
    expect(onUnmountSessionDrive).toHaveBeenCalledWith('session-1');

    await expect(webmcpTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'session-drive' },
    }, {} as never)).resolves.toEqual(expect.arrayContaining([
      { targetType: 'session-drive', kind: 'drive', sessionId: 'session-1', label: '//session-1-fs', mounted: false },
    ]));

    await expect(webmcpTool.execute?.({
      tool: 'change_filesystem_mount',
      args: { action: 'mount', sessionId: 'session-1' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'mount',
      targetType: 'session-drive',
      sessionId: 'session-1',
      mounted: true,
    }));
    expect(onMountSessionDrive).toHaveBeenCalledWith('session-1');

    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_history',
      args: { targetType: 'workspace-file', path: 'AGENTS.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'workspace-file',
      path: 'AGENTS.md',
      records: [
        expect.objectContaining({ id: 'rev-2', isCurrent: true }),
        expect.objectContaining({ id: 'rev-1', isCurrent: false }),
      ],
    }));

    await expect(webmcpTool.execute?.({
      tool: 'rollback_filesystem_history',
      args: { targetType: 'workspace-file', path: 'AGENTS.md', recordId: 'rev-1' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'workspace-file',
      path: 'AGENTS.md',
      rolledBackToId: 'rev-1',
    }));

    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'session-drive', sessionId: 'session-1' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'session-drive',
      kind: 'drive',
      sessionId: 'session-1',
      label: 'Session 1',
      mounted: true,
      childCount: 3,
    }));

    await expect(webmcpTool.execute?.({ tool: 'list_worktree_items' }, {} as never)).resolves.toEqual([
      { id: 'AGENTS.md', itemType: 'workspace-file', label: 'AGENTS.md', path: 'AGENTS.md' },
      { id: 'page-1', itemType: 'browser-page', label: 'Docs', url: 'https://example.com/docs' },
      { id: 'session-1', itemType: 'session', label: 'Session 1' },
      { id: 'vfs:session-1:/workspace', itemType: 'session-fs-entry', label: '/workspace', path: '/workspace', sessionId: 'session-1' },
    ]);

    await expect(webmcpTool.execute?.({
      tool: 'read_worktree_render_pane_state',
      args: { itemId: 'session-1', itemType: 'session' },
    }, {} as never)).resolves.toEqual({
      itemId: 'session-1',
      itemType: 'session',
      isOpen: true,
      supported: true,
    });
    expect(getWorktreeRenderPaneState).toHaveBeenCalledWith({ itemId: 'session-1', itemType: 'session' });

    await expect(webmcpTool.execute?.({
      tool: 'toggle_worktree_render_pane',
      args: { itemId: 'AGENTS.md', itemType: 'workspace-file' },
    }, {} as never)).resolves.toEqual({
      itemId: 'AGENTS.md',
      itemType: 'workspace-file',
      isOpen: true,
      supported: true,
    });
    expect(onToggleWorktreeRenderPane).toHaveBeenCalledWith({ itemId: 'AGENTS.md', itemType: 'workspace-file' });

    await expect(webmcpTool.execute?.({
      tool: 'read_worktree_context_menu_state',
      args: { itemId: 'page-1', itemType: 'browser-page' },
    }, {} as never)).resolves.toEqual({
      itemId: 'page-1',
      itemType: 'browser-page',
      isOpen: true,
      supported: true,
    });
    expect(getWorktreeContextMenuState).toHaveBeenCalledWith({ itemId: 'page-1', itemType: 'browser-page' });

    await expect(webmcpTool.execute?.({
      tool: 'toggle_worktree_context_menu',
      args: { itemId: 'page-1', itemType: 'browser-page' },
    }, {} as never)).resolves.toEqual({
      itemId: 'page-1',
      itemType: 'browser-page',
      isOpen: false,
      supported: true,
    });
    expect(onToggleWorktreeContextMenu).toHaveBeenCalledWith({ itemId: 'page-1', itemType: 'browser-page' });

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
