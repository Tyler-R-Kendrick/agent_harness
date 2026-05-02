import type { WidgetLayout, WidgetPosition, WidgetSize } from './types';

const GRID_COORD_MIN = -4096;
const GRID_COORD_MAX = 4096;
const MAX_WIDGET_COLS = 24;
const MAX_WIDGET_ROWS = 24;
const DEFAULT_WIDGET_POSITION: WidgetPosition = Object.freeze({ col: 0, row: 0 });
const DEFAULT_WIDGET_SIZE: WidgetSize = Object.freeze({ cols: 6, rows: 3 });
const WIDGET_SIZE_PRESETS: Record<string, WidgetSize> = Object.freeze({
  small: Object.freeze({ cols: 4, rows: 2 }),
  medium: Object.freeze({ cols: 6, rows: 3 }),
  large: Object.freeze({ cols: 8, rows: 4 }),
  tall: Object.freeze({ cols: 4, rows: 5 }),
  full: Object.freeze({ cols: 12, rows: 4 }),
});

type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function coerceSizeObject(size: Record<string, unknown>, fallback = DEFAULT_WIDGET_SIZE): WidgetSize {
  return {
    cols: clampInteger(size.cols ?? size.width, 1, MAX_WIDGET_COLS, fallback.cols),
    rows: clampInteger(size.rows ?? size.height, 1, MAX_WIDGET_ROWS, fallback.rows),
  };
}

function resolveFallbackSize(fallback: unknown): WidgetSize {
  if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
    return coerceSizeObject(fallback as Record<string, unknown>, DEFAULT_WIDGET_SIZE);
  }
  if (typeof fallback === 'string' || Array.isArray(fallback)) {
    return normalizeWidgetSize(fallback, DEFAULT_WIDGET_SIZE);
  }
  return { ...DEFAULT_WIDGET_SIZE };
}

export function normalizeWidgetSize(size: unknown, fallback: unknown = DEFAULT_WIDGET_SIZE): WidgetSize {
  if (typeof size === 'string') {
    const key = size.trim().toLowerCase();
    const preset = WIDGET_SIZE_PRESETS[key];
    if (preset) return { ...preset, preset: key };
    const match = key.match(/^(\d+)\s*x\s*(\d+)$/u);
    if (match) return normalizeWidgetSize({ cols: match[1], rows: match[2] }, fallback);
  }
  if (Array.isArray(size) && size.length >= 2) {
    return normalizeWidgetSize({ cols: size[0], rows: size[1] }, fallback);
  }
  if (size && typeof size === 'object') {
    return coerceSizeObject(size as Record<string, unknown>, resolveFallbackSize(fallback));
  }
  if (fallback !== DEFAULT_WIDGET_SIZE) return normalizeWidgetSize(fallback, DEFAULT_WIDGET_SIZE);
  return { ...DEFAULT_WIDGET_SIZE };
}

function coercePositionObject(position: Record<string, unknown>, fallback = DEFAULT_WIDGET_POSITION): WidgetPosition {
  return {
    col: clampInteger(position.col ?? position.x, GRID_COORD_MIN, GRID_COORD_MAX, fallback.col),
    row: clampInteger(position.row ?? position.y, GRID_COORD_MIN, GRID_COORD_MAX, fallback.row),
  };
}

function resolveFallbackPosition(fallback: unknown): WidgetPosition {
  if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
    return coercePositionObject(fallback as Record<string, unknown>, DEFAULT_WIDGET_POSITION);
  }
  if (typeof fallback === 'string') {
    const match = fallback.trim().match(/^(-?\d+)\s*,\s*(-?\d+)$/u);
    if (match) return coercePositionObject({ col: match[1], row: match[2] }, DEFAULT_WIDGET_POSITION);
  }
  if (Array.isArray(fallback) && fallback.length >= 2) {
    return coercePositionObject({ col: fallback[0], row: fallback[1] }, DEFAULT_WIDGET_POSITION);
  }
  return { ...DEFAULT_WIDGET_POSITION };
}

export function normalizeWidgetPosition(position: unknown, fallback: unknown = DEFAULT_WIDGET_POSITION): WidgetPosition {
  const fallbackPosition = resolveFallbackPosition(fallback);
  if (typeof position === 'string') {
    const match = position.trim().match(/^(-?\d+)\s*,\s*(-?\d+)$/u);
    if (match) return coercePositionObject({ col: match[1], row: match[2] }, fallbackPosition);
  }
  if (Array.isArray(position) && position.length >= 2) {
    return coercePositionObject({ col: position[0], row: position[1] }, fallbackPosition);
  }
  if (position && typeof position === 'object') {
    return coercePositionObject(position as Record<string, unknown>, fallbackPosition);
  }
  return { ...fallbackPosition };
}

function clampWidgetPosition(position: unknown, size: unknown): WidgetPosition {
  const normalizedSize = normalizeWidgetSize(size);
  const normalizedPosition = normalizeWidgetPosition(position);
  return {
    col: Math.min(GRID_COORD_MAX - normalizedSize.cols + 1, Math.max(GRID_COORD_MIN, normalizedPosition.col)),
    row: Math.min(GRID_COORD_MAX - normalizedSize.rows + 1, Math.max(GRID_COORD_MIN, normalizedPosition.row)),
  };
}

function createRect(position: WidgetPosition, size: WidgetSize): Rect {
  const clamped = clampWidgetPosition(position, size);
  return {
    left: clamped.col,
    right: clamped.col + size.cols - 1,
    top: clamped.row,
    bottom: clamped.row + size.rows - 1,
  };
}

function rectsOverlap(left: Rect, right: Rect): boolean {
  return !(left.right < right.left || left.left > right.right || left.bottom < right.top || left.top > right.bottom);
}

function canPlace(position: WidgetPosition, size: WidgetSize, occupied: Rect[]): boolean {
  const next = createRect(position, size);
  return occupied.every((rect) => !rectsOverlap(next, rect));
}

function findFirstAvailablePosition(size: WidgetSize, occupied: Rect[], preferredPosition = DEFAULT_WIDGET_POSITION): WidgetPosition {
  const normalizedSize = normalizeWidgetSize(size);
  const preferred = clampWidgetPosition(preferredPosition, normalizedSize);
  const maxCol = GRID_COORD_MAX - normalizedSize.cols + 1;
  const maxRow = GRID_COORD_MAX - normalizedSize.rows + 1;
  for (let row = preferred.row; row <= maxRow; row += 1) {
    for (let col = preferred.col; col <= maxCol; col += 1) {
      const position = { col, row };
      if (canPlace(position, normalizedSize, occupied)) return position;
    }
  }
  return preferred;
}

function getRenderedWidgetSize(size: unknown, minimized = false): WidgetSize {
  const normalized = normalizeWidgetSize(size);
  return minimized ? { ...normalized, rows: 1 } : normalized;
}

export function resolveSpaceLayout({
  anchorMinimized = undefined,
  anchorPosition = undefined,
  anchorSize = undefined,
  anchorWidgetId = '',
  minimizedWidgetIds = [],
  widgetIds = [],
  widgetPositions = {},
  widgetSizes = {},
}: {
  anchorMinimized?: boolean;
  anchorPosition?: unknown;
  anchorSize?: unknown;
  anchorWidgetId?: string;
  minimizedWidgetIds?: string[];
  widgetIds?: string[];
  widgetPositions?: Record<string, unknown>;
  widgetSizes?: Record<string, unknown>;
} = {}): WidgetLayout {
  const minimizedSet = new Set(Array.isArray(minimizedWidgetIds) ? minimizedWidgetIds : []);
  const entries = widgetIds.map((widgetId, index) => {
    const preferredPosition = widgetId === anchorWidgetId && anchorPosition !== undefined
      ? normalizeWidgetPosition(anchorPosition, widgetPositions[widgetId])
      : normalizeWidgetPosition(widgetPositions[widgetId]);
    const minimized = widgetId === anchorWidgetId && anchorMinimized !== undefined
      ? Boolean(anchorMinimized)
      : minimizedSet.has(widgetId);
    const storedSize = widgetId === anchorWidgetId && anchorSize !== undefined
      ? normalizeWidgetSize(anchorSize, widgetSizes[widgetId])
      : normalizeWidgetSize(widgetSizes[widgetId]);
    return {
      index,
      minimized,
      preferredPosition,
      renderedSize: getRenderedWidgetSize(storedSize, minimized),
      widgetId,
    };
  });

  entries.sort((left, right) => {
    if (left.widgetId === anchorWidgetId && right.widgetId !== anchorWidgetId) return -1;
    if (right.widgetId === anchorWidgetId && left.widgetId !== anchorWidgetId) return 1;
    if (left.preferredPosition.row !== right.preferredPosition.row) return left.preferredPosition.row - right.preferredPosition.row;
    if (left.preferredPosition.col !== right.preferredPosition.col) return left.preferredPosition.col - right.preferredPosition.col;
    return left.index - right.index;
  });

  const occupied: Rect[] = [];
  const positions: Record<string, WidgetPosition> = {};
  const renderedSizes: Record<string, WidgetSize> = {};
  const minimizedMap: Record<string, boolean> = {};
  for (const entry of entries) {
    const position = findFirstAvailablePosition(entry.renderedSize, occupied, entry.preferredPosition);
    positions[entry.widgetId] = position;
    renderedSizes[entry.widgetId] = entry.renderedSize;
    minimizedMap[entry.widgetId] = entry.minimized;
    occupied.push(createRect(position, entry.renderedSize));
  }
  return { positions, renderedSizes, minimizedMap };
}

function buildPackingEntries(widgetIds: string[], widgetSizes: Record<string, unknown>) {
  return widgetIds.map((widgetId, index) => {
    const size = normalizeWidgetSize(widgetSizes[widgetId]);
    return { area: size.cols * size.rows, index, size, widgetId };
  });
}

function sortPackingEntries(entries: ReturnType<typeof buildPackingEntries>) {
  return [...entries].sort((left, right) => {
    if (right.area !== left.area) return right.area - left.area;
    if (right.size.cols !== left.size.cols) return right.size.cols - left.size.cols;
    if (right.size.rows !== left.size.rows) return right.size.rows - left.size.rows;
    return left.index - right.index;
  });
}

function resolvePackingWidth(entries: ReturnType<typeof buildPackingEntries>, viewportCols: number): number {
  if (!entries.length) return 1;
  const maxWidgetWidth = entries.reduce((max, entry) => Math.max(max, entry.size.cols), 1);
  const totalWidth = entries.reduce((sum, entry) => sum + entry.size.cols, 0);
  const viewportWidth = Number.isFinite(viewportCols) && viewportCols > 0 ? Math.floor(viewportCols) : totalWidth;
  return Math.max(maxWidgetWidth, Math.min(totalWidth, Math.max(maxWidgetWidth, viewportWidth)));
}

function buildFirstFitPackedPositions(
  entries: ReturnType<typeof buildPackingEntries>,
  widthThreshold: number,
  occupiedRects: Rect[] = [],
  startRow = 0,
): Record<string, WidgetPosition> {
  const positions: Record<string, WidgetPosition> = {};
  const occupied = [...occupiedRects];
  const remaining = sortPackingEntries(entries);
  let row = startRow;
  while (remaining.length) {
    for (let col = 0; col < widthThreshold; col += 1) {
      const candidate = { col, row };
      const match = remaining.find((entry) => (
        candidate.col + entry.size.cols <= widthThreshold
        && canPlace(candidate, entry.size, occupied)
      ));
      if (!match) continue;
      positions[match.widgetId] = candidate;
      occupied.push(createRect(candidate, match.size));
      remaining.splice(remaining.indexOf(match), 1);
    }
    row += 1;
  }
  return positions;
}

function computeBounds(positions: Record<string, WidgetPosition>, sizes: Record<string, unknown>) {
  const values = Object.entries(positions);
  if (!values.length) return { minCol: 0, minRow: 0, maxCol: 0, maxRow: 0, width: 0, height: 0 };
  let minCol = Number.POSITIVE_INFINITY;
  let minRow = Number.POSITIVE_INFINITY;
  let maxCol = Number.NEGATIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  for (const [widgetId, position] of values) {
    const size = normalizeWidgetSize(sizes[widgetId]);
    minCol = Math.min(minCol, position.col);
    minRow = Math.min(minRow, position.row);
    maxCol = Math.max(maxCol, position.col + size.cols);
    maxRow = Math.max(maxRow, position.row + size.rows);
  }
  return { minCol, minRow, maxCol, maxRow, width: maxCol - minCol, height: maxRow - minRow };
}

function centerPackedPositions(positions: Record<string, WidgetPosition>, sizes: Record<string, unknown>) {
  const bounds = computeBounds(positions, sizes);
  const shiftCol = -Math.floor(bounds.width / 2) - bounds.minCol;
  const shiftRow = -Math.floor(bounds.height / 2) - bounds.minRow;
  return Object.fromEntries(
    Object.entries(positions).map(([widgetId, position]) => [
      widgetId,
      { col: position.col + shiftCol, row: position.row + shiftRow },
    ]),
  );
}

export function buildCenteredFirstFitLayout({
  viewportCols = 0,
  widgetIds = [],
  widgetSizes = {},
}: {
  viewportCols?: number;
  widgetIds?: string[];
  widgetSizes?: Record<string, unknown>;
} = {}): { positions: Record<string, WidgetPosition> } {
  const entries = buildPackingEntries(widgetIds, widgetSizes);
  if (!entries.length) return { positions: {} };
  const width = resolvePackingWidth(entries, viewportCols);
  const positions = buildFirstFitPackedPositions(entries, width);
  return { positions: centerPackedPositions(positions, widgetSizes) };
}

export function findFirstFitWidgetPlacement({
  existingWidgetPositions = {},
  existingWidgetSizes = {},
  viewportCols = 0,
  widgetSize = DEFAULT_WIDGET_SIZE,
}: {
  existingWidgetPositions?: Record<string, WidgetPosition>;
  existingWidgetSizes?: Record<string, unknown>;
  viewportCols?: number;
  widgetSize?: unknown;
} = {}): WidgetPosition {
  const normalizedSize = normalizeWidgetSize(widgetSize);
  const existingBounds = computeBounds(existingWidgetPositions, existingWidgetSizes);
  const hasExisting = Object.keys(existingWidgetPositions).length > 0;
  const startCol = hasExisting ? existingBounds.minCol : 0;
  const startRow = hasExisting ? existingBounds.minRow : 0;
  const width = Number.isFinite(viewportCols) && viewportCols > 0
    ? Math.max(normalizedSize.cols, Math.floor(viewportCols))
    : Math.max(normalizedSize.cols, existingBounds.width + normalizedSize.cols);
  const occupied = Object.entries(existingWidgetPositions).map(([widgetId, position]) => (
    createRect(
      { col: position.col - startCol, row: position.row - startRow },
      normalizeWidgetSize(existingWidgetSizes[widgetId]),
    )
  ));
  for (let row = 0; row <= GRID_COORD_MAX; row += 1) {
    for (let col = 0; col + normalizedSize.cols <= width; col += 1) {
      const local = { col, row };
      if (canPlace(local, normalizedSize, occupied)) {
        return { col: local.col + startCol, row: local.row + startRow };
      }
    }
  }
  return { col: startCol, row: startRow };
}
