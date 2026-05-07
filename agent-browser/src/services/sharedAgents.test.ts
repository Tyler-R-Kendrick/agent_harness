import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHARED_AGENT_REGISTRY_STATE,
  buildSharedAgentCatalog,
  buildSharedAgentPromptContext,
  isSharedAgentRegistryState,
  publishSharedAgentDraft,
  recordSharedAgentUsage,
  type SharedAgentRegistryState,
} from './sharedAgents';

describe('sharedAgents', () => {
  it('derives a discoverable governed catalog from published and draft agents', () => {
    const catalog = buildSharedAgentCatalog(DEFAULT_SHARED_AGENT_REGISTRY_STATE);

    expect(catalog.enabled).toBe(true);
    expect(catalog.publishedAgentCount).toBe(1);
    expect(catalog.draftAgentCount).toBe(1);
    expect(catalog.totalUsageCount).toBe(3);
    expect(catalog.auditVisible).toBe(true);
    expect(catalog.rows.map((row) => row.name)).toEqual([
      'Team reviewer',
      'Release coordinator',
    ]);
    expect(catalog.rows[0]).toMatchObject({
      status: 'published',
      visibility: 'team',
      roleSummary: 'viewer, editor, publisher',
      usageCount: 3,
    });
  });

  it('accepts only well-formed registry states and known RBAC roles', () => {
    expect(isSharedAgentRegistryState(DEFAULT_SHARED_AGENT_REGISTRY_STATE)).toBe(true);
    expect(isSharedAgentRegistryState({
      ...DEFAULT_SHARED_AGENT_REGISTRY_STATE,
      agents: [
        {
          ...DEFAULT_SHARED_AGENT_REGISTRY_STATE.agents[0],
          allowedRoles: ['viewer', 'owner'],
        },
      ],
    })).toBe(false);
    expect(isSharedAgentRegistryState({
      ...DEFAULT_SHARED_AGENT_REGISTRY_STATE,
      audit: [{ action: 'published' }],
    })).toBe(false);
  });

  it('publishes a draft agent with an audit entry and keeps existing agents immutable', () => {
    const before = DEFAULT_SHARED_AGENT_REGISTRY_STATE;
    const after = publishSharedAgentDraft(
      before,
      'shared-agent-release-coordinator',
      'Taylor Admin',
      new Date('2026-05-07T17:00:00.000Z'),
    );

    expect(before.agents.find((agent) => agent.id === 'shared-agent-release-coordinator')?.status).toBe('draft');
    expect(after.agents.find((agent) => agent.id === 'shared-agent-release-coordinator')).toMatchObject({
      status: 'published',
      publishedAt: '2026-05-07T17:00:00.000Z',
    });
    expect(after.audit[0]).toMatchObject({
      id: 'shared-agent-release-coordinator:published:2026-05-07T17:00:00.000Z',
      agentId: 'shared-agent-release-coordinator',
      actor: 'Taylor Admin',
      action: 'published',
      summary: 'Published Release coordinator v0.1.0 for team discovery',
    });
  });

  it('records bounded usage analytics without mutating the registry', () => {
    let state: SharedAgentRegistryState = {
      ...DEFAULT_SHARED_AGENT_REGISTRY_STATE,
      usage: [],
    };

    for (let index = 0; index < 53; index += 1) {
      state = recordSharedAgentUsage(
        state,
        'shared-agent-team-reviewer',
        `session-${index}`,
        'Taylor User',
        new Date(Date.UTC(2026, 4, 7, 18, index, 0)),
      );
    }

    expect(state.usage).toHaveLength(50);
    expect(state.usage[0]).toMatchObject({
      id: 'shared-agent-team-reviewer:session-52:2026-05-07T18:52:00.000Z',
      sessionId: 'session-52',
    });
    expect(state.usage.at(-1)?.sessionId).toBe('session-3');
    expect(DEFAULT_SHARED_AGENT_REGISTRY_STATE.usage).toHaveLength(3);
  });

  it('renders prompt context only when shared-agent governance is enabled', () => {
    const catalog = buildSharedAgentCatalog(DEFAULT_SHARED_AGENT_REGISTRY_STATE);
    const context = buildSharedAgentPromptContext(catalog);

    expect(context).toContain('## Shared Workspace Agents');
    expect(context).toContain('Shared agents: enabled');
    expect(context).toContain('Published agents: 1');
    expect(context).toContain('Team reviewer v1.2.0: published, roles viewer, editor, publisher');
    expect(context).toContain('Audit visibility: visible');
    expect(context).toContain('Usage analytics: 3 events');

    expect(buildSharedAgentPromptContext({
      ...catalog,
      enabled: false,
    })).toBe('');
  });
});
