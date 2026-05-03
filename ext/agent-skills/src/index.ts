import type { HarnessPlugin, MemoryMessage, WorkspaceFile } from 'harness-core';

export const WORKSPACE_AGENT_SKILL_DIRECTORIES = ['.agents/skill/', '.agents/skills/'] as const;
export const WORKSPACE_SKILL_DIRECTORIES = WORKSPACE_AGENT_SKILL_DIRECTORIES;

const KEBAB_CASE_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface WorkspaceAgentSkill {
  path: string;
  directory: string;
  name: string;
  description: string;
  content: string;
}

export interface AgentSkillExecutionRequest {
  skill: WorkspaceAgentSkill;
  input: string;
  args: Record<string, unknown>;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export interface AgentSkillsClient {
  executeSkill: (request: AgentSkillExecutionRequest) => Promise<unknown> | unknown;
}

export interface AgentSkillsPluginOptions {
  client: AgentSkillsClient;
  commandId?: string;
  commandPattern?: RegExp;
  toolIdPrefix?: string;
}

export function detectAgentSkillFile(path: string): boolean {
  return WORKSPACE_AGENT_SKILL_DIRECTORIES.some((directory) => path.startsWith(directory) && path.endsWith('/SKILL.md'));
}

export function validateAgentSkillFile(file: WorkspaceFile): string | null {
  const root = WORKSPACE_AGENT_SKILL_DIRECTORIES.find((directory) => file.path.startsWith(directory));
  if (!root || !file.path.endsWith('/SKILL.md')) return 'Unsupported agent skill path.';

  const remainder = file.path.slice(root.length);
  const [directoryName, maybeSkillFile, ...rest] = remainder.split('/');
  if (!directoryName || maybeSkillFile !== 'SKILL.md' || rest.length) return 'Skills must use <dir>/SKILL.md paths.';
  if (!KEBAB_CASE_SEGMENT.test(directoryName)) return 'Skill directories must be lowercase kebab-case.';
  return null;
}

export function discoverAgentSkills(files: readonly WorkspaceFile[]): WorkspaceAgentSkill[] {
  return files
    .filter((file) => detectAgentSkillFile(file.path))
    .map((file) => {
      const segments = file.path.split('/');
      const directory = segments.at(-2) as string;
      const parsed = parseSkillFrontmatter(file.content);
      return {
        path: file.path,
        directory,
        name: parsed?.name ?? directory,
        description: parsed?.description ?? 'Skill file is missing required frontmatter.',
        content: file.content,
      };
    });
}

export function createAgentSkillsPlugin<TMessage extends MemoryMessage = MemoryMessage>(
  files: readonly WorkspaceFile[],
  options: AgentSkillsPluginOptions,
): HarnessPlugin<TMessage> {
  const skills = discoverAgentSkills(files);
  const toolIdPrefix = options.toolIdPrefix ?? 'agent-skill:';
  const commandId = options.commandId ?? 'agent-skills';

  return {
    id: 'agent-skills',
    register({ commands, tools }) {
      for (const skill of skills) {
        tools.register({
          id: `${toolIdPrefix}${skill.name}`,
          description: skill.description,
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string' },
            },
          },
          execute: (args, context) => options.client.executeSkill({
            skill,
            input: readInputArg(args),
            args: toRecord(args),
            signal: context?.signal,
            metadata: context?.metadata,
          }),
        });
      }

      commands.register({
        id: commandId,
        description: 'Run an agent skill through the configured agent-skills client.',
        pattern: options.commandPattern ?? /^\/skill\s+(?<name>[a-z0-9]+(?:-[a-z0-9]+)*)(?:\s+(?<input>[\s\S]*))?$/i,
        target: {
          type: 'handler',
          run: (args, context) => {
            const skillName = String(args.name);
            const skill = skills.find((entry) => entry.name === skillName);
            if (!skill) throw new Error(`Unknown agent skill: ${skillName}`);
            return options.client.executeSkill({
              skill,
              input: readInputArg(args),
              args,
              signal: context.signal,
              metadata: context.metadata,
            });
          },
        },
        parseArgs: ({ groups }) => ({
          name: groups.name,
          input: groups.input ?? '',
        }),
      });
    },
  };
}

function parseSkillFrontmatter(content: string): Pick<WorkspaceAgentSkill, 'name' | 'description'> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const values = Object.fromEntries(match[1].split('\n').map((line) => {
    const [key, ...rest] = line.split(':');
    return [key.trim(), rest.join(':').trim().replace(/^"|"$/g, '')];
  }));
  return values.name && values.description
    ? { name: values.name, description: values.description }
    : null;
}

function readInputArg(args: unknown): string {
  return typeof args === 'object'
    && args !== null
    && 'input' in args
    && typeof args.input === 'string'
    ? args.input
    : '';
}

function toRecord(args: unknown): Record<string, unknown> {
  return typeof args === 'object' && args !== null ? args as Record<string, unknown> : {};
}
