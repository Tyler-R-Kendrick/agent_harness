import {
  getModelContextPromptRegistry,
  getModelContextPromptTemplateRegistry,
  getModelContextRegistry,
  getModelContextResourceRegistry,
  ModelContext,
} from './modelContext';

const MODEL_CONTEXT_INSTANCE_SYMBOL = Symbol.for('@agent-harness/webmcp/model-context-instance');

type ModelContextHost = Window & {
  [MODEL_CONTEXT_INSTANCE_SYMBOL]?: ModelContext;
};

function hasCompatibleRegistryShape(value: unknown): boolean {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as { list?: unknown }).list === 'function'
    && typeof (value as { subscribe?: unknown }).subscribe === 'function',
  );
}

function hasCompatibleRegistry(value: unknown): value is ModelContext {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Boolean(
    typeof (value as ModelContext & { registerTool?: unknown }).registerTool === 'function'
    && typeof (value as ModelContext & { registerResource?: unknown }).registerResource === 'function'
    && typeof (value as ModelContext & { registerPrompt?: unknown }).registerPrompt === 'function'
    && typeof (value as ModelContext & { registerPromptTemplate?: unknown }).registerPromptTemplate === 'function'
    && hasCompatibleRegistryShape(getModelContextRegistry(value as ModelContext))
    && hasCompatibleRegistryShape(getModelContextResourceRegistry(value as ModelContext))
    && hasCompatibleRegistryShape(getModelContextPromptRegistry(value as ModelContext))
    && hasCompatibleRegistryShape(getModelContextPromptTemplateRegistry(value as ModelContext)),
  );
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]' || hostname === 'localhost';
}

function isSecureTarget(target: Window): boolean {
  if (typeof target.isSecureContext === 'boolean') {
    return target.isSecureContext;
  }

  return target.location.protocol === 'https:' || isLoopbackHost(target.location.hostname);
}

function getDefaultTarget(): Window | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window;
}

export function installModelContext(target = getDefaultTarget()): ModelContext | undefined {
  if (!target || !target.navigator || !isSecureTarget(target)) {
    return undefined;
  }

  const host = target as ModelContextHost;
  if (hasCompatibleRegistry(host[MODEL_CONTEXT_INSTANCE_SYMBOL])) {
    return host[MODEL_CONTEXT_INSTANCE_SYMBOL];
  }

  if ('modelContext' in target.navigator) {
    const existing = (target.navigator as Navigator & { modelContext?: unknown }).modelContext;
    if (hasCompatibleRegistry(existing)) {
      host[MODEL_CONTEXT_INSTANCE_SYMBOL] = existing;
      return existing;
    }

    const instance = host[MODEL_CONTEXT_INSTANCE_SYMBOL] ?? new ModelContext();
    host[MODEL_CONTEXT_INSTANCE_SYMBOL] = instance;

    Object.defineProperty(target.navigator, 'modelContext', {
      configurable: true,
      enumerable: true,
      get() {
        return instance;
      },
    });

    return instance;
  }

  const instance = host[MODEL_CONTEXT_INSTANCE_SYMBOL] ?? new ModelContext();
  host[MODEL_CONTEXT_INSTANCE_SYMBOL] = instance;

  Object.defineProperty(target.navigator, 'modelContext', {
    configurable: true,
    enumerable: true,
    get() {
      return instance;
    },
  });

  return instance;
}