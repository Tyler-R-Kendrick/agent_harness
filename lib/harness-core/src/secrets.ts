export const SECRET_REF_PREFIX = 'secret-ref://local/';

const SECRET_REF_PATTERN = /secret-ref:\/\/local\/[A-Za-z0-9._~-]+/g;
const AUTH_HEADER_PATTERN = /(\bAuthorization\s*[:=]\s*(?:Bearer|Basic)\s+)([A-Za-z0-9._~+:/-]{12,}=*)/gi;
const GENERIC_SECRET_ASSIGNMENT_PATTERN = /(\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret|client[_-]?secret)\b\s*[:=]\s*)(['"]?)([^'"\s,;]{8,})\2/gi;

type SecretSource = 'detected' | 'manual';

export interface SecretRecord {
  id: string;
  value: string;
  label: string;
  source: SecretSource;
  createdAt: string;
  updatedAt: string;
}

export interface SecretStore {
  get(id: string): Promise<SecretRecord | undefined>;
  set(record: SecretRecord): Promise<void>;
  delete?(id: string): Promise<void>;
  list?(): Promise<SecretRecord[]>;
}

export interface SanitizeTextResult {
  text: string;
  refs: string[];
}

export interface SanitizeDataResult<T> {
  value: T;
  refs: string[];
}

export interface InferenceMessageLike {
  content: string;
  streamedContent?: string;
}

export interface PreparedInferenceMessages<TMessage> {
  messages: TMessage[];
  refs: string[];
}

export interface SecretsManagerOptions {
  store?: SecretStore;
  idFactory?: (input: { label: string; value: string }) => string;
  now?: () => string;
}

type ExecutableTool = {
  execute?: (args: unknown, options?: unknown) => unknown | Promise<unknown>;
};

const SECRET_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'anthropic-api-key', regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { label: 'github-token', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g },
  { label: 'github-token', regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { label: 'openai-api-key', regex: /\bsk-(?!ant-)[A-Za-z0-9]{32,}\b/g },
  { label: 'slack-token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { label: 'aws-access-key-id', regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { label: 'jwt', regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
];

export function isSecretRef(value: string): boolean {
  return new RegExp(`^${escapeRegExp(SECRET_REF_PREFIX)}[A-Za-z0-9._~-]+$`).test(value);
}

export function containsSecretRef(value: string): boolean {
  return new RegExp(SECRET_REF_PATTERN.source).test(value);
}

export function secretRefForId(id: string): string {
  return `${SECRET_REF_PREFIX}${normalizeSecretId(id)}`;
}

export class MemorySecretStore implements SecretStore {
  private readonly records = new Map<string, SecretRecord>();

  async get(id: string): Promise<SecretRecord | undefined> {
    return this.records.get(id);
  }

  async set(record: SecretRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }

  async list(): Promise<SecretRecord[]> {
    return [...this.records.values()];
  }
}

export class SecretsManagerAgent {
  private readonly store: SecretStore;
  private readonly idFactory: (input: { label: string; value: string }) => string;
  private readonly now: () => string;
  private readonly refBySecret = new Map<string, string>();

  constructor(options: SecretsManagerOptions = {}) {
    this.store = options.store ?? new MemorySecretStore();
    this.idFactory = options.idFactory ?? defaultSecretIdFactory;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async sanitizeText(text: string): Promise<SanitizeTextResult> {
    const refs = new Set<string>();
    const sanitized = await this.sanitizeTextInternal(text, refs);
    return { text: sanitized, refs: [...refs] };
  }

  async sanitizeData<T>(value: T): Promise<SanitizeDataResult<T>> {
    const refs = new Set<string>();
    const sanitized = await this.sanitizeUnknown(value, refs);
    return { value: sanitized as T, refs: [...refs] };
  }

  async prepareMessagesForInference<TMessage extends InferenceMessageLike>(
    messages: TMessage[],
  ): Promise<PreparedInferenceMessages<TMessage>> {
    const refs = new Set<string>();
    const sanitized = await Promise.all(messages.map(async (message) => {
      const content = await this.sanitizeTextInternal(message.content, refs);
      const streamedContent = message.streamedContent === undefined
        ? undefined
        : await this.sanitizeTextInternal(message.streamedContent, refs);
      return {
        ...message,
        content,
        ...(streamedContent === undefined ? {} : { streamedContent }),
      };
    }));
    return { messages: sanitized, refs: [...refs] };
  }

  async sanitizeChatMessages<TMessage extends InferenceMessageLike>(messages: TMessage[]): Promise<TMessage[]> {
    return (await this.prepareMessagesForInference(messages)).messages;
  }

  async sanitizeModelMessages<T>(messages: T): Promise<T> {
    return (await this.sanitizeData(messages)).value;
  }

  async renderResponseToUser(response: string): Promise<string> {
    return this.resolveSecretRefs(response);
  }

  async resolveSecretRefs<T>(value: T): Promise<T> {
    if (typeof value === 'string') {
      return (await this.resolveSecretRefsInText(value)) as T;
    }
    if (Array.isArray(value)) {
      return Promise.all(value.map((item) => this.resolveSecretRefs(item))) as T;
    }
    if (isPlainRecord(value)) {
      const entries = await Promise.all(
        Object.entries(value).map(async ([key, entry]) => [key, await this.resolveSecretRefs(entry)] as const),
      );
      return Object.fromEntries(entries) as T;
    }
    return value;
  }

  wrapTools<T extends Record<string, unknown>>(tools: T): T {
    return Object.fromEntries(
      Object.entries(tools).map(([name, toolDefinition]) => [
        name,
        this.wrapTool(toolDefinition),
      ]),
    ) as T;
  }

  private wrapTool(toolDefinition: unknown): unknown {
    const candidate = toolDefinition as ExecutableTool;
    if (!candidate || typeof candidate.execute !== 'function') return toolDefinition;
    const originalExecute = candidate.execute.bind(toolDefinition);
    return {
      ...(toolDefinition as Record<string, unknown>),
      execute: async (args: unknown, options?: unknown) => {
        const resolvedArgs = await this.resolveSecretRefs(args);
        const result = await originalExecute(resolvedArgs, options);
        return (await this.sanitizeData(result)).value;
      },
    };
  }

  private async sanitizeTextInternal(text: string, refs: Set<string>): Promise<string> {
    let sanitized = await this.replaceKnownStoredSecrets(text, refs);
    sanitized = await replaceAsync(sanitized, AUTH_HEADER_PATTERN, async (match) => {
      const prefix = match[1];
      const secret = match[2];
      if (isSecretRef(secret)) return match[0];
      const ref = await this.getOrCreateSecretRef(secret, 'authorization-header', 'detected');
      refs.add(ref);
      return `${prefix}${ref}`;
    });

    for (const pattern of SECRET_PATTERNS) {
      sanitized = await replaceAsync(sanitized, pattern.regex, async (match) => {
        const secret = match[0];
        const ref = await this.getOrCreateSecretRef(secret, pattern.label, 'detected');
        refs.add(ref);
        return ref;
      });
    }

    return replaceAsync(sanitized, GENERIC_SECRET_ASSIGNMENT_PATTERN, async (match) => {
      const prefix = match[1];
      const quote = match[2];
      const secret = match[3];
      if (isSecretRef(secret)) return match[0];
      const ref = await this.getOrCreateSecretRef(secret, normalizeSecretLabel(prefix), 'detected');
      refs.add(ref);
      return `${prefix}${quote}${ref}${quote}`;
    });
  }

  private async sanitizeUnknown(value: unknown, refs: Set<string>, keyHint?: string): Promise<unknown> {
    if (typeof value === 'string') {
      if (keyHint && isSensitiveKey(keyHint) && !containsSecretRef(value)) {
        const sanitized = await this.sanitizeSensitiveField(keyHint, value, refs);
        return this.sanitizeTextInternal(sanitized, refs);
      }
      return this.sanitizeTextInternal(value, refs);
    }
    if (Array.isArray(value)) {
      return Promise.all(value.map((item) => this.sanitizeUnknown(item, refs)));
    }
    if (isPlainRecord(value)) {
      const entries = await Promise.all(
        Object.entries(value).map(async ([key, entry]) => [key, await this.sanitizeUnknown(entry, refs, key)] as const),
      );
      return Object.fromEntries(entries);
    }
    return value;
  }

  private async sanitizeSensitiveField(key: string, value: string, refs: Set<string>): Promise<string> {
    const trimmed = value.trim();
    if (!trimmed) return value;

    const authorizationMatch = /^(\s*(?:Bearer|Basic)\s+)(.+?)(\s*)$/i.exec(value);
    if (isAuthorizationKey(key) && authorizationMatch) {
      const secret = authorizationMatch[2];
      const ref = await this.getOrCreateSecretRef(secret, normalizeSecretLabel(key), 'detected');
      refs.add(ref);
      return `${authorizationMatch[1]}${ref}${authorizationMatch[3]}`;
    }

    const ref = await this.getOrCreateSecretRef(value, normalizeSecretLabel(key), 'detected');
    refs.add(ref);
    return ref;
  }

  private async replaceKnownStoredSecrets(text: string, refs: Set<string>): Promise<string> {
    if (!this.store.list || !text) return text;
    const records = (await this.store.list())
      .filter((record) => record.value.length >= 4)
      .sort((left, right) => right.value.length - left.value.length);
    let sanitized = text;
    for (const record of records) {
      if (!sanitized.includes(record.value)) continue;
      const ref = secretRefForId(record.id);
      this.refBySecret.set(record.value, ref);
      sanitized = sanitized.split(record.value).join(ref);
      refs.add(ref);
    }
    return sanitized;
  }

  private async getOrCreateSecretRef(value: string, label: string, source: SecretSource): Promise<string> {
    const existing = this.refBySecret.get(value);
    if (existing) return existing;

    const id = normalizeSecretId(this.idFactory({ label, value }));
    const ref = secretRefForId(id);
    const now = this.now();
    await this.store.set({
      id,
      value,
      label,
      source,
      createdAt: now,
      updatedAt: now,
    });
    this.refBySecret.set(value, ref);
    return ref;
  }

  private async resolveSecretRefsInText(value: string): Promise<string> {
    return replaceAsync(value, SECRET_REF_PATTERN, async (match) => {
      const ref = match[0];
      const id = ref.slice(SECRET_REF_PREFIX.length);
      const record = await this.store.get(id);
      return record?.value ?? ref;
    });
  }
}

let defaultSecretsManager: SecretsManagerAgent | null = null;

export function createSecretsManagerAgent(options: SecretsManagerOptions = {}): SecretsManagerAgent {
  return new SecretsManagerAgent(options);
}

export function getDefaultSecretsManagerAgent(): SecretsManagerAgent {
  defaultSecretsManager ??= createSecretsManagerAgent();
  return defaultSecretsManager;
}

export function wrapToolsForSecretResolution<T extends Record<string, unknown>>(
  tools: T,
  secrets: SecretsManagerAgent,
): T {
  return secrets.wrapTools(tools);
}

async function replaceAsync(
  value: string,
  regex: RegExp,
  replacer: (match: RegExpExecArray) => Promise<string>,
): Promise<string> {
  const globalRegex = new RegExp(regex.source, regex.flags);
  let output = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = globalRegex.exec(value)) !== null) {
    output += value.slice(lastIndex, match.index);
    output += await replacer(match);
    lastIndex = match.index + match[0].length;
  }
  return output + value.slice(lastIndex);
}

function defaultSecretIdFactory({ label }: { label: string; value: string }): string {
  const random = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${normalizeSecretLabel(label)}-${random}`;
}

function isSensitiveKey(key: string): boolean {
  return /^(?:authorization|proxy-authorization|api[_-]?key|access[_-]?token|auth[_-]?token|token|password|secret|client[_-]?secret)$/i.test(key);
}

function isAuthorizationKey(key: string): boolean {
  return /^(?:authorization|proxy-authorization)$/i.test(key);
}

function normalizeSecretLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'secret';
}

function normalizeSecretId(value: string): string {
  return normalizeSecretLabel(value).replace(/[^a-z0-9._~-]+/g, '-');
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
