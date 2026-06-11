import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSearchResultUrl } from './searchResultUrl.ts';

test('normalizeSearchResultUrl resolves relative provider links', () => {
  assert.equal(
    normalizeSearchResultUrl('/result?id=1', 'https://duckduckgo.com'),
    'https://duckduckgo.com/result?id=1',
  );
  assert.equal(
    normalizeSearchResultUrl('http://example.com/plain-http', 'https://duckduckgo.com'),
    'http://example.com/plain-http',
  );
});

test('normalizeSearchResultUrl decodes DuckDuckGo redirects to https targets', () => {
  assert.equal(
    normalizeSearchResultUrl('/l/?uddg=https%3A%2F%2Fexample.com%2Fsafe', 'https://duckduckgo.com'),
    'https://example.com/safe',
  );
});

test('normalizeSearchResultUrl rejects DuckDuckGo redirects to non-http targets', () => {
  assert.equal(
    normalizeSearchResultUrl('/l/?uddg=javascript%3Aalert(1)', 'https://duckduckgo.com'),
    null,
  );
  assert.equal(
    normalizeSearchResultUrl('/l/?uddg=', 'https://duckduckgo.com'),
    null,
  );
});

test('normalizeSearchResultUrl decodes Bing redirect targets', () => {
  const encoded = Buffer.from('https://example.com/bing-safe', 'utf8').toString('base64');
  assert.equal(
    normalizeSearchResultUrl(`https://www.bing.com/ck/a?u=${encodeURIComponent(encoded)}`, 'https://www.bing.com'),
    'https://example.com/bing-safe',
  );
  assert.equal(
    normalizeSearchResultUrl(`https://www.bing.com/ck/a?u=${encodeURIComponent(`a1${encoded}`)}`, 'https://www.bing.com'),
    'https://example.com/bing-safe',
  );
});

test('normalizeSearchResultUrl falls back to URL-decoded Bing targets when base64 does not yield http', () => {
  assert.equal(
    normalizeSearchResultUrl('https://www.bing.com/ck/a?u=https%3A%2F%2Fexample.com%2Ffallback', 'https://www.bing.com'),
    'https://example.com/fallback',
  );
});

test('normalizeSearchResultUrl rejects non-http provider links and malformed Bing redirects', () => {
  assert.equal(normalizeSearchResultUrl('javascript:alert(1)', 'https://www.bing.com'), null);
  assert.equal(normalizeSearchResultUrl('https://www.bing.com/ck/a', 'https://www.bing.com'), null);
  assert.equal(normalizeSearchResultUrl('https://www.bing.com/ck/a?u=javascript%3Aalert(1)', 'https://www.bing.com'), null);
  assert.equal(normalizeSearchResultUrl('https://www.bing.com/ck/a?u=%E0%A4%A', 'https://www.bing.com'), null);
});

test('normalizeSearchResultUrl rejects malformed provider URLs and undecodable DuckDuckGo redirects', () => {
  assert.equal(normalizeSearchResultUrl('/result', 'not a valid base'), null);
  assert.equal(normalizeSearchResultUrl('https://%zz/?uddg=https%3A%2F%2Fexample.com', 'https://duckduckgo.com'), null);
  assert.equal(normalizeSearchResultUrl('https://%zzbing.com/ck/a?u=abc', 'https://www.bing.com'), null);
});
