import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createMcpClientToolBridge,
  defaultMcpClientLogger,
  type McpClientLogEvent,
} from '../bridge';
import type { McpClientLike, McpDiscoveredTool } from '../types';
import { startInMemoryMcpServer, type InMemoryMcpServer } from './inMemoryServer';

const harnesses: InMemoryMcpServer[] = [];

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.close()));
});

interface FakeClient {
  client: McpClientLike;
  listTools: ReturnType<typeof vi.fn>;
  callTool: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function createFakeClient(tools: McpDiscoveredTool[]): FakeClient {
  const listTools = vi.fn(async () => tools);
  const callTool = vi.fn(async (name: string, args: Record<string, unknown>) => ({ echoed: name, args }));
  const close = vi.fn(async () => undefined);
  return { client: { listTools, callTool, close }, listTools, callTool, close };
}

describe('createMcpClientToolBridge', () => {
  it('is pure on construction: empty descriptors/tool set and no server contact before connect', () => {
    const fake = createFakeClient([{ name: 'alpha', description: 'Alpha tool.' }]);
    const bridge = createMcpClientToolBridge({
      servers: [{ id: 'server-1' }],
      clientFactory: () => fake.client,
    });

    expect(bridge.getDescriptors()).toEqual([]);
    expect(bridge.createToolSet()).toEqual({});
    expect(fake.listTools).not.toHaveBeenCalled();
  });

  it('builds mcp: prefixed descriptors and a tool set whose execute delegates to callTool', async () => {
    const fake = createFakeClient([
      {
        name: 'alpha',
        description: 'Alpha tool.',
        inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
      },
    ]);
    const bridge = createMcpClientToolBridge({
      servers: [{ id: 'server-1', label: 'Server One' }],
      clientFactory: () => fake.client,
    });

    await bridge.connect();

    expect(bridge.getDescriptors()).toEqual([
      {
        id: 'mcp:alpha',
        label: 'alpha',
        description: 'Alpha tool.',
        group: 'mcp',
        groupLabel: 'MCP',
        serverId: 'server-1',
      },
    ]);

    const toolSet = bridge.createToolSet();
    expect(Object.keys(toolSet)).toEqual(['mcp:alpha']);

    await expect(toolSet['mcp:alpha']?.execute?.({ q: 'hi' }, {} as never)).resolves.toEqual({
      echoed: 'alpha',
      args: { q: 'hi' },
    });
    expect(fake.callTool).toHaveBeenCalledWith('alpha', { q: 'hi' });
  });

  it('handles all input-schema shapes and the missing-description fallback', async () => {
    const fake = createFakeClient([
      { name: 'obj', description: 'Object schema.', inputSchema: { type: 'object', properties: {} } },
      { name: 'missing', inputSchema: undefined },
      { name: 'array', description: 'Array schema.', inputSchema: [] },
      { name: 'primitive', inputSchema: 'not-an-object' },
    ]);
    const bridge = createMcpClientToolBridge({
      servers: [{ id: 'server-1' }],
      clientFactory: () => fake.client,
    });

    await bridge.connect();

    const descriptors = bridge.getDescriptors();
    // Tool with no description falls back to an empty string.
    expect(descriptors.find((descriptor) => descriptor.id === 'mcp:missing')?.description).toBe('');
    expect(descriptors.find((descriptor) => descriptor.id === 'mcp:obj')?.description).toBe('Object schema.');

    expect(Object.keys(bridge.createToolSet()).sort()).toEqual([
      'mcp:array',
      'mcp:missing',
      'mcp:obj',
      'mcp:primitive',
    ]);
  });

  it('aggregates tools across multiple servers and logs each discovery', async () => {
    const first = createFakeClient([{ name: 'alpha', description: 'Alpha.' }]);
    const second = createFakeClient([{ name: 'beta', description: 'Beta.' }]);
    const clientsById: Record<string, McpClientLike> = {
      'server-1': first.client,
      'server-2': second.client,
    };
    const events: McpClientLogEvent[] = [];

    const bridge = createMcpClientToolBridge({
      servers: [{ id: 'server-1' }, { id: 'server-2' }],
      clientFactory: (server) => clientsById[server.id]!,
      logger: (event) => events.push(event),
    });

    await bridge.connect();

    expect(bridge.getDescriptors().map((descriptor) => [descriptor.id, descriptor.serverId])).toEqual([
      ['mcp:alpha', 'server-1'],
      ['mcp:beta', 'server-2'],
    ]);
    expect(Object.keys(bridge.createToolSet()).sort()).toEqual(['mcp:alpha', 'mcp:beta']);
    expect(events).toEqual([
      { type: 'tool-discovered', serverId: 'server-1', tool: { name: 'alpha', description: 'Alpha.' } },
      { type: 'tool-discovered', serverId: 'server-2', tool: { name: 'beta', description: 'Beta.' } },
    ]);
  });

  it('falls back to the no-op default logger when none is supplied', async () => {
    const fake = createFakeClient([{ name: 'alpha', description: 'Alpha.' }]);
    const bridge = createMcpClientToolBridge({
      servers: [{ id: 'server-1' }],
      clientFactory: () => fake.client,
    });

    await expect(bridge.connect()).resolves.toBeUndefined();
    expect(bridge.getDescriptors().map((descriptor) => descriptor.id)).toEqual(['mcp:alpha']);
    // The exported default logger is a safe no-op.
    expect(defaultMcpClientLogger({ type: 'tool-discovered', serverId: 'x', tool: { name: 'y' } })).toBeUndefined();
  });

  it('notifies subscribers on connect and stops after unsubscribe', async () => {
    const fake = createFakeClient([{ name: 'alpha', description: 'Alpha.' }]);
    const bridge = createMcpClientToolBridge({
      servers: [{ id: 'server-1' }],
      clientFactory: () => fake.client,
    });
    const listener = vi.fn();

    const unsubscribe = bridge.subscribe(listener);
    await bridge.connect();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await bridge.connect();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('closes all clients, resets state, and notifies on close', async () => {
    const first = createFakeClient([{ name: 'alpha', description: 'Alpha.' }]);
    const second = createFakeClient([{ name: 'beta', description: 'Beta.' }]);
    const clientsById: Record<string, McpClientLike> = {
      'server-1': first.client,
      'server-2': second.client,
    };
    const listener = vi.fn();

    const bridge = createMcpClientToolBridge({
      servers: [{ id: 'server-1' }, { id: 'server-2' }],
      clientFactory: (server) => clientsById[server.id]!,
    });
    bridge.subscribe(listener);
    await bridge.connect();
    expect(listener).toHaveBeenCalledTimes(1);

    await bridge.close();

    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).toHaveBeenCalledTimes(1);
    expect(bridge.getDescriptors()).toEqual([]);
    expect(bridge.createToolSet()).toEqual({});
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('uses the real SDK client by default when no clientFactory is supplied', async () => {
    const harness = await startInMemoryMcpServer();
    harnesses.push(harness);

    const bridge = createMcpClientToolBridge({
      servers: [{ id: 'real', transport: harness.clientTransport }],
    });

    await bridge.connect();

    expect(bridge.getDescriptors().map((descriptor) => descriptor.id)).toContain('mcp:ping');
    const toolSet = bridge.createToolSet();
    await expect(toolSet['mcp:ping']?.execute?.({}, {} as never)).resolves.toMatchObject({
      content: [{ type: 'text', text: 'pong' }],
    });

    await bridge.close();
  });
});
