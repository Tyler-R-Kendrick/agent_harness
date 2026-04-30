import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { findOrphanBranches, ProcessGraph } from './ProcessGraph';
import type { ProcessEntry } from '../../services/processLog';

function entry(partial: Partial<ProcessEntry> & { id: string; ts: number; position: number }): ProcessEntry {
  return {
    kind: 'stage-start',
    actor: partial.actor ?? 'a',
    summary: partial.summary ?? partial.id,
    status: 'done',
    branchId: 'main',
    ...partial,
  } as ProcessEntry;
}

describe('ProcessGraph', () => {
  it('renders an empty-state row when no entries have been captured', () => {
    const { container } = render(<ProcessGraph entries={[]} />);

    expect(container.querySelector('.pg-empty')).toHaveTextContent('No process events captured yet.');
  });

  it('renders entries in pure timestamp order regardless of branch (no branch-priority reordering)', () => {
    // Reproduces the screenshot bug: a sub-stage timestamp earlier than the
    // executor stage but on a different branch must NOT be pushed to the end.
    const entries: ProcessEntry[] = [
      entry({ id: 'router',       ts: 1000, position: 1, branchId: 'coordinator', actor: 'router',       summary: 'Routing request' }),
      entry({ id: 'group-select', ts: 2000, position: 2, branchId: 'coordinator', actor: 'group-select', summary: 'Selecting tool groups' }),
      entry({ id: 'tool-select',  ts: 3000, position: 3, branchId: 'coordinator', actor: 'tool-select',  summary: 'Selecting tools' }),
      entry({ id: 'sub-workspace', ts: 3500, position: 4, branchId: 'tools:Workspace', actor: 'tools:Workspace', summary: 'Selecting tools · Workspace' }),
      entry({ id: 'executor',     ts: 4000, position: 5, branchId: 'coordinator', actor: 'executor',     summary: 'Executing tools', status: 'active' }),
    ];

    const { container } = render(<ProcessGraph entries={entries} />);
    const rows = Array.from(container.querySelectorAll('.pg-row'));
    const ids = rows.map((row) => row.getAttribute('data-actor'));
    expect(ids).toEqual(['router', 'group-select', 'tool-select', 'tools:Workspace', 'executor']);
  });

  it('assigns lane indices in first-seen order so each branch gets its own gitgraph rail', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'a1', ts: 1000, position: 1, branchId: 'coordinator', actor: 'a' }),
      entry({ id: 'b1', ts: 1500, position: 2, branchId: 'tools',       actor: 'b' }),
      entry({ id: 'a2', ts: 2000, position: 3, branchId: 'coordinator', actor: 'a' }),
      entry({ id: 'c1', ts: 2500, position: 4, branchId: 'voters',      actor: 'c' }),
    ];

    const { container } = render(<ProcessGraph entries={entries} />);
    const rows = Array.from(container.querySelectorAll('.pg-row')) as HTMLElement[];
    expect(rows.map((r) => r.getAttribute('data-lane-index'))).toEqual(['0', '1', '0', '2']);
    // Lane count is exposed on the parent so the CSS grid template can size.
    const graph = container.querySelector('.pg-graph');
    expect(graph?.getAttribute('data-lane-count')).toBe('3');
  });

  it('draws fork and merge connectors for completed child branches', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'root', ts: 1000, position: 1, branchId: 'coordinator', actor: 'root' }),
      entry({ id: 'child-a', ts: 2000, position: 2, branchId: 'worker', parentId: 'root', actor: 'worker', status: 'done' }),
      entry({ id: 'root-after', ts: 3000, position: 3, branchId: 'coordinator', actor: 'root-after' }),
    ];

    const { container } = render(<ProcessGraph entries={entries} />);
    const childRow = container.querySelector('[data-actor="worker"]');
    const fork = childRow?.querySelector('[data-connector="fork"][data-lane="worker"]') as HTMLElement | null;
    const merge = childRow?.querySelector('[data-connector="merge"][data-lane="worker"]') as HTMLElement | null;

    expect(fork).toBeInTheDocument();
    expect(fork?.style.left).toBe('7px');
    expect(fork?.style.width).toBe('14px');
    expect(merge).toBeInTheDocument();
    expect(merge?.style.left).toBe('7px');
    expect(merge?.style.width).toBe('14px');
    expect(merge?.style.top).not.toBe(fork?.style.top);
  });

  it('ends the parent rail where its direct child branch returns', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'root', ts: 1000, position: 1, branchId: 'coordinator', actor: 'root' }),
      entry({ id: 'child-a', ts: 2000, position: 2, branchId: 'worker', parentId: 'root', actor: 'worker-a' }),
      entry({ id: 'child-b', ts: 3000, position: 3, branchId: 'worker', actor: 'worker-b' }),
    ];

    const { container } = render(<ProcessGraph entries={entries} />);
    const childRows = ['worker-a', 'worker-b'].map((actor) => container.querySelector(`[data-actor="${actor}"]`));

    childRows.forEach((row) => {
      expect(row?.querySelector('[data-lane="coordinator"]')).toHaveClass('pg-rail-lane-active');
    });
    expect(childRows.at(-1)?.querySelector('.pg-rail-lane[data-lane="coordinator"]')).toHaveClass('pg-rail-lane-end');
    expect(childRows.at(-1)?.querySelector('[data-connector="merge"][data-lane="worker"]')).toBeInTheDocument();
  });

  it('renders visible return merges for each completed sibling branch', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'router', ts: 1000, position: 1, branchId: 'main', actor: 'router' }),
      entry({ id: 'tool-select', ts: 2000, position: 2, branchId: 'main', actor: 'tool-select' }),
      entry({ id: 'browser', ts: 3000, position: 3, branchId: 'tools:Browser', parentId: 'tool-select', actor: 'tools:Browser' }),
      entry({ id: 'builtin', ts: 4000, position: 4, branchId: 'tools:Built-In', parentId: 'tool-select', actor: 'tools:Built-In' }),
      entry({ id: 'executor', ts: 5000, position: 5, branchId: 'main', actor: 'executor' }),
      entry({ id: 'user', ts: 6000, position: 6, branchId: 'mail:user', parentId: 'executor', actor: 'user' }),
      entry({ id: 'bus', ts: 7000, position: 7, branchId: 'bus', parentId: 'executor', actor: 'bus' }),
      entry({ id: 'turn', ts: 8000, position: 8, branchId: 'main', actor: 'executor-turn' }),
    ];

    const { container } = render(<ProcessGraph entries={entries} />);

    ['tools:Browser', 'tools:Built-In', 'mail:user', 'bus'].forEach((lane) => {
      const fork = container.querySelector(`[data-connector="fork"][data-lane="${lane}"]`) as HTMLElement | null;
      const merge = container.querySelector(`[data-connector="merge"][data-lane="${lane}"]`) as HTMLElement | null;
      expect(fork).toBeInTheDocument();
      expect(merge).toBeInTheDocument();
      expect(merge?.style.top).not.toBe(fork?.style.top);
    });

    const branchRows = ['tools:Browser', 'tools:Built-In', 'user', 'bus'].map((actor) => container.querySelector(`[data-actor="${actor}"]`));
    branchRows.forEach((row) => {
      expect(row?.querySelector('[data-lane="main"]')).toHaveClass('pg-rail-lane-active');
      expect(row?.querySelector('[data-lane="main"]')).not.toHaveClass('pg-rail-lane-end');
    });
  });

  it('keeps ancestor branches open while nested child threads are active', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'router', ts: 1000, position: 1, branchId: 'main', actor: 'router' }),
      entry({ id: 'tool-select', ts: 2000, position: 2, branchId: 'main', actor: 'tool-select' }),
      entry({ id: 'browser', ts: 3000, position: 3, branchId: 'tools:Browser', parentId: 'tool-select', actor: 'tools:Browser' }),
      entry({ id: 'builtin', ts: 4000, position: 4, branchId: 'tools:Built-In', parentId: 'tool-select', actor: 'tools:Built-In' }),
      entry({ id: 'executor', ts: 5000, position: 5, branchId: 'main', actor: 'executor' }),
      entry({ id: 'user', ts: 6000, position: 6, branchId: 'mail:user', parentId: 'executor', actor: 'user' }),
      entry({ id: 'bus', ts: 7000, position: 7, branchId: 'bus', parentId: 'user', actor: 'bus' }),
      entry({ id: 'turn', ts: 8000, position: 8, branchId: 'executor', parentId: 'bus', actor: 'executor-turn' }),
    ];

    const { container } = render(<ProcessGraph entries={entries} />);
    const busRow = container.querySelector('[data-actor="bus"]');
    const turnRow = container.querySelector('[data-actor="executor-turn"]');
    const busFork = busRow?.querySelector('[data-connector="fork"][data-lane="bus"]') as HTMLElement | null;
    const turnFork = turnRow?.querySelector('[data-connector="fork"][data-lane="executor"]') as HTMLElement | null;

    expect(busFork).toBeInTheDocument();
    expect(busFork?.style.left).toBe('49px');
    expect(busFork?.style.width).toBe('14px');
    expect(turnFork).toBeInTheDocument();
    expect(turnFork?.style.left).toBe('63px');
    expect(turnFork?.style.width).toBe('14px');
    expect(busRow?.querySelector('.pg-rail-lane[data-lane="mail:user"]')).toHaveClass('pg-rail-lane-active');
    expect(busRow?.querySelector('.pg-rail-lane[data-lane="mail:user"]')).not.toHaveClass('pg-rail-lane-end');
    expect(busRow?.querySelector('[data-connector="merge"][data-lane="mail:user"]')).not.toBeInTheDocument();
    expect(turnRow?.querySelector('.pg-rail-lane[data-lane="mail:user"]')).toHaveClass('pg-rail-lane-active');
    expect(turnRow?.querySelector('.pg-rail-lane[data-lane="mail:user"]')).toHaveClass('pg-rail-lane-end');
    expect(turnRow?.querySelector('.pg-rail-lane[data-lane="bus"]')).toHaveClass('pg-rail-lane-active');
    expect(turnRow?.querySelector('.pg-rail-lane[data-lane="bus"]')).toHaveClass('pg-rail-lane-end');
    expect(turnRow?.querySelector('[data-connector="merge"][data-lane="bus"]')).toBeInTheDocument();
    expect(turnRow?.querySelector('[data-connector="merge"][data-lane="mail:user"]')).toBeInTheDocument();
  });

  it('does not draw a merge connector until the child branch is complete', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'root', ts: 1000, position: 1, branchId: 'coordinator', actor: 'root' }),
      entry({ id: 'child-a', ts: 2000, position: 2, branchId: 'worker', parentId: 'root', actor: 'worker', status: 'active' }),
    ];

    const { container } = render(<ProcessGraph entries={entries} />);

    expect(container.querySelector('[data-connector="fork"][data-lane="worker"]')).toBeInTheDocument();
    expect(container.querySelector('[data-connector="merge"][data-lane="worker"]')).not.toBeInTheDocument();
  });

  it('flags non-main branches that do not have a real parent row', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'tool', ts: 1000, position: 1, branchId: 'tools:CodeMode', actor: 'tools:CodeMode' }),
    ];

    expect(findOrphanBranches(entries)).toEqual(['tools:CodeMode']);
  });

  it('does not flag child branches that fork from an existing parent row', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'main', ts: 1000, position: 1, branchId: 'main', actor: 'chat-agent' }),
      entry({ id: 'tool', ts: 2000, position: 2, branchId: 'tools:CodeMode', parentId: 'main', actor: 'tools:CodeMode' }),
    ];

    expect(findOrphanBranches(entries)).toEqual([]);
  });

  it('uses AgentBus parentActorId metadata when mirrored rows have no parentId', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'chat', ts: 1000, position: 1, branchId: 'main', actor: 'chat-agent', actorId: 'chat-agent' }),
      entry({
        id: 'student-1',
        ts: 2000,
        position: 2,
        branchId: 'agent:student-driver',
        actor: 'student-driver',
        actorId: 'student-driver',
        parentActorId: 'chat-agent',
      }),
      entry({
        id: 'teacher-1',
        ts: 3000,
        position: 3,
        branchId: 'agent:judge-decider',
        actor: 'voter:teacher',
        actorId: 'voter:teacher',
        parentActorId: 'student-driver',
      }),
      entry({
        id: 'student-2',
        ts: 4000,
        position: 4,
        branchId: 'agent:student-driver',
        actor: 'student-driver',
        actorId: 'student-driver',
        parentActorId: 'voter:teacher',
      }),
    ];

    expect(findOrphanBranches(entries)).toEqual([]);

    const { container } = render(<ProcessGraph entries={entries} />);
    const teacherRow = container.querySelector('[data-actor="voter:teacher"]');
    const studentRevisionRow = Array.from(container.querySelectorAll('[data-actor="student-driver"]')).at(1);

    expect(teacherRow?.querySelector('[data-connector="fork"][data-lane="agent:judge-decider"]')).toBeInTheDocument();
    expect(teacherRow?.querySelector('.pg-rail-lane[data-lane="agent:student-driver"]')).toHaveClass('pg-rail-lane-active');
    expect(studentRevisionRow?.querySelector('[data-connector="merge"][data-lane="agent:judge-decider"]')).toBeInTheDocument();
  });

  it('keeps agent parent branches open until descendant handoff work returns', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'chat', ts: 1000, position: 1, branchId: 'main', actor: 'chat-agent' }),
      entry({ id: 'planner', ts: 2000, position: 2, branchId: 'agent:planner', parentId: 'chat', actor: 'planner' }),
      entry({ id: 'router', ts: 3000, position: 3, branchId: 'agent:router-agent', parentId: 'planner', actor: 'router-agent' }),
      entry({ id: 'orchestrator', ts: 4000, position: 4, branchId: 'agent:orchestrator', parentId: 'router', actor: 'orchestrator' }),
    ];

    const { container } = render(<ProcessGraph entries={entries} />);
    const routerRow = container.querySelector('[data-actor="router-agent"]');
    const orchestratorRow = container.querySelector('[data-actor="orchestrator"]');

    expect(routerRow?.querySelector('[data-connector="merge"][data-lane="agent:planner"]')).not.toBeInTheDocument();
    expect(routerRow?.querySelector('.pg-rail-lane[data-lane="agent:planner"]')).toHaveClass('pg-rail-lane-active');
    expect(orchestratorRow?.querySelector('.pg-rail-lane[data-lane="agent:planner"]')).toHaveClass('pg-rail-lane-active');
    expect(orchestratorRow?.querySelector('.pg-rail-lane[data-lane="agent:planner"]')).toHaveClass('pg-rail-lane-end');
    expect(orchestratorRow?.querySelector('[data-connector="merge"][data-lane="agent:planner"]')).toBeInTheDocument();
  });

  it('merges a completed agent branch back onto an existing main lane row', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'chat', ts: 1000, position: 1, branchId: 'main', actor: 'chat-agent' }),
      entry({ id: 'tools-selected', ts: 2000, position: 2, branchId: 'agent:logact', parentId: 'chat', actor: 'tools-selected' }),
      entry({ id: 'workflow-complete', ts: 3000, position: 3, branchId: 'main', parentId: 'tools-selected', actor: 'workflow-complete' }),
    ];

    const { container } = render(<ProcessGraph entries={entries} />);
    const completeRow = container.querySelector('[data-actor="workflow-complete"]');

    expect(completeRow).toHaveAttribute('data-branch', 'main');
    expect(completeRow?.querySelector('.pg-rail-lane[data-lane="agent:logact"]')).toHaveClass('pg-rail-lane-end');
    expect(completeRow?.querySelector('[data-connector="merge"][data-lane="agent:logact"]')).toBeInTheDocument();
  });

  it('renders the LogAct operation branch from main after planning branches have already merged', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'chat', ts: 1000, position: 1, branchId: 'main', actor: 'chat-agent' }),
      entry({ id: 'orchestrator', ts: 2000, position: 2, branchId: 'agent:orchestrator', parentId: 'chat', actor: 'orchestrator' }),
      entry({ id: 'tools-selected', ts: 3000, position: 3, branchId: 'agent:logact', parentId: 'chat', actor: 'tools-selected' }),
      entry({ id: 'student', ts: 4000, position: 4, branchId: 'agent:student-driver', parentId: 'tools-selected', actor: 'student-driver' }),
    ];

    const { container } = render(<ProcessGraph entries={entries} />);
    const toolsSelectedRow = container.querySelector('[data-actor="tools-selected"]');
    const studentRow = container.querySelector('[data-actor="student-driver"]');

    expect(container.querySelector('[data-actor="logact"]')).not.toBeInTheDocument();
    expect(toolsSelectedRow?.querySelector('[data-connector="fork"][data-lane="agent:logact"]')).toBeInTheDocument();
    ['agent:orchestrator'].forEach((lane) => {
      expect(toolsSelectedRow?.querySelector(`.pg-rail-lane[data-lane="${lane}"]`)).not.toHaveClass('pg-rail-lane-active');
      expect(studentRow?.querySelector(`.pg-rail-lane[data-lane="${lane}"]`)).not.toHaveClass('pg-rail-lane-active');
    });
    expect(studentRow?.querySelector('.pg-rail-lane[data-lane="agent:logact"]')).toHaveClass('pg-rail-lane-active');
  });

  it('renders judge, adversary, executor, and named operation merges in the corrected lifecycle', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'chat', ts: 1000, position: 1, branchId: 'main', actor: 'chat-agent' }),
      entry({ id: 'tools-selected', ts: 2000, position: 2, branchId: 'agent:logact', parentId: 'chat', actor: 'tools-selected' }),
      entry({ id: 'student', ts: 3000, position: 3, branchId: 'agent:student-driver', parentId: 'tools-selected', actor: 'student-driver' }),
      entry({ id: 'teacher', ts: 4000, position: 4, branchId: 'agent:judge-decider', parentId: 'tools-selected', actor: 'voter:teacher' }),
      entry({ id: 'judge-rubric', ts: 5000, position: 5, branchId: 'agent:judge-decider', parentId: 'teacher', actor: 'judge-decider' }),
      entry({ id: 'adversary', ts: 6000, position: 6, branchId: 'agent:adversary-driver', parentId: 'judge-rubric', actor: 'adversary-driver' }),
      entry({ id: 'judge-commit', ts: 7000, position: 7, branchId: 'agent:judge-decider', parentId: 'adversary', actor: 'judge-decider' }),
      entry({ id: 'judge-approved', ts: 8000, position: 8, branchId: 'agent:logact', parentId: 'judge-commit', actor: 'judge-approved' }),
      entry({ id: 'executor', ts: 9000, position: 9, branchId: 'agent:executor', parentId: 'judge-approved', actor: 'executor' }),
      entry({ id: 'execute-plan', ts: 10000, position: 10, branchId: 'agent:executor', parentId: 'executor', actor: 'execute-plan' }),
      entry({ id: 'executor-result', ts: 11000, position: 11, branchId: 'agent:executor', parentId: 'execute-plan', actor: 'executor' }),
      entry({ id: 'execution-complete', ts: 12000, position: 12, branchId: 'agent:logact', parentId: 'executor-result', actor: 'execution-complete' }),
      entry({ id: 'post-processor', ts: 13000, position: 13, branchId: 'agent:post-processor', parentId: 'execution-complete', actor: 'post-processor' }),
      entry({ id: 'response-ready', ts: 14000, position: 14, branchId: 'agent:logact', parentId: 'post-processor', actor: 'response-ready' }),
      entry({ id: 'workflow-complete', ts: 15000, position: 15, branchId: 'main', parentId: 'response-ready', actor: 'workflow-complete' }),
    ];

    expect(findOrphanBranches(entries)).toEqual([]);

    const { container } = render(<ProcessGraph entries={entries} />);
    const teacherRow = container.querySelector('[data-actor="voter:teacher"]');
    const judgeRow = container.querySelectorAll('[data-actor="judge-decider"]').item(1);
    const adversaryRow = container.querySelector('[data-actor="adversary-driver"]');
    const executePlanRow = container.querySelector('[data-actor="execute-plan"]');
    const executionCompleteRow = Array.from(container.querySelectorAll('[data-actor="execution-complete"][data-branch="agent:logact"]'))
      .find((row) => row.textContent?.includes('execution-complete'));
    const postProcessorRow = container.querySelector('[data-actor="post-processor"]');
    const responseReadyRow = Array.from(container.querySelectorAll('[data-actor="response-ready"][data-branch="agent:logact"]'))
      .find((row) => row.textContent?.includes('response-ready'));
    const workflowCompleteRow = Array.from(container.querySelectorAll('[data-actor="workflow-complete"][data-branch="main"]'))
      .find((row) => row.textContent?.includes('workflow-complete'));

    expect(container.querySelector('[data-actor="logact"]')).not.toBeInTheDocument();
    expect(teacherRow).toHaveAttribute('data-branch', 'agent:judge-decider');
    expect(judgeRow).toHaveAttribute('data-branch', 'agent:judge-decider');
    expect(adversaryRow?.querySelector('[data-connector="fork"][data-lane="agent:adversary-driver"]')).toBeInTheDocument();
    expect(judgeRow?.querySelector('.pg-rail-lane[data-lane="agent:adversary-driver"]')).toHaveClass('pg-rail-lane-active');
    expect(executePlanRow).toHaveAttribute('data-branch', 'agent:executor');
    expect(executePlanRow?.querySelector('.pg-rail-lane[data-lane="agent:logact"]')).toHaveClass('pg-rail-lane-active');
    expect(executionCompleteRow?.querySelector('[data-connector="merge"][data-lane="agent:executor"]')).toBeInTheDocument();
    expect(postProcessorRow?.querySelector('[data-connector="fork"][data-lane="agent:post-processor"]')).toBeInTheDocument();
    expect(responseReadyRow?.querySelector('[data-connector="merge"][data-lane="agent:post-processor"]')).toBeInTheDocument();
    expect(workflowCompleteRow?.querySelector('[data-connector="merge"][data-lane="agent:logact"]')).toBeInTheDocument();
  });

  it('flags active AgentBus mirror rows as orphan branches when they have no parent', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'agent-bus', ts: 1000, position: 1, branchId: 'agent:agent-bus', actor: 'agent-bus', status: 'active' }),
    ];

    expect(findOrphanBranches(entries)).toEqual(['agent:agent-bus']);
  });

  it('marks failed branch rows with the failed dot icon', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'root', ts: 1000, position: 1, branchId: 'coordinator', actor: 'root' }),
      entry({ id: 'child-a', ts: 2000, position: 2, branchId: 'worker', parentId: 'root', actor: 'worker', status: 'failed' }),
    ];

    const { container } = render(<ProcessGraph entries={entries} />);
    const failedRow = container.querySelector('[data-actor="worker"]');

    expect(failedRow).toHaveClass('pg-row-failed');
    expect(failedRow?.querySelector('.pg-row-dot-failed-icon')).toBeInTheDocument();
  });

  it('falls back to the generic process icon for unknown entry kinds', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'unknown', ts: 1000, position: 1, kind: 'unknown-kind' as ProcessEntry['kind'], actor: 'unknown' }),
    ];

    const { container } = render(<ProcessGraph entries={entries} />);

    expect(container.querySelector('[data-kind="unknown-kind"] .pg-row-icon svg')).toBeInTheDocument();
  });

  it('renders compact agent and model metadata when available', () => {
    const entries: ProcessEntry[] = [
      entry({
        id: 'tool-agent',
        ts: 1000,
        position: 1,
        kind: 'tool-plan',
        actor: 'tool-select',
        agentLabel: 'Tool Agent',
        modelId: 'Qwen3-0.6B',
      }),
    ];

    const { container } = render(<ProcessGraph entries={entries} />);

    expect(container.querySelector('.pg-row-agent')).toHaveTextContent('Tool Agent · Qwen3-0.6B');
  });

  it('breaks timestamp ties by monotonic position so simultaneous appends remain stable', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'second', ts: 1000, position: 2, branchId: 'b', actor: 'second' }),
      entry({ id: 'first',  ts: 1000, position: 1, branchId: 'a', actor: 'first' }),
      entry({ id: 'third',  ts: 1000, position: 3, branchId: 'c', actor: 'third' }),
    ];
    const { container } = render(<ProcessGraph entries={entries} />);
    const ids = Array.from(container.querySelectorAll('.pg-row')).map((r) => r.getAttribute('data-actor'));
    expect(ids).toEqual(['first', 'second', 'third']);
  });
});
