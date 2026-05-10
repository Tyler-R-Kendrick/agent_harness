import Dexie from 'dexie';
import { createMemoryDurableTaskStore } from './memoryStore.js';
import type { DurableTaskStore } from './types.js';

export interface DexieDurableTaskStoreOptions {
  databaseName: string;
  DexieCtor?: new (databaseName: string) => {
    version(version: number): { stores(schema: Record<string, string>): unknown };
  };
}

export interface DexieDurableTaskStore extends DurableTaskStore {
  kind: 'dexie-indexeddb';
  databaseName: string;
  schema: {
    tasks: string;
    outbox: string;
  };
  db: unknown;
}

const DEXIE_SCHEMA = {
  tasks: '&id,type,status,scheduledFor,lockedUntil,lockOwner,idempotencyKey,parentTaskId,updatedAt',
  outbox: '&id,status,scheduledFor,idempotencyKey,updatedAt',
};

export function createDexieDurableTaskStore(options: DexieDurableTaskStoreOptions): DexieDurableTaskStore {
  const DexieClass = options.DexieCtor ?? Dexie;
  const db = new DexieClass(options.databaseName);
  db.version(1).stores(DEXIE_SCHEMA);
  return {
    ...createMemoryDurableTaskStore(),
    kind: 'dexie-indexeddb',
    databaseName: options.databaseName,
    schema: DEXIE_SCHEMA,
    db,
  };
}
