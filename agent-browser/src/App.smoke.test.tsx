import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { STORAGE_KEYS } from './services/sessionState';

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
    expect(screen.getByRole('button', { name: 'New session widget' })).toBeInTheDocument();
    expect(screen.getByRole('tree', { name: 'Workspace tree' })).toBeInTheDocument();
  });

  it('renders browser evidence linked to the dashboard diff review', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Browser evidence for selected diff')).toBeInTheDocument();
    expect(screen.getByText('Agent Browser visual smoke')).toBeInTheDocument();
    expect(screen.getByText('2 assertions passed')).toBeInTheDocument();
    expect(screen.getByText('output/playwright/agent-browser-visual-smoke.png')).toBeInTheDocument();
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

  it('renders the repository wiki sidebar panel with repo map citations', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(STORAGE_KEYS.activePanel, JSON.stringify('wiki'));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const wikiPanel = screen.getByRole('region', { name: 'Repository wiki' });
    expect(wikiPanel).toBeInTheDocument();
    expect(screen.getAllByText('Repo map').length).toBeGreaterThan(0);
    expect(screen.getByText('Architecture views')).toBeInTheDocument();
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.getAllByText('wiki:ws-research:workspace-map').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Refresh wiki' })).toBeInTheDocument();
  });

  it('renders durable agent canvases and creates starter canvas artifacts', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(STORAGE_KEYS.activePanel, JSON.stringify('canvases'));

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const canvasesPanel = screen.getByRole('region', { name: 'Agent canvases' });
    expect(canvasesPanel).toBeInTheDocument();
    expect(screen.getByText('No durable canvases in this workspace yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create starter canvases' }));

    expect(canvasesPanel).toHaveTextContent('Research dashboard');
    expect(canvasesPanel).toHaveTextContent('Research checklist');
    expect(screen.getAllByText('rev 1').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Open Research dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attach Research dashboard to session' })).toBeInTheDocument();
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

    expect(screen.getByText('Requires DESIGN.md agent guidance')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Install OpenDesign DESIGN.md Studio' }));

    const installedSidebar = screen.getByRole('region', { name: 'Installed extensions' });
    expect(installedSidebar).toHaveTextContent('DESIGN.md agent guidance');
    expect(installedSidebar).toHaveTextContent('OpenDesign DESIGN.md Studio');
    expect(installedSidebar).toHaveTextContent('Required by OpenDesign DESIGN.md Studio');
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
      fireEvent.click(screen.getByLabelText('Workspaces'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'New session widget' }));
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /^Open Session/ })[0]);
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

    expect(screen.getByRole('button', { name: 'Scheduled automations' })).toBeInTheDocument();
    expect(screen.getByText('Daily workspace audit')).toBeInTheDocument();
    expect(screen.getByText(/review inbox/i)).toBeInTheDocument();

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

  it('renders suspend and resume checkpoints in History and Settings', async () => {
    vi.useFakeTimers();

    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('History'));

    expect(screen.getByRole('button', { name: 'Suspend/resume checkpoints' })).toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: 'Typed run SDK' })).toBeInTheDocument();
    expect(screen.getByText('SDK launch smoke')).toBeInTheDocument();
    expect(screen.getByText('Structured event stream is live.')).toBeInTheDocument();
    expect(screen.getByText('Reconnect cursor 3 is ready for clients.')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByRole('button', { name: 'Browser-agent run SDK' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Browser-agent run SDK' }));
    expect(screen.getByText('Structured event stream')).toBeInTheDocument();
    expect(screen.getByText('Reconnect cursor')).toBeInTheDocument();
    expect(screen.getByText('Archive and delete lifecycle')).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Prefer official docs and examples' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Urgency' }), { target: { value: 'later' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Notify me' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Result count' }), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit requested info' }));

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
