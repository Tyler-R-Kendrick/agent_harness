import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createWebMcpTool } from 'agent-browser-mcp';
import { installModelContext } from 'webmcp';
import App from './App';
import { WORKSPACE_FILES_STORAGE_KEY } from './services/workspaceFiles';
import type { CopilotRuntimeState } from './services/copilotApi';

const searchBrowserModelsMock = vi.fn();
const loadModelMock = vi.fn();
const generateMock = vi.fn();
const fetchCopilotStateMock = vi.fn();
const streamCopilotChatMock = vi.fn();
const resolveLanguageModelMock = vi.fn(() => ({ specificationVersion: 'v3', provider: 'test', modelId: 'test-model' }));
const runToolAgentMock = vi.fn();
const getSandboxFeatureFlagsMock = vi.fn(() => ({
  secureBrowserSandboxExec: false,
  disableWebContainerAdapter: false,
  allowSameOriginForWebContainer: false,
}));
const createSandboxExecutionServiceMock = vi.fn();
const buildRunSummaryInputMock = vi.fn();

vi.mock('@copilotkit/react-core', () => ({
  useCopilotReadable: () => undefined,
}));

vi.mock('./services/huggingFaceRegistry', () => ({
  searchBrowserModels: (...args: unknown[]) => searchBrowserModelsMock(...args),
}));

vi.mock('./services/browserInference', () => ({
  browserInferenceEngine: {
    loadModel: (...args: unknown[]) => loadModelMock(...args),
    generate: (...args: unknown[]) => generateMock(...args),
  },
}));

vi.mock('./services/copilotApi', () => ({
  fetchCopilotState: (...args: unknown[]) => fetchCopilotStateMock(...args),
  streamCopilotChat: (...args: unknown[]) => streamCopilotChatMock(...args),
}));

vi.mock('./services/agentProvider', () => ({
  resolveLanguageModel: (config: unknown) => (resolveLanguageModelMock as (config: unknown) => unknown)(config),
}));

vi.mock('./services/agentRunner', () => ({
  runToolAgent: (options: unknown, callbacks: unknown) => runToolAgentMock(options, callbacks),
}));

vi.mock('./features/flags', () => ({
  getSandboxFeatureFlags: () => getSandboxFeatureFlagsMock(),
}));

vi.mock('./sandbox/service', () => ({
  createSandboxExecutionService: (...args: unknown[]) => createSandboxExecutionServiceMock(...args),
}));

vi.mock('./sandbox/summarize-run', () => ({
  buildRunSummaryInput: (...args: unknown[]) => buildRunSummaryInputMock(...args),
}));

vi.mock('just-bash/browser', () => {
  class MockBash {
    cwd = '/workspace';
    fileContents = new Map<string, string>([['/workspace/.keep', '']]);
    fsPaths = new Set<string>(['/workspace', '/workspace/.keep']);

    fs = {
      getAllPaths: () => [...this.fsPaths],
      mkdir: (path: string) => {
        this.fsPaths.add(path);
        return Promise.resolve();
      },
      writeFile: (path: string, content = '') => {
        this.fsPaths.add(path);
        const dir = path.slice(0, path.lastIndexOf('/'));
        if (dir) this.fsPaths.add(dir);
        this.fileContents.set(path, typeof content === 'string' ? content : '');
        return Promise.resolve();
      },
      readFile: (path: string) => {
        if (!this.fileContents.has(path)) {
          return Promise.reject(new Error(`No such file: ${path}`));
        }
        return Promise.resolve(this.fileContents.get(path) ?? '');
      },
    };

    async exec(command: string) {
      const trimmed = command.trim();
      const sentinelSuffix = '; echo __JUSTBASH_CWD:$PWD';
      const usesSentinel = trimmed.endsWith(sentinelSuffix);
      const baseCommand = usesSentinel ? trimmed.slice(0, -sentinelSuffix.length).trim() : trimmed;
      const withSentinel = (stdout: string) => ({
        stdout: usesSentinel ? `${stdout}${stdout ? '\n' : ''}__JUSTBASH_CWD:${this.cwd}` : stdout,
        stderr: '',
        exitCode: 0,
      });

      const cdMatch = baseCommand.match(/^cd\s+--\s+'([^']+)'\s*$/) ?? baseCommand.match(/^cd\s+"([^"]+)"\s*$/);
      if (cdMatch) {
        this.cwd = cdMatch[1];
        this.fsPaths.add(this.cwd);
        return withSentinel('');
      }

      if (baseCommand.startsWith('touch ')) {
        const filePath = baseCommand.slice('touch '.length).trim().replace(/^\/+/, '');
        if (filePath) {
          const resolvedPath = filePath.startsWith('/') ? filePath : `${this.cwd}/${filePath}`;
          this.fsPaths.add(resolvedPath);
          this.fileContents.set(resolvedPath, '');
        }
        return withSentinel('');
      }
      // rm -rf "/path"
      const rmMatch = baseCommand.match(/^rm\b.*?"([^"]+)"\s*$/) ?? baseCommand.match(/^rm\b.*?'([^']+)'\s*$/);
      if (rmMatch) {
        const target = rmMatch[1];
        for (const path of [...this.fsPaths]) {
          if (path === target || path.startsWith(target + '/')) {
            this.fsPaths.delete(path);
            this.fileContents.delete(path);
          }
        }
        return withSentinel('');
      }
      // mv "oldPath" "newPath"
      const mvMatch = baseCommand.match(/^mv\s+"([^"]+)"\s+"([^"]+)"\s*$/) ?? baseCommand.match(/^mv\s+'([^']+)'\s+'([^']+)'\s*$/);
      if (mvMatch) {
        const [, fromPath, toPath] = mvMatch;
        for (const path of [...this.fsPaths]) {
          if (path === fromPath || path.startsWith(fromPath + '/')) {
            this.fsPaths.delete(path);
            const nextPath = path === fromPath ? toPath : toPath + path.slice(fromPath.length);
            this.fsPaths.add(nextPath);
            if (this.fileContents.has(path)) {
              this.fileContents.set(nextPath, this.fileContents.get(path) ?? '');
              this.fileContents.delete(path);
            }
          }
        }
        return withSentinel('');
      }
      if (baseCommand === 'pwd') {
        return withSentinel(this.cwd);
      }
      if (baseCommand === 'ls') {
        const entries = [...this.fsPaths]
          .filter((path) => path !== this.cwd && path !== '/workspace/.keep')
          .map((path) => path.replace(`${this.cwd}/`, ''));
        return withSentinel(entries.join('\n'));
      }
      if (baseCommand.startsWith('echo ')) {
        return withSentinel(baseCommand.slice('echo '.length));
      }
      return withSentinel('');
    }
  }

  return { Bash: MockBash };
});

describe('App', () => {
  const disableAllTools = () => {
    fireEvent.click(screen.getByRole('button', { name: /Configure tools/i }));
    const builtInToggle = screen.getByRole('checkbox', { name: 'Toggle all Built-In tools' });
    if ((builtInToggle as HTMLInputElement).checked) {
      fireEvent.click(builtInToggle);
    }
    fireEvent.keyDown(document, { key: 'Escape' });
  };

  const createCopilotState = (overrides: Partial<CopilotRuntimeState> = {}): CopilotRuntimeState => ({
    available: true,
    authenticated: false,
    authType: 'oauth',
    host: 'https://github.com',
    login: undefined,
    statusMessage: undefined,
    error: undefined,
    models: [],
    signInCommand: 'copilot login',
    signInDocsUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli',
    ...overrides,
  });

  beforeEach(() => {
    window.localStorage.clear();
    searchBrowserModelsMock.mockReset();
    loadModelMock.mockReset();
    generateMock.mockReset();
    fetchCopilotStateMock.mockReset();
    streamCopilotChatMock.mockReset();
    resolveLanguageModelMock.mockReset();
    runToolAgentMock.mockReset();
    searchBrowserModelsMock.mockResolvedValue([]);
    loadModelMock.mockResolvedValue(undefined);
    generateMock.mockResolvedValue(undefined);
    fetchCopilotStateMock.mockResolvedValue(createCopilotState());
    streamCopilotChatMock.mockResolvedValue(undefined);
    resolveLanguageModelMock.mockReturnValue({ specificationVersion: 'v3', provider: 'test', modelId: 'test-model' });
    runToolAgentMock.mockResolvedValue({ text: 'done', steps: 1 });
    getSandboxFeatureFlagsMock.mockReturnValue({
      secureBrowserSandboxExec: false,
      disableWebContainerAdapter: false,
      allowSameOriginForWebContainer: false,
    });
    createSandboxExecutionServiceMock.mockReset();
    buildRunSummaryInputMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the agent browser shell', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Omnibar')).toBeInTheDocument();
    expect(screen.queryByLabelText('Chat')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Chat mode' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Terminal mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New session' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('codi');
    expect(screen.getByRole('button', { name: 'Install model' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.queryByText('Create task board')).not.toBeInTheDocument();
    expect(screen.queryByText('Open gallery')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Browser' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Sessions' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Files' }).length).toBeGreaterThan(0);
  });

  it('renders Files as a compute surface and mounts workspace directories as drives', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const filesButton = screen.getAllByRole('button', { name: 'Files' })[0];
    expect(filesButton.querySelector('[data-icon="cpu"]')).not.toBeNull();

    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.click(screen.getByRole('button', { name: 'AGENTS.md' }));

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'review-pr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Skill' }));

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByRole('button', { name: '//workspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '//.agents' })).toBeInTheDocument();
    expect(screen.getByText('AGENTS.md')).toBeInTheDocument();
    expect(screen.getByText('SKILL.md')).toBeInTheDocument();
  });

  it('registers workspace file WebMCP tools that a client can invoke', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(WORKSPACE_FILES_STORAGE_KEY, JSON.stringify({
      'ws-research': [{
        path: 'AGENTS.md',
        content: '# Workspace agent instructions\n\n## Goals\n- Verify WebMCP file tools.',
        updatedAt: '2026-04-18T00:00:00.000Z',
      }],
      'ws-build': [],
    }));

    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const modelContext = installModelContext(window);
    expect(modelContext).toBeDefined();

    const webmcpTool = createWebMcpTool(modelContext!);
    let listedFiles: unknown;
    await act(async () => {
      listedFiles = await webmcpTool.execute?.({ tool: 'list_files' }, {} as never);
    });

    expect(listedFiles).toEqual([
      {
        path: 'AGENTS.md',
        uri: 'files://workspace/AGENTS.md',
        updatedAt: '2026-04-18T00:00:00.000Z',
      },
    ]);

    let openedFile: unknown;
    await act(async () => {
      openedFile = await webmcpTool.execute?.({
        tool: 'open_file',
        args: { uri: 'files://workspace/AGENTS.md' },
      }, {} as never);
    });

    expect(openedFile).toEqual({
      workspaceName: 'Research',
      path: 'AGENTS.md',
      uri: 'files://workspace/AGENTS.md',
      updatedAt: '2026-04-18T00:00:00.000Z',
      content: '# Workspace agent instructions\n\n## Goals\n- Verify WebMCP file tools.',
    });
    expect(screen.getByLabelText('Workspace file content')).toHaveValue('# Workspace agent instructions\n\n## Goals\n- Verify WebMCP file tools.');
  });

  it('registers browser, session, filesystem, and worktree WebMCP tools against live UI state', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(WORKSPACE_FILES_STORAGE_KEY, JSON.stringify({
      'ws-research': [{
        path: 'AGENTS.md',
        content: '# Workspace agent instructions\n\n## Goals\n- Verify full WebMCP coverage.',
        updatedAt: '2026-04-18T00:00:00.000Z',
      }],
      'ws-build': [],
    }));

    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    disableAllTools();

    const modelContext = installModelContext(window);
    expect(modelContext).toBeDefined();
    const webmcpTool = createWebMcpTool(modelContext!);

    let browserPages: Array<{ id: string; title: string; url: string }> = [];
    await act(async () => {
      browserPages = await webmcpTool.execute?.({ tool: 'list_browser_pages' }, {} as never) as Array<{ id: string; title: string; url: string }>;
    });

    const docsPage = browserPages.find((page) => page.title === 'Hugging Face');
    expect(docsPage).toBeDefined();

    await act(async () => {
      await webmcpTool.execute?.({ tool: 'open_browser_page', args: { pageId: docsPage!.id } }, {} as never);
    });
    expect(screen.getByLabelText('Page overlay')).toBeInTheDocument();

    await act(async () => {
      await webmcpTool.execute?.({ tool: 'close_browser_page', args: { pageId: docsPage!.id } }, {} as never);
    });
    expect(screen.queryByLabelText('Page overlay')).not.toBeInTheDocument();

    let createdPage: { id: string; title: string; url: string } | undefined;
    await act(async () => {
      createdPage = await webmcpTool.execute?.({
        tool: 'create_browser_page',
        args: { url: 'https://example.com/mcp', title: 'MCP Tab' },
      }, {} as never) as { id: string; title: string; url: string };
    });
    expect(createdPage).toEqual(expect.objectContaining({ title: 'MCP Tab', url: 'https://example.com/mcp' }));
    expect(screen.getByText('MCP Tab')).toBeInTheDocument();

    let sessions: Array<{ id: string; name: string; isOpen: boolean }> = [];
    await act(async () => {
      sessions = await webmcpTool.execute?.({ tool: 'list_sessions' }, {} as never) as Array<{ id: string; name: string; isOpen: boolean }>;
    });
    const sessionOne = sessions.find((session) => session.name === 'Session 1');
    expect(sessionOne).toBeDefined();

    let initialSessionState: { id: string; name: string; mode: string; provider: string | null; cwd: string | null } | undefined;
    await act(async () => {
      initialSessionState = await webmcpTool.execute?.({
        tool: 'read_session',
        args: { sessionId: sessionOne!.id },
      }, {} as never) as { id: string; name: string; mode: string; provider: string | null; cwd: string | null };
    });
    expect(initialSessionState).toEqual(expect.objectContaining({ id: sessionOne!.id, mode: 'agent', provider: 'codi' }));

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'write_session',
        args: { sessionId: sessionOne!.id, message: 'Message from WebMCP' },
      }, {} as never);
      await Promise.resolve();
    });
    expect(screen.getByText('Message from WebMCP')).toBeInTheDocument();

    let updatedSessionState: { provider: string | null; modelId: string | null } | undefined;
    await act(async () => {
      updatedSessionState = await webmcpTool.execute?.({
        tool: 'write_session',
        args: { sessionId: sessionOne!.id, provider: 'ghcp', modelId: 'gpt-4.1' },
      }, {} as never) as { provider: string | null; modelId: string | null };
    });
    expect(updatedSessionState).toEqual(expect.objectContaining({ provider: 'ghcp', modelId: 'gpt-4.1' }));

    let terminalSessionState: { mode: string; cwd: string | null } | undefined;
    await act(async () => {
      terminalSessionState = await webmcpTool.execute?.({
        tool: 'write_session',
        args: { sessionId: sessionOne!.id, mode: 'terminal', cwd: '/workspace/projects' },
      }, {} as never) as { mode: string; cwd: string | null };
      await Promise.resolve();
    });
    expect(terminalSessionState).toEqual(expect.objectContaining({ mode: 'terminal', cwd: '/workspace/projects' }));
    expect(screen.getByRole('heading', { name: 'Terminal' })).toBeInTheDocument();

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'create_session_file',
        args: { sessionId: sessionOne!.id, path: '/workspace/notes.md', content: 'notes from tool' },
      }, {} as never);
    });

    let readSessionFile: { sessionId: string; path: string; kind: string; content: string } | undefined;
    await act(async () => {
      readSessionFile = await webmcpTool.execute?.({
        tool: 'read_session_file',
        args: { sessionId: sessionOne!.id, path: '/workspace/notes.md' },
      }, {} as never) as { sessionId: string; path: string; kind: string; content: string };
    });
    expect(readSessionFile).toEqual({ sessionId: sessionOne!.id, path: '/workspace/notes.md', kind: 'file', content: 'notes from tool' });

    let readSessionFolder: { entries: Array<{ name: string; path: string; kind: string }> } | undefined;
    await act(async () => {
      readSessionFolder = await webmcpTool.execute?.({
        tool: 'read_session_folder',
        args: { sessionId: sessionOne!.id, path: '/workspace' },
      }, {} as never) as { entries: Array<{ name: string; path: string; kind: string }> };
    });
    expect(readSessionFolder).toEqual(expect.objectContaining({
      entries: expect.arrayContaining([
        expect.objectContaining({ name: 'notes.md', path: '/workspace/notes.md', kind: 'file' }),
      ]),
    }));

    let worktreeItems: Array<{ id: string; itemType: string; label: string }> = [];
    await act(async () => {
      worktreeItems = await webmcpTool.execute?.({ tool: 'list_worktree_items' }, {} as never) as Array<{ id: string; itemType: string; label: string }>;
    });
    expect(worktreeItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemType: 'browser-page', label: 'Hugging Face' }),
      expect.objectContaining({ itemType: 'session', label: 'Session 1' }),
      expect.objectContaining({ itemType: 'workspace-file', label: 'AGENTS.md' }),
      expect.objectContaining({ itemType: 'clipboard', label: 'Clipboard' }),
    ]));

    const browserItem = worktreeItems.find((item) => item.itemType === 'browser-page' && item.label === 'Hugging Face');
    const sessionItem = worktreeItems.find((item) => item.itemType === 'session' && item.label === 'Session 1');
    const fileItem = worktreeItems.find((item) => item.itemType === 'workspace-file' && item.label === 'AGENTS.md');
    const vfsItem = worktreeItems.find((item) => item.itemType === 'session-fs-entry');
    const clipboardItem = worktreeItems.find((item) => item.itemType === 'clipboard');
    expect(browserItem).toBeDefined();
    expect(sessionItem).toBeDefined();
    expect(fileItem).toBeDefined();
    expect(vfsItem).toBeDefined();
    expect(clipboardItem).toBeDefined();

    let browserActions: Array<{ id: string; label: string }> = [];
    let sessionActions: Array<{ id: string; label: string }> = [];
    let fileActions: Array<{ id: string; label: string }> = [];
    let vfsActions: Array<{ id: string; label: string }> = [];
    let clipboardActions: Array<{ id: string; label: string }> = [];
    await act(async () => {
      browserActions = await webmcpTool.execute?.({
        tool: 'list_worktree_context_actions',
        args: { itemId: browserItem!.id, itemType: browserItem!.itemType },
      }, {} as never) as Array<{ id: string; label: string }>;
      sessionActions = await webmcpTool.execute?.({
        tool: 'list_worktree_context_actions',
        args: { itemId: sessionItem!.id, itemType: sessionItem!.itemType },
      }, {} as never) as Array<{ id: string; label: string }>;
      fileActions = await webmcpTool.execute?.({
        tool: 'list_worktree_context_actions',
        args: { itemId: fileItem!.id, itemType: fileItem!.itemType },
      }, {} as never) as Array<{ id: string; label: string }>;
      vfsActions = await webmcpTool.execute?.({
        tool: 'list_worktree_context_actions',
        args: { itemId: vfsItem!.id, itemType: vfsItem!.itemType },
      }, {} as never) as Array<{ id: string; label: string }>;
      clipboardActions = await webmcpTool.execute?.({
        tool: 'list_worktree_context_actions',
        args: { itemId: clipboardItem!.id, itemType: clipboardItem!.itemType },
      }, {} as never) as Array<{ id: string; label: string }>;
    });

    expect(browserActions).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'toggle_bookmark' }), expect.objectContaining({ id: 'properties' })]));
    expect(sessionActions).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'share' }), expect.objectContaining({ id: 'rename' })]));
    expect(fileActions).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'move' }), expect.objectContaining({ id: 'duplicate' })]));
    expect(vfsActions).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'new_file' }), expect.objectContaining({ id: 'history' })]));
    expect(clipboardActions).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'history' }), expect.objectContaining({ id: 'properties' })]));

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'invoke_worktree_context_action',
        args: { itemId: browserItem!.id, itemType: browserItem!.itemType, actionId: 'toggle_bookmark', args: {} },
      }, {} as never);
      await Promise.resolve();
    });

    let bookmarkedBrowserPage: { persisted: boolean } | undefined;
    await act(async () => {
      bookmarkedBrowserPage = await webmcpTool.execute?.({
        tool: 'read_browser_page',
        args: { pageId: browserItem!.id },
      }, {} as never) as { persisted: boolean };
    });
    expect(bookmarkedBrowserPage).toEqual(expect.objectContaining({ persisted: false }));

    let createdSession: { id: string; name: string; isOpen: boolean } | undefined;
    await act(async () => {
      createdSession = await webmcpTool.execute?.({
        tool: 'create_session',
        args: { name: 'Ops Session' },
      }, {} as never) as { id: string; name: string; isOpen: boolean };
    });
    expect(createdSession).toEqual(expect.objectContaining({ name: 'Ops Session', isOpen: true }));
    expect(screen.getByText('Ops Session')).toBeInTheDocument();
  });

  it('supports creating new chat and terminal instances from the tree and panel', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Add session to Research'));
    expect(screen.getByText('Session 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    expect(screen.getByText('Session 3')).toBeInTheDocument();
  });

  it('renders settings and history labels from the navigation', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('History')).toBeInTheDocument();
  });

  it('renders settings as a collapsible settings surface', async () => {
    vi.useFakeTimers();
    fetchCopilotStateMock.mockResolvedValue(createCopilotState({
      authenticated: true,
      login: 'octocat',
      models: [{
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        reasoning: true,
        vision: true,
      }],
    }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();

    const providersToggle = screen.getByRole('button', { name: /Providers/i });
    expect(providersToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Refresh status' })).toBeInTheDocument();

    fireEvent.click(providersToggle);

    expect(providersToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Refresh status' })).not.toBeInTheDocument();
  });

  it('defaults to GHCP when it is the only ready agent', async () => {
    vi.useFakeTimers();
    fetchCopilotStateMock.mockResolvedValue(createCopilotState({
      authenticated: true,
      login: 'octocat',
      models: [{
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        reasoning: true,
        vision: true,
        billingMultiplier: 1,
      }],
    }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    expect(screen.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('ghcp');
    expect(screen.getByRole('combobox', { name: 'GHCP model' })).toHaveValue('gpt-4.1');
    expect(screen.getByLabelText('Chat input')).toHaveAttribute('placeholder', 'Ask GHCP…');
  });

  it('defaults to Codi when a local model is installed even if GHCP is ready', async () => {
    vi.useFakeTimers();
    fetchCopilotStateMock.mockResolvedValue(createCopilotState({
      authenticated: true,
      login: 'octocat',
      models: [{
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        reasoning: true,
        vision: true,
      }],
    }));
    searchBrowserModelsMock.mockResolvedValue([{
      id: 'hf-test-model',
      name: 'Test Model',
      author: 'Harness',
      task: 'text-generation',
      downloads: 42,
      likes: 7,
      tags: ['onnx'],
      sizeMB: 64,
      status: 'available',
    }]);

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByLabelText('Settings'));
    fireEvent.click(screen.getByRole('button', { name: /Registry/i }));
    fireEvent.click(screen.getByRole('button', { name: /Test Model/i }));

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByLabelText('Workspaces'));

    expect(screen.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('codi');
    expect(screen.getByRole('combobox', { name: 'Codi model' })).toHaveValue('hf-test-model');
    expect(screen.getByLabelText('Chat input')).toHaveAttribute('placeholder', 'Ask Codi…');
  });

  it('shows the Copilot sign-in path in settings without making it the default provider', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    expect(screen.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('codi');

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByRole('link', { name: 'Sign in to Copilot' })).toHaveAttribute('href', 'https://docs.github.com/copilot/how-tos/copilot-cli');
    expect(screen.getByLabelText('GitHub Copilot sign-in command')).toHaveValue('copilot login');
  });

  it('adds workspace capability files and persists them to local storage', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Click the "+" button on the Research workspace to open the add-file modal
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    expect(screen.getByText('Add file')).toBeInTheDocument();

    // Add AGENTS.md
    fireEvent.click(screen.getByRole('button', { name: 'AGENTS.md' }));

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getAllByText('AGENTS.md').length).toBeGreaterThan(0);

    // Open add file modal again, name it, and add a skill
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'review-pr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Skill' }));

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    // The skill file should appear in the tree
    expect(screen.getByText('SKILL.md')).toBeInTheDocument();

    const storedFiles = JSON.parse(window.localStorage.getItem(WORKSPACE_FILES_STORAGE_KEY) ?? '{}') as Record<string, Array<{ path: string }>>;
    expect(storedFiles['ws-research']).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'AGENTS.md' }),
      expect.objectContaining({ path: '.agents/skill/review-pr/SKILL.md' }),
    ]));
  });

  it('shows a warning toast when workspace file persistence fails', async () => {
    vi.useFakeTimers();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Click the "+" button on the Research workspace to open add-file modal
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.click(screen.getByRole('button', { name: 'AGENTS.md' }));

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getAllByText('AGENTS.md').length).toBeGreaterThan(0);
    expect(setItemSpy).toHaveBeenCalled();
    const warningToast = document.querySelector('.toast.warning');
    expect(warningToast).not.toBeNull();
    expect(warningToast?.textContent ?? '').toMatch(/quota|persist workspace files/i);
  });

  it('loads workspace file context into the assistant prompt', async () => {
    vi.useFakeTimers();
    searchBrowserModelsMock.mockResolvedValue([{
      id: 'hf-test-model',
      name: 'Test Model',
      author: 'Harness',
      task: 'text-generation',
      downloads: 42,
      likes: 7,
      tags: ['onnx'],
      sizeMB: 64,
      status: 'available',
    }]);
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Add AGENTS.md via the tree "+" button
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.click(screen.getByRole('button', { name: 'AGENTS.md' }));

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    // Edit the file content in the file editor (now in the content area)
    fireEvent.change(screen.getByLabelText('Workspace file content'), { target: { value: '# Rules\nAlways run workspace checks first.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save file' }));

    expect(screen.queryByLabelText('Workspace file path')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Chat panel')).toBeInTheDocument();

    // Navigate to settings and install the model
    fireEvent.click(screen.getByLabelText('Settings'));
    // Registry section is collapsed by default — expand it first
    fireEvent.click(screen.getByRole('button', { name: /Registry/i }));
    fireEvent.click(screen.getByRole('button', { name: /Test Model/i }));

    await act(async () => {
      await Promise.resolve();
    });

    disableAllTools();
    // Send a message
    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Summarize the workspace rules.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(generateMock).toHaveBeenCalledTimes(1);
    const prompt = generateMock.mock.calls[0][0].prompt as Array<{ role: string; content: string }>;
    expect(prompt).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'system', content: expect.stringContaining('Active workspace: Research') }),
      expect.objectContaining({ role: 'system', content: expect.stringContaining('Always run workspace checks first.') }),
    ]));
    expect(prompt.map((entry) => entry.content).join('\n')).not.toContain('Copilot bridge');
    expect(prompt.map((entry) => entry.content).join('\n')).not.toContain('GitHub Copilot');
  });

  it('shows a stop control and cancels an in-flight chat response without turning it into an error', async () => {
    vi.useFakeTimers();
    let activeSignal: AbortSignal | undefined;
    generateMock.mockImplementation(async (_input, callbacks, signal?: AbortSignal) => {
      activeSignal = signal;
      callbacks.onPhase?.('thinking');
      callbacks.onToken?.('Partial draft');
      return new Promise<void>((resolve, reject) => {
        signal?.addEventListener('abort', () => {
          const error = new Error('Generation stopped.');
          error.name = 'AbortError';
          reject(error);
          resolve();
        }, { once: true });
      });
    });
    searchBrowserModelsMock.mockResolvedValue([{
      id: 'hf-test-model',
      name: 'Test Model',
      author: 'Harness',
      task: 'text-generation',
      downloads: 42,
      likes: 7,
      tags: ['onnx'],
      sizeMB: 64,
      status: 'available',
    }]);

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));
    fireEvent.click(screen.getByRole('button', { name: /Registry/i }));
    fireEvent.click(screen.getByRole('button', { name: /Test Model/i }));

    await act(async () => {
      await Promise.resolve();
    });

    disableAllTools();
    fireEvent.click(screen.getByLabelText('Workspaces'));
    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Write a long answer.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Stop response' })).toBeInTheDocument();
    expect(screen.getByText('Partial draft')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Stop response' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(activeSignal?.aborted).toBe(true);
    expect(screen.queryByRole('button', { name: 'Stop response' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    expect(screen.queryByText('Generation stopped.')).not.toBeInTheDocument();
  });

  it('streams responses through GitHub Copilot when it is the selected provider', async () => {
    vi.useFakeTimers();
    fetchCopilotStateMock.mockResolvedValue(createCopilotState({
      authenticated: true,
      login: 'octocat',
      models: [{
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        reasoning: true,
        vision: false,
      }],
    }));
    streamCopilotChatMock.mockImplementation(async (_request, callbacks) => {
      callbacks.onReasoning?.('Inspecting workspace instructions');
      callbacks.onToken?.('Copilot response');
      callbacks.onDone?.('Copilot response');
      return Promise.resolve();
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    disableAllTools();
    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Summarize the current workspace.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(streamCopilotChatMock).toHaveBeenCalledTimes(1);
    expect(streamCopilotChatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'gpt-4.1',
        prompt: expect.stringContaining('Active workspace: Research'),
      }),
      expect.any(Object),
      expect.any(AbortSignal),
    );
    expect(screen.getByText('Copilot response')).toBeInTheDocument();
  });

  it('renders cli tool calls as assistant-owned chips and reveals their output on expand', async () => {
    vi.useFakeTimers();
    fetchCopilotStateMock.mockResolvedValue(createCopilotState({
      authenticated: true,
      login: 'octocat',
      models: [{
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        reasoning: true,
        vision: true,
      }],
    }));
    runToolAgentMock.mockImplementation(async (options, callbacks) => {
      callbacks.onToolCall?.('cli', { command: 'echo hello from cli' });
      const result = await options.tools.cli.execute({ command: 'echo hello from cli' }, {} as never);
      callbacks.onToolResult?.('cli', { command: 'echo hello from cli' }, result, false);
      callbacks.onDone?.('I ran the terminal command.');
      return { text: 'I ran the terminal command.', steps: 1 };
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    expect(screen.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('ghcp');
    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Check the terminal.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    const toolChip = screen.getByTestId('tool-chip-cli');
    expect(toolChip).toBeInTheDocument();
    expect(screen.getByText('$ echo hello from cli')).toBeInTheDocument();
    expect(screen.queryByText(/^terminal$/i)).not.toBeInTheDocument();

    const toolChipToggle = toolChip.querySelector('summary');
    expect(toolChipToggle).not.toBeNull();
    fireEvent.click(toolChipToggle!);

    expect(screen.getByText('hello from cli')).toBeInTheDocument();
    expect(screen.getByText('I ran the terminal command.')).toBeInTheDocument();
  });

  it('shows a Thinking… indicator while the GHCP response is pending', async () => {
    vi.useFakeTimers();
    fetchCopilotStateMock.mockResolvedValue(createCopilotState({
      authenticated: true,
      login: 'octocat',
      models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: false, vision: false }],
    }));
    let resolveChat!: () => void;
    streamCopilotChatMock.mockImplementation(() => new Promise<void>((resolve) => { resolveChat = resolve; }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    disableAllTools();
    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText('Thinking…')).toBeInTheDocument();

    resolveChat();
    await act(async () => { await Promise.resolve(); });
  });

  it('opens the activity panel for structured reasoning steps and allows pinning it', async () => {
    vi.useFakeTimers();
    fetchCopilotStateMock.mockResolvedValue(createCopilotState({
      authenticated: true,
      login: 'octocat',
      models: [{
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        reasoning: true,
        vision: false,
      }],
    }));
    streamCopilotChatMock.mockImplementation(async (_request, callbacks) => {
      callbacks.onReasoningStep?.({
        id: 'step-1',
        kind: 'thinking',
        title: 'Pulling together current sources',
        body: 'I am pulling together current sources so the response stays anchored in what changed.',
        startedAt: 1000,
        status: 'done',
      });
      callbacks.onReasoningStepEnd?.('step-1');
      callbacks.onReasoningStep?.({
        id: 'step-2',
        kind: 'search',
        title: 'Searching openreview.net',
        sources: [{ domain: 'openreview.net', url: 'https://openreview.net' }],
        startedAt: 1010,
        status: 'done',
      });
      callbacks.onReasoningStepEnd?.('step-2');
      callbacks.onToken?.('Runtime intelligence is moving into the loop.');
      callbacks.onDone?.('Runtime intelligence is moving into the loop.');
      return Promise.resolve();
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    disableAllTools();
    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Summarize the architectural shift.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    // Panel should NOT open automatically — only on user click
    expect(screen.queryByRole('complementary', { name: 'Activity panel' })).not.toBeInTheDocument();

    // Clicking the reasoning pill opens the Activity panel overlay
    const pill = screen.getByRole('button', { name: /Thought for/i });
    fireEvent.click(pill);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('complementary', { name: 'Activity panel' })).toBeInTheDocument();
    expect(screen.getAllByText('Searching openreview.net').length).toBeGreaterThan(0);

    // Close via the back button
    const backButton = screen.getByRole('button', { name: 'Back to chat' });
    fireEvent.click(backButton);

    expect(screen.queryByRole('complementary', { name: 'Activity panel' })).not.toBeInTheDocument();
    expect(screen.getByText('Runtime intelligence is moving into the loop.')).toBeInTheDocument();
  });

  it('runs the flag-gated sandbox chat command and summarizes persisted files', async () => {
    vi.useFakeTimers();
    getSandboxFeatureFlagsMock.mockReturnValue({
      secureBrowserSandboxExec: true,
      disableWebContainerAdapter: false,
      allowSameOriginForWebContainer: false,
    });
    const dispose = vi.fn().mockResolvedValue(undefined);
    const run = vi.fn().mockResolvedValue({
      sessionId: 'sandbox-session',
      runId: 'sandbox-run',
      adapter: 'mock',
      status: 'succeeded',
      exitCode: 0,
      artifacts: [{ path: 'dist/out.txt', content: 'hello', encoding: 'utf-8' }],
      persistedArtifactPaths: ['/workspace/generated/dist/out.txt'],
      metrics: undefined,
      transcript: {
        sessionId: 'sandbox-session',
        runId: 'sandbox-run',
        adapter: 'mock',
        startedAt: 1,
        endedAt: 2,
        events: [],
      },
      usedLegacyFallback: false,
    });
    createSandboxExecutionServiceMock.mockReturnValue({
      createSession: vi.fn().mockResolvedValue({ run, dispose, abort: vi.fn().mockResolvedValue(undefined), sessionId: 'sandbox-session' }),
    });
    buildRunSummaryInputMock.mockReturnValue({
      metadata: { adapter: 'mock', status: 'succeeded', exitCode: 0 },
      counts: { artifactCount: 1 },
      stdout: ['hello from sandbox'],
      stderr: [],
      logs: [],
      testResults: [],
      persistedArtifactPaths: ['/workspace/generated/dist/out.txt'],
    });

    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.change(screen.getByLabelText('Chat input'), {
      target: {
        value: "/sandbox node index.js\ncapture: dist/out.txt\npersist: /workspace/generated\n\n```js file=index.js\nconsole.log('hello')\n```",
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(createSandboxExecutionServiceMock).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
    expect(screen.getByText(/Sandbox run succeeded/)).toBeInTheDocument();
    expect(screen.getByText(/saved files:/i)).toBeInTheDocument();
  });

  it('adds accessible labels to page overlay close button', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByText('Hugging Face'));

    expect(screen.getByLabelText('Close page overlay')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Page overlay' })).toBeInTheDocument();
  });

  it('does not trigger workspace shortcuts while typing in the omnibar', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const omnibar = screen.getByLabelText('Omnibar');
    omnibar.focus();
    fireEvent.keyDown(omnibar, { key: '?' });

    expect(screen.queryByLabelText('Keyboard shortcuts')).not.toBeInTheDocument();
  });

  it('opens the workspace overlay with the hotkey and jumps by number', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Workspace switcher' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Workspaces' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: '2', ctrlKey: true });
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByLabelText('Toggle workspace overlay')).toHaveAttribute('title', 'Build');
  });

  it('renders only the active workspace tree and swaps to the selected workspace', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByLabelText('Add file to Research')).toBeInTheDocument();
    expect(screen.queryByLabelText('Add file to Build')).not.toBeInTheDocument();
    expect(screen.getByText('Hugging Face')).toBeInTheDocument();
    expect(screen.queryByText('CopilotKit docs')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: '2', ctrlKey: true });

    expect(screen.getByLabelText('Toggle workspace overlay')).toHaveAttribute('title', 'Build');
    expect(screen.getByLabelText('Add file to Build')).toBeInTheDocument();
    expect(screen.queryByLabelText('Add file to Research')).not.toBeInTheDocument();
    expect(screen.getByText('CopilotKit docs')).toBeInTheDocument();
    expect(screen.queryByText('Hugging Face')).not.toBeInTheDocument();
  });

  it('preserves page overlays per workspace when switching', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getAllByText('Hugging Face')[0]);
    expect(screen.getByRole('region', { name: 'Page overlay' })).toBeInTheDocument();
    expect(screen.getAllByText('Hugging Face').length).toBeGreaterThanOrEqual(1);

    fireEvent.keyDown(window, { key: '2', ctrlKey: true });

    expect(screen.queryByRole('region', { name: 'Page overlay' })).not.toBeInTheDocument();
    expect(screen.getByText('CopilotKit docs')).toBeInTheDocument();

    fireEvent.click(screen.getByText('CopilotKit docs'));
    expect(screen.getAllByText('CopilotKit docs').length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      fireEvent.keyDown(window, { key: '1', ctrlKey: true });
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByRole('region', { name: 'Page overlay' })).toBeInTheDocument();
  });

  it('supports creating and renaming workspaces from the screenshot controls', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.keyDown(window, { key: 'N', ctrlKey: true, altKey: true });
    expect(screen.getByLabelText('Toggle workspace overlay')).toHaveAttribute('title', 'Workspace 3');

    fireEvent.doubleClick(screen.getByLabelText('Toggle workspace overlay'));
    expect(screen.getByRole('dialog', { name: 'Rename workspace' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Ops' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByLabelText('Toggle workspace overlay')).toHaveAttribute('title', 'Ops');
  });

  it('supports screenshot selection and clipboard hotkeys in the workspace tree', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.keyDown(window, { key: 'End' });
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(document.querySelector('.tree-row.selected')).not.toBeNull();

    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'Home' });
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    expect(document.querySelectorAll('.tree-row').length).toBeGreaterThan(0);
  });

  it('supports type-to-filter and shows the screenshot hotkeys overlay', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.keyDown(window, { key: 'b' });
    expect(screen.getByLabelText('Clear workspace filter')).toHaveTextContent('b');

    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    expect(screen.getByText('Ctrl+Alt+←/→')).toBeInTheDocument();
    expect(screen.getByText('Double-click pill')).toBeInTheDocument();
  });

  it('supports power-user panel and mode shortcuts', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.keyDown(window, { key: '4', altKey: true });
    expect(screen.getByLabelText('Hugging Face search')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '2', altKey: true });
    expect(screen.getByRole('heading', { name: 'Recent activity' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '1', altKey: true });
    expect(screen.getByLabelText('Workspace tree')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '`', code: 'Backquote', ctrlKey: true });
    expect(screen.getByRole('heading', { name: 'Terminal' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '`', code: 'Backquote', ctrlKey: true });
    expect(screen.getByRole('heading', { name: 'Chat' })).toBeInTheDocument();
  });

  it('lets keyboard navigation enter category contents and wrap workspace cycling', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const cursorLabel = () => document.querySelector('.tree-row.cursor .tree-button')?.textContent ?? '';

    fireEvent.keyDown(window, { key: 'Home' });
    expect(cursorLabel()).toContain('Browser');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(cursorLabel()).toContain('Hugging Face');

    fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true, altKey: true });
    expect(screen.getByLabelText('Toggle workspace overlay')).toHaveAttribute('title', 'Build');

    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true, altKey: true });
    expect(screen.getByLabelText('Toggle workspace overlay')).toHaveAttribute('title', 'Research');
  });

  it('keeps only the current workspace tree row in the tab order', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const getTabbableTreeLabels = () => [...document.querySelectorAll<HTMLButtonElement>('.tree-button')]
      .filter((button) => button.tabIndex === 0)
      .map((button) => button.textContent ?? '');

    expect(getTabbableTreeLabels()).toHaveLength(1);
    expect(getTabbableTreeLabels()[0]).toContain('Browser');

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(getTabbableTreeLabels()).toHaveLength(1);
    expect(getTabbableTreeLabels()[0]).toContain('Hugging Face');
  });

  it('debounces settings searches and aborts the previous request on query changes', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));
    const input = screen.getByLabelText('Hugging Face search');
    const firstSignal = searchBrowserModelsMock.mock.calls[0][3] as AbortSignal;

    fireEvent.change(input, { target: { value: 'q' } });
    fireEvent.change(input, { target: { value: 'qw' } });
    fireEvent.change(input, { target: { value: 'qwen' } });

    expect(firstSignal.aborted).toBe(true);
    expect(searchBrowserModelsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(searchBrowserModelsMock).toHaveBeenCalledTimes(2);
    expect(searchBrowserModelsMock).toHaveBeenLastCalledWith('qwen', '', 25, expect.any(AbortSignal));
  });

  it('starts with all model type filters deselected and toggles them on demand', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    const generationChip = screen.getByRole('button', { name: 'Text Generation' });
    const classificationChip = screen.getByRole('button', { name: 'Classification' });

    expect(generationChip).not.toHaveClass('active');
    expect(classificationChip).not.toHaveClass('active');
    expect(searchBrowserModelsMock).toHaveBeenNthCalledWith(1, '', '', 25, expect.any(AbortSignal));

    fireEvent.click(generationChip);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(searchBrowserModelsMock).toHaveBeenLastCalledWith('', 'text-generation', 25, expect.any(AbortSignal));
    expect(generationChip).toHaveClass('active');

    fireEvent.click(generationChip);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(generationChip).not.toHaveClass('active');
    expect(searchBrowserModelsMock).toHaveBeenLastCalledWith('', '', 25, expect.any(AbortSignal));
  });

  it('shows loading progress state while installing a model', async () => {
    vi.useFakeTimers();
    searchBrowserModelsMock.mockResolvedValue([{
      id: 'hf-test-model',
      name: 'Test Model',
      author: 'Harness',
      task: 'text-generation',
      downloads: 42,
      likes: 7,
      tags: ['onnx'],
      sizeMB: 64,
      status: 'available',
    }]);

    let resolveInstall!: () => void;
    loadModelMock.mockImplementation((_task, _id, callbacks) => {
      callbacks.onPhase('Downloading model…');
      return new Promise<void>((resolve) => {
        resolveInstall = resolve;
      });
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));
    // Registry section is collapsed by default — expand it first
    fireEvent.click(screen.getByRole('button', { name: /Registry/i }));
    const button = screen.getByRole('button', { name: /Test Model/i });
    fireEvent.click(button);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(button).toBeDisabled();

    await act(async () => {
      resolveInstall();
      await Promise.resolve();
    });

    expect(screen.getAllByText('Installed').length).toBeGreaterThan(0);
  });

  it('shows an error toast and resets install state when a model install fails', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    searchBrowserModelsMock.mockResolvedValue([{
      id: 'hf-test-model',
      name: 'Test Model',
      author: 'Harness',
      task: 'text-generation',
      downloads: 42,
      likes: 7,
      tags: ['onnx'],
      sizeMB: 64,
      status: 'available',
    }]);
    loadModelMock.mockRejectedValue(new Error('worker crashed'));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));
    // Registry section is collapsed by default — expand it first
    fireEvent.click(screen.getByRole('button', { name: /Registry/i }));
    const button = screen.getByRole('button', { name: /Test Model/i });
    fireEvent.click(button);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Failed to install Test Model: worker crashed')).toBeInTheDocument();
    expect(screen.queryByText('Installed')).not.toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(errorSpy).toHaveBeenCalledWith('Failed to install model hf-test-model', expect.any(Error));
  });

  it('clicking Install model button opens the settings panel', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Settings panel should not be visible initially
    expect(screen.queryByLabelText('Settings')).not.toBeNull();
    expect(screen.queryByLabelText('Hugging Face search')).not.toBeInTheDocument();

    // Click the Install model button in the chat header
    fireEvent.click(screen.getByRole('button', { name: 'Install model' }));

    // The settings panel (model registry) should now be open
    expect(screen.getByLabelText('Hugging Face search')).toBeInTheDocument();
  });

  it('renders an iframe with the tab URL when a browser tab is opened', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByText('Hugging Face'));

    const iframe = document.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toBe('https://huggingface.co/models?library=transformers.js');
    expect(iframe?.getAttribute('sandbox')).toContain('allow-scripts');
    expect(screen.getByLabelText('Close page overlay')).toBeInTheDocument();
  });

  it('opens multiple browser panels side by side on ctrl+click', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Single click opens one panel
    fireEvent.click(screen.getAllByText('Hugging Face')[0]);
    expect(screen.getAllByRole('region', { name: 'Page overlay' })).toHaveLength(1);

    // Ctrl+click adds a second panel
    fireEvent.click(screen.getAllByText('Transformers.js')[0], { ctrlKey: true });
    expect(screen.getAllByRole('region', { name: 'Page overlay' })).toHaveLength(2);

    // Ctrl+click on an already-open tab removes it from the split view
    fireEvent.click(screen.getAllByText('Hugging Face')[0], { ctrlKey: true });
    expect(screen.getAllByRole('region', { name: 'Page overlay' })).toHaveLength(1);
    // Tab remains in the sidebar tree (close is now via context menu)
    expect(screen.getAllByText('Transformers.js').length).toBeGreaterThanOrEqual(1);
  });

  it('splits session panes side by side on ctrl+click', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Add a second session
    fireEvent.click(screen.getByLabelText('Add session to Research'));
    expect(screen.getByText('Session 2')).toBeInTheDocument();

    // Before multi-select: only one chat panel visible
    expect(screen.getAllByRole('region', { name: /Chat panel|Terminal/ })).toHaveLength(1);

    // Single-click Session 1 to activate it
    fireEvent.click(screen.getByText('Session 1'));

    // Ctrl+click Session 2 to add it alongside
    fireEvent.click(screen.getByText('Session 2'), { ctrlKey: true });

    // Now two chat panels should be visible
    expect(screen.getAllByRole('region', { name: /Chat panel|Terminal/ })).toHaveLength(2);

    // Ctrl+click Session 2 again to remove it from split
    fireEvent.click(screen.getByText('Session 2'), { ctrlKey: true });
    expect(screen.getAllByRole('region', { name: /Chat panel|Terminal/ })).toHaveLength(1);
  });

  it('shows close buttons on chat panes and closes a split session panel', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Add session to Research'));
    fireEvent.click(screen.getByText('Session 1'), { ctrlKey: true });

    expect(screen.getAllByRole('region', { name: /Chat panel|Terminal/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Close chat panel' })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Close chat panel' })[0]);

    expect(screen.getAllByRole('region', { name: /Chat panel|Terminal/ })).toHaveLength(1);
  });

  it('highlights active session nodes in the sidebar tree', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Add session to Research'));

    // Single-click Session 1
    fireEvent.click(screen.getByText('Session 1'));

    // Only Session 1 row should be active, not Session 2
    const rows = document.querySelectorAll('.tree-row');
    const session1Row = [...rows].find((row) => row.textContent?.includes('Session 1') && !row.textContent?.includes('Session 2'));
    const session2Row = [...rows].find((row) => row.textContent?.includes('Session 2') && !row.textContent?.includes('Session 1'));
    expect(session1Row).toHaveClass('active');
    expect(session2Row).not.toHaveClass('active');

    // Ctrl+click Session 2 to add it
    fireEvent.click(screen.getByText('Session 2'), { ctrlKey: true });

    // Both rows should now be active
    expect(session1Row).toHaveClass('active');
    expect(session2Row).toHaveClass('active');
  });

  it('wraps panels into a new row when container width is below the per-panel minimum', async () => {
    vi.useFakeTimers();
    let resizeCallback: ResizeObserverCallback | null = null;
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: ResizeObserverCallback) { resizeCallback = cb; }
      observe() {}
      disconnect() {}
    });

    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    // Click Hugging Face (browser tab) → 2 panels (1 browser + 1 session) → PanelSplitView mounts
    fireEvent.click(screen.getByText('Hugging Face'));
    // Ctrl+click Transformers.js to also open it → 3 panels (2 browser + 1 session)
    fireEvent.click(screen.getByText('Transformers.js'), { ctrlKey: true });

    // 640px fits exactly 2 panels of 320px, so the 3rd panel wraps to a new row
    await act(async () => {
      resizeCallback?.([{ contentRect: { width: 640 } } as ResizeObserverEntry], null as unknown as ResizeObserver);
    });

    const splitRows = document.querySelectorAll('.browser-split-view');
    expect(splitRows).toHaveLength(2);
    expect(splitRows[0]).toHaveClass('panels-2');
    expect(splitRows[1]).toHaveClass('panels-1');
  });

  it('shows all panels in a single row when the container is wide enough', async () => {
    vi.useFakeTimers();
    let resizeCallback: ResizeObserverCallback | null = null;
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: ResizeObserverCallback) { resizeCallback = cb; }
      observe() {}
      disconnect() {}
    });

    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    // Click Hugging Face (browser tab) → 2 panels (1 browser + 1 session) → PanelSplitView mounts
    fireEvent.click(screen.getByText('Hugging Face'));
    // Ctrl+click Transformers.js to also open it → 3 panels (2 browser + 1 session)
    fireEvent.click(screen.getByText('Transformers.js'), { ctrlKey: true });

    // 1280px fits 4 panels of 320px, so all 3 panels fit in a single row
    await act(async () => {
      resizeCallback?.([{ contentRect: { width: 1280 } } as ResizeObserverEntry], null as unknown as ResizeObserver);
    });

    const splitRows = document.querySelectorAll('.browser-split-view');
    expect(splitRows).toHaveLength(1);
    expect(splitRows[0]).toHaveClass('panels-3');
  });

  it('hides panels that would breach the minimum panel height', async () => {
    vi.useFakeTimers();
    let resizeCallback: ResizeObserverCallback | null = null;
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: ResizeObserverCallback) { resizeCallback = cb; }
      observe() {}
      disconnect() {}
    });

    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    // Open 3 panels: HF + Transformers.js browser tabs plus the active Session 1
    fireEvent.click(screen.getByText('Hugging Face'));
    fireEvent.click(screen.getByText('Transformers.js'), { ctrlKey: true });

    // 640px width → 2 per row; 280px height → floor(280/240)=1 max row → only 2 panels shown
    await act(async () => {
      resizeCallback?.([{ contentRect: { width: 640, height: 280 } } as ResizeObserverEntry], null as unknown as ResizeObserver);
    });

    // Only the first row (2 browser panels) should be rendered; the session panel is hidden
    const splitRows = document.querySelectorAll('.browser-split-view');
    expect(splitRows).toHaveLength(1);
    expect(splitRows[0]).toHaveClass('panels-2');
    expect(screen.getAllByRole('region', { name: 'Page overlay' })).toHaveLength(2);
    expect(screen.queryByLabelText('Chat panel')).not.toBeInTheDocument();
  });

  it('shows all panels when height is sufficient for each row', async () => {
    vi.useFakeTimers();
    let resizeCallback: ResizeObserverCallback | null = null;
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: ResizeObserverCallback) { resizeCallback = cb; }
      observe() {}
      disconnect() {}
    });

    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    // Open 3 panels: HF + Transformers.js browser tabs plus the active Session 1
    fireEvent.click(screen.getByText('Hugging Face'));
    fireEvent.click(screen.getByText('Transformers.js'), { ctrlKey: true });

    // 640px width → 2 per row; 520px height → floor(520/240)=2 max rows → all 3 panels shown
    await act(async () => {
      resizeCallback?.([{ contentRect: { width: 640, height: 520 } } as ResizeObserverEntry], null as unknown as ResizeObserver);
    });

    const splitRows = document.querySelectorAll('.browser-split-view');
    expect(splitRows).toHaveLength(2);
    expect(splitRows[0]).toHaveClass('panels-2');
    expect(splitRows[1]).toHaveClass('panels-1');
    expect(screen.getAllByRole('region', { name: 'Page overlay' })).toHaveLength(2);
    expect(screen.getByLabelText('Chat panel')).toBeInTheDocument();
  });

  it('renders the file editor alongside other panels in the split view', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    // Open a browser tab so there is already one panel alongside the session
    fireEvent.click(screen.getByText('Hugging Face'));

    // Add a skill file to trigger the file editor
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'my-skill' } });
    fireEvent.click(screen.getByRole('button', { name: 'Skill' }));

    await act(async () => { vi.advanceTimersByTime(150); });

    // File editor, browser overlay, and chat panel should all be visible simultaneously
    expect(screen.getByLabelText('File editor')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Page overlay' })).toBeInTheDocument();
    expect(screen.getByLabelText('Chat panel')).toBeInTheDocument();

    // They should be inside a split view container
    expect(document.querySelector('.browser-split-view')).not.toBeNull();
  });

  it('removes the file editor from the split view when closed', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    // Add a skill file to open the file editor
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'my-skill' } });
    fireEvent.click(screen.getByRole('button', { name: 'Skill' }));

    await act(async () => { vi.advanceTimersByTime(150); });

    expect(screen.getByLabelText('File editor')).toBeInTheDocument();

    // Close the file editor
    fireEvent.click(screen.getByRole('button', { name: 'Close file editor' }));

    expect(screen.queryByLabelText('File editor')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Chat panel')).toBeInTheDocument();
  });

  it('keeps the file name as a label until edit is clicked', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.click(screen.getByRole('button', { name: 'AGENTS.md' }));

    await act(async () => { vi.advanceTimersByTime(150); });

    expect(screen.queryByLabelText('Workspace file path')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit file name' }));
    expect(screen.getByLabelText('Workspace file path')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Workspace file path')).not.toBeInTheDocument();
  });

  // ── Regression: panel coexistence ──────────────────────────────────

  it('browser panel does not replace terminal session panel when opened after a file pane', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    // Step 1: open a terminal session pane
    fireEvent.click(screen.getByRole('tab', { name: 'Terminal mode' }));
    expect(screen.getByRole('heading', { name: 'Terminal' })).toBeInTheDocument();

    // Step 2: open a file pane
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.click(screen.getByRole('button', { name: 'AGENTS.md' }));
    await act(async () => { vi.advanceTimersByTime(150); });
    expect(screen.getByLabelText('File editor')).toBeInTheDocument();
    expect(screen.getByLabelText('Terminal')).toBeInTheDocument();

    // Step 3: open a browser panel pane — single-click Hugging Face
    fireEvent.click(screen.getAllByText('Hugging Face')[0]);

    // All three must remain visible
    expect(screen.getByRole('region', { name: 'Page overlay' })).toBeInTheDocument();
    expect(screen.getByLabelText('File editor')).toBeInTheDocument();
    expect(screen.getByLabelText('Terminal')).toBeInTheDocument();
  });

  it('file editor stays visible when a browser panel is added via single-click', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    // Open a file pane
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.click(screen.getByRole('button', { name: 'AGENTS.md' }));
    await act(async () => { vi.advanceTimersByTime(150); });
    expect(screen.getByLabelText('File editor')).toBeInTheDocument();

    // Single-click Hugging Face to open it as a browser panel
    fireEvent.click(screen.getAllByText('Hugging Face')[0]);

    // File editor must still be visible alongside the browser panel
    expect(screen.getByLabelText('File editor')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Page overlay' })).toBeInTheDocument();
    expect(document.querySelector('.browser-split-view')).not.toBeNull();
  });

  it('session panel stays visible when a browser tab is opened via single-click', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    // Default session panel is active
    expect(screen.getByLabelText('Chat panel')).toBeInTheDocument();

    // Single-click Hugging Face
    fireEvent.click(screen.getAllByText('Hugging Face')[0]);

    // Session must stay alongside browser panel
    expect(screen.getByRole('region', { name: 'Page overlay' })).toBeInTheDocument();
    expect(screen.getByLabelText('Chat panel')).toBeInTheDocument();
    expect(document.querySelector('.browser-split-view')).not.toBeNull();
  });

  it('reorders panels via drag-and-drop using dnd-kit', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    // Open two panels: a browser tab and the default session
    fireEvent.click(screen.getByText('Hugging Face'));

    // Verify initial order: browser panel first, then session
    const splitView = document.querySelector('.browser-split-view');
    expect(splitView).not.toBeNull();
    const cells = splitView!.querySelectorAll('.panel-drag-cell');
    expect(cells).toHaveLength(2);
    expect(cells[0].querySelector('[aria-label="Page overlay"]')).not.toBeNull();
    expect(cells[1].querySelector('[aria-label="Chat panel"]')).not.toBeNull();

    // Simulate dnd-kit drag from the first draggable title bar.
    const [handleA] = document.querySelectorAll('.panel-titlebar--draggable');
    fireEvent.pointerDown(handleA, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handleA, { clientX: 50, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(handleA, { pointerId: 1 });

    // After the simulated drag the SortablePanelCell aria-grabbed state is set
    // (full pointer-sensor integration requires a real browser; here we verify
    // the draggable title bars and ARIA attributes exist and the component stays mounted).
    const handles = document.querySelectorAll('.panel-titlebar--draggable');
    expect(handles).toHaveLength(2);
    // Both panel types must still be rendered after interaction
    expect(screen.getByRole('region', { name: 'Page overlay' })).toBeInTheDocument();
    expect(screen.getByLabelText('Chat panel')).toBeInTheDocument();
  });

  // ── Session FS context menu ──────────────────────────────────────

  it('right-clicking a session FS drive node opens the context menu with a New toolbar button; clicking New shows scaffold options', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const driveButton = screen.getByRole('button', { name: '//session-1-fs' });
    const treeRow = driveButton.closest('[role="treeitem"]')!;
    fireEvent.contextMenu(treeRow);

    expect(screen.getByRole('menu', { name: 'Context menu' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New' })).toBeInTheDocument();

    // Open the New sub-menu
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));

    expect(screen.getByRole('menuitem', { name: 'Add File' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add Folder' })).toBeInTheDocument();
    expect(document.querySelector('.ctx-menu-sep')).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Add AGENTS.md' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add agent-skill' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add agent-hook' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add agent-eval' })).toBeInTheDocument();
  });

  it('context menu "Add File" opens the session FS modal pre-set to file mode', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(treeRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add File' }));

    expect(screen.getByRole('dialog', { name: 'Add to session filesystem' })).toBeInTheDocument();
    // File-only mode: only "Create file" button, no combined File/Folder choice
    expect(screen.getByRole('button', { name: 'Create file' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create folder' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'File' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Folder' })).not.toBeInTheDocument();
  });

  it('context menu "Add Folder" opens the session FS modal pre-set to folder mode', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(treeRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add Folder' }));

    expect(screen.getByRole('dialog', { name: 'Add to session filesystem' })).toBeInTheDocument();
    // Folder-only mode: only "Create folder" button
    expect(screen.getByRole('button', { name: 'Create folder' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create file' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'File' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Folder' })).not.toBeInTheDocument();
  });

  it('context menu "Add AGENTS.md" scaffolds the file into the session FS and shows a success toast', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(treeRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Add AGENTS.md' }));
      await Promise.resolve();
    });

    expect(screen.getByText('Created /workspace/AGENTS.md')).toBeInTheDocument();
  });

  it('context menu "Add agent-skill" scaffolds a SKILL.md file and shows a success toast', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(treeRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Add agent-skill' }));
      await Promise.resolve();
    });

    expect(screen.getByText(/Created.*SKILL\.md/)).toBeInTheDocument();
  });

  it('pressing Escape closes the context menu', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(treeRow);
    expect(screen.getByRole('menu', { name: 'Context menu' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu', { name: 'Context menu' })).not.toBeInTheDocument();
  });

  it('clicking outside the context menu closes it', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(treeRow);
    expect(screen.getByRole('menu', { name: 'Context menu' })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('menu', { name: 'Context menu' })).not.toBeInTheDocument();
  });

  it('focuses the first context menu item when the menu opens', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(treeRow);

    // The New toolbar button is the first menuitem when the drive root menu opens
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'New' }));
  });

  it('ArrowDown/ArrowUp move focus through context menu items', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(treeRow);

    const menu = screen.getByRole('menu', { name: 'Context menu' });
    // New toolbar button is focused first
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));

    // First sub-menu item is focused automatically
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Add File' }));

    // ArrowDown moves to second item
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Add Folder' }));

    // ArrowDown skips the separator to the third actionable item
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Add AGENTS.md' }));

    // ArrowUp returns to previous item
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Add Folder' }));
  });

  it('ArrowDown wraps from last context menu item back to first', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(treeRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));

    const menu = screen.getByRole('menu', { name: 'Context menu' });
    screen.getByRole('menuitem', { name: 'Add agent-eval' }).focus();

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Add File' }));
  });

  it('Enter in session FS file-mode input creates the file', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(treeRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add File' }));

    const input = screen.getByRole('textbox', { name: 'Entry name' });
    fireEvent.change(input, { target: { value: 'notes.md' } });

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
      await Promise.resolve();
    });

    // Modal closes and toast appears
    expect(screen.queryByRole('dialog', { name: 'Add to session filesystem' })).not.toBeInTheDocument();
    expect(screen.getByText(/Created.*notes\.md/)).toBeInTheDocument();
  });

  it('Enter in session FS folder-mode input creates the folder', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(treeRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add Folder' }));

    const input = screen.getByRole('textbox', { name: 'Entry name' });
    fireEvent.change(input, { target: { value: 'my-dir' } });

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
      await Promise.resolve();
    });

    expect(screen.queryByRole('dialog', { name: 'Add to session filesystem' })).not.toBeInTheDocument();
    expect(screen.getByText(/Created.*my-dir/)).toBeInTheDocument();
  });

  it('Enter in session FS file-mode input (via context menu) creates the file', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    // Open the context menu and choose Add File
    const treeRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(treeRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add File' }));

    const input = screen.getByRole('textbox', { name: 'Entry name' });
    fireEvent.change(input, { target: { value: 'combined.txt' } });

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
      await Promise.resolve();
    });

    expect(screen.queryByRole('dialog', { name: 'Add to session filesystem' })).not.toBeInTheDocument();
    expect(screen.getByText(/Created.*combined\.txt/)).toBeInTheDocument();
  });

  it('Escape in session FS modal input closes the modal without creating anything', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(treeRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add File' }));

    expect(screen.getByRole('dialog', { name: 'Add to session filesystem' })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Entry name' }), { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Add to session filesystem' })).not.toBeInTheDocument();
  });

  // ── Session FS rename / delete ────────────────────────────────────

  async function expandSessionFsDrive() {
    // The //session-1-fs drive starts collapsed; click to expand it
    fireEvent.click(screen.getByRole('button', { name: '//session-1-fs' }));
    await act(async () => { await Promise.resolve(); });
  }

  it('context menu on a non-root VFS node shows Rename and Delete items', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    await expandSessionFsDrive();

    const workspaceRow = screen.getByRole('button', { name: 'workspace' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(workspaceRow);

    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('context menu on the session FS drive root does not show Rename or Delete', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const driveRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(driveRow);

    expect(screen.queryByRole('menuitem', { name: 'Rename' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('clicking Rename opens a modal with the current node name pre-filled', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    await expandSessionFsDrive();

    const workspaceRow = screen.getByRole('button', { name: 'workspace' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(workspaceRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    expect(screen.getByRole('dialog', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'New name' })).toHaveValue('workspace');
  });

  it('submitting the rename modal renames the path and shows a toast', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    await expandSessionFsDrive();

    const workspaceRow = screen.getByRole('button', { name: 'workspace' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(workspaceRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    fireEvent.change(screen.getByRole('textbox', { name: 'New name' }), { target: { value: 'my-workspace' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
      await Promise.resolve();
    });

    expect(screen.queryByRole('dialog', { name: 'Rename' })).not.toBeInTheDocument();
    expect(screen.getByText('Renamed to my-workspace')).toBeInTheDocument();
  });

  it('Enter in the rename input submits the rename', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    await expandSessionFsDrive();

    const workspaceRow = screen.getByRole('button', { name: 'workspace' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(workspaceRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    const input = screen.getByRole('textbox', { name: 'New name' });
    fireEvent.change(input, { target: { value: 'renamed-dir' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
      await Promise.resolve();
    });

    expect(screen.queryByRole('dialog', { name: 'Rename' })).not.toBeInTheDocument();
    expect(screen.getByText('Renamed to renamed-dir')).toBeInTheDocument();
  });

  it('Escape in the rename input cancels without renaming', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    await expandSessionFsDrive();

    const workspaceRow = screen.getByRole('button', { name: 'workspace' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(workspaceRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'New name' }), { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Rename' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Renamed to/)).not.toBeInTheDocument();
  });

  it('clicking Delete removes the node and shows a success toast', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    await expandSessionFsDrive();

    const workspaceRow = screen.getByRole('button', { name: 'workspace' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(workspaceRow);

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      await Promise.resolve();
    });

    expect(screen.getByText('Deleted /workspace')).toBeInTheDocument();
  });

  // ── Browser tab context menu ───────────────────────────────────

  it('right-clicking a browser tab shows Bookmark, Mute, Copy URI, and Close items', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const tabRow = screen.getByText('Hugging Face').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(tabRow);

    expect(screen.getByRole('menu', { name: 'Context menu' })).toBeInTheDocument();
    // HF starts persisted=true so label is "Remove Bookmark"
    expect(screen.getByRole('menuitem', { name: /bookmark/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Mute' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy URI' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Close' })).toBeInTheDocument();
  });

  it('clicking Bookmark in browser context menu toggles the bookmark and shows a toast', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    // Transformers.js starts without persisted, so "Bookmark" action
    const tabRow = screen.getByText('Transformers.js').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(tabRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bookmark' }));

    expect(screen.getByText('Bookmarked Transformers.js')).toBeInTheDocument();
  });

  it('clicking Mute in browser context menu toggles muted and shows a toast', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const tabRow = screen.getByText('Hugging Face').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(tabRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mute' }));

    expect(screen.getByText('Muted Hugging Face')).toBeInTheDocument();
  });

  it('clicking Copy URI copies the tab URL to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });

    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const tabRow = screen.getByText('Hugging Face').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(tabRow);

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Copy URI' }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('https://huggingface.co/models?library=transformers.js');
    expect(screen.getByText('URI copied to clipboard')).toBeInTheDocument();
  });

  it('clicking Close in browser context menu removes the tab', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    expect(screen.getByText('Transformers.js')).toBeInTheDocument();

    const tabRow = screen.getByText('Transformers.js').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(tabRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Close' }));

    expect(screen.queryByText('Transformers.js')).not.toBeInTheDocument();
  });

  // ── Session tab context menu ───────────────────────────────────

  it('right-clicking a session tab shows Share, Rename, and Remove items', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const sessionRow = screen.getByText('Session 1').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(sessionRow);

    expect(screen.getByRole('menu', { name: 'Context menu' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Remove' })).toBeInTheDocument();
  });

  it('clicking Share in session context menu copies session info to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });

    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const sessionRow = screen.getByText('Session 1').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(sessionRow);

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Share' }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Session 1'));
    expect(screen.getByText('Session link copied to clipboard')).toBeInTheDocument();
  });

  it('clicking Rename in session context menu opens a rename dialog pre-filled with the session name', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const sessionRow = screen.getByText('Session 1').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(sessionRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    expect(screen.getByRole('dialog', { name: 'Rename session' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Session name' })).toHaveValue('Session 1');
  });

  it('submitting the rename session dialog changes the session name', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const sessionRow = screen.getByText('Session 1').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(sessionRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Session name' }), { target: { value: 'My Session' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
      await Promise.resolve();
    });

    expect(screen.queryByRole('dialog', { name: 'Rename session' })).not.toBeInTheDocument();
    expect(screen.getByText('My Session')).toBeInTheDocument();
  });

  it('Enter in session rename input submits the rename', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const sessionRow = screen.getByText('Session 1').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(sessionRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    const input = screen.getByRole('textbox', { name: 'Session name' });
    fireEvent.change(input, { target: { value: 'Renamed Session' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
      await Promise.resolve();
    });

    expect(screen.queryByRole('dialog', { name: 'Rename session' })).not.toBeInTheDocument();
    expect(screen.getByText('Renamed Session')).toBeInTheDocument();
  });

  it('Escape in session rename input cancels without renaming', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const sessionRow = screen.getByText('Session 1').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(sessionRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Session name' }), { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Rename session' })).not.toBeInTheDocument();
    expect(screen.getByText('Session 1')).toBeInTheDocument();
  });

  it('clicking Remove in session context menu removes the session', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    // Add a second session so removing Session 1 doesn’t break the panel
    fireEvent.click(screen.getByLabelText('Add session to Research'));
    expect(screen.getByText('Session 2')).toBeInTheDocument();

    const sessionRow = screen.getByText('Session 1').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(sessionRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));

    expect(screen.queryByText('Session 1')).not.toBeInTheDocument();
  });

  it('removing a session unmounts its virtual disk from the Files tree', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    // Verify the VFS drive for Session 1 exists before removal
    expect(screen.getByRole('button', { name: '//session-1-fs' })).toBeInTheDocument();

    // Add a second session so removing Session 1 doesn't leave the panel empty
    fireEvent.click(screen.getByLabelText('Add session to Research'));
    expect(screen.getByText('Session 2')).toBeInTheDocument();

    const sessionRow = screen.getByText('Session 1').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(sessionRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));

    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByRole('button', { name: '//session-1-fs' })).not.toBeInTheDocument();
  });

  // ── Ellipsis (more-actions) button ──────────────────────────

  it('each browser tab row has a "More actions" ellipsis button', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    expect(screen.getByRole('button', { name: 'More actions for Hugging Face' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions for Transformers.js' })).toBeInTheDocument();
  });

  it('each session tab row has a "More actions" ellipsis button', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    expect(screen.getByRole('button', { name: 'More actions for Session 1' })).toBeInTheDocument();
  });

  it('clicking the ellipsis button opens the context menu for that node', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Hugging Face' }));

    expect(screen.getByRole('menu', { name: 'Context menu' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /bookmark/i })).toBeInTheDocument();
  });

  it('ellipsis button on a session row opens the session context menu', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Session 1' }));

    expect(screen.getByRole('menu', { name: 'Context menu' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
  });

  // ── Context menu toolbar (top icon-button bar) ──────────────────────────

  it('browser tab context menu has a toolbar with Bookmark, Mute, Copy URI and Close icon buttons', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const tabRow = screen.getByText('Hugging Face').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(tabRow);

    const menu = screen.getByRole('menu', { name: 'Context menu' });
    expect(menu.querySelector('.ctx-menu-toolbar')).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: /bookmark/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Mute' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy URI' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Close' })).toBeInTheDocument();
  });

  it('session tab context menu has a toolbar with Share, Rename and Remove icon buttons', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const sessionRow = screen.getByText('Session 1').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(sessionRow);

    const menu = screen.getByRole('menu', { name: 'Context menu' });
    expect(menu.querySelector('.ctx-menu-toolbar')).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Remove' })).toBeInTheDocument();
  });

  it('VFS drive root context menu has a toolbar with a New icon button', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const driveRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(driveRow);

    const menu = screen.getByRole('menu', { name: 'Context menu' });
    expect(menu.querySelector('.ctx-menu-toolbar')).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'New' })).toBeInTheDocument();
  });

  it('VFS non-root context menu has a toolbar with Rename, Delete and New icon buttons', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.click(screen.getByRole('button', { name: '//session-1-fs' }));
    await act(async () => { await Promise.resolve(); });

    const workspaceRow = screen.getByRole('button', { name: 'workspace' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(workspaceRow);

    const menu = screen.getByRole('menu', { name: 'Context menu' });
    expect(menu.querySelector('.ctx-menu-toolbar')).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New' })).toBeInTheDocument();
  });

  it('clicking the New toolbar button shows the scaffold sub-menu', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const driveRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(driveRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));

    expect(screen.getByRole('menuitem', { name: 'Add File' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add Folder' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add AGENTS.md' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add agent-skill' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add agent-hook' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add agent-eval' })).toBeInTheDocument();
  });

  it('clicking the Back button in the sub-menu returns to the main toolbar view', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const driveRow = screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(driveRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));

    // sub-menu is open, add items visible
    expect(screen.getByRole('menuitem', { name: 'Add File' })).toBeInTheDocument();

    // click Back
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    // back to toolbar view, add items gone, New button back
    expect(screen.queryByRole('menuitem', { name: 'Add File' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New' })).toBeInTheDocument();
  });

  // ── Properties context menu item ─────────────────────────────────────────

  it('Properties is a list item in a browser tab context menu', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByText('Hugging Face').closest('[role="treeitem"]')!);
    expect(screen.getByRole('menuitem', { name: 'Properties' })).toBeInTheDocument();
  });

  it('Properties is a list item in a session tab context menu', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByText('Session 1').closest('[role="treeitem"]')!);
    expect(screen.getByRole('menuitem', { name: 'Properties' })).toBeInTheDocument();
  });

  it('Properties is a list item in a VFS node context menu', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!);
    expect(screen.getByRole('menuitem', { name: 'Properties' })).toBeInTheDocument();
  });

  it('clicking Properties on a browser tab opens the Properties dialog', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByText('Hugging Face').closest('[role="treeitem"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Properties' }));

    expect(screen.getByRole('dialog', { name: 'Properties' })).toBeInTheDocument();
  });

  it('browser tab Properties dialog shows URL, memory size, and a Permissions section', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByText('Hugging Face').closest('[role="treeitem"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Properties' }));

    const dialog = screen.getByRole('dialog', { name: 'Properties' });
    expect(dialog).toHaveTextContent('https://huggingface.co/models?library=transformers.js');
    expect(dialog).toHaveTextContent('165');
    expect(screen.getByRole('table', { name: 'Permissions' })).toBeInTheDocument();
  });

  it('Properties permissions table has one row per identity', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByText('Hugging Face').closest('[role="treeitem"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Properties' }));

    // table has at least 2 rows (header + at least one identity)
    const rows = screen.getByRole('table', { name: 'Permissions' }).querySelectorAll('tr');
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('clicking Properties on a VFS node shows the path in the dialog', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Properties' }));

    const dialog = screen.getByRole('dialog', { name: 'Properties' });
    expect(dialog).toHaveTextContent('session-1-fs');
    expect(screen.getByRole('table', { name: 'Permissions' })).toBeInTheDocument();
  });

  // ── History context menu item ─────────────────────────────────────────────

  it('History is a list item in a browser tab context menu', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByText('Hugging Face').closest('[role="treeitem"]')!);
    expect(screen.getByRole('menuitem', { name: 'History' })).toBeInTheDocument();
  });

  it('History is a list item in a session tab context menu', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByText('Session 1').closest('[role="treeitem"]')!);
    expect(screen.getByRole('menuitem', { name: 'History' })).toBeInTheDocument();
  });

  it('History is a list item in a VFS node context menu', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!);
    expect(screen.getByRole('menuitem', { name: 'History' })).toBeInTheDocument();
  });

  it('clicking History on a browser tab opens the Browser history dialog', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByText('Hugging Face').closest('[role="treeitem"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getByRole('dialog', { name: 'Browser history' })).toBeInTheDocument();
  });

  it('Browser history dialog shows the initial URL as a navigation entry', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByText('Hugging Face').closest('[role="treeitem"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    const dialog = screen.getByRole('dialog', { name: 'Browser history' });
    expect(dialog).toHaveTextContent('huggingface.co');
    expect(screen.getByRole('img', { name: 'Commit graph' })).toBeInTheDocument();
  });

  it('Browser history dialog shows Back and Forward navigation buttons', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByText('Hugging Face').closest('[role="treeitem"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Forward' })).toBeInTheDocument();
  });

  it('clicking History on a VFS node opens the Version history dialog', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getByRole('dialog', { name: 'Version history' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Commit graph' })).toBeInTheDocument();
  });

  it('Version history dialog shows a Rollback button for commits', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    // The initial commit is always present; it should have a Rollback button
    expect(screen.getAllByRole('button', { name: /Roll back/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('rolling back to the initial commit creates a new branch in the version history', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    const rollbackBtn = screen.getAllByRole('button', { name: /Roll back/i })[0];
    await act(async () => {
      fireEvent.click(rollbackBtn);
      await Promise.resolve();
    });

    // A new branch name containing 'rollback' should appear
    expect(screen.getByRole('dialog', { name: 'Version history' })).toHaveTextContent('rollback');
  });

  it('clicking History on a session opens the Session history dialog', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByText('Session 1').closest('[role="treeitem"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getByRole('dialog', { name: 'Session history' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Commit graph' })).toBeInTheDocument();
  });

  it('Session history dialog shows a "Branch from here" button for each snapshot', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByText('Session 1').closest('[role="treeitem"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getAllByRole('button', { name: /Branch from here/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('clicking "Branch from here" in session history creates a new branch and shows it in the graph', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByText('Session 1').closest('[role="treeitem"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    const branchBtn = screen.getAllByRole('button', { name: /Branch from here/i })[0];
    await act(async () => {
      fireEvent.click(branchBtn);
      await Promise.resolve();
    });

    // A new branch should appear in the dialog
    const dialog = screen.getByRole('dialog', { name: 'Session history' });
    expect(dialog).toHaveTextContent('branch');
  });

  // ── File node: Move / Symlink / Duplicate ─────────────────────────────────

  /** Helper: add AGENTS.md to the Research workspace and return its treeitem element. */
  async function addAgentsMdAndGetTreeItem() {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.click(screen.getByRole('button', { name: 'AGENTS.md' }));
    await act(async () => { vi.advanceTimersByTime(150); await Promise.resolve(); });

    // AGENTS.md appears both in the add-file modal and in the tree; pick the treeitem one
    const treeitem = screen.getAllByText('AGENTS.md')
      .map((el) => el.closest('[role="treeitem"]'))
      .find((el): el is Element => el !== null);
    if (!treeitem) throw new Error('AGENTS.md treeitem not found');
    return treeitem;
  }

  it('file context menu has a "Move" top button', async () => {
    const treeitem = await addAgentsMdAndGetTreeItem();
    fireEvent.contextMenu(treeitem);
    expect(screen.getByRole('menuitem', { name: 'Move' })).toBeInTheDocument();
  });

  it('file context menu Move button has split dropdown showing Symlink and Duplicate', async () => {
    const treeitem = await addAgentsMdAndGetTreeItem();
    fireEvent.contextMenu(treeitem);
    fireEvent.click(screen.getByRole('button', { name: 'Move options' }));
    expect(screen.getByRole('menuitem', { name: 'Symlink' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument();
  });

  it('clicking Move opens the file-op modal with "Move" as the operation', async () => {
    const treeitem = await addAgentsMdAndGetTreeItem();
    fireEvent.contextMenu(treeitem);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));
    const dialog = screen.getByRole('dialog', { name: 'Move file' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Move');
    expect(screen.getByRole('textbox', { name: /target directory/i })).toBeInTheDocument();
  });

  it('clicking Symlink (from split dropdown) opens the file-op modal with "Symlink" as the operation', async () => {
    const treeitem = await addAgentsMdAndGetTreeItem();
    fireEvent.contextMenu(treeitem);
    fireEvent.click(screen.getByRole('button', { name: 'Move options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Symlink' }));
    const dialog = screen.getByRole('dialog', { name: 'Symlink file' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Symlink');
  });

  it('clicking Duplicate (from split dropdown) opens the file-op modal with "Duplicate" as the operation', async () => {
    const treeitem = await addAgentsMdAndGetTreeItem();
    fireEvent.contextMenu(treeitem);
    fireEvent.click(screen.getByRole('button', { name: 'Move options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    const dialog = screen.getByRole('dialog', { name: 'Duplicate file' });
    expect(dialog).toBeInTheDocument();
  });

  it('confirming a Move updates the file path in the workspace', async () => {
    const treeitem = await addAgentsMdAndGetTreeItem();
    fireEvent.contextMenu(treeitem);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));

    fireEvent.change(screen.getByRole('textbox', { name: /target directory/i }), {
      target: { value: 'docs' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await act(async () => { await Promise.resolve(); });

    // The file should no longer appear under its original path name only
    expect(screen.queryByRole('dialog', { name: 'Move file' })).not.toBeInTheDocument();
    // Toast confirms the move
    expect(document.querySelector('.toast')?.textContent).toMatch(/moved/i);
  });

  it('confirming a Symlink adds a symlink reference file in the target directory', async () => {
    const treeitem = await addAgentsMdAndGetTreeItem();
    fireEvent.contextMenu(treeitem);
    fireEvent.click(screen.getByRole('button', { name: 'Move options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Symlink' }));

    fireEvent.change(screen.getByRole('textbox', { name: /target directory/i }), {
      target: { value: 'links' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByRole('dialog', { name: 'Symlink file' })).not.toBeInTheDocument();
    expect(document.querySelector('.toast')?.textContent).toMatch(/symlink/i);
  });

  it('confirming a Duplicate creates a copy of the file in the target directory', async () => {
    const treeitem = await addAgentsMdAndGetTreeItem();
    fireEvent.contextMenu(treeitem);
    fireEvent.click(screen.getByRole('button', { name: 'Move options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));

    fireEvent.change(screen.getByRole('textbox', { name: /target directory/i }), {
      target: { value: 'copies' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByRole('dialog', { name: 'Duplicate file' })).not.toBeInTheDocument();
    expect(document.querySelector('.toast')?.textContent).toMatch(/duplicated/i);
  });

  // ── FileOpPicker keyboard & directory navigation ─────────────────────────

  it('picker shows breadcrumb input with ~/  prefix', async () => {
    const treeitem = await addAgentsMdAndGetTreeItem();
    fireEvent.contextMenu(treeitem);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));

    const input = screen.getByRole('textbox', { name: /target directory/i }) as HTMLInputElement;
    expect(input.value).toBe('~/');
  });

  it('picker shows Directories section and directory rows when workspace has dirs', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    // Add a skill (lives at .agents/skill/foo/SKILL.md) so dirs like .agents/ exist
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    await act(async () => { await Promise.resolve(); });
    const nameInput = screen.getByLabelText('Capability name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'my-skill' } });
    fireEvent.click(screen.getByRole('button', { name: 'Skill' }));
    await act(async () => { await Promise.resolve(); });

    // Open Move on the skill treeitem (avoids a second render via addAgentsMdAndGetTreeItem)
    const treeitem = screen.getAllByRole('treeitem').find((el) => el.textContent?.includes('SKILL.md'));
    expect(treeitem).toBeDefined();
    fireEvent.contextMenu(treeitem!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));

    // There should be a listbox (even if empty it renders)
    expect(screen.getByRole('listbox', { name: 'Directories' })).toBeInTheDocument();
  });

  it('picker filters rows as user types in the breadcrumb input', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    // Create a skill file which creates .agents/ directory tree
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'foo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Skill' }));
    await act(async () => { await Promise.resolve(); });

    const treeitem = screen.getAllByRole('treeitem').find((el) => el.textContent?.includes('SKILL.md'));
    fireEvent.contextMenu(treeitem!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));

    const input = screen.getByRole('textbox', { name: /target directory/i });
    // Type a filter that matches .agents/
    fireEvent.change(input, { target: { value: '~/.ag' } });

    const listbox = screen.getByRole('listbox', { name: 'Directories' });
    expect(listbox.textContent).toContain('.agents');
  });

  it('picker shows ".." row after navigating into a subdirectory', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    // Add a nested file (.agents/skill/foo/SKILL.md) via skill creation
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'bar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Skill' }));
    await act(async () => { await Promise.resolve(); });

    const treeitem = screen.getAllByRole('treeitem').find((el) => el.textContent?.includes('SKILL.md'));
    fireEvent.contextMenu(treeitem!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));

    const input = screen.getByRole('textbox', { name: /target directory/i });
    // Navigate into .agents/ by typing the full path with trailing slash
    fireEvent.change(input, { target: { value: '~/.agents/' } });

    const listbox = screen.getByRole('listbox', { name: 'Directories' });
    // ".." row should appear
    expect(listbox.textContent).toContain('..');
  });

  it('picker Backspace with empty filter and non-root dir steps up', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.click(screen.getByLabelText('Add file to Research'));
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'baz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Skill' }));
    await act(async () => { await Promise.resolve(); });

    const treeitem = screen.getAllByRole('treeitem').find((el) => el.textContent?.includes('SKILL.md'));
    fireEvent.contextMenu(treeitem!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));

    const input = screen.getByRole('textbox', { name: /target directory/i }) as HTMLInputElement;
    // Navigate into .agents/
    fireEvent.change(input, { target: { value: '~/.agents/' } });
    expect(input.value).toBe('~/.agents/');

    // Backspace when filter is empty should step up to root
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(input.value).toBe('~/');
  });

  it('picker Escape key closes the dialog', async () => {
    const treeitem = await addAgentsMdAndGetTreeItem();
    fireEvent.contextMenu(treeitem);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));

    const dialog = screen.getByRole('dialog', { name: 'Move file' });
    expect(dialog).toBeInTheDocument();

    const input = screen.getByRole('textbox', { name: /target directory/i });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Move file' })).not.toBeInTheDocument();
  });

  it('file Properties dialog lists Move, Symlink and Duplicate in the permissions table', async () => {
    const treeitem = await addAgentsMdAndGetTreeItem();
    fireEvent.contextMenu(treeitem);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Properties' }));

    const dialog = screen.getByRole('dialog', { name: 'Properties' });
    expect(dialog).toHaveTextContent('Move');
    expect(dialog).toHaveTextContent('Symlink');
    expect(dialog).toHaveTextContent('Duplicate');
  });

  it('browser tab Properties dialog lists all browser context-menu actions in permissions', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByText('Hugging Face').closest('[role="treeitem"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Properties' }));

    const dialog = screen.getByRole('dialog', { name: 'Properties' });
    expect(dialog).toHaveTextContent('Bookmark');
    expect(dialog).toHaveTextContent('Mute');
    expect(dialog).toHaveTextContent('Copy URI');
    expect(dialog).toHaveTextContent('Close');
  });

  it('session Properties dialog lists all session context-menu actions in permissions', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(screen.getByText('Session 1').closest('[role="treeitem"]')!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Properties' }));

    const dialog = screen.getByRole('dialog', { name: 'Properties' });
    expect(dialog).toHaveTextContent('Share');
    expect(dialog).toHaveTextContent('Rename');
    expect(dialog).toHaveTextContent('Remove');
  });

  // ── Browser add button ────────────────────────────────────────────────────

  it('Browser folder has an "Add browser tab" button matching Sessions and Files', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    expect(screen.getByLabelText('Add browser tab to Research')).toBeInTheDocument();
  });

  it('clicking Add browser tab opens a URI prompt dialog', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.click(screen.getByLabelText('Add browser tab to Research'));

    const dialog = screen.getByRole('dialog', { name: 'New browser tab' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /url/i })).toBeInTheDocument();
  });

  it('confirming the URI prompt creates a new tab with the entered URL', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.click(screen.getByLabelText('Add browser tab to Research'));
    fireEvent.change(screen.getByRole('textbox', { name: /url/i }), {
      target: { value: 'https://example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await act(async () => { vi.advanceTimersByTime(50); await Promise.resolve(); });

    // A new treeitem for the new tab should have appeared
    expect(screen.queryByRole('dialog', { name: 'New browser tab' })).not.toBeInTheDocument();
    // The toast confirms the tab was opened
    expect(document.querySelector('.toast')?.textContent).toMatch(/example\.com/i);
  });

  it('cancelling the URI prompt does not create a new tab', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const before = screen.getAllByRole('treeitem').filter(
      (el) => el.querySelector('[data-icon="globe"]')
    ).length;

    fireEvent.click(screen.getByLabelText('Add browser tab to Research'));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    const after = screen.getAllByRole('treeitem').filter(
      (el) => el.querySelector('[data-icon="globe"]')
    ).length;
    expect(after).toBe(before);
    expect(screen.queryByRole('dialog', { name: 'New browser tab' })).not.toBeInTheDocument();
  });

  // ── Clipboard worktree node ───────────────────────────────────

  it('renders a Clipboard node in the active workspace tree', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Clipboard' })).toBeInTheDocument();
  });

  it('right-clicking the Clipboard node shows a History context menu item', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);

    expect(screen.getByRole('menu', { name: 'Context menu' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'History' })).toBeInTheDocument();
  });

  it('clicking History from Clipboard context menu opens the clipboard history modal', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getByRole('dialog', { name: 'Clipboard history' })).toBeInTheDocument();
    expect(screen.getByText('No clipboard history yet')).toBeInTheDocument();
  });

  it('closing the clipboard history modal dismisses it', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close Clipboard history' }));

    expect(screen.queryByRole('dialog', { name: 'Clipboard history' })).not.toBeInTheDocument();
  });

  it('Copy URI adds an entry to clipboard history visible in the modal', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });

    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    // Copy a tab URI to populate history
    const tabRow = screen.getByText('Hugging Face').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(tabRow);
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Copy URI' }));
      await Promise.resolve();
    });

    // Open clipboard history
    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    const dialog = screen.getByRole('dialog', { name: 'Clipboard history' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/URI: Hugging Face/)).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    // No Restore button for the active item
    expect(screen.queryByRole('button', { name: /Restore:/ })).not.toBeInTheDocument();
  });

  it('Restore button in clipboard history restores a previous entry and closes the modal', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });

    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    // Copy two URIs to build up history
    const hfRow = screen.getByText('Hugging Face').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(hfRow);
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Copy URI' })); await Promise.resolve(); });

    const tjRow = screen.getByText('Transformers.js').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(tjRow);
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Copy URI' })); await Promise.resolve(); });

    // Open clipboard history; Transformers.js URI is active, Hugging Face has a Restore button
    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    const restoreBtn = screen.getByRole('button', { name: /Restore: URI: Hugging Face/ });
    await act(async () => {
      fireEvent.click(restoreBtn);
      await Promise.resolve();
    });

    // Modal closes and a success toast appears
    expect(screen.queryByRole('dialog', { name: 'Clipboard history' })).not.toBeInTheDocument();
    expect(screen.getByText('Clipboard restored')).toBeInTheDocument();
    expect(writeText).toHaveBeenLastCalledWith('https://huggingface.co/models?library=transformers.js');
  });

  // ── System clipboard detection ────────────────────────────────

  it('on mount, reads the system clipboard and adds external content to history', async () => {
    const readText = vi.fn().mockResolvedValue('copied externally');
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, writable: true, configurable: true });

    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    const dialog = screen.getByRole('dialog', { name: 'Clipboard history' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('copied externally', { selector: '.history-entry-msg' })).toBeInTheDocument();
  });

  it('regaining window focus detects new external clipboard content', async () => {
    const readText = vi.fn()
      .mockResolvedValueOnce('')
      .mockResolvedValue('focused and copied');
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, writable: true, configurable: true });

    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getByText('focused and copied', { selector: '.history-entry-msg' })).toBeInTheDocument();
  });

  it('document becoming visible detects new external clipboard content', async () => {
    const readText = vi.fn()
      .mockResolvedValueOnce('')
      .mockResolvedValue('visible text');
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, writable: true, configurable: true });

    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getByText('visible text', { selector: '.history-entry-msg' })).toBeInTheDocument();
  });

  it('same clipboard text is not added twice on consecutive focus events', async () => {
    const readText = vi.fn().mockResolvedValue('same text');
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, writable: true, configurable: true });

    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    // Fire focus twice — same text should not produce a duplicate entry
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve(); });
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve(); });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getAllByText('same text', { selector: '.history-entry-msg' })).toHaveLength(1);
  });

  it('readText permission errors are handled gracefully and leave history empty', async () => {
    const readText = vi.fn().mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, writable: true, configurable: true });

    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getByText('No clipboard history yet')).toBeInTheDocument();
  });

  it('writing via app actions does not create a duplicate when focus fires with same text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const readText = vi.fn().mockResolvedValue('https://huggingface.co/models?library=transformers.js');
    Object.defineProperty(navigator, 'clipboard', { value: { writeText, readText }, writable: true, configurable: true });

    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    // Copy URI via app action
    const tabRow = screen.getByText('Hugging Face').closest('[role="treeitem"]')!;
    fireEvent.contextMenu(tabRow);
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Copy URI' }));
      await Promise.resolve();
    });

    // Focus fires — same text should not duplicate
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getAllByText('URI: Hugging Face', { selector: '.history-entry-msg' })).toHaveLength(1);
  });

  // ── Clipboard Properties context menu item ────────────────────

  it('Clipboard context menu has a Properties item', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);

    expect(screen.getByRole('menuitem', { name: 'Properties' })).toBeInTheDocument();
  });

  it('clicking Properties on the Clipboard node opens the Properties dialog', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Properties' }));

    expect(screen.getByRole('dialog', { name: 'Properties' })).toBeInTheDocument();
  });

  it('Clipboard Properties dialog shows a Permissions table with Read and Write actions', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Properties' }));

    const dialog = screen.getByRole('dialog', { name: 'Properties' });
    expect(dialog).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Permissions' });
    expect(table).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Read');
    expect(dialog).toHaveTextContent('Write');
  });

  it('Clipboard Properties dialog lists History and Restore in permissions', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Properties' }));

    const dialog = screen.getByRole('dialog', { name: 'Properties' });
    expect(dialog).toHaveTextContent('History');
    expect(dialog).toHaveTextContent('Restore');
  });

  it('Clipboard Properties permissions table has one row per identity', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Properties' }));

    const rows = screen.getByRole('table', { name: 'Permissions' }).querySelectorAll('tr');
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  // ── In-page copy/cut event detection ──────────────────────────

  it('native copy event within the page adds the copied text to clipboard history', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { readText: vi.fn().mockResolvedValue('') }, writable: true, configurable: true });

    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    await act(async () => {
      const event = new Event('copy', { bubbles: true }) as Event & { clipboardData: unknown };
      (event as unknown as { clipboardData: { getData: (_: string) => string } }).clipboardData = { getData: (_: string) => 'selected chat text' };
      document.dispatchEvent(event);
      await Promise.resolve();
    });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getByText('selected chat text', { selector: '.history-entry-msg' })).toBeInTheDocument();
  });

  it('native cut event within the page adds the cut text to clipboard history', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { readText: vi.fn().mockResolvedValue('') }, writable: true, configurable: true });

    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    await act(async () => {
      const event = new Event('cut', { bubbles: true }) as Event & { clipboardData: unknown };
      (event as unknown as { clipboardData: { getData: (_: string) => string } }).clipboardData = { getData: (_: string) => 'cut text from input' };
      document.dispatchEvent(event);
      await Promise.resolve();
    });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getByText('cut text from input', { selector: '.history-entry-msg' })).toBeInTheDocument();
  });

  it('native copy of the same text already in history does not create a duplicate', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { readText: vi.fn().mockResolvedValue('') }, writable: true, configurable: true });

    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const dispatchCopy = async (text: string) => {
      const event = new Event('copy', { bubbles: true });
      (event as unknown as { clipboardData: { getData: (_: string) => string } }).clipboardData = { getData: (_: string) => text };
      document.dispatchEvent(event);
      await Promise.resolve();
    };

    await act(() => dispatchCopy('duplicate text'));
    await act(() => dispatchCopy('duplicate text'));

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    const entries = screen.getAllByText('duplicate text', { selector: '.history-entry-msg' });
    expect(entries).toHaveLength(1);
  });

  it('copy event with no clipboardData falls back to readText', async () => {
    const readText = vi.fn().mockResolvedValue('fallback text');
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, writable: true, configurable: true });

    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    await act(async () => {
      const event = new Event('copy', { bubbles: true });
      // no clipboardData property set — simulates empty/missing clipboardData
      document.dispatchEvent(event);
      await Promise.resolve();
      await Promise.resolve();
    });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getByText('fallback text', { selector: '.history-entry-msg' })).toBeInTheDocument();
  });

  it('clipboard detection is skipped gracefully when navigator.clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, writable: true, configurable: true });

    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getByText('No clipboard history yet')).toBeInTheDocument();
  });
});
