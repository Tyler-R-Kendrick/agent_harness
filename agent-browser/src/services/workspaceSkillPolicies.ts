import type { WorkspaceFile } from '../types';

export type WorkspaceSkillPackageStatus = 'draft' | 'published' | 'deprecated';

export interface WorkspaceSkillPackage {
  id: string;
  name: string;
  version: string;
  status: WorkspaceSkillPackageStatus;
  description: string;
  toolScopes: string[];
  pathScopes: string[];
  externalPaths: string[];
  updatedAt: string;
  publishedAt?: string;
}

export interface WorkspaceSkillHelper {
  id: 'regex-grep';
  label: string;
  enabled: boolean;
}

export interface WorkspaceSkillPolicyState {
  enabled: boolean;
  enforceLeastPrivilege: boolean;
  packages: WorkspaceSkillPackage[];
  helpers: WorkspaceSkillHelper[];
}

export interface WorkspaceSkillPackageRow {
  id: string;
  name: string;
  version: string;
  status: WorkspaceSkillPackageStatus;
  toolCount: number;
  pathCount: number;
  externalPathCount: number;
  summary: string;
}

export interface WorkspaceSkillHelperRow {
  id: WorkspaceSkillHelper['id'];
  label: string;
  enabled: boolean;
  packageCount: number;
  summary: string;
}

export interface WorkspaceSkillPolicyInventory {
  enabled: boolean;
  enforceLeastPrivilege: boolean;
  packageCount: number;
  draftPackageCount: number;
  publishedPackageCount: number;
  toolScopeCount: number;
  pathScopeCount: number;
  externalPathCount: number;
  packageRows: WorkspaceSkillPackageRow[];
  helperRows: WorkspaceSkillHelperRow[];
  externalAllowlist: string[];
  warnings: string[];
}

export interface WorkspaceSkillSearchMatch {
  path: string;
  line: number;
  preview: string;
}

export const DEFAULT_WORKSPACE_SKILL_POLICY_STATE: WorkspaceSkillPolicyState = {
  enabled: true,
  enforceLeastPrivilege: true,
  packages: [
    {
      id: 'team-reviewer',
      name: 'Team reviewer',
      version: '0.1.0',
      status: 'draft',
      description: 'Draft review workflow for code, browser evidence, and security notes.',
      toolScopes: ['read-file', 'search-files', 'grep-workspace', 'browser-screenshot'],
      pathScopes: ['agent-browser/**', 'docs/**', 'scripts/verify-agent-browser.ps1'],
      externalPaths: ['C:\\src\\agent-harness'],
      updatedAt: '2026-05-06T00:00:00.000Z',
    },
    {
      id: 'release-runner',
      name: 'Release runner',
      version: '1.0.0',
      status: 'published',
      description: 'Published release workflow constrained to verification and deployment scripts.',
      toolScopes: ['read-file', 'run-script', 'grep-workspace', 'browser-screenshot'],
      pathScopes: ['scripts/**', '.github/workflows/**', 'docs/superpowers/plans/**'],
      externalPaths: ['C:\\tmp\\agent-browser-evidence'],
      updatedAt: '2026-05-06T00:00:00.000Z',
      publishedAt: '2026-05-06T00:00:00.000Z',
    },
  ],
  helpers: [
    {
      id: 'regex-grep',
      label: 'Policy-aware regex grep',
      enabled: true,
    },
  ],
};

export function isWorkspaceSkillPolicyState(value: unknown): value is WorkspaceSkillPolicyState {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && typeof value.enforceLeastPrivilege === 'boolean'
    && Array.isArray(value.packages)
    && value.packages.every(isWorkspaceSkillPackage)
    && Array.isArray(value.helpers)
    && value.helpers.every(isWorkspaceSkillHelper)
  );
}

export function buildWorkspaceSkillPolicyInventory(
  state: WorkspaceSkillPolicyState,
): WorkspaceSkillPolicyInventory {
  const packages = state.packages.map(clonePackage);
  const externalAllowlist = sortedUnique(packages.flatMap((pkg) => pkg.externalPaths));
  const helperRows = state.helpers.map((helper): WorkspaceSkillHelperRow => ({
    id: helper.id,
    label: helper.label,
    enabled: helper.enabled,
    packageCount: packages.length,
    summary: helper.id === 'regex-grep'
      ? 'Searches only files allowed by each skill package path scope.'
      : 'Helper is constrained by workspace skill policy.',
  }));
  const warnings = state.enforceLeastPrivilege
    ? packages.flatMap((pkg) => {
      const packageWarnings = [];
      if (pkg.toolScopes.length === 0) packageWarnings.push(`${pkg.name} has no tool scopes.`);
      if (pkg.pathScopes.length === 0) packageWarnings.push(`${pkg.name} has no path scopes.`);
      return packageWarnings;
    })
    : [];

  return {
    enabled: state.enabled,
    enforceLeastPrivilege: state.enforceLeastPrivilege,
    packageCount: packages.length,
    draftPackageCount: packages.filter((pkg) => pkg.status === 'draft').length,
    publishedPackageCount: packages.filter((pkg) => pkg.status === 'published').length,
    toolScopeCount: sortedUnique(packages.flatMap((pkg) => pkg.toolScopes)).length,
    pathScopeCount: sortedUnique(packages.flatMap((pkg) => pkg.pathScopes)).length,
    externalPathCount: externalAllowlist.length,
    packageRows: packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      version: pkg.version,
      status: pkg.status,
      toolCount: pkg.toolScopes.length,
      pathCount: pkg.pathScopes.length,
      externalPathCount: pkg.externalPaths.length,
      summary: `${pkg.toolScopes.length} tools, ${pkg.pathScopes.length} paths, ${pkg.externalPaths.length} external allowlist${pkg.externalPaths.length === 1 ? '' : 's'}`,
    })),
    helperRows,
    externalAllowlist,
    warnings,
  };
}

export function publishWorkspaceSkillDraft(
  state: WorkspaceSkillPolicyState,
  packageId: string,
  now = new Date(),
): WorkspaceSkillPolicyState {
  const target = state.packages.find((pkg) => pkg.id === packageId);
  if (!target || target.status !== 'draft') return state;
  const publishedAt = safeIso(now);
  return {
    ...state,
    packages: state.packages.map((pkg) => (
      pkg.id === packageId
        ? { ...clonePackage(pkg), status: 'published', publishedAt, updatedAt: publishedAt }
        : clonePackage(pkg)
    )),
    helpers: state.helpers.map((helper) => ({ ...helper })),
  };
}

export function isToolAllowedBySkill(pkg: WorkspaceSkillPackage, toolId: string): boolean {
  return pkg.toolScopes.includes(toolId);
}

export function isPathAllowedBySkill(pkg: WorkspaceSkillPackage, path: string): boolean {
  const normalizedPath = normalizePath(path);
  return pkg.pathScopes.some((scope) => matchesPathScope(normalizedPath, normalizePath(scope)));
}

export function searchWorkspaceFilesWithinPolicy(
  files: WorkspaceFile[],
  query: RegExp,
  pkg: WorkspaceSkillPackage,
): WorkspaceSkillSearchMatch[] {
  const flags = query.flags.includes('g') ? query.flags : `${query.flags}g`;
  const scopedQuery = new RegExp(query.source, flags);
  return files
    .filter((file) => isPathAllowedBySkill(pkg, file.path))
    .flatMap((file) => {
      const lines = file.content.split(/\r?\n/);
      return lines.flatMap((line, index) => {
        scopedQuery.lastIndex = 0;
        return scopedQuery.test(line)
          ? [{ path: file.path, line: index + 1, preview: line.trim() }]
          : [];
      });
    });
}

export function buildWorkspaceSkillPolicyPromptContext(
  inventory: WorkspaceSkillPolicyInventory,
): string {
  if (!inventory.enabled) return '';
  const enabledRegexGrep = inventory.helperRows.find((helper) => helper.id === 'regex-grep')?.enabled ?? false;
  return [
    '## Versioned Workspace Skills',
    `Least-privilege enforcement: ${inventory.enforceLeastPrivilege ? 'enabled' : 'disabled'}`,
    `Packages: ${inventory.packageRows.map((row) => `${row.id}@${row.version} ${row.status}`).join(', ') || 'none'}`,
    `Policy-aware regex grep: ${enabledRegexGrep ? 'enabled' : 'disabled'}`,
    `Tool scopes: ${inventory.toolScopeCount}`,
    `Path scopes: ${inventory.pathScopeCount}`,
    `External allowlist: ${inventory.externalAllowlist.join(', ') || 'none'}`,
    'Instruction: before using reusable workspace skills, respect each package tool scope, repository path scope, and external-path allowlist.',
  ].join('\n');
}

function isWorkspaceSkillPackage(value: unknown): value is WorkspaceSkillPackage {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.version === 'string'
    && typeof value.status === 'string'
    && ['draft', 'published', 'deprecated'].includes(value.status)
    && typeof value.description === 'string'
    && isStringArray(value.toolScopes)
    && isStringArray(value.pathScopes)
    && isStringArray(value.externalPaths)
    && typeof value.updatedAt === 'string'
    && (value.publishedAt === undefined || typeof value.publishedAt === 'string')
  );
}

function isWorkspaceSkillHelper(value: unknown): value is WorkspaceSkillHelper {
  if (!isRecord(value)) return false;
  return value.id === 'regex-grep'
    && typeof value.label === 'string'
    && typeof value.enabled === 'boolean';
}

function matchesPathScope(path: string, scope: string): boolean {
  if (scope.endsWith('/**')) {
    const prefix = scope.slice(0, -3);
    return path === prefix || path.startsWith(`${prefix}/`);
  }
  return path === scope || path.startsWith(`${scope}/`);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

function clonePackage(pkg: WorkspaceSkillPackage): WorkspaceSkillPackage {
  return {
    ...pkg,
    toolScopes: [...pkg.toolScopes],
    pathScopes: [...pkg.pathScopes],
    externalPaths: [...pkg.externalPaths],
  };
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function safeIso(date: Date): string {
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
