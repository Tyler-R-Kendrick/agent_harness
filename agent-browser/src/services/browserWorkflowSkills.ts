import type { WorkspaceFile } from '../types';

export interface BrowserWorkflowSkillPermissionSet {
  tools: string[];
  paths: string[];
  network: string[];
}

export interface BrowserWorkflowSkillAsset {
  path: string;
  description: string;
  required: boolean;
}

export interface BrowserWorkflowSkillScript {
  name: string;
  command: string;
  description: string;
}

export interface BrowserWorkflowSkillManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  description: string;
  instructions: string;
  permissions: BrowserWorkflowSkillPermissionSet;
  assets: BrowserWorkflowSkillAsset[];
  scripts: BrowserWorkflowSkillScript[];
  triggers: string[];
}

export interface BrowserWorkflowSkillSuggestion extends BrowserWorkflowSkillManifest {
  matchedTriggers: string[];
  score: number;
}

const BROWSER_WORKFLOW_SKILL_PATH_PATTERN = /^\.agents\/browser-workflows\/([^/]+)\/skill\.json$/;

export const DEFAULT_BROWSER_WORKFLOW_SKILLS: BrowserWorkflowSkillManifest[] = [
  {
    schemaVersion: 1,
    id: 'visual-review',
    name: 'Visual review workflow',
    version: '1.0.0',
    description: 'Runs responsive browser inspection with screenshots before UI work is handed off.',
    instructions: [
      'Inspect the active Agent Browser surface at mobile, tablet, desktop, and wide widths.',
      'Check for overflow, overlap, clipped text, missing focus states, and inaccessible controls.',
      'Attach screenshots and summarize any unresolved visual risks before completion.',
    ].join('\n'),
    permissions: {
      tools: ['browser-screenshot', 'browser-dom-snapshot', 'browser-viewport'],
      paths: ['agent-browser/**', 'docs/superpowers/plans/**', 'output/playwright/**'],
      network: [],
    },
    assets: [
      {
        path: 'output/playwright/agent-browser-visual-smoke.png',
        description: 'Primary Agent Browser visual smoke screenshot.',
        required: true,
      },
      {
        path: 'docs/superpowers/plans/*-visual-smoke.png',
        description: 'PR-visible screenshot copied from the validated visual smoke run.',
        required: false,
      },
    ],
    scripts: [
      {
        name: 'visual-smoke',
        command: 'npm.cmd run visual:agent-browser',
        description: 'Starts an isolated Vite server and captures the Agent Browser visual proof.',
      },
    ],
    triggers: ['visual', 'ui', 'screenshot', 'responsive', 'accessibility', 'layout'],
  },
  {
    schemaVersion: 1,
    id: 'runtime-repro',
    name: 'Runtime reproduction workflow',
    version: '1.0.0',
    description: 'Captures the exact runtime request, response, tool trajectory, and process evidence for behavior fixes.',
    instructions: [
      'Treat supplied runtime context as reproduction evidence.',
      'Preserve the bad output shape in a test or eval fixture before changing product behavior.',
      'Record request, response, chat history, tool path, AgentBus/process entries, and screenshots when available.',
    ].join('\n'),
    permissions: {
      tools: ['read-file', 'search-files', 'browser-screenshot', 'run-script'],
      paths: ['agent-browser/src/**', 'agent-browser/evals/**', 'agent-browser/scripts/**', 'docs/superpowers/plans/**'],
      network: [],
    },
    assets: [
      {
        path: 'docs/superpowers/plans/*-runtime-proof.md',
        description: 'Runtime proof notes with request, response, tool path, and regression evidence.',
        required: false,
      },
    ],
    scripts: [
      {
        name: 'agent-browser-verify',
        command: 'npm.cmd run verify:agent-browser',
        description: 'Runs the full Agent Browser verification gate after focused reproduction tests pass.',
      },
    ],
    triggers: ['bug', 'regression', 'runtime', 'repro', 'agentbus', 'tool trajectory', 'bad output'],
  },
];

export function createBrowserWorkflowSkillFile(
  manifest: BrowserWorkflowSkillManifest,
  updatedAt = new Date().toISOString(),
): WorkspaceFile {
  return {
    path: `.agents/browser-workflows/${manifest.id}/skill.json`,
    content: `${JSON.stringify(manifest, null, 2)}\n`,
    updatedAt,
  };
}

export function discoverBrowserWorkflowSkills(files: readonly WorkspaceFile[]): BrowserWorkflowSkillManifest[] {
  return files
    .filter((file) => BROWSER_WORKFLOW_SKILL_PATH_PATTERN.test(normalizePath(file.path)))
    .flatMap((file) => {
      const manifest = parseManifest(file.content);
      if (!manifest) return [];
      const pathId = normalizePath(file.path).match(BROWSER_WORKFLOW_SKILL_PATH_PATTERN)?.[1];
      return pathId === manifest.id ? [manifest] : [];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function installBrowserWorkflowSkill(
  files: readonly WorkspaceFile[],
  manifest: BrowserWorkflowSkillManifest,
  updatedAt = new Date().toISOString(),
): WorkspaceFile[] {
  const skillFile = createBrowserWorkflowSkillFile(manifest, updatedAt);
  const existingIndex = files.findIndex((file) => normalizePath(file.path) === skillFile.path);
  if (existingIndex === -1) return [...files, skillFile];
  return files.map((file, index) => (index === existingIndex ? skillFile : { ...file }));
}

export function suggestBrowserWorkflowSkills(
  input: string,
  skills: readonly BrowserWorkflowSkillManifest[],
  limit = 3,
): BrowserWorkflowSkillSuggestion[] {
  const terms = tokenize(input);
  if (terms.length === 0) return [];

  return skills
    .map((skill) => {
      const matchedTriggers = skill.triggers.filter((trigger) => triggerMatches(trigger, terms));
      const nameMatches = tokenize(`${skill.name} ${skill.description}`).filter((term) => terms.includes(term));
      const score = matchedTriggers.length * 3 + nameMatches.length;
      return {
        ...cloneManifest(skill),
        matchedTriggers,
        score,
      };
    })
    .filter((suggestion) => suggestion.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, Math.max(0, limit));
}

export function buildBrowserWorkflowSkillPromptContext(
  suggestions: readonly BrowserWorkflowSkillSuggestion[],
): string {
  if (suggestions.length === 0) return '';
  return [
    '## Browser Workflow Skills',
    ...suggestions.map((skill) => [
      `### ${skill.name} (${skill.id}@${skill.version})`,
      skill.description,
      `Matched triggers: ${skill.matchedTriggers.join(', ') || 'none'}`,
      `Tools: ${skill.permissions.tools.join(', ') || 'none'}`,
      `Paths: ${skill.permissions.paths.join(', ') || 'none'}`,
      `Network: ${skill.permissions.network.join(', ') || 'none'}`,
      `Scripts: ${skill.scripts.map((script) => `${script.name}: ${script.command}`).join('; ') || 'none'}`,
      'Instructions:',
      skill.instructions,
    ].join('\n')),
  ].join('\n\n');
}

export function isBrowserWorkflowSkillManifest(value: unknown): value is BrowserWorkflowSkillManifest {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === 1
    && isNonEmptyString(value.id)
    && isSafeId(value.id)
    && isNonEmptyString(value.name)
    && isNonEmptyString(value.version)
    && isNonEmptyString(value.description)
    && isNonEmptyString(value.instructions)
    && isPermissionSet(value.permissions)
    && Array.isArray(value.assets)
    && value.assets.every(isSkillAsset)
    && Array.isArray(value.scripts)
    && value.scripts.every(isSkillScript)
    && isStringArray(value.triggers)
  );
}

function parseManifest(content: string): BrowserWorkflowSkillManifest | null {
  try {
    const parsed: unknown = JSON.parse(content);
    return isBrowserWorkflowSkillManifest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function triggerMatches(trigger: string, terms: readonly string[]): boolean {
  const triggerTerms = tokenize(trigger);
  return triggerTerms.length > 0 && triggerTerms.every((term) =>
    terms.some((candidate) => candidate === term || candidate.startsWith(term) || term.startsWith(candidate)),
  );
}

function tokenize(value: string): string[] {
  return [...new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))];
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

function cloneManifest(manifest: BrowserWorkflowSkillManifest): BrowserWorkflowSkillManifest {
  return {
    ...manifest,
    permissions: {
      tools: [...manifest.permissions.tools],
      paths: [...manifest.permissions.paths],
      network: [...manifest.permissions.network],
    },
    assets: manifest.assets.map((asset) => ({ ...asset })),
    scripts: manifest.scripts.map((script) => ({ ...script })),
    triggers: [...manifest.triggers],
  };
}

function isPermissionSet(value: unknown): value is BrowserWorkflowSkillPermissionSet {
  if (!isRecord(value)) return false;
  return isStringArray(value.tools) && isStringArray(value.paths) && isStringArray(value.network);
}

function isSkillAsset(value: unknown): value is BrowserWorkflowSkillAsset {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.path)
    && isNonEmptyString(value.description)
    && typeof value.required === 'boolean';
}

function isSkillScript(value: unknown): value is BrowserWorkflowSkillScript {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.name)
    && isNonEmptyString(value.command)
    && isNonEmptyString(value.description);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSafeId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
