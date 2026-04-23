import { describe, expect, it, vi } from 'vitest';

const executeCliCommandMock = vi.fn();

vi.mock('./cli/exec', () => ({
  executeCliCommand: (...args: unknown[]) => executeCliCommandMock(...args),
}));

import { DEFAULT_TOOL_DESCRIPTORS, buildDefaultToolInstructions, buildToolGroupDescriptors, createDefaultTools, selectToolDescriptorsByIds, selectToolsByIds } from './index';
import type { TerminalExecutorContext } from './types';

function createContext(): TerminalExecutorContext {
  return {
    appendSharedMessages: vi.fn(),
    getSessionBash: vi.fn(() => ({
      exec: vi.fn(),
      fs: { getAllPaths: vi.fn(() => []) },
    })),
    notifyTerminalFsPathsChanged: vi.fn(),
    sessionId: 'session-1',
    setBashHistoryBySession: vi.fn(),
    setCwdBySession: vi.fn(),
  } as unknown as TerminalExecutorContext;
}

describe('default tools', () => {
  it('builds tool instructions for the active workspace', () => {
    const instructions = buildDefaultToolInstructions({
      workspaceName: 'Research',
      workspacePromptContext: 'Workspace instructions.',
      selectedToolIds: ['cli'],
    });
    expect(instructions).toContain('Active workspace: Research');
    expect(instructions).toContain('//session-1-fs/workspace');
    expect(instructions).toContain('Selected tool ids: cli');
  });

  it('includes exactly one built-in tool descriptor: cli', () => {
    expect(DEFAULT_TOOL_DESCRIPTORS).toHaveLength(1);
    const [cli] = DEFAULT_TOOL_DESCRIPTORS;
    expect(cli.id).toBe('cli');
    expect(cli.group).toBe('built-in');
  });

  it('creates a cli tool that delegates to the shared executor', async () => {
    const context = createContext();
    const tools = createDefaultTools(context);

    executeCliCommandMock.mockResolvedValueOnce({ exitCode: 0 });
    await tools.cli.execute?.({ command: 'pwd' }, {} as never);

    expect(executeCliCommandMock).toHaveBeenCalledWith(context, 'pwd', { emitMessages: false });
  });

  it('filters tool sets and descriptors by selected ids', () => {
    const filteredTools = selectToolsByIds({ cli: { execute: vi.fn() }, other: { execute: vi.fn() } } as never, ['cli']);
    const filteredDescriptors = selectToolDescriptorsByIds([
      ...DEFAULT_TOOL_DESCRIPTORS,
      {
        id: 'read_session_file',
        label: 'Read session file',
        description: 'Read a file.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'files-worktree-mcp',
        subGroupLabel: 'Files',
      },
    ], ['read_session_file']);

    expect(Object.keys(filteredTools)).toEqual(['cli']);
    expect(filteredDescriptors.map((descriptor) => descriptor.id)).toEqual(['read_session_file']);
  });

  it('builds group descriptors from top-level and subgroup tool metadata', () => {
    const groups = buildToolGroupDescriptors([
      ...DEFAULT_TOOL_DESCRIPTORS,
      {
        id: 'read_session_file',
        label: 'Read session file',
        description: 'Read a file.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'files-worktree-mcp',
        subGroupLabel: 'Files',
      },
    ]);

    expect(groups).toEqual([
      expect.objectContaining({ id: 'built-in', label: 'Built-In', toolIds: ['cli'] }),
      expect.objectContaining({ id: 'files-worktree-mcp', label: 'Files', toolIds: ['read_session_file'] }),
    ]);
  });
});