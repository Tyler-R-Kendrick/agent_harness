import { useEffect, useMemo, useState, type CSSProperties, type HTMLAttributes } from 'react';

import { WidgetDocumentRenderer } from './WidgetDocumentRenderer';
import {
  listDefaultWidgetComponents,
  parseWidgetDocumentJson,
  readWidgetDocument,
  type WidgetDocument,
  type WidgetNode,
} from './widgetComponents';
import type { HarnessAppSpec, HarnessElementPatch, JsonValue } from './types';
import type { HarnessFileSummary } from './HarnessJsonRenderer';
import { RenderPaneTitlebar } from '../render-panes/RenderPaneTitlebar';

export type HarnessWidgetEditorPanelProps = {
  spec: HarnessAppSpec;
  widgetId: string;
  workspaceName: string;
  files: HarnessFileSummary[];
  artifactCount: number;
  symphonyActive: boolean;
  onPatchElement: (patch: HarnessElementPatch) => void;
  onOpenAssistant?: () => void;
  onClose: () => void;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
};

function readTitle(spec: HarnessAppSpec, widgetId: string): string {
  const title = spec.elements[widgetId]?.props?.title;
  return typeof title === 'string' && title.trim() ? title.trim() : widgetId;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function parseJsonObject(value: string): { data: unknown; error: string | null } {
  try {
    return { data: JSON.parse(value) as unknown, error: null };
  } catch {
    return { data: null, error: 'Sample data must be valid JSON' };
  }
}

function readChangeHistory(value: unknown): Array<Record<string, JsonValue>> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, JsonValue> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    .slice(-6);
}

function buildSampleData(title: string): Record<string, JsonValue> {
  return {
    summary: `${title} is ready for live preview.`,
    status: 'Draft',
    detail: 'Design tokens attached',
    metric: '3 components',
    owner: 'Agent Browser',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildStructureRows(node: WidgetNode, depth = 0): Array<{ key: string; type: string; depth: number }> {
  const rows = [{ key: `${node.type}-${depth}-${JSON.stringify(node).length}`, type: node.type, depth }];
  return [
    ...rows,
    ...(node.children ?? []).flatMap((child) => buildStructureRows(child, depth + 1)),
  ];
}

function readPrimaryProps(node: WidgetDocument): string[] {
  return Object.keys(node).filter((key) => key !== 'children').slice(0, 8);
}

export function HarnessWidgetEditorPanel({
  spec,
  widgetId,
  workspaceName,
  files,
  artifactCount,
  symphonyActive,
  onPatchElement,
  onOpenAssistant,
  onClose,
  dragHandleProps,
}: HarnessWidgetEditorPanelProps) {
  const widget = spec.elements[widgetId] ?? null;
  const title = readTitle(spec, widgetId);
  const initialDocument = useMemo(() => readWidgetDocument(widget?.props?.widgetJson, title), [title, widget?.props?.widgetJson]);
  const initialSampleData = useMemo(() => (
    isRecord(widget?.props?.widgetSampleData) ? widget?.props?.widgetSampleData : buildSampleData(title)
  ), [title, widget?.props?.widgetSampleData]);
  const [widgetJsonDraft, setWidgetJsonDraft] = useState(() => formatJson(initialDocument));
  const [sampleDataDraft, setSampleDataDraft] = useState(() => formatJson(initialSampleData));
  const [lastValidDocument, setLastValidDocument] = useState<WidgetDocument>(initialDocument);
  const [lastValidSampleData, setLastValidSampleData] = useState<unknown>(initialSampleData);
  const components = useMemo(() => listDefaultWidgetComponents(), []);
  const designFile = files.find((file) => /(^|\/)design\.md$/i.test(file.path));
  const changeHistory = readChangeHistory(widget?.props?.changeHistory);

  useEffect(() => {
    setWidgetJsonDraft(formatJson(initialDocument));
    setLastValidDocument(initialDocument);
  }, [initialDocument]);

  const parsedWidget = useMemo(() => {
    try {
      return { document: parseWidgetDocumentJson(widgetJsonDraft), error: null as string | null };
    } catch {
      return { document: null, error: 'Widget JSON must be valid JSON' };
    }
  }, [widgetJsonDraft]);
  const parsedSample = useMemo(() => parseJsonObject(sampleDataDraft), [sampleDataDraft]);

  useEffect(() => {
    if (parsedWidget.document) setLastValidDocument(parsedWidget.document);
  }, [parsedWidget.document]);

  useEffect(() => {
    if (!parsedSample.error) setLastValidSampleData(parsedSample.data);
  }, [parsedSample.data, parsedSample.error]);

  if (!widget) {
    return (
      <section className="harness-widget-editor-panel" aria-label="Widget editor">
        <RenderPaneTitlebar
          className="harness-widget-editor-topbar"
          closeLabel="Close widget editor"
          dragHandleProps={dragHandleProps}
          eyebrow={<span className="panel-resource-eyebrow">workspace/{workspaceName}/widget</span>}
          onClose={onClose}
          title={<h2>{widgetId}</h2>}
        />
        <p className="harness-widget-empty">Missing widget: {widgetId}</p>
      </section>
    );
  }

  const saveDisabled = Boolean(parsedWidget.error || parsedSample.error || !parsedWidget.document);
  const status = parsedWidget.error ?? parsedSample.error ?? 'Live preview ready';
  const structureRows = buildStructureRows(lastValidDocument);
  const primaryProps = readPrimaryProps(lastValidDocument);

  const saveWidgetJson = () => {
    const nextHistory: Array<Record<string, JsonValue>> = [
      ...changeHistory,
      {
        id: `${widget.id}:${Date.now()}`,
        source: 'widget-editor',
        summary: 'Updated widget JSON',
        revision: spec.metadata.revision + 1,
      },
    ].slice(-8);
    onPatchElement({
      elementId: widget.id,
      props: {
        widgetJson: parsedWidget.document as unknown as JsonValue,
        widgetSampleData: parsedSample.data as JsonValue,
        changeHistory: nextHistory as unknown as JsonValue,
      },
    });
  };

  return (
    <section className="harness-widget-editor-panel" aria-label="Widget editor">
      <RenderPaneTitlebar
        className="harness-widget-editor-topbar"
        closeLabel="Close widget editor"
        dragHandleProps={dragHandleProps}
        eyebrow={<span className="panel-resource-eyebrow">workspace/{workspaceName}/widget</span>}
        onClose={onClose}
        title={<h2>{title}</h2>}
        actions={(
          <>
          {onOpenAssistant ? (
            <button type="button" className="secondary-button" onClick={onOpenAssistant} aria-label="Open widget assistant">
              Agent
            </button>
          ) : null}
          <button type="button" className="primary-button" onClick={saveDisabled ? undefined : saveWidgetJson} disabled={saveDisabled}>
            Save widget JSON
          </button>
          </>
        )}
      />

      <div className="harness-widget-editor-grid">
        <aside className="harness-widget-component-rail" aria-label="Widget components">
          <h3>Components</h3>
          <div>
            {components.map((component) => (
              <button key={component.type} type="button" aria-label={`${component.type} component`}>
                <strong>{component.label}</strong>
                <span>{component.category}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="harness-widget-code-stack" aria-label="Widget source editors">
          <label>
            <span>Widget JSON</span>
            <textarea
              aria-label="Widget JSON"
              spellCheck={false}
              value={widgetJsonDraft}
              onChange={(event) => setWidgetJsonDraft(event.target.value)}
            />
          </label>
          <label>
            <span>Sample data</span>
            <textarea
              aria-label="Sample data"
              spellCheck={false}
              value={sampleDataDraft}
              onChange={(event) => setSampleDataDraft(event.target.value)}
            />
          </label>
        </section>

        <section className="harness-widget-preview-column" aria-label="Live widget preview">
          <div className={`harness-widget-editor-status${saveDisabled ? ' is-invalid' : ''}`} role="status">
            {status}
          </div>
          <div className="harness-widget-preview-stage">
            <WidgetDocumentRenderer document={lastValidDocument} sampleData={lastValidSampleData} />
          </div>
        </section>

        <aside className="harness-widget-editor-inspector">
          <section aria-label="Design system context">
            <h3>Design system</h3>
            <dl>
              <div>
                <dt>Project</dt>
                <dd>{spec.metadata.designSystemId}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{designFile?.path ?? 'No DESIGN.md'}</dd>
              </div>
              <div>
                <dt>Artifacts</dt>
                <dd>{artifactCount} {artifactCount === 1 ? 'artifact' : 'artifacts'}</dd>
              </div>
              <div>
                <dt>Orchestration</dt>
                <dd>{symphonyActive ? 'Symphony active' : 'Symphony idle'}</dd>
              </div>
            </dl>
          </section>

          <section aria-label="Widget structure">
            <h3>Structure</h3>
            <ul>
              {structureRows.map((row, index) => (
                <li key={`${row.key}-${index}`} style={{ '--widget-node-depth': row.depth } as CSSProperties}>
                  {row.type}
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Element properties">
            <h3>Properties</h3>
            <ul>
              {primaryProps.map((prop) => <li key={prop}>{prop}</li>)}
            </ul>
          </section>

          <section aria-label="Widget change history">
            <h3>History</h3>
            {changeHistory.length ? (
              <ul>
                {changeHistory.map((entry, index) => <li key={`${String(entry.id ?? index)}`}>{String(entry.summary ?? 'Widget update')}</li>)}
              </ul>
            ) : (
              <p>No widget edits yet.</p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
