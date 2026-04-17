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

    context.setBashHistoryBySession((current) => ({
      ...current,
      [context.sessionId]: [...(current[context.sessionId] ?? []), { cmd, stdout: cleanStdout, stderr, exitCode: result.exitCode }],
    }));
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