import { describe, expect, it } from 'vitest';
import {
  appendWorkspaceFileCrdtDiff,
  captureWorkspaceFileCrdtSnapshot,
  createWorkspaceFileCrdtHistory,
  isWorkspaceFileCrdtHistoriesByWorkspace,
  materializeWorkspaceFileVersion,
  mergeWorkspaceFileCrdtHistories,
  recordWorkspaceFileCrdtChanges,
} from './workspaceFileCrdtHistory';

describe('workspace file CRDT history', () => {
  it('stores file changes as CRDT diffs instead of exact per-version file copies', () => {
    const initial = createWorkspaceFileCrdtHistory({
      workspaceId: 'ws-research',
      path: 'notes.md',
      content: 'alpha\nbeta\n',
      actorId: 'user',
      now: new Date('2026-05-09T19:00:00.000Z'),
    });

    const changed = appendWorkspaceFileCrdtDiff(initial, 'alpha\nbeta\ngamma\n', {
      actorId: 'codex',
      now: new Date('2026-05-09T19:01:00.000Z'),
    });

    expect(changed.snapshots).toHaveLength(1);
    expect(changed.snapshots[0].content).toBe('alpha\nbeta\n');
    expect(changed.operations).toHaveLength(1);
    expect(changed.operations[0]).toMatchObject({
      index: 'alpha\nbeta\n'.length,
      deleteCount: 0,
      deleteText: '',
      insertText: 'gamma\n',
      actorId: 'codex',
    });
    expect(changed.operations[0]).not.toHaveProperty('content');
  });

  it('materializes older versions by rewinding from the closest later snapshot', () => {
    const initial = createWorkspaceFileCrdtHistory({
      workspaceId: 'ws-research',
      path: 'agent.md',
      content: 'one',
      actorId: 'user',
      now: new Date('2026-05-09T19:00:00.000Z'),
    });
    const firstEdit = appendWorkspaceFileCrdtDiff(initial, 'one\ntwo', {
      actorId: 'agent-a',
      now: new Date('2026-05-09T19:01:00.000Z'),
    });
    const secondEdit = appendWorkspaceFileCrdtDiff(firstEdit, 'one\ntwo\nthree', {
      actorId: 'agent-a',
      now: new Date('2026-05-09T19:02:00.000Z'),
    });
    const snapshotted = captureWorkspaceFileCrdtSnapshot(secondEdit, {
      now: new Date('2026-05-09T19:03:00.000Z'),
    });

    const materialized = materializeWorkspaceFileVersion(snapshotted, firstEdit.headOpId);

    expect(materialized.content).toBe('one\ntwo');
    expect(materialized.direction).toBe('rewind');
    expect(materialized.sourceSnapshotId).toBe(snapshotted.snapshots[1].id);
    expect(materialized.replayedOperationIds).toEqual([secondEdit.headOpId]);
  });

  it('merges concurrent CRDT histories by unioning immutable operations', () => {
    const base = createWorkspaceFileCrdtHistory({
      workspaceId: 'ws-research',
      path: 'plan.md',
      content: 'base',
      actorId: 'user',
      now: new Date('2026-05-09T19:00:00.000Z'),
    });
    const userEdit = appendWorkspaceFileCrdtDiff(base, 'base\nuser', {
      actorId: 'user',
      now: new Date('2026-05-09T19:01:00.000Z'),
    });
    const agentEdit = appendWorkspaceFileCrdtDiff(base, 'base\nagent', {
      actorId: 'agent',
      now: new Date('2026-05-09T19:01:01.000Z'),
    });

    const userThenAgent = mergeWorkspaceFileCrdtHistories(userEdit, agentEdit);
    const agentThenUser = mergeWorkspaceFileCrdtHistories(agentEdit, userEdit);

    expect(userThenAgent.operations.map((operation) => operation.id).sort()).toEqual(
      agentThenUser.operations.map((operation) => operation.id).sort(),
    );
    expect(mergeWorkspaceFileCrdtHistories(userThenAgent, userThenAgent).operations).toHaveLength(2);
  });

  it('records current workspace file updates into durable CRDT history state', () => {
    const first = recordWorkspaceFileCrdtChanges({}, 'ws-research', [{
      path: 'memory.md',
      content: '# Memory\n',
      updatedAt: '2026-05-09T19:00:00.000Z',
    }], {
      actorId: 'agent-browser',
      now: new Date('2026-05-09T19:00:00.000Z'),
    });
    const second = recordWorkspaceFileCrdtChanges(first, 'ws-research', [{
      path: 'memory.md',
      content: '# Memory\n\n- Fact\n',
      updatedAt: '2026-05-09T19:01:00.000Z',
    }], {
      actorId: 'agent-browser',
      now: new Date('2026-05-09T19:01:00.000Z'),
    });

    const history = second['ws-research']['memory.md'];

    expect(isWorkspaceFileCrdtHistoriesByWorkspace(second)).toBe(true);
    expect(history.operations).toHaveLength(1);
    expect(materializeWorkspaceFileVersion(history).content).toBe('# Memory\n\n- Fact\n');
  });
});
