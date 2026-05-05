export type DaemonCommand =
  | { id?: string; action: 'ping' }
  | { id?: string; action: 'listModels'; baseUrl?: string }
  | { id?: string; action: 'chatCompletion'; baseUrl?: string; body: unknown };

export interface DaemonResponse {
  id?: string;
  type: 'pong' | 'models' | 'chatCompletion' | 'error';
  timestamp?: number;
  result?: unknown;
  message?: string;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export class LocalInferenceController {
  constructor(private readonly defaultBaseUrl: string) {}

  async handleMessage(data: string): Promise<DaemonResponse> {
    let command: DaemonCommand;
    try {
      command = JSON.parse(data) as DaemonCommand;
    } catch {
      return { type: 'error', message: 'Command payload must be valid JSON.' };
    }

    try {
      return await this.handleCommand(command);
    } catch (error) {
      return {
        id: command.id,
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async handleCommand(command: DaemonCommand): Promise<DaemonResponse> {
    if (command.action === 'ping') {
      return { id: command.id, type: 'pong', timestamp: Date.now() };
    }

    if (command.action === 'listModels') {
      const result = await this.fetchLocalInference(command.baseUrl, '/models');
      return { id: command.id, type: 'models', result };
    }

    if (command.action === 'chatCompletion') {
      const result = await this.fetchLocalInference(command.baseUrl, '/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(command.body),
      });
      return { id: command.id, type: 'chatCompletion', result };
    }

    return { id: (command as { id?: string }).id, type: 'error', message: 'Unknown daemon command action.' };
  }

  private async fetchLocalInference(baseUrl: string | undefined, path: string, init?: RequestInit): Promise<unknown> {
    const endpoint = resolveLoopbackEndpoint(baseUrl ?? this.defaultBaseUrl, path);
    const response = await fetch(endpoint, init);
    const text = await response.text();
    const parsed = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(`Local inference request failed with ${response.status}: ${text}`);
    }
    return parsed;
  }
}

export function resolveLoopbackEndpoint(baseUrl: string, path: string): URL {
  const endpoint = new URL(path.replace(/^\/?/, ''), `${baseUrl.replace(/\/+$/, '')}/`);
  if (endpoint.protocol !== 'http:' && endpoint.protocol !== 'https:') {
    throw new Error('Local inference endpoint must use http or https.');
  }
  if (!LOOPBACK_HOSTS.has(endpoint.hostname)) {
    throw new Error('Local inference endpoint must target localhost or a loopback IP.');
  }
  return endpoint;
}
