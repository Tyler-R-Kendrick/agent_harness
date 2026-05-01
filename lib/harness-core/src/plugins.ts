import { buildAgentsPromptContext, type WorkspaceFile } from './agents.js';
import { CommandRegistry } from './commands.js';
import { createDefaultCommandRegistry } from './defaultCommands.js';
import { HookRegistry } from './hooks.js';
import { MemoryRegistry, type MemoryMessage } from './memory.js';
import { ToolRegistry } from './tools.js';

export interface HarnessExtensionContext<
  TMessage extends MemoryMessage = MemoryMessage,
  THookPayload = unknown,
> {
  hooks: HookRegistry<THookPayload>;
  commands: CommandRegistry;
  tools: ToolRegistry;
  memory: MemoryRegistry<TMessage>;
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

export function createHarnessExtensionContext<
  TMessage extends MemoryMessage = MemoryMessage,
  THookPayload = unknown,
>(): HarnessExtensionContext<TMessage, THookPayload> {
  const tools = new ToolRegistry();
  const context = {
    hooks: new HookRegistry<THookPayload>(),
    commands: createDefaultCommandRegistry({ tools }),
    tools,
    memory: new MemoryRegistry<TMessage>(),
  } as Omit<HarnessExtensionContext<TMessage, THookPayload>, 'plugins'> & {
    plugins?: PluginRegistry<TMessage, THookPayload>;
  };
  context.plugins = new PluginRegistry(context as HarnessExtensionContext<TMessage, THookPayload>);
  return context as HarnessExtensionContext<TMessage, THookPayload>;
}

export type InferenceMessagesPayload<TMessage extends MemoryMessage = MemoryMessage> = {
  messages: TMessage[];
};

export interface AgentsMdHookPluginOptions {
  point?: string;
  activeAgentPath?: string;
  priority?: number;
  role?: string;
}

export function createAgentsMdHookPlugin<TMessage extends MemoryMessage = MemoryMessage>(
  files: readonly WorkspaceFile[],
  options: AgentsMdHookPluginOptions = {},
): HarnessPlugin<TMessage, InferenceMessagesPayload<TMessage>> {
  return {
    id: 'agents-md',
    register({ hooks }) {
      hooks.registerPipe({
        id: 'agents-md',
        point: options.point ?? 'before-llm-messages',
        kind: 'deterministic',
        priority: options.priority ?? -10_000,
        run: ({ payload }) => ({
          payload: {
            ...payload,
            messages: [
              {
                role: options.role ?? 'system',
                content: buildAgentsPromptContext(files, { activeAgentPath: options.activeAgentPath }),
              } as unknown as TMessage,
              ...payload.messages,
            ],
          },
        }),
      });
    },
  };
}
