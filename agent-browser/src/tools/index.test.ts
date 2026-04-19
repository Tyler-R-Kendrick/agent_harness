import { describe, expect, it, vi } from 'vitest';

const executeCliCommandMock = vi.fn();

vi.mock('./cli/exec', () => ({
  executeCliCommand: (...args: unknown[]) => executeCliCommandMock(...args),
}));

import { DEFAULT_TOOL_DESCRIPTORS, buildDefaultToolInstructions, createDefaultTools } from './index';
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
    expect(buildDefaultToolInstructions({
      workspaceName: 'Research',
      workspacePromptContext: 'Workspace instructions.',
    })).toContain('Active workspace: Research');
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
});