import type { WorkspaceFile } from '../types';

export type AgentBrowserSettingsScope = 'global' | 'project' | 'session';

export interface SettingsFileSnapshot {
  scope: AgentBrowserSettingsScope;
  path: string;
  content: string;
  updatedAt?: string;
  sessionId?: string;
  label?: string;
}

export interface ResolvedSettingsScope extends SettingsFileSnapshot {
  label: string;
  values: Record<string, unknown>;
  error?: string;
}

export interface SettingsResolution {
  scopes: ResolvedSettingsScope[];
  effective: Record<string, unknown>;
  errors: Array<{
    scope: AgentBrowserSettingsScope;
    path: string;
    sessionId?: string;
    error: string;
  }>;
}

export const USER_SETTINGS_PATH = 'user/settings.json';
export const PROJECT_SETTINGS_PATH = 'settings.json';
export const SESSION_WORKSPACE_SETTINGS_PATH = '/workspace/settings.json';
export const DEFAULT_SETTINGS_JSON = '{\n}\n';

const SETTINGS_SCOPE_ORDER: Readonly<Record<AgentBrowserSettingsScope, number>> = {
  global: 0,
  project: 1,
  session: 2,
};

function sortSettingsObject(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function isSettingsObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function settingsScopeLabel(snapshot: Pick<SettingsFileSnapshot, 'scope' | 'label' | 'sessionId'>): string {
  if (snapshot.scope === 'global') return 'global(user)';
  if (snapshot.scope === 'project') return 'project(default workspace)';

  const suffix = snapshot.label?.trim() || snapshot.sessionId?.trim() || '';
  if (suffix.startsWith('<session>')) return suffix;
  return suffix ? `<session> ${suffix}` : '<session>';
}

function bySettingsPrecedence(left: SettingsFileSnapshot, right: SettingsFileSnapshot): number {
  const scopeCompare = SETTINGS_SCOPE_ORDER[left.scope] - SETTINGS_SCOPE_ORDER[right.scope];
  if (scopeCompare) return scopeCompare;
  return settingsScopeLabel(left).localeCompare(settingsScopeLabel(right));
}

export function serializeSettingsJson(values: Record<string, unknown>): string {
  return `${JSON.stringify(sortSettingsObject(values), null, 2)}\n`;
}

export function createDefaultWorkspaceSettingsFiles(updatedAt = new Date().toISOString()): WorkspaceFile[] {
  return [
    { path: USER_SETTINGS_PATH, content: DEFAULT_SETTINGS_JSON, updatedAt },
    { path: PROJECT_SETTINGS_PATH, content: DEFAULT_SETTINGS_JSON, updatedAt },
  ];
}

export function createDefaultSessionWorkspaceFiles(workspacePath = '/workspace'): Record<string, string> {
  return {
    [`${workspacePath.replace(/\/+$/, '')}/settings.json`]: DEFAULT_SETTINGS_JSON,
  };
}

export function mergeDefaultWorkspaceSettingsFiles(
  files: readonly WorkspaceFile[],
  updatedAt = new Date().toISOString(),
): WorkspaceFile[] {
  const existingPaths = new Set(files.map((file) => file.path));
  const nextFiles = [...files];

  for (const file of createDefaultWorkspaceSettingsFiles(updatedAt)) {
    if (!existingPaths.has(file.path)) {
      nextFiles.push(file);
    }
  }

  return nextFiles;
}

export function detectWorkspaceSettingsScope(path: string): AgentBrowserSettingsScope | null {
  if (path === USER_SETTINGS_PATH) return 'global';
  if (path === PROJECT_SETTINGS_PATH) return 'project';
  return null;
}

export function parseSettingsJson(content: string, path = 'settings.json'): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TypeError(`Invalid JSON in ${path}: ${message}`);
  }

  if (!isSettingsObject(parsed)) {
    throw new TypeError(`Settings file ${path} must contain a top-level JSON object.`);
  }

  return parsed;
}

export function validateWorkspaceSettingsFile(file: WorkspaceFile): string | null {
  if (!detectWorkspaceSettingsScope(file.path)) {
    return 'Unsupported settings file path. Use user/settings.json or settings.json.';
  }

  try {
    parseSettingsJson(file.content, file.path);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export function settingsSnapshotsFromWorkspaceFiles(files: readonly WorkspaceFile[]): SettingsFileSnapshot[] {
  return files
    .map((file): SettingsFileSnapshot | null => {
      const scope = detectWorkspaceSettingsScope(file.path);
      return scope ? { ...file, scope } : null;
    })
    .filter((file): file is SettingsFileSnapshot => Boolean(file));
}

export function resolveSettingsFiles(snapshots: readonly SettingsFileSnapshot[]): SettingsResolution {
  const scopes: ResolvedSettingsScope[] = [];
  const errors: SettingsResolution['errors'] = [];
  const effective: Record<string, unknown> = {};

  for (const snapshot of [...snapshots].sort(bySettingsPrecedence)) {
    try {
      const values = sortSettingsObject(parseSettingsJson(snapshot.content, snapshot.path));
      Object.assign(effective, values);
      scopes.push({
        ...snapshot,
        label: settingsScopeLabel(snapshot),
        values,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        scope: snapshot.scope,
        path: snapshot.path,
        ...(snapshot.sessionId ? { sessionId: snapshot.sessionId } : {}),
        error: message,
      });
      scopes.push({
        ...snapshot,
        label: settingsScopeLabel(snapshot),
        values: {},
        error: message,
      });
    }
  }

  return {
    scopes,
    effective: sortSettingsObject(effective),
    errors,
  };
}

export function buildSettingsPromptContext(snapshots: readonly SettingsFileSnapshot[]): string {
  const resolved = resolveSettingsFiles(snapshots);
  if (!resolved.scopes.length) {
    return 'No settings.json files are currently loaded.';
  }

  return [
    'Settings files loaded with VS Code-style precedence: global(user) -> project(default workspace) -> <session>.',
    'Agents may read these settings and update them through settings tools; users may also edit the JSON files manually.',
    'Loaded scopes:',
    ...resolved.scopes.map((scope) => {
      const suffix = scope.error ? ` (ignored: ${scope.error})` : '';
      return `- [${scope.label}] ${scope.path}${suffix}`;
    }),
    'Effective settings:',
    serializeSettingsJson(resolved.effective).trimEnd(),
  ].join('\n');
}
