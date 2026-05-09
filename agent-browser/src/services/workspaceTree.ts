import { createUniqueId } from '../utils/uniqueId';
import type { NodeKind, TreeNode } from '../types';
import type { ArtifactPanelSelection } from './artifacts';

export type FlatTreeItem = { node: TreeNode; depth: number };

export type WorkspaceViewState = {
  openTabIds: string[];
  editingFilePath: string | null;
  dashboardOpen: boolean;
  activeMode: 'agent' | 'terminal';
  activeSessionIds: string[];
  mountedSessionFsIds: string[];
  panelOrder: string[];
  activeArtifactPanel?: ArtifactPanelSelection | null;
};

export const WORKSPACE_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#fb7185'] as const;

const CATEGORY_LABELS: Record<NodeKind, string> = {
  dashboard: 'Dashboard',
  browser: 'Browser',
  session: 'Sessions',
  terminal: 'Terminal',
  agent: 'Agent',
  files: 'Files',
  clipboard: 'Clipboard',
};

export type DashboardWidgetNodeInput = {
  id: string;
  title: string;
};

export function createClipboardNode(workspaceId: string): TreeNode {
  return {
    id: `${workspaceId}:clipboard`,
    name: 'Clipboard',
    type: 'tab',
    nodeKind: 'clipboard',
  };
}

export function createSessionNode(workspaceId: string, index: number): TreeNode {
  return {
    id: createUniqueId(),
    name: `Session ${index}`,
    type: 'tab',
    nodeKind: 'session',
    persisted: true,
    filePath: `${workspaceId}:session:${index}`,
  };
}

export function createBrowserTab(name: string, url: string, memoryTier: TreeNode['memoryTier'], memoryMB: number, persisted = false): TreeNode {
  return {
    id: createUniqueId(),
    name,
    type: 'tab',
    nodeKind: 'browser',
    url,
    persisted,
    memoryTier,
    memoryMB,
  };
}

function categoryNode(workspaceId: string, kind: NodeKind, children: TreeNode[] = []): TreeNode {
  return {
    id: `${workspaceId}:category:${kind}`,
    name: CATEGORY_LABELS[kind],
    type: 'folder',
    nodeKind: kind,
    expanded: kind !== 'files',
    children,
  };
}

export function createDashboardWidgetNode(workspaceId: string, widget: DashboardWidgetNodeInput): TreeNode {
  return {
    id: `${workspaceId}:dashboard:${widget.id}`,
    name: widget.title,
    type: 'tab',
    nodeKind: 'dashboard',
    persisted: true,
    dashboardWidgetId: widget.id,
  };
}

export function createWorkspaceNode({
  id,
  name,
  color,
  browserTabs,
}: {
  id: string;
  name: string;
  color: string;
  browserTabs: TreeNode[];
}): TreeNode {
  return {
    id,
    name,
    type: 'workspace',
    expanded: true,
    activeMemory: true,
    color,
    children: [
      categoryNode(id, 'dashboard', []),
      categoryNode(id, 'browser', browserTabs),
      categoryNode(id, 'session', [createSessionNode(id, 1)]),
      categoryNode(id, 'files', []),
      createClipboardNode(id),
    ],
  };
}

export function createInitialRoot(): TreeNode {
  return {
    id: 'root',
    name: 'Root',
    type: 'root',
    expanded: true,
    children: [
      createWorkspaceNode({
        id: 'ws-research',
        name: 'Research',
        color: '#60a5fa',
        browserTabs: [
          createBrowserTab('Hugging Face', 'https://huggingface.co/models?library=transformers.js', 'hot', 165, true),
          createBrowserTab('Transformers.js', 'https://huggingface.co/docs/transformers.js', 'warm', 88),
        ],
      }),
      createWorkspaceNode({
        id: 'ws-build',
        name: 'Build',
        color: '#34d399',
        browserTabs: [
          createBrowserTab('CopilotKit docs', 'https://docs.copilotkit.ai', 'cool', 44),
        ],
      }),
    ],
  };
}

export function deepUpdate(node: TreeNode, id: string, update: (node: TreeNode) => TreeNode): TreeNode {
  if (node.id === id) return update(node);
  if (!node.children) return node;
  return { ...node, children: node.children.map((child) => deepUpdate(child, id, update)) };
}

export function findNode(node: TreeNode, id: string): TreeNode | null {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const match = findNode(child, id);
    if (match) return match;
  }
  return null;
}

export function flattenTabs(node: TreeNode, kind?: NodeKind): TreeNode[] {
  if (node.type === 'tab') {
    if (!kind || node.nodeKind === kind) return [node];
    return [];
  }
  return (node.children ?? []).flatMap((child) => flattenTabs(child, kind));
}

export function countTabs(node: TreeNode): number {
  return flattenTabs(node, 'browser').length;
}

export function totalMemoryMB(node: TreeNode): number {
  return flattenTabs(node, 'browser').reduce((sum, tab) => sum + (tab.memoryMB ?? 0), 0);
}

export function getWorkspace(root: TreeNode, workspaceId: string): TreeNode | null {
  return (root.children ?? []).find((node) => node.id === workspaceId) ?? null;
}

export function findParent(root: TreeNode, id: string, parent: TreeNode | null = null): TreeNode | null {
  if (root.id === id) return parent;
  for (const child of root.children ?? []) {
    const match = findParent(child, id, root);
    if (match) return match;
  }
  return null;
}

export function findWorkspaceForNode(root: TreeNode, nodeId: string): TreeNode | null {
  for (const workspace of root.children ?? []) {
    if (workspace.id === nodeId) return workspace;
    if ((workspace.children ?? []).some((child) => findNode(child, nodeId))) return workspace;
  }
  return null;
}

export function getWorkspaceCategory(workspace: TreeNode, kind: NodeKind): TreeNode | null {
  return (workspace.children ?? []).find((child) => child.type === 'folder' && child.nodeKind === kind) ?? null;
}

export function removeNodeById(node: TreeNode, nodeId: string): TreeNode {
  if (!node.children) return node;
  return {
    ...node,
    children: node.children
      .filter((child) => child.id !== nodeId)
      .map((child) => removeNodeById(child, nodeId)),
  };
}

export function ensureWorkspaceCategories(workspace: TreeNode): TreeNode {
  const existing = new Map(
    (workspace.children ?? [])
      .filter((child) => child.type === 'folder' && child.nodeKind)
      .map((child) => [child.nodeKind as NodeKind, child]),
  );
  const legacyTabChildren = (workspace.children ?? []).filter((child) => child.type === 'tab' && child.nodeKind !== 'agent' && child.nodeKind !== 'terminal' && child.nodeKind !== 'session' && child.nodeKind !== 'clipboard');
  const rawSessionCategory = existing.get('session');
  const agentMigrated = (existing.get('agent')?.children ?? []).map((child) => ({ ...child, nodeKind: 'session' as NodeKind }));
  const terminalMigrated = (existing.get('terminal')?.children ?? []).map((child) => ({ ...child, nodeKind: 'session' as NodeKind }));
  const sessionChildren = rawSessionCategory
    ? rawSessionCategory.children?.map((child) => (child.nodeKind === 'agent' || child.nodeKind === 'terminal') ? { ...child, nodeKind: 'session' as NodeKind } : child) ?? []
    : [...terminalMigrated, ...agentMigrated];
  const sessionCategory = { ...(rawSessionCategory ?? categoryNode(workspace.id, 'session', [])), children: sessionChildren };
  const clipboardNode = (workspace.children ?? []).find((child) => child.type === 'tab' && child.nodeKind === 'clipboard')
    ?? createClipboardNode(workspace.id);
  const nextChildren: TreeNode[] = [
    existing.get('dashboard') ?? categoryNode(workspace.id, 'dashboard', []),
    existing.get('browser') ?? categoryNode(workspace.id, 'browser', legacyTabChildren),
    sessionCategory,
    existing.get('files') ?? categoryNode(workspace.id, 'files', []),
    clipboardNode,
  ];
  return { ...workspace, children: nextChildren };
}

export function syncWorkspaceDashboardNodes(workspace: TreeNode, widgets: readonly DashboardWidgetNodeInput[]): TreeNode {
  const normalized = ensureWorkspaceCategories(workspace);
  const existingDashboard = getWorkspaceCategory(normalized, 'dashboard');
  const existingByWidgetId = new Map(
    (existingDashboard?.children ?? [])
      .filter((child) => child.type === 'tab' && child.nodeKind === 'dashboard')
      .map((child) => [child.dashboardWidgetId ?? child.filePath ?? child.id, child]),
  );
  const widgetNodes = widgets.map((widget) => {
    const existing = existingByWidgetId.get(widget.id);
    return {
      ...(existing ?? createDashboardWidgetNode(workspace.id, widget)),
      id: `${workspace.id}:dashboard:${widget.id}`,
      name: widget.title,
      type: 'tab' as const,
      nodeKind: 'dashboard' as const,
      persisted: true,
      dashboardWidgetId: widget.id,
    };
  });
  return {
    ...normalized,
    children: (normalized.children ?? []).map((child) => (
      child.nodeKind === 'dashboard'
        ? { ...child, expanded: true, children: widgetNodes }
        : child
    )),
  };
}

export function findFirstSessionId(workspace: TreeNode): string | null {
  const category = getWorkspaceCategory(workspace, 'session');
  const first = (category?.children ?? []).find((child) => child.type === 'tab' && child.nodeKind === 'session');
  return first?.id ?? null;
}

export function listWorkspaceSessionIds(workspace: TreeNode): string[] {
  const category = getWorkspaceCategory(workspace, 'session');
  return (category?.children ?? [])
    .filter((child): child is TreeNode => child.type === 'tab' && child.nodeKind === 'session')
    .map((child) => child.id);
}

export function createWorkspaceViewEntry(workspace: TreeNode): WorkspaceViewState {
  const sessionIds = listWorkspaceSessionIds(workspace);
  return {
    openTabIds: [],
    editingFilePath: null,
    dashboardOpen: true,
    activeMode: 'agent',
    activeSessionIds: [],
    mountedSessionFsIds: sessionIds,
    panelOrder: [],
    activeArtifactPanel: null,
  };
}

export function normalizeWorkspaceViewEntry(workspace: TreeNode, entry?: WorkspaceViewState): WorkspaceViewState {
  const base = entry ?? createWorkspaceViewEntry(workspace);
  const sessionIds = listWorkspaceSessionIds(workspace);
  const requestedSessionIds = base.activeSessionIds ?? [];
  const rawIds = requestedSessionIds.filter((id) => Boolean(findNode(workspace, id)));
  const shouldFallbackToFirstSession = requestedSessionIds.length > 0;
  const firstSessionId = sessionIds[0] ?? null;
  const activeSessionIds = rawIds.length > 0
    ? rawIds
    : (shouldFallbackToFirstSession && firstSessionId ? [firstSessionId] : []);
  const requestedMountedSessionFsIds = base.mountedSessionFsIds ?? sessionIds;
  const mountedSessionFsIds = requestedMountedSessionFsIds.filter((id) => sessionIds.includes(id));
  const validOpenTabIds = (base.openTabIds ?? []).filter((id) => {
    const tab = findNode(workspace, id);
    return tab?.type === 'tab' && (tab.nodeKind ?? 'browser') === 'browser';
  });
  return {
    ...base,
    openTabIds: validOpenTabIds,
    dashboardOpen: base.dashboardOpen ?? true,
    activeSessionIds,
    mountedSessionFsIds,
    panelOrder: (base.panelOrder ?? []).filter((id) => typeof id === 'string' && id.trim().length > 0),
    activeArtifactPanel: normalizeArtifactPanelSelection(base.activeArtifactPanel),
  };
}

export function createWorkspaceViewState(root: TreeNode): Record<string, WorkspaceViewState> {
  return Object.fromEntries(
    (root.children ?? [])
      .filter((node): node is TreeNode => node.type === 'workspace')
      .map((workspace) => [workspace.id, createWorkspaceViewEntry(workspace)]),
  );
}

export function workspaceViewStateEquals(left: WorkspaceViewState, right: WorkspaceViewState): boolean {
  return left.openTabIds.length === right.openTabIds.length
    && left.openTabIds.every((id, index) => id === right.openTabIds[index])
    && left.editingFilePath === right.editingFilePath
    && left.dashboardOpen === right.dashboardOpen
    && left.activeMode === right.activeMode
    && left.activeSessionIds.length === right.activeSessionIds.length
    && left.activeSessionIds.every((id, index) => id === right.activeSessionIds[index])
    && left.mountedSessionFsIds.length === right.mountedSessionFsIds.length
    && left.mountedSessionFsIds.every((id, index) => id === right.mountedSessionFsIds[index])
    && left.panelOrder.length === right.panelOrder.length
    && left.panelOrder.every((id, index) => id === right.panelOrder[index])
    && artifactPanelSelectionEquals(left.activeArtifactPanel ?? null, right.activeArtifactPanel ?? null);
}

function normalizeArtifactPanelSelection(value: unknown): ArtifactPanelSelection | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<ArtifactPanelSelection>;
  if (typeof candidate.artifactId !== 'string') return null;
  return {
    artifactId: candidate.artifactId,
    filePath: typeof candidate.filePath === 'string' ? candidate.filePath : null,
  };
}

function artifactPanelSelectionEquals(left: ArtifactPanelSelection | null, right: ArtifactPanelSelection | null): boolean {
  if (left === null || right === null) return left === right;
  return left.artifactId === right.artifactId && (left.filePath ?? null) === (right.filePath ?? null);
}

export function renderPaneIdForNode(node: TreeNode): string | null {
  if (node.type === 'workspace') {
    return `dashboard:${node.id}`;
  }
  if (node.type === 'tab' && (node.nodeKind ?? 'browser') === 'browser') {
    return `browser:${node.id}`;
  }
  if (node.type === 'tab' && node.nodeKind === 'session') {
    return `session:${node.id}`;
  }
  if (node.type === 'tab' && node.nodeKind === 'dashboard') {
    const workspaceId = node.id.includes(':dashboard:') ? node.id.slice(0, node.id.indexOf(':dashboard:')) : node.id;
    return `dashboard:${workspaceId}`;
  }
  if (node.type === 'file' && node.filePath) {
    return `file:${node.filePath}`;
  }
  return null;
}

export function buildWorkspaceNodeMap(root: TreeNode): Map<string, string> {
  const map = new Map<string, string>();
  for (const workspace of root.children ?? []) {
    if (workspace.type !== 'workspace') continue;
    map.set(workspace.id, workspace.id);
    const stack = [...(workspace.children ?? [])];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      map.set(node.id, workspace.id);
      if (node.children?.length) stack.push(...node.children);
    }
  }
  return map;
}

export function flattenTreeFiltered(node: TreeNode, query: string, depth = 0): FlatTreeItem[] {
  const normalized = query.trim().toLowerCase();
  const children = node.children ?? [];
  if (!normalized) {
    return children.flatMap((child) => [{ node: child, depth }, ...(child.expanded && child.children ? flattenTreeFiltered(child, normalized, depth + 1) : [])]);
  }

  const filtered: FlatTreeItem[] = [];
  for (const child of children) {
    const matches = child.name.toLowerCase().includes(normalized);
    const descendants = child.children ? flattenTreeFiltered(child, normalized, depth + 1) : [];
    if (matches || descendants.length) {
      filtered.push({ node: child, depth });
      if (child.expanded && child.children) filtered.push(...descendants);
    }
  }
  return filtered;
}

export function flattenWorkspaceTreeFiltered(workspace: TreeNode, query: string): FlatTreeItem[] {
  const normalized = query.trim().toLowerCase();
  const descendants = workspace.expanded && workspace.children ? flattenTreeFiltered(workspace, normalized, 0) : [];
  if (!normalized) return descendants;
  const matches = workspace.name.toLowerCase().includes(normalized);
  if (matches) {
    return workspace.expanded && workspace.children ? flattenTreeFiltered(workspace, '', 0) : [];
  }
  return descendants;
}

export function nextWorkspaceName(root: TreeNode): string {
  const existing = new Set((root.children ?? []).map((workspace) => workspace.name));
  let index = (root.children ?? []).length + 1;
  while (existing.has(`Workspace ${index}`)) index += 1;
  return `Workspace ${index}`;
}
