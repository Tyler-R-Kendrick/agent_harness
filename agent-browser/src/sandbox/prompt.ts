import type { RunRequest } from './protocol';

export interface ParsedSandboxPrompt {
  request: RunRequest;
  commandLine: string;
}

function parseCodeBlocks(text: string): Array<{ filePath: string; content: string }> {
  const blocks = [...text.matchAll(/```(?:[\w-]+)?(?:\s+file=([^\s]+))?\n([\s\S]*?)```/g)];
  return blocks.map((match, index) => ({
    filePath: match[1] ?? (index === 0 ? 'index.js' : `file-${index + 1}.txt`),
    content: match[2] ?? '',
  }));
}

export function parseSandboxPrompt(text: string): ParsedSandboxPrompt | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/sandbox ')) {
    return null;
  }

  const lines = trimmed.split('\n');
  const commandLine = lines[0].slice('/sandbox '.length).trim();
  if (!commandLine) {
    return null;
  }

  const [command, ...args] = commandLine.split(/\s+/g);
  if (!command) {
    return null;
  }

  const files = parseCodeBlocks(trimmed);
  const capturePaths = lines
    .filter((line) => line.startsWith('capture:'))
    .flatMap((line) => line.slice('capture:'.length).split(',').map((entry) => entry.trim()).filter(Boolean));
  const persistRoot = lines.find((line) => line.startsWith('persist:'))?.slice('persist:'.length).trim();

  return {
    commandLine,
    request: {
      title: 'chat-sandbox-tool-run',
      files: files.map((file) => ({ path: file.filePath, content: file.content })),
      command: { command, args },
      capturePaths,
      persist: persistRoot ? { mode: 'just-bash', rootDir: persistRoot } : undefined,
    },
  };
}
