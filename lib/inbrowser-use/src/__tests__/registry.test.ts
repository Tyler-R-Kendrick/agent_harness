import { describe, it, expect } from 'vitest';
import { AgentRegistry } from '../registry.js';

describe('AgentRegistry', () => {
  it('registers and retrieves a node', () => {
    const reg = new AgentRegistry();
    reg.register({ id: 'foo' });
    expect(reg.has('foo')).toBe(true);
    expect(reg.get('foo')?.id).toBe('foo');
  });

  it('unregisters when cleanup is called', () => {
    const reg = new AgentRegistry();
    const cleanup = reg.register({ id: 'bar' });
    cleanup();
    expect(reg.has('bar')).toBe(false);
    expect(reg.get('bar')).toBeUndefined();
  });

  it('lists all nodes', () => {
    const reg = new AgentRegistry();
    reg.register({ id: 'a' });
    reg.register({ id: 'b' });
    expect(reg.list().map((n) => n.id)).toContain('a');
    expect(reg.list().map((n) => n.id)).toContain('b');
    expect(reg.list()).toHaveLength(2);
  });

  it('returns undefined for unknown id', () => {
    const reg = new AgentRegistry();
    expect(reg.get('nonexistent')).toBeUndefined();
  });

  it('overwrites a node with same id', () => {
    const reg = new AgentRegistry();
    reg.register({ id: 'dup', role: 'button' });
    reg.register({ id: 'dup', role: 'checkbox' });
    expect(reg.get('dup')?.role).toBe('checkbox');
    expect(reg.list()).toHaveLength(1);
  });
});
