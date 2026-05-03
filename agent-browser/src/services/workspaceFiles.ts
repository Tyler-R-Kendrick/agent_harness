import {
  buildWorkspaceMemoryPromptContext,
  createDefaultWorkspaceMemoryFiles,
  detectWorkspaceMemoryScope,
  mergeDefaultWorkspaceMemoryFiles,
} from './workspaceMemory';
import {
  detectWorkspaceFileKind as detectCoreWorkspaceFileKind,
  discoverWorkspaceCapabilities as discoverCoreWorkspaceCapabilities,
  validateWorkspaceFile as validateCoreWorkspaceFile,
} from 'harness-core';

import type { WorkspaceCapabilities, WorkspaceFile, WorkspaceFileKind, WorkspaceHook, WorkspacePlugin, WorkspaceTool } from '../types';

export const WORKSPACE_FILES_STORAGE_KEY = 'agent-browser.workspace-files';
export const WORKSPACE_FILE_STORAGE_DEBOUNCE_MS = 120;

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
  ];
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
  return detectCoreWorkspaceFileKind(path) as WorkspaceFileKind | null;
}

export function validateWorkspaceFile(file: WorkspaceFile): string | null {
  const kind = detectWorkspaceFileKind(file.path);
  if (!kind) return 'Unsupported workspace file path.';

  if (kind === 'memory') {
    return detectWorkspaceMemoryScope(file.path) ? null : 'Unsupported memory file path.';
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
  };
}

export function buildWorkspacePromptContext(files: WorkspaceFile[]): string {
  const capabilities = discoverWorkspaceCapabilities(files);
  if (!capabilities.tools.length && !capabilities.plugins.length && !capabilities.hooks.length && !capabilities.memory.length) {
    return 'No workspace capability files are currently stored.';
  }

  return [
    'Workspace capability files loaded from browser storage:',
    buildWorkspaceMemoryPromptContext(files),
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
      return [workspaceId, mergeDefaultWorkspaceMemoryFiles(storedFiles)];
    }));
  } catch {
    return fallback;
  }
}

export function upsertWorkspaceFile(files: WorkspaceFile[], file: WorkspaceFile): WorkspaceFile[] {
  const next = [...files];
  const index = next.findIndex((entry) => entry.path === file.path);
  if (index === -1) return [...next, file];
  next[index] = file;
  return next;
}

export function removeWorkspaceFile(files: WorkspaceFile[], path: string): WorkspaceFile[] {
  return files.filter((file) => file.path !== path);
}
