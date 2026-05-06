import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadableStream } from 'node:stream/web';
import { SandboxTimeoutError } from '../errors';
import { WebContainerBrowserSandboxProvider } from '../WebContainerBrowserSandboxProvider';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytes(content: string): Uint8Array {
  return encoder.encode(content);
}

function streamOf(...chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

class FakeWebContainer {
  readonly files = new Map<string, Uint8Array>();
  readonly spawned: Array<{ command: string; args: string[]; options: unknown }> = [];
  readonly mount = vi.fn(async () => undefined);
  readonly spawn = vi.fn(async (command: string, args: string[] = [], options: unknown = {}) => {
    this.spawned.push({ command, args, options });
    await this.fs.writeFile('/dist/index.js', bytes('built output'));
    return {
      output: streamOf('build ok'),
      exit: Promise.resolve(0),
      kill: vi.fn(),
    };
  });
  readonly teardown = vi.fn();
  readonly fs = {
    mkdir: vi.fn(async () => undefined),
    writeFile: vi.fn(async (path: string, content: Uint8Array) => {
      this.files.set(path.replace(/^\/+/, ''), new Uint8Array(content));
    }),
    readFile: vi.fn(async (path: string) => {
      const file = this.files.get(path.replace(/^\/+/, ''));
      if (!file) {
        throw new Error(`missing ${path}`);
      }
      return new Uint8Array(file);
    }),
    rm: vi.fn(async (path: string) => {
      this.files.delete(path.replace(/^\/+/, ''));
    }),
    readdir: vi.fn(async () => [...this.files.keys()]),
  };
}

describe('WebContainerBrowserSandboxProvider', () => {
  afterEach(() => {
    vi.doUnmock('@webcontainer/api');
  });

  it('is an agent sandbox for full Node and TypeScript build workloads', () => {
    const sandbox = new WebContainerBrowserSandboxProvider({
      id: 'wc-test',
      boot: async () => new FakeWebContainer(),
    });

    expect(sandbox.id).toBe('wc-test');
    expect(sandbox.kind).toBe('agent');
    expect(sandbox.compute.runtime).toBe('webcontainer-node');
    expect(sandbox.fileSystem.kind).toBe('virtual');

    const defaultSandbox = new WebContainerBrowserSandboxProvider({ allowNetwork: true });
    expect(defaultSandbox.id).toMatch(/^webcontainer-sandbox-/);
    expect(defaultSandbox.compute.networkDefault).toBe('allow');
  });

  it('uploads files, spawns allowed Node commands without a shell, and downloads artifacts', async () => {
    const container = new FakeWebContainer();
    const sandbox = new WebContainerBrowserSandboxProvider({
      id: 'wc-test',
      boot: async () => container,
    });

    await expect(sandbox.uploadFiles([
      ['/package.json', bytes('{"scripts":{"build":"tsc"}}')],
      ['/src/index.ts', bytes('export const value: string = "ok";')],
    ])).resolves.toEqual([
      { path: '/package.json', error: null },
      { path: '/src/index.ts', error: null },
    ]);

    const result = await sandbox.execute('npm run build');
    const [artifact] = await sandbox.downloadFiles(['/dist/index.js']);
    const [rootDownload] = await sandbox.downloadFiles(['/']);

    expect(result).toMatchObject({ exitCode: 0, output: 'build ok', truncated: false });
    expect(container.spawn).toHaveBeenCalledWith('npm', ['run', 'build'], expect.objectContaining({
      cwd: '/',
      output: true,
    }));
    expect(artifact.path).toBe('/dist/index.js');
    expect(decoder.decode(artifact.content ?? new Uint8Array())).toBe('built output');
    expect(rootDownload).toMatchObject({ path: '/', content: null });
  });

  it('supports built-in filesystem commands and reports missing files', async () => {
    const container = new FakeWebContainer();
    const sandbox = new WebContainerBrowserSandboxProvider({
      boot: async () => container,
    });

    await expect(sandbox.execute('write /notes/hello.txt aGk=')).resolves.toMatchObject({
      exitCode: 0,
      output: '/notes/hello.txt',
    });
    await expect(sandbox.execute('ls /notes')).resolves.toMatchObject({
      exitCode: 0,
      output: '/notes/hello.txt',
    });
    await expect(sandbox.execute('cat /notes/hello.txt')).resolves.toMatchObject({
      exitCode: 0,
      output: 'hi',
    });
    await expect(sandbox.execute('rm /notes/hello.txt')).resolves.toMatchObject({
      exitCode: 0,
      output: '/notes/hello.txt',
    });
    await expect(sandbox.execute('ls /notes')).resolves.toMatchObject({
      exitCode: 1,
      output: 'File not found: /notes',
    });
    await expect(sandbox.execute('cat /notes/hello.txt')).resolves.toMatchObject({
      exitCode: 1,
      output: expect.stringContaining('missing'),
    });
  });

  it('validates built-in command arguments and upload/download paths', async () => {
    const container = new FakeWebContainer();
    const sandbox = new WebContainerBrowserSandboxProvider({
      boot: async () => container,
    });

    await expect(sandbox.execute('')).resolves.toMatchObject({ exitCode: 127 });
    await expect(sandbox.execute('   node   spaced.js')).resolves.toMatchObject({ exitCode: 0 });
    await expect(sandbox.execute('cat')).resolves.toMatchObject({ exitCode: 1, output: expect.stringContaining('cat requires') });
    await expect(sandbox.execute('write /missing-content.txt')).resolves.toMatchObject({ exitCode: 1 });
    container.fs.writeFile.mockRejectedValueOnce(new Error('command write denied'));
    await expect(sandbox.execute('write /denied.txt aGk=')).resolves.toMatchObject({
      exitCode: 1,
      output: 'command write denied',
    });
    await expect(sandbox.execute('rm')).resolves.toMatchObject({ exitCode: 1, output: expect.stringContaining('rm requires') });
    await expect(sandbox.execute('node "unterminated')).resolves.toMatchObject({ exitCode: 127 });
    container.fs.writeFile.mockRejectedValueOnce('write denied');
    await expect(sandbox.uploadFiles([
      ['/write-denied.txt', bytes('nope')],
      ['../escape.txt', bytes('nope')],
      ['/', bytes('nope')],
    ])).resolves.toEqual([
      { path: '/write-denied.txt', error: 'write denied' },
      { path: '../escape.txt', error: expect.stringContaining('Parent traversal') },
      { path: '/', error: expect.stringContaining('file name') },
    ]);
    await expect(sandbox.downloadFiles(['/missing.txt'])).resolves.toEqual([
      { path: '/missing.txt', content: null, error: expect.stringContaining('missing') },
    ]);
  });

  it('reports unknown commands and remove failures without shelling out', async () => {
    const container = new FakeWebContainer();
    container.fs.rm.mockRejectedValueOnce(new Error('remove denied'));
    const sandbox = new WebContainerBrowserSandboxProvider({
      boot: async () => container,
    });

    await expect(sandbox.execute('python script.py')).resolves.toMatchObject({
      exitCode: 127,
      output: 'Unknown command: python',
    });
    await expect(sandbox.execute('rm /protected.txt')).resolves.toMatchObject({
      exitCode: 1,
      output: 'remove denied',
    });
    expect(container.spawn).not.toHaveBeenCalled();
  });

  it('surfaces WebContainer spawn failures', async () => {
    const container = new FakeWebContainer();
    container.spawn.mockRejectedValueOnce(new Error('spawn failed'));
    const sandbox = new WebContainerBrowserSandboxProvider({
      boot: async () => container,
    });

    await expect(sandbox.execute('node broken.js')).rejects.toThrow('spawn failed');
  });

  it('rejects shell metacharacters instead of invoking a generic shell', async () => {
    const container = new FakeWebContainer();
    const sandbox = new WebContainerBrowserSandboxProvider({
      boot: async () => container,
    });

    await expect(sandbox.execute('node index.js && cat /secret')).resolves.toMatchObject({
      exitCode: 127,
      output: expect.stringContaining('Unsupported'),
    });
    expect(container.spawn).not.toHaveBeenCalled();
  });

  it('supports quoted arguments and truncates oversized process output', async () => {
    const kill = vi.fn();
    const container = new FakeWebContainer();
    container.spawn.mockResolvedValueOnce({
      output: streamOf('123456', '7890'),
      exit: Promise.resolve(0),
      kill,
    });
    const sandbox = new WebContainerBrowserSandboxProvider({
      maxOutputBytes: 5,
      boot: async () => container,
    });

    const result = await sandbox.execute('node "src/file name.js"');
    await sandbox.execute("node 'src/other file.js'");

    expect(container.spawn).toHaveBeenCalledWith('node', ['src/file name.js'], expect.any(Object));
    expect(container.spawn).toHaveBeenCalledWith('node', ['src/other file.js'], expect.any(Object));
    expect(result).toMatchObject({ exitCode: 1, output: '12345', truncated: true });
    expect(kill).toHaveBeenCalled();
  });

  it('ignores empty process output chunks and can boot the default WebContainer module', async () => {
    const container = new FakeWebContainer();
    vi.doMock('@webcontainer/api', () => ({
      WebContainer: {
        boot: vi.fn(async () => container),
      },
    }));
    container.spawn.mockResolvedValueOnce({
      output: streamOf('', 'ok'),
      exit: Promise.resolve(0),
      kill: vi.fn(),
    });
    const sandbox = new WebContainerBrowserSandboxProvider();

    await expect(sandbox.execute('node index.js')).resolves.toMatchObject({
      exitCode: 0,
      output: 'ok',
    });
  });

  it('truncates oversized built-in command output', async () => {
    const sandbox = new WebContainerBrowserSandboxProvider({
      maxOutputBytes: 8,
      boot: async () => new FakeWebContainer(),
    });

    await sandbox.uploadFiles([
      ['/a.txt', bytes('a')],
      ['/b.txt', bytes('b')],
      ['/c.txt', bytes('c')],
    ]);

    await expect(sandbox.execute('ls /')).resolves.toMatchObject({
      exitCode: 0,
      output: '/a.txt\n/',
      truncated: true,
    });
  });

  it('kills and tears down the container when execution times out', async () => {
    const kill = vi.fn();
    const container = new FakeWebContainer();
    container.spawn.mockResolvedValueOnce({
      output: streamOf(),
      exit: new Promise<number>(() => undefined),
      kill,
    });
    const sandbox = new WebContainerBrowserSandboxProvider({
      defaultTimeoutMs: 5,
      boot: async () => container,
    });

    await expect(sandbox.execute('node /src/index.js')).rejects.toBeInstanceOf(SandboxTimeoutError);
    expect(kill).toHaveBeenCalled();
    expect(container.teardown).toHaveBeenCalled();
  });

  it('resets, closes idempotently, and rejects use after close', async () => {
    const container = new FakeWebContainer();
    const sandbox = new WebContainerBrowserSandboxProvider({
      boot: async () => container,
    });

    await sandbox.uploadFiles([['/index.js', bytes('console.log("hi")')]]);
    await sandbox.reset();
    expect(container.teardown).toHaveBeenCalledTimes(1);
    await sandbox.close();
    await sandbox.close();
    await expect(sandbox.execute('ls')).rejects.toThrow(/closed/i);
    await expect(sandbox.uploadFiles([])).rejects.toThrow(/closed/i);
    await expect(sandbox.downloadFiles([])).rejects.toThrow(/closed/i);
    await expect(sandbox.reset()).rejects.toThrow(/closed/i);
  });
});
