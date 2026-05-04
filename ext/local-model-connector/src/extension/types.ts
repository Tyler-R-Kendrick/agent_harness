export type LocalModelConnectorErrorCode =
  | 'EXTENSION_NOT_INSTALLED'
  | 'SENDER_ORIGIN_NOT_ALLOWED'
  | 'TARGET_ORIGIN_NOT_ALLOWED'
  | 'HOST_PERMISSION_REQUIRED'
  | 'HOST_PERMISSION_DENIED'
  | 'ENDPOINT_UNAVAILABLE'
  | 'ENDPOINT_HTTP_ERROR'
  | 'AUTH_FAILED'
  | 'UNSUPPORTED_API'
  | 'INVALID_REQUEST'
  | 'INVALID_BASE_URL'
  | 'STREAM_ABORTED'
  | 'STREAM_PARSE_ERROR'
  | 'TIMEOUT';

export type ExtensionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: LocalModelConnectorErrorCode; status?: number };

export type ExtensionFailure = Extract<ExtensionResult<never>, { ok: false }>;

export interface LocalModelSummary {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

export interface LocalModelList {
  object?: string;
  data: LocalModelSummary[];
}

export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatCompletionMessage {
  role: ChatMessageRole;
  content: string | unknown[];
}

export interface ChatCompletionRequestBody {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface LocalModelSettings {
  providerId?: string;
  baseUrl?: string;
  selectedModel?: string;
  persistApiKey?: boolean;
  apiKey?: string;
}

export interface LocalModelSettingsResponse {
  providerId?: string;
  baseUrl?: string;
  selectedModel?: string;
  hasStoredApiKey: boolean;
}

export type StreamEvent =
  | { type: 'start'; requestId: string }
  | { type: 'token'; requestId: string; token: string; raw?: unknown }
  | { type: 'done'; requestId: string }
  | { type: 'error'; requestId: string; error: string; code?: LocalModelConnectorErrorCode; status?: number };

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class ConnectorError extends Error {
  readonly code: LocalModelConnectorErrorCode;
  readonly status?: number;

  constructor(message: string, code: LocalModelConnectorErrorCode, status?: number) {
    super(message);
    this.name = 'ConnectorError';
    this.code = code;
    this.status = status;
  }
}

export function ok<T>(data: T): ExtensionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  error: string,
  code?: LocalModelConnectorErrorCode,
  status?: number,
): ExtensionResult<T> {
  return failure(error, code, status) as ExtensionResult<T>;
}

export function failure(
  error: string,
  code?: LocalModelConnectorErrorCode,
  status?: number,
): ExtensionFailure {
  return {
    ok: false,
    error,
    ...(code ? { code } : {}),
    ...(typeof status === 'number' ? { status } : {}),
  };
}

export function failFromUnknown<T = never>(
  error: unknown,
  fallbackCode: LocalModelConnectorErrorCode = 'INVALID_REQUEST',
): ExtensionResult<T> {
  if (error instanceof ConnectorError) {
    return fail(error.message, error.code, error.status);
  }
  return fail('Request could not be completed.', fallbackCode);
}
