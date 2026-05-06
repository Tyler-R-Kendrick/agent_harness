import { describe, expect, it } from 'vitest';
import type { JavaScriptExecutor } from '../quickjsRuntime';
import { SandboxWorkerRuntime } from '../workerRuntime';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytes(content: string): Uint8Array {
  return encoder.encode(content);
}

const fakeExecutor: JavaScriptExecutor = {
  async execute(source, options) {
    return {
      output: `${options.filename}:${options.timeoutMs}:${options.allowNetwork}:${source}`,
      exitCode: 0,
    };
  },
};

describe('SandboxWorkerRuntime command handling', () => {
  it('handles write, run, rm, reset, and missing argument cases', async () => {
    const runtime = new SandboxWorkerRuntime({ executor: fakeExecutor, allowNetwork: true, maxOutputBytes: 1000 });
    const encoded = btoa('console.log("x")');

    await expect(runtime.execute('', 10)).resolves.toMatchObject({ exitCode: 127, output: 'Missing sandbox command.' });
    await expect(runtime.execute('ls /missing', 10)).resolves.toMatchObject({ exitCode: 1, output: 'File not found: /missing' });
    await expect(runtime.execute(`write /skill.js ${encoded}`, 10)).resolves.toMatchObject({ exitCode: 0, output: '/skill.js' });
    await expect(runtime.execute('run /skill.js', 10)).resolves.toMatchObject({
      exitCode: 0,
      output: '/skill.js:10:true:console.log("x")',
    });
    await expect(runtime.execute('rm /skill.js', 10)).resolves.toMatchObject({ exitCode: 0, output: '/skill.js' });
    await expect(runtime.execute('rm /skill.js', 10)).resolves.toMatchObject({ exitCode: 1, output: 'File not found: /skill.js' });
    await expect(runtime.execute('cat', 10)).resolves.toMatchObject({ exitCode: 1, output: 'cat requires a path.' });
    await expect(runtime.execute('write /x.txt', 10)).resolves.toMatchObject({ exitCode: 1, output: 'write requires a path and base64 content.' });
    await expect(runtime.execute('rm', 10)).resolves.toMatchObject({ exitCode: 1, output: 'rm requires a path.' });
    await expect(runtime.execute('node', 10)).resolves.toMatchObject({ exitCode: 1, output: 'node requires a JavaScript file path.' });
    await expect(runtime.execute('node /missing.js', 10)).resolves.toMatchObject({ exitCode: 1, output: 'File not found: /missing.js' });

    await runtime.handleRequest({ id: 1, op: 'reset' });
    await expect(runtime.execute('ls /', 10)).resolves.toMatchObject({ exitCode: 0, output: '' });
  });

  it('truncates output inside the worker runtime when configured', async () => {
    const runtime = new SandboxWorkerRuntime({ executor: fakeExecutor, maxOutputBytes: 5 });
    runtime.uploadFiles([['/a.js', bytes('123456789')]]);

    await expect(runtime.execute('node /a.js', 10)).resolves.toMatchObject({
      exitCode: 0,
      output: '/a.js',
      truncated: true,
    });
  });

  it('applies configure messages before handling sandbox commands', async () => {
    const runtime = new SandboxWorkerRuntime({ executor: fakeExecutor });

    await runtime.handleRequest({ id: 0, op: 'configure', payload: {} });
    expect(runtime.uploadFiles([['/default.txt', bytes('ok')]])).toEqual([
      { path: '/default.txt', error: null },
    ]);

    await runtime.handleRequest({
      id: 0,
      op: 'configure',
      payload: {
        allowNetwork: true,
        maxFileBytes: 4,
        maxOutputBytes: 6,
        maxTotalBytes: 10,
      },
    });

    expect(runtime.uploadFiles([['/too-large.txt', bytes('12345')]])).toEqual([
      { path: '/too-large.txt', error: expect.stringContaining('exceeds the 4 byte') },
    ]);
    runtime.uploadFiles([['/ok.js', bytes('1234')]]);
    await expect(runtime.execute('node /ok.js', 10)).resolves.toMatchObject({
      output: '/ok.js',
      truncated: true,
    });
  });


  it('returns download errors and catches command path errors', async () => {
    const runtime = new SandboxWorkerRuntime({ executor: fakeExecutor });
    runtime.uploadFiles([['/ok.txt', bytes('ok')]]);

    expect(runtime.downloadFiles(['/missing.txt', '../bad.txt'])).toEqual([
      { path: '/missing.txt', content: null, error: 'File not found: /missing.txt' },
      { path: '../bad.txt', content: null, error: 'Parent traversal is not allowed in sandbox paths.' },
    ]);
    await expect(runtime.execute('cat ../bad.txt', 10)).resolves.toMatchObject({
      exitCode: 1,
      output: 'Parent traversal is not allowed in sandbox paths.',
    });
    const [download] = runtime.downloadFiles(['/ok.txt']);
    expect(decoder.decode(download.content ?? new Uint8Array())).toBe('ok');
  });

  it('converts non-error executor failures into failed command output', async () => {
    const runtime = new SandboxWorkerRuntime({
      executor: {
        execute: () => Promise.reject('string executor failure'),
      },
    });
    runtime.uploadFiles([['/boom.js', bytes('throw new Error("boom")')]]);

    await expect(runtime.execute('node /boom.js', 10)).resolves.toMatchObject({
      exitCode: 1,
      output: 'string executor failure',
    });
  });
});
