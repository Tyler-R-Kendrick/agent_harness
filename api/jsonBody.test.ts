import assert from 'node:assert/strict';
import test from 'node:test';
import { JsonBodyError, isJsonBodyError, readJsonBody } from './jsonBody.ts';

function createRequest(body?: string, headers?: Record<string, string>) {
  const chunks = body === undefined ? [] : [Buffer.from(body)];
  return {
    headers: headers ?? {},
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

test('readJsonBody parses valid JSON request bodies', async () => {
  await assert.doesNotReject(async () => {
    assert.deepEqual(
      await readJsonBody(createRequest('{"prompt":"hello"}', { 'content-length': '18' }) as never),
      { prompt: 'hello' },
    );
  });
});

test('readJsonBody returns an empty object for empty request bodies', async () => {
  assert.deepEqual(await readJsonBody(createRequest() as never), {});
});

test('readJsonBody treats JSON null as an empty request object', async () => {
  assert.deepEqual(await readJsonBody(createRequest('null') as never), {});
});

test('readJsonBody accepts array content-length headers and string chunks', async () => {
  const req = {
    headers: { 'content-length': ['-1'] },
    async *[Symbol.asyncIterator]() {
      yield '{"ok":true}';
    },
  };

  assert.deepEqual(await readJsonBody(req as never), { ok: true });
});

test('readJsonBody rejects oversized requests before buffering the body', async () => {
  await assert.rejects(
    readJsonBody(createRequest('{"prompt":"hello"}', { 'content-length': '1000001' }) as never),
    new JsonBodyError(413, 'Request body exceeds 1000000 bytes.'),
  );
});

test('readJsonBody ignores invalid content-length values and applies the streaming limit', async () => {
  await assert.rejects(
    readJsonBody(createRequest('{"prompt":"1234567890"}', { 'content-length': 'not-a-number' }) as never, {
      maxBytes: 16,
    }),
    new JsonBodyError(413, 'Request body exceeds 16 bytes.'),
  );
});

test('readJsonBody rejects requests that exceed the byte limit while streaming', async () => {
  const req = {
    headers: {},
    async *[Symbol.asyncIterator]() {
      yield Buffer.from('{"prompt":"');
      yield Buffer.from('1234567890"}');
    },
  };

  await assert.rejects(
    readJsonBody(req as never, { maxBytes: 16 }),
    new JsonBodyError(413, 'Request body exceeds 16 bytes.'),
  );
});

test('readJsonBody rejects malformed JSON bodies with a 400 error', async () => {
  await assert.rejects(
    readJsonBody(createRequest('{"prompt":') as never),
    new JsonBodyError(400, 'Request body must be valid JSON.'),
  );
});

test('isJsonBodyError identifies JsonBodyError instances only', () => {
  assert.equal(isJsonBodyError(new JsonBodyError(400, 'bad')), true);
  assert.equal(isJsonBodyError(new Error('bad')), false);
});
