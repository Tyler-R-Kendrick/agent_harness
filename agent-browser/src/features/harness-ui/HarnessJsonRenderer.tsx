import type { CSSProperties, ReactNode } from 'react';
import type { HarnessAppSpec, HarnessElement, SessionWidgetAsset, SessionWidgetMessage } from './types';

export type HarnessSessionSummary = {
  id: string;
  name: string;
  isOpen?: boolean;
  messages?: SessionWidgetMessage[];
  assets?: SessionWidgetAsset[];
  mode?: 'agent' | 'terminal';
  provider?: string | null;
  modelId?: string | null;
  agentId?: string | null;
  toolIds?: readonly string[];
  cwd?: string | null;
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

export type HarnessKnowledgeMetric = {
  label: string;
  value: number;
  detail?: string;
};

export type HarnessKnowledgeSummary = {
  metrics: HarnessKnowledgeMetric[];
  highlights: string[];
};

export type HarnessRenderContext = {
  workspaceName: string;
  sessions: HarnessSessionSummary[];
  browserPages: HarnessBrowserPageSummary[];
  files: HarnessFileSummary[];
  knowledge: HarnessKnowledgeSummary;
};

export type HarnessJsonRendererProps = {
  spec: HarnessAppSpec;
  rootId: string;
  context: HarnessRenderContext;
};

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function renderList<T>(items: T[], emptyLabel: string, renderItem: (item: T, index: number) => ReactNode) {
  if (!items.length) {
    return <p className="harness-widget-empty">{emptyLabel}</p>;
  }
  return <ul className="harness-widget-list">{items.map(renderItem)}</ul>;
}

function readStringProp(element: HarnessElement, propName: string, fallback = '') {
  const value = element.props?.[propName];
  return typeof value === 'string' ? value : fallback;
}

function resolveWidgetSession(element: HarnessElement, context: HarnessRenderContext): HarnessSessionSummary | null {
  const requestedSessionId = readStringProp(element, 'sessionId', 'active');
  if (requestedSessionId && requestedSessionId !== 'active') {
    const requestedSession = context.sessions.find((session) => session.id === requestedSessionId);
    if (requestedSession) return requestedSession;
  }
  return context.sessions.find((session) => session.isOpen) ?? context.sessions[0] ?? null;
}

function conversationMessages(session: HarnessSessionSummary): SessionWidgetMessage[] {
  return (session.messages ?? []).filter((message) => message.role !== 'system' && message.content.trim());
}

function roleLabel(role: SessionWidgetMessage['role']) {
  if (role === 'assistant') return 'Assistant';
  if (role === 'user') return 'User';
  return 'System';
}

function buildDefaultConversationSummary(session: HarnessSessionSummary): string {
  const messages = conversationMessages(session);
  const latest = messages.at(-1);
  if (!latest) return 'No conversation yet.';
  const roles = [...new Set(messages.map((message) => roleLabel(message.role).toLowerCase()))].join(' and ');
  return `${plural(messages.length, 'conversation message')} across ${roles}. Last turn: ${roleLabel(latest.role).toLowerCase()}.`;
}

function renderSessionMissing() {
  return <p className="harness-widget-empty">No session selected</p>;
}

function renderSessionMessageList(session: HarnessSessionSummary, emptyLabel: string, limit = 4) {
  const messages = conversationMessages(session).slice(-limit);
  return renderList(
    messages,
    emptyLabel,
    (message, index) => <li key={`${message.role}-${index}`}>{roleLabel(message.role)} message {index + 1}</li>,
  );
}

function renderConversationSummary(element: HarnessElement, context: HarnessRenderContext) {
  const session = resolveWidgetSession(element, context);
  if (!session) return renderSessionMissing();
  const messages = conversationMessages(session);
  const assets = session.assets ?? [];
  const summaryLabel = readStringProp(element, 'summary', 'Default summary');
  return (
    <div className="harness-render-block harness-session-summary">
      <p className="harness-widget-kicker">Session: {session.name}</p>
      <div className="harness-metric-row">
        <span>{plural(messages.length, 'message')}</span>
        <span>{session.isOpen ? 'Open' : 'Stored'}</span>
        <span>{plural(assets.length, 'asset')}</span>
      </div>
      <p className="harness-widget-summary">{summaryLabel}: {buildDefaultConversationSummary(session)}</p>
      {renderSessionMessageList(session, 'No conversation yet', 2)}
    </div>
  );
}

function renderSessionAssets(element: HarnessElement, context: HarnessRenderContext) {
  const session = resolveWidgetSession(element, context);
  if (!session) return renderSessionMissing();
  return (
    <div className="harness-render-block harness-session-assets">
      <p className="harness-widget-kicker">Session: {session.name}</p>
      {renderList(
        session.assets ?? [],
        readStringProp(element, 'emptyLabel', 'No session assets yet'),
        (asset) => (
          <li key={asset.path}>
            <span>{asset.path}</span>
            <small>{asset.isRoot ? 'drive root' : asset.kind ?? 'asset'}</small>
          </li>
        ),
      )}
    </div>
  );
}

function renderSessionActivity(element: HarnessElement, context: HarnessRenderContext) {
  const session = resolveWidgetSession(element, context);
  if (!session) return renderSessionMissing();
  return (
    <div className="harness-render-block harness-session-activity">
      <p className="harness-widget-kicker">Session: {session.name}</p>
      {renderSessionMessageList(session, readStringProp(element, 'emptyLabel', 'No chat history yet'))}
    </div>
  );
}

function renderSessionRuntime(context: HarnessRenderContext, element: HarnessElement) {
  const session = resolveWidgetSession(element, context);
  if (!session) return renderSessionMissing();
  const toolCount = session.toolIds?.length ?? 0;
  return (
    <div className="harness-render-block">
      <p className="harness-widget-kicker">Session: {session.name}</p>
      <div className="harness-metric-row">
        <span>{session.mode ?? 'agent'}</span>
        <span>{plural(toolCount, 'tool')}</span>
        <span>{session.provider ?? 'local'}</span>
      </div>
      <p className="harness-widget-summary">{session.cwd ?? 'No session cwd recorded'}</p>
    </div>
  );
}

function renderKnowledgeGraphWidget(context: HarnessRenderContext, element: HarnessElement) {
  const metrics = context.knowledge.metrics;
  const maxValue = Math.max(1, ...metrics.map((metric) => metric.value));
  return (
    <div className="harness-render-block harness-knowledge-widget">
      <p className="harness-widget-kicker">{readStringProp(element, 'summary', 'Aggregated workspace knowledge')}</p>
      <div className="harness-knowledge-metrics" aria-label="Knowledge metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className="harness-knowledge-metric">
            <div>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
            <span
              className="harness-knowledge-bar"
              style={{ '--harness-knowledge-score': String(metric.value / maxValue) } as CSSProperties}
              aria-hidden="true"
            />
            {metric.detail ? <small>{metric.detail}</small> : null}
          </div>
        ))}
      </div>
      {renderList(
        context.knowledge.highlights,
        'No collected knowledge yet',
        (highlight) => <li key={highlight}>{highlight}</li>,
      )}
    </div>
  );
}

function renderElement(element: HarnessElement, context: HarnessRenderContext, children: ReactNode) {
  switch (element.type) {
    case 'WorkspaceSummary':
    case 'SessionConversationSummary':
      return renderConversationSummary(element, context);
    case 'SessionList':
    case 'SessionActivity':
      return renderSessionActivity(element, context);
    case 'BrowserPageList':
    case 'FileList':
    case 'SessionStorageAssets':
      return renderSessionAssets(element, context);
    case 'SessionRuntime':
      return renderSessionRuntime(context, element);
    case 'KnowledgeGraphWidget':
      return renderKnowledgeGraphWidget(context, element);
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
