import type {
  WorkspaceMcpBrowserPage,
  WorkspaceMcpFile,
  WorkspaceMcpSessionDrive,
  WorkspaceMcpSessionFsEntry,
  WorkspaceMcpSessionState,
  WorkspaceMcpSessionSummary,
  WorkspaceMcpSessionTool,
  WorkspaceMcpSessionToolState,
  WorkspaceMcpWorktreeItem,
  WorkspaceMcpWorktreeItemType,
  WorkspaceMcpWriteSessionInput,
} from './workspaceToolTypes';

export interface WorkspaceFileInput {
  path?: string;
  uri?: string;
}

export interface BrowserPageInput {
  pageId?: string;
}

export interface SessionInput {
  sessionId?: string;
}

export interface SessionFsPathInput {
  sessionId?: string;
  path?: string;
}

export interface SessionFsWriteInput extends SessionFsPathInput {
  content?: string;
}

export interface SessionFsRenameInput extends SessionFsPathInput {
  newPath?: string;
  newName?: string;
}

export interface SessionFsScaffoldInput {
  sessionId?: string;
  basePath?: string;
  template?: 'hook';
}

export interface WorktreeItemInput {
  itemId?: string;
  itemType?: WorkspaceMcpWorktreeItemType;
}

export interface WorktreeActionInput extends WorktreeItemInput {
  actionId?: string;
  args?: Record<string, unknown>;
}

export function normalizeWorkspaceFilePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new TypeError('Workspace file path must not be empty.');
  }

  const driveStyleRootMatch = trimmed.match(/^\/\/([^/]+)\/?$/);
  if (driveStyleRootMatch) {
    throw new TypeError('Workspace file path must include a file path.');
  }

  const driveStyleFileMatch = trimmed.match(/^\/\/([^/]+)\/(.+)$/);
  if (driveStyleFileMatch) {
    const [, driveSegment, rest] = driveStyleFileMatch;
    const normalizedRest = rest.replace(/^\/+/, '');
    if (!normalizedRest) {
      throw new TypeError('Workspace file path must include a file path.');
    }
    return driveSegment === 'workspace'
      ? normalizedRest
      : `${driveSegment}/${normalizedRest}`;
  }

  const normalized = trimmed.replace(/^\/+/, '');
  if (!normalized) {
    throw new TypeError('Workspace file path must not be empty.');
  }

  return normalized;
}

export function normalizeSessionFsPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new TypeError('Session filesystem path must not be empty.');
  }

  const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return prefixed.length > 1 ? prefixed.replace(/\/+$/, '') : prefixed;
}

function normalizeSessionDriveLabel(label: string): string {
  return label.trim().replace(/\/+$/, '');
}

export function resolveSessionFsLocationPath(
  sessionDrives: readonly WorkspaceMcpSessionDrive[],
  rawPath: string,
): { sessionId: string; path: string } | null {
  const trimmed = rawPath.trim();
  if (!trimmed.startsWith('//')) {
    return null;
  }

  const candidates = sessionDrives
    .map((drive) => ({ sessionId: drive.sessionId, label: normalizeSessionDriveLabel(drive.label) }))
    .filter((drive) => drive.label.startsWith('//'))
    .sort((left, right) => right.label.length - left.label.length);

  for (const candidate of candidates) {
    if (trimmed !== candidate.label && !trimmed.startsWith(`${candidate.label}/`)) {
      continue;
    }

    const remainder = trimmed.slice(candidate.label.length).replace(/^\/+/, '');
    return {
      sessionId: candidate.sessionId,
      path: normalizeSessionFsPath(remainder ? `/${remainder}` : '/workspace'),
    };
  }

  return null;
}

export function resolveSessionFsPathInput(
  sessionDrives: readonly WorkspaceMcpSessionDrive[],
  input: SessionFsPathInput,
): { sessionId: string; path: string } {
  if (typeof input.path !== 'string') {
    throw new TypeError('Session filesystem input must include a path.');
  }

  const rawPath = input.path.trim();
  if (!rawPath) {
    throw new TypeError('Session filesystem input must include a path.');
  }

  const explicitSessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';
  const resolvedFromLocation = resolveSessionFsLocationPath(sessionDrives, rawPath);
  if (resolvedFromLocation) {
    if (explicitSessionId && explicitSessionId !== resolvedFromLocation.sessionId) {
      throw new TypeError(`Session filesystem input sessionId does not match path "${rawPath}".`);
    }
    return resolvedFromLocation;
  }

  if (!explicitSessionId) {
    throw new TypeError('Session filesystem input must include a sessionId.');
  }

  return {
    sessionId: explicitSessionId,
    path: normalizeSessionFsPath(rawPath),
  };
}

export function basename(path: string): string {
  return path.replace(/.*\//, '');
}

export function parentPath(path: string): string | null {
  if (path === '/') {
    return null;
  }

  const normalized = normalizeSessionFsPath(path);
  const index = normalized.lastIndexOf('/');
  if (index <= 0) {
    return '/';
  }

  return normalized.slice(0, index);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function detectMimeType(path: string): string {
  if (path.endsWith('.md')) {
    return 'text/markdown';
  }
  if (path.endsWith('.json')) {
    return 'application/json';
  }
  if (path.endsWith('.yaml') || path.endsWith('.yml')) {
    return 'application/yaml';
  }
  if (path.endsWith('.sh')) {
    return 'text/x-shellscript';
  }
  return 'text/plain';
}

export function toWorkspaceFileSummary(file: WorkspaceMcpFile) {
  return {
    path: file.path,
    uri: toWorkspaceFileUri(file.path),
    updatedAt: file.updatedAt,
  };
}

export function toWorkspaceFileResult(workspaceName: string, file: WorkspaceMcpFile) {
  return {
    workspaceName,
    ...toWorkspaceFileSummary(file),
    content: file.content,
  };
}

export function toBrowserPageResult(page: WorkspaceMcpBrowserPage) {
  return {
    id: page.id,
    title: page.title,
    url: page.url,
    isOpen: page.isOpen,
    persisted: Boolean(page.persisted),
    muted: Boolean(page.muted),
    memoryTier: page.memoryTier ?? null,
    memoryMB: page.memoryMB ?? null,
  };
}

export function toSessionSummary(session: WorkspaceMcpSessionSummary) {
  return {
    id: session.id,
    name: session.name,
    isOpen: session.isOpen,
  };
}

export function toSessionStateResult(workspaceName: string, session: WorkspaceMcpSessionState) {
  return {
    workspaceName,
    id: session.id,
    name: session.name,
    mode: session.mode,
    provider: session.provider ?? null,
    modelId: session.modelId ?? null,
    agentId: session.agentId ?? null,
    toolIds: [...(session.toolIds ?? [])],
    cwd: session.cwd ?? null,
    messages: session.messages.map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.status ? { status: message.status } : {}),
    })),
  };
}

export function filterSessionTools(
  sessionTools: readonly WorkspaceMcpSessionTool[],
  selectedToolIds: readonly string[],
  query?: string,
): WorkspaceMcpSessionToolState[] {
  const normalizedQuery = query?.trim().toLowerCase() ?? '';
  const selectedToolIdSet = new Set(selectedToolIds);

  return sessionTools
    .filter((tool) => {
      if (!normalizedQuery) {
        return true;
      }

      return [tool.id, tool.label, tool.description ?? '', tool.group, tool.groupLabel]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    })
    .map((tool) => ({
      ...tool,
      selected: selectedToolIdSet.has(tool.id),
    }));
}

export function toSessionFsEntrySummary(entry: WorkspaceMcpSessionFsEntry) {
  return {
    sessionId: entry.sessionId,
    path: normalizeSessionFsPath(entry.path),
    kind: entry.kind,
    isRoot: Boolean(entry.isRoot),
  };
}

export function toSessionFsFileResult(sessionId: string, path: string, content: string) {
  return {
    sessionId,
    path: normalizeSessionFsPath(path),
    kind: 'file' as const,
    content,
  };
}

export function toSessionFolderResult(entries: readonly WorkspaceMcpSessionFsEntry[], sessionId: string, path: string) {
  const normalizedPath = normalizeSessionFsPath(path);
  const kindRank = { folder: 0, file: 1 } as const;
  const childEntries = entries
    .filter((entry) => entry.sessionId === sessionId)
    .map((entry) => ({ ...entry, path: normalizeSessionFsPath(entry.path) }))
    .filter((entry) => entry.path !== normalizedPath && parentPath(entry.path) === normalizedPath)
    .sort((left, right) => kindRank[left.kind] - kindRank[right.kind] || basename(left.path).localeCompare(basename(right.path)))
    .map((entry) => ({
      name: basename(entry.path),
      path: entry.path,
      kind: entry.kind,
    }));

  return {
    sessionId,
    path: normalizedPath,
    kind: 'folder' as const,
    entries: childEntries,
  };
}

export function toWorkspaceOverviewMessages(workspaceName: string, workspaceFiles: readonly WorkspaceMcpFile[]) {
  return {
    description: `Workspace overview for ${workspaceName}.`,
    messages: [
      { role: 'system' as const, content: `Active workspace: ${workspaceName}` },
      {
        role: 'user' as const,
        content: workspaceFiles.length
          ? `Workspace files:\n${workspaceFiles.map((file) => `- ${file.path}`).join('\n')}`
          : 'Workspace files: none',
      },
    ],
  };
}

export function toWorkspaceFilePrompt(workspaceName: string, file: WorkspaceMcpFile) {
  return {
    description: `Workspace file prompt for ${file.path}.`,
    messages: [
      { role: 'system' as const, content: `Active workspace: ${workspaceName}` },
      { role: 'user' as const, content: `Open ${file.path}.\n\n${file.content}` },
    ],
  };
}

export function readWorkspaceFile(
  workspaceName: string,
  workspaceFiles: readonly WorkspaceMcpFile[],
  input: WorkspaceFileInput,
): WorkspaceMcpFile {
  const targetPath = resolveWorkspaceFilePath(input);
  const file = workspaceFiles.find((candidate) => candidate.path === targetPath);
  if (!file) {
    throw new DOMException(`Workspace file "${targetPath}" is not available in ${workspaceName}.`, 'NotFoundError');
  }

  return file;
}

export function readBrowserPage(
  browserPages: readonly WorkspaceMcpBrowserPage[],
  input: BrowserPageInput,
): WorkspaceMcpBrowserPage {
  if (typeof input.pageId !== 'string' || !input.pageId.trim()) {
    throw new TypeError('Browser page input must include a pageId.');
  }

  const page = browserPages.find((candidate) => candidate.id === input.pageId);
  if (!page) {
    throw new DOMException(`Browser page "${input.pageId}" is not available.`, 'NotFoundError');
  }

  return page;
}

export function readSessionSummary(
  sessions: readonly WorkspaceMcpSessionSummary[],
  input: SessionInput,
): WorkspaceMcpSessionSummary {
  if (typeof input.sessionId !== 'string' || !input.sessionId.trim()) {
    throw new TypeError('Session input must include a sessionId.');
  }

  const session = sessions.find((candidate) => candidate.id === input.sessionId);
  if (!session) {
    throw new DOMException(`Session "${input.sessionId}" is not available.`, 'NotFoundError');
  }

  return session;
}

export function resolveSessionSummaryInput(
  sessions: readonly WorkspaceMcpSessionSummary[],
  input: SessionInput,
): WorkspaceMcpSessionSummary {
  if (typeof input.sessionId === 'string' && input.sessionId.trim()) {
    return readSessionSummary(sessions, input);
  }

  if (!sessions.length) {
    throw new DOMException('No sessions are available in the active workspace.', 'NotFoundError');
  }

  if (sessions.length === 1) {
    return sessions[0]!;
  }

  throw new TypeError('Session input must include a sessionId when multiple sessions are available.');
}

export function readOpenSessionState(
  sessions: readonly WorkspaceMcpSessionSummary[],
  getSessionState: ((sessionId: string) => WorkspaceMcpSessionState | null | undefined) | undefined,
  input: SessionInput,
): WorkspaceMcpSessionState {
  const session = resolveSessionSummaryInput(sessions, input);
  const state = getSessionState?.(session.id);
  if (!state) {
    throw new DOMException(`Session "${session.name}" is not open. Open it first before reading or writing.`, 'NotFoundError');
  }

  return {
    ...state,
    id: session.id,
    name: session.name,
    isOpen: session.isOpen,
  };
}

export function normalizeSessionToolIds(rawToolIds: unknown): string[] {
  if (!Array.isArray(rawToolIds)) {
    throw new TypeError('change_session_tools requires toolIds.');
  }

  const normalizedToolIds = Array.from(new Set(
    rawToolIds
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  ));
  if (!normalizedToolIds.length) {
    throw new TypeError('change_session_tools requires toolIds.');
  }

  return normalizedToolIds;
}

export function applySessionToolChange(
  sessionTools: readonly WorkspaceMcpSessionTool[],
  selectedToolIds: readonly string[],
  action: unknown,
  rawToolIds: unknown,
): string[] {
  const normalizedToolIds = normalizeSessionToolIds(rawToolIds);
  if (action !== 'select' && action !== 'deselect') {
    throw new TypeError('change_session_tools requires action to be "select" or "deselect".');
  }

  const availableToolIds = new Set(sessionTools.map((tool) => tool.id));
  for (const toolId of normalizedToolIds) {
    if (!availableToolIds.has(toolId)) {
      throw new DOMException(`Session tool "${toolId}" is not available.`, 'NotFoundError');
    }
  }

  const nextSelectedToolIds = new Set(selectedToolIds);
  for (const toolId of normalizedToolIds) {
    if (action === 'select') {
      nextSelectedToolIds.add(toolId);
    } else {
      nextSelectedToolIds.delete(toolId);
    }
  }

  return sessionTools
    .map((tool) => tool.id)
    .filter((toolId) => nextSelectedToolIds.has(toolId));
}

export function readSessionFsEntry(
  entries: readonly WorkspaceMcpSessionFsEntry[],
  input: SessionFsPathInput,
): WorkspaceMcpSessionFsEntry {
  if (typeof input.sessionId !== 'string' || !input.sessionId.trim()) {
    throw new TypeError('Session filesystem input must include a sessionId.');
  }
  if (typeof input.path !== 'string') {
    throw new TypeError('Session filesystem input must include a path.');
  }

  const normalizedPath = normalizeSessionFsPath(input.path);
  const entry = entries.find((candidate) => candidate.sessionId === input.sessionId && normalizeSessionFsPath(candidate.path) === normalizedPath);
  if (!entry) {
    throw new DOMException(`Session filesystem path "${normalizedPath}" is not available in ${input.sessionId}.`, 'NotFoundError');
  }

  return { ...entry, path: normalizedPath };
}

export function readWorktreeItem(
  items: readonly WorkspaceMcpWorktreeItem[],
  input: WorktreeItemInput,
): WorkspaceMcpWorktreeItem {
  if (typeof input.itemId !== 'string' || !input.itemId.trim()) {
    throw new TypeError('Worktree item input must include an itemId.');
  }
  if (typeof input.itemType !== 'string' || !input.itemType.trim()) {
    throw new TypeError('Worktree item input must include an itemType.');
  }

  const item = items.find((candidate) => candidate.id === input.itemId && candidate.itemType === input.itemType);
  if (!item) {
    throw new DOMException(`Worktree item "${input.itemType}:${input.itemId}" is not available.`, 'NotFoundError');
  }

  return item;
}

export function requireCallback<TCallback>(callback: TCallback | undefined, message: string): TCallback {
  if (!callback) {
    throw new DOMException(message, 'NotSupportedError');
  }

  return callback;
}

export function hasSessionFsFileContent(entries: readonly WorkspaceMcpSessionFsEntry[]): boolean {
  return entries.some((entry) => entry.kind === 'file' && typeof entry.content === 'string');
}

export function normalizeDeleteWorkspaceFileResult(path: string, result: unknown) {
  if (isPlainObject(result)) {
    return result;
  }

  return { path, deleted: true };
}

export function normalizeBrowserPageMutationResult(_action: 'create', pageId: string, result: unknown) {
  if (isPlainObject(result) && typeof result.id === 'string' && typeof result.title === 'string' && typeof result.url === 'string') {
    return toBrowserPageResult(result as unknown as WorkspaceMcpBrowserPage);
  }

  return { pageId, created: true };
}

export function normalizeSessionMutationResult(_action: 'create', sessionId: string, result: unknown) {
  if (isPlainObject(result) && typeof result.id === 'string' && typeof result.name === 'string') {
    return toSessionSummary(result as unknown as WorkspaceMcpSessionSummary);
  }

  return { sessionId, created: true };
}

export function normalizeSessionFsMutationResult(
  action: 'create' | 'write' | 'read' | 'delete' | 'rename' | 'scaffold',
  payload: {
    sessionId: string;
    path: string;
    kind?: 'file' | 'folder';
    content?: string;
    previousPath?: string;
    template?: 'hook';
  },
  result: unknown,
) {
  if (isPlainObject(result)) {
    return result;
  }

  if (action === 'delete') {
    return { sessionId: payload.sessionId, path: normalizeSessionFsPath(payload.path), deleted: true };
  }
  if (action === 'rename') {
    return {
      sessionId: payload.sessionId,
      path: normalizeSessionFsPath(payload.path),
      previousPath: normalizeSessionFsPath(payload.previousPath!),
    };
  }
  if (action === 'scaffold') {
    return {
      sessionId: payload.sessionId,
      path: normalizeSessionFsPath(payload.path),
      template: payload.template!,
    };
  }
  if (payload.kind === 'folder') {
    return { sessionId: payload.sessionId, path: normalizeSessionFsPath(payload.path), kind: 'folder', content: null };
  }

  return toSessionFsFileResult(payload.sessionId, payload.path, payload.content!);
}

export function normalizeWorktreeItems(items: readonly WorkspaceMcpWorktreeItem[]) {
  const priority: Record<WorkspaceMcpWorktreeItemType, number> = {
    'workspace-file': 0,
    'browser-page': 1,
    session: 2,
    'session-fs-entry': 3,
    clipboard: 4,
  };

  return [...items].sort((left, right) => {
    const leftRank = priority[left.itemType];
    const rightRank = priority[right.itemType];
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.label.localeCompare(right.label);
  });
}

export function buildDefaultSessionState(
  session: WorkspaceMcpSessionState,
  input: WorkspaceMcpWriteSessionInput,
): WorkspaceMcpSessionState {
  return {
    id: session.id,
    name: input.name ?? session.name,
    isOpen: session.isOpen,
    mode: input.mode ?? session.mode,
    provider: input.provider ?? session.provider ?? null,
    modelId: input.modelId ?? session.modelId ?? null,
    agentId: input.agentId ?? session.agentId ?? null,
    toolIds: input.toolIds ?? session.toolIds ?? [],
    cwd: input.cwd ?? session.cwd ?? null,
    messages: input.message
      ? [...session.messages, { role: 'user', content: input.message }]
      : session.messages,
  };
}

export async function applySessionMutation(
  workspaceName: string,
  session: WorkspaceMcpSessionState,
  input: WorkspaceMcpWriteSessionInput,
  onWriteSession: (input: WorkspaceMcpWriteSessionInput) => Promise<WorkspaceMcpSessionState | void> | WorkspaceMcpSessionState | void,
) {
  const result = await onWriteSession(input);
  const nextSession = isPlainObject(result)
    && typeof result.id === 'string'
    && typeof result.name === 'string'
    && typeof result.mode === 'string'
    && Array.isArray((result as WorkspaceMcpSessionState).messages)
    ? result as WorkspaceMcpSessionState
    : buildDefaultSessionState(session, input);

  return toSessionStateResult(workspaceName, {
    ...nextSession,
    id: session.id,
    name: nextSession.name || session.name,
    isOpen: session.isOpen,
  });
}

export function toWorkspaceFileUri(path: string): string {
  const normalized = normalizeWorkspaceFilePath(path);
  return `files://workspace/${normalized.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;
}

export function resolveWorkspaceFilePath(input: WorkspaceFileInput): string {
  if (typeof input.path === 'string') {
    return normalizeWorkspaceFilePath(input.path);
  }

  if (typeof input.uri !== 'string') {
    throw new TypeError('Workspace file input must include a path or files://workspace URI.');
  }

  const url = new URL(input.uri);
  if (url.protocol !== 'files:' || url.hostname !== 'workspace') {
    throw new TypeError('Workspace file URIs must use the files://workspace/ scheme.');
  }

  return normalizeWorkspaceFilePath(decodeURIComponent(url.pathname));
}
