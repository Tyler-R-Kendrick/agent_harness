import type {
  EditableHarnessElement,
  HarnessAppSpec,
  HarnessElement,
  HarnessElementPatch,
  HarnessElementSlot,
  JsonValue,
  WidgetPosition,
  WidgetSize,
} from './types';
import { assertHarnessElementAllowedByCatalog } from './harnessCatalog';

const DEFAULT_SLOT: HarnessElementSlot = 'app';

type CreateDefaultHarnessAppSpecInput = {
  workspaceId: string;
  workspaceName: string;
};

function element(
  id: string,
  type: string,
  props: Record<string, JsonValue>,
  options: {
    children?: string[];
    slot?: HarnessElementSlot;
    editable?: boolean;
  } = {},
): HarnessElement {
  return {
    id,
    type,
    props,
    editable: options.editable ?? true,
    ...(options.children ? { children: options.children } : {}),
    ...(options.slot ? { slot: options.slot } : {}),
  };
}

function dashboardWidgetProps(
  title: string,
  position: WidgetPosition,
  size: WidgetSize,
  extra: Record<string, JsonValue> = {},
) {
  return {
    title,
    sessionId: 'active',
    position,
    size,
    ...extra,
  };
}

function withRevision(spec: HarnessAppSpec, revision = spec.metadata.revision + 1): HarnessAppSpec {
  return {
    ...spec,
    metadata: {
      ...spec.metadata,
      designSystemId: 'agent-browser/current',
      revision,
    },
  };
}

function validateCatalogElements(spec: HarnessAppSpec): HarnessAppSpec {
  for (const entry of Object.values(spec.elements)) {
    assertHarnessElementAllowedByCatalog(entry);
  }
  return spec;
}

export function createDefaultHarnessAppSpec({
  workspaceId,
  workspaceName,
}: CreateDefaultHarnessAppSpecInput): HarnessAppSpec {
  const title = workspaceName.trim() || 'Workspace';
  return validateCatalogElements({
    version: 'harness-ui/v1',
    root: 'app-shell',
    metadata: {
      workspaceId,
      workspaceName: title,
      createdBy: 'agent-browser',
      designSystemId: 'agent-browser/current',
      revision: 1,
    },
    elements: {
      'app-shell': element(
        'app-shell',
        'HarnessShell',
        { title },
        {
          slot: 'app',
          children: [
            'activity-rail',
            'app-topbar',
            'workspace-sidebar',
            'render-pane-viewport',
            'assistant-dock',
            'toast-host',
            'modal-host',
            'context-menu-host',
          ],
        },
      ),
      'activity-rail': element('activity-rail', 'ActivityRail', { title: 'Navigation' }, { slot: 'app.rail' }),
      'app-topbar': element('app-topbar', 'Omnibar', {
        title: 'Command bar',
        placeholder: 'Search or enter URL',
      }, { slot: 'app.omnibar' }),
      'workspace-sidebar': element(
        'workspace-sidebar',
        'WorkspaceSidebar',
        { title: 'Workspace tree', density: 'comfortable' },
        {
          slot: 'app.sidebar',
          children: ['dashboard-tree-section', 'browser-tree-section', 'session-tree-section', 'files-tree-section', 'clipboard-tree-section'],
        },
      ),
      'dashboard-tree-section': element(
        'dashboard-tree-section',
        'DashboardTreeSection',
        { title: 'Dashboard', emptyLabel: 'No widgets yet' },
        { slot: 'app.sidebar.dashboard' },
      ),
      'browser-tree-section': element(
        'browser-tree-section',
        'BrowserTreeSection',
        { title: 'Browser pages', emptyLabel: 'No pages open' },
        { slot: 'app.sidebar.browser' },
      ),
      'session-tree-section': element(
        'session-tree-section',
        'SessionTreeSection',
        { title: 'Sessions', emptyLabel: 'No sessions open' },
        { slot: 'app.sidebar.sessions' },
      ),
      'files-tree-section': element(
        'files-tree-section',
        'FilesTreeSection',
        { title: 'Files', emptyLabel: 'No files yet' },
        { slot: 'app.sidebar.files' },
      ),
      'clipboard-tree-section': element(
        'clipboard-tree-section',
        'ClipboardTreeSection',
        { title: 'Clipboard', emptyLabel: 'Clipboard is empty' },
        { slot: 'app.sidebar.clipboard' },
      ),
      'render-pane-viewport': element(
        'render-pane-viewport',
        'RenderPaneViewport',
        { title: 'Content panes' },
        {
          slot: 'app.panels',
          children: ['main-dashboard', 'browser-page-panel', 'session-panel', 'terminal-panel', 'file-editor-panel'],
        },
      ),
      'main-dashboard': element(
        'main-dashboard',
        'DashboardCanvas',
        {
          title: `${title} harness`,
          density: 'comfortable',
          addWidgetLabel: 'Create widget',
        },
        {
          slot: 'dashboard.canvas',
          children: ['session-summary-widget', 'knowledge-widget'],
        },
      ),
      'session-summary-widget': element(
        'session-summary-widget',
        'SessionConversationSummary',
        dashboardWidgetProps(
          'Session summary',
          { col: -7, row: -2 },
          { cols: 6, rows: 3 },
          { summary: 'Aggregated session summary' },
        ),
        { slot: 'dashboard.canvas' },
      ),
      'knowledge-widget': element(
        'knowledge-widget',
        'KnowledgeGraphWidget',
        dashboardWidgetProps(
          'Knowledge',
          { col: 0, row: -2 },
          { cols: 7, rows: 4 },
          { summary: 'Memory, knowledge, steering, files, sessions, and surfaces' },
        ),
        { slot: 'dashboard.canvas' },
      ),
      'browser-page-panel': element(
        'browser-page-panel',
        'BrowserPagePanel',
        { title: 'Browser page' },
        { slot: 'app.panels.browser' },
      ),
      'session-panel': element(
        'session-panel',
        'SessionPanel',
        { title: 'Agent session' },
        { slot: 'app.panels.session' },
      ),
      'terminal-panel': element(
        'terminal-panel',
        'TerminalPanel',
        { title: 'Terminal session' },
        { slot: 'app.panels.session' },
      ),
      'file-editor-panel': element(
        'file-editor-panel',
        'FileEditorPanel',
        { title: 'File editor' },
        { slot: 'app.panels.file' },
      ),
      'assistant-dock': element('assistant-dock', 'AssistantDock', { title: 'Assistant' }, { slot: 'app.assistant' }),
      'settings-panel': element('settings-panel', 'SettingsPanel', { title: 'Settings' }, { slot: 'app.settings' }),
      'model-registry-panel': element('model-registry-panel', 'ModelRegistryPanel', { title: 'Models' }, { slot: 'app.settings' }),
      'extensions-panel': element('extensions-panel', 'ExtensionsPanel', { title: 'Extensions' }, { slot: 'app.extensions' }),
      'history-panel': element('history-panel', 'HistoryPanel', { title: 'History' }, { slot: 'app.history' }),
      'account-panel': element('account-panel', 'AccountPanel', { title: 'Account' }, { slot: 'app.account' }),
      'toast-host': element('toast-host', 'ToastHost', { title: 'Notifications' }, { slot: 'app.toast' }),
      'modal-host': element('modal-host', 'ModalHost', { title: 'Dialogs' }, { slot: 'app.overlay' }),
      'context-menu-host': element('context-menu-host', 'ContextMenuHost', { title: 'Context menus' }, { slot: 'app.overlay' }),
    },
  });
}

function readElementTitle(elementEntry: HarnessElement, fallback: string): string {
  const props = elementEntry.props ?? {};
  const title = props.title ?? props.label ?? props.name;
  return typeof title === 'string' && title.trim() ? title.trim() : fallback;
}

function listEditableFromElement(
  spec: HarnessAppSpec,
  elementId: string,
  parentPath = '',
): EditableHarnessElement[] {
  const elementEntry = spec.elements[elementId];
  if (!elementEntry) return [];
  const path = parentPath ? `${parentPath}/${elementEntry.type}` : elementEntry.type;
  const editable = elementEntry.editable !== false;
  const current = editable
    ? [{
      id: elementEntry.id,
      type: elementEntry.type,
      title: readElementTitle(elementEntry, elementEntry.id),
      editable,
      slot: elementEntry.slot ?? DEFAULT_SLOT,
      path,
    }]
    : [];
  return [
    ...current,
    ...(elementEntry.children ?? []).flatMap((childId) => listEditableFromElement(spec, childId, path)),
  ];
}

export function listEditableHarnessElements(spec: HarnessAppSpec): EditableHarnessElement[] {
  return listEditableFromElement(spec, spec.root);
}

export type DashboardWidgetSummary = {
  id: string;
  title: string;
  type: string;
};

export type AddHarnessDashboardWidgetInput = {
  id?: string;
  type?: string;
  title?: string;
  position?: WidgetPosition;
  size?: WidgetSize;
  props?: Record<string, JsonValue>;
};

function nextDashboardWidgetId(spec: HarnessAppSpec): string {
  let index = 1;
  let candidate = `dashboard-widget-${index}`;
  while (spec.elements[candidate]) {
    index += 1;
    candidate = `dashboard-widget-${index}`;
  }
  return candidate;
}

export function listDashboardWidgets(spec: HarnessAppSpec): DashboardWidgetSummary[] {
  const dashboard = Object.values(spec.elements).find((entry) => entry.type === 'DashboardCanvas') ?? spec.elements['main-dashboard'];
  return (dashboard?.children ?? [])
    .map((id) => spec.elements[id])
    .filter((entry): entry is HarnessElement => Boolean(entry))
    .map((entry) => ({
      id: entry.id,
      title: readElementTitle(entry, entry.id),
      type: entry.type,
    }));
}

export function addHarnessDashboardWidget(spec: HarnessAppSpec, input: AddHarnessDashboardWidgetInput = {}): HarnessAppSpec {
  const dashboard = spec.elements['main-dashboard'];
  if (!dashboard) {
    throw new Error('Harness dashboard element "main-dashboard" does not exist.');
  }
  const id = input.id ?? nextDashboardWidgetId(spec);
  if (spec.elements[id]) {
    throw new Error(`Harness element "${id}" already exists.`);
  }
  const widget: HarnessElement = {
    id,
    type: input.type ?? 'SessionConversationSummary',
    slot: 'dashboard.canvas',
    editable: true,
    props: dashboardWidgetProps(
      input.title ?? 'New widget',
      input.position ?? { col: 1, row: 2 },
      input.size ?? { cols: 5, rows: 3 },
      {
        summary: 'Draft widget',
        emptyLabel: 'Nothing to show yet',
        ...(input.props ?? {}),
      },
    ),
  };
  assertHarnessElementAllowedByCatalog(widget);
  assertHarnessElementAllowedByCatalog({
    ...dashboard,
    children: [...(dashboard.children ?? []), id],
  });
  return withRevision({
    ...spec,
    elements: {
      ...spec.elements,
      [id]: widget,
      'main-dashboard': {
        ...dashboard,
        children: [...(dashboard.children ?? []), id],
      },
    },
  });
}

export function applyHarnessElementPatch(spec: HarnessAppSpec, patch: HarnessElementPatch): HarnessAppSpec {
  const current = spec.elements[patch.elementId];
  if (!current) {
    throw new Error(`Harness element "${patch.elementId}" does not exist.`);
  }
  const nextElement: HarnessElement = {
    ...current,
    ...(patch.props ? { props: { ...(current.props ?? {}), ...patch.props } } : {}),
    ...(patch.children ? { children: [...patch.children] } : {}),
    ...(patch.editable === undefined ? {} : { editable: patch.editable }),
  };
  assertHarnessElementAllowedByCatalog(nextElement);
  return withRevision({
    ...spec,
    elements: {
      ...spec.elements,
      [patch.elementId]: nextElement,
    },
  });
}

export function buildHarnessPromptContextRows(spec: HarnessAppSpec): string[] {
  return listEditableHarnessElements(spec).map((entry) => [
    entry.id,
    entry.type,
    entry.title.replace(/\|/gu, '/').replace(/\s+/gu, ' ').trim(),
    entry.editable ? 'editable' : 'locked',
    entry.slot,
  ].join('|'));
}
