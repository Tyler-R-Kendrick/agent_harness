import { jsonSchema, tool, type ToolSet } from 'ai';

import { toMcpToolId } from './identity';
import { createDefaultMcpClient } from './sdkClient';
import type {
  McpClientLike,
  McpDiscoveredTool,
  McpServerConfig,
  McpToolDescriptor,
  McpToolGroup,
} from './types';

const MCP_GROUP: McpToolGroup = 'mcp';
const MCP_GROUP_LABEL = 'MCP';
const DEFAULT_INPUT_SCHEMA = { type: 'object', properties: {} };

/**
 * Emitted once per tool discovered during {@link McpClientToolBridge.connect}.
 */
export interface McpToolDiscoveredEvent {
  readonly type: 'tool-discovered';
  readonly serverId: string;
  readonly tool: McpDiscoveredTool;
}

export type McpClientLogEvent = McpToolDiscoveredEvent;

export type McpClientLogger = (event: McpClientLogEvent) => void;

/**
 * Phase 0 default logger. Emits nothing on its own — the app supplies a logger
 * (behind the default-off flag) that records/logs discovery. The bridge only
 * emits events; it never auto-merges discovered tools into the app.
 */
export const defaultMcpClientLogger: McpClientLogger = () => undefined;

export interface McpClientToolBridgeOptions {
  servers: McpServerConfig[];
  clientFactory?: (server: McpServerConfig) => McpClientLike;
  logger?: McpClientLogger;
}

export interface McpClientToolBridge {
  connect(): Promise<void>;
  createToolSet(): ToolSet;
  getDescriptors(): McpToolDescriptor[];
  subscribe(listener: () => void): () => void;
  close(): Promise<void>;
}

function toDescriptor(server: McpServerConfig, discovered: McpDiscoveredTool): McpToolDescriptor {
  return {
    id: toMcpToolId(discovered.name),
    label: discovered.name,
    description: discovered.description ?? '',
    group: MCP_GROUP,
    groupLabel: MCP_GROUP_LABEL,
    serverId: server.id,
  };
}

function toInputSchema(discovered: McpDiscoveredTool): Record<string, unknown> {
  const schema = discovered.inputSchema;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return DEFAULT_INPUT_SCHEMA;
  }

  return schema as Record<string, unknown>;
}

function toTool(client: McpClientLike, discovered: McpDiscoveredTool): ToolSet[string] {
  return tool({
    description: discovered.description ?? '',
    inputSchema: jsonSchema(toInputSchema(discovered)),
    execute: async (input: unknown) => client.callTool(discovered.name, input as Record<string, unknown>),
  });
}

/**
 * Builds a client bridge that mounts external MCP servers' tools into an AI SDK
 * {@link ToolSet}, mirroring the WebMCP serving bridge's shape.
 *
 * Construction is pure and side-effect-free: no server is contacted until
 * {@link McpClientToolBridge.connect} is called. Before `connect`,
 * `getDescriptors()` returns `[]` and `createToolSet()` returns `{}`.
 */
export function createMcpClientToolBridge(options: McpClientToolBridgeOptions): McpClientToolBridge {
  const listeners = new Set<() => void>();
  let descriptors: McpToolDescriptor[] = [];
  let toolSet: ToolSet = {};
  let clients: McpClientLike[] = [];

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    async connect() {
      const clientFactory = options.clientFactory ?? createDefaultMcpClient;
      const logger = options.logger ?? defaultMcpClientLogger;
      const nextClients: McpClientLike[] = [];
      const nextDescriptors: McpToolDescriptor[] = [];
      const nextToolSet: ToolSet = {};

      for (const server of options.servers) {
        const client = clientFactory(server);
        nextClients.push(client);
        const discoveredTools = await client.listTools();
        for (const discovered of discoveredTools) {
          logger({ type: 'tool-discovered', serverId: server.id, tool: discovered });
          nextDescriptors.push(toDescriptor(server, discovered));
          nextToolSet[toMcpToolId(discovered.name)] = toTool(client, discovered);
        }
      }

      clients = nextClients;
      descriptors = nextDescriptors;
      toolSet = nextToolSet;
      notify();
    },
    createToolSet() {
      return { ...toolSet };
    },
    getDescriptors() {
      return [...descriptors];
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async close() {
      const current = clients;
      clients = [];
      descriptors = [];
      toolSet = {};
      await Promise.all(current.map((client) => client.close()));
      notify();
    },
  };
}
