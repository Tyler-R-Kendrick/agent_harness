import { describe, expect, it } from 'vitest';
import {
  normalizeDeleteWorkspaceFileResult,
  normalizeBrowserPageMutationResult,
  normalizeSessionMutationResult,
  readSessionFsEntry,
  readBrowserPage,
  readSessionSummary,
  resolveSessionSummaryInput,
  readOpenSessionState,
  normalizeSessionToolIds,
  applySessionToolChange,
  filterSessionTools,
  readWorkspaceFile,
  toWorkspaceFileSummary,
  toWorkspaceFileResult,
  toSessionFolderResult,
  buildDefaultSessionState,
} from '../workspaceToolShared';
import type { WorkspaceMcpSessionState, WorkspaceMcpSessionTool } from '../workspaceToolTypes';

const FS_ENTRIES = [
  { sessionId: 'session-1', path: '/', kind: 'folder' as const, isRoot: true },
  { sessionId: 'session-1', path: '/file.txt', kind: 'file' as const, content: 'hello' },
];

describe('workspaceToolShared helpers', () => {
  describe('normalizeDeleteWorkspaceFileResult', () => {
    it('returns plain-object results verbatim', () => {
      const plain = { path: '/foo.txt', deleted: false, extra: 'yes' };
      expect(normalizeDeleteWorkspaceFileResult('/foo.txt', plain)).toEqual(plain);
    });

    it('returns a default deleted result for non-object values', () => {
      expect(normalizeDeleteWorkspaceFileResult('/bar.txt', undefined)).toEqual({ path: '/bar.txt', deleted: true });
      expect(normalizeDeleteWorkspaceFileResult('/bar.txt', null)).toEqual({ path: '/bar.txt', deleted: true });
      expect(normalizeDeleteWorkspaceFileResult('/bar.txt', 42)).toEqual({ path: '/bar.txt', deleted: true });
    });
  });

  describe('normalizeBrowserPageMutationResult', () => {
    it('returns a structured page result when callback returns a valid page object', () => {
      const page = { id: 'page-1', title: 'Home', url: 'https://example.com', isOpen: true };
      const result = normalizeBrowserPageMutationResult('create', 'page-1', page);
      expect(result).toMatchObject({ id: 'page-1', title: 'Home', url: 'https://example.com' });
    });

    it('returns a fallback {pageId, created} for non-page values', () => {
      expect(normalizeBrowserPageMutationResult('create', 'page-1', undefined)).toEqual({ pageId: 'page-1', created: true });
      expect(normalizeBrowserPageMutationResult('create', 'page-1', { id: 42 })).toEqual({ pageId: 'page-1', created: true });
      expect(normalizeBrowserPageMutationResult('create', 'page-1', null)).toEqual({ pageId: 'page-1', created: true });
    });
  });

  describe('normalizeSessionMutationResult', () => {
    it('returns a session summary when callback returns a valid session object', () => {
      const session = { id: 'session-1', name: 'Ops', isOpen: true, mode: 'agent', provider: 'ghcp', modelId: 'gpt-4.1', agentId: null, toolIds: [] };
      const result = normalizeSessionMutationResult('create', 'session-1', session);
      expect(result).toMatchObject({ id: 'session-1', name: 'Ops' });
    });

    it('returns a fallback {sessionId, created} for invalid values', () => {
      expect(normalizeSessionMutationResult('create', 'session-1', undefined)).toEqual({ sessionId: 'session-1', created: true });
      expect(normalizeSessionMutationResult('create', 'session-1', { id: 'x' })).toEqual({ sessionId: 'session-1', created: true });
    });
  });

  describe('readSessionFsEntry', () => {
    it('throws TypeError when sessionId is not a string', () => {
      expect(() =>
        readSessionFsEntry(FS_ENTRIES, { sessionId: undefined as unknown as string, path: '/' }),
      ).toThrow('sessionId');
    });

    it('throws TypeError when sessionId is blank', () => {
      expect(() =>
        readSessionFsEntry(FS_ENTRIES, { sessionId: '  ', path: '/' }),
      ).toThrow('sessionId');
    });

    it('throws TypeError when path is not a string', () => {
      expect(() =>
        readSessionFsEntry(FS_ENTRIES, { sessionId: 'session-1', path: undefined as unknown as string }),
      ).toThrow('path');
    });

    it('throws NotFoundError when entry does not exist', () => {
      try {
        readSessionFsEntry(FS_ENTRIES, { sessionId: 'session-1', path: '/nonexistent.txt' });
        expect.fail('expected NotFoundError to be thrown');
      } catch (err) {
        expect((err as DOMException).name).toBe('NotFoundError');
      }
    });

    it('returns the entry when found', () => {
      const entry = readSessionFsEntry(FS_ENTRIES, { sessionId: 'session-1', path: '/file.txt' });
      expect(entry).toMatchObject({ sessionId: 'session-1', path: '/file.txt', kind: 'file' });
    });
  });

  describe('readBrowserPage', () => {
    const PAGES = [{ id: 'page-1', title: 'Home', url: 'https://example.com', isOpen: true }];

    it('throws TypeError when pageId is not a string', () => {
      expect(() => readBrowserPage(PAGES, { pageId: undefined as unknown as string })).toThrow('pageId');
    });

    it('throws TypeError when pageId is blank', () => {
      expect(() => readBrowserPage(PAGES, { pageId: '  ' })).toThrow('pageId');
    });

    it('throws NotFoundError when page does not exist', () => {
      try {
        readBrowserPage(PAGES, { pageId: 'nope' });
        expect.fail('expected NotFoundError');
      } catch (err) {
        expect((err as DOMException).name).toBe('NotFoundError');
      }
    });

    it('returns the page when found', () => {
      expect(readBrowserPage(PAGES, { pageId: 'page-1' })).toMatchObject({ id: 'page-1' });
    });
  });

  describe('readSessionSummary', () => {
    const SESSIONS = [{ id: 'session-1', name: 'Ops', isOpen: true }];

    it('throws TypeError when sessionId is not a string', () => {
      expect(() => readSessionSummary(SESSIONS, { sessionId: undefined as unknown as string })).toThrow('sessionId');
    });

    it('throws TypeError when sessionId is blank', () => {
      expect(() => readSessionSummary(SESSIONS, { sessionId: '  ' })).toThrow('sessionId');
    });

    it('throws NotFoundError when session does not exist', () => {
      try {
        readSessionSummary(SESSIONS, { sessionId: 'nope' });
        expect.fail('expected NotFoundError');
      } catch (err) {
        expect((err as DOMException).name).toBe('NotFoundError');
      }
    });

    it('returns the session when found', () => {
      expect(readSessionSummary(SESSIONS, { sessionId: 'session-1' })).toMatchObject({ id: 'session-1' });
    });
  });

  describe('resolveSessionSummaryInput', () => {
    const SESSION_A = { id: 'session-1', name: 'Ops', isOpen: true };
    const SESSION_B = { id: 'session-2', name: 'Dev', isOpen: false };

    it('resolves by sessionId when provided', () => {
      expect(resolveSessionSummaryInput([SESSION_A, SESSION_B], { sessionId: 'session-2' })).toMatchObject({ id: 'session-2' });
    });

    it('returns the only session when no sessionId and exactly one session exists', () => {
      expect(resolveSessionSummaryInput([SESSION_A], { sessionId: undefined as unknown as string })).toMatchObject({ id: 'session-1' });
    });

    it('throws NotFoundError when no sessions are available', () => {
      try {
        resolveSessionSummaryInput([], { sessionId: undefined as unknown as string });
        expect.fail('expected NotFoundError');
      } catch (err) {
        expect((err as DOMException).name).toBe('NotFoundError');
      }
    });

    it('throws TypeError when no sessionId and multiple sessions exist', () => {
      expect(() => resolveSessionSummaryInput([SESSION_A, SESSION_B], { sessionId: undefined as unknown as string })).toThrow(TypeError);
    });
  });

  describe('readOpenSessionState', () => {
    const SESSIONS = [{ id: 'session-1', name: 'Ops', isOpen: true }];
    const STATE: WorkspaceMcpSessionState = {
      id: 'session-1', name: 'Ops', isOpen: true,
      mode: 'agent', messages: [],
    };

    it('returns merged state when session is open', () => {
      const result = readOpenSessionState(SESSIONS, () => STATE, { sessionId: 'session-1' });
      expect(result).toMatchObject({ id: 'session-1', name: 'Ops', mode: 'agent' });
    });

    it('throws NotFoundError when getSessionState returns null', () => {
      try {
        readOpenSessionState(SESSIONS, () => null, { sessionId: 'session-1' });
        expect.fail('expected NotFoundError');
      } catch (err) {
        expect((err as DOMException).name).toBe('NotFoundError');
      }
    });

    it('throws NotFoundError when getSessionState is undefined', () => {
      try {
        readOpenSessionState(SESSIONS, undefined, { sessionId: 'session-1' });
        expect.fail('expected NotFoundError');
      } catch (err) {
        expect((err as DOMException).name).toBe('NotFoundError');
      }
    });
  });

  describe('normalizeSessionToolIds', () => {
    it('throws TypeError when input is not an array', () => {
      expect(() => normalizeSessionToolIds('not an array')).toThrow('toolIds');
    });

    it('throws TypeError when array is empty after normalization', () => {
      expect(() => normalizeSessionToolIds([])).toThrow('toolIds');
      expect(() => normalizeSessionToolIds(['  ', ''])).toThrow('toolIds');
    });

    it('deduplicates and trims tool ids', () => {
      expect(normalizeSessionToolIds(['cli ', 'cli', 'browser'])).toEqual(['cli', 'browser']);
    });
  });

  describe('applySessionToolChange', () => {
    const TOOLS: WorkspaceMcpSessionTool[] = [
      { id: 'cli', name: 'CLI', description: '' },
      { id: 'browser', name: 'Browser', description: '' },
    ];

    it('selects tools', () => {
      expect(applySessionToolChange(TOOLS, ['cli'], 'select', ['browser'])).toEqual(['cli', 'browser']);
    });

    it('deselects tools', () => {
      expect(applySessionToolChange(TOOLS, ['cli', 'browser'], 'deselect', ['cli'])).toEqual(['browser']);
    });

    it('throws TypeError when action is invalid', () => {
      expect(() => applySessionToolChange(TOOLS, [], 'invalid', ['cli'])).toThrow('action');
    });

    it('throws NotFoundError when toolId is not available', () => {
      try {
        applySessionToolChange(TOOLS, [], 'select', ['unknown']);
        expect.fail('expected NotFoundError');
      } catch (err) {
        expect((err as DOMException).name).toBe('NotFoundError');
      }
    });
  });

  describe('filterSessionTools', () => {
    const TOOLS: WorkspaceMcpSessionTool[] = [
      { id: 'cli', name: 'CLI', label: 'CLI', description: 'Run shell commands', group: 'local', groupLabel: 'Local tools' },
      { id: 'browser', name: 'Browser', label: 'Browser', description: 'Browse the web', group: 'local', groupLabel: 'Local tools' },
    ];

    it('returns all tools when no query is provided (covers !normalizedQuery branch)', () => {
      const result = filterSessionTools(TOOLS, ['cli']);
      expect(result).toHaveLength(2);
      expect(result.find((t) => t.id === 'cli')?.selected).toBe(true);
      expect(result.find((t) => t.id === 'browser')?.selected).toBe(false);
    });

    it('filters by query when provided', () => {
      const result = filterSessionTools(TOOLS, [], 'shell');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('cli');
    });
  });

  describe('readWorkspaceFile', () => {
    const FILES = [
      { path: 'AGENTS.md', content: '# Rules', updatedAt: '2026-04-20T00:00:00Z' },
    ];

    it('returns the file when found', () => {
      const file = readWorkspaceFile('Research', FILES, { path: 'AGENTS.md' });
      expect(file).toMatchObject({ path: 'AGENTS.md', content: '# Rules' });
    });

    it('throws NotFoundError when the file does not exist', () => {
      try {
        readWorkspaceFile('Research', FILES, { path: 'MISSING.md' });
        expect.fail('expected NotFoundError');
      } catch (err) {
        expect((err as DOMException).name).toBe('NotFoundError');
      }
    });
  });

  describe('toWorkspaceFileSummary', () => {
    it('returns path, uri, and updatedAt for a workspace file', () => {
      const file = { path: 'notes/Plan.md', content: 'content', updatedAt: '2026-04-20T00:00:00Z' };
      const result = toWorkspaceFileSummary(file);
      expect(result).toEqual({
        path: 'notes/Plan.md',
        uri: 'files://workspace/notes/Plan.md',
        updatedAt: '2026-04-20T00:00:00Z',
      });
    });
  });

  describe('toWorkspaceFileResult', () => {
    it('includes workspaceName and content alongside the summary', () => {
      const file = { path: 'AGENTS.md', content: '# Rules', updatedAt: '2026-04-20T00:00:00Z' };
      const result = toWorkspaceFileResult('Research', file);
      expect(result).toEqual({
        workspaceName: 'Research',
        path: 'AGENTS.md',
        uri: 'files://workspace/AGENTS.md',
        updatedAt: '2026-04-20T00:00:00Z',
        content: '# Rules',
      });
    });
  });

  describe('filterSessionTools (description ?? branch)', () => {
    it('uses empty string fallback when tool description is undefined', () => {
      const tools: WorkspaceMcpSessionTool[] = [
        { id: 'cli', name: 'CLI', label: 'CLI', description: undefined, group: 'local', groupLabel: 'Local' },
      ];
      // query 'cli' should match via tool.id; description ?? '' fallback is exercised
      const result = filterSessionTools(tools, [], 'cli');
      expect(result).toHaveLength(1);
    });
  });

  describe('toSessionFolderResult (same-kind sort)', () => {
    it('sorts two files alphabetically when kinds are equal (exercises || basename branch)', () => {
      const entries = [
        { sessionId: 's1', path: '/root', kind: 'folder' as const, isRoot: true },
        { sessionId: 's1', path: '/root/zebra.txt', kind: 'file' as const },
        { sessionId: 's1', path: '/root/apple.txt', kind: 'file' as const },
      ];
      const result = toSessionFolderResult(entries, 's1', '/root');
      expect(result.entries.map((e) => e.name)).toEqual(['apple.txt', 'zebra.txt']);
    });
  });

  describe('buildDefaultSessionState', () => {
    it('falls back to [] when both input.toolIds and session.toolIds are undefined', () => {
      const session = {
        id: 's1', name: 'Test', isOpen: true, mode: 'build', provider: null,
        modelId: null, agentId: null, toolIds: undefined, cwd: null, messages: [],
      } as unknown as WorkspaceMcpSessionState;
      const input = {};
      const result = buildDefaultSessionState(session, input);
      expect(result.toolIds).toEqual([]);
    });
  });
});
