import { jsonSchema, tool } from 'ai';
import { invokeModelContextTool, ModelContext } from '@agent-harness/webmcp';

export const WEBMCP_TOOL_ID = 'webmcp';

export const WEBMCP_BUILTIN_DESCRIPTOR = {
  id: WEBMCP_TOOL_ID,
  label: 'WebMCP',
  description: 'Invoke tools registered by the current page via WebMCP.',
  group: 'built-in' as const,
  groupLabel: 'Built-In',
};

type WebMcpToolInput = {
  tool: string;
  args?: Record<string, unknown>;
};

function toWebMcpToolInput(input: unknown): WebMcpToolInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('WebMCP tool input must be an object.');
  }

  const candidate = input as { tool?: unknown; args?: unknown };
  if (typeof candidate.tool !== 'string' || candidate.tool.trim().length === 0) {
    throw new TypeError('WebMCP tool input requires a non-empty tool name.');
  }

  if (candidate.args !== undefined && (!candidate.args || typeof candidate.args !== 'object' || Array.isArray(candidate.args))) {
    throw new TypeError('WebMCP tool args must be an object when provided.');
  }

  return {
    tool: candidate.tool,
    ...(candidate.args ? { args: candidate.args as Record<string, unknown> } : {}),
  };
}

export function createWebMcpTool(modelContext: ModelContext) {
  return tool({
    description: 'Invoke a tool registered by the current page via WebMCP (navigator.modelContext). Use this to interact with page-provided capabilities.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        tool: {
          type: 'string',
          description: 'Name of the WebMCP tool to invoke.',
        },
        args: {
          type: 'object',
          description: 'Arguments to pass to the tool.',
          additionalProperties: true,
        },
      },
      required: ['tool'],
      additionalProperties: false,
    }),
    execute: async (input) => {
      const { tool: toolName, args = {} } = toWebMcpToolInput(input);
      return invokeModelContextTool(modelContext, toolName, args);
    },
  });
}
