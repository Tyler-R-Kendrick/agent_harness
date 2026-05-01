import type { ToolRegistry } from './tools.js';

export type CommandGroups = Record<string, string>;

export interface CommandMatch {
  input: string;
  match: RegExpExecArray;
  groups: CommandGroups;
}

export interface CommandArgInferenceRequest {
  commandId: string;
  input: string;
  groups: CommandGroups;
}

export type CommandArgInference = (
  request: CommandArgInferenceRequest,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export type CommandTarget =
  | {
      type: 'handler';
      run: (args: Record<string, unknown>, context: CommandExecutionContext) => Promise<unknown> | unknown;
    }
  | {
      type: 'tool';
      toolId: string;
    }
  | {
      type: 'prompt';
      prompt: string | ((args: Record<string, unknown>, match: CommandMatch) => string);
    }
  | {
      type: 'prompt-template';
      template: (args: Record<string, unknown>, match: CommandMatch) => string;
    };

export interface Command {
  id: string;
  usage?: string;
  description: string;
  pattern: RegExp;
  target: CommandTarget;
  parseArgs?: (match: CommandMatch) => Record<string, unknown> | undefined;
}

export interface CommandRegistryOptions {
  tools?: ToolRegistry;
}

export interface CommandExecutionContext {
  tools?: ToolRegistry;
  inferArgs?: CommandArgInference;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export type CommandExecutionResult =
  | { matched: false }
  | { matched: true; commandId: string; result: unknown };

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  constructor(private readonly options: CommandRegistryOptions = {}) {}

  register(command: Command): void {
    if (this.commands.has(command.id)) {
      throw new Error(`Command already registered: ${command.id}`);
    }
    this.commands.set(command.id, command);
  }

  list(): Command[] {
    return [...this.commands.values()];
  }

  match(input: string): { command: Command; match: CommandMatch } | undefined {
    for (const command of this.commands.values()) {
      command.pattern.lastIndex = 0;
      const match = command.pattern.exec(input);
      if (match) {
        return {
          command,
          match: {
            input,
            match,
            groups: { ...(match.groups ?? {}) },
          },
        };
      }
    }
    return undefined;
  }

  async execute(
    input: string,
    context: Omit<CommandExecutionContext, 'tools'> & { tools?: ToolRegistry } = {},
  ): Promise<CommandExecutionResult> {
    const matched = this.match(input);
    if (!matched) return { matched: false };

    const args = matched.command.parseArgs?.(matched.match)
      ?? await context.inferArgs?.({
        commandId: matched.command.id,
        input,
        groups: matched.match.groups,
      })
      ?? {};
    const executionContext: CommandExecutionContext = {
      ...context,
      tools: context.tools ?? this.options.tools,
    };

    return {
      matched: true,
      commandId: matched.command.id,
      result: await this.executeTarget(matched.command.target, args, matched.match, executionContext),
    };
  }

  private async executeTarget(
    target: CommandTarget,
    args: Record<string, unknown>,
    match: CommandMatch,
    context: CommandExecutionContext,
  ): Promise<unknown> {
    if (target.type === 'handler') return target.run(args, context);
    if (target.type === 'tool') {
      if (!context.tools) throw new Error(`Command tool target requires a tool registry: ${target.toolId}`);
      return context.tools.execute(target.toolId, args, context);
    }
    if (target.type === 'prompt') {
      return {
        type: 'prompt',
        prompt: typeof target.prompt === 'function' ? target.prompt(args, match) : target.prompt,
        args,
      };
    }
    return {
      type: 'prompt',
      prompt: target.template(args, match),
      args,
    };
  }
}
