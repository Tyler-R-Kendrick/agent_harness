import type { WorkspaceFile } from '../types';

/**
 * Returns a sorted, deduped array of relative directory paths (with trailing
 * slash) derived from workspace file paths.
 *
 * Example: files ["docs/notes.md", ".agents/skill/foo/SKILL.md"] returns
 * [".agents/", ".agents/skill/", ".agents/skill/foo/", "docs/"].
 */
export function collectWorkspaceDirectories(files: WorkspaceFile[]): string[] {
  const dirs = new Set<string>();

  for (const file of files) {
    const segments = file.path.split('/').filter(Boolean);
    // Add every ancestor directory (not the file segment itself)
    for (let depth = 1; depth < segments.length; depth++) {
      dirs.add(segments.slice(0, depth).join('/') + '/');
    }
  }

  return Array.from(dirs).sort();
}
