import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AGENT_SWARM_SETTINGS,
  buildAgentSwarmPlan,
  buildAgentSwarmPromptContext,
  isAgentSwarmSettings,
} from './agentSwarms';

describe('agentSwarms', () => {
  it('validates persisted swarm settings and rejects invalid shapes', () => {
    expect(isAgentSwarmSettings(DEFAULT_AGENT_SWARM_SETTINGS)).toBe(true);
    expect(isAgentSwarmSettings({
      ...DEFAULT_AGENT_SWARM_SETTINGS,
      mode: 'many',
    })).toBe(false);
    expect(isAgentSwarmSettings({
      ...DEFAULT_AGENT_SWARM_SETTINGS,
      selectedTemplateId: 'unknown',
    })).toBe(false);
    expect(isAgentSwarmSettings({
      ...DEFAULT_AGENT_SWARM_SETTINGS,
      maxAgents: 0,
    })).toBe(false);
  });

  it('builds a 16-agent expanded swarm plan with deterministic specialist roles', () => {
    const plan = buildAgentSwarmPlan({
      settings: {
        ...DEFAULT_AGENT_SWARM_SETTINGS,
        mode: 'expanded',
        selectedTemplateId: 'asset-production',
        maxAgents: 24,
      },
      request: 'produce the launch asset package with implementation, QA, and release notes',
    });

    expect(plan.enabled).toBe(true);
    expect(plan.agentCount).toBe(16);
    expect(plan.template.name).toBe('Asset production squad');
    expect(plan.roles.map((role) => role.name)).toEqual([
      'Producer',
      'Design agent',
      'Implementation agent',
      'QA agent',
      'Release agent',
    ]);
    expect(plan.guidance).toContain('reconcile specialist disagreements');
  });

  it('auto-expands for broad parallel requests and stays focused for small requests', () => {
    const broad = buildAgentSwarmPlan({
      settings: DEFAULT_AGENT_SWARM_SETTINGS,
      request: 'research, compare, and parallelize multiple implementation strategies with dissenting perspectives',
    });
    const focused = buildAgentSwarmPlan({
      settings: DEFAULT_AGENT_SWARM_SETTINGS,
      request: 'rename this button label',
    });

    expect(broad.agentCount).toBe(16);
    expect(focused.agentCount).toBe(4);
  });

  it('emits compact prompt context for enabled swarms and no context when disabled', () => {
    const enabledPlan = buildAgentSwarmPlan({
      settings: {
        ...DEFAULT_AGENT_SWARM_SETTINGS,
        mode: 'focused',
        selectedTemplateId: 'perspective-review',
      },
      request: 'review this payment flow from multiple perspectives',
    });
    const disabledPlan = buildAgentSwarmPlan({
      settings: {
        ...DEFAULT_AGENT_SWARM_SETTINGS,
        enabled: false,
      },
      request: 'review this payment flow from multiple perspectives',
    });

    expect(buildAgentSwarmPromptContext(enabledPlan)).toContain('## Agent Swarm');
    expect(buildAgentSwarmPromptContext(enabledPlan)).toContain('Perspective review council');
    expect(buildAgentSwarmPromptContext(enabledPlan)).toContain('Planned agents: 4');
    expect(buildAgentSwarmPromptContext(enabledPlan)).toContain('Moderator');
    expect(buildAgentSwarmPromptContext(enabledPlan)).toContain('reconcile disagreements before final output');
    expect(buildAgentSwarmPromptContext(disabledPlan)).toBe('');
  });
});
