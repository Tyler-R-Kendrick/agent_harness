export interface HarnessStorageEntry<TValue = unknown> {
  key: string;
  value: TValue;
  metadata: Record<string, unknown>;
  updatedAt: string;
}

export interface HarnessStorageSetOptions {
  metadata?: Record<string, unknown>;
  updatedAt?: string;
}

export interface HarnessStorageListOptions {
  prefix?: string;
}

type MaybePromise<T> = T | Promise<T>;

export interface HarnessStorage {
  get<TValue = unknown>(key: string): Promise<HarnessStorageEntry<TValue> | undefined>;
  set<TValue = unknown>(
    key: string,
    value: TValue,
    options?: HarnessStorageSetOptions,
  ): Promise<HarnessStorageEntry<TValue>>;
  delete(key: string): Promise<boolean>;
  list<TValue = unknown>(options?: HarnessStorageListOptions): Promise<Array<HarnessStorageEntry<TValue>>>;
}

export interface HarnessStorageAdapter {
  now?: () => string;
  get: (key: string) => MaybePromise<HarnessStorageEntry | undefined>;
  set: (
    key: string,
    value: unknown,
    options?: HarnessStorageSetOptions,
  ) => MaybePromise<HarnessStorageEntry | void>;
  delete?: (key: string) => MaybePromise<boolean | void>;
  list?: (options?: HarnessStorageListOptions) => MaybePromise<HarnessStorageEntry[]>;
}

export interface HarnessStorageProvider {
  getStorage: () => HarnessStorage;
}

export type HarnessStorageSource = HarnessStorage | HarnessStorageProvider | (() => HarnessStorage);

export interface InMemoryHarnessStorageOptions {
  now?: () => string;
}

export function createHarnessStorageAdapter(adapter: HarnessStorageAdapter): HarnessStorage {
  return {
    async get<TValue = unknown>(key: string): Promise<HarnessStorageEntry<TValue> | undefined> {
      const entry = await adapter.get(key);
      return entry === undefined ? undefined : cloneStorageEntry<TValue>(entry);
    },
    async set<TValue = unknown>(
      key: string,
      value: TValue,
      options: HarnessStorageSetOptions = {},
    ): Promise<HarnessStorageEntry<TValue>> {
      const entry = await adapter.set(key, value, options);
      return cloneStorageEntry(entry ?? {
        key,
        value,
        metadata: { ...(options.metadata ?? {}) },
        updatedAt: options.updatedAt ?? (adapter.now ?? systemTimestamp)(),
      });
    },
    async delete(key: string): Promise<boolean> {
      return adapter.delete === undefined ? false : Boolean(await adapter.delete(key));
    },
    async list<TValue = unknown>(options: HarnessStorageListOptions = {}): Promise<Array<HarnessStorageEntry<TValue>>> {
      const entries = await adapter.list?.(options) ?? [];
      return entries.map((entry) => cloneStorageEntry<TValue>(entry));
    },
  };
}

export function resolveHarnessStorage(source?: HarnessStorageSource): HarnessStorage {
  if (source === undefined) return new InMemoryHarnessStorage();
  if (typeof source === 'function') return source();
  return isHarnessStorage(source) ? source : source.getStorage();
}

export class InMemoryHarnessStorage implements HarnessStorage {
  private readonly entries = new Map<string, HarnessStorageEntry<unknown>>();
  private readonly now: () => string;

  constructor(options: InMemoryHarnessStorageOptions = {}) {
    this.now = options.now ?? systemTimestamp;
  }

  async get<TValue = unknown>(key: string): Promise<HarnessStorageEntry<TValue> | undefined> {
    const entry = this.entries.get(key);
    return entry === undefined ? undefined : cloneStorageEntry<TValue>(entry);
  }

  async set<TValue = unknown>(
    key: string,
    value: TValue,
    options: HarnessStorageSetOptions = {},
  ): Promise<HarnessStorageEntry<TValue>> {
    const entry: HarnessStorageEntry<TValue> = {
      key,
      value,
      metadata: { ...(options.metadata ?? {}) },
      updatedAt: options.updatedAt ?? this.now(),
    };
    this.entries.set(key, entry);
    return cloneStorageEntry(entry);
  }

  async delete(key: string): Promise<boolean> {
    return this.entries.delete(key);
  }

  async list<TValue = unknown>(options: HarnessStorageListOptions = {}): Promise<Array<HarnessStorageEntry<TValue>>> {
    const entries = [...this.entries.values()];
    const filtered = options.prefix === undefined
      ? entries
      : entries.filter((entry) => entry.key.startsWith(options.prefix as string));
    return filtered.map((entry) => cloneStorageEntry<TValue>(entry));
  }
}

function cloneStorageEntry<TValue>(entry: HarnessStorageEntry<unknown>): HarnessStorageEntry<TValue> {
  return {
    key: entry.key,
    value: entry.value as TValue,
    metadata: { ...entry.metadata },
    updatedAt: entry.updatedAt,
  };
}

function isHarnessStorage(source: HarnessStorage | HarnessStorageProvider): source is HarnessStorage {
  return 'get' in source
    && 'set' in source
    && 'delete' in source
    && 'list' in source;
}

function systemTimestamp(): string {
  return new Date().toISOString();
}
