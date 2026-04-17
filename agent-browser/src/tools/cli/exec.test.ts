import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../types';
import { executeCliCommand } from './exec';
import type { CliHistoryEntry, TerminalExecutorContext } from '../types';

function createContext({
  result,
  paths = ['/workspace', '/workspace/.keep'],
}: {
  result?: { stdout?: string; stderr: string; exitCode: number };
  paths?: string[];
} = {}) {
  const messages: ChatMessage[] = [];
  let historyBySession: Record<string, CliHistoryEntry[]> = {};
  let cwdBySession: Record<string, string> = {};
  const notifyTerminalFsPathsChanged = vi.fn();
  const exec = vi.fn().mockResolvedValue(result ?? {
    stdout: 'hello\n__JUSTBASH_CWD:/workspace/demo',
    stderr: '',
    exitCode: 0,
  });

  const context: TerminalExecutorContext = {
    appendSharedMessages: (entries) => messages.push(...entries),
    getSessionBash: () => ({
      exec,
      fs: { getAllPaths: () => paths },
    }),
    notifyTerminalFsPathsChanged,
    sessionId: 'session-1',
    setBashHistoryBySession: (updater) => {
      historyBySession = typeof updater === 'function' ? updater(historyBySession) : updater;
    },
    setCwdBySession: (updater) => {
      cwdBySession = typeof updater === 'function' ? updater(cwdBySession) : updater;
    },
  };

  return { context, exec, messages, notifyTerminalFsPathsChanged, getHistory: () => historyBySession, getCwd: () => cwdBySession };
}

describe('executeCliCommand', () => {
  it('rejects empty commands before touching the session terminal', async () => {
    const { context, exec, messages } = createContext();

    await expect(executeCliCommand(context, '   ')).rejects.toThrow('CLI command cannot be empty.');
    expect(exec).not.toHaveBeenCalled();
    expect(messages).toEqual([]);
  });

  it('executes a command, updates terminal state, and appends visible terminal messages by default', async () => {
    const { context, exec, messages, notifyTerminalFsPathsChanged, getHistory, getCwd } = createContext();

    const result = await executeCliCommand(context, 'echo hello');

    expect(exec).toHaveBeenCalledWith('echo hello; echo __JUSTBASH_CWD:$PWD');
    expect(result).toEqual({
      command: 'echo hello',
      stdout: 'hello',
      stderr: '',
      exitCode: 0,
      cwd: '/workspace/demo',
      outputTruncated: false,
    });
    expect(getCwd()).toEqual({ 'session-1': '/workspace/demo' });
    expect(getHistory()).toEqual({
      'session-1': [{ cmd: 'echo hello', stdout: 'hello', stderr: '', exitCode: 0 }],
    });
    expect(notifyTerminalFsPathsChanged).toHaveBeenCalledWith('session-1', ['/workspace', '/workspace/.keep']);
    expect(messages.map((message) => ({ role: message.role, statusText: message.statusText, content: message.content }))).toEqual([
      { role: 'user', statusText: 'terminal-command', content: '$ echo hello' },
      { role: 'assistant', statusText: 'terminal-output', content: 'hello' },
    ]);
  });

  it('truncates large terminal output and reports it in the tool result', async () => {
    const { context, messages } = createContext({
      result: {
        stdout: `${'x'.repeat(32)}\n__JUSTBASH_CWD:/workspace`,
        stderr: '',
        exitCode: 0,
      },
    });

    const result = await executeCliCommand(context, 'echo large', { maxOutputLength: 16 });

    expect(result.outputTruncated).toBe(true);
    expect(messages[1].content).toContain('output truncated');
  });

  it('surfaces the exit code when a command fails without stdout or stderr output', async () => {
    const { context, messages } = createContext({
      result: {
        stdout: '__JUSTBASH_CWD:/workspace',
        stderr: '',
        exitCode: 23,
      },
    });

    const result = await executeCliCommand(context, 'false');

    expect(result.exitCode).toBe(23);
    expect(messages[1]).toMatchObject({
      content: 'Command exited with code 23.',
      status: 'error',
      isError: true,
    });
  });

  it('appends a terminal error message and rethrows when command execution fails', async () => {
    const messages: ChatMessage[] = [];
    const error = new Error('shell failed');
    const context: TerminalExecutorContext = {
      appendSharedMessages: (entries) => messages.push(...entries),
      getSessionBash: () => ({
        exec: vi.fn().mockRejectedValue(error),
        fs: { getAllPaths: () => [] },
      }),
      notifyTerminalFsPathsChanged: vi.fn(),
      sessionId: 'session-1',
      setBashHistoryBySession: vi.fn(),
      setCwdBySession: vi.fn(),
    };

    await expect(executeCliCommand(context, 'bad command')).rejects.toThrow('shell failed');
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      status: 'error',
      statusText: 'terminal-output',
      content: 'shell failed',
    });
  });

  it('suppresses visible terminal messages when emitMessages is disabled', async () => {
    const { context, messages, getHistory, getCwd } = createContext();

    const result = await executeCliCommand(context, 'echo hello', { emitMessages: false });

    expect(result.stdout).toBe('hello');
    expect(messages).toEqual([]);
    expect(getCwd()).toEqual({ 'session-1': '/workspace/demo' });
    expect(getHistory()).toEqual({
      'session-1': [{ cmd: 'echo hello', stdout: 'hello', stderr: '', exitCode: 0 }],
    });
  });
});