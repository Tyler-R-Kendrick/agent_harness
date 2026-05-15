export type PrivacyLevel = 'PL1' | 'PL2' | 'PL3' | 'PL4';

export interface PrivacySpan {
  readonly type: string;
  readonly level: PrivacyLevel;
  readonly raw: string;
}

export interface Policy {
  readonly minProtectedLevel: PrivacyLevel;
}

export interface MappingEntry {
  readonly placeholder: string;
  readonly raw: string;
  readonly type: string;
  readonly level: PrivacyLevel;
}

const LEVEL_ORDER: Record<PrivacyLevel, number> = {
  PL1: 1,
  PL2: 2,
  PL3: 3,
  PL4: 4,
};

export function shouldProtect(level: PrivacyLevel, policy: Policy): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[policy.minProtectedLevel];
}

export class PlaceholderAllocator {
  private readonly counters = new Map<string, number>();

  next(type: string): string {
    const current = this.counters.get(type) ?? 0;
    const next = current + 1;
    this.counters.set(type, next);
    return `<${type}_${next}>`;
  }
}

export class LocalMappingStore {
  private readonly entries = new Map<string, MappingEntry>();

  put(entry: MappingEntry): void {
    this.entries.set(entry.placeholder, entry);
  }

  get(placeholder: string): MappingEntry | undefined {
    return this.entries.get(placeholder);
  }

  cleanup(level: PrivacyLevel): void {
    this.entries.forEach((value, key) => {
      if (value.level === level) {
        this.entries.delete(key);
      }
    });
  }

  size(): number {
    return this.entries.size;
  }
}

export function applyEnvelope(
  input: string,
  spans: readonly PrivacySpan[],
  policy: Policy,
  allocator: PlaceholderAllocator,
  store: LocalMappingStore,
): string {
  let output = input;

  for (const span of spans) {
    if (!shouldProtect(span.level, policy)) {
      continue;
    }

    const placeholder = allocator.next(span.type);
    store.put({
      placeholder,
      raw: span.raw,
      type: span.type,
      level: span.level,
    });

    output = output.split(span.raw).join(placeholder);
  }

  return output;
}

export function restoreEnvelope(input: string, store: LocalMappingStore): string {
  const placeholderMatches = input.match(/<([A-Za-z]+_[0-9]+)>/g) ?? [];
  let restored = input;

  for (const placeholder of placeholderMatches) {
    const entry = store.get(placeholder);
    if (entry) {
      restored = restored.split(placeholder).join(entry.raw);
    }
  }

  return restored;
}

export function enforceLifecycle(store: LocalMappingStore): void {
  store.cleanup('PL4');
}
