import type { HarnessPlugin, InferenceMessagesPayload, MemoryMessage, WorkspaceFile } from 'harness-core';

export interface AgentsMdHookPluginOptions {
  point?: string;
  activeAgentPath?: string;
  priority?: number;
  role?: string;
}

export interface BuildAgentsMdPromptContextOptions {
  activeAgentPath?: string | null;
}

export function detectAgentsMdFile(path: string): boolean {
  return path === 'AGENTS.md' || path.endsWith('/AGENTS.md');
}

export function validateAgentsMdFile(file: WorkspaceFile): string | null {
  return detectAgentsMdFile(file.path) ? null : 'Unsupported AGENTS.md path.';
}

export function discoverAgentsMdFiles(files: readonly WorkspaceFile[]): WorkspaceFile[] {
  return files.filter((file) => detectAgentsMdFile(file.path));
}

export function buildAgentsMdPromptContext(
  files: readonly WorkspaceFile[],
  options: BuildAgentsMdPromptContextOptions = {},
): string {
  const agents = discoverAgentsMdFiles(files);
  const activeAgent = options.activeAgentPath
    ? agents.find((file) => file.path === options.activeAgentPath) ?? null
    : null;
  const otherAgents = activeAgent
    ? agents.filter((file) => file.path !== activeAgent.path)
    : agents;

  if (activeAgent) {
    return [
      `Active AGENTS.md:\n- ${activeAgent.path}\n${activeAgent.content}`,
      otherAgents.length
        ? `Other AGENTS.md files:\n${otherAgents.map(formatAgentFile).join('\n')}`
        : null,
    ].filter((section): section is string => Boolean(section)).join('\n\n');
  }

  return otherAgents.length
    ? `AGENTS.md files:\n${otherAgents.map(formatAgentFile).join('\n')}`
    : 'AGENTS.md files: none';
}

export function createAgentsMdHookPlugin<TMessage extends MemoryMessage = MemoryMessage>(
  files: readonly WorkspaceFile[],
  options: AgentsMdHookPluginOptions = {},
): HarnessPlugin<TMessage, InferenceMessagesPayload<TMessage>> {
  return {
    id: 'agents-md',
    register({ hooks }) {
      hooks.registerPipe({
        id: 'agents-md',
        point: options.point ?? 'before-llm-messages',
        kind: 'deterministic',
        priority: options.priority ?? -10_000,
        run: ({ payload }) => ({
          payload: {
            ...payload,
            messages: [
              {
                role: options.role ?? 'system',
                content: buildAgentsMdPromptContext(files, { activeAgentPath: options.activeAgentPath }),
              } as unknown as TMessage,
              ...payload.messages,
            ],
          },
        }),
      });
    },
  };
}

function formatAgentFile(file: WorkspaceFile): string {
  return `- ${file.path}\n${file.content}`;
}
