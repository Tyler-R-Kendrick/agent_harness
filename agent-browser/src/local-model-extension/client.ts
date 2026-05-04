import { LocalModelExtensionError } from './errors';
import { LOCAL_PROVIDER_PRESETS } from './presets';
import type {
  ExtensionResult,
  LocalModelSettingsResponse,
  LocalModelSummary,
  StreamEvent,
} from './types';

export { LOCAL_PROVIDER_PRESETS };
export { LocalModelExtensionError, messageForStatus, statusFromErrorCode } from './errors';
export type {
  LocalModelConnectionErrorCode,
  LocalModelConnectionStatus,
  LocalModelSettingsResponse,
  LocalModelSummary,
  LocalProviderPreset,
} from './types';

type RuntimeCallback = (response: unknown) => void;

interface ChromeRuntimeLike {
  lastError?: { message?: string };
  sendMessage(extensionId: string, message: unknown, callback: RuntimeCallback): void;
  connect(extensionId: string, options: { name: string }): ChromePortLike;
}

interface ChromePortLike {
  postMessage(message: unknown): void;
  disconnect(): void;
  onMessage: {
    addListener(listener: (message: unknown) => void): void;
  };
  onDisconnect: {
    addListener(listener: () => void): void;
  };
}

interface ChromeGlobalLike {
  runtime?: ChromeRuntimeLike;
}

declare global {
  var chrome: ChromeGlobalLike | undefined;
}

export interface LocalModelExtensionClientOptions {
  extensionId?: string;
}

export async function probeLocalModelExtension(options: LocalModelExtensionClientOptions = {}): Promise<{
  installed: boolean;
  version?: string;
}> {
  try {
    const response = await sendExtensionMessage<{ version: string }>({ type: 'ping' }, options);
    return { installed: true, version: response.version };
  } catch (error) {
    if (error instanceof LocalModelExtensionError && error.code === 'EXTENSION_NOT_INSTALLED') {
      return { installed: false };
    }
    return { installed: false };
  }
}

export async function requestLocalEndpointPermission(
  originOrArgs: string | ({ origin: string } & LocalModelExtensionClientOptions),
): Promise<{ granted: boolean }> {
  const args = typeof originOrArgs === 'string' ? { origin: originOrArgs } : originOrArgs;
  return sendExtensionMessage({ type: 'requestHostPermission', origin: args.origin }, args);
}

export async function listLocalModelsViaExtension(args: {
  baseUrl: string;
  apiKey?: string;
} & LocalModelExtensionClientOptions): Promise<Array<{ id: string }>> {
  const response = await sendExtensionMessage<{ data: LocalModelSummary[] }>({
    type: 'listModels',
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
  }, args);
  return response.data.map((model) => ({ id: model.id }));
}

export async function runLocalChatCompletionViaExtension(args: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  temperature?: number;
  maxTokens?: number;
} & LocalModelExtensionClientOptions): Promise<unknown> {
  return sendExtensionMessage({
    type: 'chatCompletion',
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
    body: {
      model: args.model,
      messages: args.messages,
      ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
      ...(args.maxTokens !== undefined ? { max_tokens: args.maxTokens } : {}),
      stream: false,
    },
  }, args);
}

export async function getLocalModelExtensionSettings(
  options: LocalModelExtensionClientOptions = {},
): Promise<LocalModelSettingsResponse> {
  return sendExtensionMessage({ type: 'getSettings' }, options);
}

export async function saveLocalModelExtensionSettings(args: {
  providerId: string;
  baseUrl: string;
  selectedModel?: string;
  persistApiKey?: boolean;
  apiKey?: string;
} & LocalModelExtensionClientOptions): Promise<{ saved: true }> {
  return sendExtensionMessage({
    type: 'saveSettings',
    settings: {
      providerId: args.providerId,
      baseUrl: args.baseUrl,
      selectedModel: args.selectedModel,
      persistApiKey: args.persistApiKey,
      apiKey: args.apiKey,
    },
  }, args);
}

export async function clearLocalModelExtensionSettings(
  options: LocalModelExtensionClientOptions = {},
): Promise<{ cleared: true }> {
  return sendExtensionMessage({ type: 'clearSettings' }, options);
}

export function streamLocalChatCompletionViaExtension(args: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  temperature?: number;
  maxTokens?: number;
  onStart?: () => void;
  onToken: (token: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
} & LocalModelExtensionClientOptions): { cancel: () => void } {
  const runtime = getChromeRuntime();
  const extensionId = resolveExtensionId(args.extensionId);
  if (!runtime || !extensionId) {
    args.onError?.(new LocalModelExtensionError('Local Model Connector extension is not installed.', 'EXTENSION_NOT_INSTALLED'));
    return { cancel: () => undefined };
  }

  const requestId = createRequestId();
  const port = runtime.connect(extensionId, { name: 'local-model-stream' });
  let closed = false;
  port.onMessage.addListener((message) => {
    const event = message as StreamEvent;
    if (!event || event.requestId !== requestId) return;
    if (event.type === 'start') args.onStart?.();
    if (event.type === 'token' && event.token !== undefined) args.onToken(event.token);
    if (event.type === 'done') {
      closed = true;
      args.onDone?.();
    }
    if (event.type === 'error') {
      closed = true;
      args.onError?.(new LocalModelExtensionError(event.error ?? 'Streaming failed.', event.code ?? 'BROWSER_EXTENSION_ERROR', event.status));
    }
  });
  port.onDisconnect.addListener(() => {
    if (!closed) {
      args.onError?.(new LocalModelExtensionError('Local model stream disconnected.', 'STREAM_ABORTED'));
    }
  });
  port.postMessage({
    type: 'streamChatCompletion',
    requestId,
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
    body: {
      model: args.model,
      messages: args.messages,
      ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
      ...(args.maxTokens !== undefined ? { max_tokens: args.maxTokens } : {}),
      stream: true,
    },
  });
  return {
    cancel() {
      closed = true;
      port.disconnect();
    },
  };
}

async function sendExtensionMessage<T>(
  message: unknown,
  options: LocalModelExtensionClientOptions = {},
): Promise<T> {
  const runtime = getChromeRuntime();
  const extensionId = resolveExtensionId(options.extensionId);
  if (!runtime || !extensionId) {
    throw new LocalModelExtensionError('Local Model Connector extension is not installed.', 'EXTENSION_NOT_INSTALLED');
  }

  const result = await new Promise<unknown>((resolve, reject) => {
    runtime.sendMessage(extensionId, message, (response) => {
      const lastError = runtime.lastError;
      if (lastError?.message) {
        reject(new LocalModelExtensionError(lastError.message, lastError.message.includes('Receiving end does not exist')
          ? 'EXTENSION_NOT_INSTALLED'
          : 'BROWSER_EXTENSION_ERROR'));
        return;
      }
      resolve(response);
    });
  });
  return unwrapExtensionResult<T>(result);
}

function unwrapExtensionResult<T>(value: unknown): T {
  const result = value as ExtensionResult<T> | undefined;
  if (!result || typeof result !== 'object') {
    throw new LocalModelExtensionError('Extension returned an empty response.', 'BROWSER_EXTENSION_ERROR');
  }
  if (result.ok) return result.data;
  throw new LocalModelExtensionError(result.error, result.code ?? 'BROWSER_EXTENSION_ERROR', result.status);
}

function getChromeRuntime(): ChromeRuntimeLike | undefined {
  return globalThis.chrome?.runtime;
}

function resolveExtensionId(extensionId?: string): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return extensionId
    ?? env?.VITE_LOCAL_MODEL_CONNECTOR_EXTENSION_ID
    ?? globalThis.localStorage?.getItem('local-model-connector.extension-id')
    ?? '';
}

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `local-stream-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
