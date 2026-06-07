import type { IncomingMessage } from 'node:http';

export const DEFAULT_MAX_JSON_BODY_BYTES = 1_000_000;

export class JsonBodyError extends Error {
  constructor(
    public readonly statusCode: 400 | 413,
    message: string,
  ) {
    super(message);
    this.name = 'JsonBodyError';
  }
}

export function isJsonBodyError(error: unknown): error is JsonBodyError {
  return error instanceof JsonBodyError;
}

export async function readJsonBody(
  req: IncomingMessage,
  options: { maxBytes?: number } = {},
): Promise<unknown> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BODY_BYTES;
  const contentLength = readContentLength(req.headers['content-length']);
  if (contentLength !== null && contentLength > maxBytes) {
    throw new JsonBodyError(413, `Request body exceeds ${maxBytes} bytes.`);
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      throw new JsonBodyError(413, `Request body exceeds ${maxBytes} bytes.`);
    }
    chunks.push(buffer);
  }

  if (!chunks.length) return {};

  try {
    return JSON.parse(Buffer.concat(chunks, totalBytes).toString('utf-8'));
  } catch {
    throw new JsonBodyError(400, 'Request body must be valid JSON.');
  }
}

function readContentLength(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
