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

    fireEvent.click(screen.getByLabelText('Settings'));

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

  it('shows built-in local inference readiness in Settings', async () => {
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

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getByRole('button', { name: 'Built-in local inference' })).toBeInTheDocument();
    expect(screen.getAllByText('Offline ready').length).toBeGreaterThan(0);
    expect(screen.getByText('Active local model: Qwen3-0.6B-ONNX')).toBeInTheDocument();
    expect(screen.getByText(/No localhost sidecar/)).toBeInTheDocument();
  });
});
