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

import type { WorkspaceCapabilities, WorkspaceFile, WorkspaceFileKind, WorkspaceHook, WorkspacePlugin, WorkspaceSkill } from '../types';

export const WORKSPACE_FILES_STORAGE_KEY = 'agent-browser.workspace-files';
export const WORKSPACE_FILE_STORAGE_DEBOUNCE_MS = 120;
export const WORKSPACE_SKILL_DIRECTORIES = ['.agents/skill/', '.agents/skills/'] as const;
const PLUGIN_MANIFESTS = ['plugin.yaml', 'plugin.yml', 'plugin.json', 'manifest.json', 'marketplace.json'] as const;
const KEBAB_CASE_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HOOK_FILENAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$/;

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
      'skills: []',
      'hooks: []',
    ].join('\n'),
  };
}

export function detectWorkspaceFileKind(path: string): WorkspaceFileKind | null {
  if (path.endsWith('AGENTS.md')) return 'agents';
  if (WORKSPACE_SKILL_DIRECTORIES.some((directory) => path.startsWith(directory) && path.endsWith('/SKILL.md'))) return 'skill';
  if (path.startsWith('.agents/hooks/')) return 'hook';
  if (path.startsWith('.agents/plugins/') && PLUGIN_MANIFESTS.some((manifest) => path.endsWith(`/${manifest}`))) return 'plugin';
  if (path.startsWith('.memory/')) return 'memory';
  return null;
}

export function validateWorkspaceFile(file: WorkspaceFile): string | null {
  const kind = detectWorkspaceFileKind(file.path);
  if (!kind) return 'Unsupported workspace file path.';

  if (kind === 'agents') {
    return file.path === 'AGENTS.md' || file.path.endsWith('/AGENTS.md')
      ? null
      : 'AGENTS.md files must be named AGENTS.md.';
  }

  if (kind === 'skill') {
    const root = WORKSPACE_SKILL_DIRECTORIES.find((directory) => file.path.startsWith(directory));
    if (!root) return 'Skills must live in .agents/skill/ or .agents/skills/.';
    const remainder = file.path.slice(root.length);
    const [directoryName, maybeSkillFile, ...rest] = remainder.split('/');
    if (!directoryName || !maybeSkillFile || rest.length) return 'Skills must use <dir>/SKILL.md paths.';
    if (maybeSkillFile !== 'SKILL.md') return 'Skills must be stored in SKILL.md files.';
    if (!KEBAB_CASE_SEGMENT.test(directoryName)) return 'Skill directories must be lowercase kebab-case.';
    return null;
  }

  if (kind === 'hook') {
    const remainder = file.path.replace(/^\.agents\/hooks\//, '');
    const [fileName, ...rest] = remainder.split('/');
    if (!fileName || rest.length) return 'Hooks must use .agents/hooks/<name>.<ext> paths.';
    if (!HOOK_FILENAME.test(fileName)) return 'Hooks must be single lowercase kebab-case files with an extension.';
    return null;
  }

  if (kind === 'plugin') {
    const remainder = file.path.replace(/^\.agents\/plugins\//, '');
    const [directoryName, manifestName, ...rest] = remainder.split('/');
    if (!directoryName || !manifestName || rest.length) return 'Plugins must use .agents/plugins/<plugin>/<manifest> paths.';
    if (!KEBAB_CASE_SEGMENT.test(directoryName)) return 'Plugin directories must be lowercase kebab-case.';
    if (!PLUGIN_MANIFESTS.includes(manifestName as (typeof PLUGIN_MANIFESTS)[number])) return 'Plugins must use a supported manifest filename.';
    return null;
  }

  if (kind === 'memory') {
    return detectWorkspaceMemoryScope(file.path) ? null : 'Unsupported memory file path.';
  }

  return null;
}

function parseSkillFrontmatter(content: string): Pick<WorkspaceSkill, 'name' | 'description'> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const lines = match[1].split('\n');
  const values = Object.fromEntries(lines.map((line) => {
    const [key, ...rest] = line.split(':');
    return [key.trim(), rest.join(':').trim().replace(/^"|"$/g, '')];
  }));
  if (!values.name || !values.description) return null;
  return { name: values.name, description: values.description };
}

export function discoverWorkspaceCapabilities(files: WorkspaceFile[]): WorkspaceCapabilities {
  const agents = files.filter((file) => detectWorkspaceFileKind(file.path) === 'agents');
  const memory = files.filter((file) => detectWorkspaceFileKind(file.path) === 'memory');
  const hooks: WorkspaceHook[] = files
    .filter((file) => detectWorkspaceFileKind(file.path) === 'hook')
    .map((file) => ({ path: file.path, name: file.path.split('/').pop() ?? file.path, content: file.content }));
  const plugins: WorkspacePlugin[] = files
    .filter((file) => detectWorkspaceFileKind(file.path) === 'plugin')
    .map((file) => {
      const segments = file.path.split('/');
      return {
        path: file.path,
        directory: segments[2] ?? file.path,
        manifestName: segments.at(-1) ?? 'plugin.yaml',
        content: file.content,
      };
    });
  const skills: WorkspaceSkill[] = files
    .filter((file) => detectWorkspaceFileKind(file.path) === 'skill')
    .map((file) => {
      const parsed = parseSkillFrontmatter(file.content);
      const segments = file.path.split('/');
      const directory = segments[2] ?? 'skill';
      return parsed
        ? { path: file.path, directory, name: parsed.name, description: parsed.description, content: file.content }
        : { path: file.path, directory, name: directory, description: 'Skill file is missing required frontmatter.', content: file.content };
    });

  return { agents, skills, plugins, hooks, memory };
}

export function buildWorkspacePromptContext(files: WorkspaceFile[], activeAgentPath?: string | null): string {
  const capabilities = discoverWorkspaceCapabilities(files);
  const activeAgent = activeAgentPath
    ? capabilities.agents.find((file) => file.path === activeAgentPath) ?? null
    : null;
  const otherAgents = activeAgent
    ? capabilities.agents.filter((file) => file.path !== activeAgent.path)
    : capabilities.agents;
  if (!capabilities.agents.length && !capabilities.skills.length && !capabilities.plugins.length && !capabilities.hooks.length && !capabilities.memory.length) {
    return 'No workspace capability files are currently stored.';
  }

  return [
    'Workspace capability files loaded from browser storage:',
    buildWorkspaceMemoryPromptContext(files),
    activeAgent
      ? `Active AGENTS.md:\n- ${activeAgent.path}\n${activeAgent.content}`
      : (otherAgents.length
          ? `AGENTS.md files:\n${otherAgents.map((file) => `- ${file.path}\n${file.content}`).join('\n')}`
          : 'AGENTS.md files: none'),
    activeAgent && otherAgents.length
      ? `Other AGENTS.md files:\n${otherAgents.map((file) => `- ${file.path}\n${file.content}`).join('\n')}`
      : null,
    capabilities.skills.length
      ? `Skills:\n${capabilities.skills.map((skill) => `- ${skill.name} (${skill.path}): ${skill.description}`).join('\n')}`
      : 'Skills: none',
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
