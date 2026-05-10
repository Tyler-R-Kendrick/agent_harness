export type PullRequestValidationStatus = 'passed' | 'failed' | 'pending' | 'missing';
export type PullRequestRiskLevel = 'low' | 'medium' | 'high';
export type PullRequestReadinessStatus = 'ready' | 'needs-review';

export interface PullRequestChangedFile {
  path: string;
  additions?: number;
  deletions?: number;
}

export interface PullRequestValidationItem {
  label: string;
  command: string;
  status: PullRequestValidationStatus;
  detail?: string;
}

export interface PullRequestBrowserEvidence {
  label: string;
  path: string;
  kind: 'screenshot' | 'trace' | 'console' | 'network' | 'other';
}

export interface PullRequestReviewerComment {
  author: string;
  body: string;
}

export interface PullRequestReviewInput {
  title: string;
  author: string;
  summary?: string;
  changedFiles: Array<string | PullRequestChangedFile>;
  validations: PullRequestValidationItem[];
  browserEvidence: PullRequestBrowserEvidence[];
  reviewerComments: PullRequestReviewerComment[];
}

export interface PullRequestChangeGroup {
  id: string;
  title: string;
  intent: string;
  files: string[];
  riskLevel: PullRequestRiskLevel;
}

export interface PullRequestRiskFinding {
  severity: PullRequestRiskLevel;
  title: string;
  reason: string;
  recommendedCheck: string;
}

export interface PullRequestFollowUpPrompt {
  id: string;
  title: string;
  prompt: string;
}

export interface PullRequestReadiness {
  status: PullRequestReadinessStatus;
  passedValidations: number;
  failedValidations: number;
  pendingValidations: number;
  browserEvidenceCount: number;
}

export interface PullRequestReviewReport {
  title: string;
  author: string;
  summary: string;
  groups: PullRequestChangeGroup[];
  risks: PullRequestRiskFinding[];
  validations: PullRequestValidationItem[];
  browserEvidence: PullRequestBrowserEvidence[];
  reviewerComments: PullRequestReviewerComment[];
  followUps: PullRequestFollowUpPrompt[];
  readiness: PullRequestReadiness;
}

type GroupDefinition = {
  id: string;
  title: string;
  intent: string;
  riskLevel: PullRequestRiskLevel;
  matches?: (path: string) => boolean;
};

const GROUP_DEFINITIONS: GroupDefinition[] = [
  {
    id: 'agent-routing',
    title: 'Agent routing and behavior',
    intent: 'Review chat-agent routing, prompts, or runtime behavior changes.',
    riskLevel: 'high',
    matches: (path) => path.startsWith('agent-browser/src/chat-agents/'),
  },
  {
    id: 'runtime-services',
    title: 'Runtime services and tools',
    intent: 'Review shared runtime services, tool execution, or orchestration contracts.',
    riskLevel: 'medium',
    matches: (path) => path.startsWith('agent-browser/src/services/') || path.startsWith('agent-browser/src/tools/'),
  },
  {
    id: 'review-surface',
    title: 'User-facing review surface',
    intent: 'Review visible Agent Browser UI, sidebar behavior, and layout changes.',
    riskLevel: 'low',
    matches: (path) => (
      path.startsWith('agent-browser/src/features/')
      || path === 'agent-browser/src/App.tsx'
      || path === 'agent-browser/src/App.css'
    ),
  },
  {
    id: 'validation',
    title: 'Validation and eval coverage',
    intent: 'Review tests, evals, scripts, and verification changes that prove behavior.',
    riskLevel: 'low',
    matches: (path) => (
      path.includes('/evals/')
      || path.includes('/scripts/')
      || path.endsWith('.test.ts')
      || path.endsWith('.test.tsx')
      || path.endsWith('.test.mjs')
    ),
  },
  {
    id: 'evidence-docs',
    title: 'Review evidence and documentation',
    intent: 'Review screenshots, plans, docs, and other artifacts attached to the change.',
    riskLevel: 'low',
    matches: (path) => (
      path.startsWith('docs/')
      || path.startsWith('output/playwright/')
      || path.endsWith('.png')
      || path.endsWith('.jpg')
      || path.endsWith('.jpeg')
      || path.endsWith('.webp')
      || path.endsWith('.md')
    ),
  },
];

const FALLBACK_GROUP: GroupDefinition = {
  id: 'repository',
  title: 'Repository changes',
  intent: 'Review repository changes that do not fit a more specific Agent Browser area.',
  riskLevel: 'medium',
};

const HIGH_RISK_TERMS = [
  'auth',
  'credential',
  'permission',
  'provider',
  'routing',
  'secret',
  'shell',
  'token',
  'tool',
];

const MEDIUM_RISK_TERMS = [
  'localstorage',
  'mcp',
  'model',
  'persist',
  'session',
  'storage',
  'workspace',
];

function normalizeChangedFile(file: string | PullRequestChangedFile): PullRequestChangedFile {
  return typeof file === 'string' ? { path: file } : file;
}

function pathFor(file: string | PullRequestChangedFile): string {
  return normalizeChangedFile(file).path.replaceAll('\\', '/');
}

function getGroupDefinition(path: string): GroupDefinition {
  if (
    path.includes('/evals/')
    || path.includes('/scripts/')
    || path.endsWith('.test.ts')
    || path.endsWith('.test.tsx')
    || path.endsWith('.test.mjs')
  ) {
    return GROUP_DEFINITIONS.find((group) => group.id === 'validation')!;
  }
  return GROUP_DEFINITIONS.find((group) => group.matches?.(path)) ?? FALLBACK_GROUP;
}

function containsTerm(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function maxRisk(left: PullRequestRiskLevel, right: PullRequestRiskLevel): PullRequestRiskLevel {
  const order: Record<PullRequestRiskLevel, number> = { low: 1, medium: 2, high: 3 };
  return order[left] >= order[right] ? left : right;
}

function inferGroupRisk(baseRisk: PullRequestRiskLevel, files: string[], summary: string): PullRequestRiskLevel {
  const joined = `${summary} ${files.join(' ')}`;
  if (containsTerm(joined, HIGH_RISK_TERMS)) return 'high';
  if (containsTerm(joined, MEDIUM_RISK_TERMS)) return maxRisk(baseRisk, 'medium');
  return baseRisk;
}

function buildGroups(input: PullRequestReviewInput, summary: string): PullRequestChangeGroup[] {
  const grouped = new Map<string, { definition: GroupDefinition; files: string[] }>();

  for (const file of input.changedFiles.map(pathFor)) {
    const definition = getGroupDefinition(file);
    const existing = grouped.get(definition.id);
    if (existing) {
      existing.files.push(file);
    } else {
      grouped.set(definition.id, { definition, files: [file] });
    }
  }

  const orderedDefinitions = [...GROUP_DEFINITIONS, FALLBACK_GROUP];
  return orderedDefinitions
    .map((definition) => grouped.get(definition.id))
    .filter((entry): entry is { definition: GroupDefinition; files: string[] } => Boolean(entry))
    .map(({ definition, files }) => ({
      id: definition.id,
      title: definition.title,
      intent: definition.intent,
      files,
      riskLevel: inferGroupRisk(definition.riskLevel, files, summary),
    }));
}

function buildReadiness(input: PullRequestReviewInput): PullRequestReadiness {
  const passedValidations = input.validations.filter((item) => item.status === 'passed').length;
  const failedValidations = input.validations.filter((item) => item.status === 'failed').length;
  const pendingValidations = input.validations.filter((item) => item.status === 'pending' || item.status === 'missing').length;
  const browserEvidenceCount = input.browserEvidence.length;
  const status: PullRequestReadinessStatus = failedValidations === 0
    && pendingValidations === 0
    && passedValidations > 0
    && browserEvidenceCount > 0
    ? 'ready'
    : 'needs-review';
  return { status, passedValidations, failedValidations, pendingValidations, browserEvidenceCount };
}

function buildRisks(input: PullRequestReviewInput, groups: PullRequestChangeGroup[], readiness: PullRequestReadiness): PullRequestRiskFinding[] {
  const changedText = `${input.title} ${input.summary ?? ''} ${input.changedFiles.map(pathFor).join(' ')}`;
  const risks: PullRequestRiskFinding[] = [];

  if (containsTerm(changedText, HIGH_RISK_TERMS)) {
    risks.push({
      severity: 'high',
      title: 'Sensitive runtime surface changed',
      reason: 'The change set touches provider routing, tool execution, permissions, credentials, or secret-adjacent code.',
      recommendedCheck: 'Review secret handling, command execution, and permission boundaries before approval.',
    });
  }

  if (groups.some((group) => group.riskLevel === 'high') && !input.validations.some((item) => item.status === 'passed')) {
    risks.push({
      severity: 'high',
      title: 'High-risk changes lack passing validation',
      reason: 'At least one high-risk semantic change group has no passing validation attached.',
      recommendedCheck: 'Run targeted tests plus npm.cmd run verify:agent-browser before approval.',
    });
  }

  if (readiness.failedValidations > 0) {
    risks.push({
      severity: 'high',
      title: 'Validation failed',
      reason: 'One or more linked validation commands failed.',
      recommendedCheck: 'Inspect and rerun failed commands before requesting review again.',
    });
  }

  if (readiness.pendingValidations > 0 || input.validations.length === 0) {
    risks.push({
      severity: 'medium',
      title: 'Validation evidence incomplete',
      reason: 'The review does not yet include a complete passing validation set.',
      recommendedCheck: 'Attach the latest targeted tests and full Agent Browser verifier output.',
    });
  }

  if (input.browserEvidence.length === 0) {
    risks.push({
      severity: 'medium',
      title: 'No browser evidence linked',
      reason: 'The review surface has no screenshot, trace, console, or visual-smoke artifact.',
      recommendedCheck: 'Run visual smoke and attach the screenshot for UI-facing changes.',
    });
  }

  if (containsTerm(changedText, MEDIUM_RISK_TERMS)) {
    risks.push({
      severity: 'medium',
      title: 'Durable workspace state changed',
      reason: 'The change set touches persistence, workspace state, model selection, or MCP integration paths.',
      recommendedCheck: 'Check migration behavior with existing localStorage/sessionStorage data.',
    });
  }

  return risks;
}

function buildFollowUps(input: PullRequestReviewInput, groups: PullRequestChangeGroup[], risks: PullRequestRiskFinding[]): PullRequestFollowUpPrompt[] {
  const prompts: PullRequestFollowUpPrompt[] = [
    {
      id: 'explain-highest-risk',
      title: 'Explain highest risk group',
      prompt: buildReviewerFollowUpPromptFromParts(input.title, groups, risks, 'Explain the highest-risk change group and list the exact files I should inspect first.'),
    },
    {
      id: 'request-validation',
      title: 'Request missing validation',
      prompt: buildReviewerFollowUpPromptFromParts(input.title, groups, risks, 'Identify missing validation evidence and propose the smallest proof set needed for approval.'),
    },
  ];

  for (const [index, comment] of input.reviewerComments.entries()) {
    prompts.push({
      id: `reviewer-comment-${index + 1}`,
      title: `Address ${comment.author} feedback`,
      prompt: buildReviewerFollowUpPromptFromParts(input.title, groups, risks, comment.body),
    });
  }

  return prompts;
}

function buildReviewerFollowUpPromptFromParts(
  title: string,
  groups: PullRequestChangeGroup[],
  risks: PullRequestRiskFinding[],
  request: string,
): string {
  const highestRisks = risks.length
    ? risks.map((risk) => `${risk.severity}: ${risk.title}`).join('; ')
    : 'none recorded';
  const groupSummary = groups.map((group) => `${group.title} (${group.files.length} files, ${group.riskLevel} risk)`).join('; ');
  return [
    `Review change set: ${title}`,
    `Reviewer request: ${request}`,
    `Highest risks: ${highestRisks}`,
    `Changed groups: ${groupSummary}`,
    'Use the Symphony merge review report, linked validations, and browser evidence before proposing follow-up work.',
  ].join('\n');
}

export function buildReviewerFollowUpPrompt(report: PullRequestReviewReport, request: string): string {
  return buildReviewerFollowUpPromptFromParts(report.title, report.groups, report.risks, request);
}

export function buildPullRequestReview(input: PullRequestReviewInput): PullRequestReviewReport {
  const summary = input.summary?.trim() || input.title;
  const groups = buildGroups(input, summary);
  const readiness = buildReadiness(input);
  const risks = buildRisks(input, groups, readiness);
  return {
    title: input.title,
    author: input.author,
    summary,
    groups,
    risks,
    validations: input.validations,
    browserEvidence: input.browserEvidence,
    reviewerComments: input.reviewerComments,
    followUps: buildFollowUps(input, groups, risks),
    readiness,
  };
}

export function createSamplePullRequestReviewInput(workspaceName: string): PullRequestReviewInput {
  return {
    title: 'Symphony branch merge review',
    author: 'agent-browser',
    summary: `Combines isolated Symphony worktree branches for ${workspaceName} with grouped changes, validation, reviewer comments, and merge approval prompts.`,
    changedFiles: [
      'agent-browser/src/services/prReviewUnderstanding.ts',
      'agent-browser/src/features/symphony/SymphonyOrchestrationPanel.tsx',
      'agent-browser/src/App.tsx',
      'agent-browser/src/App.css',
      'agent-browser/src/features/symphony/SymphonyOrchestrationPanel.test.tsx',
      'docs/superpowers/plans/2026-05-03-review-native-pr-understanding.md',
    ],
    validations: [
      {
        label: 'Targeted review model tests',
        command: 'npm.cmd --workspace agent-browser run test -- src/services/prReviewUnderstanding.test.ts',
        status: 'pending',
        detail: 'Ready for local verification.',
      },
      {
        label: 'Agent Browser verifier',
        command: 'npm.cmd run verify:agent-browser',
        status: 'pending',
        detail: 'Required before merge approval.',
      },
    ],
    browserEvidence: [
      {
        label: 'Symphony review visual smoke',
        path: 'output/playwright/agent-browser-visual-smoke.png',
        kind: 'screenshot',
      },
    ],
    reviewerComments: [
      {
        author: 'Reviewer',
        body: 'Check that the review summary links validation evidence before approval.',
      },
    ],
  };
}
