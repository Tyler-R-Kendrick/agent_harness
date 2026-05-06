import { describe, expect, it } from 'vitest';
import { SandboxPathError, SandboxQuotaError } from '../errors';
import { InMemoryVirtualFileSystem, normalizeSandboxPath } from '../vfs';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytes(content: string): Uint8Array {
  return encoder.encode(content);
}

function text(content: Uint8Array): string {
  return decoder.decode(content);
}

describe('InMemoryVirtualFileSystem', () => {
  it('normalizes paths to POSIX absolute paths', () => {
    expect(normalizeSandboxPath('skills\\hello\\src\\index.js')).toBe('/skills/hello/src/index.js');
    expect(normalizeSandboxPath('/skills/./hello/src/index.js')).toBe('/skills/hello/src/index.js');
  });

  it('rejects empty paths and parent traversal', () => {
    expect(() => normalizeSandboxPath('')).toThrow(SandboxPathError);
    expect(() => normalizeSandboxPath('/skills/../escape.js')).toThrow(SandboxPathError);
    expect(() => normalizeSandboxPath('skills/%2e%2e/escape.js')).toThrow(SandboxPathError);
    expect(normalizeSandboxPath('/bad/%E0%A4%A')).toBe('/bad/%E0%A4%A');
  });

  it('stores and returns copies of file content', () => {
    const vfs = new InMemoryVirtualFileSystem();
    const original = bytes('abc');

    vfs.writeFile('/a.txt', original);
    original[0] = 90;
    const firstRead = vfs.readFile('/a.txt');
    firstRead[1] = 90;

    expect(text(vfs.readFile('/a.txt'))).toBe('abc');
  });

  it('lists, deletes, and clears files under a requested path', () => {
    const vfs = new InMemoryVirtualFileSystem();
    vfs.writeFile('/skills/a/src/index.js', bytes('a'));
    vfs.writeFile('/skills/b/src/index.js', bytes('b'));

    expect(vfs.list('/skills/a')).toEqual(['/skills/a/src/index.js']);
    expect(vfs.delete('/skills/a/src/index.js')).toBe(true);
    expect(vfs.delete('/skills/a/src/index.js')).toBe(false);
    expect(vfs.list('/skills')).toEqual(['/skills/b/src/index.js']);
    vfs.clear();
    expect(vfs.list()).toEqual([]);
  });

  it('rejects root writes, missing reads, and can list an exact file path', () => {
    const vfs = new InMemoryVirtualFileSystem();
    vfs.writeFile('/a.txt', bytes('a'));

    expect(() => vfs.writeFile('/', bytes('root'))).toThrow(SandboxPathError);
    expect(() => vfs.readFile('/missing.txt')).toThrow(SandboxPathError);
    expect(vfs.list('/a.txt')).toEqual(['/a.txt']);
  });

  it('enforces per-file and total storage quotas', () => {
    const vfs = new InMemoryVirtualFileSystem({ maxFileBytes: 3, maxTotalBytes: 5 });

    expect(() => vfs.writeFile('/too-large.txt', bytes('1234'))).toThrow(SandboxQuotaError);
    vfs.writeFile('/a.txt', bytes('123'));
    expect(() => vfs.writeFile('/b.txt', bytes('123'))).toThrow(SandboxQuotaError);
    vfs.writeFile('/a.txt', bytes('1'));
    vfs.writeFile('/b.txt', bytes('123'));
    expect(vfs.getTotalBytes()).toBe(4);
  });
});
