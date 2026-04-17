import { describe, expect, it } from 'vitest';
import { buildReActToolsSection, parseToolCall } from './reactToolCalling';

describe('reactToolCalling', () => {
  it('renders ReAct tool instructions with tool metadata', () => {
    const section = buildReActToolsSection([
      {
        type: 'function',
        name: 'cli',
        description: 'Run a command.',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Shell command' },
          },
        },
      },
    ] as never);

    expect(section).toContain('<tool_call>{"tool": "<name>", "args": {<arguments>}}</tool_call>');
    expect(section).toContain('cli(command: string (Shell command)): Run a command.');
  });

  it('handles tools that do not expose parameter properties', () => {
    const section = buildReActToolsSection([
      {
        type: 'function',
        name: 'cli',
        description: 'Run a command.',
      },
    ] as never);

    expect(section).toContain('cli(): Run a command.');
  });

  it('parses tool-call blocks and ignores invalid payloads', () => {
    expect(parseToolCall('<tool_call>{"tool":"cli","args":{"command":"pwd"}}</tool_call>')).toEqual({
      toolName: 'cli',
      args: { command: 'pwd' },
    });
    expect(parseToolCall('<tool_call>not-json</tool_call>')).toBeNull();
    expect(parseToolCall('plain text')).toBeNull();
  });
});