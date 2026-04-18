import type { ToolSet } from 'ai';
import { createCliTool } from './cli';
import type { TerminalExecutorContext } from './types';

export type ToolGroup = 'built-in' | 'mcp' | 'webmcp';

export interface ToolDescriptor {
  id: string;
  label: string;
  description: string;
  group: ToolGroup;
  groupLabel: string;
}

export const DEFAULT_TOOL_DESCRIPTORS: ToolDescriptor[] = [
  {
    id: 'cli',
    label: 'CLI',
    description: 'Run bash commands in the active workspace terminal session.',
    group: 'built-in',
    groupLabel: 'Built-In',
  },
];

export const DEFAULT_TOOL_IDS: string[] = DEFAULT_TOOL_DESCRIPTORS.map((descriptor) => descriptor.id);

export function createDefaultTools(context: TerminalExecutorContext) {
  return {
    cli: createCliTool(context),
  };
}

export function selectToolsByIds<T extends ToolSet>(allTools: T, selectedIds: readonly string[]): Partial<T> {
  const allowed = new Set(selectedIds);
  const filtered: Partial<T> = {};
  for (const key of Object.keys(allTools) as Array<keyof T & string>) {
    if (allowed.has(key)) {
      filtered[key] = allTools[key];
    }
  }
  return filtered;
}

export function buildDefaultToolInstructions({
  workspaceName,
  workspacePromptContext,
}: {
  workspaceName: string;
  workspacePromptContext: string;
}): string {
  return [
    'You are a workspace agent for an agent-first browser.',
    `Active workspace: ${workspaceName}`,
    workspacePromptContext,
    'You may call the cli tool to inspect or operate on the active workspace terminal session.',
    'When using cli, prefer short, non-interactive bash commands. Do not use cli for clear or long-running interactive shells.',
    'Each tool call is shown to the user in the chat transcript, so use tools only when they materially help the task.',
    'After any tool usage, answer concisely with what you found or changed.',
  ].join('\n\n');
}