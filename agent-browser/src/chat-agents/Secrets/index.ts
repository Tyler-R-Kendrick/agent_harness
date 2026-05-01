import type { ToolSet } from 'ai';
import {
  createStore as createIdbStore,
  del as idbDel,
  get as idbGet,
  keys as idbKeys,
  set as idbSet,
} from 'idb-keyval';
import {
  DEFAULT_SECRET_MANAGEMENT_SETTINGS,
  MemorySecretStore,
  SECRET_REF_PREFIX,
  SecretsManagerAgent,
  containsSecretRef,
  createSecretsManagerAgent as createCoreSecretsManagerAgent,
  isSecretManagementSettings,
  isSecretRef,
  normalizeSecretManagementSettings,
  resetDefaultSecretsManagerAgentForTests as resetCoreDefaultSecretsManagerAgentForTests,
  secretRefForId,
  type SecretManagementSettings,
  type SecretRecord,
  type SecretStore,
  type SecretsManagerOptions,
} from 'harness-core';

export {
  DEFAULT_SECRET_MANAGEMENT_SETTINGS,
  MemorySecretStore,
  SECRET_REF_PREFIX,
  SecretsManagerAgent,
  containsSecretRef,
  isSecretManagementSettings,
  isSecretRef,
  normalizeSecretManagementSettings,
  secretRefForId,
};
export type { SecretManagementSettings, SecretRecord, SecretStore, SecretsManagerOptions };

export const SECRETS_MANAGER_AGENT_ID = 'secrets-manager-agent';
export const SECRETS_MANAGER_AGENT_LABEL = 'Secrets Manager';

export class IndexedDbSecretStore implements SecretStore {
  private readonly store: ReturnType<typeof createIdbStore>;

  constructor(namespace = 'agent-browser-secrets') {
    this.store = createIdbStore(namespace, 'secrets');
  }

  async get(id: string): Promise<SecretRecord | undefined> {
    return idbGet<SecretRecord>(id, this.store);
  }

  async set(record: SecretRecord): Promise<void> {
    await idbSet(record.id, record, this.store);
  }

  async delete(id: string): Promise<void> {
    await idbDel(id, this.store);
  }

  async list(): Promise<SecretRecord[]> {
    const storedKeys = await idbKeys(this.store);
    const records = await Promise.all(
      storedKeys
        .filter((key): key is string => typeof key === 'string')
        .map((key) => this.get(key)),
    );
    return records.filter((record): record is SecretRecord => Boolean(record));
  }
}

export function createDefaultSecretStore(): SecretStore {
  return typeof globalThis.indexedDB === 'undefined'
    ? new MemorySecretStore()
    : new IndexedDbSecretStore();
}

let defaultSecretsManager: SecretsManagerAgent | null = null;

export function createSecretsManagerAgent(options: SecretsManagerOptions = {}): SecretsManagerAgent {
  return createCoreSecretsManagerAgent({
    ...options,
    store: options.store ?? createDefaultSecretStore(),
  });
}

export function getDefaultSecretsManagerAgent(): SecretsManagerAgent {
  defaultSecretsManager ??= createSecretsManagerAgent();
  return defaultSecretsManager;
}

export function resetDefaultSecretsManagerAgentForTests(): void {
  defaultSecretsManager = null;
  resetCoreDefaultSecretsManagerAgentForTests();
}

export function wrapToolsForSecretResolution<T extends ToolSet>(tools: T, secrets: SecretsManagerAgent): T {
  return secrets.wrapTools(tools as Record<string, unknown>) as T;
}
