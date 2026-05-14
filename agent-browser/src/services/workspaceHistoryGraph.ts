import type { ConversationBranchCommit, ConversationBranchingState, ConversationSubthread } from './conversationBranches';
import type { BrowserAgentRun, BrowserAgentRunEvent, BrowserAgentRunSdkState } from './browserAgentRunSdk';
import type { RunCheckpoint, RunCheckpointAuditEntry, RunCheckpointState } from './runCheckpoints';
import type { ScheduledAutomation, ScheduledAutomationInboxItem, ScheduledAutomationRun, ScheduledAutomationState } from './scheduledAutomations';
import type { ChapteredSessionState, SessionChapter } from './sessionChapters';
import type { WorkspaceFileCrdtHistory, WorkspaceFileCrdtOperation } from './workspaceFileCrdtHistory';
import { buildWorkspaceActionTimeline, type WorkspaceActionHistoryState } from './workspaceActionHistory';

export type WorkspaceHistoryRowKind =
  | 'history-rollup'
  | 'session-squash'
  | 'branch-squash'
  | 'conversation-branch'
  | 'checkpoint'
  | 'browser-agent-run'
  | 'automation'
  | 'app-action-squash'
  | 'file-change'
  | 'recent-activity';
export type WorkspaceHistoryDetailKind = 'message' | 'process' | 'evidence' | 'validation' | 'tool-output' | 'commit' | 'file-diff';
export type WorkspaceHistoryTarget =
  | {
    kind: 'branch-history';
    branchId: string;
    sessionId?: string;
    commitIds: string[];
  }
  | {
    kind: 'chat-session';
    sessionId: string;
    chapterId?: string;
    messageIds: string[];
  }
  | {
    kind: 'file-version';
    workspaceId: string;
    filePath: string;
    opId: string | null;
  }
  | {
    kind: 'app-state';
    actionIds: string[];
    cursorActionId?: string | null;
  };

export interface WorkspaceHistorySessionInput {
  id: string;
  name: string;
  isOpen?: boolean;
}

export interface WorkspaceHistoryRecentActivityInput {
  id: string | number;
  title: string;
  date: string;
  preview: string;
  events: string[];
}

export interface WorkspaceHistoryGraphInput {
  workspaceId: string;
  workspaceName: string;
  sessions: WorkspaceHistorySessionInput[];
  chapterState: ChapteredSessionState;
  conversationBranchingState: ConversationBranchingState;
  runCheckpointState: RunCheckpointState;
  browserAgentRunSdkState: BrowserAgentRunSdkState;
  scheduledAutomationState: ScheduledAutomationState;
  actionHistoryState: WorkspaceActionHistoryState;
  fileHistories?: WorkspaceFileCrdtHistory[];
  recentActivity: WorkspaceHistoryRecentActivityInput[];
}

export interface WorkspaceHistoryDetailRow {
  id: string;
  kind: WorkspaceHistoryDetailKind;
  label: string;
  branchName: string;
  timestamp: number;
}

export interface WorkspaceHistoryRow {
  id: string;
  kind: WorkspaceHistoryRowKind;
  title: string;
  summary: string;
  branchId: string;
  branchName: string;
  sourceBranchName: string;
  color: string;
  timestamp: number;
  parentIds: string[];
  statusLabel: string;
  isMainline: boolean;
  isCurrent?: boolean;
  stateCursorActionId?: string | null;
  target?: WorkspaceHistoryTarget;
  detailCount: number;
  detailRows: WorkspaceHistoryDetailRow[];
  children?: WorkspaceHistoryRow[];
}

export interface WorkspaceHistorySummary {
  mainlineCommits: number;
  branchCommits: number;
  squashMerges: number;
  timelineNodes: number;
  lanes: string[];
}

export interface WorkspaceHistoryGraph {
  workspaceId: string;
  workspaceName: string;
  rows: WorkspaceHistoryRow[];
  summary: WorkspaceHistorySummary;
}

const MAIN_COLOR = '#b586f6';
const CHECKPOINT_COLOR = '#f59e0b';
const RUN_COLOR = '#38bdf8';
const AUTOMATION_COLOR = '#34d399';
const ACTION_COLOR = '#c084fc';
const FILE_COLOR = '#22d3ee';
const ACTIVITY_COLOR = '#94a3b8';

type WorkspaceHistoryRollupKey = 'squash-merge' | 'app-actions' | 'symphony-activity';

interface WorkspaceHistoryRollupDefinition {
  key: WorkspaceHistoryRollupKey;
  title: string;
  singularLabel: string;
  pluralLabel: string;
  statusLabel: string;
  branchName: string;
  sourceBranchName: string;
  color: string;
  isMainline: boolean;
}

export function buildWorkspaceHistoryGraph({
  workspaceId,
  workspaceName,
  sessions,
  chapterState,
  conversationBranchingState,
  runCheckpointState,
  browserAgentRunSdkState,
  scheduledAutomationState,
  actionHistoryState,
  fileHistories = [],
  recentActivity,
}: WorkspaceHistoryGraphInput): WorkspaceHistoryGraph {
  const sessionNames = new Map(sessions.map((session) => [session.id, session.name]));
  const sortedRows = [
    ...buildSessionSquashRows({ workspaceId, sessionNames, chapterState }),
    ...buildConversationBranchSquashRows({ workspaceId, conversationBranchingState }),
    ...buildCheckpointRows({ workspaceId, sessionNames, runCheckpointState }),
    ...buildBrowserAgentRunRows({ workspaceId, sessionNames, browserAgentRunSdkState }),
    ...buildAutomationRows({ scheduledAutomationState }),
    ...buildWorkspaceActionRows({ workspaceId, actionHistoryState }),
    ...buildWorkspaceFileRows({ workspaceId, fileHistories }),
    ...buildRecentActivityRows(recentActivity),
  ]
    .sort((left, right) => right.timestamp - left.timestamp || left.title.localeCompare(right.title));
  const rows = rollupDirectSubsequentHistoryRows(sortedRows)
    .map((row, index, sortedRows) => ({
      ...row,
      parentIds: sortedRows[index + 1] ? [sortedRows[index + 1].id] : [],
    }));

  return {
    workspaceId,
    workspaceName,
    rows,
    summary: {
      mainlineCommits: rows.filter((row) => row.isMainline).length,
      branchCommits: rows.reduce((total, row) => total + row.detailCount, 0),
      squashMerges: rows.filter(isVisibleSquashMergeRow).length,
      timelineNodes: rows.length,
      lanes: [...new Set(rows.map((row) => row.branchName))],
    },
  };
}

function rollupDirectSubsequentHistoryRows(rows: WorkspaceHistoryRow[]): WorkspaceHistoryRow[] {
  const rolledRows: WorkspaceHistoryRow[] = [];
  let index = 0;
  while (index < rows.length) {
    const firstRow = rows[index];
    const definition = getHistoryRollupDefinition(firstRow);
    if (!definition) {
      rolledRows.push(firstRow);
      index += 1;
      continue;
    }

    const group: WorkspaceHistoryRow[] = [firstRow];
    let cursor = index + 1;
    while (cursor < rows.length && getHistoryRollupDefinition(rows[cursor])?.key === definition.key) {
      group.push(rows[cursor]);
      cursor += 1;
    }

    rolledRows.push(group.length > 1 ? createHistoryRollupRow(group, definition) : firstRow);
    index = cursor;
  }
  return rolledRows;
}

function getHistoryRollupDefinition(row: WorkspaceHistoryRow): WorkspaceHistoryRollupDefinition | null {
  if (row.kind === 'session-squash' || row.kind === 'branch-squash') {
    return {
      key: 'squash-merge',
      title: 'Squash merge',
      singularLabel: 'squash merge',
      pluralLabel: 'squash merges',
      statusLabel: 'squash',
      branchName: 'main',
      sourceBranchName: 'main/squash',
      color: MAIN_COLOR,
      isMainline: true,
    };
  }
  if (row.kind === 'app-action-squash' && row.title.startsWith('Symphony activity:')) {
    return {
      key: 'symphony-activity',
      title: 'Symphony activity',
      singularLabel: 'Symphony update',
      pluralLabel: 'Symphony updates',
      statusLabel: row.statusLabel,
      branchName: 'redux',
      sourceBranchName: 'redux/actions',
      color: ACTION_COLOR,
      isMainline: false,
    };
  }
  if (row.kind === 'app-action-squash') {
    return {
      key: 'app-actions',
      title: 'App actions',
      singularLabel: 'app action group',
      pluralLabel: 'app action groups',
      statusLabel: row.statusLabel,
      branchName: 'redux',
      sourceBranchName: 'redux/actions',
      color: ACTION_COLOR,
      isMainline: false,
    };
  }
  return null;
}

function createHistoryRollupRow(
  rows: WorkspaceHistoryRow[],
  definition: WorkspaceHistoryRollupDefinition,
): WorkspaceHistoryRow {
  const first = rows[0];
  const last = rows[rows.length - 1];
  const detailRows = buildHistoryRollupDetailRows(rows);
  const currentRow = rows.find((row) => row.isCurrent);
  return {
    id: `history-rollup:${definition.key}:${first.id}:${last.id}`,
    kind: 'history-rollup',
    title: definition.title,
    summary: buildHistoryRollupSummary(rows, definition),
    branchId: definition.branchName,
    branchName: definition.branchName,
    sourceBranchName: definition.sourceBranchName,
    color: definition.color,
    timestamp: first.timestamp,
    parentIds: [],
    statusLabel: currentRow ? 'current' : definition.statusLabel,
    isMainline: definition.isMainline,
    isCurrent: Boolean(currentRow),
    stateCursorActionId: currentRow?.stateCursorActionId ?? rows[0].stateCursorActionId,
    target: buildHistoryRollupTarget(rows),
    detailCount: rows.reduce((total, row) => total + row.detailCount, 0),
    detailRows,
    children: rows,
  };
}

function buildHistoryRollupSummary(
  rows: WorkspaceHistoryRow[],
  definition: WorkspaceHistoryRollupDefinition,
): string {
  const label = rows.length === 1 ? definition.singularLabel : definition.pluralLabel;
  const detailCount = rows.reduce((total, row) => total + row.detailCount, 0);
  const detailLabel = detailCount === 1 ? 'detail' : 'details';
  if (!detailCount) {
    return `${rows.length} ${label} rolled up.`;
  }
  return `${rows.length} ${label} rolled up with ${detailCount} ${detailLabel}.`;
}

function buildHistoryRollupDetailRows(rows: WorkspaceHistoryRow[]): WorkspaceHistoryDetailRow[] {
  return rows.flatMap((row) => [
    {
      id: `history-rollup-detail:${row.id}:node`,
      kind: 'commit' as const,
      label: row.title,
      branchName: row.sourceBranchName,
      timestamp: row.timestamp,
    },
    ...row.detailRows.map((detail) => ({
      ...detail,
      id: `history-rollup-detail:${row.id}:${detail.id}`,
    })),
  ]);
}

function buildHistoryRollupTarget(rows: WorkspaceHistoryRow[]): WorkspaceHistoryTarget | undefined {
  const appStateTargets = rows
    .map((row) => row.target)
    .filter((target): target is Extract<WorkspaceHistoryTarget, { kind: 'app-state' }> => target?.kind === 'app-state');
  if (!appStateTargets.length) return undefined;
  return {
    kind: 'app-state',
    actionIds: uniqueStrings(appStateTargets.flatMap((target) => target.actionIds)),
    cursorActionId: appStateTargets.find((target) => target.cursorActionId)?.cursorActionId ?? null,
  };
}

function isVisibleSquashMergeRow(row: WorkspaceHistoryRow): boolean {
  return row.kind === 'session-squash'
    || row.kind === 'branch-squash'
    || (row.kind === 'history-rollup' && row.statusLabel === 'squash');
}

function buildWorkspaceActionRows({
  workspaceId,
  actionHistoryState,
}: {
  workspaceId: string;
  actionHistoryState: WorkspaceActionHistoryState;
}): WorkspaceHistoryRow[] {
  return buildWorkspaceActionTimeline(actionHistoryState, workspaceId).map((node) => createTimelineRow({
    id: node.id,
    kind: 'app-action-squash',
    title: node.title,
    summary: node.summary,
    statusLabel: node.isCurrent ? 'current' : 'state',
    timestamp: parseTimestamp(node.updatedAt),
    branchName: 'redux',
    sourceBranchName: 'redux/actions',
    color: ACTION_COLOR,
    isCurrent: node.isCurrent,
    stateCursorActionId: node.cursorActionId,
    target: {
      kind: 'app-state',
      actionIds: node.actionIds,
      cursorActionId: node.cursorActionId,
    },
    detailRows: node.detailRows.map((detail) => ({
      id: detail.id,
      kind: 'commit' as const,
      label: detail.label,
      branchName: 'redux/actions',
      timestamp: detail.timestamp,
    })),
  }));
}

function buildSessionSquashRows({
  workspaceId,
  sessionNames,
  chapterState,
}: {
  workspaceId: string;
  sessionNames: Map<string, string>;
  chapterState: ChapteredSessionState;
}): WorkspaceHistoryRow[] {
  return Object.values(chapterState.sessions)
    .filter((session) => session.workspaceId === workspaceId)
    .flatMap((session) => session.chapters.map((chapter) => {
      const sessionName = sessionNames.get(session.sessionId) ?? session.sessionId;
      return createMainlineRow({
        id: `session-squash:${chapter.id}`,
        kind: 'session-squash',
        title: `Squash merge: ${sessionName}`,
        summary: chapter.compressedContext.summary,
        statusLabel: 'squash',
        timestamp: parseTimestamp(chapter.updatedAt || chapter.startedAt),
        sourceBranchName: `session/${slugify(sessionName)}`,
        target: {
          kind: 'chat-session',
          sessionId: session.sessionId,
          chapterId: chapter.id,
          messageIds: chapter.messageIds,
        },
        detailRows: buildSessionDetailRows(chapter, `session/${slugify(sessionName)}`),
      });
    }));
}

function buildConversationBranchSquashRows({
  workspaceId,
  conversationBranchingState,
}: {
  workspaceId: string;
  conversationBranchingState: ConversationBranchingState;
}): WorkspaceHistoryRow[] {
  if (!conversationBranchingState.enabled || conversationBranchingState.workspaceId !== workspaceId) {
    return [];
  }
  return conversationBranchingState.subthreads
    .map((subthread) => {
      const mergeCommit = findMergeCommit(conversationBranchingState, subthread);
      const detailCommits = getConversationBranchAncestry(conversationBranchingState.commits, subthread)
        .filter((commit) => commit.id !== mergeCommit?.id);
      const detailRows = detailCommits.map((commit) => ({
        id: `branch-detail:${commit.id}`,
        kind: 'commit' as const,
        label: commit.summary,
        branchName: subthread.branchName,
        timestamp: parseTimestamp(commit.createdAt),
      }));
      if (subthread.status === 'merged') {
        return createMainlineRow({
          id: `branch-squash:${mergeCommit?.id ?? subthread.id}`,
          kind: 'branch-squash',
          title: `Squash merge: ${subthread.title}`,
          summary: mergeCommit?.summary ?? subthread.summary,
          statusLabel: 'squash',
          timestamp: parseTimestamp(mergeCommit?.createdAt ?? subthread.updatedAt),
          sourceBranchName: subthread.branchName,
          target: {
            kind: 'branch-history',
            branchId: subthread.id,
            sessionId: subthread.sessionId,
            commitIds: detailCommits.map((commit) => commit.id),
          },
          detailRows,
        });
      }
      return createTimelineRow({
        id: `conversation-branch:${subthread.id}`,
        kind: 'conversation-branch',
        title: subthread.title,
        summary: subthread.summary,
        statusLabel: subthread.status,
        timestamp: parseTimestamp(subthread.updatedAt),
        branchName: subthread.branchName,
        sourceBranchName: subthread.branchName,
        color: MAIN_COLOR,
        target: {
          kind: 'branch-history',
          branchId: subthread.id,
          sessionId: subthread.sessionId,
          commitIds: detailCommits.map((commit) => commit.id),
        },
        detailRows,
      });
    });
}

function buildWorkspaceFileRows({
  workspaceId,
  fileHistories,
}: {
  workspaceId: string;
  fileHistories: WorkspaceFileCrdtHistory[];
}): WorkspaceHistoryRow[] {
  return fileHistories
    .filter((history) => history.workspaceId === workspaceId)
    .flatMap((history) => orderFileOperations(history.operations).map((operation) => createTimelineRow({
      id: `file-change:${operation.id}`,
      kind: 'file-change',
      title: `File change: ${history.path}`,
      summary: summarizeFileOperation(history.path, operation),
      statusLabel: 'diff',
      timestamp: parseTimestamp(operation.createdAt),
      branchName: 'files',
      sourceBranchName: `file/${slugify(history.path)}`,
      color: FILE_COLOR,
      target: {
        kind: 'file-version',
        workspaceId,
        filePath: history.path,
        opId: operation.id,
      },
      detailRows: [{
        id: `file-diff:${operation.id}`,
        kind: 'file-diff',
        label: formatFilePatchLabel(operation),
        branchName: `file/${slugify(history.path)}`,
        timestamp: parseTimestamp(operation.createdAt),
      }],
    })));
}

function buildCheckpointRows({
  workspaceId,
  sessionNames,
  runCheckpointState,
}: {
  workspaceId: string;
  sessionNames: Map<string, string>;
  runCheckpointState: RunCheckpointState;
}): WorkspaceHistoryRow[] {
  return runCheckpointState.checkpoints
    .filter((checkpoint) => checkpoint.workspaceId === workspaceId)
    .map((checkpoint) => {
      const branchName = `checkpoint/${slugify(sessionNames.get(checkpoint.sessionId) ?? checkpoint.sessionId)}`;
      return createTimelineRow({
        id: `checkpoint:${checkpoint.id}`,
        kind: 'checkpoint',
        title: checkpoint.summary,
        summary: `${checkpoint.reason} checkpoint ${checkpoint.status}: ${checkpoint.requiredInput}`,
        statusLabel: checkpoint.status,
        timestamp: parseTimestamp(checkpoint.updatedAt || checkpoint.createdAt),
        branchName,
        sourceBranchName: branchName,
        color: CHECKPOINT_COLOR,
        detailRows: buildCheckpointDetails(checkpoint, runCheckpointState.audit, branchName),
      });
    });
}

function buildBrowserAgentRunRows({
  workspaceId,
  sessionNames,
  browserAgentRunSdkState,
}: {
  workspaceId: string;
  sessionNames: Map<string, string>;
  browserAgentRunSdkState: BrowserAgentRunSdkState;
}): WorkspaceHistoryRow[] {
  return browserAgentRunSdkState.runs
    .filter((run) => run.workspaceId === workspaceId)
    .map((run) => {
      const branchName = `run/${slugify(sessionNames.get(run.sessionId) ?? run.sessionId)}`;
      return createTimelineRow({
        id: `browser-agent-run:${run.id}`,
        kind: 'browser-agent-run',
        title: run.title,
        summary: run.prompt,
        statusLabel: run.status,
        timestamp: parseTimestamp(run.updatedAt || run.createdAt),
        branchName,
        sourceBranchName: branchName,
        color: RUN_COLOR,
        detailRows: buildRunDetails(run, browserAgentRunSdkState.events, branchName),
      });
    });
}

function buildAutomationRows({
  scheduledAutomationState,
}: {
  scheduledAutomationState: ScheduledAutomationState;
}): WorkspaceHistoryRow[] {
  return scheduledAutomationState.automations.map((automation) => createTimelineRow({
    id: `automation:${automation.id}`,
    kind: 'automation',
    title: automation.title,
    summary: automation.prompt,
    statusLabel: automation.enabled ? automation.cadence : 'paused',
    timestamp: parseTimestamp(automation.nextRunAt ?? automation.updatedAt),
    branchName: 'automation',
    sourceBranchName: 'automation',
    color: AUTOMATION_COLOR,
    detailRows: buildAutomationDetails(automation, scheduledAutomationState.runs, scheduledAutomationState.inbox),
  }));
}

function buildRecentActivityRows(recentActivity: WorkspaceHistoryRecentActivityInput[]): WorkspaceHistoryRow[] {
  return recentActivity.map((activity, index) => createTimelineRow({
    id: `recent-activity:${activity.id}`,
    kind: 'recent-activity',
    title: activity.title,
    summary: activity.preview,
    statusLabel: activity.date,
    timestamp: parseFriendlyTimestamp(activity.date, index),
    branchName: 'activity',
    sourceBranchName: 'activity',
    color: ACTIVITY_COLOR,
    detailRows: activity.events.map((event, eventIndex) => ({
      id: `recent-activity:${activity.id}:event:${eventIndex}`,
      kind: 'commit',
      label: event,
      branchName: 'activity',
      timestamp: parseFriendlyTimestamp(activity.date, index) + eventIndex,
    })),
  }));
}

function createMainlineRow(input: {
  id: string;
  kind: WorkspaceHistoryRowKind;
  title: string;
  summary: string;
  statusLabel: string;
  timestamp: number;
  sourceBranchName: string;
  target?: WorkspaceHistoryTarget;
  detailRows: WorkspaceHistoryDetailRow[];
}): WorkspaceHistoryRow {
  return {
    id: input.id,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    branchId: 'main',
    branchName: 'main',
    sourceBranchName: input.sourceBranchName,
    color: MAIN_COLOR,
    timestamp: input.timestamp,
    parentIds: [],
    statusLabel: input.statusLabel,
    isMainline: true,
    target: input.target,
    detailCount: input.detailRows.length,
    detailRows: input.detailRows,
  };
}

function createTimelineRow(input: {
  id: string;
  kind: WorkspaceHistoryRowKind;
  title: string;
  summary: string;
  statusLabel: string;
  timestamp: number;
  branchName: string;
  sourceBranchName: string;
  color: string;
  isCurrent?: boolean;
  stateCursorActionId?: string | null;
  target?: WorkspaceHistoryTarget;
  detailRows: WorkspaceHistoryDetailRow[];
}): WorkspaceHistoryRow {
  return {
    id: input.id,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    branchId: input.branchName,
    branchName: input.branchName,
    sourceBranchName: input.sourceBranchName,
    color: input.color,
    timestamp: input.timestamp,
    parentIds: [],
    statusLabel: input.statusLabel,
    isMainline: input.branchName === 'main',
    isCurrent: input.isCurrent,
    stateCursorActionId: input.stateCursorActionId,
    target: input.target,
    detailCount: input.detailRows.length,
    detailRows: input.detailRows,
  };
}

function buildSessionDetailRows(chapter: SessionChapter, branchName: string): WorkspaceHistoryDetailRow[] {
  const labels = uniqueStrings([
    ...(chapter.sourceTraceRefs.length ? chapter.sourceTraceRefs : chapter.messageIds.map((id) => `message:${id}`)),
    ...chapter.evidenceRefs,
    ...chapter.validationRefs,
    ...chapter.toolOutputRefs,
  ]);
  return labels.map((label, index) => ({
    id: `${chapter.id}:detail:${index}`,
    kind: classifyDetailRef(label),
    label,
    branchName,
    timestamp: parseTimestamp(chapter.startedAt) + index,
  }));
}

function buildCheckpointDetails(
  checkpoint: RunCheckpoint,
  audit: RunCheckpointAuditEntry[],
  branchName: string,
): WorkspaceHistoryDetailRow[] {
  const detailLabels = [
    `boundary: ${checkpoint.boundary}`,
    `required input: ${checkpoint.requiredInput}`,
    `resume token: ${checkpoint.resumeToken}`,
    ...checkpoint.artifacts.map((artifact) => `artifact: ${artifact}`),
    ...audit
      .filter((entry) => entry.checkpointId === checkpoint.id)
      .map((entry) => entry.summary),
  ];
  return detailLabels.map((label, index) => ({
    id: `${checkpoint.id}:detail:${index}`,
    kind: 'commit',
    label,
    branchName,
    timestamp: parseTimestamp(checkpoint.createdAt) + index,
  }));
}

function buildRunDetails(
  run: BrowserAgentRun,
  events: BrowserAgentRunEvent[],
  branchName: string,
): WorkspaceHistoryDetailRow[] {
  return events
    .filter((event) => event.runId === run.id)
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => ({
      id: `browser-agent-run:${event.id}`,
      kind: 'commit' as const,
      label: event.summary,
      branchName,
      timestamp: parseTimestamp(event.createdAt),
    }));
}

function buildAutomationDetails(
  automation: ScheduledAutomation,
  runs: ScheduledAutomationRun[],
  inbox: ScheduledAutomationInboxItem[],
): WorkspaceHistoryDetailRow[] {
  const runDetails = runs
    .filter((run) => run.automationId === automation.id)
    .map((run) => ({
      id: `automation-run:${run.id}`,
      kind: 'commit' as const,
      label: run.summary,
      branchName: 'automation',
      timestamp: parseTimestamp(run.completedAt),
    }));
  const inboxDetails = inbox
    .filter((item) => item.automationId === automation.id)
    .map((item) => ({
      id: `automation-inbox:${item.id}`,
      kind: 'commit' as const,
      label: item.summary,
      branchName: 'automation',
      timestamp: parseTimestamp(item.createdAt),
    }));
  if (runDetails.length || inboxDetails.length) return [...runDetails, ...inboxDetails];
  return [{
    id: `automation:${automation.id}:next-run`,
    kind: 'commit',
    label: automation.nextRunAt ? `next run: ${automation.nextRunAt}` : 'no scheduled run',
    branchName: 'automation',
    timestamp: parseTimestamp(automation.nextRunAt ?? automation.updatedAt),
  }];
}

function findMergeCommit(
  state: ConversationBranchingState,
  subthread: ConversationSubthread,
): ConversationBranchCommit | null {
  return Object.values(state.commits)
    .filter((commit) => (
      commit.branchId === 'main'
      && Boolean(subthread.lastMergedCommitId)
      && commit.parentIds.includes(subthread.lastMergedCommitId!)
    ))
    .sort((left, right) => parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt))[0] ?? null;
}

function getConversationBranchAncestry(
  commits: Record<string, ConversationBranchCommit>,
  subthread: ConversationSubthread,
): ConversationBranchCommit[] {
  const startId = subthread.lastMergedCommitId ?? subthread.headCommitId;
  const visited = new Set<string>();
  const ancestry: ConversationBranchCommit[] = [];
  const visit = (commitId: string) => {
    if (visited.has(commitId)) return;
    visited.add(commitId);
    const commit = commits[commitId];
    if (!commit) return;
    for (const parentId of commit.parentIds) visit(parentId);
    ancestry.push(commit);
  };
  visit(startId);
  return ancestry.sort((left, right) => parseTimestamp(left.createdAt) - parseTimestamp(right.createdAt) || left.id.localeCompare(right.id));
}

function classifyDetailRef(label: string): WorkspaceHistoryDetailKind {
  if (label.startsWith('message:')) return 'message';
  if (label.startsWith('process:')) return 'process';
  if (label.startsWith('evidence:')) return 'evidence';
  if (label.startsWith('validation:')) return 'validation';
  if (label.startsWith('tool-output:')) return 'tool-output';
  return 'commit';
}

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseFriendlyTimestamp(value: string, fallbackIndex: number): number {
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return parsed;
  return fallbackIndex + 1;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function orderFileOperations(operations: WorkspaceFileCrdtOperation[]): WorkspaceFileCrdtOperation[] {
  return [...operations].sort((left, right) => (
    parseTimestamp(left.createdAt) - parseTimestamp(right.createdAt)
    || left.sequence - right.sequence
    || left.actorId.localeCompare(right.actorId)
    || left.id.localeCompare(right.id)
  ));
}

function summarizeFileOperation(path: string, operation: WorkspaceFileCrdtOperation): string {
  return `${operation.actorId} changed ${path} with ${operation.insertText.length} inserted and ${operation.deleteCount} removed characters.`;
}

function formatFilePatchLabel(operation: WorkspaceFileCrdtOperation): string {
  return `${operation.actorId} patch: +${operation.insertText.length} -${operation.deleteCount} at ${operation.index}`;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'session';
}
