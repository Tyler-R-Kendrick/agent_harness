import { tool } from 'ai';
import { z } from 'zod';
import { invokeModelContextTool, ModelContext } from '@agent-harness/webmcp';

export const WEBMCP_TOOL_ID = 'webmcp';

export const WEBMCP_BUILTIN_DESCRIPTOR = {
  id: WEBMCP_TOOL_ID,
  label: 'WebMCP',
  description: 'Invoke tools registered by the current page via WebMCP.',
  group: 'built-in' as const,
  groupLabel: 'Built-In',
};

export function createWebMcpTool(modelContext: ModelContext) {
  return tool({
    description: 'Invoke a tool registered by the current page via WebMCP (navigator.modelContext). Use this to interact with page-provided capabilities.',
    inputSchema: z.object({
      tool: z.string().describe('Name of the WebMCP tool to invoke.'),
      args: z.record(z.string(), z.unknown()).optional().describe('Arguments to pass to the tool.'),
    }),
    execute: async ({ tool: toolName, args = {} }) =>
      invokeModelContextTool(modelContext, toolName, args as object),
  });
}
