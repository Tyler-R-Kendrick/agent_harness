// Centralized session-bound persistence for agent-browser app state.
//
// Two backends:
//   - localStorage  → durable across tabs/restart (heavy, long-lived data)
//   - sessionStorage → per-tab, survives refresh only (transient UI state)
//
// All loaders are total: invalid/missing/corrupted payloads degrade to the
// caller-supplied fallback rather than throwing, so a bad write can never
// crash the app on next mount.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkspaceViewState } from './workspaceTree';
import { assertHarnessElementAllowedByCatalog } from '../features/harness-ui/harnessCatalog';
import type { HarnessAppSpec, HarnessElement } from '../features/harness-ui/types';
import type { ChatMessage, NodeKind, NodeType, TreeNode } from '../types';
import { isArtifactPanelSelection } from './artifacts';

export {
  isArtifactContextBySession,
  isArtifactsByWorkspace,
} from './artifacts';

export const STORAGE_KEYS = {
  // localStorage — durable
  installedModels: 'agent-browser.installed-models',
  workspaceRoot: 'agent-browser.workspace-root',
  workspaceViewStateByWorkspace: 'agent-browser.workspace-view-state-by-workspace',
  chatMessagesBySession: 'agent-browser.chat-messages-by-session',
  chatHistoryBySession: 'agent-browser.chat-history-by-session',
  artifactsByWorkspace: 'agent-browser.artifacts-by-workspace',
  artifactContextBySession: 'agent-browser.artifact-context-by-session',
  harnessSpecsByWorkspace: 'agent-browser.harness-specs-by-workspace',
  browserNotificationSettings: 'agent-browser.browser-notification-settings',
  benchmarkModelRoutingSettings: 'agent-browser.benchmark-model-routing-settings',
  benchmarkEvidenceState: 'agent-browser.benchmark-evidence-state',
  adversaryToolReviewSettings: 'agent-browser.adversary-tool-review-settings',
  adversaryAgentSettings: 'agent-browser.adversary-agent-settings',
  securityReviewAgentSettings: 'agent-browser.security-review-agent-settings',
  scheduledAutomationsState: 'agent-browser.scheduled-automations-state',
  runCheckpointState: 'agent-browser.run-checkpoint-state',
  conversationBranchingState: 'agent-browser.conversation-branching-state',
  harnessSteeringState: 'agent-browser.harness-steering-state',
  workspaceSkillPolicyState: 'agent-browser.workspace-skill-policy-state',
  browserAgentRunSdkState: 'agent-browser.browser-agent-run-sdk-state',
  multitaskSubagentState: 'agent-browser.multitask-subagent-state',
  sharedSessionControlState: 'agent-browser.shared-session-control-state',
  sharedAgentRegistryState: 'agent-browser.shared-agent-registry-state',
  partnerAgentControlPlaneSettings: 'agent-browser.partner-agent-control-plane-settings',
  runtimePluginSettings: 'agent-browser.runtime-plugin-settings',
  harnessEvolutionSettings: 'agent-browser.harness-evolution-settings',
  persistentMemoryGraphState: 'agent-browser.persistent-memory-graph-state',
  specDrivenDevelopmentSettings: 'agent-browser.spec-driven-development-settings',
  repoWikiSnapshotsByWorkspace: 'agent-browser.repo-wiki-snapshots-by-workspace',
  locationContext: 'agent-browser.location-context',
  secretManagementSettings: 'agent-browser.secret-management-settings',
  installedDefaultExtensionIds: 'agent-browser.installed-default-extension-ids',
  defaultExtensionOpenFeatureFlags: 'agent-browser.default-extension-openfeature-flags',
  defaultExtensionConfigurationById: 'agent-browser.default-extension-configuration-by-id',
  // sessionStorage — per-tab, refresh-only
  selectedProviderBySession: 'agent-browser.session.selected-provider-by-session',
  selectedCodiModelBySession: 'agent-browser.session.selected-codi-model-by-session',
  selectedCopilotModelBySession: 'agent-browser.session.selected-copilot-model-by-session',
  selectedCursorModelBySession: 'agent-browser.session.selected-cursor-model-by-session',
  selectedCodexModelBySession: 'agent-browser.session.selected-codex-model-by-session',
  activeWorkspaceId: 'agent-browser.session.active-workspace-id',
  activePanel: 'agent-browser.session.active-panel',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export type StorageBackend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type Validator<T> = (value: unknown) => value is T;

export type SaveErrorHandler = (error: Error) => void;

const DEFAULT_DEBOUNCE_MS = 120;

export function loadJson<T>(
  backend: StorageBackend,
  key: string,
  validate: Validator<T>,
  fallback: T,
): T {
  let raw: string | null;
  try {
    raw = backend.getItem(key);
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }

  return validate(parsed) ? parsed : fallback;
}

export function saveJson<T>(
  backend: StorageBackend,
  key: string,
  value: T,
  onError?: SaveErrorHandler,
): void {
  try {
    backend.setItem(key, JSON.stringify(value));
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

export function removeStoredRecordEntry<T extends Record<string, unknown>>(
  backend: StorageBackend | null | undefined,
  key: string,
  validate: Validator<T>,
  entryId: string,
  onError?: SaveErrorHandler,
): void {
  if (!backend) return;
  const current = loadJson<T>(backend, key, validate, {} as T);
  if (!Object.prototype.hasOwnProperty.call(current, entryId)) return;
  const next = { ...current };
  delete next[entryId];
  saveJson(backend, key, next, onError);
}

export type UseStoredStateOptions = {
  /** Debounce window before persisting changes. Defaults to 120ms. */
  debounceMs?: number;
  /** Invoked when a write to storage fails (e.g. quota exceeded). */
  onError?: SaveErrorHandler;
};

/**
 * Drop-in replacement for `useState<T>` that hydrates from `backend[key]`
 * on first mount and writes subsequent values back (debounced).
 */
export function useStoredState<T>(
  backend: StorageBackend | null | undefined,
  key: string,
  validate: Validator<T>,
  fallback: T,
  options: UseStoredStateOptions = {},
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, onError } = options;

  const [value, setValue] = useState<T>(() =>
    backend ? loadJson(backend, key, validate, fallback) : fallback,
  );

  // Skip the very first effect so we don't re-write the value we just hydrated.
  const hydrated = useRef(false);

  const onErrorRef = useRef<SaveErrorHandler | undefined>(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!backend) return;
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    const handle = setTimeout(() => {
      saveJson(backend, key, value, onErrorRef.current);
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [backend, key, value, debounceMs]);

  // Stable setter identity for callers passing it down as a prop.
  const stableSetValue = useCallback<React.Dispatch<React.SetStateAction<T>>>(
    (next) => setValue(next),
    [],
  );

  return [value, stableSetValue];
}

// ── Common validators ────────────────────────────────────────────────────────

export const isString = (value: unknown): value is string => typeof value === 'string';

const NODE_TYPES: NodeType[] = ['root', 'workspace', 'folder', 'tab', 'file'];
const NODE_KINDS: NodeKind[] = ['browser', 'terminal', 'agent', 'files', 'session', 'clipboard'];
const MESSAGE_ROLES: ChatMessage['role'][] = ['user', 'assistant', 'system'];
const MESSAGE_STATUSES: NonNullable<ChatMessage['status']>[] = ['thinking', 'streaming', 'complete', 'error'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): boolean {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean';
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === 'number';
}

export function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value)
    && Object.values(value as Record<string, unknown>).every((entry) => typeof entry === 'string')
  );
}

export function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return (
    isRecord(value)
    && Object.values(value as Record<string, unknown>).every((entry) => typeof entry === 'boolean')
  );
}

export function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

export function isStringArrayRecord(value: unknown): value is Record<string, string[]> {
  return isRecord(value) && Object.values(value).every(isStringArray);
}

export function isTreeNode(value: unknown): value is TreeNode {
  if (!isRecord(value)) return false;
  const node = value as Partial<TreeNode>;
  return (
    typeof node.id === 'string'
    && typeof node.name === 'string'
    && typeof node.type === 'string'
    && (NODE_TYPES as string[]).includes(node.type)
    && (node.nodeKind === undefined || (
      typeof node.nodeKind === 'string'
      && (NODE_KINDS as string[]).includes(node.nodeKind)
    ))
    && isOptionalBoolean(node.isDrive)
    && isOptionalBoolean(node.expanded)
    && isOptionalBoolean(node.persisted)
    && isOptionalBoolean(node.activeMemory)
    && isOptionalNumber(node.memoryMB)
    && isOptionalString(node.memoryTier)
    && isOptionalString(node.url)
    && isOptionalString(node.color)
    && isOptionalString(node.filePath)
    && isOptionalBoolean(node.isReference)
    && isOptionalString(node.artifactId)
    && isOptionalString(node.artifactFilePath)
    && isOptionalString(node.artifactReferenceId)
    && isOptionalBoolean(node.muted)
    && (node.children === undefined || (Array.isArray(node.children) && node.children.every(isTreeNode)))
  );
}

function isWorkspaceViewState(value: unknown): value is WorkspaceViewState {
  if (!isRecord(value)) return false;
  return (
    isStringArray(value.openTabIds)
    && (value.editingFilePath === null || typeof value.editingFilePath === 'string')
    && (value.dashboardOpen === undefined || typeof value.dashboardOpen === 'boolean')
    && (value.activeMode === 'agent' || value.activeMode === 'terminal')
    && isStringArray(value.activeSessionIds)
    && isStringArray(value.mountedSessionFsIds)
    && isStringArray(value.panelOrder)
    && (value.activeArtifactPanel === undefined || value.activeArtifactPanel === null || isArtifactPanelSelection(value.activeArtifactPanel))
  );
}

export function isWorkspaceViewStateRecord(value: unknown): value is Record<string, WorkspaceViewState> {
  return isRecord(value) && Object.values(value).every(isWorkspaceViewState);
}

function isHarnessElement(value: unknown, key: string): value is HarnessElement {
  if (!isRecord(value)) return false;
  if (value.id !== key || typeof value.type !== 'string') return false;
  if (value.props !== undefined && (!isRecord(value.props) || !Object.values(value.props).every(isJsonValue))) {
    return false;
  }
  if (value.children !== undefined && !isStringArray(value.children)) return false;
  if (value.slot !== undefined && typeof value.slot !== 'string') return false;
  if (value.editable !== undefined && typeof value.editable !== 'boolean') return false;

  try {
    assertHarnessElementAllowedByCatalog(value as HarnessElement);
  } catch {
    return false;
  }
  return true;
}

function isHarnessAppSpec(value: unknown): value is HarnessAppSpec {
  if (!isRecord(value)) return false;
  if (value.version !== 'harness-ui/v1' || typeof value.root !== 'string' || !isRecord(value.elements)) {
    return false;
  }
  if (!isRecord(value.metadata)) return false;
  const metadata = value.metadata;
  if (
    typeof metadata.workspaceId !== 'string'
    || typeof metadata.workspaceName !== 'string'
    || metadata.createdBy !== 'agent-browser'
    || metadata.designSystemId !== 'agent-browser/current'
    || typeof metadata.revision !== 'number'
    || !Number.isInteger(metadata.revision)
    || metadata.revision < 1
  ) {
    return false;
  }
  if (!Object.prototype.hasOwnProperty.call(value.elements, value.root)) {
    return false;
  }
  return Object.entries(value.elements).every(([key, element]) => isHarnessElement(element, key));
}

export function isHarnessAppSpecRecord(value: unknown): value is Record<string, HarnessAppSpec> {
  return isRecord(value) && Object.values(value).every(isHarnessAppSpec);
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.role === 'string'
    && (MESSAGE_ROLES as string[]).includes(value.role)
    && typeof value.content === 'string'
    && isOptionalString(value.streamedContent)
    && (value.status === undefined || (
      typeof value.status === 'string'
      && (MESSAGE_STATUSES as string[]).includes(value.status)
    ))
    && isOptionalBoolean(value.isLocal)
    && isOptionalString(value.thinkingContent)
    && isOptionalNumber(value.thinkingDuration)
    && isOptionalBoolean(value.isThinking)
    && isOptionalString(value.currentStepId)
    && isOptionalNumber(value.reasoningStartedAt)
    && (value.loadingStatus === undefined || value.loadingStatus === null || typeof value.loadingStatus === 'string')
    && (value.statusText === undefined || value.statusText === null || typeof value.statusText === 'string')
    && isOptionalBoolean(value.isError)
    && isOptionalBoolean(value.isVoting)
  );
}

export function isChatMessagesBySession(value: unknown): value is Record<string, ChatMessage[]> {
  return isRecord(value)
    && Object.values(value).every((entry) => Array.isArray(entry) && entry.every(isChatMessage));
}
