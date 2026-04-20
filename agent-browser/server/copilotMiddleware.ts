import { approveAll, CopilotClient, type ModelInfo } from '@github/copilot-sdk';
import type { IncomingMessage, ServerResponse } from 'node:http';

const SIGN_IN_COMMAND = 'copilot login';
const SIGN_IN_DOCS_URL = 'https://docs.github.com/copilot/how-tos/copilot-cli';

export interface CopilotModelSummary {
  id: string;
  name: string;
  policyState?: string;
  reasoning: boolean;
  vision: boolean;
  billingMultiplier?: number;
}

export interface CopilotStatusResponse {
  available: boolean;
  authenticated: boolean;
  authType?: string;
  host?: string;
  login?: string;
  statusMessage?: string;
  error?: string;
  models: CopilotModelSummary[];
  signInCommand: string;
  signInDocsUrl: string;
}

type CopilotChatRequest = {
  modelId?: string;
  prompt?: string;
  sessionId?: string;
};

type CopilotStreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'final'; content: string }
  | { type: 'done'; aborted?: boolean }
  | { type: 'error'; message: string };

type CopilotSessionRecord = {
  modelId: string;
  session: Awaited<ReturnType<CopilotClient['createSession']>>;
};

export class CopilotBridge {
  private clientPromise: Promise<CopilotClient> | null = null;

  private readonly sessionsByChatSessionId = new Map<string, Promise<CopilotSessionRecord>>();

  constructor(private readonly createClient: () => CopilotClient = () => new CopilotClient({
    cwd: process.cwd(),
    useLoggedInUser: true,
  })) {}

  private getClient(): Promise<CopilotClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const client = this.createClient();
        await client.start();
        return client;
      })();
    }
    return this.clientPromise;
  }

  private async createSessionRecord(sessionId: string, modelId: string): Promise<CopilotSessionRecord> {
    const client = await this.getClient();
    const session = await client.createSession({
      sessionId,
      model: modelId,
      clientName: 'agent-browser',
      workingDirectory: process.cwd(),
      streaming: true,
      availableTools: [],
      enableConfigDiscovery: false,
      infiniteSessions: { enabled: false },
      onPermissionRequest: approveAll,
    });

    return { modelId, session };
  }

  private async getOrCreateSession(sessionId: string, modelId: string): Promise<CopilotSessionRecord> {
    const existingPromise = this.sessionsByChatSessionId.get(sessionId);
    if (existingPromise) {
      const existing = await existingPromise;
      if (existing.modelId !== modelId) {
        await existing.session.setModel(modelId);
        existing.modelId = modelId;
      }
      return existing;
    }

    const createdPromise = this.createSessionRecord(sessionId, modelId).catch((error) => {
      this.sessionsByChatSessionId.delete(sessionId);
      throw error;
    });
    this.sessionsByChatSessionId.set(sessionId, createdPromise);
    return createdPromise;
  }

  private async invalidateSession(sessionId: string): Promise<void> {
    const existingPromise = this.sessionsByChatSessionId.get(sessionId);
    if (!existingPromise) return;

    this.sessionsByChatSessionId.delete(sessionId);

    try {
      const existing = await existingPromise;
      await existing.session.disconnect().catch(() => undefined);
    } catch {
      // Ignore cleanup failures for invalidated sessions.
    }
  }

  async getStatus(): Promise<CopilotStatusResponse> {
    try {
      const client = await this.getClient();
      const auth = await client.getAuthStatus();
      const models = auth.isAuthenticated
        ? (await client.listModels()).filter(isEnabledCopilotModel).map(toCopilotModelSummary)
        : [];

      return {
        available: true,
        authenticated: auth.isAuthenticated,
        authType: auth.authType,
        host: auth.host,
        login: auth.login,
        statusMessage: auth.statusMessage,
        models,
        signInCommand: SIGN_IN_COMMAND,
        signInDocsUrl: SIGN_IN_DOCS_URL,
      };
    } catch (error) {
      return {
        available: false,
        authenticated: false,
        error: error instanceof Error ? error.message : 'GitHub Copilot is unavailable in this environment.',
        models: [],
        signInCommand: SIGN_IN_COMMAND,
        signInDocsUrl: SIGN_IN_DOCS_URL,
      };
    }
  }

  async streamChat(request: Required<CopilotChatRequest>, signal: AbortSignal, onEvent: (event: CopilotStreamEvent) => void): Promise<void> {
    const { session } = await this.getOrCreateSession(request.sessionId, request.modelId);

    let settled = false;
    const disposers: Array<() => void> = [];

    const cleanup = () => {
      for (const dispose of disposers) dispose();
    };

    await new Promise<void>((resolve, reject) => {
      const finish = (callback?: () => void) => {
        if (settled) return;
        settled = true;
        callback?.();
        cleanup();
        resolve();
      };

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        void this.invalidateSession(request.sessionId);
        reject(error);
      };

      disposers.push(
        session.on('assistant.message_delta', (event) => {
          if (event.data.deltaContent) onEvent({ type: 'token', delta: event.data.deltaContent });
        }),
        session.on('assistant.reasoning_delta', (event) => {
          if (event.data.deltaContent) onEvent({ type: 'reasoning', delta: event.data.deltaContent });
        }),
        session.on('assistant.message', (event) => {
          if (event.data.content) onEvent({ type: 'final', content: event.data.content });
        }),
        session.on('session.error', (event) => {
          fail(new Error(event.data.message || 'GitHub Copilot failed to respond.'));
        }),
        session.on('session.idle', (event) => {
          finish(() => onEvent({ type: 'done', aborted: Boolean(event.data.aborted) }));
        }),
      );

      const abort = () => {
        void session.abort().catch(() => undefined);
      };

      signal.addEventListener('abort', abort, { once: true });
      disposers.push(() => signal.removeEventListener('abort', abort));

      void session.send({ prompt: request.prompt }).catch((error) => {
        fail(error instanceof Error ? error : new Error('GitHub Copilot request failed.'));
      });
    });
  }
}

const bridge = new CopilotBridge();

function isEnabledCopilotModel(model: ModelInfo): boolean {
  return !model.policy || model.policy.state === 'enabled';
}

function toCopilotModelSummary(model: ModelInfo): CopilotModelSummary {
  return {
    id: model.id,
    name: model.name,
    policyState: model.policy?.state,
    reasoning: Boolean(model.capabilities.supports.reasoningEffort),
    vision: Boolean(model.capabilities.supports.vision),
    billingMultiplier: model.billing?.multiplier,
  };
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

function writeStreamEvent(res: ServerResponse, event: CopilotStreamEvent) {
  res.write(`${JSON.stringify(event)}\n`);
}

export function createCopilotApiMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: (error?: Error) => void) => {
    const url = req.url ?? '';
    if (url !== '/api/copilot/status' && url !== '/api/copilot/chat') {
      next();
      return;
    }

    try {
      if (req.method === 'GET' && url === '/api/copilot/status') {
        writeJson(res, 200, await bridge.getStatus());
        return;
      }

      if (req.method === 'POST' && url === '/api/copilot/chat') {
        const body = (await readJsonBody(req)) as CopilotChatRequest;
        if (!body.modelId || !body.prompt || !body.sessionId) {
          writeJson(res, 400, { error: 'modelId, prompt, and sessionId are required.' });
          return;
        }

        const status = await bridge.getStatus();
        if (!status.available) {
          writeJson(res, 503, { error: status.error ?? 'GitHub Copilot is unavailable.' });
          return;
        }
        if (!status.authenticated) {
          writeJson(res, 401, { error: 'GitHub Copilot is not signed in in this environment.', signInCommand: status.signInCommand, signInDocsUrl: status.signInDocsUrl });
          return;
        }
        if (!status.models.some((model) => model.id === body.modelId)) {
          writeJson(res, 400, { error: `GitHub Copilot model "${body.modelId}" is not enabled for this account.` });
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
          writeStreamEvent(res, { type: 'error', message: error instanceof Error ? error.message : 'GitHub Copilot request failed.' });
        } finally {
          req.off('aborted', abortRequest);
          req.off('close', abortRequest);
          res.end();
        }
        return;
      }

      writeJson(res, 405, { error: 'Method not allowed.' });
    } catch (error) {
      next(error instanceof Error ? error : new Error('GitHub Copilot middleware failed.'));
    }
  };
}