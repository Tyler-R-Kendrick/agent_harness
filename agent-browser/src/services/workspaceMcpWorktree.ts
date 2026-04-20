import type {
  WorkspaceMcpSessionFsEntry,
  WorkspaceMcpWorktreeContextMenuState,
  WorkspaceMcpWorktreeItem,
  WorkspaceMcpWorktreeItemType,
  WorkspaceMcpWorktreeRenderPaneState,
} from 'agent-browser-mcp';

import type { TreeNode } from '../types';

export interface WorkspaceViewStateSnapshot {
  openTabIds: string[];
  editingFilePath: string | null;
  activeSessionIds: string[];
}

export interface WorkspaceContextMenuState<TEntry = unknown, TTopButton = unknown> {
  x: number;
  y: number;
  itemId: string;
  itemType: WorkspaceMcpWorktreeItemType;
  entries: TEntry[];
  topButtons?: TTopButton[];
}

export function buildActiveSessionFilesystemEntries(args: {
  activeSessionIds: readonly string[];
  terminalFsPathsBySession: Record<string, string[]>;
  initialCwd: string;
  inferSessionFsEntryKind: (paths: readonly string[], path: string) => 'file' | 'folder';
}): WorkspaceMcpSessionFsEntry[] {
  const {
    activeSessionIds,
    terminalFsPathsBySession,
    initialCwd,
    inferSessionFsEntryKind,
  } = args;

  return activeSessionIds.flatMap((sessionId) => {
    const rawPaths = [...new Set(terminalFsPathsBySession[sessionId] ?? [])].sort((left, right) => left.localeCompare(right));
    return rawPaths.map((path) => ({
      sessionId,
      path,
      kind: inferSessionFsEntryKind(rawPaths, path),
      isRoot: path === initialCwd,
    }));
  });
}

export function getWorktreeItemTypeForNode(node: TreeNode): WorkspaceMcpWorktreeItemType | null {
  if (node.id.startsWith('vfs:') && !node.nodeKind) {
    return 'session-fs-entry';
  }
  if (node.type === 'tab' && node.nodeKind === 'browser') {
    return 'browser-page';
  }
  if (node.type === 'tab' && node.nodeKind === 'session') {
    return 'session';
  }
  if (node.type === 'file' && node.filePath) {
    return 'workspace-file';
  }
  if (node.type === 'tab' && node.nodeKind === 'clipboard') {
    return 'clipboard';
  }

  return null;
}

export function buildActiveWorktreeItems(args: {
  flattenedItems: readonly { node: TreeNode }[];
  parseVfsNodeId: (nodeId: string) => { sessionId: string; basePath: string; isDriveRoot: boolean } | null;
}): WorkspaceMcpWorktreeItem[] {
  const { flattenedItems, parseVfsNodeId } = args;

  return flattenedItems.flatMap<WorkspaceMcpWorktreeItem>(({ node }) => {
    if (node.id.startsWith('vfs:') && !node.nodeKind) {
      const vfsArgs = parseVfsNodeId(node.id);
      return vfsArgs ? [{
        id: node.id,
        itemType: 'session-fs-entry' as const,
        label: node.name,
        path: vfsArgs.basePath,
        sessionId: vfsArgs.sessionId,
      }] : [];
    }
    if (node.type === 'tab' && node.nodeKind === 'browser') {
      return [{ id: node.id, itemType: 'browser-page' as const, label: node.name, url: node.url }];
    }
    if (node.type === 'tab' && node.nodeKind === 'session') {
      return [{ id: node.id, itemType: 'session' as const, label: node.name }];
    }
    if (node.type === 'file' && node.filePath) {
      return [{ id: node.id, itemType: 'workspace-file' as const, label: node.name, path: node.filePath }];
    }
    if (node.type === 'tab' && node.nodeKind === 'clipboard') {
      return [{ id: node.id, itemType: 'clipboard' as const, label: node.name }];
    }
    return [];
  });
}

export function readWorktreeRenderPaneState(
  item: WorkspaceMcpWorktreeItem,
  viewState: WorkspaceViewStateSnapshot,
): WorkspaceMcpWorktreeRenderPaneState {
  switch (item.itemType) {
    case 'browser-page':
      return {
        itemId: item.id,
        itemType: item.itemType,
        isOpen: viewState.openTabIds.includes(item.id),
        supported: true,
      };
    case 'session':
      return {
        itemId: item.id,
        itemType: item.itemType,
        isOpen: viewState.activeSessionIds.includes(item.id),
        supported: true,
      };
    case 'workspace-file':
      return {
        itemId: item.id,
        itemType: item.itemType,
        isOpen: typeof item.path === 'string' && viewState.editingFilePath === item.path,
        supported: typeof item.path === 'string',
      };
    default:
      return {
        itemId: item.id,
        itemType: item.itemType,
        isOpen: false,
        supported: false,
      };
  }
}

export function toggleWorktreeRenderPaneState<TViewState extends WorkspaceViewStateSnapshot>(
  item: WorkspaceMcpWorktreeItem,
  viewState: TViewState,
): { nextViewState: TViewState; state: WorkspaceMcpWorktreeRenderPaneState } {
  const currentState = readWorktreeRenderPaneState(item, viewState);
  if (!currentState.supported) {
    return { nextViewState: viewState, state: currentState };
  }

  switch (item.itemType) {
    case 'browser-page': {
      const isOpen = viewState.openTabIds.includes(item.id);
      return {
        nextViewState: {
          ...viewState,
          openTabIds: isOpen
            ? viewState.openTabIds.filter((id) => id !== item.id)
            : [...viewState.openTabIds, item.id],
        },
        state: {
          itemId: item.id,
          itemType: item.itemType,
          isOpen: !isOpen,
          supported: true,
        },
      };
    }
    case 'session': {
      const isOpen = viewState.activeSessionIds.includes(item.id);
      return {
        nextViewState: {
          ...viewState,
          activeSessionIds: isOpen
            ? viewState.activeSessionIds.filter((id) => id !== item.id)
            : [...viewState.activeSessionIds, item.id],
        },
        state: {
          itemId: item.id,
          itemType: item.itemType,
          isOpen: !isOpen,
          supported: true,
        },
      };
    }
    case 'workspace-file': {
      const nextPath = viewState.editingFilePath === item.path ? null : item.path ?? null;
      return {
        nextViewState: {
          ...viewState,
          editingFilePath: nextPath,
        },
        state: {
          itemId: item.id,
          itemType: item.itemType,
          isOpen: nextPath === item.path,
          supported: typeof item.path === 'string',
        },
      };
    }
    default:
      return { nextViewState: viewState, state: currentState };
  }
}

export function readWorktreeContextMenuState(
  target: { itemId: string; itemType: WorkspaceMcpWorktreeItemType },
  contextMenu: Pick<WorkspaceContextMenuState, 'itemId' | 'itemType'> | null,
): WorkspaceMcpWorktreeContextMenuState {
  return {
    itemId: target.itemId,
    itemType: target.itemType,
    isOpen: Boolean(contextMenu && contextMenu.itemId === target.itemId && contextMenu.itemType === target.itemType),
    supported: true,
  };
}