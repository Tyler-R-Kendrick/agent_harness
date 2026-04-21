export type MemoryTier = 'hot' | 'warm' | 'cool' | 'cold';
export type NodeType = 'root' | 'workspace' | 'folder' | 'tab' | 'file';
export type NodeKind = 'browser' | 'terminal' | 'agent' | 'files' | 'session' | 'clipboard';
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'thinking' | 'streaming' | 'complete' | 'error';
export type ReasoningStepKind = 'thinking' | 'search' | 'tool' | 'summary';
export type ReasoningStepStatus = 'active' | 'done';
export type ModelStatus = 'available' | 'installed' | 'loading';
export type PanelId = 'workspaces' | 'history' | 'extensions' | 'settings' | 'account';
/** ONNX quantization dtype values understood by Transformers.js. */
export type OnnxDtype = 'q4' | 'q4f16' | 'int8' | 'uint8' | 'fp16' | 'q8' | 'bnb4' | 'fp32';

export interface TreeNode {
  id: string;
  name: string;
  type: NodeType;
  nodeKind?: NodeKind;
  isDrive?: boolean;
  children?: TreeNode[];
  expanded?: boolean;
  persisted?: boolean;
  activeMemory?: boolean;
  memoryTier?: MemoryTier;
  memoryMB?: number;
  url?: string;
  color?: string;
  filePath?: string;
  isReference?: boolean;
  muted?: boolean;
}

export interface McpCard {
  app: string;
  args: Record<string, unknown>;
}

export interface SourceChip {
  url?: string;
  domain: string;
  faviconUrl?: string;
}

export interface ReasoningStep {
  id: string;
  kind: ReasoningStepKind;
  title: string;
  body?: string;
  toolName?: string;
  toolCallId?: string;
  toolSummary?: string;
  toolArgs?: unknown;
  toolResult?: string;
  isError?: boolean;
  sources?: SourceChip[];
  startedAt: number;
  endedAt?: number;
  status: ReasoningStepStatus;
  parentStepId?: string;
  branchId?: string;
}

/**
 * A single voter's evaluation of an intent.
 * Structurally compatible with OperationStep (kind: 'agent') so it can be
 * passed directly to OperationTimeline without mapping.
 */
export interface VoterStep {
  id: string;
  kind: 'agent';
  /** Display label — typically the voter's ID. */
  title: string;
  voterId: string;
  /** Human-readable outcome — "Approved", "Rejected: <reason>", or undefined while active. */
  body?: string;
  /** true = approved, false = rejected, undefined = still evaluating. */
  approve?: boolean;
  startedAt: number;
  endedAt?: number;
  status: ReasoningStepStatus;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  streamedContent?: string;
  status?: MessageStatus;
  isLocal?: boolean;
  thinkingContent?: string;
  thinkingDuration?: number;
  isThinking?: boolean;
  cards?: McpCard[];
  reasoningSteps?: ReasoningStep[];
  currentStepId?: string;
  reasoningStartedAt?: number;
  loadingStatus?: string | null;
  statusText?: string | null;
  isError?: boolean;
  /** Voter evaluation steps produced by logact voters during this message's turn. */
  voterSteps?: VoterStep[];
  /** True while at least one voter is still evaluating the intent. */
  isVoting?: boolean;
}

export interface HFModel {
  id: string;
  name: string;
  author: string;
  task: string;
  downloads: number;
  likes: number;
  tags: string[];
  sizeMB: number;
  contextWindow?: number;
  maxOutputTokens?: number;
  status: ModelStatus;
}

export interface McpAppDef {
  name: string;
  icon: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type McpRegistry = Record<string, McpAppDef>;

export interface HistorySession {
  id: number;
  title: string;
  date: string;
  preview: string;
  events: string[];
}

export type IntegrationKind = 'agents' | 'skills' | 'plugins' | 'hooks' | 'mcps';

// ── Identity & Permissions ────────────────────────────────────────────────────

export type IdentityType = 'user' | 'agent';

export interface Identity {
  id: string;
  name: string;
  type: IdentityType;
}

export interface ActionPermission {
  action: string;
  allowed: boolean;
}

export interface IdentityPermissions {
  identity: Identity;
  permissions: ActionPermission[];
}

// ── Node metadata ─────────────────────────────────────────────────────────────

export interface NodeMetadata {
  /** Human-readable location (URL, VFS path, or session path) */
  location: string;
  /** Size description – e.g. "128 MB" for browser tabs, bytes for files */
  sizeLabel: string;
  sizeBytes?: number;
  createdAt: number;
  modifiedAt: number;
  accessedAt: number;
  identityPermissions: IdentityPermissions[];
}

// ── Browser navigation history ───────────────────────────────────────────────

export interface BrowserNavEntry {
  url: string;
  title: string;
  timestamp: number;
}

export interface BrowserNavHistory {
  entries: BrowserNavEntry[];
  currentIndex: number;
}

export type WorkspaceFileKind = 'agents' | 'skill' | 'plugin' | 'hook';

export interface IntegrationSurface {
  id: string;
  name: string;
  kind: IntegrationKind;
  source: string;
  enabled: boolean;
  color: string;
  description: string;
  badges: string[];
  constraint?: string;
}

export interface WorkspaceFile {
  path: string;
  content: string;
  updatedAt: string;
}

export interface WorkspaceSkill {
  path: string;
  directory: string;
  name: string;
  description: string;
  content: string;
}

export interface WorkspacePlugin {
  path: string;
  directory: string;
  manifestName: string;
  content: string;
}

export interface WorkspaceHook {
  path: string;
  name: string;
  content: string;
}

export interface WorkspaceCapabilities {
  agents: WorkspaceFile[];
  skills: WorkspaceSkill[];
  plugins: WorkspacePlugin[];
  hooks: WorkspaceHook[];
}

export interface BrowserInferenceRequest {
  task: string;
  modelId: string;
  prompt: unknown;
  options?: Record<string, unknown>;
}

export interface BrowserInferenceCallbacks {
  onStatus?: (msg: string) => void;
  onPhase?: (phase: string) => void;
  onToken?: (token: string) => void;
  onDone?: (result: unknown) => void;
  onError?: (err: Error) => void;
}
