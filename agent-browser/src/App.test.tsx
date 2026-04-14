import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { WORKSPACE_FILES_STORAGE_KEY } from './services/workspaceFiles';

const searchBrowserModelsMock = vi.fn();
const loadModelMock = vi.fn();
const generateMock = vi.fn();

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
    expect(screen.getByRole('heading', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.queryByText('Create task board')).not.toBeInTheDocument();
    expect(screen.queryByText('Open gallery')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Browser' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Terminal' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Agent' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Files' }).length).toBeGreaterThan(0);
  });

  it('supports creating new chat and terminal instances from the tree and panel', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByLabelText('Add chat to Research'));
    expect(screen.getByText('Chat 2')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Add terminal to Research'));
    expect(screen.getByText('Terminal 2')).toBeInTheDocument();
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

    // Close the file editor to return to chat
    fireEvent.click(screen.getByLabelText('Close file editor'));

    // Navigate to settings and install the model
    fireEvent.click(screen.getByLabelText('Settings'));
    fireEvent.click(screen.getByRole('button', { name: /Test Model/i }));

    await act(async () => {
      await Promise.resolve();
    });

    // Send a message
    fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Summarize the workspace rules.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(generateMock).toHaveBeenCalledTimes(1);
    const prompt = generateMock.mock.calls[0][0].prompt as Array<{ role: string; content: string }>;
    expect(prompt).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'system', content: expect.stringContaining('Active workspace: Research') }),
      expect.objectContaining({ role: 'system', content: expect.stringContaining('Always run workspace checks first.') }),
    ]));
  });

  it('adds accessible labels to page overlay icon buttons', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByText('Hugging Face'));

    expect(screen.getByLabelText('Back')).toBeInTheDocument();
    expect(screen.getByLabelText('Forward')).toBeInTheDocument();
    expect(screen.getByLabelText('Refresh')).toBeInTheDocument();
    expect(screen.getByLabelText('Toggle inspector')).toBeInTheDocument();
    expect(screen.getByLabelText('Toggle page chat')).toBeInTheDocument();
    expect(screen.getByLabelText('Close page overlay')).toBeInTheDocument();
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
    expect(screen.getByLabelText('Toggle workspace overlay')).toHaveTextContent('Build');
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

    expect(screen.getByLabelText('Toggle workspace overlay')).toHaveTextContent('Build');
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

    fireEvent.click(screen.getByText('Hugging Face'));
    expect(screen.getByRole('region', { name: 'Page overlay' })).toBeInTheDocument();
    expect(screen.getByLabelText('Address')).toHaveValue('https://huggingface.co/models?library=transformers.js');

    fireEvent.keyDown(window, { key: '2', ctrlKey: true });

    expect(screen.queryByRole('region', { name: 'Page overlay' })).not.toBeInTheDocument();
    expect(screen.getByText('CopilotKit docs')).toBeInTheDocument();

    fireEvent.click(screen.getByText('CopilotKit docs'));
    expect(screen.getByLabelText('Address')).toHaveValue('https://docs.copilotkit.ai');

    await act(async () => {
      fireEvent.keyDown(window, { key: '1', ctrlKey: true });
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByRole('region', { name: 'Page overlay' })).toBeInTheDocument();
    expect(screen.getByLabelText('Address')).toHaveValue('https://huggingface.co/models?library=transformers.js');
  });

  it('supports creating and renaming workspaces from the screenshot controls', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.keyDown(window, { key: 'N', ctrlKey: true, altKey: true });
    expect(screen.getByLabelText('Toggle workspace overlay')).toHaveTextContent('Workspace 3');

    fireEvent.doubleClick(screen.getByLabelText('Toggle workspace overlay'));
    expect(screen.getByRole('dialog', { name: 'Rename workspace' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Ops' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByLabelText('Toggle workspace overlay')).toHaveTextContent('Ops');
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
    expect(cursorLabel()).toContain('Research');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(cursorLabel()).toContain('Browser');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(cursorLabel()).toContain('Hugging Face');

    fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true, altKey: true });
    expect(screen.getByLabelText('Toggle workspace overlay')).toHaveTextContent('Build');

    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true, altKey: true });
    expect(screen.getByLabelText('Toggle workspace overlay')).toHaveTextContent('Research');
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
});
