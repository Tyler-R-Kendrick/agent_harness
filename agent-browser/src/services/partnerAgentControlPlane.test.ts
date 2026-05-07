import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARTNER_AGENT_CONTROL_PLANE_SETTINGS,
  buildPartnerAgentControlPlane,
  buildPartnerAgentPromptContext,
  createPartnerAgentAuditEntry,
  isPartnerAgentControlPlaneSettings,
  type PartnerAgentControlPlaneSettings,
} from './partnerAgentControlPlane';

describe('partnerAgentControlPlane', () => {
  it('derives ready partner agents and stable provider model refs', () => {
    const plane = buildPartnerAgentControlPlane({
      settings: DEFAULT_PARTNER_AGENT_CONTROL_PLANE_SETTINGS,
      installedModels: [{ id: 'local-qwen', name: 'Local Qwen', status: 'installed' }],
      copilotState: { authenticated: true, models: [{ id: 'gpt-4.1', name: 'GPT-4.1' }] },
      cursorState: { authenticated: true, models: [{ id: 'composer-2', name: 'Composer 2' }] },
      codexState: { authenticated: true, models: [{ id: 'codex-default', name: 'Codex default' }] },
      selectedProvider: 'planner',
      runtimeProvider: 'ghcp',
      selectedModelRef: 'ghcp:gpt-4.1',
      selectedToolIds: ['read-file', 'write-file'],
    });

    expect(plane.readyAgentCount).toBeGreaterThanOrEqual(7);
    expect(plane.agentRows.find((row) => row.provider === 'codi')).toMatchObject({
      ready: true,
      modelCount: 1,
    });
    expect(plane.agentRows.find((row) => row.provider === 'planner')).toMatchObject({
      ready: true,
      runtimeProvider: 'ghcp',
    });
    expect(plane.agentRows.find((row) => row.provider === 'security')).toMatchObject({
      label: 'Security Review',
      kind: 'specialist',
      ready: true,
    });
    expect(plane.agentRows.find((row) => row.provider === 'steering')).toMatchObject({
      label: 'Steering',
      kind: 'specialist',
      runtimeProvider: 'ghcp',
      ready: true,
    });
    expect(plane.modelOptions.map((option) => option.ref)).toContain('codi:local-qwen');
    expect(plane.modelOptions.map((option) => option.ref)).toContain('ghcp:gpt-4.1');
    expect(plane.modelOptions.map((option) => option.ref)).toContain('cursor:composer-2');
    expect(plane.modelOptions.map((option) => option.ref)).toContain('codex:codex-default');
  });

  it('renders policy and audit prompt context without backend-specific fragmentation', () => {
    const plane = buildPartnerAgentControlPlane({
      settings: {
        enabled: true,
        requirePolicyReview: true,
        preserveEvidence: true,
        auditLevel: 'strict',
      },
      installedModels: [],
      copilotState: { authenticated: true, models: [{ id: 'gpt-4.1', name: 'GPT-4.1' }] },
      cursorState: { authenticated: false, models: [] },
      codexState: { authenticated: true, models: [{ id: 'codex-default', name: 'Codex default' }] },
      selectedProvider: 'codex',
      runtimeProvider: 'codex',
      selectedModelRef: 'codex:codex-default',
      selectedToolIds: [],
    });
    const audit = createPartnerAgentAuditEntry({ controlPlane: plane, sessionId: 'session-1' });
    const context = buildPartnerAgentPromptContext(plane, audit);

    expect(context).toContain('Partner agent control plane: enabled');
    expect(context).toContain('Policy review: required');
    expect(context).toContain('Selected model ref: codex:codex-default');
    expect(context).toContain('Unified workflow: issue, diff, review, browser evidence, and AgentBus traces stay attached to one session.');
    expect(audit.modelRef).toBe('codex:codex-default');
    expect(audit.sessionId).toBe('session-1');
  });

  it('accepts only valid settings payloads', () => {
    expect(isPartnerAgentControlPlaneSettings(DEFAULT_PARTNER_AGENT_CONTROL_PLANE_SETTINGS)).toBe(true);
    expect(isPartnerAgentControlPlaneSettings({
      enabled: true,
      requirePolicyReview: true,
      preserveEvidence: true,
      auditLevel: 'noisy',
    })).toBe(false);
    expect(isPartnerAgentControlPlaneSettings({
      enabled: true,
      requirePolicyReview: true,
      auditLevel: 'standard',
    })).toBe(false);
  });

  it('omits prompt context when the control plane is disabled', () => {
    const plane = buildPartnerAgentControlPlane({
      settings: {
        ...DEFAULT_PARTNER_AGENT_CONTROL_PLANE_SETTINGS,
        enabled: false,
      },
      installedModels: [],
      copilotState: { authenticated: false, models: [] },
      cursorState: { authenticated: false, models: [] },
      codexState: { authenticated: false, models: [] },
      selectedProvider: 'codi',
      runtimeProvider: 'codi',
      selectedModelRef: '',
      selectedToolIds: [],
    });

    expect(buildPartnerAgentPromptContext(plane)).toBe('');
  });

  it('keeps control-plane settings snapshots isolated from callers and defaults', () => {
    const customSettings: PartnerAgentControlPlaneSettings = {
      ...DEFAULT_PARTNER_AGENT_CONTROL_PLANE_SETTINGS,
      auditLevel: 'strict',
    };
    const customPlane = buildPartnerAgentControlPlane({
      settings: customSettings,
      installedModels: [],
      copilotState: { authenticated: false, models: [] },
      cursorState: { authenticated: false, models: [] },
      codexState: { authenticated: false, models: [] },
      selectedProvider: 'codi',
      runtimeProvider: 'codi',
      selectedModelRef: '',
      selectedToolIds: [],
    });

    customSettings.auditLevel = 'minimal';
    expect(customPlane.settings.auditLevel).toBe('strict');

    const defaultPlane = buildPartnerAgentControlPlane({
      installedModels: [],
      copilotState: { authenticated: false, models: [] },
      cursorState: { authenticated: false, models: [] },
      codexState: { authenticated: false, models: [] },
      selectedProvider: 'codi',
      runtimeProvider: 'codi',
      selectedModelRef: '',
      selectedToolIds: [],
    });

    defaultPlane.settings.enabled = false;
    const nextDefaultPlane = buildPartnerAgentControlPlane({
      installedModels: [],
      copilotState: { authenticated: false, models: [] },
      cursorState: { authenticated: false, models: [] },
      codexState: { authenticated: false, models: [] },
      selectedProvider: 'codi',
      runtimeProvider: 'codi',
      selectedModelRef: '',
      selectedToolIds: [],
    });

    expect(DEFAULT_PARTNER_AGENT_CONTROL_PLANE_SETTINGS.enabled).toBe(true);
    expect(nextDefaultPlane.settings.enabled).toBe(true);
  });
});
