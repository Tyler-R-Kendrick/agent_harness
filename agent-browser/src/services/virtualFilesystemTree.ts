import type { TreeNode, WorkspaceFile } from '../types';
import { ARTIFACTS_DRIVE_NAME, type AgentArtifact } from './artifacts';

export const WORKSPACE_DRIVE_NAME = '//workspace';
export { ARTIFACTS_DRIVE_NAME } from './artifacts';

type TerminalBranchNode = TreeNode & { children: TreeNode[] };
type WorkspaceBranchNode = TreeNode & { children: TreeNode[] };
type ArtifactBranchNode = TreeNode & { children: TreeNode[] };

function createFolderNode(id: string, name: string, isDrive = false): TreeNode {
  return {
    id,
    name,
    type: 'folder',
    isDrive,
    expanded: false,
    children: [],
  };
}

function inferNodeKind(paths: string[], fullPath: string): 'file' | 'folder' {
  if (paths.some((other) => other !== fullPath && other.startsWith(`${fullPath}/`))) return 'folder';
  return /\.[^/]+$/.test(fullPath) ? 'file' : 'folder';
}

export function normalizeDriveName(segment: string): string {
  return segment.toLowerCase();
}

function displayDriveName(segment: string): string {
  return `//${normalizeDriveName(segment)}`;
}

function normalizeWorkspaceReferencePath(path: string): string | undefined {
  const trimmed = path.trim();
  if (!trimmed) return undefined;

  const driveStyleMatch = trimmed.match(/^\/\/([^/]+)\/(.+)$/);
  if (driveStyleMatch) {
    const [, driveSegment, rest] = driveStyleMatch;
    const normalizedRest = rest.replace(/^\/+/, '');
    if (!normalizedRest) return undefined;
    return driveSegment === 'workspace'
      ? normalizedRest
      : `${driveSegment}/${normalizedRest}`;
  }

  const normalized = trimmed.replace(/^\/+/, '');
  return normalized || undefined;
}

function parseWorkspaceReferencePath(content?: string): string | undefined {
  if (!content) return undefined;

  if (content.startsWith('workspace://')) {
    return normalizeWorkspaceReferencePath(content.slice('workspace://'.length));
  }

  const arrowMatch = content.match(/^(?:->|→)\s*(.+)$/);
  if (!arrowMatch) return undefined;

  const rawTarget = arrowMatch[1]?.trim() ?? '';
  if (!rawTarget.startsWith('//')) return undefined;
  return normalizeWorkspaceReferencePath(rawTarget);
}

function driveSortRank(name: string): number {
  return (name === WORKSPACE_DRIVE_NAME || name === 'workspace') ? 0 : 1;
}

function ensureChildFolder(parent: TreeNode, id: string, name: string): WorkspaceBranchNode {
  const existing = (parent.children ?? []).find((child) => child.id === id);
  if (existing) return existing as WorkspaceBranchNode;
  const next = createFolderNode(id, name);
  parent.children = [...(parent.children ?? []), next];
  return next as WorkspaceBranchNode;
}

function appendWorkspacePath(parent: WorkspaceBranchNode, idPrefix: string, parts: string[], filePath: string): void {
  let cursor = parent;
  for (const [index, part] of parts.entries()) {
    const nodeId = `${idPrefix}:${parts.slice(0, index + 1).join('/')}`;
    const isLeaf = index === parts.length - 1;
    if (isLeaf) {
      cursor.children = [
        ...(cursor.children ?? []),
        { id: nodeId, name: part, type: 'file', filePath },
      ];
      return;
    }
    cursor = ensureChildFolder(cursor, nodeId, part);
  }
}

function appendArtifactPath(parent: ArtifactBranchNode, idPrefix: string, artifactId: string, parts: string[], filePath: string): void {
  let cursor = parent;
  for (const [index, part] of parts.entries()) {
    const nodeId = `${idPrefix}:file:${parts.slice(0, index + 1).join('/')}`;
    const isLeaf = index === parts.length - 1;
    if (isLeaf) {
      cursor.children = [
        ...(cursor.children ?? []),
        { id: nodeId, name: part, type: 'file', artifactId, artifactFilePath: filePath },
      ];
      return;
    }
    cursor = ensureChildFolder(cursor, nodeId, part) as ArtifactBranchNode;
  }
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
    const [rawDriveSegment, ...rest] = segments;

    if (segments.length === 1 || rawDriveSegment.startsWith('.')) {
      appendWorkspacePath(workspaceDrive as WorkspaceBranchNode, `${prefix}:workspace`, segments, file.path);
      continue;
    }

    const driveSegment = normalizeDriveName(rawDriveSegment);
    const driveId = `${prefix}:drive:${driveSegment}`;
    const drive = directoryDrives.get(driveSegment) ?? createFolderNode(driveId, displayDriveName(driveSegment), true);
    if (!directoryDrives.has(driveSegment)) directoryDrives.set(driveSegment, drive);

    appendWorkspacePath(drive as WorkspaceBranchNode, driveId, rest, file.path);
  }

  return [
    { ...workspaceDrive, children: sortTreeNodes(workspaceDrive.children) },
    ...[...directoryDrives.values()]
      .map((drive) => ({ ...drive, children: sortTreeNodes(drive.children) }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  ];
}

export function buildArtifactDriveNodes(prefix: string, artifacts: readonly AgentArtifact[]): TreeNode[] {
  const artifactDrive = createFolderNode(`${prefix}:drive:artifacts`, ARTIFACTS_DRIVE_NAME, true);
  const byId = new Map(artifacts.map((artifact) => [artifact.id, artifact]));

  for (const artifact of [...artifacts].sort((left, right) => left.title.localeCompare(right.title))) {
    const artifactNode = createFolderNode(`${prefix}:artifact:${artifact.id}`, artifact.title || artifact.id);
    artifactNode.artifactId = artifact.id;

    if (artifact.references.length) {
      const referencesNode = createFolderNode(`${prefix}:artifact:${artifact.id}:references`, 'References');
      referencesNode.artifactId = artifact.id;
      referencesNode.children = artifact.references
        .map((referenceId) => ({
          id: `${prefix}:artifact:${artifact.id}:reference:${referenceId}`,
          name: byId.get(referenceId)?.title ?? referenceId,
          type: 'file' as const,
          artifactId: referenceId,
          artifactReferenceId: referenceId,
          isReference: true,
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
      artifactNode.children = [...(artifactNode.children ?? []), referencesNode];
    }

    for (const file of artifact.files) {
      appendArtifactPath(
        artifactNode as ArtifactBranchNode,
        `${prefix}:artifact:${artifact.id}`,
        artifact.id,
        file.path.split('/').filter(Boolean),
        file.path,
      );
    }

    artifactDrive.children = [
      ...(artifactDrive.children ?? []),
      { ...artifactNode, children: sortTreeNodes(artifactNode.children) },
    ];
  }

  return [{ ...artifactDrive, children: sortTreeNodes(artifactDrive.children) }];
}

export function buildMountedTerminalDriveNodes(
  prefix: string,
  paths: string[],
  fileContents?: Record<string, string>,
): TreeNode[] {
  const drives = new Map<string, TreeNode>();

  for (const rawPath of paths) {
    const segments = rawPath.replace(/^\/+/, '').split('/').filter(Boolean);
    if (!segments.length) continue;

    const [rawDriveSegment, ...rest] = segments;
    const driveSegment = normalizeDriveName(rawDriveSegment);
    const driveId = `${prefix}:drive:${driveSegment}`;
    const drive = drives.get(driveSegment) ?? createFolderNode(driveId, driveSegment, false);
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

      const isLastSegment = index === rest.length - 1;
      if (!isLastSegment) {
        const next = createFolderNode(nodeId, part);
        cursor.children = [...(cursor.children ?? []), next];
        cursor = next as TerminalBranchNode;
        continue;
      }

      const fullPath = `/${rawDriveSegment}/${rest.slice(0, index + 1).join('/')}`;
      const nodeKind = inferNodeKind(paths, fullPath);
      if (nodeKind === 'file') {
        const content = fileContents?.[fullPath];
        const filePath = parseWorkspaceReferencePath(content);
        cursor.children = [...(cursor.children ?? []), {
          id: nodeId,
          name: part,
          type: 'file',
          ...(filePath ? { filePath, isReference: true } : {}),
        }];
      } else {
        const next = createFolderNode(nodeId, part);
        cursor.children = [...(cursor.children ?? []), next];
        cursor = next as TerminalBranchNode;
      }
    }
  }

  return [...drives.values()]
    .map((drive) => ({ ...drive, children: sortTreeNodes(drive.children) }))
    .sort((left, right) => driveSortRank(left.name) - driveSortRank(right.name) || left.name.localeCompare(right.name));
}
