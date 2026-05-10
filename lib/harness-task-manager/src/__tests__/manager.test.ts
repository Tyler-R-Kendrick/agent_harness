import { createDurableTaskRuntime, createMemoryDurableTaskStore } from '@agent-harness/browser-durable-tasks';
import { describe, expect, it } from 'vitest';
import {
  INTERNAL_TASK_STORE_CONFIG,
  createHarnessTaskManager,
  isHarnessManagedTask,
} from '../index.js';

describe('harness task manager', () => {
  function createManager() {
    let now = Date.parse('2026-05-09T18:00:00.000Z');
    const store = createMemoryDurableTaskStore();
    const runtime = createDurableTaskRuntime({
      store,
      lockOwner: 'task-manager-test',
      now: () => now,
    });
    const manager = createHarnessTaskManager({
      runtime,
      workspaceId: 'agent-browser',
      now: () => now,
    });
    return {
      runtime,
      manager,
      advance(ms: number) {
        now += ms;
      },
    };
  }

  it('creates internal durable tasks without Linear identifiers or transport state', async () => {
    const { runtime, manager } = createManager();

    const task = await manager.createTask({
      title: 'Redesign Symphony task surface',
      description: 'Make Symphony the main multi-agent task management surface.',
      priority: 'high',
      labels: ['symphony', 'review'],
    });
    const durable = await runtime.getTask(task.durableTaskId);

    expect(task).toMatchObject({
      identifier: 'HT-1',
      title: 'Redesign Symphony task surface',
      lane: 'ready',
      status: 'queued',
      stateUri: `${INTERNAL_TASK_STORE_CONFIG.uri}/tasks/${task.durableTaskId}`,
    });
    expect(durable).toMatchObject({
      type: 'harness.task',
      status: 'queued',
      metadata: {
        kind: 'harness-task',
        source: 'internal',
        workspaceId: 'agent-browser',
      },
    });
    expect(isHarnessManagedTask(task)).toBe(true);
    expect(JSON.stringify(await manager.snapshot())).not.toMatch(/linear/i);
  });

  it('moves tasks through isolated worktree execution, review, rejection, approval, and completion', async () => {
    const { manager, advance } = createManager();
    const task = await manager.createTask({
      title: 'Implement durable branch review',
      description: 'Require merge approval for isolated agent branches.',
    });

    advance(100);
    const running = await manager.dispatchToAgent(task.id, {
      agentId: 'frontend-agent',
      role: 'frontend',
      worktreeBranch: 'agent/frontend-1',
      worktreePath: '.symphony/workspaces/frontend-1',
    });
    expect(running).toMatchObject({
      lane: 'running',
      status: 'running',
      assignee: {
        agentId: 'frontend-agent',
        worktreeBranch: 'agent/frontend-1',
      },
    });

    advance(100);
    const review = await manager.requestReview(task.id, {
      requesterAgentId: 'frontend-agent',
      summary: 'Ready to merge isolated branch.',
      changedFiles: ['agent-browser/src/App.tsx'],
    });
    expect(review).toMatchObject({
      lane: 'review',
      status: 'waiting',
      review: {
        status: 'requested',
        changedFiles: ['agent-browser/src/App.tsx'],
      },
    });

    await expect(manager.rejectMerge(task.id, {
      actor: { type: 'reviewer-agent', id: 'reviewer-1' },
      feedback: [],
    })).rejects.toThrow('Reviewer agent rejections require actionable feedback');

    const rejected = await manager.rejectMerge(task.id, {
      actor: { type: 'reviewer-agent', id: 'reviewer-1' },
      feedback: ['Add regression coverage for reviewer-agent feedback before merge.'],
    });
    expect(rejected).toMatchObject({
      lane: 'rework',
      review: {
        status: 'rejected',
        feedback: ['Add regression coverage for reviewer-agent feedback before merge.'],
      },
    });

    await manager.requestReview(task.id, {
      requesterAgentId: 'frontend-agent',
      summary: 'Rework complete.',
      changedFiles: ['agent-browser/src/App.tsx', 'agent-browser/src/App.test.tsx'],
    });
    const approved = await manager.approveMerge(task.id, {
      actor: { type: 'reviewer-agent', id: 'reviewer-1' },
      summary: 'Critical review passed.',
    });
    expect(approved).toMatchObject({
      lane: 'merge',
      review: {
        status: 'approved',
        approvedBy: { type: 'reviewer-agent', id: 'reviewer-1' },
      },
    });

    const completed = await manager.completeTask(task.id, { mergedBy: 'merge-agent' });
    expect(completed).toMatchObject({
      lane: 'done',
      status: 'completed',
      merge: { mergedBy: 'merge-agent' },
    });
  });

  it('allows user approvals when autopilot is disabled but blocks reviewer-agent approvals', async () => {
    const { manager } = createManager();
    const task = await manager.createTask({
      title: 'Gate reviewer autopilot',
      description: 'Reviewer agent approval requires autopilot.',
    });
    await manager.dispatchToAgent(task.id, {
      agentId: 'tests-agent',
      role: 'tests',
      worktreeBranch: 'agent/tests-2',
      worktreePath: '.symphony/workspaces/tests-2',
    });
    await manager.requestReview(task.id, {
      requesterAgentId: 'tests-agent',
      summary: 'Tests branch is ready.',
      changedFiles: ['agent-browser/src/services/sessionState.test.ts'],
    });

    expect(manager.getSettings()).toEqual({ autopilotEnabled: true });
    manager.setAutopilotEnabled(false);
    await expect(manager.approveMerge(task.id, {
      actor: { type: 'reviewer-agent', id: 'reviewer-1' },
      summary: 'Looks fine.',
    })).rejects.toThrow('Reviewer agent approvals require autopilot to be enabled');

    const approvedByUser = await manager.approveMerge(task.id, {
      actor: { type: 'user', id: 'local-user' },
      summary: 'User approved after inspection.',
    });
    expect(approvedByUser.review.approvedBy).toEqual({ type: 'user', id: 'local-user' });
  });

  it('summarizes the minimum side-panel state needed to complement the render area', async () => {
    const { manager } = createManager();
    const first = await manager.createTask({ title: 'Frontend branch', description: 'Build UI.' });
    const second = await manager.createTask({ title: 'Tests branch', description: 'Add coverage.' });
    await manager.dispatchToAgent(first.id, {
      agentId: 'frontend-agent',
      role: 'frontend',
      worktreeBranch: 'agent/frontend-1',
      worktreePath: '.symphony/workspaces/frontend-1',
    });
    await manager.dispatchToAgent(second.id, {
      agentId: 'tests-agent',
      role: 'tests',
      worktreeBranch: 'agent/tests-2',
      worktreePath: '.symphony/workspaces/tests-2',
    });
    await manager.requestReview(second.id, {
      requesterAgentId: 'tests-agent',
      summary: 'Coverage ready.',
      changedFiles: ['agent-browser/src/App.test.tsx'],
    });

    expect(await manager.summarize()).toEqual({
      active: 1,
      waitingForReview: 1,
      mergeReady: 0,
      blocked: 0,
      nextApprovalTaskId: second.id,
      autopilotEnabled: true,
    });
  });

  it('keeps malformed durable records out of normal lists and reports invalid task mutations', async () => {
    const { runtime, manager } = createManager();
    const malformed = await runtime.enqueue('harness.task', {}, {
      metadata: {
        kind: 'external-task',
        source: 'internal',
        identifier: 'LEGACY',
      },
    });

    expect(await manager.listTasks()).toEqual([]);
    expect(isHarnessManagedTask(null)).toBe(false);
    expect(isHarnessManagedTask({ kind: 'harness-task', source: 'internal' })).toBe(false);
    await expect(manager.dispatchToAgent(malformed.id, {
      agentId: 'agent',
      role: 'tests',
      worktreeBranch: 'agent/tests',
      worktreePath: '.symphony/workspaces/tests',
    })).rejects.toThrow(`Durable task ${malformed.id} is not a harness task`);
  });

  it('handles default clock/autopilot options and legacy non-numeric task identifiers', async () => {
    const store = createMemoryDurableTaskStore();
    const runtime = createDurableTaskRuntime({
      store,
      lockOwner: 'task-manager-defaults',
    });
    const manager = createHarnessTaskManager({
      runtime,
      workspaceId: 'defaults',
      autopilotEnabled: false,
    });
    await runtime.enqueue('harness.task', {}, {
      metadata: {
        kind: 'harness-task',
        source: 'internal',
        workspaceId: 'defaults',
        identifier: 'LEGACY',
        title: 'Legacy task',
        description: 'Existing local state.',
        lane: 'ready',
        priority: 'normal',
        labels: [],
        assignee: null,
        review: {
          status: 'none',
          requesterAgentId: null,
          summary: null,
          changedFiles: [],
          feedback: [],
          approvedBy: null,
          rejectedBy: null,
          decidedAt: null,
        },
        merge: null,
        activity: [],
        createdAt: 1,
        updatedAt: 1,
      },
    });

    const created = await manager.createTask({ title: 'Default task', description: 'Uses Date.now.' });
    const running = await manager.dispatchToAgent(created.id, {
      agentId: 'default-agent',
      role: 'default',
      worktreeBranch: 'agent/default',
      worktreePath: '.symphony/workspaces/default',
    });

    expect(created.identifier).toBe('HT-1');
    expect(created.createdAt).toBeGreaterThan(0);
    expect(running.updatedAt).toBeGreaterThanOrEqual(created.createdAt);
    expect(manager.getSettings()).toEqual({ autopilotEnabled: false });
  });

  it('can execute its durable task definition when the browser worker ticks the queue', async () => {
    const { runtime, manager } = createManager();
    const task = await manager.createTask({
      title: 'Worker executable task',
      description: 'The worker can resume and complete persisted task intent.',
    });

    await runtime.tick();

    expect(await runtime.getTask(task.id)).toMatchObject({
      status: 'completed',
      output: {
        title: 'Worker executable task',
        description: 'The worker can resume and complete persisted task intent.',
      },
    });
  });
});
