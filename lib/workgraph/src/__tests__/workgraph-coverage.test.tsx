// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  WorkGraphCommandError,
  WorkGraphDexieDatabase,
  WorkGraphProvider,
  createInMemoryWorkGraphRepository,
  createWorkGraph,
  createWorkGraphExternalStore,
  importWorkGraph,
  materializeWorkGraphProjection,
  priorityRank,
  searchWorkGraph,
  selectIssuesForView,
  sortIssuesByPriority,
  useWorkGraphState,
  useWorkGraphStore,
} from '../index.js';

describe('WorkGraph edge contracts', () => {
  it('covers defaults, permission failures, missing selectors, and unsupported imports', async () => {
    const repository = createInMemoryWorkGraphRepository();
    const graph = createWorkGraph({ repository });

    await expect(graph.dispatch({
      type: 'workspace.create',
      actor: { type: 'agent', id: 'agent-1' },
      payload: { name: 'Agent authored workspace' },
    })).rejects.toThrow(WorkGraphCommandError);

    const workspace = await graph.dispatch({
      type: 'workspace.create',
      actor: { type: 'user', id: 'user-1' },
      payload: { name: '!!!' },
    });
    const team = await graph.dispatch({
      type: 'team.create',
      actor: { type: 'user', id: 'user-1' },
      payload: { workspaceId: workspace.aggregateId, name: 'Default Workflow', key: 'DEF' },
    });
    await graph.dispatch({
      type: 'issue.create',
      actor: { type: 'system', id: 'system' },
      payload: {
        workspaceId: workspace.aggregateId,
        teamId: team.aggregateId,
        title: 'Default issue',
      },
    });

    const state = graph.getSnapshot();
    expect(state.workspaces[workspace.aggregateId]?.key).toBe('WG');
    expect(state.teams[team.aggregateId]?.workflowStatuses).toEqual([
      'Backlog',
      'Todo',
      'In Progress',
      'In Review',
      'Done',
    ]);
    expect(selectIssuesForView(state, 'missing-view')).toEqual([]);
    expect(searchWorkGraph(state, '')).toEqual([]);
    expect(searchWorkGraph(state, 'does-not-match')).toEqual([]);
    expect(priorityRank('none')).toBeGreaterThan(priorityRank('urgent'));
    expect(materializeWorkGraphProjection(await repository.listEvents()).events).toHaveLength(3);
    await expect(importWorkGraph(repository, { version: 2, exportedAt: '', events: [] } as never)).rejects.toThrow(
      'Unsupported WorkGraph export version 2',
    );

    const db = new WorkGraphDexieDatabase('workgraph-test-db');
    expect(db.name).toBe('workgraph-test-db');
    db.close();
  });

  it('covers selector branches, search ordering, repository listeners, and malformed event fallbacks', async () => {
    const repository = createInMemoryWorkGraphRepository();
    let repositoryNotifications = 0;
    const unsubscribe = repository.subscribe(() => {
      repositoryNotifications += 1;
    });
    const graph = createWorkGraph({ repository });
    const actor = { type: 'user' as const, id: 'user-1' };
    const workspace = await graph.dispatch({
      type: 'workspace.create',
      actor,
      payload: { id: 'workspace-explicit', name: 'Coverage workspace', key: 'COV' },
    });
    const team = await graph.dispatch({
      type: 'team.create',
      actor,
      payload: { id: 'team-explicit', workspaceId: workspace.aggregateId, name: 'Coverage team', key: 'COV' },
    });
    const project = await graph.dispatch({
      type: 'project.create',
      actor,
      payload: { workspaceId: workspace.aggregateId, name: 'Coverage project' },
    });
    const cycle = await graph.dispatch({
      type: 'cycle.create',
      actor,
      payload: { teamId: team.aggregateId, name: 'Coverage cycle', startsAt: '2026-05-10', endsAt: '2026-05-11' },
    });
    const label = await graph.dispatch({
      type: 'label.create',
      actor,
      payload: { workspaceId: workspace.aggregateId, name: 'coverage-label', color: '#000000' },
    });
    const included = await graph.dispatch({
      type: 'issue.create',
      actor,
      payload: {
        workspaceId: workspace.aggregateId,
        teamId: team.aggregateId,
        projectId: project.aggregateId,
        cycleId: cycle.aggregateId,
        labelIds: [label.aggregateId, 'missing-label'],
        title: 'Alpha same score',
        description: 'shared ordering term',
        status: 'Ready',
        priority: 'high',
      },
    });
    const alsoIncluded = await graph.dispatch({
      type: 'issue.create',
      actor,
      payload: {
        workspaceId: workspace.aggregateId,
        teamId: team.aggregateId,
        projectId: project.aggregateId,
        cycleId: cycle.aggregateId,
        labelIds: [label.aggregateId],
        title: 'Beta same score',
        description: 'shared ordering term',
        status: 'Ready',
        priority: 'high',
      },
    });
    await graph.dispatch({
      type: 'issue.create',
      actor,
      payload: {
        workspaceId: workspace.aggregateId,
        teamId: team.aggregateId,
        title: 'Excluded issue',
        status: 'Backlog',
        priority: 'low',
      },
    });
    await graph.dispatch({
      type: 'issue.create',
      actor,
      payload: {
        workspaceId: workspace.aggregateId,
        teamId: team.aggregateId,
        projectId: project.aggregateId,
        cycleId: cycle.aggregateId,
        labelIds: [],
        title: 'Ready without label',
        status: 'Ready',
      },
    });
    const otherWorkspace = await graph.dispatch({
      type: 'workspace.create',
      actor,
      payload: { name: 'Other workspace', key: 'OTH' },
    });
    await graph.dispatch({
      type: 'issue.create',
      actor,
      payload: {
        workspaceId: otherWorkspace.aggregateId,
        teamId: team.aggregateId,
        projectId: project.aggregateId,
        cycleId: cycle.aggregateId,
        labelIds: [label.aggregateId],
        title: 'Other workspace issue',
        status: 'Ready',
      },
    });
    await graph.dispatch({
      type: 'issue.create',
      actor,
      payload: {
        workspaceId: workspace.aggregateId,
        teamId: team.aggregateId,
        cycleId: cycle.aggregateId,
        labelIds: [label.aggregateId],
        title: 'Ready without project',
        status: 'Ready',
      },
    });
    await graph.dispatch({
      type: 'issue.create',
      actor,
      payload: {
        workspaceId: workspace.aggregateId,
        teamId: team.aggregateId,
        projectId: project.aggregateId,
        labelIds: [label.aggregateId],
        title: 'Ready without cycle',
        status: 'Ready',
      },
    });
    await graph.dispatch({
      type: 'comment.create',
      actor,
      payload: { issueId: included.aggregateId, body: 'first comment' },
    });
    await graph.dispatch({
      type: 'comment.create',
      actor,
      payload: { issueId: included.aggregateId, body: 'second comment' },
    });
    const view = await graph.dispatch({
      type: 'view.create',
      actor,
      payload: {
        workspaceId: workspace.aggregateId,
        name: 'Coverage view',
        query: {
          status: ['Ready'],
          labelIds: [label.aggregateId],
          projectIds: [project.aggregateId],
          cycleIds: [cycle.aggregateId],
        },
      },
    });

    const state = graph.getSnapshot();
    expect(selectIssuesForView(state, view.aggregateId).map((issue) => issue.id)).toEqual([
      included.aggregateId,
      alsoIncluded.aggregateId,
    ]);
    expect(searchWorkGraph(state, 'shared').map((result) => result.title)).toEqual([
      'Alpha same score',
      'Beta same score',
    ]);
    expect(sortIssuesByPriority([
      { ...state.issues[alsoIncluded.aggregateId]!, createdAt: '2026-05-10T00:00:00.000Z' },
      { ...state.issues[included.aggregateId]!, createdAt: '2026-05-10T00:00:00.000Z' },
    ]).map((issue) => issue.id)).toEqual([included.aggregateId, alsoIncluded.aggregateId]);

    unsubscribe();
    await repository.replaceEvents(await repository.listEvents());
    expect(repositoryNotifications).toBeGreaterThan(0);

    const fallbackProjection = materializeWorkGraphProjection([
      {
        id: 'bad-workspace-event',
        type: 'workspace.created',
        aggregateId: 'bad-workspace',
        aggregateType: 'workspace',
        actor,
        data: { name: 1, key: null },
        timestamp: '2026-05-10T00:00:00.000Z',
        commandId: 'bad-workspace-event',
      },
      {
        id: 'bad-team-event',
        type: 'team.created',
        aggregateId: 'bad-team',
        aggregateType: 'team',
        actor,
        data: { workspaceId: 1, name: null, key: null, workflowStatuses: 'bad' },
        timestamp: '2026-05-10T00:00:00.000Z',
        commandId: 'bad-team-event',
      },
      {
        id: 'bad-issue-event',
        type: 'issue.created',
        aggregateId: 'bad-issue',
        aggregateType: 'issue',
        actor,
        data: {
          workspaceId: 1,
          teamId: 1,
          projectId: 1,
          cycleId: 1,
          labelIds: 'bad',
          title: 1,
          description: 1,
          status: 1,
          priority: 1,
          assigneeId: 1,
          metadata: [],
        },
        timestamp: '2026-05-10T00:00:00.000Z',
        commandId: 'bad-issue-event',
      },
      {
        id: 'missing-status-event',
        type: 'issue.statusUpdated',
        aggregateId: 'missing-issue',
        aggregateType: 'issue',
        actor,
        data: { status: 'Ready' },
        timestamp: '2026-05-10T00:00:00.000Z',
        commandId: 'missing-status-event',
      },
      {
        id: 'missing-close-event',
        type: 'issue.closed',
        aggregateId: 'missing-issue',
        aggregateType: 'issue',
        actor,
        data: { reason: 'not found' },
        timestamp: '2026-05-10T00:00:00.000Z',
        commandId: 'missing-close-event',
      },
      {
        id: 'bad-comment-event',
        type: 'comment.created',
        aggregateId: 'bad-comment',
        aggregateType: 'comment',
        actor,
        data: { issueId: 1, body: 1 },
        timestamp: '2026-05-10T00:00:00.000Z',
        commandId: 'bad-comment-event',
      },
      {
        id: 'ignored-event',
        type: 'unknown.event',
        aggregateId: 'ignored',
        aggregateType: 'unknown',
        actor,
        data: {},
        timestamp: '2026-05-10T00:00:00.000Z',
        commandId: 'ignored-event',
      } as never,
    ]);
    expect(fallbackProjection.workspaces['bad-workspace']?.name).toBe('');
    expect(fallbackProjection.teams['bad-team']?.workflowStatuses).toEqual([]);
    expect(fallbackProjection.issues['bad-issue']?.metadata).toEqual({});
  });

  it('renders hook state through the provider-backed external store', async () => {
    const graph = createWorkGraph({ repository: createInMemoryWorkGraphRepository() });
    const store = createWorkGraphExternalStore(graph);

    function WorkspacesCount() {
      const currentStore = useWorkGraphStore();
      const state = useWorkGraphState(currentStore);
      return <span>workspaces:{Object.keys(state.workspaces).length}</span>;
    }

    render(
      <WorkGraphProvider store={store}>
        <WorkspacesCount />
      </WorkGraphProvider>,
    );
    expect(screen.getByText('workspaces:0')).toBeInTheDocument();

    await act(async () => {
      await store.dispatch({
        type: 'workspace.create',
        actor: { type: 'user', id: 'user-1' },
        payload: { name: 'Rendered workspace' },
      });
    });

    expect(screen.getByText('workspaces:1')).toBeInTheDocument();
  });
});
