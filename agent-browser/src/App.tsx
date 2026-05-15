import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
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
  buildContextManagerToolInstructions,
  buildDebuggerToolInstructions,
  buildPlannerToolInstructions,
  buildResearcherToolInstructions,
  buildSecurityReviewToolInstructions,
  buildSteeringToolInstructions,
  buildMediaToolInstructions,
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
import {
  SymphonyActivityPanel,
  SymphonyWorkspaceApp,
} from './features/symphony/SymphonyOrchestrationPanel';
import { WorkflowCanvasRenderer } from '@agent-harness/ext-workflow-canvas';
// Unified per-turn process visualization surfaced via InlineProcess and
// ProcessPanel below.
import { MarkdownContent } from './utils/MarkdownContent';
import { getFaviconBadgeLabel, normalizeHostname } from './utils/favicon';
import { SharedChatModal, type SharedChatApi } from './shared-chat/SharedChatModal';
import { buildChatChannelOptions } from './services/chatChannels';
import {
  DEFAULT_SHARED_SESSION_CONTROL_STATE,
  buildSharedSessionControlPromptContext,
  formatSharedSessionPeerMessage,
  isSharedSessionControlState,
  recordSharedSessionControlEvent,
  type SharedSessionControlState,
} from './services/sharedSessionControl';
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
  areStagedRoutingChecksPassing,
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
  DEFAULT_ADVERSARY_AGENT_SETTINGS,
  isAdversaryAgentSettings,
  type AdversaryAgentSettings,
} from './services/adversaryAgent';
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
  DEFAULT_RUNTIME_PLUGIN_MANIFESTS,
  DEFAULT_RUNTIME_PLUGIN_SETTINGS,
  buildRuntimePluginPromptContext,
  buildRuntimePluginRuntime,
  isRuntimePluginSettings,
  type RuntimePluginInterceptionMode,
  type RuntimePluginRuntime,
  type RuntimePluginSettings,
} from './services/runtimePlugins';
import {
  DEFAULT_SCHEDULED_AUTOMATION_STATE,
  isScheduledAutomationState,
  updateScheduledAutomation,
  type ScheduledAutomation,
  type ScheduledAutomationCadence,
  type ScheduledAutomationNotificationRoute,
  type ScheduledAutomationReviewTrigger,
  type ScheduledAutomationState,
} from './services/scheduledAutomations';
import {
  DEFAULT_RUN_CHECKPOINT_STATE,
  buildCheckpointProcessEntry,
  buildCheckpointPromptContext,
  createRunCheckpoint,
  isRunCheckpointState,
  resumeRunCheckpoint,
  updateRunCheckpointPolicy,
  type RunCheckpoint,
  type RunCheckpointPolicy,
  type RunCheckpointState,
} from './services/runCheckpoints';
import {
  DEFAULT_BROWSER_AGENT_RUN_SDK_STATE,
  isBrowserAgentRunSdkState,
  type BrowserAgentRunSdkState,
} from './services/browserAgentRunSdk';
import { LocalLanguageModel } from './services/localLanguageModel';
import {
  DEFAULT_MEDIA_CAPABILITY_REQUIREMENTS,
  buildMediaCapabilityPrompt,
  planMediaCapabilities,
} from './services/mediaAgent';
import {
  buildN8nCapabilitySummary,
  buildServerlessWorkflowPreview,
  listN8nCapabilityAreas,
  type N8nCapabilityStatus,
} from './services/n8nCapabilities';
import {
  buildGraphKnowledgeContextPack,
  consolidateGraphKnowledge,
  createEmptyGraphKnowledgeState,
  exportGraphKnowledge,
  getGraphKnowledgeStats,
  importGraphKnowledge,
  ingestGraphKnowledgeSession,
  ingestGraphKnowledgeSkill,
  ingestGraphKnowledgeText,
  isGraphKnowledgeState,
  loadSampleGraphKnowledge,
  promoteGraphKnowledgeToHotMemory,
  searchGraphKnowledge,
  type GraphKnowledgeContextPack,
  type GraphKnowledgeSearchResult,
  type GraphKnowledgeState,
} from './services/graphKnowledge';
import { runParallelDelegationWorkflow, shouldRunParallelDelegation } from './services/parallelDelegationWorkflow';
import { runStagedToolPipeline, type StageMeta } from './services/stagedToolPipeline';
import { createSearchTurnContextSystemMessage } from './services/conversationSearchContext';
import { ProcessLog, type ProcessEntry, type ProcessEntryKind } from './services/processLog';
import { InlineProcess, ProcessPanel } from './features/process';
import {
  buildHarnessCoreSessionSnapshot,
  createHarnessCoreState,
  reduceHarnessCoreEvent,
  selectHarnessCoreSummary,
  type HarnessCoreSessionRuntime,
  type HarnessCoreState,
} from './services/harnessCore';
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
  getWorkspaceFileExtensionOwnership,
  getWorkspaceFileRemovalBlocker,
  isWorkspaceFileLockedByExtension,
  loadWorkspaceFiles,
  removeWorkspaceFile,
  removeWorkspaceFilesForExtensions,
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
  DEFAULT_INSTALLED_DEFAULT_EXTENSION_IDS,
  EXTENSION_MARKETPLACE_CATEGORIES,
  EXTENSION_MARKETPLACE_CATEGORY_LABELS,
  buildRuntimeExtensionPromptContext,
  createDefaultExtensionRuntime,
  getDefaultExtensionAvailability,
  getDefaultExtensionDependencyIds,
  getDefaultExtensionOpenFeatureFlagKey,
  getExtensionMarketplaceCategory,
  getInstalledDefaultExtensionDescriptors,
  groupDefaultExtensionsByMarketplaceCategory,
  isDefaultExtensionActivityFeature,
  normalizeDefaultExtensionIds,
  resolveDefaultExtensionDependencyPlan,
  resolveDefaultExtensionDependentIds,
  resolveEnabledDefaultExtensionIds,
  summarizeDefaultExtensionRuntime,
  type DefaultExtensionDescriptor,
  type DefaultExtensionOpenFeatureFlags,
  type DefaultExtensionRuntime,
} from './services/defaultExtensions';
import {
  DESIGN_STUDIO_DIRECTIONS,
  approveDesignStudioTokenRevision,
  buildDesignStudioArtifactFiles,
  createDesignStudioProjectArtifactInput,
  createDesignStudioApprovalComposition,
  createDesignStudioExportArtifact,
  createDesignStudioState,
  findDesignStudioProjectNameCollision,
  getDesignStudioApprovalSummary,
  getDesignStudioResearchInventory,
  publishDesignStudioSystem,
  requestDesignStudioTokenRevision,
  runDesignStudioCritique,
  selectDesignStudioDirection,
  updateDesignStudioBrief,
  type DesignStudioBrief,
  type DesignStudioApprovalComposition,
  type DesignStudioDirectionId,
  type DesignStudioProjectArtifactInput,
  type DesignStudioState,
  type DesignStudioTokenReviewItem,
  type DesignStudioArtifactFile,
} from '@agent-harness/ext-design-studio';
import {
  PORTABLE_DAEMON_SOURCE_DOWNLOAD,
  resolveLocalInferenceDaemonDownload,
  type DaemonDownloadChoice,
} from './services/windowsDaemonDownload';
import { buildArtifactWorktreeNodes, buildInstalledExtensionDriveNodes, buildMountedTerminalDriveNodes, buildWorkspaceCapabilityDriveNodes } from './services/virtualFilesystemTree';
import {
  buildArtifactPromptContext,
  createArtifact,
  createArtifactDownloadPayload,
  updateArtifactFiles,
  type AgentArtifact,
  type ArtifactFile,
} from './services/artifacts';
import {
  MARKDOWN_MERMAID_RENDERER_ID,
  MARKDOWN_PREVIEW_RENDERER_ID,
  resolveArtifactFileRenderer,
  type ArtifactFileRendererBinding,
} from './services/mediaRenderers';
import {
  buildWorkspaceSurfacePromptContext,
  isWorkspaceSurfacesByWorkspace,
  listWorkspaceSurfaceSummaries,
  type WorkspaceSurface,
} from './services/workspaceSurfaces';
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
  AI_POINTER_ACTIONS,
  DEFAULT_AI_POINTER_SETTINGS,
  buildAiPointerPrompt,
  captureAiPointerTarget,
  isAiPointerFeatureState,
  suggestAiPointerActions,
  type AiPointerActionId,
  type AiPointerFeatureState,
  type AiPointerSettings,
  type AiPointerTarget,
  type AiPointerTargetKind,
} from './services/aiPointer';
import {
  STORAGE_KEYS,
  isBooleanRecord,
  isArtifactContextBySession,
  isArtifactsByWorkspace,
  isChatMessagesBySession,
  isHarnessAppSpecRecord,
  isJsonRecord,
  isString,
  isStringArrayRecord,
  isStringRecord,
  isTreeNode,
  isWorkspaceViewStateRecord,
  loadJson,
  removeStoredRecordEntry,
  saveJson,
  useStoredState,
} from './services/sessionState';
import {
  buildPullRequestReview,
} from './services/prReviewUnderstanding';
import {
  buildRepoWikiPromptContext,
  buildRepoWikiSnapshot,
  isRepoWikiSnapshotsByWorkspace,
  searchRepoWikiSnapshot,
  type RepoWikiCitation,
  type RepoWikiSnapshot,
} from './services/repoWiki';
import {
  appendWorkspaceMemoryFact,
  deleteWorkspaceMemoryEntry,
  type WorkspaceMemoryScope,
} from './services/workspaceMemory';
import {
  DEFAULT_WORKSPACE_SKILL_POLICY_STATE,
  buildWorkspaceSkillPolicyInventory,
  buildWorkspaceSkillPolicyPromptContext,
  isWorkspaceSkillPolicyState,
  publishWorkspaceSkillDraft,
  type WorkspaceSkillPolicyInventory,
  type WorkspaceSkillPolicyState,
} from './services/workspaceSkillPolicies';
import {
  DEFAULT_MULTITASK_SUBAGENT_STATE,
  addMultitaskTask,
  attachMultitaskBranchSession,
  buildMultitaskBranchDispatch,
  buildMultitaskPromptContext,
  createMultitaskProject,
  createMultitaskSubagentState,
  isMultitaskSubagentState,
  promoteMultitaskBranch,
  reconcileMultitaskBranchSessionCompletions,
  reconcileMultitaskSubagentRuns,
  reduceMultitaskBranchLifecycle,
  requestMultitaskBranchChanges,
  selectMultitaskProject,
  selectMultitaskTask,
  type MultitaskApprovalActor,
  type MultitaskBranchLifecycleAction,
  type MultitaskBranchDispatch,
  type MultitaskSessionTranscriptMessage,
  type MultitaskSubagentState,
} from './services/multitaskSubagents';
import {
  DEFAULT_SYMPHONY_AUTOPILOT_SETTINGS,
  buildSymphonyHistoryEventSummaries,
  buildSymphonyHistorySessionSummaries,
  createSymphonyRuntimeSnapshot,
  isSymphonyAutopilotSettings,
  type SymphonyAutopilotSettings,
} from './services/symphonyRuntime';
import {
  DEFAULT_CONVERSATION_BRANCHING_STATE,
  buildConversationBranchPromptContext,
  canSubmitToConversationSession,
  commitConversationSubthread,
  createConversationBranchingState,
  getConversationMainSessionForSubthread,
  getConversationSubthreadForSession,
  isConversationBranchingRequest,
  isConversationBranchingState,
  summarizeConversationBranches,
  type ConversationBranchingState,
  type ConversationBranchSettings,
  type ConversationSubthread,
} from './services/conversationBranches';
import {
  DEFAULT_SHARED_AGENT_REGISTRY_STATE,
  buildSharedAgentCatalog,
  buildSharedAgentPromptContext,
  isSharedAgentRegistryState,
  publishSharedAgentDraft,
  type SharedAgentCatalog,
  type SharedAgentRegistryState,
} from './services/sharedAgents';
import {
  DEFAULT_BROWSER_WORKFLOW_SKILLS,
  buildBrowserWorkflowSkillPromptContext,
  discoverBrowserWorkflowSkills,
  installBrowserWorkflowSkill,
  suggestBrowserWorkflowSkills,
  type BrowserWorkflowSkillManifest,
} from './services/browserWorkflowSkills';
import {
  DEFAULT_SPEC_DRIVEN_DEVELOPMENT_SETTINGS,
  SPEC_FORMAT_LABELS,
  buildSpecDrivenDevelopmentPromptContext,
  createSpecWorkflowPlan,
  isSpecDrivenDevelopmentSettings,
  type SpecDrivenDevelopmentSettings,
  type SpecFormat,
  type SpecWorkflowPlan,
} from './services/specDrivenDevelopment';
import {
  DEFAULT_HARNESS_STEERING_STATE,
  buildHarnessSteeringInventory,
  buildHarnessSteeringPromptContext,
  createHarnessSteeringCorrection,
  isHarnessSteeringState,
  type HarnessSteeringInventory,
  type HarnessSteeringScope,
  type HarnessSteeringState,
} from './services/harnessSteering';
import {
  DEFAULT_HARNESS_EVOLUTION_SETTINGS,
  buildHarnessEvolutionPlan,
  buildHarnessEvolutionPromptContext,
  isHarnessEvolutionSettings,
  normalizeHarnessEvolutionSettings,
  type HarnessEvolutionPlan,
  type HarnessEvolutionSettings,
} from './services/harnessEvolution';
import {
  createPersistentMemoryGraphState,
  exportPersistentMemoryGraph,
  importPersistentMemoryGraph,
  ingestTextToMemoryGraph,
  isPersistentMemoryGraphState,
  loadSampleMemoryGraph,
  runMemoryGraphQuery,
  searchPersistentMemoryGraph,
  type MemoryGraphQueryResult,
  type MemoryGraphRetrievalResult,
  type PersistentMemoryGraphState,
} from './services/persistentMemoryGraph';
import {
  DEFAULT_SESSION_CHAPTER_STATE,
  buildContextManagedMessages,
  buildContextManagedTranscriptItems,
  buildContextManagerSnapshot,
  buildSessionCompressionPromptContext,
  isChapteredSessionState,
  projectSessionChapters,
  updateSessionChapterPolicy,
  type ChapteredSessionState,
  type SessionChapterPolicy,
} from './services/sessionChapters';
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
  buildWorkspaceNodeMap,
  countTabs,
  createBrowserTab,
  createInitialRoot,
  createSessionNode,
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
  groupSessionNodeInWorkspace,
  listWorkspaceSessionNodes,
  normalizeWorkspaceViewEntry,
  removeNodeById,
  renderPaneIdForNode,
  syncWorkspaceArtifactNodes,
  syncWorkspaceDashboardNodes,
  totalMemoryMB,
  workspaceViewStateEquals,
  type FlatTreeItem,
  type WorkspaceViewState,
} from './services/workspaceTree';
import {
  buildWorkspaceHistoryGraph,
  type WorkspaceHistoryGraph,
  type WorkspaceHistoryRow,
  type WorkspaceHistorySessionInput,
} from './services/workspaceHistoryGraph';
import {
  isWorkspaceFileCrdtHistoriesByWorkspace,
  listWorkspaceFileCrdtHistories,
  materializeWorkspaceFileVersion,
  recordWorkspaceFileCrdtChanges,
  type WorkspaceFileCrdtHistoriesByWorkspace,
  type WorkspaceFileCrdtHistory,
} from './services/workspaceFileCrdtHistory';
import {
  DEFAULT_WORKSPACE_ACTION_HISTORY_STATE,
  isWorkspaceActionHistoryState,
  moveWorkspaceActionHistoryCursor,
  recordWorkspaceActionTransition,
  type WorkspaceActionHistoryDirection,
  type WorkspaceActionHistoryState,
  type WorkspaceActionSnapshot,
} from './services/workspaceActionHistory';
import {
  createProjectWorkspace,
  listProjectSummaries,
  nextProjectColor,
} from './services/projects';
import {
  buildActiveSessionFilesystemEntries,
  buildActiveWorktreeItems,
  readWorktreeContextMenuState,
  readWorktreeRenderPaneState,
  toggleWorktreeRenderPaneState,
  type WorkspaceContextMenuState,
} from './services/workspaceMcpWorktree';
import { deriveSessionTitle } from './services/sessionTitles';
import { moveRenderPaneOrder, orderRenderPanes } from './services/workspaceMcpPanes';
import { planRenderPaneRows } from './services/renderPaneLayout';
import { HarnessDashboardPanel } from './features/harness-ui/HarnessDashboardPanel';
import { HarnessWidgetEditorPanel } from './features/harness-ui/HarnessWidgetEditorPanel';
import {
  addHarnessDashboardWidget,
  applyHarnessElementPatch,
  buildHarnessPromptContextRows,
  createDefaultHarnessAppSpec,
  listDashboardWidgets,
  listEditableHarnessElements,
} from './features/harness-ui/harnessSpec';
import {
  regenerateHarnessAppSpec,
  restoreDefaultHarnessAppSpec,
} from './features/harness-ui/harnessRegeneration';
import { createPromptedWidgetDocument, deriveWidgetTitleFromPrompt } from './features/harness-ui/widgetComponents';
import type { HarnessAppSpec, HarnessElement, HarnessElementPatch, JsonValue, WidgetPosition } from './features/harness-ui/types';
import type { HarnessKnowledgeSummary } from './features/harness-ui/HarnessJsonRenderer';
import { createUniqueId } from './utils/uniqueId';
import { DEFAULT_TOOL_DESCRIPTORS, buildDefaultToolInstructions, createDefaultTools, selectToolDescriptorsByIds, selectToolsByIds, type ToolDescriptor } from './tools';
import type { BrowserNavHistory, BusEntryStep, ChatMessage, HFModel, HistorySession, Identity, IdentityPermissions, NodeMetadata, ReasoningStep, SearchTurnContext, TreeNode, VoterStep, WorkspaceCapabilities, WorkspaceFile, WorkspaceFileKind, WorkspacePlugin } from './types';
import type { CliHistoryEntry } from './tools/types';
import { installModelContext, ModelContext } from 'webmcp';

type ToastState = { msg: string; type: 'info' | 'success' | 'error' | 'warning' } | null;
type ClipboardEntry = { id: string; text: string; label: string; timestamp: number };
type SidebarPanel = 'workspaces' | 'symphony' | 'wiki' | 'history' | 'extensions' | 'models' | 'settings' | 'account';
type RepoWikiView = 'pages' | 'graph' | 'memory' | 'chat' | 'sources';
type DashboardPanel = { type: 'dashboard'; workspaceId: string };
type WidgetEditorPanel = { type: 'widget-editor'; workspaceId: string; widgetId: string };
type BrowserPanel = { type: 'browser'; tab: TreeNode };
type SessionPanel = { type: 'session'; id: string };
type FilePanel = { type: 'file'; file: WorkspaceFile };
type ArtifactPanel = { type: 'artifact'; artifact: AgentArtifact; file: ArtifactFile | null };
type Panel = DashboardPanel | WidgetEditorPanel | BrowserPanel | SessionPanel | FilePanel | ArtifactPanel;
type PanelDragHandleProps = React.HTMLAttributes<HTMLElement>;
type WidgetSessionBinding = {
  widget: HarnessElement;
  onSavePatch: (patch: HarnessElementPatch) => void;
};
type SessionMcpRuntimeState = HarnessCoreSessionRuntime;
type SessionMcpController = {
  getRuntimeState: () => SessionMcpRuntimeState;
  writeSession: (input: WorkspaceMcpWriteSessionInput) => Promise<void>;
};

const EMPTY_AGENT_ARTIFACTS: AgentArtifact[] = [];
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
  ['workspaces', 'layers', 'Projects'],
  ['symphony', 'share', 'Symphony'],
  ['wiki', 'bookmark', 'Wiki'],
  ['history', 'clock', 'History'],
  ['extensions', 'puzzle', 'Extensions'],
  ['models', 'cpu', 'Models'],
] as const;
const SECONDARY_NAV = [
  ['settings', 'settings', 'Settings'],
  ['account', 'user', 'Account'],
] as const;
const PANEL_SHORTCUT_ORDER: SidebarPanel[] = ['workspaces', 'symphony', 'wiki', 'history', 'extensions', 'models', 'settings', 'account'];
const SIDEBAR_PANEL_META: Record<SidebarPanel, { label: string; icon: keyof typeof icons }> = {
  workspaces: { label: 'Projects', icon: 'layers' },
  symphony: { label: 'Symphony', icon: 'share' },
  wiki: { label: 'Wiki', icon: 'bookmark' },
  history: { label: 'History', icon: 'clock' },
  extensions: { label: 'Extensions', icon: 'puzzle' },
  models: { label: 'Models', icon: 'cpu' },
  settings: { label: 'Settings', icon: 'settings' },
  account: { label: 'Account', icon: 'user' },
};
const REPO_WIKI_VIEWS: Array<{ id: RepoWikiView; label: string; description: string; icon: keyof typeof icons }> = [
  { id: 'pages', label: 'Wiki Pages', description: 'Generated pages, links, and search', icon: 'file' },
  { id: 'graph', label: 'Knowledge Graph', description: 'Relationships, edges, and isolated chunks', icon: 'share' },
  { id: 'memory', label: 'Memory', description: 'View and manage stored memories', icon: 'slidersHorizontal' },
];
const WORKSPACE_SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    items: [
      { keys: '↑ / ↓', description: 'Move cursor' },
      { keys: 'Ctrl+↑/↓', description: 'Move cursor without changing selection' },
      { keys: '→', description: 'Expand folder / enter' },
      { keys: '←', description: 'Collapse folder / go to parent' },
      { keys: 'Alt+↑ / Backspace', description: 'Go to parent' },
      { keys: 'Home / End', description: 'First / last item' },
      { keys: 'F5', description: 'Refresh tree state' },
    ],
  },
  {
    title: 'Selection',
    items: [
      { keys: 'Space / Ctrl+Space', description: 'Toggle selection' },
      { keys: 'Shift+↑/↓', description: 'Extend selection' },
      { keys: 'Ctrl+A', description: 'Select all visible' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { keys: 'Enter', description: 'Toggle folder / open tab' },
      { keys: 'F2', description: 'Rename item' },
      { keys: 'Alt+Enter', description: 'Properties' },
      { keys: 'Shift+F10 / Menu', description: 'Context menu' },
      { keys: 'Delete / Ctrl+D', description: 'Delete selected items' },
      { keys: 'Shift+Delete', description: 'Delete selected items' },
      { keys: 'Ctrl+C', description: 'Copy selected references' },
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
    title: 'Project switching',
    items: [
      { keys: 'Ctrl+1-9', description: 'Jump to project N' },
      { keys: 'Ctrl+Alt+←/→', description: 'Previous / next project' },
      { keys: 'Ctrl+Alt+N', description: 'New project' },
      { keys: 'Double-click pill', description: 'Rename project' },
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
  bookmark: Bookmark,
  share: Share2,
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
  folderInput: FolderInput,
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
  canvas: Square,
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

function readHarnessElementTitle(element: HarnessElement | null | undefined, fallback: string) {
  const title = element?.props?.title;
  return typeof title === 'string' && title.trim() ? title.trim() : fallback;
}

function compactWidgetText(text: string, maxLength = 72) {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}...`;
}

function titleFromWidgetEditRequest(text: string, fallback: string) {
  const quoted = text.match(/(?:title|name|label)\s+(?:to|as)\s+["']([^"']+)["']/i)?.[1];
  if (quoted?.trim()) return compactWidgetText(quoted, 44);
  const colon = text.match(/(?:title|name|label)\s*:\s*([^\n]+)/i)?.[1];
  if (colon?.trim()) return compactWidgetText(colon.split(/[.;]/u)[0] ?? colon, 44);
  if (/knowledge|memory|steering|graph/i.test(text)) return 'Knowledge';
  if (/summary|session/i.test(text)) return 'Session summary';
  return fallback;
}

function buildWidgetPreviewPatch(widget: HarnessElement, requestedChange: string): NonNullable<ChatMessage['widgetPreview']> {
  const currentTitle = readHarnessElementTitle(widget, widget.id);
  const nextTitle = titleFromWidgetEditRequest(requestedChange, currentTitle);
  const summary = compactWidgetText(requestedChange, 140);
  return {
    widgetId: widget.id,
    widgetTitle: currentTitle,
    requestedChange,
    patch: {
      elementId: widget.id,
      props: {
        title: nextTitle,
        summary,
      },
    },
    status: 'pending',
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

type McpElicitationField = NonNullable<NonNullable<ChatMessage['cards']>[number]['fields']>[number];

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
    fields.map((field) => [field.id, card.response?.[field.id] ?? initialElicitationFieldValue(field)]),
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
        <McpElicitationFieldControl
          key={field.id}
          field={field}
          value={values[field.id] ?? ''}
          onChange={(value) => setValues((current) => ({
            ...current,
            [field.id]: value,
          }))}
        />
      ))}
      <button type="submit" className="elicitation-submit">Submit requested info</button>
    </form>
  );
}

function initialElicitationFieldValue(field: McpElicitationField): string {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === 'checkbox') return 'false';
  return '';
}

function McpElicitationFieldControl({
  field,
  value,
  onChange,
}: {
  field: McpElicitationField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === 'textarea') {
    return (
      <label className="elicitation-field">
        <span>{field.label}</span>
        <textarea
          aria-label={field.label}
          value={value}
          placeholder={field.placeholder}
          required={field.required}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label className="elicitation-field">
        <span>{field.label}</span>
        <select
          aria-label={field.label}
          value={value}
          required={field.required}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="" disabled>{field.placeholder ?? 'Select an option'}</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="elicitation-field elicitation-checkbox-field">
        <input
          aria-label={field.label}
          type="checkbox"
          checked={value === 'true'}
          required={field.required}
          onChange={(event) => onChange(event.target.checked ? 'true' : 'false')}
        />
        <span>{field.label}</span>
      </label>
    );
  }

  return (
    <label className="elicitation-field">
      <span>{field.label}</span>
      <input
        aria-label={field.label}
        type={field.type === 'number' ? 'number' : 'text'}
        value={value}
        placeholder={field.placeholder}
        required={field.required}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
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
  onSaveWidgetPreview,
  onDiscardWidgetPreview,
  onCopyMessage,
}: {
  message: ChatMessage;
  agentName: string;
  activitySelected?: boolean;
  onOpenActivity?: (messageId: string) => void;
  onSubmitElicitation?: (messageId: string, requestId: string, values: Record<string, string>) => void;
  onSubmitSecret?: (messageId: string, requestId: string, input: { name: string; value: string }) => void;
  onSaveWidgetPreview?: (messageId: string) => void;
  onDiscardWidgetPreview?: (messageId: string) => void;
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
      {message.widgetPreview ? (
        <div className={`widget-preview-card widget-preview-card--${message.widgetPreview.status}`} aria-label={`${message.widgetPreview.widgetTitle} widget preview`}>
          <div className="widget-preview-card-header">
            <span className="tool-call-label">Widget preview</span>
            <span className="badge">{message.widgetPreview.status}</span>
          </div>
          <p>{message.widgetPreview.requestedChange}</p>
          <dl>
            {Object.entries(message.widgetPreview.patch.props ?? {}).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
          {message.widgetPreview.status === 'pending' ? (
            <div className="widget-preview-card-actions">
              <button type="button" className="primary-button" onClick={() => onSaveWidgetPreview?.(message.id)}>
                Save changes
              </button>
              <button type="button" className="secondary-button" onClick={() => onDiscardWidgetPreview?.(message.id)}>
                Discard
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {content ? (
        (isUser || isTerminalMessage || isError)
          ? <div className={`message-bubble${isTerminalMessage ? ' terminal-bubble' : ''}${isError ? ' message-bubble-error' : ''}`}>{content}{isStreaming && !message.isThinking && <span className="stream-cursor" />}</div>
          : <div className={`message-bubble message-bubble-markdown${isError ? ' message-bubble-error' : ''}`}><MarkdownContent content={content} className="markdown-content" />{isStreaming && !message.isThinking && <span className="stream-cursor" />}</div>
      ) : null}
    </div>
  );
}

function ConversationSubthreadBanner({
  subthread,
  mainSessionId,
  onBack,
}: {
  subthread: ConversationSubthread;
  mainSessionId: string | null;
  onBack: () => void;
}) {
  const isMerged = subthread.status === 'merged';
  return (
    <div className={`conversation-subthread-banner${isMerged ? ' is-merged' : ''}`} aria-label="Conversation subthread">
      <button
        type="button"
        className="toolbar-button"
        aria-label="Back to main conversation"
        onClick={onBack}
        disabled={!mainSessionId}
      >
        <Icon name="arrowLeft" size={13} />
        <span>Back</span>
      </button>
      <div>
        <strong>{isMerged ? 'Merged subthread read-only' : 'Subthread conversation'}</strong>
        <p>{subthread.branchName}</p>
      </div>
      <span className={`badge${isMerged ? ' connected' : ''}`}>{subthread.status}</span>
      <small>{isMerged ? 'This branch has merged back to main.' : 'Steering messages update this running subthread.'}</small>
    </div>
  );
}

function ConversationSubthreadTranscripts({
  state,
  messagesBySession,
  agentName,
  onOpenConversationSession,
  onOpenActivity,
  onSubmitElicitation,
  onSubmitSecret,
  onCopyMessage,
}: {
  state: ConversationBranchingState;
  messagesBySession: Record<string, ChatMessage[]>;
  agentName: string;
  onOpenConversationSession?: (sessionId: string) => void;
  onOpenActivity?: (messageId: string) => void;
  onSubmitElicitation?: (messageId: string, requestId: string, values: Record<string, string>) => void;
  onSubmitSecret?: (messageId: string, requestId: string, input: { name: string; value: string }) => void;
  onCopyMessage?: (input: { content: string; senderLabel: string; format: ClipboardCopyFormat }) => Promise<void>;
}) {
  const subthreads = state.subthreads.filter((subthread) => subthread.sessionId);
  if (!state.enabled || !subthreads.length) return null;

  return (
    <section className="conversation-subthread-transcripts" aria-label="Subthread transcripts">
      <div className="conversation-subthread-transcripts-header">
        <strong>Subthread transcripts</strong>
        <span>{subthreads.length} branch{subthreads.length === 1 ? '' : 'es'}</span>
      </div>
      {subthreads.map((subthread) => {
        const sessionMessages = messagesBySession[subthread.sessionId ?? ''] ?? [];
        const visibleMessages = sessionMessages.filter((message) => message.role !== 'system');
        return (
          <article key={subthread.id} className="conversation-subthread-transcript-card">
            <div className="history-card-header">
              <div>
                <h3>{subthread.title}</h3>
                <p className="muted">{subthread.branchName}</p>
              </div>
              <span className={`badge${subthread.status === 'merged' ? ' connected' : ''}`}>{subthread.status}</span>
            </div>
            <p className="history-preview">{subthread.summary}</p>
            <button
              type="button"
              className="toolbar-button"
              aria-label={`Open ${subthread.branchName}`}
              onClick={() => subthread.sessionId ? onOpenConversationSession?.(subthread.sessionId) : undefined}
              disabled={!subthread.sessionId}
            >
              <Icon name="messageSquare" size={13} />
              <span>Open branch session</span>
            </button>
            <div className="conversation-subthread-message-list">
              {visibleMessages.length ? visibleMessages.map((message) => (
                <ChatMessageView
                  key={message.id}
                  message={message}
                  agentName={agentName}
                  onOpenActivity={onOpenActivity}
                  onSubmitElicitation={onSubmitElicitation}
                  onSubmitSecret={onSubmitSecret}
                  onCopyMessage={onCopyMessage}
                />
              )) : <p className="muted">No steering messages yet.</p>}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function inferAiPointerTargetKindForTab(tab: TreeNode): AiPointerTargetKind {
  const source = `${tab.name} ${tab.url ?? ''}`.toLowerCase();
  if (/\b(recipe|ingredient|cook|kitchen)\b/.test(source)) return 'recipe';
  if (/\b(map|maps|place|route|travel|restaurant|museum|campus)\b/.test(source)) return 'place';
  if (/\b(image|photo|moodboard|gallery|visual)\b/.test(source)) return 'image';
  if (/\b(product|shop|store|pricing|cart)\b/.test(source)) return 'product';
  if (source.startsWith('workflow') || source.includes('agent-browser://')) return 'object';
  return 'screen-region';
}

function PageOverlay({
  tab,
  aiPointerSettings,
  onAiPointerCapture,
  onAiPointerPrompt,
  onClose,
  onContextMenu,
  dragHandleProps,
}: {
  tab: TreeNode;
  aiPointerSettings: AiPointerSettings;
  onAiPointerCapture?: (target: AiPointerTarget) => void;
  onAiPointerPrompt?: (prompt: string) => void;
  onClose: () => void;
  onContextMenu?: (x: number, y: number) => void;
  dragHandleProps?: PanelDragHandleProps;
}) {
  const src = tab.url ?? '';
  const [pointerArmed, setPointerArmed] = useState(false);
  const [pointerTarget, setPointerTarget] = useState<AiPointerTarget | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<AiPointerActionId>('explain-this');
  const [pointerCommand, setPointerCommand] = useState('');
  const suggestedActions = pointerTarget ? suggestAiPointerActions(pointerTarget, aiPointerSettings) : [];
  const selectedAction = suggestedActions.find((action) => action.id === selectedActionId) ?? suggestedActions[0] ?? AI_POINTER_ACTIONS['explain-this'];

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
        <div className="panel-titlebar-actions">
          {aiPointerSettings.enabled ? (
            <button
              type="button"
              className={`icon-button${pointerArmed ? ' is-active' : ''}`}
              aria-label={pointerArmed ? `Disable AI pointer for ${tab.name}` : `Enable AI pointer for ${tab.name}`}
              title={pointerArmed ? 'Disable AI pointer' : 'Enable AI pointer'}
              data-tooltip="AI Pointer"
              onClick={() => setPointerArmed((current) => !current)}
              {...panelTitlebarControlProps}
            >
              <Icon name="sparkles" size={13} />
            </button>
          ) : null}
          <button type="button" className="icon-button panel-close-button" aria-label="Close page overlay" onClick={onClose} {...panelTitlebarControlProps}><Icon name="x" size={12} /></button>
        </div>
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
        {aiPointerSettings.enabled && pointerArmed ? (
          <button
            type="button"
            className="ai-pointer-hit-target"
            aria-label={`AI pointer target area for ${tab.name}`}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const width = rect.width || 1024;
              const height = rect.height || 768;
              const point = {
                x: rect.width ? event.clientX - rect.left : event.clientX,
                y: rect.height ? event.clientY - rect.top : event.clientY,
              };
              const nextTarget = captureAiPointerTarget({
                tab: {
                  id: tab.id,
                  title: tab.name,
                  url: tab.url ?? '',
                },
                viewport: { width, height },
                point,
                targetKind: inferAiPointerTargetKindForTab(tab),
                semanticLabel: tab.name,
              });
              setPointerTarget(nextTarget);
              setSelectedActionId('explain-this');
              onAiPointerCapture?.(nextTarget);
            }}
          >
            <span className="ai-pointer-reticle" aria-hidden="true" />
            <span className="ai-pointer-instruction">Point anywhere on the page</span>
          </button>
        ) : null}
        {aiPointerSettings.enabled && pointerTarget ? (
          <section className="ai-pointer-panel" aria-label={`AI pointer actions for ${tab.name}`}>
            <div className="ai-pointer-panel-heading">
              <span>
                <strong>AI Pointer</strong>
                <small>{Math.round(pointerTarget.coordinates.xPercent)}% / {Math.round(pointerTarget.coordinates.yPercent)}% on {pointerTarget.targetKind}</small>
              </span>
              <button type="button" className="icon-button" aria-label="Clear AI pointer target" onClick={() => setPointerTarget(null)}>
                <Icon name="x" size={12} />
              </button>
            </div>
            <div className="ai-pointer-actions" aria-label="AI pointer quick actions">
              {suggestedActions.slice(0, 6).map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={`chip${selectedAction.id === action.id ? ' active' : ''}`}
                  aria-pressed={selectedAction.id === action.id}
                  onClick={() => setSelectedActionId(action.id)}
                >
                  {action.label}
                </button>
              ))}
            </div>
            <label className="shared-input-shell ai-pointer-command">
              <Icon name="sparkles" size={13} color="#7dd3fc" />
              <input
                aria-label="AI pointer command"
                value={pointerCommand}
                onChange={(event) => setPointerCommand(event.target.value)}
                placeholder="Ask about this"
              />
            </label>
            <button
              type="button"
              className="primary-button ai-pointer-draft-button"
              aria-label="Draft AI pointer prompt"
              onClick={() => {
                const prompt = buildAiPointerPrompt({
                  actionId: selectedAction.id,
                  command: pointerCommand || selectedAction.prompt,
                  target: pointerTarget,
                  settings: aiPointerSettings,
                });
                onAiPointerPrompt?.(prompt);
              }}
            >
              <Icon name="send" size={13} />
              <span>Draft</span>
            </button>
          </section>
        ) : null}
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
  const extensionOwnership = getWorkspaceFileExtensionOwnership(file);
  const removalBlocker = getWorkspaceFileRemovalBlocker(file);

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
    if (removalBlocker && editorPath.trim() !== file.path) {
      setValidationMessage(removalBlocker);
      return;
    }
    const nextFile: WorkspaceFile = {
      ...file,
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
              <button
                type="button"
                className="secondary-button file-editor-inline-button"
                aria-label="Edit file name"
                title={removalBlocker ?? 'Edit file name'}
                disabled={Boolean(removalBlocker)}
                onClick={() => setIsPathEditing(true)}
              >
                Edit
              </button>
            )}
            <button type="button" className="file-editor-action file-editor-action-save" aria-label="Save file" title="Save file" onClick={handleSave}><Icon name="save" size={14} /></button>
            <button
              type="button"
              className="file-editor-action file-editor-action-delete"
              aria-label="Delete file"
              title={removalBlocker ?? 'Delete file'}
              disabled={Boolean(removalBlocker)}
              onClick={() => {
                if (removalBlocker) {
                  onToast({ msg: removalBlocker, type: 'warning' });
                  return;
                }
                onDelete(file.path);
                onClose();
                onToast({ msg: `Removed ${file.path}`, type: 'info' });
              }}
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        </div>
        {extensionOwnership?.locked ? <p className="file-editor-error">{removalBlocker}</p> : null}
        {validationMessage ? <p className="file-editor-error">{validationMessage}</p> : null}
        <label className="file-editor-field file-editor-content-field">
          <span className="sr-only">Content</span>
          <textarea aria-label="Workspace file content" value={editorContent} onChange={(event) => { setEditorContent(event.target.value); setValidationMessage(null); }} />
        </label>
      </div>
    </section>
  );
}

function ArtifactViewerPanel({
  artifact,
  file,
  extensionRenderers,
  onSelectFile,
  onDownload,
  onAttach,
  onOpenSession,
  onClose,
  dragHandleProps,
}: {
  artifact: AgentArtifact;
  file: ArtifactFile | null;
  extensionRenderers: DefaultExtensionRuntime['renderers'];
  onSelectFile: (filePath: string) => void;
  onDownload: () => void;
  onAttach: () => void;
  onOpenSession: () => void;
  onClose: () => void;
  dragHandleProps?: PanelDragHandleProps;
}) {
  const rendererBinding = resolveArtifactFileRenderer(file, { extensionRenderers });
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
            <span className="file-editor-path-text">{file ? `//workspace/artifacts/${artifact.id}/${file.path}` : `//workspace/artifacts/${artifact.id}`}</span>
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
          <ArtifactRendererContent
            artifact={artifact}
            file={file}
            binding={rendererBinding}
            onOpenSession={onOpenSession}
          />
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

function ArtifactRendererContent({
  artifact,
  file,
  binding,
  onOpenSession,
}: {
  artifact: AgentArtifact;
  file: ArtifactFile;
  binding: ArtifactFileRendererBinding;
  onOpenSession: () => void;
}) {
  const [showRawSource, setShowRawSource] = useState(false);
  useEffect(() => {
    setShowRawSource(false);
  }, [artifact.id, file.path]);

  if (binding.kind === 'native') {
    if (binding.nativeKind === 'text') {
      return (
        <section className="artifact-native-text-renderer" role="region" aria-label="Native text renderer">
          <pre>{file.content}</pre>
        </section>
      );
    }
    if (binding.nativeKind === 'image') {
      return (
        <img
          className="artifact-native-media"
          alt={`${artifact.title}: ${file.path}`}
          title={`${artifact.title}: ${file.path}`}
          src={artifactFileDataUrl(file)}
        />
      );
    }
    if (binding.nativeKind === 'audio') {
      return (
        <audio
          className="artifact-native-media"
          title={`${artifact.title}: ${file.path}`}
          src={artifactFileDataUrl(file)}
          controls
        />
      );
    }
    if (binding.nativeKind === 'video') {
      return (
        <video
          className="artifact-native-media"
          title={`${artifact.title}: ${file.path}`}
          src={artifactFileDataUrl(file)}
          controls
        />
      );
    }
    return (
      <iframe
        className="artifact-preview-frame"
        title={`${artifact.title}: ${file.path}`}
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        src={nativeIframeSource(file)}
        srcDoc={nativeIframeSourceDoc(file)}
      />
    );
  }

  if (binding.kind === 'plugin' && (binding.rendererId === MARKDOWN_PREVIEW_RENDERER_ID || binding.rendererId === MARKDOWN_MERMAID_RENDERER_ID)) {
    const enableMermaid = binding.rendererId === MARKDOWN_MERMAID_RENDERER_ID;
    return (
      <section className={`artifact-markdown-renderer${enableMermaid ? ' artifact-markdown-renderer--mermaid' : ''}`} role="region" aria-label="Markdown preview renderer">
        <MarkdownContent content={file.content} className="markdown-content artifact-markdown-content" enableMermaid={enableMermaid} />
      </section>
    );
  }

  return (
    <section className="artifact-renderer-fallback" role="region" aria-label={binding.kind === 'plugin' ? 'Plugin media renderer' : 'Bounded artifact chat'}>
      <div className="artifact-renderer-fallback-copy">
        <strong>{binding.kind === 'plugin' ? binding.label : 'Chat session'}</strong>
        {binding.kind === 'plugin' ? (
          <p>
            Renderer <code>{binding.rendererId}</code> is supplied by an installed extension through <code>{binding.implementationRuntime}</code>.
          </p>
        ) : (
          <p>{binding.reason}</p>
        )}
      </div>
      <div className="artifact-renderer-fallback-actions">
        {binding.kind === 'bounded-chat' ? (
          <button type="button" className="secondary-button" onClick={onOpenSession}>Open bounded chat for artifact</button>
        ) : null}
        <button
          type="button"
          className="secondary-button"
          aria-expanded={showRawSource}
          onClick={() => setShowRawSource((current) => !current)}
        >
          {showRawSource ? 'Hide raw artifact source' : 'Show raw artifact source'}
        </button>
      </div>
      {showRawSource ? <ArtifactRawSource file={file} /> : null}
    </section>
  );
}

function ArtifactRawSource({ file }: { file: ArtifactFile }) {
  return (
    <label className="file-editor-field file-editor-content-field artifact-source-field">
      <span className="sr-only">Artifact content</span>
      <textarea aria-label="Artifact content" value={file.content} readOnly />
    </label>
  );
}

function nativeIframeSourceDoc(file: ArtifactFile): string | undefined {
  const mediaType = file.mediaType?.toLowerCase() ?? '';
  if (mediaType === 'text/html' || mediaType === 'image/svg+xml') return file.content;
  return undefined;
}

function nativeIframeSource(file: ArtifactFile): string | undefined {
  return nativeIframeSourceDoc(file) ? undefined : artifactFileDataUrl(file);
}

function artifactFileDataUrl(file: ArtifactFile): string {
  const mediaType = file.mediaType ?? 'text/plain';
  return `data:${mediaType};charset=utf-8,${encodeURIComponent(file.content)}`;
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

function isMultitaskSubagentRequest(text: string): boolean {
  const lowered = text.toLowerCase();
  return /(symphony|multitask|subagents?|sub-agents?|parallel|worktrees?|branch isolation|delegate)/.test(lowered)
    && /(split|parallel|delegate|branch|worktree|isolate|compare|promote)/.test(lowered);
}

function ChatPanel({
  installedModels,
  copilotState,
  cursorState,
  codexState,
  pendingSearch,
  pendingSessionPrompt,
  pendingAiPointerPrompt,
  onSearchConsumed,
  onPendingSessionPromptConsumed,
  onAiPointerPromptConsumed,
  onToast,
  workspaceId,
  workspaceName,
  workspaceFiles,
  sessionSettingsContent,
  artifactPromptContext,
  repoWikiPromptContext,
  runCheckpointPromptContext,
  runCheckpointState,
  onRunCheckpointStateChange,
  sessionChapterState,
  onSessionChapterStateChange,
  multitaskPromptContext,
  attachedArtifactCount,
  workspaceCapabilities,
  browserWorkflowSkills,
  specDrivenDevelopmentSettings,
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
  adversaryAgentSettings,
  securityReviewAgentSettings,
  workspaceSkillPolicyInventory,
  sharedAgentCatalog,
  harnessSteeringInventory,
  harnessEvolutionSettings,
  partnerAgentControlPlaneSettings,
  runtimePluginSettings,
  onPartnerAgentAuditEntry,
  secretSettings,
  onSessionMcpControllerChange,
  onSessionRuntimeChange,
  onMultitaskRequest,
  conversationBranchPromptContext,
  conversationBranchingState,
  onConversationBranchRequest,
  onOpenConversationSession,
  onConversationSubthreadSteering,
  onSessionTitleSuggestion,
  widgetBinding,
  dragHandleProps,
}: {
  installedModels: HFModel[];
  copilotState: CopilotRuntimeState;
  cursorState: CursorRuntimeState;
  codexState: CodexRuntimeState;
  pendingSearch: string | null;
  pendingSessionPrompt?: string | null;
  pendingAiPointerPrompt: string | null;
  onSearchConsumed: () => void;
  onPendingSessionPromptConsumed?: (prompt: string) => void;
  onAiPointerPromptConsumed: () => void;
  onToast: (toast: Exclude<ToastState, null>) => void;
  workspaceId: string;
  workspaceName: string;
  workspaceFiles: WorkspaceFile[];
  sessionSettingsContent?: string | null;
  artifactPromptContext?: string;
  repoWikiPromptContext?: string;
  runCheckpointPromptContext?: string;
  runCheckpointState: RunCheckpointState;
  onRunCheckpointStateChange: (state: RunCheckpointState) => void;
  sessionChapterState: ChapteredSessionState;
  onSessionChapterStateChange: (state: ChapteredSessionState) => void;
  multitaskPromptContext?: string;
  attachedArtifactCount?: number;
  workspaceCapabilities: WorkspaceCapabilities;
  browserWorkflowSkills: BrowserWorkflowSkillManifest[];
  specDrivenDevelopmentSettings: SpecDrivenDevelopmentSettings;
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
  adversaryAgentSettings: AdversaryAgentSettings;
  securityReviewAgentSettings: SecurityReviewAgentSettings;
  workspaceSkillPolicyInventory: WorkspaceSkillPolicyInventory;
  sharedAgentCatalog: SharedAgentCatalog;
  harnessSteeringInventory: HarnessSteeringInventory;
  harnessEvolutionSettings: HarnessEvolutionSettings;
  partnerAgentControlPlaneSettings: PartnerAgentControlPlaneSettings;
  runtimePluginSettings: RuntimePluginSettings;
  onPartnerAgentAuditEntry?: (entry: PartnerAgentAuditEntry) => void;
  secretSettings: SecretManagementSettings;
  onSessionMcpControllerChange?: (sessionId: string, controller: SessionMcpController | null) => void;
  onSessionRuntimeChange?: (sessionId: string, runtime: SessionMcpRuntimeState | null) => void;
  onMultitaskRequest?: (request: string, options?: { openPanel?: boolean }) => void;
  conversationBranchPromptContext?: string;
  conversationBranchingState: ConversationBranchingState;
  onConversationBranchRequest?: (request: string, sessionId: string) => void;
  onOpenConversationSession?: (sessionId: string) => void;
  onConversationSubthreadSteering?: (subthreadId: string, sessionId: string, text: string, messageIds: string[]) => void;
  onSessionTitleSuggestion?: (sessionId: string, title: string) => void;
  widgetBinding?: WidgetSessionBinding | null;
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
  const [sharedSessionControlState, setSharedSessionControlState] = useStoredState<SharedSessionControlState>(
    localStorageBackend,
    STORAGE_KEYS.sharedSessionControlState,
    isSharedSessionControlState,
    DEFAULT_SHARED_SESSION_CONTROL_STATE,
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
  const [expandedContextChapterIds, setExpandedContextChapterIds] = useState<Record<string, boolean>>({});
  const sharedChatLifecycleKeyRef = useRef<string | null>(null);
  const showBash = activeMode === 'terminal';
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const terminalInputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const sharedChatApiRef = useRef<SharedChatApi | null>(null);
  const consumedPendingSearchRef = useRef<string | null>(null);
  const consumedPendingSessionPromptRef = useRef<string | null>(null);
  const consumedAiPointerPromptRef = useRef<string | null>(null);
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
  const activeConversationSubthread = useMemo(
    () => getConversationSubthreadForSession(conversationBranchingState, activeChatSessionId),
    [activeChatSessionId, conversationBranchingState],
  );
  const activeConversationMainSessionId = useMemo(
    () => getConversationMainSessionForSubthread(conversationBranchingState, activeChatSessionId),
    [activeChatSessionId, conversationBranchingState],
  );
  const activeConversationSessionCanSubmit = canSubmitToConversationSession(conversationBranchingState, activeChatSessionId);
  const locationPromptContext = useMemo(
    () => buildBrowserLocationPromptContext(browserLocationContext),
    [browserLocationContext],
  );
  const runtimeExtensionPromptContext = useMemo(
    () => buildRuntimeExtensionPromptContext(defaultExtensions),
    [defaultExtensions],
  );
  const chatChannelOptions = useMemo(
    () => buildChatChannelOptions(defaultExtensions),
    [defaultExtensions],
  );
  const sharedSessionControlPromptContext = useMemo(
    () => buildSharedSessionControlPromptContext(sharedSessionControlState, activeChatSessionId),
    [activeChatSessionId, sharedSessionControlState],
  );
  const activeSessionCompressionPromptContext = useMemo(
    () => buildSessionCompressionPromptContext(sessionChapterState, activeChatSessionId),
    [activeChatSessionId, sessionChapterState],
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
      repoWikiPromptContext,
      runCheckpointPromptContext,
      multitaskPromptContext,
      conversationBranchPromptContext,
      locationPromptContext,
      runtimeExtensionPromptContext,
      sharedSessionControlPromptContext,
      activeSessionCompressionPromptContext,
      buildSharedAgentPromptContext(sharedAgentCatalog),
    ].filter((section): section is string => Boolean(section)).join('\n\n'),
    [activeSessionCompressionPromptContext, activeSessionId, artifactPromptContext, conversationBranchPromptContext, locationPromptContext, multitaskPromptContext, repoWikiPromptContext, runCheckpointPromptContext, runtimeExtensionPromptContext, sessionSettingsContent, sharedAgentCatalog, sharedSessionControlPromptContext, workspaceFiles],
  );
  const messages = messagesBySession[activeChatSessionId] ?? [createSystemChatMessage(activeChatSessionId)];
  const sessionChapterTotals = useMemo(() => summarizeChapteredSessionState(sessionChapterState), [sessionChapterState]);
  const contextManagedTranscriptItems = useMemo(
    () => buildContextManagedTranscriptItems({
      state: sessionChapterState,
      sessionId: activeChatSessionId,
      messages,
    }),
    [activeChatSessionId, messages, sessionChapterState],
  );
  const contextManagerSnapshot = useMemo(
    () => buildContextManagerSnapshot({
      state: sessionChapterState,
      sessionId: activeChatSessionId,
      messages,
    }),
    [activeChatSessionId, messages, sessionChapterState],
  );
  const activeSharedSessionCandidates = sharedSessionControlState.activeSessions.filter(
    (session) => session.status !== 'ended',
  );
  const activeSharedSessionSummary = activeSharedSessionCandidates.find(
    (session) => session.sessionId === activeChatSessionId,
  ) ?? activeSharedSessionCandidates.find((session) => session.workspaceName === workspaceName);
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
  const runtimePluginRuntime = useMemo(
    () => buildRuntimePluginRuntime({
      settings: runtimePluginSettings,
      manifests: DEFAULT_RUNTIME_PLUGIN_MANIFESTS,
      selectedToolIds,
    }),
    [runtimePluginSettings, selectedToolIds],
  );
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
    for (const skill of browserWorkflowSkills) {
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
  }, [browserWorkflowSkills, skillAutocompleteQuery, workspaceCapabilities.skills]);
  const isSkillAutocompleteOpen = skillSuggestions.length > 0;
  const browserWorkflowSkillSuggestions = useMemo(
    () => suggestBrowserWorkflowSkills(input, browserWorkflowSkills, 3),
    [browserWorkflowSkills, input],
  );
  const specWorkflowPlan = useMemo(
    () => createSpecWorkflowPlan({ task: input, settings: specDrivenDevelopmentSettings }),
    [input, specDrivenDevelopmentSettings],
  );
  const canSubmit = activeConversationSessionCanSubmit && !hasActiveGeneration && Boolean(input.trim()) && (
    Boolean(widgetBinding)
    || Boolean(parseSandboxPrompt(input))
    || selectedProvider === 'tour-guide'
    || resolveAgentProviderForTask({ selectedProvider, latestUserInput: input.trim() }) === 'tour-guide'
    || (selectedProvider === 'codi' && Boolean(effectiveSelectedModelId))
    || (selectedProvider === 'ghcp' && Boolean(effectiveSelectedCopilotModelId) && hasAvailableCopilotModels)
    || (selectedProvider === 'cursor' && Boolean(effectiveSelectedCursorModelId) && hasAvailableCursorModels)
    || (selectedProvider === 'codex' && Boolean(effectiveSelectedCodexModelId) && hasAvailableCodexModels)
    || ((selectedProvider === 'researcher' || selectedProvider === 'debugger' || selectedProvider === 'planner' || selectedProvider === 'context-manager' || selectedProvider === 'security' || selectedProvider === 'steering' || selectedProvider === 'adversary' || selectedProvider === 'media' || selectedProvider === 'swarm') && (
      (Boolean(effectiveSelectedCopilotModelId) && hasAvailableCopilotModels)
      || (Boolean(effectiveSelectedCursorModelId) && hasAvailableCursorModels)
      || Boolean(activeLocalModel)
    ))
  );
  const providerSummary = getAgentProviderSummary({ provider: selectedProvider, installedModels, copilotState, cursorState, codexState });
  const agentDisplayName = getAgentDisplayName({
    provider: selectedProvider,
    activeCodiModelName: activeLocalModel?.name,
    activeGhcpModelName: activeCopilotModel?.name,
    activeCursorModelName: activeCursorModel?.name,
    activeCodexModelName: activeCodexModel?.name,
    researcherRuntimeProvider: selectedRuntimeProvider,
  });
  const defaultExtensionSummary = summarizeDefaultExtensionRuntime(defaultExtensions);
  const pluginCount = workspaceCapabilities.plugins.length + defaultExtensionSummary.pluginCount;
  const hookCount = workspaceCapabilities.hooks.length + defaultExtensionSummary.hookCount;
  const conversationBranchSummary = summarizeConversationBranches(conversationBranchingState);
  const contextSummary = `${providerSummary} · tools ${toolsEnabled ? `${selectedToolIds.length} selected` : 'off'} · branches ${conversationBranchingState.enabled ? `${conversationBranchSummary.activeSubthreads} active` : 'off'} · spec ${specWorkflowPlan.enabled ? specWorkflowPlan.stage : 'off'} · adversary ${adversaryAgentSettings.enabled ? `max ${adversaryAgentSettings.maxCandidates}` : 'off'} · security ${securityReviewRunPlan.enabled ? securityReviewRunPlan.agents.length : 'off'} · steering ${harnessSteeringInventory.enabled ? harnessSteeringInventory.totalCorrections : 'off'} · evolution ${harnessEvolutionSettings.enabled ? 'on' : 'off'} · partners ${partnerAgentControlPlane.settings.enabled ? `${partnerAgentControlPlane.readyAgentCount} ready` : 'off'} · runtime plugins ${runtimePluginRuntime.enabled ? `${runtimePluginRuntime.activePluginCount}/${runtimePluginRuntime.manifestCount}` : 'off'} · ${pluginCount} plugins · ${hookCount} hooks · artifacts ${attachedArtifactCount ?? 0} · location ${locationPromptContext ? 'on' : 'off'} · ${pendingSearch ? 'web search queued' : 'workspace ready'}`;
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
    const title = deriveSessionTitle(messages);
    if (title) {
      onSessionTitleSuggestion?.(activeChatSessionId, title);
    }
  }, [activeChatSessionId, messages, onSessionTitleSuggestion]);

  useEffect(() => {
    if (!sessionChapterState.enabled || !sessionChapterState.policy.automaticCompression) return;
    if (!messages.some((message) => message.role !== 'system')) return;
    const currentSession = sessionChapterState.sessions[activeChatSessionId];
    const projected = projectSessionChapters({
      state: sessionChapterState,
      sessionId: activeChatSessionId,
      workspaceId,
      workspaceName,
      messages,
      now: currentSession?.updatedAt ?? new Date().toISOString(),
    });
    const nextSession = projected.sessions[activeChatSessionId];
    if (JSON.stringify(currentSession) === JSON.stringify(nextSession)) return;
    onSessionChapterStateChange(projected);
  }, [activeChatSessionId, messages, onSessionChapterStateChange, sessionChapterState, workspaceId, workspaceName]);

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
    try {
      activeGeneration.finalizeCancelled();
    } finally {
      if (activeGenerationRef.current?.assistantId === activeGeneration.assistantId) {
        activeGenerationRef.current = null;
      }
      flushSync(() => {
        setActiveGenerationSessionId((current) => (
          current === activeGeneration.sessionId ? null : current
        ));
      });
      requestAnimationFrame(() => chatInputRef.current?.focus());
    }
  }, []);

  useEffect(() => () => {
    activeGenerationRef.current?.cancel();
    activeGenerationRef.current = null;
  }, []);

  function appendSharedMessages(nextEntries: ChatMessage[]) {
    const nextMessages = [...messagesRef.current, ...nextEntries];
    messagesRef.current = nextMessages;
    setMessagesBySession((current) => ({ ...current, [activeChatSessionId]: nextMessages }));
  }

  function createPauseCheckpoint(input: {
    reason: RunCheckpoint['reason'];
    summary: string;
    boundary: string;
    requiredInput: string;
  }): RunCheckpoint {
    const nextState = createRunCheckpoint(runCheckpointState, {
      sessionId: activeChatSessionId,
      workspaceId,
      reason: input.reason,
      summary: input.summary,
      boundary: input.boundary,
      requiredInput: input.requiredInput,
      now: new Date(),
    });
    onRunCheckpointStateChange(nextState);
    return nextState.checkpoints[0];
  }

  function resumeLatestCheckpoint(reason: RunCheckpoint['reason'], evidence: string): RunCheckpoint | null {
    const checkpoint = runCheckpointState.checkpoints.find((entry) => (
      entry.sessionId === activeChatSessionId
      && entry.reason === reason
      && entry.status === 'suspended'
    ));
    if (!checkpoint) return null;
    const nextState = resumeRunCheckpoint(runCheckpointState, checkpoint.id, {
      actor: 'operator',
      evidence,
      now: new Date(),
    });
    onRunCheckpointStateChange(nextState);
    return nextState.checkpoints.find((entry) => entry.id === checkpoint.id) ?? null;
  }

  function reflectResumedCheckpoint(message: ChatMessage, checkpoint: RunCheckpoint | null): ChatMessage {
    if (!checkpoint || !message.processEntries?.length) return message;
    return {
      ...message,
      processEntries: message.processEntries.map((entry) => {
        const payload = entry.payload as { checkpoint?: RunCheckpoint } | undefined;
        if (payload?.checkpoint?.id !== checkpoint.id) return entry;
        return buildCheckpointProcessEntry(checkpoint, entry.position);
      }),
    };
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

  function handleSaveWidgetPreview(messageId: string) {
    const message = messagesRef.current.find((entry) => entry.id === messageId);
    const preview = message?.widgetPreview;
    if (!preview || preview.status !== 'pending' || !widgetBinding) return;
    widgetBinding.onSavePatch({
      elementId: preview.patch.elementId,
      props: preview.patch.props as Record<string, JsonValue>,
    });
    updateMessage(messageId, {
      content: `Saved changes to ${preview.widgetTitle}.`,
      widgetPreview: { ...preview, status: 'saved' },
      status: 'complete',
    });
  }

  function handleDiscardWidgetPreview(messageId: string) {
    const message = messagesRef.current.find((entry) => entry.id === messageId);
    const preview = message?.widgetPreview;
    if (!preview || preview.status !== 'pending') return;
    updateMessage(messageId, {
      content: `Discarded preview for ${preview.widgetTitle}.`,
      widgetPreview: { ...preview, status: 'discarded' },
      status: 'complete',
    });
  }

  const handleSharedChatApiChange = useCallback((api: SharedChatApi | null) => {
    sharedChatApiRef.current = api;
    setSharedChatApi(api);
    if (!api?.active) return;
    const lifecycleKey = `${activeChatSessionId}:${api.confirmed ? 'confirmed' : 'opened'}`;
    if (sharedChatLifecycleKeyRef.current === lifecycleKey) return;
    sharedChatLifecycleKeyRef.current = lifecycleKey;
    setSharedSessionControlState((current) => recordSharedSessionControlEvent(current, {
      sessionId: activeChatSessionId,
      workspaceName,
      event: api.confirmed ? 'pairing.confirmed' : 'session.opened',
      actor: api.peerLabel ?? 'Local device',
      peerLabel: api.peerLabel,
      deviceLabel: api.deviceLabel ?? api.peerLabel,
    }));
  }, [activeChatSessionId, setSharedSessionControlState, workspaceName]);

  const appendSharedChatStatus = useCallback((text: string) => {
    if (/ended/i.test(text)) {
      setSharedSessionControlState((current) => recordSharedSessionControlEvent(current, {
        sessionId: activeChatSessionId,
        workspaceName,
        event: 'session.ended',
        actor: 'Local device',
        peerLabel: activeSharedSessionSummary?.peerLabel,
        deviceLabel: activeSharedSessionSummary?.deviceLabel,
      }));
    }
    appendSharedMessages([{
      id: createUniqueId(),
      role: 'system',
      status: 'complete',
      content: text,
    }]);
  }, [activeChatSessionId, activeSharedSessionSummary, appendSharedMessages, setSharedSessionControlState, workspaceName]);

  const appendRemoteSharedChatMessage = useCallback((text: string, peerLabel: string) => {
    const messageContent = formatSharedSessionPeerMessage({
      text,
      peerLabel,
      deviceLabel: peerLabel,
    });
    setSharedSessionControlState((current) => recordSharedSessionControlEvent(current, {
      sessionId: activeChatSessionId,
      workspaceName,
      event: 'message.created',
      actor: peerLabel,
      peerLabel,
      deviceLabel: peerLabel,
    }));
    appendSharedMessages([{
      id: createUniqueId(),
      role: 'user',
      status: 'complete',
      content: messageContent,
    }]);
  }, [activeChatSessionId, appendSharedMessages, setSharedSessionControlState, workspaceName]);

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
    const checkpoint = createPauseCheckpoint({
      reason: 'delayed-input',
      summary: detail.prompt || 'Waiting for user input',
      boundary: 'user elicitation',
      requiredInput: detail.fields.map((field) => field.label).join(', ') || detail.reason || 'user response',
    });
    const checkpointEntry = buildCheckpointProcessEntry(checkpoint, 0);
    const targetAssistantId = activeGenerationRef.current?.assistantId;
    if (!targetAssistantId) {
      appendSharedMessages([{
        id: createUniqueId(),
        role: 'assistant',
        status: 'complete',
        content: '',
        cards: [card],
        processEntries: [checkpointEntry],
      }]);
      return;
    }
    setMessagesBySession((current) => {
      const sessionMessages = current[activeChatSessionId] ?? [createSystemChatMessage(activeChatSessionId)];
      const nextMessages = sessionMessages.map((message) => (
        message.id === targetAssistantId
          ? {
            ...message,
            cards: [...(message.cards ?? []), card],
            processEntries: [
              ...(message.processEntries ?? []),
              { ...checkpointEntry, position: message.processEntries?.length ?? 0 },
            ],
          }
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
    const checkpoint = createPauseCheckpoint({
      reason: 'credentials',
      summary: `Waiting for ${detail.name}`,
      boundary: 'secret request',
      requiredInput: detail.reason || detail.prompt || `secret value for ${detail.name}`,
    });
    const checkpointEntry = buildCheckpointProcessEntry(checkpoint, 0);
    const targetAssistantId = activeGenerationRef.current?.assistantId;
    if (!targetAssistantId) {
      appendSharedMessages([{
        id: createUniqueId(),
        role: 'assistant',
        status: 'complete',
        content: '',
        cards: [card],
        processEntries: [checkpointEntry],
      }]);
      return;
    }
    setMessagesBySession((current) => {
      const sessionMessages = current[activeChatSessionId] ?? [createSystemChatMessage(activeChatSessionId)];
      const nextMessages = sessionMessages.map((message) => (
        message.id === targetAssistantId
          ? {
            ...message,
            cards: [...(message.cards ?? []), card],
            processEntries: [
              ...(message.processEntries ?? []),
              { ...checkpointEntry, position: message.processEntries?.length ?? 0 },
            ],
          }
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

  const sendMessage = useCallback(async (text: string, options: { autoRoute?: boolean; useTools?: boolean; skipSelfReflection?: boolean; provider?: AgentProvider } = {}) => {
    if (!text.trim() || activeGenerationRef.current) return;
    const assistantId = createUniqueId();
    const userId = createUniqueId();
    const trimmedText = text.trim();
    if (!canSubmitToConversationSession(conversationBranchingState, activeChatSessionId)) {
      onToast({ msg: 'Merged subthreads are read-only', type: 'warning' });
      return;
    }
    if (widgetBinding) {
      const preview = buildWidgetPreviewPatch(widgetBinding.widget, trimmedText);
      setChatHistoryBySession((current) => ({
        ...current,
        [activeChatSessionId]: [...(current[activeChatSessionId] ?? []), trimmedText],
      }));
      const nextMessages: ChatMessage[] = [
        ...messagesRef.current,
        { id: userId, role: 'user', content: text },
        {
          id: assistantId,
          role: 'assistant',
          content: `Preview ready for ${preview.widgetTitle}. Save changes to apply them to the dashboard widget.`,
          status: 'complete',
          widgetPreview: preview,
        },
      ];
      messagesRef.current = nextMessages;
      setMessagesBySession((current) => ({ ...current, [activeChatSessionId]: nextMessages }));
      setInput('');
      resetActiveInputHistoryCursor();
      return;
    }
    let providerForRequest = options.provider
      ?? (options.autoRoute === false
      ? selectedProvider
      : resolveAgentProviderForTask({
        selectedProvider,
        latestUserInput: trimmedText,
      }));
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
    if (options.autoRoute === false && providerForRequest === 'ghcp' && !requestGhcpModelId && copilotState.models[0]) {
      requestGhcpModelId = copilotState.models[0].id;
      effectiveSelectedCopilotModelIdRef.current = requestGhcpModelId;
      setSelectedCopilotModelBySession((current) => ({ ...current, [activeChatSessionId]: requestGhcpModelId }));
    }
    let runtimeProviderForRequest = resolveRuntimeAgentProvider({
      provider: providerForRequest,
      hasCodiModelsReady: Boolean(activeLocalModel),
      hasGhcpModelsReady: Boolean(requestGhcpModelId) && hasAvailableCopilotModels,
      hasCursorModelsReady: Boolean(effectiveSelectedCursorModelId) && hasAvailableCursorModels,
      hasCodexModelsReady: Boolean(effectiveSelectedCodexModelId) && hasAvailableCodexModels,
    });
const complexityRoutingSettings = benchmarkRoutingSettings.complexityRouting;
    const complexityRoutingInShadowMode = complexityRoutingSettings.enabled && complexityRoutingSettings.mode === 'shadow';
    const complexityRoutingTrafficSplit = complexityRoutingSettings.trafficSplitPercent ?? 100;
    const complexityRoutingAllowedByTraffic = complexityRoutingTrafficSplit >= 100
      || (complexityRoutingTrafficSplit > 0 && Math.random() * 100 < complexityRoutingTrafficSplit);
    const rolloutChecksPass = areStagedRoutingChecksPassing([
      { id: 'misroute-prevention-complex', prompt: 'complex', expectedModelClass: 'premium' },
      { id: 'misroute-prevention-escalation', prompt: 'security', expectedModelClass: 'premium' },
      { id: 'cost-win-simple', prompt: 'summarize', expectedModelClass: 'cheap' },
      { id: 'policy-invariants', prompt: 'policy', expectedModelClass: 'cheap' },
    ]);
    const shouldEnforceBenchmarkRouting = requestBenchmarkRoute
      && benchmarkRoutingSettings.enabled
      && benchmarkRoutingSettings.routerMode === 'enforce'
      && rolloutChecksPass
      && !complexityRoutingInShadowMode
      && complexityRoutingAllowedByTraffic;
    if (shouldEnforceBenchmarkRouting && requestBenchmarkRoute) {
      const routed = requestBenchmarkRoute.candidate;
      if (providerForRequest === 'planner' || providerForRequest === 'context-manager' || providerForRequest === 'researcher' || providerForRequest === 'debugger' || providerForRequest === 'security' || providerForRequest === 'steering' || providerForRequest === 'media' || providerForRequest === 'swarm') {
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
    } else if (requestBenchmarkRoute && benchmarkRoutingSettings.enabled && benchmarkRoutingSettings.routerMode === 'shadow') {
      appendSharedMessages([{
        id: createUniqueId(),
        role: 'system',
        status: 'complete',
        content: `[shadow-routing] ${requestBenchmarkRoute.taskClass} -> ${requestBenchmarkRoute.candidate.ref} (${requestBenchmarkRoute.reason})`,
      }]);
    }
    if (requestBenchmarkRoute && complexityRoutingSettings.enabled) {
      console.info('[benchmark-routing:complexity]', {
        mode: complexityRoutingSettings.mode,
        applied: !complexityRoutingInShadowMode && complexityRoutingAllowedByTraffic,
        trafficSplitPercent: complexityRoutingSettings.trafficSplitPercent ?? null,
        pinning: complexityRoutingSettings.pinning ?? null,
        taskClass: requestBenchmarkTaskClass,
        selected: requestBenchmarkRoute.candidate.ref,
        reason: requestBenchmarkRoute.reason,
      });
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
    if (options.autoRoute !== false && isMultitaskSubagentRequest(trimmedText)) {
      onMultitaskRequest?.(trimmedText, { openPanel: false });
    }
    if (options.autoRoute !== false && isConversationBranchingRequest(trimmedText)) {
      onConversationBranchRequest?.(trimmedText, activeChatSessionId);
    }
    if (activeConversationSubthread?.status === 'running') {
      onConversationSubthreadSteering?.(
        activeConversationSubthread.id,
        activeChatSessionId,
        trimmedText,
        [userId, assistantId],
      );
    }

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
      updateMessage(assistantId, { status: 'error', content: providerForRequest === 'researcher' ? 'Researcher needs a GHCP, Cursor, or browser-compatible Codi model before sending a prompt.' : providerForRequest === 'debugger' ? 'Debugger needs a GHCP, Cursor, or browser-compatible Codi model before sending a prompt.' : providerForRequest === 'planner' ? 'Planner needs a GHCP, Cursor, or browser-compatible Codi model before sending a prompt.' : providerForRequest === 'security' ? 'Security Review needs a GHCP, Cursor, or browser-compatible Codi model before sending a prompt.' : providerForRequest === 'steering' ? 'Steering needs a GHCP, Cursor, or browser-compatible Codi model before sending a prompt.' : providerForRequest === 'media' ? 'Media needs GHCP, Cursor, or media-capable browser models before sending a prompt.' : 'Install a browser-compatible ONNX model for Codi from Models before sending a prompt.' });
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
    const requestRuntimePluginRuntime = buildRuntimePluginRuntime({
      settings: runtimePluginSettings,
      manifests: DEFAULT_RUNTIME_PLUGIN_MANIFESTS,
      selectedToolIds,
    });
    const requestBrowserWorkflowSkillSuggestions = suggestBrowserWorkflowSkills(
      trimmedText,
      browserWorkflowSkills,
      3,
    );
    const requestMediaCapabilityPlan = providerForRequest === 'media'
      ? planMediaCapabilities({
          request: trimmedText,
          installedModels,
          remoteModelNames: [
            ...copilotState.models.map((model) => model.name),
            ...cursorState.models.map((model) => model.name),
            ...codexState.models.map((model) => model.name),
          ],
        })
      : null;
    const requestSpecWorkflowPlan = createSpecWorkflowPlan({
      task: trimmedText,
      settings: specDrivenDevelopmentSettings,
    });
    const requestWorkspacePromptContext = [
      workspacePromptContext,
      buildSpecDrivenDevelopmentPromptContext(requestSpecWorkflowPlan),
      requestMediaCapabilityPlan ? buildMediaCapabilityPrompt(requestMediaCapabilityPlan) : '',
      buildBrowserWorkflowSkillPromptContext(requestBrowserWorkflowSkillSuggestions),
      buildWorkspaceSkillPolicyPromptContext(workspaceSkillPolicyInventory),
      buildSharedAgentPromptContext(sharedAgentCatalog),
      buildHarnessSteeringPromptContext(harnessSteeringInventory),
      buildHarnessEvolutionPromptContext(buildHarnessEvolutionPlan({
        settings: harnessEvolutionSettings,
        request: {
          componentId: 'Agent Browser harness',
          changeSummary: trimmedText,
          touchesStyling: /\b(style|css|visual|layout|theme|ui|component|dashboard|panel|widget)\b/i.test(trimmedText),
        },
      })),
      buildPartnerAgentPromptContext(requestPartnerAgentControlPlane, requestPartnerAgentAuditEntry),
      buildSecurityReviewPromptContext(buildSecurityReviewRunPlan({
        settings: securityReviewAgentSettings,
        selectedToolIds,
      })),
      buildRuntimePluginPromptContext(requestRuntimePluginRuntime),
    ].filter((section): section is string => Boolean(section)).join('\n\n');

    const requestToolsEnabled = options.useTools ?? toolsEnabled;
    if (requestToolsEnabled && providerForRequest !== 'tour-guide' && providerForRequest !== 'codex') {
      if (!activeSessionId) {
        updateMessage(assistantId, { status: 'error', content: 'Open or create a session before enabling tools.' });
        return;
      }

      const controller = new AbortController();
      type PlanningStageName = 'chat-agent' | 'planner' | 'router-agent' | 'router' | 'coordinator' | 'breakdown-agent' | 'assignment-agent' | 'validation-agent' | 'orchestrator' | 'symphony' | 'tool-agent' | 'group-select' | 'tool-select' | 'logact' | 'voter-ensemble' | 'agent-bus' | 'executor' | 'chat';
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
        symphony: 'symphony-orchestrator',
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
        symphony: {
          title: 'Symphony workflow',
          body: 'Applying durable task, isolated worktree, AgentBus review, and merge-approval policy.',
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
        symphony: { parentStage: 'orchestrator' },
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
        symphony: { hardMs: 120_000, thinkingIdleMs: 90_000, streamingIdleMs: 60_000 },
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
          'symphony',
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
          : providerForRequest === 'context-manager'
            ? buildContextManagerToolInstructions({
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
          : providerForRequest === 'steering'
            ? buildSteeringToolInstructions({
              workspaceName,
              workspacePromptContext: requestWorkspacePromptContext,
              descriptors: selectedDescriptors,
              selectedToolIds,
            })
          : providerForRequest === 'media'
            ? buildMediaToolInstructions({
              workspaceName,
              workspacePromptContext: requestWorkspacePromptContext,
              descriptors: selectedDescriptors,
              selectedToolIds,
              capabilityPlan: requestMediaCapabilityPlan ?? undefined,
            })
          : buildDefaultToolInstructions({ workspaceName, workspacePromptContext: requestWorkspacePromptContext, selectedToolIds });
        const managedNextMessages = buildContextManagedMessages({
          state: sessionChapterState,
          sessionId: activeChatSessionId,
          messages: nextMessages,
        });
        const inputMessages: ModelMessage[] = managedNextMessages
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
        messages: buildContextManagedMessages({
          state: sessionChapterState,
          sessionId: activeChatSessionId,
          messages: nextMessages,
        }),
        workspaceName,
        workspacePromptContext: requestWorkspacePromptContext,
        voters: codiVoters,
        secretSettings,
        skipSelfReflection: options.skipSelfReflection,
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
  }, [activeChatSessionId, activeConversationSubthread, activeLocalModel, adversaryToolReviewSettings, appendSharedMessages, benchmarkRoutingCandidates, benchmarkRoutingSettings, browserWorkflowSkills, clearActiveGeneration, codexState, conversationBranchingState, copilotState, cursorState, effectiveSelectedCodexModelId, effectiveSelectedCopilotModelId, effectiveSelectedCursorModelId, effectiveSelectedModelId, evaluationAgents, getSessionBash, harnessEvolutionSettings, harnessSteeringInventory, hasAvailableCodexModels, hasAvailableCopilotModels, hasAvailableCursorModels, installedModels, negativeRubricTechniques, notifyAssistantComplete, onConversationBranchRequest, onConversationSubthreadSteering, onMultitaskRequest, onNegativeRubricTechnique, onPartnerAgentAuditEntry, onTerminalFsPathsChanged, onToast, partnerAgentControlPlaneSettings, resetActiveInputHistoryCursor, runSandboxPrompt, runtimePluginSettings, secretSettings, securityReviewAgentSettings, selectedProvider, selectedToolIds, setBashHistoryBySession, sharedAgentCatalog, specDrivenDevelopmentSettings, toolsEnabled, webMcpBridge, widgetBinding, workspaceName, workspacePromptContext]);

  const handleElicitationSubmit = useCallback((messageId: string, requestId: string, values: Record<string, string>) => {
    const locationValue = values.location?.trim();
    const resumedCheckpoint = resumeLatestCheckpoint('delayed-input', `Submitted ${requestId}`);
    if (locationValue) {
      upsertUserContextMemory(workspaceName, {
        id: 'location',
        label: 'Location',
        value: locationValue,
        source: 'workspace-memory',
      });
    }
    setMessagesBySession((current) => {
      const sessionMessages = current[activeChatSessionId] ?? [createSystemChatMessage(activeChatSessionId)];
      const nextMessages = sessionMessages.map((message) => (
        message.id === messageId
          ? reflectResumedCheckpoint({
            ...message,
            cards: (message.cards ?? []).map((card) => (
              card.requestId === requestId
                ? { ...card, status: 'submitted' as const, response: values }
                : card
            )),
          }, resumedCheckpoint)
          : message
      ));
      messagesRef.current = nextMessages;
      return { ...current, [activeChatSessionId]: nextMessages };
    });
    void sendMessage([
      `User input for ${requestId}:`,
      JSON.stringify(values, null, 2),
    ].join('\n'));
  }, [activeChatSessionId, runCheckpointState, sendMessage, workspaceName]);

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
    const resumedCheckpoint = resumeLatestCheckpoint('credentials', `Created ${secretRef}`);
    setMessagesBySession((current) => {
      const sessionMessages = current[activeChatSessionId] ?? [createSystemChatMessage(activeChatSessionId)];
      const nextMessages = sessionMessages.map((message) => (
        message.id === messageId
          ? reflectResumedCheckpoint({
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
          }, resumedCheckpoint)
          : message
      ));
      messagesRef.current = nextMessages;
      return { ...current, [activeChatSessionId]: nextMessages };
    });
    void onSecretRecordsChanged?.();
    onToast({ msg: 'Secret saved', type: 'success' });
  }, [activeChatSessionId, onSecretRecordsChanged, onToast, runCheckpointState, setMessagesBySession]);

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
    if (!pendingSessionPrompt || !activeSessionId) {
      consumedPendingSessionPromptRef.current = null;
      return;
    }
    if (activeGenerationRef.current) {
      return;
    }
    if (selectedProvider === 'codi' && !activeLocalModel && !hasAvailableCopilotModels) {
      return;
    }
    if (selectedProvider === 'ghcp' && !effectiveSelectedCopilotModelId && copilotState.models[0]) {
      const nextModelId = copilotState.models[0].id;
      effectiveSelectedCopilotModelIdRef.current = nextModelId;
      setSelectedCopilotModelBySession((current) => ({ ...current, [activeChatSessionId]: nextModelId }));
      return;
    }

    const promptKey = `${activeSessionId}:${pendingSessionPrompt}`;
    if (consumedPendingSessionPromptRef.current === promptKey) {
      return;
    }

    consumedPendingSessionPromptRef.current = promptKey;
    void sendMessage(pendingSessionPrompt, {
      autoRoute: false,
      provider: hasAvailableCopilotModels ? 'ghcp' : selectedProvider,
      skipSelfReflection: true,
      useTools: false,
    }).then(() => {
      onPendingSessionPromptConsumed?.(pendingSessionPrompt);
    }, (error) => {
      consumedPendingSessionPromptRef.current = null;
      onToast({
        msg: error instanceof Error ? error.message : 'Failed to start queued session prompt',
        type: 'error',
      });
    });
  }, [
    activeChatSessionId,
    activeSessionId,
    activeLocalModel,
    copilotState.models,
    effectiveSelectedCopilotModelId,
    onPendingSessionPromptConsumed,
    onToast,
    pendingSessionPrompt,
    selectedProvider,
    sendMessage,
    setSelectedCopilotModelBySession,
    hasAvailableCopilotModels,
  ]);

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

  useEffect(() => {
    if (!pendingAiPointerPrompt) {
      consumedAiPointerPromptRef.current = null;
      return;
    }
    if (activeGenerationRef.current) {
      return;
    }
    if (consumedAiPointerPromptRef.current === pendingAiPointerPrompt) return;
    consumedAiPointerPromptRef.current = pendingAiPointerPrompt;
    setInput(pendingAiPointerPrompt);
    requestAnimationFrame(() => chatInputRef.current?.focus());
    onAiPointerPromptConsumed();
  }, [activeGenerationSessionId, onAiPointerPromptConsumed, pendingAiPointerPrompt]);

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
                    <option value="context-manager">Context Manager</option>
                    <option value="security">Security Review</option>
                    <option value="steering">Steering</option>
                    <option value="adversary">Adversary</option>
                    <option value="media">Media</option>
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
              <button
                type="button"
                className={`icon-button${conversationBranchingState.enabled ? ' is-active' : ''}`}
                aria-label="Start conversation branch"
                title="Start conversation branch"
                data-tooltip="Branch"
                onClick={() => onConversationBranchRequest?.('Branch active chat thread', activeChatSessionId)}
                {...panelTitlebarControlProps}
              >
                <Icon name="share" size={13} />
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
        channelOptions={chatChannelOptions}
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
          {!showBash && (sharedChatApi?.active || activeSharedSessionSummary) ? (
            <div className="shared-chat-active-banner" aria-label="Shared session remote control">
              <span>{activeSharedSessionSummary?.peerLabel ?? 'Shared session'} · {activeSharedSessionSummary?.deviceLabel ?? 'Remote device'}</span>
              <strong>{sharedChatApi?.confirmed || activeSharedSessionSummary?.status === 'active' ? 'Remote control enabled' : 'Pairing pending'}</strong>
              <small>{activeSharedSessionSummary ? `${activeSharedSessionSummary.eventCount} signed events` : '0 signed events'}</small>
              {sharedChatApi?.active ? <button type="button" className="secondary-button" onClick={() => void sharedChatApi.endSession()}>End session</button> : null}
            </div>
          ) : null}
          {!showBash && activeConversationSubthread ? (
            <ConversationSubthreadBanner
              subthread={activeConversationSubthread}
              mainSessionId={activeConversationMainSessionId}
              onBack={() => activeConversationMainSessionId ? onOpenConversationSession?.(activeConversationMainSessionId) : undefined}
            />
          ) : null}
          {!showBash && widgetBinding ? (
            <div className="widget-binding-banner" aria-label="Widget-bound session">
              <span>Widget session</span>
              <strong>{readHarnessElementTitle(widgetBinding.widget, widgetBinding.widget.id)}</strong>
              <small>Changes preview in chat and apply only after Save.</small>
            </div>
          ) : null}
          <div className="message-list" role="log" aria-live="polite" aria-label={showBash ? 'Terminal output' : 'Chat transcript'}>
            {contextManagedTranscriptItems.map((item) => {
              if (item.kind === 'message') {
                return <ChatMessageView key={item.message.id} message={item.message} agentName={agentDisplayName} activitySelected={item.message.id === activeActivityMessageId} onOpenActivity={selectActivityMessage} onSubmitElicitation={handleElicitationSubmit} onSubmitSecret={handleSecretSubmit} onSaveWidgetPreview={handleSaveWidgetPreview} onDiscardWidgetPreview={handleDiscardWidgetPreview} onCopyMessage={handleCopyMessage} />;
              }
              const expanded = Boolean(expandedContextChapterIds[item.chapterId]);
              return (
                <article key={item.chapterId} className="context-manager-summary-card" aria-label="Context manager summary">
                  <div className="context-manager-summary-header">
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.summary}</p>
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setExpandedContextChapterIds((current) => ({ ...current, [item.chapterId]: !expanded }))}
                    >
                      {expanded ? 'Hide originals' : 'View originals'}
                    </button>
                  </div>
                  <div className="browser-agent-run-sdk-chip-grid" aria-label="Context manager references">
                    {item.evidenceRefs.slice(0, 2).map((ref) => <code key={ref}>{ref}</code>)}
                    {item.validationRefs.slice(0, 2).map((ref) => <code key={ref}>{ref}</code>)}
                    {item.toolOutputRefs.slice(0, 2).map((ref) => <code key={ref}>{ref}</code>)}
                  </div>
                  {expanded ? (
                    <div className="context-manager-originals" aria-label="Original messages for compacted chapter">
                      {item.originalMessages.map((message) => <ChatMessageView key={message.id} message={message} agentName={agentDisplayName} activitySelected={message.id === activeActivityMessageId} onOpenActivity={selectActivityMessage} onSubmitElicitation={handleElicitationSubmit} onSubmitSecret={handleSecretSubmit} onSaveWidgetPreview={handleSaveWidgetPreview} onDiscardWidgetPreview={handleDiscardWidgetPreview} onCopyMessage={handleCopyMessage} />)}
                    </div>
                  ) : null}
                </article>
              );
            })}
            {!showBash && activeChatSessionId === conversationBranchingState.mainSessionId ? (
              <ConversationSubthreadTranscripts
                state={conversationBranchingState}
                messagesBySession={messagesBySession}
                agentName={agentDisplayName}
                onOpenConversationSession={onOpenConversationSession}
                onOpenActivity={selectActivityMessage}
                onSubmitElicitation={handleElicitationSubmit}
                onSubmitSecret={handleSecretSubmit}
                onCopyMessage={handleCopyMessage}
              />
            ) : null}
            <div ref={bottomRef} />
          </div>
          <div className="context-strip">Context: {contextSummary}</div>
          {!showBash ? (
            <div className="chapter-context-strip" aria-label="Chaptered session compression">
              <Icon name="layers" size={12} />
              <span>{sessionChapterTotals.chapterCount} chapter{sessionChapterTotals.chapterCount === 1 ? '' : 's'}</span>
              <strong>{contextManagerSnapshot.status === 'critical' ? 'context critical' : contextManagerSnapshot.status === 'warning' ? 'context warning' : activeSessionCompressionPromptContext ? 'active session compressed' : 'compressed context ready'}</strong>
              <small>{contextManagerSnapshot.managedTokenEstimate}/{contextManagerSnapshot.maxInputTokens} tokens · {sessionChapterTotals.evidenceRefCount} evidence refs</small>
            </div>
          ) : null}
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
                    placeholder={activeConversationSessionCanSubmit ? (widgetBinding ? `Describe changes to ${readHarnessElementTitle(widgetBinding.widget, widgetBinding.widget.id)}` : getAgentInputPlaceholder({ provider: selectedProvider, hasCodiModelsReady: hasInstalledModels, hasGhcpModelsReady: hasAvailableCopilotModels, hasCursorModelsReady: hasAvailableCursorModels, hasCodexModelsReady: hasAvailableCodexModels })) : 'Merged subthread is read-only'}
                    rows={1}
                    onKeyDown={handleChatInputKeyDown}
                    disabled={!activeConversationSessionCanSubmit}
                  />
                  <button
                    type="submit"
                    className={`composer-send-btn${isActiveSessionGenerating ? ' composer-send-btn-stop' : ''}`}
                    aria-label={isActiveSessionGenerating ? 'Stop response' : 'Send'}
                    title={isActiveSessionGenerating ? 'Stop response' : 'Send'}
                    disabled={!isActiveSessionGenerating && !canSubmit}
                    onClick={isActiveSessionGenerating ? (event) => {
                      event.preventDefault();
                      stopActiveGeneration();
                    } : undefined}
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
                {!isSkillAutocompleteOpen && browserWorkflowSkillSuggestions.length ? (
                  <div className="browser-workflow-suggestions" role="list" aria-label="Suggested workflow skills">
                    {browserWorkflowSkillSuggestions.map((skill) => (
                      <div key={skill.id} className="browser-workflow-suggestion" role="listitem">
                        <span className="composer-suggestion-name">{skill.name}</span>
                        <span className="composer-suggestion-description">
                          {skill.matchedTriggers.join(', ')} · {skill.description}
                        </span>
                      </div>
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
                  : (!hasInstalledModels ? <button type="button" className="composer-status composer-status-action" onClick={onOpenModels}>{selectedProvider === 'researcher' ? 'Researcher needs GHCP, Cursor, or Codi. Open Models.' : selectedProvider === 'debugger' ? 'Debugger needs GHCP, Cursor, or Codi. Open Models.' : selectedProvider === 'planner' ? 'Planner needs GHCP, Cursor, or Codi. Open Models.' : selectedProvider === 'context-manager' ? 'Context Manager needs GHCP, Cursor, or Codi. Open Models.' : selectedProvider === 'security' ? 'Security Review needs GHCP, Cursor, or Codi. Open Models.' : selectedProvider === 'steering' ? 'Steering needs GHCP, Cursor, or Codi. Open Models.' : selectedProvider === 'adversary' ? 'Adversary needs GHCP, Cursor, or Codi. Open Models.' : selectedProvider === 'media' ? 'Media needs GHCP, Cursor, or media models. Open Models.' : 'No Codi model loaded. Open Models to load one.'}</button> : null)}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function getInstalledModelSource(model: HFModel): string {
  if (model.id.includes('/') || model.tags.some((tag) => tag.toLowerCase().includes('transformers'))) {
    return 'Hugging Face';
  }
  return model.author || 'Local';
}

function formatModelSize(model: Pick<HFModel, 'sizeMB'>): string | null {
  if (!model.sizeMB) return null;
  return model.sizeMB >= 1000 ? `${(model.sizeMB / 1000).toFixed(1)} GB` : `${model.sizeMB} MB`;
}

function formatTokenWindow(value: number | undefined, suffix: string): string | null {
  return typeof value === 'number' ? `${value.toLocaleString()} ${suffix}` : null;
}

function InstalledModelRow({ model, onDelete }: { model: HFModel; onDelete: (id: string) => void }) {
  const source = getInstalledModelSource(model);
  const taskLabel = HF_TASK_LABELS[model.task] ?? model.task;
  const sizeLabel = formatModelSize(model);

  return (
    <article className="installed-model-row" aria-label={`${model.name} installed from ${source}`}>
      <span className="installed-model-icon" aria-hidden="true">
        <Icon name="cpu" size={14} />
      </span>
      <span className="installed-model-copy">
        <strong>{model.name}</strong>
        <small>{source}{taskLabel ? ` · ${taskLabel}` : ''}{sizeLabel ? ` · ${sizeLabel}` : ''}</small>
      </span>
      <span className="installed-model-status">
        <StatusIndicator active label={`${model.name} installed`} />
        <button
          type="button"
          className="sidebar-icon-button"
          aria-label={`Remove ${model.name}`}
          title={`Remove ${model.name}`}
          onClick={() => onDelete(model.id)}
        >
          <Icon name="trash" size={13} />
        </button>
      </span>
    </article>
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

function WorkspaceSkillPolicySettingsPanel({
  state,
  inventory,
  onChange,
}: {
  state: WorkspaceSkillPolicyState;
  inventory: WorkspaceSkillPolicyInventory;
  onChange: (state: WorkspaceSkillPolicyState) => void;
}) {
  const update = <K extends keyof WorkspaceSkillPolicyState>(key: K, value: WorkspaceSkillPolicyState[K]) => {
    onChange({ ...state, [key]: value });
  };
  const publishDraft = (packageId: string) => {
    onChange(publishWorkspaceSkillDraft(state, packageId));
  };

  return (
    <SettingsSection title="Workspace skill policies" defaultOpen={false}>
      <div className="workspace-skill-policy-settings">
        <div className="partner-agent-toolbar">
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={state.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
              aria-label="Enable workspace skill policies"
            />
            <span>Enable workspace skill policies</span>
          </label>
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={state.enforceLeastPrivilege}
              onChange={(event) => update('enforceLeastPrivilege', event.target.checked)}
              aria-label="Least-privilege enforcement"
            />
            <span>Least-privilege enforcement</span>
          </label>
        </div>
        <article className="provider-card workspace-skill-policy-summary-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>Versioned packages</strong>
              <p>{inventory.publishedPackageCount} published · {inventory.draftPackageCount} draft · {inventory.toolScopeCount} tool scopes · {inventory.pathScopeCount} path scopes</p>
            </div>
            <span className={`badge${inventory.enabled ? ' connected' : ''}`}>{inventory.enabled ? 'governed' : 'off'}</span>
          </div>
          <div className="workspace-skill-policy-helper-row">
            {inventory.helperRows.map((helper) => (
              <span key={helper.id} className={`badge${helper.enabled ? ' connected' : ''}`}>
                {helper.label}
              </span>
            ))}
          </div>
          <p className="partner-agent-audit-note">
            External allowlist: {inventory.externalAllowlist.join(', ') || 'none'}
          </p>
        </article>
        <div className="workspace-skill-package-list" role="list" aria-label="Versioned workspace skill packages">
          {state.packages.map((pkg) => (
            <article key={pkg.id} className="provider-card workspace-skill-package-card" role="listitem">
              <div className="provider-card-header">
                <div className="provider-body">
                  <strong>{pkg.name}</strong>
                  <p>{pkg.description}</p>
                </div>
                <span className={`badge${pkg.status === 'published' ? ' connected' : ''}`}>{pkg.status}</span>
              </div>
              <div className="workspace-skill-scope-grid">
                <div>
                  <span className="muted">Tools</span>
                  <code>{pkg.toolScopes.join(', ')}</code>
                </div>
                <div>
                  <span className="muted">Paths</span>
                  <code>{pkg.pathScopes.join(', ')}</code>
                </div>
              </div>
              <p className="partner-agent-audit-note">External paths: {pkg.externalPaths.join(', ') || 'none'}</p>
              {pkg.status === 'draft' ? (
                <button type="button" className="secondary-button" onClick={() => publishDraft(pkg.id)}>
                  Publish {pkg.name} draft
                </button>
              ) : null}
            </article>
          ))}
        </div>
        {inventory.warnings.length ? (
          <ul className="workspace-skill-policy-warnings">
            {inventory.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        ) : null}
      </div>
    </SettingsSection>
  );
}

function SharedAgentsSettingsPanel({
  state,
  catalog,
  onChange,
}: {
  state: SharedAgentRegistryState;
  catalog: SharedAgentCatalog;
  onChange: (state: SharedAgentRegistryState) => void;
}) {
  const update = <K extends keyof SharedAgentRegistryState>(key: K, value: SharedAgentRegistryState[K]) => {
    onChange({ ...state, [key]: value });
  };
  const publishDraft = (agentId: string) => {
    onChange(publishSharedAgentDraft(state, agentId, 'Agent Browser'));
  };

  return (
    <SettingsSection title="Shared agents" defaultOpen={false}>
      <div className="shared-agent-settings">
        <div className="partner-agent-toolbar">
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={state.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
              aria-label="Enable shared-agent registry"
            />
            <span>Enable shared-agent registry</span>
          </label>
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={state.requirePublishApproval}
              onChange={(event) => update('requirePublishApproval', event.target.checked)}
              aria-label="Require shared-agent publish approval"
            />
            <span>Require publish approval</span>
          </label>
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={state.showAuditTrail}
              onChange={(event) => update('showAuditTrail', event.target.checked)}
              aria-label="Show shared-agent audit trail"
            />
            <span>Show audit trail</span>
          </label>
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={state.trackUsageAnalytics}
              onChange={(event) => update('trackUsageAnalytics', event.target.checked)}
              aria-label="Track shared-agent usage analytics"
            />
            <span>Track usage analytics</span>
          </label>
        </div>

        <article className="provider-card shared-agent-summary-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>Team registry</strong>
              <p>{catalog.publishedAgentCount} published · {catalog.draftAgentCount} draft · {catalog.totalUsageCount} usage events</p>
            </div>
            <span className={`badge${catalog.enabled ? ' connected' : ''}`}>{catalog.enabled ? 'governed' : 'off'}</span>
          </div>
          <div className="shared-agent-metrics" aria-label="Shared-agent registry metrics">
            <span>{catalog.auditVisible ? 'audit visible' : 'audit hidden'}</span>
            <span>{catalog.usageAnalyticsEnabled ? 'usage tracked' : 'usage off'}</span>
            <span>{catalog.requirePublishApproval ? 'approval required' : 'approval optional'}</span>
          </div>
          <p className="partner-agent-audit-note">
            {catalog.latestAuditEntry?.summary ?? 'No shared-agent audit entries recorded yet.'}
          </p>
        </article>

        <div className="shared-agent-list" role="list" aria-label="Shared workspace agents">
          {catalog.rows.map((agent) => (
            <article key={agent.id} className="provider-card shared-agent-card" role="listitem">
              <div className="provider-card-header">
                <div className="provider-body">
                  <strong>{agent.name}</strong>
                  <p>{agent.description}</p>
                </div>
                <span className={`badge${agent.status === 'published' ? ' connected' : ''}`}>{agent.status}</span>
              </div>
              <div className="shared-agent-metrics">
                <span>v{agent.version}</span>
                <span>{agent.visibility}</span>
                <span>{agent.usageCount} usage events</span>
              </div>
              <div className="workspace-skill-scope-grid">
                <div>
                  <span className="muted">Roles</span>
                  <code>{agent.roleSummary}</code>
                </div>
                <div>
                  <span className="muted">Tools</span>
                  <code>{agent.toolScopeSummary}</code>
                </div>
              </div>
              <p className="partner-agent-audit-note">Capabilities: {agent.capabilitySummary}</p>
              {agent.status === 'draft' ? (
                <button type="button" className="secondary-button" onClick={() => publishDraft(agent.id)}>
                  Publish {agent.name} draft
                </button>
              ) : null}
            </article>
          ))}
        </div>

        {catalog.warnings.length ? (
          <ul className="workspace-skill-policy-warnings">
            {catalog.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        ) : null}
      </div>
    </SettingsSection>
  );
}

function BrowserWorkflowSkillSettingsPanel({
  installedSkills,
  onInstall,
}: {
  installedSkills: BrowserWorkflowSkillManifest[];
  onInstall: (skill: BrowserWorkflowSkillManifest) => void;
}) {
  const installedIds = new Set(installedSkills.map((skill) => skill.id));
  const installableSkills = DEFAULT_BROWSER_WORKFLOW_SKILLS.filter((skill) => !installedIds.has(skill.id));

  return (
    <SettingsSection title="Browser workflow skills" defaultOpen={false}>
      <div className="browser-workflow-skill-settings">
        <article className="provider-card browser-workflow-skill-summary-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>Repeatable browser workflows</strong>
              <p>{installedSkills.length} installed · {installableSkills.length} available · permissioned assets and scripts</p>
            </div>
            <span className={`badge${installedSkills.length ? ' connected' : ''}`}>
              {installedSkills.length ? 'ready' : 'empty'}
            </span>
          </div>
        </article>
        {installableSkills.length ? (
          <div className="browser-workflow-skill-install-list" role="list" aria-label="Installable browser workflow skills">
            {installableSkills.map((skill) => (
              <article key={skill.id} className="provider-card browser-workflow-skill-card" role="listitem">
                <div className="provider-card-header">
                  <div className="provider-body">
                    <strong>{skill.name}</strong>
                    <p>{skill.description}</p>
                  </div>
                  <button type="button" className="secondary-button" onClick={() => onInstall(skill)}>
                    Install
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        <div className="browser-workflow-skill-list" role="list" aria-label="Installed browser workflow skills">
          {installedSkills.length ? installedSkills.map((skill) => (
            <article key={skill.id} className="provider-card browser-workflow-skill-card" role="listitem">
              <div className="provider-card-header">
                <div className="provider-body">
                  <strong>{skill.name}</strong>
                  <p>{skill.description}</p>
                </div>
                <span className="badge connected">{skill.version}</span>
              </div>
              <div className="browser-workflow-skill-scope-grid">
                <div>
                  <span className="muted">Tools</span>
                  <code>{skill.permissions.tools.join(', ') || 'none'}</code>
                </div>
                <div>
                  <span className="muted">Paths</span>
                  <code>{skill.permissions.paths.join(', ') || 'none'}</code>
                </div>
                <div>
                  <span className="muted">Assets</span>
                  <code>{skill.assets.map((asset) => asset.path).join(', ') || 'none'}</code>
                </div>
                <div>
                  <span className="muted">Scripts</span>
                  <code>{skill.scripts.map((script) => script.command).join(', ') || 'none'}</code>
                </div>
              </div>
              <p className="partner-agent-audit-note">Triggers: {skill.triggers.join(', ') || 'none'}</p>
            </article>
          )) : (
            <p className="empty-state">No browser workflow skills installed in this workspace.</p>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}

function SymphonyAutopilotSettingsPanel({
  settings,
  onChange,
}: {
  settings: SymphonyAutopilotSettings;
  onChange: (settings: SymphonyAutopilotSettings) => void;
}) {
  return (
    <SettingsSection title="Symphony autopilot" defaultOpen={false}>
      <div className="adversary-review-settings">
        <div className="secret-settings-grid">
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Enable Symphony autopilot"
              checked={settings.autopilotEnabled}
              onChange={(event) => onChange({ ...settings, autopilotEnabled: event.target.checked })}
            />
            <span>
              <strong>Reviewer-agent approvals</strong>
              <small>Allow the critical Symphony reviewer agent to approve clean merge requests or reject them with actionable feedback.</small>
            </span>
          </label>
        </div>
        <article className="provider-card">
          <strong>{settings.autopilotEnabled ? 'Reviewer agent enabled' : 'Reviewer agent disabled'}</strong>
          <p>When enabled, the reviewer agent checks validation status, browser evidence, risk findings, and blocked branches before approving a merge request.</p>
        </article>
      </div>
    </SettingsSection>
  );
}

function BranchingConversationSettingsPanel({
  state,
  onChange,
}: {
  state: ConversationBranchingState;
  onChange: (settings: ConversationBranchSettings) => void;
}) {
  const summary = summarizeConversationBranches(state);
  const update = <K extends keyof ConversationBranchSettings>(key: K, value: ConversationBranchSettings[K]) => {
    onChange({ ...state.settings, [key]: value });
  };

  return (
    <SettingsSection title="Branching conversations" defaultOpen={false}>
      <div className="browser-workflow-skill-settings conversation-branch-settings">
        <article className="provider-card browser-workflow-skill-summary-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>Subthread graph memory</strong>
              <p>{summary.totalSubthreads} subthreads · {summary.commitCount} commits · latest summaries feed the main thread context.</p>
            </div>
            <span className={`badge${state.enabled ? ' connected' : ''}`}>{state.enabled ? 'enabled' : 'off'}</span>
          </div>
          <div className="local-inference-metrics" role="list" aria-label="Conversation branch metrics">
            <span role="listitem">
              <strong>{summary.activeSubthreads}</strong>
              <small>active</small>
            </span>
            <span role="listitem">
              <strong>{summary.mergedSubthreads}</strong>
              <small>merged</small>
            </span>
            <span role="listitem">
              <strong>{summary.commitCount}</strong>
              <small>commits</small>
            </span>
          </div>
          <p className="muted">{summary.latestSummary}</p>
        </article>
        <label className="secret-toggle-row">
          <input
            type="checkbox"
            checked={state.settings.enabled}
            aria-label="Enable conversation branching"
            onChange={(event) => update('enabled', event.target.checked)}
          />
          <span><strong>Conversation branching</strong><small>Allow subthreads to collect branch commits.</small></span>
        </label>
        <label className="secret-toggle-row">
          <input
            type="checkbox"
            checked={state.settings.includeBranchContext}
            aria-label="Inject branch summaries into prompt context"
            onChange={(event) => update('includeBranchContext', event.target.checked)}
          />
          <span><strong>Prompt context</strong><small>Mount active and merged branch summaries into chat instructions.</small></span>
        </label>
        <label className="secret-toggle-row">
          <input
            type="checkbox"
            checked={state.settings.showProcessGraphNodes}
            aria-label="Show branch commits in process graph"
            onChange={(event) => update('showProcessGraphNodes', event.target.checked)}
          />
          <span><strong>Process graph branch nodes</strong><small>Project branch commits as ProcessGraph rows.</small></span>
        </label>
        <label className="secret-toggle-row">
          <input
            type="checkbox"
            checked={state.settings.autoSummarizeOnMerge}
            aria-label="Auto summarize branch merges"
            onChange={(event) => update('autoSummarizeOnMerge', event.target.checked)}
          />
          <span><strong>Merge summaries</strong><small>Keep a compact summary when a branch returns to main.</small></span>
        </label>
      </div>
    </SettingsSection>
  );
}

function SpecDrivenDevelopmentSettingsPanel({
  settings,
  plan,
  onChange,
}: {
  settings: SpecDrivenDevelopmentSettings;
  plan: SpecWorkflowPlan;
  onChange: (settings: SpecDrivenDevelopmentSettings) => void;
}) {
  function update<Key extends keyof SpecDrivenDevelopmentSettings>(
    key: Key,
    value: SpecDrivenDevelopmentSettings[Key],
  ) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <SettingsSection title="Spec-driven development" defaultOpen={false}>
      <div className="spec-driven-development-settings">
        <div className="partner-agent-toolbar">
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
              aria-label="Enable spec-driven development"
            />
            <span>Enable spec-driven development</span>
          </label>
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={settings.resolveAmbiguitiesBeforeImplementation}
              onChange={(event) => update('resolveAmbiguitiesBeforeImplementation', event.target.checked)}
              aria-label="Resolve ambiguities before implementation"
            />
            <span>Resolve ambiguities before implementation</span>
          </label>
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={settings.requireEvalCoverage}
              onChange={(event) => update('requireEvalCoverage', event.target.checked)}
              aria-label="Require tests or evals from spec"
            />
            <span>Require tests or evals</span>
          </label>
        </div>
        <div className="spec-driven-development-grid">
          <label className="provider-command-field">
            <span>Default format</span>
            <select
              aria-label="Default spec format"
              value={settings.defaultFormat}
              onChange={(event) => update('defaultFormat', event.target.value as SpecFormat)}
            >
              {Object.entries(SPEC_FORMAT_LABELS).map(([format, label]) => (
                <option key={format} value={format}>{label}</option>
              ))}
            </select>
          </label>
          <article className="provider-card spec-driven-development-summary-card">
            <div className="provider-card-header">
              <div className="provider-body">
                <strong>{plan.formatLabel}</strong>
                <p>Lifecycle: {plan.stage}</p>
              </div>
              <span className={`badge${plan.enabled ? ' connected' : ''}`}>{plan.enabled ? 'enabled' : 'off'}</span>
            </div>
          </article>
        </div>
        <div className="spec-driven-development-list" role="list" aria-label="Spec-driven validation gates">
          {plan.validationGates.map((gate) => (
            <article key={gate} className="provider-card spec-driven-development-item" role="listitem">
              <strong>{gate}</strong>
            </article>
          ))}
        </div>
        <div className="spec-driven-development-list" role="list" aria-label="Spec-driven ambiguity questions">
          {(plan.ambiguities.length ? plan.ambiguities : ['No ambiguities detected for the current draft prompt.']).map((ambiguity) => (
            <article key={ambiguity} className="provider-card spec-driven-development-item" role="listitem">
              <span>{ambiguity}</span>
            </article>
          ))}
        </div>
      </div>
    </SettingsSection>
  );
}

function MediaAgentSettingsPanel() {
  return (
    <SettingsSection title="Media agent" defaultOpen={false}>
      <div className="browser-workflow-skill-settings">
        <article className="provider-card browser-workflow-skill-summary-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>Media orchestration</strong>
              <p>Coordinates image, voice, SFX, music, and Remotion video workflows with model readiness checks.</p>
            </div>
            <span className="badge connected">5 workflows</span>
          </div>
        </article>
        <div className="browser-workflow-skill-list" role="list" aria-label="Media generation workflows">
          {DEFAULT_MEDIA_CAPABILITY_REQUIREMENTS.map((requirement) => (
            <article key={requirement.kind} className="provider-card browser-workflow-skill-card" role="listitem">
              <div className="provider-card-header">
                <div className="provider-body">
                  <strong>{requirement.label}</strong>
                  <p>{requirement.verificationWorkflow}</p>
                </div>
                <span className="badge">{requirement.kind}</span>
              </div>
              <p className="partner-agent-audit-note">Recommended install: {requirement.recommendedInstall}</p>
            </article>
          ))}
        </div>
      </div>
    </SettingsSection>
  );
}

function HarnessSteeringSettingsPanel({
  state,
  inventory,
  onChange,
}: {
  state: HarnessSteeringState;
  inventory: HarnessSteeringInventory;
  onChange: (state: HarnessSteeringState) => void;
}) {
  const [scope, setScope] = useState<Exclude<HarnessSteeringScope, 'summary'>>('workspace');
  const [text, setText] = useState('');
  const update = <K extends keyof HarnessSteeringState>(key: K, value: HarnessSteeringState[K]) => {
    onChange({ ...state, [key]: value });
  };
  const addCorrection = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const correction = createHarnessSteeringCorrection({
      text: trimmed,
      source: 'manual',
      scope,
    });
    onChange({
      ...state,
      corrections: [
        correction,
        ...state.corrections.filter((entry) => entry.id !== correction.id),
      ],
    });
    setText('');
  };
  const derivativeRows = inventory.fileRows.filter((row) => row.scope !== 'summary');

  return (
    <SettingsSection title="Harness steering" defaultOpen={false}>
      <div className="harness-steering-settings">
        <div className="partner-agent-toolbar">
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={state.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
              aria-label="Enable harness steering"
            />
            <span>Enable harness steering</span>
          </label>
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={state.autoCapture}
              onChange={(event) => update('autoCapture', event.target.checked)}
              aria-label="Auto-capture steering corrections"
            />
            <span>Auto-capture corrections</span>
          </label>
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={state.enforceWithHooks}
              onChange={(event) => update('enforceWithHooks', event.target.checked)}
              aria-label="Enforce steering with hooks"
            />
            <span>Hook enforcement</span>
          </label>
        </div>
        <article className="provider-card harness-steering-summary-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>.steering memory</strong>
              <p>{inventory.totalCorrections} corrections across {derivativeRows.length} scoped files</p>
            </div>
            <span className={`badge${inventory.enabled ? ' connected' : ''}`}>{inventory.enabled ? 'enabled' : 'off'}</span>
          </div>
          <p className="partner-agent-audit-note">
            Summary index: .steering/STEERING.md. Scoped derivative files preserve exact correction text for prompt context, skills, and hooks.
          </p>
        </article>
        <div className="harness-steering-capture-grid">
          <label className="provider-command-field">
            <span>Scope</span>
            <select
              aria-label="Harness steering correction scope"
              value={scope}
              onChange={(event) => setScope(event.target.value as Exclude<HarnessSteeringScope, 'summary'>)}
            >
              <option value="user">user</option>
              <option value="project">project</option>
              <option value="workspace">workspace</option>
              <option value="session">session</option>
              <option value="agent">agent</option>
              <option value="tool">tool</option>
            </select>
          </label>
          <label className="provider-command-field harness-steering-correction-field">
            <span>Correction</span>
            <textarea
              aria-label="Harness steering correction text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              placeholder="Preserve this exact correction in the selected steering scope"
            />
          </label>
          <button
            type="button"
            className="secondary-button"
            onClick={addCorrection}
            disabled={!text.trim()}
          >
            Add correction
          </button>
        </div>
        <div className="harness-steering-file-list" role="list" aria-label="Harness steering files">
          {inventory.fileRows.map((row) => (
            <article key={row.path} className="provider-card harness-steering-file-card" role="listitem">
              <div className="provider-card-header">
                <div className="provider-body">
                  <strong>{row.title}</strong>
                  <p>{row.summary}</p>
                </div>
                <span className={`badge${row.correctionCount > 0 ? ' connected' : ''}`}>{row.scope}</span>
              </div>
              <code>{row.path}</code>
            </article>
          ))}
        </div>
        {inventory.latestCorrection ? (
          <p className="partner-agent-audit-note">
            Latest correction: {inventory.latestCorrection.scope} - {inventory.latestCorrection.text}
          </p>
        ) : null}
        {inventory.warnings.length ? (
          <ul className="workspace-skill-policy-warnings">
            {inventory.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        ) : null}
      </div>
    </SettingsSection>
  );
}

function HarnessEvolutionSettingsPanel({
  settings,
  plan,
  onChange,
}: {
  settings: HarnessEvolutionSettings;
  plan: HarnessEvolutionPlan;
  onChange: (settings: HarnessEvolutionSettings) => void;
}) {
  const normalized = normalizeHarnessEvolutionSettings(settings);
  const update = <K extends keyof HarnessEvolutionSettings>(key: K, value: HarnessEvolutionSettings[K]) => {
    onChange(normalizeHarnessEvolutionSettings({ ...normalized, [key]: value }));
  };
  const updateList = (key: 'allowedPatchScopes' | 'validationCommands', value: string) => {
    update(key, value.split('\n').map((entry) => entry.trim()).filter(Boolean));
  };

  return (
    <SettingsSection title="Harness evolution" defaultOpen={false}>
      <div className="harness-steering-settings">
        <div className="partner-agent-toolbar">
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={normalized.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
              aria-label="Enable harness evolution"
            />
            <span>Enable harness evolution</span>
          </label>
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={normalized.safeModeOnFailure}
              onChange={(event) => update('safeModeOnFailure', event.target.checked)}
              aria-label="Fallback to safe mode on failure"
            />
            <span>Safe-mode fallback</span>
          </label>
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={normalized.requireVisualValidation}
              onChange={(event) => update('requireVisualValidation', event.target.checked)}
              aria-label="Require visual validation"
            />
            <span>Visual validation</span>
          </label>
        </div>
        <article className="provider-card harness-steering-summary-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>Sandboxed patch plan</strong>
              <p>{plan.summary}</p>
            </div>
            <span className={`badge${plan.enabled ? ' connected' : ''}`}>{plan.enabled ? 'enabled' : 'off'}</span>
          </div>
          <div className="local-inference-metrics" role="list" aria-label="Harness evolution metrics">
            <span role="listitem">
              <strong>{plan.validationCommands.length}</strong>
              <small>validation gates</small>
            </span>
            <span role="listitem">
              <strong>{plan.protectedScopes.length}</strong>
              <small>protected scopes</small>
            </span>
            <span role="listitem">
              <strong>{plan.visualValidationRequired ? 'required' : 'optional'}</strong>
              <small>visual proof</small>
            </span>
          </div>
          <p className="partner-agent-audit-note">
            Patch candidates stay in a sandbox until tests, lint, audit, and visual checks pass. Failed patches fall back to the original component path before another sandbox iteration.
          </p>
        </article>
        <div className="harness-steering-capture-grid">
          <label className="provider-command-field">
            <span>Sandbox root</span>
            <input
              aria-label="Harness evolution sandbox root"
              value={normalized.sandboxRoot}
              onChange={(event) => update('sandboxRoot', event.target.value)}
            />
          </label>
          <label className="provider-command-field">
            <span>Patch command</span>
            <input
              aria-label="Harness evolution patch command"
              value={normalized.patchPackageCommand}
              onChange={(event) => update('patchPackageCommand', event.target.value)}
            />
          </label>
          <label className="provider-command-field harness-steering-correction-field">
            <span>Validation commands</span>
            <textarea
              aria-label="Harness evolution validation commands"
              value={normalized.validationCommands.join('\n')}
              onChange={(event) => updateList('validationCommands', event.target.value)}
              rows={4}
            />
          </label>
          <label className="provider-command-field harness-steering-correction-field">
            <span>Protected patch scopes</span>
            <textarea
              aria-label="Harness evolution protected patch scopes"
              value={normalized.allowedPatchScopes.join('\n')}
              onChange={(event) => updateList('allowedPatchScopes', event.target.value)}
              rows={4}
            />
          </label>
        </div>
        <div className="harness-steering-file-list" role="list" aria-label="Harness evolution gates">
          {plan.adoptionGate.map((gate) => (
            <article key={gate} className="provider-card harness-steering-file-card" role="listitem">
              <div className="provider-card-header">
                <div className="provider-body">
                  <strong>Adoption gate</strong>
                  <p>{gate}</p>
                </div>
                <span className="badge connected">gate</span>
              </div>
            </article>
          ))}
          {plan.fallbackActions.map((action) => (
            <article key={action} className="provider-card harness-steering-file-card" role="listitem">
              <div className="provider-card-header">
                <div className="provider-body">
                  <strong>Fallback action</strong>
                  <p>{action}</p>
                </div>
                <span className="badge">safe mode</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </SettingsSection>
  );
}

function PersistentMemoryGraphSettingsPanel({
  state,
  onChange,
}: {
  state: PersistentMemoryGraphState;
  onChange: (state: PersistentMemoryGraphState) => void;
}) {
  const [title, setTitle] = useState('Memory graph note');
  const [source, setSource] = useState('manual');
  const [text, setText] = useState('Kuzu-WASM enables offline graph traversal. GraphRAG connects local evidence to claims.');
  const [question, setQuestion] = useState('How does Kuzu-WASM support offline retrieval?');
  const [query, setQuery] = useState('MATCH (c:Chunk)-[:MENTIONS]->(e:Entity) RETURN c.id, c.text, e.name, e.type;');
  const [importJson, setImportJson] = useState('');
  const [searchResult, setSearchResult] = useState<MemoryGraphRetrievalResult | null>(() =>
    state.chunks.length > 0 ? searchPersistentMemoryGraph(state, question) : null,
  );
  const [queryResult, setQueryResult] = useState<MemoryGraphQueryResult | null>(() =>
    state.chunks.length > 0 ? runMemoryGraphQuery(state, query) : null,
  );
  const [status, setStatus] = useState('Worker boundary ready; local graph is offline-ready.');

  const loadSample = () => {
    const next = loadSampleMemoryGraph();
    onChange(next);
    const nextSearch = searchPersistentMemoryGraph(next, question);
    setSearchResult(nextSearch);
    setQueryResult(runMemoryGraphQuery(next, query));
    setStatus('Loaded sample memory into the browser-local graph.');
  };
  const ingest = () => {
    const next = ingestTextToMemoryGraph(state, { title, source, text });
    onChange(next);
    setSearchResult(searchPersistentMemoryGraph(next, question));
    setQueryResult(runMemoryGraphQuery(next, query));
    setStatus(`Ingested ${title.trim() || 'Untitled memory document'} into persistent graph memory.`);
  };
  const search = () => {
    const nextSearch = searchPersistentMemoryGraph(state, question);
    setSearchResult(nextSearch);
    setStatus(`Retrieved ${nextSearch.chunks.length} chunks and ${nextSearch.paths.length} ranked paths.`);
  };
  const runQuery = () => {
    const nextQuery = runMemoryGraphQuery(state, query);
    setQueryResult(nextQuery);
    setStatus(`Query returned ${nextQuery.rows.length} rows.`);
  };
  const exportGraph = () => {
    const exported = exportPersistentMemoryGraph(state);
    setImportJson(exported);
    setStatus('Exported memory graph JSON into the import/export editor.');
  };
  const importGraph = () => {
    try {
      const next = importPersistentMemoryGraph(importJson);
      onChange(next);
      setSearchResult(searchPersistentMemoryGraph(next, question));
      setQueryResult(runMemoryGraphQuery(next, query));
      setStatus('Imported persistent memory graph JSON.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };
  const resetGraph = () => {
    const next = createPersistentMemoryGraphState();
    onChange(next);
    setSearchResult(null);
    setQueryResult(null);
    setStatus('Reset local graph memory.');
  };
  const graph = searchResult?.subgraph ?? queryResult?.graph ?? { nodes: [], edges: [] };

  return (
    <SettingsSection title="Persistent memory graphs" defaultOpen={false}>
      <div className="persistent-memory-graph-settings">
        <article className="provider-card persistent-memory-graph-summary-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>WASM-compatible local graph</strong>
              <p>
                Worker-shaped GraphRAG memory with local JSON persistence, deterministic extraction,
                PathRAG explanations, and a Kuzu-WASM adapter seam.
              </p>
            </div>
            <span className={`badge${state.engine.status === 'ready' ? ' connected' : ''}`}>{state.engine.status}</span>
          </div>
          <div className="local-inference-metrics" role="list" aria-label="Persistent memory graph metrics">
            <span role="listitem"><strong>{state.documents.length}</strong><small>documents</small></span>
            <span role="listitem"><strong>{state.chunks.length}</strong><small>chunks</small></span>
            <span role="listitem"><strong>{state.entities.length}</strong><small>entities</small></span>
            <span role="listitem"><strong>{state.relationships.length}</strong><small>edges</small></span>
          </div>
          <p className="partner-agent-audit-note" role="status">{status}</p>
        </article>

        <div className="persistent-memory-graph-toolbar">
          <button type="button" onClick={loadSample}><Icon name="sparkles" size={14} />Load sample memory</button>
          <button type="button" onClick={ingest}><Icon name="plus" size={14} />Ingest Text</button>
          <button type="button" onClick={search}><Icon name="search" size={14} />Search Memory</button>
          <button type="button" onClick={runQuery}><Icon name="terminal" size={14} />Run Query</button>
          <button type="button" onClick={exportGraph}><Icon name="download" size={14} />Export Memory</button>
          <button type="button" onClick={importGraph}><Icon name="folderInput" size={14} />Import Memory</button>
          <button type="button" className="danger-button" onClick={resetGraph}><Icon name="trash" size={14} />Reset Memory</button>
        </div>

        <div className="persistent-memory-graph-input-grid">
          <label className="provider-command-field">
            <span>Document title</span>
            <input aria-label="Memory graph document title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="provider-command-field">
            <span>Source</span>
            <input aria-label="Memory graph source" value={source} onChange={(event) => setSource(event.target.value)} />
          </label>
          <label className="provider-command-field persistent-memory-graph-wide-field">
            <span>Ingest text</span>
            <textarea aria-label="Memory graph ingest text" value={text} onChange={(event) => setText(event.target.value)} rows={4} />
          </label>
          <label className="provider-command-field persistent-memory-graph-wide-field">
            <span>Question</span>
            <input aria-label="Memory graph question" value={question} onChange={(event) => setQuestion(event.target.value)} />
          </label>
          <label className="provider-command-field persistent-memory-graph-wide-field">
            <span>Graph query</span>
            <textarea aria-label="Memory graph query" value={query} onChange={(event) => setQuery(event.target.value)} rows={3} />
          </label>
        </div>

        <div className="persistent-memory-graph-results">
          <article className="provider-card persistent-memory-graph-result-card">
            <div className="provider-card-header">
              <div className="provider-body">
                <strong>Context</strong>
                <p>Prompt-ready GraphRAG context with local citation IDs.</p>
              </div>
              <span className="badge">{searchResult?.chunks.length ?? 0} chunks</span>
            </div>
            <pre>{searchResult?.contextBlock ?? 'Load or ingest memory, then search to build a context block.'}</pre>
          </article>

          <article className="provider-card persistent-memory-graph-result-card">
            <div className="provider-card-header">
              <div className="provider-body">
                <strong>Paths</strong>
                <p>PathRAG explanations for why memory was retrieved.</p>
              </div>
              <span className="badge">{searchResult?.paths.length ?? 0} paths</span>
            </div>
            <div className="persistent-memory-graph-path-list" role="list" aria-label="Persistent memory graph paths">
              {(searchResult?.paths ?? []).map((path, index) => (
                <article key={`${path.id}:${index}`} className="provider-card persistent-memory-graph-path-card" role="listitem">
                  <strong>{path.nodes.map((node) => node.label).join(' -> ')}</strong>
                  <p>{path.explanation}</p>
                  <small>Score {path.score.toFixed(2)} · {path.relationships.join(', ')}</small>
                </article>
              ))}
              {!searchResult ? <p className="muted">No retrieved paths yet.</p> : null}
            </div>
          </article>

          <article className="provider-card persistent-memory-graph-result-card">
            <div className="provider-card-header">
              <div className="provider-body">
                <strong>Graph</strong>
                <p>Retrieved subgraph for the selected memory search or query.</p>
              </div>
              <span className="badge">{graph.nodes.length} nodes · {graph.edges.length} edges</span>
            </div>
            <svg className="persistent-memory-graph-svg" role="img" aria-label="Retrieved memory graph" viewBox="0 0 360 180">
              {graph.edges.slice(0, 12).map((edge, index) => {
                const sourceIndex = Math.max(0, graph.nodes.findIndex((node) => node.id === edge.sourceId));
                const targetIndex = Math.max(0, graph.nodes.findIndex((node) => node.id === edge.targetId));
                return (
                  <line
                    key={edge.id}
                    x1={graphNodeX(sourceIndex)}
                    y1={graphNodeY(sourceIndex)}
                    x2={graphNodeX(targetIndex)}
                    y2={graphNodeY(targetIndex)}
                    stroke="rgba(125, 211, 252, 0.28)"
                    strokeWidth={Math.max(1, 2 - index * 0.04)}
                  />
                );
              })}
              {graph.nodes.slice(0, 12).map((node, index) => (
                <g key={node.id}>
                  <circle cx={graphNodeX(index)} cy={graphNodeY(index)} r="13" fill={graphNodeFill(node.type)} />
                  <text x={graphNodeX(index)} y={graphNodeY(index) + 28} textAnchor="middle">{node.label.slice(0, 18)}</text>
                </g>
              ))}
            </svg>
          </article>

          <article className="provider-card persistent-memory-graph-result-card">
            <div className="provider-card-header">
              <div className="provider-body">
                <strong>Table</strong>
                <p>Direct graph query rows and raw JSON exchange.</p>
              </div>
              <span className="badge">{queryResult?.rows.length ?? 0} rows</span>
            </div>
            <pre>{JSON.stringify(queryResult?.rows ?? [], null, 2)}</pre>
            <label className="provider-command-field">
              <span>Raw JSON</span>
              <textarea aria-label="Memory graph import export JSON" value={importJson} onChange={(event) => setImportJson(event.target.value)} rows={5} />
            </label>
          </article>
        </div>
      </div>
    </SettingsSection>
  );
}

function graphNodeX(index: number): number {
  return 38 + ((index % 4) * 92);
}

function graphNodeY(index: number): number {
  return 34 + (Math.floor(index / 4) * 62);
}

function graphNodeFill(type: string): string {
  if (type === 'Entity') return '#38bdf8';
  if (type === 'Claim') return '#a7f3d0';
  if (type === 'Memory') return '#fbbf24';
  if (type === 'Topic') return '#c4b5fd';
  return '#64748b';
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

function N8nCapabilitiesSettingsPanel() {
  const areas = useMemo(() => listN8nCapabilityAreas(), []);
  const summary = useMemo(() => buildN8nCapabilitySummary(), []);
  const preview = useMemo(() => buildServerlessWorkflowPreview(), []);
  const previewStepNames = preview.document.do.map((step) => Object.keys(step)[0] ?? 'step');

  return (
    <SettingsSection title="n8n capabilities" defaultOpen={false}>
      <div className="n8n-capabilities-settings">
        <article className="provider-card n8n-capabilities-summary-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>{summary.serializationStandard}</strong>
              <p>Offline automation blueprints map n8n-style workflows, nodes, executions, credentials, templates, and AI/RAG work to a portable CNCF workflow document.</p>
            </div>
            <span className="badge connected">{summary.totalAreas} areas</span>
          </div>
          <div className="local-inference-metrics" role="list" aria-label="n8n capability readiness">
            <span role="listitem">
              <strong>{summary.readyAreas}</strong>
              <small>ready</small>
            </span>
            <span role="listitem">
              <strong>{summary.foundationAreas}</strong>
              <small>foundation</small>
            </span>
            <span role="listitem">
              <strong>{summary.plannedAreas}</strong>
              <small>planned</small>
            </span>
          </div>
          <div className="browser-agent-run-sdk-chip-grid" aria-label="Starter workflow coverage">
            {preview.coverage.map((item) => <span key={item} className="tag-chip">{item}</span>)}
          </div>
        </article>

        <div className="n8n-capability-grid" role="list" aria-label="n8n capability areas">
          {areas.map((area) => (
            <article key={area.id} className="provider-card n8n-capability-card" role="listitem">
              <div className="provider-card-header">
                <div className="provider-body">
                  <strong>{area.title}</strong>
                  <p>{area.summary}</p>
                </div>
                <span className={`badge${area.status === 'ready' ? ' connected' : ''}`}>{formatN8nCapabilityStatus(area.status)}</span>
              </div>
              <div className="n8n-capability-columns">
                <CapabilityList title="n8n" items={area.n8nFeatures} />
                <CapabilityList title="Offline PWA" items={area.offlinePwaPlan} />
                <CapabilityList title="Serverless Workflow" items={area.serverlessWorkflowMapping} />
              </div>
            </article>
          ))}
        </div>

        <article className="provider-card n8n-workflow-preview-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>Starter workflow preview</strong>
              <p>{preview.document.document.namespace} / {preview.document.document.name} v{preview.document.document.version}</p>
            </div>
            <span className="badge">{preview.document.document.dsl}</span>
          </div>
          <div className="browser-agent-run-sdk-chip-grid" aria-label="Serverless Workflow preview steps">
            {previewStepNames.map((name) => <code key={name}>{name}</code>)}
          </div>
        </article>
      </div>
    </SettingsSection>
  );
}

function CapabilityList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <strong>{title}</strong>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function formatN8nCapabilityStatus(status: N8nCapabilityStatus): string {
  if (status === 'ready') return 'ready';
  if (status === 'foundation') return 'foundation';
  return 'planned';
}

type GraphKnowledgeTab = 'context' | 'hot' | 'evidence' | 'facts' | 'paths' | 'communities' | 'skills' | 'graph' | 'table' | 'raw';

const GRAPH_KNOWLEDGE_TABS: Array<{ id: GraphKnowledgeTab; label: string }> = [
  { id: 'context', label: 'Context Pack' },
  { id: 'hot', label: 'Hot Memory' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'facts', label: 'Facts & Claims' },
  { id: 'paths', label: 'Paths' },
  { id: 'communities', label: 'Communities' },
  { id: 'skills', label: 'Skills' },
  { id: 'graph', label: 'Graph' },
  { id: 'table', label: 'Table' },
  { id: 'raw', label: 'Raw JSON' },
];

function GraphKnowledgeSettingsPanel({
  state,
  onChange,
}: {
  state: GraphKnowledgeState;
  onChange: (state: GraphKnowledgeState) => void;
}) {
  const [query, setQuery] = useState('offline graph memory PathRAG Kuzu-WASM');
  const [ingestText, setIngestText] = useState('Kuzu-WASM enables local graph traversal. PathRAG improves explainability for offline agent memory.');
  const [sessionText, setSessionText] = useState('user: We need persistent graph memory.\nassistant: Use IndexedDB, a worker boundary, and hot context blocks.');
  const [skillName, setSkillName] = useState('Build graph knowledge context pack');
  const [activeTab, setActiveTab] = useState<GraphKnowledgeTab>('context');
  const [statusMessage, setStatusMessage] = useState('Offline-ready graph memory');
  const stats = useMemo(() => getGraphKnowledgeStats(state), [state]);
  const searchResult = useMemo<GraphKnowledgeSearchResult>(() => searchGraphKnowledge(state, query), [state, query]);
  const contextPack = useMemo<GraphKnowledgeContextPack>(() => buildGraphKnowledgeContextPack(state, query), [state, query]);
  const graphPreview = useMemo(() => ({
    nodes: stats.graphNodes,
    edges: stats.graphEdges,
    topEntities: searchResult.entities.map((entity) => entity.canonicalName),
    topPaths: searchResult.paths.map((path) => JSON.parse(path.pathJson) as string[]),
  }), [searchResult.entities, searchResult.paths, stats.graphEdges, stats.graphNodes]);

  const update = (next: GraphKnowledgeState, message: string) => {
    onChange(next);
    setStatusMessage(message);
  };
  const parseSessionTurns = () => sessionText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(user|assistant|system):\s*(.+)$/i);
      return {
        role: (match?.[1]?.toLowerCase() ?? 'user') as 'user' | 'assistant' | 'system',
        text: match?.[2] ?? line,
      };
    });

  return (
    <SettingsSection title="Graph knowledge" defaultOpen={false}>
      <div className="graph-knowledge-settings">
        <article className="provider-card graph-knowledge-summary-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>Offline-ready graph memory</strong>
              <p>Local GraphRAG, PathRAG, activation retrieval, procedural recall, and prompt-ready context packs run without a backend or network call.</p>
            </div>
            <span className={`badge${stats.status === 'offline-ready' ? ' connected' : ''}`}>{stats.status}</span>
          </div>
          <div className="local-inference-metrics" role="list" aria-label="Graph knowledge tier status">
            <span role="listitem">
              <strong>{stats.hotMemoryBlocks}</strong>
              <small>Tier 1 blocks</small>
            </span>
            <span role="listitem">
              <strong>{stats.graphNodes}</strong>
              <small>Tier 2 nodes</small>
            </span>
            <span role="listitem">
              <strong>{stats.graphEdges}</strong>
              <small>graph edges</small>
            </span>
            <span role="listitem">
              <strong>{stats.archiveRecords}</strong>
              <small>Tier 3 archive</small>
            </span>
            <span role="listitem">
              <strong>{stats.skillCount}</strong>
              <small>skills</small>
            </span>
          </div>
          <p className="muted" role="status">{statusMessage}</p>
          <div className="graph-knowledge-action-grid" aria-label="Graph knowledge controls">
            <button type="button" className="secondary-button" onClick={() => update(loadSampleGraphKnowledge(), 'Loaded sample GraphRAG memory.')}>Load Sample Memory</button>
            <button type="button" className="secondary-button" onClick={() => update(ingestGraphKnowledgeText(state, { title: 'Manual graph note', text: ingestText, source: 'settings ingest' }), 'Ingested text into graph memory.')}>Ingest Text</button>
            <button type="button" className="secondary-button" onClick={() => update(ingestGraphKnowledgeSession(state, { title: 'Settings session ingest', turns: parseSessionTurns() }), 'Ingested session turns into episodic memory.')}>Ingest Session</button>
            <button type="button" className="secondary-button" onClick={() => update(ingestGraphKnowledgeSkill(state, { name: skillName, description: 'Generate compact context packs from local graph memory.', steps: ['Search memory', 'Rank paths', 'Build context pack'], tools: ['Graph knowledge'] }), 'Added procedural skill.')}>Add Skill</button>
            <button type="button" className="secondary-button" onClick={() => setStatusMessage(`Search Memory found ${searchResult.scoreBreakdowns.length} scored results.`)}>Search Memory</button>
            <button type="button" className="secondary-button" onClick={() => { onChange({ ...state, contextPacks: [...state.contextPacks, contextPack], updatedAt: contextPack.createdAt }); setStatusMessage('Generated context pack.'); }}>Generate Context Pack</button>
            <button type="button" className="secondary-button" onClick={() => setStatusMessage(`Run Query returned ${stats.graphNodes} nodes and ${stats.graphEdges} edges.`)}>Run Query</button>
            <button type="button" className="secondary-button" onClick={() => update(consolidateGraphKnowledge(state), 'Consolidated contradictions and superseded facts.')}>Consolidate Memory</button>
            <button type="button" className="secondary-button" onClick={() => update(promoteGraphKnowledgeToHotMemory(state, query), 'Promoted relevant memories to hot memory.')}>Promote to Hot Memory</button>
            <button type="button" className="secondary-button" onClick={() => update(consolidateGraphKnowledge(state), 'Evolved links and refreshed graph relations.')}>Evolve Links</button>
            <button type="button" className="secondary-button" onClick={() => setStatusMessage(`Export Memory ready: ${exportGraphKnowledge(state).length} bytes.`)}>Export Memory</button>
            <button type="button" className="secondary-button" onClick={() => update(importGraphKnowledge(exportGraphKnowledge(state)), 'Import Memory round-trip validated.')}>Import Memory</button>
            <button type="button" className="secondary-button danger-button" onClick={() => update(createEmptyGraphKnowledgeState(), 'Reset Memory completed.')}>Reset Memory</button>
          </div>
        </article>

        <div className="graph-knowledge-input-grid">
          <label className="provider-command-field">
            <span>Natural-language memory search</span>
            <input aria-label="Graph knowledge search query" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="provider-command-field">
            <span>Ingest text</span>
            <textarea aria-label="Graph knowledge ingest text" value={ingestText} onChange={(event) => setIngestText(event.target.value)} rows={3} />
          </label>
          <label className="provider-command-field">
            <span>Session log</span>
            <textarea aria-label="Graph knowledge session log" value={sessionText} onChange={(event) => setSessionText(event.target.value)} rows={3} />
          </label>
          <label className="provider-command-field">
            <span>Procedural skill</span>
            <input aria-label="Graph knowledge skill name" value={skillName} onChange={(event) => setSkillName(event.target.value)} />
          </label>
        </div>

        <div className="graph-knowledge-tabs" role="tablist" aria-label="Graph knowledge result tabs">
          {GRAPH_KNOWLEDGE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`chip ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <article className="provider-card graph-knowledge-result-card">
          {activeTab === 'context' ? (
            <pre aria-label="Graph knowledge context pack">{contextPack.text}</pre>
          ) : null}
          {activeTab === 'hot' ? <GraphKnowledgeList items={searchResult.hotMemoryBlocks.map((block) => `${block.name}: ${block.content}`)} empty="No hot memory blocks match this query." /> : null}
          {activeTab === 'evidence' ? <GraphKnowledgeList items={searchResult.evidence.map((entry) => `${entry.id}: ${entry.text} (${entry.sourceRef})`)} empty="No evidence matched this query." /> : null}
          {activeTab === 'facts' ? <GraphKnowledgeList items={[...searchResult.facts.map((fact) => `${fact.id}: ${fact.object}`), ...searchResult.claims.map((claim) => `${claim.id}: ${claim.text} [${claim.status}]`)]} empty="No facts or claims matched this query." /> : null}
          {activeTab === 'paths' ? <GraphKnowledgeList items={searchResult.paths.map((path) => `${JSON.parse(path.pathJson).join(' -> ')} - ${path.explanation}`)} empty="No paths matched this query." /> : null}
          {activeTab === 'communities' ? <GraphKnowledgeList items={searchResult.communities.map((community) => `${community.name}: ${community.summary}`)} empty="No community summaries matched this query." /> : null}
          {activeTab === 'skills' ? <GraphKnowledgeList items={searchResult.skills.map((skill) => `${skill.name}: ${skill.steps.join(' -> ')}`)} empty="No procedural skills matched this query." /> : null}
          {activeTab === 'graph' ? <pre aria-label="Graph knowledge graph preview">{JSON.stringify(graphPreview, null, 2)}</pre> : null}
          {activeTab === 'table' ? <GraphKnowledgeScoreTable result={searchResult} /> : null}
          {activeTab === 'raw' ? <pre aria-label="Graph knowledge raw JSON">{JSON.stringify({ stats, result: searchResult, citations: contextPack.localCitationIds }, null, 2)}</pre> : null}
        </article>
      </div>
    </SettingsSection>
  );
}

function GraphKnowledgeList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="graph-knowledge-list">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

function GraphKnowledgeScoreTable({ result }: { result: GraphKnowledgeSearchResult }) {
  if (!result.scoreBreakdowns.length) return <p className="muted">No score breakdowns available.</p>;
  return (
    <div className="graph-knowledge-score-table" role="table" aria-label="Graph knowledge score breakdowns">
      <div role="row">
        <strong role="columnheader">Result</strong>
        <strong role="columnheader">Lexical</strong>
        <strong role="columnheader">Path</strong>
        <strong role="columnheader">Activation</strong>
        <strong role="columnheader">Total</strong>
      </div>
      {result.scoreBreakdowns.slice(0, 8).map((breakdown) => (
        <div role="row" key={breakdown.id}>
          <span role="cell">{breakdown.label}</span>
          <span role="cell">{breakdown.lexicalScore.toFixed(1)}</span>
          <span role="cell">{breakdown.pathScore.toFixed(1)}</span>
          <span role="cell">{breakdown.activationScore.toFixed(1)}</span>
          <span role="cell">{breakdown.totalScore.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

function RunCheckpointSettingsPanel({
  state,
  onChange,
}: {
  state: RunCheckpointState;
  onChange: (state: RunCheckpointState) => void;
}) {
  const activeCheckpoints = state.checkpoints.filter((checkpoint) => checkpoint.status === 'suspended');
  const updatePolicy = (patch: Partial<RunCheckpointPolicy>) => {
    onChange(updateRunCheckpointPolicy(state, patch));
  };

  return (
    <SettingsSection title="Suspend/resume checkpoints" defaultOpen={false}>
      <div className="run-checkpoint-settings">
        <article className="provider-card run-checkpoint-policy-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>Checkpoint policy</strong>
              <p>Persist pause boundaries for approval, credentials, and delayed human input.</p>
            </div>
            <span className={`badge${activeCheckpoints.length ? ' connected' : ''}`}>
              {activeCheckpoints.length} active
            </span>
          </div>
          <div className="run-checkpoint-control-grid">
            <label className="provider-command-field">
              <span>Timeout minutes</span>
              <input
                aria-label="Default checkpoint timeout"
                type="number"
                min={5}
                max={10080}
                step={5}
                value={state.policy.defaultTimeoutMinutes}
                onChange={(event) => updatePolicy({ defaultTimeoutMinutes: Number(event.target.value) })}
              />
            </label>
            <label className="settings-checkbox-row">
              <input
                type="checkbox"
                aria-label="Require operator confirmation before resume"
                checked={state.policy.requireOperatorConfirmation}
                onChange={(event) => updatePolicy({ requireOperatorConfirmation: event.target.checked })}
              />
              <span>Require operator confirmation before resume</span>
            </label>
            <label className="settings-checkbox-row">
              <input
                type="checkbox"
                aria-label="Preserve checkpoint artifacts"
                checked={state.policy.preserveArtifacts}
                onChange={(event) => updatePolicy({ preserveArtifacts: event.target.checked })}
              />
              <span>Preserve checkpoint artifacts</span>
            </label>
          </div>
        </article>
        {activeCheckpoints.map((checkpoint) => (
          <RunCheckpointCard key={checkpoint.id} checkpoint={checkpoint} />
        ))}
      </div>
    </SettingsSection>
  );
}

function RunCheckpointCard({ checkpoint }: { checkpoint: RunCheckpoint }) {
  return (
    <article className="provider-card run-checkpoint-card">
      <div className="provider-card-header">
        <div className="provider-body">
          <strong>{checkpoint.summary}</strong>
          <p>{checkpoint.boundary} · {checkpoint.requiredInput}</p>
        </div>
        <span className="badge connected">{checkpoint.reason}</span>
      </div>
      <div className="run-checkpoint-token-row">
        <code>{checkpoint.resumeToken}</code>
        <span>Expires {new Date(checkpoint.expiresAt).toLocaleString()}</span>
      </div>
      {checkpoint.artifacts.length ? (
        <p className="muted">Artifacts: {checkpoint.artifacts.join(', ')}</p>
      ) : null}
    </article>
  );
}

function SessionChapterSettingsPanel({
  state,
  onChange,
}: {
  state: ChapteredSessionState;
  onChange: (state: ChapteredSessionState) => void;
}) {
  const summary = summarizeChapteredSessionState(state);
  const updatePolicy = (patch: Partial<SessionChapterPolicy>) => {
    onChange(updateSessionChapterPolicy(state, patch));
  };

  return (
    <SettingsSection title="Chaptered sessions" defaultOpen={false}>
      <div className="session-chapter-settings">
        <article className="provider-card session-chapter-summary-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>Automatic context compression</strong>
              <p>Group long browser-agent runs into chapters while preserving source trace, browser evidence, and validation refs.</p>
            </div>
            <span className={`badge${state.enabled ? ' connected' : ''}`}>
              {state.enabled ? 'enabled' : 'off'}
            </span>
          </div>
          <div className="local-inference-metrics" role="list" aria-label="Chaptered session metrics">
            <span role="listitem">
              <strong>{summary.sessionCount}</strong>
              <small>sessions</small>
            </span>
            <span role="listitem">
              <strong>{summary.chapterCount}</strong>
              <small>chapters</small>
            </span>
            <span role="listitem">
              <strong>{summary.evidenceRefCount}</strong>
              <small>evidence refs</small>
            </span>
            <span role="listitem">
              <strong>{Object.keys(state.toolOutputCache).length}</strong>
              <small>tool caches</small>
            </span>
          </div>
          <p className="muted">{summary.sessionCount} session · {summary.chapterCount} chapter · {state.audit.length} audit event{state.audit.length === 1 ? '' : 's'}</p>
          <div className="run-checkpoint-control-grid">
            <label className="settings-checkbox-row">
              <input
                type="checkbox"
                aria-label="Enable chaptered sessions"
                checked={state.enabled}
                onChange={(event) => onChange({ ...state, enabled: event.target.checked })}
              />
              <span>Enable chaptered sessions</span>
            </label>
            <label className="settings-checkbox-row">
              <input
                type="checkbox"
                aria-label="Automatic context compression"
                checked={state.policy.automaticCompression}
                onChange={(event) => updatePolicy({ automaticCompression: event.target.checked })}
              />
              <span>Automatic context compression</span>
            </label>
            <label className="settings-checkbox-row">
              <input
                type="checkbox"
                aria-label="Preserve chapter evidence references"
                checked={state.policy.preserveEvidenceRefs}
                onChange={(event) => updatePolicy({ preserveEvidenceRefs: event.target.checked })}
              />
              <span>Preserve evidence references</span>
            </label>
            <label className="settings-checkbox-row">
              <input
                type="checkbox"
                aria-label="Render compacted context summaries"
                checked={state.policy.renderCompressedMessages}
                onChange={(event) => updatePolicy({ renderCompressedMessages: event.target.checked })}
              />
              <span>Render compacted summaries</span>
            </label>
            <label className="settings-checkbox-row">
              <input
                type="checkbox"
                aria-label="Cache large tool outputs"
                checked={state.policy.toolOutputCache.enabled}
                onChange={(event) => updatePolicy({
                  toolOutputCache: { ...state.policy.toolOutputCache, enabled: event.target.checked },
                })}
              />
              <span>Cache large tool outputs</span>
            </label>
            <label className="provider-command-field">
              <span>Context mode</span>
              <select
                aria-label="Context manager mode"
                value={state.policy.contextMode}
                onChange={(event) => updatePolicy({ contextMode: event.target.value === 'caveman' ? 'caveman' : 'standard' })}
              >
                <option value="standard">Standard</option>
                <option value="caveman">Caveman</option>
              </select>
            </label>
            <label className="provider-command-field">
              <span>Target tokens</span>
              <input
                aria-label="Chapter compression target tokens"
                type="number"
                min={512}
                max={32000}
                step={128}
                value={state.policy.targetTokenBudget}
                onChange={(event) => updatePolicy({ targetTokenBudget: Number(event.target.value) })}
              />
            </label>
            <label className="provider-command-field">
              <span>Retain recent messages</span>
              <input
                aria-label="Chapter retained recent messages"
                type="number"
                min={1}
                max={50}
                value={state.policy.retainRecentMessageCount}
                onChange={(event) => updatePolicy({ retainRecentMessageCount: Number(event.target.value) })}
              />
            </label>
            <label className="provider-command-field">
              <span>Inline tool-output tokens</span>
              <input
                aria-label="Inline tool-output cache token limit"
                type="number"
                min={16}
                max={32000}
                step={64}
                value={state.policy.toolOutputCache.inlineTokenLimit}
                onChange={(event) => updatePolicy({
                  toolOutputCache: { ...state.policy.toolOutputCache, inlineTokenLimit: Number(event.target.value) },
                })}
              />
            </label>
            <label className="provider-command-field">
              <span>File cache threshold</span>
              <input
                aria-label="File tool-output cache token threshold"
                type="number"
                min={16}
                max={128000}
                step={128}
                value={state.policy.toolOutputCache.fileTokenThreshold}
                onChange={(event) => updatePolicy({
                  toolOutputCache: { ...state.policy.toolOutputCache, fileTokenThreshold: Number(event.target.value) },
                })}
              />
            </label>
          </div>
        </article>
        {summary.latestChapter ? (
          <article className="provider-card session-chapter-latest-card">
            <div className="provider-card-header">
              <div className="provider-body">
                <strong>{summary.latestChapter.title}</strong>
                <p>{summary.latestChapter.compressedContext.summary}</p>
              </div>
              <span className="badge connected">{summary.latestChapter.status}</span>
            </div>
            <div className="browser-agent-run-sdk-chip-grid" aria-label="Latest chapter references">
              {summary.latestChapter.sourceTraceRefs.slice(0, 3).map((ref) => <code key={ref}>{ref}</code>)}
              {summary.latestChapter.evidenceRefs.slice(0, 2).map((ref) => <code key={ref}>{ref}</code>)}
              {summary.latestChapter.validationRefs.slice(0, 2).map((ref) => <code key={ref}>{ref}</code>)}
            </div>
          </article>
        ) : null}
      </div>
    </SettingsSection>
  );
}

function linesFromTextarea(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function RuntimePluginSettingsPanel({
  settings,
  runtime,
  onChange,
}: {
  settings: RuntimePluginSettings;
  runtime: RuntimePluginRuntime;
  onChange: (settings: RuntimePluginSettings) => void;
}) {
  function update<Key extends keyof RuntimePluginSettings>(
    key: Key,
    value: RuntimePluginSettings[Key],
  ) {
    onChange({ ...settings, [key]: value });
  }

  const blockedToolText = settings.blockedToolIds.join('\n');
  const rewriteRulesText = settings.rewriteRules.join('\n');
  const enabledPluginText = settings.enabledPluginIds.join('\n');

  return (
    <SettingsSection title="Runtime plugins" defaultOpen={false}>
      <div className="runtime-plugin-settings">
        <div className="secret-settings-grid">
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Enable runtime plugins"
              checked={settings.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
            />
            <span>
              <strong>Plugin runtime</strong>
              <small>Load data-only manifests for tools, providers, events, and policy hooks.</small>
            </span>
          </label>
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Require runtime plugin rationale"
              checked={settings.requireRationale}
              onChange={(event) => update('requireRationale', event.target.checked)}
            />
            <span>
              <strong>Audit rationale</strong>
              <small>Require interception decisions to include a visible rationale.</small>
            </span>
          </label>
        </div>

        <div className="provider-list runtime-plugin-summary" aria-label="Runtime plugin summary">
          <article className="provider-card">
            <strong>{runtime.activePluginCount}/{runtime.manifestCount} active plugins</strong>
            <p>{runtime.toolRegistrations.length} tools · {runtime.providerRegistrations.length} providers · {Object.keys(runtime.eventSubscriptions).length} event hooks</p>
            <div className="local-inference-badges" aria-label="Runtime plugin status">
              <span className={`badge${runtime.enabled ? ' connected' : ''}`}>{runtime.enabled ? 'enabled' : 'off'}</span>
              <span className="badge">{settings.defaultInterceptionMode}</span>
            </div>
          </article>
          {runtime.activePlugins.map((plugin) => (
            <article key={plugin.id} className="provider-card">
              <strong>{plugin.name}</strong>
              <p>{plugin.description}</p>
              <small>{plugin.source} · {plugin.eventSubscriptions.join(', ') || 'no hooks'}</small>
            </article>
          ))}
        </div>

        <label className="provider-command-field">
          <span>Tool-call interception mode</span>
          <select
            aria-label="Tool-call interception mode"
            value={settings.defaultInterceptionMode}
            onChange={(event) => update('defaultInterceptionMode', event.target.value as RuntimePluginInterceptionMode)}
          >
            <option value="observe">observe</option>
            <option value="rewrite">rewrite</option>
            <option value="block">block</option>
          </select>
        </label>

        <label className="provider-command-field adversary-review-rules">
          <span>Enabled plugin IDs</span>
          <textarea
            aria-label="Enabled runtime plugin IDs"
            value={enabledPluginText}
            onChange={(event) => update('enabledPluginIds', linesFromTextarea(event.target.value))}
            placeholder="One plugin id per line"
            rows={3}
          />
        </label>

        <label className="provider-command-field adversary-review-rules">
          <span>Blocked tool IDs</span>
          <textarea
            aria-label="Runtime plugin blocked tool IDs"
            value={blockedToolText}
            onChange={(event) => update('blockedToolIds', linesFromTextarea(event.target.value))}
            placeholder="One tool id per line"
            rows={3}
          />
        </label>

        <label className="provider-command-field adversary-review-rules">
          <span>Rewrite rules</span>
          <textarea
            aria-label="Runtime plugin rewrite rules"
            value={rewriteRulesText}
            onChange={(event) => update('rewriteRules', linesFromTextarea(event.target.value))}
            placeholder="tool.id:key=value"
            rows={3}
          />
        </label>
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

function AdversaryAgentSettingsPanel({
  settings,
  onChange,
}: {
  settings: AdversaryAgentSettings;
  onChange: (settings: AdversaryAgentSettings) => void;
}) {
  function update<Key extends keyof AdversaryAgentSettings>(
    key: Key,
    value: AdversaryAgentSettings[Key],
  ) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <SettingsSection title="Adversary agent" defaultOpen={false}>
      <div className="adversary-review-settings">
        <div className="secret-settings-grid">
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Enable adversary candidate generation"
              checked={settings.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
            />
            <span>
              <strong>Generate adversary candidates</strong>
              <small>Run bounded red-team candidate generation beside happy-path outputs.</small>
            </span>
          </label>
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Rerun when adversary output wins"
              checked={settings.rerunOnAdversaryWin}
              onChange={(event) => update('rerunOnAdversaryWin', event.target.checked)}
            />
            <span>
              <strong>Rerun on adversary win</strong>
              <small>Restart the loop with judge feedback when a voter selects an adversary candidate.</small>
            </span>
          </label>
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Preserve judge feedback in AgentBus"
              checked={settings.preserveJudgeFeedback}
              onChange={(event) => update('preserveJudgeFeedback', event.target.checked)}
            />
            <span>
              <strong>Preserve judge feedback</strong>
              <small>Write vote outcomes and feedback hooks into the process record for later iterations.</small>
            </span>
          </label>
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Hide adversary labels from voters"
              checked={settings.stealthVoterLabels}
              onChange={(event) => update('stealthVoterLabels', event.target.checked)}
            />
            <span>
              <strong>Blind voter labels</strong>
              <small>Keep candidate labels neutral so voters do not know which output is adversarial.</small>
            </span>
          </label>
        </div>
        <label className="provider-command-field">
          <span>Maximum candidates</span>
          <input
            aria-label="Maximum adversary candidates"
            type="number"
            min={1}
            max={5}
            value={settings.maxCandidates}
            onChange={(event) => update('maxCandidates', Number(event.target.value))}
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

type SettingsScope = 'user' | 'workspace' | 'session';

const SETTINGS_SCOPES: SettingsScope[] = ['user', 'workspace', 'session'];
const SETTINGS_SCOPE_LABELS: Record<SettingsScope, string> = {
  user: 'User',
  workspace: 'Workspace',
  session: 'Session',
};

type SettingsPluginType =
  | 'Core'
  | 'Agent'
  | 'Workflow'
  | 'Extension'
  | 'Security'
  | 'Memory'
  | 'Automation'
  | 'Integration';

interface SettingsWorkbenchItem {
  id: string;
  title: string;
  description: string;
  pluginType: SettingsPluginType;
  scopes: SettingsScope[];
  keywords?: string[];
  node: ReactNode;
}

interface SettingsWorkbenchGroup {
  id: string;
  title: string;
  description: string;
  items: SettingsWorkbenchItem[];
}

function matchesSettingsQuery(
  query: string,
  group: Pick<SettingsWorkbenchGroup, 'title' | 'description'>,
  item?: Pick<SettingsWorkbenchItem, 'title' | 'description' | 'pluginType' | 'keywords'>,
) {
  if (!query) return true;
  const haystack = [
    group.title,
    group.description,
    item?.title,
    item?.description,
    item?.pluginType,
    ...(item?.keywords ?? []),
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query);
}

function SettingsScopeBadges({
  scopes,
  activeScope,
}: {
  scopes: SettingsScope[];
  activeScope: SettingsScope;
}) {
  return (
    <span className="settings-scope-badges" aria-label={`Applies to ${scopes.map((scope) => SETTINGS_SCOPE_LABELS[scope]).join(', ')}`}>
      {scopes.map((scope) => (
        <span
          key={scope}
          className={`settings-scope-badge${scope === activeScope ? ' is-active' : ''}`}
        >
          {SETTINGS_SCOPE_LABELS[scope]}
        </span>
      ))}
    </span>
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
  installedModels: HFModel[];
  onDelete: (id: string) => void;
}

interface ModelCatalogPaneProps {
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
  searchQuery: string;
  loadingModelId: string | null;
  onTaskChange: (task: string) => void;
  onSearch: (query: string) => void;
  onInstall: (model: HFModel) => Promise<void>;
}

interface SettingsPanelProps {
  harnessCoreSummary: ReturnType<typeof selectHarnessCoreSummary>;
  benchmarkRoutingSettings: BenchmarkRoutingSettings;
  benchmarkRoutingCandidates: BenchmarkRoutingCandidate[];
  benchmarkEvidenceState: BenchmarkEvidenceDiscoveryState;
  adversaryToolReviewSettings: AdversaryToolReviewSettings;
  adversaryAgentSettings: AdversaryAgentSettings;
  securityReviewAgentSettings: SecurityReviewAgentSettings;
  securityReviewRunPlan: SecurityReviewRunPlan;
  scheduledAutomationState: ScheduledAutomationState;
  runCheckpointState: RunCheckpointState;
  sessionChapterState: ChapteredSessionState;
  workspaceSkillPolicyState: WorkspaceSkillPolicyState;
  workspaceSkillPolicyInventory: WorkspaceSkillPolicyInventory;
  sharedAgentRegistryState: SharedAgentRegistryState;
  sharedAgentCatalog: SharedAgentCatalog;
  browserWorkflowSkills: BrowserWorkflowSkillManifest[];
  symphonyAutopilotSettings: SymphonyAutopilotSettings;
  conversationBranchingState: ConversationBranchingState;
  harnessSteeringState: HarnessSteeringState;
  harnessSteeringInventory: HarnessSteeringInventory;
  harnessEvolutionSettings: HarnessEvolutionSettings;
  harnessEvolutionPlan: HarnessEvolutionPlan;
  persistentMemoryGraphState: PersistentMemoryGraphState;
  graphKnowledgeState: GraphKnowledgeState;
  browserAgentRunSdkState: BrowserAgentRunSdkState;
  aiPointerState: AiPointerFeatureState;
  partnerAgentControlPlaneSettings: PartnerAgentControlPlaneSettings;
  partnerAgentControlPlane: PartnerAgentControlPlane;
  latestPartnerAgentAuditEntry: PartnerAgentAuditEntry | null;
  runtimePluginSettings: RuntimePluginSettings;
  runtimePluginRuntime: RuntimePluginRuntime;
  specDrivenDevelopmentSettings: SpecDrivenDevelopmentSettings;
  specWorkflowPlan: SpecWorkflowPlan;
  onBenchmarkRoutingSettingsChange: (settings: BenchmarkRoutingSettings) => void;
  onAdversaryToolReviewSettingsChange: (settings: AdversaryToolReviewSettings) => void;
  onAdversaryAgentSettingsChange: (settings: AdversaryAgentSettings) => void;
  onSecurityReviewAgentSettingsChange: (settings: SecurityReviewAgentSettings) => void;
  onScheduledAutomationStateChange: (state: ScheduledAutomationState) => void;
  onRunCheckpointStateChange: (state: RunCheckpointState) => void;
  onSessionChapterStateChange: (state: ChapteredSessionState) => void;
  onWorkspaceSkillPolicyStateChange: (state: WorkspaceSkillPolicyState) => void;
  onSharedAgentRegistryStateChange: (state: SharedAgentRegistryState) => void;
  onInstallBrowserWorkflowSkill: (skill: BrowserWorkflowSkillManifest) => void;
  onSymphonyAutopilotSettingsChange: (settings: SymphonyAutopilotSettings) => void;
  onConversationBranchSettingsChange: (settings: ConversationBranchSettings) => void;
  onHarnessSteeringStateChange: (state: HarnessSteeringState) => void;
  onHarnessEvolutionSettingsChange: (settings: HarnessEvolutionSettings) => void;
  onPersistentMemoryGraphStateChange: (state: PersistentMemoryGraphState) => void;
  onGraphKnowledgeStateChange: (state: GraphKnowledgeState) => void;
  onAiPointerStateChange: (state: AiPointerFeatureState) => void;
  onPartnerAgentControlPlaneSettingsChange: (settings: PartnerAgentControlPlaneSettings) => void;
  onRuntimePluginSettingsChange: (settings: RuntimePluginSettings) => void;
  onSpecDrivenDevelopmentSettingsChange: (settings: SpecDrivenDevelopmentSettings) => void;
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

function summarizeChapteredSessionState(state: ChapteredSessionState) {
  const sessions = Object.values(state.sessions);
  const chapters = sessions.flatMap((session) => session.chapters);
  const evidenceRefCount = chapters.reduce((total, chapter) => total + chapter.evidenceRefs.length, 0);
  const validationRefCount = chapters.reduce((total, chapter) => total + chapter.validationRefs.length, 0);
  return {
    sessionCount: sessions.length,
    chapterCount: chapters.length,
    evidenceRefCount,
    validationRefCount,
    latestChapter: chapters.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null,
  };
}

function ModelsPanel({ installedModels, onDelete }: ModelsPanelProps) {
  return (
    <section className="panel-scroll models-installed-panel" aria-label="Installed models">
      <div className="panel-topbar">
        <div className="settings-heading">
          <h2>Models</h2>
          <p className="muted">{installedModels.length} installed</p>
        </div>
      </div>
      <div className="installed-model-list">
        {installedModels.map((model) => (
          <InstalledModelRow key={model.id} model={model} onDelete={onDelete} />
        ))}
        {installedModels.length === 0 ? (
          <p className="installed-model-empty">No local models installed.</p>
        ) : null}
      </div>
    </section>
  );
}

type ModelCatalogProviderId = 'popular' | 'ghcp' | 'cursor' | 'codex' | 'local' | 'custom';

interface ModelCatalogAction {
  label: string;
  icon: keyof typeof icons;
  disabled?: boolean;
  onClick?: () => void;
}

interface ModelCatalogCardData {
  id: string;
  name: string;
  providerId: ModelCatalogProviderId;
  providerName: string;
  description: string;
  tags: string[];
  action?: ModelCatalogAction;
}

interface ModelCatalogSectionData {
  id: Exclude<ModelCatalogProviderId, 'popular'>;
  title: string;
  subtitle: string;
  status: string;
  statusActive: boolean;
  statusLoading: boolean;
  refreshLabel?: string;
  onRefresh?: () => void;
  models: ModelCatalogCardData[];
}

function providerIcon(providerId: ModelCatalogProviderId): { name: keyof typeof icons; color: string } {
  switch (providerId) {
    case 'ghcp':
      return { name: 'sparkles', color: '#7dd3fc' };
    case 'cursor':
      return { name: 'pencil', color: '#c4b5fd' };
    case 'codex':
      return { name: 'terminal', color: '#86efac' };
    case 'local':
      return { name: 'cpu', color: '#facc15' };
    case 'custom':
      return { name: 'slidersHorizontal', color: '#fb923c' };
    case 'popular':
      return { name: 'layers', color: '#60a5fa' };
  }
}

function modelSearchText(model: ModelCatalogCardData): string {
  return `${model.name} ${model.providerName} ${model.description} ${model.tags.join(' ')}`.toLowerCase();
}

function buildCopilotCatalogModel(model: CopilotModelSummary): ModelCatalogCardData {
  return {
    id: `ghcp:${model.id}`,
    name: model.name,
    providerId: 'ghcp',
    providerName: 'GitHub Copilot',
    description: model.policyState ? `Policy: ${model.policyState}` : 'Available through the GitHub Copilot runtime for this environment.',
    tags: [
      model.id,
      model.reasoning ? 'Reasoning' : null,
      model.vision ? 'Vision' : null,
      formatTokenWindow(model.contextWindow, 'ctx'),
      typeof model.billingMultiplier === 'number' ? `${model.billingMultiplier}x billing` : null,
    ].filter((tag): tag is string => Boolean(tag)),
    action: { label: 'Available', icon: 'sparkles', disabled: true },
  };
}

function buildCursorCatalogModel(model: CursorModelSummary): ModelCatalogCardData {
  return {
    id: `cursor:${model.id}`,
    name: model.name,
    providerId: 'cursor',
    providerName: 'Cursor',
    description: 'Available through the Cursor SDK runtime for this environment.',
    tags: [
      model.id,
      formatTokenWindow(model.contextWindow, 'ctx'),
      formatTokenWindow(model.maxOutputTokens, 'out'),
    ].filter((tag): tag is string => Boolean(tag)),
    action: { label: 'Available', icon: 'pencil', disabled: true },
  };
}

function buildCodexCatalogModel(model: CodexModelSummary): ModelCatalogCardData {
  return {
    id: `codex:${model.id}`,
    name: model.name,
    providerId: 'codex',
    providerName: 'Codex',
    description: 'Available through the local Codex CLI configuration.',
    tags: [
      model.id,
      model.reasoning ? 'Reasoning' : null,
      model.vision ? 'Vision' : null,
      formatTokenWindow(model.contextWindow, 'ctx'),
    ].filter((tag): tag is string => Boolean(tag)),
    action: { label: 'Available', icon: 'terminal', disabled: true },
  };
}

function buildLocalCatalogModel({
  model,
  installed,
  loading,
  onInstall,
}: {
  model: HFModel;
  installed: boolean;
  loading: boolean;
  onInstall: (model: HFModel) => Promise<void>;
}): ModelCatalogCardData {
  const source = getInstalledModelSource(model);
  const taskLabel = HF_TASK_LABELS[model.task] ?? model.task;
  const sizeLabel = formatModelSize(model);
  const tags = [
    taskLabel,
    installed ? 'Installed' : 'Browser local',
    formatTokenWindow(model.contextWindow, 'ctx'),
    sizeLabel,
  ].filter((tag): tag is string => Boolean(tag));

  return {
    id: `local:${model.id}`,
    name: model.name,
    providerId: 'local',
    providerName: source,
    description: installed
      ? `Installed from ${source} for in-browser inference.`
      : `${model.author} · ${model.downloads.toLocaleString()} downloads · ${model.likes.toLocaleString()} likes`,
    tags,
    action: installed
      ? { label: 'Installed', icon: 'cpu', disabled: true }
      : {
        label: loading ? 'Loading' : 'Add Model',
        icon: loading ? 'loader' : 'plus',
        disabled: loading,
        onClick: () => void onInstall(model),
      },
  };
}

function buildLocalCatalogModels({
  installedModels,
  registryModels,
  loadingModelId,
  onInstall,
}: Pick<ModelCatalogPaneProps, 'installedModels' | 'registryModels' | 'loadingModelId' | 'onInstall'>): ModelCatalogCardData[] {
  const installedIds = new Set(installedModels.map((model) => model.id));
  const recommended = LOCAL_MODELS_SEED.filter((model) => !installedIds.has(model.id));
  const recommendedIds = new Set(recommended.map((model) => model.id));
  const registry = registryModels.filter((model) => !installedIds.has(model.id) && !recommendedIds.has(model.id));
  return [
    ...installedModels.map((model) => buildLocalCatalogModel({ model, installed: true, loading: false, onInstall })),
    ...recommended.map((model) => buildLocalCatalogModel({ model, installed: false, loading: loadingModelId === model.id, onInstall })),
    ...registry.map((model) => buildLocalCatalogModel({ model, installed: false, loading: loadingModelId === model.id, onInstall })),
  ];
}

function ModelCatalogCard({ model }: { model: ModelCatalogCardData }) {
  const icon = providerIcon(model.providerId);
  return (
    <article className="catalog-model-card" aria-label={`${model.name} from ${model.providerName}`}>
      <div className="catalog-model-card-head">
        <span className="catalog-model-icon" aria-hidden="true" style={{ color: icon.color }}>
          <Icon name={icon.name} size={22} />
        </span>
        <span className="catalog-model-title">
          <strong>{model.name}</strong>
          <small>{model.providerName}</small>
        </span>
        <Icon name="panelRight" size={15} color="#8b949e" />
      </div>
      <p>{model.description}</p>
      <div className="catalog-model-tags" aria-label={`${model.name} features`}>
        {model.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
        {model.tags.length > 4 ? <span>...</span> : null}
      </div>
      {model.action ? (
        <button
          type="button"
          className={`catalog-model-action${model.action.disabled ? ' is-disabled' : ''}`}
          aria-label={`${model.action.label} ${model.name}`}
          onClick={model.action.onClick}
          disabled={model.action.disabled}
        >
          <Icon name={model.action.icon} size={14} className={model.action.icon === 'loader' ? 'spin' : ''} />
          {model.action.label}
        </button>
      ) : null}
    </article>
  );
}

function ModelCatalogSection({ section, query }: { section: ModelCatalogSectionData; query: string }) {
  const filteredModels = query
    ? section.models.filter((model) => modelSearchText(model).includes(query))
    : section.models;
  return (
    <section className="model-provider-section" aria-label={section.title}>
      <header className="model-provider-section-header">
        <span>
          <h2>{section.title}</h2>
          <p>{section.subtitle}</p>
        </span>
        <span className="model-provider-section-actions">
          <span className={`badge${section.statusActive ? ' connected' : ''}`}>{section.status}</span>
          {section.onRefresh && section.refreshLabel ? (
            <button type="button" className="sidebar-icon-button" aria-label={section.refreshLabel} title={section.refreshLabel} onClick={section.onRefresh} disabled={section.statusLoading}>
              <Icon name={section.statusLoading ? 'loader' : 'refresh'} size={13} className={section.statusLoading ? 'spin' : ''} />
            </button>
          ) : null}
        </span>
      </header>
      {filteredModels.length > 0 ? (
        <div className="catalog-model-grid">
          {filteredModels.map((model) => <ModelCatalogCard key={model.id} model={model} />)}
        </div>
      ) : (
        <p className="catalog-empty-state">No models match this view.</p>
      )}
    </section>
  );
}

function ModelCatalogPane({
  copilotState,
  isCopilotLoading,
  onRefreshCopilot,
  cursorState,
  isCursorLoading,
  onRefreshCursor,
  codexState,
  isCodexLoading,
  onRefreshCodex,
  registryModels,
  installedModels,
  task,
  searchQuery,
  loadingModelId,
  onTaskChange,
  onSearch,
  onInstall,
}: ModelCatalogPaneProps) {
  const [activeSource, setActiveSource] = useState<ModelCatalogProviderId>('popular');
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const localModels = buildLocalCatalogModels({ installedModels, registryModels, loadingModelId, onInstall });
  const sections: ModelCatalogSectionData[] = [
    {
      id: 'ghcp',
      title: `GitHub Copilot Models (${copilotState.models.length})`,
      subtitle: copilotState.models.length
        ? 'Hosted models available through the GitHub Copilot runtime.'
        : copilotState.error ?? 'Sign in or refresh to load GitHub Copilot models.',
      status: isCopilotLoading ? 'Checking' : hasGhcpAccess(copilotState) ? 'Ready' : copilotState.authenticated ? 'Signed in' : 'Needs auth',
      statusActive: hasGhcpAccess(copilotState),
      statusLoading: isCopilotLoading,
      refreshLabel: 'Refresh GitHub Copilot status',
      onRefresh: onRefreshCopilot,
      models: copilotState.models.map(buildCopilotCatalogModel),
    },
    {
      id: 'cursor',
      title: `Cursor Models (${cursorState.models.length})`,
      subtitle: cursorState.models.length
        ? 'Models exposed by the Cursor SDK runtime.'
        : cursorState.error ?? 'Configure CURSOR_API_KEY or refresh to load Cursor models.',
      status: isCursorLoading ? 'Checking' : hasCursorAccess(cursorState) ? 'Ready' : cursorState.authenticated ? 'Signed in' : 'Needs key',
      statusActive: hasCursorAccess(cursorState),
      statusLoading: isCursorLoading,
      refreshLabel: 'Refresh Cursor status',
      onRefresh: onRefreshCursor,
      models: cursorState.models.map(buildCursorCatalogModel),
    },
    {
      id: 'codex',
      title: `Codex Models (${codexState.models.length})`,
      subtitle: codexState.models.length
        ? 'Models available through the local Codex CLI.'
        : codexState.error ?? 'Sign in or refresh to load Codex models.',
      status: isCodexLoading ? 'Checking' : hasCodexAccess(codexState) ? 'Ready' : codexState.authenticated ? 'Signed in' : 'Needs auth',
      statusActive: hasCodexAccess(codexState),
      statusLoading: isCodexLoading,
      refreshLabel: 'Refresh Codex status',
      onRefresh: onRefreshCodex,
      models: codexState.models.map(buildCodexCatalogModel),
    },
    {
      id: 'local',
      title: `Local Browser Models (${localModels.length})`,
      subtitle: 'Run models locally in the browser with Transformers.js-compatible ONNX weights.',
      status: installedModels.length ? `${installedModels.length} installed` : 'Local ready',
      statusActive: installedModels.length > 0,
      statusLoading: Boolean(loadingModelId),
      models: localModels,
    },
  ];
  const totalModelCount = sections.reduce((total, section) => total + section.models.length, 0);
  const popularModels = sections
    .flatMap((section) => section.models.slice(0, section.id === 'local' ? 1 : 2))
    .slice(0, 3);
  const visibleSections = activeSource === 'popular'
    ? sections
    : sections.filter((section) => section.id === activeSource);

  return (
    <section className="model-catalog-pane" aria-label="Model catalog">
      <header className="model-catalog-hero">
        <span>
          <h1>Find the Right Model for Your AI Solution</h1>
          <p>Explore registered providers, local browser models, and custom endpoints from one catalog.</p>
        </span>
        <button type="button" className="catalog-bring-model-button" onClick={() => setActiveSource('custom')}>
          <Icon name="plus" size={16} />
          Bring Your Own Model
        </button>
      </header>
      <div className="model-catalog-layout">
        <aside className="model-catalog-filter" aria-label="Model catalog filters">
          <nav aria-label="Model catalog providers">
            {([
              { id: 'popular' as const, label: 'Popular', count: popularModels.length },
              { id: 'ghcp' as const, label: 'GitHub Copilot', count: copilotState.models.length },
              { id: 'cursor' as const, label: 'Cursor', count: cursorState.models.length },
              { id: 'codex' as const, label: 'Codex', count: codexState.models.length },
              { id: 'local' as const, label: 'Local', count: localModels.length },
              { id: 'custom' as const, label: 'Custom', count: 0 },
            ]).map((entry) => {
              const icon = providerIcon(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`model-catalog-nav-button${activeSource === entry.id ? ' active' : ''}`}
                  aria-pressed={activeSource === entry.id}
                  onClick={() => setActiveSource(entry.id)}
                >
                  <Icon name={icon.name} size={16} />
                  <span>{entry.label}</span>
                  <small>{entry.count}</small>
                </button>
              );
            })}
          </nav>
          <div className="model-filter-group">
            <strong>Model Type</strong>
            <div className="catalog-chip-list">
              {TASK_OPTIONS.slice(0, 8).map((option) => (
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
        </aside>
        <div className="model-catalog-content">
          <section className="model-popular-section" aria-label="Popular models">
            <span>
              <h2>Popular Models</h2>
              <p>Explore prominent models from providers currently registered in Agent Browser.</p>
            </span>
            <div className="catalog-model-grid catalog-model-grid--popular">
              {popularModels.length ? popularModels.map((model) => <ModelCatalogCard key={`popular:${model.id}`} model={model} />) : (
                <p className="catalog-empty-state">No provider models are loaded yet.</p>
              )}
            </div>
          </section>
          <label className="shared-input-shell model-catalog-search">
            <Icon name="search" size={15} color="#7d8594" />
            <input
              aria-label="Search model catalog"
              value={searchQuery}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={`Search ${totalModelCount} models...`}
            />
            {searchQuery ? (
              <button type="button" className="sidebar-icon-button" aria-label="Clear model catalog search" onClick={() => onSearch('')}>
                <Icon name="x" size={13} />
              </button>
            ) : null}
          </label>
          {activeSource === 'custom' ? (
            <section className="model-provider-section model-provider-section--custom" aria-label="Custom provider setup">
              <header className="model-provider-section-header">
                <span>
                  <h2>Custom Providers</h2>
                  <p>Add an OpenAI-compatible endpoint for local sidecars or hosted gateways.</p>
                </span>
              </header>
              <article className="catalog-custom-provider-card">
                <LocalModelSettings />
              </article>
            </section>
          ) : visibleSections.map((section) => (
            <ModelCatalogSection key={section.id} section={section} query={normalizedQuery} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HarnessCoreSettingsPanel({ summary }: { summary: ReturnType<typeof selectHarnessCoreSummary> }) {
  return (
    <SettingsSection title="Harness core">
      <div className="harness-core-settings" role="status" aria-label="Harness core status">
        <article className="provider-card harness-core-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>Reusable browser-agent core</strong>
              <p>Mode state, thread lifecycle, approvals, memory, subagents, models, and events now share a typed core boundary.</p>
            </div>
            <span className="badge connected">Core active</span>
          </div>
          <div className="local-inference-metrics" role="list" aria-label="Harness core metrics">
            <span role="listitem">
              <strong>{summary.activeSessionCount}</strong>
              <small>active sessions</small>
            </span>
            <span role="listitem">
              <strong>{summary.capabilityCount}</strong>
              <small>capabilities</small>
            </span>
          </div>
          <p className="muted">Latest event: {summary.latestEventSummary}</p>
          <div className="chip-row" aria-label="Harness core capabilities">
            {summary.capabilities.map((capability) => (
              <span className="tag-chip" key={capability}>{capability}</span>
            ))}
          </div>
        </article>
      </div>
    </SettingsSection>
  );
}

function AiPointerSettingsPanel({
  state,
  onChange,
}: {
  state: AiPointerFeatureState;
  onChange: (state: AiPointerFeatureState) => void;
}) {
  const settings = state.settings;
  const updateSettings = (patch: Partial<AiPointerSettings>) => {
    onChange({ ...state, settings: { ...settings, ...patch } });
  };
  const toggleQuickAction = (actionId: AiPointerActionId) => {
    const current = new Set(settings.quickActions);
    if (current.has(actionId)) {
      current.delete(actionId);
    } else {
      current.add(actionId);
    }
    updateSettings({ quickActions: Object.keys(AI_POINTER_ACTIONS).filter((id): id is AiPointerActionId => current.has(id as AiPointerActionId)) });
  };

  return (
    <SettingsSection title="AI pointer" defaultOpen={false}>
      <div className="ai-pointer-settings">
        <div className="secret-settings-grid">
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Enable AI pointer"
              checked={settings.enabled}
              onChange={(event) => updateSettings({ enabled: event.target.checked })}
            />
            <span>
              <strong>Enable AI pointer</strong>
              <small>Show point-and-ask controls on browser page overlays.</small>
            </span>
          </label>
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Include page provenance"
              checked={settings.includePageProvenance}
              onChange={(event) => updateSettings({ includePageProvenance: event.target.checked })}
            />
            <span>
              <strong>Include page provenance</strong>
              <small>Attach tab title, URL, and pointer coordinates to drafted prompts.</small>
            </span>
          </label>
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Include entity hints"
              checked={settings.includeEntityHints}
              onChange={(event) => updateSettings({ includeEntityHints: event.target.checked })}
            />
            <span>
              <strong>Include entity hints</strong>
              <small>Pass detected products, places, prices, or quantities when present.</small>
            </span>
          </label>
          <label className="secret-toggle-row">
            <input
              type="checkbox"
              aria-label="Require confirmation before external changes"
              checked={settings.requireConfirmation}
              onChange={(event) => updateSettings({ requireConfirmation: event.target.checked })}
            />
            <span>
              <strong>Require confirmation</strong>
              <small>Ask before edits, purchases, navigation, map actions, or other external state changes.</small>
            </span>
          </label>
        </div>
        <div className="settings-subsection">
          <div className="settings-subsection-heading">
            <strong>Quick actions</strong>
            <span>{settings.quickActions.length}/{Object.keys(AI_POINTER_ACTIONS).length} enabled</span>
          </div>
          <div className="chip-row" aria-label="AI pointer quick action toggles">
            {Object.values(AI_POINTER_ACTIONS).map((action) => (
              <button
                key={action.id}
                type="button"
                className={`chip${settings.quickActions.includes(action.id) ? ' active' : ''}`}
                aria-pressed={settings.quickActions.includes(action.id)}
                onClick={() => toggleQuickAction(action.id)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-subsection">
          <div className="settings-subsection-heading">
            <strong>Last target</strong>
            <span>{state.lastTarget ? state.lastTarget.targetKind : 'none captured'}</span>
          </div>
          {state.lastTarget ? (
            <p className="muted">{state.lastTarget.tab.title} at {state.lastTarget.coordinates.xPercent}% / {state.lastTarget.coordinates.yPercent}%</p>
          ) : (
            <p className="muted">No AI pointer target captured in this workspace yet.</p>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}

function SettingsPanel({
  harnessCoreSummary,
  benchmarkRoutingSettings,
  benchmarkRoutingCandidates,
  benchmarkEvidenceState,
  adversaryToolReviewSettings,
  adversaryAgentSettings,
  securityReviewAgentSettings,
  securityReviewRunPlan,
  scheduledAutomationState,
  runCheckpointState,
  sessionChapterState,
  workspaceSkillPolicyState,
  workspaceSkillPolicyInventory,
  sharedAgentRegistryState,
  sharedAgentCatalog,
  browserWorkflowSkills,
  symphonyAutopilotSettings,
  conversationBranchingState,
  harnessSteeringState,
  harnessSteeringInventory,
  harnessEvolutionSettings,
  harnessEvolutionPlan,
  persistentMemoryGraphState,
  graphKnowledgeState,
  browserAgentRunSdkState,
  aiPointerState,
  partnerAgentControlPlaneSettings,
  partnerAgentControlPlane,
  latestPartnerAgentAuditEntry,
  runtimePluginSettings,
  runtimePluginRuntime,
  specDrivenDevelopmentSettings,
  specWorkflowPlan,
  onBenchmarkRoutingSettingsChange,
  onAdversaryToolReviewSettingsChange,
  onAdversaryAgentSettingsChange,
  onSecurityReviewAgentSettingsChange,
  onScheduledAutomationStateChange,
  onRunCheckpointStateChange,
  onSessionChapterStateChange,
  onWorkspaceSkillPolicyStateChange,
  onSharedAgentRegistryStateChange,
  onInstallBrowserWorkflowSkill,
  onSymphonyAutopilotSettingsChange,
  onConversationBranchSettingsChange,
  onHarnessSteeringStateChange,
  onHarnessEvolutionSettingsChange,
  onPersistentMemoryGraphStateChange,
  onGraphKnowledgeStateChange,
  onAiPointerStateChange,
  onPartnerAgentControlPlaneSettingsChange,
  onRuntimePluginSettingsChange,
  onSpecDrivenDevelopmentSettingsChange,
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
  const [settingsQuery, setSettingsQuery] = useState('');
  const [activeScope, setActiveScope] = useState<SettingsScope>('user');
  const [activeSettingsGroup, setActiveSettingsGroup] = useState('common');
  const query = settingsQuery.trim().toLowerCase();

  const commonTiles = [
    {
      title: 'Core boundary',
      detail: `${harnessCoreSummary.capabilityCount} capabilities`,
      scopes: ['user', 'workspace'] as SettingsScope[],
      pluginType: 'Core' as SettingsPluginType,
    },
    {
      title: 'Policy scope',
      detail: `${workspaceSkillPolicyInventory.packageCount} skill packages`,
      scopes: ['workspace'] as SettingsScope[],
      pluginType: 'Workflow' as SettingsPluginType,
    },
    {
      title: 'Plugin runtime',
      detail: `${runtimePluginRuntime.activePluginCount}/${runtimePluginRuntime.manifestCount} active`,
      scopes: ['workspace'] as SettingsScope[],
      pluginType: 'Extension' as SettingsPluginType,
    },
    {
      title: 'Secret storage',
      detail: `${secretRecords.length} stored refs`,
      scopes: ['user'] as SettingsScope[],
      pluginType: 'Security' as SettingsPluginType,
    },
  ];

  const settingsGroups: SettingsWorkbenchGroup[] = [
    {
      id: 'harness',
      title: 'Harness',
      description: 'Core runtime, routing, steering, and evolution controls.',
      items: [
        {
          id: 'harness-core',
          title: 'Harness core',
          description: 'Reusable browser-agent core status and capability inventory.',
          pluginType: 'Core',
          scopes: ['user', 'workspace'],
          keywords: ['runtime', 'capabilities', 'events'],
          node: <HarnessCoreSettingsPanel summary={harnessCoreSummary} />,
        },
        {
          id: 'benchmark-routing',
          title: 'Benchmark routing',
          description: 'Benchmark-informed model routing and objective settings.',
          pluginType: 'Core',
          scopes: ['user'],
          keywords: ['models', 'evidence', 'routing'],
          node: (
            <BenchmarkRoutingSettingsPanel
              settings={benchmarkRoutingSettings}
              candidates={benchmarkRoutingCandidates}
              evidenceState={benchmarkEvidenceState}
              onChange={onBenchmarkRoutingSettingsChange}
            />
          ),
        },
        {
          id: 'ai-pointer',
          title: 'AI pointer',
          description: 'Point-and-ask browser context, shorthand grounding, and action safety controls.',
          pluginType: 'Core',
          scopes: ['user', 'session'],
          keywords: ['pointer', 'page context', 'this', 'that', 'visual'],
          node: (
            <AiPointerSettingsPanel
              state={aiPointerState}
              onChange={onAiPointerStateChange}
            />
          ),
        },
        {
          id: 'harness-steering',
          title: 'Harness steering',
          description: 'Correction capture and scoped steering inventory.',
          pluginType: 'Core',
          scopes: ['user', 'workspace'],
          keywords: ['corrections', 'guidance'],
          node: (
            <HarnessSteeringSettingsPanel
              state={harnessSteeringState}
              inventory={harnessSteeringInventory}
              onChange={onHarnessSteeringStateChange}
            />
          ),
        },
        {
          id: 'harness-evolution',
          title: 'Harness evolution',
          description: 'Safe-mode policy and evolution workflow plan.',
          pluginType: 'Core',
          scopes: ['workspace'],
          keywords: ['safe mode', 'improvement'],
          node: (
            <HarnessEvolutionSettingsPanel
              settings={harnessEvolutionSettings}
              plan={harnessEvolutionPlan}
              onChange={onHarnessEvolutionSettingsChange}
            />
          ),
        },
      ],
    },
    {
      id: 'agents',
      title: 'Agents',
      description: 'Shared agent governance, first-class agents, and review roles.',
      items: [
        {
          id: 'shared-agents',
          title: 'Shared agents',
          description: 'Workspace-published agent registry and discovery controls.',
          pluginType: 'Agent',
          scopes: ['workspace'],
          keywords: ['registry', 'governance'],
          node: (
            <SharedAgentsSettingsPanel
              state={sharedAgentRegistryState}
              catalog={sharedAgentCatalog}
              onChange={onSharedAgentRegistryStateChange}
            />
          ),
        },
        {
          id: 'adversary-agent',
          title: 'Adversary agent',
          description: 'Candidate generation and adversarial voting settings.',
          pluginType: 'Agent',
          scopes: ['user', 'workspace'],
          keywords: ['judge', 'candidate', 'voter'],
          node: (
            <AdversaryAgentSettingsPanel
              settings={adversaryAgentSettings}
              onChange={onAdversaryAgentSettingsChange}
            />
          ),
        },
        {
          id: 'security-review-agents',
          title: 'Security review agents',
          description: 'Security-review agent roster, severity, and run-plan settings.',
          pluginType: 'Agent',
          scopes: ['workspace'],
          keywords: ['security', 'review', 'risk'],
          node: (
            <SecurityReviewAgentSettingsPanel
              settings={securityReviewAgentSettings}
              runPlan={securityReviewRunPlan}
              onChange={onSecurityReviewAgentSettingsChange}
            />
          ),
        },
        {
          id: 'media-agent',
          title: 'Media agent',
          description: 'Media-capable agent affordances.',
          pluginType: 'Agent',
          scopes: ['user', 'workspace'],
          keywords: ['render', 'image', 'video'],
          node: <MediaAgentSettingsPanel />,
        },
        {
          id: 'partner-agent-control-plane',
          title: 'Partner agent control plane',
          description: 'Unified policy, audit, and evidence controls for partner agents.',
          pluginType: 'Agent',
          scopes: ['workspace'],
          keywords: ['partners', 'audit', 'policy'],
          node: (
            <PartnerAgentControlPlaneSettingsPanel
              settings={partnerAgentControlPlaneSettings}
              controlPlane={partnerAgentControlPlane}
              latestAuditEntry={latestPartnerAgentAuditEntry}
              onChange={onPartnerAgentControlPlaneSettingsChange}
            />
          ),
        },
        {
          id: 'evaluation-agents',
          title: `LogAct evaluation agents (${evaluationAgents.length})`,
          description: 'Custom voters, judges, and negative rubric hardening.',
          pluginType: 'Agent',
          scopes: ['user'],
          keywords: ['eval', 'teacher', 'judge', 'rubric'],
          node: (
            <EvaluationAgentsSettings
              agents={evaluationAgents}
              negativeRubricTechniques={negativeRubricTechniques}
              onSaveAgents={onSaveEvaluationAgents}
              onResetAgents={onResetEvaluationAgents}
              onResetNegativeRubric={onResetNegativeRubric}
            />
          ),
        },
      ],
    },
    {
      id: 'workflows',
      title: 'Workflows',
      description: 'Workspace skills, branch control, checkpoints, and automation behavior.',
      items: [
        {
          id: 'workspace-skill-policies',
          title: 'Workspace skill policies',
          description: 'Versioned skill packages, least-privilege scopes, and draft publish.',
          pluginType: 'Workflow',
          scopes: ['workspace'],
          keywords: ['skills', 'policy', 'least privilege'],
          node: (
            <WorkspaceSkillPolicySettingsPanel
              state={workspaceSkillPolicyState}
              inventory={workspaceSkillPolicyInventory}
              onChange={onWorkspaceSkillPolicyStateChange}
            />
          ),
        },
        {
          id: 'browser-workflow-skills',
          title: 'Browser workflow skills',
          description: 'Installable browser workflow skills and suggestion scope.',
          pluginType: 'Workflow',
          scopes: ['workspace'],
          keywords: ['skills', 'browser', 'workflow'],
          node: (
            <BrowserWorkflowSkillSettingsPanel
              installedSkills={browserWorkflowSkills}
              onInstall={onInstallBrowserWorkflowSkill}
            />
          ),
        },
        {
          id: 'symphony-autopilot',
          title: 'Symphony autopilot',
          description: 'Reviewer autopilot behavior for Symphony work branches.',
          pluginType: 'Workflow',
          scopes: ['workspace'],
          keywords: ['reviewer', 'branches'],
          node: (
            <SymphonyAutopilotSettingsPanel
              settings={symphonyAutopilotSettings}
              onChange={onSymphonyAutopilotSettingsChange}
            />
          ),
        },
        {
          id: 'branching-conversations',
          title: 'Branching conversations',
          description: 'Conversation branch context, merge summaries, and process graph nodes.',
          pluginType: 'Workflow',
          scopes: ['workspace', 'session'],
          keywords: ['subthreads', 'branches', 'conversation'],
          node: (
            <BranchingConversationSettingsPanel
              state={conversationBranchingState}
              onChange={onConversationBranchSettingsChange}
            />
          ),
        },
        {
          id: 'spec-driven-development',
          title: 'Spec-driven development',
          description: 'Spec-first implementation gates and workflow stages.',
          pluginType: 'Workflow',
          scopes: ['workspace'],
          keywords: ['spec', 'plan', 'tests'],
          node: (
            <SpecDrivenDevelopmentSettingsPanel
              settings={specDrivenDevelopmentSettings}
              plan={specWorkflowPlan}
              onChange={onSpecDrivenDevelopmentSettingsChange}
            />
          ),
        },
        {
          id: 'run-checkpoints',
          title: 'Suspend/resume checkpoints',
          description: 'Durable checkpoint creation and resume controls.',
          pluginType: 'Workflow',
          scopes: ['workspace', 'session'],
          keywords: ['checkpoint', 'resume', 'pause'],
          node: (
            <RunCheckpointSettingsPanel
              state={runCheckpointState}
              onChange={onRunCheckpointStateChange}
            />
          ),
        },
        {
          id: 'session-chapters',
          title: 'Chaptered sessions',
          description: 'Session compression and chapter evidence settings.',
          pluginType: 'Workflow',
          scopes: ['session'],
          keywords: ['compression', 'chapter', 'context'],
          node: (
            <SessionChapterSettingsPanel
              state={sessionChapterState}
              onChange={onSessionChapterStateChange}
            />
          ),
        },
        {
          id: 'browser-agent-run-sdk',
          title: 'Browser-agent run SDK',
          description: 'Typed browser-agent run state exposed across history and settings.',
          pluginType: 'Workflow',
          scopes: ['workspace', 'session'],
          keywords: ['sdk', 'run', 'typed state'],
          node: <BrowserAgentRunSdkSettingsPanel state={browserAgentRunSdkState} />,
        },
      ],
    },
    {
      id: 'extensions',
      title: 'Extensions',
      description: 'Runtime plugin manifests, integrations, and external capability adapters.',
      items: [
        {
          id: 'runtime-plugins',
          title: 'Runtime plugins',
          description: 'Data-only manifests for tools, providers, events, and policy hooks.',
          pluginType: 'Extension',
          scopes: ['workspace'],
          keywords: ['manifest', 'tools', 'hooks', 'provider'],
          node: (
            <RuntimePluginSettingsPanel
              settings={runtimePluginSettings}
              runtime={runtimePluginRuntime}
              onChange={onRuntimePluginSettingsChange}
            />
          ),
        },
        {
          id: 'n8n-capabilities',
          title: 'n8n capabilities',
          description: 'n8n workflow automation capabilities available to the workspace.',
          pluginType: 'Integration',
          scopes: ['workspace'],
          keywords: ['integration', 'automation'],
          node: <N8nCapabilitiesSettingsPanel />,
        },
      ],
    },
    {
      id: 'memory',
      title: 'Data And Memory',
      description: 'Graph knowledge and persistent memory controls.',
      items: [
        {
          id: 'graph-knowledge',
          title: 'Graph knowledge',
          description: 'Workspace graph knowledge ingestion, search, and consolidation.',
          pluginType: 'Memory',
          scopes: ['workspace'],
          keywords: ['graph', 'knowledge', 'search'],
          node: (
            <GraphKnowledgeSettingsPanel
              state={graphKnowledgeState}
              onChange={onGraphKnowledgeStateChange}
            />
          ),
        },
        {
          id: 'persistent-memory-graphs',
          title: 'Persistent memory graphs',
          description: 'Persistent memory graph import, export, and search controls.',
          pluginType: 'Memory',
          scopes: ['user', 'workspace'],
          keywords: ['memory', 'graph', 'import', 'export'],
          node: (
            <PersistentMemoryGraphSettingsPanel
              state={persistentMemoryGraphState}
              onChange={onPersistentMemoryGraphStateChange}
            />
          ),
        },
      ],
    },
    {
      id: 'security',
      title: 'Security',
      description: 'Secrets, tool-call review, and high-risk action controls.',
      items: [
        {
          id: 'secrets',
          title: `Secrets (${secretRecords.length})`,
          description: 'Local secret refs, redaction, and replacement settings.',
          pluginType: 'Security',
          scopes: ['user'],
          keywords: ['secret', 'redaction', 'credentials'],
          node: (
            <SecretsSettings
              records={secretRecords}
              settings={secretSettings}
              onSaveSecret={onSaveSecret}
              onDeleteSecret={onDeleteSecret}
              onSettingsChange={onSecretSettingsChange}
            />
          ),
        },
        {
          id: 'adversary-tool-review',
          title: 'Adversary tool review',
          description: 'Tool-call review and strict blocking settings.',
          pluginType: 'Security',
          scopes: ['workspace'],
          keywords: ['tool', 'review', 'block'],
          node: (
            <AdversaryToolReviewSettingsPanel
              settings={adversaryToolReviewSettings}
              onChange={onAdversaryToolReviewSettingsChange}
            />
          ),
        },
      ],
    },
    {
      id: 'automation',
      title: 'Automation',
      description: 'Scheduled tasks and recurring automation state.',
      items: [
        {
          id: 'scheduled-automations',
          title: 'Scheduled automations',
          description: 'Scheduled automation visibility and state controls.',
          pluginType: 'Automation',
          scopes: ['workspace'],
          keywords: ['schedule', 'cron', 'automation'],
          node: (
            <ScheduledAutomationSettingsPanel
              state={scheduledAutomationState}
              onChange={onScheduledAutomationStateChange}
            />
          ),
        },
      ],
    },
  ];

  const commonMatches = matchesSettingsQuery(query, {
    title: 'Commonly Used',
    description: 'Common cross-scope settings for core, policy, plugins, and secrets.',
  });
  const filteredGroups = settingsGroups
    .map((group) => {
      const groupMatches = matchesSettingsQuery(query, group);
      return {
        ...group,
        items: group.items.filter((item) => groupMatches || matchesSettingsQuery(query, group, item)),
      };
    })
    .filter((group) => group.items.length > 0);
  const visibleSettingCount = filteredGroups.reduce((sum, group) => sum + group.items.length, 0);

  const scrollToSettingsTarget = (targetId: string, groupId: string) => {
    setActiveSettingsGroup(groupId);
    const element = document.getElementById(targetId);
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'start' });
    }
    const focusTarget = element?.querySelector<HTMLElement>('.section-toggle, button, input, select, textarea');
    focusTarget?.focus();
  };

  return (
    <section className="panel-scroll settings-panel settings-workbench" aria-label="Settings workbench">
      <header className="settings-workbench-header">
        <div className="settings-workbench-title">
          <span className="panel-eyebrow"><Icon name="slidersHorizontal" size={12} color="#8fa6c4" />Settings</span>
          <h2>Settings</h2>
        </div>
        <label className="settings-search-shell shared-input-shell">
          <Icon name="search" size={14} color="#7d8694" />
          <input
            type="search"
            aria-label="Search settings"
            placeholder="Search settings"
            value={settingsQuery}
            onChange={(event) => setSettingsQuery(event.target.value)}
          />
        </label>
        <div className="settings-scope-tabs" role="tablist" aria-label="Settings scope">
          {SETTINGS_SCOPES.map((scope) => (
            <button
              key={scope}
              type="button"
              role="tab"
              className={`settings-scope-tab${activeScope === scope ? ' is-active' : ''}`}
              aria-selected={activeScope === scope}
              onClick={() => setActiveScope(scope)}
            >
              {SETTINGS_SCOPE_LABELS[scope]}
            </button>
          ))}
        </div>
      </header>

      <div className="settings-workbench-body">
        <nav className="settings-category-nav" aria-label="Settings categories">
          {!query || commonMatches ? (
            <button
              type="button"
              className={`settings-category-button${activeSettingsGroup === 'common' ? ' is-active' : ''}`}
              aria-label="Open Commonly Used settings category"
              onClick={() => scrollToSettingsTarget('settings-group-common', 'common')}
            >
              <span>Commonly Used</span>
              <small>{commonTiles.length} settings</small>
            </button>
          ) : null}
          {filteredGroups.map((group) => (
            <div key={group.id} className="settings-nav-group">
              <button
                type="button"
                className={`settings-category-button${activeSettingsGroup === group.id ? ' is-active' : ''}`}
                aria-label={`Open ${group.title} settings category`}
                onClick={() => scrollToSettingsTarget(`settings-group-${group.id}`, group.id)}
              >
                <span>{group.title}</span>
                <small>{group.items.length} setting{group.items.length === 1 ? '' : 's'}</small>
              </button>
              <div className="settings-nav-children">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="settings-nav-child"
                    aria-label={`Open ${item.title} settings`}
                    onClick={() => scrollToSettingsTarget(`settings-item-${item.id}`, group.id)}
                  >
                    <Icon name="chevronRight" size={10} color="#71717a" />
                    <span>{item.title} settings</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="settings-workbench-main" aria-label="Settings results">
          {!query || commonMatches ? (
            <section id="settings-group-common" className="settings-category-group settings-category-group--common" aria-labelledby="settings-heading-common">
              <header className="settings-category-header">
                <div>
                  <h3 id="settings-heading-common">Commonly Used</h3>
                  <p>High-traffic settings grouped by type and scope.</p>
                </div>
              </header>
              <div className="settings-common-grid">
                {commonTiles.map((tile) => (
                  <article key={tile.title} className="settings-common-tile">
                    <div>
                      <strong>{tile.title}</strong>
                      <p>{tile.detail}</p>
                    </div>
                    <div className="settings-common-meta">
                      <span className="settings-plugin-type">{tile.pluginType}</span>
                      <SettingsScopeBadges scopes={tile.scopes} activeScope={activeScope} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {filteredGroups.map((group) => (
            <section
              key={group.id}
              id={`settings-group-${group.id}`}
              className="settings-category-group"
              aria-labelledby={`settings-heading-${group.id}`}
            >
              <header className="settings-category-header">
                <div>
                  <h3 id={`settings-heading-${group.id}`}>{group.title}</h3>
                  <p>{group.description}</p>
                </div>
                <span className="settings-group-count">{group.items.length} setting{group.items.length === 1 ? '' : 's'}</span>
              </header>
              <div className="settings-entry-list">
                {group.items.map((item) => (
                  <article
                    key={item.id}
                    id={`settings-item-${item.id}`}
                    className={`settings-workbench-entry${item.scopes.includes(activeScope) ? '' : ' is-other-scope'}`}
                  >
                    <div className="settings-entry-meta">
                      <span className="settings-plugin-type">{item.pluginType}</span>
                      <SettingsScopeBadges scopes={item.scopes} activeScope={activeScope} />
                    </div>
                    {item.node}
                  </article>
                ))}
              </div>
            </section>
          ))}

          {visibleSettingCount === 0 && (!commonMatches || query) ? (
            <p className="settings-empty-state muted">No settings match the current search.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function RepoWikiPanel({ onRefresh }: { onRefresh: () => void }) {
  return (
    <section className="panel-scroll repo-wiki-panel repo-wiki-nav-panel" role="region" aria-label="Wiki explorer">
      <div className="repo-wiki-minimal-panel">
        <div className="repo-wiki-minimal-title">
          <span className="panel-eyebrow">Knowledgebase</span>
          <h2>Wiki</h2>
        </div>
        <button type="button" className="icon-button repo-wiki-refresh-button" aria-label="Refresh wiki" onClick={onRefresh}>
          <Icon name="refresh" size={13} />
          <span>Refresh</span>
        </button>
      </div>
    </section>
  );
}

function RepoWikiWorkbench({
  snapshot,
  activeView,
  selectedPageId,
  onViewChange,
  onOpenPage,
  onCopyCitation,
  onRememberMemory,
  onForgetMemory,
}: {
  snapshot: RepoWikiSnapshot;
  activeView: RepoWikiView;
  selectedPageId: string | null;
  onViewChange: (view: RepoWikiView) => void;
  onOpenPage: (pageId: string) => void;
  onCopyCitation: (citation: RepoWikiCitation) => void | Promise<void>;
  onRememberMemory: (scope: WorkspaceMemoryScope, text: string) => void;
  onForgetMemory: (entry: { sourcePath: string; lineNumber: number; text: string }) => void;
}) {
  const activeViewMeta = REPO_WIKI_VIEWS.find((view) => view.id === activeView) ?? REPO_WIKI_VIEWS[0];
  const [wikiQuery, setWikiQuery] = useState('');
  const [graphMode, setGraphMode] = useState<'all' | 'nearby' | 'isolated'>('all');
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);
  const [memoryScope, setMemoryScope] = useState<WorkspaceMemoryScope>('workspace');
  const [memoryText, setMemoryText] = useState('');
  const knowledgeModel = snapshot.knowledgeModel;
  const searchResults = useMemo(() => searchRepoWikiSnapshot(snapshot, wikiQuery), [snapshot, wikiQuery]);
  const pageResultIds = searchResults.filter((result) => result.kind === 'page').map((result) => result.id);
  const visiblePages = wikiQuery.trim()
    ? pageResultIds.map((id) => snapshot.pages.find((page) => page.id === id)).filter((page): page is (typeof snapshot.pages)[number] => Boolean(page))
    : snapshot.pages;
  const selectedPage = (
    selectedPageId
      ? visiblePages.find((page) => page.id === selectedPageId) ?? snapshot.pages.find((page) => page.id === selectedPageId)
      : null
  ) ?? visiblePages[0] ?? snapshot.pages[0];
  const visibleNodeIds = new Set(
    knowledgeModel.nodes
      .filter((node) => {
        if (graphMode === 'isolated') return Boolean(node.isIsolated);
        if (graphMode === 'nearby') return node.localDepth <= knowledgeModel.graphModes.localDepth;
        return true;
      })
      .map((node) => node.id),
  );
  const visibleNodes = knowledgeModel.nodes.filter((node) => visibleNodeIds.has(node.id));
  const visibleLinks = knowledgeModel.links.filter((link) => visibleNodeIds.has(link.from) && visibleNodeIds.has(link.to));
  const nodeLabelById = new Map(knowledgeModel.nodes.map((node) => [node.id, node.label]));
  const canvasCardByNodeId = new Map(knowledgeModel.canvas.cards.map((card) => [card.nodeId, card]));
  const selectedGraphNode = (
    selectedGraphNodeId
      ? visibleNodes.find((node) => node.id === selectedGraphNodeId) ?? knowledgeModel.nodes.find((node) => node.id === selectedGraphNodeId)
      : null
  ) ?? visibleNodes.find((node) => node.id === knowledgeModel.graphModes.localFocusId) ?? visibleNodes[0];
  const incomingGraphLinks = selectedGraphNode ? knowledgeModel.links.filter((link) => link.to === selectedGraphNode.id) : [];
  const outgoingGraphLinks = selectedGraphNode ? knowledgeModel.links.filter((link) => link.from === selectedGraphNode.id) : [];
  const isolatedNodes = knowledgeModel.nodes.filter((node) => node.isIsolated);
  const memorySearchTerm = wikiQuery.trim();
  const [memoryScopeFilter, setMemoryScopeFilter] = useState<WorkspaceMemoryScope | 'all'>('all');
  const memoryEntriesMatchingSearch = memorySearchTerm
    ? snapshot.managedMemory.entries.filter((entry) => searchResults.some((result) => result.kind === 'memory' && result.id === entry.id))
    : snapshot.managedMemory.entries;
  const filteredMemoryEntries = memoryEntriesMatchingSearch.filter((entry) => memoryScopeFilter === 'all' || entry.scope === memoryScopeFilter);
  const activeMemoryScopeTitle = memoryScopeFilter === 'all'
    ? 'All memory'
    : snapshot.managedMemory.scopes.find((scope) => scope.scope === memoryScopeFilter)?.title ?? memoryScopeFilter;
  const graphSearchResults = searchResults.filter((result) => result.kind === 'graph');
  const graphCanvasCards = visibleNodes.map((node) => canvasCardByNodeId.get(node.id)).filter((card): card is NonNullable<typeof card> => Boolean(card));
  const graphCanvasWidth = Math.max(820, ...graphCanvasCards.map((card) => card.x + 150));
  const graphCanvasHeight = Math.max(420, ...graphCanvasCards.map((card) => card.y + 120));
  const graphRelationLines = visibleLinks.flatMap((link) => {
    const fromCard = canvasCardByNodeId.get(link.from);
    const toCard = canvasCardByNodeId.get(link.to);
    if (!fromCard || !toCard) return [];
    return [{
      ...link,
      x1: fromCard.x,
      y1: fromCard.y,
      x2: toCard.x,
      y2: toCard.y,
    }];
  });
  const selectedPageDomId = selectedPage?.id.replace(/[^a-z0-9_-]/gi, '-') ?? 'empty';
  const selectedPageReferences = selectedPage ? [selectedPage.citationId, ...selectedPage.sourcePaths.slice(0, 6)] : [];

  return (
    <section className="repo-wiki-workbench" role="region" aria-label="Workspace knowledgebase wiki">
      <header className="repo-wiki-workbench-header">
        <div className="repo-wiki-workbench-title">
          <span className="panel-eyebrow">Knowledgebase</span>
          <h2>Workspace wiki</h2>
          <p>Generated from workspace pages, modeled relationships, and stored memory.</p>
        </div>
        <form className="repo-wiki-search" role="search" aria-label="Wiki search" onSubmit={(event) => event.preventDefault()}>
          <label className="shared-input-shell">
            <Icon name="search" size={14} color="#9ca3af" />
            <input
              aria-label="Search wiki pages and memories"
              value={wikiQuery}
              onChange={(event) => setWikiQuery(event.target.value)}
              placeholder="Search pages, graph nodes, and memories"
            />
          </label>
          <span>{searchResults.length} matches</span>
        </form>
      </header>

      <div className="repo-wiki-workbench-tabs" role="tablist" aria-label="Wiki views">
        {REPO_WIKI_VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            role="tab"
            aria-selected={activeView === view.id}
            className={`repo-wiki-workbench-tab${activeView === view.id ? ' active' : ''}`}
            onClick={() => onViewChange(view.id)}
          >
            <Icon name={view.icon} size={14} />
            <span>{view.label}</span>
          </button>
        ))}
      </div>

      <div className="repo-wiki-workbench-body" role="tabpanel" aria-label={activeViewMeta.label}>
        {activeView === 'pages' ? (
          <div className="repo-wiki-pages-view">
            <nav className="repo-wiki-page-index" aria-label="Wiki page contents">
              <div className="repo-wiki-panel-label">
                <span>Contents</span>
                <strong>{visiblePages.length}</strong>
              </div>
              {visiblePages.map((page) => (
                <button
                  type="button"
                  key={page.id}
                  className={selectedPage?.id === page.id ? 'active' : ''}
                  onClick={() => onOpenPage(page.id)}
                >
                  <strong>{page.title}</strong>
                  <span>{page.summary}</span>
                </button>
              ))}
            </nav>

            {selectedPage ? (
              <>
                <article className="repo-wiki-page-card repo-wiki-page-card--reader" key={selectedPage.id}>
                  <header className="repo-wiki-reader-header">
                    <div>
                      <span className="panel-eyebrow">Wiki page</span>
                      <h3>{selectedPage.title}</h3>
                    </div>
                    <code>{selectedPage.citationId}</code>
                  </header>
                  <div className="repo-wiki-reader-copy">
                    <p className="repo-wiki-reader-summary">
                      {selectedPage.summary}
                      <sup className="repo-wiki-ref-marker" aria-label="Citation reference 1">[1]</sup>
                    </p>
                    {selectedPage.body.map((paragraph, index) => (
                      <p key={`${paragraph}:${index}`}>
                        {paragraph}
                        <sup className="repo-wiki-ref-marker" aria-label={`Citation reference ${index + 2}`}>[{index + 2}]</sup>
                      </p>
                    ))}
                    <section className="repo-wiki-reader-facts" aria-labelledby={`repo-wiki-facts-${selectedPageDomId}`}>
                      <h4 id={`repo-wiki-facts-${selectedPageDomId}`}>Key facts</h4>
                      <ul aria-label="Article facts">
                        {selectedPage.facts.map((fact, index) => (
                          <li key={`${fact}:${index}`}>
                            <span>{fact}</span>
                            <sup className="repo-wiki-ref-marker" aria-label={`Fact reference ${index + 1}`}>[{selectedPage.body.length + index + 2}]</sup>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                </article>
                <aside className="repo-wiki-page-context" role="complementary" aria-label="Wiki article references">
                  <section className="repo-wiki-related-pages" aria-label="Related pages">
                    <h3>Related pages</h3>
                    {[...selectedPage.links, ...selectedPage.backlinks].length ? (
                      <div className="repo-wiki-link-list">
                        {[...selectedPage.links, ...selectedPage.backlinks].map((link) => (
                          <button
                            type="button"
                            key={`${link.targetId}:${link.predicate}`}
                            aria-label={`Open ${link.targetTitle}`}
                            onClick={() => onOpenPage(link.targetId)}
                          >
                            <strong>{link.targetTitle}</strong>
                            <small>{link.predicate}</small>
                          </button>
                        ))}
                      </div>
                    ) : <p>No related wiki pages yet.</p>}
                  </section>
                  <section className="repo-wiki-reference-block" aria-label="References">
                    <h3>References</h3>
                    <ol className="repo-wiki-reference-list">
                      {selectedPageReferences.map((reference, index) => (
                        <li key={`${reference}:${index}`}>
                          <span>[{index + 1}]</span>
                          <code>{reference}</code>
                        </li>
                      ))}
                    </ol>
                  </section>
                  <section className="repo-wiki-source-paths" aria-label="Page source paths">
                    <h3>Sources</h3>
                    {selectedPage.sourcePaths.length
                      ? selectedPage.sourcePaths.slice(0, 8).map((path) => <span key={path}>{path}</span>)
                      : <span>No source paths captured</span>}
                  </section>
                  <button
                    type="button"
                    className="secondary-button repo-wiki-citation-copy"
                    onClick={() => {
                      const citation = snapshot.citations.find((entry) => entry.id === selectedPage.citationId);
                      if (citation) void onCopyCitation(citation);
                    }}
                  >
                    <Icon name="clipboard" size={13} />
                    <span>Copy Citation</span>
                  </button>
                </aside>
              </>
            ) : (
              <article className="repo-wiki-page-card">
                <h3>No wiki pages match the current search.</h3>
                <p>Clear the search field to see the generated wiki.</p>
              </article>
            )}

            {wikiQuery.trim() && searchResults.length ? (
              <section className="repo-wiki-search-results" aria-label="Wiki search results">
                <h3>Search results</h3>
                {searchResults.slice(0, 8).map((result) => (
                  <button
                    type="button"
                    key={`${result.kind}:${result.id}`}
                    onClick={() => {
                      if (result.kind === 'page') {
                        onOpenPage(result.id);
                        onViewChange('pages');
                      } else if (result.kind === 'memory') {
                        onViewChange('memory');
                      } else {
                        setSelectedGraphNodeId(result.id);
                        onViewChange('graph');
                      }
                    }}
                  >
                    <strong>{result.title}</strong>
                    <span>{result.kind} · {result.detail}</span>
                  </button>
                ))}
              </section>
            ) : null}
          </div>
        ) : null}

        {activeView === 'graph' ? (
          <div className="repo-wiki-graph-view">
            <article className="repo-wiki-graph-card repo-wiki-graph-card--model">
              <header className="repo-wiki-graph-heading">
                <span className="panel-eyebrow">Knowledge Graph</span>
                <h3>Modeled knowledge relationships</h3>
                <p>Click a node to inspect incoming and outgoing relationships. Isolated chunks are source nodes with no modeled edges yet.</p>
              </header>
              <div className="repo-wiki-model-toolbar" role="group" aria-label="Graph mode">
                <button
                  type="button"
                  className={graphMode === 'all' ? 'active' : ''}
                  aria-pressed={graphMode === 'all'}
                  onClick={() => setGraphMode('all')}
                >
                  All knowledge
                </button>
                <button
                  type="button"
                  className={graphMode === 'nearby' ? 'active' : ''}
                  aria-pressed={graphMode === 'nearby'}
                  onClick={() => setGraphMode('nearby')}
                >
                  Nearby
                </button>
                <button
                  type="button"
                  className={graphMode === 'isolated' ? 'active' : ''}
                  aria-pressed={graphMode === 'isolated'}
                  onClick={() => setGraphMode('isolated')}
                >
                  Isolated chunks
                </button>
                <span>{visibleNodes.length} nodes</span>
                <span>{visibleLinks.length} links</span>
                <span>{isolatedNodes.length} isolated</span>
              </div>
              <div className="repo-wiki-group-strip" aria-label="Knowledge groups">
                {knowledgeModel.groups.map((group) => (
                  <span key={group.id} style={{ '--wiki-group-color': group.color } as React.CSSProperties}>
                    {group.label}
                  </span>
                ))}
              </div>
              <div className="repo-wiki-graph-stage">
                <div
                  className="repo-wiki-graph-canvas repo-wiki-graph-canvas--model"
                  aria-label="Navigable knowledge graph"
                  style={{ '--wiki-graph-height': `${graphCanvasHeight}px`, '--wiki-graph-width': `${graphCanvasWidth}px` } as React.CSSProperties}
                >
                  <svg
                    className="repo-wiki-graph-links"
                    role="img"
                    aria-label="Graph relationship lines"
                    viewBox={`0 0 ${graphCanvasWidth} ${graphCanvasHeight}`}
                    preserveAspectRatio="none"
                  >
                    {graphRelationLines.map((line) => (
                      <g key={`${line.from}:${line.to}:${line.predicate}`}>
                        <title>{`${nodeLabelById.get(line.from) ?? line.from} ${line.predicate} ${nodeLabelById.get(line.to) ?? line.to}`}</title>
                        <line
                          className={selectedGraphNode && (selectedGraphNode.id === line.from || selectedGraphNode.id === line.to) ? 'active' : undefined}
                          x1={line.x1}
                          y1={line.y1}
                          x2={line.x2}
                          y2={line.y2}
                        />
                      </g>
                    ))}
                  </svg>
                  {visibleNodes.length ? visibleNodes.map((node) => {
                    const card = canvasCardByNodeId.get(node.id);
                    const degree = node.inbound + node.outbound;
                    return (
                      <button
                        type="button"
                        key={node.id}
                        aria-label={`Select graph node ${node.label}`}
                        className={`repo-wiki-graph-node repo-wiki-graph-node--${node.kind}${selectedGraphNode?.id === node.id ? ' active' : ''}`}
                        style={{
                          '--wiki-node-x': `${card?.x ?? 120}px`,
                          '--wiki-node-y': `${card?.y ?? 120}px`,
                          '--wiki-node-scale': String(Math.min(1.2, 0.92 + degree * 0.05)),
                        } as React.CSSProperties}
                        onClick={() => setSelectedGraphNodeId(node.id)}
                      >
                        <strong>{node.label}</strong>
                        <small>{node.inbound} in · {node.outbound} out</small>
                      </button>
                    );
                  }) : (
                    <p>No isolated chunks match the current graph filter.</p>
                  )}
                </div>
                <aside className="repo-wiki-graph-inspector" role="complementary" aria-label="Graph inspector">
                  <h3>Selected node</h3>
                  <div className="repo-wiki-property-list">
                    {selectedGraphNode ? (
                      <>
                        <span>
                          <strong>Label</strong>
                          <code>{selectedGraphNode.label}</code>
                        </span>
                        <span>
                          <strong>Kind</strong>
                          <code>{selectedGraphNode.kind}</code>
                        </span>
                        <span>
                          <strong>Status</strong>
                          <code>{selectedGraphNode.isIsolated ? 'isolated' : 'linked'}</code>
                        </span>
                      </>
                    ) : <p>No graph node selected.</p>}
                  </div>
                  <section>
                    <h3>Incoming relationships</h3>
                    <div className="repo-wiki-link-list">
                      {incomingGraphLinks.length ? incomingGraphLinks.map((link) => (
                        <span key={`${link.from}:${link.to}:${link.predicate}`}>
                          <code>{nodeLabelById.get(link.from) ?? link.from}</code>
                          <small>{link.predicate}</small>
                        </span>
                      )) : <p>No incoming relationships for {selectedGraphNode?.label ?? 'the selected node'}.</p>}
                    </div>
                  </section>
                  <section>
                    <h3>Outgoing relationships</h3>
                    <div className="repo-wiki-link-list">
                      {outgoingGraphLinks.length ? outgoingGraphLinks.map((link) => (
                        <span key={`${link.from}:${link.to}:${link.predicate}`}>
                          <code>{nodeLabelById.get(link.to) ?? link.to}</code>
                          <small>{link.predicate}</small>
                        </span>
                      )) : <p>No outgoing relationships for {selectedGraphNode?.label ?? 'the selected node'}.</p>}
                    </div>
                  </section>
                </aside>
              </div>
              <section className="repo-wiki-graph-notes" aria-label="Unlinked mentions">
                <h3>Unlinked mentions</h3>
                <div className="repo-wiki-link-list">
                  {knowledgeModel.unlinkedMentions.length ? knowledgeModel.unlinkedMentions.map((mention) => (
                    <span key={`${mention.sourcePath}:${mention.mention}:${mention.targetId}`}>
                      <code>{mention.mention}</code>
                      <small>{mention.sourcePath} · {Math.round(mention.confidence * 100)}%</small>
                    </span>
                  )) : <p>No unlinked mentions detected.</p>}
                </div>
              </section>
              {graphSearchResults.length ? (
                <section className="repo-wiki-search-results" aria-label="Graph search matches">
                  <h3>Graph matches</h3>
                  {graphSearchResults.slice(0, 6).map((result) => (
                    <button type="button" key={result.id} onClick={() => setSelectedGraphNodeId(result.id)}>
                      <strong>{result.title}</strong>
                      <span>{result.detail}</span>
                    </button>
                  ))}
                </section>
              ) : null}
              <section className="repo-wiki-edge-table" role="region" aria-label="Relationship table">
                <h3>Relationships</h3>
                <ul className="repo-wiki-edge-list repo-wiki-edge-list--model">
                  {visibleLinks.map((edge) => (
                    <li key={`${edge.from}:${edge.to}:${edge.predicate}`}>
                      <code>{nodeLabelById.get(edge.from) ?? edge.from}</code>
                      <span>{edge.predicate}</span>
                      <code>{nodeLabelById.get(edge.to) ?? edge.to}</code>
                    </li>
                  ))}
                </ul>
              </section>
            </article>
          </div>
        ) : null}

        {activeView === 'memory' ? (
          <div className="repo-wiki-memory-view">
            <section className="repo-wiki-memory-console" aria-label="Memory management console">
              <header className="repo-wiki-memory-commandbar">
                <div>
                  <span className="panel-eyebrow">Memory</span>
                  <h3>Stored memories</h3>
                  <p>View, filter, add, and forget durable facts used by the wiki and retrieval graph.</p>
                </div>
                {memorySearchTerm ? (
                  <button
                    type="button"
                    className="secondary-button"
                    aria-label="Clear memory search filter"
                    onClick={() => setWikiQuery('')}
                  >
                    Clear filter
                  </button>
                ) : null}
              </header>
              <div className="repo-wiki-memory-console-grid">
                <aside className="repo-wiki-memory-scope-rail" role="region" aria-label="Memory scopes">
                  <button
                    type="button"
                    className={memoryScopeFilter === 'all' ? 'active' : ''}
                    aria-pressed={memoryScopeFilter === 'all'}
                    onClick={() => setMemoryScopeFilter('all')}
                  >
                    <span>All</span>
                    <strong>{snapshot.managedMemory.entries.length}</strong>
                  </button>
                  {snapshot.managedMemory.scopes.map((scope) => (
                    <button
                      type="button"
                      key={scope.scope}
                      className={memoryScopeFilter === scope.scope ? 'active' : ''}
                      aria-pressed={memoryScopeFilter === scope.scope}
                      onClick={() => setMemoryScopeFilter(scope.scope)}
                    >
                      <span>{scope.title.replace(' Memory', '')}</span>
                      <strong>{scope.entryCount}</strong>
                    </button>
                  ))}
                </aside>

                <section className="repo-wiki-memory-library" role="region" aria-label="Memory library">
                  <header className="repo-wiki-memory-library-header">
                    <div>
                      <h3>{activeMemoryScopeTitle}</h3>
                      <p>
                        {memorySearchTerm
                          ? `Filtered by "${memorySearchTerm}"`
                          : 'Stored facts available for prompt, graph, wiki, and session retrieval.'}
                      </p>
                    </div>
                    <span>{filteredMemoryEntries.length} shown</span>
                  </header>
                  {filteredMemoryEntries.length ? (
                    <div className="repo-wiki-memory-table" role="list">
                      {filteredMemoryEntries.map((entry) => (
                        <article key={entry.id} role="listitem">
                          <div className="repo-wiki-memory-entry-main">
                            <strong>{entry.text}</strong>
                            <span>{entry.activationTier} · {entry.sourcePath}:{entry.lineNumber}</span>
                          </div>
                          <span className="repo-wiki-memory-scope-pill">{entry.scope}</span>
                          <button
                            type="button"
                            className="secondary-button"
                            aria-label={`Forget memory: ${entry.text}`}
                            onClick={() => {
                              onForgetMemory({ sourcePath: entry.sourcePath, lineNumber: entry.lineNumber, text: entry.text });
                              setWikiQuery('');
                            }}
                          >
                            <Icon name="trash" size={13} />
                            <span>Forget</span>
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="repo-wiki-memory-empty">
                      <strong>
                        {memorySearchTerm
                          ? `No stored memories match "${memorySearchTerm}".`
                          : memoryScopeFilter === 'all'
                            ? 'No stored memories yet.'
                            : `No ${activeMemoryScopeTitle.toLowerCase()} entries yet.`}
                      </strong>
                      <p>
                        {memorySearchTerm
                          ? 'Clear the search filter or add a new memory from the composer.'
                          : 'Use the composer to add the first durable fact.'}
                      </p>
                    </div>
                  )}
                </section>

                <section className="repo-wiki-memory-composer" role="region" aria-label="Add memory">
                  <div className="repo-wiki-memory-section-heading">
                    <h3>Add memory</h3>
                    <p>Choose the scope first, then save the fact as managed workspace memory.</p>
                  </div>
                  <form
                    className="repo-wiki-memory-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!memoryText.trim()) return;
                      onRememberMemory(memoryScope, memoryText);
                      setMemoryText('');
                      setWikiQuery('');
                    }}
                  >
                    <label>
                      <span>Scope</span>
                      <select
                        aria-label="Memory scope"
                        value={memoryScope}
                        onChange={(event) => setMemoryScope(event.target.value as WorkspaceMemoryScope)}
                      >
                        {snapshot.managedMemory.scopes.map((scope) => (
                          <option key={scope.scope} value={scope.scope}>{scope.title}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Memory</span>
                      <textarea
                        aria-label="Memory text"
                        value={memoryText}
                        onChange={(event) => setMemoryText(event.target.value)}
                        rows={3}
                        placeholder="Remember a durable fact"
                      />
                    </label>
                    <button type="submit" className="primary-button">Remember</button>
                  </form>
                </section>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function BrowserAgentRunSdkSettingsPanel({ state }: { state: BrowserAgentRunSdkState }) {
  const activeRuns = state.runs.filter((run) => run.status === 'queued' || run.status === 'running');
  const capabilityLabels = [
    'Typed launch API',
    'Structured event stream',
    'Reconnect cursor',
    'Cancellation control',
    'Archive and delete lifecycle',
  ];

  return (
    <SettingsSection title="Browser-agent run SDK" defaultOpen={false}>
      <div className="browser-agent-run-sdk-settings">
        <article className="provider-card browser-agent-run-sdk-card">
          <div className="provider-card-header">
            <div className="provider-body">
              <strong>Public durable run API</strong>
              <p>{state.runs.length} durable runs · {state.events.length} structured events · {activeRuns.length} active</p>
            </div>
            <span className="badge connected">typed</span>
          </div>
          <div className="browser-agent-run-sdk-chip-grid" aria-label="Browser-agent run SDK capabilities">
            {capabilityLabels.map((label) => (
              <span className="chip mini" key={label}>{label}</span>
            ))}
          </div>
          <p className="partner-agent-audit-note">
            Other tools can create runs, stream by sequence, reconnect from the last cursor, and apply explicit lifecycle controls without screen-scraping the UI.
          </p>
        </article>
      </div>
    </SettingsSection>
  );
}

function WorkspaceHistoryGraphPanel({
  graph,
  selectedRowId,
  onSelectRow,
}: {
  graph: WorkspaceHistoryGraph;
  selectedRowId: string | null;
  onSelectRow: (rowId: string) => void;
}) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const toggleRow = (rowId: string) => {
    setExpandedRows((current) => ({ ...current, [rowId]: !current[rowId] }));
    onSelectRow(rowId);
  };

  return (
    <section className="workspace-history-graph" aria-label="Workspace git graph">
      <div className="workspace-history-graph-header">
        <div>
          <span className="panel-eyebrow">Graph</span>
          <h3>{graph.workspaceName}</h3>
        </div>
        <div className="workspace-history-summary" aria-label="Workspace history summary">
          <span>{graph.summary.timelineNodes} nodes</span>
          <span>{graph.summary.mainlineCommits} main</span>
          <span>{graph.summary.lanes.length} lanes</span>
          <span>{graph.summary.squashMerges} squash</span>
        </div>
      </div>
      {graph.rows.length ? (
        <div className="workspace-history-scroll" aria-label="Scrollable workspace history" tabIndex={0}>
          <ol className="workspace-history-mainline" aria-label="Main history">
            {graph.rows.map((row, index) => (
              <WorkspaceHistoryGraphRow
                key={row.id}
                row={row}
                isFirst={index === 0}
                isLast={index === graph.rows.length - 1}
                selected={selectedRowId === row.id}
                expanded={Boolean(expandedRows[row.id])}
                onSelect={() => onSelectRow(row.id)}
                onToggle={() => toggleRow(row.id)}
              />
            ))}
          </ol>
        </div>
      ) : (
        <p className="workspace-history-empty">No session commits recorded yet.</p>
      )}
    </section>
  );
}

function WorkspaceHistoryCursorControls({
  state,
  workspaceId,
  onMoveCursor,
}: {
  state: WorkspaceActionHistoryState;
  workspaceId: string;
  onMoveCursor: (direction: WorkspaceActionHistoryDirection) => void;
}) {
  const actions = state.actions
    .filter((action) => action.workspaceId === workspaceId)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.id.localeCompare(right.id));
  const hasExplicitCursor = Object.prototype.hasOwnProperty.call(state.cursorByWorkspace, workspaceId);
  const cursor = hasExplicitCursor ? state.cursorByWorkspace[workspaceId] : actions.at(-1)?.id ?? null;
  const cursorIndex = cursor === null ? -1 : actions.findIndex((action) => action.id === cursor);
  const canMoveBack = actions.length > 0 && cursorIndex >= 0;
  const canMoveForward = actions.length > 0 && cursorIndex < actions.length - 1;
  const cursorLabel = cursorIndex < 0 ? 'baseline' : `${cursorIndex + 1}/${actions.length}`;

  return (
    <div className="workspace-history-cursor-controls" aria-label="Workspace history navigation">
      <button
        type="button"
        className="icon-button"
        aria-label="Move back on workspace history timeline"
        disabled={!canMoveBack}
        onClick={() => onMoveCursor('back')}
      >
        <Icon name="arrowLeft" size={13} />
      </button>
      <span>Timeline cursor: {cursorLabel}</span>
      <button
        type="button"
        className="icon-button"
        aria-label="Move forward on workspace history timeline"
        disabled={!canMoveForward}
        onClick={() => onMoveCursor('forward')}
      >
        <Icon name="arrowRight" size={13} />
      </button>
    </div>
  );
}

function WorkspaceHistoryGraphRow({
  row,
  isFirst,
  isLast,
  selected,
  expanded,
  onSelect,
  onToggle,
}: {
  row: WorkspaceHistoryRow;
  isFirst: boolean;
  isLast: boolean;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const detailLabel = `${row.detailCount} commit${row.detailCount === 1 ? '' : 's'}`;
  return (
    <li className={`workspace-history-row${isFirst ? ' is-first' : ''}${isLast ? ' is-last' : ''}${selected ? ' is-selected' : ''}`}>
      <div className="workspace-history-lane" aria-hidden="true">
        <span className="workspace-history-lane-line" />
        <span className="workspace-history-dot" style={{ backgroundColor: row.color }} />
      </div>
      <div className="workspace-history-row-body">
        <button
          type="button"
          className="workspace-history-row-select"
          aria-pressed={selected}
          aria-label={`Open history detail for ${row.title}`}
          onClick={onSelect}
        >
          <span className="workspace-history-row-title">
            <strong>{row.title}</strong>
            <span className="workspace-history-branch-pill">{row.statusLabel}</span>
          </span>
          <span className="workspace-history-row-summary">{row.summary}</span>
          <span className="workspace-history-row-meta">
            <span>{formatWorkspaceHistoryTime(row.timestamp)}</span>
            <span>{row.sourceBranchName}</span>
          </span>
        </button>
        {row.detailCount ? (
          <button
            type="button"
            className="workspace-history-inspect"
            aria-expanded={expanded}
            aria-label={`Inspect branch history for ${row.title}`}
            onClick={onToggle}
          >
            <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={12} />
            <span>Inspect branch history ({detailLabel})</span>
          </button>
        ) : null}
        {expanded ? <WorkspaceHistoryExpandedDetails row={row} /> : null}
      </div>
    </li>
  );
}

function WorkspaceHistoryExpandedDetails({ row }: { row: WorkspaceHistoryRow }) {
  if (row.children?.length) {
    return (
      <ol className="workspace-history-branch-details" aria-label={`Expanded history details for ${row.title}`}>
        {row.children.map((child) => (
          <li key={child.id} className="workspace-history-branch-detail-node">
            <span className="workspace-history-detail-dot" aria-hidden="true" />
            <span className="workspace-history-branch-detail-copy">
              <strong>{child.title}</strong>
              <span>{child.summary}</span>
              {child.detailRows.map((detail) => (
                <code key={detail.id}>{detail.label}</code>
              ))}
            </span>
          </li>
        ))}
      </ol>
    );
  }

  if (!row.detailRows.length) return null;
  return (
    <ol className="workspace-history-branch-details" aria-label={`Expanded history details for ${row.title}`}>
      {row.detailRows.map((detail) => (
        <li key={detail.id}>
          <span className="workspace-history-detail-dot" aria-hidden="true" />
          <code>{detail.label}</code>
        </li>
      ))}
    </ol>
  );
}

function WorkspaceHistoryDetailPanel({
  row,
  messagesBySession,
  fileHistories,
}: {
  row: WorkspaceHistoryRow | null;
  messagesBySession: Record<string, ChatMessage[]>;
  fileHistories: WorkspaceFileCrdtHistory[];
}) {
  if (!row) {
    return (
      <section className="workspace-history-detail-pane" aria-label="Selected history detail">
        <p className="workspace-history-empty">Select a history node to inspect its branch details.</p>
      </section>
    );
  }

  const target = row.target;
  if (target?.kind === 'chat-session') {
    const messages = messagesBySession[target.sessionId] ?? [];
    return (
      <section className="workspace-history-detail-pane" aria-label="Selected history detail">
        <WorkspaceHistoryDetailHeader row={row} mode="Read-only chat" />
        {messages.length ? (
          <>
            <ol className="workspace-history-chat-viewer" aria-label="Read-only chat session">
              {messages.map((message) => (
                <li key={message.id} className={`workspace-history-chat-message is-${message.role}`}>
                  <span>{message.role}</span>
                  <p>{message.streamedContent ?? message.content}</p>
                </li>
              ))}
            </ol>
            <WorkspaceHistoryDetailList row={row} />
          </>
        ) : (
          <WorkspaceHistoryDetailList row={row} />
        )}
      </section>
    );
  }

  if (target?.kind === 'file-version') {
    const history = fileHistories.find((candidate) => (
      candidate.workspaceId === target.workspaceId
      && candidate.path === target.filePath
    ));
    let materialized: ReturnType<typeof materializeWorkspaceFileVersion> | null = null;
    if (history) {
      try {
        materialized = materializeWorkspaceFileVersion(history, target.opId);
      } catch {
        materialized = null;
      }
    }
    return (
      <section className="workspace-history-detail-pane" aria-label="Selected history detail">
        <WorkspaceHistoryDetailHeader row={row} mode="Read-only file" />
        {materialized ? (
          <>
            <p className="workspace-history-crdt-note">
              Materialized from CRDT snapshot {materialized.sourceSnapshotId} with {materialized.direction} ({materialized.replayedOperationIds.length} ops).
            </p>
            <pre className="workspace-history-file-viewer" aria-label="Read-only file version">{materialized.content}</pre>
          </>
        ) : (
          <p className="workspace-history-empty">No CRDT snapshot is available for this file version.</p>
        )}
      </section>
    );
  }

  return (
    <section className="workspace-history-detail-pane" aria-label="Selected history detail">
      <WorkspaceHistoryDetailHeader row={row} mode={target?.kind === 'branch-history' ? 'Branch merge history' : 'History detail'} />
      <WorkspaceHistoryDetailList row={row} />
    </section>
  );
}

function WorkspaceHistoryDetailHeader({ row, mode }: { row: WorkspaceHistoryRow; mode: string }) {
  return (
    <header className="workspace-history-detail-header">
      <div>
        <span className="panel-eyebrow">{mode}</span>
        <h3>{row.title}</h3>
      </div>
      <span className="workspace-history-branch-pill">{row.branchName}</span>
    </header>
  );
}

function WorkspaceHistoryDetailList({ row }: { row: WorkspaceHistoryRow }) {
  return (
    <ol className="workspace-history-detail-list" aria-label={`Detailed history for ${row.title}`}>
      {row.detailRows.map((detail) => (
        <li key={detail.id}>
          <span className="workspace-history-detail-dot" aria-hidden="true" />
          <code>{detail.label}</code>
        </li>
      ))}
    </ol>
  );
}

function formatWorkspaceHistoryTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'unknown time';
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function HistoryPanel({
  workspaceId,
  workspaceName,
  sessions,
  scheduledAutomationState,
  runCheckpointState,
  browserAgentRunSdkState,
  conversationBranchingState,
  sessionChapterState,
  actionHistoryState,
  messagesBySession,
  fileHistories,
  onMoveActionHistoryCursor,
}: {
  workspaceId: string;
  workspaceName: string;
  sessions: WorkspaceHistorySessionInput[];
  scheduledAutomationState: ScheduledAutomationState;
  runCheckpointState: RunCheckpointState;
  browserAgentRunSdkState: BrowserAgentRunSdkState;
  conversationBranchingState: ConversationBranchingState;
  sessionChapterState: ChapteredSessionState;
  actionHistoryState: WorkspaceActionHistoryState;
  messagesBySession: Record<string, ChatMessage[]>;
  fileHistories: WorkspaceFileCrdtHistory[];
  onMoveActionHistoryCursor: (direction: WorkspaceActionHistoryDirection) => void;
}) {
  const workspaceHistoryGraph = useMemo(() => buildWorkspaceHistoryGraph({
    workspaceId,
    workspaceName,
    sessions,
    chapterState: sessionChapterState,
    conversationBranchingState,
    runCheckpointState,
    browserAgentRunSdkState,
    scheduledAutomationState,
    actionHistoryState,
    fileHistories,
    recentActivity: mockHistory,
  }), [actionHistoryState, browserAgentRunSdkState, conversationBranchingState, fileHistories, runCheckpointState, scheduledAutomationState, sessionChapterState, sessions, workspaceId, workspaceName]);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(workspaceHistoryGraph.rows[0]?.id ?? null);
  useEffect(() => {
    if (!workspaceHistoryGraph.rows.length) {
      setSelectedRowId(null);
      return;
    }
    if (!selectedRowId || !workspaceHistoryGraph.rows.some((row) => row.id === selectedRowId)) {
      setSelectedRowId(workspaceHistoryGraph.rows[0].id);
    }
  }, [selectedRowId, workspaceHistoryGraph.rows]);
  const selectedRow = workspaceHistoryGraph.rows.find((row) => row.id === selectedRowId) ?? workspaceHistoryGraph.rows[0] ?? null;

  return (
    <section className="panel-scroll history-panel" aria-label="History">
      <div className="panel-topbar">
        <h2>History</h2>
        <WorkspaceHistoryCursorControls
          state={actionHistoryState}
          workspaceId={workspaceId}
          onMoveCursor={onMoveActionHistoryCursor}
        />
      </div>
      <div className="workspace-history-browser">
        <WorkspaceHistoryGraphPanel
          graph={workspaceHistoryGraph}
          selectedRowId={selectedRow?.id ?? null}
          onSelectRow={setSelectedRowId}
        />
        <WorkspaceHistoryDetailPanel
          row={selectedRow}
          messagesBySession={messagesBySession}
          fileHistories={fileHistories}
        />
      </div>
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
  if (extensionId.endsWith('.design-md-context') || extensionId.endsWith('.design-studio') || extensionId.endsWith('.design-md')) return 'slidersHorizontal';
  if (extensionId.endsWith('.artifacts-context') || extensionId.endsWith('.artifacts-worktree') || extensionId.endsWith('.artifacts')) return 'layers';
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

function getDefaultExtensionName(extensionId: string, extensions: readonly DefaultExtensionDescriptor[]): string {
  return extensions.find((extension) => extension.manifest.id === extensionId)?.manifest.name ?? extensionId;
}

function getDefaultExtensionDependencyNames(
  extension: DefaultExtensionDescriptor,
  extensions: readonly DefaultExtensionDescriptor[],
): string[] {
  return getDefaultExtensionDependencyIds(extension)
    .map((extensionId) => getDefaultExtensionName(extensionId, extensions));
}

function getDefaultExtensionDependentNames(
  extension: DefaultExtensionDescriptor,
  installedExtensionIds: readonly string[],
  extensions: readonly DefaultExtensionDescriptor[],
): string[] {
  return resolveDefaultExtensionDependentIds([extension.manifest.id], installedExtensionIds, extensions)
    .map((extensionId) => getDefaultExtensionName(extensionId, extensions));
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

function parseWorkspacePluginDisplay(plugin: WorkspacePlugin): { id: string; name: string; version: string; description: string } {
  try {
    const manifest = JSON.parse(plugin.content) as Record<string, unknown>;
    return {
      id: typeof manifest.id === 'string' ? manifest.id : plugin.directory,
      name: typeof manifest.name === 'string' ? manifest.name : plugin.directory,
      version: typeof manifest.version === 'string' ? manifest.version : 'workspace',
      description: typeof manifest.description === 'string' ? manifest.description : plugin.path,
    };
  } catch {
    return { id: plugin.directory, name: plugin.directory, version: 'workspace', description: plugin.path };
  }
}

type ExtensionActionHandlers = {
  onInstallExtension: (extensionId: string) => void;
  onUninstallExtension: (extensionId: string) => void;
  onSetExtensionEnabled: (extensionId: string, enabled: boolean) => void;
  onConfigureExtension: (extension: DefaultExtensionDescriptor) => void;
};

type ExtensionNavigationHandlers = {
  onOpenExtensionDetail: (extensionId: string) => void;
};

function extensionMetadataValue(extension: DefaultExtensionDescriptor, key: string): unknown {
  const metadata = extension.marketplace.metadata;
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)[key]
    : undefined;
}

function getExtensionResourceRows(extension: DefaultExtensionDescriptor): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Manifest', value: extension.marketplace.manifest ?? extension.manifest.id },
    { label: 'Source', value: extension.marketplace.source?.path ?? 'Bundled package' },
  ];
  for (const asset of extension.manifest.assets ?? []) {
    if (asset.kind === 'documentation') rows.push({ label: 'README.md', value: asset.path });
  }
  const standardRefs = extensionMetadataValue(extension, 'standardRefs');
  if (Array.isArray(standardRefs)) {
    for (const ref of standardRefs) {
      if (typeof ref === 'string') rows.push({ label: 'Reference', value: ref });
    }
  }
  return rows;
}

function getExtensionReadmeBullets(extension: DefaultExtensionDescriptor): string[] {
  const bullets = [
    extension.manifest.description,
    ...((extension.manifest.capabilities ?? []).map((capability) => capability.description)),
    ...((extension.manifest.renderers ?? []).map((renderer) => renderer.description)),
    ...((extension.manifest.paneItems ?? []).map((paneItem) => paneItem.description)),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return bullets.length ? bullets : ['This plugin publishes manifest metadata for Agent Harness IDE integration.'];
}

function getExtensionContributionRows(extension: DefaultExtensionDescriptor): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  for (const capability of extension.manifest.capabilities ?? []) rows.push({ label: capability.kind, value: capability.id });
  for (const renderer of extension.manifest.renderers ?? []) rows.push({ label: 'renderer', value: renderer.id });
  for (const paneItem of extension.manifest.paneItems ?? []) rows.push({ label: 'pane', value: paneItem.id });
  for (const event of extension.manifest.activationEvents ?? []) rows.push({ label: 'activation', value: event });
  return rows;
}

function getExtensionFeatureTitle(extension: DefaultExtensionDescriptor): string {
  if (extension.manifest.id === 'agent-harness.ext.design-studio') return 'Design Studio';
  if (extension.manifest.id === 'agent-harness.ext.workflow-canvas') return 'Workflow Canvas';
  if (extension.manifest.id === 'agent-harness.ext.artifacts-worktree') return 'Artifact Worktree';
  return extension.manifest.name;
}

function getExtensionFeatureSummary(extension: DefaultExtensionDescriptor): string {
  if (extension.manifest.id === 'agent-harness.ext.design-studio') {
    return 'Compose DESIGN.md systems, inspect token guidance, and save each project as an artifact.';
  }
  if (extension.manifest.id === 'agent-harness.ext.workflow-canvas') {
    return 'Open saved workflow canvases as main-pane automation graphs backed by CNCF Serverless Workflow documents.';
  }
  if (extension.manifest.id === 'agent-harness.ext.artifacts-worktree') {
    return 'Browse artifacts as a worktree surface alongside Browser, Files, and Sessions.';
  }
  return extension.manifest.description;
}

function ExtensionActionButtons({
  extension,
  isInstalled,
  isEnabled,
  availability,
  onInstallExtension,
  onUninstallExtension,
  onSetExtensionEnabled,
  onConfigureExtension,
}: {
  extension: DefaultExtensionDescriptor;
  isInstalled: boolean;
  isEnabled: boolean;
  availability: ReturnType<typeof getDefaultExtensionAvailability>;
} & ExtensionActionHandlers) {
  const name = extension.manifest.name;
  if (!isInstalled) {
    const unavailable = availability.state === 'unavailable';
    return (
      <button
        type="button"
        className="sidebar-icon-button marketplace-action"
        disabled={unavailable}
        aria-label={unavailable ? `${name} unavailable` : `Install ${name}`}
        title={unavailable ? availability.reason : `Install ${name}`}
        onClick={() => onInstallExtension(extension.manifest.id)}
      >
        <Icon name="plus" size={13} />
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="sidebar-icon-button marketplace-action"
        aria-label={`Configure ${name}`}
        title={`Configure ${name}`}
        onClick={() => onConfigureExtension(extension)}
      >
        <Icon name="settings" size={13} />
      </button>
      <button
        type="button"
        className="sidebar-icon-button marketplace-action"
        aria-label={isEnabled ? `Disable ${name}` : `Enable ${name}`}
        title={`${isEnabled ? 'Disable' : 'Enable'} ${name} through OpenFeature`}
        onClick={() => onSetExtensionEnabled(extension.manifest.id, !isEnabled)}
      >
        <Icon name={isEnabled ? 'x' : 'plus'} size={13} />
      </button>
      <button
        type="button"
        className="sidebar-icon-button marketplace-action"
        aria-label={`Uninstall ${name}`}
        title={`Uninstall ${name}`}
        onClick={() => onUninstallExtension(extension.manifest.id)}
      >
        <Icon name="trash" size={13} />
      </button>
    </>
  );
}

function MarketplaceExtensionCard({
  extension,
  extensions,
  installedExtensionIdSet,
  enabledExtensionIdSet,
  daemonDownload,
  onOpenExtensionDetail,
  onInstallExtension,
  onUninstallExtension,
  onSetExtensionEnabled,
  onConfigureExtension,
}: {
  extension: DefaultExtensionDescriptor;
  extensions: readonly DefaultExtensionDescriptor[];
  installedExtensionIdSet: Set<string>;
  enabledExtensionIdSet: Set<string>;
  daemonDownload: DaemonDownloadChoice;
} & ExtensionActionHandlers & ExtensionNavigationHandlers) {
  const isInstalled = installedExtensionIdSet.has(extension.manifest.id);
  const isEnabled = enabledExtensionIdSet.has(extension.manifest.id);
  const category = getExtensionMarketplaceCategory(extension);
  const download = getDefaultExtensionDownload(extension.manifest, daemonDownload);
  const availability = getDefaultExtensionAvailability(extension);
  const dependencyNames = getDefaultExtensionDependencyNames(extension, extensions);
  const className = [
    'extension-row',
    `extension-row--${category}`,
    availability.state === 'unavailable' ? 'extension-row--unavailable' : '',
    isInstalled && !isEnabled ? 'extension-row--disabled' : '',
  ].filter(Boolean).join(' ');

  return (
    <article className={className} aria-disabled={availability.state === 'unavailable' ? true : undefined}>
      <button
        type="button"
        className="extension-row-main"
        aria-label={`Open details for ${extension.manifest.name}`}
        onClick={() => onOpenExtensionDetail(extension.manifest.id)}
      >
        <span className="extension-row-glyph">
          <Icon name={getDefaultExtensionIcon(extension)} color="currentColor" />
        </span>
        <div className="extension-row-body">
          <strong>{extension.manifest.name}</strong>
          <span className="extension-row-source">{getDefaultExtensionSourceLabel(extension)}</span>
          <p className="extension-row-desc">{extension.manifest.description}</p>
          <div className="extension-row-meta">
            <span>{EXTENSION_MARKETPLACE_CATEGORY_LABELS[category]}</span>
            {category === 'worker' ? <span>External runtime detection</span> : null}
            {category === 'provider' ? <span>Account configurable</span> : null}
            {isInstalled ? <span>{isEnabled ? 'OpenFeature enabled' : 'OpenFeature disabled'}</span> : null}
            {availability.state === 'unavailable' ? <span>Unavailable on this runtime</span> : null}
            <span>Configurable</span>
          </div>
          {dependencyNames.length > 0 ? (
            <div className="extension-dependency-lines" aria-label={`${extension.manifest.name} dependencies`}>
              {dependencyNames.map((name) => <span key={name}>Requires {name}</span>)}
            </div>
          ) : null}
        </div>
      </button>
      <div className="marketplace-actions">
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
        ) : null}
        <ExtensionActionButtons
          extension={extension}
          isInstalled={isInstalled}
          isEnabled={isEnabled}
          availability={availability}
          onInstallExtension={onInstallExtension}
          onUninstallExtension={onUninstallExtension}
          onSetExtensionEnabled={onSetExtensionEnabled}
          onConfigureExtension={onConfigureExtension}
        />
      </div>
    </article>
  );
}

function MarketplacePanel({
  defaultExtensions,
  installedExtensionIds,
  enabledExtensionIds,
  onOpenExtensionDetail,
  onInstallExtension,
  onUninstallExtension,
  onSetExtensionEnabled,
  onConfigureExtension,
}: {
  defaultExtensions: DefaultExtensionRuntime | null;
  installedExtensionIds: string[];
  enabledExtensionIds: string[];
} & ExtensionActionHandlers & ExtensionNavigationHandlers) {
  const [search, setSearch] = useState('');
  const daemonDownload = useResolvedDaemonDownloadChoice();
  const repoExtensions = defaultExtensions?.extensions ?? DEFAULT_EXTENSION_MANIFESTS;
  const installedExtensionIdSet = new Set(normalizeDefaultExtensionIds(installedExtensionIds));
  const enabledExtensionIdSet = new Set(enabledExtensionIds);
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
        <input
          aria-label="Search marketplace"
          name="extension-marketplace-search"
          autoComplete="off"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search marketplace…"
        />
      </label>
      <div className="marketplace-category-list">
        {EXTENSION_MARKETPLACE_CATEGORIES.map((category) => {
          const extensions = groups[category];
          return (
            <section key={category} className="marketplace-category-section" aria-labelledby={`marketplace-${category}-heading`}>
              <div className="marketplace-category-heading">
                <h3 id={`marketplace-${category}-heading`}>{EXTENSION_MARKETPLACE_CATEGORY_LABELS[category]}</h3>
                <span className="extension-count-mark">{extensions.length}</span>
              </div>
              <div className="extensions-list marketplace-category-grid">
                {extensions.map((extension) => (
                  <MarketplaceExtensionCard
                    key={extension.manifest.id}
                    extension={extension}
                    extensions={repoExtensions}
                    installedExtensionIdSet={installedExtensionIdSet}
                    enabledExtensionIdSet={enabledExtensionIdSet}
                    daemonDownload={daemonDownload}
                    onOpenExtensionDetail={onOpenExtensionDetail}
                    onInstallExtension={onInstallExtension}
                    onUninstallExtension={onUninstallExtension}
                    onSetExtensionEnabled={onSetExtensionEnabled}
                    onConfigureExtension={onConfigureExtension}
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
  enabledExtensionIds,
  onOpenExtensionDetail,
  onInstallExtension,
  onUninstallExtension,
  onSetExtensionEnabled,
  onConfigureExtension,
}: {
  workspaceName: string;
  capabilities: WorkspaceCapabilities;
  defaultExtensions: DefaultExtensionRuntime | null;
  installedExtensionIds: string[];
  enabledExtensionIds: string[];
} & ExtensionActionHandlers & ExtensionNavigationHandlers) {
  const installedExtensions = getInstalledDefaultExtensionDescriptors(defaultExtensions, installedExtensionIds);
  const installedByCategory = groupDefaultExtensionsByMarketplaceCategory(installedExtensions);
  const enabledExtensionIdSet = new Set(enabledExtensionIds);
  const repoExtensions = defaultExtensions?.extensions ?? DEFAULT_EXTENSION_MANIFESTS;
  const installedCount = installedExtensions.length + capabilities.plugins.length;

  return (
    <section className="panel-scroll extensions-panel" aria-label="Installed extensions">
      <div className="panel-topbar extensions-topbar">
        <div>
          <h2>Installed extensions</h2>
          <p className="muted">{installedCount} installed</p>
        </div>
      </div>
      <SidebarSection
        title="Installed extensions"
        summary={`${installedCount} installed`}
        scrollBody
      >
        <div className="extensions-list">
          {installedCount === 0 ? <p className="muted extension-empty-state">No installed extensions</p> : null}
          {EXTENSION_MARKETPLACE_CATEGORIES.map((category) => {
            const extensions = installedByCategory[category];
            if (!extensions.length) return null;
            return (
              <div key={category} className="installed-extension-group">
                <span className="extension-group-label">{EXTENSION_MARKETPLACE_CATEGORY_LABELS[category]}</span>
                {extensions.map((extension) => (
                  <InstalledExtensionCard
                    key={extension.manifest.id}
                    extension={extension}
                    repoExtensions={repoExtensions}
                    installedExtensionIds={installedExtensionIds}
                    enabled={enabledExtensionIdSet.has(extension.manifest.id)}
                    onOpenExtensionDetail={onOpenExtensionDetail}
                    onInstallExtension={onInstallExtension}
                    onUninstallExtension={onUninstallExtension}
                    onSetExtensionEnabled={onSetExtensionEnabled}
                    onConfigureExtension={onConfigureExtension}
                  />
                ))}
              </div>
            );
          })}
          {capabilities.plugins.length > 0 ? (
            <div className="installed-extension-group">
              <span className="extension-group-label">{workspaceName}</span>
              {capabilities.plugins.map((plugin) => (
                <WorkspacePluginInstalledCard key={plugin.path} plugin={plugin} />
              ))}
            </div>
          ) : null}
        </div>
      </SidebarSection>
    </section>
  );
}

function InstalledExtensionCard({
  extension,
  repoExtensions,
  installedExtensionIds,
  enabled,
  onOpenExtensionDetail,
  onUninstallExtension,
  onSetExtensionEnabled,
  onConfigureExtension,
}: {
  extension: DefaultExtensionDescriptor;
  repoExtensions: readonly DefaultExtensionDescriptor[];
  installedExtensionIds: readonly string[];
  enabled: boolean;
} & ExtensionActionHandlers & ExtensionNavigationHandlers) {
  const dependentNames = getDefaultExtensionDependentNames(extension, installedExtensionIds, repoExtensions);
  const [actionsOpen, setActionsOpen] = useState(false);
  const name = extension.manifest.name;
  const menuId = `installed-extension-actions-${extension.manifest.id.replace(/[^a-z0-9_-]/gi, '-')}`;
  const closeActions = () => setActionsOpen(false);

  return (
    <article
      className={`extension-row installed-extension-row ${enabled ? '' : 'extension-row--disabled'}`}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget;
        if (!(nextFocus instanceof Node) || !event.currentTarget.contains(nextFocus)) {
          closeActions();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') closeActions();
      }}
    >
      <button
        type="button"
        className="extension-row-main"
        aria-label={`Open details for ${name}`}
        onClick={() => onOpenExtensionDetail(extension.manifest.id)}
      >
        <span className="extension-row-glyph">
          <Icon name={getDefaultExtensionIcon(extension)} color="currentColor" />
        </span>
        <div className="extension-row-body">
          <strong>{name}</strong>
          <span className="extension-row-source">{getDefaultExtensionSourceLabel(extension)}</span>
          <p className="extension-row-desc">{extension.manifest.description}</p>
          <div className="extension-row-meta">
            <span>{enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          {dependentNames.length > 0 ? (
            <div className="extension-dependency-lines" aria-label={`${name} dependents`}>
              {dependentNames.map((name) => <span key={name}>Required by {name}</span>)}
            </div>
          ) : null}
        </div>
      </button>
      <div className="installed-extension-actions">
        <button
          type="button"
          className="sidebar-icon-button installed-extension-manage-button"
          aria-label={`Manage ${name}`}
          aria-haspopup="menu"
          aria-expanded={actionsOpen}
          aria-controls={actionsOpen ? menuId : undefined}
          title={`Manage ${name}`}
          onClick={() => setActionsOpen((open) => !open)}
        >
          <Icon name="settings" size={14} />
        </button>
        {actionsOpen ? (
          <div id={menuId} className="installed-extension-menu" role="menu" aria-label={`Manage ${name}`}>
            <button
              type="button"
              role="menuitem"
              aria-label={`Configure ${name}`}
              onClick={() => {
                closeActions();
                onConfigureExtension(extension);
              }}
            >
              Configure
            </button>
            <button
              type="button"
              role="menuitem"
              aria-label={enabled ? `Disable ${name}` : `Enable ${name}`}
              onClick={() => {
                closeActions();
                onSetExtensionEnabled(extension.manifest.id, !enabled);
              }}
            >
              {enabled ? 'Disable' : 'Enable'}
            </button>
            <button
              type="button"
              role="menuitem"
              className="installed-extension-menu-danger"
              aria-label={`Uninstall ${name}`}
              onClick={() => {
                closeActions();
                onUninstallExtension(extension.manifest.id);
              }}
            >
              Uninstall
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function WorkspacePluginInstalledCard({ plugin }: { plugin: WorkspacePlugin }) {
  const display = parseWorkspacePluginDisplay(plugin);
  return (
    <article className="extension-row installed-extension-row workspace-plugin-card">
      <div className="extension-row-main extension-row-main--static">
        <span className="extension-row-glyph">
          <Icon name="puzzle" color="currentColor" />
        </span>
        <div className="extension-row-body">
          <strong>{plugin.directory}</strong>
          <span className="extension-row-source">{display.name}</span>
          <p className="extension-row-desc">{display.description}</p>
          <div className="extension-row-meta">
            <span>Workspace plugin</span>
            <span>{display.id}</span>
            <span>{display.version}</span>
            <span>{plugin.manifestName}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function ExtensionDetailPage({
  extension,
  extensions,
  installedExtensionIds,
  enabledExtensionIds,
  daemonDownload,
  onInstallExtension,
  onUninstallExtension,
  onSetExtensionEnabled,
  onConfigureExtension,
}: {
  extension: DefaultExtensionDescriptor;
  extensions: readonly DefaultExtensionDescriptor[];
  installedExtensionIds: readonly string[];
  enabledExtensionIds: readonly string[];
  daemonDownload: DaemonDownloadChoice;
} & ExtensionActionHandlers) {
  const detailTabs = ['Details', 'Features', 'Changelog', 'Dependencies'] as const;
  const [activeTab, setActiveTab] = useState<(typeof detailTabs)[number]>('Details');
  const installedExtensionIdSet = new Set(normalizeDefaultExtensionIds(installedExtensionIds));
  const enabledExtensionIdSet = new Set(enabledExtensionIds);
  const isInstalled = installedExtensionIdSet.has(extension.manifest.id);
  const isEnabled = enabledExtensionIdSet.has(extension.manifest.id);
  const availability = getDefaultExtensionAvailability(extension);
  const category = getExtensionMarketplaceCategory(extension);
  const dependencyNames = getDefaultExtensionDependencyNames(extension, extensions);
  const dependentNames = getDefaultExtensionDependentNames(extension, installedExtensionIds, extensions);
  const contributionRows = getExtensionContributionRows(extension);
  const resourceRows = getExtensionResourceRows(extension);
  const readmeBullets = getExtensionReadmeBullets(extension);
  const download = getDefaultExtensionDownload(extension.manifest, daemonDownload);

  return (
    <section className="extension-detail-page" role="region" aria-label="Extension detail">
      <header className="extension-detail-hero">
        <div className="extension-detail-icon">
          <Icon name={getDefaultExtensionIcon(extension)} size={54} />
        </div>
        <div className="extension-detail-title">
          <h2>{extension.manifest.name}</h2>
          <div className="extension-detail-publisher">
            <span>{getDefaultExtensionSourceLabel(extension)}</span>
            <span>{extension.manifest.version}</span>
            <span>{EXTENSION_MARKETPLACE_CATEGORY_LABELS[category]}</span>
          </div>
          <p>{extension.manifest.description}</p>
          <div className="extension-detail-actions">
            {download ? (
              <a
                className="secondary-button"
                href={download.href}
                download={download.fileName}
                aria-label={`Download ${extension.manifest.name}${download.includeLabelInAria ? ` for ${download.label}` : ''}`}
              >
                <Icon name="download" size={13} />
              </a>
            ) : null}
            <ExtensionActionButtons
              extension={extension}
              isInstalled={isInstalled}
              isEnabled={isEnabled}
              availability={availability}
              onInstallExtension={onInstallExtension}
              onUninstallExtension={onUninstallExtension}
              onSetExtensionEnabled={onSetExtensionEnabled}
              onConfigureExtension={onConfigureExtension}
            />
          </div>
        </div>
      </header>

      <div className="extension-detail-tabs" role="tablist" aria-label={`${extension.manifest.name} sections`}>
        {detailTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="extension-detail-layout">
        <article className="extension-readme" aria-label={`${extension.manifest.name} README`}>
          <h3>README.md</h3>
          {activeTab === 'Details' ? (
            <>
              <p>{extension.manifest.description}</p>
              <h4>Features</h4>
              <ul>
                {readmeBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
            </>
          ) : null}
          {activeTab === 'Features' ? (
            <div className="extension-contribution-list">
              {contributionRows.length ? contributionRows.map((row, index) => (
                <span key={`${row.label}:${row.value}:${index}`}>
                  <strong>{row.label}</strong>
                  <code>{row.value}</code>
                </span>
              )) : <p>No contribution points declared.</p>}
            </div>
          ) : null}
          {activeTab === 'Changelog' ? (
            <div className="extension-contribution-list">
              <span>
                <strong>{extension.manifest.version}</strong>
                <code>Bundled marketplace manifest synchronized with the local package index.</code>
              </span>
            </div>
          ) : null}
          {activeTab === 'Dependencies' ? (
            <div className="extension-sidebar-line-list">
              {dependencyNames.length || dependentNames.length ? (
                <>
                  {dependencyNames.map((name) => <span key={`requires:${name}`}>Requires {name}</span>)}
                  {dependentNames.map((name) => <span key={`required-by:${name}`}>Required by {name}</span>)}
                </>
              ) : <p>No extension dependencies.</p>}
            </div>
          ) : null}
          {availability.state === 'unavailable' ? <p className="extension-detail-warning">{availability.reason}</p> : null}
        </article>

        <aside className="extension-detail-sidebar" aria-label="Extension metadata">
          <section>
            <h3>Installation</h3>
            <dl>
              <dt>Identifier</dt>
              <dd>{extension.manifest.id}</dd>
              <dt>Version</dt>
              <dd>{extension.manifest.version}</dd>
              <dt>Status</dt>
              <dd>{isInstalled ? (isEnabled ? 'Enabled' : 'Disabled') : 'Not installed'}</dd>
              <dt>Category</dt>
              <dd>{EXTENSION_MARKETPLACE_CATEGORY_LABELS[category]}</dd>
            </dl>
          </section>
          <section>
            <h3>Marketplace</h3>
            <dl>
              <dt>Publisher</dt>
              <dd>{getDefaultExtensionSourceLabel(extension)}</dd>
              <dt>Package</dt>
              <dd>{extension.marketplace.source?.path ?? extension.marketplace.manifest}</dd>
              <dt>Keywords</dt>
              <dd>{extension.marketplace.keywords?.join(', ') || 'none'}</dd>
            </dl>
          </section>
          <section>
            <h3>Dependencies</h3>
            {dependencyNames.length || dependentNames.length ? (
              <div className="extension-sidebar-line-list">
                {dependencyNames.map((name) => <span key={`requires:${name}`}>Requires {name}</span>)}
                {dependentNames.map((name) => <span key={`required-by:${name}`}>Required by {name}</span>)}
              </div>
            ) : (
              <p>No extension dependencies.</p>
            )}
          </section>
          <section>
            <h3>Resources</h3>
            <div className="extension-resource-list">
              {resourceRows.map((row, index) => (
                <span key={`${row.label}:${row.value}:${index}`}>
                  <strong>{row.label}</strong>
                  <code>{row.value}</code>
                </span>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function formatDesignStudioProjectTimestamp(value: string | undefined): string {
  if (!value) return 'Never saved';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function DesignStudioProjectsPanel({
  artifacts,
  onOpenProject,
  onDownloadProject,
}: {
  artifacts: readonly AgentArtifact[];
  onOpenProject: (artifact: AgentArtifact) => void;
  onDownloadProject: (artifactId: string) => void;
}) {
  const projects = artifacts
    .filter((artifact) => artifact.kind === 'design-studio-project')
    .sort((left, right) => {
      const leftUpdated = Date.parse(left.updatedAt ?? left.createdAt);
      const rightUpdated = Date.parse(right.updatedAt ?? right.createdAt);
      return (Number.isNaN(rightUpdated) ? 0 : rightUpdated) - (Number.isNaN(leftUpdated) ? 0 : leftUpdated);
    });

  return (
    <section className="panel-scroll design-studio-projects-panel" aria-label="Design Studio projects">
      <div className="panel-section-header">
        <div>
          <h2>Design Studio</h2>
          <p>{projects.length} {projects.length === 1 ? 'project' : 'projects'} saved as artifacts</p>
        </div>
      </div>
      <SidebarSection title="Projects" summary={`${projects.length} saved`}>
        {projects.length ? (
          <div className="design-studio-project-list">
            {projects.map((artifact) => (
              <article key={artifact.id} className="design-studio-project-row">
                <button
                  type="button"
                  className="design-studio-project-main"
                  onClick={() => onOpenProject(artifact)}
                  aria-label={`Open ${artifact.title} project artifact`}
                  title={`Open ${artifact.title}`}
                >
                  <Icon name="layers" size={16} />
                  <span>
                    <strong>{artifact.title}</strong>
                    <small>{artifact.files.length} files · {formatDesignStudioProjectTimestamp(artifact.updatedAt ?? artifact.createdAt)}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="sidebar-icon-button"
                  onClick={() => onDownloadProject(artifact.id)}
                  aria-label={`Download ${artifact.title} project artifact`}
                  title={`Download ${artifact.title}`}
                >
                  <Icon name="download" size={14} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="sidebar-muted-text">No design projects yet. Save from Design Studio to create one.</p>
        )}
      </SidebarSection>
    </section>
  );
}

type DesignStudioView = 'preview' | 'review' | 'files' | 'critique' | 'research';

const DESIGN_STUDIO_VIEWS: Array<{ id: DesignStudioView; icon: keyof typeof icons; label: string }> = [
  { id: 'preview', icon: 'canvas', label: 'Show preview' },
  { id: 'review', icon: 'clipboard', label: 'Show token review' },
  { id: 'files', icon: 'file', label: 'Show DESIGN.md files' },
  { id: 'critique', icon: 'sparkles', label: 'Show critique' },
  { id: 'research', icon: 'search', label: 'Show research' },
];

function DesignStudioPane({
  workspaceName,
  artifacts,
  onProjectArtifactSave,
}: {
  workspaceName: string;
  artifacts: AgentArtifact[];
  onProjectArtifactSave: (input: DesignStudioProjectArtifactInput, existingArtifactId?: string | null) => AgentArtifact;
}) {
  const [studioState, setStudioState] = useState<DesignStudioState>(() => createDesignStudioState({
    workspaceName,
    brief: {
      projectName: `${workspaceName} Design System`,
      audience: 'Agent Browser users',
      surface: 'IDE extension pane',
      prompt: 'Build a sleek AI-native DESIGN.md studio for composing product design systems.',
      githubUrl: '',
      localFolder: 'agent-browser',
      designFile: 'DESIGN.md',
      assets: '',
      notes: 'Keep controls minimal, icon-led, and useful at phone, tablet, and desktop widths.',
    },
  }));
  const [view, setView] = useState<DesignStudioView>('preview');
  const [inspectMode, setInspectMode] = useState(true);
  const [status, setStatus] = useState('Ready to compile DESIGN.md');
  const [projectArtifactId, setProjectArtifactId] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const latestStateRef = useRef(studioState);
  const projectArtifactIdRef = useRef(projectArtifactId);
  const researchInventory = useMemo(() => getDesignStudioResearchInventory(), []);
  const draftProjectArtifact = useMemo(
    () => createDesignStudioProjectArtifactInput(studioState),
    [studioState],
  );
  const currentProjectArtifact = projectArtifactId
    ? artifacts.find((artifact) => artifact.id === projectArtifactId) ?? null
    : null;
  const projectArtifactDisplayId = currentProjectArtifact?.id ?? draftProjectArtifact.id;
  const currentExportFiles: DesignStudioArtifactFile[] = currentProjectArtifact
    ? currentProjectArtifact.files
      .filter((file) => file.path.startsWith('exports/'))
      .map((file) => ({
        path: file.path,
        content: file.content,
        updatedAt: file.updatedAt ?? currentProjectArtifact.updatedAt ?? currentProjectArtifact.createdAt,
        mediaType: file.mediaType,
      }))
    : [];
  const designFiles = [
    ...draftProjectArtifact.files,
    ...currentExportFiles.filter((file) => !draftProjectArtifact.files.some((draftFile) => draftFile.path === file.path)),
  ].sort((left, right) => left.path.localeCompare(right.path));
  const activeDirection = DESIGN_STUDIO_DIRECTIONS.find((direction) => direction.id === studioState.directionId)
    ?? DESIGN_STUDIO_DIRECTIONS[0]!;
  const approvalSummary = getDesignStudioApprovalSummary(studioState);
  const approvalComposition = createDesignStudioApprovalComposition(studioState);
  const designDocument = draftProjectArtifact.files.find((file) => file.path === 'DESIGN.md')?.content
    ?? buildDesignStudioArtifactFiles(studioState)[0].content;
  const projectNameCollision = findDesignStudioProjectNameCollision(studioState, artifacts, projectArtifactId);

  useEffect(() => {
    latestStateRef.current = studioState;
  }, [studioState]);

  useEffect(() => {
    projectArtifactIdRef.current = projectArtifactId;
  }, [projectArtifactId]);

  useEffect(() => {
    if (projectArtifactId) return;
    const existingArtifact = artifacts.find((artifact) => (
      artifact.kind === 'design-studio-project'
      && (artifact.id === draftProjectArtifact.id || artifact.title.trim().toLowerCase() === draftProjectArtifact.title.trim().toLowerCase())
    ));
    if (existingArtifact) {
      setProjectArtifactId(existingArtifact.id);
      projectArtifactIdRef.current = existingArtifact.id;
    }
  }, [artifacts, draftProjectArtifact.id, draftProjectArtifact.title, projectArtifactId]);

  const markStudioStateDirty = useCallback((updater: (current: DesignStudioState) => DesignStudioState) => {
    dirtyRef.current = true;
    setStudioState(updater);
  }, []);

  const saveProjectArtifact = useCallback((
    state = latestStateRef.current,
    nextStatus = 'Project artifact auto-saved',
    options: { updateStatus?: boolean } = {},
  ) => {
    const existingArtifactId = projectArtifactIdRef.current;
    const collision = findDesignStudioProjectNameCollision(state, artifacts, existingArtifactId);
    if (collision) {
      if (options.updateStatus !== false) {
        setStatus(`Project name collides with artifact "${collision.title}"`);
      }
      return null;
    }

    const artifact = onProjectArtifactSave(createDesignStudioProjectArtifactInput(state, {
      artifactId: existingArtifactId ?? undefined,
      timestamp: new Date().toISOString(),
    }), existingArtifactId);
    projectArtifactIdRef.current = artifact.id;
    setProjectArtifactId(artifact.id);
    dirtyRef.current = false;
    if (options.updateStatus !== false) {
      setStatus(nextStatus);
    }
    return artifact;
  }, [artifacts, onProjectArtifactSave]);

  useEffect(() => () => {
    if (dirtyRef.current) {
      saveProjectArtifact(latestStateRef.current, 'Project artifact auto-saved before navigation', { updateStatus: false });
    }
  }, [saveProjectArtifact]);

  const changeBrief = (field: keyof DesignStudioBrief, value: string) => {
    markStudioStateDirty((current) => updateDesignStudioBrief(current, { [field]: value } as Partial<DesignStudioBrief>));
  };

  const approveTokenReview = (item: DesignStudioTokenReviewItem) => {
    markStudioStateDirty((current) => approveDesignStudioTokenRevision(current, item.id, 'Design lead', 'Looks good.'));
    setStatus(`${item.label} approved`);
  };

  const requestTokenRevision = (item: DesignStudioTokenReviewItem) => {
    markStudioStateDirty((current) => requestDesignStudioTokenRevision(
      current,
      item.id,
      `${item.proposedValue} · revise`,
      'Design lead',
      'Needs work before this token can be locked.',
    ));
    setStatus(`${item.label} revision requested`);
  };

  const publishDesignSystem = (enabled: boolean) => {
    if (!enabled) {
      markStudioStateDirty((current) => ({ ...current, published: false }));
      setStatus('Design system unpublished');
      return;
    }
    markStudioStateDirty((current) => publishDesignStudioSystem(current, 'Design lead', 'Published approved DESIGN.md system.'));
    setStatus(approvalSummary.readyToPublish ? 'Design system published' : 'Publish blocked until token reviews are approved');
  };

  const setDefaultDesignSystem = (enabled: boolean) => {
    markStudioStateDirty((current) => ({ ...current, defaultForWorkspace: enabled }));
    setStatus(enabled ? 'Design system marked as workspace default' : 'Workspace default cleared');
  };

  const compileDesignSystem = () => {
    saveProjectArtifact(studioState, 'DESIGN.md saved to project artifact');
    setView('files');
  };

  const runCritique = () => {
    const critique = runDesignStudioCritique(studioState);
    const nextState = { ...studioState, lastCritique: critique };
    dirtyRef.current = true;
    latestStateRef.current = nextState;
    setStudioState(nextState);
    saveProjectArtifact(nextState, `Critique ${critique.gate} at ${critique.score}/10`);
    setView('critique');
  };

  const exportHtml = () => {
    const collision = findDesignStudioProjectNameCollision(studioState, artifacts, projectArtifactIdRef.current);
    if (collision) {
      setStatus(`Project name collides with artifact "${collision.title}"`);
      return;
    }
    const exportFile = createDesignStudioExportArtifact('html', studioState, new Date().toISOString());
    const nextState = latestStateRef.current;
    const baseFiles = createDesignStudioProjectArtifactInput(nextState).files;
    const preservedExportFiles = currentExportFiles.filter((file) => file.path !== exportFile.path);
    const artifact = onProjectArtifactSave({
      ...createDesignStudioProjectArtifactInput(nextState, {
        artifactId: projectArtifactIdRef.current ?? undefined,
        timestamp: new Date().toISOString(),
      }),
      files: [...baseFiles, ...preservedExportFiles, exportFile],
    }, projectArtifactIdRef.current);
    projectArtifactIdRef.current = artifact.id;
    setProjectArtifactId(artifact.id);
    dirtyRef.current = false;
    setStatus('Standalone HTML export added to project artifact');
    setView('files');
  };

  const exportHandoff = () => {
    const collision = findDesignStudioProjectNameCollision(studioState, artifacts, projectArtifactIdRef.current);
    if (collision) {
      setStatus(`Project name collides with artifact "${collision.title}"`);
      return;
    }
    const exportFile = createDesignStudioExportArtifact('handoff', studioState, new Date().toISOString());
    const nextState = latestStateRef.current;
    const baseFiles = createDesignStudioProjectArtifactInput(nextState).files;
    const preservedExportFiles = currentExportFiles.filter((file) => file.path !== exportFile.path);
    const artifact = onProjectArtifactSave({
      ...createDesignStudioProjectArtifactInput(nextState, {
        artifactId: projectArtifactIdRef.current ?? undefined,
        timestamp: new Date().toISOString(),
      }),
      files: [...baseFiles, ...preservedExportFiles, exportFile],
    }, projectArtifactIdRef.current);
    projectArtifactIdRef.current = artifact.id;
    setProjectArtifactId(artifact.id);
    dirtyRef.current = false;
    setStatus('agent handoff added to project artifact');
    setView('files');
  };

  const switchDesignStudioView = (nextView: DesignStudioView) => {
    if (dirtyRef.current) {
      saveProjectArtifact(studioState, 'Project artifact auto-saved before navigation');
    }
    setView(nextView);
  };

  const handleStudioBlur = (event: React.FocusEvent<HTMLElement>) => {
    const nextFocused = event.relatedTarget;
    if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) return;
    if (dirtyRef.current) {
      saveProjectArtifact(studioState, 'Project artifact auto-saved on unfocus');
    }
  };

  return (
    <section className="design-studio-studio" role="region" aria-label="Design Studio feature pane" onBlurCapture={handleStudioBlur}>
      <header className="ds-topbar">
        <div className="ds-title-lockup">
          <span className="ds-logo-mark"><Icon name="slidersHorizontal" size={20} /></span>
          <div>
            <span className="panel-eyebrow">DESIGN.md Studio</span>
            <h2>Design Studio</h2>
            <p>Brief, review, approve, preview, critique, and export a design system that agents can apply.</p>
            {projectNameCollision ? (
              <p className="ds-collision-warning" role="alert">
                Project name collides with artifact "{projectNameCollision.title}".
              </p>
            ) : null}
          </div>
        </div>
        <div className="ds-toolbar" aria-label="Design Studio actions">
          <button type="button" className="ds-icon-action" aria-label="Compile DESIGN.md" title="Compile DESIGN.md" onClick={compileDesignSystem}>
            <Icon name="save" size={15} />
          </button>
          <button type="button" className="ds-icon-action" aria-label="Run design critique" title="Run design critique" onClick={runCritique}>
            <Icon name="sparkles" size={15} />
          </button>
          <button type="button" className="ds-icon-action" aria-label="Publish approved design system" title="Publish approved design system" onClick={() => publishDesignSystem(true)}>
            <Icon name="clipboard" size={15} />
          </button>
          <button type="button" className="ds-icon-action" aria-label="Export standalone HTML" title="Export standalone HTML" onClick={exportHtml}>
            <Icon name="download" size={15} />
          </button>
          <button type="button" className="ds-icon-action" aria-label="Export agent handoff" title="Export agent handoff" onClick={exportHandoff}>
            <Icon name="share" size={15} />
          </button>
        </div>
      </header>

      <div className="ds-workbench">
        <aside className="ds-brief-rail" aria-label="Design brief">
          <div className="ds-rail-header">
            <Icon name="messageSquare" size={14} />
            <strong>Brief</strong>
          </div>
          <label>
            <span>Project</span>
            <input aria-label="Design Studio project name" value={studioState.brief.projectName} onChange={(event) => changeBrief('projectName', event.target.value)} />
          </label>
          <label>
            <span>Prompt</span>
            <textarea aria-label="Design Studio design prompt" value={studioState.brief.prompt} onChange={(event) => changeBrief('prompt', event.target.value)} />
          </label>
          <label>
            <span>Audience</span>
            <input aria-label="Design Studio audience" value={studioState.brief.audience} onChange={(event) => changeBrief('audience', event.target.value)} />
          </label>
          <label>
            <span>Surface</span>
            <input aria-label="Design Studio surface" value={studioState.brief.surface} onChange={(event) => changeBrief('surface', event.target.value)} />
          </label>
          <label>
            <span>Code</span>
            <input aria-label="Design Studio local folder" value={studioState.brief.localFolder} onChange={(event) => changeBrief('localFolder', event.target.value)} />
          </label>
          <label>
            <span>Assets</span>
            <input aria-label="Design Studio assets" value={studioState.brief.assets} onChange={(event) => changeBrief('assets', event.target.value)} />
          </label>
          <label>
            <span>Notes</span>
            <textarea aria-label="Design Studio notes" value={studioState.brief.notes} onChange={(event) => changeBrief('notes', event.target.value)} />
          </label>
        </aside>

        <main className="ds-main-stage">
          <div className="ds-stage-switcher" role="tablist" aria-label="Design Studio views">
            {DESIGN_STUDIO_VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={view === item.id}
                className={view === item.id ? 'is-active' : ''}
                aria-label={item.label}
                title={item.label}
                onClick={() => switchDesignStudioView(item.id)}
              >
                <Icon name={item.icon} size={15} />
              </button>
            ))}
            <button
              type="button"
              className={inspectMode ? 'is-active' : ''}
              aria-label="Toggle inspect mode"
              title="Toggle inspect mode"
              onClick={() => setInspectMode((current) => !current)}
            >
              <Icon name="pencil" size={15} />
            </button>
          </div>

          {view === 'preview' ? (
            <section className="ds-preview-plane" aria-label="Design Studio preview">
              <div className="ds-artifact-frame">
                <div className="ds-artifact-topline">
                  <span>Browser frame</span>
                  <span>{studioState.fidelity}</span>
                  <span>{activeDirection.label}</span>
                </div>
                <div className="ds-artifact-body" style={{
                  '--ds-canvas': activeDirection.palette.canvas,
                  '--ds-surface': activeDirection.palette.surface,
                  '--ds-text': activeDirection.palette.text,
                  '--ds-muted': activeDirection.palette.muted,
                  '--ds-accent': activeDirection.palette.accent,
                  '--ds-border': activeDirection.palette.border,
                } as CSSProperties}>
                  <div className="ds-artifact-copy">
                    <span>Design Studio seed</span>
                    <h3>{studioState.brief.projectName || `${workspaceName} Design System`}</h3>
                    <p>{studioState.brief.prompt}</p>
                    <button type="button" aria-label="Preview primary action" title="Preview primary action">
                      <Icon name="sparkles" size={14} />
                    </button>
                  </div>
                  <div className="ds-token-ladder" aria-label="Generated token swatches">
                    {Object.entries(activeDirection.palette).slice(0, 6).map(([name, value]) => (
                      <span key={name} title={`${name}: ${value}`} style={{ background: value }} />
                    ))}
                  </div>
                </div>
              </div>
              {inspectMode ? (
                <div className="ds-inspect-strip" aria-label="Design Studio inspect controls">
                  <label>
                    <span>Density</span>
                    <input
                      aria-label="Design Studio density"
                      type="range"
                      min="3"
                      max="6"
                      value={studioState.density}
                      onChange={(event) => markStudioStateDirty((current) => ({ ...current, density: Number(event.target.value) }))}
                    />
                    <output>{studioState.density}</output>
                  </label>
                  <label>
                    <span>Radius</span>
                    <input
                      aria-label="Design Studio radius"
                      type="range"
                      min="2"
                      max="10"
                      value={studioState.radius}
                      onChange={(event) => markStudioStateDirty((current) => ({ ...current, radius: Number(event.target.value) }))}
                    />
                    <output>{studioState.radius}px</output>
                  </label>
                  <span>Inspect mode tunes computed DESIGN.md tokens before export.</span>
                </div>
              ) : null}
            </section>
          ) : view === 'review' ? (
            <section className="ds-token-review-plane" aria-label="Design Studio token review">
              <div className="ds-plane-heading">
                <Icon name="clipboard" size={14} />
                <strong>{approvalSummary.status === 'published' ? 'Published token system' : approvalSummary.readyToPublish ? 'Ready to publish' : 'Token review queue'}</strong>
              </div>
              <div className="ds-review-summary" aria-label="Design Studio approval summary">
                <span>{approvalSummary.approved}/{approvalSummary.total} approved</span>
                <span>{approvalSummary.needsReview} needs review</span>
                <span>{approvalSummary.changesRequested} needs work</span>
                <span>{studioState.published ? 'Published' : 'Draft'}</span>
              </div>
              <div className="ds-font-warning">
                <Icon name="file" size={14} />
                <span>Design Studio review parity: missing fonts and extracted tokens must be reviewed before publishing.</span>
              </div>
              <DesignStudioApprovalCompositionSample
                composition={approvalComposition}
                direction={activeDirection}
                state={studioState}
              />
              <div className="ds-token-review-list">
                {studioState.tokenReviews.map((item) => (
                  <div key={item.id} className={`ds-token-review-row ds-token-review-row--${item.status}`}>
                    <div className="ds-token-review-copy">
                      <span>{item.group} · rev {item.revision}</span>
                      <strong>{item.label}</strong>
                      <code>{item.currentValue}</code>
                      <code>{item.proposedValue}</code>
                      <small>{item.note || item.source}</small>
                    </div>
                    <DesignStudioTokenVisualSample
                      direction={activeDirection}
                      item={item}
                      radius={studioState.radius}
                    />
                    <span className="ds-token-review-state">{item.status}</span>
                    <div className="ds-token-review-actions" aria-label={`${item.label} review actions`}>
                      <button type="button" aria-label={`Approve ${item.label}`} title={`Approve ${item.label}`} onClick={() => approveTokenReview(item)}>
                        <Icon name="save" size={14} />
                      </button>
                      <button type="button" aria-label={`Request changes for ${item.label}`} title={`Request changes for ${item.label}`} onClick={() => requestTokenRevision(item)}>
                        <Icon name="pencil" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="ds-publish-strip" aria-label="Design Studio publish controls">
                <label>
                  <input
                    aria-label="Publish approved Design Studio system"
                    type="checkbox"
                    checked={studioState.published}
                    onChange={(event) => publishDesignSystem(event.target.checked)}
                  />
                  <span>Published</span>
                </label>
                <label>
                  <input
                    aria-label="Use Design Studio system as workspace default"
                    type="checkbox"
                    checked={studioState.defaultForWorkspace}
                    onChange={(event) => setDefaultDesignSystem(event.target.checked)}
                  />
                  <span>Default</span>
                </label>
              </div>
              <div className="ds-approval-event-list" aria-label="Design Studio approval events">
                {studioState.approvalEvents.length ? studioState.approvalEvents.slice(-5).map((event) => (
                  <span key={event.id}>{event.action} · {event.itemId} · {event.reviewer}</span>
                )) : <span>No token decisions recorded yet.</span>}
              </div>
            </section>
          ) : view === 'files' ? (
            <section className="ds-file-plane" aria-label="Design Studio generated artifacts">
              <div className="ds-plane-heading">
                <Icon name="file" size={14} />
                <strong>Generated files</strong>
              </div>
              <div className="ds-file-list">
                {designFiles.length ? designFiles.map((file) => (
                  <div key={file.path} className="ds-file-row">
                    <Icon name={file.path.endsWith('.md') ? 'file' : file.path.endsWith('.html') ? 'globe' : 'clipboard'} size={14} />
                    <code>{`//workspace/artifacts/${projectArtifactDisplayId}/${file.path}`}</code>
                    <span>{file.content.length.toLocaleString()} bytes</span>
                  </div>
                )) : <p>No files generated yet. Compile DESIGN.md to write the studio bundle.</p>}
              </div>
              <pre className="ds-design-md-preview" aria-label="DESIGN.md preview">{designDocument}</pre>
            </section>
          ) : view === 'critique' ? (
            <section className="ds-critique-plane" aria-label="Design Studio critique">
              <div className="ds-plane-heading">
                <Icon name="sparkles" size={14} />
                <strong>{studioState.lastCritique ? `Gate ${studioState.lastCritique.gate} at ${studioState.lastCritique.score}/10` : 'Critique not run'}</strong>
              </div>
              <div className="ds-critique-list">
                {(studioState.lastCritique?.panelists ?? []).map((panelist) => (
                  <div key={panelist.id} className="ds-critique-row">
                    <strong>{panelist.label}</strong>
                    <span>{panelist.score}/10</span>
                    <p>{panelist.finding}</p>
                  </div>
                ))}
                {!studioState.lastCritique ? <p>Run critique to score accessibility, brand fit, craft, hierarchy, and implementation readiness.</p> : null}
              </div>
            </section>
          ) : (
            <section className="ds-research-plane" aria-label="Design Studio research">
              <div className="ds-plane-heading">
                <Icon name="search" size={14} />
                <strong>Captured research</strong>
              </div>
              <div className="ds-research-list">
                {researchInventory.sources.map((source) => (
                  <a key={`${source.product}:${source.title}`} href={source.url} target="_blank" rel="noreferrer" className="ds-research-row">
                    <span>{source.product}</span>
                    <strong>{source.title}</strong>
                    <small>{source.features.join(' / ')}</small>
                  </a>
                ))}
              </div>
              <div className="ds-research-list ds-screenshot-list">
                {researchInventory.screenshotReferences.map((screenshot) => (
                  <a key={`${screenshot.product}:${screenshot.label}`} href={screenshot.url} target="_blank" rel="noreferrer" className="ds-research-row">
                    <span>{screenshot.product}</span>
                    <strong>{screenshot.label}</strong>
                    <small>{screenshot.userFlow}</small>
                  </a>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="ds-token-rail" aria-label="Design Studio token rail">
          <div className="ds-rail-header">
            <Icon name="slidersHorizontal" size={14} />
            <strong>Directions</strong>
          </div>
          <div className="ds-direction-list">
            {DESIGN_STUDIO_DIRECTIONS.map((direction) => (
              <div key={direction.id} className={`ds-direction-row${direction.id === studioState.directionId ? ' is-active' : ''}`}>
                <button
                  type="button"
                  aria-label={`Select ${direction.label} direction`}
                  title={`Select ${direction.label}`}
                  onClick={() => markStudioStateDirty((current) => selectDesignStudioDirection(current, direction.id as DesignStudioDirectionId))}
                >
                  <span style={{ background: direction.palette.accent }} />
                </button>
                <div>
                  <strong>{direction.label}</strong>
                  <span>{direction.description}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="ds-status-line" aria-live="polite">
            <Icon name="save" size={13} />
            <span>{status}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

function DesignStudioApprovalCompositionSample({
  composition,
  direction,
  state,
}: {
  composition: DesignStudioApprovalComposition;
  direction: (typeof DESIGN_STUDIO_DIRECTIONS)[number];
  state: DesignStudioState;
}) {
  return (
    <section
      className="ds-approval-composition"
      aria-label="Design Studio approval composition sample"
      style={{
        '--ds-sample-canvas': direction.palette.canvas,
        '--ds-sample-surface': direction.palette.surface,
        '--ds-sample-raised': direction.palette.surfaceRaised,
        '--ds-sample-text': direction.palette.text,
        '--ds-sample-muted': direction.palette.muted,
        '--ds-sample-accent': direction.palette.accent,
        '--ds-sample-border': direction.palette.border,
        '--ds-sample-radius': `${state.radius}px`,
      } as CSSProperties}
    >
      <div className="ds-composition-copy">
        <span>Aggregate sample</span>
        <strong>{composition.title}</strong>
        <small>{composition.description}</small>
      </div>
      <div className="ds-composition-frame" aria-hidden="true">
        <div className="ds-composition-rail">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="ds-composition-canvas">
          <div className="ds-composition-topline">
            <b />
            <i />
          </div>
          <div className="ds-composition-message ds-composition-message--user" />
          <div className="ds-composition-message ds-composition-message--agent" />
          <div className="ds-composition-tool" />
          <div className="ds-composition-input" />
        </div>
        <div className="ds-composition-inspector">
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="ds-composition-region-list">
        {composition.regions.map((region) => (
          <span key={region.id}>
            <strong>{region.label}</strong>
            <small>{region.sampleTokens.join(' / ')}</small>
          </span>
        ))}
      </div>
    </section>
  );
}

function DesignStudioTokenVisualSample({
  direction,
  item,
  radius,
}: {
  direction: (typeof DESIGN_STUDIO_DIRECTIONS)[number];
  item: DesignStudioTokenReviewItem;
  radius: number;
}) {
  const style = {
    '--ds-sample-canvas': direction.palette.canvas,
    '--ds-sample-surface': direction.palette.surface,
    '--ds-sample-raised': direction.palette.surfaceRaised,
    '--ds-sample-text': direction.palette.text,
    '--ds-sample-muted': direction.palette.muted,
    '--ds-sample-accent': direction.palette.accent,
    '--ds-sample-border': direction.palette.border,
    '--ds-sample-radius': `${radius}px`,
    '--ds-sample-display': direction.typography.display,
    '--ds-sample-ui': direction.typography.ui,
    '--ds-sample-mono': direction.typography.mono,
  } as CSSProperties;

  return (
    <div
      className={`ds-token-visual ds-token-visual--${item.sample.kind}`}
      aria-label={`${item.label} visual sample`}
      style={style}
    >
      <span>{item.sample.visualLabel}</span>
      {item.sample.kind === 'palette' ? (
        <div className="ds-visual-palette">
          {[
            direction.palette.canvas,
            direction.palette.surface,
            direction.palette.surfaceRaised,
            direction.palette.text,
            direction.palette.muted,
            direction.palette.accent,
          ].map((value) => <i key={value} style={{ background: value }} />)}
        </div>
      ) : item.sample.kind === 'spacing' ? (
        <div className="ds-visual-spacing">
          <i />
          <i />
          <i />
        </div>
      ) : item.sample.kind === 'radius' ? (
        <div className="ds-visual-radius">
          <i />
          <i />
          <i />
        </div>
      ) : item.sample.kind === 'component' ? (
        <div className="ds-visual-component">
          <button type="button" aria-label={`${item.label} sample primary action`} tabIndex={-1}>
            <Icon name="sparkles" size={12} />
          </button>
          <button type="button" aria-label={`${item.label} sample approval action`} tabIndex={-1}>
            <Icon name="save" size={12} />
          </button>
          <small>Run</small>
        </div>
      ) : item.sample.kind === 'brand' ? (
        <div className="ds-visual-brand">
          <Icon name="slidersHorizontal" size={16} />
          <strong>{direction.label}</strong>
          <small>Use system</small>
        </div>
      ) : (
        <div className="ds-visual-type">
          <strong>Aa</strong>
          <small>{direction.typography.ui}</small>
          <code>const token = value;</code>
        </div>
      )}
    </div>
  );
}

function ExtensionFeaturePane({
  extension,
  workspaceName,
  workspaceFiles,
  artifacts,
  artifactCount,
  onWorkspaceFilesChange,
  onProjectArtifactSave,
}: {
  extension: DefaultExtensionDescriptor;
  workspaceName: string;
  workspaceFiles: WorkspaceFile[];
  artifacts: AgentArtifact[];
  artifactCount: number;
  onWorkspaceFilesChange: (files: WorkspaceFile[]) => void;
  onProjectArtifactSave: (input: DesignStudioProjectArtifactInput, existingArtifactId?: string | null) => AgentArtifact;
}) {
  if (extension.manifest.id === 'agent-harness.ext.design-studio') {
    return (
      <DesignStudioPane
        workspaceName={workspaceName}
        artifacts={artifacts}
        onProjectArtifactSave={onProjectArtifactSave}
      />
    );
  }
  if (extension.manifest.id === 'agent-harness.ext.workflow-canvas') {
    return (
      <section className="extension-feature-pane extension-feature-pane--workflow-canvas" role="region" aria-label={`${extension.manifest.name} feature pane`}>
        <WorkflowCanvasRenderer
          workspaceName={workspaceName}
          workspaceFiles={workspaceFiles}
          onWorkspaceFilesChange={onWorkspaceFilesChange}
        />
      </section>
    );
  }

  const contributionRows = getExtensionContributionRows(extension);
  const resourceRows = getExtensionResourceRows(extension);
  const category = getExtensionMarketplaceCategory(extension);

  return (
    <section className="extension-feature-pane" role="region" aria-label={`${extension.manifest.name} feature pane`}>
      <header className="extension-feature-header">
        <div className="extension-feature-icon">
          <Icon name={getDefaultExtensionIcon(extension)} size={32} />
        </div>
        <div>
          <span className="panel-eyebrow">{EXTENSION_MARKETPLACE_CATEGORY_LABELS[category]}</span>
          <h2>{getExtensionFeatureTitle(extension)}</h2>
          <p>{getExtensionFeatureSummary(extension)}</p>
        </div>
      </header>

      <div className="extension-feature-grid">
        <article className="extension-feature-section extension-feature-section--wide">
          <span className="panel-eyebrow">Current workspace</span>
          <h3>{workspaceName}</h3>
          <p>{extension.manifest.description}</p>
          <div className="extension-feature-metrics">
            <span>{contributionRows.length} contributions</span>
            <span>{resourceRows.length} resources</span>
            <span>{artifactCount} artifacts</span>
          </div>
        </article>

        <article className="extension-feature-section">
          <span className="panel-eyebrow">Pane contract</span>
          <h3>Manifest contributions</h3>
          <div className="extension-contribution-list">
            {contributionRows.length ? contributionRows.map((row, index) => (
              <span key={`${row.label}:${row.value}:${index}`}>
                <strong>{row.label}</strong>
                <code>{row.value}</code>
              </span>
            )) : <p>No pane contributions declared.</p>}
          </div>
        </article>

        <article className="extension-feature-section">
          <span className="panel-eyebrow">Package index</span>
          <h3>README and assets</h3>
          <div className="extension-resource-list">
            {resourceRows.map((row, index) => (
              <span key={`${row.label}:${row.value}:${index}`}>
                <strong>{row.label}</strong>
                <code>{row.value}</code>
              </span>
            ))}
          </div>
        </article>
      </div>
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
          {providerExtensions.map((extension) => {
            const availability = getDefaultExtensionAvailability(extension);
            return (
              <article
                key={extension.manifest.id}
                className={`provider-card ${availability.state === 'unavailable' ? 'provider-card--unavailable' : ''}`}
              >
                <div className="provider-card-header">
                  <div className="provider-body">
                    <strong>{extension.manifest.name}</strong>
                    <p>{extension.manifest.description}</p>
                    {availability.state === 'unavailable' ? <p className="muted">{availability.reason}</p> : null}
                  </div>
                  <span className="badge">{availability.state === 'unavailable' ? 'Unavailable' : 'Provider'}</span>
                </div>
                {extension.manifest.id === 'agent-harness.ext.local-model-connector' ? (
                  <LocalModelSettings />
                ) : null}
              </article>
            );
          })}
        </div>
      </SettingsSection>
    </section>
  );
}

function WorkspaceSwitcherOverlay({
  workspaces,
  activeWorkspaceId,
  workspaceFilesByWorkspace,
  onSwitch,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onClose,
}: {
  workspaces: TreeNode[];
  activeWorkspaceId: string;
  workspaceFilesByWorkspace: Record<string, WorkspaceFile[]>;
  onSwitch: (workspaceId: string) => void;
  onCreateWorkspace: () => void;
  onRenameWorkspace: (workspaceId: string) => void;
  onDeleteWorkspace?: (workspaceId: string) => void;
  onClose: () => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const projectSummaries = listProjectSummaries(
    { id: 'root', name: 'Root', type: 'root', children: workspaces },
    activeWorkspaceId,
    workspaceFilesByWorkspace,
  );

  const filteredProjects = projectSummaries.filter((project) => {
    if (!query.trim()) return true;
    const normalized = query.trim().toLowerCase();
    const pages = project.previewItems.map((name) => name.toLowerCase()).join(' ');
    return project.name.toLowerCase().includes(normalized) || pages.includes(normalized);
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
    <div className="ws-overlay-backdrop" role="dialog" aria-modal="true" aria-label="Project switcher" onClick={onClose}>
      <div className="modal-card workspace-switcher-card ws-overlay-content" onClick={(e) => e.stopPropagation()}>
        <div className="workspace-switcher-header">
          <div className="workspace-switcher-heading">
            <span className="panel-eyebrow">Project switcher</span>
            <div className="workspace-switcher-title-row">
              <h2>Projects</h2>
              <span className="badge">{projectSummaries.length} projects</span>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close project switcher"><Icon name="x" /></button>
        </div>
        <div className="workspace-switcher-body">
          <label className="workspace-switcher-search shared-input-shell">
            <Icon name="search" size={13} color="#71717a" />
            <input aria-label="Search projects" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a project..." autoFocus />
          </label>
          <div className="workspace-switcher-list">
          {filteredProjects.map((project) => {
            const isActive = project.isActive;
            const isHovered = project.id === hoveredId;
            const color = project.color;
            const previewLabel = project.previewItems.length ? project.previewItems.join(' · ') : 'No pages yet';

            return (
              <div
                key={project.id}
                className={`workspace-card workspace-card-row ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredId(project.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <button
                  type="button"
                  className="workspace-card-button"
                  onClick={() => handleSwitch(project.id)}
                >
                  <span className="workspace-swatch" style={{ background: `${color}1c`, borderColor: `${color}55` }}>
                    <span className="workspace-swatch-dot" style={{ background: color }} />
                  </span>
                  <div className="workspace-card-main">
                    <div className="workspace-card-title-row">
                      <span className="workspace-hotkey-chip">{projectSummaries.findIndex((candidate) => candidate.id === project.id) + 1}</span>
                      <strong className="ws-card-name" onDoubleClick={(event) => { event.stopPropagation(); onRenameWorkspace(project.id); }}>{project.name}</strong>
                      {isActive ? <span className="badge connected">Active</span> : null}
                    </div>
                    <span className="ws-card-tab-count">{project.sessionCount} session{project.sessionCount === 1 ? '' : 's'} · {project.browserPageCount} pages · {project.memoryMB.toLocaleString()} MB</span>
                    <span className="ws-card-tabs">{previewLabel}</span>
                  </div>
                </button>
                {isHovered && !isActive && workspaces.length > 1 && onDeleteWorkspace && (
                  <button
                    type="button"
                    className="workspace-card-delete"
                    onClick={(e) => { e.stopPropagation(); onDeleteWorkspace(project.id); }}
                    aria-label={`Delete project ${project.name}`}
                  >
                    <Icon name="x" size={10} color="rgba(255,255,255,.5)" />
                  </button>
                )}
              </div>
            );
          })}
          {!filteredProjects.length ? <div className="workspace-empty-state-row">No projects match this query.</div> : null}
          <div className="workspace-card workspace-card-row ws-card-new">
            <button type="button" className="workspace-card-button" onClick={handleCreate}>
              <span className="workspace-swatch workspace-swatch-new">
                <Icon name="plus" size={14} color="rgba(255,255,255,.65)" />
              </span>
              <div className="workspace-card-main">
                <div className="workspace-card-title-row">
                  <strong className="ws-card-name">New project</strong>
                </div>
                <span className="ws-card-tab-count">Session 1 ready</span>
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
            <span>Ctrl+Alt+N new project</span>
            <span>Double-click project rename</span>
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
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Rename project" onClick={onClose}>
      <div className="modal-card compact" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="panel-eyebrow">Project</span>
            <h2>Rename project</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close rename project"><Icon name="x" /></button>
        </div>
        <div className="add-file-form">
          <label className="file-editor-field">
            <span>Name</span>
            <input aria-label="Project name" value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSave(); }} />
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

function canApplyGeneratedSessionTitle(node: TreeNode): boolean {
  if (node.sessionTitleLocked) return false;
  if (node.sessionTitleGenerated) return true;
  return /^Session \d+$/i.test(node.name)
    || /^SYM-\d+$/i.test(node.name)
    || /^Branch:/i.test(node.name)
    || /^Branch active chat thread$/i.test(node.name)
    || /^Active chat thread$/i.test(node.name);
}

function hasWorkspaceSectionContextMenu(node: TreeNode) {
  return node.type === 'folder' && (
    node.nodeKind === 'browser'
    || node.nodeKind === 'session'
    || node.nodeKind === 'artifact'
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
      '# Pre-tool hook compatible with agent, OpenAI Codex, GitHub Copilot',
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
          <div key={node.id} role="treeitem" aria-selected={isSelected || isCursor} aria-expanded={isFolder ? Boolean(node.expanded) : undefined} aria-level={depth + 1} data-tree-node-id={node.id} className={`tree-row ${isWorkspace ? 'ws-node' : ''} ${isActiveWs ? 'ws-active' : ''} ${isCursor ? 'cursor' : ''} ${openTabIds.includes(node.id) || activeSessionIds.includes(node.id) ? 'active' : ''} ${isEditingFile || isActiveArtifact ? 'active' : ''} ${isSelected ? 'selected' : ''} ${isFile ? 'file-node' : ''} ${node.isReference ? 'tree-row-reference' : ''}`} style={{ paddingLeft: `${depth * 16}px` }}
            onContextMenu={hasContextMenu ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onNodeContextMenu(e.clientX, e.clientY, node);
            } : undefined}
          >
            <button type="button" tabIndex={isCursor ? 0 : -1} className="tree-button" aria-expanded={isFolder ? Boolean(node.expanded) : undefined} style={tabOpacity !== undefined ? { opacity: tabOpacity } : undefined} onFocus={() => onCursorChange(node.id)} onClick={(event) => isFile ? onOpenFile(node.id) : isFolder ? onToggleFolder(node.id) : onOpenTab(node.id, event.ctrlKey || event.metaKey)}>
              {isFile ? (
                <><span className="tree-chevron-spacer" /><Icon name={node.isReference ? 'link' : 'file'} size={12} color={node.isReference ? '#fbbf24' : '#a5b4fc'} /></>
              ) : isFolder ? (
                <>
                  <span className={`tree-chevron ${node.expanded ? 'tree-chevron-expanded' : ''}`}><Icon name="chevronRight" size={11} color="rgba(255,255,255,.25)" /></span>
                  {isWorkspace && node.activeMemory ? <ActiveMemoryPulse /> : null}
                  {isWorkspace && node.persisted ? <span className="persist-badge" title="Persisted" aria-label="Persisted workspace">📌</span> : null}
                  {node.nodeKind === 'dashboard' ? <Icon name="panes" size={12} color="#67e8f9" /> : null}
                  {node.nodeKind === 'browser' ? <Icon name="globe" size={12} color="#93c5fd" /> : null}
                  {node.nodeKind === 'session' ? <Icon name="terminal" size={12} color="#86efac" /> : null}
                  {node.nodeKind === 'artifact' ? <Icon name="layers" size={12} color="#a5b4fc" /> : null}
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
                  ) : node.nodeKind === 'dashboard' ? (
                    <Icon name="panes" size={13} color="#67e8f9" />
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
  if (panel.type === 'widget-editor') return `widget-editor:${panel.workspaceId}:${panel.widgetId}`;
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

const VALID_SIDEBAR_PANELS: SidebarPanel[] = ['workspaces', 'symphony', 'wiki', 'history', 'extensions', 'models', 'settings', 'account'];
const LEGACY_SYMPHONY_PANEL_IDS = new Set(['review', 'multitask']);

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

const VALID_AGENT_PROVIDERS: AgentProvider[] = ['codi', 'ghcp', 'cursor', 'codex', 'researcher', 'debugger', 'planner', 'context-manager', 'security', 'steering', 'adversary', 'media', 'swarm', 'tour-guide'];

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

function buildMultitaskSessionMessagesById(
  durableMessagesBySession: Record<string, ChatMessage[]>,
  runtimeSessions: Record<string, SessionMcpRuntimeState>,
): Record<string, MultitaskSessionTranscriptMessage[]> {
  const sessionMessagesById: Record<string, MultitaskSessionTranscriptMessage[]> = Object.fromEntries(
    Object.entries(durableMessagesBySession).map(([sessionId, messages]) => [
      sessionId,
      messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        streamedContent: message.streamedContent,
        status: message.status,
        isError: message.isError,
      })),
    ]),
  );
  for (const [sessionId, runtime] of Object.entries(runtimeSessions)) {
    sessionMessagesById[sessionId] = runtime.messages.map((message, index) => ({
      id: `${sessionId}:${index}`,
      role: message.role,
      content: message.content,
      status: message.status ?? undefined,
    }));
  }
  return sessionMessagesById;
}

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
  const [repoWikiView, setRepoWikiView] = useState<RepoWikiView>('pages');
  const [repoWikiSelectedPageId, setRepoWikiSelectedPageId] = useState<string | null>(null);
  const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null);
  const [activeExtensionFeatureId, setActiveExtensionFeatureId] = useState<string | null>(null);
  useEffect(() => {
    if (!sessionStorageBackend) return;
    const rawActivePanel = sessionStorageBackend.getItem(STORAGE_KEYS.activePanel);
    if (!rawActivePanel) return;
    try {
      const parsedActivePanel = JSON.parse(rawActivePanel) as unknown;
      if (typeof parsedActivePanel === 'string' && LEGACY_SYMPHONY_PANEL_IDS.has(parsedActivePanel)) {
        setActivePanel('symphony');
      }
    } catch {
      // Invalid persisted panel values fall back through useStoredState.
    }
  }, [setActivePanel]);
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
    [...DEFAULT_INSTALLED_DEFAULT_EXTENSION_IDS],
  );
  const [defaultExtensionOpenFeatureFlags, setDefaultExtensionOpenFeatureFlags] = useStoredState<DefaultExtensionOpenFeatureFlags>(
    localStorageBackend,
    STORAGE_KEYS.defaultExtensionOpenFeatureFlags,
    isBooleanRecord,
    {},
  );
  const [defaultExtensionConfigurationById, setDefaultExtensionConfigurationById] = useStoredState<Record<string, unknown>>(
    localStorageBackend,
    STORAGE_KEYS.defaultExtensionConfigurationById,
    isJsonRecord,
    {},
  );
  useEffect(() => {
    setInstalledDefaultExtensionIds((current) => {
      const normalized = normalizeDefaultExtensionIds(current);
      const requiredIds = normalizeDefaultExtensionIds(DEFAULT_INSTALLED_DEFAULT_EXTENSION_IDS);
      if (requiredIds.every((extensionId) => normalized.includes(extensionId))) return current;
      return [
        ...requiredIds,
        ...normalized.filter((extensionId) => !requiredIds.includes(extensionId)),
      ];
    });
  }, [setInstalledDefaultExtensionIds]);
  const [repoWikiSnapshotsByWorkspace, setRepoWikiSnapshotsByWorkspace] = useStoredState<Record<string, RepoWikiSnapshot>>(
    localStorageBackend,
    STORAGE_KEYS.repoWikiSnapshotsByWorkspace,
    isRepoWikiSnapshotsByWorkspace,
    {},
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
  const [adversaryAgentSettings, setAdversaryAgentSettings] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.adversaryAgentSettings,
    isAdversaryAgentSettings,
    DEFAULT_ADVERSARY_AGENT_SETTINGS,
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
  const [runCheckpointState, setRunCheckpointState] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.runCheckpointState,
    isRunCheckpointState,
    DEFAULT_RUN_CHECKPOINT_STATE,
  );
  const [sessionChapterState, setSessionChapterState] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.sessionChapterState,
    isChapteredSessionState,
    DEFAULT_SESSION_CHAPTER_STATE,
  );
  const [workspaceActionHistoryState, setWorkspaceActionHistoryState] = useStoredState<WorkspaceActionHistoryState>(
    localStorageBackend,
    STORAGE_KEYS.workspaceActionHistoryState,
    isWorkspaceActionHistoryState,
    DEFAULT_WORKSPACE_ACTION_HISTORY_STATE,
  );
  const [workspaceFileCrdtHistoriesByWorkspace, setWorkspaceFileCrdtHistoriesByWorkspace] = useStoredState<WorkspaceFileCrdtHistoriesByWorkspace>(
    localStorageBackend,
    STORAGE_KEYS.workspaceFileCrdtHistoriesByWorkspace,
    isWorkspaceFileCrdtHistoriesByWorkspace,
    {},
  );
  const [workspaceSkillPolicyState, setWorkspaceSkillPolicyState] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.workspaceSkillPolicyState,
    isWorkspaceSkillPolicyState,
    DEFAULT_WORKSPACE_SKILL_POLICY_STATE,
  );
  const [sharedAgentRegistryState, setSharedAgentRegistryState] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.sharedAgentRegistryState,
    isSharedAgentRegistryState,
    DEFAULT_SHARED_AGENT_REGISTRY_STATE,
  );
  const [browserAgentRunSdkState] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.browserAgentRunSdkState,
    isBrowserAgentRunSdkState,
    DEFAULT_BROWSER_AGENT_RUN_SDK_STATE,
  );
  const [multitaskSubagentState, setMultitaskSubagentState] = useStoredState<MultitaskSubagentState>(
    localStorageBackend,
    STORAGE_KEYS.multitaskSubagentState,
    isMultitaskSubagentState,
    DEFAULT_MULTITASK_SUBAGENT_STATE,
  );
  const [symphonyAutopilotSettings, setSymphonyAutopilotSettings] = useStoredState<SymphonyAutopilotSettings>(
    localStorageBackend,
    STORAGE_KEYS.symphonyAutopilotSettings,
    isSymphonyAutopilotSettings,
    DEFAULT_SYMPHONY_AUTOPILOT_SETTINGS,
  );
  const [conversationBranchingState, setConversationBranchingState] = useStoredState<ConversationBranchingState>(
    localStorageBackend,
    STORAGE_KEYS.conversationBranchingState,
    isConversationBranchingState,
    DEFAULT_CONVERSATION_BRANCHING_STATE,
  );
  const [partnerAgentControlPlaneSettings, setPartnerAgentControlPlaneSettings] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.partnerAgentControlPlaneSettings,
    isPartnerAgentControlPlaneSettings,
    DEFAULT_PARTNER_AGENT_CONTROL_PLANE_SETTINGS,
  );
  const [runtimePluginSettings, setRuntimePluginSettings] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.runtimePluginSettings,
    isRuntimePluginSettings,
    DEFAULT_RUNTIME_PLUGIN_SETTINGS,
  );
  const [harnessEvolutionSettings, setHarnessEvolutionSettings] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.harnessEvolutionSettings,
    isHarnessEvolutionSettings,
    DEFAULT_HARNESS_EVOLUTION_SETTINGS,
  );
  const [persistentMemoryGraphState, setPersistentMemoryGraphState] = useStoredState<PersistentMemoryGraphState>(
    localStorageBackend,
    STORAGE_KEYS.persistentMemoryGraphState,
    isPersistentMemoryGraphState,
    createPersistentMemoryGraphState(),
  );
  const [specDrivenDevelopmentSettings, setSpecDrivenDevelopmentSettings] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.specDrivenDevelopmentSettings,
    isSpecDrivenDevelopmentSettings,
    DEFAULT_SPEC_DRIVEN_DEVELOPMENT_SETTINGS,
  );
  const [graphKnowledgeState, setGraphKnowledgeState] = useStoredState<GraphKnowledgeState>(
    localStorageBackend,
    STORAGE_KEYS.graphKnowledgeState,
    isGraphKnowledgeState,
    loadSampleGraphKnowledge('2026-05-08T00:00:00.000Z'),
  );
  const [harnessSteeringState, setHarnessSteeringState] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.harnessSteeringState,
    isHarnessSteeringState,
    DEFAULT_HARNESS_STEERING_STATE,
  );
  const [latestPartnerAgentAuditEntry, setLatestPartnerAgentAuditEntry] = useState<PartnerAgentAuditEntry | null>(null);
  const [browserLocationContext, setBrowserLocationContext] = useStoredState(
    localStorageBackend,
    STORAGE_KEYS.locationContext,
    isBrowserLocationContext,
    DEFAULT_BROWSER_LOCATION_CONTEXT,
  );
  const [aiPointerState, setAiPointerState] = useStoredState<AiPointerFeatureState>(
    localStorageBackend,
    STORAGE_KEYS.aiPointerState,
    isAiPointerFeatureState,
    { settings: DEFAULT_AI_POINTER_SETTINGS, lastTarget: null },
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
  const workspaceSkillPolicyInventory = useMemo(
    () => buildWorkspaceSkillPolicyInventory(workspaceSkillPolicyState),
    [workspaceSkillPolicyState],
  );
  const sharedAgentCatalog = useMemo(
    () => buildSharedAgentCatalog(sharedAgentRegistryState),
    [sharedAgentRegistryState],
  );
  const harnessSteeringInventory = useMemo(
    () => buildHarnessSteeringInventory(harnessSteeringState),
    [harnessSteeringState],
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
  const settingsRuntimePluginRuntime = useMemo(
    () => buildRuntimePluginRuntime({
      settings: runtimePluginSettings,
      manifests: DEFAULT_RUNTIME_PLUGIN_MANIFESTS,
      selectedToolIds: [],
    }),
    [runtimePluginSettings],
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
  const [pendingAiPointerPrompt, setPendingAiPointerPrompt] = useState<string | null>(null);
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
  const [workspaceSurfacesByWorkspace] = useStoredState<Record<string, WorkspaceSurface[]>>(
    localStorageBackend,
    STORAGE_KEYS.workspaceSurfacesByWorkspace,
    isWorkspaceSurfacesByWorkspace,
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
  const [harnessCoreState, setHarnessCoreState] = useState<HarnessCoreState>(() => createHarnessCoreState());
  const [pendingReviewFollowUpRetryTick, setPendingReviewFollowUpRetryTick] = useState(0);
  const handleSessionRuntimeChange = useCallback((sessionId: string, runtime: SessionMcpRuntimeState | null) => {
    setHarnessCoreState((current) => reduceHarnessCoreEvent(
      current,
      runtime
        ? { type: 'session-runtime-updated', sessionId, runtime }
        : { type: 'session-runtime-removed', sessionId },
    ));
  }, []);

  const activeWorkspace = getWorkspace(root, activeWorkspaceId) ?? root;
  const [pendingSymphonyDispatches, setPendingSymphonyDispatches] = useState<MultitaskBranchDispatch[]>([]);
  const queuedSymphonyBranchDispatchKeysRef = useRef<Set<string>>(new Set());
  const settingsHarnessEvolutionPlan = useMemo(() => buildHarnessEvolutionPlan({
    settings: harnessEvolutionSettings,
    request: {
      componentId: 'Agent Browser harness',
      changeSummary: `Evolve ${activeWorkspace.name} harness components safely`,
      touchesStyling: true,
    },
  }), [activeWorkspace.name, harnessEvolutionSettings]);
  const activeMultitaskSubagentState = useMemo(
    () => multitaskSubagentState.enabled && multitaskSubagentState.workspaceId === activeWorkspaceId
      ? multitaskSubagentState
      : {
        ...DEFAULT_MULTITASK_SUBAGENT_STATE,
        workspaceId: activeWorkspaceId,
        workspaceName: activeWorkspace.name,
      },
    [activeWorkspace.name, activeWorkspaceId, multitaskSubagentState],
  );
  const hasRunningSymphonyTasks = activeMultitaskSubagentState.branches.some((branch) => branch.status === 'running');
  const [symphonyRuntimeNowMs, setSymphonyRuntimeNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (activePanel !== 'symphony' || !hasRunningSymphonyTasks) return undefined;
    setSymphonyRuntimeNowMs(Date.now());
    const timer = window.setInterval(() => setSymphonyRuntimeNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [activePanel, hasRunningSymphonyTasks]);
  const startMultitaskSubagents = useCallback((request: string, options?: { openPanel?: boolean }) => {
    setMultitaskSubagentState(createMultitaskSubagentState({
      workspaceId: activeWorkspaceId,
      workspaceName: activeWorkspace.name,
      request,
    }));
    if (options?.openPanel !== false) {
      setActivePanel('symphony');
    }
  }, [activeWorkspace.name, activeWorkspaceId, setActivePanel, setMultitaskSubagentState]);
  const promoteActiveMultitaskBranch = useCallback((branchId: string, actor: MultitaskApprovalActor = 'user') => {
    setMultitaskSubagentState((current) => {
      const source = current.enabled && current.workspaceId === activeWorkspaceId
        ? current
        : activeMultitaskSubagentState;
      return promoteMultitaskBranch(source, branchId, actor);
    });
  }, [activeMultitaskSubagentState, activeWorkspaceId, setMultitaskSubagentState]);
  const manageActiveMultitaskBranch = useCallback((branchId: string, action: MultitaskBranchLifecycleAction) => {
    const dispatches: MultitaskBranchDispatch[] = [];
    setMultitaskSubagentState((current) => {
      const source = current.enabled && current.workspaceId === activeWorkspaceId
        ? current
        : activeMultitaskSubagentState;
      const next = action === 'retry'
        ? reduceMultitaskBranchLifecycle(reduceMultitaskBranchLifecycle(source, branchId, 'retry'), branchId, 'start')
        : reduceMultitaskBranchLifecycle(source, branchId, action);
      if (action === 'start' || action === 'retry') {
        const branchIndex = next.branches.findIndex((branch) => branch.id === branchId);
        const branch = branchIndex >= 0 ? next.branches[branchIndex] : null;
        if (branch?.status === 'running') {
          dispatches.push(buildMultitaskBranchDispatch(next, branch, branchIndex, action === 'retry' ? 'self-heal' : 'manual'));
        }
      }
      return next;
    });
    if (dispatches.length > 0) {
      setPendingSymphonyDispatches((current) => [...current, ...dispatches]);
    }
  }, [activeMultitaskSubagentState, activeWorkspaceId, setMultitaskSubagentState, setPendingSymphonyDispatches]);
  const createActiveMultitaskProject = useCallback((name: string) => {
    setMultitaskSubagentState((current) => {
      const source = current.enabled && current.workspaceId === activeWorkspaceId
        ? current
        : activeMultitaskSubagentState;
      return createMultitaskProject(source, name);
    });
  }, [activeMultitaskSubagentState, activeWorkspaceId, setMultitaskSubagentState]);
  const createActiveMultitaskTask = useCallback((title: string, projectId: string | null) => {
    const withTask = addMultitaskTask(activeMultitaskSubagentState, { title, projectId });
    if (withTask !== activeMultitaskSubagentState) {
      const reconciliation = reconcileMultitaskSubagentRuns(withTask);
      setMultitaskSubagentState(reconciliation.state);
    }
  }, [
    activeMultitaskSubagentState,
    setMultitaskSubagentState,
  ]);
  const selectActiveMultitaskProject = useCallback((projectId: string) => {
    setMultitaskSubagentState((current) => {
      const source = current.enabled && current.workspaceId === activeWorkspaceId
        ? current
        : activeMultitaskSubagentState;
      return selectMultitaskProject(source, projectId);
    });
  }, [activeMultitaskSubagentState, activeWorkspaceId, setMultitaskSubagentState]);
  const selectActiveMultitaskTask = useCallback((branchId: string) => {
    setMultitaskSubagentState((current) => {
      const source = current.enabled && current.workspaceId === activeWorkspaceId
        ? current
        : activeMultitaskSubagentState;
      return selectMultitaskTask(source, branchId);
    });
  }, [activeMultitaskSubagentState, activeWorkspaceId, setMultitaskSubagentState]);
  const activeConversationBranchingState = useMemo(
    () => conversationBranchingState.enabled && conversationBranchingState.workspaceId === activeWorkspaceId
      ? conversationBranchingState
      : DEFAULT_CONVERSATION_BRANCHING_STATE,
    [activeWorkspaceId, conversationBranchingState],
  );
  const recordConversationSubthreadSteering = useCallback((subthreadId: string, sessionId: string, text: string, messageIds: string[]) => {
    setConversationBranchingState((current) => {
      if (!current.enabled || current.workspaceId !== activeWorkspaceId) return current;
      return commitConversationSubthread(current, subthreadId, {
        sourceSessionId: sessionId,
        messageIds,
        summary: `Steering update: ${text.trim().replace(/\s+/g, ' ')}`,
      });
    });
  }, [activeWorkspaceId, setConversationBranchingState]);
  const updateConversationBranchSettings = useCallback((settings: ConversationBranchSettings) => {
    setConversationBranchingState((current) => ({
      ...current,
      enabled: settings.enabled,
      settings,
      updatedAt: new Date().toISOString(),
    }));
  }, [setConversationBranchingState]);
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
      ? (listWorkspaceSessionNodes(activeWorkspace)
          .map((child) => ({
            id: child.id,
            name: child.name,
            isOpen: activeSessionIds.includes(child.id),
          })))
      : [],
    [activeSessionIds, activeWorkspace],
  );
  const activePrReviewReport = useMemo(
    () => {
      if (!activeMultitaskSubagentState.enabled || activeMultitaskSubagentState.branches.length === 0) {
        return buildPullRequestReview({
          title: 'No active Symphony task',
          author: 'agent-browser',
          summary: `${activeWorkspace.name} has no active Symphony task.`,
          changedFiles: [],
          validations: [],
          browserEvidence: [],
          reviewerComments: [],
        });
      }
      return buildPullRequestReview({
        title: `${activeWorkspace.name} Symphony task review`,
        author: 'agent-browser',
        summary: activeMultitaskSubagentState.request || `Review isolated Symphony branches for ${activeWorkspace.name}.`,
        changedFiles: [...new Set(activeMultitaskSubagentState.branches.flatMap((branch) => branch.changedFiles))],
        validations: [],
        browserEvidence: [],
        reviewerComments: [],
      });
    },
    [activeMultitaskSubagentState, activeWorkspace.name],
  );
  const activeSymphonySnapshot = useMemo(
    () => createSymphonyRuntimeSnapshot({
      state: activeMultitaskSubagentState,
      report: activePrReviewReport,
      autopilotSettings: symphonyAutopilotSettings,
      now: new Date(symphonyRuntimeNowMs),
    }),
    [activeMultitaskSubagentState, activePrReviewReport, symphonyAutopilotSettings, symphonyRuntimeNowMs],
  );
  useEffect(() => {
    if (!activeMultitaskSubagentState.enabled) return;
    const durableMessagesBySession = localStorageBackend
      ? loadJson<Record<string, ChatMessage[]>>(localStorageBackend, STORAGE_KEYS.chatMessagesBySession, isChatMessagesBySession, {})
      : {};
    const completionReconciled = reconcileMultitaskBranchSessionCompletions(
      activeMultitaskSubagentState,
      buildMultitaskSessionMessagesById(durableMessagesBySession, harnessCoreState.sessions),
      { now: new Date(symphonyRuntimeNowMs) },
    );
    const nextReconciliation = reconcileMultitaskSubagentRuns(completionReconciled, {
      maxConcurrentAgents: activeSymphonySnapshot.orchestrator.maxConcurrentAgents,
      now: new Date(symphonyRuntimeNowMs),
    });
    if (nextReconciliation.state === activeMultitaskSubagentState) return;
    setMultitaskSubagentState((current) => (
      current.enabled && current.workspaceId === activeWorkspaceId
        ? nextReconciliation.state
        : current
    ));
    if (nextReconciliation.dispatches.length > 0) {
      setPendingSymphonyDispatches((current) => [...current, ...nextReconciliation.dispatches]);
    }
  }, [
    activeMultitaskSubagentState,
    activeSymphonySnapshot.orchestrator.maxConcurrentAgents,
    activeWorkspaceId,
    harnessCoreState.sessions,
    localStorageBackend,
    setMultitaskSubagentState,
    setPendingSymphonyDispatches,
    symphonyRuntimeNowMs,
  ]);
  useEffect(() => {
    if (!activeMultitaskSubagentState.enabled) {
      queuedSymphonyBranchDispatchKeysRef.current.clear();
      return;
    }

    const syntheticRunningDispatchKeys = new Set(
      activeMultitaskSubagentState.branches
        .filter((branch) => branch.status === 'running' && branch.sessionId?.startsWith('symphony:'))
        .map((branch) => `${branch.id}:${branch.runAttempt ?? 0}:${branch.sessionId ?? ''}`),
    );
    for (const dispatchKey of queuedSymphonyBranchDispatchKeysRef.current) {
      if (!syntheticRunningDispatchKeys.has(dispatchKey)) {
        queuedSymphonyBranchDispatchKeysRef.current.delete(dispatchKey);
      }
    }

    const dispatches = activeMultitaskSubagentState.branches.flatMap((branch, index) => {
      const dispatchKey = `${branch.id}:${branch.runAttempt ?? 0}:${branch.sessionId ?? ''}`;
      if (!syntheticRunningDispatchKeys.has(dispatchKey) || queuedSymphonyBranchDispatchKeysRef.current.has(dispatchKey)) {
        return [];
      }
      queuedSymphonyBranchDispatchKeysRef.current.add(dispatchKey);
      return [buildMultitaskBranchDispatch(activeMultitaskSubagentState, branch, index)];
    });
    if (dispatches.length > 0) {
      setPendingSymphonyDispatches((current) => [...current, ...dispatches]);
    }
  }, [
    activeMultitaskSubagentState,
    setPendingSymphonyDispatches,
  ]);
  useEffect(() => {
    if (!activeMultitaskSubagentState.enabled || activeWorkspaceSessions.length === 0) return;
    const attachableSession = activeMultitaskSubagentState.branches
      .map((branch) => (branch.status === 'running' && branch.sessionId?.startsWith('symphony:') && branch.sessionName
        ? activeWorkspaceSessions.find((session) => session.name === branch.sessionName) ?? null
        : null))
      .find((session): session is { id: string; name: string; isOpen: boolean } => Boolean(session)) ?? null;
    setMultitaskSubagentState((current) => {
      if (!current.enabled || current.workspaceId !== activeWorkspaceId) return current;
      return current.branches.reduce((next, branch) => {
        if (branch.status !== 'running' || !branch.sessionId?.startsWith('symphony:') || !branch.sessionName) {
          return next;
        }
        const session = activeWorkspaceSessions.find((candidate) => candidate.name === branch.sessionName);
        return session
          ? attachMultitaskBranchSession(next, branch.id, { sessionId: session.id, sessionName: branch.sessionName })
          : next;
      }, current);
    });
    if (attachableSession) {
      setWorkspaceViewStateByWorkspace((current) => {
        const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
        return {
          ...current,
          [activeWorkspaceId]: {
            ...existing,
            activeMode: 'agent',
            activeSessionIds: [attachableSession.id],
            panelOrder: [`session:${attachableSession.id}`],
          },
        };
      });
      if (activePanel !== 'symphony') {
        setActivePanel('workspaces');
        window.setTimeout(() => setActivePanel('workspaces'), 0);
      }
    }
  }, [
    activeWorkspace,
    activePanel,
    activeMultitaskSubagentState.enabled,
    activeWorkspaceId,
    activeWorkspaceSessions,
    setActivePanel,
    setMultitaskSubagentState,
    setWorkspaceViewStateByWorkspace,
  ]);
  useEffect(() => {
    if (!activeMultitaskSubagentState.enabled) return;
    const durableMessagesBySession = localStorageBackend
      ? loadJson<Record<string, ChatMessage[]>>(localStorageBackend, STORAGE_KEYS.chatMessagesBySession, isChatMessagesBySession, {})
      : {};
    const sessionMessagesById = buildMultitaskSessionMessagesById(durableMessagesBySession, harnessCoreState.sessions);
    setMultitaskSubagentState((current) => {
      if (!current.enabled || current.workspaceId !== activeWorkspaceId) return current;
      return reconcileMultitaskBranchSessionCompletions(current, sessionMessagesById);
    });
  }, [
    activeMultitaskSubagentState.enabled,
    activeWorkspaceId,
    harnessCoreState.sessions,
    localStorageBackend,
    setMultitaskSubagentState,
  ]);
  const workspaceActionSnapshot = useMemo<WorkspaceActionSnapshot>(() => {
    const chapterIds = Object.values(sessionChapterState.sessions)
      .filter((session) => session.workspaceId === activeWorkspaceId)
      .flatMap((session) => session.chapters.map((chapter) => chapter.id))
      .sort();
    return {
      workspaceId: activeWorkspaceId,
      workspaceName: activeWorkspace.name,
      activePanel,
      activeSessionIds: [...(activeWorkspaceViewState.activeSessionIds ?? [])].sort(),
      openTabIds: [...(activeWorkspaceViewState.openTabIds ?? [])].sort(),
      mountedSessionFsIds: [...(activeWorkspaceViewState.mountedSessionFsIds ?? [])].sort(),
      sessionIds: activeWorkspaceSessions.map((session) => session.id).sort(),
      sessionNamesById: Object.fromEntries(activeWorkspaceSessions
        .map((session) => [session.id, session.name])
        .sort(([left], [right]) => left.localeCompare(right))),
      conversationBranchIds: activeConversationBranchingState.workspaceId === activeWorkspaceId
        ? activeConversationBranchingState.subthreads.map((subthread) => `${subthread.id}:${subthread.status}:${subthread.headCommitId}`).sort()
        : [],
      checkpointIds: runCheckpointState.checkpoints
        .filter((checkpoint) => checkpoint.workspaceId === activeWorkspaceId)
        .map((checkpoint) => `${checkpoint.id}:${checkpoint.status}`)
        .sort(),
      browserAgentRunIds: browserAgentRunSdkState.runs
        .filter((run) => run.workspaceId === activeWorkspaceId)
        .map((run) => `${run.id}:${run.status}:${run.eventCursor}`)
        .sort(),
      scheduledAutomationIds: scheduledAutomationState.automations
        .map((automation) => `${automation.id}:${automation.enabled ? automation.cadence : 'paused'}:${automation.nextRunAt ?? 'none'}`)
        .sort(),
      chapterIds,
      workspaceFileVersionIds: listWorkspaceFileCrdtHistories(workspaceFileCrdtHistoriesByWorkspace, activeWorkspaceId)
        .filter((history) => history.operations.length > 0)
        .map((history) => `${history.path}:${history.headOpId ?? 'snapshot'}:${history.updatedAt}`)
        .sort(),
      symphonyEventSummaries: buildSymphonyHistoryEventSummaries(activeSymphonySnapshot),
      symphonySessionSummaries: buildSymphonyHistorySessionSummaries(activeSymphonySnapshot),
    };
  }, [
    activeConversationBranchingState,
    activePanel,
    activeSymphonySnapshot,
    activeWorkspace.name,
    activeWorkspaceId,
    activeWorkspaceSessions,
    activeWorkspaceViewState.activeSessionIds,
    activeWorkspaceViewState.mountedSessionFsIds,
    activeWorkspaceViewState.openTabIds,
    browserAgentRunSdkState.runs,
    runCheckpointState.checkpoints,
    scheduledAutomationState.automations,
    sessionChapterState.sessions,
    workspaceFileCrdtHistoriesByWorkspace,
  ]);
  const previousWorkspaceActionSnapshotRef = useRef<WorkspaceActionSnapshot | null>(null);
  useEffect(() => {
    const previous = previousWorkspaceActionSnapshotRef.current;
    previousWorkspaceActionSnapshotRef.current = workspaceActionSnapshot;
    if (!previous) return;
    setWorkspaceActionHistoryState((current) => recordWorkspaceActionTransition(
      current,
      previous,
      workspaceActionSnapshot,
    ));
  }, [setWorkspaceActionHistoryState, workspaceActionSnapshot]);
  const moveActiveWorkspaceActionHistoryCursor = useCallback((direction: WorkspaceActionHistoryDirection) => {
    setWorkspaceActionHistoryState((current) => moveWorkspaceActionHistoryCursor(current, activeWorkspaceId, direction));
  }, [activeWorkspaceId, setWorkspaceActionHistoryState]);
  const [pendingReviewFollowUps, setPendingReviewFollowUps] = useState<Array<{ sessionId: string; prompt: string }>>([]);
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
  const activeWorkspaceFileCrdtHistories = useMemo(
    () => listWorkspaceFileCrdtHistories(workspaceFileCrdtHistoriesByWorkspace, activeWorkspaceId),
    [activeWorkspaceId, workspaceFileCrdtHistoriesByWorkspace],
  );
  const historyMessagesBySession = useMemo(
    () => localStorageBackend
      ? loadJson<Record<string, ChatMessage[]>>(localStorageBackend, STORAGE_KEYS.chatMessagesBySession, isChatMessagesBySession, {})
      : {},
    [activePanel, sessionChapterState.sessions, workspaceActionHistoryState],
  );
  useEffect(() => {
    setWorkspaceFileCrdtHistoriesByWorkspace((current) => recordWorkspaceFileCrdtChanges(
      current,
      activeWorkspaceId,
      activeWorkspaceFiles,
      {
        actorId: 'agent-browser',
      },
    ));
  }, [activeWorkspaceFiles, activeWorkspaceId, setWorkspaceFileCrdtHistoriesByWorkspace]);
  const browserWorkflowSkills = useMemo(
    () => discoverBrowserWorkflowSkills(activeWorkspaceFiles),
    [activeWorkspaceFiles],
  );
  const settingsSpecWorkflowPlan = useMemo(
    () => createSpecWorkflowPlan({
      task: 'Plan feature work',
      settings: specDrivenDevelopmentSettings,
    }),
    [specDrivenDevelopmentSettings],
  );
  const activeArtifacts = artifactsByWorkspace[activeWorkspaceId] ?? EMPTY_AGENT_ARTIFACTS;
  const activeWorkspaceSurfaces = workspaceSurfacesByWorkspace[activeWorkspaceId] ?? [];
  const activeWorkspaceSurfaceSummaries = useMemo(
    () => listWorkspaceSurfaceSummaries(activeWorkspaceSurfaces),
    [activeWorkspaceSurfaces],
  );
  const activeHarnessKnowledgeSummary = useMemo<HarnessKnowledgeSummary>(() => {
    const graphStats = getGraphKnowledgeStats(graphKnowledgeState);
    const metrics = [
      { label: 'graph nodes', value: graphStats.graphNodes, detail: `${graphStats.graphEdges} edges` },
      { label: 'hot memories', value: graphStats.hotMemoryBlocks, detail: `${graphStats.hotMemoryChars} chars` },
      { label: 'sessions', value: activeWorkspaceSessions.length + graphStats.sessionCount, detail: 'open and modeled sessions' },
      { label: 'files', value: activeWorkspaceFiles.length + persistentMemoryGraphState.documents.length, detail: 'workspace and memory docs' },
      { label: 'steering', value: harnessSteeringInventory.totalCorrections, detail: `${harnessSteeringInventory.fileRows.length} files` },
      { label: 'surfaces', value: activeWorkspaceSurfaceSummaries.length, detail: 'agent-authored outputs' },
    ];
    const highlights = [
      graphKnowledgeState.hotMemoryBlocks[0]?.content,
      graphKnowledgeState.communities[0] ? `${graphKnowledgeState.communities[0].name}: ${graphKnowledgeState.communities[0].summary}` : null,
      harnessSteeringInventory.latestCorrection ? `Latest steering: ${harnessSteeringInventory.latestCorrection.text}` : null,
      activeWorkspaceSurfaceSummaries[0] ? `Surface: ${activeWorkspaceSurfaceSummaries[0].title} (${activeWorkspaceSurfaceSummaries[0].permissionSummary})` : null,
      activeWorkspaceFiles[0] ? `File: ${activeWorkspaceFiles[0].path}` : null,
      persistentMemoryGraphState.memories[0] ? `Memory: ${persistentMemoryGraphState.memories[0].summary}` : null,
    ].filter((entry): entry is string => Boolean(entry));
    return { metrics, highlights };
  }, [activeWorkspaceFiles, activeWorkspaceSessions.length, activeWorkspaceSurfaceSummaries, graphKnowledgeState, harnessSteeringInventory, persistentMemoryGraphState]);
  const activeArtifactPanelSelection = activeWorkspaceViewState.activeArtifactPanel ?? null;
  const activeArtifactPanelArtifact = activeArtifactPanelSelection
    ? activeArtifacts.find((artifact) => artifact.id === activeArtifactPanelSelection.artifactId) ?? null
    : null;
  const activeArtifactPanelFile = activeArtifactPanelArtifact
    ? activeArtifactPanelArtifact.files.find((file) => file.path === activeArtifactPanelSelection?.filePath) ?? activeArtifactPanelArtifact.files[0] ?? null
    : null;
  const activeWorkspaceCapabilities = useMemo(() => discoverWorkspaceCapabilities(activeWorkspaceFiles), [activeWorkspaceFiles]);
  const derivedRepoWikiSnapshot = useMemo(
    () => buildRepoWikiSnapshot({
      workspace: activeWorkspace,
      files: activeWorkspaceFiles,
      artifactTitles: activeArtifacts.map((artifact) => artifact.title),
    }),
    [activeArtifacts, activeWorkspace, activeWorkspaceFiles],
  );
  const activeRepoWikiSnapshot = repoWikiSnapshotsByWorkspace[activeWorkspaceId] ?? derivedRepoWikiSnapshot;
  const activeRepoWikiPromptContext = useMemo(
    () => buildRepoWikiPromptContext(activeRepoWikiSnapshot),
    [activeRepoWikiSnapshot],
  );
  const activeRunCheckpointPromptContext = useMemo(
    () => buildCheckpointPromptContext(runCheckpointState, activeWorkspaceId),
    [activeWorkspaceId, runCheckpointState],
  );
  const [defaultExtensionRuntime, setDefaultExtensionRuntime] = useState<DefaultExtensionRuntime | null>(null);
  const enabledDefaultExtensionIds = useMemo(
    () => resolveEnabledDefaultExtensionIds(installedDefaultExtensionIds, defaultExtensionOpenFeatureFlags),
    [defaultExtensionOpenFeatureFlags, installedDefaultExtensionIds],
  );
  const installedDefaultExtensions = useMemo(
    () => getInstalledDefaultExtensionDescriptors(defaultExtensionRuntime, installedDefaultExtensionIds),
    [defaultExtensionRuntime, installedDefaultExtensionIds],
  );
  const enabledDefaultExtensions = useMemo(
    () => getInstalledDefaultExtensionDescriptors(defaultExtensionRuntime, enabledDefaultExtensionIds),
    [defaultExtensionRuntime, enabledDefaultExtensionIds],
  );
  const installedIdeExtensions = useMemo(
    () => enabledDefaultExtensions.filter(isDefaultExtensionActivityFeature),
    [enabledDefaultExtensions],
  );
  const extensionCatalog = defaultExtensionRuntime?.extensions ?? DEFAULT_EXTENSION_MANIFESTS;
  const selectedExtension = selectedExtensionId
    ? extensionCatalog.find((extension) => extension.manifest.id === selectedExtensionId) ?? null
    : null;
  const activeExtensionFeature = activeExtensionFeatureId
    ? installedIdeExtensions.find((extension) => extension.manifest.id === activeExtensionFeatureId) ?? null
    : null;
  const daemonDownload = useResolvedDaemonDownloadChoice();
  const artifactWorktreeExtensionEnabled = enabledDefaultExtensionIds.includes('agent-harness.ext.artifacts-worktree');
  const installDefaultExtension = useCallback((extensionId: string) => {
    const extensionIds = resolveDefaultExtensionDependencyPlan([extensionId]).extensionIds;
    setInstalledDefaultExtensionIds((current) => {
      const existing = new Set(normalizeDefaultExtensionIds(current));
      for (const id of extensionIds) existing.add(id);
      return [...existing];
    });
    setDefaultExtensionOpenFeatureFlags((current) => {
      const next = { ...current };
      for (const id of extensionIds) next[getDefaultExtensionOpenFeatureFlagKey(id)] = true;
      return next;
    });
  }, [setDefaultExtensionOpenFeatureFlags, setInstalledDefaultExtensionIds]);
  const uninstallDefaultExtension = useCallback((extensionId: string) => {
    const extensionIds = normalizeDefaultExtensionIds([extensionId]);
    const dependentIds = resolveDefaultExtensionDependentIds(extensionIds, installedDefaultExtensionIds);
    const removedIds = new Set([...extensionIds, ...dependentIds]);
    setInstalledDefaultExtensionIds((current) => normalizeDefaultExtensionIds(current).filter((id) => !removedIds.has(id)));
    setDefaultExtensionOpenFeatureFlags((current) => {
      const next = { ...current };
      for (const id of removedIds) delete next[getDefaultExtensionOpenFeatureFlagKey(id)];
      return next;
    });
    setDefaultExtensionConfigurationById((current) => {
      const next = { ...current };
      for (const id of removedIds) delete next[id];
      return next;
    });
    setWorkspaceFilesByWorkspace((current) => Object.fromEntries(
      Object.entries(current).map(([workspaceId, files]) => [
        workspaceId,
        removeWorkspaceFilesForExtensions(files, [...removedIds]),
      ]),
    ));
    setActiveExtensionFeatureId((current) => current && removedIds.has(current) ? null : current);
    setSelectedExtensionId((current) => current && removedIds.has(current) ? null : current);
  }, [installedDefaultExtensionIds, setDefaultExtensionConfigurationById, setDefaultExtensionOpenFeatureFlags, setInstalledDefaultExtensionIds]);
  const setDefaultExtensionEnabled = useCallback((extensionId: string, enabled: boolean) => {
    const extensionIds = enabled
      ? resolveDefaultExtensionDependencyPlan([extensionId]).extensionIds
      : [
        ...normalizeDefaultExtensionIds([extensionId]),
        ...resolveDefaultExtensionDependentIds([extensionId], installedDefaultExtensionIds),
      ];
    setDefaultExtensionOpenFeatureFlags((current) => {
      const next = { ...current };
      for (const id of extensionIds) next[getDefaultExtensionOpenFeatureFlagKey(id)] = enabled;
      return next;
    });
  }, [installedDefaultExtensionIds, setDefaultExtensionOpenFeatureFlags]);
  const configureDefaultExtension = useCallback((extension: DefaultExtensionDescriptor) => {
    const current = defaultExtensionConfigurationById[extension.manifest.id] ?? {};
    const raw = window.prompt(`Configure ${extension.manifest.name} as JSON`, JSON.stringify(current, null, 2));
    if (raw === null) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Extension configuration must be a JSON object.');
      }
      setDefaultExtensionConfigurationById((previous) => ({
        ...previous,
        [extension.manifest.id]: parsed,
      }));
      setToast({ msg: `${extension.manifest.name} configuration saved`, type: 'success' });
    } catch (error) {
      setToast({
        msg: error instanceof Error ? error.message : 'Extension configuration must be valid JSON.',
        type: 'error',
      });
    }
  }, [defaultExtensionConfigurationById, setDefaultExtensionConfigurationById, setToast]);
  useEffect(() => {
    let mounted = true;
    void createDefaultExtensionRuntime(activeWorkspaceFiles, {
      installedExtensionIds: enabledDefaultExtensionIds,
      artifacts: activeArtifacts,
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
  }, [activeArtifacts, activeWorkspaceFiles, enabledDefaultExtensionIds]);
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
  useEffect(() => {
    setRoot((current) => {
      let changed = false;
      const nextChildren = (current.children ?? []).map((workspace) => {
        if (workspace.type !== 'workspace') return workspace;
        const spec = harnessSpecsByWorkspace[workspace.id] ?? createDefaultHarnessAppSpec({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
        });
        const nextWorkspace = syncWorkspaceDashboardNodes(workspace, listDashboardWidgets(spec));
        if (JSON.stringify(nextWorkspace.children ?? []) !== JSON.stringify(workspace.children ?? [])) {
          changed = true;
          return nextWorkspace;
        }
        return workspace;
      });
      return changed ? { ...current, children: nextChildren } : current;
    });
  }, [harnessSpecsByWorkspace, setRoot]);
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
  const activeDashboardWidgetId = activeWorkspaceViewState.activeDashboardWidgetId ?? null;
  const activeDashboardWidget = activeDashboardWidgetId ? activeHarnessSpec.elements[activeDashboardWidgetId] ?? null : null;
  const shouldRenderDashboard = activeWorkspace.type === 'workspace';

  const activeRenderPanes = useMemo<WorkspaceMcpRenderPane[]>(() => {
    const panes: WorkspaceMcpRenderPane[] = [];

    if (activeDashboardWidget) {
      panes.push({
        id: `widget-editor:${activeWorkspaceId}:${activeDashboardWidget.id}`,
        paneType: 'dashboard-widget',
        itemId: activeDashboardWidget.id,
        label: readHarnessElementTitle(activeDashboardWidget, activeDashboardWidget.id),
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
        ? `//workspace/artifacts/${activeArtifactPanelArtifact.id}/${activeArtifactPanelFile.path}`
        : `//workspace/artifacts/${activeArtifactPanelArtifact.id}`;
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
    activeDashboardWidget,
    activeArtifactPanelArtifact,
    activeArtifactPanelFile,
    activeWorkspaceSessions,
    activeWorkspaceId,
    activeWorkspaceViewState.panelOrder,
    editingFile,
    openBrowserTabs,
  ]);
  const activeClipboardEntries = useMemo<WorkspaceMcpClipboardEntry[]>(() => clipboardHistory.map((entry, index) => ({
    id: entry.id,
    label: entry.label,
    text: entry.text,
    timestamp: entry.timestamp,
    isActive: index === 0,
  })), [clipboardHistory]);
  const activePanelMeta = SIDEBAR_PANEL_META[activePanel];
  const sidebarPanelMeta = activePanel === 'extensions' && activeExtensionFeature
    ? {
      label: getExtensionFeatureTitle(activeExtensionFeature),
      icon: getDefaultExtensionIcon(activeExtensionFeature),
    }
    : activePanelMeta;
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
        rememberExpandedNodes(getWorkspaceCategory(normalizedWorkspace, 'artifact')?.children);
        rememberExpandedNodes(getWorkspaceCategory(normalizedWorkspace, 'files')?.children);
        const files = workspaceFilesByWorkspace[ws.id] ?? [];
        const extensionNodes = buildInstalledExtensionDriveNodes(`extensions:${ws.id}`, installedDefaultExtensions);
        const fileNodes = buildWorkspaceCapabilityDriveNodes(`file:${ws.id}`, files);
        const artifactNodes = buildArtifactWorktreeNodes(`artifact:${ws.id}`, artifactsByWorkspace[ws.id] ?? []);
        const mountedSessionIds = normalizeWorkspaceViewEntry(normalizedWorkspace, workspaceViewStateByWorkspace[ws.id]).mountedSessionFsIds;
        const terminalFsNodes: TreeNode[] = listWorkspaceSessionNodes(normalizedWorkspace)
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
          ? { ...child, children: restoreExpandedNodes([...extensionNodes, ...fileNodes, ...terminalFsNodes]) }
          : child);
        return syncWorkspaceArtifactNodes(
          { ...normalizedWorkspace, children: nextChildren },
          restoreExpandedNodes(artifactNodes),
          { enabled: artifactWorktreeExtensionEnabled },
        );
      });
      return { ...current, children: updated };
    });
  }, [artifactWorktreeExtensionEnabled, artifactsByWorkspace, installedDefaultExtensions, terminalFsFileContentsBySession, terminalFsPathsBySession, workspaceFilesByWorkspace, workspaceViewStateByWorkspace]);

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
    setSelectedExtensionId(null);
    setActiveExtensionFeatureId(null);
    setSidebarCollapsed(false, true);
    setShowWorkspaces(false);
  }, [setSidebarCollapsed]);

  const openExtensionsMarketplace = useCallback(() => {
    setActivePanel('extensions');
    setSelectedExtensionId(null);
    setActiveExtensionFeatureId(null);
    setSidebarCollapsed(false, true);
    setShowWorkspaces(false);
  }, [setSidebarCollapsed]);

  const openExtensionDetail = useCallback((extensionId: string) => {
    setActivePanel('extensions');
    setSelectedExtensionId(extensionId);
    setActiveExtensionFeatureId(null);
    setSidebarCollapsed(false, true);
    setShowWorkspaces(false);
  }, [setSidebarCollapsed]);

  const openExtensionFeature = useCallback((extensionId: string) => {
    setActivePanel('extensions');
    setSelectedExtensionId(null);
    setActiveExtensionFeatureId(extensionId);
    setSidebarCollapsed(false, true);
    setShowWorkspaces(false);
  }, [setSidebarCollapsed]);

  const openWorkspaceSwitcher = useCallback(() => {
    setActivePanel('workspaces');
    setSelectedExtensionId(null);
    setActiveExtensionFeatureId(null);
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
    const workspaceId = `ws-${createUniqueId()}`;
    const { workspace, viewState } = createProjectWorkspace({
      root,
      id: workspaceId,
      color: nextProjectColor(root),
    });
    setRoot((current) => ({
      ...current,
      children: [
        ...(current.children ?? []),
        workspace,
      ],
    }));
    setWorkspaceViewStateByWorkspace((current) => ({ ...current, [workspaceId]: viewState }));
    setWorkspaceFilesByWorkspace((current) => ({ ...current, [workspaceId]: createDefaultWorkspaceFiles() }));
    setActiveWorkspaceId(workspaceId);
    setToast({ msg: `Created ${workspace.name}`, type: 'success' });
  }, [root, setToast]);

  const saveWorkspaceRename = useCallback(() => {
    const nextName = workspaceDraftName.trim();
    if (!renamingWorkspaceId || !nextName) {
      setRenamingWorkspaceId(null);
      return;
    }
    setRoot((current) => deepUpdate(current, renamingWorkspaceId, (workspace) => ({ ...workspace, name: nextName })));
    setToast({ msg: `Renamed project to ${nextName}`, type: 'success' });
    setRenamingWorkspaceId(null);
  }, [renamingWorkspaceId, setToast, workspaceDraftName]);

  const renameSessionNodeById = useCallback((sessionId: string, nextName: string, showToast = true, options: { lockTitle?: boolean } = {}) => {
    const trimmed = nextName.trim();
    if (!trimmed) {
      return;
    }

    const lockTitle = options.lockTitle ?? true;
    setRoot((current) => deepUpdate(current, sessionId, (node) => ({
      ...node,
      name: trimmed,
      ...(lockTitle ? { sessionTitleLocked: true, sessionTitleGenerated: false } : { sessionTitleGenerated: true }),
    })));
    if (showToast) {
      setToast({ msg: `Renamed to ${trimmed}`, type: 'success' });
    }
  }, [setToast]);

  const applyGeneratedSessionTitle = useCallback((sessionId: string, nextTitle: string) => {
    const trimmed = nextTitle.trim();
    if (!trimmed) return;
    setRoot((current) => deepUpdate(current, sessionId, (node) => {
      if (node.type !== 'tab' || node.nodeKind !== 'session' || !canApplyGeneratedSessionTitle(node) || node.name === trimmed) {
        return node;
      }
      return {
        ...node,
        name: trimmed,
        sessionTitleGenerated: true,
      };
    }));
  }, []);

  const addSessionToWorkspace = useCallback((workspaceId: string, nameOverride?: string, options: { open?: boolean; boundWidgetId?: string; groupId?: string; groupName?: string; titleLocked?: boolean } = {}): { id: string; name: string; isOpen: boolean } | null => {
    const shouldOpen = options.open ?? true;
    const workspace = getWorkspace(root, workspaceId);
    if (!workspace) return null;
    const normalized = ensureWorkspaceCategories(workspace);
    const existingSessions = listWorkspaceSessionNodes(normalized);
    const existingIndexes = existingSessions.map((child) => {
      const match = child.name.match(/^Session (\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const nextIndex = (existingIndexes.length ? Math.max(...existingIndexes) : 0) + 1;
    const newSession = createSessionNode(workspaceId, nextIndex);
    if (typeof nameOverride === 'string' && nameOverride.trim()) {
      newSession.name = nameOverride.trim();
    }
    newSession.sessionTitleGenerated = !options.titleLocked;
    if (options.boundWidgetId) {
      newSession.boundWidgetId = options.boundWidgetId;
    }
    if (options.titleLocked) {
      newSession.sessionTitleLocked = true;
    }
    const createdSession = { id: newSession.id, name: newSession.name, isOpen: shouldOpen };
    setRoot((current) => {
      return deepUpdate(current, workspaceId, (node) => {
        const withSession = groupSessionNodeInWorkspace(node, newSession, {
          groupId: options.groupId,
          groupName: options.groupName,
        });
        return { ...withSession, expanded: true };
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
          activeSessionIds: shouldOpen
            ? [newSession.id]
            : existing.activeSessionIds ?? [],
          panelOrder: shouldOpen
            ? [`session:${newSession.id}`]
            : existing.panelOrder,
          mountedSessionFsIds: !existing.mountedSessionFsIds.includes(newSession.id)
            ? [...existing.mountedSessionFsIds, newSession.id]
            : existing.mountedSessionFsIds,
        },
      };
    });
    setToast({ msg: 'New session created', type: 'success' });
    return createdSession;
  }, [root, setToast, switchWorkspace]);

  const openDashboardWidgetSession = useCallback((widgetId: string) => {
    const widget = activeHarnessSpec.elements[widgetId];
    const widgetTitle = readHarnessElementTitle(widget, widgetId);
    const existingSession = activeWorkspace.type === 'workspace'
      ? (getWorkspaceCategory(activeWorkspace, 'session')?.children ?? [])
        .find((child) => child.type === 'tab' && child.nodeKind === 'session' && child.boundWidgetId === widgetId)
      : null;
    if (existingSession) {
      setWorkspaceViewStateByWorkspace((current) => {
        const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
        return {
          ...current,
          [activeWorkspaceId]: {
            ...existing,
            activeSessionIds: [existingSession.id],
            mountedSessionFsIds: existing.mountedSessionFsIds.includes(existingSession.id)
              ? existing.mountedSessionFsIds
              : [...existing.mountedSessionFsIds, existingSession.id],
            panelOrder: [`session:${existingSession.id}`],
          },
        };
      });
      return;
    }
    addSessionToWorkspace(activeWorkspaceId, `Customize: ${widgetTitle}`, { open: true, boundWidgetId: widgetId });
  }, [activeHarnessSpec.elements, activeWorkspace, activeWorkspaceId, addSessionToWorkspace, setWorkspaceViewStateByWorkspace]);

  const openDashboardWidgetEditor = useCallback((widgetId: string, ownerWorkspace = activeWorkspace) => {
    if (ownerWorkspace.type !== 'workspace') return;
    const paneId = `widget-editor:${ownerWorkspace.id}:${widgetId}`;
    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[ownerWorkspace.id] ?? createWorkspaceViewEntry(ownerWorkspace);
      return {
        ...current,
        [ownerWorkspace.id]: {
          ...existing,
          dashboardOpen: false,
          activeDashboardWidgetId: widgetId,
          activeSessionIds: [],
          openTabIds: [],
          editingFilePath: null,
          activeArtifactPanel: null,
          panelOrder: [paneId],
        },
      };
    });
  }, [activeWorkspace, setWorkspaceViewStateByWorkspace]);

  const closeActiveDashboardWidgetEditor = useCallback(() => {
    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
      const paneId = activeDashboardWidgetId ? `widget-editor:${activeWorkspaceId}:${activeDashboardWidgetId}` : null;
      return {
        ...current,
        [activeWorkspaceId]: {
          ...existing,
          dashboardOpen: true,
          activeDashboardWidgetId: null,
          panelOrder: paneId ? existing.panelOrder.filter((id) => id !== paneId) : existing.panelOrder,
        },
      };
    });
  }, [activeDashboardWidgetId, activeWorkspace, activeWorkspaceId, setWorkspaceViewStateByWorkspace]);

  const createDashboardWidgetFromCanvas = useCallback((position: WidgetPosition, prompt: string) => {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) return;
    const widgetId = `dashboard-widget-${createUniqueId()}`;
    const widgetTitle = deriveWidgetTitleFromPrompt(normalizedPrompt);
    updateActiveHarnessSpec((spec) => addHarnessDashboardWidget(spec, {
      id: widgetId,
      title: widgetTitle,
      position,
      size: { cols: 5, rows: 3 },
      props: {
        summary: normalizedPrompt,
        widgetJson: createPromptedWidgetDocument(normalizedPrompt) as unknown as JsonValue,
        widgetSampleData: {
          summary: normalizedPrompt,
          status: 'Draft',
          detail: 'Generated from canvas prompt',
          metric: 'Prompt-backed widget',
          owner: `workspace/${activeWorkspace.name}`,
        },
      },
    }));
    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
      return {
        ...current,
        [activeWorkspaceId]: {
          ...existing,
          dashboardOpen: false,
          activeDashboardWidgetId: widgetId,
          activeSessionIds: [],
          openTabIds: [],
          editingFilePath: null,
          activeArtifactPanel: null,
          panelOrder: [`widget-editor:${activeWorkspaceId}:${widgetId}`],
        },
      };
    });
    setToast({ msg: `${widgetTitle} widget created`, type: 'success' });
  }, [activeWorkspace, activeWorkspaceId, setToast, setWorkspaceViewStateByWorkspace, updateActiveHarnessSpec]);

  const startConversationBranch = useCallback((request: string, sessionId: string) => {
    const title = request.trim().replace(/\s+/g, ' ') || 'Active chat thread';
    const parentSession = findNode(activeWorkspace, sessionId);
    const subthreadSession = addSessionToWorkspace(
      activeWorkspaceId,
      title.slice(0, 48),
      {
        groupId: `conversation:${sessionId}`,
        groupName: `${parentSession?.name ?? 'Main conversation'} branches`,
      },
    );
    setConversationBranchingState(createConversationBranchingState({
      workspaceId: activeWorkspaceId,
      workspaceName: activeWorkspace.name,
      mainSessionId: sessionId,
      subthreadSessionId: subthreadSession?.id ?? sessionId,
      request,
    }));
    setToast({ msg: 'Conversation branch started', type: 'success' });
  }, [activeWorkspace, activeWorkspaceId, addSessionToWorkspace, setConversationBranchingState, setToast]);

  const openConversationSession = useCallback((sessionId: string) => {
    const workspace = getWorkspace(root, activeWorkspaceId);
    if (!workspace) return;
    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(workspace);
      const activeSessionIds = [sessionId];
      return {
        ...current,
        [activeWorkspaceId]: {
          ...existing,
          activeMode: 'agent',
          activeSessionIds,
          mountedSessionFsIds: existing.mountedSessionFsIds.includes(sessionId)
            ? existing.mountedSessionFsIds
            : [...existing.mountedSessionFsIds, sessionId],
          panelOrder: [
            ...(existing.openTabIds ?? []).map((id) => `browser:${id}`),
            ...activeSessionIds.map((id) => `session:${id}`),
          ],
        },
      };
    });
    switchWorkspace(activeWorkspaceId);
  }, [activeWorkspaceId, root, setWorkspaceViewStateByWorkspace, switchWorkspace]);

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

  const handleAiPointerCapture = useCallback((target: AiPointerTarget) => {
    setAiPointerState((current) => ({ ...current, lastTarget: target }));
  }, [setAiPointerState]);

  const handleAiPointerPromptDraft = useCallback((prompt: string) => {
    setPendingAiPointerPrompt(prompt);
    switchSessionMode(activeWorkspaceId, 'agent');
    setToast({ msg: 'AI Pointer prompt drafted', type: 'success' });
  }, [activeWorkspaceId, setToast, switchSessionMode]);

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
      const movableFiles = filesToMove.filter(({ file }) => !isWorkspaceFileLockedByExtension(file));
      const blockedFiles = filesToMove.filter(({ file }) => isWorkspaceFileLockedByExtension(file));
      if (blockedFiles.length) {
        setToast({
          msg: `${blockedFiles.length} extension-locked file${blockedFiles.length === 1 ? '' : 's'} stayed in place. Uninstall the owning extension to remove them.`,
          type: 'warning',
        });
      }
      setWorkspaceFilesByWorkspace((current) => {
        const next = { ...current };
        for (const { file, sourceWorkspaceId } of movableFiles) {
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

      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelectedIds(visibleItems.map((item) => item.node.id));
        setSelectionAnchorId(cursorId);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        void copyWorktreeNodesByIds(selectedIds.length ? selectedIds : cursorId ? [cursorId] : []);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'x') {
        event.preventDefault();
        const nextClipboard = selectedIds.length ? selectedIds : cursorId ? [cursorId] : [];
        setClipboardIds(nextClipboard);
        setToast({ msg: nextClipboard.length ? `Cut ${nextClipboard.length} item${nextClipboard.length === 1 ? '' : 's'}` : 'Nothing selected to cut', type: nextClipboard.length ? 'info' : 'warning' });
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        const targetWorkspace = currentNode?.type === 'workspace'
          ? currentNode
          : currentParent?.type === 'workspace'
            ? currentParent
            : (cursorId ? findWorkspaceForNode(root, cursorId) : null) ?? getWorkspace(root, activeWorkspaceId);
        if (targetWorkspace) pasteSelectionIntoWorkspace(targetWorkspace.id);
        return;
      }
      if (!event.altKey && event.key === ' ' && cursorId) {
        event.preventDefault();
        setSelectedIds((current) => current.includes(cursorId) ? current.filter((id) => id !== cursorId) : [...current, cursorId]);
        setSelectionAnchorId(cursorId);
        return;
      }
      if ((event.key === 'Delete' && !event.ctrlKey && !event.metaKey && !event.altKey) || ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'd')) {
        event.preventDefault();
        deleteWorktreeNodesByIds(selectedIds.length ? selectedIds : cursorId ? [cursorId] : []);
        return;
      }
      if (event.key === 'F2' && !event.ctrlKey && !event.metaKey && !event.altKey && currentNode) {
        event.preventDefault();
        openRenameForWorktreeNode(currentNode);
        return;
      }
      if (event.key === 'Enter' && event.altKey && !event.ctrlKey && !event.metaKey && currentNode) {
        event.preventDefault();
        setPropertiesNode(currentNode);
        return;
      }
      if (((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu' || event.key === 'Apps') && currentNode) {
        event.preventDefault();
        openKeyboardContextMenuForNode(currentNode);
        return;
      }
      if (event.key === 'F5' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setRoot((current) => ({ ...current }));
        setToast({ msg: 'Workspace tree refreshed', type: 'info' });
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1 && /\S/.test(event.key)) {
        event.preventDefault();
        setTreeFilter((current) => `${current}${event.key.toLowerCase()}`);
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        if (treeFilter) {
          setTreeFilter((current) => current.slice(0, -1));
        } else if (currentParent && currentParent.type !== 'root') {
          setCursorId(currentParent.id);
        }
        return;
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'ArrowUp' && currentParent && currentParent.type !== 'root') {
        event.preventDefault();
        setCursorId(currentParent.id);
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
        if (event.shiftKey) setRangeSelection(0);
      }
      if (event.key === 'End' && visibleItems.length) {
        event.preventDefault();
        setCursorId(visibleItems[visibleItems.length - 1].node.id);
        if (event.shiftKey) setRangeSelection(visibleItems.length - 1);
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

  async function deleteSessionFsNode(sessionId: string, path: string, options: { showToast?: boolean } = {}): Promise<boolean> {
    const showToast = options.showToast ?? true;
    const bash = bashBySessionRef.current[sessionId];
    if (!bash) {
      if (showToast) setToast({ msg: 'Session not yet initialised — open it first', type: 'warning' });
      return false;
    }
    let normalizedPath: string;
    try {
      normalizedPath = normalizeSessionFsPath(path);
    } catch (error) {
      if (showToast) setToast({ msg: error instanceof Error ? error.message : 'Invalid session filesystem path.', type: 'warning' });
      return false;
    }
    await bash.exec(`rm -rf ${quoteShellArg(normalizedPath)}`);
    handleTerminalFsPathsChanged(sessionId, bash.fs.getAllPaths());
    if (showToast) setToast({ msg: `Deleted ${normalizedPath}`, type: 'success' });
    return true;
  }

  async function handleDeleteSessionFsNode(sessionId: string, path: string) {
    await deleteSessionFsNode(sessionId, path);
  }

  function orderWorktreeCommandIds(nodeIds: readonly string[]): string[] {
    const visibleOrder = new Map(visibleItems.map((item, index) => [item.node.id, index]));
    return [...new Set(nodeIds)].sort((left, right) => {
      const leftIndex = visibleOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = visibleOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
      return left.localeCompare(right);
    });
  }

  async function copyWorktreeNodesByIds(nodeIds: readonly string[]) {
    const orderedIds = orderWorktreeCommandIds(nodeIds);
    const references = orderedIds.flatMap((nodeId) => {
      const node = findNode(root, nodeId);
      if (!node) return [];
      const vfsArgs = node.id.startsWith('vfs:') && !node.nodeKind ? parseVfsNodeId(node.id) : null;
      if (vfsArgs) return [`${node.name}\t${vfsArgs.basePath}`];
      if (node.url) return [`${node.name}\t${node.url}`];
      if (node.filePath) return [`${node.name}\t${node.filePath}`];
      return [node.name];
    });
    if (!references.length) {
      setToast({ msg: 'Nothing selected to copy', type: 'warning' });
      return;
    }
    try {
      await writeToClipboard(references.join('\n'), `${references.length} worktree item${references.length === 1 ? '' : 's'}`);
      setToast({ msg: `Copied ${references.length} item${references.length === 1 ? '' : 's'}`, type: 'success' });
    } catch {
      setToast({ msg: 'Failed to copy selected items', type: 'error' });
    }
  }

  function formatWorktreeDeletionToast(deletedCount: number, skippedCount: number): ToastState {
    if (deletedCount <= 0) {
      return { msg: skippedCount ? 'No selected items can be deleted' : 'Nothing selected to delete', type: 'warning' };
    }
    const itemLabel = `Deleted ${deletedCount} item${deletedCount === 1 ? '' : 's'}`;
    if (!skippedCount) return { msg: itemLabel, type: 'success' };
    return { msg: `${itemLabel}; skipped ${skippedCount} item${skippedCount === 1 ? '' : 's'}`, type: 'success' };
  }

  function updateWorkspaceViewStateForDeletedItems(removalsByWorkspace: Map<string, { nodeIds: Set<string>; paneIds: Set<string>; filePaths: Set<string> }>) {
    if (!removalsByWorkspace.size) return;
    setWorkspaceViewStateByWorkspace((current) => {
      let next = current;
      for (const [workspaceId, removals] of removalsByWorkspace) {
        const workspace = getWorkspace(root, workspaceId) ?? activeWorkspace;
        const existing = current[workspaceId] ?? createWorkspaceViewEntry(workspace);
        const nextEntry: WorkspaceViewState = {
          ...existing,
          openTabIds: existing.openTabIds.filter((id) => !removals.nodeIds.has(id)),
          activeSessionIds: existing.activeSessionIds.filter((id) => !removals.nodeIds.has(id)),
          mountedSessionFsIds: existing.mountedSessionFsIds.filter((id) => !removals.nodeIds.has(id)),
          editingFilePath: existing.editingFilePath && removals.filePaths.has(existing.editingFilePath) ? null : existing.editingFilePath,
          panelOrder: existing.panelOrder.filter((id) => !removals.paneIds.has(id)),
        };
        if (!workspaceViewStateEquals(existing, nextEntry)) {
          next = { ...next, [workspaceId]: nextEntry };
        }
      }
      return next;
    });
  }

  function deleteWorktreeNodesByIds(nodeIds: readonly string[]) {
    const orderedIds = orderWorktreeCommandIds(nodeIds);
    if (!orderedIds.length) {
      setToast(formatWorktreeDeletionToast(0, 0));
      return;
    }

    const treeNodeIdsToRemove = new Set<string>();
    const workspaceFilePathsToRemove = new Map<string, Set<string>>();
    const removalsByWorkspace = new Map<string, { nodeIds: Set<string>; paneIds: Set<string>; filePaths: Set<string> }>();
    const sessionIdsToClean = new Set<string>();
    const browserTabIdsToClean = new Set<string>();
    const deletedSelectionIds = new Set<string>();
    const vfsDeletes: Array<{ nodeId: string; sessionId: string; basePath: string }> = [];
    let deletedCount = 0;
    let skippedCount = 0;

    const registerWorkspaceRemoval = (workspaceId: string, nodeId: string, paneId: string | null, filePath?: string) => {
      const existing = removalsByWorkspace.get(workspaceId) ?? { nodeIds: new Set<string>(), paneIds: new Set<string>(), filePaths: new Set<string>() };
      existing.nodeIds.add(nodeId);
      if (paneId) existing.paneIds.add(paneId);
      if (filePath) {
        existing.filePaths.add(filePath);
        existing.paneIds.add(`file:${filePath}`);
      }
      removalsByWorkspace.set(workspaceId, existing);
    };

    for (const nodeId of orderedIds) {
      const node = findNode(root, nodeId);
      if (!node) {
        skippedCount += 1;
        continue;
      }

      const vfsArgs = node.id.startsWith('vfs:') && !node.nodeKind ? parseVfsNodeId(node.id) : null;
      if (vfsArgs) {
        if (vfsArgs.isDriveRoot) {
          skippedCount += 1;
          continue;
        }
        vfsDeletes.push({ nodeId, sessionId: vfsArgs.sessionId, basePath: vfsArgs.basePath });
        continue;
      }

      const ownerWorkspace = findWorkspaceForNode(root, nodeId);
      const ownerWorkspaceId = ownerWorkspace?.id ?? activeWorkspaceId;
      if (node.type === 'file' && node.filePath && !node.artifactId && !node.artifactReferenceId && !node.artifactFilePath) {
        const file = ownerWorkspace ? (workspaceFilesByWorkspace[ownerWorkspace.id] ?? []).find((entry) => entry.path === node.filePath) : null;
        const removalBlocker = file ? getWorkspaceFileRemovalBlocker(file) : null;
        if (!ownerWorkspace || !file || removalBlocker) {
          skippedCount += 1;
          continue;
        }
        const paths = workspaceFilePathsToRemove.get(ownerWorkspace.id) ?? new Set<string>();
        paths.add(node.filePath);
        workspaceFilePathsToRemove.set(ownerWorkspace.id, paths);
        registerWorkspaceRemoval(ownerWorkspace.id, nodeId, renderPaneIdForNode(node), node.filePath);
        deletedSelectionIds.add(nodeId);
        deletedCount += 1;
        continue;
      }

      if (node.type === 'tab' && ((node.nodeKind ?? 'browser') === 'browser' || node.nodeKind === 'session')) {
        treeNodeIdsToRemove.add(nodeId);
        registerWorkspaceRemoval(ownerWorkspaceId, nodeId, renderPaneIdForNode(node));
        deletedSelectionIds.add(nodeId);
        deletedCount += 1;
        if (node.nodeKind === 'session') sessionIdsToClean.add(nodeId);
        if ((node.nodeKind ?? 'browser') === 'browser') browserTabIdsToClean.add(nodeId);
        continue;
      }

      skippedCount += 1;
    }

    if (workspaceFilePathsToRemove.size) {
      setWorkspaceFilesByWorkspace((current) => {
        let next = current;
        for (const [workspaceId, paths] of workspaceFilePathsToRemove) {
          let files = current[workspaceId] ?? [];
          const originalFiles = files;
          for (const path of paths) {
            files = removeWorkspaceFile(files, path);
          }
          if (files !== originalFiles) {
            next = { ...next, [workspaceId]: files };
          }
        }
        return next;
      });
    }

    if (treeNodeIdsToRemove.size) {
      setRoot((current) => [...treeNodeIdsToRemove].reduce((nextRoot, nodeId) => removeNodeById(nextRoot, nodeId), current));
    }

    for (const sessionId of sessionIdsToClean) {
      delete bashBySessionRef.current[sessionId];
      removeStoredRecordEntry(localStorageBackend, STORAGE_KEYS.chatMessagesBySession, isChatMessagesBySession, sessionId);
      removeStoredRecordEntry(localStorageBackend, STORAGE_KEYS.chatHistoryBySession, isStringArrayRecord, sessionId);
      removeStoredRecordEntry(localStorageBackend, STORAGE_KEYS.artifactContextBySession, isArtifactContextBySession, sessionId);
    }

    if (sessionIdsToClean.size) {
      setArtifactContextBySession((current) => {
        let next = current;
        for (const sessionId of sessionIdsToClean) {
          if (sessionId in next) {
            next = { ...next };
            delete next[sessionId];
          }
        }
        return next;
      });
      setTerminalFsPathsBySession((current) => {
        let next = current;
        for (const sessionId of sessionIdsToClean) {
          if (sessionId in next) {
            next = { ...next };
            delete next[sessionId];
          }
        }
        return next;
      });
      setTerminalFsFileContentsBySession((current) => {
        let next = current;
        for (const sessionId of sessionIdsToClean) {
          if (sessionId in next) {
            next = { ...next };
            delete next[sessionId];
          }
        }
        return next;
      });
    }

    if (browserTabIdsToClean.size) {
      setBrowserNavHistories((current) => {
        let next = current;
        for (const tabId of browserTabIdsToClean) {
          if (tabId in next) {
            next = { ...next };
            delete next[tabId];
          }
        }
        return next;
      });
    }

    updateWorkspaceViewStateForDeletedItems(removalsByWorkspace);

    const finalizeDeletion = (finalDeletedCount: number, finalSkippedCount: number, finalDeletedSelectionIds: Set<string>) => {
      setSelectedIds((current) => current.filter((id) => !finalDeletedSelectionIds.has(id)));
      setSelectionAnchorId(null);
      if (cursorId && finalDeletedSelectionIds.has(cursorId)) {
        const nextCursor = visibleItems.find((item) => !finalDeletedSelectionIds.has(item.node.id))?.node.id ?? null;
        setCursorId(nextCursor);
      }
      setClipboardIds((current) => current.filter((id) => !finalDeletedSelectionIds.has(id)));
      setToast(formatWorktreeDeletionToast(finalDeletedCount, finalSkippedCount));
    };

    if (!vfsDeletes.length) {
      finalizeDeletion(deletedCount, skippedCount, deletedSelectionIds);
      return;
    }

    void Promise.all(vfsDeletes.map(async (entry) => ({
      ...entry,
      deleted: await deleteSessionFsNode(entry.sessionId, entry.basePath, { showToast: false }),
    }))).then((results) => {
      const finalDeletedSelectionIds = new Set(deletedSelectionIds);
      let deletedVfsCount = 0;
      for (const result of results) {
        if (result.deleted) {
          deletedVfsCount += 1;
          finalDeletedSelectionIds.add(result.nodeId);
        }
      }
      finalizeDeletion(deletedCount + deletedVfsCount, skippedCount + results.length - deletedVfsCount, finalDeletedSelectionIds);
    });
  }

  function openRenameForWorktreeNode(node: TreeNode) {
    if (node.type === 'workspace') {
      openRenameWorkspace(node.id);
      return;
    }
    if (node.type === 'tab' && node.nodeKind === 'session') {
      openRenameSessionDialog(node);
      return;
    }
    const vfsArgs = node.id.startsWith('vfs:') && !node.nodeKind ? parseVfsNodeId(node.id) : null;
    if (vfsArgs && !vfsArgs.isDriveRoot) {
      setRenameSessionFsName(vfsArgs.basePath.slice(vfsArgs.basePath.lastIndexOf('/') + 1));
      setRenameSessionFsMenu({ sessionId: vfsArgs.sessionId, path: vfsArgs.basePath });
      return;
    }
    if (node.type === 'file' && node.filePath && !node.artifactId && !node.artifactReferenceId && !node.artifactFilePath) {
      handleOpenFileNode(node.id);
      setToast({ msg: `Edit the Path field to rename ${node.name}`, type: 'info' });
      return;
    }
    setToast({ msg: `${node.name} cannot be renamed from the worktree`, type: 'warning' });
  }

  function openKeyboardContextMenuForNode(node: TreeNode) {
    const row = Array.from(document.querySelectorAll<HTMLElement>('[data-tree-node-id]'))
      .find((element) => element.dataset.treeNodeId === node.id);
    const rect = row?.getBoundingClientRect();
    openContextMenuForNode(rect ? rect.left + 24 : 160, rect ? rect.bottom : 160, node);
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
        { icon: Layers3, label: 'Projects', onClick: openWorkspaceSwitcher },
      ],
      entries: [
        { label: 'Properties', onClick: () => setPropertiesNode(activeWorkspace) },
      ],
    };
  }

  function buildWorkspaceContextMenu(node: TreeNode): { entries: ContextMenuEntry[]; topButtons: ContextMenuTopButton[] } {
    const entries: ContextMenuEntry[] = [];
    if (node.id !== activeWorkspaceId) {
      entries.push({ label: 'Switch project', onClick: () => switchWorkspace(node.id) });
    }
    entries.push(
      { label: 'Projects', onClick: openWorkspaceSwitcher },
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
    if (node.nodeKind === 'artifact') {
      return {
        topButtons: [],
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
          : node.nodeKind === 'files'
            ? ['Add file']
            : [];
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
        location: node.artifactFilePath ? `//workspace/artifacts/${artifactId}/${node.artifactFilePath}` : `//workspace/artifacts/${artifactId}`,
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
      const ownerWorkspace = findWorkspaceForNode(root, node.id);
      const workspaceFile = ownerWorkspace && node.filePath
        ? (workspaceFilesByWorkspace[ownerWorkspace.id] ?? []).find((file) => file.path === node.filePath)
        : null;
      const actions = workspaceFile && isWorkspaceFileLockedByExtension(workspaceFile)
        ? ['Symlink', 'Duplicate']
        : ['Move', 'Symlink', 'Duplicate', 'Remove'];
      return {
        location: node.filePath ?? node.name,
        sizeLabel: 'N/A',
        createdAt: now,
        modifiedAt: now,
        accessedAt: now,
        identityPermissions: defaultPermissionsFor(actions),
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
      const file = (workspaceFilesByWorkspace[ownerWorkspace.id] ?? []).find((entry) => entry.path === node.filePath);
      const removalBlocker = file ? getWorkspaceFileRemovalBlocker(file) : null;
      if (removalBlocker) {
        setToast({ msg: removalBlocker, type: 'warning' });
        return;
      }
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
    const file = (workspaceFilesByWorkspace[ownerWorkspace.id] ?? []).find((entry) => entry.path === node.filePath);
    const removalBlocker = file ? getWorkspaceFileRemovalBlocker(file) : null;
    if (removalBlocker) {
      setFileOpModal(null);
      setToast({ msg: removalBlocker, type: 'warning' });
      return;
    }
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
    if (node.nodeKind === 'dashboard') {
      if (node.dashboardWidgetId) {
        openDashboardWidgetEditor(node.dashboardWidgetId, workspace);
        return;
      }
      setWorkspaceViewStateByWorkspace((current) => {
        const existing = current[workspace.id] ?? createWorkspaceViewEntry(workspace);
        return {
          ...current,
          [workspace.id]: {
            ...existing,
            dashboardOpen: true,
            activeDashboardWidgetId: null,
            activeSessionIds: [],
            openTabIds: [],
            editingFilePath: null,
            activeArtifactPanel: null,
            panelOrder: [`dashboard:${workspace.id}`],
          },
        };
      });
      return;
    }
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
    const runtime = harnessCoreState.sessions[session.id] ?? sessionMcpControllersRef.current[session.id]?.getRuntimeState();
    return buildHarnessCoreSessionSnapshot(session, runtime, activeSessionAssetsById[session.id] ?? []);
  }), [activeSessionAssetsById, activeWorkspaceSessions, harnessCoreState.sessions]);
  const harnessCoreSummary = useMemo(() => selectHarnessCoreSummary(harnessCoreState), [harnessCoreState]);

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
    addSessionToWorkspace(activeWorkspaceId, name, { titleLocked: Boolean(name?.trim()) }) ?? undefined
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

  const saveDesignStudioProjectArtifact = useCallback((
    input: DesignStudioProjectArtifactInput,
    existingArtifactId?: string | null,
  ): AgentArtifact => {
    const existingArtifact = existingArtifactId
      ? activeArtifacts.find((candidate) => candidate.id === existingArtifactId) ?? null
      : null;
    const artifact = existingArtifact
      ? updateArtifactFiles(existingArtifact, {
        title: input.title,
        description: input.description,
        kind: input.kind,
        references: input.references,
        files: input.files,
      }, { idFactory: createUniqueId })
      : createArtifact(input, { idFactory: createUniqueId });

    setArtifactsByWorkspace((current) => {
      const artifacts = current[activeWorkspaceId] ?? [];
      return {
        ...current,
        [activeWorkspaceId]: existingArtifact
          ? artifacts.map((candidate) => candidate.id === artifact.id ? artifact : candidate)
          : [artifact, ...artifacts.filter((candidate) => candidate.id !== artifact.id)],
      };
    });

    return artifact;
  }, [activeArtifacts, activeWorkspaceId, setArtifactsByWorkspace]);

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
    const existingFile = (workspaceFilesByWorkspace[activeWorkspaceId] ?? []).find((file) => file.path === path);
    const removalBlocker = existingFile ? getWorkspaceFileRemovalBlocker(existingFile) : null;
    if (removalBlocker) {
      throw new DOMException(removalBlocker, 'NoModificationAllowedError');
    }
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
  }, [activeWorkspace, activeWorkspaceId, workspaceFilesByWorkspace]);

  const moveWorkspaceFileFromMcp = useCallback(async ({ path, targetPath }: { path: string; targetPath: string }) => {
    const existingFile = (workspaceFilesByWorkspace[activeWorkspaceId] ?? []).find((file) => file.path === path);
    if (!existingFile) {
      throw new DOMException(`Workspace file "${path}" is not available in ${activeWorkspace.name}.`, 'NotFoundError');
    }
    const removalBlocker = getWorkspaceFileRemovalBlocker(existingFile);
    if (removalBlocker) {
      throw new DOMException(removalBlocker, 'NoModificationAllowedError');
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
    setPendingReviewFollowUps((current) => [...current, { sessionId, prompt }]);
    switchSidebarPanel('workspaces');
    setToast({ msg: 'Review follow-up queued in the active session', type: 'info' });
  }, [activeSessionIds, activeWorkspaceId, addSessionToWorkspace, setToast, switchSidebarPanel]);

  const queueSymphonyDispatch = useCallback((dispatch: MultitaskBranchDispatch) => {
    const session = addSessionToWorkspace(activeWorkspaceId, dispatch.sessionName, {
      open: true,
      groupId: dispatch.branchName,
      groupName: dispatch.branchName,
    });
    if (!session) {
      setToast({ msg: `Unable to open Symphony session for ${dispatch.sessionName}`, type: 'error' });
      return;
    }
    switchSidebarPanel('workspaces');
    setMultitaskSubagentState((current) => {
      if (!current.enabled || current.workspaceId !== activeWorkspaceId) return current;
      return attachMultitaskBranchSession(current, dispatch.branchId, {
        sessionId: session.id,
        sessionName: dispatch.sessionName,
      });
    });
    setPendingReviewFollowUps((current) => [...current, { sessionId: session.id, prompt: dispatch.prompt }]);
    setToast({
      msg: dispatch.reason === 'self-heal'
        ? `Self-healed ${dispatch.sessionName} and queued a fresh agent run`
        : `Queued Symphony agent run ${dispatch.sessionName}`,
      type: 'info',
    });
  }, [activeWorkspaceId, addSessionToWorkspace, setMultitaskSubagentState, setToast, switchSidebarPanel]);

  useEffect(() => {
    if (pendingSymphonyDispatches.length === 0) return;
    const [nextDispatch] = pendingSymphonyDispatches;
    setPendingSymphonyDispatches((current) => current.slice(1));
    queueSymphonyDispatch(nextDispatch);
  }, [pendingSymphonyDispatches, queueSymphonyDispatch, setPendingSymphonyDispatches]);

  const requestActiveMultitaskChanges = useCallback((branchId: string, prompt: string) => {
    setMultitaskSubagentState((current) => {
      const source = current.enabled && current.workspaceId === activeWorkspaceId
        ? current
        : activeMultitaskSubagentState;
      return requestMultitaskBranchChanges(source, branchId, prompt.split('\n'));
    });
    startReviewFollowUp(prompt);
  }, [activeMultitaskSubagentState, activeWorkspaceId, setMultitaskSubagentState, startReviewFollowUp]);

  const refreshRepoWiki = useCallback(() => {
    const snapshot = buildRepoWikiSnapshot({
      workspace: activeWorkspace,
      files: activeWorkspaceFiles,
      artifactTitles: activeArtifacts.map((artifact) => artifact.title),
    });
    setRepoWikiSnapshotsByWorkspace((current) => ({
      ...current,
      [activeWorkspaceId]: snapshot,
    }));
    setToast({ msg: 'Repository wiki refreshed', type: 'success' });
  }, [activeArtifacts, activeWorkspace, activeWorkspaceFiles, activeWorkspaceId, setRepoWikiSnapshotsByWorkspace, setToast]);

  const installBrowserWorkflowSkillForWorkspace = useCallback((skill: BrowserWorkflowSkillManifest) => {
    setWorkspaceFilesByWorkspace((current) => ({
      ...current,
      [activeWorkspaceId]: installBrowserWorkflowSkill(current[activeWorkspaceId] ?? [], skill),
    }));
    setToast({ msg: `Installed ${skill.name}`, type: 'success' });
  }, [activeWorkspaceId, setToast]);

  const copyRepoWikiCitation = useCallback(async (citation: RepoWikiCitation) => {
    try {
      await writeToClipboard(`${citation.id}\n${citation.snippet}`, `Wiki citation: ${citation.label}`);
      setToast({ msg: 'Wiki citation copied', type: 'success' });
    } catch {
      setToast({ msg: 'Failed to copy wiki citation', type: 'error' });
    }
  }, [setToast]);

  const rememberRepoWikiMemory = useCallback((scope: WorkspaceMemoryScope, text: string) => {
    const nextFiles = appendWorkspaceMemoryFact(workspaceFilesByWorkspace[activeWorkspaceId] ?? [], scope, text);
    setWorkspaceFilesByWorkspace((current) => ({
      ...current,
      [activeWorkspaceId]: nextFiles,
    }));
    setRepoWikiSnapshotsByWorkspace((current) => ({
      ...current,
      [activeWorkspaceId]: buildRepoWikiSnapshot({
        workspace: activeWorkspace,
        files: nextFiles,
        artifactTitles: activeArtifacts.map((artifact) => artifact.title),
      }),
    }));
    setToast({ msg: 'Memory saved', type: 'success' });
  }, [
    activeArtifacts,
    activeWorkspace,
    activeWorkspaceId,
    setRepoWikiSnapshotsByWorkspace,
    setToast,
    setWorkspaceFilesByWorkspace,
    workspaceFilesByWorkspace,
  ]);

  const forgetRepoWikiMemory = useCallback((entry: { sourcePath: string; lineNumber: number; text: string }) => {
    const nextFiles = deleteWorkspaceMemoryEntry(
      workspaceFilesByWorkspace[activeWorkspaceId] ?? [],
      { path: entry.sourcePath, lineNumber: entry.lineNumber },
    );
    setWorkspaceFilesByWorkspace((current) => ({
      ...current,
      [activeWorkspaceId]: nextFiles,
    }));
    setRepoWikiSnapshotsByWorkspace((current) => ({
      ...current,
      [activeWorkspaceId]: buildRepoWikiSnapshot({
        workspace: activeWorkspace,
        files: nextFiles,
        artifactTitles: activeArtifacts.map((artifact) => artifact.title),
      }),
    }));
    setToast({ msg: 'Memory forgotten', type: 'info' });
  }, [
    activeArtifacts,
    activeWorkspace,
    activeWorkspaceId,
    setRepoWikiSnapshotsByWorkspace,
    setToast,
    setWorkspaceFilesByWorkspace,
    workspaceFilesByWorkspace,
  ]);

  useEffect(() => {
    if (pendingReviewFollowUps.length === 0) return;
    const [{ sessionId }] = pendingReviewFollowUps;
    setWorkspaceViewStateByWorkspace((current) => {
      const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
      if (
        existing.activeMode === 'agent'
        && existing.activeSessionIds.length === 1
        && existing.activeSessionIds[0] === sessionId
        && existing.panelOrder[0] === `session:${sessionId}`
      ) {
        return current;
      }
      return {
        ...current,
        [activeWorkspaceId]: {
          ...existing,
          activeMode: 'agent',
          activeSessionIds: [sessionId],
          mountedSessionFsIds: existing.mountedSessionFsIds.includes(sessionId)
            ? existing.mountedSessionFsIds
            : [...existing.mountedSessionFsIds, sessionId],
          panelOrder: [`session:${sessionId}`],
        },
      };
    });
  }, [activeWorkspace, activeWorkspaceId, pendingReviewFollowUps, setWorkspaceViewStateByWorkspace]);

  useEffect(() => {
    if (pendingReviewFollowUps.length === 0) return undefined;
    const handle = window.setTimeout(() => {
      setPendingReviewFollowUpRetryTick((current) => current + 1);
    }, 100);
    return () => window.clearTimeout(handle);
  }, [pendingReviewFollowUps, pendingReviewFollowUpRetryTick]);

  const closeRenderPaneFromMcp = useCallback(async (paneId: string) => {
    if (paneId.startsWith(`widget-editor:${activeWorkspaceId}:`)) {
      setWorkspaceViewStateByWorkspace((current) => {
        const existing = current[activeWorkspaceId] ?? createWorkspaceViewEntry(activeWorkspace);
        return {
          ...current,
          [activeWorkspaceId]: {
            ...existing,
            dashboardOpen: true,
            activeDashboardWidgetId: null,
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

  function renderSettingsWorkbench() {
    return (
      <SettingsPanel
        harnessCoreSummary={harnessCoreSummary}
        benchmarkRoutingSettings={benchmarkRoutingSettings}
        benchmarkRoutingCandidates={benchmarkRoutingCandidates}
        benchmarkEvidenceState={benchmarkEvidenceState}
        adversaryToolReviewSettings={adversaryToolReviewSettings}
        adversaryAgentSettings={adversaryAgentSettings}
        securityReviewAgentSettings={securityReviewAgentSettings}
        securityReviewRunPlan={settingsSecurityReviewRunPlan}
        scheduledAutomationState={scheduledAutomationState}
        runCheckpointState={runCheckpointState}
        sessionChapterState={sessionChapterState}
        workspaceSkillPolicyState={workspaceSkillPolicyState}
        workspaceSkillPolicyInventory={workspaceSkillPolicyInventory}
        sharedAgentRegistryState={sharedAgentRegistryState}
        sharedAgentCatalog={sharedAgentCatalog}
        browserWorkflowSkills={browserWorkflowSkills}
        symphonyAutopilotSettings={symphonyAutopilotSettings}
        conversationBranchingState={activeConversationBranchingState}
        harnessSteeringState={harnessSteeringState}
        harnessSteeringInventory={harnessSteeringInventory}
        harnessEvolutionSettings={harnessEvolutionSettings}
        harnessEvolutionPlan={settingsHarnessEvolutionPlan}
        persistentMemoryGraphState={persistentMemoryGraphState}
        graphKnowledgeState={graphKnowledgeState}
        browserAgentRunSdkState={browserAgentRunSdkState}
        aiPointerState={aiPointerState}
        partnerAgentControlPlaneSettings={partnerAgentControlPlaneSettings}
        partnerAgentControlPlane={settingsPartnerAgentControlPlane}
        latestPartnerAgentAuditEntry={latestPartnerAgentAuditEntry}
        runtimePluginSettings={runtimePluginSettings}
        runtimePluginRuntime={settingsRuntimePluginRuntime}
        specDrivenDevelopmentSettings={specDrivenDevelopmentSettings}
        specWorkflowPlan={settingsSpecWorkflowPlan}
        onBenchmarkRoutingSettingsChange={setBenchmarkRoutingSettings}
        onAdversaryToolReviewSettingsChange={setAdversaryToolReviewSettings}
        onAdversaryAgentSettingsChange={setAdversaryAgentSettings}
        onSecurityReviewAgentSettingsChange={setSecurityReviewAgentSettings}
        onScheduledAutomationStateChange={setScheduledAutomationState}
        onRunCheckpointStateChange={setRunCheckpointState}
        onSessionChapterStateChange={setSessionChapterState}
        onWorkspaceSkillPolicyStateChange={setWorkspaceSkillPolicyState}
        onSharedAgentRegistryStateChange={setSharedAgentRegistryState}
        onInstallBrowserWorkflowSkill={installBrowserWorkflowSkillForWorkspace}
        onSymphonyAutopilotSettingsChange={setSymphonyAutopilotSettings}
        onConversationBranchSettingsChange={updateConversationBranchSettings}
        onHarnessSteeringStateChange={setHarnessSteeringState}
        onHarnessEvolutionSettingsChange={setHarnessEvolutionSettings}
        onPersistentMemoryGraphStateChange={setPersistentMemoryGraphState}
        onGraphKnowledgeStateChange={setGraphKnowledgeState}
        onAiPointerStateChange={setAiPointerState}
        onPartnerAgentControlPlaneSettingsChange={setPartnerAgentControlPlaneSettings}
        onRuntimePluginSettingsChange={setRuntimePluginSettings}
        onSpecDrivenDevelopmentSettingsChange={setSpecDrivenDevelopmentSettings}
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
  }

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
    if (activePanel === 'symphony') {
      return (
        <SymphonyActivityPanel
          snapshot={activeSymphonySnapshot}
          onApproveMerge={promoteActiveMultitaskBranch}
          onRequestChanges={requestActiveMultitaskChanges}
          onStartTask={startMultitaskSubagents}
          onStartFollowUp={startReviewFollowUp}
        />
      );
    }
    if (activePanel === 'wiki') {
      return (
        <RepoWikiPanel
          onRefresh={refreshRepoWiki}
        />
      );
    }
    if (activePanel === 'history') {
      return (
        <HistoryPanel
          workspaceId={activeWorkspaceId}
          workspaceName={activeWorkspace.name}
          sessions={activeWorkspaceSessions}
          scheduledAutomationState={scheduledAutomationState}
          runCheckpointState={runCheckpointState}
          browserAgentRunSdkState={browserAgentRunSdkState}
          conversationBranchingState={activeConversationBranchingState}
          sessionChapterState={sessionChapterState}
          actionHistoryState={workspaceActionHistoryState}
          messagesBySession={historyMessagesBySession}
          fileHistories={activeWorkspaceFileCrdtHistories}
          onMoveActionHistoryCursor={moveActiveWorkspaceActionHistoryCursor}
        />
      );
    }
    if (activePanel === 'extensions') {
      if (activeExtensionFeature?.manifest.id === 'agent-harness.ext.design-studio') {
        return (
          <DesignStudioProjectsPanel
            artifacts={activeArtifacts}
            onOpenProject={(artifact) => {
              const designFile = artifact.files.find((file) => file.path === 'DESIGN.md') ?? artifact.files[0] ?? null;
              openArtifactPanel(artifact.id, designFile?.path ?? null, activeWorkspaceId);
            }}
            onDownloadProject={downloadArtifact}
          />
        );
      }
      return (
        <ExtensionsPanel
          workspaceName={activeWorkspace.name}
          capabilities={activeWorkspaceCapabilities}
          defaultExtensions={defaultExtensionRuntime}
          installedExtensionIds={installedDefaultExtensionIds}
          enabledExtensionIds={enabledDefaultExtensionIds}
          onOpenExtensionDetail={openExtensionDetail}
          onInstallExtension={installDefaultExtension}
          onUninstallExtension={uninstallDefaultExtension}
          onSetExtensionEnabled={setDefaultExtensionEnabled}
          onConfigureExtension={configureDefaultExtension}
        />
      );
    }
    if (activePanel === 'models') return (
      <ModelsPanel
        installedModels={installedModels}
        onDelete={deleteModel}
      />
    );
    if (activePanel === 'settings') return renderSettingsWorkbench();
    return <AccountPanel defaultExtensions={defaultExtensionRuntime} />;
  }

  return (
    <div className={`app-shell${activePanel === 'settings' ? ' app-shell--settings-workbench' : ''}`} onContextMenu={handleAppContextMenu}>
      <a className="skip-link" href="#workspace-content">Skip to workspace content</a>
      <nav className="activity-bar" aria-label="Primary navigation">
        <div className="activity-group">
          {PRIMARY_NAV.map(([id, icon, label], index) => (
            <button
              key={id}
              type="button"
              className={`activity-button ${activePanel === id && (id !== 'extensions' || !activeExtensionFeatureId) ? 'active' : ''}`}
              onClick={() => {
                if (id === 'workspaces') {
                  if (activePanel === 'workspaces') openWorkspaceSwitcher();
                  else switchSidebarPanel('workspaces');
                  return;
                }
                if (id === 'extensions') {
                  openExtensionsMarketplace();
                  return;
                }
                switchSidebarPanel(id as SidebarPanel);
              }}
              aria-label={label}
              title={`${label} (Alt+${index + 1})`}
            >
              <Icon name={icon as keyof typeof icons} size={16} color={activePanel === id && (id !== 'extensions' || !activeExtensionFeatureId) ? '#7dd3fc' : '#71717a'} />
            </button>
          ))}
          {installedIdeExtensions.map((extension) => (
            <button
              key={extension.manifest.id}
              type="button"
              className={`activity-button activity-button-extension ${activeExtensionFeatureId === extension.manifest.id ? 'active' : ''}`}
              onClick={() => openExtensionFeature(extension.manifest.id)}
              aria-label={`${extension.manifest.name} extension`}
              title={extension.manifest.name}
            >
              <Icon name={getDefaultExtensionIcon(extension)} size={16} color={activeExtensionFeatureId === extension.manifest.id ? '#7dd3fc' : '#a7f3d0'} />
            </button>
          ))}
        </div>
        <div className="activity-spacer" />
        <div className="activity-group">
          {SECONDARY_NAV.map(([id, icon, label], index) => <button key={id} type="button" className={`activity-button ${activePanel === id ? 'active' : ''}`} onClick={() => switchSidebarPanel(id as SidebarPanel)} aria-label={label} title={`${label} (Alt+${PRIMARY_NAV.length + index + 1})`}><Icon name={icon as keyof typeof icons} size={16} color={activePanel === id ? '#7dd3fc' : '#71717a'} /></button>)}
        </div>
        <button type="button" className="activity-button" onClick={() => setSidebarCollapsed((current) => !current, true)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><Icon name="panelRight" size={16} color="#71717a" /></button>
      </nav>
      {!collapsed && activePanel !== 'settings' ? (
        <aside className="sidebar">
          <header className="sidebar-header">
            <div className="sidebar-title-row">
              {activePanel !== 'workspaces' ? <span className="panel-eyebrow"><Icon name={sidebarPanelMeta.icon} size={12} color="#8fa6c4" />{sidebarPanelMeta.label}</span> : null}
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
                    aria-label="Open projects"
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
        {activePanel === 'settings' ? (
          renderSettingsWorkbench()
        ) : activePanel === 'symphony' ? (
          <SymphonyWorkspaceApp
            snapshot={activeSymphonySnapshot}
            onApproveMerge={promoteActiveMultitaskBranch}
            onManageBranch={manageActiveMultitaskBranch}
            onRequestChanges={requestActiveMultitaskChanges}
            onStartTask={startMultitaskSubagents}
            onCreateProject={createActiveMultitaskProject}
            onCreateTask={createActiveMultitaskTask}
            onSelectProject={selectActiveMultitaskProject}
            onSelectTask={selectActiveMultitaskTask}
            onStartFollowUp={startReviewFollowUp}
          />
        ) : activePanel === 'extensions' ? (
          activeExtensionFeature ? (
              <ExtensionFeaturePane
                extension={activeExtensionFeature}
                workspaceName={activeWorkspace.name}
                workspaceFiles={activeWorkspaceFiles}
                artifacts={activeArtifacts}
                artifactCount={activeArtifacts.length}
                onWorkspaceFilesChange={(files) => setWorkspaceFilesByWorkspace((current) => ({
                  ...current,
                  [activeWorkspaceId]: files,
                }))}
                onProjectArtifactSave={saveDesignStudioProjectArtifact}
              />
          ) : selectedExtension ? (
            <ExtensionDetailPage
              extension={selectedExtension}
              extensions={extensionCatalog}
              installedExtensionIds={installedDefaultExtensionIds}
              enabledExtensionIds={enabledDefaultExtensionIds}
              daemonDownload={daemonDownload}
              onInstallExtension={installDefaultExtension}
              onUninstallExtension={uninstallDefaultExtension}
              onSetExtensionEnabled={setDefaultExtensionEnabled}
              onConfigureExtension={configureDefaultExtension}
            />
          ) : (
            <MarketplacePanel
              defaultExtensions={defaultExtensionRuntime}
              installedExtensionIds={installedDefaultExtensionIds}
              enabledExtensionIds={enabledDefaultExtensionIds}
              onOpenExtensionDetail={openExtensionDetail}
              onInstallExtension={installDefaultExtension}
              onUninstallExtension={uninstallDefaultExtension}
              onSetExtensionEnabled={setDefaultExtensionEnabled}
              onConfigureExtension={configureDefaultExtension}
            />
          )
        ) : activePanel === 'wiki' ? (
          <RepoWikiWorkbench
            snapshot={activeRepoWikiSnapshot}
            activeView={repoWikiView}
            selectedPageId={repoWikiSelectedPageId}
            onViewChange={setRepoWikiView}
            onOpenPage={setRepoWikiSelectedPageId}
            onCopyCitation={copyRepoWikiCitation}
            onRememberMemory={rememberRepoWikiMemory}
            onForgetMemory={forgetRepoWikiMemory}
          />
        ) : activePanel === 'models' ? (
          <ModelCatalogPane
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
            searchQuery={registryQuery}
            loadingModelId={loadingModelId}
            onTaskChange={setRegistryTask}
            onSearch={setRegistryQuery}
            onInstall={installModel}
          />
        ) : (() => {
          const filePanelOnSave = (nextFile: WorkspaceFile, previousPath?: string) => {
            setWorkspaceFilesByWorkspace((current) => {
              const existing = current[activeWorkspaceId] ?? [];
              const previousFile = previousPath ? existing.find((file) => file.path === previousPath) : null;
              const removalBlocker = previousFile && previousPath !== nextFile.path
                ? getWorkspaceFileRemovalBlocker(previousFile)
                : null;
              if (removalBlocker) {
                setToast({ msg: removalBlocker, type: 'warning' });
                return current;
              }
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
            setWorkspaceFilesByWorkspace((current) => {
              const existing = current[activeWorkspaceId] ?? [];
              const file = existing.find((entry) => entry.path === path);
              const removalBlocker = file ? getWorkspaceFileRemovalBlocker(file) : null;
              if (removalBlocker) {
                setToast({ msg: removalBlocker, type: 'warning' });
                return current;
              }
              return { ...current, [activeWorkspaceId]: removeWorkspaceFile(existing, path) };
            });
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
          if (activeDashboardWidget) {
            panelEntries.push([
              `widget-editor:${activeWorkspaceId}:${activeDashboardWidget.id}`,
              { type: 'widget-editor', workspaceId: activeWorkspaceId, widgetId: activeDashboardWidget.id },
            ]);
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
                  knowledge={activeHarnessKnowledgeSummary}
                  onCreateDashboardWidget={createDashboardWidgetFromCanvas}
                  onOpenWidgetEditor={(widgetId) => openDashboardWidgetEditor(widgetId)}
                  onPatchElement={patchActiveHarnessElement}
                  dragHandleProps={dragHandleProps}
                />
              );
            }
            if (panel.type === 'widget-editor') {
              return (
                <HarnessWidgetEditorPanel
                  key={panel.widgetId}
                  spec={activeHarnessSpec}
                  widgetId={panel.widgetId}
                  workspaceName={activeWorkspace.name}
                  files={activeWorkspaceFiles.map((file) => ({
                    path: file.path,
                    kind: detectWorkspaceFileKind(file.path) ?? undefined,
                  }))}
                  artifactCount={activeArtifacts.length}
                  symphonyActive={activeMultitaskSubagentState.enabled}
                  onPatchElement={patchActiveHarnessElement}
                  onOpenAssistant={() => openDashboardWidgetSession(panel.widgetId)}
                  onClose={closeActiveDashboardWidgetEditor}
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
                  aiPointerSettings={aiPointerState.settings}
                  onAiPointerCapture={handleAiPointerCapture}
                  onAiPointerPrompt={handleAiPointerPromptDraft}
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
                  extensionRenderers={defaultExtensionRuntime?.renderers ?? []}
                  onSelectFile={(filePath) => openArtifactPanel(panel.artifact.id, filePath)}
                  onDownload={() => downloadArtifact(panel.artifact.id)}
                  onAttach={() => attachArtifactToSession(panel.artifact.id)}
                  onOpenSession={() => openSessionWithArtifact(panel.artifact.id)}
                  onClose={closeActiveArtifactPanel}
                  dragHandleProps={dragHandleProps}
                />
              );
            }
            const sessionNode = findNode(activeWorkspace, panel.id);
            const boundWidget = sessionNode?.boundWidgetId ? activeHarnessSpec.elements[sessionNode.boundWidgetId] : null;
            return (
              <ChatPanel
                key={panel.id}
                installedModels={installedModels}
                copilotState={copilotState}
                cursorState={cursorState}
                codexState={codexState}
                pendingSearch={pendingSearch}
                pendingSessionPrompt={pendingReviewFollowUps.find((followUp) => followUp.sessionId === panel.id)?.prompt ?? null}
                pendingAiPointerPrompt={pendingAiPointerPrompt}
                onSearchConsumed={() => setPendingSearch(null)}
                onPendingSessionPromptConsumed={(prompt) => {
                  setPendingReviewFollowUps((current) => current.filter((followUp) => (
                    followUp.sessionId !== panel.id || followUp.prompt !== prompt
                  )));
                }}
                onAiPointerPromptConsumed={() => setPendingAiPointerPrompt(null)}
                onToast={setToast}
                workspaceId={activeWorkspaceId}
                workspaceName={activeWorkspace.name}
                workspaceFiles={activeWorkspaceFiles}
                sessionSettingsContent={terminalFsFileContentsBySession[panel.id]?.[SESSION_WORKSPACE_SETTINGS_PATH] ?? null}
                artifactPromptContext={[
                  buildArtifactPromptContext(activeArtifacts, artifactContextBySession[panel.id] ?? []),
                  buildWorkspaceSurfacePromptContext(activeWorkspaceSurfaces),
                ].filter(Boolean).join('\n\n')}
                repoWikiPromptContext={activeRepoWikiPromptContext}
                runCheckpointPromptContext={activeRunCheckpointPromptContext}
                runCheckpointState={runCheckpointState}
                onRunCheckpointStateChange={setRunCheckpointState}
                sessionChapterState={sessionChapterState}
                onSessionChapterStateChange={setSessionChapterState}
                multitaskPromptContext={buildMultitaskPromptContext(multitaskSubagentState)}
                conversationBranchPromptContext={buildConversationBranchPromptContext(activeConversationBranchingState)}
                conversationBranchingState={activeConversationBranchingState}
                attachedArtifactCount={(artifactContextBySession[panel.id] ?? []).length}
                workspaceCapabilities={activeWorkspaceCapabilities}
                browserWorkflowSkills={browserWorkflowSkills}
                specDrivenDevelopmentSettings={specDrivenDevelopmentSettings}
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
                adversaryAgentSettings={adversaryAgentSettings}
                securityReviewAgentSettings={securityReviewAgentSettings}
                workspaceSkillPolicyInventory={workspaceSkillPolicyInventory}
                sharedAgentCatalog={sharedAgentCatalog}
                harnessSteeringInventory={harnessSteeringInventory}
                harnessEvolutionSettings={harnessEvolutionSettings}
                partnerAgentControlPlaneSettings={partnerAgentControlPlaneSettings}
                runtimePluginSettings={runtimePluginSettings}
                onPartnerAgentAuditEntry={setLatestPartnerAgentAuditEntry}
                secretSettings={secretSettings}
                onSessionMcpControllerChange={handleSessionMcpControllerChange}
                onSessionRuntimeChange={handleSessionRuntimeChange}
                onMultitaskRequest={startMultitaskSubagents}
                onConversationBranchRequest={startConversationBranch}
                onOpenConversationSession={openConversationSession}
                onConversationSubthreadSteering={recordConversationSubthreadSteering}
                onSessionTitleSuggestion={applyGeneratedSessionTitle}
                widgetBinding={boundWidget ? {
                  widget: boundWidget,
                  onSavePatch: patchActiveHarnessElement,
                } : null}
                dragHandleProps={dragHandleProps}
              />
            );
          };
          const renderDashboard = () => renderPanel({ type: 'dashboard', workspaceId: activeWorkspaceId });
          if (!allPanels.length) {
            return shouldRenderDashboard
              ? renderDashboard()
              : <ClosedPanelsPlaceholder workspaceName={activeWorkspace.name} onNewSession={() => addSessionToWorkspace(activeWorkspaceId)} />;
          }
          const renderWindows = () => {
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
          };
          return (
            <div className="workspace-stage">
              {shouldRenderDashboard ? (
                <div className="workspace-dashboard-base">
                  {renderDashboard()}
                </div>
              ) : null}
              <div className="workspace-window-layer">
                {renderWindows()}
              </div>
            </div>
          );
        })()}
      </main>
      {showAddFileMenu ? <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add file"><div className="modal-card compact"><div className="modal-header"><h2>Add file</h2><button type="button" className="icon-button" onClick={() => setShowAddFileMenu(null)}><Icon name="x" /></button></div><div className="add-file-form"><label className="file-editor-field"><span>Name (optional)</span><input aria-label="Capability name" value={addFileName} onChange={(event) => setAddFileName(event.target.value)} placeholder="e.g. review-pr" /></label><div className="add-file-buttons"><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('tool', showAddFileMenu)}>Tool</button><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('plugin', showAddFileMenu)}>Plugin</button><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('hook', showAddFileMenu)}>Hook</button><button type="button" className="secondary-button" onClick={() => handleAddFileToWorkspace('memory', showAddFileMenu)}>Memory</button></div></div></div></div> : null}
      {addSessionFsMenu ? <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add to session filesystem"><div className="modal-card compact"><div className="modal-header"><h2>Add to {addSessionFsMenu.basePath}</h2><button type="button" className="icon-button" onClick={() => { setAddSessionFsMenu(null); setAddSessionFsName(''); }}><Icon name="x" /></button></div><div className="add-file-form"><label className="file-editor-field"><span>Name</span><input aria-label="Entry name" value={addSessionFsName} onChange={(event) => setAddSessionFsName(event.target.value)} placeholder="e.g. notes.md" autoFocus onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void handleAddToSessionFs(addSessionFsMenu.sessionId, addSessionFsMenu.basePath, addSessionFsMenu.kind === 'folder'); } if (event.key === 'Escape') { setAddSessionFsMenu(null); setAddSessionFsName(''); } }} /></label><div className="add-file-buttons">{addSessionFsMenu.kind === 'file' ? <button type="button" className="secondary-button" onClick={() => void handleAddToSessionFs(addSessionFsMenu.sessionId, addSessionFsMenu.basePath, false)}>Create file</button> : addSessionFsMenu.kind === 'folder' ? <button type="button" className="secondary-button" onClick={() => void handleAddToSessionFs(addSessionFsMenu.sessionId, addSessionFsMenu.basePath, true)}>Create folder</button> : <><button type="button" className="secondary-button" onClick={() => void handleAddToSessionFs(addSessionFsMenu.sessionId, addSessionFsMenu.basePath, false)}>File</button><button type="button" className="secondary-button" onClick={() => void handleAddToSessionFs(addSessionFsMenu.sessionId, addSessionFsMenu.basePath, true)}>Folder</button></>}</div></div></div></div> : null}
      {showWorkspaces ? <WorkspaceSwitcherOverlay workspaces={root.children ?? []} activeWorkspaceId={activeWorkspaceId} workspaceFilesByWorkspace={workspaceFilesByWorkspace} onSwitch={switchWorkspace} onCreateWorkspace={createWorkspace} onRenameWorkspace={openRenameWorkspace} onClose={() => setShowWorkspaces(false)} /> : null}
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
