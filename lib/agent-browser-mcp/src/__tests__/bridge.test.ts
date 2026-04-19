import { describe, expect, it, vi } from 'vitest';
import { ModelContext, ModelContextClient } from 'webmcp';

import { createWebMcpToolBridge } from '../bridge';

describe('createWebMcpToolBridge', () => {
  it('exposes registered WebMCP tools as descriptors and AI SDK tools', async () => {
    const modelContext = new ModelContext();
    const createClient = vi.fn(() => new ModelContextClient());
    const execute = vi.fn(async ({ text }: { text: string }, _client: ModelContextClient) => ({ echoed: text }));

    modelContext.registerTool({
      name: 'echo',
      title: 'Echo',
      description: 'Echo text from the page.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
      },
      execute: async (input, client) => execute(input as { text: string }, client),
    });

    const bridge = createWebMcpToolBridge(modelContext, { createClient });
    const descriptors = bridge.getDescriptors();
    const tools = bridge.createToolSet();

    expect(descriptors).toEqual([
      {
        id: 'webmcp:echo',
        label: 'Echo',
        description: 'Echo text from the page.',
        group: 'webmcp',
        groupLabel: 'WebMCP',
      },
    ]);

    await expect(tools['webmcp:echo']?.execute?.({ text: 'hello' }, {} as never)).resolves.toEqual({ echoed: 'hello' });
    expect(createClient).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith({ text: 'hello' }, expect.any(ModelContextClient));
  });

  it('notifies subscribers when the WebMCP registry changes', () => {
    const modelContext = new ModelContext();
    const bridge = createWebMcpToolBridge(modelContext);
    const listener = vi.fn();
    const unsubscribe = bridge.subscribe(listener);
    const controller = new AbortController();

    modelContext.registerTool({
      name: 'search',
      description: 'Search the current page.',
      execute: async () => 'done',
    }, { signal: controller.signal });

    expect(listener).toHaveBeenCalledOnce();

    controller.abort();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('gracefully exposes no tools for foreign modelContext objects without a registry', () => {
    const foreignModelContext = {} as ModelContext;
    const bridge = createWebMcpToolBridge(foreignModelContext);

    expect(bridge.getDescriptors()).toEqual([]);
    expect(bridge.createToolSet()).toEqual({});
    expect(() => bridge.subscribe(() => undefined)).not.toThrow();
  });

  it('uses default input schema when tool has no inputSchema', async () => {
    const modelContext = new ModelContext();
    modelContext.registerTool({
      name: 'noschema',
      description: 'A tool without an input schema.',
      execute: async () => 'result',
    });

    const bridge = createWebMcpToolBridge(modelContext);
    const tools = bridge.createToolSet();
    const descriptors = bridge.getDescriptors();

    // No title — label should fall back to the tool name
    expect(descriptors[0]?.label).toBe('noschema');

    await expect(tools['webmcp:noschema']?.execute?.({}, {} as never)).resolves.toBe('result');
  });

  it('throws when tool input is not an object', async () => {
    const modelContext = new ModelContext();
    modelContext.registerTool({
      name: 'typed',
      description: 'A typed tool.',
      execute: async () => 'ok',
    });

    const bridge = createWebMcpToolBridge(modelContext);
    const tools = bridge.createToolSet();

    // Simulate invalid input through the bridge by bypassing the AI SDK tool wrapper
    // and calling the underlying execute directly with a non-object via the internal path.
    // The toInvocationInput guard is exercised when invokeModelContextTool receives it.
    const tool = tools['webmcp:typed'] as { execute?: (input: unknown, options: never) => Promise<unknown> } | undefined;
    await expect(tool?.execute?.(null, {} as never)).rejects.toThrow(TypeError);
  });
});
