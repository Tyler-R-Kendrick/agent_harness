export type AgentSwarmMode = 'auto' | 'focused' | 'expanded';
export type AgentSwarmTemplateId = 'research-cell' | 'asset-production' | 'perspective-review';
export type AgentSwarmSourcePattern = 'leader-synthesis' | 'horizontal-scale' | 'persistent-squad';

export interface AgentSwarmRole {
  id: string;
  name: string;
  providerKind: 'coordinator' | 'specialist' | 'critic' | 'validator';
  responsibility: string;
  handoff: string;
}

export interface AgentSwarmTemplate {
  id: AgentSwarmTemplateId;
  name: string;
  description: string;
  bestFor: string;
  sourcePatterns: AgentSwarmSourcePattern[];
  roles: AgentSwarmRole[];
}

export interface AgentSwarmSettings {
  enabled: boolean;
  selectedTemplateId: AgentSwarmTemplateId;
  mode: AgentSwarmMode;
  maxAgents: number;
  requireReconciliation: boolean;
  preserveRoleEvidence: boolean;
}

export interface AgentSwarmPlan {
  enabled: boolean;
  mode: AgentSwarmMode;
  agentCount: number;
  template: AgentSwarmTemplate;
  roles: AgentSwarmRole[];
  guidance: string;
  warnings: string[];
}

export const DEFAULT_AGENT_SWARM_TEMPLATES: AgentSwarmTemplate[] = [
  {
    id: 'research-cell',
    name: 'Research cell',
    description: 'Leader-directed research swarm with parallel search, analysis, fact-checking, and synthesis lanes.',
    bestFor: 'Deep research, source comparison, large discovery tasks, and well-cited answers.',
    sourcePatterns: ['leader-synthesis', 'horizontal-scale'],
    roles: [
      {
        id: 'research-lead',
        name: 'Research lead',
        providerKind: 'coordinator',
        responsibility: 'Frame the research question, split source lanes, and own the final cited answer.',
        handoff: 'Receives verified evidence and writes the final synthesis.',
      },
      {
        id: 'source-scout',
        name: 'Source scout',
        providerKind: 'specialist',
        responsibility: 'Find primary sources, references, and comparable examples in parallel.',
        handoff: 'Hands candidate sources and retrieval gaps to the analyst.',
      },
      {
        id: 'evidence-analyst',
        name: 'Evidence analyst',
        providerKind: 'specialist',
        responsibility: 'Cross-reference findings and extract decision-relevant evidence.',
        handoff: 'Hands structured claims to the fact-checker.',
      },
      {
        id: 'fact-checker',
        name: 'Fact-checker',
        providerKind: 'validator',
        responsibility: 'Reject weak claims, stale evidence, and unsupported citations.',
        handoff: 'Hands accepted facts and caveats to the research lead.',
      },
    ],
  },
  {
    id: 'asset-production',
    name: 'Asset production squad',
    description: 'Persistent production squad for implementation, generated assets, QA, release notes, and evidence handoff.',
    bestFor: 'Feature work that produces code, screenshots, docs, release artifacts, or reviewable task output.',
    sourcePatterns: ['horizontal-scale', 'persistent-squad'],
    roles: [
      {
        id: 'producer',
        name: 'Producer',
        providerKind: 'coordinator',
        responsibility: 'Define the asset output contract, track owners, and keep human approval points explicit.',
        handoff: 'Coordinates artifact readiness and final delivery.',
      },
      {
        id: 'design-agent',
        name: 'Design agent',
        providerKind: 'specialist',
        responsibility: 'Own UI, accessibility, and asset presentation quality.',
        handoff: 'Hands design constraints and screenshot requirements to implementation and QA.',
      },
      {
        id: 'implementation-agent',
        name: 'Implementation agent',
        providerKind: 'specialist',
        responsibility: 'Own code changes, integration seams, and checked-in artifacts.',
        handoff: 'Hands changed files and behavior notes to QA.',
      },
      {
        id: 'qa-agent',
        name: 'QA agent',
        providerKind: 'validator',
        responsibility: 'Own deterministic tests, visual proof, and regression risks.',
        handoff: 'Hands pass/fail evidence and blockers to the producer.',
      },
      {
        id: 'release-agent',
        name: 'Release agent',
        providerKind: 'specialist',
        responsibility: 'Own PR description, status checks, labels, and handoff comments.',
        handoff: 'Hands merge readiness and remaining risks to the producer.',
      },
    ],
  },
  {
    id: 'perspective-review',
    name: 'Perspective review council',
    description: 'Multi-perspective review swarm that forces productive disagreement before recommendations are accepted.',
    bestFor: 'Product plans, architecture choices, launch reviews, and risk-heavy workflow decisions.',
    sourcePatterns: ['leader-synthesis', 'horizontal-scale', 'persistent-squad'],
    roles: [
      {
        id: 'moderator',
        name: 'Moderator',
        providerKind: 'coordinator',
        responsibility: 'Keep perspectives independent and force disagreement into a final decision record.',
        handoff: 'Owns the final reconciled recommendation.',
      },
      {
        id: 'skeptic',
        name: 'Skeptic',
        providerKind: 'critic',
        responsibility: 'Challenge hidden assumptions, cost, latency, and maintenance burden.',
        handoff: 'Hands objections and failure modes to the moderator.',
      },
      {
        id: 'product-agent',
        name: 'Product agent',
        providerKind: 'specialist',
        responsibility: 'Represent user workflow, discoverability, and task completion quality.',
        handoff: 'Hands user-impact tradeoffs to the moderator.',
      },
      {
        id: 'accessibility-agent',
        name: 'Accessibility agent',
        providerKind: 'validator',
        responsibility: 'Review keyboard access, responsive layout, touch targets, and screen-reader labels.',
        handoff: 'Hands accessibility blockers and required verification to the moderator.',
      },
      {
        id: 'security-agent',
        name: 'Security agent',
        providerKind: 'validator',
        responsibility: 'Review permissions, data exposure, secret handling, and external tool boundaries.',
        handoff: 'Hands safety constraints and non-negotiable blockers to the moderator.',
      },
    ],
  },
];

export const DEFAULT_AGENT_SWARM_SETTINGS: AgentSwarmSettings = {
  enabled: true,
  selectedTemplateId: 'asset-production',
  mode: 'auto',
  maxAgents: 16,
  requireReconciliation: true,
  preserveRoleEvidence: true,
};

const AGENT_SWARM_MODES: AgentSwarmMode[] = ['auto', 'focused', 'expanded'];
const AGENT_SWARM_TEMPLATE_IDS: AgentSwarmTemplateId[] = DEFAULT_AGENT_SWARM_TEMPLATES.map((template) => template.id);
const MIN_AGENT_COUNT = 1;
const FOCUSED_AGENT_COUNT = 4;
const EXPANDED_AGENT_COUNT = 16;

export function isAgentSwarmSettings(value: unknown): value is AgentSwarmSettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && isOneOf(value.selectedTemplateId, AGENT_SWARM_TEMPLATE_IDS)
    && isOneOf(value.mode, AGENT_SWARM_MODES)
    && typeof value.maxAgents === 'number'
    && Number.isInteger(value.maxAgents)
    && value.maxAgents >= MIN_AGENT_COUNT
    && value.maxAgents <= 300
    && typeof value.requireReconciliation === 'boolean'
    && typeof value.preserveRoleEvidence === 'boolean'
  );
}

export function buildAgentSwarmPlan({
  settings,
  request,
}: {
  settings: AgentSwarmSettings;
  request: string;
}): AgentSwarmPlan {
  const template = getAgentSwarmTemplate(settings.selectedTemplateId);
  const requestedCount = settings.mode === 'expanded'
    ? EXPANDED_AGENT_COUNT
    : settings.mode === 'focused'
      ? FOCUSED_AGENT_COUNT
      : shouldAutoExpand(request)
        ? EXPANDED_AGENT_COUNT
        : FOCUSED_AGENT_COUNT;
  const agentCount = settings.enabled ? Math.max(MIN_AGENT_COUNT, Math.min(settings.maxAgents, requestedCount)) : 0;
  const guidance = [
    settings.requireReconciliation ? 'Require the coordinator to reconcile specialist disagreements before final output.' : 'Specialist disagreements may be summarized without a forced decision.',
    settings.preserveRoleEvidence ? 'Preserve role evidence, owner handoffs, and validation notes in the task transcript.' : 'Keep role evidence compact and summarize only final handoffs.',
    'Use parallel specialists only when their work can proceed independently; keep human approval points explicit.',
  ].join(' ');
  const warnings: string[] = [];
  if (settings.maxAgents < requestedCount && settings.enabled) {
    warnings.push(`Maximum swarm agents caps ${requestedCount} requested agents to ${settings.maxAgents}.`);
  }

  return {
    enabled: settings.enabled,
    mode: settings.mode,
    agentCount,
    template,
    roles: template.roles.map((role) => ({ ...role })),
    guidance,
    warnings,
  };
}

export function buildAgentSwarmPromptContext(plan: AgentSwarmPlan): string {
  if (!plan.enabled) return '';
  return [
    '## Agent Swarm',
    'Agent swarms: enabled',
    `Template: ${plan.template.name}`,
    `Mode: ${plan.mode}`,
    `Planned agents: ${plan.agentCount}`,
    `Best for: ${plan.template.bestFor}`,
    `Patterns: ${plan.template.sourcePatterns.map(labelForSourcePattern).join(', ')}`,
    `Guidance: ${plan.guidance} The coordinator must reconcile disagreements before final output.`,
    ...plan.roles.map((role) => `${role.name}: ${role.providerKind}; owns ${role.responsibility}; handoff ${role.handoff}`),
    ...plan.warnings.map((warning) => `Warning: ${warning}`),
  ].join('\n');
}

function getAgentSwarmTemplate(id: AgentSwarmTemplateId): AgentSwarmTemplate {
  return DEFAULT_AGENT_SWARM_TEMPLATES.find((template) => template.id === id) ?? DEFAULT_AGENT_SWARM_TEMPLATES[0];
}

function shouldAutoExpand(request: string): boolean {
  const lowered = request.toLowerCase();
  return /\b(parallel|subagents?|sub-agents?|swarm|broad|deep|comprehensive|compare|multiple|multi-perspective|perspectives|research|asset package|launch|literature|batch)\b/.test(lowered);
}

function labelForSourcePattern(pattern: AgentSwarmSourcePattern): string {
  switch (pattern) {
    case 'leader-synthesis':
      return 'leader synthesis';
    case 'horizontal-scale':
      return 'horizontal specialist scaling';
    case 'persistent-squad':
      return 'human-governed persistent squad';
  }
}

function isOneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === 'string' && (choices as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
