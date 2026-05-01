import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SECRET_MANAGEMENT_SETTINGS,
  IndexedDbSecretStore,
  MemorySecretStore,
  containsSecretRef,
  createDefaultSecretStore,
  createSecretsManagerAgent,
  getDefaultSecretsManagerAgent,
  isSecretManagementSettings,
  isSecretRef,
  normalizeSecretManagementSettings,
  resetDefaultSecretsManagerAgentForTests,
  secretRefForId,
  wrapToolsForSecretResolution,
} from '.';

describe('Secrets manager agent', () => {
  afterEach(() => {
    resetDefaultSecretsManagerAgentForTests();
    vi.doUnmock('idb-keyval');
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('strips known secret patterns from text and stores refs locally', async () => {
    const store = new MemorySecretStore();
    const agent = createSecretsManagerAgent({
      store,
      idFactory: () => 'secret-1',
      now: () => '2026-04-30T00:00:00.000Z',
    });
    const secret = 'ghp_abcdefghijklmnopqrstuvwxyz123456';

    const result = await agent.sanitizeText(`Use GitHub token ${secret} for this call.`);

    expect(result.text).toBe('Use GitHub token secret-ref://local/secret-1 for this call.');
    expect(result.text).not.toContain(secret);
    expect(result.refs).toEqual(['secret-ref://local/secret-1']);
    expect(isSecretRef(result.refs[0]!)).toBe(true);
    await expect(agent.resolveSecretRefs(result.text)).resolves.toBe(`Use GitHub token ${secret} for this call.`);
    await expect(store.get('secret-1')).resolves.toMatchObject({
      id: 'secret-1',
      value: secret,
      label: 'github-token',
      source: 'detected',
    });
  });

  it('reliably detects secret refs and uses memory storage offline', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const store = createDefaultSecretStore();
    const ref = secretRefForId('local-secret');

    expect(store).toBeInstanceOf(MemorySecretStore);
    expect(containsSecretRef(ref)).toBe(true);
    expect(containsSecretRef(ref)).toBe(true);

    await store.set({
      id: 'local-secret',
      value: 'stored-secret-value',
      label: 'manual',
      source: 'manual',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    });
    await expect(store.list?.()).resolves.toHaveLength(1);
    await store.delete?.('local-secret');
    await expect(store.get('local-secret')).resolves.toBeUndefined();
  });

  it('sanitizes sensitive object fields while preserving header schemes', async () => {
    const store = new MemorySecretStore();
    let nextId = 0;
    const agent = createSecretsManagerAgent({
      store,
      idFactory: () => `secret-${++nextId}`,
      now: () => '2026-04-30T00:00:00.000Z',
    });

    const sanitized = await agent.sanitizeData({
      headers: {
        Authorization: 'Bearer sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890',
      },
      body: {
        apiKey: 'sk-abcdefghijklmnopqrstuvwxyz1234567890',
        prompt: 'no secrets here',
      },
    });

    expect(sanitized.value).toEqual({
      headers: {
        Authorization: 'Bearer secret-ref://local/secret-1',
      },
      body: {
        apiKey: 'secret-ref://local/secret-2',
        prompt: 'no secrets here',
      },
    });
    expect(JSON.stringify(sanitized.value)).not.toContain('sk-ant-api03');
    expect(JSON.stringify(sanitized.value)).not.toContain('sk-abcdefghijklmnopqrstuvwxyz');

    await expect(agent.resolveSecretRefs(sanitized.value)).resolves.toEqual({
      headers: {
        Authorization: 'Bearer sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890',
      },
      body: {
        apiKey: 'sk-abcdefghijklmnopqrstuvwxyz1234567890',
        prompt: 'no secrets here',
      },
    });
  });

  it('replaces stored manual secrets across chat and model messages', async () => {
    const store = new MemorySecretStore();
    await store.set({
      id: 'manual-1',
      value: 'manually-stored-secret',
      label: 'manual',
      source: 'manual',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    });
    const agent = createSecretsManagerAgent({ store });

    const chatMessages = await agent.sanitizeChatMessages([{
      id: 'message-1',
      role: 'user',
      content: 'Use manually-stored-secret in the request.',
      streamedContent: 'The result contained manually-stored-secret.',
    }]);

    expect(chatMessages[0]?.content).toBe('Use secret-ref://local/manual-1 in the request.');
    expect(chatMessages[0]?.streamedContent).toBe('The result contained secret-ref://local/manual-1.');

    const modelMessages = await agent.sanitizeModelMessages([{
      role: 'user',
      content: [{ type: 'text', text: 'Authorization: Bearer manually-stored-secret' }],
    }] as never);

    expect(JSON.stringify(modelMessages)).not.toContain('manually-stored-secret');
    expect(JSON.stringify(modelMessages)).toContain('secret-ref://local/manual-1');
  });

  it('substitutes refs only for tool execution and sanitizes tool results', async () => {
    const store = new MemorySecretStore();
    await store.set({
      id: 'api-token',
      value: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890',
      label: 'manual',
      source: 'manual',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    });
    const agent = createSecretsManagerAgent({ store });
    const execute = vi.fn(async (args: unknown) => ({
      observedAuthorization: (args as { headers: { Authorization: string } }).headers.Authorization,
      echoedSecret: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890',
    }));
    const passthrough = { description: 'no execute' };

    const tools = wrapToolsForSecretResolution({
      request: { execute },
      passthrough,
    } as never, agent) as {
      request: { execute: (args: unknown) => Promise<unknown> };
      passthrough: typeof passthrough;
    };

    const result = await tools.request.execute({
      headers: {
        Authorization: 'Bearer secret-ref://local/api-token',
      },
    });

    expect(execute).toHaveBeenCalledWith({
      headers: {
        Authorization: 'Bearer sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890',
      },
    }, undefined);
    expect(result).toEqual({
      observedAuthorization: 'Bearer secret-ref://local/api-token',
      echoedSecret: 'secret-ref://local/api-token',
    });
    expect(tools.passthrough).toBe(passthrough);
  });

  it('uses IndexedDB storage when browser storage is available', async () => {
    vi.resetModules();
    const records = new Map<string, unknown>();
    const createStore = vi.fn((databaseName: string, storeName: string) => ({ databaseName, storeName }));
    const get = vi.fn(async (id: string) => records.get(id));
    const set = vi.fn(async (id: string, record: unknown) => {
      records.set(id, record);
    });
    const del = vi.fn(async (id: string) => {
      records.delete(id);
    });
    const keys = vi.fn(async () => ['indexed-secret', 42]);

    vi.doMock('idb-keyval', () => ({
      createStore,
      del,
      get,
      keys,
      set,
    }));
    vi.stubGlobal('indexedDB', {});

    const module = await import('.');
    const store = module.createDefaultSecretStore();
    const record = {
      id: 'indexed-secret',
      value: 'stored-in-indexeddb',
      label: 'manual',
      source: 'manual' as const,
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    };

    expect(store).toBeInstanceOf(module.IndexedDbSecretStore);
    expect(createStore).toHaveBeenCalledWith('agent-browser-secrets', 'secrets');
    await store.set(record);
    await expect(store.get('indexed-secret')).resolves.toEqual(record);
    await expect(store.list?.()).resolves.toEqual([record]);
    await store.delete?.('indexed-secret');
    await expect(store.get('indexed-secret')).resolves.toBeUndefined();
    expect(set).toHaveBeenCalledWith('indexed-secret', record, { databaseName: 'agent-browser-secrets', storeName: 'secrets' });
    expect(del).toHaveBeenCalledWith('indexed-secret', { databaseName: 'agent-browser-secrets', storeName: 'secrets' });
  });

  it('covers default ids, refs, primitive traversal, and already-sanitized values', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' });
    const store = new MemorySecretStore();
    const agent = createSecretsManagerAgent({ store, now: () => '2026-04-30T00:00:00.000Z' });

    const sanitized = await agent.sanitizeData({
      token: 'sensitive-value',
      password: '',
      authorization: 'Bearer secret-ref://local/existing',
      nested: ['api_key="nested-secret-value"', 7, null],
    });

    expect(sanitized.value).toEqual({
      token: 'secret-ref://local/token-uuid-1',
      password: '',
      authorization: 'Bearer secret-ref://local/existing',
      nested: ['api_key="secret-ref://local/api-key-uuid-1"', 7, null],
    });
    await expect(agent.resolveSecretRefs([
      'secret-ref://local/token-uuid-1',
      { apiKey: 'secret-ref://local/missing-ref' },
      3,
      null,
    ])).resolves.toEqual([
      'sensitive-value',
      { apiKey: 'secret-ref://local/missing-ref' },
      3,
      null,
    ]);
    expect(getDefaultSecretsManagerAgent()).toBe(getDefaultSecretsManagerAgent());
  });

  it('falls back to time-based ids when crypto randomUUID is unavailable', async () => {
    vi.stubGlobal('crypto', {});
    vi.spyOn(Date, 'now').mockReturnValue(1_776_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const agent = createSecretsManagerAgent({
      store: new MemorySecretStore(),
      now: () => '2026-04-30T00:00:00.000Z',
    });

    const result = await agent.sanitizeData({ clientSecret: 'fallback-secret-value' });

    expect(result.value).toEqual({
      clientSecret: 'secret-ref://local/clientsecret-mnvsjmdc-i',
    });
  });

  it('matches additional known secret patterns and generic assignments', async () => {
    const store = new MemorySecretStore();
    let nextId = 0;
    const agent = createSecretsManagerAgent({
      store,
      idFactory: ({ label }) => `${label}-${++nextId}`,
      now: () => '2026-04-30T00:00:00.000Z',
    });

    const jwt = 'eyJaaaaaaaaaaaa.bbbbbbbbbbbb.cccccccccccc';
    const result = await agent.sanitizeText([
      'Authorization: Basic abcdefghijklmnop',
      'Authorization: Bearer secret-ref://local/header-safe',
      'github_pat_abcdefghijklmnopqrstuvwxyz123456',
      'xoxb-1234567890-token',
      'AKIA1234567890ABCDEF',
      jwt,
      'client_secret="plain-secret-value"',
      'password:secret-ref://local/already-safe',
    ].join('\n'));

    expect(result.text).not.toContain('abcdefghijklmnop');
    expect(result.text).not.toContain('github_pat_abcdefghijklmnopqrstuvwxyz123456');
    expect(result.text).not.toContain('xoxb-1234567890-token');
    expect(result.text).not.toContain('AKIA1234567890ABCDEF');
    expect(result.text).not.toContain(jwt);
    expect(result.text).not.toContain('plain-secret-value');
    expect(result.text).toContain('Authorization: Bearer secret-ref://local/header-safe');
    expect(result.text).toContain('password:secret-ref://local/already-safe');
    await expect(store.list()).resolves.toHaveLength(6);
  });

  it('can construct an IndexedDB store with an explicit namespace', () => {
    expect(new IndexedDbSecretStore('custom-secrets')).toBeInstanceOf(IndexedDbSecretStore);
    expect(secretRefForId('!!!')).toBe('secret-ref://local/secret');
  });

  it('stores manual name/secret pairs as refs and updates existing records without exposing values', async () => {
    const agent = createSecretsManagerAgent({
      store: new MemorySecretStore(),
      now: () => '2026-04-30T00:00:00.000Z',
    });

    await expect(agent.storeSecret({
      name: 'OPENWEATHER_API_KEY',
      value: 'weather-key-value-1234567890',
    })).resolves.toBe('secret-ref://local/openweather-api-key');
    await expect(agent.storeSecret({
      name: 'OPENWEATHER_API_KEY',
      value: 'weather-key-value-0987654321',
    })).resolves.toBe('secret-ref://local/openweather-api-key');

    await expect(agent.listSecrets()).resolves.toEqual([expect.objectContaining({
      id: 'openweather-api-key',
      label: 'OPENWEATHER_API_KEY',
      value: 'weather-key-value-0987654321',
      source: 'manual',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    })]);

    await expect(agent.deleteSecret('openweather-api-key')).resolves.toBeUndefined();
    await expect(agent.listSecrets()).resolves.toEqual([]);
  });

  it('redacts an inclusive set of meaningful provider, transport, and credential formats', async () => {
    const store = new MemorySecretStore();
    let nextId = 0;
    const agent = createSecretsManagerAgent({
      store,
      idFactory: ({ label }) => `${label}-${++nextId}`,
      now: () => '2026-04-30T00:00:00.000Z',
    });
    const stripeLikeSecret = ['sk', 'live', '1234567890abcdefghijklmnopqrstuv'].join('_');
    const samples = [
      `STRIPE_SECRET_KEY=${stripeLikeSecret}`,
      'SUPABASE_SERVICE_ROLE_KEY=eyJaaaaaaaaaaaa.bbbbbbbbbbbb.cccccccccccc',
      'GOOGLE_API_KEY=AIzaSyA1234567890abcdefghijklmnopqrst',
      'SENDGRID_API_KEY=SG.12345678901234567890.abcdefghijklmnopqrstuvwxyz',
      'RESEND_API_KEY=re_1234567890abcdefghijklmnopqrstuv',
      'HUGGING_FACE_TOKEN=hf_1234567890abcdefghijklmnopqrstuv',
      'LINEAR_API_KEY=lin_api_1234567890abcdefghijklmnopqrstuv',
      'VERCEL_TOKEN=vercel_1234567890abcdefghijklmnopqrstuv',
      'aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      'postgres://app_user:db-password-1234@db.example.com:5432/app',
      'mongodb+srv://mongo_user:mongo-password-1234@cluster.example.com/app',
      'mysql://mysql_user:mysql-password-1234@db.example.com:3306/app',
      'https://service-user:service-password-1234@api.example.com/v1',
      '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCfakeprivatekeymaterial1234567890\n-----END PRIVATE KEY-----',
    ];

    const result = await agent.sanitizeText(samples.join('\n'));

    for (const sample of samples) {
      const secretishPart = sample.includes('=')
        ? sample.split('=').slice(1).join('=').trim()
        : sample;
      expect(result.text).not.toContain(secretishPart);
    }
    expect(result.refs.length).toBe(samples.length);
    expect(result.refs.every(isSecretRef)).toBe(true);
    await expect(store.list()).resolves.toHaveLength(samples.length);
  });

  it('uses contextual high-entropy fallback detection without treating ordinary ids as secrets', async () => {
    const store = new MemorySecretStore();
    const agent = createSecretsManagerAgent({
      store,
      idFactory: () => 'contextual-secret',
      now: () => '2026-04-30T00:00:00.000Z',
    });
    const highEntropySecret = 'n9vK8xQp2LmR7sT4yZ0aBcDeFgHiJk';

    const result = await agent.sanitizeText([
      `The integration token is ${highEntropySecret}.`,
      'The fallback token is aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.',
      'Keep request id 018f7b7a-6c2d-7a99-a111-abcdefabcdef visible.',
      'Keep commit abcdef1234567890abcdef1234567890abcdef12 visible.',
    ].join('\n'));

    expect(result.text).toContain('secret-ref://local/contextual-secret');
    expect(result.text).not.toContain(highEntropySecret);
    expect(result.text).toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(result.text).toContain('018f7b7a-6c2d-7a99-a111-abcdefabcdef');
    expect(result.text).toContain('abcdef1234567890abcdef1234567890abcdef12');
    await expect(store.list()).resolves.toHaveLength(1);
  });

  it('validates and normalizes secret management settings', () => {
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
  });

  it('honors sanitization settings for known patterns, stored values, and entropy fallback', async () => {
    const store = new MemorySecretStore();
    const agent = createSecretsManagerAgent({
      store,
      idFactory: ({ label }) => label,
      now: () => '2026-04-30T00:00:00.000Z',
    });
    await agent.storeSecret({ name: 'MANUAL_SECRET', value: 'manual-secret-value' });
    const text = 'manual-secret-value ghp_abcdefghijklmnopqrstuvwxyz123456 token is q1W2e3R4t5Y6u7I8o9P0a1S2d3F4g5H6';

    await expect(agent.sanitizeText(text, {
      enabled: true,
      replaceStoredSecrets: false,
      detectKnownSecrets: false,
      detectGenericSecrets: false,
      detectHighEntropySecrets: false,
    })).resolves.toEqual({ text, refs: [] });

    const storedOnly = await agent.sanitizeText(text, {
      enabled: true,
      replaceStoredSecrets: true,
      detectKnownSecrets: false,
      detectGenericSecrets: false,
      detectHighEntropySecrets: false,
    });

    expect(storedOnly.text).toContain('secret-ref://local/manual-secret');
    expect(storedOnly.text).toContain('ghp_abcdefghijklmnopqrstuvwxyz123456');
    expect(storedOnly.text).toContain('q1W2e3R4t5Y6u7I8o9P0a1S2d3F4g5H6');
  });
});
