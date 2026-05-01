import {
  CommandRegistry,
  type Command,
  type CommandExecutionContext,
  type CommandRegistryOptions,
} from './commands.js';
import {
  SettingsRegistry,
  createSettingsRegistry,
  type HarnessSettingsInput,
  type HarnessSettingDefinition,
} from './settings.js';
import type { HarnessToolContext } from './tools.js';

export const HARNESS_CORE_VERSION = '0.1.0';

export type DefaultCommandId = 'help' | 'update' | 'config' | 'version' | 'tool';

export interface DefaultCommandInfo {
  id: DefaultCommandId | string;
  usage: string;
  description: string;
}

export interface DefaultCommandOptions extends CommandRegistryOptions {
  version?: string;
  config?: Record<string, unknown>;
  settings?: HarnessSettingsInput;
  update?: HarnessUpdateHandler;
}

export type HarnessUpdateHandler = (
  context: CommandExecutionContext,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

type ConfigCommandArgs =
  | { action: 'list' }
  | { action: 'get'; key: string }
  | { action: 'set'; key: string; value: unknown };

const DEFAULT_COMMANDS: readonly DefaultCommandInfo[] = [
  { id: 'help', usage: '/help [command]', description: 'List available commands.' },
  { id: 'update', usage: '/update', description: 'Check for harness updates and apply them.' },
  { id: 'config', usage: '/config [key|key=value]', description: 'Read or change harness settings.' },
  { id: 'version', usage: '/version', description: 'Show the current harness version.' },
  {
    id: 'tool',
    usage: 'tool:<tool-name>(<param>=<value>, ...)',
    description: 'Invoke a registered tool directly.',
  },
];

export function createDefaultCommandRegistry(options: DefaultCommandOptions = {}): CommandRegistry {
  return registerDefaultCommands(new CommandRegistry({ tools: options.tools }), options);
}

export function registerDefaultCommands(
  registry: CommandRegistry,
  options: DefaultCommandOptions = {},
): CommandRegistry {
  const settings = createSettingsRegistry(options.settings, options.config);
  for (const command of createDefaultCommands(registry, settings, options)) {
    registry.register(command);
  }
  return registry;
}

function createDefaultCommands(
  registry: CommandRegistry,
  settings: SettingsRegistry,
  options: DefaultCommandOptions,
): Command[] {
  const version = options.version ?? HARNESS_CORE_VERSION;

  return [
    {
      ...DEFAULT_COMMANDS[0],
      pattern: /^\/help(?:\s+(?<topic>[a-z0-9_.:-]+))?$/i,
      target: {
        type: 'handler',
        run: (args) => createHelpResult(registry, String(args.topic ?? '')),
      },
      parseArgs: ({ groups }) => ({ topic: groups.topic }),
    },
    {
      ...DEFAULT_COMMANDS[1],
      pattern: /^\/update$/i,
      target: {
        type: 'handler',
        run: (_args, context) => runUpdateCommand(options.update, context),
      },
    },
    {
      ...DEFAULT_COMMANDS[2],
      pattern: /^\/config(?:\s+(?<expression>.*))?$/i,
      target: {
        type: 'handler',
        run: (args) => runConfigCommand(args as ConfigCommandArgs, settings),
      },
      parseArgs: ({ groups }) => parseConfigExpression(groups.expression ?? ''),
    },
    {
      ...DEFAULT_COMMANDS[3],
      pattern: /^\/version$/i,
      target: {
        type: 'handler',
        run: () => ({
          type: 'version',
          name: 'harness-core',
          version,
          text: `harness-core ${version}`,
        }),
      },
    },
    {
      ...DEFAULT_COMMANDS[4],
      pattern: /^tool:(?<toolName>[a-z0-9_.:-]+)\((?<args>[\s\S]*)\)$/i,
      target: {
        type: 'handler',
        run: (args, context) => runToolCommand(args as { toolName: string; args: Record<string, unknown> }, context),
      },
      parseArgs: ({ groups }) => ({
        toolName: groups.toolName,
        args: parseToolArgs(groups.args),
      }),
    },
  ];
}

function createHelpResult(registry: CommandRegistry, topic: string): {
  type: 'help';
  commands: DefaultCommandInfo[];
  text: string;
} {
  const commands = registry.list().map(commandInfoFor);
  const filtered = topic ? commands.filter((command) => command.id === topic) : commands;
  return {
    type: 'help',
    commands: filtered,
    text: formatHelpText(filtered),
  };
}

function commandInfoFor(command: Command): DefaultCommandInfo {
  return {
    id: command.id,
    usage: command.usage ?? `/${command.id}`,
    description: command.description,
  };
}

function formatHelpText(commands: readonly DefaultCommandInfo[]): string {
  if (commands.length === 1) {
    const command = commands[0];
    return `${command.usage} - ${command.description}`;
  }
  return [
    'Available commands:',
    ...commands.map((command) => `  ${command.usage} - ${command.description}`),
  ].join('\n');
}

async function runUpdateCommand(
  update: HarnessUpdateHandler | undefined,
  context: CommandExecutionContext,
): Promise<Record<string, unknown>> {
  if (!update) {
    return {
      type: 'update',
      status: 'unavailable',
      text: 'No harness update handler is configured.',
    };
  }

  return {
    type: 'update',
    ...await update(normalizeCommandContext(context)),
  };
}

function parseConfigExpression(expression: string): ConfigCommandArgs {
  const trimmed = expression.trim();
  if (!trimmed) return { action: 'list' };

  const assignment = trimmed.startsWith('set ') ? trimmed.slice(4).trim() : trimmed;
  const equalsIndex = assignment.indexOf('=');
  if (equalsIndex >= 0) {
    const key = assignment.slice(0, equalsIndex).trim();
    if (!key) throw new Error('Expected config key before "=".');
    return {
      action: 'set',
      key,
      value: parseValue(assignment.slice(equalsIndex + 1)),
    };
  }

  if (trimmed.startsWith('set ')) {
    throw new Error('Expected config assignment like /config set key=value.');
  }

  return { action: 'get', key: trimmed };
}

function runConfigCommand(
  args: ConfigCommandArgs,
  settings: SettingsRegistry,
): Record<string, unknown> {
  if (args.action === 'set') {
    const value = settings.set(args.key, args.value);
    return {
      type: 'config',
      action: 'set',
      key: args.key,
      value,
      settings: settings.entries(),
      ...settingDefinitionPayload(settings, args.key),
      text: `${args.key}=${settings.format(args.key, value)}`,
    };
  }

  if (args.action === 'get') {
    const value = settings.get(args.key);
    return {
      type: 'config',
      action: 'get',
      key: args.key,
      value,
      ...settingDefinitionPayload(settings, args.key),
      text: `${args.key}=${settings.format(args.key, value)}`,
    };
  }

  const listed = settings.entries();
  return {
    type: 'config',
    action: 'list',
    settings: listed,
    ...settingDefinitionsPayload(settings),
    text: formatSettings(settings, listed),
  };
}

async function runToolCommand(
  args: { toolName: string; args: Record<string, unknown> },
  context: CommandExecutionContext,
): Promise<unknown> {
  if (!context.tools) {
    throw new Error(`Default tool command requires a tool registry: ${args.toolName}`);
  }
  return context.tools.execute(args.toolName, args.args, normalizeToolContext(context));
}

function parseToolArgs(input: string): Record<string, unknown> {
  const trimmed = input.trim();
  if (!trimmed) return {};

  return Object.fromEntries(splitAssignments(trimmed).map(parseAssignment));
}

function splitAssignments(input: string): string[] {
  const assignments: string[] = [];
  let current = '';
  let quote = '';
  let depth = 0;

  for (const character of input) {
    if (quote) {
      current += character;
      if (character === quote) quote = '';
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }

    if (character === '[' || character === '{') {
      depth += 1;
      current += character;
      continue;
    }

    if (character === ']' || character === '}') {
      depth -= 1;
      current += character;
      continue;
    }

    if (character === ',' && depth === 0) {
      assignments.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  assignments.push(current);
  return assignments;
}

function parseAssignment(assignment: string): [string, unknown] {
  const equalsIndex = assignment.indexOf('=');
  if (equalsIndex < 1) throw new Error(`Expected tool argument assignment: ${assignment.trim()}`);

  const key = assignment.slice(0, equalsIndex).trim();
  const value = parseValue(assignment.slice(equalsIndex + 1));
  return [key, value];
}

function parseValue(raw: string): unknown {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (isQuoted(value)) return value.slice(1, -1);
  if (isJsonValue(value)) return parseJsonValue(value);
  if (isNumberLiteral(value)) return Number(value);
  return value;
}

function isQuoted(value: string): boolean {
  return (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"));
}

function isJsonValue(value: string): boolean {
  return (value.startsWith('{') && value.endsWith('}'))
    || (value.startsWith('[') && value.endsWith(']'));
}

function parseJsonValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid JSON value: ${value}`, { cause: error });
  }
}

function isNumberLiteral(value: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(value);
}

function formatSettings(registry: SettingsRegistry, settings: Record<string, unknown>): string {
  const entries = Object.entries(settings);
  if (entries.length === 0) return 'No settings configured.';
  return entries.map(([key, value]) => `${key}=${registry.format(key, value)}`).join('\n');
}

function settingDefinitionPayload(
  settings: SettingsRegistry,
  key: string,
): { definition?: HarnessSettingDefinition } {
  const definition = settings.getDefinition(key);
  return definition ? { definition } : {};
}

function settingDefinitionsPayload(
  settings: SettingsRegistry,
): { definitions?: HarnessSettingDefinition[] } {
  return settings.hasDefinitions() ? { definitions: settings.listDefinitions() } : {};
}

function normalizeCommandContext(context: CommandExecutionContext): CommandExecutionContext {
  return {
    ...context,
    metadata: context.metadata ?? {},
  };
}

function normalizeToolContext(context: CommandExecutionContext): HarnessToolContext {
  return {
    metadata: context.metadata ?? {},
    signal: context.signal,
  };
}
