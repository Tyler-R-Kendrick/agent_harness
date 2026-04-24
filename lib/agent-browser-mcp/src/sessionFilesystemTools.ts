import { ModelContext } from '@agent-harness/webmcp';

import type { RegisterWorkspaceToolsOptions } from './workspaceToolTypes';
import type {
  SessionFsPathInput,
  SessionFsRenameInput,
  SessionFsScaffoldInput,
  SessionFsWriteInput,
} from './workspaceToolShared';
import {
  hasSessionFsFileContent,
  isPlainObject,
  normalizeSessionFsMutationResult,
  normalizeSessionFsPath,
  parentPath,
  readSessionFsEntry,
  requireCallback,
  resolveSessionFsLocationPath,
  resolveSessionFsPathInput,
  toSessionFolderResult,
  toSessionFsEntrySummary,
  toSessionFsFileResult,
} from './workspaceToolShared';

export function registerSessionFilesystemTools(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    sessionDrives = [],
    sessionFsEntries = [],
    onMountSessionDrive,
    onUnmountSessionDrive,
    onCreateSessionFsEntry,
    onReadSessionFsFile,
    onWriteSessionFsFile,
    onDeleteSessionFsEntry,
    onRenameSessionFsEntry,
    onScaffoldSessionFsEntry,
    signal,
  } = options;

  const hasSessionFsTools = sessionDrives.length > 0
    || onMountSessionDrive
    || onUnmountSessionDrive
    || sessionFsEntries.length > 0
    || onCreateSessionFsEntry
    || onReadSessionFsFile
    || onWriteSessionFsFile
    || onDeleteSessionFsEntry
    || onRenameSessionFsEntry
    || onScaffoldSessionFsEntry;
  if (!hasSessionFsTools) {
    return;
  }

  const toSessionDriveResult = (sessionId: string, mounted: boolean, result: unknown) => {
    if (result && typeof result === 'object' && !Array.isArray(result)
      && typeof (result as { sessionId?: unknown }).sessionId === 'string'
      && typeof (result as { label?: unknown }).label === 'string'
      && typeof (result as { mounted?: unknown }).mounted === 'boolean') {
      return result;
    }

    const drive = sessionDrives.find((entry) => entry.sessionId === sessionId);
    return {
      sessionId,
      label: drive?.label ?? sessionId,
      mounted,
    };
  };

  if (sessionDrives.length > 0 || onMountSessionDrive || onUnmountSessionDrive) {
    modelContext.registerTool({
      name: 'list_session_drives',
      title: 'List session drives',
      description: 'List session-backed virtual drives available in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: async () => [...sessionDrives].sort((left, right) => left.label.localeCompare(right.label)),
      annotations: { readOnlyHint: true },
    }, { signal });
  }

  if (onMountSessionDrive) {
    modelContext.registerTool({
      name: 'mount_session_drive',
      title: 'Mount session drive',
      description: 'Mount a session virtual drive into the workspace Files surface.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const sessionId = String((input as { sessionId?: string }).sessionId ?? '').trim();
        if (!sessionId) {
          throw new TypeError('Mounting a session drive requires a sessionId.');
        }
        const result = await onMountSessionDrive(sessionId);
        return toSessionDriveResult(sessionId, true, result);
      },
    }, { signal });
  }

  if (onUnmountSessionDrive) {
    modelContext.registerTool({
      name: 'unmount_session_drive',
      title: 'Unmount session drive',
      description: 'Unmount a session virtual drive from the workspace Files surface.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const sessionId = String((input as { sessionId?: string }).sessionId ?? '').trim();
        if (!sessionId) {
          throw new TypeError('Unmounting a session drive requires a sessionId.');
        }
        const result = await onUnmountSessionDrive(sessionId);
        return toSessionDriveResult(sessionId, false, result);
      },
    }, { signal });
  }

  modelContext.registerTool({
    name: 'list_session_filesystem',
    title: 'List session filesystem',
    description: 'List mounted session filesystem entries available in the active workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => [...sessionFsEntries]
      .map(toSessionFsEntrySummary)
      .sort((left, right) => left.sessionId.localeCompare(right.sessionId) || left.path.localeCompare(right.path)),
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'read_session_folder',
    title: 'Read session folder',
    description: 'Read direct children from a session filesystem folder.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        path: { type: 'string' },
      },
      required: ['sessionId', 'path'],
      additionalProperties: false,
    },
    execute: async (input: object) => {
        const resolvedInput = resolveSessionFsPathInput(sessionDrives, input as SessionFsPathInput);
        const entry = readSessionFsEntry(sessionFsEntries, resolvedInput);
      if (entry.kind !== 'folder') {
        throw new TypeError(`Session filesystem path "${entry.path}" is not a folder.`);
      }
      return toSessionFolderResult(sessionFsEntries, entry.sessionId, entry.path);
    },
    annotations: { readOnlyHint: true },
  }, { signal });

  if (onReadSessionFsFile || hasSessionFsFileContent(sessionFsEntries)) {
    modelContext.registerTool({
      name: 'read_session_file',
      title: 'Read session file',
      description: 'Read a file from a mounted session filesystem.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          path: { type: 'string' },
        },
        required: ['sessionId', 'path'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const resolvedInput = resolveSessionFsPathInput(sessionDrives, input as SessionFsPathInput);
        const entry = readSessionFsEntry(sessionFsEntries, resolvedInput);
        if (entry.kind !== 'file') {
          throw new TypeError(`Session filesystem path "${entry.path}" is not a file.`);
        }
        if (typeof entry.content === 'string') {
          return toSessionFsFileResult(entry.sessionId, entry.path, entry.content);
        }
        const reader = requireCallback(onReadSessionFsFile, `Reading session filesystem file "${entry.path}" is not supported.`);
        const result = await reader({ sessionId: entry.sessionId, path: entry.path });
        if (isPlainObject(result) && typeof result.sessionId === 'string' && typeof result.path === 'string' && typeof result.content === 'string') {
          return result;
        }
        return normalizeSessionFsMutationResult('read', {
          sessionId: entry.sessionId,
          path: entry.path,
          kind: 'file',
          content: '',
        }, result);
      },
      annotations: { readOnlyHint: true },
    }, { signal });
  }

  if (onCreateSessionFsEntry) {
    modelContext.registerTool({
      name: 'create_session_file',
      title: 'Create session file',
      description: 'Create a file in a mounted session filesystem.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['sessionId', 'path'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as SessionFsWriteInput;
        const { sessionId, path } = resolveSessionFsPathInput(sessionDrives, typedInput);
        const content = typeof typedInput.content === 'string' ? typedInput.content : '';
        const result = await onCreateSessionFsEntry({ sessionId, path, kind: 'file', content });
        return normalizeSessionFsMutationResult('create', { sessionId, path, kind: 'file', content }, result);
      },
    }, { signal });

    modelContext.registerTool({
      name: 'create_session_folder',
      title: 'Create session folder',
      description: 'Create a folder in a mounted session filesystem.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          path: { type: 'string' },
        },
        required: ['sessionId', 'path'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as SessionFsPathInput;
        const { sessionId, path } = resolveSessionFsPathInput(sessionDrives, typedInput);
        const result = await onCreateSessionFsEntry({ sessionId, path, kind: 'folder' });
        return normalizeSessionFsMutationResult('create', { sessionId, path, kind: 'folder' }, result);
      },
    }, { signal });
  }

  if (onWriteSessionFsFile) {
    modelContext.registerTool({
      name: 'write_session_file',
      title: 'Write session file',
      description: 'Write a file in a mounted session filesystem.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['sessionId', 'path', 'content'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as SessionFsWriteInput;
        const { sessionId, path } = resolveSessionFsPathInput(sessionDrives, typedInput);
        const content = String(typedInput.content ?? '');
        const result = await onWriteSessionFsFile({ sessionId, path, content });
        return normalizeSessionFsMutationResult('write', { sessionId, path, kind: 'file', content }, result);
      },
    }, { signal });
  }

  if (onDeleteSessionFsEntry) {
    modelContext.registerTool({
      name: 'delete_session_filesystem_entry',
      title: 'Delete session filesystem entry',
      description: 'Delete a file or folder from a mounted session filesystem.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          path: { type: 'string' },
        },
        required: ['sessionId', 'path'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as SessionFsPathInput;
        const { sessionId, path } = resolveSessionFsPathInput(sessionDrives, typedInput);
        const result = await onDeleteSessionFsEntry({ sessionId, path });
        return normalizeSessionFsMutationResult('delete', { sessionId, path }, result);
      },
    }, { signal });
  }

  if (onRenameSessionFsEntry) {
    modelContext.registerTool({
      name: 'rename_session_filesystem_entry',
      title: 'Rename session filesystem entry',
      description: 'Rename a file or folder in a mounted session filesystem.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          path: { type: 'string' },
          newPath: { type: 'string' },
          newName: { type: 'string' },
        },
        anyOf: [{ required: ['sessionId', 'path', 'newPath'] }, { required: ['sessionId', 'path', 'newName'] }],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as SessionFsRenameInput;
        const { sessionId, path } = resolveSessionFsPathInput(sessionDrives, typedInput);
        const newPath = typeof typedInput.newPath === 'string' && typedInput.newPath.trim()
          ? (() => {
              const resolvedNextPath = resolveSessionFsLocationPath(sessionDrives, typedInput.newPath);
              if (resolvedNextPath) {
                if (resolvedNextPath.sessionId !== sessionId) {
                  throw new TypeError('Session filesystem rename nextPath must stay within the same session.');
                }
                return resolvedNextPath.path;
              }
              return normalizeSessionFsPath(typedInput.newPath);
            })()
          : (() => {
              const newName = String(typedInput.newName ?? '').trim();
              if (!newName) {
                throw new TypeError('Session filesystem rename requires a newPath or newName.');
              }
              const parent = parentPath(path) ?? '/';
              return parent === '/' ? `/${newName}` : `${parent}/${newName}`;
            })();
        const result = await onRenameSessionFsEntry({ sessionId, path, newPath });
        return normalizeSessionFsMutationResult('rename', {
          sessionId,
          path: newPath,
          previousPath: path,
        }, result);
      },
    }, { signal });
  }

  if (onScaffoldSessionFsEntry) {
    modelContext.registerTool({
      name: 'scaffold_session_filesystem_entry',
      title: 'Scaffold session filesystem entry',
      description: 'Scaffold a built-in template into a mounted session filesystem.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          basePath: { type: 'string' },
          template: { type: 'string', enum: ['agents', 'skill', 'hook', 'eval'] },
        },
        required: ['sessionId', 'basePath', 'template'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as SessionFsScaffoldInput;
        const { sessionId, path: basePath } = resolveSessionFsPathInput(sessionDrives, {
          sessionId: typedInput.sessionId,
          path: typedInput.basePath,
        });
        const template = typedInput.template;
        if (!template) {
          throw new TypeError('Session filesystem scaffolding requires a template.');
        }
        const result = await onScaffoldSessionFsEntry({ sessionId, basePath, template });
        return normalizeSessionFsMutationResult('scaffold', { sessionId, path: `${basePath}/${template}`, template }, result);
      },
    }, { signal });
  }
}
