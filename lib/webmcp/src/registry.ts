import type { RegisteredToolDefinition, ToolRegistryChange, ToolRegistryListener } from './types';

export const MODEL_CONTEXT_REGISTRY_SYMBOL = Symbol.for('@agent-harness/webmcp/registry');

export class ToolRegistry {
  readonly #listeners = new Set<ToolRegistryListener>();

  readonly #toolMap = new Map<string, RegisteredToolDefinition>();

  get(name: string): RegisteredToolDefinition | undefined {
    return this.#toolMap.get(name);
  }

  has(name: string): boolean {
    return this.#toolMap.has(name);
  }

  list(): RegisteredToolDefinition[] {
    return [...this.#toolMap.values()];
  }

  register(tool: RegisteredToolDefinition): void {
    this.#toolMap.set(tool.name, tool);
    this.#emit({ type: 'register', tool });
  }

  subscribe(listener: ToolRegistryListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  unregister(name: string): boolean {
    const tool = this.#toolMap.get(name);
    if (!tool) {
      return false;
    }

    this.#toolMap.delete(name);
    this.#emit({ type: 'unregister', tool });
    return true;
  }

  #emit(change: ToolRegistryChange): void {
    for (const listener of this.#listeners) {
      listener(change);
    }
  }
}