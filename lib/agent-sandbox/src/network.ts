import { SandboxExecutionError } from './errors';

export interface SandboxFetchResponse {
  url: string;
  status: number;
  statusText: string;
  ok: boolean;
  headers: Record<string, string>;
  bodyText: string;
  truncated: boolean;
}

export interface SandboxFetchPolicyOptions {
  enabled?: boolean;
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowLocalhostHttp?: boolean;
  maxRequestBytes?: number;
  maxResponseBytes?: number;
  timeoutMs?: number;
  fetchImplementation?: typeof fetch;
}

export type SandboxFetchInit = Pick<RequestInit, 'body' | 'credentials' | 'headers' | 'method'>;

const DEFAULT_ALLOWED_METHODS = ['GET', 'HEAD', 'POST'];
const DEFAULT_MAX_REQUEST_BYTES = 64 * 1024;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const BLOCKED_HEADERS = new Set([
  'authorization',
  'cookie',
  'host',
  'proxy-authorization',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-fetch-user',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
]);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeMethod(method: unknown): string {
  return typeof method === 'string' && method.trim() ? method.trim().toUpperCase() : 'GET';
}

function isLocalhost(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/g, '');
}

function isIpv4Hostname(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function parseIpv4Segments(hostname: string): number[] | null {
  if (!isIpv4Hostname(hostname)) {
    return null;
  }

  return hostname.split('.').map((segment) => Number.parseInt(segment, 10));
}

function isPrivateIpv4Hostname(hostname: string): boolean {
  const segments = parseIpv4Segments(hostname);
  if (!segments) {
    return false;
  }

  const [first, second] = segments;
  if (first === 0 || first === 10 || first === 127) {
    return true;
  }
  if (first === 100 && second >= 64 && second <= 127) {
    return true;
  }
  if (first === 169 && second === 254) {
    return true;
  }
  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }
  if (first === 192 && second === 168) {
    return true;
  }
  if (first === 198 && (second === 18 || second === 19)) {
    return true;
  }

  return false;
}

function parseIpv6Segments(hostname: string): number[] | null {
  const normalized = normalizeHostname(hostname);
  if (!normalized.includes(':')) {
    return null;
  }

  const parts = normalized.split('::');
  if (parts.length > 2) {
    return null;
  }

  const parsePart = (part: string): number[] | null => {
    if (!part) {
      return [];
    }

    const segments = part.split(':').map((token) => Number.parseInt(token, 16));
    return segments.every((segment) => Number.isInteger(segment) && segment >= 0 && segment <= 0xffff)
      ? segments
      : null;
  };

  const left = parsePart(parts[0] || '');
  const right = parsePart(parts[1] || '');
  if (!left || !right) {
    return null;
  }

  if (parts.length === 1) {
    return left.length === 8 ? left : null;
  }

  const zeroFillCount = 8 - (left.length + right.length);
  if (zeroFillCount < 1) {
    return null;
  }
  return [...left, ...Array.from({ length: zeroFillCount }, () => 0), ...right];
}

function extractEmbeddedIpv4SegmentsFromIpv6(hostname: string): number[] | null {
  const segments = parseIpv6Segments(hostname);
  if (!segments) {
    return null;
  }

  const lastIpv4Segments = [
    (segments[6]! >> 8) & 0xff,
    segments[6]! & 0xff,
    (segments[7]! >> 8) & 0xff,
    segments[7]! & 0xff,
  ];

  const isIpv4Compatible = segments.slice(0, 6).every((segment) => segment === 0);
  if (isIpv4Compatible) {
    return lastIpv4Segments;
  }

  const isIpv4Mapped = segments.slice(0, 5).every((segment) => segment === 0) && segments[5] === 0xffff;
  if (isIpv4Mapped) {
    return lastIpv4Segments;
  }

  const isWellKnownNat64 = segments[0] === 0x64 && segments[1] === 0xff9b && segments[2] === 0 && segments[3] === 0 && segments[4] === 0 && segments[5] === 0;
  if (isWellKnownNat64) {
    return lastIpv4Segments;
  }

  if (segments[0] === 0x2002) {
    return [
      (segments[1]! >> 8) & 0xff,
      segments[1]! & 0xff,
      (segments[2]! >> 8) & 0xff,
      segments[2]! & 0xff,
    ];
  }

  return null;
}

function isPrivateIpv6Hostname(hostname: string): boolean {
  const segments = parseIpv6Segments(hostname);
  if (!segments) {
    return false;
  }

  if (segments.every((segment) => segment === 0) || segments.every((segment, index) => segment === (index === 7 ? 1 : 0))) {
    return true;
  }

  if ((segments[0]! & 0xffc0) === 0xfe80) {
    return true;
  }

  if ((segments[0]! & 0xfe00) === 0xfc00) {
    return true;
  }

  const embeddedIpv4Segments = extractEmbeddedIpv4SegmentsFromIpv6(hostname);
  if (embeddedIpv4Segments) {
    return isPrivateIpv4Hostname(embeddedIpv4Segments.join('.'));
  }

  return false;
}

const LOOPBACK_DNS_SUFFIXES = ['nip.io', 'sslip.io', 'xip.io'] as const;

function isLoopbackDnsHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  for (const suffix of LOOPBACK_DNS_SUFFIXES) {
    if (!normalized.endsWith(`.${suffix}`)) {
      continue;
    }

    const candidate = normalized.slice(0, -(suffix.length + 1)).replace(/-/g, '.');
    if (candidate === 'localhost' || candidate.endsWith('.localhost')) {
      return true;
    }

    if (isPrivateIpv4Hostname(candidate)) {
      return true;
    }
  }

  return false;
}

function isPublicWebHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
    return false;
  }

  if (isLoopbackDnsHostname(normalized)) {
    return false;
  }

  return !isPrivateIpv4Hostname(normalized) && !isPrivateIpv6Hostname(normalized);
}

function originAllowed(origin: string, allowedOrigins: string[] | undefined): boolean {
  if (!allowedOrigins || allowedOrigins.length === 0) {
    return true;
  }
  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin.startsWith('https://*.')) {
      const suffix = allowedOrigin.slice('https://*.'.length);
      return origin === `https://${suffix}` || origin.endsWith(`.${suffix}`);
    }
    return origin === allowedOrigin;
  });
}

function normalizeHeaders(headers: unknown): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!headers) {
    return normalized;
  }

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      normalized[key.toLowerCase()] = value;
    });
    return normalized;
  }

  if (Array.isArray(headers)) {
    for (const entry of headers) {
      if (Array.isArray(entry) && entry.length === 2) {
        normalized[String(entry[0]).toLowerCase()] = String(entry[1]);
      }
    }
    return normalized;
  }

  if (isRecord(headers)) {
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        normalized[key.toLowerCase()] = value;
      }
    }
  }
  return normalized;
}

function sanitizeHeaders(headers: unknown): Record<string, string> {
  const normalized = normalizeHeaders(headers);
  return Object.fromEntries(
    Object.entries(normalized).filter(([key]) => !BLOCKED_HEADERS.has(key) && !key.startsWith('sec-')),
  );
}

function normalizeBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (typeof body === 'string' || body instanceof Uint8Array || body instanceof ArrayBuffer || body instanceof Blob || body instanceof FormData || body instanceof URLSearchParams) {
    return body as BodyInit;
  }
  throw new SandboxExecutionError('Sandbox fetch request body type is not supported.');
}

function byteLength(body: BodyInit | undefined): number {
  if (!body) {
    return 0;
  }
  if (typeof body === 'string') {
    return textEncoder.encode(body).byteLength;
  }
  if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
    return body.byteLength;
  }
  if (body instanceof Blob) {
    return body.size;
  }
  return 0;
}

async function readLimitedText(response: Response, maxBytes: number): Promise<{ bodyText: string; truncated: boolean }> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    const bodyText = textDecoder.decode((await response.arrayBuffer()).slice(0, maxBytes));
    return { bodyText, truncated: true };
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength <= maxBytes) {
    return { bodyText: textDecoder.decode(bytes), truncated: false };
  }
  return {
    bodyText: textDecoder.decode(bytes.slice(0, maxBytes)),
    truncated: true,
  };
}

export class SandboxFetchPolicy {
  private readonly options: Required<Omit<SandboxFetchPolicyOptions, 'allowedOrigins' | 'fetchImplementation'>> & Pick<SandboxFetchPolicyOptions, 'allowedOrigins' | 'fetchImplementation'>;

  constructor(options: SandboxFetchPolicyOptions = {}) {
    this.options = {
      enabled: options.enabled ?? false,
      allowedOrigins: options.allowedOrigins,
      allowedMethods: options.allowedMethods ?? DEFAULT_ALLOWED_METHODS,
      allowLocalhostHttp: options.allowLocalhostHttp ?? false,
      maxRequestBytes: options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES,
      maxResponseBytes: options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
      timeoutMs: options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
      fetchImplementation: options.fetchImplementation,
    };
  }

  async fetch(input: unknown, init: unknown = {}): Promise<SandboxFetchResponse> {
    if (!this.options.enabled) {
      throw new SandboxExecutionError('Sandbox fetch is disabled by policy.');
    }
    if (typeof input !== 'string') {
      throw new SandboxExecutionError('Sandbox fetch only accepts absolute URL strings.');
    }

    const url = new URL(input);
    const normalizedHostname = normalizeHostname(url.hostname);
    if (url.protocol === 'http:' && !isLocalhost(url.hostname)) {
      throw new SandboxExecutionError('Sandbox fetch requires HTTPS for non-localhost URLs.');
    }
    if (url.protocol === 'http:' && isLocalhost(url.hostname) && !this.options.allowLocalhostHttp) {
      throw new SandboxExecutionError('Sandbox fetch to localhost over HTTP is disabled by policy.');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new SandboxExecutionError('Sandbox fetch only supports HTTP(S) URLs.');
    }
    const allowExplicitLocalhostHttp = url.protocol === 'http:' && isLocalhost(normalizedHostname) && this.options.allowLocalhostHttp;
    if (!allowExplicitLocalhostHttp && !isPublicWebHostname(normalizedHostname)) {
      throw new SandboxExecutionError('Sandbox fetch URL must target a public web host.');
    }
    if (!originAllowed(url.origin, this.options.allowedOrigins)) {
      throw new SandboxExecutionError(`Sandbox fetch origin is not allowed: ${url.origin}`);
    }

    const initRecord = isRecord(init) ? init : {};
    const method = normalizeMethod(initRecord.method);
    if (!this.options.allowedMethods.includes(method)) {
      throw new SandboxExecutionError(`Sandbox fetch method is not allowed: ${method}`);
    }

    const body = normalizeBody(initRecord.body);
    if (byteLength(body) > this.options.maxRequestBytes) {
      throw new SandboxExecutionError(`Sandbox fetch request body exceeds the ${this.options.maxRequestBytes} byte limit.`);
    }

    const fetchImplementation = this.options.fetchImplementation ?? globalThis.fetch;
    if (!fetchImplementation) {
      throw new SandboxExecutionError('Sandbox fetch is unavailable in this runtime.');
    }

    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => {
      abortController.abort('Sandbox fetch timed out.');
    }, this.options.timeoutMs);

    try {
      const response = await fetchImplementation(url.toString(), {
        body,
        credentials: 'omit',
        headers: sanitizeHeaders(initRecord.headers),
        method,
        mode: 'cors',
        redirect: 'manual',
        signal: abortController.signal,
      });
      const { bodyText, truncated } = await readLimitedText(response, this.options.maxResponseBytes);
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        if (!BLOCKED_HEADERS.has(key.toLowerCase())) {
          headers[key.toLowerCase()] = value;
        }
      });
      return {
        url: response.url || url.toString(),
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers,
        bodyText,
        truncated,
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

export const __testOnlySandboxFetchPolicy = {
  normalizeHostname,
  isLocalhost,
  isPrivateIpv4Hostname,
  parseIpv6Segments,
  extractEmbeddedIpv4SegmentsFromIpv6,
  isPrivateIpv6Hostname,
  isLoopbackDnsHostname,
  isPublicWebHostname,
};
