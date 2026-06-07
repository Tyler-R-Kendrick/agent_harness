import { describe, expect, it } from 'vitest';
import { JsonBodyError, readJsonBody } from './jsonBody';

function createRequest(body?: string, headers?: Record<string, string>) {
  const chunks = body === undefined ? [] : [Buffer.from(body)];
  return {
    headers: headers ?? {},
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

describe('readJsonBody', () => {
  it('parses valid JSON request bodies', async () => {
    const req = createRequest('{"prompt":"hello"}', { 'content-length': '18' });

    await expect(readJsonBody(req as never)).resolves.toEqual({ prompt: 'hello' });
  });

  it('returns an empty object for empty request bodies', async () => {
    await expect(readJsonBody(createRequest() as never)).resolves.toEqual({});
  });

  it('rejects oversized requests before buffering the body', async () => {
    const req = createRequest('{"prompt":"hello"}', { 'content-length': '1000001' });

    await expect(readJsonBody(req as never)).rejects.toEqual(
      new JsonBodyError(413, 'Request body exceeds 1000000 bytes.'),
    );
  });

  it('rejects requests that exceed the byte limit while streaming', async () => {
    const req = {
      headers: {},
      async *[Symbol.asyncIterator]() {
        yield Buffer.from('{"prompt":"');
        yield Buffer.from('1234567890"}');
      },
    };

    await expect(readJsonBody(req as never, { maxBytes: 16 })).rejects.toEqual(
      new JsonBodyError(413, 'Request body exceeds 16 bytes.'),
    );
  });

  it('rejects malformed JSON bodies with a 400 error', async () => {
    const req = createRequest('{"prompt":');

    await expect(readJsonBody(req as never)).rejects.toEqual(
      new JsonBodyError(400, 'Request body must be valid JSON.'),
    );
  });
});
