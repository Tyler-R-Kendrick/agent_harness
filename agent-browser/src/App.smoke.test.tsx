import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { STORAGE_KEYS } from './services/sessionState';
import {
  appendWorkspaceFileCrdtDiff,
  createWorkspaceFileCrdtHistory,
} from './services/workspaceFileCrdtHistory';

const searchBrowserModelsMock = vi.fn();
const loadModelMock = vi.fn();
const generateMock = vi.fn();
const fetchCopilotStateMock = vi.fn();
const streamCopilotChatMock = vi.fn();
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
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Add session to Research'));
    fireEvent.click(screen.getByRole('button', { name: 'Share chat session' }));

    expect(screen.getByRole('dialog', { name: 'Share chat session' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start shared session/ })).toBeInTheDocument();
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

  it('hydrates the Review sidebar panel from durable session storage', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(STORAGE_KEYS.activePanel, JSON.stringify('review'));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByRole('region', { name: 'PR review understanding' })).toBeInTheDocument();
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

  it('renders multitask subagent branch comparison and promotion controls', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(STORAGE_KEYS.activePanel, JSON.stringify('multitask'));

    render(<App />);

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    const panel = screen.getByRole('region', { name: 'Multitask subagents' });
    expect(panel).toBeInTheDocument();
    expect(screen.getByText('Branch isolation')).toBeInTheDocument();
    expect(screen.getByText('agent/research/frontend-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Promote agent/research/tests-2' })).toBeInTheDocument();
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

    fireEvent.click(screen.getAllByRole('button', { name: /^Open Session/ })[0]);
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
      fireEvent.click(screen.getByRole('button', { name: 'Install OpenDesign DESIGN.md Studio' }));
      await Promise.resolve();
    });

    const installedSidebar = screen.getByRole('region', { name: 'Installed extensions' });
    expect(installedSidebar).toHaveTextContent('DESIGN.md agent guidance');
    expect(installedSidebar).toHaveTextContent('OpenDesign DESIGN.md Studio');
    expect(installedSidebar).toHaveTextContent('Required by OpenDesign DESIGN.md Studio');
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
    fireEvent.click(within(marketplace).getByRole('button', { name: 'Open details for OpenDesign DESIGN.md Studio' }));

    const detail = screen.getByRole('region', { name: 'Extension detail' });
    expect(within(detail).getByRole('heading', { name: 'OpenDesign DESIGN.md Studio' })).toBeInTheDocument();
    expect(within(detail).getByRole('tab', { name: 'Details' })).toBeInTheDocument();
    expect(within(detail).getByRole('tab', { name: 'Features' })).toBeInTheDocument();
    expect(within(detail).getByRole('heading', { name: 'README.md' })).toBeInTheDocument();
    expect(within(detail).getByText('Identifier')).toBeInTheDocument();
    expect(within(detail).getByText('agent-harness.ext.open-design')).toBeInTheDocument();
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
      fireEvent.click(within(marketplace).getByRole('button', { name: 'Install OpenDesign DESIGN.md Studio' }));
      fireEvent.click(within(marketplace).getByRole('button', { name: 'Install Symphony workflow orchestration' }));
      fireEvent.click(within(marketplace).getByRole('button', { name: 'Install Workflow canvas orchestration' }));
      fireEvent.click(within(marketplace).getByRole('button', { name: 'Install Artifact worktree explorer' }));
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'OpenDesign DESIGN.md Studio extension' }));
    });
    const studio = screen.getByRole('region', { name: 'OpenDesign DESIGN.md Studio feature pane' });
    expect(within(studio).getByRole('heading', { name: 'OpenDesign Studio' })).toBeInTheDocument();
    expect(within(studio).getByLabelText('OpenDesign design prompt')).toHaveValue(
      'Build a sleek AI-native DESIGN.md studio for composing product design systems.',
    );
    await act(async () => {
      fireEvent.click(within(studio).getByRole('tab', { name: 'Show token review' }));
    });
    const review = screen.getByRole('region', { name: 'OpenDesign token review' });
    expect(within(review).getByLabelText('OpenDesign approval summary')).toHaveTextContent('0/6 approved');
    expect(within(review).getByLabelText('OpenDesign approval composition sample')).toHaveTextContent('Agent Browser approval composition');
    expect(within(review).getByLabelText('Display type visual sample')).toHaveTextContent('Aa');
    expect(within(review).getByLabelText('Action components visual sample')).toHaveTextContent('Run');
    for (const approveButton of within(review).getAllByRole('button', { name: /^Approve / })) {
      await act(async () => {
        fireEvent.click(approveButton);
      });
    }
    expect(within(review).getByLabelText('OpenDesign approval summary')).toHaveTextContent('6/6 approved');
    await act(async () => {
      fireEvent.click(within(review).getByLabelText('Publish approved OpenDesign system'));
      fireEvent.click(within(review).getByLabelText('Use OpenDesign system as workspace default'));
    });
    expect(within(review).getByLabelText('Publish approved OpenDesign system')).toBeChecked();
    expect(within(review).getByLabelText('Use OpenDesign system as workspace default')).toBeChecked();
    await act(async () => {
      fireEvent.click(within(studio).getByRole('button', { name: 'Compile DESIGN.md' }));
    });
    expect(screen.getByRole('region', { name: 'OpenDesign generated files' })).toHaveTextContent('DESIGN.md');
    expect(screen.getByRole('region', { name: 'OpenDesign generated files' })).toHaveTextContent('design/open-design/research.json');
    expect(screen.getByRole('region', { name: 'OpenDesign generated files' })).toHaveTextContent('design/open-design/token-review.json');
    expect(screen.getByLabelText('DESIGN.md preview')).toHaveTextContent('## Source Inventory');
    expect(screen.getByLabelText('DESIGN.md preview')).toHaveTextContent('## Token Review And Approval');
    expect(screen.getByLabelText('DESIGN.md preview')).toHaveTextContent('status: published');
    await act(async () => {
      fireEvent.click(within(studio).getByRole('button', { name: 'Run design critique' }));
    });
    expect(screen.getByRole('region', { name: 'OpenDesign critique' })).toHaveTextContent('Gate pass');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Symphony workflow orchestration extension' }));
    });
    expect(screen.getByRole('region', { name: 'Symphony workflow orchestration feature pane' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Workflow canvas orchestration extension' }));
    });
    expect(screen.getByRole('region', { name: 'Workflow canvas orchestration feature pane' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Artifact worktree explorer extension' }));
    });
    expect(screen.getByRole('region', { name: 'Artifact worktree explorer feature pane' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Models'));
    });
    expect(screen.getByRole('heading', { name: 'Models' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Artifact worktree explorer feature pane' })).not.toBeInTheDocument();
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

  it('shows built-in local inference readiness in Models', async () => {
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

    expect(screen.getByRole('button', { name: 'Built-in local inference' })).toBeInTheDocument();
    expect(screen.getAllByText('Offline ready').length).toBeGreaterThan(0);
    expect(screen.getByText('Active local model: Qwen3-0.6B-ONNX')).toBeInTheDocument();
    expect(screen.getByText(/No localhost sidecar/)).toBeInTheDocument();
  });
});
