import type { JsonValue, ToolDefinition, ToolProvider, ToolRuntimeContext } from './types.js';

export class CoreToolApi {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly providers = new Map<string, ToolProvider>();

  registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) throw new Error(`Tool already registered: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }

  registerProvider(provider: ToolProvider): void {
    if (this.providers.has(provider.id)) throw new Error(`Provider already registered: ${provider.id}`);
    this.providers.set(provider.id, provider);
  }

  listToolNames(): string[] {
    return [...this.tools.keys()].sort();
  }

  async execute(toolName: string, input: JsonValue, context: ToolRuntimeContext): Promise<JsonValue> {
    const tool = this.tools.get(toolName);
    if (!tool) throw new Error(`Unknown tool: ${toolName}`);

    const provider = [...this.providers.values()].find((candidate) => candidate.supports(tool));
    if (!provider) {
      throw new Error(`No provider registered for tool: ${toolName}`);
    }

    return provider.invoke(tool, input, context);
  }
}
