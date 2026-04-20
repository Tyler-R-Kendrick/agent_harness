import { describe, it, expect } from 'vitest';
import { collectWorkspaceDirectories } from './workspaceDirectories';
import type { WorkspaceFile } from '../types';

function makeFile(path: string): WorkspaceFile {
  return { path, content: '', updatedAt: new Date().toISOString() };
}

describe('collectWorkspaceDirectories', () => {
  it('returns empty array when given no files', () => {
    expect(collectWorkspaceDirectories([])).toEqual([]);
  });

  it('returns no dirs for root-level files (no parent segment)', () => {
    expect(collectWorkspaceDirectories([makeFile('AGENTS.md')])).toEqual([]);
  });

  it('extracts the parent directory from a single nested file', () => {
    expect(collectWorkspaceDirectories([makeFile('docs/notes.md')])).toEqual(['docs/']);
  });

  it('extracts all ancestor directories from a deeply nested file', () => {
    const files = [makeFile('.agents/skills/foo/SKILL.md')];
    expect(collectWorkspaceDirectories(files)).toEqual([
      '.agents/',
      '.agents/skills/',
      '.agents/skills/foo/',
    ]);
  });

  it('deduplicates directories shared by multiple files', () => {
    const files = [makeFile('docs/a.md'), makeFile('docs/b.md')];
    expect(collectWorkspaceDirectories(files)).toEqual(['docs/']);
  });

  it('returns directories in sorted order', () => {
    const files = [makeFile('zed/file.txt'), makeFile('alpha/file.txt')];
    expect(collectWorkspaceDirectories(files)).toEqual(['alpha/', 'zed/']);
  });

  it('handles multiple independent directory trees', () => {
    const files = [
      makeFile('docs/notes.md'),
      makeFile('.agents/skills/foo/SKILL.md'),
    ];
    expect(collectWorkspaceDirectories(files)).toEqual([
      '.agents/',
      '.agents/skills/',
      '.agents/skills/foo/',
      'docs/',
    ]);
  });

  it('treats segments with empty strings (double slash) as non-directories', () => {
    // Path "a//b.md" after filter(Boolean) = ["a", "b.md"] → "a/"
    expect(collectWorkspaceDirectories([makeFile('a//b.md')])).toEqual(['a/']);
  });

  it('ignores the file segment itself (only ancestors become dirs)', () => {
    const files = [makeFile('src/utils/helpers.ts')];
    expect(collectWorkspaceDirectories(files)).toEqual(['src/', 'src/utils/']);
  });
});
