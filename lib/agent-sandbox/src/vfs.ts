import { SandboxPathError, SandboxQuotaError } from './errors';

export const DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const DEFAULT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;

export interface VirtualFileSystemOptions {
  maxFileBytes?: number;
  maxTotalBytes?: number;
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function normalizeSandboxPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new SandboxPathError('Sandbox paths cannot be empty.');
  }

  const segments: string[] = [];
  for (const rawSegment of trimmed.replaceAll('\\', '/').split('/')) {
    if (!rawSegment || rawSegment === '.') {
      continue;
    }
    const decodedSegment = decodePathSegment(rawSegment);
    if (rawSegment === '..' || decodedSegment === '..') {
      throw new SandboxPathError('Parent traversal is not allowed in sandbox paths.');
    }
    segments.push(rawSegment);
  }

  return `/${segments.join('/')}`;
}

function assertFilePath(path: string): void {
  if (path === '/') {
    throw new SandboxPathError('Sandbox file paths must include a file name.');
  }
}

function copyBytes(content: Uint8Array): Uint8Array {
  return new Uint8Array(content);
}

export class InMemoryVirtualFileSystem {
  private readonly files = new Map<string, Uint8Array>();
  private readonly maxFileBytes: number;
  private readonly maxTotalBytes: number;
  private totalBytes = 0;

  constructor(options: VirtualFileSystemOptions = {}) {
    this.maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    this.maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  }

  writeFile(path: string, content: Uint8Array): string {
    const normalizedPath = normalizeSandboxPath(path);
    assertFilePath(normalizedPath);
    if (content.byteLength > this.maxFileBytes) {
      throw new SandboxQuotaError(`File ${normalizedPath} exceeds the ${this.maxFileBytes} byte per-file quota.`);
    }

    const existingBytes = this.files.get(normalizedPath)?.byteLength ?? 0;
    const nextTotalBytes = this.totalBytes - existingBytes + content.byteLength;
    if (nextTotalBytes > this.maxTotalBytes) {
      throw new SandboxQuotaError(`Sandbox storage exceeds the ${this.maxTotalBytes} byte total quota.`);
    }

    this.files.set(normalizedPath, copyBytes(content));
    this.totalBytes = nextTotalBytes;
    return normalizedPath;
  }

  readFile(path: string): Uint8Array {
    const normalizedPath = normalizeSandboxPath(path);
    const content = this.files.get(normalizedPath);
    if (!content) {
      throw new SandboxPathError(`File not found: ${normalizedPath}`);
    }
    return copyBytes(content);
  }

  hasFile(path: string): boolean {
    return this.files.has(normalizeSandboxPath(path));
  }

  list(path = '/'): string[] {
    const normalizedPath = normalizeSandboxPath(path);
    if (this.files.has(normalizedPath)) {
      return [normalizedPath];
    }
    const prefix = normalizedPath === '/' ? '/' : `${normalizedPath}/`;
    return [...this.files.keys()]
      .filter((filePath) => filePath.startsWith(prefix))
      .sort();
  }

  delete(path: string): boolean {
    const normalizedPath = normalizeSandboxPath(path);
    const content = this.files.get(normalizedPath);
    if (!content) {
      return false;
    }
    this.files.delete(normalizedPath);
    this.totalBytes -= content.byteLength;
    return true;
  }

  clear(): void {
    this.files.clear();
    this.totalBytes = 0;
  }

  getTotalBytes(): number {
    return this.totalBytes;
  }
}
