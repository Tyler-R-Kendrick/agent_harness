export type ExtensionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: LocalModelConnectionErrorCode; status?: number };

export type LocalModelConnectionErrorCode =
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
  | 'TIMEOUT'
  | 'BROWSER_EXTENSION_ERROR';

export type LocalModelConnectionStatus =
  | 'extension-not-installed'
  | 'extension-installed'
  | 'permission-required'
  | 'permission-denied'
  | 'endpoint-unavailable'
  | 'browser-extension-error'
  | 'unsupported-api'
  | 'auth-failed'
  | 'connected';

export interface LocalProviderPreset {
  id: 'lm-studio' | 'ollama-openai' | 'foundry-local' | 'custom';
  label: string;
  defaultBaseUrl: string;
  apiKeyRequired: boolean;
  notes?: string;
}

export interface LocalModelSummary {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

export interface LocalModelSettingsResponse {
  providerId?: string;
  baseUrl?: string;
  selectedModel?: string;
  hasStoredApiKey: boolean;
}

export interface StreamEvent {
  type: 'start' | 'token' | 'done' | 'error';
  requestId: string;
  token?: string;
  raw?: unknown;
  error?: string;
  code?: LocalModelConnectionErrorCode;
  status?: number;
}
