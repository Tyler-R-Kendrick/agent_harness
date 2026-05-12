import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createWebMcpTool } from 'agent-browser-mcp';
import { installModelContext } from 'webmcp';
import App from './App';
import {
  getDefaultSecretsManagerAgent,
  resetDefaultSecretsManagerAgentForTests,
} from './chat-agents/Secrets';
import {
  buildRenamedSessionFsPath,
  buildSessionFsChildPath,
  normalizeSessionFsEntryName,
  normalizeSessionFsPath,
} from './services/sessionFsPath';
import { WORKSPACE_FILES_STORAGE_KEY } from './services/workspaceFiles';
import { createMultitaskSubagentState } from './services/multitaskSubagents';
import { STORAGE_KEYS } from './services/sessionState';
import type { CopilotRuntimeState } from './services/copilotApi';
import type { CodexRuntimeState } from './services/codexApi';

const searchBrowserModelsMock = vi.fn();
const loadModelMock = vi.fn();
const generateMock = vi.fn();
const fetchCopilotStateMock = vi.fn();
const streamCopilotChatMock = vi.fn();
const fetchCodexStateMock = vi.fn();
const streamCodexRuntimeChatMock = vi.fn();
const resolveLanguageModelMock = vi.fn(() => ({ specificationVersion: 'v3', provider: 'test', modelId: 'test-model' }));
const runStagedToolPipelineMock = vi.fn();
const runParallelDelegationWorkflowMock = vi.fn();
const getSandboxFeatureFlagsMock = vi.fn(() => ({
  secureBrowserSandboxExec: false,
  disableWebContainerAdapter: false,
  allowSameOriginForWebContainer: false,
}));
const createSandboxExecutionServiceMock = vi.fn();
const buildRunSummaryInputMock = vi.fn();
const bashExecCommands: string[] = [];

const flushAsyncUpdates = async (cycles = 25) => {
  await act(async () => {
    for (let index = 0; index < cycles; index += 1) {
      await Promise.resolve();
      if (vi.isFakeTimers()) {
        vi.advanceTimersByTime(0);
      }
    }
  });
};

function getTreeItemByText(text: string): HTMLElement {
  const treeItem = screen.getAllByRole('treeitem').find((item) => within(item).queryByText(text));
  if (!treeItem) throw new Error(`Unable to find tree item containing ${text}`);
  return treeItem;
}

function dispatchCancelableContextMenu(target: Element, init: MouseEventInit = {}) {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: 80,
    clientY: 96,
    ...init,
  });
  fireEvent(target, event);
  return event;
}

vi.mock('@huggingface/transformers', () => ({
  TextStreamer: class MockTextStreamer {},
}));

vi.mock('./services/copilotRuntimeBridge', () => ({
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

vi.mock('./services/codexApi', () => ({
  fetchCodexState: (...args: unknown[]) => fetchCodexStateMock(...args),
  streamCodexRuntimeChat: (...args: unknown[]) => streamCodexRuntimeChatMock(...args),
}));

vi.mock('./services/agentProvider', async (importOriginal: () => Promise<typeof import('./services/agentProvider')>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    resolveLanguageModel: (config: unknown) => (resolveLanguageModelMock as (config: unknown) => unknown)(config),
  };
});

vi.mock('./services/stagedToolPipeline', () => ({
  runStagedToolPipeline: (options: unknown, callbacks: unknown) => runStagedToolPipelineMock(options, callbacks),
}));

vi.mock('./services/parallelDelegationWorkflow', async (importOriginal: () => Promise<typeof import('./services/parallelDelegationWorkflow')>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    runParallelDelegationWorkflow: (options: unknown, callbacks: unknown) => runParallelDelegationWorkflowMock(options, callbacks),
    // Bypass the provider-based gate in App tests so the delegation
    // behavior under test still runs even when the active model is local.
    // The gate's own behavior is covered in
    // services/parallelDelegationWorkflow.test.ts.
    shouldRunParallelDelegation: (prompt: string) => actual.isParallelDelegationPrompt(prompt),
  };
});

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
      bashExecCommands.push(command);
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
  describe('session filesystem path guards', () => {
    it('rejects traversal paths', () => {
      expect(() => normalizeSessionFsPath('/workspace/../secret')).toThrow(/traversal/i);
    });

    it('rejects root deletion targets', () => {
      expect(() => normalizeSessionFsPath('/')).toThrow(/root cannot be modified/i);
    });

    it('rejects unsafe entry names', () => {
      expect(() => normalizeSessionFsEntryName('../escape')).toThrow(/path separators/i);
      expect(() => normalizeSessionFsEntryName('nested/file')).toThrow(/path separators/i);
    });

    it('keeps child and rename paths inside the same parent', () => {
      expect(buildSessionFsChildPath('/workspace', 'notes.md')).toBe('/workspace/notes.md');
      expect(buildRenamedSessionFsPath('/workspace/notes.md', 'ideas.md')).toBe('/workspace/ideas.md');
    });
  });

  const openDefaultSessionPanel = async () => {
    if (screen.queryByLabelText('Chat panel')) return;
    if (!screen.queryByLabelText('Workspace tree')) {
      fireEvent.click(screen.getByLabelText('Projects'));
      await flushAsyncUpdates();
    }
    const openSessionButton = screen.queryByRole('button', { name: 'Open Session 1' })
      ?? screen.queryByRole('button', { name: 'Session 1' });
    if (!openSessionButton) return;
    fireEvent.click(openSessionButton);
    await flushAsyncUpdates();
  };

  const disableAllTools = async () => {
    await openDefaultSessionPanel();
    fireEvent.click(screen.getByRole('button', { name: /Configure tools/i }));
    await flushAsyncUpdates();
    while (true) {
      const checkedGroupToggle = screen.getAllByRole('checkbox').find((checkbox) => {
        const label = checkbox.getAttribute('aria-label') ?? '';
        return label.startsWith('Toggle all ') && (checkbox as HTMLInputElement).checked;
      });
      if (!checkedGroupToggle) {
        break;
      }
      fireEvent.click(checkedGroupToggle);
      await flushAsyncUpdates();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await flushAsyncUpdates();
  };

  const openDefaultSession = () => {
    fireEvent.click(screen.getByLabelText('Projects'));
    fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));
  };

  const selectModelCatalogSource = (name: string | RegExp) => {
    const providerNav = screen.getByRole('navigation', { name: 'Model catalog providers' });
    fireEvent.click(within(providerNav).getByRole('button', { name }));
  };

  const expectModelProviderStatus = (sectionName: RegExp, status: string) => {
    const section = screen.getByRole('region', { name: sectionName });
    expect(within(section).getByText(status)).toBeInTheDocument();
    return section;
  };

  const installLocalModel = async () => {
    fireEvent.click(screen.getByLabelText('Models'));
    selectModelCatalogSource(/Local/i);
    fireEvent.click(screen.getByRole('button', { name: /Test Model/i }));

    await flushAsyncUpdates();

    await openDefaultSessionPanel();
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

  const createCodexState = (overrides: Partial<CodexRuntimeState> = {}): CodexRuntimeState => ({
    available: true,
    authenticated: false,
    statusMessage: undefined,
    error: undefined,
    models: [],
    signInCommand: 'codex login',
    signInDocsUrl: 'https://developers.openai.com/codex/auth',
    ...overrides,
  });

  beforeEach(() => {
    resetDefaultSecretsManagerAgentForTests();
    window.localStorage.clear();
    window.sessionStorage.clear();
    bashExecCommands.length = 0;
    searchBrowserModelsMock.mockReset();
    loadModelMock.mockReset();
    generateMock.mockReset();
    fetchCopilotStateMock.mockReset();
    streamCopilotChatMock.mockReset();
    fetchCodexStateMock.mockReset();
    streamCodexRuntimeChatMock.mockReset();
    resolveLanguageModelMock.mockReset();
    runStagedToolPipelineMock.mockReset();
    runParallelDelegationWorkflowMock.mockReset();
    searchBrowserModelsMock.mockResolvedValue([]);
    loadModelMock.mockResolvedValue(undefined);
    generateMock.mockResolvedValue(undefined);
    fetchCopilotStateMock.mockResolvedValue(createCopilotState());
    streamCopilotChatMock.mockResolvedValue(undefined);
    fetchCodexStateMock.mockResolvedValue(createCodexState());
    streamCodexRuntimeChatMock.mockResolvedValue(undefined);
    resolveLanguageModelMock.mockReturnValue({ specificationVersion: 'v3', provider: 'test', modelId: 'test-model' });
    runStagedToolPipelineMock.mockResolvedValue({ text: 'done', steps: 1 });
    runParallelDelegationWorkflowMock.mockResolvedValue({ text: 'done', steps: 4 });
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
    const dashboard = screen.getByRole('region', { name: 'Harness dashboard' });
    expect(dashboard).toBeInTheDocument();
    expect(within(dashboard).getByRole('article', { name: 'Session summary widget' })).toBeInTheDocument();
    expect(within(dashboard).getByRole('article', { name: 'Knowledge widget' })).toBeInTheDocument();
    expect(within(dashboard).queryByRole('article', { name: 'Session 1 widget' })).not.toBeInTheDocument();
    expect(within(dashboard).queryByText('Page: Hugging Face')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Chat')).not.toBeInTheDocument();
    openDefaultSession();
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

  it('renders Symphony as a primary isolated-workspace task system while keeping the extension installable', async () => {
    vi.useFakeTimers();
    const taskState = createMultitaskSubagentState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    window.localStorage.setItem(STORAGE_KEYS.multitaskSubagentState, JSON.stringify({
      ...taskState,
      branches: taskState.branches.map((branch) => branch.branchName.endsWith('/tests-2')
        ? { ...branch, status: 'ready', progress: 100 }
        : branch),
    }));
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Symphony'));

    const app = screen.getByRole('region', { name: 'Symphony task management system' });
    expect(app).toBeInTheDocument();
    expect(within(app).getByText('Agent Workspaces')).toBeInTheDocument();
    expect(within(app).getByText('Isolated Workspaces')).toBeInTheDocument();
    expect(within(app).getByText('Review Gate')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Symphony activity summary' })).toBeInTheDocument();
    expect(within(app).queryByRole('button', { name: 'agent/research/tests-2 is not ready for merge approval' })).not.toBeInTheDocument();
    expect(within(app).getByRole('button', { name: 'Send reviewer agent feedback for agent/research/tests-2' })).toBeInTheDocument();
    fireEvent.click(within(app).getByRole('button', { name: 'Request changes for agent/research/tests-2' }));
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.multitaskSubagentState) ?? '{}');
    expect(persisted.branches.find((branch: { branchName: string }) => branch.branchName === 'agent/research/tests-2')).toMatchObject({
      status: 'queued',
      progress: 0,
    });

    fireEvent.click(screen.getByLabelText('Extensions'));

    const marketplace = screen.getByRole('region', { name: 'Extension marketplace' });
    expect(within(marketplace).getByRole('heading', { name: 'IDE extensions' })).toBeInTheDocument();
    expect(within(marketplace).getByText('Symphony internal task orchestration')).toBeInTheDocument();
    expect(within(marketplace).getByRole('button', { name: 'Install Symphony internal task orchestration' })).toBeInTheDocument();
  });

  it('lists installed extensions in the sidebar and renders the marketplace in the active area', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Extensions'));

    const installedSidebar = screen.getByRole('region', { name: 'Installed extensions' });
    expect(within(installedSidebar).getByRole('heading', { name: 'Installed extensions' })).toBeInTheDocument();
    expect(within(installedSidebar).getAllByText('2 installed')).toHaveLength(2);
    expect(within(installedSidebar).queryByText('No installed extensions')).not.toBeInTheDocument();
    expect(within(installedSidebar).queryByText(/Workspace plugins/i)).not.toBeInTheDocument();
    expect(within(installedSidebar).getByText('Markdown preview')).toBeInTheDocument();
    expect(within(installedSidebar).getByText('Workspace plugin')).toBeInTheDocument();
    expect(within(installedSidebar).queryByText('Local Model Connector')).not.toBeInTheDocument();

    const marketplace = screen.getByRole('region', { name: 'Extension marketplace' });
    expect(within(marketplace).getByRole('heading', { name: 'Marketplace' })).toBeInTheDocument();
    expect(within(marketplace).getByRole('heading', { name: 'IDE extensions' })).toBeInTheDocument();
    expect(within(marketplace).getByRole('heading', { name: 'Harness extensions' })).toBeInTheDocument();
    expect(within(marketplace).getByRole('heading', { name: 'Worker extensions' })).toBeInTheDocument();
    expect(within(marketplace).getByRole('heading', { name: 'Provider extensions' })).toBeInTheDocument();
    expect(within(marketplace).queryByRole('heading', { name: 'Runtime extensions' })).not.toBeInTheDocument();
    expect(within(marketplace).getByText('Agent skills')).toBeInTheDocument();
    expect(within(marketplace).getByText('AGENTS.md workspace instructions')).toBeInTheDocument();
    expect(within(marketplace).getByText('DESIGN.md agent guidance')).toBeInTheDocument();
    expect(within(marketplace).getByText('Markdown preview')).toBeInTheDocument();
    expect(within(marketplace).getByText('Design Studio')).toBeInTheDocument();
    expect(within(marketplace).getByText('Symphony internal task orchestration')).toBeInTheDocument();
    expect(within(marketplace).getByText('Workflow canvas orchestration')).toBeInTheDocument();
    expect(within(marketplace).getByText('Artifact context')).toBeInTheDocument();
    expect(within(marketplace).getByText('Artifact worktree explorer')).toBeInTheDocument();
    expect(within(marketplace).getByText('Hugging Face Browser Models')).toBeInTheDocument();
    expect(within(marketplace).getByText('Google AI Edge Browser Models')).toBeInTheDocument();
    expect(within(marketplace).getByText('GitHub Copilot Models')).toBeInTheDocument();
    expect(within(marketplace).getByText('Cursor Models')).toBeInTheDocument();
    expect(within(marketplace).getByText('Codex Models')).toBeInTheDocument();
    expect(within(marketplace).getByText('OpenAI Models')).toBeInTheDocument();
    expect(within(marketplace).getByText('Azure AI Inference Models')).toBeInTheDocument();
    expect(within(marketplace).getByText('AWS Bedrock Models')).toBeInTheDocument();
    expect(within(marketplace).getByText('Anthropic Models')).toBeInTheDocument();
    expect(within(marketplace).getByText('xAI Models')).toBeInTheDocument();
    expect(within(marketplace).getByText('Local Model Connector')).toBeInTheDocument();
    expect(within(marketplace).getByText('Local Inference Worker')).toBeInTheDocument();
    expect(within(marketplace).getByText('21 extensions')).toBeInTheDocument();
    expect(within(marketplace).getAllByRole('button', { name: /^Install / })).toHaveLength(15);
    expect(within(marketplace).getAllByText('Unavailable on this runtime')).toHaveLength(5);
    expect(within(marketplace).getByRole('link', { name: 'Download Local Model Connector' })).toHaveAttribute(
      'href',
      '/downloads/local-model-connector-extension.zip',
    );
    expect(within(marketplace).getByRole('link', { name: 'Download Local Inference Worker for Portable Deno source' })).toHaveAttribute(
      'href',
      '/downloads/agent-harness-local-inference-daemon.zip',
    );
    expect(within(marketplace).queryByText('uBlock Origin')).not.toBeInTheDocument();
  });

  it('offers the portable worker bundle when browser architecture reports ARM Windows', async () => {
    vi.useFakeTimers();
    Object.defineProperty(window.navigator, 'userAgentData', {
      configurable: true,
      value: {
        platform: 'Windows',
        getHighEntropyValues: vi.fn().mockResolvedValue({ platform: 'Windows', architecture: 'arm', bitness: '64' }),
      },
    });
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByLabelText('Extensions'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('link', { name: 'Download Local Inference Worker for Portable Deno source' })).toHaveAttribute(
      'href',
      '/downloads/agent-harness-local-inference-daemon.zip',
    );
  });

  it('installs a repo marketplace extension on demand', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Extensions'));
    const marketplace = screen.getByRole('region', { name: 'Extension marketplace' });
    fireEvent.click(within(marketplace).getByRole('button', { name: 'Install Artifact context' }));
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const installedSidebar = screen.getByRole('region', { name: 'Installed extensions' });
    expect(within(installedSidebar).getAllByText('3 installed')).toHaveLength(2);
    expect(within(installedSidebar).getByText('Artifact context')).toBeInTheDocument();
    expect(within(installedSidebar).queryByText(/^Installed$/)).not.toBeInTheDocument();
    expect(within(marketplace).getByRole('button', { name: 'Disable Artifact context' })).toBeInTheDocument();
    expect(within(marketplace).getByRole('button', { name: 'Configure Artifact context' })).toBeInTheDocument();
    expect(within(marketplace).getByRole('button', { name: 'Uninstall Artifact context' })).toBeInTheDocument();
    expect(window.localStorage.getItem('agent-browser.installed-default-extension-ids')).toContain('agent-harness.ext.artifacts-context');
  });

  it('renders installed enabled IDE extensions as activity-bar icons', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Extensions'));
    const marketplace = screen.getByRole('region', { name: 'Extension marketplace' });
    fireEvent.click(within(marketplace).getByRole('button', { name: 'Install Design Studio' }));
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByRole('button', { name: 'Design Studio extension' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Installed extensions' })).getByText('Design Studio')).toBeInTheDocument();

    fireEvent.click(within(marketplace).getByRole('button', { name: 'Disable Design Studio' }));
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.queryByRole('button', { name: 'Design Studio extension' })).not.toBeInTheDocument();
    expect(within(marketplace).getByRole('button', { name: 'Enable Design Studio' })).toBeInTheDocument();
    expect(window.localStorage.getItem('agent-browser.default-extension-openfeature-flags')).toContain(
      'agent-harness.extensions.agent-harness.ext.design-studio.enabled',
    );
  });

  it('lists provider extensions from the account menu with local provider configuration', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Account'));
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Provider extensions' })).toBeInTheDocument();
    expect(screen.getAllByText('Local Model Connector').length).toBeGreaterThan(0);
    expect(screen.getAllByText('OpenAI Models').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Local model provider')).toBeInTheDocument();
  });

  it.each([
    {
      prompt: 'create a PDF as an artifact about onboarding',
      title: 'Onboarding PDF',
      kind: 'pdf',
      path: 'document.pdf',
      mediaType: 'application/pdf',
      content: '%PDF-1.4\n%% Onboarding\n%%EOF\n',
    },
    {
      prompt: 'generate an image as an artifact for launch',
      title: 'Launch image',
      kind: 'image',
      path: 'image.svg',
      mediaType: 'image/svg+xml',
      content: '<svg xmlns="http://www.w3.org/2000/svg"><title>Launch image</title><rect width="100" height="100" /></svg>',
    },
    {
      prompt: 'build a canvas widget artifact for planning',
      title: 'Planning canvas widget',
      kind: 'canvas-widget',
      path: 'canvas-widget/index.html',
      mediaType: 'text/html',
      content: '<section aria-label="Planning canvas widget"><h1>Planning canvas widget</h1></section>',
    },
    {
      prompt: 'write DESIGN.md as an artifact',
      title: 'DESIGN.md',
      kind: 'design-md',
      path: 'DESIGN.md',
      mediaType: 'text/markdown',
      content: '# DESIGN.md\n\nDesign tokens and interaction notes.\n',
    },
    {
      prompt: 'write AGENTS.md as an artifact',
      title: 'AGENTS.md',
      kind: 'agents-md',
      path: 'AGENTS.md',
      mediaType: 'text/markdown',
      content: '# AGENTS.md\n\nFollow workspace instructions.\n',
    },
    {
      prompt: 'create an agent-skill artifact with SKILL.md references scripts and evals',
      title: 'Generated skill',
      kind: 'agent-skill',
      path: 'skills/generated-skill/SKILL.md',
      mediaType: 'text/markdown',
      content: '---\nname: generated-skill\ndescription: Generated skill\n---\n\n# Generated skill\n',
    },
    {
      prompt: 'generate a DOCX artifact for onboarding',
      title: 'Onboarding DOCX',
      kind: 'docx',
      path: 'document.docx',
      mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: 'DOCX package placeholder',
    },
    {
      prompt: 'generate a PPTX artifact for roadmap',
      title: 'Roadmap PPTX',
      kind: 'pptx',
      path: 'deck.pptx',
      mediaType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      content: 'PPTX package placeholder',
    },
  ])('creates and opens a $kind artifact from chat', async (artifactCase) => {
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
    runStagedToolPipelineMock.mockImplementation(async (options, callbacks) => {
      const createArtifactTool = (options as {
        tools: Record<string, { execute: (args: unknown) => Promise<unknown> }>;
      }).tools['webmcp:create_artifact'];
      const input = {
        id: `artifact-${artifactCase.kind}`,
        title: artifactCase.title,
        kind: artifactCase.kind,
        files: [{
          path: artifactCase.path,
          mediaType: artifactCase.mediaType,
          content: artifactCase.content,
        }],
        references: [],
      };
      callbacks.onToolCall?.('webmcp:create_artifact', input, 'tool-create-artifact');
      const result = await createArtifactTool.execute(input);
      callbacks.onToolResult?.('webmcp:create_artifact', input, result, false, 'tool-create-artifact');
      callbacks.onDone?.(`Created artifact ${artifactCase.title} at //artifacts/artifact-${artifactCase.kind}/${artifactCase.path}`);
      return { text: `Created artifact ${artifactCase.title}`, steps: 1 };
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();
    fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));
    await flushAsyncUpdates();

    fireEvent.change(screen.getByLabelText('Chat input'), {
      target: { value: artifactCase.prompt },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await flushAsyncUpdates();

    expect(runStagedToolPipelineMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: 'Artifact viewer' })).toBeInTheDocument();
    expect(screen.getAllByText(artifactCase.title).length).toBeGreaterThan(0);
    expect(screen.getByText(`//artifacts/artifact-${artifactCase.kind}/${artifactCase.path}`)).toBeInTheDocument();
    if (
      artifactCase.mediaType === 'text/html'
      || artifactCase.mediaType === 'image/svg+xml'
      || artifactCase.mediaType === 'application/pdf'
      || artifactCase.mediaType.startsWith('image/')
    ) {
      expect(screen.getByTitle(`${artifactCase.title}: ${artifactCase.path}`)).toBeInTheDocument();
    } else if (artifactCase.mediaType === 'text/markdown') {
      const markdownRenderer = screen.getByRole('region', { name: 'Markdown preview renderer' });
      expect(markdownRenderer).toHaveTextContent(artifactCase.title);
      expect(markdownRenderer).toHaveTextContent(artifactCase.content.trim().split(/\s+/).at(-1) ?? '');
      expect(screen.queryByRole('region', { name: 'Plugin media renderer' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Native text renderer' })).not.toBeInTheDocument();
    } else if (
      artifactCase.mediaType.startsWith('text/')
      || artifactCase.mediaType === 'application/json'
    ) {
      const nativeTextRenderer = screen.getByRole('region', { name: 'Native text renderer' });
      const contentTokens = artifactCase.content.trim().split(/\s+/);
      expect(nativeTextRenderer).toHaveTextContent(contentTokens[0]);
      expect(nativeTextRenderer).toHaveTextContent(contentTokens.at(-1) ?? '');
    } else {
      expect(screen.getByRole('region', { name: 'Bounded artifact chat' })).toHaveTextContent(
        `No installed or native renderer is bound to ${artifactCase.mediaType}.`,
      );
      expect(screen.getByRole('button', { name: 'Open bounded chat for artifact' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Artifact content')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Show raw artifact source' }));
      expect(screen.getByLabelText('Artifact content')).toHaveValue(artifactCase.content);
    }
  });

  it('creates dashboard widgets from a natural-language canvas prompt and saves live widget-editor JSON', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const dashboard = screen.getByRole('region', { name: 'Harness dashboard' });
    expect(within(dashboard).queryByRole('button', { name: 'Customize' })).not.toBeInTheDocument();
    expect(within(dashboard).queryByRole('button', { name: 'New session widget' })).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getByLabelText('Infinite session canvas'), { clientX: 260, clientY: 180 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create widget' }));
    const prompt = screen.getByRole('dialog', { name: 'Create canvas widget' });
    fireEvent.change(within(prompt).getByLabelText('Widget prompt'), {
      target: { value: 'Track launch risks by owner and blocked item' },
    });
    fireEvent.click(within(prompt).getByRole('button', { name: 'Create widget' }));

    const editor = screen.getByRole('region', { name: 'Widget editor' });
    expect(within(editor).getByRole('heading', { name: 'Launch risks', level: 2 })).toBeInTheDocument();
    expect(within(editor).getByRole('region', { name: 'Live widget preview' })).toHaveTextContent('Track launch risks by owner and blocked item');
    expect(screen.queryByLabelText('Widget-bound session')).not.toBeInTheDocument();

    fireEvent.change(within(editor).getByLabelText('Sample data'), {
      target: { value: '{ "metric": "9 work items", "owner": "Research" }' },
    });
    fireEvent.change(within(editor).getByLabelText('Widget JSON'), {
      target: {
        value: JSON.stringify({
          type: 'Card',
          children: [
            { type: 'Title', value: 'Project map' },
            { type: 'Text', value: '{{metric}} for {{owner}}' },
          ],
        }, null, 2),
      },
    });
    expect(within(editor).getByText('9 work items for Research')).toBeInTheDocument();
    fireEvent.click(within(editor).getByRole('button', { name: 'Save widget JSON' }));
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByRole('treeitem', { name: /Launch risks/ })).toBeInTheDocument();
    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.harnessSpecsByWorkspace) ?? '{}');
    const persistedElements = Object.values(persisted['ws-research'].elements) as Array<{ type: string; props?: Record<string, unknown> }>;
    const persistedWidget = persistedElements.find((element) => element.props?.title === 'Launch risks');
    expect(persistedWidget).toMatchObject({
      type: 'SessionConversationSummary',
      props: expect.objectContaining({
        summary: 'Track launch risks by owner and blocked item',
        widgetJson: expect.objectContaining({ type: 'Card' }),
        widgetSampleData: expect.objectContaining({ metric: '9 work items' }),
      }),
    });
  });

  it('opens dashboard widget tree subnodes in the widget editor by default', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const workspaceTree = screen.getByRole('tree', { name: 'Workspace tree' });
    fireEvent.click(within(workspaceTree).getByRole('button', { name: /^Session summary$/ }));

    expect(screen.getByRole('region', { name: 'Widget editor' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Session summary', level: 2 })).toBeInTheDocument();
    expect(screen.getByLabelText('Live widget preview')).toBeInTheDocument();
    expect(screen.queryByLabelText('Widget-bound session')).not.toBeInTheDocument();
  });

  it('tools picker shows one Built-In bucket with Browser/Sessions/Files/Clipboard/Renderer/Workspace/User Context/Settings sub-groups', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });
    await openDefaultSessionPanel();

    fireEvent.click(screen.getByRole('button', { name: /Configure tools/i }));
    const dialog = screen.getByRole('dialog', { name: 'Tools picker' });
    expect(dialog).toBeInTheDocument();

    // REGRESSION: must NOT have a separate top-level "WebMCP" group.
    // WebMCP tools must all live INSIDE Built-In as sub-groups.
    expect(screen.queryByRole('checkbox', { name: 'Toggle all WebMCP tools' })).not.toBeInTheDocument();
    expect(dialog.querySelector('.tools-picker-group-label')?.textContent).not.toBe('WebMCP');

    // One Built-In parent bucket — its count must be > 1 (more than just CLI),
    // proving WebMCP tools are merged into Built-In rather than being absent.
    const builtInToggle = screen.getByRole('checkbox', { name: 'Toggle all Built-In tools' });
    expect(builtInToggle).toBeInTheDocument();
    // Find the count label sibling — it should show something like "38/38", not "1/1"
    const builtInCount = dialog.querySelector('.tools-picker-group-count');
    expect(builtInCount).not.toBeNull();
    const [selected, total] = (builtInCount?.textContent ?? '').split('/').map(Number);
    expect(total).toBeGreaterThan(1);   // more than just CLI
    expect(selected).toBe(total);       // all selected by default

    // CLI is a flat item directly under Built-In (no sub-group)
    expect(screen.getByRole('checkbox', { name: 'CLI' })).toBeInTheDocument();

    // All surface sub-groups must appear inside the Built-In bucket —
    // not as separate top-level groups. Each must have a toggle-all checkbox.
    for (const subGroupLabel of ['Browser', 'Sessions', 'Files', 'Clipboard', 'Renderer', 'Harness UI', 'Workspace', 'User Context', 'Settings']) {
      expect(
        screen.getByRole('checkbox', { name: `Toggle all ${subGroupLabel} tools` }),
        `Expected sub-group "${subGroupLabel}" inside Built-In, not as a separate top-level group`,
      ).toBeInTheDocument();
    }

    fireEvent.keyDown(document, { key: 'Escape' });
  });

  it('exposes harness customization through WebMCP tools', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const modelContext = installModelContext(window);
    const webmcpTool = createWebMcpTool(modelContext!);

    const elements = await webmcpTool.execute?.({ tool: 'list_harness_elements' }, {} as never) as Array<{ id: string; type: string; title: string }>;
    expect(elements).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'workspace-sidebar', type: 'WorkspaceSidebar', title: 'Workspace tree' }),
      expect.objectContaining({ id: 'render-pane-viewport', type: 'RenderPaneViewport' }),
    ]));

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'patch_harness_element',
        args: { elementId: 'workspace-sidebar', props: { title: 'Project map' } },
      }, {} as never);
    });

    await flushAsyncUpdates();
    await expect(webmcpTool.execute?.({
      tool: 'read_harness_element',
      args: { elementId: 'workspace-sidebar' },
    }, {} as never)).resolves.toMatchObject({
      id: 'workspace-sidebar',
      props: { title: 'Project map' },
    });

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'regenerate_harness_ui',
        args: { prompt: 'Add a session summary widget' },
      }, {} as never);
    });
    await flushAsyncUpdates();

    const dashboard = screen.getByRole('region', { name: 'Harness dashboard' });
    expect(within(dashboard).queryByRole('article', { name: 'Session 1 widget' })).not.toBeInTheDocument();
    expect(within(dashboard).getAllByRole('article', { name: 'Session summary widget' }).length).toBeGreaterThan(0);
    await expect(webmcpTool.execute?.({ tool: 'read_harness_prompt_context' }, {} as never)).resolves.toMatchObject({
      rows: expect.arrayContaining([
        expect.stringContaining('Project map'),
      ]),
    });
  });

  it('renders an MCP elicitation card, submits the answer, and stores location in app memory', async () => {
    vi.useFakeTimers();
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });

    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    await openDefaultSessionPanel();

    const modelContext = installModelContext(window);
    const webmcpTool = createWebMcpTool(modelContext!);
    await expect(webmcpTool.execute?.({
      tool: 'recall_user_context',
      args: { query: 'location' },
    }, {} as never)).resolves.toEqual({ status: 'empty', query: 'location', memories: [] });
    await expect(webmcpTool.execute?.({ tool: 'read_browser_location' }, {} as never)).resolves.toEqual({
      status: 'denied',
      reason: 'Browser location permission was denied.',
    });

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'elicit_user_input',
        args: {
          prompt: 'What city or neighborhood should I use to list restaurants near you?',
          fields: [{ id: 'location', label: 'City or neighborhood', required: true }],
        },
      }, {} as never);
    });

    expect(screen.getAllByText('What city or neighborhood should I use to list restaurants near you?').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('City or neighborhood'), { target: { value: 'Chicago, IL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit requested info' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('User input received')).toBeInTheDocument();
    expect(screen.getAllByText(/Chicago, IL/).length).toBeGreaterThan(0);
    const stored = JSON.parse(window.localStorage.getItem('agent-browser:user-context-memory:v1') ?? '{}');
    expect(stored.Research).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'location',
        label: 'Location',
        value: 'Chicago, IL',
        source: 'workspace-memory',
      }),
    ]));
  });

  it('renders an MCP secret app form that returns only a secretRef to the agent', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    await openDefaultSessionPanel();

    const modelContext = installModelContext(window);
    const webmcpTool = createWebMcpTool(modelContext!);
    const secretValue = 'weather-secret-value-1234567890';
    let secretResult: ReturnType<NonNullable<typeof webmcpTool.execute>>;
    await act(async () => {
      secretResult = webmcpTool.execute?.({
        tool: 'request_secret',
        args: {
          name: 'OPENWEATHER_API_KEY',
          reason: 'The weather API requires a server-side key.',
        },
      }, {} as never);
      await Promise.resolve();
    });

    expect(screen.getByRole('form', { name: 'Secrets Manager request' })).toBeInTheDocument();
    expect(screen.getByText('The weather API requires a server-side key.')).toBeInTheDocument();
    let resolvedSecretResult: unknown;
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Secret name'), { target: { value: 'OPENWEATHER_API_KEY' } });
      fireEvent.change(screen.getByLabelText('Secret value'), { target: { value: secretValue } });
      fireEvent.click(screen.getByRole('button', { name: 'Create secret ref' }));
      resolvedSecretResult = await secretResult!;
      await Promise.resolve();
    });

    expect(resolvedSecretResult).toEqual({
      status: 'secret_ref_created',
      requestId: expect.stringMatching(/^secret-/),
      name: 'OPENWEATHER_API_KEY',
      secretRef: 'secret-ref://local/openweather-api-key',
    });

    expect(screen.getByText('Secret ref created')).toBeInTheDocument();
    expect(screen.getByText('secret-ref://local/openweather-api-key')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(secretValue);
    await expect(getDefaultSecretsManagerAgent().listSecrets()).resolves.toEqual([
      expect.objectContaining({
        id: 'openweather-api-key',
        label: 'OPENWEATHER_API_KEY',
        value: secretValue,
        source: 'manual',
      }),
    ]);
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
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'review-tools' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plugin' }));

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'pre-task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hook' }));

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.queryByRole('button', { name: '//workspace' })).not.toBeInTheDocument();

    fireEvent.click(filesButton);
    expect(screen.getByRole('button', { name: '//workspace' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '.agents' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '//workspace' }));
    expect(screen.queryByRole('button', { name: '//.agents' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '.agents' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '.agents' }));
    fireEvent.click(screen.getByRole('button', { name: 'plugins' }));
    expect(screen.getByText('review-tools')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'hooks' }));
    expect(screen.getByText('pre-task.sh')).toBeInTheDocument();
  }, 90_000);

  it('registers unified filesystem WebMCP tools that a client can invoke', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(WORKSPACE_FILES_STORAGE_KEY, JSON.stringify({
      'ws-research': [{
        path: '.agents/plugins/review-tools/agent-harness.plugin.json',
        content: '{ "schemaVersion": 1, "id": "local.workspace.review-tools", "name": "Review tools", "version": "0.1.0", "description": "Review helpers.", "entrypoint": { "module": "./src/index.ts" }, "capabilities": [] }',
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
      listedFiles = await webmcpTool.execute?.({
        tool: 'list_filesystem_entries',
        args: { targetType: 'workspace-file', kind: 'file' },
      }, {} as never);
    });

    expect(listedFiles).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: '.agents/plugins/review-tools/agent-harness.plugin.json',
        label: 'agent-harness.plugin.json',
        uri: 'files://workspace/.agents/plugins/review-tools/agent-harness.plugin.json',
      }),
      expect.objectContaining({ path: '.memory/MEMORY.md', label: 'MEMORY.md' }),
      expect.objectContaining({ path: '.memory/user.memory.md', label: 'user.memory.md' }),
      expect.objectContaining({ path: '.memory/project.memory.md', label: 'project.memory.md' }),
      expect.objectContaining({ path: '.memory/workspace.memory.md', label: 'workspace.memory.md' }),
      expect.objectContaining({ path: '.memory/session.memory.md', label: 'session.memory.md' }),
      expect.objectContaining({ path: 'user/settings.json', label: 'settings.json' }),
      expect.objectContaining({ path: 'settings.json', label: 'settings.json' }),
      expect.objectContaining({
        path: '.agents/plugins/symphony/agent-harness.plugin.json',
        label: 'agent-harness.plugin.json',
        uri: 'files://workspace/.agents/plugins/symphony/agent-harness.plugin.json',
      }),
    ]));
    expect((listedFiles as unknown[])).toHaveLength(9);

    let fileProperties: unknown;
    await act(async () => {
      fileProperties = await webmcpTool.execute?.({
        tool: 'read_filesystem_properties',
        args: { targetType: 'workspace-file', path: '.agents/plugins/review-tools/agent-harness.plugin.json' },
      }, {} as never);
    });

    expect(fileProperties).toEqual(expect.objectContaining({
      targetType: 'workspace-file',
      kind: 'file',
      label: 'agent-harness.plugin.json',
      path: '.agents/plugins/review-tools/agent-harness.plugin.json',
      uri: 'files://workspace/.agents/plugins/review-tools/agent-harness.plugin.json',
      updatedAt: '2026-04-18T00:00:00.000Z',
      preview: expect.stringContaining('Review helpers.'),
    }));
  });

  it('exposes settings.json scopes through WebMCP and updates workspace and session files', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const modelContext = installModelContext(window);
    expect(modelContext).toBeDefined();
    const webmcpTool = createWebMcpTool(modelContext!);

    let scopes: unknown;
    await act(async () => {
      scopes = await webmcpTool.execute?.({
        tool: 'list_settings_scopes',
        args: { includeValues: true },
      }, {} as never);
    });

    expect(scopes).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: 'global', label: 'global(user)', path: 'user/settings.json', values: {} }),
      expect.objectContaining({ scope: 'project', label: 'project(default workspace)', path: 'settings.json', values: {} }),
      expect.objectContaining({ scope: 'session', path: '/workspace/settings.json', values: {} }),
    ]));
    const sessionScope = (scopes as Array<{ scope: string; sessionId?: string }>).find((scope) => scope.scope === 'session');
    expect(sessionScope?.sessionId).toEqual(expect.any(String));
    const sessionId = sessionScope!.sessionId!;

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'write_settings',
        args: {
          scope: 'project',
          values: { 'editor.tabSize': 6 },
        },
      }, {} as never);
      await webmcpTool.execute?.({
        tool: 'update_setting',
        args: {
          scope: 'session',
          sessionId,
          key: 'agentBrowser.model',
          value: 'qwen3',
        },
      }, {} as never);
      await Promise.resolve();
    });

    await expect(webmcpTool.execute?.({
      tool: 'read_settings',
      args: { scope: 'effective' },
    }, {} as never)).resolves.toEqual(expect.objectContaining({
      values: {
        'agentBrowser.model': 'qwen3',
        'editor.tabSize': 6,
      },
      errors: [],
    }));

    let sessionFile: unknown;
    await act(async () => {
      sessionFile = await webmcpTool.execute?.({
        tool: 'read_filesystem_properties',
        args: { targetType: 'session-fs-entry', sessionId, path: '/workspace/settings.json' },
      }, {} as never);
    });

    expect(sessionFile).toEqual(expect.objectContaining({
      targetType: 'session-fs-entry',
      path: '/workspace/settings.json',
      preview: expect.stringContaining('"agentBrowser.model": "qwen3"'),
    }));
  });

  it('opens a session filesystem workspace symlink as an editable file reference', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const modelContext = installModelContext(window);
    expect(modelContext).toBeDefined();

    const webmcpTool = createWebMcpTool(modelContext!);
    let createdReference: { path: string; content: string } | undefined;
    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'add_filesystem_entry',
        args: {
          action: 'create',
          targetType: 'workspace-file',
          kind: 'file',
          path: '.memory/project.memory.md',
          content: '# Original\nKeep this synced.',
        },
      }, {} as never);
      createdReference = await webmcpTool.execute?.({
        tool: 'add_filesystem_entry',
        args: {
          action: 'symlink',
          targetType: 'session-fs-entry',
          kind: 'file',
          path: '//session-1-fs/workspace',
          sourcePath: '//workspace/.memory/project.memory.md',
        },
      }, {} as never) as { path: string; content: string };
      await Promise.resolve();
    });

    expect(createdReference).toEqual(expect.objectContaining({
      path: '/workspace/project.memory.md',
      content: 'workspace://.memory/project.memory.md',
    }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Files' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '//session-1-fs' }));
    fireEvent.click(screen.getByRole('button', { name: 'workspace' }));
    await flushAsyncUpdates();

    const workspaceFolderRow = screen.getAllByRole('treeitem').find((row) =>
      row.textContent?.trim() === 'workspace' && row.querySelector('[data-icon="folder"], [data-icon="folderOpen"]'),
    );
    expect(workspaceFolderRow).toBeDefined();

    const referenceRow = screen.getAllByRole('treeitem').find((row) =>
      row.textContent?.includes('project.memory.md') && row.querySelector('[data-icon="link"]'),
    );
    expect(referenceRow).toBeDefined();

    const referenceButton = referenceRow?.querySelector<HTMLButtonElement>('.tree-button');
    expect(referenceButton).not.toBeNull();
    fireEvent.click(referenceButton!);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByLabelText('File editor')).toHaveTextContent('project.memory.md');
    expect(screen.getByLabelText('Workspace file content')).toHaveValue('# Original\nKeep this synced.');

    fireEvent.change(screen.getByLabelText('Workspace file content'), {
      target: { value: '# Updated\nKeep this synced through refs.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save file' }));

    let updatedFile: { preview: string } | undefined;
    await act(async () => {
      updatedFile = await webmcpTool.execute?.({
        tool: 'read_filesystem_properties',
        args: { targetType: 'workspace-file', path: '.memory/project.memory.md' },
      }, {} as never) as { preview: string };
    });

    expect(updatedFile).toEqual(expect.objectContaining({
      preview: '# Updated\nKeep this synced through refs.',
    }));
  });

  it('registers browser, session, filesystem, and worktree WebMCP tools against live UI state', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });
    window.localStorage.setItem(WORKSPACE_FILES_STORAGE_KEY, JSON.stringify({
      'ws-research': [{
        path: '.agents/plugins/review-tools/agent-harness.plugin.json',
        content: '{ "schemaVersion": 1, "id": "local.workspace.review-tools", "name": "Review tools", "version": "0.1.0", "description": "Review helpers.", "entrypoint": { "module": "./src/index.ts" }, "capabilities": [] }',
        updatedAt: '2026-04-18T00:00:00.000Z',
      }, {
        path: '.agents/hooks/pre-task.sh',
        content: '#!/usr/bin/env bash\necho pre-task',
        updatedAt: '2026-04-18T00:05:00.000Z',
      }],
      'ws-build': [],
    }));

    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await openDefaultSessionPanel();
    expect(screen.getByLabelText('Chat panel')).toBeInTheDocument();
    await disableAllTools();

    const modelContext = installModelContext(window);
    expect(modelContext).toBeDefined();
    const webmcpTool = createWebMcpTool(modelContext!);

    let browserPages: Array<{ id: string; title: string; url: string }> = [];
    await act(async () => {
      browserPages = await webmcpTool.execute?.({ tool: 'list_browser_pages' }, {} as never) as Array<{ id: string; title: string; url: string }>;
    });

    const docsPage = browserPages.find((page) => page.title === 'Hugging Face');
    expect(docsPage).toBeDefined();

    let filteredBrowserPages: Array<{ id: string; title: string; url: string }> = [];
    await act(async () => {
      filteredBrowserPages = await webmcpTool.execute?.({
        tool: 'list_browser_pages',
        args: { titleQuery: 'hugging' },
      }, {} as never) as Array<{ id: string; title: string; url: string }>;
    });
    expect(filteredBrowserPages).toEqual([expect.objectContaining({ id: docsPage!.id, title: 'Hugging Face' })]);

    let docsHistory: { pageId: string; currentIndex: number; entries: Array<{ url: string; title: string }> } | undefined;
    await act(async () => {
      docsHistory = await webmcpTool.execute?.({
        tool: 'read_browser_page_history',
        args: { pageId: docsPage!.id },
      }, {} as never) as { pageId: string; currentIndex: number; entries: Array<{ url: string; title: string }> };
    });
    expect(docsHistory).toEqual(expect.objectContaining({
      pageId: docsPage!.id,
      currentIndex: 0,
      entries: [expect.objectContaining({ url: docsPage!.url, title: docsPage!.title })],
    }));

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'toggle_worktree_render_pane',
        args: { itemId: docsPage!.id, itemType: 'browser-page' },
      }, {} as never);
    });
    expect(screen.getByLabelText('Page overlay')).toBeInTheDocument();

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'toggle_worktree_render_pane',
        args: { itemId: docsPage!.id, itemType: 'browser-page' },
      }, {} as never);
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

    let navigatedPage: { id: string; title: string; url: string } | undefined;
    await act(async () => {
      navigatedPage = await webmcpTool.execute?.({
        tool: 'navigate_browser_page',
        args: { pageId: docsPage!.id, url: 'https://example.com/navigation', title: 'Navigate Tab' },
      }, {} as never) as { id: string; title: string; url: string };
    });
    expect(navigatedPage).toEqual(expect.objectContaining({ id: docsPage!.id, title: 'Navigate Tab', url: 'https://example.com/navigation' }));
    expect(screen.getByText('Navigate Tab')).toBeInTheDocument();

    await act(async () => {
      docsHistory = await webmcpTool.execute?.({
        tool: 'read_browser_page_history',
        args: { pageId: docsPage!.id },
      }, {} as never) as { pageId: string; currentIndex: number; entries: Array<{ url: string; title: string }> };
    });
    expect(docsHistory).toEqual(expect.objectContaining({
      pageId: docsPage!.id,
      currentIndex: 1,
      entries: expect.arrayContaining([
        expect.objectContaining({ url: docsPage!.url, title: docsPage!.title }),
        expect.objectContaining({ url: 'https://example.com/navigation', title: 'Navigate Tab' }),
      ]),
    }));

    let refreshedPage: { id: string; title: string; url: string } | undefined;
    await act(async () => {
      refreshedPage = await webmcpTool.execute?.({
        tool: 'refresh_browser_page',
        args: { pageId: docsPage!.id },
      }, {} as never) as { id: string; title: string; url: string };
    });
    expect(refreshedPage).toEqual(expect.objectContaining({ id: docsPage!.id, url: 'https://example.com/navigation' }));

    let browserBackPage: { id: string; title: string; url: string } | undefined;
    await act(async () => {
      browserBackPage = await webmcpTool.execute?.({
        tool: 'navigate_browser_page_history',
        args: { pageId: docsPage!.id, direction: 'back' },
      }, {} as never) as { id: string; title: string; url: string };
    });
    expect(browserBackPage).toEqual(expect.objectContaining({ id: docsPage!.id, url: docsPage!.url }));

    let browserForwardPage: { id: string; title: string; url: string } | undefined;
    await act(async () => {
      browserForwardPage = await webmcpTool.execute?.({
        tool: 'navigate_browser_page_history',
        args: { pageId: docsPage!.id, direction: 'forward' },
      }, {} as never) as { id: string; title: string; url: string };
    });
    expect(browserForwardPage).toEqual(expect.objectContaining({ id: docsPage!.id, url: 'https://example.com/navigation' }));

    let sessions: Array<{ id: string; name: string; isOpen: boolean }> = [];
    await act(async () => {
      sessions = await webmcpTool.execute?.({ tool: 'list_sessions' }, {} as never) as Array<{ id: string; name: string; isOpen: boolean }>;
    });
    const sessionOne = sessions.find((session) => session.name === 'Session 1');
    expect(sessionOne).toBeDefined();

    let initialAvailableSessionTools: Array<{
      id: string;
      selected: boolean;
    }> = [];
    await act(async () => {
      initialAvailableSessionTools = await webmcpTool.execute?.({
        tool: 'list_session_tools',
        args: { sessionId: sessionOne!.id },
      }, {} as never) as Array<{
        id: string;
        selected: boolean;
      }>;
    });
    const initiallySelectedNonCliToolIds = initialAvailableSessionTools
      .filter((descriptor) => descriptor.selected && descriptor.id !== 'cli')
      .map((descriptor) => descriptor.id);
    if (initiallySelectedNonCliToolIds.length) {
      await act(async () => {
        await webmcpTool.execute?.({
          tool: 'change_session_tools',
          args: { sessionId: sessionOne!.id, action: 'deselect', toolIds: initiallySelectedNonCliToolIds },
        }, {} as never);
        await Promise.resolve();
      });
    }

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
        tool: 'submit_session_message',
        args: { sessionId: sessionOne!.id, message: 'Message from WebMCP' },
      }, {} as never);
      await Promise.resolve();
    });
    expect(screen.getByText('Message from WebMCP')).toBeInTheDocument();

    let updatedSessionState: { provider: string | null; modelId: string | null } | undefined;
    await act(async () => {
      updatedSessionState = await webmcpTool.execute?.({
        tool: 'change_session_model',
        args: { sessionId: sessionOne!.id, provider: 'ghcp', modelId: 'gpt-4.1' },
      }, {} as never) as { provider: string | null; modelId: string | null };
    });
    expect(updatedSessionState).toEqual(expect.objectContaining({ provider: 'ghcp', modelId: 'gpt-4.1' }));

    let terminalSessionState: { mode: string } | undefined;
    await act(async () => {
      terminalSessionState = await webmcpTool.execute?.({
        tool: 'switch_session_mode',
        args: { sessionId: sessionOne!.id, mode: 'terminal' },
      }, {} as never) as { mode: string };
      await Promise.resolve();
    });
    expect(terminalSessionState).toEqual(expect.objectContaining({ mode: 'terminal' }));
    expect(screen.getByRole('heading', { name: 'Terminal' })).toBeInTheDocument();

    let cliSessionTools: Array<{
      id: string;
      label: string;
      selected: boolean;
    }> = [];
    await act(async () => {
      cliSessionTools = await webmcpTool.execute?.({
        tool: 'list_session_tools',
        args: { sessionId: sessionOne!.id, query: 'bash commands' },
      }, {} as never) as Array<{
        id: string;
        label: string;
        selected: boolean;
      }>;
    });
    expect(cliSessionTools).toEqual([
      expect.objectContaining({ id: 'cli', label: 'CLI', selected: true }),
    ]);

    let availableSessionTools: Array<{
      id: string;
      selected: boolean;
    }> = [];
    await act(async () => {
      availableSessionTools = await webmcpTool.execute?.({
        tool: 'list_session_tools',
        args: { sessionId: sessionOne!.id },
      }, {} as never) as Array<{
        id: string;
        selected: boolean;
      }>;
    });
    const nonCliToolId = availableSessionTools.find((descriptor) => descriptor.id !== 'cli')?.id;
    expect(nonCliToolId).toBeDefined();

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'change_session_tools',
        args: { sessionId: sessionOne!.id, action: 'select', toolIds: [nonCliToolId!] },
      }, {} as never);
      await Promise.resolve();
    });

    await act(async () => {
      availableSessionTools = await webmcpTool.execute?.({
        tool: 'list_session_tools',
        args: { sessionId: sessionOne!.id },
      }, {} as never) as Array<{
        id: string;
        selected: boolean;
      }>;
    });
    const toolIdsToDeselect = availableSessionTools
      .filter((descriptor) => descriptor.selected && descriptor.id !== 'cli')
      .map((descriptor) => descriptor.id);
    expect(toolIdsToDeselect).toEqual([nonCliToolId]);

    let updatedSessionToolsState: {
      toolIds: string[];
    } | undefined;
    await act(async () => {
      updatedSessionToolsState = await webmcpTool.execute?.({
        tool: 'change_session_tools',
        args: { sessionId: sessionOne!.id, action: 'deselect', toolIds: toolIdsToDeselect },
      }, {} as never) as {
        toolIds: string[];
      };
      await Promise.resolve();
    });
    expect(updatedSessionToolsState).toEqual(expect.objectContaining({ toolIds: ['cli'] }));

    fireEvent.click(screen.getByRole('tab', { name: 'Chat mode' }));

    expect(screen.queryByRole('combobox', { name: 'Session AGENTS.md' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Configure tools/i })).toHaveAttribute('aria-label', expect.stringMatching(/1 of \d+ selected/));

    let createdSessionFile: { sessionId: string; path: string; kind: string; content: string } | undefined;
    await act(async () => {
      createdSessionFile = await webmcpTool.execute?.({
        tool: 'add_filesystem_entry',
        args: {
          action: 'create',
          targetType: 'session-fs-entry',
          sessionId: sessionOne!.id,
          kind: 'file',
          path: '/workspace/notes.md',
          content: 'notes from tool',
        },
      }, {} as never) as { sessionId: string; path: string; kind: string; content: string };
      await Promise.resolve();
    });
    expect(createdSessionFile).toEqual(expect.objectContaining({
      sessionId: sessionOne!.id,
      path: '/workspace/notes.md',
      kind: 'file',
      content: 'notes from tool',
    }));

    let readSessionFolder: Array<{ label: string; path: string; kind: string }> = [];
    await act(async () => {
      readSessionFolder = await webmcpTool.execute?.({
        tool: 'list_filesystem_entries',
        args: { targetType: 'session-fs-entry', sessionId: sessionOne!.id, parentPath: '/workspace' },
      }, {} as never) as Array<{ label: string; path: string; kind: string }>;
    });
    expect(readSessionFolder).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'notes.md', path: '/workspace/notes.md', kind: 'file' }),
    ]));

    let sessionDrives: Array<{ targetType: string; kind: string; sessionId: string; label: string; mounted: boolean }> = [];
    await act(async () => {
      sessionDrives = await webmcpTool.execute?.({ tool: 'list_filesystem_entries', args: { targetType: 'session-drive' } }, {} as never) as Array<{ targetType: string; kind: string; sessionId: string; label: string; mounted: boolean }>;
    });
    expect(sessionDrives).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetType: 'session-drive', kind: 'drive', sessionId: sessionOne!.id, mounted: true }),
    ]));

    let sessionDriveProperties: { sessionId: string; kind: string; mounted: boolean } | undefined;
    await act(async () => {
      sessionDriveProperties = await webmcpTool.execute?.({
        tool: 'read_filesystem_properties',
        args: { targetType: 'session-drive', sessionId: sessionOne!.id },
      }, {} as never) as { sessionId: string; kind: string; mounted: boolean };
    });
    expect(sessionDriveProperties).toEqual(expect.objectContaining({ sessionId: sessionOne!.id, kind: 'drive', mounted: true }));

    let sessionDriveHistory: { records: Array<{ id: string }> } | undefined;
    await act(async () => {
      sessionDriveHistory = await webmcpTool.execute?.({
        tool: 'read_filesystem_history',
        args: { targetType: 'session-drive', sessionId: sessionOne!.id },
      }, {} as never) as { records: Array<{ id: string }> };
      await Promise.resolve();
    });
    expect(sessionDriveHistory?.records[0]?.id).toBeTruthy();

    let rolledBackSessionDriveHistory: { rolledBackToId: string } | undefined;
    await act(async () => {
      rolledBackSessionDriveHistory = await webmcpTool.execute?.({
        tool: 'rollback_filesystem_history',
        args: {
          targetType: 'session-drive',
          sessionId: sessionOne!.id,
          recordId: sessionDriveHistory!.records[0]!.id,
        },
      }, {} as never) as { rolledBackToId: string };
      await Promise.resolve();
    });
    expect(rolledBackSessionDriveHistory).toEqual(expect.objectContaining({ rolledBackToId: sessionDriveHistory!.records[0]!.id }));

    await ensureFilesExpanded();
    await expandSessionFsDrive();
    await expandWorkspaceDrive();

    let visibleWorktreeItems: Array<{ id: string; itemType: string; label: string }> = [];
    await act(async () => {
      visibleWorktreeItems = await webmcpTool.execute?.({ tool: 'list_worktree_items' }, {} as never) as Array<{ id: string; itemType: string; label: string }>;
    });
    const visibleVfsItem = visibleWorktreeItems.find((item) => item.itemType === 'session-fs-entry');
    expect(visibleVfsItem).toBeDefined();

    let worktreeItems: Array<{ id: string; itemType: string; label: string }> = [];
    await act(async () => {
      worktreeItems = await webmcpTool.execute?.({ tool: 'list_worktree_items' }, {} as never) as Array<{ id: string; itemType: string; label: string }>;
    });
    expect(worktreeItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemType: 'browser-page', label: 'Transformers.js' }),
      expect.objectContaining({ itemType: 'session', label: 'Session 1' }),
      expect.objectContaining({ itemType: 'clipboard', label: 'Clipboard' }),
    ]));

    const browserItem = worktreeItems.find((item) => item.itemType === 'browser-page' && item.label === 'Transformers.js');
    const createdBrowserItem = worktreeItems.find((item) => item.itemType === 'browser-page' && item.label === 'MCP Tab');
    const sessionItem = worktreeItems.find((item) => item.itemType === 'session' && item.label === 'Session 1');
    const vfsItem = worktreeItems.find((item) => item.itemType === 'session-fs-entry');
    const clipboardItem = worktreeItems.find((item) => item.itemType === 'clipboard');
    expect(browserItem).toBeDefined();
    expect(createdBrowserItem).toBeDefined();
    expect(sessionItem).toBeDefined();
    expect(vfsItem).toBeDefined();
    expect(clipboardItem).toBeDefined();

    let initialRenderPaneState: { isOpen: boolean; supported: boolean } | undefined;
    await act(async () => {
      initialRenderPaneState = await webmcpTool.execute?.({
        tool: 'read_worktree_render_pane_state',
        args: { itemId: browserItem!.id, itemType: browserItem!.itemType },
      }, {} as never) as { isOpen: boolean; supported: boolean };
    });
    expect(initialRenderPaneState).toEqual(expect.objectContaining({ isOpen: false, supported: true }));

    let toggledRenderPaneState: { isOpen: boolean; supported: boolean } | undefined;
    await act(async () => {
      toggledRenderPaneState = await webmcpTool.execute?.({
        tool: 'toggle_worktree_render_pane',
        args: { itemId: browserItem!.id, itemType: browserItem!.itemType },
      }, {} as never) as { isOpen: boolean; supported: boolean };
    });
    expect(toggledRenderPaneState).toEqual(expect.objectContaining({ isOpen: true, supported: true }));
    expect(screen.getByLabelText('Page overlay')).toBeInTheDocument();

    let initialContextMenuState: { isOpen: boolean; supported: boolean } | undefined;
    await act(async () => {
      initialContextMenuState = await webmcpTool.execute?.({
        tool: 'read_worktree_context_menu_state',
        args: { itemId: browserItem!.id, itemType: browserItem!.itemType },
      }, {} as never) as { isOpen: boolean; supported: boolean };
    });
    expect(initialContextMenuState).toEqual(expect.objectContaining({ isOpen: false, supported: true }));

    let toggledContextMenuState: { isOpen: boolean; supported: boolean } | undefined;
    await act(async () => {
      toggledContextMenuState = await webmcpTool.execute?.({
        tool: 'toggle_worktree_context_menu',
        args: { itemId: browserItem!.id, itemType: browserItem!.itemType },
      }, {} as never) as { isOpen: boolean; supported: boolean };
    });
    expect(toggledContextMenuState).toEqual(expect.objectContaining({ isOpen: true, supported: true }));
    expect(screen.getByRole('menu', { name: 'Context menu' })).toBeInTheDocument();

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'toggle_worktree_context_menu',
        args: { itemId: browserItem!.id, itemType: browserItem!.itemType },
      }, {} as never);
    });
    expect(screen.queryByRole('menu', { name: 'Context menu' })).not.toBeInTheDocument();

    let browserActions: Array<{ id: string; label: string }> = [];
    let sessionActions: Array<{ id: string; label: string }> = [];
    let vfsActions: Array<{ id: string; label: string }> = [];
    let clipboardActions: Array<{ id: string; label: string }> = [];
    await act(async () => {
      vfsActions = await webmcpTool.execute?.({
        tool: 'list_worktree_context_actions',
        args: { itemId: visibleVfsItem!.id, itemType: visibleVfsItem!.itemType },
      }, {} as never) as Array<{ id: string; label: string }>;
      browserActions = await webmcpTool.execute?.({
        tool: 'list_worktree_context_actions',
        args: { itemId: browserItem!.id, itemType: browserItem!.itemType },
      }, {} as never) as Array<{ id: string; label: string }>;
      sessionActions = await webmcpTool.execute?.({
        tool: 'list_worktree_context_actions',
        args: { itemId: sessionItem!.id, itemType: sessionItem!.itemType },
      }, {} as never) as Array<{ id: string; label: string }>;
      clipboardActions = await webmcpTool.execute?.({
        tool: 'list_worktree_context_actions',
        args: { itemId: clipboardItem!.id, itemType: clipboardItem!.itemType },
      }, {} as never) as Array<{ id: string; label: string }>;
    });

    expect(browserActions).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'toggle_bookmark' }), expect.objectContaining({ id: 'properties' })]));
    expect(sessionActions).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'share' }), expect.objectContaining({ id: 'rename' })]));
    expect(vfsActions).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'new_file' }), expect.objectContaining({ id: 'history' })]));
    expect(clipboardActions).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'history' }), expect.objectContaining({ id: 'properties' })]));

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'invoke_worktree_context_action',
        args: { itemId: browserItem!.id, itemType: browserItem!.itemType, actionId: 'toggle_bookmark', args: {} },
      }, {} as never);
      await Promise.resolve();
    });

    let bookmarkedBrowserPage: { persisted: boolean; title: string; url: string } | undefined;
    await act(async () => {
      bookmarkedBrowserPage = await webmcpTool.execute?.({
        tool: 'read_browser_page',
        args: { pageId: browserItem!.id },
      }, {} as never) as { persisted: boolean; title: string; url: string };
    });
    expect(bookmarkedBrowserPage).toEqual(expect.objectContaining({ persisted: true }));

    let createdSession: { id: string; name: string; isOpen: boolean } | undefined;
    await act(async () => {
      createdSession = await webmcpTool.execute?.({
        tool: 'create_session',
        args: { name: 'Ops Session' },
      }, {} as never) as { id: string; name: string; isOpen: boolean };
    });
    expect(createdSession).toEqual(expect.objectContaining({ name: 'Ops Session', isOpen: true }));
    expect(screen.getByText('Ops Session')).toBeInTheDocument();

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'toggle_worktree_render_pane',
        args: { itemId: docsPage!.id, itemType: 'browser-page' },
      }, {} as never);
      await Promise.resolve();
    });

    let renderPanes: Array<{ id: string; paneType: string; itemId: string; label: string }> = [];
    await act(async () => {
      renderPanes = await webmcpTool.execute?.({ tool: 'list_render_panes' }, {} as never) as Array<{ id: string; paneType: string; itemId: string; label: string }>;
    });
    expect(renderPanes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: `session:${createdSession!.id}`, paneType: 'session', itemId: createdSession!.id }),
      expect.objectContaining({ id: `browser:${docsPage!.id}`, paneType: 'browser-page', itemId: docsPage!.id }),
    ]));

    let movedRenderPanes: Array<{ id: string; paneType: string; itemId: string; label: string }> = [];
    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'move_render_pane',
        args: { paneId: `browser:${docsPage!.id}`, toIndex: 0 },
      }, {} as never);
      await Promise.resolve();
    });

    await act(async () => {
      movedRenderPanes = await webmcpTool.execute?.({ tool: 'list_render_panes' }, {} as never) as Array<{ id: string; paneType: string; itemId: string; label: string }>;
    });

    expect(movedRenderPanes[0]).toEqual(expect.objectContaining({ id: `browser:${docsPage!.id}` }));

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'change_filesystem_mount',
        args: { action: 'unmount', sessionId: sessionOne!.id },
      }, {} as never);
      await Promise.resolve();
    });

    let unmountedSessionDrives: Array<{ sessionId: string; label: string; mounted: boolean }> = [];
    let afterUnmountFsEntries: Array<{ sessionId: string; path: string; kind: string }> = [];
    await act(async () => {
      unmountedSessionDrives = await webmcpTool.execute?.({ tool: 'list_filesystem_entries', args: { targetType: 'session-drive' } }, {} as never) as Array<{ sessionId: string; label: string; mounted: boolean }>;
      afterUnmountFsEntries = await webmcpTool.execute?.({ tool: 'list_filesystem_entries', args: { targetType: 'session-fs-entry', sessionId: sessionOne!.id } }, {} as never) as Array<{ sessionId: string; path: string; kind: string }>;
    });
    expect(unmountedSessionDrives).toEqual(expect.arrayContaining([
      expect.objectContaining({ sessionId: sessionOne!.id, mounted: false }),
    ]));
    expect(afterUnmountFsEntries.find((entry) => entry.sessionId === sessionOne!.id)).toBeUndefined();

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'change_filesystem_mount',
        args: { action: 'mount', sessionId: sessionOne!.id },
      }, {} as never);
      await Promise.resolve();
    });

    let remountedSessionDrives: Array<{ sessionId: string; label: string; mounted: boolean }> = [];
    let afterRemountFsEntries: Array<{ sessionId: string; path: string; kind: string }> = [];
    await act(async () => {
      remountedSessionDrives = await webmcpTool.execute?.({ tool: 'list_filesystem_entries', args: { targetType: 'session-drive' } }, {} as never) as Array<{ sessionId: string; label: string; mounted: boolean }>;
      afterRemountFsEntries = await webmcpTool.execute?.({ tool: 'list_filesystem_entries', args: { targetType: 'session-fs-entry', sessionId: sessionOne!.id } }, {} as never) as Array<{ sessionId: string; path: string; kind: string }>;
    });
    expect(remountedSessionDrives).toEqual(expect.arrayContaining([
      expect.objectContaining({ sessionId: sessionOne!.id, mounted: true }),
    ]));
    expect(afterRemountFsEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ sessionId: sessionOne!.id, path: '/workspace/notes.md', kind: 'file' }),
    ]));

    await act(async () => {
      await webmcpTool.execute?.({
        tool: 'invoke_worktree_context_action',
        args: { itemId: browserItem!.id, itemType: browserItem!.itemType, actionId: 'copy_uri', args: {} },
      }, {} as never);
      await webmcpTool.execute?.({
        tool: 'invoke_worktree_context_action',
        args: { itemId: createdBrowserItem!.id, itemType: createdBrowserItem!.itemType, actionId: 'copy_uri', args: {} },
      }, {} as never);
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(bookmarkedBrowserPage!.url);
    expect(writeText).toHaveBeenCalledWith(createdPage!.url);

    let clipboardEntries: Array<{ id: string; label: string; text: string; isActive: boolean }> = [];
    await act(async () => {
      clipboardEntries = await webmcpTool.execute?.({ tool: 'list_clipboard_history' }, {} as never) as Array<{ id: string; label: string; text: string; isActive: boolean }>;
    });
    const copiedBrowserEntry = clipboardEntries.find((entry) => entry.text === bookmarkedBrowserPage!.url);
    const copiedCreatedEntry = clipboardEntries.find((entry) => entry.text === createdPage!.url);
    expect(copiedBrowserEntry).toEqual(expect.objectContaining({
      label: `URI: ${bookmarkedBrowserPage!.title}`,
      text: bookmarkedBrowserPage!.url,
    }));
    expect(copiedCreatedEntry).toEqual(expect.objectContaining({ label: 'URI: MCP Tab', text: createdPage!.url }));

    let clipboardEntry: { id: string; label: string; text: string; isActive: boolean } | undefined;
    await act(async () => {
      clipboardEntry = await webmcpTool.execute?.({
        tool: 'read_clipboard_entry',
        args: { entryId: copiedBrowserEntry!.id },
      }, {} as never) as { id: string; label: string; text: string; isActive: boolean };
    });
    expect(clipboardEntry).toEqual(expect.objectContaining({ id: copiedBrowserEntry!.id, text: bookmarkedBrowserPage!.url }));

    let restoredClipboardEntry: { id: string; label: string; text: string; isActive: boolean } | undefined;
    await act(async () => {
      restoredClipboardEntry = await webmcpTool.execute?.({
        tool: 'restore_clipboard_entry',
        args: { entryId: copiedBrowserEntry!.id },
      }, {} as never) as { id: string; label: string; text: string; isActive: boolean };
      await Promise.resolve();
    });
    expect(restoredClipboardEntry).toEqual(expect.objectContaining({ id: copiedBrowserEntry!.id, text: bookmarkedBrowserPage!.url, isActive: true }));
    expect(screen.getByText('Clipboard restored')).toBeInTheDocument();
    expect(writeText).toHaveBeenLastCalledWith(bookmarkedBrowserPage!.url);

    let movedWorkspaceFile: { path: string; content: string } | undefined;
    await act(async () => {
      movedWorkspaceFile = await webmcpTool.execute?.({
        tool: 'update_filesystem_entry',
        args: {
          action: 'move',
          targetType: 'workspace-file',
          path: '.agents/plugins/review-tools/agent-harness.plugin.json',
          nextPath: '.agents/plugins/review-tools-copy/agent-harness.plugin.json',
        },
      }, {} as never) as { path: string; content: string };
    });
    expect(movedWorkspaceFile).toEqual(expect.objectContaining({ path: '.agents/plugins/review-tools-copy/agent-harness.plugin.json' }));

    let movedWorkspaceFileContent: { path: string; preview: string } | undefined;
    await act(async () => {
      movedWorkspaceFileContent = await webmcpTool.execute?.({
        tool: 'read_filesystem_properties',
        args: { targetType: 'workspace-file', path: '.agents/plugins/review-tools-copy/agent-harness.plugin.json' },
      }, {} as never) as { path: string; preview: string };
    });
    expect(movedWorkspaceFileContent).toEqual(expect.objectContaining({
      path: '.agents/plugins/review-tools-copy/agent-harness.plugin.json',
      preview: expect.stringContaining('Review helpers.'),
    }));

    let duplicatedWorkspaceFile: { path: string } | undefined;
    await act(async () => {
      duplicatedWorkspaceFile = await webmcpTool.execute?.({
        tool: 'add_filesystem_entry',
        args: {
          action: 'duplicate',
          targetType: 'workspace-file',
          kind: 'file',
          path: '.agents/plugins/review-tools-duplicate/agent-harness.plugin.json',
          sourcePath: '.agents/plugins/review-tools-copy/agent-harness.plugin.json',
        },
      }, {} as never) as { path: string };
    });
    expect(duplicatedWorkspaceFile).toEqual(expect.objectContaining({ path: '.agents/plugins/review-tools-duplicate/agent-harness.plugin.json' }));

    let symlinkedWorkspaceFile: { path: string } | undefined;
    await act(async () => {
      symlinkedWorkspaceFile = await webmcpTool.execute?.({
        tool: 'add_filesystem_entry',
        args: {
          action: 'symlink',
          targetType: 'workspace-file',
          kind: 'file',
          path: '.agents/plugins/review-tools-link/agent-harness.plugin.json',
          sourcePath: '.agents/plugins/review-tools-copy/agent-harness.plugin.json',
        },
      }, {} as never) as { path: string };
    });
    expect(symlinkedWorkspaceFile).toEqual(expect.objectContaining({ path: '.agents/plugins/review-tools-link/agent-harness.plugin.json' }));

    let symlinkedWorkspaceFileContent: { path: string; preview: string } | undefined;
    await act(async () => {
      symlinkedWorkspaceFileContent = await webmcpTool.execute?.({
        tool: 'read_filesystem_properties',
        args: { targetType: 'workspace-file', path: '.agents/plugins/review-tools-link/agent-harness.plugin.json' },
      }, {} as never) as { path: string; preview: string };
    });
    expect(symlinkedWorkspaceFileContent).toEqual(expect.objectContaining({
      path: '.agents/plugins/review-tools-link/agent-harness.plugin.json',
      preview: expect.stringContaining('.agents/plugins/review-tools-copy/agent-harness.plugin.json'),
    }));
  }, 90_000);

  it('supports creating new chat and terminal instances from the tree and panel', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Add session to Research'));
    expect(getTreeItemByText('Session 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    expect(getTreeItemByText('Session 3')).toBeInTheDocument();
  });

  it('renders settings and history labels from the navigation', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('Models')).toBeInTheDocument();
    expect(screen.getByLabelText('History')).toBeInTheDocument();
  });

  it('does not include the DESIGN.md Designer workspace by default', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    expect(screen.queryByLabelText('Designer')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Design Studio' })).not.toBeInTheDocument();
  });

  it('renders model providers in a dedicated Models sidepanel instead of Settings', async () => {
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
    fetchCodexStateMock.mockResolvedValue(createCodexState({
      authenticated: true,
      statusMessage: 'Codex CLI 0.125.0 available.',
      models: [{ id: 'codex-default', name: 'Codex default', reasoning: true, vision: false }],
    }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByLabelText('Models'));

    expect(screen.getByRole('heading', { name: 'Models' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Find the Right Model for Your AI Solution' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Model catalog providers' })).toBeInTheDocument();
    expectModelProviderStatus(/GitHub Copilot Models \(1\)/i, 'Ready');
    expectModelProviderStatus(/Codex Models \(1\)/i, 'Ready');
    expect(screen.getByRole('region', { name: /Local Browser Models/i })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Model catalog providers' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Search model catalog')).not.toBeInTheDocument();
  });

  it('renders models as a collapsible provider surface', async () => {
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

    fireEvent.click(screen.getByLabelText('Models'));

    expect(screen.getByRole('heading', { name: 'Models' })).toBeInTheDocument();

    const providerNav = screen.getByRole('navigation', { name: 'Model catalog providers' });
    expect(within(providerNav).getByRole('button', { name: /Popular/i })).toHaveAttribute('aria-pressed', 'true');
    expect(within(providerNav).getByRole('button', { name: /GitHub Copilot/i })).toBeInTheDocument();
    expect(within(providerNav).getByRole('button', { name: /Cursor/i })).toBeInTheDocument();
    expect(within(providerNav).getByRole('button', { name: /Codex/i })).toBeInTheDocument();

    fireEvent.click(within(providerNav).getByRole('button', { name: /GitHub Copilot/i }));

    expect(within(providerNav).getByRole('button', { name: /GitHub Copilot/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Refresh GitHub Copilot status' })).toBeInTheDocument();

    fireEvent.click(within(providerNav).getByRole('button', { name: /Local/i }));

    expect(within(providerNav).getByRole('button', { name: /Local/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Refresh GitHub Copilot status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh Cursor status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh Codex status' })).not.toBeInTheDocument();
  });

  it('does not apply DESIGN.md themes from settings by default', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(WORKSPACE_FILES_STORAGE_KEY, JSON.stringify({
      'ws-research': [{
        path: 'DESIGN.md',
        updatedAt: '2026-05-02T00:00:00.000Z',
        content: `---
name: Agent Browser Design System
colors:
  canvas: "#1e1e1e"
  surface: "#181818"
  accent: "#0ea5e9"
  text: "#e4e4e7"
themes:
  claude-light:
    colors:
      canvas: "#f8f6f2"
      surface: "#ffffff"
      accent: "#d97757"
styles:
  agentBrowser:
    app-bg: colors.canvas
    panel-bg: colors.surface
    accent: colors.accent
  widgets:
    buttonPrimary:
      background: colors.accent
      color: colors.text
---
# Design system
`,
      }],
    }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.queryByLabelText('Design Studio theme')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Apply Design Studio theme to Agent Browser')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Generated Design Studio CSS')).not.toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue('--app-bg')).toBe('');
  });

  it('manages secrets and redaction settings from the settings panel without revealing values', async () => {
    vi.useFakeTimers();
    const stripeLikeSecret = ['sk', 'live', '1234567890abcdefghijklmnopqrstuv'].join('_');
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByLabelText('Settings'));
    expect(screen.getByRole('button', { name: 'Secrets (0)' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Secret name'), { target: { value: 'STRIPE_SECRET_KEY' } });
    fireEvent.change(screen.getByLabelText('Secret value'), { target: { value: stripeLikeSecret } });
    fireEvent.click(screen.getByRole('button', { name: 'Add secret' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Secrets (1)' })).toBeInTheDocument();
    expect(screen.getByText('STRIPE_SECRET_KEY')).toBeInTheDocument();
    expect(screen.getByText('secret-ref://local/stripe-secret-key')).toBeInTheDocument();
    expect(screen.getByText('••••••••••••••••')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(stripeLikeSecret);

    fireEvent.click(screen.getByLabelText('Disable high entropy secret fallback'));
    expect(JSON.parse(window.localStorage.getItem('agent-browser.secret-management-settings') ?? '{}')).toMatchObject({
      detectHighEntropySecrets: false,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete secret STRIPE_SECRET_KEY' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Secrets (0)' })).toBeInTheDocument();
    expect(screen.queryByText('STRIPE_SECRET_KEY')).not.toBeInTheDocument();
  });

  it('manages custom LogAct evaluation agents from settings', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByLabelText('Settings'));
    fireEvent.click(screen.getByRole('button', { name: 'LogAct evaluation agents (0)' }));

    fireEvent.change(screen.getByLabelText('Evaluation agent name'), { target: { value: 'Accessibility Teacher' } });
    fireEvent.change(screen.getByLabelText('Evaluation agent instructions'), { target: { value: 'Steer candidates toward accessible UI.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save evaluation agent' }));

    expect(screen.getByText('Accessibility Teacher')).toBeInTheDocument();
    expect(window.localStorage.getItem('agent-browser:evaluation-agents:ws-research')).toContain('Accessibility Teacher');

    fireEvent.click(screen.getByRole('button', { name: /Disable Accessibility Teacher/i }));
    expect(screen.getByRole('button', { name: /Enable Accessibility Teacher/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Export evaluation agents JSON' }));
    const jsonField = screen.getByLabelText('Evaluation agents JSON') as HTMLTextAreaElement;
    expect(jsonField.value).toContain('Accessibility Teacher');

    fireEvent.click(screen.getByRole('button', { name: 'Reset evaluation agents' }));
    expect(screen.queryByText('Accessibility Teacher')).not.toBeInTheDocument();

    fireEvent.change(jsonField, { target: { value: '[{"id":"judge-evals","kind":"judge","name":"Eval Judge","instructions":"Score with evals.","enabled":true,"rubricCriteria":["tests pass"]}]' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import evaluation agents JSON' }));
    expect(screen.getByText('Eval Judge')).toBeInTheDocument();
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
    await openDefaultSessionPanel();

    openDefaultSession();

    expect(screen.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('ghcp');
    expect(screen.getByRole('combobox', { name: 'GHCP model' })).toHaveValue('gpt-4.1');
    expect(screen.getByLabelText('Chat input')).toHaveAttribute('placeholder', 'Ask GHCP…');
  });

  it('shows normalized GHCP models in Models and provider controls', async () => {
    vi.useFakeTimers();
    fetchCopilotStateMock.mockResolvedValue(createCopilotState({
      authenticated: true,
      login: 'octocat',
      models: [{
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        reasoning: true,
        vision: true,
        contextWindow: 128000,
        maxOutputTokens: 4096,
      }],
    }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    await openDefaultSessionPanel();

    openDefaultSession();

    expect(screen.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('ghcp');
    expect(screen.getByRole('combobox', { name: 'GHCP model' })).toHaveValue('gpt-4.1');

    fireEvent.click(screen.getByLabelText('Models'));
    const ghcpSection = expectModelProviderStatus(/GitHub Copilot Models \(1\)/i, 'Ready');
    selectModelCatalogSource(/GitHub Copilot/i);

    expect(within(ghcpSection).getByText('GPT-4.1')).toBeInTheDocument();
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

    fireEvent.click(screen.getByLabelText('Models'));
    selectModelCatalogSource(/Local/i);
    fireEvent.click(screen.getByRole('button', { name: /Test Model/i }));

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByLabelText('Projects'));
    await openDefaultSessionPanel();

    expect(screen.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('codi');
    expect(screen.getByRole('combobox', { name: 'Codi model' })).toHaveValue('hf-test-model');
    expect(screen.getByLabelText('Chat input')).toHaveAttribute('placeholder', 'Ask Codi…');
  });

  it('shows the Copilot sign-in path in Models without making it the default provider', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    await openDefaultSessionPanel();

    openDefaultSession();

    expect(screen.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('codi');

    fireEvent.click(screen.getByLabelText('Models'));

    const ghcpSection = expectModelProviderStatus(/GitHub Copilot Models \(0\)/i, 'Needs auth');
    expect(within(ghcpSection).getByText('Sign in or refresh to load GitHub Copilot models.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open GitHub Copilot sign-in docs' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('GitHub Copilot sign-in command')).not.toBeInTheDocument();
  });

  it('does not show the Copilot sign-in path when authenticated model listing fails', async () => {
    vi.useFakeTimers();
    fetchCopilotStateMock.mockResolvedValue(createCopilotState({
      authenticated: true,
      login: 'octocat',
      error: 'Failed to list GitHub Copilot models: models.list failed',
      models: [],
    }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByLabelText('Models'));

    const ghcpSection = expectModelProviderStatus(/GitHub Copilot Models \(0\)/i, 'Signed in');
    expect(within(ghcpSection).getByText('Failed to list GitHub Copilot models: models.list failed')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open GitHub Copilot sign-in docs' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('GitHub Copilot sign-in command')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh GitHub Copilot status' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Refresh .* status/i }).length).toBeGreaterThanOrEqual(3);
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

    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'review-tools' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plugin' }));

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByLabelText('File editor')).toBeInTheDocument();

    // Open add file modal again, name it, and add a hook
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'pre-task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hook' }));

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    await ensureFilesExpanded();
    await expandWorkspaceDrive();
    await clickTreeButton('.agents');
    await clickTreeButton('hooks');

    expect(screen.getByText('pre-task.sh')).toBeInTheDocument();

    const storedFiles = JSON.parse(window.localStorage.getItem(WORKSPACE_FILES_STORAGE_KEY) ?? '{}') as Record<string, Array<{ path: string }>>;
    expect(storedFiles['ws-research']).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '.agents/plugins/review-tools/agent-harness.plugin.json' }),
      expect.objectContaining({ path: '.agents/hooks/pre-task.sh' }),
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
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'review-tools' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plugin' }));

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByLabelText('File editor')).toBeInTheDocument();
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

    // Add a memory file via the tree "+" button
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'project' } });
    fireEvent.click(screen.getByRole('button', { name: 'Memory' }));

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    // Edit the file content in the file editor (now in the content area)
    fireEvent.change(screen.getByLabelText('Workspace file content'), { target: { value: '# Project memory\n\n- Always run workspace checks first.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save file' }));

    expect(screen.queryByLabelText('Workspace file path')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));
    expect(screen.getByLabelText('Chat panel')).toBeInTheDocument();

    await installLocalModel();
    await disableAllTools();
    // Send a message
    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Summarize the workspace rules.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();

    expect(generateMock).toHaveBeenCalledTimes(1);
    const prompt = generateMock.mock.calls[0][0].prompt as Array<{ role: string; content: string }>;
    expect(prompt).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'system', content: expect.stringContaining('Active workspace: Research') }),
      expect.objectContaining({ role: 'system', content: expect.stringContaining('Always run workspace checks first.') }),
    ]));
    expect(prompt.map((entry) => entry.content).join('\n')).not.toContain('Copilot bridge');
    expect(prompt.map((entry) => entry.content).join('\n')).not.toContain('GitHub Copilot');
  });

  it('copies an assistant message as markdown through the clipboard feature', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });
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
    generateMock.mockImplementation(async (_input, callbacks) => {
      callbacks.onToken?.('## Result\n\nUse **bold** and [docs](https://example.test).');
      callbacks.onDone?.({ generated_text: '## Result\n\nUse **bold** and [docs](https://example.test).' });
      return undefined;
    });

    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });
    await installLocalModel();
    await disableAllTools();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Summarize this.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Codi: Test Model message as markdown' }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('## Result\n\nUse **bold** and [docs](https://example.test).');
    expect(screen.getByText('Message copied as markdown')).toBeInTheDocument();

    const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(cbRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));
    expect(screen.getByText('Chat Codi: Test Model message (markdown)')).toBeInTheDocument();
  });

  it('copies a user message as plaintext through the clipboard feature', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });
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
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });
    await installLocalModel();
    await disableAllTools();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Use **bold** and [docs](https://example.test).' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy you message as plaintext' }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('Use bold and docs (https://example.test).');
    expect(screen.getByText('Message copied as plaintext')).toBeInTheDocument();
  });

  it('enables browser notifications from the chat titlebar', async () => {
    vi.useFakeTimers();
    const notifications: Array<{ title: string; options?: NotificationOptions }> = [];
    const requestPermission = vi.fn(async () => {
      MockNotification.permission = 'granted';
      return MockNotification.permission;
    });
    class MockNotification {
      static permission: NotificationPermission = 'default';
      static requestPermission = requestPermission;
      constructor(title: string, options?: NotificationOptions) {
        notifications.push({ title, options });
      }
    }
    const originalNotificationDescriptor = Object.getOwnPropertyDescriptor(window, 'Notification');
    Object.defineProperty(window, 'Notification', { value: MockNotification, configurable: true });

    try {
      render(<App />);
      await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });
      await openDefaultSessionPanel();

      fireEvent.click(screen.getByRole('button', { name: 'Enable browser notifications' }));

      // Flush the async permission-request chain (requestPermission → requestBrowserNotificationPermission → handler continuation)
      await act(async () => { await Promise.resolve(); });
      await act(async () => { await Promise.resolve(); });
      await act(async () => { await Promise.resolve(); });
      // Flush the debounced localStorage write (120 ms debounce)
      await act(async () => { vi.advanceTimersByTime(200); await Promise.resolve(); });

      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(JSON.parse(window.localStorage.getItem('agent-browser.browser-notification-settings') ?? '{}')).toEqual({ enabled: true });
      expect(screen.getByRole('button', { name: 'Disable browser notifications' })).toBeInTheDocument();
      expect(notifications).toEqual([]);
    } finally {
      if (originalNotificationDescriptor) {
        Object.defineProperty(window, 'Notification', originalNotificationDescriptor);
      } else {
        delete (window as Window & { Notification?: typeof Notification }).Notification;
      }
    }
  });

  it('enables opt-in location context and adds approximate coordinates to the assistant prompt', async () => {
    vi.useFakeTimers();
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 41.878113,
          longitude: -87.629799,
          accuracy: 24.6,
        },
        timestamp: Date.parse('2026-04-29T19:00:00.000Z'),
      } as GeolocationPosition);
    });
    const originalGeolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
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

    try {
      render(<App />);
      await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });
      await openDefaultSessionPanel();

      expect(getCurrentPosition).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Enable location context' }));
      await flushAsyncUpdates();
      await act(async () => { vi.advanceTimersByTime(200); await Promise.resolve(); });

      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
      expect(JSON.parse(window.localStorage.getItem('agent-browser.location-context') ?? '{}')).toEqual({
        enabled: true,
        latitude: 41.88,
        longitude: -87.63,
        accuracyMeters: 25,
        capturedAt: '2026-04-29T19:00:00.000Z',
      });
      const modelContext = installModelContext(window);
      const webmcpTool = createWebMcpTool(modelContext!);
      await expect(webmcpTool.execute?.({ tool: 'read_browser_location' }, {} as never)).resolves.toEqual({
        status: 'available',
        latitude: 41.88,
        longitude: -87.63,
        accuracy: 25,
      });
      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Disable location context' })).toBeInTheDocument();
      expect(screen.getByText(/location on/i)).toBeInTheDocument();

      await installLocalModel();
      await disableAllTools();

      fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Find dinner nearby.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await act(async () => { await Promise.resolve(); });

      const prompt = generateMock.mock.calls[0][0].prompt as Array<{ role: string; content: string }>;
      const promptText = prompt.map((entry) => entry.content).join('\n');
      expect(promptText).toContain('Browser location context:');
      expect(promptText).toContain('Approximate coordinates: 41.88, -87.63');
      expect(promptText).toContain('Do not assume it is exact.');
    } finally {
      if (originalGeolocationDescriptor) {
        Object.defineProperty(navigator, 'geolocation', originalGeolocationDescriptor);
      } else {
        Reflect.deleteProperty(navigator, 'geolocation');
      }
    }
  });

  it('shows a browser notification when session chat work completes', async () => {
    const notifications: Array<{ title: string; options?: NotificationOptions }> = [];
    class MockNotification {
      static permission: NotificationPermission = 'granted';
      static requestPermission = vi.fn(async () => MockNotification.permission);
      constructor(title: string, options?: NotificationOptions) {
        notifications.push({ title, options });
      }
    }
    const originalNotificationDescriptor = Object.getOwnPropertyDescriptor(window, 'Notification');
    Object.defineProperty(window, 'Notification', { value: MockNotification, configurable: true });
    window.localStorage.setItem('agent-browser.browser-notification-settings', JSON.stringify({ enabled: true }));
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
    generateMock.mockImplementation(async (_input, callbacks) => {
      callbacks.onDone?.({ generated_text: 'Implementation finished and checks passed.' });
      return undefined;
    });

    try {
      render(<App />);
      await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });
      await installLocalModel();
      await disableAllTools();

      fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Finish the task.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      await act(async () => {
        await Promise.resolve();
      });

      expect(notifications).toEqual([
        {
          title: 'Session work complete',
          options: expect.objectContaining({
            body: 'Research: Implementation finished and checks passed.',
            tag: expect.stringMatching(/:complete$/),
          }),
        },
      ]);
    } finally {
      if (originalNotificationDescriptor) {
        Object.defineProperty(window, 'Notification', originalNotificationDescriptor);
      } else {
        delete (window as Window & { Notification?: typeof Notification }).Notification;
      }
    }
  });

  it('shows a browser notification when an assistant response needs user input', async () => {
    const notifications: Array<{ title: string; options?: NotificationOptions }> = [];
    class MockNotification {
      static permission: NotificationPermission = 'granted';
      static requestPermission = vi.fn(async () => MockNotification.permission);
      constructor(title: string, options?: NotificationOptions) {
        notifications.push({ title, options });
      }
    }
    const originalNotificationDescriptor = Object.getOwnPropertyDescriptor(window, 'Notification');
    Object.defineProperty(window, 'Notification', { value: MockNotification, configurable: true });
    window.localStorage.setItem('agent-browser.browser-notification-settings', JSON.stringify({ enabled: true }));
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
    generateMock.mockImplementation(async (_input, callbacks) => {
      callbacks.onDone?.({ generated_text: 'Can I apply these changes?' });
      return undefined;
    });

    try {
      render(<App />);
      await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });
      await installLocalModel();
      await disableAllTools();

      fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Prepare the patch.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      await act(async () => {
        await Promise.resolve();
      });

      expect(notifications.map((entry) => entry.title)).toEqual([
        'Session work complete',
        'Agent needs input',
      ]);
      expect(notifications[1]?.options).toEqual(expect.objectContaining({
        body: 'Research: Can I apply these changes?',
        tag: expect.stringMatching(/:elicitation$/),
      }));
    } finally {
      if (originalNotificationDescriptor) {
        Object.defineProperty(window, 'Notification', originalNotificationDescriptor);
      } else {
        delete (window as Window & { Notification?: typeof Notification }).Notification;
      }
    }
  });

  it('routes research tasks through the first-class Researcher agent', async () => {
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
    runStagedToolPipelineMock.mockImplementation(async (_options, callbacks) => {
      callbacks.onDone?.('Research complete.');
      return { text: 'Research complete.', steps: 1 };
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Models'));
    selectModelCatalogSource(/Local/i);
    fireEvent.click(screen.getByRole('button', { name: /Test Model/i }));

    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByLabelText('Projects'));
    await openDefaultSessionPanel();

    fireEvent.click(screen.getByLabelText('Projects'));
    openDefaultSession();

    expect(screen.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('codi');

    fireEvent.change(screen.getByLabelText('Chat input'), {
      target: { value: 'Research current browser automation options with citations.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('researcher');
    expect(runStagedToolPipelineMock).toHaveBeenCalledTimes(1);
    expect(runStagedToolPipelineMock.mock.calls[0][0]).toEqual(expect.objectContaining({
      instructions: expect.stringContaining('## Researcher Operating Instructions'),
    }));
    expect(runStagedToolPipelineMock.mock.calls[0][0].instructions).toContain('.research/<task-id>/research.md');
    expect(screen.getByText('Research complete.')).toBeInTheDocument();
  });

  it('routes debugging tasks through the first-class Debugger agent', async () => {
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
    runStagedToolPipelineMock.mockImplementation(async (_options, callbacks) => {
      callbacks.onDone?.('Debugging complete.');
      return { text: 'Debugging complete.', steps: 1 };
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Models'));
    selectModelCatalogSource(/Local/i);
    fireEvent.click(screen.getByRole('button', { name: /Test Model/i }));

    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByLabelText('Projects'));
    await openDefaultSessionPanel();

    fireEvent.click(screen.getByLabelText('Projects'));
    openDefaultSession();

    expect(screen.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('codi');

    fireEvent.change(screen.getByLabelText('Chat input'), {
      target: { value: 'Debug why deployment health checks started failing after release.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('debugger');
    expect(runStagedToolPipelineMock).toHaveBeenCalledTimes(1);
    expect(runStagedToolPipelineMock.mock.calls[0][0]).toEqual(expect.objectContaining({
      instructions: expect.stringContaining('## Debugger Operating Instructions'),
    }));
    expect(runStagedToolPipelineMock.mock.calls[0][0].instructions).toContain('hypothesis ledger');
    expect(screen.getByText('Debugging complete.')).toBeInTheDocument();
  });

  it('shows a stop control and cancels an in-flight chat response without turning it into an error', async () => {
    vi.useFakeTimers();
    let activeSignal: AbortSignal | undefined;
    let emitLateToken: ((token: string) => void) | undefined;
    generateMock.mockImplementation(async (_input, callbacks, signal?: AbortSignal) => {
      activeSignal = signal;
      emitLateToken = callbacks.onToken;
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

    fireEvent.click(screen.getByLabelText('Models'));
    selectModelCatalogSource(/Local/i);
    fireEvent.click(screen.getByRole('button', { name: /Test Model/i }));

    await act(async () => {
      await Promise.resolve();
    });

    await disableAllTools();
    fireEvent.click(screen.getByLabelText('Projects'));
    openDefaultSession();
    await disableAllTools();
    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Write a long answer.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Stop response' })).toBeInTheDocument();
    expect(screen.getByText('Partial draft')).toBeInTheDocument();
    expect(activeSignal?.aborted).toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Stop response' }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(activeSignal?.aborted).toBe(true);
    expect(screen.queryByRole('button', { name: 'Stop response' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    expect(screen.queryByText('Generation stopped.')).not.toBeInTheDocument();

    act(() => {
      emitLateToken?.('Late stream token');
    });

    expect(screen.queryByText('Late stream token')).not.toBeInTheDocument();
    expect(screen.queryByText(/Working/i)).not.toBeInTheDocument();
    expect(document.querySelector('.stream-cursor')).not.toBeInTheDocument();
  });

  it('queues omnibar searches in the composer without auto-sending them', async () => {
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

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await disableAllTools();

    const omnibar = screen.getByLabelText('Omnibar');
    fireEvent.change(omnibar, { target: { value: 'browser sandbox constraints' } });
    fireEvent.submit(omnibar.closest('form')!);

    await act(async () => {
      await Promise.resolve();
    });

    expect(runStagedToolPipelineMock).not.toHaveBeenCalled();
    expect(streamCopilotChatMock).not.toHaveBeenCalled();
    expect(generateMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Chat input')).toHaveValue('Search the web for: browser sandbox constraints');
  });

  it('does not autocomplete agent skills in the chat composer by default', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    await openDefaultSessionPanel();

    const chatInput = screen.getByLabelText('Chat input');
    fireEvent.change(chatInput, { target: { value: 'Use @create' } });

    expect(screen.queryByRole('listbox', { name: 'Skill suggestions' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Chat input')).toHaveValue('Use @create');
    expect(screen.queryByRole('listbox', { name: 'Skill suggestions' })).not.toBeInTheDocument();
  });

  it('recalls chat prompts with ArrowUp and clears the composer at the end of history', async () => {
    vi.useFakeTimers();
    fetchCopilotStateMock.mockResolvedValue(createCopilotState({
      authenticated: true,
      login: 'octocat',
      models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: false }],
    }));
    streamCopilotChatMock.mockImplementation(async (_request, callbacks) => {
      callbacks.onDone?.('ok');
      return Promise.resolve();
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await disableAllTools();
    const chatInput = screen.getByLabelText('Chat input') as HTMLTextAreaElement;

    fireEvent.change(chatInput, { target: { value: 'First turn.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Second turn.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    chatInput.setSelectionRange(0, 0);
    fireEvent.keyDown(chatInput, { key: 'ArrowUp' });
    expect(screen.getByLabelText('Chat input')).toHaveValue('Second turn.');

    chatInput.setSelectionRange(0, 0);
    fireEvent.keyDown(chatInput, { key: 'ArrowUp' });
    expect(screen.getByLabelText('Chat input')).toHaveValue('First turn.');

    chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
    fireEvent.keyDown(chatInput, { key: 'ArrowDown' });
    expect(screen.getByLabelText('Chat input')).toHaveValue('Second turn.');

    chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
    fireEvent.keyDown(chatInput, { key: 'ArrowDown' });
    expect(screen.getByLabelText('Chat input')).toHaveValue('');
  });

  it('recalls terminal commands with ArrowUp and clears the input at the end of history', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    await openDefaultSessionPanel();

    fireEvent.click(screen.getByRole('tab', { name: 'Terminal mode' }));

    const bashInput = screen.getByLabelText('Bash input') as HTMLInputElement;
    fireEvent.change(bashInput, { target: { value: 'echo first' } });
    fireEvent.submit(bashInput.closest('form')!);

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText('Bash input'), { target: { value: 'pwd' } });
    fireEvent.submit(screen.getByLabelText('Bash input').closest('form')!);

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.keyDown(screen.getByLabelText('Bash input'), { key: 'ArrowUp' });
    expect(screen.getByLabelText('Bash input')).toHaveValue('pwd');

    fireEvent.keyDown(screen.getByLabelText('Bash input'), { key: 'ArrowUp' });
    expect(screen.getByLabelText('Bash input')).toHaveValue('echo first');

    fireEvent.keyDown(screen.getByLabelText('Bash input'), { key: 'ArrowDown' });
    expect(screen.getByLabelText('Bash input')).toHaveValue('pwd');

    fireEvent.keyDown(screen.getByLabelText('Bash input'), { key: 'ArrowDown' });
    expect(screen.getByLabelText('Bash input')).toHaveValue('');
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

    await disableAllTools();
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
        sessionId: expect.any(String),
      }),
      expect.any(Object),
      expect.any(AbortSignal),
    );
    expect(screen.getByText('Copilot response')).toBeInTheDocument();
  });

  it('streams responses through Codex when it is the selected provider without requiring Codi', async () => {
    vi.useFakeTimers();
    fetchCodexStateMock.mockResolvedValue(createCodexState({
      authenticated: true,
      version: '0.125.0',
      models: [{
        id: 'codex-default',
        name: 'Codex default',
        reasoning: true,
        vision: false,
      }],
    }));
    streamCodexRuntimeChatMock.mockImplementation(async (_request, callbacks) => {
      callbacks.onReasoning?.('Inspecting workspace instructions');
      callbacks.onToken?.('Codex response');
      callbacks.onDone?.('Codex response');
      return Promise.resolve();
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    await openDefaultSessionPanel();

    openDefaultSession();

    fireEvent.change(screen.getByRole('combobox', { name: 'Agent provider' }), { target: { value: 'codex' } });
    expect(screen.getByRole('combobox', { name: 'Codex model' })).toHaveValue('codex-default');

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Summarize the current workspace.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(runStagedToolPipelineMock).not.toHaveBeenCalled();
    expect(streamCodexRuntimeChatMock).toHaveBeenCalledTimes(1);
    expect(streamCodexRuntimeChatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'codex-default',
        prompt: expect.stringContaining('Active workspace: Research'),
        sessionId: expect.any(String),
      }),
      expect.any(Object),
      expect.any(AbortSignal),
    );
    expect(screen.getByText('Codex response')).toBeInTheDocument();
  });

  it('adds partner agent control plane audit context to direct partner-agent prompts', async () => {
    vi.useFakeTimers();
    fetchCodexStateMock.mockResolvedValue(createCodexState({
      authenticated: true,
      version: '0.125.0',
      models: [{
        id: 'codex-default',
        name: 'Codex default',
        reasoning: true,
        vision: false,
      }],
    }));
    streamCodexRuntimeChatMock.mockImplementation(async (_request, callbacks) => {
      callbacks.onToken?.('Codex response');
      callbacks.onDone?.('Codex response');
      return Promise.resolve();
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    openDefaultSession();

    fireEvent.change(screen.getByRole('combobox', { name: 'Agent provider' }), { target: { value: 'codex' } });
    await disableAllTools();
    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Summarize the current workspace.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(streamCodexRuntimeChatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'codex-default',
        prompt: expect.stringContaining('Partner agent control plane: enabled'),
      }),
      expect.any(Object),
      expect.any(AbortSignal),
    );
    expect(streamCodexRuntimeChatMock.mock.calls[0][0].prompt).toContain('Selected model ref: codex:codex-default');
    expect(streamCodexRuntimeChatMock.mock.calls[0][0].prompt).toContain('Unified workflow: issue, diff, review, browser evidence, and AgentBus traces stay attached to one session.');
  });

  it('shows Codex status in Models', async () => {
    vi.useFakeTimers();
    fetchCodexStateMock.mockResolvedValue(createCodexState({
      authenticated: true,
      version: '0.125.0',
      statusMessage: 'Codex CLI 0.125.0 available.',
      models: [{ id: 'codex-default', name: 'Codex default', reasoning: true, vision: false }],
    }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByLabelText('Models'));

    expect(screen.getAllByText('Codex').length).toBeGreaterThanOrEqual(1);
    const codexSection = expectModelProviderStatus(/Codex Models \(1\)/i, 'Ready');
    expect(within(codexSection).getByText('Codex default')).toBeInTheDocument();
  });

  it('reuses the same GHCP session id across multiple sends in one chat session', async () => {
    vi.useFakeTimers();
    fetchCopilotStateMock.mockResolvedValue(createCopilotState({
      authenticated: true,
      login: 'octocat',
      models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: false }],
    }));

    const sessionIds: string[] = [];
    streamCopilotChatMock.mockImplementation(async (request, callbacks) => {
      sessionIds.push((request as { sessionId: string }).sessionId);
      callbacks.onDone?.('Copilot response');
      return Promise.resolve();
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await disableAllTools();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'First turn.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Second turn.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(sessionIds).toHaveLength(2);
    expect(sessionIds[0]).toBeTruthy();
    expect(sessionIds[0]).toBe(sessionIds[1]);
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
    runStagedToolPipelineMock.mockImplementation(async (options, callbacks) => {
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
    await openDefaultSessionPanel();

    openDefaultSession();

    expect(screen.getByRole('combobox', { name: 'Agent provider' })).toHaveValue('ghcp');
    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Check the terminal.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(resolveLanguageModelMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'copilot',
      modelId: 'gpt-4.1',
      sessionId: expect.any(String),
    }));

    const toolChip = screen.getByTestId('tool-chip-cli');
    expect(toolChip).toBeInTheDocument();
    expect(screen.getAllByText('$ echo hello from cli').length).toBeGreaterThan(0);
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

    await disableAllTools();
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

    await disableAllTools();
    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Summarize the architectural shift.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    // Panel should NOT open automatically — only on user click
    expect(screen.queryByRole('complementary', { name: /Activity panel|Process graph/i })).not.toBeInTheDocument();

    // Clicking the reasoning pill opens the Activity panel overlay
    const pill = screen.getByRole('button', { name: /Thought for|Process ·|Working…/i });
    fireEvent.click(pill);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('complementary', { name: /Activity panel|Process graph/i })).toBeInTheDocument();
    expect(screen.getAllByText('Searching openreview.net').length).toBeGreaterThan(0);

    // Close via the back button
    const backButton = screen.getByRole('button', { name: 'Back to chat' });
    fireEvent.click(backButton);

    expect(screen.queryByRole('complementary', { name: /Activity panel|Process graph/i })).not.toBeInTheDocument();
    expect(screen.getByText('Runtime intelligence is moving into the loop.')).toBeInTheDocument();
  });

  it('renders local Codi thoughts in the activity panel when the model emits think tags', async () => {
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
    generateMock.mockImplementation(async (_input, callbacks) => {
      callbacks.onToken?.('<think>Plan the response in steps.');
      callbacks.onToken?.('</think>Final answer');
      callbacks.onDone?.({ generated_text: 'Final answer' });
      return undefined;
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();
    await disableAllTools();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Think through this.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    const pill = screen.getByRole('button', { name: /Thought for|Process ·|Working…/i });
    fireEvent.click(pill);

    expect(screen.getByRole('complementary', { name: /Activity panel|Process graph/i })).toBeInTheDocument();
    expect(screen.getAllByText('Plan the response in steps.').length).toBeGreaterThan(0);
    expect(screen.getByText('Final answer')).toBeInTheDocument();
  });

  it('shows a concrete local Codi thinking step even when the model emits only phase updates', async () => {
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

    let resolveGeneration!: () => void;
    generateMock.mockImplementation(async (_input, callbacks) => new Promise<void>((resolve) => {
      callbacks.onPhase?.('thinking');
      resolveGeneration = () => {
        callbacks.onDone?.({ generated_text: 'Final answer' });
        resolve();
      };
    }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();
    await disableAllTools();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Think through this.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: /Analyzing request/i })).toBeInTheDocument();

    await act(async () => {
      resolveGeneration();
      await Promise.resolve();
    });
  });

  it('shows an immediate local tool-planning step before any tool-agent callbacks arrive', async () => {
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

    let resolveRun!: () => void;
    runStagedToolPipelineMock.mockImplementation(async (_options, callbacks) => new Promise((resolve) => {
      callbacks.onStageStart?.('router', '');
      resolveRun = () => {
        callbacks.onStageComplete?.('router', 'Planning finished.');
        callbacks.onDone?.('Tool run completed.');
        resolve({ text: 'Tool run completed.', steps: 1 });
      };
    }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Use tools to solve this.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();

    expect(screen.getByRole('button', { name: /Planning tool run|Routing request/i })).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
      resolveRun();
      await Promise.resolve();
    });
  });

  it('streams local model tokens into the planning step body during tool runs', async () => {
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

    let resolveRun!: () => void;
    runStagedToolPipelineMock.mockImplementation(async (_options, callbacks) => new Promise((resolve) => {
      callbacks.onStageStart?.('router', '');
      callbacks.onStageToken?.('router', 'Looking ');
      callbacks.onStageToken?.('router', 'for ');
      callbacks.onStageToken?.('router', 'the right tool.');
      resolveRun = () => {
        callbacks.onStageComplete?.('router', 'Looking for the right tool.');
        callbacks.onDone?.('Tool run completed.');
        resolve({ text: 'Tool run completed.', steps: 1 });
      };
    }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Use tools to solve this.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();

    // Open the activity panel so we can read the streamed body.
    const planningPill = screen.getByRole('button', { name: /Planning tool run|Routing request/i });
    fireEvent.click(planningPill);

    // Drill into the router pg-row to see the streamed transcript.
    const routerRow = screen.getAllByRole('button').find(
      (row) => row.className.includes('pg-row') && /Planning tool run|Routing request/.test(row.textContent ?? ''),
    );
    expect(routerRow).toBeDefined();
    fireEvent.click(routerRow!);
    expect(screen.getByText(/Looking for the right tool\./)).toBeInTheDocument();

    await act(async () => {
      resolveRun();
      await Promise.resolve();
    });
  });

  it('fails local tool planning with a clear timeout instead of hanging forever', async () => {
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

    runStagedToolPipelineMock.mockImplementation(async (_options, callbacks) => new Promise(() => {
      callbacks.onStageStart?.('router', '');
    }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Use tools to solve this.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();

    await act(async () => {
      vi.advanceTimersByTime(180_001);
      await vi.runOnlyPendingTimersAsync();
      await Promise.resolve();
    });

    expect(screen.getByText(/Local tool planning produced no output at all\./i)).toBeInTheDocument();
  });

  it('does not fire the local tool idle watchdog while stages continue to stream output', async () => {
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

    let emitStageToken: ((delta: string) => void) | null = null;
    let finishRun: (() => void) | null = null;
    runStagedToolPipelineMock.mockImplementation(async (_options, callbacks) => {
      emitStageToken = (delta: string) => callbacks.onStageToken?.('router', delta);
      return new Promise((resolve) => {
        finishRun = () => {
          callbacks.onDone?.('All done.');
          resolve({ text: 'All done.', steps: 1 });
        };
      });
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Keep streaming.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();

    // Drip stage tokens every 15 seconds to keep the idle timer reset well
    // inside the 3 minute threshold without producing the timeout error.
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        vi.advanceTimersByTime(15_000);
        emitStageToken?.(`delta-${i}`);
        await Promise.resolve();
      });
    }

    expect(screen.queryByText(/Local tool planning produced no output at all\./i)).toBeNull();
    expect(screen.queryByText(/Local tool planning is still thinking with no new visible output\./i)).toBeNull();

    await act(async () => {
      finishRun?.();
      await Promise.resolve();
    });
  });

  it('fails local tool planning after 3 minutes when streamed output stops', async () => {
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

    runStagedToolPipelineMock.mockImplementation(async (_options, callbacks) => {
      callbacks.onStageStart?.('router', '');
      callbacks.onStageToken?.('router', 'partial output');
      return new Promise(() => {});
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Keep planning until streamed output stops.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();

    await act(async () => {
      vi.advanceTimersByTime(179_999);
      await Promise.resolve();
    });

    expect(screen.queryByText(/Local tool planning stalled after output stopped\./i)).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(2);
      await vi.runOnlyPendingTimersAsync();
      await Promise.resolve();
    });

    expect(screen.getByText(/Local tool planning stalled after output stopped\./i)).toBeInTheDocument();
  });

  it('uses a longer timeout budget for later planning stages', async () => {
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

    runStagedToolPipelineMock.mockImplementation(async (_options, callbacks) => {
      callbacks.onStageStart?.('router', '');
      callbacks.onStageComplete?.('router', 'Routed to tool-group selection.');
      callbacks.onStageStart?.('group-select', '');
      return new Promise(() => {});
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Choose the right tool groups.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();

    await act(async () => {
      vi.advanceTimersByTime(119_999);
      await Promise.resolve();
    });

    expect(screen.queryByText(/Local tool planning stalled after output stopped\./i)).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(2);
      await vi.runOnlyPendingTimersAsync();
      await Promise.resolve();
    });

    expect(screen.getByText(/Local tool planning stalled after output stopped\./i)).toBeInTheDocument();
  });

  it('does not let AgentBus updates take ownership of the delegated planning timeout', async () => {
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

    runParallelDelegationWorkflowMock.mockImplementation(async (_options, callbacks) => {
      callbacks.onStepStart?.('coordinator', 'Coordinator brief', 'Frame the delegated problem.');
      callbacks.onBusEntry?.({
        id: 'bus-0',
        position: 0,
        realtimeTs: Date.now(),
        payloadType: 'Mail',
        summary: 'Mail · user',
        detail: 'figure out a multi-step problem to solve that can be parallelized',
        actor: 'user',
      });
      callbacks.onBusEntry?.({
        id: 'bus-1',
        position: 1,
        realtimeTs: Date.now() + 1_000,
        payloadType: 'InfIn',
        summary: 'InfIn · 2 message(s)',
        detail: 'system: coordinator\nuser: analyze',
      });
      return new Promise(() => {});
    });

    const { container } = render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), {
      target: { value: 'figure out a multi-step problem to solve that can be parallelized; parallelize it and delegate the work to subagents' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();
    await openDefaultSessionPanel();
    await flushAsyncUpdates();

    const activityTrigger = screen.queryByRole('button', { name: /Thought for|Process ·|Working…/i })
      ?? screen.getByRole('button', { name: /Coordinator brief|Mail|InfIn/i });
    fireEvent.click(activityTrigger);

    expect(container.querySelector('.pg-row[data-actor="agent-bus"]')).not.toBeInTheDocument();
    const busWorkflowCard = screen.getAllByRole('button', { name: /InfIn · 2 message/i })
      .find((button) => button.className.includes('pg-row'));
    expect(busWorkflowCard).toBeDefined();
    expect(busWorkflowCard).not.toHaveTextContent(/Budget/i);

    await act(async () => {
      vi.advanceTimersByTime(60_001);
      await Promise.resolve();
    });

    expect(screen.queryByText(/Local tool planning stalled after output stopped\./i)).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(90_001);
      await vi.runOnlyPendingTimersAsync();
      await Promise.resolve();
    });

    expect(screen.getByText(/Local tool planning stalled after output stopped\./i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Coordinator brief/i }));
    expect(screen.getAllByText(/Timed out after 2m 30s waiting for more streamed output\./i).length).toBeGreaterThan(0);
  });

  it('passes delegated execution runtime inputs into the parallel workflow', async () => {
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

    runParallelDelegationWorkflowMock.mockImplementation(async (options, callbacks) => {
      const typed = options as {
        execution?: {
          toolDescriptors: Array<{ id: string }>;
          instructions: string;
          messages: Array<{ role: string; content: unknown }>;
          writePlanFile: (path: string, content: string) => Promise<void>;
          runShellCommand: (command: string) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
        };
      };

      expect(typed.execution).toBeDefined();
      expect(typed.execution?.toolDescriptors.map((descriptor) => descriptor.id)).toContain('cli');
      expect(typed.execution?.instructions).toContain('Research');
      expect(typed.execution?.messages).toEqual([
        expect.objectContaining({ role: 'user', content: expect.stringContaining('delegate the work to subagents') }),
      ]);

      const shellResult = await typed.execution?.runShellCommand('pwd');
      expect(shellResult?.exitCode).toBe(0);
      await typed.execution?.writePlanFile('/workspace/PLAN.md', '# PLAN');

      callbacks.onDone?.('Parallel delegation plan');
      return { text: 'Parallel delegation plan', steps: 1 };
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), {
      target: { value: 'figure out a multi-step problem to solve that can be parallelized; parallelize it and delegate the work to subagents' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(runParallelDelegationWorkflowMock).toHaveBeenCalledTimes(1);
  });

  it('treats delegated staged-planning stage tokens as watchdog activity', async () => {
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

    runParallelDelegationWorkflowMock.mockImplementation(async (_options, callbacks) => {
      callbacks.onStepStart?.('coordinator', 'Coordinator brief', 'Frame the delegated problem.');
      callbacks.onStepComplete?.('coordinator', 'Frame the delegated problem.');

      window.setTimeout(() => {
        callbacks.onStageStart?.('router', 'Plan task execution');
        callbacks.onStageToken?.('router', 'delegated planner still streaming');
      }, 60_000);

      return new Promise(() => {});
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), {
      target: { value: 'figure out a multi-step problem to solve that can be parallelized; parallelize it and delegate the work to subagents' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();
    await openDefaultSessionPanel();
    await flushAsyncUpdates();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(29_999);
      await Promise.resolve();
    });

    expect(screen.queryByText(/Local tool planning stalled after output stopped\./i)).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(149_999);
      await Promise.resolve();
    });

    expect(screen.queryByText(/Local tool planning stalled after output stopped\./i)).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(30_002);
      await Promise.resolve();
    });

    expect(screen.getByText(/Local tool planning stalled after output stopped\./i)).toBeInTheDocument();
  });

  it('renders the delegated workflow graph and lets the user inspect a subagent transcript', async () => {
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

    runParallelDelegationWorkflowMock.mockImplementation(async (_options, callbacks) => {
      callbacks.onStepStart?.('chat-agent', 'Chat agent', 'Receive the user prompt and delegate planning.');
      callbacks.onAgentHandoff?.('chat-agent', 'planner', 'Agent handoff: classify and decompose the request.');
      callbacks.onStepComplete?.('chat-agent', 'Delegated to planner.');
      callbacks.onStepStart?.('planner', 'Planner', 'Classify, decompose, and prepare delegation.');
      callbacks.onAgentHandoff?.('planner', 'orchestrator', 'Agent handoff: pass succinct tasks to the orchestrator.');
      callbacks.onStepComplete?.('planner', 'Prepared succinct tasks.');
      callbacks.onStepStart?.('orchestrator', 'Orchestrator', 'Choose the registered agents needed for the plan.');
      callbacks.onAgentHandoff?.('orchestrator', 'tool-agent', 'Agent handoff: ask tool-agent to assign active tools.');
      callbacks.onStepComplete?.('orchestrator', 'Selected registered agents.');
      callbacks.onStepStart?.('tool-agent', 'Tool agent', 'Assign active workspace tools to the selected agents.');
      callbacks.onAgentHandoff?.('tool-agent', 'logact', 'Agent handoff: submit the executable plan to LogAct.');
      callbacks.onStepComplete?.('tool-agent', 'Assigned active tools.');
      callbacks.onStepStart?.('coordinator', 'Coordinator brief', 'Frame the delegated problem.');
      callbacks.onStepStart?.('breakdown-agent', 'Breakdown subagent', 'Split the work into parallel tracks.');
      callbacks.onStepStart?.('assignment-agent', 'Assignment subagent', 'Assign owners for each track.');
      callbacks.onStepStart?.('validation-agent', 'Validation subagent', 'Define risks and checks.');
      callbacks.onStepToken?.('coordinator', 'Analyze the customer-support dataset.');
      callbacks.onStepComplete?.('coordinator', 'Analyze the customer-support dataset.');
      callbacks.onStepToken?.('breakdown-agent', 'Track A\nTrack B\nTrack C');
      callbacks.onStepComplete?.('breakdown-agent', 'Track A\nTrack B\nTrack C');
      callbacks.onStepComplete?.('assignment-agent', [
        'Role: Analyst specialist | Owns: Track A dataset analysis | Handoff: Ops specialist',
        'Role: Ops specialist | Owns: Track B operational follow-up | Handoff: final report',
      ].join('\n'));
      callbacks.onStepComplete?.('validation-agent', 'Check data quality\nConfirm metric coverage');
      callbacks.onVoterStep?.({
        id: 'voter-breakdown',
        kind: 'agent',
        title: 'breakdown-distinct-tracks',
        voterId: 'breakdown-distinct-tracks',
        startedAt: Date.now(),
        status: 'active',
      });
      callbacks.onVoterStepUpdate?.('voter-breakdown', {
        status: 'done',
        approve: true,
        body: 'Approved',
        thought: 'Confirmed the breakdown has multiple independent tracks.',
        endedAt: Date.now(),
      });
      callbacks.onVoterStepEnd?.('voter-breakdown');
      callbacks.onVoterStep?.({
        id: 'voter-assignment',
        kind: 'agent',
        title: 'assignment-has-roles',
        voterId: 'assignment-has-roles',
        startedAt: Date.now(),
        status: 'active',
      });
      callbacks.onVoterStepUpdate?.('voter-assignment', {
        status: 'done',
        approve: true,
        body: 'Approved',
        thought: 'Each track has an explicit role or owner with a stated handoff.',
        endedAt: Date.now(),
      });
      callbacks.onVoterStepEnd?.('voter-assignment');
      callbacks.onBusEntry?.({
        id: 'bus-0',
        position: 0,
        realtimeTs: Date.now(),
        payloadType: 'Mail',
        summary: 'Mail · user',
        detail: 'figure out a multi-step problem to solve that can be parallelized',
        actor: 'user',
      });
      callbacks.onBusEntry?.({
        id: 'bus-1',
        position: 1,
        realtimeTs: Date.now() + 1000,
        payloadType: 'Vote',
        summary: 'Vote · breakdown-distinct-tracks ✓',
        detail: 'Confirmed the breakdown has multiple independent tracks.',
        actor: 'breakdown-distinct-tracks',
      });
      callbacks.onBusEntry?.({
        id: 'bus-2',
        position: 2,
        realtimeTs: Date.now() + 2000,
        payloadType: 'Vote',
        summary: 'Vote · assignment-has-roles ✓',
        detail: 'Each track has an explicit role or owner with a stated handoff.',
        actor: 'assignment-has-roles',
      });
      callbacks.onBusEntry?.({
        id: 'bus-3',
        position: 3,
        realtimeTs: Date.now() + 3000,
        payloadType: 'Commit',
        summary: 'Commit · delegation-abc',
        detail: 'intent committed',
      });
      const finalText = [
        'Parallel delegation plan',
        '',
        '## Reviewer votes',
        '- ✅ breakdown-distinct-tracks — Confirmed the breakdown has multiple independent tracks.',
        '- ✅ assignment-has-roles — Each track has an explicit role or owner with a stated handoff.',
        '',
        '## Process log (AgentBus)',
        '1. Mail · user — figure out a multi-step problem to solve that can be parallelized',
        '2. Vote · breakdown-distinct-tracks ✓ — Confirmed the breakdown has multiple independent tracks.',
        '3. Vote · assignment-has-roles ✓ — Each track has an explicit role or owner with a stated handoff.',
        '4. Commit · delegation-abc — intent committed',
      ].join('\n');
      callbacks.onDone?.(finalText);
      return { text: finalText, steps: 4 };
    });

    const { container } = render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), {
      target: { value: 'figure out a multi-step problem to solve that can be parallelized; parallelize it and delegate the work to subagents' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();
    await openDefaultSessionPanel();
    await flushAsyncUpdates();

    expect(screen.getByRole('button', { name: /Process ·|Reviewers · 1 approved · 1 rejected/i })).toBeInTheDocument();
    expect(screen.getByText('Reviewer votes')).toBeInTheDocument();
    expect(screen.getByText('Process log (AgentBus)')).toBeInTheDocument();

    const activityTrigger = screen.queryByRole('button', { name: /Thought for|Process ·|Working…/i })
      ?? screen.getByRole('button', { name: /Validation subagent|Coordinator brief|Planning tool run/i });
    fireEvent.click(activityTrigger);

    expect(screen.getByRole('button', { name: /Coordinator brief/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Breakdown subagent/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Assignment subagent/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Validation subagent/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Agent handoff ·/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reviewer votes/i })).toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="agent-bus"]')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mail · user/i })).toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="planner"]')).toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="orchestrator"]')).toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="tool-agent"]')).toBeInTheDocument();
    const breakdownRow = screen.getByRole('button', { name: /Breakdown subagent/i });
    expect(breakdownRow.querySelector('[data-connector="fork"][data-lane="breakdown-agent"]')).toBeInTheDocument();
    expect(breakdownRow.querySelector('[data-connector="merge"][data-lane="breakdown-agent"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Breakdown subagent/i }));

    const detailPane = screen.getByRole('complementary', { name: /breakdown-agent .* detail/i });
    expect(screen.getByRole('button', { name: 'Back to graph' })).toBeInTheDocument();
    expect(within(detailPane).getByText(/Track A/)).toBeInTheDocument();
    expect(within(detailPane).getByText(/Track C/)).toBeInTheDocument();
  });

  it('renders ProcessGraph rows in chronological execution order across branches', async () => {
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

    runParallelDelegationWorkflowMock.mockImplementation(async (_options, callbacks) => {
      callbacks.onBusEntry?.({
        id: 'bus-0',
        position: 0,
        realtimeTs: Date.now(),
        payloadType: 'Mail',
        summary: 'Mail · user',
        detail: 'figure out a multi-step problem to solve that can be parallelized',
        actor: 'user',
      });
      callbacks.onStepStart?.('coordinator', 'Coordinator brief', 'Frame the delegated problem.');
      callbacks.onStepComplete?.('coordinator', 'Analyze the customer-support dataset.');
      callbacks.onBusEntry?.({
        id: 'bus-1',
        position: 1,
        realtimeTs: Date.now() + 1000,
        payloadType: 'InfIn',
        summary: 'InfIn · 2 messages',
        detail: 'system: coordinator\nuser: analyze',
      });
      callbacks.onDone?.('Parallel delegation plan');
      return { text: 'Parallel delegation plan', steps: 1 };
    });

    const { container } = render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), {
      target: { value: 'figure out a multi-step problem to solve that can be parallelized; parallelize it and delegate the work to subagents' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();
    await openDefaultSessionPanel();
    await flushAsyncUpdates();

    const activityTrigger = screen.queryByRole('button', { name: /Thought for|Process ·|Working…/i })
      ?? screen.getByRole('button', { name: /Coordinator brief|AgentBus log|Mail|InfIn/i });
    fireEvent.click(activityTrigger);

    // The process timeline must render entries in pure chronological order
    // (ts → position) regardless of which branch they belong to. The mocked
    // sequence above interleaves bus rows around the coordinator stage, so
    // the rendered rows MUST follow: Mail (bus-0) → Coordinator brief →
    // InfIn (bus-1). Anything else means branch priority is back.
    const orderedRows = Array.from(container.querySelectorAll<HTMLButtonElement>('.pg-row')).filter((button) => {
      const label = button.textContent ?? '';
      return /Coordinator brief|Mail|InfIn/.test(label);
    });
    const summaries = orderedRows.map((button) => button.textContent ?? '');
    const mailIndex = summaries.findIndex((label) => /Mail/.test(label));
    const coordinatorIndex = summaries.findIndex((label) => /Coordinator brief/.test(label));
    const infInIndex = summaries.findIndex((label) => /InfIn/.test(label));

    // All three rows must appear and be in chronological order.
    expect(mailIndex).toBeGreaterThanOrEqual(0);
    expect(coordinatorIndex).toBeGreaterThan(mailIndex);
    expect(infInIndex).toBeGreaterThan(coordinatorIndex);
    const infInRow = orderedRows[infInIndex];
    const infInFork = infInRow.querySelector('[data-connector="fork"][data-lane="bus"]') as HTMLElement | null;
    expect(infInFork).toBeInTheDocument();
    expect(infInRow.querySelector('.pg-rail-lane[data-lane="mail:user"]')).not.toBeInTheDocument();
  });

  it('surfaces tool-agent activity in the activity panel for local Codi runs with tools enabled', async () => {
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
    runStagedToolPipelineMock.mockImplementation(async (_options, callbacks) => {
      callbacks.onStageStart?.('router', '');
      callbacks.onStageComplete?.('router', 'Plan complete.');
      callbacks.onToolCall?.('grep', { pattern: 'todo' }, 'tool-1');
      callbacks.onToolResult?.('grep', { pattern: 'todo' }, 'Found matches', false, 'tool-1');
      callbacks.onDone?.('Tool run completed.');
      return { text: 'Tool run completed.', steps: 1 };
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Search the workspace.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();

    expect(screen.getByTestId('tool-chip-grep')).toBeInTheDocument();

    const pill = screen.getByRole('button', { name: /Planning tool run|Thought for|Process ·|Working…/i });
    fireEvent.click(pill);

    expect(screen.getByRole('complementary', { name: /Activity panel|Process graph/i })).toBeInTheDocument();
    expect(screen.getAllByText('grep').length).toBeGreaterThan(0);
    expect(screen.getByText('Found matches')).toBeInTheDocument();
  });

  it('renders dynamic LogAct actor rows without resurrecting the CodeMode planning branch', async () => {
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
    runStagedToolPipelineMock.mockImplementation(async (_options, callbacks) => {
      callbacks.onStageStart?.('chat-agent', 'Receiving prompt.', { agentId: 'chat-agent', agentLabel: 'Chat Agent' });
      callbacks.onAgentHandoff?.('chat-agent', 'orchestrator', 'Agent handoff: classify, decompose, and select registered agents.');
      callbacks.onStageComplete?.('chat-agent', 'Delegated to orchestrator.', { agentId: 'chat-agent', agentLabel: 'Chat Agent' });
      callbacks.onStageStart?.('orchestrator', 'Configuring actors.', { agentId: 'orchestrator', agentLabel: 'Orchestrator Agent' });
      callbacks.onAgentHandoff?.('orchestrator', 'logact', 'Agent handoff: submit workflow to LogAct.');
      callbacks.onStageComplete?.('orchestrator', 'Selected dynamic LogAct actors.', { agentId: 'orchestrator', agentLabel: 'Orchestrator Agent' });
      callbacks.onStageStart?.('logact', 'LogAct actor workflow.', { agentId: 'logact', agentLabel: 'LogAct Pipeline' });
      callbacks.onBusEntry?.({
        id: 'tool-policy-entry',
        position: 0,
        realtimeTs: Date.now(),
        payloadType: 'Policy',
        summary: 'Tool policy',
        detail: 'tool-agent selected cli and assigned executor tools',
        actorId: 'tool-agent',
        actorRole: 'driver',
        parentActorId: 'logact',
        branchId: 'agent:tool-agent',
      });
      callbacks.onBusEntry?.({
        id: 'student-entry',
        position: 1,
        realtimeTs: Date.now(),
        payloadType: 'InfOut',
        summary: 'Student candidate',
        detail: 'student drafted a solution candidate',
        actorId: 'student-driver',
        actorRole: 'driver',
        parentActorId: 'logact',
        branchId: 'agent:student-driver',
      });
      callbacks.onBusEntry?.({
        id: 'teacher-entry',
        position: 2,
        realtimeTs: Date.now(),
        payloadType: 'Vote',
        summary: 'Teacher vote',
        detail: 'teacher approved the student candidate',
        actor: 'voter:teacher',
        actorId: 'voter:teacher',
        actorRole: 'voter',
        parentActorId: 'judge-decider',
        branchId: 'agent:judge-decider',
      });
      callbacks.onBusEntry?.({
        id: 'judge-entry',
        position: 3,
        realtimeTs: Date.now(),
        payloadType: 'Commit',
        summary: 'Judge commit',
        detail: 'judge selected the student candidate',
        actorId: 'judge-decider',
        actorRole: 'decider',
        parentActorId: 'logact',
        branchId: 'agent:judge-decider',
      });
      callbacks.onStageStart?.('executor', 'Executing committed LogAct plan.', { agentId: 'executor', agentLabel: 'Executor Agent' });
      callbacks.onBusEntry?.({
        id: 'execute-plan-entry',
        position: 4,
        realtimeTs: Date.now(),
        payloadType: 'Intent',
        summary: 'Execute plan',
        detail: 'executor accepted the committed plan',
        actorId: 'execute-plan',
        actorRole: 'executor',
        parentActorId: 'executor',
        branchId: 'agent:executor',
      });
      callbacks.onBusEntry?.({
        id: 'executor-entry',
        position: 5,
        realtimeTs: Date.now(),
        payloadType: 'Result',
        summary: 'Executor result',
        detail: 'executor completed the committed action',
        actorId: 'executor',
        actorRole: 'executor',
        parentActorId: 'execute-plan',
        branchId: 'agent:executor',
      });
      callbacks.onStageComplete?.('logact', 'LogAct completed.', { agentId: 'logact', agentLabel: 'LogAct Pipeline' });
      callbacks.onDone?.('Tool run completed.');
      return { text: 'Tool run completed.', steps: 1 };
    });

    const { container } = render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Search the workspace.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();

    fireEvent.click(screen.getByRole('button', { name: /Planning tool run|LogAct pipeline|Tool agent|Executing tools|Thought for|Process ·|Working…/i }));

    expect(container.querySelector('.pg-row[data-actor="tools:CodeMode"]')).not.toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="handoff"]')).not.toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="agent-bus"]')).not.toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="logact"]')).not.toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="planner"]')).not.toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="router-agent"]')).not.toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="router"]')).not.toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="voter-ensemble"]')).not.toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="teacher-voter"]')).not.toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="executor-agent"]')).not.toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="group-select"]')).not.toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="tool-select"]')).not.toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="tool-agent"]')).toHaveTextContent('Tool policy');
    expect(container.querySelector('.pg-row[data-actor="student-driver"]')).toHaveTextContent('Student candidate');
    expect(container.querySelector('.pg-row[data-actor="voter:teacher"]')).toHaveTextContent('Teacher vote');
    expect(container.querySelector('.pg-row[data-actor="judge-decider"]')).toHaveTextContent('Judge commit');
    const executorRows = Array.from(container.querySelectorAll('.pg-row[data-actor="executor"]'));
    expect(executorRows.some((row) => row.textContent?.includes('Executor result'))).toBe(true);
  });

  it('renders staged tool workflow agent handoff as target agent nodes and closes planning branches before execution', async () => {
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
    runStagedToolPipelineMock.mockImplementation(async (_options, callbacks) => {
      callbacks.onStageStart?.('chat-agent', 'Receiving prompt.', { agentId: 'chat-agent', agentLabel: 'Chat Agent' });
      callbacks.onAgentHandoff?.('chat-agent', 'orchestrator', 'Agent handoff: classify, decompose, and select registered agents.');
      callbacks.onStageComplete?.('chat-agent', 'Delegated to orchestrator.', { agentId: 'chat-agent', agentLabel: 'Chat Agent' });
      callbacks.onStageStart?.('orchestrator', 'Selected registered agents.', { agentId: 'orchestrator', agentLabel: 'Orchestrator Agent' });
      callbacks.onAgentHandoff?.('orchestrator', 'logact', 'Agent handoff: submit workflow to LogAct.');
      callbacks.onStageComplete?.('orchestrator', 'Selected LogAct actors and executor.', { agentId: 'orchestrator', agentLabel: 'Orchestrator Agent' });
      callbacks.onStageStart?.('logact', 'Reviewing with LogAct.', { agentId: 'logact', agentLabel: 'LogAct Pipeline' });
      callbacks.onBusEntry?.({
        id: 'tool-policy',
        position: 0,
        realtimeTs: Date.now(),
        payloadType: 'Policy',
        summary: 'Tool policy',
        detail: 'tool-agent selected cli and assigned executor tools',
        actorId: 'tool-agent',
        actorRole: 'driver',
        parentActorId: 'logact',
        branchId: 'agent:tool-agent',
      });
      callbacks.onBusEntry?.({
        id: 'tool-agent-complete',
        position: 1,
        realtimeTs: Date.now(),
        payloadType: 'Completion',
        summary: 'Tools selected',
        detail: 'tool-agent selected tools and returned policy',
        actorId: 'tools-selected',
        actorRole: 'operation',
        parentActorId: 'tool-agent',
        branchId: 'agent:logact',
      });
      callbacks.onBusEntry?.({
        id: 'student-entry',
        position: 2,
        realtimeTs: Date.now(),
        payloadType: 'Intent',
        summary: 'Student candidate',
        detail: 'student drafted a solution candidate',
        actorId: 'student-driver',
        actorRole: 'driver',
        parentActorId: 'logact',
        branchId: 'agent:student-driver',
      });
      callbacks.onBusEntry?.({
        id: 'judge-rubric',
        position: 3,
        realtimeTs: Date.now(),
        payloadType: 'Policy',
        summary: 'Judge rubric',
        detail: 'judge opened the scoring context',
        actorId: 'judge-decider',
        actorRole: 'decider',
        parentActorId: 'logact',
        branchId: 'agent:judge-decider',
      });
      callbacks.onBusEntry?.({
        id: 'adversary-entry',
        position: 4,
        realtimeTs: Date.now(),
        payloadType: 'Intent',
        summary: 'Adversary attempt',
        detail: 'adversary tried to exploit the rubric',
        actorId: 'adversary-driver',
        actorRole: 'driver',
        parentActorId: 'judge-decider',
        branchId: 'agent:adversary-driver',
      });
      callbacks.onBusEntry?.({
        id: 'teacher-entry',
        position: 5,
        realtimeTs: Date.now(),
        payloadType: 'Vote',
        summary: 'Teacher vote',
        detail: 'teacher approved the student candidate',
        actor: 'voter:teacher',
        actorId: 'voter:teacher',
        actorRole: 'voter',
        parentActorId: 'judge-decider',
        branchId: 'agent:judge-decider',
      });
      callbacks.onBusEntry?.({
        id: 'judge-entry',
        position: 6,
        realtimeTs: Date.now(),
        payloadType: 'Commit',
        summary: 'Judge commit',
        detail: 'judge selected the student candidate',
        actorId: 'judge-decider',
        actorRole: 'decider',
        parentActorId: 'logact',
        branchId: 'agent:judge-decider',
      });
      callbacks.onBusEntry?.({
        id: 'judge-approved',
        position: 7,
        realtimeTs: Date.now(),
        payloadType: 'Completion',
        summary: 'Judge approved',
        detail: 'judge approved the operation on the AgentBus',
        actorId: 'judge-approved',
        actorRole: 'operation',
        parentActorId: 'judge-decider',
        branchId: 'agent:logact',
      });
      callbacks.onAgentHandoff?.('logact', 'executor', 'Agent handoff: execute committed intent.');
      callbacks.onStageStart?.('executor', 'Executing committed LogAct plan.', { agentId: 'executor', agentLabel: 'Executor Agent' });
      callbacks.onBusEntry?.({
        id: 'execute-plan',
        position: 8,
        realtimeTs: Date.now(),
        payloadType: 'Intent',
        summary: 'Execute plan',
        detail: 'executor accepted the committed plan',
        actorId: 'execute-plan',
        actorRole: 'executor',
        parentActorId: 'executor',
        branchId: 'agent:executor',
      });
      callbacks.onBusEntry?.({
        id: 'bus-result',
        position: 9,
        realtimeTs: Date.now(),
        payloadType: 'Result',
        summary: 'Result · intent-1',
        detail: 'Tool run completed.',
        actorId: 'executor',
        actorRole: 'executor',
        parentActorId: 'execute-plan',
        branchId: 'agent:executor',
      });
      callbacks.onBusEntry?.({
        id: 'logact-executor-complete',
        position: 10,
        realtimeTs: Date.now(),
        payloadType: 'Completion',
        summary: 'Execution complete',
        detail: 'executor merged back after completing the execution plan',
        actorId: 'execution-complete',
        actorRole: 'operation',
        parentActorId: 'executor',
        branchId: 'agent:logact',
      });
      callbacks.onBusEntry?.({
        id: 'post-processor-result',
        position: 11,
        realtimeTs: Date.now(),
        payloadType: 'Result',
        summary: 'Post processed answer',
        detail: 'Rendered user-facing answer from AgentBus.',
        actorId: 'post-processor',
        actorRole: 'post-processor',
        parentActorId: 'execution-complete',
        branchId: 'agent:post-processor',
      });
      callbacks.onBusEntry?.({
        id: 'response-ready',
        position: 12,
        realtimeTs: Date.now(),
        payloadType: 'Completion',
        summary: 'Response ready',
        detail: 'post-processor rendered the final response',
        actorId: 'response-ready',
        actorRole: 'operation',
        parentActorId: 'post-processor',
        branchId: 'agent:logact',
      });
      callbacks.onBusEntry?.({
        id: 'logact-complete',
        position: 11,
        realtimeTs: Date.now(),
        payloadType: 'Completion',
        summary: 'Workflow complete',
        detail: 'workflow merged back to main after execution',
        actorId: 'workflow-complete',
        actorRole: 'operation',
        parentActorId: 'response-ready',
        branchId: 'main',
      });
      callbacks.onStageComplete?.('executor', 'Tool run completed.', { agentId: 'executor', agentLabel: 'Executor Agent' });
      callbacks.onStageComplete?.('logact', 'LogAct completed.', { agentId: 'logact', agentLabel: 'LogAct Pipeline' });
      callbacks.onDone?.('Tool run completed.');
      return { text: 'Tool run completed.', steps: 1 };
    });

    const { container } = render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Search the workspace.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();

    fireEvent.click(screen.getByRole('button', { name: /Planning tool run|LogAct pipeline|Tool agent|Executing tools|Thought for|Process ·|Working…/i }));

    expect(container.querySelector('.pg-row[data-actor="chat-agent"]')).toHaveTextContent('Chat agent');
    expect(container.querySelector('.pg-row[data-actor="orchestrator"]')).toHaveTextContent('Orchestrator');
    expect(container.querySelector('.pg-row[data-actor="tool-agent"]')).toHaveTextContent('Tool policy');
    expect(container.querySelector('.pg-row[data-actor="handoff"]')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Agent handoff ·/i })).not.toBeInTheDocument();
    ['planner', 'router-agent', 'router', 'group-select', 'tool-select', 'voter-ensemble', 'teacher-voter', 'executor-agent'].forEach((actor) => {
      expect(container.querySelector(`.pg-row[data-actor="${actor}"]`)).not.toBeInTheDocument();
    });

    const orchestratorRow = container.querySelector('.pg-row[data-actor="orchestrator"]');
    const toolAgentRow = container.querySelector('.pg-row[data-actor="tool-agent"]');
    const groupSelectRow = container.querySelector('.pg-row[data-actor="group-select"]');
    const toolSelectRow = container.querySelector('.pg-row[data-actor="tool-select"]');
    const toolsSelectedRow = container.querySelector('.pg-row[data-actor="tools-selected"][data-branch="agent:logact"]');
    const executorRow = container.querySelector('.pg-row[data-actor="executor"][data-branch="agent:executor"]');
    const executePlanRow = container.querySelector('.pg-row[data-actor="execute-plan"]');
    const teacherRow = container.querySelector('.pg-row[data-actor="voter:teacher"]');
    const judgeRows = Array.from(container.querySelectorAll('.pg-row[data-actor="judge-decider"]'));
    const executionCompleteRow = Array.from(container.querySelectorAll('.pg-row[data-actor="execution-complete"][data-branch="agent:logact"]'))
      .find((row) => row.textContent?.includes('Execution complete'));
    const postProcessorRow = Array.from(container.querySelectorAll('.pg-row[data-actor="post-processor"][data-branch="agent:post-processor"]'))
      .find((row) => row.textContent?.includes('Post processed answer'));
    const responseReadyRow = Array.from(container.querySelectorAll('.pg-row[data-actor="response-ready"][data-branch="agent:logact"]'))
      .find((row) => row.textContent?.includes('Response ready'));
    const workflowCompleteRow = Array.from(container.querySelectorAll('.pg-row[data-actor="workflow-complete"][data-branch="main"]'))
      .find((row) => row.textContent?.includes('Workflow complete'));

    expect(orchestratorRow?.querySelector('[data-connector="fork"][data-lane="agent:orchestrator"]')).toBeInTheDocument();
    expect(toolAgentRow?.querySelector('[data-connector="fork"][data-lane="agent:tool-agent"]')).toBeInTheDocument();
    expect(groupSelectRow).not.toBeInTheDocument();
    expect(toolSelectRow).not.toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="logact"]')).not.toBeInTheDocument();
    expect(toolsSelectedRow?.querySelector('[data-connector="fork"][data-lane="agent:logact"]')).toBeInTheDocument();
    ['agent:orchestrator'].forEach((lane) => {
      expect(toolsSelectedRow?.querySelector(`.pg-rail-lane[data-lane="${lane}"]`)).not.toHaveClass('pg-rail-lane-active');
    });

    const expectedMergedLanes = ['agent:orchestrator', 'agent:tool-agent', 'agent:executor', 'agent:post-processor', 'agent:logact'];
    const missingMergedLanes = expectedMergedLanes.filter((lane) => (
      !container.querySelector(`[data-connector="merge"][data-lane="${lane}"]`)
    ));
    expect(missingMergedLanes).toEqual([]);

    ['agent:orchestrator', 'agent:tool-agent'].forEach((lane) => {
      expect(executorRow?.querySelector(`[data-lane="${lane}"]`)).not.toHaveClass('pg-rail-lane-active');
    });
    expect(container.querySelector('.pg-row[data-actor="student-driver"]')).toHaveTextContent('Student candidate');
    expect(container.querySelector('.pg-row[data-actor="adversary-driver"]')).toHaveTextContent('Adversary attempt');
    expect(teacherRow).toHaveTextContent('Teacher vote');
    expect(judgeRows.some((row) => (
      row.textContent?.includes('Judge commit')
    ))).toBe(true);
    expect(teacherRow).toHaveAttribute('data-branch', 'agent:judge-decider');
    expect(judgeRows.at(-1)).toHaveAttribute('data-branch', 'agent:judge-decider');
    expect(executorRow?.querySelector('[data-connector="fork"][data-lane="agent:executor"]')).toBeInTheDocument();
    expect(executorRow?.querySelector('.pg-rail-lane[data-lane="agent:logact"]')).toHaveClass('pg-rail-lane-active');
    expect(executePlanRow).toHaveAttribute('data-branch', 'agent:executor');
    expect(executionCompleteRow?.querySelector('[data-connector="merge"][data-lane="agent:executor"]')).toBeInTheDocument();
    expect(postProcessorRow?.querySelector('[data-connector="fork"][data-lane="agent:post-processor"]')).toBeInTheDocument();
    expect(responseReadyRow?.querySelector('[data-connector="merge"][data-lane="agent:post-processor"]')).toBeInTheDocument();
    expect(workflowCompleteRow?.querySelector('[data-connector="merge"][data-lane="agent:logact"]')).toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="voter:planner-decomposition"]')).not.toBeInTheDocument();
    expect(container.querySelector('.pg-row[data-actor="agent-bus"]')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Result · intent-1/i })).toBeInTheDocument();
  });

  it('renders task answers as chat output and neutralizes orchestration after workflow complete', async () => {
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
    runStagedToolPipelineMock.mockImplementation(async (_options, callbacks) => {
      callbacks.onStageStart?.('chat-agent', 'Receiving prompt.', { agentId: 'chat-agent', agentLabel: 'Chat Agent' });
      callbacks.onStageComplete?.('chat-agent', 'Delegated to orchestrator.', { agentId: 'chat-agent', agentLabel: 'Chat Agent' });
      callbacks.onStageStart?.('orchestrator', 'State machine running: task-1.', { agentId: 'orchestrator', agentLabel: 'Orchestrator Agent' });
      callbacks.onBusEntry?.({
        id: 'workflow-complete',
        position: 0,
        realtimeTs: Date.now(),
        payloadType: 'Completion',
        summary: 'Workflow complete',
        detail: 'workflow merged back to main after execution',
        actorId: 'workflow-complete',
        actorRole: 'operation',
        parentActorId: 'execution-complete',
        branchId: 'main',
      });
      callbacks.onStageComplete?.('orchestrator', 'State machine completed: task-1.', { agentId: 'orchestrator', agentLabel: 'Orchestrator Agent' });
      callbacks.onDone?.('Here are restaurant options near Arlington Heights, IL:\n\n1. [Mitsuwa Marketplace](https://example.com/mitsuwa) - Japanese market with a popular food court in Arlington Heights.');
      return {
        text: 'Here are restaurant options near Arlington Heights, IL:\n\n1. [Mitsuwa Marketplace](https://example.com/mitsuwa) - Japanese market with a popular food court in Arlington Heights.',
        steps: 2,
      };
    });

    const { container } = render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'What is the best restaurant near me?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();

    expect(screen.getByText(/Mitsuwa Marketplace/i)).toBeInTheDocument();
    expect(screen.queryByText(/AgentBus Result Write-back/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Working/i)).not.toBeInTheDocument();
    expect(document.querySelector('.stream-cursor')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Orchestrator|Process ·|Thought for|Planning tool run/i }));

    const orchestratorRow = container.querySelector('.pg-row[data-actor="orchestrator"]');
    expect(orchestratorRow).toBeInTheDocument();
    expect(orchestratorRow).toHaveAttribute('data-status', 'done');
    expect(orchestratorRow).not.toHaveClass('pg-row-active');
    expect(container.querySelector('.pg-row[data-actor="workflow-complete"]')).toHaveAttribute('data-status', 'done');
  });
  it('parents staged bus and model-turn graph rows to the open branch context', async () => {
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
    runStagedToolPipelineMock.mockImplementation(async (_options, callbacks) => {
      callbacks.onStageStart?.('chat-agent', '', { agentId: 'chat-agent', agentLabel: 'Chat Agent' });
      callbacks.onAgentHandoff?.('chat-agent', 'orchestrator', 'Agent handoff: classify and select agents.');
      callbacks.onStageComplete?.('chat-agent', 'Delegated to orchestrator.', { agentId: 'chat-agent', agentLabel: 'Chat Agent' });
      callbacks.onStageStart?.('orchestrator', '', { agentId: 'orchestrator', agentLabel: 'Orchestrator Agent' });
      callbacks.onAgentHandoff?.('orchestrator', 'tool-agent', 'Agent handoff: assign tools.');
      callbacks.onStageComplete?.('orchestrator', 'Selected tool-agent.', { agentId: 'orchestrator', agentLabel: 'Orchestrator Agent' });
      callbacks.onStageStart?.('tool-agent', '', { agentId: 'tool-agent', agentLabel: 'Tool Agent' });
      callbacks.onStageStart?.('group-select', '');
      callbacks.onStageComplete?.('group-select', 'Use local tools.');
      callbacks.onStageStart?.('tool-select', '');
      callbacks.onStageComplete?.('tool-select', 'Selected Browser.');
      callbacks.onAgentHandoff?.('tool-select', 'logact', 'Agent handoff: submit workflow to LogAct.');
      callbacks.onStageStart?.('logact', '', { agentId: 'logact', agentLabel: 'LogAct Pipeline' });
      callbacks.onAgentHandoff?.('logact', 'executor', 'Agent handoff: execute committed intent.');
      callbacks.onStageStart?.('executor', '', { agentId: 'executor', agentLabel: 'Executor Agent' });
      callbacks.onBusEntry?.({
        id: 'bus-0',
        position: 0,
        realtimeTs: Date.now(),
        payloadType: 'Mail',
        summary: 'Mail · user',
        detail: 'request context',
        actor: 'user',
      });
      callbacks.onBusEntry?.({
        id: 'bus-1',
        position: 1,
        realtimeTs: Date.now(),
        payloadType: 'InfIn',
        summary: 'InfIn · 1 message',
        detail: 'user: request context',
      });
      callbacks.onModelTurnStart?.('turn-1', 0);
      callbacks.onModelTurnEnd?.('turn-1', 'Ready to call the tool.', null);
      callbacks.onStageComplete?.('executor', 'Tool run completed.');
      callbacks.onDone?.('Tool run completed.');
      return { text: 'Tool run completed.', steps: 1 };
    });

    const { container } = render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await installLocalModel();

    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Search the workspace.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await flushAsyncUpdates();

    fireEvent.click(screen.getByRole('button', { name: /Planning tool run|Thought for|Process ·|Working…/i }));

    const busRow = container.querySelector('.pg-row[data-actor="bus"]');
    const turnRows = Array.from(container.querySelectorAll('.pg-row[data-actor="executor"]'));
    const turnRow = turnRows.find((row) => row.textContent?.includes('Ready to call the tool.'));
    const busFork = busRow?.querySelector('[data-connector="fork"][data-lane="bus"]') as HTMLElement | null;

    expect(container.querySelector('.pg-row[data-actor="logact"]')).not.toBeInTheDocument();
    expect(busFork).toBeInTheDocument();
    expect(busRow?.querySelector('.pg-rail-lane[data-lane="mail:user"]')).not.toHaveClass('pg-rail-lane-active');
    expect(turnRow).toHaveAttribute('data-branch', 'agent:executor');
    expect(turnRow?.querySelector('[data-connector="fork"][data-lane="agent:executor"]')).not.toBeInTheDocument();
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
    await openDefaultSessionPanel();

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

  it('opens the project overlay with the hotkey and jumps by number', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Project switcher' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByText('2 projects')).toBeInTheDocument();
    expect(screen.getByText('1 session · 2 pages · 253 MB')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: '2', ctrlKey: true });
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByLabelText('Open projects')).toHaveAttribute('title', 'Build');
  });

  it('presents projects as the main entrypoint for session work', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByRole('button', { name: 'Projects' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    expect(screen.getByRole('dialog', { name: 'Project switcher' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search projects')).toHaveAttribute('placeholder', 'Find a project...');

    fireEvent.click(screen.getByRole('button', { name: /New project/ }));

    expect(screen.getByLabelText('Open projects')).toHaveAttribute('title', 'Project 3');
    const dashboard = screen.getByRole('region', { name: 'Harness dashboard' });
    expect(within(dashboard).getByRole('article', { name: 'Session summary widget' })).toBeInTheDocument();
    expect(within(dashboard).getByRole('article', { name: 'Knowledge widget' })).toBeInTheDocument();
    expect(within(dashboard).queryByRole('article', { name: 'Session 1 widget' })).not.toBeInTheDocument();
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

    expect(screen.getByLabelText('Open projects')).toHaveAttribute('title', 'Build');
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

  it('supports creating and renaming projects from the screenshot controls', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.keyDown(window, { key: 'N', ctrlKey: true, altKey: true });
    expect(screen.getByLabelText('Open projects')).toHaveAttribute('title', 'Project 3');

    fireEvent.doubleClick(screen.getByLabelText('Open projects'));
    expect(screen.getByRole('dialog', { name: 'Rename project' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Ops' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByLabelText('Open projects')).toHaveAttribute('title', 'Ops');
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

    fireEvent.keyDown(window, { key: '1', altKey: true });
    expect(screen.getByLabelText('Workspace tree')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '2', altKey: true });
    expect(screen.getByRole('region', { name: 'Symphony task management system' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '3', altKey: true });
    expect(screen.getByRole('region', { name: 'Workspace knowledgebase wiki' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '4', altKey: true });
    expect(screen.getByRole('region', { name: 'History' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '5', altKey: true });
    expect(screen.getByRole('region', { name: 'Extension marketplace' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '6', altKey: true });
    expect(screen.getByLabelText('Search model catalog')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '7', altKey: true });
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '8', altKey: true });
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '1', altKey: true });
    expect(screen.getByLabelText('Workspace tree')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '', code: 'Backquote', ctrlKey: true });
    expect(screen.getByRole('heading', { name: 'Terminal' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '', code: 'Backquote', ctrlKey: true });
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
    expect(cursorLabel()).toContain('Dashboard');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(cursorLabel()).toContain('Session summary');

    fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true, altKey: true });
    expect(screen.getByLabelText('Open projects')).toHaveAttribute('title', 'Build');

    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true, altKey: true });
    expect(screen.getByLabelText('Open projects')).toHaveAttribute('title', 'Research');
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
    expect(getTabbableTreeLabels()[0]).toContain('Dashboard');

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(getTabbableTreeLabels()).toHaveLength(1);
    expect(getTabbableTreeLabels()[0]).toContain('Session summary');
  });

  it('debounces model searches and aborts the previous request on query changes', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Models'));
    const input = screen.getByLabelText('Search model catalog');
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

    fireEvent.click(screen.getByLabelText('Models'));

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

    fireEvent.click(screen.getByLabelText('Models'));
    selectModelCatalogSource(/Local/i);
    const button = screen.getByRole('button', { name: /Test Model/i });
    fireEvent.click(button);

    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(button).toBeDisabled();

    await act(async () => {
      resolveInstall();
      await Promise.resolve();
    });

    expect(screen.getAllByText('Installed').length).toBeGreaterThan(0);
  });

  it('coalesces synchronous model-load progress updates without hitting a nested React update warning', async () => {
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

    loadModelMock.mockImplementation(async (_task, _id, callbacks) => {
      for (let index = 0; index < 200; index += 1) {
        callbacks.onStatus('model', `Downloading chunk ${index}`, index);
      }
    });

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Models'));
    selectModelCatalogSource(/Local/i);
    fireEvent.click(screen.getByRole('button', { name: /Test Model/i }));

    await act(async () => {
      await Promise.resolve();
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(screen.getAllByText('Installed').length).toBeGreaterThan(0);
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Maximum update depth exceeded'));
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

    fireEvent.click(screen.getByLabelText('Models'));
    selectModelCatalogSource(/Local/i);
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

  it('clicking Install model button opens the Models panel', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    await openDefaultSessionPanel();

    // Models panel should not be visible initially
    expect(screen.queryByLabelText('Settings')).not.toBeNull();
    expect(screen.queryByLabelText('Search model catalog')).not.toBeInTheDocument();

    openDefaultSession();

    // Click the Install model button in the chat header
    fireEvent.click(screen.getByRole('button', { name: 'Install model' }));

    // The Models panel (model registry) should now be open
    expect(screen.getByLabelText('Search model catalog')).toBeInTheDocument();
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

  it('splits session panes side by side from normal worktree clicks', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Add a second session
    fireEvent.click(screen.getByLabelText('Add session to Research'));
    expect(getTreeItemByText('Session 2')).toBeInTheDocument();

    // Before multi-select: only one chat panel visible
    expect(screen.getAllByRole('region', { name: /Chat panel|Terminal/ })).toHaveLength(1);

    // Single-click Session 1 to add it alongside Session 2
    fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));

    // Now two chat panels should be visible
    expect(screen.getAllByRole('region', { name: /Chat panel|Terminal/ })).toHaveLength(2);

    // Clicking Session 2 again removes it from the split view
    fireEvent.click(screen.getByRole('button', { name: 'Session 2' }));
    expect(screen.getAllByRole('region', { name: /Chat panel|Terminal/ })).toHaveLength(1);
  });

  it('shows close buttons on chat panes and closes a split session panel', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Add session to Research'));
    fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));

    // Session 1 is added to the existing Session 2 split
    const rows = document.querySelectorAll('.tree-row');
    const session1Row = [...rows].find((row) => row.textContent?.includes('Session 1') && !row.textContent?.includes('Session 2'));
    const session2Row = [...rows].find((row) => row.textContent?.includes('Session 2') && !row.textContent?.includes('Session 1'));
    expect(session1Row).toHaveClass('active');
    expect(session2Row).toHaveClass('active');

    // Clicking Session 2 again toggles it closed

    fireEvent.click(screen.getByRole('button', { name: 'Session 2' }));
    expect(session1Row).toHaveClass('active');
    expect(session2Row).not.toHaveClass('active');
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

    // Open three render panes: two browser tabs and one session
    fireEvent.click(screen.getByText('Hugging Face'));
    fireEvent.click(screen.getByText('Transformers.js'), { ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));

    // 640px fits exactly 2 panels of 320px, so the 3rd panel wraps to a new row
    await act(async () => {
      resizeCallback?.([{ contentRect: { width: 640 } } as ResizeObserverEntry], null as unknown as ResizeObserver);
    });

    const splitRows = document.querySelectorAll('.browser-split-view');
    expect(splitRows).toHaveLength(2);
    expect(splitRows[0]).toHaveClass('panels-2');
    expect(splitRows[1]).toHaveClass('panels-1');
  });

  it('keeps split panes capped at two columns even when the container is wide', async () => {
    vi.useFakeTimers();
    let resizeCallback: ResizeObserverCallback | null = null;
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: ResizeObserverCallback) { resizeCallback = cb; }
      observe() {}
      disconnect() {}
    });

    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    // Open three render panes: two browser tabs and one session
    fireEvent.click(screen.getByText('Hugging Face'));
    fireEvent.click(screen.getByText('Transformers.js'), { ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));

    await act(async () => {
      resizeCallback?.([{ contentRect: { width: 1280 } } as ResizeObserverEntry], null as unknown as ResizeObserver);
    });

    const splitRows = document.querySelectorAll('.browser-split-view');
    expect(splitRows).toHaveLength(2);
    expect(splitRows[0]).toHaveClass('panels-2');
    expect(splitRows[1]).toHaveClass('panels-1');
    expect(screen.queryByRole('region', { name: 'Harness dashboard' })).not.toBeInTheDocument();
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

    // Open three render panes: two browser tabs and one session
    fireEvent.click(screen.getByText('Hugging Face'));
    fireEvent.click(screen.getByText('Transformers.js'), { ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));

    // 640px width: 2 per row; 280px height: 1 max row, so only 2 panels are shown
    await act(async () => {
      resizeCallback?.([{ contentRect: { width: 640, height: 280 } } as ResizeObserverEntry], null as unknown as ResizeObserver);
    });

    // Only the first row is rendered; later panels are hidden
    const splitRows = document.querySelectorAll('.browser-split-view');
    expect(splitRows).toHaveLength(1);
    expect(splitRows[0]).toHaveClass('panels-2');
    expect(screen.queryByRole('region', { name: 'Harness dashboard' })).not.toBeInTheDocument();
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

    // Open three render panes: two browser tabs and one session
    fireEvent.click(screen.getByText('Hugging Face'));
    fireEvent.click(screen.getByText('Transformers.js'), { ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));

    // 640px width: 2 per row; 520px height: 2 max rows, so all 3 panels are shown
    await act(async () => {
      resizeCallback?.([{ contentRect: { width: 640, height: 520 } } as ResizeObserverEntry], null as unknown as ResizeObserver);
    });

    const splitRows = document.querySelectorAll('.browser-split-view');
    expect(splitRows).toHaveLength(2);
    expect(splitRows[0]).toHaveClass('panels-2');
    expect(splitRows[1]).toHaveClass('panels-1');
    expect(screen.queryByRole('region', { name: 'Harness dashboard' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Page overlay' })).toHaveLength(2);
    expect(screen.getByLabelText('Chat panel')).toBeInTheDocument();
  });

  it('renders the file editor alongside other panels in the split view', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    // Open a browser tab so there is already one panel alongside the session
    fireEvent.click(screen.getByText('Hugging Face'));
    fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));

    // Add a plugin manifest to trigger the file editor
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'my-plugin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plugin' }));

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

    // Add a plugin manifest to open the file editor
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'my-plugin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plugin' }));

    await act(async () => { vi.advanceTimersByTime(150); });

    expect(screen.getByLabelText('File editor')).toBeInTheDocument();

    // Close the file editor
    fireEvent.click(screen.getByRole('button', { name: 'Close file editor' }));

    expect(screen.queryByLabelText('File editor')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Harness dashboard' })).toBeInTheDocument();
  });

  it('keeps the file name as a label until edit is clicked', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'my-plugin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plugin' }));

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
    await openDefaultSessionPanel();

    // Step 1: open a terminal session pane
    fireEvent.click(screen.getByRole('tab', { name: 'Terminal mode' }));
    expect(screen.getByRole('heading', { name: 'Terminal' })).toBeInTheDocument();

    // Step 2: open a file pane
    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'my-plugin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plugin' }));
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
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'my-plugin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plugin' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));

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

    // Open a browser tab beside an active session
    fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));
    fireEvent.click(screen.getByText('Hugging Face'));
    fireEvent.click(screen.getByText('Transformers.js'));

    // Verify initial order: session, first browser panel, then second browser panel
    const cells = document.querySelectorAll('.panel-drag-cell');
    expect(cells).toHaveLength(3);
    expect(cells[0].querySelector('[aria-label="Chat panel"]')).not.toBeNull();
    expect(cells[1].querySelector('[aria-label="Page overlay"]')).not.toBeNull();
    expect(cells[2].querySelector('[aria-label="Page overlay"]')).not.toBeNull();

    // Simulate dnd-kit drag from the first draggable title bar.
    const [handleA] = document.querySelectorAll('.panel-titlebar--draggable');
    fireEvent.pointerDown(handleA, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handleA, { clientX: 50, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(handleA, { pointerId: 1 });

    // After the simulated drag the SortablePanelCell aria-grabbed state is set
    // (full pointer-sensor integration requires a real browser; here we verify
    // the draggable title bars and ARIA attributes exist and the component stays mounted).
    const handles = document.querySelectorAll('.panel-titlebar--draggable');
    expect(handles).toHaveLength(3);
    // Both panel types must still be rendered after interaction
    expect(screen.queryByRole('region', { name: 'Harness dashboard' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Page overlay' })).toHaveLength(2);
    expect(screen.getByLabelText('Chat panel')).toBeInTheDocument();
  });

  // ── Session FS context menu ──────────────────────────────────────

  it('right-clicking workspace content opens an app context menu and suppresses the native browser menu', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const event = dispatchCancelableContextMenu(screen.getByRole('main', { name: 'Workspace content' }));

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole('menu', { name: 'Context menu' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New tab' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New session' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add file' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Projects' })).toBeInTheDocument();
  });

  it('right-clicking a Browser section opens section actions and suppresses the native browser menu', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const browserSection = screen.getByRole('button', { name: 'Browser' }).closest('[role="treeitem"]')!;
    const event = dispatchCancelableContextMenu(browserSection);

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole('menu', { name: 'Context menu' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New tab' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Properties' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'New session' })).not.toBeInTheDocument();
  });

  it('right-clicking a session FS drive node opens the context menu with a New toolbar button; clicking New shows scaffold options', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    await ensureFilesExpanded();
    const sessionFsButton = screen.getByRole('button', { name: '//session-1-fs' });
    const treeRow = sessionFsButton.closest('[role="treeitem"]')!;
    fireEvent.contextMenu(treeRow);

    expect(screen.getByRole('menu', { name: 'Context menu' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New' })).toBeInTheDocument();

    // Open the New sub-menu
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));

    expect(screen.getByRole('menuitem', { name: 'Add File' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add Folder' })).toBeInTheDocument();
    expect(document.querySelector('.ctx-menu-sep')).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Add hook' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Add AGENTS.md' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Add agent-skill' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Add agent-eval' })).not.toBeInTheDocument();
  });

  it('context menu "Add File" opens the session FS modal pre-set to file mode', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = await getSessionFsDriveRow();
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

    const treeRow = await getSessionFsDriveRow();
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

  it('context menu "Add hook" scaffolds a hook file into the session FS and shows a success toast', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = await getSessionFsDriveRow();
    fireEvent.contextMenu(treeRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Add hook' }));
      await Promise.resolve();
    });

    expect(screen.getByText('Created /workspace/.agents/hooks/pre-tool.sh')).toBeInTheDocument();
  });

  it('does not show built-in AGENTS.md or agent-skill scaffolders in the session FS menu', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = await getSessionFsDriveRow();
    fireEvent.contextMenu(treeRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));

    expect(screen.queryByRole('menuitem', { name: 'Add AGENTS.md' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Add agent-skill' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Add agent-eval' })).not.toBeInTheDocument();
  });

  it('pressing Escape closes the context menu', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const treeRow = await getSessionFsDriveRow();
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

    const treeRow = await getSessionFsDriveRow();
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

    const treeRow = await getSessionFsDriveRow();
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

    const treeRow = await getSessionFsDriveRow();
    fireEvent.contextMenu(treeRow);

    const menu = screen.getByRole('menu', { name: 'Context menu' });
    // New toolbar button is focused first
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));

    // First sub-menu item is focused automatically
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Add File' }));

    // ArrowDown moves to second item
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Add Folder' }));

    // ArrowDown skips the separator to the hook scaffolder
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Add hook' }));

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

    const treeRow = await getSessionFsDriveRow();
    fireEvent.contextMenu(treeRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));

    const menu = screen.getByRole('menu', { name: 'Context menu' });
    screen.getByRole('menuitem', { name: 'Add hook' }).focus();

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

    const treeRow = await getSessionFsDriveRow();
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

    const treeRow = await getSessionFsDriveRow();
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
    const treeRow = await getSessionFsDriveRow();
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

    const treeRow = await getSessionFsDriveRow();
    fireEvent.contextMenu(treeRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add File' }));

    expect(screen.getByRole('dialog', { name: 'Add to session filesystem' })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Entry name' }), { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Add to session filesystem' })).not.toBeInTheDocument();
  });

  // ── Session FS rename / delete ────────────────────────────────────

  async function ensureFilesExpanded() {
    await openDefaultSessionPanel();
    if (!screen.queryByRole('button', { name: '//session-1-fs' }) && !screen.queryByRole('button', { name: '//workspace' })) {
      fireEvent.click(screen.getAllByRole('button', { name: 'Files' })[0]);
    }
    await act(async () => { await Promise.resolve(); });
  }

  async function getSessionFsDriveRow() {
    await ensureFilesExpanded();
    return screen.getByRole('button', { name: '//session-1-fs' }).closest('[role="treeitem"]')!;
  }

  async function expandSessionFsDrive() {
    await ensureFilesExpanded();
    if (!screen.queryByRole('button', { name: 'workspace' })) {
      fireEvent.click(screen.getByRole('button', { name: '//session-1-fs' }));
      await act(async () => { await Promise.resolve(); });
    }
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

    const driveRow = await getSessionFsDriveRow();
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

  it('shell-quotes session FS rename paths before invoking mv', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    await expandSessionFsDrive();
    const maliciousName = 'evil"; touch pwned #';

    const workspaceRow = screen.getByRole('button', { name: 'workspace' }).closest('[role="treeitem"]')!;
    fireEvent.contextMenu(workspaceRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New name' }), {
      target: { value: maliciousName },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
      await Promise.resolve();
    });

    expect(bashExecCommands).toContain(`mv '/workspace' '/${maliciousName}'`);
    expect(bashExecCommands).not.toContain(`mv "/workspace" "/${maliciousName}"`);
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

    const sessionRow = getTreeItemByText('Session 1');
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

    const sessionRow = getTreeItemByText('Session 1');
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

    const sessionRow = getTreeItemByText('Session 1');
    fireEvent.contextMenu(sessionRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    expect(screen.getByRole('dialog', { name: 'Rename session' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Session name' })).toHaveValue('Session 1');
  });

  it('submitting the rename session dialog changes the session name', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const sessionRow = getTreeItemByText('Session 1');
    fireEvent.contextMenu(sessionRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Session name' }), { target: { value: 'My Session' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
      await Promise.resolve();
    });

    expect(screen.queryByRole('dialog', { name: 'Rename session' })).not.toBeInTheDocument();
    expect(getTreeItemByText('My Session')).toBeInTheDocument();
  });

  it('Enter in session rename input submits the rename', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const sessionRow = getTreeItemByText('Session 1');
    fireEvent.contextMenu(sessionRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    const input = screen.getByRole('textbox', { name: 'Session name' });
    fireEvent.change(input, { target: { value: 'Renamed Session' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
      await Promise.resolve();
    });

    expect(screen.queryByRole('dialog', { name: 'Rename session' })).not.toBeInTheDocument();
    expect(getTreeItemByText('Renamed Session')).toBeInTheDocument();
  });

  it('Escape in session rename input cancels without renaming', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const sessionRow = getTreeItemByText('Session 1');
    fireEvent.contextMenu(sessionRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Session name' }), { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Rename session' })).not.toBeInTheDocument();
    expect(getTreeItemByText('Session 1')).toBeInTheDocument();
  });

  it('clicking Remove in session context menu removes the session', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    // Add a second session so removing Session 1 doesn’t break the panel
    fireEvent.click(screen.getByLabelText('Add session to Research'));
    expect(getTreeItemByText('Session 2')).toBeInTheDocument();

    const sessionRow = getTreeItemByText('Session 1');
    fireEvent.contextMenu(sessionRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));

    expect(screen.queryByText('Session 1')).not.toBeInTheDocument();
  });

  it('removing a session unmounts its virtual disk from the Files tree', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    // Verify the VFS drive for Session 1 exists before removal
    await ensureFilesExpanded();
    expect(screen.getByRole('button', { name: '//session-1-fs' })).toBeInTheDocument();

    // Add a second session so removing Session 1 doesn't leave the panel empty
    fireEvent.click(screen.getByLabelText('Add session to Research'));
    expect(getTreeItemByText('Session 2')).toBeInTheDocument();

    const sessionRow = getTreeItemByText('Session 1');
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

    const sessionRow = getTreeItemByText('Session 1');
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

    const driveRow = await getSessionFsDriveRow();
    fireEvent.contextMenu(driveRow);

    const menu = screen.getByRole('menu', { name: 'Context menu' });
    expect(menu.querySelector('.ctx-menu-toolbar')).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'New' })).toBeInTheDocument();
  });

  it('VFS non-root context menu has a toolbar with Rename, Delete and New icon buttons', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    await expandSessionFsDrive();

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

    const driveRow = await getSessionFsDriveRow();
    fireEvent.contextMenu(driveRow);
    fireEvent.click(screen.getByRole('menuitem', { name: 'New' }));

    expect(screen.getByRole('menuitem', { name: 'Add File' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add Folder' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add hook' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Add AGENTS.md' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Add agent-skill' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Add agent-eval' })).not.toBeInTheDocument();
  });

  it('clicking the Back button in the sub-menu returns to the main toolbar view', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    const driveRow = await getSessionFsDriveRow();
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

    fireEvent.contextMenu(getTreeItemByText('Session 1'));
    expect(screen.getByRole('menuitem', { name: 'Properties' })).toBeInTheDocument();
  });

  it('Properties is a list item in a VFS node context menu', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(await getSessionFsDriveRow());
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

    fireEvent.contextMenu(await getSessionFsDriveRow());
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

    fireEvent.contextMenu(getTreeItemByText('Session 1'));
    expect(screen.getByRole('menuitem', { name: 'History' })).toBeInTheDocument();
  });

  it('History is a list item in a VFS node context menu', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(await getSessionFsDriveRow());
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

    fireEvent.contextMenu(await getSessionFsDriveRow());
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getByRole('dialog', { name: 'Version history' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Commit graph' })).toBeInTheDocument();
  });

  it('Version history dialog shows a Rollback button for commits', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(await getSessionFsDriveRow());
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    // The initial commit is always present; it should have a Rollback button
    expect(screen.getAllByRole('button', { name: /Roll back/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('rolling back to the initial commit creates a new branch in the version history', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(await getSessionFsDriveRow());
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

    fireEvent.contextMenu(getTreeItemByText('Session 1'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getByRole('dialog', { name: 'Session history' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Commit graph' })).toBeInTheDocument();
  });

  it('Session history dialog shows a "Branch from here" button for each snapshot', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(getTreeItemByText('Session 1'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));

    expect(screen.getAllByRole('button', { name: /Branch from here/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('clicking "Branch from here" in session history creates a new branch and shows it in the graph', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.contextMenu(getTreeItemByText('Session 1'));
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

  async function clickTreeButton(name: string) {
    fireEvent.click(screen.getByRole('button', { name }));
    await act(async () => { await Promise.resolve(); });
  }

  async function expandWorkspaceDrive() {
    await ensureFilesExpanded();
    if (!screen.queryByRole('button', { name: '.agents' }) && !screen.queryByRole('button', { name: '.memory' })) {
      await clickTreeButton('//workspace');
    }
  }

  async function addSkillAndGetTreeItem(skillName: string) {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.click(screen.getByLabelText('Add file to Research'));
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: skillName } });
    fireEvent.click(screen.getByRole('button', { name: 'Plugin' }));
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    await expandWorkspaceDrive();
    await clickTreeButton('.agents');
    await clickTreeButton('plugins');
    await clickTreeButton(skillName);

    const treeitem = screen.getAllByRole('treeitem').find((el) => el.textContent?.includes('agent-harness.plugin.json'));
    if (!treeitem) throw new Error('plugin manifest treeitem not found');
    return treeitem;
  }

  /** Helper: add a plugin manifest to the Research workspace and return its treeitem element. */
  async function addAgentsMdAndGetTreeItem() {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    fireEvent.click(screen.getByLabelText('Add file to Research'));
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'review-tools' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plugin' }));
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

    await expandWorkspaceDrive();
    await clickTreeButton('.agents');
    await clickTreeButton('plugins');
    await clickTreeButton('review-tools');

    const treeitem = screen.getAllByText('agent-harness.plugin.json')
      .map((el) => el.closest('[role="treeitem"]'))
      .find((el): el is Element => el !== null);
    if (!treeitem) throw new Error('plugin manifest treeitem not found');
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
    const treeitem = await addSkillAndGetTreeItem('my-skill');
    fireEvent.contextMenu(treeitem!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));

    // There should be a listbox (even if empty it renders)
    expect(screen.getByRole('listbox', { name: 'Directories' })).toBeInTheDocument();
  });

  it('picker filters rows as user types in the breadcrumb input', async () => {
    const treeitem = await addSkillAndGetTreeItem('foo');
    fireEvent.contextMenu(treeitem!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));

    const input = screen.getByRole('textbox', { name: /target directory/i });
    // Type a filter that matches .agents/
    fireEvent.change(input, { target: { value: '~/.ag' } });

    const listbox = screen.getByRole('listbox', { name: 'Directories' });
    expect(listbox.textContent).toContain('.agents');
  });

  it('picker shows ".." row after navigating into a subdirectory', async () => {
    const treeitem = await addSkillAndGetTreeItem('bar');
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
    const treeitem = await addSkillAndGetTreeItem('baz');
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

    fireEvent.contextMenu(getTreeItemByText('Session 1'));
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
