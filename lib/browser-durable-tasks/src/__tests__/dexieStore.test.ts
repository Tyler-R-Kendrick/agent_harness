import { describe, expect, it, vi } from 'vitest';
import { createDexieDurableTaskStore } from '../index.js';

describe('dexie durable task store adapter', () => {
  it('builds an IndexedDB-backed store schema through Dexie without executing browser setup in tests', () => {
    const version = vi.fn(() => ({ stores: vi.fn() }));
    const DexieCtor = vi.fn(function FakeDexie(this: { version: typeof version }, _name: string) {
      this.version = version;
    });
    const store = createDexieDurableTaskStore({
      databaseName: 'agent-harness-tasks',
      DexieCtor,
    });

    expect(store.kind).toBe('dexie-indexeddb');
    expect(store.databaseName).toBe('agent-harness-tasks');
    expect(DexieCtor).toHaveBeenCalledWith('agent-harness-tasks');
    expect(version).toHaveBeenCalledWith(1);
    expect(store.schema.tasks).toContain('&id');
    expect(store.schema.outbox).toContain('idempotencyKey');
  });

  it('uses the real Dexie constructor when no test constructor is injected', () => {
    const store = createDexieDurableTaskStore({ databaseName: 'agent-harness-real-dexie-shape' });

    expect(store.kind).toBe('dexie-indexeddb');
    expect(store.databaseName).toBe('agent-harness-real-dexie-shape');
    expect(store.db).toBeTruthy();
  });
});
