export type HarnessJsonSchema =
  | boolean
  | {
      type?: string | string[];
      description?: string;
      properties?: Record<string, HarnessJsonSchema>;
      required?: string[];
      additionalProperties?: boolean | HarnessJsonSchema;
      items?: HarnessJsonSchema;
      enum?: unknown[];
      [key: string]: unknown;
    };

export type HarnessToolKind = 'function' | 'prompt' | 'prompt-template' | 'agent-skill';

export interface HarnessToolContext {
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export interface HarnessToolDefinition<TArgs = unknown, TResult = unknown> {
  id: string;
  name?: string;
  label?: string;
  description: string;
  kind?: HarnessToolKind;
  inputSchema?: HarnessJsonSchema;
  annotations?: Record<string, unknown>;
  execute?: (args: TArgs, context?: HarnessToolContext) => Promise<TResult> | TResult;
}

export interface HarnessToolSetEntry {
  description: string;
  inputSchema?: HarnessJsonSchema;
  execute?: (args: unknown, context?: HarnessToolContext) => Promise<unknown> | unknown;
}

export type HarnessToolSet = Record<string, HarnessToolSetEntry>;

export class ToolRegistry {
  private readonly tools = new Map<string, HarnessToolDefinition>();

  register(tool: HarnessToolDefinition): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool already registered: ${tool.id}`);
    }
    this.tools.set(tool.id, tool);
  }

  has(id: string): boolean {
    return this.tools.has(id);
  }

  get(id: string): HarnessToolDefinition | undefined {
    return this.tools.get(id);
  }

  list(): HarnessToolDefinition[] {
    return [...this.tools.values()];
  }

  async execute(id: string, args: unknown, context?: HarnessToolContext): Promise<unknown> {
    const tool = this.tools.get(id);
    if (!tool) throw new Error(`Unknown tool: ${id}`);
    if (!tool.execute) throw new Error(`Tool is not executable: ${id}`);
    return tool.execute(args, context);
  }

  toToolSet(): HarnessToolSet {
    return Object.fromEntries(this.list().map((tool) => {
      const execute = tool.execute;
      return [
        tool.id,
        {
          description: tool.description,
          ...(tool.inputSchema === undefined ? {} : { inputSchema: tool.inputSchema }),
          ...(execute ? { execute: (args: unknown, context?: HarnessToolContext) => execute(args, context) } : {}),
        },
      ];
    }));
  }
}

export function createPromptTemplateTool<TArgs = Record<string, unknown>>({
  id,
  description,
  template,
  inputSchema,
}: {
  id: string;
  description: string;
  template: (args: TArgs) => string;
  inputSchema?: HarnessJsonSchema;
}): HarnessToolDefinition<TArgs, { type: 'prompt'; prompt: string }> {
  return {
    id,
    description,
    kind: 'prompt-template',
    inputSchema,
    execute: (args) => ({
      type: 'prompt',
      prompt: template(args),
    }),
  };
}
