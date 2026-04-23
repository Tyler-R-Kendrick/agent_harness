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
  workspaceViewStateEquals,
} from './workspaceTree';
import type { TreeNode } from '../types';

describe('workspaceTree', () => {
  it('creates normalized workspaces with browser, session, files, and clipboard entries', () => {
    const browserTab = createBrowserTab('Docs', 'https://example.com/docs', 'hot', 64, true);
    const workspace = createWorkspaceNode({
      id: 'ws-test',
      name: 'Test',
      color: '#fff',
      browserTabs: [browserTab],
    });

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
      activeMode: 'agent' as const,
      activeSessionIds: ['session-1'],
      mountedSessionFsIds: ['session-1'],
      panelOrder: ['browser:tab-1'],
    };

    expect(renderPaneIdForNode(file)).toBe('file:AGENTS.md');
    expect(workspaceViewStateEquals(left, { ...left })).toBe(true);
    expect(workspaceViewStateEquals(left, { ...left, panelOrder: [] })).toBe(false);
  });
});
