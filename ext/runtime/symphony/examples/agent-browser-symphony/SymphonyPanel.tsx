import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Columns3,
  Eye,
  EyeOff,
  GitMerge,
  ListFilter,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Rocket,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  SYMPHONY_ALL_LANES,
  SYMPHONY_HIDDEN_LANES,
  SYMPHONY_VISIBLE_LANES,
  advanceSymphonyTask,
  createSymphonyTask,
  dispatchSymphonyTask,
  getSymphonyBoardMetrics,
  getSymphonyTasksByLane,
  markSymphonyProofPassing,
  moveSymphonyTask,
  selectSymphonyTask,
  toggleSymphonyHiddenLanes,
  toggleSymphonyQueuePaused,
  type DispatchSymphonyTaskInput,
  type SymphonyBoardState,
  type SymphonyLaneDefinition,
  type SymphonyLaneId,
  type SymphonyTask,
} from '../../src/board.js';

export interface SymphonyPanelSession {
  id: string;
  name: string;
  isOpen: boolean;
}

export interface SymphonyDispatchResult extends DispatchSymphonyTaskInput {
  sessionId?: string;
  sessionName?: string;
}

export interface SymphonyPanelProps {
  board: SymphonyBoardState;
  workspaceName: string;
  sessions: SymphonyPanelSession[];
  onBoardChange: (board: SymphonyBoardState) => void;
  onDispatchTask?: (task: SymphonyTask) => SymphonyDispatchResult | null | undefined;
  onOpenSession?: (sessionId: string) => void;
}

export function SymphonyPanel({
  board,
  workspaceName,
  sessions,
  onBoardChange,
  onDispatchTask,
  onOpenSession,
}: SymphonyPanelProps) {
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskBrief, setTaskBrief] = useState('');
  const metrics = useMemo(() => getSymphonyBoardMetrics(board), [board]);
  const selectedTask = board.tasks.find((task) => task.id === board.selectedTaskId) ?? board.tasks[0] ?? null;
  const visibleLaneDefs = board.hiddenLanesExpanded
    ? SYMPHONY_ALL_LANES
    : SYMPHONY_VISIBLE_LANES;
  const hiddenLaneSummary = SYMPHONY_HIDDEN_LANES.map((lane) => lane.title).join(', ');

  const update = (nextBoard: SymphonyBoardState) => onBoardChange(nextBoard);

  const handleCreateTask = (event: FormEvent) => {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title) return;
    const [nextBoard] = createSymphonyTask(board, {
      title,
      description: taskBrief.trim() || 'No brief provided.',
      priority: 'high',
      labels: ['agent-browser'],
    });
    onBoardChange(nextBoard);
    setCreatingTask(false);
    setTaskTitle('');
    setTaskBrief('');
  };

  const handleDispatch = (task: SymphonyTask) => {
    const dispatchResult = onDispatchTask?.(task) ?? {
      sessionId: task.agent.sessionId,
      sessionName: task.identifier,
    };
    update(dispatchSymphonyTask(board, task.id, {
      sessionId: dispatchResult?.sessionId,
      sessionName: dispatchResult?.sessionName ?? task.identifier,
      workspacePath: dispatchResult?.workspacePath,
    }));
  };

  return (
    <section className="symphony-panel" role="region" aria-label="Symphony task board">
      <header className="symphony-header">
        <div className="symphony-title-group">
          <span className="panel-eyebrow"><Bot size={12} aria-hidden="true" />Symphony</span>
          <h2>Symphony</h2>
          <p>{workspaceName} agent task manager</p>
        </div>
        <div className="symphony-metrics" aria-label="Symphony board metrics">
          <Metric label="Active" value={`${metrics.activeAgents}/${board.maxConcurrentAgents}`} />
          <Metric label="Queued" value={metrics.queued} />
          <Metric label="Review" value={metrics.humanReview} />
          <Metric label="Blocked" value={metrics.blockedAgents} tone={metrics.blockedAgents ? 'danger' : undefined} />
        </div>
        <div className="symphony-toolbar" aria-label="Symphony controls">
          <IconButton
            label="Create Symphony task"
            icon={<Plus size={15} aria-hidden="true" />}
            onClick={() => setCreatingTask(true)}
            active={creatingTask}
          />
          <IconButton
            label="Toggle hidden Symphony lanes"
            icon={board.hiddenLanesExpanded ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            onClick={() => update(toggleSymphonyHiddenLanes(board))}
            active={board.hiddenLanesExpanded}
          />
          <IconButton
            label={board.paused ? 'Resume Symphony queue' : 'Pause Symphony queue'}
            icon={board.paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
            onClick={() => update(toggleSymphonyQueuePaused(board))}
            active={board.paused}
          />
          <IconButton
            label="Refresh Symphony board"
            icon={<RefreshCcw size={15} aria-hidden="true" />}
            onClick={() => onBoardChange({ ...board })}
          />
        </div>
      </header>

      <div className="symphony-body">
        <div className="symphony-main">
          {creatingTask ? (
            <form className="symphony-create-task" onSubmit={handleCreateTask}>
              <label>
                <span>Title</span>
                <input
                  aria-label="Symphony task title"
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  autoFocus
                  placeholder="e.g. Add multi-agent task manager"
                />
              </label>
              <label>
                <span>Brief</span>
                <textarea
                  aria-label="Symphony task brief"
                  value={taskBrief}
                  onChange={(event) => setTaskBrief(event.target.value)}
                  placeholder="What should the agent do, test, and show for review?"
                />
              </label>
              <div className="symphony-create-actions">
                <button type="button" className="icon-button" aria-label="Cancel Symphony task" onClick={() => setCreatingTask(false)}>
                  <X size={14} aria-hidden="true" />
                </button>
                <button type="submit" className="secondary-button symphony-icon-text" aria-label="Save Symphony task" disabled={!taskTitle.trim()}>
                  <Check size={14} aria-hidden="true" />
                  <span>Save</span>
                </button>
              </div>
            </form>
          ) : null}

          <div className="symphony-lane-strip" aria-label="Symphony lanes">
            {visibleLaneDefs.map((lane) => (
              <SymphonyLane
                key={lane.id}
                lane={lane}
                tasks={getSymphonyTasksByLane(board, lane.id)}
                selectedTaskId={selectedTask?.id ?? null}
                onSelectTask={(taskId) => update(selectSymphonyTask(board, taskId))}
                onDispatchTask={handleDispatch}
              />
            ))}
          </div>
          {!board.hiddenLanesExpanded ? (
            <button
              type="button"
              className="symphony-hidden-lanes"
              onClick={() => update(toggleSymphonyHiddenLanes(board))}
              aria-label="Show hidden Symphony lanes"
            >
              <Columns3 size={14} aria-hidden="true" />
              <span>Hidden: {hiddenLaneSummary}</span>
            </button>
          ) : null}
        </div>

        <SymphonyInspector
          task={selectedTask}
          sessions={sessions}
          onDispatchTask={handleDispatch}
          onMoveTask={(taskId, lane) => update(moveSymphonyTask(board, taskId, lane))}
          onAdvanceTask={(taskId) => update(advanceSymphonyTask(board, taskId))}
          onProofPassing={(taskId, proofId) => update(markSymphonyProofPassing(board, taskId, proofId))}
          onOpenSession={onOpenSession}
        />
      </div>
    </section>
  );
}

export function SymphonySidebar({
  board,
  workspaceName,
  onSelectTask,
}: {
  board: SymphonyBoardState;
  workspaceName: string;
  onSelectTask: (taskId: string) => void;
}) {
  const metrics = useMemo(() => getSymphonyBoardMetrics(board), [board]);
  const activeTasks = board.tasks.filter((task) => task.agent.state === 'running' || task.agent.state === 'reviewing' || task.agent.state === 'retrying');

  return (
    <section className="symphony-sidebar panel-scroll" aria-label="Symphony queue">
      <div className="symphony-sidebar-card">
        <span className="panel-eyebrow"><ListFilter size={12} aria-hidden="true" />Queue</span>
        <h2>{workspaceName}</h2>
        <div className="symphony-sidebar-capacity">
          <span>{metrics.activeAgents}/{board.maxConcurrentAgents}</span>
          <small>agents active</small>
        </div>
      </div>
      <div className="symphony-sidebar-grid">
        <Metric label="Queued" value={metrics.queued} />
        <Metric label="Review" value={metrics.humanReview} />
        <Metric label="Runtime" value={`${metrics.runtimeMinutes}m`} />
        <Metric label="Tokens" value={compactNumber(metrics.tokenTotal)} />
      </div>
      <div className="symphony-sidebar-list">
        <h3>Active agents</h3>
        {activeTasks.length ? activeTasks.map((task) => (
          <button key={task.id} type="button" className="symphony-sidebar-task" onClick={() => onSelectTask(task.id)} aria-label={`Select ${task.identifier}`}>
            <span className={`symphony-status-dot symphony-status-dot--${task.agent.health}`} />
            <span>
              <strong>{task.identifier}</strong>
              <small>{task.agent.lastAction}</small>
            </span>
          </button>
        )) : (
          <p className="muted">No active agents.</p>
        )}
      </div>
    </section>
  );
}

function SymphonyLane({
  lane,
  tasks,
  selectedTaskId,
  onSelectTask,
  onDispatchTask,
}: {
  lane: SymphonyLaneDefinition;
  tasks: SymphonyTask[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onDispatchTask: (task: SymphonyTask) => void;
}) {
  return (
    <section className="symphony-lane" aria-label={lane.title}>
      <header className="symphony-lane-header">
        <div>
          <h3>{lane.title}</h3>
          <p>{lane.description}</p>
        </div>
        <span>{tasks.length}</span>
      </header>
      <div className="symphony-task-list" role="list" aria-label={`${lane.title} tasks`}>
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            className={`symphony-task-card ${selectedTaskId === task.id ? 'is-selected' : ''}`}
            aria-label={`${task.identifier} ${task.title}`}
            onClick={() => onSelectTask(task.id)}
          >
            <span className="symphony-card-topline">
              <strong>{task.identifier}</strong>
              <PriorityBadge priority={task.priority} />
            </span>
            <span className="symphony-card-title">{task.title}</span>
            <span className="symphony-card-meta">
              <span className={`symphony-status-dot symphony-status-dot--${task.agent.health}`} />
              {task.agent.state === 'running' ? 'Agent running' : task.agent.lastAction}
            </span>
            <span className="symphony-card-footer">
              <span>{task.labels.slice(0, 2).join(' / ')}</span>
              {task.lane === 'backlog' || task.lane === 'todo' ? (
                <span
                  className="symphony-card-dispatch"
                  aria-hidden="true"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDispatchTask(task);
                  }}
                >
                  <Rocket size={12} aria-hidden="true" />
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SymphonyInspector({
  task,
  sessions,
  onDispatchTask,
  onMoveTask,
  onAdvanceTask,
  onProofPassing,
  onOpenSession,
}: {
  task: SymphonyTask | null;
  sessions: SymphonyPanelSession[];
  onDispatchTask: (task: SymphonyTask) => void;
  onMoveTask: (taskId: string, lane: SymphonyLaneId) => void;
  onAdvanceTask: (taskId: string) => void;
  onProofPassing: (taskId: string, proofId: string) => void;
  onOpenSession?: (sessionId: string) => void;
}) {
  if (!task) {
    return (
      <aside className="symphony-inspector" role="complementary" aria-label="Symphony task inspector">
        <p className="muted">Select a task to inspect agent state.</p>
      </aside>
    );
  }

  const session = task.agent.sessionId ? sessions.find((entry) => entry.id === task.agent.sessionId) : undefined;
  const nextLane = getNextLane(task.lane);

  return (
    <aside className="symphony-inspector" role="complementary" aria-label="Symphony task inspector">
      <div className="symphony-inspector-header">
        <div>
          <span className="symphony-task-kicker">{task.identifier} active task</span>
          <h3>{task.title}</h3>
        </div>
        <PriorityBadge priority={task.priority} />
      </div>
      <p className="symphony-task-description">{task.description}</p>

      <section className="symphony-inspector-section">
        <h4>Task agent</h4>
        <div className="symphony-agent-card">
          <span className={`symphony-status-dot symphony-status-dot--${task.agent.health}`} />
          <div>
            <strong>{task.agent.state === 'running' ? 'Agent running' : task.agent.name}</strong>
            <span>{task.agent.lastAction}</span>
            {task.agent.sessionId ? <code>{task.agent.sessionId}</code> : null}
          </div>
          {task.agent.sessionId && onOpenSession ? (
            <button type="button" className="icon-button" aria-label={`Open ${task.identifier} session`} onClick={() => onOpenSession(task.agent.sessionId!)}>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {session ? <p className="muted">Linked to {session.name}{session.isOpen ? ' and open' : ''}.</p> : null}
      </section>

      <section className="symphony-inspector-section">
        <h4>Proof</h4>
        <div className="symphony-proof-grid">
          {task.proofs.map((proof) => (
            <button
              key={proof.id}
              type="button"
              className={`symphony-proof ${proof.status === 'passing' ? 'is-passing' : ''}`}
              aria-label={`Mark ${proof.label} proof passing for ${task.identifier}`}
              onClick={() => onProofPassing(task.id, proof.id)}
            >
              {proof.status === 'passing' ? <CheckCircle2 size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
              <span>{proof.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="symphony-inspector-section">
        <h4>Actions</h4>
        <div className="symphony-action-grid">
          <button type="button" className="secondary-button symphony-icon-text" aria-label={`Dispatch agent for ${task.identifier}`} onClick={() => onDispatchTask(task)}>
            <Rocket size={14} aria-hidden="true" />
            <span>Dispatch</span>
          </button>
          {nextLane ? (
            <button type="button" className="secondary-button symphony-icon-text" aria-label={`Move ${task.identifier} to ${nextLane.title}`} onClick={() => onAdvanceTask(task.id)}>
              {nextLane.id === 'merging' ? <GitMerge size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
              <span>{nextLane.title}</span>
            </button>
          ) : null}
          <button type="button" className="secondary-button symphony-icon-text" aria-label={`Move ${task.identifier} to Rework`} onClick={() => onMoveTask(task.id, 'rework')}>
            <RotateCcw size={14} aria-hidden="true" />
            <span>Rework</span>
          </button>
        </div>
      </section>

      <section className="symphony-inspector-section">
        <h4>Activity</h4>
        <ol className="symphony-activity-list">
          {task.activity.slice(0, 5).map((event) => (
            <li key={event.id}>
              <span>{event.label}</span>
              <small>{event.detail}</small>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: 'danger' }) {
  return (
    <div className={`symphony-metric ${tone ? `symphony-metric--${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: SymphonyTask['priority'] }) {
  return <span className={`symphony-priority symphony-priority--${priority}`}>{priority}</span>;
}

function IconButton({
  label,
  icon,
  active = false,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`icon-button ${active ? 'is-active' : ''}`} aria-label={label} title={label} onClick={onClick}>
      {icon}
    </button>
  );
}

function getNextLane(currentLane: SymphonyLaneId): SymphonyLaneDefinition | null {
  if (currentLane === 'in_progress') return SYMPHONY_ALL_LANES.find((lane) => lane.id === 'human_review') ?? null;
  if (currentLane === 'human_review') return SYMPHONY_ALL_LANES.find((lane) => lane.id === 'merging') ?? null;
  if (currentLane === 'merging') return SYMPHONY_ALL_LANES.find((lane) => lane.id === 'done') ?? null;
  if (currentLane === 'todo' || currentLane === 'backlog' || currentLane === 'rework') return SYMPHONY_ALL_LANES.find((lane) => lane.id === 'human_review') ?? null;
  return null;
}

function compactNumber(value: number): string {
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(value);
}
