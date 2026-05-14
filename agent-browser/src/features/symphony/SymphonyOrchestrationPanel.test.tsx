import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MULTITASK_SUBAGENT_STATE,
  createMultitaskSubagentState,
  reconcileMultitaskSubagentRuns,
  reduceMultitaskBranchLifecycle,
} from '../../services/multitaskSubagents';
import { buildPullRequestReview, createSamplePullRequestReviewInput } from '../../services/prReviewUnderstanding';
import { createSymphonyRuntimeSnapshot } from '../../services/symphonyRuntime';
import {
  SymphonyActivityPanel,
  SymphonyWorkspaceApp,
} from './SymphonyOrchestrationPanel';

describe('Symphony system surfaces', () => {
  it('renders the primary multi-agent task management app in the render area', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Research'));
    const snapshot = createSymphonyRuntimeSnapshot({ state, report });
    const onPromoteBranch = vi.fn();
    const onStartFollowUp = vi.fn();

    render(
      <SymphonyWorkspaceApp
        snapshot={snapshot}
        onApproveMerge={onPromoteBranch}
        onManageBranch={vi.fn()}
        onRequestChanges={vi.fn()}
        onStartTask={vi.fn()}
        onStartFollowUp={onStartFollowUp}
      />,
    );

    const app = screen.getByRole('region', { name: 'Symphony task management system' });
    expect(app).toHaveTextContent('Agent Workspaces');
    expect(app).toHaveTextContent('WORKFLOW.md');
    expect(app).toHaveTextContent('Isolated Workspaces');
    expect(app).toHaveTextContent('Review Gate');
    expect(app).toHaveTextContent('agent/research/frontend-1');
    expect(app).toHaveTextContent('SYM-001');
    expect(app).toHaveTextContent('Queued');
    expect(app).not.toHaveTextContent('PR');

    const reviewGate = within(app).getByRole('region', { name: 'Review gate' });
    expect(reviewGate).toHaveTextContent('No branch is ready for review.');

    expect(within(app).queryByRole('button', { name: 'agent/research/frontend-1 is not ready for merge approval' })).not.toBeInTheDocument();
    expect(within(app).queryByRole('button', { name: 'Reviewer agent waiting for agent/research/frontend-1 to finish' })).not.toBeInTheDocument();
    expect(within(app).queryByRole('button', { name: /Explain highest risk group/ })).not.toBeInTheDocument();
  });

  it('does not manufacture task activity before the user starts a Symphony task', () => {
    const report = buildPullRequestReview({
      title: 'No active Symphony task',
      author: 'agent-browser',
      changedFiles: [],
      validations: [],
      browserEvidence: [],
      reviewerComments: [],
    });
    const snapshot = createSymphonyRuntimeSnapshot({
      state: {
        ...DEFAULT_MULTITASK_SUBAGENT_STATE,
        workspaceId: 'ws-idle',
        workspaceName: 'Idle Lab',
      },
      report,
    });
    const onStartTask = vi.fn();

    render(
      <SymphonyWorkspaceApp
        snapshot={snapshot}
        onApproveMerge={vi.fn()}
        onManageBranch={vi.fn()}
        onRequestChanges={vi.fn()}
        onStartTask={onStartTask}
        onStartFollowUp={vi.fn()}
      />,
    );

    const app = screen.getByRole('region', { name: 'Symphony task management system' });
    expect(app).toHaveTextContent('No active Symphony task');
    expect(app).not.toHaveTextContent('agent/idle-lab/frontend-1');
    expect(app).not.toHaveTextContent('Running');
    expect(app).not.toHaveTextContent('Slots');
    expect(app).not.toHaveTextContent('Pending');

    fireEvent.change(screen.getByLabelText('Symphony task request'), {
      target: { value: 'split frontend and validation work' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start Symphony task' }));
    expect(onStartTask).toHaveBeenCalledWith('split frontend and validation work');
  });

  it('keeps the sidebar as a compact companion instead of duplicating the full app', () => {
    const initial = createMultitaskSubagentState({
      workspaceId: 'ws-build',
      workspaceName: 'Build Lab',
      request: '',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const promotedBranch = { ...initial.branches[0], status: 'promoted' as const, progress: 160 };
    const state = {
      ...initial,
      foregroundBranchId: promotedBranch.id,
      branches: [
        promotedBranch,
        { ...initial.branches[1], status: 'ready' as const, progress: -10, validation: [] },
      ],
    };
    const report = buildPullRequestReview({
      title: 'Ready branch merge',
      author: 'agent-browser',
      summary: 'Ready merge approval.',
      changedFiles: ['agent-browser/src/App.css'],
      validations: [{ label: 'Agent Browser verifier', command: 'npm.cmd run verify:agent-browser', status: 'passed' }],
      browserEvidence: [{ label: 'Visual smoke', path: 'output/playwright/agent-browser-visual-smoke.png', kind: 'screenshot' }],
      reviewerComments: [],
    });
    const snapshot = createSymphonyRuntimeSnapshot({ state, report });

    const onApproveMerge = vi.fn();
    const onStartFollowUp = vi.fn();
    render(
      <SymphonyActivityPanel
        snapshot={snapshot}
        onApproveMerge={onApproveMerge}
        onRequestChanges={vi.fn()}
        onStartTask={vi.fn()}
        onStartFollowUp={onStartFollowUp}
      />,
    );

    const panel = screen.getByRole('region', { name: 'Symphony activity summary' });
    expect(panel).toHaveTextContent('Current phase');
    expect(panel).toHaveTextContent('Approval ready');
    expect(panel).not.toHaveTextContent('State store');
    expect(panel).not.toHaveTextContent('IndexedDB');
    expect(panel).not.toHaveTextContent('Slots');
    expect(panel).not.toHaveTextContent('approved');
    expect(panel).not.toHaveTextContent('agent/build-lab/tests-2');
    expect(panel).not.toHaveTextContent('Structured event log');
    expect(panel).not.toHaveTextContent('WORKFLOW.md prompt');
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument();
    expect(onApproveMerge).not.toHaveBeenCalled();
    expect(onStartFollowUp).not.toHaveBeenCalled();
  });

  it('starts the needs-review rework flow from the render-area review gate', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-review',
      workspaceName: 'Review Lab',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const readyState = {
      ...state,
      branches: state.branches.map((branch) => branch.branchName.endsWith('/tests-2')
        ? { ...branch, status: 'ready' as const, progress: 100 }
        : branch),
    };
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Review Lab'));
    const snapshot = createSymphonyRuntimeSnapshot({ state: readyState, report });
    const onRequestChanges = vi.fn();

    render(
      <SymphonyWorkspaceApp
        snapshot={snapshot}
        onApproveMerge={vi.fn()}
        onManageBranch={vi.fn()}
        onRequestChanges={onRequestChanges}
        onStartTask={vi.fn()}
        onStartFollowUp={vi.fn()}
      />,
    );

    const reviewGate = screen.getByRole('region', { name: 'Review gate' });
    fireEvent.click(within(reviewGate).getByRole('button', { name: 'Request changes for agent/review-lab/tests-2' }));

    expect(onRequestChanges).toHaveBeenCalledWith(
      'multitask:ws-review:tests-2',
      expect.stringContaining('Reviewer agent rejected merge request for agent/review-lab/tests-2.'),
    );
    expect(within(reviewGate).queryByRole('button', { name: /Start rework/ })).not.toBeInTheDocument();
  });

  it('exposes spec-backed branch lifecycle controls from the workspace table', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-control',
      workspaceName: 'Control Lab',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const managedState = {
      ...state,
      branches: [
        { ...state.branches[0], status: 'running' as const, progress: 45 },
        { ...state.branches[1], status: 'stopped' as const, progress: 30 },
        { ...state.branches[2], status: 'blocked' as const, progress: 20 },
      ],
    };
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Control Lab'));
    const snapshot = createSymphonyRuntimeSnapshot({ state: managedState, report });
    const onManageBranch = vi.fn();

    render(
      <SymphonyWorkspaceApp
        snapshot={snapshot}
        onApproveMerge={vi.fn()}
        onManageBranch={onManageBranch}
        onRequestChanges={vi.fn()}
        onStartTask={vi.fn()}
        onStartFollowUp={vi.fn()}
      />,
    );

    const app = screen.getByRole('region', { name: 'Symphony task management system' });
    fireEvent.click(within(app).getByRole('button', { name: 'Stop agent session for agent/control-lab/frontend-1' }));
    fireEvent.click(within(app).getByRole('button', { name: 'Start agent session for agent/control-lab/tests-2' }));
    fireEvent.click(within(app).getByRole('button', { name: 'Retry task for agent/control-lab/documentation-3' }));
    fireEvent.click(within(app).getByRole('button', { name: 'Close task and dispose workspace for agent/control-lab/tests-2' }));

    expect(onManageBranch).toHaveBeenCalledWith('multitask:ws-control:frontend-1', 'stop');
    expect(onManageBranch).toHaveBeenCalledWith('multitask:ws-control:tests-2', 'start');
    expect(onManageBranch).toHaveBeenCalledWith('multitask:ws-control:documentation-3', 'retry');
    expect(onManageBranch).toHaveBeenCalledWith('multitask:ws-control:tests-2', 'dispose');
    expect(within(app).queryByRole('button', { name: /Cancel task/ })).not.toBeInTheDocument();
  });

  it('shows execution evidence for a dispatched task instead of reporting that it did not run', () => {
    const initial = createMultitaskSubagentState({
      workspaceId: 'ws-recover',
      workspaceName: 'Recover Lab',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-12T14:00:00.000Z'),
    });
    const { state } = reconcileMultitaskSubagentRuns(initial, {
      maxConcurrentAgents: 1,
      now: new Date('2026-05-12T14:01:00.000Z'),
    });
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Recover Lab'));
    const snapshot = createSymphonyRuntimeSnapshot({ state, report });

    render(
      <SymphonyWorkspaceApp
        snapshot={snapshot}
        onApproveMerge={vi.fn()}
        onManageBranch={vi.fn()}
        onRequestChanges={vi.fn()}
        onStartTask={vi.fn()}
        onStartFollowUp={vi.fn()}
      />,
    );

    const app = screen.getByRole('region', { name: 'Symphony task management system' });
    const runningTask = within(app).getByRole('button', { name: 'Open task SYM-001 Frontend branch' }).closest('tr') as HTMLElement;
    expect(runningTask).toHaveTextContent('Running');
    expect(runningTask).toHaveTextContent('agent active');
    expect(runningTask).toHaveTextContent('3 events');
    expect(runningTask).not.toHaveTextContent('not run');

    fireEvent.click(within(app).getByRole('button', { name: 'Open task SYM-001 Frontend branch' }));
    const detail = within(app).getByRole('region', { name: 'Symphony task detail' });
    expect(detail).toHaveTextContent('agent active');
    expect(detail).not.toHaveTextContent('not run');
  });

  it('keeps stopped agent-session evidence visible instead of falling back to not run', () => {
    const initial = createMultitaskSubagentState({
      workspaceId: 'ws-recover',
      workspaceName: 'Recover Lab',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-12T14:00:00.000Z'),
    });
    const recovered = reconcileMultitaskSubagentRuns(initial, {
      maxConcurrentAgents: 1,
      now: new Date('2026-05-12T14:01:00.000Z'),
    }).state;
    const state = reduceMultitaskBranchLifecycle(recovered, recovered.branches[0].id, 'stop');
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Recover Lab'));
    const snapshot = createSymphonyRuntimeSnapshot({ state, report });

    render(
      <SymphonyWorkspaceApp
        snapshot={snapshot}
        onApproveMerge={vi.fn()}
        onManageBranch={vi.fn()}
        onRequestChanges={vi.fn()}
        onStartTask={vi.fn()}
        onStartFollowUp={vi.fn()}
      />,
    );

    const app = screen.getByRole('region', { name: 'Symphony task management system' });
    const stoppedTask = within(app).getByRole('button', { name: 'Open task SYM-001 Frontend branch' }).closest('tr') as HTMLElement;
    expect(stoppedTask).toHaveTextContent('stopped');
    expect(stoppedTask).toHaveTextContent('4 events');
    expect(stoppedTask).not.toHaveTextContent('not run');
  });

  it('exposes Linear-style project and task management in the render area', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-product',
      workspaceName: 'Product Lab',
      request: 'parallelize the frontend and tests work',
      now: new Date('2026-05-10T10:00:00.000Z'),
    });
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Product Lab'));
    const snapshot = createSymphonyRuntimeSnapshot({ state, report });
    const onCreateProject = vi.fn();
    const onCreateTask = vi.fn();
    const onSelectProject = vi.fn();
    const onSelectTask = vi.fn();

    render(
      <SymphonyWorkspaceApp
        snapshot={snapshot}
        onApproveMerge={vi.fn()}
        onManageBranch={vi.fn()}
        onRequestChanges={vi.fn()}
        onStartTask={vi.fn()}
        onCreateProject={onCreateProject}
        onCreateTask={onCreateTask}
        onSelectProject={onSelectProject}
        onSelectTask={onSelectTask}
        onStartFollowUp={vi.fn()}
      />,
    );

    const app = screen.getByRole('region', { name: 'Symphony task management system' });
    const projects = within(app).getByRole('navigation', { name: 'Symphony projects' });
    expect(projects).toHaveTextContent('Projects');
    expect(projects).toHaveTextContent('Product Lab');
    expect(within(projects).getByRole('button', { name: 'Open project Product Lab' })).toHaveAttribute('aria-current', 'page');

    fireEvent.change(within(projects).getByLabelText('New project name'), {
      target: { value: 'Release gate' },
    });
    fireEvent.click(within(projects).getByRole('button', { name: 'Create Symphony project' }));
    expect(onCreateProject).toHaveBeenCalledWith('Release gate');

    const queue = within(app).getByRole('region', { name: 'Symphony work queue' });
    expect(queue).toHaveTextContent('Work queue');
    fireEvent.change(within(queue).getByLabelText('New task title'), {
      target: { value: 'Add smoke proof' },
    });
    fireEvent.click(within(queue).getByRole('button', { name: 'Create Symphony task' }));
    expect(onCreateTask).toHaveBeenCalledWith('Add smoke proof', 'multitask-project:ws-product:symphony');

    fireEvent.click(within(queue).getByRole('button', { name: 'Open task SYM-001 Frontend branch' }));
    expect(onSelectTask).toHaveBeenCalledWith('multitask:ws-product:frontend-1');

    fireEvent.click(within(projects).getByRole('button', { name: 'Open project Product Lab' }));
    expect(onSelectProject).toHaveBeenCalledWith('multitask-project:ws-product:symphony');

    const detail = within(app).getByRole('region', { name: 'Symphony task detail' });
    expect(detail).toHaveTextContent('Frontend branch');
    expect(detail).toHaveTextContent('agent/product-lab/frontend-1');
    expect(detail).toHaveTextContent('Review');
  });

  it('renders a project task board in Symphony instead of relying on an extension feature page', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-board',
      workspaceName: 'Board Lab',
      request: 'parallelize frontend, tests, and documentation work',
      now: new Date('2026-05-10T10:00:00.000Z'),
    });
    const managedState = {
      ...state,
      branches: [
        { ...state.branches[0], status: 'running' as const, progress: 45 },
        { ...state.branches[1], status: 'ready' as const, progress: 100 },
        { ...state.branches[2], status: 'blocked' as const, progress: 20 },
      ],
    };
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Board Lab'));
    const snapshot = createSymphonyRuntimeSnapshot({ state: managedState, report });
    const onSelectTask = vi.fn();

    render(
      <SymphonyWorkspaceApp
        snapshot={snapshot}
        onApproveMerge={vi.fn()}
        onManageBranch={vi.fn()}
        onRequestChanges={vi.fn()}
        onStartTask={vi.fn()}
        onSelectTask={onSelectTask}
        onStartFollowUp={vi.fn()}
      />,
    );

    const board = screen.getByRole('region', { name: 'Symphony project board' });
    expect(board).toHaveTextContent('Project board');
    expect(within(board).getByRole('region', { name: 'Backlog lane' })).toHaveTextContent('0');
    expect(within(board).getByRole('region', { name: 'Active lane' })).toHaveTextContent('Frontend branch');
    expect(within(board).getByRole('region', { name: 'Review lane' })).toHaveTextContent('Tests branch');
    expect(within(board).getByRole('region', { name: 'Blocked lane' })).toHaveTextContent('Documentation branch');
    expect(within(board).getByRole('region', { name: 'Done lane' })).toHaveTextContent('0');

    fireEvent.click(within(board).getByRole('button', { name: 'Open board task SYM-002 Tests branch' }));
    expect(onSelectTask).toHaveBeenCalledWith('multitask:ws-board:tests-2');
    expect(screen.queryByRole('region', { name: /Symphony internal task orchestration feature pane/i })).not.toBeInTheDocument();
  });

  it('shows the selected task live feed and makes idle running work visibly stalled', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-feed',
      workspaceName: 'Feed Lab',
      request: 'parallelize the frontend and tests work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const runningState = {
      ...state,
      branches: state.branches.map((branch) => {
        if (branch.branchName.endsWith('/frontend-1')) {
          return {
            ...branch,
            status: 'running' as const,
            progress: 40,
            runAttempt: 1,
            sessionId: 'symphony:ws-feed:frontend-1',
            lastRunAt: '2026-05-07T10:00:00.000Z',
            lastHeartbeatAt: '2026-05-07T10:00:00.000Z',
            executionEvents: [{
              id: 'multitask:ws-feed:frontend-1:heartbeat:2026-05-07T10:00:00.000Z',
              type: 'heartbeat' as const,
              at: '2026-05-07T10:00:00.000Z',
              summary: 'Frontend agent entered StreamingTurn.',
            }],
          };
        }
        if (branch.branchName.endsWith('/tests-2')) {
          return {
            ...branch,
            status: 'running' as const,
            progress: 55,
            runAttempt: 1,
            sessionId: 'symphony:ws-feed:tests-2',
            lastRunAt: '2026-05-07T10:04:30.000Z',
            lastHeartbeatAt: '2026-05-07T10:05:45.000Z',
            executionEvents: [{
              id: 'multitask:ws-feed:tests-2:heartbeat:2026-05-07T10:05:45.000Z',
              type: 'heartbeat' as const,
              at: '2026-05-07T10:05:45.000Z',
              summary: 'Tests agent is streaming npm output.',
            }],
          };
        }
        return branch;
      }),
    };
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Feed Lab'));
    const snapshot = createSymphonyRuntimeSnapshot({
      state: runningState,
      report,
      now: new Date('2026-05-07T10:06:00.000Z'),
    });
    const onSelectTask = vi.fn();
    const { rerender } = render(
      <SymphonyWorkspaceApp
        snapshot={snapshot}
        onApproveMerge={vi.fn()}
        onManageBranch={vi.fn()}
        onRequestChanges={vi.fn()}
        onStartTask={vi.fn()}
        onSelectTask={onSelectTask}
        onStartFollowUp={vi.fn()}
      />,
    );

    const app = screen.getByRole('region', { name: 'Symphony task management system' });
    const detail = within(app).getByRole('region', { name: 'Symphony task detail' });
    expect(detail).toHaveTextContent('Stalled');
    expect(detail).toHaveTextContent('Live chat feed');
    expect(detail).toHaveTextContent('No Codex events received for 6m 0s.');
    expect(detail).toHaveTextContent('Frontend agent entered StreamingTurn.');
    expect(within(app).getAllByText('Stalled').length).toBeGreaterThan(0);

    fireEvent.click(within(app).getByRole('button', { name: 'Open task SYM-002 Tests branch' }));
    expect(onSelectTask).toHaveBeenCalledWith('multitask:ws-feed:tests-2');

    rerender(
      <SymphonyWorkspaceApp
        snapshot={{ ...snapshot, selectedIssueId: 'multitask:ws-feed:tests-2' }}
        onApproveMerge={vi.fn()}
        onManageBranch={vi.fn()}
        onRequestChanges={vi.fn()}
        onStartTask={vi.fn()}
        onSelectTask={onSelectTask}
        onStartFollowUp={vi.fn()}
      />,
    );

    const selectedDetail = within(app).getByRole('region', { name: 'Symphony task detail' });
    expect(selectedDetail).toHaveTextContent('Tests branch');
    expect(selectedDetail).toHaveTextContent('Running');
    expect(selectedDetail).toHaveTextContent('Tests agent is streaming npm output.');
    expect(selectedDetail).not.toHaveTextContent('No Codex events received for 6m 0s.');
  });

  it('renders ready, approved, blocked, and empty review states without sidebar duplication', () => {
    const initial = createMultitaskSubagentState({
      workspaceId: 'ws-ready',
      workspaceName: 'Ready Lab',
      request: 'parallelize the frontend, tests, and documentation work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const state = {
      ...initial,
      foregroundBranchId: initial.branches[0].id,
      branches: [
        { ...initial.branches[0], status: 'promoted' as const, progress: 100 },
        { ...initial.branches[1], status: 'blocked' as const, progress: 20 },
        { ...initial.branches[2], status: 'ready' as const, progress: 100 },
      ],
    };
    const report = buildPullRequestReview({
      title: 'Ready Symphony merge',
      author: 'agent-browser',
      summary: 'Ready for approval.',
      changedFiles: ['agent-browser/src/App.css'],
      validations: [{ label: 'Agent Browser verifier', command: 'npm.cmd run verify:agent-browser', status: 'passed' }],
      browserEvidence: [{ label: 'Visual smoke', path: 'output/playwright/agent-browser-symphony-system.png', kind: 'screenshot' }],
      reviewerComments: [],
    });
    const snapshot = createSymphonyRuntimeSnapshot({ state, report });
    const quietSnapshot = {
      ...snapshot,
      logs: [],
      review: {
        ...snapshot.review,
        report: { ...snapshot.review.report, followUps: [] },
      },
    };

    render(
      <>
        <SymphonyWorkspaceApp
          snapshot={quietSnapshot}
          onApproveMerge={vi.fn()}
          onManageBranch={vi.fn()}
          onRequestChanges={vi.fn()}
          onStartTask={vi.fn()}
          onStartFollowUp={vi.fn()}
        />
        <SymphonyActivityPanel
          snapshot={{ ...snapshot, logs: [], review: { ...snapshot.review, branches: snapshot.review.branches.map((branch) => ({ ...branch, approvalState: 'approved' as const })), report: { ...snapshot.review.report, followUps: [] } } }}
          onApproveMerge={vi.fn()}
          onRequestChanges={vi.fn()}
          onStartTask={vi.fn()}
          onStartFollowUp={vi.fn()}
        />
      </>,
    );

    const app = screen.getByRole('region', { name: 'Symphony task management system' });
    expect(app).toHaveTextContent(/ready/i);
    expect(app).toHaveTextContent('No blocking review feedback.');
    expect(within(app).queryByRole('button', { name: 'agent/ready-lab/frontend-1 merge approved' })).not.toBeInTheDocument();
    expect(within(app).getByRole('button', { name: 'Approve merge as user for agent/ready-lab/documentation-3' })).toBeInTheDocument();

    const panel = screen.getByRole('region', { name: 'Symphony activity summary' });
    expect(panel).not.toHaveTextContent('Reviewer Feedback');
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument();
  });

  it('lets the reviewer agent approve ready merge requests when autopilot is enabled', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-reviewer',
      workspaceName: 'Reviewer Lab',
      request: 'parallelize the frontend and tests work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const readyState = {
      ...state,
      branches: state.branches.map((branch) => ({ ...branch, status: 'ready' as const, progress: 100 })),
    };
    const report = buildPullRequestReview({
      title: 'Clean merge request',
      author: 'agent-browser',
      summary: 'Ready clean merge.',
      changedFiles: ['agent-browser/src/App.css'],
      validations: [{ label: 'Agent Browser verifier', command: 'npm.cmd run verify:agent-browser', status: 'passed' }],
      browserEvidence: [{ label: 'Visual smoke', path: 'output/playwright/agent-browser-symphony-system.png', kind: 'screenshot' }],
      reviewerComments: [],
    });
    const snapshot = createSymphonyRuntimeSnapshot({ state: readyState, report });
    const onApproveMerge = vi.fn();

    render(
      <SymphonyWorkspaceApp
        snapshot={snapshot}
        onApproveMerge={onApproveMerge}
        onManageBranch={vi.fn()}
        onRequestChanges={vi.fn()}
        onStartTask={vi.fn()}
        onStartFollowUp={vi.fn()}
      />,
    );

    const app = screen.getByRole('region', { name: 'Symphony task management system' });
    expect(app).toHaveTextContent('approved');
    fireEvent.click(within(app).getByRole('button', { name: 'Approve merge by reviewer agent for agent/reviewer-lab/frontend-1' }));
    expect(onApproveMerge).toHaveBeenCalledWith('multitask:ws-reviewer:frontend-1', 'reviewer-agent');
  });

  it('handles sparse snapshot data with fallback runtime labels', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-sparse',
      workspaceName: 'Sparse Lab',
      request: 'parallelize the frontend work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const report = buildPullRequestReview(createSamplePullRequestReviewInput('Sparse Lab'));
    const snapshot = createSymphonyRuntimeSnapshot({ state, report });
    const onStartFollowUp = vi.fn();
    const sparseSnapshot = {
      ...snapshot,
      workflow: {
        ...snapshot.workflow,
        validation: { status: 'blocked' as const, errors: ['workflow file missing'] },
        config: {
          ...snapshot.workflow.config,
          polling: { intervalMs: 500 },
        },
      },
      issues: [{ ...snapshot.issues[0], branchName: null, title: '' }],
      runAttempts: [],
      liveSessions: [],
      review: { ...snapshot.review, branches: [] },
    };

    render(
      <>
        <SymphonyWorkspaceApp
          snapshot={sparseSnapshot}
          onApproveMerge={vi.fn()}
          onManageBranch={vi.fn()}
          onRequestChanges={vi.fn()}
          onStartTask={vi.fn()}
          onStartFollowUp={onStartFollowUp}
        />
        <SymphonyActivityPanel
          snapshot={sparseSnapshot}
          onApproveMerge={vi.fn()}
          onRequestChanges={vi.fn()}
          onStartTask={vi.fn()}
          onStartFollowUp={vi.fn()}
        />
      </>,
    );

    const app = screen.getByRole('region', { name: 'Symphony task management system' });
    expect(app).toHaveTextContent('Queued');
    expect(app).toHaveTextContent('not ready');
    expect(app).toHaveTextContent('agent/sparse-lab/frontend-1');
    expect(app).toHaveTextContent('workflow file missing');
    const panel = screen.getByRole('region', { name: 'Symphony activity summary' });
    expect(panel).toHaveTextContent('Review waiting');
    expect(within(app).queryByRole('button', { name: 'Reviewer agent waiting for agent/sparse-lab/frontend-1 to finish' })).not.toBeInTheDocument();
    expect(onStartFollowUp).not.toHaveBeenCalled();
  });

  it('disables reviewer-agent approval when autopilot settings are off', () => {
    const state = createMultitaskSubagentState({
      workspaceId: 'ws-disabled',
      workspaceName: 'Disabled Lab',
      request: 'parallelize the frontend work',
      now: new Date('2026-05-07T10:00:00.000Z'),
    });
    const readyState = {
      ...state,
      branches: state.branches.map((branch) => ({ ...branch, status: 'ready' as const, progress: 100 })),
    };
    const report = buildPullRequestReview({
      title: 'Clean merge request',
      author: 'agent-browser',
      changedFiles: ['agent-browser/src/App.css'],
      validations: [{ label: 'Agent Browser verifier', command: 'npm.cmd run verify:agent-browser', status: 'passed' }],
      browserEvidence: [{ label: 'Visual smoke', path: 'output/playwright/agent-browser-symphony-system.png', kind: 'screenshot' }],
      reviewerComments: [],
    });
    const snapshot = createSymphonyRuntimeSnapshot({ state: readyState, report, autopilotSettings: { autopilotEnabled: false } });

    render(
      <>
        <SymphonyWorkspaceApp
          snapshot={snapshot}
          onApproveMerge={vi.fn()}
          onManageBranch={vi.fn()}
          onRequestChanges={vi.fn()}
          onStartTask={vi.fn()}
          onStartFollowUp={vi.fn()}
        />
        <SymphonyActivityPanel
          snapshot={snapshot}
          onApproveMerge={vi.fn()}
          onRequestChanges={vi.fn()}
          onStartTask={vi.fn()}
          onStartFollowUp={vi.fn()}
        />
      </>,
    );

    expect(screen.getAllByText('autopilot off').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Reviewer agent disabled for agent/disabled-lab/frontend-1' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Symphony activity summary' })).toHaveTextContent('Reviewer disabled');
  });
});
