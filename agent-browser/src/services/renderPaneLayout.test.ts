import { describe, expect, it } from 'vitest';

import { planRenderPaneRows } from './renderPaneLayout';

describe('renderPaneLayout', () => {
  const panes = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));

  it('uses the expected split-pane row pattern', () => {
    expect(planRenderPaneRows(panes.slice(0, 1), { width: 1200, height: 900 }).rows.map((row) => row.map((pane) => pane.id))).toEqual([
      ['a'],
    ]);
    expect(planRenderPaneRows(panes.slice(0, 2), { width: 1200, height: 900 }).rows.map((row) => row.map((pane) => pane.id))).toEqual([
      ['a', 'b'],
    ]);
    expect(planRenderPaneRows(panes.slice(0, 3), { width: 1200, height: 900 }).rows.map((row) => row.map((pane) => pane.id))).toEqual([
      ['a', 'b'],
      ['c'],
    ]);
    expect(planRenderPaneRows(panes.slice(0, 4), { width: 1200, height: 900 }).rows.map((row) => row.map((pane) => pane.id))).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('falls back to one column when the container cannot fit two minimum-width panes', () => {
    expect(planRenderPaneRows(panes.slice(0, 3), { width: 500, height: 900 }).rows.map((row) => row.map((pane) => pane.id))).toEqual([
      ['a'],
      ['b'],
      ['c'],
    ]);
  });

  it('hides rows that would breach the minimum pane height', () => {
    const layout = planRenderPaneRows(panes, { width: 1200, height: 260 });

    expect(layout.rows.map((row) => row.map((pane) => pane.id))).toEqual([
      ['a', 'b'],
    ]);
    expect(layout.hiddenCount).toBe(3);
  });
});
