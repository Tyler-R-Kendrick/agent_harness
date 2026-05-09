import { createGitStubRepository, executeGitStubCommand, isGitStubCommand, type GitStubFileSystem } from '@agent-harness/git-stub';
import type { ChatMessage } from '../../types';
import { createUniqueId } from '../../utils/uniqueId';
import type { TerminalCliResult, TerminalExecutorContext } from '../types';

export const BASH_CWD_SENTINEL = '__JUSTBASH_CWD';
const DEFAULT_OUTPUT_LIMIT = 4000;

function trimOutput(value: string, maxLength: number): { text: string; truncated: boolean } {
  if (value.length <= maxLength) {
    return { text: value, truncated: false };
  }

  return {
    text: `${value.slice(0, maxLength)}\n… output truncated …`,
    truncated: true,
  };
}

function createTerminalMessage(message: Omit<ChatMessage, 'id'>): ChatMessage {
  return {
    id: createUniqueId(),
    ...message,
  };
}

function canUseGitStubFileSystem(fs: ReturnType<TerminalExecutorContext['getSessionBash']>['fs']): boolean {
  return typeof fs.readFile === 'function'
    && typeof fs.writeFile === 'function'
    && typeof fs.mkdir === 'function';
}

function createGitStubFileSystem(fs: ReturnType<TerminalExecutorContext['getSessionBash']>['fs']): GitStubFileSystem {
  if (!fs.readFile || !fs.writeFile || !fs.mkdir) {
    throw new Error('git-stub requires a readable and writable terminal filesystem.');
  }
  const readFile = fs.readFile.bind(fs);
  const writeFile = fs.writeFile.bind(fs);
  const mkdir = fs.mkdir.bind(fs);
  return {
    getAllPaths: () => fs.getAllPaths(),
    readFile: (path, encoding) => readFile(path, encoding as Parameters<typeof readFile>[1]),
    writeFile: (path, content, encoding) => writeFile(path, content, encoding as Parameters<typeof writeFile>[2]),
    mkdir: (path, options) => mkdir(path, options),
  };
}

function appendTerminalHistory(
  context: TerminalExecutorContext,
  entry: {
    cmd: string;
    stdout: string;
    stderr: string;
    exitCode: number;
  },
) {
  context.setBashHistoryBySession((current) => ({
    ...current,
    [context.sessionId]: [...(current[context.sessionId] ?? []), entry],
  }));
}

export async function executeCliCommand(
  context: TerminalExecutorContext,
  command: string,
  options: {
    emitMessages?: boolean;
    maxOutputLength?: number;
  } = {},
): Promise<TerminalCliResult> {
  const {
    emitMessages = true,
    maxOutputLength = DEFAULT_OUTPUT_LIMIT,
  } = options;
  const cmd = command.trim();
  if (!cmd) {
    throw new Error('CLI command cannot be empty.');
  }

  const bash = context.getSessionBash(context.sessionId);
  if (emitMessages) {
    context.appendSharedMessages([
      createTerminalMessage({
        role: 'user',
        content: `$ ${cmd}`,
        isLocal: true,
        status: 'complete',
        statusText: 'terminal-command',
      }),
    ]);
  }

  try {
    if (isGitStubCommand(cmd) && canUseGitStubFileSystem(bash.fs)) {
      const gitStubFs = createGitStubFileSystem(bash.fs);
      const result = await executeGitStubCommand(createGitStubRepository({
        fs: gitStubFs,
        cwd: bash.cwd ?? '/workspace',
      }), cmd);
      context.setCwdBySession((current) => ({ ...current, [context.sessionId]: result.cwd }));
      appendTerminalHistory(context, {
        cmd,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      });
      context.notifyTerminalFsPathsChanged(context.sessionId, bash.fs.getAllPaths());

      const outputParts = [result.stdout, result.stderr].filter(Boolean);
      const outputContent = outputParts.length > 0
        ? outputParts.join('\n')
        : (result.exitCode === 0 ? 'Command completed.' : `Command exited with code ${result.exitCode}.`);
      const trimmed = trimOutput(outputContent, maxOutputLength);

      if (emitMessages) {
        context.appendSharedMessages([
          createTerminalMessage({
            role: 'assistant',
            content: trimmed.text,
            isLocal: true,
            status: result.exitCode === 0 ? 'complete' : 'error',
            isError: result.exitCode !== 0,
            statusText: 'terminal-output',
          }),
        ]);
      }

      return {
        command: cmd,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        cwd: result.cwd,
        outputTruncated: trimmed.truncated,
      };
    }

    const result = await bash.exec(`${cmd}; echo ${BASH_CWD_SENTINEL}:$PWD`);
    const sentinelPrefix = `${BASH_CWD_SENTINEL}:`;
    const stdoutLines = (result.stdout ?? '').split('\n');
    const sentinelLine = stdoutLines.find((line) => line.startsWith(sentinelPrefix));
    const capturedCwd = sentinelLine ? sentinelLine.slice(sentinelPrefix.length).trim() : null;
    const cleanStdout = stdoutLines.filter((line) => !line.startsWith(sentinelPrefix)).join('\n').trimEnd();
    const stderr = result.stderr?.trimEnd() ?? '';

    if (capturedCwd) {
      context.setCwdBySession((current) => ({ ...current, [context.sessionId]: capturedCwd }));
    }

    appendTerminalHistory(context, { cmd, stdout: cleanStdout, stderr, exitCode: result.exitCode });
    context.notifyTerminalFsPathsChanged(context.sessionId, bash.fs.getAllPaths());

    const outputParts = [cleanStdout, stderr].filter(Boolean);
    const outputContent = outputParts.length > 0
      ? outputParts.join('\n')
      : (result.exitCode === 0 ? 'Command completed.' : `Command exited with code ${result.exitCode}.`);
    const trimmed = trimOutput(outputContent, maxOutputLength);

    if (emitMessages) {
      context.appendSharedMessages([
        createTerminalMessage({
          role: 'assistant',
          content: trimmed.text,
          isLocal: true,
          status: result.exitCode === 0 ? 'complete' : 'error',
          isError: result.exitCode !== 0,
          statusText: 'terminal-output',
        }),
      ]);
    }

    return {
      command: cmd,
      stdout: cleanStdout,
      stderr,
      exitCode: result.exitCode,
      cwd: capturedCwd,
      outputTruncated: trimmed.truncated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (emitMessages) {
      context.appendSharedMessages([
        createTerminalMessage({
          role: 'assistant',
          content: message,
          isLocal: true,
          status: 'error',
          isError: true,
          statusText: 'terminal-output',
        }),
      ]);
    }
    throw error;
  }
}
