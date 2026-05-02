import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  CommandRegistry,
  ToolRegistry,
  createDefaultCommandRegistry,
  createHarnessExtensionContext,
  registerDefaultCommands,
} from '../index.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as { version: string };

describe('default harness commands', () => {
  it('registers help and version commands with the current harness-core version', async () => {
    const registry = createDefaultCommandRegistry();

    await expect(registry.execute('/help')).resolves.toEqual({
      matched: true,
      commandId: 'help',
      result: {
        type: 'help',
        commands: [
          { id: 'help', usage: '/help [command]', description: 'List available commands.' },
          { id: 'update', usage: '/update', description: 'Check for harness updates and apply them.' },
          { id: 'config', usage: '/config [key|key=value]', description: 'Read or change harness settings.' },
          { id: 'version', usage: '/version', description: 'Show the current harness version.' },
          { id: 'tool', usage: 'tool:<tool-name>(<param>=<value>, ...)', description: 'Invoke a registered tool directly.' },
        ],
        text: [
          'Available commands:',
          '  /help [command] - List available commands.',
          '  /update - Check for harness updates and apply them.',
          '  /config [key|key=value] - Read or change harness settings.',
          '  /version - Show the current harness version.',
          '  tool:<tool-name>(<param>=<value>, ...) - Invoke a registered tool directly.',
        ].join('\n'),
      },
    });

    await expect(registry.execute('/help version')).resolves.toEqual({
      matched: true,
      commandId: 'help',
      result: {
        type: 'help',
        commands: [
          { id: 'version', usage: '/version', description: 'Show the current harness version.' },
        ],
        text: '/version - Show the current harness version.',
      },
    });

    await expect(registry.execute('/version')).resolves.toEqual({
      matched: true,
      commandId: 'version',
      result: {
        type: 'version',
        name: 'harness-core',
        version: packageJson.version,
        text: `harness-core ${packageJson.version}`,
      },
    });
  });

  it('reads and changes settings through the config command', async () => {
    const registry = createDefaultCommandRegistry({
      config: {
        theme: 'dark',
        retries: 2,
      },
    });

    await expect(registry.execute('/config')).resolves.toEqual({
      matched: true,
      commandId: 'config',
      result: {
        type: 'config',
        action: 'list',
        settings: { retries: 2, theme: 'dark' },
        text: 'retries=2\ntheme=dark',
      },
    });

    await expect(registry.execute('/config theme')).resolves.toEqual({
      matched: true,
      commandId: 'config',
      result: {
        type: 'config',
        action: 'get',
        key: 'theme',
        value: 'dark',
        text: 'theme=dark',
      },
    });

    await expect(registry.execute('/config set retries=3')).resolves.toEqual({
      matched: true,
      commandId: 'config',
      result: {
        type: 'config',
        action: 'set',
        key: 'retries',
        value: 3,
        settings: { retries: 3, theme: 'dark' },
        text: 'retries=3',
      },
    });

    await expect(registry.execute('/config theme=light')).resolves.toMatchObject({
      matched: true,
      commandId: 'config',
      result: {
        type: 'config',
        action: 'set',
        key: 'theme',
        value: 'light',
        settings: { retries: 3, theme: 'light' },
      },
    });

    await expect(registry.execute('/config set invalid')).rejects.toThrow(/Expected config assignment/i);
    await expect(registry.execute('/config =value')).rejects.toThrow(/Expected config key/i);

    await expect(createDefaultCommandRegistry().execute('/config')).resolves.toEqual({
      matched: true,
      commandId: 'config',
      result: {
        type: 'config',
        action: 'list',
        settings: {},
        text: 'No settings configured.',
      },
    });
  });

  it('validates and describes typed settings supplied through the settings option', async () => {
    const registry = createDefaultCommandRegistry({
      settings: {
        definitions: [
          { key: 'theme', type: 'enum', values: ['dark', 'light'], defaultValue: 'dark', description: 'UI theme.' },
          { key: 'maxTurns', type: 'integer', defaultValue: 3 },
          { key: 'approvalRequired', type: 'boolean', defaultValue: false },
        ],
        values: { maxTurns: 4 },
      },
    });

    await expect(registry.execute('/config')).resolves.toEqual({
      matched: true,
      commandId: 'config',
      result: {
        type: 'config',
        action: 'list',
        settings: { approvalRequired: false, maxTurns: 4, theme: 'dark' },
        definitions: [
          { key: 'approvalRequired', type: 'boolean', defaultValue: false },
          { key: 'maxTurns', type: 'integer', defaultValue: 3 },
          { key: 'theme', type: 'enum', values: ['dark', 'light'], defaultValue: 'dark', description: 'UI theme.' },
        ],
        text: 'approvalRequired=false\nmaxTurns=4\ntheme=dark',
      },
    });

    await expect(registry.execute('/config approvalRequired=true')).resolves.toMatchObject({
      matched: true,
      commandId: 'config',
      result: {
        type: 'config',
        action: 'set',
        key: 'approvalRequired',
        value: true,
        text: 'approvalRequired=true',
      },
    });
    await expect(registry.execute('/config set maxTurns=2.5')).rejects.toThrow(/integer/i);
    await expect(registry.execute('/config theme=blue')).rejects.toThrow(/dark, light/i);
  });

  it('allows hosts to register custom setting types for config command values', async () => {
    const registry = createDefaultCommandRegistry({
      settings: {
        types: [
          {
            id: 'percentage',
            parse(value: unknown) {
              const parsed = Number(value);
              if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
                throw new Error('Expected a percentage between 0 and 100.');
              }
              return parsed / 100;
            },
            format(value: unknown) {
              return `${Number(value) * 100}%`;
            },
          },
        ],
        definitions: [
          { key: 'confidence', type: 'percentage', defaultValue: 0.75 },
        ],
      },
    });

    await expect(registry.execute('/config confidence=80')).resolves.toMatchObject({
      matched: true,
      commandId: 'config',
      result: {
        type: 'config',
        action: 'set',
        key: 'confidence',
        value: 0.8,
        settings: { confidence: 0.8 },
        text: 'confidence=80%',
      },
    });
    await expect(registry.execute('/config')).resolves.toMatchObject({
      matched: true,
      commandId: 'config',
      result: {
        settings: { confidence: 0.8 },
        text: 'confidence=80%',
      },
    });
    await expect(registry.execute('/config confidence=101')).rejects.toThrow(/percentage/i);
  });

  it('runs update handlers and reports when no updater is configured', async () => {
    const applyUpdate = vi.fn(async () => ({ status: 'updated', version: '0.2.0' }));
    const registry = createDefaultCommandRegistry({ update: applyUpdate });

    await expect(registry.execute('/update')).resolves.toEqual({
      matched: true,
      commandId: 'update',
      result: {
        type: 'update',
        status: 'updated',
        version: '0.2.0',
      },
    });
    expect(applyUpdate).toHaveBeenCalledWith(expect.objectContaining({
      metadata: {},
      tools: undefined,
    }));

    await expect(createDefaultCommandRegistry().execute('/update')).resolves.toEqual({
      matched: true,
      commandId: 'update',
      result: {
        type: 'update',
        status: 'unavailable',
        text: 'No harness update handler is configured.',
      },
    });
  });

  it('invokes tools through tool:name(param=value) syntax', async () => {
    const tools = new ToolRegistry();
    const execute = vi.fn((args: unknown) => args);
    tools.register({
      id: 'search-docs',
      description: 'Search docs.',
      execute,
    });
    const registry = createDefaultCommandRegistry({ tools });

    await expect(registry.execute('tool:search-docs(query="hello, docs",label=\'single quoted\',limit=3,exact=true,draft=false,nothing=null,filters=["api","cli"],meta={"source":"docs"})')).resolves.toEqual({
      matched: true,
      commandId: 'tool',
      result: {
        query: 'hello, docs',
        label: 'single quoted',
        limit: 3,
        exact: true,
        draft: false,
        nothing: null,
        filters: ['api', 'cli'],
        meta: { source: 'docs' },
      },
    });
    expect(execute).toHaveBeenCalledWith({
      query: 'hello, docs',
      label: 'single quoted',
      limit: 3,
      exact: true,
      draft: false,
      nothing: null,
      filters: ['api', 'cli'],
      meta: { source: 'docs' },
    }, {
      metadata: {},
      signal: undefined,
    });

    await expect(registry.execute('tool:search-docs()')).resolves.toEqual({
      matched: true,
      commandId: 'tool',
      result: {},
    });
    await expect(registry.execute('tool:search-docs(query={bad})')).rejects.toThrow(/Invalid JSON/i);
    await expect(registry.execute('tool:search-docs(query)')).rejects.toThrow(/Expected tool argument assignment/i);
    await expect(new CommandRegistry().execute('tool:search-docs(query=docs)')).resolves.toEqual({ matched: false });
    const noTools = createDefaultCommandRegistry();
    await expect(noTools.execute('tool:missing()')).rejects.toThrow(/requires a tool registry/i);
  });

  it('adds default commands to extension contexts and existing registries', async () => {
    const context = createHarnessExtensionContext();
    expect(context.commands.list().map((command) => command.id)).toEqual(['help', 'update', 'config', 'version', 'tool']);

    const registry = new CommandRegistry();
    expect(registerDefaultCommands(registry)).toBe(registry);
    expect(registry.list().map((command) => command.id)).toEqual(['help', 'update', 'config', 'version', 'tool']);
    registry.register({
      id: 'plain',
      description: 'Plain command without explicit usage.',
      pattern: /^\/plain$/,
      target: { type: 'handler', run: () => 'plain' },
    });
    await expect(registry.execute('/help plain')).resolves.toEqual({
      matched: true,
      commandId: 'help',
      result: {
        type: 'help',
        commands: [
          { id: 'plain', usage: '/plain', description: 'Plain command without explicit usage.' },
        ],
        text: '/plain - Plain command without explicit usage.',
      },
    });
  });
});
