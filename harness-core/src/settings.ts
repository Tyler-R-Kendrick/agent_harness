export type HarnessSettingType = 'string' | 'number' | 'integer' | 'boolean' | 'json' | 'enum' | string;

export interface HarnessSettingDefinition {
  key: string;
  type?: HarnessSettingType;
  description?: string;
  defaultValue?: unknown;
  values?: readonly unknown[];
}

export interface HarnessSettingTypeDefinition {
  id: string;
  parse: (value: unknown, definition: HarnessSettingDefinition) => unknown;
  format?: (value: unknown, definition: HarnessSettingDefinition) => string;
}

export interface SettingsRegistryOptions {
  values?: Record<string, unknown>;
  definitions?: readonly HarnessSettingDefinition[];
  types?: readonly HarnessSettingTypeDefinition[];
}

export type HarnessSettingsInput =
  | SettingsRegistry
  | SettingsRegistryOptions
  | Record<string, unknown>;

export class SettingsRegistry {
  private readonly values = new Map<string, unknown>();
  private readonly definitions = new Map<string, HarnessSettingDefinition>();
  private readonly types = new Map<string, HarnessSettingTypeDefinition>();

  constructor(options: SettingsRegistryOptions = {}) {
    for (const type of BUILT_IN_SETTING_TYPES) {
      this.registerType(type);
    }
    for (const type of options.types ?? []) {
      this.registerType(type);
    }
    for (const definition of options.definitions ?? []) {
      this.registerDefinition(definition);
    }
    for (const [key, value] of Object.entries(options.values ?? {})) {
      this.set(key, value);
    }
  }

  registerType(type: HarnessSettingTypeDefinition): void {
    if (this.types.has(type.id)) {
      throw new Error(`Setting type already registered: ${type.id}`);
    }
    this.types.set(type.id, type);
  }

  registerDefinition(definition: HarnessSettingDefinition): void {
    if (this.definitions.has(definition.key)) {
      throw new Error(`Setting already registered: ${definition.key}`);
    }
    const normalized = { ...definition, type: definition.type ?? 'json' };
    this.resolveType(normalized);
    this.definitions.set(definition.key, normalized);
  }

  get(key: string): unknown {
    if (this.values.has(key)) return this.values.get(key);
    const definition = this.definitions.get(key);
    return definition && Object.hasOwn(definition, 'defaultValue') ? definition.defaultValue : undefined;
  }

  set(key: string, value: unknown): unknown {
    const parsed = this.parse(key, value);
    this.values.set(key, parsed);
    return parsed;
  }

  getDefinition(key: string): HarnessSettingDefinition | undefined {
    const definition = this.definitions.get(key);
    return definition ? cloneDefinition(definition) : undefined;
  }

  listDefinitions(): HarnessSettingDefinition[] {
    return [...this.definitions.values()]
      .map(cloneDefinition)
      .sort((left, right) => left.key.localeCompare(right.key));
  }

  entries(): Record<string, unknown> {
    const keys = new Set([...this.definitions.keys(), ...this.values.keys()]);
    return Object.fromEntries([...keys].sort().map((key) => [key, this.get(key)]));
  }

  hasDefinitions(): boolean {
    return this.definitions.size > 0;
  }

  format(key: string, value: unknown = this.get(key)): string {
    const definition = this.definitions.get(key);
    if (!definition) return formatSettingValue(value);
    return this.resolveType(definition).format?.(value, definition) ?? formatSettingValue(value);
  }

  private parse(key: string, value: unknown): unknown {
    const definition = this.definitions.get(key);
    return definition ? this.resolveType(definition).parse(value, definition) : value;
  }

  private resolveType(definition: HarnessSettingDefinition): HarnessSettingTypeDefinition {
    const typeId = definition.type as string;
    const type = this.types.get(typeId);
    if (!type) throw new Error(`Unknown setting type for ${definition.key}: ${typeId}`);
    return type;
  }
}

export function createSettingsRegistry(
  input?: HarnessSettingsInput,
  fallbackValues: Record<string, unknown> = {},
): SettingsRegistry {
  if (input instanceof SettingsRegistry) {
    for (const [key, value] of Object.entries(fallbackValues)) {
      input.set(key, value);
    }
    return input;
  }

  if (isSettingsRegistryOptions(input)) {
    return new SettingsRegistry({
      ...input,
      values: {
        ...fallbackValues,
        ...(input.values ?? {}),
      },
    });
  }

  return new SettingsRegistry({
    values: {
      ...fallbackValues,
      ...(input ?? {}),
    },
  });
}

export function formatSettingValue(value: unknown): string {
  if (typeof value === 'string') return value;
  const formatted = JSON.stringify(value);
  return formatted === undefined ? 'undefined' : formatted;
}

function isSettingsRegistryOptions(input: HarnessSettingsInput | undefined): input is SettingsRegistryOptions {
  return typeof input === 'object'
    && input !== null
    && ('values' in input || 'definitions' in input || 'types' in input);
}

const BUILT_IN_SETTING_TYPES: readonly HarnessSettingTypeDefinition[] = [
  { id: 'string', parse: (value) => String(value) },
  { id: 'number', parse: parseFiniteNumber },
  { id: 'integer', parse: parseInteger },
  { id: 'boolean', parse: parseBoolean },
  { id: 'json', parse: (value) => value },
  { id: 'enum', parse: parseEnum },
];

function parseFiniteNumber(value: unknown, definition: HarnessSettingDefinition): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected ${definition.key} to be a finite number.`);
  }
  return parsed;
}

function parseInteger(value: unknown, definition: HarnessSettingDefinition): number {
  const parsed = parseFiniteNumber(value, definition);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Expected ${definition.key} to be an integer.`);
  }
  return parsed;
}

function parseBoolean(value: unknown, definition: HarnessSettingDefinition): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Expected ${definition.key} to be true or false.`);
}

function parseEnum(value: unknown, definition: HarnessSettingDefinition): unknown {
  const values = definition.values ?? [];
  if (values.some((candidate) => Object.is(candidate, value))) return value;
  throw new Error(`Expected ${definition.key} to be one of ${values.map(formatSettingValue).join(', ')}.`);
}

function cloneDefinition(definition: HarnessSettingDefinition): HarnessSettingDefinition {
  return {
    ...definition,
    ...(definition.values ? { values: [...definition.values] } : {}),
  };
}
