function truncateText(value: string, maxLength = 96): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function basename(path: string): string {
  const normalized = path.replace(/\\+/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.at(-1) ?? path;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function summarizeToolCall(toolName: string, args: unknown): string {
  if (toolName === 'cli' && isRecord(args)) {
    const command = readString(args.command);
    if (command) {
      return `$ ${command.trim()}`;
    }
  }

  if (toolName === 'read_file' && isRecord(args)) {
    const filePath = readString(args.filePath);
    const startLine = readNumber(args.startLine);
    const endLine = readNumber(args.endLine);
    if (filePath && startLine !== null && endLine !== null) {
      return `Read ${basename(filePath)}, lines ${startLine} to ${endLine}`;
    }
  }

  if (toolName === 'create_directory' && isRecord(args)) {
    const dirPath = readString(args.dirPath);
    if (dirPath) {
      return `Created ${basename(dirPath)}`;
    }
  }

  if (toolName === 'create_file' && isRecord(args)) {
    const filePath = readString(args.filePath);
    if (filePath) {
      return `Created ${basename(filePath)}`;
    }
  }

  if (toolName === 'apply_patch') {
    return 'Applied patch';
  }

  if (isRecord(args)) {
    const summary = truncateText(JSON.stringify(args));
    return `${toolName}: ${summary}`;
  }

  return toolName;
}

export function formatToolArgs(args: unknown): string | undefined {
  if (args === undefined) {
    return undefined;
  }
  return JSON.stringify(args, null, 2);
}

export function summarizeToolResult(toolName: string, result: unknown): string | undefined {
  if (toolName === 'cli' && isRecord(result)) {
    const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    const exitCode = readNumber(result.exitCode);
    const combined = [stdout, stderr].filter(Boolean).join('\n');

    if (combined) {
      return combined;
    }

    if (exitCode !== null) {
      return exitCode === 0 ? 'Command completed.' : `Command exited with code ${exitCode}.`;
    }
  }

  if (typeof result === 'string') {
    return result;
  }

  if (result === undefined) {
    return undefined;
  }

  return JSON.stringify(result, null, 2);
}
