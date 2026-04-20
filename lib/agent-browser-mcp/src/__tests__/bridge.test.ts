import { describe, expect, it, vi } from 'vitest';
import { ModelContext, ModelContextClient } from 'webmcp';

import { createWebMcpToolBridge } from '../bridge';

describe('createWebMcpToolBridge', () => {
  it('classifies registered tools as built-in and exposes AI SDK tools', async () => {
    const modelContext = new ModelContext();
    const createClient = vi.fn(() => new ModelContextClient());
    const execute = vi.fn(async ({ text }: { text: string }, _client: ModelContextClient) => ({ echoed: text }));

    modelContext.registerTool({
      name: 'echo',
      title: 'Echo',
      description: 'Echo text from the page.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
      },
      execute: async (input, client) => execute(input as { text: string }, client),
    });
    modelContext.registerTool({
      name: 'list_render_panes',
      title: 'List render panes',
      description: 'List renderer panes from the page.',
      execute: async () => [],
    });
    modelContext.registerTool({
      name: 'restore_clipboard_entry',
      title: 'Restore clipboard entry',
      description: 'Restore a clipboard entry from history.',
      execute: async () => ({ restored: true }),
    });

    const bridge = createWebMcpToolBridge(modelContext, { createClient });
    const descriptors = bridge.getDescriptors();
    const tools = bridge.createToolSet();

    expect(descriptors).toEqual([
      {
        id: 'webmcp:echo',
        label: 'Echo',
        description: 'Echo text from the page.',
        group: 'built-in',
        groupLabel: 'Built-In',
      },
      {
        id: 'webmcp:list_render_panes',
        label: 'List render panes',
        description: 'List renderer panes from the page.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'renderer-viewport-mcp',
        subGroupLabel: 'Renderer',
      },
      {
        id: 'webmcp:restore_clipboard_entry',
        label: 'Restore clipboard entry',
        description: 'Restore a clipboard entry from history.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'clipboard-worktree-mcp',
        subGroupLabel: 'Clipboard',
      },
    ]);

    await expect(tools['webmcp:echo']?.execute?.({ text: 'hello' }, {} as never)).resolves.toEqual({ echoed: 'hello' });
    expect(createClient).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith({ text: 'hello' }, expect.any(ModelContextClient));
  });

  it('assigns all six surface sub-groups inside the built-in group — never a separate webmcp group', () => {
    // One representative tool per sub-group category. Tools NOT in the lookup table
    // (e.g. 'echo') must fall back to group:'built-in' with no subGroup.
    const modelContext = new ModelContext();
    const SURFACE_SAMPLES: Array<[toolName: string, expectedSubGroup: string, expectedSubGroupLabel: string]> = [
      ['create_browser_page',   'browser-worktree-mcp',   'Browser'],
      ['submit_session_message','sessions-worktree-mcp',  'Sessions'],
      ['list_filesystem_entries','files-worktree-mcp',    'Files'],
      ['restore_clipboard_entry','clipboard-worktree-mcp','Clipboard'],
      ['list_render_panes',     'renderer-viewport-mcp',  'Renderer'],
      ['list_worktree_items',   'worktree-mcp',           'Workspace'],
    ];

    for (const [name] of SURFACE_SAMPLES) {
      modelContext.registerTool({ name, title: name, description: `Tool: ${name}`, execute: async () => null });
    }
    // Also register an ungrouped tool (falls back to built-in with no subGroup)
    modelContext.registerTool({ name: 'echo', title: 'Echo', description: 'Echo', execute: async () => null });

    const bridge = createWebMcpToolBridge(modelContext, { createClient: vi.fn(() => new ModelContextClient()) });
    const descriptors = bridge.getDescriptors();

    // Every descriptor must be in the 'built-in' group — never 'webmcp' or a surface group
    for (const d of descriptors) {
      expect(d.group, `Tool "${d.id}" must be in 'built-in', got '${d.group}'`).toBe('built-in');
      expect(d.groupLabel, `Tool "${d.id}" groupLabel must be 'Built-In', got '${d.groupLabel}'`).toBe('Built-In');
    }

    // Each surface sample must have the correct subGroup + subGroupLabel
    for (const [name, subGroup, subGroupLabel] of SURFACE_SAMPLES) {
      const descriptor = descriptors.find((d) => d.id === `webmcp:${name}`);
      expect(descriptor, `Descriptor for ${name} not found`).toBeDefined();
      expect(descriptor?.subGroup).toBe(subGroup);
      expect(descriptor?.subGroupLabel).toBe(subGroupLabel);
    }

    // The ungrouped tool must have no subGroup at all
    const ungrouped = descriptors.find((d) => d.id === 'webmcp:echo');
    expect(ungrouped?.subGroup).toBeUndefined();
    expect(ungrouped?.subGroupLabel).toBeUndefined();
  });

  it('notifies subscribers when the WebMCP registry changes', () => {
    const modelContext = new ModelContext();
    const bridge = createWebMcpToolBridge(modelContext);
    const listener = vi.fn();
    const unsubscribe = bridge.subscribe(listener);
    const controller = new AbortController();

    modelContext.registerTool({
      name: 'search',
      description: 'Search the current page.',
      execute: async () => 'done',
    }, { signal: controller.signal });

    expect(listener).toHaveBeenCalledOnce();

    controller.abort();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('gracefully exposes no tools for foreign modelContext objects without a registry', () => {
    const foreignModelContext = {} as ModelContext;
    const bridge = createWebMcpToolBridge(foreignModelContext);

    expect(bridge.getDescriptors()).toEqual([]);
    expect(bridge.createToolSet()).toEqual({});
    expect(() => bridge.subscribe(() => undefined)).not.toThrow();
  });

  it('uses default input schema when tool has no inputSchema', async () => {
    const modelContext = new ModelContext();
    modelContext.registerTool({
      name: 'noschema',
      description: 'A tool without an input schema.',
      execute: async () => 'result',
    });

    const bridge = createWebMcpToolBridge(modelContext);
    const tools = bridge.createToolSet();
    const descriptors = bridge.getDescriptors();

    // No title — label should fall back to the tool name
    expect(descriptors[0]?.label).toBe('noschema');

    await expect(tools['webmcp:noschema']?.execute?.({}, {} as never)).resolves.toBe('result');
  });

  it('throws when tool input is not an object', async () => {
    const modelContext = new ModelContext();
    modelContext.registerTool({
      name: 'typed',
      description: 'A typed tool.',
      execute: async () => 'ok',
    });

    const bridge = createWebMcpToolBridge(modelContext);
    const tools = bridge.createToolSet();

    // Simulate invalid input through the bridge by bypassing the AI SDK tool wrapper
    // and calling the underlying execute directly with a non-object via the internal path.
    // The toInvocationInput guard is exercised when invokeModelContextTool receives it.
    const tool = tools['webmcp:typed'] as { execute?: (input: unknown, options: never) => Promise<unknown> } | undefined;
    await expect(tool?.execute?.(null, {} as never)).rejects.toThrow(TypeError);
  });
});
