import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Folder,
  GitBranch,
  GitMerge,
  ListChecks,
  MessageSquare,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Square,
  Trash2,
} from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { MultitaskBranchLifecycleAction } from '../../services/multitaskSubagents';
import {
  summarizeSymphonyRuntime,
  type SymphonyApprovalActor,
  type SymphonyRuntimeSnapshot,
} from '../../services/symphonyRuntime';

export interface SymphonyWorkspaceAppProps {
  snapshot: SymphonyRuntimeSnapshot;
  onApproveMerge: (branchId: string, actor: SymphonyApprovalActor) => void;
  onManageBranch: (branchId: string, action: MultitaskBranchLifecycleAction) => void;
  onRequestChanges: (branchId: string, prompt: string) => void;
  onStartTask: (request: string) => void;
  onStartFollowUp: (prompt: string) => void;
  onCreateProject?: (name: string) => void;
  onCreateTask?: (title: string, projectId: string | null) => void;
  onSelectProject?: (projectId: string) => void;
  onSelectTask?: (branchId: string) => void;
}

export interface SymphonyActivityPanelProps {
  snapshot: SymphonyRuntimeSnapshot;
  onApproveMerge: (branchId: string, actor: SymphonyApprovalActor) => void;
  onRequestChanges: (branchId: string, prompt: string) => void;
  onStartTask: (request: string) => void;
  onStartFollowUp: (prompt: string) => void;
}

const NUMBER_FORMATTER = new Intl.NumberFormat(undefined);

export function SymphonyWorkspaceApp({
  snapshot,
  onApproveMerge,
  onManageBranch,
  onRequestChanges,
  onStartTask,
  onStartFollowUp,
  onCreateProject = noop,
  onCreateTask = noopTask,
  onSelectProject = noop,
  onSelectTask = noop,
}: SymphonyWorkspaceAppProps) {
  const summary = summarizeSymphonyRuntime(snapshot);
  const latestLog = snapshot.logs[snapshot.logs.length - 1] ?? null;
  const projects = snapshot.projects;
  const activeProjectId = snapshot.activeProjectId ?? projects[0]?.id ?? null;
  const visibleWorkspaces = activeProjectId
    ? snapshot.workspaces.filter((workspace) => {
        const issue = snapshot.issues.find((entry) => entry.id === workspace.issueId);
        return issue?.projectId === activeProjectId || (!issue?.projectId && projects.length <= 1);
      })
    : snapshot.workspaces;
  const selectedWorkspace = visibleWorkspaces.find((workspace) => workspace.issueId === snapshot.selectedIssueId)
    ?? visibleWorkspaces[0]
    ?? null;
  const selectedIssueId = selectedWorkspace?.issueId ?? snapshot.selectedIssueId ?? null;
  const selectedReviewBranch = selectedIssueId
    ? snapshot.review.branches.find((branch) => branch.branchId === selectedIssueId) ?? null
    : null;
  const reviewFocus = findReviewFocus(snapshot, selectedReviewBranch);
  const hasWorkspaces = snapshot.workspaces.length > 0;

  return (
    <section className="symphony-system" role="region" aria-label="Symphony task management system">
      <header className="symphony-system-header">
        <div className="symphony-system-title">
          <span className="symphony-kicker"><Activity size={13} aria-hidden="true" /> Symphony</span>
          <h1>Agent Workspaces</h1>
        </div>
        <dl className="symphony-inline-metrics" aria-label="Symphony runtime summary">
          <MetricItem label="Tasks" value={summary.totalIssues} />
          <MetricItem label="Ready" value={summary.awaitingApproval} />
          <MetricItem label="Blocked" value={summary.blocked} />
        </dl>
      </header>

      {!hasWorkspaces ? (
        <SymphonyEmptyTaskState onStartTask={onStartTask} />
      ) : null}

      <div className="symphony-system-layout">
        <ProjectNavigator
          projects={projects}
          activeProjectId={activeProjectId}
          onCreateProject={onCreateProject}
          onSelectProject={onSelectProject}
        />

        <section className="symphony-surface symphony-surface--workspaces" role="region" aria-label="Symphony work queue">
          <div className="symphony-work-queue-header">
            <div className="symphony-section-heading">
              <ListChecks size={15} aria-hidden="true" />
              <h2>Work queue</h2>
            </div>
            <span>Local tasks</span>
          </div>
          <TaskComposer
            projectId={activeProjectId}
            onCreateTask={onCreateTask}
          />
          <div className="symphony-section-heading symphony-section-heading--subtle">
            <GitBranch size={15} aria-hidden="true" />
            <h2 id="symphony-workspaces-heading">Isolated Workspaces</h2>
          </div>
          <WorkspaceRunTable
            snapshot={snapshot}
            workspaces={visibleWorkspaces}
            selectedIssueId={selectedIssueId}
            onSelectTask={onSelectTask}
            onApproveMerge={onApproveMerge}
            onManageBranch={onManageBranch}
            onRequestChanges={onRequestChanges}
          />
        </section>

        <aside className="symphony-surface symphony-surface--detail" role="region" aria-label="Symphony task detail">
          <TaskDetailPanel
            snapshot={snapshot}
            workspace={selectedWorkspace}
            reviewBranch={selectedReviewBranch}
          />
          <section className="symphony-review-gate" role="region" aria-label="Review gate">
            <div className="symphony-section-heading">
              {snapshot.review.readinessStatus === 'ready'
                ? <CheckCircle2 size={15} aria-hidden="true" />
                : <AlertTriangle size={15} aria-hidden="true" />}
              <h2>Review Gate</h2>
            </div>
            <ReviewGateSummary
              snapshot={snapshot}
              focus={reviewFocus}
              onApproveMerge={onApproveMerge}
              onRequestChanges={onRequestChanges}
              onStartFollowUp={onStartFollowUp}
            />
          </section>
        </aside>

        <section className="symphony-system-footer" aria-label="Symphony runtime context">
          <span>{snapshot.workflow.path}</span>
          <span>{snapshot.workflow.validation.status === 'ready' ? 'Workflow ready' : snapshot.workflow.validation.errors[0]}</span>
          {latestLog ? (
            <span>
              <Clock3 size={12} aria-hidden="true" />
              {latestLog.event}
            </span>
          ) : null}
        </section>
      </div>
    </section>
  );
}

export function SymphonyActivityPanel({
  snapshot,
}: SymphonyActivityPanelProps) {
  const latestLog = snapshot.logs[snapshot.logs.length - 1] ?? null;
  const reviewerDisabled = snapshot.review.branches.some((branch) => branch.reviewerAgentDecision.state === 'disabled');
  const hasWorkspaces = snapshot.workspaces.length > 0;
  const currentPhase = reviewerDisabled
    ? 'Reviewer disabled'
    : !hasWorkspaces ? 'Idle'
      : snapshot.review.readinessStatus === 'ready' ? 'Approval ready' : 'Review waiting';

  return (
    <section className="panel-scroll symphony-activity-panel" role="region" aria-label="Symphony activity summary">
      <header className="symphony-activity-header">
        <span className="symphony-kicker"><Activity size={13} aria-hidden="true" /> Symphony</span>
        <h2>Activity</h2>
      </header>

      <dl className="symphony-side-status" aria-label="Symphony side-panel status">
        <div>
          <dt>Current phase</dt>
          <dd>{currentPhase}</dd>
        </div>
        <div>
          <dt>Latest event</dt>
          <dd>{latestLog?.event ?? 'No activity yet'}</dd>
        </div>
      </dl>

      {latestLog ? (
        <p className={`symphony-latest-event symphony-latest-event--${latestLog.level}`}>
          {latestLog.message}
        </p>
      ) : null}
    </section>
  );
}

function ProjectNavigator({
  projects,
  activeProjectId,
  onCreateProject,
  onSelectProject,
}: {
  projects: SymphonyRuntimeSnapshot['projects'];
  activeProjectId: string | null;
  onCreateProject: (name: string) => void;
  onSelectProject: (projectId: string) => void;
}) {
  const [projectName, setProjectName] = useState('');
  const trimmed = projectName.trim();
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed) return;
    onCreateProject(trimmed);
    setProjectName('');
  };

  return (
    <nav className="symphony-project-rail" aria-label="Symphony projects">
      <div className="symphony-section-heading">
        <Folder size={15} aria-hidden="true" />
        <h2>Projects</h2>
      </div>
      <div className="symphony-project-list">
        {projects.map((project) => (
          <button
            type="button"
            key={project.id}
            className="symphony-project-button"
            aria-label={`Open project ${project.name}`}
            aria-current={project.id === activeProjectId ? 'page' : undefined}
            onClick={() => onSelectProject(project.id)}
          >
            <span>{project.name}</span>
            <small>{project.openIssueCount}/{project.issueCount}</small>
          </button>
        ))}
        {projects.length === 0 ? (
          <p className="symphony-empty-state">No projects yet.</p>
        ) : null}
      </div>
      <form className="symphony-inline-create" onSubmit={handleSubmit}>
        <input
          aria-label="New project name"
          value={projectName}
          onChange={(event) => setProjectName(event.currentTarget.value)}
          placeholder="New project"
        />
        <button
          type="submit"
          className="symphony-icon-action"
          aria-label="Create Symphony project"
          title="Create Symphony project"
          disabled={!trimmed}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </form>
    </nav>
  );
}

function TaskComposer({
  projectId,
  onCreateTask,
}: {
  projectId: string | null;
  onCreateTask: (title: string, projectId: string | null) => void;
}) {
  const [title, setTitle] = useState('');
  const trimmed = title.trim();
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed || !projectId) return;
    onCreateTask(trimmed, projectId);
    setTitle('');
  };

  return (
    <form className="symphony-inline-create symphony-task-create" onSubmit={handleSubmit}>
      <input
        aria-label="New task title"
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
        placeholder="New task"
      />
      <button
        type="submit"
        className="symphony-icon-action"
        aria-label="Create Symphony task"
        title="Create Symphony task"
        disabled={!trimmed || !projectId}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
    </form>
  );
}

function SymphonyEmptyTaskState({ onStartTask }: { onStartTask: (request: string) => void }) {
  const [request, setRequest] = useState('');
  const trimmed = request.trim();
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed) return;
    onStartTask(trimmed);
    setRequest('');
  };

  return (
    <form className="symphony-empty-task" onSubmit={handleSubmit}>
      <div>
        <strong>No active Symphony task</strong>
        <label htmlFor="symphony-task-request">Task request</label>
      </div>
      <textarea
        id="symphony-task-request"
        aria-label="Symphony task request"
        value={request}
        onChange={(event) => setRequest(event.currentTarget.value)}
        rows={3}
      />
      <button
        type="submit"
        className="symphony-icon-action"
        aria-label="Start Symphony task"
        title="Start Symphony task"
        disabled={!trimmed}
      >
        <ArrowRight size={15} aria-hidden="true" />
      </button>
    </form>
  );
}

function MetricItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{NUMBER_FORMATTER.format(value)}</dd>
    </div>
  );
}

function WorkspaceRunTable({
  snapshot,
  workspaces,
  selectedIssueId,
  onSelectTask,
  onApproveMerge,
  onManageBranch,
  onRequestChanges,
}: {
  snapshot: SymphonyRuntimeSnapshot;
  workspaces: SymphonyRuntimeSnapshot['workspaces'];
  selectedIssueId: string | null;
  onSelectTask: (branchId: string) => void;
  onApproveMerge: (branchId: string, actor: SymphonyApprovalActor) => void;
  onManageBranch: (branchId: string, action: MultitaskBranchLifecycleAction) => void;
  onRequestChanges: (branchId: string, prompt: string) => void;
}) {
  return (
    <div className="symphony-table-shell">
      <table className="symphony-workspace-table">
        <thead>
          <tr>
            <th scope="col">Branch</th>
            <th scope="col">State</th>
            <th scope="col">Review</th>
            <th scope="col">Evidence</th>
            <th scope="col" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {workspaces.map((workspace) => {
            const issue = snapshot.issues.find((entry) => entry.id === workspace.issueId);
            const attempt = snapshot.runAttempts.find((entry) => entry.issueId === workspace.issueId);
            const reviewBranch = snapshot.review.branches.find((branch) => branch.branchId === workspace.issueId);
            const displayState = getTaskDisplayState(reviewBranch?.status ?? 'queued', attempt);
            const reviewerDecision = reviewBranch?.reviewerAgentDecision ?? null;
            const isApproved = reviewBranch?.approvalState === 'approved';
            const reviewerState = reviewerDecision?.state ?? 'not-ready';
            const branchName = reviewBranch?.branchName ?? workspace.branchName;
            const evidence = summarizeWorkspaceEvidence(snapshot, workspace.issueId);
            const canApprove = Boolean(
              reviewBranch
              && reviewBranch.approvalState === 'waiting'
              && reviewBranch.status === 'ready'
              && snapshot.review.readinessStatus === 'ready',
            );
            return (
              <tr
                key={workspace.issueId}
                className={`symphony-workspace-row symphony-workspace-row--${reviewBranch?.approvalState ?? 'waiting'}`}
                data-selected={workspace.issueId === selectedIssueId ? 'true' : undefined}
              >
                <th scope="row">
                  <button
                    type="button"
                    className="symphony-task-link"
                    aria-label={`Open task ${workspace.issueIdentifier} ${issue?.title || branchName}`}
                    aria-current={workspace.issueId === selectedIssueId ? 'page' : undefined}
                    onClick={() => onSelectTask(workspace.issueId)}
                  >
                    <span>{issue?.title || branchName}</span>
                    <code>{workspace.issueIdentifier} / {branchName}</code>
                  </button>
                </th>
                <td>
                  <span className={`symphony-status-line symphony-status-line--${displayState.statusClass}`}>
                    {displayState.label}
                  </span>
                  <small>{displayState.detail}</small>
                </td>
                <td>
                  <span>{reviewerDecisionLabel(reviewerState)}</span>
                  <small>{reviewBranch?.approvedBy ?? (canApprove ? 'waiting' : 'not ready')}</small>
                </td>
                <td>
                  <span>{evidence.label}</span>
                  <small>{evidence.detail}</small>
                </td>
                <td>
                  <RowActions
                    branchId={workspace.issueId}
                    branchName={branchName}
                    isApproved={isApproved}
                    status={reviewBranch?.status ?? 'queued'}
                    reviewerDecision={reviewerDecision}
                    reviewerState={reviewerState}
                    onApproveMerge={onApproveMerge}
                    onManageBranch={onManageBranch}
                    onRequestChanges={onRequestChanges}
                  />
                </td>
              </tr>
            );
          })}
          {workspaces.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <p className="symphony-empty-state">No tasks in this project.</p>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function TaskDetailPanel({
  snapshot,
  workspace,
  reviewBranch,
}: {
  snapshot: SymphonyRuntimeSnapshot;
  workspace: SymphonyRuntimeSnapshot['workspaces'][number] | null;
  reviewBranch: SymphonyRuntimeSnapshot['review']['branches'][number] | null;
}) {
  if (!workspace) {
    return (
      <section className="symphony-task-detail">
        <div className="symphony-section-heading">
          <ListChecks size={15} aria-hidden="true" />
          <h2>Task</h2>
        </div>
        <p className="symphony-empty-state">Select a task to inspect its workspace, review, and validation state.</p>
      </section>
    );
  }

  const issue = snapshot.issues.find((entry) => entry.id === workspace.issueId) ?? null;
  const project = snapshot.projects.find((entry) => entry.id === issue?.projectId) ?? null;
  const attempt = snapshot.runAttempts.find((entry) => entry.issueId === workspace.issueId) ?? null;
  const liveSession = snapshot.liveSessions.find((entry) => entry.issueId === workspace.issueId) ?? null;
  const displayState = getTaskDisplayState(reviewBranch?.status ?? 'queued', attempt);
  const evidence = summarizeWorkspaceEvidence(snapshot, workspace.issueId);

  return (
    <section className="symphony-task-detail">
      <div className="symphony-section-heading">
        <ListChecks size={15} aria-hidden="true" />
        <h2>Task</h2>
      </div>
      <header className="symphony-task-detail-header">
        <h2>{issue?.title || workspace.branchName}</h2>
        <code>{workspace.branchName}</code>
      </header>
      <dl className="symphony-detail-list">
        <div>
          <dt>Project</dt>
          <dd>{project?.name ?? 'Symphony'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{displayState.label}</dd>
        </div>
        <div>
          <dt>Session</dt>
          <dd>{displayState.detail}</dd>
        </div>
        <div>
          <dt>Review</dt>
          <dd>{reviewerDecisionLabel(reviewBranch?.reviewerAgentDecision.state ?? 'not-ready')}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>{evidence.label}</dd>
        </div>
      </dl>
      <TaskLiveFeed
        snapshot={snapshot}
        workspace={workspace}
        attempt={attempt}
        liveSession={liveSession}
      />
    </section>
  );
}

function TaskLiveFeed({
  snapshot,
  workspace,
  attempt,
  liveSession,
}: {
  snapshot: SymphonyRuntimeSnapshot;
  workspace: SymphonyRuntimeSnapshot['workspaces'][number];
  attempt: SymphonyRuntimeSnapshot['runAttempts'][number] | null;
  liveSession: SymphonyRuntimeSnapshot['liveSessions'][number] | null;
}) {
  const taskLogs = snapshot.logs.filter((entry) =>
    entry.issueId === workspace.issueId
    || entry.issueIdentifier === workspace.issueIdentifier
    || (liveSession?.sessionId && entry.sessionId === liveSession.sessionId))
    .filter((entry) => !(liveSession
      && entry.event === liveSession.lastCodexEvent
      && entry.message === liveSession.lastCodexMessage));
  const feedItems = [
    ...(liveSession ? [{
      id: `${liveSession.sessionId}:codex`,
      level: attempt?.phase === 'Stalled' ? 'error' as const : 'info' as const,
      title: liveSession.lastCodexEvent ? formatEventLabel(liveSession.lastCodexEvent) : 'Codex session',
      meta: [
        liveSession.lastCodexTimestamp ? formatTimestamp(liveSession.lastCodexTimestamp) : null,
        `${liveSession.turnCount} turn${liveSession.turnCount === 1 ? '' : 's'}`,
        `${NUMBER_FORMATTER.format(liveSession.codexTotalTokens)} tokens`,
      ].filter(Boolean).join(' · '),
      body: liveSession.lastCodexMessage,
      detail: liveSession.lastActivitySummary !== liveSession.lastCodexMessage
        ? liveSession.lastActivitySummary
        : null,
    }] : []),
    ...(attempt && !liveSession ? [{
      id: `${workspace.issueId}:attempt`,
      level: attempt.status === 'failed' ? 'error' as const : 'info' as const,
      title: attempt.phase,
      meta: formatTimestamp(attempt.startedAt),
      body: attempt.error ?? `Workspace attempt is ${attempt.status}.`,
      detail: null,
    }] : []),
    ...taskLogs.map((entry) => ({
      id: `${entry.ts}:${entry.event}:${entry.issueId ?? ''}:${entry.sessionId ?? ''}`,
      level: entry.level,
      title: formatEventLabel(entry.event),
      meta: formatTimestamp(entry.ts),
      body: entry.message,
      detail: entry.sessionId ? `Session ${entry.sessionId}` : null,
    })),
  ];

  return (
    <section className="symphony-live-feed" role="region" aria-label="Symphony task live feed">
      <div className="symphony-section-heading">
        <MessageSquare size={15} aria-hidden="true" />
        <h3>Live chat feed</h3>
      </div>
      <div className="symphony-live-feed-list" role="list">
        {feedItems.length > 0 ? feedItems.map((item) => (
          <article
            key={item.id}
            className={`symphony-live-feed-item symphony-live-feed-item--${item.level}`}
            role="listitem"
          >
            <span>
              <strong>{item.title}</strong>
              <small>{item.meta}</small>
            </span>
            <p>{item.body}</p>
            {item.detail ? <small>{item.detail}</small> : null}
          </article>
        )) : (
          <p className="symphony-empty-state">No live session events captured for this task.</p>
        )}
      </div>
    </section>
  );
}

function ReviewGateSummary({
  snapshot,
  focus,
  onApproveMerge,
  onRequestChanges,
  onStartFollowUp,
}: {
  snapshot: SymphonyRuntimeSnapshot;
  focus: SymphonyRuntimeSnapshot['review']['branches'][number] | null;
  onApproveMerge: (branchId: string, actor: SymphonyApprovalActor) => void;
  onRequestChanges: (branchId: string, prompt: string) => void;
  onStartFollowUp: (prompt: string) => void;
}) {
  const report = snapshot.review.report;
  const failingValidations = report.validations.filter((validation) => validation.status !== 'passed');
  const feedback = focus?.reviewerAgentDecision.state === 'rejected' ? focus.reviewerAgentDecision.feedback : [];
  const primaryRisk = report.risks[0] ?? null;
  const reworkPrompt = focus?.reviewerAgentDecision.state === 'rejected'
    ? buildReviewerAgentFeedbackPrompt(focus.branchName, focus.reviewerAgentDecision.feedback)
    : null;
  const reworkBranchName = focus?.branchName ?? null;
  const validationPrompt = buildValidationFollowUpPrompt(report);
  const showValidationCounts = report.validations.length > 0 && Boolean(focus);
  const canApproveFocus = Boolean(
    focus
    && focus.approvalState === 'waiting'
    && focus.status === 'ready'
    && snapshot.review.readinessStatus === 'ready'
  );

  return (
    <div className="symphony-review-summary">
      {showValidationCounts ? (
        <dl className="symphony-review-counts">
          <MetricItem label="Passed" value={report.readiness.passedValidations} />
          <MetricItem label="Pending" value={report.readiness.pendingValidations} />
          <MetricItem label="Failed" value={report.readiness.failedValidations} />
        </dl>
      ) : null}

      {snapshot.workspaces.length === 0 ? (
        <p className="symphony-empty-state">No active Symphony task.</p>
      ) : !focus ? (
        <p className="symphony-empty-state">No branch is ready for review.</p>
      ) : feedback.length ? (
        <section className="symphony-review-feedback" aria-label="Reviewer agent feedback">
          <h3>Reviewer Feedback</h3>
          <ul>
            {feedback.map((entry) => <li key={entry}>{entry}</li>)}
          </ul>
        </section>
      ) : primaryRisk ? (
        <section className="symphony-review-feedback" aria-label="Primary merge risk">
          <h3>Risk</h3>
          <p>{primaryRisk.title}</p>
          <small>{primaryRisk.recommendedCheck}</small>
        </section>
      ) : (
        <p className="symphony-empty-state">No blocking review feedback.</p>
      )}

      {focus && failingValidations.length ? (
        <ul className="symphony-validation-list" aria-label="Validation blockers">
          {failingValidations.map((validation) => (
            <li key={`${validation.label}:${validation.command}`}>
              <AlertTriangle size={13} aria-hidden="true" />
              <span>{validation.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {focus && (canApproveFocus || reworkPrompt || failingValidations.length) ? (
        <div className="symphony-review-actions" aria-label="Review actions">
          {canApproveFocus && reworkBranchName ? (
            <ReviewAction
              title="Approve merge"
              detail="Merge this branch into the common branch."
              label={`Approve merge as user for ${reworkBranchName}`}
              icon={<GitMerge size={14} aria-hidden="true" />}
              onClick={() => onApproveMerge(focus.branchId, 'user')}
            />
          ) : null}
          {reworkPrompt && reworkBranchName ? (
            <ReviewAction
              title="Request changes"
              detail="Queue this branch with reviewer feedback."
              label={`Request changes for ${reworkBranchName}`}
              icon={<MessageSquare size={14} aria-hidden="true" />}
              onClick={() => onRequestChanges(focus.branchId, reworkPrompt)}
            />
          ) : null}
          {failingValidations.length ? (
            <ReviewAction
              title="Ask agent to verify"
              detail="Send the missing validation evidence to a review session."
              label="Ask agent to verify Symphony task"
              icon={<ArrowRight size={14} aria-hidden="true" />}
              onClick={() => onStartFollowUp(validationPrompt)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReviewAction({
  title,
  detail,
  label,
  icon,
  onClick,
}: {
  title: string;
  detail: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <div className="symphony-review-action">
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <IconAction icon={icon} label={label} onClick={onClick} />
    </div>
  );
}

function RowActions({
  branchId,
  branchName,
  isApproved,
  status,
  reviewerDecision,
  reviewerState,
  onApproveMerge,
  onManageBranch,
  onRequestChanges,
}: {
  branchId: string;
  branchName: string;
  isApproved: boolean;
  status: SymphonyRuntimeSnapshot['review']['branches'][number]['status'];
  reviewerDecision: SymphonyRuntimeSnapshot['review']['branches'][number]['reviewerAgentDecision'] | null;
  reviewerState: 'approved' | 'rejected' | 'disabled' | 'not-ready';
  onApproveMerge: (branchId: string, actor: SymphonyApprovalActor) => void;
  onManageBranch: (branchId: string, action: MultitaskBranchLifecycleAction) => void;
  onRequestChanges: (branchId: string, prompt: string) => void;
}) {
  const actions: ReactNode[] = buildLifecycleActions(status, branchId, branchName, onManageBranch);
  if (!isApproved && reviewerDecision?.state === 'approved') {
    actions.push(
      <IconAction
        key="reviewer-approve"
        icon={<ShieldCheck size={14} aria-hidden="true" />}
        label={reviewerActionLabel(branchName, reviewerState)}
        onClick={() => onApproveMerge(branchId, 'reviewer-agent')}
      />,
    );
  }
  if (!isApproved && reviewerDecision?.state === 'rejected') {
    actions.push(
      <IconAction
        key="reviewer-feedback"
        icon={<MessageSquare size={14} aria-hidden="true" />}
        label={reviewerActionLabel(branchName, reviewerState)}
        onClick={() => onRequestChanges(branchId, buildReviewerAgentFeedbackPrompt(branchName, reviewerDecision.feedback))}
      />,
    );
  }
  if (actions.length === 0) return null;
  return <div className="symphony-row-actions">{actions}</div>;
}

function buildLifecycleActions(
  status: SymphonyRuntimeSnapshot['review']['branches'][number]['status'],
  branchId: string,
  branchName: string,
  onManageBranch: (branchId: string, action: MultitaskBranchLifecycleAction) => void,
): ReactNode[] {
  const actions: ReactNode[] = [];
  const pushAction = (action: MultitaskBranchLifecycleAction, icon: ReactNode, label: string) => {
    actions.push(
      <IconAction
        key={action}
        icon={icon}
        label={label}
        onClick={() => onManageBranch(branchId, action)}
      />,
    );
  };

  if (status === 'queued' || status === 'stopped') {
    pushAction('start', <Play size={14} aria-hidden="true" />, `Start agent session for ${branchName}`);
  }
  if (status === 'running') {
    pushAction('stop', <Square size={14} aria-hidden="true" />, `Stop agent session for ${branchName}`);
  }
  if (status === 'blocked' || status === 'cancelled') {
    pushAction('retry', <RotateCcw size={14} aria-hidden="true" />, `Retry task for ${branchName}`);
  }
  pushAction('dispose', <Trash2 size={14} aria-hidden="true" />, `Close task and dispose workspace for ${branchName}`);
  return actions;
}

function IconAction({
  icon,
  label,
  disabled = false,
  className = '',
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`symphony-icon-action ${className}`.trim()}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function findReviewFocus(
  snapshot: SymphonyRuntimeSnapshot,
  preferred: SymphonyRuntimeSnapshot['review']['branches'][number] | null,
) {
  if (preferred?.status === 'ready' || preferred?.reviewerAgentDecision.state === 'rejected') return preferred;
  const candidates = snapshot.review.branches.filter((branch) =>
    branch.approvalState === 'waiting' && branch.status !== 'running' && branch.status !== 'blocked');
  return candidates.find((branch) =>
    branch.reviewerAgentDecision.state === 'rejected') ?? candidates[0] ?? snapshot.review.branches.find((branch) =>
    branch.approvalState === 'waiting' && branch.reviewerAgentDecision.state === 'rejected') ?? snapshot.review.branches.find((branch) =>
    branch.approvalState === 'waiting') ?? null;
}

function reviewerDecisionLabel(state: 'approved' | 'rejected' | 'disabled' | 'not-ready'): string {
  if (state === 'approved') return 'approved';
  if (state === 'disabled') return 'autopilot off';
  if (state === 'not-ready') return 'not ready';
  return 'feedback';
}

function summarizeWorkspaceEvidence(snapshot: SymphonyRuntimeSnapshot, issueId: string): { label: string; detail: string } {
  const attempt = snapshot.runAttempts.find((entry) => entry.issueId === issueId) ?? null;
  const liveSession = snapshot.liveSessions.find((entry) => entry.issueId === issueId) ?? null;
  const validationCount = snapshot.review.report.validations.length;
  const evidenceCount = attempt?.evidence.length ?? 0;
  if (attempt?.phase === 'Stalled' && attempt.error?.startsWith('No Codex events received')) {
    return {
      label: 'stalled',
      detail: `${evidenceCount} event${evidenceCount === 1 ? '' : 's'}`,
    };
  }
  if (liveSession || attempt?.status === 'active') {
    return {
      label: 'agent active',
      detail: `${evidenceCount} event${evidenceCount === 1 ? '' : 's'}`,
    };
  }
  if (validationCount > 0 && (attempt?.status === 'complete' || attempt?.status === 'failed')) {
    return {
      label: `${snapshot.review.report.readiness.passedValidations}/${validationCount} checks`,
      detail: `${snapshot.review.report.readiness.browserEvidenceCount} evidence`,
    };
  }
  if (attempt?.status === 'pending') {
    return {
      label: 'queued',
      detail: `${evidenceCount} evidence`,
    };
  }
  if (attempt?.status === 'stopped') {
    return {
      label: 'stopped',
      detail: `${evidenceCount} event${evidenceCount === 1 ? '' : 's'}`,
    };
  }
  if (attempt?.status === 'cancelled') {
    return {
      label: 'cancelled',
      detail: `${evidenceCount} event${evidenceCount === 1 ? '' : 's'}`,
    };
  }
  return {
    label: evidenceCount > 0 ? 'recorded' : 'not run',
    detail: `${evidenceCount} event${evidenceCount === 1 ? '' : 's'}`,
  };
}

function getTaskDisplayState(
  status: string,
  attempt: SymphonyRuntimeSnapshot['runAttempts'][number] | null | undefined,
): { label: string; detail: string; statusClass: string } {
  if (attempt?.phase === 'Stalled' && attempt.error?.startsWith('No Codex events received')) {
    return {
      label: 'Stalled',
      detail: attempt.error,
      statusClass: 'blocked',
    };
  }
  if (attempt?.status === 'failed') {
    return {
      label: 'Failed',
      detail: attempt.error ?? attempt.phase,
      statusClass: 'blocked',
    };
  }
  return {
    label: formatBranchStatus(status),
    detail: attempt?.phase ?? 'PreparingWorkspace',
    statusClass: status,
  };
}

function formatBranchStatus(status: string): string {
  return status
    .split('-')
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(' ');
}

function formatEventLabel(value: string): string {
  return formatBranchStatus(value.replace(/[_-]+/g, ' '));
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function reviewerActionLabel(branchName: string, state: 'approved' | 'rejected' | 'disabled' | 'not-ready'): string {
  if (state === 'approved') return `Approve merge by reviewer agent for ${branchName}`;
  if (state === 'disabled') return `Reviewer agent disabled for ${branchName}`;
  if (state === 'not-ready') return `Reviewer agent waiting for ${branchName} to finish`;
  return `Send reviewer agent feedback for ${branchName}`;
}

function buildReviewerAgentFeedbackPrompt(branchName: string, feedback: string[]): string {
  return [
    `Reviewer agent rejected merge request for ${branchName}.`,
    'Critical feedback:',
    ...feedback.map((entry) => `- ${entry}`),
    'Update the isolated workspace branch, refresh validation evidence, and request reviewer approval again.',
  ].join('\n');
}

function buildValidationFollowUpPrompt(report: SymphonyRuntimeSnapshot['review']['report']): string {
  const commands = report.validations
    .filter((validation) => validation.status !== 'passed')
    .map((validation) => `- ${validation.label}: ${validation.command}`)
    .join('\n');
  return [
    `Review validation evidence for ${report.title}.`,
    commands || '- No validation commands are attached yet.',
    'Run the missing validation, attach the evidence, and request Symphony review again.',
  ].join('\n');
}

function noop() {
  return undefined;
}

function noopTask() {
  return undefined;
}
