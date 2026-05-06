import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS,
  buildSecurityReviewPromptContext,
  buildSecurityReviewRunPlan,
  buildScheduledSecurityScanUpdate,
  isSecurityReviewAgentSettings,
} from './securityReviewAgents';

describe('securityReviewAgents', () => {
  it('derives enabled reviewer and scanner agents with severity and tool readiness', () => {
    const plan = buildSecurityReviewRunPlan({
      settings: DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS,
      selectedToolIds: ['mcp.sast.scan', 'secret-scan'],
    });

    expect(plan.enabled).toBe(true);
    expect(plan.agents.map((agent) => agent.id)).toEqual(['security-reviewer', 'vulnerability-scanner']);
    expect(plan.severityThreshold).toBe('medium');
    expect(plan.securityToolCount).toBe(2);
    expect(plan.deliverySummary).toBe('Agent Browser updates');
  });

  it('renders prompt context and scheduled scan updates from settings', () => {
    const plan = buildSecurityReviewRunPlan({
      settings: {
        ...DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS,
        cadence: 'daily',
        severityThreshold: 'high',
        customInstructions: 'Prioritize OAuth callback handling.',
      },
      selectedToolIds: ['mcp.sca.audit'],
    });

    const context = buildSecurityReviewPromptContext(plan);
    const update = buildScheduledSecurityScanUpdate(plan, new Date('2026-05-06T12:00:00.000Z'));

    expect(context).toContain('Security review agents: enabled');
    expect(context).toContain('Severity threshold: high');
    expect(context).toContain('Custom instructions: Prioritize OAuth callback handling.');
    expect(update.title).toBe('Weekly security scan ready');
    expect(update.body).toContain('daily vulnerability scanner cadence');
  });

  it('validates persisted settings and omits disabled context', () => {
    expect(isSecurityReviewAgentSettings(DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS)).toBe(true);
    expect(isSecurityReviewAgentSettings({ ...DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS, cadence: 'hourly' })).toBe(false);

    const plan = buildSecurityReviewRunPlan({
      settings: { ...DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS, enabled: false },
      selectedToolIds: [],
    });

    expect(plan.enabled).toBe(false);
    expect(buildSecurityReviewPromptContext(plan)).toBe('');
  });
});
