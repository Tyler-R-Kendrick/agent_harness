import { describe, expect, it } from 'vitest';
import {
  addMultitaskTask,
  createMultitaskSubagentState,
  disposeMultitaskBranch,
  promoteMultitaskBranch,
  reconcileMultitaskSubagentRuns,
} from './multitaskSubagents';
import { buildPullRequestReview, createSamplePullRequestReviewInput } from './prReviewUnderstanding';
import {
  buildSymphonyHistoryEventSummaries,
  buildSymphonyHistorySessionSummaries,
  createSymphonyRuntimeSnapshot,
  isSymphonyAutopilotSettings,
  summarizeSymphonyRuntime,
} from './symphonyRuntime';

describe('symphonyRuntime', () => {
  it('maps isolated agent branches into the Symphony orchestrator domain model', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-research',
      workspaceName: 'Research Lab',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Research Lab'));

    const snapshot = createSymphonyRuntimeSnapshot({ state, report });

    expect(snapshot.workflow.path).toBe('WORKFLOW.md');
    expect(snapshot.workflow.config.taskStore.kind).toBe('browser-durable-task-store');
    expect(snapshot.workflow.config.taskStore.uri).toBe('indexeddb://agent-harness-tasks');
    expect(snapshot.workflow.config.workspace.root).toBe('.symphony/workspaces');
    expect(snapshot.workflow.config.agent.maxConcurrentAgents).toBe(4);
    expect(snapshot.workflow.validation.status).toBe('blocked');
    expect(snapshot.workflow.validation.errors).toContain('2 validation checks are not passing yet.');
    expect(snapshot.orchestrator.running.size).toBe(0);
    expect(snapshot.orchestrator.claimed).toContain('multitask:ws-research:frontend-1');
    expect(snapshot.orchestrator.retryAttempts.size).toBe(0);
    expect(snapshot.workGraph.issueIds).toEqual([
      'multitask:ws-research:frontend-1',
      'multitask:ws-research:tests-2',
      'multitask:ws-research:documentation-3',
    ]);
    expect(snapshot.workGraph.commands.filter((command) => command.type === 'issue.create')).toHaveLength(3);
    expect(snapshot.workGraph.commands[0]).toMatchObject({
      type: 'workspace.create',
      payload: { id: 'workgraph:workspace:ws-research', name: 'Research Lab' },
    });
    expect(snapshot.issues.map((issue) => issue.identifier)).toEqual(['SYM-001', 'SYM-002', 'SYM-003']);
    expect(snapshot.issues[0]).toMatchObject({
      state: 'Todo',
      branchName: 'agent/research-lab/frontend-1',
      labels: ['symphony', 'frontend-specialist'],
    });
    expect(snapshot.workspaces[0]).toMatchObject({
      workspaceKey: 'SYM-001',
      path: '.symphony/workspaces/SYM-001',
      branchName: 'agent/research-lab/frontend-1',
    });
    expect(snapshot.runAttempts[0]).toMatchObject({
      phase: 'PreparingWorkspace',
      workspacePath: '.symphony/workspaces/SYM-001',
    });
    expect(snapshot.liveSessions).toEqual([]);
    expect(snapshot.logs.map((entry) => entry.event)).toEqual([
      'workflow_loaded',
      'poll_tick',
      'review_gate_waiting',
    ]);
    expect(JSON.stringify(snapshot.workflow.config)).not.toMatch(/linear/i);
    expect(snapshot.logs.map((entry) => entry.message).join('\n')).not.toMatch(/linear/i);
  });

  it('builds History-ready event and session summaries from the runtime snapshot', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-research',
      workspaceName: 'Research Lab',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Research Lab'));
    const snapshot = createSymphonyRuntimeSnapshot({
      state: {
        ...state,
        branches: state.branches.map((branch) => branch.branchName.endsWith('/frontend-1')
          ? { ...branch, status: 'running' as const, progress: 42 }
          : branch),
      },
      report,
      now: new Date('2026-05-07T10:03:00.000Z'),
    });

    expect(buildSymphonyHistoryEventSummaries(snapshot)).toEqual(expect.arrayContaining([
      'Symphony event: workflow loaded - Loaded WORKFLOW.md and applied Symphony runtime defaults.',
      'Symphony event: issue dispatched - Dispatched SYM-001 into .symphony/workspaces/SYM-001.',
      'Symphony review: SYM-001 agent/research-lab/frontend-1 blocked/not-ready',
    ]));
    expect(buildSymphonyHistorySessionSummaries(snapshot)).toEqual(expect.arrayContaining([
      'Symphony session: SYM-001 agent/research-lab/frontend-1 StreamingTurn active 1 turn, 0 evidence events',
      'Symphony session: SYM-002 agent/research-lab/tests-2 PreparingWorkspace pending no live session, 0 evidence events',
    ]));
  });

  it('self-heals the stuck Agent Workspaces repro into observable execution evidence', () => {
    const initial = createMultitaskSubagentState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-12T14:00:00.000Z'),
    });
    const { state } = reconcileMultitaskSubagentRuns(initial, {
      maxConcurrentAgents: 3,
      now: new Date('2026-05-12T14:01:00.000Z'),
    });
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Research'));

    const snapshot = createSymphonyRuntimeSnapshot({
      state,
      report,
      now: new Date('2026-05-12T14:01:30.000Z'),
    });

    expect(snapshot.orchestrator.running.size).toBe(3);
    expect(snapshot.liveSessions).toHaveLength(3);
    expect(snapshot.runAttempts[0]).toMatchObject({
      phase: 'StreamingTurn',
      status: 'active',
      evidence: [
        expect.objectContaining({ type: 'claimed' }),
        expect.objectContaining({ type: 'workspace_prepared' }),
        expect.objectContaining({ type: 'agent_session_queued' }),
      ],
    });
    expect(snapshot.logs.map((entry) => entry.event)).toEqual(expect.arrayContaining([
      'agent_session_queued',
      'workspace_prepared',
    ]));
    expect(buildSymphonyHistorySessionSummaries(snapshot)).toContain(
      'Symphony session: SYM-001 agent/research/frontend-1 StreamingTurn active 1 turn, 3 evidence events',
    );
  });

  it('marks idle running sessions as stalled instead of refreshing synthetic activity', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-research',
      workspaceName: 'Research Lab',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const runningState = {
      ...state,
      branches: state.branches.map((branch) => branch.branchName.endsWith('/frontend-1')
        ? {
            ...branch,
            status: 'running' as const,
            progress: 42,
            runAttempt: 1,
            sessionId: 'symphony:ws-research:frontend-1',
            lastRunAt: '2026-05-07T10:00:00.000Z',
            lastHeartbeatAt: '2026-05-07T10:00:00.000Z',
            executionEvents: [{
              id: 'multitask:ws-research:frontend-1:heartbeat:2026-05-07T10:00:00.000Z',
              type: 'heartbeat' as const,
              at: '2026-05-07T10:00:00.000Z',
              summary: 'Frontend agent entered StreamingTurn.',
            }],
          }
        : branch),
    };
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Research Lab'));

    const snapshot = createSymphonyRuntimeSnapshot({
      state: runningState,
      report,
      now: new Date('2026-05-07T10:06:00.000Z'),
    });

    expect(snapshot.orchestrator.running.size).toBe(0);
    expect(snapshot.runAttempts[0]).toMatchObject({
      phase: 'Stalled',
      status: 'failed',
      error: 'No Codex events received for 6m 0s.',
    });
    expect(snapshot.liveSessions[0]).toMatchObject({
      lastCodexEvent: 'session_stalled',
      lastCodexTimestamp: '2026-05-07T10:00:00.000Z',
      lastCodexMessage: 'No Codex events received for 6m 0s.',
      lastActivitySummary: 'Frontend agent entered StreamingTurn.',
    });
    expect(snapshot.logs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: 'error',
        event: 'session_stalled',
        issueIdentifier: 'SYM-001',
        message: 'No Codex events received for 6m 0s.',
      }),
    ]));
    expect(summarizeSymphonyRuntime(snapshot)).toMatchObject({ running: 0, blocked: 1 });
    expect(buildSymphonyHistorySessionSummaries(snapshot)).toContain(
      'Symphony session: SYM-001 agent/research-lab/frontend-1 Stalled failed 1 turn, 1 evidence event',
    );
  });

  it('keeps Symphony issue identifiers stable when earlier tasks are closed', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-research',
      workspaceName: 'Research Lab',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const withFollowUp = addMultitaskTask(state, {
      title: 'Add smoke proof',
      projectId: state.projects[0].id,
      now: new Date('2026-05-07T10:04:00.000Z'),
    });
    const withoutDocumentation = disposeMultitaskBranch(withFollowUp, 'multitask:ws-research:documentation-3');
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Research Lab'));

    const snapshot = createSymphonyRuntimeSnapshot({ state: withoutDocumentation, report });

    expect(snapshot.issues.map((issue) => issue.identifier)).toEqual(['SYM-001', 'SYM-002', 'SYM-004']);
    expect(snapshot.workspaces.map((workspace) => workspace.issueIdentifier)).toEqual(['SYM-001', 'SYM-002', 'SYM-004']);
    expect(snapshot.workspaces[2]).toMatchObject({
      issueId: 'multitask:ws-research:add-smoke-proof-4',
      branchName: 'agent/research-lab/add-smoke-proof-4',
    });
  });

  it('surfaces retry, approval, and completed runtime summary state', () => {
    const initial = createMultitaskSubagentState({
      workspaceId: 'ws-build',
      workspaceName: 'Build Lab',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const state = promoteMultitaskBranch({
      ...initial,
      branches: [
        { ...initial.branches[0], status: 'blocked', progress: 45 },
        { ...initial.branches[1], status: 'ready', progress: 100 },
        { ...initial.branches[2], status: 'ready', progress: 100 },
      ],
    }, initial.branches[1].id, 'reviewer-agent');
    const report = buildPullRequestReview({
      title: 'Ready Symphony merge',
      author: 'agent-browser',
      summary: 'Ready for approval.',
      changedFiles: ['agent-browser/src/App.tsx'],
      validations: [{ label: 'Agent Browser verifier', command: 'npm.cmd run verify:agent-browser', status: 'passed' }],
      browserEvidence: [{ label: 'Visual smoke', path: 'output/playwright/agent-browser-symphony-system.png', kind: 'screenshot' }],
      reviewerComments: [],
    });

    const snapshot = createSymphonyRuntimeSnapshot({ state, report, now: new Date('2026-05-07T10:03:00.000Z') });
    const summary = summarizeSymphonyRuntime(snapshot);

    expect(snapshot.workflow.validation.status).toBe('ready');
    expect(snapshot.orchestrator.retryAttempts.size).toBe(1);
    expect(snapshot.retryEntries[0]).toMatchObject({
      issueIdentifier: 'SYM-001',
      attempt: 2,
      error: 'agent branch blocked',
    });
    expect(snapshot.review.mergeTarget).toBe('common branch');
    expect(snapshot.review.approvedBranchName).toBe('agent/build-lab/tests-2');
    expect(snapshot.review.branches[0].reviewerAgentDecision).toMatchObject({
      state: 'rejected',
      feedback: expect.arrayContaining([
        'Reviewer agent rejected this merge request.',
        'Branch is blocked; resolve the blocker before requesting merge approval.',
      ]),
    });
    expect(snapshot.review.branches[1]).toMatchObject({
      approvedBy: 'reviewer-agent',
      reviewerAgentDecision: {
        state: 'approved',
        feedback: ['Reviewer agent approved this merge request after a critical evidence check.'],
      },
    });
    expect(summary).toEqual({
      totalIssues: 3,
      running: 0,
      retryQueued: 1,
      awaitingApproval: 1,
      approved: 1,
      availableSlots: 4,
      readyForReview: 1,
      blocked: 1,
      workflowStatus: 'ready',
    });
  });

  it('treats completed no-file local tasks as done instead of review-gate blocked', () => {
    const initial = createMultitaskSubagentState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      request: 'add 1+1.',
      now: new Date('2026-05-12T14:00:00.000Z'),
    });
    const withTask = addMultitaskTask({
      ...initial,
      branches: [],
      selectedBranchId: null,
    }, {
      title: 'add 1+1.',
      projectId: initial.projects[0].id,
      now: new Date('2026-05-12T14:01:00.000Z'),
    });
    const state = {
      ...withTask,
      branches: withTask.branches.map((branch) => ({
        ...branch,
        status: 'promoted' as const,
        progress: 100,
        executionEvents: [{
          id: `${branch.id}:agent_completed:2026-05-12T14:04:00.000Z:1`,
          type: 'agent_completed' as const,
          at: '2026-05-12T14:04:00.000Z',
          summary: 'Agent completed in SYM-001: 1 + 1 = 2',
        }],
      })),
    };
    const report = buildPullRequestReview({
      title: 'Direct local task',
      author: 'agent-browser',
      summary: 'Completed without file changes.',
      changedFiles: [],
      validations: [],
      browserEvidence: [],
      reviewerComments: [],
    });

    const snapshot = createSymphonyRuntimeSnapshot({
      state,
      report,
      now: new Date('2026-05-12T14:44:08.000Z'),
    });

    expect(snapshot.logs.map((entry) => entry.event)).toContain('tasks_completed');
    expect(snapshot.logs.map((entry) => entry.event)).not.toContain('review_gate_waiting');
    expect(snapshot.review.branches[0].reviewerAgentDecision).toEqual({
      state: 'approved',
      feedback: ['Task completed directly without file changes or merge review.'],
    });
    expect(summarizeSymphonyRuntime(snapshot)).toMatchObject({
      blocked: 0,
      approved: 1,
      readyForReview: 0,
    });
  });

  it('keeps empty workspace names and invalid timestamps deterministic', () => {
    const state = createMultitaskSubagentState({
      workspaceId: '',
      workspaceName: '',
      request: 'parallelize the tests work',
      now: new Date('not-a-date'),
    });
    const report = buildPullRequestReview({
      title: 'No active runners',
      author: 'agent-browser',
      summary: '',
      changedFiles: [],
      validations: [],
      browserEvidence: [],
      reviewerComments: [],
    });

    const snapshot = createSymphonyRuntimeSnapshot({ state: { ...state, workspaceName: '!!!', branches: [] }, report, now: new Date('not-a-date') });

    expect(snapshot.workflow.config.taskStore.namespace).toBe('workspace');
    expect(snapshot.workflow.reload.lastReloadedAt).toBe('2026-05-07T10:00:00.000Z');
    expect(snapshot.orchestrator.running.size).toBe(0);
    expect(snapshot.logs.map((entry) => entry.event)).toEqual(['idle']);
    expect(summarizeSymphonyRuntime(snapshot)).toMatchObject({
      totalIssues: 0,
      running: 0,
      retryQueued: 0,
      availableSlots: 4,
      workflowStatus: 'ready',
    });
  });

  it('disables reviewer-agent decisions when Symphony autopilot is off', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-review',
      workspaceName: 'Review Lab',
      request: 'parallelize the frontend and tests work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const readyState = {
      ...state,
      branches: state.branches.map((branch) => ({ ...branch, status: 'ready' as const, progress: 100 })),
    };
    const report = buildPullRequestReview({
      title: 'Ready merge request',
      author: 'agent-browser',
      changedFiles: ['agent-browser/src/App.css'],
      validations: [{ label: 'Agent Browser verifier', command: 'npm.cmd run verify:agent-browser', status: 'passed' }],
      browserEvidence: [{ label: 'Visual smoke', path: 'output/playwright/agent-browser-symphony-system.png', kind: 'screenshot' }],
      reviewerComments: [],
    });

    const snapshot = createSymphonyRuntimeSnapshot({
      state: readyState,
      report,
      autopilotSettings: { autopilotEnabled: false },
    });

    expect(snapshot.review.branches[0].reviewerAgentDecision).toEqual({
      state: 'disabled',
      feedback: ['Enable Symphony autopilot before reviewer-agent approval is available.'],
    });
  });

  it('keeps reviewer-agent rejection critical across validation, evidence, and risk gaps', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-critical',
      workspaceName: 'Critical Lab',
      request: 'parallelize runtime state work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const readyState = {
      ...state,
      branches: state.branches.map((branch) => ({ ...branch, status: 'ready' as const, progress: 100 })),
    };
    const report = buildPullRequestReview({
      title: 'Runtime storage merge',
      author: 'agent-browser',
      summary: 'Touches durable workspace state and validation plumbing.',
      changedFiles: ['agent-browser/src/services/sessionState.ts'],
      validations: [
        { label: 'Unit tests', command: 'npm.cmd run test', status: 'failed' },
        { label: 'Visual smoke', command: 'npm.cmd run visual:smoke', status: 'pending' },
      ],
      browserEvidence: [],
      reviewerComments: [],
    });

    const snapshot = createSymphonyRuntimeSnapshot({ state: readyState, report });

    expect(snapshot.review.branches[0].reviewerAgentDecision).toEqual({
      state: 'rejected',
      feedback: [
        'Reviewer agent rejected this merge request.',
        'Failing validation is attached to the merge request.',
        'Pending or missing validation must pass before merge.',
        'No browser evidence is attached for reviewer inspection.',
        'Reviewer found unresolved risk: Validation failed.',
        'Address the feedback, update validation evidence, and request review again.',
      ],
    });
  });

  it('validates persisted Symphony autopilot settings', () => {
    expect(isSymphonyAutopilotSettings({ autopilotEnabled: true })).toBe(true);
    expect(isSymphonyAutopilotSettings({ autopilotEnabled: false })).toBe(true);
    expect(isSymphonyAutopilotSettings({ autopilotEnabled: 'yes' })).toBe(false);
    expect(isSymphonyAutopilotSettings(null)).toBe(false);
    expect(isSymphonyAutopilotSettings([])).toBe(false);
  });
});
