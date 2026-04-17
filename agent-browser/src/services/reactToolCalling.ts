import type { LanguageModelV3FunctionTool } from '@ai-sdk/provider';

export function buildReActToolsSection(tools: LanguageModelV3FunctionTool[]): string {
  if (!tools.length) return '';

  const lines = [
    '## Tools',
    '',
    'You have access to the following tools. To call a tool, output EXACTLY:',
    '<tool_call>{"tool": "<name>", "args": {<arguments>}}</tool_call>',
    '',
    'Then stop immediately. Wait for the tool result before continuing.',
    '',
    'Available tools:',
  ];

  for (const tool of tools) {
    const params = (tool.inputSchema as Record<string, unknown> | undefined) ?? {};
    const props = (params.properties as Record<string, { description?: string; type?: string }>) ?? {};
    const paramList = Object.entries(props)
      .map(([key, value]) => `${key}: ${value.type ?? 'any'}${value.description ? ` (${value.description})` : ''}`)
      .join(', ');
    lines.push(`- ${tool.name}(${paramList})${tool.description ? `: ${tool.description}` : ''}`);
  }

  return lines.join('\n');
}

export type ParsedToolCall = { toolName: string; args: Record<string, unknown> } | null;

export function parseToolCall(text: string): ParsedToolCall {
  const match = /<tool_call>([\s\S]*?)<\/tool_call>/.exec(text);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]) as { tool: string; args?: Record<string, unknown> };
    return { toolName: parsed.tool, args: parsed.args ?? {} };
  } catch {
    return null;
  }
}