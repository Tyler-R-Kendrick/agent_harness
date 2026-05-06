export type SecurityReviewSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SecurityReviewCadence = 'daily' | 'weekly' | 'monthly';
export type SecurityReviewToolIntegration = 'harness-selected' | 'mcp-required' | 'manual';

export interface SecurityReviewAgentSettings {
  enabled: boolean;
  inlinePrReview: boolean;
  scheduledScans: boolean;
  cadence: SecurityReviewCadence;
  severityThreshold: SecurityReviewSeverity;
  toolIntegration: SecurityReviewToolIntegration;
  deliveryChannels: {
    app: boolean;
    slack: boolean;
  };
  customInstructions: string;
}

export interface SecurityReviewAgentRow {
  id: 'security-reviewer' | 'vulnerability-scanner';
  label: 'Security Reviewer' | 'Vulnerability Scanner';
  enabled: boolean;
  summary: string;
}

export interface SecurityReviewRunPlan {
  enabled: boolean;
  agents: SecurityReviewAgentRow[];
  inlinePrReview: boolean;
  scheduledScans: boolean;
  cadence: SecurityReviewCadence;
  severityThreshold: SecurityReviewSeverity;
  toolIntegration: SecurityReviewToolIntegration;
  securityToolCount: number;
  deliverySummary: string;
  customInstructions: string;
}

export interface ScheduledSecurityScanUpdate {
  title: string;
  body: string;
  createdAt: string;
}

export const DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS: SecurityReviewAgentSettings = {
  enabled: true,
  inlinePrReview: true,
  scheduledScans: true,
  cadence: 'weekly',
  severityThreshold: 'medium',
  toolIntegration: 'harness-selected',
  deliveryChannels: {
    app: true,
    slack: false,
  },
  customInstructions: '',
};

const SECURITY_REVIEW_SEVERITIES: SecurityReviewSeverity[] = ['low', 'medium', 'high', 'critical'];
const SECURITY_REVIEW_CADENCES: SecurityReviewCadence[] = ['daily', 'weekly', 'monthly'];
const SECURITY_REVIEW_TOOL_INTEGRATIONS: SecurityReviewToolIntegration[] = ['harness-selected', 'mcp-required', 'manual'];

export function isSecurityReviewAgentSettings(value: unknown): value is SecurityReviewAgentSettings {
  if (!isRecord(value) || !isRecord(value.deliveryChannels)) return false;
  return (
    typeof value.enabled === 'boolean'
    && typeof value.inlinePrReview === 'boolean'
    && typeof value.scheduledScans === 'boolean'
    && typeof value.cadence === 'string'
    && (SECURITY_REVIEW_CADENCES as string[]).includes(value.cadence)
    && typeof value.severityThreshold === 'string'
    && (SECURITY_REVIEW_SEVERITIES as string[]).includes(value.severityThreshold)
    && typeof value.toolIntegration === 'string'
    && (SECURITY_REVIEW_TOOL_INTEGRATIONS as string[]).includes(value.toolIntegration)
    && typeof value.deliveryChannels.app === 'boolean'
    && typeof value.deliveryChannels.slack === 'boolean'
    && typeof value.customInstructions === 'string'
  );
}

export function buildSecurityReviewRunPlan({
  settings = DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS,
  selectedToolIds,
}: {
  settings?: SecurityReviewAgentSettings;
  selectedToolIds: readonly string[];
}): SecurityReviewRunPlan {
  const normalizedSettings = cloneSettings(settings);
  const candidateAgents: SecurityReviewAgentRow[] = [
    {
      id: 'security-reviewer',
      label: 'Security Reviewer',
      enabled: normalizedSettings.enabled && normalizedSettings.inlinePrReview,
      summary: 'Inline PR review for auth, privacy, prompt-injection, and unsafe approval regressions.',
    },
    {
      id: 'vulnerability-scanner',
      label: 'Vulnerability Scanner',
      enabled: normalizedSettings.enabled && normalizedSettings.scheduledScans,
      summary: `${capitalize(normalizedSettings.cadence)} repository scan cadence with severity-tagged remediation guidance.`,
    },
  ];
  const agents = candidateAgents.filter((agent) => agent.enabled);

  return {
    enabled: normalizedSettings.enabled,
    agents,
    inlinePrReview: normalizedSettings.inlinePrReview,
    scheduledScans: normalizedSettings.scheduledScans,
    cadence: normalizedSettings.cadence,
    severityThreshold: normalizedSettings.severityThreshold,
    toolIntegration: normalizedSettings.toolIntegration,
    securityToolCount: selectedToolIds.length,
    deliverySummary: summarizeDelivery(normalizedSettings),
    customInstructions: normalizedSettings.customInstructions.trim(),
  };
}

export function buildSecurityReviewPromptContext(plan: SecurityReviewRunPlan): string {
  if (!plan.enabled) return '';
  const lines = [
    '## Security Review Agents',
    'Security review agents: enabled',
    `Agents: ${plan.agents.map((agent) => agent.label).join(', ') || 'none enabled'}`,
    `Inline PR review: ${plan.inlinePrReview ? 'enabled' : 'disabled'}`,
    `Scheduled scans: ${plan.scheduledScans ? plan.cadence : 'disabled'}`,
    `Severity threshold: ${plan.severityThreshold}`,
    `Security tool integration: ${plan.toolIntegration}`,
    `Selected security tools: ${plan.securityToolCount}`,
    `Delivery: ${plan.deliverySummary}`,
    'Review focus: auth regressions, privacy and data handling, prompt injection, unsafe agent auto-approvals, exposed secrets, dependency vulnerabilities, and remediation steps.',
  ];
  if (plan.customInstructions) {
    lines.push(`Custom instructions: ${plan.customInstructions}`);
  }
  return lines.join('\n');
}

export function buildScheduledSecurityScanUpdate(
  plan: SecurityReviewRunPlan,
  now = new Date(),
): ScheduledSecurityScanUpdate {
  const createdAt = Number.isNaN(now.getTime()) ? new Date(0).toISOString() : now.toISOString();
  return {
    title: 'Weekly security scan ready',
    createdAt,
    body: [
      `Prepared ${plan.cadence} vulnerability scanner cadence for Agent Browser.`,
      `Minimum reported severity: ${plan.severityThreshold}.`,
      `Security tools selected: ${plan.securityToolCount}.`,
      `Delivery: ${plan.deliverySummary}.`,
    ].join('\n'),
  };
}

function cloneSettings(settings: SecurityReviewAgentSettings): SecurityReviewAgentSettings {
  return {
    ...settings,
    deliveryChannels: { ...settings.deliveryChannels },
  };
}

function summarizeDelivery(settings: SecurityReviewAgentSettings): string {
  const channels = [
    settings.deliveryChannels.app ? 'Agent Browser updates' : '',
    settings.deliveryChannels.slack ? 'Slack updates' : '',
  ].filter(Boolean);
  return channels.join(' and ') || 'manual review notes';
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
