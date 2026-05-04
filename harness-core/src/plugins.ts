import { ArtifactRegistry } from './artifacts.js';
import { CommandRegistry } from './commands.js';
import { createDefaultCommandRegistry } from './defaultCommands.js';
import { HookRegistry } from './hooks.js';
import { MemoryRegistry, type MemoryMessage } from './memory.js';
import { RendererRegistry } from './renderers.js';
import { type HarnessStorage, type HarnessStorageSource, resolveHarnessStorage } from './storage.js';
import { ToolRegistry } from './tools.js';

export interface HarnessExtensionContext<
  TMessage extends MemoryMessage = MemoryMessage,
  THookPayload = unknown,
> {
  hooks: HookRegistry<THookPayload>;
  commands: CommandRegistry;
  tools: ToolRegistry;
  memory: MemoryRegistry<TMessage>;
  storage: HarnessStorage;
  artifacts: ArtifactRegistry;
  renderers: RendererRegistry;
  plugins: PluginRegistry<TMessage, THookPayload>;
}

export interface HarnessPlugin<
  TMessage extends MemoryMessage = MemoryMessage,
  THookPayload = unknown,
> {
  id: string;
  register: (context: HarnessExtensionContext<TMessage, THookPayload>) => Promise<void> | void;
}

export class PluginRegistry<
  TMessage extends MemoryMessage = MemoryMessage,
  THookPayload = unknown,
> {
  private readonly plugins = new Map<string, HarnessPlugin<TMessage, THookPayload>>();

  constructor(private readonly context: HarnessExtensionContext<TMessage, THookPayload>) {}

  async load(plugin: HarnessPlugin<TMessage, THookPayload>): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin already registered: ${plugin.id}`);
    }
    await plugin.register(this.context);
    this.plugins.set(plugin.id, plugin);
  }

  async loadAll(plugins: readonly HarnessPlugin<TMessage, THookPayload>[]): Promise<void> {
    for (const plugin of plugins) {
      await this.load(plugin);
    }
  }

  get(id: string): HarnessPlugin<TMessage, THookPayload> | undefined {
    return this.plugins.get(id);
  }

  list(): HarnessPlugin<TMessage, THookPayload>[] {
    return [...this.plugins.values()];
  }
}

export interface CreateHarnessExtensionContextOptions {
  storage?: HarnessStorageSource;
  artifacts?: ArtifactRegistry;
}

export function createHarnessExtensionContext<
  TMessage extends MemoryMessage = MemoryMessage,
  THookPayload = unknown,
>(
  options: CreateHarnessExtensionContextOptions = {},
): HarnessExtensionContext<TMessage, THookPayload> {
  const tools = new ToolRegistry();
  const storage = options.storage === undefined
    ? options.artifacts?.storage ?? resolveHarnessStorage()
    : resolveHarnessStorage(options.storage);
  const context = {
    hooks: new HookRegistry<THookPayload>(),
    commands: createDefaultCommandRegistry({ tools }),
    tools,
    memory: new MemoryRegistry<TMessage>(),
    storage,
    artifacts: options.artifacts ?? new ArtifactRegistry({ storage }),
    renderers: new RendererRegistry(),
  } as Omit<HarnessExtensionContext<TMessage, THookPayload>, 'plugins'> & {
    plugins?: PluginRegistry<TMessage, THookPayload>;
  };
  context.plugins = new PluginRegistry(context as HarnessExtensionContext<TMessage, THookPayload>);
  return context as HarnessExtensionContext<TMessage, THookPayload>;
}

export type InferenceMessagesPayload<TMessage extends MemoryMessage = MemoryMessage> = {
  messages: TMessage[];
};
