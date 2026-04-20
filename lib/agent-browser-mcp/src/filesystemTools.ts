import { ModelContext } from '../../webmcp/src/index';

import type {
  RegisterWorkspaceToolsOptions,
  WorkspaceMcpFile,
  WorkspaceMcpFilesystemEntry,
  WorkspaceMcpFilesystemEntryKind,
  WorkspaceMcpFilesystemProperties,
  WorkspaceMcpFilesystemTargetType,
  WorkspaceMcpSessionDrive,
  WorkspaceMcpSessionFsEntry,
} from './workspaceToolTypes';
import {
  basename,
  detectMimeType,
  isPlainObject,
  normalizeSessionFsPath,
  resolveSessionFsLocationPath,
  resolveSessionFsPathInput,
  normalizeWorkspaceFilePath,
  parentPath,
  requireCallback,
  toWorkspaceFileUri,
} from './workspaceToolShared';

type FilesystemTargetInput = {
  targetType?: string;
  path?: string;
  sessionId?: string;
};

type FilesystemListInput = {
  targetType?: string;
  kind?: string;
  parentPath?: string;
  query?: string;
  sessionId?: string;
  includeUnmounted?: boolean;
};

type NormalizedFilesystemOptions = RegisterWorkspaceToolsOptions & {
  sessionDrives: readonly WorkspaceMcpSessionDrive[];
  sessionFsEntries: readonly WorkspaceMcpSessionFsEntry[];
};

type FilesystemMountInput = {
  action?: string;
  sessionId?: string;
};

type FilesystemAddInput = FilesystemTargetInput & {
  action?: string;
  kind?: string;
  sourcePath?: string;
  sourceType?: string;
  content?: string;
};

type FilesystemUpdateInput = FilesystemTargetInput & {
  action?: string;
  nextPath?: string;
  newName?: string;
  content?: string;
};

type FilesystemRollbackInput = FilesystemTargetInput & {
  recordId?: string;
};

const KIND_RANK: Record<WorkspaceMcpFilesystemEntryKind, number> = {
  drive: 0,
  folder: 1,
  file: 2,
};

const textEncoder = new TextEncoder();

function byteLength(value: string): number {
  return textEncoder.encode(value).length;
}

function normalizeWorkspaceDrivePath(path: string): string {
  const trimmed = path.trim().replace(/\/+$/, '');
  const driveName = trimmed.replace(/^\/+/, '').trim();
  if (!driveName) {
    throw new TypeError('Workspace drive path must not be empty.');
  }

  return `//${driveName}`;
}

function isWorkspaceDrivePath(path: string): boolean {
  return path.startsWith('//');
}

function normalizeWorkspaceTargetPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new TypeError('Workspace filesystem path must not be empty.');
  }

  return isWorkspaceDrivePath(trimmed) ? normalizeWorkspaceDrivePath(trimmed) : normalizeWorkspaceFilePath(trimmed);
}

function normalizeTargetType(targetType: unknown): WorkspaceMcpFilesystemTargetType {
  if (targetType === 'workspace-file' || targetType === 'session-drive' || targetType === 'session-fs-entry') {
    return targetType;
  }

  throw new TypeError('Filesystem targetType must be one of workspace-file, session-drive, or session-fs-entry.');
}

function normalizeTargetInput(sessionDrives: readonly WorkspaceMcpSessionDrive[], input: FilesystemTargetInput): {
  targetType: WorkspaceMcpFilesystemTargetType;
  path?: string;
  sessionId?: string;
} {
  const targetType = normalizeTargetType(input.targetType);

  if (targetType === 'session-drive') {
    const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';
    if (!sessionId) {
      throw new TypeError('Filesystem target must include a sessionId.');
    }
    return { targetType, sessionId };
  }

  const path = typeof input.path === 'string'
    ? (targetType === 'workspace-file' ? normalizeWorkspaceTargetPath(input.path) : normalizeSessionFsPath(input.path))
    : '';
  if (!path) {
    throw new TypeError('Filesystem target must include a path.');
  }

  if (targetType === 'session-fs-entry') {
    const resolved = resolveSessionFsPathInput(sessionDrives, { sessionId: input.sessionId, path });
    return { targetType, path: resolved.path, sessionId: resolved.sessionId };
  }

  return { targetType, path };
}

function resolveSessionFsWorkspaceSymlinkPath(
  sessionFsEntries: readonly WorkspaceMcpSessionFsEntry[],
  sessionId: string,
  targetPath: string,
  sourceBasename: string,
): string {
  const normalizedTargetPath = normalizeSessionFsPath(targetPath);
  const existingTarget = sessionFsEntries.find((entry) =>
    entry.sessionId === sessionId && normalizeSessionFsPath(entry.path) === normalizedTargetPath,
  );

  if (existingTarget?.kind === 'folder' || normalizedTargetPath === '/workspace') {
    return normalizeSessionFsPath(`${normalizedTargetPath}/${sourceBasename}`);
  }

  const targetDir = normalizedTargetPath.slice(0, normalizedTargetPath.lastIndexOf('/'));
  return normalizeSessionFsPath(targetDir ? `${targetDir}/${sourceBasename}` : `/${sourceBasename}`);
}

function toWorkspaceFileEntry(file: WorkspaceMcpFile): WorkspaceMcpFilesystemEntry {
  return {
    targetType: 'workspace-file',
    kind: 'file',
    label: basename(file.path),
    path: file.path,
    uri: toWorkspaceFileUri(file.path),
    updatedAt: file.updatedAt,
  };
}

function deriveWorkspaceEntries(workspaceFiles: readonly WorkspaceMcpFile[]): WorkspaceMcpFilesystemEntry[] {
  const drives = new Set<string>();
  const folders = new Set<string>();
  let hasWorkspaceDrive = false;

  for (const file of workspaceFiles) {
    const segments = file.path.split('/').filter(Boolean);
    if (segments.length <= 1) {
      hasWorkspaceDrive = hasWorkspaceDrive || segments.length === 1;
      continue;
    }

    drives.add(segments[0]!);
    for (let depth = 2; depth < segments.length; depth += 1) {
      folders.add(segments.slice(0, depth).join('/'));
    }
  }

  const driveEntries: WorkspaceMcpFilesystemEntry[] = [
    ...(hasWorkspaceDrive ? [{
      targetType: 'workspace-file' as const,
      kind: 'drive' as const,
      label: '//workspace',
      path: '//workspace',
    }] : []),
    ...Array.from(drives).sort().map((drive) => ({
      targetType: 'workspace-file' as const,
      kind: 'drive' as const,
      label: `//${drive}`,
      path: `//${drive}`,
    })),
  ];
  const folderEntries = Array.from(folders).sort().map((path) => ({
    targetType: 'workspace-file' as const,
    kind: 'folder' as const,
    label: basename(path),
    path,
  }));
  const fileEntries = [...workspaceFiles].sort((left, right) => left.path.localeCompare(right.path)).map(toWorkspaceFileEntry);

  return [...driveEntries, ...folderEntries, ...fileEntries];
}

function workspaceEntryParentPath(entry: WorkspaceMcpFilesystemEntry): string | null {
  if (entry.targetType !== 'workspace-file' || !entry.path || entry.kind === 'drive') {
    return null;
  }

  const segments = entry.path.split('/').filter(Boolean);
  if (entry.kind === 'file' && segments.length === 1) {
    return '//workspace';
  }
  if (segments.length === 2) {
    return `//${segments[0]}`;
  }

  return segments.slice(0, -1).join('/');
}

function toSessionDriveEntry(entry: WorkspaceMcpSessionDrive): WorkspaceMcpFilesystemEntry {
  return {
    targetType: 'session-drive',
    kind: 'drive',
    sessionId: entry.sessionId,
    label: entry.label,
    mounted: entry.mounted,
  };
}

function toSessionFsEntry(entry: WorkspaceMcpSessionFsEntry): WorkspaceMcpFilesystemEntry {
  const path = normalizeSessionFsPath(entry.path);
  return {
    targetType: 'session-fs-entry',
    sessionId: entry.sessionId,
    path,
    kind: entry.kind,
    label: basename(path),
    isRoot: Boolean(entry.isRoot),
  };
}

function sortFilesystemEntries(entries: WorkspaceMcpFilesystemEntry[]): WorkspaceMcpFilesystemEntry[] {
  return [...entries].sort((left, right) => {
    const sessionCompare = (left.sessionId ?? '').localeCompare(right.sessionId ?? '');
    if (sessionCompare) {
      return sessionCompare;
    }

    const kindCompare = KIND_RANK[left.kind] - KIND_RANK[right.kind];
    if (kindCompare) {
      return kindCompare;
    }

    const leftPath = left.path ?? left.label;
    const rightPath = right.path ?? right.label;
    if (leftPath !== rightPath) {
      return leftPath.localeCompare(rightPath);
    }

    return left.label.localeCompare(right.label);
  });
}

function resolveWorkspaceTarget(workspaceFiles: readonly WorkspaceMcpFile[], rawPath: string): {
  entry: WorkspaceMcpFilesystemEntry;
  file?: WorkspaceMcpFile;
  descendants?: WorkspaceMcpFile[];
} {
  const path = normalizeWorkspaceTargetPath(rawPath);
  const files = workspaceFiles.map((file) => ({ ...file, path: normalizeWorkspaceFilePath(file.path) }));

  if (isWorkspaceDrivePath(path)) {
    const driveName = path.slice(2);
    const descendants = driveName === 'workspace'
      ? files.filter((file) => !file.path.includes('/'))
      : files.filter((file) => file.path.startsWith(`${driveName}/`));
    if (!descendants.length) {
      throw new DOMException(`Workspace filesystem path "${path}" is not available.`, 'NotFoundError');
    }
    return {
      entry: { targetType: 'workspace-file', kind: 'drive', label: path, path },
      descendants,
    };
  }

  const file = files.find((candidate) => candidate.path === path);
  if (file) {
    return { entry: toWorkspaceFileEntry(file), file };
  }

  const descendants = files.filter((candidate) => candidate.path.startsWith(`${path}/`));
  if (descendants.length) {
    return {
      entry: { targetType: 'workspace-file', kind: 'folder', label: basename(path), path },
      descendants,
    };
  }

  throw new DOMException(`Workspace filesystem path "${path}" is not available.`, 'NotFoundError');
}

function resolveSessionDrive(sessionDrives: readonly WorkspaceMcpSessionDrive[], sessionId: string): WorkspaceMcpSessionDrive {
  const drive = sessionDrives.find((candidate) => candidate.sessionId === sessionId);
  if (!drive) {
    throw new DOMException(`Session drive "${sessionId}" is not available.`, 'NotFoundError');
  }

  return drive;
}

function resolveSessionFsTarget(sessionFsEntries: readonly WorkspaceMcpSessionFsEntry[], sessionId: string, path: string): WorkspaceMcpSessionFsEntry {
  const normalizedPath = normalizeSessionFsPath(path);
  const entry = sessionFsEntries.find((candidate) => candidate.sessionId === sessionId && normalizeSessionFsPath(candidate.path) === normalizedPath);
  if (!entry) {
    throw new DOMException(`Session filesystem path "${normalizedPath}" is not available in ${sessionId}.`, 'NotFoundError');
  }

  return { ...entry, path: normalizedPath };
}

function countWorkspaceChildren(workspaceFiles: readonly WorkspaceMcpFile[], parent: string): number {
  const entries = deriveWorkspaceEntries(workspaceFiles).filter((entry) => entry.kind !== 'drive');
  return entries.filter((entry) => workspaceEntryParentPath(entry) === parent).length;
}

function countSessionFsChildren(entries: readonly WorkspaceMcpSessionFsEntry[], sessionId: string, path: string): number {
  const normalizedPath = normalizeSessionFsPath(path);
  return entries
    .filter((entry) => entry.sessionId === sessionId)
    .map((entry) => normalizeSessionFsPath(entry.path))
    .filter((entryPath) => entryPath !== normalizedPath && parentPath(entryPath) === normalizedPath)
    .length;
}

function filterByParent(
  entries: WorkspaceMcpFilesystemEntry[],
  sessionDrives: readonly WorkspaceMcpSessionDrive[],
  rawParentPath: string,
): WorkspaceMcpFilesystemEntry[] {
  const resolvedSessionParent = resolveSessionFsLocationPath(sessionDrives, rawParentPath);
  const normalizedWorkspaceParent = resolvedSessionParent
    ? null
    : rawParentPath.startsWith('//')
      ? normalizeWorkspaceDrivePath(rawParentPath)
      : normalizeWorkspaceFilePath(rawParentPath);
  const normalizedSessionParent = resolvedSessionParent?.path ?? (rawParentPath.startsWith('//') ? null : normalizeSessionFsPath(rawParentPath));

  return entries.filter((entry) => {
    if (entry.targetType === 'workspace-file' && normalizedWorkspaceParent) {
      return workspaceEntryParentPath(entry) === normalizedWorkspaceParent;
    }
    if (entry.targetType === 'session-fs-entry' && entry.path && normalizedSessionParent) {
      return parentPath(entry.path) === normalizedSessionParent
        && (!resolvedSessionParent || entry.sessionId === resolvedSessionParent.sessionId);
    }
    return false;
  });
}

function matchesQuery(entry: WorkspaceMcpFilesystemEntry, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [entry.label, entry.path ?? '', entry.sessionId ?? '']
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

function listFilesystemEntries(options: NormalizedFilesystemOptions, input: FilesystemListInput): WorkspaceMcpFilesystemEntry[] {
  const workspaceEntries = deriveWorkspaceEntries(options.workspaceFiles);
  const driveEntries = options.sessionDrives.map(toSessionDriveEntry);
  const sessionEntries = options.sessionFsEntries.map(toSessionFsEntry);

  let entries = [...workspaceEntries, ...driveEntries, ...sessionEntries];

  if (input.targetType) {
    const targetType = normalizeTargetType(input.targetType);
    entries = entries.filter((entry) => entry.targetType === targetType);
  }
  if (input.sessionId) {
    entries = entries.filter((entry) => entry.sessionId === input.sessionId);
  }
  if (input.kind === 'drive' || input.kind === 'folder' || input.kind === 'file') {
    entries = entries.filter((entry) => entry.kind === input.kind);
  }
  if (typeof input.parentPath === 'string' && input.parentPath.trim()) {
    entries = filterByParent(entries, options.sessionDrives, input.parentPath.trim());
  }
  if (typeof input.query === 'string') {
    entries = entries.filter((entry) => matchesQuery(entry, input.query!));
  }

  return sortFilesystemEntries(entries);
}

function buildFilesystemProperties(options: NormalizedFilesystemOptions, input: {
  targetType: WorkspaceMcpFilesystemTargetType;
  path?: string;
  sessionId?: string;
}): WorkspaceMcpFilesystemProperties {
  const sessionDrives = options.sessionDrives;
  const sessionFsEntries = options.sessionFsEntries;

  if (input.targetType === 'session-drive') {
    const drive = resolveSessionDrive(sessionDrives, input.sessionId!);
    return {
      targetType: 'session-drive',
      kind: 'drive',
      sessionId: drive.sessionId,
      label: drive.label,
      mounted: drive.mounted,
      childCount: sessionFsEntries.filter((entry) => entry.sessionId === drive.sessionId).length,
    };
  }

  if (input.targetType === 'session-fs-entry') {
    const entry = resolveSessionFsTarget(sessionFsEntries, input.sessionId!, input.path!);
    return entry.kind === 'file'
      ? {
          targetType: 'session-fs-entry',
          kind: 'file',
          sessionId: entry.sessionId,
          label: basename(entry.path),
          path: entry.path,
          sizeBytes: typeof entry.content === 'string' ? byteLength(entry.content) : null,
          preview: typeof entry.content === 'string' ? entry.content : null,
        }
      : {
          targetType: 'session-fs-entry',
          kind: 'folder',
          sessionId: entry.sessionId,
          label: basename(entry.path),
          path: entry.path,
          childCount: countSessionFsChildren(sessionFsEntries, entry.sessionId, entry.path),
          isRoot: Boolean(entry.isRoot),
        };
  }

  const resolved = resolveWorkspaceTarget(options.workspaceFiles, input.path!);
  if (resolved.file) {
    return {
      targetType: 'workspace-file',
      kind: 'file',
      label: basename(resolved.file.path),
      path: resolved.file.path,
      uri: toWorkspaceFileUri(resolved.file.path),
      mimeType: detectMimeType(resolved.file.path),
      updatedAt: resolved.file.updatedAt,
      sizeBytes: byteLength(resolved.file.content),
      preview: resolved.file.content,
    };
  }

  const descendantFiles = resolved.descendants!;
  return {
    ...resolved.entry,
    childCount: countWorkspaceChildren(options.workspaceFiles, resolved.entry.path!),
    updatedAt: descendantFiles.map((file) => file.updatedAt).sort().at(-1),
  };
}

function toMutationResult(action: string, payload: {
  targetType: WorkspaceMcpFilesystemTargetType;
  kind: WorkspaceMcpFilesystemEntryKind;
  path?: string;
  sessionId?: string;
  previousPath?: string;
  content?: string;
  deleted?: boolean;
  mounted?: boolean;
  label?: string;
}, result: unknown) {
  const base: Record<string, unknown> = {
    action,
    targetType: payload.targetType,
    kind: payload.kind,
    ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
    ...(payload.path ? { path: payload.path } : {}),
    ...(payload.previousPath ? { previousPath: payload.previousPath } : {}),
    ...(payload.content !== undefined ? { content: payload.content } : {}),
    ...(payload.deleted ? { deleted: true } : {}),
    ...(payload.mounted !== undefined ? { mounted: payload.mounted } : {}),
    ...(payload.label ? { label: payload.label } : {}),
  };
  const uri = payload.targetType === 'workspace-file' && payload.kind === 'file' && payload.path
    ? { uri: toWorkspaceFileUri(payload.path) }
    : {};

  return isPlainObject(result)
    ? { ...result, ...base, ...uri }
    : { ...base, ...uri };
}

async function readSessionFileContent(
  entries: readonly WorkspaceMcpSessionFsEntry[],
  onReadSessionFsFile: RegisterWorkspaceToolsOptions['onReadSessionFsFile'],
  sessionId: string,
  path: string,
): Promise<string> {
  const entry = resolveSessionFsTarget(entries, sessionId, path);
  if (entry.kind !== 'file') {
    throw new TypeError(`Session filesystem path "${entry.path}" is not a file.`);
  }
  if (typeof entry.content === 'string') {
    return entry.content;
  }

  const reader = requireCallback(onReadSessionFsFile, `Reading session filesystem file "${entry.path}" is not supported.`);
  const result = await reader({ sessionId, path: entry.path });
  if (isPlainObject(result) && typeof result.content === 'string') {
    return result.content;
  }

  return '';
}

export function registerFilesystemTools(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    workspaceName,
    sessionDrives = [],
    sessionFsEntries = [],
    onCreateWorkspaceFile,
    onWriteWorkspaceFile,
    onDeleteWorkspaceFile,
    onMoveWorkspaceFile,
    onDuplicateWorkspaceFile,
    onSymlinkWorkspaceFile,
    onMountSessionDrive,
    onUnmountSessionDrive,
    onCreateSessionFsEntry,
    onReadSessionFsFile,
    onWriteSessionFsFile,
    onDeleteSessionFsEntry,
    onRenameSessionFsEntry,
    getFilesystemHistory,
    onRollbackFilesystemHistory,
    getFilesystemProperties,
    signal,
  } = options;

  const sessionDriveMountState = new Map(sessionDrives.map((entry) => [entry.sessionId, entry.mounted]));
  const readSessionDrives = () => sessionDrives.map((entry) => ({
    ...entry,
    mounted: sessionDriveMountState.get(entry.sessionId)!,
  }));

  modelContext.registerTool({
    name: 'list_filesystem_entries',
    title: 'List filesystem entries',
    description: `List or search files, folders, and drives available in the ${workspaceName} workspace Files surface.`,
    inputSchema: {
      type: 'object',
      properties: {
        targetType: { type: 'string', enum: ['workspace-file', 'session-drive', 'session-fs-entry'] },
        kind: { type: 'string', enum: ['drive', 'folder', 'file'] },
        parentPath: { type: 'string' },
        query: { type: 'string' },
        sessionId: { type: 'string' },
        includeUnmounted: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    execute: async (input: object) => listFilesystemEntries({
      ...options,
      sessionDrives: readSessionDrives(),
      sessionFsEntries,
    }, input as FilesystemListInput),
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'read_filesystem_properties',
    title: 'Read filesystem properties',
    description: `Read properties for a file, folder, or drive in the ${workspaceName} workspace Files surface.`,
    inputSchema: {
      type: 'object',
      properties: {
        targetType: { type: 'string', enum: ['workspace-file', 'session-drive', 'session-fs-entry'] },
        path: { type: 'string' },
        sessionId: { type: 'string' },
      },
      required: ['targetType'],
      additionalProperties: false,
    },
    execute: async (input: object) => {
      const target = normalizeTargetInput(readSessionDrives(), input as FilesystemTargetInput);
      return getFilesystemProperties?.(target) ?? buildFilesystemProperties({
        ...options,
        sessionDrives: readSessionDrives(),
        sessionFsEntries,
      }, target);
    },
    annotations: { readOnlyHint: true },
  }, { signal });

  if (getFilesystemHistory) {
    modelContext.registerTool({
      name: 'read_filesystem_history',
      title: 'Read filesystem history',
      description: `Read history records for a file, folder, or drive in the ${workspaceName} workspace Files surface.`,
      inputSchema: {
        type: 'object',
        properties: {
          targetType: { type: 'string', enum: ['workspace-file', 'session-drive', 'session-fs-entry'] },
          path: { type: 'string' },
          sessionId: { type: 'string' },
        },
        required: ['targetType'],
        additionalProperties: false,
      },
      execute: async (input: object) => getFilesystemHistory(normalizeTargetInput(readSessionDrives(), input as FilesystemTargetInput)) ?? { records: [] },
      annotations: { readOnlyHint: true },
    }, { signal });
  }

  if (onRollbackFilesystemHistory) {
    modelContext.registerTool({
      name: 'rollback_filesystem_history',
      title: 'Rollback filesystem history',
      description: `Rollback a file, folder, or drive in the ${workspaceName} workspace Files surface to a specific history record.`,
      inputSchema: {
        type: 'object',
        properties: {
          targetType: { type: 'string', enum: ['workspace-file', 'session-drive', 'session-fs-entry'] },
          path: { type: 'string' },
          sessionId: { type: 'string' },
          recordId: { type: 'string' },
        },
        required: ['targetType', 'recordId'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const rollbackInput = input as FilesystemRollbackInput;
        const recordId = typeof rollbackInput.recordId === 'string'
          ? rollbackInput.recordId.trim()
          : '';
        if (!recordId) {
          throw new TypeError('Filesystem rollback requires a recordId.');
        }
        const target = normalizeTargetInput(readSessionDrives(), input as FilesystemRollbackInput);
        return await onRollbackFilesystemHistory({ ...target, recordId }) ?? { ...target, rolledBackToId: recordId, records: [] };
      },
    }, { signal });
  }

  if (sessionDrives.length > 0 || onMountSessionDrive || onUnmountSessionDrive) {
    modelContext.registerTool({
      name: 'change_filesystem_mount',
      title: 'Change filesystem mount',
      description: 'Mount or unmount a session-backed virtual drive in the workspace Files surface.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['mount', 'unmount'] },
          sessionId: { type: 'string' },
        },
        required: ['action', 'sessionId'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as FilesystemMountInput;
        const sessionId = typeof typedInput.sessionId === 'string' ? typedInput.sessionId.trim() : '';
        if (!sessionId) {
          throw new TypeError('Filesystem mount changes require a sessionId.');
        }
        if (typedInput.action !== 'mount' && typedInput.action !== 'unmount') {
          throw new TypeError('Filesystem mount changes require action to be "mount" or "unmount".');
        }

        const drive = sessionDrives.find((entry) => entry.sessionId === sessionId);
        const result = typedInput.action === 'mount'
          ? await requireCallback(onMountSessionDrive, `Mounting session drive "${sessionId}" is not supported.`)(sessionId)
          : await requireCallback(onUnmountSessionDrive, `Unmounting session drive "${sessionId}" is not supported.`)(sessionId);

        sessionDriveMountState.set(sessionId, typedInput.action === 'mount');

        return toMutationResult(typedInput.action, {
          targetType: 'session-drive',
          kind: 'drive',
          sessionId,
          label: drive?.label ?? sessionId,
          mounted: typedInput.action === 'mount',
        }, result);
      },
    }, { signal });
  }

  if (onCreateWorkspaceFile || onDuplicateWorkspaceFile || onSymlinkWorkspaceFile || onCreateSessionFsEntry) {
    modelContext.registerTool({
      name: 'add_filesystem_entry',
      title: 'Add filesystem entry',
      description: 'Create, duplicate, or symlink a file or folder in the workspace Files surface.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'duplicate', 'symlink'] },
          targetType: { type: 'string', enum: ['workspace-file', 'session-fs-entry'] },
          sessionId: { type: 'string' },
          kind: { type: 'string', enum: ['file', 'folder'] },
          path: { type: 'string' },
          sourcePath: { type: 'string' },
          sourceType: { type: 'string', enum: ['workspace-file'] },
          content: { type: 'string' },
        },
        required: ['action', 'targetType', 'kind', 'path'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as FilesystemAddInput;
        if (typedInput.action !== 'create' && typedInput.action !== 'duplicate' && typedInput.action !== 'symlink') {
          throw new TypeError('Filesystem add requires action to be create, duplicate, or symlink.');
        }
        if (typedInput.kind !== 'file' && typedInput.kind !== 'folder') {
          throw new TypeError('Filesystem add requires kind to be file or folder.');
        }
        if (typedInput.targetType !== 'workspace-file' && typedInput.targetType !== 'session-fs-entry') {
          throw new TypeError('Filesystem add targetType must be workspace-file or session-fs-entry.');
        }

        if (typedInput.targetType === 'workspace-file') {
          if (typedInput.kind !== 'file') {
            throw new DOMException('Workspace folders are derived from file paths and cannot be created directly.', 'NotSupportedError');
          }
          const path = normalizeWorkspaceFilePath(String(typedInput.path ?? ''));
          const sourcePath = typeof typedInput.sourcePath === 'string' ? normalizeWorkspaceFilePath(typedInput.sourcePath) : undefined;
          const content = typeof typedInput.content === 'string' ? typedInput.content : '';

          const result = typedInput.action === 'create'
            ? await requireCallback(onCreateWorkspaceFile, `Creating workspace file "${path}" is not supported.`)({ path, content })
            : typedInput.action === 'duplicate'
              ? await requireCallback(onDuplicateWorkspaceFile, `Duplicating workspace file "${path}" is not supported.`)({
                  path: sourcePath ?? (() => { throw new TypeError('Filesystem add duplicate requires a sourcePath.'); })(),
                  targetPath: path,
                })
              : await requireCallback(onSymlinkWorkspaceFile, `Creating a workspace symlink for "${path}" is not supported.`)({
                  path: sourcePath ?? (() => { throw new TypeError('Filesystem add symlink requires a sourcePath.'); })(),
                  targetPath: path,
                });

          return toMutationResult(typedInput.action, {
            targetType: 'workspace-file',
            kind: 'file',
            path,
            content: typedInput.action === 'create' ? content : undefined,
          }, result);
        }

        const { sessionId, path } = resolveSessionFsPathInput(readSessionDrives(), {
          sessionId: typedInput.sessionId,
          path: String(typedInput.path ?? ''),
        });

        if (typedInput.action === 'create') {
          const content = typeof typedInput.content === 'string' ? typedInput.content : '';
          const result = await requireCallback(onCreateSessionFsEntry, `Creating session filesystem entry "${path}" is not supported.`)({
            sessionId,
            path,
            kind: typedInput.kind,
            ...(typedInput.kind === 'file' ? { content } : {}),
          });
          return toMutationResult('create', {
            targetType: 'session-fs-entry',
            kind: typedInput.kind,
            sessionId,
            path,
            content: typedInput.kind === 'file' ? content : undefined,
          }, result);
        }

        if (typedInput.kind !== 'file') {
          throw new DOMException('Duplicating or symlinking session folders is not supported.', 'NotSupportedError');
        }

        const rawSourcePath = typeof typedInput.sourcePath === 'string' ? typedInput.sourcePath.trim() : '';
        const resolvedSessionSource = rawSourcePath ? resolveSessionFsLocationPath(readSessionDrives(), rawSourcePath) : null;
        const isWorkspaceFileSource = typedInput.action === 'symlink'
          && (typedInput.sourceType === 'workspace-file' || (rawSourcePath.startsWith('//') && !resolvedSessionSource));

        // Workspace-file source: symlink a workspace file into the session filesystem.
        if (isWorkspaceFileSource) {
          if (!rawSourcePath) {
            throw new TypeError('Filesystem add symlink with sourceType workspace-file requires a sourcePath.');
          }
          const workspaceSourcePath = normalizeWorkspaceFilePath(rawSourcePath);
          const sourceBasename = workspaceSourcePath.replace(/.*\//, '');
          const correctedPath = resolveSessionFsWorkspaceSymlinkPath(sessionFsEntries, sessionId, path, sourceBasename);
          const content = `workspace://${workspaceSourcePath}`;
          const result = await requireCallback(onCreateSessionFsEntry, `Creating session filesystem entry "${correctedPath}" is not supported.`)({
            sessionId,
            path: correctedPath,
            kind: 'file',
            content,
          });
          return toMutationResult(typedInput.action, {
            targetType: 'session-fs-entry',
            kind: 'file',
            sessionId,
            path: correctedPath,
            content,
          }, result);
        }

        if (resolvedSessionSource && resolvedSessionSource.sessionId !== sessionId) {
          throw new TypeError('Filesystem add sourcePath must belong to the same session filesystem.');
        }
        const sourcePath = resolvedSessionSource?.path
          ?? (typeof typedInput.sourcePath === 'string' ? normalizeSessionFsPath(typedInput.sourcePath) : '');
        if (!sourcePath) {
          throw new TypeError(`Filesystem add ${typedInput.action} requires a sourcePath.`);
        }
        const content = typedInput.action === 'duplicate'
          ? await readSessionFileContent(sessionFsEntries, onReadSessionFsFile, sessionId, sourcePath)
          : `-> ${sourcePath}`;
        const result = await requireCallback(onCreateSessionFsEntry, `Creating session filesystem entry "${path}" is not supported.`)({
          sessionId,
          path,
          kind: 'file',
          content,
        });

        return toMutationResult(typedInput.action, {
          targetType: 'session-fs-entry',
          kind: 'file',
          sessionId,
          path,
          content,
        }, result);
      },
    }, { signal });
  }

  if (onWriteWorkspaceFile || onMoveWorkspaceFile || onWriteSessionFsFile || onRenameSessionFsEntry) {
    modelContext.registerTool({
      name: 'update_filesystem_entry',
      title: 'Update filesystem entry',
      description: 'Rename, move, or modify a file or folder in the workspace Files surface.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['move', 'rename', 'modify'] },
          targetType: { type: 'string', enum: ['workspace-file', 'session-fs-entry'] },
          sessionId: { type: 'string' },
          path: { type: 'string' },
          nextPath: { type: 'string' },
          newName: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['action', 'targetType', 'path'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as FilesystemUpdateInput;
        if (typedInput.action !== 'move' && typedInput.action !== 'rename' && typedInput.action !== 'modify') {
          throw new TypeError('Filesystem update requires action to be move, rename, or modify.');
        }
        if (typedInput.targetType !== 'workspace-file' && typedInput.targetType !== 'session-fs-entry') {
          throw new TypeError('Filesystem update targetType must be workspace-file or session-fs-entry.');
        }

        if (typedInput.targetType === 'workspace-file') {
          const path = normalizeWorkspaceTargetPath(String(typedInput.path ?? ''));
          if (isWorkspaceDrivePath(path)) {
            throw new DOMException('Workspace drives cannot be renamed or modified directly.', 'NotSupportedError');
          }

          if (typedInput.action === 'modify') {
            const content = typeof typedInput.content === 'string' ? typedInput.content : '';
            const result = await requireCallback(onWriteWorkspaceFile, `Modifying workspace file "${path}" is not supported.`)({ path, content });
            return toMutationResult('modify', {
              targetType: 'workspace-file',
              kind: 'file',
              path,
              content,
            }, result);
          }

          const nextPath = typeof typedInput.nextPath === 'string' && typedInput.nextPath.trim()
            ? normalizeWorkspaceFilePath(typedInput.nextPath)
            : (() => {
                const newName = typeof typedInput.newName === 'string' ? typedInput.newName.trim() : '';
                if (!newName) {
                  throw new TypeError('Filesystem update move/rename requires a nextPath or newName.');
                }
                const segments = path.split('/').filter(Boolean);
                return [...segments.slice(0, -1), newName].join('/');
              })();
          const result = await requireCallback(onMoveWorkspaceFile, `Moving workspace file "${path}" is not supported.`)({ path, targetPath: nextPath });
          return toMutationResult(typedInput.action, {
            targetType: 'workspace-file',
            kind: 'file',
            path: nextPath,
            previousPath: path,
          }, result);
        }

        const { sessionId, path } = resolveSessionFsPathInput(readSessionDrives(), {
          sessionId: typedInput.sessionId,
          path: String(typedInput.path ?? ''),
        });
        let entryKind: 'file' | 'folder' = 'file';
        try {
          entryKind = resolveSessionFsTarget(sessionFsEntries, sessionId, path).kind;
        } catch (error) {
          if (!(error instanceof DOMException) || error.name !== 'NotFoundError') {
            throw error;
          }
        }
        if (typedInput.action === 'modify') {
          if (entryKind !== 'file') {
            throw new TypeError(`Session filesystem path "${path}" is not a file.`);
          }
          const content = typeof typedInput.content === 'string' ? typedInput.content : '';
          const result = await requireCallback(onWriteSessionFsFile, `Modifying session filesystem file "${path}" is not supported.`)({ sessionId, path, content });
          return toMutationResult('modify', {
            targetType: 'session-fs-entry',
            kind: 'file',
            sessionId,
            path,
            content,
          }, result);
        }

        const nextPath = typeof typedInput.nextPath === 'string' && typedInput.nextPath.trim()
          ? (() => {
              const resolvedNextPath = resolveSessionFsLocationPath(readSessionDrives(), typedInput.nextPath);
              if (resolvedNextPath) {
                if (resolvedNextPath.sessionId !== sessionId) {
                  throw new TypeError('Filesystem update nextPath must stay within the same session filesystem.');
                }
                return resolvedNextPath.path;
              }
              return normalizeSessionFsPath(typedInput.nextPath);
            })()
          : (() => {
              const newName = typeof typedInput.newName === 'string' ? typedInput.newName.trim() : '';
              if (!newName) {
                throw new TypeError('Filesystem update move/rename requires a nextPath or newName.');
              }
              const parent = parentPath(path) ?? '/';
              return parent === '/' ? `/${newName}` : `${parent}/${newName}`;
            })();
        const result = await requireCallback(onRenameSessionFsEntry, `Renaming session filesystem entry "${path}" is not supported.`)({ sessionId, path, newPath: nextPath });
        return toMutationResult(typedInput.action, {
          targetType: 'session-fs-entry',
          kind: entryKind,
          sessionId,
          path: nextPath,
          previousPath: path,
        }, result);
      },
    }, { signal });
  }

  if (onDeleteWorkspaceFile || onDeleteSessionFsEntry) {
    modelContext.registerTool({
      name: 'remove_filesystem_entry',
      title: 'Remove filesystem entry',
      description: 'Remove a file or folder from the workspace Files surface.',
      inputSchema: {
        type: 'object',
        properties: {
          targetType: { type: 'string', enum: ['workspace-file', 'session-fs-entry'] },
          sessionId: { type: 'string' },
          path: { type: 'string' },
        },
        required: ['targetType', 'path'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const target = normalizeTargetInput(readSessionDrives(), input as FilesystemTargetInput);
        if (target.targetType === 'workspace-file') {
          const result = await requireCallback(onDeleteWorkspaceFile, `Removing workspace file "${target.path}" is not supported.`)({ path: target.path! });
          return toMutationResult('delete', {
            targetType: 'workspace-file',
            kind: 'file',
            path: target.path,
            deleted: true,
          }, result);
        }

        let entryKind: 'file' | 'folder' = 'file';
        try {
          entryKind = resolveSessionFsTarget(sessionFsEntries, target.sessionId!, target.path!).kind;
        } catch (error) {
          if (!(error instanceof DOMException) || error.name !== 'NotFoundError') {
            throw error;
          }
        }
        const result = await requireCallback(onDeleteSessionFsEntry, `Removing session filesystem entry "${target.path}" is not supported.`)({
          sessionId: target.sessionId!,
          path: target.path!,
        });
        return toMutationResult('delete', {
          targetType: 'session-fs-entry',
          kind: entryKind,
          sessionId: target.sessionId,
          path: target.path,
          deleted: true,
        }, result);
      },
    }, { signal });
  }
}