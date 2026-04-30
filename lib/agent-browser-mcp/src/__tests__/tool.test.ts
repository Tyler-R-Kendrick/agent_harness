import { describe, expect, it } from 'vitest';
import { ModelContext } from '@agent-harness/webmcp';

import { createWebMcpTool, WEBMCP_BUILTIN_DESCRIPTOR, WEBMCP_TOOL_ID } from '../tool';

describe('WEBMCP_BUILTIN_DESCRIPTOR', () => {
  it('has the correct id, label, group and groupLabel', () => {
    expect(WEBMCP_BUILTIN_DESCRIPTOR).toEqual({
      id: WEBMCP_TOOL_ID,
      label: 'WebMCP',
      description: 'Invoke tools registered by the current page via WebMCP.',
      group: 'built-in',
      groupLabel: 'Built-In',
    });
  });
});

describe('createWebMcpTool', () => {
  it('creates a tool that invokes a registered WebMCP tool', async () => {
    const modelContext = new ModelContext();
    modelContext.registerTool({
      name: 'ping',
      title: 'Ping',
      description: 'Pong.',
      inputSchema: { type: 'object', properties: {}, required: [] },
      execute: async () => ({ pong: true }),
    });

    const webmcpTool = createWebMcpTool(modelContext);
    const result = await webmcpTool.execute?.({ tool: 'ping', args: {} }, {} as never);
    expect(result).toEqual({ pong: true });
  });

  it('passes args to the registered tool', async () => {
    const modelContext = new ModelContext();
    let received: unknown;
    modelContext.registerTool({
      name: 'greet',
      title: 'Greet',
      description: 'Greet someone.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
      execute: async (input) => {
        received = input;
        return { greeting: `Hello, ${(input as { name: string }).name}` };
      },
    });

    const webmcpTool = createWebMcpTool(modelContext);
    await webmcpTool.execute?.({ tool: 'greet', args: { name: 'World' } }, {} as never);
    expect(received).toEqual({ name: 'World' });
  });

  it('defaults args to empty object when omitted', async () => {
    const modelContext = new ModelContext();
    let received: unknown;
    modelContext.registerTool({
      name: 'noop',
      title: 'Noop',
      description: 'No-op.',
      inputSchema: { type: 'object', properties: {}, required: [] },
      execute: async (input) => { received = input; return {}; },
    });

    const webmcpTool = createWebMcpTool(modelContext);
    // Call without `args` – should default to {}
    await webmcpTool.execute?.({ tool: 'noop' }, {} as never);
    expect(received).toEqual({});
  });

  it('rejects non-object input', async () => {
    const webmcpTool = createWebMcpTool(new ModelContext());

    await expect(webmcpTool.execute?.(null, {} as never)).rejects.toThrow('input must be an object');
  });

  it('rejects empty tool names', async () => {
    const webmcpTool = createWebMcpTool(new ModelContext());

    await expect(webmcpTool.execute?.({ tool: '   ' }, {} as never)).rejects.toThrow('non-empty tool name');
  });

  it('rejects non-object args', async () => {
    const webmcpTool = createWebMcpTool(new ModelContext());

    await expect(webmcpTool.execute?.({ tool: 'ping', args: [] }, {} as never)).rejects.toThrow('args must be an object');
  });
});
