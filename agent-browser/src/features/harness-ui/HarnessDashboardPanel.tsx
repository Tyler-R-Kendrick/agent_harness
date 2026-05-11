import { useEffect, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';

import { HarnessJsonRenderer, type HarnessBrowserPageSummary, type HarnessFileSummary, type HarnessKnowledgeSummary, type HarnessSessionSummary } from './HarnessJsonRenderer';
import { normalizeWidgetPosition, normalizeWidgetSize } from './spaceLayout';
import type { HarnessAppSpec, HarnessElement, HarnessElementPatch, WidgetPosition, WidgetSize } from './types';

export type HarnessDashboardPanelProps = {
  spec: HarnessAppSpec;
  workspaceName: string;
  sessions: HarnessSessionSummary[];
  browserPages?: HarnessBrowserPageSummary[];
  files?: HarnessFileSummary[];
  knowledge: HarnessKnowledgeSummary;
  onCreateDashboardWidget?: (position: WidgetPosition) => void;
  onOpenWidgetSession?: (widgetId: string) => void;
  onPatchElement?: (patch: HarnessElementPatch) => void;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
};

type WidgetLayout = {
  position: WidgetPosition;
  size: WidgetSize;
};

type WidgetLayouts = Record<string, WidgetLayout>;

type ViewportState = {
  panX: number;
  panY: number;
  zoom: number;
};

type WidgetInteraction = {
  kind: 'move' | 'resize';
  pointerId: number;
  widgetId: string;
  startX: number;
  startY: number;
  origin: WidgetLayout;
  lastKey: string;
};

type PanInteraction = {
  kind: 'pan';
  pointerId: number;
  startX: number;
  startY: number;
  originPanX: number;
  originPanY: number;
};

type MinimapInteraction = {
  kind: 'minimap';
  pointerId: number;
};

type DashboardInteraction = WidgetInteraction | PanInteraction | MinimapInteraction;

const DEFAULT_WIDGET_SIZE: WidgetSize = Object.freeze({ cols: 5, rows: 3 });
const MIN_WIDGET_SIZE: WidgetSize = Object.freeze({ cols: 3, rows: 2 });
const MAX_WIDGET_SIZE: WidgetSize = Object.freeze({ cols: 24, rows: 24 });
const CELL_PX = 72;
const GAP_PX = 10;
const GRID_STEP_PX = CELL_PX + GAP_PX;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.4;
const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 104;

function readDashboardElement(spec: HarnessAppSpec) {
  return Object.values(spec.elements).find((element) => element.type === 'DashboardCanvas') ?? spec.elements[spec.root];
}

function readTitle(spec: HarnessAppSpec, elementId: string, fallback: string) {
  const title = spec.elements[elementId]?.props?.title;
  return typeof title === 'string' && title.trim() ? title.trim() : fallback;
}

function readElementTitle(element: HarnessElement, fallback: string) {
  const title = element.props?.title;
  return typeof title === 'string' && title.trim() ? title.trim() : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampWidgetSize(size: WidgetSize): WidgetSize {
  return {
    cols: clamp(size.cols, MIN_WIDGET_SIZE.cols, MAX_WIDGET_SIZE.cols),
    rows: clamp(size.rows, MIN_WIDGET_SIZE.rows, MAX_WIDGET_SIZE.rows),
  };
}

function readWidgetPosition(element: HarnessElement, fallback: WidgetPosition) {
  return normalizeWidgetPosition(element.props?.position ?? fallback);
}

function readWidgetSize(element: HarnessElement) {
  return clampWidgetSize(normalizeWidgetSize(element.props?.size, DEFAULT_WIDGET_SIZE));
}

function widgetStyle(position: WidgetPosition, size: WidgetSize) {
  return {
    '--harness-widget-col': String(position.col),
    '--harness-widget-row': String(position.row),
    '--harness-widget-cols': String(size.cols),
    '--harness-widget-rows': String(size.rows),
  } as CSSProperties;
}

function buildDefaultWidgetPositions(widgetIds: readonly string[]): Record<string, WidgetPosition> {
  return Object.fromEntries(widgetIds.map((widgetId, index) => [
    widgetId,
    {
      col: (index % 2) * 7 - 7,
      row: Math.floor(index / 2) * 4 - 2,
    },
  ]));
}

function viewportStyle(viewport: ViewportState) {
  return {
    '--harness-canvas-pan-x': `${viewport.panX}px`,
    '--harness-canvas-pan-y': `${viewport.panY}px`,
    '--harness-canvas-zoom': String(viewport.zoom),
  } as CSSProperties;
}

function menuStyle(x: number, y: number) {
  return {
    '--harness-menu-x': `${x}px`,
    '--harness-menu-y': `${y}px`,
  } as CSSProperties;
}

function formatDataNumber(value: number) {
  return Number(value.toFixed(2)).toString();
}

function computeCanvasBounds(layouts: WidgetLayouts) {
  const entries = Object.values(layouts);
  if (!entries.length) {
    return { minX: -400, minY: -240, width: 800, height: 480 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const layout of entries) {
    const left = layout.position.col * GRID_STEP_PX;
    const top = layout.position.row * GRID_STEP_PX;
    const right = left + (layout.size.cols * CELL_PX) + ((layout.size.cols - 1) * GAP_PX);
    const bottom = top + (layout.size.rows * CELL_PX) + ((layout.size.rows - 1) * GAP_PX);
    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, right);
    maxY = Math.max(maxY, bottom);
  }
  const padding = 240;
  return {
    minX: minX - padding,
    minY: minY - padding,
    width: Math.max(1, maxX - minX + padding * 2),
    height: Math.max(1, maxY - minY + padding * 2),
  };
}

function minimapRectStyle(layout: WidgetLayout, bounds: ReturnType<typeof computeCanvasBounds>) {
  const left = ((layout.position.col * GRID_STEP_PX) - bounds.minX) / bounds.width;
  const top = ((layout.position.row * GRID_STEP_PX) - bounds.minY) / bounds.height;
  const width = ((layout.size.cols * CELL_PX) + ((layout.size.cols - 1) * GAP_PX)) / bounds.width;
  const height = ((layout.size.rows * CELL_PX) + ((layout.size.rows - 1) * GAP_PX)) / bounds.height;
  return {
    left: `${clamp(left, 0, 1) * 100}%`,
    top: `${clamp(top, 0, 1) * 100}%`,
    width: `${clamp(width, 0.02, 1) * 100}%`,
    height: `${clamp(height, 0.02, 1) * 100}%`,
  };
}

export function HarnessDashboardPanel({
  spec,
  workspaceName,
  sessions,
  browserPages = [],
  files = [],
  knowledge,
  onCreateDashboardWidget,
  onOpenWidgetSession,
  onPatchElement,
  dragHandleProps,
}: HarnessDashboardPanelProps) {
  const [viewport, setViewport] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 });
  const [canvasMenu, setCanvasMenu] = useState<{ x: number; y: number; position: WidgetPosition } | null>(null);
  const interactionRef = useRef<DashboardInteraction | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const dashboard = readDashboardElement(spec);
  const widgets = useMemo(
    () => (dashboard.children ?? [])
      .map((widgetId) => spec.elements[widgetId])
      .filter((element): element is HarnessElement => Boolean(element)),
    [dashboard.children, spec.elements],
  );
  const widgetIds = useMemo(() => widgets.map((widget) => widget.id), [widgets]);
  const defaultPositions = useMemo(() => buildDefaultWidgetPositions(widgetIds), [widgetIds]);
  const widgetLayouts = useMemo<WidgetLayouts>(() => {
    return Object.fromEntries(widgets.map((widget) => [
      widget.id,
      {
        position: readWidgetPosition(widget, defaultPositions[widget.id] ?? { col: 0, row: 0 }),
        size: readWidgetSize(widget),
      },
    ]));
  }, [defaultPositions, widgets]);
  const minimapBounds = useMemo(() => computeCanvasBounds(widgetLayouts), [widgetLayouts]);
  const renderContext = useMemo(() => ({
    workspaceName,
    sessions,
    browserPages,
    files,
    knowledge,
  }), [browserPages, files, knowledge, sessions, workspaceName]);

  const commitWidgetLayout = (widgetId: string, nextLayout: WidgetLayout) => {
    if (!onPatchElement) return;
    onPatchElement({
      elementId: widgetId,
      props: {
        position: normalizeWidgetPosition(nextLayout.position),
        size: clampWidgetSize(normalizeWidgetSize(nextLayout.size, DEFAULT_WIDGET_SIZE)),
      },
    });
  };

  const canvasPositionFromClient = (clientX: number, clientY: number): WidgetPosition => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const localX = clientX - (rect?.left ?? 0);
    const localY = clientY - (rect?.top ?? 0);
    return {
      col: Math.round(((localX - viewport.panX) / viewport.zoom) / GRID_STEP_PX),
      row: Math.round(((localY - viewport.panY) / viewport.zoom) / GRID_STEP_PX),
    };
  };

  const navigateFromMinimap = (clientX: number, clientY: number) => {
    const rect = minimapRef.current?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    const width = rect?.width || MINIMAP_WIDTH;
    const height = rect?.height || MINIMAP_HEIGHT;
    const normalizedX = clamp((clientX - left) / width, 0, 1);
    const normalizedY = clamp((clientY - top) / height, 0, 1);
    const targetWorldX = minimapBounds.minX + normalizedX * minimapBounds.width;
    const targetWorldY = minimapBounds.minY + normalizedY * minimapBounds.height;
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const centerX = (canvasRect?.width || 960) / 2;
    const centerY = (canvasRect?.height || 640) / 2;
    setViewport((current) => ({
      ...current,
      panX: centerX - targetWorldX * current.zoom,
      panY: centerY - targetWorldY * current.zoom,
    }));
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) return;

      if (interaction.kind === 'pan') {
        setViewport((current) => ({
          ...current,
          panX: interaction.originPanX + event.clientX - interaction.startX,
          panY: interaction.originPanY + event.clientY - interaction.startY,
        }));
        return;
      }

      if (interaction.kind === 'minimap') {
        navigateFromMinimap(event.clientX, event.clientY);
        return;
      }

      const deltaCols = Math.round((event.clientX - interaction.startX) / (GRID_STEP_PX * viewport.zoom));
      const deltaRows = Math.round((event.clientY - interaction.startY) / (GRID_STEP_PX * viewport.zoom));
      const nextLayout = interaction.kind === 'move'
        ? {
          position: {
            col: interaction.origin.position.col + deltaCols,
            row: interaction.origin.position.row + deltaRows,
          },
          size: interaction.origin.size,
        }
        : {
          position: interaction.origin.position,
          size: clampWidgetSize({
            cols: interaction.origin.size.cols + deltaCols,
            rows: interaction.origin.size.rows + deltaRows,
          }),
        };
      const key = JSON.stringify(nextLayout);
      if (key === interaction.lastKey) return;
      interactionRef.current = { ...interaction, lastKey: key };
      commitWidgetLayout(interaction.widgetId, nextLayout);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (interactionRef.current?.pointerId === event.pointerId) {
        interactionRef.current = null;
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [commitWidgetLayout, navigateFromMinimap, viewport.zoom]);

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    setCanvasMenu(null);
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('.harness-widget-card, .harness-dashboard-canvas-heading, .harness-dashboard-context-menu, .harness-dashboard-minimap, button, input, select, textarea')) {
      return;
    }
    interactionRef.current = {
      kind: 'pan',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originPanX: viewport.panX,
      originPanY: viewport.panY,
    };
  };

  const handleCanvasContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('.harness-widget-card, .harness-dashboard-canvas-heading, .harness-dashboard-context-menu, .harness-dashboard-minimap, button, input, select, textarea')) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setCanvasMenu({
      x: event.clientX,
      y: event.clientY,
      position: canvasPositionFromClient(event.clientX, event.clientY),
    });
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    setViewport((current) => {
      const nextZoom = clamp(current.zoom * Math.exp(-event.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM);
      const worldX = (localX - current.panX) / current.zoom;
      const worldY = (localY - current.panY) / current.zoom;
      return {
        zoom: nextZoom,
        panX: localX - worldX * nextZoom,
        panY: localY - worldY * nextZoom,
      };
    });
  };

  const startWidgetInteraction = (
    kind: WidgetInteraction['kind'],
    widgetId: string,
    layout: WidgetLayout,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (!onPatchElement || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (kind === 'move' && target.closest('button, input, select, textarea')) return;
    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      kind,
      pointerId: event.pointerId,
      widgetId,
      startX: event.clientX,
      startY: event.clientY,
      origin: layout,
      lastKey: JSON.stringify(layout),
    };
  };

  const startMinimapInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    navigateFromMinimap(event.clientX, event.clientY);
    interactionRef.current = {
      kind: 'minimap',
      pointerId: event.pointerId,
    };
  };

  return (
    <section className="harness-dashboard-panel" aria-label="Harness dashboard">
      <div className="harness-dashboard-workbench">
        <div
          ref={canvasRef}
          className="harness-dashboard-canvas"
          aria-label="Infinite session canvas"
          data-pan-x={formatDataNumber(viewport.panX)}
          data-pan-y={formatDataNumber(viewport.panY)}
          data-zoom={formatDataNumber(viewport.zoom)}
          onContextMenu={handleCanvasContextMenu}
          onPointerDown={handleCanvasPointerDown}
          onWheel={handleWheel}
        >
          <div className="harness-dashboard-canvas-chrome">
            <div
              className={`harness-dashboard-canvas-heading${dragHandleProps ? ' harness-dashboard-canvas-heading--draggable' : ''}`}
              {...dragHandleProps}
            >
              <span className="panel-resource-eyebrow">workspace/{workspaceName}</span>
              <h2>{readTitle(spec, dashboard.id, `${workspaceName} harness`)}</h2>
            </div>
          </div>
          <div className="harness-dashboard-space" style={viewportStyle(viewport)}>
            <div className="harness-dashboard-grid" aria-label="Dashboard widgets">
              {widgets.map((widget) => {
                const title = readElementTitle(widget, widget.id);
                const layout = widgetLayouts[widget.id] ?? {
                  position: { col: 0, row: 0 },
                  size: DEFAULT_WIDGET_SIZE,
                };
                return (
                  <article
                    key={widget.id}
                    className="harness-widget-card"
                    aria-label={`${title} widget`}
                    style={widgetStyle(layout.position, layout.size)}
                  >
                    <header
                      className="harness-widget-header harness-widget-drag-handle"
                      aria-label={`Move ${title} widget`}
                      onPointerDown={(event) => startWidgetInteraction('move', widget.id, layout, event)}
                    >
                      <div className="harness-widget-title-group">
                        <button
                          type="button"
                          className="harness-widget-title-button"
                          aria-label={`Open ${title} widget session`}
                          onClick={() => onOpenWidgetSession?.(widget.id)}
                        >
                          {title}
                        </button>
                        <span className="harness-widget-kicker">Dashboard widget</span>
                      </div>
                      <span className="harness-widget-badge">{widget.type}</span>
                    </header>
                    <div className="harness-widget-body" tabIndex={0} aria-label={`${title} widget contents`}>
                      <HarnessJsonRenderer spec={spec} rootId={widget.id} context={renderContext} />
                    </div>
                    <button
                      type="button"
                      className="harness-widget-resize-handle"
                      aria-label={`Resize ${title} widget`}
                      disabled={!onPatchElement}
                      onPointerDown={(event) => startWidgetInteraction('resize', widget.id, layout, event)}
                    />
                  </article>
                );
              })}
              {!widgets.length ? (
                <article className="harness-add-widget-card harness-empty-session-widget-card" aria-label="No dashboard widgets">
                  <header className="harness-widget-header">
                    <h3>No dashboard widgets</h3>
                  </header>
                  <div className="harness-add-widget-body">
                    <p className="harness-widget-empty">Right-click the canvas to create a widget.</p>
                  </div>
                </article>
              ) : null}
            </div>
          </div>
          {canvasMenu ? (
            <div
              className="harness-dashboard-context-menu"
              role="menu"
              aria-label="Canvas widget menu"
              style={menuStyle(canvasMenu.x, canvasMenu.y)}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onCreateDashboardWidget?.(canvasMenu.position);
                  setCanvasMenu(null);
                }}
              >
                Create widget
              </button>
            </div>
          ) : null}
          <div
            ref={minimapRef}
            className="harness-dashboard-minimap"
            aria-label="Canvas minimap"
            onPointerDown={startMinimapInteraction}
          >
            <div className="harness-dashboard-minimap-grid">
              {widgets.map((widget) => {
                const layout = widgetLayouts[widget.id];
                if (!layout) return null;
                return (
                  <span
                    key={widget.id}
                    className="harness-dashboard-minimap-region"
                    style={minimapRectStyle(layout, minimapBounds)}
                    title={readElementTitle(widget, widget.id)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
