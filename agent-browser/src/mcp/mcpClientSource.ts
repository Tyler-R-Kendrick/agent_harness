import {
  createMcpClientToolBridge,
  type McpClientToolBridgeOptions,
  type McpServerConfig,
  type McpToolDescriptor,
} from '@agent-harness/mcp-client';

/** Conventional workspace path the external MCP server list is read from. */
export const DEFAULT_MCP_SERVERS_PATH = '.mcp/servers.json';

export interface McpServerConfigReader {
  readFile(path: string): Promise<string | Uint8Array> | string | Uint8Array;
}

export interface ResolveMcpServersOptions {
  enabled: boolean | undefined;
  reader: McpServerConfigReader;
  path?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toServerConfigs(parsed: unknown): McpServerConfig[] {
  const rawServers = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.servers)
      ? parsed.servers
      : undefined;
  if (!rawServers) {
    return [];
  }
  // Minimal validation: keep only entries that carry a string `id`.
  return rawServers.filter(
    (entry): entry is McpServerConfig => isRecord(entry) && typeof entry.id === 'string',
  );
}

/**
 * Resolve the configured external MCP servers from a workspace file, or `[]`.
 *
 * Phase 1 shadow: returns `[]` when the flag is off (default), so no MCP client
 * is ever constructed. Fail-open: a missing file or any parse/validation error
 * also yields `[]` rather than blocking chat.
 */
export async function resolveMcpServersFromFs(
  options: ResolveMcpServersOptions,
): Promise<McpServerConfig[]> {
  if (!options.enabled) {
    return [];
  }
  const path = options.path ?? DEFAULT_MCP_SERVERS_PATH;
  try {
    const raw = await options.reader.readFile(path);
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    return toServerConfigs(JSON.parse(text));
  } catch (err) {
    console.warn(`[mcp-client] failed to load MCP servers from "${path}"; using none.`, err);
    return [];
  }
}

export interface MountMcpClientShadowOptions {
  servers: McpServerConfig[];
  logger?: (message: string) => void;
  bridgeFactory?: (
    options: McpClientToolBridgeOptions,
  ) => ReturnType<typeof createMcpClientToolBridge>;
}

/**
 * Connect the external MCP client in shadow mode and return the discovered tool
 * descriptors. Log-only: descriptors are surfaced to the caller's logger but are
 * NEVER merged into any live tool set, so chat behavior is unchanged.
 *
 * Guarded end-to-end: an empty server list short-circuits without constructing a
 * bridge, and any connect/discovery failure resolves to `[]` instead of throwing
 * into the caller.
 */
export async function mountMcpClientShadow(
  options: MountMcpClientShadowOptions,
): Promise<McpToolDescriptor[]> {
  if (options.servers.length === 0) {
    return [];
  }
  const log = options.logger ?? (() => undefined);
  try {
    const bridgeFactory = options.bridgeFactory ?? createMcpClientToolBridge;
    const bridge = bridgeFactory({ servers: options.servers });
    try {
      await bridge.connect();
      const descriptors = bridge.getDescriptors();
      for (const descriptor of descriptors) {
        log(`Phase 1 shadow MCP tool discovered: ${descriptor.id} (server ${descriptor.serverId})`);
      }
      return descriptors;
    } finally {
      // Log-only shadow: descriptors are captured above and never used live, so
      // close the bridge immediately to release transports and avoid leaks.
      await bridge.close();
    }
  } catch {
    return [];
  }
}
