export type WorkspaceFileKind = 'agents' | 'skill' | 'plugin' | 'hook' | 'memory';

export interface WorkspaceFile {
  path: string;
  content: string;
  updatedAt?: string;
}

export interface WorkspaceSkill {
  path: string;
  directory: string;
  name: string;
  description: string;
  content: string;
}

export interface WorkspacePlugin {
  path: string;
  directory: string;
  manifestName: string;
  content: string;
}

export interface WorkspaceHook {
  path: string;
  name: string;
  content: string;
}

export interface WorkspaceCapabilities {
  agents: WorkspaceFile[];
  skills: WorkspaceSkill[];
  plugins: WorkspacePlugin[];
  hooks: WorkspaceHook[];
  memory: WorkspaceFile[];
}

export interface BuildAgentsPromptContextOptions {
  activeAgentPath?: string | null;
}

export const WORKSPACE_SKILL_DIRECTORIES = ['.agents/skill/', '.agents/skills/'] as const;

const PLUGIN_MANIFESTS = ['plugin.yaml', 'plugin.yml', 'plugin.json', 'manifest.json', 'marketplace.json'] as const;
const KEBAB_CASE_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HOOK_FILENAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$/;

export function detectWorkspaceFileKind(path: string): WorkspaceFileKind | null {
  if (path === 'AGENTS.md' || path.endsWith('/AGENTS.md')) return 'agents';
  if (WORKSPACE_SKILL_DIRECTORIES.some((directory) => path.startsWith(directory) && path.endsWith('/SKILL.md'))) return 'skill';
  if (path.startsWith('.agents/hooks/')) return 'hook';
  if (path.startsWith('.agents/plugins/')) return 'plugin';
  if (path.startsWith('.memory/')) return 'memory';
  return null;
}

export function validateWorkspaceFile(file: WorkspaceFile): string | null {
  const kind = detectWorkspaceFileKind(file.path);
  if (!kind) return 'Unsupported workspace file path.';

  if (kind === 'agents') {
    return null;
  }

  if (kind === 'skill') {
    const root = WORKSPACE_SKILL_DIRECTORIES.find((directory) => file.path.startsWith(directory)) as string;
    const remainder = file.path.slice(root.length);
    const [directoryName, maybeSkillFile, ...rest] = remainder.split('/');
    if (!directoryName || !maybeSkillFile || rest.length) return 'Skills must use <dir>/SKILL.md paths.';
    if (!KEBAB_CASE_SEGMENT.test(directoryName)) return 'Skill directories must be lowercase kebab-case.';
    return null;
  }

  if (kind === 'hook') {
    const remainder = file.path.replace(/^\.agents\/hooks\//, '');
    const [fileName, ...rest] = remainder.split('/');
    if (!fileName || rest.length) return 'Hooks must use .agents/hooks/<name>.<ext> paths.';
    if (!HOOK_FILENAME.test(fileName)) return 'Hooks must be single lowercase kebab-case files with an extension.';
    return null;
  }

  if (kind === 'plugin') {
    const remainder = file.path.replace(/^\.agents\/plugins\//, '');
    const [directoryName, manifestName, ...rest] = remainder.split('/');
    if (!directoryName || !manifestName || rest.length) return 'Plugins must use .agents/plugins/<plugin>/<manifest> paths.';
    if (!KEBAB_CASE_SEGMENT.test(directoryName)) return 'Plugin directories must be lowercase kebab-case.';
    if (!PLUGIN_MANIFESTS.includes(manifestName as (typeof PLUGIN_MANIFESTS)[number])) return 'Plugins must use a supported manifest filename.';
    return null;
  }

  return null;
}

export function discoverWorkspaceCapabilities(files: readonly WorkspaceFile[]): WorkspaceCapabilities {
  const agents = files.filter((file) => detectWorkspaceFileKind(file.path) === 'agents');
  const memory = files.filter((file) => detectWorkspaceFileKind(file.path) === 'memory');
  const hooks = files
    .filter((file) => detectWorkspaceFileKind(file.path) === 'hook')
    .map((file) => ({ path: file.path, name: file.path.split('/').pop() as string, content: file.content }));
  const plugins = files
    .filter((file) => detectWorkspaceFileKind(file.path) === 'plugin')
    .map((file) => {
      const segments = file.path.split('/');
      return {
        path: file.path,
        directory: segments[2] as string,
        manifestName: segments.at(-1) as string,
        content: file.content,
      };
    });
  const skills = files
    .filter((file) => detectWorkspaceFileKind(file.path) === 'skill')
    .map((file) => {
      const parsed = parseSkillFrontmatter(file.content);
      const segments = file.path.split('/');
      const directory = segments[2] as string;
      return parsed
        ? { path: file.path, directory, name: parsed.name, description: parsed.description, content: file.content }
        : { path: file.path, directory, name: directory, description: 'Skill file is missing required frontmatter.', content: file.content };
    });

  return { agents, skills, plugins, hooks, memory };
}

export function buildAgentsPromptContext(
  files: readonly WorkspaceFile[],
  options: BuildAgentsPromptContextOptions = {},
): string {
  const capabilities = discoverWorkspaceCapabilities(files);
  const activeAgent = options.activeAgentPath
    ? capabilities.agents.find((file) => file.path === options.activeAgentPath) ?? null
    : null;
  const otherAgents = activeAgent
    ? capabilities.agents.filter((file) => file.path !== activeAgent.path)
    : capabilities.agents;
  if (!hasWorkspaceCapabilities(capabilities)) {
    return 'No workspace capability files are currently stored.';
  }

  return [
    'Workspace capability files:',
    activeAgent
      ? `Active AGENTS.md:\n- ${activeAgent.path}\n${activeAgent.content}`
      : (otherAgents.length
          ? `AGENTS.md files:\n${otherAgents.map((file) => `- ${file.path}\n${file.content}`).join('\n')}`
          : 'AGENTS.md files: none'),
    activeAgent && otherAgents.length
      ? `Other AGENTS.md files:\n${otherAgents.map((file) => `- ${file.path}\n${file.content}`).join('\n')}`
      : null,
    capabilities.skills.length
      ? `Skills:\n${capabilities.skills.map((skill) => `- ${skill.name} (${skill.path}): ${skill.description}`).join('\n')}`
      : 'Skills: none',
    capabilities.plugins.length
      ? `Plugins:\n${capabilities.plugins.map((plugin) => `- ${plugin.directory} (${plugin.path})`).join('\n')}`
      : 'Plugins: none',
    capabilities.hooks.length
      ? `Hooks:\n${capabilities.hooks.map((hook) => `- ${hook.name} (${hook.path})`).join('\n')}`
      : 'Hooks: none',
    capabilities.memory.length
      ? `Memory files:\n${capabilities.memory.map((file) => `- ${file.path}`).join('\n')}`
      : null,
  ].filter((section): section is string => Boolean(section)).join('\n\n');
}

export const buildWorkspacePromptContext = buildAgentsPromptContext;

function hasWorkspaceCapabilities(capabilities: WorkspaceCapabilities): boolean {
  return capabilities.agents.length
    + capabilities.skills.length
    + capabilities.plugins.length
    + capabilities.hooks.length
    + capabilities.memory.length > 0;
}

function parseSkillFrontmatter(content: string): Pick<WorkspaceSkill, 'name' | 'description'> | null {
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
