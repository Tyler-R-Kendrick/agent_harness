export type WorkspaceFileKind = 'tool' | 'plugin' | 'hook' | 'memory';

export interface WorkspaceFile {
  path: string;
  content: string;
  updatedAt?: string;
}

export interface WorkspaceTool {
  path: string;
  directory: string;
  manifestName: string;
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
  tools: WorkspaceTool[];
  plugins: WorkspacePlugin[];
  hooks: WorkspaceHook[];
  memory: WorkspaceFile[];
}

const TOOL_MANIFESTS = ['tool.yaml', 'tool.yml', 'tool.json', 'manifest.json'] as const;
const PLUGIN_MANIFESTS = ['plugin.yaml', 'plugin.yml', 'plugin.json', 'manifest.json', 'marketplace.json'] as const;
const KEBAB_CASE_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HOOK_FILENAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$/;

export function detectWorkspaceFileKind(path: string): WorkspaceFileKind | null {
  if (path.startsWith('.agents/tools/')) return 'tool';
  if (path.startsWith('.agents/hooks/')) return 'hook';
  if (path.startsWith('.agents/plugins/')) return 'plugin';
  if (path.startsWith('.memory/')) return 'memory';
  return null;
}

export function validateWorkspaceFile(file: WorkspaceFile): string | null {
  const kind = detectWorkspaceFileKind(file.path);
  if (!kind) return 'Unsupported workspace file path.';

  if (kind === 'tool') {
    return validateManifestPath(file.path, '.agents/tools/', 'Tool', TOOL_MANIFESTS);
  }

  if (kind === 'hook') {
    const remainder = file.path.replace(/^\.agents\/hooks\//, '');
    const [fileName, ...rest] = remainder.split('/');
    if (!fileName || rest.length) return 'Hooks must use .agents/hooks/<name>.<ext> paths.';
    if (!HOOK_FILENAME.test(fileName)) return 'Hooks must be single lowercase kebab-case files with an extension.';
    return null;
  }

  if (kind === 'plugin') {
    return validateManifestPath(file.path, '.agents/plugins/', 'Plugin', PLUGIN_MANIFESTS);
  }

  return null;
}

export function discoverWorkspaceCapabilities(files: readonly WorkspaceFile[]): WorkspaceCapabilities {
  const tools = files
    .filter((file) => detectWorkspaceFileKind(file.path) === 'tool')
    .map((file) => toManifestCapability(file, '.agents/tools/'));
  const plugins = files
    .filter((file) => detectWorkspaceFileKind(file.path) === 'plugin')
    .map((file) => toManifestCapability(file, '.agents/plugins/'));
  const hooks = files
    .filter((file) => detectWorkspaceFileKind(file.path) === 'hook')
    .map((file) => ({ path: file.path, name: file.path.split('/').pop() as string, content: file.content }));
  const memory = files.filter((file) => detectWorkspaceFileKind(file.path) === 'memory');

  return { tools, plugins, hooks, memory };
}

export function buildWorkspacePromptContext(files: readonly WorkspaceFile[]): string {
  const capabilities = discoverWorkspaceCapabilities(files);
  if (!hasWorkspaceCapabilities(capabilities)) {
    return 'No workspace capability files are currently stored.';
  }

  return [
    'Workspace capability files:',
    capabilities.tools.length
      ? `Tools:\n${capabilities.tools.map((tool) => `- ${tool.directory} (${tool.path})`).join('\n')}`
      : 'Tools: none',
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

function hasWorkspaceCapabilities(capabilities: WorkspaceCapabilities): boolean {
  return capabilities.tools.length
    + capabilities.plugins.length
    + capabilities.hooks.length
    + capabilities.memory.length > 0;
}

function validateManifestPath(
  path: string,
  root: string,
  label: 'Plugin' | 'Tool',
  manifests: readonly string[],
): string | null {
  const remainder = path.slice(root.length);
  const [directoryName, manifestName, ...rest] = remainder.split('/');
  if (!directoryName || !manifestName || rest.length) return `${label}s must use ${root}<${label.toLowerCase()}>/<manifest> paths.`;
  if (!KEBAB_CASE_SEGMENT.test(directoryName)) return `${label} directories must be lowercase kebab-case.`;
  if (!manifests.includes(manifestName)) return `${label}s must use a supported manifest filename.`;
  return null;
}

function toManifestCapability(file: WorkspaceFile, root: string): WorkspaceTool {
  const [directory, manifestName] = file.path.slice(root.length).split('/');
  return {
    path: file.path,
    directory: directory as string,
    manifestName: manifestName as string,
    content: file.content,
  };
}
