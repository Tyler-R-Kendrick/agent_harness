import { CoreToolApi } from '../coreToolApi.js';
import type { ToolDefinition, ToolProvider, WasiToolProvider } from '../types.js';

const context = { requestId: 'req-1', project: 'agent-harness', capabilities: ['fs.read'] } as const;

const makeTool = (): ToolDefinition => ({
  name: 'echo',
  title: 'Echo',
  description: 'echoes input',
  convention: 'json-schema',
  inputSchema: { type: 'object' },
  execute: async (input) => input,
});

it('registers tools and returns sorted names', () => {
  const api = new CoreToolApi();
  api.registerTool({ ...makeTool(), name: 'zeta' });
  api.registerTool({ ...makeTool(), name: 'alpha' });
  expect(api.listToolNames()).toEqual(['alpha', 'zeta']);
});

it('rejects duplicate tool names', () => {
  const api = new CoreToolApi();
  api.registerTool(makeTool());
  expect(() => api.registerTool(makeTool())).toThrow('Tool already registered: echo');
});

it('rejects duplicate providers', () => {
  const api = new CoreToolApi();
  const provider: ToolProvider = {
    id: 'native',
    kind: 'native',
    supports: () => true,
    invoke: async () => 'ok',
  };
  api.registerProvider(provider);
  expect(() => api.registerProvider(provider)).toThrow('Provider already registered: native');
});

it('throws when tool is missing', async () => {
  const api = new CoreToolApi();
  await expect(api.execute('missing', { ok: true }, context)).rejects.toThrow('Unknown tool: missing');
});

it('throws when no provider supports the tool', async () => {
  const api = new CoreToolApi();
  api.registerTool(makeTool());
  api.registerProvider({ id: 'none', kind: 'native', supports: () => false, invoke: async () => 'x' });
  await expect(api.execute('echo', { ok: true }, context)).rejects.toThrow('No provider registered for tool: echo');
});

it('executes tools through a native provider', async () => {
  const api = new CoreToolApi();
  const tool = makeTool();
  api.registerTool(tool);
  api.registerProvider({
    id: 'native',
    kind: 'native',
    supports: () => true,
    invoke: async (selected, input, runtimeContext) => {
      expect(selected.name).toBe('echo');
      expect(runtimeContext.requestId).toBe('req-1');
      return selected.execute(input, runtimeContext);
    },
  });

  await expect(api.execute('echo', { value: 1 }, context)).resolves.toEqual({ value: 1 });
});

it('supports a wasi-wasm provider shape', async () => {
  const api = new CoreToolApi();
  api.registerTool(makeTool());

  const wasiProvider: WasiToolProvider = {
    id: 'wasi-runtime',
    kind: 'wasi-wasm',
    wasi: { world: 'tools', imports: { 'wasi:io/poll@0.2.0': {} } },
    supports: (tool) => tool.convention === 'json-schema',
    invoke: async (_tool, input) => ({ provider: 'wasi-runtime', input }),
  };

  api.registerProvider(wasiProvider);
  await expect(api.execute('echo', { value: 2 }, context)).resolves.toEqual({
    provider: 'wasi-runtime',
    input: { value: 2 },
  });
  expect(wasiProvider.wasi.world).toBe('tools');
});
