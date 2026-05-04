import { describe, expect, it } from 'vitest';

import {
  buildActiveSessionFilesystemEntries,
  buildActiveWorktreeItems,
  getWorktreeItemTypeForNode,
  readWorktreeContextMenuState,
  readWorktreeRenderPaneState,
  toggleWorktreeRenderPaneState,
  type WorkspaceViewStateSnapshot,
} from './workspaceMcpWorktree';

describe('workspaceMcpWorktree', () => {
  it('derives active session filesystem entries', () => {
    expect(buildActiveSessionFilesystemEntries({
      activeSessionIds: ['session-1'],
      terminalFsPathsBySession: {
        'session-1': ['/workspace', '/workspace/docs', '/workspace/notes.md', '/workspace/docs'],
      },
      initialCwd: '/workspace',
      inferSessionFsEntryKind: (paths, path) => paths.some((candidate) => candidate !== path && candidate.startsWith(`${path}/`)) ? 'folder' : 'file',
    })).toEqual([
      { sessionId: 'session-1', path: '/workspace', kind: 'folder', isRoot: true },
      { sessionId: 'session-1', path: '/workspace/docs', kind: 'file', isRoot: false },
      { sessionId: 'session-1', path: '/workspace/notes.md', kind: 'file', isRoot: false },
    ]);
  });

  it('derives worktree item types and active worktree items', () => {
    const browserNode = { id: 'page-1', type: 'tab', nodeKind: 'browser', name: 'Docs', url: 'https://example.com' };
    const sessionNode = { id: 'session-1', type: 'tab', nodeKind: 'session', name: 'Session 1' };
    const fileNode = { id: 'file-1', type: 'file', name: 'AGENTS.md', filePath: 'AGENTS.md' };
    const artifactNode = { id: 'artifact-1', type: 'folder', name: 'Launch dashboard', artifactId: 'artifact-dashboard' };
    const artifactFileNode = { id: 'artifact-file-1', type: 'file', name: 'index.html', artifactId: 'artifact-dashboard', artifactFilePath: 'index.html' };
    const vfsNode = { id: 'vfs:session-1:/workspace', type: 'folder', name: '/workspace' };
    const clipboardNode = { id: 'clipboard-1', type: 'tab', nodeKind: 'clipboard', name: 'Clipboard' };

    expect(getWorktreeItemTypeForNode(browserNode as never)).toBe('browser-page');
    expect(getWorktreeItemTypeForNode(sessionNode as never)).toBe('session');
    expect(getWorktreeItemTypeForNode(fileNode as never)).toBe('workspace-file');
    expect(getWorktreeItemTypeForNode(artifactNode as never)).toBe('artifact');
    expect(getWorktreeItemTypeForNode(artifactFileNode as never)).toBe('artifact-file');
    expect(getWorktreeItemTypeForNode(vfsNode as never)).toBe('session-fs-entry');
    expect(getWorktreeItemTypeForNode(clipboardNode as never)).toBe('clipboard');

    expect(buildActiveWorktreeItems({
      flattenedItems: [
        { node: browserNode as never },
        { node: sessionNode as never },
        { node: fileNode as never },
        { node: artifactNode as never },
        { node: artifactFileNode as never },
        { node: vfsNode as never },
        { node: clipboardNode as never },
      ],
      parseVfsNodeId: (nodeId) => nodeId === 'vfs:session-1:/workspace'
        ? { sessionId: 'session-1', basePath: '/workspace', isDriveRoot: true }
        : null,
    })).toEqual([
      { id: 'page-1', itemType: 'browser-page', label: 'Docs', url: 'https://example.com' },
      { id: 'session-1', itemType: 'session', label: 'Session 1' },
      { id: 'file-1', itemType: 'workspace-file', label: 'AGENTS.md', path: 'AGENTS.md' },
      { id: 'artifact-1', itemType: 'artifact', label: 'Launch dashboard', artifactId: 'artifact-dashboard' },
      { id: 'artifact-file-1', itemType: 'artifact-file', label: 'index.html', artifactId: 'artifact-dashboard', path: '//artifacts/artifact-dashboard/index.html', artifactFilePath: 'index.html' },
      { id: 'vfs:session-1:/workspace', itemType: 'session-fs-entry', label: '/workspace', path: '/workspace', sessionId: 'session-1' },
      { id: 'clipboard-1', itemType: 'clipboard', label: 'Clipboard' },
    ]);
  });

  it('reads and toggles worktree render pane state', () => {
    const viewState: WorkspaceViewStateSnapshot = {
      openTabIds: ['page-1'],
      editingFilePath: null,
      activeSessionIds: ['session-1'],
    };

    expect(readWorktreeRenderPaneState({ id: 'page-1', itemType: 'browser-page', label: 'Docs' }, viewState)).toEqual({
      itemId: 'page-1',
      itemType: 'browser-page',
      isOpen: true,
      supported: true,
    });
    expect(readWorktreeRenderPaneState({ id: 'notes', itemType: 'workspace-file', label: 'Notes', path: 'notes.md' }, viewState)).toEqual({
      itemId: 'notes',
      itemType: 'workspace-file',
      isOpen: false,
      supported: true,
    });
    expect(readWorktreeRenderPaneState({ id: 'clipboard', itemType: 'clipboard', label: 'Clipboard' }, viewState)).toEqual({
      itemId: 'clipboard',
      itemType: 'clipboard',
      isOpen: false,
      supported: false,
    });

    expect(toggleWorktreeRenderPaneState({ id: 'page-1', itemType: 'browser-page', label: 'Docs' }, viewState)).toEqual({
      nextViewState: { ...viewState, openTabIds: [] },
      state: { itemId: 'page-1', itemType: 'browser-page', isOpen: false, supported: true },
    });
    expect(toggleWorktreeRenderPaneState({ id: 'session-2', itemType: 'session', label: 'Session 2' }, viewState)).toEqual({
      nextViewState: { ...viewState, activeSessionIds: ['session-1', 'session-2'] },
      state: { itemId: 'session-2', itemType: 'session', isOpen: true, supported: true },
    });
    expect(toggleWorktreeRenderPaneState({ id: 'notes', itemType: 'workspace-file', label: 'Notes', path: 'notes.md' }, viewState)).toEqual({
      nextViewState: { ...viewState, editingFilePath: 'notes.md' },
      state: { itemId: 'notes', itemType: 'workspace-file', isOpen: true, supported: true },
    });
  });

  it('reads worktree context menu state', () => {
    expect(readWorktreeContextMenuState(
      { itemId: 'page-1', itemType: 'browser-page' },
      { itemId: 'page-1', itemType: 'browser-page' },
    )).toEqual({
      itemId: 'page-1',
      itemType: 'browser-page',
      isOpen: true,
      supported: true,
    });

    expect(readWorktreeContextMenuState(
      { itemId: 'page-1', itemType: 'browser-page' },
      { itemId: 'session-1', itemType: 'session' },
    )).toEqual({
      itemId: 'page-1',
      itemType: 'browser-page',
      isOpen: false,
      supported: true,
    });
  });
});
