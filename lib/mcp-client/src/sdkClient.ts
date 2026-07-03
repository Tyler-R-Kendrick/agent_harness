import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

import type { McpClientLike, McpDiscoveredTool, McpServerConfig } from './types';

const MCP_CLIENT_NAME = '@agent-harness/mcp-client';
const MCP_CLIENT_VERSION = '0.1.0';

type ListedTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

function toDiscoveredTool(listed: ListedTool): McpDiscoveredTool {
  return {
    name: listed.name,
    description: listed.description,
    inputSchema: listed.inputSchema,
  };
}

/**
 * Thin real-SDK adapter that satisfies {@link McpClientLike} using
 * `@modelcontextprotocol/sdk`. This is the only module that imports the SDK.
 *
 * The connection is opened eagerly from the transport supplied on
 * {@link McpServerConfig.transport}; `listTools`/`callTool`/`close` await that
 * handshake before delegating to the SDK `Client`.
 */
export function createDefaultMcpClient(server: McpServerConfig): McpClientLike {
  const client = new Client({ name: MCP_CLIENT_NAME, version: MCP_CLIENT_VERSION });
  const ready = client.connect(server.transport as Transport);

  return {
    async listTools() {
      await ready;
      const { tools } = await client.listTools();
      return tools.map(toDiscoveredTool);
    },
    async callTool(name, args) {
      await ready;
      return client.callTool({ name, arguments: args });
    },
    async close() {
      await ready;
      await client.close();
    },
  };
}
