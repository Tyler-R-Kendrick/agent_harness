import { describe, expect, it } from 'vitest';
import {
  SYMPHONY_HIDDEN_LANES,
  SYMPHONY_VISIBLE_LANES,
  advanceSymphonyTask,
  createDefaultSymphonyBoardState,
  createSymphonyTask,
  dispatchSymphonyTask,
  getSymphonyBoardMetrics,
  isSymphonyBoardRecord,
  markSymphonyProofPassing,
  moveSymphonyTask,
} from './symphonyBoard';

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
    expect(isSymphonyBoardRecord({ 'ws-research': board })).toBe(true);
    expect(isSymphonyBoardRecord({ 'ws-research': { ...board, selectedTaskId: 123 } })).toBe(false);
  });
});
