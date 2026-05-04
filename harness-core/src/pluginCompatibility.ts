import {
  HARNESS_PLUGIN_MANIFEST_SCHEMA_VERSION,
  type HarnessPluginCapabilityKind,
  type HarnessPluginComponentContributions,
  type HarnessPluginManifest,
  type HarnessPluginMarketplaceManifest,
  type HarnessPluginSourceFormat,
} from './pluginManifest.js';

export type ExternalPluginEcosystem = Exclude<HarnessPluginSourceFormat, 'agent-harness'>;

export const EXTERNAL_PLUGIN_MANIFEST_LOCATIONS: Record<
  ExternalPluginEcosystem,
  { plugin: string[]; marketplace: string[] }
> = {
  'github-copilot': {
    plugin: ['.plugin/plugin.json', 'plugin.json', '.github/plugin/plugin.json', '.claude-plugin/plugin.json'],
    marketplace: ['marketplace.json', '.plugin/marketplace.json', '.github/plugin/marketplace.json', '.claude-plugin/marketplace.json'],
  },
  'claude-code': {
    plugin: ['.claude-plugin/plugin.json'],
    marketplace: ['.claude-plugin/marketplace.json'],
  },
  pi: {
    plugin: ['package.json'],
    marketplace: ['package.json'],
  },
};

export interface ImportExternalPluginManifestOptions {
  ecosystem: ExternalPluginEcosystem;
  manifest?: Record<string, unknown>;
  packageJson?: Record<string, unknown>;
  directoryName?: string;
}

export interface ImportExternalPluginMarketplaceManifestOptions {
  ecosystem: Exclude<ExternalPluginEcosystem, 'pi'>;
  manifest: Record<string, unknown>;
}

export function importExternalPluginManifest(
  options: ImportExternalPluginManifestOptions,
): HarnessPluginManifest {
  if (options.ecosystem === 'github-copilot') {
    return importCopilotPluginManifest(options.manifest ?? {}, options.directoryName);
  }
  if (options.ecosystem === 'claude-code') {
    return importClaudePluginManifest(options.manifest, options.directoryName);
  }
  return importPiPackageManifest(options.packageJson ?? options.manifest ?? {}, options.directoryName);
}

export function importExternalPluginMarketplaceManifest(
  options: ImportExternalPluginMarketplaceManifestOptions,
): HarnessPluginMarketplaceManifest {
  const owner = asRecord(options.manifest.owner);
  const ownerName = stringValue(owner.name) ?? 'Imported marketplace';
  const metadata = asRecord(options.manifest.metadata);
  const plugins = arrayValue(options.manifest.plugins).map((entry) => (
    importMarketplacePlugin(options.ecosystem, asRecord(entry))
  ));

  return {
    schemaVersion: HARNESS_PLUGIN_MANIFEST_SCHEMA_VERSION,
    name: stringValue(options.manifest.name) ?? 'imported-marketplace',
    publisher: {
      id: toKebabSegment(ownerName, 'imported'),
      name: ownerName,
    },
    plugins,
    metadata: objectWithValues({
      description: metadata.description,
      version: metadata.version,
      pluginRoot: metadata.pluginRoot,
    }),
  };
}

function importCopilotPluginManifest(
  manifest: Record<string, unknown>,
  directoryName: string | undefined,
): HarnessPluginManifest {
  const name = pluginName(manifest, directoryName, 'copilot-plugin');
  const components = componentContributions({
    agents: pathRefs(manifest.agents),
    skills: pathRefs(manifest.skills),
    commands: pathRefs(manifest.commands),
    hooks: configRefs(manifest.hooks),
    mcpServers: configRefs(manifest.mcpServers),
    lspServers: pathRefs(manifest.lspServers),
  });

  return externalManifest({
    sourceFormat: 'github-copilot',
    id: `github-copilot.plugin.${toKebabSegment(name, 'plugin')}`,
    name,
    version: stringValue(manifest.version) ?? '0.0.0',
    description: stringValue(manifest.description) ?? `Imported GitHub Copilot plugin ${name}.`,
    components,
    metadata: metadataFields(manifest),
  });
}

function importClaudePluginManifest(
  manifest: Record<string, unknown> | undefined,
  directoryName: string | undefined,
): HarnessPluginManifest {
  const effectiveManifest = manifest ?? {};
  const name = pluginName(effectiveManifest, directoryName, 'claude-plugin');
  const defaultComponents = manifest ? {} : defaultClaudeComponents();
  const components = componentContributions({
    ...defaultComponents,
    agents: pathRefs(effectiveManifest.agents) ?? defaultComponents.agents,
    skills: pathRefs(effectiveManifest.skills) ?? defaultComponents.skills,
    commands: pathRefs(effectiveManifest.commands) ?? defaultComponents.commands,
    hooks: configRefs(effectiveManifest.hooks) ?? defaultComponents.hooks,
    mcpServers: configRefs(effectiveManifest.mcpServers) ?? defaultComponents.mcpServers,
    lspServers: pathRefs(effectiveManifest.lspServers) ?? defaultComponents.lspServers,
    outputStyles: pathRefs(effectiveManifest.outputStyles ?? effectiveManifest['output-styles']) ?? defaultComponents.outputStyles,
    themes: pathRefs(effectiveManifest.themes) ?? defaultComponents.themes,
    monitors: pathRefs(effectiveManifest.monitors) ?? defaultComponents.monitors,
    bins: pathRefs(effectiveManifest.bin ?? effectiveManifest.bins) ?? defaultComponents.bins,
    settings: pathRefs(effectiveManifest.settings) ?? defaultComponents.settings,
  });

  return externalManifest({
    sourceFormat: 'claude-code',
    id: `claude-code.plugin.${toKebabSegment(name, 'plugin')}`,
    name,
    version: stringValue(effectiveManifest.version) ?? '0.0.0',
    description: stringValue(effectiveManifest.description) ?? `Imported Claude Code plugin ${name}.`,
    components,
    metadata: objectWithValues({
      ...metadataFields(effectiveManifest),
      dependencies: effectiveManifest.dependencies,
      userConfig: effectiveManifest.userConfig,
      channels: effectiveManifest.channels,
    }),
  });
}

function importPiPackageManifest(
  packageJson: Record<string, unknown>,
  directoryName: string | undefined,
): HarnessPluginManifest {
  const pi = asRecord(packageJson.pi);
  const name = stringValue(packageJson.name) ?? directoryName ?? 'pi-package';
  const defaultComponents = Object.keys(pi).length ? {} : defaultPiComponents();
  const components = componentContributions({
    ...defaultComponents,
    extensions: pathRefs(pi.extensions) ?? defaultComponents.extensions,
    skills: pathRefs(pi.skills) ?? defaultComponents.skills,
    prompts: pathRefs(pi.prompts) ?? defaultComponents.prompts,
    themes: pathRefs(pi.themes) ?? defaultComponents.themes,
  });

  return externalManifest({
    sourceFormat: 'pi',
    id: `pi.package.${toKebabSegment(name, 'package')}`,
    name,
    version: stringValue(packageJson.version) ?? '0.0.0',
    description: stringValue(packageJson.description) ?? `Imported Pi package ${name}.`,
    components,
    metadata: objectWithValues({
      keywords: packageJson.keywords,
      gallery: objectWithValues({
        image: pi.image,
        video: pi.video,
      }),
    }),
  });
}

function externalManifest(input: {
  sourceFormat: ExternalPluginEcosystem;
  id: string;
  name: string;
  version: string;
  description: string;
  components: HarnessPluginComponentContributions;
  metadata: Record<string, unknown>;
}): HarnessPluginManifest {
  return {
    schemaVersion: HARNESS_PLUGIN_MANIFEST_SCHEMA_VERSION,
    id: input.id,
    sourceFormat: input.sourceFormat,
    name: input.name,
    version: input.version,
    description: input.description,
    components: input.components,
    capabilities: capabilitiesForComponents(input.components, input.sourceFormat),
    metadata: input.metadata,
  };
}

function importMarketplacePlugin(
  ecosystem: Exclude<ExternalPluginEcosystem, 'pi'>,
  entry: Record<string, unknown>,
): HarnessPluginMarketplaceManifest['plugins'][number] {
  const name = stringValue(entry.name) ?? 'plugin';
  const source = normalizeMarketplaceSource(ecosystem, entry.source);
  const components = componentsFromMarketplaceEntry(ecosystem, entry);
  const pathForManifest = manifestPathForMarketplacePlugin(ecosystem, source);

  return {
    id: `${ecosystem}.plugin.${toKebabSegment(name, 'plugin')}`,
    name,
    version: stringValue(entry.version) ?? '0.0.0',
    description: stringValue(entry.description) ?? `Imported ${ecosystem} marketplace plugin ${name}.`,
    manifest: pathForManifest,
    sourceFormat: ecosystem,
    source,
    components,
    capabilities: capabilitiesForComponents(components, ecosystem),
    strict: typeof entry.strict === 'boolean' ? entry.strict : undefined,
    categories: arrayOfStrings(entry.category ? [entry.category] : undefined),
    keywords: arrayOfStrings(entry.keywords),
    metadata: metadataFields(entry),
  };
}

function componentsFromMarketplaceEntry(
  ecosystem: Exclude<ExternalPluginEcosystem, 'pi'>,
  entry: Record<string, unknown>,
): HarnessPluginComponentContributions {
  if (ecosystem === 'github-copilot') {
    return componentContributions({
      agents: pathRefs(entry.agents),
      skills: pathRefs(entry.skills),
      commands: pathRefs(entry.commands),
      hooks: configRefs(entry.hooks),
      mcpServers: configRefs(entry.mcpServers),
      lspServers: pathRefs(entry.lspServers),
    });
  }

  return componentContributions({
    agents: pathRefs(entry.agents),
    skills: pathRefs(entry.skills),
    commands: pathRefs(entry.commands),
    hooks: configRefs(entry.hooks),
    mcpServers: configRefs(entry.mcpServers),
    lspServers: pathRefs(entry.lspServers),
    outputStyles: pathRefs(entry.outputStyles ?? entry['output-styles']),
    themes: pathRefs(entry.themes),
    monitors: pathRefs(entry.monitors),
  });
}

function normalizeMarketplaceSource(
  ecosystem: Exclude<ExternalPluginEcosystem, 'pi'>,
  value: unknown,
): HarnessPluginMarketplaceManifest['plugins'][number]['source'] {
  if (typeof value === 'string') {
    const path = value.replace(/^\.\//, '');
    return { type: 'local', path };
  }
  const source = asRecord(value);
  const kind = stringValue(source.source) ?? (ecosystem === 'github-copilot' ? 'local' : 'github');
  if (kind === 'github') {
    return objectWithValues({
      type: 'github',
      repo: stringValue(source.repo),
      ref: stringValue(source.ref),
      sha: stringValue(source.sha),
    });
  }
  if (kind === 'git-subdir') {
    return objectWithValues({
      type: 'git-subdir',
      url: stringValue(source.url),
      path: stringValue(source.path),
      ref: stringValue(source.ref),
      sha: stringValue(source.sha),
    });
  }
  if (kind === 'npm') {
    return objectWithValues({
      type: 'npm',
      package: stringValue(source.package),
      version: stringValue(source.version),
      registry: stringValue(source.registry),
    });
  }
  if (kind === 'url') {
    return objectWithValues({
      type: 'git',
      url: stringValue(source.url),
      ref: stringValue(source.ref),
      sha: stringValue(source.sha),
    });
  }
  return objectWithValues({ type: 'local', path: stringValue(source.path) });
}

function manifestPathForMarketplacePlugin(
  ecosystem: Exclude<ExternalPluginEcosystem, 'pi'>,
  source: HarnessPluginMarketplaceManifest['plugins'][number]['source'],
): string | undefined {
  const manifestName = ecosystem === 'github-copilot' ? 'plugin.json' : '.claude-plugin/plugin.json';
  const path = source.path;
  if (typeof path !== 'string' || !path) {
    return undefined;
  }
  return `./${path.replace(/^\.\//, '').replace(/\/$/, '')}/${manifestName}`;
}

function capabilitiesForComponents(
  components: HarnessPluginComponentContributions,
  sourceFormat: ExternalPluginEcosystem,
): Array<{ kind: HarnessPluginCapabilityKind; id: string }> {
  const pairs: Array<[keyof HarnessPluginComponentContributions, HarnessPluginCapabilityKind]> = [
    ['agents', 'chat-agent'],
    ['extensions', 'extension'],
    ['skills', 'skill'],
    ['prompts', 'prompt'],
    ['themes', 'theme'],
    ['commands', 'command'],
    ['hooks', 'hook'],
    ['mcpServers', 'mcp-server'],
    ['lspServers', 'lsp-server'],
    ['outputStyles', 'output-style'],
    ['monitors', 'monitor'],
    ['bins', 'command'],
    ['settings', 'setting'],
  ];
  const capabilities = pairs
    .filter(([key]) => (components[key]?.length ?? 0) > 0)
    .map(([key, kind]) => ({ kind, id: String(key).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`) }));
  if (sourceFormat === 'pi' && (components.extensions?.length ?? 0) > 0) {
    capabilities.push({ kind: 'renderer', id: 'extensions-message-renderers' });
  }
  return capabilities;
}

function defaultClaudeComponents(): HarnessPluginComponentContributions {
  return {
    skills: ['skills/'],
    commands: ['commands/'],
    agents: ['agents/'],
    outputStyles: ['output-styles/'],
    themes: ['themes/'],
    monitors: ['monitors/monitors.json'],
    hooks: ['hooks/hooks.json'],
    mcpServers: ['.mcp.json'],
    lspServers: ['.lsp.json'],
    bins: ['bin/'],
    settings: ['settings.json'],
  };
}

function defaultPiComponents(): HarnessPluginComponentContributions {
  return {
    extensions: ['extensions/'],
    skills: ['skills/'],
    prompts: ['prompts/'],
    themes: ['themes/'],
  };
}

function componentContributions(
  value: HarnessPluginComponentContributions,
): HarnessPluginComponentContributions {
  return Object.fromEntries(Object.entries(value).filter((entry) => entry[1] !== undefined));
}

function pathRefs(value: unknown): string[] | undefined {
  if (typeof value === 'string') return [value];
  const strings = arrayOfStrings(value);
  return strings.length ? strings : undefined;
}

function configRefs(value: unknown): Array<string | { inline: unknown }> | undefined {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return [{ inline: value }];
  return undefined;
}

function pluginName(
  manifest: Record<string, unknown>,
  directoryName: string | undefined,
  fallback: string,
): string {
  return stringValue(manifest.name) ?? directoryName ?? fallback;
}

function metadataFields(source: Record<string, unknown>): Record<string, unknown> {
  return objectWithValues({
    author: source.author,
    homepage: source.homepage,
    repository: source.repository,
    license: source.license,
    keywords: source.keywords,
    category: source.category,
    tags: source.tags,
  });
}

function objectWithValues<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter((entry) => entry[1] !== undefined)) as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function toKebabSegment(value: string, fallback: string): string {
  return value
    .replace(/^@/, '')
    .replace(/[\\/]/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}
