export type ModelProviderKind = 'openai-compatible';

export interface ConfiguredModelDefinition {
  id: string;
  name: string;
  enabled: boolean;
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsNativeToolCalls?: boolean;
}

export interface OpenAICompatibleProviderDefinition {
  id: string;
  name: string;
  kind: 'openai-compatible';
  enabled: boolean;
  baseURL: string;
  apiKey?: string;
  apiKeyEnvVar?: string;
  headers?: Record<string, string>;
  includeUsage?: boolean;
  defaultModelId?: string;
  models: ConfiguredModelDefinition[];
}

export type ModelProviderDefinition = OpenAICompatibleProviderDefinition;

export interface ModelProviderCatalog {
  providers: ModelProviderDefinition[];
  activeModel?: ModelProviderRef;
}

export interface ModelProviderRef {
  providerId: string;
  modelId: string;
}

export interface ResolvedModelProvider {
  provider: ModelProviderDefinition;
  model: ConfiguredModelDefinition;
  ref: string;
}

export interface OpenAICompatibleProviderOptions {
  name: string;
  baseURL: string;
  apiKey?: string;
  headers?: Record<string, string>;
  includeUsage?: boolean;
}

export interface ModelProviderCapabilities {
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsNativeToolCalls: boolean;
}

export type OpenAICompatibleModelProviderFactory<TModel> = (
  options: OpenAICompatibleProviderOptions,
) => {
  chatModel: (modelId: string) => TModel;
};

export interface ConfiguredModelFactories<TModel> {
  openAICompatible: OpenAICompatibleModelProviderFactory<TModel>;
}

export interface SecretResolutionOptions {
  getSecret?: (name: string) => string | undefined;
}

const DEFAULT_CONTEXT_WINDOW = 8_192;
const DEFAULT_MAX_OUTPUT_TOKENS = 1_024;

export function defineModelProviderCatalog(input: unknown): ModelProviderCatalog {
  if (!isRecord(input)) {
    throw new Error('Model provider catalog must be an object.');
  }

  const rawProviders = input.providers;
  if (!Array.isArray(rawProviders) || rawProviders.length === 0) {
    throw new Error('Model provider catalog must include at least one provider.');
  }

  const seenProviders = new Set<string>();
  const providers = rawProviders.map((rawProvider) => {
    const provider = normalizeProvider(rawProvider);
    if (seenProviders.has(provider.id)) {
      throw new Error(`Duplicate provider id: ${provider.id}`);
    }
    seenProviders.add(provider.id);
    return provider;
  });

  const activeModel = input.activeModel === undefined
    ? undefined
    : parseModelProviderSelection(input.activeModel);
  const catalog: ModelProviderCatalog = {
    providers,
    ...(activeModel ? { activeModel } : {}),
  };

  if (activeModel) {
    resolveModelProvider(catalog, activeModel);
  }

  return catalog;
}

export function listConfiguredModels(
  catalog: ModelProviderCatalog,
  options: { includeDisabled?: boolean } = {},
): ResolvedModelProvider[] {
  const includeDisabled = options.includeDisabled === true;
  const entries: ResolvedModelProvider[] = [];

  for (const provider of catalog.providers) {
    if (!includeDisabled && !provider.enabled) {
      continue;
    }
    for (const model of provider.models) {
      if (!includeDisabled && !model.enabled) {
        continue;
      }
      entries.push({ provider, model, ref: toModelProviderRef(provider.id, model.id) });
    }
  }

  return entries;
}

export function resolveModelProvider(
  catalog: ModelProviderCatalog,
  ref?: string | ModelProviderRef,
  options: { includeDisabled?: boolean } = {},
): ResolvedModelProvider {
  const includeDisabled = options.includeDisabled === true;
  const selection = ref === undefined
    ? getDefaultModelSelection(catalog, includeDisabled)
    : parseModelProviderSelection(ref);
  const provider = catalog.providers.find((candidate) => candidate.id === selection.providerId);

  if (!provider) {
    throw new Error(`Unknown provider: ${selection.providerId}`);
  }
  if (!includeDisabled && !provider.enabled) {
    throw new Error(`Provider is disabled: ${provider.id}`);
  }

  const model = provider.models.find((candidate) => candidate.id === selection.modelId);
  if (!model) {
    throw new Error(`Unknown model for provider ${provider.id}: ${selection.modelId}`);
  }
  if (!includeDisabled && !model.enabled) {
    throw new Error(`Model is disabled: ${provider.id}:${model.id}`);
  }

  return { provider, model, ref: toModelProviderRef(provider.id, model.id) };
}

export function getOpenAICompatibleProviderOptions(
  provider: OpenAICompatibleProviderDefinition,
  options: SecretResolutionOptions = {},
): OpenAICompatibleProviderOptions {
  const resolved: OpenAICompatibleProviderOptions = {
    name: provider.id,
    baseURL: provider.baseURL,
  };

  const apiKey = provider.apiKey
    ?? (provider.apiKeyEnvVar ? readSecret(provider.apiKeyEnvVar, options.getSecret) : undefined);
  if (apiKey) {
    resolved.apiKey = apiKey;
  }

  const headers = resolveHeaders(provider.headers, options.getSecret);
  if (headers) {
    resolved.headers = headers;
  }

  if (provider.includeUsage !== undefined) {
    resolved.includeUsage = provider.includeUsage;
  }

  return resolved;
}

export function createConfiguredModel<TModel>(
  catalog: ModelProviderCatalog,
  ref: string | ModelProviderRef | undefined,
  factories: ConfiguredModelFactories<TModel>,
  options: SecretResolutionOptions = {},
): TModel {
  const resolved = resolveModelProvider(catalog, ref);
  const providerOptions = getOpenAICompatibleProviderOptions(resolved.provider, options);
  return factories.openAICompatible(providerOptions).chatModel(resolved.model.id);
}

export function getModelProviderCapabilities(resolved: ResolvedModelProvider): ModelProviderCapabilities {
  return {
    provider: resolved.provider.id,
    contextWindow: resolved.model.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
    maxOutputTokens: resolved.model.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    supportsNativeToolCalls: resolved.model.supportsNativeToolCalls ?? false,
  };
}

export function parseModelProviderRef(ref: string): ModelProviderRef {
  const separatorIndex = ref.indexOf(':');
  if (separatorIndex <= 0 || separatorIndex === ref.length - 1) {
    throw new Error('Model provider ref must use provider:model syntax.');
  }
  return {
    providerId: ref.slice(0, separatorIndex),
    modelId: ref.slice(separatorIndex + 1),
  };
}

export function toModelProviderRef(providerId: string, modelId: string): string {
  return `${providerId}:${modelId}`;
}

function getDefaultModelSelection(catalog: ModelProviderCatalog, includeDisabled: boolean): ModelProviderRef {
  if (catalog.activeModel) {
    return catalog.activeModel;
  }

  for (const provider of catalog.providers) {
    if (!includeDisabled && !provider.enabled) {
      continue;
    }

    const modelId = provider.defaultModelId
      ?? provider.models.find((model) => includeDisabled || model.enabled)?.id;

    if (modelId) {
      return { providerId: provider.id, modelId };
    }
  }

  throw new Error('Model provider catalog does not contain any enabled models.');
}

function parseModelProviderSelection(selection: unknown): ModelProviderRef {
  if (typeof selection === 'string') {
    return parseModelProviderRef(selection);
  }
  if (!isRecord(selection)) {
    throw new Error('Model provider selection must be a provider:model string or object ref.');
  }
  return {
    providerId: readString(selection.providerId, 'providerId'),
    modelId: readString(selection.modelId, 'modelId'),
  };
}

function normalizeProvider(rawProvider: unknown): ModelProviderDefinition {
  if (!isRecord(rawProvider)) {
    throw new Error('Model provider entry must be an object.');
  }

  const id = readString(rawProvider.id, 'provider id');
  const kind = readString(rawProvider.kind, `provider ${id} kind`);
  if (kind !== 'openai-compatible') {
    throw new Error(`Unsupported provider kind for ${id}: ${kind}`);
  }

  const models = normalizeModels(id, rawProvider.models);
  const defaultModelId = readOptionalString(rawProvider.defaultModelId, `provider ${id} defaultModelId`);
  if (defaultModelId && !models.some((model) => model.id === defaultModelId)) {
    throw new Error(`Provider ${id} defaultModelId does not match a configured model.`);
  }

  return {
    id,
    name: readOptionalString(rawProvider.name, `provider ${id} name`) ?? id,
    kind,
    enabled: readOptionalBoolean(rawProvider.enabled, `provider ${id} enabled`) ?? true,
    baseURL: stripTrailingSlashes(readString(rawProvider.baseURL, `provider ${id} baseURL`)),
    apiKey: readOptionalString(rawProvider.apiKey, `provider ${id} apiKey`),
    apiKeyEnvVar: readOptionalString(rawProvider.apiKeyEnvVar, `provider ${id} apiKeyEnvVar`),
    headers: normalizeHeaders(rawProvider.headers, id),
    includeUsage: readOptionalBoolean(rawProvider.includeUsage, `provider ${id} includeUsage`),
    ...(defaultModelId ? { defaultModelId } : {}),
    models,
  };
}

function normalizeModels(providerId: string, rawModels: unknown): ConfiguredModelDefinition[] {
  if (!Array.isArray(rawModels) || rawModels.length === 0) {
    throw new Error(`Provider ${providerId} must include at least one model.`);
  }

  const seenModels = new Set<string>();
  return rawModels.map((rawModel) => {
    const model = normalizeModel(providerId, rawModel);
    if (seenModels.has(model.id)) {
      throw new Error(`Duplicate model id for provider ${providerId}: ${model.id}`);
    }
    seenModels.add(model.id);
    return model;
  });
}

function normalizeModel(providerId: string, rawModel: unknown): ConfiguredModelDefinition {
  if (typeof rawModel === 'string') {
    const id = readString(rawModel, `provider ${providerId} model id`);
    return {
      id,
      name: id,
      enabled: true,
    };
  }
  if (!isRecord(rawModel)) {
    throw new Error(`Provider ${providerId} model entry must be a string or object.`);
  }

  const id = readString(rawModel.id, `provider ${providerId} model id`);
  return {
    id,
    name: readOptionalString(rawModel.name, `provider ${providerId} model ${id} name`) ?? id,
    enabled: readOptionalBoolean(rawModel.enabled, `provider ${providerId} model ${id} enabled`) ?? true,
    contextWindow: readOptionalPositiveInteger(rawModel.contextWindow, `provider ${providerId} model ${id} contextWindow`),
    maxOutputTokens: readOptionalPositiveInteger(rawModel.maxOutputTokens, `provider ${providerId} model ${id} maxOutputTokens`),
    supportsNativeToolCalls: readOptionalBoolean(
      rawModel.supportsNativeToolCalls,
      `provider ${providerId} model ${id} supportsNativeToolCalls`,
    ),
  };
}

function normalizeHeaders(rawHeaders: unknown, providerId: string): Record<string, string> | undefined {
  if (rawHeaders === undefined) {
    return undefined;
  }
  if (!isRecord(rawHeaders)) {
    throw new Error(`Provider ${providerId} headers must be an object.`);
  }

  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(rawHeaders)) {
    headers[readString(name, `provider ${providerId} header name`)] = readString(
      value,
      `provider ${providerId} header ${name}`,
    );
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function resolveHeaders(
  headers: Record<string, string> | undefined,
  getSecret: SecretResolutionOptions['getSecret'],
): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }

  const resolved: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    resolved[name] = resolveSecretTemplate(value, getSecret);
  }
  return resolved;
}

function resolveSecretTemplate(value: string, getSecret: SecretResolutionOptions['getSecret']): string {
  return value.replace(/\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => readSecret(name, getSecret));
}

function readSecret(name: string, getSecret: SecretResolutionOptions['getSecret']): string {
  const value = getSecret?.(name);
  if (value === undefined) {
    throw new Error(`Missing secret for provider config: ${name}`);
  }
  return value;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function readOptionalString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : readString(value, label);
}

function readOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean.`);
  }
  return value;
}

function readOptionalPositiveInteger(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return Math.floor(value);
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
