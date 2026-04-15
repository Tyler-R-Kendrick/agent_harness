import type { TreeNode, WorkspaceFile } from '../types';

export const WORKSPACE_DRIVE_NAME = 'Workspace';

type TerminalBranchNode = TreeNode & { children: TreeNode[] };
type WorkspaceBranchNode = TreeNode & { children: TreeNode[] };

function createFolderNode(id: string, name: string, isDrive = false): TreeNode {
  return {
    id,
    name,
    type: 'folder',
    isDrive,
    expanded: true,
    children: [],
  };
}

function displayDriveName(segment: string): string {
  return segment === 'workspace' ? WORKSPACE_DRIVE_NAME : segment;
}

function driveSortRank(name: string): number {
  return name === WORKSPACE_DRIVE_NAME ? 0 : 1;
}

function ensureChildFolder(parent: TreeNode, id: string, name: string): WorkspaceBranchNode {
  const existing = (parent.children ?? []).find((child) => child.id === id);
  if (existing) return existing as WorkspaceBranchNode;
  const next = createFolderNode(id, name);
  parent.children = [...(parent.children ?? []), next];
  return next as WorkspaceBranchNode;
}

function sortTreeNodes(nodes: TreeNode[] | undefined): TreeNode[] {
  const children = (nodes ?? []).map((node) => node.children?.length
    ? { ...node, children: sortTreeNodes(node.children) }
    : node);
  return [...children].sort((left, right) => {
    if (left.type !== right.type) return left.type === 'folder' ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}

export function buildWorkspaceCapabilityDriveNodes(prefix: string, files: WorkspaceFile[]): TreeNode[] {
  const workspaceDrive = createFolderNode(`${prefix}:drive:workspace`, WORKSPACE_DRIVE_NAME, true);
  const directoryDrives = new Map<string, TreeNode>();

  for (const file of files) {
    const segments = file.path.split('/').filter(Boolean);
    if (!segments.length) continue;
    if (segments.length === 1) {
      workspaceDrive.children = [
        ...(workspaceDrive.children ?? []),
        { id: `${prefix}:workspace:${file.path}`, name: segments[0], type: 'file', filePath: file.path },
      ];
      continue;
    }

    const [driveSegment, ...rest] = segments;
    const driveId = `${prefix}:drive:${driveSegment}`;
    const drive = directoryDrives.get(driveSegment) ?? createFolderNode(driveId, displayDriveName(driveSegment), true);
    if (!directoryDrives.has(driveSegment)) directoryDrives.set(driveSegment, drive);

    let cursor = drive as WorkspaceBranchNode;
    for (const [index, part] of rest.entries()) {
      const isLeaf = index === rest.length - 1;
      if (isLeaf) {
        cursor.children = [
          ...(cursor.children ?? []),
          { id: `${driveId}:${rest.slice(0, index + 1).join('/')}`, name: part, type: 'file', filePath: file.path },
        ];
        continue;
      }
      cursor = ensureChildFolder(cursor, `${driveId}:${rest.slice(0, index + 1).join('/')}`, part);
    }
  }

  return [
    { ...workspaceDrive, children: sortTreeNodes(workspaceDrive.children) },
    ...[...directoryDrives.values()]
      .map((drive) => ({ ...drive, children: sortTreeNodes(drive.children) }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  ];
}

export function buildMountedTerminalDriveNodes(prefix: string, paths: string[]): TreeNode[] {
  const drives = new Map<string, TreeNode>();

  for (const rawPath of paths) {
    const segments = rawPath.replace(/^\/+/, '').split('/').filter(Boolean);
    if (!segments.length) continue;

    const [driveSegment, ...rest] = segments;
    const driveId = `${prefix}:drive:${driveSegment}`;
    const drive = drives.get(driveSegment) ?? createFolderNode(driveId, displayDriveName(driveSegment), true);
    if (!drives.has(driveSegment)) drives.set(driveSegment, drive);
    if (!rest.length) continue;

    let cursor = drive as TerminalBranchNode;
    for (const [index, part] of rest.entries()) {
      const nodeId = `${driveId}:${rest.slice(0, index + 1).join('/')}`;
      const existing = (cursor.children ?? []).find((child) => child.id === nodeId);
      if (existing) {
        cursor = existing as TerminalBranchNode;
        continue;
      }
      const next = createFolderNode(nodeId, part);
      cursor.children = [...(cursor.children ?? []), next];
      cursor = next as TerminalBranchNode;
    }
  }

  return [...drives.values()]
    .map((drive) => ({ ...drive, children: sortTreeNodes(drive.children) }))
    .sort((left, right) => driveSortRank(left.name) - driveSortRank(right.name) || left.name.localeCompare(right.name));
}