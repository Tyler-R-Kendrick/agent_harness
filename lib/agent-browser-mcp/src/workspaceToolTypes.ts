import type { ModelContextRegisterToolOptions } from '@agent-harness/webmcp';

export interface WorkspaceMcpFile {
  path: string;
  content: string;
  updatedAt: string;
}

export interface WorkspaceMcpArtifactFile {
  path: string;
  content: string;
  mediaType?: string;
  updatedAt?: string;
}

export interface WorkspaceMcpArtifact {
  id: string;
  title: string;
  description?: string;
  kind?: string;
  sourceSessionId?: string;
  createdAt: string;
  updatedAt: string;
  files: readonly WorkspaceMcpArtifactFile[];
  references: readonly string[];
  versions?: readonly unknown[];
}

export interface WorkspaceMcpWriteArtifactInput {
  id?: string;
  title?: string;
  description?: string;
  kind?: string;
  sourceSessionId?: string;
  references?: readonly string[];
  files: readonly WorkspaceMcpArtifactFile[];
}

export interface RegisterWorkspaceFileToolsOptions extends ModelContextRegisterToolOptions {
  workspaceName: string;
  workspaceFiles: readonly WorkspaceMcpFile[];
  artifacts?: readonly WorkspaceMcpArtifact[];
  onCreateArtifact?: (input: WorkspaceMcpWriteArtifactInput) => WorkspaceMcpArtifact | Promise<WorkspaceMcpArtifact>;
  onUpdateArtifact?: (artifactId: string, input: WorkspaceMcpWriteArtifactInput) => WorkspaceMcpArtifact | Promise<WorkspaceMcpArtifact>;
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
  | 'artifact'
  | 'artifact-file'
  | 'session-fs-entry'
  | 'clipboard';

export interface WorkspaceMcpWorktreeItem {
  id: string;
  itemType: WorkspaceMcpWorktreeItemType;
  label: string;
  path?: string;
  sessionId?: string;
  artifactId?: string;
  artifactFilePath?: string;
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

export type WorkspaceMcpRenderPaneType = 'dashboard' | 'browser-page' | 'session' | 'workspace-file' | 'artifact';

export interface WorkspaceMcpRenderPane {
  id: string;
  paneType: WorkspaceMcpRenderPaneType;
  itemId: string;
  label: string;
  path?: string;
  artifactId?: string;
  artifactFilePath?: string;
  url?: string;
}

export interface WorkspaceMcpHarnessElement {
  id: string;
  type: string;
  title: string;
  editable: boolean;
  slot: string;
  path: string;
}

export interface WorkspaceMcpHarnessElementSpec {
  id: string;
  type: string;
  slot?: string;
  props?: Record<string, unknown>;
  children?: readonly string[];
  editable?: boolean;
}

export interface WorkspaceMcpHarnessElementPatch {
  elementId: string;
  props: Record<string, unknown>;
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

export interface WorkspaceMcpUserContextMemory {
  id: string;
  label: string;
  value: string;
  source: 'workspace-memory' | 'session-memory';
  updatedAt: string;
}

export interface WorkspaceMcpUserContextMemoryResult {
  status: 'found' | 'empty';
  query?: string;
  memories: readonly WorkspaceMcpUserContextMemory[];
}

export type WorkspaceMcpBrowserLocationResult =
  | {
    status: 'available';
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  }
  | {
    status: 'denied' | 'unavailable';
    reason: string;
  };

export interface WorkspaceMcpElicitationField {
  id: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}

export interface WorkspaceMcpElicitationRequest {
  prompt: string;
  reason?: string;
  fields: readonly WorkspaceMcpElicitationField[];
}

export interface WorkspaceMcpElicitationResult {
  status: 'needs_user_input';
  requestId: string;
  prompt: string;
  fields: readonly WorkspaceMcpElicitationField[];
}

export interface WorkspaceMcpSecretRequest {
  name?: string;
  prompt: string;
  reason?: string;
}

export type WorkspaceMcpSecretRequestResult =
  | {
    status: 'needs_secret';
    requestId: string;
    name: string;
    prompt: string;
  }
  | {
    status: 'secret_ref_created';
    requestId: string;
    name: string;
    secretRef: string;
  };

export interface WorkspaceMcpSearchWebRequest {
  query: string;
  limit: number;
}

export interface WorkspaceMcpSearchWebResultItem {
  title: string;
  url: string;
  snippet: string;
}

export interface WorkspaceMcpSearchWebResult {
  status: 'found' | 'empty' | 'unavailable';
  query: string;
  results: readonly WorkspaceMcpSearchWebResultItem[];
  reason?: string;
}

export interface WorkspaceMcpReadWebPageRequest {
  url: string;
}

export interface WorkspaceMcpWebPageLink {
  text: string;
  url: string;
}

export interface WorkspaceMcpWebPageEntity {
  name: string;
  url?: string;
  evidence: string;
}

export interface WorkspaceMcpWebPageObservation {
  kind: 'json-ld' | 'page-link' | 'heading' | 'text-span';
  label: string;
  url?: string;
  evidence: string;
  localContext?: string;
  sourceUrl: string;
}

export interface WorkspaceMcpReadWebPageResult {
  status: 'read' | 'unavailable' | 'blocked';
  url: string;
  title?: string;
  text?: string;
  links: readonly WorkspaceMcpWebPageLink[];
  jsonLd: readonly unknown[];
  entities: readonly WorkspaceMcpWebPageEntity[];
  observations: readonly WorkspaceMcpWebPageObservation[];
  reason?: string;
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
  harnessElements?: readonly WorkspaceMcpHarnessElement[];
  sessions?: readonly WorkspaceMcpSessionSummary[];
  sessionTools?: readonly WorkspaceMcpSessionTool[];
  getSessionTools?: () => readonly WorkspaceMcpSessionTool[];
  sessionDrives?: readonly WorkspaceMcpSessionDrive[];
  clipboardEntries?: readonly WorkspaceMcpClipboardEntry[];
  getSessionState?: (sessionId: string) => WorkspaceMcpSessionState | null | undefined;
  getBrowserPageHistory?: (pageId: string) => WorkspaceMcpBrowserPageHistory | null | undefined;
  getHarnessElement?: (elementId: string) => WorkspaceMcpHarnessElementSpec | null | undefined;
  getHarnessPromptContext?: () => readonly string[];
  getUserContextMemory?: (input: {
    query?: string;
    limit: number;
  }) => Promise<WorkspaceMcpUserContextMemoryResult> | WorkspaceMcpUserContextMemoryResult;
  getBrowserLocation?: () => Promise<WorkspaceMcpBrowserLocationResult> | WorkspaceMcpBrowserLocationResult;
  onElicitUserInput?: (
    input: WorkspaceMcpElicitationRequest
  ) => Promise<WorkspaceMcpElicitationResult> | WorkspaceMcpElicitationResult;
  onRequestSecret?: (
    input: WorkspaceMcpSecretRequest
  ) => Promise<WorkspaceMcpSecretRequestResult> | WorkspaceMcpSecretRequestResult;
  onSearchWeb?: (
    input: WorkspaceMcpSearchWebRequest
  ) => Promise<WorkspaceMcpSearchWebResult> | WorkspaceMcpSearchWebResult;
  onReadWebPage?: (
    input: WorkspaceMcpReadWebPageRequest
  ) => Promise<WorkspaceMcpReadWebPageResult> | WorkspaceMcpReadWebPageResult;
  sessionFsEntries?: readonly WorkspaceMcpSessionFsEntry[];
  worktreeItems?: readonly WorkspaceMcpWorktreeItem[];
  onCreateBrowserPage?: (input: { url: string; title?: string }) => Promise<WorkspaceMcpBrowserPage | void> | WorkspaceMcpBrowserPage | void;
  onNavigateBrowserPage?: (input: { pageId: string; url: string; title?: string }) => Promise<WorkspaceMcpBrowserPage | void> | WorkspaceMcpBrowserPage | void;
  onNavigateBrowserPageHistory?: (input: { pageId: string; direction: 'back' | 'forward' }) => Promise<WorkspaceMcpBrowserPage | void> | WorkspaceMcpBrowserPage | void;
  onRefreshBrowserPage?: (pageId: string) => Promise<WorkspaceMcpBrowserPage | void> | WorkspaceMcpBrowserPage | void;
  onCloseRenderPane?: (paneId: string) => Promise<unknown> | unknown;
  onMoveRenderPane?: (input: { paneId: string; toIndex: number }) => Promise<unknown> | unknown;
  onPatchHarnessElement?: (input: WorkspaceMcpHarnessElementPatch) => Promise<unknown> | unknown;
  onRegenerateHarness?: (input: { prompt: string }) => Promise<unknown> | unknown;
  onRestoreHarness?: () => Promise<unknown> | unknown;
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
    template: 'hook';
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
