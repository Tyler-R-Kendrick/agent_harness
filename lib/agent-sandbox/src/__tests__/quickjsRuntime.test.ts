import { describe, expect, it } from 'vitest';
import { QuickJsJavaScriptExecutor } from '../quickjsRuntime';

describe('QuickJsJavaScriptExecutor', () => {
  it('returns exit code 1 and captured errors for thrown JavaScript values', async () => {
    const executor = new QuickJsJavaScriptExecutor();

    await expect(executor.execute('throw "plain failure"', {
      filename: '/throw.js',
      timeoutMs: 1000,
      allowNetwork: false,
    })).resolves.toMatchObject({
      exitCode: 1,
      output: '[error] plain failure',
    });
  });

  it('formats undefined console values and Error objects from the VM', async () => {
    const executor = new QuickJsJavaScriptExecutor();

    await expect(executor.execute('console.log(undefined); throw new Error("object failure")', {
      filename: '/error.js',
      timeoutMs: 1000,
      allowNetwork: false,
    })).resolves.toMatchObject({
      exitCode: 1,
      output: 'undefined\n[error] Error: object failure',
    });
  });

  it('formats thrown objects with a message and no error name', async () => {
    const executor = new QuickJsJavaScriptExecutor();

    await expect(executor.execute('throw { message: "object failure" }', {
      filename: '/plain-object.js',
      timeoutMs: 1000,
      allowNetwork: false,
    })).resolves.toMatchObject({
      exitCode: 1,
      output: '[error] Error: object failure',
    });
  });

  it('does not expose fetch when network is denied', async () => {
    const executor = new QuickJsJavaScriptExecutor();

    const result = await executor.execute('console.log(typeof fetch);', {
      filename: '/network-denied.js',
      timeoutMs: 1000,
      allowNetwork: false,
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('undefined');
  });

  it('executes policy-approved fetch calls without exposing ambient credentials', async () => {
    const executor = new QuickJsJavaScriptExecutor({
      fetchImplementation: async (input, init) => {
        expect(input).toBe('https://api.example.test/data');
        expect(init?.credentials).toBe('omit');
        expect(init?.redirect).toBe('manual');
        expect(init?.headers).toEqual({ accept: 'text/plain' });
        return new Response('hello from fetch', {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/plain' },
        });
      },
    });

    const result = await executor.execute([
      '(async () => {',
      '  const response = await fetch("https://api.example.test/data", {',
      '    headers: { accept: "text/plain", authorization: "Bearer leaked" },',
      '    credentials: "include",',
      '  });',
      '  console.log(response.status, response.ok);',
      '  console.log(response.headers.get("content-type"));',
      '  console.log(await response.text());',
      '})()',
    ].join('\n'), {
      filename: '/network.js',
      timeoutMs: 1000,
      allowNetwork: true,
      network: {
        allowedOrigins: ['https://api.example.test'],
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('200 true\ntext/plain\nhello from fetch');
  });

  it('supports fetch response json helpers and missing headers', async () => {
    const executor = new QuickJsJavaScriptExecutor({
      fetchImplementation: async () => new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    });

    const result = await executor.execute([
      '(async () => {',
      '  const response = await fetch("https://api.example.test/data");',
      '  console.log(response.headers.get("missing"));',
      '  console.log((await response.json()).ok);',
      '})()',
    ].join('\n'), {
      filename: '/json.js',
      timeoutMs: 1000,
      allowNetwork: true,
      network: { allowedOrigins: ['https://api.example.test'] },
    });

    expect(result).toMatchObject({ exitCode: 0, output: 'null\ntrue' });
  });

  it('reports fetch and promise rejection failures from async guest code', async () => {
    const executor = new QuickJsJavaScriptExecutor({
      fetchImplementation: async () => {
        throw new Error('blocked by policy');
      },
    });

    await expect(executor.execute('(async () => { await fetch("https://api.example.test/data"); })()', {
      filename: '/fetch-failure.js',
      timeoutMs: 1000,
      allowNetwork: true,
      network: { allowedOrigins: ['https://api.example.test'] },
    })).resolves.toMatchObject({
      exitCode: 1,
      output: '[error] Error: blocked by policy',
    });

    await expect(executor.execute('Promise.reject(new Error("guest rejected"))', {
      filename: '/promise-rejected.js',
      timeoutMs: 1000,
      allowNetwork: false,
    })).resolves.toMatchObject({
      exitCode: 1,
      output: '[error] Error: guest rejected',
    });

    const stringThrowingExecutor = new QuickJsJavaScriptExecutor({
      fetchImplementation: async () => {
        throw 'string failure';
      },
    });
    await expect(stringThrowingExecutor.execute('(async () => { await fetch("https://api.example.test/data"); })()', {
      filename: '/fetch-string-failure.js',
      timeoutMs: 1000,
      allowNetwork: true,
      network: { allowedOrigins: ['https://api.example.test'] },
    })).resolves.toMatchObject({
      exitCode: 1,
      output: '[error] Error: string failure',
    });
  });

  it('handles already-fulfilled promises and invalid response json', async () => {
    const executor = new QuickJsJavaScriptExecutor({
      fetchImplementation: async () => new Response('not-json'),
    });

    await expect(executor.execute('Promise.resolve(42)', {
      filename: '/fulfilled.js',
      timeoutMs: 1000,
      allowNetwork: false,
    })).resolves.toMatchObject({ exitCode: 0, output: '' });

    const result = await executor.execute([
      '(async () => {',
      '  const response = await fetch("https://api.example.test/data");',
      '  try { await response.json(); } catch (error) { console.log(error.name); }',
      '})()',
    ].join('\n'), {
      filename: '/invalid-json.js',
      timeoutMs: 1000,
      allowNetwork: true,
      network: { allowedOrigins: ['https://api.example.test'] },
    });

    expect(result).toMatchObject({ exitCode: 0, output: 'SyntaxError' });
  });

  it('accepts fetch implementations from per-execution and constructor network policy options', async () => {
    const constructorNetworkExecutor = new QuickJsJavaScriptExecutor({
      network: {
        fetchImplementation: async () => new Response('constructor policy'),
      },
    });
    await expect(constructorNetworkExecutor.execute('(async () => console.log(await (await fetch("https://api.example.test/data")).text()))()', {
      filename: '/constructor-network.js',
      timeoutMs: 1000,
      allowNetwork: true,
      network: { allowedOrigins: ['https://api.example.test'] },
    })).resolves.toMatchObject({
      exitCode: 0,
      output: 'constructor policy',
    });

    const executionNetworkExecutor = new QuickJsJavaScriptExecutor({
      fetchImplementation: async () => new Response('constructor direct'),
    });
    await expect(executionNetworkExecutor.execute('(async () => console.log(await (await fetch("https://api.example.test/data")).text()))()', {
      filename: '/execution-network.js',
      timeoutMs: 1000,
      allowNetwork: true,
      network: {
        allowedOrigins: ['https://api.example.test'],
        fetchImplementation: async () => new Response('execution policy'),
      },
    })).resolves.toMatchObject({
      exitCode: 0,
      output: 'execution policy',
    });
  });
});
