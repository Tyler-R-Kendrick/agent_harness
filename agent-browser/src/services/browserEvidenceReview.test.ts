import { describe, expect, it } from 'vitest';
import { buildBrowserEvidenceReview } from './browserEvidenceReview';
import type { GitWorktreeFileChange } from './gitWorktreeApi';

const changedFiles: GitWorktreeFileChange[] = [
  {
    path: 'agent-browser/src/App.tsx',
    status: 'modified',
    staged: false,
    unstaged: true,
    conflicted: false,
  },
  {
    path: 'agent-browser/src/App.css',
    status: 'modified',
    staged: false,
    unstaged: true,
    conflicted: false,
  },
];

describe('browserEvidenceReview', () => {
  it('links browser artifacts to changed files and summarizes the selected diff file', () => {
    const report = buildBrowserEvidenceReview({
      changedFiles,
      selectedPath: 'agent-browser/src/App.tsx',
      artifacts: [{
        id: 'visual-smoke',
        label: 'Agent Browser visual smoke',
        kind: 'screenshot',
        status: 'passed',
        path: 'output/playwright/agent-browser-visual-smoke.png',
        relatedFiles: ['agent-browser/src/App.tsx'],
        assertions: [
          { label: 'Diff panel visible', status: 'passed' },
          { label: 'Console is clean', status: 'passed' },
        ],
        consoleErrors: 0,
        networkFailures: 0,
      }],
    });

    expect(report.totalEvidence).toBe(1);
    expect(report.totalAssertions).toBe(2);
    expect(report.selectedFile?.path).toBe('agent-browser/src/App.tsx');
    expect(report.selectedFile?.evidenceCount).toBe(1);
    expect(report.selectedEvidence[0].label).toBe('Agent Browser visual smoke');
    expect(report.selectedEvidence[0].assertionSummary).toEqual({ passed: 2, failed: 0, pending: 0 });
  });

  it('uses path-prefix fallback when evidence has no explicit related file', () => {
    const report = buildBrowserEvidenceReview({
      changedFiles,
      selectedPath: 'agent-browser/src/App.css',
      artifacts: [{
        id: 'style-screenshot',
        label: 'Styles visual smoke',
        kind: 'screenshot',
        status: 'failed',
        path: 'output/playwright/agent-browser-src-App-css.png',
        sourceFile: 'agent-browser/src/App.css',
        assertions: [
          { label: 'No overlapping controls', status: 'failed' },
          { label: 'Touch target size', status: 'pending' },
        ],
        consoleErrors: 1,
        networkFailures: 2,
      }],
    });

    expect(report.status).toBe('failed');
    expect(report.failedAssertions).toBe(1);
    expect(report.pendingAssertions).toBe(1);
    expect(report.selectedFile?.status).toBe('failed');
    expect(report.selectedEvidence[0]).toMatchObject({
      id: 'style-screenshot',
      linkedFiles: ['agent-browser/src/App.css'],
      consoleErrors: 1,
      networkFailures: 2,
    });
  });

  it('keeps selected file review empty when no evidence matches', () => {
    const report = buildBrowserEvidenceReview({
      changedFiles,
      selectedPath: 'agent-browser/src/App.css',
      artifacts: [{
        id: 'app-only',
        label: 'App screenshot',
        kind: 'screenshot',
        status: 'passed',
        path: 'output/playwright/app.png',
        relatedFiles: ['agent-browser/src/App.tsx'],
        assertions: [{ label: 'Shell visible', status: 'passed' }],
      }],
    });

    expect(report.status).toBe('passed');
    expect(report.selectedFile?.evidenceCount).toBe(0);
    expect(report.selectedEvidence).toEqual([]);
  });
});
