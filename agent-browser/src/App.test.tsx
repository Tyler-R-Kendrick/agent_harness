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

  it('renders workspace-local support in exploration and persists it to local storage', async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByText('Workspace storage')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AGENTS.md' })).toBeInTheDocument();
    expect(screen.getByText('agent-skills')).toBeInTheDocument();
    expect(screen.getByText('Plugins')).toBeInTheDocument();
    expect(screen.getByText('Hooks')).toBeInTheDocument();
    expect(screen.getByText('Remote MCPs')).toBeInTheDocument();
    expect(screen.getByText('marketplace.json', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Local MCP transports are blocked by policy.')).toBeInTheDocument();

    const hooksToggle = screen.getByLabelText('Enable Hooks') as HTMLInputElement;
    expect(hooksToggle.checked).toBe(false);

    fireEvent.click(hooksToggle);

    expect(hooksToggle.checked).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    const storedIntegrations = JSON.parse(window.localStorage.getItem('agent-browser.workspace-integrations') ?? '{}') as Record<string, Array<{ id: string; enabled: boolean }>>;
    expect(storedIntegrations['ws-research']).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'hooks', enabled: true })]));
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
