import { afterEach, describe, expect, it, vi } from 'vitest';
import { __testOnlySandboxFetchPolicy, SandboxFetchPolicy } from '../network';

describe('SandboxFetchPolicy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('denies fetch by default', async () => {
    const policy = new SandboxFetchPolicy();

    await expect(policy.fetch('https://api.example.test/data')).rejects.toThrow(/disabled/i);
    await expect(new SandboxFetchPolicy({ enabled: true }).fetch(new URL('https://api.example.test/data'))).rejects.toThrow(/URL strings/i);
  });

  it('requires https or explicit localhost http access', async () => {
    const policy = new SandboxFetchPolicy({ enabled: true });

    await expect(policy.fetch('http://example.test/data')).rejects.toThrow(/HTTPS/i);
    await expect(policy.fetch('http://localhost:5174/data')).rejects.toThrow(/localhost/i);
    await expect(policy.fetch('file:///tmp/data')).rejects.toThrow(/HTTP\(S\)/i);

    const localhostPolicy = new SandboxFetchPolicy({
      enabled: true,
      allowLocalhostHttp: true,
      fetchImplementation: async () => new Response('local'),
    });
    await expect(localhostPolicy.fetch('http://localhost:5174/data')).resolves.toMatchObject({
      bodyText: 'local',
    });
  });

  it('blocks private, loopback, metadata, and wildcard-dns internal hosts before fetch', async () => {
    const fetchImplementation = vi.fn(async () => new Response('ok'));
    const policy = new SandboxFetchPolicy({
      enabled: true,
      fetchImplementation,
    });

    await expect(policy.fetch('https://169.254.169.254/latest/meta-data')).rejects.toThrow(/public web host/i);
    await expect(policy.fetch('https://10.0.0.8/private')).rejects.toThrow(/public web host/i);
    await expect(policy.fetch('https://[::1]/private')).rejects.toThrow(/public web host/i);
    await expect(policy.fetch('https://127.0.0.1.nip.io/private')).rejects.toThrow(/public web host/i);
    await expect(policy.fetch('https://localhost./private')).rejects.toThrow(/public web host/i);
    await expect(policy.fetch('https://8.8.8.8.nip.io/public')).resolves.toMatchObject({
      bodyText: 'ok',
    });

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(fetchImplementation).toHaveBeenCalledWith('https://8.8.8.8.nip.io/public', expect.any(Object));
  });

  it('blocks additional reserved network ranges and preserves public ipv6 access', async () => {
    const fetchImplementation = vi.fn(async () => new Response('ok'));
    const policy = new SandboxFetchPolicy({
      enabled: true,
      fetchImplementation,
    });

    const blockedUrls = [
      'https://0.1.2.3/bootstrap',
      'https://100.64.0.8/shared-address-space',
      'https://172.16.4.20/private',
      'https://192.168.1.5/private',
      'https://198.18.0.1/benchmark',
      'https://198.19.0.1/benchmark',
      'https://[fe80::1]/link-local',
      'https://[fc00::1]/unique-local',
      'https://[::ffff:10.0.0.8]/mapped-private',
      'https://[64:ff9b::0a00:0008]/nat64-private',
      'https://[2002:0a00:0008::1]/6to4-private',
      'https://localhost.nip.io/private',
      'https://app.localhost.nip.io/private',
    ];

    for (const url of blockedUrls) {
      await expect(policy.fetch(url)).rejects.toThrow(/public web host/i);
    }

    await expect(policy.fetch('https://[2001:4860:4860::8888]/dns-query')).resolves.toMatchObject({
      bodyText: 'ok',
    });

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(fetchImplementation).toHaveBeenCalledWith('https://[2001:4860:4860::8888]/dns-query', expect.any(Object));
  });

  it('covers ipv6 parser and hostname helper edge cases', () => {
    expect(__testOnlySandboxFetchPolicy.normalizeHostname('[LOCALHOST.]')).toBe('localhost');
    expect(__testOnlySandboxFetchPolicy.isLocalhost('[::1]')).toBe(true);
    expect(__testOnlySandboxFetchPolicy.isPrivateIpv4Hostname('203.0.113.10')).toBe(false);

    expect(__testOnlySandboxFetchPolicy.parseIpv6Segments('2001:0db8:0000:0001:0002:0003:0004:0005')).toEqual([
      0x2001, 0x0db8, 0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005,
    ]);
    expect(__testOnlySandboxFetchPolicy.parseIpv6Segments('2001:db8:0:1:2:3:4')).toBeNull();
    expect(__testOnlySandboxFetchPolicy.parseIpv6Segments('1:2:3:4:5:6:7::8:9')).toBeNull();
    expect(__testOnlySandboxFetchPolicy.parseIpv6Segments('2001::db8::1')).toBeNull();
    expect(__testOnlySandboxFetchPolicy.parseIpv6Segments('gggg::1')).toBeNull();

    expect(__testOnlySandboxFetchPolicy.extractEmbeddedIpv4SegmentsFromIpv6('not-ipv6')).toBeNull();
    expect(__testOnlySandboxFetchPolicy.extractEmbeddedIpv4SegmentsFromIpv6('::0a00:0008')).toEqual([10, 0, 0, 8]);
    expect(__testOnlySandboxFetchPolicy.extractEmbeddedIpv4SegmentsFromIpv6('2001:4860:4860::8888')).toBeNull();

    expect(__testOnlySandboxFetchPolicy.isPrivateIpv6Hostname('2001:4860:4860::8888')).toBe(false);
    expect(__testOnlySandboxFetchPolicy.isLoopbackDnsHostname('public.example.test')).toBe(false);
    expect(__testOnlySandboxFetchPolicy.isPublicWebHostname('localhost')).toBe(false);
    expect(__testOnlySandboxFetchPolicy.isPublicWebHostname('8.8.8.8.nip.io')).toBe(true);
  });

  it('allows only configured origins and strips credential-bearing request state', async () => {
    const fetchImplementation = vi.fn(async () => new Response('ok', {
      status: 200,
      headers: { 'content-type': 'text/plain', 'x-safe': 'yes' },
    }));
    const policy = new SandboxFetchPolicy({
      enabled: true,
      allowedOrigins: ['https://api.example.test'],
      fetchImplementation,
    });

    await expect(policy.fetch('https://blocked.example.test/data')).rejects.toThrow(/not allowed/i);
    const response = await policy.fetch('https://api.example.test/data', {
      method: 'POST',
      headers: {
        Accept: 'text/plain',
        Authorization: 'Bearer secret',
        Cookie: 'session=secret',
      },
      body: 'payload',
      credentials: 'include',
    });

    expect(fetchImplementation).toHaveBeenCalledWith('https://api.example.test/data', expect.objectContaining({
      credentials: 'omit',
      redirect: 'manual',
      method: 'POST',
      body: 'payload',
      headers: { accept: 'text/plain' },
    }));
    expect(response.bodyText).toBe('ok');
    expect(response.headers).toEqual({ 'content-type': 'text/plain', 'x-safe': 'yes' });
  });

  it('strips mixed-case token and Sec-prefixed request headers before fetch', async () => {
    const requests: RequestInit[] = [];
    const policy = new SandboxFetchPolicy({
      enabled: true,
      allowedOrigins: ['https://api.example.test'],
      fetchImplementation: async (_input, init) => {
        requests.push(init ?? {});
        return new Response('ok');
      },
    });

    await expect(policy.fetch('https://api.example.test/data', {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Proxy-Authorization': 'Basic c2VjcmV0',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-GPC': '1',
        'X-Api-Key': 'secret-key',
        'x-auth-token': 'secret-token',
      },
    })).resolves.toMatchObject({ bodyText: 'ok' });

    expect(requests).toEqual([
      expect.objectContaining({
        credentials: 'omit',
        headers: { accept: 'application/json' },
        redirect: 'manual',
      }),
    ]);
  });

  it('supports wildcard origins, array headers, Headers objects, and method allowlists', async () => {
    const calls: unknown[] = [];
    const policy = new SandboxFetchPolicy({
      enabled: true,
      allowedOrigins: ['https://*.example.test'],
      allowedMethods: ['GET'],
      fetchImplementation: async (_input, init) => {
        calls.push(init?.headers);
        return new Response('', { headers: { 'set-cookie': 'blocked', 'x-public': 'ok' } });
      },
    });

    await expect(policy.fetch('https://api.example.test/data', {
      headers: [['Accept', 'text/plain'], ['Sec-Fetch-Mode', 'cors']],
    })).resolves.toMatchObject({
      headers: { 'x-public': 'ok' },
    });
    await expect(policy.fetch('https://api.example.test/no-init', null)).resolves.toMatchObject({
      status: 200,
    });
    await expect(policy.fetch('https://api.example.test/odd-headers', {
      headers: [['Accept'], ['X-Number', 7], 'ignored'] as unknown as HeadersInit,
    })).resolves.toMatchObject({
      status: 200,
    });
    await expect(policy.fetch('https://example.test/data', {
      headers: { Accept: 'application/json', Ignored: 42 } as unknown as HeadersInit,
    })).resolves.toMatchObject({
      status: 200,
    });
    await expect(policy.fetch('https://api.example.test/null-headers', {
      headers: null as unknown as HeadersInit,
    })).resolves.toMatchObject({
      status: 200,
    });
    await expect(policy.fetch('https://api.example.test/string-headers', {
      headers: 'ignored' as unknown as HeadersInit,
    })).resolves.toMatchObject({
      status: 200,
    });
    await expect(policy.fetch('https://api.example.test/headers-object', {
      headers: new Headers({ Accept: 'text/html' }),
    })).resolves.toMatchObject({
      status: 200,
    });
    await expect(policy.fetch('https://api.example.test/data', { method: 'DELETE' })).rejects.toThrow(/method/i);
    expect(calls).toEqual([
      { accept: 'text/plain' },
      {},
      { 'x-number': '7' },
      { accept: 'application/json' },
      {},
      {},
      { accept: 'text/html' },
    ]);
  });

  it('enforces request and response byte limits', async () => {
    const policy = new SandboxFetchPolicy({
      enabled: true,
      allowedOrigins: ['https://api.example.test'],
      maxRequestBytes: 4,
      maxResponseBytes: 5,
      fetchImplementation: async () => new Response('1234567890'),
    });

    await expect(policy.fetch('https://api.example.test/data', { method: 'POST', body: 'too-large' })).rejects.toThrow(/request body/i);
    await expect(policy.fetch('https://api.example.test/data')).resolves.toMatchObject({
      bodyText: '12345',
      truncated: true,
    });

    const binaryBodyPolicy = new SandboxFetchPolicy({
      enabled: true,
      allowedOrigins: ['https://api.example.test'],
      fetchImplementation: async (_input, init) => {
        expect(init?.body).toBeInstanceOf(Uint8Array);
        return new Response('ok');
      },
    });
    await expect(binaryBodyPolicy.fetch('https://api.example.test/data', {
      method: 'POST',
      body: new Uint8Array([1, 2, 3]),
    })).resolves.toMatchObject({ bodyText: 'ok' });

    const blobPolicy = new SandboxFetchPolicy({
      enabled: true,
      fetchImplementation: async () => new Response('blob ok'),
    });
    await expect(blobPolicy.fetch('https://api.example.test/data', {
      method: 'POST',
      body: new Blob(['blob-body']),
    })).resolves.toMatchObject({ bodyText: 'blob ok' });

    const paramsPolicy = new SandboxFetchPolicy({
      enabled: true,
      fetchImplementation: async () => new Response('params ok'),
    });
    await expect(paramsPolicy.fetch('https://api.example.test/data', {
      method: 'POST',
      body: new URLSearchParams([['q', 'ok']]),
    })).resolves.toMatchObject({ bodyText: 'params ok' });
  });

  it('enforces content-length, unsupported body, unavailable fetch, and fetch timeout policies', async () => {
    vi.stubGlobal('fetch', undefined);
    const unavailablePolicy = new SandboxFetchPolicy({ enabled: true });
    await expect(unavailablePolicy.fetch('https://api.example.test/data')).rejects.toThrow(/unavailable/i);

    const contentLengthPolicy = new SandboxFetchPolicy({
      enabled: true,
      maxResponseBytes: 3,
      fetchImplementation: async () => new Response('abcdef', {
        headers: { 'content-length': '6' },
      }),
    });
    await expect(contentLengthPolicy.fetch('https://api.example.test/data')).resolves.toMatchObject({
      bodyText: 'abc',
      truncated: true,
    });

    const bodyPolicy = new SandboxFetchPolicy({
      enabled: true,
      fetchImplementation: async () => new Response('ok'),
    });
    await expect(bodyPolicy.fetch('https://api.example.test/data', { body: { unsupported: true } })).rejects.toThrow(/body type/i);

    const timeoutPolicy = new SandboxFetchPolicy({
      enabled: true,
      timeoutMs: 1,
      fetchImplementation: async (_input, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error(String(init.signal?.reason))));
      }),
    });
    await expect(timeoutPolicy.fetch('https://api.example.test/data')).rejects.toThrow(/timed out/i);
  });
});
