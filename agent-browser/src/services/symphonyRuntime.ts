import { INTERNAL_TASK_STORE_CONFIG } from '@agent-harness/task-manager';
import type { WorkGraphCommand } from '@agent-harness/workgraph';
import {
  buildMultitaskWorkGraphCommands,
  type MultitaskApprovalActor,
  type MultitaskSubagentBranch,
  type MultitaskBranchExecutionEvent,
  type MultitaskProject,
  type MultitaskSubagentState,
} from './multitaskSubagents';
import type { PullRequestReviewReport, PullRequestValidationStatus } from './prReviewUnderstanding';

export type SymphonyIssueClaimState = 'Unclaimed' | 'Claimed' | 'Running' | 'RetryQueued' | 'Released';
export type SymphonyAttemptPhase =
  | 'PreparingWorkspace'
  | 'BuildingPrompt'
  | 'LaunchingAgentProcess'
  | 'InitializingSession'
  | 'StreamingTurn'
  | 'Finishing'
  | 'Succeeded'
  | 'Failed'
  | 'TimedOut'
  | 'Stalled'
  | 'CanceledByReconciliation';
export type SymphonyWorkflowValidationStatus = 'ready' | 'blocked';
export type SymphonyApprovalActor = MultitaskApprovalActor;
export type SymphonyReviewerDecisionState = 'approved' | 'rejected' | 'disabled' | 'not-ready';

export interface SymphonyAutopilotSettings {
  autopilotEnabled: boolean;
}

export const DEFAULT_SYMPHONY_AUTOPILOT_SETTINGS: SymphonyAutopilotSettings = {
  autopilotEnabled: true,
};

export interface SymphonyIssue {
  id: string;
  identifier: string;
  projectId: string | null;
  title: string;
  description: string | null;
  priority: number | null;
  state: string;
  claimState: SymphonyIssueClaimState;
  branchName: string | null;
  url: string | null;
  labels: string[];
  blockedBy: Array<{ id: string | null; identifier: string | null; state: string | null }>;
  createdAt: string;
  updatedAt: string;
}

export interface SymphonyWorkspace {
  issueId: string;
  issueIdentifier: string;
  path: string;
  workspaceKey: string;
  createdNow: boolean;
  branchName: string;
  sourceWorktreePath: string;
}

export interface SymphonyRunAttempt {
  issueId: string;
  issueIdentifier: string;
  attempt: number | null;
  workspacePath: string;
  startedAt: string;
  phase: SymphonyAttemptPhase;
  status: 'pending' | 'active' | 'complete' | 'failed' | 'stopped' | 'cancelled';
  error: string | null;
  evidence: MultitaskBranchExecutionEvent[];
}

export interface SymphonyLiveSession {
  issueId: string;
  sessionId: string;
  threadId: string;
  turnId: string;
  codexAppServerPid: string | null;
  lastCodexEvent: string | null;
  lastCodexTimestamp: string | null;
  lastCodexMessage: string;
  codexInputTokens: number;
  codexOutputTokens: number;
  codexTotalTokens: number;
  lastReportedInputTokens: number;
  lastReportedOutputTokens: number;
  lastReportedTotalTokens: number;
  turnCount: number;
}

export interface SymphonyRetryEntry {
  issueId: string;
  issueIdentifier: string;
  attempt: number;
  dueAtMs: number;
  error: string | null;
}

export interface SymphonyRunningEntry {
  issueId: string;
  identifier: string;
  branchName: string;
  workspacePath: string;
  startedAt: string;
  phase: SymphonyAttemptPhase;
  sessionId: string;
}

export interface SymphonyWorkflowSnapshot {
  path: string;
  promptTemplate: string;
  config: {
    taskStore: {
      kind: typeof INTERNAL_TASK_STORE_CONFIG.kind;
      uri: typeof INTERNAL_TASK_STORE_CONFIG.uri;
      namespace: string;
      taskType: typeof INTERNAL_TASK_STORE_CONFIG.taskType;
      workerChannel: typeof INTERNAL_TASK_STORE_CONFIG.workerChannel;
      serviceWorkerOutbox: typeof INTERNAL_TASK_STORE_CONFIG.serviceWorkerOutbox;
      activeStatuses: string[];
      terminalStatuses: string[];
    };
    polling: { intervalMs: number };
    workspace: { root: string };
    hooks: {
      afterCreate: string;
      beforeRun: string;
      afterRun: string;
      beforeRemove: string;
      timeoutMs: number;
    };
    agent: {
      maxConcurrentAgents: number;
      maxTurns: number;
      maxRetryBackoffMs: number;
      maxConcurrentAgentsByState: Record<string, number>;
    };
    codex: {
      command: string;
      approvalPolicy: string;
      threadSandbox: string;
      turnSandboxPolicy: string;
      turnTimeoutMs: number;
      readTimeoutMs: number;
      stallTimeoutMs: number;
    };
  };
  validation: {
    status: SymphonyWorkflowValidationStatus;
    errors: string[];
  };
  reload: {
    status: 'watching';
    lastReloadedAt: string;
  };
}

export interface SymphonyRuntimeSnapshot {
  workflow: SymphonyWorkflowSnapshot;
  projects: Array<{
    id: string;
    name: string;
    issueCount: number;
    openIssueCount: number;
  }>;
  activeProjectId: string | null;
  selectedIssueId: string | null;
  issues: SymphonyIssue[];
  workspaces: SymphonyWorkspace[];
  runAttempts: SymphonyRunAttempt[];
  liveSessions: SymphonyLiveSession[];
  retryEntries: SymphonyRetryEntry[];
  workGraph: {
    commands: WorkGraphCommand[];
    issueIds: string[];
  };
  orchestrator: {
    pollIntervalMs: number;
    maxConcurrentAgents: number;
    running: Map<string, SymphonyRunningEntry>;
    claimed: string[];
    retryAttempts: Map<string, SymphonyRetryEntry>;
    completed: string[];
    codexTotals: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      runtimeSeconds: number;
    };
    codexRateLimits: {
      requestsRemaining: number;
      tokensRemaining: number;
    };
  };
  review: {
    readinessStatus: PullRequestReviewReport['readiness']['status'];
    mergeTarget: 'common branch';
    approvedBranchName: string | null;
    branches: Array<{
      branchId: string;
      branchName: string;
      issueIdentifier: string;
      status: MultitaskSubagentBranch['status'];
      approvalState: 'waiting' | 'approved' | 'blocked';
      approvedBy: SymphonyApprovalActor | null;
      reviewerAgentDecision: {
        state: SymphonyReviewerDecisionState;
        feedback: string[];
      };
    }>;
    report: PullRequestReviewReport;
  };
  logs: Array<{
    ts: string;
    level: 'info' | 'warn' | 'error';
    event: string;
    issueId?: string;
    issueIdentifier?: string;
    sessionId?: string;
    message: string;
  }>;
  layers: Array<{
    name: string;
    detail: string;
    status: 'ready' | 'active' | 'blocked';
  }>;
}

export interface SymphonyRuntimeSummary {
  totalIssues: number;
  running: number;
  retryQueued: number;
  awaitingApproval: number;
  approved: number;
  availableSlots: number;
  readyForReview: number;
  blocked: number;
  workflowStatus: SymphonyWorkflowValidationStatus;
}

export interface CreateSymphonyRuntimeSnapshotInput {
  state: MultitaskSubagentState;
  report: PullRequestReviewReport;
  autopilotSettings?: SymphonyAutopilotSettings;
  now?: Date;
}

const WORKSPACE_ROOT = '.symphony/workspaces';
const MAX_CONCURRENT_AGENTS = 4;
const DEFAULT_CREATED_AT = '2026-05-07T10:00:00.000Z';

export function createSymphonyRuntimeSnapshot({
  state,
  report,
  autopilotSettings = DEFAULT_SYMPHONY_AUTOPILOT_SETTINGS,
  now,
}: CreateSymphonyRuntimeSnapshotInput): SymphonyRuntimeSnapshot {
  const effectiveNow = normalizeDate(now ?? new Date(state.createdAt));
  const projects = projectsForState(state);
  const issues = state.branches.map((branch, index) => createIssue(branch, index, effectiveNow));
  const workspaces = state.branches.map((branch, index) => createWorkspace(branch, index));
  const runAttempts = state.branches.map((branch, index) => createRunAttempt(branch, index, effectiveNow));
  const liveSessions = state.branches.flatMap((branch, index) =>
    branch.status === 'running' ? [createLiveSession(branch, issueIdentifierForBranch(branch, index), effectiveNow)] : []);
  const retryEntries = state.branches
    .map((branch, index) => branch.status === 'blocked' ? createRetryEntry(branch, index, effectiveNow) : null)
    .filter((entry): entry is SymphonyRetryEntry => entry !== null);
  const running = new Map<string, SymphonyRunningEntry>(
    state.branches.flatMap((branch, index) =>
      branch.status === 'running' ? [[branch.id, createRunningEntry(branch, index, effectiveNow)] as const] : []),
  );
  const retryAttempts = new Map(retryEntries.map((entry) => [entry.issueId, entry]));
  const completed = state.branches
    .filter((branch) => branch.status === 'ready' || branch.status === 'promoted' || branch.status === 'cancelled')
    .map((branch) => branch.id);
  const notPassingValidationCount = countNotPassingValidations(report.validations);

  return {
    workflow: createWorkflowSnapshot(state, effectiveNow, notPassingValidationCount),
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      issueCount: state.branches.filter((branch) => branch.projectId === project.id).length,
      openIssueCount: state.branches.filter((branch) => branch.projectId === project.id && branch.status !== 'promoted' && branch.status !== 'cancelled').length,
    })),
    activeProjectId: state.activeProjectId ?? projects[0]?.id ?? null,
    selectedIssueId: state.selectedBranchId ?? state.branches[0]?.id ?? null,
    issues,
    workspaces,
    runAttempts,
    liveSessions,
    retryEntries,
    workGraph: {
      commands: buildMultitaskWorkGraphCommands(state),
      issueIds: state.branches.map((branch) => branch.id),
    },
    orchestrator: {
      pollIntervalMs: 30000,
      maxConcurrentAgents: MAX_CONCURRENT_AGENTS,
      running,
      claimed: state.branches
        .filter((branch) => branch.status === 'queued' || branch.status === 'running' || branch.status === 'blocked')
        .map((branch) => branch.id),
      retryAttempts,
      completed,
      codexTotals: createTokenTotals(liveSessions),
      codexRateLimits: {
        requestsRemaining: Math.max(0, 1000 - liveSessions.length),
        tokensRemaining: Math.max(0, 200000 - liveSessions.reduce((total, session) => total + session.codexTotalTokens, 0)),
      },
    },
    review: {
      readinessStatus: report.readiness.status,
      mergeTarget: 'common branch',
      approvedBranchName: state.branches.find((branch) => branch.id === state.foregroundBranchId)?.branchName ?? null,
      branches: state.branches.map((branch, index) => ({
        branchId: branch.id,
        branchName: branch.branchName,
        issueIdentifier: issueIdentifierForBranch(branch, index),
        status: branch.status,
        approvalState: approvalStateFor(branch, state.foregroundBranchId),
        approvedBy: branch.id === state.foregroundBranchId ? state.foregroundBranchApprovedBy ?? 'user' : null,
        reviewerAgentDecision: createReviewerDecision(branch, report, autopilotSettings.autopilotEnabled),
      })),
      report,
    },
    logs: createLogs(state, report, effectiveNow, running, retryEntries),
    layers: createLayers(notPassingValidationCount, running.size),
  };
}

export function isSymphonyAutopilotSettings(value: unknown): value is SymphonyAutopilotSettings {
  return isRecord(value) && typeof value.autopilotEnabled === 'boolean';
}

export function summarizeSymphonyRuntime(snapshot: SymphonyRuntimeSnapshot): SymphonyRuntimeSummary {
  const availableSlots = Math.max(0, snapshot.orchestrator.maxConcurrentAgents - snapshot.orchestrator.running.size);
  const blockedBranches = snapshot.review.branches.filter((branch) => branch.status === 'blocked').length;
  return {
    totalIssues: snapshot.issues.length,
    running: snapshot.orchestrator.running.size,
    retryQueued: snapshot.retryEntries.length,
    awaitingApproval: snapshot.review.branches.filter((branch) => branch.approvalState === 'waiting').length,
    approved: snapshot.review.branches.filter((branch) => branch.approvalState === 'approved').length,
    availableSlots,
    readyForReview: snapshot.review.branches.filter((branch) => branch.status === 'ready').length,
    blocked: blockedBranches,
    workflowStatus: snapshot.workflow.validation.status,
  };
}

export function buildSymphonyHistoryEventSummaries(snapshot: SymphonyRuntimeSnapshot): string[] {
  return uniqueStrings([
    ...snapshot.logs.map((entry) => `Symphony event: ${formatEventName(entry.event)} - ${entry.message}`),
    ...snapshot.review.branches.map((branch) => (
      `Symphony review: ${branch.issueIdentifier} ${branch.branchName} ${branch.approvalState}/${branch.reviewerAgentDecision.state}`
    )),
  ]);
}

export function buildSymphonyHistorySessionSummaries(snapshot: SymphonyRuntimeSnapshot): string[] {
  return snapshot.workspaces.map((workspace) => {
    const attempt = snapshot.runAttempts.find((candidate) => candidate.issueId === workspace.issueId);
    const liveSession = snapshot.liveSessions.find((candidate) => candidate.issueId === workspace.issueId);
    const phase = attempt?.phase ?? 'PreparingWorkspace';
    const status = attempt?.status ?? 'pending';
    const evidenceCount = attempt?.evidence.length ?? 0;
    const turnSummary = liveSession
      ? `${liveSession.turnCount} turn${liveSession.turnCount === 1 ? '' : 's'}`
      : 'no live session';
    return `Symphony session: ${workspace.issueIdentifier} ${workspace.branchName} ${phase} ${status} ${turnSummary}, ${evidenceCount} evidence event${evidenceCount === 1 ? '' : 's'}`;
  });
}

function createWorkflowSnapshot(
  state: MultitaskSubagentState,
  now: Date,
  notPassingValidationCount: number,
): SymphonyWorkflowSnapshot {
  const errors = notPassingValidationCount > 0
    ? [`${notPassingValidationCount} validation checks are not passing yet.`]
    : [];
  return {
    path: 'WORKFLOW.md',
    promptTemplate: [
      'You are working on an internal durable task through Symphony.',
      'Use the per-task isolated worktree only.',
      'Stop at the workflow-defined human review handoff when approval is required.',
    ].join('\n'),
    config: {
      taskStore: {
        kind: INTERNAL_TASK_STORE_CONFIG.kind,
        uri: INTERNAL_TASK_STORE_CONFIG.uri,
        namespace: slugify(state.workspaceName),
        taskType: INTERNAL_TASK_STORE_CONFIG.taskType,
        workerChannel: INTERNAL_TASK_STORE_CONFIG.workerChannel,
        serviceWorkerOutbox: INTERNAL_TASK_STORE_CONFIG.serviceWorkerOutbox,
        activeStatuses: ['queued', 'running', 'waiting'],
        terminalStatuses: ['completed', 'cancelled', 'failed'],
      },
      polling: { intervalMs: 30000 },
      workspace: { root: WORKSPACE_ROOT },
      hooks: {
        afterCreate: 'git worktree add "$SYMPHONY_WORKSPACE" "$SYMPHONY_BRANCH"',
        beforeRun: 'npm.cmd install',
        afterRun: 'npm.cmd run verify:agent-browser',
        beforeRemove: 'git worktree remove "$SYMPHONY_WORKSPACE"',
        timeoutMs: 60000,
      },
      agent: {
        maxConcurrentAgents: MAX_CONCURRENT_AGENTS,
        maxTurns: 20,
        maxRetryBackoffMs: 300000,
        maxConcurrentAgentsByState: { 'in progress': 2, 'human review': 1 },
      },
      codex: {
        command: 'codex app-server',
        approvalPolicy: 'on-request',
        threadSandbox: 'workspace-write',
        turnSandboxPolicy: 'workspace-write',
        turnTimeoutMs: 3600000,
        readTimeoutMs: 5000,
        stallTimeoutMs: 300000,
      },
    },
    validation: {
      status: errors.length ? 'blocked' : 'ready',
      errors,
    },
    reload: {
      status: 'watching',
      lastReloadedAt: now.toISOString(),
    },
  };
}

function createIssue(branch: MultitaskSubagentBranch, index: number, now: Date): SymphonyIssue {
  const identifier = issueIdentifierForBranch(branch, index);
  return {
    id: branch.id,
    identifier,
    projectId: branch.projectId,
    title: branch.title,
    description: branch.summary,
    priority: index + 1,
    state: taskStateFor(branch.status),
    claimState: claimStateFor(branch.status),
    branchName: branch.branchName,
    url: null,
    labels: ['symphony', slugify(branch.role)],
    blockedBy: branch.status === 'blocked'
      ? [{ id: null, identifier: `${identifier}-BLOCKER`, state: 'Todo' }]
      : [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function createWorkspace(branch: MultitaskSubagentBranch, index: number): SymphonyWorkspace {
  const identifier = issueIdentifierForBranch(branch, index);
  return {
    issueId: branch.id,
    issueIdentifier: identifier,
    path: `${WORKSPACE_ROOT}/${sanitizeWorkspaceKey(identifier)}`,
    workspaceKey: sanitizeWorkspaceKey(identifier),
    createdNow: branch.status === 'queued',
    branchName: branch.branchName,
    sourceWorktreePath: branch.worktreePath,
  };
}

function createRunAttempt(branch: MultitaskSubagentBranch, index: number, now: Date): SymphonyRunAttempt {
  const issueIdentifier = issueIdentifierForBranch(branch, index);
  const evidence = branch.executionEvents ?? [];
  return {
    issueId: branch.id,
    issueIdentifier,
    attempt: branch.status === 'queued' ? null : Math.max(1, branch.runAttempt ?? 1),
    workspacePath: `${WORKSPACE_ROOT}/${issueIdentifier}`,
    startedAt: branch.lastRunAt ?? now.toISOString(),
    phase: phaseFor(branch.status),
    status: runStatusFor(branch.status),
    error: branch.status === 'blocked' ? 'agent branch blocked' : null,
    evidence,
  };
}

function createLiveSession(branch: MultitaskSubagentBranch, issueIdentifier: string, now: Date): SymphonyLiveSession {
  const threadId = `thread-${issueIdentifier}`;
  const turnId = 'turn-1';
  const inputTokens = 1800 + Math.round(branch.confidence * 100);
  const outputTokens = 700 + Math.max(0, Math.round(branch.progress));
  const lastEvidence = branch.executionEvents?.at(-1) ?? null;
  return {
    issueId: branch.id,
    sessionId: branch.sessionId ?? `${threadId}-${turnId}`,
    threadId,
    turnId,
    codexAppServerPid: 'local-app-server',
    lastCodexEvent: lastEvidence?.type ?? 'turn_delta',
    lastCodexTimestamp: lastEvidence?.at ?? branch.lastHeartbeatAt ?? now.toISOString(),
    lastCodexMessage: lastEvidence?.summary ?? branch.summary,
    codexInputTokens: inputTokens,
    codexOutputTokens: outputTokens,
    codexTotalTokens: inputTokens + outputTokens,
    lastReportedInputTokens: inputTokens,
    lastReportedOutputTokens: outputTokens,
    lastReportedTotalTokens: inputTokens + outputTokens,
    turnCount: 1,
  };
}

function createRetryEntry(branch: MultitaskSubagentBranch, index: number, now: Date): SymphonyRetryEntry {
  return {
    issueId: branch.id,
    issueIdentifier: issueIdentifierForBranch(branch, index),
    attempt: 2,
    dueAtMs: now.getTime() + 10000,
    error: 'agent branch blocked',
  };
}

function createRunningEntry(branch: MultitaskSubagentBranch, index: number, now: Date): SymphonyRunningEntry {
  const issueIdentifier = issueIdentifierForBranch(branch, index);
  return {
    issueId: branch.id,
    identifier: issueIdentifier,
    branchName: branch.branchName,
    workspacePath: `${WORKSPACE_ROOT}/${issueIdentifier}`,
    startedAt: branch.lastRunAt ?? now.toISOString(),
    phase: 'StreamingTurn',
    sessionId: branch.sessionId ?? `thread-${issueIdentifier}-turn-1`,
  };
}

function createLogs(
  state: MultitaskSubagentState,
  report: PullRequestReviewReport,
  now: Date,
  running: Map<string, SymphonyRunningEntry>,
  retryEntries: SymphonyRetryEntry[],
): SymphonyRuntimeSnapshot['logs'] {
  if (state.branches.length === 0) {
    return [{
      ts: now.toISOString(),
      level: 'info',
      event: 'idle',
      message: 'No active Symphony task.',
    }];
  }
  const firstRunning = [...running.values()][0] ?? null;
  const logs: SymphonyRuntimeSnapshot['logs'] = [
    {
      ts: now.toISOString(),
      level: 'info',
      event: 'workflow_loaded',
      message: 'Loaded WORKFLOW.md and applied Symphony runtime defaults.',
    },
    {
      ts: now.toISOString(),
      level: 'info',
      event: 'poll_tick',
      message: `Loaded ${state.branches.length} durable tasks from the internal task store.`,
    },
  ];
  if (firstRunning) {
    logs.push({
      ts: now.toISOString(),
      level: 'info',
      event: 'issue_dispatched',
      issueId: firstRunning.issueId,
      issueIdentifier: firstRunning.identifier,
      sessionId: firstRunning.sessionId,
      message: `Dispatched ${firstRunning.identifier} into ${firstRunning.workspacePath}.`,
    });
  }
  for (const branch of state.branches) {
    const issueIdentifier = issueIdentifierForBranch(branch, state.branches.indexOf(branch));
    for (const evidence of branch.executionEvents ?? []) {
      logs.push({
        ts: evidence.at,
        level: evidence.type === 'self_heal_requeued' ? 'warn' : 'info',
        event: evidence.type,
        issueId: branch.id,
        issueIdentifier,
        sessionId: branch.sessionId ?? undefined,
        message: evidence.summary,
      });
    }
  }
  if (retryEntries[0]) {
    logs.push({
      ts: now.toISOString(),
      level: 'warn',
      event: 'retry_queued',
      issueId: retryEntries[0].issueId,
      issueIdentifier: retryEntries[0].issueIdentifier,
      message: retryEntries[0].error as string,
    });
  }
  logs.push({
    ts: now.toISOString(),
    level: report.readiness.status === 'ready' ? 'info' : 'warn',
    event: report.readiness.status === 'ready' ? 'review_gate_ready' : 'review_gate_waiting',
    message: report.readiness.status === 'ready'
      ? 'All validations and browser evidence are ready for approval.'
      : 'Review needs validation evidence before merge approval.',
  });
  return logs;
}

function projectsForState(state: MultitaskSubagentState): MultitaskProject[] {
  if (state.projects?.length > 0) return state.projects;
  if (state.branches.length === 0) return [];
  return [{
    id: `multitask-project:${state.workspaceId || 'workspace'}:symphony`,
    name: state.workspaceName || state.workspaceId || 'Symphony',
    description: state.request,
    createdAt: state.createdAt,
  }];
}

function formatEventName(value: string): string {
  return value.replace(/[_-]+/g, ' ');
}

function createLayers(notPassingValidationCount: number, runningCount: number): SymphonyRuntimeSnapshot['layers'] {
  return [
    { name: 'Policy Layer', detail: 'WORKFLOW.md prompt body and team handoff policy', status: notPassingValidationCount > 0 ? 'blocked' : 'ready' },
    { name: 'Configuration Layer', detail: 'Typed config, defaults, environment indirection', status: 'ready' },
    { name: 'Coordination Layer', detail: 'Polling, claims, retries, reconciliation', status: runningCount > 0 ? 'active' : 'ready' },
    { name: 'Execution Layer', detail: 'Per-issue workspaces and Codex app-server sessions', status: runningCount > 0 ? 'active' : 'ready' },
    { name: 'Integration Layer', detail: 'Internal task normalization, IndexedDB state, worker/outbox refresh', status: 'ready' },
    { name: 'Observability Layer', detail: 'Structured logs, status surface, token totals', status: 'ready' },
  ];
}

function createTokenTotals(liveSessions: SymphonyLiveSession[]) {
  return liveSessions.reduce((totals, session) => ({
    inputTokens: totals.inputTokens + session.codexInputTokens,
    outputTokens: totals.outputTokens + session.codexOutputTokens,
    totalTokens: totals.totalTokens + session.codexTotalTokens,
    runtimeSeconds: totals.runtimeSeconds + session.turnCount * 60,
  }), {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    runtimeSeconds: 0,
  });
}

function countNotPassingValidations(validations: Array<{ status: PullRequestValidationStatus }>): number {
  return validations.filter((validation) => validation.status !== 'passed').length;
}

function approvalStateFor(
  branch: MultitaskSubagentBranch,
  foregroundBranchId: string | null,
): 'waiting' | 'approved' | 'blocked' {
  if (branch.status === 'blocked') return 'blocked';
  if (branch.id === foregroundBranchId || branch.status === 'promoted') return 'approved';
  if (branch.status !== 'ready') return 'blocked';
  return 'waiting';
}

function createReviewerDecision(
  branch: MultitaskSubagentBranch,
  report: PullRequestReviewReport,
  autopilotEnabled: boolean,
): SymphonyRuntimeSnapshot['review']['branches'][number]['reviewerAgentDecision'] {
  if (branch.status === 'queued' || branch.status === 'running' || branch.status === 'stopped' || branch.status === 'cancelled') {
    return {
      state: 'not-ready',
      feedback: [branch.status === 'stopped'
        ? 'Agent session is stopped; start or retry it before merge review.'
        : branch.status === 'cancelled'
          ? 'Task is cancelled; retry it or dispose the workspace.'
          : 'Branch output is not ready for merge review yet.'],
    };
  }

  if (!autopilotEnabled) {
    return {
      state: 'disabled',
      feedback: ['Enable Symphony autopilot before reviewer-agent approval is available.'],
    };
  }

  const feedback: string[] = [];
  if (branch.status === 'blocked') {
    feedback.push('Branch is blocked; resolve the blocker before requesting merge approval.');
  }
  if (report.readiness.failedValidations > 0) {
    feedback.push('Failing validation is attached to the merge request.');
  }
  if (report.readiness.pendingValidations > 0) {
    feedback.push('Pending or missing validation must pass before merge.');
  }
  if (report.readiness.browserEvidenceCount === 0) {
    feedback.push('No browser evidence is attached for reviewer inspection.');
  }
  const criticalRisks = report.risks.filter((risk) => risk.severity === 'high' || risk.severity === 'medium');
  if (criticalRisks.length > 0) {
    feedback.push(`Reviewer found unresolved risk: ${criticalRisks[0].title}.`);
  }

  if (feedback.length > 0) {
    return {
      state: 'rejected',
      feedback: [
        'Reviewer agent rejected this merge request.',
        ...feedback,
        'Address the feedback, update validation evidence, and request review again.',
      ],
    };
  }

  return {
    state: 'approved',
    feedback: ['Reviewer agent approved this merge request after a critical evidence check.'],
  };
}

function taskStateFor(status: MultitaskSubagentBranch['status']): string {
  if (status === 'running') return 'In Progress';
  if (status === 'stopped') return 'Stopped';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'ready' || status === 'promoted') return 'Human Review';
  return 'Todo';
}

function claimStateFor(status: MultitaskSubagentBranch['status']): SymphonyIssueClaimState {
  if (status === 'running') return 'Running';
  if (status === 'blocked') return 'RetryQueued';
  if (status === 'ready' || status === 'promoted' || status === 'stopped' || status === 'cancelled') return 'Released';
  return 'Claimed';
}

function phaseFor(status: MultitaskSubagentBranch['status']): SymphonyAttemptPhase {
  if (status === 'running') return 'StreamingTurn';
  if (status === 'blocked') return 'Stalled';
  if (status === 'stopped' || status === 'cancelled') return 'CanceledByReconciliation';
  if (status === 'ready') return 'Succeeded';
  if (status === 'promoted') return 'Finishing';
  return 'PreparingWorkspace';
}

function runStatusFor(status: MultitaskSubagentBranch['status']): SymphonyRunAttempt['status'] {
  if (status === 'running') return 'active';
  if (status === 'blocked') return 'failed';
  if (status === 'stopped') return 'stopped';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'queued') return 'pending';
  return 'complete';
}

function issueIdentifierFor(index: number): string {
  return `SYM-${String(index + 1).padStart(3, '0')}`;
}

function issueIdentifierForBranch(branch: MultitaskSubagentBranch, index: number): string {
  const match = /-(\d+)$/.exec(branch.id);
  const ordinal = match ? Number.parseInt(match[1], 10) : index + 1;
  return Number.isFinite(ordinal) && ordinal > 0 ? issueIdentifierFor(ordinal - 1) : issueIdentifierFor(index);
}

function sanitizeWorkspaceKey(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'workspace';
}

function normalizeDate(value: Date): Date {
  return Number.isNaN(value.getTime()) ? new Date(DEFAULT_CREATED_AT) : value;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
