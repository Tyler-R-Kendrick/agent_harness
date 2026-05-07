import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { GitWorktreeDiffResponse, GitWorktreeStatusResponse } from '../../services/gitWorktreeApi';
import { GitWorktreePanel } from './GitWorktreePanel';

const treeMock = vi.hoisted(() => ({ useFileTree: vi.fn() }));

vi.mock('@pierre/trees/react', () => ({
  useFileTree: (options: { paths: string[]; gitStatus: Array<{ path: string; status: string }>; initialSelectedPaths?: string[]; onSelectionChange?: (paths: string[]) => void }) => {
    treeMock.useFileTree(options);
    return { model: options };
  },
  FileTree: ({ model, header }: { model: { paths: string[]; initialSelectedPaths?: string[]; onSelectionChange?: (paths: string[]) => void }; header?: ReactNode }) => (
    <div role="tree" aria-label="Changed files">
      {header}
      {model.paths.map((path) => (
        <button
          key={path}
          type="button"
          role="treeitem"
          aria-selected={model.initialSelectedPaths?.includes(path) ? 'true' : 'false'}
          onClick={() => model.onSelectionChange?.([path])}
        >
          {path}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@pierre/diffs/react', () => ({
  Virtualizer: ({ children }: { children: ReactNode }) => <div data-testid="diff-virtualizer">{children}</div>,
  PatchDiff: ({ patch }: { patch: string }) => <pre data-testid="patch-diff">{patch}</pre>,
}));

type AvailableGitWorktreeStatus = Extract<GitWorktreeStatusResponse, { available: true }>;

function createStatus(overrides: Partial<AvailableGitWorktreeStatus> = {}): AvailableGitWorktreeStatus {
  return {
    available: true,
    cwd: 'C:/repo',
    worktreeRoot: 'C:/repo',
    branch: 'main',
    head: 'abc1234',
    upstream: 'origin/main',
    ahead: 0,
    behind: 0,
    isClean: false,
    summary: { changed: 2, staged: 1, unstaged: 1, untracked: 0, conflicts: 0 },
    files: [
      { path: 'src/App.tsx', status: 'modified', staged: false, unstaged: true, conflicted: false },
      { path: 'README.md', status: 'added', staged: true, unstaged: false, conflicted: false },
    ],
    ...overrides,
  };
}

function createDiff(overrides: Partial<GitWorktreeDiffResponse> = {}): GitWorktreeDiffResponse {
  return {
    path: 'src/App.tsx',
    patch: 'diff --git a/src/App.tsx b/src/App.tsx\n-old\n+new\n',
    source: 'unstaged',
    isBinary: false,
    ...overrides,
  };
}

describe('GitWorktreePanel', () => {
  it('renders changed worktree files with Trees and selected patches with Diffs', () => {
    const onSelectFile = vi.fn();

    render(
      <GitWorktreePanel
        status={createStatus()}
        diff={createDiff()}
        selectedPath="src/App.tsx"
        isLoading={false}
        isDiffLoading={false}
        onRefresh={vi.fn()}
        onSelectFile={onSelectFile}
      />,
    );

    const panel = screen.getByRole('region', { name: 'Git worktree status' });
    expect(within(panel).getByText('main')).toBeInTheDocument();
    expect(within(panel).getByText('2 changed')).toBeInTheDocument();
    expect(within(panel).getByText('C:/repo')).toBeInTheDocument();
    expect(treeMock.useFileTree).toHaveBeenCalledWith(expect.objectContaining({
      paths: ['src/App.tsx', 'README.md'],
      gitStatus: [
        { path: 'src/App.tsx', status: 'modified' },
        { path: 'README.md', status: 'added' },
      ],
      initialSelectedPaths: ['src/App.tsx'],
    }));
    expect(screen.getByTestId('patch-diff')).toHaveTextContent('+new');

    fireEvent.click(within(panel).getByRole('treeitem', { name: 'README.md' }));
    expect(onSelectFile).toHaveBeenCalledWith('README.md');
  });

  it('keeps clean and unavailable worktrees readable', () => {
    const { rerender } = render(
      <GitWorktreePanel
        status={createStatus({ isClean: true, files: [], summary: { changed: 0, staged: 0, unstaged: 0, untracked: 0, conflicts: 0 } })}
        diff={null}
        selectedPath={null}
        isLoading={false}
        isDiffLoading={false}
        onRefresh={vi.fn()}
        onSelectFile={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Working tree clean')).toHaveLength(2);

    rerender(
      <GitWorktreePanel
        status={{ available: false, error: 'not a git repository' }}
        diff={null}
        selectedPath={null}
        isLoading={false}
        isDiffLoading={false}
        onRefresh={vi.fn()}
        onSelectFile={vi.fn()}
      />,
    );

    expect(screen.getByText('not a git repository')).toBeInTheDocument();
  });
});
