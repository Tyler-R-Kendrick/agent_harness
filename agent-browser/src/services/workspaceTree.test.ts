import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceNodeMap,
  createBrowserTab,
  createWorkspaceNode,
  createWorkspaceViewEntry,
  ensureWorkspaceCategories,
  flattenWorkspaceTreeFiltered,
  getWorkspaceCategory,
  normalizeWorkspaceViewEntry,
  renderPaneIdForNode,
  syncWorkspaceArtifactNodes,
  syncWorkspaceDashboardNodes,
  workspaceViewStateEquals,
} from './workspaceTree';
import type { TreeNode } from '../types';

describe('workspaceTree', () => {
  it('creates normalized workspaces with dashboard, browser, session, files, and clipboard entries', () => {
    const browserTab = createBrowserTab('Docs', 'https://example.com/docs', 'hot', 64, true);
    const workspace = createWorkspaceNode({
      id: 'ws-test',
      name: 'Test',
      color: '#fff',
      browserTabs: [browserTab],
    });

    expect(workspace.children?.[0]).toEqual(expect.objectContaining({ name: 'Dashboard', nodeKind: 'dashboard' }));
    expect(getWorkspaceCategory(workspace, 'browser')?.children).toEqual([browserTab]);
    expect(getWorkspaceCategory(workspace, 'session')?.children?.[0]).toEqual(expect.objectContaining({
      name: 'Session 1',
      nodeKind: 'session',
      persisted: true,
    }));
    expect(getWorkspaceCategory(workspace, 'files')).toEqual(expect.objectContaining({ expanded: false }));
    expect(workspace.children?.at(-1)).toEqual(expect.objectContaining({ id: 'ws-test:clipboard', nodeKind: 'clipboard' }));
  });

  it('migrates legacy agent and terminal categories into session nodes', () => {
    const workspace: TreeNode = {
      id: 'ws-legacy',
      name: 'Legacy',
      type: 'workspace',
      children: [
        {
          id: 'ws-legacy:category:agent',
          name: 'Agent',
          type: 'folder',
          nodeKind: 'agent',
          children: [{ id: 'agent-1', name: 'Agent 1', type: 'tab', nodeKind: 'agent' }],
        },
        {
          id: 'ws-legacy:category:terminal',
          name: 'Terminal',
          type: 'folder',
          nodeKind: 'terminal',
          children: [{ id: 'terminal-1', name: 'Terminal 1', type: 'tab', nodeKind: 'terminal' }],
        },
      ],
    };

    const normalized = ensureWorkspaceCategories(workspace);
    const sessionIds = getWorkspaceCategory(normalized, 'session')?.children?.map((child) => [child.id, child.nodeKind]);

    expect(sessionIds).toEqual([
      ['terminal-1', 'session'],
      ['agent-1', 'session'],
    ]);
  });

  it('normalizes view state by pruning missing panels while preserving deliberate empty sessions', () => {
    const workspace = createWorkspaceNode({
      id: 'ws-view',
      name: 'View',
      color: '#fff',
      browserTabs: [createBrowserTab('Docs', 'https://example.com/docs', 'warm', 32)],
    });
    const browserId = getWorkspaceCategory(workspace, 'browser')?.children?.[0]?.id ?? '';
    const sessionId = getWorkspaceCategory(workspace, 'session')?.children?.[0]?.id ?? '';

    const normalized = normalizeWorkspaceViewEntry(workspace, {
      ...createWorkspaceViewEntry(workspace),
      openTabIds: [browserId, 'missing-browser'],
      activeSessionIds: [],
      mountedSessionFsIds: [sessionId, 'missing-session'],
      panelOrder: ['browser:ok', '', 'session:ok'],
    });

    expect(normalized.openTabIds).toEqual([browserId]);
    expect(normalized.activeSessionIds).toEqual([]);
    expect(normalized.mountedSessionFsIds).toEqual([sessionId]);
    expect(normalized.panelOrder).toEqual(['browser:ok', 'session:ok']);
    expect(normalized.dashboardOpen).toBe(true);
  });

  it('filters workspace trees and maps nodes back to owning workspaces', () => {
    const workspace = createWorkspaceNode({
      id: 'ws-filter',
      name: 'Filter',
      color: '#fff',
      browserTabs: [createBrowserTab('API Docs', 'https://example.com/api', 'cool', 16)],
    });
    const root: TreeNode = { id: 'root', name: 'Root', type: 'root', children: [workspace] };
    const browserId = getWorkspaceCategory(workspace, 'browser')?.children?.[0]?.id ?? '';

    expect(flattenWorkspaceTreeFiltered(workspace, 'api').map((item) => item.node.name)).toEqual(['Browser', 'API Docs']);
    expect(buildWorkspaceNodeMap(root).get(browserId)).toBe('ws-filter');
  });

  it('syncs dashboard widget nodes under the Dashboard section', () => {
    const workspace = createWorkspaceNode({
      id: 'ws-dashboard-nodes',
      name: 'Dashboard nodes',
      color: '#fff',
      browserTabs: [],
    });

    const synced = syncWorkspaceDashboardNodes(workspace, [
      { id: 'session-summary-widget', title: 'Session summary' },
      { id: 'knowledge-widget', title: 'Knowledge' },
    ]);
    const dashboard = getWorkspaceCategory(synced, 'dashboard');

    expect(dashboard?.children).toEqual([
      expect.objectContaining({ name: 'Session summary', nodeKind: 'dashboard', dashboardWidgetId: 'session-summary-widget' }),
      expect.objectContaining({ name: 'Knowledge', nodeKind: 'dashboard', dashboardWidgetId: 'knowledge-widget' }),
    ]);
  });

  it('syncs artifact nodes as a top-level Artifacts section between Sessions and Files', () => {
    const workspace = createWorkspaceNode({
      id: 'ws-artifacts',
      name: 'Artifacts workspace',
      color: '#fff',
      browserTabs: [],
    });
    const artifactNodes: TreeNode[] = [{
      id: 'artifact:ws-artifacts:artifact:artifact-review',
      name: 'Launch review',
      type: 'folder',
      artifactId: 'artifact-review',
      children: [{
        id: 'artifact:ws-artifacts:artifact:artifact-review:file:review.md',
        name: 'review.md',
        type: 'file',
        artifactId: 'artifact-review',
        artifactFilePath: 'review.md',
      }],
    }];

    const synced = syncWorkspaceArtifactNodes(workspace, artifactNodes);
    const artifactCategory = getWorkspaceCategory(synced, 'artifact');
    const filesCategory = getWorkspaceCategory(synced, 'files');

    expect(synced.children?.map((child) => child.name)).toEqual([
      'Dashboard',
      'Browser',
      'Sessions',
      'Artifacts',
      'Files',
      'Clipboard',
    ]);
    expect(artifactCategory).toEqual(expect.objectContaining({
      id: 'ws-artifacts:category:artifact',
      name: 'Artifacts',
      nodeKind: 'artifact',
      expanded: true,
      children: artifactNodes,
    }));
    expect(filesCategory?.children?.some((child) => child.name === '//artifacts')).toBe(false);
  });

  it('derives stable render pane ids and compares workspace view state by value', () => {
    const file: TreeNode = {
      id: 'file-node',
      name: 'AGENTS.md',
      type: 'file',
      filePath: 'AGENTS.md',
    };
    const left = {
      openTabIds: ['tab-1'],
      editingFilePath: null,
      dashboardOpen: true,
      activeMode: 'agent' as const,
      activeSessionIds: ['session-1'],
      mountedSessionFsIds: ['session-1'],
      panelOrder: ['browser:tab-1'],
    };

    expect(renderPaneIdForNode(file)).toBe('file:AGENTS.md');
    expect(renderPaneIdForNode({ id: 'ws-test', name: 'Test', type: 'workspace' })).toBe('dashboard:ws-test');
    expect(renderPaneIdForNode({ id: 'ws-test:dashboard:knowledge-widget', name: 'Knowledge', type: 'tab', nodeKind: 'dashboard', dashboardWidgetId: 'knowledge-widget' })).toBe('widget-editor:ws-test:knowledge-widget');
    expect(workspaceViewStateEquals(left, { ...left })).toBe(true);
    expect(workspaceViewStateEquals(left, { ...left, dashboardOpen: false })).toBe(false);
    expect(workspaceViewStateEquals(left, { ...left, activeDashboardWidgetId: 'knowledge-widget' })).toBe(false);
    expect(workspaceViewStateEquals(left, { ...left, panelOrder: [] })).toBe(false);
  });

  it('opens the dashboard while mounting the first session filesystem by default', () => {
    const workspace = createWorkspaceNode({
      id: 'ws-dashboard',
      name: 'Dashboard',
      color: '#fff',
      browserTabs: [],
    });
    const firstSessionId = getWorkspaceCategory(workspace, 'session')?.children?.[0]?.id;

    expect(createWorkspaceViewEntry(workspace)).toEqual(expect.objectContaining({
      dashboardOpen: true,
      activeDashboardWidgetId: null,
      activeSessionIds: [],
      mountedSessionFsIds: [firstSessionId],
    }));
  });
});
