import type { WorkspaceFile } from '../types';

const DEFAULT_AGENT_SKILL_MODULES = import.meta.glob('../../agent-skills/*/**', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function toWorkspaceSkillPath(modulePath: string): string | null {
  const match = modulePath.match(/^\.\.\/\.\.\/agent-skills\/([^/]+)\/(.+)$/);
  if (!match) return null;

  const [, skillName, relativePath] = match;
  if (relativePath.endsWith('.test.ts')) return null;

  return `.agents/skills/${skillName}/${relativePath}`;
}

const DEFAULT_AGENT_SKILL_FILES = Object.entries(DEFAULT_AGENT_SKILL_MODULES)
  .map(([modulePath, content]) => {
    const path = toWorkspaceSkillPath(modulePath);
    return path ? { path, content } : null;
  })
  .filter((file): file is { path: string; content: string } => file !== null)
  .sort((left, right) => left.path.localeCompare(right.path));

export function createDefaultWorkspaceAgentSkillFiles(updatedAt = new Date().toISOString()): WorkspaceFile[] {
  return DEFAULT_AGENT_SKILL_FILES.map((file) => ({
    path: file.path,
    content: file.content,
    updatedAt,
  }));
}

export function mergeDefaultWorkspaceAgentSkillFiles(
  files: readonly WorkspaceFile[],
  updatedAt = new Date().toISOString(),
): WorkspaceFile[] {
  const existingPaths = new Set(files.map((file) => file.path));
  const nextFiles = [...files];

  for (const file of createDefaultWorkspaceAgentSkillFiles(updatedAt)) {
    if (!existingPaths.has(file.path)) {
      nextFiles.push(file);
    }
  }

  return nextFiles;
}