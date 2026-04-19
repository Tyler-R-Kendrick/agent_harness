import type {
  PromptRegistryChange,
  PromptTemplateRegistryChange,
  RegisteredPromptDefinition,
  RegisteredPromptTemplateDefinition,
  RegisteredResourceDefinition,
  RegisteredToolDefinition,
  ResourceRegistryChange,
  ToolRegistryChange,
} from './types';

export const MODEL_CONTEXT_REGISTRY_SYMBOL = Symbol.for('@agent-harness/webmcp/registry');
export const MODEL_CONTEXT_RESOURCE_REGISTRY_SYMBOL = Symbol.for('@agent-harness/webmcp/resource-registry');
export const MODEL_CONTEXT_PROMPT_REGISTRY_SYMBOL = Symbol.for('@agent-harness/webmcp/prompt-registry');
export const MODEL_CONTEXT_PROMPT_TEMPLATE_REGISTRY_SYMBOL = Symbol.for('@agent-harness/webmcp/prompt-template-registry');

type RegistryChangeType = 'register' | 'unregister';

class ObservableRegistry<TItem, TChange> {
  readonly #listeners = new Set<(change: TChange) => void>();

  readonly #itemMap = new Map<string, TItem>();

  readonly #keyForItem: (item: TItem) => string;

  readonly #createChange: (type: RegistryChangeType, item: TItem) => TChange;

  constructor(keyForItem: (item: TItem) => string, createChange: (type: RegistryChangeType, item: TItem) => TChange) {
    this.#keyForItem = keyForItem;
    this.#createChange = createChange;
  }

  get(key: string): TItem | undefined {
    return this.#itemMap.get(key);
  }

  has(key: string): boolean {
    return this.#itemMap.has(key);
  }

  list(): TItem[] {
    return [...this.#itemMap.values()];
  }

  register(item: TItem): void {
    this.#itemMap.set(this.#keyForItem(item), item);
    this.#emit(this.#createChange('register', item));
  }

  subscribe(listener: (change: TChange) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  unregister(key: string): boolean {
    const item = this.#itemMap.get(key);
    if (!item) {
      return false;
    }

    this.#itemMap.delete(key);
    this.#emit(this.#createChange('unregister', item));
    return true;
  }

  #emit(change: TChange): void {
    for (const listener of this.#listeners) {
      listener(change);
    }
  }
}

export class ToolRegistry extends ObservableRegistry<RegisteredToolDefinition, ToolRegistryChange> {
  constructor() {
    super((tool) => tool.name, (type, tool) => ({ type, tool }));
  }
}

export class ResourceRegistry extends ObservableRegistry<RegisteredResourceDefinition, ResourceRegistryChange> {
  constructor() {
    super((resource) => resource.uri, (type, resource) => ({ type, resource }));
  }
}

export class PromptRegistry extends ObservableRegistry<RegisteredPromptDefinition, PromptRegistryChange> {
  constructor() {
    super((prompt) => prompt.name, (type, prompt) => ({ type, prompt }));
  }
}

export class PromptTemplateRegistry extends ObservableRegistry<RegisteredPromptTemplateDefinition, PromptTemplateRegistryChange> {
  constructor() {
    super((promptTemplate) => promptTemplate.name, (type, promptTemplate) => ({ type, promptTemplate }));
  }
}