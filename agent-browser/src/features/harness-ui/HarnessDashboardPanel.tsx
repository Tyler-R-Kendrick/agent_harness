import { useMemo, useState, type CSSProperties, type HTMLAttributes } from 'react';
import { HarnessJsonRenderer, type HarnessBrowserPageSummary, type HarnessFileSummary, type HarnessSessionSummary } from './HarnessJsonRenderer';
import { HarnessInspectorPanel } from './HarnessInspectorPanel';
import { buildCenteredFirstFitLayout } from './spaceLayout';
import type { HarnessAppSpec, HarnessElementPatch, WidgetPosition, WidgetSize } from './types';

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
  'workspace-summary-widget': { cols: 5, rows: 2 },
  'session-list-widget': { cols: 4, rows: 3 },
  'browser-pages-widget': { cols: 5, rows: 3 },
  'files-widget': { cols: 4, rows: 3 },
  'harness-inspector-widget': { cols: 4, rows: 3 },
};

const PROMPT_SUGGESTIONS = [
  'Create session overview',
  'Show active browser pages',
  'Summarize workspace files',
];

function readDashboardElement(spec: HarnessAppSpec) {
  return Object.values(spec.elements).find((element) => element.type === 'DashboardCanvas') ?? spec.elements[spec.root];
}

function readTitle(spec: HarnessAppSpec, elementId: string, fallback: string) {
  const title = spec.elements[elementId]?.props?.title;
  return typeof title === 'string' && title.trim() ? title.trim() : fallback;
}

function widgetStyle(position: WidgetPosition, size: WidgetSize) {
  return {
    '--harness-widget-col': String(position.col),
    '--harness-widget-row': String(position.row),
    '--harness-widget-cols': String(size.cols),
    '--harness-widget-rows': String(size.rows),
  } as CSSProperties;
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
  const layout = useMemo(() => buildCenteredFirstFitLayout({
    viewportCols: 14,
    widgetIds,
    widgetSizes: DEFAULT_WIDGET_SIZES,
  }), [widgetIds]);
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
              const size = DEFAULT_WIDGET_SIZES[widgetId] ?? { cols: 4, rows: 3 };
              const position = layout.positions[widgetId] ?? { col: 0, row: 0 };
              return (
                <article
                  key={widgetId}
                  className="harness-widget-card"
                  aria-label={`${title} widget`}
                  style={widgetStyle(position, size)}
                >
                  <header className="harness-widget-header">
                    <h3>{title}</h3>
                    <span className="harness-widget-badge">editable</span>
                  </header>
                  <div className="harness-widget-body">
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
