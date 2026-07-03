# @agent-harness/mcp-client

MCP **client** tool bridge. Mounts the tools exposed by external
[Model Context Protocol](https://modelcontextprotocol.io) servers into an AI SDK
`ToolSet`, mirroring the shape of the WebMCP **serving** bridge
(`@agent-harness/agent-browser-mcp` `createWebMcpToolBridge`).

Where the serving bridge exposes the app's own tools *to* an MCP client, this
package is the consuming half: it discovers tools *from* configured MCP servers
and wraps each one as an AI SDK `tool({...})` whose `execute` delegates to the
remote server.

## Phase 0: shadow mode

This is migration Phase 0, Workstream E (client library half) of the
protocol-adoption ADR (`docs/adr/2026-07-02-protocol-adoption-mcp-a2a.md`).

**Constructed only behind a default-off flag; discovered tools are logged, not
merged.** In Phase 0 the app builds the bridge behind a dev flag and uses it to
`connect()` and observe/log discovered tools via the `logger` callback. Nothing
is auto-merged into the app's active `ToolSet`. The bridge only *emits*
discovery events; the host decides what (if anything) to do with them.

Design guarantees that support shadow mode:

- **Pure construction.** `createMcpClientToolBridge(options)` contacts no server
  and has no side effects. Servers are reached only when `connect()` is called.
- **Safe-before-connect.** Before `connect()`, `getDescriptors()` returns `[]`
  and `createToolSet()` returns `{}`.
- **No auto-merge.** The default `logger` is a no-op; the app supplies its own
  logger to record discovery.

## API

```ts
import {
  createMcpClientToolBridge,
  toMcpToolId,
  type McpServerConfig,
} from '@agent-harness/mcp-client';

const bridge = createMcpClientToolBridge({
  servers: [{ id: 'serena', transport: myTransport }],
  logger: (event) => console.debug('[mcp-client]', event),
});

await bridge.connect();          // discover tools from all servers
bridge.getDescriptors();          // McpToolDescriptor[] (group: 'mcp', ids: 'mcp:<name>')
bridge.createToolSet();           // ai ToolSet keyed by 'mcp:<name>'
const stop = bridge.subscribe(() => { /* re-read after changes */ });
await bridge.close();             // close every underlying client
stop();
```

### `createMcpClientToolBridge(options)`

`options`:

- `servers: McpServerConfig[]` — servers to connect to. `McpServerConfig` is
  `{ id: string; label?: string; transport?: unknown }`. `transport` is the
  `@modelcontextprotocol/sdk` `Transport` used by the default client; it is typed
  `unknown` so this module never imports the SDK directly.
- `clientFactory?: (server) => McpClientLike` — override how a client is built
  per server. Defaults to `createDefaultMcpClient` (the real SDK adapter). Tests
  inject a fake.
- `logger?: (event) => void` — receives a `tool-discovered` event per discovered
  tool during `connect()`. Defaults to a no-op.

Returns `McpClientToolBridge`:
`{ connect(): Promise<void>; createToolSet(): ToolSet; getDescriptors(): McpToolDescriptor[]; subscribe(listener): () => void; close(): Promise<void> }`.

### `toMcpToolId(name) => 'mcp:' + name`

Namespaces a tool name under the shared `mcp:` prefix — the client-side analogue
of the serving bridge's `toWebMcpToolId` (`webmcp:`).

### `createDefaultMcpClient(server): McpClientLike`

Thin adapter over `@modelcontextprotocol/sdk`'s `Client`. This is the only module
that imports the SDK; everything else depends on the SDK-agnostic `McpClientLike`
interface (`listTools`/`callTool`/`close`).

## Local development

```sh
npm run test
npm run test:coverage
```
