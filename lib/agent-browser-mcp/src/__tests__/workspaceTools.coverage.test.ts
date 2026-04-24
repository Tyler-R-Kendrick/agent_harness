import { describe, expect, it, vi } from 'vitest';
import { ModelContext } from '@agent-harness/webmcp';

import { registerFilesystemTools } from '../filesystemTools';
import { createWebMcpTool } from '../tool';
import { registerSessionTools, registerWorkspaceTools } from '../workspaceTools';

describe('workspaceTools coverage branches', () => {
  it('covers workspace mutation fallbacks and browser/session validation branches', async () => {
    const modelContext = new ModelContext();
    const onCreateBrowserPage = vi.fn(async () => undefined);
    const onNavigateBrowserPage = vi.fn(async () => undefined);
    const onNavigateBrowserPageHistory = vi.fn(async () => undefined);
    const onRefreshBrowserPage = vi.fn(async () => undefined);
    const onCreateSession = vi.fn(async () => undefined);
    const sessionTools = [
      {
        id: 'cli',
        label: 'CLI',
        description: 'Run shell commands in the active session.',
        group: 'local',
        groupLabel: 'Local tools',
      },
      {
        id: 'browser',
        label: 'Browser',
        description: 'Control the browser from the active session.',
        group: 'browser-worktree-mcp',
        groupLabel: 'Browser Worktree MCP',
      },
    ];
    const onCreateWorkspaceFile = vi.fn(async () => undefined);
    const onWriteWorkspaceFile = vi.fn(async () => undefined);
    const onDeleteWorkspaceFile = vi.fn(async () => undefined);
    const getSessionState = vi.fn(() => ({
      id: 'session-1',
      name: 'Session 1',
      isOpen: true,
      mode: 'agent' as const,
      provider: null,
      modelId: null,
      agentId: null,
      toolIds: ['cli'],
      cwd: null,
      messages: [{ role: 'assistant' as const, content: 'working', status: 'streaming' }],
    }));
    const onWriteSession = vi.fn(async (input: {
      provider?: string;
      modelId?: string;
      agentId?: string | null;
      toolIds?: readonly string[];
    }) => {
      if (input.provider === 'structured') {
        return {
          id: 'session-1',
          name: '',
          isOpen: true,
          mode: 'agent' as const,
          provider: input.provider,
          modelId: input.modelId ?? null,
          agentId: input.agentId ?? null,
          toolIds: input.toolIds ?? [],
          cwd: null,
          messages: [],
        };
      }

      return undefined;
    });

    registerWorkspaceTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      browserPages: [{
        id: 'page-1',
        title: 'Docs',
        url: 'https://example.com/docs',
        isOpen: false,
        memoryTier: 'balanced',
        memoryMB: 128,
      }, {
        id: 'page-2',
        title: 'Blank',
        url: 'https://example.com/blank',
        isOpen: true,
      }],
      sessions: [{ id: 'session-1', name: 'Session 1', isOpen: true }],
      sessionTools,
      getSessionState,
      onCreateBrowserPage,
      onNavigateBrowserPage,
      onNavigateBrowserPageHistory,
      onRefreshBrowserPage,
      onCreateSession,
      onWriteSession,
      onCreateWorkspaceFile,
      onWriteWorkspaceFile,
      onDeleteWorkspaceFile,
    });

    const webmcpTool = createWebMcpTool(modelContext);

    await expect(webmcpTool.execute?.({
      tool: 'create_browser_page',
      args: { url: 'https://example.com/new' },
    }, {} as never)).resolves.toEqual({ pageId: '', created: true });
    await expect(webmcpTool.execute?.({
      tool: 'navigate_browser_page',
      args: { pageId: 'page-1', url: 'https://example.com/next' },
    }, {} as never)).resolves.toEqual({ pageId: 'page-1', navigate: true });
    await expect(webmcpTool.execute?.({
      tool: 'read_browser_page',
      args: { pageId: 'page-1' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      id: 'page-1',
      memoryTier: 'balanced',
      memoryMB: 128,
    }));
    await expect(webmcpTool.execute?.({
      tool: 'list_browser_pages',
      args: {},
    }, {} as never)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'page-1', memoryTier: 'balanced', memoryMB: 128 }),
      expect.objectContaining({ id: 'page-2', memoryTier: null, memoryMB: null }),
    ]));
    await expect(webmcpTool.execute?.({
      tool: 'list_browser_pages',
      args: { titleQuery: 'blank' },
    }, {} as never)).resolves.toEqual([
      expect.objectContaining({ id: 'page-2', title: 'Blank' }),
    ]);
    await expect(webmcpTool.execute?.({
      tool: 'navigate_browser_page_history',
      args: { pageId: 'page-1', direction: 'back' },
    }, {} as never)).resolves.toEqual({ pageId: 'page-1', direction: 'back' });
    await expect(webmcpTool.execute?.({
      tool: 'refresh_browser_page',
      args: { pageId: 'page-1' },
    }, {} as never)).resolves.toEqual({ pageId: 'page-1', refresh: true });
    await expect(webmcpTool.execute?.({
      tool: 'create_session',
      args: { name: '   ' },
    }, {} as never)).resolves.toEqual({ sessionId: '', created: true });
    expect(onCreateSession).toHaveBeenCalledWith({ name: undefined });
    await expect(webmcpTool.execute?.({
      tool: 'create_session',
      args: {},
    }, {} as never)).resolves.toEqual({ sessionId: '', created: true });

    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'create', targetType: 'workspace-file', kind: 'file', path: 'notes.md', content: 'hello' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'create',
      targetType: 'workspace-file',
      kind: 'file',
      path: 'notes.md',
      content: 'hello',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'create', targetType: 'workspace-file', kind: 'file', path: 'scratch.txt' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'create',
      targetType: 'workspace-file',
      kind: 'file',
      path: 'scratch.txt',
      content: '',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'modify', targetType: 'workspace-file', path: 'notes.md', content: 'updated' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'modify',
      targetType: 'workspace-file',
      kind: 'file',
      path: 'notes.md',
      content: 'updated',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'modify', targetType: 'workspace-file', path: 'notes.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'modify',
      targetType: 'workspace-file',
      kind: 'file',
      path: 'notes.md',
      content: '',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'remove_filesystem_entry',
      args: { targetType: 'workspace-file', path: 'notes.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({ action: 'delete', path: 'notes.md', deleted: true }));
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'create', targetType: 'workspace-file', kind: 'file', content: 'missing-path' },
    }, {} as never)).rejects.toThrow('must not be empty');
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'modify', targetType: 'workspace-file', content: 'missing-path' },
    }, {} as never)).rejects.toThrow('must not be empty');
    await expect(webmcpTool.execute?.({
      tool: 'remove_filesystem_entry',
      args: {},
    }, {} as never)).rejects.toThrow('targetType');

    await expect(webmcpTool.execute?.({ tool: 'read_session', args: {} }, {} as never)).resolves.toEqual({
      workspaceName: 'Research',
      id: 'session-1',
      name: 'Session 1',
      mode: 'agent',
      provider: null,
      modelId: null,
      agentId: null,
      toolIds: ['cli'],
      cwd: null,
      messages: [{ role: 'assistant', content: 'working', status: 'streaming' }],
    });
    await expect(webmcpTool.execute?.({
      tool: 'list_session_tools',
      args: { query: 'shell' },
    }, {} as never)).resolves.toEqual([
      {
        id: 'cli',
        label: 'CLI',
        description: 'Run shell commands in the active session.',
        group: 'local',
        groupLabel: 'Local tools',
        selected: true,
      },
    ]);
    // Covers filterSessionTools !normalizedQuery branch (return all tools when no query)
    await expect(webmcpTool.execute?.({
      tool: 'list_session_tools',
      args: {},
    }, {} as never)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cli' }),
      expect.objectContaining({ id: 'browser' }),
    ]));
    await expect(webmcpTool.execute?.({
      tool: 'change_session_model',
      args: { provider: 'ghcp', modelId: 'gpt-4.1' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({ provider: 'ghcp', modelId: 'gpt-4.1' }));
    await expect(webmcpTool.execute?.({
      tool: 'change_session_model',
      args: { modelId: 'qwen3-1.7b' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({ provider: null, modelId: 'qwen3-1.7b' }));
    await expect(webmcpTool.execute?.({
      tool: 'submit_session_message',
      args: { message: 'hello' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      messages: [
        { role: 'assistant', content: 'working', status: 'streaming' },
        { role: 'user', content: 'hello' },
      ],
    }));
    await expect(webmcpTool.execute?.({
      tool: 'switch_session_mode',
      args: { mode: 'terminal' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      mode: 'terminal',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'change_session_agent',
      args: { agentId: 'docs/AGENTS.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      agentId: 'docs/AGENTS.md',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'change_session_agent',
      args: { agentId: '   ' },
    }, {} as never)).rejects.toThrow('agentId');
    await expect(webmcpTool.execute?.({
      tool: 'change_session_tools',
      args: { action: 'select', toolIds: ['browser'] },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      toolIds: ['cli', 'browser'],
    }));
    await expect(webmcpTool.execute?.({
      tool: 'change_session_tools',
      args: { action: 'deselect', toolIds: ['cli'] },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      toolIds: [],
    }));
    await expect(webmcpTool.execute?.({
      tool: 'change_session_model',
      args: { provider: 'structured', modelId: 'json-mode' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      name: 'Session 1',
      provider: 'structured',
      modelId: 'json-mode',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'submit_session_message',
      args: {},
    }, {} as never)).rejects.toThrow('message');
    await expect(webmcpTool.execute?.({
      tool: 'change_session_model',
      args: {},
    }, {} as never)).rejects.toThrow('modelId');
    await expect(webmcpTool.execute?.({
      tool: 'switch_session_mode',
      args: { mode: 'sideways' },
    }, {} as never)).rejects.toThrow('mode');
    await expect(webmcpTool.execute?.({
      tool: 'change_session_tools',
      args: {},
    }, {} as never)).rejects.toThrow('toolIds');

    await expect(webmcpTool.execute?.({
      tool: 'create_browser_page',
      args: { url: '   ' },
    }, {} as never)).rejects.toThrow('Browser page creation requires a url');
    await expect(webmcpTool.execute?.({
      tool: 'create_browser_page',
      args: {},
    }, {} as never)).rejects.toThrow('Browser page creation requires a url');
    await expect(webmcpTool.execute?.({
      tool: 'read_browser_page',
      args: {},
    }, {} as never)).rejects.toThrow('pageId');
    await expect(webmcpTool.execute?.({
      tool: 'read_browser_page',
      args: { pageId: 'missing' },
    }, {} as never)).rejects.toThrow('not available');
    await expect(webmcpTool.execute?.({
      tool: 'navigate_browser_page',
      args: { pageId: 'page-1', url: '   ' },
    }, {} as never)).rejects.toThrow('Browser navigation requires a url');
    await expect(webmcpTool.execute?.({
      tool: 'navigate_browser_page',
      args: { url: 'https://example.com/next' },
    }, {} as never)).rejects.toThrow('pageId');
    await expect(webmcpTool.execute?.({
      tool: 'navigate_browser_page_history',
      args: { pageId: 'page-1', direction: 'sideways' },
    }, {} as never)).rejects.toThrow('direction');
  });

  it('covers session selection and session helper validation branches', async () => {
    const emptyModelContext = new ModelContext();
    registerWorkspaceTools(emptyModelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      sessions: [],
      getSessionState: () => null,
      onCreateSession: vi.fn(async () => undefined),
      onWriteSession: vi.fn(async () => undefined),
    });
    const emptyTool = createWebMcpTool(emptyModelContext);
    await expect(emptyTool.execute?.({ tool: 'read_session', args: {} }, {} as never)).rejects.toThrow('No sessions');

    const multiModelContext = new ModelContext();
    registerWorkspaceTools(multiModelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      sessions: [
        { id: 'session-1', name: 'Session 1', isOpen: true },
        { id: 'session-2', name: 'Session 2', isOpen: false },
      ],
      sessionTools: [{
        id: 'cli',
        label: 'CLI',
        description: 'Run shell commands in the active session.',
        group: 'local',
        groupLabel: 'Local tools',
      }],
      getSessionState: (sessionId) => sessionId === 'session-1'
        ? {
            id: 'session-1',
            name: 'Session 1',
            isOpen: true,
            mode: 'agent',
            provider: 'codi',
            modelId: 'qwen3-0.6b',
            agentId: null,
            toolIds: [],
            cwd: '/workspace',
            messages: [],
          }
        : null,
      onWriteSession: vi.fn(async () => undefined),
    });
    const multiTool = createWebMcpTool(multiModelContext);
    await expect(multiTool.execute?.({ tool: 'read_session', args: {} }, {} as never)).rejects.toThrow('must include a sessionId');
    await expect(multiTool.execute?.({
      tool: 'submit_session_message',
      args: { message: 'hello' },
    }, {} as never)).rejects.toThrow('must include a sessionId');
    await expect(multiTool.execute?.({ tool: 'list_session_tools', args: {} }, {} as never)).rejects.toThrow('must include a sessionId');
    await expect(multiTool.execute?.({
      tool: 'change_session_tools',
      args: { action: 'select', toolIds: ['cli'] },
    }, {} as never)).rejects.toThrow('must include a sessionId');

    const closedModelContext = new ModelContext();
    registerWorkspaceTools(closedModelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      sessions: [{ id: 'session-1', name: 'Session 1', isOpen: false }],
      sessionTools: [{
        id: 'cli',
        label: 'CLI',
        description: 'Run shell commands in the active session.',
        group: 'local',
        groupLabel: 'Local tools',
      }],
      getSessionState: () => null,
      onWriteSession: vi.fn(async () => undefined),
    });
    const closedTool = createWebMcpTool(closedModelContext);
    await expect(closedTool.execute?.({
      tool: 'read_session',
      args: { sessionId: 'session-1' },
    }, {} as never)).rejects.toThrow('not open');
    await expect(closedTool.execute?.({
      tool: 'submit_session_message',
      args: { sessionId: 'session-1', message: 'hello' },
    }, {} as never)).rejects.toThrow('not open');
    await expect(closedTool.execute?.({
      tool: 'list_session_tools',
      args: { sessionId: 'session-1' },
    }, {} as never)).rejects.toThrow('not open');

    const sessionModelContext = new ModelContext();
    registerSessionTools(sessionModelContext, {
      workspaceName: 'Research',
      session: {
        id: 'session-1',
        name: 'Session 1',
        isOpen: true,
        mode: 'agent',
        provider: 'codi',
        modelId: 'qwen3-0.6b',
        agentId: null,
        toolIds: [],
        cwd: '/workspace',
        messages: [],
      },
      sessionTools: [{
        id: 'webmcp:list_filesystem_entries',
        label: 'List filesystem entries',
        description: 'List or search files, folders, and drives.',
        group: 'files-worktree-mcp',
        groupLabel: 'Files Worktree MCP',
      }],
      onWriteSession: vi.fn(async () => undefined),
    });
    const sessionTool = createWebMcpTool(sessionModelContext);
    await expect(sessionTool.execute?.({
      tool: 'list_session_tools',
      args: { query: 'files' },
    }, {} as never)).resolves.toEqual([
      expect.objectContaining({ id: 'webmcp:list_filesystem_entries', selected: false }),
    ]);
    await expect(sessionTool.execute?.({
      tool: 'change_session_agent',
      args: { sessionId: 'session-2', agentId: 'docs/AGENTS.md' },
    }, {} as never)).rejects.toThrow('not the active session');
    await expect(sessionTool.execute?.({
      tool: 'submit_session_message',
      args: { message: 'hello' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      messages: [{ role: 'user', content: 'hello' }],
    }));
    await expect(sessionTool.execute?.({
      tool: 'change_session_model',
      args: {},
    }, {} as never)).rejects.toThrow('modelId');
    await expect(sessionTool.execute?.({
      tool: 'change_session_tools',
      args: {},
    }, {} as never)).rejects.toThrow('toolIds');
  });

  it('covers dynamic session tool providers and default empty selections', async () => {
    const modelContext = new ModelContext();

    registerWorkspaceTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      sessions: [{ id: 'session-1', name: 'Session 1', isOpen: true }],
      getSessionTools: () => [{
        id: 'cli',
        label: 'CLI',
        description: 'Run shell commands in the active session.',
        group: 'local',
        groupLabel: 'Local tools',
      }],
      getSessionState: () => ({
        id: 'session-1',
        name: 'Session 1',
        isOpen: true,
        mode: 'agent',
        provider: null,
        modelId: null,
        agentId: null,
        cwd: null,
        messages: [],
      }),
      onWriteSession: vi.fn(async () => undefined),
    });

    const webmcpTool = createWebMcpTool(modelContext);

    await expect(webmcpTool.execute?.({
      tool: 'list_session_tools',
      args: { query: 'shell' },
    }, {} as never)).resolves.toEqual([
      expect.objectContaining({ id: 'cli', selected: false }),
    ]);
    await expect(webmcpTool.execute?.({
      tool: 'change_session_tools',
      args: { action: 'select', toolIds: ['cli'] },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      toolIds: ['cli'],
    }));
    await expect(webmcpTool.execute?.({
      tool: 'change_session_agent',
      args: {},
    }, {} as never)).rejects.toThrow('agentId');
  });

  it('covers session filesystem fallback and validation branches', async () => {
    const modelContext = new ModelContext();
    const onReadSessionFsFile = vi.fn(async () => undefined);
    const onCreateSessionFsEntry = vi.fn(async () => undefined);
    const onWriteSessionFsFile = vi.fn(async () => undefined);
    const onDeleteSessionFsEntry = vi.fn(async () => undefined);
    const onRenameSessionFsEntry = vi.fn(async () => undefined);

    registerWorkspaceTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      sessionFsEntries: [
        { sessionId: 'session-1', path: '/workspace', kind: 'folder', isRoot: true },
        { sessionId: 'session-1', path: '/todo', kind: 'file' },
        { sessionId: 'session-1', path: '/inline.txt', kind: 'file', content: 'inline' },
        { sessionId: 'session-1', path: '/workspace/logs', kind: 'folder' },
        { sessionId: 'session-1', path: '/workspace/logs/archive', kind: 'folder' },
        { sessionId: 'session-1', path: '/workspace/logs/b.log', kind: 'file' },
        { sessionId: 'session-1', path: '/workspace/logs/a.log', kind: 'file' },
        { sessionId: 'session-1', path: '/workspace/logs/app.log', kind: 'file' },
      ],
      onReadSessionFsFile,
      onCreateSessionFsEntry,
      onWriteSessionFsFile,
      onDeleteSessionFsEntry,
      onRenameSessionFsEntry,
    });

    const webmcpTool = createWebMcpTool(modelContext);

    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'session-fs-entry' },
    }, {} as never)).rejects.toThrow('path');
    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'session-fs-entry', sessionId: 'session-2', path: '/todo' },
    }, {} as never)).rejects.toThrow('not available');
    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/todo' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'session-fs-entry',
      sessionId: 'session-1',
      path: '/todo',
      kind: 'file',
      sizeBytes: null,
      preview: null,
    }));
    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/inline.txt' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'session-fs-entry',
      sessionId: 'session-1',
      path: '/inline.txt',
      kind: 'file',
      sizeBytes: 6,
      preview: 'inline',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'session-fs-entry', sessionId: 'session-1', parentPath: '/workspace/logs' },
    }, {} as never)).resolves.toEqual([
      { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/logs/archive', kind: 'folder', label: 'archive', isRoot: false },
      { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/logs/a.log', kind: 'file', label: 'a.log', isRoot: false },
      { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/logs/app.log', kind: 'file', label: 'app.log', isRoot: false },
      { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/logs/b.log', kind: 'file', label: 'b.log', isRoot: false },
    ]);
    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/logs' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'session-fs-entry',
      sessionId: 'session-1',
      path: '/workspace/logs',
      kind: 'folder',
      childCount: 4,
    }));

    const unsupportedReaderContext = new ModelContext();
    registerWorkspaceTools(unsupportedReaderContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      sessionFsEntries: [
        { sessionId: 'session-1', path: '/todo', kind: 'file' },
        { sessionId: 'session-1', path: '/readme', kind: 'file', content: 'hello' },
      ],
      onCreateSessionFsEntry: vi.fn(async () => undefined),
    });
    const unsupportedReaderTool = createWebMcpTool(unsupportedReaderContext);
    await expect(unsupportedReaderTool.execute?.({
      tool: 'add_filesystem_entry',
      args: {
        action: 'duplicate',
        targetType: 'session-fs-entry',
        sessionId: 'session-1',
        kind: 'file',
        path: '/todo-copy',
        sourcePath: '/todo',
      },
    }, {} as never)).rejects.toThrow('not supported');

    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'create', targetType: 'session-fs-entry', sessionId: 'session-1', kind: 'folder', path: '/workspace/tmp' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({ sessionId: 'session-1', path: '/workspace/tmp', kind: 'folder' }));
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'create', targetType: 'session-fs-entry', kind: 'file', path: 'relative.txt' },
    }, {} as never)).rejects.toThrow('sessionId');
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'create', targetType: 'session-fs-entry', sessionId: 'session-1', kind: 'folder', path: '   ' },
    }, {} as never)).rejects.toThrow('must include a path');
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'create', targetType: 'session-fs-entry', sessionId: 'session-1', kind: 'file', path: 'relative.txt' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({ sessionId: 'session-1', path: '/relative.txt', kind: 'file', content: '' }));
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'modify', targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/tmp.txt', content: 'updated' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({ sessionId: 'session-1', path: '/workspace/tmp.txt', kind: 'file', content: 'updated' }));
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'modify', targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/empty.txt' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({ sessionId: 'session-1', path: '/workspace/empty.txt', kind: 'file', content: '' }));
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'modify', targetType: 'session-fs-entry', sessionId: 'session-1', content: 'missing-path' },
    }, {} as never)).rejects.toThrow('must include a path');
    await expect(webmcpTool.execute?.({
      tool: 'remove_filesystem_entry',
      args: { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/tmp.txt' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({ sessionId: 'session-1', path: '/workspace/tmp.txt', deleted: true }));
    await expect(webmcpTool.execute?.({
      tool: 'remove_filesystem_entry',
      args: {},
    }, {} as never)).rejects.toThrow('targetType');
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'rename', targetType: 'session-fs-entry', sessionId: 'session-1', path: '/todo', newName: 'done' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({ sessionId: 'session-1', path: '/done', previousPath: '/todo' }));
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'rename', targetType: 'session-fs-entry', path: 'relative.txt', newName: 'renamed.txt' },
    }, {} as never)).rejects.toThrow('sessionId');
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'rename', targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/logs/app.log', newName: 'renamed.log' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      sessionId: 'session-1',
      path: '/workspace/logs/renamed.log',
      previousPath: '/workspace/logs/app.log',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'rename', targetType: 'session-fs-entry', newName: 'renamed.txt' },
    }, {} as never)).rejects.toThrow('must include a path');
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'rename', targetType: 'session-fs-entry', sessionId: 'session-1', path: '/workspace/logs/app.log' },
    }, {} as never)).rejects.toThrow('nextPath or newName');
  });

  it('covers filesystem drive, query, fallback, and unsupported branches', async () => {
    const modelContext = new ModelContext();
    const onCreateWorkspaceFile = vi.fn(async () => undefined);
    const onDuplicateWorkspaceFile = vi.fn(async () => undefined);
    const onSymlinkWorkspaceFile = vi.fn(async () => undefined);
    const onMoveWorkspaceFile = vi.fn(async () => undefined);
    const onWriteWorkspaceFile = vi.fn(async () => undefined);
    const onDeleteWorkspaceFile = vi.fn(async () => undefined);
    const onCreateSessionFsEntry = vi.fn(async () => undefined);
    const onReadSessionFsFile = vi.fn(async () => undefined);
    const onWriteSessionFsFile = vi.fn(async () => undefined);
    const onDeleteSessionFsEntry = vi.fn(async () => undefined);
    const onRenameSessionFsEntry = vi.fn(async () => undefined);
    const onMountSessionDrive = vi.fn(async () => undefined);
    const onUnmountSessionDrive = vi.fn(async () => undefined);
    const getFilesystemHistory = vi.fn(() => undefined);
    const onRollbackFilesystemHistory = vi.fn(async () => undefined);

    registerWorkspaceTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [
        { path: 'README.md', content: 'hello', updatedAt: '2026-04-19T00:00:00.000Z' },
        { path: 'docs/guide.md', content: '# guide', updatedAt: '2026-04-19T01:00:00.000Z' },
        { path: 'docs/api/reference.md', content: '# ref', updatedAt: '2026-04-19T02:00:00.000Z' },
      ],
      sessionDrives: [{ sessionId: 'session-1', label: 'Session 1', mounted: false }],
      sessionFsEntries: [
        { sessionId: 'session-1', path: '/workspace', kind: 'folder', isRoot: true },
        { sessionId: 'session-1', path: '/todo', kind: 'file' },
        { sessionId: 'session-1', path: '/inline.txt', kind: 'file', content: 'inline' },
        { sessionId: 'session-1', path: '/folder', kind: 'folder' },
      ],
      onCreateWorkspaceFile,
      onDuplicateWorkspaceFile,
      onSymlinkWorkspaceFile,
      onMoveWorkspaceFile,
      onWriteWorkspaceFile,
      onDeleteWorkspaceFile,
      onCreateSessionFsEntry,
      onReadSessionFsFile,
      onWriteSessionFsFile,
      onDeleteSessionFsEntry,
      onRenameSessionFsEntry,
      onMountSessionDrive,
      onUnmountSessionDrive,
      getFilesystemHistory,
      onRollbackFilesystemHistory,
    });

    const webmcpTool = createWebMcpTool(modelContext);

    await expect(webmcpTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'workspace-file', kind: 'drive' },
    }, {} as never)).resolves.toEqual([
      { targetType: 'workspace-file', kind: 'drive', label: '//docs', path: '//docs' },
      { targetType: 'workspace-file', kind: 'drive', label: '//workspace', path: '//workspace' },
    ]);
    await expect(webmcpTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'workspace-file', parentPath: '//workspace' },
    }, {} as never)).resolves.toEqual([
      expect.objectContaining({ targetType: 'workspace-file', kind: 'file', path: 'README.md' }),
    ]);
    await expect(webmcpTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'workspace-file', query: 'readme' },
    }, {} as never)).resolves.toEqual([
      expect.objectContaining({ targetType: 'workspace-file', kind: 'file', path: 'README.md' }),
    ]);
    await expect(webmcpTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'session-drive', query: 'session-1' },
    }, {} as never)).resolves.toEqual([
      expect.objectContaining({ targetType: 'session-drive', kind: 'drive', sessionId: 'session-1' }),
    ]);
    await expect(webmcpTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'workspace-file', query: '   ' },
    }, {} as never)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ targetType: 'workspace-file', kind: 'drive', path: '//workspace' }),
    ]));
    await expect(webmcpTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { parentPath: '//workspace' },
    }, {} as never)).resolves.toEqual([
      expect.objectContaining({ targetType: 'workspace-file', kind: 'file', path: 'README.md' }),
    ]);

    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'workspace-file', path: '//workspace' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'workspace-file',
      kind: 'drive',
      path: '//workspace',
      childCount: 1,
      updatedAt: '2026-04-19T00:00:00.000Z',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'workspace-file', path: 'docs/api' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'workspace-file',
      kind: 'folder',
      path: 'docs/api',
      childCount: 1,
      updatedAt: '2026-04-19T02:00:00.000Z',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'workspace-file', path: 'README.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'workspace-file',
      kind: 'file',
      path: 'README.md',
      mimeType: 'text/markdown',
      sizeBytes: 5,
      preview: 'hello',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'session-drive', sessionId: 'session-1' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'session-drive',
      kind: 'drive',
      sessionId: 'session-1',
      mounted: false,
      childCount: 4,
    }));
    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'session-drive' },
    }, {} as never)).rejects.toThrow('sessionId');
    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'session-drive', sessionId: 'missing' },
    }, {} as never)).rejects.toThrow('not available');
    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'session-fs-entry', path: '/todo' },
    }, {} as never)).rejects.toThrow('sessionId');
    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'workspace-file', path: '//' },
    }, {} as never)).rejects.toThrow('must not be empty');
    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'workspace-file', path: '//missing' },
    }, {} as never)).rejects.toThrow('not available');

    const sparseSessionContext = new ModelContext();
    registerWorkspaceTools(sparseSessionContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      sessionDrives: [{ sessionId: 'session-2', label: 'Session 2', mounted: true }],
    });
    const sparseSessionTool = createWebMcpTool(sparseSessionContext);
    await expect(sparseSessionTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'session-drive', sessionId: 'session-2' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'session-drive',
      sessionId: 'session-2',
      childCount: 0,
      mounted: true,
    }));
    await expect(sparseSessionTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'session-fs-entry', sessionId: 'session-2', path: '/missing.txt' },
    }, {} as never)).rejects.toThrow('not available');

    const missingSessionDriveContext = new ModelContext();
    registerWorkspaceTools(missingSessionDriveContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
    });
    const missingSessionDriveTool = createWebMcpTool(missingSessionDriveContext);
    await expect(missingSessionDriveTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'session-drive', sessionId: 'session-3' },
    }, {} as never)).rejects.toThrow('not available');

    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_history',
      args: { targetType: 'session-drive', sessionId: 'session-1' },
    }, {} as never)).resolves.toEqual({ records: [] });
    expect(getFilesystemHistory).toHaveBeenCalledWith({ targetType: 'session-drive', sessionId: 'session-1' });
    await expect(webmcpTool.execute?.({
      tool: 'rollback_filesystem_history',
      args: { targetType: 'session-drive', sessionId: 'session-1', recordId: 'record-1' },
    }, {} as never)).resolves.toEqual({
      targetType: 'session-drive',
      sessionId: 'session-1',
      rolledBackToId: 'record-1',
      records: [],
    });
    await expect(webmcpTool.execute?.({
      tool: 'rollback_filesystem_history',
      args: { targetType: 'session-drive', sessionId: 'session-1' },
    }, {} as never)).rejects.toThrow('recordId');

    await expect(webmcpTool.execute?.({
      tool: 'change_filesystem_mount',
      args: { action: 'mount', sessionId: 'session-1' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({ mounted: true }));
    await expect(webmcpTool.execute?.({
      tool: 'change_filesystem_mount',
      args: { action: 'unmount', sessionId: 'session-1' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({ mounted: false }));
    await expect(webmcpTool.execute?.({
      tool: 'change_filesystem_mount',
      args: { action: 'sideways', sessionId: 'session-1' },
    }, {} as never)).rejects.toThrow('action');
    await expect(webmcpTool.execute?.({
      tool: 'change_filesystem_mount',
      args: { action: 'mount' },
    }, {} as never)).rejects.toThrow('sessionId');

    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'duplicate', targetType: 'workspace-file', kind: 'file', path: 'README-copy.md', sourcePath: 'README.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'duplicate',
      targetType: 'workspace-file',
      path: 'README-copy.md',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'symlink', targetType: 'workspace-file', kind: 'file', path: 'README-link.md', sourcePath: 'README.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      action: 'symlink',
      targetType: 'workspace-file',
      path: 'README-link.md',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'create', targetType: 'workspace-file', kind: 'folder', path: 'docs/new' },
    }, {} as never)).rejects.toThrow('cannot be created directly');
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'duplicate', targetType: 'session-fs-entry', sessionId: 'session-1', kind: 'folder', path: '/folder-copy', sourcePath: '/folder' },
    }, {} as never)).rejects.toThrow('session folders');
    onReadSessionFsFile.mockResolvedValueOnce({ sessionId: 'session-1', path: '/todo', content: 'from-reader' });
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'duplicate', targetType: 'session-fs-entry', sessionId: 'session-1', kind: 'file', path: '/todo-reader-copy', sourcePath: '/todo' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'session-fs-entry',
      path: '/todo-reader-copy',
      content: 'from-reader',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'duplicate', targetType: 'session-fs-entry', sessionId: 'session-1', kind: 'file', path: '/inline-copy.txt', sourcePath: '/inline.txt' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'session-fs-entry',
      path: '/inline-copy.txt',
      content: 'inline',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'duplicate', targetType: 'session-fs-entry', sessionId: 'session-1', kind: 'file', path: '/todo-copy', sourcePath: '/todo' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'session-fs-entry',
      path: '/todo-copy',
      content: '',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'duplicate', targetType: 'session-fs-entry', sessionId: 'session-1', kind: 'file', path: '/folder-copy.txt', sourcePath: '/folder' },
    }, {} as never)).rejects.toThrow('not a file');
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'symlink', targetType: 'session-fs-entry', sessionId: 'session-1', kind: 'file', path: '/todo-link.txt', sourcePath: '/todo' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'session-fs-entry',
      path: '/todo-link.txt',
      content: '-> /todo',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'symlink', targetType: 'session-fs-entry', sourceType: 'workspace-file', sessionId: 'session-1', kind: 'file', path: '/workspace/agents.md', sourcePath: 'AGENTS.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'session-fs-entry',
      path: '/workspace/AGENTS.md',
      content: 'workspace://AGENTS.md',
    }));
    // root-level path: targetDir is empty, falls back to /${basename}
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'symlink', targetType: 'session-fs-entry', sourceType: 'workspace-file', sessionId: 'session-1', kind: 'file', path: '/agents.md', sourcePath: 'AGENTS.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'session-fs-entry',
      path: '/AGENTS.md',
      content: 'workspace://AGENTS.md',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'symlink', targetType: 'session-fs-entry', sourceType: 'workspace-file', sessionId: 'session-1', kind: 'file', path: '/workspace/link.md' },
    }, {} as never)).rejects.toThrow('sourcePath');
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'duplicate', targetType: 'session-fs-entry', sessionId: 'session-1', kind: 'file', path: '/todo-missing-source.txt' },
    }, {} as never)).rejects.toThrow('sourcePath');
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'sideways', targetType: 'workspace-file', kind: 'file', path: 'x.md' },
    }, {} as never)).rejects.toThrow('create, duplicate, or symlink');
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'create', targetType: 'workspace-file', kind: 'drive', path: 'x.md' },
    }, {} as never)).rejects.toThrow('kind');
    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'create', targetType: 'clipboard', kind: 'file', path: 'x.md' },
    }, {} as never)).rejects.toThrow('targetType');

    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'rename', targetType: 'workspace-file', path: '//workspace', newName: 'renamed' },
    }, {} as never)).rejects.toThrow('cannot be renamed');
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'rename', targetType: 'workspace-file', path: 'docs/guide.md', newName: 'guide-renamed.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'workspace-file',
      path: 'docs/guide-renamed.md',
      previousPath: 'docs/guide.md',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'move', targetType: 'workspace-file', path: 'README.md', nextPath: 'archive/README.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'workspace-file',
      path: 'archive/README.md',
      previousPath: 'README.md',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'rename', targetType: 'workspace-file', path: 'README.md' },
    }, {} as never)).rejects.toThrow('nextPath or newName');
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'modify', targetType: 'session-fs-entry', sessionId: 'session-1', path: '/folder', content: 'nope' },
    }, {} as never)).rejects.toThrow('not a file');
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'rename', targetType: 'session-fs-entry', sessionId: 'session-1', path: '/missing.txt', newName: 'renamed.txt' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'session-fs-entry',
      kind: 'file',
      sessionId: 'session-1',
      path: '/renamed.txt',
      previousPath: '/missing.txt',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'sideways', targetType: 'workspace-file', path: 'README.md' },
    }, {} as never)).rejects.toThrow('move, rename, or modify');
    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'move', targetType: 'clipboard', path: 'README.md' },
    }, {} as never)).rejects.toThrow('targetType');

    await expect(webmcpTool.execute?.({
      tool: 'remove_filesystem_entry',
      args: { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/missing.txt' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'session-fs-entry',
      kind: 'file',
      sessionId: 'session-1',
      path: '/missing.txt',
      deleted: true,
    }));
  });

  it('covers remaining filesystem sorting and error rethrow branches', async () => {
    const sortedModelContext = new ModelContext();
    registerWorkspaceTools(sortedModelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      sessionDrives: [
        { sessionId: 'dup', label: 'Same', mounted: false },
        { sessionId: 'dup', label: 'Same', mounted: false },
      ],
      sessionFsEntries: [
        { sessionId: 'session-2', path: '/zeta.txt', kind: 'file' },
        { sessionId: 'session-1', path: '/alpha.txt', kind: 'file' },
      ],
    });
    const sortedTool = createWebMcpTool(sortedModelContext);
    await expect(sortedTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'session-drive' },
    }, {} as never)).resolves.toHaveLength(2);
    await expect(sortedTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'session-fs-entry' },
    }, {} as never)).resolves.toEqual([
      expect.objectContaining({ sessionId: 'session-1', path: '/alpha.txt' }),
      expect.objectContaining({ sessionId: 'session-2', path: '/zeta.txt' }),
    ]);

    const updateErrorContext = new ModelContext();
    registerWorkspaceTools(updateErrorContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      sessionFsEntries: [{
        sessionId: 'session-1',
        kind: 'file',
        get path() {
          throw new Error('explode-update');
        },
      } as never],
      onRenameSessionFsEntry: vi.fn(async () => undefined),
    });
    const updateErrorTool = createWebMcpTool(updateErrorContext);
    await expect(updateErrorTool.execute?.({
      tool: 'update_filesystem_entry',
      args: { action: 'rename', targetType: 'session-fs-entry', sessionId: 'session-1', path: '/todo', newName: 'done' },
    }, {} as never)).rejects.toThrow('explode-update');

    const removeErrorContext = new ModelContext();
    registerWorkspaceTools(removeErrorContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      sessionFsEntries: [{
        sessionId: 'session-1',
        kind: 'file',
        get path() {
          throw new Error('explode-remove');
        },
      } as never],
      onDeleteSessionFsEntry: vi.fn(async () => undefined),
    });
    const removeErrorTool = createWebMcpTool(removeErrorContext);
    await expect(removeErrorTool.execute?.({
      tool: 'remove_filesystem_entry',
      args: { targetType: 'session-fs-entry', sessionId: 'session-1', path: '/todo' },
    }, {} as never)).rejects.toThrow('explode-remove');
  });

  it('covers filesystem add and rename fallback branches', async () => {
    const duplicateCallback = vi.fn(async () => undefined);
    const symlinkCallback = vi.fn(async () => undefined);
    const renameCallback = vi.fn(async () => undefined);
    const mountCallback = vi.fn(async () => undefined);

    const modelContext = new ModelContext();
    registerWorkspaceTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      onDuplicateWorkspaceFile: duplicateCallback,
      onSymlinkWorkspaceFile: symlinkCallback,
      onRenameSessionFsEntry: renameCallback,
      onMountSessionDrive: mountCallback,
    });

    const webmcpTool = createWebMcpTool(modelContext);

    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'duplicate', targetType: 'workspace-file', kind: 'file', path: '/copy.txt' },
    }, {} as never)).rejects.toThrow('Filesystem add duplicate requires a sourcePath.');

    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'symlink', targetType: 'workspace-file', kind: 'file', path: '/link.txt' },
    }, {} as never)).rejects.toThrow('Filesystem add symlink requires a sourcePath.');

    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: { action: 'create', targetType: 'session-fs-entry', kind: 'file', sessionId: 'session-1' },
    }, {} as never)).rejects.toThrow('Session filesystem input must include a path.');

    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: {
        action: 'rename',
        targetType: 'session-fs-entry',
        sessionId: 'session-1',
        path: '/',
        newName: 'renamed-root',
      },
    }, {} as never)).resolves.toMatchObject({
      path: '/renamed-root',
      previousPath: '/',
    });

    expect(duplicateCallback).not.toHaveBeenCalled();
    expect(symlinkCallback).not.toHaveBeenCalled();
    expect(renameCallback).toHaveBeenCalledWith({
      sessionId: 'session-1',
      path: '/',
      newPath: '/renamed-root',
    });

    await expect(webmcpTool.execute?.({
      tool: 'change_filesystem_mount',
      args: { action: 'mount', sessionId: 'orphan-session' },
    }, {} as never)).resolves.toMatchObject({
      label: 'orphan-session',
      mounted: true,
      sessionId: 'orphan-session',
    });

    expect(mountCallback).toHaveBeenCalledWith('orphan-session');
  });

  it('covers filesystem fallbacks when session drives are omitted', async () => {
    const modelContext = new ModelContext();

    registerWorkspaceTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [{ path: 'README.md', content: 'hello world' }],
    });

    const webmcpTool = createWebMcpTool(modelContext);

    await expect(webmcpTool.execute?.({
      tool: 'list_filesystem_entries',
      args: { targetType: 'workspace-file' },
    }, {} as never)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ targetType: 'workspace-file', path: 'README.md' }),
    ]));

    await expect(webmcpTool.execute?.({
      tool: 'read_filesystem_properties',
      args: { targetType: 'workspace-file', path: 'README.md' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      targetType: 'workspace-file',
      path: 'README.md',
      kind: 'file',
      preview: 'hello world',
    }));
  });

  it('covers visible-session nextPath validation and normalization branches', async () => {
    const renameCallback = vi.fn(async () => undefined);
    const createSessionFsEntry = vi.fn(async () => undefined);
    const modelContext = new ModelContext();

    registerWorkspaceTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      sessionDrives: [
        { sessionId: 'session-1', label: '//session-1-fs', mounted: true },
        { sessionId: 'session-2', label: '//session-2-fs', mounted: true },
      ],
      sessionFsEntries: [
        { sessionId: 'session-1', path: '/workspace/notes.md', kind: 'file' },
      ],
      onCreateSessionFsEntry: createSessionFsEntry,
      onRenameSessionFsEntry: renameCallback,
    });

    const webmcpTool = createWebMcpTool(modelContext);

    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: {
        action: 'rename',
        targetType: 'session-fs-entry',
        sessionId: 'session-1',
        path: '/workspace/notes.md',
        nextPath: 'workspace/renamed.md',
      },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      sessionId: 'session-1',
      path: '/workspace/renamed.md',
      previousPath: '/workspace/notes.md',
    }));

    await expect(webmcpTool.execute?.({
      tool: 'update_filesystem_entry',
      args: {
        action: 'rename',
        targetType: 'session-fs-entry',
        path: '//session-1-fs/workspace/notes.md',
        nextPath: '//session-2-fs/workspace/renamed.md',
      },
    }, {} as never)).rejects.toThrow('must stay within the same session filesystem');

    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: {
        action: 'symlink',
        targetType: 'session-fs-entry',
        kind: 'file',
        path: '//session-1-fs/workspace/copied.md',
        sourcePath: '//session-1-fs/workspace/source.md',
      },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      sessionId: 'session-1',
      path: '/workspace/copied.md',
      content: '-> /workspace/source.md',
    }));

    await expect(webmcpTool.execute?.({
      tool: 'add_filesystem_entry',
      args: {
        action: 'duplicate',
        targetType: 'session-fs-entry',
        kind: 'file',
        path: '//session-1-fs/workspace/copied.md',
        sourcePath: '//session-2-fs/workspace/source.md',
      },
    }, {} as never)).rejects.toThrow('must belong to the same session filesystem');

    expect(renameCallback).toHaveBeenCalledWith({
      sessionId: 'session-1',
      path: '/workspace/notes.md',
      newPath: '/workspace/renamed.md',
    });
    expect(createSessionFsEntry).toHaveBeenCalledTimes(1);
    expect(createSessionFsEntry).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-1',
      path: '/workspace/copied.md',
      content: '-> /workspace/source.md',
    }));
  });

  it('covers worktree action validation and non-object args fallback branches', async () => {
    const modelContext = new ModelContext();
    const getWorktreeContextActions = vi.fn(() => [{ id: 'inspect', label: 'Inspect' }]);
    const onInvokeWorktreeContextAction = vi.fn(async () => undefined);

    registerWorkspaceTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      worktreeItems: [
        { id: 'page-2', itemType: 'browser-page', label: 'Zulu' },
        { id: 'page-1', itemType: 'browser-page', label: 'Alpha' },
      ],
      getWorktreeContextActions,
      onInvokeWorktreeContextAction,
    });

    const webmcpTool = createWebMcpTool(modelContext);

    await expect(webmcpTool.execute?.({
      tool: 'list_worktree_items',
      args: {},
    }, {} as never)).resolves.toEqual([
      { id: 'page-1', itemType: 'browser-page', label: 'Alpha' },
      { id: 'page-2', itemType: 'browser-page', label: 'Zulu' },
    ]);

    await expect(webmcpTool.execute?.({
      tool: 'list_worktree_context_actions',
      args: {},
    }, {} as never)).rejects.toThrow('itemId');
    await expect(webmcpTool.execute?.({
      tool: 'list_worktree_context_actions',
      args: { itemId: 'page-1' },
    }, {} as never)).rejects.toThrow('itemType');
    await expect(webmcpTool.execute?.({
      tool: 'list_worktree_context_actions',
      args: { itemId: 'missing', itemType: 'browser-page' },
    }, {} as never)).rejects.toThrow('not available');
    await expect(webmcpTool.execute?.({
      tool: 'invoke_worktree_context_action',
      args: { itemId: 'page-1', itemType: 'browser-page' },
    }, {} as never)).rejects.toThrow('actionId');

    await expect(webmcpTool.execute?.({
      tool: 'invoke_worktree_context_action',
      args: { itemId: 'page-1', itemType: 'browser-page', actionId: 'inspect', args: [] },
    }, {} as never)).resolves.toBeUndefined();
    expect(onInvokeWorktreeContextAction).toHaveBeenCalledWith({
      itemId: 'page-1',
      itemType: 'browser-page',
      actionId: 'inspect',
      args: {},
    });
  });

  it('covers worktree state fallback branches when callbacks do not return structured state', async () => {
    const modelContext = new ModelContext();

    registerWorkspaceTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      worktreeItems: [
        { id: 'page-1', itemType: 'browser-page', label: 'Alpha' },
      ],
      onToggleWorktreeRenderPane: vi.fn(async () => undefined),
      onToggleWorktreeContextMenu: vi.fn(async () => undefined),
    });

    const webmcpTool = createWebMcpTool(modelContext);

    await expect(webmcpTool.execute?.({
      tool: 'toggle_worktree_render_pane',
      args: { itemId: 'page-1', itemType: 'browser-page' },
    }, {} as never)).resolves.toEqual({
      itemId: 'page-1',
      itemType: 'browser-page',
      isOpen: false,
      supported: true,
    });

    await expect(webmcpTool.execute?.({
      tool: 'toggle_worktree_context_menu',
      args: { itemId: 'page-1', itemType: 'browser-page' },
    }, {} as never)).resolves.toEqual({
      itemId: 'page-1',
      itemType: 'browser-page',
      isOpen: false,
      supported: true,
    });
  });

  it('covers worktree state getter fallback normalization when supported is omitted', async () => {
    const modelContext = new ModelContext();

    registerWorkspaceTools(modelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      worktreeItems: [
        { id: 'page-1', itemType: 'browser-page', label: 'Alpha' },
      ],
      getWorktreeRenderPaneState: vi.fn(() => ({ isOpen: true })),
      onToggleWorktreeRenderPane: vi.fn(async () => undefined),
      getWorktreeContextMenuState: vi.fn(() => ({ isOpen: true })),
      onToggleWorktreeContextMenu: vi.fn(async () => undefined),
    });

    const webmcpTool = createWebMcpTool(modelContext);

    await expect(webmcpTool.execute?.({
      tool: 'toggle_worktree_render_pane',
      args: { itemId: 'page-1', itemType: 'browser-page' },
    }, {} as never)).resolves.toEqual({
      itemId: 'page-1',
      itemType: 'browser-page',
      isOpen: true,
      supported: true,
    });

    await expect(webmcpTool.execute?.({
      tool: 'toggle_worktree_context_menu',
      args: { itemId: 'page-1', itemType: 'browser-page' },
    }, {} as never)).resolves.toEqual({
      itemId: 'page-1',
      itemType: 'browser-page',
      isOpen: true,
      supported: true,
    });
  });
});
