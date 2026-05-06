import { chatCompletion, listModels } from './openaiLocalClient';
import { clearSettings, getSettings, saveSettings, type ChromeStorageAreaLike } from './storage';
import {
  fail,
  failFromUnknown,
  ok,
  type ExtensionResult,
  type FetchLike,
  type StreamEvent,
} from './types';
import {
  getOriginFromBaseUrl,
  hostPermissionPatternForOrigin,
  isAllowedSenderOrigin,
  isRecord,
} from './validation';
import { streamChatCompletion } from './streaming';

export interface ChromeSender {
  origin?: string;
  url?: string;
}

export interface ChromePermissionsLike {
  contains(permissions: { origins: string[] }): Promise<boolean>;
  request(permissions: { origins: string[] }): Promise<boolean>;
}

export interface ExtensionManifestLike {
  name?: string;
  version?: string;
  externally_connectable?: {
    matches?: string[];
  };
}

export interface ExternalMessageHandlerEnv {
  allowedSenderPatterns: readonly string[];
  permissions: ChromePermissionsLike;
  storage: ChromeStorageAreaLike;
  fetchImpl?: FetchLike;
  manifest?: ExtensionManifestLike;
}

export interface StreamPortLike {
  name: string;
  sender?: ChromeSender;
  postMessage(message: StreamEvent): void;
  disconnect?(): void;
  onMessage: {
    addListener(listener: (message: unknown) => void): void;
  };
  onDisconnect: {
    addListener(listener: () => void): void;
  };
}

export function createExternalMessageHandler(env: ExternalMessageHandlerEnv) {
  return async (message: unknown, sender: ChromeSender | undefined): Promise<ExtensionResult<unknown>> => {
    const origin = getSenderOrigin(sender);
    if (!origin || !isAllowedSenderOrigin(origin, env.allowedSenderPatterns)) {
      return fail('Sender origin is not allowed.', 'SENDER_ORIGIN_NOT_ALLOWED');
    }
    if (!isRecord(message) || typeof message.type !== 'string') {
      return fail('Message payload is malformed.', 'INVALID_REQUEST');
    }

    try {
      switch (message.type) {
        case 'ping':
          return ok({
            version: env.manifest?.version ?? '0.1.0',
            name: env.manifest?.name ?? 'Local Model Connector',
          });
        case 'requestHostPermission':
          return await requestHostPermission(message, env.permissions);
        case 'listModels':
          return await withHostPermission(message, env, async () => listModels({
            baseUrl: requireString(message.baseUrl, 'baseUrl'),
            apiKey: optionalString(message.apiKey),
            fetchImpl: env.fetchImpl,
          }));
        case 'chatCompletion':
          return await withHostPermission(message, env, async () => chatCompletion({
            baseUrl: requireString(message.baseUrl, 'baseUrl'),
            apiKey: optionalString(message.apiKey),
            body: message.body,
            fetchImpl: env.fetchImpl,
          }));
        case 'saveSettings':
          return await saveSettings(env.storage, message.settings);
        case 'getSettings':
          return await getSettings(env.storage);
        case 'clearSettings':
          return await clearSettings(env.storage);
        default:
          return fail('Unsupported message type.', 'INVALID_REQUEST');
      }
    } catch (error) {
      return failFromUnknown(error);
    }
  };
}

export function registerStreamPort(port: StreamPortLike, env: ExternalMessageHandlerEnv): void {
  if (port.name !== 'local-model-stream') return;
  const disconnectController = new AbortController();
  port.onDisconnect.addListener(() => disconnectController.abort());
  port.onMessage.addListener((message) => {
    void handleStreamPortMessage(message, port, env, disconnectController.signal);
  });
}

async function handleStreamPortMessage(
  message: unknown,
  port: StreamPortLike,
  env: ExternalMessageHandlerEnv,
  disconnectSignal: AbortSignal,
): Promise<void> {
  const origin = getSenderOrigin(port.sender);
  if (!origin || !isAllowedSenderOrigin(origin, env.allowedSenderPatterns)) {
    postPortError(port, message, 'Sender origin is not allowed.', 'SENDER_ORIGIN_NOT_ALLOWED');
    return;
  }
  if (!isRecord(message) || message.type !== 'streamChatCompletion' || typeof message.requestId !== 'string') {
    postPortError(port, message, 'Streaming message payload is malformed.', 'INVALID_REQUEST');
    return;
  }
  const permission = await ensureHostPermission(requireString(message.baseUrl, 'baseUrl'), env.permissions);
  if (!permission.ok) {
    postPortError(port, message, permission.error, permission.code, permission.status);
    return;
  }
  await streamChatCompletion({
    requestId: message.requestId,
    baseUrl: requireString(message.baseUrl, 'baseUrl'),
    apiKey: optionalString(message.apiKey),
    body: message.body,
    fetchImpl: env.fetchImpl,
    disconnectSignal,
    emit: (event) => port.postMessage(event),
  });
}

async function requestHostPermission(
  message: Record<string, unknown>,
  permissions: ChromePermissionsLike,
): Promise<ExtensionResult<{ granted: boolean }>> {
  const origin = requireString(message.origin, 'origin');
  const pattern = hostPermissionPatternForOrigin(origin);
  const granted = await permissions.request({ origins: [pattern] });
  return ok({ granted });
}

async function withHostPermission(
  message: Record<string, unknown>,
  env: ExternalMessageHandlerEnv,
  handler: () => Promise<ExtensionResult<unknown>>,
): Promise<ExtensionResult<unknown>> {
  const permission = await ensureHostPermission(requireString(message.baseUrl, 'baseUrl'), env.permissions);
  return permission.ok ? handler() : permission;
}

async function ensureHostPermission(
  baseUrl: string,
  permissions: ChromePermissionsLike,
): Promise<ExtensionResult<{ granted: true }>> {
  const origin = getOriginFromBaseUrl(baseUrl);
  const pattern = hostPermissionPatternForOrigin(origin);
  const granted = await permissions.contains({ origins: [pattern] });
  return granted
    ? ok({ granted: true })
    : fail('Host permission is required for this local endpoint.', 'HOST_PERMISSION_REQUIRED');
}

function postPortError(
  port: StreamPortLike,
  message: unknown,
  error: string,
  code?: StreamEvent extends infer Event
    ? Event extends { type: 'error'; code?: infer Code }
      ? Code
      : never
    : never,
  status?: number,
): void {
  const requestId = isRecord(message) && typeof message.requestId === 'string' ? message.requestId : '';
  port.postMessage({
    type: 'error',
    requestId,
    error,
    code,
    status,
  });
}

function getSenderOrigin(sender: ChromeSender | undefined): string {
  if (sender?.origin) return sender.origin;
  if (!sender?.url) return '';
  try {
    return new URL(sender.url).origin;
  } catch {
    return '';
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}
