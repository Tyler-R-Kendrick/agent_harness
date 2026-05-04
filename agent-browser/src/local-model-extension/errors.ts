import type { LocalModelConnectionErrorCode, LocalModelConnectionStatus } from './types';

export class LocalModelExtensionError extends Error {
  readonly code: LocalModelConnectionErrorCode;
  readonly status?: number;

  constructor(message: string, code: LocalModelConnectionErrorCode, status?: number) {
    super(message);
    this.name = 'LocalModelExtensionError';
    this.code = code;
    this.status = status;
  }
}

export function statusFromErrorCode(code?: string): LocalModelConnectionStatus {
  switch (code) {
    case 'EXTENSION_NOT_INSTALLED':
      return 'extension-not-installed';
    case 'HOST_PERMISSION_REQUIRED':
      return 'permission-required';
    case 'HOST_PERMISSION_DENIED':
      return 'permission-denied';
    case 'ENDPOINT_UNAVAILABLE':
      return 'endpoint-unavailable';
    case 'AUTH_FAILED':
      return 'auth-failed';
    case 'UNSUPPORTED_API':
      return 'unsupported-api';
    default:
      return 'browser-extension-error';
  }
}

export function messageForStatus(status: LocalModelConnectionStatus): string {
  switch (status) {
    case 'extension-not-installed':
      return 'Extension not installed. Install the Local Model Connector extension to use local OpenAI-compatible model endpoints.';
    case 'permission-required':
      return 'Permission required. Allow the extension to connect to this local endpoint.';
    case 'permission-denied':
      return 'Permission denied. Re-open settings and grant access to the local endpoint.';
    case 'endpoint-unavailable':
      return 'Endpoint unavailable. Check that the runtime is running and the port is correct.';
    case 'unsupported-api':
      return 'Unsupported API. The endpoint does not look like an OpenAI-compatible /v1 API.';
    case 'auth-failed':
      return 'Authentication failed. Check the local endpoint API key.';
    case 'connected':
      return 'Connected. Local model endpoint connected successfully.';
    case 'extension-installed':
      return 'Extension installed. Choose an endpoint and test the connection.';
    case 'browser-extension-error':
      return 'Browser extension error. Check the extension status and selected endpoint.';
  }
}
