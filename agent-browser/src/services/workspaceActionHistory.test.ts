import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKSPACE_ACTION_HISTORY_STATE,
  buildWorkspaceActionTimeline,
  moveWorkspaceActionHistoryCursor,
  recordWorkspaceActionTransition,
  selectWorkspaceActionHistorySnapshot,
} from './workspaceActionHistory';

const baseSnapshot = {
  workspaceId: 'ws-research',
  workspaceName: 'Research',
  activePanel: 'workspaces',
  activeSessionIds: ['session-a'],
  openTabIds: [],
  mountedSessionFsIds: ['session-a'],
  sessionIds: ['session-a'],
  sessionNamesById: { 'session-a': 'Research Session' },
  conversationBranchIds: [],
  checkpointIds: [],
  browserAgentRunIds: [],
  scheduledAutomationIds: [],
  chapterIds: [],
  workspaceFileVersionIds: [],
};

describe('workspace action history', () => {
  it('records app state transitions with before and after snapshots for timeline navigation', () => {
    const nextSnapshot = {
      ...baseSnapshot,
      activePanel: 'history',
      activeSessionIds: ['session-b'],
      mountedSessionFsIds: ['session-a', 'session-b'],
      sessionIds: ['session-a', 'session-b'],
      sessionNamesById: {
        ...baseSnapshot.sessionNamesById,
        'session-b': 'Checkout Fix',
      },
    };

    const state = recordWorkspaceActionTransition(
      DEFAULT_WORKSPACE_ACTION_HISTORY_STATE,
      baseSnapshot,
      nextSnapshot,
      new Date('2026-05-09T18:00:00.000Z'),
    );

    expect(state.actions).toHaveLength(1);
    expect(state.cursorByWorkspace['ws-research']).toBe(state.actions[0].id);
    expect(state.actions[0]).toMatchObject({
      workspaceId: 'ws-research',
      label: 'Opened History and updated sessions',
      beforeSnapshot: baseSnapshot,
      afterSnapshot: nextSnapshot,
    });
    expect(state.actions[0].changedSlices).toEqual(expect.arrayContaining([
      'activePanel',
      'activeSessions',
      'mountedSessions',
      'sessions',
      'sessionNames',
    ]));
  });

  it('moves a per-workspace cursor backward and forward across stored snapshots', () => {
    const firstSnapshot = { ...baseSnapshot, activePanel: 'history' };
    const secondSnapshot = {
      ...firstSnapshot,
      conversationBranchIds: ['subthread:ws-research:checkout-proof'],
    };
    const withFirst = recordWorkspaceActionTransition(
      DEFAULT_WORKSPACE_ACTION_HISTORY_STATE,
      baseSnapshot,
      firstSnapshot,
      new Date('2026-05-09T18:00:00.000Z'),
    );
    const withSecond = recordWorkspaceActionTransition(
      withFirst,
      firstSnapshot,
      secondSnapshot,
      new Date('2026-05-09T18:01:00.000Z'),
    );

    const back = moveWorkspaceActionHistoryCursor(withSecond, 'ws-research', 'back');
    const backToBaseline = moveWorkspaceActionHistoryCursor(back, 'ws-research', 'back');
    const forward = moveWorkspaceActionHistoryCursor(backToBaseline, 'ws-research', 'forward');

    expect(selectWorkspaceActionHistorySnapshot(back, 'ws-research')).toEqual(firstSnapshot);
    expect(selectWorkspaceActionHistorySnapshot(backToBaseline, 'ws-research')).toEqual(baseSnapshot);
    expect(selectWorkspaceActionHistorySnapshot(forward, 'ws-research')).toEqual(firstSnapshot);
  });

  it('aggregates consecutive app actions into reducer-friendly timeline nodes', () => {
    const firstSnapshot = { ...baseSnapshot, activePanel: 'history' };
    const secondSnapshot = {
      ...firstSnapshot,
      activeSessionIds: ['session-b'],
      mountedSessionFsIds: ['session-a', 'session-b'],
      sessionIds: ['session-a', 'session-b'],
      sessionNamesById: {
        ...baseSnapshot.sessionNamesById,
        'session-b': 'Checkout Fix',
      },
    };
    const withFirst = recordWorkspaceActionTransition(
      DEFAULT_WORKSPACE_ACTION_HISTORY_STATE,
      baseSnapshot,
      firstSnapshot,
      new Date('2026-05-09T18:00:00.000Z'),
    );
    const withSecond = recordWorkspaceActionTransition(
      withFirst,
      firstSnapshot,
      secondSnapshot,
      new Date('2026-05-09T18:00:02.000Z'),
    );

    const timeline = buildWorkspaceActionTimeline(withSecond, 'ws-research');

    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({
      workspaceId: 'ws-research',
      title: 'App actions: Opened History',
      actionIds: withSecond.actions.map((action) => action.id),
      cursorActionId: withSecond.actions[1].id,
      actionCount: 2,
    });
    expect(timeline[0].detailRows.map((row) => row.label)).toEqual([
      'Opened History',
      'Updated active sessions and sessions',
    ]);
  });

  it('records CRDT file version heads as reducer-friendly workspace file actions', () => {
    const nextSnapshot = {
      ...baseSnapshot,
      workspaceFileVersionIds: ['notes.md:file-op-1'],
    };

    const state = recordWorkspaceActionTransition(
      DEFAULT_WORKSPACE_ACTION_HISTORY_STATE,
      baseSnapshot,
      nextSnapshot,
      new Date('2026-05-09T18:02:00.000Z'),
    );

    expect(state.actions[0]).toMatchObject({
      label: 'Updated workspace files',
      changedSlices: ['workspaceFiles'],
      afterSnapshot: nextSnapshot,
    });
  });
});
