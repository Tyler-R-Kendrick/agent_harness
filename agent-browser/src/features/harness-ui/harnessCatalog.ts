import type { HarnessCatalogComponent, HarnessElement } from './types';

const SHARED_PROPS = ['title', 'label', 'visible'];
const PANEL_PROPS = [...SHARED_PROPS, 'density', 'emptyLabel'];
const WIDGET_PROPS = [
  ...SHARED_PROPS,
  'density',
  'emptyLabel',
  'metric',
  'addWidgetLabel',
  'minimized',
  'position',
  'sessionId',
  'size',
  'summary',
];
const UNSAFE_PROPS = new Set(['className', 'style', 'dangerouslySetInnerHTML', 'html', 'script']);

const CATALOG: HarnessCatalogComponent[] = [
  {
    type: 'HarnessShell',
    label: 'Harness shell',
    description: 'Top-level Agent Browser application shell.',
    allowedSlots: ['app'],
    allowedProps: [...SHARED_PROPS, 'density'],
    designTokens: ['app-shell', 'content-area', 'browser-shell'],
    naturalLanguageHints: ['whole app', 'harness shell', 'app layout'],
  },
  {
    type: 'ActivityRail',
    label: 'Activity rail',
    description: 'Left activity navigation rail.',
    allowedSlots: ['app.rail'],
    allowedProps: PANEL_PROPS,
    designTokens: ['sidebar-rail', 'workspace-toggle-pill'],
    naturalLanguageHints: ['left rail', 'activity rail', 'navigation icons'],
  },
  {
    type: 'Omnibar',
    label: 'Command bar',
    description: 'Top command and navigation bar.',
    allowedSlots: ['app.omnibar'],
    allowedProps: [...PANEL_PROPS, 'placeholder'],
    designTokens: ['omnibar', 'browser-toolbar', 'workspace-hotkey-button'],
    naturalLanguageHints: ['command bar', 'omnibar', 'address bar', 'top bar'],
  },
  {
    type: 'WorkspaceSidebar',
    label: 'Workspace sidebar',
    description: 'Workspace tree and sidebar container.',
    allowedSlots: ['app.sidebar'],
    allowedProps: PANEL_PROPS,
    designTokens: ['workspace-sidebar', 'sidebar-content', 'panel-titlebar'],
    naturalLanguageHints: ['workspace tree', 'sidebar', 'left pane'],
  },
  {
    type: 'BrowserTreeSection',
    label: 'Browser tree section',
    description: 'Sidebar browser pages section.',
    allowedSlots: ['app.sidebar.browser'],
    allowedProps: PANEL_PROPS,
    designTokens: ['tree-section', 'browser-worktree-mcp'],
    naturalLanguageHints: ['browser pages section', 'tabs list', 'open pages'],
  },
  {
    type: 'SessionTreeSection',
    label: 'Session tree section',
    description: 'Sidebar agent and terminal sessions section.',
    allowedSlots: ['app.sidebar.sessions'],
    allowedProps: PANEL_PROPS,
    designTokens: ['tree-section', 'sessions-worktree-mcp'],
    naturalLanguageHints: ['sessions section', 'agent sessions', 'terminal sessions'],
  },
  {
    type: 'FilesTreeSection',
    label: 'Files tree section',
    description: 'Sidebar workspace files section.',
    allowedSlots: ['app.sidebar.files'],
    allowedProps: PANEL_PROPS,
    designTokens: ['tree-section', 'files-worktree-mcp'],
    naturalLanguageHints: ['files section', 'workspace files', 'file tree'],
  },
  {
    type: 'ClipboardTreeSection',
    label: 'Clipboard tree section',
    description: 'Sidebar clipboard history section.',
    allowedSlots: ['app.sidebar.clipboard'],
    allowedProps: PANEL_PROPS,
    designTokens: ['tree-section', 'clipboard-worktree-mcp'],
    naturalLanguageHints: ['clipboard section', 'clipboard history', 'copied items'],
  },
  {
    type: 'RenderPaneViewport',
    label: 'Render pane viewport',
    description: 'Main area that hosts dashboard, browser, file, and session panes.',
    allowedSlots: ['app.panels'],
    allowedProps: PANEL_PROPS,
    designTokens: ['content-area', 'browser-split-view', 'panel-drag-cell'],
    naturalLanguageHints: ['content area', 'render panes', 'main viewport'],
  },
  {
    type: 'DashboardCanvas',
    label: 'Dashboard canvas',
    description: 'Infinite-canvas dashboard surface for generated widgets.',
    allowedSlots: ['dashboard.canvas', 'app.main'],
    allowedProps: WIDGET_PROPS,
    designTokens: ['harness-dashboard-panel', 'harness-dashboard-canvas', 'harness-dashboard-grid'],
    naturalLanguageHints: ['dashboard', 'canvas', 'widgets', 'home view'],
  },
  {
    type: 'WorkspaceSummary',
    label: 'Workspace summary widget',
    description: 'Legacy dashboard widget; renders as a session-scoped conversation summary.',
    allowedSlots: ['dashboard.canvas'],
    allowedProps: WIDGET_PROPS,
    designTokens: ['harness-widget-card', 'harness-metric-row'],
    naturalLanguageHints: ['workspace summary', 'metrics', 'overview'],
  },
  {
    type: 'SessionConversationSummary',
    label: 'Session conversation summary widget',
    description: 'Dashboard widget summarizing the selected session conversation.',
    allowedSlots: ['dashboard.canvas'],
    allowedProps: WIDGET_PROPS,
    designTokens: ['harness-widget-card', 'harness-metric-row', 'harness-session-summary'],
    naturalLanguageHints: ['conversation summary', 'session summary', 'chat summary'],
  },
  {
    type: 'SessionStorageAssets',
    label: 'Session storage assets widget',
    description: 'Dashboard widget listing storage assets for the selected session.',
    allowedSlots: ['dashboard.canvas'],
    allowedProps: WIDGET_PROPS,
    designTokens: ['harness-widget-card', 'harness-widget-list', 'harness-session-assets'],
    naturalLanguageHints: ['session storage', 'session assets', 'saved files'],
  },
  {
    type: 'SessionActivity',
    label: 'Session activity widget',
    description: 'Dashboard widget showing recent chat history for the selected session.',
    allowedSlots: ['dashboard.canvas'],
    allowedProps: WIDGET_PROPS,
    designTokens: ['harness-widget-card', 'harness-widget-list'],
    naturalLanguageHints: ['session activity', 'chat history', 'handoff notes'],
  },
  {
    type: 'SessionRuntime',
    label: 'Session runtime widget',
    description: 'Dashboard widget showing runtime controls and storage context for the selected session.',
    allowedSlots: ['dashboard.canvas'],
    allowedProps: WIDGET_PROPS,
    designTokens: ['harness-widget-card', 'harness-metric-row'],
    naturalLanguageHints: ['runtime context', 'tools', 'cwd', 'model'],
  },
  {
    type: 'SessionList',
    label: 'Session list widget',
    description: 'Dashboard widget for active sessions.',
    allowedSlots: ['dashboard.canvas'],
    allowedProps: WIDGET_PROPS,
    designTokens: ['harness-widget-card', 'harness-widget-list'],
    naturalLanguageHints: ['session widget', 'agent sessions', 'terminal sessions'],
  },
  {
    type: 'BrowserPageList',
    label: 'Browser page widget',
    description: 'Dashboard widget for open browser pages.',
    allowedSlots: ['dashboard.canvas'],
    allowedProps: WIDGET_PROPS,
    designTokens: ['harness-widget-card', 'harness-widget-list'],
    naturalLanguageHints: ['browser widget', 'page widget', 'tabs widget'],
  },
  {
    type: 'FileList',
    label: 'File list widget',
    description: 'Dashboard widget for workspace files.',
    allowedSlots: ['dashboard.canvas'],
    allowedProps: WIDGET_PROPS,
    designTokens: ['harness-widget-card', 'harness-widget-list'],
    naturalLanguageHints: ['file widget', 'workspace files widget'],
  },
  {
    type: 'HarnessInspector',
    label: 'Harness inspector',
    description: 'Dashboard widget and panel for editing the harness spec.',
    allowedSlots: ['dashboard.canvas', 'app.overlay'],
    allowedProps: [...WIDGET_PROPS, 'selectedElementId'],
    designTokens: ['harness-inspector', 'harness-editor'],
    naturalLanguageHints: ['customize harness', 'edit widgets', 'inspector'],
  },
  {
    type: 'BrowserPagePanel',
    label: 'Browser page panel',
    description: 'Main browser page preview panel shell.',
    allowedSlots: ['app.panels.browser'],
    allowedProps: PANEL_PROPS,
    designTokens: ['page-overlay', 'browser-toolbar', 'panel-titlebar'],
    naturalLanguageHints: ['browser panel', 'page preview'],
  },
  {
    type: 'SessionPanel',
    label: 'Agent session panel',
    description: 'Main chat session panel shell.',
    allowedSlots: ['app.panels.session'],
    allowedProps: PANEL_PROPS,
    designTokens: ['chat-panel', 'message-list', 'composer'],
    naturalLanguageHints: ['chat panel', 'agent session', 'assistant panel'],
  },
  {
    type: 'TerminalPanel',
    label: 'Terminal session panel',
    description: 'Terminal-mode session panel shell.',
    allowedSlots: ['app.panels.session'],
    allowedProps: PANEL_PROPS,
    designTokens: ['chat-panel', 'terminal-pane', 'composer'],
    naturalLanguageHints: ['terminal panel', 'terminal session', 'command line'],
  },
  {
    type: 'FileEditorPanel',
    label: 'File editor panel',
    description: 'Workspace file editor panel shell.',
    allowedSlots: ['app.panels.file'],
    allowedProps: PANEL_PROPS,
    designTokens: ['file-editor', 'panel-titlebar', 'secondary-button'],
    naturalLanguageHints: ['file editor', 'edit file', 'workspace document'],
  },
  {
    type: 'AssistantDock',
    label: 'Assistant dock',
    description: 'Docked assistant/chat surface in the shell.',
    allowedSlots: ['app.assistant'],
    allowedProps: PANEL_PROPS,
    designTokens: ['assistant-dock', 'chat-panel', 'panel-titlebar'],
    naturalLanguageHints: ['assistant dock', 'copilot dock', 'chat dock'],
  },
  {
    type: 'SettingsPanel',
    label: 'Settings panel',
    description: 'Settings surface.',
    allowedSlots: ['app.settings'],
    allowedProps: PANEL_PROPS,
    designTokens: ['settings-pane', 'sidebar-content'],
    naturalLanguageHints: ['settings', 'preferences'],
  },
  {
    type: 'ModelRegistryPanel',
    label: 'Model registry panel',
    description: 'Local and remote model registry surface.',
    allowedSlots: ['app.settings'],
    allowedProps: PANEL_PROPS,
    designTokens: ['registry-pane', 'model-card'],
    naturalLanguageHints: ['models', 'model registry', 'local inference'],
  },
  {
    type: 'ExtensionsPanel',
    label: 'Extensions panel',
    description: 'Extensions and tools surface.',
    allowedSlots: ['app.extensions'],
    allowedProps: PANEL_PROPS,
    designTokens: ['extensions-pane', 'tools-picker'],
    naturalLanguageHints: ['extensions', 'tools', 'plugins'],
  },
  {
    type: 'HistoryPanel',
    label: 'History panel',
    description: 'Workspace history surface.',
    allowedSlots: ['app.history'],
    allowedProps: PANEL_PROPS,
    designTokens: ['history-pane', 'version-history'],
    naturalLanguageHints: ['history', 'versions', 'activity'],
  },
  {
    type: 'AccountPanel',
    label: 'Account panel',
    description: 'Account and identity surface.',
    allowedSlots: ['app.account'],
    allowedProps: PANEL_PROPS,
    designTokens: ['account-pane', 'identity-card'],
    naturalLanguageHints: ['account', 'profile', 'identity'],
  },
  {
    type: 'ToastHost',
    label: 'Notification host',
    description: 'Toast notification host.',
    allowedSlots: ['app.toast'],
    allowedProps: SHARED_PROPS,
    designTokens: ['toast', 'notification'],
    naturalLanguageHints: ['notifications', 'toasts'],
  },
  {
    type: 'ModalHost',
    label: 'Dialog host',
    description: 'Application modal and dialog host.',
    allowedSlots: ['app.overlay'],
    allowedProps: SHARED_PROPS,
    designTokens: ['modal', 'overlay'],
    naturalLanguageHints: ['dialogs', 'modals', 'overlays'],
  },
  {
    type: 'ContextMenuHost',
    label: 'Context menu host',
    description: 'Workspace context menu host.',
    allowedSlots: ['app.overlay'],
    allowedProps: SHARED_PROPS,
    designTokens: ['context-menu', 'overlay'],
    naturalLanguageHints: ['context menus', 'right click menus'],
  },
];

const CATALOG_BY_TYPE = new Map(CATALOG.map((entry) => [entry.type, entry]));

export function listHarnessCatalogComponents(): HarnessCatalogComponent[] {
  return CATALOG.map((entry) => ({
    ...entry,
    allowedSlots: [...entry.allowedSlots],
    allowedProps: [...entry.allowedProps],
    designTokens: [...entry.designTokens],
    naturalLanguageHints: [...entry.naturalLanguageHints],
  }));
}

export function getHarnessCatalogComponent(type: string): HarnessCatalogComponent | null {
  const entry = CATALOG_BY_TYPE.get(type);
  return entry
    ? {
        ...entry,
        allowedSlots: [...entry.allowedSlots],
        allowedProps: [...entry.allowedProps],
        designTokens: [...entry.designTokens],
        naturalLanguageHints: [...entry.naturalLanguageHints],
      }
    : null;
}

export function assertHarnessElementAllowedByCatalog(element: HarnessElement): void {
  const catalogEntry = CATALOG_BY_TYPE.get(element.type);
  if (!catalogEntry) {
    throw new Error(`Harness element "${element.id}" uses uncataloged type "${element.type}".`);
  }

  if (element.slot && !catalogEntry.allowedSlots.includes(element.slot)) {
    throw new Error(`Harness element "${element.id}" uses slot "${element.slot}" outside the ${element.type} catalog slots.`);
  }

  for (const propName of Object.keys(element.props ?? {})) {
    if (UNSAFE_PROPS.has(propName) || !catalogEntry.allowedProps.includes(propName)) {
      throw new Error(`Harness element "${element.id}" uses unsupported prop "${propName}".`);
    }
  }
}
