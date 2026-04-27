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
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkMinus,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Copy,
  Cpu,
  File,
  Folder,
  FolderInput,
  FolderOpen,
  Globe,
  HardDrive,
  History,
  Keyboard,
  Layers3,
  Link,
  LoaderCircle,
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
  buildResearcherToolInstructions,
  hasCodiModels,
  hasGhcpAccess,
  resolveAgentModelIds,
  resolveRuntimeAgentProvider,
  streamAgentChat,
  type AgentProvider,
} from './chat-agents';
import { formatToolArgs, summarizeToolCall, summarizeToolResult } from './chat-agents/toolCallSummary';
import { useCopilotReadable } from './services/copilotRuntimeBridge';
import { executeCliCommand } from './tools/cli/exec';
import { COPILOT_RUNTIME_ENABLED } from './config';
import { getSandboxFeatureFlags } from './features/flags';
import { formatOperationDuration } from './features/operation-pane';
// Unified per-turn process visualization surfaced via InlineProcess and
// ProcessPanel below.
import { MarkdownContent } from './utils/MarkdownContent';
import { getFaviconBadgeLabel, normalizeHostname } from './utils/favicon';
import { fetchCopilotState, type CopilotModelSummary, type CopilotRuntimeState } from './services/copilotApi';
import { getModelCapabilities, resolveLanguageModel } from './services/agentProvider';
import { LocalLanguageModel } from './services/localLanguageModel';
import { runParallelDelegationWorkflow, shouldRunParallelDelegation } from './services/parallelDelegationWorkflow';
import { runStagedToolPipeline, type StageMeta } from './services/stagedToolPipeline';
import { ProcessLog, type ProcessEntry, type ProcessEntryKind } from './services/processLog';
import { InlineProcess, ProcessPanel } from './features/process';
import {
  createWebMcpToolBridge,
  registerWorkspaceTools,
  type WorkspaceMcpBrowserPageHistory,
  type WorkspaceMcpBrowserPage,
  type WorkspaceMcpClipboardEntry,
  type WorkspaceMcpContextAction,
  type WorkspaceMcpRenderPane,
  type WorkspaceMcpSessionDrive,
  type WorkspaceMcpSessionFsEntry,
  type WorkspaceMcpSessionState,
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
import { buildMountedTerminalDriveNodes, buildWorkspaceCapabilityDriveNodes } from './services/virtualFilesystemTree';
import {
  STORAGE_KEYS,
  isChatMessagesBySession,
  isString,
  isStringArrayRecord,
  isStringRecord,
  isTreeNode,
  isWorkspaceViewStateRecord,
  removeStoredRecordEntry,
  useStoredState,
} from './services/sessionState';
import { collectWorkspaceDirectories } from './services/workspaceDirectories';
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
import { createUniqueId } from './utils/uniqueId';
import { DEFAULT_TOOL_DESCRIPTORS, buildDefaultToolInstructions, createDefaultTools, selectToolDescriptorsByIds, selectToolsByIds, type ToolDescriptor } from './tools';
import type { BrowserNavHistory, BusEntryStep, ChatMessage, HFModel, HistorySession, Identity, IdentityPermissions, NodeMetadata, ReasoningStep, TreeNode, VoterStep, WorkspaceCapabilities, WorkspaceFile, WorkspaceFileKind } from './types';
import type { CliHistoryEntry } from './tools/types';
import { installModelContext, ModelContext } from 'webmcp';

type ToastState = { msg: string; type: 'info' | 'success' | 'error' | 'warning' } | null;
type ClipboardEntry = { id: string; text: string; label: string; timestamp: number };
type SidebarPanel = 'workspaces' | 'history' | 'extensions' | 'settings' | 'account';
type BrowserPanel = { type: 'browser'; tab: TreeNode };
type SessionPanel = { type: 'session'; id: string };
type FilePanel = { type: 'file'; file: WorkspaceFile };
type Panel = BrowserPanel | SessionPanel | FilePanel;
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

const NEW_TAB_NAME_LENGTH = 32;
const DEFAULT_NEW_TAB_MEMORY_MB = 96;
const PANEL_MIN_WIDTH_PX = 320;
const PANEL_MIN_HEIGHT_PX = 240;
const INITIAL_WORKSPACE_IDS = ['ws-research', 'ws-build'] as const;
const PRIMARY_NAV = [
  ['workspaces', 'layers', 'Workspaces'],
  ['history', 'clock', 'History'],
  ['extensions', 'puzzle', 'Extensions'],
] as const;
const SECONDARY_NAV = [
  ['settings', 'settings', 'Settings'],
  ['account', 'user', 'Account'],
] as const;
const PANEL_SHORTCUT_ORDER: SidebarPanel[] = ['workspaces', 'history', 'extensions', 'settings', 'account'];
const SIDEBAR_PANEL_META: Record<SidebarPanel, { label: string; icon: keyof typeof icons }> = {
  workspaces: { label: 'Workspaces', icon: 'layers' },
  history: { label: 'History', icon: 'clock' },
  extensions: { label: 'Extensions', icon: 'puzzle' },
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
      { keys: 'Alt+1-5', description: 'Switch sidebar panel' },
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
  'browser-worktree-mcp',
  'sessions-worktree-mcp',
  'files-worktree-mcp',
  'clipboard-worktree-mcp',
] as const;
const DEFAULT_COLLAPSED_TOOL_GROUPS = new Set<string>(['mcp', 'webmcp']);

const icons = {
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
  folder: Folder,
  folderOpen: FolderOpen,
  hardDrive: HardDrive,
  file: File,
  link: Link,
  x: X,
  send: SendHorizontal,
  loader: LoaderCircle,
  globe: Globe,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  refresh: RefreshCcw,
  save: Save,
  sparkles: Sparkles,
  plus: Plus,
  cpu: Cpu,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  terminal: Terminal,
  trash: Trash2,
  clipboard: Clipboard,
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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
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

function ChatMessageView({
  message,
  agentName,
  activitySelected,
  onOpenActivity,
  onCopyMessage,
}: {
  message: ChatMessage;
  agentName: string;
  activitySelected?: boolean;
  onOpenActivity?: (messageId: string) => void;
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
  const isStreaming = message.status === 'streaming';
  const isError = message.isError ?? message.status === 'error';
  const isStopped = message.statusText === 'stopped';
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
      {!(allReasoningSteps.length) && (message.cards ?? []).map((card, i) => (
        <div key={i} className="message-tool-call">
          <span className="tool-call-label">⚙ {card.app}</span>
          <pre className="tool-call-args">{JSON.stringify(card.args, null, 2)}</pre>
        </div>
      ))}
      {content ? (
        (isUser || isTerminalMessage || isError)
          ? <div className={`message-bubble${isTerminalMessage ? ' terminal-bubble' : ''}${isError ? ' message-bubble-error' : ''}`}>{content}{isStreaming && !message.isThinking && <span className="stream-cursor" />}</div>
          : <div className={`message-bubble message-bubble-markdown${isError ? ' message-bubble-error' : ''}`}><MarkdownContent content={content} className="markdown-content" />{isStreaming && !message.isThinking && <span className="stream-cursor" />}</div>
      ) : null}
    </div>
  );
}

function PageOverlay({ tab, onClose, dragHandleProps }: { tab: TreeNode; onClose: () => void; dragHandleProps?: PanelDragHandleProps }) {
  const src = tab.url ?? '';
  return (
    <section className="page-overlay" aria-label="Page overlay">
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

function ChatPanel({
  installedModels,
  copilotState,
  pendingSearch,
  onSearchConsumed,
  onToast,
  workspaceName,
  workspaceFiles,
  workspaceCapabilities,
  activeSessionId,
  activeMode,
  onSwitchMode,
  onNewSession,
  onClose,
  onTerminalFsPathsChanged,
  onOpenSettings,
  onWorkspaceFileUpsert,
  onCopyToClipboard,
  bashBySessionRef,
  webMcpModelContext,
  onSessionMcpControllerChange,
  dragHandleProps,
}: {
  installedModels: HFModel[];
  copilotState: CopilotRuntimeState;
  pendingSearch: string | null;
  onSearchConsumed: () => void;
  onToast: (toast: Exclude<ToastState, null>) => void;
  workspaceName: string;
  workspaceFiles: WorkspaceFile[];
  workspaceCapabilities: WorkspaceCapabilities;
  activeSessionId: string | null;
  activeMode: 'agent' | 'terminal';
  onSwitchMode: (mode: 'agent' | 'terminal') => void;
  onNewSession: () => void;
  onClose: () => void;
  onTerminalFsPathsChanged: (sessionId: string, paths: string[]) => void;
  onOpenSettings: () => void;
  onWorkspaceFileUpsert: (file: WorkspaceFile) => void;
  onCopyToClipboard: (text: string, label: string) => Promise<void>;
  bashBySessionRef: React.MutableRefObject<Record<string, Bash>>;
  webMcpModelContext: ModelContext;
  onSessionMcpControllerChange?: (sessionId: string, controller: SessionMcpController | null) => void;
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
  const [selectedAgentIdBySession, setSelectedAgentIdBySession] = useState<Record<string, string | null>>({});
  const [selectedToolIdsBySession, setSelectedToolIdsBySession] = useState<Record<string, string[]>>({});
  const [webMcpToolVersion, setWebMcpToolVersion] = useState(0);
  const [bashHistoryBySession, setBashHistoryBySession] = useState<Record<string, BashEntry[]>>({});
  const [historyCursorByScope, setHistoryCursorByScope] = useState<Record<string, number>>({});
  const [selectedSkillSuggestionIndex, setSelectedSkillSuggestionIndex] = useState(0);
  const [cwdBySession, setCwdBySession] = useState<Record<string, string>>({});
  const [activeGenerationSessionId, setActiveGenerationSessionId] = useState<string | null>(null);
  const [activeActivityBySession, setActiveActivityBySession] = useState<Record<string, ActivitySelection | null>>({});
  const [pendingMcpMessage, setPendingMcpMessage] = useState<string | null>(null);
  const showBash = activeMode === 'terminal';
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const terminalInputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const consumedPendingSearchRef = useRef<string | null>(null);
  const activeGenerationRef = useRef<{
    assistantId: string;
    sessionId: string;
    cancel: () => void;
    finalizeCancelled: () => void;
  } | null>(null);
  const webMcpBridge = useMemo(() => createWebMcpToolBridge(webMcpModelContext), [webMcpModelContext]);
  const sandboxFlags = getSandboxFeatureFlags();
  const activeChatSessionId = activeSessionId ?? 'session:fallback';
  const availableAgentIds = useMemo(() => workspaceCapabilities.agents.map((file) => file.path), [workspaceCapabilities.agents]);
  const selectedAgentIdState = selectedAgentIdBySession[activeChatSessionId] ?? null;
  const selectedAgentId = selectedAgentIdState && availableAgentIds.includes(selectedAgentIdState)
    ? selectedAgentIdState
    : (availableAgentIds[0] ?? null);
  const workspacePromptContext = useMemo(
    () => buildWorkspacePromptContext(workspaceFiles, selectedAgentId),
    [selectedAgentId, workspaceFiles],
  );
  const messages = messagesBySession[activeChatSessionId] ?? [createSystemChatMessage(activeChatSessionId)];
  const selectedProvider = selectedProviderBySession[activeChatSessionId] ?? getDefaultAgentProvider({ installedModels, copilotState });
  const selectedModelId = selectedModelBySession[activeChatSessionId] ?? '';
  const selectedCopilotModelId = selectedCopilotModelBySession[activeChatSessionId] ?? '';
  const { codiModelId: effectiveSelectedModelId, ghcpModelId: effectiveSelectedCopilotModelId } = resolveAgentModelIds({
    installedModels,
    selectedCodiModelId: selectedModelId,
    copilotModels: copilotState.models,
    selectedGhcpModelId: selectedCopilotModelId,
  });
  const activeLocalModel = installedModels.find((model) => model.id === effectiveSelectedModelId);
  const activeCopilotModel = copilotState.models.find((model) => model.id === effectiveSelectedCopilotModelId);
  const hasInstalledModels = hasCodiModels(installedModels);
  const hasAvailableCopilotModels = hasGhcpAccess(copilotState);
  const selectedRuntimeProvider = resolveRuntimeAgentProvider({
    provider: selectedProvider,
    hasCodiModelsReady: Boolean(activeLocalModel),
    hasGhcpModelsReady: Boolean(effectiveSelectedCopilotModelId) && hasAvailableCopilotModels,
  });
  const hasActiveGeneration = activeGenerationSessionId !== null;
  const isActiveSessionGenerating = activeGenerationSessionId === activeChatSessionId;
  const toolDescriptors = useMemo(
    () => [...DEFAULT_TOOL_DESCRIPTORS, ...webMcpBridge.getDescriptors()],
    [webMcpBridge, webMcpToolVersion],
  );
  const selectedToolIds = selectedToolIdsBySession[activeChatSessionId] ?? toolDescriptors.map((descriptor) => descriptor.id);
  const toolsEnabled = selectedToolIds.length > 0;
  const setSelectedToolIdsForActiveSession = useCallback((ids: string[]) => {
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
    || (selectedProvider === 'codi' && Boolean(effectiveSelectedModelId))
    || (selectedProvider === 'ghcp' && Boolean(effectiveSelectedCopilotModelId) && hasAvailableCopilotModels)
    || ((selectedProvider === 'researcher' || selectedProvider === 'debugger') && (
      (Boolean(effectiveSelectedCopilotModelId) && hasAvailableCopilotModels)
      || Boolean(activeLocalModel)
    ))
  );
  const providerSummary = getAgentProviderSummary({ provider: selectedProvider, installedModels, copilotState });
  const contextSummary = `${providerSummary} · tools ${toolsEnabled ? `${selectedToolIds.length} selected` : 'off'} · ${workspaceCapabilities.agents.length} AGENTS.md · ${workspaceCapabilities.skills.length} skills · ${workspaceCapabilities.plugins.length} plugins · ${workspaceCapabilities.hooks.length} hooks · ${pendingSearch ? 'web search queued' : 'workspace ready'}`;
  const workspacePath = showBash && activeSessionId ? (cwdBySession[activeSessionId] ?? BASH_INITIAL_CWD) : BASH_INITIAL_CWD;
  const selectedProviderRef = useRef(selectedProvider);
  const effectiveSelectedModelIdRef = useRef(effectiveSelectedModelId);
  const effectiveSelectedCopilotModelIdRef = useRef(effectiveSelectedCopilotModelId);
  const selectedAgentIdRef = useRef<string | null>(selectedAgentId);
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
    selectedAgentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
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
      bashSessions[id] = new Bash({ cwd: BASH_INITIAL_CWD, files: { [`${BASH_INITIAL_CWD}/${BASH_CWD_PLACEHOLDER_FILE}`]: '' } });
    }
    return bashSessions[id];
  }, []);

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
    setMessagesBySession((current) => ({
      ...current,
      [activeChatSessionId]: (current[activeChatSessionId] ?? [createSystemChatMessage(activeChatSessionId)]).map((message) => message.id === id ? { ...message, ...patch } : message),
    }));
  }

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
  }, [activeSessionId, getSessionBash, onTerminalFsPathsChanged, sandboxFlags, updateMessage]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || activeGenerationRef.current) return;
    const assistantId = createUniqueId();
    const userId = createUniqueId();
    const trimmedText = text.trim();
    const providerForRequest = resolveAgentProviderForTask({
      selectedProvider,
      latestUserInput: trimmedText,
    });
    const runtimeProviderForRequest = resolveRuntimeAgentProvider({
      provider: providerForRequest,
      hasCodiModelsReady: Boolean(activeLocalModel),
      hasGhcpModelsReady: Boolean(effectiveSelectedCopilotModelId) && hasAvailableCopilotModels,
    });
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
    setInput('');
    resetActiveInputHistoryCursor();

    if (await runSandboxPrompt(text, assistantId)) {
      return;
    }

    if (runtimeProviderForRequest === 'ghcp' && (!effectiveSelectedCopilotModelId || !hasAvailableCopilotModels)) {
      updateMessage(assistantId, {
        status: 'error',
        content: copilotState.authenticated
          ? 'GHCP has no enabled models for this environment. Open Models to refresh or switch to Codi.'
          : 'Sign in to GHCP from Models before sending a prompt.',
      });
      return;
    }

    if (runtimeProviderForRequest === 'codi' && !activeLocalModel) {
      updateMessage(assistantId, { status: 'error', content: providerForRequest === 'researcher' ? 'Researcher needs a GHCP model or a browser-compatible Codi model before sending a prompt.' : providerForRequest === 'debugger' ? 'Debugger needs a GHCP model or a browser-compatible Codi model before sending a prompt.' : 'Install a browser-compatible ONNX model for Codi from Models before sending a prompt.' });
      return;
    }

    if (toolsEnabled) {
      if (!activeSessionId) {
        updateMessage(assistantId, { status: 'error', content: 'Open or create a session before enabling tools.' });
        return;
      }

      const controller = new AbortController();
      type PlanningStageName = 'router' | 'group-select' | 'tool-select' | 'executor' | 'chat' | 'coordinator' | 'breakdown-agent' | 'assignment-agent' | 'validation-agent' | 'voter-ensemble' | 'agent-bus';
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
          providerForRequest === 'researcher' ? 'Planning research run' : providerForRequest === 'debugger' ? 'Planning debugging run' : 'Planning tool run',
          providerForRequest === 'researcher' ? 'Researcher is deciding how to use local tools and gather evidence.' : providerForRequest === 'debugger' ? 'Debugger is deciding how to inspect symptoms, hypotheses, and evidence.' : 'Codi is deciding how to use local tools and delegate work.',
        )]
        : [];
      let delegationVoterSteps: VoterStep[] = [];
      let delegationBusEntries: BusEntryStep[] = [];
      const processLog = new ProcessLog();
      const processBranchByStage = new Map<PlanningStageName, string>();
      const processIdByStage = new Map<PlanningStageName, string>();
      const processIdByVoterStepId = new Map<string, string>();
      const processIdByToolCallId = new Map<string, string>();
      const resolveProcessBranch = (stage: PlanningStageName): string => {
        const cached = processBranchByStage.get(stage);
        if (cached) return cached;
        // Parallel subagents get their own colored rail; everything else
        // collapses onto the coordinator/root branch.
        const branch = (
          stage === 'breakdown-agent' || stage === 'assignment-agent' || stage === 'validation-agent'
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
      let lastBusProcessId: string | undefined;
      const toolStepIdsByCallId = new Map<string, string>();
      const planningStepIdsByStage = new Map<PlanningStageName, string>();
      const planningTokensByStage = new Map<PlanningStageName, string>();
      const currentToolAgentLogMeta = (): Pick<ProcessEntry, 'agentId' | 'agentLabel' | 'modelId' | 'modelProvider'> => ({
        agentId: providerForRequest === 'researcher' ? 'researcher' : providerForRequest === 'debugger' ? 'debugger' : 'tool-agent',
        agentLabel: providerForRequest === 'researcher' ? 'Researcher' : providerForRequest === 'debugger' ? 'Debugger' : 'Tool Agent',
        modelId: runtimeProviderForRequest === 'ghcp' ? effectiveSelectedCopilotModelId : effectiveSelectedModelId,
        modelProvider: providerForRequest,
      });
      const processMetaFromStageMeta = (meta?: StageMeta): Pick<ProcessEntry, 'agentId' | 'agentLabel' | 'modelId' | 'modelProvider'> => ({
        agentId: meta?.agentId ?? currentToolAgentLogMeta().agentId,
        agentLabel: meta?.agentLabel ?? currentToolAgentLogMeta().agentLabel,
        modelId: meta?.modelId ?? currentToolAgentLogMeta().modelId,
        modelProvider: meta?.modelProvider ?? currentToolAgentLogMeta().modelProvider,
      });
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
        router: {},
        'group-select': { parentStage: 'router' },
        'tool-select': { parentStage: 'group-select' },
        executor: { parentStage: 'tool-select' },
        chat: { parentStage: 'router' },
        coordinator: {},
        'breakdown-agent': { parentStage: 'coordinator', lane: 'parallel' },
        'assignment-agent': { parentStage: 'coordinator', lane: 'parallel' },
        'validation-agent': { parentStage: 'coordinator', lane: 'parallel' },
        'voter-ensemble': { parentStage: 'coordinator' },
        'agent-bus': { parentStage: 'coordinator' },
      };
      const planningMirrorStages = new Set<PlanningStageName>(['voter-ensemble', 'agent-bus']);
      const planningStageTimeouts: Record<PlanningStageName, PlanningStageTimeouts> = {
        router: {
          hardMs: LOCAL_TOOL_HARD_TIMEOUT_MS,
          thinkingIdleMs: LOCAL_TOOL_THINKING_IDLE_TIMEOUT_MS,
          streamingIdleMs: LOCAL_TOOL_STREAMING_IDLE_TIMEOUT_MS,
        },
        'group-select': { hardMs: 180_000, thinkingIdleMs: 135_000, streamingIdleMs: 120_000 },
        'tool-select': { hardMs: 210_000, thinkingIdleMs: 150_000, streamingIdleMs: 135_000 },
        executor: { hardMs: 240_000, thinkingIdleMs: 180_000, streamingIdleMs: 150_000 },
        chat: { hardMs: 240_000, thinkingIdleMs: 180_000, streamingIdleMs: 150_000 },
        coordinator: { hardMs: 240_000, thinkingIdleMs: 180_000, streamingIdleMs: 150_000 },
        'breakdown-agent': { hardMs: 240_000, thinkingIdleMs: 180_000, streamingIdleMs: 150_000 },
        'assignment-agent': { hardMs: 210_000, thinkingIdleMs: 150_000, streamingIdleMs: 120_000 },
        'validation-agent': { hardMs: 210_000, thinkingIdleMs: 150_000, streamingIdleMs: 120_000 },
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
        entry.payloadType === 'Mail' ? `mail:${entry.actor ?? 'unknown'}` : 'bus'
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
        const parentProcessId = lastBusProcessId ?? fallbackParentId;
        processLog.append({
          id: entry.id,
          kind: kindMap[entry.payloadType] ?? 'reasoning',
          actor: entry.actor ? entry.actor : 'bus',
          summary: entry.summary,
          transcript: entry.detail,
          payload: entry,
          branchId: resolveBusBranch(entry),
          ...currentToolAgentLogMeta(),
          ...(parentProcessId ? { parentId: parentProcessId } : {}),
          status: 'done',
          ts: entry.realtimeTs,
        });
        lastBusProcessId = entry.id;
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

        // Mirror to ProcessLog
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
        } else {
          const newId = `stage:${stage}:${createUniqueId()}`;
          processIdByStage.set(stage, newId);
          processLog.append({
            id: newId,
            kind: stage === 'voter-ensemble' || stage === 'agent-bus' ? 'reasoning' : 'stage-start',
            actor: stage,
            summary: metadata.title,
            transcript,
            branchId: branch,
            ...processMetaFromStageMeta(stageMeta),
            ...(parentProcessId ? { parentId: parentProcessId } : {}),
            status: 'active',
            timeoutMs: resolvePlanningStageDisplayTimeoutMs(stage, timeoutReason),
          });
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
        const parentProcessId = processIdByStage.get(stage);
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
          ? { kind: 'copilot' as const, modelId: effectiveSelectedCopilotModelId, sessionId: activeChatSessionId }
          : { kind: 'local' as const, modelId: activeLocalModel!.id, task: activeLocalModel!.task };
        const model = runtimeProviderForRequest === 'ghcp'
          ? resolveLanguageModel(modelConfig)
          : new LocalLanguageModel(
              activeLocalModel!.id,
              activeLocalModel!.task,
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
            ) as unknown as ReturnType<typeof resolveLanguageModel>;
        const capabilities = getModelCapabilities(modelConfig, {
          installedModels,
          copilotModels: copilotState.models,
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
            workspacePromptContext,
            descriptors: selectedDescriptors,
            selectedToolIds,
          })
          : providerForRequest === 'debugger'
            ? buildDebuggerToolInstructions({
              workspaceName,
              workspacePromptContext,
              descriptors: selectedDescriptors,
              selectedToolIds,
            })
          : buildDefaultToolInstructions({ workspaceName, workspacePromptContext, selectedToolIds });
        const inputMessages = nextMessages
          .filter((message) => message.id !== assistantId)
          .map((message) => ({ role: message.role, content: message.streamedContent || message.content }));

        try {
          const sharedCallbacks = {
            onDone: (finalText: string) => {
              clearLocalToolWatchdogs();
              if (localToolRunTimedOut) return;
              const finalizedVoters = finalizeVoterSteps(delegationVoterSteps);
              delegationVoterSteps = finalizedVoters;
              if (finalizedVoters.length) {
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
            },
            onError: (error: Error) => {
              clearLocalToolWatchdogs();
              if (localToolRunTimedOut) return;
              const finalizedVoters = finalizeVoterSteps(delegationVoterSteps);
              delegationVoterSteps = finalizedVoters;
              if (finalizedVoters.length) {
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
            await runParallelDelegationWorkflow({
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
              onVoterStep: (step) => {
                noteLocalToolMirrorOutput('streaming');
                delegationVoterSteps = upsertVoterStep(delegationVoterSteps, step);
                syncPlanningStage('voter-ensemble', buildDelegationVoterStageBody(delegationVoterSteps), 'active');
                const pId = `vote:${step.id}`;
                processIdByVoterStepId.set(step.id, pId);
                const parentProcessId = processIdByStage.get('voter-ensemble')
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
                syncPlanningStage('agent-bus', buildDelegationBusStageBody([...delegationBusEntries]), 'active');
                appendBusProcessEntry(
                  entry,
                  processIdByStage.get('agent-bus') ?? processIdByStage.get('coordinator'),
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
          } else {
            await runStagedToolPipeline({
              model,
              tools,
              toolDescriptors: selectedDescriptors,
              instructions: toolInstructions,
              messages: inputMessages,
              workspaceName,
              capabilities,
              signal: controller.signal,
              onGeneratedTool: (file) => onWorkspaceFileUpsert({
                path: file.path,
                content: file.source,
                updatedAt: new Date().toISOString(),
              }),
            }, {
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
                noteLocalToolPlanningOutput(activePlanningStage, 'streaming');
                const pId = `vote:${step.id}`;
                processIdByVoterStepId.set(step.id, pId);
                const parentProcessId = (activePlanningStage && processIdByStage.get(activePlanningStage))
                  ?? processIdByStage.get('executor')
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
                noteLocalToolPlanningOutput(activePlanningStage, 'streaming');
                const pId = processIdByVoterStepId.get(id);
                if (pId) {
                  const verdict = patch.approve === true ? '✓' : patch.approve === false ? '✗' : '·';
                  processLog.update(pId, {
                    summary: `${patch.voterId ?? id} ${verdict}`,
                    transcript: patch.thought ?? patch.body ?? undefined,
                    payload: patch,
                    status: patch.status ?? 'active',
                  });
                  updateMessage(assistantId, { processEntries: snapshotProcess() });
                }
              },
              onVoterStepEnd: (id) => {
                const pId = processIdByVoterStepId.get(id);
                if (pId) {
                  processLog.update(pId, { status: 'done' });
                  updateMessage(assistantId, { processEntries: snapshotProcess() });
                }
              },
              onBusEntry: (entry) => {
                noteLocalToolPlanningOutput(activePlanningStage, 'streaming');
                const parentProcessId = (activePlanningStage && processIdByStage.get(activePlanningStage))
                  ?? processIdByStage.get('executor');
                appendBusProcessEntry(entry, parentProcessId);
                updateMessage(assistantId, { processEntries: snapshotProcess() });
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
                const parentProcessId = lastBusProcessId ?? processIdByStage.get('executor');
                processLog.append({
                  id: `turn:${turnId}`,
                  kind: 'inf-in',
                  actor: 'executor',
                  summary: `Model turn ${stepIndex + 1}`,
                  branchId: 'executor',
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
        providerForRequest === 'researcher' ? 'Analyzing research request' : providerForRequest === 'debugger' ? 'Analyzing debugging request' : 'Analyzing request',
        providerForRequest === 'researcher' ? 'Researcher is reviewing the research question and workspace context locally.' : providerForRequest === 'debugger' ? 'Debugger is reviewing the symptom, impact, and available evidence locally.' : 'Codi is reviewing the prompt and workspace context locally.',
      )]
      : [];
    let voterSteps: VoterStep[] = [];
    let hasStructuredReasoning = false;
    let phaseStepId: string | null = reasoningSteps[0]?.id ?? null;
    let phaseStepTitle: string | null = reasoningSteps[0]?.title ?? null;
    const processLog = new ProcessLog();
    const processIdByReasoningStepId = new Map<string, string>();
    const processIdByVoterStepId = new Map<string, string>();
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
            title: providerForRequest === 'researcher' ? 'Analyzing research request' : providerForRequest === 'debugger' ? 'Analyzing debugging request' : 'Analyzing request',
            body: providerForRequest === 'researcher' ? 'Researcher is reviewing the research question and workspace context locally.' : providerForRequest === 'debugger' ? 'Debugger is reviewing the symptom, impact, and available evidence locally.' : 'Codi is reviewing the prompt and workspace context locally.',
          };
        case 'generating':
          return {
            title: providerForRequest === 'researcher' ? 'Drafting research response' : providerForRequest === 'debugger' ? 'Drafting debugging response' : 'Drafting response',
            body: providerForRequest === 'researcher' ? 'Researcher is composing the local evidence-backed response.' : providerForRequest === 'debugger' ? 'Debugger is composing the diagnosis, mitigation, and verification steps.' : 'Codi is composing the local response.',
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
                : runtimeProviderForRequest === 'ghcp'
                  ? 'GHCP returned an empty response.'
                  : 'Codi returned an empty response.'
            ),
          }));
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
        model: activeLocalModel,
        modelId: effectiveSelectedCopilotModelId,
        sessionId: activeChatSessionId,
        latestUserInput: text,
        messages: nextMessages,
        workspaceName,
        workspacePromptContext,
        voters: codiVoters,
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
  }, [activeChatSessionId, activeLocalModel, appendSharedMessages, clearActiveGeneration, copilotState, effectiveSelectedCopilotModelId, getSessionBash, hasAvailableCopilotModels, onTerminalFsPathsChanged, onToast, resetActiveInputHistoryCursor, runSandboxPrompt, selectedProvider, selectedToolIds, setBashHistoryBySession, toolsEnabled, webMcpBridge, workspaceName, workspacePromptContext]);

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
        : effectiveSelectedModelIdRef.current
    ) || null,
    agentId: selectedAgentIdRef.current ?? null,
    toolIds: [...selectedToolIdsRef.current],
    cwd: activeSessionId ? (cwdBySessionRef.current[activeSessionId] ?? BASH_INITIAL_CWD) : BASH_INITIAL_CWD,
    messages: messagesRef.current.map((message) => ({
      role: message.role,
      content: message.streamedContent || message.content,
      ...(message.status ? { status: message.status } : {}),
    })),
  }), [activeSessionId]);

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
      } else {
        effectiveSelectedModelIdRef.current = nextModelId;
        setSelectedModelBySession((current) => ({ ...current, [activeChatSessionId]: nextModelId }));
      }
    }

    if (typeof input.agentId === 'string') {
      const nextAgentId = input.agentId.trim() || null;
      selectedAgentIdRef.current = nextAgentId;
      setSelectedAgentIdBySession((current) => ({ ...current, [activeChatSessionId]: nextAgentId }));
    }

    if (Array.isArray(input.toolIds)) {
      const nextToolIds = input.toolIds.filter((toolId): toolId is string => typeof toolId === 'string');
      selectedToolIdsRef.current = nextToolIds;
      setSelectedToolIdsBySession((current) => ({ ...current, [activeChatSessionId]: nextToolIds }));
    }

    if (input.mode && input.mode !== activeModeRef.current) {
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
                    <option value="researcher">Researcher</option>
                    <option value="debugger">Debugger</option>
                  </select>
                </label>
                {selectedRuntimeProvider === 'ghcp'
                  ? (hasAvailableCopilotModels
                      ? (
                        <label className="header-model-selector" {...panelTitlebarControlProps}>
                          <select aria-label="GHCP model" value={effectiveSelectedCopilotModelId} onChange={(event) => setSelectedCopilotModelBySession((current) => ({ ...current, [activeChatSessionId]: event.target.value }))} {...panelTitlebarControlProps}>
                            {copilotState.models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                          </select>
                        </label>
                      )
                      : (
                        <button type="button" className="header-model-selector install-model-btn" onClick={onOpenSettings} {...panelTitlebarControlProps}>
                          {copilotState.authenticated ? 'GHCP models' : 'Sign in'}
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
                        <button type="button" className="header-model-selector install-model-btn" onClick={onOpenSettings} {...panelTitlebarControlProps}>Install model</button>
                      ))}
                {workspaceCapabilities.agents.length > 0 && (
                  <label className="header-model-selector" {...panelTitlebarControlProps}>
                    <select
                      aria-label="Session AGENTS.md"
                      value={selectedAgentId ?? ''}
                      onChange={(event) => {
                        const nextAgentId = event.target.value.trim() || null;
                        selectedAgentIdRef.current = nextAgentId;
                        setSelectedAgentIdBySession((current) => ({ ...current, [activeChatSessionId]: nextAgentId }));
                      }}
                      {...panelTitlebarControlProps}
                    >
                      {workspaceCapabilities.agents.map((agentFile) => (
                        <option key={agentFile.path} value={agentFile.path}>{agentFile.path}</option>
                      ))}
                    </select>
                  </label>
                )}
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
          <div className="chat-mode-controls">
            <div className="chat-mode-tabs" role="tablist" aria-label="Panel mode">
              <button type="button" role="tab" aria-selected={!showBash} aria-label="Chat mode" title="Chat mode" data-tooltip="Chat" className={`mode-tab mode-tab-icon ${!showBash ? 'active' : ''}`} onClick={() => onSwitchMode('agent')} {...panelTitlebarControlProps}><Icon name="sparkles" size={14} /></button>
              <button type="button" role="tab" aria-selected={showBash} aria-label="Terminal mode" title="Terminal mode" data-tooltip="Terminal" className={`mode-tab mode-tab-icon ${showBash ? 'active' : ''}`} onClick={() => onSwitchMode('terminal')} {...panelTitlebarControlProps}><Icon name="terminal" size={14} /></button>
            </div>
            <button type="button" className="mode-tab mode-action mode-tab-icon" aria-label="New session" title="New session" data-tooltip="New session" onClick={onNewSession} {...panelTitlebarControlProps}><Icon name="plus" size={13} /></button>
          </div>
          <button type="button" className="icon-button panel-close-button" aria-label={showBash ? 'Close terminal panel' : 'Close chat panel'} onClick={onClose} {...panelTitlebarControlProps}><Icon name="x" size={12} /></button>
        </div>
      </header>
      <div className="shared-console-body">
        <div className="shared-console-main">
          {!showBash && activeActivityMessage ? (
            <ProcessPanel message={activeActivityMessage} onClose={() => setActiveActivityBySession((current) => ({ ...current, [activeChatSessionId]: null }))} />
          ) : null}
          <div className="message-list" role="log" aria-live="polite" aria-label={showBash ? 'Terminal output' : 'Chat transcript'}>
            {messages.map((message) => <ChatMessageView key={message.id} message={message} agentName={getAgentDisplayName({ provider: selectedProvider, activeCodiModelName: activeLocalModel?.name, activeGhcpModelName: activeCopilotModel?.name, researcherRuntimeProvider: selectedRuntimeProvider })} activitySelected={message.id === activeActivityMessageId} onOpenActivity={selectActivityMessage} onCopyMessage={handleCopyMessage} />)}
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
                    aria-expanded={isSkillAutocompleteOpen}
                    aria-controls={isSkillAutocompleteOpen ? 'chat-skill-suggestions' : undefined}
                    value={input}
                    onChange={(event) => handleInputChange(event.target.value)}
                    placeholder={getAgentInputPlaceholder({ provider: selectedProvider, hasCodiModelsReady: hasInstalledModels, hasGhcpModelsReady: hasAvailableCopilotModels })}
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
                    ? <button type="button" className="composer-status composer-status-action" onClick={onOpenSettings}>{copilotState.authenticated ? 'GHCP has no enabled models. Open Models.' : 'GHCP needs sign-in. Open Models.'}</button>
                    : null)
                : (!hasInstalledModels ? <button type="button" className="composer-status composer-status-action" onClick={onOpenSettings}>{selectedProvider === 'researcher' ? 'Researcher needs GHCP or Codi. Open Models.' : selectedProvider === 'debugger' ? 'Debugger needs GHCP or Codi. Open Models.' : 'No Codi model loaded. Open Models to load one.'}</button> : null)}
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className="badge connected">Installed</span>
          {onDelete && <button type="button" className="secondary-button" style={{ fontSize: 10 }} onClick={onDelete}>Remove</button>}
        </div>
      ) : (
        <button type="button" className="secondary-button" aria-label={`${model.name} ${isLoading ? 'Loading' : 'Load'}`} onClick={onInstall} disabled={isLoading}>
          {isLoading ? 'Loading…' : 'Load'}
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
      <span className="badge connected">Enabled</span>
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
  const bodyClassNames = [scrollBody ? 'section-scroll-body' : 'settings-section-body', bodyClassName].filter(Boolean).join(' ');

  return (
    <section className={`model-section collapsible-section settings-section${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="panel-section-header section-toggle"
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
      {expanded ? <div className={bodyClassNames}>{children}</div> : null}
    </section>
  );
}

function SettingsPanel({ copilotState, isCopilotLoading, onRefreshCopilot, registryModels, installedModels, task, loadingModelId, onTaskChange, onSearch, onInstall, onDelete }: { copilotState: CopilotRuntimeState; isCopilotLoading: boolean; onRefreshCopilot: () => void; registryModels: HFModel[]; installedModels: HFModel[]; task: string; loadingModelId: string | null; onTaskChange: (task: string) => void; onSearch: (query: string) => void; onInstall: (model: HFModel) => Promise<void>; onDelete: (id: string) => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const installedIds = new Set(installedModels.map((m) => m.id));
  const isFiltering = Boolean(searchQuery || task);
  const copilotReady = hasGhcpAccess(copilotState);
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
    <section className="panel-scroll settings-panel" aria-label="Settings">
      <div className="panel-topbar">
        <div className="settings-heading">
          <h2>Settings</h2>
          <p className="muted">Manage GHCP availability and browser-runnable ONNX local models.</p>
        </div>
        <span className="badge">{copilotState.models.length} GHCP · {installedModels.length} Codi</span>
      </div>

      <SettingsSection title="Providers">
        <div className="provider-list">
          <article className="provider-card">
            <div className="provider-card-header">
              <div className="provider-body">
                <strong>GitHub Copilot</strong>
                <p>Checks for ambient GitHub Copilot auth in this environment and exposes it as the GHCP chat agent when enabled models are available.</p>
              </div>
              <span className={`badge${copilotReady ? ' connected' : ''}`}>{isCopilotLoading ? 'Checking…' : (copilotReady ? 'GHCP ready' : (copilotState.authenticated ? 'Signed in' : 'Sign-in required'))}</span>
            </div>
            {copilotState.statusMessage ? <p className="muted">{copilotState.statusMessage}</p> : null}
            {copilotState.error ? <p className="file-editor-error">{copilotState.error}</p> : null}
            {!copilotReady ? (
              <>
                <div className="provider-actions">
                  <a className="secondary-button" href={copilotState.signInDocsUrl} target="_blank" rel="noreferrer">Sign in to Copilot</a>
                  <button type="button" className="secondary-button" onClick={onRefreshCopilot} disabled={isCopilotLoading}>{isCopilotLoading ? 'Checking…' : 'Refresh status'}</button>
                </div>
                <label className="provider-command-field">
                  <span>Run this in the dev container</span>
                  <input aria-label="GitHub Copilot sign-in command" value={copilotState.signInCommand} readOnly />
                </label>
              </>
            ) : (
              <div className="provider-actions">
                <span className="badge connected">GHCP available</span>
                <button type="button" className="secondary-button" onClick={onRefreshCopilot} disabled={isCopilotLoading}>{isCopilotLoading ? 'Checking…' : 'Refresh status'}</button>
              </div>
            )}
          </article>
        </div>
      </SettingsSection>

      {copilotState.models.length > 0 && (
        <SettingsSection title={`GitHub Copilot models (${copilotState.models.length})`} defaultOpen={false} scrollBody>
          {copilotState.models.map((model) => (
            <CopilotModelCard key={model.id} model={model} />
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

function HistoryPanel() {
  return (
    <section className="panel-scroll history-panel" aria-label="History">
      <div className="panel-topbar">
        <h2>Recent activity</h2>
        <span className="badge">{mockHistory.length} sessions</span>
      </div>
      <div className="history-list">
        {mockHistory.map((session) => (
          <article key={session.id} className="list-card history-card">
            <div className="history-card-header">
              <div>
                <h3>{session.title}</h3>
                <p className="muted">{session.date}</p>
              </div>
              <span className="badge">{session.events.length} events</span>
            </div>
            <p className="history-preview">{session.preview}</p>
            <ul className="history-events">{session.events.map((entry) => <li key={entry}>{entry}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
  );
}

interface MarketplaceExtension {
  id: string;
  name: string;
  author: string;
  description: string;
  iconColor: string;
  iconLetter: string;
  stars: number;
  users: string;
  installed: boolean;
  category: string;
}

const MARKETPLACE_ITEMS: MarketplaceExtension[] = [
  { id: 'ublock', name: 'uBlock Origin', author: 'Raymond Hill', description: 'An efficient wide-spectrum content blocker for Chromium and Firefox.', iconColor: '#800000', iconLetter: 'uB', stars: 5, users: '10M+', installed: true, category: 'Privacy' },
  { id: 'dark-reader', name: 'Dark Reader', author: 'Dark Reader Ltd', description: 'Dark mode for every website. Take care of your eyes, use Dark Reader for night and daily browsing.', iconColor: '#1a1a2e', iconLetter: 'DR', stars: 4, users: '5M+', installed: true, category: 'Productivity' },
  { id: 'mcp-bridge', name: 'MCP Bridge', author: 'Anthropic', description: 'Connect to Model Context Protocol servers for tool-augmented AI interactions.', iconColor: '#d97706', iconLetter: 'MC', stars: 4, users: '50K+', installed: false, category: 'AI' },
  { id: '1password', name: '1Password', author: 'AgileBits', description: 'The best way to experience 1Password in your browser. Easily sign in, generate passwords, and autofill forms.', iconColor: '#0572ec', iconLetter: '1P', stars: 5, users: '2M+', installed: false, category: 'Privacy' },
  { id: 'react-devtools', name: 'React DevTools', author: 'Meta', description: 'Adds React debugging tools to the browser DevTools. Inspect the component hierarchy and props.', iconColor: '#61dafb', iconLetter: 'Re', stars: 4, users: '3M+', installed: true, category: 'Developer' },
  { id: 'copilot', name: 'GitHub Copilot', author: 'GitHub', description: 'AI pair programmer that helps you write code faster with autocomplete-style suggestions.', iconColor: '#238636', iconLetter: 'GH', stars: 5, users: '1M+', installed: false, category: 'AI' },
  { id: 'bitwarden', name: 'Bitwarden', author: 'Bitwarden Inc', description: 'A secure and free password manager for all of your devices.', iconColor: '#175DDC', iconLetter: 'Bw', stars: 4, users: '1M+', installed: false, category: 'Privacy' },
  { id: 'grammarly', name: 'Grammarly', author: 'Grammarly Inc', description: 'Improve your writing with AI-powered grammar checking, spell checking, and style suggestions.', iconColor: '#15c39a', iconLetter: 'Gr', stars: 4, users: '10M+', installed: false, category: 'Productivity' },
  { id: 'json-viewer', name: 'JSON Viewer', author: 'nicedoc.io', description: 'Beautify and format JSON data in the browser with syntax highlighting and tree view.', iconColor: '#f59e0b', iconLetter: 'JS', stars: 4, users: '500K+', installed: true, category: 'Developer' },
  { id: 'vimium', name: 'Vimium', author: 'Phil Crosby', description: 'The Hacker\'s browser. Navigate the web without a mouse using Vim-like keybindings.', iconColor: '#4ade80', iconLetter: 'Vi', stars: 5, users: '800K+', installed: false, category: 'Tools' },
];

function ExtensionsPanel({ workspaceName, capabilities }: { workspaceName: string; capabilities: WorkspaceCapabilities }) {
  const [search, setSearch] = useState('');
  const [installedExtensions, setInstalledExtensions] = useState<Set<string>>(() => new Set(MARKETPLACE_ITEMS.filter((e) => e.installed).map((e) => e.id)));

  const filtered = MARKETPLACE_ITEMS.filter((ext) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return ext.name.toLowerCase().includes(q) || ext.description.toLowerCase().includes(q) || ext.author.toLowerCase().includes(q);
  });

  const toggleInstall = (id: string) => {
    setInstalledExtensions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <section className="panel-scroll extensions-panel" aria-label="Extensions">
      <div className="panel-topbar extensions-topbar">
        <h2>Marketplace</h2>
        <span className="badge">{installedExtensions.size} installed</span>
      </div>
      <div className="extensions-search shared-input-shell">
        <Icon name="search" size={13} color="#7d8594" />
        <input aria-label="Search extensions" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter extensions" />
      </div>
      <div className="extensions-list">
        {filtered.map((ext) => {
          const isInstalled = installedExtensions.has(ext.id);
          return (
            <article key={ext.id} className="marketplace-card">
              <div className="marketplace-card-icon" style={{ background: ext.iconColor }}>
                <span>{ext.iconLetter}</span>
              </div>
              <div className="marketplace-card-body">
                <strong>{ext.name}</strong>
                <span className="marketplace-card-author">{ext.author}</span>
                <p className="marketplace-card-desc">{ext.description}</p>
                <div className="marketplace-card-meta">
                  <span className="marketplace-stars">{'★'.repeat(ext.stars)}{'☆'.repeat(5 - ext.stars)}</span>
                  <span className="muted">{ext.users}</span>
                </div>
              </div>
              <button type="button" className={`marketplace-install-btn ${isInstalled ? 'installed' : ''}`} onClick={() => toggleInstall(ext.id)}>
                {isInstalled ? 'Installed' : 'Add'}
              </button>
            </article>
          );
        })}
        {filtered.length === 0 && <p className="muted">No extensions match your search.</p>}
      </div>
      {capabilities.plugins.length > 0 && (
        <div className="workspace-plugins-section">
          <div className="panel-section-header">
            <span>Workspace plugins</span>
            <span className="muted">{workspaceName}</span>
          </div>
          {capabilities.plugins.map((plugin) => (
            <div key={plugin.path} className="list-card extension-card">
              <div className="extension-icon"><Icon name="puzzle" color="#f59e0b" /></div>
              <div className="extension-content">
                <div className="extension-title-row"><h3>{plugin.directory}</h3><span className="badge">{plugin.manifestName}</span></div>
                <p>{plugin.path}</p>
              </div>
            </div>
          ))}
        </div>
      )}
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

function makeAgentsMd(basePath: string): { path: string; content: string } {
  return {
    path: `${basePath}/AGENTS.md`,
    content: [
      '# Agent Instructions',
      '',
      '## Goals',
      '- Describe the expected outcomes for this session.',
      '',
      '## Constraints',
      '- Add safety, testing, or review rules the agent should respect.',
    ].join('\n'),
  };
}

function makeAgentSkill(basePath: string): { path: string; content: string } {
  return {
    path: `${basePath}/.agents/skills/new-skill/SKILL.md`,
    content: [
      '---',
      'name: new-skill',
      'description: Describe when this skill should be loaded.',
      '---',
      '',
      '# New Skill',
      '',
      '## Workflow',
      '1. Explain what to do.',
      '2. Explain how to validate the result.',
    ].join('\n'),
  };
}

function makeAgentHook(basePath: string): { path: string; content: string } {
  return {
    path: `${basePath}/.agents/hooks/pre-tool.sh`,
    content: [
      '#!/usr/bin/env bash',
      '# Pre-tool hook — compatible with Claude Code, OpenAI Codex, GitHub Copilot',
      '# Environment variables:',
      '#   AGENT_TOOL  — name of the tool being called (read, write, bash, …)',
      '#   AGENT_INPUT — JSON-encoded input to the tool',
      '#   AGENT_CWD   — current working directory',
      '# Exit 0 to allow execution, non-zero to block (where supported).',
      'set -euo pipefail',
      '',
      'echo "Pre-tool hook: ${AGENT_TOOL:-unknown}"',
      'exit 0',
    ].join('\n'),
  };
}

function makeAgentEval(basePath: string): { path: string; content: string } {
  return {
    path: `${basePath}/.agents/evals/new-eval.yaml`,
    content: [
      '# Agent Eval Suite — following AgentEvals.io standards',
      'name: new-eval',
      'version: "1.0"',
      'description: Describe what this eval suite tests.',
      'cases:',
      '  - id: case-001',
      '    description: Example case',
      '    prompt: |',
      '      What is 2 + 2?',
      '    assertions:',
      '      - type: contains',
      '        value: "4"',
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

function SidebarTree({ root, workspaceByNodeId, activeWorkspaceId, openTabIds, activeSessionIds, editingFilePath, cursorId, selectedIds, onCursorChange, onToggleFolder, onOpenTab, onOpenFile, onAddFile, onAddAgent, onAddBrowserTab, onNodeContextMenu, items }: { root: TreeNode; workspaceByNodeId: Map<string, string>; activeWorkspaceId: string; openTabIds: string[]; activeSessionIds: string[]; editingFilePath: string | null; cursorId: string | null; selectedIds: string[]; onCursorChange: (id: string) => void; onToggleFolder: (id: string) => void; onOpenTab: (id: string, multi?: boolean) => void; onOpenFile: (id: string) => void; onAddFile: (workspaceId: string) => void; onAddAgent: (workspaceId: string) => void; onAddBrowserTab: (workspaceId: string) => void; onNodeContextMenu: (x: number, y: number, node: TreeNode) => void; items: FlatTreeItem[] }) {
  return (
    <div className="tree-panel" role="tree" aria-label="Workspace tree">
      {items.map(({ node, depth }) => {
        const isFolder = node.type !== 'tab' && node.type !== 'file';
        const isWorkspace = node.type === 'workspace';
        const isFile = node.type === 'file';
        const isActiveWs = isWorkspace && node.id === activeWorkspaceId;
        const isEditingFile = isFile && node.filePath === editingFilePath;
        const isSelected = selectedIds.includes(node.id);
        const isCursor = cursorId === node.id;
        const tabOpacity = node.type === 'tab' ? (node.memoryTier === 'cold' ? 0.5 : node.memoryTier === 'cool' ? 0.65 : 0.9) : undefined;
        const workspaceParentId = workspaceByNodeId.get(node.id);
        const workspaceParent = workspaceParentId ? getWorkspace(root, workspaceParentId) : null;
        const isVfsNode = node.id.startsWith('vfs:') && !node.nodeKind;
        const hasContextMenu = node.type === 'tab' || isVfsNode || isFile;
        const openEllipsis = (e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          onNodeContextMenu(rect.right, rect.bottom, node);
        };
        return (
          <div key={node.id} role="treeitem" aria-selected={isSelected || isCursor} className={`tree-row ${isWorkspace ? 'ws-node' : ''} ${isActiveWs ? 'ws-active' : ''} ${isCursor ? 'cursor' : ''} ${openTabIds.includes(node.id) || activeSessionIds.includes(node.id) ? 'active' : ''} ${isEditingFile ? 'active' : ''} ${isSelected ? 'selected' : ''} ${isFile ? 'file-node' : ''} ${node.isReference ? 'tree-row-reference' : ''}`} style={{ paddingLeft: `${depth * 16}px` }}
            onContextMenu={hasContextMenu ? (e) => { e.preventDefault(); onNodeContextMenu(e.clientX, e.clientY, node); } : undefined}
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
  return toast ? <div className={`toast ${toast.type}`}>{toast.msg}</div> : null;
}

function panelKey(panel: Panel): string {
  if (panel.type === 'file') return `file:${panel.file.path}`;
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
  const panelsPerRow = containerWidth > 0 ? Math.max(1, Math.floor(containerWidth / PANEL_MIN_WIDTH_PX)) : displayPanels.length;
  const maxRows = containerHeight > 0 ? Math.max(1, Math.floor(containerHeight / PANEL_MIN_HEIGHT_PX)) : Math.ceil(displayPanels.length / panelsPerRow);
  const visiblePanels = displayPanels.slice(0, maxRows * panelsPerRow);
  const sortableIds = visiblePanels.map(panelKey);

  const rows: Panel[][] = [];
  for (let i = 0; i < visiblePanels.length; i += panelsPerRow) {
    rows.push(visiblePanels.slice(i, i + panelsPerRow));
  }

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
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className={`browser-split-view panels-${row.length}`}>
              {row.map((panel) => (
                <SortablePanelCell key={panelKey(panel)} id={panelKey(panel)}>
                  {(dragHandleProps) => renderPanel(panel, dragHandleProps)}
                </SortablePanelCell>
              ))}
            </div>
          ))}
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

const VALID_SIDEBAR_PANELS: SidebarPanel[] = ['workspaces', 'history', 'extensions', 'settings', 'account'];

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

const VALID_AGENT_PROVIDERS: AgentProvider[] = ['codi', 'ghcp', 'researcher', 'debugger'];

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
  const [collapsed, setCollapsed] = useState(false);
  const [registryTask, setRegistryTask] = useState('');
  const [registryQuery, setRegistryQuery] = useState('');
  const [registryModels, setRegistryModels] = useState<HFModel[]>([]);
  const [installedModels, setInstalledModels] = useStoredState<HFModel[]>(localStorageBackend, STORAGE_KEYS.installedModels, isHFModelArray, []);
  const [copilotState, setCopilotState] = useState<CopilotRuntimeState>(EMPTY_COPILOT_STATE);
  const [isCopilotStateLoading, setIsCopilotStateLoading] = useState(true);
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
  const [workspaceViewStateByWorkspace, setWorkspaceViewStateByWorkspace] = useStoredState<Record<string, WorkspaceViewState>>(
    localStorageBackend,
    STORAGE_KEYS.workspaceViewStateByWorkspace,
    isWorkspaceViewStateRecord,
    createWorkspaceViewState(root),
  );
  const [terminalFsPathsBySession, setTerminalFsPathsBySession] = useState<Record<string, string[]>>({});
  const [terminalFsFileContentsBySession, setTerminalFsFileContentsBySession] = useState<Record<string, Record<string, string>>>({});
  const bashBySessionRef = useRef<Record<string, Bash>>({});
  const sessionMcpControllersRef = useRef<Record<string, SessionMcpController>>({});
  const [addSessionFsMenu, setAddSessionFsMenu] = useState<{ sessionId: string; basePath: string; kind?: 'file' | 'folder' } | null>(null);
  const [addSessionFsName, setAddSessionFsName] = useState('');
  const [renameSessionFsMenu, setRenameSessionFsMenu] = useState<{ sessionId: string; path: string } | null>(null);
  const [renameSessionFsName, setRenameSessionFsName] = useState('');
  const [contextMenu, setContextMenu] = useState<WorkspaceContextMenuState<ContextMenuEntry, ContextMenuTopButton> | null>(null);
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
  const webMcpModelContext = useMemo(
    () => installModelContext(typeof window === 'undefined' ? undefined : window) ?? new ModelContext(),
    [],
  );
  const workspaceWebMcpBridge = useMemo(() => createWebMcpToolBridge(webMcpModelContext), [webMcpModelContext]);

  const activeWorkspace = getWorkspace(root, activeWorkspaceId) ?? root;
  const activeBrowserTabs = useMemo(() => flattenTabs(activeWorkspace, 'browser'), [activeWorkspace]);
  const activeWorkspaceViewState: WorkspaceViewState = activeWorkspace.type === 'workspace'
    ? normalizeWorkspaceViewEntry(activeWorkspace, workspaceViewStateByWorkspace[activeWorkspaceId])
    : {
        openTabIds: [],
        editingFilePath: null,
        activeMode: 'agent',
        activeSessionIds: [],
        mountedSessionFsIds: [],
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
  const activeWorkspaceCapabilities = useMemo(() => discoverWorkspaceCapabilities(activeWorkspaceFiles), [activeWorkspaceFiles]);
  const editingFile = activeWorkspaceViewState.editingFilePath ? activeWorkspaceFiles.find((f) => f.path === activeWorkspaceViewState.editingFilePath) ?? null : null;
  const activeRenderPanes = useMemo<WorkspaceMcpRenderPane[]>(() => {
    const panes: WorkspaceMcpRenderPane[] = [];

    if (editingFile) {
      panes.push({
        id: `file:${editingFile.path}`,
        paneType: 'workspace-file',
        itemId: editingFile.path,
        label: editingFile.path,
        path: editingFile.path,
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

    for (const sessionId of activeSessionIds) {
      const summary = activeWorkspaceSessions.find((session) => session.id === sessionId);
      panes.push({
        id: `session:${sessionId}`,
        paneType: 'session',
        itemId: sessionId,
        label: summary?.name ?? sessionId,
      });
    }

    return orderRenderPanes(panes, activeWorkspaceViewState.panelOrder ?? []);
  }, [activeSessionIds, activeWorkspaceSessions, activeWorkspaceViewState.panelOrder, editingFile, openBrowserTabs]);
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
      bashSessions[sessionId] = new Bash({
        cwd: BASH_INITIAL_CWD,
        files: { [`${BASH_INITIAL_CWD}/${BASH_CWD_PLACEHOLDER_FILE}`]: '' },
      });
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
        const files = workspaceFilesByWorkspace[ws.id] ?? [];
        const fileNodes = buildWorkspaceCapabilityDriveNodes(`file:${ws.id}`, files);
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
          ? { ...child, children: [...fileNodes, ...terminalFsNodes] }
          : child);
        return { ...normalizedWorkspace, children: nextChildren };
      });
      return { ...current, children: updated };
    });
  }, [terminalFsFileContentsBySession, terminalFsPathsBySession, workspaceFilesByWorkspace, workspaceViewStateByWorkspace]);

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

  const switchSidebarPanel = useCallback((panel: SidebarPanel) => {
    setActivePanel(panel);
    setCollapsed(false);
    setShowWorkspaces(false);
  }, []);

  const openWorkspaceSwitcher = useCallback(() => {
    setActivePanel('workspaces');
    setCollapsed(false);
    setShowWorkspaces(true);
  }, []);

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

  const addSessionToWorkspace = useCallback((workspaceId: string, nameOverride?: string) => {
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
      createdSession = { id: newSession.id, name: newSession.name, isOpen: true };
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
        activeMode: 'agent' as const,
        activeSessionIds: [],
        mountedSessionFsIds: [],
        panelOrder: [],
      };
      return {
        ...current,
        [workspaceId]: {
          ...existing,
          openTabIds: [],
          editingFilePath: null,
          activeSessionIds: newSessionId ? [newSessionId] : [],
          mountedSessionFsIds: newSessionId && !existing.mountedSessionFsIds.includes(newSessionId)
            ? [...existing.mountedSessionFsIds, newSessionId]
            : existing.mountedSessionFsIds,
        },
      };
    });
    setToast({ msg: 'New session created', type: 'success' });
    return createdSession;
  }, [setToast, switchWorkspace]);

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
      addSessionToWorkspace(workspaceId);
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
      defaultProvider: getDefaultAgentProvider({ installedModels, copilotState }),
      copilot: {
        authenticated: copilotState.authenticated,
        models: copilotState.models.map((model) => model.id),
      },
      installedModels: installedModels.map((model) => ({ id: model.id, task: model.task })),
      tabsInWorkspace: countTabs(activeWorkspace),
      workspaceFiles: activeWorkspaceFiles.map((file) => file.path),
      agentsInstructions: activeWorkspaceCapabilities.agents.map((file) => file.path),
      skills: activeWorkspaceCapabilities.skills.map((skill) => skill.name),
      plugins: activeWorkspaceCapabilities.plugins.map((plugin) => plugin.directory),
      hooks: activeWorkspaceCapabilities.hooks.map((hook) => hook.name),
    },
  }, [activePanel, activeWorkspace, activeWorkspaceCapabilities, activeWorkspaceFiles, copilotState, installedModels, openBrowserTabs]);

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
      if (event.altKey && !event.ctrlKey && !event.metaKey && /^[1-5]$/.test(event.key)) {
        event.preventDefault();
        const targetPanel = PANEL_SHORTCUT_ORDER[Number(event.key) - 1];
        if (targetPanel) switchSidebarPanel(targetPanel);
        return;
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
          openTabIds: [tab.id],
          editingFilePath: null,
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
      { label: 'Add AGENTS.md', onClick: () => void handleScaffoldToSessionFs(vfsArgs.sessionId, makeAgentsMd(vfsArgs.basePath)) },
      { label: 'Add agent-skill', onClick: () => void handleScaffoldToSessionFs(vfsArgs.sessionId, makeAgentSkill(vfsArgs.basePath)) },
      { label: 'Add agent-hook', onClick: () => void handleScaffoldToSessionFs(vfsArgs.sessionId, makeAgentHook(vfsArgs.basePath)) },
      { label: 'Add agent-eval', onClick: () => void handleScaffoldToSessionFs(vfsArgs.sessionId, makeAgentEval(vfsArgs.basePath)) },
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

  function openContextMenuForNode(x: number, y: number, node: TreeNode) {
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
    if (node.type === 'file') {
      setContextMenu({ x, y, itemId: node.id, itemType: 'workspace-file', ...buildFileContextMenu(node) });
    }
  }

  function handleNodeContextMenu(x: number, y: number, node: TreeNode) {
    openContextMenuForNode(x, y, node);
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
    if (node.nodeKind === 'browser') {
      return {
        location: node.url ?? '(no URL)',
        sizeLabel: `${node.memoryMB ?? 0} MB`,
        createdAt: now,
        modifiedAt: now,
        accessedAt: now,
        identityPermissions: defaultPermissionsFor(['Bookmark', 'Mute', 'Copy URI', 'Close']),
      };
    }
    if (node.nodeKind === 'session') {
      return {
        location: node.filePath ?? node.id,
        sizeLabel: 'N/A',
        createdAt: now,
        modifiedAt: now,
        accessedAt: now,
        identityPermissions: defaultPermissionsFor(['Share', 'Rename', 'Remove']),
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
    const nextWorkspace = getWorkspace(nextRoot, ownerWorkspaceId);
    setRoot(nextRoot);
    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[ownerWorkspaceId];
      if (!existing) return current;
      const remainingSessionIds = (existing.activeSessionIds ?? []).filter((id) => id !== nodeId);
      const nextEntry: WorkspaceViewState = {
        ...existing,
        openTabIds: (existing.openTabIds ?? []).filter((id) => id !== nodeId),
        activeSessionIds: remainingSessionIds.length > 0
          ? remainingSessionIds
          : (nextWorkspace ? (findFirstSessionId(nextWorkspace) ? [findFirstSessionId(nextWorkspace)!] : []) : []),
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
    if (node?.filePath) {
      // Switch to the workspace that owns this file
      const workspace = findWorkspaceForNode(root, nodeId);
      if (workspace) {
        setWorkspaceViewStateByWorkspace((current) => ({
          ...current,
          [workspace.id]: {
            ...(current[workspace.id] ?? createWorkspaceViewEntry(workspace)),
            editingFilePath: node.filePath ?? null,
          },
        }));
        switchWorkspace(workspace.id);
      }
    }
  }

  function handleOpenTreeTab(nodeId: string, multi = false) {
    const node = findNode(root, nodeId);
    if (!node || node.type !== 'tab') return;
    const workspace = findWorkspaceForNode(root, nodeId);
    if (workspace) switchWorkspace(workspace.id);
    if (!workspace) return;
    if ((node.nodeKind ?? 'browser') === 'browser') {
      setWorkspaceViewStateByWorkspace((current) => {
        const existing = current[workspace.id] ?? createWorkspaceViewEntry(workspace);
        const currentIds = existing.openTabIds ?? [];
        const newIds = multi
          ? (currentIds.includes(nodeId) ? currentIds.filter((id) => id !== nodeId) : [...currentIds, nodeId])
          : [nodeId];
        return {
          ...current,
          [workspace.id]: { ...existing, openTabIds: newIds },
        };
      });
      return;
    }
    if (node.nodeKind === 'agent') {
      setWorkspaceViewStateByWorkspace((current) => {
        const existing = current[workspace.id] ?? createWorkspaceViewEntry(workspace);
        const currentIds = existing.activeSessionIds ?? [];
        const newIds = multi
          ? (currentIds.includes(nodeId) ? currentIds.filter((id) => id !== nodeId) : [...currentIds, nodeId])
          : [nodeId];
        return { ...current, [workspace.id]: { ...existing, activeSessionIds: newIds } };
      });
      return;
    }
    if (node.nodeKind === 'terminal') {
      setWorkspaceViewStateByWorkspace((current) => {
        const existing = current[workspace.id] ?? createWorkspaceViewEntry(workspace);
        const currentIds = existing.activeSessionIds ?? [];
        const newIds = multi
          ? (currentIds.includes(nodeId) ? currentIds.filter((id) => id !== nodeId) : [...currentIds, nodeId])
          : [nodeId];
        return { ...current, [workspace.id]: { ...existing, activeSessionIds: newIds } };
      });
    }
    if (node.nodeKind === 'session') {
      setWorkspaceViewStateByWorkspace((current) => {
        const existing = current[workspace.id] ?? createWorkspaceViewEntry(workspace);
        const currentIds = existing.activeSessionIds ?? [];
        const newIds = multi
          ? (currentIds.includes(nodeId) ? currentIds.filter((id) => id !== nodeId) : [...currentIds, nodeId])
          : [nodeId];
        return { ...current, [workspace.id]: { ...existing, activeSessionIds: newIds } };
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
      initialCwd: BASH_INITIAL_CWD,
      inferSessionFsEntryKind,
    });
  }, [activeMountedSessionFsIds, activeWorkspace, terminalFsPathsBySession]);

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
    template: 'agents' | 'skill' | 'hook' | 'eval';
  }) => {
    const nextTemplate = template === 'agents'
      ? makeAgentsMd(basePath)
      : template === 'skill'
        ? makeAgentSkill(basePath)
        : template === 'hook'
          ? makeAgentHook(basePath)
          : makeAgentEval(basePath);
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

  const closeRenderPaneFromMcp = useCallback(async (paneId: string) => {
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

    throw new DOMException(`Render pane "${paneId}" is not available in ${activeWorkspace.name}.`, 'NotFoundError');
  }, [activeWorkspace, activeWorkspaceId, closeSessionFromMcp, handleRemoveFileNode, readBrowserPageFromWorkspace]);

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
    return item ? readWorktreeContextMenuState({ itemId, itemType }, contextMenu) : null;
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

    const currentState = readWorktreeContextMenuState({ itemId, itemType }, contextMenu);
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
      case 'session-fs-entry': {
        const vfsArgs = parseVfsNodeId(itemId);
        if (!vfsArgs) {
          return [];
        }
        return [
          ...(!vfsArgs.isDriveRoot ? [{ id: 'rename', label: 'Rename' }, { id: 'delete', label: 'Delete' }] : []),
          { id: 'new_file', label: 'Add File' },
          { id: 'new_folder', label: 'Add Folder' },
          { id: 'add_agents_md', label: 'Add AGENTS.md' },
          { id: 'add_agent_skill', label: 'Add agent-skill' },
          { id: 'add_agent_hook', label: 'Add agent-hook' },
          { id: 'add_agent_eval', label: 'Add agent-eval' },
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
      } else if (actionId === 'add_agents_md' || actionId === 'add_agent_skill' || actionId === 'add_agent_hook' || actionId === 'add_agent_eval') {
        const template = actionId === 'add_agents_md'
          ? 'agents'
          : actionId === 'add_agent_skill'
            ? 'skill'
            : actionId === 'add_agent_hook'
              ? 'hook'
              : 'eval';
        await scaffoldSessionFsEntryFromMcp({ sessionId: vfsArgs.sessionId, basePath: vfsArgs.basePath, template });
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
    createSessionFsEntryFromMcp,
    deleteSessionFsEntryFromMcp,
    handleBookmarkTab,
    handleCopyUri,
    handleFileDuplicate,
    handleFileMove,
    handleFileSymlink,
    handleMuteTab,
    handleRemoveFileNode,
    handleShareSession,
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
      browserPages: activeBrowserPages,
      renderPanes: activeRenderPanes,
      sessions: activeWorkspaceSessions,
      getSessionTools: getSessionToolsFromMcp,
      sessionDrives: activeSessionDrives,
      clipboardEntries: activeClipboardEntries,
      getSessionState: getSessionStateFromMcp,
      getBrowserPageHistory: getBrowserPageHistoryFromMcp,
      sessionFsEntries: activeSessionFsEntries,
      worktreeItems: activeWorktreeItems,
      onOpenFile: openActiveWorkspaceFileFromMcp,
      onCreateBrowserPage: createBrowserPageFromMcp,
      onNavigateBrowserPage: navigateBrowserPageFromMcp,
      onNavigateBrowserPageHistory: navigateBrowserPageHistoryFromMcp,
      onRefreshBrowserPage: refreshBrowserPageFromMcp,
      onCloseRenderPane: closeRenderPaneFromMcp,
      onMoveRenderPane: moveRenderPaneFromMcp,
      onCreateSession: createSessionFromMcp,
      onWriteSession: writeSessionFromMcp,
      onCreateWorkspaceFile: createWorkspaceFileFromMcp,
      onWriteWorkspaceFile: writeWorkspaceFileFromMcp,
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
    activeClipboardEntries,
    activeRenderPanes,
    activeSessionDrives,
    closeSessionFromMcp,
    createBrowserPageFromMcp,
    createSessionFromMcp,
    createSessionFsEntryFromMcp,
    createWorkspaceFileFromMcp,
    closeRenderPaneFromMcp,
    deleteSessionFsEntryFromMcp,
    deleteWorkspaceFileFromMcp,
    getSessionToolsFromMcp,
    getSessionStateFromMcp,
    getWorktreeContextMenuStateFromMcp,
    getWorktreeContextActionsForItem,
    getWorktreeRenderPaneStateFromMcp,
    invokeWorktreeContextActionFromMcp,
    duplicateWorkspaceFileFromMcp,
    getBrowserPageHistoryFromMcp,
    getFilesystemHistoryFromMcp,
    openActiveWorkspaceFileFromMcp,
    readSessionFsFileFromMcp,
    renameSessionFsEntryFromMcp,
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
    unmountSessionDriveFromMcp,
    writeSessionFsFileFromMcp,
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
    if (activePanel === 'history') return <HistoryPanel />;
    if (activePanel === 'extensions') return <ExtensionsPanel workspaceName={activeWorkspace.name} capabilities={activeWorkspaceCapabilities} />;
    if (activePanel === 'settings') return <SettingsPanel copilotState={copilotState} isCopilotLoading={isCopilotStateLoading} onRefreshCopilot={() => void refreshCopilotState(true)} registryModels={registryModels} installedModels={installedModels} task={registryTask} loadingModelId={loadingModelId} onTaskChange={setRegistryTask} onSearch={setRegistryQuery} onInstall={installModel} onDelete={deleteModel} />;
    return <section className="panel-scroll"><h2>Account</h2><p className="muted">Account policies and audit trails can live here.</p></section>;
  }

  return (
    <div className="app-shell">
      <nav className="activity-bar" aria-label="Primary navigation">
        <div className="activity-group">
          {PRIMARY_NAV.map(([id, icon, label], index) => <button key={id} type="button" className={`activity-button ${activePanel === id ? 'active' : ''}`} onClick={() => { if (id === 'workspaces') { if (activePanel === 'workspaces') openWorkspaceSwitcher(); else switchSidebarPanel('workspaces'); } else { switchSidebarPanel(id as SidebarPanel); } }} aria-label={label} title={`${label} (Alt+${index + 1})`}><Icon name={icon as keyof typeof icons} size={16} color={activePanel === id ? '#7dd3fc' : '#71717a'} /></button>)}
        </div>
        <div className="activity-spacer" />
        <div className="activity-group">
          {SECONDARY_NAV.map(([id, icon, label], index) => <button key={id} type="button" className={`activity-button ${activePanel === id ? 'active' : ''}`} onClick={() => switchSidebarPanel(id as SidebarPanel)} aria-label={label} title={`${label} (Alt+${PRIMARY_NAV.length + index + 1})`}><Icon name={icon as keyof typeof icons} size={16} color={activePanel === id ? '#7dd3fc' : '#71717a'} /></button>)}
        </div>
        <button type="button" className="activity-button" onClick={() => setCollapsed((current) => !current)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><Icon name="panelRight" size={16} color="#71717a" /></button>
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
      <main className="content-area">
        {(() => {
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
                editingFilePath: detectWorkspaceFileKind(nextFile.path) === 'agents' ? null : nextFile.path,
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
          if (editingFile) {
            panelEntries.push([`file:${editingFile.path}`, { type: 'file', file: editingFile }]);
          }
          panelEntries.push(
            ...openBrowserTabs.map((tab): [string, Panel] => [`browser:${tab.id}`, { type: 'browser', tab }]),
            ...activeSessionIds.map((id): [string, Panel] => [`session:${id}`, { type: 'session', id }]),
          );
          const panelsById = new Map<string, Panel>(panelEntries);
          const allPanels: Panel[] = activeRenderPanes
            .map((pane) => panelsById.get(pane.id) ?? null)
            .filter((panel): panel is Panel => panel !== null);
          const renderPanel = (panel: Panel, dragHandleProps?: PanelDragHandleProps) => {
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
            return (
              <ChatPanel
                key={panel.id}
                installedModels={installedModels}
                copilotState={copilotState}
                pendingSearch={pendingSearch}
                onSearchConsumed={() => setPendingSearch(null)}
                onToast={setToast}
                workspaceName={activeWorkspace.name}
                workspaceFiles={activeWorkspaceFiles}
                workspaceCapabilities={activeWorkspaceCapabilities}
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
                onOpenSettings={() => switchSidebarPanel('settings')}
                onWorkspaceFileUpsert={(nextFile) => setWorkspaceFilesByWorkspace((current) => ({
                  ...current,
                  [activeWorkspaceId]: upsertWorkspaceFile(current[activeWorkspaceId] ?? [], nextFile),
                }))}
                onCopyToClipboard={writeToClipboard}
                bashBySessionRef={bashBySessionRef}
                webMcpModelContext={webMcpModelContext}
                onSessionMcpControllerChange={handleSessionMcpControllerChange}
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
      {showAddFileMenu ? <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add file"><div className="modal-card compact"><div className="modal-header"><h2>Add file</h2><button type="button" className="icon-button" onClick={() => setShowAddFileMenu(null)}><Icon name="x" /></button></div><div className="add-file-form"><label className="file-editor-field"><span>Name (optional)</span><input aria-label="Capability name" value={addFileName} onChange={(event) => setAddFileName(event.target.value)} placeholder="e.g. review-pr" /></label><div className="add-file-buttons"><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('agents', showAddFileMenu)}>AGENTS.md</button><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('skill', showAddFileMenu)}>Skill</button><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('plugin', showAddFileMenu)}>Plugin</button><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('hook', showAddFileMenu)}>Hook</button></div></div></div></div> : null}
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

export default function App() {
  return <AgentBrowserApp />;
}
