import { describe, expect, it, vi } from 'vitest';
import {
  WorkGraphCommandError,
  applyAgentIssueProposal,
  createAgentIssueProposal,
  createFixedWorkGraphTimeSource,
  createInMemoryWorkGraphRepository,
  createSequentialWorkGraphIdFactory,
  createWorkGraph,
  enqueueWorkGraphAutomationTask,
  exportWorkGraph,
  importWorkGraph,
  searchWorkGraph,
  selectIssuesForView,
  sortIssuesByPriority,
} from '../index.js';
import type { DurableTaskRuntime } from '@agent-harness/browser-durable-tasks';

const actor = { type: 'user' as const, id: 'user-1', name: 'User One' };

describe('WorkGraph command bus', () => {
  it('persists commands as immutable events and materializes Linear-style work projections', async () => {
    const repository = createInMemoryWorkGraphRepository();
    const graph = createWorkGraph({
      repository,
      ids: createSequentialWorkGraphIdFactory('wg'),
      now: createFixedWorkGraphTimeSource('2026-05-10T12:00:00.000Z'),
    });

    const workspace = await graph.dispatch({
      type: 'workspace.create',
      actor,
      payload: { name: 'Agent Harness', key: 'HAR' },
    });
    const team = await graph.dispatch({
      type: 'team.create',
      actor,
      payload: {
        workspaceId: workspace.aggregateId,
        name: 'Symphony',
        key: 'SYM',
        workflowStatuses: ['Backlog', 'Ready', 'In Review', 'Done'],
      },
    });
    const project = await graph.dispatch({
      type: 'project.create',
      actor,
      payload: { workspaceId: workspace.aggregateId, name: 'Symphony reboot' },
    });
    const cycle = await graph.dispatch({
      type: 'cycle.create',
      actor,
      payload: {
        teamId: team.aggregateId,
        name: 'May stabilization',
        startsAt: '2026-05-10',
        endsAt: '2026-05-17',
      },
    });
    const label = await graph.dispatch({
      type: 'label.create',
      actor,
      payload: { workspaceId: workspace.aggregateId, name: 'review-gate', color: '#60a5fa' },
    });
    const view = await graph.dispatch({
      type: 'view.create',
      actor,
      payload: {
        workspaceId: workspace.aggregateId,
        name: 'Ready for reviewer',
        query: { status: ['In Review'], labelIds: [label.aggregateId] },
      },
    });
    const issue = await graph.dispatch({
      type: 'issue.create',
      actor,
      payload: {
        workspaceId: workspace.aggregateId,
        teamId: team.aggregateId,
        projectId: project.aggregateId,
        cycleId: cycle.aggregateId,
        labelIds: [label.aggregateId],
        title: 'Implement Symphony worktree review flow',
        description: 'Agents need durable branch tasks with merge approval.',
        status: 'Ready',
        priority: 'urgent',
        metadata: {
          branchName: 'agent/symphony/frontend-1',
          symphonyTaskId: 'SYM-001',
        },
      },
    });
    await graph.dispatch({
      type: 'comment.create',
      actor,
      payload: {
        issueId: issue.aggregateId,
        body: 'Reviewer agent must be critical before approval.',
      },
    });
    await graph.dispatch({
      type: 'issue.updateStatus',
      actor,
      payload: { issueId: issue.aggregateId, status: 'In Review' },
    });

    const state = graph.getSnapshot();
    expect(state.workspaces[workspace.aggregateId]?.name).toBe('Agent Harness');
    expect(state.teams[team.aggregateId]?.workflowStatuses).toEqual(['Backlog', 'Ready', 'In Review', 'Done']);
    expect(state.issues[issue.aggregateId]).toMatchObject({
      title: 'Implement Symphony worktree review flow',
      status: 'In Review',
      priority: 'urgent',
      projectId: project.aggregateId,
      cycleId: cycle.aggregateId,
      labelIds: [label.aggregateId],
    });
    expect(state.comments[`${issue.aggregateId}:comment-1`]?.body).toContain('critical');
    expect(selectIssuesForView(state, view.aggregateId).map((entry) => entry.id)).toEqual([issue.aggregateId]);
    expect(searchWorkGraph(state, 'critical branch approval').map((result) => result.id)).toEqual([issue.aggregateId]);
    expect(sortIssuesByPriority(Object.values(state.issues)).map((entry) => entry.id)).toEqual([issue.aggregateId]);

    const events = await repository.listEvents();
    expect(events).toHaveLength(9);
    expect(Object.isFrozen(events[0])).toBe(true);
    expect(() => {
      (events[0] as { type: string }).type = 'mutated';
    }).toThrow(TypeError);

    await expect(graph.dispatch({
      type: 'issue.create',
      actor,
      payload: {
        workspaceId: workspace.aggregateId,
        teamId: team.aggregateId,
        title: '',
      },
    })).rejects.toThrow(WorkGraphCommandError);
  });

  it('exports, imports, closes work, and enqueues durable automation intents', async () => {
    const repository = createInMemoryWorkGraphRepository();
    const graph = createWorkGraph({
      repository,
      ids: createSequentialWorkGraphIdFactory('wg'),
      now: createFixedWorkGraphTimeSource('2026-05-10T12:00:00.000Z'),
    });
    const workspace = await graph.dispatch({
      type: 'workspace.create',
      actor,
      payload: { name: 'Offline workspace', key: 'OFF' },
    });
    const team = await graph.dispatch({
      type: 'team.create',
      actor,
      payload: { workspaceId: workspace.aggregateId, name: 'Agents', key: 'AGT' },
    });
    const proposal = createAgentIssueProposal({
      workspaceId: workspace.aggregateId,
      teamId: team.aggregateId,
      title: 'Review isolated branch',
      description: 'Reviewer should reject incomplete validation.',
      branchName: 'agent/offline/review-1',
      requestedBy: { id: 'planner-agent', name: 'Planner Agent' },
      validation: ['npm.cmd run verify:agent-browser'],
    });
    const proposed = await applyAgentIssueProposal(graph, proposal);
    await graph.dispatch({
      type: 'issue.close',
      actor,
      payload: { issueId: proposed.aggregateId, reason: 'workspace disposed' },
    });

    const runtime = {
      enqueue: vi.fn().mockResolvedValue({ id: 'task-1', type: 'workgraph.search.index' }),
    } as unknown as DurableTaskRuntime;
    await expect(enqueueWorkGraphAutomationTask(runtime, {
      kind: 'search.index',
      workspaceId: workspace.aggregateId,
      issueId: proposed.aggregateId,
      reason: 'projection changed',
    })).resolves.toMatchObject({ id: 'task-1' });
    expect(runtime.enqueue).toHaveBeenCalledWith(
      'workgraph.search.index',
      {
        kind: 'search.index',
        workspaceId: workspace.aggregateId,
        issueId: proposed.aggregateId,
        reason: 'projection changed',
      },
      {
        idempotencyKey: `workgraph:search.index:${workspace.aggregateId}:${proposed.aggregateId}`,
        metadata: { workspaceId: workspace.aggregateId, issueId: proposed.aggregateId },
      },
    );

    const exported = await exportWorkGraph(repository);
    const importedRepository = createInMemoryWorkGraphRepository();
    await importWorkGraph(importedRepository, exported);
    const importedGraph = createWorkGraph({ repository: importedRepository });
    expect(importedGraph.getSnapshot().issues[proposed.aggregateId]).toMatchObject({
      status: 'Closed',
      closedReason: 'workspace disposed',
      metadata: {
        branchName: 'agent/offline/review-1',
        proposedByAgentId: 'planner-agent',
        validation: ['npm.cmd run verify:agent-browser'],
      },
    });
  });

  it('rejects issue-targeting commands when the issue does not exist', async () => {
    const graph = createWorkGraph({
      repository: createInMemoryWorkGraphRepository(),
      ids: createSequentialWorkGraphIdFactory('wg'),
      now: createFixedWorkGraphTimeSource('2026-05-10T12:00:00.000Z'),
    });

    await expect(graph.dispatch({
      type: 'issue.updateStatus',
      actor,
      payload: { issueId: 'missing-issue', status: 'In Review' },
    })).rejects.toThrow('Issue not found: missing-issue');
    await expect(graph.dispatch({
      type: 'issue.close',
      actor,
      payload: { issueId: 'missing-issue', reason: 'not planned' },
    })).rejects.toThrow(WorkGraphCommandError);
    await expect(graph.dispatch({
      type: 'comment.create',
      actor,
      payload: { issueId: 'missing-issue', body: 'This should not become an orphan comment.' },
    })).rejects.toThrow(WorkGraphCommandError);

    expect(graph.getSnapshot().events).toEqual([]);
    expect(graph.getSnapshot().comments).toEqual({});
  });

  it('rejects agent issue proposals with missing parents without recording orphan issues', async () => {
    const graph = createWorkGraph({
      repository: createInMemoryWorkGraphRepository(),
      ids: createSequentialWorkGraphIdFactory('wg'),
      now: createFixedWorkGraphTimeSource('2026-05-10T12:00:00.000Z'),
    });

    const proposal = createAgentIssueProposal({
      workspaceId: 'missing-workspace',
      teamId: 'missing-team',
      title: 'Investigate orphan work',
      description: 'Agent proposals must not create issues detached from a workspace.',
      branchName: 'agent/workgraph/orphan-issue',
      requestedBy: { id: 'planner-agent' },
      validation: ['npm.cmd --workspace @agent-harness/workgraph run test:coverage'],
    });

    await expect(applyAgentIssueProposal(graph, proposal)).rejects.toThrow('Workspace not found: missing-workspace');
    expect(graph.getSnapshot().issues).toEqual({});
    expect(graph.getSnapshot().events).toEqual([]);

    const workspace = await graph.dispatch({
      type: 'workspace.create',
      actor,
      payload: { name: 'Bounded workspace', key: 'BND' },
    });

    await expect(applyAgentIssueProposal(graph, {
      ...proposal,
      workspaceId: workspace.aggregateId,
    })).rejects.toThrow('Team not found: missing-team');
    expect(graph.getSnapshot().issues).toEqual({});
    expect(graph.getSnapshot().events.map((event) => event.type)).toEqual(['workspace.created']);

    const team = await graph.dispatch({
      type: 'team.create',
      actor,
      payload: { workspaceId: workspace.aggregateId, name: 'Agents', key: 'AGT' },
    });
    const otherWorkspace = await graph.dispatch({
      type: 'workspace.create',
      actor,
      payload: { name: 'Other workspace', key: 'OTH' },
    });

    await expect(applyAgentIssueProposal(graph, {
      ...proposal,
      workspaceId: otherWorkspace.aggregateId,
      teamId: team.aggregateId,
    })).rejects.toThrow(`Team ${team.aggregateId} does not belong to workspace ${otherWorkspace.aggregateId}`);
    expect(graph.getSnapshot().issues).toEqual({});
    expect(graph.getSnapshot().events.map((event) => event.type)).toEqual([
      'workspace.created',
      'team.created',
      'workspace.created',
    ]);
  });
});
