// Regression tests for state that should survive a page refresh (vitest with jsdom).
//
// These tests assert that when the relevant storage backend already contains
// data, mounting <App /> hydrates the corresponding UI state instead of
// resetting to defaults. They guard against regressions where moving from
// `useStoredState` back to plain `useState` would silently break refresh-
// persistence for installed local LLMs and other session-bound state.

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { STORAGE_KEYS } from './services/sessionState';

// Match the heavy mock surface of App.test.tsx so the shell mounts cleanly.
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

const seedInstalledModel = () => {
  window.localStorage.setItem(
    STORAGE_KEYS.installedModels,
    JSON.stringify([
      {
        id: 'onnx-community/Qwen3-0.6B-ONNX',
        name: 'Qwen3-0.6B-ONNX',
        author: 'onnx-community',
        task: 'text-generation',
        downloads: 5000,
        likes: 30,
        tags: ['onnx'],
        sizeMB: 0,
        status: 'installed',
      },
    ]),
  );
};

const seedPersistedChatSession = () => {
  window.localStorage.setItem(STORAGE_KEYS.workspaceRoot, JSON.stringify({
    id: 'root',
    name: 'Root',
    type: 'root',
    expanded: true,
    children: [{
      id: 'ws-research',
      name: 'Research',
      type: 'workspace',
      expanded: true,
      activeMemory: true,
      color: '#60a5fa',
      children: [{
        id: 'ws-research:category:session',
        name: 'Sessions',
        type: 'folder',
        nodeKind: 'session',
        expanded: true,
        children: [{
          id: 'session-persisted',
          name: 'Restored Session',
          type: 'tab',
          nodeKind: 'session',
          persisted: true,
          filePath: 'ws-research:session:restored',
        }],
      }],
    }],
  }));
  window.localStorage.setItem(STORAGE_KEYS.workspaceViewStateByWorkspace, JSON.stringify({
    'ws-research': {
      openTabIds: [],
      editingFilePath: null,
      activeMode: 'agent',
      activeSessionIds: ['session-persisted'],
      mountedSessionFsIds: ['session-persisted'],
      panelOrder: ['session:session-persisted'],
    },
  }));
  window.localStorage.setItem(STORAGE_KEYS.chatMessagesBySession, JSON.stringify({
    'session-persisted': [
      { id: 'session-persisted:system', role: 'system', content: 'Ready from storage.' },
      { id: 'message-persisted', role: 'user', content: 'Persisted hello from storage.' },
    ],
  }));
};

describe('App session-bound persistence', () => {
  it('hydrates installed local LLMs from localStorage on mount', async () => {
    vi.useFakeTimers();
    seedInstalledModel();

    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Settings'));

    expect(screen.getAllByText('Installed').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Qwen3-0\.6B-ONNX/i).length).toBeGreaterThan(0);
  });

  it('persists newly installed local LLMs to localStorage', async () => {
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
    await act(async () => { vi.advanceTimersByTime(350); });

    fireEvent.click(screen.getByLabelText('Settings'));
    fireEvent.click(screen.getByRole('button', { name: /Registry/i }));
    fireEvent.click(screen.getByRole('button', { name: /Test Model/i }));

    // Drain microtasks for the install promise chain.
    await act(async () => {
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }
    });
    // Wait for the persistence debounce to fire (and any subsequent re-renders).
    await act(async () => {
      vi.advanceTimersByTime(500);
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }
    });

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.installedModels) ?? '[]') as Array<{ id: string }>;
    expect(stored.map((m) => m.id)).toContain('hf-test-model');
  });

  it('hydrates the active sidebar panel from sessionStorage on mount', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(STORAGE_KEYS.activePanel, JSON.stringify('settings'));

    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    // Settings button has class 'active' when its panel is active.
    const settingsButton = screen.getByTitle('Settings (Alt+5)');
    expect(settingsButton.className).toContain('active');
  });

  it('hydrates the active workspace id from sessionStorage on mount', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(STORAGE_KEYS.activeWorkspaceId, JSON.stringify('ws-build'));

    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    // The workspace pill / chat-panel header should reflect the Build workspace.
    expect(screen.getAllByText(/Build/i).length).toBeGreaterThan(0);
  });

  it('persists the active sidebar panel to sessionStorage when switched', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    fireEvent.click(screen.getByLabelText('Extensions'));
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(JSON.parse(window.sessionStorage.getItem(STORAGE_KEYS.activePanel) ?? '""'))
      .toBe('extensions');
  });

  it('hydrates per-session selected provider from sessionStorage', async () => {
    vi.useFakeTimers();
    fetchCopilotStateMock.mockResolvedValue({
      available: true,
      authenticated: true,
      models: [{ id: 'gpt-4o', name: 'GPT-4o' }],
      signInCommand: 'copilot login',
      signInDocsUrl: 'https://docs.github.com/copilot',
    });
    // Pre-seed for the fallback session id used when there is no active session.
    window.sessionStorage.setItem(
      STORAGE_KEYS.selectedProviderBySession,
      JSON.stringify({ 'session:fallback': 'ghcp' }),
    );

    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    expect((screen.getByRole('combobox', { name: 'Agent provider' }) as HTMLSelectElement).value).toBe('ghcp');
  });

  it('hydrates persisted chat sessions and transcripts from localStorage on mount', async () => {
    vi.useFakeTimers();
    seedPersistedChatSession();

    render(<App />);
    await act(async () => { vi.advanceTimersByTime(350); });

    expect(screen.getAllByText(/Restored Session/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Persisted hello from storage/i)).toBeTruthy();
  });
});
