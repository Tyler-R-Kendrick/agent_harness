import type { WorkspaceFile } from '../types';

export type WorkspaceMemoryScope = 'global' | 'user' | 'project' | 'workspace' | 'session';

export interface WorkspaceMemoryFileDefinition {
  scope: WorkspaceMemoryScope;
  path: string;
  title: string;
  description: string;
}

export interface WorkspaceMemoryEntry {
  scope: WorkspaceMemoryScope;
  path: string;
  lineNumber: number;
  text: string;
}

export interface WorkspaceMemorySearchOptions {
  scopes?: readonly WorkspaceMemoryScope[];
  limit?: number;
}

export interface WorkspaceMemoryEntryRef {
  path: string;
  lineNumber: number;
}

export const MEMORY_FILE_DEFINITIONS: readonly WorkspaceMemoryFileDefinition[] = [
  {
    scope: 'global',
    path: '.memory/MEMORY.md',
    title: 'Memory',
    description: 'Global durable facts that apply across this workspace.',
  },
  {
    scope: 'user',
    path: '.memory/user.memory.md',
    title: 'User Memory',
    description: 'User preferences, durable instructions, and stable collaboration patterns.',
  },
  {
    scope: 'project',
    path: '.memory/project.memory.md',
    title: 'Project Memory',
    description: 'Project-specific architecture, conventions, and implementation decisions.',
  },
  {
    scope: 'workspace',
    path: '.memory/workspace.memory.md',
    title: 'Workspace Memory',
    description: 'Workspace-local facts, paths, tooling notes, and current checkout context.',
  },
  {
    scope: 'session',
    path: '.memory/session.memory.md',
    title: 'Session Memory',
    description: 'Short-lived facts that matter to the current browser session.',
  },
] as const;

const MEMORY_SCOPE_PRIORITY: Readonly<Record<WorkspaceMemoryScope, number>> = {
  session: 0,
  workspace: 1,
  project: 2,
  user: 3,
  global: 4,
};

function createMemoryTemplate(definition: WorkspaceMemoryFileDefinition): string {
  return [
    `# ${definition.title}`,
    '',
    `<!-- ${definition.description} Store each fact as a markdown list item. -->`,
  ].join('\n');
}

export function createDefaultWorkspaceMemoryFiles(updatedAt = new Date().toISOString()): WorkspaceFile[] {
  return MEMORY_FILE_DEFINITIONS.map((definition) => ({
    path: definition.path,
    content: createMemoryTemplate(definition),
    updatedAt,
  }));
}

export function mergeDefaultWorkspaceMemoryFiles(
  files: readonly WorkspaceFile[],
  updatedAt = new Date().toISOString(),
): WorkspaceFile[] {
  const existingPaths = new Set(files.map((file) => file.path));
  const nextFiles = [...files];

  for (const file of createDefaultWorkspaceMemoryFiles(updatedAt)) {
    if (!existingPaths.has(file.path)) {
      nextFiles.push(file);
    }
  }

  return nextFiles;
}

export function detectWorkspaceMemoryScope(path: string): WorkspaceMemoryScope | null {
  return MEMORY_FILE_DEFINITIONS.find((definition) => definition.path === path)?.scope ?? null;
}

function definitionForScope(scope: WorkspaceMemoryScope): WorkspaceMemoryFileDefinition {
  return MEMORY_FILE_DEFINITIONS.find((definition) => definition.scope === scope)!;
}

export function parseWorkspaceMemoryFiles(files: readonly WorkspaceFile[]): WorkspaceMemoryEntry[] {
  const entries: WorkspaceMemoryEntry[] = [];

  for (const file of files) {
    const scope = detectWorkspaceMemoryScope(file.path);
    if (!scope) continue;

    const lines = file.content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const match = line.match(/^\s*[-*]\s+(.+?)\s*$/);
      if (!match) return;

      const text = match[1].trim();
      if (text.length > 0) {
        entries.push({
          scope,
          path: file.path,
          lineNumber: index + 1,
          text,
        });
      }
    });
  }

  return entries;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function searchWorkspaceMemory(
  files: readonly WorkspaceFile[],
  query: string,
  options: WorkspaceMemorySearchOptions = {},
): WorkspaceMemoryEntry[] {
  const allowedScopes = options.scopes ? new Set(options.scopes) : null;
  const queryTokens = tokenize(query);
  const entries = parseWorkspaceMemoryFiles(files)
    .filter((entry) => !allowedScopes || allowedScopes.has(entry.scope));

  const scored = entries
    .map((entry, index) => {
      const entryTokens = tokenize(entry.text);
      const score = queryTokens.length === 0
        ? 1
        : queryTokens.filter((token) => entryTokens.includes(token)).length;
      return { entry, index, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => (
      right.score - left.score
      || MEMORY_SCOPE_PRIORITY[left.entry.scope] - MEMORY_SCOPE_PRIORITY[right.entry.scope]
      || left.index - right.index
    ));

  return scored
    .slice(0, options.limit ?? scored.length)
    .map(({ entry }) => entry);
}

function sanitizeFact(fact: string): string {
  return fact
    .replace(/\r?\n/g, ' ')
    .replace(/^\s*[-*]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function appendWorkspaceMemoryFact(
  files: readonly WorkspaceFile[],
  scope: WorkspaceMemoryScope,
  fact: string,
  updatedAt = new Date().toISOString(),
): WorkspaceFile[] {
  const sanitized = sanitizeFact(fact);
  if (!sanitized) return [...files];

  const definition = definitionForScope(scope);
  const nextFiles = [...files];
  const index = nextFiles.findIndex((file) => file.path === definition.path);

  if (index === -1) {
    return [
      ...nextFiles,
      {
        path: definition.path,
        content: `${createMemoryTemplate(definition)}\n- ${sanitized}`,
        updatedAt,
      },
    ];
  }

  const current = nextFiles[index];
  const content = current.content.trimEnd();
  nextFiles[index] = {
    ...current,
    content: `${content}${content ? '\n' : ''}- ${sanitized}`,
    updatedAt,
  };
  return nextFiles;
}

function updateMemoryLine(
  files: readonly WorkspaceFile[],
  ref: WorkspaceMemoryEntryRef,
  updater: (line: string) => string | null,
  updatedAt: string,
): WorkspaceFile[] {
  const nextFiles = [...files];
  const fileIndex = nextFiles.findIndex((file) => file.path === ref.path);
  if (fileIndex === -1 || ref.lineNumber < 1) return nextFiles;

  const current = nextFiles[fileIndex];
  const lines = current.content.split(/\r?\n/);
  const lineIndex = ref.lineNumber - 1;
  const currentLine = lines[lineIndex];
  if (currentLine === undefined || !/^\s*[-*]\s+/.test(currentLine)) return nextFiles;

  const nextLine = updater(currentLine);
  if (nextLine === null) {
    lines.splice(lineIndex, 1);
  } else {
    lines[lineIndex] = nextLine;
  }

  nextFiles[fileIndex] = {
    ...current,
    content: lines.join('\n'),
    updatedAt,
  };
  return nextFiles;
}

export function deleteWorkspaceMemoryEntry(
  files: readonly WorkspaceFile[],
  ref: WorkspaceMemoryEntryRef,
  updatedAt = new Date().toISOString(),
): WorkspaceFile[] {
  return updateMemoryLine(files, ref, () => null, updatedAt);
}

export function updateWorkspaceMemoryEntry(
  files: readonly WorkspaceFile[],
  ref: WorkspaceMemoryEntryRef,
  fact: string,
  updatedAt = new Date().toISOString(),
): WorkspaceFile[] {
  const sanitized = sanitizeFact(fact);
  if (!sanitized) return deleteWorkspaceMemoryEntry(files, ref, updatedAt);
  return updateMemoryLine(files, ref, () => `- ${sanitized}`, updatedAt);
}

export function buildWorkspaceMemoryPromptContext(files: readonly WorkspaceFile[], query = ''): string {
  const entries = query.trim()
    ? searchWorkspaceMemory(files, query, { limit: 12 })
    : parseWorkspaceMemoryFiles(files).slice(0, 12);

  if (entries.length === 0) {
    return [
      'Workspace memory files loaded from .memory/:',
      'No stored memory factoids found. Use the Memory agent to add durable facts as markdown list items when the user asks you to remember stable context.',
    ].join('\n');
  }

  return [
    'Workspace memory files loaded from .memory/:',
    ...entries.map((entry) => `- [${entry.scope}] ${entry.text} (${entry.path}:${entry.lineNumber})`),
  ].join('\n');
}
