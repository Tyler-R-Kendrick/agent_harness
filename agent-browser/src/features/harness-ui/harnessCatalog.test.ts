import { describe, expect, it } from 'vitest';
import {
  assertHarnessElementAllowedByCatalog,
  getHarnessCatalogComponent,
  listHarnessCatalogComponents,
} from './harnessCatalog';

describe('harness catalog', () => {
  it('catalogs every major Agent Browser app surface with design-system tokens', () => {
    const catalog = listHarnessCatalogComponents();
    const types = catalog.map((entry) => entry.type);

    expect(types).toEqual(expect.arrayContaining([
      'HarnessShell',
      'ActivityRail',
      'Omnibar',
      'WorkspaceSidebar',
      'DashboardTreeSection',
      'BrowserTreeSection',
      'SessionTreeSection',
      'FilesTreeSection',
      'ClipboardTreeSection',
      'RenderPaneViewport',
      'DashboardCanvas',
      'WorkspaceSummary',
      'KnowledgeGraphWidget',
      'SessionList',
      'BrowserPageList',
      'FileList',
      'HarnessInspector',
      'BrowserPagePanel',
      'SessionPanel',
      'TerminalPanel',
      'FileEditorPanel',
      'AssistantDock',
      'SettingsPanel',
      'ModelRegistryPanel',
      'ExtensionsPanel',
      'HistoryPanel',
      'AccountPanel',
      'ToastHost',
      'ModalHost',
      'ContextMenuHost',
    ]));

    expect(catalog).toHaveLength(new Set(types).size);
    expect(catalog.every((entry) => entry.designTokens.length > 0)).toBe(true);
    expect(catalog.every((entry) => entry.naturalLanguageHints.length > 0)).toBe(true);
  });

  it('looks up catalog entries and rejects uncataloged or unsafe props', () => {
    expect(getHarnessCatalogComponent('WorkspaceSidebar')).toMatchObject({
      label: 'Workspace sidebar',
      allowedSlots: ['app.sidebar'],
      allowedProps: expect.arrayContaining(['title', 'density', 'visible']),
    });
    expect(getHarnessCatalogComponent('NotReal')).toBeNull();

    expect(() => assertHarnessElementAllowedByCatalog({
      id: 'ok',
      type: 'WorkspaceSidebar',
      slot: 'app.sidebar',
      props: { title: 'Tree', density: 'compact' },
    })).not.toThrow();

    expect(() => assertHarnessElementAllowedByCatalog({
      id: 'main-dashboard',
      type: 'DashboardCanvas',
      slot: 'dashboard.canvas',
      props: {
        sessionWidgetLayouts: {
          session1: {
            position: { col: 0, row: 0 },
            size: { cols: 6, rows: 4 },
          },
        },
      },
    })).not.toThrow();

    expect(() => assertHarnessElementAllowedByCatalog({
      id: 'bad-type',
      type: 'RawHtml',
      slot: 'app.sidebar',
    })).toThrow(/catalog/);

    expect(() => assertHarnessElementAllowedByCatalog({
      id: 'bad-prop',
      type: 'WorkspaceSidebar',
      slot: 'app.sidebar',
      props: { className: 'freeform-css' },
    })).toThrow(/className/);

    expect(() => assertHarnessElementAllowedByCatalog({
      id: 'bad-slot',
      type: 'WorkspaceSidebar',
      slot: 'dashboard.canvas',
    })).toThrow(/slot/);
  });
});
