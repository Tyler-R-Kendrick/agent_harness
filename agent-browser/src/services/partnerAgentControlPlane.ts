import type { AgentProvider, ModelBackedAgentProvider } from '../chat-agents/types';

export type PartnerAgentAuditLevel = 'minimal' | 'standard' | 'strict';

export interface PartnerAgentControlPlaneSettings {
  enabled: boolean;
  requirePolicyReview: boolean;
  preserveEvidence: boolean;
  auditLevel: PartnerAgentAuditLevel;
}

export interface PartnerAgentModelOption {
  ref: string;
  provider: ModelBackedAgentProvider;
  modelId: string;
  label: string;
}

export interface PartnerAgentRow {
  provider: AgentProvider;
  label: string;
  kind: 'local' | 'partner' | 'specialist';
  ready: boolean;
  modelCount: number;
  runtimeProvider?: ModelBackedAgentProvider;
  summary: string;
}

export interface PartnerAgentControlPlane {
  settings: PartnerAgentControlPlaneSettings;
  agentRows: PartnerAgentRow[];
  modelOptions: PartnerAgentModelOption[];
  readyAgentCount: number;
  selectedProvider: AgentProvider;
  runtimeProvider: ModelBackedAgentProvider;
  selectedModelRef: string;
  selectedToolIds: string[];
}

export interface PartnerAgentAuditEntry {
  id: string;
  createdAt: string;
  sessionId: string;
  provider: AgentProvider;
  runtimeProvider: ModelBackedAgentProvider;
  modelRef: string;
  toolIds: string[];
  policy: {
    requirePolicyReview: boolean;
    preserveEvidence: boolean;
    auditLevel: PartnerAgentAuditLevel;
  };
}

type RuntimeModelSummary = {
  id: string;
  name?: string;
};

type RuntimeStateSummary = {
  authenticated: boolean;
  models: RuntimeModelSummary[];
};

type LocalModelSummary = {
  id: string;
  name?: string;
  status?: string;
};

export type BuildPartnerAgentControlPlaneInput = {
  settings?: PartnerAgentControlPlaneSettings;
  installedModels: LocalModelSummary[];
  copilotState: RuntimeStateSummary;
  cursorState: RuntimeStateSummary;
  codexState: RuntimeStateSummary;
  selectedProvider: AgentProvider;
  runtimeProvider: ModelBackedAgentProvider;
  selectedModelRef: string;
  selectedToolIds: string[];
};

export const DEFAULT_PARTNER_AGENT_CONTROL_PLANE_SETTINGS: PartnerAgentControlPlaneSettings = {
  enabled: true,
  requirePolicyReview: true,
  preserveEvidence: true,
  auditLevel: 'standard',
};

const AUDIT_LEVELS: PartnerAgentAuditLevel[] = ['minimal', 'standard', 'strict'];

export function isPartnerAgentControlPlaneSettings(value: unknown): value is PartnerAgentControlPlaneSettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && typeof value.requirePolicyReview === 'boolean'
    && typeof value.preserveEvidence === 'boolean'
    && typeof value.auditLevel === 'string'
    && (AUDIT_LEVELS as string[]).includes(value.auditLevel)
  );
}

export function buildPartnerAgentControlPlane(
  input: BuildPartnerAgentControlPlaneInput,
): PartnerAgentControlPlane {
  const settings = { ...(input.settings ?? DEFAULT_PARTNER_AGENT_CONTROL_PLANE_SETTINGS) };
  const localModels = input.installedModels.filter((model) => model.status === undefined || model.status === 'installed');
  const modelOptions = [
    ...toModelOptions('codi', localModels),
    ...toModelOptions('ghcp', input.copilotState.models),
    ...toModelOptions('cursor', input.cursorState.models),
    ...toModelOptions('codex', input.codexState.models),
  ];
  const codiReady = localModels.length > 0;
  const ghcpReady = input.copilotState.authenticated && input.copilotState.models.length > 0;
  const cursorReady = input.cursorState.authenticated && input.cursorState.models.length > 0;
  const codexReady = input.codexState.authenticated && input.codexState.models.length > 0;
  const specialistReady = ghcpReady || cursorReady || codiReady;
  const agentRows: PartnerAgentRow[] = [
    {
      provider: 'codi',
      label: 'Codi',
      kind: 'local',
      ready: codiReady,
      modelCount: localModels.length,
      summary: codiReady ? `${localModels.length} browser-local model${plural(localModels.length)}` : 'Install a local browser model',
    },
    {
      provider: 'ghcp',
      label: 'GitHub Copilot',
      kind: 'partner',
      ready: ghcpReady,
      modelCount: input.copilotState.models.length,
      summary: summarizePartnerState(input.copilotState, 'GitHub Copilot'),
    },
    {
      provider: 'cursor',
      label: 'Cursor',
      kind: 'partner',
      ready: cursorReady,
      modelCount: input.cursorState.models.length,
      summary: summarizePartnerState(input.cursorState, 'Cursor'),
    },
    {
      provider: 'codex',
      label: 'Codex',
      kind: 'partner',
      ready: codexReady,
      modelCount: input.codexState.models.length,
      summary: summarizePartnerState(input.codexState, 'Codex'),
    },
    ...(['researcher', 'debugger', 'planner', 'security', 'steering', 'adversary'] as const).map((provider): PartnerAgentRow => ({
      provider,
      label: labelForProvider(provider),
      kind: 'specialist',
      ready: specialistReady,
      runtimeProvider: input.runtimeProvider,
      modelCount: modelOptions.filter((option) => option.provider === input.runtimeProvider).length,
      summary: specialistReady
        ? `Routes through ${labelForProvider(input.runtimeProvider)} under shared policy`
        : 'Needs GHCP, Cursor, or local Codi readiness',
    })),
  ];

  return {
    settings,
    agentRows,
    modelOptions,
    readyAgentCount: agentRows.filter((row) => row.ready).length,
    selectedProvider: input.selectedProvider,
    runtimeProvider: input.runtimeProvider,
    selectedModelRef: input.selectedModelRef,
    selectedToolIds: [...input.selectedToolIds],
  };
}

export function createPartnerAgentAuditEntry({
  controlPlane,
  sessionId,
  now = new Date(),
}: {
  controlPlane: PartnerAgentControlPlane;
  sessionId: string;
  now?: Date;
}): PartnerAgentAuditEntry {
  const createdAt = Number.isNaN(now.getTime()) ? new Date(0).toISOString() : now.toISOString();
  return {
    id: `${sessionId}:${createdAt}:${controlPlane.selectedProvider}`,
    createdAt,
    sessionId,
    provider: controlPlane.selectedProvider,
    runtimeProvider: controlPlane.runtimeProvider,
    modelRef: controlPlane.selectedModelRef,
    toolIds: [...controlPlane.selectedToolIds],
    policy: {
      requirePolicyReview: controlPlane.settings.requirePolicyReview,
      preserveEvidence: controlPlane.settings.preserveEvidence,
      auditLevel: controlPlane.settings.auditLevel,
    },
  };
}

export function buildPartnerAgentPromptContext(
  controlPlane: PartnerAgentControlPlane,
  auditEntry?: PartnerAgentAuditEntry,
): string {
  if (!controlPlane.settings.enabled) return '';
  const lines = [
    '## Partner Agent Control Plane',
    'Partner agent control plane: enabled',
    `Selected provider: ${controlPlane.selectedProvider}`,
    `Runtime provider: ${controlPlane.runtimeProvider}`,
    `Selected model ref: ${controlPlane.selectedModelRef || 'unselected'}`,
    `Ready agents: ${controlPlane.readyAgentCount}/${controlPlane.agentRows.length}`,
    `Selected tools: ${controlPlane.selectedToolIds.length}`,
    `Policy review: ${controlPlane.settings.requirePolicyReview ? 'required' : 'operator optional'}`,
    `Evidence preservation: ${controlPlane.settings.preserveEvidence ? 'required' : 'best effort'}`,
    `Audit level: ${controlPlane.settings.auditLevel}`,
    'Unified workflow: issue, diff, review, browser evidence, and AgentBus traces stay attached to one session.',
  ];
  if (auditEntry) {
    lines.push(
      `Audit entry: ${auditEntry.id}`,
      `Audit session: ${auditEntry.sessionId}`,
      `Audit model ref: ${auditEntry.modelRef || 'unselected'}`,
    );
  }
  return lines.join('\n');
}

function toModelOptions(
  provider: ModelBackedAgentProvider,
  models: RuntimeModelSummary[],
): PartnerAgentModelOption[] {
  return models.map((model) => ({
    ref: `${provider}:${model.id}`,
    provider,
    modelId: model.id,
    label: model.name?.trim() || model.id,
  }));
}

function summarizePartnerState(state: RuntimeStateSummary, label: string): string {
  if (state.authenticated && state.models.length > 0) {
    return `${state.models.length} ${label} model${plural(state.models.length)} ready`;
  }
  return state.authenticated ? `${label} signed in without enabled models` : `${label} sign-in required`;
}

function labelForProvider(provider: AgentProvider | ModelBackedAgentProvider): string {
  switch (provider) {
    case 'codi':
      return 'Codi';
    case 'ghcp':
      return 'GitHub Copilot';
    case 'cursor':
      return 'Cursor';
    case 'codex':
      return 'Codex';
    case 'researcher':
      return 'Researcher';
    case 'debugger':
      return 'Debugger';
    case 'planner':
      return 'Planner';
    case 'security':
      return 'Security Review';
    case 'steering':
      return 'Steering';
    case 'adversary':
      return 'Adversary';
    case 'media':
      return 'Media';
    case 'swarm':
      return 'Swarm';
    case 'tour-guide':
      return 'Tour Guide';
  }
}

function plural(count: number): string {
  return count === 1 ? '' : 's';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
