import { useMemo, type CSSProperties } from 'react';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { PatchDiff, Virtualizer } from '@pierre/diffs/react';
import { RefreshCcw } from 'lucide-react';
import type { BrowserEvidenceReviewReport, LinkedBrowserEvidenceArtifact } from '../../services/browserEvidenceReview';
import { formatAssertionSummary } from '../../services/browserEvidenceReview';
import type { GitWorktreeDiffResponse, GitWorktreeFileChange, GitWorktreeStatusResponse } from '../../services/gitWorktreeApi';

export interface GitWorktreePanelProps {
  status: GitWorktreeStatusResponse | null;
  diff: GitWorktreeDiffResponse | null;
  selectedPath: string | null;
  isLoading: boolean;
  isDiffLoading: boolean;
  browserEvidenceReview?: BrowserEvidenceReviewReport | null;
  onRefresh: () => void;
  onSelectFile: (path: string) => void;
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function statusLabel(file: GitWorktreeFileChange) {
  if (file.conflicted) return 'conflict';
  if (file.status === 'untracked') return 'untracked';
  if (file.staged && file.unstaged) return `${file.status}, staged and unstaged`;
  if (file.staged) return `${file.status}, staged`;
  return file.status;
}

function branchLabel(status: GitWorktreeStatusResponse | null) {
  if (!status?.available) return 'Git worktree';
  return status.branch ?? status.head ?? 'Detached worktree';
}

function evidenceSummaryLabel(report: BrowserEvidenceReviewReport | null | undefined) {
  if (!report || report.totalEvidence === 0) return 'No browser evidence';
  return plural(report.totalEvidence, 'evidence link');
}

const treeStyle = {
  height: '100%',
  colorScheme: 'dark',
  '--trees-bg-override': '#15171a',
  '--trees-bg-muted-override': 'rgba(255, 255, 255, 0.05)',
  '--trees-fg-override': '#d4d4d4',
  '--trees-fg-muted-override': '#9ca3af',
  '--trees-accent-override': '#38bdf8',
  '--trees-border-color-override': 'rgba(255, 255, 255, 0.08)',
  '--trees-selected-bg-override': 'rgba(14, 99, 156, 0.38)',
  '--trees-selected-fg-override': '#ffffff',
  '--trees-selected-focused-border-color-override': 'rgba(125, 211, 252, 0.7)',
  '--trees-font-family-override': "'Segoe UI Variable Text', 'Segoe UI', ui-sans-serif, system-ui, sans-serif",
  '--trees-font-size-override': '12px',
  '--trees-density-override': '0.84',
  '--trees-status-added-override': '#86efac',
  '--trees-status-modified-override': '#7dd3fc',
  '--trees-status-renamed-override': '#fde68a',
  '--trees-status-untracked-override': '#86efac',
  '--trees-status-deleted-override': '#fca5a5',
} as CSSProperties;

export function GitWorktreePanel({
  status,
  diff,
  selectedPath,
  isLoading,
  isDiffLoading,
  browserEvidenceReview,
  onRefresh,
  onSelectFile,
}: GitWorktreePanelProps) {
  const files = status?.available ? status.files : [];
  const paths = useMemo(() => files.map((file) => file.path), [files]);
  const selectedFile = selectedPath ? files.find((file) => file.path === selectedPath) : undefined;
  const gitStatus = useMemo(() => files.map((file) => ({
    path: file.path,
    status: file.status,
  })), [files]);
  const { model } = useFileTree({
    paths,
    gitStatus,
    flattenEmptyDirectories: true,
    initialExpansion: 'open',
    initialSelectedPaths: selectedPath ? [selectedPath] : [],
    search: paths.length > 8,
    onSelectionChange: (nextPaths) => {
      const nextPath = nextPaths[0];
      if (nextPath) onSelectFile(nextPath);
    },
  });

  return (
    <section className="git-worktree-panel" aria-label="Git worktree status">
      <header className="git-worktree-header">
        <div className="git-worktree-heading">
          <span className="panel-resource-eyebrow">git/status</span>
          <h2>{branchLabel(status)}</h2>
        </div>
        <div className="git-worktree-actions">
          {status?.available ? (
            <span className="git-worktree-counts">
              {status.isClean ? 'Working tree clean' : plural(status.summary.changed, 'changed', 'changed')}
            </span>
          ) : null}
          {status?.available ? (
            <span className={`git-worktree-evidence-count git-worktree-evidence-count--${browserEvidenceReview?.status ?? 'pending'}`}>
              {evidenceSummaryLabel(browserEvidenceReview)}
            </span>
          ) : null}
          <button type="button" className="icon-button git-worktree-refresh" onClick={onRefresh} aria-label="Refresh git status" disabled={isLoading}>
            <RefreshCcw size={13} aria-hidden="true" />
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="git-worktree-message" role="status">Loading git status...</div>
      ) : !status ? (
        <div className="git-worktree-message">Git status has not loaded yet.</div>
      ) : !status.available ? (
        <div className="git-worktree-message git-worktree-message--warning">{status.error}</div>
      ) : status.isClean ? (
        <div className="git-worktree-message">
          <span>Working tree clean</span>
          <code>{status.worktreeRoot}</code>
        </div>
      ) : (
        <div className="git-worktree-body">
          <div className="git-worktree-tree-shell">
            <FileTree
              className="git-worktree-tree"
              model={model}
              style={treeStyle}
              header={(
                <div className="git-worktree-tree-header">
                  <span>{plural(status.summary.staged, 'staged', 'staged')}</span>
                  <span>{plural(status.summary.unstaged, 'unstaged', 'unstaged')}</span>
                  {status.summary.conflicts ? <span>{plural(status.summary.conflicts, 'conflict')}</span> : null}
                </div>
              )}
            />
          </div>
          <div className="git-worktree-diff-shell" aria-label="Selected file diff">
            <div className="git-worktree-diff-header">
              <div>
                <span className="panel-resource-eyebrow">diff/{diff?.source ?? 'none'}</span>
                <h3>{selectedPath ?? 'Select a changed file'}</h3>
              </div>
              {selectedFile ? <span className="git-worktree-file-status">{statusLabel(selectedFile)}</span> : null}
            </div>
            {browserEvidenceReview?.selectedFile ? (
              <SelectedDiffEvidence evidence={browserEvidenceReview.selectedEvidence} />
            ) : null}
            {isDiffLoading ? (
              <div className="git-worktree-message" role="status">Loading diff...</div>
            ) : diff?.isBinary ? (
              <div className="git-worktree-message">Binary diff cannot be previewed.</div>
            ) : diff?.patch ? (
              <Virtualizer className="git-worktree-diff-virtualizer" contentClassName="git-worktree-diff-content">
                <PatchDiff patch={diff.patch} disableWorkerPool />
              </Virtualizer>
            ) : (
              <div className="git-worktree-message">No previewable diff for this file.</div>
            )}
          </div>
          <div className="git-worktree-root">
            <code>{status.worktreeRoot}</code>
            {status.upstream ? <span>{status.upstream}{status.ahead || status.behind ? ` +${status.ahead} -${status.behind}` : ''}</span> : null}
          </div>
        </div>
      )}
    </section>
  );
}

function SelectedDiffEvidence({ evidence }: { evidence: LinkedBrowserEvidenceArtifact[] }) {
  return (
    <section className="git-worktree-evidence" aria-label="Browser evidence for selected diff">
      <div className="git-worktree-evidence-heading">
        <span className="panel-resource-eyebrow">browser/evidence</span>
        <strong>{evidence.length ? plural(evidence.length, 'linked artifact') : 'No linked artifacts'}</strong>
      </div>
      {evidence.length ? (
        <div className="git-worktree-evidence-list">
          {evidence.map((artifact) => (
            <article className="git-worktree-evidence-item" key={artifact.id}>
              <span className={`git-worktree-evidence-status git-worktree-evidence-status--${artifact.status}`}>{artifact.kind}</span>
              <div>
                <strong>{artifact.label}</strong>
                <span>{formatAssertionSummary(artifact.assertionSummary)}</span>
                {(artifact.consoleErrors ?? 0) > 0 || (artifact.networkFailures ?? 0) > 0 ? (
                  <span>{artifact.consoleErrors ?? 0} console errors / {artifact.networkFailures ?? 0} network failures</span>
                ) : (
                  <span>Console and network clean</span>
                )}
                <code>{artifact.path}</code>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p>Run visual smoke to attach screenshots, console state, network state, and assertions to this diff.</p>
      )}
    </section>
  );
}
