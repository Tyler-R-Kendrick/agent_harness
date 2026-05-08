import type { TreeNode, WorkspaceFile } from '../types';
import {
  WORKSPACE_COLORS,
  createWorkspaceNode,
  createWorkspaceViewEntry,
  flattenTabs,
  listWorkspaceSessionIds,
  totalMemoryMB,
  type WorkspaceViewState,
} from './workspaceTree';

export type ProjectSummary = {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  sessionCount: number;
  browserPageCount: number;
  fileCount: number;
  memoryMB: number;
  previewItems: string[];
};

export type CreatedProjectWorkspace = {
  workspace: TreeNode;
  viewState: WorkspaceViewState;
};

const DEFAULT_PROJECT_COLOR = WORKSPACE_COLORS[0];

export function summarizeProject(
  workspace: TreeNode,
  activeProjectId: string,
  workspaceFiles: WorkspaceFile[],
): ProjectSummary {
  const browserPages = flattenTabs(workspace, 'browser');
  const storedFileCount = workspaceFiles.length;
  const treeFileCount = countFileNodes(workspace);
  return {
    id: workspace.id,
    name: workspace.name,
    color: workspace.color ?? DEFAULT_PROJECT_COLOR,
    isActive: workspace.id === activeProjectId,
    sessionCount: listWorkspaceSessionIds(workspace).length,
    browserPageCount: browserPages.length,
    fileCount: storedFileCount + treeFileCount,
    memoryMB: totalMemoryMB(workspace),
    previewItems: browserPages.slice(0, 3).map((tab) => tab.name),
  };
}

export function listProjectSummaries(
  root: TreeNode,
  activeProjectId: string,
  workspaceFilesByWorkspace: Record<string, WorkspaceFile[]>,
): ProjectSummary[] {
  return (root.children ?? [])
    .filter((node) => node.type === 'workspace')
    .map((workspace) => summarizeProject(workspace, activeProjectId, workspaceFilesByWorkspace[workspace.id] ?? []));
}

export function nextProjectName(root: TreeNode): string {
  const workspaces = root.children ?? [];
  const existing = new Set(workspaces.map((workspace) => workspace.name));
  let index = workspaces.length + 1;
  while (existing.has(`Project ${index}`)) index += 1;
  return `Project ${index}`;
}

export function nextProjectColor(root: TreeNode): string {
  return WORKSPACE_COLORS[(root.children ?? []).length % WORKSPACE_COLORS.length];
}

export function createProjectWorkspace({
  root,
  id,
  color,
}: {
  root: TreeNode;
  id: string;
  color: string;
}): CreatedProjectWorkspace {
  const workspace = createWorkspaceNode({
    id,
    name: nextProjectName(root),
    color,
    browserTabs: [],
  });
  return {
    workspace,
    viewState: createWorkspaceViewEntry(workspace),
  };
}

function countFileNodes(node: TreeNode): number {
  return (node.type === 'file' ? 1 : 0)
    + (node.children ?? []).reduce((count, child) => count + countFileNodes(child), 0);
}
