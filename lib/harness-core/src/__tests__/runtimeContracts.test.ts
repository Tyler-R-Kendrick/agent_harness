import { describe, expect, it, vi } from 'vitest';
import { PayloadType, type PolicyPayload } from 'logact';
import {
  CommandRegistry,
  HookRegistry,
  MemoryRegistry,
  ToolRegistry,
  appendMemoryMessage,
  createAgentBus,
  createAgentRuntime,
  createAgentsMdHookPlugin,
  createHarnessExtensionContext,
  createMemory,
  readAgentBusEntries,
  runActorWorkflow,
  type MemoryMessage,
} from '../index.js';

describe('runtime extension contracts', () => {
  it('uses commands as the direct-execution registry and routes explicit regex matches', async () => {
    const tools = new ToolRegistry();
    tools.register({
      id: 'lookup',
      description: 'Look up a topic.',
      execute: (args) => ({ topic: (args as { topic: string }).topic }),
    });
    const commands = new CommandRegistry({ tools });

    commands.register({
      id: 'lookup',
      description: 'Look up docs directly.',
      pattern: /^\/lookup(?:\s+(?<topic>.*))?$/i,
      target: { type: 'tool', toolId: 'lookup' },
      parseArgs: ({ groups }) => groups.topic ? { topic: groups.topic } : undefined,
    });

    await expect(commands.execute('/lookup hooks')).resolves.toEqual({
      matched: true,
      commandId: 'lookup',
      result: { topic: 'hooks' },
    });
    await expect(commands.execute('/lookup', {
      inferArgs: async ({ commandId, input }) => ({ topic: `${commandId}:${input}` }),
    })).resolves.toEqual({
      matched: true,
      commandId: 'lookup',
      result: { topic: 'lookup:/lookup' },
    });
  });

  it('runs memory strategies through one common extension point', async () => {
    const memory = createMemory([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
    ]);
    const registry = new MemoryRegistry();

    registry.register({
      id: 'compact-last-message',
      operation: 'compact',
      run: ({ messages }) => ({
        messages: [messages.at(-1) ?? { role: 'system', content: 'empty' }],
        summary: 'kept latest',
      }),
    });
    registry.register({
      id: 'observe-last-message',
      operation: 'observe',
      run: ({ memory: current }) => ({
        observations: [{ latest: current.messages.at(-1)?.content }],
        metadata: { observed: true },
      }),
    });
    registry.register({
      id: 'summarize-transcript',
      operation: 'summarize',
      run: ({ messages }) => ({ summary: messages.map((message) => message.content).join(' -> ') }),
    });

    appendMemoryMessage(memory, { role: 'user', content: 'third' });
    await expect(registry.run('compact', memory)).resolves.toEqual({
      memory: { messages: [{ role: 'user', content: 'third' }], metadata: {} },
      summaries: ['kept latest'],
      observations: [],
    });
    await expect(registry.run('observe', memory)).resolves.toEqual({
      memory: { messages: memory.messages, metadata: { observed: true } },
      summaries: [],
      observations: [{ latest: 'third' }],
    });
    await expect(registry.run('summarize', memory)).resolves.toEqual({
      memory,
      summaries: ['first -> second -> third'],
      observations: [],
    });
  });

  it('orders, lists, and rejects duplicate memory strategies', async () => {
    const registry = new MemoryRegistry();
    const signal = new AbortController().signal;
    const calls: string[] = [];

    registry.register({
      id: 'observe-options',
      operation: 'observe',
      priority: -1,
      run: ({ metadata, signal: observedSignal }) => {
        calls.push(`options:${metadata.requestId}:${observedSignal === signal}`);
      },
    });
    registry.register({
      id: 'observe-a',
      operation: 'observe',
      priority: 5,
      run: () => {
        calls.push('a');
        return { summary: 'a' };
      },
    });
    registry.register({
      id: 'observe-b',
      operation: 'observe',
      priority: 5,
      run: () => {
        calls.push('b');
        return { summary: 'b' };
      },
    });
    registry.register({
      id: 'summarize-a',
      operation: 'summarize',
      run: () => ({ summary: 'summary-a' }),
    });
    registry.register({
      id: 'summarize-b',
      operation: 'summarize',
      run: () => ({ summary: 'summary-b' }),
    });

    expect(registry.get('observe-a')?.id).toBe('observe-a');
    expect(registry.list().map((strategy) => strategy.id)).toEqual([
      'observe-options',
      'observe-a',
      'observe-b',
      'summarize-a',
      'summarize-b',
    ]);
    expect(registry.forOperation('observe').map((strategy) => strategy.id)).toEqual(['observe-options', 'observe-a', 'observe-b']);
    expect(registry.forOperation('summarize').map((strategy) => strategy.id)).toEqual(['summarize-a', 'summarize-b']);
    expect(() => registry.register({
      id: 'observe-a',
      operation: 'observe',
      run: () => undefined,
    })).toThrow(/already registered/i);

    await expect(registry.run('observe', createMemory([{ content: 'hello' }]), {
      metadata: { requestId: 'r1' },
      signal,
    })).resolves.toEqual({
      memory: { messages: [{ content: 'hello' }], metadata: {} },
      summaries: ['a', 'b'],
      observations: [],
    });
    expect(calls).toEqual(['options:r1:true', 'a', 'b']);
  });

  it('executes middleware in parallel and pipes sequentially with cancellation', async () => {
    const hooks = new HookRegistry<{ text: string }>();
    const calls: string[] = [];

    hooks.registerMiddleware({
      id: 'audit-a',
      point: 'before-llm-messages',
      kind: 'deterministic',
      run: async ({ payload }) => {
        calls.push(`audit-a:${payload.text}`);
        return { payload: { text: 'ignored' }, output: 'a' };
      },
    });
    hooks.registerMiddleware({
      id: 'audit-b',
      point: 'before-llm-messages',
      kind: 'deterministic',
      run: ({ payload }) => {
        calls.push(`audit-b:${payload.text}`);
        return { output: 'b' };
      },
    });
    hooks.registerPipe({
      id: 'trim',
      point: 'before-llm-messages',
      kind: 'deterministic',
      priority: 1,
      run: ({ payload }) => ({ payload: { text: payload.text.trim() }, output: 'trimmed' }),
    });
    hooks.registerPipe({
      id: 'cancel',
      point: 'before-llm-messages',
      kind: 'deterministic',
      priority: 2,
      run: ({ payload }) => ({ cancel: true, reason: `blocked:${payload.text}`, output: 'cancelled' }),
    });
    hooks.registerPipe({
      id: 'skipped',
      point: 'before-llm-messages',
      kind: 'deterministic',
      priority: 3,
      run: () => {
        calls.push('skipped');
      },
    });

    const middleware = await hooks.runMiddleware('before-llm-messages', { text: '  hi  ' });
    const pipes = await hooks.runPipes('before-llm-messages', { text: '  hi  ' });

    expect(middleware).toEqual({
      payload: { text: '  hi  ' },
      outputs: [
        { hookId: 'audit-a', output: 'a' },
        { hookId: 'audit-b', output: 'b' },
      ],
    });
    expect(pipes).toEqual({
      payload: { text: 'hi' },
      canceled: true,
      stopped: true,
      bubbled: false,
      reason: 'blocked:hi',
      outputs: [
        { hookId: 'trim', output: 'trimmed' },
        { hookId: 'cancel', output: 'cancelled' },
      ],
    });
    expect(calls).toEqual(['audit-a:  hi  ', 'audit-b:  hi  ']);

    const bubblingHooks = new HookRegistry<string>();
    bubblingHooks.registerPipe({
      id: 'bubble',
      point: 'bubble',
      kind: 'deterministic',
      run: () => ({ bubble: true, output: 'bubbled' }),
    });
    bubblingHooks.registerPipe({
      id: 'after-bubble',
      point: 'bubble',
      kind: 'deterministic',
      run: () => {
        calls.push('after-bubble');
      },
    });

    await expect(bubblingHooks.runPipes('bubble', 'value')).resolves.toEqual({
      payload: 'value',
      stopped: false,
      canceled: false,
      bubbled: true,
      outputs: [{ hookId: 'bubble', output: 'bubbled' }],
    });
    expect(calls).not.toContain('after-bubble');
  });

  it('loads plugins through one extension point and injects AGENTS.md as a hook plugin', async () => {
    type Message = MemoryMessage & { role: 'system' | 'user' | 'assistant' };
    const context = createHarnessExtensionContext<Message, { messages: Message[] }>();
    const plugins = context.plugins;

    await plugins.load({
      id: 'demo',
      register(runtime) {
        runtime.tools.register({
          id: 'demo-tool',
          description: 'Demo tool.',
          execute: () => 'tool-result',
        });
        runtime.commands.register({
          id: 'demo',
          description: 'Demo command.',
          pattern: /^\/demo$/,
          target: { type: 'tool', toolId: 'demo-tool' },
        });
        runtime.memory.register({
          id: 'demo-observer',
          operation: 'observe',
          run: () => ({ observations: ['observed'] }),
        });
        runtime.hooks.registerMiddleware({
          id: 'demo-audit',
          point: 'after-tool',
          kind: 'deterministic',
          run: () => ({ output: 'audited' }),
        });
      },
    });
    await plugins.load(createAgentsMdHookPlugin<Message>([
      { path: 'AGENTS.md', content: '# Root\nUse TDD.' },
    ]));

    await expect(context.commands.execute('/demo')).resolves.toEqual({
      matched: true,
      commandId: 'demo',
      result: 'tool-result',
    });
    await expect(context.memory.run('observe', createMemory<Message>([]))).resolves.toEqual({
      memory: { messages: [], metadata: {} },
      summaries: [],
      observations: ['observed'],
    });
    await expect(context.hooks.runMiddleware('after-tool', { messages: [] })).resolves.toEqual({
      payload: { messages: [] },
      outputs: [{ hookId: 'demo-audit', output: 'audited' }],
    });

    const prepared = await context.hooks.runPipes('before-llm-messages', {
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(prepared.payload.messages[0]).toEqual(expect.objectContaining({
      role: 'system',
      content: expect.stringContaining('Use TDD.'),
    }));
    expect(prepared.payload.messages[1]).toEqual({ role: 'user', content: 'hello' });
    expect(plugins.list().map((plugin) => plugin.id)).toEqual(['demo', 'agents-md']);

    const batchContext = createHarnessExtensionContext();
    await batchContext.plugins.loadAll([
      { id: 'one', register: () => undefined },
      { id: 'two', register: async () => undefined },
    ]);
    expect(batchContext.plugins.get('one')?.id).toBe('one');
    expect(batchContext.plugins.list().map((plugin) => plugin.id)).toEqual(['one', 'two']);
    await expect(batchContext.plugins.load({ id: 'one', register: () => undefined })).rejects.toThrow(/already registered/i);
  });

  it('runs agents and subagents through xstate actors while writing to the AgentBus event store', async () => {
    const bus = createAgentBus();
    const runtime = createAgentRuntime<string, string>({
      bus,
      agent: {
        id: 'parent',
        instructions: 'Parent instructions.',
        async run(input, context) {
          expect(context.instructions).toBe('Parent instructions.');
          const childOutput = await context.runSubagent<string, string>({
            id: 'child',
            instructions: 'Child instructions.',
            run: (childInput, childContext) => {
              expect(childContext.parentActorId).toBe('parent');
              return `${childInput}:child`;
            },
          }, `${input}:sub`);
          return `${childOutput}:parent`;
        },
      },
    });

    await expect(runtime.run('task')).resolves.toBe('task:sub:child:parent');
    await expect(runtime.runSubagent({
      id: 'external-child',
      instructions: 'External child instructions.',
      run: (input) => `${input}:external`,
    }, 'direct')).resolves.toBe('direct:external');
    await expect(runActorWorkflow({
      actorId: 'failing',
      input: 'task',
      bus,
      run: () => {
        throw new Error('boom');
      },
    })).rejects.toThrow('boom');

    const entries = await readAgentBusEntries(bus);
    const policyEvents = entries
      .map((entry) => entry.payload)
      .filter((payload): payload is PolicyPayload => payload.type === PayloadType.Policy);

    expect(policyEvents.map((event) => event.target)).toEqual(expect.arrayContaining([
      'harness.actor.workflow.started',
      'harness.agent.instructions',
      'harness.actor.workflow.completed',
      'harness.actor.workflow.failed',
    ]));
    expect(policyEvents).toContainEqual(expect.objectContaining({
      target: 'harness.agent.instructions',
      value: expect.objectContaining({
        actorId: 'child',
        parentActorId: 'parent',
        instructions: 'Child instructions.',
      }),
    }));
  });
});
