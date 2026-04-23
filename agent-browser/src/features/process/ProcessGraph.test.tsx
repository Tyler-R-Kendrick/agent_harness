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
