import { describe, expect, it } from 'vitest';

import {
  assertAllowedLocalOrigin,
  assertAllowedLocalBaseUrl,
  assertAllowedOpenAIPath,
  assertChatCompletionBody,
  assertPayloadSize,
  getOriginFromBaseUrl,
  hostPermissionPatternForOrigin,
  isAllowedLocalOrigin,
  isAllowedSenderOrigin,
  normalizeTimeoutMs,
  normalizeOpenAIBaseUrl,
  sanitizeSettings,
  trimTrailingSlash,
} from './validation';

describe('local model connector validation', () => {
  it('accepts loopback OpenAI-compatible /v1 base URLs', () => {
    expect(normalizeOpenAIBaseUrl('http://127.0.0.1:11434/v1/')).toBe('http://127.0.0.1:11434/v1');
    expect(assertAllowedLocalBaseUrl('http://localhost:1234/v1').origin).toBe('http://localhost:1234');
    expect(getOriginFromBaseUrl('http://127.0.0.1:11434/v1')).toBe('http://127.0.0.1:11434');
  });

  it('rejects non-local, private LAN, HTTPS, unsupported schemes, and missing /v1 URLs', () => {
    const rejected = [
      'https://127.0.0.1:11434/v1',
      'http://192.168.1.20:11434/v1',
      'http://10.0.0.2:11434/v1',
      'http://172.16.0.3:11434/v1',
      'http://example.com:11434/v1',
      'file:///tmp/model/v1',
      'chrome://extensions',
      'http://127.0.0.1:11434/api',
      'http://127.0.0.1/v1',
      '',
      'not a url',
    ];

    for (const value of rejected) {
      expect(() => assertAllowedLocalBaseUrl(value), value).toThrow();
    }
  });

  it('validates local origins and derives Chrome host-permission patterns without preserving ports', () => {
    expect(isAllowedLocalOrigin('http://127.0.0.1:11434')).toBe(true);
    expect(isAllowedLocalOrigin('http://localhost:1234')).toBe(true);
    expect(isAllowedLocalOrigin('http://127.0.0.1')).toBe(false);
    expect(isAllowedLocalOrigin('https://localhost:1234')).toBe(false);
    expect(isAllowedLocalOrigin('http://192.168.1.2:1234')).toBe(false);
    expect(isAllowedLocalOrigin('not a url')).toBe(false);
    expect(hostPermissionPatternForOrigin('http://127.0.0.1:11434')).toBe('http://127.0.0.1/*');
    expect(hostPermissionPatternForOrigin('http://localhost:1234')).toBe('http://localhost/*');
    expect(() => assertAllowedLocalOrigin('http://localhost')).toThrow();
  });

  it('matches sender origins against configured PWA match patterns', () => {
    const patterns = [
      'https://app.example.com/*',
      'https://app-dev.example.com/*',
      'http://localhost/*',
    ];

    expect(isAllowedSenderOrigin('https://app.example.com', patterns)).toBe(true);
    expect(isAllowedSenderOrigin('https://app-dev.example.com', patterns)).toBe(true);
    expect(isAllowedSenderOrigin('http://localhost:5174', patterns)).toBe(true);
    expect(isAllowedSenderOrigin('https://evil.example.com', patterns)).toBe(false);
    expect(isAllowedSenderOrigin('http://127.0.0.1:5174', patterns)).toBe(false);
    expect(isAllowedSenderOrigin('not-a-url', patterns)).toBe(false);
    expect(isAllowedSenderOrigin('https://team.example.com', ['*://*.example.com/*'])).toBe(true);
    expect(isAllowedSenderOrigin('http://team.example.com', ['https://*.example.com/*'])).toBe(false);
    expect(isAllowedSenderOrigin('http://anything.test', ['*://*/*'])).toBe(true);
    expect(isAllowedSenderOrigin('https://app.example.com', ['not-a-pattern'])).toBe(false);
  });

  it('trims trailing slashes without changing the root slash', () => {
    expect(trimTrailingSlash('http://localhost:1234/v1///')).toBe('http://localhost:1234/v1');
    expect(trimTrailingSlash('/')).toBe('/');
  });

  it('validates allowed paths, payload sizes, and timeout bounds', () => {
    expect(() => assertAllowedOpenAIPath('/v1/models')).not.toThrow();
    expect(() => assertAllowedOpenAIPath('/v1/files')).toThrow();
    expect(() => assertPayloadSize({ value: 'ok' }, 20)).not.toThrow();
    expect(() => assertPayloadSize({ value: 'too-large' }, 5)).toThrow();
    expect(normalizeTimeoutMs()).toBe(60_000);
    expect(normalizeTimeoutMs(250_000)).toBe(120_000);
    expect(() => normalizeTimeoutMs(0)).toThrow();
  });

  it('validates chat bodies and endpoint settings', () => {
    expect(assertChatCompletionBody({
      model: ' llama ',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
      temperature: 0.2,
      max_tokens: 32,
      stream: true,
    })).toEqual({
      model: 'llama',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
      temperature: 0.2,
      max_tokens: 32,
      stream: true,
    });
    for (const body of [
      null,
      { model: '', messages: [{ role: 'user', content: 'hello' }] },
      { model: 'llama', messages: [] },
      { model: 'llama', messages: [{ role: 'bad', content: 'hello' }] },
      { model: 'llama', messages: [{ role: 'user', content: 123 }] },
      { model: 'llama', messages: [{ role: 'user', content: 'hello' }], temperature: Number.NaN },
      { model: 'llama', messages: [{ role: 'user', content: 'hello' }], max_tokens: -1 },
    ]) {
      expect(() => assertChatCompletionBody(body), JSON.stringify(body)).toThrow();
    }

    expect(sanitizeSettings({
      providerId: 'lm-studio',
      baseUrl: 'http://127.0.0.1:1234/v1/',
      selectedModel: 'llama',
      persistApiKey: true,
      apiKey: 'secret',
    })).toEqual({
      providerId: 'lm-studio',
      baseUrl: 'http://127.0.0.1:1234/v1',
      selectedModel: 'llama',
      persistApiKey: true,
      apiKey: 'secret',
    });
    expect(sanitizeSettings({ persistApiKey: false })).toEqual({ persistApiKey: false });
    expect(() => sanitizeSettings(null)).toThrow();
  });
});
