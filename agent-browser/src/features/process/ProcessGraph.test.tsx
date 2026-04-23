import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ProcessGraph } from './ProcessGraph';
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

  it('keeps the parent rail running through the child branch instead of ending at it', () => {
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
    expect(childRows.at(-1)?.querySelector('[data-lane="coordinator"]')).not.toHaveClass('pg-rail-lane-end');
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

  it('does not draw a merge connector until the child branch is complete', () => {
    const entries: ProcessEntry[] = [
      entry({ id: 'root', ts: 1000, position: 1, branchId: 'coordinator', actor: 'root' }),
      entry({ id: 'child-a', ts: 2000, position: 2, branchId: 'worker', parentId: 'root', actor: 'worker', status: 'active' }),
    ];

    const { container } = render(<ProcessGraph entries={entries} />);

    expect(container.querySelector('[data-connector="fork"][data-lane="worker"]')).toBeInTheDocument();
    expect(container.querySelector('[data-connector="merge"][data-lane="worker"]')).not.toBeInTheDocument();
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
