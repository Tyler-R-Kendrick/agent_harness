import { describe, expect, it } from 'vitest';

import { moveRenderPaneOrder, orderRenderPanes } from './workspaceMcpPanes';

const PANES = [
  { id: 'file:AGENTS.md', paneType: 'workspace-file' as const, itemId: 'AGENTS.md', label: 'AGENTS.md', path: 'AGENTS.md' },
  { id: 'browser:page-1', paneType: 'browser-page' as const, itemId: 'page-1', label: 'Docs', url: 'https://example.com' },
  { id: 'session:session-1', paneType: 'session' as const, itemId: 'session-1', label: 'Session 1' },
];

describe('workspaceMcpPanes', () => {
  it('orders render panes by saved panel order and appends new panes', () => {
    expect(orderRenderPanes(PANES, ['session:session-1', 'file:AGENTS.md'])).toEqual([
      PANES[2],
      PANES[0],
      PANES[1],
    ]);
  });

  it('moves a render pane to a new index and clamps the target index', () => {
    expect(moveRenderPaneOrder(PANES, [], 'session:session-1', 0)).toEqual([
      'session:session-1',
      'file:AGENTS.md',
      'browser:page-1',
    ]);
    expect(moveRenderPaneOrder(PANES, [], 'file:AGENTS.md', 99)).toEqual([
      'browser:page-1',
      'session:session-1',
      'file:AGENTS.md',
    ]);
  });

  it('throws when moving a pane that is not visible', () => {
    expect(() => moveRenderPaneOrder(PANES, [], 'missing-pane', 0)).toThrow('missing-pane');
  });
});