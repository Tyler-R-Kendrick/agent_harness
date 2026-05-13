import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MULTITASK_SUBAGENT_STATE,
  addMultitaskTask,
  buildMultitaskWorkGraphCommands,
  buildMultitaskPromptContext,
  cancelMultitaskBranch,
  createMultitaskProject,
  createMultitaskSubagentState,
  disposeMultitaskBranch,
  isMultitaskSubagentState,
  promoteMultitaskBranch,
  reconcileMultitaskSubagentRuns,
  retryMultitaskBranch,
  requestMultitaskBranchChanges,
  startMultitaskBranchRun,
  stopMultitaskBranchRun,
  summarizeMultitaskSubagents,
  selectMultitaskProject,
  selectMultitaskTask,
  type MultitaskSubagentState,
} from './multitaskSubagents';

describe('multitaskSubagents', () => {
  it('creates deterministic isolated subagent branches from a larger request', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });

    expect(state).toMatchObject({
      enabled: true,
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      createdAt: '2026-05-07T10:00:00.000Z',
      foregroundBranchId: null,
      foregroundBranchApprovedBy: null,
    });
    expect(state.branches.map((branch) => branch.branchName)).toEqual([
      'agent/research/frontend-1',
      'agent/research/tests-2',
      'agent/research/documentation-3',
    ]);
    expect(state.branches.map((branch) => branch.worktreePath)).toEqual([
      '.worktrees/agent/research/frontend-1',
      '.worktrees/agent/research/tests-2',
      '.worktrees/agent/research/documentation-3',
    ]);
    expect(state.branches[0]).toMatchObject({
      status: 'queued',
      progress: 0,
      role: 'Frontend specialist',
      projectId: 'multitask-project:ws-research:symphony',
    });
    expect(state.projects).toEqual([{
      id: 'multitask-project:ws-research:symphony',
      name: 'Research',
      description: 'parallelize the frontend, tests, and documentation work',
      createdAt: '2026-05-07T10:00:00.000Z',
    }]);
    expect(state.activeProjectId).toBe('multitask-project:ws-research:symphony');
    expect(state.selectedBranchId).toBe(state.branches[0].id);
    expect(state.branches.every((branch) => branch.status === 'queued')).toBe(true);
  });

  it('creates and selects local-first projects and tasks without Linear', () => {
    const initial = {
      ...DEFAULT_MULTITASK_SUBAGENT_STATE,
      workspaceId: 'ws-product',
      workspaceName: 'Product Lab',
    };

    const withProject = createMultitaskProject(initial, 'Release readiness', new Date('2026-05-10T14:00:00.000Z'));
    const withTask = addMultitaskTask(withProject, {
      title: 'Write rollout checklist',
      projectId: withProject.projects[0].id,
      now: new Date('2026-05-10T14:05:00.000Z'),
    });
    const selectedProject = selectMultitaskProject(withTask, withProject.projects[0].id);
    const selectedTask = selectMultitaskTask(selectedProject, withTask.branches[0].id);

    expect(withProject).toMatchObject({
      enabled: true,
      request: 'Release readiness',
      activeProjectId: 'multitask-project:ws-product:release-readiness',
      projects: [{
        id: 'multitask-project:ws-product:release-readiness',
        name: 'Release readiness',
        description: '',
        createdAt: '2026-05-10T14:00:00.000Z',
      }],
    });
    expect(withTask.branches[0]).toMatchObject({
      title: 'Write rollout checklist',
      role: 'Agent task',
      branchName: 'agent/product-lab/write-rollout-checklist-1',
      worktreePath: '.worktrees/agent/product-lab/write-rollout-checklist-1',
      projectId: withProject.projects[0].id,
      status: 'queued',
    });
    expect(selectedProject.activeProjectId).toBe(withProject.projects[0].id);
    expect(selectedTask.selectedBranchId).toBe(withTask.branches[0].id);
    expect(createMultitaskProject(withProject, '   ', new Date('2026-05-10T14:00:00.000Z'))).toBe(withProject);
    expect(addMultitaskTask(withProject, { title: '   ', now: new Date('2026-05-10T14:00:00.000Z') })).toBe(withProject);
    expect(selectMultitaskProject(withTask, 'missing-project')).toBe(withTask);
    expect(selectMultitaskTask(withTask, 'missing-task')).toBe(withTask);
  });

  it('turns rejected review feedback into a queued branch rework task', () => {
    const initial = createMultitaskSubagentState({
      workspaceId: 'ws-review',
      workspaceName: 'Review Lab',
      request: 'split frontend and test review',
      now: new Date('2026-05-07T11:30:00.000Z'),
    });
    const ready = {
      ...initial,
      branches: initial.branches.map((branch) => ({ ...branch, status: 'ready' as const, progress: 100 })),
    };

    const rework = requestMultitaskBranchChanges(ready, ready.branches[0].id, [
      'Validation evidence incomplete.',
      'Browser proof missing.',
    ]);

    expect(rework.branches[0]).toMatchObject({
      status: 'queued',
      progress: 0,
    });
    expect(rework.branches[0].validation).toContain('Reviewer feedback: Validation evidence incomplete.');
    expect(rework.foregroundBranchId).toBeNull();
    expect(requestMultitaskBranchChanges(ready, 'missing', ['ignored'])).toBe(ready);
  });

  it('manages branch session lifecycle through start, stop, retry, and close/dispose transitions', () => {
    const initial = createMultitaskSubagentState({
      workspaceId: 'ws-ops',
      workspaceName: 'Ops Lab',
      request: 'split frontend and tests work',
      now: new Date('2026-05-07T11:45:00.000Z'),
    });
    const branchId = initial.branches[0].id;

    const running = startMultitaskBranchRun(initial, branchId, { now: new Date('2026-05-07T11:46:00.000Z') });
    const stopped = stopMultitaskBranchRun(running, branchId);
    const retried = retryMultitaskBranch(stopped, branchId);
    const disposed = disposeMultitaskBranch(retried, branchId);

    expect(running.branches[0]).toMatchObject({
      status: 'running',
      progress: 10,
      runAttempt: 1,
      lastRunAt: '2026-05-07T11:46:00.000Z',
      lastHeartbeatAt: '2026-05-07T11:46:00.000Z',
    });
    expect(running.branches[0].executionEvents?.map((event) => event.type)).toEqual([
      'claimed',
      'workspace_prepared',
      'agent_session_queued',
    ]);
    expect(running.branches[0].validation).toContain('Session started in .worktrees/agent/ops-lab/frontend-1.');
    expect(stopped.branches[0]).toMatchObject({ status: 'stopped', progress: 10 });
    expect(stopped.branches[0].validation).toContain('Session stopped; workspace resources are preserved for resume.');
    expect(retried.branches[0]).toMatchObject({
      status: 'queued',
      progress: 0,
      sessionId: null,
      sessionName: null,
      lastHeartbeatAt: null,
    });
    expect(retried.branches[0].executionEvents?.at(-1)).toMatchObject({ type: 'retry_queued' });
    expect(disposed.branches.map((branch) => branch.id)).not.toContain(branchId);
    const cancelled = cancelMultitaskBranch(retried, branchId);
    expect(cancelled.branches[0]).toMatchObject({ status: 'cancelled' });
    expect(disposeMultitaskBranch({ ...initial, branches: [initial.branches[0]] }, branchId)).toMatchObject({
      enabled: false,
      branches: [],
    });
    expect(startMultitaskBranchRun(initial, 'missing')).toBe(initial);
    expect(stopMultitaskBranchRun(initial, branchId)).toBe(initial);
  });

  it('self-heals queued branches into dispatchable agent runs with durable evidence', () => {
    const initial = createMultitaskSubagentState({
      workspaceId: 'ws-recover',
      workspaceName: 'Recover Lab',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-12T14:00:00.000Z'),
    });

    const firstPass = reconcileMultitaskSubagentRuns(initial, {
      maxConcurrentAgents: 2,
      now: new Date('2026-05-12T14:01:00.000Z'),
    });

    expect(initial.branches.every((branch) => branch.status === 'queued')).toBe(true);
    expect(firstPass.dispatches.map((dispatch) => dispatch.branchId)).toEqual([
      'multitask:ws-recover:frontend-1',
      'multitask:ws-recover:tests-2',
    ]);
    expect(firstPass.state.branches.map((branch) => branch.status)).toEqual(['running', 'running', 'queued']);
    expect(firstPass.state.branches[0]).toMatchObject({
      status: 'running',
      progress: 10,
      runAttempt: 1,
      lastRunAt: '2026-05-12T14:01:00.000Z',
      lastHeartbeatAt: '2026-05-12T14:01:00.000Z',
    });
    expect(firstPass.state.branches[0].executionEvents?.map((event) => event.type)).toEqual([
      'claimed',
      'workspace_prepared',
      'agent_session_queued',
    ]);
    expect(firstPass.state.branches[0].validation).toContain('Agent prompt queued in SYM-001.');
    expect(firstPass.dispatches[0].prompt).toContain('Task request: parallelize the frontend, tests, and documentation work');
    expect(firstPass.dispatches[0].prompt).toContain('Isolated branch: agent/recover-lab/frontend-1');
    expect(firstPass.dispatches[0].prompt).toContain('Run validation and attach concrete evidence before review.');

    const secondPass = reconcileMultitaskSubagentRuns(firstPass.state, {
      maxConcurrentAgents: 2,
      now: new Date('2026-05-12T14:01:05.000Z'),
    });
    expect(secondPass.state).toBe(firstPass.state);
    expect(secondPass.dispatches).toEqual([]);
  });

  it('requeues stale running branches before redispatching them', () => {
    const initial = createMultitaskSubagentState({
      workspaceId: 'ws-stale',
      workspaceName: 'Stale Lab',
      request: 'split frontend and tests work',
      now: new Date('2026-05-12T14:00:00.000Z'),
    });
    const running = startMultitaskBranchRun(initial, initial.branches[0].id, {
      now: new Date('2026-05-12T14:00:00.000Z'),
    });

    const recovered = reconcileMultitaskSubagentRuns(running, {
      maxConcurrentAgents: 1,
      staleAfterMs: 60_000,
      now: new Date('2026-05-12T14:02:01.000Z'),
    });

    expect(recovered.dispatches).toHaveLength(1);
    expect(recovered.dispatches[0].reason).toBe('self-heal');
    expect(recovered.state.branches[0]).toMatchObject({
      status: 'running',
      runAttempt: 2,
      lastRunAt: '2026-05-12T14:02:01.000Z',
    });
    expect(recovered.state.branches[0].executionEvents?.map((event) => event.type)).toContain('self_heal_requeued');
  });

  it('maps Symphony branch work into durable WorkGraph commands without Linear', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-symphony',
      workspaceName: 'Symphony Lab',
      request: 'parallelize frontend and tests review',
      now: new Date('2026-05-10T12:00:00.000Z'),
    });
    const runningState = startMultitaskBranchRun(state, state.branches[0].id);

    const commands = buildMultitaskWorkGraphCommands(runningState);

    expect(commands.map((command) => command.type)).toEqual([
      'workspace.create',
      'team.create',
      'project.create',
      'label.create',
      'issue.create',
      'issue.create',
      'view.create',
    ]);
    expect(commands[0]).toMatchObject({
      payload: {
        id: 'workgraph:workspace:ws-symphony',
        name: 'Symphony Lab',
        key: 'SYM',
      },
    });
    expect(commands[4]).toMatchObject({
      type: 'issue.create',
      payload: {
        id: 'multitask:ws-symphony:frontend-1',
        status: 'In Progress',
        metadata: {
          branchName: 'agent/symphony-lab/frontend-1',
          worktreePath: '.worktrees/agent/symphony-lab/frontend-1',
          symphonyWorkspaceId: 'ws-symphony',
          role: 'Frontend specialist',
        },
      },
    });
    expect(buildMultitaskWorkGraphCommands(DEFAULT_MULTITASK_SUBAGENT_STATE)).toEqual([]);
  });

  it('summarizes comparison state and promotes one branch to the foreground', () => {
    const initial = createMultitaskSubagentState({
      workspaceId: 'ws-build',
      workspaceName: 'Build Lab',
      request: 'split the app shell, tests, documentation, and release notes across subagents',
      now: new Date('2026-05-07T11:00:00.000Z'),
    });
    const ready = {
      ...initial,
      branches: initial.branches.map((branch) => ({
        ...branch,
        status: 'ready' as const,
        progress: 100,
      })),
    };

    const promoted = promoteMultitaskBranch(ready, ready.branches[2].id);
    const summary = summarizeMultitaskSubagents(promoted);
    const emptySummary = summarizeMultitaskSubagents(initial);

    expect(promoted.foregroundBranchId).toBe(ready.branches[2].id);
    expect(promoted.foregroundBranchApprovedBy).toBe('user');
    expect(promoted.branches[2].status).toBe('promoted');
    expect(promoted.branches.filter((branch) => branch.status === 'ready')).toHaveLength(3);
    expect(summary).toMatchObject({
      total: 4,
      ready: 3,
      running: 0,
      blocked: 0,
      stopped: 0,
      cancelled: 0,
      changedFiles: expect.any(Number),
      promotedBranch: promoted.branches[2],
    });
    expect(summary.changedFiles).toBeGreaterThan(0);
    expect(emptySummary.promotedBranch).toBeNull();
  });

  it('records reviewer-agent merge approval as a distinct actor', () => {
    const initial = createMultitaskSubagentState({
      workspaceId: 'ws-review',
      workspaceName: 'Review Lab',
      request: 'split frontend and test review',
      now: new Date('2026-05-07T11:30:00.000Z'),
    });

    const promoted = promoteMultitaskBranch(initial, initial.branches[0].id, 'reviewer-agent');

    expect(promoted.foregroundBranchId).toBe(initial.branches[0].id);
    expect(promoted.foregroundBranchApprovedBy).toBe('reviewer-agent');
    expect(buildMultitaskPromptContext(promoted)).toContain('Approved by: reviewer-agent');
  });

  it('keeps blocked branches isolated and ignores unknown merge approvals', () => {
    const initial = createMultitaskSubagentState({
      workspaceId: '',
      workspaceName: '',
      request: 'split unknown work',
      now: new Date('bad date'),
    });
    const blocked = {
      ...initial,
      branches: initial.branches.map((branch, index) => index === 1
        ? { ...branch, status: 'blocked' as const, progress: 44 }
        : branch),
    };

    expect(initial.createdAt).toBe('1970-01-01T00:00:00.000Z');
    expect(initial.branches[0].branchName).toBe('agent/workspace/frontend-1');
    expect(createMultitaskSubagentState({
      workspaceId: '',
      workspaceName: '!!!',
      request: 'frontend',
    }).branches[0].branchName).toBe('agent/workspace/frontend-1');
    expect(promoteMultitaskBranch(blocked, 'missing')).toBe(blocked);

    const promoted = promoteMultitaskBranch(blocked, blocked.branches[0].id);

    expect(promoted.branches[0]).toMatchObject({ status: 'promoted', progress: 100 });
    expect(promoted.branches[1]).toMatchObject({ status: 'blocked', progress: 44 });
  });

  it('renders prompt context for enabled isolated branches only', () => {
    const state = promoteMultitaskBranch(
      createMultitaskSubagentState({
        workspaceId: 'ws-research',
        workspaceName: 'Research',
        request: 'delegate branch-safe API and UI experiments',
        now: new Date('2026-05-07T12:00:00.000Z'),
      }),
      'multitask:ws-research:ui-2',
    );

    const context = buildMultitaskPromptContext(state);

    expect(context).toContain('## Symphony Multi-Agent Worktrees');
    expect(context).toContain('Branch isolation: one worktree branch per agent');
    expect(context).toContain('Review gate: approval required before merge to the common branch');
    expect(context).toContain('Foreground branch: agent/research/ui-2');
    expect(context).toContain('Approved by: user');
    expect(context).toContain('.worktrees/agent/research/api-1');
    expect(context).toContain('Validation:');
    expect(buildMultitaskPromptContext(DEFAULT_MULTITASK_SUBAGENT_STATE)).toBe('');

    const legacyPromotedState = { ...state, foregroundBranchApprovedBy: undefined } as unknown as MultitaskSubagentState;
    expect(buildMultitaskPromptContext(legacyPromotedState)).toContain('Approved by: user');

    const unspecifiedContext = buildMultitaskPromptContext({
      ...state,
      request: '',
      workspaceName: '',
      foregroundBranchId: null,
    });

    expect(unspecifiedContext).toContain('Request: unspecified');
    expect(unspecifiedContext).toContain('Workspace: ws-research');
    expect(unspecifiedContext).toContain('Foreground branch: none selected');
    expect(unspecifiedContext).toContain('Approved by: none');

    expect(buildMultitaskPromptContext({
      ...state,
      request: '',
      workspaceId: '',
      workspaceName: '',
      foregroundBranchId: null,
    })).toContain('Workspace: workspace');
  });

  it('validates persisted state shape', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      request: 'parallelize this',
    });

    expect(isMultitaskSubagentState(state)).toBe(true);
    expect(isMultitaskSubagentState({ ...state, enabled: 'yes' })).toBe(false);
    expect(isMultitaskSubagentState(null)).toBe(false);
    expect(isMultitaskSubagentState([])).toBe(false);
    expect(isMultitaskSubagentState({ ...state, foregroundBranchId: 42 })).toBe(false);
    expect(isMultitaskSubagentState({ ...state, foregroundBranchApprovedBy: 'reviewer-agent' })).toBe(true);
    expect(isMultitaskSubagentState({ ...state, foregroundBranchApprovedBy: 'robot' })).toBe(false);
    expect(isMultitaskSubagentState({
      ...state,
      branches: [{
        ...state.branches[0],
        runAttempt: 1,
        sessionId: 'symphony:ws-research:frontend-1',
        sessionName: 'SYM-001',
        lastRunAt: '2026-05-07T11:46:00.000Z',
        lastHeartbeatAt: '2026-05-07T11:47:00.000Z',
        executionEvents: [{
          id: 'multitask:ws-research:frontend-1:heartbeat:2026-05-07T11:47:00.000Z',
          type: 'heartbeat',
          at: '2026-05-07T11:47:00.000Z',
          summary: 'Agent streamed a turn delta.',
        }],
      }],
    })).toBe(true);
    expect(isMultitaskSubagentState({
      ...state,
      branches: [{ ...state.branches[0], lastHeartbeatAt: 'not-a-date' }],
    })).toBe(false);
    expect(isMultitaskSubagentState({
      ...state,
      branches: [{
        ...state.branches[0],
        executionEvents: [{
          id: 'event-1',
          type: 'unknown',
          at: '2026-05-07T11:47:00.000Z',
          summary: 'Agent streamed a turn delta.',
        }],
      }],
    })).toBe(false);
    expect(isMultitaskSubagentState({
      ...state,
      branches: [{ ...state.branches[0], status: 'unknown' }],
    })).toBe(false);
    expect(isMultitaskSubagentState({
      ...state,
      branches: [{ ...state.branches[0], progress: 'half' }],
    })).toBe(false);
    expect(isMultitaskSubagentState({
      ...state,
      branches: [{ ...state.branches[0], changedFiles: ['ok.ts', 42] }],
    })).toBe(false);
    expect(isMultitaskSubagentState({
      ...state,
      branches: [{ ...state.branches[0], validation: ['ok', 42] }],
    })).toBe(false);
    expect(isMultitaskSubagentState({
      ...state,
      branches: [[state.branches[0]]],
    })).toBe(false);
  });
});
