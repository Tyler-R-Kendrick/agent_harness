/**
 * The single tool group produced by the MCP client bridge. Mirrors the `'mcp'`
 * group already declared by agent-browser's `ToolGroup`/`ToolDescriptor`.
 */
export type McpToolGroup = 'mcp';

/**
 * Descriptor for a tool discovered on an external MCP server, shaped to parallel
 * agent-browser's `ToolDescriptor`. `serverId` records which configured MCP
 * server contributed the tool so the host can group/attribute it.
 */
export interface McpToolDescriptor {
  id: string;
  label: string;
  description: string;
  group: McpToolGroup;
  groupLabel: string;
  serverId: string;
}

/**
 * Configuration for a single external MCP server connection.
 *
 * `transport` is intentionally typed as `unknown` so this shared module stays
 * free of any `@modelcontextprotocol/sdk` import — only `sdkClient.ts` narrows it
 * to the SDK's `Transport`. In Phase 0 tests this is an `InMemoryTransport`.
 */
export interface McpServerConfig {
  id: string;
  label?: string;
  transport?: unknown;
}

/**
 * A tool as advertised by an external MCP server via `listTools`.
 */
export interface McpDiscoveredTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

/**
 * Minimal client surface the bridge depends on, abstracting the concrete
 * `@modelcontextprotocol/sdk` `Client`. Tests inject a fake implementation of
 * this interface; production uses `createDefaultMcpClient`.
 */
export interface McpClientLike {
  listTools(): Promise<McpDiscoveredTool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}
