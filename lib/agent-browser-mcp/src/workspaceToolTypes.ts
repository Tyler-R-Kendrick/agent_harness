import type { ModelContextRegisterToolOptions } from '../../webmcp/src/index';

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

export interface WorkspaceMcpBrowserPageHistoryEntry {
  url: string;
  title: string;
  timestamp: number;
}

export interface WorkspaceMcpBrowserPageHistory {
  pageId: string;
  currentIndex: number;
  entries: readonly WorkspaceMcpBrowserPageHistoryEntry[];
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
  agentId?: string | null;
  toolIds?: readonly string[];
  cwd?: string | null;
  messages: readonly WorkspaceMcpSessionMessage[];
}

export interface WorkspaceMcpSessionTool {
  id: string;
  label: string;
  description?: string;
  group: string;
  groupLabel: string;
}

export interface WorkspaceMcpSessionToolState extends WorkspaceMcpSessionTool {
  selected: boolean;
}

export interface WorkspaceMcpSessionFsEntry {
  sessionId: string;
  path: string;
  kind: 'file' | 'folder';
  isRoot?: boolean;
  content?: string | null;
}

export type WorkspaceMcpFilesystemTargetType = 'workspace-file' | 'session-drive' | 'session-fs-entry';
export type WorkspaceMcpFilesystemEntryKind = 'drive' | 'folder' | 'file';

export interface WorkspaceMcpFilesystemEntry {
  targetType: WorkspaceMcpFilesystemTargetType;
  kind: WorkspaceMcpFilesystemEntryKind;
  label: string;
  path?: string;
  sessionId?: string;
  uri?: string;
  updatedAt?: string;
  mounted?: boolean;
  isRoot?: boolean;
}

export interface WorkspaceMcpFilesystemProperties extends WorkspaceMcpFilesystemEntry {
  mimeType?: string | null;
  sizeBytes?: number | null;
  preview?: string | null;
  childCount?: number | null;
}

export interface WorkspaceMcpFilesystemHistoryRecord {
  id: string;
  label: string;
  timestamp: number;
  isCurrent?: boolean;
  canRollback?: boolean;
  detail?: string;
}

export interface WorkspaceMcpFilesystemHistoryResult {
  targetType: WorkspaceMcpFilesystemTargetType;
  kind?: WorkspaceMcpFilesystemEntryKind;
  label?: string;
  path?: string;
  sessionId?: string;
  rolledBackToId?: string;
  records: readonly WorkspaceMcpFilesystemHistoryRecord[];
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

export interface WorkspaceMcpWorktreeRenderPaneState {
  itemId: string;
  itemType: WorkspaceMcpWorktreeItemType;
  isOpen: boolean;
  supported: boolean;
}

export interface WorkspaceMcpWorktreeContextMenuState {
  itemId: string;
  itemType: WorkspaceMcpWorktreeItemType;
  isOpen: boolean;
  supported: boolean;
}

export type WorkspaceMcpRenderPaneType = 'browser-page' | 'session' | 'workspace-file';

export interface WorkspaceMcpRenderPane {
  id: string;
  paneType: WorkspaceMcpRenderPaneType;
  itemId: string;
  label: string;
  path?: string;
  url?: string;
}

export interface WorkspaceMcpSessionDrive {
  sessionId: string;
  label: string;
  mounted: boolean;
}

export interface WorkspaceMcpClipboardEntry {
  id: string;
  label: string;
  text: string;
  timestamp: number;
  isActive: boolean;
}

export interface WorkspaceMcpWriteSessionInput {
  sessionId: string;
  name?: string;
  message?: string;
  provider?: string;
  modelId?: string;
  agentId?: string | null;
  toolIds?: readonly string[];
  mode?: 'agent' | 'terminal';
  cwd?: string;
}

export interface RegisterWorkspaceToolsOptions extends RegisterWorkspaceFileToolsOptions {
  browserPages?: readonly WorkspaceMcpBrowserPage[];
  renderPanes?: readonly WorkspaceMcpRenderPane[];
  sessions?: readonly WorkspaceMcpSessionSummary[];
  sessionTools?: readonly WorkspaceMcpSessionTool[];
  getSessionTools?: () => readonly WorkspaceMcpSessionTool[];
  sessionDrives?: readonly WorkspaceMcpSessionDrive[];
  clipboardEntries?: readonly WorkspaceMcpClipboardEntry[];
  getSessionState?: (sessionId: string) => WorkspaceMcpSessionState | null | undefined;
  getBrowserPageHistory?: (pageId: string) => WorkspaceMcpBrowserPageHistory | null | undefined;
  sessionFsEntries?: readonly WorkspaceMcpSessionFsEntry[];
  worktreeItems?: readonly WorkspaceMcpWorktreeItem[];
  onCreateBrowserPage?: (input: { url: string; title?: string }) => Promise<WorkspaceMcpBrowserPage | void> | WorkspaceMcpBrowserPage | void;
  onNavigateBrowserPage?: (input: { pageId: string; url: string; title?: string }) => Promise<WorkspaceMcpBrowserPage | void> | WorkspaceMcpBrowserPage | void;
  onNavigateBrowserPageHistory?: (input: { pageId: string; direction: 'back' | 'forward' }) => Promise<WorkspaceMcpBrowserPage | void> | WorkspaceMcpBrowserPage | void;
  onRefreshBrowserPage?: (pageId: string) => Promise<WorkspaceMcpBrowserPage | void> | WorkspaceMcpBrowserPage | void;
  onCloseRenderPane?: (paneId: string) => Promise<unknown> | unknown;
  onMoveRenderPane?: (input: { paneId: string; toIndex: number }) => Promise<unknown> | unknown;
  onCreateSession?: (input: { name?: string }) => Promise<WorkspaceMcpSessionSummary | void> | WorkspaceMcpSessionSummary | void;
  onWriteSession?: (input: WorkspaceMcpWriteSessionInput) => Promise<WorkspaceMcpSessionState | void> | WorkspaceMcpSessionState | void;
  onCreateWorkspaceFile?: (input: { path: string; content: string }) => Promise<WorkspaceMcpFile | void> | WorkspaceMcpFile | void;
  onWriteWorkspaceFile?: (input: { path: string; content: string }) => Promise<WorkspaceMcpFile | void> | WorkspaceMcpFile | void;
  onDeleteWorkspaceFile?: (input: { path: string }) => Promise<unknown> | unknown;
  onMoveWorkspaceFile?: (input: { path: string; targetPath: string }) => Promise<WorkspaceMcpFile | void> | WorkspaceMcpFile | void;
  onDuplicateWorkspaceFile?: (input: { path: string; targetPath: string }) => Promise<WorkspaceMcpFile | void> | WorkspaceMcpFile | void;
  onSymlinkWorkspaceFile?: (input: { path: string; targetPath: string }) => Promise<WorkspaceMcpFile | void> | WorkspaceMcpFile | void;
  onMountSessionDrive?: (sessionId: string) => Promise<WorkspaceMcpSessionDrive | void> | WorkspaceMcpSessionDrive | void;
  onUnmountSessionDrive?: (sessionId: string) => Promise<WorkspaceMcpSessionDrive | void> | WorkspaceMcpSessionDrive | void;
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
  getFilesystemProperties?: (input: {
    targetType: WorkspaceMcpFilesystemTargetType;
    path?: string;
    sessionId?: string;
  }) => WorkspaceMcpFilesystemProperties | null | undefined;
  getFilesystemHistory?: (input: {
    targetType: WorkspaceMcpFilesystemTargetType;
    path?: string;
    sessionId?: string;
  }) => WorkspaceMcpFilesystemHistoryResult | null | undefined;
  onRollbackFilesystemHistory?: (input: {
    targetType: WorkspaceMcpFilesystemTargetType;
    path?: string;
    sessionId?: string;
    recordId: string;
  }) => Promise<WorkspaceMcpFilesystemHistoryResult | void> | WorkspaceMcpFilesystemHistoryResult | void;
  getWorktreeContextActions?: (input: {
    itemId: string;
    itemType: WorkspaceMcpWorktreeItemType;
  }) => readonly WorkspaceMcpContextAction[];
  getWorktreeRenderPaneState?: (input: {
    itemId: string;
    itemType: WorkspaceMcpWorktreeItemType;
  }) => WorkspaceMcpWorktreeRenderPaneState | null | undefined;
  onToggleWorktreeRenderPane?: (input: {
    itemId: string;
    itemType: WorkspaceMcpWorktreeItemType;
  }) => Promise<WorkspaceMcpWorktreeRenderPaneState | void> | WorkspaceMcpWorktreeRenderPaneState | void;
  getWorktreeContextMenuState?: (input: {
    itemId: string;
    itemType: WorkspaceMcpWorktreeItemType;
  }) => WorkspaceMcpWorktreeContextMenuState | null | undefined;
  onToggleWorktreeContextMenu?: (input: {
    itemId: string;
    itemType: WorkspaceMcpWorktreeItemType;
  }) => Promise<WorkspaceMcpWorktreeContextMenuState | void> | WorkspaceMcpWorktreeContextMenuState | void;
  onRestoreClipboardEntry?: (entryId: string) => Promise<WorkspaceMcpClipboardEntry | void> | WorkspaceMcpClipboardEntry | void;
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
  sessionTools?: readonly WorkspaceMcpSessionTool[];
  onWriteSession?: (input: WorkspaceMcpWriteSessionInput) => Promise<WorkspaceMcpSessionState | void> | WorkspaceMcpSessionState | void;
}