import {
  buildWorkspaceMemoryPromptContext,
  createDefaultWorkspaceMemoryFiles,
  detectWorkspaceMemoryScope,
  mergeDefaultWorkspaceMemoryFiles,
} from './workspaceMemory';
import {
  buildSettingsPromptContext,
  createDefaultWorkspaceSettingsFiles,
  DEFAULT_SETTINGS_JSON,
  detectWorkspaceSettingsScope,
  mergeDefaultWorkspaceSettingsFiles,
  settingsSnapshotsFromWorkspaceFiles,
  validateWorkspaceSettingsFile,
} from './settingsFiles';
import type { SettingsFileSnapshot } from './settingsFiles';
import {
  detectWorkspaceFileKind as detectCoreWorkspaceFileKind,
  discoverWorkspaceCapabilities as discoverCoreWorkspaceCapabilities,
  validateWorkspaceFile as validateCoreWorkspaceFile,
} from 'harness-core';

import type {
  WorkspaceCapabilities,
  WorkspaceFile,
  WorkspaceFileExtensionOwnership,
  WorkspaceFileKind,
  WorkspaceHook,
  WorkspacePlugin,
  WorkspaceTool,
} from '../types';

export const WORKSPACE_FILES_STORAGE_KEY = 'agent-browser.workspace-files';
export const WORKSPACE_FILE_STORAGE_DEBOUNCE_MS = 120;

const DEFAULT_SYMPHONY_PLUGIN_PATH = '.agents/plugins/symphony/agent-harness.plugin.json';
const LEGACY_DESIGN_STUDIO_GENERATED_PREFIXES = [
  ['design', ['open', 'design'].join('-')].join('/'),
  ['design', ['claude', 'design'].join('-')].join('/'),
  ['design', 'design-studio'].join('/'),
];

export interface RemoveWorkspaceFileOptions {
  allowExtensionLocked?: boolean;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'new-entry';
}

function nowIso() {
  return new Date().toISOString();
}

export function createDefaultWorkspaceFiles(updatedAt = nowIso()): WorkspaceFile[] {
  return [
    ...createDefaultWorkspaceMemoryFiles(updatedAt),
    ...createDefaultWorkspaceSettingsFiles(updatedAt),
    createDefaultSymphonyPluginManifest(updatedAt),
  ];
}

export function createDefaultSymphonyPluginManifest(updatedAt = nowIso()): WorkspaceFile {
  return {
    path: DEFAULT_SYMPHONY_PLUGIN_PATH,
    updatedAt,
    content: [
      '{',
      '  "schemaVersion": 1,',
      '  "id": "agent-harness.ext.symphony",',
      '  "name": "Symphony internal task orchestration",',
      '  "version": "0.1.0",',
      '  "description": "Loads WORKFLOW.md assets and exposes Symphony internal durable task orchestration.",',
      '  "entrypoint": {',
      '    "module": "./src/index.ts",',
      '    "export": "createSymphonyPlugin"',
      '  },',
      '  "capabilities": [',
      '    {',
      '      "kind": "hook",',
      '      "id": "symphony.workflow-md",',
      '      "description": "Prepends selected WORKFLOW.md orchestration guidance before model inference."',
      '    }',
      '  ]',
      '}',
    ].join('\n'),
  };
}

export function mergeDefaultWorkspaceFiles(files: WorkspaceFile[], updatedAt = nowIso()): WorkspaceFile[] {
  const withMemory = mergeDefaultWorkspaceMemoryFiles(files.filter((file) => !isLegacyDesignStudioWorkspaceFile(file.path)));
  const withSettings = mergeDefaultWorkspaceSettingsFiles(withMemory, updatedAt);
  const hasDefaultSymphonyPlugin = withSettings.some((file) => file.path === DEFAULT_SYMPHONY_PLUGIN_PATH);
  return hasDefaultSymphonyPlugin
    ? withSettings
    : [...withSettings, createDefaultSymphonyPluginManifest(updatedAt)];
}

export function isLegacyDesignStudioWorkspaceFile(path: string): boolean {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  return LEGACY_DESIGN_STUDIO_GENERATED_PREFIXES.some((prefix) => normalized.startsWith(`${prefix}/`));
}

export function createWorkspaceFileTemplate(kind: WorkspaceFileKind, name = ''): WorkspaceFile {
  const slug = slugify(name || kind);

  if (kind === 'tool') {
    return {
      path: `.agents/tools/${slug}/tool.json`,
      updatedAt: nowIso(),
      content: [
        '{',
        `  "name": "${slug}",`,
        '  "description": "Describe the tool capability exposed to the harness."',
        '}',
      ].join('\n'),
    };
  }

  if (kind === 'hook') {
    return {
      path: `.agents/hooks/${slug}.sh`,
      updatedAt: nowIso(),
      content: [
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        '',
        `echo "Running ${slug} hook"`,
      ].join('\n'),
    };
  }

  if (kind === 'plugin') {
    return {
      path: `.agents/plugins/${slug}/agent-harness.plugin.json`,
      updatedAt: nowIso(),
      content: [
        '{',
        '  "schemaVersion": 1,',
        `  "id": "local.workspace.${slug}",`,
        `  "name": "${slug}",`,
        '  "version": "0.1.0",',
        '  "description": "Describe the plugin capability exposed to the harness.",',
        '  "entrypoint": { "module": "./src/index.ts" },',
        '  "capabilities": []',
        '}',
      ].join('\n'),
    };
  }

  if (kind === 'settings') {
    return {
      path: 'settings.json',
      updatedAt: nowIso(),
      content: DEFAULT_SETTINGS_JSON,
    };
  }

  return {
    path: `.memory/${slug}.memory.md`,
    updatedAt: nowIso(),
    content: [
      `# ${name || slug} memory`,
      '',
      '- Add durable facts that should shape this workspace.',
    ].join('\n'),
  };
}

export function detectWorkspaceFileKind(path: string): WorkspaceFileKind | null {
  if (detectWorkspaceSettingsScope(path)) {
    return 'settings';
  }

  return detectCoreWorkspaceFileKind(path) as WorkspaceFileKind | null;
}

export function validateWorkspaceFile(file: WorkspaceFile): string | null {
  const kind = detectWorkspaceFileKind(file.path);
  if (!kind) return 'Unsupported workspace file path.';

  if (kind === 'memory') {
    return detectWorkspaceMemoryScope(file.path) ? null : 'Unsupported memory file path.';
  }

  if (kind === 'settings') {
    return validateWorkspaceSettingsFile(file);
  }

  return validateCoreWorkspaceFile(file);
}

export function discoverWorkspaceCapabilities(files: WorkspaceFile[]): WorkspaceCapabilities {
  const coreCapabilities = discoverCoreWorkspaceCapabilities(files);
  return {
    agents: [],
    skills: [],
    tools: coreCapabilities.tools as WorkspaceTool[],
    plugins: coreCapabilities.plugins as WorkspacePlugin[],
    hooks: coreCapabilities.hooks as WorkspaceHook[],
    memory: coreCapabilities.memory as WorkspaceFile[],
    settings: files.filter((file) => Boolean(detectWorkspaceSettingsScope(file.path))),
  };
}

export function buildWorkspacePromptContext(files: WorkspaceFile[], sessionSettingsFiles: readonly SettingsFileSnapshot[] = []): string {
  const capabilities = discoverWorkspaceCapabilities(files);
  if (
    !capabilities.tools.length
    && !capabilities.plugins.length
    && !capabilities.hooks.length
    && !capabilities.memory.length
    && !capabilities.settings.length
    && !sessionSettingsFiles.length
  ) {
    return 'No workspace capability files are currently stored.';
  }

  return [
    'Workspace capability files loaded from browser storage:',
    buildWorkspaceMemoryPromptContext(files),
    buildSettingsPromptContext([
      ...settingsSnapshotsFromWorkspaceFiles(files),
      ...sessionSettingsFiles,
    ]),
    capabilities.tools.length
      ? `Tools:\n${capabilities.tools.map((tool) => `- ${tool.directory} (${tool.path})`).join('\n')}`
      : 'Tools: none',
    capabilities.plugins.length
      ? `Plugins:\n${capabilities.plugins.map((plugin) => `- ${plugin.directory} (${plugin.path})`).join('\n')}`
      : 'Plugins: none',
    capabilities.hooks.length
      ? `Hooks:\n${capabilities.hooks.map((hook) => `- ${hook.name} (${hook.path})`).join('\n')}`
      : 'Hooks: none',
  ].filter((section): section is string => Boolean(section)).join('\n\n');
}

export function loadWorkspaceFiles(workspaceIds: string[]): Record<string, WorkspaceFile[]> {
  const fallback = Object.fromEntries(workspaceIds.map((workspaceId) => [workspaceId, createDefaultWorkspaceFiles()]));
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(WORKSPACE_FILES_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(workspaceIds.map((workspaceId) => {
      const files = Array.isArray(parsed[workspaceId]) ? parsed[workspaceId] : [];
      const storedFiles = files.filter((entry): entry is WorkspaceFile => (
        Boolean(entry)
        && typeof entry === 'object'
        && 'path' in entry
        && 'content' in entry
        && typeof entry.path === 'string'
        && typeof entry.content === 'string'
        && typeof entry.updatedAt === 'string'
      ));
      return [workspaceId, mergeDefaultWorkspaceFiles(storedFiles)];
    }));
  } catch {
    return fallback;
  }
}

export function getWorkspaceFileExtensionOwnership(file: WorkspaceFile): WorkspaceFileExtensionOwnership | null {
  const ownership = file.extensionOwnership;
  if (!ownership || typeof ownership.extensionId !== 'string' || !ownership.extensionId.trim()) return null;
  return {
    extensionId: ownership.extensionId,
    ...(typeof ownership.extensionName === 'string' && ownership.extensionName.trim()
      ? { extensionName: ownership.extensionName }
      : {}),
    ...(ownership.locked === true ? { locked: true } : {}),
  };
}

export function isWorkspaceFileLockedByExtension(file: WorkspaceFile): boolean {
  return getWorkspaceFileExtensionOwnership(file)?.locked === true;
}

export function getWorkspaceFileRemovalBlocker(file: WorkspaceFile): string | null {
  const ownership = getWorkspaceFileExtensionOwnership(file);
  if (!ownership?.locked) return null;
  const label = ownership.extensionName ?? ownership.extensionId;
  return `${file.path} is locked by ${label}. Uninstall the extension to remove it.`;
}

export function upsertWorkspaceFile(files: WorkspaceFile[], file: WorkspaceFile): WorkspaceFile[] {
  const next = [...files];
  const index = next.findIndex((entry) => entry.path === file.path);
  if (index === -1) return [...next, file];
  const existing = next[index]!;
  next[index] = file.extensionOwnership === undefined && existing.extensionOwnership
    ? { ...file, extensionOwnership: existing.extensionOwnership }
    : file;
  return next;
}

export function removeWorkspaceFile(files: WorkspaceFile[], path: string, options: RemoveWorkspaceFileOptions = {}): WorkspaceFile[] {
  const target = files.find((file) => file.path === path);
  if (target && isWorkspaceFileLockedByExtension(target) && options.allowExtensionLocked !== true) {
    return files;
  }
  return files.filter((file) => file.path !== path);
}

export function removeWorkspaceFilesForExtensions(files: WorkspaceFile[], extensionIds: readonly string[]): WorkspaceFile[] {
  const removedIds = new Set(extensionIds);
  if (!removedIds.size) return files;
  return files.filter((file) => {
    const ownership = getWorkspaceFileExtensionOwnership(file);
    return !ownership || !removedIds.has(ownership.extensionId);
  });
}
