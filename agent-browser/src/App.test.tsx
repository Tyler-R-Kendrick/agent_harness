import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

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
    vi.useRealTimers();
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
    expect(screen.getAllByText('Agent Chat').length).toBeGreaterThan(0);
    expect(screen.queryByText('Create task board')).not.toBeInTheDocument();
    expect(screen.queryByText('Open gallery')).not.toBeInTheDocument();
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

    expect(screen.getByText('Workspace files')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add AGENTS.md' }));
    fireEvent.change(screen.getByLabelText('Capability name'), { target: { value: 'review-pr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add skill' }));

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getAllByText('AGENTS.md').length).toBeGreaterThan(0);
    expect(screen.getByText('.agents/skill/review-pr/SKILL.md')).toBeInTheDocument();

    const storedFiles = JSON.parse(window.localStorage.getItem('agent-browser.workspace-files') ?? '{}') as Record<string, Array<{ path: string }>>;
    expect(storedFiles['ws-research']).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'AGENTS.md' }),
      expect.objectContaining({ path: '.agents/skill/review-pr/SKILL.md' }),
    ]));
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

    fireEvent.click(screen.getByRole('button', { name: 'Add AGENTS.md' }));
    fireEvent.change(screen.getByLabelText('Workspace file content'), { target: { value: '# Rules\nAlways run workspace checks first.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save file' }));

    fireEvent.click(screen.getByLabelText('Settings'));
    fireEvent.click(screen.getByRole('button', { name: /Test Model/i }));

    await act(async () => {
      await Promise.resolve();
    });

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
    expect(searchBrowserModelsMock).toHaveBeenLastCalledWith('qwen', 'text-generation', 12, expect.any(AbortSignal));
  });
});
