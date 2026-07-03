const MCP_TOOL_ID_PREFIX = 'mcp:';

/**
 * Namespaces an MCP tool name under the shared `mcp:` prefix. Analogue of the
 * serving bridge's `toWebMcpToolId` (`webmcp:` prefix) so client- and
 * server-side tool identities stay parallel.
 */
export function toMcpToolId(name: string): string {
  return `${MCP_TOOL_ID_PREFIX}${name}`;
}
