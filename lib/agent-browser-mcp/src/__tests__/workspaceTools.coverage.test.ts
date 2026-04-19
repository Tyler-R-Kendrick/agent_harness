import { describe, expect, it, vi } from 'vitest';
import { ModelContext } from '../../../webmcp/src/index';

import { createWebMcpTool } from '../tool';
import { registerSessionTools, registerWorkspaceTools } from '../workspaceTools';

describe('workspaceTools coverage branches', () => {
  it('covers workspace mutation fallbacks and browser/session validation branches', async () => {
    const modelContext = new ModelContext();
    const onCreateBrowserPage = vi.fn(async () => undefined);
    const onOpenBrowserPage = vi.fn();
    const onCloseBrowserPage = vi.fn();
    const onCreateSession = vi.fn(async () => undefined);
    const onOpenSession = vi.fn();
    const onCloseSession = vi.fn();
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
      cwd: null,
      messages: [{ role: 'assistant' as const, content: 'working', status: 'streaming' }],
    }));
    const onWriteSession = vi.fn(async (input: { provider?: string }) => {
      if (input.provider === 'structured') {
        return {
          id: 'session-1',
          name: '',
          isOpen: true,
          mode: 'agent' as const,
          provider: null,
          modelId: null,
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
      getSessionState,
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
    });

    const webmcpTool = createWebMcpTool(modelContext);

    await expect(webmcpTool.execute?.({
      tool: 'create_browser_page',
      args: { url: 'https://example.com/new' },
    }, {} as never)).resolves.toEqual({ pageId: '', created: true });
    await expect(webmcpTool.execute?.({
      tool: 'open_browser_page',
      args: { pageId: 'page-1' },
    }, {} as never)).resolves.toEqual({ pageId: 'page-1', opened: true });
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
      tool: 'close_browser_page',
      args: { pageId: 'page-1' },
    }, {} as never)).resolves.toEqual({ pageId: 'page-1', closed: true });
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
      tool: 'open_session',
      args: { sessionId: 'session-1' },
    }, {} as never)).resolves.toEqual({ sessionId: 'session-1', opened: true });
    await expect(webmcpTool.execute?.({
      tool: 'close_session',
      args: { sessionId: 'session-1' },
    }, {} as never)).resolves.toEqual({ sessionId: 'session-1', closed: true });

    await expect(webmcpTool.execute?.({
      tool: 'create_file',
      args: { path: 'notes.md', content: 'hello' },
    }, {} as never)).resolves.toEqual({
      workspaceName: 'Research',
      path: 'notes.md',
      uri: 'files://workspace/notes.md',
      updatedAt: expect.any(String),
      content: 'hello',
    });
    await expect(webmcpTool.execute?.({
      tool: 'create_file',
      args: { path: 'scratch.txt' },
    }, {} as never)).resolves.toEqual({
      workspaceName: 'Research',
      path: 'scratch.txt',
      uri: 'files://workspace/scratch.txt',
      updatedAt: expect.any(String),
      content: '',
    });
    await expect(webmcpTool.execute?.({
      tool: 'write_file',
      args: { path: 'notes.md', content: 'updated' },
    }, {} as never)).resolves.toEqual({
      workspaceName: 'Research',
      path: 'notes.md',
      uri: 'files://workspace/notes.md',
      updatedAt: expect.any(String),
      content: 'updated',
    });
    await expect(webmcpTool.execute?.({
      tool: 'write_file',
      args: { path: 'notes.md' },
    }, {} as never)).resolves.toEqual({
      workspaceName: 'Research',
      path: 'notes.md',
      uri: 'files://workspace/notes.md',
      updatedAt: expect.any(String),
      content: '',
    });
    await expect(webmcpTool.execute?.({
      tool: 'delete_file',
      args: { path: 'notes.md' },
    }, {} as never)).resolves.toEqual({ path: 'notes.md', deleted: true });
    await expect(webmcpTool.execute?.({
      tool: 'create_file',
      args: { content: 'missing-path' },
    }, {} as never)).rejects.toThrow('must not be empty');
    await expect(webmcpTool.execute?.({
      tool: 'write_file',
      args: { content: 'missing-path' },
    }, {} as never)).rejects.toThrow('must not be empty');
    await expect(webmcpTool.execute?.({
      tool: 'delete_file',
      args: {},
    }, {} as never)).rejects.toThrow('must not be empty');

    await expect(webmcpTool.execute?.({ tool: 'read_session', args: {} }, {} as never)).resolves.toEqual({
      workspaceName: 'Research',
      id: 'session-1',
      name: 'Session 1',
      mode: 'agent',
      provider: null,
      modelId: null,
      cwd: null,
      messages: [{ role: 'assistant', content: 'working', status: 'streaming' }],
    });
    await expect(webmcpTool.execute?.({
      tool: 'write_session',
      args: { provider: 'ghcp' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({ provider: 'ghcp' }));
    await expect(webmcpTool.execute?.({
      tool: 'write_session',
      args: { message: 'hello' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      messages: [
        { role: 'assistant', content: 'working', status: 'streaming' },
        { role: 'user', content: 'hello' },
      ],
    }));
    await expect(webmcpTool.execute?.({
      tool: 'write_session',
      args: { name: '  Renamed Session  ', mode: 'terminal' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      name: 'Renamed Session',
      mode: 'terminal',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'write_session',
      args: { provider: 'structured' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      name: 'Session 1',
    }));
    await expect(webmcpTool.execute?.({
      tool: 'write_session',
      args: {},
    }, {} as never)).rejects.toThrow('requires at least one of name, message, provider, modelId, mode, or cwd');

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
      getSessionState: (sessionId) => sessionId === 'session-1'
        ? {
            id: 'session-1',
            name: 'Session 1',
            isOpen: true,
            mode: 'agent',
            provider: 'codi',
            modelId: 'qwen3-0.6b',
            cwd: '/workspace',
            messages: [],
          }
        : null,
      onOpenSession: vi.fn(),
      onCloseSession: vi.fn(),
      onWriteSession: vi.fn(async () => undefined),
    });
    const multiTool = createWebMcpTool(multiModelContext);
    await expect(multiTool.execute?.({ tool: 'read_session', args: {} }, {} as never)).rejects.toThrow('must include a sessionId');
    await expect(multiTool.execute?.({ tool: 'write_session', args: {} }, {} as never)).rejects.toThrow('must include a sessionId');
    await expect(multiTool.execute?.({ tool: 'open_session', args: {} }, {} as never)).rejects.toThrow('must include a sessionId');
    await expect(multiTool.execute?.({
      tool: 'close_session',
      args: { sessionId: 'missing' },
    }, {} as never)).rejects.toThrow('not available');

    const closedModelContext = new ModelContext();
    registerWorkspaceTools(closedModelContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      sessions: [{ id: 'session-1', name: 'Session 1', isOpen: false }],
      getSessionState: () => null,
      onWriteSession: vi.fn(async () => undefined),
    });
    const closedTool = createWebMcpTool(closedModelContext);
    await expect(closedTool.execute?.({
      tool: 'read_session',
      args: { sessionId: 'session-1' },
    }, {} as never)).rejects.toThrow('not open');
    await expect(closedTool.execute?.({
      tool: 'write_session',
      args: { sessionId: 'session-1', provider: 'ghcp' },
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
        cwd: '/workspace',
        messages: [],
      },
      onWriteSession: vi.fn(async () => undefined),
    });
    const sessionTool = createWebMcpTool(sessionModelContext);
    await expect(sessionTool.execute?.({
      tool: 'write_session',
      args: { sessionId: 'session-2', message: 'nope' },
    }, {} as never)).rejects.toThrow('not the active session');
    await expect(sessionTool.execute?.({
      tool: 'write_session',
      args: { message: 'hello' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      messages: [{ role: 'user', content: 'hello' }],
    }));
    await expect(sessionTool.execute?.({
      tool: 'write_session',
      args: {},
    }, {} as never)).rejects.toThrow('requires at least one of name, message, provider, modelId, mode, or cwd');
  });

  it('covers session filesystem fallback and validation branches', async () => {
    const modelContext = new ModelContext();
    const onReadSessionFsFile = vi.fn(async () => undefined);
    const onCreateSessionFsEntry = vi.fn(async () => undefined);
    const onWriteSessionFsFile = vi.fn(async () => undefined);
    const onDeleteSessionFsEntry = vi.fn(async () => undefined);
    const onRenameSessionFsEntry = vi.fn(async () => undefined);
    const onScaffoldSessionFsEntry = vi.fn(async () => undefined);

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
      onScaffoldSessionFsEntry,
    });

    const webmcpTool = createWebMcpTool(modelContext);

    await expect(webmcpTool.execute?.({ tool: 'read_session_folder', args: {} }, {} as never)).rejects.toThrow('sessionId');
    await expect(webmcpTool.execute?.({
      tool: 'read_session_file',
      args: { sessionId: 'session-1' },
    }, {} as never)).rejects.toThrow('path');
    await expect(webmcpTool.execute?.({
      tool: 'read_session_folder',
      args: { sessionId: 'session-1', path: '/workspace/logs/app.log' },
    }, {} as never)).rejects.toThrow('not a folder');
    await expect(webmcpTool.execute?.({
      tool: 'read_session_file',
      args: { sessionId: 'session-1', path: '/workspace' },
    }, {} as never)).rejects.toThrow('not a file');
    await expect(webmcpTool.execute?.({
      tool: 'read_session_file',
      args: { sessionId: 'session-2', path: '/todo' },
    }, {} as never)).rejects.toThrow('not available');
    await expect(webmcpTool.execute?.({
      tool: 'read_session_file',
      args: { sessionId: 'session-1', path: '/todo' },
    }, {} as never)).resolves.toEqual({ sessionId: 'session-1', path: '/todo', kind: 'file', content: '' });
    await expect(webmcpTool.execute?.({
      tool: 'read_session_file',
      args: { sessionId: 'session-1', path: '/inline.txt' },
    }, {} as never)).resolves.toEqual({ sessionId: 'session-1', path: '/inline.txt', kind: 'file', content: 'inline' });
    await expect(webmcpTool.execute?.({
      tool: 'read_session_folder',
      args: { sessionId: 'session-1', path: '/workspace/logs' },
    }, {} as never)).resolves.toEqual({
      sessionId: 'session-1',
      path: '/workspace/logs',
      kind: 'folder',
      entries: [
        { name: 'archive', path: '/workspace/logs/archive', kind: 'folder' },
        { name: 'a.log', path: '/workspace/logs/a.log', kind: 'file' },
        { name: 'app.log', path: '/workspace/logs/app.log', kind: 'file' },
        { name: 'b.log', path: '/workspace/logs/b.log', kind: 'file' },
      ],
    });

    const unsupportedReaderContext = new ModelContext();
    registerWorkspaceTools(unsupportedReaderContext, {
      workspaceName: 'Research',
      workspaceFiles: [],
      sessionFsEntries: [
        { sessionId: 'session-1', path: '/todo', kind: 'file' },
        { sessionId: 'session-1', path: '/readme', kind: 'file', content: 'hello' },
      ],
    });
    const unsupportedReaderTool = createWebMcpTool(unsupportedReaderContext);
    await expect(unsupportedReaderTool.execute?.({
      tool: 'read_session_file',
      args: { sessionId: 'session-1', path: '/todo' },
    }, {} as never)).rejects.toThrow('not supported');

    await expect(webmcpTool.execute?.({
      tool: 'create_session_folder',
      args: { sessionId: 'session-1', path: '/workspace/tmp' },
    }, {} as never)).resolves.toEqual({ sessionId: 'session-1', path: '/workspace/tmp', kind: 'folder', content: null });
    await expect(webmcpTool.execute?.({
      tool: 'create_session_file',
      args: { path: 'relative.txt' },
    }, {} as never)).resolves.toEqual({ sessionId: '', path: '/relative.txt', kind: 'file', content: '' });
    await expect(webmcpTool.execute?.({
      tool: 'create_session_file',
      args: {},
    }, {} as never)).rejects.toThrow('must not be empty');
    await expect(webmcpTool.execute?.({
      tool: 'create_session_folder',
      args: { path: 'relative-dir' },
    }, {} as never)).resolves.toEqual({ sessionId: '', path: '/relative-dir', kind: 'folder', content: null });
    await expect(webmcpTool.execute?.({
      tool: 'create_session_folder',
      args: {},
    }, {} as never)).rejects.toThrow('must not be empty');
    await expect(webmcpTool.execute?.({
      tool: 'create_session_folder',
      args: { sessionId: 'session-1', path: '   ' },
    }, {} as never)).rejects.toThrow('must not be empty');
    await expect(webmcpTool.execute?.({
      tool: 'create_session_file',
      args: { sessionId: 'session-1', path: '/workspace/tmp.txt' },
    }, {} as never)).resolves.toEqual({ sessionId: 'session-1', path: '/workspace/tmp.txt', kind: 'file', content: '' });
    await expect(webmcpTool.execute?.({
      tool: 'write_session_file',
      args: { sessionId: 'session-1', path: '/workspace/tmp.txt', content: 'updated' },
    }, {} as never)).resolves.toEqual({ sessionId: 'session-1', path: '/workspace/tmp.txt', kind: 'file', content: 'updated' });
    await expect(webmcpTool.execute?.({
      tool: 'write_session_file',
      args: { path: 'relative.txt', content: 'relative update' },
    }, {} as never)).resolves.toEqual({ sessionId: '', path: '/relative.txt', kind: 'file', content: 'relative update' });
    await expect(webmcpTool.execute?.({
      tool: 'write_session_file',
      args: { path: '/workspace/empty.txt' },
    }, {} as never)).resolves.toEqual({ sessionId: '', path: '/workspace/empty.txt', kind: 'file', content: '' });
    await expect(webmcpTool.execute?.({
      tool: 'write_session_file',
      args: { content: 'missing-path' },
    }, {} as never)).rejects.toThrow('must not be empty');
    await expect(webmcpTool.execute?.({
      tool: 'delete_session_filesystem_entry',
      args: { sessionId: 'session-1', path: '/workspace/tmp.txt' },
    }, {} as never)).resolves.toEqual({ sessionId: 'session-1', path: '/workspace/tmp.txt', deleted: true });
    await expect(webmcpTool.execute?.({
      tool: 'delete_session_filesystem_entry',
      args: { path: 'relative.txt' },
    }, {} as never)).resolves.toEqual({ sessionId: '', path: '/relative.txt', deleted: true });
    await expect(webmcpTool.execute?.({
      tool: 'delete_session_filesystem_entry',
      args: {},
    }, {} as never)).rejects.toThrow('must not be empty');
    await expect(webmcpTool.execute?.({
      tool: 'rename_session_filesystem_entry',
      args: { sessionId: 'session-1', path: '/todo', newName: 'done' },
    }, {} as never)).resolves.toEqual({ sessionId: 'session-1', path: '/done', previousPath: '/todo' });
    await expect(webmcpTool.execute?.({
      tool: 'rename_session_filesystem_entry',
      args: { path: 'relative.txt', newPath: 'renamed.txt' },
    }, {} as never)).resolves.toEqual({ sessionId: '', path: '/renamed.txt', previousPath: '/relative.txt' });
    await expect(webmcpTool.execute?.({
      tool: 'rename_session_filesystem_entry',
      args: { sessionId: 'session-1', path: '/', newName: 'root' },
    }, {} as never)).resolves.toEqual({ sessionId: 'session-1', path: '/root', previousPath: '/' });
    await expect(webmcpTool.execute?.({
      tool: 'rename_session_filesystem_entry',
      args: { sessionId: 'session-1', path: '/workspace/logs/app.log', newName: 'renamed.log' },
    }, {} as never)).resolves.toEqual({
      sessionId: 'session-1',
      path: '/workspace/logs/renamed.log',
      previousPath: '/workspace/logs/app.log',
    });
    await expect(webmcpTool.execute?.({
      tool: 'rename_session_filesystem_entry',
      args: { newPath: 'renamed.txt' },
    }, {} as never)).rejects.toThrow('must not be empty');
    await expect(webmcpTool.execute?.({
      tool: 'rename_session_filesystem_entry',
      args: { sessionId: 'session-1', path: '/workspace/logs/app.log' },
    }, {} as never)).rejects.toThrow('requires a newPath or newName');
    await expect(webmcpTool.execute?.({
      tool: 'scaffold_session_filesystem_entry',
      args: { sessionId: 'session-1', basePath: '/workspace' },
    }, {} as never)).rejects.toThrow('requires a template');
    await expect(webmcpTool.execute?.({
      tool: 'scaffold_session_filesystem_entry',
      args: { sessionId: 'session-1', basePath: '/workspace', template: 'skill' },
    }, {} as never)).resolves.toEqual({ sessionId: 'session-1', path: '/workspace/skill', template: 'skill' });
    await expect(webmcpTool.execute?.({
      tool: 'scaffold_session_filesystem_entry',
      args: { basePath: 'templates', template: 'hook' },
    }, {} as never)).resolves.toEqual({ sessionId: '', path: '/templates/hook', template: 'hook' });
    await expect(webmcpTool.execute?.({
      tool: 'scaffold_session_filesystem_entry',
      args: { template: 'hook' },
    }, {} as never)).rejects.toThrow('must not be empty');
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
});
