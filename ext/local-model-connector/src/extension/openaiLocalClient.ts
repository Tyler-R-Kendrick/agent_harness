import {
  ConnectorError,
  fail,
  failFromUnknown,
  failure,
  ok,
  type ChatCompletionRequestBody,
  type ExtensionFailure,
  type ExtensionResult,
  type FetchLike,
  type LocalModelList,
  type LocalModelSummary,
} from './types';
import {
  assertAllowedOpenAIPath,
  assertChatCompletionBody,
  normalizeOpenAIBaseUrl,
  normalizeTimeoutMs,
} from './validation';

export interface LocalClientArgs {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

export interface ChatCompletionArgs extends LocalClientArgs {
  body: unknown;
}

export async function listModels(args: LocalClientArgs): Promise<ExtensionResult<LocalModelList>> {
  try {
    const response = await fetchLocalEndpoint({
      ...args,
      path: '/v1/models',
      method: 'GET',
      accept: 'application/json',
    });
    if (!response.ok) return httpError(response, 'models');
    const parsed = await response.json() as unknown;
    return ok(sanitizeModelList(parsed));
  } catch (error) {
    return failFromFetchError(error);
  }
}

export async function chatCompletion(args: ChatCompletionArgs): Promise<ExtensionResult<unknown>> {
  try {
    const body = {
      ...assertChatCompletionBody(args.body),
      stream: false,
    };
    const response = await fetchLocalEndpoint({
      ...args,
      path: '/v1/chat/completions',
      method: 'POST',
      accept: 'application/json',
      body,
    });
    if (!response.ok) return httpError(response, 'chat completion');
    return ok(await parseJsonOrText(response));
  } catch (error) {
    return failFromFetchError(error);
  }
}

export async function fetchLocalEndpoint(args: LocalClientArgs & {
  path: '/v1/models' | '/v1/chat/completions' | '/v1/embeddings' | '/v1/completions';
  method: 'GET' | 'POST';
  accept: string;
  body?: ChatCompletionRequestBody | Record<string, unknown>;
}): Promise<Response> {
  assertAllowedOpenAIPath(args.path);
  const baseUrl = normalizeOpenAIBaseUrl(args.baseUrl);
  const endpointUrl = `${baseUrl}${args.path.slice('/v1'.length)}`;
  const timeoutMs = normalizeTimeoutMs(args.timeoutMs);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new ConnectorError('Request timed out.', 'TIMEOUT')), timeoutMs);
  const fetchImpl = args.fetchImpl ?? fetch;

  try {
    return await fetchImpl(endpointUrl, {
      method: args.method,
      credentials: 'omit',
      signal: controller.signal,
      headers: buildHeaders(args.accept, args.apiKey, args.body !== undefined),
      ...(args.body !== undefined ? { body: JSON.stringify(args.body) } : {}),
    });
  } finally {
    clearTimeout(timer);
  }
}

export function buildHeaders(accept: string, apiKey?: string, hasBody = false): Record<string, string> {
  const headers: Record<string, string> = { Accept: accept };
  if (hasBody) headers['Content-Type'] = 'application/json';
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

export function mapStatusCode(status: number, context: 'models' | 'chat completion' | 'stream'): ExtensionFailure {
  if (status === 401 || status === 403) return failure('Authentication failed.', 'AUTH_FAILED', status);
  if (status === 404) {
    return failure(
      context === 'models' ? 'Endpoint does not look like an OpenAI-compatible /v1 API.' : 'Endpoint path is not supported.',
      context === 'models' ? 'UNSUPPORTED_API' : 'ENDPOINT_HTTP_ERROR',
      status,
    );
  }
  if (status === 408) return failure('Request timed out.', 'TIMEOUT', status);
  return failure('Local endpoint returned an HTTP error.', 'ENDPOINT_HTTP_ERROR', status);
}

function httpError(response: Response, context: 'models' | 'chat completion'): ExtensionFailure {
  return mapStatusCode(response.status, context);
}

function sanitizeModelList(value: unknown): LocalModelList {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new ConnectorError('Endpoint response is not an OpenAI-compatible model list.', 'UNSUPPORTED_API');
  }
  const data: LocalModelSummary[] = value.data.map((item) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id.trim()) {
      throw new ConnectorError('Endpoint response contains a malformed model entry.', 'UNSUPPORTED_API');
    }
    return {
      id: item.id,
      ...(typeof item.object === 'string' ? { object: item.object } : {}),
      ...(typeof item.created === 'number' ? { created: item.created } : {}),
      ...(typeof item.owned_by === 'string' ? { owned_by: item.owned_by } : {}),
    };
  });
  return {
    ...(typeof value.object === 'string' ? { object: value.object } : {}),
    data,
  };
}

async function parseJsonOrText(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  try {
    return await response.clone().json() as unknown;
  } catch {
    return {
      text: await response.text(),
      contentType,
    };
  }
}

function failFromFetchError(error: unknown): ExtensionResult<never> {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return fail('Request timed out.', 'TIMEOUT');
  }
  if (error instanceof ConnectorError) {
    return failFromUnknown(error);
  }
  if (error instanceof TypeError) {
    return fail('No local model server responded at this address.', 'ENDPOINT_UNAVAILABLE');
  }
  return failFromUnknown(error, 'ENDPOINT_UNAVAILABLE');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
