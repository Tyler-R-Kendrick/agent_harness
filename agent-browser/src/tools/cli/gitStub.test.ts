import { describe, expect, it, vi } from 'vitest';

import { executeCliCommand } from './exec';
import type { CliHistoryEntry, TerminalExecutorContext } from '../types';

type TerminalFs = ReturnType<TerminalExecutorContext['getSessionBash']>['fs'];

function createContext() {
  let historyBySession: Record<string, CliHistoryEntry[]> = {};
  let cwdBySession: Record<string, string> = {};
  const fsPaths = new Set<string>(['/workspace', '/workspace/.keep', '/workspace/README.md']);
  const fileContents = new Map<string, string>([
    ['/workspace/.keep', ''],
    ['/workspace/README.md', 'hello'],
  ]);
  const exec = vi.fn();
  const notifyTerminalFsPathsChanged = vi.fn();

  const context: TerminalExecutorContext = {
    appendSharedMessages: vi.fn(),
    getSessionBash: () => ({
      exec,
      fs: {
        getAllPaths: () => [...fsPaths],
        mkdir: async (path: string) => {
          fsPaths.add(path);
        },
        readFile: async (path: string) => {
          if (!fileContents.has(path)) throw new Error(`Missing file: ${path}`);
          return fileContents.get(path) ?? '';
        },
        writeFile: async (path: string, content) => {
          fsPaths.add(path);
          const dir = path.slice(0, path.lastIndexOf('/'));
          if (dir) fsPaths.add(dir);
          fileContents.set(path, typeof content === 'string' ? content : new TextDecoder().decode(content));
        },
      },
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

  return {
    context,
    exec,
    getCwd: () => cwdBySession,
    getHistory: () => historyBySession,
    notifyTerminalFsPathsChanged,
  };
}

describe('executeCliCommand git stub integration', () => {
  it('handles git-style terminal commands through the git-stub library', async () => {
    const { context, exec, getCwd, getHistory, notifyTerminalFsPathsChanged } = createContext();

    const init = await executeCliCommand(context, 'git init', { emitMessages: false });
    const status = await executeCliCommand(context, 'git status --short', { emitMessages: false });

    expect(exec).not.toHaveBeenCalled();
    expect(init).toMatchObject({
      command: 'git init',
      stdout: 'Initialized empty git-stub repository in /workspace/.git-stub',
      stderr: '',
      exitCode: 0,
      cwd: '/workspace',
    });
    expect(status).toMatchObject({
      command: 'git status --short',
      stdout: '?? README.md',
      stderr: '',
      exitCode: 0,
      cwd: '/workspace',
    });
    expect(getCwd()).toEqual({ 'session-1': '/workspace' });
    expect(getHistory()).toEqual({
      'session-1': [
        { cmd: 'git init', stdout: 'Initialized empty git-stub repository in /workspace/.git-stub', stderr: '', exitCode: 0 },
        { cmd: 'git status --short', stdout: '?? README.md', stderr: '', exitCode: 0 },
      ],
    });
    expect(notifyTerminalFsPathsChanged).toHaveBeenCalledWith(
      'session-1',
      expect.arrayContaining(['/workspace/.git-stub/state.json']),
    );
  });

  it('preserves terminal filesystem method receivers while creating git-stub state', async () => {
    const fsPaths = new Set<string>(['/workspace', '/workspace/a.txt']);
    const fileContents = new Map<string, string>([['/workspace/a.txt', 'a']]);
    const terminalFs: TerminalFs = {
      getAllPaths() {
        return [...fsPaths];
      },
      async mkdir(path: string) {
        this.getAllPaths();
        fsPaths.add(path);
      },
      async readFile(path: string) {
        this.getAllPaths();
        return fileContents.get(path) ?? '';
      },
      async writeFile(path: string, content: string | Uint8Array) {
        this.getAllPaths();
        fsPaths.add(path);
        fileContents.set(path, typeof content === 'string' ? content : new TextDecoder().decode(content));
      },
    };
    const context: TerminalExecutorContext = {
      appendSharedMessages: vi.fn(),
      getSessionBash: () => ({ exec: vi.fn(), fs: terminalFs }),
      notifyTerminalFsPathsChanged: vi.fn(),
      sessionId: 'session-1',
      setBashHistoryBySession: vi.fn(),
      setCwdBySession: vi.fn(),
    };

    await expect(executeCliCommand(context, 'git init', { emitMessages: false })).resolves.toMatchObject({
      stdout: 'Initialized empty git-stub repository in /workspace/.git-stub',
    });
  });
});
