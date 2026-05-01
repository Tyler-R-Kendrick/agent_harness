import {
  createDefaultWorkspaceAgentSkillFiles,
  mergeDefaultWorkspaceAgentSkillFiles,
} from './defaultAgentSkills';
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
import {
  WORKSPACE_SKILL_DIRECTORIES,
  detectAgentSkillFile,
  discoverAgentSkills,
  validateAgentSkillFile,
} from 'harness-core/ext/agent-skills';
import {
  buildAgentsMdPromptContext,
  detectAgentsMdFile,
  discoverAgentsMdFiles,
  validateAgentsMdFile,
} from 'harness-core/ext/agents-md';

import type { WorkspaceCapabilities, WorkspaceFile, WorkspaceFileKind, WorkspaceHook, WorkspacePlugin, WorkspaceSkill, WorkspaceTool } from '../types';

export const WORKSPACE_FILES_STORAGE_KEY = 'agent-browser.workspace-files';
export const WORKSPACE_FILE_STORAGE_DEBOUNCE_MS = 120;
export { WORKSPACE_SKILL_DIRECTORIES };

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
    ...createDefaultWorkspaceAgentSkillFiles(updatedAt),
    ...createDefaultWorkspaceMemoryFiles(updatedAt),
  ];
}

export function createWorkspaceFileTemplate(kind: WorkspaceFileKind, name = ''): WorkspaceFile {
  const slug = slugify(name || (kind === 'agents' ? 'workspace' : kind));
  if (kind === 'agents') {
    return {
      path: 'AGENTS.md',
      updatedAt: nowIso(),
      content: [
        '# Workspace agent instructions',
        '',
        '## Goals',
        '- Describe the expected outcomes for this workspace.',
        '',
        '## Constraints',
        '- Add safety, testing, or review rules the harness should respect.',
      ].join('\n'),
    };
  }

  if (kind === 'skill') {
    return {
      path: `.agents/skills/${slug}/SKILL.md`,
      updatedAt: nowIso(),
      content: [
        '---',
        `name: ${slug}`,
        `description: Use this skill when working on ${name || slug}.`,
        '---',
        '',
        '# Steps',
        '1. Describe when to load this skill.',
        '2. Explain the workflow or checks to run.',
      ].join('\n'),
    };
  }

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

  return {
    path: `.agents/plugins/${slug}/plugin.yaml`,
    updatedAt: nowIso(),
    content: [
      `name: ${slug}`,
      'version: 0.1.0',
      'description: Describe the plugin capability exposed to the harness.',
      'tools: []',
      'hooks: []',
    ].join('\n'),
  };
}

export function detectWorkspaceFileKind(path: string): WorkspaceFileKind | null {
  if (detectAgentsMdFile(path)) return 'agents';
  if (detectAgentSkillFile(path)) return 'skill';
  return detectCoreWorkspaceFileKind(path) as WorkspaceFileKind | null;
}

export function validateWorkspaceFile(file: WorkspaceFile): string | null {
  const kind = detectWorkspaceFileKind(file.path);
  if (!kind) return 'Unsupported workspace file path.';

  if (kind === 'memory') {
    return detectWorkspaceMemoryScope(file.path) ? null : 'Unsupported memory file path.';
  }

  if (kind === 'agents') return validateAgentsMdFile(file);
  if (kind === 'skill') return validateAgentSkillFile(file);

  return validateCoreWorkspaceFile(file);
}

export function discoverWorkspaceCapabilities(files: WorkspaceFile[]): WorkspaceCapabilities {
  const coreCapabilities = discoverCoreWorkspaceCapabilities(files);
  return {
    agents: discoverAgentsMdFiles(files) as WorkspaceFile[],
    skills: discoverAgentSkills(files) as WorkspaceSkill[],
    tools: coreCapabilities.tools as WorkspaceTool[],
    plugins: coreCapabilities.plugins as WorkspacePlugin[],
    hooks: coreCapabilities.hooks as WorkspaceHook[],
    memory: coreCapabilities.memory as WorkspaceFile[],
  };
}

export function buildWorkspacePromptContext(files: WorkspaceFile[], activeAgentPath?: string | null): string {
  const capabilities = discoverWorkspaceCapabilities(files);
  if (!capabilities.agents.length && !capabilities.skills.length && !capabilities.tools.length && !capabilities.plugins.length && !capabilities.hooks.length && !capabilities.memory.length) {
    return 'No workspace capability files are currently stored.';
  }

  return [
    'Workspace capability files loaded from browser storage:',
    buildWorkspaceMemoryPromptContext(files),
    buildAgentsMdPromptContext(files, { activeAgentPath }),
    capabilities.skills.length
      ? `Skills:\n${capabilities.skills.map((skill) => `- ${skill.name} (${skill.path}): ${skill.description}`).join('\n')}`
      : 'Skills: none',
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
      return [workspaceId, mergeDefaultWorkspaceMemoryFiles(mergeDefaultWorkspaceAgentSkillFiles(storedFiles))];
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
