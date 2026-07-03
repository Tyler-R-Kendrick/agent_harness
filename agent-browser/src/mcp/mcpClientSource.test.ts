import { describe, expect, it, vi } from 'vitest';
import type {
  McpClientToolBridgeOptions,
  McpServerConfig,
  McpToolDescriptor,
} from '@agent-harness/mcp-client';
import { createMcpClientToolBridge } from '@agent-harness/mcp-client';
import {
  DEFAULT_MCP_SERVERS_PATH,
  mountMcpClientShadow,
  resolveMcpServersFromFs,
} from './mcpClientSource';

vi.mock('@agent-harness/mcp-client', () => ({
  createMcpClientToolBridge: vi.fn(),
}));

const VALID_OBJECT_JSON = JSON.stringify({
  servers: [
    { id: 'server-1', label: 'Server One' },
    { id: 'server-2' },
  ],
});

const VALID_ARRAY_JSON = JSON.stringify([{ id: 'bare-1' }, { id: 'bare-2' }]);

function descriptor(id: string, serverId: string): McpToolDescriptor {
  return { id, label: id, description: '', group: 'mcp', groupLabel: 'MCP', serverId };
}

describe('resolveMcpServersFromFs', () => {
  it('returns [] when disabled without reading', async () => {
    let read = false;
    const result = await resolveMcpServersFromFs({
      enabled: false,
      reader: { readFile: () => { read = true; return VALID_OBJECT_JSON; } },
    });
    expect(result).toEqual([]);
    expect(read).toBe(false);
  });

  it('parses a { servers: [...] } document from the default path when enabled', async () => {
    let requestedPath = '';
    const result = await resolveMcpServersFromFs({
      enabled: true,
      reader: { readFile: (path) => { requestedPath = path; return VALID_OBJECT_JSON; } },
    });
    expect(requestedPath).toBe(DEFAULT_MCP_SERVERS_PATH);
    expect(result.map((server) => server.id)).toEqual(['server-1', 'server-2']);
  });

  it('parses a bare array document', async () => {
    const result = await resolveMcpServersFromFs({
      enabled: true,
      reader: { readFile: () => VALID_ARRAY_JSON },
    });
    expect(result.map((server) => server.id)).toEqual(['bare-1', 'bare-2']);
  });

  it('decodes Uint8Array content', async () => {
    const bytes = new TextEncoder().encode(VALID_ARRAY_JSON);
    const result = await resolveMcpServersFromFs({
      enabled: true,
      reader: { readFile: () => bytes },
    });
    expect(result.map((server) => server.id)).toEqual(['bare-1', 'bare-2']);
  });

  it('honors a custom path', async () => {
    let requestedPath = '';
    await resolveMcpServersFromFs({
      enabled: true,
      path: '.mcp/custom.json',
      reader: { readFile: (path) => { requestedPath = path; return VALID_ARRAY_JSON; } },
    });
    expect(requestedPath).toBe('.mcp/custom.json');
  });

  it('keeps only entries carrying a string id', async () => {
    const result = await resolveMcpServersFromFs({
      enabled: true,
      reader: {
        readFile: () => JSON.stringify({ servers: [{ id: 'ok' }, { label: 'no-id' }, { id: 42 }] }),
      },
    });
    expect(result.map((server) => server.id)).toEqual(['ok']);
  });

  it('returns [] for valid JSON that is neither an array nor { servers: [...] }', async () => {
    const result = await resolveMcpServersFromFs({
      enabled: true,
      reader: { readFile: () => JSON.stringify({ foo: 'bar' }) },
    });
    expect(result).toEqual([]);
  });

  it('fails open to [] when the reader throws (missing file)', async () => {
    const result = await resolveMcpServersFromFs({
      enabled: true,
      reader: { readFile: () => { throw new Error('ENOENT'); } },
    });
    expect(result).toEqual([]);
  });

  it('fails open to [] on invalid JSON content', async () => {
    const result = await resolveMcpServersFromFs({
      enabled: true,
      reader: { readFile: () => 'not json {' },
    });
    expect(result).toEqual([]);
  });
});

describe('mountMcpClientShadow', () => {
  it('returns [] and never constructs a bridge when there are no servers', async () => {
    const bridgeFactory = vi.fn();
    const result = await mountMcpClientShadow({ servers: [], bridgeFactory });
    expect(result).toEqual([]);
    expect(bridgeFactory).not.toHaveBeenCalled();
  });

  it('connects via the injected bridge factory, logs discovered descriptors, returns them, and closes the bridge', async () => {
    const descriptors = [descriptor('mcp:alpha', 'server-1'), descriptor('mcp:beta', 'server-1')];
    const connect = vi.fn(async () => undefined);
    const getDescriptors = vi.fn(() => descriptors);
    const close = vi.fn(async () => undefined);
    const bridgeFactory = vi.fn((options: McpClientToolBridgeOptions) => {
      expect(options.servers.map((server) => server.id)).toEqual(['server-1']);
      return {
        connect,
        getDescriptors,
        createToolSet: () => ({}),
        subscribe: () => () => undefined,
        close,
      };
    });
    const messages: string[] = [];

    const servers: McpServerConfig[] = [{ id: 'server-1' }];
    const result = await mountMcpClientShadow({
      servers,
      logger: (message) => messages.push(message),
      bridgeFactory,
    });

    expect(connect).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(result).toEqual(descriptors);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('mcp:alpha');
    expect(messages[1]).toContain('mcp:beta');
  });

  it('falls back to the real createMcpClientToolBridge when no bridgeFactory is given and closes it', async () => {
    const close = vi.fn(async () => undefined);
    vi.mocked(createMcpClientToolBridge).mockReturnValue({
      connect: async () => undefined,
      getDescriptors: () => [],
      createToolSet: () => ({}),
      subscribe: () => () => undefined,
      close,
    });

    const result = await mountMcpClientShadow({ servers: [{ id: 'server-1' }] });

    expect(createMcpClientToolBridge).toHaveBeenCalledWith({ servers: [{ id: 'server-1' }] });
    expect(close).toHaveBeenCalledOnce();
    expect(result).toEqual([]);
  });

  it('swallows bridge errors and resolves to []', async () => {
    const result = await mountMcpClientShadow({
      servers: [{ id: 'server-1' }],
      bridgeFactory: () => {
        throw new Error('connect boom');
      },
    });
    expect(result).toEqual([]);
  });
});
