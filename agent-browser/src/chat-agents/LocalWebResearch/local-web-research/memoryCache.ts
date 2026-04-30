import type { Cache } from './types';

type Entry = {
  value: unknown;
  expiresAt?: number;
};

export class MemoryCache implements Cache {
  private readonly entries = new Map<string, Entry>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    this.entries.set(key, {
      value,
      ...(ttlMs !== undefined ? { expiresAt: Date.now() + ttlMs } : {}),
    });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
}
