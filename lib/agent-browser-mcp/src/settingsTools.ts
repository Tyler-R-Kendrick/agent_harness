import { ModelContext } from '@agent-harness/webmcp';

import type {
  RegisterWorkspaceToolsOptions,
  WorkspaceMcpSettingsFile,
  WorkspaceMcpSettingsScope,
} from './workspaceToolTypes';
import {
  isPlainObject,
  normalizeSessionFsPath,
  requireCallback,
} from './workspaceToolShared';

type SettingsReadScope = WorkspaceMcpSettingsScope | 'effective';

type ListSettingsInput = {
  includeValues?: boolean;
};

type ReadSettingsInput = {
  scope?: string;
  sessionId?: string;
  includeContent?: boolean;
};

type WriteSettingsInput = {
  scope?: string;
  sessionId?: string;
  content?: string;
  values?: unknown;
};

type UpdateSettingInput = {
  scope?: string;
  sessionId?: string;
  key?: string;
  value?: unknown;
};

const USER_SETTINGS_PATH = 'user/settings.json';
const PROJECT_SETTINGS_PATH = 'settings.json';
const SESSION_SETTINGS_PATH = '/workspace/settings.json';
const DEFAULT_SETTINGS_CONTENT = '{\n}\n';

const SETTINGS_SCOPE_ORDER: Readonly<Record<WorkspaceMcpSettingsScope, number>> = {
  global: 0,
  project: 1,
  session: 2,
};

function scopeLabel(file: Pick<WorkspaceMcpSettingsFile, 'scope' | 'label' | 'sessionId'>): string {
  if (file.scope === 'global') return 'global(user)';
  if (file.scope === 'project') return 'project(default workspace)';
  const suffix = file.label?.trim() || file.sessionId?.trim() || '';
  if (suffix.startsWith('<session>')) return suffix;
  return suffix ? `<session> ${suffix}` : '<session>';
}

function sortSettingsObject(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function serializeSettingsJson(values: Record<string, unknown>): string {
  return `${JSON.stringify(sortSettingsObject(values), null, 2)}\n`;
}

function parseSettingsJson(content: string, path: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const message = String(error);
    throw new TypeError(`Invalid JSON in ${path}: ${message}`);
  }

  if (!isPlainObject(parsed)) {
    throw new TypeError(`Settings file ${path} must contain a top-level JSON object.`);
  }

  return parsed;
}

function normalizeScope(scope: unknown): WorkspaceMcpSettingsScope {
  if (scope === 'global' || scope === 'project' || scope === 'session') {
    return scope;
  }

  throw new TypeError('Settings scope must be one of global, project, or session.');
}

function normalizeReadScope(scope: unknown): SettingsReadScope {
  if (scope === undefined || scope === null || scope === 'effective') {
    return 'effective';
  }
  return normalizeScope(scope);
}

function settingsFilePathForScope(scope: Exclude<WorkspaceMcpSettingsScope, 'session'>): string {
  if (scope === 'global') return USER_SETTINGS_PATH;
  return PROJECT_SETTINGS_PATH;
}

function normalizeSettingsFile(file: WorkspaceMcpSettingsFile): WorkspaceMcpSettingsFile {
  return {
    ...file,
    label: scopeLabel(file),
    path: file.scope === 'session' ? normalizeSessionFsPath(file.path) : file.path,
  };
}

function workspaceSettingsFiles(options: RegisterWorkspaceToolsOptions): WorkspaceMcpSettingsFile[] {
  const workspaceFiles = options.workspaceFiles
    .map((file): WorkspaceMcpSettingsFile | null => {
      if (file.path === USER_SETTINGS_PATH) {
        return { scope: 'global', label: 'global(user)', path: file.path, content: file.content, updatedAt: file.updatedAt };
      }
      if (file.path === PROJECT_SETTINGS_PATH) {
        return { scope: 'project', label: 'project(default workspace)', path: file.path, content: file.content, updatedAt: file.updatedAt };
      }
      return null;
    })
    .filter((file): file is WorkspaceMcpSettingsFile => Boolean(file));
  const sessionFiles = (options.sessionFsEntries ?? [])
    .filter((entry) => entry.kind === 'file' && normalizeSessionFsPath(entry.path) === SESSION_SETTINGS_PATH && typeof entry.content === 'string')
    .map((entry): WorkspaceMcpSettingsFile => ({
      scope: 'session',
      label: `<session> ${entry.sessionId}`,
      sessionId: entry.sessionId,
      path: SESSION_SETTINGS_PATH,
      content: entry.content as string,
    }));

  return [...workspaceFiles, ...sessionFiles];
}

async function readSettingsFiles(options: RegisterWorkspaceToolsOptions): Promise<WorkspaceMcpSettingsFile[]> {
  const files = options.getSettingsFiles
    ? await options.getSettingsFiles()
    : workspaceSettingsFiles(options);
  return [...files].map(normalizeSettingsFile).sort((left, right) => {
    const scopeCompare = SETTINGS_SCOPE_ORDER[left.scope] - SETTINGS_SCOPE_ORDER[right.scope];
    if (scopeCompare) return scopeCompare;
    return scopeLabel(left).localeCompare(scopeLabel(right));
  });
}

function resolveSettings(files: readonly WorkspaceMcpSettingsFile[]) {
  const effective: Record<string, unknown> = {};
  const errors: Array<{ scope: WorkspaceMcpSettingsScope; path: string; sessionId?: string; error: string }> = [];
  const sources = files.map((file) => ({
    scope: file.scope,
    label: scopeLabel(file),
    path: file.path,
    ...(file.sessionId ? { sessionId: file.sessionId } : {}),
  }));

  for (const file of files) {
    try {
      Object.assign(effective, parseSettingsJson(file.content, file.path));
    } catch (error) {
      errors.push({
        scope: file.scope,
        path: file.path,
        ...(file.sessionId ? { sessionId: file.sessionId } : {}),
        error: String(error),
      });
    }
  }

  return {
    values: sortSettingsObject(effective),
    errors,
    sources,
  };
}

function valuesForFile(file: WorkspaceMcpSettingsFile): Record<string, unknown> {
  return sortSettingsObject(parseSettingsJson(file.content, file.path));
}

function resolveScopedSettingsFile(
  files: readonly WorkspaceMcpSettingsFile[],
  scope: WorkspaceMcpSettingsScope,
  sessionId?: string,
): WorkspaceMcpSettingsFile {
  if (scope === 'session') {
    if (!sessionId) {
      const sessionFiles = files.filter((file) => file.scope === 'session');
      if (sessionFiles.length === 1) {
        return sessionFiles[0]!;
      }
      throw new TypeError('Session settings require a sessionId when reading or writing <session> settings.');
    }
    const sessionFile = files.find((file) => file.scope === 'session' && file.sessionId === sessionId);
    if (sessionFile) return sessionFile;
    return {
      scope: 'session',
      label: `<session> ${sessionId}`,
      sessionId,
      path: SESSION_SETTINGS_PATH,
      content: DEFAULT_SETTINGS_CONTENT,
    };
  }

  const scopedFile = files.find((file) => file.scope === scope);
  return scopedFile ?? {
    scope,
    label: scopeLabel({ scope }),
    path: settingsFilePathForScope(scope),
    content: DEFAULT_SETTINGS_CONTENT,
  };
}

function toScopeResult(file: WorkspaceMcpSettingsFile, includeValues: boolean) {
  return {
    scope: file.scope,
    label: scopeLabel(file),
    ...(file.sessionId ? { sessionId: file.sessionId } : {}),
    path: file.path,
    ...(includeValues ? { values: valuesForFile(file) } : {}),
  };
}

async function writeSettingsFile(
  options: RegisterWorkspaceToolsOptions,
  input: WorkspaceMcpSettingsFile,
) {
  const writer = requireCallback(options.onWriteSettingsFile, 'Writing settings files is not supported in this workspace.');
  const result = await writer(input);
  const written = normalizeSettingsFile(isPlainObject(result) && typeof result.content === 'string'
    ? result as unknown as WorkspaceMcpSettingsFile
    : input);
  return {
    scope: written.scope,
    label: scopeLabel(written),
    ...(written.sessionId ? { sessionId: written.sessionId } : {}),
    path: written.path,
    content: written.content,
    values: valuesForFile(written),
    ...(written.updatedAt ? { updatedAt: written.updatedAt } : {}),
  };
}

export function registerSettingsTools(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const { workspaceName, signal } = options;

  modelContext.registerTool({
    name: 'list_settings_scopes',
    title: 'List settings scopes',
    description: `List JSON settings scopes available in ${workspaceName}: global(user), project(default workspace), and per-session /workspace/settings.json files.`,
    inputSchema: {
      type: 'object',
      properties: {
        includeValues: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    execute: async (input: object) => {
      const typedInput = input as ListSettingsInput;
      const files = await readSettingsFiles(options);
      return files.map((file) => toScopeResult(file, typedInput.includeValues === true));
    },
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'read_settings',
    title: 'Read settings',
    description: 'Read a settings.json scope or the effective settings after applying global(user), project(default workspace), then <session> precedence.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['effective', 'global', 'project', 'session'] },
        sessionId: { type: 'string' },
        includeContent: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    execute: async (input: object) => {
      const typedInput = input as ReadSettingsInput;
      const files = await readSettingsFiles(options);
      const scope = normalizeReadScope(typedInput.scope);

      if (scope === 'effective') {
        return { scope, ...resolveSettings(files) };
      }

      const file = resolveScopedSettingsFile(files, scope, typedInput.sessionId);
      return {
        ...toScopeResult(file, true),
        ...(typedInput.includeContent === true ? { content: file.content } : {}),
      };
    },
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'write_settings',
    title: 'Write settings',
    description: 'Replace a settings.json file for the global(user), project(default workspace), or <session> scope using JSON content or a values object.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['global', 'project', 'session'] },
        sessionId: { type: 'string' },
        content: { type: 'string' },
        values: { type: 'object' },
      },
      required: ['scope'],
      additionalProperties: false,
    },
    execute: async (input: object) => {
      const typedInput = input as WriteSettingsInput;
      const scope = normalizeScope(typedInput.scope);
      const files = await readSettingsFiles(options);
      const current = resolveScopedSettingsFile(files, scope, typedInput.sessionId);
      const content = typeof typedInput.content === 'string'
        ? typedInput.content
        : isPlainObject(typedInput.values)
          ? serializeSettingsJson(typedInput.values)
          : (() => { throw new TypeError('write_settings requires content or values.'); })();
      const values = parseSettingsJson(content, current.path);
      return writeSettingsFile(options, {
        ...current,
        content: serializeSettingsJson(values),
      });
    },
  }, { signal });

  modelContext.registerTool({
    name: 'update_setting',
    title: 'Update setting',
    description: 'Set one key in a settings.json file while preserving the other JSON settings in that scope.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['global', 'project', 'session'] },
        sessionId: { type: 'string' },
        key: { type: 'string' },
        value: {},
      },
      required: ['scope', 'key', 'value'],
      additionalProperties: false,
    },
    execute: async (input: object) => {
      const typedInput = input as UpdateSettingInput;
      const scope = normalizeScope(typedInput.scope);
      const key = typeof typedInput.key === 'string' ? typedInput.key.trim() : '';
      if (!key) {
        throw new TypeError('update_setting requires a non-empty key.');
      }

      const files = await readSettingsFiles(options);
      const current = resolveScopedSettingsFile(files, scope, typedInput.sessionId);
      const values = {
        ...valuesForFile(current),
        [key]: typedInput.value,
      };
      return writeSettingsFile(options, {
        ...current,
        content: serializeSettingsJson(values),
      });
    },
  }, { signal });
}
