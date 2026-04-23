import type { LanguageModelV3FunctionTool } from '@ai-sdk/provider';
import type { ToolDescriptor, ToolGroupDescriptor } from '../tools';

export function buildReActToolsSection(tools: LanguageModelV3FunctionTool[]): string {
  if (!tools.length) return '';

  const lines = [
    '## Tools',
    '',
    'You have access to the tools listed below.',
    '',
    'CRITICAL RULES:',
    '1. You MUST call at least one tool before producing any final answer. Do NOT respond with prose, plans, "I will…" statements, or "let me know your constraints" — call a tool first.',
    '2. To call a tool, output EXACTLY:',
    '   <tool_call>{"tool": "<name>", "args": {<arguments>}}</tool_call>',
    '   Then stop immediately. The runtime will execute the tool and return a <tool_result>…</tool_result> block.',
    '3. After receiving a <tool_result>, you may either call another tool the same way OR write a final answer that summarizes what the tool produced.',
    '4. Never invent tool results. Never claim a tool was called unless you emitted the exact <tool_call> block above.',
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

export function buildToolGroupCatalog(groups: ToolGroupDescriptor[]): string {
  if (!groups.length) return '';

  const lines = [
    '## Tool Groups',
    '',
    'Pick the smallest set of tool groups needed for the task.',
    'Respond with JSON only: {"groups":["<group-id>"],"goal":"<short goal>"}',
    '',
    'Available groups:',
  ];

  for (const group of groups) {
    lines.push(`- ${group.id} (${group.label}) [${group.toolIds.length} tools]: ${group.description}`);
  }

  return lines.join('\n');
}

export function buildToolDescriptorCatalog(
  descriptors: Array<Pick<ToolDescriptor, 'id' | 'label' | 'description'>>,
): string {
  if (!descriptors.length) return '';

  const lines = [
    '## Tools',
    '',
    'Pick the smallest set of specific tools needed for the task.',
    'Respond with JSON only: {"toolIds":["<tool-id>"],"goal":"<short goal>"}',
    '',
    'Available tools:',
  ];

  for (const descriptor of descriptors) {
    lines.push(`- ${descriptor.id} (${descriptor.label}): ${descriptor.description}`);
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