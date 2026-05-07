import type { GitWorktreeFileChange } from './gitWorktreeApi';

export type BrowserEvidenceKind = 'screenshot' | 'trace' | 'console' | 'network' | 'assertion' | 'other';
export type BrowserEvidenceStatus = 'passed' | 'failed' | 'pending';

export interface BrowserEvidenceAssertion {
  label: string;
  status: BrowserEvidenceStatus;
}

export interface BrowserEvidenceArtifact {
  id: string;
  label: string;
  kind: BrowserEvidenceKind;
  status: BrowserEvidenceStatus;
  path: string;
  sourceFile?: string;
  relatedFiles?: string[];
  assertions?: BrowserEvidenceAssertion[];
  consoleErrors?: number;
  networkFailures?: number;
}

export interface BrowserEvidenceAssertionSummary {
  passed: number;
  failed: number;
  pending: number;
}

export interface LinkedBrowserEvidenceArtifact extends BrowserEvidenceArtifact {
  linkedFiles: string[];
  assertionSummary: BrowserEvidenceAssertionSummary;
}

export interface BrowserEvidenceFileSummary {
  path: string;
  status: BrowserEvidenceStatus;
  evidenceCount: number;
  passedAssertions: number;
  failedAssertions: number;
  pendingAssertions: number;
  consoleErrors: number;
  networkFailures: number;
}

export interface BrowserEvidenceReviewInput {
  changedFiles: GitWorktreeFileChange[];
  selectedPath: string | null;
  artifacts: BrowserEvidenceArtifact[];
}

export interface BrowserEvidenceReviewReport {
  status: BrowserEvidenceStatus;
  totalEvidence: number;
  totalAssertions: number;
  passedAssertions: number;
  failedAssertions: number;
  pendingAssertions: number;
  fileSummaries: BrowserEvidenceFileSummary[];
  selectedFile: BrowserEvidenceFileSummary | null;
  selectedEvidence: LinkedBrowserEvidenceArtifact[];
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/');
}

function summarizeAssertions(assertions: BrowserEvidenceAssertion[] = []): BrowserEvidenceAssertionSummary {
  return assertions.reduce<BrowserEvidenceAssertionSummary>((summary, assertion) => ({
    ...summary,
    [assertion.status]: summary[assertion.status] + 1,
  }), { passed: 0, failed: 0, pending: 0 });
}

function artifactStatus(artifact: BrowserEvidenceArtifact, summary: BrowserEvidenceAssertionSummary): BrowserEvidenceStatus {
  if (artifact.status === 'failed' || summary.failed > 0 || (artifact.consoleErrors ?? 0) > 0 || (artifact.networkFailures ?? 0) > 0) {
    return 'failed';
  }
  if (artifact.status === 'pending' || summary.pending > 0) return 'pending';
  return 'passed';
}

function fileStatus(evidence: LinkedBrowserEvidenceArtifact[]): BrowserEvidenceStatus {
  if (evidence.some((artifact) => artifactStatus(artifact, artifact.assertionSummary) === 'failed')) return 'failed';
  if (evidence.some((artifact) => artifactStatus(artifact, artifact.assertionSummary) === 'pending')) return 'pending';
  return 'passed';
}

function getLinkedFiles(artifact: BrowserEvidenceArtifact, changedPaths: string[]): string[] {
  const explicit = [
    ...(artifact.relatedFiles ?? []),
    ...(artifact.sourceFile ? [artifact.sourceFile] : []),
  ].map(normalizePath);
  const explicitMatches = changedPaths.filter((path) => explicit.includes(path));
  if (explicitMatches.length > 0) return explicitMatches;

  const evidencePath = normalizePath(`${artifact.path} ${artifact.id} ${artifact.label}`);
  return changedPaths.filter((path) => evidencePath.includes(path.replaceAll('/', '-')) || evidencePath.includes(path));
}

function buildLinkedEvidence(input: BrowserEvidenceReviewInput): LinkedBrowserEvidenceArtifact[] {
  const changedPaths = input.changedFiles.map((file) => normalizePath(file.path));
  return input.artifacts.map((artifact) => ({
    ...artifact,
    sourceFile: artifact.sourceFile ? normalizePath(artifact.sourceFile) : undefined,
    relatedFiles: artifact.relatedFiles?.map(normalizePath),
    linkedFiles: getLinkedFiles(artifact, changedPaths),
    assertionSummary: summarizeAssertions(artifact.assertions),
  }));
}

export function buildBrowserEvidenceReview(input: BrowserEvidenceReviewInput): BrowserEvidenceReviewReport {
  const linkedEvidence = buildLinkedEvidence(input);
  const selectedPath = input.selectedPath ? normalizePath(input.selectedPath) : null;
  const fileSummaries = input.changedFiles.map((file) => {
    const path = normalizePath(file.path);
    const evidence = linkedEvidence.filter((artifact) => artifact.linkedFiles.includes(path));
    const assertionSummary = evidence.reduce<BrowserEvidenceAssertionSummary>((summary, artifact) => ({
      passed: summary.passed + artifact.assertionSummary.passed,
      failed: summary.failed + artifact.assertionSummary.failed,
      pending: summary.pending + artifact.assertionSummary.pending,
    }), { passed: 0, failed: 0, pending: 0 });
    return {
      path,
      status: evidence.length ? fileStatus(evidence) : 'pending',
      evidenceCount: evidence.length,
      passedAssertions: assertionSummary.passed,
      failedAssertions: assertionSummary.failed,
      pendingAssertions: assertionSummary.pending,
      consoleErrors: evidence.reduce((total, artifact) => total + (artifact.consoleErrors ?? 0), 0),
      networkFailures: evidence.reduce((total, artifact) => total + (artifact.networkFailures ?? 0), 0),
    };
  });

  const selectedFile = selectedPath
    ? fileSummaries.find((file) => file.path === selectedPath) ?? null
    : null;
  const selectedEvidence = selectedPath
    ? linkedEvidence.filter((artifact) => artifact.linkedFiles.includes(selectedPath))
    : [];
  const totalAssertions = linkedEvidence.reduce((total, artifact) => (
    total + artifact.assertionSummary.passed + artifact.assertionSummary.failed + artifact.assertionSummary.pending
  ), 0);
  const passedAssertions = linkedEvidence.reduce((total, artifact) => total + artifact.assertionSummary.passed, 0);
  const failedAssertions = linkedEvidence.reduce((total, artifact) => total + artifact.assertionSummary.failed, 0);
  const pendingAssertions = linkedEvidence.reduce((total, artifact) => total + artifact.assertionSummary.pending, 0);
  const status = linkedEvidence.some((artifact) => artifactStatus(artifact, artifact.assertionSummary) === 'failed')
    ? 'failed'
    : linkedEvidence.some((artifact) => artifactStatus(artifact, artifact.assertionSummary) === 'pending')
      ? 'pending'
      : 'passed';

  return {
    status,
    totalEvidence: linkedEvidence.length,
    totalAssertions,
    passedAssertions,
    failedAssertions,
    pendingAssertions,
    fileSummaries,
    selectedFile,
    selectedEvidence,
  };
}

export function formatAssertionSummary(summary: BrowserEvidenceAssertionSummary): string {
  const parts = [
    summary.passed ? `${summary.passed} assertions passed` : '',
    summary.failed ? `${summary.failed} failed` : '',
    summary.pending ? `${summary.pending} pending` : '',
  ].filter(Boolean);
  return parts.join(', ') || 'No structured assertions';
}

export function createSampleBrowserEvidenceArtifacts(workspaceName: string): BrowserEvidenceArtifact[] {
  return [
    {
      id: 'visual-smoke-dashboard',
      label: 'Agent Browser visual smoke',
      kind: 'screenshot',
      status: 'passed',
      path: 'output/playwright/agent-browser-visual-smoke.png',
      relatedFiles: [
        'agent-browser/src/App.tsx',
        'agent-browser/src/App.css',
        'agent-browser/src/features/worktree/GitWorktreePanel.tsx',
      ],
      assertions: [
        { label: `${workspaceName} dashboard renders changed worktree files`, status: 'passed' },
        { label: 'Selected diff remains visible beside browser evidence', status: 'passed' },
      ],
      consoleErrors: 0,
      networkFailures: 0,
    },
    {
      id: 'git-worktree-evidence',
      label: 'Git worktree diff evidence',
      kind: 'assertion',
      status: 'passed',
      path: 'agent-browser/scripts/visual-smoke.mjs',
      sourceFile: 'agent-browser/src/features/worktree/GitWorktreePanel.tsx',
      assertions: [
        { label: 'Changed file tree is linked to selected patch', status: 'passed' },
      ],
      consoleErrors: 0,
      networkFailures: 0,
    },
  ];
}
