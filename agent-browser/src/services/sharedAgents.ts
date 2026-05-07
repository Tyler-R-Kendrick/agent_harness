export type SharedAgentRole = 'viewer' | 'editor' | 'publisher' | 'admin';
export type SharedAgentStatus = 'draft' | 'published' | 'deprecated';
export type SharedAgentVisibility = 'team' | 'workspace' | 'private';
export type SharedAgentSourceProvider = 'codi' | 'ghcp' | 'cursor' | 'codex' | 'specialist';
export type SharedAgentAuditAction = 'created' | 'published' | 'deprecated' | 'permission-updated';

export interface SharedAgentDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  status: SharedAgentStatus;
  owner: string;
  visibility: SharedAgentVisibility;
  allowedRoles: SharedAgentRole[];
  sourceProvider: SharedAgentSourceProvider;
  capabilities: string[];
  toolScopes: string[];
  updatedAt: string;
  publishedAt?: string | null;
}

export interface SharedAgentAuditEntry {
  id: string;
  agentId: string;
  actor: string;
  action: SharedAgentAuditAction;
  summary: string;
  createdAt: string;
}

export interface SharedAgentUsageEvent {
  id: string;
  agentId: string;
  sessionId: string;
  actor: string;
  createdAt: string;
}

export interface SharedAgentRegistryState {
  enabled: boolean;
  requirePublishApproval: boolean;
  showAuditTrail: boolean;
  trackUsageAnalytics: boolean;
  agents: SharedAgentDefinition[];
  audit: SharedAgentAuditEntry[];
  usage: SharedAgentUsageEvent[];
}

export interface SharedAgentCatalogRow {
  id: string;
  name: string;
  description: string;
  version: string;
  status: SharedAgentStatus;
  owner: string;
  visibility: SharedAgentVisibility;
  roleSummary: string;
  sourceProvider: SharedAgentSourceProvider;
  capabilitySummary: string;
  toolScopeSummary: string;
  usageCount: number;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface SharedAgentCatalog {
  enabled: boolean;
  requirePublishApproval: boolean;
  auditVisible: boolean;
  usageAnalyticsEnabled: boolean;
  publishedAgentCount: number;
  draftAgentCount: number;
  deprecatedAgentCount: number;
  totalUsageCount: number;
  rows: SharedAgentCatalogRow[];
  warnings: string[];
  latestAuditEntry: SharedAgentAuditEntry | null;
}

const SHARED_AGENT_ROLES: SharedAgentRole[] = ['viewer', 'editor', 'publisher', 'admin'];
const SHARED_AGENT_STATUSES: SharedAgentStatus[] = ['draft', 'published', 'deprecated'];
const SHARED_AGENT_VISIBILITIES: SharedAgentVisibility[] = ['team', 'workspace', 'private'];
const SHARED_AGENT_SOURCE_PROVIDERS: SharedAgentSourceProvider[] = ['codi', 'ghcp', 'cursor', 'codex', 'specialist'];
const SHARED_AGENT_AUDIT_ACTIONS: SharedAgentAuditAction[] = ['created', 'published', 'deprecated', 'permission-updated'];
const MAX_USAGE_EVENTS = 50;

export const DEFAULT_SHARED_AGENT_REGISTRY_STATE: SharedAgentRegistryState = {
  enabled: true,
  requirePublishApproval: true,
  showAuditTrail: true,
  trackUsageAnalytics: true,
  agents: [
    {
      id: 'shared-agent-team-reviewer',
      name: 'Team reviewer',
      description: 'Reusable browser review agent for PR diffs, visual evidence, and release notes.',
      version: '1.2.0',
      status: 'published',
      owner: 'Platform',
      visibility: 'team',
      allowedRoles: ['viewer', 'editor', 'publisher'],
      sourceProvider: 'specialist',
      capabilities: ['PR review', 'browser evidence', 'release summary'],
      toolScopes: ['git-worktree:read', 'browser:evidence', 'linear:comment'],
      updatedAt: '2026-05-07T12:00:00.000Z',
      publishedAt: '2026-05-07T12:00:00.000Z',
    },
    {
      id: 'shared-agent-release-coordinator',
      name: 'Release coordinator',
      description: 'Draft shared agent for coordinating verification gates and publish handoffs.',
      version: '0.1.0',
      status: 'draft',
      owner: 'Release Engineering',
      visibility: 'team',
      allowedRoles: ['publisher', 'admin'],
      sourceProvider: 'codex',
      capabilities: ['verification planning', 'PR handoff', 'status reporting'],
      toolScopes: ['github:pr', 'linear:issue', 'browser:screenshot'],
      updatedAt: '2026-05-07T12:30:00.000Z',
      publishedAt: null,
    },
  ],
  audit: [
    {
      id: 'shared-agent-team-reviewer:published:2026-05-07T12:00:00.000Z',
      agentId: 'shared-agent-team-reviewer',
      actor: 'Platform',
      action: 'published',
      summary: 'Published Team reviewer v1.2.0 for team discovery',
      createdAt: '2026-05-07T12:00:00.000Z',
    },
  ],
  usage: [
    {
      id: 'shared-agent-team-reviewer:session-review-1:2026-05-07T13:00:00.000Z',
      agentId: 'shared-agent-team-reviewer',
      sessionId: 'session-review-1',
      actor: 'Taylor User',
      createdAt: '2026-05-07T13:00:00.000Z',
    },
    {
      id: 'shared-agent-team-reviewer:session-review-2:2026-05-07T14:00:00.000Z',
      agentId: 'shared-agent-team-reviewer',
      sessionId: 'session-review-2',
      actor: 'Taylor User',
      createdAt: '2026-05-07T14:00:00.000Z',
    },
    {
      id: 'shared-agent-team-reviewer:session-review-3:2026-05-07T15:00:00.000Z',
      agentId: 'shared-agent-team-reviewer',
      sessionId: 'session-review-3',
      actor: 'Taylor User',
      createdAt: '2026-05-07T15:00:00.000Z',
    },
  ],
};

export function isSharedAgentRegistryState(value: unknown): value is SharedAgentRegistryState {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && typeof value.requirePublishApproval === 'boolean'
    && typeof value.showAuditTrail === 'boolean'
    && typeof value.trackUsageAnalytics === 'boolean'
    && Array.isArray(value.agents)
    && value.agents.every(isSharedAgentDefinition)
    && Array.isArray(value.audit)
    && value.audit.every(isSharedAgentAuditEntry)
    && Array.isArray(value.usage)
    && value.usage.every(isSharedAgentUsageEvent)
  );
}

export function buildSharedAgentCatalog(state: SharedAgentRegistryState): SharedAgentCatalog {
  const rows = state.agents.map((agent): SharedAgentCatalogRow => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    version: agent.version,
    status: agent.status,
    owner: agent.owner,
    visibility: agent.visibility,
    roleSummary: agent.allowedRoles.join(', '),
    sourceProvider: agent.sourceProvider,
    capabilitySummary: summarizeList(agent.capabilities),
    toolScopeSummary: summarizeList(agent.toolScopes),
    usageCount: state.trackUsageAnalytics
      ? state.usage.filter((event) => event.agentId === agent.id).length
      : 0,
    updatedAt: agent.updatedAt,
    publishedAt: agent.publishedAt ?? null,
  }));
  const warnings = state.agents.flatMap((agent) => buildAgentWarnings(agent));

  return {
    enabled: state.enabled,
    requirePublishApproval: state.requirePublishApproval,
    auditVisible: state.showAuditTrail,
    usageAnalyticsEnabled: state.trackUsageAnalytics,
    publishedAgentCount: state.agents.filter((agent) => agent.status === 'published').length,
    draftAgentCount: state.agents.filter((agent) => agent.status === 'draft').length,
    deprecatedAgentCount: state.agents.filter((agent) => agent.status === 'deprecated').length,
    totalUsageCount: state.trackUsageAnalytics ? state.usage.length : 0,
    rows,
    warnings,
    latestAuditEntry: state.showAuditTrail ? state.audit[0] ?? null : null,
  };
}

export function publishSharedAgentDraft(
  state: SharedAgentRegistryState,
  agentId: string,
  actor: string,
  now = new Date(),
): SharedAgentRegistryState {
  const createdAt = toIsoString(now);
  let publishedAgent: SharedAgentDefinition | null = null;
  const agents = state.agents.map((agent) => {
    if (agent.id !== agentId || agent.status !== 'draft') return { ...agent, allowedRoles: [...agent.allowedRoles], capabilities: [...agent.capabilities], toolScopes: [...agent.toolScopes] };
    publishedAgent = {
      ...agent,
      status: 'published',
      updatedAt: createdAt,
      publishedAt: createdAt,
      allowedRoles: [...agent.allowedRoles],
      capabilities: [...agent.capabilities],
      toolScopes: [...agent.toolScopes],
    };
    return publishedAgent;
  });

  if (!publishedAgent) {
    return cloneRegistryState(state);
  }

  const auditAgent = agents.find((agent) => agent.id === agentId && agent.status === 'published');
  if (!auditAgent) {
    return cloneRegistryState(state);
  }

  const auditEntry: SharedAgentAuditEntry = {
    id: `${agentId}:published:${createdAt}`,
    agentId,
    actor,
    action: 'published',
    summary: `Published ${auditAgent.name} v${auditAgent.version} for team discovery`,
    createdAt,
  };

  return {
    ...state,
    agents,
    audit: [auditEntry, ...state.audit.map((entry) => ({ ...entry }))],
    usage: state.usage.map((event) => ({ ...event })),
  };
}

export function recordSharedAgentUsage(
  state: SharedAgentRegistryState,
  agentId: string,
  sessionId: string,
  actor: string,
  now = new Date(),
): SharedAgentRegistryState {
  const createdAt = toIsoString(now);
  const usageEntry: SharedAgentUsageEvent = {
    id: `${agentId}:${sessionId}:${createdAt}`,
    agentId,
    sessionId,
    actor,
    createdAt,
  };
  return {
    ...state,
    agents: state.agents.map((agent) => ({
      ...agent,
      allowedRoles: [...agent.allowedRoles],
      capabilities: [...agent.capabilities],
      toolScopes: [...agent.toolScopes],
    })),
    audit: state.audit.map((entry) => ({ ...entry })),
    usage: [usageEntry, ...state.usage.map((event) => ({ ...event }))].slice(0, MAX_USAGE_EVENTS),
  };
}

export function buildSharedAgentPromptContext(catalog: SharedAgentCatalog): string {
  if (!catalog.enabled) return '';
  const publishedRows = catalog.rows.filter((row) => row.status === 'published');
  return [
    '## Shared Workspace Agents',
    'Shared agents: enabled',
    `Published agents: ${catalog.publishedAgentCount}`,
    `Draft agents: ${catalog.draftAgentCount}`,
    `Publish approval: ${catalog.requirePublishApproval ? 'required' : 'operator optional'}`,
    `Audit visibility: ${catalog.auditVisible ? 'visible' : 'hidden'}`,
    `Usage analytics: ${catalog.totalUsageCount} events`,
    ...publishedRows.map((row) => `${row.name} v${row.version}: ${row.status}, roles ${row.roleSummary}, tools ${row.toolScopeSummary}`),
  ].join('\n');
}

function isSharedAgentDefinition(value: unknown): value is SharedAgentDefinition {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.description === 'string'
    && typeof value.version === 'string'
    && isOneOf(value.status, SHARED_AGENT_STATUSES)
    && typeof value.owner === 'string'
    && isOneOf(value.visibility, SHARED_AGENT_VISIBILITIES)
    && Array.isArray(value.allowedRoles)
    && value.allowedRoles.length > 0
    && value.allowedRoles.every((role) => isOneOf(role, SHARED_AGENT_ROLES))
    && isOneOf(value.sourceProvider, SHARED_AGENT_SOURCE_PROVIDERS)
    && isStringArray(value.capabilities)
    && isStringArray(value.toolScopes)
    && typeof value.updatedAt === 'string'
    && (value.publishedAt === undefined || value.publishedAt === null || typeof value.publishedAt === 'string')
  );
}

function isSharedAgentAuditEntry(value: unknown): value is SharedAgentAuditEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.agentId === 'string'
    && typeof value.actor === 'string'
    && isOneOf(value.action, SHARED_AGENT_AUDIT_ACTIONS)
    && typeof value.summary === 'string'
    && typeof value.createdAt === 'string'
  );
}

function isSharedAgentUsageEvent(value: unknown): value is SharedAgentUsageEvent {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.agentId === 'string'
    && typeof value.sessionId === 'string'
    && typeof value.actor === 'string'
    && typeof value.createdAt === 'string'
  );
}

function buildAgentWarnings(agent: SharedAgentDefinition): string[] {
  const warnings: string[] = [];
  if (agent.status === 'published' && !agent.allowedRoles.includes('viewer')) {
    warnings.push(`${agent.name} is published without viewer discovery access.`);
  }
  if (agent.status === 'published' && !agent.toolScopes.length) {
    warnings.push(`${agent.name} is published without scoped tools.`);
  }
  return warnings;
}

function summarizeList(entries: string[]): string {
  return entries.join(', ') || 'none';
}

function cloneRegistryState(state: SharedAgentRegistryState): SharedAgentRegistryState {
  return {
    ...state,
    agents: state.agents.map((agent) => ({
      ...agent,
      allowedRoles: [...agent.allowedRoles],
      capabilities: [...agent.capabilities],
      toolScopes: [...agent.toolScopes],
    })),
    audit: state.audit.map((entry) => ({ ...entry })),
    usage: state.usage.map((event) => ({ ...event })),
  };
}

function toIsoString(value: Date): string {
  return Number.isNaN(value.getTime()) ? new Date(0).toISOString() : value.toISOString();
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isOneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === 'string' && (choices as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
