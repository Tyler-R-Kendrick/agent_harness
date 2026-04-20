import type { WorkspaceMcpRenderPane } from 'agent-browser-mcp';

export function orderRenderPanes<TPane extends WorkspaceMcpRenderPane>(
  renderPanes: readonly TPane[],
  panelOrder: readonly string[] = [],
): TPane[] {
  const panesById = new Map(renderPanes.map((pane) => [pane.id, pane]));
  const ordered: TPane[] = [];

  for (const paneId of panelOrder) {
    const pane = panesById.get(paneId);
    if (!pane) {
      continue;
    }
    ordered.push(pane);
    panesById.delete(paneId);
  }

  for (const pane of renderPanes) {
    if (!panesById.has(pane.id)) {
      continue;
    }
    ordered.push(pane);
    panesById.delete(pane.id);
  }

  return ordered;
}

export function moveRenderPaneOrder<TPane extends WorkspaceMcpRenderPane>(
  renderPanes: readonly TPane[],
  panelOrder: readonly string[] = [],
  paneId: string,
  toIndex: number,
): string[] {
  const orderedIds = orderRenderPanes(renderPanes, panelOrder).map((pane) => pane.id);
  const currentIndex = orderedIds.indexOf(paneId);
  if (currentIndex === -1) {
    throw new DOMException(`Render pane "${paneId}" is not available.`, 'NotFoundError');
  }

  const clampedIndex = Math.max(0, Math.min(toIndex, Math.max(orderedIds.length - 1, 0)));
  if (currentIndex === clampedIndex) {
    return orderedIds;
  }

  const nextIds = [...orderedIds];
  const [moved] = nextIds.splice(currentIndex, 1);
  nextIds.splice(clampedIndex, 0, moved);
  return nextIds;
}