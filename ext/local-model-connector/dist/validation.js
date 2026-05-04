import { ConnectorError, } from './types';
export const ALLOWED_OPENAI_PATHS = new Set([
    '/v1/models',
    '/v1/chat/completions',
    '/v1/embeddings',
    '/v1/completions',
]);
export const MAX_MESSAGE_PAYLOAD_BYTES = 1_000_000;
export const MAX_TIMEOUT_MS = 120_000;
export const DEFAULT_TIMEOUT_MS = 60_000;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
const MESSAGE_ROLES = new Set(['system', 'user', 'assistant', 'tool']);
export function trimTrailingSlash(value) {
    let next = value;
    while (next.length > 1 && next.endsWith('/')) {
        next = next.slice(0, -1);
    }
    return next;
}
export function assertAllowedLocalBaseUrl(baseUrl) {
    const url = parseUrl(baseUrl, 'Invalid endpoint URL.');
    if (url.protocol !== 'http:') {
        throw new ConnectorError('Only http:// local endpoints are supported.', 'INVALID_BASE_URL');
    }
    if (!LOCAL_HOSTS.has(url.hostname)) {
        throw new ConnectorError('Only localhost or 127.0.0.1 endpoints are allowed.', 'TARGET_ORIGIN_NOT_ALLOWED');
    }
    if (!url.port) {
        throw new ConnectorError('Local endpoint URLs must include an explicit port.', 'INVALID_BASE_URL');
    }
    if (trimTrailingSlash(url.pathname) !== '/v1') {
        throw new ConnectorError('Endpoint must point to an OpenAI-compatible /v1 base URL.', 'INVALID_BASE_URL');
    }
    url.pathname = '/v1';
    url.search = '';
    url.hash = '';
    return url;
}
export function normalizeOpenAIBaseUrl(baseUrl) {
    const url = assertAllowedLocalBaseUrl(baseUrl);
    return `${url.origin}/v1`;
}
export function getOriginFromBaseUrl(baseUrl) {
    return assertAllowedLocalBaseUrl(baseUrl).origin;
}
export function isAllowedLocalOrigin(origin) {
    try {
        const url = parseUrl(origin, 'Invalid local origin.');
        return url.protocol === 'http:'
            && LOCAL_HOSTS.has(url.hostname)
            && Boolean(url.port)
            && url.pathname === '/'
            && !url.search
            && !url.hash;
    }
    catch {
        return false;
    }
}
export function assertAllowedLocalOrigin(origin) {
    if (!isAllowedLocalOrigin(origin)) {
        throw new ConnectorError('Only localhost or 127.0.0.1 HTTP origins with explicit ports are allowed.', 'TARGET_ORIGIN_NOT_ALLOWED');
    }
    return new URL(origin);
}
export function hostPermissionPatternForOrigin(origin) {
    const url = assertAllowedLocalOrigin(origin);
    return `http://${url.hostname}/*`;
}
export function isAllowedSenderOrigin(origin, allowedPatterns) {
    let sender;
    try {
        sender = new URL(origin);
    }
    catch {
        return false;
    }
    return allowedPatterns.some((pattern) => matchesOriginPattern(sender, pattern));
}
export function assertAllowedOpenAIPath(path) {
    if (!ALLOWED_OPENAI_PATHS.has(path)) {
        throw new ConnectorError('Requested OpenAI-compatible path is not allowed.', 'INVALID_REQUEST');
    }
}
export function assertPayloadSize(value, maxBytes = MAX_MESSAGE_PAYLOAD_BYTES) {
    const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
    if (bytes > maxBytes) {
        throw new ConnectorError('Request payload is too large.', 'INVALID_REQUEST');
    }
}
export function normalizeTimeoutMs(timeoutMs) {
    if (timeoutMs === undefined)
        return DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new ConnectorError('Timeout must be a positive number.', 'INVALID_REQUEST');
    }
    return Math.min(Math.floor(timeoutMs), MAX_TIMEOUT_MS);
}
export function assertChatCompletionBody(value) {
    if (!isRecord(value)) {
        throw new ConnectorError('Chat completion body must be an object.', 'INVALID_REQUEST');
    }
    if (typeof value.model !== 'string' || !value.model.trim() || value.model.length > 512) {
        throw new ConnectorError('Chat completion model is required.', 'INVALID_REQUEST');
    }
    if (!Array.isArray(value.messages) || value.messages.length === 0 || value.messages.length > 256) {
        throw new ConnectorError('Chat completion messages must be a non-empty array.', 'INVALID_REQUEST');
    }
    const messages = value.messages.map((message) => {
        if (!isRecord(message) || typeof message.role !== 'string' || !MESSAGE_ROLES.has(message.role)) {
            throw new ConnectorError('Chat completion messages contain an unsupported role.', 'INVALID_REQUEST');
        }
        if (typeof message.content !== 'string' && !Array.isArray(message.content)) {
            throw new ConnectorError('Chat completion message content must be a string or array.', 'INVALID_REQUEST');
        }
        return {
            role: message.role,
            content: message.content,
        };
    });
    const body = {
        model: value.model.trim(),
        messages,
    };
    if (value.temperature !== undefined) {
        if (typeof value.temperature !== 'number' || !Number.isFinite(value.temperature)) {
            throw new ConnectorError('temperature must be a finite number.', 'INVALID_REQUEST');
        }
        body.temperature = value.temperature;
    }
    if (value.max_tokens !== undefined) {
        const maxTokens = value.max_tokens;
        if (typeof maxTokens !== 'number' || !Number.isInteger(maxTokens) || maxTokens <= 0) {
            throw new ConnectorError('max_tokens must be a positive integer.', 'INVALID_REQUEST');
        }
        body.max_tokens = maxTokens;
    }
    if (value.stream !== undefined) {
        body.stream = Boolean(value.stream);
    }
    assertPayloadSize(body);
    return body;
}
export function sanitizeSettings(value) {
    if (!isRecord(value)) {
        throw new ConnectorError('Settings must be an object.', 'INVALID_REQUEST');
    }
    const settings = {};
    if (typeof value.providerId === 'string' && value.providerId.trim()) {
        settings.providerId = value.providerId.trim().slice(0, 80);
    }
    if (typeof value.baseUrl === 'string' && value.baseUrl.trim()) {
        settings.baseUrl = normalizeOpenAIBaseUrl(value.baseUrl);
    }
    if (typeof value.selectedModel === 'string' && value.selectedModel.trim()) {
        settings.selectedModel = value.selectedModel.trim().slice(0, 512);
    }
    settings.persistApiKey = value.persistApiKey === true;
    if (settings.persistApiKey && typeof value.apiKey === 'string' && value.apiKey) {
        settings.apiKey = value.apiKey;
    }
    return settings;
}
export function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parseUrl(value, message) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new ConnectorError(message, 'INVALID_BASE_URL');
    }
    try {
        return new URL(value);
    }
    catch {
        throw new ConnectorError(message, 'INVALID_BASE_URL');
    }
}
function matchesOriginPattern(sender, pattern) {
    const match = /^(https?|\*):\/\/([^/]+)\/\*$/.exec(pattern);
    if (!match)
        return false;
    const [, scheme, hostPattern] = match;
    if (scheme !== '*' && `${scheme}:` !== sender.protocol)
        return false;
    if (hostPattern === '*')
        return true;
    if (hostPattern.startsWith('*.')) {
        const suffix = hostPattern.slice(1);
        return sender.hostname.endsWith(suffix) && sender.hostname !== hostPattern.slice(2);
    }
    return sender.hostname === hostPattern;
}
//# sourceMappingURL=validation.js.map