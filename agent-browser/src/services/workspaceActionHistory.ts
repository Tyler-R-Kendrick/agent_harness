export type WorkspaceActionHistoryDirection = 'back' | 'forward';

export interface WorkspaceActionSnapshot {
  workspaceId: string;
  workspaceName: string;
  activePanel: string;
  activeSessionIds: string[];
  openTabIds: string[];
  mountedSessionFsIds: string[];
  sessionIds: string[];
  sessionNamesById: Record<string, string>;
  conversationBranchIds: string[];
  checkpointIds: string[];
  browserAgentRunIds: string[];
  scheduledAutomationIds: string[];
  chapterIds: string[];
  workspaceFileVersionIds?: string[];
  symphonyEventSummaries?: string[];
  symphonySessionSummaries?: string[];
}

export interface WorkspaceActionHistoryAction {
  id: string;
  workspaceId: string;
  workspaceName: string;
  label: string;
  changedSlices: string[];
  beforeSnapshot: WorkspaceActionSnapshot;
  afterSnapshot: WorkspaceActionSnapshot;
  createdAt: string;
}

export interface WorkspaceActionHistoryState {
  version: 1;
  actions: WorkspaceActionHistoryAction[];
  cursorByWorkspace: Record<string, string | null>;
}

export interface WorkspaceActionTimelineDetailRow {
  id: string;
  label: string;
  timestamp: number;
  actionId: string;
}

export interface WorkspaceActionTimelineNode {
  id: string;
  workspaceId: string;
  title: string;
  summary: string;
  actionIds: string[];
  actionCount: number;
  cursorActionId: string | null;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
  detailRows: WorkspaceActionTimelineDetailRow[];
}

export const DEFAULT_WORKSPACE_ACTION_HISTORY_STATE: WorkspaceActionHistoryState = {
  version: 1,
  actions: [],
  cursorByWorkspace: {},
};

const TIMELINE_GROUP_WINDOW_MS = 5_000;
const MAX_ACTIONS = 250;

export function recordWorkspaceActionTransition(
  state: WorkspaceActionHistoryState,
  beforeSnapshot: WorkspaceActionSnapshot,
  afterSnapshot: WorkspaceActionSnapshot,
  now = new Date(),
): WorkspaceActionHistoryState {
  const changedSlices = getChangedSlices(beforeSnapshot, afterSnapshot);
  if (!changedSlices.length) return state;

  const workspaceId = afterSnapshot.workspaceId;
  const createdAt = now.toISOString();
  const action: WorkspaceActionHistoryAction = {
    id: buildActionId(workspaceId, createdAt, state.actions.length),
    workspaceId,
    workspaceName: afterSnapshot.workspaceName,
    label: buildActionLabel(changedSlices, beforeSnapshot, afterSnapshot),
    changedSlices,
    beforeSnapshot,
    afterSnapshot,
    createdAt,
  };

  const workspaceActions = state.actions.filter((candidate) => candidate.workspaceId === workspaceId);
  const latestWorkspaceAction = workspaceActions.at(-1) ?? null;
  const cursor = Object.prototype.hasOwnProperty.call(state.cursorByWorkspace, workspaceId)
    ? state.cursorByWorkspace[workspaceId]
    : latestWorkspaceAction?.id ?? null;
  const cursorIndex = cursor === null ? -1 : workspaceActions.findIndex((candidate) => candidate.id === cursor);
  const retainedWorkspaceActionIds = new Set(
    cursorIndex < 0 ? [] : workspaceActions.slice(0, cursorIndex + 1).map((candidate) => candidate.id),
  );
  const retainedActions = state.actions.filter((candidate) => (
    candidate.workspaceId !== workspaceId || retainedWorkspaceActionIds.has(candidate.id)
  ));
  const nextActions = [...retainedActions, action].slice(-MAX_ACTIONS);

  return {
    version: 1,
    actions: nextActions,
    cursorByWorkspace: {
      ...state.cursorByWorkspace,
      [workspaceId]: action.id,
    },
  };
}

export function moveWorkspaceActionHistoryCursor(
  state: WorkspaceActionHistoryState,
  workspaceId: string,
  direction: WorkspaceActionHistoryDirection,
): WorkspaceActionHistoryState {
  const actions = getWorkspaceActions(state, workspaceId);
  if (!actions.length) return state;
  const currentCursor = getCurrentCursor(state, workspaceId);
  const currentIndex = currentCursor === null
    ? -1
    : actions.findIndex((action) => action.id === currentCursor);
  const nextIndex = direction === 'back'
    ? Math.max(-1, currentIndex - 1)
    : Math.min(actions.length - 1, currentIndex + 1);
  const nextCursor = nextIndex < 0 ? null : actions[nextIndex].id;
  if (nextCursor === currentCursor) return state;
  return {
    ...state,
    cursorByWorkspace: {
      ...state.cursorByWorkspace,
      [workspaceId]: nextCursor,
    },
  };
}

export function selectWorkspaceActionHistorySnapshot(
  state: WorkspaceActionHistoryState,
  workspaceId: string,
): WorkspaceActionSnapshot | null {
  const actions = getWorkspaceActions(state, workspaceId);
  if (!actions.length) return null;
  const currentCursor = getCurrentCursor(state, workspaceId);
  if (currentCursor === null) return actions[0].beforeSnapshot;
  return actions.find((action) => action.id === currentCursor)?.afterSnapshot ?? actions.at(-1)?.afterSnapshot ?? null;
}

export function buildWorkspaceActionTimeline(
  state: WorkspaceActionHistoryState,
  workspaceId: string,
): WorkspaceActionTimelineNode[] {
  const actions = getWorkspaceActions(state, workspaceId);
  const currentCursor = getCurrentCursor(state, workspaceId);
  const groups: WorkspaceActionHistoryAction[][] = [];
  for (const action of actions) {
    const latestGroup = groups.at(-1);
    const latestAction = latestGroup?.at(-1);
    if (
      latestGroup
      && latestAction
      && Date.parse(action.createdAt) - Date.parse(latestAction.createdAt) <= TIMELINE_GROUP_WINDOW_MS
    ) {
      latestGroup.push(action);
    } else {
      groups.push([action]);
    }
  }

  return groups.map((group) => {
    const first = group[0];
    const last = group[group.length - 1];
    const symphonyActions = group.filter(isSymphonyAction);
    return {
      id: `app-actions:${first.id}:${last.id}`,
      workspaceId,
      title: symphonyActions.length
        ? `Symphony activity: ${symphonyActions[0].label}`
        : `App actions: ${first.label}`,
      summary: symphonyActions.length
        ? buildSymphonyTimelineSummary(group.length, symphonyActions.length, last.workspaceName)
        : `${group.length} app action${group.length === 1 ? '' : 's'} captured for ${last.workspaceName}.`,
      actionIds: group.map((action) => action.id),
      actionCount: group.length,
      cursorActionId: last.id,
      isCurrent: currentCursor === null
        ? false
        : group.some((action) => action.id === currentCursor),
      createdAt: first.createdAt,
      updatedAt: last.createdAt,
      detailRows: group.flatMap(buildActionTimelineDetailRows),
    };
  });
}

export function isWorkspaceActionHistoryState(value: unknown): value is WorkspaceActionHistoryState {
  return (
    isRecord(value)
    && value.version === 1
    && Array.isArray(value.actions)
    && value.actions.every(isWorkspaceActionHistoryAction)
    && isRecord(value.cursorByWorkspace)
    && Object.values(value.cursorByWorkspace).every((entry) => entry === null || typeof entry === 'string')
  );
}

function getWorkspaceActions(state: WorkspaceActionHistoryState, workspaceId: string): WorkspaceActionHistoryAction[] {
  return state.actions
    .filter((action) => action.workspaceId === workspaceId)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.id.localeCompare(right.id));
}

function getCurrentCursor(state: WorkspaceActionHistoryState, workspaceId: string): string | null {
  if (Object.prototype.hasOwnProperty.call(state.cursorByWorkspace, workspaceId)) {
    return state.cursorByWorkspace[workspaceId];
  }
  return getWorkspaceActions(state, workspaceId).at(-1)?.id ?? null;
}

function getChangedSlices(beforeSnapshot: WorkspaceActionSnapshot, afterSnapshot: WorkspaceActionSnapshot): string[] {
  const checks: Array<[string, unknown, unknown]> = [
    ['activeWorkspace', beforeSnapshot.workspaceId, afterSnapshot.workspaceId],
    ['activePanel', beforeSnapshot.activePanel, afterSnapshot.activePanel],
    ['activeSessions', beforeSnapshot.activeSessionIds, afterSnapshot.activeSessionIds],
    ['browserTabs', beforeSnapshot.openTabIds, afterSnapshot.openTabIds],
    ['mountedSessions', beforeSnapshot.mountedSessionFsIds, afterSnapshot.mountedSessionFsIds],
    ['sessions', beforeSnapshot.sessionIds, afterSnapshot.sessionIds],
    ['sessionNames', beforeSnapshot.sessionNamesById, afterSnapshot.sessionNamesById],
    ['conversationBranches', beforeSnapshot.conversationBranchIds, afterSnapshot.conversationBranchIds],
    ['checkpoints', beforeSnapshot.checkpointIds, afterSnapshot.checkpointIds],
    ['browserAgentRuns', beforeSnapshot.browserAgentRunIds, afterSnapshot.browserAgentRunIds],
    ['scheduledAutomations', beforeSnapshot.scheduledAutomationIds, afterSnapshot.scheduledAutomationIds],
    ['chapters', beforeSnapshot.chapterIds, afterSnapshot.chapterIds],
    ['workspaceFiles', beforeSnapshot.workspaceFileVersionIds ?? [], afterSnapshot.workspaceFileVersionIds ?? []],
    ['symphonyEvents', beforeSnapshot.symphonyEventSummaries ?? [], afterSnapshot.symphonyEventSummaries ?? []],
    ['symphonySessions', beforeSnapshot.symphonySessionSummaries ?? [], afterSnapshot.symphonySessionSummaries ?? []],
  ];
  return checks
    .filter(([, before, after]) => !jsonEquals(before, after))
    .map(([slice]) => slice);
}

function buildActionLabel(
  changedSlices: string[],
  beforeSnapshot: WorkspaceActionSnapshot,
  afterSnapshot: WorkspaceActionSnapshot,
): string {
  const phrases: string[] = [];
  if (changedSlices.includes('activeWorkspace')) {
    phrases.push(`Switched to ${afterSnapshot.workspaceName}`);
  }
  if (changedSlices.includes('activePanel')) {
    phrases.push(`Opened ${formatPanelName(afterSnapshot.activePanel)}`);
  }

  const sessionSlices = changedSlices.filter((slice) => (
    slice === 'activeSessions' || slice === 'mountedSessions' || slice === 'sessions' || slice === 'sessionNames'
  ));
  if (sessionSlices.length) {
    if (changedSlices.includes('activePanel')) {
      phrases.push('updated sessions');
    } else {
      const sessionLabels = [
        sessionSlices.includes('activeSessions') ? 'active sessions' : '',
        sessionSlices.some((slice) => slice === 'mountedSessions' || slice === 'sessions' || slice === 'sessionNames')
          ? 'sessions'
          : '',
      ].filter(Boolean);
      phrases.push(`updated ${joinWords(sessionLabels)}`);
    }
  }

  const runSlices = changedSlices.filter((slice) => (
    slice === 'checkpoints' || slice === 'browserAgentRuns' || slice === 'chapters'
  ));
  if (runSlices.length) {
    phrases.push('updated run state');
  }
  if (changedSlices.includes('conversationBranches')) {
    phrases.push('updated conversation branches');
  }
  if (changedSlices.includes('browserTabs')) {
    phrases.push('updated browser tabs');
  }
  if (changedSlices.includes('workspaceFiles')) {
    phrases.push('updated workspace files');
  }
  if (changedSlices.includes('scheduledAutomations')) {
    phrases.push('updated automations');
  }
  if (changedSlices.some(isSymphonySlice)) {
    phrases.push('updated Symphony');
  }
  if (!phrases.length) {
    return `Updated ${formatSliceName(changedSlices[0] ?? beforeSnapshot.workspaceName)}`;
  }
  return capitalize(joinWords(phrases));
}

function formatPanelName(panel: string): string {
  return panel
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map(capitalize)
    .join(' ') || 'Panel';
}

function formatSliceName(slice: string): string {
  if (slice === 'activeSessions') return 'active sessions';
  if (slice === 'mountedSessions') return 'mounted sessions';
  if (slice === 'sessionNames') return 'session names';
  if (slice === 'conversationBranches') return 'conversation branches';
  if (slice === 'browserTabs') return 'browser tabs';
  if (slice === 'browserAgentRuns') return 'browser-agent runs';
  if (slice === 'scheduledAutomations') return 'automations';
  if (slice === 'workspaceFiles') return 'workspace files';
  if (isSymphonySlice(slice)) return 'Symphony';
  return slice;
}

function buildActionTimelineDetailRows(action: WorkspaceActionHistoryAction): WorkspaceActionTimelineDetailRow[] {
  const labels = buildActionDetailLabels(action);
  return labels.map((label, index) => ({
    id: `app-action-detail:${action.id}:${index}`,
    label,
    timestamp: Date.parse(action.createdAt) + index,
    actionId: action.id,
  }));
}

function buildActionDetailLabels(action: WorkspaceActionHistoryAction): string[] {
  if (!isSymphonyAction(action)) return [action.label];

  const labels = [
    ...getNewStrings(action.beforeSnapshot.symphonyEventSummaries ?? [], action.afterSnapshot.symphonyEventSummaries ?? []),
    ...getNewStrings(action.beforeSnapshot.symphonySessionSummaries ?? [], action.afterSnapshot.symphonySessionSummaries ?? []),
  ];
  return uniqueStrings(labels).length ? uniqueStrings(labels) : [action.label];
}

function buildSymphonyTimelineSummary(groupActionCount: number, symphonyActionCount: number, workspaceName: string): string {
  if (groupActionCount === symphonyActionCount) {
    return `${symphonyActionCount} Symphony update${symphonyActionCount === 1 ? '' : 's'} rolled up for ${workspaceName}.`;
  }
  const appActionCount = groupActionCount - symphonyActionCount;
  return `${symphonyActionCount} Symphony update${symphonyActionCount === 1 ? '' : 's'} and ${appActionCount} app action${appActionCount === 1 ? '' : 's'} rolled up for ${workspaceName}.`;
}

function isSymphonyAction(action: WorkspaceActionHistoryAction): boolean {
  return action.changedSlices.some(isSymphonySlice);
}

function isSymphonySlice(slice: string): boolean {
  return slice === 'symphonyEvents' || slice === 'symphonySessions';
}

function getNewStrings(before: string[], after: string[]): string[] {
  const beforeSet = new Set(before);
  return after.filter((entry) => !beforeSet.has(entry));
}

function joinWords(values: string[]): string {
  if (values.length <= 1) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function capitalize(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function buildActionId(workspaceId: string, createdAt: string, index: number): string {
  return `action:${workspaceId}:${createdAt.replace(/[^0-9A-Za-z]+/g, '')}:${index + 1}`;
}

function jsonEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isWorkspaceActionHistoryAction(value: unknown): value is WorkspaceActionHistoryAction {
  return (
    isRecord(value)
    && typeof value.id === 'string'
    && typeof value.workspaceId === 'string'
    && typeof value.workspaceName === 'string'
    && typeof value.label === 'string'
    && Array.isArray(value.changedSlices)
    && value.changedSlices.every((entry) => typeof entry === 'string')
    && isWorkspaceActionSnapshot(value.beforeSnapshot)
    && isWorkspaceActionSnapshot(value.afterSnapshot)
    && typeof value.createdAt === 'string'
  );
}

function isWorkspaceActionSnapshot(value: unknown): value is WorkspaceActionSnapshot {
  return (
    isRecord(value)
    && typeof value.workspaceId === 'string'
    && typeof value.workspaceName === 'string'
    && typeof value.activePanel === 'string'
    && isStringArray(value.activeSessionIds)
    && isStringArray(value.openTabIds)
    && isStringArray(value.mountedSessionFsIds)
    && isStringArray(value.sessionIds)
    && isStringRecord(value.sessionNamesById)
    && isStringArray(value.conversationBranchIds)
    && isStringArray(value.checkpointIds)
    && isStringArray(value.browserAgentRunIds)
    && isStringArray(value.scheduledAutomationIds)
    && isStringArray(value.chapterIds)
    && (value.workspaceFileVersionIds === undefined || isStringArray(value.workspaceFileVersionIds))
    && (value.symphonyEventSummaries === undefined || isStringArray(value.symphonyEventSummaries))
    && (value.symphonySessionSummaries === undefined || isStringArray(value.symphonySessionSummaries))
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
