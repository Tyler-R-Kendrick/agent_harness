import { useMemo, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize2, Minimize2, Minus, Plus } from 'lucide-react';
import { HarnessJsonRenderer, type HarnessBrowserPageSummary, type HarnessFileSummary, type HarnessSessionSummary } from './HarnessJsonRenderer';
import { HarnessInspectorPanel } from './HarnessInspectorPanel';
import { normalizeWidgetPosition, normalizeWidgetSize, resolveSpaceLayout } from './spaceLayout';
import type { HarnessAppSpec, HarnessElement, HarnessElementPatch, JsonValue, WidgetPosition, WidgetSize } from './types';

export type HarnessDashboardPanelProps = {
  spec: HarnessAppSpec;
  workspaceName: string;
  sessions: HarnessSessionSummary[];
  browserPages: HarnessBrowserPageSummary[];
  files: HarnessFileSummary[];
  onAddWidget: (prompt: string) => void;
  onPatchElement?: (patch: HarnessElementPatch) => void;
  onRegenerate?: (prompt: string) => void;
  onRestoreDefault?: () => void;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
};

const DEFAULT_WIDGET_SIZES: Record<string, WidgetSize> = {
  'conversation-summary-widget': { cols: 5, rows: 3 },
  'session-storage-widget': { cols: 4, rows: 3 },
  'session-activity-widget': { cols: 5, rows: 3 },
  'runtime-context-widget': { cols: 4, rows: 2 },
  'workspace-summary-widget': { cols: 5, rows: 2 },
  'session-list-widget': { cols: 4, rows: 3 },
  'browser-pages-widget': { cols: 5, rows: 3 },
  'files-widget': { cols: 4, rows: 3 },
  'harness-inspector-widget': { cols: 4, rows: 3 },
};

const PROMPT_SUGGESTIONS = [
  'Create conversation summary',
  'Show session storage assets',
  'Show session runtime',
];

function readDashboardElement(spec: HarnessAppSpec) {
  return Object.values(spec.elements).find((element) => element.type === 'DashboardCanvas') ?? spec.elements[spec.root];
}

function readTitle(spec: HarnessAppSpec, elementId: string, fallback: string) {
  const title = spec.elements[elementId]?.props?.title;
  return typeof title === 'string' && title.trim() ? title.trim() : fallback;
}

function readStringProp(element: HarnessElement | undefined, propName: string, fallback = '') {
  const value = element?.props?.[propName];
  return typeof value === 'string' ? value : fallback;
}

function readBooleanProp(element: HarnessElement | undefined, propName: string, fallback = false) {
  const value = element?.props?.[propName];
  return typeof value === 'boolean' ? value : fallback;
}

function defaultWidgetSize(widgetId: string) {
  return DEFAULT_WIDGET_SIZES[widgetId] ?? { cols: 4, rows: 3 };
}

function widgetStyle(position: WidgetPosition, size: WidgetSize) {
  return {
    '--harness-widget-col': String(position.col),
    '--harness-widget-row': String(position.row),
    '--harness-widget-cols': String(size.cols),
    '--harness-widget-rows': String(size.rows),
  } as CSSProperties;
}

function resolveWidgetSessionId(element: HarnessElement | undefined, sessions: HarnessSessionSummary[]) {
  const requestedSessionId = readStringProp(element, 'sessionId', 'active');
  if (requestedSessionId && requestedSessionId !== 'active' && sessions.some((session) => session.id === requestedSessionId)) {
    return requestedSessionId;
  }
  return sessions.find((session) => session.isOpen)?.id ?? sessions[0]?.id ?? '';
}

function patchWidget(onPatchElement: HarnessDashboardPanelProps['onPatchElement'], elementId: string, props: Record<string, JsonValue>) {
  onPatchElement?.({ elementId, props });
}

function IconButton({ children, disabled, label, onClick }: { children: ReactNode; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="harness-widget-tool-button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function HarnessDashboardPanel({
  spec,
  workspaceName,
  sessions,
  browserPages,
  files,
  onAddWidget,
  onPatchElement,
  onRegenerate,
  onRestoreDefault,
  dragHandleProps,
}: HarnessDashboardPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const dashboard = readDashboardElement(spec);
  const widgetIds = dashboard.children ?? [];
  const widgetLayoutInput = useMemo(() => {
    const widgetPositions: Record<string, unknown> = {};
    const widgetSizes: Record<string, unknown> = {};
    const minimizedWidgetIds: string[] = [];
    for (const widgetId of widgetIds) {
      const element = spec.elements[widgetId];
      widgetPositions[widgetId] = element?.props?.position;
      widgetSizes[widgetId] = element?.props?.size ?? defaultWidgetSize(widgetId);
      if (readBooleanProp(element, 'minimized')) minimizedWidgetIds.push(widgetId);
    }
    return { minimizedWidgetIds, widgetIds, widgetPositions, widgetSizes };
  }, [spec, widgetIds]);
  const layout = useMemo(() => resolveSpaceLayout(widgetLayoutInput), [widgetLayoutInput]);
  const context = useMemo(() => ({
    workspaceName,
    sessions,
    browserPages,
    files,
  }), [browserPages, files, sessions, workspaceName]);

  const handleSubmit = () => {
    const normalized = prompt.trim();
    if (!normalized) return;
    onAddWidget(normalized);
  };
  const canCustomize = Boolean(onPatchElement && onRegenerate && onRestoreDefault);

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
          <button type="button" className="secondary-button">Add Widget</button>
        </div>
      </div>

      <div className="harness-dashboard-workbench">
        <div className="harness-dashboard-canvas">
          <div className="harness-dashboard-grid" aria-label="Editable harness widgets">
            {widgetIds.map((widgetId) => {
              const title = readTitle(spec, widgetId, widgetId);
              const element = spec.elements[widgetId];
              const size = layout.renderedSizes[widgetId] ?? normalizeWidgetSize(element?.props?.size, defaultWidgetSize(widgetId));
              const position = layout.positions[widgetId] ?? { col: 0, row: 0 };
              const storedPosition = normalizeWidgetPosition(element?.props?.position, position);
              const storedSize = normalizeWidgetSize(element?.props?.size, defaultWidgetSize(widgetId));
              const minimized = layout.minimizedMap[widgetId] ?? readBooleanProp(element, 'minimized');
              const selectedSessionId = resolveWidgetSessionId(element, sessions);
              const controlsDisabled = !onPatchElement;
              return (
                <article
                  key={widgetId}
                  className="harness-widget-card"
                  aria-label={`${title} widget`}
                  style={widgetStyle(position, size)}
                >
                  <header className="harness-widget-header">
                    <div className="harness-widget-title-group">
                      <h3>{title}</h3>
                      <select
                        aria-label={`Session for ${title} widget`}
                        className="harness-widget-session-select"
                        value={selectedSessionId}
                        disabled={!sessions.length || controlsDisabled}
                        onChange={(event) => patchWidget(onPatchElement, widgetId, { sessionId: event.target.value })}
                      >
                        {sessions.length ? sessions.map((session) => (
                          <option key={session.id} value={session.id}>Widget session: {session.name}</option>
                        )) : <option value="">No session</option>}
                      </select>
                    </div>
                    <div className="harness-widget-controls" aria-label={`${title} widget controls`}>
                      <IconButton disabled={controlsDisabled} label={`Move ${title} widget left`} onClick={() => patchWidget(onPatchElement, widgetId, { position: { col: storedPosition.col - 1, row: storedPosition.row } })}>
                        <ArrowLeft size={13} />
                      </IconButton>
                      <IconButton disabled={controlsDisabled} label={`Move ${title} widget right`} onClick={() => patchWidget(onPatchElement, widgetId, { position: { col: storedPosition.col + 1, row: storedPosition.row } })}>
                        <ArrowRight size={13} />
                      </IconButton>
                      <IconButton disabled={controlsDisabled} label={`Move ${title} widget up`} onClick={() => patchWidget(onPatchElement, widgetId, { position: { col: storedPosition.col, row: storedPosition.row - 1 } })}>
                        <ArrowUp size={13} />
                      </IconButton>
                      <IconButton disabled={controlsDisabled} label={`Move ${title} widget down`} onClick={() => patchWidget(onPatchElement, widgetId, { position: { col: storedPosition.col, row: storedPosition.row + 1 } })}>
                        <ArrowDown size={13} />
                      </IconButton>
                      <IconButton disabled={controlsDisabled} label={`Shrink ${title} widget`} onClick={() => patchWidget(onPatchElement, widgetId, { size: { cols: Math.max(2, storedSize.cols - 1), rows: storedSize.rows } })}>
                        <Minus size={13} />
                      </IconButton>
                      <IconButton disabled={controlsDisabled} label={`Grow ${title} widget`} onClick={() => patchWidget(onPatchElement, widgetId, { size: { cols: storedSize.cols + 1, rows: storedSize.rows } })}>
                        <Plus size={13} />
                      </IconButton>
                      <IconButton disabled={controlsDisabled} label={`${minimized ? 'Restore' : 'Minimize'} ${title} widget`} onClick={() => patchWidget(onPatchElement, widgetId, { minimized: !minimized })}>
                        {minimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                      </IconButton>
                    </div>
                  </header>
                  <div className={`harness-widget-body${minimized ? ' harness-widget-body--minimized' : ''}`}>
                    <HarnessJsonRenderer spec={spec} rootId={widgetId} context={context} />
                  </div>
                </article>
              );
            })}

            <article className="harness-add-widget-card" aria-label="New widget">
              <header className="harness-widget-header">
                <h3>New Widget</h3>
              </header>
              <div className="harness-add-widget-body">
                <div className="harness-suggestion-row" aria-label="Widget prompt suggestions">
                  {PROMPT_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="secondary-button harness-suggestion-button"
                      onClick={() => setPrompt(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <div className="harness-add-widget-form">
                  <label className="sr-only" htmlFor="harness-widget-prompt">Describe widget</label>
                  <input
                    id="harness-widget-prompt"
                    aria-label="Describe widget"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Describe this widget..."
                  />
                  <button type="button" className="primary-button" onClick={handleSubmit}>Go</button>
                </div>
              </div>
            </article>
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
