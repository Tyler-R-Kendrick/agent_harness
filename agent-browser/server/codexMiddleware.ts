import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';

const SIGN_IN_COMMAND = 'codex login';
const SIGN_IN_DOCS_URL = 'https://developers.openai.com/codex/auth';
const DEFAULT_CODEX_MODEL_ID = 'codex-default';

export interface CodexModelSummary {
  id: string;
  name: string;
  reasoning: boolean;
  vision: boolean;
  contextWindow?: number;
  maxOutputTokens?: number;
}

export interface CodexStatusResponse {
  available: boolean;
  authenticated: boolean;
  version?: string;
  statusMessage?: string;
  error?: string;
  models: CodexModelSummary[];
  signInCommand: string;
  signInDocsUrl: string;
}

type CodexChatRequest = {
  modelId?: string;
  prompt?: string;
  sessionId?: string;
};

type CodexStreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'final'; content: string }
  | { type: 'done'; aborted?: boolean }
  | { type: 'error'; message: string };

type SpawnLike = (command: string, args: string[], options: SpawnOptionsWithoutStdio) => ChildProcessWithoutNullStreams;

const DEFAULT_CODEX_MODEL: CodexModelSummary = {
  id: DEFAULT_CODEX_MODEL_ID,
  name: 'Codex default',
  reasoning: true,
  vision: false,
};

export class CodexBridge {
  private readonly spawn: SpawnLike;

  private readonly command: string;

  constructor({
    spawn = nodeSpawn,
    command = 'codex',
  }: {
    spawn?: SpawnLike;
    command?: string;
  } = {}) {
    this.spawn = spawn;
    this.command = command;
  }

  async getStatus(): Promise<CodexStatusResponse> {
    try {
      const versionOutput = await this.runVersionCommand();
      const version = extractCodexVersion(versionOutput);
      return {
        available: true,
        authenticated: true,
        version,
        statusMessage: version ? `Codex CLI ${version} available.` : 'Codex CLI available.',
        models: [DEFAULT_CODEX_MODEL],
        signInCommand: SIGN_IN_COMMAND,
        signInDocsUrl: SIGN_IN_DOCS_URL,
      };
    } catch (error) {
      return {
        available: false,
        authenticated: false,
        error: error instanceof Error ? error.message : 'Codex CLI is unavailable in this environment.',
        models: [],
        signInCommand: SIGN_IN_COMMAND,
        signInDocsUrl: SIGN_IN_DOCS_URL,
      };
    }
  }

  private runVersionCommand(): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = this.spawn(this.command, ['--version'], {
        cwd: process.cwd(),
        env: process.env,
      });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });
      child.on('error', (error) => reject(error));
      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error((stderr || stdout || `codex --version exited with code ${code}`).trim()));
        }
      });
    });
  }

  async streamChat(request: Required<CodexChatRequest>, signal: AbortSignal, onEvent: (event: CodexStreamEvent) => void): Promise<void> {
    const args = [
      'exec',
      '--json',
      '--color',
      'never',
      '--sandbox',
      'workspace-write',
      '--ask-for-approval',
      'never',
      '-C',
      process.cwd(),
    ];

    if (request.modelId !== DEFAULT_CODEX_MODEL_ID) {
      args.push('--model', request.modelId);
    }

    args.push('-');

    const child = this.spawn(this.command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CODEX_INTERNAL_ORIGINATOR_OVERRIDE: process.env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE ?? 'Agent Browser',
      },
    });

    let stdoutBuffer = '';
    let stderr = '';
    let finalContent = '';
    let emittedDone = false;

    const abort = () => {
      child.kill();
    };
    signal.addEventListener('abort', abort, { once: true });

    await new Promise<void>((resolve, reject) => {
      child.stdout.on('data', (chunk: Buffer | string) => {
        stdoutBuffer += chunk.toString();
        let newlineIndex = stdoutBuffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = stdoutBuffer.slice(0, newlineIndex).trim();
          stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
          if (line) {
            const event = toCodexStreamEvent(line);
            if (event) {
              if (event.type === 'final') finalContent = event.content;
              if (event.type === 'done') emittedDone = true;
              onEvent(event);
            }
          }
          newlineIndex = stdoutBuffer.indexOf('\n');
        }
      });
      child.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });
      child.on('error', (error) => reject(error));
      child.on('close', (code) => {
        try {
          const trailing = stdoutBuffer.trim();
          if (trailing) {
            const event = toCodexStreamEvent(trailing);
            if (event) {
              if (event.type === 'final') finalContent = event.content;
              if (event.type === 'done') emittedDone = true;
              onEvent(event);
            }
          }

          if (code !== 0 && !signal.aborted) {
            reject(new Error((stderr || `Codex exited with code ${code}`).trim()));
            return;
          }

          if (finalContent && !emittedDone) {
            emittedDone = true;
            onEvent({ type: 'done', aborted: signal.aborted });
          } else if (!emittedDone) {
            emittedDone = true;
            onEvent({ type: 'done', aborted: signal.aborted });
          }
          resolve();
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Codex stream parsing failed.'));
        }
      });

      child.stdin.end(request.prompt);
    }).finally(() => {
      signal.removeEventListener('abort', abort);
    });
  }
}

const bridge = new CodexBridge();

function extractCodexVersion(output: string): string | undefined {
  const match = output.match(/(\d+\.\d+\.\d+(?:[-+\w.]*)?)/);
  return match?.[1];
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function extractText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const text = value.map(extractText).filter((entry): entry is string => Boolean(entry)).join('');
    return text || undefined;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return getString(record, 'text')
      ?? getString(record, 'content')
      ?? getString(record, 'message')
      ?? extractText(record.content);
  }
  return undefined;
}

function toCodexStreamEvent(line: string): CodexStreamEvent | null {
  const event = JSON.parse(line) as Record<string, unknown>;
  const type = getString(event, 'type') ?? '';

  const delta = getString(event, 'delta') ?? getString(event, 'text');
  if ((type.includes('reasoning') || type.includes('thinking')) && delta) {
    return { type: 'reasoning', delta };
  }
  if ((type.includes('message_delta') || type.includes('token') || type.includes('delta')) && delta) {
    return { type: 'token', delta };
  }

  const item = event.item && typeof event.item === 'object' ? event.item as Record<string, unknown> : undefined;
  if (item) {
    const itemType = getString(item, 'type') ?? '';
    const itemText = extractText(item.content) ?? extractText(item.summary) ?? extractText(item.text);
    if (itemType.includes('reasoning') && itemText) {
      return { type: 'reasoning', delta: itemText };
    }
    if ((itemType.includes('message') || itemType.includes('output')) && itemText) {
      return { type: 'final', content: itemText };
    }
  }

  const finalContent = getString(event, 'message') ?? getString(event, 'content') ?? extractText(event.output);
  if ((type.includes('message') || type.includes('final') || type.includes('completed')) && finalContent) {
    return { type: 'final', content: finalContent };
  }
  if (type.includes('error')) {
    return { type: 'error', message: getString(event, 'message') ?? 'Codex request failed.' };
  }
  if (type.includes('done')) {
    return { type: 'done' };
  }
  return null;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function writeStreamEvent(res: ServerResponse, event: CodexStreamEvent) {
  res.write(`${JSON.stringify(event)}\n`);
}

export function createCodexApiMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: (error?: Error) => void) => {
    const url = req.url ?? '';
    if (url !== '/api/codex/status' && url !== '/api/codex/chat') {
      next();
      return;
    }

    try {
      if (req.method === 'GET' && url === '/api/codex/status') {
        writeJson(res, 200, await bridge.getStatus());
        return;
      }

      if (req.method === 'POST' && url === '/api/codex/chat') {
        const body = (await readJsonBody(req)) as CodexChatRequest;
        if (!body.modelId || !body.prompt || !body.sessionId) {
          writeJson(res, 400, { error: 'modelId, prompt, and sessionId are required.' });
          return;
        }

        const status = await bridge.getStatus();
        if (!status.available) {
          writeJson(res, 503, { error: status.error ?? 'Codex CLI is unavailable.', signInCommand: status.signInCommand, signInDocsUrl: status.signInDocsUrl });
          return;
        }
        if (!status.authenticated) {
          writeJson(res, 401, { error: 'Codex is not signed in in this environment.', signInCommand: status.signInCommand, signInDocsUrl: status.signInDocsUrl });
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Accel-Buffering', 'no');

        const controller = new AbortController();
        const abortRequest = () => controller.abort();
        req.on('aborted', abortRequest);
        req.on('close', abortRequest);

        try {
          await bridge.streamChat({ modelId: body.modelId, prompt: body.prompt, sessionId: body.sessionId }, controller.signal, (event) => writeStreamEvent(res, event));
        } catch (error) {
          writeStreamEvent(res, { type: 'error', message: error instanceof Error ? error.message : 'Codex request failed.' });
        } finally {
          req.off('aborted', abortRequest);
          req.off('close', abortRequest);
          res.end();
        }
        return;
      }

      writeJson(res, 405, { error: 'Method not allowed.' });
    } catch (error) {
      next(error instanceof Error ? error : new Error('Codex middleware failed.'));
    }
  };
}
