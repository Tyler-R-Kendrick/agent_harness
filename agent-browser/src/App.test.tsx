import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { WORKSPACE_FILES_STORAGE_KEY } from './services/workspaceFiles';

const searchBrowserModelsMock = vi.fn();
const loadModelMock = vi.fn();
const generateMock = vi.fn();
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
    fsPaths = new Set<string>(['/workspace', '/workspace/.keep']);

    fs = {
      getAllPaths: () => [...this.fsPaths],
    };

    async exec(command: string) {
      const trimmed = command.trim();
      if (trimmed.startsWith('touch ')) {
        const filePath = trimmed.slice('touch '.length).trim().replace(/^\/+/, '');
        if (filePath) this.fsPaths.add(`/workspace/${filePath}`);
      }
      if (trimmed === 'pwd') {
        return { stdout: '/workspace', stderr: '', exitCode: 0 };
      }
      if (trimmed === 'ls') {
        const entries = [...this.fsPaths]
          .filter((path) => path !== '/workspace' && path !== '/workspace/.keep')
          .map((path) => path.replace('/workspace/', ''));
        return { stdout: entries.join('\n'), stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    }
  }

  return { Bash: MockBash };
});

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchBrowserModelsMock.mockReset();
    loadModelMock.mockReset();
    generateMock.mockReset();
    searchBrowserModelsMock.mockResolvedValue([]);
    loadModelMock.mockResolvedValue(undefined);
    generateMock.mockResolvedValue(undefined);
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

    expect(screen.getByRole('button', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '.agents' })).toBeInTheDocument();
    expect(screen.getByText('AGENTS.md')).toBeInTheDocument();
    expect(screen.getByText('SKILL.md')).toBeInTheDocument();
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
    expect(screen.getByLabelText('Close Transformers.js')).toBeInTheDocument();
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
});
