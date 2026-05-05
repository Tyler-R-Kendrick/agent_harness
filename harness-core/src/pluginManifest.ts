import { z } from 'zod';

import { hookPointForEvent, type HarnessHookEventDescriptor } from './hooks.js';
import type {
  HarnessPaneItemDefinition,
  HarnessRendererDefinition,
} from './renderers.js';

export const HARNESS_PLUGIN_MANIFEST_FILENAME = 'agent-harness.plugin.json';
export const HARNESS_PLUGIN_MARKETPLACE_MANIFEST_FILENAME = 'agent-harness.marketplace.json';
export const HARNESS_PLUGIN_MANIFEST_SCHEMA_VERSION = 1;

export type HarnessPluginCapabilityKind =
  | 'tool'
  | 'command'
  | 'hook'
  | 'skill'
  | 'memory'
  | 'artifact'
  | 'setting'
  | 'mcp-server'
  | 'lsp-server'
  | 'model-provider'
  | 'chat-agent'
  | 'output-style'
  | 'theme'
  | 'monitor'
  | 'prompt'
  | 'extension'
  | 'renderer'
  | 'pane-item'
  | 'asset'
  | 'event';

export type HarnessPluginSourceFormat = 'agent-harness' | 'github-copilot' | 'claude-code' | 'pi';

export type HarnessPluginComponentRef = string | { inline: unknown };

export type HarnessPluginModelProviderKind =
  | 'openai-compatible'
  | 'github-copilot'
  | 'codex-cli'
  | 'cursor-sdk'
  | 'browser-local';

export type HarnessPluginAgentContributionKind =
  | 'agent-harness'
  | 'agent-skill'
  | 'mcp'
  | 'a2a'
  | 'claude-code'
  | 'github-copilot'
  | 'pi';

export type HarnessPluginToolContributionKind =
  | 'harness-tool'
  | 'mcp'
  | 'agent-skill'
  | 'a2a'
  | 'command';

export interface HarnessPluginModelProviderContribution {
  id: string;
  label: string;
  kind: HarnessPluginModelProviderKind;
  providerIds?: string[];
  description?: string;
  source?: string;
  configuration?: Record<string, unknown>;
  defaultConfiguration?: unknown;
}

export interface HarnessPluginHarnessContribution {
  id: string;
  label: string;
  format: HarnessPluginSourceFormat;
  description?: string;
  source?: string;
  configuration?: Record<string, unknown>;
}

export interface HarnessPluginAgentContribution {
  id: string;
  label: string;
  kind: HarnessPluginAgentContributionKind;
  description?: string;
  source?: string;
  configuration?: Record<string, unknown>;
}

export interface HarnessPluginToolContribution {
  id: string;
  label: string;
  kind: HarnessPluginToolContributionKind;
  description?: string;
  source?: string;
  configuration?: Record<string, unknown>;
}

export interface HarnessPluginContributions {
  modelProviders?: HarnessPluginModelProviderContribution[];
  harnesses?: HarnessPluginHarnessContribution[];
  agents?: HarnessPluginAgentContribution[];
  tools?: HarnessPluginToolContribution[];
}

export interface HarnessPluginComponentContributions {
  agents?: HarnessPluginComponentRef[];
  skills?: HarnessPluginComponentRef[];
  commands?: HarnessPluginComponentRef[];
  hooks?: HarnessPluginComponentRef[];
  mcpServers?: HarnessPluginComponentRef[];
  lspServers?: HarnessPluginComponentRef[];
  outputStyles?: HarnessPluginComponentRef[];
  themes?: HarnessPluginComponentRef[];
  monitors?: HarnessPluginComponentRef[];
  extensions?: HarnessPluginComponentRef[];
  prompts?: HarnessPluginComponentRef[];
  bins?: HarnessPluginComponentRef[];
  settings?: HarnessPluginComponentRef[];
}

export interface HarnessPluginManifest {
  schemaVersion: typeof HARNESS_PLUGIN_MANIFEST_SCHEMA_VERSION;
  id: string;
  sourceFormat?: HarnessPluginSourceFormat;
  name: string;
  version: string;
  description: string;
  activationEvents?: string[];
  entrypoint?: {
    module: string;
    export?: string;
  };
  contributes?: HarnessPluginContributions;
  components?: HarnessPluginComponentContributions;
  metadata?: Record<string, unknown>;
  capabilities?: Array<{
    kind: HarnessPluginCapabilityKind;
    id: string;
    event?: HarnessHookEventDescriptor;
    description?: string;
  }>;
  renderers?: HarnessRendererDefinition[];
  paneItems?: HarnessPaneItemDefinition[];
  events?: Array<HarnessHookEventDescriptor & { description?: string }>;
  assets?: Array<{
    kind: 'example' | 'runtime' | 'documentation' | 'fixture';
    path: string;
    description?: string;
  }>;
  permissions?: Array<{
    scope: 'workspace-files' | 'filesystem' | 'network' | 'secrets' | 'browser' | 'shell' | 'storage';
    access: 'read' | 'write' | 'execute' | 'read-write';
    reason: string;
  }>;
  compatibility?: {
    harnessCore?: string;
    agentBrowser?: string;
  };
}

export interface HarnessPluginMarketplaceManifest {
  schemaVersion: typeof HARNESS_PLUGIN_MANIFEST_SCHEMA_VERSION;
  name: string;
  publisher: {
    id: string;
    name: string;
  };
  plugins: Array<{
    id: string;
    name: string;
    version: string;
    description: string;
    manifest?: string;
    sourceFormat?: HarnessPluginSourceFormat;
    source: {
      type: 'local' | 'git' | 'github' | 'git-subdir' | 'npm' | 'url';
      path?: string;
      url?: string;
      repo?: string;
      package?: string;
      version?: string;
      registry?: string;
      ref?: string;
      sha?: string;
    };
    activationEvents?: string[];
    contributes?: HarnessPluginContributions;
    components?: HarnessPluginComponentContributions;
    capabilities?: Array<{
      kind: HarnessPluginCapabilityKind;
      id: string;
      event?: HarnessHookEventDescriptor;
      description?: string;
    }>;
    strict?: boolean;
    metadata?: Record<string, unknown>;
    categories?: string[];
    keywords?: string[];
    default?: boolean;
  }>;
  metadata?: Record<string, unknown>;
}

export interface HarnessManifestValidationResult {
  success: boolean;
  issues: string[];
}

const PLUGIN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*){2,}$/;
const EVENT_NAME_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const ACTIVATION_EVENT_PATTERN = /^(?:\*|[A-Za-z0-9_.:-]+)$/;
const EXPORT_NAME_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const RELATIVE_PACKAGE_PATH_PATTERN = /^\.\/(?!.*(?:^|\/)\.\.(?:\/|$)).+/;
const SAFE_COMPONENT_PATH_PATTERN = /^(?!\/|[A-Za-z]:)(?!.*(?:^|[\\/])\.\.(?:[\\/]|$)).+/;
const FILE_EXTENSION_PATTERN = /^\.[A-Za-z0-9][A-Za-z0-9.+_-]*$/;
const MIME_TYPE_PATTERN = /^[a-z0-9.+-]+\/(?:[a-z0-9.+-]+|\*)$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const CAPABILITY_KINDS = new Set<HarnessPluginCapabilityKind>([
  'tool',
  'command',
  'hook',
  'skill',
  'memory',
  'artifact',
  'setting',
  'mcp-server',
  'lsp-server',
  'model-provider',
  'chat-agent',
  'output-style',
  'theme',
  'monitor',
  'prompt',
  'extension',
  'renderer',
  'pane-item',
  'asset',
  'event',
]);

const hookEventSchema = z.object({
  type: z.enum(['llm', 'agent', 'harness', 'system', 'plugin']),
  name: z.string().regex(EVENT_NAME_PATTERN, 'Hook event names must be lowercase dot- or kebab-case.'),
});

const capabilitySchema = z.object({
  kind: z.string(),
  id: z.string().regex(EVENT_NAME_PATTERN, 'Capability ids must be lowercase dot- or kebab-case.'),
  event: hookEventSchema.optional(),
  description: z.string().optional(),
}).superRefine((value, context) => {
  if (!CAPABILITY_KINDS.has(value.kind as HarnessPluginCapabilityKind)) {
    context.addIssue({
      code: 'custom',
      path: ['kind'],
      message: `Capability kind "${value.kind}" is not part of the core plugin standard.`,
    });
  }
});

const sourceFormatSchema = z.enum(['agent-harness', 'github-copilot', 'claude-code', 'pi']);

const componentRefSchema = z.union([
  z.string().regex(SAFE_COMPONENT_PATH_PATTERN, 'Component paths must stay inside the plugin package.'),
  z.object({ inline: z.unknown() }),
]);

const contributionIdSchema = z.string().regex(EVENT_NAME_PATTERN, 'Contribution ids must be lowercase dot- or kebab-case.');
const contributionSourceSchema = z.string().regex(
  SAFE_COMPONENT_PATH_PATTERN,
  'Contribution sources must stay inside the plugin package.',
);

const MODEL_PROVIDER_KINDS = new Set<HarnessPluginModelProviderKind>([
  'openai-compatible',
  'github-copilot',
  'codex-cli',
  'cursor-sdk',
  'browser-local',
]);

const AGENT_CONTRIBUTION_KINDS = new Set<HarnessPluginAgentContributionKind>([
  'agent-harness',
  'agent-skill',
  'mcp',
  'a2a',
  'claude-code',
  'github-copilot',
  'pi',
]);

const TOOL_CONTRIBUTION_KINDS = new Set<HarnessPluginToolContributionKind>([
  'harness-tool',
  'mcp',
  'agent-skill',
  'a2a',
  'command',
]);

const modelProviderContributionSchema = z.object({
  id: contributionIdSchema,
  label: z.string().min(1, 'Model provider labels are required.'),
  kind: z.string(),
  providerIds: z.array(contributionIdSchema).optional(),
  description: z.string().optional(),
  source: contributionSourceSchema.optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
  defaultConfiguration: z.unknown().optional(),
}).superRefine((value, context) => {
  if (!MODEL_PROVIDER_KINDS.has(value.kind as HarnessPluginModelProviderKind)) {
    context.addIssue({
      code: 'custom',
      path: ['kind'],
      message: `Model provider kind "${value.kind}" is not part of the core extension standard.`,
    });
  }
});

const harnessContributionSchema = z.object({
  id: contributionIdSchema,
  label: z.string().min(1, 'Harness labels are required.'),
  format: sourceFormatSchema,
  description: z.string().optional(),
  source: contributionSourceSchema.optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
});

const agentContributionSchema = z.object({
  id: contributionIdSchema,
  label: z.string().min(1, 'Agent labels are required.'),
  kind: z.string(),
  description: z.string().optional(),
  source: contributionSourceSchema.optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
}).superRefine((value, context) => {
  if (!AGENT_CONTRIBUTION_KINDS.has(value.kind as HarnessPluginAgentContributionKind)) {
    context.addIssue({
      code: 'custom',
      path: ['kind'],
      message: `Agent contribution kind "${value.kind}" is not part of the core extension standard.`,
    });
  }
});

const toolContributionSchema = z.object({
  id: contributionIdSchema,
  label: z.string().min(1, 'Tool labels are required.'),
  kind: z.string(),
  description: z.string().optional(),
  source: contributionSourceSchema.optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
}).superRefine((value, context) => {
  if (!TOOL_CONTRIBUTION_KINDS.has(value.kind as HarnessPluginToolContributionKind)) {
    context.addIssue({
      code: 'custom',
      path: ['kind'],
      message: `Tool contribution kind "${value.kind}" is not part of the core extension standard.`,
    });
  }
});

const contributesSchema = z.object({
  modelProviders: z.array(modelProviderContributionSchema).optional(),
  harnesses: z.array(harnessContributionSchema).optional(),
  agents: z.array(agentContributionSchema).optional(),
  tools: z.array(toolContributionSchema).optional(),
}).optional();

const componentsSchema = z.object({
  agents: z.array(componentRefSchema).optional(),
  skills: z.array(componentRefSchema).optional(),
  commands: z.array(componentRefSchema).optional(),
  hooks: z.array(componentRefSchema).optional(),
  mcpServers: z.array(componentRefSchema).optional(),
  lspServers: z.array(componentRefSchema).optional(),
  outputStyles: z.array(componentRefSchema).optional(),
  themes: z.array(componentRefSchema).optional(),
  monitors: z.array(componentRefSchema).optional(),
  extensions: z.array(componentRefSchema).optional(),
  prompts: z.array(componentRefSchema).optional(),
  bins: z.array(componentRefSchema).optional(),
  settings: z.array(componentRefSchema).optional(),
}).optional();

const rendererComponentSchema = z.object({
  module: z.string().regex(
    RELATIVE_PACKAGE_PATH_PATTERN,
    'Renderer modules must be relative paths inside the plugin package.',
  ),
  export: z.string().regex(EXPORT_NAME_PATTERN, 'Renderer exports must be JavaScript export names.').optional(),
});

const rendererTargetSchema = z.object({
  kind: z.enum(['file', 'artifact', 'message', 'workspace-item']),
  fileNames: z.array(z.string().min(1)).optional(),
  fileExtensions: z.array(z.string().regex(FILE_EXTENSION_PATTERN, 'File extensions must include a leading dot.')).optional(),
  mimeTypes: z.array(z.string().regex(MIME_TYPE_PATTERN, 'MIME types must use type/subtype or type/*.')).optional(),
  artifactKinds: z.array(z.string().regex(EVENT_NAME_PATTERN)).optional(),
  messageTypes: z.array(z.string().regex(EVENT_NAME_PATTERN)).optional(),
  workspaceItemTypes: z.array(z.string().regex(EVENT_NAME_PATTERN)).optional(),
});

const paneItemSchema = z.object({
  id: z.string().regex(EVENT_NAME_PATTERN, 'Pane item ids must be lowercase dot- or kebab-case.'),
  label: z.string().min(1, 'Pane item label is required.'),
  description: z.string().optional(),
  rendererId: z.string().regex(EVENT_NAME_PATTERN).optional(),
  preferredLocation: z.enum(['main', 'side', 'bottom', 'modal']).optional(),
  when: rendererTargetSchema,
  component: rendererComponentSchema.optional(),
  priority: z.number().optional(),
});

const rendererSchema = z.object({
  id: z.string().regex(EVENT_NAME_PATTERN, 'Renderer ids must be lowercase dot- or kebab-case.'),
  label: z.string().min(1, 'Renderer label is required.'),
  description: z.string().optional(),
  target: rendererTargetSchema,
  component: rendererComponentSchema,
  paneItem: paneItemSchema.optional(),
  priority: z.number().optional(),
});

const pluginManifestSchema = z.object({
  schemaVersion: z.literal(HARNESS_PLUGIN_MANIFEST_SCHEMA_VERSION),
  id: z.string().regex(PLUGIN_ID_PATTERN, 'Plugin id must use reverse-DNS lowercase segments.'),
  sourceFormat: sourceFormatSchema.optional(),
  name: z.string().min(1, 'Plugin name is required.'),
  version: z.string().regex(SEMVER_PATTERN, 'Plugin version must be a semver string.'),
  description: z.string().min(1, 'Plugin description is required.'),
  activationEvents: z.array(
    z.string().regex(ACTIVATION_EVENT_PATTERN, 'Activation events must use VS Code-style identifiers.'),
  ).optional(),
  entrypoint: z.object({
    module: z.string().regex(
      RELATIVE_PACKAGE_PATH_PATTERN,
      'Entrypoint module must be a relative path inside the plugin package.',
    ),
    export: z.string().regex(EXPORT_NAME_PATTERN, 'Entrypoint export must be a JavaScript export name.').optional(),
  }).optional(),
  contributes: contributesSchema,
  components: componentsSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
  capabilities: z.array(capabilitySchema).optional(),
  renderers: z.array(rendererSchema).optional(),
  paneItems: z.array(paneItemSchema).optional(),
  events: z.array(hookEventSchema.extend({ description: z.string().optional() })).optional(),
  assets: z.array(z.object({
    kind: z.enum(['example', 'runtime', 'documentation', 'fixture']),
    path: z.string().regex(RELATIVE_PACKAGE_PATH_PATTERN, 'Asset paths must stay inside the plugin package.'),
    description: z.string().optional(),
  })).optional(),
  permissions: z.array(z.object({
    scope: z.enum(['workspace-files', 'filesystem', 'network', 'secrets', 'browser', 'shell', 'storage']),
    access: z.enum(['read', 'write', 'execute', 'read-write']),
    reason: z.string().min(1, 'Permission reason is required.'),
  })).optional(),
  compatibility: z.object({
    harnessCore: z.string().optional(),
    agentBrowser: z.string().optional(),
  }).optional(),
}).superRefine((value, context) => {
  if ((value.sourceFormat === undefined || value.sourceFormat === 'agent-harness') && !value.entrypoint) {
    context.addIssue({
      code: 'custom',
      path: ['entrypoint'],
      message: 'Harness plugin manifests require an entrypoint unless they import an external plugin format.',
    });
  }
});

const marketplaceManifestSchema = z.object({
  schemaVersion: z.literal(HARNESS_PLUGIN_MANIFEST_SCHEMA_VERSION),
  name: z.string().min(1, 'Marketplace name is required.'),
  publisher: z.object({
    id: z.string().regex(EVENT_NAME_PATTERN, 'Publisher id must be lowercase dot- or kebab-case.'),
    name: z.string().min(1, 'Publisher name is required.'),
  }),
  plugins: z.array(z.object({
    id: z.string().regex(PLUGIN_ID_PATTERN, 'Plugin id must use reverse-DNS lowercase segments.'),
    name: z.string().min(1, 'Plugin name is required.'),
    version: z.string().regex(SEMVER_PATTERN, 'Plugin version must be a semver string.'),
    description: z.string().min(1, 'Plugin description is required.'),
    manifest: z.string().optional(),
    sourceFormat: sourceFormatSchema.optional(),
    source: z.object({
      type: z.enum(['local', 'git', 'github', 'git-subdir', 'npm', 'url']),
      path: z.string().optional(),
      url: z.string().optional(),
      repo: z.string().optional(),
      package: z.string().optional(),
      version: z.string().optional(),
      registry: z.string().optional(),
      ref: z.string().optional(),
      sha: z.string().optional(),
    }),
    components: componentsSchema,
    activationEvents: z.array(
      z.string().regex(ACTIVATION_EVENT_PATTERN, 'Activation events must use VS Code-style identifiers.'),
    ).optional(),
    contributes: contributesSchema,
    capabilities: z.array(capabilitySchema).optional(),
    strict: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    categories: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    default: z.boolean().optional(),
  }).superRefine((value, context) => {
    if (value.sourceFormat === undefined || value.sourceFormat === 'agent-harness') {
      if (!value.manifest?.endsWith(HARNESS_PLUGIN_MANIFEST_FILENAME)) {
        context.addIssue({
          code: 'custom',
          path: ['manifest'],
          message: `Marketplace plugin entries must reference ${HARNESS_PLUGIN_MANIFEST_FILENAME} manifests.`,
        });
      }
    }
  })),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export function validateHarnessPluginManifest(value: unknown): HarnessManifestValidationResult {
  const result = pluginManifestSchema.safeParse(value);
  return result.success
    ? { success: true, issues: [] }
    : { success: false, issues: result.error.issues.map((issue) => issue.message) };
}

export function parseHarnessPluginManifest(value: unknown): HarnessPluginManifest {
  const result = validateHarnessPluginManifest(value);
  if (!result.success) {
    throw new Error(`Invalid harness plugin manifest: ${result.issues.join('; ')}`);
  }
  return value as HarnessPluginManifest;
}

export function validateHarnessPluginMarketplaceManifest(value: unknown): HarnessManifestValidationResult {
  const result = marketplaceManifestSchema.safeParse(value);
  return result.success
    ? { success: true, issues: [] }
    : { success: false, issues: result.error.issues.map((issue) => issue.message) };
}

export function parseHarnessPluginMarketplaceManifest(value: unknown): HarnessPluginMarketplaceManifest {
  const result = validateHarnessPluginMarketplaceManifest(value);
  if (!result.success) {
    throw new Error(`Invalid harness plugin marketplace manifest: ${result.issues.join('; ')}`);
  }
  return value as HarnessPluginMarketplaceManifest;
}

export function createPluginHookEvent(pluginId: string, eventName: string): HarnessHookEventDescriptor {
  assertPluginId(pluginId);
  if (!EVENT_NAME_PATTERN.test(eventName)) {
    throw new Error('Plugin hook event names must be lowercase dot- or kebab-case.');
  }
  return {
    type: 'plugin',
    name: `${pluginId}.${eventName}`,
  };
}

export function createPluginHookPoint(pluginId: string, eventName: string): string {
  return hookPointForEvent(createPluginHookEvent(pluginId, eventName));
}

function assertPluginId(pluginId: string): void {
  if (!PLUGIN_ID_PATTERN.test(pluginId)) {
    throw new Error('Plugin id must use reverse-DNS lowercase segments.');
  }
}
