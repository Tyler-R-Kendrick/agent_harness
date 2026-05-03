export type RenderPaneLayoutOptions = {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
};

export type RenderPaneLayout<TPane> = {
  rows: TPane[][];
  hiddenCount: number;
};

const DEFAULT_MIN_WIDTH = 320;
const DEFAULT_MIN_HEIGHT = 240;
const MAX_COLUMNS = 2;

function resolveColumnCount(width: number | undefined, minWidth: number): number {
  if (!Number.isFinite(width) || (width ?? 0) <= 0) {
    return MAX_COLUMNS;
  }
  return Math.max(1, Math.min(MAX_COLUMNS, Math.floor((width ?? 0) / minWidth)));
}

function resolveMaxRows(height: number | undefined, minHeight: number, neededRows: number): number {
  if (!Number.isFinite(height) || (height ?? 0) <= 0) {
    return neededRows;
  }
  return Math.max(1, Math.floor((height ?? 0) / minHeight));
}

export function planRenderPaneRows<TPane>(
  panes: readonly TPane[],
  options: RenderPaneLayoutOptions = {},
): RenderPaneLayout<TPane> {
  const minWidth = Number.isFinite(options.minWidth) && (options.minWidth ?? 0) > 0
    ? options.minWidth ?? DEFAULT_MIN_WIDTH
    : DEFAULT_MIN_WIDTH;
  const minHeight = Number.isFinite(options.minHeight) && (options.minHeight ?? 0) > 0
    ? options.minHeight ?? DEFAULT_MIN_HEIGHT
    : DEFAULT_MIN_HEIGHT;
  const columns = resolveColumnCount(options.width, minWidth);
  const neededRows = Math.ceil(panes.length / columns);
  const visibleRows = resolveMaxRows(options.height, minHeight, neededRows);
  const visibleCount = Math.min(panes.length, visibleRows * columns);
  const visiblePanes = panes.slice(0, visibleCount);
  const rows: TPane[][] = [];

  for (let index = 0; index < visiblePanes.length; index += columns) {
    rows.push(visiblePanes.slice(index, index + columns));
  }

  return {
    rows,
    hiddenCount: panes.length - visiblePanes.length,
  };
}
