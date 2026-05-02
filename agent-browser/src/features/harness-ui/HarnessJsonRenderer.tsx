import type { ReactNode } from 'react';
import type { HarnessAppSpec, HarnessElement } from './types';

export type HarnessSessionSummary = {
  id: string;
  name: string;
};

export type HarnessBrowserPageSummary = {
  id: string;
  title: string;
  url?: string;
};

export type HarnessFileSummary = {
  path: string;
  kind?: string;
};

export type HarnessRenderContext = {
  workspaceName: string;
  sessions: HarnessSessionSummary[];
  browserPages: HarnessBrowserPageSummary[];
  files: HarnessFileSummary[];
};

export type HarnessJsonRendererProps = {
  spec: HarnessAppSpec;
  rootId: string;
  context: HarnessRenderContext;
};

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function renderList<T>(items: T[], emptyLabel: string, renderItem: (item: T) => ReactNode) {
  if (!items.length) {
    return <p className="harness-widget-empty">{emptyLabel}</p>;
  }
  return <ul className="harness-widget-list">{items.map(renderItem)}</ul>;
}

function readStringProp(element: HarnessElement, propName: string, fallback = '') {
  const value = element.props?.[propName];
  return typeof value === 'string' ? value : fallback;
}

function renderElement(element: HarnessElement, context: HarnessRenderContext, children: ReactNode) {
  switch (element.type) {
    case 'WorkspaceSummary':
      return (
        <div className="harness-render-block">
          <p className="harness-widget-kicker">{context.workspaceName}</p>
          <div className="harness-metric-row">
            <span>{plural(context.sessions.length, 'session')}</span>
            <span>{plural(context.browserPages.length, 'page')}</span>
            <span>{plural(context.files.length, 'file')}</span>
          </div>
        </div>
      );
    case 'SessionList':
      return renderList(
        context.sessions,
        readStringProp(element, 'emptyLabel', 'No sessions open'),
        (session) => <li key={session.id}>Session: {session.name}</li>,
      );
    case 'BrowserPageList':
      return renderList(
        context.browserPages,
        readStringProp(element, 'emptyLabel', 'No pages open'),
        (page) => (
          <li key={page.id}>
            <span>Page: {page.title}</span>
            {page.url ? <small>{page.url}</small> : null}
          </li>
        ),
      );
    case 'FileList':
      return renderList(
        context.files,
        readStringProp(element, 'emptyLabel', 'No files yet'),
        (file) => (
          <li key={file.path}>
            <span>File: {file.path}</span>
            {file.kind ? <small>{file.kind}</small> : null}
          </li>
        ),
      );
    case 'HarnessInspector':
      return (
        <div className="harness-render-block">
          <p className="harness-widget-kicker">Spec revision {context.workspaceName}</p>
          <div className="harness-metric-row">
            <span>Editable shell</span>
            <span>Catalog guarded</span>
          </div>
        </div>
      );
    case 'Stack':
    case 'HarnessShell':
    case 'DashboardCanvas':
    case 'ActivityRail':
    case 'WorkspaceSidebar':
    case 'AssistantDock':
      return <div className="harness-render-block">{children}</div>;
    default:
      return (
        <pre className="harness-render-fallback">
          {JSON.stringify({ type: element.type, props: element.props ?? {} }, null, 2)}
        </pre>
      );
  }
}

function renderById(spec: HarnessAppSpec, elementId: string, context: HarnessRenderContext): ReactNode {
  const element = spec.elements[elementId];
  if (!element) {
    return <p className="harness-widget-empty">Missing element: {elementId}</p>;
  }
  const children = (element.children ?? []).map((childId) => (
    <HarnessJsonRenderer key={childId} spec={spec} rootId={childId} context={context} />
  ));
  return renderElement(element, context, children);
}

export function HarnessJsonRenderer({ spec, rootId, context }: HarnessJsonRendererProps) {
  return (
    <div className="harness-widget-rendered" data-harness-element-id={rootId}>
      {renderById(spec, rootId, context)}
    </div>
  );
}
