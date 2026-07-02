import { describe, expect, it } from 'vitest';

import { toMcpToolId } from '../identity';

describe('toMcpToolId', () => {
  it('prefixes tool names with the shared "mcp:" namespace', () => {
    expect(toMcpToolId('search')).toBe('mcp:search');
    expect(toMcpToolId('read_file')).toBe('mcp:read_file');
  });

  it('does not collapse or trim an empty name', () => {
    expect(toMcpToolId('')).toBe('mcp:');
  });
});
