import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ToolSet } from 'ai';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import type { HarnessPluginManifest } from 'harness-core';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BellOff,
  Bookmark,
  BookmarkMinus,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Copy,
  Cpu,
  Download,
  File,
  Folder,
  FolderInput,
  FolderOpen,
  GitPullRequest,
  Globe,
  HardDrive,
  History,
  Keyboard,
  KeyRound,
  Layers3,
  Link,
  LoaderCircle,
  MapPin,
  MapPinOff,
  LucideIcon,
  MessageSquare,
  MoreHorizontal,
  PanelRightOpen,
  Pencil,
  Plus,
  Puzzle,
  RefreshCcw,
  Save,
  Search,
  SendHorizontal,
  Settings,
  Share2,
  Square,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Trash2,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { IVoter } from 'logact';
import { Bash } from 'just-bash/browser';
import './App.css';
import {
  branchDAG,
  commitToDAG,
  computeLanes,
  createVersionDAG,
  getTopologicalOrder,
  rollbackToCommit,
  type VersionDAG,
} from './services/versionHistory';
import {
  getAgentDisplayName,
  getAgentInputPlaceholder,
  getAgentProviderSummary,
  getDefaultAgentProvider,
  resolveAgentProviderForTask,
  buildDebuggerToolInstructions,
  buildPlannerToolInstructions,
  buildResearcherToolInstructions,
  buildSecurityReviewToolInstructions,
  hasCodiModels,
  hasCursorAccess,
  hasCodexAccess,
  hasGhcpAccess,
  resolveAgentModelIds,
  resolveRuntimeAgentProvider,
  streamAgentChat,
  type AgentProvider,
  type ModelBackedAgentProvider,
} from './chat-agents';
import { formatToolArgs, summarizeToolCall, summarizeToolResult } from './chat-agents/toolCallSummary';
import { useCopilotReadable } from './services/copilotRuntimeBridge';
import { executeCliCommand } from './tools/cli/exec';
import { COPILOT_RUNTIME_ENABLED } from './config';
import { LocalModelSettings } from './local-model-extension/LocalModelSettings';
import { getSandboxFeatureFlags } from './features/flags';
import { formatOperationDuration } from './features/operation-pane';
import { PullRequestReviewPanel } from './features/pr-review/PullRequestReviewPanel';
// Unified per-turn process visualization surfaced via InlineProcess and
// ProcessPanel below.
import { MarkdownContent } from './utils/MarkdownContent';
import { getFaviconBadgeLabel, normalizeHostname } from './utils/favicon';
import { SharedChatModal, type SharedChatApi } from './shared-chat/SharedChatModal';
import { fetchCopilotState, type CopilotModelSummary, type CopilotRuntimeState } from './services/copilotApi';
import { fetchCursorState, type CursorModelSummary, type CursorRuntimeState } from './services/cursorApi';
import { fetchCodexState, type CodexModelSummary, type CodexRuntimeState } from './services/codexApi';
import { getModelCapabilities, resolveLanguageModel } from './services/agentProvider';
import {
  BENCHMARK_TASK_CLASSES,
  DEFAULT_BENCHMARK_EVIDENCE_STATE,
  DEFAULT_BENCHMARK_ROUTING_SETTINGS,
  buildBenchmarkRoutingCandidates,
  discoverBenchmarkEvidence,
  getBenchmarkTaskClass,
  inferBenchmarkTaskClass,
  isBenchmarkEvidenceDiscoveryState,
  isBenchmarkRoutingSettings,
  mergeDiscoveredBenchmarkEvidence,
  recommendBenchmarkRoute,
  splitBenchmarkModelRef,
  type BenchmarkEvidenceDiscoveryState,
  type BenchmarkModelRef,
  type BenchmarkRouteRecommendation,
  type BenchmarkRoutingCandidate,
  type BenchmarkRoutingObjective,
  type BenchmarkRoutingSettings,
  type BenchmarkTaskClassId,
} from './services/benchmarkModelRouting';
import {
  DEFAULT_ADVERSARY_TOOL_REVIEW_SETTINGS,
  isAdversaryToolReviewSettings,
  type AdversaryToolReviewSettings,
} from './services/adversaryToolReview';
import {
  DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS,
  buildSecurityReviewPromptContext,
  buildSecurityReviewRunPlan,
  buildScheduledSecurityScanUpdate,
  isSecurityReviewAgentSettings,
  type SecurityReviewAgentSettings,
  type SecurityReviewCadence,
  type SecurityReviewRunPlan,
  type SecurityReviewSeverity,
  type SecurityReviewToolIntegration,
} from './services/securityReviewAgents';
import {
  DEFAULT_PARTNER_AGENT_CONTROL_PLANE_SETTINGS,
  buildPartnerAgentControlPlane,
  buildPartnerAgentPromptContext,
  createPartnerAgentAuditEntry,
  isPartnerAgentControlPlaneSettings,
  type PartnerAgentAuditEntry,
  type PartnerAgentAuditLevel,
  type PartnerAgentControlPlane,
  type PartnerAgentControlPlaneSettings,
} from './services/partnerAgentControlPlane';
import {
  DEFAULT_SCHEDULED_AUTOMATION_STATE,
  buildScheduledAutomationInbox,
  isScheduledAutomationState,
  projectDueScheduledAutomations,
  updateScheduledAutomation,
  type ScheduledAutomation,
  type ScheduledAutomationCadence,
  type ScheduledAutomationNotificationRoute,
  type ScheduledAutomationReviewTrigger,
  type ScheduledAutomationState,
} from './services/scheduledAutomations';
import { LocalLanguageModel } from './services/localLanguageModel';
import {
  assessLocalInferenceReadiness,
  getBrowserLocalInferenceHardware,
  type LocalInferenceReadiness,
} from './services/localInferenceReadiness';
import { runParallelDelegationWorkflow, shouldRunParallelDelegation } from './services/parallelDelegationWorkflow';
import { runStagedToolPipeline, type StageMeta } from './services/stagedToolPipeline';
import { createSearchTurnContextSystemMessage } from './services/conversationSearchContext';
import { ProcessLog, type ProcessEntry, type ProcessEntryKind } from './services/processLog';
import { InlineProcess, ProcessPanel } from './features/process';
import {
  createWebMcpToolBridge,
  registerWorkspaceTools,
  type WorkspaceMcpBrowserPageHistory,
  type WorkspaceMcpBrowserPage,
  type WorkspaceMcpClipboardEntry,
  type WorkspaceMcpContextAction,
  type WorkspaceMcpHarnessElement,
  type WorkspaceMcpHarnessElementPatch,
  type WorkspaceMcpRenderPane,
  type WorkspaceMcpSessionDrive,
  type WorkspaceMcpSessionFsEntry,
  type WorkspaceMcpSessionState,
  type WorkspaceMcpElicitationField,
  type WorkspaceMcpSecretRequestResult,
  type WorkspaceMcpSettingsFile,
  type WorkspaceMcpWorktreeItemType,
  type WorkspaceMcpWorktreeItem,
  type WorkspaceMcpWriteSessionInput,
} from 'agent-browser-mcp';
import { browserInferenceEngine } from './services/browserInference';
import { searchBrowserModels } from './services/huggingFaceRegistry';
import { appendPendingLocalTurn } from './services/chatComposition';
import {
  buildRenamedSessionFsPath,
  buildSessionFsChildPath,
  normalizeSessionFsPath,
} from './services/sessionFsPath';
import { parseSandboxPrompt } from './sandbox/prompt';
import { createSandboxExecutionService } from './sandbox/service';
import { buildRunSummaryInput } from './sandbox/summarize-run';
import {
  createMessageCopyLabel,
  formatMessageCopyContent,
  type ClipboardCopyFormat,
} from './services/chatMessageCopy';
import {
  buildWorkspacePromptContext,
  createDefaultWorkspaceFiles,
  createWorkspaceFileTemplate,
  detectWorkspaceFileKind,
  discoverWorkspaceCapabilities,
  loadWorkspaceFiles,
  removeWorkspaceFile,
  upsertWorkspaceFile,
  validateWorkspaceFile,
  WORKSPACE_FILES_STORAGE_KEY,
  WORKSPACE_FILE_STORAGE_DEBOUNCE_MS,
} from './services/workspaceFiles';
import {
  createDefaultSessionWorkspaceFiles,
  DEFAULT_SETTINGS_JSON,
  PROJECT_SETTINGS_PATH,
  SESSION_WORKSPACE_SETTINGS_PATH,
  settingsSnapshotsFromWorkspaceFiles,
  USER_SETTINGS_PATH,
} from './services/settingsFiles';
import {
  DEFAULT_EXTENSION_MANIFESTS,
  EXTENSION_MARKETPLACE_CATEGORIES,
  EXTENSION_MARKETPLACE_CATEGORY_LABELS,
  buildRuntimeExtensionPromptContext,
  createDefaultExtensionRuntime,
  getExtensionMarketplaceCategory,
  getInstalledDefaultExtensionDescriptors,
  groupDefaultExtensionsByMarketplaceCategory,
  summarizeDefaultExtensionRuntime,
  type DefaultExtensionDescriptor,
  type DefaultExtensionRuntime,
} from './services/defaultExtensions';
import {
  PORTABLE_DAEMON_SOURCE_DOWNLOAD,
  resolveLocalInferenceDaemonDownload,
  type DaemonDownloadChoice,
} from './services/windowsDaemonDownload';
import { buildArtifactDriveNodes, buildInstalledExtensionDriveNodes, buildMountedTerminalDriveNodes, buildWorkspaceCapabilityDriveNodes } from './services/virtualFilesystemTree';
import {
  buildArtifactPromptContext,
  createArtifact,
  createArtifactDownloadPayload,
  updateArtifactFiles,
  type AgentArtifact,
  type ArtifactFile,
} from './services/artifacts';
import {
  DEFAULT_BROWSER_NOTIFICATION_SETTINGS,
  buildChatCompletionNotification,
  buildChatElicitationNotification,
  createBrowserNotificationApi,
  createBrowserNotificationDispatcher,
  getBrowserNotificationPermission,
  isBrowserNotificationSettings,
  isLikelyUserElicitation,
  requestBrowserNotificationPermission,
  type BrowserNotificationPermission,
} from './services/browserNotifications';
import {
  DEFAULT_BROWSER_LOCATION_CONTEXT,
  buildBrowserLocationPromptContext,
  createBrowserLocationApi,
  isBrowserLocationContext,
  roundCoordinate,
  requestBrowserLocationContext,
  type BrowserLocationContext,
} from './services/browserLocation';
import {
  STORAGE_KEYS,
  isArtifactContextBySession,
  isArtifactsByWorkspace,
  isChatMessagesBySession,
  isHarnessAppSpecRecord,
  isString,
  isStringArrayRecord,
  isStringRecord,
  isTreeNode,
  isWorkspaceViewStateRecord,
  removeStoredRecordEntry,
  saveJson,
  useStoredState,
} from './services/sessionState';
import {
  buildPullRequestReview,
  createSamplePullRequestReviewInput,
} from './services/prReviewUnderstanding';
import {
  createEvaluationAgentRegistry,
  type CustomEvaluationAgent,
  type EvaluationAgentKind,
} from './services/evaluationAgentRegistry';
import { startDriverTour } from './features/tours/driverTour';
import { collectWorkspaceDirectories } from './services/workspaceDirectories';
import {
  searchUserContextMemory,
  upsertUserContextMemory,
} from './services/userContextMemory';
import {
  DEFAULT_SECRET_MANAGEMENT_SETTINGS,
  getDefaultSecretsManagerAgent,
  isSecretManagementSettings,
  secretRefForId,
  type SecretManagementSettings,
  type SecretRecord,
} from './chat-agents/Secrets';
import {
  WORKSPACE_COLORS,
  buildWorkspaceNodeMap,
  countTabs,
  createBrowserTab,
  createInitialRoot,
  createSessionNode,
  createWorkspaceNode,
  createWorkspaceViewEntry,
  createWorkspaceViewState,
  deepUpdate,
  ensureWorkspaceCategories,
  findFirstSessionId,
  findNode,
  findParent,
  findWorkspaceForNode,
  flattenTabs,
  flattenTreeFiltered,
  flattenWorkspaceTreeFiltered,
  getWorkspace,
  getWorkspaceCategory,
  nextWorkspaceName,
  normalizeWorkspaceViewEntry,
  removeNodeById,
  renderPaneIdForNode,
  totalMemoryMB,
  workspaceViewStateEquals,
  type FlatTreeItem,
  type WorkspaceViewState,
} from './services/workspaceTree';
import {
  buildActiveSessionFilesystemEntries,
  buildActiveWorktreeItems,
  readWorktreeContextMenuState,
  readWorktreeRenderPaneState,
  toggleWorktreeRenderPaneState,
  type WorkspaceContextMenuState,
} from './services/workspaceMcpWorktree';
import { moveRenderPaneOrder, orderRenderPanes } from './services/workspaceMcpPanes';
import { planRenderPaneRows } from './services/renderPaneLayout';
import { HarnessDashboardPanel } from './features/harness-ui/HarnessDashboardPanel';
import {
  applyHarnessElementPatch,
  buildHarnessPromptContextRows,
  createDefaultHarnessAppSpec,
  listEditableHarnessElements,
} from './features/harness-ui/harnessSpec';
import {
  regenerateHarnessAppSpec,
  restoreDefaultHarnessAppSpec,
} from './features/harness-ui/harnessRegeneration';
import type { HarnessAppSpec, HarnessElementPatch, JsonValue } from './features/harness-ui/types';
import { createUniqueId } from './utils/uniqueId';
import { DEFAULT_TOOL_DESCRIPTORS, buildDefaultToolInstructions, createDefaultTools, selectToolDescriptorsByIds, selectToolsByIds, type ToolDescriptor } from './tools';
import type { BrowserNavHistory, BusEntryStep, ChatMessage, HFModel, HistorySession, Identity, IdentityPermissions, NodeMetadata, ReasoningStep, SearchTurnContext, TreeNode, VoterStep, WorkspaceCapabilities, WorkspaceFile, WorkspaceFileKind, WorkspacePlugin } from './types';
import type { CliHistoryEntry } from './tools/types';
import { installModelContext, ModelContext } from 'webmcp';

type ToastState = { msg: string; type: 'info' | 'success' | 'error' | 'warning' } | null;
type ClipboardEntry = { id: string; text: string; label: string; timestamp: number };
type SidebarPanel = 'workspaces' | 'review' | 'history' | 'extensions' | 'models' | 'settings' | 'account';
type DashboardPanel = { type: 'dashboard'; workspaceId: string };
type BrowserPanel = { type: 'browser'; tab: TreeNode };
type SessionPanel = { type: 'session'; id: string };
type FilePanel = { type: 'file'; file: WorkspaceFile };
type ArtifactPanel = { type: 'artifact'; artifact: AgentArtifact; file: ArtifactFile | null };
type Panel = DashboardPanel | BrowserPanel | SessionPanel | FilePanel | ArtifactPanel;
type PanelDragHandleProps = React.HTMLAttributes<HTMLElement>;
type SessionMcpRuntimeState = {
  mode: 'agent' | 'terminal';
  provider: AgentProvider | null;
  modelId: string | null;
  agentId: string | null;
  toolIds: string[];
  cwd: string | null;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    status?: string | null;
  }>;
};
type SessionMcpController = {
  getRuntimeState: () => SessionMcpRuntimeState;
  writeSession: (input: WorkspaceMcpWriteSessionInput) => Promise<void>;
};

function areSessionRuntimeSnapshotsEqual(left: SessionMcpRuntimeState | undefined, right: SessionMcpRuntimeState): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right);
}

const USER_ELICITATION_EVENT = 'agent-browser:user-elicitation';
const SECRET_REQUEST_EVENT = 'agent-browser:secret-request';
type SecretRequestCreatedResult = Extract<WorkspaceMcpSecretRequestResult, { status: 'secret_ref_created' }>;
const pendingSecretRequestResolvers = new Map<string, (result: SecretRequestCreatedResult) => void>();

type UserElicitationEventDetail = {
  requestId: string;
  prompt: string;
  reason?: string;
  fields: WorkspaceMcpElicitationField[];
};

type SecretRequestEventDetail = {
  requestId: string;
  name: string;
  prompt: string;
  reason?: string;
};

function isSearchTurnContext(value: unknown): value is SearchTurnContext {
  return !!value
    && typeof value === 'object'
    && 'taskText' in value
    && 'resolvedTaskText' in value
    && 'subject' in value
    && 'answerSubject' in value
    && 'acceptedCandidates' in value
    && Array.isArray((value as SearchTurnContext).acceptedCandidates);
}

const DEFAULT_IDENTITIES: Identity[] = [
  { id: 'user-1', name: 'You', type: 'user' },
  { id: 'agent-1', name: 'Agent', type: 'agent' },
];

function defaultPermissionsFor(actions: string[]): IdentityPermissions[] {
  return DEFAULT_IDENTITIES.map((identity) => ({
    identity,
    permissions: actions.map((action) => ({
      action,
      // Agents cannot delete/remove/close/rename by default
      allowed: identity.type === 'user' || !['Close', 'Remove', 'Delete', 'Rename'].includes(action),
    })),
  }));
}

function stopPanelTitlebarControlDrag(event: React.SyntheticEvent<HTMLElement>) {
  event.stopPropagation();
}

const panelTitlebarControlProps: Pick<React.HTMLAttributes<HTMLElement>, 'onPointerDown' | 'onMouseDown' | 'onTouchStart'> = {
  onPointerDown: stopPanelTitlebarControlDrag,
  onMouseDown: stopPanelTitlebarControlDrag,
  onTouchStart: stopPanelTitlebarControlDrag,
};

const TIERS = {
  hot: { color: '#f87171', label: 'Hot' },
  warm: { color: '#fbbf24', label: 'Warm' },
  cool: { color: '#60a5fa', label: 'Cool' },
  cold: { color: '#52525b', label: 'Cold' },
} as const;

const TASK_OPTIONS = [
  'text-generation', 'text2text-generation', 'text-classification',
  'token-classification', 'question-answering', 'summarization',
  'translation', 'feature-extraction', 'fill-mask',
  'image-classification', 'object-detection', 'image-segmentation',
  'automatic-speech-recognition', 'zero-shot-classification',
  'sentence-similarity',
];

const HF_TASK_LABELS: Record<string, string> = {
  'text-generation': 'Text Generation',
  'text2text-generation': 'Text-to-Text',
  'text-classification': 'Classification',
  'token-classification': 'Token Classification',
  'question-answering': 'QA',
  'summarization': 'Summarization',
  'translation': 'Translation',
  'feature-extraction': 'Embeddings',
  'fill-mask': 'Fill Mask',
  'image-classification': 'Image Classification',
  'object-detection': 'Object Detection',
  'image-segmentation': 'Image Segmentation',
  'automatic-speech-recognition': 'Speech Recognition',
  'zero-shot-classification': 'Zero-Shot',
  'sentence-similarity': 'Sentence Similarity',
};

// Pre-populated registry shown before any HF API call completes.
// Mirrors reference_impl LOCAL_MODELS_SEED exactly.
const LOCAL_MODELS_SEED: HFModel[] = [
  { id: 'onnx-community/Qwen3-0.6B-ONNX', name: 'Qwen3-0.6B-ONNX', author: 'onnx-community', task: 'text-generation', downloads: 5000, likes: 30, tags: ['transformers.js', 'text-generation', 'onnx'], sizeMB: 0, status: 'available' },
  { id: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', name: 'distilbert-base-uncased-finetuned-sst-2-english', author: 'Xenova', task: 'text-classification', downloads: 50000, likes: 32, tags: ['transformers.js'], sizeMB: 0, status: 'available' },
  { id: 'Xenova/all-MiniLM-L6-v2', name: 'all-MiniLM-L6-v2', author: 'Xenova', task: 'feature-extraction', downloads: 80000, likes: 65, tags: ['transformers.js', 'feature-extraction'], sizeMB: 0, status: 'available' },
  { id: 'Xenova/whisper-tiny.en', name: 'whisper-tiny.en', author: 'Xenova', task: 'automatic-speech-recognition', downloads: 25000, likes: 28, tags: ['transformers.js'], sizeMB: 0, status: 'available' },
  { id: 'Xenova/detr-resnet-50', name: 'detr-resnet-50', author: 'Xenova', task: 'object-detection', downloads: 15000, likes: 20, tags: ['transformers.js'], sizeMB: 0, status: 'available' },
];

const EMPTY_COPILOT_STATE: CopilotRuntimeState = {
  available: false,
  authenticated: false,
  models: [],
  signInCommand: 'copilot login',
  signInDocsUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli',
};

const EMPTY_CURSOR_STATE: CursorRuntimeState = {
  available: false,
  authenticated: false,
  models: [],
  signInCommand: 'Set CURSOR_API_KEY in the dev server environment',
  signInDocsUrl: 'https://cursor.com/blog/typescript-sdk',
};

const EMPTY_CODEX_STATE: CodexRuntimeState = {
  available: false,
  authenticated: false,
  models: [],
  signInCommand: 'codex login',
  signInDocsUrl: 'https://developers.openai.com/codex/auth',
};

const NEW_TAB_NAME_LENGTH = 32;
const DEFAULT_NEW_TAB_MEMORY_MB = 96;
const PANEL_MIN_WIDTH_PX = 320;
const PANEL_MIN_HEIGHT_PX = 240;
const INITIAL_WORKSPACE_IDS = ['ws-research', 'ws-build'] as const;
const PRIMARY_NAV = [
  ['workspaces', 'layers', 'Workspaces'],
  ['review', 'gitPullRequest', 'Review'],
  ['history', 'clock', 'History'],
  ['extensions', 'puzzle', 'Extensions'],
  ['models', 'cpu', 'Models'],
] as const;
const SECONDARY_NAV = [
  ['settings', 'settings', 'Settings'],
  ['account', 'user', 'Account'],
] as const;
const PANEL_SHORTCUT_ORDER: SidebarPanel[] = ['workspaces', 'review', 'history', 'extensions', 'models', 'settings', 'account'];
const SIDEBAR_PANEL_META: Record<SidebarPanel, { label: string; icon: keyof typeof icons }> = {
  workspaces: { label: 'Workspaces', icon: 'layers' },
  review: { label: 'Review', icon: 'gitPullRequest' },
  history: { label: 'History', icon: 'clock' },
  extensions: { label: 'Extensions', icon: 'puzzle' },
  models: { label: 'Models', icon: 'cpu' },
  settings: { label: 'Settings', icon: 'settings' },
  account: { label: 'Account', icon: 'user' },
};
const WORKSPACE_SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    items: [
      { keys: '↑ / ↓', description: 'Move cursor' },
      { keys: '→', description: 'Expand folder / enter' },
      { keys: '←', description: 'Collapse folder / go to parent' },
      { keys: 'Home / End', description: 'First / last item' },
    ],
  },
  {
    title: 'Selection',
    items: [
      { keys: 'Space', description: 'Toggle selection' },
      { keys: 'Shift+↑/↓', description: 'Extend selection' },
      { keys: 'Ctrl+A', description: 'Select all visible' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { keys: 'Enter', description: 'Toggle folder / open tab' },
      { keys: 'Ctrl+X', description: 'Cut selected' },
      { keys: 'Ctrl+V', description: 'Paste into folder' },
      { keys: 'Esc', description: 'Clear / cancel' },
    ],
  },
  {
    title: 'Quick access',
    items: [
      { keys: 'Type to filter', description: 'Incremental search' },
      { keys: '?', description: 'This overlay' },
    ],
  },
  {
    title: 'Panels',
    items: [
      { keys: `Alt+1-${PANEL_SHORTCUT_ORDER.length}`, description: 'Switch sidebar panel' },
      { keys: 'Ctrl/Cmd+`', description: 'Toggle chat / terminal' },
    ],
  },
  {
    title: 'Workspace switching',
    items: [
      { keys: 'Ctrl+1-9', description: 'Jump to workspace N' },
      { keys: 'Ctrl+Alt+←/→', description: 'Previous / next workspace' },
      { keys: 'Ctrl+Alt+N', description: 'New empty workspace' },
      { keys: 'Double-click pill', description: 'Rename workspace' },
    ],
  },
] as const;
const TOOL_GROUP_ORDER = [
  'built-in',
  'mcp',
  'worktree-mcp',
  'renderer-viewport-mcp',
  'harness-ui-mcp',
  'browser-worktree-mcp',
  'sessions-worktree-mcp',
  'files-worktree-mcp',
  'clipboard-worktree-mcp',
  'secrets-mcp',
] as const;
const DEFAULT_COLLAPSED_TOOL_GROUPS = new Set<string>(['mcp', 'webmcp']);

const icons = {
  bell: Bell,
  bellOff: BellOff,
  layers: Layers3,
  messageSquare: MessageSquare,
  clock: History,
  puzzle: Puzzle,
  settings: Settings,
  user: User,
  panelRight: PanelRightOpen,
  panes: Copy,
  search: Search,
  keyboard: Keyboard,
  keyRound: KeyRound,
  folder: Folder,
  folderOpen: FolderOpen,
  hardDrive: HardDrive,
  file: File,
  download: Download,
  link: Link,
  x: X,
  send: SendHorizontal,
  loader: LoaderCircle,
  mapPin: MapPin,
  mapPinOff: MapPinOff,
  globe: Globe,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  refresh: RefreshCcw,
  save: Save,
  sparkles: Sparkles,
  plus: Plus,
  cpu: Cpu,
  pencil: Pencil,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  terminal: Terminal,
  trash: Trash2,
  clipboard: Clipboard,
  gitPullRequest: GitPullRequest,
  slidersHorizontal: SlidersHorizontal,
} as const;

const mockHistory: HistorySession[] = [
  { id: 1, title: 'Research Session', date: 'Today · 2:15 PM', preview: 'Investigated browser-safe ONNX models', events: ['Opened Hugging Face registry', 'Installed an ONNX model', 'Streamed a local response'] },
  { id: 2, title: 'UX Session', date: 'Yesterday · 4:30 PM', preview: 'Tuned keyboard navigation and overlays', events: ['Moved through workspace tree', 'Opened shortcut overlay', 'Validated page overlay'] },
];

function Icon({ name, size = 16, color = 'currentColor', className = '' }: { name: keyof typeof icons; size?: number; color?: string; className?: string }) {
  const IconComponent: LucideIcon = icons[name];
  return <IconComponent size={size} color={color} className={className} aria-hidden="true" strokeWidth={1.8} data-icon={name} />;
}

function StatusIndicator({
  active = false,
  warning = false,
  label,
}: {
  active?: boolean;
  warning?: boolean;
  label: string;
}) {
  return (
    <span
      className={`status-indicator${active ? ' is-active' : ''}${warning ? ' is-warning' : ''}`}
      aria-label={label}
      title={label}
    />
  );
}

function Favicon({ url, size = 14 }: { url?: string; size?: number }) {
  const domain = useMemo(() => normalizeHostname(url), [url]);
  const label = useMemo(() => getFaviconBadgeLabel(url), [url]);
  if (!domain || !label) return <Icon name="globe" size={size} color="rgba(255,255,255,.3)" />;
  // Keep favicon rendering local-only so browsing history and internal hostnames
  // are not leaked to a third-party favicon proxy.
  return (
    <span
      title={domain}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 3,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(148, 163, 184, 0.18)',
        color: 'rgba(255,255,255,0.86)',
        fontSize: Math.max(9, Math.floor(size * 0.64)),
        fontWeight: 700,
        lineHeight: 1,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  );
}

function ActiveMemoryPulse() {
  return (
    <span className="memory-pulse" title="Active memory" aria-hidden="true">
      <span className="memory-pulse-ring" />
      <span className="memory-pulse-dot" />
    </span>
  );
}

function createSystemChatMessage(sessionId: string): ChatMessage {
  return {
    id: `${sessionId}:system`,
    role: 'system',
    content: 'Agent browser ready. Local inference is backed by browser-runnable Hugging Face ONNX models.',
  };
}

function classifyOmnibar(raw: string): { intent: 'navigate' | 'search'; value: string } {
  const value = raw.trim();
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value)) return { intent: 'navigate', value };
  if (/^localhost(:\d+)?(\/.*)?$/.test(value)) return { intent: 'navigate', value: `http://${value}` };
  if (/^([\w-]+\.)+[a-zA-Z]{2,}(\/.*)?$/.test(value)) return { intent: 'navigate', value: `https://${value}` };
  return { intent: 'search', value };
}

function quoteShellArg(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

type BrowserLocationToolResult =
  | { status: 'available'; latitude: number; longitude: number; accuracy?: number | null }
  | { status: 'denied' | 'unavailable'; reason: string };

function browserLocationResultFromContext(context: BrowserLocationContext): BrowserLocationToolResult | null {
  if (
    !context.enabled
    || !isBrowserLocationContext(context)
    || typeof context.latitude !== 'number'
    || typeof context.longitude !== 'number'
  ) {
    return null;
  }
  return {
    status: 'available',
    latitude: context.latitude,
    longitude: context.longitude,
    accuracy: context.accuracyMeters ?? null,
  };
}

function readBrowserLocationFromNavigator(): Promise<BrowserLocationToolResult> {
  if (!navigator.geolocation) {
    return Promise.resolve({
      status: 'unavailable',
      reason: 'Browser location is not available in this workspace.',
    });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        status: 'available',
        latitude: roundCoordinate(position.coords.latitude),
        longitude: roundCoordinate(position.coords.longitude),
        accuracy: Math.round(position.coords.accuracy),
      }),
      (error) => resolve({
        status: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
        reason: error.code === error.PERMISSION_DENIED
          ? 'Browser location permission was denied.'
          : (error.message || 'Browser location is not available in this workspace.'),
      }),
      { maximumAge: 60_000, timeout: 10_000 },
    );
  });
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function isMobileViewport(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 640px)').matches;
}

function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return { toast, setToast };
}

function createDeferredToastDispatcher(setToast: (toast: ToastState) => void) {
  let timer: number | null = null;
  let pendingToast: ToastState = null;

  const commit = () => {
    timer = null;
    if (!pendingToast) return;
    const nextToast = pendingToast;
    pendingToast = null;
    setToast(nextToast);
  };

  return {
    push(nextToast: Exclude<ToastState, null>) {
      pendingToast = nextToast;
      if (timer !== null) return;
      timer = window.setTimeout(commit, 0);
    },
    flush(nextToast?: Exclude<ToastState, null>) {
      if (nextToast) {
        pendingToast = nextToast;
      }

      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }

      if (!pendingToast) return;
      const toastToShow = pendingToast;
      pendingToast = null;
      setToast(toastToShow);
    },
    cancel() {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      pendingToast = null;
    },
  };
}

function upsertReasoningStep(steps: ReasoningStep[], step: ReasoningStep): ReasoningStep[] {
  const existingIndex = steps.findIndex((candidate) => candidate.id === step.id);
  if (existingIndex === -1) return [...steps, step];
  const next = [...steps];
  next[existingIndex] = { ...next[existingIndex], ...step };
  return next;
}

function patchReasoningStep(steps: ReasoningStep[], id: string, patch: Partial<ReasoningStep>): ReasoningStep[] {
  return steps.map((step) => (step.id === id ? { ...step, ...patch } : step));
}

function finalizeReasoningSteps(steps: ReasoningStep[], endedAt = Date.now()): ReasoningStep[] {
  return steps.map((step) => (step.status === 'active' ? { ...step, status: 'done', endedAt: step.endedAt ?? endedAt } : step));
}

function upsertVoterStep(steps: VoterStep[], step: VoterStep): VoterStep[] {
  const existingIndex = steps.findIndex((candidate) => candidate.id === step.id);
  if (existingIndex === -1) return [...steps, step];
  const next = [...steps];
  next[existingIndex] = { ...next[existingIndex], ...step };
  return next;
}

function patchVoterStep(steps: VoterStep[], id: string, patch: Partial<VoterStep>): VoterStep[] {
  return steps.map((step) => (step.id === id ? { ...step, ...patch } : step));
}

function finalizeVoterSteps(steps: VoterStep[], endedAt = Date.now()): VoterStep[] {
  return steps.map((step) => (step.status === 'active' ? { ...step, status: 'done', endedAt: step.endedAt ?? endedAt } : step));
}

function finalizeProcessEntries(entries: ProcessEntry[] | undefined, endedAt = Date.now()): ProcessEntry[] | undefined {
  return entries?.map((entry) => (
    entry.status === 'active'
      ? { ...entry, status: 'done', endedAt: entry.endedAt ?? endedAt, timeoutMs: undefined }
      : entry
  ));
}

function neutralizeStoppedMessage(message: ChatMessage): ChatMessage {
  const endedAt = Date.now();
  return {
    ...message,
    status: 'complete',
    statusText: 'stopped',
    loadingStatus: null,
    isThinking: false,
    isVoting: false,
    currentStepId: undefined,
    reasoningSteps: message.reasoningSteps ? finalizeReasoningSteps(message.reasoningSteps, endedAt) : undefined,
    voterSteps: message.voterSteps ? finalizeVoterSteps(message.voterSteps, endedAt) : undefined,
    processEntries: finalizeProcessEntries(message.processEntries, endedAt),
  };
}

function getStepDurationSeconds(steps: Array<{ startedAt: number; endedAt?: number }>): number | undefined {
  if (!steps.length) return undefined;
  const startedAt = steps[0]?.startedAt;
  const endedAt = steps.reduce((latest, step) => Math.max(latest, step.endedAt ?? step.startedAt), startedAt);
  return Math.max(1, Math.round((endedAt - startedAt) / 1000));
}

function createInitialLocalReasoningStep(title: string, body: string): ReasoningStep {
  return {
    id: createUniqueId(),
    kind: 'thinking',
    title,
    body,
    startedAt: Date.now(),
    status: 'active',
  };
}

const LOCAL_TOOL_STREAMING_IDLE_TIMEOUT_MS = 180_000;
const LOCAL_TOOL_THINKING_IDLE_TIMEOUT_MS = 180_000;
const LOCAL_TOOL_HARD_TIMEOUT_MS = 300_000;

type LocalToolWatchdogMode = 'thinking' | 'streaming';
type LocalToolTimeoutReason = 'no-output' | 'thinking-idle' | 'streaming-idle';

type ActivitySelection = {
  messageId: string;
};

function getActiveReasoningStepId(steps: ReasoningStep[]): string | undefined {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    if (steps[index]?.status === 'active') return steps[index].id;
  }
  return undefined;
}

function fmtMem(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1).replace(/\.0$/, '')} GB`;
  if (mb >= 1) return `${Math.round(mb)} MB`;
  return `${Math.round(mb * 1024)} KB`;
}

function getToolChipIconName(toolName?: string): keyof typeof icons {
  switch (toolName) {
    case 'cli':
      return 'terminal';
    case 'read_file':
      return 'file';
    case 'create_directory':
      return 'folderOpen';
    case 'create_file':
      return 'save';
    default:
      return 'sparkles';
  }
}

function getToolChipTestId(step: ReasoningStep): string {
  const source = step.toolName ?? step.title;
  return `tool-chip-${source.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'tool'}`;
}

function ToolCallChip({ step }: { step: ReasoningStep }) {
  const argsText = formatToolArgs(step.toolArgs);
  const resultText = step.toolResult;
  const hasDetails = Boolean(argsText || resultText);
  const summary = step.toolSummary ?? step.title;
  const iconName = getToolChipIconName(step.toolName);
  const statusLabel = step.status === 'active' ? 'Running' : (step.isError ? 'Failed' : 'Done');
  const header = (
    <span className={`tool-chip-row${step.status === 'active' ? ' tool-chip-row-active' : ''}${step.isError ? ' tool-chip-row-error' : ''}`}>
      <span className="tool-chip-icon" aria-hidden="true"><Icon name={iconName} size={12} /></span>
      <span className="tool-chip-text">{summary}</span>
      <span className="tool-chip-status">{statusLabel}</span>
      {hasDetails ? <ChevronDown size={12} className="tool-chip-chevron" aria-hidden="true" /> : null}
    </span>
  );

  if (!hasDetails) {
    return (
      <div className="tool-chip" data-testid={getToolChipTestId(step)}>
        {header}
      </div>
    );
  }

  return (
    <details className="tool-chip" data-testid={getToolChipTestId(step)}>
      <summary className="tool-chip-toggle">
        {header}
      </summary>
      <div className="tool-chip-details">
        {argsText ? (
          <div className="tool-chip-detail-block">
            <span className="tool-chip-detail-label">args</span>
            <pre className="tool-chip-detail-pre">{argsText}</pre>
          </div>
        ) : null}
        {resultText ? (
          <div className="tool-chip-detail-block">
            <span className="tool-chip-detail-label">{step.isError ? 'error' : 'result'}</span>
            <pre className="tool-chip-detail-pre">{resultText}</pre>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function MemBar({ root }: { root: TreeNode }) {
  const budget = 2048;
  const tabs = flattenTabs(root);
  const tierMemory = Object.entries(TIERS).map(([tier, meta]) => ({
    tier,
    ...meta,
    memory: tabs.filter((tab) => tab.memoryTier === tier).reduce((sum, tab) => sum + (tab.memoryMB ?? 0), 0),
  }));
  const used = tierMemory.reduce((sum, t) => sum + t.memory, 0);
  const pct = (mb: number) => Math.max((mb / budget) * 100, 0.3);
  return (
    <div className="mem-bar" aria-label="Memory distribution">
      <div className="mem-bar-header">
        <span>Memory</span>
        <span>{fmtMem(used)} / {fmtMem(budget)}</span>
      </div>
      <div className="mem-bar-track">
        {tierMemory.map((t) =>
          t.memory ? (
            <div key={t.tier} style={{ width: `${pct(t.memory)}%`, background: t.color, transition: 'width .5s' }} title={`${t.label}: ${t.memory}MB`} />
          ) : null,
        )}
      </div>
      <div className="mem-bar-legend">
        {tierMemory.map((t) => (
          <span key={t.tier} className="mem-bar-legend-item">
            <span className="mem-bar-legend-dot" style={{ background: t.color }} />
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function McpElicitationCard({
  messageId,
  card,
  onSubmit,
}: {
  messageId: string;
  card: NonNullable<ChatMessage['cards']>[number];
  onSubmit?: (messageId: string, requestId: string, values: Record<string, string>) => void;
}) {
  const fields = card.fields ?? [];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(
    fields.map((field) => [field.id, card.response?.[field.id] ?? '']),
  ));
  const requestId = card.requestId ?? `elicitation:${messageId}`;
  if (card.status === 'submitted') {
    return (
      <div className="message-tool-call message-tool-call-elicitation">
        <span className="tool-call-label">User input received</span>
        <pre className="tool-call-args">{JSON.stringify(card.response ?? {}, null, 2)}</pre>
      </div>
    );
  }
  return (
    <form
      className="message-tool-call message-tool-call-elicitation"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(messageId, requestId, values);
      }}
    >
      <span className="tool-call-label">User input needed</span>
      {card.prompt ? <p className="elicitation-prompt">{card.prompt}</p> : null}
      {fields.map((field) => (
        <label key={field.id} className="elicitation-field">
          <span>{field.label}</span>
          <input
            aria-label={field.label}
            value={values[field.id] ?? ''}
            placeholder={field.placeholder}
            required={field.required}
            onChange={(event) => setValues((current) => ({
              ...current,
              [field.id]: event.target.value,
            }))}
          />
        </label>
      ))}
      <button type="submit" className="elicitation-submit">Submit requested info</button>
    </form>
  );
}

function readSecretNameFromArgs(args: Record<string, unknown>): string | undefined {
  const value = args.name;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function McpSecretRequestCard({
  messageId,
  card,
  onSubmit,
}: {
  messageId: string;
  card: NonNullable<ChatMessage['cards']>[number];
  onSubmit?: (messageId: string, requestId: string, input: { name: string; value: string }) => void;
}) {
  const requestId = card.requestId ?? `secret:${messageId}`;
  const [name, setName] = useState(card.secretName ?? readSecretNameFromArgs(card.args) ?? 'API_KEY');
  const [value, setValue] = useState('');
  if (card.status === 'submitted') {
    return (
      <div className="message-tool-call message-tool-call-secret">
        <span className="tool-call-label">Secret ref created</span>
        <div className="secret-card-result">
          <span>{card.secretName ?? name}</span>
          {card.secretRef ? <code>{card.secretRef}</code> : null}
        </div>
      </div>
    );
  }
  return (
    <form
      aria-label="Secrets Manager request"
      className="message-tool-call message-tool-call-secret"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(messageId, requestId, { name, value });
      }}
    >
      <span className="tool-call-label">Secrets Manager</span>
      {card.prompt ? <p className="elicitation-prompt">{card.prompt}</p> : null}
      {card.reason ? <p className="secret-request-reason">{card.reason}</p> : null}
      <label className="elicitation-field">
        <span>Secret name</span>
        <input
          aria-label="Secret name"
          value={name}
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="elicitation-field">
        <span>Secret value</span>
        <input
          aria-label="Secret value"
          type="password"
          value={value}
          autoComplete="off"
          required
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button type="submit" className="elicitation-submit">Create secret ref</button>
    </form>
  );
}

function ChatMessageView({
  message,
  agentName,
  activitySelected,
  onOpenActivity,
  onSubmitElicitation,
  onSubmitSecret,
  onCopyMessage,
}: {
  message: ChatMessage;
  agentName: string;
  activitySelected?: boolean;
  onOpenActivity?: (messageId: string) => void;
  onSubmitElicitation?: (messageId: string, requestId: string, values: Record<string, string>) => void;
  onSubmitSecret?: (messageId: string, requestId: string, input: { name: string; value: string }) => void;
  onCopyMessage?: (input: { content: string; senderLabel: string; format: ClipboardCopyFormat }) => Promise<void>;
}) {
  const content = message.streamedContent || message.content;
  const isTerminalMessage = message.statusText?.startsWith('terminal') ?? false;
  const allReasoningSteps = message.reasoningSteps ?? [];
  // De-duplicate tool chips by toolCallId so each unique tool invocation
  // renders exactly one chip. Some pipelines (LogAct iterations, retries)
  // may emit the same toolCallId multiple times; the latest entry wins so
  // the chip reflects current status (active → done) and result.
  const toolSteps = (() => {
    const allTools = allReasoningSteps.filter((step) => step.kind === 'tool');
    const byKey = new Map<string, typeof allTools[number]>();
    for (const step of allTools) {
      const key = step.toolCallId ?? step.id;
      byKey.set(key, step);
    }
    return Array.from(byKey.values());
  })();
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const senderLabel = isSystem ? 'system' : isUser ? 'you' : isTerminalMessage ? 'terminal' : agentName;
  const isStopped = message.statusText === 'stopped';
  const isStreaming = message.status === 'streaming' && !isStopped;
  const isError = message.isError ?? message.status === 'error';
  const hasReasoning = Boolean(allReasoningSteps.length || message.thinkingContent || message.thinkingDuration || message.isThinking);
  const hasVoters = Boolean((message.voterSteps?.length ?? 0) || message.isVoting);
  const canCopy = Boolean(content.trim() && onCopyMessage);
  return (
    <div className={`message ${message.role}${isTerminalMessage ? ' terminal-message' : ''}${isError ? ' message-error' : ''}`}>
      {(!isSystem || canCopy) && (
        <div className={`message-sender ${isUser ? 'message-sender-user' : 'message-sender-agent'}`}>
          <span className="sender-name">{senderLabel}</span>
          {canCopy ? (
            <span className="message-actions" aria-label={`${senderLabel} message actions`}>
              <button
                type="button"
                className="message-action-button"
                aria-label={`Copy ${senderLabel} message as markdown`}
                title="Copy as markdown"
                data-tooltip="Copy markdown"
                onClick={() => void onCopyMessage?.({ content, senderLabel, format: 'markdown' })}
              >
                <Icon name="panes" size={11} />
              </button>
              <button
                type="button"
                className="message-action-button"
                aria-label={`Copy ${senderLabel} message as plaintext`}
                title="Copy as plaintext"
                data-tooltip="Copy plaintext"
                onClick={() => void onCopyMessage?.({ content, senderLabel, format: 'plaintext' })}
              >
                <Icon name="clipboard" size={11} />
              </button>
            </span>
          ) : null}
        </div>
      )}
      {hasReasoning || hasVoters || (message.processEntries?.length ?? 0) > 0 ? (
        <InlineProcess message={message} selected={activitySelected} onOpenActivity={onOpenActivity} />
      ) : null}
      {isStopped && (
        <div className="message-step message-step-static">
          <span className="message-step-dot" />
          <span className="message-step-text">Stopped</span>
        </div>
      )}
      {message.loadingStatus && !hasReasoning && !toolSteps.length && (
        <div className="message-step">
          <span className="message-step-dot" />
          <span className="message-step-text">{message.loadingStatus}</span>
        </div>
      )}
      {message.status === 'thinking' && !hasReasoning && !message.loadingStatus && (
        <div className="message-step">
          <span className="message-step-dot" />
          <span className="message-step-text">Thinking…</span>
        </div>
      )}
      {toolSteps.map((step) => <ToolCallChip key={step.id} step={step} />)}
      {(message.cards ?? []).map((card, i) => (
        card.kind === 'elicitation'
          ? (
            <McpElicitationCard
              key={card.requestId ?? i}
              messageId={message.id}
              card={card}
              onSubmit={onSubmitElicitation}
            />
          )
          : card.kind === 'secret'
          ? (
            <McpSecretRequestCard
              key={card.requestId ?? i}
              messageId={message.id}
              card={card}
              onSubmit={onSubmitSecret}
            />
          )
          : (
            <div key={i} className="message-tool-call">
              <span className="tool-call-label">⚙ {card.app}</span>
              <pre className="tool-call-args">{JSON.stringify(card.args, null, 2)}</pre>
            </div>
          )
      ))}
      {content ? (
        (isUser || isTerminalMessage || isError)
          ? <div className={`message-bubble${isTerminalMessage ? ' terminal-bubble' : ''}${isError ? ' message-bubble-error' : ''}`}>{content}{isStreaming && !message.isThinking && <span className="stream-cursor" />}</div>
          : <div className={`message-bubble message-bubble-markdown${isError ? ' message-bubble-error' : ''}`}><MarkdownContent content={content} className="markdown-content" />{isStreaming && !message.isThinking && <span className="stream-cursor" />}</div>
      ) : null}
    </div>
  );
}

function PageOverlay({ tab, onClose, onContextMenu, dragHandleProps }: { tab: TreeNode; onClose: () => void; onContextMenu?: (x: number, y: number) => void; dragHandleProps?: PanelDragHandleProps }) {
  const src = tab.url ?? '';
  return (
    <section
      className="page-overlay"
      aria-label="Page overlay"
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu?.(event.clientX, event.clientY);
      }}
    >
      <header className={`page-tab-header panel-titlebar${dragHandleProps ? ' panel-titlebar--draggable' : ''}`} {...dragHandleProps}>
        <div className="panel-titlebar-heading">
          <Favicon url={tab.url} size={13} />
          <span className="page-tab-title">{tab.name}</span>
        </div>
        <button type="button" className="icon-button panel-close-button" aria-label="Close page overlay" onClick={onClose} {...panelTitlebarControlProps}><Icon name="x" size={12} /></button>
      </header>
      <div className="page-content">
        {src ? (
          <iframe
            src={src}
            title={tab.name}
            className="browser-iframe"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="page-empty">
            <Icon name="globe" size={32} color="#3f3f46" />
            <span>Enter a URL to browse</span>
          </div>
        )}
      </div>
    </section>
  );
}

function FileEditorPanel({
  file,
  onSave,
  onDelete,
  onClose,
  onToast,
  dragHandleProps,
}: {
  file: WorkspaceFile;
  onSave: (nextFile: WorkspaceFile, previousPath?: string) => void;
  onDelete: (path: string) => void;
  onClose: () => void;
  onToast: (toast: Exclude<ToastState, null>) => void;
  dragHandleProps?: PanelDragHandleProps;
}) {
  const [editorPath, setEditorPath] = useState(file.path);
  const [editorContent, setEditorContent] = useState(file.content);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isPathEditing, setIsPathEditing] = useState(false);
  const pathInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setEditorPath(file.path);
    setEditorContent(file.content);
    setValidationMessage(null);
    setIsPathEditing(false);
  }, [file]);

  useEffect(() => {
    if (!isPathEditing) return;
    requestAnimationFrame(() => {
      pathInputRef.current?.focus();
      pathInputRef.current?.select();
    });
  }, [isPathEditing]);

  function handleSave() {
    const nextFile: WorkspaceFile = {
      path: editorPath.trim(),
      content: editorContent,
      updatedAt: new Date().toISOString(),
    };
    const validationError = validateWorkspaceFile(nextFile);
    if (validationError) {
      setValidationMessage(validationError);
      return;
    }
    onSave(nextFile, file.path);
    setIsPathEditing(false);
    onToast({ msg: `Saved ${nextFile.path}`, type: 'success' });
  }

  function handleCancelPathEdit() {
    setEditorPath(file.path);
    setValidationMessage(null);
    setIsPathEditing(false);
  }

  return (
    <section className="file-editor-panel" aria-label="File editor">
      <header className={`file-editor-header panel-titlebar${dragHandleProps ? ' panel-titlebar--draggable' : ''}`} {...dragHandleProps}>
        <div className="file-editor-heading panel-titlebar-heading">
          <Icon name="file" size={14} color="#7d8590" />
          <span className="file-editor-title">{editorPath}</span>
        </div>
        <button type="button" className="icon-button panel-close-button" aria-label="Close file editor" onClick={onClose} {...panelTitlebarControlProps}><Icon name="x" size={12} /></button>
      </header>
      <div className="file-editor-body">
        <div className="file-editor-chrome">
          {isPathEditing ? (
            <label className="file-editor-pathbar shared-input-shell">
              <span className="sr-only">Path</span>
              <Icon name="file" size={12} color="#7d8590" />
              <input
                ref={pathInputRef}
                aria-label="Workspace file path"
                value={editorPath}
                onChange={(event) => {
                  setEditorPath(event.target.value);
                  setValidationMessage(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSave();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    handleCancelPathEdit();
                  }
                }}
              />
            </label>
          ) : (
            <div className="file-editor-pathbar file-editor-path-display shared-input-shell">
              <Icon name="file" size={12} color="#7d8590" />
              <span className="file-editor-path-text">{editorPath}</span>
            </div>
          )}
          <div className="file-editor-toolbar">
            {isPathEditing ? (
              <button type="button" className="secondary-button file-editor-inline-button" onClick={handleCancelPathEdit}>Cancel</button>
            ) : (
              <button type="button" className="secondary-button file-editor-inline-button" aria-label="Edit file name" title="Edit file name" onClick={() => setIsPathEditing(true)}>Edit</button>
            )}
            <button type="button" className="file-editor-action file-editor-action-save" aria-label="Save file" title="Save file" onClick={handleSave}><Icon name="save" size={14} /></button>
            <button type="button" className="file-editor-action file-editor-action-delete" aria-label="Delete file" title="Delete file" onClick={() => { onDelete(file.path); onClose(); onToast({ msg: `Removed ${file.path}`, type: 'info' }); }}><Icon name="trash" size={14} /></button>
          </div>
        </div>
        {validationMessage ? <p className="file-editor-error">{validationMessage}</p> : null}
        <label className="file-editor-field file-editor-content-field">
          <span className="sr-only">Content</span>
          <textarea aria-label="Workspace file content" value={editorContent} onChange={(event) => { setEditorContent(event.target.value); setValidationMessage(null); }} />
        </label>
      </div>
    </section>
  );
}

function isPreviewableArtifactFile(file: ArtifactFile | null): boolean {
  if (!file) return false;
  const mediaType = file.mediaType?.toLowerCase() ?? '';
  const path = file.path.toLowerCase();
  return mediaType === 'text/html' || mediaType === 'image/svg+xml' || path.endsWith('.html') || path.endsWith('.htm') || path.endsWith('.svg');
}

function ArtifactViewerPanel({
  artifact,
  file,
  onSelectFile,
  onDownload,
  onAttach,
  onOpenSession,
  onClose,
  dragHandleProps,
}: {
  artifact: AgentArtifact;
  file: ArtifactFile | null;
  onSelectFile: (filePath: string) => void;
  onDownload: () => void;
  onAttach: () => void;
  onOpenSession: () => void;
  onClose: () => void;
  dragHandleProps?: PanelDragHandleProps;
}) {
  const canPreview = isPreviewableArtifactFile(file);
  return (
    <section className="file-editor-panel artifact-viewer-panel" aria-label="Artifact viewer">
      <header className={`file-editor-header panel-titlebar${dragHandleProps ? ' panel-titlebar--draggable' : ''}`} {...dragHandleProps}>
        <div className="file-editor-heading panel-titlebar-heading">
          <Icon name="layers" size={14} color="#a5b4fc" />
          <span className="file-editor-title">{artifact.title}</span>
        </div>
        <button type="button" className="icon-button panel-close-button" aria-label="Close artifact" onClick={onClose} {...panelTitlebarControlProps}><Icon name="x" size={12} /></button>
      </header>
      <div className="file-editor-body artifact-viewer-body">
        <div className="file-editor-chrome">
          <div className="file-editor-pathbar file-editor-path-display shared-input-shell">
            <Icon name="file" size={12} color="#7d8590" />
            <span className="file-editor-path-text">{file ? `//artifacts/${artifact.id}/${file.path}` : `//artifacts/${artifact.id}`}</span>
          </div>
          <div className="file-editor-toolbar">
            <button type="button" className="file-editor-action" aria-label="Download artifact" title="Download artifact" onClick={onDownload}><Icon name="download" size={14} /></button>
            <button type="button" className="file-editor-action" aria-label="Attach artifact to session" title="Attach artifact to session" onClick={onAttach}><Icon name="link" size={14} /></button>
            <button type="button" className="file-editor-action" aria-label="Open session with artifact" title="Open session with artifact" onClick={onOpenSession}><Icon name="messageSquare" size={14} /></button>
          </div>
        </div>
        {artifact.files.length > 1 ? (
          <div className="artifact-file-tabs" role="tablist" aria-label="Artifact files">
            {artifact.files.map((artifactFile) => (
              <button
                key={artifactFile.path}
                type="button"
                role="tab"
                aria-selected={artifactFile.path === file?.path}
                className={`artifact-file-tab${artifactFile.path === file?.path ? ' active' : ''}`}
                onClick={() => onSelectFile(artifactFile.path)}
              >
                {artifactFile.path}
              </button>
            ))}
          </div>
        ) : null}
        {file ? (
          canPreview ? (
            <iframe
              className="artifact-preview-frame"
              title={`${artifact.title}: ${file.path}`}
              sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              srcDoc={file.content}
            />
          ) : (
            <label className="file-editor-field file-editor-content-field artifact-source-field">
              <span className="sr-only">Artifact content</span>
              <textarea aria-label="Artifact content" value={file.content} readOnly />
            </label>
          )
        ) : (
          <div className="page-empty">
            <Icon name="layers" size={32} color="#3f3f46" />
            <span>Artifact unavailable</span>
          </div>
        )}
      </div>
    </section>
  );
}

function ClosedPanelsPlaceholder({ workspaceName, onNewSession }: { workspaceName: string; onNewSession: () => void }) {
  return (
    <section className="closed-panels-placeholder" aria-label="No panels open">
      <div className="closed-panels-copy">
        <span className="panel-eyebrow">workspace/{workspaceName}</span>
        <h2>No panels open</h2>
        <p>Open a page, file, or session from the tree, or start a new session.</p>
      </div>
      <button type="button" className="secondary-button" onClick={onNewSession}>New session</button>
    </section>
  );
}

const BASH_INITIAL_CWD = '/workspace';
const BASH_CWD_PLACEHOLDER_FILE = '.keep';
type BashEntry = CliHistoryEntry;
type InputHistoryMode = 'chat' | 'terminal';

function createInitialBashFiles(): Record<string, string> {
  return {
    [`${BASH_INITIAL_CWD}/${BASH_CWD_PLACEHOLDER_FILE}`]: '',
    ...createDefaultSessionWorkspaceFiles(BASH_INITIAL_CWD),
  };
}

function buildInputHistoryScopeKey(mode: InputHistoryMode, sessionId: string) {
  return `${mode}:${sessionId}`;
}

function getSkillAutocompleteQuery(value: string) {
  const match = value.match(/(^|\s)@([a-z0-9-]*)$/i);
  if (!match) return null;
  return match[2].toLowerCase();
}

function applySkillAutocomplete(value: string, skillName: string) {
  return value.replace(/(^|\s)@([a-z0-9-]*)$/i, (_, prefix: string) => `${prefix}@${skillName} `);
}

function shouldHandleTextareaHistoryKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return false;
  }

  const { selectionStart, selectionEnd, value } = event.currentTarget;
  if (selectionStart !== selectionEnd) {
    return false;
  }

  if (event.key === 'ArrowUp') {
    return !value.slice(0, selectionStart).includes('\n');
  }

  if (event.key === 'ArrowDown') {
    return !value.slice(selectionEnd).includes('\n');
  }

  return false;
}

function cleanStreamedAssistantContent(content: string): string {
  return content.replace(/\nUser:|<\|im_end\|>|<\|endoftext\|>/g, '').trim();
}

function ToolsPicker({
  descriptors,
  selectedIds,
  onChange,
}: {
  descriptors: ToolDescriptor[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [collapsedSubGroups, setCollapsedSubGroups] = useState<ReadonlySet<string>>(() => new Set(DEFAULT_COLLAPSED_TOOL_GROUPS));
  const [popoverPos, setPopoverPos] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const lowered = query.trim().toLowerCase();
  const visible = useMemo(() => (
    lowered
      ? descriptors.filter((descriptor) => (
          descriptor.id.toLowerCase().includes(lowered)
          || descriptor.label.toLowerCase().includes(lowered)
          || descriptor.description.toLowerCase().includes(lowered)
        ))
      : descriptors
  ), [descriptors, lowered]);
  const grouped = useMemo(() => {
    const map = new Map<string, { groupLabel: string; entries: ToolDescriptor[] }>();
    for (const descriptor of visible) {
      const bucket = map.get(descriptor.group) ?? { groupLabel: descriptor.groupLabel, entries: [] };
      bucket.entries.push(descriptor);
      map.set(descriptor.group, bucket);
    }
    return Array.from(map.entries())
      .map(([group, value]) => ({ group, ...value }))
      .sort((left, right) => {
        const leftIndex = TOOL_GROUP_ORDER.indexOf(left.group as (typeof TOOL_GROUP_ORDER)[number]);
        const rightIndex = TOOL_GROUP_ORDER.indexOf(right.group as (typeof TOOL_GROUP_ORDER)[number]);
        const normalizedLeftIndex = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
        const normalizedRightIndex = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
        if (normalizedLeftIndex !== normalizedRightIndex) {
          return normalizedLeftIndex - normalizedRightIndex;
        }
        return left.groupLabel.localeCompare(right.groupLabel);
      });
  }, [visible]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPopoverPos(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setPopoverPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
  }, [open]);

  useEffect(() => {
    if (open) {
      // Focus the search field once the popover renders.
      requestAnimationFrame(() => searchRef.current?.focus());
    } else {
      setQuery('');
    }
  }, [open]);

  const toggleId = (id: string) => {
    const next = selectedSet.has(id)
      ? selectedIds.filter((existing) => existing !== id)
      : [...selectedIds, id];
    onChange(next);
  };
  const setGroup = (groupDescriptors: ToolDescriptor[], enable: boolean) => {
    const groupIds = new Set(groupDescriptors.map((descriptor) => descriptor.id));
    const remaining = selectedIds.filter((id) => !groupIds.has(id));
    onChange(enable ? [...remaining, ...groupDescriptors.map((descriptor) => descriptor.id)] : remaining);
  };
  const toggleSubGroup = (group: string) => {
    setCollapsedSubGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  const count = selectedIds.length;
  const total = descriptors.length;
  const triggerLabel = count > 0
    ? `Configure tools (${count} of ${total} selected)`
    : 'Configure tools (none selected)';

  return (
    <div className="tools-picker">
      <button
        ref={triggerRef}
        type="button"
        className={`tools-picker-trigger${count > 0 ? ' is-selected' : ''}`}
        aria-label={triggerLabel}
        title="Tools"
        data-tooltip="Tools"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        {...panelTitlebarControlProps}
      >
        <Icon name="slidersHorizontal" size={13} />
        {count > 0 && <span className="tools-picker-count" aria-hidden="true">{count}</span>}
      </button>
      {open && popoverPos && createPortal(
        <div
          ref={popoverRef}
          className="tools-picker-popover"
          role="dialog"
          aria-label="Tools picker"
          style={{ top: popoverPos.top, right: popoverPos.right }}
          {...panelTitlebarControlProps}
        >
          <div className="tools-picker-header">
            <input
              ref={searchRef}
              type="search"
              className="tools-picker-search"
              placeholder="Search tools…"
              aria-label="Search tools"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="tools-picker-summary" aria-live="polite">{count} selected</span>
          </div>
          <div className="tools-picker-body">
            {grouped.length === 0 && (
              <div className="tools-picker-empty">No tools match.</div>
            )}
            {grouped.map(({ group, groupLabel, entries }) => {
              const groupSelectedCount = entries.filter((descriptor) => selectedSet.has(descriptor.id)).length;
              const allSelected = entries.length > 0 && groupSelectedCount === entries.length;
              const someSelected = groupSelectedCount > 0 && !allSelected;
              const isCollapsible = group !== 'built-in' && !lowered;
              const isCollapsed = isCollapsible && collapsedSubGroups.has(group);

              // For the built-in group (when not searching), split entries into ungrouped
              // items (e.g. CLI) and named sub-groups (Browser, Sessions, Files, …).
              const builtInSubGroups = group === 'built-in' && !lowered ? (() => {
                const sgMap = new Map<string, { subGroupLabel: string; subEntries: ToolDescriptor[] }>();
                for (const d of entries) {
                  if (!d.subGroup) continue;
                  const bucket = sgMap.get(d.subGroup) ?? { subGroupLabel: d.subGroupLabel ?? d.subGroup, subEntries: [] };
                  bucket.subEntries.push(d);
                  sgMap.set(d.subGroup, bucket);
                }
                return [...sgMap.entries()].sort((a, b) => {
                  const ai = TOOL_GROUP_ORDER.indexOf(a[0] as (typeof TOOL_GROUP_ORDER)[number]);
                  const bi = TOOL_GROUP_ORDER.indexOf(b[0] as (typeof TOOL_GROUP_ORDER)[number]);
                  if (ai !== -1 && bi !== -1) return ai - bi;
                  if (ai !== -1) return -1;
                  if (bi !== -1) return 1;
                  return a[1].subGroupLabel.localeCompare(b[1].subGroupLabel);
                });
              })() : null;
              const ungroupedEntries = builtInSubGroups ? entries.filter((d) => !d.subGroup) : null;

              return (
                <div className="tools-picker-group" key={group}>
                  <div
                    className="tools-picker-group-header"
                    {...(isCollapsible ? {
                      role: 'button' as const,
                      tabIndex: 0,
                      'aria-expanded': !isCollapsed,
                      onClick: () => toggleSubGroup(group),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSubGroup(group); }
                      },
                    } : {})}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Toggle all ${groupLabel} tools`}
                      checked={allSelected}
                      ref={(element) => { if (element) element.indeterminate = someSelected; }}
                      onChange={(event) => setGroup(entries, event.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="tools-picker-row-text tools-picker-subgroup-name-row">
                      {isCollapsible && <Icon name={isCollapsed ? 'chevronRight' : 'chevronDown'} size={10} />}
                      <span className="tools-picker-group-label">{groupLabel}</span>
                      <span className="tools-picker-group-count">{groupSelectedCount}/{entries.length}</span>
                    </span>
                  </div>
                  {!isCollapsed && (builtInSubGroups ? (
                    <>
                      {ungroupedEntries && ungroupedEntries.length > 0 && (
                        <ul className="tools-picker-list" role="list">
                          {ungroupedEntries.map((descriptor) => (
                            <li key={descriptor.id} className="tools-picker-row">
                              <label className="tools-picker-row-label">
                                <input
                                  type="checkbox"
                                  aria-label={descriptor.label}
                                  checked={selectedSet.has(descriptor.id)}
                                  onChange={() => toggleId(descriptor.id)}
                                />
                                <span className="tools-picker-row-text">
                                  <span className="tools-picker-row-name">{descriptor.label}</span>
                                  <span className="tools-picker-row-desc">{descriptor.description}</span>
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                      {builtInSubGroups.map(([sgKey, { subGroupLabel: sgLabel, subEntries }]) => {
                        const sgSelectedCount = subEntries.filter((d) => selectedSet.has(d.id)).length;
                        const sgAllSelected = subEntries.length > 0 && sgSelectedCount === subEntries.length;
                        const sgSomeSelected = sgSelectedCount > 0 && !sgAllSelected;
                        const isSgCollapsed = collapsedSubGroups.has(sgKey);
                        return (
                          <div className="tools-picker-group" key={sgKey}>
                            <div
                              className="tools-picker-group-header"
                              role="button"
                              tabIndex={0}
                              aria-expanded={!isSgCollapsed}
                              onClick={() => toggleSubGroup(sgKey)}
                              onKeyDown={(e: React.KeyboardEvent) => {
                                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSubGroup(sgKey); }
                              }}
                            >
                              <input
                                type="checkbox"
                                aria-label={`Toggle all ${sgLabel} tools`}
                                checked={sgAllSelected}
                                ref={(element) => { if (element) element.indeterminate = sgSomeSelected; }}
                                onChange={(event) => setGroup(subEntries, event.target.checked)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="tools-picker-row-text tools-picker-subgroup-name-row">
                                <Icon name={isSgCollapsed ? 'chevronRight' : 'chevronDown'} size={10} />
                                <span className="tools-picker-group-label">{sgLabel}</span>
                                <span className="tools-picker-group-count">{sgSelectedCount}/{subEntries.length}</span>
                              </span>
                            </div>
                            {!isSgCollapsed && (
                              <ul className="tools-picker-list tools-picker-subgroup-list" role="list">
                                {subEntries.map((descriptor) => (
                                  <li key={descriptor.id} className="tools-picker-row">
                                    <label className="tools-picker-row-label tools-picker-row-label--nested">
                                      <input
                                        type="checkbox"
                                        aria-label={descriptor.label}
                                        checked={selectedSet.has(descriptor.id)}
                                        onChange={() => toggleId(descriptor.id)}
                                      />
                                      <span className="tools-picker-row-text">
                                        <span className="tools-picker-row-name">{descriptor.label}</span>
                                        <span className="tools-picker-row-desc">{descriptor.description}</span>
                                      </span>
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <ul className={`tools-picker-list${group === 'built-in' ? '' : ' tools-picker-subgroup-list'}`} role="list">
                      {entries.map((descriptor) => (
                        <li key={descriptor.id} className="tools-picker-row">
                          <label className={`tools-picker-row-label${group === 'built-in' ? '' : ' tools-picker-row-label--nested'}`}>
                            <input
                              type="checkbox"
                              aria-label={descriptor.label}
                              checked={selectedSet.has(descriptor.id)}
                              onChange={() => toggleId(descriptor.id)}
                            />
                            <span className="tools-picker-row-text">
                              <span className="tools-picker-row-name">{descriptor.label}</span>
                              <span className="tools-picker-row-desc">{descriptor.description}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="tools-picker-footer">
            <button type="button" className="tools-picker-done" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

function BenchmarkRouteBadge({ route }: { route: BenchmarkRouteRecommendation | null }) {
  if (!route) return null;
  const taskClass = getBenchmarkTaskClass(route.taskClass);
  return (
    <span className="benchmark-route-badge" title={route.reason}>
      <span>{taskClass.label}</span>
      <strong>{route.candidate.label}</strong>
    </span>
  );
}

function selectCompatibleBenchmarkCandidates(
  provider: AgentProvider,
  candidates: BenchmarkRoutingCandidate[],
): BenchmarkRoutingCandidate[] {
  if (provider === 'codi' || provider === 'ghcp') {
    return candidates.filter((candidate) => candidate.provider === provider);
  }
  return candidates;
}

function parseBenchmarkIndexUrlList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getConfiguredBenchmarkIndexUrls(): string[] {
  const globalUrls = typeof window !== 'undefined'
    ? parseBenchmarkIndexUrlList((window as Window & { __AGENT_BROWSER_BENCHMARK_INDEX_URLS__?: unknown }).__AGENT_BROWSER_BENCHMARK_INDEX_URLS__)
    : [];
  const envUrls = parseBenchmarkIndexUrlList(import.meta.env.VITE_AGENT_BROWSER_BENCHMARK_INDEX_URLS);
  return Array.from(new Set([...globalUrls, ...envUrls]));
}

function buildPartnerAgentModelRef(
  provider: ModelBackedAgentProvider,
  modelIds: {
    codiModelId: string;
    ghcpModelId: string;
    cursorModelId: string;
    codexModelId: string;
  },
): string {
  const modelId = provider === 'codi'
    ? modelIds.codiModelId
    : provider === 'ghcp'
      ? modelIds.ghcpModelId
      : provider === 'cursor'
        ? modelIds.cursorModelId
        : modelIds.codexModelId;
  return modelId ? `${provider}:${modelId}` : '';
}

function ChatPanel({
  installedModels,
  copilotState,
  cursorState,
  codexState,
  pendingSearch,
  onSearchConsumed,
  onToast,
  workspaceName,
  workspaceFiles,
  sessionSettingsContent,
  artifactPromptContext,
  attachedArtifactCount,
  workspaceCapabilities,
  defaultExtensions,
  evaluationAgents,
  negativeRubricTechniques,
  onNegativeRubricTechnique,
  activeSessionId,
  activeMode,
  onSwitchMode,
  onNewSession,
  onClose,
  onTerminalFsPathsChanged,
  onOpenModels,
  onWorkspaceFileUpsert,
  onCopyToClipboard,
  onSecretRecordsChanged,
  bashBySessionRef,
  webMcpModelContext,
  browserLocationContext,
  setBrowserLocationContext,
  benchmarkRoutingSettings,
  benchmarkRoutingCandidates,
  adversaryToolReviewSettings,
  securityReviewAgentSettings,
  partnerAgentControlPlaneSettings,
  onPartnerAgentAuditEntry,
  secretSettings,
  onSessionMcpControllerChange,
  onSessionRuntimeChange,
  dragHandleProps,
}: {
  installedModels: HFModel[];
  copilotState: CopilotRuntimeState;
  cursorState: CursorRuntimeState;
  codexState: CodexRuntimeState;
  pendingSearch: string | null;
  onSearchConsumed: () => void;
  onToast: (toast: Exclude<ToastState, null>) => void;
  workspaceName: string;
  workspaceFiles: WorkspaceFile[];
  sessionSettingsContent?: string | null;
  artifactPromptContext?: string;
  attachedArtifactCount?: number;
  workspaceCapabilities: WorkspaceCapabilities;
  defaultExtensions: DefaultExtensionRuntime | null;
  evaluationAgents: CustomEvaluationAgent[];
  negativeRubricTechniques: string[];
  onNegativeRubricTechnique: (technique: string) => void;
  activeSessionId: string | null;
  activeMode: 'agent' | 'terminal';
  onSwitchMode: (mode: 'agent' | 'terminal') => void;
  onNewSession: () => void;
  onClose: () => void;
  onTerminalFsPathsChanged: (sessionId: string, paths: string[]) => void;
  onOpenModels: () => void;
  onWorkspaceFileUpsert: (file: WorkspaceFile) => void;
  onCopyToClipboard: (text: string, label: string) => Promise<void>;
  onSecretRecordsChanged?: () => void | Promise<void>;
  bashBySessionRef: React.MutableRefObject<Record<string, Bash>>;
  webMcpModelContext: ModelContext;
  browserLocationContext: BrowserLocationContext;
  setBrowserLocationContext: React.Dispatch<React.SetStateAction<BrowserLocationContext>>;
  benchmarkRoutingSettings: BenchmarkRoutingSettings;
  benchmarkRoutingCandidates: BenchmarkRoutingCandidate[];
  adversaryToolReviewSettings: AdversaryToolReviewSettings;
  securityReviewAgentSettings: SecurityReviewAgentSettings;
  partnerAgentControlPlaneSettings: PartnerAgentControlPlaneSettings;
  onPartnerAgentAuditEntry?: (entry: PartnerAgentAuditEntry) => void;
  secretSettings: SecretManagementSettings;
  onSessionMcpControllerChange?: (sessionId: string, controller: SessionMcpController | null) => void;
  onSessionRuntimeChange?: (sessionId: string, runtime: SessionMcpRuntimeState | null) => void;
  dragHandleProps?: PanelDragHandleProps;
}) {
  const [messagesBySession, setMessagesBySession] = useStoredState<Record<string, ChatMessage[]>>(
    localStorageBackend,
    STORAGE_KEYS.chatMessagesBySession,
    isChatMessagesBySession,
    {},
  );
  const [input, setInput] = useState('');
  const [chatHistoryBySession, setChatHistoryBySession] = useStoredState<Record<string, string[]>>(
    localStorageBackend,
    STORAGE_KEYS.chatHistoryBySession,
    isStringArrayRecord,
    {},
  );
  const [browserNotificationSettings, setBrowserNotificationSettings] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.browserNotificationSettings,
    isBrowserNotificationSettings,
    DEFAULT_BROWSER_NOTIFICATION_SETTINGS,
  );
  const [selectedModelBySession, setSelectedModelBySession] = useStoredState<Record<string, string>>(
    sessionStorageBackend,
    STORAGE_KEYS.selectedCodiModelBySession,
    isStringRecord,
    {},
  );
  const [selectedProviderBySession, setSelectedProviderBySession] = useStoredState<Record<string, AgentProvider>>(
    sessionStorageBackend,
    STORAGE_KEYS.selectedProviderBySession,
    isAgentProviderRecord,
    {},
  );
  const [selectedCopilotModelBySession, setSelectedCopilotModelBySession] = useStoredState<Record<string, string>>(
    sessionStorageBackend,
    STORAGE_KEYS.selectedCopilotModelBySession,
    isStringRecord,
    {},
  );
  const [selectedCursorModelBySession, setSelectedCursorModelBySession] = useStoredState<Record<string, string>>(
    sessionStorageBackend,
    STORAGE_KEYS.selectedCursorModelBySession,
    isStringRecord,
    {},
  );
  const [selectedCodexModelBySession, setSelectedCodexModelBySession] = useStoredState<Record<string, string>>(
    sessionStorageBackend,
    STORAGE_KEYS.selectedCodexModelBySession,
    isStringRecord,
    {},
  );
  const [selectedToolIdsBySession, setSelectedToolIdsBySession] = useState<Record<string, string[]>>({});
  const [webMcpToolVersion, setWebMcpToolVersion] = useState(0);
  const [bashHistoryBySession, setBashHistoryBySession] = useState<Record<string, BashEntry[]>>({});
  const [historyCursorByScope, setHistoryCursorByScope] = useState<Record<string, number>>({});
  const [selectedSkillSuggestionIndex, setSelectedSkillSuggestionIndex] = useState(0);
  const [cwdBySession, setCwdBySession] = useState<Record<string, string>>({});
  const [activeGenerationSessionId, setActiveGenerationSessionId] = useState<string | null>(null);
  const [activeActivityBySession, setActiveActivityBySession] = useState<Record<string, ActivitySelection | null>>({});
  const [pendingMcpMessage, setPendingMcpMessage] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharedChatApi, setSharedChatApi] = useState<SharedChatApi | null>(null);
  const showBash = activeMode === 'terminal';
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const terminalInputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const sharedChatApiRef = useRef<SharedChatApi | null>(null);
  const consumedPendingSearchRef = useRef<string | null>(null);
  const browserNotificationApi = useMemo(
    () => createBrowserNotificationApi(typeof window !== 'undefined' ? window.Notification : undefined),
    [],
  );
  const browserLocationApi = useMemo(
    () => createBrowserLocationApi(typeof navigator !== 'undefined' ? navigator.geolocation : undefined),
    [],
  );
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<BrowserNotificationPermission>(
    () => getBrowserNotificationPermission(browserNotificationApi),
  );
  const browserNotificationSettingsRef = useRef(browserNotificationSettings);
  const activeGenerationRef = useRef<{
    assistantId: string;
    sessionId: string;
    cancel: () => void;
    finalizeCancelled: () => void;
  } | null>(null);
  useEffect(() => {
    browserNotificationSettingsRef.current = browserNotificationSettings;
  }, [browserNotificationSettings]);
  const browserNotificationDispatcher = useMemo(
    () => createBrowserNotificationDispatcher({
      api: browserNotificationApi,
      getSettings: () => browserNotificationSettingsRef.current,
    }),
    [browserNotificationApi],
  );
  const webMcpBridge = useMemo(() => createWebMcpToolBridge(webMcpModelContext), [webMcpModelContext]);
  const sandboxFlags = getSandboxFeatureFlags();
  const activeChatSessionId = activeSessionId ?? 'session:fallback';
  const locationPromptContext = useMemo(
    () => buildBrowserLocationPromptContext(browserLocationContext),
    [browserLocationContext],
  );
  const runtimeExtensionPromptContext = useMemo(
    () => buildRuntimeExtensionPromptContext(defaultExtensions),
    [defaultExtensions],
  );
  const workspacePromptContext = useMemo(
    () => [
      buildWorkspacePromptContext(workspaceFiles, activeSessionId ? [{
        scope: 'session',
        label: `<session> ${activeSessionId}`,
        sessionId: activeSessionId,
        path: SESSION_WORKSPACE_SETTINGS_PATH,
        content: sessionSettingsContent ?? DEFAULT_SETTINGS_JSON,
      }] : []),
      artifactPromptContext,
      locationPromptContext,
      runtimeExtensionPromptContext,
    ].filter((section): section is string => Boolean(section)).join('\n\n'),
    [activeSessionId, artifactPromptContext, locationPromptContext, runtimeExtensionPromptContext, sessionSettingsContent, workspaceFiles],
  );
  const messages = messagesBySession[activeChatSessionId] ?? [createSystemChatMessage(activeChatSessionId)];
  const selectedProvider = selectedProviderBySession[activeChatSessionId] ?? getDefaultAgentProvider({ installedModels, copilotState, cursorState });
  const selectedModelId = selectedModelBySession[activeChatSessionId] ?? '';
  const selectedCopilotModelId = selectedCopilotModelBySession[activeChatSessionId] ?? '';
  const selectedCursorModelId = selectedCursorModelBySession[activeChatSessionId] ?? '';
  const selectedCodexModelId = selectedCodexModelBySession[activeChatSessionId] ?? '';
  const {
    codiModelId: effectiveSelectedModelId,
    ghcpModelId: effectiveSelectedCopilotModelId,
    cursorModelId: effectiveSelectedCursorModelId,
    codexModelId: effectiveSelectedCodexModelId,
  } = resolveAgentModelIds({
    installedModels,
    selectedCodiModelId: selectedModelId,
    copilotModels: copilotState.models,
    selectedGhcpModelId: selectedCopilotModelId,
    cursorModels: cursorState.models,
    selectedCursorModelId,
    codexModels: codexState.models,
    selectedCodexModelId,
  });
  const activeLocalModel = installedModels.find((model) => model.id === effectiveSelectedModelId);
  const activeCopilotModel = copilotState.models.find((model) => model.id === effectiveSelectedCopilotModelId);
  const activeCursorModel = cursorState.models.find((model) => model.id === effectiveSelectedCursorModelId);
  const activeCodexModel = codexState.models.find((model) => model.id === effectiveSelectedCodexModelId);
  const hasInstalledModels = hasCodiModels(installedModels);
  const hasAvailableCopilotModels = hasGhcpAccess(copilotState);
  const hasAvailableCursorModels = hasCursorAccess(cursorState);
  const hasAvailableCodexModels = hasCodexAccess(codexState);
  const selectedRuntimeProvider = resolveRuntimeAgentProvider({
    provider: selectedProvider,
    hasCodiModelsReady: Boolean(activeLocalModel),
    hasGhcpModelsReady: Boolean(effectiveSelectedCopilotModelId) && hasAvailableCopilotModels,
    hasCursorModelsReady: Boolean(effectiveSelectedCursorModelId) && hasAvailableCursorModels,
    hasCodexModelsReady: Boolean(effectiveSelectedCodexModelId) && hasAvailableCodexModels,
  });
  const hasActiveGeneration = activeGenerationSessionId !== null;
  const isActiveSessionGenerating = activeGenerationSessionId === activeChatSessionId;
  const toolDescriptors = useMemo(
    () => [...DEFAULT_TOOL_DESCRIPTORS, ...webMcpBridge.getDescriptors()],
    [webMcpBridge, webMcpToolVersion],
  );
  const selectedToolIds = selectedToolIdsBySession[activeChatSessionId] ?? toolDescriptors.map((descriptor) => descriptor.id);
  const toolsEnabled = selectedToolIds.length > 0;
  const selectedPartnerAgentModelRef = buildPartnerAgentModelRef(selectedRuntimeProvider, {
    codiModelId: effectiveSelectedModelId,
    ghcpModelId: effectiveSelectedCopilotModelId,
    cursorModelId: effectiveSelectedCursorModelId,
    codexModelId: effectiveSelectedCodexModelId,
  });
  const partnerAgentControlPlane = useMemo(
    () => buildPartnerAgentControlPlane({
      settings: partnerAgentControlPlaneSettings,
      installedModels,
      copilotState,
      cursorState,
      codexState,
      selectedProvider,
      runtimeProvider: selectedRuntimeProvider,
      selectedModelRef: selectedPartnerAgentModelRef,
      selectedToolIds,
    }),
    [
      codexState,
      copilotState,
      cursorState,
      installedModels,
      partnerAgentControlPlaneSettings,
      selectedPartnerAgentModelRef,
      selectedProvider,
      selectedRuntimeProvider,
      selectedToolIds,
    ],
  );
  const securityReviewRunPlan = useMemo(
    () => buildSecurityReviewRunPlan({
      settings: securityReviewAgentSettings,
      selectedToolIds,
    }),
    [securityReviewAgentSettings, selectedToolIds],
  );
  const compatibleBenchmarkRoutingCandidates = useMemo(
    () => selectCompatibleBenchmarkCandidates(selectedProvider, benchmarkRoutingCandidates),
    [benchmarkRoutingCandidates, selectedProvider],
  );
  const currentBenchmarkTaskClass = inferBenchmarkTaskClass({
    provider: selectedProvider,
    latestUserInput: input.trim(),
    toolsEnabled,
  });
  const currentBenchmarkRoute = recommendBenchmarkRoute({
    taskClass: currentBenchmarkTaskClass,
    candidates: compatibleBenchmarkRoutingCandidates,
    settings: benchmarkRoutingSettings,
  });
  const setSelectedToolIdsForActiveSession = useCallback((ids: string[]) => {
    selectedToolIdsRef.current = ids;
    setSelectedToolIdsBySession((current) => ({ ...current, [activeChatSessionId]: ids }));
  }, [activeChatSessionId]);
  const activeActivitySelection = activeActivityBySession[activeChatSessionId] ?? null;
  const activeActivityMessageId = activeActivitySelection?.messageId ?? null;
  // Panel kind is no longer used by the unified ProcessPanel; selection retains
  // the kind tag only so legacy tests can still pass it through.
  void activeActivitySelection;
  const activeActivityMessage = !showBash && activeActivityMessageId
    ? messages.find((message) => message.id === activeActivityMessageId) ?? null
    : null;
  const activeInputHistoryScopeKey = buildInputHistoryScopeKey(showBash ? 'terminal' : 'chat', activeChatSessionId);
  const skillAutocompleteQuery = showBash ? null : getSkillAutocompleteQuery(input);
  const skillSuggestions = useMemo(() => {
    if (!skillAutocompleteQuery) {
      return [] as Array<{ name: string; description: string }>;
    }

    const uniqueSkills = new Map<string, string>();
    for (const skill of workspaceCapabilities.skills) {
      if (!uniqueSkills.has(skill.name)) {
        uniqueSkills.set(skill.name, skill.description);
      }
    }

    return Array.from(uniqueSkills.entries())
      .map(([name, description]) => ({ name, description }))
      .filter((skill) => skill.name.toLowerCase().includes(skillAutocompleteQuery))
      .sort((left, right) => {
        const leftStartsWith = left.name.toLowerCase().startsWith(skillAutocompleteQuery);
        const rightStartsWith = right.name.toLowerCase().startsWith(skillAutocompleteQuery);
        if (leftStartsWith !== rightStartsWith) {
          return leftStartsWith ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });
  }, [skillAutocompleteQuery, workspaceCapabilities.skills]);
  const isSkillAutocompleteOpen = skillSuggestions.length > 0;
  const canSubmit = !hasActiveGeneration && Boolean(input.trim()) && (
    Boolean(parseSandboxPrompt(input))
    || selectedProvider === 'tour-guide'
    || resolveAgentProviderForTask({ selectedProvider, latestUserInput: input.trim() }) === 'tour-guide'
    || (selectedProvider === 'codi' && Boolean(effectiveSelectedModelId))
    || (selectedProvider === 'ghcp' && Boolean(effectiveSelectedCopilotModelId) && hasAvailableCopilotModels)
    || (selectedProvider === 'cursor' && Boolean(effectiveSelectedCursorModelId) && hasAvailableCursorModels)
    || (selectedProvider === 'codex' && Boolean(effectiveSelectedCodexModelId) && hasAvailableCodexModels)
    || ((selectedProvider === 'researcher' || selectedProvider === 'debugger' || selectedProvider === 'planner' || selectedProvider === 'security') && (
      (Boolean(effectiveSelectedCopilotModelId) && hasAvailableCopilotModels)
      || (Boolean(effectiveSelectedCursorModelId) && hasAvailableCursorModels)
      || Boolean(activeLocalModel)
    ))
  );
  const providerSummary = getAgentProviderSummary({ provider: selectedProvider, installedModels, copilotState, cursorState, codexState });
  const defaultExtensionSummary = summarizeDefaultExtensionRuntime(defaultExtensions);
  const pluginCount = workspaceCapabilities.plugins.length + defaultExtensionSummary.pluginCount;
  const hookCount = workspaceCapabilities.hooks.length + defaultExtensionSummary.hookCount;
  const contextSummary = `${providerSummary} · tools ${toolsEnabled ? `${selectedToolIds.length} selected` : 'off'} · security ${securityReviewRunPlan.enabled ? securityReviewRunPlan.agents.length : 'off'} · partners ${partnerAgentControlPlane.settings.enabled ? `${partnerAgentControlPlane.readyAgentCount} ready` : 'off'} · ${pluginCount} plugins · ${hookCount} hooks · artifacts ${attachedArtifactCount ?? 0} · location ${locationPromptContext ? 'on' : 'off'} · ${pendingSearch ? 'web search queued' : 'workspace ready'}`;
  const workspacePath = showBash && activeSessionId ? (cwdBySession[activeSessionId] ?? BASH_INITIAL_CWD) : BASH_INITIAL_CWD;
  const selectedProviderRef = useRef(selectedProvider);
  const effectiveSelectedModelIdRef = useRef(effectiveSelectedModelId);
  const effectiveSelectedCopilotModelIdRef = useRef(effectiveSelectedCopilotModelId);
  const effectiveSelectedCursorModelIdRef = useRef(effectiveSelectedCursorModelId);
  const effectiveSelectedCodexModelIdRef = useRef(effectiveSelectedCodexModelId);
  const selectedToolIdsRef = useRef<string[]>(selectedToolIds);
  const activeModeRef = useRef(activeMode);
  const activeSessionIdRef = useRef(activeSessionId);
  const cwdBySessionRef = useRef(cwdBySession);
  const workspaceFilesRef = useRef(workspaceFiles);

  useEffect(() => {
    selectedProviderRef.current = selectedProvider;
  }, [selectedProvider]);

  useEffect(() => {
    effectiveSelectedModelIdRef.current = effectiveSelectedModelId;
  }, [effectiveSelectedModelId]);

  useEffect(() => {
    effectiveSelectedCopilotModelIdRef.current = effectiveSelectedCopilotModelId;
  }, [effectiveSelectedCopilotModelId]);

  useEffect(() => {
    effectiveSelectedCursorModelIdRef.current = effectiveSelectedCursorModelId;
  }, [effectiveSelectedCursorModelId]);

  useEffect(() => {
    effectiveSelectedCodexModelIdRef.current = effectiveSelectedCodexModelId;
  }, [effectiveSelectedCodexModelId]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useLayoutEffect(() => {
    selectedToolIdsRef.current = selectedToolIds;
  }, [selectedToolIds]);

  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  useEffect(() => {
    cwdBySessionRef.current = cwdBySession;
  }, [cwdBySession]);

  useEffect(() => {
    workspaceFilesRef.current = workspaceFiles;
  }, [workspaceFiles]);

  useEffect(() => {
    setSelectedSkillSuggestionIndex(0);
  }, [skillAutocompleteQuery]);

  const resetActiveInputHistoryCursor = useCallback(() => {
    setHistoryCursorByScope((current) => {
      if (!(activeInputHistoryScopeKey in current)) {
        return current;
      }
      const next = { ...current };
      delete next[activeInputHistoryScopeKey];
      return next;
    });
  }, [activeInputHistoryScopeKey]);

  const handleInputChange = useCallback((nextValue: string) => {
    resetActiveInputHistoryCursor();
    setInput(nextValue);
  }, [resetActiveInputHistoryCursor]);

  const applySkillSuggestion = useCallback((skillName: string) => {
    resetActiveInputHistoryCursor();
    setInput((current) => applySkillAutocomplete(current, skillName));
    requestAnimationFrame(() => chatInputRef.current?.focus());
  }, [resetActiveInputHistoryCursor]);

  const navigateInputHistory = useCallback((direction: 'up' | 'down') => {
    const entries = showBash
      ? (activeSessionId ? (bashHistoryBySession[activeSessionId] ?? []).map((entry) => entry.cmd) : [])
      : (chatHistoryBySession[activeChatSessionId] ?? []);
    if (!entries.length) {
      return false;
    }

    const currentCursor = historyCursorByScope[activeInputHistoryScopeKey] ?? entries.length;
    const nextCursor = direction === 'up'
      ? Math.max(currentCursor - 1, 0)
      : Math.min(currentCursor + 1, entries.length);

    setHistoryCursorByScope((current) => ({
      ...current,
      [activeInputHistoryScopeKey]: nextCursor,
    }));
    setInput(nextCursor === entries.length ? '' : entries[nextCursor] ?? '');
    return true;
  }, [activeChatSessionId, activeInputHistoryScopeKey, activeSessionId, bashHistoryBySession, chatHistoryBySession, historyCursorByScope, showBash]);

  const handleTerminalInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }
    if (navigateInputHistory(event.key === 'ArrowUp' ? 'up' : 'down')) {
      event.preventDefault();
    }
  }, [navigateInputHistory]);

  useEffect(() => {
    return webMcpBridge.subscribe(() => {
      setWebMcpToolVersion((current) => current + 1);
    });
  }, [webMcpBridge]);

  useEffect(() => {
    setMessagesBySession((current) => current[activeChatSessionId]
      ? current
      : { ...current, [activeChatSessionId]: [createSystemChatMessage(activeChatSessionId)] });
  }, [activeChatSessionId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!activeActivityMessageId) return;
    if (messages.some((message) => message.id === activeActivityMessageId)) return;
    setActiveActivityBySession((current) => ({ ...current, [activeChatSessionId]: null }));
  }, [activeActivityMessageId, activeChatSessionId, messages]);

  useEffect(() => {
    if (!activeActivityMessage) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setActiveActivityBySession((current) => ({ ...current, [activeChatSessionId]: null }));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeActivityMessage, activeChatSessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getSessionBash = useCallback((id: string) => {
    const bashSessions = bashBySessionRef.current;
    if (!bashSessions[id]) {
      const files = createInitialBashFiles();
      bashSessions[id] = new Bash({ cwd: BASH_INITIAL_CWD, files });
      onTerminalFsPathsChanged(id, bashSessions[id].fs.getAllPaths());
    }
    return bashSessions[id];
  }, [onTerminalFsPathsChanged]);

  useEffect(() => {
    if (!activeSessionId) return;
    const bash = getSessionBash(activeSessionId);
    onTerminalFsPathsChanged(activeSessionId, bash.fs.getAllPaths());
  }, [activeSessionId, getSessionBash, onTerminalFsPathsChanged]);

  useEffect(() => {
    if (showBash) {
      terminalInputRef.current?.focus();
      return;
    }
    chatInputRef.current?.focus();
  }, [activeChatSessionId, activeSessionId, showBash]);

  const clearActiveGeneration = useCallback((assistantId?: string) => {
    const activeGeneration = activeGenerationRef.current;
    if (!activeGeneration) return;
    if (assistantId && activeGeneration.assistantId !== assistantId) return;
    activeGenerationRef.current = null;
    setActiveGenerationSessionId(null);
  }, []);

  const stopActiveGeneration = useCallback(() => {
    const activeGeneration = activeGenerationRef.current;
    if (!activeGeneration) return;
    activeGeneration.cancel();
    activeGeneration.finalizeCancelled();
    clearActiveGeneration(activeGeneration.assistantId);
    requestAnimationFrame(() => chatInputRef.current?.focus());
  }, [clearActiveGeneration]);

  useEffect(() => () => {
    activeGenerationRef.current?.cancel();
    activeGenerationRef.current = null;
  }, []);

  function appendSharedMessages(nextEntries: ChatMessage[]) {
    const nextMessages = [...messagesRef.current, ...nextEntries];
    messagesRef.current = nextMessages;
    setMessagesBySession((current) => ({ ...current, [activeChatSessionId]: nextMessages }));
  }

  function updateMessage(id: string, patch: Partial<ChatMessage>) {
    setMessagesBySession((current) => {
      const sessionMessages = current[activeChatSessionId] ?? [createSystemChatMessage(activeChatSessionId)];
      const nextMessages = sessionMessages.map((message) => {
        if (message.id !== id) return message;
        if (message.statusText === 'stopped') return neutralizeStoppedMessage(message);
        const nextMessage = { ...message, ...patch };
        return nextMessage.statusText === 'stopped' ? neutralizeStoppedMessage(nextMessage) : nextMessage;
      });
      return { ...current, [activeChatSessionId]: nextMessages };
    });
  }

  const handleSharedChatApiChange = useCallback((api: SharedChatApi | null) => {
    sharedChatApiRef.current = api;
    setSharedChatApi(api);
  }, []);

  const appendSharedChatStatus = useCallback((text: string) => {
    appendSharedMessages([{
      id: createUniqueId(),
      role: 'system',
      status: 'complete',
      content: text,
    }]);
  }, [appendSharedMessages]);

  const appendRemoteSharedChatMessage = useCallback((text: string, peerLabel: string) => {
    appendSharedMessages([{
      id: createUniqueId(),
      role: 'user',
      status: 'complete',
      content: `Shared from ${peerLabel}:\n${text}`,
    }]);
  }, [appendSharedMessages]);

  const appendElicitationCard = useCallback((detail: UserElicitationEventDetail) => {
    const card: NonNullable<ChatMessage['cards']>[number] = {
      app: 'Elicitation',
      kind: 'elicitation',
      requestId: detail.requestId,
      prompt: detail.prompt,
      fields: detail.fields,
      status: 'pending',
      args: {
        prompt: detail.prompt,
        reason: detail.reason,
        fields: detail.fields,
      },
    };
    const targetAssistantId = activeGenerationRef.current?.assistantId;
    if (!targetAssistantId) {
      appendSharedMessages([{
        id: createUniqueId(),
        role: 'assistant',
        status: 'complete',
        content: '',
        cards: [card],
      }]);
      return;
    }
    setMessagesBySession((current) => {
      const sessionMessages = current[activeChatSessionId] ?? [createSystemChatMessage(activeChatSessionId)];
      const nextMessages = sessionMessages.map((message) => (
        message.id === targetAssistantId
          ? { ...message, cards: [...(message.cards ?? []), card] }
          : message
      ));
      messagesRef.current = nextMessages;
      return { ...current, [activeChatSessionId]: nextMessages };
    });
  }, [activeChatSessionId]);

  useEffect(() => {
    const listener = (event: Event) => {
      appendElicitationCard((event as CustomEvent<UserElicitationEventDetail>).detail);
    };
    window.addEventListener(USER_ELICITATION_EVENT, listener);
    return () => window.removeEventListener(USER_ELICITATION_EVENT, listener);
  }, [appendElicitationCard]);

  const appendSecretRequestCard = useCallback((detail: SecretRequestEventDetail) => {
    const card: NonNullable<ChatMessage['cards']>[number] = {
      app: 'Secrets Manager',
      kind: 'secret',
      requestId: detail.requestId,
      prompt: detail.prompt,
      reason: detail.reason,
      secretName: detail.name,
      status: 'pending',
      args: {
        name: detail.name,
        prompt: detail.prompt,
        reason: detail.reason,
      },
    };
    const targetAssistantId = activeGenerationRef.current?.assistantId;
    if (!targetAssistantId) {
      appendSharedMessages([{
        id: createUniqueId(),
        role: 'assistant',
        status: 'complete',
        content: '',
        cards: [card],
      }]);
      return;
    }
    setMessagesBySession((current) => {
      const sessionMessages = current[activeChatSessionId] ?? [createSystemChatMessage(activeChatSessionId)];
      const nextMessages = sessionMessages.map((message) => (
        message.id === targetAssistantId
          ? { ...message, cards: [...(message.cards ?? []), card] }
          : message
      ));
      messagesRef.current = nextMessages;
      return { ...current, [activeChatSessionId]: nextMessages };
    });
  }, [activeChatSessionId]);

  useEffect(() => {
    const listener = (event: Event) => {
      appendSecretRequestCard((event as CustomEvent<SecretRequestEventDetail>).detail);
    };
    window.addEventListener(SECRET_REQUEST_EVENT, listener);
    return () => window.removeEventListener(SECRET_REQUEST_EVENT, listener);
  }, [appendSecretRequestCard]);


  const handleToggleBrowserNotifications = useCallback(async () => {
    if (browserNotificationSettings.enabled) {
      setBrowserNotificationSettings({ enabled: false });
      onToast({ msg: 'Browser notifications disabled', type: 'info' });
      return;
    }

    const permission = await requestBrowserNotificationPermission(browserNotificationApi);
    setBrowserNotificationPermission(permission);
    if (permission === 'granted') {
      setBrowserNotificationSettings({ enabled: true });
      onToast({ msg: 'Browser notifications enabled', type: 'success' });
      return;
    }

    onToast({
      msg: permission === 'unsupported'
        ? 'Browser notifications are not supported in this browser'
        : 'Browser notification permission was not granted',
      type: 'warning',
    });
  }, [browserNotificationApi, browserNotificationSettings.enabled, onToast, setBrowserNotificationSettings]);

  const handleToggleLocationContext = useCallback(async () => {
    if (browserLocationContext.enabled) {
      setBrowserLocationContext((current) => ({ ...current, enabled: false }));
      onToast({ msg: 'Location context disabled', type: 'info' });
      return;
    }

    const result = await requestBrowserLocationContext(browserLocationApi);
    if (result.status === 'granted') {
      setBrowserLocationContext(result.context);
      onToast({ msg: 'Location context enabled', type: 'success' });
      return;
    }

    onToast({
      msg: result.status === 'unsupported'
        ? 'Location is not supported in this browser'
        : result.status === 'denied'
          ? 'Location permission was not granted'
          : 'Location is unavailable right now',
      type: 'warning',
    });
  }, [browserLocationApi, browserLocationContext.enabled, onToast, setBrowserLocationContext]);

  const notifyAssistantComplete = useCallback((assistantId: string, content: string) => {
    const notificationContent = content.trim();
    browserNotificationDispatcher.notify(buildChatCompletionNotification({
      eventId: `${activeChatSessionId}:${assistantId}:complete`,
      sessionName: workspaceName,
      content: notificationContent,
    }));
    if (!isLikelyUserElicitation(notificationContent)) {
      return;
    }
    browserNotificationDispatcher.notify(buildChatElicitationNotification({
      eventId: `${activeChatSessionId}:${assistantId}:elicitation`,
      sessionName: workspaceName,
      content: notificationContent,
    }));
  }, [activeChatSessionId, browserNotificationDispatcher, workspaceName]);

  const selectActivityMessage = useCallback((messageId: string) => {
    setActiveActivityBySession((current) => ({ ...current, [activeChatSessionId]: { messageId } }));
  }, [activeChatSessionId]);

  const runSandboxPrompt = useCallback(async (text: string, assistantId: string) => {
    const parsed = parseSandboxPrompt(text);
    if (!parsed) {
      return false;
    }
    if (!sandboxFlags.secureBrowserSandboxExec) {
      updateMessage(assistantId, {
        status: 'error',
        content: 'Sandbox execution is disabled. Set VITE_SECURE_BROWSER_SANDBOX_EXEC=true to enable the browser sandbox tool path.',
      });
      return true;
    }
    if (!activeSessionId) {
      updateMessage(assistantId, {
        status: 'error',
        content: 'Open or create a session before running sandbox tools.',
      });
      return true;
    }

    const bash = getSessionBash(activeSessionId);
    const service = createSandboxExecutionService({
      flags: sandboxFlags,
      persistenceTarget: {
        mkdir: (path, options) => bash.fs.mkdir(path, options),
        writeFile: (path, content, encoding) => bash.fs.writeFile(path, content, encoding ?? 'utf-8'),
      },
    });

    try {
      const session = await service.createSession();
      const result = await session.run(parsed.request);
      const summary = buildRunSummaryInput(result);
      onTerminalFsPathsChanged(activeSessionId, bash.fs.getAllPaths());
      updateMessage(assistantId, {
        status: result.status === 'succeeded' ? 'complete' : 'error',
        isError: result.status !== 'succeeded',
        loadingStatus: null,
        streamedContent: [
          `Sandbox run ${summary.metadata.status} (exit ${summary.metadata.exitCode}).`,
          summary.stdout.length ? `stdout:\n${summary.stdout.join('')}` : null,
          summary.stderr.length ? `stderr:\n${summary.stderr.join('')}` : null,
          summary.persistedArtifactPaths.length ? `saved files:\n${summary.persistedArtifactPaths.join('\n')}` : null,
        ].filter(Boolean).join('\n\n'),
        cards: [{
          app: 'Browser Sandbox',
          args: {
            command: parsed.commandLine,
            adapter: summary.metadata.adapter,
            status: summary.metadata.status,
            exitCode: summary.metadata.exitCode,
            artifacts: summary.counts.artifactCount,
            persistedArtifactPaths: summary.persistedArtifactPaths,
          },
        }],
      });
      if (result.status === 'succeeded') {
        notifyAssistantComplete(assistantId, `Sandbox run ${summary.metadata.status}.`);
      }
      await session.dispose();
    } catch (error) {
      updateMessage(assistantId, {
        status: 'error',
        isError: true,
        loadingStatus: null,
        content: error instanceof Error ? error.message : 'Sandbox execution failed.',
      });
    }
    return true;
  }, [activeSessionId, getSessionBash, notifyAssistantComplete, onTerminalFsPathsChanged, sandboxFlags, updateMessage]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || activeGenerationRef.current) return;
    const assistantId = createUniqueId();
    const userId = createUniqueId();
    const trimmedText = text.trim();
    let providerForRequest = resolveAgentProviderForTask({
      selectedProvider,
      latestUserInput: trimmedText,
    });
    const requestBenchmarkTaskClass = inferBenchmarkTaskClass({
      provider: providerForRequest,
      latestUserInput: trimmedText,
      toolsEnabled,
    });
    const requestBenchmarkRoute = recommendBenchmarkRoute({
      taskClass: requestBenchmarkTaskClass,
      candidates: selectCompatibleBenchmarkCandidates(providerForRequest, benchmarkRoutingCandidates),
      settings: benchmarkRoutingSettings,
    });
    let requestCodiModelId = effectiveSelectedModelId;
    let requestGhcpModelId = effectiveSelectedCopilotModelId;
    let requestLocalModel = activeLocalModel;
    let runtimeProviderForRequest = resolveRuntimeAgentProvider({
      provider: providerForRequest,
      hasCodiModelsReady: Boolean(activeLocalModel),
      hasGhcpModelsReady: Boolean(effectiveSelectedCopilotModelId) && hasAvailableCopilotModels,
      hasCursorModelsReady: Boolean(effectiveSelectedCursorModelId) && hasAvailableCursorModels,
      hasCodexModelsReady: Boolean(effectiveSelectedCodexModelId) && hasAvailableCodexModels,
    });
    if (requestBenchmarkRoute) {
      const routed = requestBenchmarkRoute.candidate;
      if (providerForRequest === 'planner' || providerForRequest === 'researcher' || providerForRequest === 'debugger' || providerForRequest === 'security') {
        if (routed.provider === 'ghcp') {
          requestGhcpModelId = routed.modelId;
          runtimeProviderForRequest = 'ghcp';
        } else {
          const routedLocalModel = installedModels.find((model) => model.id === routed.modelId);
          if (routedLocalModel) {
            requestCodiModelId = routed.modelId;
            requestLocalModel = routedLocalModel;
            runtimeProviderForRequest = 'codi';
          }
        }
      } else if (providerForRequest === 'ghcp' && routed.provider === 'ghcp') {
        requestGhcpModelId = routed.modelId;
      } else if (providerForRequest === 'codi' && routed.provider === 'codi') {
        const routedLocalModel = installedModels.find((model) => model.id === routed.modelId);
        if (routedLocalModel) {
          requestCodiModelId = routed.modelId;
          requestLocalModel = routedLocalModel;
        }
      }
    }
    if (providerForRequest !== selectedProvider) {
      selectedProviderRef.current = providerForRequest;
      setSelectedProviderBySession((current) => ({ ...current, [activeChatSessionId]: providerForRequest }));
    }
    setChatHistoryBySession((current) => ({
      ...current,
      [activeChatSessionId]: [...(current[activeChatSessionId] ?? []), trimmedText],
    }));
    const nextMessages = appendPendingLocalTurn(messagesRef.current, text, { userId, assistantId });
    messagesRef.current = nextMessages;
    setMessagesBySession((current) => ({ ...current, [activeChatSessionId]: nextMessages }));
    if (sharedChatApiRef.current?.confirmed) {
      void sharedChatApiRef.current.sendText(trimmedText).catch(() => {
        onToast({ msg: 'Failed to send shared chat event', type: 'error' });
      });
    }
    setInput('');
    resetActiveInputHistoryCursor();

    if (await runSandboxPrompt(text, assistantId)) {
      return;
    }

    if (providerForRequest !== 'tour-guide' && runtimeProviderForRequest === 'ghcp' && (!requestGhcpModelId || !hasAvailableCopilotModels)) {
      updateMessage(assistantId, {
        status: 'error',
        content: copilotState.authenticated
          ? 'GHCP has no enabled models for this environment. Open Models to refresh or switch to Codi.'
          : 'Sign in to GHCP from Models before sending a prompt.',
      });
      return;
    }

    if (providerForRequest !== 'tour-guide' && runtimeProviderForRequest === 'cursor' && (!effectiveSelectedCursorModelId || !hasAvailableCursorModels)) {
      updateMessage(assistantId, {
        status: 'error',
        content: cursorState.authenticated
          ? 'Cursor has no enabled models for this environment. Open Models to refresh or switch to Codi.'
          : 'Set CURSOR_API_KEY from Models before sending a prompt with Cursor.',
      });
      return;
    }

    if (providerForRequest !== 'tour-guide' && runtimeProviderForRequest === 'codex' && (!effectiveSelectedCodexModelId || !hasAvailableCodexModels)) {
      updateMessage(assistantId, {
        status: 'error',
        content: codexState.authenticated
          ? 'Codex has no enabled models for this environment. Open Models to refresh or switch providers.'
          : 'Sign in to Codex from Models before sending a prompt.',
      });
      return;
    }

    if (providerForRequest !== 'tour-guide' && runtimeProviderForRequest === 'codi' && !requestLocalModel) {
      updateMessage(assistantId, { status: 'error', content: providerForRequest === 'researcher' ? 'Researcher needs a GHCP, Cursor, or browser-compatible Codi model before sending a prompt.' : providerForRequest === 'debugger' ? 'Debugger needs a GHCP, Cursor, or browser-compatible Codi model before sending a prompt.' : providerForRequest === 'planner' ? 'Planner needs a GHCP, Cursor, or browser-compatible Codi model before sending a prompt.' : providerForRequest === 'security' ? 'Security Review needs a GHCP, Cursor, or browser-compatible Codi model before sending a prompt.' : 'Install a browser-compatible ONNX model for Codi from Models before sending a prompt.' });
      return;
    }

    const requestPartnerAgentControlPlane = buildPartnerAgentControlPlane({
      settings: partnerAgentControlPlaneSettings,
      installedModels,
      copilotState,
      cursorState,
      codexState,
      selectedProvider: providerForRequest,
      runtimeProvider: runtimeProviderForRequest,
      selectedModelRef: buildPartnerAgentModelRef(runtimeProviderForRequest, {
        codiModelId: requestCodiModelId,
        ghcpModelId: requestGhcpModelId,
        cursorModelId: effectiveSelectedCursorModelId,
        codexModelId: effectiveSelectedCodexModelId,
      }),
      selectedToolIds,
    });
    const requestPartnerAgentAuditEntry = createPartnerAgentAuditEntry({
      controlPlane: requestPartnerAgentControlPlane,
      sessionId: activeChatSessionId,
    });
    if (requestPartnerAgentControlPlane.settings.enabled) {
      onPartnerAgentAuditEntry?.(requestPartnerAgentAuditEntry);
    }
    const requestWorkspacePromptContext = [
      workspacePromptContext,
      buildPartnerAgentPromptContext(requestPartnerAgentControlPlane, requestPartnerAgentAuditEntry),
      buildSecurityReviewPromptContext(buildSecurityReviewRunPlan({
        settings: securityReviewAgentSettings,
        selectedToolIds,
      })),
    ].filter((section): section is string => Boolean(section)).join('\n\n');

    if (toolsEnabled && providerForRequest !== 'tour-guide' && providerForRequest !== 'codex') {
      if (!activeSessionId) {
        updateMessage(assistantId, { status: 'error', content: 'Open or create a session before enabling tools.' });
        return;
      }

      const controller = new AbortController();
      type PlanningStageName = 'chat-agent' | 'planner' | 'router-agent' | 'router' | 'coordinator' | 'breakdown-agent' | 'assignment-agent' | 'validation-agent' | 'orchestrator' | 'tool-agent' | 'group-select' | 'tool-select' | 'logact' | 'voter-ensemble' | 'agent-bus' | 'executor' | 'chat';
      type PlanningStageLayout = {
        parentStage?: PlanningStageName;
        lane?: 'sequential' | 'parallel';
      };
      type PlanningStageTimeouts = {
        hardMs: number;
        thinkingIdleMs: number;
        streamingIdleMs: number;
      };
      let reasoningSteps: ReasoningStep[] = runtimeProviderForRequest === 'codi'
        ? [createInitialLocalReasoningStep(
          providerForRequest === 'researcher' ? 'Planning research run' : providerForRequest === 'debugger' ? 'Planning debugging run' : providerForRequest === 'planner' ? 'Planning local task run' : providerForRequest === 'security' ? 'Planning security review' : 'Planning tool run',
          providerForRequest === 'researcher' ? 'Researcher is deciding how to use local tools and gather evidence.' : providerForRequest === 'debugger' ? 'Debugger is deciding how to inspect symptoms, hypotheses, and evidence.' : providerForRequest === 'planner' ? 'Planner is deciding how to update local tasks, monitor agents, and coordinate handoffs.' : providerForRequest === 'security' ? 'Security Review is deciding how to inspect code, dependencies, tools, and remediation evidence.' : 'Codi is deciding how to use local tools and delegate work.',
        )]
        : [];
      let delegationVoterSteps: VoterStep[] = [];
      let delegationBusEntries: BusEntryStep[] = [];
      const processLog = new ProcessLog();
      const processBranchByStage = new Map<PlanningStageName, string>();
      const processIdByStage = new Map<PlanningStageName, string>();
      const processHandoffParentByStage = new Map<PlanningStageName, string>();
      const processIdByActorId = new Map<string, string>();
      const processIdByVoterStepId = new Map<string, string>();
      const processIdByToolCallId = new Map<string, string>();
      const processAgentOwnerByStage: Partial<Record<PlanningStageName, string>> = {
        planner: 'planner',
        'router-agent': 'router-agent',
        router: 'router-agent',
        orchestrator: 'orchestrator',
        'tool-agent': 'tool-agent',
        'group-select': 'tool-agent',
        'tool-select': 'tool-agent',
        logact: 'logact',
        executor: 'executor',
      };
      const resolveProcessBranch = (stage: PlanningStageName): string => {
        const cached = processBranchByStage.get(stage);
        if (cached) return cached;
        if (stage === 'chat-agent' || stage === 'chat') {
          processBranchByStage.set(stage, 'main');
          return 'main';
        }
        const agentOwner = processAgentOwnerByStage[stage];
        const branch = (
          agentOwner
            ? `agent:${agentOwner}`
            : stage === 'breakdown-agent' || stage === 'assignment-agent' || stage === 'validation-agent'
              ? stage
              : stage === 'voter-ensemble'
                ? 'voters'
                : 'coordinator'
        );
        processBranchByStage.set(stage, branch);
        return branch;
      };
      const snapshotProcess = (): ProcessEntry[] => processLog.snapshot();
      let localToolRunTimedOut = false;
      let activePlanningStage: PlanningStageName | null = null;
      const lastProcessIdByBranch = new Map<string, string>();
      let mirrorVoterStageToProcess = false;
      const toolStepIdsByCallId = new Map<string, string>();
      const planningStepIdsByStage = new Map<PlanningStageName, string>();
      const planningTokensByStage = new Map<PlanningStageName, string>();
      const currentToolAgentLogMeta = (): Pick<ProcessEntry, 'agentId' | 'agentLabel' | 'modelId' | 'modelProvider'> => ({
        agentId: providerForRequest === 'researcher' ? 'researcher' : providerForRequest === 'debugger' ? 'debugger' : providerForRequest === 'planner' ? 'planner' : providerForRequest === 'security' ? 'security' : 'tool-agent',
        agentLabel: providerForRequest === 'researcher' ? 'Researcher' : providerForRequest === 'debugger' ? 'Debugger' : providerForRequest === 'planner' ? 'Planner' : providerForRequest === 'security' ? 'Security Review' : 'Tool Agent',
        modelId: runtimeProviderForRequest === 'ghcp'
          ? requestGhcpModelId
          : runtimeProviderForRequest === 'cursor'
            ? effectiveSelectedCursorModelId
            : requestCodiModelId,
        modelProvider: providerForRequest,
      });
      const processMetaFromStageMeta = (meta?: StageMeta): Pick<ProcessEntry, 'agentId' | 'agentLabel' | 'modelId' | 'modelProvider'> => ({
        agentId: meta?.agentId ?? currentToolAgentLogMeta().agentId,
        agentLabel: meta?.agentLabel ?? currentToolAgentLogMeta().agentLabel,
        modelId: meta?.modelId ?? currentToolAgentLogMeta().modelId,
        modelProvider: meta?.modelProvider ?? currentToolAgentLogMeta().modelProvider,
      });
      const processMetaFromBusEntry = (entry: BusEntryStep): Pick<ProcessEntry, 'agentId' | 'agentLabel' | 'modelId' | 'modelProvider'> => {
        const baseModel = currentToolAgentLogMeta();
        if (entry.actorId) {
          return {
            agentId: entry.actorId,
            agentLabel: entry.agentLabel ?? entry.actorId,
            modelId: entry.modelId ?? baseModel.modelId,
            modelProvider: entry.modelProvider ?? 'logact',
          };
        }
        switch (entry.payloadType) {
          case 'Vote':
            return {
              agentId: `voter:${entry.actor ?? 'unknown'}`,
              agentLabel: `Voter Agent · ${entry.actor ?? 'unknown'}`,
              modelId: baseModel.modelId,
              modelProvider: 'logact',
            };
          case 'Commit':
          case 'Abort':
            return {
              agentId: 'decider-agent',
              agentLabel: 'Decider Agent',
              modelId: baseModel.modelId,
              modelProvider: 'logact',
            };
          case 'Result':
            return {
              agentId: 'executor',
              agentLabel: 'Executor Agent',
              modelId: baseModel.modelId,
              modelProvider: 'logact',
            };
          case 'Completion':
            return {
              agentId: 'completion-checker',
              agentLabel: 'Completion Checker Agent',
              modelId: baseModel.modelId,
              modelProvider: 'logact',
            };
          case 'InfIn':
          case 'InfOut':
          case 'Intent':
            return {
              agentId: 'driver-agent',
              agentLabel: 'LogAct Driver Agent',
              modelId: baseModel.modelId,
              modelProvider: 'logact',
            };
          default:
            return baseModel;
        }
      };
      const previewPlanningBody = (content: string) => (
        content.length > 1_500 ? `…${content.slice(-1_500)}` : content
      );
      const formatPlanningLine = (content: string, maxLength = 120) => {
        const compact = content.replace(/\s+/g, ' ').trim();
        if (!compact) return 'no detail captured';
        return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
      };
      const planningStageMeta: Record<PlanningStageName, { title: string; body: string }> = {
        router: {
          title: 'Routing request',
          body: 'Choosing between direct chat and targeted tool use.',
        },
        'router-agent': {
          title: 'Router agent',
          body: 'Classifying the request and routing it through the registered agent workflow.',
        },
        'group-select': {
          title: 'Selecting tool groups',
          body: 'Reducing the available tools to the smallest relevant groups.',
        },
        'tool-select': {
          title: 'Selecting tools',
          body: 'Picking the smallest specific tool subset for execution.',
        },
        executor: {
          title: 'Executing tools',
          body: 'Running selected tools and composing the final response.',
        },
        chat: {
          title: 'Answering directly',
          body: 'Handling the request without tool execution.',
        },
        'chat-agent': {
          title: 'Chat agent',
          body: 'Receiving the user prompt and delegating planning.',
        },
        planner: {
          title: 'Planner',
          body: 'Classifying the prompt, decomposing the task, and preparing delegation.',
        },
        coordinator: {
          title: 'Coordinator brief',
          body: 'Framing a compact delegation problem for focused subagents.',
        },
        'breakdown-agent': {
          title: 'Breakdown subagent',
          body: 'Breaking the work into compact parallel tracks.',
        },
        'assignment-agent': {
          title: 'Assignment subagent',
          body: 'Assigning focused work to specialist subagents.',
        },
        'validation-agent': {
          title: 'Validation subagent',
          body: 'Checking risks, coordination, and success criteria.',
        },
        orchestrator: {
          title: 'Orchestrator',
          body: 'Choosing registered agents for the prepared tasks.',
        },
        'tool-agent': {
          title: 'Tool agent',
          body: 'Assigning active workspace tools to selected agents.',
        },
        logact: {
          title: 'LogAct pipeline',
          body: 'Submitting the prepared plan to AgentBus for voter review, commit, and execution.',
        },
        'voter-ensemble': {
          title: 'Reviewer votes',
          body: 'Reviewing the delegated plan with focused classic voters.',
        },
        'agent-bus': {
          title: 'AgentBus log',
          body: 'Capturing the append-only process log for this delegation run.',
        },
      };
      const planningStageLayout: Record<PlanningStageName, PlanningStageLayout> = {
        'chat-agent': {},
        planner: { parentStage: 'chat-agent' },
        'router-agent': { parentStage: 'planner' },
        router: { parentStage: 'router-agent' },
        coordinator: { parentStage: 'planner' },
        'breakdown-agent': { parentStage: 'coordinator', lane: 'parallel' },
        'assignment-agent': { parentStage: 'coordinator', lane: 'parallel' },
        'validation-agent': { parentStage: 'coordinator', lane: 'parallel' },
        orchestrator: { parentStage: 'router-agent' },
        'tool-agent': { parentStage: 'orchestrator' },
        'group-select': { parentStage: 'tool-agent' },
        'tool-select': { parentStage: 'group-select' },
        logact: { parentStage: 'chat-agent' },
        'voter-ensemble': { parentStage: 'logact' },
        'agent-bus': { parentStage: 'logact' },
        executor: { parentStage: 'logact' },
        chat: { parentStage: 'router' },
      };
      const planningMirrorStages = new Set<PlanningStageName>(['voter-ensemble']);
      const planningStageTimeouts: Record<PlanningStageName, PlanningStageTimeouts> = {
        router: {
          hardMs: LOCAL_TOOL_HARD_TIMEOUT_MS,
          thinkingIdleMs: LOCAL_TOOL_THINKING_IDLE_TIMEOUT_MS,
          streamingIdleMs: LOCAL_TOOL_STREAMING_IDLE_TIMEOUT_MS,
        },
        'router-agent': { hardMs: 120_000, thinkingIdleMs: 90_000, streamingIdleMs: 60_000 },
        'group-select': { hardMs: 180_000, thinkingIdleMs: 135_000, streamingIdleMs: 120_000 },
        'tool-select': { hardMs: 210_000, thinkingIdleMs: 150_000, streamingIdleMs: 135_000 },
        executor: { hardMs: 240_000, thinkingIdleMs: 180_000, streamingIdleMs: 150_000 },
        chat: { hardMs: 240_000, thinkingIdleMs: 180_000, streamingIdleMs: 150_000 },
        'chat-agent': { hardMs: 120_000, thinkingIdleMs: 90_000, streamingIdleMs: 60_000 },
        planner: { hardMs: 240_000, thinkingIdleMs: 180_000, streamingIdleMs: 150_000 },
        coordinator: { hardMs: 240_000, thinkingIdleMs: 180_000, streamingIdleMs: 150_000 },
        'breakdown-agent': { hardMs: 240_000, thinkingIdleMs: 180_000, streamingIdleMs: 150_000 },
        'assignment-agent': { hardMs: 210_000, thinkingIdleMs: 150_000, streamingIdleMs: 120_000 },
        'validation-agent': { hardMs: 210_000, thinkingIdleMs: 150_000, streamingIdleMs: 120_000 },
        orchestrator: { hardMs: 180_000, thinkingIdleMs: 135_000, streamingIdleMs: 120_000 },
        'tool-agent': { hardMs: 180_000, thinkingIdleMs: 135_000, streamingIdleMs: 120_000 },
        logact: { hardMs: 180_000, thinkingIdleMs: 135_000, streamingIdleMs: 120_000 },
        'voter-ensemble': { hardMs: 120_000, thinkingIdleMs: 90_000, streamingIdleMs: 60_000 },
        'agent-bus': { hardMs: 120_000, thinkingIdleMs: 90_000, streamingIdleMs: 60_000 },
      };
      const resolvePlanningParentStepId = (stage: PlanningStageName): string | undefined => {
        let parentStage = planningStageLayout[stage].parentStage;
        while (parentStage) {
          const stepId = planningStepIdsByStage.get(parentStage);
          if (stepId) return stepId;
          parentStage = planningStageLayout[parentStage].parentStage;
        }
        return undefined;
      };
      const resolveProcessParentId = (stage: PlanningStageName): string | undefined => {
        const handoffParentProcessId = processHandoffParentByStage.get(stage);
        if (handoffParentProcessId) return handoffParentProcessId;
        let parentStage = planningStageLayout[stage].parentStage;
        while (parentStage) {
          const processId = processIdByStage.get(parentStage);
          if (processId) return processId;
          parentStage = planningStageLayout[parentStage].parentStage;
        }
        return undefined;
      };
      const resolveWatchdogPlanningStage = (stage: PlanningStageName | null): PlanningStageName | null => {
        let owner = stage;
        while (owner && planningMirrorStages.has(owner)) {
          owner = planningStageLayout[owner].parentStage ?? null;
        }
        return owner;
      };
      const emitReasoningUpdate = (isThinking: boolean) => {
        updateMessage(assistantId, {
          status: 'streaming',
          loadingStatus: null,
          reasoningSteps,
          currentStepId: getActiveReasoningStepId(reasoningSteps),
          reasoningStartedAt: reasoningSteps[0]?.startedAt,
          isThinking,
          voterSteps: delegationVoterSteps.length ? delegationVoterSteps : undefined,
          isVoting: delegationVoterSteps.some((step) => step.status === 'active'),
          busEntries: delegationBusEntries.length ? delegationBusEntries : undefined,
          processEntries: snapshotProcess(),
        });
      };
      const buildDelegationVoterStageBody = (steps: VoterStep[]) => {
        if (!steps.length) return planningStageMeta['voter-ensemble'].body;
        return [
          `${steps.length} reviewer${steps.length === 1 ? '' : 's'} evaluated the delegation plan.`,
          ...steps.map((step) => {
            const verdict = step.status === 'active'
              ? 'Reviewing'
              : step.approve === true
                ? 'Approved'
                : step.approve === false
                  ? 'Rejected'
                  : 'Pending';
            const rationale = step.thought ?? step.body ?? 'Waiting for reviewer output.';
            return `- ${step.voterId}: ${verdict} — ${formatPlanningLine(rationale)}`;
          }),
        ].join('\n');
      };
      const buildDelegationBusStageBody = (entries: BusEntryStep[]) => {
        if (!entries.length) return planningStageMeta['agent-bus'].body;
        return [
          `${entries.length} AgentBus entr${entries.length === 1 ? 'y' : 'ies'} recorded during this run.`,
          ...entries.map((entry, index) => `${index + 1}. ${entry.summary} — ${formatPlanningLine(entry.detail)}`),
        ].join('\n');
      };
      const resolveBusBranch = (entry: BusEntryStep): string => (
        entry.branchId
          ?? (entry.payloadType === 'Mail' ? `mail:${entry.actor ?? 'unknown'}` : 'bus')
      );
      const appendBusProcessEntry = (entry: BusEntryStep, fallbackParentId?: string) => {
        const kindMap: Record<string, ProcessEntryKind> = {
          Mail: 'mail',
          InfIn: 'inf-in',
          InfOut: 'inf-out',
          Intent: 'intent',
          Vote: 'vote',
          Commit: 'commit',
          Abort: 'abort',
          Result: 'result',
          Completion: 'completion',
          Policy: 'policy',
        };
        const branchId = resolveBusBranch(entry);
        const startsLogActOperationBranch = branchId === 'agent:logact'
          && !lastProcessIdByBranch.has(branchId);
        const metadataParentProcessId = startsLogActOperationBranch
          ? processIdByActorId.get('logact')
          : entry.parentActorId
          ? processIdByActorId.get(entry.parentActorId)
          : undefined;
        const parentProcessId = metadataParentProcessId ?? lastProcessIdByBranch.get(branchId) ?? fallbackParentId;
        const busMeta = processMetaFromBusEntry(entry);
        const appended = processLog.append({
          id: entry.id,
          kind: kindMap[entry.payloadType] ?? 'reasoning',
          actor: entry.actorId ?? (entry.payloadType === 'Vote' && entry.actor ? `voter:${entry.actor}` : entry.actor ? entry.actor : 'bus'),
          ...(entry.actorId ? { actorId: entry.actorId } : {}),
          ...(entry.actorRole ? { actorRole: entry.actorRole } : {}),
          ...(entry.parentActorId ? { parentActorId: entry.parentActorId } : {}),
          summary: entry.summary,
          transcript: entry.detail,
          payload: entry,
          branchId,
          ...busMeta,
          ...(parentProcessId ? { parentId: parentProcessId } : {}),
          status: 'done',
          ts: entry.realtimeTs,
        });
        if (entry.actorId) {
          processIdByActorId.set(entry.actorId, appended.id);
        }
        lastProcessIdByBranch.set(branchId, appended.id);
      };
      const isPlanningStageName = (value: string): value is PlanningStageName => (
        Object.prototype.hasOwnProperty.call(planningStageMeta, value)
      );
      const closePlanningStagesBeforeLogAct = () => {
        const planningStages: PlanningStageName[] = [
          'planner',
          'router-agent',
          'router',
          'orchestrator',
          'tool-agent',
          'group-select',
          'tool-select',
        ];
        planningStages.forEach((stage) => {
          const stepId = planningStepIdsByStage.get(stage);
          if (stepId) {
            const body = planningTokensByStage.get(stage)?.trim() || planningStageMeta[stage].body;
            reasoningSteps = patchReasoningStep(reasoningSteps, stepId, {
              body: previewPlanningBody(body),
              transcript: body,
              parentStepId: resolvePlanningParentStepId(stage),
              lane: planningStageLayout[stage].lane,
              status: 'done',
              endedAt: Date.now(),
            });
          }
          const processId = processIdByStage.get(stage);
          if (processId) {
            processLog.update(processId, { status: 'done' });
          }
        });
        if (activePlanningStage && planningStages.includes(activePlanningStage)) {
          activePlanningStage = null;
        }
      };
      const resolveMainThreadProcessParentId = (): string | undefined => (
        processIdByStage.get('chat-agent')
        ?? snapshotProcess().find((entry) => entry.branchId === 'main')?.id
      );
      const appendAgentHandoff = (fromAgentId: string, toAgentId: string, summary: string) => {
        void summary;
        if (isPlanningStageName(fromAgentId)) {
          const sourceProcessId = processIdByStage.get(fromAgentId);
          if (sourceProcessId) {
            processLog.update(sourceProcessId, { status: 'done' });
          }
        }
        const parentProcessId = isPlanningStageName(fromAgentId)
          ? processIdByStage.get(fromAgentId)
          : undefined;
        const targetStage = isPlanningStageName(toAgentId) ? toAgentId : undefined;
        if (targetStage === 'logact') {
          closePlanningStagesBeforeLogAct();
          const mainParentProcessId = resolveMainThreadProcessParentId();
          if (mainParentProcessId) {
            processHandoffParentByStage.set(targetStage, mainParentProcessId);
            processIdByActorId.set('logact', mainParentProcessId);
          }
          return;
        }
        if (targetStage && parentProcessId) {
          processHandoffParentByStage.set(targetStage, parentProcessId);
        }
      };
      const resolvePlanningStageTimeoutMs = (stage: PlanningStageName, reason: LocalToolTimeoutReason): number => {
        const timeout = planningStageTimeouts[stage];
        switch (reason) {
          case 'no-output':
            return timeout.hardMs;
          case 'thinking-idle':
            return timeout.thinkingIdleMs;
          default:
            return timeout.streamingIdleMs;
        }
      };
      const resolvePlanningStageDisplayTimeoutMs = (
        stage: PlanningStageName,
        reason: LocalToolTimeoutReason,
      ): number | undefined => (
        planningMirrorStages.has(stage)
          ? undefined
          : resolvePlanningStageTimeoutMs(stage, reason)
      );
      const setPlanningStageTimeout = (stage: PlanningStageName, reason: LocalToolTimeoutReason) => {
        const stepId = planningStepIdsByStage.get(stage);
        if (!stepId) return;
        reasoningSteps = patchReasoningStep(reasoningSteps, stepId, {
          timeoutMs: resolvePlanningStageDisplayTimeoutMs(stage, reason),
        });
      };
      const buildPlanningStageTimeoutBody = (stage: PlanningStageName, reason: LocalToolTimeoutReason) => {
        const existing = planningTokensByStage.get(stage)?.trim() || planningStageMeta[stage].body;
        const timeoutLabel = formatOperationDuration(Math.round(resolvePlanningStageTimeoutMs(stage, reason) / 1000));
        const reasonLabel = reason === 'no-output'
          ? 'waiting for any output.'
          : reason === 'thinking-idle'
            ? 'waiting for visible output while the model was still thinking.'
            : 'waiting for more streamed output.';
        return `${existing}\n\nTimed out after ${timeoutLabel} ${reasonLabel}`;
      };
      const finalizeToolReasoningSteps = (): ReasoningStep[] => reasoningSteps.map((step) => (
        step.status === 'done'
          ? step
          : { ...step, status: 'done' as const, endedAt: Date.now() }
      ));
      const findToolStepId = (toolName: string, toolCallId?: string): string | undefined => {
        if (toolCallId && toolStepIdsByCallId.has(toolCallId)) {
          return toolStepIdsByCallId.get(toolCallId);
        }

        for (let index = reasoningSteps.length - 1; index >= 0; index -= 1) {
          const step = reasoningSteps[index];
          if (step?.kind === 'tool' && step.toolName === toolName && step.status === 'active') {
            return step.id;
          }
        }

        return undefined;
      };
      const recordToolStep = (toolName: string, args: unknown, toolCallId?: string) => {
        const stepId = createUniqueId();
        reasoningSteps = [...reasoningSteps, {
          id: stepId,
          kind: 'tool',
          title: toolName,
          body: formatToolArgs(args),
          toolName,
          toolCallId,
          toolSummary: summarizeToolCall(toolName, args),
          toolArgs: args,
          startedAt: Date.now(),
          status: 'active',
        }];
        if (toolCallId) {
          toolStepIdsByCallId.set(toolCallId, stepId);
        }
        const processId = `tool:${stepId}`;
        if (toolCallId) {
          processIdByToolCallId.set(toolCallId, processId);
        }
        // Attach this tool-call row to the currently-active executor stage
        // so the gitgraph layer can render a fork connector from the
        // executor lane to the tools lane.
        const parentProcessId = (activePlanningStage && processIdByStage.get(activePlanningStage))
          ?? processIdByStage.get('executor');
        processLog.append({
          id: processId,
          kind: 'tool-call',
          actor: toolName,
          summary: summarizeToolCall(toolName, args),
          transcript: formatToolArgs(args),
          payload: { toolName, toolCallId, args },
          branchId: 'tools',
          ...currentToolAgentLogMeta(),
          ...(parentProcessId ? { parentId: parentProcessId } : {}),
          status: 'active',
        });
        updateMessage(assistantId, {
          status: 'streaming',
          loadingStatus: null,
          reasoningSteps,
          currentStepId: getActiveReasoningStepId(reasoningSteps),
          reasoningStartedAt: reasoningSteps[0]?.startedAt,
          isThinking: false,
          processEntries: snapshotProcess(),
        });
      };
      const beginPlanningStage = (stage: PlanningStageName, timeoutReason: LocalToolTimeoutReason = 'no-output', stageMeta?: StageMeta) => {
        const metadata = planningStageMeta[stage];
        const layout = planningStageLayout[stage];
        let stepId = planningStepIdsByStage.get(stage);

        if (!stepId && planningStepIdsByStage.size === 0) {
          const initialStep = reasoningSteps.find((step) => step.kind === 'thinking');
          if (initialStep) {
            stepId = initialStep.id;
            planningStepIdsByStage.set(stage, stepId);
          }
        }

        if (layout.lane !== 'parallel') {
          reasoningSteps = reasoningSteps.map((step) => (
            step.kind === 'thinking' && step.status === 'active' && step.id !== stepId
              ? { ...step, status: 'done' as const, endedAt: Date.now() }
              : step
          ));
        }

        const transcript = planningTokensByStage.get(stage) ?? metadata.body;
        const parentStepId = resolvePlanningParentStepId(stage);
        const parentProcessId = resolveProcessParentId(stage);

        if (stepId) {
          reasoningSteps = patchReasoningStep(reasoningSteps, stepId, {
            title: metadata.title,
            body: previewPlanningBody(transcript),
            transcript,
            timeoutMs: resolvePlanningStageDisplayTimeoutMs(stage, timeoutReason),
            status: 'active',
            parentStepId,
            lane: layout.lane,
          });
        } else {
          stepId = createUniqueId();
          planningStepIdsByStage.set(stage, stepId);
          reasoningSteps = [...reasoningSteps, {
            id: stepId,
            kind: 'thinking',
            title: metadata.title,
            body: previewPlanningBody(transcript),
            transcript,
            startedAt: Date.now(),
            timeoutMs: resolvePlanningStageDisplayTimeoutMs(stage, timeoutReason),
            status: 'active',
            parentStepId,
            lane: layout.lane,
          }];
        }

        // Mirror to ProcessLog. AgentBus summaries and the LogAct
        // infrastructure stage stay in the reasoning pane only; individual
        // AgentBus operation entries render as actor rows below.
        if (stage !== 'agent-bus' && stage !== 'logact') {
          const processId = processIdByStage.get(stage);
          const branch = resolveProcessBranch(stage);
          if (processId) {
            processLog.update(processId, {
              summary: metadata.title,
              transcript,
              status: 'active',
              timeoutMs: resolvePlanningStageDisplayTimeoutMs(stage, timeoutReason),
              ...processMetaFromStageMeta(stageMeta),
            });
            processIdByActorId.set(stageMeta?.agentId ?? processAgentOwnerByStage[stage] ?? stage, processId);
          } else {
            const newId = `stage:${stage}:${createUniqueId()}`;
            processIdByStage.set(stage, newId);
            processLog.append({
              id: newId,
              kind: stage === 'voter-ensemble' ? 'reasoning' : 'stage-start',
              actor: stage,
              summary: metadata.title,
              transcript,
              branchId: branch,
              ...processMetaFromStageMeta(stageMeta),
              ...(parentProcessId ? { parentId: parentProcessId } : {}),
              status: 'active',
              timeoutMs: resolvePlanningStageDisplayTimeoutMs(stage, timeoutReason),
            });
            processIdByActorId.set(stageMeta?.agentId ?? processAgentOwnerByStage[stage] ?? stage, newId);
          }
        }

        emitReasoningUpdate(true);
      };
      const appendPlanningStageToken = (stage: PlanningStageName, token: string) => {
        if (!token) return;
        const stepId = planningStepIdsByStage.get(stage);
        if (!stepId) return;
        const current = `${planningTokensByStage.get(stage) ?? ''}${token}`;
        planningTokensByStage.set(stage, current);
        reasoningSteps = patchReasoningStep(reasoningSteps, stepId, {
          body: previewPlanningBody(current),
          transcript: current,
          parentStepId: resolvePlanningParentStepId(stage),
          lane: planningStageLayout[stage].lane,
          timeoutMs: resolvePlanningStageDisplayTimeoutMs(stage, 'streaming-idle'),
          status: 'active',
        });
        const processId = processIdByStage.get(stage);
        if (processId) {
          processLog.update(processId, {
            transcript: current,
            status: 'active',
            timeoutMs: resolvePlanningStageDisplayTimeoutMs(stage, 'streaming-idle'),
          });
        }
        emitReasoningUpdate(true);
      };
      const completePlanningStage = (stage: PlanningStageName, finalText?: string) => {
        const stepId = planningStepIdsByStage.get(stage);
        if (!stepId) return;
        const accumulated = planningTokensByStage.get(stage);
        const body = accumulated?.trim() || finalText?.trim() || planningStageMeta[stage].body;
        reasoningSteps = patchReasoningStep(reasoningSteps, stepId, {
          body: previewPlanningBody(body),
          transcript: body,
          parentStepId: resolvePlanningParentStepId(stage),
          lane: planningStageLayout[stage].lane,
          status: 'done',
          endedAt: Date.now(),
        });
        const processId = processIdByStage.get(stage);
        if (processId) {
          processLog.update(processId, { transcript: body, status: 'done' });
        }
        emitReasoningUpdate(false);
      };
      const syncPlanningStage = (stage: PlanningStageName, transcript: string, status: 'active' | 'done') => {
        if (!planningStepIdsByStage.has(stage)) {
          beginPlanningStage(stage, status === 'active' ? 'streaming-idle' : 'no-output');
        }
        const stepId = planningStepIdsByStage.get(stage);
        if (!stepId) return;
        planningTokensByStage.set(stage, transcript);
        reasoningSteps = patchReasoningStep(reasoningSteps, stepId, {
          body: previewPlanningBody(transcript),
          transcript,
          parentStepId: resolvePlanningParentStepId(stage),
          lane: planningStageLayout[stage].lane,
          timeoutMs: resolvePlanningStageDisplayTimeoutMs(stage, status === 'active' ? 'streaming-idle' : 'no-output'),
          status,
          ...(status === 'done' ? { endedAt: Date.now() } : {}),
        });
        const processId = processIdByStage.get(stage);
        if (processId) {
          processLog.update(processId, {
            transcript,
            status,
            timeoutMs: resolvePlanningStageDisplayTimeoutMs(stage, status === 'active' ? 'streaming-idle' : 'no-output'),
          });
        }
        emitReasoningUpdate(status === 'active');
      };
      const syncAgentBusSummary = (entries: BusEntryStep[]) => {
        const stage: PlanningStageName = 'agent-bus';
        const metadata = planningStageMeta[stage];
        const transcript = buildDelegationBusStageBody(entries);
        let stepId = planningStepIdsByStage.get(stage);
        planningTokensByStage.set(stage, transcript);
        if (stepId) {
          reasoningSteps = patchReasoningStep(reasoningSteps, stepId, {
            body: previewPlanningBody(transcript),
            transcript,
            parentStepId: resolvePlanningParentStepId(stage),
            lane: planningStageLayout[stage].lane,
            status: 'done',
            endedAt: Date.now(),
          });
        } else {
          stepId = createUniqueId();
          planningStepIdsByStage.set(stage, stepId);
          reasoningSteps = [...reasoningSteps, {
            id: stepId,
            kind: 'thinking',
            title: metadata.title,
            body: previewPlanningBody(transcript),
            transcript,
            startedAt: Date.now(),
            endedAt: Date.now(),
            status: 'done',
            parentStepId: resolvePlanningParentStepId(stage),
            lane: planningStageLayout[stage].lane,
          }];
        }
        emitReasoningUpdate(false);
      };
      // ── Sub-stage support: parallel per-group tool-select children ─────
      // Sub-stages are addressed by composite `${stage}:${subStageId}` keys
      // and render as ProcessLog children of their parent stage row. Each
      // sub-stage has its own watchdog so a single stalled stream no longer
      // aborts the whole turn — only when ALL siblings stall do we surface
      // the run-level timeout via the existing fail path.
      type SubStageTimers = { idle: number | null; hard: number | null };
      const subStageProcessIds = new Map<string, string>();
      const subStageTimers = new Map<string, SubStageTimers>();
      const subStageSawOutput = new Set<string>();
      const subStageActiveByParent = new Map<PlanningStageName, Set<string>>();
      const subStageFailedByParent = new Map<PlanningStageName, Set<string>>();
      const subStageDoneByParent = new Map<PlanningStageName, Set<string>>();
      const subStageLabels = new Map<string, string>();
      let failLocalToolRun: ((reason: LocalToolTimeoutReason, stage?: PlanningStageName | null) => void) | null = null;
      const subStageKey = (stage: PlanningStageName, subStageId: string) => `${stage}:${subStageId}`;
      const clearSubStageTimers = (key: string) => {
        const timers = subStageTimers.get(key);
        if (!timers) return;
        if (timers.idle !== null) window.clearTimeout(timers.idle);
        if (timers.hard !== null) window.clearTimeout(timers.hard);
        subStageTimers.delete(key);
      };
      const settleSubStage = (
        stage: PlanningStageName,
        subStageId: string,
        outcome: 'done' | 'failed',
        finalText?: string,
      ) => {
        const key = subStageKey(stage, subStageId);
        clearSubStageTimers(key);
        subStageActiveByParent.get(stage)?.delete(subStageId);
        if (outcome === 'failed') {
          const set = subStageFailedByParent.get(stage) ?? new Set<string>();
          set.add(subStageId);
          subStageFailedByParent.set(stage, set);
        } else {
          const set = subStageDoneByParent.get(stage) ?? new Set<string>();
          set.add(subStageId);
          subStageDoneByParent.set(stage, set);
        }
        const processId = subStageProcessIds.get(key);
        if (processId) {
          processLog.update(processId, {
            status: outcome,
            ...(finalText !== undefined ? { transcript: finalText } : {}),
          });
        }
        emitReasoningUpdate(false);
      };
      const failSubStageFromTimeout = (
        stage: PlanningStageName,
        subStageId: string,
        reason: LocalToolTimeoutReason,
      ) => {
        const key = subStageKey(stage, subStageId);
        const label = subStageLabels.get(key) ?? subStageId;
        const timeoutLabel = formatOperationDuration(Math.round(resolvePlanningStageTimeoutMs(stage, reason) / 1000));
        const reasonLabel = reason === 'no-output'
          ? 'waiting for any output.'
          : reason === 'thinking-idle'
            ? 'waiting for visible output while the model was still thinking.'
            : 'waiting for more streamed output.';
        const transcript = `Stalled ${label} after ${timeoutLabel} ${reasonLabel}`;
        settleSubStage(stage, subStageId, 'failed', transcript);
        // If every sibling stalled, the parent run-level watchdog fires via
        // the existing fail path. Otherwise the surviving children continue.
        const active = subStageActiveByParent.get(stage);
        if (active && active.size === 0) {
          const done = subStageDoneByParent.get(stage)?.size ?? 0;
          if (done === 0) {
            failLocalToolRun?.(reason, stage);
          }
        }
      };
      const scheduleSubStageIdle = (stage: PlanningStageName, subStageId: string) => {
        const key = subStageKey(stage, subStageId);
        const timers = subStageTimers.get(key) ?? { idle: null, hard: null };
        if (timers.idle !== null) window.clearTimeout(timers.idle);
        timers.idle = window.setTimeout(() => {
          failSubStageFromTimeout(stage, subStageId, 'streaming-idle');
        }, resolvePlanningStageTimeoutMs(stage, 'streaming-idle'));
        subStageTimers.set(key, timers);
      };
      const scheduleSubStageHard = (stage: PlanningStageName, subStageId: string) => {
        const key = subStageKey(stage, subStageId);
        const timers = subStageTimers.get(key) ?? { idle: null, hard: null };
        if (timers.hard !== null) window.clearTimeout(timers.hard);
        timers.hard = window.setTimeout(() => {
          failSubStageFromTimeout(stage, subStageId, 'no-output');
        }, resolvePlanningStageTimeoutMs(stage, 'no-output'));
        subStageTimers.set(key, timers);
      };
      const beginSubStage = (
        stage: PlanningStageName,
        subStageId: string,
        label: string | undefined,
        stageMeta?: StageMeta,
      ) => {
        const key = subStageKey(stage, subStageId);
        if (label) subStageLabels.set(key, label);
        const active = subStageActiveByParent.get(stage) ?? new Set<string>();
        active.add(subStageId);
        subStageActiveByParent.set(stage, active);
        const parentProcessId = processIdByStage.get(stage)
          ?? resolveProcessParentId(stage)
          ?? (activePlanningStage ? processIdByStage.get(activePlanningStage) : undefined);
        if (!subStageProcessIds.has(key)) {
          const processId = `stage:${stage}:${subStageId}:${createUniqueId()}`;
          subStageProcessIds.set(key, processId);
          processLog.append({
            id: processId,
            kind: subStageId.startsWith('make-tool:') ? 'tool-created' : subStageId === 'codemode' ? 'tool-plan' : 'tool-select',
            actor: label ? `tools:${label}` : `tools:${subStageId}`,
            summary: `Selecting tools · ${label ?? subStageId}`,
            ...(parentProcessId ? { parentId: parentProcessId } : {}),
            branchId: stageMeta?.branchId ?? `${stage}-children`,
            ...processMetaFromStageMeta(stageMeta),
            status: 'active',
            timeoutMs: resolvePlanningStageTimeoutMs(stage, 'no-output'),
          });
        }
        scheduleSubStageHard(stage, subStageId);
        emitReasoningUpdate(true);
      };
      const appendSubStageToken = (stage: PlanningStageName, subStageId: string, token: string) => {
        if (!token) return;
        const key = subStageKey(stage, subStageId);
        subStageSawOutput.add(key);
        const processId = subStageProcessIds.get(key);
        if (!processId) return;
        const existing = processLog.snapshot().find((entry) => entry.id === processId);
        const accumulated = `${existing?.transcript ?? ''}${token}`;
        processLog.update(processId, {
          transcript: accumulated,
          status: 'active',
          timeoutMs: resolvePlanningStageTimeoutMs(stage, 'streaming-idle'),
        });
        // Cancel hard timer once we've seen any output; idle timer takes over.
        const timers = subStageTimers.get(key);
        if (timers?.hard !== null && timers) {
          window.clearTimeout(timers.hard!);
          timers.hard = null;
          subStageTimers.set(key, timers);
        }
        scheduleSubStageIdle(stage, subStageId);
        emitReasoningUpdate(true);
      };
      const completeSubStage = (
        stage: PlanningStageName,
        subStageId: string,
        finalText?: string,
      ) => {
        settleSubStage(stage, subStageId, 'done', finalText);
      };
      const errorSubStage = (
        stage: PlanningStageName,
        subStageId: string,
        error: Error,
      ) => {
        const label = subStageLabels.get(subStageKey(stage, subStageId)) ?? subStageId;
        settleSubStage(stage, subStageId, 'failed', `Error in ${label}: ${error.message}`);
      };
      const recordToolResult = (toolName: string, args: unknown, result: unknown, isError: boolean, toolCallId?: string) => {
        const existingStepId = findToolStepId(toolName, toolCallId);
        if (!existingStepId) {
          recordToolStep(toolName, args, toolCallId);
        }

        const stepId = findToolStepId(toolName, toolCallId);
        if (!stepId) {
          return;
        }

        const resultSummary = summarizeToolResult(toolName, result);
        reasoningSteps = patchReasoningStep(reasoningSteps, stepId, {
          body: formatToolArgs(args),
          toolArgs: args,
          toolResult: resultSummary,
          isError,
          status: 'done',
          endedAt: Date.now(),
        });
        // Single ProcessLog row per tool call: update the existing tool-call
        // entry in-place with the result summary + final status. Avoids
        // bloating the timeline with separate `tool-result` rows that
        // duplicate the `tool-call` row's content.
        const callProcessId = toolCallId ? processIdByToolCallId.get(toolCallId) : undefined;
        if (callProcessId) {
          processLog.update(callProcessId, {
            status: isError ? 'failed' : 'done',
            transcript: `${formatToolArgs(args)}\n→ ${resultSummary}`,
            payload: { toolName, toolCallId, args, result, isError },
            summary: isError ? `${toolName} failed` : summarizeToolCall(toolName, args),
          });
        }
        updateMessage(assistantId, {
          status: 'streaming',
          loadingStatus: null,
          reasoningSteps,
          currentStepId: getActiveReasoningStepId(reasoningSteps),
          reasoningStartedAt: reasoningSteps[0]?.startedAt,
          isThinking: false,
          processEntries: snapshotProcess(),
        });
      };

      activeGenerationRef.current = {
        assistantId,
        sessionId: activeChatSessionId,
        cancel: () => controller.abort('Generation stopped.'),
        finalizeCancelled: () => {
          const finalizedSteps = finalizeToolReasoningSteps();
          updateMessage(assistantId, {
            status: 'complete',
            statusText: 'stopped',
            content: 'Response stopped.',
            loadingStatus: null,
            reasoningSteps: finalizedSteps,
            currentStepId: undefined,
            thinkingDuration: getStepDurationSeconds(finalizedSteps),
            isThinking: false,
          });
        },
      };
      setActiveGenerationSessionId(activeChatSessionId);
      if (reasoningSteps.length) {
        updateMessage(assistantId, {
          status: 'streaming',
          loadingStatus: null,
          reasoningSteps,
          currentStepId: getActiveReasoningStepId(reasoningSteps),
          reasoningStartedAt: reasoningSteps[0]?.startedAt,
          isThinking: true,
        });
      }

      try {
        let localToolIdleTimeoutId: number | null = null;
        let localToolHardTimeoutId: number | null = null;
        let localToolWatchdogMode: LocalToolWatchdogMode = 'thinking';
        let localToolSawPlanningOutput = false;
        let localToolInsideThinkBlock = false;
        const clearLocalToolWatchdogs = () => {
          if (localToolIdleTimeoutId !== null) {
            window.clearTimeout(localToolIdleTimeoutId);
            localToolIdleTimeoutId = null;
          }
          if (localToolHardTimeoutId !== null) {
            window.clearTimeout(localToolHardTimeoutId);
            localToolHardTimeoutId = null;
          }
        };
        const getLocalToolTimeoutMessage = (reason: LocalToolTimeoutReason) => {
          switch (reason) {
            case 'no-output':
              return 'Local tool planning produced no output at all. Try fewer tools, a simpler prompt, or switch models for this request.';
            case 'thinking-idle':
              return 'Local tool planning is still thinking with no new visible output. Try fewer tools, a simpler prompt, or disable tools for this request.';
            default:
              return 'Local tool planning stalled after output stopped. Try fewer tools, a simpler prompt, or disable tools for this request.';
          }
        };
        failLocalToolRun = (reason: LocalToolTimeoutReason, stage: PlanningStageName | null = activePlanningStage) => {
          localToolRunTimedOut = true;
          const message = getLocalToolTimeoutMessage(reason);
          const timeoutStage = resolveWatchdogPlanningStage(stage) ?? stage;
          if (timeoutStage && planningStepIdsByStage.has(timeoutStage)) {
            const body = buildPlanningStageTimeoutBody(timeoutStage, reason);
            reasoningSteps = patchReasoningStep(reasoningSteps, planningStepIdsByStage.get(timeoutStage)!, {
              body: previewPlanningBody(body),
              transcript: body,
              endedAt: Date.now(),
              timeoutMs: resolvePlanningStageDisplayTimeoutMs(timeoutStage, reason),
            });
            const processId = processIdByStage.get(timeoutStage);
            if (processId) {
              processLog.update(processId, {
                transcript: body,
                status: 'done',
                timeoutMs: resolvePlanningStageDisplayTimeoutMs(timeoutStage, reason),
              });
            }
          }
          const finalizedSteps = finalizeToolReasoningSteps();
          updateMessage(assistantId, {
            status: 'error',
            loadingStatus: null,
            content: message,
            reasoningSteps: finalizedSteps,
            currentStepId: undefined,
            thinkingDuration: getStepDurationSeconds(finalizedSteps),
            isThinking: false,
            processEntries: snapshotProcess(),
          });
          controller.abort(message);
        };
        const scheduleLocalToolIdleTimeout = (
          stage: PlanningStageName | null = activePlanningStage,
          mode: LocalToolWatchdogMode = localToolWatchdogMode,
        ) => {
          const timeoutStage = resolveWatchdogPlanningStage(stage);
          if (runtimeProviderForRequest !== 'codi' || !timeoutStage) return;
          localToolWatchdogMode = mode;
          activePlanningStage = timeoutStage;
          setPlanningStageTimeout(timeoutStage, mode === 'thinking' ? 'thinking-idle' : 'streaming-idle');
          if (localToolIdleTimeoutId !== null) {
            window.clearTimeout(localToolIdleTimeoutId);
          }
          localToolIdleTimeoutId = window.setTimeout(() => {
            failLocalToolRun?.(localToolWatchdogMode === 'thinking' ? 'thinking-idle' : 'streaming-idle', timeoutStage);
          }, resolvePlanningStageTimeoutMs(timeoutStage, localToolWatchdogMode === 'thinking' ? 'thinking-idle' : 'streaming-idle'));
        };
        const scheduleLocalToolHardTimeout = (stage: PlanningStageName | null = activePlanningStage) => {
          const timeoutStage = resolveWatchdogPlanningStage(stage);
          if (runtimeProviderForRequest !== 'codi' || !timeoutStage) return;
          activePlanningStage = timeoutStage;
          setPlanningStageTimeout(timeoutStage, 'no-output');
          if (localToolHardTimeoutId !== null) {
            window.clearTimeout(localToolHardTimeoutId);
          }
          localToolHardTimeoutId = window.setTimeout(() => {
            failLocalToolRun?.('no-output', timeoutStage);
          }, resolvePlanningStageTimeoutMs(timeoutStage, 'no-output'));
        };
        const noteLocalToolPlanningOutput = (
          stage: PlanningStageName | null = activePlanningStage,
          mode: LocalToolWatchdogMode = localToolWatchdogMode,
        ) => {
          localToolSawPlanningOutput = true;
          const timeoutStage = resolveWatchdogPlanningStage(stage);
          if (timeoutStage) {
            activePlanningStage = timeoutStage;
          }
          if (localToolHardTimeoutId !== null) {
            window.clearTimeout(localToolHardTimeoutId);
            localToolHardTimeoutId = null;
          }
          scheduleLocalToolIdleTimeout(timeoutStage, mode);
        };
        const noteLocalToolMirrorOutput = (mode: LocalToolWatchdogMode = localToolWatchdogMode) => {
          localToolSawPlanningOutput = true;
          localToolWatchdogMode = mode;
          if (localToolHardTimeoutId !== null) {
            window.clearTimeout(localToolHardTimeoutId);
            localToolHardTimeoutId = null;
          }
          scheduleLocalToolIdleTimeout(resolveWatchdogPlanningStage(activePlanningStage), mode);
        };

        const modelConfig = runtimeProviderForRequest === 'ghcp'
          ? { kind: 'copilot' as const, modelId: requestGhcpModelId, sessionId: activeChatSessionId }
          : runtimeProviderForRequest === 'cursor'
            ? { kind: 'cursor' as const, modelId: effectiveSelectedCursorModelId, sessionId: activeChatSessionId }
            : { kind: 'local' as const, modelId: requestLocalModel!.id, task: requestLocalModel!.task };
        const model = runtimeProviderForRequest === 'codi'
          ? (new LocalLanguageModel(
              requestLocalModel!.id,
              requestLocalModel!.task,
              {
                // Reset the idle watchdog on every raw worker token, even
                // when the upstream consumer hides the chunk (e.g. while
                // sanitizing a `<think>...</think>` block). Without this,
                // a model that thinks for 30+ seconds before emitting any
                // visible content trips the watchdog despite making real
                // progress.
                onToken: (token) => {
                  if (token.includes('<think>')) {
                    localToolInsideThinkBlock = true;
                    noteLocalToolPlanningOutput(activePlanningStage, 'thinking');
                  }

                  if (token.includes('</think>')) {
                    const afterThink = token.split('</think>')[1] ?? '';
                    localToolInsideThinkBlock = false;
                    noteLocalToolPlanningOutput(activePlanningStage, afterThink.trim() ? 'streaming' : 'thinking');
                    return;
                  }

                  noteLocalToolPlanningOutput(activePlanningStage, localToolInsideThinkBlock ? 'thinking' : 'streaming');
                },
                onPhase: (phase) => noteLocalToolPlanningOutput(activePlanningStage, phase === 'thinking' ? 'thinking' : 'streaming'),
              },
            ) as unknown as ReturnType<typeof resolveLanguageModel>)
          : resolveLanguageModel(modelConfig);
        const capabilities = getModelCapabilities(modelConfig, {
          installedModels,
          copilotModels: copilotState.models,
          cursorModels: cursorState.models,
        });
        const allTools = createDefaultTools({
          appendSharedMessages,
          getSessionBash,
          notifyTerminalFsPathsChanged: onTerminalFsPathsChanged,
          sessionId: activeSessionId,
          setBashHistoryBySession,
          setCwdBySession,
        });
        const bridgeTools = webMcpBridge.createToolSet() as unknown as ToolSet;
        const tools = selectToolsByIds({
          ...allTools,
          ...bridgeTools,
        } as ToolSet, selectedToolIds);
        const selectedDescriptors = selectToolDescriptorsByIds(toolDescriptors, selectedToolIds);
        const toolInstructions = providerForRequest === 'researcher'
          ? buildResearcherToolInstructions({
            workspaceName,
            workspacePromptContext: requestWorkspacePromptContext,
            descriptors: selectedDescriptors,
            selectedToolIds,
          })
          : providerForRequest === 'debugger'
            ? buildDebuggerToolInstructions({
              workspaceName,
              workspacePromptContext: requestWorkspacePromptContext,
              descriptors: selectedDescriptors,
              selectedToolIds,
            })
          : providerForRequest === 'planner'
            ? buildPlannerToolInstructions({
              workspaceName,
              workspacePromptContext: requestWorkspacePromptContext,
              descriptors: selectedDescriptors,
              selectedToolIds,
            })
          : providerForRequest === 'security'
            ? buildSecurityReviewToolInstructions({
              workspaceName,
              workspacePromptContext: requestWorkspacePromptContext,
              descriptors: selectedDescriptors,
              selectedToolIds,
            })
          : buildDefaultToolInstructions({ workspaceName, workspacePromptContext: requestWorkspacePromptContext, selectedToolIds });
        const inputMessages: ModelMessage[] = nextMessages
          .filter((message) => message.id !== assistantId)
          .flatMap((message) => {
            const baseMessage: ModelMessage = {
              role: message.role,
              content: message.streamedContent || message.content,
            };
            if (message.role === 'assistant' && message.searchTurnContext) {
              return [baseMessage, createSearchTurnContextSystemMessage(message.searchTurnContext)];
            }
            return [baseMessage];
          });

        try {
          const sharedCallbacks = {
            onDone: (finalText: string) => {
              clearLocalToolWatchdogs();
              if (localToolRunTimedOut) return;
              const finalizedVoters = finalizeVoterSteps(delegationVoterSteps);
              delegationVoterSteps = finalizedVoters;
              if (mirrorVoterStageToProcess && finalizedVoters.length) {
                syncPlanningStage('voter-ensemble', buildDelegationVoterStageBody(finalizedVoters), 'done');
              }
              if (delegationBusEntries.length) {
                syncPlanningStage('agent-bus', buildDelegationBusStageBody(delegationBusEntries), 'done');
              }
              const finalizedSteps = finalizeToolReasoningSteps();
              updateMessage(assistantId, {
                status: 'complete',
                loadingStatus: null,
                content: finalText.trim() || 'Tool run completed.',
                reasoningSteps: finalizedSteps.length ? finalizedSteps : undefined,
                currentStepId: undefined,
                thinkingDuration: getStepDurationSeconds(finalizedSteps),
                isThinking: false,
                voterSteps: finalizedVoters.length ? finalizedVoters : undefined,
                isVoting: false,
                busEntries: delegationBusEntries.length ? delegationBusEntries : undefined,
                processEntries: snapshotProcess(),
              });
              notifyAssistantComplete(assistantId, finalText.trim() || 'Tool run completed.');
            },
            onError: (error: Error) => {
              clearLocalToolWatchdogs();
              if (localToolRunTimedOut) return;
              const finalizedVoters = finalizeVoterSteps(delegationVoterSteps);
              delegationVoterSteps = finalizedVoters;
              if (mirrorVoterStageToProcess && finalizedVoters.length) {
                syncPlanningStage('voter-ensemble', buildDelegationVoterStageBody(finalizedVoters), 'done');
              }
              if (delegationBusEntries.length) {
                syncPlanningStage('agent-bus', buildDelegationBusStageBody(delegationBusEntries), 'done');
              }
              updateMessage(assistantId, {
                status: 'error',
                loadingStatus: null,
                content: error.message,
                reasoningSteps: reasoningSteps.length ? finalizeToolReasoningSteps() : undefined,
                currentStepId: undefined,
                thinkingDuration: reasoningSteps.length ? getStepDurationSeconds(finalizeToolReasoningSteps()) : undefined,
                isThinking: false,
                voterSteps: finalizedVoters.length ? finalizedVoters : undefined,
                isVoting: false,
                busEntries: delegationBusEntries.length ? delegationBusEntries : undefined,
                processEntries: snapshotProcess(),
              });
            },
          };

          if (shouldRunParallelDelegation(text, capabilities)) {
            const result = await runParallelDelegationWorkflow({
              model,
              prompt: text,
              workspaceName,
              capabilities,
              signal: controller.signal,
              execution: selectedDescriptors.length > 0
                ? {
                  tools,
                  toolDescriptors: selectedDescriptors,
                  instructions: toolInstructions,
                  messages: inputMessages,
                  writePlanFile: async (path, content) => {
                    if (path.startsWith('/workspace/')) {
                      const sessionId = activeSessionIdRef.current;
                      if (!sessionId) {
                        throw new Error('No active session available for delegated plan persistence.');
                      }
                      const bash = getSessionBash(sessionId);
                      const dir = path.slice(0, path.lastIndexOf('/'));
                      if (dir) {
                        await bash.fs.mkdir(dir, { recursive: true });
                      }
                      await bash.fs.writeFile(path, content, 'utf-8');
                      return;
                    }

                    const nextFile: WorkspaceFile = {
                      path,
                      content,
                      updatedAt: new Date().toISOString(),
                    };
                    const validationError = validateWorkspaceFile(nextFile);
                    if (validationError) {
                      throw new TypeError(validationError);
                    }
                    onWorkspaceFileUpsert(nextFile);
                  },
                  listWorkspacePaths: async () => {
                    const paths = workspaceFilesRef.current.map((file) => file.path);
                    const sessionId = activeSessionIdRef.current;
                    if (!sessionId) {
                      return paths;
                    }
                    return [...paths, ...getSessionBash(sessionId).fs.getAllPaths()];
                  },
                  runShellCommand: async (command) => {
                    const sessionId = activeSessionIdRef.current;
                    if (!sessionId) {
                      return {
                        exitCode: 127,
                        stdout: '',
                        stderr: 'No active session available for shell validation.',
                      };
                    }
                    return getSessionBash(sessionId).exec(command);
                  },
                }
                : undefined,
            }, {
              onStepStart: (stepId, title, body) => {
                planningStageMeta[stepId] = { title, body };
                beginPlanningStage(stepId, 'no-output');
                if (activePlanningStage === null) {
                  activePlanningStage = stepId;
                  if (localToolSawPlanningOutput) {
                    scheduleLocalToolIdleTimeout(stepId, localToolWatchdogMode);
                  } else {
                    scheduleLocalToolHardTimeout(stepId);
                  }
                }
              },
              onStepToken: (stepId, delta) => {
                noteLocalToolPlanningOutput(stepId, 'streaming');
                appendPlanningStageToken(stepId, delta);
              },
              onStepComplete: (stepId, resultText) => {
                noteLocalToolPlanningOutput(stepId, 'streaming');
                completePlanningStage(stepId, resultText);
              },
              onAgentHandoff: (fromAgentId, toAgentId, summary) => {
                noteLocalToolMirrorOutput('streaming');
                appendAgentHandoff(fromAgentId, toAgentId, summary);
              },
              onVoterStep: (step) => {
                noteLocalToolMirrorOutput('streaming');
                mirrorVoterStageToProcess = true;
                delegationVoterSteps = upsertVoterStep(delegationVoterSteps, step);
                syncPlanningStage('voter-ensemble', buildDelegationVoterStageBody(delegationVoterSteps), 'active');
                const pId = `vote:${step.id}`;
                processIdByVoterStepId.set(step.id, pId);
                const parentProcessId = processIdByStage.get('voter-ensemble')
                  ?? processIdByStage.get('tool-agent')
                  ?? processIdByStage.get('coordinator');
                processLog.append({
                  id: pId,
                  kind: 'vote',
                  actor: `voter:${step.voterId}`,
                  summary: `${step.voterId} reviewing`,
                  payload: step,
                  branchId: 'voters',
                  ...(parentProcessId ? { parentId: parentProcessId } : {}),
                  status: 'active',
                });
                updateMessage(assistantId, { processEntries: snapshotProcess() });
              },
              onVoterStepUpdate: (id, patch) => {
                noteLocalToolMirrorOutput('streaming');
                delegationVoterSteps = patchVoterStep(delegationVoterSteps, id, patch);
                syncPlanningStage(
                  'voter-ensemble',
                  buildDelegationVoterStageBody(delegationVoterSteps),
                  delegationVoterSteps.some((step) => step.status === 'active') ? 'active' : 'done',
                );
                const pId = processIdByVoterStepId.get(id);
                const merged = delegationVoterSteps.find((s) => s.id === id);
                if (pId && merged) {
                  const verdict = merged.approve === true ? '✓' : merged.approve === false ? '✗' : '·';
                  processLog.update(pId, {
                    summary: `${merged.voterId} ${verdict}`,
                    transcript: merged.thought ?? merged.body ?? undefined,
                    payload: merged,
                    status: merged.status,
                  });
                }
              },
              onVoterStepEnd: (id) => {
                noteLocalToolMirrorOutput('streaming');
                delegationVoterSteps = patchVoterStep(delegationVoterSteps, id, { status: 'done', endedAt: Date.now() });
                syncPlanningStage(
                  'voter-ensemble',
                  buildDelegationVoterStageBody(delegationVoterSteps),
                  delegationVoterSteps.some((step) => step.status === 'active') ? 'active' : 'done',
                );
                const pId = processIdByVoterStepId.get(id);
                if (pId) processLog.update(pId, { status: 'done' });
              },
              onBusEntry: (entry) => {
                noteLocalToolMirrorOutput('streaming');
                delegationBusEntries = [...delegationBusEntries, entry];
                syncAgentBusSummary(delegationBusEntries);
                appendBusProcessEntry(
                  entry,
                  processIdByStage.get('logact')
                    ?? processIdByStage.get('tool-agent')
                    ?? processIdByStage.get('coordinator')
                    ?? processIdByStage.get('chat-agent'),
                );
                updateMessage(assistantId, { processEntries: snapshotProcess(), busEntries: delegationBusEntries });
              },
              onToolCall: (toolName, args, toolCallId) => {
                noteLocalToolPlanningOutput(activePlanningStage, 'streaming');
                recordToolStep(toolName, args, toolCallId);
              },
              onToolResult: (toolName, args, result, isError, toolCallId) => {
                noteLocalToolPlanningOutput(activePlanningStage, 'streaming');
                recordToolResult(toolName, args, result, isError, toolCallId);
              },
              onStageStart: (_stage, _detail, meta) => {
                if (meta?.subStageId) {
                  // Forward subagent staged-pipeline sub-stages to the
                  // ProcessLog. Use 'tool-select' as the parent stage so
                  // the existing renderer/timeout path applies.
                  beginSubStage('tool-select', meta.subStageId, meta.label, meta);
                  return;
                }
                activePlanningStage = _stage;
                beginPlanningStage(_stage, 'no-output', meta);
                if (localToolSawPlanningOutput) {
                  scheduleLocalToolIdleTimeout(_stage, localToolWatchdogMode);
                } else {
                  scheduleLocalToolHardTimeout(_stage);
                }
              },
              onStageToken: (_stage, delta, meta) => {
                if (meta?.subStageId) {
                  noteLocalToolMirrorOutput('streaming');
                  appendSubStageToken('tool-select', meta.subStageId, delta);
                  return;
                }
                noteLocalToolPlanningOutput(_stage, 'streaming');
                appendPlanningStageToken(_stage, delta);
              },
              onStageComplete: (_stage, text, meta) => {
                if (meta?.subStageId) {
                  noteLocalToolMirrorOutput('streaming');
                  completeSubStage('tool-select', meta.subStageId, text);
                  return;
                }
                noteLocalToolPlanningOutput(_stage, 'streaming');
                completePlanningStage(_stage, text);
              },
              onStageError: (_stage, error, meta) => {
                if (meta?.subStageId) {
                  errorSubStage('tool-select', meta.subStageId, error);
                }
              },
              ...sharedCallbacks,
            });
            const searchTurnContext = 'searchTurnContext' in result ? result.searchTurnContext : undefined;
            if (isSearchTurnContext(searchTurnContext)) {
              updateMessage(assistantId, { searchTurnContext });
            }
          } else {
            const result = await runStagedToolPipeline({
              model,
              tools,
              toolDescriptors: selectedDescriptors,
              instructions: toolInstructions,
              messages: inputMessages,
              workspaceName,
              capabilities,
              signal: controller.signal,
              evaluationAgents,
              negativeRubricTechniques,
              adversaryToolReviewSettings,
              onNegativeRubricTechnique,
              onGeneratedTool: (file) => onWorkspaceFileUpsert({
                path: file.path,
                content: file.source,
                updatedAt: new Date().toISOString(),
              }),
            }, {
              onAgentHandoff: (fromAgentId, toAgentId, summary) => {
                noteLocalToolMirrorOutput('streaming');
                appendAgentHandoff(fromAgentId, toAgentId, summary);
              },
              onStageStart: (stage, _detail, meta) => {
                if (meta?.subStageId) {
                  beginSubStage(stage, meta.subStageId, meta.label, meta);
                  return;
                }
                activePlanningStage = stage;
                beginPlanningStage(stage, 'no-output', meta);
                if (localToolSawPlanningOutput) {
                  scheduleLocalToolIdleTimeout(stage, localToolWatchdogMode);
                } else {
                  scheduleLocalToolHardTimeout(stage);
                }
              },
              onStageToken: (stage, delta, meta) => {
                if (meta?.subStageId) {
                  noteLocalToolPlanningOutput(stage, 'streaming');
                  appendSubStageToken(stage, meta.subStageId, delta);
                  return;
                }
                noteLocalToolPlanningOutput(stage, 'streaming');
                appendPlanningStageToken(stage, delta);
              },
              onStageComplete: (stage, text, meta) => {
                if (meta?.subStageId) {
                  noteLocalToolPlanningOutput(stage, 'streaming');
                  completeSubStage(stage, meta.subStageId, text);
                  return;
                }
                noteLocalToolPlanningOutput(stage, 'streaming');
                completePlanningStage(stage, text);
              },
              onStageError: (stage, error, meta) => {
                if (meta?.subStageId) {
                  errorSubStage(stage, meta.subStageId, error);
                }
              },
              onToolCall: (toolName, args, toolCallId) => {
                noteLocalToolPlanningOutput(activePlanningStage, 'streaming');
                recordToolStep(toolName, args, toolCallId);
              },
              onToolResult: (toolName, args, result, isError, toolCallId) => {
                noteLocalToolPlanningOutput(activePlanningStage, 'streaming');
                recordToolResult(toolName, args, result, isError, toolCallId);
              },
              onVoterStep: (step) => {
                noteLocalToolMirrorOutput('streaming');
                delegationVoterSteps = upsertVoterStep(delegationVoterSteps, step);
                updateMessage(assistantId, { voterSteps: delegationVoterSteps });
              },
              onVoterStepUpdate: (id, patch) => {
                noteLocalToolMirrorOutput('streaming');
                delegationVoterSteps = patchVoterStep(delegationVoterSteps, id, patch);
                const pId = processIdByVoterStepId.get(id);
                const merged = delegationVoterSteps.find((step) => step.id === id);
                if (pId && merged) {
                  const verdict = merged.approve === true ? '✓' : merged.approve === false ? '✗' : '·';
                  processLog.update(pId, {
                    summary: `${merged.voterId} ${verdict}`,
                    transcript: merged.thought ?? merged.body ?? undefined,
                    payload: merged,
                    status: merged.status,
                  });
                }
                updateMessage(assistantId, { voterSteps: delegationVoterSteps, processEntries: snapshotProcess() });
              },
              onVoterStepEnd: (id) => {
                noteLocalToolMirrorOutput('streaming');
                delegationVoterSteps = patchVoterStep(delegationVoterSteps, id, { status: 'done', endedAt: Date.now() });
                const pId = processIdByVoterStepId.get(id);
                if (pId) {
                  processLog.update(pId, { status: 'done' });
                }
                updateMessage(assistantId, { voterSteps: delegationVoterSteps, processEntries: snapshotProcess() });
              },
              onBusEntry: (entry) => {
                noteLocalToolMirrorOutput('streaming');
                delegationBusEntries = [...delegationBusEntries, entry];
                syncAgentBusSummary(delegationBusEntries);
                const parentProcessId = processIdByStage.get('logact')
                  ?? (activePlanningStage && processIdByStage.get(activePlanningStage))
                  ?? processIdByStage.get('executor')
                  ?? processIdByStage.get('chat-agent');
                appendBusProcessEntry(entry, parentProcessId);
                updateMessage(assistantId, { processEntries: snapshotProcess(), busEntries: delegationBusEntries });
              },
              onIterationStep: (step) => {
                const pId = `iter:${step.id}`;
                const parentProcessId = processIdByStage.get('executor');
                processLog.append({
                  id: pId,
                  kind: 'reasoning',
                  actor: 'iteration',
                  summary: step.title ?? `Iteration ${step.id}`,
                  payload: step,
                  branchId: 'iterations',
                  ...(parentProcessId ? { parentId: parentProcessId } : {}),
                  status: 'active',
                });
                updateMessage(assistantId, { processEntries: snapshotProcess() });
              },
              onIterationStepUpdate: (id, patch) => {
                const pId = `iter:${id}`;
                processLog.update(pId, {
                  summary: patch.done ? 'Iteration ✓ done' : patch.body ?? `Iteration ${id}`,
                  transcript: patch.body,
                  payload: patch,
                  status: patch.status ?? 'active',
                });
                updateMessage(assistantId, { processEntries: snapshotProcess() });
              },
              onIterationStepEnd: (id) => {
                const pId = `iter:${id}`;
                processLog.update(pId, { status: 'done' });
                updateMessage(assistantId, { processEntries: snapshotProcess() });
              },
              onModelTurnStart: (turnId, stepIndex) => {
                noteLocalToolPlanningOutput(activePlanningStage, 'streaming');
                const parentProcessId = lastProcessIdByBranch.get('agent:executor') ?? processIdByStage.get('executor');
                processLog.append({
                  id: `turn:${turnId}`,
                  kind: 'inf-in',
                  actor: 'executor',
                  summary: `Model turn ${stepIndex + 1}`,
                  branchId: 'agent:executor',
                  ...(parentProcessId ? { parentId: parentProcessId } : {}),
                  status: 'active',
                });
                updateMessage(assistantId, { processEntries: snapshotProcess() });
              },
              onModelTurnEnd: (turnId, text, parsed) => {
                noteLocalToolPlanningOutput(activePlanningStage, 'streaming');
                // Combine model-turn start + end into a single row that
                // updates in-place. If the turn produced nothing meaningful
                // (no parsed tool call AND no text), drop it entirely so
                // the timeline isn't polluted with empty start/end pairs.
                const trimmed = text.length > 200 ? `${text.slice(0, 200)}…` : text;
                if (!parsed && !text.trim()) {
                  processLog.update(`turn:${turnId}`, { status: 'done', summary: 'Empty turn' });
                } else {
                  processLog.update(`turn:${turnId}`, {
                    kind: 'inf-out',
                    summary: parsed
                      ? `Tool call → ${parsed.toolName}`
                      : trimmed,
                    transcript: text,
                    payload: { turnId, parsed, text },
                    status: 'done',
                  });
                }
                updateMessage(assistantId, { processEntries: snapshotProcess() });
              },
              ...sharedCallbacks,
            });
            const searchTurnContext = 'searchTurnContext' in result ? result.searchTurnContext : undefined;
            if (isSearchTurnContext(searchTurnContext)) {
              updateMessage(assistantId, { searchTurnContext });
            }
          }
        } finally {
          clearLocalToolWatchdogs();
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          if (localToolRunTimedOut) {
            return;
          }
          return;
        }
        if (error instanceof Error && error.name === 'AbortError') {
          if (localToolRunTimedOut) {
            return;
          }
          return;
        }
        onToast({ msg: error instanceof Error ? error.message : 'Agent request failed', type: 'error' });
      } finally {
        clearActiveGeneration(assistantId);
      }
      return;
    }

    let tokenBuffer = '';
    let thinkingBuffer = '';
    let thinkingStart = 0;
    let reasoningSteps: ReasoningStep[] = runtimeProviderForRequest === 'codi'
      ? [createInitialLocalReasoningStep(
        providerForRequest === 'researcher' ? 'Analyzing research request' : providerForRequest === 'debugger' ? 'Analyzing debugging request' : providerForRequest === 'planner' ? 'Analyzing planning request' : providerForRequest === 'security' ? 'Analyzing security review' : 'Analyzing request',
        providerForRequest === 'researcher' ? 'Researcher is reviewing the research question and workspace context locally.' : providerForRequest === 'debugger' ? 'Debugger is reviewing the symptom, impact, and available evidence locally.' : providerForRequest === 'planner' ? 'Planner is reviewing local tasks, agents, sessions, and workspace context locally.' : providerForRequest === 'security' ? 'Security Review is reviewing the security target, severity threshold, and available evidence locally.' : 'Codi is reviewing the prompt and workspace context locally.',
      )]
      : [];
    let voterSteps: VoterStep[] = [];
    let hasStructuredReasoning = false;
    let phaseStepId: string | null = reasoningSteps[0]?.id ?? null;
    let phaseStepTitle: string | null = reasoningSteps[0]?.title ?? null;
    const processLog = new ProcessLog();
    const processIdByReasoningStepId = new Map<string, string>();
    const processIdByVoterStepId = new Map<string, string>();
    let busEntries: BusEntryStep[] = [];
    const rawThinkingProcessId = `reasoning:${assistantId}:thinking`;
    const controller = new AbortController();
    const codiVoters: IVoter[] = [];

    const ensureThinkingStarted = () => {
      if (!thinkingStart) thinkingStart = Date.now();
    };

    const getPhaseStepMeta = (phase: string) => {
      switch (phase) {
        case 'thinking':
          return {
            title: providerForRequest === 'researcher' ? 'Analyzing research request' : providerForRequest === 'debugger' ? 'Analyzing debugging request' : providerForRequest === 'planner' ? 'Analyzing planning request' : providerForRequest === 'security' ? 'Analyzing security review' : 'Analyzing request',
            body: providerForRequest === 'researcher' ? 'Researcher is reviewing the research question and workspace context locally.' : providerForRequest === 'debugger' ? 'Debugger is reviewing the symptom, impact, and available evidence locally.' : providerForRequest === 'planner' ? 'Planner is reviewing local tasks, agents, sessions, and workspace context locally.' : providerForRequest === 'security' ? 'Security Review is reviewing the security target, severity threshold, and available evidence locally.' : 'Codi is reviewing the prompt and workspace context locally.',
          };
        case 'generating':
          return {
            title: providerForRequest === 'researcher' ? 'Drafting research response' : providerForRequest === 'debugger' ? 'Drafting debugging response' : providerForRequest === 'planner' ? 'Drafting planning response' : providerForRequest === 'security' ? 'Drafting security review' : 'Drafting response',
            body: providerForRequest === 'researcher' ? 'Researcher is composing the local evidence-backed response.' : providerForRequest === 'debugger' ? 'Debugger is composing the diagnosis, mitigation, and verification steps.' : providerForRequest === 'planner' ? 'Planner is composing task-board updates, handoffs, and monitoring guidance.' : providerForRequest === 'security' ? 'Security Review is composing severity-tagged findings, remediation, and verification steps.' : 'Codi is composing the local response.',
          };
        default:
          return {
            title: phase.charAt(0).toUpperCase() + phase.slice(1),
            body: phase,
          };
      }
    };

      const resolveDirectReasoningKind = (step: ReasoningStep): ProcessEntryKind => {
        if (step.kind === 'tool') {
          return step.toolResult ? 'tool-result' : 'tool-call';
        }
        return 'reasoning';
      };

      const resolveDirectReasoningActor = (step: ReasoningStep): string => {
        if (step.toolName) return step.toolName;
        if (step.kind === 'search') return 'search';
        return providerForRequest;
      };

      const syncReasoningProcessEntry = (step: ReasoningStep | undefined) => {
        if (!step) return;
        const processId = processIdByReasoningStepId.get(step.id);
        const kind = resolveDirectReasoningKind(step);
        const actor = resolveDirectReasoningActor(step);
        const summary = step.toolSummary ?? step.title;
        const transcript = step.transcript ?? step.body;
        const branchId = step.branchId ?? step.parentStepId ?? 'coordinator';
        if (processId) {
          processLog.update(processId, {
            kind,
            summary,
            transcript,
            payload: step,
            status: step.status,
            timeoutMs: step.timeoutMs,
          });
          return;
        }
        const nextProcessId = `reasoning:${step.id}`;
        processIdByReasoningStepId.set(step.id, nextProcessId);
        processLog.append({
          id: nextProcessId,
          kind,
          actor,
          summary,
          ...(transcript ? { transcript } : {}),
          payload: step,
          branchId,
          status: step.status,
          ts: step.startedAt,
          ...(step.timeoutMs !== undefined ? { timeoutMs: step.timeoutMs } : {}),
        });
      };

      const syncVoterProcessEntry = (step: VoterStep | undefined) => {
        if (!step) return;
        const processId = processIdByVoterStepId.get(step.id);
        const summary = step.approve === true
          ? `${step.voterId} ✓`
          : step.approve === false
            ? `${step.voterId} ✗`
            : `${step.voterId} reviewing`;
        const transcript = step.thought ?? step.body;
        if (processId) {
          processLog.update(processId, {
            summary,
            transcript,
            payload: step,
            status: step.status,
          });
          return;
        }
        const nextProcessId = `vote:${step.id}`;
        processIdByVoterStepId.set(step.id, nextProcessId);
        processLog.append({
          id: nextProcessId,
          kind: 'vote',
          actor: `voter:${step.voterId}`,
          summary,
          ...(transcript ? { transcript } : {}),
          payload: step,
          branchId: 'voters',
          ...(processLog.has(rawThinkingProcessId) ? { parentId: rawThinkingProcessId } : {}),
          status: step.status,
          ts: step.startedAt,
        });
      };

      const syncDirectBusProcessEntry = (entry: BusEntryStep) => {
        const kindMap: Record<string, ProcessEntryKind> = {
          Mail: 'mail',
          InfIn: 'inf-in',
          InfOut: 'inf-out',
          Intent: 'intent',
          Vote: 'vote',
          Commit: 'commit',
          Abort: 'abort',
          Result: 'result',
          Completion: 'completion',
          Policy: 'policy',
        };
        if (processLog.has(entry.id)) return;
        processLog.append({
          id: entry.id,
          kind: kindMap[entry.payloadType] ?? 'reasoning',
          actor: entry.actorId ?? entry.actor ?? providerForRequest,
          ...(entry.actorId ? { actorId: entry.actorId } : {}),
          ...(entry.actorRole ? { actorRole: entry.actorRole } : {}),
          ...(entry.parentActorId ? { parentActorId: entry.parentActorId } : {}),
          summary: entry.summary,
          transcript: entry.detail,
          payload: entry,
          branchId: entry.branchId ?? `agent:${providerForRequest}`,
          agentId: entry.actorId ?? providerForRequest,
          agentLabel: entry.agentLabel ?? getAgentDisplayName({ provider: providerForRequest }),
          modelId: entry.modelId ?? (runtimeProviderForRequest === 'ghcp' ? effectiveSelectedCopilotModelId : runtimeProviderForRequest === 'cursor' ? effectiveSelectedCursorModelId : effectiveSelectedModelId),
          modelProvider: entry.modelProvider ?? providerForRequest,
          status: 'done',
          ts: entry.realtimeTs,
        });
      };

      const syncRawThinkingProcessEntry = (status: 'active' | 'done') => {
        const transcript = thinkingBuffer.trim();
        if (!transcript) return;
        const summary = phaseStepTitle ?? 'Thinking';
        if (processLog.has(rawThinkingProcessId)) {
          processLog.update(rawThinkingProcessId, {
            summary,
            transcript,
            payload: { provider: providerForRequest, runtimeProvider: runtimeProviderForRequest, transcript },
            status,
          });
          return;
        }
        processLog.append({
          id: rawThinkingProcessId,
          kind: 'reasoning',
          actor: providerForRequest,
          summary,
          transcript,
          payload: { provider: providerForRequest, runtimeProvider: runtimeProviderForRequest, transcript },
          branchId: 'coordinator',
          status,
          ts: thinkingStart || Date.now(),
        });
      };

      const finalizeRawThinkingProcessEntry = () => {
        if (!processLog.has(rawThinkingProcessId)) return;
        syncRawThinkingProcessEntry('done');
      };

    const finalizePhaseStep = () => {
      if (!phaseStepId) return;
      reasoningSteps = patchReasoningStep(reasoningSteps, phaseStepId, {
        status: 'done',
        endedAt: Date.now(),
      });
        syncReasoningProcessEntry(reasoningSteps.find((step) => step.id === phaseStepId));
      phaseStepId = null;
      phaseStepTitle = null;
    };

    const syncPhaseStep = (phase: string) => {
      if (runtimeProviderForRequest !== 'codi' || hasStructuredReasoning || thinkingBuffer) return;
      ensureThinkingStarted();
      const meta = getPhaseStepMeta(phase);
      if (phaseStepId && phaseStepTitle === meta.title) {
        reasoningSteps = patchReasoningStep(reasoningSteps, phaseStepId, {
          title: meta.title,
          body: meta.body,
          status: 'active',
        });
        syncReasoningProcessEntry(reasoningSteps.find((step) => step.id === phaseStepId));
        return;
      }

      finalizePhaseStep();
      phaseStepId = createUniqueId();
      phaseStepTitle = meta.title;
      reasoningSteps = upsertReasoningStep(reasoningSteps, {
        id: phaseStepId,
        kind: 'thinking',
        title: meta.title,
        body: meta.body,
        startedAt: Date.now(),
        status: 'active',
      });
      syncReasoningProcessEntry(reasoningSteps.find((step) => step.id === phaseStepId));
    };

    const buildActivityPatch = (patch: Partial<ChatMessage> = {}): Partial<ChatMessage> => ({
      reasoningSteps: reasoningSteps.length ? reasoningSteps : undefined,
      voterSteps: voterSteps.length ? voterSteps : undefined,
      currentStepId: getActiveReasoningStepId(reasoningSteps),
      reasoningStartedAt: thinkingStart || undefined,
      thinkingContent: hasStructuredReasoning ? undefined : (thinkingBuffer || undefined),
      thinkingDuration: thinkingStart ? Math.max(1, Math.round((Date.now() - thinkingStart) / 1000)) : undefined,
      isThinking: Boolean(getActiveReasoningStepId(reasoningSteps)) || (!hasStructuredReasoning && Boolean(thinkingBuffer) && !tokenBuffer),
      isVoting: voterSteps.some((step) => step.status === 'active'),
      busEntries: busEntries.length ? busEntries : undefined,
      processEntries: processLog.snapshot(),
      ...patch,
    });

    reasoningSteps.forEach(syncReasoningProcessEntry);

    activeGenerationRef.current = {
      assistantId,
      sessionId: activeChatSessionId,
      cancel: () => controller.abort('Generation stopped.'),
      finalizeCancelled: () => {
        reasoningSteps = finalizeReasoningSteps(reasoningSteps);
        voterSteps = finalizeVoterSteps(voterSteps);
        finalizePhaseStep();
        reasoningSteps.forEach(syncReasoningProcessEntry);
        voterSteps.forEach(syncVoterProcessEntry);
        finalizeRawThinkingProcessEntry();
        const streamedContent = cleanStreamedAssistantContent(tokenBuffer);
        updateMessage(assistantId, buildActivityPatch({
          status: 'complete',
          statusText: 'stopped',
          isThinking: false,
          isVoting: false,
          loadingStatus: null,
          streamedContent: streamedContent || undefined,
          content: streamedContent ? '' : 'Response stopped.',
        }));
      },
    };
    setActiveGenerationSessionId(activeChatSessionId);
    if (reasoningSteps.length) {
      updateMessage(assistantId, buildActivityPatch({
        status: 'streaming',
        loadingStatus: null,
      }));
    }

    try {
      const streamCallbacks = {
        onPhase: (phase: string) => {
          syncPhaseStep(phase);
          updateMessage(assistantId, buildActivityPatch({ loadingStatus: phase }));
        },
        onReasoning: (content: string) => {
          ensureThinkingStarted();
          if (hasStructuredReasoning) return;
          finalizePhaseStep();
          thinkingBuffer += content;
          syncRawThinkingProcessEntry('active');
          updateMessage(assistantId, buildActivityPatch({ status: 'streaming', loadingStatus: null }));
        },
        onReasoningStep: (step: ReasoningStep) => {
          ensureThinkingStarted();
          finalizePhaseStep();
          finalizeRawThinkingProcessEntry();
          hasStructuredReasoning = true;
          reasoningSteps = upsertReasoningStep(reasoningSteps, step);
          syncReasoningProcessEntry(reasoningSteps.find((candidate) => candidate.id === step.id));
          updateMessage(assistantId, buildActivityPatch({ status: 'streaming', loadingStatus: null }));
        },
        onReasoningStepUpdate: (id: string, patch: Partial<ReasoningStep>) => {
          ensureThinkingStarted();
          finalizePhaseStep();
          finalizeRawThinkingProcessEntry();
          hasStructuredReasoning = true;
          reasoningSteps = patchReasoningStep(reasoningSteps, id, patch);
          syncReasoningProcessEntry(reasoningSteps.find((step) => step.id === id));
          updateMessage(assistantId, buildActivityPatch({ status: 'streaming', loadingStatus: null }));
        },
        onReasoningStepEnd: (id: string) => {
          reasoningSteps = patchReasoningStep(reasoningSteps, id, { status: 'done', endedAt: Date.now() });
          syncReasoningProcessEntry(reasoningSteps.find((step) => step.id === id));
          updateMessage(assistantId, buildActivityPatch({ status: 'streaming', loadingStatus: null }));
        },
        onVoterStep: (step: VoterStep) => {
          voterSteps = upsertVoterStep(voterSteps, step);
          syncVoterProcessEntry(voterSteps.find((candidate) => candidate.id === step.id));
          updateMessage(assistantId, buildActivityPatch({ status: 'streaming', loadingStatus: null }));
        },
        onVoterStepUpdate: (id: string, patch: Partial<VoterStep>) => {
          voterSteps = patchVoterStep(voterSteps, id, patch);
          syncVoterProcessEntry(voterSteps.find((step) => step.id === id));
          updateMessage(assistantId, buildActivityPatch({ status: 'streaming', loadingStatus: null }));
        },
        onVoterStepEnd: (id: string) => {
          voterSteps = patchVoterStep(voterSteps, id, { status: 'done', endedAt: Date.now() });
          syncVoterProcessEntry(voterSteps.find((step) => step.id === id));
          updateMessage(assistantId, buildActivityPatch({ status: 'streaming', loadingStatus: null }));
        },
        onBusEntry: (entry: BusEntryStep) => {
          busEntries = [...busEntries, entry];
          syncDirectBusProcessEntry(entry);
          updateMessage(assistantId, buildActivityPatch({ status: 'streaming', loadingStatus: null }));
        },
        onTourPlan: (plan: ChatMessage['tourPlan']) => {
          if (!plan) return;
          const result = startDriverTour(plan);
          if (!result.started) {
            onToast({ msg: result.error ?? 'Unable to start guided tour', type: 'error' });
          }
          updateMessage(assistantId, buildActivityPatch({
            status: 'streaming',
            loadingStatus: null,
            tourPlan: plan,
          }));
        },
        onToken: (content: string) => {
          finalizePhaseStep();
          finalizeRawThinkingProcessEntry();
          tokenBuffer += content;
          updateMessage(assistantId, buildActivityPatch({
            status: 'streaming',
            streamedContent: cleanStreamedAssistantContent(tokenBuffer),
            loadingStatus: null,
          }));
        },
        onDone: (finalContent?: string) => {
          finalizePhaseStep();
          reasoningSteps = finalizeReasoningSteps(reasoningSteps);
          voterSteps = finalizeVoterSteps(voterSteps);
          reasoningSteps.forEach(syncReasoningProcessEntry);
          voterSteps.forEach(syncVoterProcessEntry);
          finalizeRawThinkingProcessEntry();
          const resolvedContent = cleanStreamedAssistantContent(finalContent ?? tokenBuffer);
          updateMessage(assistantId, buildActivityPatch({
            status: 'complete',
            isThinking: false,
            isVoting: false,
            loadingStatus: null,
            streamedContent: resolvedContent || undefined,
            content: resolvedContent ? '' : (
              providerForRequest === 'researcher'
                ? 'Researcher returned an empty response.'
                : providerForRequest === 'debugger'
                  ? 'Debugger returned an empty response.'
                : providerForRequest === 'planner'
                  ? 'Planner returned an empty response.'
                : providerForRequest === 'security'
                  ? 'Security Review returned an empty response.'
                : providerForRequest === 'tour-guide'
                  ? 'Tour Guide returned an empty response.'
                : runtimeProviderForRequest === 'ghcp'
                  ? 'GHCP returned an empty response.'
                : runtimeProviderForRequest === 'cursor'
                  ? 'Cursor returned an empty response.'
                : runtimeProviderForRequest === 'codex'
                  ? 'Codex returned an empty response.'
                : 'Codi returned an empty response.'
            ),
          }));
          notifyAssistantComplete(assistantId, resolvedContent || (
            providerForRequest === 'researcher'
              ? 'Researcher returned an empty response.'
              : providerForRequest === 'debugger'
                ? 'Debugger returned an empty response.'
              : providerForRequest === 'planner'
                ? 'Planner returned an empty response.'
              : providerForRequest === 'security'
                ? 'Security Review returned an empty response.'
              : providerForRequest === 'tour-guide'
                ? 'Tour Guide returned an empty response.'
              : runtimeProviderForRequest === 'ghcp'
                ? 'GHCP returned an empty response.'
              : runtimeProviderForRequest === 'cursor'
                ? 'Cursor returned an empty response.'
              : runtimeProviderForRequest === 'codex'
                ? 'Codex returned an empty response.'
                : 'Codi returned an empty response.'
          ));
        },
        onError: (error: Error) => {
          finalizePhaseStep();
          reasoningSteps = finalizeReasoningSteps(reasoningSteps);
          voterSteps = finalizeVoterSteps(voterSteps);
          reasoningSteps.forEach(syncReasoningProcessEntry);
          voterSteps.forEach(syncVoterProcessEntry);
          finalizeRawThinkingProcessEntry();
          updateMessage(assistantId, buildActivityPatch({ status: 'error', content: error.message, loadingStatus: null }));
        },
      };

      await streamAgentChat({
        provider: providerForRequest,
        runtimeProvider: runtimeProviderForRequest,
        model: requestLocalModel,
        modelId: runtimeProviderForRequest === 'cursor'
          ? effectiveSelectedCursorModelId
          : runtimeProviderForRequest === 'codex'
            ? effectiveSelectedCodexModelId
            : requestGhcpModelId,
        sessionId: activeChatSessionId,
        latestUserInput: text,
        messages: nextMessages,
        workspaceName,
        workspacePromptContext: requestWorkspacePromptContext,
        voters: codiVoters,
        secretSettings,
      }, streamCallbacks, controller.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      onToast({ msg: error instanceof Error ? error.message : 'Agent request failed', type: 'error' });
    } finally {
      clearActiveGeneration(assistantId);
    }
  }, [activeChatSessionId, activeLocalModel, adversaryToolReviewSettings, appendSharedMessages, benchmarkRoutingCandidates, benchmarkRoutingSettings, clearActiveGeneration, codexState, copilotState, cursorState, effectiveSelectedCodexModelId, effectiveSelectedCopilotModelId, effectiveSelectedCursorModelId, effectiveSelectedModelId, evaluationAgents, getSessionBash, hasAvailableCodexModels, hasAvailableCopilotModels, hasAvailableCursorModels, installedModels, negativeRubricTechniques, notifyAssistantComplete, onNegativeRubricTechnique, onPartnerAgentAuditEntry, onTerminalFsPathsChanged, onToast, partnerAgentControlPlaneSettings, resetActiveInputHistoryCursor, runSandboxPrompt, secretSettings, securityReviewAgentSettings, selectedProvider, selectedToolIds, setBashHistoryBySession, toolsEnabled, webMcpBridge, workspaceName, workspacePromptContext]);

  const handleElicitationSubmit = useCallback((messageId: string, requestId: string, values: Record<string, string>) => {
    const locationValue = values.location?.trim() || Object.values(values).find((value) => value.trim())?.trim() || '';
    if (!locationValue) return;
    upsertUserContextMemory(workspaceName, {
      id: 'location',
      label: 'Location',
      value: locationValue,
      source: 'workspace-memory',
    });
    setMessagesBySession((current) => {
      const sessionMessages = current[activeChatSessionId] ?? [createSystemChatMessage(activeChatSessionId)];
      const nextMessages = sessionMessages.map((message) => (
        message.id === messageId
          ? {
            ...message,
            cards: (message.cards ?? []).map((card) => (
              card.requestId === requestId
                ? { ...card, status: 'submitted' as const, response: values }
                : card
            )),
          }
          : message
      ));
      messagesRef.current = nextMessages;
      return { ...current, [activeChatSessionId]: nextMessages };
    });
    void sendMessage(`Location: ${locationValue}`);
  }, [activeChatSessionId, sendMessage, workspaceName]);

  const handleSecretSubmit = useCallback(async (
    messageId: string,
    requestId: string,
    { name, value }: { name: string; value: string },
  ) => {
    const secretName = name.trim() || 'API_KEY';
    if (!value) return;
    const secretRef = await getDefaultSecretsManagerAgent().storeSecret({ name: secretName, value });
    const result: SecretRequestCreatedResult = {
      status: 'secret_ref_created',
      requestId,
      name: secretName,
      secretRef,
    };
    pendingSecretRequestResolvers.get(requestId)?.(result);
    pendingSecretRequestResolvers.delete(requestId);
    setMessagesBySession((current) => {
      const sessionMessages = current[activeChatSessionId] ?? [createSystemChatMessage(activeChatSessionId)];
      const nextMessages = sessionMessages.map((message) => (
        message.id === messageId
          ? {
            ...message,
            cards: (message.cards ?? []).map((card) => (
              card.requestId === requestId
                ? {
                  ...card,
                  status: 'submitted' as const,
                  secretName,
                  secretRef,
                  response: { name: secretName, secretRef },
                }
                : card
            )),
          }
          : message
      ));
      messagesRef.current = nextMessages;
      return { ...current, [activeChatSessionId]: nextMessages };
    });
    void onSecretRecordsChanged?.();
    onToast({ msg: 'Secret saved', type: 'success' });
  }, [activeChatSessionId, onSecretRecordsChanged, onToast, setMessagesBySession]);

  const handleChatInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSkillAutocompleteOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedSkillSuggestionIndex((current) => Math.min(current + 1, skillSuggestions.length - 1));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedSkillSuggestionIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        event.preventDefault();
        const selectedSkill = skillSuggestions[selectedSkillSuggestionIndex];
        if (selectedSkill) {
          applySkillSuggestion(selectedSkill.name);
        }
        return;
      }
    }

    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && shouldHandleTextareaHistoryKey(event)) {
      if (navigateInputHistory(event.key === 'ArrowUp' ? 'up' : 'down')) {
        event.preventDefault();
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (isActiveSessionGenerating) {
        stopActiveGeneration();
        return;
      }
      if (canSubmit) void sendMessage(input);
    }
  }, [applySkillSuggestion, canSubmit, input, isActiveSessionGenerating, isSkillAutocompleteOpen, navigateInputHistory, selectedSkillSuggestionIndex, sendMessage, skillSuggestions, stopActiveGeneration]);

  const runTerminalCommand = useCallback(async (command: string) => {
    const cmd = command.trim();
    if (!cmd || !activeSessionId) return;

    if (cmd === 'clear') {
      setBashHistoryBySession((current) => ({ ...current, [activeSessionId]: [] }));
      const clearedMessages = messagesRef.current.filter((message) => !message.statusText?.startsWith('terminal'));
      messagesRef.current = clearedMessages;
      setMessagesBySession((current) => ({ ...current, [activeChatSessionId]: clearedMessages }));
      setInput('');
      requestAnimationFrame(() => terminalInputRef.current?.focus());
      return;
    }

    setInput('');

    try {
      await executeCliCommand({
        appendSharedMessages,
        getSessionBash,
        notifyTerminalFsPathsChanged: onTerminalFsPathsChanged,
        sessionId: activeSessionId,
        setBashHistoryBySession,
        setCwdBySession,
      }, cmd, { emitMessages: true });
    } catch (error) {
      // executeCliCommand already appends terminal error output
    } finally {
      requestAnimationFrame(() => terminalInputRef.current?.focus());
    }
  }, [activeSessionId, appendSharedMessages, getSessionBash, onTerminalFsPathsChanged]);

  const getSessionRuntimeState = useCallback((): SessionMcpRuntimeState => ({
    mode: activeModeRef.current,
    provider: selectedProviderRef.current ?? null,
    modelId: (
      selectedProviderRef.current === 'ghcp'
        ? effectiveSelectedCopilotModelIdRef.current
        : selectedProviderRef.current === 'cursor'
          ? effectiveSelectedCursorModelIdRef.current
        : selectedProviderRef.current === 'codex'
          ? effectiveSelectedCodexModelIdRef.current
        : effectiveSelectedModelIdRef.current
    ) || null,
    agentId: null,
    toolIds: [...selectedToolIdsRef.current],
    cwd: activeSessionId ? (cwdBySessionRef.current[activeSessionId] ?? BASH_INITIAL_CWD) : BASH_INITIAL_CWD,
    messages: messagesRef.current.map((message) => ({
      role: message.role,
      content: message.streamedContent || message.content,
      ...(message.status ? { status: message.status } : {}),
    })),
  }), [activeSessionId]);

  useEffect(() => {
    if (!activeSessionId || !onSessionRuntimeChange) {
      return;
    }
    onSessionRuntimeChange(activeSessionId, getSessionRuntimeState());
  }, [
    activeMode,
    activeSessionId,
    cwdBySession,
    effectiveSelectedCopilotModelId,
    effectiveSelectedCursorModelId,
    effectiveSelectedCodexModelId,
    effectiveSelectedModelId,
    getSessionRuntimeState,
    messages,
    onSessionRuntimeChange,
    selectedProvider,
    selectedToolIds,
  ]);

  useEffect(() => {
    if (!activeSessionId || !onSessionRuntimeChange) {
      return undefined;
    }
    return () => onSessionRuntimeChange(activeSessionId, null);
  }, [activeSessionId, onSessionRuntimeChange]);

  const applySessionWrite = useCallback(async (input: WorkspaceMcpWriteSessionInput) => {
    if (!activeSessionId || input.sessionId !== activeSessionId) {
      throw new DOMException(`Session "${input.sessionId}" is not the current chat panel session.`, 'NotFoundError');
    }

    const nextProvider = typeof input.provider === 'string' && input.provider.trim()
      ? input.provider.trim() as AgentProvider
      : undefined;
    if (nextProvider && nextProvider !== selectedProviderRef.current) {
      selectedProviderRef.current = nextProvider;
      setSelectedProviderBySession((current) => ({ ...current, [activeChatSessionId]: nextProvider }));
    }

    const resolvedProvider = nextProvider ?? selectedProviderRef.current;
    if (typeof input.modelId === 'string' && input.modelId.trim()) {
      const nextModelId = input.modelId.trim();
      if (resolvedProvider === 'ghcp') {
        effectiveSelectedCopilotModelIdRef.current = nextModelId;
        setSelectedCopilotModelBySession((current) => ({ ...current, [activeChatSessionId]: nextModelId }));
      } else if (resolvedProvider === 'cursor') {
        effectiveSelectedCursorModelIdRef.current = nextModelId;
        setSelectedCursorModelBySession((current) => ({ ...current, [activeChatSessionId]: nextModelId }));
      } else if (resolvedProvider === 'codex') {
        effectiveSelectedCodexModelIdRef.current = nextModelId;
        setSelectedCodexModelBySession((current) => ({ ...current, [activeChatSessionId]: nextModelId }));
      } else {
        effectiveSelectedModelIdRef.current = nextModelId;
        setSelectedModelBySession((current) => ({ ...current, [activeChatSessionId]: nextModelId }));
      }
    }

    if (Array.isArray(input.toolIds)) {
      const nextToolIds = input.toolIds.filter((toolId): toolId is string => typeof toolId === 'string');
      selectedToolIdsRef.current = nextToolIds;
      setSelectedToolIdsBySession((current) => ({ ...current, [activeChatSessionId]: nextToolIds }));
    }

    if (input.mode && input.mode !== activeModeRef.current) {
      if (input.mode === 'terminal' && !Array.isArray(input.toolIds) && !selectedToolIdsRef.current.includes('cli')) {
        const nextToolIds = ['cli', ...selectedToolIdsRef.current];
        selectedToolIdsRef.current = nextToolIds;
        setSelectedToolIdsBySession((current) => ({ ...current, [activeChatSessionId]: nextToolIds }));
      }
      activeModeRef.current = input.mode;
      onSwitchMode(input.mode);
    }

    if (typeof input.cwd === 'string' && input.cwd.trim()) {
      await executeCliCommand({
        appendSharedMessages,
        getSessionBash,
        notifyTerminalFsPathsChanged: onTerminalFsPathsChanged,
        sessionId: activeSessionId,
        setBashHistoryBySession,
        setCwdBySession,
      }, `cd -- ${quoteShellArg(input.cwd.trim())}`, { emitMessages: false });
    }

    if (typeof input.message === 'string' && input.message.trim()) {
      setPendingMcpMessage(input.message);
    }
  }, [activeChatSessionId, activeSessionId, appendSharedMessages, getSessionBash, onSwitchMode, onTerminalFsPathsChanged]);

  useEffect(() => {
    if (!pendingMcpMessage) {
      return;
    }
    if (activeGenerationRef.current) {
      return;
    }

    const nextMessage = pendingMcpMessage;
    setPendingMcpMessage(null);
    void sendMessage(nextMessage);
  }, [pendingMcpMessage, sendMessage]);

  useEffect(() => {
    if (!activeSessionId || !onSessionMcpControllerChange) {
      return undefined;
    }

    onSessionMcpControllerChange(activeSessionId, {
      getRuntimeState: getSessionRuntimeState,
      writeSession: applySessionWrite,
    });

    return () => onSessionMcpControllerChange(activeSessionId, null);
  }, [activeSessionId, applySessionWrite, getSessionRuntimeState, onSessionMcpControllerChange]);

  useEffect(() => {
    if (!pendingSearch) {
      consumedPendingSearchRef.current = null;
      return;
    }
    if (activeGenerationRef.current) {
      return;
    }
    if (consumedPendingSearchRef.current === pendingSearch) return;
    consumedPendingSearchRef.current = pendingSearch;
    setInput(`Search the web for: ${pendingSearch}`);
    requestAnimationFrame(() => chatInputRef.current?.focus());
    onSearchConsumed();
  }, [activeGenerationSessionId, onSearchConsumed, pendingSearch]);

  const handleCopyMessage = useCallback(async ({ content, senderLabel, format }: { content: string; senderLabel: string; format: ClipboardCopyFormat }) => {
    try {
      await onCopyToClipboard(
        formatMessageCopyContent(content, format),
        createMessageCopyLabel(senderLabel, format),
      );
      onToast({ msg: `Message copied as ${format}`, type: 'success' });
    } catch {
      onToast({ msg: 'Failed to copy message', type: 'error' });
    }
  }, [onCopyToClipboard, onToast]);

  const browserNotificationsEnabled = browserNotificationSettings.enabled && browserNotificationPermission === 'granted';

  return (
    <section className={`chat-panel shared-console ${showBash ? 'mode-terminal' : 'mode-chat'}`} aria-label={showBash ? 'Terminal' : 'Chat panel'}>
      <header className={`chat-header shared-console-header panel-titlebar${dragHandleProps ? ' panel-titlebar--draggable' : ''}`} {...dragHandleProps}>
        <div className="chat-heading">
          <span className="panel-eyebrow panel-resource-eyebrow">
            <Icon name="layers" size={12} color="#8fa6c4" />
            <span className="panel-resource-label">workspace/{workspaceName}</span>
            <span className="panel-resource-path">{workspacePath}</span>
          </span>
          <div className="chat-title-row">
            <Icon name={showBash ? 'terminal' : 'sparkles'} size={15} color={showBash ? '#86efac' : '#d1fae5'} />
            <h2>{showBash ? 'Terminal' : 'Chat'}</h2>
            {!showBash && (
              <>
                <label className="header-model-selector" {...panelTitlebarControlProps}>
                  <select aria-label="Agent provider" value={selectedProvider} onChange={(event) => setSelectedProviderBySession((current) => ({ ...current, [activeChatSessionId]: event.target.value as AgentProvider }))} {...panelTitlebarControlProps}>
                    <option value="codi">Codi</option>
                    <option value="ghcp">GHCP</option>
                    <option value="cursor">Cursor</option>
                    <option value="codex">Codex</option>
                    <option value="researcher">Researcher</option>
                    <option value="debugger">Debugger</option>
                    <option value="planner">Planner</option>
                    <option value="security">Security Review</option>
                    <option value="tour-guide">Tour Guide</option>
                  </select>
                </label>
                {selectedProvider === 'tour-guide'
                  ? null
                  : selectedRuntimeProvider === 'ghcp'
                    ? (hasAvailableCopilotModels
                        ? (
                          <label className="header-model-selector" {...panelTitlebarControlProps}>
                            <select aria-label="GHCP model" value={effectiveSelectedCopilotModelId} onChange={(event) => setSelectedCopilotModelBySession((current) => ({ ...current, [activeChatSessionId]: event.target.value }))} {...panelTitlebarControlProps}>
                              {copilotState.models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                            </select>
                          </label>
                        )
                        : (
                          <button type="button" className="header-model-selector install-model-btn" onClick={onOpenModels} {...panelTitlebarControlProps}>
                            {copilotState.authenticated ? 'GHCP models' : 'Sign in'}
                          </button>
                        ))
                    : selectedRuntimeProvider === 'cursor'
                      ? (hasAvailableCursorModels
                          ? (
                            <label className="header-model-selector" {...panelTitlebarControlProps}>
                              <select aria-label="Cursor model" value={effectiveSelectedCursorModelId} onChange={(event) => setSelectedCursorModelBySession((current) => ({ ...current, [activeChatSessionId]: event.target.value }))} {...panelTitlebarControlProps}>
                                {cursorState.models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                              </select>
                            </label>
                          )
                          : (
                            <button type="button" className="header-model-selector install-model-btn" onClick={onOpenModels} {...panelTitlebarControlProps}>
                              {cursorState.authenticated ? 'Cursor models' : 'Set key'}
                            </button>
                          ))
                      : selectedRuntimeProvider === 'codex'
                        ? (hasAvailableCodexModels
                            ? (
                              <label className="header-model-selector" {...panelTitlebarControlProps}>
                                <select aria-label="Codex model" value={effectiveSelectedCodexModelId} onChange={(event) => setSelectedCodexModelBySession((current) => ({ ...current, [activeChatSessionId]: event.target.value }))} {...panelTitlebarControlProps}>
                                  {codexState.models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                                </select>
                              </label>
                            )
                            : (
                              <button type="button" className="header-model-selector install-model-btn" onClick={onOpenModels} {...panelTitlebarControlProps}>
                                {codexState.authenticated ? 'Codex models' : 'Sign in'}
                              </button>
                            ))
                        : (hasInstalledModels
                            ? (
                              <label className="header-model-selector" {...panelTitlebarControlProps}>
                                <select aria-label="Codi model" value={effectiveSelectedModelId} onChange={(event) => setSelectedModelBySession((current) => ({ ...current, [activeChatSessionId]: event.target.value }))} {...panelTitlebarControlProps}>
                                  {installedModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                                </select>
                              </label>
                            )
                            : (
                              <button type="button" className="header-model-selector install-model-btn" onClick={onOpenModels} {...panelTitlebarControlProps}>Install model</button>
                            ))}
                <BenchmarkRouteBadge route={currentBenchmarkRoute} />
                <ToolsPicker
                  descriptors={toolDescriptors}
                  selectedIds={selectedToolIds}
                  onChange={setSelectedToolIdsForActiveSession}
                />
              </>
            )}
          </div>
        </div>
        <div className="panel-titlebar-actions">
          {!showBash ? (
            <>
              <button
                type="button"
                className={`icon-button${browserLocationContext.enabled ? ' is-active' : ''}`}
                aria-label={browserLocationContext.enabled ? 'Disable location context' : 'Enable location context'}
                title={browserLocationContext.enabled ? 'Disable location context' : 'Enable location context'}
                data-tooltip={
                  browserLocationContext.enabled
                    ? 'Location context on'
                    : browserLocationApi
                      ? 'Location context off'
                      : 'Location unavailable'
                }
                onClick={() => void handleToggleLocationContext()}
                disabled={!browserLocationApi && !browserLocationContext.enabled}
                {...panelTitlebarControlProps}
              >
                <Icon name={browserLocationContext.enabled ? 'mapPin' : 'mapPinOff'} size={13} />
              </button>
              <button
                type="button"
                className={`icon-button${browserNotificationSettings.enabled ? ' is-active' : ''}`}
                aria-label={browserNotificationSettings.enabled ? 'Disable browser notifications' : 'Enable browser notifications'}
                title={browserNotificationSettings.enabled ? 'Disable browser notifications' : 'Enable browser notifications'}
                data-tooltip={
                  browserNotificationSettings.enabled
                    ? browserNotificationsEnabled
                      ? 'Notifications on'
                      : 'Notifications blocked in browser settings'
                    : 'Notifications off'
                }
                onClick={() => void handleToggleBrowserNotifications()}
                {...panelTitlebarControlProps}
              >
                <Icon name={browserNotificationSettings.enabled ? 'bell' : 'bellOff'} size={13} />
              </button>
            </>
          ) : null}
          <div className="chat-mode-controls">
            <button
              type="button"
              className={`mode-tab mode-action mode-tab-icon${sharedChatApi?.active ? ' active' : ''}`}
              aria-label="Share chat session"
              title="Share chat session"
              data-tooltip={sharedChatApi?.confirmed ? 'Shared session active' : 'Share'}
              onClick={() => setShareDialogOpen(true)}
              {...panelTitlebarControlProps}
            >
              <Share2 size={13} />
            </button>
            <div className="chat-mode-tabs" role="tablist" aria-label="Panel mode">
              <button type="button" role="tab" aria-selected={!showBash} aria-label="Chat mode" title="Chat mode" data-tooltip="Chat" className={`mode-tab mode-tab-icon ${!showBash ? 'active' : ''}`} onClick={() => onSwitchMode('agent')} {...panelTitlebarControlProps}><Icon name="sparkles" size={14} /></button>
              <button type="button" role="tab" aria-selected={showBash} aria-label="Terminal mode" title="Terminal mode" data-tooltip="Terminal" className={`mode-tab mode-tab-icon ${showBash ? 'active' : ''}`} onClick={() => onSwitchMode('terminal')} {...panelTitlebarControlProps}><Icon name="terminal" size={14} /></button>
            </div>
            <button type="button" className="mode-tab mode-action mode-tab-icon" aria-label="New session" title="New session" data-tooltip="New session" onClick={onNewSession} {...panelTitlebarControlProps}><Icon name="plus" size={13} /></button>
          </div>
          <button type="button" className="icon-button panel-close-button" aria-label={showBash ? 'Close terminal panel' : 'Close chat panel'} onClick={onClose} {...panelTitlebarControlProps}><Icon name="x" size={12} /></button>
        </div>
      </header>
      <SharedChatModal
        open={shareDialogOpen}
        sessionId={activeChatSessionId}
        workspaceName={workspaceName}
        onClose={() => setShareDialogOpen(false)}
        onApiChange={handleSharedChatApiChange}
        onRemoteMessage={appendRemoteSharedChatMessage}
        onStatusMessage={appendSharedChatStatus}
        onToast={(msg, type) => onToast({ msg, type })}
        onCopyToClipboard={onCopyToClipboard}
      />
      <div className="shared-console-body">
        <div className="shared-console-main">
          {!showBash && activeActivityMessage ? (
            <ProcessPanel message={activeActivityMessage} onClose={() => setActiveActivityBySession((current) => ({ ...current, [activeChatSessionId]: null }))} />
          ) : null}
          {!showBash && sharedChatApi?.active ? (
            <div className="shared-chat-active-banner">
              <span>Shared session active</span>
              <strong>{sharedChatApi.confirmed ? 'Pairing confirmed' : 'Pairing pending'}</strong>
              <button type="button" className="secondary-button" onClick={() => void sharedChatApi.endSession()}>End session</button>
            </div>
          ) : null}
          <div className="message-list" role="log" aria-live="polite" aria-label={showBash ? 'Terminal output' : 'Chat transcript'}>
            {messages.map((message) => <ChatMessageView key={message.id} message={message} agentName={getAgentDisplayName({ provider: selectedProvider, activeCodiModelName: activeLocalModel?.name, activeGhcpModelName: activeCopilotModel?.name, activeCursorModelName: activeCursorModel?.name, activeCodexModelName: activeCodexModel?.name, researcherRuntimeProvider: selectedRuntimeProvider })} activitySelected={message.id === activeActivityMessageId} onOpenActivity={selectActivityMessage} onSubmitElicitation={handleElicitationSubmit} onSubmitSecret={handleSecretSubmit} onCopyMessage={handleCopyMessage} />)}
            <div ref={bottomRef} />
          </div>
          <div className="context-strip">Context: {contextSummary}</div>
          {showBash ? (
            <form className="chat-compose terminal-compose" onSubmit={(event) => { event.preventDefault(); void runTerminalCommand(input); }}>
              <div className="terminal-compose-row">
                <span className="bash-prompt">$</span>
                <input
                  ref={terminalInputRef}
                  className="bash-input"
                  aria-label="Bash input"
                  value={input}
                  onChange={(event) => handleInputChange(event.target.value)}
                  onKeyDown={handleTerminalInputKeyDown}
                  placeholder={activeSessionId ? 'type a command…' : 'create or select a session'}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={!activeSessionId}
                />
              </div>
            </form>
          ) : (
            <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); if (isActiveSessionGenerating) { stopActiveGeneration(); return; } void sendMessage(input); }}>
              <div className="composer-rail">
                <label className="composer-input-shell shared-input-shell">
                  <textarea
                    ref={chatInputRef}
                    aria-label="Chat input"
                    aria-autocomplete="list"
                    aria-controls={isSkillAutocompleteOpen ? 'chat-skill-suggestions' : undefined}
                    value={input}
                    onChange={(event) => handleInputChange(event.target.value)}
                    placeholder={getAgentInputPlaceholder({ provider: selectedProvider, hasCodiModelsReady: hasInstalledModels, hasGhcpModelsReady: hasAvailableCopilotModels, hasCursorModelsReady: hasAvailableCursorModels, hasCodexModelsReady: hasAvailableCodexModels })}
                    rows={1}
                    onKeyDown={handleChatInputKeyDown}
                  />
                  <button
                    type="submit"
                    className={`composer-send-btn${isActiveSessionGenerating ? ' composer-send-btn-stop' : ''}`}
                    aria-label={isActiveSessionGenerating ? 'Stop response' : 'Send'}
                    title={isActiveSessionGenerating ? 'Stop response' : 'Send'}
                    disabled={!isActiveSessionGenerating && !canSubmit}
                  >
                    {isActiveSessionGenerating ? <Square size={13} fill="currentColor" /> : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 13V3M8 3L4 7M8 3L12 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </button>
                </label>
                {isSkillAutocompleteOpen ? (
                  <div id="chat-skill-suggestions" className="composer-suggestions" role="listbox" aria-label="Skill suggestions">
                    {skillSuggestions.map((skill, index) => (
                      <button
                        key={skill.name}
                        type="button"
                        role="option"
                        aria-label={skill.name}
                        aria-selected={index === selectedSkillSuggestionIndex}
                        className={`composer-suggestion${index === selectedSkillSuggestionIndex ? ' is-selected' : ''}`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          applySkillSuggestion(skill.name);
                        }}
                        onClick={() => applySkillSuggestion(skill.name)}
                      >
                        <span className="composer-suggestion-name">{skill.name}</span>
                        <span className="composer-suggestion-description">{skill.description}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {selectedRuntimeProvider === 'ghcp'
                ? (!hasAvailableCopilotModels
                    ? <button type="button" className="composer-status composer-status-action" onClick={onOpenModels}>{copilotState.authenticated ? 'GHCP has no enabled models. Open Models.' : 'GHCP needs sign-in. Open Models.'}</button>
                    : null)
                : selectedRuntimeProvider === 'cursor'
                  ? (!hasAvailableCursorModels
                    ? <button type="button" className="composer-status composer-status-action" onClick={onOpenModels}>{cursorState.authenticated ? 'Cursor has no enabled models. Open Models.' : 'Cursor needs CURSOR_API_KEY. Open Models.'}</button>
                    : null)
                : selectedRuntimeProvider === 'codex'
                  ? (!hasAvailableCodexModels
                      ? <button type="button" className="composer-status composer-status-action" onClick={onOpenModels}>{codexState.authenticated ? 'Codex has no enabled models. Open Models.' : 'Codex needs sign-in. Open Models.'}</button>
                      : null)
                : selectedProvider === 'tour-guide'
                  ? null
                  : (!hasInstalledModels ? <button type="button" className="composer-status composer-status-action" onClick={onOpenModels}>{selectedProvider === 'researcher' ? 'Researcher needs GHCP, Cursor, or Codi. Open Models.' : selectedProvider === 'debugger' ? 'Debugger needs GHCP, Cursor, or Codi. Open Models.' : selectedProvider === 'planner' ? 'Planner needs GHCP, Cursor, or Codi. Open Models.' : selectedProvider === 'security' ? 'Security Review needs GHCP, Cursor, or Codi. Open Models.' : 'No Codi model loaded. Open Models to load one.'}</button> : null)}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function ModelCard({ model, isInstalled, isLoading, onInstall, onDelete }: { model: HFModel; isInstalled: boolean; isLoading: boolean; onInstall: () => void; onDelete?: () => void }) {
  const taskLabel = HF_TASK_LABELS[model.task] ?? model.task;
  return (
    <div className="model-card">
      <div className="model-card-icon"><Icon name="layers" size={15} color={isInstalled ? '#34d399' : '#60a5fa'} /></div>
      <div className="model-card-body">
        <strong>{model.name}</strong>
        <span className="chip mini">{taskLabel}</span>
        <p>{model.author}</p>
        <small>{model.downloads.toLocaleString()} downloads · {model.likes.toLocaleString()} likes{model.sizeMB > 0 ? ` · ${model.sizeMB >= 1000 ? (model.sizeMB / 1000).toFixed(1) + 'GB' : model.sizeMB + 'MB'}` : ''}</small>
      </div>
      {isInstalled ? (
        <div className="model-card-actions">
          <StatusIndicator active label={`${model.name} installed`} />
          <span className="sr-only">Installed</span>
          {onDelete && (
            <button
              type="button"
              className="sidebar-icon-button"
              aria-label={`Remove ${model.name}`}
              title={`Remove ${model.name}`}
              onClick={onDelete}
            >
              <Icon name="trash" size={13} />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="sidebar-icon-button"
          aria-label={`${model.name} ${isLoading ? 'Loading' : 'Load'}`}
          title={`${isLoading ? 'Loading' : 'Load'} ${model.name}`}
          onClick={onInstall}
          disabled={isLoading}
        >
          <Icon name={isLoading ? 'loader' : 'download'} size={13} className={isLoading ? 'spin' : ''} />
          <span className="sr-only">{isLoading ? 'Loading…' : 'Load'}</span>
        </button>
      )}
    </div>
  );
}

function CopilotModelCard({ model }: { model: CopilotModelSummary }) {
  return (
    <div className="model-card copilot-model-card">
      <div className="model-card-icon"><Icon name="sparkles" size={15} color="#7dd3fc" /></div>
      <div className="model-card-body">
        <strong>{model.name}</strong>
        <div className="copilot-model-meta">
          <span className="chip mini">{model.id}</span>
          {model.reasoning ? <span className="chip mini">Reasoning</span> : null}
          {model.vision ? <span className="chip mini">Vision</span> : null}
          {typeof model.billingMultiplier === 'number' ? <span className="chip mini">{model.billingMultiplier}x billing</span> : null}
        </div>
        <p>{model.policyState ? `Policy: ${model.policyState}` : 'Enabled for this Copilot account.'}</p>
      </div>
      <StatusIndicator active label={`${model.name} enabled`} />
    </div>
  );
}

function BenchmarkRoutingSettingsPanel({
  settings,
  candidates,
  evidenceState,
  onChange,
}: {
  settings: BenchmarkRoutingSettings;
  candidates: BenchmarkRoutingCandidate[];
  evidenceState: BenchmarkEvidenceDiscoveryState;
  onChange: (settings: BenchmarkRoutingSettings) => void;
}) {
  const setPin = (taskClass: BenchmarkTaskClassId, value: string) => {
    const pins = { ...settings.pins };
    if (value === 'auto') {
      delete pins[taskClass];
    } else {
      pins[taskClass] = value as BenchmarkModelRef;
    }
    onChange({ ...settings, pins });
  };
  const candidateOptions = candidates.map((candidate) => {
    const { provider } = splitBenchmarkModelRef(candidate.ref);
    return {
      value: candidate.ref,
      label: `${provider.toUpperCase()} · ${candidate.label}`,
    };
  });

  return (
    <SettingsSection title="Benchmark routing" defaultOpen={false}>
      <div className="benchmark-routing-settings">
        <div className="benchmark-routing-toolbar">
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              aria-label={settings.enabled ? 'Disable benchmark routing' : 'Enable benchmark routing'}
              checked={settings.enabled}
              onChange={(event) => onChange({ ...settings, enabled: event.target.checked })}
            />
            <span>Auto-select models from benchmark evidence</span>
          </label>
          <label className="provider-command-field benchmark-objective-field">
            <span>Objective</span>
            <select
              aria-label="Benchmark routing objective"
              value={settings.objective}
              onChange={(event) => onChange({ ...settings, objective: event.target.value as BenchmarkRoutingObjective })}
            >
              <option value="balanced">Balanced</option>
              <option value="quality">Quality</option>
              <option value="cost">Cost</option>
              <option value="latency">Latency</option>
            </select>
          </label>
        </div>
        <div className="benchmark-evidence-status">
          <StatusIndicator
            active={evidenceState.records.length > 0}
            warning={evidenceState.status === 'refreshing'}
            label={evidenceState.status === 'refreshing'
              ? 'Refreshing benchmark evidence'
              : evidenceState.records.length
                ? `${evidenceState.records.length} benchmark source${evidenceState.records.length === 1 ? '' : 's'}`
                : 'Using fallback benchmark priors'}
          />
          <span>
            {evidenceState.status === 'refreshing'
              ? 'Refreshing evidence'
              : evidenceState.records.length
                ? `${evidenceState.records.length} benchmark source${evidenceState.records.length === 1 ? '' : 's'}`
                : 'Fallback priors'}
          </span>
          {evidenceState.retrievedAt ? <span>Updated {new Date(evidenceState.retrievedAt).toLocaleString()}</span> : null}
        </div>
        {evidenceState.errors.length > 0 ? (
          <p className="benchmark-route-reason">{evidenceState.errors[0]}</p>
        ) : null}
        <div className="benchmark-route-grid">
          {BENCHMARK_TASK_CLASSES.map((taskClass) => {
            const route = recommendBenchmarkRoute({
              taskClass: taskClass.id,
              candidates,
              settings,
            });
            return (
              <article key={taskClass.id} className="benchmark-route-card">
                <div className="provider-card-header">
                  <div className="provider-body">
                    <strong>{taskClass.label}</strong>
                    <p>{taskClass.description}</p>
                  </div>
                  <span className={`score-mark${route ? ' is-active' : ''}`} title={route ? `Score ${Math.round(route.score)}` : 'No route'}>
                    {route ? `${Math.round(route.score)}` : '--'}
                  </span>
                </div>
                <label className="provider-command-field">
                  <span>Model route</span>
                  <select
                    aria-label={`${taskClass.label} model route`}
                    value={settings.pins[taskClass.id] ?? 'auto'}
                    onChange={(event) => setPin(taskClass.id, event.target.value)}
                  >
                    <option value="auto">{route ? `Auto · ${route.candidate.label}` : 'Auto'}</option>
                    {candidateOptions.map((option) => (
                      <option key={`${taskClass.id}:${option.value}`} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                {route ? (
                  <p className="benchmark-route-reason">{route.reason}</p>
                ) : (
                  <p className="benchmark-route-reason">Connect GHCP or install a Codi model to enable routing.</p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </SettingsSection>
  );
}

function PartnerAgentControlPlaneSettingsPanel({
  settings,
  controlPlane,
  latestAuditEntry,
  onChange,
}: {
  settings: PartnerAgentControlPlaneSettings;
  controlPlane: PartnerAgentControlPlane;
  latestAuditEntry: PartnerAgentAuditEntry | null;
  onChange: (settings: PartnerAgentControlPlaneSettings) => void;
}) {
  function update<Key extends keyof PartnerAgentControlPlaneSettings>(
    key: Key,
    value: PartnerAgentControlPlaneSettings[Key],
  ) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <SettingsSection title="Partner agent control plane" defaultOpen={false}>
      <div className="partner-agent-control-plane">
        <div className="partner-agent-toolbar">
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
              aria-label="Enable partner-agent control plane"
            />
            <span>Enable partner-agent control plane</span>
          </label>
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={settings.requirePolicyReview}
              onChange={(event) => update('requirePolicyReview', event.target.checked)}
              aria-label="Require partner-agent policy review"
            />
            <span>Require partner-agent policy review</span>
          </label>
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={settings.preserveEvidence}
              onChange={(event) => update('preserveEvidence', event.target.checked)}
              aria-label="Preserve partner-agent evidence"
            />
            <span>Preserve partner-agent evidence</span>
          </label>
          <label className="provider-command-field partner-agent-audit-select">
            <span>Audit level</span>
            <select
              aria-label="Partner-agent audit level"
              value={settings.auditLevel}
              onChange={(event) => update('auditLevel', event.target.value as PartnerAgentAuditLevel)}
            >
              <option value="minimal">minimal</option>
              <option value="standard">standard</option>
              <option value="strict">strict</option>
            </select>
          </label>
        </div>
        <article className="provider-card partner-agent-summary-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>Unified workflow</strong>
              <p>{controlPlane.readyAgentCount} of {controlPlane.agentRows.length} agents ready under one policy, review, and evidence model.</p>
            </div>
            <span className={`badge${settings.enabled ? ' connected' : ''}`}>{settings.enabled ? 'enabled' : 'off'}</span>
          </div>
          <div className="partner-agent-row-list" role="list" aria-label="Partner agent readiness">
            {controlPlane.agentRows.map((row) => (
              <div key={row.provider} className="partner-agent-row" role="listitem">
                <span className={`status-dot ${row.ready ? 'ok' : 'warn'}`} aria-hidden="true" />
                <div>
                  <strong>{row.label}</strong>
                  <small>{row.summary}</small>
                </div>
                <span className="badge">{row.kind}</span>
              </div>
            ))}
          </div>
          {latestAuditEntry ? (
            <p className="partner-agent-audit-note">
              Last audit: {latestAuditEntry.provider} via {latestAuditEntry.runtimeProvider} · {latestAuditEntry.policy.auditLevel}
            </p>
          ) : (
            <p className="partner-agent-audit-note">No partner-agent audit entries captured this session.</p>
          )}
        </article>
      </div>
    </SettingsSection>
  );
}

function ScheduledAutomationSettingsPanel({
  state,
  onChange,
}: {
  state: ScheduledAutomationState;
  onChange: (state: ScheduledAutomationState) => void;
}) {
  const updateAutomation = (
    automation: ScheduledAutomation,
    patch: Parameters<typeof updateScheduledAutomation>[2],
  ) => {
    onChange(updateScheduledAutomation(state, automation.id, patch));
  };

  return (
    <SettingsSection title="Scheduled automations" defaultOpen={false}>
      <div className="scheduled-automations-settings">
        {state.automations.map((automation) => (
          <article key={automation.id} className="provider-card scheduled-automation-card">
            <div className="provider-card-header">
              <div className="provider-body">
                <strong>{automation.title}</strong>
                <p>{automation.prompt}</p>
              </div>
              <span className={`badge${automation.enabled ? ' connected' : ''}`}>{automation.enabled ? 'enabled' : 'paused'}</span>
            </div>
            <label className="settings-checkbox-row">
              <input
                type="checkbox"
                aria-label={`Enable ${automation.title}`}
                checked={automation.enabled}
                onChange={(event) => updateAutomation(automation, { enabled: event.target.checked })}
              />
              <span>Enable schedule</span>
            </label>
            <div className="scheduled-automation-control-grid">
              <label className="provider-command-field">
                <span>Cadence</span>
                <select
                  aria-label={`${automation.title} cadence`}
                  value={automation.cadence}
                  onChange={(event) => updateAutomation(automation, { cadence: event.target.value as ScheduledAutomationCadence })}
                >
                  <option value="once">once</option>
                  <option value="hourly">hourly</option>
                  <option value="daily">daily</option>
                  <option value="weekly">weekly</option>
                </select>
              </label>
              <label className="provider-command-field">
                <span>Retries</span>
                <select
                  aria-label={`${automation.title} retry count`}
                  value={String(automation.retryPolicy.maxRetries)}
                  onChange={(event) => updateAutomation(automation, { retryPolicy: { maxRetries: Number(event.target.value) } })}
                >
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </label>
              <label className="provider-command-field">
                <span>Notify</span>
                <select
                  aria-label={`${automation.title} notification route`}
                  value={automation.notificationRoute}
                  onChange={(event) => updateAutomation(automation, { notificationRoute: event.target.value as ScheduledAutomationNotificationRoute })}
                >
                  <option value="none">none</option>
                  <option value="browser">browser</option>
                  <option value="inbox">inbox</option>
                </select>
              </label>
              <label className="provider-command-field">
                <span>Review</span>
                <select
                  aria-label={`${automation.title} review trigger`}
                  value={automation.requiresReviewOn}
                  onChange={(event) => updateAutomation(automation, { requiresReviewOn: event.target.value as ScheduledAutomationReviewTrigger })}
                >
                  <option value="never">never</option>
                  <option value="failures">failures</option>
                  <option value="always">always</option>
                </select>
              </label>
            </div>
          </article>
        ))}
      </div>
    </SettingsSection>
  );
}

function AdversaryToolReviewSettingsPanel({
  settings,
  onChange,
}: {
  settings: AdversaryToolReviewSettings;
  onChange: (settings: AdversaryToolReviewSettings) => void;
}) {
  const rulesText = settings.customRules.join('\n');
  const setRules = (value: string) => {
    onChange({
      ...settings,
      customRules: value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    });
  };

  return (
    <SettingsSection title="Adversary tool review" defaultOpen={false}>
      <div className="adversary-review-settings">
        <div className="secret-settings-grid">
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Enable adversary tool-call review"
              checked={settings.enabled}
              onChange={(event) => onChange({ ...settings, enabled: event.target.checked })}
            />
            <span>
              <strong>Review tool actions before execution</strong>
              <small>Compare committed LogAct actions against the user task, recent context, and tool policy.</small>
            </span>
          </label>
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Strictly block high-risk reviewed actions"
              checked={settings.strictMode}
              onChange={(event) => onChange({ ...settings, strictMode: event.target.checked })}
            />
            <span>
              <strong>Strict blocking</strong>
              <small>Block high-risk drift immediately instead of pausing for operator approval.</small>
            </span>
          </label>
        </div>
        <label className="provider-command-field adversary-review-rules">
          <span>Custom rules</span>
          <textarea
            aria-label="Adversary review custom rules"
            value={rulesText}
            onChange={(event) => setRules(event.target.value)}
            placeholder="One rule per line"
            rows={4}
          />
        </label>
      </div>
    </SettingsSection>
  );
}

function SecurityReviewAgentSettingsPanel({
  settings,
  runPlan,
  onChange,
}: {
  settings: SecurityReviewAgentSettings;
  runPlan: SecurityReviewRunPlan;
  onChange: (settings: SecurityReviewAgentSettings) => void;
}) {
  function update<Key extends keyof SecurityReviewAgentSettings>(
    key: Key,
    value: SecurityReviewAgentSettings[Key],
  ) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <SettingsSection title="Security review agents" defaultOpen={false}>
      <div className="security-review-settings">
        <div className="secret-settings-grid">
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Enable security review agents"
              checked={settings.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
            />
            <span>
              <strong>Enable security review agents</strong>
              <small>Route security-sensitive prompts through specialist review and scan instructions.</small>
            </span>
          </label>
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Enable inline PR security review"
              checked={settings.inlinePrReview}
              onChange={(event) => update('inlinePrReview', event.target.checked)}
            />
            <span>
              <strong>Inline PR review</strong>
              <small>Emit severity-tagged findings with remediation for pull-request diffs.</small>
            </span>
          </label>
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Enable scheduled vulnerability scans"
              checked={settings.scheduledScans}
              onChange={(event) => update('scheduledScans', event.target.checked)}
            />
            <span>
              <strong>Scheduled vulnerability scans</strong>
              <small>Prepare recurring repository scan updates for automation surfaces.</small>
            </span>
          </label>
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Send security scan updates to Slack"
              checked={settings.deliveryChannels.slack}
              onChange={(event) => onChange({
                ...settings,
                deliveryChannels: { ...settings.deliveryChannels, slack: event.target.checked },
              })}
            />
            <span>
              <strong>Slack delivery ready</strong>
              <small>Include Slack as a configured delivery channel when a connector is available.</small>
            </span>
          </label>
        </div>
        <div className="security-review-select-grid">
          <label className="provider-command-field">
            <span>Cadence</span>
            <select
              aria-label="Security scan cadence"
              value={settings.cadence}
              onChange={(event) => update('cadence', event.target.value as SecurityReviewCadence)}
            >
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
            </select>
          </label>
          <label className="provider-command-field">
            <span>Minimum severity</span>
            <select
              aria-label="Minimum reported severity"
              value={settings.severityThreshold}
              onChange={(event) => update('severityThreshold', event.target.value as SecurityReviewSeverity)}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </label>
          <label className="provider-command-field">
            <span>Tool integration</span>
            <select
              aria-label="Security tool integration"
              value={settings.toolIntegration}
              onChange={(event) => update('toolIntegration', event.target.value as SecurityReviewToolIntegration)}
            >
              <option value="harness-selected">harness selected</option>
              <option value="mcp-required">MCP required</option>
              <option value="manual">manual</option>
            </select>
          </label>
        </div>
        <article className="provider-card security-review-summary-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>Security workflow</strong>
              <p>{runPlan.agents.length} agents active · {runPlan.securityToolCount} selected tools · {runPlan.deliverySummary}</p>
            </div>
            <span className={`badge${runPlan.enabled ? ' connected' : ''}`}>{runPlan.enabled ? 'enabled' : 'off'}</span>
          </div>
          <div className="security-review-agent-list" role="list" aria-label="Security review agent readiness">
            {runPlan.agents.map((agent) => (
              <div className="partner-agent-row" role="listitem" key={agent.id}>
                <span className="status-dot ok" aria-hidden="true" />
                <div>
                  <strong>{agent.label}</strong>
                  <small>{agent.summary}</small>
                </div>
                <span className="badge">{runPlan.severityThreshold}</span>
              </div>
            ))}
          </div>
          <p className="partner-agent-audit-note">{buildScheduledSecurityScanUpdate(runPlan).body}</p>
        </article>
        <label className="provider-command-field adversary-review-rules">
          <span>Custom instructions</span>
          <textarea
            aria-label="Security review custom instructions"
            value={settings.customInstructions}
            onChange={(event) => update('customInstructions', event.target.value)}
            placeholder="Team-specific security review instructions"
            rows={4}
          />
        </label>
      </div>
    </SettingsSection>
  );
}

function CursorModelCard({ model }: { model: CursorModelSummary }) {
  return (
    <div className="model-card copilot-model-card">
      <div className="model-card-icon"><Icon name="sparkles" size={15} color="#a78bfa" /></div>
      <div className="model-card-body">
        <strong>{model.name}</strong>
        <div className="copilot-model-meta">
          <span className="chip mini">{model.id}</span>
          {typeof model.contextWindow === 'number' ? <span className="chip mini">{model.contextWindow.toLocaleString()} ctx</span> : null}
          {typeof model.maxOutputTokens === 'number' ? <span className="chip mini">{model.maxOutputTokens.toLocaleString()} out</span> : null}
        </div>
        <p>Enabled through the Cursor SDK runtime for this environment.</p>
      </div>
      <StatusIndicator active label={`${model.name} enabled`} />
    </div>
  );
}

function CodexModelCard({ model }: { model: CodexModelSummary }) {
  return (
    <div className="model-card copilot-model-card">
      <div className="model-card-icon"><Icon name="terminal" size={15} color="#86efac" /></div>
      <div className="model-card-body">
        <strong>{model.name}</strong>
        <div className="copilot-model-meta">
          <span className="chip mini">{model.id}</span>
          {model.reasoning ? <span className="chip mini">Reasoning</span> : null}
          {model.vision ? <span className="chip mini">Vision</span> : null}
        </div>
        <p>Runs through the local Codex CLI configuration.</p>
      </div>
      <StatusIndicator active label={`${model.name} enabled`} />
    </div>
  );
}


function SettingsSection({
  title,
  defaultOpen = true,
  forceOpen = false,
  className,
  bodyClassName,
  scrollBody = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  scrollBody?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = forceOpen || open;
  const bodyClassNames = [
    'sidebar-section-body',
    scrollBody ? 'section-scroll-body' : 'settings-section-body',
    bodyClassName,
  ].filter(Boolean).join(' ');

  return (
    <section className={`model-section collapsible-section sidebar-section settings-section${scrollBody ? ' settings-section--scroll' : ''}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="panel-section-header sidebar-section-toggle section-toggle"
        aria-expanded={expanded}
        onClick={() => {
          if (!forceOpen) {
            setOpen((value) => !value);
          }
        }}
        style={forceOpen ? { cursor: 'default' } : undefined}
      >
        <span>{title}</span>
        <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={12} color="#94a3b8" />
      </button>
      {expanded ? (
        <div
          className={bodyClassNames}
          tabIndex={scrollBody ? 0 : undefined}
          aria-label={scrollBody ? `${title} contents` : undefined}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

function SidebarSection({
  title,
  summary,
  defaultOpen = true,
  scrollBody = false,
  className,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  scrollBody?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyClassNames = [
    'sidebar-section-body',
    scrollBody ? 'sidebar-section-body--scroll' : '',
  ].filter(Boolean).join(' ');

  return (
    <section className={`sidebar-section${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="panel-section-header sidebar-section-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <span className="sidebar-section-toggle-meta">
          {summary ? <span className="sidebar-section-summary">{summary}</span> : null}
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={12} color="#94a3b8" />
        </span>
      </button>
      {open ? (
        <div
          className={bodyClassNames}
          tabIndex={scrollBody ? 0 : undefined}
          aria-label={scrollBody ? `${title} contents` : undefined}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

function slugifyEvaluationAgentId(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || `agent-${Date.now().toString(36)}`;
}

function EvaluationAgentsSettings({
  agents,
  negativeRubricTechniques,
  onSaveAgents,
  onResetAgents,
  onResetNegativeRubric,
}: {
  agents: CustomEvaluationAgent[];
  negativeRubricTechniques: string[];
  onSaveAgents: (agents: CustomEvaluationAgent[]) => void;
  onResetAgents: () => void;
  onResetNegativeRubric: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<EvaluationAgentKind>('teacher');
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [rubricCriteria, setRubricCriteria] = useState('');
  const [json, setJson] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setKind('teacher');
    setName('');
    setInstructions('');
    setRubricCriteria('');
  };
  const saveAgent = () => {
    const trimmedName = name.trim();
    const trimmedInstructions = instructions.trim();
    if (!trimmedName || !trimmedInstructions) return;
    const id = editingId ?? `${kind}-${slugifyEvaluationAgentId(trimmedName)}`;
    const nextAgent: CustomEvaluationAgent = {
      id,
      kind,
      name: trimmedName,
      instructions: trimmedInstructions,
      enabled: agents.find((agent) => agent.id === id)?.enabled ?? true,
      ...(kind === 'judge'
        ? {
          rubricCriteria: rubricCriteria
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        }
        : {}),
    };
    onSaveAgents([...agents.filter((agent) => agent.id !== id), nextAgent]);
    resetForm();
  };
  const editAgent = (agent: CustomEvaluationAgent) => {
    setEditingId(agent.id);
    setKind(agent.kind);
    setName(agent.name);
    setInstructions(agent.instructions);
    setRubricCriteria((agent.rubricCriteria ?? []).join('\n'));
  };
  const toggleAgent = (agent: CustomEvaluationAgent) => {
    onSaveAgents(agents.map((candidate) => (
      candidate.id === agent.id ? { ...candidate, enabled: !candidate.enabled } : candidate
    )));
  };
  const exportAgents = () => {
    setJson(JSON.stringify(agents, null, 2));
  };
  const importAgents = () => {
    try {
      const parsed = JSON.parse(json) as CustomEvaluationAgent[];
      if (Array.isArray(parsed)) {
        onSaveAgents(parsed);
        resetForm();
      }
    } catch {
      // Keep the text in place so the user can fix malformed JSON.
    }
  };

  return (
    <SettingsSection title={`LogAct evaluation agents (${agents.length})`} defaultOpen={false}>
      <div className="provider-list">
        <article className="provider-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>Custom voters and judges</strong>
              <p>Teachers steer student candidates. Judge configs extend rubrics and eval checks.</p>
            </div>
            <StatusIndicator active={negativeRubricTechniques.length > 0} label={`${negativeRubricTechniques.length} rubric hardening rules`} />
          </div>
          <div className="provider-actions">
            <button type="button" className="sidebar-icon-button" aria-label="Export evaluation agents JSON" title="Export evaluation agents JSON" onClick={exportAgents}>
              <Icon name="download" size={13} />
            </button>
            <button type="button" className="sidebar-icon-button" aria-label="Import evaluation agents JSON" title="Import evaluation agents JSON" onClick={importAgents}>
              <Icon name="save" size={13} />
            </button>
            <button type="button" className="sidebar-icon-button" aria-label="Reset evaluation agents" title="Reset evaluation agents" onClick={onResetAgents}>
              <Icon name="refresh" size={13} />
            </button>
            <button type="button" className="sidebar-icon-button" aria-label="Reset rubric hardening" title="Reset rubric hardening" onClick={onResetNegativeRubric}>
              <Icon name="x" size={13} />
            </button>
          </div>
          <label className="provider-command-field">
            <span>Evaluation agents JSON</span>
            <textarea aria-label="Evaluation agents JSON" value={json} onChange={(event) => setJson(event.target.value)} rows={4} />
          </label>
        </article>

        <article className="provider-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>{editingId ? 'Edit evaluation agent' : 'Create evaluation agent'}</strong>
              <p>Only teachers vote. Judge configs feed the decider rubric.</p>
            </div>
          </div>
          <label className="provider-command-field">
            <span>Kind</span>
            <select aria-label="Evaluation agent kind" value={kind} onChange={(event) => setKind(event.target.value as EvaluationAgentKind)}>
              <option value="teacher">Teacher voter</option>
              <option value="judge">Judge rubric</option>
            </select>
          </label>
          <label className="provider-command-field">
            <span>Name</span>
            <input aria-label="Evaluation agent name" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="provider-command-field">
            <span>Instructions</span>
            <textarea aria-label="Evaluation agent instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} />
          </label>
          {kind === 'judge' ? (
            <label className="provider-command-field">
              <span>Rubric criteria</span>
              <textarea aria-label="Evaluation judge rubric criteria" value={rubricCriteria} onChange={(event) => setRubricCriteria(event.target.value)} rows={3} />
            </label>
          ) : null}
          <div className="provider-actions">
            <button type="button" className="sidebar-icon-button" aria-label="Save evaluation agent" title="Save evaluation agent" onClick={saveAgent}>
              <Icon name="save" size={13} />
            </button>
            <button type="button" className="sidebar-icon-button" aria-label="Clear evaluation agent form" title="Clear form" onClick={resetForm}>
              <Icon name="x" size={13} />
            </button>
          </div>
        </article>

        {agents.map((agent) => (
          <article key={agent.id} className="provider-card">
            <div className="provider-card-header">
              <div className="provider-body">
                <strong>{agent.name}</strong>
                <p>{agent.kind === 'teacher' ? 'Teacher voter' : 'Judge rubric'} · {agent.enabled ? 'enabled' : 'disabled'}</p>
              </div>
              <StatusIndicator active={agent.enabled} label={`${agent.name} ${agent.enabled ? 'enabled' : 'disabled'}`} />
            </div>
            <p className="muted">{agent.instructions}</p>
            <div className="provider-actions">
              <button type="button" className="sidebar-icon-button" aria-label={`Edit ${agent.name}`} title={`Edit ${agent.name}`} onClick={() => editAgent(agent)}>
                <Icon name="pencil" size={13} />
              </button>
              <button
                type="button"
                className="sidebar-icon-button"
                aria-label={`${agent.enabled ? 'Disable' : 'Enable'} ${agent.name}`}
                title={`${agent.enabled ? 'Disable' : 'Enable'} ${agent.name}`}
                onClick={() => toggleAgent(agent)}
              >
                <Icon name={agent.enabled ? 'x' : 'plus'} size={13} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </SettingsSection>
  );
}

function SecretsSettings({
  records,
  settings,
  onSaveSecret,
  onDeleteSecret,
  onSettingsChange,
}: {
  records: SecretRecord[];
  settings: SecretManagementSettings;
  onSaveSecret: (input: { name: string; value: string }) => Promise<string>;
  onDeleteSecret: (idOrRef: string) => Promise<void>;
  onSettingsChange: (settings: SecretManagementSettings) => void;
}) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const updateSetting = (key: keyof SecretManagementSettings, nextValue: boolean) => {
    onSettingsChange({ ...settings, [key]: nextValue });
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !value) return;
    setIsSaving(true);
    try {
      await onSaveSecret({ name, value });
      setName('');
      setValue('');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SettingsSection title={`Secrets (${records.length})`} bodyClassName="secrets-section-body">
      <div className="secrets-toolbar">
        <div>
          <strong>Secret refs</strong>
          <p className="muted">Store values locally and expose only secret-ref handles to chat agents and tools.</p>
        </div>
        <StatusIndicator active={settings.enabled} label={settings.enabled ? 'Secret redaction on' : 'Secret redaction off'} />
      </div>
      <form className="secrets-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="provider-command-field">
          <span>Secret name</span>
          <input aria-label="Secret name" value={name} onChange={(event) => setName(event.target.value)} placeholder="OPENWEATHER_API_KEY" autoComplete="off" />
        </label>
        <label className="provider-command-field">
          <span>Secret value</span>
          <input aria-label="Secret value" type="password" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Value is never shown again" autoComplete="off" />
        </label>
        <button
          type="submit"
          className="sidebar-icon-button secrets-add-button"
          aria-label={isSaving ? 'Adding secret' : 'Add secret'}
          title={isSaving ? 'Adding secret' : 'Add secret'}
          disabled={isSaving || !name.trim() || !value}
        >
          <Icon name={isSaving ? 'loader' : 'plus'} size={13} className={isSaving ? 'spin' : ''} />
        </button>
      </form>
      <div className="secret-settings-grid">
        <label className="secret-toggle-row">
          <input
            type="checkbox"
            checked={settings.enabled}
            aria-label={settings.enabled ? 'Disable secret redaction' : 'Enable secret redaction'}
            onChange={(event) => updateSetting('enabled', event.target.checked)}
          />
          <span><strong>Secret redaction</strong><small>Run the sanitizer before model calls.</small></span>
        </label>
        <label className="secret-toggle-row">
          <input
            type="checkbox"
            checked={settings.replaceStoredSecrets}
            aria-label={settings.replaceStoredSecrets ? 'Disable stored secret replacement' : 'Enable stored secret replacement'}
            onChange={(event) => updateSetting('replaceStoredSecrets', event.target.checked)}
          />
          <span><strong>Stored values</strong><small>Replace values already saved in the local vault.</small></span>
        </label>
        <label className="secret-toggle-row">
          <input
            type="checkbox"
            checked={settings.detectKnownSecrets}
            aria-label={settings.detectKnownSecrets ? 'Disable known secret detectors' : 'Enable known secret detectors'}
            onChange={(event) => updateSetting('detectKnownSecrets', event.target.checked)}
          />
          <span><strong>Known formats</strong><small>Provider tokens, auth headers, URLs, JWTs, and private keys.</small></span>
        </label>
        <label className="secret-toggle-row">
          <input
            type="checkbox"
            checked={settings.detectGenericSecrets}
            aria-label={settings.detectGenericSecrets ? 'Disable generic secret assignments' : 'Enable generic secret assignments'}
            onChange={(event) => updateSetting('detectGenericSecrets', event.target.checked)}
          />
          <span><strong>Generic assignments</strong><small>Keys named token, password, secret, API key, and similar.</small></span>
        </label>
        <label className="secret-toggle-row">
          <input
            type="checkbox"
            checked={settings.detectHighEntropySecrets}
            aria-label={settings.detectHighEntropySecrets ? 'Disable high entropy secret fallback' : 'Enable high entropy secret fallback'}
            onChange={(event) => updateSetting('detectHighEntropySecrets', event.target.checked)}
          />
          <span><strong>High entropy fallback</strong><small>Contextual detection for token-like values in user text.</small></span>
        </label>
      </div>
      <div className="secrets-table" role="table" aria-label="Stored secrets">
        <div className="secrets-row secrets-row-header" role="row">
          <span role="columnheader">Name</span>
          <span role="columnheader">Value</span>
          <span role="columnheader">Reference</span>
          <span role="columnheader">Updated</span>
          <span role="columnheader">Actions</span>
        </div>
        {records.map((record) => (
          <div className="secrets-row" role="row" key={record.id}>
            <span className="secret-name" role="cell">{record.label}</span>
            <span className="secret-mask" role="cell">••••••••••••••••</span>
            <code className="secret-ref" role="cell">{secretRefForId(record.id)}</code>
            <span className="secret-updated" role="cell">{formatSecretUpdated(record.updatedAt)}</span>
            <span role="cell">
              <button type="button" className="sidebar-icon-button danger-button" aria-label={`Delete secret ${record.label}`} title={`Delete ${record.label}`} onClick={() => void onDeleteSecret(record.id)}>
                <Icon name="trash" size={13} />
              </button>
            </span>
          </div>
        ))}
        {!records.length ? <p className="secrets-empty muted">No secrets stored yet.</p> : null}
      </div>
    </SettingsSection>
  );
}

function formatSecretUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface ModelsPanelProps {
  copilotState: CopilotRuntimeState;
  isCopilotLoading: boolean;
  onRefreshCopilot: () => void;
  cursorState: CursorRuntimeState;
  isCursorLoading: boolean;
  onRefreshCursor: () => void;
  codexState: CodexRuntimeState;
  isCodexLoading: boolean;
  onRefreshCodex: () => void;
  registryModels: HFModel[];
  installedModels: HFModel[];
  task: string;
  loadingModelId: string | null;
  onTaskChange: (task: string) => void;
  onSearch: (query: string) => void;
  onInstall: (model: HFModel) => Promise<void>;
  onDelete: (id: string) => void;
}

interface SettingsPanelProps {
  benchmarkRoutingSettings: BenchmarkRoutingSettings;
  benchmarkRoutingCandidates: BenchmarkRoutingCandidate[];
  benchmarkEvidenceState: BenchmarkEvidenceDiscoveryState;
  adversaryToolReviewSettings: AdversaryToolReviewSettings;
  securityReviewAgentSettings: SecurityReviewAgentSettings;
  securityReviewRunPlan: SecurityReviewRunPlan;
  scheduledAutomationState: ScheduledAutomationState;
  partnerAgentControlPlaneSettings: PartnerAgentControlPlaneSettings;
  partnerAgentControlPlane: PartnerAgentControlPlane;
  latestPartnerAgentAuditEntry: PartnerAgentAuditEntry | null;
  onBenchmarkRoutingSettingsChange: (settings: BenchmarkRoutingSettings) => void;
  onAdversaryToolReviewSettingsChange: (settings: AdversaryToolReviewSettings) => void;
  onSecurityReviewAgentSettingsChange: (settings: SecurityReviewAgentSettings) => void;
  onScheduledAutomationStateChange: (state: ScheduledAutomationState) => void;
  onPartnerAgentControlPlaneSettingsChange: (settings: PartnerAgentControlPlaneSettings) => void;
  evaluationAgents: CustomEvaluationAgent[];
  negativeRubricTechniques: string[];
  onSaveEvaluationAgents: (agents: CustomEvaluationAgent[]) => void;
  onResetEvaluationAgents: () => void;
  onResetNegativeRubric: () => void;
  secretRecords: SecretRecord[];
  secretSettings: SecretManagementSettings;
  onSaveSecret: (input: { name: string; value: string }) => Promise<string>;
  onDeleteSecret: (idOrRef: string) => Promise<void>;
  onSecretSettingsChange: (settings: SecretManagementSettings) => void;
}

function LocalInferenceReadinessCard({ readiness }: { readiness: LocalInferenceReadiness }) {
  return (
    <article className="provider-card local-inference-card">
      <div className="provider-card-header">
        <div className="provider-body">
          <strong>{readiness.title}</strong>
          <p>{readiness.summary}</p>
        </div>
        <span className={`badge${readiness.status === 'ready' ? ' connected' : ''}`}>{readiness.badge}</span>
      </div>
      {readiness.activeModelName ? (
        <p className="muted">Active local model: {readiness.activeModelName}</p>
      ) : null}
      <div className="local-inference-badges" aria-label="Local inference properties">
        {readiness.badges.map((badge) => (
          <span key={badge} className={`badge${badge === 'Offline ready' ? ' connected' : ''}`}>{badge}</span>
        ))}
      </div>
      <div className="local-inference-metrics" role="list" aria-label="Local inference hardware and model constraints">
        {readiness.metrics.map((metric) => (
          <span key={metric.label} role="listitem">
            <strong>{metric.value}</strong>
            <small>{metric.label}</small>
          </span>
        ))}
      </div>
      <ul className="local-inference-constraints">
        {readiness.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}
      </ul>
    </article>
  );
}

function ModelsPanel({ copilotState, isCopilotLoading, onRefreshCopilot, cursorState, isCursorLoading, onRefreshCursor, codexState, isCodexLoading, onRefreshCodex, registryModels, installedModels, task, loadingModelId, onTaskChange, onSearch, onInstall, onDelete }: ModelsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const installedIds = new Set(installedModels.map((m) => m.id));
  const isFiltering = Boolean(searchQuery || task);
  const copilotReady = hasGhcpAccess(copilotState);
  const cursorReady = hasCursorAccess(cursorState);
  const codexReady = hasCodexAccess(codexState);
  const localInferenceReadiness = useMemo(
    () => assessLocalInferenceReadiness({
      installedModels,
      hardware: getBrowserLocalInferenceHardware(typeof navigator === 'undefined' ? null : navigator),
    }),
    [installedModels],
  );
  // Recommended = seed models not yet installed, only shown when no filter active
  const recommended = !isFiltering ? LOCAL_MODELS_SEED.filter((m) => !installedIds.has(m.id)) : [];
  const recommendedIds = new Set(recommended.map((m) => m.id));
  // HF results, deduped against installed + recommended
  const hfResults = registryModels.filter((r) => !installedIds.has(r.id) && !recommendedIds.has(r.id));
  function handleSearch(value: string) {
    setSearchQuery(value);
    onSearch(value);
  }

  return (
    <section className="panel-scroll settings-panel" aria-label="Models">
      <div className="panel-topbar">
        <div className="settings-heading">
          <h2>Models</h2>
          <p className="muted">Install and configure model provider extensions for chat agents.</p>
        </div>
      </div>

      <SettingsSection title="Providers" scrollBody>
        <div className="provider-list">
          <article className="provider-card">
            <div className="provider-card-header">
              <div className="provider-body">
                <strong>GitHub Copilot</strong>
                <p>Checks for ambient GitHub Copilot auth in this environment and exposes it as the GHCP chat agent when enabled models are available.</p>
              </div>
              <StatusIndicator
                active={copilotReady}
                warning={isCopilotLoading}
                label={isCopilotLoading ? 'Checking GitHub Copilot' : (copilotReady ? 'GitHub Copilot ready' : (copilotState.authenticated ? 'GitHub Copilot signed in' : 'GitHub Copilot sign-in required'))}
              />
            </div>
            {copilotState.statusMessage ? <p className="muted">{copilotState.statusMessage}</p> : null}
            {copilotState.error ? <p className="file-editor-error">{copilotState.error}</p> : null}
            {!copilotReady && !copilotState.authenticated ? (
              <>
                <div className="provider-actions">
                  <a className="sidebar-icon-button" href={copilotState.signInDocsUrl} target="_blank" rel="noreferrer" aria-label="Open GitHub Copilot sign-in docs" title="Open sign-in docs">
                    <Icon name="keyRound" size={13} />
                  </a>
                  <button type="button" className="sidebar-icon-button" aria-label="Refresh GitHub Copilot status" title="Refresh status" onClick={onRefreshCopilot} disabled={isCopilotLoading}>
                    <Icon name={isCopilotLoading ? 'loader' : 'refresh'} size={13} className={isCopilotLoading ? 'spin' : ''} />
                  </button>
                </div>
                <label className="provider-command-field">
                  <span>Run this in the dev container</span>
                  <input aria-label="GitHub Copilot sign-in command" value={copilotState.signInCommand} readOnly />
                </label>
              </>
            ) : !copilotReady ? (
              <div className="provider-actions">
                <button type="button" className="sidebar-icon-button" aria-label="Refresh GitHub Copilot status" title="Refresh status" onClick={onRefreshCopilot} disabled={isCopilotLoading}>
                  <Icon name={isCopilotLoading ? 'loader' : 'refresh'} size={13} className={isCopilotLoading ? 'spin' : ''} />
                </button>
              </div>
            ) : (
              <div className="provider-actions">
                <button type="button" className="sidebar-icon-button" aria-label="Refresh GitHub Copilot status" title="Refresh status" onClick={onRefreshCopilot} disabled={isCopilotLoading}>
                  <Icon name={isCopilotLoading ? 'loader' : 'refresh'} size={13} className={isCopilotLoading ? 'spin' : ''} />
                </button>
              </div>
            )}
          </article>
          <article className="provider-card">
            <div className="provider-card-header">
              <div className="provider-body">
                <strong>Cursor</strong>
                <p>Uses the Cursor SDK with CURSOR_API_KEY to expose Cursor as a first-class chat agent provider.</p>
              </div>
              <StatusIndicator
                active={cursorReady}
                warning={isCursorLoading}
                label={isCursorLoading ? 'Checking Cursor' : (cursorReady ? 'Cursor ready' : (cursorState.authenticated ? 'Cursor signed in' : 'Cursor API key required'))}
              />
            </div>
            {cursorState.statusMessage ? <p className="muted">{cursorState.statusMessage}</p> : null}
            {cursorState.error ? <p className="file-editor-error">{cursorState.error}</p> : null}
            {!cursorReady && !cursorState.authenticated ? (
              <>
                <div className="provider-actions">
                  <a className="sidebar-icon-button" href={cursorState.signInDocsUrl} target="_blank" rel="noreferrer" aria-label="Open Cursor SDK docs" title="Open Cursor SDK docs">
                    <Icon name="link" size={13} />
                  </a>
                  <button type="button" className="sidebar-icon-button" aria-label="Refresh Cursor status" title="Refresh status" onClick={onRefreshCursor} disabled={isCursorLoading}>
                    <Icon name={isCursorLoading ? 'loader' : 'refresh'} size={13} className={isCursorLoading ? 'spin' : ''} />
                  </button>
                </div>
                <label className="provider-command-field">
                  <span>Configure the dev server environment</span>
                  <input aria-label="Cursor setup command" value={cursorState.signInCommand} readOnly />
                </label>
              </>
            ) : !cursorReady ? (
              <div className="provider-actions">
                <button type="button" className="sidebar-icon-button" aria-label="Refresh Cursor status" title="Refresh status" onClick={onRefreshCursor} disabled={isCursorLoading}>
                  <Icon name={isCursorLoading ? 'loader' : 'refresh'} size={13} className={isCursorLoading ? 'spin' : ''} />
                </button>
              </div>
            ) : (
              <div className="provider-actions">
                <button type="button" className="sidebar-icon-button" aria-label="Refresh Cursor status" title="Refresh status" onClick={onRefreshCursor} disabled={isCursorLoading}>
                  <Icon name={isCursorLoading ? 'loader' : 'refresh'} size={13} className={isCursorLoading ? 'spin' : ''} />
                </button>
              </div>
            )}
          </article>
          <article className="provider-card">
            <div className="provider-card-header">
              <div className="provider-body">
                <strong>Codex</strong>
                <p>Checks for ambient Codex CLI auth in this environment and exposes it as the Codex chat agent when available.</p>
              </div>
              <StatusIndicator
                active={codexReady}
                warning={isCodexLoading}
                label={isCodexLoading ? 'Checking Codex' : (codexReady ? 'Codex ready' : (codexState.authenticated ? 'Codex signed in' : 'Codex sign-in required'))}
              />
            </div>
            {codexState.statusMessage ? <p className="muted">{codexState.statusMessage}</p> : null}
            {codexState.error ? <p className="file-editor-error">{codexState.error}</p> : null}
            {!codexReady && !codexState.authenticated ? (
              <>
                <div className="provider-actions">
                  <a className="sidebar-icon-button" href={codexState.signInDocsUrl} target="_blank" rel="noreferrer" aria-label="Open Codex sign-in docs" title="Open sign-in docs">
                    <Icon name="keyRound" size={13} />
                  </a>
                  <button type="button" className="sidebar-icon-button" aria-label="Refresh Codex status" title="Refresh status" onClick={onRefreshCodex} disabled={isCodexLoading}>
                    <Icon name={isCodexLoading ? 'loader' : 'refresh'} size={13} className={isCodexLoading ? 'spin' : ''} />
                  </button>
                </div>
                <label className="provider-command-field">
                  <span>Run this in the dev container</span>
                  <input aria-label="Codex sign-in command" value={codexState.signInCommand} readOnly />
                </label>
              </>
            ) : !codexReady ? (
              <div className="provider-actions">
                <button type="button" className="sidebar-icon-button" aria-label="Refresh Codex status" title="Refresh status" onClick={onRefreshCodex} disabled={isCodexLoading}>
                  <Icon name={isCodexLoading ? 'loader' : 'refresh'} size={13} className={isCodexLoading ? 'spin' : ''} />
                </button>
              </div>
            ) : (
              <div className="provider-actions">
                <button type="button" className="sidebar-icon-button" aria-label="Refresh Codex status" title="Refresh status" onClick={onRefreshCodex} disabled={isCodexLoading}>
                  <Icon name={isCodexLoading ? 'loader' : 'refresh'} size={13} className={isCodexLoading ? 'spin' : ''} />
                </button>
              </div>
            )}
          </article>
        </div>
      </SettingsSection>

      <SettingsSection title="Built-in local inference">
        <LocalInferenceReadinessCard readiness={localInferenceReadiness} />
      </SettingsSection>

      <SettingsSection title="Local OpenAI-compatible endpoint" defaultOpen={false}>
        <article className="provider-card">
          <LocalModelSettings />
        </article>
      </SettingsSection>

      {copilotState.models.length > 0 && (
        <SettingsSection title={`GitHub Copilot models (${copilotState.models.length})`} defaultOpen={false} scrollBody>
          {copilotState.models.map((model) => (
            <CopilotModelCard key={model.id} model={model} />
          ))}
        </SettingsSection>
      )}

      {cursorState.models.length > 0 && (
        <SettingsSection title={`Cursor models (${cursorState.models.length})`} defaultOpen={false} scrollBody>
          {cursorState.models.map((model) => (
            <CursorModelCard key={model.id} model={model} />
          ))}
        </SettingsSection>
      )}

      {codexState.models.length > 0 && (
        <SettingsSection title={`Codex models (${codexState.models.length})`} defaultOpen={false} scrollBody>
          {codexState.models.map((model) => (
            <CodexModelCard key={model.id} model={model} />
          ))}
        </SettingsSection>
      )}

      <SettingsSection title="Local models" scrollBody bodyClassName="local-models-body">
        <div className="local-model-controls">
          <label className="shared-input-shell settings-search-shell">
            <Icon name="search" size={13} color="#7d8594" />
            <input aria-label="Hugging Face search" value={searchQuery} onChange={(event) => handleSearch(event.target.value)} placeholder="Search Hugging Face" />
          </label>
          <div className="chip-row">
            {TASK_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`chip ${task === option ? 'active' : ''}`}
                aria-pressed={task === option}
                onClick={() => onTaskChange(task === option ? '' : option)}
              >
                {HF_TASK_LABELS[option] ?? option}
              </button>
            ))}
          </div>
        </div>

        {installedModels.length > 0 && (
          <SettingsSection title={`Loaded (${installedModels.length})`} className="settings-subsection">
            {installedModels.map((model) => (
              <ModelCard key={model.id} model={model} isInstalled={true} isLoading={false} onInstall={() => undefined} onDelete={() => onDelete(model.id)} />
            ))}
          </SettingsSection>
        )}

        {!isFiltering && recommended.length > 0 && (
          <SettingsSection title={`Recommended (${recommended.length})`} className="settings-subsection">
            {recommended.map((model) => (
              <ModelCard key={model.id} model={model} isInstalled={false} isLoading={loadingModelId === model.id} onInstall={() => void onInstall(model)} />
            ))}
          </SettingsSection>
        )}

        <SettingsSection title={isFiltering ? `Results (${hfResults.length})` : `Registry (${hfResults.length})`} defaultOpen={isFiltering} forceOpen={isFiltering} className="settings-subsection settings-result-list">
          {hfResults.map((model) => (
            <ModelCard key={model.id} model={model} isInstalled={false} isLoading={loadingModelId === model.id} onInstall={() => void onInstall(model)} />
          ))}
          {!hfResults.length && !recommended.length && <p className="muted">No browser-runnable ONNX models match the current filter.</p>}
        </SettingsSection>
      </SettingsSection>
    </section>
  );
}

function SettingsPanel({
  benchmarkRoutingSettings,
  benchmarkRoutingCandidates,
  benchmarkEvidenceState,
  adversaryToolReviewSettings,
  securityReviewAgentSettings,
  securityReviewRunPlan,
  scheduledAutomationState,
  partnerAgentControlPlaneSettings,
  partnerAgentControlPlane,
  latestPartnerAgentAuditEntry,
  onBenchmarkRoutingSettingsChange,
  onAdversaryToolReviewSettingsChange,
  onSecurityReviewAgentSettingsChange,
  onScheduledAutomationStateChange,
  onPartnerAgentControlPlaneSettingsChange,
  evaluationAgents,
  negativeRubricTechniques,
  onSaveEvaluationAgents,
  onResetEvaluationAgents,
  onResetNegativeRubric,
  secretRecords,
  secretSettings,
  onSaveSecret,
  onDeleteSecret,
  onSecretSettingsChange,
}: SettingsPanelProps) {
  return (
    <section className="panel-scroll settings-panel" aria-label="Settings">
      <div className="panel-topbar">
        <div className="settings-heading">
          <h2>Settings</h2>
          <p className="muted">Tune routing, review, secrets, and evaluation behavior.</p>
        </div>
        <span className="badge">{evaluationAgents.length} eval agents · {secretRecords.length} secrets</span>
      </div>

      <BenchmarkRoutingSettingsPanel
        settings={benchmarkRoutingSettings}
        candidates={benchmarkRoutingCandidates}
        evidenceState={benchmarkEvidenceState}
        onChange={onBenchmarkRoutingSettingsChange}
      />

      <PartnerAgentControlPlaneSettingsPanel
        settings={partnerAgentControlPlaneSettings}
        controlPlane={partnerAgentControlPlane}
        latestAuditEntry={latestPartnerAgentAuditEntry}
        onChange={onPartnerAgentControlPlaneSettingsChange}
      />

      <AdversaryToolReviewSettingsPanel
        settings={adversaryToolReviewSettings}
        onChange={onAdversaryToolReviewSettingsChange}
      />

      <SecurityReviewAgentSettingsPanel
        settings={securityReviewAgentSettings}
        runPlan={securityReviewRunPlan}
        onChange={onSecurityReviewAgentSettingsChange}
      />

      <ScheduledAutomationSettingsPanel
        state={scheduledAutomationState}
        onChange={onScheduledAutomationStateChange}
      />

      <SecretsSettings
        records={secretRecords}
        settings={secretSettings}
        onSaveSecret={onSaveSecret}
        onDeleteSecret={onDeleteSecret}
        onSettingsChange={onSecretSettingsChange}
      />

      <EvaluationAgentsSettings
        agents={evaluationAgents}
        negativeRubricTechniques={negativeRubricTechniques}
        onSaveAgents={onSaveEvaluationAgents}
        onResetAgents={onResetEvaluationAgents}
        onResetNegativeRubric={onResetNegativeRubric}
      />
    </section>
  );
}

function HistoryPanel({ scheduledAutomationState }: { scheduledAutomationState: ScheduledAutomationState }) {
  const now = new Date('2026-05-06T18:00:00.000Z');
  const dueAutomations = projectDueScheduledAutomations({ state: scheduledAutomationState, now });
  const enabledAutomations = scheduledAutomationState.automations.filter((automation) => automation.enabled);
  const inbox = buildScheduledAutomationInbox(scheduledAutomationState);
  const latestRun = scheduledAutomationState.runs[0] ?? null;
  const nextAutomation = enabledAutomations
    .filter((automation) => automation.nextRunAt)
    .sort((left, right) => Date.parse(left.nextRunAt ?? '') - Date.parse(right.nextRunAt ?? ''))[0] ?? null;

  return (
    <section className="panel-scroll history-panel" aria-label="History">
      <div className="panel-topbar">
        <h2>History</h2>
      </div>
      <SidebarSection title="Scheduled automations" scrollBody>
        <div className="scheduled-automations-summary">
          <article className="list-card history-card scheduled-automation-history-card">
            <div className="history-card-header">
              <div>
                <h3>Scheduled automations</h3>
                <p className="muted">{enabledAutomations.length} enabled · {dueAutomations.length} due now · {inbox.length} review inbox</p>
              </div>
              <span className={`badge${dueAutomations.length > 0 ? ' connected' : ''}`}>{dueAutomations.length > 0 ? 'due' : 'ready'}</span>
            </div>
            <p className="history-preview">
              {nextAutomation?.nextRunAt
                ? `Next run: ${nextAutomation.title} at ${new Date(nextAutomation.nextRunAt).toLocaleString()}`
                : 'No enabled scheduled runs.'}
            </p>
            <ul className="history-events">
              <li>Latest evidence: {latestRun?.summary ?? 'No scheduled runs recorded yet'}</li>
              <li>Notification routes: {scheduledAutomationState.automations.map((automation) => `${automation.title} -> ${automation.notificationRoute}`).join(', ')}</li>
            </ul>
          </article>
          {scheduledAutomationState.automations.map((automation) => (
            <article key={automation.id} className="list-card history-card scheduled-automation-row-card">
              <div className="history-card-header">
                <div>
                  <h3>{automation.title}</h3>
                  <p className="muted">{automation.cadence} · {automation.retryPolicy.maxRetries} retries · review {automation.requiresReviewOn}</p>
                </div>
                <span className={`badge${automation.enabled ? ' connected' : ''}`}>{automation.enabled ? 'enabled' : 'paused'}</span>
              </div>
              <p className="history-preview">{automation.prompt}</p>
            </article>
          ))}
        </div>
      </SidebarSection>
      <SidebarSection title={`Recent activity (${mockHistory.length})`} scrollBody>
        <div className="history-list">
          {mockHistory.map((session) => (
            <article key={session.id} className="list-card history-card">
              <div className="history-card-header">
                <div>
                  <h3>{session.title}</h3>
                  <p className="muted">{session.date} · {session.events.length} events</p>
                </div>
              </div>
              <p className="history-preview">{session.preview}</p>
              <ul className="history-events">{session.events.map((entry) => <li key={entry}>{entry}</li>)}</ul>
            </article>
          ))}
        </div>
      </SidebarSection>
    </section>
  );
}

function isIconName(value: unknown): value is keyof typeof icons {
  return typeof value === 'string' && value in icons;
}

function getDefaultExtensionIcon(extension: DefaultExtensionDescriptor | string): keyof typeof icons {
  const extensionId = typeof extension === 'string' ? extension : extension.manifest.id;
  if (typeof extension !== 'string' && isIconName(extension.marketplace.metadata?.activityIcon)) {
    return extension.marketplace.metadata.activityIcon;
  }
  if (extensionId.endsWith('.agent-skills')) return 'sparkles';
  if (extensionId.endsWith('.agents-md')) return 'file';
  if (extensionId.endsWith('.design-md')) return 'slidersHorizontal';
  if (extensionId.endsWith('.artifacts')) return 'layers';
  if (extensionId.endsWith('-model-provider')) return 'cpu';
  if (extensionId.endsWith('.local-model-connector')) return 'cpu';
  if (extensionId.endsWith('.local-inference-daemon')) return 'terminal';
  return 'puzzle';
}

function getDefaultExtensionSourceLabel(extension: DefaultExtensionDescriptor): string {
  return extension.marketplace.source.path
    ?? extension.manifest.entrypoint?.module
    ?? extension.marketplace.source.package
    ?? extension.marketplace.id;
}

function getDefaultExtensionDownload(
  manifest: HarnessPluginManifest,
  daemonDownload: DaemonDownloadChoice,
): (DaemonDownloadChoice & { includeLabelInAria?: boolean }) | null {
  if (manifest.id === 'agent-harness.ext.local-inference-daemon') {
    return { ...daemonDownload, includeLabelInAria: true };
  }
  const runtimeZip = manifest.assets?.find((asset) => asset.kind === 'runtime' && asset.path.endsWith('.zip'));
  if (!runtimeZip) return null;
  const fileName = runtimeZip.path.split('/').pop();
  if (!fileName) return null;
  return { href: `/downloads/${fileName}`, fileName, label: 'Download package' };
}

function useResolvedDaemonDownloadChoice(): DaemonDownloadChoice {
  const [daemonDownload, setDaemonDownload] = useState<DaemonDownloadChoice>(PORTABLE_DAEMON_SOURCE_DOWNLOAD);

  useEffect(() => {
    let active = true;
    resolveLocalInferenceDaemonDownload(window.navigator).then((download) => {
      if (active) setDaemonDownload(download);
    }).catch(() => {
      if (active) setDaemonDownload(PORTABLE_DAEMON_SOURCE_DOWNLOAD);
    });
    return () => { active = false; };
  }, []);

  return daemonDownload;
}

function parseWorkspacePluginDisplay(plugin: WorkspacePlugin): { name: string; description: string } {
  try {
    const manifest = JSON.parse(plugin.content) as Record<string, unknown>;
    return {
      name: typeof manifest.name === 'string' ? manifest.name : plugin.directory,
      description: typeof manifest.description === 'string' ? manifest.description : plugin.path,
    };
  } catch {
    return { name: plugin.directory, description: plugin.path };
  }
}

function MarketplaceExtensionCard({
  extension,
  installedExtensionIdSet,
  daemonDownload,
  onInstallExtension,
}: {
  extension: DefaultExtensionDescriptor;
  installedExtensionIdSet: Set<string>;
  daemonDownload: DaemonDownloadChoice;
  onInstallExtension: (extensionId: string) => void;
}) {
  const isInstalled = installedExtensionIdSet.has(extension.manifest.id);
  const category = getExtensionMarketplaceCategory(extension);
  const download = getDefaultExtensionDownload(extension.manifest, daemonDownload);

  return (
    <article className={`marketplace-card marketplace-card--${category}`}>
      <div className="marketplace-card-icon">
        <Icon name={getDefaultExtensionIcon(extension)} color="currentColor" />
      </div>
      <div className="marketplace-card-body">
        <strong>{extension.manifest.name}</strong>
        <span className="marketplace-card-author">{getDefaultExtensionSourceLabel(extension)}</span>
        <p className="marketplace-card-desc">{extension.manifest.description}</p>
        <div className="marketplace-card-meta">
          <span>{EXTENSION_MARKETPLACE_CATEGORY_LABELS[category]}</span>
          {category === 'daemon' ? <span>WebRTC peer detection</span> : null}
          {category === 'provider' ? <span>Account configurable</span> : null}
        </div>
      </div>
      {download ? (
        <a
          className="sidebar-icon-button marketplace-action marketplace-download-link"
          href={download.href}
          download={download.fileName}
          aria-label={`Download ${extension.manifest.name}${download.includeLabelInAria ? ` for ${download.label}` : ''}`}
          title={`Download ${extension.manifest.name}`}
        >
          <Icon name="download" size={13} />
        </a>
      ) : (
        <button
          type="button"
          className="sidebar-icon-button marketplace-action"
          disabled={isInstalled}
          aria-label={isInstalled ? `${extension.manifest.name} installed` : `Install ${extension.manifest.name}`}
          title={isInstalled ? `${extension.manifest.name} installed` : `Install ${extension.manifest.name}`}
          onClick={() => onInstallExtension(extension.manifest.id)}
        >
          <Icon name={isInstalled ? 'save' : 'plus'} size={13} />
        </button>
      )}
    </article>
  );
}

function MarketplacePanel({
  defaultExtensions,
  installedExtensionIds,
  onInstallExtension,
}: {
  defaultExtensions: DefaultExtensionRuntime | null;
  installedExtensionIds: string[];
  onInstallExtension: (extensionId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const daemonDownload = useResolvedDaemonDownloadChoice();
  const repoExtensions = defaultExtensions?.extensions ?? DEFAULT_EXTENSION_MANIFESTS;
  const installedExtensionIdSet = new Set(defaultExtensions?.installedExtensionIds ?? installedExtensionIds);
  const filtered = useMemo(() => repoExtensions.filter((extension) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [
      extension.manifest.name,
      extension.manifest.description,
      getDefaultExtensionSourceLabel(extension),
      EXTENSION_MARKETPLACE_CATEGORY_LABELS[getExtensionMarketplaceCategory(extension)],
      ...(extension.marketplace.categories ?? []),
      ...(extension.marketplace.keywords ?? []),
    ].some((value) => value.toLowerCase().includes(q));
  }), [repoExtensions, search]);
  const groups = useMemo(() => groupDefaultExtensionsByMarketplaceCategory(filtered), [filtered]);

  return (
    <section className="panel-scroll marketplace-panel" aria-label="Extension marketplace">
      <div className="panel-topbar marketplace-topbar">
        <div>
          <h2>Marketplace</h2>
          <p className="muted">{filtered.length} extensions</p>
        </div>
      </div>
      <label className="extensions-search shared-input-shell marketplace-search">
        <Icon name="search" size={13} color="#7d8594" />
        <input aria-label="Search marketplace" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter marketplace" />
      </label>
      <div className="marketplace-category-list">
        {EXTENSION_MARKETPLACE_CATEGORIES.map((category) => {
          const extensions = groups[category];
          return (
            <section key={category} className="marketplace-category-section" aria-labelledby={`marketplace-${category}-heading`}>
              <div className="marketplace-category-heading">
                <h3 id={`marketplace-${category}-heading`}>{EXTENSION_MARKETPLACE_CATEGORY_LABELS[category]}</h3>
                <span className="badge">{extensions.length}</span>
              </div>
              <div className="extensions-list marketplace-category-grid">
                {extensions.map((extension) => (
                  <MarketplaceExtensionCard
                    key={extension.manifest.id}
                    extension={extension}
                    installedExtensionIdSet={installedExtensionIdSet}
                    daemonDownload={daemonDownload}
                    onInstallExtension={onInstallExtension}
                  />
                ))}
                {extensions.length === 0 ? <p className="muted marketplace-empty">No matches in this category.</p> : null}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function ExtensionsPanel({
  workspaceName,
  capabilities,
  defaultExtensions,
  installedExtensionIds,
}: {
  workspaceName: string;
  capabilities: WorkspaceCapabilities;
  defaultExtensions: DefaultExtensionRuntime | null;
  installedExtensionIds: string[];
}) {
  const installedExtensions = getInstalledDefaultExtensionDescriptors(defaultExtensions, installedExtensionIds);
  const installedByCategory = groupDefaultExtensionsByMarketplaceCategory(installedExtensions);

  return (
    <section className="panel-scroll extensions-panel" aria-label="Installed extensions">
      <div className="panel-topbar extensions-topbar">
        <div>
          <h2>Installed extensions</h2>
          <p className="muted">{installedExtensions.length} installed</p>
        </div>
      </div>
      <SidebarSection
        title="Installed extensions"
        summary={`${installedExtensions.length} installed`}
        scrollBody
      >
        <div className="extensions-list">
          {installedExtensions.length === 0 ? <p className="muted extension-empty-state">No installed extensions</p> : null}
          {EXTENSION_MARKETPLACE_CATEGORIES.map((category) => {
            const extensions = installedByCategory[category];
            if (!extensions.length) return null;
            return (
              <div key={category} className="installed-extension-group">
                <span className="extension-group-label">{EXTENSION_MARKETPLACE_CATEGORY_LABELS[category]}</span>
                {extensions.map((extension) => (
                  <article key={extension.manifest.id} className="marketplace-card installed-extension-card">
                    <div className="marketplace-card-icon">
                      <Icon name={getDefaultExtensionIcon(extension)} color="currentColor" />
                    </div>
                    <div className="marketplace-card-body">
                      <strong>{extension.manifest.name}</strong>
                      <span className="marketplace-card-author">{getDefaultExtensionSourceLabel(extension)}</span>
                      <p className="marketplace-card-desc">{extension.manifest.description}</p>
                    </div>
                    <span className="badge connected">Installed</span>
                  </article>
                ))}
              </div>
            );
          })}
        </div>
      </SidebarSection>
      {capabilities.plugins.length > 0 && (
        <SidebarSection title={`Workspace plugins (${capabilities.plugins.length})`} summary={workspaceName} scrollBody>
          <div className="workspace-plugins-section">
            {capabilities.plugins.map((plugin) => {
              const display = parseWorkspacePluginDisplay(plugin);
              return (
                <div key={plugin.path} className="list-card extension-card">
                  <div className="extension-icon"><Icon name="puzzle" color="#f59e0b" /></div>
                  <div className="extension-content">
                    <div className="extension-title-row"><h3>{plugin.directory}</h3><small>{plugin.manifestName}</small></div>
                    <p>{display.name}</p>
                    <p className="muted">{display.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SidebarSection>
      )}
    </section>
  );
}

function AccountPanel({
  defaultExtensions,
}: {
  defaultExtensions: DefaultExtensionRuntime | null;
}) {
  const providerExtensions = (defaultExtensions?.extensions ?? DEFAULT_EXTENSION_MANIFESTS)
    .filter((extension) => getExtensionMarketplaceCategory(extension) === 'provider');

  return (
    <section className="panel-scroll account-panel" aria-label="Account">
      <div className="panel-topbar">
        <div className="settings-heading">
          <h2>Account</h2>
          <p className="muted">Provider access and account-scoped extension configuration.</p>
        </div>
      </div>

      <SettingsSection title="Provider extensions" scrollBody>
        <div className="provider-list">
          {providerExtensions.map((extension) => (
            <article key={extension.manifest.id} className="provider-card">
              <div className="provider-card-header">
                <div className="provider-body">
                  <strong>{extension.manifest.name}</strong>
                  <p>{extension.manifest.description}</p>
                </div>
                <span className="badge">Provider</span>
              </div>
              {extension.manifest.id === 'agent-harness.ext.local-model-connector' ? (
                <LocalModelSettings />
              ) : null}
            </article>
          ))}
        </div>
      </SettingsSection>
    </section>
  );
}

function WorkspaceSwitcherOverlay({
  workspaces,
  activeWorkspaceId,
  onSwitch,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onClose,
}: {
  workspaces: TreeNode[];
  activeWorkspaceId: string;
  onSwitch: (workspaceId: string) => void;
  onCreateWorkspace: () => void;
  onRenameWorkspace: (workspaceId: string) => void;
  onDeleteWorkspace?: (workspaceId: string) => void;
  onClose: () => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filteredWorkspaces = workspaces.filter((workspace) => {
    if (!query.trim()) return true;
    const normalized = query.trim().toLowerCase();
    const tabs = flattenTabs(workspace, 'browser').map((tab) => tab.name.toLowerCase()).join(' ');
    return workspace.name.toLowerCase().includes(normalized) || tabs.includes(normalized);
  });

  const handleSwitch = (id: string) => {
    onSwitch(id);
    onClose();
  };

  const handleCreate = () => {
    onCreateWorkspace();
    onClose();
  };

  return (
    <div className="ws-overlay-backdrop" role="dialog" aria-modal="true" aria-label="Workspace switcher" onClick={onClose}>
      <div className="modal-card workspace-switcher-card ws-overlay-content" onClick={(e) => e.stopPropagation()}>
        <div className="workspace-switcher-header">
          <div className="workspace-switcher-heading">
            <span className="panel-eyebrow">Workspace switcher</span>
            <div className="workspace-switcher-title-row">
              <h2>Workspaces</h2>
              <span className="badge">{workspaces.length} open</span>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close workspace switcher"><Icon name="x" /></button>
        </div>
        <div className="workspace-switcher-body">
          <label className="workspace-switcher-search shared-input-shell">
            <Icon name="search" size={13} color="#71717a" />
            <input aria-label="Search workspaces" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Switch to..." autoFocus />
          </label>
          <div className="workspace-switcher-list">
          {filteredWorkspaces.map((workspace) => {
            const isActive = workspace.id === activeWorkspaceId;
            const isHovered = workspace.id === hoveredId;
            const color = workspace.color ?? '#60a5fa';
            const tabCount = countTabs(workspace);
            const previewTabs = flattenTabs(workspace, 'browser').slice(0, 3);
            const memoryTotal = totalMemoryMB(workspace);
            const previewLabel = previewTabs.length ? previewTabs.map((tab) => tab.name).join(' · ') : 'No pages yet';

            return (
              <div
                key={workspace.id}
                className={`workspace-card workspace-card-row ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredId(workspace.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <button
                  type="button"
                  className="workspace-card-button"
                  onClick={() => handleSwitch(workspace.id)}
                >
                  <span className="workspace-swatch" style={{ background: `${color}1c`, borderColor: `${color}55` }}>
                    <span className="workspace-swatch-dot" style={{ background: color }} />
                  </span>
                  <div className="workspace-card-main">
                    <div className="workspace-card-title-row">
                      <span className="workspace-hotkey-chip">{workspaces.indexOf(workspace) + 1}</span>
                      <strong className="ws-card-name" onDoubleClick={(event) => { event.stopPropagation(); onRenameWorkspace(workspace.id); }}>{workspace.name}</strong>
                      {isActive ? <span className="badge connected">Active</span> : null}
                    </div>
                    <span className="ws-card-tab-count">{tabCount} tabs · {memoryTotal.toLocaleString()} MB</span>
                    <span className="ws-card-tabs">{previewLabel}</span>
                  </div>
                </button>
                {isHovered && !isActive && workspaces.length > 1 && onDeleteWorkspace && (
                  <button
                    type="button"
                    className="workspace-card-delete"
                    onClick={(e) => { e.stopPropagation(); onDeleteWorkspace(workspace.id); }}
                    aria-label={`Delete workspace ${workspace.name}`}
                  >
                    <Icon name="x" size={10} color="rgba(255,255,255,.5)" />
                  </button>
                )}
              </div>
            );
          })}
          {!filteredWorkspaces.length ? <div className="workspace-empty-state-row">No workspaces match this query.</div> : null}
          <div className="workspace-card workspace-card-row ws-card-new">
            <button type="button" className="workspace-card-button" onClick={handleCreate}>
              <span className="workspace-swatch workspace-swatch-new">
                <Icon name="plus" size={14} color="rgba(255,255,255,.65)" />
              </span>
              <div className="workspace-card-main">
                <div className="workspace-card-title-row">
                  <strong className="ws-card-name">New workspace</strong>
                </div>
                <span className="ws-card-tab-count">Empty context</span>
                <span className="ws-card-tabs">Ctrl+Alt+N</span>
              </div>
            </button>
          </div>
        </div>
        <div className="workspace-switcher-actions">
          <div className="workspace-switcher-shortcuts" aria-hidden="true">
            <span className="workspace-hotkey-chip">Ctrl+1-9</span>
            <span>jump</span>
            <span className="workspace-hotkey-chip">Ctrl+Alt+←/→</span>
            <span>cycle</span>
          </div>
          <div className="ws-overlay-hints">
            <span>Enter open</span>
            <span>Ctrl+Alt+N new workspace</span>
            <span>Double-click name rename</span>
            <span>Esc close</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function ShortcutOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={onClose}>
      <div className="modal-card shortcuts-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="panel-eyebrow">Hotkeys</span>
            <h2>Keyboard Shortcuts</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close keyboard shortcuts"><Icon name="x" /></button>
        </div>
        <div className="shortcut-groups">
          {WORKSPACE_SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="shortcut-group">
              <h3>{group.title}</h3>
              <ul className="shortcut-list">
                {group.items.map((item) => (
                  <li key={item.keys}>
                    <span>{item.description}</span>
                    <kbd>{item.keys}</kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="shortcut-overlay-footer">Press Esc or click outside to close</div>
      </div>
    </div>
  );
}

function RenameWorkspaceOverlay({
  value,
  onChange,
  onSave,
  onClose,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Rename workspace" onClick={onClose}>
      <div className="modal-card compact" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="panel-eyebrow">Workspace</span>
            <h2>Rename workspace</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close rename workspace"><Icon name="x" /></button>
        </div>
        <div className="add-file-form">
          <label className="file-editor-field">
            <span>Name</span>
            <input aria-label="Workspace name" value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSave(); }} />
          </label>
          <div className="add-file-buttons">
            <button type="button" className="primary-button" onClick={onSave}>Save</button>
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── GitGraph ─────────────────────────────────────────────────────────────────

function GitGraph({ dag, onSelectCommit, selectedCommitId }: {
  dag: VersionDAG;
  onSelectCommit?: (commitId: string) => void;
  selectedCommitId?: string | null;
}) {
  const commits = getTopologicalOrder(dag);
  const lanes = computeLanes(dag);
  const numLanes = Math.max(1, Object.keys(dag.branches).length);
  const COL_W = 28, ROW_H = 40, R = 7, PAD = 16;
  const svgW = numLanes * COL_W + PAD * 2 + 160;
  const svgH = commits.length * ROW_H + PAD * 2;

  const cx = (branchId: string) => PAD + (lanes.get(branchId) ?? 0) * COL_W + R;
  const cy = (idx: number) => PAD + idx * ROW_H + R;

  const branchColors = Object.fromEntries(Object.values(dag.branches).map((b) => [b.id, b.color]));

  return (
    <svg width={svgW} height={svgH} aria-label="Commit graph" role="img" className="gitgraph-svg">
      {commits.map((commit, i) => {
        const x = cx(commit.branchId);
        const y = cy(i);
        const color = branchColors[commit.branchId] ?? '#60a5fa';
        return commit.parentIds.map((parentId) => {
          const parentIdx = commits.findIndex((c) => c.id === parentId);
          if (parentIdx < 0) return null;
          const px = cx(commits[parentIdx].branchId);
          const py = cy(parentIdx);
          return (
            <path key={`${commit.id}-${parentId}`} d={`M${x},${y} C${x},${(y + py) / 2} ${px},${(y + py) / 2} ${px},${py}`}
              fill="none" stroke={color} strokeWidth={2} opacity={0.7} />
          );
        });
      })}
      {commits.map((commit, i) => {
        const x = cx(commit.branchId);
        const y = cy(i);
        const color = branchColors[commit.branchId] ?? '#60a5fa';
        const isSelected = commit.id === selectedCommitId;
        const isCurrent = commit.id === dag.currentCommitId;
        return (
          <g key={commit.id} onClick={() => onSelectCommit?.(commit.id)} style={{ cursor: 'pointer' }}>
            <circle cx={x} cy={y} r={R + 2} fill="transparent" />
            <circle cx={x} cy={y} r={isSelected || isCurrent ? R : R - 1}
              fill={isCurrent ? '#fff' : color}
              stroke={color} strokeWidth={isCurrent ? 2 : 1.5} />
            <text x={x + R + 6} y={y + 4} fontSize={11} fill={isSelected ? '#fff' : '#a9b1ba'} fontFamily="inherit">
              {commit.message.length > 22 ? commit.message.slice(0, 22) + '…' : commit.message}
            </text>
          </g>
        );
      })}
      {Object.values(dag.branches).map((branch) => {
        const headCommit = dag.commits[branch.headCommitId];
        if (!headCommit) return null;
        const headIdx = commits.findIndex((c) => c.id === branch.headCommitId);
        if (headIdx < 0) return null;
        const x = cx(branch.id);
        const y = cy(headIdx) - R - 6;
        return (
          <text key={branch.id} x={x} y={y} textAnchor="middle" fontSize={9} fill={branch.color} fontWeight={600} fontFamily="inherit">
            {branch.name}
          </text>
        );
      })}
    </svg>
  );
}

// ── Properties modal ──────────────────────────────────────────────────────────

function PropertiesModal({ metadata, nodeName, onClose }: { metadata: NodeMetadata; nodeName: string; onClose: () => void }) {
  const fmt = (ts: number) => new Date(ts).toLocaleString();
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Properties">
      <div className="modal-card props-modal">
        <div className="modal-header">
          <h2>{nodeName} — Properties</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close Properties"><X size={14} /></button>
        </div>
        <div className="props-body">
          <section className="props-section">
            <dl className="props-dl">
              <dt>Location</dt><dd className="props-mono">{metadata.location}</dd>
              <dt>Size</dt><dd>{metadata.sizeLabel}</dd>
              <dt>Created</dt><dd>{fmt(metadata.createdAt)}</dd>
              <dt>Modified</dt><dd>{fmt(metadata.modifiedAt)}</dd>
              <dt>Accessed</dt><dd>{fmt(metadata.accessedAt)}</dd>
            </dl>
          </section>
          <section className="props-section">
            <h3>Permissions</h3>
            <table role="table" aria-label="Permissions" className="props-table">
              <thead>
                <tr>
                  <th>Identity</th>
                  {metadata.identityPermissions[0]?.permissions.map((p) => <th key={p.action}>{p.action}</th>)}
                </tr>
              </thead>
              <tbody>
                {metadata.identityPermissions.map(({ identity, permissions }) => (
                  <tr key={identity.id}>
                    <td>
                      <span className={`identity-badge identity-badge--${identity.type}`}>{identity.name}</span>
                    </td>
                    {permissions.map((p) => (
                      <td key={p.action} className={p.allowed ? 'perm-allow' : 'perm-deny'} title={p.allowed ? 'Allowed' : 'Denied'}>
                        {p.allowed ? '✓' : '✗'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── History modals ────────────────────────────────────────────────────────────

function BrowserHistoryModal({ navHistory, onBack, onForward, onClose }: {
  navHistory: BrowserNavHistory;
  onBack: () => void;
  onForward: () => void;
  onClose: () => void;
}) {
  // Build a minimal VersionDAG from nav history entries for the gitgraph
  const dag = useMemo<VersionDAG>(() => {
    if (navHistory.entries.length === 0) {
      return createVersionDAG('(empty)', 'system', 'Start', Date.now());
    }
    let d = createVersionDAG(navHistory.entries[0].url, 'system', navHistory.entries[0].title || navHistory.entries[0].url, navHistory.entries[0].timestamp);
    for (let i = 1; i < navHistory.entries.length; i++) {
      const e = navHistory.entries[i];
      d = commitToDAG(d, e.url, 'system', e.title || e.url, e.timestamp);
    }
    return d;
  }, [navHistory]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Browser history">
      <div className="modal-card history-modal">
        <div className="modal-header">
          <h2>Browser history</h2>
          <div className="history-nav-btns">
            <button type="button" className="secondary-button" onClick={onBack} disabled={navHistory.currentIndex <= 0} aria-label="Back">← Back</button>
            <button type="button" className="secondary-button" onClick={onForward} disabled={navHistory.currentIndex >= navHistory.entries.length - 1} aria-label="Forward">Forward →</button>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close Browser history"><X size={14} /></button>
        </div>
        <div className="history-body">
          <div className="history-graph-area">
            <GitGraph dag={dag} selectedCommitId={dag.currentCommitId} />
          </div>
          <ul className="history-entry-list">
            {[...navHistory.entries].reverse().map((entry, i) => {
              const realIdx = navHistory.entries.length - 1 - i;
              return (
                <li key={realIdx} className={`history-entry ${realIdx === navHistory.currentIndex ? 'history-entry--current' : ''}`}>
                  <span className="history-entry-url">{entry.url}</span>
                  <span className="history-entry-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function VersionHistoryModal({ dag, dialogLabel, rowActions, onClose }: {
  dag: VersionDAG;
  dialogLabel: string;
  rowActions: (commitId: string, isCurrentHead: boolean) => React.ReactNode;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const commits = useMemo(() => getTopologicalOrder(dag).reverse(), [dag]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={dialogLabel}>
      <div className="modal-card history-modal">
        <div className="modal-header">
          <h2>{dialogLabel}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={`Close ${dialogLabel}`}><X size={14} /></button>
        </div>
        <div className="history-body">
          <div className="history-graph-area">
            <GitGraph dag={dag} selectedCommitId={selectedId ?? dag.currentCommitId} onSelectCommit={setSelectedId} />
          </div>
          <ul className="history-entry-list">
            {commits.map((commit) => {
              const branch = dag.branches[commit.branchId];
              const isHead = commit.id === dag.currentCommitId;
              return (
                <li key={commit.id} className={`history-entry ${isHead ? 'history-entry--current' : ''}`}
                  onClick={() => setSelectedId(commit.id)}>
                  <div className="history-entry-row">
                    <span className="history-entry-branch" style={{ color: branch?.color }}>{branch?.name ?? commit.branchId}</span>
                    <span className="history-entry-msg">{commit.message}</span>
                    {isHead && <span className="history-entry-badge">HEAD</span>}
                  </div>
                  <div className="history-entry-meta">
                    <span>{commit.authorId}</span>
                    <span>{new Date(commit.timestamp).toLocaleString()}</span>
                    <div className="history-entry-actions">
                      {rowActions(commit.id, isHead)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

type ContextMenuEntry = { label: string; onClick: () => void } | 'separator';
type ContextMenuSplitOption = { icon: LucideIcon; label: string; onClick: () => void };
type ContextMenuTopButton = { icon: LucideIcon; label: string } & (
  | { onClick: () => void; subMenu?: never; splitOptions?: never }
  | { subMenu: ContextMenuEntry[]; onClick?: never; splitOptions?: never }
  | { onClick: () => void; splitOptions: ContextMenuSplitOption[]; subMenu?: never }
);
type AppContextMenuItemType = WorkspaceMcpWorktreeItemType | 'workspace' | 'workspace-section' | 'app-shell';
type AppContextMenuState = Omit<WorkspaceContextMenuState<ContextMenuEntry, ContextMenuTopButton>, 'itemType'> & {
  itemType: AppContextMenuItemType;
};

const WORKTREE_CONTEXT_MENU_ITEM_TYPES = new Set<string>([
  'browser-page',
  'session',
  'workspace-file',
  'artifact',
  'artifact-file',
  'session-fs-entry',
  'clipboard',
]);

function hasWorkspaceSectionContextMenu(node: TreeNode) {
  return node.type === 'folder' && (
    node.nodeKind === 'browser'
    || node.nodeKind === 'session'
    || node.nodeKind === 'files'
  );
}

function hasNodeContextMenu(node: TreeNode) {
  const isVfsNode = node.id.startsWith('vfs:') && !node.nodeKind;
  const isArtifactNode = Boolean(node.artifactId || node.artifactReferenceId);
  return node.type === 'workspace'
    || node.type === 'tab'
    || node.type === 'file'
    || isVfsNode
    || isArtifactNode
    || hasWorkspaceSectionContextMenu(node);
}

function isWorktreeContextMenuState(
  menu: AppContextMenuState | null,
): menu is WorkspaceContextMenuState<ContextMenuEntry, ContextMenuTopButton> {
  return Boolean(menu && WORKTREE_CONTEXT_MENU_ITEM_TYPES.has(menu.itemType));
}

type FileOpKind = 'move' | 'symlink' | 'duplicate';
type PickerRow = { name: string; isUp: boolean };

const FILE_OP_LIST_ID = 'file-op-picker-list';

function FileOpPicker({ op, directories, onConfirm, onClose }: {
  op: FileOpKind;
  directories: string[];
  onConfirm: (targetDir: string) => void;
  onClose: () => void;
}) {
  const opLabel = op === 'move' ? 'Move' : op === 'symlink' ? 'Symlink' : 'Duplicate';
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentDir, setCurrentDir] = useState('');
  const [filter, setFilter] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);

  // Unique direct children of currentDir, filtered by the typed filter prefix
  const filtered = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const children: string[] = [];
    for (const dir of directories) {
      if (!dir.startsWith(currentDir) || dir === currentDir) continue;
      const rest = dir.slice(currentDir.length);
      const seg = rest.split('/')[0];
      if (seg && !seen.has(seg)) {
        seen.add(seg);
        children.push(seg);
      }
    }
    children.sort();
    return filter
      ? children.filter((c) => c.toLowerCase().startsWith(filter.toLowerCase()))
      : children;
  }, [currentDir, filter, directories]);

  const rows = useMemo<PickerRow[]>(() => [
    ...(currentDir ? [{ name: '..', isUp: true } as PickerRow] : []),
    ...filtered.map((name): PickerRow => ({ name, isUp: false })),
  ], [currentDir, filtered]);

  // Use the explicit activeIdx unless it's -1 AND exactly one non-.. row:
  // auto-highlight that single match so "Add" is offered instead of "Create & Add".
  const effectiveActive = useMemo<number>(() => {
    if (activeIdx >= 0 && activeIdx < rows.length) return activeIdx;
    const dirRows = rows.filter((r) => !r.isUp);
    if (dirRows.length === 1) return rows.findIndex((r) => !r.isUp);
    return -1;
  }, [activeIdx, rows]);

  const isCreate = filter !== '' && effectiveActive < 0;
  const actionLabel = isCreate ? `Create & ${opLabel}` : opLabel;

  const ascend = useCallback(() => {
    const trimmed = currentDir.replace(/\/$/, '');
    const idx = trimmed.lastIndexOf('/');
    setCurrentDir(idx >= 0 ? trimmed.slice(0, idx + 1) : '');
    setFilter('');
    setActiveIdx(-1);
  }, [currentDir]);

  const descend = useCallback((name: string) => {
    setCurrentDir((prev) => prev + name + '/');
    setFilter('');
    setActiveIdx(-1);
  }, []);

  const handleConfirm = useCallback(() => {
    const row = effectiveActive >= 0 ? rows[effectiveActive] : null;
    const target = row && !row.isUp
      ? currentDir + row.name
      : currentDir + filter;
    onConfirm(target.replace(/\/+$/, ''));
  }, [effectiveActive, rows, currentDir, filter, onConfirm]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const withoutPrefix = val.startsWith('~/') ? val.slice(2) : val;
    const lastSlash = withoutPrefix.lastIndexOf('/');
    if (lastSlash >= 0) {
      setCurrentDir(withoutPrefix.slice(0, lastSlash + 1));
      setFilter(withoutPrefix.slice(lastSlash + 1));
    } else {
      setCurrentDir('');
      setFilter(withoutPrefix);
    }
    setActiveIdx(-1);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = effectiveActive >= 0 ? rows[effectiveActive] : null;
      if (row) {
        if (row.isUp) ascend();
        else descend(row.name);
      } else if (filter) {
        onConfirm((currentDir + filter).replace(/\/+$/, ''));
      } else {
        onConfirm(currentDir.replace(/\/+$/, ''));
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rows.length > 0) setActiveIdx((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rows.length > 0) setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Backspace' && filter === '' && currentDir !== '') {
      e.preventDefault();
      ascend();
    }
  }, [effectiveActive, rows, filter, currentDir, handleConfirm, ascend, descend, onConfirm, onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${opLabel} file`} onClick={onClose}>
      <div className="file-op-picker" onClick={(e) => e.stopPropagation()}>
        {/* Header: back button + breadcrumb input + action button */}
        <div className="file-op-picker-header">
          {currentDir && (
            <button type="button" className="file-op-picker-back" onClick={ascend} aria-label="Go up one directory">
              <ArrowLeft size={14} />
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            aria-label="Target directory"
            aria-controls={FILE_OP_LIST_ID}
            aria-activedescendant={effectiveActive >= 0 ? `fop-row-${effectiveActive}` : undefined}
            className="file-op-picker-breadcrumb"
            value={`~/${currentDir}${filter}`}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            autoFocus
            spellCheck={false}
          />
          <button
            type="button"
            className="file-op-picker-action"
            onClick={handleConfirm}
            aria-label={`Confirm ${opLabel}`}
          >
            <span>{actionLabel}</span>
            <kbd className="kbd">{isCreate ? 'Enter' : 'Ctrl\u00a0Enter'}</kbd>
          </button>
        </div>

        {/* Directory list */}
        {rows.length > 0 && (
          <div className="file-op-picker-section" aria-hidden="true">Directories</div>
        )}
        <ul
          id={FILE_OP_LIST_ID}
          role="listbox"
          aria-label="Directories"
          className="file-op-picker-list"
        >
          {rows.map((row, i) => (
            <li
              key={row.name}
              id={`fop-row-${i}`}
              role="option"
              aria-selected={effectiveActive === i}
              className={`file-op-picker-row${effectiveActive === i ? ' file-op-picker-row--active' : ''}`}
              onClick={() => (row.isUp ? ascend() : descend(row.name))}
              onMouseEnter={() => setActiveIdx(i)}
            >
              {row.isUp ? <ArrowLeft size={14} /> : <Folder size={14} />}
              <span>{row.name}</span>
            </li>
          ))}
        </ul>

        {/* Keyboard hint footer */}
        <div className="file-op-picker-footer">
          <span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> Navigate</span>
          <span><kbd className="kbd">Enter</kbd> Select</span>
          <span><kbd className="kbd">Backspace</kbd> Back</span>
          <span><kbd className="kbd">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}

function FileOpModal({ op, directories, onConfirm, onClose }: {
  op: FileOpKind;
  directories: string[];
  onConfirm: (targetDir: string) => void;
  onClose: () => void;
}) {
  return (
    <FileOpPicker
      op={op}
      directories={directories}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}

function NewTabModal({ onConfirm, onClose }: {
  onConfirm: (url: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="New browser tab" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>New browser tab</span>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close New browser tab"><X size={14} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>URL</span>
            <input
              type="url"
              aria-label="URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') onConfirm(url); }}
              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(0,0,0,.3)', color: 'inherit' }}
            />
          </label>
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 12px' }}>
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary-button" onClick={() => onConfirm(url)} aria-label="Open">Open</button>
        </div>
      </div>
    </div>
  );
}

function ClipboardHistoryModal({ history, onRollback, onClose }: {
  history: ClipboardEntry[];
  onRollback: (entry: ClipboardEntry) => void;
  onClose: () => void;
}) {
  const activeId = history[0]?.id ?? null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Clipboard history">
      <div className="modal-card history-modal">
        <div className="modal-header">
          <h2>Clipboard history</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close Clipboard history"><X size={14} /></button>
        </div>
        <div className="history-body">
          <ul className="history-entry-list">
            {history.length === 0 ? (
              <li className="history-entry" style={{ opacity: 0.5 }}>No clipboard history yet</li>
            ) : history.map((entry) => {
              const isCurrent = entry.id === activeId;
              return (
                <li key={entry.id} className={`history-entry ${isCurrent ? 'history-entry--current' : ''}`}>
                  <div className="history-entry-row">
                    <span className="history-entry-msg">{entry.label}</span>
                    {isCurrent && <span className="history-entry-badge">Active</span>}
                  </div>
                  <div className="history-entry-meta">
                    <span style={{ fontFamily: 'monospace', wordBreak: 'break-all', opacity: 0.75 }}>{entry.text.length > 120 ? `${entry.text.slice(0, 120)}…` : entry.text}</span>
                    <span>{new Date(entry.timestamp).toLocaleString()}</span>
                    <div className="history-entry-actions">
                      {!isCurrent && (
                        <button type="button" className="secondary-button btn-xs" onClick={() => onRollback(entry)} aria-label={`Restore: ${entry.label}`}>
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ContextMenu({ x, y, entries, topButtons, onClose }: { x: number; y: number; entries: ContextMenuEntry[]; topButtons?: ContextMenuTopButton[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [activeSubMenu, setActiveSubMenu] = useState<ContextMenuEntry[] | null>(null);
  const [subMenuLabel, setSubMenuLabel] = useState('');
  const [openSplitIndex, setOpenSplitIndex] = useState<number | null>(null);

  // Focus the first menu item when the menu opens, or when sub-menu changes
  useEffect(() => {
    const firstItem = ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    firstItem?.focus();
  }, [activeSubMenu]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [onClose]);

  function handleKeyDown(event: React.KeyboardEvent) {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(currentIndex + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    }
  }

  const displayEntries = activeSubMenu ?? entries;
  const style: React.CSSProperties = { left: x, top: y };

  return (
    <div ref={ref} className="ctx-menu" style={style} role="menu" aria-label="Context menu" onKeyDown={handleKeyDown}>
      {topButtons && !activeSubMenu && (
        <>
          <div className="ctx-menu-toolbar" role="group" aria-label="Quick actions">
            {topButtons.map((btn, i) =>
              btn.subMenu
                ? <button key={i} type="button" role="menuitem" className="ctx-menu-toolbar-btn" aria-label={btn.label} onClick={() => { setSubMenuLabel(btn.label); setActiveSubMenu(btn.subMenu!); }}>
                    <btn.icon size={16} strokeWidth={1.5} /><span>{btn.label}</span>
                  </button>
                : btn.splitOptions
                  ? <span key={i} className="ctx-split-btn" role="group" aria-label={btn.label}>
                      <button type="button" role="menuitem" className="ctx-menu-toolbar-btn ctx-split-main" aria-label={btn.label} onClick={() => { btn.onClick(); onClose(); }}>
                        <btn.icon size={16} strokeWidth={1.5} /><span>{btn.label}</span>
                      </button>
                      <button
                        type="button"
                        className="ctx-split-chevron"
                        aria-label={`${btn.label} options`}
                        aria-expanded={openSplitIndex === i}
                        onClick={(e) => { e.stopPropagation(); setOpenSplitIndex(openSplitIndex === i ? null : i); }}
                      >
                        <ChevronDown size={10} />
                      </button>
                      {openSplitIndex === i && (
                        <div className="ctx-split-dropdown" role="menu">
                          {btn.splitOptions.map((opt, oi) => (
                            <button key={oi} type="button" role="menuitem" className="ctx-menu-item" onClick={() => { opt.onClick(); onClose(); }}>
                              <opt.icon size={13} strokeWidth={1.5} />{opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </span>
                  : <button key={i} type="button" role="menuitem" className="ctx-menu-toolbar-btn" aria-label={btn.label} onClick={() => { btn.onClick(); onClose(); }}>
                      <btn.icon size={16} strokeWidth={1.5} /><span>{btn.label}</span>
                    </button>
            )}
          </div>
          {displayEntries.length > 0 && <div className="ctx-menu-sep" role="separator" />}
        </>
      )}
      {activeSubMenu && (
        <>
          <button type="button" role="button" className="ctx-menu-back-btn" aria-label="Back" onClick={() => setActiveSubMenu(null)}>
            <ArrowLeft size={11} />{subMenuLabel}
          </button>
          <div className="ctx-menu-sep" role="separator" />
        </>
      )}
      {displayEntries.map((entry, i) =>
        entry === 'separator'
          ? <div key={i} className="ctx-menu-sep" role="separator" />
          : <button key={i} type="button" className="ctx-menu-item" role="menuitem" onClick={() => { entry.onClick(); onClose(); }}>{entry.label}</button>
      )}
    </div>
  );
}

// — Session FS scaffold templates ——————————————————————————

function makeAgentHook(basePath: string): { path: string; content: string } {
  return {
    path: `${basePath}/.agents/hooks/pre-tool.sh`,
    content: [
      '#!/usr/bin/env bash',
      '# Pre-tool hook compatible with Claude Code, OpenAI Codex, GitHub Copilot',
      '# Environment variables:',
      '#   AGENT_TOOL  - name of the tool being called',
      '#   AGENT_INPUT - JSON-encoded input to the tool',
      '#   AGENT_CWD   - current working directory',
      '# Exit 0 to allow execution, non-zero to block (where supported).',
      'set -euo pipefail',
      '',
      'echo "Pre-tool hook: ${AGENT_TOOL:-unknown}"',
      'exit 0',
    ].join('\n'),
  };
}

/** Parse a vfs node id into the session tab id and the filesystem path to create inside. */
function parseVfsNodeId(nodeId: string): { sessionId: string; basePath: string; isDriveRoot: boolean } | null {
  if (!nodeId.startsWith('vfs:')) return null;
  const withoutPrefix = nodeId.slice('vfs:'.length); // e.g. `ws-research:abc-123` or `ws-research:abc-123:drive:workspace:notes`
  const driveMarker = ':drive:';
  const di = withoutPrefix.indexOf(driveMarker);
  if (di === -1) {
    // This IS the session FS drive node itself — default to /workspace
    const parts = withoutPrefix.split(':');
    return { sessionId: parts[parts.length - 1], basePath: '/workspace', isDriveRoot: true };
  }
  const prefix = withoutPrefix.slice(0, di); // `ws-research:abc-123`
  const prefixParts = prefix.split(':');
  const sessionId = prefixParts[prefixParts.length - 1];
  const drivePath = withoutPrefix.slice(di + driveMarker.length); // `workspace` or `workspace:sub` or `tmp:cache`
  const basePath = '/' + drivePath.split(':').join('/');
  return { sessionId, basePath, isDriveRoot: false };
}

function inferSessionFsEntryKind(paths: readonly string[], path: string): 'file' | 'folder' {
  const normalizedPath = path.length > 1 ? path.replace(/\/+$/, '') : path;
  if (normalizedPath === BASH_INITIAL_CWD) {
    return 'folder';
  }
  if (paths.some((candidate) => candidate !== path && candidate.startsWith(`${normalizedPath}/`))) {
    return 'folder';
  }
  return /\.[^/]+$/.test(normalizedPath) ? 'file' : 'folder';
}

function SidebarTree({ root, workspaceByNodeId, activeWorkspaceId, openTabIds, activeSessionIds, editingFilePath, activeArtifactPanel, cursorId, selectedIds, onCursorChange, onToggleFolder, onOpenTab, onOpenFile, onAddFile, onAddAgent, onAddBrowserTab, onNodeContextMenu, items }: { root: TreeNode; workspaceByNodeId: Map<string, string>; activeWorkspaceId: string; openTabIds: string[]; activeSessionIds: string[]; editingFilePath: string | null; activeArtifactPanel?: { artifactId: string; filePath?: string | null } | null; cursorId: string | null; selectedIds: string[]; onCursorChange: (id: string) => void; onToggleFolder: (id: string) => void; onOpenTab: (id: string, multi?: boolean) => void; onOpenFile: (id: string) => void; onAddFile: (workspaceId: string) => void; onAddAgent: (workspaceId: string) => void; onAddBrowserTab: (workspaceId: string) => void; onNodeContextMenu: (x: number, y: number, node: TreeNode) => void; items: FlatTreeItem[] }) {
  return (
    <div className="tree-panel" role="tree" aria-label="Workspace tree">
      {items.map(({ node, depth }) => {
        const isFolder = node.type !== 'tab' && node.type !== 'file';
        const isWorkspace = node.type === 'workspace';
        const isFile = node.type === 'file';
        const isActiveWs = isWorkspace && node.id === activeWorkspaceId;
        const isEditingFile = isFile && node.filePath === editingFilePath;
        const nodeArtifactId = node.artifactReferenceId ?? node.artifactId;
        const isActiveArtifact = Boolean(
          nodeArtifactId
          && activeArtifactPanel?.artifactId === nodeArtifactId
          && (!node.artifactFilePath || activeArtifactPanel.filePath === node.artifactFilePath),
        );
        const isSelected = selectedIds.includes(node.id);
        const isCursor = cursorId === node.id;
        const tabOpacity = node.type === 'tab' ? (node.memoryTier === 'cold' ? 0.5 : node.memoryTier === 'cool' ? 0.65 : 0.9) : undefined;
        const workspaceParentId = workspaceByNodeId.get(node.id);
        const workspaceParent = workspaceParentId ? getWorkspace(root, workspaceParentId) : null;
        const hasContextMenu = hasNodeContextMenu(node);
        const openEllipsis = (e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          onNodeContextMenu(rect.right, rect.bottom, node);
        };
        return (
          <div key={node.id} role="treeitem" aria-selected={isSelected || isCursor} className={`tree-row ${isWorkspace ? 'ws-node' : ''} ${isActiveWs ? 'ws-active' : ''} ${isCursor ? 'cursor' : ''} ${openTabIds.includes(node.id) || activeSessionIds.includes(node.id) ? 'active' : ''} ${isEditingFile || isActiveArtifact ? 'active' : ''} ${isSelected ? 'selected' : ''} ${isFile ? 'file-node' : ''} ${node.isReference ? 'tree-row-reference' : ''}`} style={{ paddingLeft: `${depth * 16}px` }}
            onContextMenu={hasContextMenu ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onNodeContextMenu(e.clientX, e.clientY, node);
            } : undefined}
          >
            <button type="button" tabIndex={isCursor ? 0 : -1} className="tree-button" style={tabOpacity !== undefined ? { opacity: tabOpacity } : undefined} onFocus={() => onCursorChange(node.id)} onClick={(event) => isFile ? onOpenFile(node.id) : isFolder ? onToggleFolder(node.id) : onOpenTab(node.id, event.ctrlKey || event.metaKey)}>
              {isFile ? (
                <><span className="tree-chevron-spacer" /><Icon name={node.isReference ? 'link' : 'file'} size={12} color={node.isReference ? '#fbbf24' : '#a5b4fc'} /></>
              ) : isFolder ? (
                <>
                  <span className={`tree-chevron ${node.expanded ? 'tree-chevron-expanded' : ''}`}><Icon name="chevronRight" size={11} color="rgba(255,255,255,.25)" /></span>
                  {isWorkspace && node.activeMemory ? <ActiveMemoryPulse /> : null}
                  {isWorkspace && node.persisted ? <span className="persist-badge" title="Persisted" aria-label="Persisted workspace">📌</span> : null}
                  {node.nodeKind === 'browser' ? <Icon name="globe" size={12} color="#93c5fd" /> : null}
                  {node.nodeKind === 'session' ? <Icon name="terminal" size={12} color="#86efac" /> : null}
                  {node.nodeKind === 'files' ? <Icon name="cpu" size={12} color="#a5b4fc" /> : null}
                  {!node.nodeKind ? <Icon name={node.isDrive ? 'hardDrive' : node.expanded ? 'folderOpen' : 'folder'} size={isWorkspace ? 13 : 12} color={node.isDrive ? '#a5b4fc' : isWorkspace && node.activeMemory ? '#34d399' : node.color ?? '#60a5fa'} /> : null}
                </>
              ) : (
                <>
                  <span className="tree-chevron-spacer" />
                  {node.nodeKind === 'browser' ? (
                    <>
                      <span className="tier-dot" style={{ background: TIERS[node.memoryTier ?? 'cold'].color }} />
                      <Favicon url={node.url} size={13} />
                    </>
                  ) : node.nodeKind === 'clipboard' ? (
                    <Icon name="clipboard" size={13} color="#a5b4fc" />
                  ) : <Icon name="terminal" size={13} color="#86efac" />}
                </>
              )}
              <span className={isWorkspace && !node.persisted ? 'ws-name-temp' : ''}>{node.name}</span>
              {node.type === 'tab' && node.nodeKind === 'browser' ? <span className="tree-meta">{fmtMem(node.memoryMB ?? 0)}</span> : null}
              {isWorkspace ? <span className="tree-meta">{countTabs(node)} tabs · {fmtMem(totalMemoryMB(node))}</span> : null}
            </button>
            {hasContextMenu ? <button type="button" className="icon-button subtle tree-row-ellipsis" tabIndex={isCursor ? 0 : -1} aria-label={`More actions for ${node.name}`} onClick={openEllipsis}><MoreHorizontal size={13} /></button> : null}
            {node.type === 'folder' && node.nodeKind === 'browser' && workspaceParent ? <button type="button" className="icon-button subtle" aria-label={`Add browser tab to ${workspaceParent.name}`} onClick={() => onAddBrowserTab(workspaceParent.id)}><Icon name="plus" size={11} /></button> : null}
            {node.type === 'folder' && node.nodeKind === 'files' && workspaceParent ? <button type="button" className="icon-button subtle" aria-label={`Add file to ${workspaceParent.name}`} onClick={() => onAddFile(workspaceParent.id)}><Icon name="plus" size={11} /></button> : null}
            {node.type === 'folder' && node.nodeKind === 'session' && workspaceParent ? <button type="button" className="icon-button subtle" aria-label={`Add session to ${workspaceParent.name}`} onClick={() => onAddAgent(workspaceParent.id)}><Icon name="plus" size={11} /></button> : null}

          </div>
        );
      })}
    </div>
  );
}

function Toast({ toast }: { toast: ToastState }) {
  return toast ? <div className={`toast ${toast.type}`} role="status" aria-live="polite">{toast.msg}</div> : null;
}

function panelKey(panel: Panel): string {
  if (panel.type === 'dashboard') return `dashboard:${panel.workspaceId}`;
  if (panel.type === 'file') return `file:${panel.file.path}`;
  if (panel.type === 'artifact') return `artifact:${panel.artifact.id}:${panel.file?.path ?? ''}`;
  if (panel.type === 'browser') return `browser:${panel.tab.id}`;
  return `session:${panel.id}`;
}

function SortablePanelCell({ id, children }: { id: string; children: (dragHandleProps: PanelDragHandleProps) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const dragHandleProps = listeners as PanelDragHandleProps;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={['panel-drag-cell', isDragging ? 'panel-drag-cell--dragging' : ''].filter(Boolean).join(' ')}
      {...attributes}
    >
      {children(dragHandleProps)}
    </div>
  );
}

function PanelSplitView({
  panels,
  renderPanel,
  onOrderChange,
}: {
  panels: Panel[];
  renderPanel: (panel: Panel, dragHandleProps?: PanelDragHandleProps) => React.ReactNode;
  onOrderChange: (paneIds: string[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
      setContainerHeight(entry.contentRect.height ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const displayPanels = panels;
  const layout = planRenderPaneRows(displayPanels, {
    width: containerWidth,
    height: containerHeight,
    minWidth: PANEL_MIN_WIDTH_PX,
    minHeight: PANEL_MIN_HEIGHT_PX,
  });
  const visiblePanels = layout.rows.flat();
  const sortableIds = visiblePanels.map(panelKey);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveDragId(active.id as string);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveDragId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = displayPanels.findIndex((panel) => panelKey(panel) === active.id);
    const newIndex = displayPanels.findIndex((panel) => panelKey(panel) === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }
    const nextOrder = [...displayPanels];
    const [moved] = nextOrder.splice(oldIndex, 1);
    nextOrder.splice(newIndex, 0, moved);
    onOrderChange(nextOrder.map(panelKey));
  };

  const activeDragPanel = activeDragId ? displayPanels.find((p) => panelKey(p) === activeDragId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
        <div ref={containerRef} className="panel-rows-container" aria-label="Split panels">
          {layout.rows.map((row, rowIndex) => (
            <div key={rowIndex} className={`browser-split-view panels-${row.length}`}>
              {row.map((panel) => (
                <SortablePanelCell key={panelKey(panel)} id={panelKey(panel)}>
                  {(dragHandleProps) => renderPanel(panel, dragHandleProps)}
                </SortablePanelCell>
              ))}
            </div>
          ))}
          {layout.hiddenCount > 0 ? (
            <div className="panel-hidden-notice" role="status">
              {layout.hiddenCount} render {layout.hiddenCount === 1 ? 'pane is' : 'panes are'} hidden until there is more room.
            </div>
          ) : null}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeDragPanel ? (
          <div className="panel-drag-cell panel-drag-cell--overlay">
            {renderPanel(activeDragPanel)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const VALID_SIDEBAR_PANELS: SidebarPanel[] = ['workspaces', 'review', 'history', 'extensions', 'models', 'settings', 'account'];

function isSidebarPanel(value: unknown): value is SidebarPanel {
  return typeof value === 'string' && (VALID_SIDEBAR_PANELS as string[]).includes(value);
}

function isHFModelArray(value: unknown): value is HFModel[] {
  return (
    Array.isArray(value)
    && value.every((entry) => (
      Boolean(entry)
      && typeof entry === 'object'
      && typeof (entry as { id?: unknown }).id === 'string'
      && typeof (entry as { task?: unknown }).task === 'string'
    ))
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

const VALID_AGENT_PROVIDERS: AgentProvider[] = ['codi', 'ghcp', 'cursor', 'codex', 'researcher', 'debugger', 'planner', 'security', 'tour-guide'];

function isAgentProviderRecord(value: unknown): value is Record<string, AgentProvider> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every((entry) => (
      typeof entry === 'string' && (VALID_AGENT_PROVIDERS as string[]).includes(entry)
    ))
  );
}

const sessionStorageBackend = typeof window !== 'undefined' ? window.sessionStorage : null;
const localStorageBackend = typeof window !== 'undefined' ? window.localStorage : null;

function AgentBrowserApp() {
  const { toast, setToast } = useToast();
  const initialRootRef = useRef<TreeNode | null>(null);
  if (!initialRootRef.current) initialRootRef.current = createInitialRoot();
  const [root, setRoot] = useStoredState<TreeNode>(
    localStorageBackend,
    STORAGE_KEYS.workspaceRoot,
    isTreeNode,
    initialRootRef.current,
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useStoredState(sessionStorageBackend, STORAGE_KEYS.activeWorkspaceId, isString, 'ws-research');
  const [activePanel, setActivePanel] = useStoredState(sessionStorageBackend, STORAGE_KEYS.activePanel, isSidebarPanel, 'workspaces' as SidebarPanel);
  const [collapsed, setCollapsed] = useState(() => isMobileViewport());
  const sidebarUserOverrideRef = useRef(false);
  const [registryTask, setRegistryTask] = useState('');
  const [registryQuery, setRegistryQuery] = useState('');
  const [registryModels, setRegistryModels] = useState<HFModel[]>([]);
  const [installedModels, setInstalledModels] = useStoredState<HFModel[]>(localStorageBackend, STORAGE_KEYS.installedModels, isHFModelArray, []);
  const [installedDefaultExtensionIds, setInstalledDefaultExtensionIds] = useStoredState<string[]>(
    localStorageBackend,
    STORAGE_KEYS.installedDefaultExtensionIds,
    isStringArray,
    [],
  );
  const [benchmarkRoutingSettings, setBenchmarkRoutingSettings] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.benchmarkModelRoutingSettings,
    isBenchmarkRoutingSettings,
    DEFAULT_BENCHMARK_ROUTING_SETTINGS,
  );
  const [benchmarkEvidenceState, setBenchmarkEvidenceState] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.benchmarkEvidenceState,
    isBenchmarkEvidenceDiscoveryState,
    DEFAULT_BENCHMARK_EVIDENCE_STATE,
  );
  const [adversaryToolReviewSettings, setAdversaryToolReviewSettings] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.adversaryToolReviewSettings,
    isAdversaryToolReviewSettings,
    DEFAULT_ADVERSARY_TOOL_REVIEW_SETTINGS,
  );
  const [securityReviewAgentSettings, setSecurityReviewAgentSettings] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.securityReviewAgentSettings,
    isSecurityReviewAgentSettings,
    DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS,
  );
  const [scheduledAutomationState, setScheduledAutomationState] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.scheduledAutomationsState,
    isScheduledAutomationState,
    DEFAULT_SCHEDULED_AUTOMATION_STATE,
  );
  const [partnerAgentControlPlaneSettings, setPartnerAgentControlPlaneSettings] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.partnerAgentControlPlaneSettings,
    isPartnerAgentControlPlaneSettings,
    DEFAULT_PARTNER_AGENT_CONTROL_PLANE_SETTINGS,
  );
  const [latestPartnerAgentAuditEntry, setLatestPartnerAgentAuditEntry] = useState<PartnerAgentAuditEntry | null>(null);
  const [browserLocationContext, setBrowserLocationContext] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.locationContext,
    isBrowserLocationContext,
    DEFAULT_BROWSER_LOCATION_CONTEXT,
  );
  const secretsManager = useMemo(() => getDefaultSecretsManagerAgent(), []);
  const [secretSettings, setSecretSettings] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.secretManagementSettings,
    isSecretManagementSettings,
    DEFAULT_SECRET_MANAGEMENT_SETTINGS,
  );
  const [secretRecords, setSecretRecords] = useState<SecretRecord[]>([]);
  const evaluationAgentRegistry = useMemo(
    () => createEvaluationAgentRegistry(localStorageBackend, activeWorkspaceId),
    [activeWorkspaceId],
  );
  const [evaluationAgents, setEvaluationAgents] = useState<CustomEvaluationAgent[]>(() => evaluationAgentRegistry.list());
  const [negativeRubricTechniques, setNegativeRubricTechniques] = useState<string[]>(() => evaluationAgentRegistry.listNegativeRubricTechniques());
  const [copilotState, setCopilotState] = useState<CopilotRuntimeState>(EMPTY_COPILOT_STATE);
  const [isCopilotStateLoading, setIsCopilotStateLoading] = useState(true);
  const [cursorState, setCursorState] = useState<CursorRuntimeState>(EMPTY_CURSOR_STATE);
  const [isCursorStateLoading, setIsCursorStateLoading] = useState(true);
  const [codexState, setCodexState] = useState<CodexRuntimeState>(EMPTY_CODEX_STATE);
  const [isCodexStateLoading, setIsCodexStateLoading] = useState(true);
  const benchmarkRoutingBaseCandidates = useMemo(
    () => buildBenchmarkRoutingCandidates({ copilotModels: copilotState.models, installedModels }),
    [copilotState.models, installedModels],
  );
  const benchmarkRoutingCandidates = useMemo(
    () => mergeDiscoveredBenchmarkEvidence(benchmarkRoutingBaseCandidates, benchmarkEvidenceState.records),
    [benchmarkEvidenceState.records, benchmarkRoutingBaseCandidates],
  );
  const settingsPartnerAgentControlPlane = useMemo(() => {
    const selectedProvider = getDefaultAgentProvider({ installedModels, copilotState, cursorState });
    const selectedIds = resolveAgentModelIds({
      installedModels,
      selectedCodiModelId: '',
      copilotModels: copilotState.models,
      selectedGhcpModelId: '',
      cursorModels: cursorState.models,
      selectedCursorModelId: '',
      codexModels: codexState.models,
      selectedCodexModelId: '',
    });
    const runtimeProvider = resolveRuntimeAgentProvider({
      provider: selectedProvider,
      hasCodiModelsReady: Boolean(selectedIds.codiModelId),
      hasGhcpModelsReady: hasGhcpAccess(copilotState) && Boolean(selectedIds.ghcpModelId),
      hasCursorModelsReady: hasCursorAccess(cursorState) && Boolean(selectedIds.cursorModelId),
      hasCodexModelsReady: hasCodexAccess(codexState) && Boolean(selectedIds.codexModelId),
    });
    return buildPartnerAgentControlPlane({
      settings: partnerAgentControlPlaneSettings,
      installedModels,
      copilotState,
      cursorState,
      codexState,
      selectedProvider,
      runtimeProvider,
      selectedModelRef: buildPartnerAgentModelRef(runtimeProvider, selectedIds),
      selectedToolIds: [],
    });
  }, [codexState, copilotState, cursorState, installedModels, partnerAgentControlPlaneSettings]);
  const settingsSecurityReviewRunPlan = useMemo(
    () => buildSecurityReviewRunPlan({
      settings: securityReviewAgentSettings,
      selectedToolIds: [],
    }),
    [securityReviewAgentSettings],
  );
  const benchmarkRoutingCandidateFingerprint = useMemo(
    () => benchmarkRoutingBaseCandidates.map((candidate) => candidate.ref).sort().join('|'),
    [benchmarkRoutingBaseCandidates],
  );
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [omnibar, setOmnibar] = useState('');
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [showAddFileMenu, setShowAddFileMenu] = useState<string | null>(null);
  const [addFileName, setAddFileName] = useState('');
  const [pendingSearch, setPendingSearch] = useState<string | null>(null);
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [treeFilter, setTreeFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [clipboardIds, setClipboardIds] = useState<string[]>([]);
  const [renamingWorkspaceId, setRenamingWorkspaceId] = useState<string | null>(null);
  const [workspaceDraftName, setWorkspaceDraftName] = useState('');
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const slideTimeoutRef = useRef<number>(0);
  const omnibarRef = useRef<HTMLInputElement | null>(null);
  const [workspaceFilesByWorkspace, setWorkspaceFilesByWorkspace] = useState<Record<string, WorkspaceFile[]>>(() => loadWorkspaceFiles([...INITIAL_WORKSPACE_IDS]));
  const [artifactsByWorkspace, setArtifactsByWorkspace] = useStoredState<Record<string, AgentArtifact[]>>(
    localStorageBackend,
    STORAGE_KEYS.artifactsByWorkspace,
    isArtifactsByWorkspace,
    {},
  );
  const [artifactContextBySession, setArtifactContextBySession] = useStoredState<Record<string, string[]>>(
    localStorageBackend,
    STORAGE_KEYS.artifactContextBySession,
    isArtifactContextBySession,
    {},
  );
  const [workspaceViewStateByWorkspace, setWorkspaceViewStateByWorkspace] = useStoredState<Record<string, WorkspaceViewState>>(
    localStorageBackend,
    STORAGE_KEYS.workspaceViewStateByWorkspace,
    isWorkspaceViewStateRecord,
    createWorkspaceViewState(root),
  );
  const [harnessSpecsByWorkspace, setHarnessSpecsByWorkspace] = useStoredState<Record<string, HarnessAppSpec>>(
    localStorageBackend,
    STORAGE_KEYS.harnessSpecsByWorkspace,
    isHarnessAppSpecRecord,
    {},
  );
  const [terminalFsPathsBySession, setTerminalFsPathsBySession] = useState<Record<string, string[]>>({});
  const [terminalFsFileContentsBySession, setTerminalFsFileContentsBySession] = useState<Record<string, Record<string, string>>>({});
  const bashBySessionRef = useRef<Record<string, Bash>>({});
  const sessionMcpControllersRef = useRef<Record<string, SessionMcpController>>({});
  const [addSessionFsMenu, setAddSessionFsMenu] = useState<{ sessionId: string; basePath: string; kind?: 'file' | 'folder' } | null>(null);
  const [addSessionFsName, setAddSessionFsName] = useState('');
  const [renameSessionFsMenu, setRenameSessionFsMenu] = useState<{ sessionId: string; path: string } | null>(null);
  const [renameSessionFsName, setRenameSessionFsName] = useState('');
  const [contextMenu, setContextMenu] = useState<AppContextMenuState | null>(null);
  const [renamingSessionNodeId, setRenamingSessionNodeId] = useState<string | null>(null);
  const [sessionRenameDraft, setSessionRenameDraft] = useState('');
  // ── Properties / History ──────────────────────────────────────────────────
  const [propertiesNode, setPropertiesNode] = useState<TreeNode | null>(null);
  const [historyNode, setHistoryNode] = useState<TreeNode | null>(null);
  const [fileOpModal, setFileOpModal] = useState<{ node: TreeNode; op: FileOpKind } | null>(null);
  const [newTabWorkspaceId, setNewTabWorkspaceId] = useState<string | null>(null);
  const [versionHistories, setVersionHistories] = useState<Record<string, VersionDAG>>({});
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardEntry[]>([]);
  const lastClipboardTextRef = useRef<string>('');
  const [browserNavHistories, setBrowserNavHistories] = useState<Record<string, BrowserNavHistory>>(() => {
    const initial: Record<string, BrowserNavHistory> = {};
    function seedBrowserTabs(nodes?: TreeNode[]) {
      if (!nodes) return;
      for (const child of nodes) {
        if (child.type === 'tab' && child.nodeKind === 'browser' && child.url) {
          initial[child.id] = { entries: [{ url: child.url, title: child.name, timestamp: Date.now() }], currentIndex: 0 };
        }
        if (child.children) seedBrowserTabs(child.children);
      }
    }
    if (initialRootRef.current?.children) seedBrowserTabs(initialRootRef.current.children);
    return initial;
  });

  useEffect(() => {
    function suppressNativeContextMenu(event: MouseEvent) {
      event.preventDefault();
    }
    document.addEventListener('contextmenu', suppressNativeContextMenu, { capture: true });
    return () => document.removeEventListener('contextmenu', suppressNativeContextMenu, { capture: true });
  }, []);

  const refreshSecretRecords = useCallback(async () => {
    setSecretRecords(await secretsManager.listSecrets());
  }, [secretsManager]);
  const saveManualSecret = useCallback(async (input: { name: string; value: string }) => {
    const ref = await secretsManager.storeSecret(input);
    await refreshSecretRecords();
    setToast({ msg: 'Secret added', type: 'success' });
    return ref;
  }, [refreshSecretRecords, secretsManager, setToast]);
  const deleteManualSecret = useCallback(async (idOrRef: string) => {
    await secretsManager.deleteSecret(idOrRef);
    await refreshSecretRecords();
    setToast({ msg: 'Secret deleted', type: 'info' });
  }, [refreshSecretRecords, secretsManager, setToast]);
  const updateSecretSettings = useCallback((next: SecretManagementSettings) => {
    setSecretSettings(next);
    if (localStorageBackend) {
      saveJson(localStorageBackend, STORAGE_KEYS.secretManagementSettings, next);
    }
  }, [setSecretSettings]);
  const webMcpModelContext = useMemo(
    () => installModelContext(typeof window === 'undefined' ? undefined : window) ?? new ModelContext(),
    [],
  );
  const workspaceWebMcpBridge = useMemo(() => createWebMcpToolBridge(webMcpModelContext), [webMcpModelContext]);

  useEffect(() => {
    void refreshSecretRecords();
  }, [refreshSecretRecords]);

  useEffect(() => {
    setEvaluationAgents(evaluationAgentRegistry.list());
    setNegativeRubricTechniques(evaluationAgentRegistry.listNegativeRubricTechniques());
  }, [evaluationAgentRegistry]);

  const saveEvaluationAgents = useCallback((agents: CustomEvaluationAgent[]) => {
    evaluationAgentRegistry.save(agents);
    setEvaluationAgents(evaluationAgentRegistry.list());
  }, [evaluationAgentRegistry]);

  const resetEvaluationAgents = useCallback(() => {
    evaluationAgentRegistry.reset();
    setEvaluationAgents([]);
  }, [evaluationAgentRegistry]);

  const resetNegativeRubric = useCallback(() => {
    evaluationAgentRegistry.resetNegativeRubricTechniques();
    setNegativeRubricTechniques([]);
  }, [evaluationAgentRegistry]);
  const addNegativeRubricTechnique = useCallback((technique: string) => {
    evaluationAgentRegistry.addNegativeRubricTechnique(technique);
    setNegativeRubricTechniques(evaluationAgentRegistry.listNegativeRubricTechniques());
  }, [evaluationAgentRegistry]);
  const [sessionRuntimeSnapshotsById, setSessionRuntimeSnapshotsById] = useState<Record<string, SessionMcpRuntimeState>>({});
  const handleSessionRuntimeChange = useCallback((sessionId: string, runtime: SessionMcpRuntimeState | null) => {
    setSessionRuntimeSnapshotsById((current) => {
      if (!runtime) {
        if (!current[sessionId]) return current;
        const next = { ...current };
        delete next[sessionId];
        return next;
      }
      if (areSessionRuntimeSnapshotsEqual(current[sessionId], runtime)) {
        return current;
      }
      return { ...current, [sessionId]: runtime };
    });
  }, []);

  const activeWorkspace = getWorkspace(root, activeWorkspaceId) ?? root;
  const activeBrowserTabs = useMemo(() => flattenTabs(activeWorkspace, 'browser'), [activeWorkspace]);
  const activeWorkspaceViewState: WorkspaceViewState = activeWorkspace.type === 'workspace'
    ? normalizeWorkspaceViewEntry(activeWorkspace, workspaceViewStateByWorkspace[activeWorkspaceId])
    : {
        openTabIds: [],
        editingFilePath: null,
        dashboardOpen: true,
        activeMode: 'agent',
        activeSessionIds: [],
        mountedSessionFsIds: [],
        activeArtifactPanel: null,
        panelOrder: [],
      };
  const activeSessionMode = activeWorkspaceViewState.activeMode;
  const activeSessionIds = activeWorkspaceViewState.activeSessionIds ?? [];
  const activeBrowserPageIds = useMemo(() => new Set(activeWorkspaceViewState.openTabIds ?? []), [activeWorkspaceViewState.openTabIds]);
  const activeBrowserPages = useMemo<WorkspaceMcpBrowserPage[]>(() => activeBrowserTabs.map((tab) => ({
    id: tab.id,
    title: tab.name,
    url: tab.url ?? '',
    isOpen: activeBrowserPageIds.has(tab.id),
    persisted: Boolean(tab.persisted),
    muted: Boolean(tab.muted),
    memoryTier: tab.memoryTier ?? null,
    memoryMB: tab.memoryMB ?? null,
  })), [activeBrowserPageIds, activeBrowserTabs]);
  const activeWorkspaceSessions = useMemo(
    () => activeWorkspace.type === 'workspace'
      ? ((getWorkspaceCategory(activeWorkspace, 'session')?.children ?? [])
          .filter((child): child is TreeNode => child.type === 'tab' && child.nodeKind === 'session')
          .map((child) => ({
            id: child.id,
            name: child.name,
            isOpen: activeSessionIds.includes(child.id),
          })))
      : [],
    [activeSessionIds, activeWorkspace],
  );
  const activePrReviewReport = useMemo(
    () => buildPullRequestReview(createSamplePullRequestReviewInput(activeWorkspace.name)),
    [activeWorkspace.name],
  );
  const [pendingReviewFollowUp, setPendingReviewFollowUp] = useState<{ sessionId: string; prompt: string } | null>(null);
  const activeMountedSessionFsIds = activeWorkspaceViewState.mountedSessionFsIds ?? [];
  const activeSessionDrives = useMemo<WorkspaceMcpSessionDrive[]>(() => activeWorkspaceSessions.map((session) => ({
    sessionId: session.id,
    label: `//${session.name.toLowerCase().replace(/\s+/g, '-')}-fs`,
    mounted: activeMountedSessionFsIds.includes(session.id),
  })), [activeMountedSessionFsIds, activeWorkspaceSessions]);
  const visibleItems = useMemo(
    () => activeWorkspace.type === 'workspace' ? flattenWorkspaceTreeFiltered(activeWorkspace, treeFilter) : flattenTreeFiltered(root, treeFilter),
    [activeWorkspace, root, treeFilter],
  );
  const openBrowserTabs = (activeWorkspaceViewState.openTabIds ?? [])
    .map((id) => findNode(activeWorkspace, id))
    .filter((tab): tab is TreeNode => !!tab && tab.type === 'tab' && (tab.nodeKind ?? 'browser') === 'browser');
  const workspaceByNodeId = useMemo(() => buildWorkspaceNodeMap(root), [root]);
  const activeWorkspaceFiles = workspaceFilesByWorkspace[activeWorkspaceId] ?? [];
  const activeArtifacts = artifactsByWorkspace[activeWorkspaceId] ?? [];
  const activeArtifactPanelSelection = activeWorkspaceViewState.activeArtifactPanel ?? null;
  const activeArtifactPanelArtifact = activeArtifactPanelSelection
    ? activeArtifacts.find((artifact) => artifact.id === activeArtifactPanelSelection.artifactId) ?? null
    : null;
  const activeArtifactPanelFile = activeArtifactPanelArtifact
    ? activeArtifactPanelArtifact.files.find((file) => file.path === activeArtifactPanelSelection?.filePath) ?? activeArtifactPanelArtifact.files[0] ?? null
    : null;
  const activeWorkspaceCapabilities = useMemo(() => discoverWorkspaceCapabilities(activeWorkspaceFiles), [activeWorkspaceFiles]);
  const [defaultExtensionRuntime, setDefaultExtensionRuntime] = useState<DefaultExtensionRuntime | null>(null);
  const installedDefaultExtensions = useMemo(
    () => getInstalledDefaultExtensionDescriptors(defaultExtensionRuntime, installedDefaultExtensionIds),
    [defaultExtensionRuntime, installedDefaultExtensionIds],
  );
  const installedIdeExtensions = useMemo(
    () => installedDefaultExtensions.filter((extension) => getExtensionMarketplaceCategory(extension) === 'ide'),
    [installedDefaultExtensions],
  );
  const installDefaultExtension = useCallback((extensionId: string) => {
    setInstalledDefaultExtensionIds((current) => (
      current.includes(extensionId) ? current : [...current, extensionId]
    ));
  }, [setInstalledDefaultExtensionIds]);
  useEffect(() => {
    let mounted = true;
    void createDefaultExtensionRuntime(activeWorkspaceFiles, {
      installedExtensionIds: installedDefaultExtensionIds,
    })
      .then((runtime) => {
        if (mounted) setDefaultExtensionRuntime(runtime);
      })
      .catch((error: unknown) => {
        console.error('Failed to load default extensions', error);
        if (mounted) setDefaultExtensionRuntime(null);
      });
    return () => {
      mounted = false;
    };
  }, [activeWorkspaceFiles, installedDefaultExtensionIds]);
  const defaultActiveHarnessSpec = useMemo(() => createDefaultHarnessAppSpec({
    workspaceId: activeWorkspaceId,
    workspaceName: activeWorkspace.name,
  }), [activeWorkspace.name, activeWorkspaceId]);
  const activeHarnessSpec = harnessSpecsByWorkspace[activeWorkspaceId] ?? defaultActiveHarnessSpec;
  const updateActiveHarnessSpec = useCallback((updater: (spec: HarnessAppSpec) => HarnessAppSpec) => {
    setHarnessSpecsByWorkspace((current) => {
      const baseSpec = current[activeWorkspaceId] ?? createDefaultHarnessAppSpec({
        workspaceId: activeWorkspaceId,
        workspaceName: activeWorkspace.name,
      });
      return {
        ...current,
        [activeWorkspaceId]: updater(baseSpec),
      };
    });
  }, [activeWorkspace.name, activeWorkspaceId, setHarnessSpecsByWorkspace]);
  const patchActiveHarnessElement = useCallback((patch: HarnessElementPatch) => {
    updateActiveHarnessSpec((spec) => applyHarnessElementPatch(spec, patch));
    setToast({ msg: 'Harness element updated', type: 'success' });
  }, [setToast, updateActiveHarnessSpec]);
  const regenerateActiveHarnessSpec = useCallback((prompt: string) => {
    let summary = 'Harness regenerated';
    updateActiveHarnessSpec((spec) => {
      const result = regenerateHarnessAppSpec({
        spec,
        prompt,
        workspaceId: activeWorkspaceId,
        workspaceName: activeWorkspace.name,
      });
      summary = result.summary;
      return result.spec;
    });
    setToast({ msg: summary, type: 'success' });
    return summary;
  }, [activeWorkspace.name, activeWorkspaceId, setToast, updateActiveHarnessSpec]);
  const restoreActiveHarnessSpec = useCallback(() => {
    updateActiveHarnessSpec((spec) => restoreDefaultHarnessAppSpec({
      spec,
      workspaceId: activeWorkspaceId,
      workspaceName: activeWorkspace.name,
    }).spec);
    setToast({ msg: 'Harness defaults restored', type: 'success' });
    return 'Harness defaults restored';
  }, [activeWorkspace.name, activeWorkspaceId, setToast, updateActiveHarnessSpec]);
  const activeHarnessElements = useMemo<WorkspaceMcpHarnessElement[]>(
    () => listEditableHarnessElements(activeHarnessSpec),
    [activeHarnessSpec],
  );
  const readHarnessElementFromMcp = useCallback((elementId: string) => activeHarnessSpec.elements[elementId] ?? null, [activeHarnessSpec]);
  const readHarnessPromptContextFromMcp = useCallback(() => buildHarnessPromptContextRows(activeHarnessSpec), [activeHarnessSpec]);
  const patchHarnessElementFromMcp = useCallback((input: WorkspaceMcpHarnessElementPatch) => {
    patchActiveHarnessElement({
      elementId: input.elementId,
      props: input.props as Record<string, JsonValue>,
    });
    return { elementId: input.elementId, updated: true };
  }, [patchActiveHarnessElement]);
  const regenerateHarnessFromMcp = useCallback(
    ({ prompt }: { prompt: string }) => ({ summary: regenerateActiveHarnessSpec(prompt) }),
    [regenerateActiveHarnessSpec],
  );
  const restoreHarnessFromMcp = useCallback(
    () => ({ summary: restoreActiveHarnessSpec() }),
    [restoreActiveHarnessSpec],
  );
  const editingFile = activeWorkspaceViewState.editingFilePath ? activeWorkspaceFiles.find((f) => f.path === activeWorkspaceViewState.editingFilePath) ?? null : null;
  const hasActiveRenderPane = Boolean(editingFile || activeArtifactPanelArtifact || openBrowserTabs.length || activeSessionIds.length);
  const shouldRenderDashboard = activeWorkspaceViewState.dashboardOpen && !hasActiveRenderPane;

  const activeRenderPanes = useMemo<WorkspaceMcpRenderPane[]>(() => {
    const panes: WorkspaceMcpRenderPane[] = [];

    if (shouldRenderDashboard) {
      panes.push({
        id: `dashboard:${activeWorkspaceId}`,
        paneType: 'dashboard',
        itemId: activeWorkspaceId,
        label: `${activeWorkspace.name} harness`,
      });
    }

    if (editingFile) {
      panes.push({
        id: `file:${editingFile.path}`,
        paneType: 'workspace-file',
        itemId: editingFile.path,
        label: editingFile.path,
        path: editingFile.path,
      });
    }

    if (activeArtifactPanelArtifact) {
      const path = activeArtifactPanelFile
        ? `//artifacts/${activeArtifactPanelArtifact.id}/${activeArtifactPanelFile.path}`
        : `//artifacts/${activeArtifactPanelArtifact.id}`;
      panes.push({
        id: `artifact:${activeArtifactPanelArtifact.id}:${activeArtifactPanelFile?.path ?? ''}`,
        paneType: 'artifact',
        itemId: activeArtifactPanelArtifact.id,
        artifactId: activeArtifactPanelArtifact.id,
        artifactFilePath: activeArtifactPanelFile?.path,
        label: activeArtifactPanelArtifact.title,
        path,
      });
    }

    for (const sessionId of activeSessionIds) {
      const summary = activeWorkspaceSessions.find((session) => session.id === sessionId);
      panes.push({
        id: `session:${sessionId}`,
        paneType: 'session',
        itemId: sessionId,
        label: summary?.name ?? sessionId,
      });
    }

    for (const tab of openBrowserTabs) {
      panes.push({
        id: `browser:${tab.id}`,
        paneType: 'browser-page',
        itemId: tab.id,
        label: tab.name,
        url: tab.url ?? '',
      });
    }

    return orderRenderPanes(panes, activeWorkspaceViewState.panelOrder ?? []);
  }, [
    activeSessionIds,
    activeArtifactPanelArtifact,
    activeArtifactPanelFile,
    activeWorkspace.name,
    activeWorkspaceSessions,
    activeWorkspaceId,
    activeWorkspaceViewState.panelOrder,
    editingFile,
    openBrowserTabs,
    activeWorkspaceViewState.dashboardOpen,
    shouldRenderDashboard,
  ]);
  const activeClipboardEntries = useMemo<WorkspaceMcpClipboardEntry[]>(() => clipboardHistory.map((entry, index) => ({
    id: entry.id,
    label: entry.label,
    text: entry.text,
    timestamp: entry.timestamp,
    isActive: index === 0,
  })), [clipboardHistory]);
  const activePanelMeta = SIDEBAR_PANEL_META[activePanel];
  const openActiveWorkspaceFileFromMcp = useCallback((path: string) => {
    setWorkspaceViewStateByWorkspace((current) => ({
      ...current,
      [activeWorkspaceId]: {
        ...(current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace)),
        editingFilePath: path,
      },
    }));
  }, [activeWorkspace, activeWorkspaceId]);
  const getOrCreateSessionBash = useCallback((sessionId: string) => {
    const bashSessions = bashBySessionRef.current;
    if (!bashSessions[sessionId]) {
      const files = createInitialBashFiles();
      bashSessions[sessionId] = new Bash({
        cwd: BASH_INITIAL_CWD,
        files,
      });
      setTerminalFsPathsBySession((current) => ({
        ...current,
        [sessionId]: bashSessions[sessionId]!.fs.getAllPaths(),
      }));
      setTerminalFsFileContentsBySession((current) => ({
        ...current,
        [sessionId]: { ...(current[sessionId] ?? {}), ...files },
      }));
    }
    return bashSessions[sessionId]!;
  }, []);
  const handleTerminalFsPathsChanged = useCallback((sessionId: string, paths: string[]) => {
    setTerminalFsPathsBySession((current) => {
      const existing = current[sessionId] ?? [];
      if (existing.length === paths.length && existing.every((entry, index) => entry === paths[index])) {
        return current;
      }
      return { ...current, [sessionId]: paths };
    });
  }, []);

  const refreshCopilotState = useCallback(async (showErrors = false) => {
    setIsCopilotStateLoading(true);
    try {
      const state = await fetchCopilotState();
      setCopilotState(state);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (error instanceof Error && error.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : 'Failed to check GitHub Copilot status.';
      setCopilotState({
        ...EMPTY_COPILOT_STATE,
        error: message,
      });
      if (showErrors) {
        setToast({ msg: message, type: 'warning' });
      }
    } finally {
      setIsCopilotStateLoading(false);
    }
  }, [setToast]);

  useEffect(() => {
    void refreshCopilotState(false);
  }, [refreshCopilotState]);

  const refreshCursorState = useCallback(async (showErrors = false) => {
    setIsCursorStateLoading(true);
    try {
      const state = await fetchCursorState();
      setCursorState(state);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (error instanceof Error && error.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : 'Failed to check Cursor status.';
      setCursorState({
        ...EMPTY_CURSOR_STATE,
        error: message,
      });
      if (showErrors) {
        setToast({ msg: message, type: 'warning' });
      }
    } finally {
      setIsCursorStateLoading(false);
    }
  }, [setToast]);

  const refreshCodexState = useCallback(async (showErrors = false) => {
    setIsCodexStateLoading(true);
    try {
      const state = await fetchCodexState();
      setCodexState(state);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (error instanceof Error && error.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : 'Failed to check Codex status.';
      setCodexState({
        ...EMPTY_CODEX_STATE,
        error: message,
      });
      if (showErrors) {
        setToast({ msg: message, type: 'warning' });
      }
    } finally {
      setIsCodexStateLoading(false);
    }
  }, [setToast]);

  useEffect(() => {
    void refreshCursorState(false);
  }, [refreshCursorState]);

  useEffect(() => {
    void refreshCodexState(false);
  }, [refreshCodexState]);

  useEffect(() => {
    if (!benchmarkRoutingSettings.enabled || benchmarkRoutingBaseCandidates.length === 0) return;
    const controller = new AbortController();
    let cancelled = false;
    setBenchmarkEvidenceState((current) => ({
      ...current,
      status: 'refreshing',
      errors: [],
    }));
    void discoverBenchmarkEvidence({
      candidates: benchmarkRoutingBaseCandidates,
      benchmarkIndexUrls: getConfiguredBenchmarkIndexUrls(),
      signal: controller.signal,
    }).then((state) => {
      if (!cancelled) setBenchmarkEvidenceState(state);
    }).catch((error) => {
      if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
      setBenchmarkEvidenceState({
        status: 'error',
        retrievedAt: new Date().toISOString(),
        records: [],
        errors: [error instanceof Error ? error.message : String(error)],
      });
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [benchmarkRoutingBaseCandidates, benchmarkRoutingCandidateFingerprint, benchmarkRoutingSettings.enabled, setBenchmarkEvidenceState]);

  useEffect(() => {
    setWorkspaceViewStateByWorkspace((current) => {
      const next: Record<string, WorkspaceViewState> = {};
      let changed = false;
      for (const workspace of root.children ?? []) {
        if (workspace.type !== 'workspace') continue;
        const normalized = normalizeWorkspaceViewEntry(workspace, current[workspace.id]);
        next[workspace.id] = normalized;
        if (!current[workspace.id] || !workspaceViewStateEquals(current[workspace.id], normalized)) changed = true;
      }
      if (Object.keys(current).some((workspaceId) => !(workspaceId in next))) changed = true;
      return changed ? next : current;
    });
  }, [root]);

  useEffect(() => {
    setRoot((current) => ({
      ...current,
      children: (current.children ?? []).map((workspace) => workspace.type === 'workspace' ? ensureWorkspaceCategories(workspace) : workspace),
    }));
  }, []);

  // Sync workspace files + terminal virtual filesystems into the Files category per workspace.
  useEffect(() => {
    setRoot((current) => {
      const workspaces = current.children ?? [];
      const updated = workspaces.map((ws) => {
        if (ws.type !== 'workspace') return ws;
        const normalizedWorkspace = ensureWorkspaceCategories(ws);
        const expandedGeneratedNodeIds = new Set<string>();
        const rememberExpandedNodes = (nodes: TreeNode[] | undefined) => {
          for (const node of nodes ?? []) {
            if (node.expanded) expandedGeneratedNodeIds.add(node.id);
            rememberExpandedNodes(node.children);
          }
        };
        const restoreExpandedNodes = (nodes: TreeNode[]): TreeNode[] => nodes.map((node) => ({
          ...node,
          expanded: node.expanded || expandedGeneratedNodeIds.has(node.id),
          ...(node.children ? { children: restoreExpandedNodes(node.children) } : {}),
        }));
        rememberExpandedNodes(getWorkspaceCategory(normalizedWorkspace, 'files')?.children);
        const files = workspaceFilesByWorkspace[ws.id] ?? [];
        const extensionNodes = buildInstalledExtensionDriveNodes(`extensions:${ws.id}`, installedDefaultExtensions);
        const fileNodes = buildWorkspaceCapabilityDriveNodes(`file:${ws.id}`, files);
        const artifactNodes = buildArtifactDriveNodes(`artifact:${ws.id}`, artifactsByWorkspace[ws.id] ?? []);
        const sessionCategory = getWorkspaceCategory(normalizedWorkspace, 'session');
        const mountedSessionIds = normalizeWorkspaceViewEntry(normalizedWorkspace, workspaceViewStateByWorkspace[ws.id]).mountedSessionFsIds;
        const terminalFsNodes: TreeNode[] = (sessionCategory?.children ?? [])
          .filter((child) => child.type === 'tab' && child.nodeKind === 'session')
          .filter((terminalNode) => mountedSessionIds.includes(terminalNode.id))
          .map((terminalNode) => ({
            id: `vfs:${ws.id}:${terminalNode.id}`,
            name: `//${terminalNode.name.toLowerCase().replace(/\s+/g, '-')}-fs`,
            type: 'folder',
            isDrive: true,
            expanded: false,
            children: buildMountedTerminalDriveNodes(`vfs:${ws.id}:${terminalNode.id}`, terminalFsPathsBySession[terminalNode.id] ?? [], terminalFsFileContentsBySession[terminalNode.id]),
          }));
        const nextChildren = (normalizedWorkspace.children ?? []).map((child) => child.nodeKind === 'files'
          ? { ...child, children: restoreExpandedNodes([...extensionNodes, ...artifactNodes, ...fileNodes, ...terminalFsNodes]) }
          : child);
        return { ...normalizedWorkspace, children: nextChildren };
      });
      return { ...current, children: updated };
    });
  }, [artifactsByWorkspace, installedDefaultExtensions, terminalFsFileContentsBySession, terminalFsPathsBySession, workspaceFilesByWorkspace, workspaceViewStateByWorkspace]);

  // ── System clipboard detection ────────────────────────────────────────────
  useEffect(() => {
    function addClipboardEntry(text: string) {
      if (!text || text === lastClipboardTextRef.current) return;
      lastClipboardTextRef.current = text;
      const label = text.length > 50 ? `${text.slice(0, 50)}\u2026` : text;
      const entry: ClipboardEntry = { id: createUniqueId(), text, label, timestamp: Date.now() };
      setClipboardHistory((prev) => (prev[0]?.text === text ? prev : [entry, ...prev].slice(0, 50)));
    }

    async function detectExternalClipboardChange() {
      if (!navigator.clipboard?.readText) return;
      try {
        addClipboardEntry(await navigator.clipboard.readText());
      } catch {
        // Permission denied or API unavailable — ignore
      }
    }

    function onCopyOrCut(event: ClipboardEvent) {
      const text = event.clipboardData?.getData('text/plain') ?? '';
      if (text) {
        addClipboardEntry(text);
      } else {
        void Promise.resolve().then(() => detectExternalClipboardChange());
      }
    }

    function onFocus() { void detectExternalClipboardChange(); }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void detectExternalClipboardChange();
    }
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('copy', onCopyOrCut);
    document.addEventListener('cut', onCopyOrCut);
    void detectExternalClipboardChange();
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('copy', onCopyOrCut);
      document.removeEventListener('cut', onCopyOrCut);
    };
  }, []);

  const switchWorkspace = useCallback((newId: string) => {
    if (newId === activeWorkspaceId) return;
    const workspaces = root.children ?? [];
    const oldIdx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
    const newIdx = workspaces.findIndex((w) => w.id === newId);
    setSlideDir(newIdx > oldIdx ? 'left' : 'right');
    setActiveWorkspaceId(newId);
    window.clearTimeout(slideTimeoutRef.current);
    slideTimeoutRef.current = window.setTimeout(() => setSlideDir(null), 300);
  }, [activeWorkspaceId, root]);

  const setSidebarCollapsed = useCallback((next: boolean | ((current: boolean) => boolean), userInitiated = false) => {
    setCollapsed((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      if (userInitiated) {
        const responsiveDefaultCollapsed = isMobileViewport();
        // Keep a manual override only while the user's choice differs from the current responsive default.
        sidebarUserOverrideRef.current = resolved !== responsiveDefaultCollapsed;
      }
      return resolved;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mobileQuery = window.matchMedia('(max-width: 640px)');
    const syncCollapsed = (matches: boolean) => {
      if (!sidebarUserOverrideRef.current) setCollapsed(matches);
    };
    syncCollapsed(mobileQuery.matches);
    const onViewportChange = (event: MediaQueryListEvent) => syncCollapsed(event.matches);
    mobileQuery.addEventListener('change', onViewportChange);
    return () => mobileQuery.removeEventListener('change', onViewportChange);
  }, []);

  const switchSidebarPanel = useCallback((panel: SidebarPanel) => {
    setActivePanel(panel);
    setSidebarCollapsed(false, true);
    setShowWorkspaces(false);
  }, [setSidebarCollapsed]);

  const openWorkspaceSwitcher = useCallback(() => {
    setActivePanel('workspaces');
    setSidebarCollapsed(false, true);
    setShowWorkspaces(true);
  }, [setSidebarCollapsed]);

  const jumpToWorkspaceByIndex = useCallback((index: number) => {
    const workspaces = root.children ?? [];
    const target = workspaces[index];
    if (!target) return;
    switchWorkspace(target.id);
  }, [root, switchWorkspace]);

  const openRenameWorkspace = useCallback((workspaceId: string) => {
    const workspace = getWorkspace(root, workspaceId);
    if (!workspace) return;
    setShowWorkspaces(false);
    setWorkspaceDraftName(workspace.name);
    setRenamingWorkspaceId(workspaceId);
  }, [root]);

  const createWorkspace = useCallback(() => {
    const name = nextWorkspaceName(root);
    const workspaceId = `ws-${createUniqueId()}`;
    const workspace = createWorkspaceNode({
      id: workspaceId,
      name,
      color: WORKSPACE_COLORS[(root.children ?? []).length % WORKSPACE_COLORS.length],
      browserTabs: [],
    });
    setRoot((current) => ({
      ...current,
      children: [
        ...(current.children ?? []),
        workspace,
      ],
    }));
    setWorkspaceViewStateByWorkspace((current) => ({ ...current, [workspaceId]: createWorkspaceViewEntry(workspace) }));
    setWorkspaceFilesByWorkspace((current) => ({ ...current, [workspaceId]: createDefaultWorkspaceFiles() }));
    setActiveWorkspaceId(workspaceId);
    setToast({ msg: `Created ${name}`, type: 'success' });
  }, [root, setToast]);

  const saveWorkspaceRename = useCallback(() => {
    const nextName = workspaceDraftName.trim();
    if (!renamingWorkspaceId || !nextName) {
      setRenamingWorkspaceId(null);
      return;
    }
    setRoot((current) => deepUpdate(current, renamingWorkspaceId, (workspace) => ({ ...workspace, name: nextName })));
    setToast({ msg: `Renamed workspace to ${nextName}`, type: 'success' });
    setRenamingWorkspaceId(null);
  }, [renamingWorkspaceId, setToast, workspaceDraftName]);

  const renameSessionNodeById = useCallback((sessionId: string, nextName: string, showToast = true) => {
    const trimmed = nextName.trim();
    if (!trimmed) {
      return;
    }

    setRoot((current) => deepUpdate(current, sessionId, (node) => ({ ...node, name: trimmed })));
    if (showToast) {
      setToast({ msg: `Renamed to ${trimmed}`, type: 'success' });
    }
  }, [setToast]);

  const addSessionToWorkspace = useCallback((workspaceId: string, nameOverride?: string, options: { open?: boolean } = {}): { id: string; name: string; isOpen: boolean } | null => {
    const shouldOpen = options.open ?? true;
    let createdSession: { id: string; name: string; isOpen: boolean } | null = null;
    let newSessionId: string | null = null;
    setRoot((current) => {
      const workspace = getWorkspace(current, workspaceId);
      if (!workspace) return current;
      const normalized = ensureWorkspaceCategories(workspace);
      const category = getWorkspaceCategory(normalized, 'session');
      const existingSessions = (category?.children ?? []).filter((child) => child.type === 'tab' && child.nodeKind === 'session');
      const existingIndexes = existingSessions.map((child) => {
        const match = child.name.match(/^Session (\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
      const nextIndex = (existingIndexes.length ? Math.max(...existingIndexes) : 0) + 1;
      const newSession = createSessionNode(workspaceId, nextIndex);
      if (typeof nameOverride === 'string' && nameOverride.trim()) {
        newSession.name = nameOverride.trim();
      }
      newSessionId = newSession.id;
      createdSession = { id: newSession.id, name: newSession.name, isOpen: shouldOpen };
      return deepUpdate(current, workspaceId, (node) => {
        const withCategories = ensureWorkspaceCategories(node);
        return {
          ...withCategories,
          expanded: true,
          children: (withCategories.children ?? []).map((child) => child.nodeKind === 'session'
            ? { ...child, expanded: true, children: [...(child.children ?? []), newSession] }
            : child),
        };
      });
    });
    switchWorkspace(workspaceId);
    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[workspaceId] ?? {
        openTabIds: [],
        editingFilePath: null,
        dashboardOpen: true,
        activeMode: 'agent' as const,
        activeSessionIds: [],
        mountedSessionFsIds: [],
        activeArtifactPanel: null,
        panelOrder: [],
      };
      return {
        ...current,
        [workspaceId]: {
          ...existing,
          activeSessionIds: shouldOpen && newSessionId
            ? [newSessionId]
            : existing.activeSessionIds ?? [],
          mountedSessionFsIds: newSessionId && !existing.mountedSessionFsIds.includes(newSessionId)
            ? [...existing.mountedSessionFsIds, newSessionId]
            : existing.mountedSessionFsIds,
        },
      };
    });
    setToast({ msg: 'New session created', type: 'success' });
    return createdSession;
  }, [setToast, switchWorkspace]);

  const openArtifactPanel = useCallback((artifactId: string, filePath: string | null = null, workspaceId = activeWorkspaceId) => {
    const workspace = getWorkspace(root, workspaceId);
    if (!workspace) return;
    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[workspaceId] ?? createWorkspaceViewEntry(workspace);
      return {
        ...current,
        [workspaceId]: {
          ...existing,
          activeArtifactPanel: { artifactId, filePath },
        },
      };
    });
    switchWorkspace(workspaceId);
  }, [activeWorkspaceId, root, setWorkspaceViewStateByWorkspace, switchWorkspace]);

  const closeActiveArtifactPanel = useCallback(() => {
    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
      const paneId = activeArtifactPanelArtifact
        ? `artifact:${activeArtifactPanelArtifact.id}:${activeArtifactPanelFile?.path ?? ''}`
        : null;
      return {
        ...current,
        [activeWorkspaceId]: {
          ...existing,
          activeArtifactPanel: null,
          panelOrder: paneId ? existing.panelOrder.filter((id) => id !== paneId) : existing.panelOrder,
        },
      };
    });
  }, [activeArtifactPanelArtifact, activeArtifactPanelFile, activeWorkspace, activeWorkspaceId, setWorkspaceViewStateByWorkspace]);

  const attachArtifactToSession = useCallback((artifactId: string, sessionId?: string) => {
    const artifact = activeArtifacts.find((candidate) => candidate.id === artifactId);
    const targetSessionId = sessionId ?? activeSessionIds[0] ?? addSessionToWorkspace(activeWorkspaceId, artifact ? `Artifact: ${artifact.title}` : undefined)?.id;
    if (!targetSessionId) {
      setToast({ msg: 'Create a session before attaching an artifact', type: 'error' });
      return;
    }
    setArtifactContextBySession((current) => {
      const existing = current[targetSessionId] ?? [];
      if (existing.includes(artifactId)) return current;
      return { ...current, [targetSessionId]: [...existing, artifactId] };
    });
    setToast({ msg: `Attached ${artifact?.title ?? artifactId}`, type: 'success' });
  }, [activeArtifacts, activeSessionIds, activeWorkspaceId, addSessionToWorkspace, setArtifactContextBySession, setToast]);

  const openSessionWithArtifact = useCallback((artifactId: string) => {
    const artifact = activeArtifacts.find((candidate) => candidate.id === artifactId);
    const session = addSessionToWorkspace(activeWorkspaceId, artifact ? `Artifact: ${artifact.title}` : undefined);
    if (!session) {
      setToast({ msg: 'Unable to create artifact session', type: 'error' });
      return;
    }
    setArtifactContextBySession((current) => ({
      ...current,
      [session.id]: [...new Set([...(current[session.id] ?? []), artifactId])],
    }));
    setToast({ msg: `Opened ${artifact?.title ?? artifactId} in a new session`, type: 'success' });
  }, [activeArtifacts, activeWorkspaceId, addSessionToWorkspace, setArtifactContextBySession, setToast]);

  const downloadArtifact = useCallback((artifactId: string) => {
    const artifact = activeArtifacts.find((candidate) => candidate.id === artifactId);
    if (!artifact) {
      setToast({ msg: 'Artifact unavailable', type: 'error' });
      return;
    }
    const payload = createArtifactDownloadPayload(artifact);
    const blobPart = typeof payload.data === 'string' ? payload.data : payload.data.slice().buffer as ArrayBuffer;
    const blob = new Blob([blobPart], { type: payload.mediaType });
    const href = URL.createObjectURL(blob);
    const linkElement = document.createElement('a');
    linkElement.href = href;
    linkElement.download = payload.fileName;
    document.body.appendChild(linkElement);
    linkElement.click();
    linkElement.remove();
    URL.revokeObjectURL(href);
    setToast({ msg: `Downloaded ${payload.fileName}`, type: 'success' });
  }, [activeArtifacts, setToast]);
  const addBrowserTabToWorkspace = useCallback((workspaceId: string) => {
    setNewTabWorkspaceId(workspaceId);
  }, []);

  function resolveBrowserNavigationTarget(url: string, explicitTitle?: string) {
    const trimmed = url.trim() || 'about:blank';
    let normalizedUrl = trimmed;
    if (trimmed !== 'about:blank' && !/^[a-z][a-z\d+\-.]*:/i.test(trimmed)) {
      normalizedUrl = `https://${trimmed}`;
    }
    const normalizedTitle = explicitTitle?.trim() || (() => {
      try {
        return new URL(normalizedUrl).hostname || normalizedUrl;
      } catch {
        return normalizedUrl;
      }
    })();

    return { url: normalizedUrl, title: normalizedTitle };
  }

  const confirmNewBrowserTab = useCallback((workspaceId: string, url: string, explicitTitle?: string) => {
    const { url: normalized, title } = resolveBrowserNavigationTarget(url, explicitTitle);
    let createdPage: WorkspaceMcpBrowserPage | null = null;
    const newTab = createBrowserTab(title, normalized, 'hot', 0);
    createdPage = {
      id: newTab.id,
      title: newTab.name,
      url: normalized,
      isOpen: false,
      persisted: Boolean(newTab.persisted),
      muted: Boolean(newTab.muted),
      memoryTier: newTab.memoryTier ?? null,
      memoryMB: newTab.memoryMB ?? null,
    };
    setRoot((current) => deepUpdate(current, workspaceId, (node) => {
      const withCategories = ensureWorkspaceCategories(node);
      return {
        ...withCategories,
        expanded: true,
        children: (withCategories.children ?? []).map((child) =>
          child.nodeKind === 'browser'
            ? { ...child, expanded: true, children: [...(child.children ?? []), newTab] }
            : child
        ),
      };
    }));
    setBrowserNavHistories((current) => ({
      ...current,
      [newTab.id]: {
        entries: [{ url: normalized, title: newTab.name, timestamp: Date.now() }],
        currentIndex: 0,
      },
    }));
    setNewTabWorkspaceId(null);
    setToast({ msg: `Opened ${normalized}`, type: 'success' });
    return createdPage;
  }, [setToast]);

  const switchSessionMode = useCallback((workspaceId: string, mode: 'agent' | 'terminal') => {
    const workspace = getWorkspace(root, workspaceId);
    if (!workspace) return;
    const normalized = normalizeWorkspaceViewEntry(workspace, workspaceViewStateByWorkspace[workspaceId]);
    if (!normalized.activeSessionIds.length) {
      const firstSessionId = findFirstSessionId(workspace);
      if (!firstSessionId) {
        addSessionToWorkspace(workspaceId);
        return;
      }
      setWorkspaceViewStateByWorkspace((current) => ({
        ...current,
        [workspaceId]: {
          ...(current[workspaceId] ?? createWorkspaceViewEntry(workspace)),
          activeMode: mode,
          activeSessionIds: [firstSessionId],
        },
      }));
      return;
    }
    setWorkspaceViewStateByWorkspace((current) => ({
      ...current,
      [workspaceId]: {
        ...(current[workspaceId] ?? createWorkspaceViewEntry(workspace)),
        activeMode: mode,
      },
    }));
  }, [addSessionToWorkspace, root, workspaceViewStateByWorkspace]);

  const pasteSelectionIntoWorkspace = useCallback((workspaceId: string) => {
    if (!clipboardIds.length) return;
    const destination = getWorkspace(root, workspaceId);
    if (!destination) return;

    const filesToMove: Array<{ file: WorkspaceFile; sourceWorkspaceId: string }> = [];
    const tabsToMove = new Set<string>();

    for (const id of clipboardIds) {
      const node = findNode(root, id);
      const sourceWorkspace = findWorkspaceForNode(root, id);
      if (!node || !sourceWorkspace) continue;
      if (node.type === 'file' && node.filePath) {
        const file = (workspaceFilesByWorkspace[sourceWorkspace.id] ?? []).find((entry) => entry.path === node.filePath);
        if (file) filesToMove.push({ file, sourceWorkspaceId: sourceWorkspace.id });
      }
      if (node.type === 'tab') tabsToMove.add(id);
    }

    if (filesToMove.length) {
      setWorkspaceFilesByWorkspace((current) => {
        const next = { ...current };
        for (const { file, sourceWorkspaceId } of filesToMove) {
          next[sourceWorkspaceId] = removeWorkspaceFile(next[sourceWorkspaceId] ?? [], file.path);
          next[workspaceId] = upsertWorkspaceFile(next[workspaceId] ?? [], file);
        }
        return next;
      });
    }

    if (tabsToMove.size) {
      setRoot((current) => {
        const movedTabs: TreeNode[] = [];
        const withoutMoved = (current.children ?? []).map((workspace) => deepUpdate(ensureWorkspaceCategories(workspace), workspace.id, (node) => ({
          ...node,
          children: (node.children ?? []).map((category) => ({
            ...category,
            children: (category.children ?? []).filter((child) => {
              if (tabsToMove.has(child.id)) {
                movedTabs.push(child);
                return false;
              }
              return true;
            }),
          })),
        })));
        const children = withoutMoved.map((workspace) => {
          if (workspace.id !== workspaceId) return workspace;
          return {
            ...workspace,
            expanded: true,
            children: (workspace.children ?? []).map((category) => ({
              ...category,
              expanded: true,
              children: category.nodeKind
                ? [...(category.children ?? []), ...movedTabs.filter((tab) => (tab.nodeKind ?? 'browser') === category.nodeKind)]
                : category.children,
            })),
          };
        });
        return { ...current, children: children as TreeNode[] };
      });
    }

    setClipboardIds([]);
    setSelectedIds([]);
    setSelectionAnchorId(null);
    setToast({ msg: `Pasted ${clipboardIds.length} item${clipboardIds.length === 1 ? '' : 's'} into ${destination.name}`, type: 'success' });
  }, [clipboardIds, root, setToast, workspaceFilesByWorkspace]);

  const useReadable = COPILOT_RUNTIME_ENABLED ? useCopilotReadable : (() => undefined);

  useReadable({
    description: 'Current agent browser workspace context',
    value: {
      activePanel,
      activeWorkspace: activeWorkspace.name,
      openTab: openBrowserTabs[0]?.name ?? null,
      defaultProvider: getDefaultAgentProvider({ installedModels, copilotState, cursorState }),
      copilot: {
        authenticated: copilotState.authenticated,
        models: copilotState.models.map((model) => model.id),
      },
      cursor: {
        authenticated: cursorState.authenticated,
        models: cursorState.models.map((model) => model.id),
      },
      installedModels: installedModels.map((model) => ({ id: model.id, task: model.task })),
      tabsInWorkspace: countTabs(activeWorkspace),
      workspaceFiles: activeWorkspaceFiles.map((file) => file.path),
      artifacts: activeArtifacts.map((artifact) => ({ id: artifact.id, title: artifact.title, files: artifact.files.map((file) => file.path) })),
      capabilityFiles: activeWorkspaceFiles
        .filter((file) => file.path.startsWith('.agents/') || file.path.startsWith('.memory/'))
        .map((file) => file.path),
      plugins: activeWorkspaceCapabilities.plugins.map((plugin) => plugin.directory),
      hooks: activeWorkspaceCapabilities.hooks.map((hook) => hook.name),
    },
  }, [activeArtifacts, activePanel, activeWorkspace, activeWorkspaceCapabilities, activeWorkspaceFiles, copilotState, cursorState, installedModels, openBrowserTabs]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchBrowserModels(registryQuery, registryTask, 25, controller.signal)
        .then(setRegistryModels)
        .catch((error) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          if (error instanceof Error && error.name === 'AbortError') return;
          setToast({ msg: error instanceof Error ? error.message : 'Registry search failed', type: 'error' });
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [registryQuery, registryTask, setToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(WORKSPACE_FILES_STORAGE_KEY, JSON.stringify(workspaceFilesByWorkspace));
      } catch (error) {
        setToast({
          msg: error instanceof Error ? error.message : 'Failed to persist workspace files locally',
          type: 'warning',
        });
      }
    }, WORKSPACE_FILE_STORAGE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [setToast, workspaceFilesByWorkspace]);

  useEffect(() => {
    if (!visibleItems.length) {
      setCursorId(null);
      return;
    }
    if (!cursorId || !visibleItems.some((item) => item.node.id === cursorId)) {
      setCursorId(visibleItems[0].node.id);
    }
  }, [cursorId, visibleItems]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowShortcuts(false);
        setShowWorkspaces(false);
        setShowAddFileMenu(null);
        setTreeFilter('');
        setSelectedIds([]);
        setSelectionAnchorId(null);
        setClipboardIds([]);
        setRenamingWorkspaceId(null);
        if (activeWorkspaceViewState.editingFilePath || activeWorkspaceViewState.openTabIds.length) {
          setWorkspaceViewStateByWorkspace((current) => ({
            ...current,
            [activeWorkspaceId]: {
              ...(current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace)),
              openTabIds: [],
              editingFilePath: null,
            },
          }));
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.code === 'Backquote') {
        event.preventDefault();
        switchSessionMode(activeWorkspaceId, activeSessionMode === 'agent' ? 'terminal' : 'agent');
        return;
      }
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      if (event.key === '?') { event.preventDefault(); setShowShortcuts(true); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o' && !event.altKey) {
        event.preventDefault();
        openWorkspaceSwitcher();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        jumpToWorkspaceByIndex(Number(event.key) - 1);
        return;
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey && /^[1-9]$/.test(event.key)) {
        const targetPanel = PANEL_SHORTCUT_ORDER[Number(event.key) - 1];
        if (targetPanel) {
          event.preventDefault();
          switchSidebarPanel(targetPanel);
          return;
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        createWorkspace();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        const workspaces = root.children ?? [];
        const idx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
        if (idx < 0 || workspaces.length < 2) return;
        const offset = event.key === 'ArrowLeft' ? -1 : 1;
        const target = workspaces[(idx + offset + workspaces.length) % workspaces.length];
        if (target) switchWorkspace(target.id);
        return;
      }
      if (activePanel !== 'workspaces') return;

      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        omnibarRef.current?.focus();
        omnibarRef.current?.select();
        return;
      }

      const index = visibleItems.findIndex((item) => item.node.id === cursorId);
      const currentNode = cursorId ? findNode(root, cursorId) : null;
      const currentParent = cursorId ? findParent(root, cursorId) : null;
      const setRangeSelection = (targetIndex: number) => {
        const anchorId = selectionAnchorId ?? cursorId ?? visibleItems[targetIndex]?.node.id ?? null;
        if (!anchorId) return;
        const anchorIndex = visibleItems.findIndex((item) => item.node.id === anchorId);
        const [start, end] = [anchorIndex, targetIndex].sort((a, b) => a - b);
        setSelectedIds(visibleItems.slice(start, end + 1).map((item) => item.node.id));
        setSelectionAnchorId(anchorId);
      };

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelectedIds(visibleItems.map((item) => item.node.id));
        setSelectionAnchorId(cursorId);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x') {
        event.preventDefault();
        const nextClipboard = selectedIds.length ? selectedIds : cursorId ? [cursorId] : [];
        setClipboardIds(nextClipboard);
        setToast({ msg: nextClipboard.length ? `Cut ${nextClipboard.length} item${nextClipboard.length === 1 ? '' : 's'}` : 'Nothing selected to cut', type: nextClipboard.length ? 'info' : 'warning' });
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        const targetWorkspace = currentNode?.type === 'workspace'
          ? currentNode
          : currentParent?.type === 'workspace'
            ? currentParent
            : (cursorId ? findWorkspaceForNode(root, cursorId) : null) ?? getWorkspace(root, activeWorkspaceId);
        if (targetWorkspace) pasteSelectionIntoWorkspace(targetWorkspace.id);
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === ' ' && cursorId) {
        event.preventDefault();
        setSelectedIds((current) => current.includes(cursorId) ? current.filter((id) => id !== cursorId) : [...current, cursorId]);
        setSelectionAnchorId(cursorId);
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1 && /\S/.test(event.key)) {
        event.preventDefault();
        setTreeFilter((current) => `${current}${event.key.toLowerCase()}`);
        return;
      }
      if (event.key === 'Backspace' && treeFilter) {
        event.preventDefault();
        setTreeFilter((current) => current.slice(0, -1));
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = visibleItems[Math.min(visibleItems.length - 1, Math.max(0, index + 1))];
        if (next) {
          setCursorId(next.node.id);
          if (event.shiftKey) setRangeSelection(visibleItems.findIndex((item) => item.node.id === next.node.id));
        }
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prev = visibleItems[Math.max(0, index - 1)];
        if (prev) {
          setCursorId(prev.node.id);
          if (event.shiftKey) setRangeSelection(visibleItems.findIndex((item) => item.node.id === prev.node.id));
        }
      }
      if (event.key === 'Home' && visibleItems.length) {
        event.preventDefault();
        setCursorId(visibleItems[0].node.id);
      }
      if (event.key === 'End' && visibleItems.length) {
        event.preventDefault();
        setCursorId(visibleItems[visibleItems.length - 1].node.id);
      }
      if (event.key === 'ArrowRight' && cursorId) {
        if (currentNode && currentNode.type !== 'tab' && currentNode.type !== 'file' && !currentNode.expanded) {
          event.preventDefault();
          setRoot((current) => deepUpdate(current, currentNode.id, (entry) => ({ ...entry, expanded: true })));
          return;
        }
        if (currentNode && currentNode.type !== 'tab' && currentNode.type !== 'file' && currentNode.children?.length) {
          event.preventDefault();
          setCursorId(currentNode.children[0].id);
          return;
        }
      }
      if (event.key === 'ArrowLeft' && cursorId) {
        if (currentNode && currentNode.type !== 'tab' && currentNode.type !== 'file' && currentNode.expanded) {
          event.preventDefault();
          setRoot((current) => deepUpdate(current, currentNode.id, (entry) => ({ ...entry, expanded: false })));
          return;
        }
        if (currentParent && currentParent.type !== 'root' && currentParent.type !== 'workspace') {
          event.preventDefault();
          setCursorId(currentParent.id);
          return;
        }
      }
      if (event.key === 'Enter' && cursorId) {
        event.preventDefault();
        if (currentNode?.type === 'tab') handleOpenTreeTab(currentNode.id);
        if (currentNode?.type === 'file') handleOpenFileNode(currentNode.id);
        if (currentNode && currentNode.type !== 'tab' && currentNode.type !== 'file') {
          setRoot((current) => deepUpdate(current, currentNode.id, (entry) => ({ ...entry, expanded: !entry.expanded })));
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePanel, activeSessionMode, activeWorkspace, activeWorkspaceId, activeWorkspaceViewState.editingFilePath, activeWorkspaceViewState.openTabIds, clipboardIds, createWorkspace, cursorId, handleOpenFileNode, jumpToWorkspaceByIndex, openWorkspaceSwitcher, pasteSelectionIntoWorkspace, root, selectedIds, selectionAnchorId, setToast, switchSessionMode, switchSidebarPanel, switchWorkspace, treeFilter, visibleItems]);

  async function installModel(model: HFModel) {
    if (loadingModelId === model.id) return;
    if (installedModels.some((entry) => entry.id === model.id)) {
      setToast({ msg: `${model.name} is already installed`, type: 'info' });
      return;
    }

    const progressToast = createDeferredToastDispatcher(setToast);
    setLoadingModelId(model.id);
    setToast({ msg: `Installing ${model.name}…`, type: 'info' });
    try {
      await browserInferenceEngine.loadModel(model.task, model.id, {
        // onStatus(phase, msg, pct): show download progress per TRD §7.1
        onStatus: (_phase, msg, pct) => progressToast.push({ msg: pct != null ? `${msg} ${pct}%` : msg, type: 'info' }),
        onPhase: (phase) => progressToast.push({ msg: phase, type: 'info' }),
      });
      progressToast.cancel();
      setInstalledModels((current) => current.some((entry) => entry.id === model.id) ? current : [...current, { ...model, status: 'installed' }]);
      setToast({ msg: `${model.name} installed`, type: 'success' });
    } catch (error) {
      progressToast.cancel();
      console.error(`Failed to install model ${model.id}`, error);
      const message = error instanceof Error ? error.message : 'Unknown installation error';
      setToast({ msg: `Failed to install ${model.name}: ${message}`, type: 'error' });
    } finally {
      progressToast.cancel();
      setLoadingModelId((current) => current === model.id ? null : current);
    }
  }

  function deleteModel(id: string) {
    setInstalledModels((current) => current.filter((m) => m.id !== id));
  }

  function handleOmnibarSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = classifyOmnibar(omnibar);
    if (result.intent === 'navigate') {
      const tab: TreeNode = {
        id: createUniqueId(),
        name: result.value.replace(/^https?:\/\//, '').slice(0, NEW_TAB_NAME_LENGTH),
        type: 'tab',
        nodeKind: 'browser',
        url: result.value,
        memoryTier: 'hot',
        memoryMB: DEFAULT_NEW_TAB_MEMORY_MB,
      };
      setRoot((current) => deepUpdate(current, activeWorkspaceId, (node) => {
        const workspace = ensureWorkspaceCategories(node);
        return {
          ...workspace,
          expanded: true,
          children: (workspace.children ?? []).map((child) => child.nodeKind === 'browser'
            ? { ...child, expanded: true, children: [...(child.children ?? []), tab] }
            : child),
        };
      }));
      setWorkspaceViewStateByWorkspace((current) => ({
        ...current,
        [activeWorkspaceId]: {
          ...(current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace)),
          openTabIds: [
            ...((current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace)).openTabIds ?? []).filter((id) => id !== tab.id),
            tab.id,
          ],
        },
      }));
      setToast({ msg: `Opened ${result.value}`, type: 'success' });
    } else {
      setPendingSearch(result.value);
      setToast({ msg: `Queued search: ${result.value}`, type: 'info' });
    }
    setOmnibar('');
  }

  function handleAddFileToWorkspace(kind: WorkspaceFileKind, wsId: string) {
    const nextFile = createWorkspaceFileTemplate(kind, addFileName);
    setWorkspaceFilesByWorkspace((current) => ({
      ...current,
      [wsId]: upsertWorkspaceFile(current[wsId] ?? [], nextFile),
    }));
    setAddFileName('');
    setShowAddFileMenu(null);
    setWorkspaceViewStateByWorkspace((current) => ({
      ...current,
      [wsId]: {
        ...(current[wsId] ?? createWorkspaceViewEntry(getWorkspace(root, wsId) ?? activeWorkspace)),
        editingFilePath: nextFile.path,
      },
    }));
    switchWorkspace(wsId);
    setToast({ msg: `Added ${nextFile.path}`, type: 'success' });
  }

  async function handleAddToSessionFs(sessionId: string, basePath: string, isFolder: boolean) {
    const bash = bashBySessionRef.current[sessionId];
    if (!bash) { setToast({ msg: 'Session not yet initialised — open it first', type: 'warning' }); return; }
    let path: string;
    try {
      path = buildSessionFsChildPath(basePath, addSessionFsName);
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : 'Invalid session filesystem path.', type: 'warning' });
      return;
    }
    if (isFolder) {
      await bash.fs.mkdir(path, { recursive: true });
    } else {
      await bash.fs.writeFile(path, '', 'utf-8');
    }
    handleTerminalFsPathsChanged(sessionId, bash.fs.getAllPaths());
    setAddSessionFsName('');
    setAddSessionFsMenu(null);
    setToast({ msg: `Created ${path}`, type: 'success' });
  }

  async function handleScaffoldToSessionFs(sessionId: string, template: { path: string; content: string }) {
    const bash = bashBySessionRef.current[sessionId];
    if (!bash) { setToast({ msg: 'Session not yet initialised — open it first', type: 'warning' }); return; }
    const dir = template.path.slice(0, template.path.lastIndexOf('/'));
    if (dir) await bash.fs.mkdir(dir, { recursive: true });
    await bash.fs.writeFile(template.path, template.content, 'utf-8');
    handleTerminalFsPathsChanged(sessionId, bash.fs.getAllPaths());
    setToast({ msg: `Created ${template.path}`, type: 'success' });
  }

  async function handleDeleteSessionFsNode(sessionId: string, path: string) {
    const bash = bashBySessionRef.current[sessionId];
    if (!bash) { setToast({ msg: 'Session not yet initialised — open it first', type: 'warning' }); return; }
    let normalizedPath: string;
    try {
      normalizedPath = normalizeSessionFsPath(path);
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : 'Invalid session filesystem path.', type: 'warning' });
      return;
    }
    await bash.exec(`rm -rf ${quoteShellArg(normalizedPath)}`);
    handleTerminalFsPathsChanged(sessionId, bash.fs.getAllPaths());
    setToast({ msg: `Deleted ${normalizedPath}`, type: 'success' });
  }

  async function handleRenameSessionFsNode(sessionId: string, oldPath: string, newName: string) {
    const bash = bashBySessionRef.current[sessionId];
    if (!bash) { setToast({ msg: 'Session not yet initialised — open it first', type: 'warning' }); return; }
    let normalizedOldPath: string;
    let newPath: string;
    try {
      normalizedOldPath = normalizeSessionFsPath(oldPath);
      newPath = buildRenamedSessionFsPath(normalizedOldPath, newName);
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : 'Invalid session filesystem path.', type: 'warning' });
      return;
    }
    await bash.exec(`mv ${quoteShellArg(normalizedOldPath)} ${quoteShellArg(newPath)}`);
    handleTerminalFsPathsChanged(sessionId, bash.fs.getAllPaths());
    setRenameSessionFsMenu(null);
    setRenameSessionFsName('');
    setToast({ msg: `Renamed to ${newName}`, type: 'success' });
  }

  // ── Browser tab actions ───────────────────────────────────────────────────

  function handleBookmarkTab(nodeId: string) {
    const node = findNode(root, nodeId);
    if (!node) return;
    const next = !node.persisted;
    setRoot((current) => deepUpdate(current, nodeId, (n) => ({ ...n, persisted: next })));
    setToast({ msg: next ? `Bookmarked ${node.name}` : `Removed bookmark from ${node.name}`, type: 'success' });
  }

  function handleMuteTab(nodeId: string) {
    const node = findNode(root, nodeId);
    if (!node) return;
    const next = !node.muted;
    setRoot((current) => deepUpdate(current, nodeId, (n) => ({ ...n, muted: next })));
    setToast({ msg: next ? `Muted ${node.name}` : `Unmuted ${node.name}`, type: 'info' });
  }

  async function handleCopyUri(node: TreeNode) {
    try {
      await writeToClipboard(node.url ?? '', `URI: ${node.name}`);
      setToast({ msg: 'URI copied to clipboard', type: 'success' });
    } catch {
      setToast({ msg: 'Failed to copy URI', type: 'error' });
    }
  }

  // ── Session tab actions ───────────────────────────────────────────────────

  async function handleShareSession(node: TreeNode) {
    const ws = findWorkspaceForNode(root, node.id);
    const text = `Session: ${node.name} (workspace: ${ws?.name ?? 'Unknown'})`;
    try {
      await writeToClipboard(text, `Session: ${node.name}`);
      setToast({ msg: 'Session link copied to clipboard', type: 'success' });
    } catch {
      setToast({ msg: 'Failed to copy session link', type: 'error' });
    }
  }

  function openRenameSessionDialog(node: TreeNode) {
    setSessionRenameDraft(node.name);
    setRenamingSessionNodeId(node.id);
  }

  function handleRenameSessionNode(name: string) {
    if (!renamingSessionNodeId || !name.trim()) return;
    renameSessionNodeById(renamingSessionNodeId, name, true);
    setRenamingSessionNodeId(null);
    setSessionRenameDraft('');
  }

  // ── Context menu entry builders ───────────────────────────────────────────

  async function writeToClipboard(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    lastClipboardTextRef.current = text;
    const entry: ClipboardEntry = { id: createUniqueId(), text, label, timestamp: Date.now() };
    setClipboardHistory((prev) => [entry, ...prev].slice(0, 50));
  }

  async function handleClipboardRollback(entry: ClipboardEntry) {
    try {
      await navigator.clipboard.writeText(entry.text);
      setClipboardHistory((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)].slice(0, 50));
      setHistoryNode(null);
      setToast({ msg: 'Clipboard restored', type: 'success' });
    } catch {
      setToast({ msg: 'Failed to restore clipboard', type: 'error' });
    }
  }

  function buildNewVfsSubMenu(vfsArgs: { sessionId: string; basePath: string; isDriveRoot: boolean }): ContextMenuEntry[] {
    return [
      { label: 'Add File', onClick: () => setAddSessionFsMenu({ ...vfsArgs, kind: 'file' }) },
      { label: 'Add Folder', onClick: () => setAddSessionFsMenu({ ...vfsArgs, kind: 'folder' }) },
      'separator',
      { label: 'Add hook', onClick: () => void handleScaffoldToSessionFs(vfsArgs.sessionId, makeAgentHook(vfsArgs.basePath)) },
    ];
  }

  function buildBrowserContextMenu(node: TreeNode): { entries: ContextMenuEntry[]; topButtons: ContextMenuTopButton[] } {
    return {
      topButtons: [
        { icon: node.persisted ? BookmarkMinus : Bookmark, label: node.persisted ? 'Remove Bookmark' : 'Bookmark', onClick: () => handleBookmarkTab(node.id) },
        { icon: node.muted ? Volume2 : VolumeX, label: node.muted ? 'Unmute' : 'Mute', onClick: () => handleMuteTab(node.id) },
        { icon: Copy, label: 'Copy URI', onClick: () => void handleCopyUri(node) },
        { icon: X, label: 'Close', onClick: () => handleRemoveFileNode(node.id) },
      ],
      entries: [
        { label: 'History', onClick: () => setHistoryNode(node) },
        'separator',
        { label: 'Properties', onClick: () => setPropertiesNode(node) },
      ],
    };
  }

  function buildSessionContextMenu(node: TreeNode): { entries: ContextMenuEntry[]; topButtons: ContextMenuTopButton[] } {
    return {
      topButtons: [
        { icon: Share2, label: 'Share', onClick: () => void handleShareSession(node) },
        { icon: Pencil, label: 'Rename', onClick: () => openRenameSessionDialog(node) },
        { icon: Trash2, label: 'Remove', onClick: () => handleRemoveFileNode(node.id) },
      ],
      entries: [
        { label: 'History', onClick: () => setHistoryNode(node) },
        'separator',
        { label: 'Properties', onClick: () => setPropertiesNode(node) },
      ],
    };
  }

  function buildVfsContextMenu(vfsArgs: { sessionId: string; basePath: string; isDriveRoot: boolean }, sourceNode?: TreeNode): { entries: ContextMenuEntry[]; topButtons: ContextMenuTopButton[] } {
    const newButton: ContextMenuTopButton = { icon: Plus, label: 'New', subMenu: buildNewVfsSubMenu(vfsArgs) };
    const nodeName = sourceNode?.name ?? vfsArgs.basePath.split('/').pop() ?? 'root';
    const fakeId = `vfs-hist:${vfsArgs.sessionId}:${vfsArgs.basePath}`;
    const entries: ContextMenuEntry[] = [
      { label: 'History', onClick: () => {
        const fakeNode: TreeNode = { id: fakeId, name: nodeName, type: 'folder' };
        setHistoryNode(fakeNode);
      } },
      'separator',
      { label: 'Properties', onClick: () => {
        const fakeNode: TreeNode = { id: fakeId, name: nodeName, type: 'folder' };
        setPropertiesNode(fakeNode);
      } },
    ];
    if (vfsArgs.isDriveRoot) {
      return { topButtons: [newButton], entries };
    }
    return {
      topButtons: [
        { icon: Pencil, label: 'Rename', onClick: () => { setRenameSessionFsName(vfsArgs.basePath.slice(vfsArgs.basePath.lastIndexOf('/') + 1)); setRenameSessionFsMenu({ sessionId: vfsArgs.sessionId, path: vfsArgs.basePath }); } },
        { icon: Trash2, label: 'Delete', onClick: () => void handleDeleteSessionFsNode(vfsArgs.sessionId, vfsArgs.basePath) },
        newButton,
      ],
      entries,
    };
  }

  function buildFileContextMenu(node: TreeNode): { entries: ContextMenuEntry[]; topButtons: ContextMenuTopButton[] } {
    return {
      topButtons: [
        {
          icon: FolderInput,
          label: 'Move',
          onClick: () => setFileOpModal({ node, op: 'move' }),
          splitOptions: [
            { icon: Link, label: 'Symlink', onClick: () => setFileOpModal({ node, op: 'symlink' }) },
            { icon: Copy, label: 'Duplicate', onClick: () => setFileOpModal({ node, op: 'duplicate' }) },
          ],
        },
        { icon: Trash2, label: 'Remove', onClick: () => handleRemoveFileNode(node.id) },
      ],
      entries: [
        { label: 'History', onClick: () => setHistoryNode(node) },
        'separator',
        { label: 'Properties', onClick: () => setPropertiesNode(node) },
      ],
    };
  }

  function buildArtifactContextMenu(node: TreeNode): { entries: ContextMenuEntry[]; topButtons: ContextMenuTopButton[] } {
    const artifactId = node.artifactReferenceId ?? node.artifactId ?? '';
    return {
      topButtons: [
        { icon: Download, label: 'Download', onClick: () => downloadArtifact(artifactId) },
        { icon: Link, label: 'Attach', onClick: () => attachArtifactToSession(artifactId) },
        { icon: MessageSquare, label: 'New Session', onClick: () => openSessionWithArtifact(artifactId) },
      ],
      entries: [
        { label: 'Open', onClick: () => openArtifactPanel(artifactId, node.artifactFilePath ?? null, findWorkspaceForNode(root, node.id)?.id ?? activeWorkspaceId) },
        { label: 'History', onClick: () => setHistoryNode(node) },
        'separator',
        { label: 'Properties', onClick: () => setPropertiesNode(node) },
      ],
    };
  }

  function buildClipboardContextMenu(node: TreeNode): { entries: ContextMenuEntry[]; topButtons: ContextMenuTopButton[] } {
    return {
      topButtons: [],
      entries: [
        { label: 'History', onClick: () => setHistoryNode(node) },
        'separator',
        { label: 'Properties', onClick: () => setPropertiesNode(node) },
      ],
    };
  }

  function openWorkspaceFileMenu(workspaceId: string) {
    setAddFileName('');
    setShowAddFileMenu(workspaceId);
  }

  function buildAppContextMenu(): { entries: ContextMenuEntry[]; topButtons: ContextMenuTopButton[] } {
    return {
      topButtons: [
        { icon: Globe, label: 'New tab', onClick: () => addBrowserTabToWorkspace(activeWorkspaceId) },
        { icon: MessageSquare, label: 'New session', onClick: () => addSessionToWorkspace(activeWorkspaceId) },
        { icon: File, label: 'Add file', onClick: () => openWorkspaceFileMenu(activeWorkspaceId) },
        { icon: Layers3, label: 'Workspaces', onClick: openWorkspaceSwitcher },
      ],
      entries: [
        { label: 'Properties', onClick: () => setPropertiesNode(activeWorkspace) },
      ],
    };
  }

  function buildWorkspaceContextMenu(node: TreeNode): { entries: ContextMenuEntry[]; topButtons: ContextMenuTopButton[] } {
    const entries: ContextMenuEntry[] = [];
    if (node.id !== activeWorkspaceId) {
      entries.push({ label: 'Switch workspace', onClick: () => switchWorkspace(node.id) });
    }
    entries.push(
      { label: 'Workspaces', onClick: openWorkspaceSwitcher },
      'separator',
      { label: 'Properties', onClick: () => setPropertiesNode(node) },
    );
    return {
      topButtons: [
        { icon: Globe, label: 'New tab', onClick: () => addBrowserTabToWorkspace(node.id) },
        { icon: MessageSquare, label: 'New session', onClick: () => addSessionToWorkspace(node.id) },
        { icon: File, label: 'Add file', onClick: () => openWorkspaceFileMenu(node.id) },
        { icon: Pencil, label: 'Rename', onClick: () => openRenameWorkspace(node.id) },
      ],
      entries,
    };
  }

  function buildWorkspaceSectionContextMenu(node: TreeNode): { entries: ContextMenuEntry[]; topButtons: ContextMenuTopButton[] } | null {
    const workspace = findWorkspaceForNode(root, node.id) ?? activeWorkspace;
    const entries: ContextMenuEntry[] = [{ label: 'Properties', onClick: () => setPropertiesNode(node) }];
    if (node.nodeKind === 'browser') {
      return {
        topButtons: [
          { icon: Globe, label: 'New tab', onClick: () => addBrowserTabToWorkspace(workspace.id) },
        ],
        entries,
      };
    }
    if (node.nodeKind === 'session') {
      return {
        topButtons: [
          { icon: MessageSquare, label: 'New session', onClick: () => addSessionToWorkspace(workspace.id) },
        ],
        entries,
      };
    }
    if (node.nodeKind === 'files') {
      return {
        topButtons: [
          { icon: File, label: 'Add file', onClick: () => openWorkspaceFileMenu(workspace.id) },
        ],
        entries,
      };
    }
    return null;
  }

  function openContextMenuForNode(x: number, y: number, node: TreeNode) {
    if (node.type === 'workspace') {
      setContextMenu({ x, y, itemId: node.id, itemType: 'workspace', ...buildWorkspaceContextMenu(node) });
      return;
    }
    if (hasWorkspaceSectionContextMenu(node)) {
      const sectionMenu = buildWorkspaceSectionContextMenu(node);
      if (sectionMenu) {
        setContextMenu({ x, y, itemId: node.id, itemType: 'workspace-section', ...sectionMenu });
      }
      return;
    }
    if (node.id.startsWith('vfs:') && !node.nodeKind) {
      const vfsArgs = parseVfsNodeId(node.id);
      if (vfsArgs) {
        setContextMenu({ x, y, itemId: node.id, itemType: 'session-fs-entry', ...buildVfsContextMenu(vfsArgs, node) });
      }
      return;
    }
    if (node.nodeKind === 'clipboard') {
      setContextMenu({ x, y, itemId: node.id, itemType: 'clipboard', ...buildClipboardContextMenu(node) });
      return;
    }
    if (node.nodeKind === 'browser') {
      setContextMenu({ x, y, itemId: node.id, itemType: 'browser-page', ...buildBrowserContextMenu(node) });
      return;
    }
    if (node.nodeKind === 'session') {
      setContextMenu({ x, y, itemId: node.id, itemType: 'session', ...buildSessionContextMenu(node) });
      return;
    }
    if (node.artifactId || node.artifactReferenceId) {
      setContextMenu({ x, y, itemId: node.id, itemType: node.artifactFilePath ? 'artifact-file' : 'artifact', ...buildArtifactContextMenu(node) });
      return;
    }
    if (node.type === 'file') {
      setContextMenu({ x, y, itemId: node.id, itemType: 'workspace-file', ...buildFileContextMenu(node) });
    }
  }

  function handleNodeContextMenu(x: number, y: number, node: TreeNode) {
    openContextMenuForNode(x, y, node);
  }

  function handleAppContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const target = event.target as HTMLElement | null;
    if (target?.closest('.ctx-menu')) return;
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      itemId: activeWorkspaceId,
      itemType: 'app-shell',
      ...buildAppContextMenu(),
    });
  }

  // ── Properties ─────────────────────────────────────────────────────────────

  function buildNodeMetadata(node: TreeNode): NodeMetadata {
    const now = Date.now();
    if (node.nodeKind === 'clipboard') {
      return {
        location: 'System clipboard',
        sizeLabel: 'N/A',
        createdAt: now,
        modifiedAt: now,
        accessedAt: now,
        identityPermissions: defaultPermissionsFor(['Read', 'Write', 'History', 'Restore']),
      };
    }
    if (node.type === 'workspace') {
      return {
        location: 'Workspace',
        sizeLabel: `${countTabs(node)} pages`,
        createdAt: now,
        modifiedAt: now,
        accessedAt: now,
        identityPermissions: defaultPermissionsFor(['New tab', 'New session', 'Add file', 'Rename']),
      };
    }
    if (hasWorkspaceSectionContextMenu(node)) {
      const permissions = node.nodeKind === 'browser'
        ? ['New tab']
        : node.nodeKind === 'session'
          ? ['New session']
          : ['Add file'];
      return {
        location: `${node.name} section`,
        sizeLabel: `${node.children?.length ?? 0} items`,
        createdAt: now,
        modifiedAt: now,
        accessedAt: now,
        identityPermissions: defaultPermissionsFor([...permissions, 'Properties']),
      };
    }
    if (node.type === 'tab' && node.nodeKind === 'browser') {
      return {
        location: node.url ?? '(no URL)',
        sizeLabel: `${node.memoryMB ?? 0} MB`,
        createdAt: now,
        modifiedAt: now,
        accessedAt: now,
        identityPermissions: defaultPermissionsFor(['Bookmark', 'Mute', 'Copy URI', 'Close']),
      };
    }
    if (node.type === 'tab' && node.nodeKind === 'session') {
      return {
        location: node.filePath ?? node.id,
        sizeLabel: 'N/A',
        createdAt: now,
        modifiedAt: now,
        accessedAt: now,
        identityPermissions: defaultPermissionsFor(['Share', 'Rename', 'Remove']),
      };
    }
    if (node.artifactId || node.artifactReferenceId) {
      const artifactId = node.artifactReferenceId ?? node.artifactId ?? '';
      const artifact = activeArtifacts.find((candidate) => candidate.id === artifactId);
      const file = artifact?.files.find((candidate) => candidate.path === node.artifactFilePath);
      return {
        location: node.artifactFilePath ? `//artifacts/${artifactId}/${node.artifactFilePath}` : `//artifacts/${artifactId}`,
        sizeLabel: file ? `${file.content.length} bytes` : artifact ? `${artifact.files.length} files` : 'N/A',
        createdAt: artifact ? Date.parse(artifact.createdAt) : now,
        modifiedAt: artifact ? Date.parse(artifact.updatedAt) : now,
        accessedAt: now,
        identityPermissions: defaultPermissionsFor(['Open', 'Download', 'Attach', 'New Session', 'History']),
      };
    }
    // VFS node — use node.name which may be '//session-1-fs' or sub-path name
    const vfsArgs = node.id.startsWith('vfs:') ? parseVfsNodeId(node.id) : null;
    if (node.type === 'file') {
      return {
        location: node.filePath ?? node.name,
        sizeLabel: 'N/A',
        createdAt: now,
        modifiedAt: now,
        accessedAt: now,
        identityPermissions: defaultPermissionsFor(['Move', 'Symlink', 'Duplicate', 'Remove']),
      };
    }
    return {
      location: `${node.name}${vfsArgs?.basePath ? ` (${vfsArgs.basePath})` : ''}`,
      sizeLabel: 'N/A',
      createdAt: now,
      modifiedAt: now,
      accessedAt: now,
      identityPermissions: defaultPermissionsFor(['Add File', 'Add Folder', 'Rename', 'Delete']),
    };
  }

  // ── Version / Session History ───────────────────────────────────────────────

  function updateVersionHistory(nodeId: string, dag: VersionDAG) {
    setVersionHistories((prev) => ({ ...prev, [nodeId]: dag }));
  }

  function syncBrowserTabFromHistory(tabId: string, history: BrowserNavHistory) {
    const entry = history.entries[history.currentIndex];
    if (!entry) {
      return;
    }

    setRoot((current) => deepUpdate(current, tabId, (node) => {
      if (node.type !== 'tab' || (node.nodeKind ?? 'browser') !== 'browser') {
        return node;
      }
      return {
        ...node,
        name: entry.title || entry.url,
        url: entry.url,
      };
    }));
  }

  function stepBrowserHistory(tabId: string, step: -1 | 1): BrowserNavHistory | null {
    let nextHistory: BrowserNavHistory | null = null;
    let shouldSync = false;
    setBrowserNavHistories((prev) => {
      const history = prev[tabId];
      if (!history) {
        return prev;
      }

      const nextIndex = history.currentIndex + step;
      if (nextIndex < 0 || nextIndex >= history.entries.length) {
        nextHistory = history;
        return prev;
      }

      nextHistory = { ...history, currentIndex: nextIndex };
      shouldSync = true;
      return { ...prev, [tabId]: nextHistory };
    });

    if (shouldSync && nextHistory) {
      syncBrowserTabFromHistory(tabId, nextHistory);
    }

    return nextHistory;
  }

  function handleBrowserBack(tabId: string) {
    stepBrowserHistory(tabId, -1);
  }

  function handleBrowserForward(tabId: string) {
    stepBrowserHistory(tabId, 1);
  }

  function handleRemoveFileNode(nodeId: string) {
    const node = findNode(root, nodeId);
    if (!node) return;
    const ownerWorkspace = findWorkspaceForNode(root, nodeId);
    if (node.type === 'file' && node.filePath) {
      if (!ownerWorkspace) return;
      setWorkspaceFilesByWorkspace((current) => ({
        ...current,
        [ownerWorkspace.id]: removeWorkspaceFile(current[ownerWorkspace.id] ?? [], node.filePath!),
      }));
      setWorkspaceViewStateByWorkspace((current) => {
        const existing = current[ownerWorkspace.id];
        if (!existing || existing.editingFilePath !== node.filePath) return current;
        return {
          ...current,
          [ownerWorkspace.id]: {
            ...existing,
            editingFilePath: null,
            panelOrder: existing.panelOrder.filter((id) => id !== `file:${node.filePath}`),
          },
        };
      });
      setToast({ msg: `Removed ${node.filePath}`, type: 'info' });
      return;
    }
    const ownerWorkspaceId = ownerWorkspace?.id ?? activeWorkspaceId;
    const paneId = renderPaneIdForNode(node);
    if (node.nodeKind === 'session') {
      delete bashBySessionRef.current[nodeId];
      removeStoredRecordEntry(localStorageBackend, STORAGE_KEYS.chatMessagesBySession, isChatMessagesBySession, nodeId);
      removeStoredRecordEntry(localStorageBackend, STORAGE_KEYS.chatHistoryBySession, isStringArrayRecord, nodeId);
      removeStoredRecordEntry(localStorageBackend, STORAGE_KEYS.artifactContextBySession, isArtifactContextBySession, nodeId);
      setArtifactContextBySession((current) => {
        if (!(nodeId in current)) return current;
        const next = { ...current };
        delete next[nodeId];
        return next;
      });
      setTerminalFsPathsBySession((current) => {
        if (!(nodeId in current)) return current;
        const next = { ...current };
        delete next[nodeId];
        return next;
      });
    }
    if (node.type === 'tab' && (node.nodeKind ?? 'browser') === 'browser') {
      setBrowserNavHistories((current) => {
        if (!(nodeId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[nodeId];
        return next;
      });
    }
    const nextRoot = removeNodeById(root, nodeId);
    setRoot(nextRoot);
    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[ownerWorkspaceId];
      if (!existing) return current;
      const remainingSessionIds = (existing.activeSessionIds ?? []).filter((id) => id !== nodeId);
      const nextEntry: WorkspaceViewState = {
        ...existing,
        openTabIds: (existing.openTabIds ?? []).filter((id) => id !== nodeId),
        activeSessionIds: remainingSessionIds,
        mountedSessionFsIds: (existing.mountedSessionFsIds ?? []).filter((id) => id !== nodeId),
        panelOrder: paneId ? existing.panelOrder.filter((id) => id !== paneId) : existing.panelOrder,
      };
      return workspaceViewStateEquals(existing, nextEntry)
        ? current
        : { ...current, [ownerWorkspaceId]: nextEntry };
    });
  }

  // ── File operations (Move / Symlink / Duplicate) ──────────────────────────

  function handleFileMove(node: TreeNode, targetDir: string) {
    if (!node.filePath) return;
    const fileName = node.filePath.split('/').pop() ?? node.name;
    const newPath = targetDir.trim() ? `${targetDir.trim()}/${fileName}` : fileName;
    const ownerWorkspace = findWorkspaceForNode(root, node.id);
    if (!ownerWorkspace) return;
    setWorkspaceFilesByWorkspace((prev) => ({
      ...prev,
      [ownerWorkspace.id]: (prev[ownerWorkspace.id] ?? []).map((f) =>
        f.path === node.filePath ? { ...f, path: newPath } : f
      ),
    }));
    setFileOpModal(null);
    setToast({ msg: `Moved to ${newPath}`, type: 'success' });
  }

  function handleFileSymlink(node: TreeNode, targetDir: string) {
    if (!node.filePath) return;
    const fileName = node.filePath.split('/').pop() ?? node.name;
    const linkPath = targetDir.trim() ? `${targetDir.trim()}/${fileName}` : fileName;
    const ownerWorkspace = findWorkspaceForNode(root, node.id);
    if (!ownerWorkspace) return;
    const symlink: WorkspaceFile = { path: linkPath, content: `\u2192 ${node.filePath}`, updatedAt: new Date().toISOString() };
    setWorkspaceFilesByWorkspace((prev) => ({
      ...prev,
      [ownerWorkspace.id]: [...(prev[ownerWorkspace.id] ?? []), symlink],
    }));
    setFileOpModal(null);
    setToast({ msg: `Symlink created at ${linkPath}`, type: 'success' });
  }

  function handleFileDuplicate(node: TreeNode, targetDir: string) {
    if (!node.filePath) return;
    const fileName = node.filePath.split('/').pop() ?? node.name;
    const copyPath = targetDir.trim() ? `${targetDir.trim()}/${fileName}` : fileName;
    const ownerWorkspace = findWorkspaceForNode(root, node.id);
    if (!ownerWorkspace) return;
    const original = (workspaceFilesByWorkspace[ownerWorkspace.id] ?? []).find((f) => f.path === node.filePath);
    const dupe: WorkspaceFile = { path: copyPath, content: original?.content ?? '', updatedAt: new Date().toISOString() };
    setWorkspaceFilesByWorkspace((prev) => ({
      ...prev,
      [ownerWorkspace.id]: [...(prev[ownerWorkspace.id] ?? []), dupe],
    }));
    setFileOpModal(null);
    setToast({ msg: `Duplicated to ${copyPath}`, type: 'success' });
  }

  function handleFileOp(node: TreeNode, op: FileOpKind, targetDir: string) {
    if (op === 'move') handleFileMove(node, targetDir);
    else if (op === 'symlink') handleFileSymlink(node, targetDir);
    else handleFileDuplicate(node, targetDir);
  }

  function handleOpenFileNode(nodeId: string) {
    const node = findNode(root, nodeId);
    if (node?.artifactReferenceId || node?.artifactId) {
      const artifactId = node.artifactReferenceId ?? node.artifactId;
      const workspace = findWorkspaceForNode(root, nodeId);
      if (artifactId && workspace) {
        openArtifactPanel(artifactId, node.artifactFilePath ?? null, workspace.id);
      }
      return;
    }
    if (node?.filePath) {
      // Switch to the workspace that owns this file
      const workspace = findWorkspaceForNode(root, nodeId);
      if (workspace) {
        setWorkspaceViewStateByWorkspace((current) => ({
          ...current,
          [workspace.id]: (() => {
            const existing = current[workspace.id] ?? createWorkspaceViewEntry(workspace);
            return {
              ...existing,
              editingFilePath: existing.editingFilePath === node.filePath ? null : node.filePath ?? null,
            };
          })(),
        }));
        switchWorkspace(workspace.id);
      }
    }
  }

  function handleOpenTreeTab(nodeId: string, _multi = false) {
    const node = findNode(root, nodeId);
    if (!node || node.type !== 'tab') return;
    const workspace = findWorkspaceForNode(root, nodeId);
    if (workspace) switchWorkspace(workspace.id);
    if (!workspace) return;
    const toggleId = (ids: string[]) => ids.includes(nodeId)
      ? ids.filter((id) => id !== nodeId)
      : [...ids, nodeId];
    const toggleSessionId = (ids: string[]) => {
      if (!ids.includes(nodeId)) return [...ids, nodeId];
      return ids.length > 1 ? ids.filter((id) => id !== nodeId) : ids;
    };
    if ((node.nodeKind ?? 'browser') === 'browser') {
      setWorkspaceViewStateByWorkspace((current) => {
        const existing = current[workspace.id] ?? createWorkspaceViewEntry(workspace);
        const currentIds = existing.openTabIds ?? [];
        return {
          ...current,
          [workspace.id]: { ...existing, openTabIds: toggleId(currentIds) },
        };
      });
      return;
    }
    if (node.nodeKind === 'agent') {
      setWorkspaceViewStateByWorkspace((current) => {
        const existing = current[workspace.id] ?? createWorkspaceViewEntry(workspace);
        const currentIds = existing.activeSessionIds ?? [];
        const activeSessionIds = toggleSessionId(currentIds);
        return {
          ...current,
          [workspace.id]: {
            ...existing,
            activeSessionIds,
            panelOrder: [
              ...(existing.openTabIds ?? []).map((id) => `browser:${id}`),
              ...activeSessionIds.map((id) => `session:${id}`),
            ],
          },
        };
      });
      return;
    }
    if (node.nodeKind === 'terminal') {
      setWorkspaceViewStateByWorkspace((current) => {
        const existing = current[workspace.id] ?? createWorkspaceViewEntry(workspace);
        const currentIds = existing.activeSessionIds ?? [];
        const activeSessionIds = toggleSessionId(currentIds);
        return {
          ...current,
          [workspace.id]: {
            ...existing,
            activeSessionIds,
            panelOrder: [
              ...(existing.openTabIds ?? []).map((id) => `browser:${id}`),
              ...activeSessionIds.map((id) => `session:${id}`),
            ],
          },
        };
      });
    }
    if (node.nodeKind === 'session') {
      setWorkspaceViewStateByWorkspace((current) => {
        const existing = current[workspace.id] ?? createWorkspaceViewEntry(workspace);
        const currentIds = existing.activeSessionIds ?? [];
        const activeSessionIds = toggleSessionId(currentIds);
        return {
          ...current,
          [workspace.id]: {
            ...existing,
            activeSessionIds,
            panelOrder: [
              ...(existing.openTabIds ?? []).map((id) => `browser:${id}`),
              ...activeSessionIds.map((id) => `session:${id}`),
            ],
          },
        };
      });
    }
  }

  const handleSessionMcpControllerChange = useCallback((sessionId: string, controller: SessionMcpController | null) => {
    if (controller) {
      sessionMcpControllersRef.current[sessionId] = controller;
      return;
    }
    delete sessionMcpControllersRef.current[sessionId];
  }, []);

  const activeSessionFsEntries = useMemo<WorkspaceMcpSessionFsEntry[]>(() => {
    if (activeWorkspace.type !== 'workspace') {
      return [];
    }

    return buildActiveSessionFilesystemEntries({
      activeSessionIds: activeMountedSessionFsIds,
      terminalFsPathsBySession,
      terminalFsFileContentsBySession,
      initialCwd: BASH_INITIAL_CWD,
      inferSessionFsEntryKind,
    });
  }, [activeMountedSessionFsIds, activeWorkspace, terminalFsFileContentsBySession, terminalFsPathsBySession]);
  const activeSessionAssetsById = useMemo(() => activeSessionFsEntries.reduce<Record<string, Array<{ path: string; kind: string; isRoot?: boolean }>>>((entriesBySession, entry) => {
    const current = entriesBySession[entry.sessionId] ?? [];
    entriesBySession[entry.sessionId] = [
      ...current,
      {
        path: entry.path,
        kind: entry.kind,
        ...(entry.isRoot ? { isRoot: true } : {}),
      },
    ];
    return entriesBySession;
  }, {}), [activeSessionFsEntries]);
  const activeDashboardSessions = useMemo(() => activeWorkspaceSessions.map((session) => {
    const runtime = sessionRuntimeSnapshotsById[session.id] ?? sessionMcpControllersRef.current[session.id]?.getRuntimeState();
    return {
      ...session,
      ...(runtime ?? {}),
      assets: activeSessionAssetsById[session.id] ?? [],
    };
  }), [activeSessionAssetsById, activeWorkspaceSessions, sessionRuntimeSnapshotsById]);

  const activeWorktreeItems = useMemo<WorkspaceMcpWorktreeItem[]>(() => {
    if (activeWorkspace.type !== 'workspace') {
      return [];
    }

    return buildActiveWorktreeItems({
      flattenedItems: flattenWorkspaceTreeFiltered(activeWorkspace, ''),
      parseVfsNodeId,
    });
  }, [activeWorkspace]);

  const findActiveWorktreeItem = useCallback((itemId: string, itemType: WorkspaceMcpWorktreeItem['itemType']) => (
    activeWorktreeItems.find((item) => item.id === itemId && item.itemType === itemType) ?? null
  ), [activeWorktreeItems]);

  const readBrowserPageFromWorkspace = useCallback((pageId: string, overrides?: Partial<WorkspaceMcpBrowserPage>): WorkspaceMcpBrowserPage => {
    const page = activeBrowserPages.find((candidate) => candidate.id === pageId);
    if (!page) {
      throw new DOMException(`Browser page "${pageId}" is not available in ${activeWorkspace.name}.`, 'NotFoundError');
    }

    return {
      ...page,
      ...overrides,
    };
  }, [activeBrowserPages, activeWorkspace.name]);

  const getBrowserPageHistoryFromMcp = useCallback((pageId: string): WorkspaceMcpBrowserPageHistory | null => {
    const history = browserNavHistories[pageId];
    if (history) {
      return {
        pageId,
        currentIndex: history.currentIndex,
        entries: history.entries.map((entry) => ({ ...entry })),
      };
    }

    const page = activeBrowserPages.find((candidate) => candidate.id === pageId);
    if (!page) {
      return null;
    }

    return {
      pageId,
      currentIndex: 0,
      entries: [{ url: page.url, title: page.title, timestamp: Date.now() }],
    };
  }, [activeBrowserPages, browserNavHistories]);

  const createBrowserPageFromMcp = useCallback(async ({ url, title }: { url: string; title?: string }) => (
    confirmNewBrowserTab(activeWorkspaceId, url, title) ?? undefined
  ), [activeWorkspaceId, confirmNewBrowserTab]);

  const navigateBrowserPageFromMcp = useCallback(async ({ pageId, url, title }: { pageId: string; url: string; title?: string }) => {
    const page = readBrowserPageFromWorkspace(pageId);
    const target = resolveBrowserNavigationTarget(url, title);
    let nextHistory: BrowserNavHistory | null = null;
    setBrowserNavHistories((current) => {
      const existingHistory = current[pageId] ?? {
        entries: [{ url: page.url, title: page.title, timestamp: Date.now() }],
        currentIndex: 0,
      };
      const nextEntries = [
        ...existingHistory.entries.slice(0, existingHistory.currentIndex + 1),
        { url: target.url, title: target.title, timestamp: Date.now() },
      ];
      nextHistory = {
        entries: nextEntries,
        currentIndex: nextEntries.length - 1,
      };
      return { ...current, [pageId]: nextHistory };
    });
    if (nextHistory) {
      syncBrowserTabFromHistory(pageId, nextHistory);
    }
    return readBrowserPageFromWorkspace(pageId, {
      title: target.title,
      url: target.url,
      isOpen: page.isOpen,
    });
  }, [readBrowserPageFromWorkspace]);

  const navigateBrowserPageHistoryFromMcp = useCallback(async ({
    pageId,
    direction,
  }: {
    pageId: string;
    direction: 'back' | 'forward';
  }) => {
    readBrowserPageFromWorkspace(pageId);
    const nextHistory = stepBrowserHistory(pageId, direction === 'back' ? -1 : 1);
    const entry = nextHistory?.entries[nextHistory.currentIndex];
    return readBrowserPageFromWorkspace(pageId, entry ? { title: entry.title || entry.url, url: entry.url } : undefined);
  }, [readBrowserPageFromWorkspace]);

  const refreshBrowserPageFromMcp = useCallback(async (pageId: string) => {
    const history = browserNavHistories[pageId];
    const entry = history?.entries[history.currentIndex];
    if (history) {
      syncBrowserTabFromHistory(pageId, history);
    }
    return readBrowserPageFromWorkspace(pageId, entry ? { title: entry.title || entry.url, url: entry.url } : undefined);
  }, [browserNavHistories, readBrowserPageFromWorkspace]);

  const createSessionFromMcp = useCallback(async ({ name }: { name?: string }) => (
    addSessionToWorkspace(activeWorkspaceId, name) ?? undefined
  ), [activeWorkspaceId, addSessionToWorkspace]);

  const closeSessionFromMcp = useCallback(async (sessionId: string) => {
    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
      const nextIds = (existing.activeSessionIds ?? []).filter((id) => id !== sessionId);
      return nextIds.length === (existing.activeSessionIds ?? []).length
        ? current
        : { ...current, [activeWorkspaceId]: { ...existing, activeSessionIds: nextIds } };
    });
  }, [activeWorkspace, activeWorkspaceId]);

  const createArtifactFromMcp = useCallback(async (input: {
    id?: string;
    title?: string;
    description?: string;
    kind?: string;
    sourceSessionId?: string;
    references?: readonly string[];
    files: readonly ArtifactFile[];
  }) => {
    const artifact = createArtifact(input, { idFactory: createUniqueId });
    setArtifactsByWorkspace((current) => ({
      ...current,
      [activeWorkspaceId]: [
        artifact,
        ...(current[activeWorkspaceId] ?? []).filter((candidate) => candidate.id !== artifact.id),
      ],
    }));
    openArtifactPanel(artifact.id, artifact.files[0]?.path ?? null, activeWorkspaceId);
    setToast({ msg: `Created artifact ${artifact.title}`, type: 'success' });
    return artifact;
  }, [activeWorkspaceId, openArtifactPanel, setArtifactsByWorkspace, setToast]);

  const updateArtifactFromMcp = useCallback(async (artifactId: string, input: {
    title?: string;
    description?: string;
    kind?: string;
    references?: readonly string[];
    files: readonly ArtifactFile[];
  }) => {
    const existingArtifact = activeArtifacts.find((candidate) => candidate.id === artifactId);
    if (!existingArtifact) {
      throw new DOMException(`Artifact "${artifactId}" is not available in ${activeWorkspace.name}.`, 'NotFoundError');
    }
    const updatedArtifact = updateArtifactFiles(existingArtifact, input, { idFactory: createUniqueId });
    setArtifactsByWorkspace((current) => {
      const artifacts = current[activeWorkspaceId] ?? [];
      return {
        ...current,
        [activeWorkspaceId]: artifacts.map((candidate) => candidate.id === artifactId ? updatedArtifact : candidate),
      };
    });
    openArtifactPanel(updatedArtifact.id, updatedArtifact.files[0]?.path ?? null, activeWorkspaceId);
    setToast({ msg: `Updated artifact ${updatedArtifact.title}`, type: 'success' });
    return updatedArtifact;
  }, [activeArtifacts, activeWorkspace.name, activeWorkspaceId, openArtifactPanel, setArtifactsByWorkspace, setToast]);

  const createWorkspaceFileFromMcp = useCallback(async ({ path, content }: { path: string; content: string }) => {
    const nextFile: WorkspaceFile = {
      path,
      content,
      updatedAt: new Date().toISOString(),
    };
    const validationError = validateWorkspaceFile(nextFile);
    if (validationError) {
      throw new TypeError(validationError);
    }
    setWorkspaceFilesByWorkspace((current) => ({
      ...current,
      [activeWorkspaceId]: upsertWorkspaceFile(current[activeWorkspaceId] ?? [], nextFile),
    }));
    return nextFile;
  }, [activeWorkspaceId]);

  const writeWorkspaceFileFromMcp = useCallback(async ({ path, content }: { path: string; content: string }) => {
    const nextFile: WorkspaceFile = {
      path,
      content,
      updatedAt: new Date().toISOString(),
    };
    const validationError = validateWorkspaceFile(nextFile);
    if (validationError) {
      throw new TypeError(validationError);
    }
    setWorkspaceFilesByWorkspace((current) => ({
      ...current,
      [activeWorkspaceId]: upsertWorkspaceFile(current[activeWorkspaceId] ?? [], nextFile),
    }));
    return nextFile;
  }, [activeWorkspaceId]);

  const deleteWorkspaceFileFromMcp = useCallback(async ({ path }: { path: string }) => {
    setWorkspaceFilesByWorkspace((current) => ({
      ...current,
      [activeWorkspaceId]: removeWorkspaceFile(current[activeWorkspaceId] ?? [], path),
    }));
    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
      return {
        ...current,
        [activeWorkspaceId]: {
          ...existing,
          editingFilePath: existing.editingFilePath === path ? null : existing.editingFilePath,
          panelOrder: existing.panelOrder.filter((id) => id !== `file:${path}`),
        },
      };
    });
    return { path, deleted: true };
  }, [activeWorkspace, activeWorkspaceId]);

  const moveWorkspaceFileFromMcp = useCallback(async ({ path, targetPath }: { path: string; targetPath: string }) => {
    const existingFile = (workspaceFilesByWorkspace[activeWorkspaceId] ?? []).find((file) => file.path === path);
    if (!existingFile) {
      throw new DOMException(`Workspace file "${path}" is not available in ${activeWorkspace.name}.`, 'NotFoundError');
    }

    const nextFile: WorkspaceFile = {
      ...existingFile,
      path: targetPath,
      updatedAt: new Date().toISOString(),
    };
    setWorkspaceFilesByWorkspace((current) => ({
      ...current,
      [activeWorkspaceId]: upsertWorkspaceFile(removeWorkspaceFile(current[activeWorkspaceId] ?? [], path), nextFile),
    }));
    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
      return {
        ...current,
        [activeWorkspaceId]: {
          ...existing,
          editingFilePath: existing.editingFilePath === path ? targetPath : existing.editingFilePath,
          panelOrder: existing.panelOrder.map((paneId) => paneId === `file:${path}` ? `file:${targetPath}` : paneId),
        },
      };
    });
    return nextFile;
  }, [activeWorkspace, activeWorkspaceId, workspaceFilesByWorkspace]);

  const duplicateWorkspaceFileFromMcp = useCallback(async ({ path, targetPath }: { path: string; targetPath: string }) => {
    const existingFile = (workspaceFilesByWorkspace[activeWorkspaceId] ?? []).find((file) => file.path === path);
    if (!existingFile) {
      throw new DOMException(`Workspace file "${path}" is not available in ${activeWorkspace.name}.`, 'NotFoundError');
    }

    const nextFile: WorkspaceFile = {
      ...existingFile,
      path: targetPath,
      updatedAt: new Date().toISOString(),
    };
    setWorkspaceFilesByWorkspace((current) => ({
      ...current,
      [activeWorkspaceId]: upsertWorkspaceFile(current[activeWorkspaceId] ?? [], nextFile),
    }));
    return nextFile;
  }, [activeWorkspace.name, activeWorkspaceId, workspaceFilesByWorkspace]);

  const symlinkWorkspaceFileFromMcp = useCallback(async ({ path, targetPath }: { path: string; targetPath: string }) => {
    const existingFile = (workspaceFilesByWorkspace[activeWorkspaceId] ?? []).find((file) => file.path === path);
    if (!existingFile) {
      throw new DOMException(`Workspace file "${path}" is not available in ${activeWorkspace.name}.`, 'NotFoundError');
    }

    const nextFile: WorkspaceFile = {
      path: targetPath,
      content: `→ ${path}`,
      updatedAt: new Date().toISOString(),
    };
    setWorkspaceFilesByWorkspace((current) => ({
      ...current,
      [activeWorkspaceId]: upsertWorkspaceFile(current[activeWorkspaceId] ?? [], nextFile),
    }));
    return nextFile;
  }, [activeWorkspace.name, activeWorkspaceId, workspaceFilesByWorkspace]);

  const createSessionFsEntryFromMcp = useCallback(async ({
    sessionId,
    path,
    kind,
    content,
  }: {
    sessionId: string;
    path: string;
    kind: 'file' | 'folder';
    content?: string;
  }) => {
    const bash = getOrCreateSessionBash(sessionId);
    const normalizedPath = normalizeSessionFsPath(path);
    const dir = normalizedPath.slice(0, normalizedPath.lastIndexOf('/'));
    if (dir) {
      await bash.fs.mkdir(dir, { recursive: true });
    }
    if (kind === 'folder') {
      await bash.fs.mkdir(normalizedPath, { recursive: true });
    } else {
      await bash.fs.writeFile(normalizedPath, content ?? '', 'utf-8');
      if (content !== undefined) {
        setTerminalFsFileContentsBySession((current) => ({
          ...current,
          [sessionId]: { ...(current[sessionId] ?? {}), [normalizedPath]: content },
        }));
      }
    }
    handleTerminalFsPathsChanged(sessionId, bash.fs.getAllPaths());
  }, [getOrCreateSessionBash, handleTerminalFsPathsChanged]);

  const readSessionFsFileFromMcp = useCallback(async ({ sessionId, path }: { sessionId: string; path: string }) => {
    const bash = getOrCreateSessionBash(sessionId);
    const normalizedPath = normalizeSessionFsPath(path);
    const content = await bash.fs.readFile(normalizedPath, 'utf-8');
    return { sessionId, path: normalizedPath, kind: 'file' as const, content };
  }, [getOrCreateSessionBash]);

  const writeSessionFsFileFromMcp = useCallback(async ({ sessionId, path, content }: { sessionId: string; path: string; content: string }) => {
    const bash = getOrCreateSessionBash(sessionId);
    const normalizedPath = normalizeSessionFsPath(path);
    const dir = normalizedPath.slice(0, normalizedPath.lastIndexOf('/'));
    if (dir) {
      await bash.fs.mkdir(dir, { recursive: true });
    }
    await bash.fs.writeFile(normalizedPath, content, 'utf-8');
    setTerminalFsFileContentsBySession((current) => ({
      ...current,
      [sessionId]: { ...(current[sessionId] ?? {}), [normalizedPath]: content },
    }));
    handleTerminalFsPathsChanged(sessionId, bash.fs.getAllPaths());
  }, [getOrCreateSessionBash, handleTerminalFsPathsChanged]);

  const getSettingsFilesFromMcp = useCallback(async (): Promise<WorkspaceMcpSettingsFile[]> => {
    const workspaceSettings = settingsSnapshotsFromWorkspaceFiles(activeWorkspaceFiles).map((file): WorkspaceMcpSettingsFile => ({
      scope: file.scope,
      path: file.path,
      content: file.content,
      updatedAt: file.updatedAt,
    }));
    const sessionSettings = await Promise.all(activeWorkspaceSessions.map(async (session): Promise<WorkspaceMcpSettingsFile> => {
      const cachedContent = terminalFsFileContentsBySession[session.id]?.[SESSION_WORKSPACE_SETTINGS_PATH];
      if (cachedContent !== undefined) {
        return {
          scope: 'session',
          label: `<session> ${session.name}`,
          sessionId: session.id,
          path: SESSION_WORKSPACE_SETTINGS_PATH,
          content: cachedContent,
        };
      }

      try {
        const file = await readSessionFsFileFromMcp({
          sessionId: session.id,
          path: SESSION_WORKSPACE_SETTINGS_PATH,
        });
        return {
          scope: 'session',
          label: `<session> ${session.name}`,
          sessionId: session.id,
          path: file.path,
          content: file.content,
        };
      } catch {
        return {
          scope: 'session',
          label: `<session> ${session.name}`,
          sessionId: session.id,
          path: SESSION_WORKSPACE_SETTINGS_PATH,
          content: DEFAULT_SETTINGS_JSON,
        };
      }
    }));

    return [...workspaceSettings, ...sessionSettings];
  }, [activeWorkspaceFiles, activeWorkspaceSessions, readSessionFsFileFromMcp, terminalFsFileContentsBySession]);

  const writeSettingsFileFromMcp = useCallback(async (input: WorkspaceMcpSettingsFile): Promise<WorkspaceMcpSettingsFile> => {
    if (input.scope === 'session') {
      if (!input.sessionId) {
        throw new TypeError('Session settings writes require a sessionId.');
      }
      await writeSessionFsFileFromMcp({
        sessionId: input.sessionId,
        path: SESSION_WORKSPACE_SETTINGS_PATH,
        content: input.content,
      });
      return {
        scope: 'session',
        label: input.label,
        sessionId: input.sessionId,
        path: SESSION_WORKSPACE_SETTINGS_PATH,
        content: input.content,
        updatedAt: new Date().toISOString(),
      };
    }

    const path = input.scope === 'global' ? USER_SETTINGS_PATH : PROJECT_SETTINGS_PATH;
    const file = await writeWorkspaceFileFromMcp({ path, content: input.content });
    return {
      scope: input.scope,
      label: input.label,
      path: file.path,
      content: file.content,
      updatedAt: file.updatedAt,
    };
  }, [writeSessionFsFileFromMcp, writeWorkspaceFileFromMcp]);

  const deleteSessionFsEntryFromMcp = useCallback(async ({ sessionId, path }: { sessionId: string; path: string }) => {
    const bash = getOrCreateSessionBash(sessionId);
    const normalizedPath = normalizeSessionFsPath(path);
    await bash.exec(`rm -rf ${quoteShellArg(normalizedPath)}`);
    setTerminalFsFileContentsBySession((current) => {
      if (!current[sessionId]) return current;
      const updated = { ...current[sessionId] };
      for (const key of Object.keys(updated)) {
        if (key === normalizedPath || key.startsWith(`${normalizedPath}/`)) {
          delete updated[key];
        }
      }
      return { ...current, [sessionId]: updated };
    });
    handleTerminalFsPathsChanged(sessionId, bash.fs.getAllPaths());
  }, [getOrCreateSessionBash, handleTerminalFsPathsChanged]);

  const renameSessionFsEntryFromMcp = useCallback(async ({
    sessionId,
    path,
    newPath,
  }: {
    sessionId: string;
    path: string;
    newPath: string;
  }) => {
    const bash = getOrCreateSessionBash(sessionId);
    const normalizedPath = normalizeSessionFsPath(path);
    const normalizedNewPath = normalizeSessionFsPath(newPath);
    await bash.exec(`mv ${quoteShellArg(normalizedPath)} ${quoteShellArg(normalizedNewPath)}`);
    setTerminalFsFileContentsBySession((current) => {
      if (!current[sessionId]) return current;
      const existing = current[sessionId];
      if (!(normalizedPath in existing)) return current;
      const { [normalizedPath]: movedContent, ...rest } = existing;
      return { ...current, [sessionId]: { ...rest, [normalizedNewPath]: movedContent } };
    });
    handleTerminalFsPathsChanged(sessionId, bash.fs.getAllPaths());
  }, [getOrCreateSessionBash, handleTerminalFsPathsChanged]);

  const scaffoldSessionFsEntryFromMcp = useCallback(async ({
    sessionId,
    basePath,
    template,
  }: {
    sessionId: string;
    basePath: string;
    template: 'hook';
  }) => {
    const nextTemplate = makeAgentHook(basePath);
    const bash = getOrCreateSessionBash(sessionId);
    const dir = nextTemplate.path.slice(0, nextTemplate.path.lastIndexOf('/'));
    if (dir) {
      await bash.fs.mkdir(dir, { recursive: true });
    }
    await bash.fs.writeFile(nextTemplate.path, nextTemplate.content, 'utf-8');
    handleTerminalFsPathsChanged(sessionId, bash.fs.getAllPaths());
    return { sessionId, path: nextTemplate.path, template };
  }, [getOrCreateSessionBash, handleTerminalFsPathsChanged]);

  const getFilesystemHistoryTargetFromMcp = useCallback((input: {
    targetType: 'workspace-file' | 'session-drive' | 'session-fs-entry';
    path?: string;
    sessionId?: string;
  }) => {
    const labelFromPath = (value?: string) => value?.split('/').filter(Boolean).at(-1) ?? value ?? '/';

    if (input.targetType === 'session-drive') {
      const drive = activeSessionDrives.find((entry) => entry.sessionId === input.sessionId);
      if (!drive) {
        throw new DOMException(`Session drive "${input.sessionId}" is not available in ${activeWorkspace.name}.`, 'NotFoundError');
      }
      return {
        key: `files-history:session-drive:${drive.sessionId}`,
        kind: 'drive' as const,
        label: drive.label,
        content: drive.label,
      };
    }

    if (input.targetType === 'session-fs-entry') {
      const entry = activeSessionFsEntries.find((candidate) => candidate.sessionId === input.sessionId && candidate.path === input.path);
      return {
        key: `files-history:session-fs-entry:${input.sessionId}:${input.path ?? ''}`,
        kind: entry?.kind ?? 'file',
        label: labelFromPath(input.path),
        content: typeof entry?.content === 'string' ? entry.content : input.path ?? labelFromPath(input.path),
      };
    }

    const path = input.path ?? '';
    if (path.startsWith('//')) {
      return {
        key: `files-history:workspace-file:${path}`,
        kind: 'drive' as const,
        label: path,
        content: path,
      };
    }

    const file = activeWorkspaceFiles.find((candidate) => candidate.path === path);
    if (file) {
      return {
        key: `files-history:workspace-file:${path}`,
        kind: 'file' as const,
        label: labelFromPath(path),
        content: file.content,
      };
    }

    const hasDescendants = activeWorkspaceFiles.some((candidate) => candidate.path.startsWith(`${path}/`));
    if (!hasDescendants) {
      throw new DOMException(`Workspace filesystem path "${path}" is not available in ${activeWorkspace.name}.`, 'NotFoundError');
    }

    return {
      key: `files-history:workspace-file:${path}`,
      kind: 'folder' as const,
      label: labelFromPath(path),
      content: path,
    };
  }, [activeSessionDrives, activeSessionFsEntries, activeWorkspace.name, activeWorkspaceFiles]);

  const toFilesystemHistoryResultFromMcp = useCallback((input: {
    targetType: 'workspace-file' | 'session-drive' | 'session-fs-entry';
    path?: string;
    sessionId?: string;
  }, dag: VersionDAG, rolledBackToId?: string) => {
    const target = getFilesystemHistoryTargetFromMcp(input);
    return {
      targetType: input.targetType,
      ...(input.path ? { path: input.path } : {}),
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      kind: target.kind,
      label: target.label,
      ...(rolledBackToId ? { rolledBackToId } : {}),
      records: getTopologicalOrder(dag)
        .slice()
        .reverse()
        .map((commit) => ({
          id: commit.id,
          label: commit.message,
          timestamp: commit.timestamp,
          isCurrent: commit.id === dag.currentCommitId,
          canRollback: true,
          detail: dag.branches[commit.branchId]?.name ?? commit.branchId,
        })),
    };
  }, [getFilesystemHistoryTargetFromMcp]);

  const getFilesystemHistoryFromMcp = useCallback((input: {
    targetType: 'workspace-file' | 'session-drive' | 'session-fs-entry';
    path?: string;
    sessionId?: string;
  }) => {
    const target = getFilesystemHistoryTargetFromMcp(input);
    const existing = versionHistories[target.key];
    const dag = existing ?? createVersionDAG(target.content, 'user-1', `Initial state of ${target.label}`, Date.now());
    if (!existing) {
      setVersionHistories((prev) => prev[target.key] ? prev : { ...prev, [target.key]: dag });
    }
    return toFilesystemHistoryResultFromMcp(input, dag);
  }, [getFilesystemHistoryTargetFromMcp, toFilesystemHistoryResultFromMcp, versionHistories]);

  const rollbackFilesystemHistoryFromMcp = useCallback(async (input: {
    targetType: 'workspace-file' | 'session-drive' | 'session-fs-entry';
    path?: string;
    sessionId?: string;
    recordId: string;
  }) => {
    const target = getFilesystemHistoryTargetFromMcp(input);
    const currentDag = versionHistories[target.key] ?? createVersionDAG(target.content, 'user-1', `Initial state of ${target.label}`, Date.now());
    const nextDag = rollbackToCommit(currentDag, input.recordId, 'user-1', Date.now());
    setVersionHistories((prev) => ({ ...prev, [target.key]: nextDag }));
    return toFilesystemHistoryResultFromMcp(input, nextDag, input.recordId);
  }, [getFilesystemHistoryTargetFromMcp, toFilesystemHistoryResultFromMcp, versionHistories]);

  const getSessionStateFromMcp = useCallback((sessionId: string): WorkspaceMcpSessionState | null => {
    const summary = activeWorkspaceSessions.find((session) => session.id === sessionId);
    const controller = sessionMcpControllersRef.current[sessionId];
    if (!summary || !controller) {
      return null;
    }
    const runtime = controller.getRuntimeState();
    return {
      id: summary.id,
      name: summary.name,
      isOpen: summary.isOpen,
      ...runtime,
    };
  }, [activeWorkspaceSessions]);

  const getSessionToolsFromMcp = useCallback(() => [
    ...DEFAULT_TOOL_DESCRIPTORS,
    ...workspaceWebMcpBridge.getDescriptors(),
  ], [workspaceWebMcpBridge]);

  const writeSessionFromMcp = useCallback(async (input: WorkspaceMcpWriteSessionInput) => {
    const summary = activeWorkspaceSessions.find((session) => session.id === input.sessionId);
    if (!summary) {
      throw new DOMException(`Session "${input.sessionId}" is not available in ${activeWorkspace.name}.`, 'NotFoundError');
    }

    if (typeof input.name === 'string' && input.name.trim()) {
      renameSessionNodeById(input.sessionId, input.name, false);
    }

    const hasRuntimeMutation = Boolean(
      (typeof input.message === 'string' && input.message.trim())
      || (typeof input.provider === 'string' && input.provider.trim())
      || (typeof input.modelId === 'string' && input.modelId.trim())
      || (typeof input.agentId === 'string' && input.agentId.trim())
      || Array.isArray(input.toolIds)
      || input.mode
      || (typeof input.cwd === 'string' && input.cwd.trim()),
    );
    if (!hasRuntimeMutation) {
      return undefined;
    }

    const controller = sessionMcpControllersRef.current[input.sessionId];
    if (!controller) {
      throw new DOMException(`Session "${summary.name}" is not open. Open it first before changing runtime controls.`, 'NotFoundError');
    }

    await controller.writeSession(input);
    return undefined;
  }, [activeWorkspace.name, activeWorkspaceSessions, renameSessionNodeById]);

  const startReviewFollowUp = useCallback((prompt: string) => {
    const sessionId = activeSessionIds[0] ?? addSessionToWorkspace(activeWorkspaceId, 'Review follow-up')?.id;
    if (!sessionId) {
      setToast({ msg: 'Create a session before starting review follow-up', type: 'error' });
      return;
    }
    setPendingReviewFollowUp({ sessionId, prompt });
    switchSidebarPanel('workspaces');
    setToast({ msg: 'Review follow-up queued in the active session', type: 'info' });
  }, [activeSessionIds, activeWorkspaceId, addSessionToWorkspace, setToast, switchSidebarPanel]);

  useEffect(() => {
    if (!pendingReviewFollowUp) return;
    if (!sessionMcpControllersRef.current[pendingReviewFollowUp.sessionId]) return;

    const nextFollowUp = pendingReviewFollowUp;
    setPendingReviewFollowUp(null);
    void writeSessionFromMcp({
      sessionId: nextFollowUp.sessionId,
      message: nextFollowUp.prompt,
      mode: 'agent',
    }).catch((error) => {
      setToast({
        msg: error instanceof Error ? error.message : 'Failed to start review follow-up',
        type: 'error',
      });
    });
  }, [pendingReviewFollowUp, setToast, writeSessionFromMcp]);

  const closeRenderPaneFromMcp = useCallback(async (paneId: string) => {
    if (paneId === `dashboard:${activeWorkspaceId}`) {
      setWorkspaceViewStateByWorkspace((current) => {
        const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
        return {
          ...current,
          [activeWorkspaceId]: {
            ...existing,
            dashboardOpen: false,
            panelOrder: existing.panelOrder.filter((id) => id !== paneId),
          },
        };
      });
      return { paneId, closed: true };
    }
    if (paneId.startsWith('browser:')) {
      const pageId = paneId.slice('browser:'.length);
      readBrowserPageFromWorkspace(pageId);
      handleRemoveFileNode(pageId);
      return { paneId, closed: true };
    }
    if (paneId.startsWith('session:')) {
      await closeSessionFromMcp(paneId.slice('session:'.length));
      return { paneId, closed: true };
    }
    if (paneId.startsWith('file:')) {
      const path = paneId.slice('file:'.length);
      setWorkspaceViewStateByWorkspace((current) => {
        const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
        return {
          ...current,
          [activeWorkspaceId]: {
            ...existing,
            editingFilePath: existing.editingFilePath === path ? null : existing.editingFilePath,
            panelOrder: existing.panelOrder.filter((id) => id !== paneId),
          },
        };
      });
      return { paneId, closed: true };
    }
    if (paneId.startsWith('artifact:')) {
      closeActiveArtifactPanel();
      return { paneId, closed: true };
    }

    throw new DOMException(`Render pane "${paneId}" is not available in ${activeWorkspace.name}.`, 'NotFoundError');
  }, [activeWorkspace, activeWorkspaceId, closeActiveArtifactPanel, closeSessionFromMcp, handleRemoveFileNode, readBrowserPageFromWorkspace]);

  const moveRenderPaneFromMcp = useCallback(async ({ paneId, toIndex }: { paneId: string; toIndex: number }) => {
    let nextOrder = activeRenderPanes.map((pane) => pane.id);
    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
      nextOrder = moveRenderPaneOrder(activeRenderPanes, existing.panelOrder, paneId, toIndex);
      return {
        ...current,
        [activeWorkspaceId]: {
          ...existing,
          panelOrder: nextOrder,
        },
      };
    });
    return nextOrder;
  }, [activeRenderPanes, activeWorkspace, activeWorkspaceId]);

  const mountSessionDriveFromMcp = useCallback(async (sessionId: string) => {
    const drive = activeSessionDrives.find((entry) => entry.sessionId === sessionId);
    if (!drive) {
      throw new DOMException(`Session drive "${sessionId}" is not available in ${activeWorkspace.name}.`, 'NotFoundError');
    }

    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
      if (existing.mountedSessionFsIds.includes(sessionId)) {
        return current;
      }
      return {
        ...current,
        [activeWorkspaceId]: {
          ...existing,
          mountedSessionFsIds: [...existing.mountedSessionFsIds, sessionId],
        },
      };
    });
    return { ...drive, mounted: true };
  }, [activeSessionDrives, activeWorkspace, activeWorkspaceId]);

  const unmountSessionDriveFromMcp = useCallback(async (sessionId: string) => {
    const drive = activeSessionDrives.find((entry) => entry.sessionId === sessionId);
    if (!drive) {
      throw new DOMException(`Session drive "${sessionId}" is not available in ${activeWorkspace.name}.`, 'NotFoundError');
    }

    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
      if (!existing.mountedSessionFsIds.includes(sessionId)) {
        return current;
      }
      return {
        ...current,
        [activeWorkspaceId]: {
          ...existing,
          mountedSessionFsIds: existing.mountedSessionFsIds.filter((id) => id !== sessionId),
        },
      };
    });
    return { ...drive, mounted: false };
  }, [activeSessionDrives, activeWorkspace, activeWorkspaceId]);

  const restoreClipboardEntryFromMcp = useCallback(async (entryId: string) => {
    const entry = clipboardHistory.find((candidate) => candidate.id === entryId);
    if (!entry) {
      throw new DOMException(`Clipboard entry "${entryId}" is not available in ${activeWorkspace.name}.`, 'NotFoundError');
    }

    await handleClipboardRollback(entry);
    return {
      id: entry.id,
      label: entry.label,
      text: entry.text,
      timestamp: entry.timestamp,
      isActive: true,
    };
  }, [activeWorkspace.name, clipboardHistory]);

  const getWorktreeRenderPaneStateFromMcp = useCallback(({
    itemId,
    itemType,
  }: {
    itemId: string;
    itemType: WorkspaceMcpWorktreeItem['itemType'];
  }) => {
    const item = findActiveWorktreeItem(itemId, itemType);
    return item ? readWorktreeRenderPaneState(item, activeWorkspaceViewState) : null;
  }, [activeWorkspaceViewState, findActiveWorktreeItem]);

  const toggleWorktreeRenderPaneFromMcp = useCallback(async ({
    itemId,
    itemType,
  }: {
    itemId: string;
    itemType: WorkspaceMcpWorktreeItem['itemType'];
  }) => {
    const item = findActiveWorktreeItem(itemId, itemType);
    if (!item) {
      throw new DOMException(`Worktree item "${itemType}:${itemId}" is not available.`, 'NotFoundError');
    }

    let nextState = readWorktreeRenderPaneState(item, activeWorkspaceViewState);
    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
      const toggled = toggleWorktreeRenderPaneState(item, existing);
      nextState = toggled.state;
      return workspaceViewStateEquals(existing, toggled.nextViewState)
        ? current
        : { ...current, [activeWorkspaceId]: toggled.nextViewState };
    });

    return nextState;
  }, [activeWorkspace, activeWorkspaceId, activeWorkspaceViewState, findActiveWorktreeItem]);

  const getWorktreeContextMenuStateFromMcp = useCallback(({
    itemId,
    itemType,
  }: {
    itemId: string;
    itemType: WorkspaceMcpWorktreeItem['itemType'];
  }) => {
    const item = findActiveWorktreeItem(itemId, itemType);
    return item ? readWorktreeContextMenuState(
      { itemId, itemType },
      isWorktreeContextMenuState(contextMenu) ? contextMenu : null,
    ) : null;
  }, [contextMenu, findActiveWorktreeItem]);

  const toggleWorktreeContextMenuFromMcp = useCallback(async ({
    itemId,
    itemType,
  }: {
    itemId: string;
    itemType: WorkspaceMcpWorktreeItem['itemType'];
  }) => {
    const item = findActiveWorktreeItem(itemId, itemType);
    if (!item) {
      throw new DOMException(`Worktree item "${itemType}:${itemId}" is not available.`, 'NotFoundError');
    }

    const currentState = readWorktreeContextMenuState(
      { itemId, itemType },
      isWorktreeContextMenuState(contextMenu) ? contextMenu : null,
    );
    if (currentState.isOpen) {
      setContextMenu(null);
      return { ...currentState, isOpen: false };
    }

    const node = findNode(activeWorkspace, itemId) ?? findNode(root, itemId);
    if (!node) {
      throw new DOMException(`Worktree item "${itemType}:${itemId}" is not available.`, 'NotFoundError');
    }

    openContextMenuForNode(24, 24, node);
    return { itemId, itemType, isOpen: true, supported: true };
  }, [activeWorkspace, contextMenu, findActiveWorktreeItem, root]);

  const getWorktreeContextActionsForItem = useCallback(({
    itemId,
    itemType,
  }: {
    itemId: string;
    itemType: WorkspaceMcpWorktreeItem['itemType'];
  }): readonly WorkspaceMcpContextAction[] => {
    const node = findNode(activeWorkspace, itemId) ?? findNode(root, itemId);
    if (!node && itemType !== 'session-fs-entry') {
      return [];
    }

    switch (itemType) {
      case 'browser-page':
        return [
          { id: 'toggle_bookmark', label: node?.persisted ? 'Remove Bookmark' : 'Bookmark' },
          { id: 'toggle_mute', label: node?.muted ? 'Unmute' : 'Mute' },
          { id: 'copy_uri', label: 'Copy URI' },
          { id: 'close', label: 'Close' },
          { id: 'history', label: 'History' },
          { id: 'properties', label: 'Properties' },
        ];
      case 'session':
        return [
          { id: 'share', label: 'Share' },
          { id: 'rename', label: 'Rename' },
          { id: 'remove', label: 'Remove' },
          { id: 'history', label: 'History' },
          { id: 'properties', label: 'Properties' },
        ];
      case 'workspace-file':
        return [
          { id: 'move', label: 'Move' },
          { id: 'symlink', label: 'Symlink' },
          { id: 'duplicate', label: 'Duplicate' },
          { id: 'remove', label: 'Remove' },
          { id: 'history', label: 'History' },
          { id: 'properties', label: 'Properties' },
        ];
      case 'artifact':
      case 'artifact-file':
        return [
          { id: 'open', label: 'Open' },
          { id: 'download', label: 'Download' },
          { id: 'attach', label: 'Attach' },
          { id: 'new_session', label: 'New Session' },
          { id: 'history', label: 'History' },
          { id: 'properties', label: 'Properties' },
        ];
      case 'session-fs-entry': {
        const vfsArgs = parseVfsNodeId(itemId);
        if (!vfsArgs) {
          return [];
        }
        return [
          ...(!vfsArgs.isDriveRoot ? [{ id: 'rename', label: 'Rename' }, { id: 'delete', label: 'Delete' }] : []),
          { id: 'new_file', label: 'Add File' },
          { id: 'new_folder', label: 'Add Folder' },
          { id: 'add_hook', label: 'Add hook' },
          { id: 'history', label: 'History' },
          { id: 'properties', label: 'Properties' },
        ];
      }
      case 'clipboard':
        return [
          { id: 'history', label: 'History' },
          { id: 'properties', label: 'Properties' },
        ];
      default:
        return [];
    }
  }, [activeWorkspace, root]);

  const invokeWorktreeContextActionFromMcp = useCallback(async ({
    itemId,
    itemType,
    actionId,
    args,
  }: {
    itemId: string;
    itemType: WorkspaceMcpWorktreeItem['itemType'];
    actionId: string;
    args: Record<string, unknown>;
  }) => {
    const node = findNode(activeWorkspace, itemId) ?? findNode(root, itemId);

    if (itemType === 'browser-page' && node) {
      if (actionId === 'toggle_bookmark') {
        handleBookmarkTab(itemId);
      } else if (actionId === 'toggle_mute') {
        handleMuteTab(itemId);
      } else if (actionId === 'copy_uri') {
        await handleCopyUri(node);
      } else if (actionId === 'close') {
        handleRemoveFileNode(itemId);
      } else if (actionId === 'history') {
        setHistoryNode(node);
      } else if (actionId === 'properties') {
        setPropertiesNode(node);
      }
      return { itemId, itemType, actionId, ok: true };
    }

    if (itemType === 'session' && node) {
      if (actionId === 'share') {
        await handleShareSession(node);
      } else if (actionId === 'rename') {
        const nextName = typeof args.name === 'string' ? args.name : typeof args.newName === 'string' ? args.newName : '';
        if (!nextName.trim()) {
          throw new TypeError('Session rename requires a name argument.');
        }
        renameSessionNodeById(itemId, nextName, true);
      } else if (actionId === 'remove') {
        handleRemoveFileNode(itemId);
      } else if (actionId === 'history') {
        setHistoryNode(node);
      } else if (actionId === 'properties') {
        setPropertiesNode(node);
      }
      return { itemId, itemType, actionId, ok: true };
    }

    if (itemType === 'workspace-file' && node) {
      if (actionId === 'move') {
        const targetDir = typeof args.targetDir === 'string' ? args.targetDir : '';
        handleFileMove(node, targetDir);
      } else if (actionId === 'symlink') {
        const targetDir = typeof args.targetDir === 'string' ? args.targetDir : '';
        handleFileSymlink(node, targetDir);
      } else if (actionId === 'duplicate') {
        const targetDir = typeof args.targetDir === 'string' ? args.targetDir : '';
        handleFileDuplicate(node, targetDir);
      } else if (actionId === 'remove') {
        handleRemoveFileNode(itemId);
      } else if (actionId === 'history') {
        setHistoryNode(node);
      } else if (actionId === 'properties') {
        setPropertiesNode(node);
      }
      return { itemId, itemType, actionId, ok: true };
    }

    if ((itemType === 'artifact' || itemType === 'artifact-file') && node) {
      const artifactId = node.artifactReferenceId ?? node.artifactId;
      if (!artifactId) {
        throw new DOMException(`Artifact item "${itemId}" is not available.`, 'NotFoundError');
      }
      if (actionId === 'open') {
        openArtifactPanel(artifactId, node.artifactFilePath ?? null, findWorkspaceForNode(root, node.id)?.id ?? activeWorkspaceId);
      } else if (actionId === 'download') {
        downloadArtifact(artifactId);
      } else if (actionId === 'attach') {
        attachArtifactToSession(artifactId);
      } else if (actionId === 'new_session') {
        openSessionWithArtifact(artifactId);
      } else if (actionId === 'history') {
        setHistoryNode(node);
      } else if (actionId === 'properties') {
        setPropertiesNode(node);
      }
      return { itemId, itemType, actionId, ok: true };
    }

    if (itemType === 'session-fs-entry') {
      const vfsArgs = parseVfsNodeId(itemId);
      if (!vfsArgs) {
        throw new DOMException(`Session filesystem entry "${itemId}" is not available.`, 'NotFoundError');
      }
      if (actionId === 'rename') {
        const nextName = typeof args.name === 'string' ? args.name : typeof args.newName === 'string' ? args.newName : '';
        if (!nextName.trim()) {
          throw new TypeError('Session filesystem rename requires a name argument.');
        }
        await renameSessionFsEntryFromMcp({
          sessionId: vfsArgs.sessionId,
          path: vfsArgs.basePath,
          newPath: `${vfsArgs.basePath.slice(0, vfsArgs.basePath.lastIndexOf('/'))}/${nextName.trim()}`,
        });
      } else if (actionId === 'delete') {
        await deleteSessionFsEntryFromMcp({ sessionId: vfsArgs.sessionId, path: vfsArgs.basePath });
      } else if (actionId === 'new_file' || actionId === 'new_folder') {
        const entryName = typeof args.name === 'string' ? args.name.trim() : '';
        if (!entryName) {
          throw new TypeError('Creating a session filesystem entry requires a name argument.');
        }
        await createSessionFsEntryFromMcp({
          sessionId: vfsArgs.sessionId,
          path: `${vfsArgs.basePath.replace(/\/$/, '')}/${entryName}`,
          kind: actionId === 'new_folder' ? 'folder' : 'file',
          ...(typeof args.content === 'string' ? { content: args.content } : {}),
        });
      } else if (actionId === 'add_hook') {
        await scaffoldSessionFsEntryFromMcp({ sessionId: vfsArgs.sessionId, basePath: vfsArgs.basePath, template: 'hook' });
      } else if (actionId === 'history' && node) {
        setHistoryNode(node);
      } else if (actionId === 'properties' && node) {
        setPropertiesNode(node);
      }
      return { itemId, itemType, actionId, ok: true };
    }

    if (itemType === 'clipboard' && node) {
      if (actionId === 'history') {
        setHistoryNode(node);
      } else if (actionId === 'properties') {
        setPropertiesNode(node);
      }
      return { itemId, itemType, actionId, ok: true };
    }

    throw new DOMException(`Worktree item "${itemType}:${itemId}" is not available.`, 'NotFoundError');
  }, [
    activeWorkspace,
    activeWorkspaceId,
    attachArtifactToSession,
    createSessionFsEntryFromMcp,
    deleteSessionFsEntryFromMcp,
    downloadArtifact,
    handleBookmarkTab,
    handleCopyUri,
    handleFileDuplicate,
    handleFileMove,
    handleFileSymlink,
    handleMuteTab,
    handleRemoveFileNode,
    handleShareSession,
    openArtifactPanel,
    openSessionWithArtifact,
    renameSessionFsEntryFromMcp,
    renameSessionNodeById,
    root,
    scaffoldSessionFsEntryFromMcp,
  ]);

  useEffect(() => {
    if (activeWorkspace.type !== 'workspace') {
      return undefined;
    }

    const controller = new AbortController();
    registerWorkspaceTools(webMcpModelContext, {
      workspaceName: activeWorkspace.name,
      workspaceFiles: activeWorkspaceFiles,
      artifacts: activeArtifacts,
      browserPages: activeBrowserPages,
      renderPanes: activeRenderPanes,
      harnessElements: activeHarnessElements,
      sessions: activeWorkspaceSessions,
      getSessionTools: getSessionToolsFromMcp,
      sessionDrives: activeSessionDrives,
      clipboardEntries: activeClipboardEntries,
      getSessionState: getSessionStateFromMcp,
      getBrowserPageHistory: getBrowserPageHistoryFromMcp,
      getHarnessElement: readHarnessElementFromMcp,
      getHarnessPromptContext: readHarnessPromptContextFromMcp,
      getUserContextMemory: ({ query, limit }) => searchUserContextMemory(activeWorkspace.name, query, limit),
      getBrowserLocation: () => browserLocationResultFromContext(browserLocationContext)
        ?? readBrowserLocationFromNavigator(),
      getSettingsFiles: getSettingsFilesFromMcp,
      onElicitUserInput: (input) => {
        const requestId = `elicitation-${createUniqueId()}`;
        const detail: UserElicitationEventDetail = {
          requestId,
          prompt: input.prompt,
          reason: input.reason,
          fields: [...input.fields],
        };
        window.dispatchEvent(new CustomEvent<UserElicitationEventDetail>(USER_ELICITATION_EVENT, { detail }));
        return {
          status: 'needs_user_input',
          requestId,
          prompt: input.prompt,
          fields: input.fields,
        };
      },
      onRequestSecret: (input) => {
        const requestId = `secret-${createUniqueId()}`;
        const name = input.name?.trim() || 'API_KEY';
        const prompt = input.prompt || `Create a secret named ${name}.`;
        const detail: SecretRequestEventDetail = {
          requestId,
          name,
          prompt,
          reason: input.reason,
        };
        const result = new Promise<SecretRequestCreatedResult>((resolve) => {
          pendingSecretRequestResolvers.set(requestId, resolve);
        });
        window.dispatchEvent(new CustomEvent<SecretRequestEventDetail>(SECRET_REQUEST_EVENT, { detail }));
        return result;
      },
      onSearchWeb: searchWebFromApi,
      onReadWebPage: readWebPageFromApi,
      sessionFsEntries: activeSessionFsEntries,
      worktreeItems: activeWorktreeItems,
      onOpenFile: openActiveWorkspaceFileFromMcp,
      onCreateBrowserPage: createBrowserPageFromMcp,
      onNavigateBrowserPage: navigateBrowserPageFromMcp,
      onNavigateBrowserPageHistory: navigateBrowserPageHistoryFromMcp,
      onRefreshBrowserPage: refreshBrowserPageFromMcp,
      onCloseRenderPane: closeRenderPaneFromMcp,
      onMoveRenderPane: moveRenderPaneFromMcp,
      onPatchHarnessElement: patchHarnessElementFromMcp,
      onRegenerateHarness: regenerateHarnessFromMcp,
      onRestoreHarness: restoreHarnessFromMcp,
      onCreateSession: createSessionFromMcp,
      onWriteSession: writeSessionFromMcp,
      onCreateWorkspaceFile: createWorkspaceFileFromMcp,
      onCreateArtifact: createArtifactFromMcp,
      onUpdateArtifact: updateArtifactFromMcp,
      onWriteWorkspaceFile: writeWorkspaceFileFromMcp,
      onWriteSettingsFile: writeSettingsFileFromMcp,
      onDeleteWorkspaceFile: deleteWorkspaceFileFromMcp,
      onMoveWorkspaceFile: moveWorkspaceFileFromMcp,
      onDuplicateWorkspaceFile: duplicateWorkspaceFileFromMcp,
      onSymlinkWorkspaceFile: symlinkWorkspaceFileFromMcp,
      onMountSessionDrive: mountSessionDriveFromMcp,
      onUnmountSessionDrive: unmountSessionDriveFromMcp,
      onCreateSessionFsEntry: createSessionFsEntryFromMcp,
      onReadSessionFsFile: readSessionFsFileFromMcp,
      onWriteSessionFsFile: writeSessionFsFileFromMcp,
      onDeleteSessionFsEntry: deleteSessionFsEntryFromMcp,
      onRenameSessionFsEntry: renameSessionFsEntryFromMcp,
      onScaffoldSessionFsEntry: scaffoldSessionFsEntryFromMcp,
      getFilesystemHistory: getFilesystemHistoryFromMcp,
      onRollbackFilesystemHistory: rollbackFilesystemHistoryFromMcp,
      getWorktreeRenderPaneState: getWorktreeRenderPaneStateFromMcp,
      onToggleWorktreeRenderPane: toggleWorktreeRenderPaneFromMcp,
      getWorktreeContextMenuState: getWorktreeContextMenuStateFromMcp,
      onToggleWorktreeContextMenu: toggleWorktreeContextMenuFromMcp,
      onRestoreClipboardEntry: restoreClipboardEntryFromMcp,
      getWorktreeContextActions: getWorktreeContextActionsForItem,
      onInvokeWorktreeContextAction: invokeWorktreeContextActionFromMcp,
      signal: controller.signal,
    });

    return () => controller.abort();
  }, [
    activeBrowserPages,
    activeSessionFsEntries,
    activeWorkspace,
    activeWorkspaceFiles,
    activeWorkspaceSessions,
    activeWorktreeItems,
    activeArtifacts,
    browserLocationContext,
    activeClipboardEntries,
    activeRenderPanes,
    activeSessionDrives,
    activeHarnessElements,
    closeSessionFromMcp,
    createBrowserPageFromMcp,
    createArtifactFromMcp,
    createSessionFromMcp,
    createSessionFsEntryFromMcp,
    createWorkspaceFileFromMcp,
    closeRenderPaneFromMcp,
    deleteSessionFsEntryFromMcp,
    deleteWorkspaceFileFromMcp,
    getSessionToolsFromMcp,
    getSessionStateFromMcp,
    getSettingsFilesFromMcp,
    getWorktreeContextMenuStateFromMcp,
    getWorktreeContextActionsForItem,
    getWorktreeRenderPaneStateFromMcp,
    invokeWorktreeContextActionFromMcp,
    duplicateWorkspaceFileFromMcp,
    getBrowserPageHistoryFromMcp,
    patchHarnessElementFromMcp,
    getFilesystemHistoryFromMcp,
    openActiveWorkspaceFileFromMcp,
    readSessionFsFileFromMcp,
    readHarnessElementFromMcp,
    readHarnessPromptContextFromMcp,
    renameSessionFsEntryFromMcp,
    regenerateHarnessFromMcp,
    rollbackFilesystemHistoryFromMcp,
    mountSessionDriveFromMcp,
    moveRenderPaneFromMcp,
    moveWorkspaceFileFromMcp,
    navigateBrowserPageFromMcp,
    navigateBrowserPageHistoryFromMcp,
    scaffoldSessionFsEntryFromMcp,
    toggleWorktreeContextMenuFromMcp,
    toggleWorktreeRenderPaneFromMcp,
    webMcpModelContext,
    refreshBrowserPageFromMcp,
    writeSessionFromMcp,
    restoreClipboardEntryFromMcp,
    restoreHarnessFromMcp,
    unmountSessionDriveFromMcp,
    updateArtifactFromMcp,
    writeSessionFsFileFromMcp,
    writeSettingsFileFromMcp,
    symlinkWorkspaceFileFromMcp,
    writeWorkspaceFileFromMcp,
  ]);

  function renderSidebar() {
    if (activePanel === 'workspaces') {
      return (
        <div key={`ws-${activeWorkspaceId}`} className={`sidebar-content ${slideDir ? `ws-slide-${slideDir}` : ''}`}>
          <MemBar root={activeWorkspace} />
          <SidebarTree
            root={root}
            workspaceByNodeId={workspaceByNodeId}
            activeWorkspaceId={activeWorkspaceId}
            openTabIds={activeWorkspaceViewState.openTabIds}
            activeSessionIds={activeWorkspaceViewState.activeSessionIds}
            editingFilePath={activeWorkspaceViewState.editingFilePath}
            activeArtifactPanel={activeWorkspaceViewState.activeArtifactPanel}
            cursorId={cursorId}
            selectedIds={selectedIds}
            items={visibleItems}
            onCursorChange={setCursorId}
            onToggleFolder={(id) => {
              setRoot((current) => deepUpdate(current, id, (node) => ({ ...node, expanded: !node.expanded })));
              const toggled = findNode(root, id);
              if (toggled?.type === 'workspace') switchWorkspace(id);
            }}
            onOpenTab={handleOpenTreeTab}
            onOpenFile={handleOpenFileNode}
            onAddFile={(wsId) => setShowAddFileMenu(wsId)}
            onAddAgent={(wsId) => addSessionToWorkspace(wsId)}
            onAddBrowserTab={(wsId) => addBrowserTabToWorkspace(wsId)}
            onNodeContextMenu={handleNodeContextMenu}
          />
        </div>
      );
    }
    if (activePanel === 'review') {
      return (
        <PullRequestReviewPanel
          report={activePrReviewReport}
          onStartFollowUp={startReviewFollowUp}
        />
      );
    }
    if (activePanel === 'history') return <HistoryPanel scheduledAutomationState={scheduledAutomationState} />;
    if (activePanel === 'extensions') return (
      <ExtensionsPanel
        workspaceName={activeWorkspace.name}
        capabilities={activeWorkspaceCapabilities}
        defaultExtensions={defaultExtensionRuntime}
        installedExtensionIds={installedDefaultExtensionIds}
      />
    );
    if (activePanel === 'models') return (
      <ModelsPanel
        copilotState={copilotState}
        isCopilotLoading={isCopilotStateLoading}
        onRefreshCopilot={() => void refreshCopilotState(true)}
        cursorState={cursorState}
        isCursorLoading={isCursorStateLoading}
        onRefreshCursor={() => void refreshCursorState(true)}
        codexState={codexState}
        isCodexLoading={isCodexStateLoading}
        onRefreshCodex={() => void refreshCodexState(true)}
        registryModels={registryModels}
        installedModels={installedModels}
        task={registryTask}
        loadingModelId={loadingModelId}
        onTaskChange={setRegistryTask}
        onSearch={setRegistryQuery}
        onInstall={installModel}
        onDelete={deleteModel}
      />
    );
    if (activePanel === 'settings') return (
      <SettingsPanel
        benchmarkRoutingSettings={benchmarkRoutingSettings}
        benchmarkRoutingCandidates={benchmarkRoutingCandidates}
        benchmarkEvidenceState={benchmarkEvidenceState}
        adversaryToolReviewSettings={adversaryToolReviewSettings}
        securityReviewAgentSettings={securityReviewAgentSettings}
        securityReviewRunPlan={settingsSecurityReviewRunPlan}
        scheduledAutomationState={scheduledAutomationState}
        partnerAgentControlPlaneSettings={partnerAgentControlPlaneSettings}
        partnerAgentControlPlane={settingsPartnerAgentControlPlane}
        latestPartnerAgentAuditEntry={latestPartnerAgentAuditEntry}
        onBenchmarkRoutingSettingsChange={setBenchmarkRoutingSettings}
        onAdversaryToolReviewSettingsChange={setAdversaryToolReviewSettings}
        onSecurityReviewAgentSettingsChange={setSecurityReviewAgentSettings}
        onScheduledAutomationStateChange={setScheduledAutomationState}
        onPartnerAgentControlPlaneSettingsChange={setPartnerAgentControlPlaneSettings}
        evaluationAgents={evaluationAgents}
        negativeRubricTechniques={negativeRubricTechniques}
        onSaveEvaluationAgents={saveEvaluationAgents}
        onResetEvaluationAgents={resetEvaluationAgents}
        onResetNegativeRubric={resetNegativeRubric}
        secretRecords={secretRecords}
        secretSettings={secretSettings}
        onSaveSecret={saveManualSecret}
        onDeleteSecret={deleteManualSecret}
        onSecretSettingsChange={updateSecretSettings}
      />
    );
    return <AccountPanel defaultExtensions={defaultExtensionRuntime} />;
  }

  return (
    <div className="app-shell" onContextMenu={handleAppContextMenu}>
      <a className="skip-link" href="#workspace-content">Skip to workspace content</a>
      <nav className="activity-bar" aria-label="Primary navigation">
        <div className="activity-group">
          {PRIMARY_NAV.map(([id, icon, label], index) => <button key={id} type="button" className={`activity-button ${activePanel === id ? 'active' : ''}`} onClick={() => { if (id === 'workspaces') { if (activePanel === 'workspaces') openWorkspaceSwitcher(); else switchSidebarPanel('workspaces'); } else { switchSidebarPanel(id as SidebarPanel); } }} aria-label={label} title={`${label} (Alt+${index + 1})`}><Icon name={icon as keyof typeof icons} size={16} color={activePanel === id ? '#7dd3fc' : '#71717a'} /></button>)}
          {installedIdeExtensions.map((extension) => (
            <button
              key={extension.manifest.id}
              type="button"
              className="activity-button activity-button-extension"
              onClick={() => switchSidebarPanel('extensions')}
              aria-label={`${extension.manifest.name} extension`}
              title={extension.manifest.name}
            >
              <Icon name={getDefaultExtensionIcon(extension)} size={16} color="#a7f3d0" />
            </button>
          ))}
        </div>
        <div className="activity-spacer" />
        <div className="activity-group">
          {SECONDARY_NAV.map(([id, icon, label], index) => <button key={id} type="button" className={`activity-button ${activePanel === id ? 'active' : ''}`} onClick={() => switchSidebarPanel(id as SidebarPanel)} aria-label={label} title={`${label} (Alt+${PRIMARY_NAV.length + index + 1})`}><Icon name={icon as keyof typeof icons} size={16} color={activePanel === id ? '#7dd3fc' : '#71717a'} /></button>)}
        </div>
        <button type="button" className="activity-button" onClick={() => setSidebarCollapsed((current) => !current, true)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><Icon name="panelRight" size={16} color="#71717a" /></button>
      </nav>
      {!collapsed ? (
        <aside className="sidebar">
          <header className="sidebar-header">
            <div className="sidebar-title-row">
              {activePanel !== 'workspaces' ? <span className="panel-eyebrow"><Icon name={activePanelMeta.icon} size={12} color="#8fa6c4" />{activePanelMeta.label}</span> : null}
            </div>
            <div className="workspace-toolbar">
              <div className="workspace-nav-row">
                <button type="button" className="icon-button" aria-label="Go back"><Icon name="arrowLeft" size={13} /></button>
                <button type="button" className="icon-button" aria-label="Go forward"><Icon name="arrowRight" size={13} /></button>
                <button type="button" className="icon-button" aria-label="Reload"><Icon name="refresh" size={13} /></button>
                <span className="workspace-nav-spacer" />
                <button type="button" className="icon-button" aria-label="New tab"><Icon name="plus" size={13} /></button>
                <button type="button" className="icon-button" aria-label="Split view"><Icon name="panelRight" size={13} /></button>
              </div>
              <form className="workspace-omnibar-form" onSubmit={handleOmnibarSubmit}>
                <label className="workspace-omnibar-shell shared-input-shell">
                  <Icon name="search" size={13} color="#6b7280" />
                  <input ref={omnibarRef} aria-label="Omnibar" value={omnibar} onChange={(event) => setOmnibar(event.target.value)} placeholder="Search or enter URL" />
                </label>
              </form>
              <div className="workspace-status-row">
                {treeFilter ? (
                  <button type="button" className="workspace-filter-chip" onClick={() => setTreeFilter('')} aria-label="Clear workspace filter">
                    <span>Filtering: {treeFilter}</span>
                    <Icon name="x" size={10} />
                  </button>
                ) : (
                  <div className="workspace-helper-text">{activeBrowserTabs.length} pages · {activeBrowserTabs.filter((tab) => tab.memoryTier !== 'cold').length} active · {activeBrowserTabs.filter((tab) => tab.persisted).length} saved</div>
                )}
                <div className="workspace-controls">
                  <button
                    type="button"
                    className="workspace-toggle-pill"
                    aria-label="Toggle workspace overlay"
                    title={activeWorkspace.name}
                    onClick={openWorkspaceSwitcher}
                    onDoubleClick={() => openRenameWorkspace(activeWorkspaceId)}
                  >
                    <Icon name="panes" size={14} color={activeWorkspace.color ?? '#9fb5d1'} />
                  </button>
                  <button type="button" className="workspace-hotkey-button" aria-label="Open keyboard shortcuts" onClick={() => setShowShortcuts(true)}>
                    <Icon name="keyboard" size={13} color="#9aa4b2" />
                  </button>
                </div>
              </div>
            </div>
          </header>
          {renderSidebar()}
      </aside>
      ) : null}
      <main id="workspace-content" className="content-area" aria-label="Workspace content" tabIndex={-1}>
        {activePanel === 'extensions' ? (
          <MarketplacePanel
            defaultExtensions={defaultExtensionRuntime}
            installedExtensionIds={installedDefaultExtensionIds}
            onInstallExtension={installDefaultExtension}
          />
        ) : (() => {
          const filePanelOnSave = (nextFile: WorkspaceFile, previousPath?: string) => {
            setWorkspaceFilesByWorkspace((current) => {
              const existing = current[activeWorkspaceId] ?? [];
              const withoutPrevious = previousPath && previousPath !== nextFile.path ? removeWorkspaceFile(existing, previousPath) : existing;
              return { ...current, [activeWorkspaceId]: upsertWorkspaceFile(withoutPrevious, nextFile) };
            });
            setWorkspaceViewStateByWorkspace((current) => ({
              ...current,
              [activeWorkspaceId]: {
                ...(current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace)),
                editingFilePath: nextFile.path,
              },
            }));
          };
          const filePanelOnDelete = (path: string) => {
            setWorkspaceFilesByWorkspace((current) => ({ ...current, [activeWorkspaceId]: removeWorkspaceFile(current[activeWorkspaceId] ?? [], path) }));
            setWorkspaceViewStateByWorkspace((current) => ({
              ...current,
              [activeWorkspaceId]: {
                ...(current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace)),
                editingFilePath: current[activeWorkspaceId]?.editingFilePath === path ? null : current[activeWorkspaceId]?.editingFilePath ?? null,
              },
            }));
          };
          const filePanelOnClose = () => setWorkspaceViewStateByWorkspace((current) => ({
            ...current,
            [activeWorkspaceId]: {
              ...(current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace)),
              editingFilePath: null,
            },
          }));
          const panelEntries: Array<[string, Panel]> = [];
          if (shouldRenderDashboard) {
            panelEntries.push([`dashboard:${activeWorkspaceId}`, { type: 'dashboard', workspaceId: activeWorkspaceId }]);
          }
          if (editingFile) {
            panelEntries.push([`file:${editingFile.path}`, { type: 'file', file: editingFile }]);
          }
          if (activeArtifactPanelArtifact) {
            panelEntries.push([
              `artifact:${activeArtifactPanelArtifact.id}:${activeArtifactPanelFile?.path ?? ''}`,
              { type: 'artifact', artifact: activeArtifactPanelArtifact, file: activeArtifactPanelFile },
            ]);
          }
          panelEntries.push(
            ...activeSessionIds.map((id): [string, Panel] => [`session:${id}`, { type: 'session', id }]),
            ...openBrowserTabs.map((tab): [string, Panel] => [`browser:${tab.id}`, { type: 'browser', tab }]),
          );
          const panelsById = new Map<string, Panel>(panelEntries);
          const allPanels: Panel[] = activeRenderPanes
            .map((pane) => panelsById.get(pane.id) ?? null)
            .filter((panel): panel is Panel => panel !== null);
          const renderPanel = (panel: Panel, dragHandleProps?: PanelDragHandleProps) => {
            if (panel.type === 'dashboard') {
              return (
                <HarnessDashboardPanel
                  key={panel.workspaceId}
                  spec={activeHarnessSpec}
                  workspaceName={activeWorkspace.name}
                  sessions={activeDashboardSessions}
                  browserPages={activeBrowserPages.map((page) => ({
                    id: page.id,
                    title: page.title,
                    url: page.url,
                  }))}
                  files={activeWorkspaceFiles.map((file) => ({
                    path: file.path,
                    kind: detectWorkspaceFileKind(file.path) ?? undefined,
                  }))}
                  onCreateSessionWidget={() => addSessionToWorkspace(activeWorkspaceId, undefined, { open: false })}
                  onOpenSession={(sessionId) => setWorkspaceViewStateByWorkspace((current) => {
                    const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
                    return {
                      ...current,
                      [activeWorkspaceId]: {
                        ...existing,
                        activeSessionIds: [...(existing.activeSessionIds ?? []).filter((id) => id !== sessionId), sessionId],
                        mountedSessionFsIds: existing.mountedSessionFsIds.includes(sessionId)
                          ? existing.mountedSessionFsIds
                          : [...existing.mountedSessionFsIds, sessionId],
                      },
                    };
                  })}
                  onPatchElement={patchActiveHarnessElement}
                  onRegenerate={regenerateActiveHarnessSpec}
                  onRestoreDefault={restoreActiveHarnessSpec}
                  dragHandleProps={dragHandleProps}
                />
              );
            }
            if (panel.type === 'file') {
              return (
                <FileEditorPanel
                  key={panel.file.path}
                  file={panel.file}
                  onSave={filePanelOnSave}
                  onDelete={filePanelOnDelete}
                  onClose={filePanelOnClose}
                  onToast={setToast}
                  dragHandleProps={dragHandleProps}
                />
              );
            }
            if (panel.type === 'browser') {
              return (
                <PageOverlay
                  key={panel.tab.id}
                  tab={panel.tab}
                  dragHandleProps={dragHandleProps}
                  onContextMenu={(x, y) => openContextMenuForNode(x, y, panel.tab)}
                  onClose={() => setWorkspaceViewStateByWorkspace((current) => ({
                    ...current,
                    [activeWorkspaceId]: {
                      ...(current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace)),
                      openTabIds: (current[activeWorkspaceId]?.openTabIds ?? []).filter((id) => id !== panel.tab.id),
                    },
                  }))}
                />
              );
            }
            if (panel.type === 'artifact') {
              return (
                <ArtifactViewerPanel
                  key={`${panel.artifact.id}:${panel.file?.path ?? ''}`}
                  artifact={panel.artifact}
                  file={panel.file}
                  onSelectFile={(filePath) => openArtifactPanel(panel.artifact.id, filePath)}
                  onDownload={() => downloadArtifact(panel.artifact.id)}
                  onAttach={() => attachArtifactToSession(panel.artifact.id)}
                  onOpenSession={() => openSessionWithArtifact(panel.artifact.id)}
                  onClose={closeActiveArtifactPanel}
                  dragHandleProps={dragHandleProps}
                />
              );
            }
            return (
              <ChatPanel
                key={panel.id}
                installedModels={installedModels}
                copilotState={copilotState}
                cursorState={cursorState}
                codexState={codexState}
                pendingSearch={pendingSearch}
                onSearchConsumed={() => setPendingSearch(null)}
                onToast={setToast}
                workspaceName={activeWorkspace.name}
                workspaceFiles={activeWorkspaceFiles}
                sessionSettingsContent={terminalFsFileContentsBySession[panel.id]?.[SESSION_WORKSPACE_SETTINGS_PATH] ?? null}
                artifactPromptContext={buildArtifactPromptContext(activeArtifacts, artifactContextBySession[panel.id] ?? [])}
                attachedArtifactCount={(artifactContextBySession[panel.id] ?? []).length}
                workspaceCapabilities={activeWorkspaceCapabilities}
                defaultExtensions={defaultExtensionRuntime}
                evaluationAgents={evaluationAgents}
                negativeRubricTechniques={negativeRubricTechniques}
                onNegativeRubricTechnique={addNegativeRubricTechnique}
                activeSessionId={panel.id}
                activeMode={activeSessionMode}
                onSwitchMode={(mode) => switchSessionMode(activeWorkspaceId, mode)}
                onNewSession={() => addSessionToWorkspace(activeWorkspaceId)}
                onClose={() => setWorkspaceViewStateByWorkspace((current) => {
                  const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
                  return {
                    ...current,
                    [activeWorkspaceId]: {
                      ...existing,
                      activeSessionIds: (existing.activeSessionIds ?? []).filter((id) => id !== panel.id),
                    },
                  };
                })}
                onTerminalFsPathsChanged={handleTerminalFsPathsChanged}
                onOpenModels={() => switchSidebarPanel('models')}
                onWorkspaceFileUpsert={(nextFile) => setWorkspaceFilesByWorkspace((current) => ({
                  ...current,
                  [activeWorkspaceId]: upsertWorkspaceFile(current[activeWorkspaceId] ?? [], nextFile),
                }))}
                onCopyToClipboard={writeToClipboard}
                onSecretRecordsChanged={refreshSecretRecords}
                bashBySessionRef={bashBySessionRef}
                webMcpModelContext={webMcpModelContext}
                browserLocationContext={browserLocationContext}
                setBrowserLocationContext={setBrowserLocationContext}
                benchmarkRoutingSettings={benchmarkRoutingSettings}
                benchmarkRoutingCandidates={benchmarkRoutingCandidates}
                adversaryToolReviewSettings={adversaryToolReviewSettings}
                securityReviewAgentSettings={securityReviewAgentSettings}
                partnerAgentControlPlaneSettings={partnerAgentControlPlaneSettings}
                onPartnerAgentAuditEntry={setLatestPartnerAgentAuditEntry}
                secretSettings={secretSettings}
                onSessionMcpControllerChange={handleSessionMcpControllerChange}
                onSessionRuntimeChange={handleSessionRuntimeChange}
                dragHandleProps={dragHandleProps}
              />
            );
          };
          if (!allPanels.length) {
            return <ClosedPanelsPlaceholder workspaceName={activeWorkspace.name} onNewSession={() => addSessionToWorkspace(activeWorkspaceId)} />;
          }
          if (allPanels.length > 1) {
            return (
              <PanelSplitView
                panels={allPanels}
                renderPanel={renderPanel}
                onOrderChange={(paneIds) => setWorkspaceViewStateByWorkspace((current) => {
                  const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
                  return {
                    ...current,
                    [activeWorkspaceId]: {
                      ...existing,
                      panelOrder: paneIds,
                    },
                  };
                })}
              />
            );
          }
          return renderPanel(allPanels[0]);
        })()}
      </main>
      {showAddFileMenu ? <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add file"><div className="modal-card compact"><div className="modal-header"><h2>Add file</h2><button type="button" className="icon-button" onClick={() => setShowAddFileMenu(null)}><Icon name="x" /></button></div><div className="add-file-form"><label className="file-editor-field"><span>Name (optional)</span><input aria-label="Capability name" value={addFileName} onChange={(event) => setAddFileName(event.target.value)} placeholder="e.g. review-pr" /></label><div className="add-file-buttons"><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('tool', showAddFileMenu)}>Tool</button><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('plugin', showAddFileMenu)}>Plugin</button><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('hook', showAddFileMenu)}>Hook</button><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('memory', showAddFileMenu)}>Memory</button></div></div></div></div> : null}
      {addSessionFsMenu ? <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add to session filesystem"><div className="modal-card compact"><div className="modal-header"><h2>Add to {addSessionFsMenu.basePath}</h2><button type="button" className="icon-button" onClick={() => { setAddSessionFsMenu(null); setAddSessionFsName(''); }}><Icon name="x" /></button></div><div className="add-file-form"><label className="file-editor-field"><span>Name</span><input aria-label="Entry name" value={addSessionFsName} onChange={(event) => setAddSessionFsName(event.target.value)} placeholder="e.g. notes.md" autoFocus onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void handleAddToSessionFs(addSessionFsMenu.sessionId, addSessionFsMenu.basePath, addSessionFsMenu.kind === 'folder'); } if (event.key === 'Escape') { setAddSessionFsMenu(null); setAddSessionFsName(''); } }} /></label><div className="add-file-buttons">{addSessionFsMenu.kind === 'file' ? <button type="button" className="secondary-button" onClick={() => void handleAddToSessionFs(addSessionFsMenu.sessionId, addSessionFsMenu.basePath, false)}>Create file</button> : addSessionFsMenu.kind === 'folder' ? <button type="button" className="secondary-button" onClick={() => void handleAddToSessionFs(addSessionFsMenu.sessionId, addSessionFsMenu.basePath, true)}>Create folder</button> : <><button type="button" className="secondary-button" onClick={() => void handleAddToSessionFs(addSessionFsMenu.sessionId, addSessionFsMenu.basePath, false)}>File</button><button type="button" className="secondary-button" onClick={() => void handleAddToSessionFs(addSessionFsMenu.sessionId, addSessionFsMenu.basePath, true)}>Folder</button></>}</div></div></div></div> : null}
      {showWorkspaces ? <WorkspaceSwitcherOverlay workspaces={root.children ?? []} activeWorkspaceId={activeWorkspaceId} onSwitch={switchWorkspace} onCreateWorkspace={createWorkspace} onRenameWorkspace={openRenameWorkspace} onClose={() => setShowWorkspaces(false)} /> : null}
      {showShortcuts ? <ShortcutOverlay onClose={() => setShowShortcuts(false)} /> : null}
      {renamingWorkspaceId ? <RenameWorkspaceOverlay value={workspaceDraftName} onChange={setWorkspaceDraftName} onSave={saveWorkspaceRename} onClose={() => setRenamingWorkspaceId(null)} /> : null}
      {renameSessionFsMenu ? <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Rename"><div className="modal-card compact"><div className="modal-header"><h2>Rename</h2><button type="button" className="icon-button" onClick={() => { setRenameSessionFsMenu(null); setRenameSessionFsName(''); }}><Icon name="x" /></button></div><div className="add-file-form"><label className="file-editor-field"><span>New name</span><input aria-label="New name" value={renameSessionFsName} onChange={(event) => setRenameSessionFsName(event.target.value)} autoFocus onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void handleRenameSessionFsNode(renameSessionFsMenu.sessionId, renameSessionFsMenu.path, renameSessionFsName); } if (event.key === 'Escape') { setRenameSessionFsMenu(null); setRenameSessionFsName(''); } }} /></label><div className="add-file-buttons"><button type="button" className="secondary-button" onClick={() => void handleRenameSessionFsNode(renameSessionFsMenu.sessionId, renameSessionFsMenu.path, renameSessionFsName)}>Rename</button></div></div></div></div> : null}
      {renamingSessionNodeId ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Rename session">
          <div className="modal-card compact">
            <div className="modal-header">
              <h2>Rename session</h2>
              <button type="button" className="icon-button" onClick={() => { setRenamingSessionNodeId(null); setSessionRenameDraft(''); }}><Icon name="x" /></button>
            </div>
            <div className="add-file-form">
              <label className="file-editor-field">
                <span>Name</span>
                <input aria-label="Session name" value={sessionRenameDraft} onChange={(e) => setSessionRenameDraft(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRenameSessionNode(sessionRenameDraft); } if (e.key === 'Escape') { setRenamingSessionNodeId(null); setSessionRenameDraft(''); } }} />
              </label>
              <div className="add-file-buttons">
                <button type="button" className="secondary-button" onClick={() => handleRenameSessionNode(sessionRenameDraft)}>Rename</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {contextMenu ? <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} entries={contextMenu.entries} topButtons={contextMenu.topButtons} /> : null}

      {/* ── Properties modal ── */}
      {propertiesNode ? (
        <PropertiesModal
          nodeName={propertiesNode.name}
          metadata={buildNodeMetadata(propertiesNode)}
          onClose={() => setPropertiesNode(null)}
        />
      ) : null}

      {/* ── History modals ── */}
      {historyNode && historyNode.nodeKind === 'browser' ? (
        <BrowserHistoryModal
          navHistory={browserNavHistories[historyNode.id] ?? { entries: [{ url: historyNode.url ?? '', title: historyNode.name, timestamp: Date.now() }], currentIndex: 0 }}
          onBack={() => handleBrowserBack(historyNode.id)}
          onForward={() => handleBrowserForward(historyNode.id)}
          onClose={() => setHistoryNode(null)}
        />
      ) : null}

      {historyNode && historyNode.nodeKind === 'session' ? (() => {
        const currentDag = versionHistories[historyNode.id] ?? createVersionDAG('(initial)', 'user-1', 'Initial snapshot', Date.now());
        return (
          <VersionHistoryModal
            dag={currentDag}
            dialogLabel="Session history"
            rowActions={(commitId) => (
              <button type="button" className="secondary-button btn-xs" onClick={() => {
                const branchName = `branch/${new Date().toISOString().slice(0, 10)}`;
                updateVersionHistory(historyNode.id, branchDAG(currentDag, branchName, commitId, Date.now()));
              }} aria-label="Branch from here">
                Branch from here
              </button>
            )}
            onClose={() => setHistoryNode(null)}
          />
        );
      })() : null}

      {historyNode && historyNode.nodeKind === 'clipboard' ? (
        <ClipboardHistoryModal
          history={clipboardHistory}
          onRollback={(entry) => void handleClipboardRollback(entry)}
          onClose={() => setHistoryNode(null)}
        />
      ) : null}

      {historyNode && (historyNode.id.startsWith('vfs:') || (historyNode.type !== 'tab')) && historyNode.nodeKind !== 'browser' && historyNode.nodeKind !== 'session' && historyNode.nodeKind !== 'clipboard' ? (() => {
        const currentDag = versionHistories[historyNode.id] ?? createVersionDAG('(initial)', 'user-1', `Initial state of ${historyNode.name}`, Date.now());
        return (
          <VersionHistoryModal
            dag={currentDag}
            dialogLabel="Version history"
            rowActions={(commitId) => (
              <button type="button" className="secondary-button btn-xs" onClick={() => {
                updateVersionHistory(historyNode.id, rollbackToCommit(currentDag, commitId, 'user-1', Date.now()));
              }} aria-label={`Roll back to ${commitId}`}>
                Roll back
              </button>
            )}
            onClose={() => setHistoryNode(null)}
          />
        );
      })() : null}

      {fileOpModal ? (() => {
        const ownerWs = findWorkspaceForNode(root, fileOpModal.node.id);
        const wsFiles = ownerWs ? (workspaceFilesByWorkspace[ownerWs.id] ?? []) : [];
        const dirs = collectWorkspaceDirectories(wsFiles);
        return (
          <FileOpModal
            op={fileOpModal.op}
            directories={dirs}
            onConfirm={(targetDir) => handleFileOp(fileOpModal.node, fileOpModal.op, targetDir)}
            onClose={() => setFileOpModal(null)}
          />
        );
      })() : null}

      {newTabWorkspaceId ? (
        <NewTabModal
          onConfirm={(url) => confirmNewBrowserTab(newTabWorkspaceId, url)}
          onClose={() => setNewTabWorkspaceId(null)}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}

async function searchWebFromApi({ query, limit }: { query: string; limit: number }) {
  try {
    const response = await fetch('/api/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
    });
    if (!response.ok) {
      return {
        status: 'unavailable' as const,
        query,
        reason: `Web search returned ${response.status}.`,
        results: [],
      };
    }
    const result = await response.json();
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      return {
        status: 'unavailable' as const,
        query,
        reason: 'Web search returned an invalid response.',
        results: [],
      };
    }
    return result;
  } catch (error) {
    return {
      status: 'unavailable' as const,
      query,
      reason: error instanceof Error ? error.message : 'Web search is unavailable.',
      results: [],
    };
  }
}

async function readWebPageFromApi({ url }: { url: string }) {
  try {
    const response = await fetch('/api/web-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      return {
        status: 'unavailable' as const,
        url,
        reason: `Web page read returned ${response.status}.`,
        links: [],
        jsonLd: [],
        entities: [],
        observations: [],
      };
    }
    const result = await response.json();
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      return {
        status: 'unavailable' as const,
        url,
        reason: 'Web page read returned an invalid response.',
        links: [],
        jsonLd: [],
        entities: [],
        observations: [],
      };
    }
    return result;
  } catch (error) {
    return {
      status: 'unavailable' as const,
      url,
      reason: error instanceof Error ? error.message : 'Web page reading is unavailable.',
      links: [],
      jsonLd: [],
      entities: [],
      observations: [],
    };
  }
}

export default function App() {
  return <AgentBrowserApp />;
}
