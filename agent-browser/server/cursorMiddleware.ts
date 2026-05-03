import type { IncomingMessage, ServerResponse } from 'node:http';

const SIGN_IN_COMMAND = 'Set CURSOR_API_KEY in the dev server environment';
const SIGN_IN_DOCS_URL = 'https://cursor.com/blog/typescript-sdk';

export interface CursorModelSummary {
  id: string;
  name: string;
  contextWindow?: number;
  maxOutputTokens?: number;
}

export interface CursorStatusResponse {
  available: boolean;
  authenticated: boolean;
  authType?: 'api-key';
  statusMessage?: string;
  error?: string;
  models: CursorModelSummary[];
  signInCommand: string;
  signInDocsUrl: string;
}

type CursorChatRequest = {
  modelId?: string;
  prompt?: string;
  sessionId?: string;
};

type CursorStreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'final'; content: string }
  | { type: 'done'; aborted?: boolean }
  | { type: 'error'; message: string };

type CursorAgentRun = {
  stream?: () => AsyncIterable<unknown>;
  wait?: () => Promise<unknown>;
  abort?: () => Promise<void> | void;
  cancel?: () => Promise<void> | void;
};

type CursorAgent = {
  send: (prompt: string) => Promise<CursorAgentRun> | CursorAgentRun;
};

type CursorAgentCreateInput = {
  apiKey: string;
  model: { id: string };
  local: { cwd: string };
};

type CursorAgentFactory = (input: CursorAgentCreateInput) => Promise<CursorAgent> | CursorAgent;

type CursorBridgeOptions = {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  cwd?: string;
  createAgent?: CursorAgentFactory;
};

const CURSOR_MODELS: CursorModelSummary[] = [
  { id: 'composer-2', name: 'Composer 2', contextWindow: 128000, maxOutputTokens: 8192 },
  { id: 'gpt-5.5', name: 'GPT-5.5', contextWindow: 128000, maxOutputTokens: 8192 },
  { id: 'codex-5.3-high-fast', name: 'Codex 5.3 High Fast', contextWindow: 128000, maxOutputTokens: 8192 },
];

type CursorSessionRecord = {
  modelId: string;
  agent: CursorAgent;
};

export class CursorBridge {
  private readonly env: NodeJS.ProcessEnv | Record<string, string | undefined>;

  private readonly cwd: string;

  private readonly createAgent: CursorAgentFactory;

  private readonly sessionsByChatSessionId = new Map<string, Promise<CursorSessionRecord>>();

  constructor(options: CursorBridgeOptions = {}) {
    this.env = options.env ?? process.env;
    this.cwd = options.cwd ?? process.cwd();
    this.createAgent = options.createAgent ?? createDefaultCursorAgent;
  }

  async getStatus(): Promise<CursorStatusResponse> {
    const apiKey = this.env.CURSOR_API_KEY?.trim();
    if (!apiKey) {
      return {
        available: true,
        authenticated: false,
        error: 'CURSOR_API_KEY is not configured.',
        models: [],
        signInCommand: SIGN_IN_COMMAND,
        signInDocsUrl: SIGN_IN_DOCS_URL,
      };
    }

    return {
      available: true,
      authenticated: true,
      authType: 'api-key',
      statusMessage: 'CURSOR_API_KEY configured',
      models: CURSOR_MODELS,
      signInCommand: SIGN_IN_COMMAND,
      signInDocsUrl: SIGN_IN_DOCS_URL,
    };
  }

  async validateChatRequest(request: Required<CursorChatRequest>): Promise<void> {
    const status = await this.getStatus();
    if (!status.available) {
      throw new Error(status.error ?? 'Cursor is unavailable.');
    }
    if (!status.authenticated) {
      throw new Error('Cursor is not signed in in this environment.');
    }
    if (!status.models.some((model) => model.id === request.modelId)) {
      throw new Error(`Cursor model "${request.modelId}" is not enabled for this environment.`);
    }
  }

  private async createSessionRecord(modelId: string): Promise<CursorSessionRecord> {
    const apiKey = this.env.CURSOR_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('Cursor is not signed in in this environment.');
    }

    const agent = await this.createAgent({
      apiKey,
      model: { id: modelId },
      local: { cwd: this.cwd },
    });

    return { modelId, agent };
  }

  private async getOrCreateSession(sessionId: string, modelId: string): Promise<CursorSessionRecord> {
    const existingPromise = this.sessionsByChatSessionId.get(sessionId);
    if (existingPromise) {
      const existing = await existingPromise;
      if (existing.modelId === modelId) return existing;
      this.sessionsByChatSessionId.delete(sessionId);
    }

    const createdPromise = this.createSessionRecord(modelId).catch((error) => {
      this.sessionsByChatSessionId.delete(sessionId);
      throw error;
    });
    this.sessionsByChatSessionId.set(sessionId, createdPromise);
    return createdPromise;
  }

  async streamChat(request: Required<CursorChatRequest>, signal: AbortSignal, onEvent: (event: CursorStreamEvent) => void): Promise<void> {
    await this.validateChatRequest(request);
    const { agent } = await this.getOrCreateSession(request.sessionId, request.modelId);
    const run = await agent.send(request.prompt);

    const abort = () => {
      void (run.abort?.() ?? run.cancel?.());
    };
    signal.addEventListener('abort', abort, { once: true });

    try {
      if (run.stream) {
        for await (const event of run.stream()) {
          for (const normalized of normalizeCursorRunEvent(event)) {
            onEvent(normalized);
          }
        }
      } else if (run.wait) {
        for (const normalized of normalizeCursorRunEvent(await run.wait())) {
          onEvent(normalized);
        }
      }
      onEvent({ type: 'done' });
    } finally {
      signal.removeEventListener('abort', abort);
    }
  }
}

const bridge = new CursorBridge();

function normalizeCursorRunEvent(event: unknown): CursorStreamEvent[] {
  const record = asRecord(event);
  if (!record) return [];

  const type = getString(record, 'type') ?? getString(record, 'event') ?? getString(record, 'kind');
  const text = getString(record, 'text')
    ?? getString(record, 'delta')
    ?? getString(record, 'content')
    ?? getString(asRecord(record.data), 'text')
    ?? getString(asRecord(record.data), 'delta')
    ?? getString(asRecord(record.data), 'content');

  if (/reasoning/i.test(type ?? '')) {
    return text ? [{ type: 'reasoning', delta: text }] : [];
  }
  if (/error/i.test(type ?? '')) {
    return [{ type: 'error', message: text ?? 'Cursor request failed.' }];
  }
  if (/final|message$|result|complete/i.test(type ?? '')) {
    return text ? [{ type: 'final', content: text }] : [];
  }
  if (/delta|token|message_delta|chunk/i.test(type ?? '')) {
    return text ? [{ type: 'token', delta: text }] : [];
  }

  return text ? [{ type: 'token', delta: text }] : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function getString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

async function createDefaultCursorAgent(input: CursorAgentCreateInput): Promise<CursorAgent> {
  const loader = Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ Agent: { create: CursorAgentFactory } }>;
  const sdk = await loader('@cursor/sdk');
  return sdk.Agent.create(input);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  return JSON.parse(chunks.map((chunk) => chunk.toString('utf-8')).join(''));
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function writeStreamEvent(res: ServerResponse, event: CursorStreamEvent) {
  res.write(`${JSON.stringify(event)}\n`);
}

export function createCursorApiMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: (error?: Error) => void) => {
    const url = req.url ?? '';
    if (url !== '/api/cursor/status' && url !== '/api/cursor/chat') {
      next();
      return;
    }

    try {
      if (req.method === 'GET' && url === '/api/cursor/status') {
        writeJson(res, 200, await bridge.getStatus());
        return;
      }

      if (req.method === 'POST' && url === '/api/cursor/chat') {
        const body = (await readJsonBody(req)) as CursorChatRequest;
        if (!body.modelId || !body.prompt || !body.sessionId) {
          writeJson(res, 400, { error: 'modelId, prompt, and sessionId are required.' });
          return;
        }

        try {
          await bridge.validateChatRequest(body as Required<CursorChatRequest>);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Cursor request failed.';
          const statusCode = /not signed in|api_key/i.test(message) ? 401 : 400;
          writeJson(res, statusCode, { error: message });
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
          await bridge.streamChat(body as Required<CursorChatRequest>, controller.signal, (event) => writeStreamEvent(res, event));
        } catch (error) {
          writeStreamEvent(res, { type: 'error', message: error instanceof Error ? error.message : 'Cursor request failed.' });
        } finally {
          req.off('aborted', abortRequest);
          req.off('close', abortRequest);
          res.end();
        }
        return;
      }

      writeJson(res, 405, { error: 'Method not allowed.' });
    } catch (error) {
      next(error instanceof Error ? error : new Error('Cursor middleware failed.'));
    }
  };
}
