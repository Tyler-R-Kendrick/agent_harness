import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export interface InMemoryMcpServer {
  clientTransport: Transport;
  server: McpServer;
  close(): Promise<void>;
}

/**
 * Stands up an in-memory MCP server exposing a single `ping` tool and returns
 * the linked client-side transport so a client can round-trip against it.
 * Shared test glue; lives under `__tests__/` so it is excluded from coverage
 * and from the publish allowlist.
 */
export async function startInMemoryMcpServer(): Promise<InMemoryMcpServer> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: 'in-memory-test-server', version: '0.0.0' });

  server.registerTool(
    'ping',
    { description: 'Replies with pong.' },
    async () => ({ content: [{ type: 'text' as const, text: 'pong' }] }),
  );

  await server.connect(serverTransport);

  return {
    clientTransport,
    server,
    async close() {
      await server.close();
    },
  };
}
