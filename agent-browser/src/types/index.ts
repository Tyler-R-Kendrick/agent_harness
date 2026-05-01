import type { CompletionScore } from 'logact';
import type { ProcessEntry } from '../services/processLog';
import type { GuidedTourPlan } from '../features/tours/driverTour';

export type MemoryTier = 'hot' | 'warm' | 'cool' | 'cold';
export type NodeType = 'root' | 'workspace' | 'folder' | 'tab' | 'file';
export type NodeKind = 'browser' | 'terminal' | 'agent' | 'files' | 'session' | 'clipboard';
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'thinking' | 'streaming' | 'complete' | 'error';
export type ReasoningStepKind = 'thinking' | 'search' | 'tool' | 'summary';
export type ReasoningStepStatus = 'active' | 'done';
export type ReasoningStepLane = 'sequential' | 'parallel';
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
  kind?: 'elicitation' | 'secret';
  requestId?: string;
  prompt?: string;
  reason?: string;
  secretName?: string;
  secretRef?: string;
  fields?: Array<{
    id: string;
    label: string;
    required?: boolean;
    placeholder?: string;
  }>;
  status?: 'pending' | 'submitted';
  response?: Record<string, string>;
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
  transcript?: string;
  toolName?: string;
  toolCallId?: string;
  toolSummary?: string;
  toolArgs?: unknown;
  toolResult?: string;
  isError?: boolean;
  sources?: SourceChip[];
  startedAt: number;
  endedAt?: number;
  timeoutMs?: number;
  status: ReasoningStepStatus;
  parentStepId?: string;
  branchId?: string;
  lane?: ReasoningStepLane;
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
  /**
   * Free-form subagent reasoning from the voter. Distinct from `body`: `body`
   * holds the short outcome label, `thought` holds the voter's rationale as a
    * subagent. Rendered as secondary process detail content.
   */
  thought?: string;
  startedAt: number;
  endedAt?: number;
  status: ReasoningStepStatus;
}

/** A single Ralph-style iteration of task completion. */
export interface IterationStep {
  id: string;
  kind: 'iteration';
  title: string;
  body?: string;
  score?: CompletionScore;
  done?: boolean;
  startedAt: number;
  endedAt?: number;
  status: ReasoningStepStatus;
}

/**
 * A single AgentBus entry surfaced to the UI.
 * Mirrors logact's `Entry` shape but keeps the payload as a tagged record so
 * the UI does not depend on the runtime PayloadType enum (avoids cross-package
 * coupling and survives serialization through React state).
 */
export interface BusEntryStep {
  id: string;
  /** Monotonic log position from the underlying AgentBus. */
  position: number;
  /** Realtime timestamp the entry was appended. */
  realtimeTs: number;
  /** Payload type tag — matches `logact.PayloadType` values. */
  payloadType: string;
  /** Short summary line for the timeline (e.g. "Intent: synthesize delegation report"). */
  summary: string;
  /** Full payload rendering for the drill-down detail pane. */
  detail: string;
  /** Optional originating actor id — voter id, subagent id, etc. */
  actor?: string;
  /** LogAct actor id for deconstructed state-machine actors. */
  actorId?: string;
  /** LogAct actor role: driver, voter, decider, executor, etc. */
  actorRole?: string;
  /** Parent LogAct actor id for graph branch attachment. */
  parentActorId?: string;
  /** Preferred graph branch/lifeline id for this AgentBus row. */
  branchId?: string;
  /** Human label for actor rows. */
  agentLabel?: string;
  /** Model id used by this actor, if known. */
  modelId?: string;
  /** Model provider/runtime used by this actor, if known. */
  modelProvider?: string;
  /** Bounded LogAct rerun pass for dynamic actor entries. */
  passIndex?: number;
}

export interface SearchTurnContext {
  taskText: string;
  resolvedTaskText: string;
  subject: string;
  answerSubject: string;
  rankingGoal?: 'best' | 'worst' | 'closest' | 'most-popular' | 'recommended' | 'current' | 'open-now' | 'highly-rated' | 'family-friendly' | 'budget-friendly' | 'quiet' | 'nearby';
  location?: string;
  acceptedCandidates: Array<{
    name: string;
    url?: string;
  }>;
  rejectedLabels: string[];
  sourceQueries: string[];
  requestedCount?: number;
  validationContract?: ValidationContract;
  timestamp: number;
}

export type ValidationConstraintType =
  | 'count'
  | 'subject'
  | 'location'
  | 'name_prefix'
  | 'name_suffix'
  | 'rhyme'
  | 'exclusion'
  | 'entity_link'
  | 'source_evidence'
  | 'page_chrome'
  | 'format'
  | 'unknown';

export interface ValidationConstraint {
  id: string;
  sourceText: string;
  type: ValidationConstraintType;
  operator: string;
  target: string;
  value?: string | number | string[] | boolean;
  required: boolean;
  confidence: number;
  validationMethod: 'structured-candidate' | 'answer-text' | 'tool-output' | 'agentbus' | 'manual-clarification';
  failureMessage: string;
}

export interface ValidationEvidenceRequirement {
  id: string;
  description: string;
  required: boolean;
  target: string;
}

export interface ValidationContract {
  type: 'validation-contract';
  version: 1;
  taskGoal: string;
  constraints: ValidationConstraint[];
  evidenceRequirements: ValidationEvidenceRequirement[];
  impossibilityPolicy: {
    kind: 'none' | 'likely-impossible' | 'contradictory';
    reason?: string;
    askUserForHelp: boolean;
  };
  clarificationTriggers: string[];
  successSemantics: 'all-required' | 'allow-partial-with-acknowledgement';
  legacyCriteria: string[];
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
  /** Ralph-loop iteration steps produced while checking task completion. */
  iterationSteps?: IterationStep[];
  /** True while at least one voter is still evaluating the intent. */
  isVoting?: boolean;
  /** Append-only log of AgentBus entries observed during this turn. */
  busEntries?: BusEntryStep[];
  /**
   * Canonical, append-only ProcessLog snapshot for this turn. The unified
   * gitgraph UI renders only this; legacy `reasoningSteps`/`voterSteps`/
   * `busEntries` fields are kept on the message for backwards compat with
   * existing tests until removal.
   */
  processEntries?: ProcessEntry[];
  /** Structured search context from this turn, used to resolve follow-up tool calls. */
  searchTurnContext?: SearchTurnContext;
  /** Structured Driver.js product tour generated by Tour Guide. */
  tourPlan?: GuidedTourPlan;
}

export type { GuidedTourPlan, GuidedTourStep, TourTargetDescriptor } from '../features/tours/driverTour';

/** Re-exported ProcessLog entry type so consumers can import it from `types`. */
export type { ProcessEntry, ProcessEntryKind, ProcessEntryStatus } from '../services/processLog';

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

export type WorkspaceFileKind = 'agents' | 'skill' | 'tool' | 'plugin' | 'hook' | 'memory';

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

export interface WorkspaceTool {
  path: string;
  directory: string;
  manifestName: string;
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
  tools: WorkspaceTool[];
  plugins: WorkspacePlugin[];
  hooks: WorkspaceHook[];
  memory: WorkspaceFile[];
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
