import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { STORAGE_KEYS } from './services/sessionState';

const searchBrowserModelsMock = vi.fn();
const loadModelMock = vi.fn();
const generateMock = vi.fn();
const fetchCopilotStateMock = vi.fn();
const streamCopilotChatMock = vi.fn();

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
  window.localStorage.clear();
  window.sessionStorage.clear();
  searchBrowserModelsMock.mockReset();
  loadModelMock.mockReset();
  generateMock.mockReset();
  fetchCopilotStateMock.mockReset();
  streamCopilotChatMock.mockReset();
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
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
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
