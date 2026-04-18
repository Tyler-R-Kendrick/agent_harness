import { ToolRegistry } from '../registry';
import type { RegisteredToolDefinition } from '../types';

function createTool(name = 'echo'): RegisteredToolDefinition {
  return {
    name,
    title: 'Echo',
    description: 'Echo input',
    inputSchema: '{"type":"object"}',
    rawInputSchema: { type: 'object' },
    execute: async (input) => input,
    readOnlyHint: true,
  };
}

describe('ToolRegistry', () => {
  it('registers, lists, retrieves, and unregisters tools', () => {
    const registry = new ToolRegistry();
    const tool = createTool();
    const changes: string[] = [];
    const unsubscribe = registry.subscribe((change) => {
      changes.push(`${change.type}:${change.tool.name}`);
    });

    registry.register(tool);

    expect(registry.has('echo')).toBe(true);
    expect(registry.get('echo')).toEqual(tool);
    expect(registry.list()).toEqual([tool]);

    unsubscribe();
    expect(registry.unregister('echo')).toBe(true);
    expect(registry.unregister('echo')).toBe(false);
    expect(changes).toEqual(['register:echo']);
  });
});