import { describe, expect, it } from 'vitest';
import type { WorkspaceFile } from '../types';
import {
  appendWorkspaceMemoryFact,
  buildWorkspaceMemoryPromptContext,
  createDefaultWorkspaceMemoryFiles,
  deleteWorkspaceMemoryEntry,
  detectWorkspaceMemoryScope,
  parseWorkspaceMemoryFiles,
  searchWorkspaceMemory,
  updateWorkspaceMemoryEntry,
} from './workspaceMemory';

describe('workspaceMemory', () => {
  it('creates the five default memory files in stable scope order', () => {
    const files = createDefaultWorkspaceMemoryFiles('2026-04-24T00:00:00.000Z');

    expect(files.map((file) => file.path)).toEqual([
      '.memory/MEMORY.md',
      '.memory/user.memory.md',
      '.memory/project.memory.md',
      '.memory/workspace.memory.md',
      '.memory/session.memory.md',
    ]);
    expect(files).toEqual(Array.from({ length: files.length }, () => expect.objectContaining({
      updatedAt: '2026-04-24T00:00:00.000Z',
    })));
    expect(files[0].content).toContain('# Memory');
  });

  it('detects supported memory scopes only for canonical memory paths', () => {
    expect(detectWorkspaceMemoryScope('.memory/MEMORY.md')).toBe('global');
    expect(detectWorkspaceMemoryScope('.memory/user.memory.md')).toBe('user');
    expect(detectWorkspaceMemoryScope('.memory/project.memory.md')).toBe('project');
    expect(detectWorkspaceMemoryScope('.memory/workspace.memory.md')).toBe('workspace');
    expect(detectWorkspaceMemoryScope('.memory/session.memory.md')).toBe('session');
    expect(detectWorkspaceMemoryScope('.memory/notes.md')).toBeNull();
    expect(detectWorkspaceMemoryScope('MEMORY.md')).toBeNull();
  });

  it('parses markdown bullet factoids with scope, source path, and line number', () => {
    const files: WorkspaceFile[] = [
      {
        path: '.memory/MEMORY.md',
        content: '# Memory\n\n- Prefer small diffs\nPlain paragraph\n-   \n* Use deterministic scripts',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
      {
        path: '.memory/session.memory.md',
        content: '## Session\n- Current issue is TK-5',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
    ];

    expect(parseWorkspaceMemoryFiles(files)).toEqual([
      { scope: 'global', path: '.memory/MEMORY.md', lineNumber: 3, text: 'Prefer small diffs' },
      { scope: 'global', path: '.memory/MEMORY.md', lineNumber: 6, text: 'Use deterministic scripts' },
      { scope: 'session', path: '.memory/session.memory.md', lineNumber: 2, text: 'Current issue is TK-5' },
    ]);
  });

  it('searches memory entries by query tokens and optional scopes', () => {
    const files: WorkspaceFile[] = [
      {
        path: '.memory/project.memory.md',
        content: '- Use Vitest coverage for workspace memory\n- Keep agent-browser UI quiet',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
      {
        path: '.memory/session.memory.md',
        content: '- Workspace memory issue is TK-5',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
    ];

    expect(searchWorkspaceMemory(files, 'workspace memory').map((entry) => entry.text)).toEqual([
      'Workspace memory issue is TK-5',
      'Use Vitest coverage for workspace memory',
    ]);
    expect(searchWorkspaceMemory(files, 'workspace memory', { scopes: ['session'] })).toEqual([
      expect.objectContaining({ scope: 'session', text: 'Workspace memory issue is TK-5' }),
    ]);
  });

  it('searches all entries for an empty query and honors limits with source order', () => {
    const files: WorkspaceFile[] = [
      {
        path: '.memory/project.memory.md',
        content: '- First project fact\n- Second project fact',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
      {
        path: '.memory/session.memory.md',
        content: '- Session fact',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
    ];

    expect(searchWorkspaceMemory(files, '', { limit: 2 }).map((entry) => entry.text)).toEqual([
      'Session fact',
      'First project fact',
    ]);
  });

  it('ranks higher scoring memory matches ahead of broader scoped matches', () => {
    const files: WorkspaceFile[] = [
      {
        path: '.memory/project.memory.md',
        content: '- Workspace memory validation uses coverage',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
      {
        path: '.memory/session.memory.md',
        content: '- Workspace memory',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
    ];

    expect(searchWorkspaceMemory(files, 'workspace memory coverage').map((entry) => entry.text)).toEqual([
      'Workspace memory validation uses coverage',
      'Workspace memory',
    ]);
  });

  it('appends sanitized factoids without overwriting existing scoped memory', () => {
    const files: WorkspaceFile[] = [
      {
        path: '.memory/workspace.memory.md',
        content: '# Workspace Memory\n\n- Existing fact',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
    ];

    const next = appendWorkspaceMemoryFact(
      files,
      'workspace',
      '  - Remember\n     multiline fact  ',
      '2026-04-24T01:00:00.000Z',
    );

    expect(next).toEqual([
      {
        path: '.memory/workspace.memory.md',
        content: '# Workspace Memory\n\n- Existing fact\n- Remember multiline fact',
        updatedAt: '2026-04-24T01:00:00.000Z',
      },
    ]);
  });

  it('returns a shallow copy when appending an empty factoid', () => {
    const files: WorkspaceFile[] = [
      {
        path: '.memory/workspace.memory.md',
        content: '# Workspace Memory',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
    ];

    const next = appendWorkspaceMemoryFact(files, 'workspace', '   ', '2026-04-24T01:00:00.000Z');

    expect(next).toEqual(files);
    expect(next).not.toBe(files);
  });

  it('appends a factoid to an empty existing memory file without leading whitespace', () => {
    const next = appendWorkspaceMemoryFact([
      {
        path: '.memory/session.memory.md',
        content: '',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
    ], 'session', 'Current task is workspace memory', '2026-04-24T01:00:00.000Z');

    expect(next).toEqual([
      {
        path: '.memory/session.memory.md',
        content: '- Current task is workspace memory',
        updatedAt: '2026-04-24T01:00:00.000Z',
      },
    ]);
  });

  it('creates a missing scoped memory file when appending a factoid', () => {
    const next = appendWorkspaceMemoryFact([], 'user', 'Prefers concise status updates', '2026-04-24T01:00:00.000Z');

    expect(next).toEqual([
      expect.objectContaining({
        path: '.memory/user.memory.md',
        content: expect.stringContaining('- Prefers concise status updates'),
        updatedAt: '2026-04-24T01:00:00.000Z',
      }),
    ]);
  });

  it('deletes one stored memory fact without disturbing adjacent markdown', () => {
    const files: WorkspaceFile[] = [
      {
        path: '.memory/project.memory.md',
        content: '# Project Memory\n\n- Keep the wiki navigable\n- Remove stale implementation notes\n\nParagraph stays.',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
    ];

    const next = deleteWorkspaceMemoryEntry(
      files,
      { path: '.memory/project.memory.md', lineNumber: 4 },
      '2026-04-24T01:00:00.000Z',
    );

    expect(next).toEqual([
      {
        path: '.memory/project.memory.md',
        content: '# Project Memory\n\n- Keep the wiki navigable\n\nParagraph stays.',
        updatedAt: '2026-04-24T01:00:00.000Z',
      },
    ]);
  });

  it('updates one stored memory fact in place and sanitizes multiline edits', () => {
    const files: WorkspaceFile[] = [
      {
        path: '.memory/workspace.memory.md',
        content: '# Workspace Memory\n\n- Old memory text\n- Keep this fact',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
    ];

    const next = updateWorkspaceMemoryEntry(
      files,
      { path: '.memory/workspace.memory.md', lineNumber: 3 },
      '  - New\n     memory text  ',
      '2026-04-24T01:00:00.000Z',
    );

    expect(next).toEqual([
      {
        path: '.memory/workspace.memory.md',
        content: '# Workspace Memory\n\n- New memory text\n- Keep this fact',
        updatedAt: '2026-04-24T01:00:00.000Z',
      },
    ]);
  });

  it('builds compact prompt context for memory recall', () => {
    const context = buildWorkspaceMemoryPromptContext([
      {
        path: '.memory/project.memory.md',
        content: '- Use checked-in scripts for repeatable browser validation',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
    ], 'browser validation');

    expect(context).toContain('Workspace memory files loaded from .memory/:');
    expect(context).toContain('- [project] Use checked-in scripts for repeatable browser validation');
  });

  it('builds empty prompt context when no memory factoids are stored', () => {
    const context = buildWorkspaceMemoryPromptContext([
      {
        path: '.memory/MEMORY.md',
        content: '# Memory',
        updatedAt: '2026-04-24T00:00:00.000Z',
      },
    ]);

    expect(context).toContain('No stored memory factoids found.');
  });
});
