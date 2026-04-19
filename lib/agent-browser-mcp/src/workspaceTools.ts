import {
  getModelContextPromptRegistry,
  getModelContextPromptTemplateRegistry,
  getModelContextRegistry,
  getModelContextResourceRegistry,
  ModelContext,
  type ModelContextRegisterToolOptions,
} from '../../webmcp/src/index';

export interface WorkspaceMcpFile {
  path: string;
  content: string;
  updatedAt: string;
}

export interface RegisterWorkspaceFileToolsOptions extends ModelContextRegisterToolOptions {
  workspaceName: string;
  workspaceFiles: readonly WorkspaceMcpFile[];
  onOpenFile?: (path: string) => void;
}

export interface WorkspaceMcpBrowserPage {
  id: string;
  title: string;
  url: string;
  isOpen: boolean;
  persisted?: boolean;
  muted?: boolean;
  memoryTier?: string | null;
  memoryMB?: number | null;
}

export interface WorkspaceMcpSessionSummary {
  id: string;
  name: string;
  isOpen: boolean;
}

export interface WorkspaceMcpSessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  status?: string | null;
}

export interface WorkspaceMcpSessionState extends WorkspaceMcpSessionSummary {
  mode: 'agent' | 'terminal';
  provider?: string | null;
  modelId?: string | null;
  cwd?: string | null;
  messages: readonly WorkspaceMcpSessionMessage[];
}

export interface WorkspaceMcpSessionFsEntry {
  sessionId: string;
  path: string;
  kind: 'file' | 'folder';
  isRoot?: boolean;
  content?: string | null;
}

export type WorkspaceMcpWorktreeItemType =
  | 'browser-page'
  | 'session'
  | 'workspace-file'
  | 'session-fs-entry'
  | 'clipboard';

export interface WorkspaceMcpWorktreeItem {
  id: string;
  itemType: WorkspaceMcpWorktreeItemType;
  label: string;
  path?: string;
  sessionId?: string;
  url?: string;
}

export interface WorkspaceMcpContextAction {
  id: string;
  label: string;
  description?: string;
}

export interface WorkspaceMcpWriteSessionInput {
  sessionId: string;
  name?: string;
  message?: string;
  provider?: string;
  modelId?: string;
  mode?: 'agent' | 'terminal';
  cwd?: string;
}

export interface RegisterWorkspaceToolsOptions extends RegisterWorkspaceFileToolsOptions {
  browserPages?: readonly WorkspaceMcpBrowserPage[];
  sessions?: readonly WorkspaceMcpSessionSummary[];
  getSessionState?: (sessionId: string) => WorkspaceMcpSessionState | null | undefined;
  sessionFsEntries?: readonly WorkspaceMcpSessionFsEntry[];
  worktreeItems?: readonly WorkspaceMcpWorktreeItem[];
  onCreateBrowserPage?: (input: { url: string; title?: string }) => Promise<WorkspaceMcpBrowserPage | void> | WorkspaceMcpBrowserPage | void;
  onOpenBrowserPage?: (pageId: string) => Promise<void> | void;
  onCloseBrowserPage?: (pageId: string) => Promise<void> | void;
  onCreateSession?: (input: { name?: string }) => Promise<WorkspaceMcpSessionSummary | void> | WorkspaceMcpSessionSummary | void;
  onOpenSession?: (sessionId: string) => Promise<void> | void;
  onCloseSession?: (sessionId: string) => Promise<void> | void;
  onWriteSession?: (input: WorkspaceMcpWriteSessionInput) => Promise<WorkspaceMcpSessionState | void> | WorkspaceMcpSessionState | void;
  onCreateWorkspaceFile?: (input: { path: string; content: string }) => Promise<WorkspaceMcpFile | void> | WorkspaceMcpFile | void;
  onWriteWorkspaceFile?: (input: { path: string; content: string }) => Promise<WorkspaceMcpFile | void> | WorkspaceMcpFile | void;
  onDeleteWorkspaceFile?: (input: { path: string }) => Promise<unknown> | unknown;
  onCreateSessionFsEntry?: (input: {
    sessionId: string;
    path: string;
    kind: 'file' | 'folder';
    content?: string;
  }) => Promise<unknown> | unknown;
  onReadSessionFsFile?: (input: { sessionId: string; path: string }) => Promise<unknown> | unknown;
  onWriteSessionFsFile?: (input: { sessionId: string; path: string; content: string }) => Promise<unknown> | unknown;
  onDeleteSessionFsEntry?: (input: { sessionId: string; path: string }) => Promise<unknown> | unknown;
  onRenameSessionFsEntry?: (input: { sessionId: string; path: string; newPath: string }) => Promise<unknown> | unknown;
  onScaffoldSessionFsEntry?: (input: {
    sessionId: string;
    basePath: string;
    template: 'agents' | 'skill' | 'hook' | 'eval';
  }) => Promise<unknown> | unknown;
  getWorktreeContextActions?: (input: {
    itemId: string;
    itemType: WorkspaceMcpWorktreeItemType;
  }) => readonly WorkspaceMcpContextAction[];
  onInvokeWorktreeContextAction?: (input: {
    itemId: string;
    itemType: WorkspaceMcpWorktreeItemType;
    actionId: string;
    args: Record<string, unknown>;
  }) => Promise<unknown> | unknown;
}

export interface RegisterSessionToolsOptions extends ModelContextRegisterToolOptions {
  workspaceName: string;
  session: WorkspaceMcpSessionState;
  onWriteSession?: (input: WorkspaceMcpWriteSessionInput) => Promise<WorkspaceMcpSessionState | void> | WorkspaceMcpSessionState | void;
}

interface WorkspaceFileInput {
  path?: string;
  uri?: string;
}

interface BrowserPageInput {
  pageId?: string;
}

interface SessionInput {
  sessionId?: string;
}

interface SessionFsPathInput {
  sessionId?: string;
  path?: string;
}

interface SessionFsWriteInput extends SessionFsPathInput {
  content?: string;
}

interface SessionFsRenameInput extends SessionFsPathInput {
  newPath?: string;
  newName?: string;
}

interface SessionFsScaffoldInput {
  sessionId?: string;
  basePath?: string;
  template?: 'agents' | 'skill' | 'hook' | 'eval';
}

interface WorktreeItemInput {
  itemId?: string;
  itemType?: WorkspaceMcpWorktreeItemType;
}

interface WorktreeActionInput extends WorktreeItemInput {
  actionId?: string;
  args?: Record<string, unknown>;
}

function normalizeWorkspaceFilePath(path: string): string {
  const normalized = path.trim().replace(/^\/+/, '');
  if (!normalized) {
    throw new TypeError('Workspace file path must not be empty.');
  }

  return normalized;
}

function normalizeSessionFsPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new TypeError('Session filesystem path must not be empty.');
  }

  const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return prefixed.length > 1 ? prefixed.replace(/\/+$/, '') : prefixed;
}

function basename(path: string): string {
  return path.replace(/.*\//, '');
}

function parentPath(path: string): string | null {
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function detectMimeType(path: string): string {
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

function toWorkspaceFileSummary(file: WorkspaceMcpFile) {
  return {
    path: file.path,
    uri: toWorkspaceFileUri(file.path),
    updatedAt: file.updatedAt,
  };
}

function toWorkspaceFileResult(workspaceName: string, file: WorkspaceMcpFile) {
  return {
    workspaceName,
    ...toWorkspaceFileSummary(file),
    content: file.content,
  };
}

function toBrowserPageResult(page: WorkspaceMcpBrowserPage) {
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

function toSessionSummary(session: WorkspaceMcpSessionSummary) {
  return {
    id: session.id,
    name: session.name,
    isOpen: session.isOpen,
  };
}

function toSessionStateResult(workspaceName: string, session: WorkspaceMcpSessionState) {
  return {
    workspaceName,
    id: session.id,
    name: session.name,
    mode: session.mode,
    provider: session.provider ?? null,
    modelId: session.modelId ?? null,
    cwd: session.cwd ?? null,
    messages: session.messages.map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.status ? { status: message.status } : {}),
    })),
  };
}

function toSessionFsEntrySummary(entry: WorkspaceMcpSessionFsEntry) {
  return {
    sessionId: entry.sessionId,
    path: normalizeSessionFsPath(entry.path),
    kind: entry.kind,
    isRoot: Boolean(entry.isRoot),
  };
}

function toSessionFsFileResult(sessionId: string, path: string, content: string) {
  return {
    sessionId,
    path: normalizeSessionFsPath(path),
    kind: 'file' as const,
    content,
  };
}

function toSessionFolderResult(entries: readonly WorkspaceMcpSessionFsEntry[], sessionId: string, path: string) {
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

function toWorkspaceOverviewMessages(workspaceName: string, workspaceFiles: readonly WorkspaceMcpFile[]) {
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

function toWorkspaceFilePrompt(workspaceName: string, file: WorkspaceMcpFile) {
  return {
    description: `Workspace file prompt for ${file.path}.`,
    messages: [
      { role: 'system' as const, content: `Active workspace: ${workspaceName}` },
      { role: 'user' as const, content: `Open ${file.path}.\n\n${file.content}` },
    ],
  };
}

function readWorkspaceFile(
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

function readBrowserPage(browserPages: readonly WorkspaceMcpBrowserPage[], input: BrowserPageInput): WorkspaceMcpBrowserPage {
  if (typeof input.pageId !== 'string' || !input.pageId.trim()) {
    throw new TypeError('Browser page input must include a pageId.');
  }

  const page = browserPages.find((candidate) => candidate.id === input.pageId);
  if (!page) {
    throw new DOMException(`Browser page "${input.pageId}" is not available.`, 'NotFoundError');
  }

  return page;
}

function readSessionSummary(sessions: readonly WorkspaceMcpSessionSummary[], input: SessionInput): WorkspaceMcpSessionSummary {
  if (typeof input.sessionId !== 'string' || !input.sessionId.trim()) {
    throw new TypeError('Session input must include a sessionId.');
  }

  const session = sessions.find((candidate) => candidate.id === input.sessionId);
  if (!session) {
    throw new DOMException(`Session "${input.sessionId}" is not available.`, 'NotFoundError');
  }

  return session;
}

function resolveSessionSummaryInput(
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

function readOpenSessionState(
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

function readSessionFsEntry(
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

function readWorktreeItem(items: readonly WorkspaceMcpWorktreeItem[], input: WorktreeItemInput): WorkspaceMcpWorktreeItem {
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

function requireCallback<TCallback>(callback: TCallback | undefined, message: string): TCallback {
  if (!callback) {
    throw new DOMException(message, 'NotSupportedError');
  }

  return callback;
}

function hasSessionFsFileContent(entries: readonly WorkspaceMcpSessionFsEntry[]): boolean {
  return entries.some((entry) => entry.kind === 'file' && typeof entry.content === 'string');
}

function normalizeDeleteWorkspaceFileResult(path: string, result: unknown) {
  if (isPlainObject(result)) {
    return result;
  }

  return { path, deleted: true };
}

function normalizeBrowserPageMutationResult(action: 'create' | 'open' | 'close', pageId: string, result: unknown) {
  if (isPlainObject(result) && typeof result.id === 'string' && typeof result.title === 'string' && typeof result.url === 'string') {
    return toBrowserPageResult(result as unknown as WorkspaceMcpBrowserPage);
  }

  if (action === 'open') {
    return { pageId, opened: true };
  }
  if (action === 'close') {
    return { pageId, closed: true };
  }
  return { pageId, created: true };
}

function normalizeSessionMutationResult(action: 'create' | 'open' | 'close', sessionId: string, result: unknown) {
  if (isPlainObject(result) && typeof result.id === 'string' && typeof result.name === 'string') {
    return toSessionSummary(result as unknown as WorkspaceMcpSessionSummary);
  }

  if (action === 'open') {
    return { sessionId, opened: true };
  }
  if (action === 'close') {
    return { sessionId, closed: true };
  }
  return { sessionId, created: true };
}

function normalizeSessionFsMutationResult(action: 'create' | 'write' | 'read' | 'delete' | 'rename' | 'scaffold', payload: {
  sessionId: string;
  path: string;
  kind?: 'file' | 'folder';
  content?: string;
  previousPath?: string;
  template?: 'agents' | 'skill' | 'hook' | 'eval';
}, result: unknown) {
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

function normalizeWorktreeItems(items: readonly WorkspaceMcpWorktreeItem[]) {
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

function buildDefaultSessionState(session: WorkspaceMcpSessionState, input: WorkspaceMcpWriteSessionInput): WorkspaceMcpSessionState {
  return {
    id: session.id,
    name: input.name ?? session.name,
    isOpen: session.isOpen,
    mode: input.mode ?? session.mode,
    provider: input.provider ?? session.provider ?? null,
    modelId: input.modelId ?? session.modelId ?? null,
    cwd: input.cwd ?? session.cwd ?? null,
    messages: input.message
      ? [...session.messages, { role: 'user', content: input.message }]
      : session.messages,
  };
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

function registerWorkspaceIntrospectionTools(modelContext: ModelContext, workspaceName: string, signal: AbortSignal | undefined): void {
  const toolRegistry = getModelContextRegistry(modelContext);
  const resourceRegistry = getModelContextResourceRegistry(modelContext);
  const promptRegistry = getModelContextPromptRegistry(modelContext);
  const promptTemplateRegistry = getModelContextPromptTemplateRegistry(modelContext);

  modelContext.registerTool({
    name: 'list_tools',
    title: 'List tools',
    description: `List tools currently registered in the ${workspaceName} workspace MCP surface.`,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => toolRegistry
      .list()
      .map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema || null,
        readOnlyHint: tool.readOnlyHint,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'list_resources',
    title: 'List resources',
    description: `List resources currently registered in the ${workspaceName} workspace MCP surface.`,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => resourceRegistry
      .list()
      .map((resource) => ({
        uri: resource.uri,
        title: resource.title,
        description: resource.description,
        mimeType: resource.mimeType,
      }))
      .sort((left, right) => left.uri.localeCompare(right.uri)),
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'list_prompts',
    title: 'List prompts',
    description: `List prompts currently registered in the ${workspaceName} workspace MCP surface.`,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => promptRegistry
      .list()
      .map((prompt) => ({
        name: prompt.name,
        title: prompt.title,
        description: prompt.description,
        inputSchema: prompt.inputSchema || null,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'list_prompt_templates',
    title: 'List prompt templates',
    description: `List prompt templates currently registered in the ${workspaceName} workspace MCP surface.`,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => promptTemplateRegistry
      .list()
      .map((promptTemplate) => ({
        name: promptTemplate.name,
        title: promptTemplate.title,
        description: promptTemplate.description,
        inputSchema: promptTemplate.inputSchema || null,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    annotations: { readOnlyHint: true },
  }, { signal });
}

function registerWorkspaceFileSurface(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    workspaceName,
    workspaceFiles,
    onOpenFile,
    onCreateWorkspaceFile,
    onWriteWorkspaceFile,
    onDeleteWorkspaceFile,
    signal,
  } = options;

  modelContext.registerTool({
    name: 'list_files',
    title: 'List files',
    description: `List files available in the ${workspaceName} workspace.`,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => workspaceFiles
      .map(toWorkspaceFileSummary)
      .sort((left, right) => left.path.localeCompare(right.path)),
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'read_file',
    title: 'Read file',
    description: `Read a workspace file from the ${workspaceName} workspace by path or files://workspace URI.`,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        uri: { type: 'string' },
      },
      anyOf: [{ required: ['path'] }, { required: ['uri'] }],
      additionalProperties: false,
    },
    execute: async (input: object) => toWorkspaceFileResult(
      workspaceName,
      readWorkspaceFile(workspaceName, workspaceFiles, input as WorkspaceFileInput),
    ),
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'open_file',
    title: 'Open file',
    description: `Open a workspace file from the ${workspaceName} workspace by path or files://workspace URI.`,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        uri: { type: 'string' },
      },
      anyOf: [{ required: ['path'] }, { required: ['uri'] }],
      additionalProperties: false,
    },
    execute: async (input: object) => {
      const file = readWorkspaceFile(workspaceName, workspaceFiles, input as WorkspaceFileInput);
      onOpenFile?.(file.path);
      return toWorkspaceFileResult(workspaceName, file);
    },
  }, { signal });

  if (onCreateWorkspaceFile) {
    modelContext.registerTool({
      name: 'create_file',
      title: 'Create file',
      description: `Create a workspace file in ${workspaceName}.`,
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as { path?: string; content?: string };
        const path = normalizeWorkspaceFilePath(String(typedInput.path ?? ''));
        const content = String(typedInput.content ?? '');
        const result = await onCreateWorkspaceFile({ path, content });
        const file = isPlainObject(result) && typeof result.path === 'string' && typeof result.content === 'string' && typeof result.updatedAt === 'string'
          ? result as WorkspaceMcpFile
          : { path, content, updatedAt: new Date().toISOString() };
        return toWorkspaceFileResult(workspaceName, file);
      },
    }, { signal });
  }

  if (onWriteWorkspaceFile) {
    modelContext.registerTool({
      name: 'write_file',
      title: 'Write file',
      description: `Write a workspace file in ${workspaceName}.`,
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as { path?: string; content?: string };
        const path = normalizeWorkspaceFilePath(String(typedInput.path ?? ''));
        const content = String(typedInput.content ?? '');
        const result = await onWriteWorkspaceFile({ path, content });
        const file = isPlainObject(result) && typeof result.path === 'string' && typeof result.content === 'string' && typeof result.updatedAt === 'string'
          ? result as WorkspaceMcpFile
          : { path, content, updatedAt: new Date().toISOString() };
        return toWorkspaceFileResult(workspaceName, file);
      },
    }, { signal });
  }

  if (onDeleteWorkspaceFile) {
    modelContext.registerTool({
      name: 'delete_file',
      title: 'Delete file',
      description: `Delete a workspace file from ${workspaceName}.`,
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const path = normalizeWorkspaceFilePath(String((input as { path?: string }).path ?? ''));
        const result = await onDeleteWorkspaceFile({ path });
        return normalizeDeleteWorkspaceFileResult(path, result);
      },
    }, { signal });
  }

  for (const file of workspaceFiles) {
    modelContext.registerResource({
      uri: toWorkspaceFileUri(file.path),
      title: basename(file.path),
      description: `Workspace file ${file.path} from ${workspaceName}.`,
      mimeType: detectMimeType(file.path),
      read: async () => ({
        uri: toWorkspaceFileUri(file.path),
        mimeType: detectMimeType(file.path),
        text: file.content,
      }),
    }, { signal });
  }

  modelContext.registerPrompt({
    name: 'workspace_overview',
    title: 'Workspace overview',
    description: `Prompt for summarizing the ${workspaceName} workspace.`,
    render: async () => toWorkspaceOverviewMessages(workspaceName, workspaceFiles),
  }, { signal });

  modelContext.registerPromptTemplate({
    name: 'workspace_file',
    title: 'Workspace file',
    description: `Prompt template for opening a specific workspace file in ${workspaceName}.`,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        uri: { type: 'string' },
      },
      anyOf: [{ required: ['path'] }, { required: ['uri'] }],
      additionalProperties: false,
    },
    render: async (input: object) => {
      const file = readWorkspaceFile(workspaceName, workspaceFiles, input as WorkspaceFileInput);
      return toWorkspaceFilePrompt(workspaceName, file);
    },
  }, { signal });
}

function registerBrowserPageSurface(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    browserPages = [],
    onCreateBrowserPage,
    onOpenBrowserPage,
    onCloseBrowserPage,
    signal,
  } = options;

  const hasBrowserTools = browserPages.length > 0 || onCreateBrowserPage || onOpenBrowserPage || onCloseBrowserPage;
  if (!hasBrowserTools) {
    return;
  }

  modelContext.registerTool({
    name: 'list_browser_pages',
    title: 'List browser pages',
    description: 'List browser pages available in the active workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => browserPages.map(toBrowserPageResult),
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'read_browser_page',
    title: 'Read browser page',
    description: 'Read browser page metadata from the active workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
      },
      required: ['pageId'],
      additionalProperties: false,
    },
    execute: async (input: object) => toBrowserPageResult(readBrowserPage(browserPages, input as BrowserPageInput)),
    annotations: { readOnlyHint: true },
  }, { signal });

  if (onCreateBrowserPage) {
    modelContext.registerTool({
      name: 'create_browser_page',
      title: 'Create browser page',
      description: 'Create a browser page in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          title: { type: 'string' },
        },
        required: ['url'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as { url?: string; title?: string };
        const url = String(typedInput.url ?? '').trim();
        if (!url) {
          throw new TypeError('Browser page creation requires a url.');
        }
        const title = typeof typedInput.title === 'string' && typedInput.title.trim() ? typedInput.title.trim() : undefined;
        const result = await onCreateBrowserPage({ url, title });
        return normalizeBrowserPageMutationResult('create', '', result);
      },
    }, { signal });
  }

  if (onOpenBrowserPage) {
    modelContext.registerTool({
      name: 'open_browser_page',
      title: 'Open browser page',
      description: 'Open an existing browser page in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string' },
        },
        required: ['pageId'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const page = readBrowserPage(browserPages, input as BrowserPageInput);
        await onOpenBrowserPage(page.id);
        return normalizeBrowserPageMutationResult('open', page.id, undefined);
      },
    }, { signal });
  }

  if (onCloseBrowserPage) {
    modelContext.registerTool({
      name: 'close_browser_page',
      title: 'Close browser page',
      description: 'Close a browser page in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string' },
        },
        required: ['pageId'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const page = readBrowserPage(browserPages, input as BrowserPageInput);
        await onCloseBrowserPage(page.id);
        return normalizeBrowserPageMutationResult('close', page.id, undefined);
      },
    }, { signal });
  }
}

function registerSessionSummarySurface(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    workspaceName,
    sessions = [],
    getSessionState,
    onCreateSession,
    onOpenSession,
    onCloseSession,
    onWriteSession,
    signal,
  } = options;

  const hasSessionTools = sessions.length > 0 || onCreateSession || onOpenSession || onCloseSession;
  if (!hasSessionTools) {
    return;
  }

  modelContext.registerTool({
    name: 'list_sessions',
    title: 'List sessions',
    description: 'List sessions available in the active workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => sessions.map(toSessionSummary),
    annotations: { readOnlyHint: true },
  }, { signal });

  if (onCreateSession) {
    modelContext.registerTool({
      name: 'create_session',
      title: 'Create session',
      description: 'Create a session in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const name = typeof (input as { name?: string }).name === 'string'
          ? (input as { name?: string }).name?.trim() || undefined
          : undefined;
        const result = await onCreateSession({ name });
        return normalizeSessionMutationResult('create', '', result);
      },
    }, { signal });
  }

  if (onOpenSession) {
    modelContext.registerTool({
      name: 'open_session',
      title: 'Open session',
      description: 'Open a session in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const session = readSessionSummary(sessions, input as SessionInput);
        await onOpenSession(session.id);
        return normalizeSessionMutationResult('open', session.id, undefined);
      },
    }, { signal });
  }

  if (onCloseSession) {
    modelContext.registerTool({
      name: 'close_session',
      title: 'Close session',
      description: 'Close a session in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const session = readSessionSummary(sessions, input as SessionInput);
        await onCloseSession(session.id);
        return normalizeSessionMutationResult('close', session.id, undefined);
      },
    }, { signal });
  }

  if (getSessionState) {
    modelContext.registerTool({
      name: 'read_session',
      title: 'Read session',
      description: 'Read an open session from the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        additionalProperties: false,
      },
      execute: async (input: object) => toSessionStateResult(
        workspaceName,
        readOpenSessionState(sessions, getSessionState, input as SessionInput),
      ),
      annotations: { readOnlyHint: true },
    }, { signal });
  }

  if (onWriteSession) {
    modelContext.registerTool({
      name: 'write_session',
      title: 'Write session',
      description: 'Post a message or update runtime session controls in the active workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          name: { type: 'string' },
          message: { type: 'string' },
          provider: { type: 'string' },
          modelId: { type: 'string' },
          mode: { type: 'string', enum: ['agent', 'terminal'] },
          cwd: { type: 'string' },
        },
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as Partial<WorkspaceMcpWriteSessionInput>;
        const session = resolveSessionSummaryInput(sessions, typedInput);
        const currentState = readOpenSessionState(sessions, getSessionState, { sessionId: session.id });
        const update: WorkspaceMcpWriteSessionInput = {
          sessionId: session.id,
          ...(typeof typedInput.name === 'string' && typedInput.name.trim() ? { name: typedInput.name.trim() } : {}),
          ...(typeof typedInput.message === 'string' && typedInput.message.trim() ? { message: typedInput.message } : {}),
          ...(typeof typedInput.provider === 'string' && typedInput.provider.trim() ? { provider: typedInput.provider.trim() } : {}),
          ...(typeof typedInput.modelId === 'string' && typedInput.modelId.trim() ? { modelId: typedInput.modelId.trim() } : {}),
          ...(typedInput.mode ? { mode: typedInput.mode } : {}),
          ...(typeof typedInput.cwd === 'string' && typedInput.cwd.trim() ? { cwd: typedInput.cwd.trim() } : {}),
        };

        if (!update.name && !update.message && !update.provider && !update.modelId && !update.mode && !update.cwd) {
          throw new TypeError('write_session requires at least one of name, message, provider, modelId, mode, or cwd.');
        }

        const result = await onWriteSession(update);
        const nextState = isPlainObject(result)
          && typeof result.id === 'string'
          && typeof result.name === 'string'
          && typeof result.mode === 'string'
          && Array.isArray((result as WorkspaceMcpSessionState).messages)
          ? result as WorkspaceMcpSessionState
          : buildDefaultSessionState(currentState, update);
        return toSessionStateResult(workspaceName, {
          ...nextState,
          id: session.id,
          name: nextState.name || session.name,
          isOpen: session.isOpen,
        });
      },
    }, { signal });
  }
}

function registerSessionFsSurface(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    sessionFsEntries = [],
    onCreateSessionFsEntry,
    onReadSessionFsFile,
    onWriteSessionFsFile,
    onDeleteSessionFsEntry,
    onRenameSessionFsEntry,
    onScaffoldSessionFsEntry,
    signal,
  } = options;

  const hasSessionFsTools = sessionFsEntries.length > 0
    || onCreateSessionFsEntry
    || onReadSessionFsFile
    || onWriteSessionFsFile
    || onDeleteSessionFsEntry
    || onRenameSessionFsEntry
    || onScaffoldSessionFsEntry;
  if (!hasSessionFsTools) {
    return;
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
      const entry = readSessionFsEntry(sessionFsEntries, input as SessionFsPathInput);
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
        const entry = readSessionFsEntry(sessionFsEntries, input as SessionFsPathInput);
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
        const sessionId = String(typedInput.sessionId ?? '').trim();
        const path = normalizeSessionFsPath(String(typedInput.path ?? ''));
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
        const sessionId = String(typedInput.sessionId ?? '').trim();
        const path = normalizeSessionFsPath(String(typedInput.path ?? ''));
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
        const sessionId = String(typedInput.sessionId ?? '').trim();
        const path = normalizeSessionFsPath(String(typedInput.path ?? ''));
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
        const sessionId = String(typedInput.sessionId ?? '').trim();
        const path = normalizeSessionFsPath(String(typedInput.path ?? ''));
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
        const sessionId = String(typedInput.sessionId ?? '').trim();
        const path = normalizeSessionFsPath(String(typedInput.path ?? ''));
        const newPath = typeof typedInput.newPath === 'string' && typedInput.newPath.trim()
          ? normalizeSessionFsPath(typedInput.newPath)
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
        const sessionId = String(typedInput.sessionId ?? '').trim();
        const basePath = normalizeSessionFsPath(String(typedInput.basePath ?? ''));
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

function registerWorktreeContextSurface(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    worktreeItems = [],
    getWorktreeContextActions,
    onInvokeWorktreeContextAction,
    signal,
  } = options;

  const hasWorktreeTools = worktreeItems.length > 0 || getWorktreeContextActions || onInvokeWorktreeContextAction;
  if (!hasWorktreeTools) {
    return;
  }

  modelContext.registerTool({
    name: 'list_worktree_items',
    title: 'List worktree items',
    description: 'List actionable worktree items from the active workspace tree.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: async () => normalizeWorktreeItems(worktreeItems),
    annotations: { readOnlyHint: true },
  }, { signal });

  if (getWorktreeContextActions) {
    modelContext.registerTool({
      name: 'list_worktree_context_actions',
      title: 'List worktree context actions',
      description: 'List context menu actions available for a worktree item.',
      inputSchema: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          itemType: { type: 'string' },
        },
        required: ['itemId', 'itemType'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const item = readWorktreeItem(worktreeItems, input as WorktreeItemInput);
        return [...getWorktreeContextActions({ itemId: item.id, itemType: item.itemType })];
      },
      annotations: { readOnlyHint: true },
    }, { signal });
  }

  if (onInvokeWorktreeContextAction) {
    modelContext.registerTool({
      name: 'invoke_worktree_context_action',
      title: 'Invoke worktree context action',
      description: 'Invoke a context menu action for a worktree item.',
      inputSchema: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          itemType: { type: 'string' },
          actionId: { type: 'string' },
          args: { type: 'object', additionalProperties: true },
        },
        required: ['itemId', 'itemType', 'actionId'],
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as WorktreeActionInput;
        const item = readWorktreeItem(worktreeItems, typedInput);
        const actionId = String(typedInput.actionId ?? '').trim();
        if (!actionId) {
          throw new TypeError('Worktree context action input must include an actionId.');
        }
        return onInvokeWorktreeContextAction({
          itemId: item.id,
          itemType: item.itemType,
          actionId,
          args: isPlainObject(typedInput.args) ? typedInput.args : {},
        });
      },
    }, { signal });
  }
}

export function registerWorkspaceTools(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const { workspaceName, signal } = options;

  registerWorkspaceIntrospectionTools(modelContext, workspaceName, signal);
  registerWorkspaceFileSurface(modelContext, options);
  registerBrowserPageSurface(modelContext, options);
  registerSessionSummarySurface(modelContext, options);
  registerSessionFsSurface(modelContext, options);
  registerWorktreeContextSurface(modelContext, options);
}

export function registerWorkspaceFileTools(modelContext: ModelContext, options: RegisterWorkspaceFileToolsOptions): void {
  registerWorkspaceTools(modelContext, options);
}

export function registerSessionTools(modelContext: ModelContext, options: RegisterSessionToolsOptions): void {
  const { workspaceName, session, onWriteSession, signal } = options;

  modelContext.registerTool({
    name: 'read_session',
    title: 'Read session',
    description: `Read the active session in ${workspaceName}.`,
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
      },
      additionalProperties: false,
    },
    execute: async (input: object) => {
      const requestedSessionId = (input as SessionInput).sessionId;
      if (typeof requestedSessionId === 'string' && requestedSessionId.trim() && requestedSessionId !== session.id) {
        throw new DOMException(`Session "${requestedSessionId}" is not the active session. Open it first before reading.`, 'NotFoundError');
      }
      return toSessionStateResult(workspaceName, session);
    },
    annotations: { readOnlyHint: true },
  }, { signal });

  if (onWriteSession) {
    modelContext.registerTool({
      name: 'write_session',
      title: 'Write session',
      description: `Post a message or update session controls for the active session in ${workspaceName}.`,
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          name: { type: 'string' },
          message: { type: 'string' },
          provider: { type: 'string' },
          modelId: { type: 'string' },
          mode: { type: 'string', enum: ['agent', 'terminal'] },
          cwd: { type: 'string' },
        },
        additionalProperties: false,
      },
      execute: async (input: object) => {
        const typedInput = input as Partial<WorkspaceMcpWriteSessionInput>;
        const sessionId = typeof typedInput.sessionId === 'string' && typedInput.sessionId.trim()
          ? typedInput.sessionId.trim()
          : session.id;
        if (sessionId !== session.id) {
          throw new DOMException(`Session "${sessionId}" is not the active session. Open it first before writing.`, 'NotFoundError');
        }

        const update: WorkspaceMcpWriteSessionInput = {
          sessionId,
          ...(typeof typedInput.name === 'string' && typedInput.name.trim() ? { name: typedInput.name.trim() } : {}),
          ...(typeof typedInput.message === 'string' && typedInput.message.trim() ? { message: typedInput.message } : {}),
          ...(typeof typedInput.provider === 'string' && typedInput.provider.trim() ? { provider: typedInput.provider.trim() } : {}),
          ...(typeof typedInput.modelId === 'string' && typedInput.modelId.trim() ? { modelId: typedInput.modelId.trim() } : {}),
          ...(typedInput.mode ? { mode: typedInput.mode } : {}),
          ...(typeof typedInput.cwd === 'string' && typedInput.cwd.trim() ? { cwd: typedInput.cwd.trim() } : {}),
        };

        if (!update.name && !update.message && !update.provider && !update.modelId && !update.mode && !update.cwd) {
          throw new TypeError('write_session requires at least one of name, message, provider, modelId, mode, or cwd.');
        }

        const result = await onWriteSession(update);
        const nextSession = isPlainObject(result)
          && typeof result.id === 'string'
          && typeof result.name === 'string'
          && typeof result.mode === 'string'
          && Array.isArray((result as WorkspaceMcpSessionState).messages)
          ? result as WorkspaceMcpSessionState
          : buildDefaultSessionState(session, update);
        return toSessionStateResult(workspaceName, nextSession);
      },
    }, { signal });
  }
}