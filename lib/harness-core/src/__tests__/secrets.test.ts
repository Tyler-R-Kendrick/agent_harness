import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SECRET_MANAGEMENT_SETTINGS,
  MemorySecretStore,
  containsSecretRef,
  createSecretsManagerAgent,
  getDefaultSecretsManagerAgent,
  isSecretManagementSettings,
  isSecretRef,
  normalizeSecretManagementSettings,
  resetDefaultSecretsManagerAgentForTests,
  secretRefForId,
  wrapToolsForSecretResolution,
} from '../index.js';

describe('core secrets manager', () => {
  afterEach(() => {
    resetDefaultSecretsManagerAgentForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('detects refs and stores, lists, and deletes records in memory', async () => {
    const store = new MemorySecretStore();
    const record = {
      id: 'local-secret',
      value: 'stored-secret-value',
      label: 'manual',
      source: 'manual' as const,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    };

    expect(isSecretRef(secretRefForId('local-secret'))).toBe(true);
    expect(containsSecretRef(`x ${secretRefForId('local-secret')}`)).toBe(true);
    expect(secretRefForId('!!!')).toBe('secret-ref://local/secret');
    await store.set(record);
    await expect(store.get('local-secret')).resolves.toEqual(record);
    await expect(store.list()).resolves.toEqual([record]);
    await store.delete('local-secret');
    await expect(store.get('local-secret')).resolves.toBeUndefined();
  });

  it('sanitizes sensitive object fields and preserves existing refs', async () => {
    const store = new MemorySecretStore();
    let nextId = 0;
    const secrets = createSecretsManagerAgent({
      store,
      idFactory: ({ label }) => `${label}-${++nextId}`,
      now: () => '2026-05-01T00:00:00.000Z',
    });

    const result = await secrets.sanitizeData({
      headers: {
        Authorization: 'Bearer sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890',
      },
      body: {
        apiKey: 'sk-abcdefghijklmnopqrstuvwxyz1234567890',
        password: '',
        authorization: 'Bearer secret-ref://local/existing',
        nested: ['client_secret="plain-secret-value"', 7, null],
      },
    });

    expect(result.value).toEqual({
      headers: {
        Authorization: 'Bearer secret-ref://local/authorization-1',
      },
      body: {
        apiKey: 'secret-ref://local/apikey-2',
        password: '',
        authorization: 'Bearer secret-ref://local/existing',
        nested: ['client_secret="secret-ref://local/client-secret-3"', 7, null],
      },
    });
    await expect(secrets.resolveSecretRefs([
      result.value,
      'secret-ref://local/missing-ref',
      3,
      null,
    ])).resolves.toEqual([
      {
        headers: {
          Authorization: 'Bearer sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890',
        },
        body: {
          apiKey: 'sk-abcdefghijklmnopqrstuvwxyz1234567890',
          password: '',
          authorization: 'Bearer secret-ref://local/existing',
          nested: ['client_secret="plain-secret-value"', 7, null],
        },
      },
      'secret-ref://local/missing-ref',
      3,
      null,
    ]);
  });

  it('replaces stored manual secrets across chat and model-shaped messages', async () => {
    const store = new MemorySecretStore();
    await store.set({
      id: 'manual-1',
      value: 'manually-stored-secret',
      label: 'manual',
      source: 'manual',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    });
    const secrets = createSecretsManagerAgent({ store });

    const chatMessages = await secrets.sanitizeChatMessages([{
      id: 'message-1',
      role: 'user',
      content: 'Use manually-stored-secret in the request.',
      streamedContent: 'The result contained manually-stored-secret.',
    }]);
    const modelMessages = await secrets.sanitizeModelMessages([{
      role: 'user',
      content: [{ type: 'text', text: 'Authorization: Bearer manually-stored-secret' }],
    }]);

    expect(chatMessages[0]?.content).toBe('Use secret-ref://local/manual-1 in the request.');
    expect(chatMessages[0]?.streamedContent).toBe('The result contained secret-ref://local/manual-1.');
    expect(JSON.stringify(modelMessages)).not.toContain('manually-stored-secret');
    expect(JSON.stringify(modelMessages)).toContain('secret-ref://local/manual-1');
  });

  it('matches known secret patterns, generic assignments, and already-safe refs', async () => {
    const store = new MemorySecretStore();
    let nextId = 0;
    const secrets = createSecretsManagerAgent({
      store,
      idFactory: ({ label }) => `${label}-${++nextId}`,
      now: () => '2026-05-01T00:00:00.000Z',
    });
    const jwt = 'eyJaaaaaaaaaaaa.bbbbbbbbbbbb.cccccccccccc';

    const result = await secrets.sanitizeText([
      'Authorization: Basic abcdefghijklmnop',
      'Authorization: Bearer secret-ref://local/header-safe',
      'github_pat_abcdefghijklmnopqrstuvwxyz123456',
      'xoxb-1234567890-token',
      'AKIA1234567890ABCDEF',
      jwt,
      'OPENAI=sk-abcdefghijklmnopqrstuvwxyz123456789012',
      'password:secret-ref://local/already-safe',
    ].join('\n'));

    expect(result.text).not.toContain('abcdefghijklmnop');
    expect(result.text).not.toContain('github_pat_abcdefghijklmnopqrstuvwxyz123456');
    expect(result.text).not.toContain('xoxb-1234567890-token');
    expect(result.text).not.toContain('AKIA1234567890ABCDEF');
    expect(result.text).not.toContain(jwt);
    expect(result.text).toContain('Authorization: Bearer secret-ref://local/header-safe');
    expect(result.text).toContain('password:secret-ref://local/already-safe');
    await expect(store.list()).resolves.toHaveLength(6);
  });

  it('wraps tools, passes through non-executable definitions, and supports default managers', async () => {
    const store = new MemorySecretStore();
    await store.set({
      id: 'api-token',
      value: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890',
      label: 'manual',
      source: 'manual',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    });
    const secrets = createSecretsManagerAgent({ store });
    const execute = vi.fn(async (args: unknown) => ({
      observedAuthorization: (args as { headers: { Authorization: string } }).headers.Authorization,
      echoedSecret: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890',
    }));
    const passthrough = { description: 'no execute' };
    const tools = wrapToolsForSecretResolution({
      request: { execute },
      passthrough,
    }, secrets) as {
      request: { execute: (args: unknown) => Promise<unknown> };
      passthrough: typeof passthrough;
    };

    await expect(tools.request.execute({
      headers: { Authorization: 'Bearer secret-ref://local/api-token' },
    })).resolves.toEqual({
      observedAuthorization: 'Bearer secret-ref://local/api-token',
      echoedSecret: 'secret-ref://local/api-token',
    });
    expect(execute).toHaveBeenCalledWith({
      headers: { Authorization: 'Bearer sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890' },
    }, undefined);
    expect(tools.passthrough).toBe(passthrough);
    expect(getDefaultSecretsManagerAgent()).toBe(getDefaultSecretsManagerAgent());
  });

  it('uses default ids from crypto and falls back when randomUUID is unavailable', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' });
    const cryptoBacked = createSecretsManagerAgent({
      store: new MemorySecretStore(),
      now: () => '2026-05-01T00:00:00.000Z',
    });
    await expect(cryptoBacked.sanitizeData({ token: 'sensitive-value' })).resolves.toEqual({
      value: { token: 'secret-ref://local/token-uuid-1' },
      refs: ['secret-ref://local/token-uuid-1'],
    });

    vi.stubGlobal('crypto', {});
    vi.spyOn(Date, 'now').mockReturnValue(1_776_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const fallback = createSecretsManagerAgent({
      store: new MemorySecretStore(),
      now: () => '2026-05-01T00:00:00.000Z',
    });

    await expect(fallback.sanitizeData({ clientSecret: 'fallback-secret-value' })).resolves.toEqual({
      value: { clientSecret: 'secret-ref://local/clientsecret-mnvsjmdc-i' },
      refs: ['secret-ref://local/clientsecret-mnvsjmdc-i'],
    });
  });

  it('uses the default clock when no now function is supplied', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-clock' });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T12:34:56.000Z'));
    const store = new MemorySecretStore();
    const secrets = createSecretsManagerAgent({ store });

    await secrets.sanitizeData({ token: 'clock-secret-value' });

    await expect(store.get('token-uuid-clock')).resolves.toEqual(expect.objectContaining({
      createdAt: '2026-05-01T12:34:56.000Z',
      updatedAt: '2026-05-01T12:34:56.000Z',
    }));
    vi.useRealTimers();
  });

  it('handles stores without list support and empty text without replacement scans', async () => {
    const store = {
      get: vi.fn(async () => undefined),
      set: vi.fn(async () => undefined),
    };
    const secrets = createSecretsManagerAgent({ store });

    await expect(secrets.sanitizeText('')).resolves.toEqual({ text: '', refs: [] });
    await expect(secrets.sanitizeText('no secrets here')).resolves.toEqual({ text: 'no secrets here', refs: [] });
    await expect(secrets.sanitizeData({ token: 'disabled-secret' }, { enabled: false })).resolves.toEqual({
      value: { token: 'disabled-secret' },
      refs: [],
    });
    await expect(secrets.listSecrets()).resolves.toEqual([]);
    await expect(secrets.deleteSecret('secret-ref://local/missing')).resolves.toBeUndefined();
  });

  it('stores manual name/secret pairs as refs and updates existing records', async () => {
    const secrets = createSecretsManagerAgent({
      store: new MemorySecretStore(),
      now: () => '2026-05-01T00:00:00.000Z',
    });

    await expect(secrets.storeSecret({
      name: 'OPENWEATHER_API_KEY',
      value: 'weather-key-value-1234567890',
    })).resolves.toBe('secret-ref://local/openweather-api-key');
    await expect(secrets.storeSecret({
      name: '   ',
      value: 'blank-name-secret-value',
    })).resolves.toBe('secret-ref://local/secret');
    await expect(secrets.storeSecret({
      name: 'OPENWEATHER_API_KEY',
      value: 'weather-key-value-0987654321',
    })).resolves.toBe('secret-ref://local/openweather-api-key');

    await expect(secrets.listSecrets()).resolves.toEqual([expect.objectContaining({
      id: 'openweather-api-key',
      label: 'OPENWEATHER_API_KEY',
      value: 'weather-key-value-0987654321',
      source: 'manual',
    }), expect.objectContaining({
      id: 'secret',
      label: 'Secret',
      value: 'blank-name-secret-value',
      source: 'manual',
    })]);
    await expect(secrets.renderResponseToUser('Stored secret-ref://local/secret')).resolves.toBe('Stored blank-name-secret-value');

    await expect(secrets.deleteSecret('openweather-api-key')).resolves.toBeUndefined();
    await expect(secrets.deleteSecret('secret-ref://local/secret')).resolves.toBeUndefined();
    await expect(secrets.listSecrets()).resolves.toEqual([]);
  });

  it('redacts provider, transport, credential, and high-entropy fallback formats', async () => {
    const store = new MemorySecretStore();
    let nextId = 0;
    const secrets = createSecretsManagerAgent({
      store,
      idFactory: ({ label }) => `${label}-${++nextId}`,
      now: () => '2026-05-01T00:00:00.000Z',
    });
    const stripeLikeSecret = ['sk', 'live', '1234567890abcdefghijklmnopqrstuv'].join('_');
    const highEntropySecret = 'n9vK8xQp2LmR7sT4yZ0aBcDeFgHiJk';
    const samples = [
      `STRIPE_SECRET_KEY=${stripeLikeSecret}`,
      'GOOGLE_API_KEY=AIzaSyA1234567890abcdefghijklmnopqrst',
      'SENDGRID_API_KEY=SG.12345678901234567890.abcdefghijklmnopqrstuvwxyz',
      'RESEND_API_KEY=re_1234567890abcdefghijklmnopqrstuv',
      'HUGGING_FACE_TOKEN=hf_1234567890abcdefghijklmnopqrstuv',
      'LINEAR_API_KEY=lin_api_1234567890abcdefghijklmnopqrstuv',
      'VERCEL_TOKEN=vercel_1234567890abcdefghijklmnopqrstuv',
      'aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      'postgres://app_user:db-password-1234@db.example.com:5432/app',
      'https://service-user:service-password-1234@api.example.com/v1',
      '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCfakeprivatekeymaterial1234567890\n-----END PRIVATE KEY-----',
      `The integration token is ${highEntropySecret}.`,
      'The bearer token is p9vK8xQp2LmR7sT4yZ0aBcDeFgHiJk',
      'The fallback token is aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.',
      'The fallback token is 018f7b7a-6c2d-4a99-a111-abcdefabcdef.',
      'The fallback token is zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz.',
      'Keep request id 018f7b7a-6c2d-7a99-a111-abcdefabcdef visible.',
    ];

    const result = await secrets.sanitizeText(samples.join('\n'));

    expect(result.text).not.toContain(stripeLikeSecret);
    expect(result.text).not.toContain(highEntropySecret);
    expect(result.text).not.toContain('p9vK8xQp2LmR7sT4yZ0aBcDeFgHiJk');
    expect(result.text).toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(result.text).toContain('018f7b7a-6c2d-4a99-a111-abcdefabcdef.');
    expect(result.text).toContain('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz.');
    expect(result.text).toContain('018f7b7a-6c2d-7a99-a111-abcdefabcdef');
    expect(result.refs.every(isSecretRef)).toBe(true);
    await expect(store.list()).resolves.toHaveLength(13);
  });

  it('honors sanitization settings and validates persisted settings shape', async () => {
    const store = new MemorySecretStore();
    const secrets = createSecretsManagerAgent({
      store,
      idFactory: ({ label }) => label,
      now: () => '2026-05-01T00:00:00.000Z',
    });
    await secrets.storeSecret({ name: 'MANUAL_SECRET', value: 'manual-secret-value' });
    const text = 'manual-secret-value ghp_abcdefghijklmnopqrstuvwxyz123456 token is q1W2e3R4t5Y6u7I8o9P0a1S2d3F4g5H6';

    await expect(secrets.sanitizeText(text, { enabled: false })).resolves.toEqual({ text, refs: [] });
    await expect(secrets.sanitizeText(text, {
      enabled: true,
      replaceStoredSecrets: false,
      detectKnownSecrets: false,
      detectGenericSecrets: false,
      detectHighEntropySecrets: false,
    })).resolves.toEqual({ text, refs: [] });

    const storedOnly = await secrets.sanitizeText(text, {
      enabled: true,
      replaceStoredSecrets: true,
      detectKnownSecrets: false,
      detectGenericSecrets: false,
      detectHighEntropySecrets: false,
    });

    expect(storedOnly.text).toContain('secret-ref://local/manual-secret');
    expect(storedOnly.text).toContain('ghp_abcdefghijklmnopqrstuvwxyz123456');
    expect(isSecretManagementSettings(null)).toBe(false);
    expect(isSecretManagementSettings({
      ...DEFAULT_SECRET_MANAGEMENT_SETTINGS,
      detectKnownSecrets: 'yes',
    })).toBe(false);
    expect(isSecretManagementSettings(DEFAULT_SECRET_MANAGEMENT_SETTINGS)).toBe(true);
    expect(normalizeSecretManagementSettings({
      detectHighEntropySecrets: false,
    })).toEqual({
      ...DEFAULT_SECRET_MANAGEMENT_SETTINGS,
      detectHighEntropySecrets: false,
    });
    await expect(secrets.prepareMessagesForInference([{ content: text }], { enabled: false })).resolves.toEqual({
      messages: [{ content: text }],
      refs: [],
    });
  });
});
