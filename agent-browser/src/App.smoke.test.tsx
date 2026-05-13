import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createMultitaskSubagentState } from './services/multitaskSubagents';
import { STORAGE_KEYS } from './services/sessionState';
import {
  appendWorkspaceFileCrdtDiff,
  createWorkspaceFileCrdtHistory,
} from './services/workspaceFileCrdtHistory';
import {
  WORKSPACE_FILES_STORAGE_KEY,
  WORKSPACE_FILE_STORAGE_DEBOUNCE_MS,
} from './services/workspaceFiles';

const searchBrowserModelsMock = vi.fn();
const loadModelMock = vi.fn();
const generateMock = vi.fn();
const fetchCopilotStateMock = vi.fn();
const streamCopilotChatMock = vi.fn();
const fetchCursorStateMock = vi.fn();
const streamCursorChatMock = vi.fn();
const fetchCodexStateMock = vi.fn();
const streamCodexRuntimeChatMock = vi.fn();
const fetchGitWorktreeStatusMock = vi.fn();
const fetchGitWorktreeDiffMock = vi.fn();

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

vi.mock('./services/cursorApi', () => ({
  fetchCursorState: (...args: unknown[]) => fetchCursorStateMock(...args),
  streamCursorChat: (...args: unknown[]) => streamCursorChatMock(...args),
}));

vi.mock('./services/codexApi', () => ({
  fetchCodexState: (...args: unknown[]) => fetchCodexStateMock(...args),
  streamCodexRuntimeChat: (...args: unknown[]) => streamCodexRuntimeChatMock(...args),
}));

vi.mock('./services/gitWorktreeApi', () => ({
  fetchGitWorktreeStatus: (...args: unknown[]) => fetchGitWorktreeStatusMock(...args),
  fetchGitWorktreeDiff: (...args: unknown[]) => fetchGitWorktreeDiffMock(...args),
}));

vi.mock('just-bash/browser', () => {
  class MockBash {
    cwd = '/workspace';
    fileContents = new Map<string, string>([['/workspace/.keep', '']]);
    fsPaths = new Set<string>(['/workspace', '/workspace/.keep']);

    fs = {
      getAllPaths: () => [...this.fsPaths],
      mkdir: () => Promise.resolve(),
      writeFile: () => Promise.resolve(),
      readFile: () => Promise.resolve(''),
    };

    exec() {
      return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
    }
  }
  return { Bash: MockBash };
});

beforeEach(() => {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin = '';
    readonly thresholds: ReadonlyArray<number> = [];

    disconnect() {}
    observe() {}
    takeRecords(): IntersectionObserverEntry[] { return []; }
    unobserve() {}
  }

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  window.localStorage.clear();
  window.sessionStorage.clear();
  searchBrowserModelsMock.mockReset();
  loadModelMock.mockReset();
  generateMock.mockReset();
  fetchCopilotStateMock.mockReset();
  streamCopilotChatMock.mockReset();
  fetchCursorStateMock.mockReset();
  streamCursorChatMock.mockReset();
  fetchCodexStateMock.mockReset();
  streamCodexRuntimeChatMock.mockReset();
  fetchGitWorktreeStatusMock.mockReset();
  fetchGitWorktreeDiffMock.mockReset();
  searchBrowserModelsMock.mockResolvedValue([]);
  loadModelMock.mockResolvedValue(undefined);
  generateMock.mockResolvedValue(undefined);
  fetchCopilotStateMock.mockResolvedValue({
    available: false,
    authenticated: false,
    models: [],
    signInCommand: 'copilot login',
    signInDocsUrl: 'https://docs.github.com/copilot',
  });
  streamCopilotChatMock.mockResolvedValue(undefined);
  fetchCursorStateMock.mockResolvedValue({
    available: false,
    authenticated: false,
    models: [],
    signInCommand: 'Set CURSOR_API_KEY in the dev server environment',
    signInDocsUrl: 'https://cursor.com/blog/typescript-sdk',
  });
  streamCursorChatMock.mockResolvedValue(undefined);
  fetchCodexStateMock.mockResolvedValue({
    available: false,
    authenticated: false,
    models: [],
    signInCommand: 'codex login',
    signInDocsUrl: 'https://developers.openai.com/codex/auth',
  });
  streamCodexRuntimeChatMock.mockResolvedValue(undefined);
  fetchGitWorktreeStatusMock.mockResolvedValue({
    available: true,
    cwd: 'C:/repo',
    worktreeRoot: 'C:/repo',
    branch: 'feature/evidence-review',
    head: 'abc1234',
    upstream: 'origin/main',
    ahead: 1,
    behind: 0,
    isClean: false,
    files: [
      {
        path: 'agent-browser/src/App.tsx',
        status: 'modified',
        staged: false,
        unstaged: true,
        conflicted: false,
      },
      {
        path: 'agent-browser/src/features/worktree/GitWorktreePanel.tsx',
        status: 'modified',
        staged: false,
        unstaged: true,
        conflicted: false,
      },
    ],
    summary: { changed: 2, staged: 0, unstaged: 2, untracked: 0, conflicts: 0 },
  });
  fetchGitWorktreeDiffMock.mockResolvedValue({
    path: 'agent-browser/src/App.tsx',
    patch: 'diff --git a/agent-browser/src/App.tsx b/agent-browser/src/App.tsx\n-old\n+new\n',
    source: 'unstaged',
    isBinary: false,
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('App smoke coverage', () => {
  it('renders the primary shell and default chat workspace', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Omnibar')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Harness dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('tree', { name: 'Workspace tree' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: /Dashboard/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('article', { name: 'Session summary widget' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Knowledge widget' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New session widget' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Customize' })).not.toBeInTheDocument();
  });

  it('dedicates the default workspace render area to the infinite canvas', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const dashboard = screen.getByRole('region', { name: 'Harness dashboard' });
    const canvas = screen.getByLabelText('Infinite session canvas');

    expect(dashboard).toContainElement(canvas);
    expect(canvas.closest('.dashboard-stack')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Git worktree status' })).not.toBeInTheDocument();
  });

  it('keeps browser evidence out of the default infinite canvas render area', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByLabelText('Browser evidence for selected diff')).not.toBeInTheDocument();
    expect(screen.queryByText('Agent Browser visual smoke')).not.toBeInTheDocument();
    expect(screen.queryByText('output/playwright/agent-browser-visual-smoke.png')).not.toBeInTheDocument();
  });

  it('aggregates governed agent-authored workspace surfaces into the knowledge widget', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(STORAGE_KEYS.workspaceSurfacesByWorkspace, JSON.stringify({
      'ws-research': [{
        id: 'surface-ws-research-artifact-launch-review-review-panel-md',
        workspaceId: 'ws-research',
        artifactId: 'artifact-launch-review',
        artifactFilePath: 'review-panel.md',
        surfaceType: 'review-panel',
        renderTarget: 'panel',
        title: 'Launch review surface',
        description: 'Agent-authored release review panel',
        createdByAgent: 'Researcher',
        ownerSessionId: 'session-1',
        permissions: {
          canRead: true,
          canEdit: true,
          canRollback: true,
          canShare: false,
        },
        revision: 2,
        status: 'active',
        createdAt: '2026-05-08T05:01:00.000Z',
        updatedAt: '2026-05-08T05:02:00.000Z',
        versions: [{
          id: 'surface-ws-research-artifact-launch-review-review-panel-md-revision-1',
          revision: 1,
          title: 'Launch review surface',
          surfaceType: 'review-panel',
          renderTarget: 'panel',
          artifactId: 'artifact-launch-review',
          artifactFilePath: 'review-panel.md',
          permissions: {
            canRead: true,
            canEdit: true,
            canRollback: true,
            canShare: false,
          },
          status: 'active',
          createdAt: '2026-05-08T05:01:00.000Z',
        }],
      }],
    }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const knowledgeWidget = screen.getByRole('article', { name: 'Knowledge widget' });
    expect(knowledgeWidget).toHaveTextContent('surfaces');
    expect(knowledgeWidget).toHaveTextContent('Surface: Launch review surface (read, edit, rollback)');
    expect(screen.queryByRole('region', { name: 'Agent-authored workspace surfaces' })).not.toBeInTheDocument();
  });

  it('opens the secure shared chat QR pairing dialog from the chat header', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(STORAGE_KEYS.installedDefaultExtensionIds, JSON.stringify([
      'agent-harness.ext.external-channels',
    ]));
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByLabelText('Add session to Research'));
    fireEvent.click(screen.getByRole('button', { name: 'Share chat session' }));

    expect(screen.getByRole('dialog', { name: 'Share chat session' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start shared session/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Channel share options')).toHaveTextContent('WebRTC peer');
    expect(screen.getByRole('button', { name: 'Share with Slack' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share with Telegram' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share with SMS' })).toBeInTheDocument();
    expect(screen.getByText(/QR is untrusted signaling/i)).toBeInTheDocument();
  });

  it('renders persisted shared-session remote control identity in the chat panel', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(STORAGE_KEYS.sharedSessionControlState, JSON.stringify({
      enabled: true,
      allowRemoteControl: true,
      requirePairingConfirmation: true,
      activeSessions: [{
        sessionId: 'session-remote-control-smoke',
        workspaceName: 'Research',
        peerLabel: 'Maya',
        deviceLabel: 'iPad Pro',
        status: 'active',
        eventCount: 3,
        lastEventAt: '2026-05-07T21:31:00.000Z',
      }],
      audit: [{
        id: 'session-remote-control-smoke:pairing.confirmed:2026-05-07T21:31:00.000Z',
        sessionId: 'session-remote-control-smoke',
        event: 'pairing.confirmed',
        actor: 'Maya',
        summary: 'Maya confirmed pairing for Maya on iPad Pro.',
        createdAt: '2026-05-07T21:31:00.000Z',
      }],
    }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Add session to Research'));

    const banner = screen.getByLabelText('Shared session remote control');
    expect(banner).toHaveTextContent('Maya');
    expect(banner).toHaveTextContent('iPad Pro');
    expect(banner).toHaveTextContent('Remote control enabled');
    expect(banner).toHaveTextContent('3 signed events');
  });

  it('hydrates installed local models from durable session storage', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(
      STORAGE_KEYS.installedModels,
      JSON.stringify([{
        id: 'onnx-community/Qwen3-0.6B-ONNX',
        name: 'Qwen3-0.6B-ONNX',
        author: 'onnx-community',
        task: 'text-generation',
        downloads: 5000,
        likes: 30,
        tags: ['onnx'],
        sizeMB: 0,
        status: 'installed',
      }]),
    );

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Models'));

    expect(screen.getByLabelText('Qwen3-0.6B-ONNX installed')).toBeInTheDocument();
    expect(screen.getAllByText(/Qwen3-0\.6B-ONNX/i).length).toBeGreaterThan(0);
  });

  it('renders Models as a minimal installed sidebar plus provider catalog render pane', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(
      STORAGE_KEYS.installedModels,
      JSON.stringify([{
        id: 'onnx-community/Qwen3-0.6B-ONNX',
        name: 'Qwen3-0.6B-ONNX',
        author: 'onnx-community',
        task: 'text-generation',
        downloads: 5000,
        likes: 30,
        tags: ['onnx'],
        sizeMB: 768,
        contextWindow: 4096,
        maxOutputTokens: 512,
        status: 'installed',
      }]),
    );
    fetchCopilotStateMock.mockResolvedValue({
      available: true,
      authenticated: true,
      models: [
        { id: 'gpt-5', name: 'OpenAI GPT-5', reasoning: true, vision: true, contextWindow: 128000, maxOutputTokens: 8192 },
        { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', reasoning: true, vision: false },
      ],
      signInCommand: 'copilot login',
      signInDocsUrl: 'https://docs.github.com/copilot',
    });
    fetchCursorStateMock.mockResolvedValue({
      available: true,
      authenticated: true,
      models: [{ id: 'cursor-small', name: 'Cursor Small', contextWindow: 64000, maxOutputTokens: 4096 }],
      signInCommand: 'Set CURSOR_API_KEY in the dev server environment',
      signInDocsUrl: 'https://cursor.com/blog/typescript-sdk',
    });
    fetchCodexStateMock.mockResolvedValue({
      available: true,
      authenticated: true,
      version: '1.2.3',
      models: [{ id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', reasoning: true, vision: false }],
      signInCommand: 'codex login',
      signInDocsUrl: 'https://developers.openai.com/codex/auth',
    });
    searchBrowserModelsMock.mockResolvedValue([{
      id: 'onnx-community/Phi-4-mini-ONNX',
      name: 'Phi-4-mini-ONNX',
      author: 'onnx-community',
      task: 'text-generation',
      downloads: 4200,
      likes: 18,
      tags: ['onnx', 'transformers.js'],
      sizeMB: 900,
      contextWindow: 4096,
      maxOutputTokens: 512,
      status: 'available',
    }]);

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByLabelText('Models'));

    const installedSidebar = screen.getByRole('region', { name: 'Installed models' });
    expect(within(installedSidebar).getByLabelText('Qwen3-0.6B-ONNX installed from Hugging Face')).toBeInTheDocument();
    expect(installedSidebar).toHaveTextContent('Hugging Face');
    expect(installedSidebar).not.toHaveTextContent('Providers');
    expect(installedSidebar).not.toHaveTextContent('Built-in local inference');
    expect(installedSidebar).not.toHaveTextContent('Search Hugging Face');

    const catalog = screen.getByRole('region', { name: 'Model catalog' });
    expect(within(catalog).getByRole('heading', { name: 'Find the Right Model for Your AI Solution' })).toBeInTheDocument();
    expect(within(catalog).getByRole('heading', { name: 'GitHub Copilot Models (2)' })).toBeInTheDocument();
    expect(within(catalog).getByRole('heading', { name: 'Cursor Models (1)' })).toBeInTheDocument();
    expect(within(catalog).getByRole('heading', { name: 'Codex Models (1)' })).toBeInTheDocument();
    expect(within(catalog).getByRole('heading', { name: 'Local Browser Models (6)' })).toBeInTheDocument();
    expect(catalog).toHaveTextContent('OpenAI GPT-5');
    expect(catalog).toHaveTextContent('Cursor Small');
    expect(catalog).toHaveTextContent('GPT-5.1 Codex');
    expect(catalog).toHaveTextContent('Phi-4-mini-ONNX');
  });

  it('hydrates the Symphony task system from durable session storage', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(STORAGE_KEYS.activePanel, JSON.stringify('symphony'));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const app = screen.getByRole('region', { name: 'Symphony task management system' });
    expect(app).toBeInTheDocument();
    expect(app).toHaveTextContent('Agent Workspaces');
    expect(app).toHaveTextContent('Isolated Workspaces');
    expect(app).toHaveTextContent('Review Gate');
    expect(app).toHaveTextContent('No active Symphony task');
    expect(app).not.toHaveTextContent('agent/research/frontend-1');
    expect(app).not.toHaveTextContent('Running');
    expect(app).not.toHaveTextContent('Slots');
    const sidebar = screen.getByRole('region', { name: 'Symphony activity summary' });
    expect(sidebar).toHaveTextContent('Idle');
    expect(sidebar).not.toHaveTextContent('State store');
    expect(sidebar).not.toHaveTextContent('IndexedDB');
    expect(sidebar).not.toHaveTextContent('agent/research/tests-2');
    expect(within(sidebar).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'PR review understanding' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Symphony task request'), {
      target: { value: 'parallelize frontend and validation work' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start Symphony task' }));

    expect(screen.getByText('agent/research/frontend-1')).toBeInTheDocument();
    expect(screen.getAllByText('agent active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3 events').length).toBeGreaterThan(0);
  });

  it('renders the repository wiki as a navigation sidebar plus knowledgebase workbench', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(STORAGE_KEYS.activePanel, JSON.stringify('wiki'));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const wikiPanel = screen.getByRole('region', { name: 'Wiki explorer' });
    expect(wikiPanel).toBeInTheDocument();
    expect(within(wikiPanel).queryByRole('navigation', { name: 'Wiki views' })).not.toBeInTheDocument();
    expect(wikiPanel).not.toHaveTextContent('Wiki Pages');
    expect(wikiPanel).not.toHaveTextContent('Knowledge Graph');
    expect(wikiPanel).not.toHaveTextContent('Memory');
    expect(wikiPanel).not.toHaveTextContent('Files');
    expect(wikiPanel).not.toHaveTextContent('Plugins');
    expect(wikiPanel).not.toHaveTextContent('Sessions');
    expect(wikiPanel).not.toHaveTextContent('Citations');
    expect(wikiPanel).not.toHaveTextContent(/\d+ pages/i);
    expect(wikiPanel).not.toHaveTextContent('Generated pages');
    expect(wikiPanel).not.toHaveTextContent('Entities, relationships');
    expect(wikiPanel).not.toHaveTextContent('wiki:ws-research:workspace-map');
    expect(screen.queryByLabelText('Coverage summary')).not.toBeInTheDocument();
    expect(screen.queryByText(/stored files/)).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Workspace knowledgebase wiki' })).toBeInTheDocument();
    expect(screen.getByRole('search', { name: 'Wiki search' })).toBeInTheDocument();
    expect(screen.getAllByText('Repo map').length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Wiki Pages' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Knowledge Graph' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Memory' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Memory Models' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Scoped Chat' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Sources' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Search wiki pages and memories')).toBeInTheDocument();
    expect(screen.getAllByText('wiki:ws-research:workspace-map').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Refresh wiki' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Search wiki pages and memories'), { target: { value: 'capability' } });
    });

    expect(screen.getByRole('heading', { name: 'Capability files' })).toBeInTheDocument();
    expect(screen.getByText('Related pages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Runtime surfaces' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Page context' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Knowledge Graph' }));
    });

    expect(screen.getByRole('button', { name: 'All knowledge' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nearby' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Isolated chunks' })).toBeInTheDocument();
    expect(screen.getByLabelText('Graph relationship lines')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Graph inspector' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Relationship table' })).toBeInTheDocument();
    expect(screen.getByText('Incoming relationships')).toBeInTheDocument();
    expect(screen.getByText('Outgoing relationships')).toBeInTheDocument();
    expect(screen.getByText('Unlinked mentions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select graph node Repo map' })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Isolated chunks' }));
    });
    expect(screen.getByRole('tabpanel', { name: 'Knowledge Graph' })).toHaveTextContent('No isolated chunks match the current graph filter.');

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Memory' }));
    });

    expect(screen.getByRole('region', { name: 'Memory management console' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Memory library' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Memory scopes' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Add memory' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Stored memory manager' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear memory search filter' })).toBeInTheDocument();
    expect(screen.getByText('No stored memories match "capability".')).toBeInTheDocument();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Memory scope'), { target: { value: 'project' } });
      fireEvent.change(screen.getByLabelText('Memory text'), { target: { value: 'Repository wiki search belongs in the wiki page.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Remember' }));
    });
    expect(screen.getByText('Repository wiki search belongs in the wiki page.')).toBeInTheDocument();
    const storedMemoryList = screen.getByRole('region', { name: 'Memory library' });
    expect(within(storedMemoryList).getByText('project')).toBeInTheDocument();
    expect(within(storedMemoryList).getByText(/warm · \.memory\/project\.memory\.md/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Forget memory: Repository wiki search belongs in the wiki page.' }));
    });
    expect(screen.queryByText('Repository wiki search belongs in the wiki page.')).not.toBeInTheDocument();
  });

  it('ignores the removed Agent canvases sidebar panel from persisted state', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(STORAGE_KEYS.activePanel, JSON.stringify('canvases'));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.queryByRole('region', { name: 'Agent canvases' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Workspace tree')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Canvases' })).not.toBeInTheDocument();
  });

  it('renders Symphony branch comparison, merge review, and approval controls', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(STORAGE_KEYS.activePanel, JSON.stringify('symphony'));
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
      await vi.runOnlyPendingTimersAsync();
    });

    const app = screen.getByRole('region', { name: 'Symphony task management system' });
    expect(app).toBeInTheDocument();
    expect(screen.getByText('Isolated Workspaces')).toBeInTheDocument();
    expect(screen.getAllByText('agent/research/frontend-1').length).toBeGreaterThan(0);
    expect(within(app).getByRole('button', { name: 'Open task SYM-001 Frontend branch' })).toBeInTheDocument();
    expect(screen.getByText('Review Gate')).toBeInTheDocument();
    expect(screen.getAllByText('Reviewer Feedback').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Send reviewer agent feedback for agent/research/tests-2' })).toBeInTheDocument();
    fireEvent.click(within(app).getByRole('button', { name: 'Request changes for agent/research/tests-2' }));
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.multitaskSubagentState) ?? '{}');
    expect(persisted.branches.find((branch: { branchName: string }) => branch.branchName === 'agent/research/tests-2')).toMatchObject({
      status: 'running',
      progress: 10,
      runAttempt: 1,
    });
  });

  it('persists Symphony branch session lifecycle controls from the workspace app', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(STORAGE_KEYS.activePanel, JSON.stringify('symphony'));
    const taskState = createMultitaskSubagentState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    window.localStorage.setItem(STORAGE_KEYS.multitaskSubagentState, JSON.stringify(taskState));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const app = screen.getByRole('region', { name: 'Symphony task management system' });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.multitaskSubagentState) ?? '{}')
      .branches.find((branch: { branchName: string }) => branch.branchName === 'agent/research/frontend-1')).toMatchObject({
        status: 'running',
        runAttempt: 1,
      });
    expect(within(app).getAllByText('agent active').length).toBeGreaterThan(0);
    expect(within(app).getAllByText('3 events').length).toBeGreaterThan(0);

    fireEvent.click(within(app).getByRole('button', { name: 'Stop agent session for agent/research/frontend-1' }));
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.multitaskSubagentState) ?? '{}')
      .branches.find((branch: { branchName: string }) => branch.branchName === 'agent/research/frontend-1')).toMatchObject({
        status: 'stopped',
      });

    expect(within(app).queryByRole('button', { name: 'Cancel task for agent/research/frontend-1' })).not.toBeInTheDocument();
    fireEvent.click(within(app).getByRole('button', { name: 'Close task and dispose workspace for agent/research/frontend-1' }));
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.multitaskSubagentState) ?? '{}')
      .branches.some((branch: { branchName: string }) => branch.branchName === 'agent/research/frontend-1')).toBe(false);
  });

  it('starts newly created Symphony work-queue tasks instead of leaving them preparing', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(STORAGE_KEYS.activePanel, JSON.stringify('symphony'));
    const taskState = createMultitaskSubagentState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    window.localStorage.setItem(STORAGE_KEYS.multitaskSubagentState, JSON.stringify(taskState));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const app = screen.getByRole('region', { name: 'Symphony task management system' });
    const queue = within(app).getByRole('region', { name: 'Symphony work queue' });
    fireEvent.change(within(queue).getByLabelText('New task title'), {
      target: { value: 'make a new widget' },
    });
    fireEvent.click(within(queue).getByRole('button', { name: 'Create Symphony task' }));
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(within(queue).getByRole('button', { name: 'Open task SYM-004 make a new widget' })).toBeInTheDocument();
    expect(within(queue).getByLabelText('New task title')).toHaveValue('');
    expect(within(app).getByRole('region', { name: 'Symphony task detail' })).toHaveTextContent('make a new widget');
    expect(within(app).getByRole('region', { name: 'Symphony task detail' })).toHaveTextContent('Running');
    expect(within(app).getByRole('region', { name: 'Symphony task detail' })).toHaveTextContent('StreamingTurn');

    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.multitaskSubagentState) ?? '{}');
    expect(persisted.selectedBranchId).toBe('multitask:ws-research:make-a-new-widget-4');
    expect(persisted.branches.find((branch: { title: string }) => branch.title === 'make a new widget')).toMatchObject({
      branchName: 'agent/research/make-a-new-widget-4',
      status: 'running',
      progress: 10,
    });
  });

  it('rolls Symphony task events and session summaries into History', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(STORAGE_KEYS.activePanel, JSON.stringify('symphony'));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.change(screen.getByLabelText('Symphony task request'), {
      target: { value: 'parallelize frontend and validation work' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start Symphony task' }));
    await act(async () => {
      vi.advanceTimersByTime(25);
    });

    fireEvent.click(screen.getByLabelText('History'));
    await act(async () => {
      vi.advanceTimersByTime(25);
    });

    const historyPanel = screen.getByRole('region', { name: 'History' });
    expect(historyPanel).toHaveTextContent('Symphony activity: Updated Symphony');
    fireEvent.click(screen.getByRole('button', { name: 'Inspect branch history for Symphony activity: Updated Symphony' }));
    expect(historyPanel).toHaveTextContent('Symphony event: workflow loaded - Loaded WORKFLOW.md and applied Symphony runtime defaults.');
    expect(historyPanel).toHaveTextContent('Symphony session: SYM-001 agent/research/frontend-1 StreamingTurn active 1 turn, 3 evidence events');
  });

  it('enables Symphony reviewer autopilot by default and persists disabling it from Settings', async () => {
    vi.useFakeTimers();
    const taskState = createMultitaskSubagentState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      request: 'parallelize frontend work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    window.localStorage.setItem(STORAGE_KEYS.multitaskSubagentState, JSON.stringify({
      ...taskState,
      branches: taskState.branches.map((branch) => ({ ...branch, status: 'ready', progress: 100 })),
    }));
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));
    fireEvent.click(screen.getByRole('button', { name: 'Symphony autopilot' }));

    const autopilotToggle = screen.getByLabelText('Enable Symphony autopilot');
    expect(autopilotToggle).toBeChecked();
    fireEvent.click(autopilotToggle);

    expect(autopilotToggle).not.toBeChecked();
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.symphonyAutopilotSettings) ?? '{}')).toEqual({
      autopilotEnabled: false,
    });

    fireEvent.click(screen.getByLabelText('Symphony'));

    expect(screen.queryByRole('button', { name: 'Reviewer agent disabled for agent/research/frontend-1' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Symphony activity summary' })).toHaveTextContent('Reviewer disabled');
  });

  it('starts and renders branching conversation controls across chat History and Settings', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Add session to Research'));
    fireEvent.click(screen.getByRole('button', { name: 'Start conversation branch' }));

    expect(screen.getByText(/Conversation branch started/i)).toBeInTheDocument();
    expect(screen.getByText(/branches 1 active/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to main conversation' })).toBeInTheDocument();
    expect(screen.getByText('conversation/research/branch-active-chat-thread')).toBeInTheDocument();
    expect(screen.getByText(/Steering messages update this running subthread/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Agent provider'), { target: { value: 'tour-guide' } });
    fireEvent.change(screen.getByLabelText('Chat input'), {
      target: { value: 'Keep the browser evidence focused on the checkout flow.' },
    });
    expect(screen.getByRole('button', { name: 'Send' })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Back to main conversation' }));

    expect(screen.getByText('Subthread transcripts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open conversation/research/branch-active-chat-thread' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('History'));

    const historyPanel = screen.getByRole('region', { name: 'History' });
    expect(screen.getByRole('region', { name: 'Workspace git graph' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Branching conversations' })).not.toBeInTheDocument();
    expect(historyPanel).toHaveTextContent('Branch active chat thread');
    expect(historyPanel).toHaveTextContent('conversation/research/branch-active-chat-thread');
    expect(historyPanel).toHaveTextContent('running');
    fireEvent.click(screen.getByRole('button', { name: 'Inspect branch history for Branch active chat thread' }));
    expect(historyPanel).toHaveTextContent('Branch started: Branch active chat thread');

    fireEvent.click(screen.getAllByRole('button', { name: 'Open conversation/research/branch-active-chat-thread' })[0]);
    expect(screen.getByRole('button', { name: 'Back to main conversation' })).toBeInTheDocument();
    expect(screen.getByText(/Steering messages update this running subthread/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Chat input')).not.toBeDisabled();

    fireEvent.click(screen.getByLabelText('Settings'));
    fireEvent.click(screen.getByRole('button', { name: 'Branching conversations' }));

    expect(screen.getByLabelText('Enable conversation branching')).toBeChecked();
    expect(screen.getByLabelText('Inject branch summaries into prompt context')).toBeChecked();
    expect(screen.getByText('Process graph branch nodes')).toBeInTheDocument();
  });

  it('renders adversary tool review controls in Settings', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByText('Adversary tool review')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Adversary tool review' }));
    expect(screen.getByLabelText('Enable adversary tool-call review')).toBeInTheDocument();
    expect(screen.getByLabelText('Strictly block high-risk reviewed actions')).toBeInTheDocument();
    expect(screen.getByLabelText('Adversary review custom rules')).toBeInTheDocument();
  });

  it('renders the first-class Adversary agent and Settings controls', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const workspaceTree = screen.getByRole('tree', { name: 'Workspace tree' });
    fireEvent.click(within(workspaceTree).getByRole('button', { name: /^Session 1$/ }));
    expect(screen.getByRole('combobox', { name: 'Agent provider' })).toHaveTextContent('Adversary');

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByText('Adversary agent')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Adversary agent' }));
    expect(screen.getByLabelText('Enable adversary candidate generation')).toBeInTheDocument();
    expect(screen.getByLabelText('Maximum adversary candidates')).toHaveValue(3);
    expect(screen.getByLabelText('Rerun when adversary output wins')).toBeChecked();
    expect(screen.getByLabelText('Preserve judge feedback in AgentBus')).toBeChecked();
    expect(screen.getByLabelText('Hide adversary labels from voters')).toBeChecked();
  });

  it('renders runtime plugin controls in Settings', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByText('Runtime plugins')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Runtime plugins' }));
    expect(screen.getByLabelText('Enable runtime plugins')).toBeInTheDocument();
    expect(screen.getByLabelText('Tool-call interception mode')).toHaveValue('observe');
    expect(screen.getByText(/active plugins/i)).toBeInTheDocument();
  });

  it('installs extension dependencies from the marketplace', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Extensions'));

    const marketplace = screen.getByRole('region', { name: 'Extension marketplace' });
    expect(screen.getByText('Requires DESIGN.md agent guidance')).toBeInTheDocument();
    expect(marketplace.querySelector('.marketplace-card')).toBeNull();
    expect(marketplace.querySelector('.badge')).toBeNull();
    expect(marketplace.querySelector('.chip')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install Design Studio' }));
      await Promise.resolve();
    });

    const installedSidebar = screen.getByRole('region', { name: 'Installed extensions' });
    expect(installedSidebar).toHaveTextContent('DESIGN.md agent guidance');
    expect(installedSidebar).toHaveTextContent('Design Studio');
    expect(installedSidebar).toHaveTextContent('Required by Design Studio');
    expect(installedSidebar.querySelector('.marketplace-card')).toBeNull();
    expect(installedSidebar.querySelector('.badge')).toBeNull();
    expect(installedSidebar.querySelector('.chip')).toBeNull();
  });

  it('opens marketplace items as README-style extension details', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Extensions'));
    const marketplace = screen.getByRole('region', { name: 'Extension marketplace' });
    fireEvent.click(within(marketplace).getByRole('button', { name: 'Open details for Design Studio' }));

    const detail = screen.getByRole('region', { name: 'Extension detail' });
    expect(within(detail).getByRole('heading', { name: 'Design Studio' })).toBeInTheDocument();
    expect(within(detail).getByRole('tab', { name: 'Details' })).toBeInTheDocument();
    expect(within(detail).getByRole('tab', { name: 'Features' })).toBeInTheDocument();
    expect(within(detail).getByRole('heading', { name: 'README.md' })).toBeInTheDocument();
    expect(within(detail).getByText('Identifier')).toBeInTheDocument();
    expect(within(detail).getByText('agent-harness.ext.design-studio')).toBeInTheDocument();
  });

  it('merges workspace plugin manifests into installed extensions instead of a separate pane', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Extensions'));
    const installedSidebar = screen.getByRole('region', { name: 'Installed extensions' });

    expect(installedSidebar).not.toHaveTextContent('Workspace plugins');
    expect(installedSidebar).toHaveTextContent('symphony');
    expect(installedSidebar).toHaveTextContent('Workspace plugin');
  });

  it('opens installed IDE extension activity icons as feature panes and keeps Models independent', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Extensions'));
    const marketplace = screen.getByRole('region', { name: 'Extension marketplace' });
    await act(async () => {
      fireEvent.click(within(marketplace).getByRole('button', { name: 'Install Design Studio' }));
      fireEvent.click(within(marketplace).getByRole('button', { name: 'Install Symphony internal task orchestration' }));
      fireEvent.click(within(marketplace).getByRole('button', { name: 'Install Workflow canvas orchestration' }));
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Design Studio extension' }));
    });
    const projectsPanel = screen.getByRole('region', { name: 'Design Studio projects' });
    expect(projectsPanel).toHaveTextContent('No design projects yet');
    expect(screen.queryByRole('region', { name: 'Installed extensions' })).not.toBeInTheDocument();
    const studio = screen.getByRole('region', { name: 'Design Studio feature pane' });
    expect(within(studio).getByRole('heading', { name: 'Design Studio' })).toBeInTheDocument();
    expect(within(studio).getByLabelText('Design Studio design prompt')).toHaveValue(
      'Build a sleek AI-native DESIGN.md studio for composing product design systems.',
    );
    const notesField = within(studio).getByLabelText('Design Studio notes');
    await act(async () => {
      fireEvent.change(notesField, { target: { value: 'Autosave the project artifact when focus leaves the studio.' } });
    });
    await act(async () => {
      fireEvent.blur(notesField, { relatedTarget: screen.getByLabelText('Extensions') });
    });
    expect(screen.getByRole('region', { name: 'Design Studio projects' })).toHaveTextContent('Research Design System');
    await act(async () => {
      fireEvent.click(within(studio).getByRole('tab', { name: 'Show token review' }));
    });
    const review = screen.getByRole('region', { name: 'Design Studio token review' });
    expect(within(review).getByLabelText('Design Studio approval summary')).toHaveTextContent('0/6 approved');
    expect(within(review).getByLabelText('Design Studio approval composition sample')).toHaveTextContent('Agent Browser approval composition');
    expect(within(review).getByLabelText('Display type visual sample')).toHaveTextContent('Aa');
    expect(within(review).getByLabelText('Action components visual sample')).toHaveTextContent('Run');
    for (const approveButton of within(review).getAllByRole('button', { name: /^Approve / })) {
      await act(async () => {
        fireEvent.click(approveButton);
      });
    }
    expect(within(review).getByLabelText('Design Studio approval summary')).toHaveTextContent('6/6 approved');
    await act(async () => {
      fireEvent.click(within(review).getByLabelText('Publish approved Design Studio system'));
      fireEvent.click(within(review).getByLabelText('Use Design Studio system as workspace default'));
    });
    expect(within(review).getByLabelText('Publish approved Design Studio system')).toBeChecked();
    expect(within(review).getByLabelText('Use Design Studio system as workspace default')).toBeChecked();
    await act(async () => {
      fireEvent.click(within(studio).getByRole('button', { name: 'Compile DESIGN.md' }));
    });
    const generatedFiles = screen.getByRole('region', { name: 'Design Studio generated artifacts' });
    expect(generatedFiles).toHaveTextContent('//workspace/artifacts/design-studio-research-design-system/DESIGN.md');
    expect(generatedFiles).toHaveTextContent('//workspace/artifacts/design-studio-research-design-system/research.json');
    expect(generatedFiles).toHaveTextContent('//workspace/artifacts/design-studio-research-design-system/token-review.json');
    expect(generatedFiles).not.toHaveTextContent(['design', 'design-studio'].join('/'));
    expect(screen.getByRole('region', { name: 'Design Studio projects' })).toHaveTextContent('Research Design System');
    expect(screen.getByLabelText('DESIGN.md preview')).toHaveTextContent('## Source Inventory');
    expect(screen.getByLabelText('DESIGN.md preview')).toHaveTextContent('## Token Review And Approval');
    expect(screen.getByLabelText('DESIGN.md preview')).toHaveTextContent('status: published');
    await act(async () => {
      fireEvent.click(within(studio).getByRole('button', { name: 'Run design critique' }));
    });
    expect(screen.getByRole('region', { name: 'Design Studio critique' })).toHaveTextContent('Gate pass');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Symphony internal task orchestration extension' }));
    });
    expect(screen.getByRole('region', { name: 'Symphony internal task orchestration feature pane' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Workflow canvas orchestration extension' }));
    });
    expect(screen.getByRole('region', { name: 'Workflow canvas orchestration feature pane' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Models'));
    });
    expect(screen.getByRole('heading', { name: 'Models' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Artifact worktree explorer feature pane' })).not.toBeInTheDocument();
  });

  it('clears an active IDE extension pane when keyboard navigation returns to Extensions', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Extensions'));
    const marketplace = screen.getByRole('region', { name: 'Extension marketplace' });
    await act(async () => {
      fireEvent.click(within(marketplace).getByRole('button', { name: 'Install Design Studio' }));
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Design Studio extension' }));
    });
    expect(screen.getByRole('region', { name: 'Design Studio feature pane' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { altKey: true, key: '5' });
    });

    expect(screen.getByRole('region', { name: 'Extension marketplace' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Design Studio feature pane' })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { altKey: true, key: '6' });
    });

    expect(screen.getByRole('heading', { name: 'Models' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Design Studio feature pane' })).not.toBeInTheDocument();
  });

  it('installs the artifact worktree explorer as a workspace tree Artifacts node instead of an activity pane', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(STORAGE_KEYS.artifactsByWorkspace, JSON.stringify({
      'ws-research': [{
        id: 'artifact-launch-review',
        title: 'Launch review',
        kind: 'markdown',
        createdAt: '2026-05-10T12:00:00.000Z',
        updatedAt: '2026-05-10T12:00:00.000Z',
        files: [{
          path: 'review-panel.md',
          mediaType: 'text/markdown',
          content: '# Launch review\n\nReady for workspace-tree review.',
        }],
        references: [],
        versions: [],
      }],
    }));
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Extensions'));
    const marketplace = screen.getByRole('region', { name: 'Extension marketplace' });
    await act(async () => {
      fireEvent.click(within(marketplace).getByRole('button', { name: 'Install Artifact worktree explorer' }));
      vi.advanceTimersByTime(350);
    });

    expect(screen.queryByRole('button', { name: 'Artifact worktree explorer extension' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Artifact worktree explorer feature pane' })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Projects'));
      vi.advanceTimersByTime(350);
    });

    const tree = screen.getByRole('tree', { name: 'Workspace tree' });
    expect(within(tree).getByRole('treeitem', { name: /^Artifacts/ })).toBeInTheDocument();
    const artifactBundleRow = within(tree).getByRole('treeitem', { name: /^Launch review/ });
    expect(artifactBundleRow).toBeInTheDocument();
    expect(within(tree).queryByRole('treeitem', { name: /\/\/artifacts/ })).not.toBeInTheDocument();

    fireEvent.click(within(artifactBundleRow).getByRole('button', { name: /^Launch review/ }));
    const artifactFileRow = within(tree).getByRole('treeitem', { name: /review-panel\.md/ });
    const artifactFileButton = artifactFileRow.querySelector('.tree-button');
    expect(artifactFileButton).not.toBeNull();
    fireEvent.click(artifactFileButton!);

    expect(screen.getByRole('region', { name: 'Artifact viewer' })).toBeInTheDocument();
    expect(screen.getByText('//workspace/artifacts/artifact-launch-review/review-panel.md')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Markdown preview renderer' })).toHaveTextContent('Ready for workspace-tree review.');
  });

  it('renders workflow canvas orchestration as a single-pane builder instead of manifest documentation', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Extensions'));
    const marketplace = screen.getByRole('region', { name: 'Extension marketplace' });
    await act(async () => {
      fireEvent.click(within(marketplace).getByRole('button', { name: 'Install Workflow canvas orchestration' }));
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
      fireEvent.click(screen.getByRole('button', { name: 'Workflow canvas orchestration extension' }));
    });

    const pane = screen.getByRole('region', { name: 'Workflow canvas orchestration feature pane' });
    const workbench = within(pane).getByRole('region', { name: 'Workflow canvas workbench' });
    expect(within(pane).getByTestId('workflow-canvas-plugin-renderer')).toHaveAttribute(
      'data-plugin-id',
      'agent-harness.ext.workflow-canvas',
    );
    expect(within(workbench).getByRole('region', { name: 'Workflow node catalog' })).toHaveTextContent('Webhook trigger');
    expect(within(workbench).getByRole('region', { name: 'Workflow node catalog' })).toHaveTextContent('AI agent');
    expect(within(workbench).getByRole('region', { name: 'Workflow node catalog' })).toHaveTextContent('Media generation');

    const canvas = within(workbench).getByRole('region', { name: 'Workflow orchestration canvas' });
    expect(within(canvas).getByRole('button', { name: 'Inspect Webhook intake' })).toBeInTheDocument();
    expect(within(canvas).getByRole('button', { name: 'Inspect Research agent' })).toBeInTheDocument();
    expect(within(canvas).getByRole('button', { name: 'Inspect Generate campaign media' })).toBeInTheDocument();
    expect(within(canvas).getByText('n8n replay')).toBeInTheDocument();
    expect(within(canvas).getByText('OpenAI typed edge')).toBeInTheDocument();
    expect(within(canvas).getByText('Higgsfield branch')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(within(canvas).getByRole('button', { name: 'Inspect Generate campaign media' }));
    });
    const inspector = within(workbench).getByRole('region', { name: 'Workflow node inspector' });
    expect(inspector).toHaveTextContent('Generate campaign media');
    expect(inspector).toHaveTextContent('Credit estimate');
    expect(inspector).toHaveTextContent('Source: Higgsfield Canvas');

    await act(async () => {
      fireEvent.click(within(workbench).getByRole('button', { name: 'Run workflow' }));
    });
    expect(within(workbench).getByRole('region', { name: 'Workflow execution replay' })).toHaveTextContent('Run complete');

    await act(async () => {
      fireEvent.click(within(workbench).getByRole('button', { name: 'Save canvas artifact' }));
    });
    expect(within(workbench).getByRole('status', { name: 'Workflow canvas save status' })).toHaveTextContent('Saved workflow-canvas/campaign-launch.json');
    expect(within(workbench).getByRole('region', { name: 'Saved workflow canvases' })).toHaveTextContent('workflow-canvas/campaign-launch.json');
  });

  it('locks workflow canvas extension files and removes them only when the extension is uninstalled', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Extensions'));
    const marketplace = screen.getByRole('region', { name: 'Extension marketplace' });
    await act(async () => {
      fireEvent.click(within(marketplace).getByRole('button', { name: 'Install Workflow canvas orchestration' }));
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
      fireEvent.click(screen.getByRole('button', { name: 'Workflow canvas orchestration extension' }));
    });

    const pane = screen.getByRole('region', { name: 'Workflow canvas orchestration feature pane' });
    await act(async () => {
      fireEvent.click(within(pane).getByRole('button', { name: 'Save canvas artifact' }));
    });
    expect(within(pane).getByRole('region', { name: 'Saved workflow canvases' })).toHaveTextContent('workflow-canvas/campaign-launch.json');
    await act(async () => {
      vi.advanceTimersByTime(WORKSPACE_FILE_STORAGE_DEBOUNCE_MS + 1);
    });

    const storedAfterSave = JSON.parse(window.localStorage.getItem(WORKSPACE_FILES_STORAGE_KEY) ?? '{}') as Record<string, unknown[]>;
    expect(storedAfterSave['ws-research']).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'workflow-canvas/campaign-launch.json',
        extensionOwnership: {
          extensionId: 'agent-harness.ext.workflow-canvas',
          extensionName: 'Workflow canvas orchestration',
          locked: true,
        },
      }),
    ]));

    fireEvent.click(screen.getByLabelText('Extensions'));
    const refreshedMarketplace = screen.getByRole('region', { name: 'Extension marketplace' });
    await act(async () => {
      fireEvent.click(within(refreshedMarketplace).getByRole('button', { name: 'Uninstall Workflow canvas orchestration' }));
    });
    await act(async () => {
      vi.advanceTimersByTime(WORKSPACE_FILE_STORAGE_DEBOUNCE_MS + 1);
    });

    const storedAfterUninstall = JSON.parse(window.localStorage.getItem(WORKSPACE_FILES_STORAGE_KEY) ?? '{}') as Record<string, unknown[]>;
    expect(storedAfterUninstall['ws-research']).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'workflow-canvas/campaign-launch.json' }),
    ]));
  });

  it('renders partner agent control plane controls in Settings', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByText('Partner agent control plane')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Partner agent control plane' }));
    expect(screen.getByLabelText('Enable partner-agent control plane')).toBeInTheDocument();
    expect(screen.getByLabelText('Require partner-agent policy review')).toBeInTheDocument();
    expect(screen.getByLabelText('Preserve partner-agent evidence')).toBeInTheDocument();
    expect(screen.getByLabelText('Partner-agent audit level')).toHaveValue('standard');
    expect(screen.getByText('Unified workflow')).toBeInTheDocument();
  });

  it('renders reusable harness core status in Settings', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByText('Harness core')).toBeInTheDocument();
    expect(screen.getByText('Core active')).toBeInTheDocument();
    expect(screen.getByText('thread lifecycle')).toBeInTheDocument();
    expect(screen.getByText('event streaming')).toBeInTheDocument();
  });

  it('renders Settings as a scoped plugin workbench', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    const workbench = screen.getByRole('region', { name: 'Settings workbench' });
    expect(within(workbench).getByLabelText('Search settings')).toBeInTheDocument();
    expect(within(workbench).getByRole('tab', { name: 'User' })).toHaveAttribute('aria-selected', 'true');
    expect(within(workbench).getByRole('tab', { name: 'Workspace' })).toBeInTheDocument();
    expect(within(workbench).getByRole('tab', { name: 'Session' })).toBeInTheDocument();
    expect(within(workbench).getByRole('navigation', { name: 'Settings categories' })).toBeInTheDocument();
    expect(within(workbench).getByRole('button', { name: 'Open Runtime plugins settings' })).toBeInTheDocument();
    expect(within(workbench).getByRole('heading', { name: 'Commonly Used' })).toBeInTheDocument();
    expect(within(workbench).getAllByText('Extension').length).toBeGreaterThan(0);
    expect(within(workbench).getAllByText('Workspace').length).toBeGreaterThan(0);

    fireEvent.change(within(workbench).getByLabelText('Search settings'), { target: { value: 'secrets' } });

    expect(within(workbench).getByRole('button', { name: 'Secrets (0)' })).toBeInTheDocument();
    expect(within(workbench).queryByRole('button', { name: 'Runtime plugins' })).not.toBeInTheDocument();
  });

  it('renders versioned workspace skill policy controls in Settings', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByText('Workspace skill policies')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Workspace skill policies' }));
    expect(screen.getByLabelText('Enable workspace skill policies')).toBeInTheDocument();
    expect(screen.getByLabelText('Least-privilege enforcement')).toBeChecked();
    expect(screen.getByText('Versioned packages')).toBeInTheDocument();
    expect(screen.getByText('Policy-aware regex grep')).toBeInTheDocument();
    expect(screen.getByText('Team reviewer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publish Team reviewer draft' }));
    expect(screen.getAllByText('published').length).toBeGreaterThan(0);
  });

  it('renders shared workspace agent governance controls in Settings', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByText('Shared agents')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Shared agents' }));
    expect(screen.getByLabelText('Enable shared-agent registry')).toBeChecked();
    expect(screen.getByLabelText('Require shared-agent publish approval')).toBeChecked();
    expect(screen.getByLabelText('Show shared-agent audit trail')).toBeChecked();
    expect(screen.getByLabelText('Track shared-agent usage analytics')).toBeChecked();
    expect(screen.getByText('Team reviewer')).toBeInTheDocument();
    expect(screen.getByText('Release coordinator')).toBeInTheDocument();
    expect(screen.getByText('3 usage events')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Publish Release coordinator draft' }));

    expect(screen.getAllByText('published').length).toBeGreaterThan(0);
    expect(screen.getByText('Published Release coordinator v0.1.0 for team discovery')).toBeInTheDocument();
  });

  it('installs browser workflow skills and suggests them while composing', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByText('Browser workflow skills')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Browser workflow skills' }));
    expect(screen.getByText('Repeatable browser workflows')).toBeInTheDocument();
    expect(screen.getByText('Visual review workflow')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Install' })[0]);
    });
    expect(screen.getByText('browser-screenshot, browser-dom-snapshot, browser-viewport')).toBeInTheDocument();
    expect(screen.getByText('npm.cmd run visual:agent-browser')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Projects'));
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Add session to Research'));
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Chat input'), {
        target: { value: 'please review this UI visually and capture screenshots' },
      });
    });

    expect(screen.getByRole('list', { name: 'Suggested workflow skills' })).toBeInTheDocument();
    expect(screen.getAllByText('Visual review workflow').length).toBeGreaterThan(0);
  });

  it('renders harness steering controls in Settings and captures scoped corrections', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByText('Harness steering')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Harness steering' }));
    expect(screen.getByLabelText('Enable harness steering')).toBeChecked();
    expect(screen.getByLabelText('Auto-capture steering corrections')).toBeChecked();
    expect(screen.getByLabelText('Enforce steering with hooks')).toBeChecked();
    expect(screen.getByText('.steering/STEERING.md')).toBeInTheDocument();
    expect(screen.getByText('.steering/tool.steering.md')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Harness steering correction scope'), { target: { value: 'project' } });
    fireEvent.change(screen.getByLabelText('Harness steering correction text'), {
      target: { value: 'Keep Linear progress comments current during implementation.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add correction' }));

    expect(screen.getByText(/Latest correction: project - Keep Linear progress comments current/)).toBeInTheDocument();
  });

  it('renders harness evolution controls in Settings and persists safe-mode policy', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByText('Harness evolution')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Harness evolution' }));
    expect(screen.getByLabelText('Enable harness evolution')).toBeChecked();
    expect(screen.getByLabelText('Fallback to safe mode on failure')).toBeChecked();
    expect(screen.getByLabelText('Require visual validation')).toBeChecked();
    expect(screen.getByLabelText('Harness evolution sandbox root')).toHaveValue('.harness-evolution/sandboxes');
    expect(screen.getByLabelText('Harness evolution patch command')).toHaveValue('npx patch-package');
    expect(screen.getByLabelText('Harness evolution protected patch scopes')).toHaveValue(
      'agent-browser/src/features/harness-ui\nagent-browser/src/services\nagent-browser/src/App.tsx\nagent-browser/src/App.css',
    );

    fireEvent.click(screen.getByLabelText('Enable harness evolution'));
    await act(async () => {
      vi.runAllTimers();
    });

    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.harnessEvolutionSettings) ?? '{}');
    expect(persisted.enabled).toBe(false);
    expect(persisted.safeModeOnFailure).toBe(true);
  });

  it('renders spec-driven development controls in Settings', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByText('Spec-driven development')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Spec-driven development' }));
    expect(screen.getByLabelText('Enable spec-driven development')).toBeChecked();
    expect(screen.getByLabelText('Default spec format')).toHaveValue('json-schema');
    expect(screen.getByLabelText('Resolve ambiguities before implementation')).toBeChecked();
    expect(screen.getByLabelText('Require tests or evals from spec')).toBeChecked();
    expect(screen.getAllByText('JSON Schema 2020-12').length).toBeGreaterThan(0);
    expect(screen.getByText('Write tests or evals that validate the spec before implementation.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Default spec format'), { target: { value: 'openapi' } });

    expect(screen.getByLabelText('Default spec format')).toHaveValue('openapi');
    expect(screen.getAllByText('OpenAPI 3.1').length).toBeGreaterThan(0);
  });

  it('renders persistent memory graph controls in Settings and searches sample memory', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByText('Persistent memory graphs')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Persistent memory graphs' }));
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Load sample memory' }));
      fireEvent.change(screen.getByLabelText('Memory graph question'), {
        target: { value: 'How does Kuzu-WASM support offline retrieval?' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Search Memory' }));
      await Promise.resolve();
    });

    expect(screen.getByText('WASM-compatible local graph')).toBeInTheDocument();
    expect(screen.getByText(/MEMORY SUMMARY/)).toBeInTheDocument();
    expect(screen.getAllByText(/Kuzu-WASM/).length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: 'Retrieved memory graph' })).toBeInTheDocument();
  });

  it('renders security review agent controls in Settings', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByText('Security review agents')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Security review agents' }));
    expect(screen.getByLabelText('Enable security review agents')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable inline PR security review')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable scheduled vulnerability scans')).toBeInTheDocument();
    expect(screen.getByLabelText('Security scan cadence')).toHaveValue('weekly');
    expect(screen.getByLabelText('Minimum reported severity')).toHaveValue('medium');
    expect(screen.getByText('Vulnerability Scanner')).toBeInTheDocument();
  });

  it('renders Media agent routing and install recommendations', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Add session to Research'));

    const providerSelect = screen.getByLabelText('Agent provider');
    fireEvent.change(providerSelect, { target: { value: 'media' } });
    expect(providerSelect).toHaveValue('media');

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByText('Media agent')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Media agent' }));
    expect(screen.getByText('Image generation')).toBeInTheDocument();
    expect(screen.getByText('Voice generation')).toBeInTheDocument();
    expect(screen.getByText('SFX generation')).toBeInTheDocument();
    expect(screen.getByText('Music generation')).toBeInTheDocument();
    expect(screen.getByText('Remotion video')).toBeInTheDocument();
    expect(screen.getAllByText(/recommended install/i)).toHaveLength(5);
  });

  it('renders scheduled automations in History and Settings', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('History'));

    expect(screen.getByRole('region', { name: 'Workspace git graph' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scheduled automations' })).not.toBeInTheDocument();
    expect(screen.getByText('Daily workspace audit')).toBeInTheDocument();
    expect(screen.getByText('Run a browser and workspace audit, then summarize stale evidence, failing checks, and review items.')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Settings'));
    fireEvent.click(screen.getByRole('button', { name: 'Scheduled automations' }));

    expect(screen.getByLabelText('Enable Daily workspace audit')).toBeInTheDocument();
    expect(screen.getByLabelText('Daily workspace audit cadence')).toHaveValue('daily');
    expect(screen.getByLabelText('Daily workspace audit retry count')).toHaveValue('1');
    expect(screen.getByLabelText('Daily workspace audit notification route')).toHaveValue('inbox');
    expect(screen.getByLabelText('Daily workspace audit review trigger')).toHaveValue('failures');
  });

  it('renders n8n capability research and Serverless Workflow serialization guidance', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByRole('button', { name: 'n8n capabilities' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'n8n capabilities' }));

    expect(screen.getByText('CNCF Serverless Workflow 1.0.3')).toBeInTheDocument();
    expect(screen.getByText('Workflow canvas')).toBeInTheDocument();
    expect(screen.getByText('Executions and debugging')).toBeInTheDocument();
    expect(screen.getByText('AI, RAG, and evaluations')).toBeInTheDocument();
    expect(screen.getByText('manualTrigger')).toBeInTheDocument();
    expect(screen.getByText('runLocalAction')).toBeInTheDocument();
    expect(screen.getByText('queueReview')).toBeInTheDocument();
  });

  it('renders graph knowledge retrieval, context packs, and tier metrics', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByRole('button', { name: 'Graph knowledge' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Graph knowledge' }));

    expect(screen.getAllByText('Offline-ready graph memory').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Load Sample Memory' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Context Pack' })).toBeInTheDocument();
    expect(screen.getByLabelText('Graph knowledge search query')).toHaveValue('offline graph memory PathRAG Kuzu-WASM');
    expect(screen.getByText('Tier 1 blocks')).toBeInTheDocument();
    expect(screen.getByText('Tier 2 nodes')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Context Pack' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Graph knowledge context pack')).toHaveTextContent('HOT MEMORY');
    expect(screen.getByLabelText('Graph knowledge context pack')).toHaveTextContent('PATHS');

    fireEvent.click(screen.getByRole('tab', { name: 'Paths' }));
    expect(screen.getAllByText(/Matched query seed Kuzu-WASM/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByRole('table', { name: 'Graph knowledge score breakdowns' })).toBeInTheDocument();
  });

  it('renders suspend and resume checkpoints in History and Settings', async () => {
    vi.useFakeTimers();

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('History'));

    expect(screen.getByRole('region', { name: 'Workspace git graph' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend/resume checkpoints' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Approval before deployment').length).toBeGreaterThan(0);
    expect(screen.getByText(/operator approval/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Settings'));
    fireEvent.click(screen.getByRole('button', { name: 'Suspend/resume checkpoints' }));

    expect(screen.getByLabelText('Default checkpoint timeout')).toHaveValue(240);
    expect(screen.getByLabelText('Require operator confirmation before resume')).toBeChecked();
    expect(screen.getByLabelText('Preserve checkpoint artifacts')).toBeChecked();
    expect(screen.getByText('resume:visual-eval-session:2026-05-07T02:30:00.000Z')).toBeInTheDocument();
  });

  it('renders typed browser-agent run SDK state in History and Settings', async () => {
    vi.useFakeTimers();

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('History'));

    expect(screen.getByRole('region', { name: 'Workspace git graph' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Typed run SDK' })).not.toBeInTheDocument();
    expect(screen.getByText('SDK launch smoke')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect branch history for SDK launch smoke' }));
    expect(screen.getByText('Structured event stream is live.')).toBeInTheDocument();
    expect(screen.getByText('Reconnect cursor 3 is ready for clients.')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByRole('button', { name: 'Browser-agent run SDK' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Browser-agent run SDK' }));
    expect(screen.getByText('Structured event stream')).toBeInTheDocument();
    expect(screen.getByText('Reconnect cursor')).toBeInTheDocument();
    expect(screen.getByText('Archive and delete lifecycle')).toBeInTheDocument();
  });

  it('renders chaptered session compression in History, Settings, and chat context chrome', async () => {
    vi.useFakeTimers();

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Add session to Research'));

    expect(screen.getByLabelText('Chaptered session compression')).toHaveTextContent('1 chapter');
    expect(screen.getByLabelText('Chaptered session compression')).toHaveTextContent('compressed context ready');

    fireEvent.click(screen.getByLabelText('History'));

    expect(screen.getByRole('region', { name: 'Workspace git graph' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chaptered sessions' })).not.toBeInTheDocument();
    expect(screen.getByText(/Squash merge: visual-eval-session/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect branch history for Squash merge: visual-eval-session' }));
    expect(screen.getByText('message:visual-eval-assistant')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Settings'));
    fireEvent.click(screen.getByRole('button', { name: 'Chaptered sessions' }));

    expect(screen.getByLabelText('Enable chaptered sessions')).toBeChecked();
    expect(screen.getByLabelText('Automatic context compression')).toBeChecked();
    expect(screen.getByLabelText('Chapter compression target tokens')).toHaveValue(1200);
    expect(screen.getByText('1 session · 1 chapter · 1 audit event')).toBeInTheDocument();
  });

  it('renders History as a workspace git graph with session squashes and inspectable branch commits', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(STORAGE_KEYS.activePanel, JSON.stringify('history'));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const historyPanel = screen.getByRole('region', { name: 'History' });
    expect(screen.getByRole('region', { name: 'Workspace git graph' })).toBeInTheDocument();
    expect(historyPanel).toHaveTextContent('main');
    expect(historyPanel).toHaveTextContent('Squash merge: visual-eval-session');
    expect(historyPanel).toHaveTextContent('Approval before deployment');
    expect(historyPanel).toHaveTextContent('SDK launch smoke');
    expect(historyPanel).toHaveTextContent('Daily workspace audit');
    expect(historyPanel).toHaveTextContent('Research Session');
    expect(historyPanel).toHaveTextContent('Inspect branch history (5 commits)');
    expect(historyPanel.querySelector('.workspace-history-mainline')).not.toHaveTextContent('message:visual-eval-assistant');
    expect(screen.queryByRole('button', { name: 'Suspend/resume checkpoints' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Branching conversations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Typed run SDK' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chaptered sessions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scheduled automations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recent activity (2)' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Inspect branch history for Squash merge: visual-eval-session' }));

    expect(historyPanel).toHaveTextContent('message:visual-eval-assistant');
    expect(historyPanel).toHaveTextContent('process:visual-tool');
    expect(historyPanel).toHaveTextContent('evidence:output/playwright/agent-browser-visual-smoke.png');
    expect(historyPanel).toHaveTextContent('tool-output:visual-tool');
  });

  it('opens timeline rows into read-only chat and CRDT-backed file detail views', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(STORAGE_KEYS.activePanel, JSON.stringify('history'));
    window.localStorage.setItem(STORAGE_KEYS.chatMessagesBySession, JSON.stringify({
      'visual-eval-session': [
        {
          id: 'visual-eval-system',
          role: 'system',
          status: 'complete',
          content: 'Agent Browser session ready.',
        },
        {
          id: 'visual-eval-assistant',
          role: 'assistant',
          status: 'complete',
          content: 'Visual validation completed with a screenshot artifact.',
        },
      ],
    }));
    const fileHistory = appendWorkspaceFileCrdtDiff(
      createWorkspaceFileCrdtHistory({
        workspaceId: 'ws-research',
        path: 'notes.md',
        content: 'draft',
        actorId: 'user',
        now: new Date('2026-05-09T18:00:00.000Z'),
      }),
      'draft\nready',
      {
        actorId: 'codex',
        now: new Date('2026-05-09T18:01:00.000Z'),
      },
    );
    window.localStorage.setItem(STORAGE_KEYS.workspaceFileCrdtHistoriesByWorkspace, JSON.stringify({
      'ws-research': {
        'notes.md': fileHistory,
      },
    }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByRole('region', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByLabelText('Scrollable workspace history')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open history detail for Squash merge: visual-eval-session' }));

    expect(screen.getByRole('region', { name: 'Selected history detail' })).toHaveTextContent('Read-only chat');
    expect(screen.getByLabelText('Read-only chat session')).toHaveTextContent('Visual validation completed with a screenshot artifact.');

    fireEvent.click(screen.getByRole('button', { name: 'Open history detail for File change: notes.md' }));

    expect(screen.getByRole('region', { name: 'Selected history detail' })).toHaveTextContent('Read-only file');
    expect(screen.getByLabelText('Read-only file version')).toHaveTextContent('draft ready');
    expect(screen.getByText(/Materialized from CRDT snapshot/i)).toBeInTheDocument();
  });

  it('records aggregated app actions in History and exposes timeline cursor controls', async () => {
    vi.useFakeTimers();

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Models'));
    await act(async () => {
      vi.advanceTimersByTime(25);
    });
    fireEvent.click(screen.getByLabelText('History'));
    await act(async () => {
      vi.advanceTimersByTime(25);
    });

    const historyPanel = screen.getByRole('region', { name: 'History' });
    expect(historyPanel).toHaveTextContent('App actions: Opened Models');
    fireEvent.click(screen.getByRole('button', { name: 'Inspect branch history for App actions: Opened Models' }));
    expect(historyPanel).toHaveTextContent('Opened Models');
    expect(historyPanel).toHaveTextContent('Opened History');

    const moveBack = screen.getByRole('button', { name: 'Move back on workspace history timeline' });
    const moveForward = screen.getByRole('button', { name: 'Move forward on workspace history timeline' });
    expect(moveBack).not.toBeDisabled();
    expect(moveForward).toBeDisabled();

    fireEvent.click(moveBack);

    expect(moveForward).not.toBeDisabled();
    expect(screen.getByText(/Timeline cursor: 1\/2/i)).toBeInTheDocument();

    fireEvent.click(moveBack);

    expect(screen.getByText(/Timeline cursor: baseline/i)).toBeInTheDocument();
  });

  it('renders structured MCP elicitation fields and submits the full response payload', async () => {
    vi.useFakeTimers();
    const workspaceId = 'ws-research';
    const sessionId = 'elicitation-session';
    window.sessionStorage.setItem(STORAGE_KEYS.activeWorkspaceId, JSON.stringify(workspaceId));
    window.localStorage.setItem(STORAGE_KEYS.workspaceRoot, JSON.stringify({
      id: 'root',
      name: 'Root',
      type: 'root',
      expanded: true,
      children: [{
        id: workspaceId,
        name: 'Research',
        type: 'workspace',
        expanded: true,
        activeMemory: true,
        color: '#60a5fa',
        children: [
          { id: `${workspaceId}:category:browser`, name: 'Browser', type: 'folder', nodeKind: 'browser', expanded: true, children: [] },
          {
            id: `${workspaceId}:category:session`,
            name: 'Sessions',
            type: 'folder',
            nodeKind: 'session',
            expanded: true,
            children: [{
              id: sessionId,
              name: 'Elicitation session',
              type: 'tab',
              nodeKind: 'session',
              persisted: true,
              filePath: `${workspaceId}:session:elicitation`,
            }],
          },
          { id: `${workspaceId}:category:files`, name: 'Files', type: 'folder', nodeKind: 'files', expanded: false, children: [] },
          { id: `${workspaceId}:clipboard`, name: 'Clipboard', type: 'tab', nodeKind: 'clipboard' },
        ],
      }],
    }));
    window.localStorage.setItem(STORAGE_KEYS.workspaceViewStateByWorkspace, JSON.stringify({
      [workspaceId]: {
        openTabIds: [],
        editingFilePath: null,
        dashboardOpen: true,
        activeMode: 'agent',
        activeSessionIds: [sessionId],
        mountedSessionFsIds: [sessionId],
        panelOrder: [`session:${sessionId}`],
        activeArtifactPanel: null,
      },
    }));
    window.localStorage.setItem(STORAGE_KEYS.chatMessagesBySession, JSON.stringify({
      [sessionId]: [
        {
          id: `${sessionId}:system`,
          role: 'system',
          status: 'complete',
          content: 'Agent Browser session ready.',
        },
        {
          id: 'assistant-elicitation',
          role: 'assistant',
          status: 'complete',
          content: '',
          cards: [{
            app: 'Elicitation',
            kind: 'elicitation',
            requestId: 'elicitation-structured',
            prompt: 'Choose how the agent should continue.',
            status: 'pending',
            args: {},
            fields: [
              { id: 'notes', label: 'Notes', type: 'textarea', defaultValue: 'Prefer official docs' },
              {
                id: 'urgency',
                label: 'Urgency',
                type: 'select',
                required: true,
                defaultValue: 'soon',
                options: [
                  { label: 'Soon', value: 'soon' },
                  { label: 'Later', value: 'later' },
                ],
              },
              { id: 'notify', label: 'Notify me', type: 'checkbox', defaultValue: 'true' },
              { id: 'count', label: 'Result count', type: 'number', defaultValue: '3' },
            ],
          }],
        },
      ],
    }));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByText('Choose how the agent should continue.')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toHaveValue('Prefer official docs');
    expect(screen.getByRole('combobox', { name: 'Urgency' })).toHaveValue('soon');
    expect(screen.getByRole('checkbox', { name: 'Notify me' })).toBeChecked();
    expect(screen.getByRole('spinbutton', { name: 'Result count' })).toHaveValue(3);

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Prefer official docs and examples' } });
      fireEvent.change(screen.getByRole('combobox', { name: 'Urgency' }), { target: { value: 'later' } });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Notify me' }));
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Result count' }), { target: { value: '5' } });
      fireEvent.click(screen.getByRole('button', { name: 'Submit requested info' }));
      await Promise.resolve();
    });

    expect(screen.getByText('User input received')).toBeInTheDocument();
    expect(screen.getAllByText(/"notes": "Prefer official docs and examples"/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/"urgency": "later"/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/"notify": "false"/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/"count": "5"/).length).toBeGreaterThan(0);
  });

  it('shows installed local models in the sidebar and local catalog section', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(
      STORAGE_KEYS.installedModels,
      JSON.stringify([{
        id: 'onnx-community/Qwen3-0.6B-ONNX',
        name: 'Qwen3-0.6B-ONNX',
        author: 'onnx-community',
        task: 'text-generation',
        downloads: 5000,
        likes: 30,
        tags: ['onnx'],
        sizeMB: 768,
        contextWindow: 4096,
        maxOutputTokens: 512,
        status: 'installed',
      }]),
    );

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Models'));

    const installedSidebar = screen.getByRole('region', { name: 'Installed models' });
    expect(within(installedSidebar).getByLabelText('Qwen3-0.6B-ONNX installed from Hugging Face')).toBeInTheDocument();
    expect(installedSidebar).not.toHaveTextContent('Built-in local inference');

    const catalog = screen.getByRole('region', { name: 'Model catalog' });
    expect(within(catalog).getByRole('heading', { name: 'Local Browser Models (5)' })).toBeInTheDocument();
    expect(within(catalog).getAllByText('Installed').length).toBeGreaterThan(0);
    expect(catalog).toHaveTextContent('Installed from Hugging Face for in-browser inference.');
  });
});
