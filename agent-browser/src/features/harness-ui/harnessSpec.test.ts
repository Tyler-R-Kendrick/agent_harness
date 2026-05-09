import { describe, expect, it } from 'vitest';
import {
  applyHarnessElementPatch,
  buildHarnessPromptContextRows,
  createDefaultHarnessAppSpec,
  listEditableHarnessElements,
} from './harnessSpec';

describe('harness app spec', () => {
  it('models the entire default shell as editable catalog elements', () => {
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
    });

    expect(spec.version).toBe('harness-ui/v1');
    expect(spec.root).toBe('app-shell');
    expect(spec.metadata).toMatchObject({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
      createdBy: 'agent-browser',
      designSystemId: 'agent-browser/current',
      revision: 1,
    });
    expect(spec.elements['app-shell']).toMatchObject({
      type: 'HarnessShell',
      editable: true,
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
    });
    expect(spec.elements['app-topbar']).toMatchObject({
      type: 'Omnibar',
      slot: 'app.omnibar',
      props: expect.objectContaining({ title: 'Command bar' }),
    });
    expect(spec.elements['workspace-sidebar']).toMatchObject({
      type: 'WorkspaceSidebar',
      editable: true,
      children: ['dashboard-tree-section', 'browser-tree-section', 'session-tree-section', 'files-tree-section', 'clipboard-tree-section'],
    });
    expect(spec.elements['render-pane-viewport']).toMatchObject({
      type: 'RenderPaneViewport',
      editable: true,
      children: ['main-dashboard', 'browser-page-panel', 'session-panel', 'terminal-panel', 'file-editor-panel'],
    });
    expect(spec.elements['main-dashboard']).toMatchObject({
      type: 'DashboardCanvas',
      editable: true,
      props: expect.objectContaining({ title: 'Research harness' }),
    });
    expect(spec.elements['settings-panel']).toMatchObject({
      type: 'SettingsPanel',
      slot: 'app.settings',
      props: expect.objectContaining({ title: 'Settings' }),
    });
    expect(Object.values(spec.elements).every((element) => element.editable !== false)).toBe(true);
  });

  it('lists editable elements with stable paths for agent and inspector use', () => {
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-build',
      workspaceName: 'Build',
    });

    expect(listEditableHarnessElements(spec)).toEqual([
      expect.objectContaining({ id: 'app-shell', type: 'HarnessShell', path: 'HarnessShell', title: 'Build' }),
      expect.objectContaining({ id: 'activity-rail', type: 'ActivityRail', path: 'HarnessShell/ActivityRail' }),
      expect.objectContaining({ id: 'app-topbar', type: 'Omnibar', path: 'HarnessShell/Omnibar' }),
      expect.objectContaining({ id: 'workspace-sidebar', type: 'WorkspaceSidebar', path: 'HarnessShell/WorkspaceSidebar' }),
      expect.objectContaining({ id: 'dashboard-tree-section', type: 'DashboardTreeSection', path: 'HarnessShell/WorkspaceSidebar/DashboardTreeSection' }),
      expect.objectContaining({ id: 'browser-tree-section', type: 'BrowserTreeSection', path: 'HarnessShell/WorkspaceSidebar/BrowserTreeSection' }),
      expect.objectContaining({ id: 'session-tree-section', type: 'SessionTreeSection', path: 'HarnessShell/WorkspaceSidebar/SessionTreeSection' }),
      expect.objectContaining({ id: 'files-tree-section', type: 'FilesTreeSection', path: 'HarnessShell/WorkspaceSidebar/FilesTreeSection' }),
      expect.objectContaining({ id: 'clipboard-tree-section', type: 'ClipboardTreeSection', path: 'HarnessShell/WorkspaceSidebar/ClipboardTreeSection' }),
      expect.objectContaining({ id: 'render-pane-viewport', type: 'RenderPaneViewport', path: 'HarnessShell/RenderPaneViewport' }),
      expect.objectContaining({ id: 'main-dashboard', type: 'DashboardCanvas', path: 'HarnessShell/RenderPaneViewport/DashboardCanvas' }),
      expect.objectContaining({ id: 'session-summary-widget', type: 'SessionConversationSummary', path: 'HarnessShell/RenderPaneViewport/DashboardCanvas/SessionConversationSummary' }),
      expect.objectContaining({ id: 'knowledge-widget', type: 'KnowledgeGraphWidget', path: 'HarnessShell/RenderPaneViewport/DashboardCanvas/KnowledgeGraphWidget' }),
      expect.objectContaining({ id: 'browser-page-panel', type: 'BrowserPagePanel', path: 'HarnessShell/RenderPaneViewport/BrowserPagePanel' }),
      expect.objectContaining({ id: 'session-panel', type: 'SessionPanel', path: 'HarnessShell/RenderPaneViewport/SessionPanel' }),
      expect.objectContaining({ id: 'terminal-panel', type: 'TerminalPanel', path: 'HarnessShell/RenderPaneViewport/TerminalPanel' }),
      expect.objectContaining({ id: 'file-editor-panel', type: 'FileEditorPanel', path: 'HarnessShell/RenderPaneViewport/FileEditorPanel' }),
      expect.objectContaining({ id: 'assistant-dock', type: 'AssistantDock', path: 'HarnessShell/AssistantDock' }),
      expect.objectContaining({ id: 'toast-host', type: 'ToastHost', path: 'HarnessShell/ToastHost' }),
      expect.objectContaining({ id: 'modal-host', type: 'ModalHost', path: 'HarnessShell/ModalHost' }),
      expect.objectContaining({ id: 'context-menu-host', type: 'ContextMenuHost', path: 'HarnessShell/ContextMenuHost' }),
    ]);
  });

  it('applies immutable element patches and rejects unknown targets', () => {
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
    });
    const next = applyHarnessElementPatch(spec, {
      elementId: 'main-dashboard',
      props: { title: 'Custom cockpit', density: 'compact' },
    });

    expect(next).not.toBe(spec);
    expect(next.elements['main-dashboard']).not.toBe(spec.elements['main-dashboard']);
    expect(next.elements['main-dashboard'].props).toMatchObject({
      title: 'Custom cockpit',
      density: 'compact',
    });
    expect(next.metadata.revision).toBe(2);
    expect(spec.elements['main-dashboard'].props).toMatchObject({ title: 'Research harness' });

    expect(() => applyHarnessElementPatch(spec, {
      elementId: 'missing-widget',
      props: { title: 'Nope' },
    })).toThrow(/missing-widget/);
  });

  it('builds compact prompt context rows for app customization', () => {
    const spec = createDefaultHarnessAppSpec({
      workspaceId: 'ws-research',
      workspaceName: 'Research',
    });

    expect(buildHarnessPromptContextRows(spec)).toEqual([
      'app-shell|HarnessShell|Research|editable|app',
      'activity-rail|ActivityRail|Navigation|editable|app.rail',
      'app-topbar|Omnibar|Command bar|editable|app.omnibar',
      'workspace-sidebar|WorkspaceSidebar|Workspace tree|editable|app.sidebar',
      'dashboard-tree-section|DashboardTreeSection|Dashboard|editable|app.sidebar.dashboard',
      'browser-tree-section|BrowserTreeSection|Browser pages|editable|app.sidebar.browser',
      'session-tree-section|SessionTreeSection|Sessions|editable|app.sidebar.sessions',
      'files-tree-section|FilesTreeSection|Files|editable|app.sidebar.files',
      'clipboard-tree-section|ClipboardTreeSection|Clipboard|editable|app.sidebar.clipboard',
      'render-pane-viewport|RenderPaneViewport|Content panes|editable|app.panels',
      'main-dashboard|DashboardCanvas|Research harness|editable|dashboard.canvas',
      'session-summary-widget|SessionConversationSummary|Session summary|editable|dashboard.canvas',
      'knowledge-widget|KnowledgeGraphWidget|Knowledge|editable|dashboard.canvas',
      'browser-page-panel|BrowserPagePanel|Browser page|editable|app.panels.browser',
      'session-panel|SessionPanel|Agent session|editable|app.panels.session',
      'terminal-panel|TerminalPanel|Terminal session|editable|app.panels.session',
      'file-editor-panel|FileEditorPanel|File editor|editable|app.panels.file',
      'assistant-dock|AssistantDock|Assistant|editable|app.assistant',
      'toast-host|ToastHost|Notifications|editable|app.toast',
      'modal-host|ModalHost|Dialogs|editable|app.overlay',
      'context-menu-host|ContextMenuHost|Context menus|editable|app.overlay',
    ]);
  });
});
