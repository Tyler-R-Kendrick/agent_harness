import { useEffect, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { Plus } from 'lucide-react';

import type { HarnessBrowserPageSummary, HarnessFileSummary, HarnessSessionSummary } from './HarnessJsonRenderer';
import { HarnessInspectorPanel } from './HarnessInspectorPanel';
import { normalizeWidgetPosition, normalizeWidgetSize, resolveSpaceLayout } from './spaceLayout';
import type { HarnessAppSpec, HarnessElement, HarnessElementPatch, JsonValue, WidgetPosition, WidgetSize } from './types';

export type HarnessDashboardPanelProps = {
  spec: HarnessAppSpec;
  workspaceName: string;
  sessions: HarnessSessionSummary[];
  browserPages?: HarnessBrowserPageSummary[];
  files?: HarnessFileSummary[];
  onCreateSessionWidget: () => void;
  onOpenSession?: (sessionId: string) => void;
  onPatchElement?: (patch: HarnessElementPatch) => void;
  onRegenerate?: (prompt: string) => void;
  onRestoreDefault?: () => void;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
};

type SessionWidgetLayout = {
  position: WidgetPosition;
  size: WidgetSize;
};

type SessionWidgetLayouts = Record<string, SessionWidgetLayout>;

type ViewportState = {
  panX: number;
  panY: number;
  zoom: number;
};

type WidgetInteraction = {
  kind: 'move' | 'resize';
  pointerId: number;
  sessionId: string;
  startX: number;
  startY: number;
  origin: SessionWidgetLayout;
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

const DEFAULT_SESSION_WIDGET_SIZE: WidgetSize = Object.freeze({ cols: 5, rows: 3 });
const MIN_SESSION_WIDGET_SIZE: WidgetSize = Object.freeze({ cols: 3, rows: 2 });
const MAX_SESSION_WIDGET_SIZE: WidgetSize = Object.freeze({ cols: 24, rows: 24 });
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampWidgetSize(size: WidgetSize): WidgetSize {
  return {
    cols: clamp(size.cols, MIN_SESSION_WIDGET_SIZE.cols, MAX_SESSION_WIDGET_SIZE.cols),
    rows: clamp(size.rows, MIN_SESSION_WIDGET_SIZE.rows, MAX_SESSION_WIDGET_SIZE.rows),
  };
}

function readSessionWidgetLayouts(dashboard: HarnessElement): SessionWidgetLayouts {
  const rawLayouts = dashboard.props?.sessionWidgetLayouts;
  if (!isRecord(rawLayouts)) return {};
  const layouts: SessionWidgetLayouts = {};
  for (const [sessionId, rawLayout] of Object.entries(rawLayouts)) {
    if (!isRecord(rawLayout)) continue;
    layouts[sessionId] = {
      position: normalizeWidgetPosition(rawLayout.position),
      size: clampWidgetSize(normalizeWidgetSize(rawLayout.size, DEFAULT_SESSION_WIDGET_SIZE)),
    };
  }
  return layouts;
}

function toJsonLayouts(layouts: SessionWidgetLayouts): JsonValue {
  return Object.fromEntries(
    Object.entries(layouts).map(([sessionId, layout]) => [
      sessionId,
      {
        position: { col: layout.position.col, row: layout.position.row },
        size: { cols: layout.size.cols, rows: layout.size.rows },
      },
    ]),
  ) as JsonValue;
}

function widgetStyle(position: WidgetPosition, size: WidgetSize) {
  return {
    '--harness-widget-col': String(position.col),
    '--harness-widget-row': String(position.row),
    '--harness-widget-cols': String(size.cols),
    '--harness-widget-rows': String(size.rows),
  } as CSSProperties;
}

function buildDefaultSessionPositions(sessionIds: readonly string[]): Record<string, WidgetPosition> {
  return Object.fromEntries(sessionIds.map((sessionId, index) => [
    sessionId,
    {
      col: (index % 2) * 6,
      row: Math.floor(index / 2) * 4,
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

function formatDataNumber(value: number) {
  return Number(value.toFixed(2)).toString();
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function conversationMessages(session: HarnessSessionSummary) {
  return (session.messages ?? []).filter((message) => message.role !== 'system' && message.content.trim());
}

function latestConversationText(session: HarnessSessionSummary) {
  const latest = conversationMessages(session).at(-1);
  return latest?.content.trim() || 'No conversation yet.';
}

function computeCanvasBounds(layouts: SessionWidgetLayouts) {
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

function minimapRectStyle(layout: SessionWidgetLayout, bounds: ReturnType<typeof computeCanvasBounds>) {
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
  onCreateSessionWidget,
  onOpenSession,
  onPatchElement,
  onRegenerate,
  onRestoreDefault,
  dragHandleProps,
}: HarnessDashboardPanelProps) {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [viewport, setViewport] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 });
  const interactionRef = useRef<DashboardInteraction | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const dashboard = readDashboardElement(spec);
  const storedLayouts = useMemo(() => readSessionWidgetLayouts(dashboard), [dashboard]);
  const sessionIds = useMemo(() => sessions.map((session) => session.id), [sessions]);
  const defaultPositions = useMemo(() => buildDefaultSessionPositions(sessionIds), [sessionIds]);
  const sessionLayouts = useMemo<SessionWidgetLayouts>(() => {
    const widgetPositions = Object.fromEntries(sessionIds.map((sessionId) => [
      sessionId,
      storedLayouts[sessionId]?.position ?? defaultPositions[sessionId] ?? { col: 0, row: 0 },
    ])) as Record<string, WidgetPosition>;
    const widgetSizes = Object.fromEntries(sessionIds.map((sessionId) => [
      sessionId,
      storedLayouts[sessionId]?.size ?? DEFAULT_SESSION_WIDGET_SIZE,
    ])) as Record<string, WidgetSize>;
    const layout = resolveSpaceLayout({ widgetIds: sessionIds, widgetPositions, widgetSizes });
    return Object.fromEntries(sessionIds.map((sessionId) => [
      sessionId,
      {
        position: layout.positions[sessionId] ?? normalizeWidgetPosition(widgetPositions[sessionId]),
        size: clampWidgetSize(layout.renderedSizes[sessionId] ?? normalizeWidgetSize(widgetSizes[sessionId], DEFAULT_SESSION_WIDGET_SIZE)),
      },
    ]));
  }, [defaultPositions, sessionIds, storedLayouts]);
  const minimapBounds = useMemo(() => computeCanvasBounds(sessionLayouts), [sessionLayouts]);
  const canCustomize = Boolean(onPatchElement && onRegenerate && onRestoreDefault);

  const commitSessionLayout = (sessionId: string, nextLayout: SessionWidgetLayout) => {
    if (!onPatchElement) return;
    onPatchElement({
      elementId: dashboard.id,
      props: {
        sessionWidgetLayouts: toJsonLayouts({
          ...storedLayouts,
          [sessionId]: {
            position: normalizeWidgetPosition(nextLayout.position),
            size: clampWidgetSize(normalizeWidgetSize(nextLayout.size, DEFAULT_SESSION_WIDGET_SIZE)),
          },
        }),
      },
    });
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
      commitSessionLayout(interaction.sessionId, nextLayout);
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
  }, [commitSessionLayout, navigateFromMinimap, viewport.zoom]);

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('.harness-widget-card, .harness-add-widget-card, .harness-dashboard-minimap, button, input, select, textarea')) {
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
    sessionId: string,
    layout: SessionWidgetLayout,
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
      sessionId,
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
      <div className={`panel-titlebar harness-dashboard-titlebar${dragHandleProps ? ' panel-titlebar--draggable' : ''}`} {...dragHandleProps}>
        <div className="panel-titlebar-heading">
          <span className="panel-resource-eyebrow">workspace/{workspaceName}</span>
          <h2>{readTitle(spec, dashboard.id, `${workspaceName} harness`)}</h2>
        </div>
        <div className="panel-titlebar-actions">
          {canCustomize ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setInspectorOpen((current) => !current)}
              aria-pressed={inspectorOpen}
            >
              Customize
            </button>
          ) : null}
          <button type="button" className="secondary-button harness-new-session-widget-button" onClick={onCreateSessionWidget}>
            <Plus size={13} />
            <span>New session widget</span>
          </button>
        </div>
      </div>

      <div className="harness-dashboard-workbench">
        <div
          ref={canvasRef}
          className="harness-dashboard-canvas"
          aria-label="Infinite session canvas"
          data-pan-x={formatDataNumber(viewport.panX)}
          data-pan-y={formatDataNumber(viewport.panY)}
          data-zoom={formatDataNumber(viewport.zoom)}
          onPointerDown={handleCanvasPointerDown}
          onWheel={handleWheel}
        >
          <div className="harness-dashboard-space" style={viewportStyle(viewport)}>
            <div className="harness-dashboard-grid" aria-label="Session widgets">
              {sessions.map((session) => {
                const layout = sessionLayouts[session.id] ?? {
                  position: { col: 0, row: 0 },
                  size: DEFAULT_SESSION_WIDGET_SIZE,
                };
                const messages = conversationMessages(session);
                const assets = session.assets ?? [];
                return (
                  <article
                    key={session.id}
                    className="harness-widget-card harness-session-widget-card"
                    aria-label={`${session.name} widget`}
                    style={widgetStyle(layout.position, layout.size)}
                  >
                    <header
                      className="harness-widget-header harness-widget-drag-handle"
                      aria-label={`Move ${session.name} widget`}
                      onPointerDown={(event) => startWidgetInteraction('move', session.id, layout, event)}
                    >
                      <div className="harness-widget-title-group">
                        <button
                          type="button"
                          className="harness-widget-title-button"
                          aria-label={`Open ${session.name}`}
                          onClick={() => onOpenSession?.(session.id)}
                        >
                          {session.name}
                        </button>
                        <span className="harness-widget-kicker">Linked chat session</span>
                      </div>
                      <span className="harness-widget-badge">{session.isOpen ? 'Open' : 'Session'}</span>
                    </header>
                    <div className="harness-widget-body">
                      <div className="harness-render-block harness-session-summary">
                        <div className="harness-metric-row">
                          <span>{plural(messages.length, 'message')}</span>
                          <span>{plural(assets.length, 'asset')}</span>
                          <span>{session.mode ?? 'agent'}</span>
                        </div>
                        <p className="harness-widget-summary">{latestConversationText(session)}</p>
                        {assets.length ? (
                          <ul className="harness-widget-list" aria-label={`${session.name} assets`}>
                            {assets.slice(0, 4).map((asset) => (
                              <li key={asset.path}>
                                <span>{asset.path}</span>
                                <small>{asset.kind ?? 'asset'}</small>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="harness-widget-empty">No session assets yet</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="harness-widget-resize-handle"
                      aria-label={`Resize ${session.name} widget`}
                      disabled={!onPatchElement}
                      onPointerDown={(event) => startWidgetInteraction('resize', session.id, layout, event)}
                    />
                  </article>
                );
              })}

              {!sessions.length ? (
                <article className="harness-add-widget-card harness-empty-session-widget-card" aria-label="No session widgets">
                  <header className="harness-widget-header">
                    <h3>No session widgets</h3>
                  </header>
                  <div className="harness-add-widget-body">
                    <p className="harness-widget-empty">Create a session widget to add a linked chat session to the canvas.</p>
                    <button type="button" className="primary-button" onClick={onCreateSessionWidget}>
                      <Plus size={13} />
                      <span>New session widget</span>
                    </button>
                  </div>
                </article>
              ) : null}
            </div>
          </div>
          <div
            ref={minimapRef}
            className="harness-dashboard-minimap"
            aria-label="Canvas minimap"
            onPointerDown={startMinimapInteraction}
          >
            <div className="harness-dashboard-minimap-grid">
              {sessions.map((session) => {
                const layout = sessionLayouts[session.id];
                if (!layout) return null;
                return (
                  <span
                    key={session.id}
                    className="harness-dashboard-minimap-region"
                    style={minimapRectStyle(layout, minimapBounds)}
                    title={session.name}
                  />
                );
              })}
            </div>
          </div>
        </div>
        {inspectorOpen && onPatchElement && onRegenerate && onRestoreDefault ? (
          <HarnessInspectorPanel
            spec={spec}
            onPatchElement={onPatchElement}
            onRegenerate={onRegenerate}
            onRestoreDefault={onRestoreDefault}
          />
        ) : null}
      </div>
    </section>
  );
}
