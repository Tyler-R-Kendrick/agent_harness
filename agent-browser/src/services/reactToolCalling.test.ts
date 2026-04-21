import { describe, expect, it } from 'vitest';
import { buildReActToolsSection, buildToolDescriptorCatalog, buildToolGroupCatalog, parseToolCall } from './reactToolCalling';

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

  it('renders compact tool group catalogs for routing stages', () => {
    const section = buildToolGroupCatalog([
      {
        id: 'files-worktree-mcp',
        label: 'Files',
        description: 'Workspace and session filesystem tools.',
        toolIds: ['read_session_file', 'write_session_file'],
      },
    ]);

    expect(section).toContain('## Tool Groups');
    expect(section).toContain('{"groups":["<group-id>"],"goal":"<short goal>"}');
    expect(section).toContain('files-worktree-mcp (Files) [2 tools]: Workspace and session filesystem tools.');
  });

  it('renders compact tool descriptor catalogs for tool-selection stages', () => {
    const section = buildToolDescriptorCatalog([
      {
        id: 'read_session_file',
        label: 'Read session file',
        description: 'Read a file from the active session filesystem.',
      },
    ]);

    expect(section).toContain('## Tools');
    expect(section).toContain('{"toolIds":["<tool-id>"],"goal":"<short goal>"}');
    expect(section).toContain('read_session_file (Read session file): Read a file from the active session filesystem.');
  });
});