import { describe, expect, it } from 'vitest';
import {
  SYMPHONY_HIDDEN_LANES,
  SYMPHONY_VISIBLE_LANES,
  advanceSymphonyTask,
  createDefaultSymphonyBoardState,
  createSymphonyTask,
  dispatchSymphonyTask,
  getSymphonyBoardMetrics,
  getSymphonyTasksByLane,
  isSymphonyBoardRecord,
  markSymphonyProofPassing,
  moveSymphonyTask,
  selectSymphonyTask,
  toggleSymphonyHiddenLanes,
  toggleSymphonyQueuePaused,
} from './board.js';

describe('symphonyBoard', () => {
  it('seeds the Symphony screenshot lanes and example issue cards', () => {
    const board = createDefaultSymphonyBoardState('Melbourne Transit App');

    expect(SYMPHONY_VISIBLE_LANES.map((lane) => lane.title)).toEqual([
      'Backlog',
      'Todo',
      'In Progress',
      'Human Review',
    ]);
    expect(SYMPHONY_HIDDEN_LANES.map((lane) => lane.title)).toEqual([
      'Rework',
      'Merging',
      'Done',
      'Canceled',
      'Duplicate',
    ]);
    expect(board.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        identifier: 'MT-891',
        title: 'Summarize feedback from Slack channels',
        lane: 'backlog',
      }),
      expect.objectContaining({
        identifier: 'MT-890',
        title: 'Upgrade to latest React version',
        lane: 'todo',
      }),
      expect.objectContaining({
        identifier: 'MT-889',
        title: 'Move to Vite',
        lane: 'in_progress',
      }),
    ]));
    expect(board.selectedTaskId).toBe('task-mt-891');
  });

  it('creates, dispatches, advances, and proves tasks without mutating the original board', () => {
    const board = createDefaultSymphonyBoardState('Melbourne Transit App');
    const [withTask, created] = createSymphonyTask(board, {
      title: 'Expose Symphony board in Agent Browser',
      description: 'Users can plan, dispatch, review, and merge agent tasks.',
      priority: 'high',
    }, '2026-05-02T16:00:00.000Z');

    expect(board.tasks).not.toContain(created);
    expect(created.identifier).toBe('MT-892');
    expect(created.lane).toBe('todo');
    expect(created.labels).toEqual([]);
    expect(withTask.selectedTaskId).toBe(created.id);

    const dispatched = dispatchSymphonyTask(withTask, created.id, {
      sessionId: 'session-42',
      sessionName: 'MT-892',
      workspacePath: 'C:/src/agent-harness',
    }, '2026-05-02T16:01:00.000Z');
    const runningTask = dispatched.tasks.find((task) => task.id === created.id);
    expect(runningTask).toEqual(expect.objectContaining({
      lane: 'in_progress',
      agent: expect.objectContaining({
        state: 'running',
        sessionId: 'session-42',
        lastAction: 'Opened MT-892 in MT-892',
      }),
    }));

    const review = advanceSymphonyTask(dispatched, created.id, '2026-05-02T16:02:00.000Z');
    const reviewedTask = review.tasks.find((task) => task.id === created.id);
    expect(reviewedTask?.lane).toBe('human_review');
    expect(reviewedTask?.agent.state).toBe('reviewing');

    const proofed = markSymphonyProofPassing(review, created.id, 'tests', '2026-05-02T16:03:00.000Z');
    const proofedTask = proofed.tasks.find((task) => task.id === created.id);
    expect(proofedTask?.proofs.find((proof) => proof.id === 'tests')?.status).toBe('passing');

    const moved = moveSymphonyTask(proofed, created.id, 'done', '2026-05-02T16:04:00.000Z');
    expect(moved.tasks.find((task) => task.id === created.id)?.lane).toBe('done');
    expect(markSymphonyProofPassing(board, 'missing-task', 'tests')).toBe(board);
  });

  it('uses default timestamps and dispatch metadata when optional inputs are omitted', () => {
    const board = createDefaultSymphonyBoardState('Melbourne Transit App');
    const [withTask, created] = createSymphonyTask(board, {
      title: '  Add workflow prompt loader  ',
      description: '  Load WORKFLOW.md through the plugin.  ',
      lane: 'backlog',
      labels: ['workflow'],
    });
    const dispatched = dispatchSymphonyTask(withTask, created.id);
    const runningTask = dispatched.tasks.find((task) => task.id === created.id);

    expect(created.title).toBe('Add workflow prompt loader');
    expect(created.description).toBe('Load WORKFLOW.md through the plugin.');
    expect(created.lane).toBe('backlog');
    expect(created.priority).toBe('normal');
    expect(runningTask?.agent.sessionName).toBe(created.identifier);
    expect(runningTask?.agent.sessionId).toBeUndefined();
  });

  it('selects, toggles, and ignores unknown task ids without mutating persisted board shape', () => {
    const board = createDefaultSymphonyBoardState('Melbourne Transit App');
    const cleared = selectSymphonyTask(board, null);
    const selected = selectSymphonyTask(cleared, 'task-mt-890');
    const unknown = selectSymphonyTask(selected, 'missing-task');
    const expanded = toggleSymphonyHiddenLanes(unknown);
    const paused = toggleSymphonyQueuePaused(expanded);

    expect(cleared.selectedTaskId).toBeNull();
    expect(selected.selectedTaskId).toBe('task-mt-890');
    expect(unknown).toBe(selected);
    expect(expanded.hiddenLanesExpanded).toBe(true);
    expect(paused.paused).toBe(true);
  });

  it('maps every lane to the expected agent state and leaves missing task updates untouched', () => {
    const board = createDefaultSymphonyBoardState('Melbourne Transit App');

    expect(moveSymphonyTask(board, 'missing-task', 'done')).toBe(board);
    expect(advanceSymphonyTask(board, 'missing-task')).toBe(board);
    expect(moveSymphonyTask(board, 'task-mt-891', 'todo').tasks.find((task) => task.id === 'task-mt-891')?.agent.state).toBe('assigned');
    expect(moveSymphonyTask(board, 'task-mt-891', 'backlog').tasks.find((task) => task.id === 'task-mt-891')?.agent.state).toBe('idle');
    expect(moveSymphonyTask(board, 'task-mt-891', 'in_progress').tasks.find((task) => task.id === 'task-mt-891')?.agent.state).toBe('running');
    expect(moveSymphonyTask(board, 'task-mt-891', 'human_review').tasks.find((task) => task.id === 'task-mt-891')?.agent.state).toBe('reviewing');
    expect(moveSymphonyTask(board, 'task-mt-891', 'rework').tasks.find((task) => task.id === 'task-mt-891')?.agent.state).toBe('retrying');
    expect(moveSymphonyTask(board, 'task-mt-891', 'merging').tasks.find((task) => task.id === 'task-mt-891')?.agent.state).toBe('merging');
    expect(moveSymphonyTask(board, 'task-mt-891', 'done').tasks.find((task) => task.id === 'task-mt-891')?.agent.state).toBe('complete');
    expect(moveSymphonyTask(board, 'task-mt-891', 'canceled').tasks.find((task) => task.id === 'task-mt-891')?.agent.lastAction).toBe('Closed as canceled');
    expect(moveSymphonyTask(board, 'task-mt-891', 'duplicate').tasks.find((task) => task.id === 'task-mt-891')?.agent.lastAction).toBe('Closed as duplicate');

    const review = advanceSymphonyTask(moveSymphonyTask(board, 'task-mt-891', 'human_review'), 'task-mt-891');
    const merged = advanceSymphonyTask(review, 'task-mt-891');
    const alreadyDone = advanceSymphonyTask(merged, 'task-mt-891');
    const noOp = advanceSymphonyTask(moveSymphonyTask(board, 'task-mt-891', 'todo'), 'task-mt-891');

    expect(review.tasks.find((task) => task.id === 'task-mt-891')?.lane).toBe('merging');
    expect(merged.tasks.find((task) => task.id === 'task-mt-891')?.lane).toBe('done');
    expect(alreadyDone.tasks.find((task) => task.id === 'task-mt-891')?.lane).toBe('done');
    expect(noOp.tasks.find((task) => task.id === 'task-mt-891')?.lane).toBe('todo');
  });

  it('computes board metrics and validates persisted workspace records', () => {
    const board = createDefaultSymphonyBoardState('Melbourne Transit App');
    const metrics = getSymphonyBoardMetrics(board);

    expect(metrics).toEqual(expect.objectContaining({
      activeAgents: 1,
      humanReview: 1,
      queued: 2,
      totalTasks: 6,
    }));
    expect(getSymphonyTasksByLane(board, 'todo').map((task) => task.identifier)).toEqual(['MT-890']);
    expect(isSymphonyBoardRecord(null)).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': board })).toBe(true);
    expect(isSymphonyBoardRecord({ 'ws-research': null })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, selectedTaskId: null } })).toBe(true);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: null } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, selectedTaskId: 123 } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, nextIssueNumber: '892' } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, hiddenLanesExpanded: 'false' } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, paused: 'false' } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, maxConcurrentAgents: '3' } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [null] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], id: 123 }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], identifier: 123 }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], title: 123 }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], description: 123 }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], lane: 'unknown' }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], lane: 123 }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], priority: 'unknown' }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], priority: 123 }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], labels: [1] }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], agent: null }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], agent: { ...board.tasks[0].agent, id: 123 } }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], agent: { ...board.tasks[0].agent, name: 123 } }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], agent: { ...board.tasks[0].agent, state: 123 } }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], agent: { ...board.tasks[0].agent, state: 'unknown' } }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], agent: { ...board.tasks[0].agent, health: 123 } }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], agent: { ...board.tasks[0].agent, health: 'unknown' } }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], agent: { ...board.tasks[0].agent, lastAction: 123 } }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], agent: { ...board.tasks[0].agent, sessionId: 123 } }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], agent: { ...board.tasks[0].agent, sessionName: 123 } }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], agent: { ...board.tasks[0].agent, workspacePath: 123 } }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], agent: { ...board.tasks[0].agent, tokens: '0' } }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], agent: { ...board.tasks[0].agent, runtimeMinutes: '0' } }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], agent: { ...board.tasks[0].agent, retryCount: '0' } }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], proofs: null }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], proofs: [null] }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], proofs: [{ id: 123, label: 'tests', status: 'passing' }] }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], proofs: [{ id: 'tests', label: 123, status: 'passing' }] }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], proofs: [{ id: 'tests', label: 'tests', status: 123 }] }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], proofs: [{ id: 'tests', label: 'tests', status: 'unknown' }] }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], activity: null }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], activity: [null] }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], activity: [{ id: 123, kind: 'created', label: 'x', detail: 'x', at: 'x' }] }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], activity: [{ id: 'x', kind: 123, label: 'x', detail: 'x', at: 'x' }] }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], activity: [{ id: 'x', kind: 'unknown', label: 'x', detail: 'x', at: 'x' }] }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], activity: [{ id: 'x', kind: 'created', label: 123, detail: 'x', at: 'x' }] }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], activity: [{ id: 'x', kind: 'created', label: 'x', detail: 123, at: 'x' }] }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], activity: [{ id: 'x', kind: 'created', label: 'x', detail: 'x', at: 123 }] }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], createdAt: 123 }] } })).toBe(false);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, tasks: [{ ...board.tasks[0], updatedAt: 123 }] } })).toBe(false);
  });
});
