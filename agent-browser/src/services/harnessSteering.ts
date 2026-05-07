export type HarnessSteeringScope =
  | 'summary'
  | 'user'
  | 'project'
  | 'workspace'
  | 'session'
  | 'agent'
  | 'tool';

export type HarnessSteeringCorrectionSource = 'chat' | 'manual' | 'imported';

export interface HarnessSteeringCorrection {
  id: string;
  scope: Exclude<HarnessSteeringScope, 'summary'>;
  source: HarnessSteeringCorrectionSource;
  text: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface HarnessSteeringState {
  enabled: boolean;
  autoCapture: boolean;
  enforceWithHooks: boolean;
  corrections: HarnessSteeringCorrection[];
}

export interface HarnessSteeringFile {
  scope: HarnessSteeringScope;
  path: string;
  title: string;
  content: string;
  correctionCount: number;
  updatedAt?: string;
}

export interface HarnessSteeringFileRow {
  scope: HarnessSteeringScope;
  path: string;
  title: string;
  correctionCount: number;
  summary: string;
  updatedAt?: string;
}

export interface HarnessSteeringInventory {
  enabled: boolean;
  autoCapture: boolean;
  enforceWithHooks: boolean;
  totalCorrections: number;
  fileRows: HarnessSteeringFileRow[];
  latestCorrection: HarnessSteeringCorrection | null;
  warnings: string[];
}

const DERIVATIVE_SCOPES: Exclude<HarnessSteeringScope, 'summary'>[] = [
  'user',
  'project',
  'workspace',
  'session',
  'agent',
  'tool',
];

export const HARNESS_STEERING_FILES: readonly Omit<HarnessSteeringFile, 'content' | 'correctionCount' | 'updatedAt'>[] = [
  { scope: 'summary', path: '.steering/STEERING.md', title: 'Steering summary' },
  { scope: 'user', path: '.steering/user.steering.md', title: 'User steering' },
  { scope: 'project', path: '.steering/project.steering.md', title: 'Project steering' },
  { scope: 'workspace', path: '.steering/workspace.steering.md', title: 'Workspace steering' },
  { scope: 'session', path: '.steering/session.steering.md', title: 'Session steering' },
  { scope: 'agent', path: '.steering/agent.steering.md', title: 'Agent steering' },
  { scope: 'tool', path: '.steering/tool.steering.md', title: 'Tool steering' },
];

export const DEFAULT_HARNESS_STEERING_STATE: HarnessSteeringState = {
  enabled: true,
  autoCapture: true,
  enforceWithHooks: true,
  corrections: [
    {
      id: 'steer-workspace-verify-full-repo',
      scope: 'workspace',
      source: 'manual',
      text: 'When the user asks to verify Agent Browser work, run the full repository verifier before handoff.',
      tags: ['verification'],
      createdAt: '2026-05-07T00:00:00.000Z',
      updatedAt: '2026-05-07T00:00:00.000Z',
    },
    {
      id: 'steer-tool-use-project-wrappers',
      scope: 'tool',
      source: 'manual',
      text: 'Prefer project wrapper scripts for git and GitHub CLI operations in Codex Windows sandbox sessions.',
      tags: ['tooling'],
      createdAt: '2026-05-07T00:00:00.000Z',
      updatedAt: '2026-05-07T00:00:00.000Z',
    },
  ],
};

export function inferHarnessSteeringScope(text: string): Exclude<HarnessSteeringScope, 'summary'> {
  const normalized = text.toLowerCase();
  if (/\b(tool|shell|command|script|git|gh|browser|playwright|npm)\b/.test(normalized)) return 'tool';
  if (/\b(agent|subagent|planner|researcher|debugger|security|codi|ghcp|cursor|codex)\b/.test(normalized)) return 'agent';
  if (/\b(session|thread|conversation|chat history|turn)\b/.test(normalized)) return 'session';
  if (/\b(workspace|worktree|repo|repository|codebase)\b/.test(normalized)) return 'workspace';
  if (/\b(project|product|feature|linear|issue)\b/.test(normalized)) return 'project';
  return 'user';
}

export function createHarnessSteeringCorrection({
  text,
  source,
  scope,
  tags = [],
  now = new Date(),
}: {
  text: string;
  source: HarnessSteeringCorrectionSource;
  scope?: Exclude<HarnessSteeringScope, 'summary'>;
  tags?: string[];
  now?: Date;
}): HarnessSteeringCorrection {
  const normalizedText = text.trim().replace(/\s+/g, ' ');
  if (!normalizedText) {
    throw new Error('Harness steering correction text is required.');
  }
  const timestamp = safeIso(now);
  const resolvedScope = scope ?? inferHarnessSteeringScope(normalizedText);
  return {
    id: `steer-${resolvedScope}-${stableSlug(normalizedText)}`,
    scope: resolvedScope,
    source,
    text: normalizedText,
    tags: uniqueStrings(tags.map((tag) => tag.trim()).filter(Boolean)),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function isHarnessSteeringState(value: unknown): value is HarnessSteeringState {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && typeof value.autoCapture === 'boolean'
    && typeof value.enforceWithHooks === 'boolean'
    && Array.isArray(value.corrections)
    && value.corrections.every(isHarnessSteeringCorrection)
  );
}

export function buildHarnessSteeringFiles(state: HarnessSteeringState): HarnessSteeringFile[] {
  const correctionsByScope = new Map<Exclude<HarnessSteeringScope, 'summary'>, HarnessSteeringCorrection[]>();
  for (const scope of DERIVATIVE_SCOPES) correctionsByScope.set(scope, []);
  for (const correction of state.corrections) {
    correctionsByScope.get(correction.scope)?.push(cloneCorrection(correction));
  }

  const derivativeFiles = DERIVATIVE_SCOPES.map((scope) => {
    const template = HARNESS_STEERING_FILES.find((file) => file.scope === scope);
    if (!template) throw new Error(`Missing harness steering file template for ${scope}.`);
    const corrections = sortCorrections(correctionsByScope.get(scope) ?? []);
    return {
      ...template,
      correctionCount: corrections.length,
      updatedAt: corrections[0]?.updatedAt,
      content: renderDerivativeFile(template.title, corrections),
    };
  });

  const summaryTemplate = HARNESS_STEERING_FILES[0];
  return [{
    ...summaryTemplate,
    correctionCount: state.corrections.length,
    updatedAt: latestUpdatedAt(state.corrections),
    content: renderSummaryFile(derivativeFiles, state),
  }, ...derivativeFiles];
}

export function buildHarnessSteeringInventory(state: HarnessSteeringState): HarnessSteeringInventory {
  const files = buildHarnessSteeringFiles(state);
  const latestCorrection = sortCorrections(state.corrections)[0] ?? null;
  const warnings = state.enabled && state.corrections.length === 0
    ? ['Harness steering is enabled but no corrections have been captured yet.']
    : [];
  if (state.enabled && !state.enforceWithHooks) {
    warnings.push('Hook enforcement is disabled; corrections are prompt guidance only.');
  }
  return {
    enabled: state.enabled,
    autoCapture: state.autoCapture,
    enforceWithHooks: state.enforceWithHooks,
    totalCorrections: state.corrections.length,
    latestCorrection,
    warnings,
    fileRows: files.map((file) => ({
      scope: file.scope,
      path: file.path,
      title: file.title,
      correctionCount: file.correctionCount,
      updatedAt: file.updatedAt,
      summary: `${file.correctionCount} correction${file.correctionCount === 1 ? '' : 's'}`,
    })),
  };
}

export function buildHarnessSteeringPromptContext(inventory: HarnessSteeringInventory): string {
  if (!inventory.enabled) return '';
  const activeRows = inventory.fileRows.filter((row) => row.scope !== 'summary' && row.correctionCount > 0);
  return [
    '## Harness Steering',
    `Steering memory: ${inventory.enabled ? 'enabled' : 'disabled'}`,
    `Auto-capture corrections: ${inventory.autoCapture ? 'enabled' : 'disabled'}`,
    `Hook enforcement: ${inventory.enforceWithHooks ? 'enabled' : 'disabled'}`,
    `Canonical summary: .steering/STEERING.md`,
    `Derivative files: ${inventory.fileRows.filter((row) => row.scope !== 'summary').map((row) => row.path).join(', ')}`,
    `Active correction scopes: ${activeRows.map((row) => `${row.scope} (${row.correctionCount})`).join(', ') || 'none'}`,
    inventory.latestCorrection ? `Latest correction: [${inventory.latestCorrection.scope}] ${inventory.latestCorrection.text}` : '',
    'Instruction: preserve exact user corrections, route each correction to its scoped derivative file, and refresh the summary index without rewriting unrelated steering scopes.',
  ].filter(Boolean).join('\n');
}

function renderSummaryFile(files: HarnessSteeringFile[], state: HarnessSteeringState): string {
  const latest = latestUpdatedAt(state.corrections) ?? 'never';
  return [
    '# Harness Steering',
    '',
    `Updated: ${latest}`,
    `Status: ${state.enabled ? 'enabled' : 'disabled'}`,
    `Auto-capture: ${state.autoCapture ? 'enabled' : 'disabled'}`,
    `Hook enforcement: ${state.enforceWithHooks ? 'enabled' : 'disabled'}`,
    '',
    '## Scoped Files',
    ...files.map((file) => {
      const relativePath = file.path.replace('.steering/', '');
      return `- [${file.scope}](${relativePath}): ${file.correctionCount} correction${file.correctionCount === 1 ? '' : 's'}`;
    }),
    '',
    '## Rule',
    '- Preserve exact correction text in derivative files and use this summary only as an index.',
  ].join('\n');
}

function renderDerivativeFile(title: string, corrections: HarnessSteeringCorrection[]): string {
  const updated = corrections[0]?.updatedAt ?? 'never';
  const lines = [
    `# ${title}`,
    '',
    `Updated: ${updated}`,
    '',
    '## Corrections',
  ];
  if (corrections.length === 0) {
    lines.push('- No corrections captured yet.');
  } else {
    lines.push(...corrections.map((correction) => `- ${correction.text}`));
  }
  return lines.join('\n');
}

function isHarnessSteeringCorrection(value: unknown): value is HarnessSteeringCorrection {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && DERIVATIVE_SCOPES.includes(value.scope as Exclude<HarnessSteeringScope, 'summary'>)
    && (value.source === 'chat' || value.source === 'manual' || value.source === 'imported')
    && typeof value.text === 'string'
    && Array.isArray(value.tags)
    && value.tags.every((tag) => typeof tag === 'string')
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string'
  );
}

function cloneCorrection(correction: HarnessSteeringCorrection): HarnessSteeringCorrection {
  return { ...correction, tags: [...correction.tags] };
}

function sortCorrections(corrections: HarnessSteeringCorrection[]): HarnessSteeringCorrection[] {
  return corrections
    .map(cloneCorrection)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.id.localeCompare(right.id));
}

function latestUpdatedAt(corrections: HarnessSteeringCorrection[]): string | undefined {
  return sortCorrections(corrections)[0]?.updatedAt;
}

function stableSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'correction';
}

function safeIso(now: Date): string {
  const time = now.getTime();
  return Number.isFinite(time) ? now.toISOString() : new Date(0).toISOString();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
